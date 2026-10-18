'use strict';
const crypto=require('node:crypto');
const {db,ready}=require('../server');
async function hidden(question){return new Promise((resolve,reject)=>{if(!process.stdin.isTTY)return reject(Error('Terminal interativo necessário'));process.stdout.write(question);let result='';process.stdin.setRawMode(true);process.stdin.resume();const fn=b=>{for(const ch of b.toString()){if(ch==='\r'||ch==='\n'){process.stdin.off('data',fn);process.stdin.setRawMode(false);process.stdout.write('\n');return resolve(result)}if(ch==='\u0003'){process.stdin.setRawMode(false);process.exit(130)}if(ch==='\u007f')result=result.slice(0,-1);else if(result.length<1024)result+=ch}};process.stdin.on('data',fn)})}
async function main(){await ready;let email=process.env.MAHACH_ADMIN_EMAIL,password=process.env.MAHACH_ADMIN_PASSWORD;
 if(!email){const readline=require('node:readline/promises');const rl=readline.createInterface({input:process.stdin,output:process.stdout});email=(await rl.question('E-mail administrador: ')).trim().toLowerCase();rl.close()}
 if(!password)password=await hidden('Senha (não aparece na tela): ');
 if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||email.length>180)throw Error('E-mail inválido');
 if(password.length<14)throw Error('Escolha uma senha com pelo menos 14 caracteres');
 const salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(password,salt,64).toString('hex');
 await db.transaction(async()=>{
  await db.prepare('INSERT INTO admins(email,salt,hash) VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET salt=excluded.salt,hash=excluded.hash').run(email,salt,hash);
  await db.prepare('DELETE FROM sessions WHERE email=?').run(email);
 });
 console.log('Administrador criado/atualizado:',email);
}
main().catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.close());
