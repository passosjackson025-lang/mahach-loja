'use strict';
// Executa apenas contra PostgreSQL descartável, local ao job. Nunca usa Neon/produção.
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),Module=require('node:module');
const pg=require('pg');
const database=process.env.MAHACH_CI_DATABASE_URL;
if(!database||new URL(database).hostname!=='127.0.0.1'||new URL(database).pathname!=='/mahach_ci')throw Error('Somente banco descartável 127.0.0.1/mahach_ci autorizado');
const raw=new pg.Pool({connectionString:database,ssl:false});
const originalLoad=Module._load,realFetch=global.fetch;
let paymentStatus='pending',badAmount=false,paymentCalls=0,preferences=0,lastShipping=null,emailBodies=[];
const payments=new Map();
const config={DATABASE_URL:database,MAHACH_SETTINGS_KEY:'00'.repeat(32),MAHACH_ENABLE_CHECKOUT:'true',MAHACH_ENABLE_ADMIN_WRITES:'true',MERCADO_PAGO_ACCESS_TOKEN:'fake-token',MERCADO_PAGO_WEBHOOK_SECRET:'fake-webhook',MERCADO_PAGO_PIX_ACCESS_TOKEN:'fake-pix-token',MERCADO_PAGO_PIX_WEBHOOK_SECRET:'fake-pix-webhook',PUBLIC_SITE_URL:'https://shop.invalid',MELHOR_ENVIO_TOKEN:'fake-shipping',ORIGIN_CEP:'08000000',MELHOR_ENVIO_SANDBOX:'true',RESEND_API_KEY:'fake-mail',MAIL_FROM:'MAHACH <mail@shop.invalid>',ADMIN_EMAIL:'admin@shop.invalid'};
Object.assign(process.env,config);
function response(data,status=200){return {ok:status>=200&&status<300,status,json:async()=>data}}
global.fetch=async(url,options={})=>{
 const u=String(url);
 if(u.startsWith('http://127.0.0.1:'))return realFetch(url,options);
 if(u==='https://api.mercadopago.com/v1/payments'){
  paymentCalls++;const body=JSON.parse(options.body),key=options.headers['X-Idempotency-Key'];
  let p=payments.get(key);if(!p){p={id:String(1000+payments.size),external_reference:body.external_reference,payment_method_id:'pix',currency_id:'BRL',transaction_amount:body.transaction_amount,point_of_interaction:{transaction_data:{qr_code:'NOT-PAYABLE',qr_code_base64:'aGVsbG8='}}};payments.set(key,p)}
  return response(p,201);
 }
 if(u.startsWith('https://api.mercadopago.com/v1/payments/')){
  const p=[...payments.values()].find(x=>x.id===u.split('/').pop());
  if(!p)return response({},404);
  return response({...p,status:paymentStatus,transaction_amount:badAmount?999:p.transaction_amount});
 }
 if(u==='https://api.mercadopago.com/checkout/preferences'){
  preferences++;return response({id:'pref-'+preferences,init_point:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-'+preferences},201);
 }
 if(u.startsWith('https://api.mercadopago.com/checkout/preferences/'))return response({id:u.split('/').pop(),init_point:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id='+u.split('/').pop()});
 if(u.includes('melhorenvio.com.br/api/v2/me/shipment/calculate')){
  lastShipping=JSON.parse(options.body);return response([{name:'Entrega teste',company:{name:'Jadlog'},price:'12.34',delivery_time:3}]);
 }
 if(u==='https://api.resend.com/emails'){emailBodies.push(JSON.parse(options.body));return response({id:'mail-'+emailBodies.length},201)}
 throw Error('Integração externa bloqueada neste teste: '+u);
};
let app,base,headers;
const payload=(extra={})=>({name:'Cliente Teste',phone:'11999999999',email:'test@shop.invalid',delivery:'pickup',payment:'pix',pixCpf:'52998224725',items:[{id:'confirmed-product',qty:1}],...extra});
const post=(path,data,extra={})=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...extra},body:JSON.stringify(data)});
async function webhook(id,valid=true,pix=false){
 const ts=String(Math.floor(Date.now()/1000)),requestId='test-request';
 const signature=crypto.createHmac('sha256',pix?'fake-pix-webhook':'fake-webhook').update('id:'+id+';request-id:'+requestId+';ts:'+ts+';').digest('hex');
 return fetch(base+'/api/payments/mercadopago/'+(pix?'pix-webhook':'webhook')+'?data.id='+id,{method:'POST',headers:{'Content-Type':'application/json','x-request-id':requestId,'x-signature':'ts='+ts+',v1='+(valid?signature:'0'.repeat(64))},body:'{}'});
}
async function stock(id='confirmed-product'){return (await raw.query('SELECT stock FROM mahach_stage.products WHERE id=$1',[id])).rows[0].stock}
async function main(){
 await raw.query('CREATE SCHEMA mahach_stage');
 await raw.query('CREATE TABLE mahach_stage.categories(id text PRIMARY KEY,name text,subtitle text)');
 await raw.query("INSERT INTO mahach_stage.categories VALUES('perfumes','Perfumaria','')");
 await raw.query('CREATE TABLE mahach_stage.products(id text PRIMARY KEY,name text,price double precision,description text,category text,brand text,family text,image text,sku text,stock bigint,weight double precision,width double precision,height double precision,length double precision,active bigint,search_text text)');
 await raw.query("INSERT INTO mahach_stage.products VALUES('confirmed-product','Perfume Teste',95,'Descrição','perfumes','Marca','','','SKU-REAL',3,.4,12,18,10,1,'perfume teste'),('legacy-product','Produto antigo',95,'','perfumes','Marca','','','',1000,1,20,20,20,1,'antigo'),('inactive-product','Produto guardado',95,'','perfumes','Marca','','','SKU-INACTIVE',0,NULL,NULL,NULL,NULL,0,'guardado')");
 await raw.query('CREATE TABLE mahach_stage.admins(email text PRIMARY KEY,salt text,hash text)');
 const salt='a'.repeat(32),hash=crypto.scryptSync('password-test-only',salt,64).toString('hex');
 await raw.query('INSERT INTO mahach_stage.admins VALUES($1,$2,$3)',['admin@shop.invalid',salt,hash]);
 await raw.query('CREATE TABLE mahach_stage.site_settings(key text PRIMARY KEY,value text,encrypted bigint,updated_at text)');
 const columns={id:'text PRIMARY KEY',public_token_hash:'text',created:'text',status:'text',customer_name:'text',phone:'text',cep:'text',address:'text',delivery:'text',payment:'text',items_json:'text',subtotal:'double precision',shipping_cost:'double precision',shipping_note:'text',tracking_code:'text',tracking_url:'text',shipping_service:'text',payment_status:'text',bling_export_status:'text',customer_email:'text',mp_preference_id:'text',mp_payment_id:'text',customer_email_sent:'bigint',admin_email_sent:'bigint',tracking_email_sent:'bigint'};
 await raw.query('CREATE TABLE mahach_stage.orders('+Object.entries(columns).map(([k,v])=>k+' '+v).join(',')+')');
 await raw.query(fs.readFileSync(require('node:path').join(__dirname,'../migrations/20261020-sale-validation.sql'),'utf8'));
 await raw.query("UPDATE mahach_stage.products SET stock_confirmed=true,shipping_confirmed=true WHERE id='confirmed-product'");
 Module._load=function(id,parent,isMain){if(id==='pg')return {...pg,Pool:class extends pg.Pool{constructor(options){super({...options,ssl:false})}}};return originalLoad.call(this,id,parent,isMain)};
 app=require('../server');await app.ready;
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+app.server.address().port;
 let r=await fetch(base+'/api/admin/products');assert.equal(r.status,401);
 r=await post('/api/admin/login',{email:'admin@shop.invalid',password:'password-test-only'});assert.equal(r.status,200);
 const auth=await r.json();headers={Cookie:r.headers.get('set-cookie').split(';')[0],'x-csrf-token':auth.csrf};
 r=await fetch(base+'/api/admin/products?q=SKU-INACTIVE',{headers});assert.equal(r.status,200);assert.equal((await r.json()).products[0].id,'inactive-product');
 r=await fetch(base+'/api/admin/products/inactive-product',{method:'PUT',headers:{...headers,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({name:'Produto guardado',price:95,category:'perfumes',stock:1,active:false,stock_confirmed:true})});assert.equal(r.status,200);
 const inactive=(await raw.query("SELECT sku,active FROM mahach_stage.products WHERE id='inactive-product'")).rows[0];assert.ok(inactive.sku);assert.equal(Number(inactive.active),0);
 r=await post('/api/orders',payload({items:[{id:'legacy-product',qty:1}]}));assert.equal(r.status,400,'Estoque legado 1000 não pode vender sem confirmação');
 const key=crypto.randomUUID();
 const created=await Promise.all([post('/api/orders',payload({checkoutKey:key})),post('/api/orders',payload({checkoutKey:key}))]);
 const orders=await Promise.all(created.map(x=>x.json()));assert.ok(created.every(x=>x.ok),JSON.stringify(orders));
 assert.equal(orders[0].reference,orders[1].reference,'Repetição deve recuperar o mesmo pedido');
 assert.equal(Number((await raw.query('SELECT count(*) FROM mahach_stage.orders')).rows[0].count),1);
 assert.equal(Number(await stock()),2,'Uma reserva para uma compra');
 const orderId=orders[0].reference,payment=[...payments.values()][0];
 assert.equal(payments.size,1,'Idempotência Pix é por pedido');
 r=await webhook(payment.id,false);assert.equal(r.status,401);
 r=await webhook(payment.id,true,true);assert.equal(r.status,200,'Assinatura Pix separada validada');
 badAmount=true;paymentStatus='approved';r=await webhook(payment.id);assert.equal(r.status,200);
 assert.equal((await raw.query('SELECT payment_status FROM mahach_stage.orders WHERE id=$1',[orderId])).rows[0].payment_status,'pendente','Valor divergente não confirma');
 badAmount=false;
 const callbacks=await Promise.all([webhook(payment.id),webhook(payment.id)]);assert.ok(callbacks.every(x=>x.status===200));
 assert.equal(Number(await stock()),2,'Webhook não debita novamente a reserva');
 r=await post('/api/payments/status',{reference:orderId,token:orders[0].token});assert.equal((await r.json()).paymentStatus,'aprovado');
 paymentStatus='pending';r=await webhook(payment.id);assert.equal(r.status,200);
 assert.equal((await raw.query('SELECT payment_status FROM mahach_stage.orders WHERE id=$1',[orderId])).rows[0].payment_status,'aprovado','Evento atrasado não desfaz aprovação');
 process.env.MAHACH_ENABLE_CHECKOUT='false';process.env.MAHACH_ENABLE_CHECKOUT_TEST_MODE='false';
 paymentStatus='approved';r=await webhook(payment.id);assert.equal(r.status,200,'Checkout suspenso continua recebendo webhook autenticado');
 process.env.MAHACH_ENABLE_CHECKOUT='true';
 r=await post('/api/orders',payload({payment:'card',checkoutKey:crypto.randomUUID()}));assert.equal(r.status,201);const card=await r.json();assert.equal(card.mode,'online');assert.equal(preferences,1);
 r=await post('/api/shipping/quote',{cep:'01001000',items:[{id:'confirmed-product',qty:1}]});assert.equal(r.status,200);const quote=(await r.json()).options[0];assert.equal(lastShipping.products[0].weight,.4);
 await raw.query("UPDATE mahach_stage.products SET price=100 WHERE id='confirmed-product'");
 r=await post('/api/orders',payload({delivery:'transportadora',cep:'01001000',address:'Rua de Teste, 123, São Paulo SP',quoteId:quote.quoteId}));assert.equal(r.status,400,'Preço alterado invalida cotação');
 await raw.query("UPDATE mahach_stage.products SET price=95 WHERE id='confirmed-product'");
 r=await post('/api/orders',payload({checkoutKey:crypto.randomUUID()}));assert.equal(r.status,201);const last=await r.json();
 assert.equal(Number(await stock()),0);
 r=await post('/api/orders',payload({checkoutKey:crypto.randomUUID()}));assert.equal(r.status,400,'Sem estoque não cria cobrança');
 const lastPayment=[...payments.values()].find(x=>x.external_reference===last.reference);
 paymentStatus='cancelled';r=await webhook(lastPayment.id);assert.equal(r.status,200);assert.equal(Number(await stock()),1,'Cancelamento confirmado libera reserva');
 r=await webhook(lastPayment.id);assert.equal(r.status,200);assert.equal(Number(await stock()),1,'Cancelamento repetido não duplica estoque');
 assert.ok(emailBodies.length>=2,'Confirmação aceita pelo provedor simulado');
 await raw.query("INSERT INTO mahach_stage.orders(id,delivery,payment,payment_status,status,items_json,stock_reserved) VALUES('MH-CASHCANCEL','pickup','cash','pendente','pedido_criado',$1,true)",[JSON.stringify([{id:'confirmed-product',qty:1}])]);
 const beforeCancel=Number(await stock());
 await raw.query("UPDATE mahach_stage.products SET stock=stock-1 WHERE id='confirmed-product'");
 for(let i=0;i<2;i++){
  r=await fetch(base+'/api/admin/orders/MH-CASHCANCEL',{method:'PUT',headers:{...headers,Origin:base,'Content-Type':'application/json'},body:JSON.stringify({status:'cancelado',tracking_code:'',tracking_url:''})});assert.equal(r.status,200);
 }
 assert.equal(Number(await stock()),beforeCancel,'Cancelar retirada em dinheiro libera reserva uma vez');
 if(process.env.MAHACH_BROWSER_TEST==='true'){
  paymentStatus='pending';
  await raw.query("UPDATE mahach_stage.products SET stock=3 WHERE id='confirmed-product'");
  await require('./test-browser-checkout.cjs')(base);
 }
 for(const path of ['/private/settings.key','/server.js','/.env','/planilha-original.csv','/assets/../server.js'])assert.equal((await fetch(base+path)).status,404);
 for(const path of ['/','/produtos/','/acompanhar.html','/finalizado.html']){r=await fetch(base+path);assert.equal(r.status,200);assert.ok(r.headers.get('content-security-policy'));assert.equal(r.headers.get('x-content-type-options'),'nosniff')}
 r=await fetch(base+'/api/products?page=1.8&limit=2.7');assert.equal(r.status,200);assert.equal((await r.json()).page,1);
 
 const loadSamples=[];
 for(const concurrency of [1,5,10]){
  const durations=[];let errors=0,issued=0;const started=performance.now();
  await Promise.all(Array.from({length:concurrency},async()=>{
   while(issued<30){issued++;const before=performance.now();const r=await fetch(base+'/api/health');if(!r.ok)errors++;await r.arrayBuffer();durations.push(performance.now()-before)}
  }));
  durations.sort((a,b)=>a-b);
  loadSamples.push({concurrency,requests:durations.length,errors,p95ms:Math.round(durations[Math.ceil(durations.length*.95)-1]),durationMs:Math.round(performance.now()-started)});
 }
 console.log('LOCAL DISPOSABLE HEALTH LOAD (not production capacity): '+JSON.stringify(loadSamples));
 assert.ok(loadSamples.every(x=>x.errors===0));

 console.log('POSTGRES OK: migration, real transactions, duplicate checkout, stock reservation, signed webhook concurrency, stale shipping quotes, private files. Providers are simulated; no production access.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{global.fetch=realFetch;Module._load=originalLoad;if(app){await new Promise(r=>app.server.close(r));await app.db.close()}await raw.end()});
