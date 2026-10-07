const form=document.getElementById("dniLookupForm");
const dniInput=document.getElementById("dniInput");
const lookupBtn=document.getElementById("lookupBtn");
const lookupError=document.getElementById("lookupError");
const studentPanel=document.getElementById("studentPanel");
const lookupCard=document.getElementById("lookupCard");

function initials(name){
  return String(name||"").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase()||"AL";
}
function esc(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}
function maskDni(dni){
  const x=String(dni||"");
  return x.length===8?`${x.slice(0,2)}****${x.slice(-2)}`:x;
}

form.addEventListener("submit",async e=>{
  e.preventDefault();
  lookupError.textContent="";
  const dni=dniInput.value.replace(/\D/g,"");
  if(!/^\d{8}$/.test(dni)){
    lookupError.textContent="Ingresa un DNI válido de 8 dígitos.";
    return;
  }
  lookupBtn.disabled=true;
  lookupBtn.textContent="Verificando...";
  try{
    const res=await fetch((window.APP_CONFIG?.API_BASE_URL||"")+"/api/portal/lookup-dni",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({dni})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||"No se pudo verificar el DNI");
    renderStudent(data);
  }catch(err){
    lookupError.textContent=err.message;
  }finally{
    lookupBtn.disabled=false;
    lookupBtn.textContent="Verificar estudiante";
  }
});

function renderStudent(data){
  const s=data.student;
  document.getElementById("studentInitials").textContent=initials(s.fullName);
  document.getElementById("studentFullName").textContent=s.fullName;
  document.getElementById("studentMeta").textContent=`${s.courseCount} curso(s) matriculado(s) · ${data.exams.length} evaluación(es) disponible(s)`;
  document.getElementById("studentDni").textContent=maskDni(s.dni);
  document.getElementById("studentCode").textContent=s.code||"—";
  document.getElementById("examCount").textContent=data.exams.length;

  const grid=document.getElementById("examGrid");
  grid.innerHTML=data.exams.map(e=>`
    <article class="exam-card-portal">
      <span class="eyebrow">${esc(e.courseCode)}</span>
      <h4>${esc(e.title)}</h4>
      <p>${esc(e.courseName)}</p>
      <div class="exam-meta">
        <span>⏱ ${e.durationMinutes} min</span>
        <span>📷 Supervisada</span>
        <span>🔀 Preguntas aleatorias</span>
      </div>
      <button class="portal-btn primary" data-exam="${e.id}" data-dni="${esc(s.dni)}">
        Iniciar evaluación
      </button>
    </article>
  `).join("");

  document.getElementById("noExams").classList.toggle("hidden",data.exams.length>0);
  studentPanel.classList.remove("hidden");
  lookupCard.classList.add("hidden");

  grid.querySelectorAll("[data-exam]").forEach(btn=>{
    btn.onclick=()=>startStudentLogin(btn.dataset.dni,btn.dataset.exam);
  });
}

async function startStudentLogin(dni,examId){
  // Seguridad: el DNI identifica, pero para entrar al examen pedimos la clave del estudiante.
  const password=prompt("Ingresa tu clave personal para continuar:");
  if(!password)return;
  try{
    const res=await fetch((window.APP_CONFIG?.API_BASE_URL||"")+"/api/auth/login",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({login:dni,password})
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||"No se pudo iniciar sesión");
    if(data.user.role!=="student")throw new Error("Este acceso no corresponde a un estudiante");
    Auth.setSession({...data,selectedExamId:Number(examId)});
    location.href="exam.html";
  }catch(err){
    alert(err.message);
  }
}

document.getElementById("changeStudentBtn").onclick=()=>{
  studentPanel.classList.add("hidden");
  lookupCard.classList.remove("hidden");
  dniInput.value="";
  dniInput.focus();
};
