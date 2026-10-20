'use strict';
// Read-only checks. No login, checkout POST, charge, or load test against production.
const assert=require('node:assert/strict');
async function main(){
 const base='https://mahach-loja.onrender.com',checks=[];
 for(const path of ['/api/health','/api/store/status','/','/produtos/','/acompanhar.html','/finalizado.html','/api/admin/products','/private/settings.key','/server.js','/.env','/planilha-original.csv']){
  const r=await fetch(base+path,{signal:AbortSignal.timeout(90000),redirect:'follow'});
  const expected=path==='/api/admin/products'?401:['/private/settings.key','/server.js','/.env','/planilha-original.csv'].includes(path)?404:200;
  assert.equal(r.status,expected,path);
  assert.equal(r.headers.get('x-content-type-options'),'nosniff',path);
  assert.ok(r.headers.get('content-security-policy'),path);
  if(path==='/api/store/status'){
   const status=await r.json();checks.push({path,status:r.status,checkoutEnabled:status.checkoutEnabled,testMode:status.testMode});
   assert.equal(status.checkoutEnabled,false,'Checkout público deve continuar fechado até homologação');
  }else{await r.arrayBuffer();checks.push({path,status:r.status})}
 }
 console.log('PUBLIC READ-ONLY CHECK: '+JSON.stringify(checks));
}
main().catch(e=>{console.error(e);process.exitCode=1});
