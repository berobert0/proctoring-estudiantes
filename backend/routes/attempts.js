const express=require("express");
const db=require("../db");
const {requireAuth,requireRole}=require("../middleware/auth");
const router=express.Router();

router.use(requireAuth,requireRole("student"));

function shuffle(a){
  const x=[...a];
  for(let i=x.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [x[i],x[j]]=[x[j],x[i]];
  }
  return x;
}

router.post("/start",async(req,res,next)=>{
  const client=await db.getClient();
  try{
    const examId=Number(req.body.examId);
    if(!Number.isInteger(examId))return res.status(400).json({error:"Examen inválido"});

    await client.query("BEGIN");
    const examQ=await client.query(`
      SELECT e.id,e.title,e.duration_minutes,e.randomize_questions,e.randomize_options,
             c.id course_id,c.name course_name
      FROM exams e
      JOIN courses c ON c.id=e.course_id
      JOIN course_students cs ON cs.course_id=c.id AND cs.student_id=$1
      WHERE e.id=$2 AND e.status='published'
        AND (e.starts_at IS NULL OR e.starts_at<=NOW())
        AND (e.ends_at IS NULL OR e.ends_at>=NOW())
      FOR UPDATE
    `,[req.user.id,examId]);

    const exam=examQ.rows[0];
    if(!exam){await client.query("ROLLBACK");return res.status(404).json({error:"Evaluación no disponible"})}

    let at=await client.query(`
      SELECT * FROM attempts
      WHERE exam_id=$1 AND student_id=$2 AND status='in_progress'
      ORDER BY id DESC LIMIT 1
    `,[examId,req.user.id]);

    let attempt=at.rows[0];

    if(!attempt){
      const created=await client.query(`
        INSERT INTO attempts(exam_id,student_id,started_at,status,consent_at)
        VALUES($1,$2,NOW(),'in_progress',NOW())
        RETURNING *
      `,[examId,req.user.id]);
      attempt=created.rows[0];

      let eq=await client.query(`
        SELECT q.id,q.text,eq.points
        FROM exam_questions eq JOIN questions q ON q.id=eq.question_id
        WHERE eq.exam_id=$1 AND q.active=TRUE
        ORDER BY eq.id
      `,[examId]);

      let qs=eq.rows;
      if(exam.randomize_questions)qs=shuffle(qs);

      for(let i=0;i<qs.length;i++){
        const opts=await client.query(`
          SELECT id FROM question_options WHERE question_id=$1 ORDER BY id
        `,[qs[i].id]);
        let optionIds=opts.rows.map(x=>x.id);
        if(exam.randomize_options)optionIds=shuffle(optionIds);
        await client.query(`
          INSERT INTO attempt_questions(attempt_id,question_id,position,option_order)
          VALUES($1,$2,$3,$4::jsonb)
        `,[attempt.id,qs[i].id,i+1,JSON.stringify(optionIds)]);
      }
    }

    const qrows=await client.query(`
      SELECT aq.id AS "attemptQuestionId",q.text,aq.position,aq.option_order
      FROM attempt_questions aq
      JOIN questions q ON q.id=aq.question_id
      WHERE aq.attempt_id=$1
      ORDER BY aq.position
    `,[attempt.id]);

    const questions=[];
    for(const q of qrows.rows){
      const ids=Array.isArray(q.option_order)?q.option_order:[];
      const orows=ids.length?await client.query(`
        SELECT id,text FROM question_options WHERE id=ANY($1::bigint[])
      `,[ids]):{rows:[]};
      const byId=new Map(orows.rows.map(o=>[Number(o.id),o]));
      questions.push({
        attemptQuestionId:q.attemptQuestionId,
        text:q.text,
        options:ids.map(id=>byId.get(Number(id))).filter(Boolean)
      });
    }

    const arows=await client.query(`
      SELECT attempt_question_id,selected_option_id
      FROM answers WHERE attempt_id=$1
    `,[attempt.id]);
    const answers={};
    for(const a of arows.rows)answers[a.attempt_question_id]=Number(a.selected_option_id);

    const elapsed=Math.floor((Date.now()-new Date(attempt.started_at).getTime())/1000);
    const remainingSeconds=Math.max(0,exam.duration_minutes*60-elapsed);

    await client.query("COMMIT");
    res.json({
      attempt:{id:attempt.id},
      exam:{id:exam.id,title:exam.title,courseName:exam.course_name,durationMinutes:exam.duration_minutes},
      questions,answers,remainingSeconds
    });
  }catch(err){
    await client.query("ROLLBACK").catch(()=>{});
    next(err);
  }finally{client.release()}
});

router.put("/:id/answers",async(req,res,next)=>{
  try{
    const attemptId=Number(req.params.id);
    const aqId=Number(req.body.attemptQuestionId);
    const optionId=Number(req.body.selectedOptionId);

    const check=await db.query(`
      SELECT aq.id,aq.question_id
      FROM attempts a
      JOIN attempt_questions aq ON aq.attempt_id=a.id
      WHERE a.id=$1 AND a.student_id=$2 AND a.status='in_progress' AND aq.id=$3
    `,[attemptId,req.user.id,aqId]);
    const aq=check.rows[0];
    if(!aq)return res.status(404).json({error:"Intento o pregunta no válidos"});

    const valid=await db.query(`
      SELECT id FROM question_options WHERE id=$1 AND question_id=$2
    `,[optionId,aq.question_id]);
    if(!valid.rows[0])return res.status(400).json({error:"Alternativa inválida"});

    await db.query(`
      INSERT INTO answers(attempt_id,attempt_question_id,selected_option_id,answered_at)
      VALUES($1,$2,$3,NOW())
      ON CONFLICT(attempt_question_id)
      DO UPDATE SET selected_option_id=EXCLUDED.selected_option_id,answered_at=NOW()
    `,[attemptId,aqId,optionId]);

    res.json({ok:true});
  }catch(err){next(err)}
});

router.post("/:id/incidents",async(req,res,next)=>{
  try{
    const attemptId=Number(req.params.id);
    const type=String(req.body.type||"").slice(0,120);
    const details=String(req.body.details||"").slice(0,1000);
    const clientAt=req.body.clientAt?new Date(req.body.clientAt):null;
    if(!type)return res.status(400).json({error:"Tipo de incidencia requerido"});

    const own=await db.query(`
      SELECT id FROM attempts WHERE id=$1 AND student_id=$2 AND status='in_progress'
    `,[attemptId,req.user.id]);
    if(!own.rows[0])return res.status(404).json({error:"Intento no válido"});

    await db.query(`
      INSERT INTO incidents(attempt_id,type,details,client_at,server_at)
      VALUES($1,$2,$3,$4,NOW())
    `,[attemptId,type,details,clientAt&& !isNaN(clientAt)?clientAt:null]);

    res.status(201).json({ok:true});
  }catch(err){next(err)}
});

router.post("/:id/submit",async(req,res,next)=>{
  const client=await db.getClient();
  try{
    const attemptId=Number(req.params.id);
    await client.query("BEGIN");

    const own=await client.query(`
      SELECT a.id,a.exam_id
      FROM attempts a
      WHERE a.id=$1 AND a.student_id=$2 AND a.status='in_progress'
      FOR UPDATE
    `,[attemptId,req.user.id]);
    const attempt=own.rows[0];
    if(!attempt){await client.query("ROLLBACK");return res.status(404).json({error:"Intento no válido"})}

    const scoreQ=await client.query(`
      SELECT
        COALESCE(SUM(CASE WHEN qo.is_correct THEN eq.points ELSE 0 END),0)::numeric AS score,
        COALESCE(SUM(eq.points),0)::numeric AS max_score
      FROM attempt_questions aq
      JOIN exam_questions eq ON eq.exam_id=$1 AND eq.question_id=aq.question_id
      LEFT JOIN answers a ON a.attempt_question_id=aq.id
      LEFT JOIN question_options qo ON qo.id=a.selected_option_id
      WHERE aq.attempt_id=$2
    `,[attempt.exam_id,attemptId]);

    const incidents=await client.query("SELECT COUNT(*)::int count FROM incidents WHERE attempt_id=$1",[attemptId]);
    const score=Number(scoreQ.rows[0].score||0);
    const maxScore=Number(scoreQ.rows[0].max_score||0);

    await client.query(`
      UPDATE attempts
      SET status='submitted',submitted_at=NOW(),score=$2,max_score=$3,incident_count=$4
      WHERE id=$1
    `,[attemptId,score,maxScore,incidents.rows[0].count]);

    await client.query("COMMIT");
    res.json({ok:true,score,maxScore,incidentCount:incidents.rows[0].count});
  }catch(err){
    await client.query("ROLLBACK").catch(()=>{});
    next(err);
  }finally{client.release()}
});

module.exports=router;
