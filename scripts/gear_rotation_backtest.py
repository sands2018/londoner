"""
Gear Rotation System (档位轮动系统)
=====================================
Each entity × gear (skip=1,2,3,4) is tracked independently.
At each decision point, pick the gear with the best composite score.

Gear score components:
A. P&L bottoming + improving (30 pts) — is this gear turning up from a low?
B. Capture range match (25 pts) — are gaps clustering where this gear catches?
C. Concentration (20 pts) — how tight is the clustering?
D. Relative strength vs other gears (15 pts) — gaining or losing?
E. Not overheated (10 pts) — is the capture range cooling or heating?

Exit rules:
- Conservative: first loss
- Trend: exit when gear's P&L slope turns negative
- Preemptive: exit when score drops below threshold

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json, math
from collections import defaultdict, Counter
from statistics import mean, stdev, variance as pvar
from typing import Optional

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

def get_row(n): return None if n==0 else (2 if n%3==1 else (1 if n%3==2 else 0))
def get_group(n): return None if n==0 else (n-1)//12


# ============================================================
# Gear Tracker — one per (entity, gear)
# ============================================================

class GearTracker:
    """
    Tracks hypothetical 124 outcomes for ONE gear (entry skip level).
    Maintains: P&L history, gap sequence, rolling metrics.
    """
    def __init__(self, gear_skip, window=20):
        self.gear = gear_skip       # 1,2,3,4
        self.window = window
        self.outcomes = []           # list of (spin, net_profit)
        self.all_gaps = []           # all gaps (shared across gears via parent)

    def record_outcome(self, spin, net):
        self.outcomes.append((spin, net))
        if len(self.outcomes) > self.window * 2:
            self.outcomes = self.outcomes[-self.window*2:]

    def recent_pnl(self, n=None):
        if n is None: n = self.window
        vals = [o[1] for o in self.outcomes[-n:]]
        return vals

    def cumulative_pnl(self, n=None):
        vals = self.recent_pnl(n)
        cum = []; total = 0
        for v in vals: total += v; cum.append(total)
        return cum

    def pnl_trajectory(self, n=15):
        """Returns slope, curvature, bottoming flag."""
        cum = self.cumulative_pnl(n)
        if len(cum) < 6:
            return None
        mid = len(cum) // 2
        first = cum[:mid]
        second = cum[mid:]
        s1 = (first[-1] - first[0]) / max(1, mid) if first else 0
        s2 = (second[-1] - second[0]) / max(1, len(second)) if second else 0
        curvature = s2 - s1
        # Bottoming: was declining hard, now flattening or rising
        bottoming = (first and first[-1] < first[0]) and (s2 > s1 * 0.3)
        improving = s2 > 0
        # Recovery strength: how far from the bottom
        if cum:
            min_pnl = min(cum)
            max_after_min = max(cum[cum.index(min_pnl):]) if min_pnl in cum else cum[-1]
            recovery = max_after_min - min_pnl
        else:
            recovery = 0
        return {
            "final_pnl": cum[-1] if cum else 0,
            "s1": s1, "s2": s2, "curvature": curvature,
            "bottoming": bottoming, "improving": improving,
            "recovery": recovery,
            "min_pnl": min(cum) if cum else 0,
        }

    def gear_score(self, gaps, other_gears=None):
        """
        Compute composite score (0-100) for this gear.
        gaps: shared gap sequence
        other_gears: dict of gear_id -> GearTracker for relative comparison
        """
        score = 0
        reasons = []

        # ---- A: P&L bottoming + improving (30 pts) ----
        traj = self.pnl_trajectory(15)
        if traj:
            if traj["bottoming"] and traj["final_pnl"] < -3:
                score += 30; reasons.append("A:strong_bottom")
            elif traj["bottoming"] and traj["recovery"] > 2:
                score += 25; reasons.append("A:bottom_recovering")
            elif traj["bottoming"]:
                score += 20; reasons.append("A:bottoming")
            elif traj["improving"] and traj["final_pnl"] < 0:
                score += 20; reasons.append("A:improving_from_neg")
            elif traj["improving"] and traj["curvature"] > 0.3:
                score += 15; reasons.append("A:improving_accel")
            elif traj["improving"]:
                score += 10; reasons.append("A:improving")
            elif traj["s2"] > -0.5:
                score += 5; reasons.append("A:stable")
            else:
                reasons.append("A:declining")

        # ---- B: Capture range match (25 pts) ----
        # Gear G covers gaps [G, G+2] (skip=2→124 covers gaps 2,3,4)
        capture_start = self.gear
        capture_end = self.gear + 2
        if len(gaps) >= 12:
            recent = gaps[-12:]
            in_capture = sum(1 for g in recent if capture_start <= g <= capture_end)
            capture_pct = in_capture / len(recent)

            if capture_pct >= 0.60:
                score += 25; reasons.append(f"B:capture_strong({capture_pct:.0%})")
            elif capture_pct >= 0.50:
                score += 20; reasons.append(f"B:capture_good({capture_pct:.0%})")
            elif capture_pct >= 0.40:
                score += 12; reasons.append(f"B:capture_ok({capture_pct:.0%})")
            elif capture_pct >= 0.30:
                score += 5; reasons.append(f"B:capture_weak({capture_pct:.0%})")
            else:
                reasons.append(f"B:capture_poor({capture_pct:.0%})")

            # Bonus: capture % is improving
            if len(gaps) >= 24:
                older = gaps[-24:-12]
                older_cap = sum(1 for g in older if capture_start <= g <= capture_end) / len(older)
                if capture_pct > older_cap + 0.10:
                    score += 3; reasons.append("B:capture_improving")

        # ---- C: Concentration (20 pts) ----
        if len(gaps) >= 12:
            recent = gaps[-12:]
            counter = Counter(recent)
            total = len(recent)
            sorted_counts = sorted(counter.values(), reverse=True)
            top2_pct = (sorted_counts[0] + (sorted_counts[1] if len(sorted_counts)>1 else 0)) / total

            # Distinct values needed for 80% coverage
            cum_pct = 0; d80 = 0
            for c in sorted_counts:
                cum_pct += c/total; d80 += 1
                if cum_pct >= 0.80: break

            if top2_pct > 0.65 and capture_pct >= 0.45:
                score += 20; reasons.append(f"C:tight_fav(top2={top2_pct:.0%})")
            elif top2_pct > 0.55:
                score += 14; reasons.append(f"C:tight(top2={top2_pct:.0%})")
            elif d80 <= 3:
                score += 8; reasons.append(f"C:moderate(d80={d80})")
            elif d80 <= 5:
                score += 3; reasons.append("C:somewhat")
            else:
                reasons.append("C:spread")

        # ---- D: Relative strength vs other gears (15 pts) ----
        if other_gears and traj:
            other_slopes = []
            for gid, gt in other_gears.items():
                if gid == self.gear: continue
                ot = gt.pnl_trajectory(15)
                if ot: other_slopes.append(ot["s2"])

            if other_slopes:
                avg_other = mean(other_slopes)
                best_other = max(other_slopes)
                # This gear's advantage
                advantage = traj["s2"] - avg_other
                if advantage > 0.5 and traj["s2"] > 0:
                    score += 15; reasons.append("D:dominant")
                elif advantage > 0.2 and traj["improving"]:
                    score += 12; reasons.append("D:pulling_ahead")
                elif advantage > 0:
                    score += 8; reasons.append("D:slight_edge")
                elif advantage > -0.3:
                    score += 3; reasons.append("D:neutral")
                else:
                    reasons.append("D:lagging")

                # Extra: if this gear is turning up while best other is turning down
                if traj["improving"] and best_other < -0.3:
                    score += 3; reasons.append("D:diverging_positive")

        # ---- E: Not overheated (10 pts) ----
        if len(gaps) >= 18:
            r18 = gaps[-18:]
            tr = sum(1 for g in r18 if 2 <= g <= 4) / 18
            if tr <= 0.35:
                score += 10; reasons.append(f"E:cool({tr:.0%})")
            elif tr <= 0.45:
                score += 6; reasons.append(f"E:warm({tr:.0%})")
            elif tr <= 0.55:
                score += 2; reasons.append(f"E:heating({tr:.0%})")
            else:
                reasons.append(f"E:hot({tr:.0%})")

        return score, reasons


# ============================================================
# Full Gear Rotation Backtest
# ============================================================

class GearRotationEngine:
    """
    Manages multiple gears for one entity.
    At each decision point, scores all gears and picks the best.
    """

    def __init__(self, gears=[1,2,3,4]):
        self.gears = {g: GearTracker(g) for g in gears}
        self.gaps = []
        self.active_bets = {g: None for g in gears}  # hypothetical
        self.actual_signals = []
        self.entry_log = []

    def update(self, is_target, nz_idx, prev_hit, spin, session_name, min_score=45):
        """
        Called at every spin.
        Returns: (should_enter_now, chosen_gear, score, reasons) or (False, None, 0, [])
        """
        # Resolve hypothetical bets for all gears
        for gear, tracker in self.gears.items():
            if self.active_bets[gear] is not None:
                entry_sp, br = self.active_bets[gear]
                if is_target:
                    net = 2 if br==0 else (3 if br==1 else 5)
                    tracker.record_outcome(entry_sp, net)
                    self.active_bets[gear] = None
                else:
                    br += 1
                    if br >= 3:
                        tracker.record_outcome(entry_sp, -7)
                        self.active_bets[gear] = None
                    else:
                        self.active_bets[gear] = (entry_sp, br)

        # Update gaps
        if is_target:
            if prev_hit >= 0:
                self.gaps.append(nz_idx - prev_hit - 1)

        # Start new hypothetical bets
        cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx
        for gear in self.gears:
            if cs == gear and self.active_bets[gear] is None and len(self.gaps) >= 18:
                self.active_bets[gear] = (spin, 0)

        # Score all gears
        if len(self.gaps) < 18:
            return False, None, 0, []

        gear_scores = {}
        for gear, tracker in self.gears.items():
            score, reasons = tracker.gear_score(self.gaps, self.gears)
            gear_scores[gear] = (score, reasons)

        # Pick best gear
        best_gear = max(gear_scores, key=lambda g: gear_scores[g][0])
        best_score, best_reasons = gear_scores[best_gear]

        # Entry decision: enter at best gear's skip level
        if best_score >= min_score and cs == best_gear:
            return True, best_gear, best_score, best_reasons

        return False, best_gear, best_score, best_reasons


def run_gear_backtest(sessions, mapper, target_id, entity_label,
                       min_score=45, exit_rule="first_loss"):
    """
    Full backtest with gear rotation.
    """
    all_signals = []
    all_entries = []

    for sess in sessions:
        nums = sess["numbers"]
        engine = GearRotationEngine(gears=[1,2,3,4])
        prev_hit = -1; nz_idx = 0
        in_bet = False; bet_round = 0
        chosen_gear = 0; entry_score = 0; entry_reasons = []

        for si, n in enumerate(nums):
            if n == 0:
                # Advance actual bet
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        all_signals.append({"won": False, "net": -7, "session": sess["name"],
                                           "gear": chosen_gear, "score": entry_score,
                                           "reasons": entry_reasons})
                        in_bet = False
                # Advance hypothetical
                for gear, tracker in engine.gears.items():
                    if engine.active_bets[gear] is not None:
                        entry_sp, br = engine.active_bets[gear]
                        br += 1
                        if br >= 3:
                            tracker.record_outcome(entry_sp, -7)
                            engine.active_bets[gear] = None
                        else:
                            engine.active_bets[gear] = (entry_sp, br)
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            # ---- Update engine ----
            should_enter, best_gear, best_score, best_reasons = engine.update(
                is_target, nz_idx, prev_hit, si, sess["name"], min_score)

            # ---- Resolve actual bet ----
            if in_bet:
                if is_target:
                    net = 2 if bet_round==0 else (3 if bet_round==1 else 5)
                    all_signals.append({"won": True, "net": net, "session": sess["name"],
                                       "gear": chosen_gear, "score": entry_score,
                                       "reasons": entry_reasons})
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        all_signals.append({"won": False, "net": -7, "session": sess["name"],
                                           "gear": chosen_gear, "score": entry_score,
                                           "reasons": entry_reasons})
                        in_bet = False

            # Update prev_hit
            if is_target:
                prev_hit = nz_idx
            nz_idx += 1

            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

            # ---- Entry ----
            if not in_bet and should_enter:
                in_bet = True; bet_round = 0
                chosen_gear = best_gear
                entry_score = best_score
                entry_reasons = best_reasons
                all_entries.append({
                    "session": sess["name"], "spin": si,
                    "gear": chosen_gear, "score": best_score,
                    "reasons": best_reasons,
                })

    return all_signals, all_entries


def run_baseline(sessions, mapper, target_id, entry_skip=2):
    """Fixed single-gear baseline."""
    signals = []
    for sess in sessions:
        nums = sess["numbers"]
        gaps = []; prev_hit = -1; nz_idx = 0
        in_bet = False; bet_round = 0
        for si, n in enumerate(nums):
            if n == 0:
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        signals.append({"won": False, "net": -7, "session": sess["name"],
                                       "gear": entry_skip, "score": 0, "reasons": []})
                        in_bet = False
                continue
            eid = mapper(n)
            is_target = (eid == target_id)
            if in_bet:
                if is_target:
                    net = 2 if bet_round==0 else (3 if bet_round==1 else 5)
                    signals.append({"won": True, "net": net, "session": sess["name"],
                                   "gear": entry_skip, "score": 0, "reasons": []})
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        signals.append({"won": False, "net": -7, "session": sess["name"],
                                       "gear": entry_skip, "score": 0, "reasons": []})
                        in_bet = False
            if is_target:
                if prev_hit >= 0: gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1
            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx
            if not in_bet and cs == entry_skip and len(gaps) >= 12:
                in_bet = True; bet_round = 0
    return signals


# ============================================================
# Reporting
# ============================================================

def analyze(signals, label, sessions, entry_log=None):
    if not signals: print(f"  {label}: 0 sig"); return None
    tb = len(signals)*7; tn = sum(s["net"] for s in signals)
    roi = tn/tb*100; wins = sum(1 for s in signals if s["won"])
    wr = wins/len(signals)*100

    sess_pnl = defaultdict(float)
    for s in signals: sess_pnl[s["session"]] += s["net"]
    pnls = list(sess_pnl.values())
    cum=0; peak=0; dd=0
    for p in pnls:
        cum+=p
        if cum>peak: peak=cum
        dd=max(dd, peak-cum)
    ws = sum(1 for p in pnls if p>0); ls = sum(1 for p in pnls if p<0)
    cl=0; cc=0
    for s in signals:
        if not s["won"]: cc+=1; cl=max(cl,cc)
        else: cc=0

    r30n = {s["name"] for s in sessions[-30:]}
    r30 = [s for s in signals if s["session"] in r30n]
    r30r = sum(s["net"] for s in r30)/(len(r30)*7)*100 if r30 else 0

    # Per-gear breakdown
    gear_stats = defaultdict(lambda: {"s":0,"w":0,"net":0})
    for s in signals:
        g = s.get("gear",0)
        gear_stats[g]["s"] += 1
        if s["won"]: gear_stats[g]["w"] += 1
        gear_stats[g]["net"] += s["net"]

    # Score bins
    sb = defaultdict(lambda: {"s":0,"w":0,"net":0})
    for s in signals:
        sc = s.get("score",0)//10*10
        sb[sc]["s"]+=1
        if s["won"]: sb[sc]["w"]+=1
        sb[sc]["net"]+=s["net"]

    print(f"  {label}")
    print(f"    sig={len(signals)} wr={wr:.1f}% ROI={roi:+.2f}% net={tn:+.0f} DD={dd:.0f} CL={cl} ws={ws} ls={ls} r30={r30r:+.2f}%")

    # Gear breakdown
    gparts = []
    for g in sorted(gear_stats):
        gs = gear_stats[g]
        gr = gs["w"]/gs["s"]*100 if gs["s"]>0 else 0
        groi = gs["net"]/(gs["s"]*7)*100 if gs["s"]>0 else 0
        gparts.append(f"G{g}:{gs['s']}s/{gr:.0f}%/{groi:+.1f}%")
    print(f"    Gears: {' | '.join(gparts)}")

    # Score bins
    if sb:
        sparts = []
        for sc in sorted(sb):
            ss = sb[sc]; sr = ss["w"]/ss["s"]*100 if ss["s"]>0 else 0
            sroi = ss["net"]/(ss["s"]*7)*100 if ss["s"]>0 else 0
            sparts.append(f"[{sc}]:{ss['s']}/{sr:.0f}%/{sroi:+.1f}%")
        print(f"    Scores: {' | '.join(sparts[:8])}")

    return {"label":label,"signals":len(signals),"roi":roi,"net":tn,"wr":wr,
            "max_dd":dd,"max_cl":cl,"r30_roi":r30r,"ws":ws,"ls":ls,"gear_stats":dict(gear_stats)}


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

        # Baselines for each gear
        for gear in [1,2,3,4]:
            sigs = run_baseline(sessions, mapper, target_id, entry_skip=gear)
            r = analyze(sigs, f"BASELINE fixed skip={gear}", sessions)
            if r: all_results.append(r)

        # Gear rotation with different min_score thresholds
        for ms in [35, 40, 45, 50, 55, 60]:
            sigs, entries = run_gear_backtest(sessions, mapper, target_id, elabel,
                                               min_score=ms, exit_rule="first_loss")
            if len(sigs) < 20: continue
            r = analyze(sigs, f"GearRotate score≥{ms}", sessions, entries)
            if r: all_results.append(r)

            # Detailed gear distribution
            if ms == 45:
                gear_count = Counter(e["gear"] for e in entries)
                print(f"    Entry gear distribution: {dict(gear_count)}")

                # Show sample reasons
                reason_freq = Counter()
                for e in entries:
                    for rsn in e.get("reasons", []):
                        reason_freq[rsn] += 1
                print(f"    Top reasons: {', '.join(f'{r}({c})' for r,c in reason_freq.most_common(10))}")

    # ============================================================
    # Also test: which fixed gear is best overall?
    # ============================================================
    print(f"\n{'='*60}")
    print(f" GEAR COMPARISON SUMMARY")
    print(f"{'='*60}")
    baseline_results = [r for r in all_results if "BASELINE fixed" in r["label"]]
    for r in sorted(baseline_results, key=lambda x: x["roi"], reverse=True):
        print(f"  {r['label']:<40s} ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f} wr={r['wr']:.1f}%")

    # ============================================================
    # RANKING
    # ============================================================
    print(f"\n{'='*60}")
    print(f" TOP 20")
    print(f"{'='*60}")
    all_results.sort(key=lambda x: x["roi"], reverse=True)
    for i, r in enumerate(all_results[:20]):
        print(f"  {i+1:2d}. {r['label']:<50s} ROI={r['roi']:+.2f}% sig={r['signals']:>5d} "
              f"net={r['net']:+.0f} wr={r['wr']:.1f}% DD={r['max_dd']:.0f} CL={r['max_cl']} "
              f"ws={r['ws']} ls={r['ls']} r30={r['r30_roi']:+.2f}%")


if __name__ == "__main__":
    main()
