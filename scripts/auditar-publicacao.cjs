'use strict';
// Consulta somente leitura; não mostra senhas, chaves ou URLs completas.
const fs=require('node:fs');
const path=require('node:path');
const {Client}=require('pg');
const root=path.resolve(__dirname,'..');
function report(name,ok,note=''){console.log((ok?'OK':'ATENÇÃO')+' — '+name+(note?' — '+note:''))}
(async()=>{
 const url=process.env.DATABASE_URL;
 if(!url){report('DATABASE_URL',false,'Não configurada');process.exitCode=1;return}
 let u;
 try{u=new URL(url);if(!['postgres:','postgresql:'].includes(u.protocol))throw Error('protocolo')}catch{report('DATABASE_URL',false,'Formato inválido');process.exitCode=1;return}
 const key=process.env.MAHACH_SETTINGS_KEY||'';
 report('Chave MAHACH_SETTINGS_KEY',/^[a-f0-9]{64}$/i.test(key)||(/^[a-zA-Z0-9+/]{43}=$/.test(key)), 'necessária em hospedagem');
 report('Foto online (Cloudinary)', ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'].every(k=>!!process.env[k]), 'necessária para novas fotos na Render');
 report('Checkout bloqueado',process.env.MAHACH_ENABLE_CHECKOUT!=='true','obrigatório enquanto não homologado');
 console.log('Endpoint PostgreSQL:',u.hostname); // sem usuário/senha
 const c=new Client({connectionString:url,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:12000});
 try{
  await c.connect();
  const [{rows:count},{rows:images}]=await Promise.all([
   c.query('SELECT COUNT(*)::int AS n FROM mahach_stage.products'),
   c.query('SELECT image FROM mahach_stage.products WHERE image IS NOT NULL AND image <> \'\'')
  ]);
  console.log('Produtos no Neon:',count[0].n);
  const local=images.filter(r=>/^\/assets\/produtos\/[a-zA-Z0-9_-]+\.webp$/.test(r.image));
  const online=images.filter(r=>/^https:\/\//.test(r.image));
  const missing=local.filter(r=>!fs.existsSync(path.join(root,r.image.slice(1))));
  console.log('Fotos locais vinculadas:',local.length);
  console.log('Fotos online vinculadas:',online.length);
  console.log('Fotos locais que faltam nesta pasta:',missing.length);
  if(local.length)report('Fotos locais na Render',false,'migre essas fotos para Cloudinary antes do deploy');
  if(missing.length)report('Fotos desaparecidas deste diretório',false,'recupere os arquivos originais, sem apagar referências');
  if(!count[0].n)report('Catálogo',false,'nenhum produto encontrado');
 }catch(e){report('Consulta ao Neon',false,e.message);process.exitCode=1}
 finally{await c.end().catch(()=>{})}
})();
