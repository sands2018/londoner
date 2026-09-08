import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist=fileURLToPath(new URL('../dist/',import.meta.url));
const browserCache=fileURLToPath(new URL('../.playwright-browsers',import.meta.url));
if(existsSync(browserCache))process.env.PLAYWRIGHT_BROWSERS_PATH=browserCache;
const {chromium,expect}=await import('@playwright/test');
const legacyWorker=`self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request))));`;
let worker='retired', blocked='', failure='';
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2','.woff':'font/woff','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(blocked&&pathname.includes(blocked))return; // Intentionally leave this request pending.
 if(failure&&pathname.includes(failure)&&(failure!=='BaccaratGame-'||pathname.endsWith('.css'))){res.writeHead(404);res.end('Missing previous deployment asset');return;}
 res.setHeader('Cache-Control','no-cache');
 if(pathname==='/londoner/sw.js'&&worker==='legacy'){res.setHeader('Content-Type','text/javascript');res.end(legacyWorker);return;}
 if(pathname==='/londoner/seed.html'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Isolated cache fixture</title>');return;}
 const file=resolve(dist,'.'+pathname.replace(/^\/londoner(?=\/)/,'').replace(/\/$/,'/index.html'));
 if(!file.startsWith(resolve(dist)+sep)||!existsSync(file)){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/londoner/`;
const browser=await chromium.launch();
const errors=[];
async function createPage(mobile=true) {
 const context=await browser.newContext({viewport:mobile?{width:412,height:915}:{width:1440,height:900},isMobile:mobile,hasTouch:mobile});
 await context.addInitScript(()=>{
  if(!localStorage.getItem('loading-test')){
   localStorage.setItem('loading-test','saved data');
   localStorage.setItem('londoner.currentNumbers','[1,2,3]');
  }
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return{page,context};
}
async function frame(page){return(await page.waitForSelector('#londoner-viewport')).contentFrame();}
async function saved(page){assert.equal(await page.evaluate(()=>localStorage.getItem('londoner.currentNumbers')),'[1,2,3]');}
async function seedWorker(page){
 worker='legacy';await page.goto(base+'seed.html');
 await page.evaluate(async()=>{
  await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
 });
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await page.evaluate(async()=>{
  const cache=await caches.open('londoner-shell-v5');
  await cache.put(new URL('./',location.href),new Response('<h1>STALE HTML</h1><script src="assets/deleted-old-entry.js"></script>',{headers:{'Content-Type':'text/html'}}));
  await caches.open('another-project-cache');
 });
}
try{
 // A request that never settles must offer recovery, matching the reported
 // title-only loading screen, rather than waiting forever without an action.
 const stalled=await createPage();await stalled.page.goto(base+'#lobby');let f=await frame(stalled.page);
 await f.getByRole('button',{name:'骰宝',exact:true}).waitFor();
 await stalled.page.clock.install();blocked='SicBoGame-';
 await f.getByRole('button',{name:'骰宝',exact:true}).click();
 await expect(f.locator('.sands-load-status h1')).toHaveText('骰宝');
 await stalled.page.clock.runFor(12500);
 await expect(f.getByRole('button',{name:'重新加载',exact:true})).toBeVisible();
 await stalled.page.screenshot({path:'test-results/sands/loading-stalled-android.png'});
 blocked='';await f.getByRole('button',{name:'重新加载',exact:true}).click();
 await stalled.page.waitForURL(/_reload=.*#sicbo$/);f=await frame(stalled.page);
 await f.locator('.sic-game').waitFor();await saved(stalled.page);await stalled.context.close();
 console.log('Pending game script: timeout recovery, fresh document and saved data passed');

 // A missing CSS or JS chunk must be caught without crashing the whole app.
 for(const [asset,hash,selector,title] of [
  ['BaccaratGame-','baccarat','.bac-game','百家乐'],
  ['SicBoGame-','sicbo','.sic-game','骰宝'],
 ]){
  const broken=await createPage(false);failure=asset;await broken.page.goto(base+'#'+hash);f=await frame(broken.page);
  await expect(f.locator('.sands-load-status.is-failed')).toBeVisible();
  await expect(f.locator('.sands-load-status h1')).toHaveText(title);
  await f.getByText('错误详情',{exact:true}).click();assert.ok((await f.locator('.sands-load-status pre').innerText()).length>10);
  failure='';await f.getByRole('button',{name:'重新加载',exact:true}).click();
  await broken.page.waitForURL(new RegExp('_reload=.*#'+hash+'$'));f=await frame(broken.page);await f.locator(selector).waitFor();
  await saved(broken.page);await broken.context.close();
 }
 console.log('Missing deployed JS/CSS: error boundary and reload recovery passed');

 const controlled=await createPage();await seedWorker(controlled.page);
 // The versioned link reaches new HTML while the old worker still controls it.
 await controlled.page.goto(base+'?new_build=1#sicbo');
 await controlled.page.waitForURL(/_reload=.*#sicbo$/);f=await frame(controlled.page);await f.locator('.sic-game').waitFor();
 assert.equal(await controlled.page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length),0);
 assert.deepEqual(await controlled.page.evaluate(()=>caches.keys()),['another-project-cache']);
 await saved(controlled.page);await controlled.context.close();
 console.log('Existing SW controller: cache retirement, fresh document and unrelated cache preservation passed');

 const retired=await createPage();await seedWorker(retired.page);
 worker='retired';await retired.page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update();});
 await expect.poll(()=>retired.page.evaluate(async()=>(await navigator.serviceWorker.getRegistrations()).length)).toBe(0);
 assert.deepEqual(await retired.page.evaluate(()=>caches.keys()),['another-project-cache']);
 await retired.page.goto(base+'#baccarat');f=await frame(retired.page);await f.locator('.bac-game').waitFor();
 await saved(retired.page);await retired.context.close();
 console.log('Old-worker update: stale cached HTML retired without deleting saved data passed');
 assert.deepEqual(errors,[]);
}finally{
 await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
}
