const crypto=require("crypto");
const db=require("../db");

function hashToken(token){
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function requireAuth(req,res,next){
  try{
    const header=req.get("authorization")||"";
    const token=header.startsWith("Bearer ")?header.slice(7):"";
    if(!token)return res.status(401).json({error:"Sesión requerida"});

    const tokenHash=hashToken(token);
    const {rows}=await db.query(`
      SELECT s.id session_id,s.expires_at,u.id,u.role,u.code,u.full_name,u.email,u.active
      FROM auth_sessions s
      JOIN users u ON u.id=s.user_id
      WHERE s.token_hash=$1
        AND s.revoked_at IS NULL
        AND s.expires_at>NOW()
        AND u.active=TRUE
      LIMIT 1
    `,[tokenHash]);

    if(!rows[0])return res.status(401).json({error:"Sesión inválida o expirada"});
    req.user=rows[0];
    req.rawToken=token;
    next();
  }catch(err){next(err)}
}

function requireRole(role){
  return (req,res,next)=>{
    if(req.user?.role!==role)return res.status(403).json({error:"No autorizado para este recurso"});
    next();
  };
}

module.exports={requireAuth,requireRole,hashToken};
