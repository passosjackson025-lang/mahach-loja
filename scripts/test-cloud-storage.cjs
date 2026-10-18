'use strict';
// Simulação de upload Cloudinary: não há conexões externas ou credenciais reais.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {imageStorageStatus,savePhoto}=require('../image-storage');
async function main(){
 process.env.NODE_ENV='production';
 for(const n of ['CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'])delete process.env[n];
 assert.equal(imageStorageStatus(),'unavailable');
 await assert.rejects(savePhoto(Buffer.alloc(32),__dirname),e=>e.status===503);
 process.env.CLOUDINARY_CLOUD_NAME='cloud_demo';
 process.env.CLOUDINARY_API_KEY='123456789012';
 process.env.CLOUDINARY_API_SECRET='not-a-real-secret';
 assert.equal(imageStorageStatus(),'cloudinary');
 const oldFetch=global.fetch;
 global.fetch=async(url,options)=>{
  assert.equal(url,'https://api.cloudinary.com/v1_1/cloud_demo/image/upload');
  assert.equal(options.method,'POST');
  const f=options.body,folder=f.get('folder'),publicId=f.get('public_id'),timestamp=f.get('timestamp');
  assert.ok(f.get('file'));assert.equal(f.get('api_key'),'123456789012');
  const expected=crypto.createHash('sha1').update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`).digest('hex');
  assert.equal(f.get('signature'),expected);
  return {ok:true,json:async()=>({resource_type:'image',secure_url:'https://res.cloudinary.com/cloud_demo/image/upload/v123/mahach/produtos/example.webp'})};
 };
 try{
  const link=await savePhoto(Buffer.alloc(32),__dirname);
  assert.equal(link,'https://res.cloudinary.com/cloud_demo/image/upload/v123/mahach/produtos/example.webp');
  console.log('CLOUDINARY OK (SIMULADO): assinatura e retorno HTTPS validados.');
 }finally{global.fetch=oldFetch}
}
main().catch(e=>{console.error(e);process.exitCode=1});
