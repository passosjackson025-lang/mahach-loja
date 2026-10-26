'use strict';
const fs=require('node:fs');
const crypto=require('node:crypto');
const {FIELDS}=require('./site-settings'); // Somente metadados dos campos, nunca usa SQLite.
function getKey(keyFile,allowCreate){
 const value=process.env.MAHACH_SETTINGS_KEY;
 if(value){const buf=/^[a-f0-9]{64}$/i.test(value)?Buffer.from(value,'hex'):Buffer.from(value,'base64');if(buf.length!==32)throw Error('MAHACH_SETTINGS_KEY inválida');return buf}
 if(fs.existsSync(keyFile)){const buf=fs.readFileSync(keyFile);if(buf.length!==32)throw Error('settings.key inválida');return buf}
 if(!allowCreate||process.env.NODE_ENV==='production')throw Error('Defina MAHACH_SETTINGS_KEY com a chave ORIGINAL. Não gere uma chave nova para dados criptografados.');
 const key=crypto.randomBytes(32);fs.mkdirSync(require('node:path').dirname(keyFile),{recursive:true,mode:0o700});fs.writeFileSync(keyFile,key,{mode:0o600,flag:'wx'});return key;
}
function seal(key,value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64')}
function unseal(key,value){const bytes=Buffer.from(value,'base64'),dec=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));dec.setAuthTag(bytes.subarray(12,28));return Buffer.concat([dec.update(bytes.subarray(28)),dec.final()]).toString('utf8')}
async function makeSettingsPg(db,keyFile){
 let cachedKey;let stored=new Map();
 const key=(allowCreate=false)=>cachedKey??=getKey(keyFile,allowCreate);
 async function reload(){
  const rows=await db.prepare('SELECT key,value,encrypted,updated_at FROM site_settings').all();
  const next=new Map();
  for(const r of rows){if(!FIELDS[r.key])continue;if(r.encrypted)unseal(key(false),r.value);next.set(r.key,r)}
  stored=next;
 }
 await reload();
 function get(name){
  if(!FIELDS[name])throw Error('Configuração não suportada');
  const row=stored.get(name);
  if(process.env[name])return String(process.env[name]);
  return row?(row.encrypted?unseal(key(false),row.value):row.value):String(FIELDS[name].default||'');
 }
 function list(){return Object.entries(FIELDS).map(([name,meta])=>{
  const row=stored.get(name),value=get(name);
  return {key:name,label:meta.label,kind:meta.kind,section:meta.section,configured:!!value,
   hasStoredOverride:!!row,source:process.env[name]?'ambiente':row?'painel':'vazio',value:meta.kind==='secret'?'':value,updatedAt:row?.updated_at||null};
 })}
 async function save(changes,clears=[]){
  if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Array.isArray(clears))throw Object.assign(Error('Dados inválidos'),{status:400});
  if(Object.keys(changes).length>FIELDS.length||clears.length>FIELDS.length)throw Object.assign(Error('Muitos campos'),{status:400});
  const updates=[];
  for(const [name,raw] of Object.entries(changes)){
   const def=FIELDS[name];if(!def||typeof raw!=='string')throw Object.assign(Error('Campo inválido: '+name),{status:400});
   const value=raw.trim();if(process.env[name]&&value)throw Object.assign(Error('Este campo é controlado pelo ambiente: '+name),{status:409});if(value.length>(def.max||1500))throw Object.assign(Error('Valor muito longo: '+name),{status:400});
   if(def.kind==='secret'&&!value)continue;
   if(def.kind==='cep'&&value&&!/^\d{8}$/.test(value.replace(/\D/g,'')))throw Object.assign(Error('CEP deve ter oito dígitos'),{status:400});
   if(def.kind==='phone'&&value&&!/^\d{10,15}$/.test(value.replace(/\D/g,'')))throw Object.assign(Error('WhatsApp precisa conter DDI e DDD'),{status:400});
   if(def.kind==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Object.assign(Error('E-mail inválido'),{status:400});
   if(def.kind==='url'&&value){let u;try{u=new URL(value)}catch{}if(!u||u.protocol!=='https:')throw Object.assign(Error('URL precisa usar HTTPS'),{status:400})}
   if(def.kind==='bool'&&value&&!['true','false'].includes(value))throw Object.assign(Error('Use true ou false'),{status:400});
   updates.push([name,['cep','phone'].includes(def.kind)?value.replace(/\D/g,''):value,def.kind==='secret']);
  }
  for(const name of clears)if(!FIELDS[name]||typeof name!=='string')throw Object.assign(Error('Campo inválido para limpar'),{status:400});
  await db.transaction(async()=>{
   const upsert=db.prepare('INSERT INTO site_settings(key,value,encrypted,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,encrypted=excluded.encrypted,updated_at=excluded.updated_at');
   for(const [name,value,secret] of updates)await upsert.run(name,secret?seal(key(true),value):value,secret?1:0,new Date().toISOString());
   const del=db.prepare('DELETE FROM site_settings WHERE key=?');for(const name of clears)await del.run(name);
  });
  await reload();return list();
 }
 return {get,list,save};
}
module.exports={makeSettingsPg};
