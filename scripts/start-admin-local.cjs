'use strict';
// Inicia a LA COUR localmente com salvamento no painel liberado e checkout bloqueado.
// As edições são reais no banco Neon apontado por DATABASE_URL.
const {spawn}=require('node:child_process');
if(process.env.NODE_ENV==='production'||process.env.RENDER==='true'||process.env.RENDER_SERVICE_ID){
 console.error('admin:local é exclusivo para computador local; não execute na Render.');
 process.exit(1);
}
if(!process.env.DATABASE_URL){
 console.error('DATABASE_URL ausente neste Git Bash. Configure-a de forma privada antes de continuar.');
 process.exit(1);
}
console.log('LA COUR ADMIN LOCAL: gravações HABILITADAS no Neon configurado. Checkout DESATIVADO.');
const child=spawn(process.execPath,['--env-file-if-exists=.env','server.js'],{
 stdio:'inherit',env:{...process.env,HOST:'127.0.0.1',MAHACH_ENABLE_ADMIN_WRITES:'true',MAHACH_ENABLE_CHECKOUT:'false'}
});
child.on('error',e=>{console.error('Falha ao iniciar:',e.message);process.exitCode=1});
child.on('exit',(code,signal)=>{if(code!==null)process.exitCode=code;else if(signal)process.exitCode=1});
for(const sig of ['SIGINT','SIGTERM'])process.on(sig,()=>{if(!child.killed)child.kill(sig)});
