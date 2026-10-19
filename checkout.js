'use strict';
// MAHACH Checkout. Os dados do cartão NÃO passam por este site.
(function(){
 const markup=`<dialog class="checkout-dialog" id="checkoutDialog" aria-labelledby="checkoutTitle">
 <div class="checkout-head"><div><span class="eyebrow">MAHACH · SUA COMPRA</span><h2 id="checkoutTitle">Finalizar compra.</h2></div><button type="button" data-checkout-close aria-label="Fechar">×</button></div>
 <div class="checkout-body"><div class="checkout-steps" aria-label="Etapas"><span>1. Identificação</span><span>2. Entrega</span><span>3. Pagamento</span><span>4. Acompanhamento</span></div>
 <p class="checkout-intro">Confira os produtos, informe seus dados e escolha o frete. Pix com QR Code e Copia e Cola aqui na MAHACH; para cartao, voce sera direcionado ao Mercado Pago.</p>
 <form id="checkoutForm">
  <div class="checkout-fields"><label>Seu nome completo<input name="name" autocomplete="name" minlength="3" maxlength="120" required></label><label>WhatsApp com DDD<input name="phone" autocomplete="tel" inputmode="tel" pattern="[0-9()+\\s-]{10,20}" placeholder="(11) 99999-9999" required></label><label>E-mail para confirmação do pedido<input type="email" name="email" autocomplete="email" maxlength="200" required></label></div>
  <fieldset><legend>Como deseja receber?</legend><div class="checkout-options">
   <label><input type="radio" name="delivery" value="pickup" checked> Retirar na loja (sem frete)</label>
   <label><input type="radio" name="delivery" value="transportadora"> Receber por transportadora (calcular frete)</label>
   <label><input type="radio" name="delivery" value="uber"> Uber (corrida paga separadamente; valor a combinar)</label>
   <label><input type="radio" name="delivery" value="99"> 99Entrega (corrida paga separadamente; valor a combinar)</label>
  </div></fieldset>
  <div id="deliveryAddress" hidden><div class="checkout-fields">
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
  <fieldset><legend>Como deseja pagar?</legend><div class="checkout-options" id="paymentOptions">
   <label><input type="radio" name="payment" value="pix" checked> Pix com QR Code na MAHACH</label>
   <label><input type="radio" name="payment" value="card"> Cartao de credito no Mercado Pago</label>
   <label><input type="radio" name="payment" value="cash"> Pagar na loja ao retirar (sem pagamento online)</label>
  </div></fieldset>
  <div id="pixCpfArea" class="checkout-pix-cpf"><label>CPF do pagador (solicitado pelo Mercado Pago para o Pix)<input name="pixCpf" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00"></label><small>Usado somente para gerar o Pix; a MAHACH nao armazena esse documento.</small></div>
  <p class="checkout-notice" id="checkoutShippingNotice">Retirada sem frete. Confirme o endereço e o horário antes de ir à loja.</p>
  <div class="checkout-total checkout-summary" id="checkoutTotal" role="status" aria-live="polite"></div>
  <label class="checkout-marketing"><input type="checkbox" name="marketingOptIn" value="on"> Quero receber ofertas e novidades da MAHACH por e-mail e WhatsApp. Posso cancelar a autorização quando quiser.</label>
  <p class="checkout-legal">Usaremos seus dados para processar o pedido, mesmo que você não aceite marketing. Consulte a <a href="/privacidade.html" target="_blank" rel="noopener noreferrer">Política de Privacidade</a>. A MAHACH não recebe nem armazena os dados completos do cartão.</p>
  <p id="checkoutError" class="checkout-error" role="alert" hidden></p>
  <button class="button" id="submitOrder" type="submit">Continuar para o pagamento seguro ↗</button>
 </form>
 <div id="orderSuccess" hidden><h3>Pedido registrado!</h3><p id="orderReference"></p><p id="orderInstructions">Acompanhe seu pedido e aguarde as informacoes da loja.</p>
  <section id="orderPix" class="mahach-pix" hidden aria-label="Pagamento Pix">
   <p><strong>Pix da sua compra</strong> — use o app do seu banco para pagar.</p>
   <img id="pixQrImage" alt="QR Code de pagamento Pix gerado pelo Mercado Pago" width="230" height="230">
   <label>Pix Copia e Cola<textarea id="pixCopyValue" readonly rows="3" aria-label="Codigo Pix Copia e Cola"></textarea></label>
   <button type="button" id="pixCopyButton" class="quote-button">Copiar codigo Pix</button>
   <button type="button" id="pixRetryButton" class="quote-button" hidden>Tentar carregar o Pix novamente</button>
   <p id="pixStatus" role="status" aria-live="polite">Aguardando confirmacao do Mercado Pago...</p>
  </section>
  <a id="orderTrack" class="consult-link" target="_blank" rel="noopener noreferrer">Acompanhar pedido</a></div>
 </div></dialog>`;
 const pixCss=document.createElement('link');pixCss.rel='stylesheet';pixCss.href='/pix-checkout.css';document.head.appendChild(pixCss);
 document.body.insertAdjacentHTML('beforeend',markup);
 const d=document.getElementById('checkoutDialog'),form=document.getElementById('checkoutForm'),q=id=>document.getElementById(id);
 let items=[],checkoutEnabled=false,selectedQuote='',selectedCost=null,pickupAddress='',onlinePayments=false,pixPoll=null,activeOrder=null;
 const previewNotice=document.createElement('p');previewNotice.id='checkoutPreviewNotice';previewNotice.textContent='Estamos preparando a MAHACH para compras online. O catálogo está disponível, mas ainda não estamos recebendo pedidos ou pagamentos pelo site.';previewNotice.hidden=true;previewNotice.style.cssText='padding:1.25rem;line-height:1.6;margin:1rem;border:1px solid #ccbfa8;border-radius:10px';form.before(previewNotice);
 function syncAvailability(){if(!d.open)return;form.hidden=!checkoutEnabled;previewNotice.hidden=checkoutEnabled}
 fetch('/api/store/status',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{checkoutEnabled=v?.checkoutEnabled===true;syncAvailability()}).catch(()=>{});
 fetch('/api/meta',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(x=>{pickupAddress=String(x?.pickupAddress||'');onlinePayments=x?.onlinePayments===true;refreshDelivery()}).catch(()=>{});
 d.querySelector('[data-checkout-close]').addEventListener('click',()=>d.close());
 d.addEventListener('close',()=>{if(pixPoll)clearInterval(pixPoll);pixPoll=null;if(!document.querySelector('dialog[open]'))document.body.classList.remove('modal-open')});
 const currency=n=>Number(n).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const bagPayload=()=>items.map(x=>({id:x.id,qty:x.qty}));
 window.openCheckout=function(bag,map){
  if(pixPoll)clearInterval(pixPoll);pixPoll=null;activeOrder=null;
  selectedQuote='';selectedCost=null;form.reset();clearTimeout(cepTimer);++cepRequest;q('cepLookupStatus').textContent='';
  q('orderPix').hidden=true;q('pixQrImage').removeAttribute('src');q('pixCopyValue').value='';
  items=Object.entries(bag).map(([id,qty])=>({id,qty,p:map.get(id)})).filter(x=>x.p);
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
  q('deliveryAddress').hidden=!delivery;form.elements.cep.required=delivery;for(const name of ['street','addressNumber','neighborhood','city','state'])form.elements[name].required=delivery;
  q('quoteShipping').hidden=mode!=='transportadora';
  const cash=form.querySelector('[name="payment"][value="cash"]');cash.disabled=delivery;
  if(cash.checked&&delivery)form.querySelector('[name="payment"][value="pix"]').checked=true;
  selectedQuote='';selectedCost=null;q('shippingResults').replaceChildren();q('shippingSelection').textContent='';
  q('checkoutShippingNotice').textContent=mode==='transportadora'?'Insira seu CEP e escolha uma transportadora habilitada para perfumes antes de pagar.':delivery?'Uber/99: a corrida NÃO está incluída no total e será combinada separadamente com a MAHACH.':pickupAddress?'Retirada sem frete. Local: '+pickupAddress:'Retirada sem frete. Endereço e horário serão informados pela loja.';
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
  form.hidden=true;q('orderSuccess').hidden=false;
  q('orderReference').textContent='Pedido: '+result.reference;
  q('orderInstructions').textContent=result.notice||'Acompanhe o seu pedido.';
  const track=new URL('/acompanhar.html',location.origin);track.searchParams.set('reference',result.reference);track.searchParams.set('token',result.token);q('orderTrack').href=track.href;
 }
 function renderPix(pix){
  const section=q('orderPix');section.hidden=false;
  const copy=String(pix?.qrCode||''),base64=String(pix?.qrCodeBase64||'');
  q('pixCopyValue').value=copy;
  if(base64.length<1500000&&/^[A-Za-z0-9+/=]+$/.test(base64))q('pixQrImage').src='data:'+(base64.startsWith('/9j/')?'image/jpeg':'image/png')+';base64,'+base64;
  else q('pixQrImage').removeAttribute('src');
  q('pixRetryButton').hidden=!!copy;
  q('pixCopyButton').hidden=!copy;
  q('pixStatus').textContent='Aguardando confirmacao do Mercado Pago. Nao pague duas vezes.';
  startPixPolling();
 }
 async function pollPix(){
  if(!activeOrder||!d.open)return;
  try{
   const response=await fetch('/api/payments/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(activeOrder),cache:'no-store'});
   if(!response.ok)return;
   const data=await response.json();
   if(data.paymentStatus==='aprovado'){
    q('pixStatus').textContent='Pagamento confirmado pelo Mercado Pago! Seu pedido sera preparado.';
    q('orderInstructions').textContent='Pagamento aprovado! Acompanhe seu pedido.';
    q('pixQrImage').removeAttribute('src');q('pixCopyValue').value='';q('pixCopyButton').hidden=true;q('pixRetryButton').hidden=true;
    clearInterval(pixPoll);pixPoll=null;
   }
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
   const data=await response.json();if(!response.ok)throw Error(data.error||'Nao foi possivel gerar Pix');
   if(data.paid){q('pixStatus').textContent='Pagamento aprovado.';b.hidden=true;startPixPolling();return;}
   renderPix(data.pix);
  }catch(err){q('pixStatus').textContent=err.message;}finally{b.disabled=false}
 });
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!checkoutEnabled||!form.reportValidity())return;
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
    q('orderPix').hidden=false;q('pixCopyButton').hidden=true;q('pixRetryButton').hidden=false;
    q('pixStatus').textContent='Nao foi possivel exibir o Pix. Use o botao para tentar novamente sem criar outro pedido.';
   }
  }catch(err){error.textContent=err.message;error.hidden=false}finally{b.disabled=false;updateSubmitLabel()}
 });
})();
