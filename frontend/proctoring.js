window.proctoringIncidents=[];
window.examFinished=false;

const consentCheck=document.getElementById("consentCheck");
const startExamBtn=document.getElementById("startExamBtn");
const startOverlay=document.getElementById("startOverlay");
const securityOverlay=document.getElementById("securityOverlay");
const cameraPreview=document.getElementById("cameraPreview");
const cameraDot=document.getElementById("cameraDot");
const cameraStatus=document.getElementById("cameraStatus");
const incidentCount=document.getElementById("incidentCount");
const securityBadge=document.getElementById("securityBadge");
const startError=document.getElementById("startError");
const toast=document.getElementById("toast");

let monitoringActive=false,cameraStream=null,lastIncident={};

consentCheck.onchange=()=>startExamBtn.disabled=!consentCheck.checked;

function showToast(m){
  toast.textContent=m;toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),1800);
}

async function sendIncident(ev){
  const attemptId=window.currentAttemptId;
  if(!attemptId)return;
  try{
    await Auth.apiFetch(`/api/attempts/${attemptId}/incidents`,{
      method:"POST",
      body:JSON.stringify(ev)
    });
  }catch(err){
    console.warn("Incidencia no sincronizada",err);
  }
}

function registerIncident(type,details=""){
  if(!monitoringActive||window.examFinished)return;
  const now=Date.now();
  if(lastIncident[type]&&now-lastIncident[type]<1200)return;
  lastIncident[type]=now;
  const ev={type,details,clientAt:new Date().toISOString()};
  window.proctoringIncidents.push(ev);
  incidentCount.textContent=window.proctoringIncidents.length;
  const c=window.proctoringIncidents.length;
  if(c>=6){securityBadge.textContent="Revisar";securityBadge.className="badge danger"}
  else if(c>=2){securityBadge.textContent="Atención";securityBadge.className="badge warning"}
  console.warn("[PROCTORING]",ev);
  sendIncident(ev);
  showToast("Incidencia registrada: "+type);
}
window.registerIncident=registerIncident;

async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia)throw new Error("El navegador no permite acceso a cámara.");
  cameraStream=await navigator.mediaDevices.getUserMedia({
    video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},
    audio:false
  });
  cameraPreview.srcObject=cameraStream;
  cameraDot.className="dot on";
  cameraStatus.textContent="Cámara activa";
  cameraStream.getVideoTracks().forEach(t=>t.addEventListener("ended",()=>{
    cameraDot.className="dot off";
    cameraStatus.textContent="Cámara desconectada";
    registerIncident("CÁMARA INTERRUMPIDA");
  }));
}

async function requestFullscreen(){
  if(!document.fullscreenElement&&document.documentElement.requestFullscreen){
    await document.documentElement.requestFullscreen();
  }
}

startExamBtn.onclick=async()=>{
  startExamBtn.disabled=true;
  startError.textContent="";
  try{
    await startCamera();
    await requestFullscreen();
    monitoringActive=true;
    startOverlay.classList.add("hidden");
    await sendIncident({
      type:"CONSENTIMIENTO SUPERVISIÓN",
      details:"El estudiante aceptó las condiciones antes de iniciar.",
      clientAt:new Date().toISOString()
    });
    window.startExamClock?.();
  }catch(e){
    startError.textContent="No se pudo iniciar. Verifica el permiso de cámara y vuelve a intentarlo.";
    startExamBtn.disabled=false;
    console.error(e);
  }
};

document.addEventListener("contextmenu",e=>{
  if(!monitoringActive)return;e.preventDefault();registerIncident("MENÚ CONTEXTUAL BLOQUEADO");
});
["copy","cut","paste"].forEach(n=>document.addEventListener(n,e=>{
  if(!monitoringActive)return;e.preventDefault();registerIncident(n.toUpperCase()+" BLOQUEADO");
}));
document.addEventListener("keydown",e=>{
  if(!monitoringActive)return;
  const k=e.key.toLowerCase(),ctrl=e.ctrlKey||e.metaKey;
  if((ctrl&&["c","x","v","p","s","u"].includes(k))||e.key==="F12"){
    e.preventDefault();e.stopPropagation();
    registerIncident("ATAJO BLOQUEADO",`${e.ctrlKey?"Ctrl+":""}${e.key}`);
  }
});
document.addEventListener("visibilitychange",()=>{
  if(!monitoringActive||window.examFinished)return;
  if(document.hidden){
    registerIncident("CAMBIO DE PESTAÑA / VENTANA OCULTA");
    securityOverlay.classList.remove("hidden");
  }else securityOverlay.classList.add("hidden");
});
window.addEventListener("blur",()=>{
  if(monitoringActive&&!window.examFinished)registerIncident("VENTANA SIN FOCO");
});
document.addEventListener("fullscreenchange",()=>{
  if(monitoringActive&&!window.examFinished&&!document.fullscreenElement){
    registerIncident("SALIDA DE PANTALLA COMPLETA");
    showToast("Debes permanecer en pantalla completa");
  }
});
window.addEventListener("beforeunload",e=>{
  if(!monitoringActive||window.examFinished)return;
  e.preventDefault();e.returnValue="";
});
