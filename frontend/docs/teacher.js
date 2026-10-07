const session=Auth.getSession();
if(!session||session.user.role!=="teacher")location.href="login.html";
document.getElementById("teacherName").textContent=session?.user?.fullName||"Profesor";

document.getElementById("logoutBtn").onclick=async()=>{
  try{await Auth.apiFetch("/api/auth/logout",{method:"POST"})}catch{}
  Auth.clearSession();location.href="login.html";
};

async function loadCourses(){
  const data=await Auth.apiFetch("/api/teacher/courses");
  const host=document.getElementById("courseList");
  host.innerHTML=data.courses.length?data.courses.map(c=>`
    <button class="teacher-item" data-course="${c.id}" style="text-align:left;cursor:pointer;background:#fff">
      <strong>${escapeHtml(c.name)}</strong><br><small>${escapeHtml(c.code)}</small>
    </button>`).join(""):"<p>No hay cursos.</p>";
  host.querySelectorAll("[data-course]").forEach(b=>b.onclick=()=>loadExams(b.dataset.course));
}
async function loadExams(courseId){
  const data=await Auth.apiFetch(`/api/teacher/courses/${courseId}/exams`);
  const host=document.getElementById("examList");
  host.innerHTML=data.exams.length?data.exams.map(e=>`
    <div class="teacher-item">
      <strong>${escapeHtml(e.title)}</strong><br>
      <small>${e.durationMinutes} min · ${escapeHtml(e.status)}</small>
    </div>`).join(""):"<p>No hay evaluaciones.</p>";
}
function escapeHtml(v){
  return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}
loadCourses().catch(e=>alert(e.message));
