'use strict';
(async()=>{const message=document.getElementById('paymentResult'),qs=new URLSearchParams(location.search),reference=qs.get('reference'),token=qs.get('token');if(!reference||!token){message.textContent='Não foi possível consultar este pedido. Confira seu e-mail ou contate a loja.';return}for(let i=0;i<5;i++){try{const result=await fetch('/api/payments/status?'+new URLSearchParams({reference,token}),{cache:'no-store'});const data=await result.json();if(!result.ok)throw Error(data.error||'Pedido não encontrado');if(data.paymentStatus==='aprovado'){
 message.textContent='Pagamento dos produtos aprovado e confirmado no servidor. Obrigado pela compra!';
 if((data.delivery==='uber'||data.delivery==='99')&&data.whatsapp){
  const note=document.getElementById('quickDeliveryNote'),link=document.getElementById('quickDeliveryWhatsapp');
  note.hidden=false;link.hidden=false;link.href=data.whatsapp;
 }
 return;
}message.textContent='Pagamento ainda não confirmado. Se você acabou de pagar, aguarde o processamento. Não é necessário pagar novamente.'}catch(err){message.textContent=err.message;return}if(i<4)await new Promise(resolve=>setTimeout(resolve,2500))}})();
