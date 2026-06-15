"""
Deep 124 Analysis — Focused on 1行, 3行, 一组
==============================================
1. Per-session P&L tracking
2. Optimal threshold surface search
3. Signal quality: when do wins vs losses happen?
4. Consecutive loss risk analysis
5. Time trend (session-by-session rolling ROI)
6. Signal overlap between entities
7. Combined portfolio
8. Recent data deep dive (last 20/30/40)
9. Condition contribution analysis

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json
import math
from collections import defaultdict
from statistics import mean, stdev, variance as pvar
from typing import List, Dict, Tuple, Optional, Callable

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
        tms = entry.get("tms", 0)
        if nums:
            sessions.append({"name": name, "numbers": nums, "tms": tms})
    sessions.sort(key=lambda s: s["tms"])
    return sessions


def get_group(n: int) -> Optional[int]:
    if n == 0: return None
    return (n - 1) // 12

def get_row(n: int) -> Optional[int]:
    if n == 0: return None
    rem = n % 3
    if rem == 1: return 2
    if rem == 2: return 1
    return 0

ROW_LABELS = {0: "1行(3,6,9…)", 1: "2行(2,5,8…)", 2: "3行(1,4,7…)"}
GRP_LABELS = {0: "一组(1-12)", 1: "二组(13-24)", 2: "三组(25-36)"}

# Focus entities
FOCUS = [
    {"label": "1行", "mapper": get_row, "target_id": 0, "entity_type": "row"},
    {"label": "3行", "mapper": get_row, "target_id": 2, "entity_type": "row"},
    {"label": "一组", "mapper": get_group, "target_id": 0, "entity_type": "group"},
]

# ============================================================
# Gap computation
# ============================================================

def compute_gaps(numbers: list, mapper, target_id: int) -> list:
    gaps = []
    prev_nz = -1
    nz = 0
    for n in numbers:
        if n == 0:
            continue
        eid = mapper(n)
        if eid == target_id:
            if prev_nz >= 0:
                gaps.append(nz - prev_nz - 1)
            prev_nz = nz
        nz += 1
    return gaps


# ============================================================
# Backtest engine (granular, per-signal)
# ============================================================

class Signal:
    def __init__(self, session_name, spin_idx, entry_skip, bet_plan,
                 outcome, hit_round, gap_at_entry,
                 recent_mean, recent_trend, recent_target_rate,
                 recent_var_ratio=None, gap_velocity=None):
        self.session_name = session_name
        self.spin_idx = spin_idx
        self.entry_skip = entry_skip
        self.bet_plan = bet_plan
        self.outcome = outcome
        self.hit_round = hit_round  # -1 = miss
        self.gap_at_entry = gap_at_entry
        self.recent_mean = recent_mean
        self.recent_trend = recent_trend
        self.recent_target_rate = recent_target_rate
        self.recent_var_ratio = recent_var_ratio
        self.gap_velocity = gap_velocity

    @property
    def is_win(self):
        return self.outcome > 0

    @property
    def total_bet(self):
        return sum(self.bet_plan)


def run_detailed_backtest(sessions, mapper, target_id,
                          entry_fn, bet_fn, min_gaps=36):
    """
    Returns list of Signal objects with full metadata.
    """
    signals = []

    for sess in sessions:
        nums = sess["numbers"]
        gaps = []
        prev_hit = -1
        nz_idx = 0
        bet_plan = []
        bet_round = 0
        invested = 0
        entry_skip = 0
        # Stats at entry time
        rec_mean = 0
        rec_trend = 0
        rec_tr = 0
        rec_var_ratio = 0
        gap_vel = 0

        for si, n in enumerate(nums):
            # Handle 0
            if n == 0:
                if bet_plan:
                    amt = bet_plan[bet_round] if bet_round < len(bet_plan) else 0
                    if amt > 0:
                        invested += amt
                        bet_round += 1
                        if bet_round >= len(bet_plan):
                            signals.append(Signal(
                                sess["name"], si, entry_skip, list(bet_plan),
                                -invested, -1, entry_skip,
                                rec_mean, rec_trend, rec_tr, rec_var_ratio, gap_vel))
                            bet_plan = []; bet_round = 0; invested = 0
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            # Resolve bet
            if bet_plan:
                amt = bet_plan[bet_round] if bet_round < len(bet_plan) else 0
                if is_target:
                    if amt > 0:
                        invested += amt
                    net = (3 * amt - invested) if amt > 0 else 0
                    signals.append(Signal(
                        sess["name"], si, entry_skip, list(bet_plan),
                        net, bet_round, entry_skip,
                        rec_mean, rec_trend, rec_tr, rec_var_ratio, gap_vel))
                    bet_plan = []; bet_round = 0; invested = 0
                else:
                    if amt > 0:
                        invested += amt
                        bet_round += 1
                    if bet_round >= len(bet_plan):
                        signals.append(Signal(
                            sess["name"], si, entry_skip, list(bet_plan),
                            -invested, -1, entry_skip,
                            rec_mean, rec_trend, rec_tr, rec_var_ratio, gap_vel))
                        bet_plan = []; bet_round = 0; invested = 0

            # Update gaps
            if is_target:
                if prev_hit >= 0:
                    gaps.append(nz_idx - prev_hit - 1)
                prev_hit = nz_idx
            nz_idx += 1

            cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

            # Entry check
            if not bet_plan and len(gaps) >= min_gaps:
                es = entry_fn(gaps, cs)
                if es is not None and es == cs:
                    # Record stats at entry
                    rg = gaps[-18:]
                    rec_mean = mean(rg) if rg else 0
                    pg = gaps[-36:-18] if len(gaps) >= 36 else gaps[:-18] if len(gaps) > 18 else rg
                    rec_trend = rec_mean - (mean(pg) if pg else rec_mean)
                    rec_tr = sum(1 for g in rg if 2 <= g <= 4) / len(rg) if rg else 0

                    # Variance ratio
                    r12 = gaps[-12:] if len(gaps) >= 12 else rg
                    pp12 = gaps[-24:-12] if len(gaps) >= 24 else gaps[:-12] if len(gaps) > 12 else r12
                    var12 = pvar(r12) if len(r12) >= 3 else 0
                    var24 = pvar(pp12) if len(pp12) >= 3 else 0
                    rec_var_ratio = var12 / var24 if var24 > 0 else 0

                    # Gap velocity
                    r6 = gaps[-6:]
                    p12_vel = gaps[-18:-6] if len(gaps) >= 18 else gaps[:-6] if len(gaps) > 6 else r6
                    m6 = mean(r6) if r6 else 0
                    mp12 = mean(p12_vel) if p12_vel else 0
                    gap_vel = (m6 - mp12) / mp12 if mp12 != 0 else 0

                    bet_plan = bet_fn(gaps, cs)
                    bet_round = 0
                    invested = 0
                    entry_skip = cs

    return signals


# ============================================================
# Entry functions
# ============================================================

def entry_baseline(gaps, cs):
    return 2 if cs == 2 else None

def make_gpt_entry(tr_max, trend_max, mean_min):
    def fn(gaps, cs):
        if cs != 2: return None
        if len(gaps) < 36: return None
        r18 = gaps[-18:]
        p18 = gaps[-36:-18]
        tr = sum(1 for g in r18 if 2 <= g <= 4) / 18
        trend = mean(r18) - mean(p18)
        if tr <= tr_max and trend <= trend_max and mean(r18) >= mean_min:
            return 2
        return None
    return fn

def make_velocity_entry(tr_max, vel_thresholds, mean_min):
    """
    vel_thresholds: dict mapping (vel_min, vel_max) -> target_skip
    """
    def fn(gaps, cs):
        if len(gaps) < 18: return None
        r18 = gaps[-18:]
        r6 = gaps[-6:]
        p12 = gaps[-18:-6]
        if len(p12) < 12: return None

        mean18 = mean(r18)
        m6 = mean(r6)
        m12 = mean(p12)
        vel = (m6 - m12) / m12 if m12 != 0 else 0
        tr = sum(1 for g in r18 if 2 <= g <= 4) / 18

        if mean18 < mean_min: return None
        if tr > tr_max: return None

        for (vmin, vmax), target_skip in vel_thresholds.items():
            if vmin <= vel < vmax:
                return target_skip if cs == target_skip else None
        return None
    return fn


# ============================================================
# Bet functions
# ============================================================

def bet_124(gaps, cs):
    return [1, 2, 4]

def bet_short(gaps, cs):
    return [1, 2]

def bet_adaptive(gaps, cs):
    if cs <= 1: return [1, 2, 4]
    if cs == 2: return [1, 2, 4]
    return [1, 2]

def bet_aggressive(gaps, cs):
    if cs <= 1: return [2, 4]
    if cs == 2: return [1, 3, 6]
    return [2, 4]


# ============================================================
# Analysis functions
# ============================================================

def summarize_signals(signals: List[Signal], label="", verbose=True):
    if not signals:
        return None

    total_bet = sum(s.total_bet for s in signals)
    total_win = sum(s.outcome + s.total_bet for s in signals)
    net = total_win - total_bet
    roi = (net / total_bet * 100) if total_bet > 0 else 0
    wins = sum(1 for s in signals if s.is_win)
    losses = sum(1 for s in signals if s.outcome < 0)
    zeros = sum(1 for s in signals if s.outcome == 0)

    # Hit distribution
    hit_rnd = defaultdict(int)
    for s in signals:
        hit_rnd[f"R{s.hit_round+1}" if s.hit_round >= 0 else "miss"] += 1

    # Entry breakdown
    by_entry = defaultdict(lambda: {"s": 0, "w": 0, "b": 0, "wa": 0})
    for s in signals:
        es = s.entry_skip
        by_entry[es]["s"] += 1
        by_entry[es]["b"] += s.total_bet
        by_entry[es]["wa"] += (s.outcome + s.total_bet)
        if s.is_win:
            by_entry[es]["w"] += 1

    # Per session
    sess_pnl = defaultdict(float)
    for s in signals:
        sess_pnl[s.session_name] += s.outcome

    pnls = list(sess_pnl.values())
    cum = 0; peak = 0; max_dd = 0
    for p in pnls:
        cum += p
        if cum > peak: peak = cum
        max_dd = max(max_dd, peak - cum)

    win_sess = sum(1 for p in pnls if p > 0)
    lose_sess = sum(1 for p in pnls if p < 0)
    flat_sess = sum(1 for p in pnls if p == 0)

    if verbose:
        print(f"\n  {'='*55}")
        print(f"  {label}")
        print(f"  {'='*55}")
        print(f"  信号:{len(signals)}  胜率:{wins/len(signals)*100:.1f}%  "
              f"ROI:{roi:+.2f}%  净利:{net:+.1f}  投入:{total_bet}  DD:{max_dd:.0f}")
        print(f"  赢/输/平: {wins}/{losses}/{zeros}  盈利局:{win_sess}  亏损局:{lose_sess}  平局:{flat_sess}")
        print(f"  命中分布: {dict(hit_rnd)}")
        for es in sorted(by_entry):
            e = by_entry[es]
            eroi = ((e["wa"]-e["b"])/e["b"]*100) if e["b"] > 0 else 0
            ewr = (e["w"]/e["s"]*100) if e["s"] > 0 else 0
            print(f"    skip={es}: {e['s']}信号, 胜率={ewr:.1f}%, ROI={eroi:+.2f}%")

    return {
        "signals": len(signals), "net": net, "roi": roi,
        "win_rate": wins/len(signals)*100, "total_bet": total_bet,
        "max_dd": max_dd, "win_sess": win_sess, "lose_sess": lose_sess,
        "by_entry": dict(by_entry), "per_session_pnl": dict(sess_pnl),
        "hit_rnd": dict(hit_rnd),
    }


def analyze_consecutive_losses(signals: List[Signal]):
    """Analyze streaks of losses — critical for bankroll management."""
    if not signals:
        return

    streaks = []
    current = 0
    current_loss = 0
    for s in signals:
        if s.outcome < 0:
            current += 1
            current_loss += s.total_bet
        else:
            if current > 0:
                streaks.append({"count": current, "total_loss": current_loss})
            current = 0
            current_loss = 0
    if current > 0:
        streaks.append({"count": current, "total_loss": current_loss})

    if not streaks:
        print("  无连败!")
        return

    counts = [s["count"] for s in streaks]
    losses = [s["total_loss"] for s in streaks]
    print(f"\n  --- 连败分析 ---")
    print(f"  总连败次数: {len(streaks)}")
    print(f"  最长连败: {max(counts)}次 (累计损失 {max(losses)})")
    print(f"  平均连败: {mean(counts):.1f}次")
    freq = defaultdict(int)
    for c in counts: freq[c] += 1
    print(f"  连败频率: {dict(sorted(freq.items()))}")

    return {"max_streak": max(counts), "max_streak_loss": max(losses),
            "avg_streak": mean(counts), "streak_freq": dict(freq)}


def analyze_win_loss_profile(signals: List[Signal], label=""):
    """Compare feature distributions of wins vs losses."""
    wins = [s for s in signals if s.is_win]
    losses = [s for s in signals if s.outcome < 0]

    if not wins or not losses:
        return

    features = [
        ("recent_mean", "最近18gap均值"),
        ("recent_trend", "趋势(trend)"),
        ("recent_target_rate", "2-4比例(targetRate)"),
        ("gap_velocity", "Gap速度"),
        ("recent_var_ratio", "方差比"),
    ]

    print(f"\n  --- Win/Loss 特征对比 ({label}) ---")
    print(f"  {'特征':<25s} {'Win均值':>10s} {'Loss均值':>10s} {'差值':>10s} {'区分度':>10s}")
    print(f"  {'-'*65}")

    for attr, name in features:
        w_vals = [getattr(s, attr) for s in wins if getattr(s, attr) is not None]
        l_vals = [getattr(s, attr) for s in losses if getattr(s, attr) is not None]
        if not w_vals or not l_vals:
            continue
        wm = mean(w_vals)
        lm = mean(l_vals)
        diff = wm - lm
        # Cohen's d-like measure
        pooled_std = math.sqrt((stdev(w_vals)**2 + stdev(l_vals)**2) / 2) if len(w_vals) > 1 and len(l_vals) > 1 else 1
        discrimination = abs(diff) / pooled_std if pooled_std > 0 else 0
        bar = "█" * min(int(discrimination * 10), 20)
        print(f"  {name:<25s} {wm:>10.3f} {lm:>10.3f} {diff:>+10.3f} {discrimination:>10.3f}  {bar}")


def analyze_time_trend(signals: List[Signal], sessions: list, window=20):
    """Rolling ROI over sessions."""
    if not signals:
        return

    # Map signal to session order
    sess_order = {s["name"]: i for i, s in enumerate(sessions)}
    sig_by_sess = defaultdict(list)
    for sig in signals:
        sig_by_sess[sig.session_name].append(sig)

    # Sort sessions by time
    sorted_sessions = sorted(sessions, key=lambda s: s["tms"])
    rolling_roi = []
    rolling_dates = []

    for i in range(window - 1, len(sorted_sessions)):
        window_sessions = sorted_sessions[i-window+1:i+1]
        total_bet = 0; total_ret = 0; count = 0
        for sess in window_sessions:
            for sig in sig_by_sess.get(sess["name"], []):
                total_bet += sig.total_bet
                total_ret += (sig.outcome + sig.total_bet)
                count += 1
        roi = ((total_ret - total_bet) / total_bet * 100) if total_bet > 0 else 0
        rolling_roi.append(roi)
        rolling_dates.append(window_sessions[-1]["name"][:15])

    print(f"\n  --- 滚动ROI (窗口={window}局) ---")
    # Print every 5th point for readability
    for i in range(0, len(rolling_roi), max(1, len(rolling_roi)//15)):
        print(f"  {rolling_dates[i]}: ROI={rolling_roi[i]:+.2f}%")

    # Summary
    pos_windows = sum(1 for r in rolling_roi if r > 0)
    print(f"  正向窗口: {pos_windows}/{len(rolling_roi)} ({pos_windows/len(rolling_roi)*100:.0f}%)")
    print(f"  平均滚动ROI: {mean(rolling_roi):+.2f}%")
    print(f"  最差滚动ROI: {min(rolling_roi):+.2f}%")
    print(f"  最佳滚动ROI: {max(rolling_roi):+.2f}%")

    return rolling_roi, rolling_dates


def threshold_surface_search(sessions, mapper, target_id, label):
    """
    Grid search over targetRate, trend, and mean thresholds
    to find the optimal combination for individual entities.
    """
    print(f"\n{'='*60}")
    print(f"  THRESHOLD SURFACE: {label}")
    print(f"{'='*60}")

    tr_range = [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]
    trend_range = [-0.50, -0.40, -0.30, -0.25, -0.20, -0.15, -0.10, 0.0]
    mean_range = [1.2, 1.5, 1.8, 2.0, 2.2, 2.5]

    best_roi = -999
    best_params = None
    best_summary = None
    results_grid = []

    for tr_max in tr_range:
        for trend_max in trend_range:
            for mean_min in mean_range:
                entry_fn = make_gpt_entry(tr_max, trend_max, mean_min)
                sigs = run_detailed_backtest(sessions, mapper, target_id,
                                             entry_fn, bet_124, min_gaps=36)
                if not sigs:
                    continue
                s = summarize_signals(sigs, verbose=False)
                if s and s["signals"] >= 30:
                    results_grid.append({
                        "tr_max": tr_max, "trend_max": trend_max, "mean_min": mean_min,
                        "roi": s["roi"], "signals": s["signals"],
                        "win_rate": s["win_rate"], "max_dd": s["max_dd"],
                        "net": s["net"],
                    })
                    if s["roi"] > best_roi:
                        best_roi = s["roi"]
                        best_params = (tr_max, trend_max, mean_min)
                        best_summary = s

    # Sort and display top results
    results_grid.sort(key=lambda x: x["roi"], reverse=True)

    print(f"\n  Top 15 parameter combinations (by ROI):")
    print(f"  {'tr≤':>6s} {'trend≤':>8s} {'mean≥':>7s} {'ROI':>8s} {'信号':>6s} {'胜率':>7s} {'DD':>5s}")
    print(f"  {'-'*50}")
    for r in results_grid[:15]:
        print(f"  {r['tr_max']:>6.2f} {r['trend_max']:>8.2f} {r['mean_min']:>7.1f} "
              f"{r['roi']:>+7.2f}% {r['signals']:>6d} {r['win_rate']:>6.1f}% {r['max_dd']:>5.0f}")

    if best_params:
        print(f"\n  ★ BEST: tr≤{best_params[0]}, trend≤{best_params[1]}, mean≥{best_params[2]}")
        print(f"     ROI={best_roi:+.2f}%, 信号={best_summary['signals']}, "
              f"胜率={best_summary['win_rate']:.1f}%, DD={best_summary['max_dd']:.0f}")

    return best_params, best_summary, results_grid


def analyze_signal_overlap(signals_by_entity: Dict[str, List[Signal]]):
    """
    Analyze how signals from different entities overlap in time.
    Can we combine 1行 + 3行 + 一组 into a portfolio?
    """
    print(f"\n{'='*60}")
    print(f"  SIGNAL OVERLAP & PORTFOLIO ANALYSIS")
    print(f"{'='*60}")

    # Build timeline: for each session, track which entities have active signals
    entity_names = list(signals_by_entity.keys())
    if len(entity_names) < 2:
        print("  Need at least 2 entities for overlap analysis")
        return

    # Collect all signals with their spin indices per session
    # A signal is "active" from entry_spin_idx to entry_spin_idx + len(bet_plan)
    # For overlap, we care about signals that start at the same approximate time

    # Simple approach: group signals by session, then check time proximity
    all_signals = []
    for ent_name, signals in signals_by_entity.items():
        for s in signals:
            all_signals.append((ent_name, s))

    # Sort by session name then spin index
    all_signals.sort(key=lambda x: (x[1].session_name, x[1].spin_idx))

    # Find signals that fire within 3 spins of each other (overlapping entries)
    overlaps = defaultdict(int)
    solo = defaultdict(int)
    total_per_entity = defaultdict(int)

    for ent_name in entity_names:
        total_per_entity[ent_name] = len(signals_by_entity[ent_name])

    # Group by session
    by_session = defaultdict(list)
    for ent_name, sig in all_signals:
        by_session[sig.session_name].append((ent_name, sig))

    for sess_name, sess_signals in by_session.items():
        sess_signals.sort(key=lambda x: x[1].spin_idx)
        for i, (ent1, s1) in enumerate(sess_signals):
            overlaps_found = False
            for j, (ent2, s2) in enumerate(sess_signals):
                if i >= j: continue
                # If two signals start within 5 spins, they overlap
                if abs(s1.spin_idx - s2.spin_idx) <= 5:
                    pair = tuple(sorted([ent1, ent2]))
                    overlaps[str(pair)] += 1
                    overlaps_found = True
            if not overlaps_found:
                solo[ent1] += 1

    print(f"\n  Per-entity signal counts:")
    for ent in entity_names:
        print(f"    {ent}: {total_per_entity[ent]} signals")

    print(f"\n  Overlap counts (within 5 spins):")
    for pair, count in sorted(overlaps.items(), key=lambda x: -x[1]):
        print(f"    {pair}: {count} overlaps")

    print(f"\n  Solo signals (no overlap):")
    for ent in entity_names:
        s = solo.get(ent, 0)
        print(f"    {ent}: {s} solo ({s/total_per_entity[ent]*100:.1f}%)" if total_per_entity[ent] > 0 else f"    {ent}: 0")

    # Combined portfolio: if we bet on all signals independently
    print(f"\n  --- Combined Portfolio ---")
    combined_signals = []
    for ent_name in entity_names:
        combined_signals.extend(signals_by_entity[ent_name])
    summarize_signals(combined_signals, "组合(1行+3行+一组)")

    # Deduped: only take the first signal when multiple fire close together
    deduped = []
    used_spins = defaultdict(set)
    for ent_name, sig in sorted(all_signals, key=lambda x: (x[1].session_name, x[1].spin_idx)):
        sess = sig.session_name
        # Check if any signal already used a nearby spin
        is_dup = False
        for check_spin in range(sig.spin_idx - 3, sig.spin_idx + 4):
            if check_spin in used_spins[sess]:
                is_dup = True
                break
        if not is_dup:
            deduped.append(sig)
            for check_spin in range(sig.spin_idx, sig.spin_idx + len(sig.bet_plan) + 1):
                used_spins[sess].add(check_spin)

    if deduped:
        deduped_signals = [Signal(
            s.session_name, s.spin_idx, s.entry_skip, s.bet_plan,
            s.outcome, s.hit_round, s.gap_at_entry,
            s.recent_mean, s.recent_trend, s.recent_target_rate
        ) for s in deduped]
        print(f"\n  --- Deduped Portfolio (first signal wins) ---")
        summarize_signals(deduped_signals, "去重组合")


# ============================================================
# Recent data deep dive
# ============================================================

def recent_deep_dive(sessions, mapper, target_id, label, best_params, n_recent=30):
    """Detailed analysis of last N sessions."""
    recent = sessions[-n_recent:]
    print(f"\n{'='*60}")
    print(f"  RECENT {n_recent} SESSIONS DEEP DIVE: {label}")
    print(f"  Range: {recent[0]['name']} → {recent[-1]['name']}")
    print(f"{'='*60}")

    tr_max, trend_max, mean_min = best_params
    entry_fn = make_gpt_entry(tr_max, trend_max, mean_min)
    sigs = run_detailed_backtest(recent, mapper, target_id, entry_fn, bet_124, min_gaps=36)

    if not sigs:
        print("  NO SIGNALS in recent data!")
        return None

    s = summarize_signals(sigs, f"{label} (GPT: tr≤{tr_max}, trend≤{trend_max}, mean≥{mean_min})")
    analyze_consecutive_losses(sigs)
    analyze_win_loss_profile(sigs, label)

    # Per-session P&L table
    print(f"\n  --- 最近每局P&L ---")
    sess_order = {sess["name"]: i for i, sess in enumerate(recent)}
    sess_pnl = defaultdict(lambda: {"pnl": 0, "signals": 0, "wins": 0})
    for sig in sigs:
        sn = sig.session_name
        sess_pnl[sn]["pnl"] += sig.outcome
        sess_pnl[sn]["signals"] += 1
        if sig.is_win:
            sess_pnl[sn]["wins"] += 1

    for sess in recent:
        sn = sess["name"]
        if sn in sess_pnl:
            sp = sess_pnl[sn]
            print(f"  {sn[:25]:<30s} P&L={sp['pnl']:+6.1f}  信号={sp['signals']:2d}  胜={sp['wins']:2d}")

    return s


# ============================================================
# MAIN
# ============================================================

def main():
    path = "HistoryData/wzs-merged.json"
    print("Loading data...")
    sessions = load_sessions(path)
    print(f"Loaded {len(sessions)} sessions")
    print(f"Range: {sessions[0]['name']} → {sessions[-1]['name']}")
    total_nz = sum(sum(1 for n in s["numbers"] if n != 0) for s in sessions)
    print(f"Total non-zero spins: {total_nz}")

    # ============================================================
    # PART 1: Threshold surface search per entity
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 1: OPTIMAL THRESHOLD SURFACE SEARCH")
    print(f"{'#'*70}")

    best_params_per_entity = {}

    for ent in FOCUS:
        params, summary, grid = threshold_surface_search(
            sessions, ent["mapper"], ent["target_id"], ent["label"])
        if params:
            best_params_per_entity[ent["label"]] = params

    # ============================================================
    # PART 2: Detailed analysis with best params
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 2: DETAILED ANALYSIS WITH BEST PARAMETERS")
    print(f"{'#'*70}")

    all_entity_signals = {}

    for ent in FOCUS:
        label = ent["label"]
        if label not in best_params_per_entity:
            continue
        tr_max, trend_max, mean_min = best_params_per_entity[label]

        print(f"\n{'='*60}")
        print(f"  {label}: tr≤{tr_max}, trend≤{trend_max}, mean≥{mean_min}")
        print(f"{'='*60}")

        entry_fn = make_gpt_entry(tr_max, trend_max, mean_min)

        # Full backtest
        sigs = run_detailed_backtest(sessions, ent["mapper"], ent["target_id"],
                                     entry_fn, bet_124, min_gaps=36)
        all_entity_signals[label] = sigs

        summarize_signals(sigs, f"{label} GPT-Filter→124")
        analyze_consecutive_losses(sigs)
        analyze_win_loss_profile(sigs, label)

        # Time trend
        analyze_time_trend(sigs, sessions, window=30)

        # Per-year breakdown
        print(f"\n  --- 按年ROI ---")
        year_stats = defaultdict(lambda: {"b": 0, "w": 0, "s": 0})
        for sig in sigs:
            yr = sig.session_name[:4]
            year_stats[yr]["b"] += sig.total_bet
            year_stats[yr]["w"] += (sig.outcome + sig.total_bet)
            year_stats[yr]["s"] += 1
        for yr in sorted(year_stats):
            y = year_stats[yr]
            yroi = ((y["w"] - y["b"]) / y["b"] * 100) if y["b"] > 0 else 0
            print(f"    {yr}: {y['s']}信号, ROI={yroi:+.2f}%")

    # ============================================================
    # PART 3: Signal overlap & portfolio
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 3: SIGNAL OVERLAP & COMBINED PORTFOLIO")
    print(f"{'#'*70}")

    analyze_signal_overlap(all_entity_signals)

    # ============================================================
    # PART 4: Recent data deep dive
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 4: RECENT DATA DEEP DIVE")
    print(f"{'#'*70}")

    for ent in FOCUS:
        label = ent["label"]
        if label not in best_params_per_entity:
            continue
        recent_deep_dive(sessions, ent["mapper"], ent["target_id"],
                        label, best_params_per_entity[label], n_recent=30)

    # ============================================================
    # PART 5: Velocity-based dynamic entry (for comparison)
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# PART 5: VELOCITY-BASED DYNAMIC ENTRY (comparison)")
    print(f"{'#'*70}")

    # Best velocity thresholds from v3 analysis
    vel_thresholds = {
        (-999, -0.25): 1,
        (-0.25, -0.10): 2,
        (-0.10, 999): 3,
    }

    for ent in FOCUS:
        label = ent["label"]
        entry_fn = make_velocity_entry(tr_max=0.45, vel_thresholds=vel_thresholds, mean_min=1.5)
        sigs = run_detailed_backtest(sessions, ent["mapper"], ent["target_id"],
                                     entry_fn, bet_short, min_gaps=18)
        s = summarize_signals(sigs, f"{label} Velocity→Short")
        if s:
            analyze_consecutive_losses(sigs)

    # ============================================================
    # FINAL SUMMARY
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# FINAL SUMMARY")
    print(f"{'#'*70}")

    for label, params in best_params_per_entity.items():
        print(f"\n  ★ {label}: tr≤{params[0]}, trend≤{params[1]}, mean≥{params[2]}")
        sigs = all_entity_signals.get(label, [])
        if sigs:
            total_bet = sum(s.total_bet for s in sigs)
            total_ret = sum(s.outcome + s.total_bet for s in sigs)
            net = total_ret - total_bet
            roi = (net / total_bet * 100) if total_bet > 0 else 0
            wr = sum(1 for s in sigs if s.is_win) / len(sigs) * 100 if sigs else 0
            print(f"     信号={len(sigs)}, ROI={roi:+.2f}%, 胜率={wr:.1f}%, 净利={net:+.1f}")


if __name__ == "__main__":
    main()
