require("dotenv").config();
const path=require("path");
const fs=require("fs");
const XLSX=require("xlsx");
const bcrypt=require("bcryptjs");
const db=require("./db");

const DATA_DIR=path.resolve(__dirname,"data");
const FILES=[
  "ELECTRICIDAD - I - III - V - DIURNO.xlsx",
  "ELECTRICIDAD- I - III - V - NOCTURNO.xlsx"
];

function clean(v){
  return String(v??"").trim();
}

function cleanDni(v){
  const s=clean(v).replace(/\D/g,"");
  return s.length===8?s:"";
}

function cleanPhone(v){
  return clean(v).replace(/[^\d+]/g,"");
}

function parseAge(v){
  const n=Number(v);
  return Number.isInteger(n)&&n>=14&&n<=100?n:null;
}

function normalizeEmail(v){
  const email=clean(v).toLowerCase();
  if(!email)return null;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return null;
  return email;
}

function cohortMeta(sheetName){
  const m=String(sheetName).match(/^EI-(1|3|5)-(D|N)$/i);

  if(!m){
    throw new Error(`Hoja no reconocida: ${sheetName}`);
  }

  return {
    code:sheetName.toUpperCase(),
    cycle:Number(m[1]),
    shift:m[2].toUpperCase()==="D"?"DIURNO":"NOCTURNO",
    career:"ELECTRICIDAD INDUSTRIAL",
    academicYear:2026,
    academicTerm:"I"
  };
}

function extractRows(workbook,sheetName,sourceFile){
  const ws=workbook.Sheets[sheetName];
  const rows=XLSX.utils.sheet_to_json(
    ws,
    {
      header:1,
      defval:"",
      raw:false
    }
  );

  const out=[];
  const seenDni=new Set();

  for(let i=10;i<rows.length;i++){

    const r=rows[i]||[];

    const dni=cleanDni(r[1]);
    const fullName=clean(r[2]).toUpperCase();

    if(!dni||!fullName){
      continue;
    }

    if(seenDni.has(dni)){
      continue;
    }

    seenDni.add(dni);

    out.push({
      dni,
      fullName,
      enrollmentStatus:clean(r[3]).toUpperCase(),
      age:parseAge(r[4]),
      phone:cleanPhone(r[5]),
      email:normalizeEmail(r[6]),
      sourceFile,
      sheetName
    });
  }

  return out;
}

async function ensureCohort(client,meta){

  const q=await client.query(`
    INSERT INTO cohorts(
      code,
      career,
      cycle,
      shift,
      academic_year,
      academic_term
    )
    VALUES($1,$2,$3,$4,$5,$6)

    ON CONFLICT(code)
    DO UPDATE SET
      career=EXCLUDED.career,
      cycle=EXCLUDED.cycle,
      shift=EXCLUDED.shift,
      academic_year=EXCLUDED.academic_year,
      academic_term=EXCLUDED.academic_term

    RETURNING id
  `,[
    meta.code,
    meta.career,
    meta.cycle,
    meta.shift,
    meta.academicYear,
    meta.academicTerm
  ]);

  return q.rows[0].id;
}

async function emailAvailableForUser(client,email,userId=null){

  if(!email){
    return null;
  }

  const q=await client.query(`
    SELECT id,dni,full_name
    FROM users
    WHERE LOWER(email)=LOWER($1)
    LIMIT 1
  `,[email]);

  if(!q.rows[0]){
    return email;
  }

  if(userId && Number(q.rows[0].id)===Number(userId)){
    return email;
  }

  return null;
}

async function upsertStudent(client,row,conflicts){

  const q=await client.query(`
    SELECT id,email
    FROM users
    WHERE dni=$1
    LIMIT 1
  `,[row.dni]);

  let userId;

  if(q.rows[0]){

    userId=q.rows[0].id;

    const desiredEmail=
      await emailAvailableForUser(
        client,
        row.email,
        userId
      );

    if(row.email && !desiredEmail){

      conflicts.push({
        dni:row.dni,
        nombre:row.fullName,
        correo:row.email,
        accion:"Correo duplicado omitido"
      });
    }

    await client.query(`
      UPDATE users
      SET
        full_name=$2,
        email=
          CASE
            WHEN $3::text IS NULL
            THEN email
            ELSE $3
          END,
        active=TRUE
      WHERE id=$1
    `,[
      userId,
      row.fullName,
      desiredEmail
    ]);

  }else{

    const passwordHash=
      await bcrypt.hash(
        row.dni,
        12
      );

    const safeEmail=
      await emailAvailableForUser(
        client,
        row.email,
        null
      );

    if(row.email && !safeEmail){

      conflicts.push({
        dni:row.dni,
        nombre:row.fullName,
        correo:row.email,
        accion:"Estudiante creado sin correo duplicado"
      });
    }

    const ins=await client.query(`
      INSERT INTO users(
        role,
        code,
        dni,
        full_name,
        email,
        password_hash,
        active
      )
      VALUES(
        'student',
        $1,
        $2,
        $3,
        $4,
        $5,
        TRUE
      )
      RETURNING id
    `,[
      row.dni,
      row.dni,
      row.fullName,
      safeEmail,
      passwordHash
    ]);

    userId=ins.rows[0].id;
  }

  await client.query(`
    INSERT INTO student_profiles(
      user_id,
      career,
      phone,
      age,
      enrollment_status,
      updated_at
    )
    VALUES(
      $1,
      'ELECTRICIDAD INDUSTRIAL',
      $2,
      $3,
      $4,
      NOW()
    )

    ON CONFLICT(user_id)
    DO UPDATE SET
      phone=EXCLUDED.phone,
      age=EXCLUDED.age,
      enrollment_status=EXCLUDED.enrollment_status,
      updated_at=NOW()
  `,[
    userId,
    row.phone||null,
    row.age,
    row.enrollmentStatus||null
  ]);

  return userId;
}

async function main(){

  for(const file of FILES){

    const full=
      path.join(
        DATA_DIR,
        file
      );

    if(!fs.existsSync(full)){

      throw new Error(
        `Falta el archivo: ${full}`
      );
    }
  }

  const client=
    await db.getClient();

  const stats=[];
  const conflicts=[];
  const globalStudents=
    new Set();

  try{

    await client.query("BEGIN");

    for(const filename of FILES){

      const workbook=
        XLSX.readFile(
          path.join(
            DATA_DIR,
            filename
          )
        );

      for(
        const sheetName
        of workbook.SheetNames
      ){

        if(
          !/^EI-(1|3|5)-(D|N)$/i
          .test(sheetName)
        ){
          continue;
        }

        const meta=
          cohortMeta(sheetName);

        const cohortId=
          await ensureCohort(
            client,
            meta
          );

        const rows=
          extractRows(
            workbook,
            sheetName,
            filename
          );

        let processed=0;

        for(const row of rows){

          const userId=
            await upsertStudent(
              client,
              row,
              conflicts
            );

          await client.query(`
            INSERT INTO cohort_students(
              cohort_id,
              student_id,
              source_file,
              imported_at
            )
            VALUES(
              $1,
              $2,
              $3,
              NOW()
            )

            ON CONFLICT(
              cohort_id,
              student_id
            )
            DO UPDATE SET
              source_file=
                EXCLUDED.source_file,
              imported_at=NOW()
          `,[
            cohortId,
            userId,
            filename
          ]);

          processed++;

          globalStudents.add(
            row.dni
          );
        }

        stats.push({
          grupo:sheetName,
          procesados:processed,
          turno:meta.shift,
          ciclo:meta.cycle
        });
      }
    }

    await client.query("COMMIT");

    console.log(
      "\nIMPORTACIÓN COMPLETADA"
    );

    console.table(stats);

    console.log(
      `Estudiantes únicos procesados: ${globalStudents.size}`
    );

    if(conflicts.length){

      console.log(
        `\nCORREOS DUPLICADOS/CONFLICTIVOS: ${conflicts.length}`
      );

      console.table(conflicts);

      console.log(
        "Los estudiantes se conservaron. Solo se omitieron los correos duplicados."
      );

    }else{

      console.log(
        "\nNo se detectaron conflictos de correo."
      );
    }

    console.log(
      "\nLa importación puede volver a ejecutarse sin duplicar estudiantes."
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

  console.error(
    "\nERROR DE IMPORTACIÓN:",
    err
  );

  process.exit(1);
});