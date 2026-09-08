import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ChartNoAxesColumnIncreasing, CircleHelp, CirclePlus, History, LayoutGrid, Play, RotateCcw, Settings2, Trash2, Undo2 } from "lucide-react";
import { baccaratBetIds, baccaratCard, baccaratChips, baccaratCut, baccaratLabels, baccaratMaximum, baccaratOdds, baccaratPoints, baccaratReturn, baccaratSequence, baccaratUnderMinimum, baccaratWager, clearBaccaratBets, dealBaccarat, doubleBaccaratBets, freshBaccarat, nextBaccaratRound, placeBaccaratBet, readBaccaratState, repeatBaccaratBets, resetBaccaratStats, undoBaccaratBet, type BaccaratBet, type BaccaratState } from "../../core/baccarat";
import { PlayingCard, SandsDialog, SandsMark } from "./SandsShared";
import { FlyingChip, type ChipFlight } from "./BlackjackChips";
import { chipColor } from "./blackjackPresentation";
import { readDisplaySettings } from "./displaySettings";
import { BaccaratHistory, BaccaratRoad, BaccaratRules, BaccaratStatsReport, baccaratFormat as format, baccaratSigned as signed } from "./BaccaratReports";
import "./baccarat.css";

const storageKey = "sands2018.baccarat.v1";
function load() {
  try { return readBaccaratState(JSON.parse(localStorage.getItem(storageKey) ?? "null")) ?? freshBaccarat(); }
  catch { return freshBaccarat(); }
}
const compact = (n: number) => n >= 10000 ? `${Math.round(n / 100) / 100}万` : String(n);

export function BaccaratGame({ desktop, active, onLobby, onSettings }: { desktop: boolean; active: boolean; onLobby: () => void; onSettings: () => void }) {
  const [state, setState] = useState(load);
  const current = useRef(state);
  const [playback, setPlayback] = useState<BaccaratState | null>(null);
  const [dealt, setDealt] = useState(0);
  const [flipped, setFlipped] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [flights, setFlights] = useState<ChipFlight[]>([]);
  const flightId = useRef(0);
  const [dialog, setDialog] = useState<"rules" | "history" | "road" | "stats" | "reset" | "credits" | null>(null);
  const [notice, setNotice] = useState("");
  const [width, setWidth] = useState(innerWidth);
  const root = useRef<HTMLElement>(null);
  const locked = useRef(false);
  const pending = useRef<BaccaratState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animating = !!playback;
  const busy = animating || !!state.settled;
  const result = playback?.settled ?? state.settled;
  const resultVisible = !!result && (!animating || reveal);
  const displayBets = result?.bets ?? state.bets;
  const wagered = baccaratWager(displayBets);
  const sequence = result ? baccaratSequence(result) : [];
  const invalid = busy ? [] : baccaratUnderMinimum(state.bets);
  const scale = desktop ? Math.min(1, width / 960) : 1;

  useLayoutEffect(() => {
    const resize = () => setWidth(window.visualViewport?.width ?? innerWidth);
    resize(); window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, []);
  const finish = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    if (pending.current) { current.current = pending.current; setState(pending.current); pending.current = null; }
    locked.current = false; setPlayback(null); setReveal(false);
  }, []);
  useEffect(() => {
    const hide = () => { if (document.visibilityState === "hidden") finish(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); timers.current.forEach(clearTimeout); };
  }, [finish]);
  useEffect(() => { if (!active) finish(); }, [active, finish]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer); }, [notice]);
  const finishFlight = useCallback((id: number) => setFlights(list => list.filter(f => f.id !== id)), []);
  function persist(next: BaccaratState) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); return true; }
    catch { setNotice("本地存储不可用，本次操作未执行"); return false; }
  }
  function update(action: (s: BaccaratState) => BaccaratState) {
    if (locked.current) return false;
    const next = action(current.current);
    if (next === current.current || !persist(next)) return false;
    current.current = next; setState(next); setNotice(""); return true;
  }
  function place(id: BaccaratBet) {
    if (locked.current || current.current.settled) return;
    const value = current.current.selected;
    const from = root.current?.querySelector(`.bac-chips [aria-label="${value} 筹码"]`)?.getBoundingClientRect();
    const target = root.current?.querySelector(`[data-bac-bet="${id}"] .bac-stake-anchor`)?.getBoundingClientRect();
    if (!update(s => placeBaccaratBet(s, id))) { setNotice("可用筹码不足，或已达每轮上限100,000"); return; }
    if (from && target && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const size = target.width;
      setFlights(list => [...list, { id: ++flightId.current, value, size, fromX: from.x, fromY: from.y, x: target.x, y: target.y }]);
    }
  }
  function deal() {
    if (locked.current || current.current.settled) return;
    const under = baccaratUnderMinimum(current.current.bets);
    if (under.length) { setNotice(`${under.map(id => baccaratLabels[id]).join("、")}每格最低20，请补足或撤销`); return; }
    locked.current = true;
    let next: BaccaratState;
    try { next = dealBaccarat(current.current); }
    catch { locked.current = false; setNotice("安全随机数不可用，请稍后重试"); return; }
    if (next === current.current || !persist(next)) { locked.current = false; return; }
    pending.current = next; setNotice(""); setDealt(0); setFlipped(0); setReveal(false); setPlayback(next);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fast = readDisplaySettings().speed === "fast";
    const count = baccaratSequence(next.settled!).length;
    const step = reduced ? 140 : fast ? 800 : 1200;
    const flipDelay = reduced ? 60 : 460;
    const startDelay = reduced ? 30 : 180;
    const drawPause = reduced ? 100 : fast ? 400 : 700;
    const schedule = (fn: () => void, delay: number) => timers.current.push(setTimeout(fn, delay));
    for (let i = 0; i < count; i++) {
      // Pause after the initial four cards before applying the third-card tableau.
      const at = startDelay + i * step + (i >= 4 ? drawPause : 0);
      schedule(() => setDealt(i + 1), at);
      schedule(() => setFlipped(i + 1), at + flipDelay);
    }
    const revealAt = startDelay + count * step + (count > 4 ? drawPause : 0);
    schedule(() => setReveal(true), revealAt);
    schedule(finish, revealAt + (reduced ? 250 : fast ? 650 : 1000));
  }
  function hand(side: "player" | "banker") {
    const visible = sequence.filter((c, i) => c.side === side && (!animating || i < dealt));
    const faceCards = sequence.filter((c, i) => c.side === side && (!animating || i < flipped)).map(c => c.id);
    const hasHidden = visible.length > faceCards.length;
    return <section className={`bac-hand ${side}${resultVisible && result?.outcome === side ? " is-winner" : ""}`} aria-label={`${baccaratLabels[side]}家牌面`}>
      <header><span>{baccaratLabels[side]}</span><strong>{faceCards.length ? `${baccaratPoints(faceCards)}${hasHidden ? " + ?" : ""}` : "—"}</strong></header>
      <div className="bac-cards" style={{ "--card-count": Math.max(2, visible.length) } as CSSProperties}>
        {!result && <><div className="bj-card-placeholder" /><div className="bj-card-placeholder" /></>}
        {visible.map((c, i) => <PlayingCard key={`${result!.id}-${c.id}`} card={baccaratCard(c.id, result!.shoeNumber, animating && sequence.findIndex(v => v.id === c.id) >= flipped)} index={i} />)}
      </div>
      <small>{resultVisible && result ? `${result[side === "player" ? "playerPair" : "bankerPair"] ? "对子" : ""}${result.natural && baccaratPoints(result[side].slice(0, 2)) >= 8 ? " 天牌" : ""}` : ""}</small>
    </section>;
  }
  return <main ref={root} className={`sands-surface bac-game ${desktop ? "is-desktop" : "is-mobile"}`} data-phase={animating ? reveal ? "revealing" : "dealing" : state.settled ? "result" : "betting"} style={{ "--bac-scale": scale, ...(desktop ? { width: `${100 / scale}%`, height: `calc(100dvh / ${scale})`, transform: `scale(${scale})` } : {}) } as CSSProperties}>
    <header className="bac-header"><div className="bac-brand"><button type="button" className="sands-icon" title="返回大厅" aria-label="返回大厅" disabled={animating} onClick={onLobby}><ArrowLeft size={21} /></button><SandsMark compact /></div><h1>百家乐</h1><div className="bac-header-tools"><button type="button" className="sands-icon" title="玩法与赔率" aria-label="玩法与赔率" onClick={() => setDialog("rules")}><CircleHelp size={21} /></button><button type="button" className="sands-icon" title="配置" aria-label="配置" onClick={onSettings}><Settings2 size={21} /></button></div></header>
    <div className="bac-workspace"><section className="bac-table" aria-label="百家乐桌面">
      <div className="bac-meta"><span>八副牌 · 庄赢佣金5%</span><span>牌靴 {playback?.shoeNumber ?? (state.shoeNumber || 1)} <i className="bj-shoe-meter"><span style={{ width: `${(playback?.shoe.length ?? (state.shoeNumber ? state.shoe.length : 408)) / 416 * 100}%` }} /></i>{playback?.shoe.length ?? (state.shoeNumber ? state.shoe.length : 408)}/416</span></div>
      <div className="bac-hands">{hand("player")}{hand("banker")}</div>
      <div className={`bac-outcome${resultVisible ? ` is-result ${result!.outcome}` : ""}`} role="status" key={resultVisible ? `r${result!.id}` : "waiting"}>
        {resultVisible && result ? <><strong>{result.outcome === "tie" ? "和局" : `${baccaratLabels[result.outcome]}赢`} <em className={result.profit < 0 ? "lose" : "win"}>{signed(result.profit)}</em></strong><span>投注 {format(result.wagered)} <i /> 赢回 {format(result.returned)}{result.commission > 0 && <small>佣金 {format(result.commission)}</small>}</span></>
          : <><strong>{animating ? "发牌中" : "请下注"}</strong><span>{animating ? "买定离手" : state.shoeNumber && state.shoe.length <= baccaratCut ? "下一局换靴" : "MIN 20 · BACCARAT"}</span></>}
      </div>
      <div className="bac-bets" role="group" aria-label="下注区">{baccaratBetIds.map(id => {
        const amount = displayBets[id] ?? 0;
        const payout = resultVisible && result ? baccaratReturn(id, 100, result) : null;
        return <button type="button" key={id} data-bac-bet={id} className={`bac-bet ${id}${amount ? " has-bet" : ""}${invalid.includes(id) ? " under-minimum" : ""}${payout !== null ? payout > 100 ? " is-winner" : payout === 100 ? " is-push" : " is-loser" : ""}`} disabled={busy} aria-label={`${baccaratLabels[id]}，赔率${baccaratOdds[id]}${amount ? `，已押${amount}` : ""}`} title={`${baccaratLabels[id]} · ${baccaratOdds[id]} · 最低20`} onClick={() => place(id)}>
          <strong>{baccaratLabels[id]}</strong><small>{baccaratOdds[id]}</small><span className="bac-stake-anchor">{amount > 0 && <span key={amount} className="bac-stake" style={{ "--chip-color": chipColor(amount) } as CSSProperties}><b>{compact(amount)}</b></span>}</span>
        </button>;
      })}</div>
    </section><aside className="bac-road-sidebar" aria-label="本靴路单"><header><span>本靴路单</span><small>{state.shoeRounds.length} 局</small></header><BaccaratRoad rounds={state.shoeRounds} compact active={active} /><p>牌靴 {state.shoeNumber || 1}</p></aside></div>
    <section className="bac-dock" aria-label="游戏操作"><div className="bac-wager"><span>本轮投注</span><strong>{format(wagered)}</strong></div>
      <div className="bac-chips" role="group" aria-label="选择筹码">{baccaratChips.map(n => <button type="button" key={n} className={`bj-chip${state.selected === n ? " selected" : ""}`} style={{ "--chip-color": chipColor(n) } as CSSProperties} aria-label={`${n} 筹码`} aria-pressed={state.selected === n} title={`${n} 筹码`} disabled={busy} onClick={() => update(s => ({ ...s, selected: n }))}><span>{n}</span></button>)}</div>
      <div className="bac-tools"><button type="button" className="sands-icon" title="撤销下注" aria-label="撤销下注" disabled={busy || !state.undo.length} onClick={() => update(undoBaccaratBet)}><Undo2 size={21} /></button><button type="button" className="sands-icon" title="清空下注" aria-label="清空下注" disabled={busy || !baccaratWager(state.bets)} onClick={() => update(clearBaccaratBets)}><Trash2 size={21} /></button><button type="button" className="sands-icon" title="重复上轮投注" aria-label="重复上轮投注" disabled={busy || !baccaratWager(state.lastBets) || baccaratWager(state.lastBets) > state.balance} onClick={() => update(repeatBaccaratBets)}><RotateCcw size={23} /></button><button type="button" className="sands-icon" title="加倍当前投注" aria-label="加倍当前投注" disabled={busy || !wagered || wagered * 2 > Math.min(state.balance, baccaratMaximum)} onClick={() => update(doubleBaccaratBets)}><span>x2</span></button></div>
      <button type="button" className="sands-button primary bac-deal" disabled={animating || !state.settled && !baccaratWager(state.bets)} onClick={state.settled ? () => update(nextBaccaratRound) : deal}>{state.settled ? <><ArrowRight size={21} />下一轮</> : <><Play size={20} fill="currentColor" />发牌</>}</button>
    </section>
    <footer className="bac-footer"><button type="button" className="sands-balance-button" title="补充虚拟筹码" aria-label="补充虚拟筹码" disabled={animating} onClick={() => setDialog("credits")}><span>可用筹码 <CirclePlus size={15} /></span><strong>{format(state.balance - baccaratWager(state.bets))}</strong></button><div><span>累计投注</span><strong>{format(state.stats.wagered)}</strong></div><div><span>累计赢利</span><strong className={state.stats.profit < 0 ? "lose" : "win"}>{signed(state.stats.profit)}</strong></div><nav aria-label="记录与统计"><button type="button" className="sands-icon" title="路单" aria-label="路单" onClick={() => setDialog("road")}><LayoutGrid size={21} /></button><button type="button" className="sands-icon" title="基础统计" aria-label="基础统计" onClick={() => setDialog("stats")}><ChartNoAxesColumnIncreasing size={21} /></button><button type="button" className="sands-icon" title="结算明细" aria-label="结算明细" onClick={() => setDialog("history")}><History size={22} /></button><button type="button" className="sands-icon" title="重置统计" aria-label="重置统计" disabled={animating} onClick={() => setDialog("reset")}><RotateCcw size={21} /></button></nav></footer>
    {notice && <div className="bac-notice" role="alert">{notice}</div>}
    {flights.map(f => <FlyingChip key={f.id} flight={f} onFinish={finishFlight} />)}
    {dialog && <SandsDialog title={{ rules: "百家乐 · 玩法与赔率", history: "百家乐 · 结算明细", road: "百家乐 · 本靴路单", stats: "百家乐 · 基础统计", reset: "重置统计", credits: "补充筹码" }[dialog]} className={dialog === "road" ? "bac-road-modal" : "bac-modal"} onClose={() => setDialog(null)}>
      {dialog === "rules" && <BaccaratRules />}{dialog === "history" && <BaccaratHistory history={state.history} />}{dialog === "road" && <BaccaratRoad rounds={state.shoeRounds} />}{dialog === "stats" && <BaccaratStatsReport stats={state.stats} />}
      {(dialog === "reset" || dialog === "credits") && <><p className="sands-confirm-copy">{dialog === "reset" ? "清零累计投注、赢利、统计及结算记录。保留可用筹码、当前投注、牌靴和本靴路单。" : "增加10,000虚拟筹码，不计入赢利。"}</p><footer className="sands-modal-actions"><button type="button" className="sands-button" onClick={() => setDialog(null)}>取消</button><button type="button" className="sands-button primary" disabled={animating} onClick={() => { update(dialog === "reset" ? resetBaccaratStats : s => ({ ...s, balance: Math.min(1e12, s.balance + 10000) })); setDialog(null); }}>{dialog === "reset" ? "重置" : "补充"}</button></footer></>}
    </SandsDialog>}
  </main>;
}
