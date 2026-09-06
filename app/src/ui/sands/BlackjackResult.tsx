import { ArrowDownRight, Equal, RotateCcw, Trophy } from "lucide-react";
import type { BlackjackRound } from "../../core/blackjack";

const format = (value: number) => value.toLocaleString("zh-CN", { maximumFractionDigits: 1 });

export function BlackjackResult({ round, animated }: { round: BlackjackRound; animated: boolean }) {
  const outcome = round.voided ? "void" : round.profit > 0 ? "win" : round.profit < 0 ? "lose" : "push";
  const Icon = outcome === "win" ? Trophy : outcome === "lose" ? ArrowDownRight : outcome === "void" ? RotateCcw : Equal;
  const title = outcome === "win" ? "本轮获胜" : outcome === "lose" ? "本轮亏损" : outcome === "void" ? "本轮退回" : "本轮和局";
  const amount = `${round.profit > 0 ? "+" : ""}${format(round.profit)}`;
  return <div className={`bj-result is-${outcome}${animated ? " is-revealing" : ""}${amount.length > 6 ? " is-large-amount" : ""}`}>
    <div className="bj-result-main"><Icon aria-hidden="true" /><div className="bj-result-heading"><span>{title}</span><strong>{amount}</strong></div></div>
    <div className="bj-result-details"><span>投注 <b>{format(round.wagered)}</b></span><i /><span>赢回 <b>{format(round.returned)}</b></span></div>
  </div>;
}
