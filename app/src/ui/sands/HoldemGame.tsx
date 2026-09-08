import { useCallback, useEffect, useRef, useState } from "react";
import { actHoldem, advanceHoldem, freshHoldem, holdemBigBlind, holdemBuyIn, holdemLegal, holdemNames, holdemPotTotal, holdemSmallBlind, holdemStreetNames, readHoldemState, resetHoldemStats, startHoldem, topUpHoldem, type HoldemState } from "../../core/holdem";
import { chooseHoldemAction, finishFoldedHoldem, observeHoldem } from "../../core/holdemBot";
import { evaluateHoldem } from "../../core/pokerCards";
import { SandsDialog } from "./SandsShared";
import { readDisplaySettings } from "./displaySettings";
import { PokerCards, PokerFooter, PokerHeader, pokerFormat as format, pokerSigned as signed, usePokerAnimation, usePokerStore, usePokerViewport, type PokerGameProps } from "./PokerShared";
import "./poker.css";

export function HoldemGame({ desktop, active, onLobby, onSettings }: PokerGameProps) {
  const { state, current, commit, notice } = usePokerStore("sands2018.holdem.v1", freshHoldem, readHoldemState);
  const { animation, locked, run } = usePokerAnimation(active);
  const style = usePokerViewport(desktop);
  const [dialog, setDialog] = useState<"rules" | "history" | "stats" | "credits" | "reset" | null>(null);
  const [foreground, setForeground] = useState(document.visibilityState !== "hidden");
  const [retry, setRetry] = useState(0);
  const [raiseTo, setRaiseTo] = useState(200);
  const prior = useRef(state);
  const fast = readDisplaySettings().speed === "fast";
  const legal = holdemLegal(state, 0);
  const hero = state.players[0];
  const settled = state.phase === "settled" && !animation;
  const acting = legal.isTurn && !animation && active;
  const best = state.board.length >= 3 && hero.hole.length ? evaluateHoldem([...hero.hole, ...state.board]) : null;
  const ledger = animation && state.phase === "settled" ? prior.current : state;
  const perform = useCallback((action: (s: HoldemState) => HoldemState, dealing = false) => {
    if (locked.current) return;
    const before = current.current;
    const next = commit(action);
    if (!next) return;
    prior.current = before;
    const speedy = readDisplaySettings().speed === "fast";
    if (dealing) run("deal", 12, speedy ? 120 : 240);
    else if (next.phase === "settled") run("settle", 1, speedy ? 300 : 650);
    else if (next.board.length > before.board.length) run("board", next.board.length - before.board.length, speedy ? 350 : 600);
  }, [commit, current, locked, run]);
  useEffect(() => {
    const change = () => setForeground(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", change);
    return () => document.removeEventListener("visibilitychange", change);
  }, []);
  useEffect(() => {
    setRaiseTo(Math.min(legal.maxTo, legal.minTo));
  }, [state.roundId, state.street, state.currentBet, legal.maxTo, legal.minTo]);
  useEffect(() => {
    if (!active || !foreground || dialog || animation || state.phase !== "playing" || state.actor === 0) return;
    const timer = setTimeout(() => {
      if (current.current.actor < 0) perform(advanceHoldem);
      else perform(s => actHoldem(s, s.actor, chooseHoldemAction(observeHoldem(s))));
    }, fast ? 400 : 950);
    return () => clearTimeout(timer);
  }, [active, foreground, dialog, animation, state, fast, perform, current, retry]);
  const position = (seat: number) => seat === state.button ? "D" : seat === (state.button + 1) % 6 ? "SB" : seat === (state.button + 2) % 6 ? "BB" : "";
  const boardVisible = animation?.kind === "board" ? state.board.length - animation.total + animation.visible : state.board.length;
  const turn = state.phase === "ready" ? "盲注 50 / 100 · 六人桌" : animation ? animation.kind === "deal" ? "正在发底牌" : animation.kind === "board" ? `正在发${holdemStreetNames[state.street]}` : "正在摊牌结算"
    : settled ? `本局${state.result!.profit > 0 ? "赢利" : state.result!.profit < 0 ? "净输" : "持平"} ${signed(state.result!.profit)}`
    : state.actor === 0 ? `轮到你${legal.call ? ` · 跟注 ${format(legal.call)}` : " · 可以过牌"}` : state.actor < 0 ? "本轮下注结束" : `${holdemNames[state.actor]}正在考虑`;
  return <main className={`sands-surface poker-game holdem-game ${desktop ? "is-desktop" : "is-mobile"}`} style={style} data-phase={animation ? "animating" : state.phase}>
    <PokerHeader title="德州扑克" onLobby={onLobby} onSettings={onSettings} onRules={() => setDialog("rules")} />
    <div className="poker-workspace"><section className="holdem-felt" aria-label="德州扑克桌面">
      <div className="poker-table-meta"><span>无限注 · 盲注 {holdemSmallBlind}/{holdemBigBlind}</span><span>第 {state.roundId || 1} 局 · 六人桌</span></div>
      <div className="holdem-table">{state.players.map((p, seat) => {
        const won = settled && state.result!.payouts[seat] > p.committed;
        const hidden = seat !== 0 && !(settled && state.result!.showdown && !p.folded);
        const sequenceIndex = (seat - state.button - 1 + 6) % 6;
        const visible = animation?.kind === "deal" ? Number(animation.visible > sequenceIndex) + Number(animation.visible > sequenceIndex + 6) : p.hole.length;
        return <section key={seat} className={`holdem-seat seat-${seat}${!animation && state.actor === seat ? " is-acting" : ""}${p.folded ? " is-folded" : ""}${won ? " is-winner" : ""}`} aria-label={`${holdemNames[seat]}牌位`}>
          <header><strong>{holdemNames[seat]}</strong>{state.phase !== "ready" && position(seat) && <span className="holdem-position" title={position(seat) === "D" ? "庄位" : position(seat) === "SB" ? "小盲" : "大盲"}>{position(seat)}</span>}<small>{format(ledger.players[seat].chips)}</small></header>
          <PokerCards cards={p.hole} hand={state.roundId} hidden={hidden} slots={2} visible={visible} best={settled && !p.folded && state.result!.showdown ? evaluateHoldem([...p.hole, ...state.board]).cards : []} />
          <small>{settled ? p.folded ? "弃牌" : `${state.result!.labels[seat]}${state.result!.payouts[seat] ? ` · 收回 ${format(state.result!.payouts[seat])}` : ""}` : p.action || (seat === 0 ? "你的手牌" : "等待行动")}</small>
        </section>;
      })}<div className="holdem-center"><div className="holdem-pot"><span>{settled ? "本局底池" : "底池"}</span><strong>{format(holdemPotTotal(state))}</strong><span>{holdemStreetNames[state.street]}</span></div>
        <PokerCards cards={state.board} hand={state.roundId} slots={5} visible={boardVisible} best={settled && best ? best.cards : []} />
        <small>{state.phase === "ready" ? "每人两张底牌 · 共用五张公共牌" : !animation && best ? `你的牌型 · ${best.label}` : "SANDS2018 · TEXAS HOLD’EM"}</small>
      </div></div>
    </section><aside className="poker-sidebar"><h2>本局动态</h2><p>庄位顺时针轮换</p><ol>{state.log.slice(-14).map((line, i) => <li key={`${i}-${line}`}>{line}</li>)}</ol>{settled && state.result!.pots.map((pot, i) => <p key={i}>{i ? `边池 ${i}` : "主池"} {format(pot.amount)} · {pot.winners.map(n => holdemNames[n]).join("、")}</p>)}</aside></div>
    <section className="poker-controls" aria-label="德州操作"><div className="poker-turn" role="status">{turn}</div>
      {state.phase !== "playing" ? <div className="holdem-actions"><button type="button" className="sands-button primary" disabled={!!animation || hero.chips < 1} onClick={() => perform(startHoldem, true)}>{state.phase === "ready" ? "开始发牌" : "下一局"}</button>{hero.chips < 1 && <button type="button" className="sands-button" onClick={() => setDialog("credits")}>补充筹码</button>}</div>
        : <div className="holdem-controls-row"><div className="holdem-actions"><button type="button" className="sands-button" disabled={!acting} onClick={() => perform(s => actHoldem(s, 0, { type: "fold" }))}>弃牌</button>
          <button type="button" className="sands-button primary" disabled={!acting} onClick={() => perform(s => actHoldem(s, 0, { type: holdemLegal(s, 0).canCheck ? "check" : "call" }))}>{legal.canCheck ? "过牌" : `跟注 ${format(legal.call)}`}</button>
          <button type="button" className="sands-button poker-allin" disabled={!acting || !legal.canAllIn} onClick={() => perform(s => actHoldem(s, 0, { type: "allin" }))}>全下</button></div>
          <div className="holdem-raise"><input type="range" aria-label="加注额度" min={Math.min(legal.minTo, legal.maxTo)} max={legal.maxTo} step={1} value={raiseTo} disabled={!acting || !legal.canRaise} onChange={e => setRaiseTo(Number(e.target.value))} />
            <label>本轮加注至<input type="number" aria-label="加注至" min={Math.min(legal.minTo, legal.maxTo)} max={legal.maxTo} step={1} value={raiseTo} disabled={!acting || !legal.canRaise} onChange={e => setRaiseTo(Number(e.target.value))} /></label>
            <button type="button" className="sands-button" disabled={!acting || !legal.canRaise || !Number.isInteger(raiseTo) || raiseTo < Math.min(legal.minTo, legal.maxTo) || raiseTo > legal.maxTo} onClick={() => perform(s => actHoldem(s, 0, { type: "raise", to: raiseTo }))}>确认加注</button></div>
        </div>}
      {hero.folded && state.phase === "playing" && !animation && <button type="button" className="sands-button poker-skip" onClick={() => perform(finishFoldedHoldem)}>快速看完本局</button>}
    </section>
    <PokerFooter balance={ledger.players[0].chips} rounds={ledger.stats.hands} profit={ledger.stats.profit} disabled={state.phase === "playing" || !!animation} onCredits={() => setDialog("credits")} onHistory={() => setDialog("history")} onStats={() => setDialog("stats")} onReset={() => setDialog("reset")} />
    {notice && <div className="poker-notice" role="alert">{notice} <button type="button" className="sands-button" onClick={() => setRetry(n => n + 1)}>重试</button></div>}
    {dialog && <SandsDialog title={{ rules: "德州扑克 · 玩法", history: "德州扑克 · 历史", stats: "德州扑克 · 统计", credits: "补充虚拟筹码", reset: "重置统计" }[dialog]} onClose={() => setDialog(null)}>
      <div className="poker-report">{dialog === "rules" && <><p>你与五名电脑玩家同桌，每人起始10,000虚拟筹码，盲注50/100。电脑玩家在浏览器本地运行，只使用自己的手牌、公共牌和公开下注信息。</p>
        <p>每人两张底牌。依次进行翻牌前、翻牌（三张）、转牌（一张）、河牌（一张）四轮下注。七张牌中选最好的五张，公共牌也可以全部使用；花色不分大小。</p>
        <p>轮到你时可以弃牌、过牌、跟注、加注或全下。加注金额表示本轮投入总额，最低加注增量不得小于上一次完整加注；不足额全下不会自动重新开放加注。</p>
        <p>全下按各人的实际投入分主池、边池。无人跟注的超额筹码退回；平手分池，无法整除的余数从庄位左侧先分。只有一人未弃牌时直接获胜。</p>
        <p>每局结束后可继续下一局。电脑玩家不足一个大盲时自动补至10,000；你的筹码只能在局间补充，补充不计入赢利。无抽水。离开页面暂停行动，返回或刷新可接着玩。</p>
        <p>牌型从大到小：皇家同花顺、同花顺、四条、葫芦、同花、顺子、三条、两对、一对、高牌。A可用于A2345。</p>
        <p><a href="https://www.pokerstars.com/poker/learn/lesson/texas-holdem-rules/" target="_blank" rel="noreferrer">德州基本规则</a> · <a href="https://www.pokertda.com/view-poker-tda-rules/" target="_blank" rel="noreferrer">下注与分池规则参考</a></p></>}
        {dialog === "history" && <>{!state.history.length && <p>暂无记录</p>}{state.history.map(r => <details key={r.id}><summary><span>第 {r.id} 局 · {r.showdown ? "摊牌" : "弃牌结束"}</span><strong className={r.profit < 0 ? "lose" : "win"}>{signed(r.profit)}</strong></summary><PokerCards cards={r.board} hand={r.id} className="history-cards" />{r.holes.map((hole, i) => <div key={i}><div className="poker-history-player"><span>{holdemNames[i]} · {r.labels[i]}</span><span>投入 {format(r.contributions[i])} · 收回 {format(r.payouts[i])}</span></div>{(i === 0 || r.showdown && !r.folded[i]) && <PokerCards cards={hole} hand={r.id} className="history-cards" />}</div>)}{r.pots.map((p, i) => <p key={i}>{i ? `边池 ${i}` : "主池"} {format(p.amount)} · {p.winners.map(n => holdemNames[n]).join("、")}</p>)}</details>)}</>}
        {dialog === "stats" && <dl>{[["已玩局数", state.stats.hands], ["盈利局数", state.stats.wins], ["参与摊牌", state.stats.showdowns], ["实际投入", state.stats.invested], ["实际赢回", state.stats.returned], ["累计赢利", state.stats.profit]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{format(Number(value))}</dd></div>)}</dl>}
        {(dialog === "credits" || dialog === "reset") && <><p>{dialog === "credits" ? `增加${format(holdemBuyIn)}虚拟筹码，不计入赢利。` : "清零统计与历史，保留当前筹码及已完成的牌局。"}</p><footer className="sands-modal-actions"><button type="button" className="sands-button" onClick={() => setDialog(null)}>取消</button><button type="button" className="sands-button primary" disabled={state.phase === "playing" || !!animation} onClick={() => { commit(dialog === "credits" ? topUpHoldem : resetHoldemStats); setDialog(null); }}>确认</button></footer></>}
      </div>
    </SandsDialog>}
  </main>;
}
