'use strict';
const assert=require('node:assert/strict');
const {dateRange,findOrders}=require('../admin-management');
const commerce=require('../commerce-flows');
(async()=>{
 for(const qs of ['to=invalid','from=2026-02-30&to=2026-03-01','from=2026-10-02&to=2026-10-01','from=2020-01-01&to=2026-10-01'])assert.throws(()=>dateRange(new URLSearchParams(qs)));
 assert.deepEqual(dateRange(new URLSearchParams('from=2026-10-01&to=2026-10-25')),{start:'2026-10-01',end:'2026-10-25'});
 const calls=[],db={prepare(sql){return {async get(...args){calls.push({sql,args});return {total:1}},async all(...args){calls.push({sql,args});return [{id:'MH-OLD123',public_token_hash:'private-hash',items_json:'[]'}]}}}};
 const q="' OR 1=1--",orders=await findOrders(db,new URLSearchParams({q,page:'5'}));assert.equal(orders.orders[0].id,'MH-OLD123');assert.equal('public_token_hash' in orders.orders[0],false);assert.ok(calls.every(x=>!x.sql.includes(q)));assert.equal(calls[1].args.at(-1),120);await assert.rejects(()=>findOrders(db,new URLSearchParams('status=unknown')),/Status/);
 const original=global.fetch,conf=k=>({MERCADO_PAGO_ACCESS_TOKEN:'APP_USR-simulated',MERCADO_PAGO_WEBHOOK_SECRET:'secret',PUBLIC_SITE_URL:'https://example.test'}[k]||'');
 try{
  global.fetch=async()=>({ok:true,json:async()=>({id:123,tags:[]})});assert.equal((await commerce.validateConnection(conf)).ready,true);
  global.fetch=async()=>({ok:true,json:async()=>({id:123,tags:['test_user']})});assert.equal((await commerce.validateConnection(conf)).ready,false);
  global.fetch=async()=>({ok:false,status:401});assert.equal((await commerce.validateConnection(conf)).reason,'authentication_http_401');
  global.fetch=async()=>{throw Error('offline')};assert.equal((await commerce.validateConnection(conf)).ready,false);assert.equal((await commerce.validateConnection(()=>'' )).reason,'missing_configuration');
 }finally{global.fetch=original}
 console.log('GESTÃO OK: datas válidas, paginação/busca parametrizada, tokens privados e liberação condicionada à autenticação de pagamentos. Nenhuma cobrança real.');
})().catch(e=>{console.error(e);process.exitCode=1});
