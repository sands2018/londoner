"""
Hot Number + Wheel Neighbors Research
======================================
Tests: pick the hot number (via existing LONG 148-accel algorithm),
then bet on the hot number + its physical wheel neighbors.

European single-zero wheel order (clockwise):
0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26

Bet sizes:
- 3-number: hot number ± 1 neighbor each side = 3 numbers
- 5-number: hot number ± 2 neighbors each side = 5 numbers

Author: DeepSeek (via Claude Code)
Date: 2026-06-05
"""

import json
from collections import Counter, defaultdict
from statistics import stdev, mean

# European single-zero wheel
WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
         5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]

def build_wheel_neighbors(radius=2):
    """Build lookup: number -> set of its wheel neighbors (±radius)."""
    neighbors = {}
    n = len(WHEEL)
    for i, num in enumerate(WHEEL):
        nb = set()
        for r in range(1, radius + 1):
            nb.add(WHEEL[(i - r) % n])
            nb.add(WHEEL[(i + r) % n])
        neighbors[num] = nb
    return neighbors

NEIGHBORS_1 = build_wheel_neighbors(1)  # ±1 = 3 numbers total
NEIGHBORS_2 = build_wheel_neighbors(2)  # ±2 = 5 numbers total

def load_sessions(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return [{"name": e.get("Name", "?"),
             "numbers": [int(x.strip()) for x in e["Numbers"].split(",") if x.strip()]
             if isinstance(e.get("Numbers", ""), str) else e.get("Numbers", [])}
            for e in data if e.get("Numbers")]

def count_in_window(arr, num, w):
    s = max(0, len(arr) - w)
    return sum(1 for i in range(s, len(arr)) if arr[i] == num)

def get_top_n(arr, w, n):
    if len(arr) < w: return []
    s = max(0, len(arr) - w); c = Counter()
    for i in range(s, len(arr)):
        if arr[i] != 0: c[arr[i]] += 1
    sn = sorted(c.items(), key=lambda x: (-x[1], x[0]))
    if len(sn) <= n: return [num for num, _ in sn]
    return [num for num, _ in sn[:n]]

def select_hot(nums):
    """LONG 148-accel algorithm (same as hotNumbers.ts)."""
    if len(nums) < 148: return None
    s = len(nums) - 148
    top10 = get_top_n(nums, 148, 10)
    best = None; bc = 0; bd = 0
    for n in top10:
        seg1 = sum(1 for i in range(s, s + 49) if nums[i] == n)
        seg2 = sum(1 for i in range(s + 49, s + 98) if nums[i] == n)
        seg3 = sum(1 for i in range(s + 98, len(nums)) if nums[i] == n)
        if not (seg3 > seg2 > seg1): continue
        if count_in_window(nums, n, 20) >= 4: continue
        cnt = count_in_window(nums, n, 74); diff = seg3 - seg1
        if cnt > bc or (cnt == bc and diff > bd):
            best = n; bc = cnt; bd = diff
    return best

def backtest(sessions, bet_size, warmup=148):
    """
    bet_size: 1 = single number, 3 = hot ±1 neighbor, 5 = hot ±2 neighbors
    """
    neighbors_map = {3: NEIGHBORS_1, 5: NEIGHBORS_2, 1: {}}
    nb = neighbors_map[bet_size]

    per_session = defaultdict(lambda: {"bet": 0, "win": 0, "s": 0, "w": 0})
    for sess in sessions:
        nums = sess["numbers"]; sn = sess["name"]
        for i in range(warmup, len(nums)):
            hot = select_hot(nums[:i])
            if hot is None: continue
            bets = {hot} | (nb.get(hot, set()))
            bet_amt = len(bets)
            per_session[sn]["bet"] += bet_amt
            per_session[sn]["s"] += 1
            if nums[i] in bets and nums[i] != 0:
                per_session[sn]["win"] += 36  # straight-up pays 35:1
                per_session[sn]["w"] += 1
    return per_session

def analyze(ps, sessions, label):
    pnls = [ps.get(s["name"], {"bet": 0, "win": 0})["win"] -
            ps.get(s["name"], {"bet": 0, "win": 0})["bet"] for s in sessions]
    tn = sum(pnls)
    tb = sum(ps[s["name"]]["bet"] for s in sessions)
    ts = sum(ps[s["name"]]["s"] for s in sessions)
    tw = sum(ps[s["name"]]["w"] for s in sessions)
    roi = tn / tb * 100 if tb else 0
    wr = tw / ts * 100 if ts else 0
    ws = sum(1 for p in pnls if p > 0); ls = sum(1 for p in pnls if p < 0)
    sp = sorted(pnls, reverse=True)
    t3 = sum(sp[:3]); t5 = sum(sp[:5])
    t3p = t3 / tn * 100 if tn > 0 else 0
    t5p = t5 / tn * 100 if tn > 0 else 0
    cum = 0; peak = 0; dd = 0
    for p in pnls: cum += p; peak = max(peak, cum); dd = max(dd, peak - cum)
    cv = stdev(pnls) / abs(mean(pnls)) if mean(pnls) != 0 else 999
    avg_bet = tb / ts if ts else 0
    print(f"  {label}: sig={ts} hit={tw} bet={tb} net={tn:+.0f} ROI={roi:+.2f}% "
          f"wr={wr:.2f}% cv={cv:.2f} t3={t3p:.0f}% t5={t5p:.0f}% dd={dd:.0f} W/L={ws}/{ls} avgBet={avg_bet:.1f}")
    return roi

def main():
    sessions = load_sessions("history_data.json")
    print(f"{len(sessions)} sessions")

    for bet_size in [1, 3, 5]:
        print(f"\n--- Bet {bet_size} number(s) ---")
        ps = backtest(sessions, bet_size)
        analyze(ps, sessions, f"bet{bet_size}")

    # Also test on short sessions only (< 300 spins)
    short = [s for s in sessions if len(s["numbers"]) < 300]
    print(f"\n--- Short sessions only ({len(short)} sessions, <300 spins) ---")
    for bet_size in [1, 3, 5]:
        ps = backtest(short, bet_size)
        analyze(ps, short, f"bet{bet_size} short")

    # Long sessions only (>= 300 spins)
    long_s = [s for s in sessions if len(s["numbers"]) >= 300]
    print(f"\n--- Long sessions only ({len(long_s)} sessions, >=300 spins) ---")
    for bet_size in [1, 3, 5]:
        ps = backtest(long_s, bet_size)
        analyze(ps, long_s, f"bet{bet_size} long")

    # ROI per unit bet (normalize for comparison)
    print(f"\n--- ROI per unit bet ---")
    for bet_size in [1, 3, 5]:
        ps = backtest(sessions, bet_size)
        tb = sum(ps[s["name"]]["bet"] for s in sessions)
        tw = sum(ps[s["name"]]["win"] for s in sessions)
        # Normalize: each bet is bet_size units
        normalized_bet = tb / bet_size  # number of "betting opportunities"
        normalized_win = tw  # win amount doesn't change per bet
        norm_roi = (normalized_win - tb) / tb * 100 if tb else 0
        print(f"  bet{bet_size}: raw ROI per unit = {norm_roi:+.2f}%")


if __name__ == "__main__":
    main()
