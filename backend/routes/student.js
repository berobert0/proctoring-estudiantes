const express=require("express");
const db=require("../db");
const {requireAuth,requireRole}=require("../middleware/auth");
const router=express.Router();

router.use(requireAuth,requireRole("student"));

router.get("/exams",async(req,res,next)=>{
  try{
    const {rows}=await db.query(`
      SELECT e.id,e.title,e.duration_minutes AS "durationMinutes",
             c.name AS "courseName",c.code AS "courseCode"
      FROM exams e
      JOIN courses c ON c.id=e.course_id
      JOIN course_students cs ON cs.course_id=c.id
      WHERE cs.student_id=$1
        AND e.status='published'
        AND (e.starts_at IS NULL OR e.starts_at<=NOW())
        AND (e.ends_at IS NULL OR e.ends_at>=NOW())
      ORDER BY e.id
    `,[req.user.id]);
    res.json({exams:rows});
  }catch(err){next(err)}
});

module.exports=router;
