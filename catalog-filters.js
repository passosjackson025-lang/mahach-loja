'use strict';
// Store taxonomy: no product names, stock or prices are changed.
const ARABIC=['LATTAFA','ALHAMBRA','AFNAN','ARMAF','AJMAL','ARD AL ZAAFARAN','RASASI','AL HARAMAIN','SWISS ARABIAN','FRAGRANCE WORLD','FRENCH AVENUE','ARABIYAT','ASDAAF','RAVE','ORIENTICA','KHADLAJ','PARIS CORNER','AL WATANIAH','AHMED AL MAGHRIBI','ZIMAYA','AL NOBLE','RUE BROCA'];
const NICHE=['NISHANE','XERJOFF','CREED','MANCERA','MONTALE','AMOUAGE','INITIO','PARFUMS DE MARLY','KAJAL','TIZIANA TERENZI','SOSPIRO','BYREDO','NASOMATTO','ORTO PARISI'];
const DESIGNER=['DIOR','CHANEL','PRADA','VERSACE','GUCCI','GIVENCHY','PACO RABANNE','RABANNE','CAROLINA HERRERA','HUGO BOSS','DOLCE','GIORGIO ARMANI','YVES SAINT LAURENT','YSL','LANCOME','LANCOME','CALVIN KLEIN','BURBERRY','VALENTINO','JEAN PAUL GAULTIER','MOSCHINO','LACOSTE','MONTBLANC','MONT BLANC','AZZARO','ISSEY MIYAKE','KENZO','SALVATORE FERRAGAMO','FERRAGAMO','MARC JACOBS','TOM FORD','JIMMY CHOO','RALPH LAUREN','BVLGARI','BULGARI','DIESEL'];
const KEYS=['todos','arabes','importados','nicho','masculino','feminino','unissex'];
const text="UPPER(TRANSLATE(COALESCE(name,'') || ' ' || COALESCE(brand,'') || ' ' || COALESCE(family,''), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'))";
function applyCatalogFilters(params,where,args){
 const section=params.get('section')||'todos';
 if(!KEYS.includes(section))throw Object.assign(Error('Categoria de perfume inválida'),{status:400});
 const list=(terms)=>{where.push('('+terms.map(()=>text+' LIKE ?').join(' OR ')+')');args.push(...terms.map(x=>'%'+x+'%'))};
 if(section!=='todos')where.push("category='perfumes'");
 if(section==='arabes')list(ARABIC);
 if(section==='nicho')list(NICHE);
 if(section==='importados')list([...DESIGNER,...NICHE]);
 const patterns={masculino:'(^|[^A-Z])(MASCULINO|MASCULINA|MASC|MEN|MAN|HOMME|FOR HIM)([^A-Z]|$)',feminino:'(^|[^A-Z])(FEMININO|FEMININA|FEM|WOMEN|WOMAN|FEMME|FOR HER)([^A-Z]|$)',unissex:'(^|[^A-Z])(UNISSEX|UNISEX)([^A-Z]|$)'};
 if(patterns[section]){where.push(text+' ~ ?');args.push(patterns[section]);if(section!=='unissex'){where.push('NOT ('+text+' ~ ?)');args.push(patterns.unissex)}}
 const low=params.get('priceMin'),high=params.get('priceMax');
 for(const [value,op] of [[low,'>='],[high,'<=']])if(value!==null&&value!==''){const n=Number(value);if(!Number.isFinite(n)||n<0||n>100000)throw Object.assign(Error('Faixa de preço inválida'),{status:400});where.push('price '+op+' ?');args.push(n)}
 if(low!==null&&high!==null&&Number(low)>Number(high))throw Object.assign(Error('Confira a faixa de preço'),{status:400});
}
module.exports={applyCatalogFilters,ARABIC,NICHE,DESIGNER};
