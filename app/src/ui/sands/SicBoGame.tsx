import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, ArrowRight, ChartNoAxesColumnIncreasing, CircleHelp, CirclePlus, Dices, History, ListOrdered, RotateCcw, Settings2, Trash2, Undo2 } from "lucide-react";
import { belowSicBoMinimum, clearSicBoBets, diceTotal, doubleSicBoBets, freshSicBo, getSicBoBetMap, getSicBoBets, getSicBoChips, isTriple, nextSicBoRound, placeSicBoBet, readSicBoState, repeatSicBoBets, resetSicBoStats, rollSicBo, selectedSicBoChip, sicBoMaximum, sicBoMinimumFor, sicBoPayout, sicBoRules, undoSicBoBet, wagerTotal, type Dice, type SicBoBet, type SicBoMinimum, type SicBoRound, type SicBoState } from "../../core/sicBo";
import { chipColor } from "./blackjackPresentation";
import { DiceFace } from "./DiceFace";
import { SandsDialog, SandsMark } from "./SandsShared";
import { readDisplaySettings } from "./displaySettings";
import { fitSicBoViewport } from "./sicBoLayout";
import { useSicBoSettings, writeSicBoSettings } from "./sicBoSettings";
import { SicBoHistoryReport, SicBoRecentReport, SicBoRulesReport, SicBoStatsReport } from "./SicBoReports";

const storageKey = "sands2018.sicbo.v1";
const format = (n: number) => n.toLocaleString("zh-CN");
const signed = (n: number) => `${n > 0 ? "+" : ""}${format(n)}`;
const compact = (n: number) => n >= 10000 ? `${Math.round(n / 100) / 100}万` : String(n);
function load() {
  try { return readSicBoState(JSON.parse(localStorage.getItem(storageKey) ?? "null")) ?? freshSicBo(); }
  catch { return freshSicBo(); }
}
function viewport() {
  const root = getComputedStyle(document.documentElement);
  const inset = (side: string) => parseFloat(root.getPropertyValue(`--app-safe-area-${side}`)) || 0;
  return { width: window.visualViewport?.width ?? innerWidth, height: window.visualViewport?.height ?? innerHeight, top: inset("top"), right: inset("right"), bottom: inset("bottom"), left: inset("left") };
}

export function SicBoGame({ desktop, active, onLobby, onSettings }: { desktop: boolean; active: boolean; onLobby: () => void; onSettings: () => void }) {
  const [state, setState] = useState(load);
  const [phase, setPhase] = useState<"betting" | "rolling" | "revealing" | "result">(state.settled ? "result" : "betting");
  const [shownDice, setShownDice] = useState<Dice | null>(state.settled?.dice ?? null);
  const [result, setResult] = useState<SicBoRound | null>(state.settled);
  const [dialog, setDialog] = useState<"rules" | "history" | "recent" | "statistics" | "reset" | "credits" | null>(null);
  const settings = useSicBoSettings();
  const [notice, setNotice] = useState("");
  const [size, setSize] = useState(viewport);
  const locked = useRef(false);
  const pending = useRef<SicBoState | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const diceTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = phase !== "betting";
  const animating = phase === "rolling" || phase === "revealing";
  const chips = getSicBoChips(settings.minimum);
  const selected = selectedSicBoChip(state.selected, settings.minimum);
  const displayedBets = result?.bets ?? state.bets;
  const wagered = wagerTotal(displayedBets);
  const rule = result?.rule ?? pending.current?.settled?.rule ?? settings.rule;
  const table = getSicBoBets(rule);
  const betMap = getSicBoBetMap(rule);
  const invalidBets = busy ? [] : belowSicBoMinimum(state.bets, settings.minimum);
  const layout = fitSicBoViewport(size.width - size.left - size.right, size.height - size.top - size.bottom, desktop);
  useLayoutEffect(() => {
    if (!active) return;
    const resize = () => setSize(viewport());
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, [active]);
  useEffect(() => () => { timers.current.forEach(clearTimeout); if (diceTimer.current) clearInterval(diceTimer.current); }, []);
  useEffect(() => {
    // During playback, storage already contains settlement; never overwrite it with the pre-roll view.
    if (animating || locked.current || state.selected === selected) return;
    const next = { ...state, selected };
    setState(next); persist(next);
  }, [animating, selected, state]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2600);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const finishHidden = () => {
      if (document.visibilityState !== "hidden" || !pending.current) return;
      timers.current.forEach(clearTimeout);
      if (diceTimer.current) clearInterval(diceTimer.current);
      setState(pending.current); setShownDice(pending.current.lastDice); setResult(pending.current.settled); setPhase("result");
      locked.current = false; pending.current = null;
    };
    document.addEventListener("visibilitychange", finishHidden);
    return () => document.removeEventListener("visibilitychange", finishHidden);
  }, []);

  function persist(next: SicBoState) {
    try { localStorage.setItem(storageKey, JSON.stringify(next)); }
    catch { setNotice("本地存储不可用，刷新后可能丢失牌局"); }
  }
  function update(fn: (s: SicBoState) => SicBoState) {
    if (locked.current) return;
    const next = fn(state);
    if (next === state) return;
    setState(next); persist(next);
  }
  function place(id: string) {
    if (locked.current || busy) return;
    const current = state.selected === selected ? state : { ...state, selected };
    const next = placeSicBoBet(current, id);
    if (next === current) { setNotice(wagered + selected > sicBoMaximum ? "每轮最多投注 100,000" : "可用筹码不足"); return; }
    setNotice(""); setState(next); persist(next);
  }
  function play() {
    if (locked.current || busy || !wagered) return;
    if (invalidBets.length) {
      const bet = betMap.get(invalidBets[0])!;
      setNotice(`${bet.label}每格最低 ${sicBoMinimumFor(bet, settings.minimum)}，请补足或撤销该注`);
      return;
    }
    locked.current = true;
    let next: SicBoState;
    try { next = rollSicBo(state, undefined, settings); }
    catch { locked.current = false; setNotice("随机数生成不可用，请使用支持安全随机数的浏览器"); return; }
    if (next === state) { locked.current = false; return; }
    // Save the complete transaction before playback, so refresh cannot reroll or pay twice.
    persist(next); pending.current = next;
    setPhase("rolling"); setNotice(""); setResult(null);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 1100 : readDisplaySettings().speed === "fast" ? 3000 : 5000;
    const revealAt = reduced ? 150 : Math.round(duration * .42);
    let tick = 0;
    if (!reduced) diceTimer.current = setInterval(() => { tick += 1; setShownDice([tick % 6 + 1, (tick + 2) % 6 + 1, (tick + 4) % 6 + 1] as Dice); }, 85);
    timers.current = [setTimeout(() => {
      if (diceTimer.current) clearInterval(diceTimer.current);
      setShownDice(next.lastDice); setResult(next.settled); setPhase("revealing");
    }, revealAt), setTimeout(() => {
      setState(next); setPhase("result"); locked.current = false; pending.current = null;
    }, duration)];
  }
  function nextRound() {
    if (locked.current || phase !== "result") return;
    const next = nextSicBoRound(state);
    setState(next); persist(next); setResult(null); setShownDice(null); setPhase("betting"); setNotice("");
  }
  function changeMinimum(minimum: SicBoMinimum) {
    if (busy || locked.current) return;
    try { writeSicBoSettings({ ...settings, minimum }); setNotice(""); }
    catch { setNotice("配置保存失败"); }
  }
  function cell(bet: SicBoBet, style?: CSSProperties) {
    const amount = displayedBets[bet.id] ?? 0;
    const win = result && sicBoPayout(bet, result.dice) >= 0;
    const odds = bet.kind === "single" ? `1 / 2 / ${bet.singleTriple}:1` : `${bet.odds}:1`;
    const minimum = sicBoMinimumFor(bet, settings.minimum);
    return <button key={bet.id} type="button" className={`sic-bet${amount ? " has-bet" : ""}${win ? " is-winner" : ""}${invalidBets.includes(bet.id) ? " is-under-minimum" : ""}`} data-bet={bet.id} data-kind={bet.kind} style={style} disabled={busy}
      aria-label={`${bet.label}，赔率${odds}，最低下注${minimum}${amount ? `，已押${amount}` : ""}`} title={`${bet.label} · ${odds} · 最低 ${minimum}${amount ? ` · 已押 ${format(amount)}` : ""}`} onClick={() => place(bet.id)}>
      <span className="sic-bet-face">{bet.faces.map((value, i) => <DiceFace key={i} value={value} />)}{bet.kind === "total" ? <strong>{bet.total}</strong> : !bet.faces.length && <><strong>{bet.label}</strong>{["small", "big", "any-triple"].includes(bet.kind) && <span className="sic-bet-subtitle">{bet.kind === "small" ? "4—10" : bet.kind === "big" ? "11—17" : "三个相同"}</span>}</>}</span>
      <span className="sic-bet-footer"><small>{odds}</small>{amount > 0 && <span key={amount} className="sic-stake" data-long={compact(amount).length > 4 || undefined} style={{ "--chip-color": chipColor(amount) } as CSSProperties} aria-hidden="true">{compact(amount)}</span>}</span>
    </button>;
  }
  const get = (id: string) => betMap.get(id)!;
  return <main className={`sands-surface sic-game ${desktop ? "is-desktop" : "is-mobile"}`} data-phase={phase} aria-label="骰宝游戏" style={{ "--sands-touch-size": `${44 / layout.scale}px`, width: layout.width, height: layout.height, transform: layout.rotated ? `translate(${size.width - size.right}px,${size.top}px) rotate(90deg) scale(${layout.scale})` : `translate(${size.left}px,${size.top}px) scale(${layout.scale})` } as CSSProperties}>
    <header className="sic-header">
      <div className="sic-brand"><button type="button" className="sands-icon" aria-label="返回大厅" title="返回大厅" onClick={onLobby}><ArrowLeft size={21} /></button><SandsMark compact /><h1>骰宝</h1><div className="sic-table-options"><span>{sicBoRules[rule].label}</span><label>最低下注<select aria-label="桌面最低下注" value={settings.minimum} disabled={busy} onChange={e => changeMinimum(Number(e.target.value) as SicBoMinimum)}>{[500, 300, 20].map(n => <option key={n} value={n}>{n}</option>)}</select></label></div></div>
      <div className="sic-round-display"><div className="sic-dice-tray" aria-label={phase === "rolling" ? "摇骰中" : shownDice ? `骰子 ${shownDice.join("、")}` : "等待开骰"}>{(shownDice ?? [1, 3, 5] as Dice).map((n, i) => <DiceFace key={i} value={n} />)}</div><div className="sic-roll-caption" role="status"><strong>{phase === "rolling" ? "封盘" : shownDice ? `${diceTotal(shownDice)} 点` : "请下注"}</strong><span>{phase === "rolling" ? "摇骰中" : shownDice ? isTriple(shownDice) ? "围骰" : `${diceTotal(shownDice) <= 10 ? "小" : "大"} · ${diceTotal(shownDice) % 2 ? "单" : "双"}` : "SIC BO"}</span></div></div>
      <div className="sic-header-actions"><span>第 {result?.id ?? state.roundId + 1} 轮</span><button type="button" className="sands-icon" title="玩法与赔率" aria-label="玩法与赔率" onClick={() => setDialog("rules")}><CircleHelp size={21} /></button><button type="button" className="sands-icon" title="配置" aria-label="配置" onClick={onSettings}><Settings2 size={21} /></button></div>
    </header>
    <section className="sic-board" aria-label="下注桌面">
      <div className="sic-crown" role="group" aria-label="大小单双与围骰">{cell(get("small"))}{[1, 2, 3, 4, 5, 6].map((n, i) => cell(get(`triple-${n}`), { gridColumn: i < 3 ? i + 2 : i + 3, gridRow: 1 }))}{cell(get("any-triple"))}{cell(get("big"))}{cell(get("odd"))}{cell(get("even"))}</div>
      {([ ["double", "sic-doubles", "对子"], ["total", "sic-totals", "总点数"], ["pair", "sic-pairs", "两骰组合"], ["single", "sic-singles", "单骰"] ] as const).map(([kind, css, label]) => <div key={kind} className={`sic-band ${css}`} role="group" aria-label={label}>{table.filter((b) => b.kind === kind).map((b) => cell(b))}</div>)}
    </section>
    <footer className="sic-dock" aria-label="游戏操作">
      <div className="sic-chips-area"><div className="sic-wager-label"><span>本轮投注</span><strong>{format(wagered)}</strong></div>
        {result && phase === "result" ? <div className="sic-result-summary" role="status"><span>赢回 {format(result.returned)}</span><strong className={result.profit < 0 ? "negative" : "positive"}>{signed(result.profit)}</strong></div>
          : <div className="sic-chips" role="group" aria-label="选择筹码">{chips.map((chip) => <button key={chip} type="button" className={`bj-chip${selected === chip ? " selected" : ""}`} style={{ "--chip-color": chipColor(chip) } as CSSProperties} aria-label={`${chip} 筹码`} title={`${format(chip)} 筹码`} aria-pressed={selected === chip} disabled={busy} onClick={() => update((s) => ({ ...s, selected: chip }))}><span>{compact(chip)}</span></button>)}</div>}
      </div>
      <div className="sic-tools"><button type="button" className="sands-icon" title="撤销下注" aria-label="撤销下注" disabled={busy || !state.undo.length} onClick={() => update(undoSicBoBet)}><Undo2 size={21} /></button><button type="button" className="sands-icon" title="清空下注" aria-label="清空下注" disabled={busy || !wagered} onClick={() => update(clearSicBoBets)}><Trash2 size={20} /></button><button type="button" className="sands-icon" title="重复上轮投注" aria-label="重复上轮投注" disabled={busy || !wagerTotal(state.lastBets) || wagerTotal(state.lastBets) > state.balance} onClick={() => update(repeatSicBoBets)}><RotateCcw size={21} /></button><button type="button" className="sands-icon" title="加倍当前投注" aria-label="加倍当前投注" disabled={busy || !wagered || wagered * 2 > Math.min(sicBoMaximum, state.balance)} onClick={() => update(doubleSicBoBets)}><span>x2</span></button></div>
      <button type="button" className="sands-button primary sic-roll" disabled={animating || phase === "betting" && !wagered} onClick={phase === "result" ? nextRound : play}>{phase === "result" ? <><ArrowRight size={21} />下一轮</> : <><Dices size={21} />摇骰</>}</button>
      <div className="sic-statistics"><button type="button" className="sands-balance-button" aria-label="补充虚拟筹码" title="补充虚拟筹码" disabled={animating} onClick={() => setDialog("credits")}><span>可用筹码 <CirclePlus size={13} /></span><strong>{format(state.balance - wagerTotal(state.bets))}</strong></button><div><span>累计投注</span><strong>{format(state.stats.wagered)}</strong></div><div><span>累计赢利</span><strong className={`sic-profit ${state.stats.profit < 0 ? "negative" : "positive"}`}>{signed(state.stats.profit)}</strong></div></div>
      <div className="sic-stat-tools"><button type="button" className="sands-icon" aria-label="近10轮" title="近10轮" onClick={() => setDialog("recent")}><ListOrdered size={22} /></button><button type="button" className="sands-icon" aria-label="基础统计" title="基础统计" onClick={() => setDialog("statistics")}><ChartNoAxesColumnIncreasing size={22} /></button><button type="button" className="sands-icon" aria-label="结算明细" title="结算明细" onClick={() => setDialog("history")}><History size={22} /></button><button type="button" className="sands-icon" aria-label="重置统计" title="重置统计" disabled={animating} onClick={() => setDialog("reset")}><RotateCcw size={21} /></button></div>
      {result && phase === "revealing" && <div className={`sic-settlement ${result.profit < 0 ? "negative" : "positive"}`} role="status"><strong>{signed(result.profit)}</strong><div><span>投注</span><b>{format(result.wagered)}</b><span>赢回</span><b>{format(result.returned)}</b></div></div>}
    </footer>
    {notice && <div className="sic-notice" role="alert">{notice}</div>}
    {dialog && <SandsDialog title={{ rules: "骰宝 · 玩法与赔率", history: "骰宝 · 结算明细", recent: "骰宝 · 近10轮", statistics: "骰宝 · 基础统计", reset: "重置统计", credits: "补充筹码" }[dialog]} showTitle={dialog !== "recent"} className={dialog === "recent" ? "sic-recent-modal" : dialog === "statistics" ? "sic-stats-modal" : ""} onClose={() => setDialog(null)}>
      {dialog === "rules" && <SicBoRulesReport rule={rule} minimum={settings.minimum} />}
      {dialog === "history" && <SicBoHistoryReport history={state.history} />}
      {dialog === "recent" && <SicBoRecentReport history={state.history} />}
      {dialog === "statistics" && <SicBoStatsReport data={state.distribution} />}
      {(dialog === "reset" || dialog === "credits") && <><p className="sands-confirm-copy">{dialog === "reset" ? "将累计投注、赢利、开奖统计及结算记录清零。可用筹码、当前投注和桌面结果不变。" : "增加 10,000 虚拟筹码，不计入赢利。"}</p><footer className="sands-modal-actions"><button type="button" className="sands-button" onClick={() => setDialog(null)}>取消</button><button type="button" className="sands-button primary" disabled={animating} onClick={() => { update(dialog === "reset" ? resetSicBoStats : (s) => ({ ...s, balance: Math.min(1e12, s.balance + 10000) })); setDialog(null); }}>{dialog === "reset" ? "重置" : "补充"}</button></footer></>}
    </SandsDialog>}
  </main>;
}
