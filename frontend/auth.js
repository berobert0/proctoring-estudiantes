const API = window.APP_CONFIG?.API_BASE_URL || "";

function getSession(){
  try{return JSON.parse(sessionStorage.getItem("exam_session") || "null")}catch{return null}
}
function setSession(data){
  sessionStorage.setItem("exam_session", JSON.stringify(data));
}
function clearSession(){
  sessionStorage.removeItem("exam_session");
}
function authHeaders(extra={}){
  const s=getSession();
  return {
    "Content-Type":"application/json",
    ...(s?.token ? {"Authorization":`Bearer ${s.token}`} : {}),
    ...extra
  };
}
async function apiFetch(path,options={}){
  const res=await fetch(API+path,{
    ...options,
    headers:authHeaders(options.headers||{})
  });
  if(res.status===401){
    clearSession();
    if(!location.pathname.endsWith("login.html")) location.href="login.html";
    throw new Error("Sesión expirada");
  }
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||`Error HTTP ${res.status}`);
  return data;
}
window.Auth={API,getSession,setSession,clearSession,authHeaders,apiFetch};
