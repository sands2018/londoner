import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MersenneTwister19937 } from 'random-js';
import { dealBaccarat, nextBaccaratRound, readBaccaratState } from '../src/core/baccarat.ts';
const bundledBrowsers = fileURLToPath(new URL('../.playwright-browsers', import.meta.url));
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(bundledBrowsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = bundledBrowsers;
import assert from 'node:assert/strict';
const { chromium, expect } = await import('@playwright/test');
import { freshBaccarat } from '../src/core/baccarat.ts';
const browser = await chromium.launch();
const errors = [];
try {
  const sizes = [['desktop',1440,900,false],['laptop',1000,620,false],['iphone',440,956,true],['android',360,650,true],['small',320,600,true],['landscape',720,360,true]];
  for (const [name,width,height,mobile] of process.env.BAC_SMOKE ? sizes.slice(0,1) : sizes) {
    const context = await browser.newContext({ viewport:{width,height}, isMobile:mobile, hasTouch:mobile });
    await context.addInitScript(({mobile,saved}) => {
      if (!localStorage.getItem('bac-test')) {
        localStorage.setItem('bac-test','1');
        localStorage.setItem('londoner.simulatorDesktopMode',mobile?'0':'1');
        localStorage.setItem('londoner.simulatorAnimationSpeed','fast');
        localStorage.setItem('sands2018.baccarat.v1',JSON.stringify(saved));
      }
    }, {mobile,saved:freshBaccarat()});
    const page = await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${process.env.BAC_URL ?? 'http://localhost:5173'}/londoner/#baccarat`);
    const getFrame = async()=>await(await page.waitForSelector('#londoner-viewport')).contentFrame();
    let f = await getFrame();
    await f.locator('.bac-bet').last().waitFor();
    await f.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`test-results/sands/baccarat-betting-${name}.png`});
    assert.equal(await f.locator('.bac-bet').count(),5);
    const checkLayout=async()=>{
      const metrics=await f.locator('.bac-game').evaluate(el=>{
        const rect=el.getBoundingClientRect();
        const buttons=[...el.querySelectorAll('.bac-bet,.bac-chips button,.bac-deal,.bac-footer button')];
        return {horizontal:el.scrollWidth-el.clientWidth,vertical:rect.bottom-innerHeight,
          controls:buttons.every(b=>{const r=b.getBoundingClientRect();return r.width>=20&&r.height>=20&&r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;}),
          cardWidths:[...el.querySelectorAll('.bac-cards > .bj-card')].map(c=>c.getBoundingClientRect().width)};
      });
      assert.ok(metrics.horizontal<=1,`${name} horizontal overflow: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.vertical<=1,`${name} vertical overflow: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.controls,`${name} controls offscreen: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.cardWidths.every(w=>w>=45),`${name} cards too small: ${JSON.stringify(metrics)}`);
    };
    await checkLayout();
    await f.getByRole('button',{name:'10 筹码',exact:true}).click();
    await f.locator('[data-bac-bet="banker"]').click();
    await f.getByRole('button',{name:'发牌',exact:true}).click();
    assert.equal(await f.locator('.bac-game').getAttribute('data-phase'),'betting');
    assert.match(await f.getByRole('alert').textContent(),/最低20/);
    await f.locator('[data-bac-bet="banker"]').click();
    await f.getByRole('button',{name:'加倍当前投注',exact:true}).click();
    await f.getByRole('button',{name:'撤销下注',exact:true}).click();
    assert.equal(await f.locator('.bac-stake').textContent(),'20');
    const read=()=>f.evaluate(()=>JSON.parse(localStorage.getItem('sands2018.baccarat.v1')));
    await f.getByRole('button',{name:'发牌',exact:true}).click();
    assert.equal(await f.locator('.bac-game').getAttribute('data-phase'),'dealing');
    const committed=await read();assert.equal(committed.roundId,1);
    assert.ok(await f.locator('.bac-bet').first().isDisabled());
    await page.waitForTimeout(500);
    await page.screenshot({path:`test-results/sands/baccarat-dealing-${name}.png`});
    const count=await f.locator('.bac-cards .bj-card').count();assert.ok(count>0&&count<6);
    assert.equal(await f.locator('.bac-game').getAttribute('data-phase'),'dealing');
    await f.waitForFunction(()=>document.querySelector('.bac-game')?.dataset.phase==='result');
    const settled=await read();assert.equal(settled.balance,committed.balance);
    assert.equal(await f.locator('.bac-stake').count(),1);
    assert.equal(await f.locator('.bac-cards .bj-card').count(),settled.settled.player.length+settled.settled.banker.length);
    await checkLayout();
    await page.screenshot({path:`test-results/sands/baccarat-result-${name}.png`});
    await page.reload();f=await getFrame();
    await f.getByRole('button',{name:'下一轮',exact:true}).waitFor();
    assert.equal((await read()).balance,settled.balance);
    assert.equal((await read()).shoe.length,settled.shoe.length);
    for (const name of ['路单','基础统计','结算明细','玩法与赔率']) {
      await f.getByRole('button',{name,exact:true}).click();
      const dialog=f.getByRole('dialog');assert.equal(await dialog.count(),1);
      const fits=await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1);assert.equal(fits,true,name);
      if(name==='路单') { await dialog.getByRole('tab',{name:'大路',exact:true}).click();await page.screenshot({path:`test-results/sands/baccarat-road-${width}.png`}); }
      await dialog.getByRole('button',{name:'关闭',exact:true}).click();
    }
    await f.getByRole('button',{name:'下一轮',exact:true}).click();
    assert.equal(await f.locator('.bac-stake').count(),0);
    assert.equal(await f.locator('.bac-cards .bj-card').count(),0);
    assert.ok(await f.getByRole('button',{name:'发牌',exact:true}).isDisabled());
    await f.getByRole('button',{name:'重复上轮投注',exact:true}).click();
    assert.equal(await f.locator('.bac-stake').textContent(),'20');
    await f.getByRole('button',{name:'发牌',exact:true}).click();
    const second=await read();assert.equal(second.roundId,2);
    await page.reload();f=await getFrame();await f.getByRole('button',{name:'下一轮',exact:true}).waitFor();
    assert.equal((await read()).balance,second.balance);
    await f.getByRole('button',{name:'重置统计',exact:true}).click();
    await f.getByRole('dialog').getByRole('button',{name:'重置',exact:true}).click();
    assert.equal((await read()).stats.rounds,0);assert.equal((await read()).shoeRounds.length,2);
    assert.equal((await read()).balance,second.balance);
    await f.getByRole('button',{name:'返回大厅',exact:true}).click();
    await f.getByRole('button',{name:'百家乐',exact:true}).click();
    await f.getByRole('button',{name:'下一轮',exact:true}).waitFor();
    await context.close();console.log(name,'layout, animated dealing, betting, persistence and reports passed');
  }
} finally {await browser.close();}
assert.deepEqual(errors,[]);


// Long roads must preserve history and follow the newest cell, even when a
// dragon tail extends farther right. Run against dev or the production preview.
let longState = {...freshBaccarat(), balance:1000000};
const random = MersenneTwister19937.seed(92);
for (let i=0;i<60;i++) longState=dealBaccarat({...nextBaccaratRound(longState),bets:{banker:20}},random);
const pool=Array.from({length:416},(_,i)=>i);
const take=rank=>pool.splice(pool.findIndex(id=>id%13===rank),1)[0];
const sequence=Array.from({length:26},(_,i)=>i<25
  ? [take(7),take(8),take(9),take(12)]
  : [take(8),take(7),take(9),take(12)]).flat();
let dragonState={...freshBaccarat(),balance:1000000,shoeNumber:1,shoe:[...pool.slice(0,408-sequence.length),...sequence.toReversed()]};
for(let i=0;i<26;i++) dragonState=dealBaccarat({...nextBaccaratRound(dragonState),bets:{banker:20}},random);
assert.ok(readBaccaratState(dragonState));

const regressionBrowser=await chromium.launch();
const url=`${process.env.BAC_URL ?? 'http://localhost:5173'}/londoner/#baccarat`;
async function openGame(saved,width,height,mobile,speed='fast',reducedMotion='no-preference') {
  const context=await regressionBrowser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,reducedMotion});
  await context.addInitScript(({saved,mobile,speed})=>{
    if(localStorage.getItem('bac-regression')) return;
    localStorage.setItem('bac-regression','1');
    localStorage.setItem('londoner.simulatorDesktopMode',mobile?'0':'1');
    localStorage.setItem('londoner.simulatorAnimationSpeed',speed);
    localStorage.setItem('sands2018.baccarat.v1',JSON.stringify(saved));
  },{saved,mobile,speed});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url);
  const frame=await(await page.waitForSelector('#londoner-viewport')).contentFrame();
  await frame.locator('.bac-game').waitFor();
  return {context,page,frame};
}
const roadMetrics=panel=>panel.evaluate(el=>{
  const last=el.querySelector('.bac-road-mark:last-child');
  const rect=el.getBoundingClientRect(), cell=last.getBoundingClientRect();
  const scale=rect.width/el.offsetWidth;
  return {scroll:el.scrollLeft,width:el.clientWidth,left:(cell.left-rect.left)/scale-3,right:(cell.right-rect.left)/scale+3,max:el.scrollWidth-el.clientWidth};
});
async function visibleLatest(panel,initial=false) {
  const m=await roadMetrics(panel);
  assert.ok(m.left>=-1&&m.right<=m.width+1,`latest road cell clipped: ${JSON.stringify(m)}`);
  if(initial) assert.ok(Math.abs(m.scroll-Math.max(0,m.scroll+m.right-m.width))<=1,`unnecessary blank scrolling: ${JSON.stringify(m)}`);
}
try {
  for(const [width,height,mobile] of [[1440,900,false],[360,650,true],[720,600,false]]) {
    const {context,page,frame:f}=await openGame(longState,width,height,mobile);
    const sidebar=f.locator('.bac-road-sidebar');
    assert.ok(await sidebar.isVisible(),'road must be on the game page');
    const panel=sidebar.locator('.bac-road-panel');
    assert.equal(await panel.locator('.bac-road-mark').count(),60,'beads must keep the whole shoe');
    await visibleLatest(panel,true);
    await sidebar.getByRole('tab',{name:'大路',exact:true}).click();
    await visibleLatest(panel,true);
    assert.ok((await roadMetrics(panel)).max>0,'fixture must have a long road');
    await panel.evaluate(el=>{el.scrollLeft=0;});
    await f.getByRole('button',{name:'下一轮',exact:true}).click();
    await f.getByRole('button',{name:'重复上轮投注',exact:true}).click();
    await f.getByRole('button',{name:'100 筹码',exact:true}).click();
    assert.equal((await roadMetrics(panel)).scroll,0,'betting must preserve manual scrolling');
    await f.getByRole('button',{name:'返回大厅',exact:true}).click();
    await f.getByRole('button',{name:'百家乐',exact:true}).click();
    assert.equal((await roadMetrics(panel)).scroll,0,'returning without new results must preserve scrolling');
    await page.clock.install();
    await f.getByRole('button',{name:'发牌',exact:true}).click();
    assert.equal((await roadMetrics(panel)).scroll,0,'animation must not expose the pending road result');
    await page.clock.runFor(6500);
    await f.waitForFunction(()=>document.querySelector('.bac-game').dataset.phase==='result');
    await visibleLatest(panel);
    for(const kind of ['珠盘路','大路']) {
      await f.getByRole('button',{name:'路单',exact:true}).click();
      const dialog=f.getByRole('dialog');
      await dialog.getByRole('tab',{name:kind,exact:true}).click();
      await visibleLatest(dialog.locator('.bac-road-panel'),true);
      await dialog.getByRole('button',{name:'关闭',exact:true}).click();
    }
    await page.screenshot({path:`test-results/sands/baccarat-inline-long-${width}-${mobile}.png`});
    await context.close();
  }
  for(const [width,height,mobile] of [[1440,900,false],[360,650,true]]) {
    const {context,page,frame:f}=await openGame(dragonState,width,height,mobile);
    const sidebar=f.locator('.bac-road-sidebar');
    await sidebar.getByRole('tab',{name:'大路',exact:true}).click();
    const panel=sidebar.locator('.bac-road-panel');
    assert.equal(await panel.locator('.bac-road-mark').count(),26);
    await visibleLatest(panel,true);
    const m=await roadMetrics(panel);
    assert.ok(m.max>0);
    assert.equal(m.scroll,0,'newest player result is left of the old banker dragon tail');
    await page.screenshot({path:`test-results/sands/baccarat-dragon-${width}.png`});
    await context.close();
  }

  const simulated=await openGame(longState,1440,900,false);
  await simulated.frame.getByRole('button',{name:'配置',exact:true}).click();
  await simulated.frame.locator('label').filter({has:simulated.frame.getByRole('radio',{name:'模拟iPhone',exact:true})}).click();
  await simulated.frame.getByRole('button',{name:'保存',exact:true}).click();
  await simulated.frame.waitForFunction(()=>innerWidth===440);
  assert.match(await simulated.frame.locator('.bac-game').getAttribute('class'),/is-mobile/);
  assert.ok(await simulated.frame.locator('.bac-road-sidebar').isVisible());
  await visibleLatest(simulated.frame.locator('.bac-road-sidebar .bac-road-panel'));
  await simulated.page.screenshot({path:'test-results/sands/baccarat-inline-simulated-iphone.png'});
  await simulated.context.close();

  // A six-card round exercises every timed transition and both third cards.
  const ids=[20,21,22,23,0,53,105,168,210,265]; // Warmup natural; then A,2,2,K,3,6 => both draw.
  const rest=Array.from({length:416},(_,i)=>i).filter(i=>!ids.includes(i)).slice(0,398);
  const warmup=dealBaccarat({...freshBaccarat(),shoeNumber:1,shoe:[...rest,...ids.toReversed()],bets:{banker:20}},random);
  const six={...nextBaccaratRound(warmup),bets:{banker:20}};
  assert.ok(readBaccaratState(six));
  for(const [speed,reduced] of [['slow',false],['fast',false],['slow',true]]) {
    const {context,page,frame:f}=await openGame(six,440,956,true,speed,reduced?'reduce':'no-preference');
    await page.clock.install();
    await f.getByRole('button',{name:'发牌',exact:true}).click();
    const persisted=await f.evaluate(()=>localStorage.getItem('sands2018.baccarat.v1'));
    assert.equal(JSON.parse(persisted).roundId,2);
    const start=reduced?30:180, step=reduced?140:speed==='fast'?800:1200, flip=reduced?60:460;
    const pause=reduced?100:speed==='fast'?400:700;
    let elapsed=0;
    for(let i=0;i<6;i++) {
      const at=start+i*step+(i>=4?pause:0);
      await page.clock.runFor(at+1-elapsed);elapsed=at+1;
      assert.equal(await f.locator('.bac-cards .bj-card').count(),i+1);
      assert.equal(await f.locator('.bac-cards .bj-card.is-hidden').count(),1,'deal face down first');
      await page.clock.runFor(flip);elapsed+=flip;
      assert.equal(await f.locator('.bac-cards .bj-card.is-hidden').count(),0);
      assert.ok(await f.getByRole('button',{name:'发牌',exact:true}).isDisabled());
      assert.ok(await f.locator('.bac-bet').first().isDisabled());
      assert.equal(await f.locator('.bac-road-sidebar .bac-road-mark').count(),1,'no result before completion');
    }
    await page.clock.runFor(2000);
    assert.equal(await f.locator('.bac-game').getAttribute('data-phase'),'result');
    assert.equal(await f.evaluate(()=>localStorage.getItem('sands2018.baccarat.v1')),persisted,'settlement must happen once');
    await context.close();
  }
  // Backgrounding ends presentation but does not re-run accounting.
  const {context,page,frame:f}=await openGame(six,360,650,true);
  await page.clock.install();
  await f.getByRole('button',{name:'发牌',exact:true}).click();
  const persisted=await f.evaluate(()=>localStorage.getItem('sands2018.baccarat.v1'));
  await f.evaluate(()=>{
    Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(f.locator('.bac-game')).toHaveAttribute('data-phase','result');
  await page.clock.runFor(10000);
  assert.equal(await f.evaluate(()=>localStorage.getItem('sands2018.baccarat.v1')),persisted);
  await context.close();
  console.log('Long roads, full history, minimal scrolling, manual scroll preservation, sequential cards, reduced motion and background settlement passed');
} finally {await regressionBrowser.close();}
assert.deepEqual(errors,[]);
