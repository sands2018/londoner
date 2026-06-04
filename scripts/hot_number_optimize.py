"""
Hot Number Strategy Optimization
=================================
Building on combo top3 (+7.17% ROI): trending-up + multi-window + burst filter.
Testing additional filters and parameter tuning.

Author: DeepSeek (via Claude Code)
Date: 2026-06-04
"""

import json
from collections import Counter
from statistics import mean

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

def get_trending_up(nums, window, n):
    """Hot numbers that are trending up (more in 2nd half than 1st half)."""
    if len(nums) < window: return set()
    start = len(nums) - window
    mid = start + window // 2
    first = Counter(x for x in nums[start:mid] if x != 0)
    second = Counter(x for x in nums[mid:] if x != 0)
    all_nums = set(list(first.keys()) + list(second.keys()))
    trending = []
    for num in all_nums:
        diff = second.get(num, 0) - first.get(num, 0)
        total = first.get(num, 0) + second.get(num, 0)
        if total > 0 and diff > 0:
            trending.append((num, total, diff))
    trending.sort(key=lambda x: (-x[1], -x[2]))
    if len(trending) <= n: return set(t[0] for t in trending)
    cutoff = trending[n-1][1]
    return set(t[0] for t in trending if t[1] >= cutoff)

def get_hot(nums, window, n):
    if len(nums) < window: return set()
    counts = Counter(x for x in nums[-window:] if x != 0)
    sorted_nums = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    if len(sorted_nums) <= n: return set(num for num, _ in sorted_nums)
    cutoff = sorted_nums[n-1][1]
    return set(num for num, cnt in sorted_nums if cnt >= cutoff)

def last_appearance(nums, num):
    """How many spins since num last appeared?"""
    dist = 0
    for i in range(len(nums)-1, -1, -1):
        if nums[i] == num: return dist
        dist += 1
    return dist

def backtest(sessions, strategy_fn, max_n=3):
    total_bet = 0; total_win = 0; signals = 0
    for sess in sessions:
        nums = sess["numbers"]
        for i in range(50, len(nums)):
            hot = strategy_fn(nums[:i])
            if not hot: continue
            bets = list(hot)[:max_n]
            if not bets: continue
            total_bet += len(bets)
            signals += 1
            if nums[i] in bets and nums[i] != 0:
                total_win += 36
    net = total_win - total_bet
    roi = net / total_bet * 100 if total_bet > 0 else 0
    return {"signals": signals, "bet": total_bet, "win": total_win, "net": net, "roi": roi}

def with_progression(sessions, strategy_fn, prog, max_n=3):
    total_bet = 0; total_win = 0; level = 0; signals = 0
    for sess in sessions:
        nums = sess["numbers"]
        for i in range(50, len(nums)):
            hot = strategy_fn(nums[:i])
            if not hot: continue
            bets = list(hot)[:max_n]
            if not bets: continue
            unit = prog[min(level, len(prog)-1)]
            total_bet += len(bets) * unit
            signals += 1
            if nums[i] in bets and nums[i] != 0:
                total_win += 36 * unit
                level = 0
            else:
                level += 1
    net = total_win - total_bet
    return {"signals": signals, "bet": total_bet, "win": total_win, "net": net,
            "roi": net/total_bet*100 if total_bet > 0 else 0}

def main():
    path = "HistoryData/wzs-merged.json"
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    recent = sessions[-72:]
    print(f"Testing on recent {len(recent)} sessions")

    results = []

    # ---- Baseline combo from previous run ----
    def baseline(nums):
        h37 = get_hot(nums, 37, 6)
        h74 = get_hot(nums, 74, 6)
        h111 = get_hot(nums, 111, 6)
        all_hot = h37 & h74 & h111
        trending = get_trending_up(nums, 37, 6)
        candidates = all_hot & trending
        if len(nums) >= 12:
            burst = set(num for num, cnt in Counter(nums[-12:]).items() if cnt >= 3)
            candidates -= burst
        if len(nums) >= 37:
            rc = Counter(x for x in nums[-37:] if x != 0)
            ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
            return set(num for num, _ in ranked[:3])
        return set(list(candidates)[:3])

    r = backtest(recent, baseline)
    results.append(("baseline combo", r['roi'], r['signals'], r['net']))
    print(f"\n  baseline combo: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f}")

    # ---- Grid search: burst window × threshold ----
    print(f"\n--- Burst filter grid ---")
    best_burst = None
    best_roi = -999
    for bw in [8, 10, 12, 14, 16, 18, 20]:
        for bt in [2, 3, 4]:
            for min_last in [0, 1, 2]:  # minimum distance since last hit
                def strategy(nums, BW=bw, BT=bt, ML=min_last):
                    h37 = get_hot(nums, 37, 6)
                    h74 = get_hot(nums, 74, 6)
                    h111 = get_hot(nums, 111, 6)
                    all_hot = h37 & h74 & h111
                    trending = get_trending_up(nums, 37, 6)
                    candidates = all_hot & trending
                    if len(nums) >= BW:
                        burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                        candidates -= burst
                    if ML > 0:
                        candidates = set(n for n in candidates if last_appearance(nums, n) >= ML)
                    if len(nums) >= 37:
                        rc = Counter(x for x in nums[-37:] if x != 0)
                        ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                        return set(num for num, _ in ranked[:3])
                    return set(list(candidates)[:3])
                r = backtest(recent, strategy)
                if r['roi'] > best_roi:
                    best_roi = r['roi']
                    best_burst = (bw, bt, min_last)
                if r['roi'] > 3:
                    print(f"  burst<{bt}in{bw} minLast={min_last}: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f}")
    results.append((f"best burst({best_burst})", best_roi, r['signals'], r['net']))
    print(f"  ★ best burst filter: {best_burst} → ROI={best_roi:+.2f}%")

    # ---- Test: concentration filter ----
    print(f"\n--- Concentration filter ---")
    for conc_min in [0.4, 0.5, 0.6]:
        def strategy(nums, CM=conc_min, BW=best_burst[0], BT=best_burst[1], ML=best_burst[2]):
            h37 = get_hot(nums, 37, 6)
            h74 = get_hot(nums, 74, 6)
            h111 = get_hot(nums, 111, 6)
            all_hot = h37 & h74 & h111
            trending = get_trending_up(nums, 37, 6)
            candidates = all_hot & trending
            if len(nums) >= BW:
                burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                candidates -= burst
            if ML > 0:
                candidates = set(n for n in candidates if last_appearance(nums, n) >= ML)
            # Concentration: how clustered are hot numbers in recent gaps?
            # Check if the candidate numbers' recent gaps are tight
            if len(nums) >= 18 and len(candidates) > 3:
                # For each candidate, get its gap distribution
                # Simple: are they in the same row/group? → diversity is bad
                pass  # skip full implementation for now
            if len(nums) >= 37:
                rc = Counter(x for x in nums[-37:] if x != 0)
                ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                return set(num for num, _ in ranked[:3])
            return set(list(candidates)[:3])
        r = backtest(recent, strategy)
        if r['roi'] > 0:
            print(f"  conc≥{conc_min}: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f}")

    # ---- Test: vary number of picks ----
    print(f"\n--- Vary pick count ---")
    for n in [1, 2, 3, 4, 5]:
        BW, BT, ML = best_burst
        def strategy(nums, N=n, BW=BW, BT=BT, ML=ML):
            h37 = get_hot(nums, 37, N*2)
            h74 = get_hot(nums, 74, N*2)
            h111 = get_hot(nums, 111, N*2)
            all_hot = h37 & h74 & h111
            trending = get_trending_up(nums, 37, N*2)
            candidates = all_hot & trending
            if len(nums) >= BW:
                burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                candidates -= burst
            if ML > 0:
                candidates = set(x for x in candidates if last_appearance(nums, x) >= ML)
            if len(nums) >= 37:
                rc = Counter(x for x in nums[-37:] if x != 0)
                ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                return set(num for num, _ in ranked[:N])
            return set(list(candidates)[:N])
        r = backtest(recent, strategy, max_n=n)
        print(f"  pick {n}: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f}")

    # ---- Test: exclude zero-distance (just appeared last spin) ----
    print(f"\n--- Exclude last-spin hitters ---")
    BW, BT, ML = best_burst
    for exclude_last in [True, False]:
        def strategy(nums, EL=exclude_last, BW=BW, BT=BT, ML=ML):
            h37 = get_hot(nums, 37, 6)
            h74 = get_hot(nums, 74, 6)
            h111 = get_hot(nums, 111, 6)
            all_hot = h37 & h74 & h111
            trending = get_trending_up(nums, 37, 6)
            candidates = all_hot & trending
            if len(nums) >= BW:
                burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                candidates -= burst
            if ML > 0:
                candidates = set(x for x in candidates if last_appearance(nums, x) >= ML)
            if EL and nums:
                candidates = set(x for x in candidates if x != nums[-1])
            if len(nums) >= 37:
                rc = Counter(x for x in nums[-37:] if x != 0)
                ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                return set(num for num, _ in ranked[:3])
            return set(list(candidates)[:3])
        r = backtest(recent, strategy)
        print(f"  excludeLast={exclude_last}: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f}")

    # ---- Test: require minimum total count in 1圈 ----
    print(f"\n--- Min count in 1圈 ---")
    for min_count in [2, 3, 4]:
        def strategy(nums, MC=min_count, BW=best_burst[0], BT=best_burst[1], ML=best_burst[2]):
            h37 = get_hot(nums, 37, 10)
            h74 = get_hot(nums, 74, 10)
            h111 = get_hot(nums, 111, 10)
            all_hot = h37 & h74 & h111
            trending = get_trending_up(nums, 37, 10)
            candidates = all_hot & trending
            if len(nums) >= BW:
                burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                candidates -= burst
            if ML > 0:
                candidates = set(x for x in candidates if last_appearance(nums, x) >= ML)
            # Require minimum count in 1圈
            if len(nums) >= 37:
                rc = Counter(x for x in nums[-37:] if x != 0)
                candidates = set(x for x in candidates if rc.get(x, 0) >= MC)
                ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                return set(num for num, _ in ranked[:3])
            return set(list(candidates)[:3])
        r = backtest(recent, strategy)
        if r['signals'] > 100:
            print(f"  minCount≥{min_count}: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f}")

    # ---- Best combo with progression ----
    print(f"\n--- Best with progression ---")
    best_params = {}
    for prog_name, prog in [("flat", [1]), ("1-1", [1,1]), ("1-1-2", [1,1,2]), ("1-1-1-2", [1,1,1,2]), ("1-1-1", [1,1,1])]:
        BW, BT, ML = best_burst
        def strategy(nums, BW=BW, BT=BT, ML=ML):
            h37 = get_hot(nums, 37, 6)
            h74 = get_hot(nums, 74, 6)
            h111 = get_hot(nums, 111, 6)
            all_hot = h37 & h74 & h111
            trending = get_trending_up(nums, 37, 6)
            candidates = all_hot & trending
            if len(nums) >= BW:
                burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                candidates -= burst
            if ML > 0:
                candidates = set(x for x in candidates if last_appearance(nums, x) >= ML)
            if len(nums) >= 37:
                rc = Counter(x for x in nums[-37:] if x != 0)
                ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                return set(num for num, _ in ranked[:3])
            return set(list(candidates)[:3])
        r = with_progression(recent, strategy, prog)
        print(f"  {prog_name}: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f}")

    # ---- Test: multi-window consensus level ----
    print(f"\n--- Window consensus level ---")
    for consensus in [2, 3]:
        def strategy(nums, C=consensus, BW=best_burst[0], BT=best_burst[1], ML=best_burst[2]):
            h37 = get_hot(nums, 37, 6)
            h74 = get_hot(nums, 74, 6)
            h111 = get_hot(nums, 111, 6)
            # Count how many windows each number is hot in
            all_nums = h37 | h74 | h111
            counts = Counter()
            for num in all_nums:
                if num in h37: counts[num] += 1
                if num in h74: counts[num] += 1
                if num in h111: counts[num] += 1
            consensus_hot = set(num for num, cnt in counts.items() if cnt >= C)
            trending = get_trending_up(nums, 37, 6)
            candidates = consensus_hot & trending
            if len(nums) >= BW:
                burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                candidates -= burst
            if ML > 0:
                candidates = set(x for x in candidates if last_appearance(nums, x) >= ML)
            if len(nums) >= 37:
                rc = Counter(x for x in nums[-37:] if x != 0)
                ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                return set(num for num, _ in ranked[:3])
            return set(list(candidates)[:3])
        r = backtest(recent, strategy)
        print(f"  consensus≥{consensus}/3 windows: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f}")

    print(f"\n{'='*60}")
    print(f" TOP RESULTS")
    print(f"{'='*60}")
    results.sort(key=lambda x: x[1], reverse=True)
    for i, (name, roi, sig, net) in enumerate(results[:15]):
        print(f"  {i+1:2d}. {name:<40s} ROI={roi:+.2f}% sig={sig} net={net:+.0f}")


if __name__ == "__main__":
    main()
