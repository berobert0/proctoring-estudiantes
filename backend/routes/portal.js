const express=require("express");
const rateLimit=require("express-rate-limit");
const db=require("../db");

const router=express.Router();

const lookupLimiter=rateLimit({
  windowMs:15*60*1000,
  limit:30,
  standardHeaders:true,
  legacyHeaders:false
});

router.post("/lookup-dni",lookupLimiter,async(req,res,next)=>{
  try{
    const dni=String(req.body.dni||"").replace(/\D/g,"");
    if(!/^\d{8}$/.test(dni)){
      return res.status(400).json({error:"DNI inválido"});
    }

    const uq=await db.query(`
      SELECT
        u.id,u.code,u.dni,u.full_name,
        sp.career,sp.phone,sp.age,sp.enrollment_status
      FROM users u
      LEFT JOIN student_profiles sp ON sp.user_id=u.id
      WHERE u.dni=$1 AND u.role='student' AND u.active=TRUE
      LIMIT 1
    `,[dni]);

    const student=uq.rows[0];
    if(!student){
      return res.status(404).json({error:"No se encontró un estudiante activo con ese DNI"});
    }

    const cohorts=await db.query(`
      SELECT c.code,c.cycle,c.shift,c.academic_year,c.academic_term
      FROM cohort_students cs
      JOIN cohorts c ON c.id=cs.cohort_id
      WHERE cs.student_id=$1
      ORDER BY c.academic_year DESC,c.cycle,c.shift
    `,[student.id]);

    const exams=await db.query(`
      SELECT e.id,e.title,e.duration_minutes AS "durationMinutes",
             c.code AS "courseCode",c.name AS "courseName"
      FROM exams e
      JOIN courses c ON c.id=e.course_id
      JOIN course_students cs ON cs.course_id=c.id
      WHERE cs.student_id=$1
        AND e.status='published'
        AND (e.starts_at IS NULL OR e.starts_at<=NOW())
        AND (e.ends_at IS NULL OR e.ends_at>=NOW())
      ORDER BY c.name,e.id
    `,[student.id]);

    res.json({
      student:{
        dni:student.dni,
        code:student.code,
        fullName:student.full_name,
        career:student.career||"ELECTRICIDAD INDUSTRIAL",
        phone:student.phone,
        age:student.age,
        enrollmentStatus:student.enrollment_status,
        cohorts:cohorts.rows,
        courseCount:cohorts.rows.length
      },
      exams:exams.rows
    });
  }catch(err){next(err)}
});

module.exports=router;
