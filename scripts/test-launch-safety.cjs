'use strict';
const assert=require('node:assert/strict');
const mp=require('../commerce-flows');
const values={MERCADO_PAGO_ACCESS_TOKEN:' Bearer fake-token ',MERCADO_PAGO_WEBHOOK_SECRET:'fake-secret',PUBLIC_SITE_URL:'https://shop.invalid',RESEND_API_KEY:'fake-email',MAIL_FROM:'MAHACH <mail@shop.invalid>'};
const conf=k=>values[k]||'';
async function main(){
 const original=global.fetch;let requests=0;
 try{
  assert.equal(mp.accessToken(conf),'fake-token');
  assert.ok(mp.paymentUrl('https://www.mercadopago.com.br/checkout/v1/redirect?x=1'));
  for(const u of ['https://evil.invalid','https://mercadopago.com.br.evil.invalid','https://user:pass@mercadopago.com.br','javascript:alert(1)'])assert.equal(mp.paymentUrl(u),null);
  global.fetch=async()=>({ok:true,status:200,json:async()=>({})});
  assert.equal((await mp.sendEmail(conf,'test@shop.invalid','test','<p>test</p>')).ok,false);
  global.fetch=async()=>({ok:true,status:200,json:async()=>({id:'fake-provider-message'})});
  assert.equal((await mp.sendEmail(conf,'test@shop.invalid','test','<p>test</p>')).providerId,'fake-provider-message');
  global.fetch=async()=>({ok:false,status:429,json:async()=>({})});
  assert.equal((await mp.sendEmail(conf,'test@shop.invalid','test','<p>test</p>')).ok,false);
  global.fetch=async(url,options)=>{requests++;assert.equal(options.headers.Authorization,'Bearer fake-token');return {ok:false,status:401,json:async()=>({cause:[{code:7,description:'sensitive provider response'}]})}};
  await assert.rejects(()=>mp.createPixPayment(conf,{id:'MH-EXAMPLE',subtotal:10,shipping_cost:0,customer_email:'test@shop.invalid',customer_name:'Test'},'52998224725'),err=>err.diagnostic==='MP_HTTP_401_7'&&!err.message.includes('sensitive'));
  assert.equal(requests,1);
  global.fetch=async()=>({ok:true,status:201,json:async()=>({id:'pref',init_point:'https://evil.invalid/pay'})});
  await assert.rejects(()=>mp.createPreference(conf,{id:'MH-EXAMPLE',shipping_cost:0,customer_email:'test@shop.invalid',customer_name:'Test',payment:'card'},[{id:'x',name:'Test',qty:1,unit_price:10}]),/checkout/);
  console.log('UNIT OK: token, URL allowlist, sanitized 401, email provider acknowledgement. No real integrations.');
 }finally{global.fetch=original}
}
main().catch(e=>{console.error(e);process.exitCode=1});
