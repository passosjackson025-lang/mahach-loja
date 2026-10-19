'use strict';
const crypto=require('node:crypto');
const MP='https://api.mercadopago.com';
const cents=x=>Math.round(Number(x)*100);
function httpsSite(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!['localhost','127.0.0.1'].includes(u.hostname)&&!u.search&&!u.hash?u.origin:null}catch{return null}}
function configured(conf){return !!(conf('MERCADO_PAGO_ACCESS_TOKEN')&&conf('MERCADO_PAGO_WEBHOOK_SECRET')&&httpsSite(conf('PUBLIC_SITE_URL')))}
function htmlesc(x){return String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function createPreference(conf,order,items,token){
 if(!configured(conf))throw Object.assign(new Error('Mercado Pago indisponível: configure Access Token, URL HTTPS e segredo do Webhook no painel.'),{status:503});
 const origin=httpsSite(conf('PUBLIC_SITE_URL'));
 const back=origin+'/finalizado.html?reference='+encodeURIComponent(order.id);
 const lineItems=items.map(i=>({id:i.id,title:i.name.slice(0,100),quantity:i.qty,unit_price:Number(i.unit_price),currency_id:'BRL'}));
 if(order.shipping_cost>0)lineItems.push({id:'frete',title:'Frete via transportadora',quantity:1,unit_price:Number(order.shipping_cost),currency_id:'BRL'});
 const body={items:lineItems,external_reference:order.id,payer:{name:order.customer_name,email:order.customer_email},back_urls:{success:back,pending:back,failure:back},auto_return:'approved',notification_url:origin+'/api/payments/mercadopago/webhook',statement_descriptor:'MAHACH',payment_methods:{excluded_payment_types:(order.payment==='pix'?['credit_card','debit_card','ticket','prepaid_card']:['bank_transfer','ticket','atm','prepaid_card','debit_card']).map(id=>({id}))}};
 const res=await fetch(MP+'/checkout/preferences',{method:'POST',headers:{Authorization:'Bearer '+conf('MERCADO_PAGO_ACCESS_TOKEN'),'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
 const response=await res.json().catch(()=>({}));if(!res.ok||!/^https:\/\//.test(response.init_point||''))throw Object.assign(new Error('Mercado Pago não conseguiu iniciar o checkout (HTTP '+res.status+').'),{status:502});
 return {preferenceId:String(response.id||''),checkoutUrl:response.init_point};
}
// Dados usados somente na chamada ao Mercado Pago; nao persistimos CPF na MAHACH.
function validCPF(value){
 const digits=String(value??'').replace(/\D/g,'');
 if(!/^\d{11}$/.test(digits)||/^(\d)\1{10}$/.test(digits))return false;
 for(let n=9;n<=10;n++){
  let sum=0;for(let i=0;i<n;i++)sum+=Number(digits[i])*(n+1-i);
  const check=(sum*10)%11%10;if(check!==Number(digits[n]))return false;
 }
 return true;
}
function pixDetails(pay){
 const raw=pay?.point_of_interaction?.transaction_data||{};
 const qrCode=typeof raw.qr_code==='string'&&raw.qr_code.length<=4096?raw.qr_code:'';
 const qrCodeBase64=typeof raw.qr_code_base64==='string'&&raw.qr_code_base64.length<=1500000&&/^[a-zA-Z0-9+/=]+$/.test(raw.qr_code_base64)?raw.qr_code_base64:'';
 return {paymentId:String(pay?.id||''),qrCode,qrCodeBase64,expiresAt:typeof pay?.date_of_expiration==='string'?pay.date_of_expiration:''};
}
async function createPixPayment(conf,order,cpf){
 if(!configured(conf))throw Object.assign(new Error('Mercado Pago nao configurado.'),{status:503});
 if(!validCPF(cpf))throw Object.assign(new Error('Confira o CPF para gerar o Pix.'),{status:400});
 const amount=cents(Number(order.subtotal)+Number(order.shipping_cost||0))/100;
 if(!(amount>=0.01&&amount<=1000000))throw Object.assign(new Error('Valor do pagamento invalido.'),{status:400});
 const body={transaction_amount:amount,description:'Pedido '+order.id+' - MAHACH',
  payment_method_id:'pix',external_reference:order.id,
  notification_url:httpsSite(conf('PUBLIC_SITE_URL'))+'/api/payments/mercadopago/webhook',
  payer:{email:order.customer_email,first_name:String(order.customer_name||'').split(/\s+/)[0],identification:{type:'CPF',number:String(cpf).replace(/\D/g,'')}}};
 // Mesma chave em cada tentativa do MESMO pedido: um pedido nunca gera 2 Pix.
 const key=crypto.createHash('sha256').update('MAHACH-PIX:'+order.id).digest('hex');
 const res=await fetch(MP+'/v1/payments',{method:'POST',headers:{
  Authorization:'Bearer '+conf('MERCADO_PAGO_ACCESS_TOKEN'),
  'Content-Type':'application/json','Accept':'application/json','X-Idempotency-Key':key
 },body:JSON.stringify(body),signal:AbortSignal.timeout(18000)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok||!/^\d+$/.test(String(data.id||'')))throw Object.assign(new Error('Mercado Pago nao conseguiu emitir o Pix (HTTP '+res.status+'). O pedido ficou pendente.'),{status:502});
 return pixDetails(data);
}
function verifyMPWebhook(conf,req,url){
 const secret=conf('MERCADO_PAGO_WEBHOOK_SECRET'),dataId=url.searchParams.get('data.id')||url.searchParams.get('id')||'',signature=String(req.headers['x-signature']||''),requestId=String(req.headers['x-request-id']||'');
 const ts=/\bts=([0-9]+)\b/.exec(signature)?.[1],v1=/\bv1=([0-9a-f]{64})\b/i.exec(signature)?.[1];
 const tsMillis=Number(ts)<1e11?Number(ts)*1000:Number(ts); // Mercado Pago envia ts em segundos ou milissegundos conforme o evento.
 if(!secret||!/^\d{1,24}$/.test(dataId)||!requestId||requestId.length>250||!ts||!v1||!Number.isFinite(tsMillis)||Math.abs(Date.now()-tsMillis)>10*60*1000)return null;
 // Mercado Pago's officially documented HMAC manifest.
 const manifest=`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
 const expected=crypto.createHmac('sha256',secret).update(manifest).digest('hex');
 if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(v1.toLowerCase())))return null;
 return dataId;
}
async function getVerifiedPayment(conf,id){
 const r=await fetch(MP+'/v1/payments/'+id,{headers:{Authorization:'Bearer '+conf('MERCADO_PAGO_ACCESS_TOKEN'),'Accept':'application/json'},signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Object.assign(new Error('Falha ao consultar pagamento no Mercado Pago'),{status:502});return r.json();
}
async function sendEmail(conf,to,subject,html){
 const api=conf('RESEND_API_KEY'),from=conf('MAIL_FROM');if(!api||!from)return {ok:false,reason:'Serviço de e-mail não configurado'};
 const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+api,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,html}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)return {ok:false,reason:'Serviço de e-mail respondeu HTTP '+r.status};return {ok:true};
}
module.exports={cents,httpsSite,configured,htmlesc,validCPF,pixDetails,createPixPayment,createPreference,verifyMPWebhook,getVerifiedPayment,sendEmail};
