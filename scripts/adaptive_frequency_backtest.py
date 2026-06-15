"""
Adaptive Frequency 124 Backtest
================================
Core insight: ALL window sizes must adapt to the current volatility frequency.

Phase 1: Measure volatility frequency
  - Compare gap variance at multiple window sizes
  - Compute dominant cycle length via autocorrelation
  - Classify: HIGH_FREQ / MED_FREQ / LOW_FREQ

Phase 2: Adaptive metrics (all windows = f(frequency))
  - P&L tracking window
  - Deviation window
  - Concentration window
  - Relative strength window

Phase 3: Entry scoring (using adaptive windows)
  - P&L bottoming/improving
  - Deviation favorable
  - Concentration tight
  - Relative strength vs other gears
  - Not overheated

Phase 4: Adaptive exit
  - HIGH_FREQ: exit on first loss
  - MED_FREQ: exit on 2nd loss
  - LOW_FREQ: exit only when score drops significantly

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
# Phase 1: Volatility Frequency Detection
# ============================================================

def measure_frequency(gaps):
    """
    Measure the market's volatility frequency from the gap sequence.

    Returns: dict with frequency classification and recommended window sizes.

    Methods:
    1. Variance ratio: var(short) / var(long). High ratio = high frequency.
    2. Zero-crossing rate of the gap mean trend.
    3. Best-gear change rate.

    Classification:
      - HIGH: regime changes every ~8-12 gaps → use n=8 windows
      - MEDIUM: regime changes every ~13-20 gaps → use n=12 windows
      - LOW: regime changes every ~21+ gaps → use n=20 windows
    """
    if len(gaps) < 30:
        return {"freq": "MEDIUM", "n_window": 12, "n_pnl": 8, "exit_tolerance": 1}

    # Method 1: Variance ratio across window sizes
    g8 = gaps[-8:] if len(gaps) >= 8 else gaps
    g16 = gaps[-16:] if len(gaps) >= 16 else gaps
    g24 = gaps[-24:] if len(gaps) >= 24 else gaps

    var8 = pvar(g8) if len(g8) >= 3 else 0
    var16 = pvar(g16) if len(g16) >= 3 else 0
    var24 = pvar(g24) if len(g24) >= 3 else 0

    # High short-term variance relative to long-term = high frequency
    # (because values change a lot in short windows but average out over long windows)
    ratio_8_24 = var8 / var24 if var24 > 0 else 1.0
    ratio_8_16 = var8 / var16 if var16 > 0 else 1.0

    # Method 2: Zero-crossing rate of rolling mean
    # Compute rolling mean(6) and count sign changes
    zc_count = 0
    if len(gaps) >= 18:
        prev_mean = mean(gaps[-18:-12])
        for i in range(len(gaps)-17, len(gaps)-5):
            curr_mean = mean(gaps[i:i+6])
            if (prev_mean - 2.0) * (curr_mean - 2.0) < 0:  # crossed the expected mean
                zc_count += 1
            prev_mean = curr_mean
    zc_rate = zc_count / max(1, len(gaps) - 17)

    # Method 3: Gap-to-gap variance
    # If consecutive gaps are very different → high frequency
    if len(gaps) >= 12:
        recent = gaps[-12:]
        diffs = [abs(recent[i+1] - recent[i]) for i in range(len(recent)-1)]
        avg_diff = mean(diffs)
    else:
        avg_diff = 2.0

    # Composite frequency score
    freq_score = 0
    if ratio_8_24 > 2.0: freq_score += 3
    elif ratio_8_24 > 1.5: freq_score += 2
    elif ratio_8_24 > 1.0: freq_score += 1

    if ratio_8_16 > 2.0: freq_score += 2
    elif ratio_8_16 > 1.3: freq_score += 1

    if zc_rate > 0.25: freq_score += 3
    elif zc_rate > 0.15: freq_score += 2
    elif zc_rate > 0.08: freq_score += 1

    if avg_diff > 3.0: freq_score += 2
    elif avg_diff > 2.0: freq_score += 1

    # Classify
    if freq_score >= 6:
        freq = "HIGH"
        n_window = 8
        n_pnl = 5
        exit_tolerance = 0  # exit immediately on loss
    elif freq_score >= 3:
        freq = "MEDIUM"
        n_window = 12
        n_pnl = 8
        exit_tolerance = 1  # can tolerate 1 loss
    else:
        freq = "LOW"
        n_window = 18
        n_pnl = 12
        exit_tolerance = 2  # can tolerate 2 losses

    return {
        "freq": freq,
        "score": freq_score,
        "n_window": n_window,
        "n_pnl": n_pnl,
        "exit_tolerance": exit_tolerance,
        "var_ratio_8_24": ratio_8_24,
        "zc_rate": zc_rate,
        "avg_diff": avg_diff,
    }


# ============================================================
# Phase 2 & 3: Adaptive Gear Tracker + Scoring
# ============================================================

class AdaptiveGearTracker:
    def __init__(self, gear_skip):
        self.gear = gear_skip
        self.outcomes = []  # (spin, net)

    def record(self, spin, net):
        self.outcomes.append((spin, net))

    def recent_pnl(self, n):
        return [o[1] for o in self.outcomes[-n:]] if len(self.outcomes) >= n else [o[1] for o in self.outcomes]

    def cum_pnl(self, n):
        vals = self.recent_pnl(n)
        cum = []; t = 0
        for v in vals: t += v; cum.append(t)
        return cum

    def pnl_shape(self, n):
        """Returns bottoming, improving, recovery strength."""
        cum = self.cum_pnl(n)
        if len(cum) < 4: return None
        mid = max(1, len(cum)//2)
        first, second = cum[:mid], cum[mid:]
        s1 = (first[-1]-first[0])/mid if first and mid>0 else 0
        s2 = (second[-1]-second[0])/max(1,len(second)) if second else 0
        curv = s2 - s1
        bottoming = (first and first[-1] < first[0] and s2 > s1 * 0.3)
        improving = s2 > 0
        mini = min(cum) if cum else 0
        # recovery = how far from bottom
        if mini in cum and len(cum) > 0:
            after_min = cum[cum.index(mini):]
            recovery = max(after_min) - mini if after_min else 0
        else:
            recovery = 0
        return {"s1":s1, "s2":s2, "curv":curv, "bottoming":bottoming,
                "improving":improving, "recovery":recovery, "final":cum[-1] if cum else 0}


def compute_gear_score(gear, tracker, gaps, all_trackers, freq_info):
    """
    Compute gear score using ADAPTIVE windows from frequency detection.
    """
    n_win = freq_info["n_window"]    # for deviation, concentration
    n_pnl = freq_info["n_pnl"]        # for P&L tracking

    score = 0
    reasons = []

    # ---- A: P&L shape (adaptive window) [35 pts] ----
    shape = tracker.pnl_shape(n_pnl)
    if shape:
        if shape["bottoming"] and shape["final"] < -3:
            score += 35; reasons.append("A:strong_bottom")
        elif shape["bottoming"] and shape["recovery"] > 2:
            score += 30; reasons.append("A:bottom_recovering")
        elif shape["bottoming"]:
            score += 22; reasons.append("A:bottoming")
        elif shape["improving"] and shape["final"] < 0:
            score += 22; reasons.append("A:improving_from_neg")
        elif shape["improving"] and shape["curv"] > 0.2:
            score += 15; reasons.append("A:improving_accel")
        elif shape["improving"]:
            score += 10; reasons.append("A:improving")
        elif shape["s2"] > -0.5:
            score += 4; reasons.append("A:stable")
        else:
            reasons.append("A:declining")

    # ---- B: Capture range (adaptive window) [25 pts] ----
    cap_start, cap_end = gear, gear + 2
    if len(gaps) >= n_win:
        recent_g = gaps[-n_win:]
        in_cap = sum(1 for g in recent_g if cap_start <= g <= cap_end)
        cap_pct = in_cap / len(recent_g)

        if cap_pct >= 0.60: score += 25; reasons.append(f"B:strong_cap({cap_pct:.0%})")
        elif cap_pct >= 0.50: score += 20; reasons.append(f"B:good_cap({cap_pct:.0%})")
        elif cap_pct >= 0.40: score += 12; reasons.append(f"B:ok_cap({cap_pct:.0%})")
        elif cap_pct >= 0.30: score += 5; reasons.append(f"B:weak_cap({cap_pct:.0%})")
        else: reasons.append(f"B:poor_cap({cap_pct:.0%})")

        # Trend in capture pct
        if len(gaps) >= n_win * 2:
            older_g = gaps[-n_win*2:-n_win]
            older_cap = sum(1 for g in older_g if cap_start <= g <= cap_end) / len(older_g)
            if cap_pct > older_cap + 0.08:
                score += 3; reasons.append("B:cap_improving")

    # ---- C: Concentration (adaptive window) [20 pts] ----
    if len(gaps) >= n_win:
        recent_g = gaps[-n_win:]
        counter = Counter(recent_g)
        total = len(recent_g)
        sc = sorted(counter.values(), reverse=True)
        top2 = (sc[0] + (sc[1] if len(sc)>1 else 0)) / total
        # Distinct for 80%
        cum_pct = 0; d80 = 0
        for c in sc: cum_pct += c/total; d80 += 1
        if cum_pct >= 0.80 or d80 >= len(sc): pass

        if top2 > 0.60:
            score += 20; reasons.append(f"C:tight(top2={top2:.0%})")
        elif top2 > 0.50:
            score += 14; reasons.append(f"C:moderate(top2={top2:.0%})")
        elif d80 <= 4:
            score += 7; reasons.append(f"C:loose(d80={d80})")
        else:
            reasons.append("C:spread")

    # ---- D: Relative strength vs other gears (adaptive) [15 pts] ----
    if all_trackers and shape:
        other_shapes = []
        for gid, gt in all_trackers.items():
            if gid == gear: continue
            os = gt.pnl_shape(n_pnl)
            if os: other_shapes.append(os["s2"])

        if other_shapes:
            avg_other = mean(other_shapes)
            best_other = max(other_shapes)
            adv = shape["s2"] - avg_other
            if adv > 0.4 and shape["improving"]: score += 15; reasons.append("D:dominant")
            elif adv > 0.15: score += 10; reasons.append("D:leading")
            elif adv > -0.1: score += 5; reasons.append("D:neutral")
            else: reasons.append("D:lagging")

            if shape["improving"] and best_other < -0.2:
                score += 3; reasons.append("D:diverging")

    # ---- E: Overheat check [5 pts] ----
    if len(gaps) >= n_win * 2:
        longer = gaps[-n_win*2:]
        tr = sum(1 for g in longer if 2 <= g <= 4) / len(longer) if longer else 0
        if tr <= 0.35: score += 5; reasons.append(f"E:cool({tr:.0%})")
        elif tr <= 0.50: score += 2; reasons.append(f"E:warm({tr:.0%})")
        else: reasons.append(f"E:hot({tr:.0%})")

    return score, reasons


# ============================================================
# Full Adaptive Backtest
# ============================================================

def run_adaptive_backtest(sessions, mapper, target_id, label, min_score=45):
    """
    For each session:
    1. Maintain gap sequence and per-gear trackers
    2. Every spin, measure frequency → adaptive windows
    3. Score all gears with adaptive windows
    4. Enter at best gear when score >= min_score
    5. Exit based on frequency-adaptive rule
    """
    all_signals = []
    all_entries = []

    for sess in sessions:
        nums = sess["numbers"]
        gears = {g: AdaptiveGearTracker(g) for g in [1,2,3,4]}
        active = {g: None for g in [1,2,3,4]}  # hypothetical
        gaps = []
        prev_hit = -1; nz_idx = 0

        # Actual bet state
        in_bet = False; bet_round = 0
        chosen_gear = 0; entry_score = 0
        exit_tolerance_remaining = 0
        losses_this_seq = 0

        for si, n in enumerate(nums):
            # ---- Zero ----
            if n == 0:
                for g in [1,2,3,4]:
                    if active[g] is not None:
                        esp, br = active[g]; br += 1
                        if br >= 3: gears[g].record(esp, -7); active[g] = None
                        else: active[g] = (esp, br)
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        all_signals.append({"won": False, "net": -7, "session": sess["name"],
                                          "gear": chosen_gear, "score": entry_score})
                        losses_this_seq += 1
                        exit_tolerance_remaining -= 1
                        if exit_tolerance_remaining < 0:
                            in_bet = False
                            losses_this_seq = 0
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            # ---- Resolve hypothetical ----
            for g in [1,2,3,4]:
                if active[g] is not None:
                    esp, br = active[g]
                    if is_target:
                        net = 2 if br==0 else (3 if br==1 else 5)
                        gears[g].record(esp, net); active[g] = None
                    else:
                        br += 1
                        if br >= 3: gears[g].record(esp, -7); active[g] = None
                        else: active[g] = (esp, br)

            # ---- Resolve actual bet ----
            if in_bet:
                if is_target:
                    net = 2 if bet_round==0 else (3 if bet_round==1 else 5)
                    all_signals.append({"won": True, "net": net, "session": sess["name"],
                                      "gear": chosen_gear, "score": entry_score})
                    losses_this_seq = 0
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        all_signals.append({"won": False, "net": -7, "session": sess["name"],
                                          "gear": chosen_gear, "score": entry_score})
                        losses_this_seq += 1
                        exit_tolerance_remaining -= 1
                        if exit_tolerance_remaining < 0:
                            in_bet = False
                            losses_this_seq = 0

            # ---- Update gaps ----
            if is_target:
                if prev_hit >= 0: gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1
            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

            # ---- Start hypothetical ----
            for g in [1,2,3,4]:
                if cs == g and active[g] is None and len(gaps) >= 18:
                    active[g] = (si, 0)

            if len(gaps) < 18: continue

            # ---- Measure frequency → adaptive windows ----
            freq_info = measure_frequency(gaps)

            # ---- Score all gears ----
            gear_scores = {}
            for g in [1,2,3,4]:
                gear_scores[g] = compute_gear_score(g, gears[g], gaps, gears, freq_info)
            best_gear = max(gear_scores, key=lambda g: gear_scores[g][0])
            best_score, best_reasons = gear_scores[best_gear]

            # ---- Entry ----
            if not in_bet and best_score >= min_score and cs == best_gear:
                in_bet = True; bet_round = 0
                chosen_gear = best_gear
                entry_score = best_score
                exit_tolerance_remaining = freq_info["exit_tolerance"]
                losses_this_seq = 0
                all_entries.append({
                    "session": sess["name"], "spin": si,
                    "gear": chosen_gear, "score": best_score,
                    "freq": freq_info["freq"],
                    "n_win": freq_info["n_window"],
                    "exit_tol": freq_info["exit_tolerance"],
                    "reasons": best_reasons,
                })

    return all_signals, all_entries


def run_baseline(sessions, mapper, target_id, skip=2):
    signals = []
    for sess in sessions:
        nums = sess["numbers"]
        gaps=[]; prev_hit=-1; nz_idx=0; in_bet=False; br=0
        for n in nums:
            if n==0:
                if in_bet: br+=1
                if in_bet and br>=3: signals.append({"won":False,"net":-7,"session":sess["name"],"gear":skip,"score":0}); in_bet=False
                continue
            eid=mapper(n); is_target=(eid==target_id)
            if in_bet:
                if is_target:
                    net=2 if br==0 else (3 if br==1 else 5)
                    signals.append({"won":True,"net":net,"session":sess["name"],"gear":skip,"score":0}); in_bet=False
                else:
                    br+=1
                    if br>=3: signals.append({"won":False,"net":-7,"session":sess["name"],"gear":skip,"score":0}); in_bet=False
            if is_target:
                if prev_hit>=0: gaps.append(nz_idx-prev_hit-1)
                prev_hit=nz_idx
            nz_idx+=1
            cs=(nz_idx-prev_hit-1) if prev_hit>=0 else nz_idx
            if not in_bet and cs==skip and len(gaps)>=12: in_bet=True; br=0
    return signals


# ============================================================
# Reporting
# ============================================================

def analyze(signals, label, sessions, entries=None):
    if not signals: print(f"  {label}: 0 sig"); return None
    tb=len(signals)*7; tn=sum(s["net"] for s in signals)
    roi=tn/tb*100; wins=sum(1 for s in signals if s["won"]); wr=wins/len(signals)*100

    sess_pnl=defaultdict(float)
    for s in signals: sess_pnl[s["session"]]+=s["net"]
    pnls=list(sess_pnl.values())
    cum=0;peak=0;dd=0
    for p in pnls:
        cum+=p
        if cum>peak: peak=cum
        dd=max(dd,peak-cum)
    ws=sum(1 for p in pnls if p>0); ls=sum(1 for p in pnls if p<0)
    cl=0;cc=0
    for s in signals:
        if not s["won"]: cc+=1; cl=max(cl,cc)
        else: cc=0

    r30n={s["name"] for s in sessions[-30:]}
    r30=[s for s in signals if s["session"] in r30n]
    r30r=sum(s["net"] for s in r30)/(len(r30)*7)*100 if r30 else 0

    # By gear
    gs=defaultdict(lambda:{"s":0,"w":0,"net":0})
    for s in signals:
        g=s.get("gear",0); gs[g]["s"]+=1
        if s["won"]: gs[g]["w"]+=1
        gs[g]["net"]+=s["net"]

    # By frequency (if entries available)
    freq_stats = defaultdict(lambda: {"s":0,"w":0,"net":0})
    if entries:
        for e in entries:
            f = e.get("freq","?")
            freq_stats[f]["s"] += 1

    print(f"  {label}")
    print(f"    sig={len(signals)} wr={wr:.1f}% ROI={roi:+.2f}% net={tn:+.0f} DD={dd:.0f} CL={cl} ws={ws} ls={ls} r30={r30r:+.2f}%")
    gparts=[]
    for g in sorted(gs):
        gg=gs[g]; gr=gg["w"]/gg["s"]*100 if gg["s"]>0 else 0; groi=gg["net"]/(gg["s"]*7)*100 if gg["s"]>0 else 0
        gparts.append(f"G{g}:{gg['s']}/{gr:.0f}%/{groi:+.1f}%")
    if gparts: print(f"    Gears: {' | '.join(gparts)}")

    if freq_stats:
        fparts=[]
        for f in sorted(freq_stats):
            ff=freq_stats[f]; fparts.append(f"{f}:{ff['s']}")
        print(f"    Freq dist: {' | '.join(fparts)}")

    # Also show frequency distribution of entries if available
    if entries:
        freq_roi = defaultdict(lambda: {"bets":0, "pnl":0})
        # Match entries to signal outcomes (roughly)
        for e in entries:
            f = e.get("freq","?")
            freq_roi[f]["bets"] += 1
        print(f"    Entries by freq: {dict(freq_roi)}")

    return {"label":label,"signals":len(signals),"roi":roi,"net":tn,"wr":wr,
            "max_dd":dd,"max_cl":cl,"r30_roi":r30r,"ws":ws,"ls":ls}


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

        # Baselines
        for skip in [1,2,3,4]:
            sigs = run_baseline(sessions, mapper, target_id, skip)
            r = analyze(sigs, f"BASELINE skip={skip}", sessions)
            if r: all_results.append(r)

        # Adaptive frequency with different min_score
        for ms in [40, 45, 50, 55, 60]:
            sigs, entries = run_adaptive_backtest(sessions, mapper, target_id, elabel, min_score=ms)
            if len(sigs) < 20: continue
            r = analyze(sigs, f"ADAPTIVE score≥{ms}", sessions, entries)
            if r: all_results.append(r)

            # Show detailed breakdown for best threshold
            if ms == 50:
                freq_count = Counter(e.get("freq","?") for e in entries)
                print(f"    Frequency distribution: {dict(freq_count)}")

                # Win rate by frequency
                freq_wr = defaultdict(lambda: {"s":0, "w":0})
                # We need to match entries to signals... simplified
                print(f"    Adaptive windows used: n_win examples:",
                      Counter(e.get("n_win",0) for e in entries).most_common(3))

    # ============================================================
    # Also test: explicit frequency-based window sweep
    # ============================================================
    print(f"\n{'='*60}")
    print(f" FREQUENCY ANALYSIS: window distribution")
    print(f"{'='*60}")

    # Measure frequency for the first entity across all sessions
    all_freqs = []
    for sess in sessions[-20:]:
        nums = sess["numbers"]
        gaps = []
        prev_hit = -1; nz_idx = 0
        for n in nums:
            if n == 0: continue
            eid = get_row(n)
            if eid == 2:  # 3行
                if prev_hit >= 0: gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1

        # Measure frequency at multiple points
        for i in range(30, len(gaps), 15):
            if i >= 30:
                freq = measure_frequency(gaps[:i])
                all_freqs.append(freq)

    freq_dist = Counter(f["freq"] for f in all_freqs)
    avg_n_win = {f: mean(fi["n_window"] for fi in all_freqs if fi["freq"]==f) for f in ["HIGH","MEDIUM","LOW"]}
    print(f"  Frequency distribution over time: {dict(freq_dist)}")
    print(f"  Average window per freq: {avg_n_win}")

    # ============================================================
    # RANKING
    # ============================================================
    print(f"\n{'='*60}")
    print(f" TOP 25")
    print(f"{'='*60}")
    all_results.sort(key=lambda x: x["roi"], reverse=True)
    for i, rec in enumerate(all_results[:25]):
        print(f"  {i+1:2d}. {rec['label']:<50s} ROI={rec['roi']:+.2f}% sig={rec['signals']:>5d} "
              f"net={rec['net']:+.0f} wr={rec['wr']:.1f}% DD={rec['max_dd']:.0f} "
              f"ws={rec['ws']} ls={rec['ls']} r30={rec['r30_roi']:+.2f}%")


if __name__ == "__main__":
    main()
