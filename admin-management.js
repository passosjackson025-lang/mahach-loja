'use strict';
const ZONE='America/Sao_Paulo';
const ORDER_STATUSES=['pedido_criado','aguardando_confirmacao','pagamento_aprovado','estoque_pendente','em_preparacao','enviado','pronto_retirada','concluido','cancelado'];
function invalid(message){return Object.assign(Error(message),{status:400})}
function dateRange(params){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const end=params.get('to')||today;if(!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(Date.parse(end+'T12:00:00Z')))throw invalid('Informe datas válidas');const start=params.get('from')||new Date(Date.parse(end+'T12:00:00Z')-29*86400000).toISOString().slice(0,10);
 for(const d of [start,end])if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(Date.parse(d+'T12:00:00Z'))||new Date(d+'T12:00:00Z').toISOString().slice(0,10)!==d)throw invalid('Informe datas válidas');
 if(start>end||Date.parse(end)-Date.parse(start)>366*86400000)throw invalid('Selecione um período de até 367 dias');
 return {start,end};
}
async function updateStoreCategories(db){
 const marker='lacour_body_care_v5';if(await db.prepare('SELECT key FROM site_settings WHERE key=?').get(marker))return;
 await db.transaction(async()=>{
  await db.prepare("UPDATE categories SET name='Perfumes',subtitle='Fragrâncias para todos os estilos' WHERE id='perfumes'").run();
  await db.prepare("INSERT OR IGNORE INTO categories(id,name,subtitle) VALUES('corpo','Corpo e cuidado','Seu ritual diário de autocuidado')").run();
  await db.prepare("UPDATE categories SET name='Corpo e cuidado' WHERE id='corpo'").run();
  await db.prepare("UPDATE products SET category='corpo' WHERE category='beleza'").run();
  await db.prepare("DELETE FROM categories WHERE id='beleza'").run();
  await db.prepare('INSERT OR IGNORE INTO site_settings(key,value,encrypted,updated_at) VALUES(?,?,?,?)').run(marker,'applied',0,new Date().toISOString());
 });
}
async function dashboard(db,params){
 const {start,end}=dateRange(params),args=[start,end];
 const range="created::timestamptz >= (?::date AT TIME ZONE 'America/Sao_Paulo') AND created::timestamptz < ((?::date+1) AT TIME ZONE 'America/Sao_Paulo')";
 const paid="payment_status='aprovado' AND status<>'cancelado'";
 const summary=await db.prepare(`SELECT COUNT(*)::int orders,COUNT(*) FILTER(WHERE ${paid})::int paid_orders,COALESCE(SUM(subtotal+COALESCE(shipping_cost,0)) FILTER(WHERE ${paid}),0)::float8 revenue,COUNT(*) FILTER(WHERE ${paid} AND delivery<>'pickup' AND status NOT IN ('enviado','concluido'))::int awaiting_shipment FROM orders WHERE ${range}`).get(...args);
 summary.average_order=summary.paid_orders?Math.round(summary.revenue/summary.paid_orders*100)/100:0;
 const daily=await db.prepare(`SELECT to_char(created::timestamptz AT TIME ZONE '${ZONE}','YYYY-MM-DD') AS day,COUNT(*)::int orders,COALESCE(SUM(subtotal+COALESCE(shipping_cost,0)) FILTER(WHERE ${paid}),0)::float8 revenue FROM orders WHERE ${range} GROUP BY 1 ORDER BY 1`).all(...args);
 const statuses=await db.prepare(`SELECT status,COUNT(*)::int count FROM orders WHERE ${range} GROUP BY status ORDER BY count DESC,status`).all(...args);
 const topProducts=await db.prepare(`SELECT item->>'id' id,item->>'name' name,SUM((item->>'qty')::int)::int quantity,SUM((item->>'qty')::int*(item->>'unit_price')::numeric)::float8 revenue FROM orders CROSS JOIN LATERAL jsonb_array_elements(items_json::jsonb) item WHERE ${range} AND ${paid} GROUP BY 1,2 ORDER BY quantity DESC,name LIMIT 5`).all(...args);
 const recent=await db.prepare(`SELECT id,customer_name,status,payment_status,subtotal,shipping_cost,created FROM orders WHERE ${range} ORDER BY created DESC,id LIMIT 5`).all(...args);
 const lowStock=await db.prepare('SELECT id,name,sku,stock FROM products WHERE active=1 AND stock<=5 ORDER BY stock,name LIMIT 8').all();
 const inventory=await db.prepare('SELECT COUNT(*)::int products,COUNT(*) FILTER(WHERE active=1)::int visible,COUNT(*) FILTER(WHERE active=1 AND stock=0)::int out_of_stock,COUNT(*) FILTER(WHERE active=1 AND stock>0 AND stock<=5)::int low_stock,COUNT(*) FILTER(WHERE active=1 AND stock IS NULL)::int unknown_stock FROM products').get();
 const days=new Map(daily.map(x=>[x.day,x]));const sales=[];for(let t=Date.parse(start+'T12:00:00Z');t<=Date.parse(end+'T12:00:00Z');t+=86400000){const day=new Date(t).toISOString().slice(0,10);sales.push(days.get(day)||{day,revenue:0,orders:0})}
 return {from:start,to:end,timeZone:ZONE,summary,daily:sales,statuses,topProducts,recent,lowStock,inventory};
}
async function findOrders(db,params){
 const q=String(params.get('q')||'').trim().slice(0,160),status=params.get('status')||'',payment=params.get('paymentStatus')||'',page=Math.max(1,Math.min(100000,parseInt(params.get('page'),10)||1));
 const terms=[],args=[];
 if(q){terms.push('(id ILIKE ? OR customer_name ILIKE ? OR customer_email ILIKE ?)');args.push(...Array(3).fill('%'+q.replace(/[\\%_]/g,'\\$&')+'%'))}
 if(status){if(!ORDER_STATUSES.includes(status))throw invalid('Status inválido');terms.push('status=?');args.push(status)}
 if(payment){if(!['aprovado','pendente'].includes(payment))throw invalid('Pagamento inválido');terms.push('payment_status=?');args.push(payment)}
 const where=terms.length?' WHERE '+terms.join(' AND '):'';
 const total=(await db.prepare('SELECT COUNT(*)::int total FROM orders'+where).get(...args)).total;
 const rows=await db.prepare('SELECT * FROM orders'+where+' ORDER BY created DESC,id LIMIT 30 OFFSET ?').all(...args,(page-1)*30);
 return {page,total,limit:30,orders:rows.map(({public_token_hash,items_json,...o})=>({...o,items:JSON.parse(items_json)}))};
}
module.exports={ORDER_STATUSES,dateRange,updateStoreCategories,dashboard,findOrders};
