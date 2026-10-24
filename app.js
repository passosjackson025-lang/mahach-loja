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
const sectionLabels={todos:'Todos',arabes:'Árabes',importados:'Importados',nicho:'Nicho',masculino:'Masculino',feminino:'Feminino',unissex:'Unissex'};
let section=Object.hasOwn(sectionLabels,catalogParams.get('section'))?catalogParams.get('section'):'todos';
const selectedBrands=new Set(catalogParams.getAll('marca').filter(Boolean));
let priceLow=Math.max(0,Number(catalogParams.get('priceMin'))||0),priceHigh=catalogParams.has('priceMax')?Math.max(0,Number(catalogParams.get('priceMax'))||0):null,priceCeiling=6000,priceTimer;
const bagIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l1 14H4L5 7ZM8 8V6a4 4 0 0 1 8 0v2"/></svg>';
const heartIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 4.7c-2-2-5.2-1.8-7.1.2L12 6.4l-1.4-1.5C8.7 2.9 5.5 2.7 3.5 4.7c-2.1 2.1-2 5.5.1 7.6L12 21l8.4-8.7c2.1-2.1 2.2-5.5.1-7.6Z"/></svg>';
let favorites=new Set();try{favorites=new Set(JSON.parse(localStorage.getItem('lacour-favorites')||'[]').slice(0,300))}catch{}
function displayName(p){
 const known={'6a90e97b833a9316a807092e':'Asad','6a90ec29409abe2003085f0d':'Khamrah','6a911139d4441a8ea109f905':'Badee Al Oud — Oud for Glory','6a90eaa593942f9d8b03a044':'Fakhar Black'};if(known[p.id])return known[p.id];
 let text=cleanLabel(p.name).replace(/\b(?:\d+(?:[.,]\d+)?\s*(?:ML|KG|G)|EAU DE PARFUM|EAU DE TOILETTE|EDP|EDT|UNISSEX|UNISEX|MASCULINO|FEMININO|MASC|FEM)\b/gi,' ').replace(/^PERFUME\s+/i,'');
 text=text.replace(/\s+/g,' ').trim();
 for(const part of String(p.brand||'').split('|')){const b=part.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(b)text=text.replace(new RegExp('(?:^'+b+'\\s+|\\s+'+b+'$)','ig'),' ').trim()}
 return text.replace(/\s+/g,' ').replace(/^[\s—-]+|[\s—-]+$/g,'').trim()||cleanLabel(p.name);
}
async function quickAdd(id){try{const p=(await request('/api/products/'+encodeURIComponent(id))).product;productsById.set(id,p);add(id)}catch(e){toast(e.message)}}

function wa(text){return 'https://wa.me/5511940856397?text='+encodeURIComponent(text)}
function toast(message){const el=$('.toast');if(!el)return;el.textContent=message;el.hidden=false;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{el.classList.remove('show');el.hidden=true},5000)}
async function request(url,options){const r=await fetch(url,options);const o=await r.json();if(!r.ok)throw Error(o.error||'Não foi possível concluir');return o}
function openDialog(d,trigger=document.activeElement){if(!d?.open){dialogTriggers.set(d,trigger);dialogScrollY.set(d,window.scrollY);d.showModal();document.body.classList.add('modal-open')}}
function closeDialog(d){if(d?.open)d.close()}
// Keep display labels clean even for records saved before the CSV emoji cleanup.
function cleanLabel(text){return String(text??'').replace(/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0E\uFE0F\u200D\u20E3]/gu,'').replace(/\s+/g,' ').trim()}
function renderCategories(){
 const arr=[{id:'todos',name:'Todos os produtos',subtitle:'',total:categories.reduce((n,c)=>n+(c.total||0),0)},...categories];
 $$('[data-category-list]').forEach(container=>{
  const data=container.hasAttribute('data-include-all')?arr:categories;
  container.innerHTML=data.map(c=>`<a href="/produtos/index.html?categoria=${encodeURIComponent(c.id)}"><span>${esc(cleanLabel(c.name))}</span>${arrow}</a>`).join('');
 });
 const selected=categories.find(c=>c.id===category),name=category==='perfumes'?'Perfumes':cleanLabel(selected?.name||'Perfumes');
 if($('#mobileCategoryLabel'))$('#mobileCategoryLabel').textContent=sectionLabels[section]||name;
 if($('#catalogTitle')){$('#catalogTitle').textContent=name;$('#catalogSubtitle').textContent=selected?.subtitle||'Essências que transformam o extraordinário em rotina.';$('#breadcrumbCategory').textContent=selected?name:'';$$('.category-crumb').forEach(x=>x.hidden=!selected);document.title=name+' — LA COUR'}
 renderSections();
}
let brandExpanded=false,catalogRequestId=0,metaRequestId=0,detailRequestId=0,searchTimer;
function renderSections(){
 const buttons=Object.entries(sectionLabels).map(([key,label])=>`<button type="button" data-section="${key}" aria-pressed="${section===key}" class="${section===key?'is-active':''}">${esc(label)}</button>`).join('');
 if($('#perfumeTabs'))$('#perfumeTabs').innerHTML=buttons;
 if($('#sectionFilters'))$('#sectionFilters').innerHTML=Object.entries(sectionLabels).map(([key,label])=>`<label class="filter-checkbox"><input type="checkbox" data-section="${key}" ${section===key?'checked':''}><span>${esc(label)}</span></label>`).join('');
}
function catalogUrl(mode='replace'){
 if(!$('#products'))return;const url=new URL(location.href);
 if(category!=='todos')url.searchParams.set('categoria',category);else url.searchParams.delete('categoria');
 if(search)url.searchParams.set('q',search);else url.searchParams.delete('q');
 url.searchParams.delete('marca');selectedBrands.forEach(x=>url.searchParams.append('marca',x));
 if(section!=='todos')url.searchParams.set('section',section);else url.searchParams.delete('section');
 if(priceLow>0)url.searchParams.set('priceMin',String(priceLow));else url.searchParams.delete('priceMin');
 if(priceHigh!==null)url.searchParams.set('priceMax',String(priceHigh));else url.searchParams.delete('priceMax');
 history[mode==='push'?'pushState':'replaceState']({},'',url);
}
function holdCatalogPosition(){const grid=$('#products');if(!grid)return;const y=scrollY,top=grid.getBoundingClientRect().top+y;const minimum=Math.max(0,innerHeight+y-top+24);if(y+innerHeight>top)grid.style.minHeight=Math.ceil(minimum)+'px';return y}
function keepCatalogPosition(y){if(Number.isFinite(y))requestAnimationFrame(()=>{if(Math.abs(scrollY-y)>2)scrollTo({top:y,behavior:'instant'})})}
window.addEventListener('scroll',()=>{const grid=$('#products');if(grid?.style.minHeight&&grid.getBoundingClientRect().top>innerHeight+40)grid.style.minHeight=''},{passive:true});
async function refreshCatalogMeta(){const id=++metaRequestId;const out=await request('/api/meta?category='+encodeURIComponent(category));if(id!==metaRequestId)return;categories=out.categories;brands=out.brands;priceCeiling=Math.max(1000,Number(out.priceMax)||6000);renderCategories();renderBrands();renderPrice()}
function changeCategory(next,{push=true}={}){
 if(!$('#products')||!categories.some(c=>c.id===next)&&next!=='todos')return;
 clearTimeout(searchTimer);const y=holdCatalogPosition();category=next;selectedBrands.clear();brand='';search='';section='todos';page=1;brandExpanded=false;
 if($('#search'))$('#search').value='';if($('#brandSearch'))$('#brandSearch').value='';
 if(push)catalogUrl('push');renderCategories();renderBrands();refreshCatalogMeta().catch(()=>{});loadProducts({preserveY:y});
}
function selectSection(next){
 if(!Object.hasOwn(sectionLabels,next))return;
 const y=holdCatalogPosition();section=section===next&&next!=='todos'?'todos':next;
 category=section==='todos'?(document.body.dataset.category||'todos'):'perfumes';page=1;
 catalogUrl('push');renderCategories();refreshCatalogMeta().catch(()=>{});loadProducts({preserveY:y});
}
function renderBrands(){
 const list=$('#brandList');if(!list)return;
 const input=$('#brandSearch'),query=cleanLabel(input.value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const matches=brands.filter(b=>cleanLabel(b.brand).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(query));
 const preferred=['LATTAFA','ARD AL ZAAFARAN','AJMAL','MAISON ALHAMBRA','FRAGRANCE WORLD','RASASI'];
 matches.sort((a,b)=>{const ai=preferred.indexOf(a.brand.toUpperCase()),bi=preferred.indexOf(b.brand.toUpperCase());return (ai<0?99:ai)-(bi<0?99:bi)});
 const visible=query||brandExpanded?matches:matches.slice(0,8);
 for(const b of matches)if(selectedBrands.has(b.brand)&&!visible.includes(b))visible.push(b);
 list.innerHTML=visible.map(b=>`<label class="filter-checkbox"><input type="checkbox" data-brand="${esc(b.brand)}" ${selectedBrands.has(b.brand)?'checked':''}><span>${esc(cleanLabel(b.brand))}</span></label>`).join('');
 $('#brandEmpty').hidden=matches.length>0;$('#brandToggle').hidden=Boolean(query)||matches.length<=8;$('#brandToggle').textContent=brandExpanded?'Mostrar menos':`Ver todas (${brands.length})`;$('#brandToggle').setAttribute('aria-expanded',String(brandExpanded));
 $('#clearFilters').hidden=selectedBrands.size===0&&section==='todos'&&priceLow===0&&priceHigh===null&&!search;
}
function renderPrice(){
 if(!$('#priceMin'))return;const cap=Math.max(priceCeiling,priceHigh||0,priceLow);
 $('#priceMin').max=cap;$('#priceMax').max=cap;$('#priceMin').value=priceLow;$('#priceMax').value=priceHigh??cap;
 $('#priceMinValue').textContent=money(priceLow);$('#priceMaxValue').textContent=money(priceHigh??cap);
}
function clearCatalogFilters(){clearTimeout(searchTimer);const y=holdCatalogPosition();selectedBrands.clear();brand='';section='todos';priceLow=0;priceHigh=null;search='';category=document.body.dataset.category||'todos';page=1;$('#search').value='';$('#brandSearch').value='';brandExpanded=false;renderCategories();renderBrands();renderPrice();catalogUrl();refreshCatalogMeta().catch(()=>{});loadProducts({preserveY:y})}
function renderFilters(){
 const fs=$('#filterForm');if(!fs)return;
 $('#brandSearch').addEventListener('input',renderBrands);$('#brandToggle').addEventListener('click',()=>{brandExpanded=!brandExpanded;renderBrands()});
 fs.addEventListener('change',e=>{
  if(e.target.matches('[data-brand]')){const value=e.target.dataset.brand;if(e.target.checked)selectedBrands.add(value);else selectedBrands.delete(value);brand=[...selectedBrands][0]||'';page=1;const y=holdCatalogPosition();catalogUrl();renderBrands();loadProducts({preserveY:y})}
 });
 fs.addEventListener('submit',e=>e.preventDefault());$('#clearFilters').addEventListener('click',clearCatalogFilters);
 const priceInput=e=>{let lo=Number($('#priceMin').value),hi=Number($('#priceMax').value);if(lo>hi){if(e.target.id==='priceMin')lo=hi;else hi=lo}priceLow=lo;priceHigh=hi>=priceCeiling?null:hi;renderPrice();clearTimeout(priceTimer);priceTimer=setTimeout(()=>{page=1;catalogUrl();renderBrands();loadProducts({preserveY:holdCatalogPosition()})},220)};
 $('#priceMin').addEventListener('input',priceInput);$('#priceMax').addEventListener('input',priceInput);renderBrands();renderPrice();
}
async function loadProducts({preserveY}={}){
 const grid=$('#products');if(!grid)return;if(!Number.isSafeInteger(page)||page<1)page=1;
 const requestId=++catalogRequestId;grid.classList.add('catalog-changing');
 const qs=new URLSearchParams({page:String(page),limit:'24',category,q:search,sort,section});selectedBrands.forEach(b=>qs.append('brand',b));if(priceLow>0)qs.set('priceMin',priceLow);if(priceHigh!==null)qs.set('priceMax',priceHigh);
 try{const out=await request('/api/products?'+qs);if(requestId!==catalogRequestId)return;total=out.total;currentPage=out.products;for(const p of currentPage)productsById.set(p.id,p);
 grid.innerHTML=currentPage.map(p=>`<article class="product-card"><div class="product-photo"><button data-detail="${esc(p.id)}" class="detail-open" aria-label="Conhecer ${esc(p.name)}"><img src="${esc(img(p))}" alt="${img(p)!==emptyImage?'Foto de '+esc(p.name):'Foto indisponível'}" width="800" height="1000" loading="lazy"></button><button class="product-favorite" data-favorite="${esc(p.id)}" aria-label="Favoritar ${esc(displayName(p))}" aria-pressed="${favorites.has(p.id)}">${heartIcon}</button></div><div class="product-info"><h3><button data-detail="${esc(p.id)}" title="${esc(p.name)}">${esc(displayName(p))}</button></h3><p>${esc(cleanLabel(p.brand||'LA COUR'))}</p><span class="price">${money(p.price)}</span><button class="quick-add" data-quick-add="${esc(p.id)}" aria-label="Adicionar ${esc(displayName(p))} à sacola" ${p.stock===0?'disabled':''}>${bagIcon}</button></div></article>`).join('');
 window.mahachRevealCards?.(grid);$('#resultCount').textContent=`${Number(total).toLocaleString('pt-BR')} ${total===1?'produto':'produtos'}`;$('#emptySearch').hidden=!!currentPage.length;
 $('#activeFilters').textContent=[section!=='todos'&&sectionLabels[section],...selectedBrands,priceLow>0&&'A partir de '+money(priceLow),priceHigh!==null&&'Até '+money(priceHigh)].filter(Boolean).join(' · ');
 renderPagination();keepCatalogPosition(preserveY);
 }catch(e){if(requestId!==catalogRequestId)return;grid.innerHTML='<p>Não foi possível carregar os produtos. Tente novamente em instantes.</p>';$('#resultCount').textContent='Catálogo indisponível';console.warn(e)}finally{if(requestId===catalogRequestId)grid.classList.remove('catalog-changing')}
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
async function init(){try{const out=await request('/api/meta'+($('#products')?'?category='+encodeURIComponent(current):''));categories=out.categories;brands=out.brands;priceCeiling=Math.max(1000,Number(out.priceMax)||6000);category=categories.some(c=>c.id===current)?current:'todos';renderCategories();renderFilters()}catch(e){toast('Não foi possível conectar ao catálogo. Inicie o servidor.')}
 if($('#products')){
 const searchInput=$('#search');
 search=catalogParams.get('q')?.trim().slice(0,100)||'';searchInput.value=search;
 brand=[...selectedBrands][0]||'';renderBrands();renderPrice();
 searchInput.addEventListener('input',e=>{
  clearTimeout(searchTimer);
  // Um resultado de busca antiga não pode sobrescrever o novo termo digitado.
  ++catalogRequestId;
  const value=e.target.value.trim().slice(0,100);
  searchTimer=setTimeout(()=>{
   const y=holdCatalogPosition();search=value;page=1;
   // A pesquisa por nome é global: categorias e marcas anteriores não escondem resultados.
   if(search){category='todos';brand='';selectedBrands.clear();section='todos';brandExpanded=false;$('#brandSearch').value='';renderCategories();renderBrands();refreshCatalogMeta().catch(()=>{});}
   catalogUrl();loadProducts({preserveY:y});
  },240);
 });
 $('#sort').onchange=e=>{clearTimeout(searchTimer);const y=holdCatalogPosition();sort=e.target.value;page=1;loadProducts({preserveY:y})};
 $('#resetFilters').onclick=clearCatalogFilters;
 window.addEventListener('popstate',()=>{clearTimeout(searchTimer);const u=new URLSearchParams(location.search);category=u.get('categoria')||document.body.dataset.category||'todos';search=u.get('q')||'';section=Object.hasOwn(sectionLabels,u.get('section'))?u.get('section'):'todos';selectedBrands.clear();u.getAll('marca').forEach(x=>selectedBrands.add(x));brand=[...selectedBrands][0]||'';priceLow=Number(u.get('priceMin'))||0;priceHigh=u.has('priceMax')?Number(u.get('priceMax')):null;searchInput.value=search;page=1;renderCategories();renderBrands();renderPrice();refreshCatalogMeta().catch(()=>{});loadProducts({preserveY:holdCatalogPosition()})});
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
 $$('a[href^="https://wa.me/5511940856397"]').forEach(a=>{if(!a.search)a.href=wa('Olá, LA COUR! Gostaria de mais informações sobre os produtos e a loja.')});
 if($('#year'))$('#year').textContent=new Date().getFullYear();
}
document.addEventListener('click',e=>{
 const sectionChoice=e.target.closest('[data-section]');if(sectionChoice){e.preventDefault();selectSection(sectionChoice.dataset.section);return}
 const quick=e.target.closest('[data-quick-add]');if(quick){e.preventDefault();quickAdd(quick.dataset.quickAdd);return}
 const favorite=e.target.closest('[data-favorite]');if(favorite){const id=favorite.dataset.favorite;if(favorites.has(id))favorites.delete(id);else if(favorites.size<300)favorites.add(id);favorite.setAttribute('aria-pressed',String(favorites.has(id)));try{localStorage.setItem('lacour-favorites',JSON.stringify([...favorites]))}catch{}return}

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
