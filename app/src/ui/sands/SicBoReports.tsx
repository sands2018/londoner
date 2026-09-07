import { useId, useState } from "react";
import { diceTotal, dieValues, getSicBoBetMap, isTriple, sicBoCategories, sicBoPayout, sicBoRules, type SicBoDistribution, type SicBoMinimum, type SicBoRound, type SicBoRule } from "../../core/sicBo";
import { DiceFace } from "./DiceFace";

const format = (n: number) => n.toLocaleString("zh-CN");
const signed = (n: number) => `${n > 0 ? "+" : ""}${format(n)}`;
const percent = (n: number, total: number) => total ? `${(n / total * 100).toFixed(1)}%` : "—";

export function SicBoRulesReport({ rule, minimum }: { rule: SicBoRule; minimum: SicBoMinimum }) {
  const p = sicBoRules[rule];
  return <div className="sic-rules-copy"><p>{p.label}赔率{rule === "macau" ? "（采用较低档）" : "（昆士兰版本）"}。三颗独立六面骰，每轮重新摇骰。大小单双每格最低 {minimum}，其余每格最低 {minimum === 20 ? 10 : 100}；每轮合计最多 100,000。所有筹码均为虚拟筹码。</p>
    <table className="sic-rules-table"><tbody>{[
      ["大 / 小 / 单 / 双（本桌围骰全输）", "1:1"], ["指定围骰 / 任意围骰", `${p.triple}:1 / ${p.anyTriple}:1`],
      ["指定对子（含该点数围骰）", `${p.double}:1`], ["两个不同点数组合", `${p.pair}:1`],
      ["单骰出现 1 / 2 / 3 次", `1:1 / 2:1 / ${p.singleTriple}:1`],
      ["4或17 / 5或16 / 6或15", `${p.totals[0]}:1 / ${p.totals[1]}:1 / ${p.totals[2]}:1`],
      ["7或14 / 8或13 / 9或12 / 10或11", `${p.totals[3]}:1 / ${p.totals[4]}:1 / ${p.totals[5]}:1 / ${p.totals[6]}:1`],
    ].map(([label, odds]) => <tr key={label}><td>{label}</td><td>{odds}</td></tr>)}</tbody></table>
    <p>小为总点数 4—10，大为 11—17；三个骰子相同为围骰。围骰时，本桌大小单双不赔；总点数投注仍按实际点数结算。赔率表示净赢，赢回金额包含本金。重复上轮会替换当前投注，可用撤销恢复。</p>
    <p><a href={p.url} target="_blank" rel="noreferrer">赔率依据 · {p.label}骰宝规则</a></p>
  </div>;
}

export function SicBoHistoryReport({ history }: { history: SicBoRound[] }) {
  return <><div className="sic-history-head"><span>轮次</span><span>骰子</span><span>投注</span><span>赢利</span></div><div className="sic-history-scroll">{history.length ? history.map(r => <details key={r.id} className="sic-history-row">
    <summary><span>{r.id}</span><span className="sic-history-dice" aria-label={r.dice.join("、")}>{r.dice.map((n, i) => <DiceFace key={i} value={n} />)}</span><span>{format(r.wagered)}</span><strong>{signed(r.profit)}</strong></summary>
    <p className="sic-history-rule">{sicBoRules[r.rule].label}赔率</p><div className="sic-history-bets"><span>下注项</span><span>投注</span><span>赢回</span>{Object.entries(r.bets).map(([id, amount]) => {
      const bet = getSicBoBetMap(r.rule).get(id)!;
      return <div className="sic-history-bet" key={id}><span>{bet.label}</span><span>{format(amount)}</span><span>{format(amount * (sicBoPayout(bet, r.dice) + 1))}</span></div>;
    })}<b>合计</b><b>{format(r.wagered)}</b><b>{format(r.returned)}</b></div>
  </details>) : <p className="sic-history-empty">暂无已结算牌局</p>}</div></>;
}

export function SicBoRecentReport({ history }: { history: SicBoRound[] }) {
  return history.length ? <ol className="sic-recent-list" aria-label="最近10轮，最新在前">{history.slice(0, 10).map((r, index) => {
    const outcome = isTriple(r.dice) ? "triple" : diceTotal(r.dice) >= 11 ? "big" : "small";
    const label = outcome === "triple" ? "围骰" : outcome === "big" ? "大" : "小";
    const sortedDice = [...r.dice].sort((a, b) => a - b);
    return <li key={r.id} className={`sic-outcome-${outcome}${index === 0 ? " is-latest" : ""}`} aria-label={`第${r.id}轮，${sortedDice.join("、")}，${label}${index === 0 ? "，最新" : ""}`}>{sortedDice.map((n, i) => <span key={i}>{n}</span>)}<b>{label}</b></li>;
  })}</ol> : <p className="sic-history-empty">暂无已结算牌局</p>;
}

const statsTabs = [["categories", "大小单双"], ["faces", "骰面号码"], ["totals", "总点数"], ["triples", "围骰"]] as const;
type StatsTab = typeof statsTabs[number][0];
export function SicBoStatsReport({ data }: { data: SicBoDistribution }) {
  const [tab, setTab] = useState<StatsTab>("categories");
  const id = useId();
  const categories = sicBoCategories(data);
  const rows = [["大", categories.big], ["小", categories.small], ["单", categories.odd], ["双", categories.even], ["围骰", categories.triple]] as const;
  return <div className="sic-distribution">
    <p className="sic-stats-scope">统计样本 {format(data.samples)} 轮 · 自重置起累计</p>
    <div className="sic-stats-tabs" role="tablist" aria-label="统计分类">{statsTabs.map(([value, label], index) => <button key={value} type="button" role="tab" id={`${id}-${value}-tab`} aria-controls={`${id}-${value}-panel`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={event => {
      const next = event.key === "ArrowRight" ? (index + 1) % statsTabs.length : event.key === "ArrowLeft" ? (index + statsTabs.length - 1) % statsTabs.length : event.key === "Home" ? 0 : event.key === "End" ? statsTabs.length - 1 : null;
      if (next === null) return;
      event.preventDefault(); setTab(statsTabs[next][0]);
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
    }}>{label}</button>)}</div>
    {statsTabs.map(([value]) => <div key={value} className="sic-stats-panel" role="tabpanel" id={`${id}-${value}-panel`} aria-labelledby={`${id}-${value}-tab`} hidden={tab !== value} tabIndex={0}>
      {value === "categories" && <><table className="sic-report-table"><thead><tr><th>结果</th><th>轮数</th><th>占全部轮次</th></tr></thead><tbody>{rows.map(([name, n]) => <tr key={name}><td>{name}</td><td>{format(n)}</td><td><span className="sic-percentage"><span style={{ width: data.samples ? `${n / data.samples * 100}%` : "0%" }} /><b>{percent(n, data.samples)}</b></span></td></tr>)}</tbody></table><p className="sic-stats-scope">围骰单独计数，大小单双均不含围骰。旧版本仅恢复保留记录内的样本。</p></>}
      {value === "faces" && <table className="sic-report-table"><thead><tr><th>号码</th><th>出现次数</th><th>占全部骰子</th><th>出现轮数 / 比例</th></tr></thead><tbody>{dieValues.map((n, i) => <tr key={n}><td>{n}</td><td>{format(data.faces[i])}</td><td>{percent(data.faces[i], data.samples * 3)}</td><td>{format(data.faceRounds[i])} / {percent(data.faceRounds[i], data.samples)}</td></tr>)}</tbody></table>}
      {value === "totals" && <div className="sic-total-distribution">{[0, 8].map(start => <div className="sic-total-column" key={start}>{data.totals.slice(start, start + 8).map((n, i) => <div className="sic-total-row" key={i} title={`${i + start + 3}点：${format(n)}次 / ${format(data.samples)}轮`} aria-label={`${i + start + 3}点，${format(n)}次，${percent(n, data.samples)}`}><strong>{i + start + 3}</strong><span className="sic-percentage"><span style={{ width: data.samples ? `${n / data.samples * 100}%` : "0%" }} /><b>{percent(n, data.samples)}</b></span></div>)}</div>)}</div>}
      {value === "triples" && <table className="sic-report-table"><thead><tr><th>围骰</th><th>轮数</th><th>占全部轮次</th></tr></thead><tbody>{data.triples.map((n, i) => <tr key={i}><td>{String(i + 1).repeat(3)}</td><td>{format(n)}</td><td>{percent(n, data.samples)}</td></tr>)}</tbody></table>}
    </div>)}
  </div>;
}
