'use strict';
// Verificações com driver simulado. Não abre conexão de rede nem usa credenciais reais.
const assert=require('node:assert/strict');
const Module=require('node:module');
const crypto=require('node:crypto');
const original=Module._load;
const history=[];
const salt='abcdef0123456789abcdef0123456789';
const password='TestPassword_12345!';
const hash=crypto.scryptSync(password,salt,64).toString('hex');
let sessions=[];let fakeSettings=[];
class Pool {
 async query(sql,args=[]){
  history.push({sql,args});
  const lower=sql.toLowerCase();let rows=[],rowCount=0;
  const result=(items)=>({rows:items,rowCount:items.length});
  if(lower.includes('information_schema.tables'))return result(['admins','categories','products','orders','site_settings'].map(table_name=>({table_name})));
  if(lower.includes('create table')||lower.includes('create index')||lower.includes('alter table')||lower==='begin'||lower==='commit'||lower==='rollback')return result([]);
  if(lower.includes('count(*)'))return result([{n:lower.includes('products')?1770:0}]);
  if(lower.includes('select key,value,encrypted,updated_at from'))return result(fakeSettings);
  if(lower.includes('select * from mahach_stage."admins"'))return result(args[0]==='admin@example.test'?[{email:'admin@example.test',salt,hash}]:[]);
  if(lower.includes('select email,csrf,expires from mahach_stage."sessions"'))return result(sessions.filter(s=>s.token_hash===args[0]&&s.expires>args[1]));
  if(lower.includes('delete from mahach_stage."sessions"')){sessions=sessions.filter(s=>!((lower.includes('expires')&&s.expires<args[0])||(lower.includes('token_hash')&&s.token_hash===args[0])));return result([])}
  if(lower.includes('insert into mahach_stage."sessions"')){sessions.push({token_hash:args[0],email:args[1],csrf:args[2],expires:args[3]});return {rows:[],rowCount:1}}
  if(lower.includes('from mahach_stage."categories"')&&lower.includes('count(p.id)'))return result([{id:'perfumes',name:'Perfumaria',subtitle:'',total:1770}]);
  if(lower.includes('from mahach_stage."products"')&&lower.includes('brand'))return result([{brand:'Marca',total:17}]);
  if(lower.includes('from mahach_stage."products"')&&lower.includes('select id,name,price'))return result([{id:'sample-1',name:'Perfume',price:99,category:'perfumes',brand:'Marca',family:'',image:'',stock:3}]);
  if(lower.includes('select * from mahach_stage."products"'))return result([{id:'sample-1',name:'Perfume',price:99,category:'perfumes',brand:'Marca',family:'',image:'',stock:3,active:1,description:'',sku:''}]);
  if(lower.includes('from mahach_stage."categories"'))return result([{id:'perfumes',name:'Perfumaria',subtitle:''}]);
  if(lower.includes('from mahach_stage."orders"'))return result([]);
  if(lower.includes('from mahach_stage."site_settings"'))return result(fakeSettings);
  return result([]);
 }
 async connect(){return {query:this.query.bind(this),release(){}}}
 async end(){}
}
Module._load=function(id,parent,isMain){if(id==='pg')return {Pool,types:{setTypeParser(){}}};return original.call(this,id,parent,isMain)};
process.env.DATABASE_URL='postgresql://test:abc@localhost/mock';
process.env.MAHACH_SETTINGS_KEY='00'.repeat(32);
async function main(){
 const {sqlize}=require('../pg-db');
 assert.equal(sqlize('SELECT * FROM products WHERE id=? AND active=1'),'SELECT * FROM mahach_stage."products" WHERE id=$1 AND active=1');
 assert.equal(sqlize('INSERT OR IGNORE INTO categories(id,name) VALUES(?,?)'),'INSERT INTO mahach_stage."categories"(id,name) VALUES($1,$2) ON CONFLICT DO NOTHING');
 const {server,ready,db}=require('../server');await ready;
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  let r=await fetch(base+'/api/health');assert.equal(r.status,200);assert.equal((await r.json()).catalog,1770);
  r=await fetch(base+'/api/products');assert.equal(r.status,200);const products=await r.json();assert.equal(products.total,1770);assert.equal(products.products.length,1);
  r=await fetch(base+'/api/meta');assert.equal(r.status,200);assert.equal((await r.json()).categories.length,1);
  r=await fetch(base+'/api/admin/stats');assert.equal(r.status,401);
  r=await fetch(base+'/private/mahach.sqlite');assert.equal(r.status,404);
  r=await fetch(base+'/finalizado.html');assert.equal(r.status,200);
  r=await fetch(base+'/contato.html');assert.equal(r.status,200);assert.ok((await r.text()).includes('sac.lacour@gmail.com'));
  r=await fetch(base+'/sobre.html');assert.equal(r.status,200);assert.ok((await r.text()).includes('storyTitle'));
  r=await fetch(base+'/assets/lacour-experience.css');assert.equal(r.status,200);assert.ok(r.headers.get('content-type').includes('text/css'));
  r=await fetch(base+'/api/orders',{method:'POST',headers:{'content-type':'application/json',Origin:base},body:'{}'});assert.equal(r.status,503);
  r=await fetch(base+'/api/admin/login',{method:'POST',headers:{'content-type':'application/json',Origin:base},body:JSON.stringify({email:'admin@example.test',password})});
  assert.equal(r.status,200);const token=(r.headers.get('set-cookie')||'').split(';')[0];const body=await r.json();assert.ok(body.csrf);
  r=await fetch(base+'/api/admin/session',{headers:{Cookie:token}});assert.equal(r.status,200);assert.equal((await r.json()).authenticated,true);
  r=await fetch(base+'/api/admin/settings',{headers:{Cookie:token}});assert.equal(r.status,200);assert.ok(Array.isArray((await r.json()).fields));
  r=await fetch(base+'/api/admin/stats',{headers:{Cookie:token}});assert.equal(r.status,200);
  r=await fetch(base+'/api/admin/settings',{method:'PUT',headers:{Cookie:token,Origin:base,'content-type':'application/json','x-csrf-token':body.csrf},body:JSON.stringify({values:{WHATSAPP:'5511999998888'}})});assert.equal(r.status,503);
  assert.equal(history.filter(x=>/\bpublic\./i.test(x.sql)).length,0);
  console.log('OFFLINE OK: SQL, health, catálogo, login/sessão, configurações, bloqueio privado e checkout desativado.');
 }finally{await new Promise(r=>server.close(r));await db.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
