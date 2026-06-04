"""
Hot Number Betting Strategy Research
=====================================
Can we use the identified hot numbers to place profitable bets?

Tests:
1. Bet top N hot numbers flat (1 unit each, straight-up)
2. Only bet trending-up hot numbers
3. Vary window size (1圈/2圈/3圈/5圈)
4. Bet with progression after losses
5. Combine: hot in multiple windows simultaneously
6. Cold → hot transition (numbers just entering hot list)

Author: DeepSeek (via Claude Code)
Date: 2026-06-04
"""

import json
from collections import defaultdict, Counter
from statistics import mean, stdev
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


def get_hot_numbers(numbers, window_size, n=5):
    """Get the n hottest numbers in the last window_size spins."""
    if len(numbers) < window_size:
        return set()
    recent = numbers[-window_size:]
    counts = Counter(x for x in recent if x != 0)  # exclude 0 for now
    # Get top n with tie-breaking
    sorted_nums = sorted(counts.items(), key=lambda x: (-x[1], x[0]))
    if len(sorted_nums) <= n:
        return set(num for num, _ in sorted_nums)
    cutoff_count = sorted_nums[n-1][1]
    return set(num for num, cnt in sorted_nums if cnt >= cutoff_count)


def get_trending_up(numbers, window_size, n=5):
    """Get hot numbers that are trending up (more in 2nd half than 1st half)."""
    if len(numbers) < window_size:
        return set()
    start = len(numbers) - window_size
    mid = start + window_size // 2
    first_half = Counter(x for x in numbers[start:mid] if x != 0)
    second_half = Counter(x for x in numbers[mid:] if x != 0)
    all_nums = set(list(first_half.keys()) + list(second_half.keys()))
    trending = []
    for num in all_nums:
        diff = second_half.get(num, 0) - first_half.get(num, 0)
        total = first_half.get(num, 0) + second_half.get(num, 0)
        if total > 0 and diff > 0:
            trending.append((num, total, diff))
    trending.sort(key=lambda x: (-x[1], -x[2]))
    # Take top n by total count among trending-up
    if len(trending) <= n:
        return set(t[0] for t in trending)
    cutoff = trending[n-1][1]
    return set(t[0] for t in trending if t[1] >= cutoff)


def get_cold_to_hot(numbers, window_size, prev_window_size, n=5):
    """Numbers that were cold (not in top 10) in prev window but hot now."""
    if len(numbers) < window_size + prev_window_size:
        return set()
    curr_start = len(numbers) - window_size
    prev_start = curr_start - prev_window_size

    prev_counts = Counter(x for x in numbers[prev_start:curr_start] if x != 0)
    curr_counts = Counter(x for x in numbers[curr_start:] if x != 0)

    # Top 10 in previous window
    prev_sorted = sorted(prev_counts.items(), key=lambda x: -x[1])
    prev_top10 = set(num for num, _ in prev_sorted[:10])

    # Current hot numbers (top N)
    curr_sorted = sorted(curr_counts.items(), key=lambda x: -x[1])
    if not curr_sorted:
        return set()
    cutoff = curr_sorted[min(n-1, len(curr_sorted)-1)][1]
    curr_hot = set(num for num, cnt in curr_sorted if cnt >= cutoff)

    # Cold→hot: hot now but wasn't top 10 before
    return curr_hot - prev_top10


def backtest_hot_numbers(sessions, strategy_fn, bet_per_number=1, max_numbers=5):
    """
    Run backtest: at each spin (after warmup), get hot numbers via strategy_fn,
    bet 1 unit on each, track P&L.
    """
    results = []
    total_bet = 0
    total_win = 0

    for sess in sessions:
        nums = sess["numbers"]
        for i in range(50, len(nums)):  # warmup: first 50 spins
            hot = strategy_fn(nums[:i])
            if not hot:
                continue
            bets = list(hot)[:max_numbers]
            bet_amount = len(bets) * bet_per_number
            total_bet += bet_amount
            next_num = nums[i]
            if next_num in bets and next_num != 0:
                total_win += 36 * bet_per_number  # 35:1 + return
            results.append({
                "session": sess["name"],
                "spin": i,
                "bets": len(bets),
                "won": next_num in bets,
                "next_num": next_num,
            })

    net = total_win - total_bet
    roi = net / total_bet * 100 if total_bet > 0 else 0
    wr = sum(1 for r in results if r["won"]) / len(results) * 100 if results else 0
    return {"signals": len(results), "total_bet": total_bet, "total_win": total_win,
            "net": net, "roi": roi, "win_rate": wr}


def backtest_with_progression(sessions, strategy_fn, progression, max_numbers=5):
    """
    Progression betting: after a loss, move to next level. After a win, reset.
    """
    results = []
    total_bet = 0
    total_win = 0
    prog_level = 0
    conseq_losses = 0

    for sess in sessions:
        nums = sess["numbers"]
        for i in range(50, len(nums)):
            hot = strategy_fn(nums[:i])
            if not hot:
                continue
            bets = list(hot)[:max_numbers]
            unit = progression[min(prog_level, len(progression)-1)]
            bet_amount = len(bets) * unit
            total_bet += bet_amount
            next_num = nums[i]
            if next_num in bets and next_num != 0:
                total_win += 36 * unit
                prog_level = 0
                conseq_losses = 0
                results.append({"won": True, "unit": unit, "bets": len(bets)})
            else:
                prog_level += 1
                conseq_losses += 1
                results.append({"won": False, "unit": unit, "bets": len(bets)})

    net = total_win - total_bet
    roi = net / total_bet * 100 if total_bet > 0 else 0
    return {"signals": len(results), "total_bet": total_bet, "total_win": total_win,
            "net": net, "roi": roi}


def main():
    path = "HistoryData/wzs-merged.json"
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    print(f"{len(sessions)} sessions")

    # Focus on recent 72 for speed
    recent = sessions[-72:]
    print(f"Testing on recent {len(recent)} sessions")

    # ---- Test 1: Basic hot number betting ----
    print(f"\n{'='*60}")
    print(f" TEST 1: Bet top N hot numbers (flat 1 unit)")
    print(f"{'='*60}")

    for n in [3, 5, 7]:
        for window in [37, 74, 111, 185]:
            def strategy(nums, w=window, N=n):
                return get_hot_numbers(nums, w, N)
            r = backtest_hot_numbers(recent, strategy, max_numbers=n)
            print(f"  top{n} @ {window//37}圈: ROI={r['roi']:+.2f}% sig={r['signals']} "
                  f"net={r['net']:+.0f} wr={r['win_rate']:.2f}%")

    # ---- Test 2: Hot + trending up ----
    print(f"\n{'='*60}")
    print(f" TEST 2: Bet trending-up hot numbers only")
    print(f"{'='*60}")

    for n in [3, 5]:
        for window in [37, 74, 111]:
            def strategy(nums, w=window, N=n):
                return get_trending_up(nums, w, N)
            r = backtest_hot_numbers(recent, strategy, max_numbers=n)
            print(f"  trend↑ top{n} @ {window//37}圈: ROI={r['roi']:+.2f}% sig={r['signals']} "
                  f"net={r['net']:+.0f} wr={r['win_rate']:.2f}%")

    # ---- Test 3: Cold → Hot transition ----
    print(f"\n{'='*60}")
    print(f" TEST 3: Cold→Hot transition numbers")
    print(f"{'='*60}")

    for n in [3, 5]:
        for curr_win in [37, 74]:
            prev_win = curr_win
            def strategy(nums, cw=curr_win, pw=prev_win, N=n):
                return get_cold_to_hot(nums, cw, pw, N)
            r = backtest_hot_numbers(recent, strategy, max_numbers=n)
            print(f"  cold→hot top{n} @ {curr_win//37}圈: ROI={r['roi']:+.2f}% sig={r['signals']} "
                  f"net={r['net']:+.0f} wr={r['win_rate']:.2f}%")

    # ---- Test 4: Multi-window consensus ----
    print(f"\n{'='*60}")
    print(f" TEST 4: Hot in multiple windows simultaneously")
    print(f"{'='*60}")

    for n in [3, 5]:
        def strategy(nums, N=n):
            h37 = get_hot_numbers(nums, 37, N)
            h74 = get_hot_numbers(nums, 74, N)
            h111 = get_hot_numbers(nums, 111, N)
            # Must be hot in ALL windows
            return h37 & h74 & h111
        r = backtest_hot_numbers(recent, strategy, max_numbers=n)
        print(f"  top{n} hot in 1,2,3圈: ROI={r['roi']:+.2f}% sig={r['signals']} "
              f"net={r['net']:+.0f} wr={r['win_rate']:.2f}%")

        def strategy2(nums, N=n):
            h37 = get_hot_numbers(nums, 37, N)
            h74 = get_hot_numbers(nums, 74, N)
            # Hot in 2 of 3 windows (1圈, 2圈, 3圈)
            h111 = get_hot_numbers(nums, 111, N)
            combined = h37 | h74 | h111
            counts = Counter()
            for num in combined:
                if num in h37: counts[num] += 1
                if num in h74: counts[num] += 1
                if num in h111: counts[num] += 1
            return set(num for num, cnt in counts.items() if cnt >= 2)
        r = backtest_hot_numbers(recent, strategy2, max_numbers=n)
        print(f"  top{n} hot in >=2 of 3 windows: ROI={r['roi']:+.2f}% sig={r['signals']} "
              f"net={r['net']:+.0f} wr={r['win_rate']:.2f}%")

    # ---- Test 5: Progression betting ----
    print(f"\n{'='*60}")
    print(f" TEST 5: With progression on best strategy")
    print(f"{'='*60}")

    # Use best strategy from above
    for prog_name, prog in [("1-1-2", [1,1,2]), ("1-2-4", [1,2,4]), ("1-1-1-2", [1,1,1,2])]:
        def strategy(nums):
            return get_trending_up(nums, 37, 3)
        r = backtest_with_progression(recent, strategy, prog, max_numbers=3)
        print(f"  trend↑ top3 @1圈 {prog_name}: ROI={r['roi']:+.2f}% sig={r['signals']} "
              f"net={r['net']:+.0f}")

    # ---- Test 6: Hot number frequency analysis ----
    print(f"\n{'='*60}")
    print(f" TEST 6: Do hot numbers hit more than expected?")
    print(f"{'='*60}")

    # Expected hit rate for N random numbers: N/37
    for n in [3, 5]:
        for window in [37, 74]:
            def strategy(nums, w=window, N=n):
                return get_hot_numbers(nums, w, N)

            hit_count = 0
            total_bets = 0
            for sess in recent:
                nums = sess["numbers"]
                for i in range(50, len(nums)):
                    hot = strategy(nums[:i])
                    if not hot:
                        continue
                    bets = list(hot)[:n]
                    total_bets += 1
                    if nums[i] in bets:
                        hit_count += 1

            actual_rate = hit_count / total_bets * 100 if total_bets > 0 else 0
            expected_rate = n / 37 * 100
            print(f"  top{n} @ {window//37}圈: actual={actual_rate:.2f}% vs expected={expected_rate:.2f}% "
                  f"({actual_rate-expected_rate:+.2f}% edge)")

    # ---- Test 8: Filter out short-term burst numbers ----
    print(f"\n{'='*60}")
    print(f" TEST 8: Exclude numbers with 3+ hits in recent short window")
    print(f"{'='*60}")

    for n in [3, 5]:
        for hot_window in [37, 74]:
            for burst_window in [8, 12, 15, 20]:
                for burst_threshold in [2, 3]:
                    def strategy(nums, hw=hot_window, bw=burst_window, bt=burst_threshold, N=n):
                        hot = get_hot_numbers(nums, hw, N)
                        if len(nums) < bw:
                            return hot
                        recent_short = nums[-bw:]
                        counts = Counter(x for x in recent_short if x != 0)
                        burst = set(num for num, cnt in counts.items() if cnt >= bt)
                        return hot - burst  # exclude burst numbers
                    r = backtest_hot_numbers(recent, strategy, max_numbers=n)
                    if r['roi'] > -1:  # only show non-terrible results
                        label = f"top{n} @ {hot_window//37}圈, exclude>={burst_threshold} in {burst_window}"
                        print(f"  {label}: ROI={r['roi']:+.2f}% sig={r['signals']} net={r['net']:+.0f} wr={r['win_rate']:.2f}%")

    # ---- Test 9: Best combo — trending-up + multi-window + burst filter ----
    print(f"\n{'='*60}")
    print(f" TEST 9: Combined: trending-up + multi-window + burst filter")
    print(f"{'='*60}")

    for n in [3, 5]:
        def strategy(nums, N=n):
            # Hot in all 3 windows
            h37 = get_hot_numbers(nums, 37, N*2)  # wider pool
            h74 = get_hot_numbers(nums, 74, N*2)
            h111 = get_hot_numbers(nums, 111, N*2)
            all_hot = h37 & h74 & h111
            # Only trending-up among those
            trending = get_trending_up(nums, 37, N*2)
            candidates = all_hot & trending
            # Exclude burst (3+ in last 12)
            if len(nums) >= 12:
                burst = set(num for num, cnt in Counter(nums[-12:]).items() if cnt >= 3)
                candidates = candidates - burst
            # Take top N by 1圈 count
            if len(nums) >= 37:
                recent_counts = Counter(x for x in nums[-37:] if x != 0)
                ranked = sorted([(num, recent_counts.get(num,0)) for num in candidates],
                               key=lambda x: -x[1])
                return set(num for num, _ in ranked[:N])
            return set(list(candidates)[:N])
        r = backtest_hot_numbers(recent, strategy, max_numbers=n)
        print(f"  combo top{n}: ROI={r['roi']:+.2f}% sig={r['signals']} "
              f"net={r['net']:+.0f} wr={r['win_rate']:.2f}%")

    # ---- Test 7: Hot in current row/group ----
    print(f"\n{'='*60}")
    print(f" TEST 7: Hot numbers that are also in current hot group")
    print(f"{'='*60}")

    def get_row(n): return None if n==0 else (2 if n%3==1 else (1 if n%3==2 else 0))
    def get_group(n): return None if n==0 else (n-1)//12

    for window in [37, 74]:
        def strategy(nums, w=window):
            hot5 = get_hot_numbers(nums, w, 5)
            if not nums: return set()
            # Recent 10: which group is hottest?
            recent10 = nums[-min(10, len(nums)):]
            group_counts = Counter(get_group(x) for x in recent10 if x != 0)
            if not group_counts: return set()
            hottest_group = group_counts.most_common(1)[0][0]
            # Hot numbers that belong to the hottest group
            return set(n for n in hot5 if get_group(n) == hottest_group)
        r = backtest_hot_numbers(recent, strategy, max_numbers=5)
        print(f"  hot5 in hottest group @ {window//37}圈: ROI={r['roi']:+.2f}% sig={r['signals']} "
              f"net={r['net']:+.0f} wr={r['win_rate']:.2f}%")


if __name__ == "__main__":
    main()
