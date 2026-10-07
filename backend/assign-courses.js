require("dotenv").config();
const db=require("./db");

/*
=========================================================
CONFIGURACIÓN PRINCIPAL
=========================================================
Cursos configurados para V ciclo:
- Diurno: EI-5-D
- Nocturno: EI-5-N
=========================================================
*/

const COURSE_ASSIGNMENTS = [
  {
    courseCode: "MANT-CONTROL",
    courseName: "MANTENIMIENTO DE SISTEMAS DE CONTROL AUTOMÁTICOS",
    cohorts: ["EI-5-D"],
    examTitle: "Evaluación 1",
    durationMinutes: 30
  },
  {
    courseCode: "PROY-ILUM",
    courseName: "PROYECTO DE SISTEMAS DE ILUMINACIÓN",
    cohorts: ["EI-5-D"],
    examTitle: "Evaluación 1",
    durationMinutes: 30
  },
  {
    courseCode: "AUTOM-DIA",
    courseName: "PROYECTO DE SISTEMAS DE AUTOMATIZACIÓN INDUSTRIAL - DIURNO",
    cohorts: ["EI-5-D"],
    examTitle: "Evaluación 1",
    durationMinutes: 30
  },
  {
    courseCode: "AUTOM-NOCHE",
    courseName: "PROYECTO DE SISTEMAS DE AUTOMATIZACIÓN INDUSTRIAL - NOCHE",
    cohorts: ["EI-5-N"],
    examTitle: "Evaluación 1",
    durationMinutes: 30
  }
];

async function getTeacherId(client){
  const q=await client.query(`
    SELECT id,full_name
    FROM users
    WHERE role='teacher' AND code='DOC001'
    LIMIT 1
  `);

  if(!q.rows[0]){
    throw new Error(
      "No se encontró al docente DOC001. Revisa el código del profesor en la base."
    );
  }

  return q.rows[0];
}

async function ensureCourse(client,teacherId,item){
  const q=await client.query(`
    INSERT INTO courses(code,name,teacher_id)
    VALUES($1,$2,$3)

    ON CONFLICT(code)
    DO UPDATE SET
      name=EXCLUDED.name,
      teacher_id=EXCLUDED.teacher_id

    RETURNING id,code,name
  `,[item.courseCode,item.courseName,teacherId]);

  return q.rows[0];
}

async function ensureExam(client,courseId,item){
  const existing=await client.query(`
    SELECT id,title,status,duration_minutes
    FROM exams
    WHERE course_id=$1 AND title=$2
    LIMIT 1
  `,[courseId,item.examTitle]);

  if(existing.rows[0]){
    const q=await client.query(`
      UPDATE exams
      SET
        duration_minutes=$2,
        randomize_questions=TRUE,
        randomize_options=TRUE,
        status='published'
      WHERE id=$1
      RETURNING id,title,status,duration_minutes
    `,[existing.rows[0].id,item.durationMinutes]);

    return q.rows[0];
  }

  const q=await client.query(`
    INSERT INTO exams(
      course_id,
      title,
      duration_minutes,
      randomize_questions,
      randomize_options,
      status
    )
    VALUES($1,$2,$3,TRUE,TRUE,'published')
    RETURNING id,title,status,duration_minutes
  `,[courseId,item.examTitle,item.durationMinutes]);

  return q.rows[0];
}

async function assignCohortsToCourse(client,courseId,cohortCodes){
  let assigned=0;
  const details=[];

  for(const code of cohortCodes){
    const cq=await client.query(`
      SELECT id,code,cycle,shift
      FROM cohorts
      WHERE UPPER(code)=UPPER($1)
      LIMIT 1
    `,[code]);

    if(!cq.rows[0]){
      details.push({
        cohort:code,
        status:"NO ENCONTRADO",
        students:0
      });
      continue;
    }

    const cohort=cq.rows[0];

    const before=await client.query(`
      SELECT COUNT(*)::int count
      FROM cohort_students
      WHERE cohort_id=$1
    `,[cohort.id]);

    await client.query(`
      INSERT INTO course_students(course_id,student_id)
      SELECT $1,cs.student_id
      FROM cohort_students cs
      WHERE cs.cohort_id=$2

      ON CONFLICT(course_id,student_id)
      DO NOTHING
    `,[courseId,cohort.id]);

    const after=await client.query(`
      SELECT COUNT(*)::int count
      FROM course_students
      WHERE course_id=$1
        AND student_id IN (
          SELECT student_id
          FROM cohort_students
          WHERE cohort_id=$2
        )
    `,[courseId,cohort.id]);

    assigned+=after.rows[0].count;

    details.push({
      cohort:cohort.code,
      cycle:cohort.cycle,
      shift:cohort.shift,
      students:before.rows[0].count,
      assigned:after.rows[0].count,
      status:"OK"
    });
  }

  return {assigned,details};
}

async function verifyCourse(client,courseId){
  const q=await client.query(`
    SELECT
      c.code,
      c.name,
      COUNT(DISTINCT cs.student_id)::int AS students,
      COUNT(DISTINCT e.id)::int AS exams
    FROM courses c
    LEFT JOIN course_students cs ON cs.course_id=c.id
    LEFT JOIN exams e ON e.course_id=c.id
    WHERE c.id=$1
    GROUP BY c.id,c.code,c.name
  `,[courseId]);

  return q.rows[0];
}

async function main(){
  const configured=COURSE_ASSIGNMENTS.filter(
    x=>Array.isArray(x.cohorts) && x.cohorts.length>0
  );

  if(!configured.length){
    console.log("\nNO SE REALIZÓ NINGUNA ASIGNACIÓN.\n");
    process.exit(0);
  }

  const client=await db.getClient();

  try{
    await client.query("BEGIN");

    const teacher=await getTeacherId(client);
    console.log(`\nDocente: ${teacher.full_name}\n`);

    const report=[];

    for(const item of configured){
      const course=await ensureCourse(client,teacher.id,item);
      const exam=await ensureExam(client,course.id,item);

      const assignment=await assignCohortsToCourse(
        client,
        course.id,
        item.cohorts
      );

      const verify=await verifyCourse(client,course.id);

      report.push({
        course:course.code,
        name:course.name,
        cohorts:item.cohorts.join(", "),
        students:verify.students,
        exams:verify.exams,
        examStatus:exam.status
      });

      console.log(`CURSO: ${course.name}`);
      console.table(assignment.details);
    }

    await client.query("COMMIT");

    console.log("\nRESUMEN FINAL");
    console.table(report);

    console.log("\nASIGNACIÓN COMPLETADA.");
    console.log(
      "Los estudiantes asignados ya pueden ver los exámenes publicados desde el portal."
    );

  }catch(err){
    await client.query("ROLLBACK");
    throw err;
  }finally{
    client.release();
    await db.pool.end();
  }
}

main().catch(err=>{
  console.error("\nERROR:",err);
  process.exit(1);
});
