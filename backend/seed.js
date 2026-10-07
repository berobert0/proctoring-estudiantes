require("dotenv").config();
const bcrypt=require("bcryptjs");
const db=require("./db");

async function seed(){
  const client=await db.getClient();
  try{
    await client.query("BEGIN");
    const teacherHash=await bcrypt.hash("Profesor123!",12);
    const studentHash=await bcrypt.hash("Alumno123!",12);

    const t=await client.query(`
      INSERT INTO users(role,code,dni,full_name,email,password_hash)
      VALUES('teacher','DOC001',NULL,'Profesor Demo','profesor@demo.local',$1)
      ON CONFLICT(code) DO UPDATE SET full_name=EXCLUDED.full_name
      RETURNING id
    `,[teacherHash]);

    const s=await client.query(`
      INSERT INTO users(role,code,dni,full_name,email,password_hash)
      VALUES('student','000001','12345678','Alumno Demo','alumno@demo.local',$1)
      ON CONFLICT(code) DO UPDATE SET full_name=EXCLUDED.full_name
      RETURNING id
    `,[studentHash]);

    const c=await client.query(`
      INSERT INTO courses(code,name,teacher_id)
      VALUES('CURSO-DEMO','Curso de Demostración',$1)
      ON CONFLICT(code) DO UPDATE SET teacher_id=EXCLUDED.teacher_id
      RETURNING id
    `,[t.rows[0].id]);

    await client.query(`
      INSERT INTO course_students(course_id,student_id)
      VALUES($1,$2) ON CONFLICT DO NOTHING
    `,[c.rows[0].id,s.rows[0].id]);

    const institutionalCourses=[
      ["MANT-CONTROL","MANTENIMIENTO DE SISTEMAS DE CONTROL AUTOMÁTICOS"],
      ["PROY-ILUM","PROYECTO DE SISTEMAS DE ILUMINACIÓN"],
      ["AUTOM-DIA","PROYECTO DE SISTEMAS DE AUTOMATIZACIÓN INDUSTRIAL - DIURNO"],
      ["AUTOM-NOCHE","PROYECTO DE SISTEMAS DE AUTOMATIZACIÓN INDUSTRIAL - NOCHE"]
    ];
    for(const [code,name] of institutionalCourses){
      await client.query(`
        INSERT INTO courses(code,name,teacher_id)
        VALUES($1,$2,$3)
        ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name,teacher_id=EXCLUDED.teacher_id
      `,[code,name,t.rows[0].id]);
    }

    let e=await client.query(`
      SELECT id FROM exams WHERE course_id=$1 AND title='Evaluación Demo' LIMIT 1
    `,[c.rows[0].id]);

    let examId;
    if(e.rows[0]) examId=e.rows[0].id;
    else{
      const created=await client.query(`
        INSERT INTO exams(course_id,title,duration_minutes,randomize_questions,randomize_options,status)
        VALUES($1,'Evaluación Demo',30,TRUE,TRUE,'published')
        RETURNING id
      `,[c.rows[0].id]);
      examId=created.rows[0].id;

      const questionData=[
        ["¿Cuál es el objetivo principal de este curso?",
          ["Aprender los conceptos fundamentales","Completar actividades sin estudiar","Evitar el uso de recursos digitales","Ninguna de las anteriores"],0],
        ["¿Cuál corresponde a un ejemplo de aprendizaje activo?",
          ["Resolver un caso práctico","No participar en clase","Ignorar las actividades","Copiar respuestas"],0],
        ["¿Qué debe hacer el sistema ante una incidencia de supervisión?",
          ["Registrarla para revisión docente","Declarar fraude automáticamente","Cerrar siempre el examen","Eliminar las respuestas"],0]
      ];

      for(const [text,options,correct] of questionData){
        const q=await client.query(
          "INSERT INTO questions(course_id,text) VALUES($1,$2) RETURNING id",
          [c.rows[0].id,text]
        );
        for(let i=0;i<options.length;i++){
          await client.query(
            "INSERT INTO question_options(question_id,text,is_correct) VALUES($1,$2,$3)",
            [q.rows[0].id,options[i],i===correct]
          );
        }
        await client.query(
          "INSERT INTO exam_questions(exam_id,question_id,points) VALUES($1,$2,1)",
          [examId,q.rows[0].id]
        );
      }
    }

    await client.query("COMMIT");
    console.log("Seed completado.");
    console.log("Profesor: DOC001 / Profesor123!");
    console.log("Alumno: 000001 / Alumno123!");
  }catch(err){
    await client.query("ROLLBACK");
    throw err;
  }finally{
    client.release();
    await db.pool.end();
  }
}
seed().catch(err=>{console.error(err);process.exit(1)});
