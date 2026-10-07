const form=document.getElementById("loginForm");
const errorBox=document.getElementById("loginError");
const btn=document.getElementById("loginBtn");

form.addEventListener("submit",async e=>{
  e.preventDefault();
  errorBox.textContent="";
  btn.disabled=true;
  try{
    const res=await fetch((window.APP_CONFIG?.API_BASE_URL||"")+"/api/auth/login",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        login:document.getElementById("loginId").value.trim(),
        password:document.getElementById("password").value
      })
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||"No se pudo iniciar sesión");
    Auth.setSession(data);
    location.href=data.user.role==="teacher"?"teacher.html":"index.html";
  }catch(err){
    errorBox.textContent=err.message;
  }finally{
    btn.disabled=false;
  }
});
