'use strict';
// Mock local: NAO cria cobrancas reais e nao consulta contas de producao.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const mp=require('../commerce-flows');
const conf=k=>({MERCADO_PAGO_ACCESS_TOKEN:'TOKEN-FICTICIO-NAO-REAL',MERCADO_PAGO_WEBHOOK_SECRET:'segredo-ficticio',PUBLIC_SITE_URL:'https://loja.exemplo.invalid'})[k]||'';
let requests=[];
const prior=global.fetch;
global.fetch=async(url,opts)=>{
 requests.push({url:String(url),headers:opts.headers,body:JSON.parse(opts.body)});
 return {ok:true,status:201,json:async()=>({id:123456789,point_of_interaction:{transaction_data:{qr_code:'PIX-FAKE-NAO-PAGAVEL',qr_code_base64:'iVBORw0KGgo='}}})};
};
(async()=>{
 try{
  assert.equal(mp.validCPF('529.982.247-25'),true);
  assert.equal(mp.validCPF('000.000.000-00'),false);
  assert.equal(mp.validCPF('12345678901'),false);
  const o={id:'MH-TESTE-123',customer_name:'Cliente Exemplo',customer_email:'comprador@example.invalid',subtotal:98.5,shipping_cost:12.21,payment:'pix'};
  const a=await mp.createPixPayment(conf,o,'52998224725');
  const b=await mp.createPixPayment(conf,o,'529.982.247-25');
  assert.equal(a.qrCode,'PIX-FAKE-NAO-PAGAVEL');
  assert.equal(a.paymentId,'123456789');
  assert.equal(requests.length,2);
  assert.equal(requests[0].url,'https://api.mercadopago.com/v1/payments');
  assert.equal(requests[0].headers['X-Idempotency-Key'],requests[1].headers['X-Idempotency-Key'],'retry deve ser idempotente');
  assert.equal(requests[0].body.transaction_amount,110.71);
  assert.equal(requests[0].body.payment_method_id,'pix');
  assert.equal(requests[0].body.payer.identification.type,'CPF');
  assert.equal(requests[0].body.external_reference,o.id);
  assert.ok(!JSON.stringify(a).includes('52998224725'),'CPF nao volta ao navegador');
  await assert.rejects(()=>mp.createPixPayment(conf,o,'00000000000'),/CPF/);
  assert.equal(requests.length,2,'CPF invalido nao chama o Mercado Pago');
  const id='123456789',requestId='req-teste',ts=String(Math.floor(Date.now()/1000));
  const signature=crypto.createHmac('sha256','segredo-ficticio').update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');
  const fakeReq={headers:{'x-signature':`ts=${ts},v1=${signature}`,'x-request-id':requestId}};
  assert.equal(mp.verifyMPWebhook(conf,fakeReq,new URL('https://x.invalid/?data.id='+id)),id);
  fakeReq.headers['x-signature']='ts='+ts+',v1='+'0'.repeat(64);
  assert.equal(mp.verifyMPWebhook(conf,fakeReq,new URL('https://x.invalid/?data.id='+id)),null);
  console.log('PIX OK (SIMULADO): QR Code, CPF, preco, idempotencia e webhook HMAC. Nenhuma cobranca real.');
 }finally{global.fetch=prior}
})().catch(e=>{console.error(e);process.exitCode=1});
