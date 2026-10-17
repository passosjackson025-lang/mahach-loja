'use strict';
const form=document.querySelector('#trackForm'),status=document.querySelector('#trackStatus');
const query=new URLSearchParams(location.search);let last={};try{last=JSON.parse(localStorage.getItem('mahach-last-order')||'{}')}catch{};for(const key of ['reference','token'])form.elements[key].value=query.get(key)||last[key]||'';
async function fetchStatus(){
 status.textContent='Consultando…';
 try{
  const qs=new URLSearchParams(new FormData(form));const r=await fetch('/api/orders/status?'+qs);const data=await r.json();if(!r.ok)throw Error(data.error);
  const pickup=data.delivery==='pickup';const steps=[['pedido_criado','Pedido criado'],['pagamento_aprovado','Pagamento aprovado'],['em_preparacao','Em separação'],[pickup?'pronto_retirada':'enviado',pickup?'Pronto para retirada':'A caminho'],['concluido','Entregue / retirado']];
  const rank={'pedido_criado':0,'aguardando_confirmacao':0,'pagamento_aprovado':1,'em_preparacao':2,'enviado':3,'pronto_retirada':3,'concluido':4,'cancelado':-1};
  status.replaceChildren();const head=document.createElement('h2');head.textContent=data.status==='cancelado'?'Pedido cancelado':'Acompanhamento do pedido';status.append(head);
  const list=document.createElement('ol');list.className='order-timeline';list.setAttribute('aria-label','Linha do tempo da compra');
  for(let i=0;i<steps.length;i++){const li=document.createElement('li'),number=document.createElement('span'),copy=document.createElement('strong');number.className='timeline-point';number.textContent=String(i+1);copy.textContent=steps[i][1];li.className=rank[data.status]>=i?'timeline-done':'timeline-pending';li.append(number,copy);if(rank[data.status]===i)li.setAttribute('aria-current','step');list.append(li)}status.append(list);
  const note=document.createElement('p');note.textContent=data.status==='pedido_criado'||data.status==='aguardando_confirmacao'?'Pedido registrado, aguardando confirmação da loja e pagamento.':'Atualização informada pela loja.';status.append(note);
  const freight=document.createElement('p');freight.textContent='Frete: '+(data.shipping_cost===null?'A confirmar':'R$ '+Number(data.shipping_cost).toFixed(2).replace('.',','))+' · '+(data.shipping_service||'');status.append(freight);
  if(data.tracking_code){const t=document.createElement('p');t.textContent='Rastreio: '+data.tracking_code;status.append(t);if(data.tracking_url){const a=document.createElement('a');a.href=data.tracking_url;a.rel='noopener noreferrer';a.target='_blank';a.textContent='Acompanhar na transportadora';status.append(a)}}
  else{const t=document.createElement('p');t.textContent='Rastreio ainda não registrado. Para retirada, aguarde a confirmação de disponibilidade.';status.append(t)}
 }catch(e){status.textContent=e.message}
}
form.addEventListener('submit',e=>{e.preventDefault();fetchStatus()});if(form.elements.reference.value&&form.elements.token.value)fetchStatus();
