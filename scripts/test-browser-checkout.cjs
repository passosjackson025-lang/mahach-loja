'use strict';
// Browser assertions against a disposable local server; no external navigation.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
module.exports=async function(base){
 const browser=await chromium.launch({headless:true});
 try{
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
   const context=await browser.newContext({viewport,reducedMotion:'reduce'});
   await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/',{waitUntil:'networkidle'});
   assert.ok(await page.title());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Home overflow '+viewport.width);
   await page.goto(base+'/produtos/',{waitUntil:'networkidle'});
   await page.locator('[data-detail="confirmed-product"]').first().click();
   await page.locator('#productDialog[open]').waitFor();
   await page.locator('#productDialog [data-close]').click();
   assert.equal(await page.locator('#productDialog').evaluate(e=>e.open),false,'X fecha detalhes');
   await page.locator('[data-detail="confirmed-product"]').first().click();
   await page.locator('[data-add="confirmed-product"]').click();
   await page.locator('#openBag').click();
   await page.locator('#checkout').click();
   await page.locator('#checkoutDialog[open]').waitFor();
   await page.locator('#checkoutForm:not([hidden])').waitFor();
   assert.ok(await page.locator('#checkoutDialog').evaluate(e=>e.scrollWidth<=e.clientWidth+2),'Checkout overflow '+viewport.width);
   await page.locator('#checkoutForm [name="name"]').fill('Cliente Navegador');
   await page.locator('#checkoutForm [name="phone"]').fill('11999999999');
   await page.locator('#checkoutForm [name="email"]').fill('browser@shop.invalid');
   await page.locator('#checkoutForm [name="payment"][value="card"]').check();
   assert.equal(await page.locator('#pixCpfArea').isVisible(),false);
   assert.equal(await page.locator('input[autocomplete="cc-number"]').count(),0,'Dados de cartão não passam pelo site');
   await page.locator('#checkoutForm [name="payment"][value="cash"]').check();
   await page.locator('#checkoutForm [name="payment"][value="pix"]').check();
   await page.locator('#checkoutForm [name="pixCpf"]').fill('52998224725');
   if(viewport.width>1000){
    await page.locator('#submitOrder').click();
    await page.locator('#orderSuccess:not([hidden])').waitFor();
    assert.equal(await page.locator('#pixCopyValue').inputValue(),'NOT-PAYABLE');
   }
   assert.deepEqual(errors,[],'Erros JavaScript '+viewport.width);
   await context.close();
  }
  console.log('BROWSER OK: desktop/mobile, modal close, bag, checkout fields, card redirect boundaries, Pix rendering (simulated).');
 }finally{await browser.close()}
};
