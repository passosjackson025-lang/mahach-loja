'use strict';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const arrow='<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M6 5h13v13"/></svg>';
const emptyImage='/assets/produto-sem-foto.svg';
let categories=[],brands=[],bag={},page=1,search='',category='todos',brand='',sort='featured',currentPage=[],productsById=new Map(),total=0,dialogTriggers=new WeakMap(),dialogScrollY=new WeakMap(),toastTimeout;
const catalogParams=new URLSearchParams(location.search);
const current=catalogParams.get('categoria')||(catalogParams.has('q')?'todos':document.body.dataset.category||'todos');
const featuredImages={
 '6a90e97b833a9316a807092e':'/assets/featured-asad.webp',
 '6a90ec29409abe2003085f0d':'/assets/featured-khamrah.webp',
 '6a911139d4441a8ea109f905':'/assets/featured-oud.webp',
 '6a90eaa593942f9d8b03a044':'/assets/featured-fakhar.webp'
};
function img(p){return p.image||featuredImages[p.id]||emptyImage}
window.laCourProductImage=img;
async function loadFeatured(){
 await Promise.all($$('[data-featured-product]').map(async card=>{
  try{
   const p=(await request('/api/products/'+encodeURIComponent(card.dataset.featuredProduct))).product;
   productsById.set(p.id,p);
   const photo=card.querySelector('img');photo.src=img(p);photo.alt='Foto de '+p.name;
   const price=card.querySelector('[data-featured-price]');price.textContent=p.stock===0?'Sem estoque':money(p.price);
   card.querySelector('.featured-notes').textContent=p.stock===0?'Consulte outras fragrâncias':card.querySelector('.featured-notes').textContent;
  }catch{card.querySelector('[data-featured-price]').textContent='Consulte disponibilidade'}
 }));
}
function wa(text){return 'https://wa.me/5511995209827?text='+encodeURIComponent(text)}
function toast(message){const el=$('.toast');if(!el)return;el.textContent=message;el.hidden=false;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{el.classList.remove('show');el.hidden=true},5000)}
async function request(url,options){const r=await fetch(url,options);const o=await r.json();if(!r.ok)throw Error(o.error||'Não foi possível concluir');return o}
function openDialog(d,trigger=document.activeElement){if(!d?.open){dialogTriggers.set(d,trigger);dialogScrollY.set(d,window.scrollY);d.showModal();document.body.classList.add('modal-open')}}
function closeDialog(d){if(d?.open)d.close()}
// Keep display labels clean even for records saved before the CSV emoji cleanup.
function cleanLabel(text){return String(text??'').replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0E\uFE0F\u200D\u20E3]/gu,'').replace(/\s+/g,' ').trim()}
function renderCategories(){
 const arr=[{id:'todos',name:'Todos os produtos',subtitle:'',total:categories.reduce((sum,c)=>sum+(c.total||0),0)},...categories];
 $$('[data-category-list]').forEach(container=>{
   const data=container.hasAttribute('data-include-all')?arr:categories;
   const isFilter=container.classList.contains('sidebar-categories');
   container.innerHTML=data.map(c=>`<a href="/produtos/index.html?categoria=${encodeURIComponent(c.id)}" ${isFilter&&$('#products')?`data-catalog-category="${esc(c.id)}"`:''} ${c.id===category&&$('#products')?'aria-current="page"':''}><span>${esc(cleanLabel(c.name))}</span>${isFilter?`<small aria-label="${Number(c.total||0)} produtos">${Number(c.total||0).toLocaleString('pt-BR')}</small>`:arrow}</a>`).join('');
 });
 const selected=categories.find(c=>c.id===category),name=cleanLabel(selected?.name||'Nossos produtos');
 if($('#mobileCategoryLabel'))$('#mobileCategoryLabel').textContent=cleanLabel(selected?.name||'Todos os produtos');
 if($('#catalogTitle')){
  $('#catalogTitle').textContent=name;
  $('#catalogSubtitle').textContent=selected?.subtitle||'Encontre o seu próximo ritual.';
  $('#breadcrumbCategory').textContent=selected?name:'';
  $$('.category-crumb').forEach(x=>x.hidden=!selected);
  document.title=name+' — LA COUR';
 }
}
let brandExpanded=false,catalogRequestId=0,metaRequestId=0,detailRequestId=0,searchTimer;
function catalogUrl(mode='replace'){
 if(!$('#products'))return;
 const url=new URL(location.href);
 if(category!=='todos')url.searchParams.set('categoria',category);else url.searchParams.delete('categoria');
 if(search)url.searchParams.set('q',search);else url.searchParams.delete('q');
 if(brand)url.searchParams.set('marca',brand);else url.searchParams.delete('marca');
 history[mode==='push'?'pushState':'replaceState']({},'',url);
}
// Evita salto causado por resultados mais curtos e pela âncora automática do navegador.
function holdCatalogPosition(){
 const grid=$('#products');if(!grid)return;
 const y=window.scrollY,top=grid.getBoundingClientRect().top+y;
 const minimum=Math.max(0,window.innerHeight+y-top+24);
 if(y+window.innerHeight>top)grid.style.minHeight=Math.max(0,Math.ceil(minimum))+'px';
 return y;
}
function keepCatalogPosition(y){if(!Number.isFinite(y))return;requestAnimationFrame(()=>{if(Math.abs(window.scrollY-y)>2)window.scrollTo({top:y,behavior:'instant'})})}
window.addEventListener('scroll',()=>{
 const grid=$('#products');if(!grid||!grid.style.minHeight)return;
 // Quando o visitante volta ao início da listagem, elimina o espaço reservado.
 const top=grid.getBoundingClientRect().top;
 if(top>window.innerHeight+40)grid.style.minHeight='';
},{passive:true});
async function refreshCatalogMeta(){
 const id=++metaRequestId;
 const out=await request('/api/meta?category='+encodeURIComponent(category));
 if(id!==metaRequestId)return;
 categories=out.categories;brands=out.brands;
 renderCategories();renderBrands();
}
function changeCategory(next,{push=true}={}){
 if(!$('#products')||!categories.some(c=>c.id===next)&&next!=='todos')return;
 if(category===next&&search===''&&brand==='')return;
 clearTimeout(searchTimer);
 const y=holdCatalogPosition();
 category=next;brand='';search='';page=1;brandExpanded=false;
 if($('#search'))$('#search').value='';
 if($('#brandSearch'))$('#brandSearch').value='';
 if(push)catalogUrl('push');
 renderCategories();renderBrands();
 refreshCatalogMeta().catch(()=>toast('Não foi possível atualizar as marcas.'));
 loadProducts({preserveY:y});
}
function renderBrands(){
 const list=$('#brandList'),search=$('#brandSearch'),toggle=$('#brandToggle'),empty=$('#brandEmpty');
 if(!list)return;
 const query=cleanLabel(search.value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=brands.filter(b=>cleanLabel(b.brand).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
 const chosen=matches.find(b=>b.brand===brand);
 const visible=query||brandExpanded?matches:matches.slice(0,8);
 // A selected brand always remains visible when the list is collapsed.
 if(!query&&!brandExpanded&&brand&&!visible.some(b=>b.brand===brand)&&chosen)visible.unshift(chosen);
 list.innerHTML=`<button type="button" class="brand-option${brand===''?' is-selected':''}" data-brand="" aria-pressed="${brand===''?'true':'false'}"><span>Todas as marcas</span></button>`+
 visible.map(b=>`<button type="button" class="brand-option${brand===b.brand?' is-selected':''}" data-brand="${esc(b.brand)}" aria-pressed="${brand===b.brand?'true':'false'}"><span>${esc(cleanLabel(b.brand))}</span><small>${Number(b.total||0).toLocaleString('pt-BR')}</small></button>`).join('');
 empty.hidden=matches.length>0;
 toggle.hidden=Boolean(query)||matches.length<=8;
 toggle.textContent=brandExpanded?'Mostrar menos':`Ver todas as marcas (${brands.length})`;
 toggle.setAttribute('aria-expanded',String(brandExpanded));
 const clear=$('#clearFilters');if(clear)clear.hidden=!brand&&!search.value;
}
function renderFilters(){
 const fs=$('#filterForm');if(!fs)return;
 const field=$('#brandField');
 if(!field)return;
 $('#brandSearch').addEventListener('input',()=>renderBrands());
 $('#brandToggle').addEventListener('click',()=>{brandExpanded=!brandExpanded;renderBrands()});
 field.addEventListener('click',event=>{
  const choice=event.target.closest('[data-brand]');if(!choice)return;
  const selected=choice.dataset.brand;
  if(brand!==selected){clearTimeout(searchTimer);const y=holdCatalogPosition();brand=selected;page=1;catalogUrl();loadProducts({preserveY:y})}
  renderBrands();
  [...field.querySelectorAll('[data-brand]')].find(button=>button.dataset.brand===selected)?.focus({preventScroll:true});
 });
 fs.addEventListener('submit',event=>event.preventDefault());
 $('#clearFilters').addEventListener('click',()=>{clearTimeout(searchTimer);const y=holdCatalogPosition();brand='';$('#brandSearch').value='';brandExpanded=false;page=1;renderBrands();catalogUrl();loadProducts({preserveY:y})});
 renderBrands();
}
async function loadProducts({preserveY}={}){const grid=$('#products');if(!grid)return;
 if(!Number.isSafeInteger(page)||page<1)page=1;
 const requestId=++catalogRequestId;grid.classList.add('catalog-changing');
 const qs=new URLSearchParams({page:String(page),limit:'24',category,q:search,brand,sort});
 try{const out=await request('/api/products?'+qs);if(requestId!==catalogRequestId)return;total=out.total;currentPage=out.products;for(const p of currentPage)productsById.set(p.id,p);
 grid.innerHTML=out.products.map(p=>`<article class="product-card"><div class="product-photo"><button data-detail="${esc(p.id)}" class="detail-open" aria-label="Conhecer ${esc(p.name)}"><img src="${esc(img(p))}" alt="${img(p)!==emptyImage?'Foto do produto '+esc(p.name):'Foto indisponível'}" width="800" height="1000" loading="lazy"></button></div><div class="product-info"><h3><button data-detail="${esc(p.id)}">${esc(p.name)}</button></h3><p>${esc(p.brand||'LA COUR')}</p><span class="price">${money(p.price)}</span><button class="product-link" data-detail="${esc(p.id)}">Conhecer ${arrow}</button></div></article>`).join('');
 window.mahachRevealCards?.(grid);
 $('#resultCount').textContent=`${Number(total).toLocaleString('pt-BR')} ${total===1?'produto':'produtos'} · página ${page} de ${Math.max(1,Math.ceil(total/24))}`;
 $('#emptySearch').hidden=!!out.products.length;$('#activeFilters').textContent=[brand&&'Marca: '+cleanLabel(brand)].filter(Boolean).join(' · ');
 renderPagination();
 keepCatalogPosition(preserveY);
 }catch(e){if(requestId!==catalogRequestId)return;grid.innerHTML='<p>Não foi possível carregar o catálogo. Inicie o servidor com <strong>npm start</strong> e atualize a página.</p>';$('#resultCount').textContent='Catálogo indisponível';console.warn(e)}finally{if(requestId===catalogRequestId)grid.classList.remove('catalog-changing')}
}
function renderPagination(){let nav=$('#catalogPagination');if(!nav){nav=document.createElement('nav');nav.id='catalogPagination';nav.className='catalog-pages';nav.setAttribute('aria-label','Páginas do catálogo');$('#products').after(nav)}const count=Math.ceil(total/24);nav.hidden=count<2;nav.innerHTML=`<button data-page="${page-1}" ${page===1?'disabled':''}>← Anterior</button><span>${page} / ${count||1}</span><button data-page="${page+1}" ${page>=count?'disabled':''}>Próxima →</button>`}
function storage(){try{localStorage.setItem('mahach-bag',JSON.stringify(bag))}catch{}renderBag()}
function renderBag(){const container=$('#bagItems');if(!container)return;let count=0,totalValue=0;container.innerHTML=Object.entries(bag).map(([id,qty])=>{const p=productsById.get(id);if(!p)return '';count+=qty;totalValue+=p.price*qty;return `<div class="bag-item"><img src="${esc(img(p))}" alt=""><div><h3>${esc(p.name)}</h3><small>${money(p.price)}</small><div class="quantity"><button data-qty="${esc(id)}" data-step="-1" aria-label="Diminuir ${esc(p.name)}">−</button><span>${qty}</span><button data-qty="${esc(id)}" data-step="1" aria-label="Aumentar ${esc(p.name)}">+</button></div></div><button class="remove-item" data-remove="${esc(id)}" aria-label="Remover">×</button></div>`}).join('')||'<p class="empty-bag">Sua próxima essência<br>ainda está por aqui.</p>';
 $('#bagCount').textContent=count;$('#bagTotal').innerHTML=count?`<div class="bag-total"><span>Subtotal</span><strong>${money(totalValue)}</strong></div>`:'';$('#checkout').hidden=!count;
}
async function restoreBag(){try{bag=JSON.parse(localStorage.getItem('mahach-bag')||'{}');if(!bag||Array.isArray(bag)||typeof bag!=='object')bag={};const ids=Object.keys(bag).slice(0,30);await Promise.all(ids.map(async id=>{if(!/^[\w-]{5,80}$/.test(id)||!Number.isInteger(bag[id])||bag[id]<1||bag[id]>20){delete bag[id];return}try{const out=await request('/api/products/'+encodeURIComponent(id));productsById.set(id,out.product)}catch{delete bag[id]}}));storage()}catch{bag={};storage()}}
async function detail(id,trigger){const requestId=++detailRequestId;let p=productsById.get(id);try{p=(await request('/api/products/'+encodeURIComponent(id))).product;if(requestId!==detailRequestId)return;productsById.set(id,p)}catch(e){if(requestId===detailRequestId)toast(e.message);return}
 $('#productDetail').innerHTML=`<div class="product-detail"><img src="${esc(img(p))}" alt="${img(p)!==emptyImage?'Foto de '+esc(p.name):'Foto ainda não cadastrada'}"><div class="detail-copy"><div class="eyebrow">${esc(p.brand||'LA COUR')}</div><h2 id="detailTitle">${esc(p.name)}</h2><span class="detail-section-title">Sobre este produto</span><p class="detail-description">${esc(p.description||'Informações complementares em breve.')}</p><p class="price">${money(p.price)}</p><p class="stock-disclaimer">${p.stock===null?'Disponibilidade sujeita a confirmação':p.stock>0?'Estoque informado: '+p.stock:'Sem estoque'}</p><button class="button" data-add="${esc(p.id)}" ${p.stock===0?'disabled':''}>Adicionar à sacola <span>+</span></button><a class="consult-link" href="${esc(wa('Olá, LA COUR! Quero saber mais sobre '+p.name+'.'))}" target="_blank" rel="noopener noreferrer">Tirar dúvidas sobre este produto no WhatsApp ↗</a></div></div>`;
 openDialog($('#productDialog'),trigger);
 $('#productDialog .product-dialog-header [data-close]')?.focus({preventScroll:true});
}
function add(id){const p=productsById.get(id);if(!p)return;if(p.stock!==null&&(bag[id]||0)>=p.stock)return toast('Quantidade indisponível no estoque');bag[id]=Math.min(20,(bag[id]||0)+1);storage();closeDialog($('#productDialog'));toast('Adicionado à sua sacola!')}
async function init(){try{const out=await request('/api/meta'+($('#products')?'?category='+encodeURIComponent(current):''));categories=out.categories;brands=out.brands;category=categories.some(c=>c.id===current)?current:'todos';renderCategories();renderFilters()}catch(e){toast('Não foi possível conectar ao catálogo. Inicie o servidor.')}
 if($('#products')){
 const searchInput=$('#search');
 search=catalogParams.get('q')?.trim().slice(0,100)||'';searchInput.value=search;
 brand=catalogParams.get('marca')||'';renderBrands();
 searchInput.addEventListener('input',e=>{
  clearTimeout(searchTimer);
  // Um resultado de busca antiga não pode sobrescrever o novo termo digitado.
  ++catalogRequestId;
  const value=e.target.value.trim().slice(0,100);
  searchTimer=setTimeout(()=>{
   const y=holdCatalogPosition();search=value;page=1;
   // A pesquisa por nome é global: categorias e marcas anteriores não escondem resultados.
   if(search){category='todos';brand='';brandExpanded=false;$('#brandSearch').value='';renderCategories();renderBrands();refreshCatalogMeta().catch(()=>{});}
   catalogUrl();loadProducts({preserveY:y});
  },240);
 });
 $('#sort').onchange=e=>{clearTimeout(searchTimer);const y=holdCatalogPosition();sort=e.target.value;page=1;loadProducts({preserveY:y})};
 $('#resetFilters').onclick=()=>{clearTimeout(searchTimer);const y=holdCatalogPosition();searchInput.value='';search='';brand='';category='todos';page=1;if($('#brandSearch'))$('#brandSearch').value='';brandExpanded=false;renderCategories();renderBrands();refreshCatalogMeta().catch(()=>{});catalogUrl();loadProducts({preserveY:y})};
 window.addEventListener('popstate',()=>{clearTimeout(searchTimer);const u=new URLSearchParams(location.search);const next=u.get('categoria')||(u.has('q')?'todos':document.body.dataset.category||'todos');category=categories.some(c=>c.id===next)?next:'todos';search=u.get('q')||'';brand=u.get('marca')||'';searchInput.value=search;page=1;renderCategories();renderBrands();refreshCatalogMeta().catch(()=>{});loadProducts({preserveY:holdCatalogPosition()})});
 const fs=$('#filterForm');fs.addEventListener('submit',e=>e.preventDefault());
 const media=matchMedia('(min-width: 901px)');const place=()=>{(media.matches?$('#desktopFilterSlot'):$('#mobileFilterSlot')).appendChild(fs);if(media.matches&&$('#filterDialog').open)closeDialog($('#filterDialog'))};place();media.addEventListener('change',place);
 $('#openFilters').onclick=e=>openDialog($('#filterDialog'),e.currentTarget);
 if(location.hash==='#busca')searchInput.focus();
 await loadProducts();
 // Link direto aos produtos da faixa LA COUR; usa o modal ja existente.
 const featuredId=catalogParams.get('produto');
 if(featuredId&&/^[a-f0-9]{24}$/.test(featuredId))await detail(featuredId,$('#catalogTitle')||$('#products'));
 }
 await loadFeatured();
 await restoreBag();
 $$('a[href^="https://wa.me/5511995209827"]').forEach(a=>{if(!a.search)a.href=wa('Olá, LA COUR! Gostaria de mais informações sobre os produtos e a loja.')});
 if($('#year'))$('#year').textContent=new Date().getFullYear();
}
document.addEventListener('click',e=>{
 const categoryLink=e.target.closest('a[data-catalog-category]');
 if(categoryLink&&$('#products')){e.preventDefault();changeCategory(categoryLink.dataset.catalogCategory);return}
 const d=e.target.closest('[data-detail]');if(d){e.preventDefault();return detail(d.dataset.detail,d)}
 const a=e.target.closest('[data-add]');if(a)return add(a.dataset.add);
 const q=e.target.closest('[data-qty]');if(q){const id=q.dataset.qty;bag[id]=(bag[id]||0)+Number(q.dataset.step);if(bag[id]<=0)delete bag[id];storage();return}
 const r=e.target.closest('[data-remove]');if(r){delete bag[r.dataset.remove];storage();return}
 // Only pagination BUTTONS inside this navigation are allowed to change pages.
 // The <body> also has data-page="catalog": matching it caused page=NaN and a jump
 // to the toolbar whenever a visitor clicked empty space or another control.
 const pag=e.target.closest('#catalogPagination button[data-page]');
 if(pag){
  if(pag.disabled)return;
  const next=Number(pag.dataset.page),last=Math.max(1,Math.ceil(total/24));
  if(!Number.isSafeInteger(next)||next<1||next>last||next===page)return;
  page=next;
  const grid=$('#products');if(grid)grid.style.minHeight='';
  loadProducts();
  $('.shop-toolbar')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
  return;
 }
 if(e.target.closest('[data-close]')){e.preventDefault();const button=e.target.closest('[data-close]');closeDialog(button.closest('dialog'));return}
});
// Bind independent close handlers directly so detail close never depends on add-to-bag.
$$('dialog [data-close]').forEach(button=>button.addEventListener('click',e=>{
 e.preventDefault();e.stopPropagation();closeDialog(button.closest('dialog'));
}));
$('#productDialog')?.addEventListener('click',e=>{if(e.target===e.currentTarget)closeDialog(e.currentTarget)});
$('#openMenu')?.addEventListener('click',e=>openDialog($('#menuDialog'),e.currentTarget));
$('#openBag')?.addEventListener('click',e=>openDialog($('#bagDialog'),e.currentTarget));
$('#checkout')?.addEventListener('click',()=>{closeDialog($('#bagDialog'));window.openCheckout?.(bag,productsById)});
$$('dialog').forEach(d=>d.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open');dialogTriggers.get(d)?.focus?.({preventScroll:true});dialogTriggers.delete(d);const previousY=dialogScrollY.get(d);requestAnimationFrame(()=>keepCatalogPosition(previousY));dialogScrollY.delete(d)}));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;if(!reduce&&'IntersectionObserver'in window){document.documentElement.classList.add('js-motion');const obs=new IntersectionObserver(es=>es.forEach(x=>{if(x.isIntersecting){x.target.classList.add('visible');obs.unobserve(x.target)}}));$$('.reveal').forEach(e=>obs.observe(e))}
init();

document.addEventListener('error',e=>{if(e.target.tagName==='IMG'&&e.target.src&&!e.target.src.endsWith('produto-sem-foto.svg'))e.target.src='/assets/produto-sem-foto.svg'},true);
