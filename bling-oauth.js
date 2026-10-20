'use strict';
const crypto=require('node:crypto');
const API='https://api.bling.com.br/Api/v3';
function failure(message,status=400){return Object.assign(Error(message),{status})}
function callback(conf){
 let u;try{u=new URL(conf('BLING_REDIRECT_URI'))}catch{}
 const origin=require('./commerce-flows').httpsSite(conf('PUBLIC_SITE_URL'));
 if(!origin||!u||u.origin!==origin||u.pathname!=='/api/integrations/bling/callback'||u.search||u.hash||u.username||u.password)throw failure('Configure o retorno Bling como a URL principal HTTPS + /api/integrations/bling/callback.');
 return u.href;
}
function createBling(settings){
 const conf=k=>settings.get(k),pending=new Map();let refreshing;
 function fingerprint(){return crypto.createHash('sha256').update(JSON.stringify([conf('BLING_CLIENT_ID'),conf('BLING_CLIENT_SECRET'),conf('BLING_REDIRECT_URI')])).digest('hex')}
 function start(owner){
  const redirect=callback(conf);if(!conf('BLING_CLIENT_ID')||!conf('BLING_CLIENT_SECRET'))throw failure('Configure Client ID e Client Secret do aplicativo Bling.');
  for(const [k,v]of pending)if(v.expires<Date.now()||v.owner===owner)pending.delete(k);
  if(pending.size>=100)throw failure('Muitas autorizações em andamento.',429);
  const state=crypto.randomBytes(32).toString('base64url');
  pending.set(state,{owner,expires:Date.now()+600000,fingerprint:fingerprint()});
  const u=new URL('https://bling.com.br/Api/v3/oauth/authorize');u.search=new URLSearchParams({response_type:'code',client_id:conf('BLING_CLIENT_ID'),state,redirect_uri:redirect}).toString();
  return {state,url:u.href};
 }
 async function tokens(params){
  const r=await fetch(API+'/oauth/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(conf('BLING_CLIENT_ID')+':'+conf('BLING_CLIENT_SECRET')).toString('base64'),'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'},body:new URLSearchParams(params).toString(),signal:AbortSignal.timeout(12000)});
  const d=await r.json().catch(()=>({}));
  if(!r.ok||typeof d.access_token!=='string'||typeof d.refresh_token!=='string'||!d.access_token||!d.refresh_token||!Number.isFinite(Number(d.expires_in))||Number(d.expires_in)<60)throw failure('Bling não concluiu a autorização (HTTP '+r.status+'). Autorize novamente; nenhum segredo foi exibido.',502);
  await settings.saveInternal({BLING_ACCESS_TOKEN:d.access_token,BLING_REFRESH_TOKEN:d.refresh_token,BLING_TOKEN_EXPIRES:String(Date.now()+Number(d.expires_in)*1000)});
 }
 async function finish(state,browserState,code,validOwner){
  if(typeof state!=='string'||!/^[\w-]{43}$/.test(state)||state!==browserState)throw failure('Retorno Bling sem autorização válida.',401);
  const entry=pending.get(state);pending.delete(state);
  if(!entry||entry.expires<Date.now()||entry.fingerprint!==fingerprint()||!await validOwner(entry.owner))throw failure('Autorização expirada. Inicie novamente pelo painel.',401);
  if(typeof code!=='string'||!code||code.length>4096)throw failure('Bling não retornou código de autorização.');
  await tokens({grant_type:'authorization_code',code,redirect_uri:callback(conf)});
 }
 async function access(){
  if(conf('BLING_ACCESS_TOKEN')&&Number(conf('BLING_TOKEN_EXPIRES'))>Date.now()+60000)return conf('BLING_ACCESS_TOKEN');
  if(!conf('BLING_REFRESH_TOKEN'))throw failure('Autorize sua conta Bling pelo painel.',409);
  refreshing??=tokens({grant_type:'refresh_token',refresh_token:conf('BLING_REFRESH_TOKEN')}).finally(()=>{refreshing=null});
  await refreshing;return conf('BLING_ACCESS_TOKEN');
 }
 async function test(){
  const token=await access();
  const r=await fetch(API+'/pedidos/vendas?pagina=1&limite=1',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw failure('Bling respondeu HTTP '+r.status+'. Confira autorização e escopo de leitura de pedidos.',502);
  await r.json();return {ok:true,message:'Bling autenticado; consulta de pedidos confirmada. Emissão fiscal e exportação ainda exigem configuração e homologação.'};
 }
 return {start,finish,test};
}
module.exports={createBling,callback};
