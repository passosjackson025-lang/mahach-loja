'use strict';
// RFC4180-compatible semicolon or comma CSV parser (including multiline HTML descriptions).
const emoji=/[\p{Extended_Pictographic}\p{Regional_Indicator}\uFE0E\uFE0F\u200D\u20E3]/gu;
function cleanCategory(value){return String(value||'').replace(emoji,'').replace(/\s+/g,' ').replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu,'').slice(0,90)}
function slug(value){return cleanCategory(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,64)}
function parse(text){
 const first=(text.replace(/^\uFEFF/,'').split(/\r?\n/,1)[0]||'');const separator=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
 text=text.replace(/^\uFEFF/,'');let rows=[],record=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted;continue}
  if(!quoted&&c===separator){record.push(field);field='';continue}
  if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;record.push(field);if(record.some(x=>x.trim()))rows.push(record);record=[];field='';continue}
  field+=c;
 }
 if(quoted)throw Error('Aspas inválidas no CSV');record.push(field);if(record.some(x=>x.trim()))rows.push(record);
 if(!rows.length)throw Error('Planilha vazia');const header=rows.shift().map(v=>v.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
 const get=(row,...names)=>{for(const n of names){const idx=header.indexOf(n);if(idx>=0&&row[idx]?.trim())return row[idx].trim()}return ''};
 return rows.map(row=>({id:get(row,'id'),name:get(row,'nome','name'),price:get(row,'preco','price'),description:get(row,'descricao','description'),sku:get(row,'codigo','sku'),category:get(row,'categoria loja','departamento','categoria_loja','categoria','category'),hasShopCategory: ['categoria loja','departamento','categoria_loja'].some(k=>header.includes(k)),brand:get(row,'marca','brand'),stock:get(row,'estoque-saldo','estoque','stock'),image:get(row,'imagem_url','url_imagem','image_url'),weight:get(row,'embalagem-peso','peso'),width:get(row,'embalagem-largura','largura'),height:get(row,'embalagem-altura','altura'),length:get(row,'embalagem-comprimento','comprimento')}));
}
const aliases={'perfumes':'perfumes','perfumaria':'perfumes','corpo-e-cuidado':'corpo','corpo-e-cuidados':'corpo','beleza-essencial':'beleza'};
function importInto(db,raw,searchText,secureUrl){
 const rows=parse(raw);
 if(rows.length>10000)throw Error('Limite de 10.000 produtos por arquivo');
 const insertCategory=db.prepare('INSERT OR IGNORE INTO categories(id,name,subtitle) VALUES(?,?,?)');
 const getOld=db.prepare('SELECT * FROM products WHERE id=?');
 const upsert=db.prepare(`INSERT INTO products(id,name,price,description,category,brand,family,image,sku,stock,weight,width,height,length,active,search_text)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
 ON CONFLICT(id) DO UPDATE SET name=excluded.name,price=excluded.price,description=excluded.description,
 category=excluded.category,brand=excluded.brand,sku=excluded.sku,stock=excluded.stock,weight=excluded.weight,
 width=excluded.width,height=excluded.height,length=excluded.length,search_text=excluded.search_text`);
 const existingCats=new Set(db.prepare('SELECT id FROM categories').all().map(x=>x.id));let inserted=0,updated=0,newCategories=0,skipped=0;
 db.exec('BEGIN IMMEDIATE');try{
  for(const row of rows){
   if(!row.name||row.name.length>220){skipped++;continue}
   const price=Number(String(row.price).replace(',','.'));if(!Number.isFinite(price)||price<0||price>100000){skipped++;continue}
   const id=/^[\w-]{5,80}$/.test(row.id)?row.id:'csv-'+require('node:crypto').createHash('sha256').update(row.sku+'|'+row.name).digest('hex').slice(0,24);
   const old=getOld.get(id);let cat=cleanCategory(row.category);let categoryId=aliases[slug(cat)];
   const brandLike=!row.hasShopCategory&&cat&&cat===cat.toUpperCase()&&!aliases[slug(cat)];
   if(brandLike){categoryId=old?.category||(/CREME|SKIN|HIDRAT|SABONETE|SHAMPOO/i.test(row.name)?'corpo':'perfumes')}
   else if(!categoryId&&cat){categoryId=slug(cat);if(categoryId&&!existingCats.has(categoryId)){insertCategory.run(categoryId,cat,'');existingCats.add(categoryId);newCategories++}}
   categoryId=categoryId||old?.category||'perfumes';
   const value=(v)=>{const n=Number(String(v).replace(',','.'));return Number.isFinite(n)&&n>0&&n<10000?n:null};
   const stock=row.stock===''?old?.stock??null:Number(row.stock);const safeStock=Number.isInteger(stock)&&stock>=0?stock:null;
   const p={name:row.name,description:row.description.slice(0,10000),price,category:categoryId,
    brand:row.brand|| (brandLike?cat:old?.brand||''),family:old?.family||'',sku:row.sku||old?.sku||'',
    image:secureUrl(row.image)||old?.image||'',stock:safeStock,weight:value(row.weight)||old?.weight||null,
    width:value(row.width)||old?.width||null,height:value(row.height)||old?.height||null,length:value(row.length)||old?.length||null,active:old?.active??1};
   upsert.run(id,p.name,p.price,p.description,p.category,p.brand,p.family,p.image,p.sku,p.stock,p.weight,p.width,p.height,p.length,p.active,searchText(p));
   if(old)updated++;else inserted++;
  }
  if(!inserted&&!updated)throw Error('Nenhum produto válido no CSV. Confira o cabeçalho e os preços.');
  db.exec('COMMIT');return {read:rows.length,inserted,updated,newCategories,skipped};
 }catch(e){db.exec('ROLLBACK');throw e}
}
module.exports={parse,cleanCategory,importInto};
