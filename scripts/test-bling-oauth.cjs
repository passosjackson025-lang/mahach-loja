'use strict';
const assert=require('node:assert/strict');
const {createBling,callback}=require('../bling-oauth');
const mp=require('../commerce-flows');
async function main(){
 const values={BLING_CLIENT_ID:'fake-client',BLING_CLIENT_SECRET:'fake-secret',BLING_REDIRECT_URI:'https://shop.invalid/api/integrations/bling/callback',PUBLIC_SITE_URL:'https://shop.invalid'};
 const settings={get:k=>values[k]||'',saveInternal:async changes=>Object.assign(values,changes)};
 const client=createBling(settings);const original=global.fetch;let requests=0;
 try{
  assert.equal(callback(settings.get),values.BLING_REDIRECT_URI);
  for(const invalid of ['https://evil.invalid/api/integrations/bling/callback','https://shop.invalid/wrong','https://shop.invalid/api/integrations/bling/callback?x=1'])assert.throws(()=>callback(k=>k==='BLING_REDIRECT_URI'?invalid:settings.get(k)));
  global.fetch=async(url,options)=>{
   requests++;
   if(url.endsWith('/oauth/token')){
    assert.equal(options.headers.Authorization,'Basic '+Buffer.from('fake-client:fake-secret').toString('base64'));
    assert.equal(options.headers['Content-Type'],'application/x-www-form-urlencoded');
    return {ok:true,status:200,json:async()=>({access_token:'mock-access',refresh_token:'mock-refresh',expires_in:3600})};
   }
   assert.equal(url,'https://api.bling.com.br/Api/v3/pedidos/vendas?pagina=1&limite=1');
   assert.equal(options.headers.Authorization,'Bearer mock-access');
   return {ok:true,status:200,json:async()=>({data:[]})};
  };
  let p=client.start('owner');
  const u=new URL(p.url);assert.equal(u.origin,'https://bling.com.br');assert.equal(u.searchParams.get('state'),p.state);
  await assert.rejects(()=>client.finish(p.state,'wrong-cookie','fake-code',async()=>true),/autorização válida/);assert.equal(requests,0);
  await assert.rejects(()=>client.finish(p.state,p.state,'fake-code',async()=>false),/expirada/);assert.equal(requests,0);
  p=client.start('owner');await client.finish(p.state,p.state,'fake-code',async owner=>owner==='owner');assert.equal(requests,1);assert.equal(values.BLING_ACCESS_TOKEN,'mock-access');
  await assert.rejects(()=>client.finish(p.state,p.state,'fake-code',async()=>true),/expirada/);
  await client.test();assert.equal(requests,2);
  values.BLING_TOKEN_EXPIRES='0';await Promise.all([client.test(),client.test()]);assert.equal(requests,5,'Uma renovação para consultas simultâneas');
  p=client.start('owner');values.BLING_CLIENT_SECRET='changed';
  await assert.rejects(()=>client.finish(p.state,p.state,'fake-code',async()=>true),/expirada/);assert.equal(requests,5);
  const pref={init_point:'https://www.mercadopago.com.br/live',sandbox_init_point:'https://sandbox.mercadopago.com.br/test'};
  assert.equal(mp.preferenceUrl(k=>k==='MERCADO_PAGO_ACCESS_TOKEN'?'TEST-fake':'',pref),pref.sandbox_init_point);
  assert.equal(mp.preferenceUrl(k=>k==='MERCADO_PAGO_ACCESS_TOKEN'?'TEST-fake':'',{init_point:pref.init_point}),null,'Teste nunca usa checkout live como fallback');
  assert.equal(mp.preferenceUrl(k=>k==='MERCADO_PAGO_ACCESS_TOKEN'?'production-fake':'',pref),pref.init_point);
  console.log('BLING OAUTH OK: state + cookie + session owner, single use, credential binding, token refresh; card sandbox URL. All providers mocked.');
 }finally{global.fetch=original}
}
main().catch(e=>{console.error(e);process.exitCode=1});
