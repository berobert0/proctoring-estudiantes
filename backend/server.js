require("dotenv").config();
const express=require("express");
const cors=require("cors");
const helmet=require("helmet");
const rateLimit=require("express-rate-limit");
const path=require("path");

const authRoutes=require("./routes/auth");
const studentRoutes=require("./routes/student");
const attemptRoutes=require("./routes/attempts");
const teacherRoutes=require("./routes/teacher");
const portalRoutes=require("./routes/portal");

const app=express();
const PORT=Number(process.env.PORT||3000);

app.set("trust proxy",1);
app.use(helmet({crossOriginResourcePolicy:{policy:"cross-origin"}}));
app.use(cors({
  origin:(origin,cb)=>{
    const allowed=(process.env.FRONTEND_ORIGIN||"").split(",").map(x=>x.trim()).filter(Boolean);
    if(!origin||allowed.includes(origin))return cb(null,true);
    cb(new Error("Origen no autorizado por CORS"));
  }
}));
app.use(express.json({limit:"1mb"}));
app.use(rateLimit({windowMs:60*1000,limit:240,standardHeaders:true,legacyHeaders:false}));

app.get("/api/health",(req,res)=>res.json({ok:true,time:new Date().toISOString()}));
app.use("/api/auth",authRoutes);
app.use("/api/portal",portalRoutes);
app.use("/api/student",studentRoutes);
app.use("/api/attempts",attemptRoutes);
app.use("/api/teacher",teacherRoutes);

if(process.env.SERVE_FRONTEND==="true"){
  const publicDir=path.resolve(__dirname,"../frontend");
  app.use(express.static(publicDir));
  app.get("/",(req,res)=>res.sendFile(path.join(publicDir,"login.html")));
}

app.use((err,req,res,next)=>{
  console.error(err);
  if(String(err.message||"").includes("CORS"))return res.status(403).json({error:"Origen no autorizado"});
  res.status(500).json({error:"Error interno del servidor"});
});

app.listen(PORT,()=>console.log(`API escuchando en http://localhost:${PORT}`));
