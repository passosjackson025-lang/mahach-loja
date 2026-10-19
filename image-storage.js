'use strict';
// Imagens persistentes em produção via Cloudinary; disco local SOMENTE em desenvolvimento.
// Nenhuma chave de Cloudinary é retornada ao navegador ou armazenada no catálogo.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const REQUIRED=['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'];
const config=()=>Object.fromEntries(REQUIRED.map(k=>[k,process.env[k]||'']));
function imageStorageStatus(){
 const c=config(),defined=REQUIRED.filter(k=>c[k]).length;
 if(defined===REQUIRED.length)return 'cloudinary';
 if(defined>0)return 'incomplete';
 return (process.env.NODE_ENV==='production'||process.env.RENDER==='true'||!!process.env.RENDER_SERVICE_ID)?'unavailable':'local';
}
function httpError(message,status=503){return Object.assign(new Error(message),{status})}
async function savePhoto(bytes,root){
 const mode=imageStorageStatus();
 if(mode==='incomplete')throw httpError('Cloudinary parcialmente configurado. Informe CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no servidor.');
 if(mode==='unavailable')throw httpError('Fotos precisam de armazenamento persistente na hospedagem. Configure Cloudinary antes de fazer upload em produção.');
 if(mode==='local'){
  // O caminho local é útil para testar no próprio computador, mas NÃO persiste na Render.
  const dir=path.join(root,'assets','produtos');fs.mkdirSync(dir,{recursive:true,mode:0o755});
  const filename=crypto.randomBytes(18).toString('hex')+'.webp';
  fs.writeFileSync(path.join(dir,filename),bytes,{flag:'wx',mode:0o644});
  return '/assets/produtos/'+filename;
 }
 const c=config();
 if(!/^[a-zA-Z0-9_-]{1,64}$/.test(c.CLOUDINARY_CLOUD_NAME)||!/^\d{8,30}$/.test(c.CLOUDINARY_API_KEY))throw httpError('Cloudinary: cloud name ou API key com formato inválido.');
 const timestamp=Math.floor(Date.now()/1000);
 const folder='mahach/produtos';
 const publicId=crypto.randomBytes(18).toString('hex');
 // Cloudinary: sign lexicographically sorted upload params (excluding file and api_key).
 const toSign=`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${c.CLOUDINARY_API_SECRET}`;
 const signature=crypto.createHash('sha1').update(toSign).digest('hex');
 const form=new FormData();
 form.append('file',new Blob([bytes],{type:'image/webp'}),publicId+'.webp');
 form.append('api_key',c.CLOUDINARY_API_KEY);
 form.append('timestamp',String(timestamp));
 form.append('folder',folder);
 form.append('public_id',publicId);
 form.append('signature',signature);
 let r;
 try{r=await fetch(`https://api.cloudinary.com/v1_1/${c.CLOUDINARY_CLOUD_NAME}/image/upload`,{method:'POST',body:form,signal:AbortSignal.timeout(30000)})}
 catch{throw httpError('Não foi possível enviar a imagem para o armazenamento online. Tente novamente.',502)}

 if(!r.ok){
 const response=await r.json().catch(()=>({}));
 const message=String(response?.error?.message||'');
 const reason=/invalid signature|signature mismatch/i.test(message)?'ASSINATURA_INVALIDA':
  /invalid api key|unknown api key|api key not found|invalid api_key/i.test(message)?'API_KEY_INVALIDA':
  /timestamp|time stamp/i.test(message)?'HORARIO_INVALIDO':
  'AUTORIZACAO_RECUSADA';

 const allowed=new Set('account api authentication authorization blocked cloud credentials denied disabled expired forbidden invalid key missing not permission rejected required secret signature signing suspended timestamp unauthorized unknown unrecognized upload wrong found enabled'.split(' '));
 const details=(message.toLowerCase().match(/[a-z]+/g)||[])
  .filter(word=>allowed.has(word)).slice(0,20).join(' ')||'SEM_DETALHES';
 console.error('[Cloudinary] HTTP '+r.status+' '+reason+' DETALHES='+details);
 throw httpError('O armazenamento recusou o upload (HTTP '+r.status+').',502);
}
 const data=await r.json().catch(()=>({}));
 if(data.resource_type!=='image'||typeof data.secure_url!=='string')throw httpError('O armazenamento não retornou uma URL de imagem válida.',502);
 let parsed;
 try{parsed=new URL(data.secure_url)}catch{throw httpError('URL de imagem inválida retornada pelo armazenamento.',502)}
 if(parsed.protocol!=='https:'||parsed.hostname!=='res.cloudinary.com'||parsed.username||parsed.password||data.secure_url.length>1500)throw httpError('URL do armazenamento não aprovada.',502);
 return data.secure_url;
}
module.exports={savePhoto,imageStorageStatus};
