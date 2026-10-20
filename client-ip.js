'use strict';
const {isIP}=require('node:net');
// Render routes public ingress through Cloudflare. Never trust arbitrary X-Forwarded-For.
function clientIp(req,env=process.env){
 const forwarded=req.headers?.['cf-connecting-ip'];
 if(env.RENDER_SERVICE_ID&&typeof forwarded==='string'&&isIP(forwarded))return forwarded;
 return req.socket?.remoteAddress||'local';
}
module.exports={clientIp};
