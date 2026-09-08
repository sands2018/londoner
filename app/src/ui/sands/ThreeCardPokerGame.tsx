import { useRef, useState, type CSSProperties } from "react";
import { RotateCcw, Trash2, Undo2 } from "lucide-react";
import { evaluateThreeCard, threeCardHandNames } from "../../core/pokerCards";
import { clearThreeBets, dealThreeCard, decideThreeCard, freshThreeCard, nextThreeCard, placeThreeBet, readThreeCardState, repeatThreeBets, resetThreeStats, threeCardAnteBonusOdds, threeCardChips, threeCardPairOdds, threeCardReserve, undoThreeBet, type ThreeState } from "../../core/threeCardPoker";
import { chipColor } from "./blackjackPresentation";
import { SandsDialog } from "./SandsShared";
import { readDisplaySettings } from "./displaySettings";
import { PokerCards, PokerFooter, PokerHeader, pokerFormat as format, pokerSigned as signed, usePokerAnimation, usePokerStore, usePokerViewport, type PokerGameProps } from "./PokerShared";
import "./poker.css";

const outcomeLabels = { win: "你赢了", lose: "庄家赢", push: "平手", fold: "已弃牌", unqualified: "庄家不合格" };
function Paytable() {
  return <table className="poker-paytable"><thead><tr><th>牌型</th><th>对子奖</th><th>底注奖</th></tr></thead><tbody>{[5, 4, 3, 2, 1].map(c => <tr key={c}><td>{threeCardHandNames[c]}</td><td>{threeCardPairOdds[c]}:1</td><td>{threeCardAnteBonusOdds[c] ? `${threeCardAnteBonusOdds[c]}:1` : "—"}</td></tr>)}</tbody></table>;
}
export function ThreeCardPokerGame({ desktop, active, onLobby, onSettings }: PokerGameProps) {
  const { state, current, commit, notice, setNotice } = usePokerStore("sands2018.threecard.v1", freshThreeCard, readThreeCardState);
  const { animation, locked, run } = usePokerAnimation(active);
  const style = usePokerViewport(desktop);
  const [dialog, setDialog] = useState<"rules" | "history" | "stats" | "credits" | "reset" | null>(null);
  const prior = useRef(state);
  const hand = state.hand, pending = !!hand && !hand.result, result = hand?.result;
  const resultVisible = !!result && !animation;
  const bets = hand?.bets ?? state.bets;
  const ledger = animation && result ? prior.current : state;
  function perform(action: (s: ThreeState) => ThreeState, kind?: "deal" | "reveal") {
    if (locked.current) return;
    const before = current.current;
    const next = commit(action);
    if (!next) return;
    prior.current = before;
    if (kind) run(kind, kind === "deal" ? 6 : 3, readDisplaySettings().speed === "fast" ? 300 : 600);
  }
  const playerVisible = animation?.kind === "deal" ? Math.ceil(animation.visible / 2) : hand ? 3 : 0;
  const dealerVisible = animation?.kind === "deal" ? Math.floor(animation.visible / 2) : hand ? 3 : 0;
  const title = animation ? animation.kind === "deal" ? "正在发牌" : "正在开牌" : resultVisible ? outcomeLabels[result!.outcome] : pending ? "跟注还是弃牌？" : "请下注";
  return <main className={`sands-surface poker-game three-game ${desktop ? "is-desktop" : "is-mobile"}`} style={style} data-phase={animation ? "animating" : !hand ? "betting" : pending ? "decision" : "settled"}>
    <PokerHeader title="三张牌扑克" onLobby={onLobby} onSettings={onSettings} onRules={() => setDialog("rules")} />
    <div className="poker-workspace"><section className="three-table" aria-label="三张牌扑克桌面">
      <section className="three-hand dealer" aria-label="庄家牌面"><h2>庄家</h2><div className="poker-cards">{Array.from({ length: 3 }, (_, i) => <PokerCards key={i} cards={hand ? [hand.dealer[i]] : []} hand={state.roundId} slots={1} visible={i < dealerVisible ? 1 : 0} hidden={!result || animation?.kind === "reveal" && i >= animation.visible} />)}</div><small>{resultVisible ? `${evaluateThreeCard(hand!.dealer).label} · ${result!.qualifies ? "合格" : "不合格"}` : "Q高牌或以上合格"}</small></section>
      <div className="three-outcome" role="status"><strong>{title}{resultVisible && <span className={result!.profit < 0 ? "lose" : "win"}> {signed(result!.profit)}</span>}</strong><small>{resultVisible ? `投入 ${format(result!.wagered)} · 赢回 ${format(result!.returned)}${result!.bonus ? ` · 底注奖 ${format(result!.bonus)}` : ""}` : pending ? `继续需跟注 ${format(bets.ante)}` : "单副牌 · 每局重新洗牌"}</small></div>
      <section className="three-hand player" aria-label="你的牌面"><h2>你的手牌</h2><PokerCards cards={hand?.player ?? []} hand={state.roundId} slots={3} visible={playerVisible} /><small>{hand && playerVisible === 3 ? evaluateThreeCard(hand.player).label : "底注必选 · 对子奖可选"}</small></section>
      <div className="three-bets" role="group" aria-label="三张牌下注区">{([ ["ante", "底注", "ANTE"], ["pairPlus", "对子奖", "PAIR PLUS"] ] as const).map(([id, label, english]) => <button type="button" key={id} data-three-bet={id} className={`three-bet${bets[id] ? " has-bet" : ""}`} disabled={!!hand || !!animation} aria-label={`${label}下注`} onClick={() => {
        if (locked.current) return;
        commit(s => {
          const next = placeThreeBet(s, id);
          if (next === s) setNotice("筹码不足或超过上限，请为等额跟注预留筹码");
          return next;
        });
      }}><strong>{label}</strong><small>{english}</small><b>{format(bets[id])}</b></button>)}
        <div className={`three-bet${result && result.outcome !== "fold" ? " has-bet" : ""}`}><strong>跟注</strong><small>PLAY · 等额</small><b>{result && result.outcome !== "fold" ? format(bets.ante) : "—"}</b></div>
      </div>
    </section><aside className="poker-sidebar"><h2>玩法与赔率</h2><p>底注和跟注净赢 1:1</p><Paytable /><p>顺子大于同花。对子奖只看你的牌型，底注奖无需另押筹码。</p><p>下注时预留等额跟注筹码，看到手牌后再决定是否继续。</p></aside></div>
    <section className="poker-controls" aria-label="三张牌操作"><div className="poker-turn">{!hand ? `最低20 · 预留跟注 ${format(state.bets.ante)} · 每局上限100,000` : pending ? "继续跟注与底注等额；弃牌失去底注和对子奖" : "下一局可重复上轮下注"}</div>
      <div className="three-controls-row"><div className="poker-chips" role="group" aria-label="选择筹码">{threeCardChips.map(n => <button type="button" key={n} className={`bj-chip${state.selected === n ? " selected" : ""}`} style={{ "--chip-color": chipColor(n) } as CSSProperties} disabled={!!hand || !!animation} aria-label={`${n} 筹码`} aria-pressed={state.selected === n} onClick={() => perform(s => ({ ...s, selected: n }))}><span>{n}</span></button>)}</div>
        <div className="three-tools"><button type="button" className="sands-icon" aria-label="撤销下注" title="撤销下注" disabled={!!hand || !!animation || !state.undo.length} onClick={() => perform(undoThreeBet)}><Undo2 size={21} /></button><button type="button" className="sands-icon" aria-label="清空下注" title="清空下注" disabled={!!hand || !!animation || !threeCardReserve(state.bets)} onClick={() => perform(clearThreeBets)}><Trash2 size={21} /></button><button type="button" className="sands-icon" aria-label="重复上轮下注" title="重复上轮下注" disabled={!!hand || !!animation || !state.lastBets.ante || threeCardReserve(state.lastBets) > state.balance} onClick={() => perform(repeatThreeBets)}><RotateCcw size={21} /></button></div>
        <div className="three-decisions">{!hand ? <button type="button" className="sands-button primary" disabled={!!animation || !state.bets.ante || threeCardReserve(state.bets) > state.balance} onClick={() => perform(dealThreeCard, "deal")}>发牌</button>
          : pending ? <><button type="button" className="sands-button" disabled={!!animation} onClick={() => perform(s => decideThreeCard(s, false), "reveal")}>弃牌</button><button type="button" className="sands-button primary" disabled={!!animation} onClick={() => perform(s => decideThreeCard(s, true), "reveal")}>跟注 {format(bets.ante)}</button></>
          : <button type="button" className="sands-button primary" disabled={!!animation} onClick={() => perform(nextThreeCard)}>下一局</button>}</div>
      </div>
    </section>
    <PokerFooter balance={ledger.balance - (!ledger.hand ? ledger.bets.ante + ledger.bets.pairPlus : 0)} rounds={ledger.stats.rounds} profit={ledger.stats.profit} disabled={pending || !!animation} onCredits={() => setDialog("credits")} onHistory={() => setDialog("history")} onStats={() => setDialog("stats")} onReset={() => setDialog("reset")} />
    {notice && <div className="poker-notice" role="alert">{notice}</div>}
    {dialog && <SandsDialog title={{ rules: "三张牌扑克 · 玩法", history: "三张牌扑克 · 历史", stats: "三张牌扑克 · 统计", credits: "补充虚拟筹码", reset: "重置统计" }[dialog]} onClose={() => setDialog(null)}><div className="poker-report">
      {dialog === "rules" && <><p>每局使用重新洗过的52张牌，你和庄家各三张。先押底注，可选押对子奖；看到手牌后，跟注与底注等额，或弃牌。弃牌失去底注、对子奖，也没有底注奖。</p><p>庄家Q高牌或以上合格。不合格时底注净赢1倍，跟注退回；合格时比牌，你赢则底注、跟注各净赢1倍，平手都退回，输则都失去。</p><p>牌型从大到小：同花顺、三条、顺子、同花、一对、高牌。A23是最小顺子，QKA是最大顺子，花色不分大小。跟注后，底注奖和对子奖按你的牌型独立结算，即使输给庄家也会支付。</p><Paytable /><p>表内为净赢倍数，赢回另含本金。最低20；包含预留跟注的总额不超过100,000。每局下注时预留跟注金额，避免发牌后筹码不足。</p><p><a href="https://www.pokerstars.com/casino/how-to-play/live/three-card-poker/rules/" target="_blank" rel="noreferrer">三张牌扑克规则参考</a></p></>}
      {dialog === "history" && <>{!state.history.length && <p>暂无记录</p>}{state.history.map(r => <details key={r.id}><summary><span>第 {r.id} 局 · {outcomeLabels[r.result!.outcome]}</span><strong className={r.result!.profit < 0 ? "lose" : "win"}>{signed(r.result!.profit)}</strong></summary><p>你 · {evaluateThreeCard(r.player).label}</p><PokerCards cards={r.player} hand={r.id} className="history-cards" /><p>庄家 · {evaluateThreeCard(r.dealer).label}</p><PokerCards cards={r.dealer} hand={r.id} className="history-cards" /><p>底注 {format(r.bets.ante)} · 对子奖投注 {format(r.bets.pairPlus)} · 总投入 {format(r.result!.wagered)} · 赢回 {format(r.result!.returned)} · 底注奖 {format(r.result!.bonus)}</p></details>)}</>}
      {dialog === "stats" && <dl>{[["已玩局数", state.stats.rounds], ["盈利局数", state.stats.wins], ["累计投入", state.stats.wagered], ["累计赢回", state.stats.returned], ["累计赢利", state.stats.profit]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{format(Number(value))}</dd></div>)}</dl>}
      {(dialog === "credits" || dialog === "reset") && <><p>{dialog === "credits" ? "补充10,000虚拟筹码，不计入赢利。" : "清零统计与历史，保留当前筹码、投注和已完成的牌局。"}</p><footer className="sands-modal-actions"><button type="button" className="sands-button" onClick={() => setDialog(null)}>取消</button><button type="button" className="sands-button primary" disabled={pending || !!animation} onClick={() => { perform(dialog === "credits" ? s => ({ ...s, balance: Math.min(1e12, s.balance + 10000) }) : resetThreeStats); setDialog(null); }}>确认</button></footer></>}
    </div></SandsDialog>}
  </main>;
}
