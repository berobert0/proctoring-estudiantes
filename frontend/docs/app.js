let questions=[];
let currentQuestion=0;
const answers={};
let remainingSeconds=0;
let examStarted=false;
let attempt=null;
let timerInterval=null;

const questionText=document.getElementById("questionText");
const answersContainer=document.getElementById("answers");
const questionCounter=document.getElementById("questionCounter");
const questionNav=document.getElementById("questionNav");
const prevBtn=document.getElementById("prevBtn");
const nextBtn=document.getElementById("nextBtn");
const finishBtn=document.getElementById("finishBtn");
const timer=document.getElementById("timer");

function requireStudent(){
  const s=Auth.getSession();
  if(!s){location.href="login.html";return null}
  if(s.user.role!=="student"){location.href="teacher.html";return null}
  document.getElementById("studentName").textContent=s.user.fullName;
  document.getElementById("studentCode").textContent=`Código: ${s.user.code}`;
  document.getElementById("watermark").textContent=`${s.user.fullName} • ${s.user.code} • EVALUACIÓN`;
  return s;
}

function renderNavigation(){
  questionNav.innerHTML="";
  questions.forEach((q,i)=>{
    const b=document.createElement("button");
    b.textContent=i+1;
    b.className="question-number";
    if(i===currentQuestion)b.classList.add("active");
    if(answers[q.attemptQuestionId]!==undefined)b.classList.add("answered");
    b.onclick=()=>{if(!examStarted)return;currentQuestion=i;renderQuestion()};
    questionNav.appendChild(b);
  });
}

function renderQuestion(){
  const q=questions[currentQuestion];
  if(!q)return;
  questionCounter.textContent=`Pregunta ${currentQuestion+1} de ${questions.length}`;
  questionText.textContent=q.text;
  answersContainer.innerHTML="";
  q.options.forEach(o=>{
    const l=document.createElement("label");
    l.className="answer-option"+(answers[q.attemptQuestionId]===o.id?" selected":"");
    const input=document.createElement("input");
    input.type="radio";
    input.name="answer";
    input.checked=answers[q.attemptQuestionId]===o.id;
    input.onchange=async()=>{
      answers[q.attemptQuestionId]=o.id;
      renderQuestion();
      try{
        await Auth.apiFetch(`/api/attempts/${attempt.id}/answers`,{
          method:"PUT",
          body:JSON.stringify({attemptQuestionId:q.attemptQuestionId,selectedOptionId:o.id})
        });
      }catch(err){
        window.registerIncident?.("ERROR DE SINCRONIZACIÓN",err.message);
      }
    };
    const s=document.createElement("span");
    s.textContent=o.text;
    l.append(input,s);
    answersContainer.appendChild(l);
  });
  prevBtn.disabled=currentQuestion===0;
  nextBtn.disabled=currentQuestion===questions.length-1;
  renderNavigation();
}

prevBtn.onclick=()=>{if(currentQuestion>0){currentQuestion--;renderQuestion()}};
nextBtn.onclick=()=>{if(currentQuestion<questions.length-1){currentQuestion++;renderQuestion()}};

async function finishExam(auto=false){
  if(window.examFinished)return;
  const answered=Object.keys(answers).length;
  if(!auto && !confirm(`Has respondido ${answered} de ${questions.length} preguntas.\n\n¿Deseas finalizar la evaluación?`))return;
  finishBtn.disabled=true;
  try{
    const result=await Auth.apiFetch(`/api/attempts/${attempt.id}/submit`,{method:"POST"});
    window.examFinished=true;
    examStarted=false;
    clearInterval(timerInterval);
    alert(`Evaluación finalizada.\nPuntaje: ${result.score} / ${result.maxScore}`);
    location.href="login.html";
  }catch(err){
    finishBtn.disabled=false;
    alert("No se pudo finalizar: "+err.message);
  }
}
finishBtn.onclick=()=>finishExam(false);

function updateTimer(){
  const m=Math.floor(Math.max(0,remainingSeconds)/60);
  const s=Math.max(0,remainingSeconds)%60;
  timer.textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  if(!examStarted)return;
  if(remainingSeconds<=0){
    clearInterval(timerInterval);
    finishExam(true);
    return;
  }
  remainingSeconds--;
}

window.startExamClock=()=>{
  examStarted=true;
  if(timerInterval)clearInterval(timerInterval);
  timerInterval=setInterval(updateTimer,1000);
};

async function loadExam(){
  const session=requireStudent();
  if(!session)return;

  document.getElementById("logoutBtn").onclick=async()=>{
    try{await Auth.apiFetch("/api/auth/logout",{method:"POST"})}catch{}
    Auth.clearSession();location.href="login.html";
  };

  const available=await Auth.apiFetch("/api/student/exams");
  if(!available.exams.length){
    document.getElementById("startError").textContent="No tienes evaluaciones disponibles.";
    return;
  }

  const selectedId=Number(session.selectedExamId||0);
  const exam=available.exams.find(x=>x.id===selectedId)||available.exams[0];
  const data=await Auth.apiFetch(`/api/attempts/start`,{
    method:"POST",
    body:JSON.stringify({examId:exam.id})
  });

  attempt=data.attempt;
  questions=data.questions;
  remainingSeconds=data.remainingSeconds;
  Object.assign(answers,data.answers||{});

  document.getElementById("examTitle").textContent=data.exam.title;
  document.getElementById("courseTitle").textContent=`Curso: ${data.exam.courseName}`;
  document.getElementById("examIntro").textContent=`${data.exam.title} · ${data.exam.durationMinutes} minutos`;
  renderQuestion();
  updateTimer();

  window.currentAttemptId=attempt.id;
}

loadExam().catch(err=>{
  console.error(err);
  document.getElementById("startError").textContent=err.message;
});
