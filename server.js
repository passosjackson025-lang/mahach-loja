'use strict';
/* MAHACH PostgreSQL (staging). Não substitua a versão SQLite original. */
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {db,bootstrap}=require('./pg-db');
const {importIntoPg,cleanCategory}=require('./csv-import-pg');
const {makeSettingsPg}=require('./site-settings-pg');
const commerce=require('./commerce-flows');
const {savePhoto,imageStorageStatus}=require('./image-storage');
const ROOT=__dirname, PRIVATE=path.join(ROOT,'private');
const MAX_BODY=32*1024, CATEGORIES=[['perfumes','Perfumaria','Fragrâncias para todos os estilos'],['corpo','Corpo & cuidado','Seu ritual diário de autocuidado'],['beleza','Beleza essencial','O cuidado em cada detalhe']];
const DEFAULT_WHATSAPP='5511995209827';
// Não usar SQLite na Render. A chave local é carregada a partir de private/settings.key
// ou da variável MAHACH_SETTINGS_KEY (recomendada para Render).
let settings;
const ready=(async()=>{
 await bootstrap();
 settings=await makeSettingsPg(db,path.join(PRIVATE,'settings.key'));
})();
function normalizeCatalogQuery(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
const conf=(name)=>settings.get(name);
function quickDeliveryWhatsapp(o){
 const items=JSON.parse(o.items_json).map(x=>x.qty+'x '+x.name).join(', ');
 const text=`Olá, MAHACH! Já efetuei o pagamento dos produtos do pedido ${o.id} e gostaria de combinar somente a corrida por ${o.delivery==='uber'?'Uber':'99'}.\nNome: ${o.customer_name}\nEndereço: ${o.address} – CEP ${o.cep}\nItens: ${items}\nValor dos produtos: R$ ${Number(o.subtotal).toFixed(2).replace('.',',')} (pagamento confirmado).\nQual será o valor e como vamos organizar a entrega?`;
 return 'https://wa.me/'+(conf('WHATSAPP')||DEFAULT_WHATSAPP)+'?text='+encodeURIComponent(text);
}
function searchText(p){return `${p.name||''} ${p.brand||''} ${p.family||''} ${p.description||''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().slice(0,14000)}
function random(){return crypto.randomBytes(32).toString('base64url')}
function hash(x){return crypto.createHash('sha256').update(x).digest('hex')}
function secureUrl(s){if(!s)return '';if(/^\/assets\/produtos\/[a-zA-Z0-9_-]+\.webp$/.test(s))return s;try{const u=new URL(s);return u.protocol==='https:'&&u.username===''&&u.password===''&&s.length<1500?s:''}catch{return ''}}
function json(res,status,obj,extra={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...extra});res.end(JSON.stringify(obj))}
function problem(res,status,msg){json(res,status,{error:msg})}
async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Object.assign(new Error('É necessário enviar JSON'),{status:415});let chunks=[],total=0;for await(const chunk of req){total+=chunk.length;if(total>MAX_BODY)throw Object.assign(new Error('Requisição grande demais'),{status:413});chunks.push(chunk)};try{const obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!obj||typeof obj!=='object'||Array.isArray(obj))throw 0;return obj}catch{throw Object.assign(new Error('JSON inválido'),{status:400})}}
async function bodyCsv(req){if(!/^text\/csv(?:;|$)/i.test(req.headers['content-type']||''))throw Object.assign(new Error('Envie CSV com Content-Type: text/csv'),{status:415});let bytes=0,chunks=[];for await(const part of req){bytes+=part.length;if(bytes>8*1024*1024)throw Object.assign(new Error('CSV maior que 8 MB'),{status:413});chunks.push(part)}return Buffer.concat(chunks).toString('utf8')}
function str(x,max=255){return typeof x==='string'?x.trim().slice(0,max):''}
function number(x){const n=Number(x);return Number.isFinite(n)?n:NaN}
async function validProduct(data){
 const p={id:str(data.id,80),name:str(data.name,220),description:str(data.description,10000),category:str(data.category,64),brand:str(data.brand,100),family:str(data.family,85),image:secureUrl(str(data.image,1500)),sku:str(data.sku,80),price:number(data.price),stock:data.stock===''||data.stock===null||data.stock===undefined?null:Number(data.stock),active:data.active===false||data.active===0?0:1,weight:data.weight||null,width:data.width||null,height:data.height||null,length:data.length||null};
 if(!p.name||p.name.length<2||!p.category||!(await db.prepare('SELECT id FROM categories WHERE id=?').get(p.category))||!Number.isFinite(p.price)||p.price<0||p.price>100000)throw Object.assign(new Error('Confira nome, categoria e preço'),{status:400});
 if(p.stock!==null&&(!Number.isInteger(p.stock)||p.stock<0))throw Object.assign(new Error('Estoque inválido'),{status:400});
 for(const m of ['weight','width','height','length']){if(p[m]!==null){p[m]=number(p[m]);if(!(p[m]>0&&p[m]<10000))throw Object.assign(new Error('Dimensão ou peso inválido'),{status:400})}}
 p.search_text=searchText(p);return p;
}
function cookies(req){return Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')).filter(x=>x.length===2))}
async function session(req){const token=cookies(req).mahach_session;if(!token||!/^[-\w]{40,60}$/.test(token))return null;return (await db.prepare('SELECT email,csrf,expires FROM sessions WHERE token_hash=? AND expires>?').get(hash(token),Date.now()))||null}
async function logged(req,res){const s=await session(req);if(!s){problem(res,401,'Acesso restrito ao administrador');return null}return s}
// A flag de teste NUNCA libera compras ao publico: exige sessao administrativa valida.
async function checkoutAllowed(req){
 if(process.env.MAHACH_ENABLE_CHECKOUT==='true')return true;
 return process.env.MAHACH_ENABLE_CHECKOUT_TEST_MODE==='true'&&!!(await session(req));
}
function checkOrigin(req){const o=req.headers.origin;const host=req.headers.host;if(!o||!host)return false;try{const u=new URL(o);return u.host===host&&(u.protocol==='http:'||u.protocol==='https:')}catch{return false}}
function canWrite(req,s){return checkOrigin(req)&&req.headers['x-csrf-token']===s.csrf}
function cookieValue(req,value,maxAge=28800){const secure=(process.env.NODE_ENV==='production'||process.env.RENDER==='true'||!!process.env.RENDER_SERVICE_ID)?'; Secure':'';return `mahach_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`}
const counters=new Map();
function rate(req,key,max,window=60000){const ip=req.socket.remoteAddress||'local',n=Date.now(),k=`${key}:${ip}`,v=counters.get(k)||{time:n,count:0};if(n-v.time>window){v.time=n;v.count=0}v.count++;counters.set(k,v);if(counters.size>4000)for(const [k,v]of counters)if(n-v.time>3600000)counters.delete(k);return v.count<=max}
function productSummary(p){return {id:p.id,name:p.name,price:p.price,category:p.category,brand:p.brand,family:p.family,image:p.image,description:p.description,stock:p.stock,active:!!p.active,weight:p.weight,width:p.width,height:p.height,length:p.length,sku:p.sku}}
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.ttf':'font/ttf','.ico':'image/x-icon'};
async function staticFile(req,res,url){
 let pathname;try{pathname=decodeURIComponent(url.pathname)}catch{return problem(res,400,'URL inválida')}
 if(pathname==='/'||pathname==='/admin')pathname=pathname==='/'?'/index.html':'/admin/login.html';
 if(pathname.endsWith('/'))pathname+='index.html';
 if(pathname==='/admin/painel.html'&&!await session(req)){res.writeHead(302,{Location:'/admin'});return res.end()}
 // Bloquear arquivos de configuração, fontes de dados e banco de dados.
 if(!/^\/(?:index\.html|app\.js|data\.js|scene\.js|polish\.js|styles\.css|catalogo\.js|checkout\.js|finalizado\.html|finalizado\.js|acompanhar\.html|privacidade\.html|tracking\.js|admin\/(?:login\.html|painel\.html|admin\.js|admin\.css|admin-pg-status\.css)|produtos\/(?:index\.html|perfumaria-arabe\/index\.html|corpo-e-cuidado\/index\.html|beleza-essencial\/index\.html)|assets\/[\w./-]+)$/.test(pathname)||pathname.includes('..'))return problem(res,404,'Não encontrado');
 const file=path.join(ROOT,pathname);if(!file.startsWith(ROOT+path.sep))return problem(res,404,'Não encontrado');
 let st;try{const real=fs.realpathSync(file);if(!real.startsWith(ROOT+path.sep))throw 0;st=fs.statSync(real);if(!st.isFile())throw 0}catch{return problem(res,404,'Não encontrado')}
 const ext=path.extname(file);if(!MIME[ext])return problem(res,404,'Não encontrado');
 res.writeHead(200,{'Content-Type':MIME[ext],'Cache-Control':pathname.startsWith('/admin/')||pathname==='/acompanhar.html'?'no-store':pathname.startsWith('/assets/')?'public, max-age=86400':'no-cache','Content-Length':st.size});if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
}
function security(res){
 const csp="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"+(process.env.NODE_ENV==='production'?'; upgrade-insecure-requests':'');
 res.setHeader('Content-Security-Policy',csp);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('X-Permitted-Cross-Domain-Policies','none');res.setHeader('Origin-Agent-Cluster','?1');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Cross-Origin-Resource-Policy','same-origin');res.setHeader('Cross-Origin-Opener-Policy','same-origin');if(process.env.NODE_ENV==='production'||process.env.RENDER==='true'||!!process.env.RENDER_SERVICE_ID)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}
async function vendizapFetch(endpoint){const id=conf('VENDIZAP_ID'),secret=conf('VENDIZAP_SECRET');if(!id||!secret)throw Object.assign(new Error('Integração Vendizap não configurada'),{status:503});const res=await fetch('https://app.vendizap.com/api/'+endpoint,{headers:{'X-Auth-Id':id,'X-Auth-Secret':secret,'User-Agent':'MahachLoja/2.0','Accept':'application/json'},signal:AbortSignal.timeout(12000)});if(!res.ok)throw Object.assign(new Error('Vendizap respondeu '+res.status),{status:502});return res.json()}
async function syncVendizap(){let updates=0,images=0;
 const update=db.prepare('UPDATE products SET name=?,price=?,description=?,image=?,search_text=? WHERE id=?');
 const insert=db.prepare('INSERT OR IGNORE INTO products(id,name,price,description,category,brand,family,image,sku,active,search_text) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
 for(let skip=0;skip<10000;skip+=100){const raw=await vendizapFetch('produtos?limit=100&skip='+skip);const arr=Array.isArray(raw)?raw:Array.isArray(raw.produtos)?raw.produtos:Array.isArray(raw.data)?raw.data:[];if(!Array.isArray(arr))break;
 for(const r of arr){const id=str(r._id||r.id,80);if(!id)continue;
 const old=(await db.prepare('SELECT * FROM products WHERE id=?').get(id));
 const name=str(r.descricao||r.nome,220)||old?.name;if(!name)continue;
 const value=r.preco===undefined?NaN:Number(r.preco),price=Number.isFinite(value)&&value>=0?value:old?.price??0;
 const desc=str(r.detalhes,10000)||old?.description||'';
 const imgs=Array.isArray(r.imagens)?r.imagens:[];const first=imgs.find(x=>typeof x==='string'||(x&&typeof x==='object'));
 const remoteImage=secureUrl(typeof first==='string'?first:first?.url||first?.src);
 const manualImage=old?.image&&(/^(?:\/assets\/produtos\/|https:\/\/res\.cloudinary\.com\/)/.test(old.image))?old.image:'';
 const image=manualImage||remoteImage||old?.image||'';
 if(image)images++;
 if(old){await update.run(name,price,desc,image,searchText({name,description:desc,brand:old.brand,family:old.family}),id)}
 else await insert.run(id,name,price,desc,'perfumes','Vendizap','','',str(r.codigo,80),r.exibir===false?0:1,searchText({name,description:desc,brand:'Vendizap',family:''}));
 if(!old&&image)(await db.prepare('UPDATE products SET image=? WHERE id=?').run(image,id));
 updates++;
 }
 if(arr.length<100)break;
 }
 return {synced:updates,images};
}
const liveQuotes=new Map();
function itemsFingerprint(items,cep){return hash(cep+JSON.stringify(items.map(x=>[x.p.id,x.qty]).sort((a,b)=>a[0].localeCompare(b[0]))))}
async function shippingQuote(payload){
 const token=conf('MELHOR_ENVIO_TOKEN'),origin=conf('ORIGIN_CEP').replace(/\D/g,'');if(!token||origin.length!==8)throw Object.assign(new Error('Cotação indisponível até configurar token e CEP de origem'),{status:503});
 const cep=str(payload.cep,12).replace(/\D/g,'');if(cep.length!==8)throw Object.assign(new Error('CEP inválido'),{status:400});
 const items=await collectItems(payload.items);
 if(!items.length)throw Object.assign(new Error('Sacola vazia'),{status:400});
 // Frete exige peso e dimensoes reais da embalagem; sem estimativas ficticias.
 if(items.some(({p})=>![p.width,p.height,p.length,p.weight].every(n=>Number.isFinite(Number(n))&&Number(n)>0)))throw Object.assign(new Error('Para calcular frete, cadastre peso e dimensoes de todos os produtos da sacola.'),{status:422});
 const products=items.map(({p,qty})=>({id:p.id,width:Number(p.width),height:Number(p.height),length:Number(p.length),weight:Number(p.weight),insurance_value:p.price,quantity:qty}));
 const api=conf('MELHOR_ENVIO_SANDBOX')==='true'?'https://sandbox.melhorenvio.com.br':'https://melhorenvio.com.br';
 const r=await fetch(api+'/api/v2/me/shipment/calculate',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','Accept':'application/json','User-Agent':'MAHACH ('+(conf('SHIPPING_CONTACT_EMAIL')||'suporte@mahach.com.br')+')'},body:JSON.stringify({from:{postal_code:origin},to:{postal_code:cep},products}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){
  // Nao gravar respostas de provedor nem tokens nos logs.
  const reason=r.status===401||r.status===403?'Melhor Envio recusou o acesso: confira se o token pertence ao ambiente selecionado (sandbox ou producao).':r.status===422?'Melhor Envio recusou os dados do frete: confira CEP, peso e dimensoes.':'Melhor Envio indisponivel neste momento (HTTP '+r.status+').';
  throw Object.assign(new Error(reason),{status:502});
 }
 const data=await r.json();
 // Perfumes: nao oferecer Correios, LATAM, Azul ou Loggi; restricoes conforme tabela Melhor Envio.
 const authorized=/jadlog|buslog|j\s*&\s*t|pegaki|ponto parceiro/i;
 return (Array.isArray(data)?data:[]).filter(x=>authorized.test(String(x.company?.name||''))&&!x.error&&(x.custom_price||x.price))
  .map(x=>({service:String(x.name||'Entrega'),carrier:String(x.company?.name||'Transportadora'),cost:Number(x.custom_price||x.price),days:Number(x.custom_delivery_time||x.delivery_time),provider:'Melhor Envio'}))
  .filter(x=>Number.isFinite(x.cost)&&x.cost>=0&&Number.isFinite(x.days)&&x.days>=0);
}
async function collectItems(items){if(!Array.isArray(items)||items.length>30)throw Object.assign(new Error('Sacola inválida'),{status:400});const ids=new Set(),out=[];for(const it of items){const id=str(it.id,80),qty=Number(it.qty);if(!id||ids.has(id)||!Number.isInteger(qty)||qty<1||qty>20)throw Object.assign(new Error('Quantidade inválida'),{status:400});ids.add(id);const p=(await db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(id));if(!p)throw Object.assign(new Error('Produto indisponível'),{status:400});if(p.stock!==null&&p.stock<qty)throw Object.assign(new Error('Quantidade indisponível: '+p.name),{status:400});out.push({p,qty})}return out}

// Upload de imagens WEBP: cliente normaliza foto no Canvas. Servidor valida assinatura,
// dimensões 1200 x 1200 e grava nome aleatório, sem sobrescrever outros arquivos.
async function imageUpload(req){
 if(req.headers['content-type']!=='image/webp')throw Object.assign(new Error('Envie uma imagem WebP'),{status:415});
 if(!rate(req,'upload',80,3600000))throw Object.assign(new Error('Limite de uploads atingido'),{status:429});
 let total=0;const parts=[];for await(const part of req){total+=part.length;if(total>4*1024*1024)throw Object.assign(new Error('Foto maior que 4 MB'),{status:413});parts.push(part)}
 const bytes=Buffer.concat(parts);
 if(bytes.length<30||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)throw Object.assign(new Error('WEBP inválido'),{status:400});
 const chunk=bytes.toString('ascii',12,16);let width=0,height=0;
 if(chunk==='VP8X'){width=1+bytes.readUIntLE(24,3);height=1+bytes.readUIntLE(27,3)}
 else if(chunk==='VP8 '&&bytes.length>=30&&bytes[23]===0x9d&&bytes[24]===0x01&&bytes[25]===0x2a){width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff}
 else if(chunk==='VP8L'&&bytes.length>=25&&bytes[20]===0x2f){const bits=bytes.readUInt32LE(21);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1}
 if(width!==1200||height!==1200)throw Object.assign(new Error('A foto deve medir 1200 x 1200 pixels'),{status:400});
 return await savePhoto(bytes,ROOT);
}


async function sendTransactional(orderId,kind){
 const o=(await db.prepare('SELECT * FROM orders WHERE id=?').get(orderId));if(!o)return {ok:false};
 const esc=commerce.htmlesc,customer=o.customer_email;
 const summary=`<h2>Pedido ${esc(o.id)} · MAHACH</h2><p>Olá, ${esc(o.customer_name)}.</p><p>Itens: ${JSON.parse(o.items_json).map(i=>esc(i.qty+'x '+i.name)).join(', ')}</p>`;
 const approved=kind==='approved',tracking=kind==='tracking';
 const total=(Number(o.subtotal)+Number(o.shipping_cost||0)).toFixed(2).replace('.',',');
 const trackingPage='https://rastreamento.correios.com.br/app/index.php';
 const customerSubject=approved?'MAHACH: pagamento aprovado · '+o.id:tracking?'MAHACH: seu código de rastreio · '+o.id:'MAHACH: pedido registrado · '+o.id;
 const quickDelivery=['uber','99'].includes(o.delivery);
 const custHtml=summary+(tracking?`<p>Seu código dos Correios: <strong>${esc(o.tracking_code)}</strong></p><p>Consulte diretamente em <a href="${trackingPage}">Rastreamento Correios</a>.</p>`:approved?`<p><strong>Pagamento aprovado.</strong> Total R$ ${total}. ${o.status==='estoque_pendente'?'Sua compra está aguardando verificação de estoque pela equipe MAHACH.':'A loja dará sequência à separação do pedido.'}</p>${quickDelivery?'<p>A corrida por Uber/99 não foi cobrada neste pagamento. Entre em contato pelo WhatsApp do atendimento para combinar o valor e a entrega.</p>':o.delivery==='correios'?'<p>O código de rastreamento dos Correios será enviado após a postagem.</p>':'<p>Seu pedido está em preparação para retirada.</p>'}`:'<p>Seu pedido foi registrado para retirada. O pagamento em dinheiro será feito presencialmente. Nenhum pagamento online foi realizado.</p>')+'<p>A nota fiscal será enviada após emissão pelo sistema fiscal da loja, quando disponível.</p>';
 const result={};
 const flag=tracking?'tracking_email_sent':'customer_email_sent';
 if(customer&&!o[flag]){result.customer=await commerce.sendEmail(conf,customer,customerSubject,custHtml);if(result.customer.ok)(await db.prepare('UPDATE orders SET '+flag+'=1 WHERE id=?').run(orderId))}
 if(approved&&conf('ADMIN_EMAIL')&&!o.admin_email_sent){result.admin=await commerce.sendEmail(conf,conf('ADMIN_EMAIL'),'MAHACH: venda paga · '+o.id,summary+'<p>Pagamento verificado no Mercado Pago. Total: R$ '+total+'.</p>');if(result.admin.ok)(await db.prepare('UPDATE orders SET admin_email_sent=1 WHERE id=?').run(orderId))}
 return result;
}
async function processVerifiedPayment(paymentId){
 const pay=await commerce.getVerifiedPayment(conf,paymentId),id=str(pay.external_reference,40);
 const o=await db.prepare('SELECT * FROM orders WHERE id=?').get(id);
 if(!o||!['pix','card'].includes(o.payment))return {ignored:true};
 const expected=commerce.cents(Number(o.subtotal)+Number(o.shipping_cost||0));
 if(pay.currency_id!=='BRL'||commerce.cents(pay.transaction_amount)!==expected)return {ignored:true,reason:'Valor divergente'};
 if(pay.status!=='approved')return {approved:false};
 const applied=await db.transaction(async()=>{
  const locked=await db.prepare('SELECT * FROM orders WHERE id=? FOR UPDATE').get(id);
  if(!locked||locked.payment_status==='aprovado')return false;
  // Não confirma o mesmo pedido com identificadores de pagamento diferentes.
  if(locked.mp_payment_id&&locked.mp_payment_id!==String(pay.id))return false;
  let missingStock=false;
  const reserved=[];
  const snapshot=JSON.parse(locked.items_json).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  for(const item of snapshot){
   const qty=Number(item.qty),product=await db.prepare('SELECT stock FROM products WHERE id=? FOR UPDATE').get(item.id);
   if(!product||!Number.isInteger(qty)||qty<1||qty>20){missingStock=true;continue}
   if(product.stock!==null){
    if(product.stock<qty){missingStock=true;continue}
    reserved.push({id:item.id,qty});
   }
  }
  // Se faltar qualquer item, nenhuma unidade é debitada automaticamente.
  if(!missingStock)for(const line of reserved)await db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(line.qty,line.id);
  const nextStatus=missingStock?'estoque_pendente':'pagamento_aprovado';
  await db.prepare('UPDATE orders SET payment_status=?,status=?,mp_payment_id=? WHERE id=?')
   .run('aprovado',nextStatus,String(pay.id),id);
  return true;
 });
 if(applied)await sendTransactional(id,'approved');
 return {approved:true,newlyConfirmed:applied};
}
async function api(req,res,u){const method=req.method, route=u.pathname;
 if(route==='/api/health'&&method==='GET')return json(res,200,{ok:true,catalog:(await db.prepare('SELECT COUNT(*) n FROM products WHERE active=1').get()).n});
 if(route==='/api/store/status'&&method==='GET')return json(res,200,{checkoutEnabled:await checkoutAllowed(req),testMode:process.env.MAHACH_ENABLE_CHECKOUT_TEST_MODE==='true'&&process.env.MAHACH_ENABLE_CHECKOUT!=='true'},{'Cache-Control':'no-store'});
 if(route==='/api/meta'&&method==='GET'){
  const requestedCategory=str(u.searchParams.get('category'),64);
  const categories=(await db.prepare(`SELECT c.id,c.name,c.subtitle,COUNT(p.id) total
    FROM categories c LEFT JOIN products p ON p.category=c.id AND p.active=1
    GROUP BY c.id ORDER BY CASE c.id WHEN 'perfumes' THEN 0 WHEN 'corpo' THEN 1 WHEN 'beleza' THEN 2 ELSE 9 END,c.name`).all());
  const validCategory=categories.some(c=>c.id===requestedCategory)?requestedCategory:'';
  const brands=validCategory
    ?(await db.prepare(`SELECT brand,COUNT(*) total FROM products WHERE active=1 AND category=? AND brand<>'' GROUP BY brand ORDER BY total DESC,brand LIMIT 500`).all(validCategory))
    :(await db.prepare(`SELECT brand,COUNT(*) total FROM products WHERE active=1 AND brand<>'' GROUP BY brand ORDER BY total DESC,brand LIMIT 500`).all());
  return json(res,200,{categories,brands,whatsapp:conf('WHATSAPP')||DEFAULT_WHATSAPP,pickupAddress:conf('SHOP_ADDRESS')||'',onlinePayments:commerce.configured(conf)},{'Cache-Control':'no-store'});
 }
 if(route==='/api/products'&&method==='GET'){
 if(!rate(req,'search',180))return problem(res,429,'Muitas buscas. Tente novamente.');
 const page=Math.min(500,Math.max(1,Number(u.searchParams.get('page'))||1)),limit=Math.min(48,Math.max(1,Number(u.searchParams.get('limit'))||24));
 const category=str(u.searchParams.get('category'),64),brand=str(u.searchParams.get('brand'),100),family=str(u.searchParams.get('family'),85),q=normalizeCatalogQuery(str(u.searchParams.get('q'),100));
 const where=['active=1'],args=[];
 if(category&&category!=='todos'){where.push('category=?');args.push(category)}if(brand){where.push('brand=?');args.push(brand)}if(family){where.push('family=?');args.push(family)}
 // Cada palavra deve existir no nome/marca. Nunca filtrar por descrição: ela dava falsos positivos.
 for(const token of q.split(' ').filter(Boolean).slice(0,12)){where.push("REGEXP_REPLACE(TRANSLATE(LOWER(name || ' ' || brand), 'áàâãäåéèêëíìîïóòôõöúùûüçñ', 'aaaaaaeeeeiiiiooooouuuucn'), '[^a-z0-9]+', ' ', 'g') LIKE ?");args.push('%'+token+'%')}
 const c=where.join(' AND '),sort={featured:'LOWER(name)',name:'LOWER(name)','price-asc':'price ASC,name','price-desc':'price DESC,name'}[u.searchParams.get('sort')]||'name COLLATE NOCASE';
 const total=(await db.prepare('SELECT COUNT(*) n FROM products WHERE '+c).get(...args)).n;
 const rows=(await db.prepare('SELECT id,name,price,category,brand,family,image,stock FROM products WHERE '+c+' ORDER BY '+sort+' LIMIT ? OFFSET ?').all(...args,limit,(page-1)*limit));
 return json(res,200,{page,limit,total,products:rows},{'Cache-Control':'public, max-age=20, stale-while-revalidate=40'});
 }
 const productId=route.match(/^\/api\/products\/([a-zA-Z0-9_-]{5,80})$/);
 if(productId&&method==='GET'){const p=(await db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(productId[1]));return p?json(res,200,{product:productSummary(p)},{'Cache-Control':'public, max-age=20'}):problem(res,404,'Produto não encontrado')}
 if(route==='/api/shipping/quote'&&method==='POST'){
 if(!rate(req,'ship',20,600000))return problem(res,429,'Limite de cotações excedido');
 const p=await body(req);const list=await shippingQuote(p),items=await collectItems(p.items),cep=str(p.cep,12).replace(/\D/g,'');
 const fingerprint=itemsFingerprint(items,cep);const options=list.map((x,index)=>{
 const quoteId=random();liveQuotes.set(hash(quoteId),{fingerprint,service:x.service,carrier:x.carrier,cost:x.cost,created:Date.now()});
 return {...x,quoteId}
 });
 if(liveQuotes.size>2000)for(const [key,item]of liveQuotes)if(Date.now()-item.created>600000)liveQuotes.delete(key);
 return json(res,200,{options,notice:'Cotação estimada. Etiqueta e prazo final serão confirmados pela loja.'});
 }
 if(route==='/api/payments/mercadopago/webhook'&&method==='POST'){
  // Notificacoes externas nao possuem cookie; continuam exigindo HMAC valido.
  if(process.env.MAHACH_ENABLE_CHECKOUT!=='true'&&process.env.MAHACH_ENABLE_CHECKOUT_TEST_MODE!=='true')return problem(res,503,'Checkout de teste ainda não habilitado');
  if(!rate(req,'mp-webhook',160,60000))return problem(res,429,'Limite de notificações');
  const id=commerce.verifyMPWebhook(conf,req,u);if(!id)return problem(res,401,'Assinatura inválida');
  await body(req);const result=await processVerifiedPayment(id);return json(res,200,{received:true,...result});
 }
 if(route==='/api/payments/status'&&method==='GET'){
  const reference=str(u.searchParams.get('reference'),30),token=str(u.searchParams.get('token'),100);
  const o=(await db.prepare('SELECT id,payment_status,delivery,status,customer_name,address,cep,subtotal,items_json FROM orders WHERE id=? AND public_token_hash=?').get(reference,hash(token)));
  if(!o)return problem(res,404,'Pedido não encontrado');
  const quick=['uber','99'].includes(o.delivery);
  const whatsapp=quick&&o.payment_status==='aprovado'?quickDeliveryWhatsapp(o):'';
  return json(res,200,{reference:o.id,paymentStatus:o.payment_status,delivery:o.delivery,status:o.status,whatsapp});
 }
 if(route==='/api/orders'&&method==='POST'){
  if(!await checkoutAllowed(req))return problem(res,503,'Checkout indisponivel para visitantes durante os testes');
  if(!rate(req,'order',8,900000))return problem(res,429,'Muitas solicitações. Tente mais tarde');
  if(!checkOrigin(req))return problem(res,403,'Origem não autorizada');
  const data=await body(req),items=await collectItems(data.items);if(!items.length)return problem(res,400,'Sua sacola está vazia');
  // Nunca permitir pagamento se a loja nao sabe quantas unidades tem.
  if(items.some(({p})=>p.stock===null||p.stock===undefined))return problem(res,400,'Informe o estoque dos produtos antes de receber pagamentos');
  const customer_name=str(data.name,120),phone=str(data.phone,20).replace(/\D/g,''),email=str(data.email,200).toLowerCase(),delivery=str(data.delivery,20),payment=str(data.payment,30),cep=str(data.cep,12).replace(/\D/g,''),address=str(data.address,320);
  if(customer_name.length<3||phone.length<10||phone.length>13||!/^\S+@\S+\.\S+$/.test(email)||!['pickup','correios','transportadora','uber','99'].includes(delivery)||!['cash','pix','card','assist'].includes(payment))return problem(res,400,'Confira nome, e-mail, entrega e pagamento');
  const assist=['uber','99'].includes(delivery);
  if(delivery!=='pickup'&&(cep.length!==8||address.length<8))return problem(res,400,'Informe endereço completo e CEP');
  if(payment==='cash'&&delivery!=='pickup'||payment==='assist')return problem(res,400,'Pagamento incompatível com a entrega');
  if(['pix','card'].includes(payment)&&!commerce.configured(conf))return problem(res,503,'Pagamento online indisponível. Configure Mercado Pago e uma URL HTTPS no painel.');
  let freight=delivery==='pickup'?0:null,shippingService=delivery==='pickup'?'Retirada na loja':assist?'Corrida a combinar separadamente (Uber/99)':'';
  if(delivery==='correios'||delivery==='transportadora'){
   if(!conf('MELHOR_ENVIO_TOKEN')||!/^\d{8}$/.test(conf('ORIGIN_CEP')))return problem(res,503,'Cotação indisponível: configure Melhor Envio e CEP de origem no painel.');
   const entry=liveQuotes.get(hash(str(data.quoteId,80)));
   if(!entry||Date.now()-entry.created>600000||entry.fingerprint!==itemsFingerprint(items,cep)||!(/jadlog|buslog|j\s*&\s*t|pegaki|ponto parceiro/i).test(entry.carrier))return problem(res,400,'Selecione uma cotação válida de transportadora habilitada para perfumes');
   freight=entry.cost;shippingService=entry.carrier+' · '+entry.service;
  }
  const subtotal=Math.round(items.reduce((acc,x)=>acc+x.p.price*x.qty,0)*100)/100;
  const id='MH-'+crypto.randomBytes(5).toString('hex').toUpperCase(),token=random(),created=new Date().toISOString();
  const snapshot=items.map(({p,qty})=>({id:p.id,name:p.name,qty,unit_price:p.price}));
  const order={id,customer_name,customer_email:email,subtotal,shipping_cost:freight,payment};
  let checkoutUrl='',mpPreferenceId='';
  if(['pix','card'].includes(payment)){
   const mp=await commerce.createPreference(conf,order,snapshot,token);
   checkoutUrl=mp.checkoutUrl;mpPreferenceId=mp.preferenceId;
  }
  const marketingOptIn=data.marketingOptIn===true || data.marketingOptIn==='on';
  await db.transaction(async()=>{
   await db.prepare('INSERT INTO orders(id,public_token_hash,created,status,customer_name,phone,customer_email,cep,address,delivery,payment,items_json,subtotal,shipping_cost,shipping_note,shipping_service,mp_preference_id,marketing_opt_in) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(id,hash(token),created,'pedido_criado',customer_name,phone,email,delivery==='pickup'?'':cep,delivery==='pickup'?'':address,delivery,payment,JSON.stringify(snapshot),subtotal,freight,assist?'Mercadoria paga online; corrida Uber/99 NÃO incluída no total. Negociar por WhatsApp após pagamento aprovado':delivery==='pickup'?'Retirada sem frete; '+(conf('SHOP_ADDRESS')||'endereço a informar'):'Melhor Envio · cotação selecionada',shippingService,mpPreferenceId,marketingOptIn);
   // Uma compra sem marcar a opção NUNCA concede permissão para marketing.
   // Um opt-in registrado anteriormente não é apagado por uma compra posterior.
   await db.prepare(`INSERT INTO customers(email,name,phone,marketing_opt_in,marketing_consent_at,first_order_at,last_order_at,last_order_id)
    VALUES(?,?,?,?,CASE WHEN ? THEN NOW() ELSE NULL END,NOW(),NOW(),?)
    ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,phone=EXCLUDED.phone,
    marketing_opt_in=customers.marketing_opt_in OR EXCLUDED.marketing_opt_in,
    marketing_consent_at=CASE WHEN EXCLUDED.marketing_opt_in THEN NOW() ELSE customers.marketing_consent_at END,
    last_order_at=NOW(),last_order_id=EXCLUDED.last_order_id,updated_at=NOW()`)
    .run(email,customer_name,phone,marketingOptIn,marketingOptIn,id);
  });
  if(delivery==='correios'||delivery==='transportadora')liveQuotes.delete(hash(str(data.quoteId,80)));
  if(payment==='cash')await sendTransactional(id,'created');
  return json(res,201,{reference:id,token,mode:['pix','card'].includes(payment)?'online':'pickup-cash',checkoutUrl,whatsapp:'',notice:assist?'Pague os produtos pelo Mercado Pago. O custo da corrida NÃO está incluído; após pagamento aprovado, combine a entrega no WhatsApp.':payment==='cash'?'Pedido registrado. Pagamento em dinheiro na retirada.':'Pedido registrado; o pagamento será feito no ambiente seguro do Mercado Pago e só será confirmado após verificação.'});
 }
 if(route==='/api/orders/status'&&method==='GET'){
 if(!rate(req,'track',35,60000))return problem(res,429,'Muitas consultas. Aguarde um minuto');
 const ref=str(u.searchParams.get('reference'),30),tok=str(u.searchParams.get('token'),100);const item=(await db.prepare('SELECT status,created,tracking_code,tracking_url,delivery,shipping_cost,shipping_service,payment_status FROM orders WHERE id=? AND public_token_hash=?').get(ref,hash(tok)));return item?json(res,200,item):problem(res,404,'Solicitação não encontrada');
 }
 if(route==='/api/admin/session'&&method==='GET'){const s=await session(req);return json(res,200,{authenticated:!!s,email:s?.email||null,csrf:s?.csrf||null})}
 if(route==='/api/admin/login'&&method==='POST'){
 if(!rate(req,'login',7,900000))return problem(res,429,'Muitas tentativas; aguarde 15 minutos');if(!checkOrigin(req))return problem(res,403,'Origem não autorizada');const a=await body(req),email=str(a.email,180).toLowerCase(),pass=typeof a.password==='string'?a.password:'';
 const usr=(await db.prepare('SELECT * FROM admins WHERE email=?').get(email));const salt=usr?.salt||crypto.randomBytes(16).toString('hex'),correct=usr?.hash||crypto.randomBytes(64).toString('hex');const attempt=crypto.scryptSync(pass.slice(0,1000),salt,64).toString('hex');if(!usr||!crypto.timingSafeEqual(Buffer.from(attempt,'hex'),Buffer.from(correct,'hex')))return problem(res,401,'Credenciais inválidas');
 const token=random(),csrf=random();(await db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()));(await db.prepare('INSERT INTO sessions(token_hash,email,csrf,expires) VALUES (?,?,?,?)').run(hash(token),email,csrf,Date.now()+8*3600000));
 res.setHeader('Set-Cookie',cookieValue(req,token));return json(res,200,{ok:true,csrf,email});
 }
 if(route.startsWith('/api/admin/')){
 const s=await logged(req,res);if(!s)return;
 if(method!=='GET'&&!canWrite(req,s))return problem(res,403,'Sessão ou CSRF inválido');
 if(method!=='GET'&&route!=='/api/admin/logout'&&process.env.MAHACH_ENABLE_ADMIN_WRITES!=='true')return problem(res,503,'Gravações desativadas nesta versão. Reinicie o teste com MAHACH_ENABLE_ADMIN_WRITES=true depois de confirmar o backup e o banco de testes.');
 if(route==='/api/admin/capabilities'&&method==='GET')return json(res,200,{writes:process.env.MAHACH_ENABLE_ADMIN_WRITES==='true',checkout:process.env.MAHACH_ENABLE_CHECKOUT==='true',imageStorage:imageStorageStatus()});

 if(route==='/api/admin/settings'&&method==='GET')return json(res,200,{fields:settings.list(),notice:'Salvo no banco privado, refletido imediatamente no servidor. A edição do .env requer reiniciar o servidor; segredos ficam criptografados e não retornam ao navegador.'});
 if(route==='/api/admin/settings'&&method==='PUT'){const x=await body(req);return json(res,200,{fields:await settings.save(x.values,x.clear||[])});}
 if(route==='/api/admin/images'&&method==='POST')return json(res,201,{url:await imageUpload(req)});
 if(route==='/api/admin/integrations/test'&&method==='POST'){
  if(!rate(req,'connect-test',12,900000))return problem(res,429,'Aguarde para testar novamente');
  const provider=str((await body(req)).provider,30);
  if(provider==='vendizap'){const data=await vendizapFetch('categorias?limit=1');return json(res,200,{ok:true,message:'Vendizap respondeu com sucesso; autenticação confirmada.'});}
  if(provider==='melhor-envio'){
   const token=String(conf('MELHOR_ENVIO_TOKEN')||'').trim().replace(/^Bearer\s+/i,'');
   if(!token)return problem(res,400,'Configure o token do Melhor Envio');
   const base=conf('MELHOR_ENVIO_SANDBOX')==='true'?'https://sandbox.melhorenvio.com.br':'https://melhorenvio.com.br';
   // Rota de consulta GET documentada pelo Melhor Envio (sem criar etiquetas).
   const response=await fetch(base+'/api/v2/me/orders',{headers:{'Authorization':'Bearer '+token,'Accept':'application/json','User-Agent':'MAHACH ('+(conf('SHIPPING_CONTACT_EMAIL')||'contato@mahach.com.br')+')'},signal:AbortSignal.timeout(10000)});
   if(response.status===401)return problem(res,502,'Melhor Envio recusou este token (HTTP 401). Confira validade, ambiente e permissoes no Melhor Envio.');
   if(response.status===403)return problem(res,502,'Melhor Envio bloqueou ou negou a consulta de etiquetas (HTTP 403). Verifique as permissoes do token; teste inconclusivo.');
   if(!response.ok)return problem(res,502,'Melhor Envio respondeu HTTP '+response.status+' ao consultar etiquetas.');
   return json(res,200,{ok:true,message:'Melhor Envio autenticou com sucesso na API oficial.'});
  }
  if(provider==='mercado-pago'){
   const token=conf('MERCADO_PAGO_ACCESS_TOKEN');if(!token)return problem(res,400,'Configure o Access Token');
   const response=await fetch('https://api.mercadopago.com/users/me',{headers:{'Authorization':'Bearer '+token,'Accept':'application/json'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)return problem(res,502,'Mercado Pago recusou autenticação (HTTP '+response.status+')');return json(res,200,{ok:true,message:'Credencial Mercado Pago válida. Cobranças ainda não estão ativadas.'});
  }
  if(provider==='email'){
   if(!conf('RESEND_API_KEY')||!conf('MAIL_FROM')||!conf('ADMIN_EMAIL'))return problem(res,400,'Configure API Key, remetente verificado e e-mail da loja');
   const result=await commerce.sendEmail(conf,conf('ADMIN_EMAIL'),'MAHACH · teste de e-mail','<p>A configuração do provedor de e-mail da MAHACH foi testada com sucesso.</p>');
   if(!result.ok)return problem(res,502,result.reason);
   return json(res,200,{ok:true,message:'E-mail de teste aceito pelo provedor. Confirme a chegada na caixa de entrada.'});
  }
  if(provider==='bling')return json(res,200,{ok:false,message:'Bling exige o fluxo OAuth 2.0 e autorização da sua conta; salvar Client ID/Secret não conclui a conexão.'});
  return problem(res,400,'Integração desconhecida');
 }

 if(route==='/api/admin/logout'&&method==='POST'){const t=cookies(req).mahach_session;(await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hash(t)));res.setHeader('Set-Cookie',cookieValue(req,'',0));return json(res,200,{ok:true})}
 if(route==='/api/admin/customers'&&method==='GET'){
  if(!rate(req,'customers',90,60000))return problem(res,429,'Aguarde antes de consultar os clientes');
  const page=Math.max(1,Math.min(10000,Number.parseInt(u.searchParams.get('page'),10)||1));
  const q=str(u.searchParams.get('q'),100).toLowerCase();
  const consent=u.searchParams.get('marketing')==='yes';
  const terms=[],args=[];
  if(q){terms.push('(name ILIKE ? OR email ILIKE ? OR phone ILIKE ?)');args.push('%'+q+'%','%'+q+'%','%'+q+'%')}
  if(consent)terms.push('marketing_opt_in=TRUE');
  const where=terms.length?' WHERE '+terms.join(' AND '):'';
  const count=(await db.prepare('SELECT COUNT(*) n FROM customers'+where).get(...args)).n;
  const rows=await db.prepare('SELECT email,name,phone,marketing_opt_in,marketing_consent_at,first_order_at,last_order_at,last_order_id FROM customers'+where+' ORDER BY last_order_at DESC LIMIT 30 OFFSET ?').all(...args,(page-1)*30);
  return json(res,200,{page,total:count,customers:rows});
 }
 // Administrador pode retirar uma permissão a pedido do cliente, jamais concedê-la.
 const customerOptout=route.match(/^\/api\/admin\/customers\/([^/]+)\/optout$/);
 if(customerOptout&&method==='POST'){
  let email;try{email=decodeURIComponent(customerOptout[1]).toLowerCase()}catch{return problem(res,400,'E-mail inválido')}
  if(email.length>200||!/^\S+@\S+\.\S+$/.test(email))return problem(res,400,'E-mail inválido');
  const x=await db.prepare('UPDATE customers SET marketing_opt_in=FALSE,marketing_consent_at=NULL,updated_at=NOW() WHERE email=?').run(email);
  return x.changes?json(res,200,{ok:true}):problem(res,404,'Cliente não encontrado');
 }
 if(route==='/api/admin/stats'&&method==='GET')return json(res,200,{products:(await db.prepare('SELECT COUNT(*) n FROM products').get()).n,photos:(await db.prepare("SELECT COUNT(*) n FROM products WHERE image<>''").get()).n,orders:(await db.prepare('SELECT COUNT(*) n FROM orders').get()).n,customers:(await db.prepare('SELECT COUNT(*) n FROM customers').get()).n,pending:(await db.prepare("SELECT COUNT(*) n FROM orders WHERE status IN ('pedido_criado','aguardando_confirmacao')").get()).n,outOfStock:(await db.prepare('SELECT COUNT(*) n FROM products WHERE stock=0 AND active=1').get()).n,visible:(await db.prepare('SELECT COUNT(*) n FROM products WHERE active=1').get()).n,categories:(await db.prepare('SELECT COUNT(*) n FROM categories').get()).n,vendizapConfigured:!!(conf('VENDIZAP_ID')&&conf('VENDIZAP_SECRET')),shippingConfigured:!!(conf('MELHOR_ENVIO_TOKEN')&&conf('ORIGIN_CEP')),blingConfigured:!!(conf('BLING_CLIENT_ID')&&conf('BLING_CLIENT_SECRET')),mercadoPagoConfigured:commerce.configured(conf),emailConfigured:!!(conf('RESEND_API_KEY')&&conf('MAIL_FROM')&&conf('ADMIN_EMAIL'))});
 if(route==='/api/admin/import-csv'&&method==='POST'){if(!rate(req,'import',4,3600000))return problem(res,429,'Limite de importações excedido');const raw=await bodyCsv(req);try{return json(res,200,await importIntoPg(db,raw,searchText,secureUrl))}catch(e){return problem(res,400,e.message)}}
 if(route==='/api/admin/products'&&method==='GET'){
 const q=str(u.searchParams.get('q'),100),p=Math.max(1,Math.min(10000,Number(u.searchParams.get('page'))||1));const where=q?'WHERE name ILIKE ? OR brand ILIKE ?':'',args=q?['%'+q+'%','%'+q+'%']:[];
 return json(res,200,{total:(await db.prepare('SELECT COUNT(*) n FROM products '+where).get(...args)).n,products:(await db.prepare('SELECT * FROM products '+where+' ORDER BY name LIMIT 30 OFFSET ?').all(...args,(p-1)*30)),page:p});
 }
 if(route==='/api/admin/products'&&method==='POST'){
 const p=await validProduct(await body(req));p.id='custom-'+crypto.randomBytes(12).toString('hex');(await db.prepare('INSERT INTO products(id,name,price,description,category,brand,family,image,sku,stock,weight,width,height,length,active,search_text) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(p.id,p.name,p.price,p.description,p.category,p.brand,p.family,p.image,p.sku,p.stock,p.weight,p.width,p.height,p.length,p.active,p.search_text));return json(res,201,{id:p.id});
 }
 const edit=route.match(/^\/api\/admin\/products\/([\w-]{5,80})$/);
 // Ocultar sem apagar fisicamente: preserva histórico e referências de pedidos.
 if(edit&&method==='DELETE'){
  const removed=await db.prepare('UPDATE products SET active=0 WHERE id=?').run(edit[1]);
  return removed.changes?json(res,200,{ok:true,archived:true}):problem(res,404,'Produto não encontrado');
 }
 if(edit&&method==='PUT'){
 if(!(await db.prepare('SELECT id FROM products WHERE id=?').get(edit[1])))return problem(res,404,'Produto não encontrado');const p=await validProduct(await body(req));(await db.prepare('UPDATE products SET name=?,price=?,description=?,category=?,brand=?,family=?,image=?,sku=?,stock=?,weight=?,width=?,height=?,length=?,active=?,search_text=? WHERE id=?').run(p.name,p.price,p.description,p.category,p.brand,p.family,p.image,p.sku,p.stock,p.weight,p.width,p.height,p.length,p.active,p.search_text,edit[1]));return json(res,200,{ok:true});
 }
 if(route==='/api/admin/categories'&&method==='GET')return json(res,200,{categories:(await db.prepare('SELECT * FROM categories ORDER BY name').all())});
 if(route==='/api/admin/categories'&&method==='POST'){
 const x=await body(req),name=cleanCategory(str(x.name,90)),subtitle=str(x.subtitle,180),id=str(x.id||name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),64);
 if(!name||!id||!/^[a-z0-9-]{2,64}$/.test(id))return problem(res,400,'Categoria inválida');(await db.prepare('INSERT OR IGNORE INTO categories(id,name,subtitle) VALUES (?,?,?)').run(id,name,subtitle));return json(res,201,{id});
 }
 const catEdit=route.match(/^\/api\/admin\/categories\/([a-z0-9-]{2,64})$/);
 if(catEdit&&method==='PUT'){const x=await body(req),name=cleanCategory(str(x.name,90)),subtitle=str(x.subtitle,180);if(!name)return problem(res,400,'Nome inválido');const result=(await db.prepare('UPDATE categories SET name=?,subtitle=? WHERE id=?').run(name,subtitle,catEdit[1]));return result.changes?json(res,200,{ok:true}):problem(res,404,'Categoria não encontrada')}
 if(catEdit&&method==='DELETE'){
  if((await db.prepare('SELECT COUNT(*) n FROM products WHERE category=?').get(catEdit[1])).n)return problem(res,409,'Mova os produtos para outra categoria antes de excluir');
  if(['perfumes','corpo','beleza'].includes(catEdit[1]))return problem(res,409,'Categoria principal protegida');
  const result=(await db.prepare('DELETE FROM categories WHERE id=?').run(catEdit[1]));return result.changes?json(res,200,{ok:true}):problem(res,404,'Categoria não encontrada');
 }
 if(route==='/api/admin/orders'&&method==='GET')return json(res,200,{orders:(await db.prepare('SELECT * FROM orders ORDER BY created DESC LIMIT 100').all()).map(x=>({...x,whatsapp_tracking:x.delivery==='correios'&&x.tracking_code?'https://wa.me/55'+x.phone.replace(/^55/,'')+'?text='+encodeURIComponent('Olá, '+x.customer_name+'! Código dos Correios para o pedido '+x.id+': '+x.tracking_code+'. Rastreie em https://rastreamento.correios.com.br/app/index.php'):'',items:JSON.parse(x.items_json),items_json:undefined,public_token_hash:undefined}))});
 const mailRetry=route.match(/^\/api\/admin\/orders\/(MH-[A-Z0-9]+)\/notify$/);
 if(mailRetry&&method==='POST'){
  const o=(await db.prepare('SELECT * FROM orders WHERE id=?').get(mailRetry[1]));if(!o)return problem(res,404,'Pedido não encontrado');
  if(!conf('RESEND_API_KEY')||!conf('MAIL_FROM'))return problem(res,503,'Configure o serviço de e-mails no painel antes de reenviar');
  const results={};
  if(o.payment_status==='aprovado')results.purchase=await sendTransactional(o.id,'approved');
  else if(o.payment==='cash')results.receipt=await sendTransactional(o.id,'created');
  if(o.delivery==='correios'&&o.tracking_code)results.tracking=await sendTransactional(o.id,'tracking');
  return json(res,200,{ok:true,results});
 }
 const orderEdit=route.match(/^\/api\/admin\/orders\/(MH-[A-Z0-9]+)$/);
 if(orderEdit&&method==='PUT'){
 const x=await body(req),status=str(x.status,40),tracking_code=str(x.tracking_code,100),tracking_url=secureUrl(str(x.tracking_url,1500));if(!['pedido_criado','aguardando_confirmacao','pagamento_aprovado','estoque_pendente','em_preparacao','enviado','pronto_retirada','concluido','cancelado'].includes(status))return problem(res,400,'Status inválido');const old=(await db.prepare('SELECT delivery,payment,payment_status,tracking_code FROM orders WHERE id=?').get(orderEdit[1]));if(!old)return problem(res,404,'Pedido não encontrado');
 if(['pix','card'].includes(old.payment)&&status==='pagamento_aprovado'&&old.payment_status!=='aprovado')return problem(res,409,'Pagamento online deve ser aprovado pelo Mercado Pago, nunca manualmente');
 const changed=old.tracking_code!==tracking_code;
 (await db.prepare("UPDATE orders SET status=?,tracking_code=?,tracking_url=?,payment_status=CASE WHEN ?='pagamento_aprovado' AND payment='cash' THEN 'aprovado' ELSE payment_status END,tracking_email_sent=CASE WHEN tracking_code<>? THEN 0 ELSE tracking_email_sent END WHERE id=?").run(status,tracking_code,tracking_url,status,tracking_code,orderEdit[1]));
 const mail=old.delivery==='correios'&&tracking_code&&changed&&['em_preparacao','enviado','concluido'].includes(status)?await sendTransactional(orderEdit[1],'tracking'):{};
 return json(res,200,{ok:true,email:mail});
 }
 if(route==='/api/admin/bling/preview'&&method==='GET'){
 const skuById=new Map((await db.prepare('SELECT id,sku FROM products').all()).map(p=>[p.id,p.sku]));
 const all=(await db.prepare("SELECT * FROM orders WHERE (status IN ('pagamento_aprovado','em_preparacao','enviado','pronto_retirada','concluido') OR payment_status='aprovado') AND bling_export_status='nao_enviado' ORDER BY created LIMIT 100").all());
 return json(res,200,{configured:!!(conf('BLING_CLIENT_ID')&&conf('BLING_CLIENT_SECRET')),
 orders:all.map(o=>({reference:o.id,customer:o.customer_name,shipping:o.shipping_service,items:JSON.parse(o.items_json).map(i=>({sku:skuById.get(i.id)||'',description:i.name,quantity:i.qty,price:i.unit_price})),status:'AGUARDANDO_CONEXAO_E_REVISAO'})),
 notice:'Prévia apenas. Nada é enviado ao Bling, nem são emitidas notas ou baixado estoque sem autorização OAuth, mapeamento de SKUs e validação fiscal.'});
 }
 if(route==='/api/admin/sync-vendizap'&&method==='POST'){if(!rate(req,'sync',3,3600000))return problem(res,429,'Limite de sincronizações atingido');return json(res,200,await syncVendizap())}
 return problem(res,404,'Rota não encontrada');
 }
 return problem(res,404,'Rota não encontrada');
}
const server=http.createServer(async(req,res)=>{
 security(res);
 if(!rate(req,'general',800,60000))return problem(res,429,'Limite de requisições');
 try{await ready;const u=new URL(req.url,'http://localhost');if(u.pathname.startsWith('/api/'))await api(req,res,u);else if(['GET','HEAD'].includes(req.method))await staticFile(req,res,u);else problem(res,405,'Método não permitido')}catch(e){if(process.env.NODE_ENV!=='production'&&!e.status)console.error(e);problem(res,e.status||500,e.status?e.message:'Erro interno. Tente novamente.')}
});
if(require.main===module){ready.then(()=>server.listen(Number(process.env.PORT)||3000,process.env.HOST||'0.0.0.0',()=>console.log('MAHACH PostgreSQL iniciado na porta '+(process.env.PORT||3000)))).catch(e=>{console.error('Falha na inicialização PostgreSQL:',e.message);process.exitCode=1;db.close().catch(()=>{})})}
module.exports={server,db,ready,searchText};
