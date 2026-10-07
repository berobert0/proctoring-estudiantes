// Aquí podrás reemplazar estas preguntas por las preguntas reales de tu curso.
// Más adelante también pueden venir desde una API o una base de datos.

const questions = [
  {
    id: 1,
    text: "¿Cuál es el objetivo principal de este curso?",
    options: [
      "Aprender los conceptos fundamentales",
      "Completar actividades sin estudiar",
      "Evitar el uso de recursos digitales",
      "Ninguna de las anteriores"
    ]
  },
  {
    id: 2,
    text: "¿Cuál de las siguientes opciones corresponde a un ejemplo de aprendizaje activo?",
    options: [
      "Resolver un caso práctico",
      "No participar en clase",
      "Ignorar las actividades",
      "Copiar respuestas"
    ]
  },
  {
    id: 3,
    text: "Pregunta de ejemplo 3: reemplaza este texto por una pregunta de tu curso.",
    options: [
      "Opción A",
      "Opción B",
      "Opción C",
      "Opción D"
    ]
  }
];

let currentQuestion = 0;
const answers = {};
let remainingSeconds = 30 * 60;

const questionText = document.getElementById("questionText");
const answersContainer = document.getElementById("answers");
const questionCounter = document.getElementById("questionCounter");
const questionNav = document.getElementById("questionNav");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const finishBtn = document.getElementById("finishBtn");
const timer = document.getElementById("timer");

function renderNavigation() {
  questionNav.innerHTML = "";

  questions.forEach((question, index) => {
    const button = document.createElement("button");
    button.textContent = index + 1;
    button.className = "question-number";

    if (index === currentQuestion) {
      button.classList.add("active");
    }

    if (answers[question.id] !== undefined) {
      button.classList.add("answered");
    }

    button.addEventListener("click", () => {
      currentQuestion = index;
      renderQuestion();
    });

    questionNav.appendChild(button);
  });
}

function renderQuestion() {
  const question = questions[currentQuestion];

  questionCounter.textContent =
    `Pregunta ${currentQuestion + 1} de ${questions.length}`;

  questionText.textContent = question.text;
  answersContainer.innerHTML = "";

  question.options.forEach((option, optionIndex) => {
    const label = document.createElement("label");
    label.className = "answer-option";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "answer";
    input.value = optionIndex;

    if (answers[question.id] === optionIndex) {
      input.checked = true;
    }

    input.addEventListener("change", () => {
      answers[question.id] = optionIndex;
      renderNavigation();
    });

    const span = document.createElement("span");
    span.textContent = option;

    label.appendChild(input);
    label.appendChild(span);
    answersContainer.appendChild(label);
  });

  prevBtn.disabled = currentQuestion === 0;
  nextBtn.disabled = currentQuestion === questions.length - 1;

  renderNavigation();
}

prevBtn.addEventListener("click", () => {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion();
  }
});

nextBtn.addEventListener("click", () => {
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion();
  }
});

finishBtn.addEventListener("click", () => {
  const answered = Object.keys(answers).length;

  const confirmFinish = confirm(
    `Has respondido ${answered} de ${questions.length} preguntas. ¿Deseas finalizar?`
  );

  if (confirmFinish) {
    console.log("Respuestas del estudiante:", answers);
    alert("Examen finalizado. En una siguiente etapa enviaremos estas respuestas al servidor.");
  }
});

function updateTimer() {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  timer.textContent =
    `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  if (remainingSeconds <= 0) {
    clearInterval(timerInterval);
    alert("El tiempo del examen ha finalizado.");
    return;
  }

  remainingSeconds--;
}

const timerInterval = setInterval(updateTimer, 1000);

renderQuestion();
updateTimer();
