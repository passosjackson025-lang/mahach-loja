'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let csrf='',page=1,categories=[];
function say(s){if($('#appMessage'))$('#appMessage').textContent=s}
async function api(url,method='GET',data){const opts={method,credentials:'same-origin',headers:{}};if(method!=='GET')opts.headers['X-CSRF-Token']=csrf;if(data!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(data)}const r=await fetch(url,opts),v=await r.json();if(!r.ok)throw Error(v.error||'Erro de conexão');return v}
function elem(tag,text,cls){const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x}
async function init(){try{const s=await api('/api/admin/session');if($('#loginForm')){if(s.authenticated)location.replace('/admin/painel.html');return}if(!s.authenticated){location.replace('/admin');return}csrf=s.csrf;$('#adminEmail').textContent=s.email;await stats();await showAdminCapabilities()}catch(e){if(!$('#loginForm'))location.replace('/admin')}}
$('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/login','POST',Object.fromEntries(new FormData(e.target)));location.href='/admin/painel.html'}catch(err){$('#loginError').textContent=err.message}});
$('#logout')?.addEventListener('click',async()=>{try{await api('/api/admin/logout','POST',{})}finally{location.href='/admin'}});
const tabs={overview:'Dashboard',products:'Produtos',categories:'Categorias',orders:'Pedidos',customers:'Clientes',integrations:'Configurações'};
$$('[data-tab]').forEach(b=>b.onclick=async()=>{const t=b.dataset.tab;$$('[data-tab]').forEach(x=>x.classList.toggle('nav-active',x===b));for(const k of Object.keys(tabs))$('#'+k+'Tab').hidden=k!==t;$('#panelTitle').textContent=tabs[t];say('');try{if(t==='overview'||t==='integrations')await stats();if(t==='integrations')await loadSettings();if(t==='products')await listProducts();if(t==='categories')await listCategories();if(t==='orders')await listOrders();if(t==='customers')await listCustomers()}catch(e){say(e.message)}});
async function stats(){const x=await api('/api/admin/stats');if($('#stats'))$('#stats').replaceChildren(...[['Produtos',x.products],['Publicados',x.visible],['Com fotos',x.photos],['Sem estoque',x.outOfStock],['Clientes',x.customers]].map(([name,n])=>{const r=elem('div',undefined,'stat');r.append(elem('strong',String(n)),elem('span',name));return r}));if($('#dashboardSummary'))$('#dashboardSummary').textContent=x.products?'Seu catálogo está atualizado.':'Seu catálogo está vazio. Comece cadastrando seu primeiro produto.';if($('#integrationsStatus')){const status=await api('/api/store/status');$('#integrationsStatus').replaceChildren(elem('div','Mercado Pago: '+(status.paymentReady?'autenticado':x.mercadoPagoConfigured?'credenciais salvas; verificar conexão':'configuração pendente'),'integration-status'),elem('div','Checkout: '+(status.checkoutEnabled?'habilitado':'indisponível no momento'),'integration-status'),elem('div','Frete: '+(x.shippingConfigured?'configurado':'configuração pendente'),'integration-status'),elem('div','E-mails: '+(x.emailConfigured?'configurados':'configuração pendente'),'integration-status'))}if($('#overviewTab')&&!$('#overviewTab').hidden)await loadDashboard()}
async function showAdminCapabilities(){
 const x=await api('/api/admin/capabilities');let text=x.writes?'Edições habilitadas neste banco.':'Painel em modo leitura: edições e fotos não serão salvas.';
 text+=' '+({local:'Fotos salvas SOMENTE no computador; na Render configure Cloudinary.',cloudinary:'Fotos armazenadas online na Cloudinary.',unavailable:'Upload de fotos indisponível na hospedagem até configurar Cloudinary.',incomplete:'Cloudinary incompleto: revise as três variáveis de ambiente.'}[x.imageStorage]||'');
 const header=$('.admin-top');let banner=$('#adminCapabilities');
 if(!banner){banner=elem('p',undefined,'admin-capabilities');banner.id='adminCapabilities';header?.appendChild(banner)}
 banner.textContent=text;
}
let timeout;
$('#adminSearch')?.addEventListener('input',()=>{clearTimeout(timeout);timeout=setTimeout(()=>{page=1;listProducts()},300)});
async function listProducts(){const res=await api('/api/admin/products?'+new URLSearchParams({page,q:$('#adminSearch').value,stock:$('#stockFilter').value}));$('#adminResults').textContent=res.total+' '+(res.total===1?'produto':'produtos');$('#adminProductList').replaceChildren(...res.products.map(p=>{const r=elem('article',undefined,'admin-record'),i=elem('img'),inf=elem('div',undefined,'info'),btn=elem('button','Editar');i.src=p.image||'/assets/produto-sem-foto.svg';i.alt='';inf.append(elem('strong',p.name),elem('small',`${p.brand} · SKU: ${p.sku||'—'} · ${p.category} · R$ ${Number(p.price||0).toFixed(2)}${p.active?'':' · OCULTO'} · ${p.stock===null?'Estoque não informado':p.stock===0?'Esgotado':p.stock<=5?'Estoque baixo: '+p.stock:p.stock+' unidades'}`));btn.onclick=()=>editProduct(p);
 r.append(i,inf,btn);
 if(p.active){const hide=elem('button','Ocultar');hide.className='button-danger';hide.onclick=async()=>{
  if(!confirm('Ocultar '+p.name+' da loja? Você poderá reativar pelo botão Editar.'))return;
  hide.disabled=true;try{await api('/api/admin/products/'+p.id,'DELETE',{});say('Produto ocultado.');await listProducts();await stats()}
  catch(e){say(e.message);hide.disabled=false}
 };r.append(hide)}
 return r}));if(!res.products.length)$('#adminProductList').append(elem('p','Nenhum produto encontrado. Cadastre um produto ou ajuste a busca.','empty-panel'));const prev=elem('button','← Anterior'),next=elem('button','Próxima →');prev.disabled=page===1;next.disabled=page*30>=res.total;prev.onclick=()=>{page--;listProducts()};next.onclick=()=>{page++;listProducts()};$('#adminPagination').replaceChildren(prev,elem('span','Página '+page),next)}
async function listCategories(){const r=await api('/api/admin/categories');categories=r.categories;$('#categoryList').replaceChildren(...categories.map(c=>{const a=elem('article',undefined,'admin-record'),inf=elem('div',undefined,'info'),btn=elem('button','Editar');inf.append(elem('strong',c.name),elem('small',c.subtitle));btn.onclick=async()=>{const name=prompt('Nome da categoria',c.name);if(name===null)return;const subtitle=prompt('Descrição',c.subtitle);if(subtitle===null)return;try{await api('/api/admin/categories/'+c.id,'PUT',{name,subtitle});say('Categoria atualizada');await listCategories()}catch(e){say(e.message)}};const del=elem('button','Excluir');del.className='button-danger';del.disabled=['perfumes','corpo','beleza'].includes(c.id);del.onclick=async()=>{if(!confirm('Excluir a categoria '+c.name+'? Só funciona se não houver produtos vinculados.'))return;try{await api('/api/admin/categories/'+c.id,'DELETE',{});say('Categoria excluída');await listCategories()}catch(e){say(e.message)}};a.append(inf,btn,del);return a}))}
$('#newCategory')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/categories','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();say('Categoria adicionada');await listCategories()}catch(x){say(x.message)}});
async function editProduct(p){if(!categories.length){const x=await api('/api/admin/categories');categories=x.categories}const f=$('#productForm');f.reset();f.elements.category.replaceChildren(...categories.map(c=>{const o=elem('option',c.name);o.value=c.id;return o}));$('#editTitle').textContent=p?'Editar produto':'Novo produto';if(p)for(const k of ['id','name','price','description','category','audience','brand','image','sku','stock','weight','width','height','length'])f.elements.namedItem(k).value=p[k]??'';else f.elements.id.value='';f.elements.active.checked=p?!!p.active:true;$('#photoFile').value='';$('#photoStatus').textContent='';$('#photoPreview').src=p?.image||'/assets/produto-sem-foto.svg';$('#editDialog').showModal()}
$('#dashboardNewProduct')?.addEventListener('click',()=>{$('[data-tab=products]').click();editProduct(null)});
$('#stockFilter')?.addEventListener('change',()=>{page=1;listProducts().catch(e=>say(e.message))});
$('#newProduct')?.addEventListener('click',()=>editProduct(null));$('#cancelEdit')?.addEventListener('click',()=>$('#editDialog').close());$('#closeEdit')?.addEventListener('click',()=>$('#editDialog').close());
function readPicture(file){return new Promise((resolve,reject)=>{const img=new Image();const url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Não foi possível abrir a foto.'))};img.src=url})}
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>14*1024*1024)throw Error('Escolha uma foto JPG, PNG ou WebP de até 14 MB');
 const img=await readPicture(file),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1200,1200);
 const ratio=Math.min(1100/img.naturalWidth,1100/img.naturalHeight);const w=Math.round(img.naturalWidth*ratio),h=Math.round(img.naturalHeight*ratio);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,Math.round((1200-w)/2),Math.round((1200-h)/2),w,h);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.9));if(!blob||blob.type!=='image/webp'||blob.size>4*1024*1024)throw Error('Falha ao converter imagem. Tente uma foto menor.');return blob;
}
$('#photoFile')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const preview=URL.createObjectURL(file);$('#photoPreview').src=preview;$('#photoPreview').onload=()=>URL.revokeObjectURL(preview);$('#photoStatus').textContent='Pronta para enviar ao salvar.'}catch(err){$('#photoStatus').textContent=err.message}});
$('#productForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f)),id=d.id;d.active=f.elements.active.checked;
 const btn=f.querySelector('[type="submit"]');btn.disabled=true;
 try{
  const file=$('#photoFile').files[0];if(file){$('#photoStatus').textContent='Convertendo e enviando foto…';const blob=await preparePhoto(file);const r=await fetch('/api/admin/images',{method:'POST',headers:{'Content-Type':'image/webp','X-CSRF-Token':csrf},credentials:'same-origin',body:blob});const result=await r.json();if(!r.ok)throw Error(result.error||'Falha ao enviar foto');d.image=result.url;$('#photoStatus').textContent='Foto enviada!'}
  await api('/api/admin/products'+(id?'/'+id:''),id?'PUT':'POST',d);$('#photoStatus').textContent='Imagem e dados gravados no banco.';$('#editDialog').close();say('Produto salvo com sucesso.');await listProducts();await stats();
 }catch(x){say(x.message);$('#photoStatus').textContent=x.message}finally{btn.disabled=false}
});
const statusLabels={pedido_criado:'Pedido recebido',aguardando_confirmacao:'Aguardando confirmação',pagamento_aprovado:'Pagamento aprovado',estoque_pendente:'Conferir estoque',em_preparacao:'Em preparação',enviado:'Enviado',pronto_retirada:'Pronto para retirada',concluido:'Concluído',cancelado:'Cancelado'};
let orderPage=1,orderTimer,orderRequest=0;
async function listOrders(){
 const request=++orderRequest;const {orders,total,limit}=await api('/api/admin/orders?'+new URLSearchParams({q:$('#orderSearch').value.trim(),page:String(orderPage),status:$('#orderStatusFilter').value,paymentStatus:$('#orderPaymentFilter').value}));if(request!==orderRequest)return;
 $('#orderCount').textContent=total+' '+(total===1?'pedido encontrado':'pedidos encontrados');
 $('#ordersList').replaceChildren(...orders.map(o=>{
  const r=elem('article',undefined,'order-record'),head=elem('div',undefined,'order-record-head'),title=elem('div');title.append(elem('strong',o.id),elem('small',new Date(o.created).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})));head.append(title,elem('span',statusLabels[o.status]||o.status,'status-pill'));r.append(head);
  const contact=elem('div',undefined,'order-contact');contact.append(elem('strong',o.customer_name),elem('span',o.customer_email||'Sem e-mail'),elem('span',o.phone||''));r.append(contact);
  const state=elem('div',undefined,'order-state');const prep=['enviado','pronto_retirada','concluido'].includes(o.status)?'Finalizada':statusLabels[o.status]||o.status;const shipping=o.status==='concluido'?'Concluída':o.status==='enviado'?'Enviado':o.status==='pronto_retirada'?'Pronto para retirada':o.status==='cancelado'?'Cancelada':o.delivery==='pickup'?'Retirada na loja':'Aguardando envio';
  for(const [label,value]of [['Pagamento',o.payment_status==='aprovado'?'Aprovado':o.payment_status||'Pendente'],['Preparação',prep],['Entrega',shipping]]){const x=elem('div');x.append(elem('small',label),elem('strong',value));state.append(x)}r.append(state);
  const details=elem('details',undefined,'order-expand');details.append(elem('summary','Produtos, valores e endereço'));const items=elem('div',undefined,'order-items');for(const item of o.items){const line=elem('p');line.append(elem('span',item.qty+' × '+item.name),elem('strong',brl(Number(item.unit_price)*item.qty)));items.append(line)}
  details.append(items,elem('p','Produtos: '+brl(o.subtotal)+' · Frete: '+(o.shipping_cost===null?'A combinar':brl(o.shipping_cost))+' · Total: '+brl(Number(o.subtotal)+Number(o.shipping_cost||0))),elem('p','Entrega: '+(o.shipping_service||o.delivery)),elem('p',o.delivery==='pickup'?'Retirada na loja':(o.address||'Endereço não informado')+' · CEP '+(o.cep||'—')));r.append(details);
  const fields=elem('div',undefined,'order-fields'),sel=elem('select'),code=elem('input'),url=elem('input');for(const [key,label]of Object.entries(statusLabels)){const opt=elem('option',label);opt.value=key;opt.selected=o.status===key;sel.append(opt)}code.value=o.tracking_code||'';code.maxLength=100;url.value=o.tracking_url||'';url.type='url';url.placeholder='https://…';
  for(const [label,input]of [['Andamento do pedido',sel],['Código de rastreamento',code],['Link de rastreamento',url]]){const wrap=elem('label',label);wrap.append(input);fields.append(wrap)}
  const b=elem('button','Salvar andamento'),result=elem('p');result.setAttribute('role','status');b.onclick=async()=>{b.disabled=true;try{await api('/api/admin/orders/'+o.id,'PUT',{status:sel.value,tracking_code:code.value,tracking_url:url.value});say('Pedido '+o.id+' atualizado.');await listOrders()}catch(e){result.textContent=e.message}finally{b.disabled=false}};fields.append(b);r.append(fields,result);return r;
 }));if(!orders.length)$('#ordersList').append(elem('p','Nenhum pedido encontrado. Confira o código ou ajuste os filtros.','empty-panel'));
 const prev=elem('button','← Anterior'),next=elem('button','Próxima →');prev.disabled=orderPage===1;next.disabled=orderPage*limit>=total;prev.onclick=()=>{orderPage--;listOrders().catch(e=>say(e.message))};next.onclick=()=>{orderPage++;listOrders().catch(e=>say(e.message))};$('#ordersPagination').replaceChildren(prev,elem('span','Página '+orderPage),next);
}
if($('#orderStatusFilter'))for(const [key,label]of Object.entries(statusLabels)){const option=elem('option',label);option.value=key;$('#orderStatusFilter').append(option)}
function searchOrders(){orderPage=1;listOrders().catch(e=>say(e.message))}
$('#ordersFilters')?.addEventListener('submit',e=>{e.preventDefault();clearTimeout(orderTimer);searchOrders()});$('#orderSearch')?.addEventListener('input',()=>{clearTimeout(orderTimer);orderTimer=setTimeout(searchOrders,300)});for(const id of ['orderStatusFilter','orderPaymentFilter'])$('#'+id)?.addEventListener('change',searchOrders);
$('#csvImportForm')?.addEventListener('submit',async e=>{e.preventDefault();const file=$('#catalogFile').files[0];if(!file)return;
 const out=$('#csvImportResult');if(file.size>8*1024*1024){out.textContent='Arquivo maior que 8MB';return}
 const btn=e.target.querySelector('button');btn.disabled=true;out.textContent='Importando...';
 try{const result=await fetch('/api/admin/import-csv',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'text/csv; charset=utf-8','X-CSRF-Token':csrf},body:await file.text()});const r=await result.json();if(!result.ok)throw Error(r.error||'Falha');out.textContent=`${r.inserted} novos, ${r.updated} atualizados, ${r.newCategories} categorias criadas, ${r.skipped} ignorados.`;await listProducts();await stats()}catch(err){out.textContent=err.message}finally{btn.disabled=false}
});
// Configurações persistentes: campos secretos só retornam indicadores, nunca o valor.
const SECTIONS={'loja':'Loja e retirada','melhor-envio':'Melhor Envio — Transportadoras','mercado-pago':'Mercado Pago — Pix e cartão','email':'E-mails transacionais — Resend'};
let settingsSnapshot=[];
async function loadSettings(){
 const {fields}=await api('/api/admin/settings');settingsSnapshot=fields;
 const root=$('#settingsFields');root.replaceChildren();
 for(const [section,label]of Object.entries(SECTIONS)){
  const box=elem('fieldset',undefined,'settings-group'),legend=elem('legend',label),grid=elem('div',undefined,'settings-grid');box.append(legend);
  for(const field of fields.filter(x=>x.section===section)){
   const wrap=elem('label',undefined,'setting-field'),title=elem('span',field.label),input=elem('input');
   input.dataset.configKey=field.key;input.maxLength=field.key==='MELHOR_ENVIO_TOKEN'?8192:1500;
   if(field.kind==='secret'){input.type='password';input.autocomplete='new-password';input.placeholder=field.configured?'Credencial salva · deixe vazio para manter':'Cole sua credencial';}
   else{input.type='text';input.value=field.value||'';if(field.kind==='bool')input.placeholder='true / false';if(field.kind==='cep')input.inputMode='numeric'}
   wrap.append(title,input);
   if(field.source==='ambiente'){input.readOnly=true;input.dataset.environment='true'}const meta=elem('small',field.source==='ambiente'?'Definido no ambiente · prioridade sobre o painel':field.configured?'Configurado no painel':'Não configurado');wrap.append(meta);
   if(field.hasStoredOverride){const clear=elem('label',undefined,'setting-clear'),check=elem('input');check.type='checkbox';check.dataset.clearKey=field.key;clear.append(check,document.createTextNode('Remover valor salvo no painel'));wrap.append(clear)}
   grid.append(wrap);
  }
  box.append(grid);root.append(box);
 }
 const tests=$('#integrationTests');tests.replaceChildren();
 for(const [p,n]of [['melhor-envio','Testar frete'],['mercado-pago','Verificar Mercado Pago']]){
  const b=elem('button',n);b.type='button';b.onclick=async()=>{b.disabled=true;$('#connectionTestResult').textContent='Verificando conexão…';try{const r=await api('/api/admin/integrations/test','POST',{provider:p});$('#connectionTestResult').textContent=r.message}catch(e){$('#connectionTestResult').textContent=e.message}finally{b.disabled=false}};tests.append(b)
 }
}
$('#settingsForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('#saveSettings'),out=$('#settingsResult');btn.disabled=true;out.textContent='Salvando…';
 try{const values={},clear=[];for(const el of $$('[data-config-key]'))if(!el.dataset.environment)values[el.dataset.configKey]=el.value;
  for(const el of $$('[data-clear-key]'))if(el.checked)clear.push(el.dataset.clearKey);
  await api('/api/admin/settings','PUT',{values,clear});out.textContent='Configurações salvas. Valores do ambiente continuam com prioridade.';await loadSettings();await stats();
 }catch(err){out.textContent=err.message}finally{btn.disabled=false}
});

init();

// Clientes: acesso somente com sessão de administrador; nunca há endpoint público de listagem.
let customerPage=1,customerTimer;
$('#customerSearch')?.addEventListener('input',()=>{clearTimeout(customerTimer);customerTimer=setTimeout(()=>{customerPage=1;listCustomers().catch(e=>say(e.message))},280)});
$('#customersMarketingOnly')?.addEventListener('change',()=>{customerPage=1;listCustomers().catch(e=>say(e.message))});
async function listCustomers(){
 const filters=new URLSearchParams({page:String(customerPage),q:$('#customerSearch').value.trim()});
 if($('#customersMarketingOnly').checked)filters.set('marketing','yes');
 const result=await api('/api/admin/customers?'+filters);
 $('#customerCount').textContent=result.total+' clientes encontrados';
 const records=result.customers.map(c=>{
  const a=elem('article',undefined,'admin-record customer-record'),info=elem('div',undefined,'info');
  info.append(elem('strong',c.name),elem('small',c.email),elem('small','Telefone: '+c.phone));
  info.append(elem('small','Último pedido: '+(c.last_order_id||'—')));
  const consent=elem('div',c.marketing_opt_in?'Autorizou ofertas':'Sem autorização para ofertas','customer-consent');
  a.append(info,consent);
  if(c.marketing_opt_in){
   const b=elem('button','Retirar autorização');b.className='button-danger';
   b.onclick=async()=>{if(!confirm('Retirar autorização de marketing deste cliente?'))return;
    b.disabled=true;try{await api('/api/admin/customers/'+encodeURIComponent(c.email)+'/optout','POST',{});say('Autorização retirada.');await listCustomers()}
    catch(e){say(e.message);b.disabled=false}};a.append(b);
  }
  return a;
 });
 $('#customersList').replaceChildren(...records);
 if(!records.length)$('#customersList').textContent='Nenhum cliente encontrado.';
 const prev=elem('button','← Anterior'),next=elem('button','Próxima →');
 prev.disabled=customerPage<=1;next.disabled=customerPage*30>=result.total;
 prev.onclick=()=>{customerPage--;listCustomers().catch(e=>say(e.message))};
 next.onclick=()=>{customerPage++;listCustomers().catch(e=>say(e.message))};
 $('#customersPagination').replaceChildren(prev,elem('span','Página '+customerPage),next);
}

function brl(value){return Number(value||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function setDashboardDates(){const end=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),period=$('#dashboardPeriod').value;if(period==='custom')return;$('#dashboardTo').value=end;$('#dashboardFrom').value=new Date(Date.parse(end+'T12:00:00Z')-(period==='today'?0:Number(period)-1)*86400000).toISOString().slice(0,10)}
$('#dashboardPeriod')?.addEventListener('change',()=>{setDashboardDates();if($('#dashboardPeriod').value!=='custom')loadDashboard().catch(e=>say(e.message))});
for(const id of ['dashboardFrom','dashboardTo'])$('#'+id)?.addEventListener('change',()=>$('#dashboardPeriod').value='custom');
$('#dashboardFilters')?.addEventListener('submit',e=>{e.preventDefault();loadDashboard().catch(e=>say(e.message))});
$('#viewLowStock')?.addEventListener('click',()=>{$('#stockFilter').value='low';$('[data-tab=products]').click()});
if($('#dashboardFrom'))setDashboardDates();
let dashboardRequest=0;
async function loadDashboard(){
 const request=++dashboardRequest;const x=await api('/api/admin/dashboard?'+new URLSearchParams({from:$('#dashboardFrom').value,to:$('#dashboardTo').value}));if(request!==dashboardRequest)return;
 $('#dashboardMetrics').replaceChildren(...[['Vendas pagas',brl(x.summary.revenue),x.summary.paid_orders+' pedidos aprovados'],['Pedidos',String(x.summary.orders),'Recebidos no período'],['Ticket médio',brl(x.summary.average_order),'Por pedido aprovado'],['Aguardando envio',String(x.summary.awaiting_shipment),'Pagos · entrega pendente']].map(([label,value,hint])=>{const box=elem('article',undefined,'metric');box.append(elem('span',label),elem('strong',value),elem('small',hint));return box}));
 const sales=$('#salesChart');sales.replaceChildren();if(!x.summary.paid_orders)sales.append(elem('p','Quando houver pagamentos aprovados, suas vendas aparecerão aqui.','empty-panel'));else{
  const values=x.daily.map(d=>Number(d.revenue)),max=Math.max(...values,1),width=Math.max(260,Math.min(760,sales.clientWidth||760)),height=210,left=64,top=16,bottom=176;const points=values.map((value,i)=>[left+i*(width-left-18)/Math.max(1,values.length-1),bottom-value/max*(bottom-top)]);const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label','Vendas diárias de '+x.from+' até '+x.to+', total '+brl(x.summary.revenue));svg.classList.add('sales-plot');
  for(const fraction of [0,.5,1]){const y=bottom-fraction*(bottom-top),line=document.createElementNS(ns,'line');for(const [k,v]of Object.entries({x1:left,x2:width-18,y1:y,y2:y}))line.setAttribute(k,String(v));line.classList.add('chart-grid');svg.append(line);const text=document.createElementNS(ns,'text');text.setAttribute('x','0');text.setAttribute('y',String(y+4));text.textContent=(max*fraction).toLocaleString('pt-BR',{maximumFractionDigits:0});svg.append(text)}
  const path=document.createElementNS(ns,'polyline');path.setAttribute('points',points.map(p=>p.join(',')).join(' '));path.classList.add('chart-line');svg.append(path);for(const [i,label]of [[0,x.from],[values.length-1,x.to]]){const t=document.createElementNS(ns,'text');t.setAttribute('x',String(i===0?left:width-18));t.setAttribute('y','202');t.setAttribute('text-anchor',i===0?'start':'end');t.textContent=label.split('-').reverse().join('/');svg.append(t)}sales.append(svg);
  const details=elem('details',undefined,'chart-data');details.append(elem('summary','Consultar valores por dia'));const rows=elem('div');for(const d of x.daily){if(!d.orders)continue;rows.append(elem('p',d.day.split('-').reverse().join('/')+' · '+brl(d.revenue)+' · '+d.orders+' pedidos'))}details.append(rows);sales.append(details);
 }
 function bars(container,rows,empty){container.replaceChildren();if(!rows.length){container.append(elem('p',empty,'empty-panel'));return}const max=Math.max(...rows.map(r=>r.value),1);for(const row of rows){const item=elem('div',undefined,'bar-row'),caption=elem('div'),bar=elem('div',undefined,'bar-track'),fill=elem('span');caption.append(elem('span',row.label),elem('strong',String(row.value)));fill.style.width=Math.max(2,row.value/max*100)+'%';bar.append(fill);item.append(caption,bar);container.append(item)}}
 bars($('#statusChart'),x.statuses.map(s=>({label:statusLabels[s.status]||s.status,value:s.count})),'Nenhum pedido neste período.');bars($('#topProductsChart'),x.topProducts.map(p=>({label:p.name,value:p.quantity})),'Os produtos mais vendidos aparecerão após as primeiras vendas pagas.');
 $('#recentOrders').replaceChildren(...x.recent.map(o=>{const b=elem('button',undefined,'recent-order');b.append(elem('strong',o.id),elem('span',o.customer_name),elem('small',statusLabels[o.status]||o.status));b.onclick=()=>{$('#orderSearch').value=o.id;orderPage=1;$('[data-tab=orders]').click()};return b}));if(!x.recent.length)$('#recentOrders').append(elem('p','Nenhum pedido neste período.','empty-panel'));
 $('#lowStockList').replaceChildren(...x.lowStock.map(p=>{const row=elem('div',undefined,'stock-alert');row.append(elem('span',p.name),elem('strong',p.stock===0?'Esgotado':p.stock+' unidades'));return row}));if(!x.lowStock.length)$('#lowStockList').append(elem('p',x.inventory.products?'Nenhum alerta de estoque.':'Cadastre os produtos para acompanhar o estoque.','empty-panel'));if(x.inventory.unknown_stock)$('#lowStockList').append(elem('p',x.inventory.unknown_stock+' produtos sem estoque informado.','admin-help'));
}
