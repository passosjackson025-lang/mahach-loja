'use strict';
/* Migra links LOCAIS de fotos para Cloudinary sem apagar nem reescrever fotos antigas.
 * Sem --apply: SOMENTE auditoria. --apply: upload remoto + atualizacao condicional Neon.
 */
const fs=require('node:fs');
const path=require('node:path');
const {Client}=require('pg');
const {savePhoto,imageStorageStatus}=require('../image-storage');
const root=path.resolve(__dirname,'..');
const apply=process.argv.includes('--apply');
const pat=/^\/assets\/produtos\/[a-zA-Z0-9_-]+\.webp$/;
(async()=>{
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL ausente neste terminal.');
 const url=new URL(process.env.DATABASE_URL);
 if(!url.hostname.endsWith('.neon.tech'))throw Error('Este script só permite a conexão direta ao Neon.');
 const pg=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:true},connectionTimeoutMillis:12000});
 try{
  await pg.connect();
  const {rows}=await pg.query('SELECT id,image FROM mahach_stage.products WHERE image LIKE $1',['/assets/produtos/%']);
  const candidates=rows.filter(r=>pat.test(r.image));
  const missing=candidates.filter(r=>!fs.existsSync(path.join(root,r.image.slice(1))));
  console.log('Fotos locais vinculadas:',candidates.length);
  console.log('Arquivos ausentes nesta pasta:',missing.length);
  if(!apply){console.log('SIMULAÇÃO. Nenhum upload ou dado alterado.');return}
  if(imageStorageStatus()!=='cloudinary')throw Error('Configure as três variáveis CLOUDINARY_* de modo privado no Git Bash antes de --apply.');
  if(missing.length)throw Error('Não é seguro migrar com arquivos ausentes. Recupere-os primeiro na pasta assets/produtos.');
  let done=0;
  for(const {id,image} of candidates){
   const bytes=fs.readFileSync(path.join(root,image.slice(1)));
   if(bytes.length>4*1024*1024)throw Error('Foto maior que 4 MB. ID: '+id);
   const uploaded=await savePhoto(bytes,root);
   const updated=await pg.query('UPDATE mahach_stage.products SET image=$1 WHERE id=$2 AND image=$3 RETURNING id',[uploaded,id,image]);
   if(updated.rowCount!==1)throw Error('Produto modificado concorrentemente. Verifique foto do ID: '+id);
   done++;console.log('Foto migrada:',done,'/',candidates.length);
  }
  console.log('FINALIZADO. Fotos migradas:',done,'; arquivos originais preservados.');
 }finally{await pg.end().catch(()=>{})}
})().catch(e=>{console.error('MIGRAÇÃO INTERROMPIDA:',e.message);process.exitCode=1});
