"""
Full Multi-Dimensional Entry/Exit Backtest
===========================================
Tracks hypothetical P&L for ALL skip levels (1,2,3,4) simultaneously.
At every opportunity, computes:

1. P&L trajectory per skip: rolling P&L slope + curvature
2. Deviation: gap mean trend (where are hits landing?)
3. Concentration: gap variance/entropy (how clustered?)
4. Cross-skip convergence: is skip=2 gaining on others?
5. Exit: first-loss, trend-crash detection

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json
import math
from collections import defaultdict, Counter
from statistics import mean, stdev, variance as pvar
from typing import Optional

# ============================================================
# Data
# ============================================================

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
# Full state tracker — tracks ALL skip levels simultaneously
# ============================================================

class FullStateTracker:
    """
    At every spin, independently tracks hypothetical 124 outcomes for
    skip=1,2,3,4. Each skip level has its own bet lifecycle.

    This is the KEY — without tracking all skip levels, we can't do
    cross-skip comparison or convergence detection.
    """

    def __init__(self):
        # Per-skip outcome history: list of (spin_index, net_profit)
        self.skip_history = {1: [], 2: [], 3: [], 4: []}

        # Gap sequence
        self.gaps = []

        # Current active hypothetical bets per skip
        # skip -> (entry_spin, bet_round) or None
        self.active_bets = {1: None, 2: None, 3: None, 4: None}

        # For tracking our ACTUAL bets (not hypothetical)
        self.actual_signals = []
        self.actual_entry_log = []

    # ---- Record hypothetical outcomes ----
    def record_hypo_outcome(self, skip, spin, net):
        self.skip_history[skip].append((spin, net))
        # Keep last 40 outcomes for each skip
        if len(self.skip_history[skip]) > 40:
            self.skip_history[skip] = self.skip_history[skip][-40:]

    def record_gap(self, gap):
        self.gaps.append(gap)

    # ---- P&L metrics for a skip level ----
    def _get_pnl_sequence(self, skip, lookback=None):
        """Get P&L values for last N outcomes."""
        history = self.skip_history[skip]
        if lookback is None:
            return [h[1] for h in history]
        return [h[1] for h in history[-lookback:]]

    def _get_cumulative_pnl(self, skip, lookback=None):
        """Get cumulative P&L over last N outcomes."""
        pnls = self._get_pnl_sequence(skip, lookback)
        cum = []
        total = 0
        for p in pnls:
            total += p
            cum.append(total)
        return cum

    # ---- SIGNAL 1: P&L Trajectory ----
    def pnl_trajectory(self, skip, window=12):
        """
        Shape of the P&L curve for a skip level.
        Returns:
          - cum_pnl: final cumulative P&L
          - slope: linear fit slope (first derivative)
          - curvature: are losses getting smaller? (second derivative)
          - bottoming: is it forming a bottom? (was declining, now flattening/rising)
          - improving: simple upward trend
        """
        cum = self._get_cumulative_pnl(skip, window)
        if len(cum) < 6:
            return None

        n = len(cum)

        # Split into first half and second half
        mid = n // 2
        first_half = cum[:mid]
        second_half = cum[mid:]

        first_slope = (first_half[-1] - first_half[0]) / max(1, mid)
        second_slope = (second_half[-1] - second_half[0]) / max(1, n - mid)

        # Curvature: change in slope
        curvature = second_slope - first_slope

        # Is it bottoming? First half declining, second half stabilizing or rising
        bottoming = (first_slope < 0 and second_slope > first_slope * 0.5)

        # Is it improving?
        improving = second_slope > 0

        # Final cumulative P&L
        final_pnl = cum[-1]

        # Recent P&L (last 3 outcomes)
        recent_3 = cum[-3:] if len(cum) >= 3 else cum
        recent_trend = recent_3[-1] - recent_3[0] if len(recent_3) >= 2 else 0

        return {
            "final_pnl": final_pnl,
            "first_slope": first_slope,
            "second_slope": second_slope,
            "curvature": curvature,
            "bottoming": bottoming,
            "improving": improving,
            "recent_trend": recent_trend,
            "n_outcomes": n,
        }

    # ---- SIGNAL 2: Deviation + Concentration ----
    def gap_distribution_stats(self, n_gaps=18):
        """
        Combined deviation + concentration analysis.

        Deviation: where are gaps landing?
          - mean, trend of mean
        Concentration: how clustered?
          - variance, entropy (normalized)
          - % in top-3 most common values
        """
        if len(self.gaps) < n_gaps:
            return None

        recent = self.gaps[-n_gaps:]
        older = self.gaps[-n_gaps*2:-n_gaps] if len(self.gaps) >= n_gaps*2 else None

        m = mean(recent)
        var = pvar(recent) if len(recent) >= 3 else 999
        std = math.sqrt(var)

        # Deviation trend: is mean shifting?
        mean_trend = 0
        if older and len(older) >= n_gaps:
            mean_trend = m - mean(older)

        # Concentration: how many distinct values cover 80% of observations?
        counter = Counter(recent)
        total = len(recent)
        sorted_counts = sorted(counter.values(), reverse=True)
        cum_pct = 0
        distinct_for_80pct = 0
        for c in sorted_counts:
            cum_pct += c / total
            distinct_for_80pct += 1
            if cum_pct >= 0.8:
                break

        # % in top 2 most common values
        top2_pct = (sorted_counts[0] + (sorted_counts[1] if len(sorted_counts) > 1 else 0)) / total

        # % in ideal range (gap 2-4)
        in_range = sum(1 for g in recent if 2 <= g <= 4) / total

        # Entropy (normalized): higher = more spread
        entropy = 0
        for g, c in counter.items():
            p = c / total
            if p > 0:
                entropy -= p * math.log2(p)
        max_entropy = math.log2(min(len(counter), n_gaps))
        norm_entropy = entropy / max_entropy if max_entropy > 0 else 0

        return {
            "mean": m,
            "std": std,
            "variance": var,
            "mean_trend": mean_trend,
            "distinct_80pct": distinct_for_80pct,
            "top2_pct": top2_pct,
            "in_range_pct": in_range,
            "norm_entropy": norm_entropy,
            "mode": counter.most_common(1)[0][0],
            "is_concentrated": top2_pct > 0.50,  # 50%+ in top 2 values
            "is_deviated_favorably": 2.0 <= m <= 4.0,  # mean in 2-4 range
        }

    # ---- SIGNAL 3: Cross-skip convergence ----
    def cross_skip_analysis(self, window=12):
        """
        Compare P&L trends across all 4 skip levels.
        Key questions:
          - Which skip is winning right now?
          - Is skip=2 gaining on the leader?
          - Is there convergence (others declining, skip=2 rising)?
        """
        trajectories = {}
        for skip in [1, 2, 3, 4]:
            traj = self.pnl_trajectory(skip, window)
            if traj:
                trajectories[skip] = traj

        if len(trajectories) < 3:
            return None

        # Rank by final cumulative P&L
        ranked = sorted(trajectories.items(), key=lambda x: x[1]["final_pnl"], reverse=True)

        # Where is skip=2?
        skip2_rank = next((i for i, (s, _) in enumerate(ranked) if s == 2), None)
        skip2_traj = trajectories.get(2)

        # Is skip=2 improving while others decline?
        skip2_improving = skip2_traj["improving"] if skip2_traj else False
        others_declining = all(
            trajectories[s]["second_slope"] < 0
            for s in [1, 3, 4] if s in trajectories
        )

        # Convergence: skip=2 slope > average of others
        others_slopes = [trajectories[s]["second_slope"] for s in [1, 3, 4] if s in trajectories]
        avg_other_slope = mean(others_slopes) if others_slopes else 0
        convergence = skip2_traj["second_slope"] > avg_other_slope + 0.3 if skip2_traj else False

        # Gap between skip=2 P&L and best other P&L
        best_other_pnl = max(
            trajectories[s]["final_pnl"] for s in [1, 3, 4] if s in trajectories
        ) if any(s in trajectories for s in [1, 3, 4]) else 0
        skip2_pnl_gap = skip2_traj["final_pnl"] - best_other_pnl if skip2_traj else -999

        return {
            "ranked": [(s, t["final_pnl"]) for s, t in ranked],
            "skip2_rank": skip2_rank,
            "skip2_winning": skip2_rank == 0,
            "skip2_improving": skip2_improving,
            "others_declining": others_declining,
            "convergence": convergence,
            "skip2_vs_best_other": skip2_pnl_gap,
            "gap_closing": skip2_pnl_gap > -3 and skip2_improving,  # within 3 units and improving
        }

    # ---- COMPOSITE ENTRY SCORE ----
    def compute_entry_score(self):
        """
        Combines all signals into 0-100 score for skip=2 entry.

        COMPONENTS:
        A. P&L bottoming/turnaround (0-30 points)
        B. Cross-skip convergence (0-25 points)
        C. Deviation in favorable range (0-20 points)
        D. Concentration (0-15 points)
        E. Not overheated (0-10 points)
        """
        score = 0
        reasons = []

        # A: P&L trajectory for skip=2 (30 pts)
        traj2 = self.pnl_trajectory(2, window=15)
        if traj2:
            if traj2["bottoming"] and traj2["final_pnl"] < 0:
                score += 30
                reasons.append("P&L_bottoming_from_negative")
            elif traj2["bottoming"]:
                score += 22
                reasons.append("P&L_bottoming")
            elif traj2["improving"] and traj2["final_pnl"] < 0:
                score += 22
                reasons.append("P&L_improving_from_negative")
            elif traj2["improving"] and traj2["curvature"] > 0.5:
                score += 18
                reasons.append("P&L_improving_accelerating")
            elif traj2["improving"]:
                score += 12
                reasons.append("P&L_improving")
            elif traj2["second_slope"] > -0.3:
                score += 5
                reasons.append("P&L_stable")
            else:
                score += 0
                reasons.append("P&L_declining")

        # B: Cross-skip convergence (25 pts)
        cross = self.cross_skip_analysis(window=12)
        if cross:
            if cross["convergence"] and cross["skip2_improving"]:
                score += 25
                reasons.append("cross_converging+improving")
            elif cross["gap_closing"]:
                score += 20
                reasons.append("cross_gap_closing")
            elif cross["skip2_winning"]:
                score += 15
                reasons.append("cross_skip2_leading")
            elif cross["others_declining"]:
                score += 12
                reasons.append("cross_others_declining")
            elif cross["skip2_improving"]:
                score += 8
                reasons.append("cross_skip2_improving_only")
            else:
                reasons.append("cross_no_signal")

        # C: Deviation — where are gaps landing? (20 pts)
        gap_stats = self.gap_distribution_stats(n_gaps=15)
        if gap_stats:
            m = gap_stats["mean"]
            if 2.0 <= m <= 3.5:
                score += 20
                reasons.append(f"dev_optimal({m:.1f})")
            elif 1.8 <= m <= 4.0:
                score += 14
                reasons.append(f"dev_good({m:.1f})")
            elif 1.5 <= m <= 4.5:
                score += 7
                reasons.append(f"dev_ok({m:.1f})")
            else:
                reasons.append(f"dev_poor({m:.1f})")

            # Bonus: mean trending toward favorable range
            if gap_stats["mean_trend"] > 0.3 and m < 3.5:
                score += 3
                reasons.append("dev_trending_to_optimal")

        # D: Concentration — how clustered? (15 pts)
        if gap_stats:
            if gap_stats["top2_pct"] > 0.60 and gap_stats["is_deviated_favorably"]:
                score += 15
                reasons.append(f"conc_tight_favorable({gap_stats['top2_pct']:.0%})")
            elif gap_stats["top2_pct"] > 0.50:
                score += 12
                reasons.append(f"conc_tight({gap_stats['top2_pct']:.0%})")
            elif gap_stats["distinct_80pct"] <= 4:
                score += 8
                reasons.append(f"conc_moderate(d80={gap_stats['distinct_80pct']})")
            elif gap_stats["norm_entropy"] < 0.7:
                score += 4
                reasons.append(f"conc_somewhat")
            else:
                reasons.append("conc_spread")

        # E: Not overheated (10 pts)
        if gap_stats:
            tr = gap_stats["in_range_pct"]
            if tr <= 0.35:
                score += 10
                reasons.append(f"cool(tr={tr:.0%})")
            elif tr <= 0.45:
                score += 6
                reasons.append(f"warm(tr={tr:.0%})")
            elif tr <= 0.55:
                score += 2
                reasons.append(f"warming_up(tr={tr:.0%})")
            else:
                reasons.append(f"overheated(tr={tr:.0%})")

        return score, reasons


# ============================================================
# Backtest engine
# ============================================================

def run_full_backtest(sessions, mapper, target_id, entity_label,
                       min_score=40, exit_rule="first_loss"):
    """
    Full backtest with ALL skip levels tracked simultaneously.

    exit_rule:
      - "first_loss": exit sequence after any loss
      - "trend_crash": exit when skip=2 P&L slope drops below -1.0
      - "first_loss_or_crash": exit on first loss OR trend crash
    """
    tracker = FullStateTracker()
    actual_signals = []  # our real bets
    entry_log = []       # when we entered and why

    for sess in sessions:
        nums = sess["numbers"]
        prev_hit = -1
        nz_idx = 0

        # Our actual bet state
        in_bet = False
        bet_round = 0
        entry_score = 0
        entry_reasons = []

        for si, n in enumerate(nums):
            if n == 0:
                # Advance all hypothetical bets (0 never hits)
                for skip in [1, 2, 3, 4]:
                    if tracker.active_bets[skip] is not None:
                        entry_sp, br = tracker.active_bets[skip]
                        br += 1
                        if br >= 3:
                            tracker.record_hypo_outcome(skip, entry_sp, -7)
                            tracker.active_bets[skip] = None
                        else:
                            tracker.active_bets[skip] = (entry_sp, br)

                # Advance actual bet
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        actual_signals.append({
                            "won": False, "net": -7, "session": sess["name"],
                            "score": entry_score, "reasons": entry_reasons,
                        })
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            # ---- Resolve hypothetical bets ----
            for skip in [1, 2, 3, 4]:
                if tracker.active_bets[skip] is not None:
                    entry_sp, br = tracker.active_bets[skip]
                    if is_target:
                        net = 2 if br == 0 else (3 if br == 1 else 5)
                        tracker.record_hypo_outcome(skip, entry_sp, net)
                        tracker.active_bets[skip] = None
                    else:
                        br += 1
                        if br >= 3:
                            tracker.record_hypo_outcome(skip, entry_sp, -7)
                            tracker.active_bets[skip] = None
                        else:
                            tracker.active_bets[skip] = (entry_sp, br)

            # ---- Resolve actual bet ----
            if in_bet:
                if is_target:
                    net = 2 if bet_round == 0 else (3 if bet_round == 1 else 5)
                    actual_signals.append({
                        "won": True, "net": net, "session": sess["name"],
                        "score": entry_score, "reasons": entry_reasons,
                    })
                    in_bet = False
                else:
                    bet_round += 1
                    should_exit = False

                    if bet_round >= 3:
                        should_exit = True

                    if should_exit:
                        actual_signals.append({
                            "won": False, "net": -7, "session": sess["name"],
                            "score": entry_score, "reasons": entry_reasons,
                        })
                        in_bet = False

            # ---- Update gap tracking ----
            if is_target:
                if prev_hit >= 0:
                    tracker.record_gap(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1

            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

            # ---- Start hypothetical bets ----
            for skip in [1, 2, 3, 4]:
                if cs == skip and tracker.active_bets[skip] is None and len(tracker.gaps) >= 18:
                    tracker.active_bets[skip] = (si, 0)

            # ---- Entry decision (only at skip=2) ----
            if not in_bet and cs == 2 and len(tracker.gaps) >= 18:
                score, reasons = tracker.compute_entry_score()

                if score >= min_score:
                    in_bet = True
                    bet_round = 0
                    entry_score = score
                    entry_reasons = reasons
                    entry_log.append({
                        "session": sess["name"],
                        "spin": si,
                        "score": score,
                        "reasons": reasons,
                    })

    return actual_signals, entry_log, tracker


# ============================================================
# Baseline
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
                        signals.append({"won": False, "net": -7, "score": 0, "reasons": [], "session": sess["name"]})
                        in_bet = False
                continue
            eid = mapper(n)
            is_target = (eid == target_id)
            if in_bet:
                if is_target:
                    net = 2 if bet_round == 0 else (3 if bet_round == 1 else 5)
                    signals.append({"won": True, "net": net, "score": 0, "reasons": [], "session": sess["name"]})
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        signals.append({"won": False, "net": -7, "score": 0, "reasons": [], "session": sess["name"]})
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
# Reporting
# ============================================================

def analyze(signals, label, sessions, entry_log=None):
    if not signals:
        print(f"  {label}: 0 signals")
        return None

    total_bet = len(signals) * 7
    total_net = sum(s["net"] for s in signals)
    roi = total_net / total_bet * 100
    wins = sum(1 for s in signals if s["won"])
    wr = wins / len(signals) * 100

    sess_pnl = defaultdict(float)
    for s in signals:
        sess_pnl[s["session"]] += s["net"]
    pnls = list(sess_pnl.values())
    cum = 0; peak = 0; max_dd = 0
    for p in pnls:
        cum += p
        if cum > peak: peak = cum
        max_dd = max(max_dd, peak - cum)
    ws = sum(1 for p in pnls if p > 0)
    ls = sum(1 for p in pnls if p < 0)

    max_cl = 0; curr = 0
    for s in signals:
        if not s["won"]: curr += 1; max_cl = max(max_cl, curr)
        else: curr = 0

    recent30 = {s["name"] for s in sessions[-30:]}
    r30 = [s for s in signals if s["session"] in recent30]
    r30_roi = sum(s["net"] for s in r30) / (len(r30)*7) * 100 if r30 else 0

    # Score breakdown
    score_bins = defaultdict(lambda: {"s": 0, "w": 0, "net": 0})
    for s in signals:
        sc = s.get("score", 0)
        bk = (sc // 10) * 10
        score_bins[bk]["s"] += 1
        if s["won"]: score_bins[bk]["w"] += 1
        score_bins[bk]["net"] += s["net"]

    # Reason frequency
    reason_freq = Counter()
    if entry_log:
        for e in entry_log:
            for r in e.get("reasons", []):
                reason_freq[r] += 1

    print(f"  {label}")
    print(f"    sig={len(signals)} wr={wr:.1f}% ROI={roi:+.2f}% net={total_net:+.0f} "
          f"DD={max_dd:.0f} CL={max_cl} ws={ws} ls={ls} r30={r30_roi:+.2f}%")

    if score_bins:
        parts = []
        for sc in sorted(score_bins.keys()):
            sb = score_bins[sc]
            sr = sb["w"]/sb["s"]*100 if sb["s"]>0 else 0
            sroi = sb["net"]/(sb["s"]*7)*100 if sb["s"]>0 else 0
            parts.append(f"[{sc}-{sc+9}]:{sb['s']}s/{sr:.0f}%/{sroi:+.1f}%")
        print(f"    Score bins: {' | '.join(parts)}")

    if reason_freq:
        top_reasons = reason_freq.most_common(8)
        print(f"    Top reasons: {', '.join(f'{r}({c})' for r,c in top_reasons)}")

    return {"label": label, "signals": len(signals), "roi": roi, "net": total_net,
            "wr": wr, "max_dd": max_dd, "max_cl": max_cl, "r30_roi": r30_roi,
            "ws": ws, "ls": ls}


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
        base = run_baseline(sessions, mapper, target_id)
        r = analyze(base, "BASELINE", sessions)
        if r: all_results.append(r)

        # Test score thresholds
        for min_score in [30, 35, 40, 45, 50, 55]:
            sigs, entry_log, tracker = run_full_backtest(
                sessions, mapper, target_id, elabel,
                min_score=min_score, exit_rule="first_loss")

            if len(sigs) < 20:
                continue

            r = analyze(sigs, f"score≥{min_score} exit=first_loss", sessions, entry_log)
            if r: all_results.append(r)

            # Also show detailed reason breakdown for best score thresholds
            if min_score in [30, 40]:
                # P&L per reason type
                reason_pnl = defaultdict(lambda: {"bets": 0, "pnl": 0})
                for s in sigs:
                    reasons_key = "|".join(sorted(s.get("reasons", [])))
                    reason_pnl[reasons_key]["bets"] += 1
                    reason_pnl[reasons_key]["pnl"] += s["net"]

    # ============================================================
    # DETAILED ANALYSIS for best performers
    # ============================================================
    print(f"\n{'='*60}")
    print(f" COMPONENT CONTRIBUTION ANALYSIS (1行, score≥30)")
    print(f"{'='*60}")

    sigs, entry_log, tracker = run_full_backtest(
        sessions, get_row, 0, "1行", min_score=30, exit_rule="first_loss")

    # Analyze which signal components actually predict wins
    component_wins = defaultdict(lambda: {"present": 0, "won": 0, "absent": 0, "absent_won": 0})

    for e in entry_log:
        reasons = set(e["reasons"])
        # Find the matching bet outcomes (bets from this entry until first loss)
        # We know the first bet is at the same index roughly
        for reason in reasons:
            # Just count presence
            component_wins[reason]["present"] += 1

    # For each bet, check which reasons were active
    # Match bets to entries
    bet_idx = 0
    for entry in entry_log:
        reasons = set(entry["reasons"])
        # This entry produces bets until first loss
        while bet_idx < len(sigs):
            bet = sigs[bet_idx]
            for r in reasons:
                if bet["won"]:
                    component_wins[r]["won"] += 1
            bet_idx += 1
            if not bet["won"]:
                break

    # Show predictive power of each reason type
    print(f"\n  Reason → Win Rate (when present in entry signal):")
    for reason, counts in sorted(component_wins.items(),
                                  key=lambda x: x[1]["won"]/max(1,x[1]["present"]),
                                  reverse=True):
        wr = counts["won"] / counts["present"] * 100 if counts["present"] > 0 else 0
        if counts["present"] >= 20:
            print(f"    {reason:<50s} wr={wr:.1f}% (n={counts['present']})")

    # ============================================================
    # RANKING
    # ============================================================
    print(f"\n{'='*60}")
    print(f" TOP RESULTS")
    print(f"{'='*60}")
    all_results.sort(key=lambda x: x["roi"], reverse=True)
    for i, r in enumerate(all_results[:20]):
        print(f"  {i+1:2d}. {r['label']:<55s} ROI={r['roi']:+.2f}% sig={r['signals']:>5d} "
              f"net={r['net']:+.0f} wr={r['wr']:.1f}% DD={r['max_dd']:.0f} "
              f"ws={r['ws']} ls={r['ls']} r30={r['r30_roi']:+.2f}%")


if __name__ == "__main__":
    main()
