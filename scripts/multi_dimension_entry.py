"""
Multi-Dimensional Entry/Exit Signal Analysis
=============================================
User's framework:
1. P&L trajectory per skip level (rolling window, trend direction)
2. Deviation (偏离值): where are hits landing recently?
3. Concentration (集中度): how tightly clustered are the hits?
4. Cross-skip competition: which skip is "winning" right now?
5. Exit signals: first loss, preemptive, trend-following

All computed in a rolling window, simulating real-time knowledge.

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json
from collections import defaultdict
from statistics import mean, stdev, variance as pvar
from typing import Optional, List, Dict
import math

def load_sessions(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    sessions = []
    for entry in data:
        name = entry.get("Name", "?")
        nums_str = entry.get("Numbers", "")
        nums = [int(x.strip()) for x in nums_str.split(",") if x.strip()] if isinstance(nums_str, str) else nums_str
        if nums:
            sessions.append({"name": name, "numbers": nums, "tms": entry.get("tms", 0)})
    sessions.sort(key=lambda s: s["tms"])
    return sessions

def get_row(n: int) -> Optional[int]:
    if n == 0: return None
    rem = n % 3
    if rem == 1: return 2
    if rem == 2: return 1
    return 0

def get_group(n: int) -> Optional[int]:
    if n == 0: return None
    return (n - 1) // 12


# ============================================================
# Real-time signal computer
# ============================================================

class SignalComputer:
    """
    Computes all entry/exit signals in real-time as we walk through spins.
    Maintains rolling windows of outcomes for each skip level.
    """

    def __init__(self, window_size=15):
        self.window = window_size

        # Per skip level: rolling P&L history
        # skip_outcomes[skip] = list of (spin, net_profit) for the last N bets
        self.skip_outcomes = {1: [], 2: [], 3: [], 4: []}

        # Gap sequence (for deviation/concentration)
        self.gaps = []

        # Current P&L trajectory
        self.skip_cum_pnl = {1: 0, 2: 0, 3: 0, 4: 0}

        # Signal history
        self.signal_log = []

    def record_outcome(self, skip, net_profit, spin_idx):
        """Record a bet outcome for a given skip level."""
        self.skip_outcomes[skip].append((spin_idx, net_profit))
        # Keep only last `window` outcomes
        if len(self.skip_outcomes[skip]) > self.window:
            self.skip_outcomes[skip] = self.skip_outcomes[skip][-self.window:]
        self.skip_cum_pnl[skip] += net_profit

    def record_gap(self, gap):
        self.gaps.append(gap)

    # ---- Signal 1: P&L Trajectory ----
    def pnl_trajectory(self, skip, sub_window=5):
        """
        Returns the P&L trend for a given skip level.
        Compares recent P&L vs earlier P&L within the rolling window.
        Returns: (recent_avg, earlier_avg, trend_direction, improving: bool)
        """
        outcomes = self.skip_outcomes[skip]
        if len(outcomes) < sub_window * 2:
            return None

        recent = [o[1] for o in outcomes[-sub_window:]]
        earlier = [o[1] for o in outcomes[-sub_window*2:-sub_window]]

        recent_avg = mean(recent)
        earlier_avg = mean(earlier)
        trend = recent_avg - earlier_avg
        improving = trend > 0

        return {
            "recent_avg": recent_avg,
            "earlier_avg": earlier_avg,
            "trend": trend,
            "improving": improving,
            "slope": trend / abs(earlier_avg) if earlier_avg != 0 else 0,
        }

    # ---- Signal 2: Deviation (偏离值) ----
    def deviation(self, n_gaps=12):
        """
        Where are the recent gaps landing?
        Returns: mean gap of last N gaps.
        Higher mean = hits are deviating to later rounds.
        """
        if len(self.gaps) < n_gaps:
            return None
        recent = self.gaps[-n_gaps:]
        return {
            "mean": mean(recent),
            "median": sorted(recent)[len(recent)//2],
            "min": min(recent),
            "max": max(recent),
        }

    # ---- Signal 3: Concentration (集中度) ----
    def concentration(self, n_gaps=12):
        """
        How tightly are the recent gaps clustered?
        Returns: variance, and % of gaps within +/-1 of the mode.
        Low variance + high cluster% = concentrated = good for betting.
        """
        if len(self.gaps) < n_gaps:
            return None
        recent = self.gaps[-n_gaps:]
        var = pvar(recent) if len(recent) >= 3 else 0
        std = math.sqrt(var)

        # Find the mode (most common gap value or range)
        from collections import Counter
        counts = Counter(recent)
        mode_val = counts.most_common(1)[0][0]

        # % of gaps within +/-1 of mode
        near_mode = sum(1 for g in recent if abs(g - mode_val) <= 1)
        concentration_pct = near_mode / len(recent)

        return {
            "variance": var,
            "std": std,
            "mode": mode_val,
            "concentration_pct": concentration_pct,
            "is_concentrated": concentration_pct > 0.55,
        }

    # ---- Signal 4: Cross-skip competition ----
    def cross_skip_competition(self, sub_window=8):
        """
        Compare P&L trends across skip levels.
        Which skip is "winning" right now?
        Returns ranking of skips by recent P&L performance.
        """
        scores = {}
        for skip in [1, 2, 3, 4]:
            outcomes = self.skip_outcomes[skip]
            if len(outcomes) < sub_window:
                scores[skip] = None
                continue
            recent = [o[1] for o in outcomes[-sub_window:]]
            scores[skip] = {
                "total_pnl": sum(recent),
                "avg_pnl": mean(recent),
                "win_rate": sum(1 for p in recent if p > 0) / len(recent),
            }

        # Rank by total P&L
        ranked = sorted(
            [(s, d) for s, d in scores.items() if d is not None],
            key=lambda x: x[1]["total_pnl"], reverse=True
        )

        # Is skip=2 improving relative to others?
        skip2_rank = next((i for i, (s, _) in enumerate(ranked) if s == 2), None)

        return {
            "ranked": ranked,
            "skip2_rank": skip2_rank,
            "skip2_winning": skip2_rank == 0,
            "skip2_behind": skip2_rank is not None and skip2_rank >= 2,
        }

    # ---- Composite Entry Signal ----
    def compute_entry_signal(self):
        """
        Combines all signals into a single entry score (0-100).
        High score = favorable entry conditions for skip=2.

        Components:
        - P&L improvement for skip=2 (0-30 points)
        - Skip=2 gaining on skip=1/3 (0-25 points)
        - Deviation in favorable range (gap mean 2-4) (0-20 points)
        - High concentration (0-15 points)
        - Not overheated (0-10 points)
        """
        score = 0
        details = {}

        # 1. Skip=2 P&L trajectory (30 pts)
        traj = self.pnl_trajectory(2, sub_window=5)
        if traj:
            # Improving from negative → high score
            if traj["improving"] and traj["earlier_avg"] < 0:
                score += 30  # Strong turnaround
                details["pnl"] = "strong_turnaround"
            elif traj["improving"]:
                score += 20  # Already positive, still improving
                details["pnl"] = "improving_positive"
            elif traj["recent_avg"] > traj["earlier_avg"]:
                score += 10  # Slight improvement
                details["pnl"] = "slight_improvement"
            else:
                score += 0  # Declining
                details["pnl"] = "declining"
        else:
            details["pnl"] = "insufficient_data"

        # 2. Cross-skip: skip=2 gaining on others (25 pts)
        comp = self.cross_skip_competition(sub_window=8)
        if comp and comp["skip2_rank"] is not None:
            if comp["skip2_winning"]:
                score += 25
                details["cross"] = "skip2_leading"
            elif comp["skip2_rank"] == 1:
                # Check if gaining on #1
                score += 15
                details["cross"] = "skip2_second"
            elif comp["skip2_behind"]:
                score += 0
                details["cross"] = "skip2_behind"
            else:
                score += 5
                details["cross"] = "neutral"
        else:
            details["cross"] = "insufficient_data"

        # 3. Deviation in range (20 pts)
        dev = self.deviation(n_gaps=10)
        if dev:
            m = dev["mean"]
            if 2.0 <= m <= 3.5:
                score += 20  # Sweet spot
                details["deviation"] = f"optimal({m:.1f})"
            elif 1.5 <= m <= 4.0:
                score += 10
                details["deviation"] = f"acceptable({m:.1f})"
            else:
                score += 0
                details["deviation"] = f"poor({m:.1f})"
        else:
            details["deviation"] = "insufficient_data"

        # 4. Concentration (15 pts)
        conc = self.concentration(n_gaps=10)
        if conc:
            if conc["concentration_pct"] > 0.65:
                score += 15
                details["concentration"] = f"tight({conc['concentration_pct']:.0%})"
            elif conc["concentration_pct"] > 0.50:
                score += 8
                details["concentration"] = f"moderate({conc['concentration_pct']:.0%})"
            else:
                score += 0
                details["concentration"] = f"spread({conc['concentration_pct']:.0%})"
        else:
            details["concentration"] = "insufficient_data"

        # 5. Not overheated (10 pts)
        # Check if targetRate (gap 2-4) isn't too high
        if len(self.gaps) >= 18:
            r18 = self.gaps[-18:]
            tr = sum(1 for g in r18 if 2 <= g <= 4) / 18
            if tr <= 0.40:
                score += 10
                details["overheat"] = f"cool({tr:.0%})"
            elif tr <= 0.50:
                score += 5
                details["overheat"] = f"warm({tr:.0%})"
            else:
                score += 0
                details["overheat"] = f"hot({tr:.0%})"

        details["total_score"] = score
        return score, details


# ============================================================
# Backtest with signal-based entry
# ============================================================

def run_signal_backtest(sessions, mapper, target_id, entity_label,
                         min_score=40, exit_rule="first_loss",
                         preempt_rounds=0):
    """
    Entry: only when composite score >= min_score.
    Exit:
      - "first_loss": stop after first losing bet
      - "preempt_N": exit after N rounds even if winning
      - "trend": exit when skip=2 P&L starts declining
    """
    computer = SignalComputer(window_size=15)
    signals = []
    entry_log = []

    # Warmup: simulate first 50 spins to build signal history
    # Then start making decisions

    for sess in sessions:
        nums = sess["numbers"]
        prev_hit = -1
        nz_idx = 0

        # Active bets
        in_bet = False
        bet_round = 0
        entry_score_at_entry = 0
        entry_details_at_entry = {}
        consec_wins = 0
        wins_this_bet_sequence = 0

        for si, n in enumerate(nums):
            if n == 0:
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3 or (preempt_rounds > 0 and bet_round >= preempt_rounds):
                        signals.append({"won": False, "net": -(1+2+4), "session": sess["name"],
                                       "score": entry_score_at_entry})
                        consec_wins = 0
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            # Resolve active bet
            if in_bet:
                if is_target:
                    net = 2 if bet_round == 0 else (3 if bet_round == 1 else 5)
                    signals.append({"won": True, "net": net, "session": sess["name"],
                                   "score": entry_score_at_entry})
                    consec_wins += 1
                    wins_this_bet_sequence += 1
                    in_bet = False
                else:
                    bet_round += 1
                    should_exit = False

                    if bet_round >= 3:
                        should_exit = True
                    elif exit_rule == "preempt" and bet_round >= preempt_rounds:
                        should_exit = True

                    if should_exit:
                        signals.append({"won": False, "net": -(1+2+4), "session": sess["name"],
                                       "score": entry_score_at_entry})
                        # First loss exit
                        if exit_rule == "first_loss" or exit_rule == "preempt":
                            consec_wins = 0
                        in_bet = False

            # Update gaps and track
            if is_target:
                if prev_hit >= 0:
                    gap = nz_idx - prev_hit - 1
                    computer.record_gap(gap)
                prev_hit = nz_idx
            nz_idx += 1

            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

            # Record hypothetical outcomes for all skip levels
            # (We track what WOULD have happened at each skip level)
            # This is done implicitly through the bet resolution

            # Compute entry signal at this spin
            score, details = computer.compute_entry_signal()

            # Check if we should enter
            if not in_bet and cs == 2 and len(computer.gaps) >= 18:
                if score >= min_score:
                    in_bet = True
                    bet_round = 0
                    entry_score_at_entry = score
                    entry_details_at_entry = details
                    entry_log.append({
                        "session": sess["name"],
                        "spin": si,
                        "score": score,
                        "details": details,
                    })

    return signals, entry_log


def analyze_signals(signals, label, sessions):
    if not signals:
        print(f"  {label}: 0 signals")
        return None

    total_bet = len(signals) * 7
    total_net = sum(s["net"] for s in signals)
    roi = total_net / total_bet * 100
    wins = sum(1 for s in signals if s["won"])
    wr = wins / len(signals) * 100

    # Score-based breakdown
    score_bins = defaultdict(lambda: {"s": 0, "w": 0, "net": 0})
    for s in signals:
        sc = s.get("score", 0)
        bin_key = (sc // 10) * 10
        score_bins[bin_key]["s"] += 1
        if s["won"]:
            score_bins[bin_key]["w"] += 1
        score_bins[bin_key]["net"] += s["net"]

    # Per session
    sess_pnl = defaultdict(float)
    for s in signals:
        sess_pnl[s["session"]] += s["net"]
    pnls = list(sess_pnl.values())
    cum = 0; peak = 0; max_dd = 0
    for p in pnls:
        cum += p
        if cum > peak: peak = cum
        max_dd = max(max_dd, peak - cum)

    win_sess = sum(1 for p in pnls if p > 0)
    lose_sess = sum(1 for p in pnls if p < 0)

    # Recent 30
    recent30 = {s["name"] for s in sessions[-30:]}
    r30 = [s for s in signals if s["session"] in recent30]
    r30_bet = len(r30) * 7
    r30_net = sum(s["net"] for s in r30)
    r30_roi = r30_net / r30_bet * 100 if r30_bet > 0 else 0

    # Max consec losses
    max_cl = 0; curr = 0
    for s in signals:
        if not s["won"]:
            curr += 1
            max_cl = max(max_cl, curr)
        else:
            curr = 0

    print(f"  {label}")
    print(f"    sig={len(signals)} wr={wr:.1f}% ROI={roi:+.2f}% net={total_net:+.0f} "
          f"DD={max_dd:.0f} CL={max_cl} ws={win_sess} ls={lose_sess} r30={r30_roi:+.2f}%")

    # Score breakdown
    if score_bins:
        print(f"    Score bins:", end="")
        for sc in sorted(score_bins.keys()):
            sb = score_bins[sc]
            sr = sb["w"]/sb["s"]*100 if sb["s"] > 0 else 0
            print(f" [{sc}-{sc+9}]:{sb['s']}s/{sr:.0f}%", end="")
        print()

    return {"label": label, "signals": len(signals), "roi": roi, "net": total_net,
            "wr": wr, "max_dd": max_dd, "max_cl": max_cl, "r30_roi": r30_roi}


def test_exit_rules(sessions, mapper, target_id, entity_label, min_score=40):
    """Test different exit rules."""
    results = []

    for exit_rule in ["first_loss"]:
        sigs, _ = run_signal_backtest(sessions, mapper, target_id, entity_label,
                                       min_score=min_score, exit_rule=exit_rule)
        r = analyze_signals(sigs, f"exit={exit_rule}", sessions)
        if r: results.append(r)

    # Preemptive exit: stop after N rounds even when winning
    for preempt in [2]:
        sigs, _ = run_signal_backtest(sessions, mapper, target_id, entity_label,
                                       min_score=min_score, exit_rule="preempt",
                                       preempt_rounds=preempt)
        r = analyze_signals(sigs, f"exit=preempt_{preempt}r", sessions)
        if r: results.append(r)

    return results


# ============================================================
# Baseline comparison: fixed skip=2
# ============================================================

def run_baseline(sessions, mapper, target_id):
    signals = []
    for sess in sessions:
        nums = sess["numbers"]
        gaps = []
        prev_hit = -1
        nz_idx = 0
        in_bet = False
        bet_round = 0

        for si, n in enumerate(nums):
            if n == 0:
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        signals.append({"won": False, "net": -7, "score": 0, "session": sess["name"]})
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            if in_bet:
                if is_target:
                    net = 2 if bet_round == 0 else (3 if bet_round == 1 else 5)
                    signals.append({"won": True, "net": net, "score": 0, "session": sess["name"]})
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        signals.append({"won": False, "net": -7, "score": 0, "session": sess["name"]})
                        in_bet = False

            if is_target:
                if prev_hit >= 0:
                    gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1

            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx
            if not in_bet and cs == 2 and len(gaps) >= 12:
                in_bet = True
                bet_round = 0

    return signals


# ============================================================
# MAIN
# ============================================================

def main():
    path = "HistoryData/wzs-merged.json"
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    print(f"{len(sessions)} sessions")

    entities = [
        (get_row, 0, "1行"),
        (get_row, 2, "3行"),
        (get_group, 0, "一组"),
    ]

    all_results = []

    for mapper, target_id, elabel in entities:
        print(f"\n{'='*60}")
        print(f" {elabel}")
        print(f"{'='*60}")

        # Baseline
        base_sigs = run_baseline(sessions, mapper, target_id)
        r = analyze_signals(base_sigs, f"BASELINE (fixed skip=2)", sessions)
        if r: all_results.append(r)

        # Test different min_score thresholds
        for min_score in [30, 40, 50, 60, 70]:
            sigs, entry_log = run_signal_backtest(
                sessions, mapper, target_id, elabel,
                min_score=min_score, exit_rule="first_loss")
            r = analyze_signals(sigs, f"score>={min_score} exit=first_loss",
                               sessions)
            if r: all_results.append(r)

        # Preemptive exit with different scores
        for min_score in [40, 50]:
            for preempt in [2]:
                sigs, _ = run_signal_backtest(
                    sessions, mapper, target_id, elabel,
                    min_score=min_score, exit_rule="preempt",
                    preempt_rounds=preempt)
                r = analyze_signals(sigs, f"score>={min_score} exit=preempt{preempt}",
                                   sessions)
                if r: all_results.append(r)

    # ============================================================
    # DETAILED SIGNAL ANALYSIS
    # ============================================================
    print(f"\n{'='*60}")
    print(f" SIGNAL COMPONENT ANALYSIS (1行, score>=40)")
    print(f"{'='*60}")

    sigs, entry_log = run_signal_backtest(
        sessions, get_row, 0, "1行",
        min_score=40, exit_rule="first_loss")

    # What signal components correlate with wins?
    # We need per-entry signal details. Let me collect them.
    print(f"\n  Total entries: {len(entry_log)}")
    print(f"  Total bets (after first-loss exit): {len(sigs)}")

    # Score distribution of entries
    score_dist = defaultdict(int)
    for e in entry_log:
        score_dist[e["score"] // 10 * 10] += 1
    print(f"  Entry score distribution: {dict(sorted(score_dist.items()))}")

    # P&L by entry score
    # We need to match entries to bet outcomes. Each entry can produce 0-3 bets
    # before first loss terminates the sequence.
    bet_idx = 0
    entry_pnl = defaultdict(lambda: {"entries": 0, "bets": 0, "pnl": 0, "wins": 0})

    for entry in entry_log:
        score = entry["score"]
        entry_pnl[score]["entries"] += 1
        # Find bets belonging to this entry
        # (Simplified: each entry leads to bets until first loss)
        seq_pnl = 0
        seq_bets = 0
        seq_wins = 0
        while bet_idx < len(sigs):
            bet = sigs[bet_idx]
            seq_bets += 1
            seq_pnl += bet["net"]
            if bet["won"]:
                seq_wins += 1
                bet_idx += 1
            else:
                bet_idx += 1
                break  # first loss → next entry

        entry_pnl[score]["bets"] += seq_bets
        entry_pnl[score]["pnl"] += seq_pnl
        entry_pnl[score]["wins"] += seq_wins

    print(f"\n  P&L by entry score:")
    for score in sorted(entry_pnl.keys()):
        ep = entry_pnl[score]
        avg_pnl = ep["pnl"] / ep["entries"] if ep["entries"] > 0 else 0
        print(f"    score={score}: entries={ep['entries']}, avg_bets={ep['bets']/ep['entries']:.1f}, "
              f"total_pnl={ep['pnl']:+.0f}, avg_pnl={avg_pnl:+.2f}")

    # ============================================================
    # RANKING
    # ============================================================
    print(f"\n{'='*60}")
    print(f" TOP RESULTS")
    print(f"{'='*60}")
    all_results.sort(key=lambda x: x["roi"], reverse=True)
    for i, r in enumerate(all_results[:25]):
        print(f"  {i+1:2d}. {r['label']:<50s} ROI={r['roi']:+.2f}% sig={r['signals']:>5d} "
              f"net={r['net']:+.0f} wr={r['wr']:.1f}% DD={r['max_dd']:.0f} "
              f"CL={r['max_cl']} r30={r['r30_roi']:+.2f}%")


if __name__ == "__main__":
    main()
