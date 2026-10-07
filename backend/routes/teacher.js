const express=require("express");
const db=require("../db");
const {requireAuth,requireRole}=require("../middleware/auth");
const router=express.Router();

router.use(requireAuth,requireRole("teacher"));

router.get("/courses",async(req,res,next)=>{
  try{
    const {rows}=await db.query(`
      SELECT id,code,name FROM courses WHERE teacher_id=$1 ORDER BY name
    `,[req.user.id]);
    res.json({courses:rows});
  }catch(err){next(err)}
});

router.get("/courses/:id/exams",async(req,res,next)=>{
  try{
    const {rows}=await db.query(`
      SELECT e.id,e.title,e.duration_minutes AS "durationMinutes",e.status,
             e.starts_at AS "startsAt",e.ends_at AS "endsAt"
      FROM exams e JOIN courses c ON c.id=e.course_id
      WHERE c.id=$1 AND c.teacher_id=$2
      ORDER BY e.id DESC
    `,[Number(req.params.id),req.user.id]);
    res.json({exams:rows});
  }catch(err){next(err)}
});

router.get("/attempts/:id/report",async(req,res,next)=>{
  try{
    const a=await db.query(`
      SELECT a.id,a.started_at,a.submitted_at,a.score,a.max_score,a.incident_count,
             u.code,u.full_name,e.title,c.name course_name
      FROM attempts a
      JOIN users u ON u.id=a.student_id
      JOIN exams e ON e.id=a.exam_id
      JOIN courses c ON c.id=e.course_id
      WHERE a.id=$1 AND c.teacher_id=$2
    `,[Number(req.params.id),req.user.id]);
    if(!a.rows[0])return res.status(404).json({error:"Reporte no encontrado"});
    const incidents=await db.query(`
      SELECT id,type,details,client_at,server_at
      FROM incidents WHERE attempt_id=$1 ORDER BY server_at
    `,[Number(req.params.id)]);
    res.json({attempt:a.rows[0],incidents:incidents.rows});
  }catch(err){next(err)}
});

module.exports=router;
