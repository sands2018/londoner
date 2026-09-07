import { useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { baccaratBetIds, baccaratLabels, baccaratOdds, baccaratPoints, baccaratReturn, baccaratRoad, type BaccaratRound, type BaccaratStats } from "../../core/baccarat";

export const baccaratFormat = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 1 });
export const baccaratSigned = (n: number) => `${n > 0 ? "+" : ""}${baccaratFormat(n)}`;

export function BaccaratRoad({ rounds, compact = false, active = true }: { rounds: BaccaratRound[]; compact?: boolean; active?: boolean }) {
  const [kind, setKind] = useState<"beads" | "big">("beads");
  const uid = useId();
  const columns = compact ? 8 : 18;
  const cells = baccaratRoad(rounds, kind, columns);
  const panel = useRef<HTMLDivElement>(null);
  const latest = useRef<HTMLSpanElement>(null);
  const lastScrolled = useRef("");
  const revision = `${kind}:${rounds.at(-1)?.shoeNumber ?? 0}:${rounds.at(-1)?.id ?? 0}:${rounds.length}`;
  useLayoutEffect(() => {
    const viewport = panel.current;
    if (!active || !viewport) return;
    const followLatest = () => {
      if (!viewport.clientWidth || lastScrolled.current === revision) return;
      lastScrolled.current = revision;
      if (!latest.current) { viewport.scrollLeft = 0; return; }
      // Measure in layout pixels, including when desktop mode scales the whole game.
      // Reveal only the newest cell; a dragon tail can extend to its right.
      const bounds = viewport.getBoundingClientRect();
      const cell = latest.current.getBoundingClientRect();
      const scale = bounds.width / viewport.offsetWidth;
      const left = (cell.left - bounds.left) / scale - 3;
      const right = (cell.right - bounds.left) / scale + 3;
      if (right > viewport.clientWidth) viewport.scrollLeft += right - viewport.clientWidth;
      else if (left < 0) viewport.scrollLeft += left;
    };
    followLatest();
    // A dialog starts closed. Retry once it has a viewport; later resize events
    // do nothing after this revision was followed, preserving manual scrolling.
    const observer = new ResizeObserver(followLatest);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [active, revision]);
  return <section className="bac-road">
    <div className="bac-road-tabs" role="tablist" aria-label="路单类型">{([ ["beads", "珠盘路"], ["big", "大路"] ] as const).map(([value, label]) => <button key={value} type="button" id={`${uid}-${value}`} role="tab" aria-selected={kind === value} aria-controls={`${uid}-panel`} tabIndex={kind === value ? 0 : -1} onClick={() => setKind(value)} onKeyDown={e => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
      e.preventDefault(); const next = e.key === "Home" ? "beads" : e.key === "End" ? "big" : kind === "beads" ? "big" : "beads";
      setKind(next); document.getElementById(`${uid}-${next}`)?.focus();
    }}>{label}</button>)}</div>
    <div ref={panel} role="tabpanel" id={`${uid}-panel`} aria-labelledby={`${uid}-${kind}`} className="bac-road-panel">
      <div className={`bac-road-grid ${kind}`} style={{ "--road-columns": Math.max(columns, ...cells.map(c => c.column + 1)) } as CSSProperties} aria-label={`${kind === "beads" ? "珠盘路" : "大路"}，本靴共${rounds.length}局`}>
        {cells.map((c, i) => <span ref={i === cells.length - 1 ? latest : undefined} className={`bac-road-mark ${c.outcome ?? "tie"}`} key={`${c.column}-${c.row}-${i}`} style={{ gridColumn: c.column + 1, gridRow: c.row + 1 }} aria-label={`${c.outcome ? baccaratLabels[c.outcome] : "和"}${c.ties ? `，${c.ties}次和局` : ""}${c.playerPair ? "，闲对" : ""}${c.bankerPair ? "，庄对" : ""}`}>
          <b>{kind === "beads" ? c.outcome && baccaratLabels[c.outcome] : c.ties || ""}</b>{c.playerPair && <i className="player-pair" />}{c.bankerPair && <i className="banker-pair" />}
        </span>)}
      </div>
    </div>
    <div className="bac-road-counts"><span className="player">闲 {rounds.filter(r => r.outcome === "player").length}</span><span className="banker">庄 {rounds.filter(r => r.outcome === "banker").length}</span><span className="tie">和 {rounds.filter(r => r.outcome === "tie").length}</span></div>
  </section>;
}

export function BaccaratHistory({ history }: { history: BaccaratRound[] }) {
  if (!history.length) return <p className="bac-empty">暂无结算记录</p>;
  return <div className="bac-history"><div className="bac-history-head"><span>轮次</span><span>结果</span><span>投注</span><span>赢利</span></div>{history.map(r => <details key={r.id}>
    <summary><span>{r.id}</span><span className={r.outcome}>{baccaratLabels[r.outcome]} {baccaratPoints(r.player)}:{baccaratPoints(r.banker)}</span><span>{baccaratFormat(r.wagered)}</span><strong className={r.profit < 0 ? "lose" : "win"}>{baccaratSigned(r.profit)}</strong></summary>
    <div className="bac-history-bets">{baccaratBetIds.filter(id => r.bets[id]).map(id => <div key={id}><span>{baccaratLabels[id]}</span><span>投注 {baccaratFormat(r.bets[id]!)}</span><span>赢回 {baccaratFormat(baccaratReturn(id, r.bets[id]!, r))}</span></div>)}<p>牌靴 {r.shoeNumber} · 佣金 {baccaratFormat(r.commission)} · 赢回含本金</p></div>
  </details>)}</div>;
}
export function BaccaratStatsReport({ stats: s }: { stats: BaccaratStats }) {
  const rows = [["player", "闲赢"], ["banker", "庄赢"], ["tie", "和局"], ["playerPair", "闲对"], ["bankerPair", "庄对"]] as const;
  return <div className="bac-stats-report"><p>重置以来 · {s.rounds} 局</p><table><thead><tr><th>结果</th><th>次数</th><th>占比</th></tr></thead><tbody>{rows.map(([key, label]) => <tr key={key}><td>{label}</td><td>{s[key]}</td><td><span className="bac-percent"><i style={{ width: `${s.rounds ? s[key] / s.rounds * 100 : 0}%` }} /><b>{s.rounds ? `${(s[key] / s.rounds * 100).toFixed(1)}%` : "—"}</b></span></td></tr>)}</tbody></table><dl><div><dt>累计投注</dt><dd>{baccaratFormat(s.wagered)}</dd></div><div><dt>累计赢回</dt><dd>{baccaratFormat(s.returned)}</dd></div><div><dt>已扣佣金</dt><dd>{baccaratFormat(s.commission)}</dd></div><div><dt>累计赢利</dt><dd>{baccaratSigned(s.profit)}</dd></div></dl></div>;
}
export function BaccaratRules() {
  return <div className="bac-rules"><p>八副牌，共416张。每靴洗牌后销去8张，切牌位在末尾16张；遇切牌位时完成当前局，下一局换靴。牌靴连续使用，不会每局重新洗牌。</p>
    <p>A为1点，10／J／Q／K为0点，其余按牌面，合计取个位数。先闲后庄交替各发两张；任一方首两张为8或9点，双方均不补牌。</p>
    <p>闲0至5点补牌，6或7点停牌。闲停牌时，庄0至5点补牌；闲补牌时，庄按下表自动补牌。</p>
    <table><thead><tr><th>庄首两张点数</th><th>闲第三张点数满足以下条件时补牌</th></tr></thead><tbody>{[["0–2", "任何点数"], ["3", "除8点外"], ["4", "2–7"], ["5", "4–7"], ["6", "6或7"], ["7", "不补牌"]].map(([a,b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody></table>
    <table><thead><tr><th>投注</th><th>净赢赔率</th></tr></thead><tbody>{baccaratBetIds.map(id => <tr key={id}><td>{baccaratLabels[id]}</td><td>{baccaratOdds[id]}</td></tr>)}</tbody></table>
    <p>庄赢扣5%佣金，已计入0.95:1赔率；和局时庄、闲投注退回本金，对子独立结算。对子只看首两张的牌面等级，J和Q不算对子。每格最低20，每轮最高100,000。</p>
    <p>本桌采用经典佣金制，不是“庄6点赢赔一半”的免佣玩法。所有筹码均为虚拟筹码。<a href="https://www.dicj.gov.mo/web/cn/rules/Bacara.html" target="_blank" rel="noreferrer">澳门博彩监察协调局规则</a></p>
  </div>;
}
