'use strict';
// Acesso PostgreSQL exclusivamente ao schema mahach_stage (sem tocar public).
const {Pool,types}=require('pg');
const {AsyncLocalStorage}=require('node:async_hooks');
// Contagens, estoque e flags são inteiros pequenos neste aplicativo.
types.setTypeParser(20, x=>Number(x));
const ctx=new AsyncLocalStorage();
const databaseUrl=String(process.env.DATABASE_URL||'').match(/postgres(?:ql)?:\/\/[^\s'"<>]+/i)?.[0];
if(!databaseUrl) {
 throw Error('DATABASE_URL inválida: não é seguro iniciar sem a conexão PostgreSQL');
}
const pool=new Pool({connectionString:databaseUrl,ssl:{rejectUnauthorized:true},max:5,
 connectionTimeoutMillis:12000,idleTimeoutMillis:30000});
const TABLES='admins|categories|products|orders|site_settings|sessions';
const objRe=new RegExp('\\b(FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES)\\s+(?!mahach_stage\\.)(?:"?)('+TABLES+')(?:"?)\\b','gi');
function sqlize(sql) {
 let s=String(sql).replace(/\bINSERT\s+OR\s+IGNORE\s+INTO\b/gi,'INSERT INTO');
 const ignore=/\bINSERT\s+OR\s+IGNORE\s+INTO\b/i.test(sql);
 s=s.replace(objRe,(_,verb,table)=>verb+' mahach_stage."'+table.toLowerCase()+'"');
 // O código MAHACH só utiliza '?' como marcador de parâmetro SQL.
 let n=0;s=s.replace(/\?/g,()=>'\u0024'+(++n));
 if(ignore)s+=' ON CONFLICT DO NOTHING';
 s=s.replace(/\bCOLLATE\s+NOCASE\b/gi,'');
 return s;
}
async function query(sql,args=[]) {
 const runner=ctx.getStore()||pool;
 return runner.query(sqlize(sql),args);
}
const db={
 prepare(sql){return {
  async get(...args){const result=await query(sql,args);return result.rows[0]},
  async all(...args){const result=await query(sql,args);return result.rows},
  async run(...args){const result=await query(sql,args);return {changes:result.rowCount||0}}
 }},
 async transaction(fn){
  if(ctx.getStore())throw Error('Transação aninhada não é suportada');
  const client=await pool.connect();
  try {await client.query('BEGIN');const answer=await ctx.run(client,fn);await client.query('COMMIT');return answer}
  catch(e){try{await client.query('ROLLBACK')}catch{}throw e}
  finally{client.release()}
 },
 query,
 close:()=>pool.end()
};
async function bootstrap(){
 // Verifica as cinco tabelas importadas. Nunca cria o catálogo no schema public.
 const res=await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='mahach_stage' AND table_name = ANY($1)",[['admins','categories','products','orders','site_settings']]);
 if(res.rows.length!==5)throw Error('Staging incompleto no Neon: importe e valide as cinco tabelas antes de iniciar o servidor');
 const n=await query('SELECT COUNT(*) AS n FROM products');
 if(!n.rows[0]?.n)throw Error('Staging sem produtos. Inicialização bloqueada por segurança.');
 // As sessões de login são novas, nunca copiadas do SQLite.
 await pool.query(`CREATE TABLE IF NOT EXISTS mahach_stage.sessions (
   token_hash TEXT PRIMARY KEY,email TEXT NOT NULL REFERENCES mahach_stage.admins(email),csrf TEXT NOT NULL,expires BIGINT NOT NULL
 )`);
 await pool.query('CREATE INDEX IF NOT EXISTS mahach_sessions_expires_idx ON mahach_stage.sessions(expires)');
 // O importador de staging preservou valores/colunas, mas não criou defaults.
 const defaults={shipping_note:"''",tracking_code:"''",tracking_url:"''",shipping_service:"''",
  payment_status:"'pendente'",bling_export_status:"'nao_enviado'",customer_email:"''",
  mp_preference_id:"''",mp_payment_id:"''",customer_email_sent:'0',admin_email_sent:'0',tracking_email_sent:'0'};
 for(const [col,value] of Object.entries(defaults))await pool.query('ALTER TABLE mahach_stage.orders ALTER COLUMN "'+col+'" SET DEFAULT '+value);
}
module.exports={db,bootstrap,sqlize};
