import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { freshHoldem, holdemLegal, readHoldemState } from '../src/core/holdem.ts';
import { freshThreeCard, readThreeCardState } from '../src/core/threeCardPoker.ts';
const browsers = fileURLToPath(new URL('../.playwright-browsers', import.meta.url));
if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(browsers)) process.env.PLAYWRIGHT_BROWSERS_PATH = browsers;
const { chromium, expect } = await import('@playwright/test');
const browser = await chromium.launch();
const url = `${process.env.POKER_URL ?? 'http://localhost:5173'}/londoner/`;
const errors = [];
const sizes = [['desktop',1440,900,false],['laptop',1000,620,false],['iphone',440,956,true],['android',360,650,true],['small',320,600,true],['landscape',720,360,true]];
async function frame(page) { return (await page.waitForSelector('#londoner-viewport')).contentFrame(); }
const snapshot = (f,key) => f.evaluate(key=>JSON.parse(localStorage.getItem(`sands2018.${key}.v1`)),key);
async function waitForHero(page,f) {
  // React effects schedule the next turn after rendering; do not assume one
  // large fake-clock jump renders every computer decision under CI load.
  for(let i=0;i<30;i++) {
    const s=await snapshot(f,'holdem');
    if(s.actor===0 && await f.locator('.holdem-game').getAttribute('data-phase')==='playing') return s;
    await page.clock.runFor(500);
  }
  assert.fail(`Human turn did not become available: ${JSON.stringify(await snapshot(f,'holdem'))}`);
}
async function layout(f, game, label) {
  // The fake JS clock does not advance compositor animations.
  await f.page().waitForTimeout(450);
  const result=await f.locator(`.${game}-game`).evaluate(el=>{
    const controls=el.querySelector('.poker-controls').getBoundingClientRect();
    const footer=el.querySelector('.poker-footer').getBoundingClientRect();
    const workspace=el.querySelector('.poker-workspace');
    const center=el.querySelector('.holdem-center')?.getBoundingClientRect();
    const overlap=center&&[...el.querySelectorAll('.holdem-seat')].some(seat=>{const r=seat.getBoundingClientRect();return Math.min(r.right,center.right)-Math.max(r.left,center.left)>2&&Math.min(r.bottom,center.bottom)-Math.max(r.top,center.top)>2;});
    return {x:el.scrollWidth-el.clientWidth, workspaceX:workspace.scrollWidth-workspace.clientWidth, bottom:footer.bottom, height:innerHeight,
      controls:controls.width>100&&controls.height>30&&controls.left>=0&&controls.right<=innerWidth+1&&controls.bottom<=innerHeight+1,overlap};
  });
  assert.ok(result.x<=1&&result.workspaceX<=1&&result.bottom<=result.height+1&&result.controls&&!result.overlap,`${label}: ${JSON.stringify(result)}`);
}
try {
  for(const [name,width,height,mobile] of process.env.POKER_ONLY?sizes.filter(s=>s[0]===process.env.POKER_ONLY):process.env.POKER_SMOKE?sizes.slice(0,1):sizes) {
    const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
    await context.addInitScript(({mobile,holdem,three})=>{
      if(localStorage.getItem('poker-e2e')) return;
      localStorage.setItem('poker-e2e','1');
      localStorage.setItem('londoner.simulatorDesktopMode',mobile?'0':'1');
      localStorage.setItem('londoner.simulatorAnimationSpeed','fast');
      localStorage.setItem('sands2018.holdem.v1',JSON.stringify(holdem));
      localStorage.setItem('sands2018.threecard.v1',JSON.stringify(three));
    },{mobile,holdem:freshHoldem(),three:freshThreeCard()});
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url+'#lobby');let f=await frame(page);
    await f.locator('.sands-game-choice').last().waitFor();
    assert.equal(await f.locator('.sands-game-choice').count(),6);
    await f.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:`test-results/sands/poker-lobby-${name}.png`});
    await f.getByRole('button',{name:'德州扑克',exact:true}).click();
    await f.locator('.holdem-game').waitFor();await f.evaluate(()=>document.fonts.ready);
    assert.ok(page.url().endsWith('#holdem'));
    await page.clock.install();
    await layout(f,'holdem',`${name} ready`);
    await f.getByRole('button',{name:'开始发牌',exact:true}).click();
    const dealt=await snapshot(f,'holdem');assert.equal(dealt.roundId,1);
    assert.equal(await f.locator('.holdem-game').getAttribute('data-phase'),'animating');
    assert.ok(await f.getByRole('button',{name:'弃牌',exact:true}).isDisabled());
    await page.clock.runFor(5000);
    let s=await waitForHero(page,f);
    assert.equal(await f.locator('.holdem-seat:not(.seat-0) .bj-card:not(.is-hidden)').count(),0,'bots must not expose private cards');
    await layout(f,'holdem',`${name} active`);
    await page.screenshot({path:`test-results/sands/holdem-preflop-${name}.png`});
    await page.reload();f=await frame(page);await f.locator('.holdem-game').waitFor();
    assert.deepEqual(await snapshot(f,'holdem'),s,'refresh must resume the exact hand and turn');
    await context.setOffline(true);
    const legal=holdemLegal(s,0);
    if(legal.canRaise) {
      await f.getByRole('spinbutton',{name:'加注至',exact:true}).fill(String(legal.minTo-1));
      assert.ok(await f.getByRole('button',{name:'确认加注',exact:true}).isDisabled());
      await f.getByRole('spinbutton',{name:'加注至',exact:true}).fill(String(Math.min(legal.minTo,legal.maxTo)));
      await f.getByRole('button',{name:'确认加注',exact:true}).click();
    } else await f.getByRole('button',{name:/^(跟注 |过牌$)/}).click();
    await f.getByRole('button',{name:'返回大厅',exact:true}).click();
    const paused=await snapshot(f,'holdem');await page.clock.runFor(5000);
    assert.deepEqual(await snapshot(f,'holdem'),paused,'leaving the table must pause computer turns');
    await f.getByRole('button',{name:'德州扑克',exact:true}).click();
    for(let step=0;step<100;step++) {
      await page.clock.runFor(1200);s=await snapshot(f,'holdem');
      if(s.phase==='settled') break;
      if(s.actor===0) await f.getByRole('button',{name:/^(跟注 |过牌$)/}).click();
    }
    await page.clock.runFor(1500);s=await snapshot(f,'holdem');
    assert.equal(s.phase,'settled');assert.equal(s.stats.hands,1);assert.ok(readHoldemState(s));
    assert.equal(s.players[0].chips,10000+s.stats.profit);
    await layout(f,'holdem',`${name} settled`);
    await page.screenshot({path:`test-results/sands/holdem-result-${name}.png`});
    for(const title of ['历史记录','统计','玩法与规则']) {
      await f.getByRole('button',{name:title,exact:true}).click();
      const dialog=f.getByRole('dialog');assert.ok(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
      if(title==='历史记录') {await dialog.locator('summary').first().click();assert.ok(await dialog.locator('.poker-cards').count()>0);}
      await dialog.getByRole('button',{name:'关闭',exact:true}).click();
    }
    await context.setOffline(false);
    await f.getByRole('button',{name:'返回大厅',exact:true}).click();
    await f.getByRole('button',{name:'三张牌扑克',exact:true}).click();
    await f.locator('.three-game').waitFor();await f.evaluate(()=>document.fonts.ready);
    await layout(f,'three',`${name} three ready`);
    await f.getByRole('button',{name:'100 筹码',exact:true}).click();
    await f.getByRole('button',{name:'底注下注',exact:true}).click();
    await f.getByRole('button',{name:'20 筹码',exact:true}).click();
    await f.getByRole('button',{name:'对子奖下注',exact:true}).click();
    await context.setOffline(true);
    await f.getByRole('button',{name:'发牌',exact:true}).evaluate(el=>{el.click();el.click();});
    assert.equal((await snapshot(f,'threecard')).roundId,1);
    assert.ok(await f.getByRole('button',{name:'弃牌',exact:true}).isDisabled());
    await page.clock.runFor(3000);
    let three=await snapshot(f,'threecard');assert.ok(readThreeCardState(three));assert.equal(three.balance,9880);
    assert.equal(await f.locator('.three-hand.dealer .bj-card:not(.is-hidden)').count(),0);
    await layout(f,'three',`${name} three decision`);
    await page.screenshot({path:`test-results/sands/threecard-decision-${name}.png`});
    await context.setOffline(false);await page.reload();f=await frame(page);await f.locator('.three-game').waitFor();
    assert.deepEqual(await snapshot(f,'threecard'),three,'refresh must keep both three-card hands and pending stakes');
    await context.setOffline(true);
    await f.getByRole('button',{name:'跟注 100',exact:true}).click();
    const committed=await snapshot(f,'threecard');assert.equal(committed.stats.rounds,1);
    await page.clock.runFor(2200);three=await snapshot(f,'threecard');
    assert.equal(three.balance,10000+three.hand.result.profit);assert.deepEqual(three,committed);
    assert.equal(await f.locator('.three-hand.dealer .bj-card:not(.is-hidden)').count(),3);
    await layout(f,'three',`${name} three result`);
    await page.screenshot({path:`test-results/sands/threecard-result-${name}.png`});
    await f.getByRole('button',{name:'下一局',exact:true}).click();
    await f.getByRole('button',{name:'重复上轮下注',exact:true}).click();
    await f.getByRole('button',{name:'发牌',exact:true}).click();await page.clock.runFor(3000);
    await f.getByRole('button',{name:'弃牌',exact:true}).click();await page.clock.runFor(2200);
    const folded=await snapshot(f,'threecard');assert.equal(folded.hand.result.outcome,'fold');assert.equal(folded.balance,three.balance-120);
    await f.getByRole('button',{name:'重置统计',exact:true}).click();
    await f.getByRole('dialog').getByRole('button',{name:'确认',exact:true}).click();
    assert.equal((await snapshot(f,'threecard')).stats.rounds,0);assert.equal((await snapshot(f,'threecard')).balance,folded.balance);
    await context.close();console.log(name,'both games, layouts, privacy, betting, reload, reports and offline play passed');
  }

  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(()=>{
    if(localStorage.getItem('poker-regression')) return;
    localStorage.setItem('poker-regression','1');
    localStorage.setItem('londoner.simulatorDesktopMode','1');
    localStorage.setItem('londoner.simulatorAnimationSpeed','fast');
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'#holdem');let f=await frame(page);await f.locator('.holdem-game').waitFor();
  await f.getByRole('button',{name:'配置',exact:true}).click();
  await f.locator('label').filter({has:f.getByRole('radio',{name:'模拟iPhone',exact:true})}).click();
  await f.getByRole('button',{name:'保存',exact:true}).click();
  await f.waitForFunction(()=>innerWidth===440);
  assert.match(await f.locator('.holdem-game').getAttribute('class'),/is-mobile/);
  await page.clock.install();await f.getByRole('button',{name:'开始发牌',exact:true}).click();
  const saved=await snapshot(f,'holdem');
  async function visibility(value) {
    await f.evaluate(value=>{Object.defineProperty(document,'visibilityState',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));},value);
  }
  await visibility('hidden');await page.clock.runFor(5000);
  assert.deepEqual(await snapshot(f,'holdem'),saved,'backgrounding completes presentation without computer actions or new charges');
  await expect(f.locator('.holdem-game')).toHaveAttribute('data-phase','playing');
  await visibility('visible');await page.clock.runFor(6000);
  const before=await waitForHero(page,f);
  await layout(f,'holdem','simulated iPhone');
  await f.evaluate(()=>{window.pokerSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith('sands2018.'))throw new DOMException('Test quota','QuotaExceededError');return window.pokerSetItem.call(this,key,value);};});
  await f.getByRole('button',{name:/^(跟注 |过牌$)/}).click();
  assert.match(await f.getByRole('alert').innerText(),/操作未完成/);
  assert.deepEqual(await snapshot(f,'holdem'),before,'storage failures must leave both cards and accounting unchanged');
  await f.evaluate(()=>{Storage.prototype.setItem=window.pokerSetItem;delete window.pokerSetItem;});
  await f.getByRole('button',{name:/^(跟注 |过牌$)/}).click();
  assert.notDeepEqual(await snapshot(f,'holdem'),before);
  await f.getByRole('button',{name:'返回大厅',exact:true}).click();
  await f.getByRole('button',{name:'三张牌扑克',exact:true}).click();await f.locator('.three-game').waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});
  await f.getByRole('button',{name:'100 筹码',exact:true}).click();
  await f.getByRole('button',{name:'底注下注',exact:true}).click();
  await f.getByRole('button',{name:'发牌',exact:true}).click();
  for(let i=1;i<=6;i++) {
    await page.clock.runFor(i===1?80:70);
    assert.equal(await f.locator('.three-hand .bj-card').count(),i,'reduced motion still deals one card at a time');
    assert.ok(await f.getByRole('button',{name:'跟注 100',exact:true}).isDisabled());
  }
  await page.clock.runFor(200);await layout(f,'three','simulated iPhone reduced motion');
  await f.getByRole('button',{name:'跟注 100',exact:true}).evaluate(el=>{el.click();el.click();});
  const paid=await snapshot(f,'threecard');assert.equal(paid.stats.rounds,1);
  await visibility('hidden');await page.clock.runFor(2000);
  assert.deepEqual(await snapshot(f,'threecard'),paid,'background reveal cannot settle twice');
  await expect(f.locator('.three-game')).toHaveAttribute('data-phase','settled');
  await page.reload();f=await frame(page);await f.locator('.three-game').waitFor();
  assert.deepEqual(await snapshot(f,'threecard'),paid,'reload after background settlement keeps the same result');
  await context.close();console.log('Simulated iPhone, hidden-page pause, failed storage, sequential reduced motion and background settlement passed');
} finally {await browser.close();}
assert.deepEqual(errors,[]);
