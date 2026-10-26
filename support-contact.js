'use strict';
const SUPPORT_PHONE='5511940856397',SUPPORT_EMAIL='sac.lacour@gmail.com';
// Applies the owner's requested contact change once, allowing later panel edits.
const MARKER='lacour_support_contact_20261024_v1';
async function applySupportContactUpdate(db,settings){
 const row=await db.prepare('SELECT key FROM site_settings WHERE key=?').get(MARKER);
 if(row?.key===MARKER)return false;
 await settings.save(Object.fromEntries(Object.entries({WHATSAPP:SUPPORT_PHONE,ADMIN_EMAIL:SUPPORT_EMAIL,SHIPPING_CONTACT_EMAIL:SUPPORT_EMAIL}).filter(([key])=>!process.env[key])));
 await db.prepare('INSERT INTO site_settings(key,value,encrypted,updated_at) VALUES(?,?,?,?) ON CONFLICT(key) DO NOTHING').run(MARKER,'applied',0,new Date().toISOString());
 return true;
}
module.exports={SUPPORT_PHONE,SUPPORT_EMAIL,applySupportContactUpdate};
