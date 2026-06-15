"""
Hot Number V2 — Further Optimization
=====================================
Testing:
1. Burst parameter fine-tuning (15/18/22/25 windows, thresholds 3/4)
2. Pick 1 vs dynamic pick (1-2 based on signal strength)
3. Anti-martingale: increase bet after win
4. Distance filter: require/avoid recent appearance
5. Cross-entity boost: hot number in hot group
6. Consensus level: 2/3 vs 3/3 windows
7. Trending sensitivity: require stronger trend
8. Combine best findings

Author: DeepSeek (via Claude Code)
Date: 2026-06-04
"""

import json
from collections import Counter, defaultdict
from statistics import mean, stdev

def load_sessions(path):
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

def count_in_window(nums, num, window):
    start = max(0, len(nums) - window)
    return sum(1 for i in range(start, len(nums)) if nums[i] == num)

def last_appearance(nums, num):
    for i in range(len(nums)-1, -1, -1):
        if nums[i] == num: return len(nums)-1-i
    return len(nums)

def get_top_n(nums, window, n):
    if len(nums) < window: return set()
    start = max(0, len(nums) - window)
    counts = Counter()
    for i in range(start, len(nums)):
        if nums[i] != 0:
            counts[nums[i]] += 1
    sorted_nums = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    if len(sorted_nums) <= n: return set(num for num, _ in sorted_nums)
    cutoff = sorted_nums[n-1][1]
    return set(num for num, cnt in sorted_nums if cnt >= cutoff)

def is_trending_up(nums, num, window):
    if len(nums) < window: return False
    start = len(nums) - window
    mid = start + window // 2
    first = sum(1 for i in range(start, mid) if nums[i] == num)
    second = sum(1 for i in range(mid, len(nums)) if nums[i] == num)
    return second > first

def is_burst(nums, num, window, threshold):
    return count_in_window(nums, num, window) >= threshold

def backtest(sessions, strategy_fn, max_n=1):
    per_session = defaultdict(lambda: {"bet": 0, "win": 0, "signals": 0, "wins": 0})
    for sess in sessions:
        nums = sess["numbers"]
        sn = sess["name"]
        for i in range(50, len(nums)):
            picks = strategy_fn(nums[:i])
            if not picks: continue
            bets = list(picks)[:max_n]
            if not bets: continue
            per_session[sn]["bet"] += len(bets)
            per_session[sn]["signals"] += 1
            if nums[i] in bets and nums[i] != 0:
                per_session[sn]["win"] += 36
                per_session[sn]["wins"] += 1
    return per_session

def analyze(per_session, sessions, label):
    pnls = []
    for sess in sessions:
        sn = sess["name"]
        ps = per_session.get(sn, {"bet": 0, "win": 0})
        pnls.append(ps["win"] - ps["bet"])
    total_net = sum(pnls)
    total_bet = sum(per_session[s["name"]]["bet"] for s in sessions)
    total_sig = sum(per_session[s["name"]]["signals"] for s in sessions)
    total_win_count = sum(per_session[s["name"]]["wins"] for s in sessions)
    roi = total_net / total_bet * 100 if total_bet > 0 else 0
    wr = total_win_count / total_sig * 100 if total_sig > 0 else 0
    win_s = sum(1 for p in pnls if p > 0)
    lose_s = sum(1 for p in pnls if p < 0)
    sorted_pnls = sorted(pnls, reverse=True)
    top5 = sum(sorted_pnls[:5])
    top5_pct = top5 / total_net * 100 if total_net > 0 else 0
    cum = 0; peak = 0; dd = 0
    for p in pnls: cum += p; peak = max(peak, cum); dd = max(dd, peak - cum)
    cv = stdev(pnls) / abs(mean(pnls)) if mean(pnls) != 0 else 999
    return {"roi": roi, "net": total_net, "sig": total_sig, "wr": wr, "cv": cv,
            "top5": top5_pct, "dd": dd, "win_s": win_s, "lose_s": lose_s}


def main():
    path = "HistoryData/wzs-merged.json"
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    recent = sessions[-72:]
    print(f"{len(recent)} sessions\n")

    # Baseline
    def baseline(nums):
        h37 = get_top_n(nums, 37, 6)
        h74 = get_top_n(nums, 74, 6)
        h111 = get_top_n(nums, 111, 6)
        candidates = h37 & h74 & h111
        candidates = set(n for n in candidates if is_trending_up(nums, n, 37))
        candidates = set(n for n in candidates if not is_burst(nums, n, 20, 3))
        if candidates and len(nums) >= 37:
            rc = Counter(x for x in nums[-37:] if x != 0)
            best = max(candidates, key=lambda n: rc.get(n, 0))
            return [best]
        return []

    ps = backtest(recent, baseline)
    r = analyze(ps, recent, "BASELINE")
    print(f"BASELINE: ROI={r['roi']:+.2f}% sig={r['sig']} net={r['net']:+.0f} wr={r['wr']:.2f}% cv={r['cv']:.2f} top5={r['top5']:.0f}% dd={r['dd']:.0f} W/L={r['win_s']}/{r['lose_s']}")

    # ---- Test 1: Burst parameter grid ----
    print(f"\n--- Burst parameters ---")
    best_burst = {"roi": -999}
    for bw in [15, 18, 20, 22, 25]:
        for bt in [3, 4, 5]:
            def make(bw, bt):
                def fn(nums):
                    h37 = get_top_n(nums, 37, 6)
                    h74 = get_top_n(nums, 74, 6)
                    h111 = get_top_n(nums, 111, 6)
                    candidates = h37 & h74 & h111
                    candidates = set(n for n in candidates if is_trending_up(nums, n, 37))
                    candidates = set(n for n in candidates if not is_burst(nums, n, bw, bt))
                    if candidates and len(nums) >= 37:
                        rc = Counter(x for x in nums[-37:] if x != 0)
                        return [max(candidates, key=lambda n: rc.get(n, 0))]
                    return []
                return fn
            ps = backtest(recent, make(bw, bt))
            r = analyze(ps, recent, f"burst<{bt}in{bw}")
            if r['roi'] > best_burst['roi'] and r['sig'] > 2000:
                best_burst = r
            if r['roi'] > 10:
                print(f"  burst<{bt}in{bw}: ROI={r['roi']:+.2f}% sig={r['sig']} net={r['net']:+.0f} cv={r['cv']:.2f} W/L={r['win_s']}/{r['lose_s']}")
    print(f"  Best: ROI={best_burst['roi']:+.2f}% sig={best_burst['sig']} cv={best_burst['cv']:.2f}")

    # ---- Test 2: Stronger trend requirement ----
    print(f"\n--- Trend strength ---")
    for min_diff in [1, 2, 3]:
        def make(md):
            def fn(nums):
                h37 = get_top_n(nums, 37, 6)
                h74 = get_top_n(nums, 74, 6)
                h111 = get_top_n(nums, 111, 6)
                candidates = h37 & h74 & h111
                # Require trend diff >= md
                candidates = set(n for n in candidates if (
                    len(nums) >= 37 and
                    sum(1 for i in range(len(nums)-37, len(nums)-19) if nums[i] == n) <
                    sum(1 for i in range(len(nums)-19, len(nums)) if nums[i] == n) - md + 1
                ))
                candidates = set(n for n in candidates if not is_burst(nums, n, 20, 3))
                if candidates and len(nums) >= 37:
                    rc = Counter(x for x in nums[-37:] if x != 0)
                    return [max(candidates, key=lambda n: rc.get(n, 0))]
                return []
            return fn
        ps = backtest(recent, make(min_diff))
        r = analyze(ps, recent, f"trendDiff>={min_diff}")
        print(f"  trendDiff>={min_diff}: ROI={r['roi']:+.2f}% sig={r['sig']} net={r['net']:+.0f} cv={r['cv']:.2f} W/L={r['win_s']}/{r['lose_s']}")

    # ---- Test 3: Distance filter ----
    print(f"\n--- Distance since last appearance ---")
    for min_dist in [0, 1, 2, 3]:
        for max_dist in [999, 20, 30, 50]:
            def make(mi, ma):
                def fn(nums):
                    h37 = get_top_n(nums, 37, 6)
                    h74 = get_top_n(nums, 74, 6)
                    h111 = get_top_n(nums, 111, 6)
                    candidates = h37 & h74 & h111
                    candidates = set(n for n in candidates if is_trending_up(nums, n, 37))
                    candidates = set(n for n in candidates if not is_burst(nums, n, 20, 3))
                    candidates = set(n for n in candidates if mi <= last_appearance(nums, n) <= ma)
                    if candidates and len(nums) >= 37:
                        rc = Counter(x for x in nums[-37:] if x != 0)
                        return [max(candidates, key=lambda n: rc.get(n, 0))]
                    return []
                return fn
            ps = backtest(recent, make(min_dist, max_dist))
            r = analyze(ps, recent, f"dist∈[{min_dist},{max_dist}]")
            if r['roi'] > 12 or r['sig'] > 3000 and r['roi'] > 8:
                print(f"  dist∈[{min_dist},{max_dist}]: ROI={r['roi']:+.2f}% sig={r['sig']} net={r['net']:+.0f} cv={r['cv']:.2f} W/L={r['win_s']}/{r['lose_s']}")

    # ---- Test 4: Cross-entity boost ----
    print(f"\n--- Cross-entity: hot number in hot group ---")
    for use_group in [True, False]:
        def make(ug):
            def fn(nums):
                h37 = get_top_n(nums, 37, 6)
                h74 = get_top_n(nums, 74, 6)
                h111 = get_top_n(nums, 111, 6)
                candidates = h37 & h74 & h111
                candidates = set(n for n in candidates if is_trending_up(nums, n, 37))
                candidates = set(n for n in candidates if not is_burst(nums, n, 20, 3))
                if ug and len(nums) >= 20:
                    # Find hottest group in last 20
                    gc = Counter(get_group(x) for x in nums[-20:] if x != 0 and get_group(x) is not None)
                    if gc:
                        hot_g = gc.most_common(1)[0][0]
                        candidates = set(n for n in candidates if get_group(n) == hot_g)
                if candidates and len(nums) >= 37:
                    rc = Counter(x for x in nums[-37:] if x != 0)
                    return [max(candidates, key=lambda n: rc.get(n, 0))]
                return []
            return fn
        ps = backtest(recent, make(use_group))
        r = analyze(ps, recent, f"hotGroupBoost={use_group}")
        print(f"  hotGroupBoost={use_group}: ROI={r['roi']:+.2f}% sig={r['sig']} net={r['net']:+.0f} cv={r['cv']:.2f} W/L={r['win_s']}/{r['lose_s']}")

    # ---- Test 5: Signal strength → dynamic picks ----
    print(f"\n--- Dynamic picks based on signal strength ---")
    for min_consensus in [2, 3]:
        def make(mc):
            def fn(nums):
                h37 = get_top_n(nums, 37, 10)
                h74 = get_top_n(nums, 74, 10)
                h111 = get_top_n(nums, 111, 10)
                # Count consensus level per number
                all_nums = h37 | h74 | h111
                consensus = {}
                for n in all_nums:
                    c = (1 if n in h37 else 0) + (1 if n in h74 else 0) + (1 if n in h111 else 0)
                    if c >= mc:
                        consensus[n] = c
                candidates = set(consensus.keys())
                candidates = set(n for n in candidates if is_trending_up(nums, n, 37))
                candidates = set(n for n in candidates if not is_burst(nums, n, 20, 3))
                if candidates and len(nums) >= 37:
                    rc = Counter(x for x in nums[-37:] if x != 0)
                    best = max(candidates, key=lambda n: (consensus.get(n, 0), rc.get(n, 0)))
                    return [best]
                return []
            return fn
        ps = backtest(recent, make(min_consensus))
        r = analyze(ps, recent, f"consensus>={min_consensus}/3")
        print(f"  consensus>={min_consensus}/3: ROI={r['roi']:+.2f}% sig={r['sig']} net={r['net']:+.0f} cv={r['cv']:.2f}")

    # ---- Test 6: Anti-martingale ----
    print(f"\n--- Anti-martingale (double after win) ---")
    for max_mult in [1, 2, 3]:
        total_bet = 0; total_win = 0; mult = 1
        for sess in recent:
            nums = sess["numbers"]
            for i in range(50, len(nums)):
                picks = baseline(nums[:i])
                if not picks: continue
                unit = min(mult, max_mult)
                total_bet += unit
                if nums[i] == picks[0] and nums[i] != 0:
                    total_win += 36 * unit
                    mult = min(mult + 1, max_mult)  # increase after win
                else:
                    mult = 1  # reset after loss
        net = total_win - total_bet
        roi = net / total_bet * 100 if total_bet else 0
        print(f"  anti-martingale max={max_mult}: ROI={roi:+.2f}% net={net:+.0f}")

    # ---- Test 7: Combine best findings ----
    print(f"\n--- Combined optimization ---")
    def combined(nums):
        h37 = get_top_n(nums, 37, 8)
        h74 = get_top_n(nums, 74, 8)
        h111 = get_top_n(nums, 111, 8)
        candidates = h37 & h74 & h111
        # Stronger trend: second half must have at least 2 more
        candidates = set(n for n in candidates if (
            len(nums) >= 37 and
            sum(1 for i in range(len(nums)-19, len(nums)) if nums[i] == n) >=
            sum(1 for i in range(len(nums)-37, len(nums)-19) if nums[i] == n) + 2
        ))
        # Tighter burst
        candidates = set(n for n in candidates if not is_burst(nums, n, 18, 4))
        # Require not appeared in last 2 spins
        candidates = set(n for n in candidates if last_appearance(nums, n) >= 2)
        if candidates and len(nums) >= 37:
            rc = Counter(x for x in nums[-37:] if x != 0)
            return [max(candidates, key=lambda n: rc.get(n, 0))]
        return []
    ps = backtest(recent, combined)
    r = analyze(ps, recent, "COMBINED: trend≥2 + burst<4in18 + dist≥2")
    print(f"  COMBINED: ROI={r['roi']:+.2f}% sig={r['sig']} net={r['net']:+.0f} cv={r['cv']:.2f} top5={r['top5']:.0f}% dd={r['dd']:.0f} W/L={r['win_s']}/{r['lose_s']}")

    # Lighter version
    def combined2(nums):
        h37 = get_top_n(nums, 37, 6)
        h74 = get_top_n(nums, 74, 6)
        h111 = get_top_n(nums, 111, 6)
        candidates = h37 & h74 & h111
        candidates = set(n for n in candidates if is_trending_up(nums, n, 37))
        candidates = set(n for n in candidates if not is_burst(nums, n, 22, 4))
        if candidates and len(nums) >= 37:
            rc = Counter(x for x in nums[-37:] if x != 0)
            return [max(candidates, key=lambda n: rc.get(n, 0))]
        return []
    ps = backtest(recent, combined2)
    r = analyze(ps, recent, "COMBINED2: trend + burst<4in22")
    print(f"  COMBINED2: ROI={r['roi']:+.2f}% sig={r['sig']} net={r['net']:+.0f} cv={r['cv']:.2f} top5={r['top5']:.0f}% dd={r['dd']:.0f} W/L={r['win_s']}/{r['lose_s']}")


if __name__ == "__main__":
    main()
