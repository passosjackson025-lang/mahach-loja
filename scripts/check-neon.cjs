'use strict';
const {Client}=require('pg');
(async()=>{
 const cs=process.env.DATABASE_URL;
 if(!cs||!/^postgres(?:ql)?:\/\//.test(cs))throw Error('DATABASE_URL ausente');
 const c=new Client({connectionString:cs,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:12000});
 try{
  await c.connect();
  const r=await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='mahach_stage' AND table_name = ANY($1)",[['admins','categories','products','orders','site_settings']]);
  if(r.rowCount!==5)throw Error('Esquema mahach_stage incompleto.');
  console.log('CONEXÃO NEON OK — consulta somente leitura');
  for(const t of ['products','categories','admins','orders','site_settings']){
   const r=await c.query('SELECT COUNT(*) AS n FROM mahach_stage."'+t+'"');
   console.log(t+': '+r.rows[0].n);
  }
 }finally{await c.end().catch(()=>{})}
})().catch(e=>{console.error('ERRO:',e.message);process.exitCode=1});
