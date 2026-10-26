'use strict';
const {parse,cleanCategory}=require('./csv-import');
const crypto=require('node:crypto');
function slug(value){return cleanCategory(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)}
const aliases={'perfumes':'perfumes','perfumaria':'perfumes','corpo-e-cuidado':'corpo','corpo-e-cuidados':'corpo','beleza-essencial':'corpo','beleza':'corpo','corpo':'corpo'};
async function importIntoPg(db,raw,searchText,secureUrl){
 const rows=parse(raw);if(rows.length>10000)throw Error('Limite de 10.000 produtos por arquivo');
 return db.transaction(async()=>{
  const insertCategory=db.prepare('INSERT OR IGNORE INTO categories(id,name,subtitle) VALUES(?,?,?)');
  const getOld=db.prepare('SELECT * FROM products WHERE id=?');
  const upsert=db.prepare(`INSERT INTO products(id,name,price,description,category,brand,family,image,sku,stock,weight,width,height,length,active,search_text)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,price=excluded.price,description=excluded.description,
   category=excluded.category,brand=excluded.brand,sku=excluded.sku,stock=excluded.stock,weight=excluded.weight,
   width=excluded.width,height=excluded.height,length=excluded.length,search_text=excluded.search_text`);
  const existingCats=new Set((await db.prepare('SELECT id FROM categories').all()).map(x=>x.id));
  let inserted=0,updated=0,newCategories=0,skipped=0;
  for(const row of rows){
   if(!row.name||row.name.length>220){skipped++;continue}
   const price=Number(String(row.price).replace(',','.'));if(!Number.isFinite(price)||price<0||price>100000){skipped++;continue}
   const id=/^[\w-]{5,80}$/.test(row.id)?row.id:'csv-'+crypto.createHash('sha256').update(row.sku+'|'+row.name).digest('hex').slice(0,24);
   const old=await getOld.get(id);let cat=cleanCategory(row.category),categoryId=aliases[slug(cat)];
   const brandLike=!row.hasShopCategory&&cat&&cat===cat.toUpperCase()&&!aliases[slug(cat)];
   if(brandLike)categoryId=old?.category||(/CREME|SKIN|HIDRAT|SABONETE|SHAMPOO/i.test(row.name)?'corpo':'perfumes');
   else if(!categoryId&&cat){categoryId=slug(cat);if(categoryId&&!existingCats.has(categoryId)){await insertCategory.run(categoryId,cat,'');existingCats.add(categoryId);newCategories++}}
   categoryId=categoryId||old?.category||'perfumes';
   const value=v=>{const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>0&&n<10000?n:null};
   const stock=row.stock===''?old?.stock??null:Number(row.stock),safeStock=Number.isInteger(stock)&&stock>=0?stock:null;
   const p={name:row.name,description:row.description.slice(0,10000),price,category:categoryId,
    brand:row.brand||(brandLike?cat:old?.brand||''),family:old?.family||'',sku:row.sku||old?.sku||'',
    image:secureUrl(row.image)||old?.image||'',stock:safeStock,weight:value(row.weight)||old?.weight||null,
    width:value(row.width)||old?.width||null,height:value(row.height)||old?.height||null,length:value(row.length)||old?.length||null,active:old?.active??1};
   await upsert.run(id,p.name,p.price,p.description,p.category,p.brand,p.family,p.image,p.sku,p.stock,p.weight,p.width,p.height,p.length,p.active,searchText(p));
   if(old)updated++;else inserted++;
  }
  if(!inserted&&!updated)throw Error('Nenhum produto válido no CSV. Confira o cabeçalho e os preços.');
  return {read:rows.length,inserted,updated,newCategories,skipped};
 });
}
module.exports={importIntoPg,cleanCategory};
