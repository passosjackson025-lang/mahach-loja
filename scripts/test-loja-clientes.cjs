'use strict';
// Testes offline: Neon e pagamentos simulados. Nunca emite cobranças reais.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const original=Module._load;
let customer=null,order=null,stock=3,approved=0;
const adminPassword='senha-do-teste-123',salt='a'.repeat(32),adminHash=crypto.scryptSync(adminPassword,salt,64).toString('hex');
const sessions=[];
const product={id:'perfume-123',name:'Perfume de Teste',category:'perfumes',price:95,weight:.4,width:15,height:18,length:12,stock:3,active:1,stock_confirmed:true,shipping_confirmed:true};
class Pool{
 async query(sql,args=[]){
  const query=sql.toLowerCase(),has=s=>query.includes(s);
  const response=(rows=[],count=rows.length)=>({rows,rowCount:count});
  if(has('information_schema.tables'))return response(['admins','categories','products','orders','site_settings'].map(table_name=>({table_name})));
  if(has('create table')||has('create index')||has('alter table')||['begin','commit','rollback'].includes(query))return response();
  if(has('select key,value,encrypted,updated_at from'))return response([]);
  if(has('count(*)')&&has('products'))return response([{n:1}]);
  if(has('count(*)')&&has('customers'))return response([{n:customer?1:0}]);
  if(has('select id from mahach_stage."categories"'))return response([{id:'perfumes'}]);
  if(has('select * from mahach_stage."products"'))return response([{...product,stock}]);
  if(has('select stock')&&has('products'))return response([{...product,stock,stock_confirmed:true,active:1}]);
  if(has('update mahach_stage."products" set stock=stock-')){stock-=args[0];return response([],1)}
  if(has('insert into mahach_stage."orders"')){
   order={id:args[0],public_token_hash:args[1],created:args[2],status:args[3],customer_name:args[4],phone:args[5],customer_email:args[6],cep:args[7],address:args[8],delivery:args[9],payment:args[10],items_json:args[11],subtotal:args[12],shipping_cost:args[13],marketing_opt_in:args[17],payment_status:'pendente'};return response([],1)
  }
  if(has('insert into mahach_stage."customers"')){
   const [email,name,phone,optedIn,,last_order_id]=args;
   customer={email,name,phone,marketing_opt_in:!!optedIn,marketing_consent_at:optedIn?new Date().toISOString():null,last_order_id};return response([],1)
  }
  if(has('from mahach_stage."orders"')&&has('where id='))return response(order&&order.id===args[0]?[{...order}]:[]);
  if(has('update mahach_stage."orders" set stock_reserved=')){if(order)order.stock_reserved=args[0];return response([],1)}
  if(has('update mahach_stage."orders" set mp_payment_id=')){if(order?.id===args[1])order.mp_payment_id=args[0];return response([],1)}
  if(has('update mahach_stage."orders" set mp_preference_id=')){if(order?.id===args[1])order.mp_preference_id=args[0];return response([],1)}
  if(has('update mahach_stage."orders" set payment_status=')){Object.assign(order,{payment_status:args[0],status:args[1],mp_payment_id:args[2],stock_reserved:false});approved++;return response([],1)}
  if(has('from mahach_stage."admins"'))return response(args[0]==='admin@exemplo.test'?[{email:'admin@exemplo.test',salt,hash:adminHash}]:[]);
  if(has('delete from mahach_stage."sessions"'))return response();
  if(has('insert into mahach_stage."sessions"')){sessions.push({token_hash:args[0],email:args[1],csrf:args[2],expires:args[3]});return response([],1)}
  if(has('from mahach_stage."sessions"'))return response(sessions.filter(s=>s.token_hash===args[0]&&s.expires>args[1]));
  if(has('select email,name,phone,marketing_opt_in')&&has('customers'))return response(customer?[customer]:[]);
  if(has('update mahach_stage."customers" set marketing_opt_in=false')){if(customer?.email===args[0]){customer.marketing_opt_in=false;customer.marketing_consent_at=null;return response([],1)}return response()}
  return response();
 }
 async connect(){return {query:this.query.bind(this),release(){}}}
 async end(){}
}
Module._load=function(id,parent,isMain){if(id==='pg')return {Pool,types:{setTypeParser(){}}};return original.call(this,id,parent,isMain)};
Object.assign(process.env,{DATABASE_URL:'postgresql://test:abc@localhost/mock',MAHACH_SETTINGS_KEY:'00'.repeat(32),MAHACH_ENABLE_CHECKOUT:'true',MAHACH_ENABLE_ADMIN_WRITES:'true',MERCADO_PAGO_ACCESS_TOKEN:'credencial-ficticia-de-teste',MERCADO_PAGO_WEBHOOK_SECRET:'secret-de-teste',PUBLIC_SITE_URL:'https://ma-hach.invalid'});
const commerce=require('../commerce-flows');
commerce.createPreference=async(conf,o,items)=>({preferenceId:'TEST-PREF',checkoutUrl:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=TEST-PREF'});
commerce.createPixPayment=async(conf,o,cpf)=>{assert.ok(commerce.validCPF(cpf));return {paymentId:'123456789',qrCode:'PIX-TESTE-NAO-PAGAVEL',qrCodeBase64:'iVBORw0KGgo=',expiresAt:''}};
commerce.getVerifiedPayment=async()=>({external_reference:order?.id,currency_id:'BRL',transaction_amount:95,status:'approved',id:123456789,payment_method_id:'pix'});
const {server,ready,db}=require('../server');
async function main(){await ready;await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  let r=await fetch(base+'/api/admin/customers');assert.equal(r.status,401,'Clientes devem ser privados');
  r=await fetch(base+'/api/orders',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({name:'Pessoa Teste',phone:'11999999999',email:'cliente@exemplo.test',delivery:'pickup',payment:'pix',pixCpf:'52998224725',marketingOptIn:true,items:[{id:'perfume-123',qty:1}]})});
  assert.equal(r.status,201);const out=await r.json();assert.equal(out.mode,'pix');assert.equal(out.pix.qrCode,'PIX-TESTE-NAO-PAGAVEL');assert.equal(order.mp_payment_id,'123456789');
  assert.ok(customer.marketing_opt_in);assert.equal(customer.name,'Pessoa Teste');assert.equal(order.marketing_opt_in,true);
  assert.equal(order.customer_email,'cliente@exemplo.test');assert.equal(stock,2,'Reserva feita antes de chamar o provedor');
  const dataId='123456789',requestId='fake-request-id',ts=Math.floor(Date.now()/1000).toString();
  const manifest=`id:${dataId};request-id:${requestId};ts:${ts};`;
  const sig=crypto.createHmac('sha256','secret-de-teste').update(manifest).digest('hex');
  const webhook=()=>fetch(base+'/api/payments/mercadopago/webhook?data.id='+dataId,{method:'POST',headers:{'Content-Type':'application/json','x-signature':`ts=${ts},v1=${sig}`,'x-request-id':requestId},body:'{}'});
  r=await webhook();assert.equal(r.status,200);assert.equal(stock,2,'Estoque baixado uma única vez');assert.equal(order.payment_status,'aprovado');
  r=await webhook();assert.equal(r.status,200);assert.equal(stock,2,'Webhook repetido não deve debitar o estoque');assert.equal(approved,1);
  r=await fetch(base+'/api/payments/status',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({reference:out.reference,token:out.token})});
  assert.equal((await r.json()).paymentStatus,'aprovado');
  r=await fetch(base+'/api/orders',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({name:'Pessoa Teste',phone:'11999999999',email:'cliente@exemplo.test',delivery:'pickup',payment:'card',items:[{id:'perfume-123',qty:1}]})});
  assert.equal(r.status,201);const card=await r.json();assert.equal(card.mode,'online');assert.ok(card.checkoutUrl.startsWith('https://www.mercadopago.com.br/'));
  r=await fetch(base+'/api/orders',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({name:'Pessoa Teste',phone:'11999999999',email:'cliente@exemplo.test',delivery:'pickup',payment:'cash',items:[{id:'perfume-123',qty:1}]})});
  assert.equal(r.status,201);assert.equal((await r.json()).mode,'pickup-cash');assert.equal(order.payment_status,'pendente');
  r=await fetch(base+'/api/admin/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({email:'admin@exemplo.test',password:adminPassword})});
  assert.equal(r.status,200);const cookie=r.headers.get('set-cookie').split(';')[0],info=await r.json();
  r=await fetch(base+'/api/admin/customers',{headers:{Cookie:cookie}});assert.equal(r.status,200);const list=await r.json();assert.equal(list.customers.length,1);
  assert.equal(list.customers[0].email,'cliente@exemplo.test');
  r=await fetch(base+'/api/admin/customers/'+encodeURIComponent(customer.email)+'/optout',{method:'POST',headers:{Cookie:cookie,Origin:base,'x-csrf-token':info.csrf,'Content-Type':'application/json'},body:'{}'});
  assert.equal(r.status,200);assert.equal(customer.marketing_opt_in,false);
  // Modo de teste: o publico continua sem checkout, mas um admin autenticado pode comprar.
  process.env.MAHACH_ENABLE_CHECKOUT='false';
  process.env.MAHACH_ENABLE_CHECKOUT_TEST_MODE='true';
  r=await fetch(base+'/api/store/status');assert.equal((await r.json()).checkoutEnabled,false);
  r=await fetch(base+'/api/store/status',{headers:{Cookie:cookie}});assert.equal((await r.json()).checkoutEnabled,true);
  r=await fetch(base+'/api/orders',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({name:'Pessoa Teste',phone:'11999999999',email:'cliente@exemplo.test',delivery:'pickup',payment:'pix',items:[{id:'perfume-123',qty:1}]})});
  assert.equal(r.status,503,'Visitante nao deve conseguir criar pedido no modo privado');
  // A autorizacao HMAC do webhook funciona mesmo sem sessao de administrador.
  r=await webhook();assert.equal(r.status,200);
  process.env.MAHACH_ENABLE_CHECKOUT_TEST_MODE='false';
  r=await fetch(base+'/api/store/status',{headers:{Cookie:cookie}});assert.equal((await r.json()).checkoutEnabled,false);
  console.log('TESTE PRIVADO OK: bloqueio publico, admin habilitado, webhook assinado.');
  console.log('CLIENTES / PEDIDOS OK (SIMULADO): opt-in, painel privado, descadastro, webhook HMAC, estoque e prevenção de duplicação.');
 }finally{await new Promise(r=>server.close(r));await db.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
