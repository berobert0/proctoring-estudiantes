const express=require("express");
const bcrypt=require("bcryptjs");
const crypto=require("crypto");
const rateLimit=require("express-rate-limit");
const db=require("../db");
const {requireAuth,hashToken}=require("../middleware/auth");

const router=express.Router();
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false});

router.post("/login",loginLimiter,async(req,res,next)=>{
  try{
    const login=String(req.body.login||"").trim();
    const password=String(req.body.password||"");
    if(!login||!password)return res.status(400).json({error:"Usuario y contraseña son obligatorios"});

    const {rows}=await db.query(`
      SELECT id,role,code,full_name,email,password_hash,active
      FROM users
      WHERE LOWER(code)=LOWER($1) OR LOWER(email)=LOWER($1) OR dni=$1
      LIMIT 1
    `,[login]);
    const user=rows[0];
    if(!user||!user.active||!(await bcrypt.compare(password,user.password_hash))){
      return res.status(401).json({error:"Credenciales incorrectas"});
    }

    const rawToken=crypto.randomBytes(32).toString("hex");
    const hours=Math.max(1,Number(process.env.SESSION_HOURS||8));
    await db.query(`
      INSERT INTO auth_sessions(user_id,token_hash,expires_at,user_agent,ip)
      VALUES($1,$2,NOW()+($3||' hours')::interval,$4,$5)
    `,[user.id,hashToken(rawToken),String(hours),req.get("user-agent")||"",req.ip]);

    res.json({
      token:rawToken,
      user:{
        id:user.id,role:user.role,code:user.code,
        fullName:user.full_name,email:user.email
      }
    });
  }catch(err){next(err)}
});

router.post("/logout",requireAuth,async(req,res,next)=>{
  try{
    await db.query("UPDATE auth_sessions SET revoked_at=NOW() WHERE id=$1",[req.user.session_id]);
    res.json({ok:true});
  }catch(err){next(err)}
});

router.get("/me",requireAuth,(req,res)=>{
  res.json({user:{
    id:req.user.id,role:req.user.role,code:req.user.code,
    fullName:req.user.full_name,email:req.user.email
  }});
});

module.exports=router;
