'use strict';
// Configurações persistentes. Segredos AES-256-GCM: nunca enviados ao navegador.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const FIELDS=Object.freeze({
 WHATSAPP:{label:'WhatsApp de atendimento',kind:'phone',section:'loja'},
 SHOP_ADDRESS:{label:'Endereço para retirada',kind:'text',section:'loja',max:250},
 ORIGIN_CEP:{label:'CEP da loja (origem do frete)',kind:'cep',section:'melhor-envio'},
 SHIPPING_CONTACT_EMAIL:{label:'E-mail operacional do frete',kind:'email',section:'melhor-envio'},
 MELHOR_ENVIO_SANDBOX:{label:'Ambiente de testes (true/false)',kind:'bool',section:'melhor-envio'},
 MELHOR_ENVIO_TOKEN:{label:'Token Melhor Envio',kind:'secret',section:'melhor-envio',max:8192},
 VENDIZAP_ID:{label:'ID Vendizap',kind:'text',section:'vendizap'},
 VENDIZAP_SECRET:{label:'Secret Vendizap',kind:'secret',section:'vendizap'},
 BLING_CLIENT_ID:{label:'Client ID Bling',kind:'text',section:'bling'},
 BLING_CLIENT_SECRET:{label:'Client Secret Bling',kind:'secret',section:'bling'},
 BLING_REDIRECT_URI:{label:'URL de retorno Bling OAuth',kind:'url',section:'bling'},
 MERCADO_PAGO_PUBLIC_KEY:{label:'Chave pública Mercado Pago',kind:'text',section:'mercado-pago'},
 MERCADO_PAGO_ACCESS_TOKEN:{label:'Access Token Mercado Pago',kind:'secret',section:'mercado-pago'},
 MERCADO_PAGO_WEBHOOK_SECRET:{label:'Assinatura secreta do Webhook Mercado Pago',kind:'secret',section:'mercado-pago'},
 PUBLIC_SITE_URL:{label:'URL pública HTTPS do site (para retorno e webhook)',kind:'url',section:'mercado-pago'},
 RESEND_API_KEY:{label:'API Key Resend para e-mails transacionais',kind:'secret',section:'email'},
 MAIL_FROM:{label:'Remetente verificado (ex: MAHACH <pedidos@dominio.com>)',kind:'text',section:'email',max:200},
 ADMIN_EMAIL:{label:'E-mail que recebe avisos de vendas aprovadas',kind:'email',section:'email'},
});
function init(db){db.exec(`CREATE TABLE IF NOT EXISTS site_settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,encrypted INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL);`);}
function getKey(dbPath){
 const fromEnv=process.env.MAHACH_SETTINGS_KEY;
 if(fromEnv){const b=/^[a-f0-9]{64}$/i.test(fromEnv)?Buffer.from(fromEnv,'hex'):Buffer.from(fromEnv,'base64');if(b.length!==32)throw new Error('MAHACH_SETTINGS_KEY precisa ter 32 bytes');return b}
 const filename=path.join(path.dirname(dbPath),'settings.key');
 if(fs.existsSync(filename)){const b=fs.readFileSync(filename);if(b.length!==32)throw new Error('Chave de configurações inválida');return b}
 const key=crypto.randomBytes(32);fs.writeFileSync(filename,key,{mode:0o600,flag:'wx'});return key;
}
function seal(key,value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]).toString('base64')}
function unseal(key,value){const bytes=Buffer.from(value,'base64'),dec=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));dec.setAuthTag(bytes.subarray(12,28));return Buffer.concat([dec.update(bytes.subarray(28)),dec.final()]).toString('utf8')}
function makeSettings(db,dbPath){init(db);let cachedKey;
 function get(name){if(!FIELDS[name])throw Error('Configuração não suportada');const row=db.prepare('SELECT value,encrypted FROM site_settings WHERE key=?').get(name);if(row){if(row.encrypted){cachedKey??=getKey(dbPath);return unseal(cachedKey,row.value)}return row.value}return String(process.env[name]||'')}
 function list(){return Object.entries(FIELDS).map(([key,meta])=>{const row=db.prepare('SELECT updated_at FROM site_settings WHERE key=?').get(key),value=get(key);return {key,label:meta.label,kind:meta.kind,section:meta.section,configured:!!value,source:row?'painel':process.env[key]?'ambiente':'vazio',value:meta.kind==='secret'?'':value,updatedAt:row?.updated_at||null}})}
 function save(changes,clears=[]){if(!changes||typeof changes!=='object'||Array.isArray(changes)||!Array.isArray(clears))throw Object.assign(new Error('Dados inválidos'),{status:400});
 if(Object.keys(changes).length>FIELDS.length||clears.length>FIELDS.length)throw Object.assign(new Error('Muitos campos'),{status:400});
 const upd=[];for(const [name,raw]of Object.entries(changes)){
  const def=FIELDS[name];if(!def||typeof raw!=='string')throw Object.assign(new Error('Campo inválido: '+name),{status:400});const value=raw.trim(),max=def.max||1500;
  if(value.length>max)throw Object.assign(new Error('Valor muito longo: '+name),{status:400});
  if(def.kind==='secret'&&!value)continue; // Campo vazio não apaga credencial.
  if(def.kind==='cep'&&value&&!/^\d{8}$/.test(value.replace(/\D/g,'')))throw Object.assign(new Error('CEP deve ter oito dígitos'),{status:400});
  if(def.kind==='phone'&&value&&!/^\d{10,15}$/.test(value.replace(/\D/g,'')))throw Object.assign(new Error('WhatsApp precisa conter DDI e DDD'),{status:400});
  if(def.kind==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))throw Object.assign(new Error('E-mail inválido'),{status:400});
  if(def.kind==='url'&&value){let u;try{u=new URL(value)}catch{}if(!u||u.protocol!=='https:')throw Object.assign(new Error('URL precisa usar HTTPS'),{status:400})}
  if(def.kind==='bool'&&value&&!['true','false'].includes(value))throw Object.assign(new Error('Use true ou false'),{status:400});
  upd.push([name,def.kind==='cep'?value.replace(/\D/g,''):def.kind==='phone'?value.replace(/\D/g,''):value,def.kind==='secret']);
 }
 for(const name of clears){if(!FIELDS[name]||typeof name!=='string')throw Object.assign(new Error('Campo inválido para limpar'),{status:400})}
 db.exec('BEGIN IMMEDIATE');try{
  const stmt=db.prepare('INSERT INTO site_settings(key,value,encrypted,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,encrypted=excluded.encrypted,updated_at=excluded.updated_at');
  for(const [name,value,secret]of upd){if(secret)cachedKey??=getKey(dbPath);stmt.run(name,secret?seal(cachedKey,value):value,secret?1:0,new Date().toISOString())}
  const del=db.prepare('DELETE FROM site_settings WHERE key=?');for(const name of clears)del.run(name);
  db.exec('COMMIT');
 }catch(e){if(db.isTransaction)db.exec('ROLLBACK');throw e}
 return list();
 }
 return {get,list,save};
}
module.exports={makeSettings,FIELDS};
