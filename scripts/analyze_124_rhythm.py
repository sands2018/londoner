"""
124 Rhythm Analysis — Individual Row/Group, Dynamic Entry, Adaptive Exit
=========================================================================
研究方向：
1. 每个行(3个)、每个组(3个) 独立分析，不混合
2. 动态入场轮次 — gap contraction velocity 决定从第几轮开始打
3. 自适应退出 — 根据市场状态动态调整 124 的轮数和注码
4. 数据按时间加权 — 新数据权重更高

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json
import math
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from typing import List, Tuple, Dict, Optional
from statistics import mean, stdev, variance as pvariance

# ============================================================
# Data loading
# ============================================================

def load_sessions(path: str) -> list:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    sessions = []
    for entry in data:
        name = entry.get("Name", "unknown")
        nums_str = entry.get("Numbers", "")
        if isinstance(nums_str, str):
            nums = [int(x.strip()) for x in nums_str.split(",") if x.strip()]
        else:
            nums = nums_str
        if nums:
            sessions.append({"name": name, "numbers": nums, "tms": entry.get("tms", 0)})
    return sessions


# ============================================================
# Row/Group mapping (matching roulette.ts logic exactly)
# ============================================================

def get_group(n: int) -> Optional[int]:
    """组 0=1-12, 1=13-24, 2=25-36"""
    if n == 0:
        return None
    return (n - 1) // 12


def get_row(n: int) -> Optional[int]:
    """行 0=3,6,9... 1=2,5,8... 2=1,4,7..."""
    if n == 0:
        return None
    rem = n % 3
    if rem == 1:
        return 2  # 1,4,7,... → row 2
    if rem == 2:
        return 1  # 2,5,8,... → row 1
    return 0      # 3,6,9,... → row 0


ROW_LABELS = ["1行(3,6,9…)", "2行(2,5,8…)", "3行(1,4,7…)"]
GROUP_LABELS = ["一组(1-12)", "二组(13-24)", "三组(25-36)"]


# ============================================================
# Gap sequence computation
# ============================================================

def compute_gaps(numbers: list, entity_id: int, entity_type: str) -> list:
    """
    Compute gap sequence for a specific entity (row or group).
    A 'gap' = number of non-zero spins BETWEEN consecutive hits of this entity.
    gap=0 means consecutive hits. gap=1 means one other number in between.
    """
    mapper = get_row if entity_type == "row" else get_group
    gaps = []
    prev_idx = -1  # index in the non-zero number sequence
    non_zero_idx = 0
    for n in numbers:
        if n == 0:
            continue
        eid = mapper(n)
        if eid == entity_id:
            if prev_idx >= 0:
                gap = non_zero_idx - prev_idx - 1
                gaps.append(gap)
            prev_idx = non_zero_idx
        non_zero_idx += 1
    return gaps


def compute_all_gaps(sessions: list) -> dict:
    """
    Returns:
        result[entity_type][entity_id] = {
            "gaps": [...],  # all gaps across all sessions (concatenated)
            "per_session": [{"name": ..., "gaps": [...], "non_zero_len": N, "tms": ...}]
        }
    """
    result = {}
    for etype in ["row", "group"]:
        result[etype] = {}
        for eid in range(3):
            all_gaps = []
            per_session = []
            for sess in sessions:
                nums = sess["numbers"]
                non_zero_len = sum(1 for n in nums if n != 0)
                gaps = compute_gaps(nums, eid, etype)
                all_gaps.extend(gaps)
                per_session.append({
                    "name": sess["name"],
                    "tms": sess.get("tms", 0),
                    "gaps": gaps,
                    "non_zero_len": non_zero_len,
                })
            result[etype][eid] = {
                "gaps": all_gaps,
                "per_session": per_session,
            }
    return result


# ============================================================
# Backtest engine
# ============================================================

@dataclass
class BetResult:
    session_name: str
    entity_type: str
    entity_id: int
    entry_round: int       # which round of "不出" triggered entry
    bet_amounts: list      # [1, 2, 4] or adaptive
    outcome: int           # net profit (positive) or loss (negative)
    hit_round: int          # 0=first bet hit, 1=second bet hit, 2=third, -1=miss
    gap_at_entry: int       # the gap value when we decided to enter
    recent_gaps: list       # recent gap sequence at decision time
    entry_spin_idx: int     # absolute spin index in session


def run_backtest(
    sessions: list,
    entity_type: str,
    entity_id: int,
    entry_fn,          # (recent_gaps, current_skip) -> int | None (entry round offset, None = skip)
    bet_fn,             # (recent_gaps, current_skip, entry_round) -> list (bet amounts)
    min_history_gaps: int = 18,
):
    """
    Walk through each session spin by spin, simulating the 124 strategy.

    entry_fn(recent_gaps, current_skip):
        recent_gaps: list of completed gaps (most recent last)
        current_skip: how many rounds the entity hasn't appeared (0 = just appeared)
        Returns: entry_round_offset (0=start now, 1=wait 1 more, etc.) or None to skip

    bet_fn(recent_gaps, current_skip, entry_round_offset):
        Returns: list of bet amounts, e.g. [1,2,4]
    """
    mapper = get_row if entity_type == "row" else get_group
    results = []

    for sess in sessions:
        nums = sess["numbers"]
        name = sess["name"]

        # Track gap sequence as we go
        gaps: list = []
        prev_hit_idx = -1
        non_zero_idx = 0
        current_skip = 0

        # State for active betting
        active_bet_plan: list = []
        active_bet_round: int = 0
        active_total_bet: int = 0

        for spin_idx, n in enumerate(nums):
            if n == 0:
                # 0 doesn't count but betting still happens
                # Check if we have a pending bet
                if active_bet_plan:
                    bet_amount = active_bet_plan[active_bet_round] if active_bet_round < len(active_bet_plan) else 0
                    if bet_amount > 0:
                        active_total_bet += bet_amount
                        # Loss on this round (0 never matches a row/group)
                        active_bet_round += 1
                        if active_bet_round >= len(active_bet_plan):
                            # All rounds lost
                            results.append(BetResult(
                                session_name=name, entity_type=entity_type, entity_id=entity_id,
                                entry_round=current_skip_at_entry,
                                bet_amounts=active_bet_plan,
                                outcome=-active_total_bet,
                                hit_round=-1,
                                gap_at_entry=current_skip_at_entry,
                                recent_gaps=list(gaps[-min_history_gaps:]) if len(gaps) >= min_history_gaps else list(gaps),
                                entry_spin_idx=spin_idx - len(active_bet_plan),
                            ))
                            active_bet_plan = []
                            active_bet_round = 0
                            active_total_bet = 0
                current_skip += 1
                continue

            eid = mapper(n)
            is_hit = (eid == entity_id)

            # Check if pending bet hits
            if active_bet_plan and is_hit:
                bet_amount = active_bet_plan[active_bet_round] if active_bet_round < len(active_bet_plan) else 0
                if bet_amount > 0:
                    active_total_bet += bet_amount
                # Win: payout is 3x bet (2:1 odds) → profit = 3*bet - total_bet
                gross_win = (active_total_bet if bet_amount == 0 else
                            active_total_bet - bet_amount + bet_amount * 3)
                net_profit = gross_win - active_total_bet
                # Simpler: net = 3 * bet_amount - active_total_bet
                net = 3 * bet_amount - active_total_bet if bet_amount > 0 else 0
                results.append(BetResult(
                    session_name=name, entity_type=entity_type, entity_id=entity_id,
                    entry_round=current_skip_at_entry,
                    bet_amounts=active_bet_plan,
                    outcome=net,
                    hit_round=active_bet_round,
                    gap_at_entry=current_skip_at_entry,
                    recent_gaps=list(gaps[-min_history_gaps:]) if len(gaps) >= min_history_gaps else list(gaps),
                    entry_spin_idx=spin_idx - active_bet_round - 1,
                ))
                active_bet_plan = []
                active_bet_round = 0
                active_total_bet = 0

            # If pending bet misses but this number isn't our entity
            elif active_bet_plan and not is_hit:
                bet_amount = active_bet_plan[active_bet_round] if active_bet_round < len(active_bet_plan) else 0
                if bet_amount > 0:
                    active_total_bet += bet_amount
                active_bet_round += 1
                if active_bet_round >= len(active_bet_plan):
                    results.append(BetResult(
                        session_name=name, entity_type=entity_type, entity_id=entity_id,
                        entry_round=current_skip_at_entry,
                        bet_amounts=active_bet_plan,
                        outcome=-active_total_bet,
                        hit_round=-1,
                        gap_at_entry=current_skip_at_entry,
                        recent_gaps=list(gaps[-min_history_gaps:]) if len(gaps) >= min_history_gaps else list(gaps),
                        entry_spin_idx=spin_idx - len(active_bet_plan) - 1,
                    ))
                    active_bet_plan = []
                    active_bet_round = 0
                    active_total_bet = 0

            # Update gap tracking
            if is_hit:
                if prev_hit_idx >= 0:
                    gap = non_zero_idx - prev_hit_idx - 1
                    gaps.append(gap)
                prev_hit_idx = non_zero_idx
                current_skip = 0
            else:
                current_skip += 1

            non_zero_idx += 1

            # Decide whether to enter (only if not already in a bet)
            if not active_bet_plan and len(gaps) >= min_history_gaps:
                recent = gaps[-min_history_gaps:]
                entry_offset = entry_fn(recent, current_skip)
                if entry_offset is not None and entry_offset == current_skip:
                    # Enter now
                    active_bet_plan = bet_fn(recent, current_skip, entry_offset)
                    active_bet_round = 0
                    active_total_bet = 0
                    current_skip_at_entry = current_skip

    return results


# ============================================================
# Entry functions
# ============================================================

def entry_fixed_2(recent_gaps, current_skip):
    """Baseline: always enter at 2轮不出"""
    if current_skip == 2:
        return 2
    return None


def entry_gpt_filter(recent_gaps, current_skip):
    """
    GPT research filter (行):
    targetRate <= 0.5 AND trend <= -0.5 AND mean >= 2
    Enter at 2轮不出 only if conditions met.
    """
    if current_skip != 2:
        return None
    if len(recent_gaps) < 18:
        return None

    recent18 = recent_gaps[-18:]
    prior18 = recent_gaps[-36:-18] if len(recent_gaps) >= 36 else recent_gaps[:-18]
    if len(prior18) < 18:
        prior18 = recent_gaps[:18]  # fallback

    target_rate = sum(1 for g in recent18 if 2 <= g <= 4) / len(recent18)
    mean_recent = mean(recent18)
    mean_prior = mean(prior18)
    trend = mean_recent - mean_prior

    if target_rate <= 0.5 and trend <= -0.5 and mean_recent >= 2:
        return 2
    return None


def entry_dynamic_velocity(recent_gaps, current_skip):
    """
    Dynamic entry based on gap contraction velocity.

    gap_velocity = (recent6_mean - prior12_mean) / prior12_mean

    Fast contraction:    enter at 1轮不出 (抢跑)
    Moderate contraction: enter at 2轮不出 (标准)
    Slow/stable:          enter at 3轮不出 (保守)
    Expanding:            skip (不追)
    """
    if len(recent_gaps) < 18:
        return None

    recent6 = recent_gaps[-6:]
    prior12 = recent_gaps[-18:-6]
    recent18 = recent_gaps[-18:]

    if len(prior12) < 12:
        return None

    mean6 = mean(recent6)
    mean12 = mean(prior12)
    mean18 = mean(recent18)

    if mean12 == 0:
        return None

    velocity = (mean6 - mean12) / mean12

    # Need minimum gap mean to justify betting
    if mean18 < 1.8:
        return None  # too tight, likely random noise

    # Target rate check (avoid overheating)
    target_rate = sum(1 for g in recent18 if 2 <= g <= 4) / len(recent18)
    if target_rate > 0.55:
        return None  # already hot, reversal risk

    if velocity < -0.3:
        # Fast contraction — enter early
        target_skip = 1
    elif velocity < -0.12:
        # Moderate contraction
        target_skip = 2
    else:
        # Slow/stable — wait longer
        target_skip = 3

    if current_skip == target_skip:
        return target_skip
    return None


def entry_variance_signal(recent_gaps, current_skip):
    """
    Variance contraction as leading indicator.

    var_ratio = variance(last12) / variance(prior12)
    When variance contracts significantly (var_ratio < 0.7),
    it signals a regime change BEFORE the mean moves.

    Combined with standard velocity for entry timing.
    """
    if len(recent_gaps) < 24:
        return None

    recent12 = recent_gaps[-12:]
    prior12 = recent_gaps[-24:-12]
    recent18 = recent_gaps[-18:]

    if len(prior12) < 12:
        return None

    var12 = pvariance(recent12) if len(recent12) >= 3 else 1
    var24 = pvariance(prior12) if len(prior12) >= 3 else 1

    if var24 == 0:
        var_ratio = 0.0 if var12 == 0 else 999.0
    else:
        var_ratio = var12 / var24

    mean6 = mean(recent_gaps[-6:])
    mean12_val = mean(prior12)
    velocity = (mean6 - mean12_val) / mean12_val if mean12_val != 0 else 0

    # Strong variance contraction + gap contraction
    if var_ratio < 0.65 and velocity < -0.1:
        target_skip = 1  # aggressive early entry
    elif var_ratio < 0.75 and velocity < 0:
        target_skip = 2
    elif var_ratio < 0.9:
        target_skip = 3
    else:
        return None

    # Overheat check
    target_rate = sum(1 for g in recent18 if 2 <= g <= 4) / len(recent18)
    if target_rate > 0.55:
        return None

    if current_skip == target_skip:
        return target_skip
    return None


def entry_gap_cliff(recent_gaps, current_skip):
    """
    "Gap Cliff" — 微观加速度

    Looks at last3 vs last6 ratio for faster signal.
    last3mean / last6mean < 0.6 → accelerating contraction
    """
    if len(recent_gaps) < 18:
        return None

    recent3 = recent_gaps[-3:]
    recent6 = recent_gaps[-6:]
    recent18 = recent_gaps[-18:]

    mean3 = mean(recent3)
    mean6 = mean(recent6)

    if mean6 == 0:
        return None

    cliff_ratio = mean3 / mean6

    # Also compute overall trend for confirmation
    prior18 = recent_gaps[-36:-18] if len(recent_gaps) >= 36 else recent_gaps[:-18]
    if len(prior18) < 18:
        prior18 = recent_gaps[:18]
    trend = mean(recent18) - mean(prior18)

    target_rate = sum(1 for g in recent18 if 2 <= g <= 4) / len(recent18)

    # Strong cliff + cooling trend → very early entry
    if cliff_ratio < 0.55 and trend < -0.3 and target_rate <= 0.5:
        target_skip = 1
    elif cliff_ratio < 0.7 and trend < -0.1 and target_rate <= 0.5:
        target_skip = 2
    elif cliff_ratio < 0.85 and trend <= 0.0:
        target_skip = 3
    else:
        return None

    if current_skip == target_skip:
        return target_skip
    return None


# ============================================================
# Bet functions (adaptive)
# ============================================================

def bet_fixed_124(recent_gaps, current_skip, entry_round):
    """Standard 1-2-4 progression, always 3 rounds"""
    return [1, 2, 4]


def bet_adaptive_124(recent_gaps, current_skip, entry_round):
    """
    Adaptive bet sizing based on entry timing and gap state.

    - Early entry (skip=1): needs more rounds to catch, use 1-2-4-8 (4 rounds)
    - Standard (skip=2): use 1-2-4 (3 rounds)
    - Late entry (skip=3): more confident, use 2-4 (2 rounds, higher base)
    """
    if current_skip <= 1:
        return [1, 1, 2, 4]  # gentle start, 4 rounds
    elif current_skip == 2:
        return [1, 2, 4]       # standard
    else:
        return [2, 4]           # late but confident — fewer rounds, higher base


def bet_adaptive_velocity(recent_gaps, current_skip, entry_round):
    """
    Sizing based on contraction velocity.
    Faster contraction → more aggressive sizing (trend is stronger).
    """
    if len(recent_gaps) < 12:
        return [1, 2, 4]

    recent6 = recent_gaps[-6:]
    prior6 = recent_gaps[-12:-6]

    mean6 = mean(recent6)
    mean_prior6 = mean(prior6) if prior6 else mean6

    if mean_prior6 == 0:
        velocity = 0
    else:
        velocity = (mean6 - mean_prior6) / mean_prior6

    if velocity < -0.3:
        # Strong contraction: aggressive
        if current_skip <= 1:
            return [2, 4, 8]
        else:
            return [1, 3, 6]
    elif velocity < -0.12:
        # Moderate: standard
        return [1, 2, 4]
    else:
        # Slow: conservative but higher base
        return [2, 3]


# ============================================================
# Reporting
# ============================================================

def summarize_results(results: list, label: str):
    """Print summary statistics for a set of backtest results."""
    if not results:
        print(f"\n{'='*60}")
        print(f"  {label}: NO SIGNALS")
        print(f"{'='*60}")
        return None

    total_bet = 0
    total_win = 0
    wins = 0
    losses = 0
    zero = 0
    hit_rounds = {0: 0, 1: 0, 2: 0, 3: 0}
    misses = 0
    entry_counts = defaultdict(int)
    per_session_pnl = defaultdict(int)

    for r in results:
        total_bet += sum(r.bet_amounts)
        total_win += (r.outcome + sum(r.bet_amounts))  # gross return
        if r.outcome > 0:
            wins += 1
        elif r.outcome < 0:
            losses += 1
        else:
            zero += 1

        if r.hit_round >= 0:
            hr = min(r.hit_round, 3)
            hit_rounds[hr] += 1
        else:
            misses += 1

        entry_counts[r.entry_round] += 1
        per_session_pnl[r.session_name] += r.outcome

    net = total_win - total_bet
    roi = (net / total_bet * 100) if total_bet > 0 else 0
    win_rate = (wins / len(results) * 100) if results else 0
    hit_rate = ((wins + zero) / len(results) * 100) if results else 0

    # Per-session stats
    session_pnls = list(per_session_pnl.values())
    winning_sessions = sum(1 for p in session_pnls if p > 0)
    losing_sessions = sum(1 for p in session_pnls if p < 0)
    flat_sessions = sum(1 for p in session_pnls if p == 0)

    # Max drawdown (simple cumulative)
    cum_pnl = 0
    max_dd = 0
    peak = 0
    for p in session_pnls:
        cum_pnl += p
        if cum_pnl > peak:
            peak = cum_pnl
        dd = peak - cum_pnl
        if dd > max_dd:
            max_dd = dd

    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f"  信号数: {len(results)}")
    print(f"  命中(赢): {wins}  未中(输): {losses}  平: {zero}")
    print(f"  胜率: {win_rate:.1f}%  命中率: {hit_rate:.1f}%")
    print(f"  总投入: {total_bet}  总回收: {total_win}  净利: {net}")
    print(f"  ROI: {roi:+.2f}%")
    print(f"  盈利局: {winning_sessions}  亏损局: {losing_sessions}  平局: {flat_sessions}")
    print(f"  最大回撤: {max_dd}")
    print(f"  入场分布: {dict(entry_counts)}")
    print(f"  命中分布: 第1轮={hit_rounds[0]}, 第2轮={hit_rounds[1]}, 第3轮={hit_rounds[2]}, 第4轮={hit_rounds[3]}, 未中={misses}")

    # ROI by time period
    print(f"\n  --- 按时段 ROI ---")
    time_roi = analyze_by_time(results)
    for period, stats in time_roi.items():
        print(f"  {period}: 信号={stats['signals']}, ROI={stats['roi']:+.2f}%")

    return {
        "signals": len(results),
        "net": net,
        "roi": roi,
        "win_rate": win_rate,
        "total_bet": total_bet,
        "max_dd": max_dd,
    }


def analyze_by_time(results: list) -> dict:
    """Group results by time period for trend analysis."""
    periods = defaultdict(lambda: {"bet": 0, "win": 0, "signals": 0})

    for r in results:
        name = r.session_name
        # Extract date prefix: "20260409-夜-澳门永利" → "202604"
        date_part = name.split("-")[0] if "-" in name else name[:6]
        if len(date_part) >= 6:
            period = date_part[:6]  # YYYYMM
        elif len(date_part) >= 4:
            period = date_part[:4]  # YYYY
        else:
            period = "unknown"

        periods[period]["bet"] += sum(r.bet_amounts)
        periods[period]["win"] += (r.outcome + sum(r.bet_amounts))
        periods[period]["signals"] += 1

    result = {}
    for period in sorted(periods.keys()):
        s = periods[period]
        roi = ((s["win"] - s["bet"]) / s["bet"] * 100) if s["bet"] > 0 else 0
        result[period] = {"signals": s["signals"], "roi": roi}
    return result


def analyze_by_entity(results: list, entity_type: str) -> dict:
    """Break down results by individual entity (row 0,1,2 or group 0,1,2)."""
    by_entity = defaultdict(list)
    for r in results:
        by_entity[r.entity_id].append(r)

    out = {}
    for eid in sorted(by_entity.keys()):
        entity_results = by_entity[eid]
        total_bet = sum(sum(rr.bet_amounts) for rr in entity_results)
        total_win = sum(rr.outcome + sum(rr.bet_amounts) for rr in entity_results)
        net = total_win - total_bet
        roi = (net / total_bet * 100) if total_bet > 0 else 0
        wins = sum(1 for rr in entity_results if rr.outcome > 0)
        labels = ROW_LABELS if entity_type == "row" else GROUP_LABELS
        label = labels[eid] if eid < len(labels) else f"Entity {eid}"
        out[label] = {
            "signals": len(entity_results),
            "net": net,
            "roi": roi,
            "win_rate": wins / len(entity_results) * 100 if entity_results else 0,
            "total_bet": total_bet,
        }
    return out


# ============================================================
# Entry round distribution analysis
# ============================================================

def analyze_entry_timing(gaps_data: dict, entity_type: str, entity_id: int):
    """
    Analyze when the optimal entry timing was historically.
    For each gap, see if entering at skip=1, 2, or 3 would have won.
    """
    all_gaps = gaps_data[entity_type][entity_id]["gaps"]
    if len(all_gaps) < 20:
        return None

    # For each gap position, look at what happened next
    entry_stats = {1: {"wins": 0, "total": 0}, 2: {"wins": 0, "total": 0}, 3: {"wins": 0, "total": 0}}

    for i in range(len(all_gaps) - 3):
        current_gap = all_gaps[i]
        # If current gap already >= 1/2/3, what would happen in next 3 spins?
        future_gaps = all_gaps[i+1:i+4]

        for entry_skip in [1, 2, 3]:
            if current_gap >= entry_skip:
                entry_stats[entry_skip]["total"] += 1
                # Would we win within 1/2/3 rounds from entry?
                remaining_skip = current_gap - entry_skip
                # Actually this is getting complicated. Let me simplify.

    return entry_stats


# ============================================================
# Gap distribution analysis per entity
# ============================================================

def analyze_gap_distribution(gaps_data: dict):
    """Show gap statistics for each individual entity."""
    print(f"\n{'='*60}")
    print(f"  Individual Entity Gap Distribution")
    print(f"{'='*60}")

    for etype in ["row", "group"]:
        labels = ROW_LABELS if etype == "row" else GROUP_LABELS
        print(f"\n--- {etype.upper()} ---")
        for eid in range(3):
            gaps = gaps_data[etype][eid]["gaps"]
            if not gaps:
                continue
            mean_gap = mean(gaps)
            median_gap = sorted(gaps)[len(gaps)//2]
            var_gap = pvariance(gaps) if len(gaps) > 1 else 0
            gap_0_1 = sum(1 for g in gaps if g <= 1)
            gap_2_4 = sum(1 for g in gaps if 2 <= g <= 4)
            gap_5_plus = sum(1 for g in gaps if g >= 5)
            total = len(gaps)

            print(f"  {labels[eid]}: "
                  f"count={total}, "
                  f"mean={mean_gap:.2f}, "
                  f"median={median_gap}, "
                  f"std={math.sqrt(var_gap):.2f}, "
                  f"gap≤1={gap_0_1}({gap_0_1/total*100:.1f}%), "
                  f"gap2-4={gap_2_4}({gap_2_4/total*100:.1f}%), "
                  f"gap≥5={gap_5_plus}({gap_5_plus/total*100:.1f}%)")


# ============================================================
# Detailed entry analysis
# ============================================================

def detailed_entry_analysis(results: list, label: str):
    """Analyze which entry rounds work best."""
    if not results:
        return

    print(f"\n--- {label}: 按入场轮次分析 ---")
    by_entry = defaultdict(lambda: {"signals": 0, "wins": 0, "bet": 0, "win_amount": 0, "hit_rounds": defaultdict(int)})
    for r in results:
        er = r.entry_round
        by_entry[er]["signals"] += 1
        by_entry[er]["bet"] += sum(r.bet_amounts)
        by_entry[er]["win_amount"] += (r.outcome + sum(r.bet_amounts))
        if r.outcome > 0:
            by_entry[er]["wins"] += 1
        hr_key = r.hit_round if r.hit_round >= 0 else "miss"
        by_entry[er]["hit_rounds"][hr_key] += 1

    for er in sorted(by_entry.keys()):
        s = by_entry[er]
        roi = ((s["win_amount"] - s["bet"]) / s["bet"] * 100) if s["bet"] > 0 else 0
        wr = s["wins"] / s["signals"] * 100 if s["signals"] > 0 else 0
        hr_detail = dict(s["hit_rounds"])
        print(f"  入场={er}轮不出: 信号={s['signals']}, 胜率={wr:.1f}%, ROI={roi:+.2f}%, 命中分布={hr_detail}")


# ============================================================
# Recent data weight analysis
# ============================================================

def analyze_by_recency(results: list, sessions: list):
    """Analyze how strategy performs on recent vs old data."""
    # Sort sessions by tms
    sorted_sessions = sorted(sessions, key=lambda s: s.get("tms", 0))
    if not sorted_sessions:
        return

    # Split into halves
    mid = len(sorted_sessions) // 2
    old_sessions = {s["name"] for s in sorted_sessions[:mid]}
    new_sessions = {s["name"] for s in sorted_sessions[mid:]}

    old_results = [r for r in results if r.session_name in old_sessions]
    new_results = [r for r in results if r.session_name in new_sessions]

    old_bet = sum(sum(rr.bet_amounts) for rr in old_results)
    old_win = sum(rr.outcome + sum(rr.bet_amounts) for rr in old_results)
    new_bet = sum(sum(rr.bet_amounts) for rr in new_results)
    new_win = sum(rr.outcome + sum(rr.bet_amounts) for rr in new_results)

    old_roi = ((old_win - old_bet) / old_bet * 100) if old_bet > 0 else 0
    new_roi = ((new_win - new_bet) / new_bet * 100) if new_bet > 0 else 0

    print(f"\n--- 新旧数据对比 ---")
    print(f"  旧数据({len(old_sessions)}局): 信号={len(old_results)}, ROI={old_roi:+.2f}%")
    print(f"  新数据({len(new_sessions)}局): 信号={len(new_results)}, ROI={new_roi:+.2f}%")


# ============================================================
# Main
# ============================================================

def main():
    data_path = "HistoryData/wzs-merged.json"
    print(f"Loading data from {data_path}...")
    sessions = load_sessions(data_path)
    print(f"Loaded {len(sessions)} sessions")

    # Sort by time
    sessions.sort(key=lambda s: s.get("tms", 0))

    print(f"Date range: {sessions[0]['name']} → {sessions[-1]['name']}")
    total_spins = sum(sum(1 for n in s["numbers"] if n != 0) for s in sessions)
    print(f"Total non-zero spins: {total_spins}")

    # Compute all gaps
    print("\nComputing gap sequences for each entity...")
    gaps_data = compute_all_gaps(sessions)

    # Gap distribution
    analyze_gap_distribution(gaps_data)

    # ================================================================
    # BACKTEST: Individual entity breakdown
    # ================================================================

    all_summaries = []

    # ---- TEST 1: Baseline fixed 2→124 ----
    print(f"\n{'#'*60}")
    print(f"# TEST 1: BASELINE — Fixed 2轮不出 → 124")
    print(f"{'#'*60}")

    for etype in ["row", "group"]:
        for eid in range(3):
            results = run_backtest(sessions, etype, eid,
                                   entry_fixed_2, bet_fixed_124)
            labels = ROW_LABELS if etype == "row" else GROUP_LABELS
            label = f"Baseline | {labels[eid]}"
            s = summarize_results(results, label)
            if s:
                s["label"] = label
                all_summaries.append(s)

    # ---- TEST 2: GPT filter ----
    print(f"\n{'#'*60}")
    print(f"# TEST 2: GPT Filter (targetRate≤0.5, trend≤-0.5, mean≥2)")
    print(f"{'#'*60}")

    for etype in ["row", "group"]:
        for eid in range(3):
            results = run_backtest(sessions, etype, eid,
                                   entry_gpt_filter, bet_fixed_124)
            labels = ROW_LABELS if etype == "row" else GROUP_LABELS
            label = f"GPT Filter | {labels[eid]}"
            s = summarize_results(results, label)
            if s:
                s["label"] = label
                all_summaries.append(s)

    # ---- TEST 3: Dynamic velocity entry ----
    print(f"\n{'#'*60}")
    print(f"# TEST 3: Dynamic Entry (gap velocity → adaptive skip 1/2/3)")
    print(f"{'#'*60}")

    for etype in ["row", "group"]:
        for eid in range(3):
            results = run_backtest(sessions, etype, eid,
                                   entry_dynamic_velocity, bet_adaptive_124)
            labels = ROW_LABELS if etype == "row" else GROUP_LABELS
            label = f"Dynamic Velocity | {labels[eid]}"
            s = summarize_results(results, label)
            if s:
                s["label"] = label
                all_summaries.append(s)
            detailed_entry_analysis(results, label)

    # ---- TEST 4: Variance contraction entry ----
    print(f"\n{'#'*60}")
    print(f"# TEST 4: Variance Contraction Signal")
    print(f"{'#'*60}")

    for etype in ["row", "group"]:
        for eid in range(3):
            results = run_backtest(sessions, etype, eid,
                                   entry_variance_signal, bet_adaptive_124)
            labels = ROW_LABELS if etype == "row" else GROUP_LABELS
            label = f"Var Contract | {labels[eid]}"
            s = summarize_results(results, label)
            if s:
                s["label"] = label
                all_summaries.append(s)
            detailed_entry_analysis(results, label)

    # ---- TEST 5: Gap Cliff (微观加速度) ----
    print(f"\n{'#'*60}")
    print(f"# TEST 5: Gap Cliff (last3/last6 acceleration)")
    print(f"{'#'*60}")

    for etype in ["row", "group"]:
        for eid in range(3):
            results = run_backtest(sessions, etype, eid,
                                   entry_gap_cliff, bet_adaptive_124)
            labels = ROW_LABELS if etype == "row" else GROUP_LABELS
            label = f"Gap Cliff | {labels[eid]}"
            s = summarize_results(results, label)
            if s:
                s["label"] = label
                all_summaries.append(s)
            detailed_entry_analysis(results, label)

    # ---- TEST 6: Best combo — Variance + Velocity entry + Adaptive velocity bets ----
    print(f"\n{'#'*60}")
    print(f"# TEST 6: Combo — Var Contract + Adaptive Velocity Bets")
    print(f"{'#'*60}")

    for etype in ["row", "group"]:
        for eid in range(3):
            results = run_backtest(sessions, etype, eid,
                                   entry_variance_signal, bet_adaptive_velocity)
            labels = ROW_LABELS if etype == "row" else GROUP_LABELS
            label = f"Combo | {labels[eid]}"
            s = summarize_results(results, label)
            if s:
                s["label"] = label
                all_summaries.append(s)

    # ---- Summary ranking ----
    print(f"\n{'#'*60}")
    print(f"# RANKING (by ROI)")
    print(f"{'#'*60}")
    all_summaries.sort(key=lambda x: x["roi"], reverse=True)
    for i, s in enumerate(all_summaries[:20]):
        print(f"  {i+1:2d}. {s['label']:<50s}  ROI={s['roi']:+.2f}%  "
              f"信号={s['signals']:4d}  净利={s['net']:+6.1f}  胜率={s['win_rate']:.1f}%  DD={s['max_dd']}")


if __name__ == "__main__":
    main()
