"""
Hot Number Strategy — Distribution Analysis
=============================================
Check per-session P&L consistency, not just total ROI.
Find a strategy with EVEN distribution, not driven by outliers.

Author: DeepSeek (via Claude Code)
Date: 2026-06-04
"""

import json, math
from collections import Counter, defaultdict
from statistics import mean, stdev, median

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

def detailed_backtest(sessions, strategy_fn, max_n=3):
    """Returns per-session P&L AND per-signal results."""
    per_session = defaultdict(lambda: {"bet": 0, "win": 0, "signals": 0, "wins": 0})
    all_signals = []

    for sess in sessions:
        nums = sess["numbers"]
        sn = sess["name"]
        for i in range(50, len(nums)):
            hot = strategy_fn(nums[:i])
            if not hot: continue
            bets = list(hot)[:max_n]
            if not bets: continue
            bet = len(bets)
            per_session[sn]["bet"] += bet
            per_session[sn]["signals"] += 1
            won = nums[i] in bets and nums[i] != 0
            if won:
                per_session[sn]["win"] += 36
                per_session[sn]["wins"] += 1
            all_signals.append({"session": sn, "won": won, "bet": bet})

    return per_session, all_signals

def analyze_distribution(per_session, sessions, label):
    """Analyze how evenly distributed the P&L is."""
    pnls = []
    for sess in sessions:
        sn = sess["name"]
        ps = per_session.get(sn, {"bet": 0, "win": 0})
        net = ps["win"] - ps["bet"]
        pnls.append(net)

    total_net = sum(pnls)
    total_bet = sum(per_session[s["name"]]["bet"] for s in sessions)
    roi = total_net / total_bet * 100 if total_bet > 0 else 0

    win_sessions = sum(1 for p in pnls if p > 0)
    lose_sessions = sum(1 for p in pnls if p < 0)
    flat_sessions = sum(1 for p in pnls if p == 0)

    # Top 5 sessions' contribution
    sorted_pnls = sorted(pnls, reverse=True)
    top5_pnl = sum(sorted_pnls[:5])
    top5_pct = top5_pnl / total_net * 100 if total_net > 0 else 0

    bottom5_pnl = sum(sorted_pnls[-5:])
    bottom5_pct = abs(bottom5_pnl) / abs(total_net) * 100 if total_net != 0 else 0

    # Gini-like: what % of sessions contribute 80% of profit?
    positive_pnls = sorted([p for p in pnls if p > 0], reverse=True)
    cum = 0
    sessions_for_80pct = 0
    for p in positive_pnls:
        cum += p
        sessions_for_80pct += 1
        if cum >= total_net * 0.8: break

    # Worst drawdown sequence
    cum_pnl = 0; peak = 0; max_dd = 0
    worst_dd_start = 0; worst_dd_end = 0
    for i, p in enumerate(pnls):
        cum_pnl += p
        if cum_pnl > peak:
            peak = cum_pnl
        dd = peak - cum_pnl
        if dd > max_dd:
            max_dd = dd

    # Std of per-session P&L
    pnl_std = stdev(pnls) if len(pnls) > 1 else 0
    pnl_mean = mean(pnls)
    cv = pnl_std / abs(pnl_mean) if pnl_mean != 0 else 999  # coefficient of variation

    print(f"\n  {label}")
    print(f"    ROI={roi:+.2f}%  net={total_net:+.0f}  sessions={len(pnls)}")
    print(f"    win={win_sessions} lose={lose_sessions} flat={flat_sessions}")
    print(f"    per-session avg={pnl_mean:+.1f} std={pnl_std:.1f} CV={cv:.2f}")
    print(f"    top5={top5_pnl:+.0f} ({top5_pct:.0f}%)  bottom5={bottom5_pnl:+.0f} ({bottom5_pct:.0f}%)")
    print(f"    sessions for 80% profit: {sessions_for_80pct}/{len(positive_pnls)}")
    print(f"    max session DD: {max_dd:.0f}")

    # Bucket analysis
    bucket_size = 5
    buckets = defaultdict(lambda: {"net": 0, "count": 0})
    for i, p in enumerate(pnls):
        bucket = i // bucket_size
        buckets[bucket]["net"] += p
        buckets[bucket]["count"] += 1

    neg_buckets = sum(1 for b in buckets.values() if b["net"] < 0)
    print(f"    negative {bucket_size}-session buckets: {neg_buckets}/{len(buckets)}")

    return {"roi": roi, "net": total_net, "cv": cv, "top5_pct": top5_pct,
            "max_dd": max_dd, "win_sessions": win_sessions, "lose_sessions": lose_sessions,
            "neg_buckets": neg_buckets, "total_buckets": len(buckets), "signals": total_bet}


def main():
    path = "HistoryData/wzs-merged.json"
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    recent = sessions[-72:]
    print(f"{len(recent)} sessions for distribution analysis")

    all_results = []

    # ---- Test multiple burst parameters with distribution analysis ----
    configs = [
        # (burst_window, burst_threshold, label)
        (12, 3, "burst<3 in 12"),
        (16, 3, "burst<3 in 16"),
        (18, 3, "burst<3 in 18"),
        (20, 3, "burst<3 in 20"),
        (20, 4, "burst<4 in 20"),
        (18, 4, "burst<4 in 18"),
        (16, 4, "burst<4 in 16"),
        (14, 3, "burst<3 in 14"),
        (14, 4, "burst<4 in 14"),
        (10, 2, "burst<2 in 10"),
        (10, 3, "burst<3 in 10"),
        (8, 2, "burst<2 in 8"),
        (8, 3, "burst<3 in 8"),
    ]

    for bw, bt, label in configs:
        def make_strategy(BW, BT):
            def strategy(nums):
                h37 = get_hot(nums, 37, 6)
                h74 = get_hot(nums, 74, 6)
                h111 = get_hot(nums, 111, 6)
                all_hot = h37 & h74 & h111
                trending = get_trending_up(nums, 37, 6)
                candidates = all_hot & trending
                if len(nums) >= BW:
                    burst = set(num for num, cnt in Counter(nums[-BW:]).items() if cnt >= BT)
                    candidates -= burst
                if len(nums) >= 37:
                    rc = Counter(x for x in nums[-37:] if x != 0)
                    ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
                    return set(num for num, _ in ranked[:3])
                return set(list(candidates)[:3])
            return strategy

        per_sess, signals = detailed_backtest(recent, make_strategy(bw, bt))
        r = analyze_distribution(per_sess, recent, label)
        r["label"] = label
        r["params"] = (bw, bt)
        all_results.append(r)

    # ---- Also test: without burst filter (baseline consensus only) ----
    def no_burst(nums):
        h37 = get_hot(nums, 37, 6)
        h74 = get_hot(nums, 74, 6)
        h111 = get_hot(nums, 111, 6)
        all_hot = h37 & h74 & h111
        trending = get_trending_up(nums, 37, 6)
        candidates = all_hot & trending
        if len(nums) >= 37:
            rc = Counter(x for x in nums[-37:] if x != 0)
            ranked = sorted([(num, rc.get(num,0)) for num in candidates], key=lambda x: -x[1])
            return set(num for num, _ in ranked[:3])
        return set(list(candidates)[:3])

    per_sess, signals = detailed_backtest(recent, no_burst)
    r = analyze_distribution(per_sess, recent, "NO burst filter")
    r["label"] = "NO burst filter"
    all_results.append(r)

    # ---- Also: consensus-only, no trending ----
    def consensus_only(nums):
        h37 = get_hot(nums, 37, 6)
        h74 = get_hot(nums, 74, 6)
        h111 = get_hot(nums, 111, 6)
        all_hot = h37 & h74 & h111
        if len(nums) >= 37:
            rc = Counter(x for x in nums[-37:] if x != 0)
            ranked = sorted([(num, rc.get(num,0)) for num in all_hot], key=lambda x: -x[1])
            return set(num for num, _ in ranked[:3])
        return set(list(all_hot)[:3])

    per_sess, signals = detailed_backtest(recent, consensus_only)
    r = analyze_distribution(per_sess, recent, "consensus only (no trend)")
    r["label"] = "consensus only"
    all_results.append(r)

    # ---- Ranking by distribution quality ----
    print(f"\n{'='*70}")
    print(f" RANKING — lower CV + higher ROI = better distribution")
    print(f"{'='*70}")
    print(f"  {'Strategy':<25s} {'ROI':>7s} {'CV':>6s} {'top5%':>7s} {'DD':>6s} {'W/L':>7s} {'negBkt':>7s}")
    print(f"  {'-'*65}")
    all_results.sort(key=lambda x: (x['roi'] - x['cv'] * 2), reverse=True)
    for r in all_results:
        print(f"  {r['label']:<25s} {r['roi']:>+6.2f}% {r['cv']:>6.2f} {r['top5_pct']:>6.0f}% {r['max_dd']:>6.0f} {r['win_sessions']:>2d}/{r['lose_sessions']:<2d} {r['neg_buckets']:>3d}/{r['total_buckets']}")


if __name__ == "__main__":
    main()
