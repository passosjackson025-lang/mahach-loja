'use strict';
const assert=require('node:assert/strict');
const {applyCatalogFilters}=require('../catalog-filters');
const {SUPPORT_PHONE,SUPPORT_EMAIL,applySupportContactUpdate}=require('../support-contact');
function build(query){const where=[],args=[];applyCatalogFilters(new URLSearchParams(query),where,args);assert.equal(where.join(' ').split('?').length-1,args.length);return {where,args}}
(async()=>{
 for(const section of ['infantil','todos','arabes','importados','nicho','masculino','feminino','unissex'])build('section='+section);
 const p=build('section=arabes&priceMin=199&priceMax=350');assert.deepEqual(p.args.slice(-2),[199,350]);assert.ok(p.where.includes("category='perfumes'"));
 assert.throws(()=>build('section=unknown'),/Categoria/);assert.throws(()=>build('priceMin=400&priceMax=100'),/faixa/);assert.throws(()=>build('priceMax=NaN'),/preço/);assert.throws(()=>build('priceMin=-1'),/preço/);
 let marker=null,calls=[];const db={prepare(sql){return {async get(){return marker},async run(key){marker={key}}}}};const settings={async save(value){calls.push(value)}};
 assert.equal(await applySupportContactUpdate(db,settings),true);assert.equal(calls[0].WHATSAPP,SUPPORT_PHONE);assert.equal(calls[0].ADMIN_EMAIL,SUPPORT_EMAIL);assert.equal(calls[0].SHIPPING_CONTACT_EMAIL,SUPPORT_EMAIL);assert.ok(!Object.hasOwn(calls[0],'MAIL_FROM'));
 assert.equal(await applySupportContactUpdate(db,settings),false);assert.equal(calls.length,1,'edits made later in the admin panel are preserved');
 console.log('CATÁLOGO / CONTATO OK: filtros, parâmetros, limites de preço e atualização única do atendimento.');
})().catch(e=>{console.error(e);process.exitCode=1});
