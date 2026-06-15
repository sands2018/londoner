"""
Drift-Aware 124 Backtest
========================
Uses skip=2 outcomes as a "market thermometer" to determine
which entry skip to use at any given moment.

Phase detection (from skip=2 hypothetical outcomes):
  COLD:    last skip=2 was a loss, NOT following a streak
           → Enter at skip=4 (deep pullback entry)
  COOLING: last skip=2 was a loss, immediately after a streak
           → Enter at skip=3 (moderate wait)
  WARMING: last skip=2 was a win (exactly 1 consecutive)
           → Enter at skip=1 (aggressive early)
  HOT:     skip=2 won 2+ times consecutively
           → Enter at skip=2 (confirmed streak)

All entries use [1,2,4] progression for fair comparison.

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json
from collections import defaultdict
from statistics import mean
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

# ============================================================
# Strategy
# ============================================================

class DriftStrategy:
    """
    Tracks phase per entity and decides entry skip dynamically.

    Phase state machine:
      COLD ──(skip=2 wins once)──> WARMING
      COLD ──(skip=2 loses)──────> COLD (stay)
      WARMING ──(skip=1 entry wins)──> HOT (skip=2 streak confirmed)
      WARMING ──(skip=1 entry loses)─> COLD
      HOT ──(skip=2 wins)────────> HOT (stay)
      HOT ──(skip=2 loses)───────> COOLING
      COOLING ──(skip=3 wins)────> WARMING
      COOLING ──(skip=3 loses)───> COLD
    """

    def __init__(self):
        # Per-entity state
        self.state = {}  # key -> "COLD"|"WARMING"|"HOT"|"COOLING"
        self.skip2_win_streak = {}  # key -> int
        self.was_streak_end = {}  # key -> bool (just ended a streak?)
        self.streak_ended_len = {}  # key -> int (length of streak that just ended)

        # Results
        self.signals = []  # list of dicts with full info

    def _key(self, entity_type, entity_id):
        return f"{entity_type}_{entity_id}"

    def _get_state(self, entity_type, entity_id):
        k = self._key(entity_type, entity_id)
        return self.state.get(k, "COLD")

    def _get_skip2_streak(self, entity_type, entity_id):
        k = self._key(entity_type, entity_id)
        return self.skip2_win_streak.get(k, 0)

    def get_entry_skip(self, entity_type, entity_id):
        """What skip should we enter at RIGHT NOW?"""
        state = self._get_state(entity_type, entity_id)
        if state == "COLD":
            return 4
        elif state == "WARMING":
            return 1
        elif state == "HOT":
            return 2
        elif state == "COOLING":
            return 3
        return 2  # fallback

    def update_skip2_hypothetical(self, entity_type, entity_id, won):
        """
        Update phase based on a hypothetical skip=2 outcome.
        This is the "market thermometer" — we track skip=2 outcomes
        even when we don't actually bet at skip=2.
        """
        k = self._key(entity_type, entity_id)
        old_streak = self.skip2_win_streak.get(k, 0)
        old_state = self.state.get(k, "COLD")

        if won:
            if old_streak >= 2:
                # Already HOT, stay HOT
                self.skip2_win_streak[k] = old_streak + 1
                self.state[k] = "HOT"
            elif old_streak == 1:
                # Second consecutive win → HOT
                self.skip2_win_streak[k] = 2
                self.state[k] = "HOT"
            else:
                # First win → WARMING
                self.skip2_win_streak[k] = 1
                self.state[k] = "WARMING"
            self.was_streak_end[k] = False
        else:
            # Loss
            if old_streak >= 2:
                # Streak just ended → COOLING
                self.streak_ended_len[k] = old_streak
                self.was_streak_end[k] = True
                self.state[k] = "COOLING"
            elif old_streak == 1:
                # Was warming, now lost → COLD
                self.state[k] = "COLD"
                self.was_streak_end[k] = False
            else:
                # Was already COLD or COOLING → COLD
                self.state[k] = "COLD"
                self.was_streak_end[k] = False
            self.skip2_win_streak[k] = 0

    def update_actual_outcome(self, entity_type, entity_id, entry_skip, won, net_profit, session_name, spin_idx):
        """Record an actual bet outcome."""
        state_at_entry = self._get_state(entity_type, entity_id)
        self.signals.append({
            "session": session_name,
            "spin": spin_idx,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entry_skip": entry_skip,
            "won": won,
            "net_profit": net_profit,
            "state": state_at_entry,
            "skip2_streak": self._get_skip2_streak(entity_type, entity_id),
        })

        # If we entered at skip=2, the outcome ALSO updates our phase
        # (skip=2 entries serve dual purpose: bet + thermometer)
        if entry_skip == 2:
            self.update_skip2_hypothetical(entity_type, entity_id, won)
        # For other skip levels, the outcome informs us but doesn't directly
        # update the skip=2 thermometer (that's updated separately by hypothetical)


# ============================================================
# Backtest Engine
# ============================================================

class BacktestEngine:
    def __init__(self, sessions, mapper, target_id, entity_type, entity_label):
        self.sessions = sessions
        self.mapper = mapper
        self.target_id = target_id
        self.entity_type = entity_type
        self.entity_label = entity_label

    def run(self, strategy: DriftStrategy):
        """
        Walk through all sessions spin by spin.
        At each spin:
        1. Track gap sequence
        2. Track hypothetical skip=2 outcomes (thermometer)
        3. Check if we should enter at the current skip level
        4. If we enter, track the bet through resolution
        """
        entity_type = self.entity_type
        entity_id = self.target_id

        for sess in self.sessions:
            nums = sess["numbers"]
            gaps = []
            prev_hit = -1
            nz_idx = 0

            # Active bets (can have multiple at different skip levels if they don't overlap)
            active_bets = {}  # entry_spin -> {entry_skip, bet_round, invested}

            # Hypothetical skip=2 tracking
            hypo_skip2_bets = {}  # entry_spin -> {bet_round}

            for si, n in enumerate(nums):
                if n == 0:
                    # Advance all active bets (they all lose on 0)
                    self._advance_bets(active_bets, strategy, sess["name"], si,
                                      entity_type, entity_id, is_hit=False)
                    self._advance_hypo_skip2(hypo_skip2_bets, strategy,
                                            entity_type, entity_id, is_hit=False)
                    continue

                eid = self.mapper(n)
                is_target = (eid == entity_id)

                # Resolve active bets
                self._advance_bets(active_bets, strategy, sess["name"], si,
                                  entity_type, entity_id, is_hit=is_target)

                # Resolve hypothetical skip=2 bets
                self._advance_hypo_skip2(hypo_skip2_bets, strategy,
                                        entity_type, entity_id, is_hit=is_target)

                # Update gaps
                if is_target:
                    if prev_hit >= 0:
                        gaps.append(nz_idx - prev_hit - 1)
                    prev_hit = nz_idx
                nz_idx += 1

                cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

                # Check entry
                if len(gaps) >= 12:
                    target_skip = strategy.get_entry_skip(entity_type, entity_id)
                    if cs == target_skip and not active_bets:
                        # Enter!
                        active_bets[si] = {
                            "entry_skip": target_skip,
                            "bet_round": 0,
                            "invested": 0,
                            "state": strategy._get_state(entity_type, entity_id),
                        }

                # Always track hypothetical skip=2
                if cs == 2 and not hypo_skip2_bets and len(gaps) >= 12:
                    hypo_skip2_bets[si] = {"bet_round": 0}

    def _advance_bets(self, active_bets, strategy, session_name, spin_idx,
                      entity_type, entity_id, is_hit):
        to_remove = []
        for entry_spin, bet in list(active_bets.items()):
            br = bet["bet_round"]
            if is_hit:
                # Win!
                if br == 0:
                    net = 2   # bet 1
                elif br == 1:
                    net = 3   # bet 1+2=3
                else:
                    net = 5   # bet 1+2+4=7
                strategy.update_actual_outcome(
                    entity_type, entity_id, bet["entry_skip"], True, net,
                    session_name, spin_idx)
                to_remove.append(entry_spin)
            else:
                br += 1
                if br >= 3:
                    # Lose
                    strategy.update_actual_outcome(
                        entity_type, entity_id, bet["entry_skip"], False, -7,
                        session_name, spin_idx)
                    to_remove.append(entry_spin)
                else:
                    active_bets[entry_spin]["bet_round"] = br

        for es in to_remove:
            del active_bets[es]

    def _advance_hypo_skip2(self, hypo_bets, strategy, entity_type, entity_id, is_hit):
        """Track hypothetical skip=2 outcomes for phase detection."""
        to_remove = []
        for entry_spin, bet in list(hypo_bets.items()):
            br = bet["bet_round"]
            if is_hit:
                strategy.update_skip2_hypothetical(entity_type, entity_id, True)
                to_remove.append(entry_spin)
            else:
                br += 1
                if br >= 3:
                    strategy.update_skip2_hypothetical(entity_type, entity_id, False)
                    to_remove.append(entry_spin)
                else:
                    hypo_bets[entry_spin]["bet_round"] = br

        for es in to_remove:
            del hypo_bets[es]


# ============================================================
# Baseline strategy (fixed skip=2) for comparison
# ============================================================

class BaselineStrategy:
    def __init__(self):
        self.signals = []
        self.state = {}
        self.skip2_win_streak = {}

    def _key(self, entity_type, entity_id):
        return f"{entity_type}_{entity_id}"

    def _get_state(self, entity_type, entity_id):
        return "BASELINE"

    def _get_skip2_streak(self, entity_type, entity_id):
        return 0

    def get_entry_skip(self, entity_type, entity_id):
        return 2  # Always skip=2

    def update_skip2_hypothetical(self, *args):
        pass  # Baseline doesn't need thermometer

    def update_actual_outcome(self, entity_type, entity_id, entry_skip, won, net_profit, session_name, spin_idx):
        self.signals.append({
            "session": session_name,
            "spin": spin_idx,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "entry_skip": entry_skip,
            "won": won,
            "net_profit": net_profit,
            "state": "BASELINE",
            "skip2_streak": 0,
        })


def run_baseline(sessions, mapper, target_id, entity_type, entity_label):
    """Fixed skip=2 baseline."""
    strategy = BaselineStrategy()
    engine = BacktestEngine(sessions, mapper, target_id, entity_type, entity_label)
    # Override to always use skip=2
    engine.run(strategy)
    return strategy.signals


def run_drift(sessions, mapper, target_id, entity_type, entity_label):
    """Drift-aware strategy."""
    strategy = DriftStrategy()
    engine = BacktestEngine(sessions, mapper, target_id, entity_type, entity_label)
    engine.run(strategy)
    return strategy.signals


# ============================================================
# Variant 2: Aggressive drift (skip=1 earlier)
# ============================================================

class AggressiveDriftStrategy(DriftStrategy):
    """More aggressive: enters at skip=1 in COLD as well (not skip=4)"""

    def get_entry_skip(self, entity_type, entity_id):
        state = self._get_state(entity_type, entity_id)
        if state == "COLD":
            return 1  # Aggressive: try skip=1 even in cold
        elif state == "WARMING":
            return 1
        elif state == "HOT":
            return 2
        elif state == "COOLING":
            return 3
        return 2


# ============================================================
# Variant 3: Conservative drift (wider spreads)
# ============================================================

class ConservativeDriftStrategy(DriftStrategy):
    """More conservative: uses skip=4 in COLD, skip=2 only in confirmed HOT"""

    def get_entry_skip(self, entity_type, entity_id):
        state = self._get_state(entity_type, entity_id)
        streak = self._get_skip2_streak(entity_type, entity_id)

        if state == "COLD":
            return 4  # Very conservative
        elif state == "WARMING":
            return 2  # Enter at skip=2 immediately when warming (don't wait for skip=1)
        elif state == "HOT":
            if streak >= 4:
                return 3  # Very hot for a while → drift wider to skip=3
            return 2
        elif state == "COOLING":
            return 4  # Wait for deep pullback after cooling
        return 2


# ============================================================
# Variant 4: Streak-length aware
# ============================================================

class StreakAwareDriftStrategy(DriftStrategy):
    """
    Adjusts entry based on how long the streak has been going.
    Early streak: aggressive (skip=1)
    Mid streak: standard (skip=2)
    Late streak: drift to skip=3 (anticipating cooldown)
    """

    def get_entry_skip(self, entity_type, entity_id):
        state = self._get_state(entity_type, entity_id)
        streak = self._get_skip2_streak(entity_type, entity_id)

        if state == "COLD":
            return 4
        elif state == "WARMING":
            return 1
        elif state == "HOT":
            if streak <= 3:
                return 2  # Early hot: standard
            elif streak <= 6:
                return 2  # Mid hot: still standard but watching
            else:
                return 3  # Late hot (7+): drift to skip=3, streak may be ending
        elif state == "COOLING":
            return 4  # Wait it out
        return 2


# ============================================================
# Reporting
# ============================================================

def analyze_signals(signals, label, sessions):
    """Comprehensive signal analysis."""
    if not signals:
        print(f"\n  {label}: NO SIGNALS")
        return None

    total_bet = len(signals) * 7  # Each 124 sequence risks 7 units
    total_net = sum(s["net_profit"] for s in signals)
    total_ret = total_bet + total_net
    roi = total_net / total_bet * 100
    wins = sum(1 for s in signals if s["won"])
    losses = sum(1 for s in signals if not s["won"])
    wr = wins / len(signals) * 100

    # Per session
    sess_pnl = defaultdict(float)
    sess_sigs = defaultdict(int)
    for s in signals:
        sess_pnl[s["session"]] += s["net_profit"]
        sess_sigs[s["session"]] += 1

    pnls = [sess_pnl.get(sess["name"], 0) for sess in sessions]
    cum = 0; peak = 0; max_dd = 0
    for p in pnls:
        cum += p
        if cum > peak: peak = cum
        max_dd = max(max_dd, peak - cum)

    win_sess = sum(1 for p in pnls if p > 0)
    lose_sess = sum(1 for p in pnls if p < 0)

    # By state
    state_stats = defaultdict(lambda: {"signals": 0, "wins": 0, "net": 0})
    for s in signals:
        st = s.get("state", "?")
        state_stats[st]["signals"] += 1
        if s["won"]:
            state_stats[st]["wins"] += 1
        state_stats[st]["net"] += s["net_profit"]

    # By entry skip
    skip_stats = defaultdict(lambda: {"signals": 0, "wins": 0, "net": 0})
    for s in signals:
        sk = s["entry_skip"]
        skip_stats[sk]["signals"] += 1
        if s["won"]:
            skip_stats[sk]["wins"] += 1
        skip_stats[sk]["net"] += s["net_profit"]

    # Consecutive losses
    max_consec_loss = 0
    curr_consec = 0
    consec_loss_total = 0
    for s in signals:
        if not s["won"]:
            curr_consec += 1
            consec_loss_total += 7
            max_consec_loss = max(max_consec_loss, curr_consec)
        else:
            curr_consec = 0
            consec_loss_total = 0

    # Yearly ROI
    year_stats = defaultdict(lambda: {"signals": 0, "net": 0})
    for s in signals:
        yr = s["session"][:4] if s["session"][:4].isdigit() else s["session"][:8]
        year_stats[yr]["signals"] += 1
        year_stats[yr]["net"] += s["net_profit"]

    print(f"\n  {'='*60}")
    print(f"  {label}")
    print(f"  {'='*60}")
    print(f"  总信号: {len(signals)}")
    print(f"  赢/输: {wins}/{losses}  胜率: {wr:.1f}%")
    print(f"  总净利: {total_net:+.1f}  总投入: {total_bet}  ROI: {roi:+.2f}%")
    print(f"  盈利局: {win_sess}  亏损局: {lose_sess}  最大回撤: {max_dd:.0f}")
    print(f"  最长连败: {max_consec_loss}次")
    print(f"  平均每局信号: {len(signals)/len(sessions):.1f}")

    print(f"\n  --- 按入场轮次 ---")
    for sk in sorted(skip_stats.keys()):
        ss = skip_stats[sk]
        wr_sk = ss["wins"] / ss["signals"] * 100 if ss["signals"] > 0 else 0
        print(f"  skip={sk}: {ss['signals']}信号, 胜率={wr_sk:.1f}%, 净利={ss['net']:+.1f}")

    print(f"\n  --- 按阶段 ---")
    for st in ["COLD", "WARMING", "HOT", "COOLING", "BASELINE", "?"]:
        if st in state_stats:
            ss = state_stats[st]
            wr_st = ss["wins"] / ss["signals"] * 100 if ss["signals"] > 0 else 0
            print(f"  {st}: {ss['signals']}信号, 胜率={wr_st:.1f}%, 净利={ss['net']:+.1f}")

    print(f"\n  --- 按年 ---")
    for yr in sorted(year_stats.keys()):
        ys = year_stats[yr]
        yroi = ys["net"] / (ys["signals"] * 7) * 100 if ys["signals"] > 0 else 0
        print(f"  {yr}: {ys['signals']}信号, 净利={ys['net']:+.1f}, ROI={yroi:+.2f}%")

    return {
        "label": label,
        "signals": len(signals),
        "roi": roi,
        "net": total_net,
        "wr": wr,
        "max_dd": max_dd,
        "max_consec_loss": max_consec_loss,
    }


# ============================================================
# MAIN
# ============================================================

def main():
    path = "HistoryData/wzs-merged.json"
    print("Loading data...")
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    print(f"{len(sessions)} sessions, {sessions[0]['name']} → {sessions[-1]['name']}")

    entities = [
        (get_row, 0, "row", "1行"),
        (get_row, 2, "row", "3行"),
        (get_group, 0, "group", "一组"),
    ]

    all_results = []

    for mapper, target_id, etype, elabel in entities:
        print(f"\n{'#'*70}")
        print(f"# {elabel}")
        print(f"{'#'*70}")

        # Baseline: fixed skip=2
        base_sigs = run_baseline(sessions, mapper, target_id, etype, elabel)
        r = analyze_signals(base_sigs, f"BASELINE (fixed skip=2) | {elabel}", sessions)
        if r: all_results.append(r)

        # Drift strategy
        drift_sigs = run_drift(sessions, mapper, target_id, etype, elabel)
        r = analyze_signals(drift_sigs, f"DRIFT (adaptive) | {elabel}", sessions)
        if r: all_results.append(r)

        # Aggressive drift
        agg = AggressiveDriftStrategy()
        engine = BacktestEngine(sessions, mapper, target_id, etype, elabel)
        engine.run(agg)
        r = analyze_signals(agg.signals, f"AGGRESSIVE DRIFT | {elabel}", sessions)
        if r: all_results.append(r)

        # Conservative drift
        cons = ConservativeDriftStrategy()
        engine = BacktestEngine(sessions, mapper, target_id, etype, elabel)
        engine.run(cons)
        r = analyze_signals(cons.signals, f"CONSERVATIVE DRIFT | {elabel}", sessions)
        if r: all_results.append(r)

        # Streak-aware drift
        sa = StreakAwareDriftStrategy()
        engine = BacktestEngine(sessions, mapper, target_id, etype, elabel)
        engine.run(sa)
        r = analyze_signals(sa.signals, f"STREAK-AWARE DRIFT | {elabel}", sessions)
        if r: all_results.append(r)

    # ============================================================
    # RANKING
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# FINAL RANKING")
    print(f"{'#'*70}")
    all_results.sort(key=lambda x: x["roi"], reverse=True)
    print(f"\n  {'Rank':<5s} {'Strategy':<45s} {'ROI':>8s} {'Signals':>8s} {'Net':>8s} {'WR':>7s} {'DD':>6s} {'MaxLL':>6s}")
    print(f"  {'-'*90}")
    for i, r in enumerate(all_results):
        print(f"  {i+1:<5d} {r['label']:<45s} {r['roi']:>+7.2f}% {r['signals']:>8d} {r['net']:>+8.1f} {r['wr']:>6.1f}% {r['max_dd']:>6.0f} {r['max_consec_loss']:>6d}")

    # ============================================================
    # Combined portfolio
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# COMBINED PORTFOLIO (best drift variant for each entity)")
    print(f"{'#'*70}")

    # Combine signals from best strategy per entity
    combined = []
    for mapper, target_id, etype, elabel in entities:
        if elabel == "1行":
            strategy = StreakAwareDriftStrategy()
        elif elabel == "3行":
            strategy = DriftStrategy()
        else:
            strategy = DriftStrategy()
        engine = BacktestEngine(sessions, mapper, target_id, etype, elabel)
        engine.run(strategy)
        combined.extend(strategy.signals)

    analyze_signals(combined, "COMBINED DRIFT (best per entity)", sessions)


if __name__ == "__main__":
    main()
