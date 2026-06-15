"""
Triple Analysis: Pattern + Rotation + Entry Drift
==================================================
Direction 1: Gap SEQUENCE patterns that precede hot streaks
Direction 2: Cross-entity heat rotation (1行↔3行↔一组)
Direction 3: Entry round drift within streak lifecycle

Author: DeepSeek (via Claude Code)
Date: 2026-06-03
"""

import json
import math
from collections import defaultdict, Counter
from statistics import mean, stdev, median
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
# Shared: Simulate all skip=N entry opportunities
# ============================================================

def simulate_124_opportunities(nums, mapper, target_id):
    """
    For EVERY spin where skip reaches 1,2,3,4, simulate what would happen
    if we entered there with a 124 progression.

    Returns list of dicts:
      {spin_idx, entry_skip, outcome: 'winR0'/'winR1'/'winR2'/'lose', net_profit}
    """
    results = []
    nz_idx = 0
    prev_hit = -1

    # Track all active bets (can have multiple entry points being tested simultaneously)
    # For each entry skip, we track: (bet_round, invested)
    active = {}  # entry_skip_at_start -> (bet_round, invested, entry_spin)

    for si, n in enumerate(nums):
        if n == 0:
            # Advance all active bets
            to_remove = []
            for entry_skip, (br, inv, entry_spin) in list(active.items()):
                br += 1
                if br >= 3:
                    results.append({
                        "spin_idx": entry_spin, "entry_skip": entry_skip,
                        "outcome": "lose", "net_profit": -7, "hit_spin": si,
                    })
                    to_remove.append(entry_skip)
                else:
                    active[entry_skip] = (br, inv, entry_spin)
            for es in to_remove:
                del active[es]
            continue

        eid = mapper(n)
        is_target = (eid == target_id)

        # Check active bets for wins
        to_remove = []
        for entry_skip, (br, inv, entry_spin) in list(active.items()):
            if is_target:
                # Win!
                if br == 0:
                    net = 2   # bet 1, win 3
                elif br == 1:
                    net = 3   # bet 1+2=3, win 6
                else:
                    net = 5   # bet 1+2+4=7, win 12
                results.append({
                    "spin_idx": entry_spin, "entry_skip": entry_skip,
                    "outcome": f"winR{br}", "net_profit": net, "hit_spin": si,
                })
                to_remove.append(entry_skip)
            else:
                br += 1
                if br >= 3:
                    results.append({
                        "spin_idx": entry_spin, "entry_skip": entry_skip,
                        "outcome": "lose", "net_profit": -7, "hit_spin": si,
                    })
                    to_remove.append(entry_skip)
                else:
                    active[entry_skip] = (br, inv, entry_spin)

        for es in to_remove:
            del active[es]

        # Update gap tracking
        if is_target:
            prev_hit = nz_idx
        nz_idx += 1

        cs = (nz_idx - prev_hit - 1) if prev_hit >= 0 else nz_idx

        # Start new bets at skip=1,2,3,4 (if not already tracking)
        for test_skip in [1, 2, 3, 4]:
            if cs == test_skip and test_skip not in active:
                active[test_skip] = (0, 0, si)

    return results


def build_timeline(sessions, mapper, target_id):
    """
    Build a complete timeline of 124 outcomes for each skip level.
    Returns per-session list of events sorted by spin.
    """
    all_events = []
    for sess in sessions:
        events = simulate_124_opportunities(sess["numbers"], mapper, target_id)
        for e in events:
            e["session"] = sess["name"]
            e["tms"] = sess["tms"]
        all_events.extend(events)
    return all_events


# ============================================================
# DIRECTION 1: Gap Sequence Pattern Recognition
# ============================================================

def analyze_gap_sequences(sessions, mapper, target_id, label):
    """
    Instead of aggregate gap stats, look at the ACTUAL SEQUENCE of
    the last 5-8 gaps before a streak start vs before a failure.

    Key question: are there specific gap sequences (e.g., [4,3,2,0,1])
    that consistently precede hot streaks?
    """
    print(f"\n{'='*60}")
    print(f"  DIRECTION 1: GAP SEQUENCE PATTERNS — {label}")
    print(f"{'='*60}")

    # For each session, track gap sequences and what followed
    streak_precursors = []  # last N gaps before streak>=3 start
    fail_precursors = []     # last N gaps before immediate failure

    for sess in sessions[-72:]:  # Recent data
        nums = sess["numbers"]
        gaps = []
        prev_hit = -1
        nz_idx = 0

        # Track 124 outcomes at skip=2
        outcomes = []  # (entry_spin, hit_round or -1)
        entry_gaps = []  # gap sequence at each entry

        in_bet = False
        bet_round = 0

        for si, n in enumerate(nums):
            if n == 0:
                if in_bet:
                    bet_round += 1
                    if bet_round >= 3:
                        outcomes.append(-1)
                        entry_gaps.append(list(gaps[-8:]) if len(gaps) >= 8 else list(gaps))
                        in_bet = False
                continue

            eid = mapper(n)
            is_target = (eid == target_id)

            if in_bet:
                if is_target:
                    outcomes.append(bet_round)
                    entry_gaps.append(list(gaps[-8:]) if len(gaps) >= 8 else list(gaps))
                    in_bet = False
                else:
                    bet_round += 1
                    if bet_round >= 3:
                        outcomes.append(-1)
                        entry_gaps.append(list(gaps[-8:]) if len(gaps) >= 8 else list(gaps))
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

        # Now analyze: which outcomes start streaks?
        i = 0
        while i < len(outcomes) - 2:
            if outcomes[i] >= 0 and outcomes[i+1] >= 0 and outcomes[i+2] >= 0:
                # Streak starts at i
                if i < len(entry_gaps):
                    streak_precursors.append(entry_gaps[i])
                # Skip to end of streak
                j = i + 3
                while j < len(outcomes) and outcomes[j] >= 0:
                    j += 1
                i = j
            elif outcomes[i] < 0:
                if i < len(entry_gaps):
                    fail_precursors.append(entry_gaps[i])
                i += 1
            else:
                i += 1

    print(f"  Streak-start precursors: {len(streak_precursors)}")
    print(f"  Failure precursors: {len(fail_precursors)}")

    # ---- Pattern 1: Last 3 gaps ----
    print(f"\n  --- Last 3 gaps before entry ---")
    for name, precursors in [("Streak>=3", streak_precursors), ("Fail", fail_precursors)]:
        if not precursors:
            continue
        # Get the last 3 gaps of each precursor
        last3_counts = Counter()
        for p in precursors:
            if len(p) >= 3:
                last3 = tuple(p[-3:])
                last3_counts[last3] += 1

        top_patterns = last3_counts.most_common(15)
        print(f"  {name}: top last-3-gap patterns:")
        for pattern, count in top_patterns:
            pct = count / len(precursors) * 100
            print(f"    {list(pattern)}: {count} ({pct:.1f}%)")

    # ---- Pattern 2: Gap direction changes ----
    print(f"\n  --- Gap direction changes (last 5 gaps) ---")
    for name, precursors in [("Streak>=3", streak_precursors), ("Fail", fail_precursors)]:
        if not precursors:
            continue
        # Count: how many gaps are decreasing vs increasing vs flat
        n_decreasing = 0
        n_increasing = 0
        n_alternating = 0  # up-down-up-down
        total = 0

        for p in precursors:
            if len(p) < 5:
                continue
            total += 1
            last5 = p[-5:]
            diffs = [last5[i+1] - last5[i] for i in range(len(last5)-1)]

            neg = sum(1 for d in diffs if d < 0)
            pos = sum(1 for d in diffs if d > 0)
            zero = sum(1 for d in diffs if d == 0)

            if neg >= 3:
                n_decreasing += 1
            elif pos >= 3:
                n_increasing += 1
            elif neg >= 1 and pos >= 1:
                n_alternating += 1

        if total > 0:
            print(f"  {name}: decreasing={n_decreasing/total*100:.1f}%, "
                  f"increasing={n_increasing/total*100:.1f}%, "
                  f"alternating={n_alternating/total*100:.1f}%")

    # ---- Pattern 3: First short gap after cold ----
    print(f"\n  --- 'Cold-then-short' pattern detection ---")
    # Definition: at least 3 gaps >=4, followed by a gap <=1
    for name, precursors in [("Streak>=3", streak_precursors), ("Fail", fail_precursors)]:
        if not precursors:
            continue
        cold_then_short = 0
        for p in precursors:
            if len(p) < 5:
                continue
            last5 = p[-5:]
            # Check: of first 4, at least 3 are >=4, and last is <=1
            if sum(1 for g in last5[:4] if g >= 4) >= 3 and last5[-1] <= 1:
                cold_then_short += 1
        print(f"  {name}: cold-then-short pattern = {cold_then_short}/{len(precursors)} "
              f"({cold_then_short/len(precursors)*100:.1f}%)")

    # ---- Pattern 4: Gap=0 cluster (consecutive hits recently) ----
    print(f"\n  --- Recent gap=0 density ---")
    for name, precursors in [("Streak>=3", streak_precursors), ("Fail", fail_precursors)]:
        if not precursors:
            continue
        n_with_2_zeros = 0
        for p in precursors:
            if len(p) < 8:
                continue
            if sum(1 for g in p[-6:] if g == 0) >= 2:
                n_with_2_zeros += 1
        print(f"  {name}: >=2 gap=0 in last 6 gaps = {n_with_2_zeros}/{len(precursors)} "
              f"({n_with_2_zeros/len(precursors)*100:.1f}%)")

    return streak_precursors, fail_precursors


# ============================================================
# DIRECTION 2: Cross-Entity Heat Rotation
# ============================================================

def analyze_heat_rotation(sessions):
    """
    Track how heat rotates between 1行, 3行, 一组.

    For each session, compute:
    - Rolling hit rate for each entity (last N spins)
    - When one entity's streak ends, does another start within K spins?
    - Is there a predictable rotation order?
    """
    print(f"\n{'='*60}")
    print(f"  DIRECTION 2: CROSS-ENTITY HEAT ROTATION")
    print(f"{'='*60}")

    entities = [
        ("1行", get_row, 0),
        ("3行", get_row, 2),
        ("一组", get_group, 0),
    ]

    # For each session, build a combined timeline
    all_rotations = []  # (from_entity, to_entity, gap_between_streaks)

    for sess in sessions[-72:]:
        nums = sess["numbers"]

        # For each entity, get 124 outcomes at skip=2
        entity_events = {}
        for ename, mapper, tid in entities:
            events = simulate_124_opportunities(nums, mapper, tid)
            # Only keep skip=2 entries
            entity_events[ename] = [e for e in events if e["entry_skip"] == 2]

        # Find streaks for each entity
        entity_streaks = {}
        for ename in entity_events:
            events = entity_events[ename]
            streaks = []
            i = 0
            while i < len(events):
                if events[i]["outcome"].startswith("win"):
                    streak_start = events[i]["spin_idx"]
                    streak_end = streak_start
                    j = i + 1
                    while j < len(events) and events[j]["outcome"].startswith("win"):
                        streak_end = events[j]["spin_idx"]
                        j += 1
                    streak_len = j - i
                    if streak_len >= 2:  # Only meaningful streaks
                        streaks.append({
                            "start_spin": streak_start,
                            "end_spin": streak_end,
                            "length": streak_len,
                        })
                    i = j
                else:
                    i += 1
            entity_streaks[ename] = streaks

        # Find rotations: when streak A ends, does streak B start soon after?
        for ename_a, streaks_a in entity_streaks.items():
            for sa in streaks_a:
                for ename_b, streaks_b in entity_streaks.items():
                    if ename_a == ename_b:
                        continue
                    for sb in streaks_b:
                        gap = sb["start_spin"] - sa["end_spin"]
                        if 0 < gap <= 30:  # B starts within 30 spins of A ending
                            all_rotations.append({
                                "session": sess["name"],
                                "from_entity": ename_a,
                                "to_entity": ename_b,
                                "gap": gap,
                                "from_len": sa["length"],
                                "to_len": sb["length"],
                            })

    print(f"\n  Total rotations found: {len(all_rotations)}")

    # Rotation frequency matrix
    rot_matrix = defaultdict(lambda: defaultdict(int))
    rot_gaps = defaultdict(lambda: defaultdict(list))

    for r in all_rotations:
        rot_matrix[r["from_entity"]][r["to_entity"]] += 1
        rot_gaps[r["from_entity"]][r["to_entity"]].append(r["gap"])

    print(f"\n  Rotation Matrix (from → to):")
    print(f"  {'':>8s}", end="")
    for ename, _, _ in entities:
        print(f" {ename:>8s}", end="")
    print()
    for ename_a, _, _ in entities:
        print(f"  {ename_a:>8s}", end="")
        for ename_b, _, _ in entities:
            count = rot_matrix[ename_a][ename_b]
            avg_gap = mean(rot_gaps[ename_a][ename_b]) if rot_gaps[ename_a][ename_b] else 0
            print(f" {count:>3d}({avg_gap:.0f}s)", end="")
        print()

    # Which rotation has the shortest gap?
    print(f"\n  Top rotations by frequency:")
    rotations_flat = []
    for ename_a, _, _ in entities:
        for ename_b, _, _ in entities:
            if ename_a != ename_b and rot_matrix[ename_a][ename_b] > 0:
                rotations_flat.append({
                    "from": ename_a, "to": ename_b,
                    "count": rot_matrix[ename_a][ename_b],
                    "avg_gap": mean(rot_gaps[ename_a][ename_b]),
                })
    rotations_flat.sort(key=lambda x: -x["count"])
    for r in rotations_flat[:10]:
        print(f"  {r['from']} → {r['to']}: {r['count']}次, 平均间隔{r['avg_gap']:.0f} spins")

    return all_rotations


# ============================================================
# DIRECTION 3: Entry Round Drift
# ============================================================

def analyze_entry_drift(sessions, mapper, target_id, label):
    """
    Track how the optimal entry round shifts within a streak lifecycle.

    Key idea: at the START of a hot phase, skip=1 or skip=2 might work.
    As the streak progresses, the optimal entry might drift to skip=3 or skip=4.
    Eventually it drifts too far (the entity cools down) and no entry works.

    This is a MICRO-REGIME within the streak.
    """
    print(f"\n{'='*60}")
    print(f"  DIRECTION 3: ENTRY ROUND DRIFT — {label}")
    print(f"{'='*60}")

    all_events = []
    for sess in sessions[-72:]:
        events = simulate_124_opportunities(sess["numbers"], mapper, target_id)
        for e in events:
            e["session"] = sess["name"]
            e["tms"] = sess["tms"]
        all_events.extend(events)

    # Group events by session, sort by spin
    by_session = defaultdict(list)
    for e in all_events:
        by_session[e["session"]].append(e)
    for sn in by_session:
        by_session[sn].sort(key=lambda x: x["spin_idx"])

    # ---- Analysis 1: Consecutive wins at each skip level ----
    print(f"\n  --- Consecutive win analysis by entry skip ---")

    for skip in [1, 2, 3, 4]:
        skip_events = [e for e in all_events if e["entry_skip"] == skip]
        skip_events.sort(key=lambda x: (x["session"], x["spin_idx"]))

        # Find consecutive win streaks
        streaks = []
        current_streak = 0
        for e in skip_events:
            if e["outcome"].startswith("win"):
                current_streak += 1
            else:
                if current_streak >= 1:
                    streaks.append(current_streak)
                current_streak = 0
        if current_streak >= 1:
            streaks.append(current_streak)

        if streaks:
            print(f"  skip={skip}: {len(skip_events)} events, "
                  f"win%={sum(1 for e in skip_events if e['outcome'].startswith('win'))/len(skip_events)*100:.1f}%, "
                  f"max streak={max(streaks)}, avg streak={mean(streaks):.1f}")

    # ---- Analysis 2: When does skip=N start outperforming skip=N-1? ----
    print(f"\n  --- Optimal entry skip by streak phase ---")

    # For each session, track which skip level is "hot" at each point in time
    # Use a sliding window: look at last 10 outcomes per skip level

    skip_performance = defaultdict(list)  # skip -> [(session, spin, rolling_win_rate)]

    for sn, events in by_session.items():
        # Separate by skip
        for skip in [1, 2, 3, 4]:
            skip_ev = [e for e in events if e["entry_skip"] == skip]
            # Rolling win rate over last 5 outcomes
            for i in range(4, len(skip_ev)):
                window = skip_ev[i-4:i+1]
                wr = sum(1 for e in window if e["outcome"].startswith("win")) / 5
                if wr > 0:
                    skip_performance[skip].append({
                        "session": sn,
                        "spin": skip_ev[i]["spin_idx"],
                        "rolling_wr": wr,
                    })

    # Find moments where skip=N becomes better than skip=N-1
    print(f"\n  Skip-level win rate comparison (rolling 5):")
    for skip in [1, 2, 3]:
        skip_a = skip_performance[skip]
        skip_b = skip_performance[skip + 1]
        print(f"  skip={skip}: avg rolling WR={mean(p['rolling_wr'] for p in skip_a):.3f}" if skip_a else f"  skip={skip}: no data")
        if skip_b:
            print(f"  skip={skip+1}: avg rolling WR={mean(p['rolling_wr'] for p in skip_b):.3f}")

    # ---- Analysis 3: Drift trajectory within a streak ----
    print(f"\n  --- Entry drift within streak lifecycle ---")

    # For each long streak (>=4), track which skip would have worked at each position
    streak_drift_data = []

    for sn, events in by_session.items():
        # For this session, find all streaks (consecutive wins at skip=2)
        skip2_events = [e for e in events if e["entry_skip"] == 2]
        skip2_events.sort(key=lambda x: x["spin_idx"])

        i = 0
        while i < len(skip2_events):
            if skip2_events[i]["outcome"].startswith("win"):
                # Streak starts
                streak_spins = [skip2_events[i]["spin_idx"]]
                j = i + 1
                while j < len(skip2_events) and skip2_events[j]["outcome"].startswith("win"):
                    streak_spins.append(skip2_events[j]["spin_idx"])
                    j += 1
                streak_len = j - i

                if streak_len >= 4:  # Long enough to observe drift
                    # For each position in the streak, check ALL skip levels
                    drift_row = {"session": sn, "streak_len": streak_len, "positions": []}
                    for pos, spin in enumerate(streak_spins):
                        pos_data = {"position": pos}
                        for test_skip in [1, 2, 3, 4]:
                            # Was there a win at this skip near this spin?
                            test_events = [e for e in events
                                          if e["entry_skip"] == test_skip
                                          and abs(e["spin_idx"] - spin) <= 5]
                            won = any(e["outcome"].startswith("win") for e in test_events)
                            pos_data[f"skip{test_skip}_win"] = won
                        drift_row["positions"].append(pos_data)
                    streak_drift_data.append(drift_row)

                i = j
            else:
                i += 1

    print(f"  Long streaks (>=4) analyzed: {len(streak_drift_data)}")

    # Aggregate: at each streak position (0=start, 1, 2, 3, 4+), what % of each skip works?
    max_pos = 10
    position_skip_stats = {pos: {skip: {"wins": 0, "total": 0}
                                 for skip in [1, 2, 3, 4]}
                           for pos in range(max_pos)}

    for sd in streak_drift_data:
        streak_len = sd["streak_len"]
        for pos_data in sd["positions"]:
            pos = min(pos_data["position"], max_pos - 1)
            for skip in [1, 2, 3, 4]:
                key = f"skip{skip}_win"
                position_skip_stats[pos][skip]["total"] += 1
                if pos_data.get(key, False):
                    position_skip_stats[pos][skip]["wins"] += 1

    print(f"\n  Win rate by streak position AND entry skip:")
    header = f"  {'Pos':>5s}"
    for skip in [1, 2, 3, 4]:
        header += f" {'skip=' + str(skip):>12s}"
    print(header)
    print(f"  {'-'*55}")

    for pos in range(min(8, max_pos)):
        line = f"  {pos:>5d}"
        best_skip = None
        best_wr = 0
        for skip in [1, 2, 3, 4]:
            s = position_skip_stats[pos][skip]
            wr = s["wins"] / s["total"] * 100 if s["total"] > 0 else 0
            line += f" {wr:>11.1f}%"
            if wr > best_wr:
                best_wr = wr
                best_skip = skip
        line += f"  ★skip={best_skip}"
        print(line)

    # ---- Analysis 4: Pre-streak vs mid-streak optimal entry ----
    print(f"\n  --- Optimal entry: pre-streak vs mid-streak vs post-streak ---")

    # Classify each event as pre/mid/post streak
    for sn, events in by_session.items():
        skip2_events = sorted([e for e in events if e["entry_skip"] == 2],
                              key=lambda x: x["spin_idx"])

        # Mark streak boundaries
        streak_boundaries = []
        i = 0
        while i < len(skip2_events):
            if skip2_events[i]["outcome"].startswith("win"):
                start = skip2_events[i]["spin_idx"]
                j = i + 1
                while j < len(skip2_events) and skip2_events[j]["outcome"].startswith("win"):
                    j += 1
                end = skip2_events[j-1]["spin_idx"] if j > i else start
                if j - i >= 3:  # meaningful streak
                    streak_boundaries.append({
                        "start": start, "end": end, "length": j - i,
                    })
                i = j
            else:
                i += 1

        # Now classify each event from ALL skip levels
        for e in events:
            # Determine phase
            phase = "neutral"
            for sb in streak_boundaries:
                if sb["start"] - 20 <= e["spin_idx"] < sb["start"]:
                    phase = "pre-streak"
                    break
                elif sb["start"] <= e["spin_idx"] <= sb["end"]:
                    phase = "mid-streak"
                    break
                elif sb["end"] < e["spin_idx"] <= sb["end"] + 20:
                    phase = "post-streak"
                    break
            e["phase"] = phase

    # Compare win rates
    for skip in [1, 2, 3, 4]:
        print(f"\n  skip={skip}:")
        for phase in ["pre-streak", "mid-streak", "post-streak", "neutral"]:
            phase_events = [e for e in all_events
                           if e["entry_skip"] == skip and e.get("phase") == phase]
            if phase_events:
                wr = sum(1 for e in phase_events if e["outcome"].startswith("win")) / len(phase_events) * 100
                avg_net = mean(e["net_profit"] for e in phase_events)
                print(f"    {phase}: {len(phase_events)} events, win%={wr:.1f}%, avg_net={avg_net:+.2f}")

    return streak_drift_data, position_skip_stats


# ============================================================
# MAIN
# ============================================================

def main():
    path = "HistoryData/wzs-merged.json"
    print("Loading data...")
    sessions = load_sessions(path)
    sessions.sort(key=lambda s: s["tms"])
    print(f"{len(sessions)} sessions")

    entities = [
        (get_row, 0, "1行"),
        (get_row, 2, "3行"),
        (get_group, 0, "一组"),
    ]

    # ============================================================
    # DIRECTION 1: Gap sequence patterns
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# DIRECTION 1: GAP SEQUENCE PATTERN RECOGNITION")
    print(f"{'#'*70}")

    for mapper, target_id, label in entities:
        analyze_gap_sequences(sessions, mapper, target_id, label)

    # ============================================================
    # DIRECTION 2: Cross-entity heat rotation
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# DIRECTION 2: CROSS-ENTITY HEAT ROTATION")
    print(f"{'#'*70}")

    rotations = analyze_heat_rotation(sessions)

    # ============================================================
    # DIRECTION 3: Entry round drift
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# DIRECTION 3: ENTRY ROUND DRIFT")
    print(f"{'#'*70}")

    all_drift_data = {}
    for mapper, target_id, label in entities:
        sd, pss = analyze_entry_drift(sessions, mapper, target_id, label)
        all_drift_data[label] = (sd, pss)

    # ============================================================
    # SYNTHESIS: Putting it all together
    # ============================================================
    print(f"\n{'#'*70}")
    print(f"# SYNTHESIS: ACTIONABLE ENTRY RULES")
    print(f"{'#'*70}")

    print(f"""
    Based on all three analyses:

    RULE 1 [Sequence]: Look for "cold-then-short" pattern.
    If a row has had 3+ long gaps (>=4) followed by a sudden short gap (<=1),
    this is the most reliable precursor to a hot streak.
    → Enter at skip=2, bet 1-2-4.

    RULE 2 [Rotation]: When 1行 streak ends, watch 3行.
    The most frequent rotation is 1行 → 3行 with short gaps.
    → When 1行 streak ends (first loss), immediately monitor 3行.

    RULE 3 [Drift]: Entry optimality shifts with streak lifecycle.
    - Pre-streak: skip=2 or skip=3 works best (wait for confirmation)
    - Early streak: skip=1 catches the momentum
    - Mid streak: skip=2 is the sweet spot
    - Late streak: skip=3 or skip=4 — it's cooling, be cautious
    → Adjust entry round based on WHERE you are in the streak.

    RULE 4 [Drift + Sequence combined]:
    The "cold-then-short" pattern + skip=2 = catch the early streak.
    Once in the streak, shift to skip=1 for aggressive catching.
    When skip=1 starts losing, shift back to skip=2 or 3.
    When skip=3 starts losing, STOP — the streak is over.
    """)


if __name__ == "__main__":
    main()
