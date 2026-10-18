'use strict';
// Testa login/CSRF, foto local 1200x1200, gravação do produto, categorias e configs.
// PG é simulado — não conecta ao Neon e não faz chamadas externas.
const assert=require('node:assert/strict');
const Module=require('node:module');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const original=Module._load;
const password='TestPassword_12345!', salt='abcdef0123456789abcdef0123456789';
const passwdHash=crypto.scryptSync(password,salt,64).toString('hex');
const sessionRows=[], categories=new Map([['perfumes',{id:'perfumes',name:'Perfumaria',subtitle:''}]]);
const product={id:'sample-1',name:'Perfume de Teste',price:99,description:'',category:'perfumes',brand:'Teste',family:'',image:'',sku:'',stock:3,weight:null,width:null,height:null,length:null,active:1,search_text:''};
let settings=[];
class Pool {
 async query(sql,args=[]){
  const s=sql.toLowerCase();const rows=(r)=>({rows:r,rowCount:r.length});
  if(s.includes('information_schema.tables'))return rows(['admins','categories','products','orders','site_settings'].map(table_name=>({table_name})));
  if(s.startsWith('create ')||s.startsWith('alter ')||s==='begin'||s==='commit'||s==='rollback')return rows([]);
  if(s.includes('count(*)'))return rows([{n:1770}]);
  if(s.includes('select key,value,encrypted,updated_at'))return rows(settings);
  if(s.includes('select * from mahach_stage."admins"'))return rows(args[0]==='admin@example.test'?[{email:args[0],salt,hash:passwdHash}]:[]);
  if(s.includes('select email,csrf,expires from mahach_stage."sessions"'))return rows(sessionRows.filter(x=>x.token_hash===args[0]&&x.expires>args[1]));
  if(s.includes('insert into mahach_stage."sessions"')){sessionRows.push({token_hash:args[0],email:args[1],csrf:args[2],expires:args[3]});return {rows:[],rowCount:1}}
  if(s.includes('delete from mahach_stage."sessions"'))return rows([]);
  if(s.includes('select id from mahach_stage."categories"'))return rows(categories.has(args[0])?[{id:args[0]}]:[]);
  if(s.includes('from mahach_stage."categories"'))return rows([...categories.values()]);
  if(s.startsWith('insert into mahach_stage."categories"')){categories.set(args[0],{id:args[0],name:args[1],subtitle:args[2]});return {rows:[],rowCount:1}}
  if(s.startsWith('update mahach_stage."categories"')){const cat=categories.get(args[2]);if(cat){cat.name=args[0];cat.subtitle=args[1]}return {rows:[],rowCount:cat?1:0}}
  if(s.includes('select id from mahach_stage."products"'))return rows(args[0]===product.id?[{id:product.id}]:[]);
  if(s.includes('select * from mahach_stage."products"'))return rows(args[0] && args[0]!==product.id?[]:[{...product}]);
  if(s.includes('select id,name,price')&&s.includes('from mahach_stage."products"'))return rows([{...product}]);
  if(s.startsWith('update mahach_stage."products"')){
   const names=['name','price','description','category','brand','family','image','sku','stock','weight','width','height','length','active','search_text'];
   names.forEach((n,i)=>product[n]=args[i]);return {rows:[],rowCount:1};
  }
  if(s.includes('from mahach_stage."site_settings"'))return rows(settings);
  if(s.startsWith('insert into mahach_stage."site_settings"')){
   settings=settings.filter(r=>r.key!==args[0]);settings.push({key:args[0],value:args[1],encrypted:args[2],updated_at:args[3]});return {rows:[],rowCount:1};
  }
  if(s.includes('from mahach_stage."orders"'))return rows([]);
  return rows([]);
 }
 async connect(){return {query:this.query.bind(this),release(){}}}
 async end(){}
}
Module._load=function(id,parent,main){if(id==='pg')return {Pool,types:{setTypeParser(){}}};return original.call(this,id,parent,main)};
process.env.DATABASE_URL='postgresql://test@localhost/mahach_fake';
process.env.MAHACH_SETTINGS_KEY='00'.repeat(32);
process.env.MAHACH_ENABLE_ADMIN_WRITES='true';
process.env.MAHACH_ENABLE_CHECKOUT='false';
delete process.env.NODE_ENV;
for(const key of ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'])delete process.env[key];
function fakeWebp(){const b=Buffer.alloc(32);b.write('RIFF',0,'ascii');b.writeUInt32LE(b.length-8,4);b.write('WEBP',8,'ascii');b.write('VP8X',12,'ascii');b.writeUIntLE(1199,24,3);b.writeUIntLE(1199,27,3);return b}
async function run(){
 const {server,ready,db}=require('../server');await ready;
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;let uploaded;
 try{
  let r=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'admin@example.test',password})});assert.equal(r.status,200);
  const cookie=r.headers.get('set-cookie').split(';')[0],csrf=(await r.json()).csrf;
  const headers={Origin:base,Cookie:cookie,'X-CSRF-Token':csrf};
  r=await fetch(base+'/api/admin/capabilities',{headers:{Cookie:cookie}});assert.equal(r.status,200);const capabilities=await r.json();assert.equal(capabilities.writes,true);assert.equal(capabilities.imageStorage,'local');
  r=await fetch(base+'/api/admin/images',{method:'POST',headers:{...headers,'Content-Type':'image/webp'},body:fakeWebp()});
  assert.equal(r.status,201,await r.clone().text());const image=(await r.json()).url;assert.match(image,/^\/assets\/produtos\/[a-f0-9]{36}\.webp$/);
  uploaded=path.join(__dirname,'..',image.slice(1));assert.equal(fs.existsSync(uploaded),true);
  // Produto deve receber a URL que a API de imagens acabou de salvar.
  const body={name:product.name,description:'',category:'perfumes',brand:'Teste',family:'',image,sku:'',stock:3,price:99,active:true,weight:null,width:null,height:null,length:null};
  r=await fetch(base+'/api/admin/products/sample-1',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());assert.equal(product.image,image);
  r=await fetch(base+'/api/products/sample-1');assert.equal(r.status,200);assert.equal((await r.json()).product.image,image);
  r=await fetch(base+'/api/admin/categories',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({name:'Novos',subtitle:'Teste'})});assert.equal(r.status,201,await r.clone().text());assert.ok(categories.has('novos'));
  r=await fetch(base+'/api/admin/settings',{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({values:{WHATSAPP:'5511999998888'}})});assert.equal(r.status,200,await r.clone().text());assert.ok(settings.some(x=>x.key==='WHATSAPP'));
  r=await fetch(base+'/api/orders',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,503);
  console.log('ADMIN OK (SIMULADO): login, CSRF, upload WebP, edição e leitura de foto, categoria e configurações. Checkout desativado.');
 }finally{if(uploaded&&fs.existsSync(uploaded))fs.unlinkSync(uploaded);await new Promise(resolve=>server.close(resolve));await db.close()}
}
run().catch(e=>{console.error(e);process.exitCode=1});
