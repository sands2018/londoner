"""
Streak Entry Analysis — Predict when a hot streak is STARTING
==============================================================
Core question: What market conditions precede a winning streak
(consecutive 124 wins) vs an immediate failure?

Approach:
1. Walk through every session spin-by-spin
2. At every skip=2 for each row, record: would 124 have won or lost?
3. Define "streak": N consecutive successful 124 attempts from skip=2
4. Analyze features AT THE START of streaks vs standalone wins vs losses
5. Build a simple entry predictor based on LEADING indicators

Key distinction from previous analysis:
- NOT filtering to fewer signals
- INSTEAD: ranking signals by "streak potential" at entry time
- Goal: catch streak starts, skip likely-to-fail entries

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json
import math
from collections import defaultdict
from statistics import mean, stdev, variance as pvar, median
from typing import List, Dict, Tuple, Optional

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

ROW_LABELS = {0: "1行", 1: "2行", 2: "3行"}
GRP_LABELS = {0: "一组", 1: "二组", 2: "三组"}

# ============================================================
# Step 1: Map EVERY skip=2 opportunity and its outcome
# ============================================================

class Opp:
    """A single 124 betting opportunity at skip=2."""
    def __init__(self):
        self.session_name = ""
        self.spin_idx = 0
        self.entity_type = ""  # "row" or "group"
        self.entity_id = 0
        # Outcome: which round it hit (0/1/2) or -1 for miss
        self.hit_round = -1
        self.net_profit = 0
        # Gap stats at entry time
        self.gap_mean_6 = 0.0
        self.gap_mean_12 = 0.0
        self.gap_mean_18 = 0.0
        self.gap_mean_24 = 0.0
        self.gap_var_6 = 0.0
        self.gap_var_12 = 0.0
        # Trend features
        self.gap_trend_6v12 = 0.0  # mean(last 6) - mean(prior 6)
        self.gap_trend_12v24 = 0.0  # mean(last 12) - mean(prior 12)
        self.gap_velocity = 0.0  # (m6 - m12) / m12
        self.gap_acceleration = 0.0  # velocity change
        # Distribution features
        self.target_rate_18 = 0.0  # gap 2-4 proportion
        self.gap0_rate_18 = 0.0  # gap=0 proportion (consecutive hits)
        self.gap5p_rate_18 = 0.0  # gap>=5 proportion (long droughts)
        # Current state
        self.current_skip = 0
        self.gaps_since_last_hit = 0
        # Sequence features (last 6 gaps raw)
        self.last_6_gaps = []
        self.last_3_gaps = []
        # Gap compression indicator
        self.gap_compression = 0.0  # how much gaps are shrinking
        # "Ice break": first short gap after cold period
        self.ice_break = False
        self.cold_streak_len = 0
        # Opposite-side heat
        self.opposite_hit_rate = 0.0  # other rows' recent hit rate
        # Recent success
        self.recent_win_rate = 0.0  # last 5 bets' win rate
        self.streak_position = 0  # 0=first bet after a loss, 1=first repeat, etc.


def compute_all_opportunities(sessions, mapper, target_id, entity_type, entity_label):
    """
    Walk through every session and record EVERY skip=2 opportunity
    with its outcome and all features at entry time.
    """
    opportunities = []

    for sess in sessions:
        nums = sess["numbers"]
        gaps = []  # gap sequence (distance between consecutive hits)
        prev_hit = -1
        nz_idx = 0

        # Track "betting outcomes" for streak detection
        # We simulate: every time skip reaches 2, record what would happen
        # A "bet" starts when we'd enter and runs for 3 spins (bet 1,2,4)
        in_bet = False
        bet_round = 0
        bet_total = 0

        for si, n in enumerate(nums):
            if n == 0:
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            # Resolve active bet
            if in_bet:
                if is_target:
                    # Win!
                    opp = Opp()
                    opp.session_name = sess["name"]
                    opp.spin_idx = si
                    opp.entity_type = entity_type
                    opp.entity_id = target_id
                    opp.hit_round = bet_round
                    if bet_round == 0:
                        opp.net_profit = 2  # bet 1, win 3, profit 2
                    elif bet_round == 1:
                        opp.net_profit = 1  # bet 1+2=3, win 6, profit 3
                    else:
                        opp.net_profit = 1  # bet 1+2+4=7, win 12, profit 5
                    # Fill features
                    _fill_features(opp, gaps)
                    opportunities.append(opp)
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        # Loss
                        opp = Opp()
                        opp.session_name = sess["name"]
                        opp.spin_idx = si
                        opp.entity_type = entity_type
                        opp.entity_id = target_id
                        opp.hit_round = -1
                        opp.net_profit = -7  # lost 1+2+4
                        _fill_features(opp, gaps)
                        opportunities.append(opp)
                        in_bet = False

            # Update gap tracking
            if is_target:
                if prev_hit >= 0:
                    gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1

            # Check entry: skip=2
            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx
            if not in_bet and cs == 2 and len(gaps) >= 12:
                in_bet = True
                bet_round = 0
                bet_total = 0

    # Mark streak positions
    for i, opp in enumerate(opportunities):
        if i == 0 or opportunities[i-1].hit_round < 0:
            opp.streak_position = 0  # first bet after a loss = start of new attempt
        else:
            opp.streak_position = opportunities[i-1].streak_position + 1

    return opportunities


def _fill_features(opp: Opp, gaps: list):
    """Fill all features from gap history."""
    if len(gaps) < 6:
        return

    # Basic means
    g6 = gaps[-6:]
    g12 = gaps[-12:] if len(gaps) >= 12 else gaps
    g18 = gaps[-18:] if len(gaps) >= 18 else gaps
    g24 = gaps[-24:] if len(gaps) >= 24 else gaps

    opp.gap_mean_6 = mean(g6)
    opp.gap_mean_12 = mean(g12)
    opp.gap_mean_18 = mean(g18)
    opp.gap_mean_24 = mean(g24)

    # Variances
    opp.gap_var_6 = pvar(g6) if len(g6) >= 3 else 0
    opp.gap_var_12 = pvar(g12) if len(g12) >= 3 else 0

    # Trends
    prior6 = gaps[-12:-6] if len(gaps) >= 12 else gaps[:-6] if len(gaps) > 6 else g6
    prior12 = gaps[-24:-12] if len(gaps) >= 24 else gaps[:-12] if len(gaps) > 12 else g12
    opp.gap_trend_6v12 = mean(g6) - mean(prior6) if prior6 else 0
    opp.gap_trend_12v24 = mean(g12) - mean(prior12) if prior12 else 0
    opp.gap_velocity = (mean(g6) - mean(prior6)) / mean(prior6) if prior6 and mean(prior6) != 0 else 0

    # Acceleration: change in velocity
    older6 = gaps[-18:-12] if len(gaps) >= 18 else gaps[:-12] if len(gaps) > 12 else g6
    if prior6 and older6 and mean(older6) != 0 and mean(prior6) != 0:
        old_vel = (mean(prior6) - mean(older6)) / mean(older6)
        opp.gap_acceleration = opp.gap_velocity - old_vel
    else:
        opp.gap_acceleration = 0

    # Distribution
    opp.target_rate_18 = sum(1 for g in g18 if 2 <= g <= 4) / len(g18)
    opp.gap0_rate_18 = sum(1 for g in g18 if g == 0) / len(g18)
    opp.gap5p_rate_18 = sum(1 for g in g18 if g >= 5) / len(g18)

    # Sequence
    opp.last_6_gaps = list(g6)
    opp.last_3_gaps = list(gaps[-3:]) if len(gaps) >= 3 else list(g6)

    # Compression: are gaps getting progressively shorter?
    if len(g6) >= 3:
        # Count how many consecutive decreases
        dec = 0
        for j in range(len(g6)-1, 0, -1):
            if g6[j] <= g6[j-1]:
                dec += 1
            else:
                break
        opp.gap_compression = dec / max(1, len(g6)-1)

    # Ice break: first short gap (0 or 1) after cold period
    if len(gaps) >= 8:
        recent8 = gaps[-8:]
        cold_count = 0
        for g in recent8[:-1]:  # first 7
            if g >= 3:
                cold_count += 1
        opp.cold_streak_len = cold_count
        opp.ice_break = (cold_count >= 4 and recent8[-1] <= 1)


def analyze_streaks(opportunities, label=""):
    """
    Analyze what features predict streak starts vs failures.

    Streak levels:
    - "fail": first bet after a loss, and it loses (streak never starts)
    - "win1": first bet after a loss, wins, but next bet doesn't exist or loses
    - "streak2+": first bet of a streak that lasts >=2 wins
    - "streak3+": first bet of a streak that lasts >=3 wins
    """
    # Classify each opportunity
    fails = []
    win1_only = []
    streak2_start = []
    streak3_start = []
    streak4_start = []
    mid_streak = []

    i = 0
    while i < len(opportunities):
        opp = opportunities[i]
        if opp.streak_position == 0:
            # First bet after a loss
            if opp.hit_round < 0:
                fails.append(opp)
                i += 1
            else:
                # Won. How many more wins follow consecutively?
                streak_len = 1
                j = i + 1
                while j < len(opportunities) and opportunities[j].streak_position > 0:
                    if opportunities[j].streak_position == opportunities[j-1].streak_position + 1:
                        if opportunities[j].hit_round >= 0:
                            streak_len += 1
                            j += 1
                        else:
                            break
                    else:
                        break

                if streak_len >= 4:
                    streak4_start.append(opp)
                    streak3_start.append(opp)
                    streak2_start.append(opp)
                    # Mid-streak
                    for k in range(i+1, j):
                        mid_streak.append(opportunities[k])
                elif streak_len >= 3:
                    streak3_start.append(opp)
                    streak2_start.append(opp)
                    for k in range(i+1, j):
                        mid_streak.append(opportunities[k])
                elif streak_len >= 2:
                    streak2_start.append(opp)
                    for k in range(i+1, j):
                        mid_streak.append(opportunities[k])
                else:
                    win1_only.append(opp)
                i = j
        else:
            i += 1

    print(f"\n{'='*60}")
    print(f"  STREAK ANALYSIS: {label}")
    print(f"{'='*60}")
    print(f"  Total opportunities: {len(opportunities)}")
    print(f"  Immediate failures: {len(fails)} ({len(fails)/len(opportunities)*100:.1f}%)")
    print(f"  Single wins: {len(win1_only)} ({len(win1_only)/len(opportunities)*100:.1f}%)")
    print(f"  Streak >=2: {len(streak2_start)} starts ({len(streak2_start)/len(opportunities)*100:.1f}%)")
    print(f"  Streak >=3: {len(streak3_start)} starts ({len(streak3_start)/len(opportunities)*100:.1f}%)")
    print(f"  Streak >=4: {len(streak4_start)} starts ({len(streak4_start)/len(opportunities)*100:.1f}%)")

    # Compare features: streak starts vs failures
    _compare_groups(
        [("Immediate Fail", fails),
         ("Single Win", win1_only),
         ("Streak >=2", streak2_start),
         ("Streak >=3", streak3_start),
         ("Streak >=4", streak4_start)],
        label
    )

    # Also compare: pre-streak features vs pre-fail features
    print(f"\n  --- STREAK ENTRY PREDICTORS ---")
    _rank_features(fails, streak2_start, streak3_start)

    return {
        "fails": fails,
        "win1": win1_only,
        "streak2": streak2_start,
        "streak3": streak3_start,
        "streak4": streak4_start,
        "mid_streak": mid_streak,
    }


def _compare_groups(groups, label):
    """Compare feature means across groups."""
    features = [
        ("gap_mean_6", "6gap均值"),
        ("gap_mean_18", "18gap均值"),
        ("gap_var_6", "6gap方差"),
        ("gap_var_12", "12gap方差"),
        ("gap_velocity", "Gap速度"),
        ("gap_acceleration", "Gap加速度"),
        ("gap_trend_6v12", "趋势(6v12)"),
        ("gap_trend_12v24", "趋势(12v24)"),
        ("target_rate_18", "2-4占比"),
        ("gap0_rate_18", "连击率(gap=0)"),
        ("gap5p_rate_18", "长间隔率(gap≥5)"),
        ("gap_compression", "压缩度"),
        ("cold_streak_len", "冷期长度"),
    ]

    print(f"\n  --- Feature Comparison ---")
    header = f"  {'Feature':<22s}"
    for gname, _ in groups:
        if gname == "Single Win":
            continue  # skip for clarity
        header += f" {gname:>12s}"
    print(header)
    print(f"  {'-'*70}")

    for attr, attr_name in features:
        line = f"  {attr_name:<22s}"
        for gname, g in groups:
            if gname == "Single Win":
                continue
            vals = [getattr(opp, attr) for opp in g if getattr(opp, attr) is not None]
            if vals:
                line += f" {mean(vals):>12.3f}"
            else:
                line += f" {'N/A':>12s}"
        print(line)

    # Ice break rate
    line = f"  {'Ice Break率':<22s}"
    for gname, g in groups:
        if gname == "Single Win":
            continue
        rate = sum(1 for opp in g if opp.ice_break) / len(g) * 100 if g else 0
        line += f" {rate:>11.1f}%"
    print(line)


def _rank_features(fails, streak2, streak3):
    """Rank features by their ability to separate streak starts from failures."""
    features = [
        ("gap_mean_6", "6gap均值"),
        ("gap_mean_18", "18gap均值"),
        ("gap_var_6", "6gap方差"),
        ("gap_var_12", "12gap方差"),
        ("gap_velocity", "Gap速度"),
        ("gap_acceleration", "Gap加速度"),
        ("gap_trend_6v12", "趋势(6v12)"),
        ("gap_trend_12v24", "趋势(12v24)"),
        ("target_rate_18", "2-4占比"),
        ("gap0_rate_18", "连击率"),
        ("gap5p_rate_18", "长间隔率"),
        ("gap_compression", "压缩度"),
    ]

    scores = []
    for attr, name in features:
        fail_vals = [getattr(opp, attr) for opp in fails if getattr(opp, attr) is not None]
        s2_vals = [getattr(opp, attr) for opp in streak2 if getattr(opp, attr) is not None]
        s3_vals = [getattr(opp, attr) for opp in streak3 if getattr(opp, attr) is not None]

        if not fail_vals or not s2_vals:
            continue

        m_fail = mean(fail_vals)
        m_s2 = mean(s2_vals)
        m_s3 = mean(s3_vals) if s3_vals else m_s2

        # Pooled std
        all_vals = fail_vals + s2_vals
        pooled_std = stdev(all_vals) if len(all_vals) > 1 else 1

        # Separation: how many stds apart
        sep_s2 = abs(m_s2 - m_fail) / pooled_std if pooled_std > 0 else 0
        sep_s3 = abs(m_s3 - m_fail) / pooled_std if pooled_std > 0 else 0

        # Direction: is streak higher or lower?
        direction_s2 = "HIGHER" if m_s2 > m_fail else "LOWER"

        scores.append({
            "name": name,
            "attr": attr,
            "sep_s2": sep_s2,
            "sep_s3": sep_s3,
            "direction": direction_s2,
            "fail_mean": m_fail,
            "s2_mean": m_s2,
        })

    scores.sort(key=lambda x: x["sep_s2"], reverse=True)

    print(f"  {'Feature':<20s} {'Dir':>6s} {'Fail':>8s} {'Strk2':>8s} {'SepS2':>6s} {'SepS3':>6s}")
    print(f"  {'-'*58}")
    for s in scores[:12]:
        print(f"  {s['name']:<20s} {s['direction']:>6s} {s['fail_mean']:>8.3f} {s['s2_mean']:>8.3f} {s['sep_s2']:>6.3f} {s['sep_s3']:>6.3f}")


# ============================================================
# Step 2: Predict streak starts
# ============================================================

class EntrySignal:
    """A simple composite entry signal."""
    def __init__(self, features, weights):
        self.score = 0
        for feat, weight in weights.items():
            self.score += features.get(feat, 0) * weight


def build_simple_predictor(opportunities, label=""):
    """
    Build a simple scoring system based on feature separation.
    Score = weighted sum of normalized features.
    High score = more likely to start a streak.
    """
    # Use the features with best separation
    # Based on the rank_features output, we'll see which features matter

    # For now, test a few candidate scoring rules
    # Each rule: [feature] in [range] → score += weight

    print(f"\n{'='*60}")
    print(f"  PREDICTOR BACKTEST: {label}")
    print(f"{'='*60}")

    # Group opportunities into (session, spin) ordered list
    # For each streak-start opportunity, compute a score
    # Then see: does higher score → higher streak probability?

    candidates = []
    for opp in opportunities:
        if opp.streak_position != 0:
            continue  # only evaluate first bet after loss

        # Score based on simple rules
        score = 0

        # Rule 1: Gap velocity negative (contracting) → good
        if opp.gap_velocity < -0.1:
            score += 2
        elif opp.gap_velocity < 0:
            score += 1
        elif opp.gap_velocity > 0.2:
            score -= 1

        # Rule 2: Gap acceleration negative (contracting faster)
        if opp.gap_acceleration < -0.05:
            score += 2
        elif opp.gap_acceleration < 0:
            score += 1

        # Rule 3: Not too many long gaps
        if opp.gap5p_rate_18 < 0.15:
            score += 2
        elif opp.gap5p_rate_18 < 0.25:
            score += 1
        elif opp.gap5p_rate_18 > 0.35:
            score -= 1

        # Rule 4: Some gap=0 (consecutive hits) → warming up
        if opp.gap0_rate_18 > 0.15:
            score += 2
        elif opp.gap0_rate_18 > 0.05:
            score += 1

        # Rule 5: Gap compression (gaps getting shorter)
        if opp.gap_compression > 0.6:
            score += 2
        elif opp.gap_compression > 0.3:
            score += 1

        # Rule 6: Not overheated (target rate not too high)
        if opp.target_rate_18 <= 0.35:
            score += 1
        elif opp.target_rate_18 > 0.50:
            score -= 1

        # Rule 7: Ice break (first short gap after cold)
        if opp.ice_break:
            score += 3

        # Rule 8: Low variance (stable gaps)
        if opp.gap_var_6 < 2.0 and opp.gap_var_6 > 0:
            score += 1

        # Rule 9: Recent gaps show descending pattern
        lg = opp.last_3_gaps
        if len(lg) >= 3 and lg[0] >= lg[1] >= lg[2]:
            score += 2
        elif len(lg) >= 3 and lg[0] >= lg[2]:
            score += 1

        # Rule 10: mean gap not too tight (room to contract further)
        if 1.8 <= opp.gap_mean_18 <= 2.5:
            score += 1

        is_streak2 = opp.hit_round >= 0 and opp in _get_streak_starts(opportunities, 2)
        is_streak3 = opp.hit_round >= 0 and opp in _get_streak_starts(opportunities, 3)

        candidates.append({
            "opp": opp,
            "score": score,
            "is_win": opp.hit_round >= 0,
            "is_streak2": is_streak2,
            "is_streak3": is_streak3,
        })

    # Analyze by score bucket
    score_buckets = defaultdict(lambda: {"total": 0, "wins": 0, "streak2": 0, "streak3": 0})
    for c in candidates:
        bucket = c["score"]
        score_buckets[bucket]["total"] += 1
        if c["is_win"]:
            score_buckets[bucket]["wins"] += 1
        if c["is_streak2"]:
            score_buckets[bucket]["streak2"] += 1
        if c["is_streak3"]:
            score_buckets[bucket]["streak3"] += 1

    print(f"\n  Score distribution:")
    print(f"  {'Score':>6s} {'Total':>6s} {'Win%':>7s} {'Strk2%':>8s} {'Strk3%':>8s} {'CumW%':>7s}")
    print(f"  {'-'*50}")

    cum_wins = 0; cum_total = 0; cum_s2 = 0; cum_s3 = 0
    for score in sorted(score_buckets.keys(), reverse=True):
        b = score_buckets[score]
        cum_total += b["total"]
        cum_wins += b["wins"]
        cum_s2 += b["streak2"]
        cum_s3 += b["streak3"]
        wr = b["wins"]/b["total"]*100 if b["total"] > 0 else 0
        s2r = b["streak2"]/b["total"]*100 if b["total"] > 0 else 0
        s3r = b["streak3"]/b["total"]*100 if b["total"] > 0 else 0
        cwr = cum_wins/cum_total*100 if cum_total > 0 else 0
        print(f"  {score:>6d} {b['total']:>6d} {wr:>6.1f}% {s2r:>7.1f}% {s3r:>7.1f}% {cwr:>6.1f}%")

    # Best threshold
    print(f"\n  --- Threshold Backtest ---")
    for threshold in range(-5, 12):
        selected = [c for c in candidates if c["score"] >= threshold]
        if len(selected) < 10:
            continue
        total_bet = len(selected) * 7  # each opportunity risks 7 units
        wins = sum(1 for c in selected if c["is_win"])
        # For streak2 starts: if we enter at streak start and win, we keep going
        # Simple P&L: each selected opp is one 124 bet
        total_ret = sum(
            (2 if c["opp"].hit_round == 0 else
             3 if c["opp"].hit_round == 1 else
             5 if c["opp"].hit_round == 2 else 0)
            for c in selected if c["is_win"]
        )
        # More accurate: actual net from 124
        actual_net = sum(c["opp"].net_profit for c in selected)
        roi = actual_net / total_bet * 100 if total_bet > 0 else 0
        s2_rate = sum(1 for c in selected if c["is_streak2"]) / len(selected) * 100
        print(f"  score>={threshold:>2d}: signals={len(selected):>4d}, win%={wins/len(selected)*100:.1f}%, "
              f"streak2%={s2_rate:.1f}%, ROI={roi:+.2f}%")

    return candidates


def _get_streak_starts(opportunities, min_streak_len):
    """Get opportunities that start a streak of >= min_streak_len."""
    starts = set()
    i = 0
    while i < len(opportunities):
        opp = opportunities[i]
        if opp.streak_position == 0 and opp.hit_round >= 0:
            streak_len = 1
            j = i + 1
            while j < len(opportunities) and opportunities[j].streak_position > 0:
                if opportunities[j].streak_position == opportunities[j-1].streak_position + 1:
                    if opportunities[j].hit_round >= 0:
                        streak_len += 1
                        j += 1
                    else:
                        break
                else:
                    break
            if streak_len >= min_streak_len:
                starts.add(id(opp))
            i = j
        else:
            i += 1
    return starts


# ============================================================
# Step 3: Real-time entry timing — "when to pounce"
# ============================================================

def analyze_entry_timing_detail(sessions, mapper, target_id, entity_label):
    """
    For each session, find the optimal entry point by analyzing:
    - When do hot streaks begin?
    - What conditions immediately precede them?
    - Can we identify a "regime shift" in real-time?

    Focus on: the transition moment — the exact spin where a cold row
    suddenly becomes "catchable" with 124.
    """
    print(f"\n{'='*60}")
    print(f"  ENTRY TIMING DEEP DIVE: {entity_label}")
    print(f"{'='*60}")

    # For each session, find all "hot periods" (>=3 consecutive 124 wins)
    # and analyze what happened in the 10 spins BEFORE the first win

    hot_starts = []  # spin index of first win in a hot streak
    cold_contexts = []  # what happened before each hot start

    for sess in sessions[-72:]:  # Focus on recent 72 sessions
        nums = sess["numbers"]
        gaps = []
        prev_hit = -1
        nz_idx = 0

        # Track 124 outcomes spin by spin
        outcomes = []  # (spin_idx, hit_round or -1)
        in_bet = False
        bet_round = 0

        for si, n in enumerate(nums):
            if n == 0:
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        outcomes.append((si - 3, -1))
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            if in_bet:
                if is_target:
                    outcomes.append((si - bet_round, bet_round))
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        outcomes.append((si - 3, -1))
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

        # Find hot streaks
        i = 0
        while i < len(outcomes) - 2:
            if outcomes[i][1] >= 0 and outcomes[i+1][1] >= 0 and outcomes[i+2][1] >= 0:
                # Found streak of >=3 starting at i
                hot_starts.append({
                    "session": sess["name"],
                    "spin": outcomes[i][0],
                    "streak_len": 3,
                })
                # Count how long the streak continues
                j = i + 3
                while j < len(outcomes) and outcomes[j][1] >= 0:
                    hot_starts[-1]["streak_len"] += 1
                    j += 1
                i = j
            else:
                i += 1

    print(f"  Hot streaks (>=3 wins) found: {len(hot_starts)}")
    if hot_starts:
        avg_len = mean(s["streak_len"] for s in hot_starts)
        max_len = max(s["streak_len"] for s in hot_starts)
        print(f"  Average streak length: {avg_len:.1f}, Max: {max_len}")

    # Distribution of streak lengths
    len_dist = defaultdict(int)
    for s in hot_starts:
        len_dist[s["streak_len"]] += 1
    print(f"  Streak length distribution: {dict(sorted(len_dist.items()))}")

    return hot_starts


# ============================================================
# MAIN
# ============================================================

def main():
    path = "HistoryData/wzs-merged.json"
    print("Loading data...")
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    print(f"{len(sessions)} sessions, {sessions[0]['name']} → {sessions[-1]['name']}")

    # Focus on the main entities
    entities = [
        (get_row, 0, "row", "1行"),
        (get_row, 2, "row", "3行"),
        (get_group, 0, "group", "一组"),
    ]

    all_opps = {}

    # ============================================================
    # PART 1: Streak analysis per entity
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 1: STREAK ANALYSIS")
    print(f"{'#'*70}")

    for mapper, target_id, etype, elabel in entities:
        print(f"\n>>> Computing opportunities for {elabel}...")
        opps = compute_all_opportunities(sessions, mapper, target_id, etype, elabel)
        all_opps[elabel] = opps
        streak_data = analyze_streaks(opps, elabel)

    # ============================================================
    # PART 2: Build simple predictor
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 2: ENTRY PREDICTOR")
    print(f"{'#'*70}")

    for mapper, target_id, etype, elabel in entities:
        opps = all_opps[elabel]
        build_simple_predictor(opps, elabel)

    # ============================================================
    # PART 3: Entry timing deep dive
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 3: ENTRY TIMING DEEP DIVE")
    print(f"{'#'*70}")

    for mapper, target_id, etype, elabel in entities:
        analyze_entry_timing_detail(sessions, mapper, target_id, elabel)

    # ============================================================
    # PART 4: What happens BEFORE a hot streak?
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 4: PRE-STREAK CONDITIONS (what to look for)")
    print(f"{'#'*70}")

    for mapper, target_id, etype, elabel in entities:
        opps = all_opps[elabel]

        # Find streak starts (>=3) and compare with failures
        streak3_opps = []
        fail_opps = []

        i = 0
        while i < len(opps):
            opp = opps[i]
            if opp.streak_position == 0:
                if opp.hit_round >= 0:
                    streak_len = 1
                    j = i + 1
                    while j < len(opps) and opps[j].streak_position > 0:
                        if opps[j].streak_position == opps[j-1].streak_position + 1:
                            if opps[j].hit_round >= 0:
                                streak_len += 1
                                j += 1
                            else:
                                break
                        else:
                            break
                    if streak_len >= 3:
                        streak3_opps.append(opp)
                    i = j
                else:
                    fail_opps.append(opp)
                    i += 1
            else:
                i += 1

        print(f"\n  {elabel}: {len(streak3_opps)} streak>=3 starts, {len(fail_opps)} failures")

        # Key question: what's different in the LAST 3 GAPS?
        print(f"\n  --- Last 3 gaps before entry ---")
        if streak3_opps and fail_opps:
            print(f"  Streak starts: most recent gaps = {streak3_opps[0].last_3_gaps if streak3_opps else 'N/A'}")
            # Average last 3 gaps
            for k in range(3):
                s3_vals = [opp.last_3_gaps[k] for opp in streak3_opps if len(opp.last_3_gaps) > k]
                f_vals = [opp.last_3_gaps[k] for opp in fail_opps if len(opp.last_3_gaps) > k]
                if s3_vals and f_vals:
                    print(f"    gap[-{3-k}]: streak={mean(s3_vals):.2f}, fail={mean(f_vals):.2f}")

        # Ice break rate
        s3_ice = sum(1 for opp in streak3_opps if opp.ice_break) / len(streak3_opps) * 100 if streak3_opps else 0
        f_ice = sum(1 for opp in fail_opps if opp.ice_break) / len(fail_opps) * 100 if fail_opps else 0
        print(f"\n  Ice break rate: streak={s3_ice:.1f}%, fail={f_ice:.1f}%")

        # Gap compression
        s3_comp = mean(opp.gap_compression for opp in streak3_opps) if streak3_opps else 0
        f_comp = mean(opp.gap_compression for opp in fail_opps) if fail_opps else 0
        print(f"  Gap compression: streak={s3_comp:.3f}, fail={f_comp:.3f}")

        # Gap velocity
        s3_vel = mean(opp.gap_velocity for opp in streak3_opps) if streak3_opps else 0
        f_vel = mean(opp.gap_velocity for opp in fail_opps) if fail_opps else 0
        print(f"  Gap velocity: streak={s3_vel:.3f}, fail={f_vel:.3f}")

    # ============================================================
    # PART 5: The "Regime Shift" detector
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 5: REGIME SHIFT DETECTION")
    print(f"{'#'*70}")
    print(f"  Can we detect when a row transitions from 'cold/unbetable'")
    print(f"  to 'warm/betable' BEFORE the success rate confirms it?")

    for mapper, target_id, etype, elabel in entities:
        print(f"\n  --- {elabel} ---")

        # For each session, find transitions
        transitions_found = 0
        transition_wins = 0

        for sess in sessions[-72:]:
            nums = sess["numbers"]
            gaps = []
            prev_hit = -1
            nz_idx = 0

            # Track "phase": cold (124_win_rate < 40%), warm (>= 40%)
            # over last N opportunities
            recent_124_outcomes = []  # sliding window of 1/0

            for si, n in enumerate(nums):
                if n == 0: continue

                eid = mapper(n)
                is_target = (eid == target_id)

                if is_target:
                    if prev_hit >= 0:
                        gaps.append(nz_idx - prev_hit - 1)
                    prev_hit = nz_idx
                nz_idx += 1

                # Can't detect regime shift without gaps
                if len(gaps) < 12:
                    continue

                # At this point, check: if we were to enter at skip=2 NOW,
                # what are the conditions?
                # This is essentially looking at the "readiness" of the entity

                # Simple regime shift: gap velocity crosses from positive to negative
                if len(gaps) >= 18:
                    g6 = gaps[-6:]
                    prior6 = gaps[-12:-6]
                    older6 = gaps[-18:-12]

                    m6 = mean(g6)
                    mp6 = mean(prior6) if prior6 else m6
                    mo6 = mean(older6) if older6 else mp6

                    vel = (m6 - mp6) / mp6 if mp6 != 0 else 0
                    old_vel = (mp6 - mo6) / mo6 if mo6 != 0 else 0

                    # Regime shift: velocity was positive/stable, now negative
                    # AND not overheated
                    tr = sum(1 for g in gaps[-18:] if 2 <= g <= 4) / 18

                    if old_vel > -0.05 and vel < -0.15 and tr < 0.45:
                        transitions_found += 1

                        # Check: would 124 have won here?
                        # Look ahead at most 3 non-zero spins
                        look_ahead = 0
                        found = False
                        for ni in range(si + 1, min(si + 20, len(nums))):
                            if nums[ni] == 0: continue
                            eid2 = mapper(nums[ni])
                            if eid2 == target_id:
                                found = True
                                break
                            look_ahead += 1
                            if look_ahead >= 3: break

                        if found and look_ahead <= 2:
                            transition_wins += 1

        if transitions_found > 0:
            print(f"  Regime shifts detected: {transitions_found}")
            print(f"  Would-have-won rate: {transition_wins}/{transitions_found} = {transition_wins/transitions_found*100:.1f}%")
        else:
            print(f"  No regime shifts detected with current thresholds")


if __name__ == "__main__":
    main()
