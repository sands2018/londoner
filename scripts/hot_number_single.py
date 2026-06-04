"""
Hot Number — Single Pick Test
===============================
Bet just the #1 hottest number passing all filters.
Higher variance but potentially better payoff structure.

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

def get_hot(nums, window, n):
    if len(nums) < window: return set()
    counts = Counter(x for x in nums[-window:] if x != 0)
    sorted_nums = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    if len(sorted_nums) <= n: return set(num for num, _ in sorted_nums)
    cutoff = sorted_nums[n-1][1]
    return set(num for num, cnt in sorted_nums if cnt >= cutoff)

def get_trending_up(nums, window, n):
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

def detailed_backtest(sessions, strategy_fn, pick_n):
    per_session = defaultdict(lambda: {"bet": 0, "win": 0, "signals": 0, "wins": 0})
    for sess in sessions:
        nums = sess["numbers"]
        sn = sess["name"]
        for i in range(50, len(nums)):
            hot = strategy_fn(nums[:i])
            if not hot: continue
            bets = list(hot)[:pick_n]
            if not bets: continue
            bet = len(bets)
            per_session[sn]["bet"] += bet
            per_session[sn]["signals"] += 1
            won = nums[i] in bets and nums[i] != 0
            if won:
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
    total_win = sum(per_session[s["name"]]["win"] for s in sessions)
    roi = total_net / total_bet * 100 if total_bet > 0 else 0
    wr = sum(per_session[s["name"]]["wins"] for s in sessions) / total_sig * 100 if total_sig else 0

    win_s = sum(1 for p in pnls if p > 0)
    lose_s = sum(1 for p in pnls if p < 0)
    flat_s = sum(1 for p in pnls if p == 0)

    sorted_pnls = sorted(pnls, reverse=True)
    top5 = sum(sorted_pnls[:5])
    top5_pct = top5 / total_net * 100 if total_net > 0 else 0
    bot5 = sum(sorted_pnls[-5:])

    cum = 0; peak = 0; dd = 0
    for p in pnls:
        cum += p
        if cum > peak: peak = cum
        dd = max(dd, peak - cum)

    cv = stdev(pnls) / abs(mean(pnls)) if mean(pnls) != 0 else 999

    # Negative 5-session buckets
    buckets = defaultdict(lambda: {"net": 0})
    for i, p in enumerate(pnls):
        buckets[i//5]["net"] += p
    neg_buckets = sum(1 for b in buckets.values() if b["net"] < 0)

    print(f"  {label}")
    print(f"    ROI={roi:+.2f}%  net={total_net:+.0f}  sig={total_sig}  wr={wr:.2f}%")
    print(f"    sessions W/L/F: {win_s}/{lose_s}/{flat_s}  top5={top5_pct:.0f}%  DD={dd:.0f}  CV={cv:.2f}")
    print(f"    neg 5-sess buckets: {neg_buckets}/{len(buckets)}")
    return {"roi": roi, "net": total_net, "cv": cv, "top5_pct": top5_pct, "dd": dd,
            "win_s": win_s, "lose_s": lose_s, "neg": neg_buckets, "total_b": len(buckets),
            "sig": total_sig, "wr": wr}


def main():
    path = "HistoryData/wzs-merged.json"
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    recent = sessions[-72:]
    print(f"{len(recent)} sessions\n")

    all_r = []

    # Baseline: pick 1 vs 3, no burst
    for pick_n in [1, 2, 3]:
        def strategy(nums, PN=pick_n):
            h37 = get_hot(nums, 37, PN*3)
            h74 = get_hot(nums, 74, PN*3)
            h111 = get_hot(nums, 111, PN*3)
            all_hot = h37 & h74 & h111
            trending = get_trending_up(nums, 37, PN*3)
            candidates = all_hot & trending
            if len(nums) >= 37:
                rc = Counter(x for x in nums[-37:] if x != 0)
                ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                return set(num for num, _ in ranked[:PN])
            return set(list(candidates)[:PN])
        per_sess = detailed_backtest(recent, strategy, pick_n)
        r = analyze(per_sess, recent, f"combo pick={pick_n} (no burst)")
        all_r.append(r)

    # With burst filter, pick 1 vs 2
    for pick_n in [1, 2]:
        for bw, bt in [(12,3), (16,3), (20,3), (20,4), (18,4), (16,4)]:
            def strategy(nums, PN=pick_n, BW=bw, BT=bt):
                h37 = get_hot(nums, 37, PN*3)
                h74 = get_hot(nums, 74, PN*3)
                h111 = get_hot(nums, 111, PN*3)
                all_hot = h37 & h74 & h111
                trending = get_trending_up(nums, 37, PN*3)
                candidates = all_hot & trending
                if len(nums) >= BW:
                    burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                    candidates -= burst
                if len(nums) >= 37:
                    rc = Counter(x for x in nums[-37:] if x != 0)
                    ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                    return set(num for num, _ in ranked[:PN])
                return set(list(candidates)[:PN])
            per_sess = detailed_backtest(recent, strategy, pick_n)
            r = analyze(per_sess, recent, f"combo pick={pick_n} burst<{bt}in{bw}")
            all_r.append(r)

    # Also: just single hottest in all 3 windows (simplest strategy)
    for pick_n in [1, 2, 3]:
        def strategy(nums, PN=pick_n):
            h37 = get_hot(nums, 37, PN*3)
            h74 = get_hot(nums, 74, PN*3)
            h111 = get_hot(nums, 111, PN*3)
            all_hot = h37 & h74 & h111
            if len(nums) >= 37:
                rc = Counter(x for x in nums[-37:] if x != 0)
                ranked = sorted([(num, rc.get(num,0)) for num in all_hot], key=lambda x: -x[1])
                return set(num for num, _ in ranked[:PN])
            return set(list(all_hot)[:PN])
        per_sess = detailed_backtest(recent, strategy, pick_n)
        r = analyze(per_sess, recent, f"consensus-only pick={pick_n}")
        all_r.append(r)

    # Ranking
    print(f"\n{'='*70}")
    print(f" RANKING (by ROI then CV)")
    print(f"{'='*70}")
    print(f"  {'Strategy':<35s} {'ROI':>7s} {'CV':>6s} {'top5%':>6s} {'DD':>6s} {'W/L':>7s} {'neg':>5s} {'sig':>6s}")
    print(f"  {'-'*70}")
    all_r.sort(key=lambda x: (x['roi'] - x['cv']*1.5), reverse=True)
    for r in all_r[:20]:
        print(f"  {r['name']:<35s} {r['roi']:>+6.2f}% {r['cv']:>6.2f} {r['top5_pct']:>5.0f}% {r['dd']:>6.0f} {r['win_s']:>2d}/{r['lose_s']:<2d} {r['neg']:>3d}/{r['total_b']} {r['sig']:>6d}")


if __name__ == "__main__":
    main()
