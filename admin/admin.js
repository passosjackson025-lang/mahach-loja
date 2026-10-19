'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];let csrf='',page=1,categories=[];
function say(s){if($('#appMessage'))$('#appMessage').textContent=s}
async function api(url,method='GET',data){const opts={method,credentials:'same-origin',headers:{}};if(method!=='GET')opts.headers['X-CSRF-Token']=csrf;if(data!==undefined){opts.headers['Content-Type']='application/json';opts.body=JSON.stringify(data)}const r=await fetch(url,opts),v=await r.json();if(!r.ok)throw Error(v.error||'Erro de conexão');return v}
function elem(tag,text,cls){const x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x}
async function init(){try{const s=await api('/api/admin/session');if($('#loginForm')){if(s.authenticated)location.replace('/admin/painel.html');return}if(!s.authenticated){location.replace('/admin');return}csrf=s.csrf;$('#adminEmail').textContent=s.email;await stats();await showAdminCapabilities()}catch(e){if(!$('#loginForm'))location.replace('/admin')}}
$('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/login','POST',Object.fromEntries(new FormData(e.target)));location.href='/admin/painel.html'}catch(err){$('#loginError').textContent=err.message}});
$('#logout')?.addEventListener('click',async()=>{try{await api('/api/admin/logout','POST',{})}finally{location.href='/admin'}});
const tabs={overview:'Visão geral',products:'Produtos',categories:'Categorias',orders:'Pedidos',customers:'Clientes',integrations:'Integrações'};
$$('[data-tab]').forEach(b=>b.onclick=async()=>{const t=b.dataset.tab;$$('[data-tab]').forEach(x=>x.classList.toggle('nav-active',x===b));for(const k of Object.keys(tabs))$('#'+k+'Tab').hidden=k!==t;$('#panelTitle').textContent=tabs[t];say('');try{if(t==='overview'||t==='integrations')await stats();if(t==='integrations')await loadSettings();if(t==='products')await listProducts();if(t==='categories')await listCategories();if(t==='orders')await listOrders();if(t==='customers')await listCustomers()}catch(e){say(e.message)}});
async function stats(){const x=await api('/api/admin/stats');if($('#stats')){$('#stats').replaceChildren(...[['Produtos',x.products],['Publicados',x.visible],['Com fotos',x.photos],['Sem estoque',x.outOfStock],['Categorias',x.categories],['Pedidos',x.orders],['Clientes',x.customers],['Pendentes',x.pending]].map(([name,n])=>{const r=elem('div',undefined,'stat');r.append(elem('strong',String(n)),elem('span',name));return r}))}if($('#dashboardSummary'))$('#dashboardSummary').textContent=x.photos+' de '+x.products+' produtos com foto cadastrada. '+x.pending+' solicitações aguardam atendimento.';if($('#integrationsStatus'))$('#integrationsStatus').replaceChildren(elem('div','Vendizap: '+(x.vendizapConfigured?'configurada':'aguardando credenciais'),'integration-status'),elem('div','Melhor Envio: '+(x.shippingConfigured?'configurado':'aguardando token/CEP'),'integration-status'),elem('div','Bling: '+(x.blingConfigured?'credenciais previstas (OAuth pendente)':'aguardando credenciais'),'integration-status'))}
async function showAdminCapabilities(){
 const x=await api('/api/admin/capabilities');let text=x.writes?'Edições habilitadas neste banco.':'Painel em modo leitura: edições e fotos não serão salvas.';
 text+=' '+({local:'Fotos salvas SOMENTE no computador; na Render configure Cloudinary.',cloudinary:'Fotos armazenadas online na Cloudinary.',unavailable:'Upload de fotos indisponível na hospedagem até configurar Cloudinary.',incomplete:'Cloudinary incompleto: revise as três variáveis de ambiente.'}[x.imageStorage]||'');
 const header=$('.admin-top');let banner=$('#adminCapabilities');
 if(!banner){banner=elem('p',undefined,'admin-capabilities');banner.id='adminCapabilities';header?.appendChild(banner)}
 banner.textContent=text;
}
let timeout;
$('#adminSearch')?.addEventListener('input',()=>{clearTimeout(timeout);timeout=setTimeout(()=>{page=1;listProducts()},300)});
async function listProducts(){const res=await api('/api/admin/products?'+new URLSearchParams({page,q:$('#adminSearch').value}));$('#adminResults').textContent=res.total+' produtos';$('#adminProductList').replaceChildren(...res.products.map(p=>{const r=elem('article',undefined,'admin-record'),i=elem('img'),inf=elem('div',undefined,'info'),btn=elem('button','Editar');i.src=p.image||'/assets/produto-sem-foto.svg';i.alt='';inf.append(elem('strong',p.name),elem('small',`${p.brand} · ${p.category} · R$ ${Number(p.price||0).toFixed(2)}${p.active?'':' · OCULTO'}`));btn.onclick=()=>editProduct(p);
 r.append(i,inf,btn);
 if(p.active){const hide=elem('button','Ocultar');hide.className='button-danger';hide.onclick=async()=>{
  if(!confirm('Ocultar '+p.name+' da loja? Você poderá reativar pelo botão Editar.'))return;
  hide.disabled=true;try{await api('/api/admin/products/'+p.id,'DELETE',{});say('Produto ocultado.');await listProducts();await stats()}
  catch(e){say(e.message);hide.disabled=false}
 };r.append(hide)}
 return r}));const prev=elem('button','← Anterior'),next=elem('button','Próxima →');prev.disabled=page===1;next.disabled=page*30>=res.total;prev.onclick=()=>{page--;listProducts()};next.onclick=()=>{page++;listProducts()};$('#adminPagination').replaceChildren(prev,elem('span','Página '+page),next)}
async function listCategories(){const r=await api('/api/admin/categories');categories=r.categories;$('#categoryList').replaceChildren(...categories.map(c=>{const a=elem('article',undefined,'admin-record'),inf=elem('div',undefined,'info'),btn=elem('button','Editar');inf.append(elem('strong',c.name),elem('small',c.subtitle));btn.onclick=async()=>{const name=prompt('Nome da categoria',c.name);if(name===null)return;const subtitle=prompt('Descrição',c.subtitle);if(subtitle===null)return;try{await api('/api/admin/categories/'+c.id,'PUT',{name,subtitle});say('Categoria atualizada');await listCategories()}catch(e){say(e.message)}};const del=elem('button','Excluir');del.className='button-danger';del.disabled=['perfumes','corpo','beleza'].includes(c.id);del.onclick=async()=>{if(!confirm('Excluir a categoria '+c.name+'? Só funciona se não houver produtos vinculados.'))return;try{await api('/api/admin/categories/'+c.id,'DELETE',{});say('Categoria excluída');await listCategories()}catch(e){say(e.message)}};a.append(inf,btn,del);return a}))}
$('#newCategory')?.addEventListener('submit',async e=>{e.preventDefault();try{await api('/api/admin/categories','POST',Object.fromEntries(new FormData(e.target)));e.target.reset();say('Categoria adicionada');await listCategories()}catch(x){say(x.message)}});
async function editProduct(p){if(!categories.length){const x=await api('/api/admin/categories');categories=x.categories}const f=$('#productForm');f.reset();f.elements.category.replaceChildren(...categories.map(c=>{const o=elem('option',c.name);o.value=c.id;return o}));$('#editTitle').textContent=p?'Editar produto':'Novo produto';if(p)for(const k of ['id','name','price','description','category','brand','image','sku','stock','weight','width','height','length'])f.elements.namedItem(k).value=p[k]??'';else f.elements.id.value='';f.elements.active.checked=p?!!p.active:true;$('#photoFile').value='';$('#photoStatus').textContent='';$('#photoPreview').src=p?.image||'/assets/produto-sem-foto.svg';$('#editDialog').showModal()}
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
async function listOrders(){const {orders}=await api('/api/admin/orders');$('#ordersList').replaceChildren(...orders.map(o=>{const r=elem('article',undefined,'admin-record'),info=elem('div',undefined,'info'),fields=elem('div',undefined,'order-details');info.append(elem('strong',o.id+' · '+o.customer_name),elem('small',new Date(o.created).toLocaleString('pt-BR')+' · '+o.phone),elem('small',o.items.map(x=>x.qty+'x '+x.name).join(', ')),elem('small',`R$ ${o.subtotal.toFixed(2)} · ${o.delivery} · ${o.payment}`),elem('small',o.address||'Retirada na loja'));const sel=elem('select');for(const status of ['pedido_criado','aguardando_confirmacao','pagamento_aprovado','em_preparacao','enviado','pronto_retirada','concluido','cancelado']){const opt=elem('option',status.replaceAll('_',' '));opt.value=status;opt.selected=o.status===status;sel.append(opt)}const code=elem('input');code.value=o.tracking_code||'';code.placeholder='Código de rastreio';const url=elem('input');url.value=o.tracking_url||'';url.placeholder='Link HTTPS de rastreio';const b=elem('button','Salvar status');b.onclick=async()=>{try{await api('/api/admin/orders/'+o.id,'PUT',{status:sel.value,tracking_code:code.value,tracking_url:url.value});say('Status atualizado')}catch(x){say(x.message)}};fields.append(sel,code,url,b);r.append(info,fields);return r}));if(!orders.length)$('#ordersList').textContent='Nenhuma solicitação por enquanto.'}
$('#csvImportForm')?.addEventListener('submit',async e=>{e.preventDefault();const file=$('#catalogFile').files[0];if(!file)return;
 const out=$('#csvImportResult');if(file.size>8*1024*1024){out.textContent='Arquivo maior que 8MB';return}
 const btn=e.target.querySelector('button');btn.disabled=true;out.textContent='Importando...';
 try{const result=await fetch('/api/admin/import-csv',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'text/csv; charset=utf-8','X-CSRF-Token':csrf},body:await file.text()});const r=await result.json();if(!result.ok)throw Error(r.error||'Falha');out.textContent=`${r.inserted} novos, ${r.updated} atualizados, ${r.newCategories} categorias criadas, ${r.skipped} ignorados.`;await listProducts();await stats()}catch(err){out.textContent=err.message}finally{btn.disabled=false}
});
$('#blingPreviewButton')?.addEventListener('click',async()=>{try{const r=await api('/api/admin/bling/preview');$('#blingPreviewResult').textContent=`${r.orders.length} pedidos elegíveis para revisão. Nenhum pedido enviado. ${r.notice}`}catch(e){$('#blingPreviewResult').textContent=e.message}});
$('#syncButton')?.addEventListener('click',async e=>{e.target.disabled=true;$('#syncStatus').textContent='Sincronizando…';try{const r=await api('/api/admin/sync-vendizap','POST',{});$('#syncStatus').textContent=`${r.synced} produtos atualizados e ${r.images} fotos encontradas.`;await stats()}catch(x){$('#syncStatus').textContent=x.message}finally{e.target.disabled=false}});

// Configurações persistentes: campos secretos só retornam indicadores, nunca o valor.
const SECTIONS={'loja':'Loja e retirada','vendizap':'Vendizap — Catálogo','melhor-envio':'Melhor Envio — Transportadoras','bling':'Bling — ERP (OAuth pendente)','mercado-pago':'Mercado Pago — Pagamentos (cobrança pendente)','email':'E-mails transacionais — Resend'};
let settingsSnapshot=[];
async function loadSettings(){
 const {fields}=await api('/api/admin/settings');settingsSnapshot=fields;
 const root=$('#settingsFields');root.replaceChildren();
 for(const [section,label]of Object.entries(SECTIONS)){
  const box=elem('fieldset',undefined,'settings-group'),legend=elem('legend',label),grid=elem('div',undefined,'settings-grid');box.append(legend);
  for(const field of fields.filter(x=>x.section===section)){
   const wrap=elem('label',undefined,'setting-field'),title=elem('span',field.label),input=elem('input');
   input.dataset.configKey=field.key;input.maxLength=1500;
   if(field.kind==='secret'){input.type='password';input.autocomplete='new-password';input.placeholder=field.configured?'Credencial salva · deixe vazio para manter':'Cole sua credencial';}
   else{input.type='text';input.value=field.value||'';if(field.kind==='bool')input.placeholder='true / false';if(field.kind==='cep')input.inputMode='numeric'}
   wrap.append(title,input);
   const meta=elem('small',field.configured?'Configurado · origem: '+field.source:'Não configurado');wrap.append(meta);
   if(field.kind==='secret'&&field.configured){const clear=elem('label',undefined,'setting-clear'),check=elem('input');check.type='checkbox';check.dataset.clearKey=field.key;clear.append(check,document.createTextNode('Remover credencial salva'));wrap.append(clear)}
   grid.append(wrap);
  }
  box.append(grid);root.append(box);
 }
 const tests=$('#integrationTests');tests.replaceChildren();
 for(const [p,n]of [['vendizap','Testar Vendizap'],['melhor-envio','Testar Melhor Envio'],['mercado-pago','Testar Mercado Pago'],['bling','Verificar status Bling']]){
  const b=elem('button',n);b.type='button';b.onclick=async()=>{b.disabled=true;$('#connectionTestResult').textContent='Verificando conexão…';try{const r=await api('/api/admin/integrations/test','POST',{provider:p});$('#connectionTestResult').textContent=r.message}catch(e){$('#connectionTestResult').textContent=e.message}finally{b.disabled=false}};tests.append(b)
 }
}
$('#settingsForm')?.addEventListener('submit',async e=>{
 e.preventDefault();const btn=$('#saveSettings'),out=$('#settingsResult');btn.disabled=true;out.textContent='Salvando…';
 try{const values={},clear=[];for(const el of $$('[data-config-key]'))values[el.dataset.configKey]=el.value;
  for(const el of $$('[data-clear-key]'))if(el.checked)clear.push(el.dataset.clearKey);
  await api('/api/admin/settings','PUT',{values,clear});out.textContent='Configurações salvas no banco e aplicadas ao servidor.';await loadSettings();await stats();
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
