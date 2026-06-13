"""
New124 strategy analysis against history_data.json.
Faithful Python port of quality124.ts algorithm.

Run: python scripts/new124_analysis.py
"""

from __future__ import annotations
import json, math
from collections import defaultdict
from pathlib import Path
from statistics import mean, variance as pvar
from typing import Optional

PROGRESSION = (1, 2, 4)
ENTRY_AFTER_OPTIONS = (3, 4)  # New124 only considers K=3 or 4

# Tier labels
TIER_LABELS = {"low": "低频", "medium": "中频", "high": "高频", "ultra": "超高频"}
TIER_STARS = {"low": "***", "medium": "**", "high": "*", "ultra": ""}

# ---- Entity mapping (matches quality124.ts) ----
def get_group(value: int) -> Optional[int]:
    if value == 0: return None
    return (value - 1) // 12  # 0=group1, 1=group2, 2=group3

def get_row(value: int) -> Optional[int]:
    if value == 0: return None
    rem = value % 3
    if rem == 1: return 2
    if rem == 2: return 1
    return 0

CI_LABELS = {0: "一组", 1: "二组", 2: "三组", 3: "一行", 4: "二行", 5: "三行"}

# ---- Math helpers (matches quality124.ts) ----
def avg(values):
    return sum(values)/len(values) if values else 0.0

def clamp(value, low=0.0, high=1.0):
    return max(low, min(high, value))

def pvar(values):
    if len(values) < 2: return 0.0
    m = avg(values)
    return sum((v-m)**2 for v in values)/len(values)

# ---- Three filters (matches quality124.ts) ----
def zone_rate(gaps, entry_after, window=18):
    recent = gaps[-window:]
    if not recent: return 0.0
    hi = entry_after + len(PROGRESSION) - 1
    return sum(1 for g in recent if entry_after <= g <= hi) / len(recent)

def concentration(gaps, window=18):
    recent = gaps[-window:]
    if not recent: return 0.0
    counts = defaultdict(int)
    for g in recent: counts[g] += 1
    mode = 0; mode_count = -1
    for g, cnt in counts.items():
        if cnt > mode_count or (cnt == mode_count and g < mode):
            mode = g; mode_count = cnt
    return sum(1 for g in recent if abs(g - mode) <= 1) / len(recent)

def tempo_band(gaps):
    if len(gaps) < 6: return "unknown", 0.0

    r6 = gaps[-6:]; r12 = gaps[-12:]; prev6 = gaps[-12:-6]
    m6 = avg(r6); m12 = avg(r12); prior6 = avg(prev6) if prev6 else 0.0
    delta6 = avg([abs(r6[i] - r6[i-1]) for i in range(1, len(r6))])
    var6 = pvar(r6)

    frequency = clamp((3.2 - m6) / 2.7)
    churn = clamp(delta6 / 2.8)
    compression = clamp((prior6 - m6) / 2.5) if prev6 else 0.0
    dispersion = clamp(var6 / 6.0)
    score = 0.42*frequency + 0.26*churn + 0.22*compression + 0.10*dispersion

    if score >= 0.68: return "fast", score
    if score >= 0.48: return "medium_fast", score
    if score <= 0.24 or m12 >= 3.4: return "slow", score
    return "medium", score

# ---- Tier selection (matches quality124.ts selectTier) ----
def select_tier(ci, gaps, entry_after):
    """Returns (tier, zone, conc, band) or None"""
    if ci not in (1, 2): return None  # Only group2 and group3
    if len(gaps) < 18: return None

    zone = zone_rate(gaps, entry_after)
    conc = concentration(gaps)
    band, tempo_score = tempo_band(gaps)
    not_fast = band not in ("fast", "unknown")

    # Priority from high (low tier) to low (ultra tier)
    # Matches quality124.ts selectTier exactly:
    #   low:    ci===1 (group2) && entryAfter===4
    #   medium: ci===2 (group3) && entryAfter in (3,4)
    #   high:   entryAfter in (3,4) — catches group2 entryAfter=3 that missed low
    #   ultra:  entryAfter===3, lower zone threshold (0.20 vs 0.25)
    if ci == 1 and entry_after == 4 and zone >= 0.25 and conc >= 0.45:
        return ("low", zone, conc, band, tempo_score)
    if ci == 2 and entry_after in (3, 4) and zone >= 0.25 and conc >= 0.45 and not_fast:
        return ("medium", zone, conc, band, tempo_score)
    if entry_after in (3, 4) and zone >= 0.25 and conc >= 0.45 and not_fast:
        return ("high", zone, conc, band, tempo_score)
    if entry_after == 3 and zone >= 0.20 and conc >= 0.45 and not_fast:
        return ("ultra", zone, conc, band, tempo_score)
    return None


# ---- Main analysis engine (matches analyzeQuality124) ----
def analyze_quality124(numbers, roi_start_index=0):
    """
    Returns: {
        signals: [...],
        total_roi: {signals, bet, win, hits, roi},
        tier_rois: {low/medium/high/ultra: {...}},
        by_entity: {ci_label: {...}},
        by_entry: {3/4: {...}},
        by_tier_and_entry: {tier_k3/tier_k4: {...}},
    }
    """
    # State per entity (6 entities: 3 groups + 3 rows)
    # ci=0:group1, 1:group2, 2:group3, 3:row1, 4:row2, 5:row3
    states = []
    for ci in range(6):
        states.append({
            "ci": ci,
            "label": CI_LABELS[ci],
            "kind": "group" if ci < 3 else "row",
            "miss_count": 0,
            "seen": False,
            "gaps": [],
            "active": {},  # entry_after -> ActiveBet
        })

    # ROI accumulators
    total = {"signals": 0, "bet": 0, "win": 0, "hits": 0, "roi": 0.0, "net": 0}
    tier_stats = {t: {"signals": 0, "bet": 0, "win": 0, "hits": 0, "roi": 0.0, "net": 0} for t in TIER_LABELS}
    by_entity_stats = defaultdict(lambda: {"signals": 0, "bet": 0, "win": 0, "hits": 0, "roi": 0.0, "net": 0})
    by_entry_stats = {3: {"signals": 0, "bet": 0, "win": 0, "hits": 0, "roi": 0.0, "net": 0},
                       4: {"signals": 0, "bet": 0, "win": 0, "hits": 0, "roi": 0.0, "net": 0}}
    by_tier_entry_stats = defaultdict(lambda: {"signals": 0, "bet": 0, "win": 0, "hits": 0, "roi": 0.0, "net": 0})

    completed_signals = []

    for index, value in enumerate(numbers):
        group = get_group(value)  # 0/1/2/None
        row = get_row(value)      # 0/1/2/None
        row_ci = row + 3 if row is not None else None

        # ---- Settle active bets ----
        for state in states:
            hit_group = (group is not None and group == state["ci"]) if state["kind"] == "group" else False
            hit_row = (row_ci is not None and row_ci == state["ci"]) if state["kind"] == "row" else False
            hit = hit_group or hit_row

            done_keys = []
            for entry_text, active in list(state["active"].items()):
                entry_after = int(entry_text)
                amount = PROGRESSION[active["round_index"]]
                active["bet"] += amount

                if hit:
                    # Win!
                    payout = amount * 3
                    if active["first_bet_index"] >= roi_start_index:
                        _add_result(total, tier_stats[active["tier"]],
                                   active, True, amount * 3,
                                   by_entity_stats, by_entry_stats, by_tier_entry_stats)
                    # Also record for session-level analysis
                    active["hit"] = True
                    active["payout"] = payout
                    active["result_net"] = payout - active["bet"]
                    completed_signals.append(dict(active))
                    done_keys.append(entry_text)
                else:
                    active["round_index"] += 1
                    if active["round_index"] >= len(PROGRESSION):
                        # Lose: all 3 rounds missed
                        if active["first_bet_index"] >= roi_start_index:
                            _add_result(total, tier_stats[active["tier"]],
                                       active, False, 0,
                                       by_entity_stats, by_entry_stats, by_tier_entry_stats)
                        active["hit"] = False
                        active["payout"] = 0
                        active["result_net"] = -active["bet"]
                        completed_signals.append(dict(active))
                        done_keys.append(entry_text)

            for key in done_keys:
                del state["active"][key]

        # ---- Update gap sequences ----
        for state in states:
            hit_group = (group is not None and group == state["ci"]) if state["kind"] == "group" else False
            hit_row = (row_ci is not None and row_ci == state["ci"]) if state["kind"] == "row" else False
            hit = hit_group or hit_row

            if hit:
                if state["seen"]:
                    state["gaps"].append(state["miss_count"])
                state["miss_count"] = 0
                state["seen"] = True
            elif state["seen"]:
                state["miss_count"] += 1

        # ---- Check for new entry signals ----
        for state in states:
            if not state["seen"]: continue
            for entry_after in ENTRY_AFTER_OPTIONS:
                if state["miss_count"] != entry_after: continue
                if entry_after in state["active"]: continue

                selected = select_tier(state["ci"], state["gaps"], entry_after)
                if selected is None: continue

                tier, zone, conc, band, tempo_score = selected
                state["active"][entry_after] = {
                    "ci": state["ci"],
                    "label": state["label"],
                    "kind": state["kind"],
                    "tier": tier,
                    "entry_after": entry_after,
                    "round_index": 0,
                    "bet": 0,
                    "first_bet_index": index + 1,  # bet starts next spin
                    "zone_rate": zone,
                    "concentration": conc,
                    "tempo_band": band,
                    "tempo_score": tempo_score,
                    "session_number_index": index,
                }

    # Compute ROIs
    _settle_roi(total)
    for s in tier_stats.values(): _settle_roi(s)
    for s in by_entity_stats.values(): _settle_roi(s)
    for s in by_entry_stats.values(): _settle_roi(s)
    for s in by_tier_entry_stats.values(): _settle_roi(s)

    return {
        "signals": completed_signals,
        "total_roi": total,
        "tier_rois": dict(tier_stats),
        "by_entity": dict(by_entity_stats),
        "by_entry": by_entry_stats,
        "by_tier_entry": dict(by_tier_entry_stats),
    }


def _add_result(total, tier_dict, active, hit, payout, by_entity, by_entry, by_tier_entry):
    """Record a completed bet result."""
    total["signals"] += 1
    total["bet"] += active["bet"]
    tier_dict["signals"] += 1
    tier_dict["bet"] += active["bet"]

    ent_key = active["label"]
    by_entity[ent_key]["signals"] += 1
    by_entity[ent_key]["bet"] += active["bet"]

    entry_key = active["entry_after"]
    by_entry[entry_key]["signals"] += 1
    by_entry[entry_key]["bet"] += active["bet"]

    te_key = f"{active['tier']}_k{entry_key}"
    by_tier_entry[te_key]["signals"] += 1
    by_tier_entry[te_key]["bet"] += active["bet"]

    if hit:
        total["win"] += payout
        total["hits"] += 1
        total["net"] += payout - active["bet"]
        tier_dict["win"] += payout
        tier_dict["hits"] += 1
        tier_dict["net"] += payout - active["bet"]
        by_entity[ent_key]["win"] += payout
        by_entity[ent_key]["hits"] += 1
        by_entity[ent_key]["net"] += payout - active["bet"]
        by_entry[entry_key]["win"] += payout
        by_entry[entry_key]["hits"] += 1
        by_entry[entry_key]["net"] += payout - active["bet"]
        by_tier_entry[te_key]["win"] += payout
        by_tier_entry[te_key]["hits"] += 1
        by_tier_entry[te_key]["net"] += payout - active["bet"]
    else:
        total["net"] -= active["bet"]
        tier_dict["net"] -= active["bet"]
        by_entity[ent_key]["net"] -= active["bet"]
        by_entry[entry_key]["net"] -= active["bet"]
        by_tier_entry[te_key]["net"] -= active["bet"]


def _settle_roi(d):
    d["roi"] = (d["win"] - d["bet"]) / d["bet"] * 100 if d["bet"] > 0 else 0.0


# ---- Session-level analysis ----
def analyze_sessions(sessions):
    """Run analysis per session and accumulate."""
    all_signals = []
    session_results = []

    for sess_idx, sess in enumerate(sessions):
        numbers = sess["numbers"]
        name = sess.get("name", sess.get("Name", f"session-{sess_idx}"))
        tms = sess.get("tms", 0)

        result = analyze_quality124(numbers, roi_start_index=0)

        # Accumulate all signals with session info
        for sig in result["signals"]:
            sig["session_name"] = name
            sig["session_idx"] = sess_idx
            sig["session_tms"] = tms

        all_signals.extend(result["signals"])

        # Per-session summary
        session_sigs = result["signals"]
        session_bet = sum(s["bet"] for s in session_sigs)
        session_win = sum(s.get("payout", 0) for s in session_sigs)
        session_hits = sum(1 for s in session_sigs if s.get("hit"))
        session_net = sum(s.get("result_net", 0) for s in session_sigs)
        session_roi = (session_win - session_bet) / session_bet * 100 if session_bet > 0 else 0.0

        # Per-tier per session
        tier_session = {}
        for tier in TIER_LABELS:
            tier_sigs = [s for s in session_sigs if s["tier"] == tier]
            t_bet = sum(s["bet"] for s in tier_sigs)
            t_win = sum(s.get("payout", 0) for s in tier_sigs)
            t_hits = sum(1 for s in tier_sigs if s.get("hit"))
            t_net = sum(s.get("result_net", 0) for s in tier_sigs)
            t_roi = (t_win - t_bet) / t_bet * 100 if t_bet > 0 else 0.0
            tier_session[tier] = {"signals": len(tier_sigs), "bet": t_bet, "win": t_win,
                                  "hits": t_hits, "net": t_net, "roi": t_roi}

        # From-201 analysis
        result201 = analyze_quality124(numbers, roi_start_index=200)
        s201 = result201["total_roi"]

        session_results.append({
            "name": name,
            "index": sess_idx,
            "tms": tms,
            "spins": len(numbers),
            "signals": len(session_sigs),
            "bet": session_bet,
            "win": session_win,
            "hits": session_hits,
            "net": session_net,
            "roi": session_roi,
            "from201_roi": s201["roi"],
            "from201_signals": s201["signals"],
            "tiers": tier_session,
        })

    return session_results, all_signals


# ---- Uniformity / consistency metrics ----
def compute_metrics(session_results, all_signals):
    """Compute CV, session W/L, max DD, concentration, etc."""

    # Session ROI distribution
    rois = [s["roi"] for s in session_results if s["signals"] > 0]
    nets = [s["net"] for s in session_results if s["signals"] > 0]
    from201_rois = [s["from201_roi"] for s in session_results if s["from201_signals"] > 0]

    win_sessions = sum(1 for n in nets if n > 0)
    loss_sessions = sum(1 for n in nets if n < 0)
    flat_sessions = sum(1 for n in nets if n == 0)

    # CV (coefficient of variation) = std / mean, lower is more uniform
    roi_mean = avg(rois) if rois else 0
    roi_std = math.sqrt(pvar(rois)) if len(rois) > 1 else 0
    roi_cv = roi_std / roi_mean if roi_mean != 0 else float('inf')

    from201_mean = avg(from201_rois) if from201_rois else 0
    from201_std = math.sqrt(pvar(from201_rois)) if len(from201_rois) > 1 else 0
    from201_cv = from201_std / from201_mean if from201_mean != 0 else float('inf')

    # Max drawdown across sessions (by session order)
    cum_net = 0; peak = 0; max_dd = 0
    for s in session_results:
        cum_net += s["net"]
        if cum_net > peak: peak = cum_net
        max_dd = max(max_dd, peak - cum_net)

    # Max consecutive losing sessions
    max_cl = 0; curr = 0
    for s in session_results:
        if s["net"] < 0:
            curr += 1
            max_cl = max(max_cl, curr)
        else:
            curr = 0

    # Top-N profit concentration
    sorted_by_net = sorted(session_results, key=lambda s: s["net"], reverse=True)
    total_net = sum(s["net"] for s in session_results)
    top3_share = sum(s["net"] for s in sorted_by_net[:3]) / total_net * 100 if total_net > 0 else 0
    top5_share = sum(s["net"] for s in sorted_by_net[:5]) / total_net * 100 if total_net > 0 else 0
    top10_share = sum(s["net"] for s in sorted_by_net[:10]) / total_net * 100 if total_net > 0 else 0

    # Signal-level metrics
    total_signals = len(all_signals)
    total_bet = sum(s["bet"] for s in all_signals)
    total_win = sum(s.get("payout", 0) for s in all_signals)
    total_hits = sum(1 for s in all_signals if s.get("hit"))
    total_net_sig = sum(s.get("result_net", 0) for s in all_signals)
    hit_rate = total_hits / total_signals * 100 if total_signals > 0 else 0

    # Per-round hit distribution
    round_hits = {1: 0, 2: 0, 3: 0}
    round_total = {1: 0, 2: 0, 3: 0}
    for s in all_signals:
        hit_round = s.get("round_index", -1) + 1  # round_index is 0-based, convert
        if hit_round > 3: hit_round = 3
        round_total[hit_round] += 1
        if s.get("hit"):
            round_hits[hit_round] += 1

    return {
        "sessions_total": len(session_results),
        "sessions_with_signals": sum(1 for s in session_results if s["signals"] > 0),
        "sessions_zero_signal": sum(1 for s in session_results if s["signals"] == 0),
        "total_signals": total_signals,
        "total_bet": total_bet,
        "total_win": total_win,
        "total_net": total_net_sig,
        "total_hits": total_hits,
        "hit_rate": hit_rate,
        "overall_roi": (total_win - total_bet) / total_bet * 100 if total_bet > 0 else 0,
        "roi_mean": roi_mean,
        "roi_std": roi_std,
        "roi_cv": roi_cv,
        "from201_mean": from201_mean,
        "from201_std": from201_std,
        "from201_cv": from201_cv,
        "win_sessions": win_sessions,
        "loss_sessions": loss_sessions,
        "flat_sessions": flat_sessions,
        "win_rate_sessions": win_sessions / len(session_results) * 100,
        "max_drawdown": max_dd,
        "max_consecutive_loss": max_cl,
        "top3_share": top3_share,
        "top5_share": top5_share,
        "top10_share": top10_share,
        "round_hits": round_hits,
        "round_total": round_total,
    }


def fmt_roi(d, width=8):
    return f"ROI={d['roi']:{width}.2f}% sig={d['signals']:>5d} bet={d['bet']:>6d} net={d['net']:+7.1f} hits={d['hits']:>5d} WR={d['hits']/d['signals']*100 if d['signals']>0 else 0:5.1f}%"

def main():
    root = Path(__file__).resolve().parents[1]
    path = root / "history_data.json"

    print("=" * 80)
    print("  新124 打法完整分析 — history_data.json")
    print("=" * 80)

    # Load data
    data = json.loads(path.read_text(encoding="utf-8"))
    sessions = []
    for entry in data:
        nums_raw = entry.get("Numbers", "")
        if isinstance(nums_raw, str):
            nums = [int(x.strip()) for x in nums_raw.split(",") if x.strip()]
        else:
            nums = [int(x) for x in nums_raw] if isinstance(nums_raw, list) else []
        if nums:
            sessions.append({
                "name": str(entry.get("Name", "?")),
                "numbers": nums,
                "tms": int(entry.get("tms", 0) or 0),
            })

    sessions.sort(key=lambda s: s["tms"])

    total_spins = sum(len(s["numbers"]) for s in sessions)
    print(f"\n数据: {len(sessions)} sessions, {total_spins:,} spins")
    print(f"时间: {sessions[0]['name']} → {sessions[-1]['name']}")

    # ---- Run analysis ----
    session_results, all_signals = analyze_sessions(sessions)

    # ---- Aggregate across all sessions ----
    # Manually compute aggregate ROI (matches what analyze_quality124 would give for all numbers concatenated)
    all_numbers = []
    for s in sessions:
        all_numbers.extend(s["numbers"])

    print(f"\n  全量分析（所有号码接在一起）...")
    full_result = analyze_quality124(all_numbers, roi_start_index=0)
    full_result201 = analyze_quality124(all_numbers, roi_start_index=200)

    # ---- Overall Results ----
    print(f"\n{'─'*80}")
    print(f"  一、整体 ROI")
    print(f"{'─'*80}")
    print(f"  {'':20s} {fmt_roi(full_result['total_roi'])}")
    print(f"  {'201后 (押注区)':20s} {fmt_roi(full_result201['total_roi'])}")

    # ---- By Tier ----
    print(f"\n{'─'*80}")
    print(f"  二、分档位 ROI")
    print(f"{'─'*80}")
    for tier in ["low", "medium", "high", "ultra"]:
        label = TIER_LABELS[tier]
        stars = TIER_STARS[tier]
        print(f"  {label + stars:20s} {fmt_roi(full_result['tier_rois'][tier])}")

    # ---- By Entity ----
    print(f"\n{'─'*80}")
    print(f"  三、分实体 ROI")
    print(f"{'─'*80}")
    for ci in range(6):
        label = CI_LABELS[ci]
        stats = full_result["by_entity"].get(label, {"signals":0,"bet":0,"win":0,"hits":0,"roi":0,"net":0})
        if stats["signals"] > 0:
            print(f"  {label:10s} {fmt_roi(stats)}")

    # ---- By EntryAfter ----
    print(f"\n{'─'*80}")
    print(f"  四、分入场点 ROI")
    print(f"{'─'*80}")
    for k in (3, 4):
        stats = full_result["by_entry"][k]
        print(f"  entryAfter={k:<6d} {fmt_roi(stats)}")

    # ---- By Tier × EntryAfter ----
    print(f"\n{'─'*80}")
    print(f"  五、档位 × 入场点 交叉 ROI")
    print(f"{'─'*80}")
    for tier in ["low", "medium", "high", "ultra"]:
        for k in (3, 4):
            key = f"{tier}_k{k}"
            stats = full_result["by_tier_entry"].get(key, {"signals":0,"bet":0,"win":0,"hits":0,"roi":0,"net":0})
            if stats["signals"] > 0:
                print(f"  {TIER_LABELS[tier] + '_k'+str(k):18s} {fmt_roi(stats)}")

    # ---- Round-by-round hit distribution ----
    print(f"\n{'─'*80}")
    print(f"  六、轮次命中分布（第几轮追中）")
    print(f"{'─'*80}")
    signals = full_result["signals"]
    round_hits = {1: 0, 2: 0, 3: 0, 0: 0}  # 0 = miss
    for sig in signals:
        if sig.get("hit"):
            r = sig.get("round_index", -1) + 1
            round_hits[min(r, 3)] += 1
        else:
            round_hits[0] += 1
    total_sig = len(signals)
    for r in [1, 2, 3, 0]:
        cnt = round_hits[r]
        label = f"第{r}轮中" if r > 0 else "三轮全miss"
        print(f"  {label:12s} {cnt:>5d} ({cnt/total_sig*100:5.1f}%)")

    # ---- Uniformity / Consistency ----
    print(f"\n{'─'*80}")
    print(f"  七、均匀度指标（按 session）")
    print(f"{'─'*80}")
    metrics = compute_metrics(session_results, all_signals)

    print(f"  总 session 数:         {metrics['sessions_total']}")
    print(f"  有信号的 session:      {metrics['sessions_with_signals']}")
    print(f"  零信号的 session:      {metrics['sessions_zero_signal']}")
    print(f"")
    print(f"  胜率 (session级别):    {metrics['win_sessions']}W / {metrics['loss_sessions']}L / {metrics['flat_sessions']}F = {metrics['win_rate_sessions']:.1f}%")
    print(f"  全量 ROI:              {metrics['overall_roi']:+.2f}%")
    print(f"  Session ROI 均值:      {metrics['roi_mean']:+.2f}%")
    print(f"  Session ROI 标准差:    {metrics['roi_std']:.2f}%")
    print(f"  Session ROI CV (变异系数): {metrics['roi_cv']:.2f}  ← 越小越均匀")
    print(f"")
    print(f"  201后 ROI 均值:        {metrics['from201_mean']:+.2f}%")
    print(f"  201后 ROI CV:          {metrics['from201_cv']:.2f}")
    print(f"")
    print(f"  最大回撤 (跨session):  {metrics['max_drawdown']:.1f}")
    print(f"  最长连败 session 数:   {metrics['max_consecutive_loss']}")
    print(f"")
    print(f"  利润集中度:")
    print(f"    Top3 session 占比:   {metrics['top3_share']:.1f}%")
    print(f"    Top5 session 占比:   {metrics['top5_share']:.1f}%")
    print(f"    Top10 session 占比:  {metrics['top10_share']:.1f}%")

    # ---- Session detail (best/worst) ----
    print(f"\n{'─'*80}")
    print(f"  八、最佳 / 最差 Session")
    print(f"{'─'*80}")

    sorted_sessions = sorted(session_results, key=lambda s: s["roi"], reverse=True)
    print(f"\n  TOP 10 (按全量ROI):")
    for i, s in enumerate(sorted_sessions[:10], 1):
        print(f"  {i:2d}. {s['name']:<28s} ROI={s['roi']:+7.2f}% net={s['net']:+6.1f} sig={s['signals']:>4d} 201ROI={s['from201_roi']:+7.2f}%")

    print(f"\n  BOTTOM 10 (按全量ROI):")
    for i, s in enumerate(sorted_sessions[-10:], 1):
        print(f"  {i:2d}. {s['name']:<28s} ROI={s['roi']:+7.2f}% net={s['net']:+6.1f} sig={s['signals']:>4d} 201ROI={s['from201_roi']:+7.2f}%")

    # ---- Recent performance ----
    print(f"\n{'─'*80}")
    print(f"  九、近期表现")
    print(f"{'─'*80}")

    for recent_n in (5, 10, 20):
        recent = session_results[-recent_n:]
        recent_net = sum(s["net"] for s in recent)
        recent_bet = sum(s["bet"] for s in recent)
        recent_roi = (recent_net) / recent_bet * 100 if recent_bet > 0 else 0
        recent_win = sum(1 for s in recent if s["net"] > 0)
        recent_loss = sum(1 for s in recent if s["net"] < 0)
        print(f"  最近{recent_n}局: ROI={recent_roi:+.2f}% net={recent_net:+7.1f} W/L={recent_win}/{recent_loss}")

    # ---- Tier breakdown per recent ----
    print(f"\n{'─'*80}")
    print(f"  十、最近10局 — 分档位明细")
    print(f"{'─'*80}")
    recent10 = session_results[-10:]
    for tier in ["low", "medium", "high", "ultra"]:
        t_net = sum(s["tiers"][tier]["net"] for s in recent10)
        t_bet = sum(s["tiers"][tier]["bet"] for s in recent10)
        t_sig = sum(s["tiers"][tier]["signals"] for s in recent10)
        t_roi = t_net / t_bet * 100 if t_bet > 0 else 0
        print(f"  {TIER_LABELS[tier]:10s} net={t_net:+7.1f} bet={t_bet:>6d} sig={t_sig:>4d} ROI={t_roi:+.2f}%")

    print(f"\n{'='*80}")
    print(f"  分析完成")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
