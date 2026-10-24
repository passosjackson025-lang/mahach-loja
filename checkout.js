'use strict';
// LA COUR Checkout. Os dados do cartão NÃO passam por este site.
(function(){
 const markup=`<dialog class="checkout-dialog mahach-split" id="checkoutDialog" aria-labelledby="checkoutTitle">
 <div class="mahach-shell"><div class="mahach-shell-light">
 <div class="checkout-head"><div><span class="eyebrow">LA COUR · SUA COMPRA</span><h2 id="checkoutTitle">Finalizar compra.</h2><p class="checkout-head-sub">Perfumaria selecionada, compra com segurança.</p></div><button type="button" data-checkout-close aria-label="Fechar">×</button></div>
 <div class="checkout-body"><div class="checkout-steps" aria-label="Etapas"><span>Dados</span><span>Entrega</span><span>Pagamento</span><span>Resumo</span></div>
 <p class="checkout-intro">Confira seus dados, a entrega e o pagamento. No Pix, o QR Code aparece após registrar o pedido.</p>
 <form id="checkoutForm" class="mahach-checkout-layout">
  <div class="mahach-checkout-main">
  <div class="checkout-fields"><h3 class="mahach-section-heading"><span class="mahach-section-index" aria-hidden="true">01</span><span>Dados para sua compra</span></h3><label>Seu nome completo<input name="name" autocomplete="name" minlength="3" maxlength="120" required></label><label>WhatsApp com DDD<input name="phone" autocomplete="tel" inputmode="tel" pattern="[0-9()+\\s-]{10,20}" placeholder="(11) 99999-9999" required></label><label>E-mail para confirmação do pedido<input type="email" name="email" autocomplete="email" maxlength="200" required></label></div>
  <fieldset class="mahach-delivery"><legend><span class="mahach-section-index" aria-hidden="true">02</span><span>Tipo de entrega</span></legend><div class="checkout-options">
   <label><input type="radio" name="delivery" value="pickup" checked> Retirar na loja <small>Sem frete</small></label>
   <label><input type="radio" name="delivery" value="transportadora"> Transportadora <small>Calcular frete</small></label>
   <label><input type="radio" name="delivery" value="uber"> Uber <small>Corrida à parte</small></label>
   <label><input type="radio" name="delivery" value="99"> 99Entrega <small>Corrida à parte</small></label>
  </div></fieldset>
  <div id="deliveryAddress" hidden><h3 class="mahach-section-heading mahach-address-title"><span class="mahach-section-index" aria-hidden="true">03</span><span>Endereço para entrega</span></h3><div class="checkout-fields">
   <label>CEP de entrega<input name="cep" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9"></label>
   <label>Rua ou avenida<input name="street" autocomplete="address-line1" maxlength="95" placeholder="Preenchida automaticamente pelo CEP"></label>
   <label>Numero do imovel<input name="addressNumber" inputmode="text" maxlength="15" placeholder="Ex.: 123"></label>
   <label>Complemento (opcional)<input name="complement" autocomplete="address-line2" maxlength="40" placeholder="Apto, bloco, sala..."></label>
   <label>Bairro<input name="neighborhood" maxlength="70" placeholder="Preenchido automaticamente"></label>
   <label>Cidade<input name="city" maxlength="70" placeholder="Preenchida automaticamente"></label>
   <label>UF<input name="state" maxlength="2" placeholder="SP"></label>
   <input type="hidden" name="address">
  </div><p id="cepLookupStatus" class="shipping-choice" role="status" aria-live="polite"></p>
   <button class="quote-button" type="button" id="quoteShipping">Calcular frete</button><div id="shippingResults" aria-live="polite"></div><p class="shipping-choice" id="shippingSelection" role="status"></p></div>
  <fieldset class="mahach-payment"><legend><span class="mahach-section-index" id="mahachPaymentStepNumber" aria-hidden="true">03</span><span>Forma de pagamento</span></legend><div class="checkout-options" id="paymentOptions">
   <label><input type="radio" name="payment" value="pix" checked> Pix com QR Code <small>Sem sair do site</small></label>
  <div id="pixCpfArea" class="checkout-pix-cpf"><label>CPF do pagador (solicitado pelo Mercado Pago para o Pix)<input name="pixCpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00"></label><small>Usado somente para gerar o Pix; a LA COUR nao armazena esse documento.</small></div>
   <label><input type="radio" name="payment" value="card"> Cartão de crédito <small>Via Mercado Pago</small></label>
   <label><input type="radio" name="payment" value="cash"> Pagar na retirada <small>Somente retirada na loja</small></label>
  </div></fieldset>
  <p class="checkout-notice" id="checkoutShippingNotice">Retirada sem frete. Confirme o endereço e o horário antes de ir à loja.</p>
  <label class="checkout-marketing"><input type="checkbox" name="marketingOptIn" value="on"> Quero receber ofertas e novidades da LA COUR por e-mail e WhatsApp. Posso cancelar a autorização quando quiser.</label>
  <p class="checkout-legal">Usaremos seus dados para processar o pedido, mesmo que você não aceite marketing. Consulte a <a href="/privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>. A LA COUR não recebe nem armazena os dados completos do cartão.</p>
  <p id="checkoutError" class="checkout-error" role="alert" hidden></p>
  </div>

 </form>
  <div id="orderSuccess" tabindex="-1" hidden><span class="order-eyebrow">LA COUR · PAGAMENTO</span><h3 id="orderHeading">Pedido registrado</h3><p id="orderReference"></p><p id="orderInstructions">Seu pedido foi registrado.</p>
  <section id="orderPix" class="mahach-pix" hidden aria-label="Pagamento Pix">
   <p><strong>Pix da sua compra</strong> — use o app do seu banco para pagar.</p>
   <p id="pixUnavailableMessage" class="pix-unavailable" role="status" hidden>O Pix ainda não está disponível. Você pode tentar novamente sem criar outro pedido.</p>
   <img id="pixQrImage" alt="QR Code de pagamento Pix gerado pelo Mercado Pago" width="230" height="230" hidden>
   <label id="pixCopyLabel" hidden>Pix Copia e Cola<textarea id="pixCopyValue" readonly rows="3" aria-label="Codigo Pix Copia e Cola"></textarea></label>
   <button type="button" id="pixCopyButton" class="quote-button">Copiar codigo Pix</button>
   <button type="button" id="pixRetryButton" class="quote-button" hidden>Tentar carregar o Pix novamente</button>
   <p id="pixStatus" role="status" aria-live="polite">Aguardando confirmacao do Mercado Pago...</p>
  </section>
  <a id="orderTrack" class="consult-link" target="_blank" rel="noopener noreferrer" hidden>Acompanhar entrega</a></div>
 </div></div>
  <aside class="mahach-checkout-side" aria-label="Resumo do pedido">
   <div class="mahach-side-top"><div class="mahach-side-label">LA COUR · SEU PEDIDO</div><h3>Seu pedido</h3><p id="mahachSummaryCount"></p></div>
   <div id="mahachSummaryItems" class="mahach-summary-products"></div>
   <div class="checkout-total checkout-summary" id="checkoutTotal" role="status" aria-live="polite"></div>
   <button class="button" id="submitOrder" form="checkoutForm" type="submit">Continuar para pagamento →</button>
   <p class="mahach-side-safe">Pagamento processado pelo Mercado Pago. Dados do cartão não passam pela LA COUR.</p>
   <div class="mahach-side-perks"><p><span aria-hidden="true">◇</span> Compra segura</p><p><span aria-hidden="true">↗</span> Acompanhe seu pedido</p><p><span aria-hidden="true">✦</span> O cuidado LA COUR em cada detalhe</p></div>
  </aside>
 </div></dialog>`;
 const pixCss=document.createElement('link');pixCss.rel='stylesheet';pixCss.href='/pix-checkout.css';document.head.appendChild(pixCss);
 document.body.insertAdjacentHTML('beforeend',markup);
 const d=document.getElementById('checkoutDialog'),form=document.getElementById('checkoutForm'),q=id=>document.getElementById(id);
 let items=[],checkoutEnabled=false,selectedQuote='',selectedCost=null,pickupAddress='',onlinePayments=false,pixPoll=null,activeOrder=null;
 const side=d.querySelector('.mahach-checkout-side');
 const previewNotice=document.createElement('p');previewNotice.id='checkoutPreviewNotice';previewNotice.textContent='Estamos preparando a LA COUR para compras online. O catálogo está disponível, mas ainda não estamos recebendo pedidos ou pagamentos pelo site.';previewNotice.hidden=true;previewNotice.style.cssText='padding:1.25rem;line-height:1.6;margin:1rem;border:1px solid #ccbfa8;border-radius:10px';form.before(previewNotice);
 function syncAvailability(){if(!d.open)return;form.hidden=!checkoutEnabled;side.hidden=!checkoutEnabled;previewNotice.hidden=checkoutEnabled;d.classList.toggle('mahach-preview',!checkoutEnabled);}
 fetch('/api/store/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{checkoutEnabled=v?.checkoutEnabled===true;syncAvailability()}).catch(()=>{});
 fetch('/api/meta',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(x=>{pickupAddress=String(x?.pickupAddress||'');onlinePayments=x?.onlinePayments===true;refreshDelivery()}).catch(()=>{});
 d.querySelector('[data-checkout-close]').addEventListener('click',()=>d.close());
 d.addEventListener('close',()=>{if(pixPoll)clearInterval(pixPoll);pixPoll=null;if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open')});
 const currency=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const bagPayload=()=>items.map(x=>({id:x.id,qty:x.qty}));
 function renderSummaryProducts(){
  const list=q('mahachSummaryItems');if(!list)return;
  list.replaceChildren();
  const count=items.reduce((n,x)=>n+x.qty,0);
  q('mahachSummaryCount').textContent=count+' '+(count===1?'item':'itens');
  for(const item of items){
   const row=document.createElement('div');row.className='mahach-summary-product';
   const thumb=document.createElement('div');thumb.className='mahach-product-thumbnail';
   const image=String(window.laCourProductImage?.(item.p)||item.p.image||'').trim();
   if(image && (/^https:\/\//i.test(image)||/^\/(?!\/)/.test(image))){
    const img=document.createElement('img');img.src=image;img.loading='lazy';img.alt='';img.addEventListener('error',()=>{img.remove();thumb.textContent='✦'});thumb.append(img)
   } else thumb.textContent='✦';
   const detail=document.createElement('div');detail.className='mahach-product-detail';
   const title=document.createElement('strong');title.textContent=String(item.p.name||'Produto LA COUR');
   const qty=document.createElement('small');qty.textContent='Quantidade: '+item.qty;
   detail.append(title,qty);
   const price=document.createElement('b');price.textContent=currency(Number(item.p.price)*item.qty);
   row.append(thumb,detail,price);list.append(row);
  }
 }
 window.openCheckout=function(bag,map){
  if(pixPoll)clearInterval(pixPoll);pixPoll=null;activeOrder=null;
  d.classList.remove('mahach-success');selectedQuote='';selectedCost=null;form.reset();clearTimeout(cepTimer);++cepRequest;q('cepLookupStatus').textContent='';
  q('orderPix').hidden=true;q('pixQrImage').hidden=true;q('pixQrImage').removeAttribute('src');q('pixCopyValue').value='';q('pixCopyLabel').hidden=true;q('pixUnavailableMessage').hidden=true;q('pixCopyButton').hidden=true;q('pixRetryButton').hidden=true;
  d.querySelector('.checkout-head-sub').hidden=false;q('checkoutTitle').textContent='Finalizar compra.';q('orderHeading').textContent='Pedido registrado';q('orderHeading').hidden=false;q('orderReference').hidden=false;q('orderInstructions').hidden=false;q('orderTrack').hidden=true;q('orderPix').hidden=true;q('orderSuccess').dataset.phase='';q('orderSuccess').hidden=true;d.querySelector('.checkout-steps').hidden=false;d.querySelector('.checkout-intro').hidden=false;
  items=Object.entries(bag).map(([id,qty])=>({id,qty,p:map.get(id)})).filter(x=>x.p);
  renderSummaryProducts();
  q('orderSuccess').hidden=true;q('checkoutError').hidden=true;q('shippingResults').replaceChildren();q('shippingSelection').textContent='';
  refreshDelivery();d.showModal();syncAvailability();document.body.classList.add('modal-open');
 };
 function updateTotal(){
  const subtotal=items.reduce((acc,x)=>acc+Number(x.p.price)*x.qty,0);
  const delivery=form.elements.delivery.value;
  const shipping=delivery==='pickup'?0:delivery==='transportadora'?selectedCost:null;
  const isQuick=delivery==='uber'||delivery==='99';
  const rows=[['Produtos ('+items.reduce((n,x)=>n+x.qty,0)+')',currency(subtotal)],['Frete',isQuick?'Corrida cobrada à parte':shipping===null?'Selecione o frete':currency(shipping)],['Total no checkout',shipping===null&&!isQuick?'A calcular':currency(subtotal+(shipping||0))]];
  const container=q('checkoutTotal');container.replaceChildren();
  for(let i=0;i<rows.length;i++){const line=document.createElement('div');line.className='checkout-summary-row'+(i===2?' total':'');const title=document.createElement('span');title.textContent=rows[i][0];const value=document.createElement('strong');value.textContent=rows[i][1];line.append(title,value);container.append(line)}
 }
 function refreshDelivery(){
  const mode=form.elements.delivery.value,delivery=mode!=='pickup';
  q('mahachPaymentStepNumber').textContent=delivery?'04':'03';
  q('deliveryAddress').hidden=!delivery;form.elements.cep.required=delivery;for(const name of ['street','addressNumber','neighborhood','city','state'])form.elements[name].required=delivery;
  q('quoteShipping').hidden=mode!=='transportadora';
  const cash=form.querySelector('[name="payment"][value="cash"]');cash.disabled=delivery;
  if(cash.checked&&delivery)form.querySelector('[name="payment"][value="pix"]').checked=true;
  selectedQuote='';selectedCost=null;q('shippingResults').replaceChildren();q('shippingSelection').textContent='';
  q('checkoutShippingNotice').textContent=mode==='transportadora'?'Insira seu CEP e escolha uma transportadora habilitada para perfumes antes de pagar.':delivery?'Uber/99: a corrida NÃO está incluída no total e será combinada separadamente com a LA COUR.':pickupAddress?'Retirada sem frete. Local: '+pickupAddress:'Retirada sem frete. Endereço e horário serão informados pela loja.';
  updateTotal();updateSubmitLabel();
 }
 function updateSubmitLabel(){
  const payment=form.elements.payment.value;
  q('submitOrder').textContent=payment==='cash'?'Registrar pedido para pagar na loja':payment==='pix'?'Gerar QR Code Pix':'Pagar com cartao no Mercado Pago ↗';
  q('pixCpfArea').hidden=payment!=='pix';form.elements.pixCpf.required=payment==='pix';
 }
 form.addEventListener('change',e=>{if(e.target.name==='delivery')refreshDelivery();if(e.target.name==='payment')updateSubmitLabel()});
 let cepTimer=null,cepRequest=0;
 const addressFields=['street','addressNumber','complement','neighborhood','city','state'];
 function composeAddress(){
  const value=n=>String(form.elements[n].value||'').trim();
  const line=value('street')+', '+value('addressNumber')+(value('complement')?', '+value('complement'):'');
  return line+' - '+value('neighborhood')+' - '+value('city')+'/'+value('state').toUpperCase();
 }
 for(const field of addressFields){form.elements[field].addEventListener('input',()=>{form.elements.address.value=composeAddress()});}
 form.elements.cep.addEventListener('input',()=>{
  const cep=form.elements.cep.value.replace(/\D/g,'').slice(0,8);
  form.elements.cep.value=cep.length>5?cep.slice(0,5)+'-'+cep.slice(5):cep;
  ++cepRequest;clearTimeout(cepTimer);
  for(const field of addressFields)form.elements[field].value='';
  form.elements.address.value='';
  selectedQuote='';selectedCost=null;q('shippingResults').replaceChildren();q('shippingSelection').textContent='CEP alterado. Consulte novamente o frete.';updateTotal();
  const status=q('cepLookupStatus');
  if(cep.length!==8){status.textContent=cep?'Digite os oito numeros do CEP.':'';return;}
  status.textContent='Buscando rua, bairro e cidade pelo CEP...';
  const version=cepRequest;
  cepTimer=setTimeout(async()=>{
   try{
    const res=await fetch('/api/address/cep?cep='+encodeURIComponent(cep),{cache:'no-store'});
    const info=await res.json();
    if(version!==cepRequest||form.elements.cep.value.replace(/\D/g,'')!==cep)return;
    if(!res.ok)throw Error(info.error||'CEP nao localizado.');
    for(const [field,key] of [['street','street'],['neighborhood','neighborhood'],['city','city'],['state','state']]){
     if(!String(form.elements[field].value||'').trim())form.elements[field].value=info[key]||'';
    }
    form.elements.address.value=composeAddress();
    status.textContent=info.street?'Endereco encontrado! Informe somente o numero e, se necessario, o complemento.':'Cidade e bairro consultados. Este CEP nao identifica uma rua; preencha a rua e o numero.';
    if(info.street)form.elements.addressNumber.focus();
   }catch(err){if(version===cepRequest)status.textContent=err.message+' Voce pode preencher o endereco manualmente.';}
  },450);
 });
 q('quoteShipping').addEventListener('click',async()=>{
  const cep=form.elements.cep.value.replace(/\D/g,''),out=q('shippingResults');selectedQuote='';selectedCost=null;out.replaceChildren();updateTotal();
  if(form.elements.delivery.value!=='transportadora')return;
  if(cep.length!==8){out.textContent='Informe um CEP com oito dígitos.';return}
  q('shippingSelection').textContent='';
  const b=q('quoteShipping');b.disabled=true;out.textContent='Consultando frete…';
  try{
   const response=await fetch('/api/shipping/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cep,items:bagPayload()})});
   const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível cotar o frete');
   if(form.elements.delivery.value!=='transportadora'||form.elements.cep.value.replace(/\D/g,'')!==cep)return;
   out.replaceChildren();q('shippingSelection').textContent='';const options=(data.options||[]);
   if(!options.length){out.textContent='Nenhuma transportadora habilitada para perfumes disponível para este CEP.';return}
   for(const o of options){
    const label=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name='liveShipping';radio.value=o.quoteId;
    radio.addEventListener('change',()=>{selectedQuote=o.quoteId;selectedCost=Number(o.cost);q('shippingSelection').textContent='Selecionado: '+o.carrier+' · '+o.service+' · '+currency(o.cost);updateTotal()});
    label.append(radio,document.createTextNode(' '+o.carrier+' · '+o.service+': '+currency(o.cost)+' · '+o.days+' dias estimados'));out.append(label);
   }
  }catch(e){out.textContent=e.message}finally{b.disabled=false}
 });
 function showRegisteredOrder(result){
  activeOrder={reference:result.reference,token:result.token};
  const isPix=result.mode==='pix'||result.mode==='pix-retry';
  form.hidden=true;side.hidden=true;d.classList.add('mahach-success');q('orderSuccess').hidden=false;d.querySelector('.checkout-steps').hidden=true;d.querySelector('.checkout-intro').hidden=true;
  d.querySelector('.checkout-head-sub').hidden=true;
  q('checkoutTitle').textContent=isPix?'Pagamento Pix':'Pedido registrado';
  q('orderSuccess').dataset.phase=isPix?'payment':'registered';
  q('orderSuccess').querySelector('.order-eyebrow').textContent=isPix?'LA COUR · PAGAMENTO SEGURO':'LA COUR · PEDIDO';
  q('orderHeading').hidden=isPix;q('orderHeading').textContent='Pedido registrado';
  q('orderReference').textContent='Pedido: '+result.reference;q('orderReference').hidden=isPix;
  q('orderInstructions').textContent=isPix?'':(result.notice||'Pedido recebido. Aguarde a confirmação da loja.');q('orderInstructions').hidden=isPix;
  q('orderTrack').hidden=true;
  const track=new URL('/acompanhar.html',location.origin);track.searchParams.set('reference',result.reference);track.searchParams.set('token',result.token);q('orderTrack').href=track.href;
  d.scrollTop=0;q('orderSuccess').focus({preventScroll:true});
 }
 // O pagamento tem a propria tela. Acompanhamento so aparece apos aprovacao no servidor.
 function showPaymentConfirmed(){
  if(!activeOrder)return;
  q('orderSuccess').dataset.phase='confirmed';
  q('checkoutTitle').textContent='Pagamento confirmado';
  q('orderSuccess').querySelector('.order-eyebrow').textContent='LA COUR · COMPRA CONFIRMADA';
  q('orderHeading').hidden=false;q('orderHeading').textContent='Pagamento aprovado!';
  q('orderReference').hidden=false;
  q('orderInstructions').hidden=false;q('orderInstructions').textContent='Pagamento confirmado pelo Mercado Pago. O pedido segue agora para a loja. Acompanhe o preparo e o envio na página do seu pedido.';
  q('orderPix').hidden=true;q('orderTrack').hidden=false;
  if(pixPoll)clearInterval(pixPoll);pixPoll=null;
  d.scrollTop=0;
 }
 function showPixPending(message,diagnostic){
  const section=q('orderPix');section.hidden=false;
  const img=q('pixQrImage');img.hidden=true;img.removeAttribute('src');
  q('pixCopyValue').value='';q('pixCopyLabel').hidden=true;q('pixCopyButton').hidden=true;
  q('pixRetryButton').hidden=false;q('pixUnavailableMessage').hidden=false;
  q('pixStatus').textContent='Ainda não foi possível carregar os dados do Pix.';
  if(diagnostic && /^[A-Z0-9_-]{3,90}$/.test(String(diagnostic)))q('pixStatus').textContent+=' Referência técnica: '+diagnostic+'.';
  q('orderSuccess').dataset.phase='payment';
 }
 function renderPix(pix){
  const section=q('orderPix');section.hidden=false;
  const copy=String(pix?.qrCode||''),base64=String(pix?.qrCodeBase64||'');
  if(!copy){showPixPending('Os dados do Pix ainda não estão disponíveis. Tente novamente para o mesmo pedido.');return;}
  q('pixUnavailableMessage').hidden=true;
  q('pixCopyValue').value=copy;q('pixCopyLabel').hidden=false;
  const img=q('pixQrImage');img.hidden=true;img.removeAttribute('src');
  if(base64.length<1500000&&/^[A-Za-z0-9+/=]+$/.test(base64)){
   img.src='data:'+(base64.startsWith('/9j/')?'image/jpeg':'image/png')+';base64,'+base64;
   img.hidden=false;
  }
  q('pixRetryButton').hidden=true;q('pixCopyButton').hidden=false;
  q('pixStatus').textContent=img.hidden?'QR Code indisponível no momento. Use o Pix Copia e Cola. Aguarde a confirmação.':'Aguardando confirmação do Mercado Pago. Não pague duas vezes.';
  q('orderSuccess').dataset.phase='payment';
  startPixPolling();
 }
 q('pixQrImage').addEventListener('error',()=>{
  const img=q('pixQrImage');img.hidden=true;img.removeAttribute('src');
  if(q('pixCopyValue').value)q('pixStatus').textContent='O QR Code não carregou. Utilize o Pix Copia e Cola abaixo.';
 });
 async function pollPix(){
  if(!activeOrder||!d.open)return;
  try{
   const response=await fetch('/api/payments/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(activeOrder),cache:'no-store'});
   if(!response.ok)return;
   const data=await response.json();
   if(data.paymentStatus==='aprovado')showPaymentConfirmed();
  }catch{} // O webhook e a consulta segura ao servidor confirmam o pagamento.
 }
 function startPixPolling(){if(pixPoll)clearInterval(pixPoll);pollPix();pixPoll=setInterval(pollPix,6500)}
 q('pixCopyButton').addEventListener('click',async()=>{
  const value=q('pixCopyValue').value;if(!value)return;
  try{await navigator.clipboard.writeText(value);q('pixStatus').textContent='Codigo Pix copiado. Aguardando confirmacao.';}
  catch{q('pixCopyValue').focus();q('pixCopyValue').select();q('pixStatus').textContent='Selecione e copie o codigo Pix acima.';}
 });
 q('pixRetryButton').addEventListener('click',async()=>{
  if(!activeOrder)return;
  const b=q('pixRetryButton');b.disabled=true;q('pixStatus').textContent='Consultando o mesmo Pix...';
  try{
   const response=await fetch('/api/payments/pix/retry',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...activeOrder,pixCpf:form.elements.pixCpf.value})});
   const data=await response.json();if(!response.ok)throw Error((data.error||'Nao foi possivel gerar Pix')+(data.diagnostic?' Referência técnica: '+String(data.diagnostic).slice(0,90):''));
   if(data.paid){showPaymentConfirmed();return;}
   renderPix(data.pix);
  }catch(err){showPixPending(err.message||'Não foi possível gerar o Pix agora. Tente novamente para o mesmo pedido.');}finally{b.disabled=false}
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!checkoutEnabled)return;
  updateSubmitLabel(); // Campo CPF precisa estar visivel antes da validacao do navegador.
  if(!form.reportValidity())return;
  const delivery=form.elements.delivery.value,payment=form.elements.payment.value,error=q('checkoutError');error.hidden=true;
  if(delivery==='transportadora'&&!selectedQuote){error.textContent='Selecione um frete antes de pagar.';error.hidden=false;return}
  if(payment!=='cash'&&!onlinePayments){error.textContent='Pagamento online ainda não configurado. Contate a loja.';error.hidden=false;return}
  const b=q('submitOrder');b.disabled=true;b.textContent='Registrando pedido…';
  try{
   const data=Object.fromEntries(new FormData(form));if(payment!=='pix')delete data.pixCpf;data.address=form.elements.delivery.value==='pickup'?'':composeAddress();data.marketingOptIn=form.elements.marketingOptIn.checked;
   if(form.elements.delivery.value!=='pickup'&&data.address.length>320)throw Error('Endereco muito longo. Reduza o complemento antes de continuar.');
   const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,quoteId:selectedQuote,items:bagPayload()})});
   const result=await response.json();if(!response.ok)throw Error(result.error||'Não foi possível registrar o pedido');
   // A referência e o token permanecem no navegador; não entram no URL enviado ao Mercado Pago.
   try{sessionStorage.setItem('mahach-order-token-'+result.reference,result.token);sessionStorage.setItem('mahach-last-order',JSON.stringify({reference:result.reference,token:result.token}))}catch{}
   try{localStorage.removeItem('mahach-bag')}catch{}
   if(result.mode==='online'){
    const url=new URL(result.checkoutUrl||'');
    if(url.protocol!=='https:'||!/(^|\.)mercadopago\.com(\.br)?$/.test(url.hostname))throw Error('Link de pagamento invalido. O pedido foi registrado; entre em contato com a loja.');
    window.location.assign(url.href);return;
   }
   showRegisteredOrder(result);
   if(result.mode==='pix')renderPix(result.pix);
   else if(result.mode==='pix-retry'){
    showPixPending('Não foi possível carregar o Pix.',result.diagnostic);
   }
  }catch(err){error.textContent=err.message;error.hidden=false}finally{b.disabled=false;updateSubmitLabel()}
 });
})();
