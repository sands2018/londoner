import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, ChevronDown, CircleHelp, History, Plus, RotateCcw, Settings2, Trash2, Undo2, Play, Hand, Split, CirclePlus } from "lucide-react";
import { BlackjackTable, blackjackChips, blackjackMinimum, isSavedBlackjack, type BlackjackAction, type BlackjackHand } from "../../core/blackjack";
import { PlayingCard, SandsDialog, SandsMark } from "./SandsShared";
import { animationSpeedKey } from "./displaySettings";
import { blackjackFrames, blackjackNextFrames, chipColors, dealerDisplayCards, fitBlackjackCards, frameDuration, splitHandState } from "./blackjackPresentation";
import { ChipStack, FlyingChip, type ChipFlight } from "./BlackjackChips";
import { useBlackjackMotion, type PlayingFrame } from "./useBlackjackMotion";
import { BlackjackResult } from "./BlackjackResult";

const storageKey = "sands2018.blackjack.v1";
const format = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? "+" : ""}${format(n)}`;
function loadTable() {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return new BlackjackTable(isSavedBlackjack(saved) ? saved : undefined);
  } catch { return new BlackjackTable(); }
}

export function BlackjackGame({ desktop, active, onLobby, onSettings }: { desktop: boolean; active: boolean; onLobby: () => void; onSettings: () => void }) {
  const [table] = useState(loadTable);
  const [view, setView] = useState(() => table.view());
  const [busy, setBusy] = useState(false);
  const [frame, setFrame] = useState<PlayingFrame | null>(null);
  const [flights, setFlights] = useState<ChipFlight[]>([]);
  const sequence = useRef(0);
  const [message, setMessage] = useState("");
  const [dialog, setDialog] = useState<"rules" | "history" | "reset" | "credits" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const locked = useRef(false);
  const tableRef = useRef<HTMLElement>(null);
  const betRef = useRef<HTMLButtonElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(() => ({ width: innerWidth, height: innerHeight }));
  const desktopScale = desktop ? Math.min(1, viewport.width / 1000) : 1;
  const ready = view.phase === "betting" || view.phase === "settled";
  const acceptingBets = view.phase === "betting";
  const resultVisible = !busy || frame?.motion === "result";
  const finishFlight = useCallback((id: number) => setFlights((current) => current.filter((flight) => flight.id !== id)), []);
  useLayoutEffect(() => {
    const resize = () => setViewport({ width: window.visualViewport?.width ?? innerWidth, height: window.visualViewport?.height ?? innerHeight });
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("resize", resize);
    };
  }, []);
  useLayoutEffect(() => {
    const element = tableRef.current;
    if (!element || !active) return;
    const fit = () => {
      if (!element.clientWidth || !element.clientHeight) return;
      if (!desktop && matchMedia("(min-width:650px) and (max-height:600px)").matches) return;
      const splitRows = !desktop && view.hands.length > 2 ? 2 : 1;
      const dealer = element.querySelector<HTMLElement>(".bj-dealer")!;
      const player = element.querySelector<HTMLElement>(".bj-player-area")!;
      const status = element.querySelector<HTMLElement>(".bj-round-status")!;
      const dealerCards = dealer.querySelector<HTMLElement>(".bj-cards")!;
      const playerCards = player.querySelector<HTMLElement>(".bj-cards")!;
      const style = getComputedStyle(element);
      // Keep a readable card size; a short viewport may scroll instead of crushing the cards.
      const reserved = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + status.offsetHeight
        + dealer.offsetHeight - dealerCards.offsetHeight + player.offsetHeight - playerCards.offsetHeight * splitRows + 4;
      const { width, minHeight } = fitBlackjackCards(element.clientHeight, reserved, desktop, view.hands.length);
      const previous = parseFloat(element.style.getPropertyValue("--fitted-card-width"));
      if (!Number.isFinite(previous) || Math.abs(previous - width) >= 1) element.style.setProperty("--fitted-card-width", `${width}px`);
      element.style.setProperty("--bj-table-min-height", `${minHeight}px`);
    };
    fit();
    let scheduled = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(fit);
    });
    observer.observe(element);
    element.querySelectorAll(".bj-dealer, .bj-player-area, .bj-round-status").forEach((child) => observer.observe(child));
    return () => { observer.disconnect(); cancelAnimationFrame(scheduled); };
  }, [active, desktop, view.hands.length]);
  useBlackjackMotion(tableRef, view, frame, active);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (active && !locked.current) setView(table.view());
  }, [active, table]);

  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(table.save())); }
    catch { setMessage("本地存储不可用，请勿刷新当前牌局"); }
  }
  function update(action: () => void) {
    if (locked.current) return;
    setMessage("");
    action();
    setView(table.view());
    persist();
  }
  function placeChip() {
    if (locked.current || !acceptingBets) return;
    const value = view.selectedChip;
    const from = chipsRef.current?.querySelector(`[aria-label="${value} 筹码"]`)?.getBoundingClientRect();
    const to = betRef.current?.querySelector(".bj-chip-stack")?.getBoundingClientRect();
    update(() => {
      if (!table.addChip()) { setMessage("可用筹码不足，或已达单注上限 100,000"); return; }
      if (from && to && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const size = betRef.current?.querySelector(".bj-chip-token")?.getBoundingClientRect().width ?? to.width * .75;
        setFlights((current) => [...current, { id: ++sequence.current, value, fromX: from.x + (from.width - size) / 2, fromY: from.y + (from.height - size) / 2, x: to.x + (to.width - size) / 2, y: to.y + (to.height - size) / 2, size }]);
      }
    });
  }
  function animate(action: BlackjackAction | "deal" | "next") {
    if (locked.current) return;
    setMessage("");
    const playback = table.perform(action);
    if (!playback) return;
    locked.current = true;
    setBusy(true);
    setFlights([]);
    persist();
    const fast = localStorage.getItem(animationSpeedKey) === "fast";
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const frames = action === "next" ? blackjackNextFrames(playback) : blackjackFrames(playback, action === "deal");
    let index = 0;
    const advance = () => {
      const next = frames[index++];
      if (!next) {
        setView(playback.after);
        setFrame(null);
        setBusy(false);
        locked.current = false;
        timer.current = null;
        return;
      }
      const duration = frameDuration(next.motion, fast, reduced);
      setView(next.view);
      setFrame({ ...next, serial: ++sequence.current, duration });
      timer.current = setTimeout(advance, duration);
    };
    advance();
  }
  function act(action: BlackjackAction) { animate(action); }
  const splitTurn = view.hands.length > 1 && view.phase === "playing";
  const currentHand = splitTurn && !busy ? view.hands[view.activeHand] : null;
  const result = view.phase === "settled" && resultVisible ? view.lastRound : null;
  const motionLabels = { collect: "收牌", shuffle: "更换牌靴 · 洗牌", deal: "发牌中", reveal: "庄家开牌", split: "分牌", wager: "追加投注", settle: "结算中", result: "本轮结算" };
  const status = message || (busy ? (frame ? motionLabels[frame.motion] : "发牌中")
    : view.phase === "insurance" ? "庄家明牌为 A" : view.phase === "playing" ? (view.hands.length > 1 ? `第 ${view.activeHand + 1} 手，请决策` : "请决策")
    : result ? (result.voided ? "牌靴耗尽，本轮投注已退回" : result.profit > 0 ? "本轮赢利" : result.profit < 0 ? "本轮亏损" : "本轮和局")
    : view.pendingBet === 0 ? "请下注 · 最低 30" : view.pendingBet < blackjackMinimum ? "最低下注 30" : "等待发牌");

  function bettingSpot() {
    return <button ref={betRef} type="button" className="bj-felt-bet" aria-label={`在投注位放入 ${view.selectedChip}`} title={`放入 ${view.selectedChip}`} disabled={busy} onClick={placeChip}>
      <ChipStack amount={view.pendingBet} chips={view.pendingChips} /><span><small>投注</small><strong>{format(view.pendingBet)}</strong></span><Plus size={15} />
    </button>;
  }
  function renderHand(hand: BlackjackHand, i: number) {
    const handState = splitHandState(view, i, busy);
    const stateLabel = handState === "active" ? "当前操作" : handState === "processing" ? "处理中" : handState === "waiting" ? "等待" : "已完成";
    const focused = view.phase === "playing" && view.activeHand === i && (!handState || handState === "active" || handState === "processing");
    return <div key={hand.id} role="group" aria-label={view.hands.length > 1 ? `第 ${i + 1} 手，${stateLabel}` : "玩家手牌"} aria-current={handState === "active" ? "true" : undefined} data-hand-state={handState ?? undefined} className={`bj-player-hand${focused ? " is-focused" : ""}${hand.result && resultVisible ? ` result-${hand.result}` : ""}`}>
      <div className="bj-hand-heading"><span>{view.hands.length > 1 ? `第 ${i + 1} 手` : "玩家"}</span>{hand.cards.length > 0 && <strong>{hand.natural ? "BLACKJACK" : hand.total > 21 ? `爆牌 ${hand.total}` : `${hand.soft ? "软 " : ""}${hand.total}`}</strong>}</div>
      <div className="bj-cards" style={{ "--card-count": hand.cards.length } as CSSProperties}>{hand.cards.map((card, index) => <PlayingCard key={card.id} card={card} index={index} />)}</div>
      <div className="bj-hand-wager"><ChipStack amount={hand.bet} /><div className="bj-hand-caption"><span>{format(hand.bet)}{hand.result && resultVisible && <span className={`bj-hand-result ${hand.result}`}>{hand.result === "win" ? "赢" : hand.result === "lose" ? "输" : "和"}</span>}</span>{handState && <small className="bj-hand-state">{handState === "active" ? <ChevronDown size={14} aria-hidden="true" /> : handState === "complete" ? <Check size={13} aria-hidden="true" /> : null}{stateLabel}</small>}</div></div>
    </div>;
  }

  return <main className={`sands-surface bj-game ${desktop ? "is-desktop" : "is-mobile"}`} data-phase={view.phase} data-busy={busy} data-motion={frame?.motion ?? "idle"} style={{ ...(desktop ? { width: viewport.width / desktopScale, height: viewport.height / desktopScale, transform: `scale(${desktopScale})`, transformOrigin: "top left" } : {}), "--card-turn-duration": `${frame?.duration ? frame.duration * .8 : 0}ms`, "--result-duration": `${frame?.motion === "result" ? frame.duration : 1700}ms` } as CSSProperties} aria-label="二十一点游戏">
    <header className="bj-header">
      <div className="bj-header-left"><button type="button" className="sands-icon" aria-label="返回大厅" title="返回大厅" onClick={onLobby}><ArrowLeft size={22} /></button><SandsMark compact /></div>
      <h1>二十一点</h1>
      <div className="bj-header-actions"><button type="button" className="sands-icon" title="牌桌规则" aria-label="牌桌规则" onClick={() => setDialog("rules")}><CircleHelp size={21} /></button><button type="button" className="sands-icon" title="配置" aria-label="配置" onClick={onSettings}><Settings2 size={21} /></button></div>
    </header>
    <div className="bj-meta"><span>双副牌 <i /> BLACKJACK 3:2</span><span>牌靴 {view.shoeNumber} <span className="bj-shoe-meter" title={`剩余 ${view.cardsLeft} 张`}><span style={{ width: `${view.cardsLeft / 104 * 100}%` }} /></span><b>{view.cardsLeft}/104</b></span></div>
    <section className="bj-table" ref={tableRef} aria-label="牌桌">
      <div className="bj-table-print" aria-hidden="true" />
      <div className={`bj-shoe${frame?.motion === "shuffle" ? " shuffling" : ""}`} aria-hidden="true"><span className="bj-shoe-cards" /><span className="bj-shoe-mouth"><SandsMark compact /></span></div>
      <div className="bj-discard-tray" aria-hidden="true"><span /></div>
      <section className="bj-dealer" aria-label="庄家手牌">
        <div className="bj-hand-heading"><span>庄家</span>{view.dealer.cards.length > 0 && <strong>{view.dealer.natural ? "BLACKJACK" : view.dealer.total > 21 ? `爆牌 ${view.dealer.total}` : `${view.dealer.soft ? "软 " : ""}${view.dealer.total}${view.dealer.cards.some((c) => c.hidden) ? " + ?" : ""}`}</strong>}</div>
        <div className="bj-cards" style={{ "--card-count": Math.max(2, view.dealer.cards.length) } as CSSProperties}>
          {view.dealer.cards.length ? dealerDisplayCards(view.dealer.cards).map((card, i) => <PlayingCard key={card.id} card={card} index={i} />) : <><span className="bj-card-placeholder" /><span className="bj-card-placeholder" /></>}
        </div>
      </section>
      <div className="bj-round-status" role="status" aria-live="polite">{result ? <BlackjackResult key={result.id} round={result} animated={frame?.motion === "result"} /> : currentHand && !message ? <div key={currentHand.id} className="bj-turn-prompt"><span>当前操作</span><strong>第 {view.activeHand + 1} 手</strong><small>{currentHand.soft ? "软 " : ""}{currentHand.total} 点 · 投注 {format(currentHand.bet)}</small></div> : <span>{status}</span>}</div>
      <section className={`bj-player-area${view.hands.length > 1 ? " has-splits" : ""}${view.hands.length > 2 ? " multi-splits" : ""}`} style={{ "--hand-count": Math.max(1, view.hands.length) } as CSSProperties} aria-label="玩家手牌">
        {view.hands.length ? view.hands.map(renderHand) : <div className="bj-empty-seat"><div className="bj-hand-heading"><span>玩家</span></div><div className="bj-cards"><span className="bj-card-placeholder" /><span className="bj-card-placeholder" /></div>{acceptingBets && bettingSpot()}</div>}
      </section>
      <span className="bj-table-limit">MIN 30</span><span className="bj-cut-note">{view.shuffleNext ? "本轮结束后洗牌" : "SANDS2018"}</span>
    </section>
    <section className="bj-controls" aria-label="游戏操作">
      <div className="bj-action-line">
        {splitTurn ? <div id="bj-current-hand" className="bj-action-target"><span>{busy ? "牌桌处理中" : "当前操作"}</span><strong>{busy ? "请稍候" : `第 ${view.activeHand + 1} 手`}{!busy && <small> / {view.hands.length} 手</small>}</strong></div> : <button type="button" className="bj-wager-target" disabled={!acceptingBets || busy} aria-label={`投注 ${view.selectedChip}`} onClick={placeChip}><span>本轮投注{view.insurance > 0 && !acceptingBets ? ` · 保险 ${format(view.insurance)}` : ""}</span><strong>{format(acceptingBets ? view.pendingBet : view.hands.reduce((s, h) => s + h.bet, 0))}</strong><Plus size={18} /></button>}
        {view.phase === "insurance" ? <div className="bj-main-actions insurance"><button type="button" className="sands-button" disabled={busy} onClick={() => act("decline")}>不买保险</button><button type="button" className="sands-button primary" disabled={busy || !view.actions.includes("insurance")} onClick={() => act("insurance")}>保险 {format(view.lastBet / 2)}</button></div> : <div className="bj-main-actions" role="group" aria-label="手牌操作" aria-describedby={splitTurn ? "bj-current-hand" : undefined}>
          <button type="button" className="sands-button" disabled={busy || !view.actions.includes("hit")} onClick={() => act("hit")}><Plus size={19} />要牌</button>
          <button type="button" className="sands-button" disabled={busy || !view.actions.includes("stand")} onClick={() => act("stand")}><Hand size={18} />停牌</button>
          <button type="button" className="sands-button" disabled={busy || !view.actions.includes("double")} onClick={() => act("double")}><span className="bj-double-icon">×2</span>加倍</button>
          <button type="button" className="sands-button" disabled={busy || !view.actions.includes("split")} onClick={() => act("split")}><Split size={18} />分牌</button>
        </div>}
        <button type="button" className="sands-button primary bj-deal" disabled={!ready || busy || (acceptingBets && (view.pendingBet < blackjackMinimum || view.pendingBet > view.balance))} onClick={() => animate(view.phase === "settled" ? "next" : "deal")}><Play size={18} fill="currentColor" />{view.phase === "settled" ? "下一轮" : "发牌"}</button>
      </div>
      <div className="bj-chips-line"><div ref={chipsRef} className="bj-chips" role="group" aria-label="选择筹码">{blackjackChips.map((chip) => <button key={chip} type="button" className={`bj-chip${view.selectedChip === chip ? " selected" : ""}`} style={{ "--chip-color": chipColors[chip] } as CSSProperties} aria-label={`${chip} 筹码`} aria-pressed={view.selectedChip === chip} disabled={!acceptingBets || busy} onClick={() => update(() => table.selectChip(chip))}><span>{chip}</span></button>)}</div>
        <div className="bj-bet-tools"><button type="button" className="sands-icon" aria-label="撤销下注" title="撤销下注" disabled={!acceptingBets || busy || !view.pendingBet} onClick={() => update(() => { setFlights([]); table.undoBet(); })}><Undo2 size={21} /></button><button type="button" className="sands-icon" aria-label="清空下注" title="清空下注" disabled={!acceptingBets || busy || !view.pendingBet} onClick={() => update(() => { setFlights([]); table.clearBet(); })}><Trash2 size={20} /></button><button type="button" className="sands-icon" aria-label="重复上次投注" title="重复上次投注" disabled={!acceptingBets || busy || view.lastBet > view.balance} onClick={() => update(() => { setFlights([]); table.repeatBet(); })}><RotateCcw size={20} /></button></div>
      </div>
    </section>
    <footer className="bj-stats">
      <button type="button" title="补充虚拟筹码" aria-label="补充虚拟筹码" className="bj-balance sands-balance-button" disabled={!ready || busy} onClick={() => setDialog("credits")}><span>可用筹码 <CirclePlus size={16} /></span><strong>{format(view.balance)}</strong></button>
      <div><span>累计投注</span><strong>{format(view.stats.wagered)}</strong></div><div><span>累计赢利</span><strong className={view.stats.profit > 0 ? "win" : view.stats.profit < 0 ? "lose" : ""}>{signed(view.stats.profit)}</strong></div>
      <div className="bj-round-count"><span>轮次</span><strong>{view.stats.rounds}</strong></div>
      <div className="bj-stats-tools"><button type="button" className="sands-icon" aria-label="结算明细" title="结算明细" onClick={() => setDialog("history")}><History size={24} /></button><button type="button" className="sands-icon" aria-label="重置统计" title="重置统计" disabled={!ready || busy} onClick={() => setDialog("reset")}><RotateCcw size={23} /></button></div>
    </footer>
    {flights.map((flight) => <FlyingChip key={flight.id} flight={flight} onFinish={finishFlight} />)}
    {dialog && <SandsDialog title={dialog === "rules" ? "牌桌规则" : dialog === "history" ? "结算明细" : dialog === "reset" ? "重置统计" : "补充筹码"} onClose={() => setDialog(null)}>
      {dialog === "rules" && <div className="bj-rules"><dl><div><dt>牌靴</dt><dd>2 副标准扑克牌，共 104 张，无大小王。每次洗牌后烧一张；约使用 75% 后，完成本轮再洗牌。</dd></div><div><dt>庄家</dt><dd>一明一暗，A 或 10 点明牌检查 Blackjack。任何 17 点停牌，包括软 17。</dd></div><div><dt>赔率</dt><dd>普通获胜 1:1，Blackjack 3:2，和局退回本金。赢回金额包含本金。</dd></div><div><dt>加倍、分牌</dt><dd>首两张可加倍，之后只补一张。同点数可分牌，最多 4 手；可在分牌后加倍。A 只分一次，每手只补一张，分牌后的 21 点不是 Blackjack。</dd></div><div><dt>保险</dt><dd>庄家明牌为 A 时可买原注一半的保险，庄家 Blackjack 赔 2:1。保险计入累计投注。</dd></div><div><dt>限额</dt><dd>主注最低 30，最高 100,000。不提供投降或额外边注。筹码均为虚拟筹码，不涉及真实金钱。</dd></div></dl><a href="https://www.venetianlasvegas.com/resort/casino/table-games/how-to-play-blackjack.html" target="_blank" rel="noreferrer">赌场玩法参考 · The Venetian</a></div>}
      {dialog === "history" && <><div className="bj-history-summary"><span>赢 {view.stats.wins}</span><span>输 {view.stats.losses}</span><span>和 {view.stats.pushes}</span><span>累计赢回 {format(view.stats.returned)}</span></div><div className="bj-history-scroll"><table><thead><tr><th>轮次</th><th>投注</th><th>赢回</th><th>赢利</th></tr></thead><tbody>{view.history.length ? view.history.map((r) => <tr key={r.id}><td>{r.id}</td><td>{format(r.wagered)}</td><td>{format(r.returned)}</td><td className={r.profit > 0 ? "win" : r.profit < 0 ? "lose" : ""}>{signed(r.profit)}</td></tr>) : <tr><td colSpan={4}>暂无已结算牌局</td></tr>}</tbody></table></div></>}
      {(dialog === "reset" || dialog === "credits") && <><p className="sands-confirm-copy">{dialog === "reset" ? "将累计投注、赢回、赢利及结算记录清零。可用筹码、当前牌靴不变。" : "增加 10,000 虚拟筹码，不计入赢利。"}</p><footer className="sands-modal-actions"><button type="button" className="sands-button" onClick={() => setDialog(null)}>取消</button><button type="button" className="sands-button primary" disabled={!ready || busy} onClick={() => { update(() => { if (dialog === "reset") table.resetStats(); else table.addPracticeCredits(); }); setDialog(null); }}>{dialog === "reset" ? "重置" : "补充"}</button></footer></>}
    </SandsDialog>}
  </main>;
}
