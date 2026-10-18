'use strict';
(async()=>{
 const params=new URLSearchParams(location.search),reference=params.get('reference')||'',token=params.get('token')||'';
 const message=document.querySelector('#paymentMessage'),track=document.querySelector('#trackOrder'),wa=document.querySelector('#quickDelivery');
 if(!/^MH-[A-F0-9]{10}$/.test(reference)||!token){message.textContent='Dados do pedido incompletos. Consulte o acompanhamento de pedidos.';return}
 const trackUrl=new URL('/acompanhar.html',location.origin);trackUrl.searchParams.set('reference',reference);trackUrl.searchParams.set('token',token);track.href=trackUrl.pathname+trackUrl.search;
 try{
  const q=new URLSearchParams({reference,token});const res=await fetch('/api/payments/status?'+q,{cache:'no-store'});const data=await res.json();if(!res.ok)throw Error('Não foi possível consultar o pedido neste momento.');
  const approved=data.paymentStatus==='aprovado';message.textContent=approved?'Pagamento aprovado. Seu pedido está em andamento.':'Pedido registrado. A confirmação do pagamento ainda está pendente.';
  if(approved&&data.whatsapp&&data.whatsapp.startsWith('https://wa.me/')){wa.href=data.whatsapp;wa.hidden=false}
 }catch{message.textContent='Não foi possível consultar o status agora. Tente novamente na página de acompanhamento.'}
})();
