import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const browsers=fileURLToPath(new URL('../.playwright-browsers',import.meta.url));
if(!process.env.PLAYWRIGHT_BROWSERS_PATH&&existsSync(browsers))process.env.PLAYWRIGHT_BROWSERS_PATH=browsers;
const {chromium,devices,expect}=await import('@playwright/test');
const browser=await chromium.launch();
const errors=[];
const url=(process.env.TOUCH_URL??'http://localhost:5173')+'/londoner/';
const sizes=[['small',320,600,true],['android',360,650,true],['iphone',440,956,true],['landscape',720,360,true],['desktop',1440,900,false]];
const games=[['lobby','.sands-lobby',[]],['blackjack','.bj-game',['牌桌规则','结算明细','补充虚拟筹码']],['baccarat','.bac-game',['玩法与赔率','路单','基础统计','结算明细','补充虚拟筹码']],['sicbo','.sic-game',['玩法与赔率','近10轮','基础统计','结算明细','补充虚拟筹码']],['holdem','.holdem-game',['玩法与规则','历史记录','统计','补充虚拟筹码']],['threecard','.three-game',['玩法与规则','历史记录','统计','补充虚拟筹码']],['roulette','.app-shell',[]]];
async function hitSize(button,label){
 const r=await button.boundingBox();assert.ok(r&&r.width>=43.5&&r.height>=43.5,`${label} tap target ${JSON.stringify(r)}`);
}
try{
 for(const [name,width,height,mobile] of process.env.TOUCH_ONLY?sizes.filter(s=>s[0]===process.env.TOUCH_ONLY):sizes){
  const userAgent=mobile?devices[name==='iphone'?'iPhone 13':'Pixel 7'].userAgent:undefined;
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,userAgent});
  await context.addInitScript(mobile=>localStorage.setItem('londoner.simulatorDesktopMode',mobile?'0':'1'),mobile);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const [game,selector,reports] of games){
   await page.goto(url+'?touch='+game+'#'+game);
   const f=await(await page.waitForSelector('#londoner-viewport')).contentFrame();await f.locator(selector).first().waitFor();
   await f.evaluate(()=>document.fonts.ready);
   const root=f.locator(selector).first();
   if(mobile){
    for(const button of await root.locator('button.sands-icon,button.sands-balance-button,.roulette-lobby-return,.top-stats-user-area').all())if(await button.isVisible())await hitSize(button,`${name} ${game} ${await button.getAttribute('aria-label')}`);
   }
   assert.ok(await root.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${name} ${game} page overflows horizontally`);
   if(game==='lobby'){
    await f.getByRole('button',{name:'配置',exact:true}).click({position:{x:4,y:4}});
    const d=f.getByRole('dialog');if(mobile)for(const label of await d.locator('.sands-radio-options label').all())await hitSize(label,`${name} settings radio row`);
    await d.getByRole('button',{name:'关闭',exact:true}).click({position:{x:4,y:4}});
   }
   for(const title of reports){
    const button=f.getByRole('button',{name:title,exact:true});
    await button.scrollIntoViewIfNeeded();await button.click({position:{x:5,y:5}});
    const d=f.getByRole('dialog');await expect(d).toBeVisible();
    const close=d.getByRole('button',{name:'关闭',exact:true});if(mobile)await hitSize(close,`${name} ${game} close`);
    assert.ok(await d.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`${name} ${game} ${title} dialog overflows`);
    await close.click({position:{x:4,y:4}});await expect(d).toHaveCount(0);
   }
   if(game==='roulette'){
    await f.getByRole('button',{name:'登录',exact:true}).click({position:{x:4,y:4}});
    await f.getByRole('button',{name:'取消',exact:true}).click();
    await f.locator('.digit-other').click();const close=f.locator('.config-screen .close-button');
    if(mobile)await hitSize(close,`${name} roulette config close`);await close.click({position:{x:4,y:4}});
    await f.locator('.digit-number-zone').click();const dataClose=f.locator('.data-screen-head .close-button').first();
    if(mobile)await hitSize(dataClose,`${name} roulette data close`);await dataClose.click({position:{x:4,y:4}});
    if(mobile){
     await context.route('https://**/rest/v1/rpc/**',route=>route.fulfill({contentType:'application/json',body:route.request().url().endsWith('londoner_check_access')?'true':'[]'}));
     await f.evaluate(()=>localStorage.setItem('londoner.sharedLogin',JSON.stringify({u:'ww',p:'isolated-ui-test'})));
     await page.reload();
     const simulatorFrame=await(await page.waitForSelector('#londoner-viewport')).contentFrame();
     await simulatorFrame.getByRole('button',{name:'返回游戏',exact:true}).click();
     const simulator=simulatorFrame.locator('.simulator-screen.mobile-mode');await simulator.waitFor();
     for(const b of await simulator.locator('.simulator-feed-actions button').all())await hitSize(b,`${name} roulette ${await b.getAttribute('aria-label')}`);
     const toolbar=await simulator.locator('.simulator-bottom-feed').boundingBox();
     assert.ok(toolbar.x>=-1&&toolbar.y>=-1&&toolbar.x+toolbar.width<=width+1&&toolbar.y+toolbar.height<=height+1,`${name} simulator toolbar offscreen: ${JSON.stringify(toolbar)}`);
     for(const label of ['打开结算明细','查看最近号码']){
      await simulator.getByRole('button',{name:label,exact:true}).click();
      const dialog=simulator.getByRole('dialog');await expect(dialog).toBeVisible();
      const close=dialog.locator('header button');await hitSize(close,`${name} simulator close`);await close.click();
     }
     await simulator.getByRole('button',{name:'展开转盘',exact:true}).click();
     await simulator.getByRole('button',{name:'收起转盘',exact:true}).click();
     await page.screenshot({path:fileURLToPath(new URL(`../test-results/sands/touch-simulator-${name}.png`,import.meta.url))});
    }
   }
   await page.screenshot({path:fileURLToPath(new URL(`../test-results/sands/touch-${game}-${name}.png`,import.meta.url))});
  }
  await context.close();console.log(name,'game controls, edge taps, balance targets, settings and report close buttons passed');
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
