'use strict';
// Testes estáticos preventivos para publicar visualização sem pedidos/pagamentos.
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const pages=['index.html','produtos/index.html','produtos/perfumaria-arabe/index.html','produtos/corpo-e-cuidado/index.html','produtos/todos/index.html'];
for(const file of pages){
 const s=fs.readFileSync(path.join(root,file),'utf8');
 assert.match(s,/<a\s+href="#"\s*>\s*Voltar ao topo/,'Link local em '+file);
 assert.equal((s.match(/Voltar ao topo/g)||[]).length,1,'Link duplicado '+file);
}
const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert.match(server,/img-src 'self' https: data: blob:/);
assert.match(server,/route==='\/api\/store\/status'/);
const admin=fs.readFileSync(path.join(root,'admin/admin.js'),'utf8');
assert.match(admin,/'email':'E-mails transacionais — Resend'/);
const checkout=fs.readFileSync(path.join(root,'checkout.js'),'utf8');
assert.match(checkout,/checkoutEnabled=false/);
assert.match(checkout,/form\.hidden=!checkoutEnabled/);
console.log('PUBLICAÇÃO OK (TESTES ESTÁTICOS): Voltar ao topo nas 5 páginas, prévia da imagem, seção de e-mail, checkout bloqueado por padrão.');
