'use strict';
(async()=>{
 const params=new URLSearchParams(location.search),reference=params.get('reference')||'';
 let token='';try{token=sessionStorage.getItem('mahach-order-token-'+reference)||''}catch{}
 // Links de pedidos criados por versões antigas ainda podem conter token.
 if(!token)token=params.get('token')||'';
 const message=document.querySelector('#paymentMessage'),track=document.querySelector('#trackOrder'),wa=document.querySelector('#quickDelivery');
 if(!/^MH-[A-F0-9]{10,24}$/.test(reference)||!token){message.textContent='Não foi possível recuperar os dados do pedido neste navegador. Consulte o acompanhamento ou entre em contato com a loja com o número do pedido.';return}
 const trackUrl=new URL('/acompanhar.html',location.origin);trackUrl.searchParams.set('reference',reference);trackUrl.searchParams.set('token',token);track.href=trackUrl.pathname+trackUrl.search;
 let attempts=0;
 async function checkStatus(){
  try{
   const q=new URLSearchParams({reference,token}),res=await fetch('/api/payments/status?'+q,{cache:'no-store'}),data=await res.json();
   if(!res.ok)throw Error('Pedido não encontrado');
   const approved=data.paymentStatus==='aprovado';
   const terminal={recusado:'Pagamento recusado. Consulte a loja antes de tentar novamente.',cancelado:'Pagamento cancelado. Nenhuma aprovação foi confirmada.',reembolsado:'Pagamento reembolsado. Consulte o acompanhamento.',contestacao:'Pagamento em contestação. Entre em contato com a loja.'};
   if(terminal[data.paymentStatus]){message.textContent=terminal[data.paymentStatus];return;}
   message.textContent=approved?'Pagamento confirmado. Seu pedido está registrado e será preparado pela loja.':
    'Pedido registrado. Aguardando confirmação segura do Mercado Pago. Não faça um novo pagamento sem consultar o pedido.';
   if(approved&&data.whatsapp&&data.whatsapp.startsWith('https://wa.me/')){wa.href=data.whatsapp;wa.hidden=false}
   if(!approved&&++attempts<8)setTimeout(checkStatus,5000);
  }catch{
   message.textContent='Não foi possível consultar o status agora. Consulte o acompanhamento do pedido antes de tentar pagar novamente.';
  }
 }
 await checkStatus();
})();
