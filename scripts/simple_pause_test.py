"""
Simple test: Fixed skip=2 + pause after N consecutive losses
=============================================================
Rule: skip=2 entry, [1,2,4], but pause after N consecutive losses for M spins.
Variants to test:
- N=1,2,3 consecutive losses → pause M=5,10,15,20 spins
- Also test: pause after ANY loss (not just consecutive)
- Also test: pause when recent win rate drops below threshold

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json
from collections import defaultdict
from statistics import mean
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

def get_row(n: int) -> Optional[int]:
    if n == 0: return None
    rem = n % 3
    if rem == 1: return 2
    if rem == 2: return 1
    return 0

def get_group(n: int) -> Optional[int]:
    if n == 0: return None
    return (n - 1) // 12


def run_pause_strategy(sessions, mapper, target_id, entity_label,
                        max_consec_loss=2, pause_spins=10,
                        min_history=12):
    """
    Fixed skip=2, [1,2,4], but pause after max_consec_loss consecutive losses.
    During pause, skip all entry opportunities.
    """
    signals = []
    consec_losses = 0
    paused_until_spin = {}  # session_name -> spin_idx where pause ends
    skipped_opps = 0

    for sess in sessions:
        nums = sess["numbers"]
        gaps = []
        prev_hit = -1
        nz_idx = 0
        in_bet = False
        bet_round = 0

        # Reset per-session pause tracking
        pause_end = 0  # spin index after which we can bet again

        for si, n in enumerate(nums):
            if n == 0:
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        signals.append({"won": False, "net": -7, "session": sess["name"],
                                       "spin": si, "paused": si < pause_end})
                        consec_losses += 1
                        if consec_losses >= max_consec_loss:
                            pause_end = si + pause_spins
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            if in_bet:
                if is_target:
                    net = 2 if bet_round == 0 else (3 if bet_round == 1 else 5)
                    signals.append({"won": True, "net": net, "session": sess["name"],
                                   "spin": si, "paused": False})
                    consec_losses = 0  # reset on win
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        signals.append({"won": False, "net": -7, "session": sess["name"],
                                       "spin": si, "paused": si < pause_end})
                        consec_losses += 1
                        if consec_losses >= max_consec_loss:
                            pause_end = si + pause_spins
                        in_bet = False

            if is_target:
                if prev_hit >= 0:
                    gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1

            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

            if not in_bet and cs == 2 and len(gaps) >= min_history:
                if si >= pause_end:
                    in_bet = True
                    bet_round = 0
                else:
                    skipped_opps += 1

    return signals, skipped_opps


def run_sliding_window_pause(sessions, mapper, target_id, entity_label,
                              window=10, min_win_rate=0.3,
                              min_history=12):
    """
    Alternative: pause when recent win rate drops below threshold.
    Uses sliding window of last N skip=2 outcomes.
    """
    signals = []
    recent_outcomes = []  # list of bool (True=win)
    skipped_opps = 0

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
                        signals.append({"won": False, "net": -7, "session": sess["name"],
                                       "spin": si, "recent_wr": 0})
                        recent_outcomes.append(False)
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            if in_bet:
                if is_target:
                    net = 2 if bet_round == 0 else (3 if bet_round == 1 else 5)
                    signals.append({"won": True, "net": net, "session": sess["name"],
                                   "spin": si, "recent_wr": 0})
                    recent_outcomes.append(True)
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        signals.append({"won": False, "net": -7, "session": sess["name"],
                                       "spin": si, "recent_wr": 0})
                        recent_outcomes.append(False)
                        in_bet = False

            if is_target:
                if prev_hit >= 0:
                    gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1

            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

            if not in_bet and cs == 2 and len(gaps) >= min_history:
                # Check recent win rate
                recent = recent_outcomes[-window:] if len(recent_outcomes) >= window else recent_outcomes
                wr = sum(recent) / len(recent) if recent else 1.0

                if wr >= min_win_rate:
                    in_bet = True
                    bet_round = 0
                else:
                    skipped_opps += 1

    return signals, skipped_opps


def analyze(name, signals, skipped, sessions):
    if not signals:
        print(f"  {name}: 0 signals")
        return None

    total_bet = len(signals) * 7
    total_net = sum(s["net"] for s in signals)
    roi = total_net / total_bet * 100
    wins = sum(1 for s in signals if s["won"])
    losses = sum(1 for s in signals if not s["won"])
    wr = wins / len(signals) * 100

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

    # Consecutive losses
    max_cl = 0; curr_cl = 0
    for s in signals:
        if not s["won"]:
            curr_cl += 1
            max_cl = max(max_cl, curr_cl)
        else:
            curr_cl = 0

    # Yearly
    yr_stats = defaultdict(lambda: {"s": 0, "net": 0})
    for s in signals:
        yr = s["session"][:4] if s["session"][:4].isdigit() else s["session"][:8]
        yr_stats[yr]["s"] += 1
        yr_stats[yr]["net"] += s["net"]

    # Recent 30
    recent30_names = {sess["name"] for sess in sessions[-30:]}
    r30_sigs = [s for s in signals if s["session"] in recent30_names]
    r30_bet = len(r30_sigs) * 7
    r30_net = sum(s["net"] for s in r30_sigs)
    r30_roi = r30_net / r30_bet * 100 if r30_bet > 0 else 0

    print(f"  {name}")
    print(f"    sig={len(signals)} win%={wr:.1f}% ROI={roi:+.2f}% net={total_net:+.0f} "
          f"DD={max_dd:.0f} maxCL={max_cl} skip={skipped} "
          f"ws={win_sess} ls={lose_sess} r30ROI={r30_roi:+.2f}%")

    return {"name": name, "signals": len(signals), "roi": roi, "net": total_net,
            "wr": wr, "max_dd": max_dd, "max_cl": max_cl, "skipped": skipped,
            "win_sess": win_sess, "lose_sess": lose_sess, "r30_roi": r30_roi}


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

        # Baseline (no pause)
        sigs, _ = run_pause_strategy(sessions, mapper, target_id, elabel,
                                      max_consec_loss=999, pause_spins=0)
        r = analyze(f"BASELINE (no pause)", sigs, 0, sessions)
        if r: all_results.append(r)

        # Test N=1,2,3 and M=5,10,15,20
        for n in [1, 2, 3]:
            for m in [5, 10, 15, 20]:
                sigs, skipped = run_pause_strategy(sessions, mapper, target_id, elabel,
                                                    max_consec_loss=n, pause_spins=m)
                r = analyze(f"pause after {n}L for {m}s", sigs, skipped, sessions)
                if r: all_results.append(r)

        # Test: pause after ANY loss (N=1) for various durations
        for m in [3, 5, 8, 10, 12, 15]:
            sigs, skipped = run_pause_strategy(sessions, mapper, target_id, elabel,
                                                max_consec_loss=1, pause_spins=m)
            r = analyze(f"pause after ANY loss {m}s", sigs, skipped, sessions)
            if r: all_results.append(r)

        # Sliding window variants
        for window in [5, 8, 10, 15]:
            for min_wr in [0.2, 0.3, 0.4, 0.5]:
                sigs, skipped = run_sliding_window_pause(
                    sessions, mapper, target_id, elabel,
                    window=window, min_win_rate=min_wr)
                r = analyze(f"WR>{min_wr} in last{window}", sigs, skipped, sessions)
                if r and r["signals"] >= 50:
                    all_results.append(r)

    # ============================================================
    # Combined portfolio: best pause rule per entity
    # ============================================================
    print(f"\n{'='*60}")
    print(f" COMBINED (best pause rule per entity)")
    print(f"{'='*60}")

    combined_sigs = []
    for mapper, target_id, elabel in [
        (get_row, 0, "1行"),
        (get_row, 2, "3行"),
        (get_group, 0, "一组"),
    ]:
        # Best found: pause after 2 consecutive losses for 10 spins
        sigs, skipped = run_pause_strategy(sessions, mapper, target_id, elabel,
                                            max_consec_loss=2, pause_spins=10)
        combined_sigs.extend(sigs)

    analyze("COMBINED pause=2L/10s", combined_sigs, 0, sessions)

    # ============================================================
    # RANKING
    # ============================================================
    print(f"\n{'='*60}")
    print(f" TOP 25 (by ROI)")
    print(f"{'='*60}")
    all_results.sort(key=lambda x: x["roi"], reverse=True)
    for i, r in enumerate(all_results[:25]):
        print(f"  {i+1:2d}. {r['name']:<45s} ROI={r['roi']:+.2f}% sig={r['signals']:>5d} "
              f"net={r['net']:+.0f} wr={r['wr']:.1f}% DD={r['max_dd']:.0f} CL={r['max_cl']} "
              f"r30={r['r30_roi']:+.2f}% skip={r['skipped']}")

    # Best per entity
    print(f"\n{'='*60}")
    print(f" BEST PER ENTITY")
    print(f"{'='*60}")
    for elabel in ["1行", "3行", "一组"]:
        entity_results = [r for r in all_results if elabel in r["name"]]
        entity_results.sort(key=lambda x: x["roi"], reverse=True)
        if entity_results:
            best = entity_results[0]
            print(f"  {elabel}: {best['name']} → ROI={best['roi']:+.2f}% "
                  f"sig={best['signals']} net={best['net']:+.0f} r30={best['r30_roi']:+.2f}%")


if __name__ == "__main__":
    main()
