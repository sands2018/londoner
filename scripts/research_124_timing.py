"""
Fresh 124 timing research.

This script intentionally does not reuse prior 124 conclusions. It rebuilds
the problem from the bettor's point of view:

- six entities: 3 groups + 3 rows
- entry_after K means: after K consecutive spins without this entity, start a
  1-2-4 chase on the next spin
- zero counts as a losing/non-hit spin for betting and miss distance
- every entity and every K keeps a rolling paper P&L ledger
- every opportunity stores only features available at entry time

Run:
  python scripts/research_124_timing.py
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
import json
import math
from pathlib import Path
import re
from statistics import mean
from typing import Callable, Iterable


PROGRESSION = (1, 2, 4)
ENTRY_AFTER_VALUES = (1, 2, 3, 4, 5, 6)
LABELS = ("group1", "group2", "group3", "row1", "row2", "row3")


@dataclass(frozen=True)
class Session:
    index: int
    name: str
    numbers: tuple[int, ...]
    tms: int


@dataclass
class ActiveOpportunity:
    session_index: int
    session_name: str
    tms: int
    entry_spin: int
    ci: int
    label: str
    kind: str
    entry_after: int
    features: dict[str, float | int | str | bool]
    round_index: int = 0
    bet: int = 0


@dataclass
class CompletedOpportunity:
    session_index: int
    session_name: str
    tms: int
    entry_spin: int
    ci: int
    label: str
    kind: str
    entry_after: int
    hit_round: int
    bet: int
    net: int
    features: dict[str, float | int | str | bool]

    @property
    def won(self) -> bool:
        return self.net > 0


@dataclass
class EntityState:
    ci: int
    label: str
    kind: str
    miss_count: int = 0
    seen: bool = False
    gaps: list[int] = field(default_factory=list)
    histories: dict[int, list[CompletedOpportunity]] = field(
        default_factory=lambda: {k: [] for k in ENTRY_AFTER_VALUES}
    )
    active: dict[int, ActiveOpportunity] = field(default_factory=dict)


def load_sessions(path: Path) -> list[Session]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    sessions: list[Session] = []
    for index, entry in enumerate(raw):
        numbers_raw = entry.get("Numbers")
        if isinstance(numbers_raw, str):
            numbers = tuple(
                int(part.strip())
                for part in numbers_raw.split(",")
                if part.strip() != ""
            )
        elif isinstance(numbers_raw, list):
            numbers = tuple(int(value) for value in numbers_raw)
        else:
            numbers = ()
        if numbers:
            sessions.append(
                Session(
                    index=index,
                    name=str(entry.get("Name", f"session-{index}")),
                    numbers=numbers,
                    tms=int(entry.get("tms", 0) or 0),
                )
            )
    return sorted(sessions, key=lambda item: (item.tms, item.index))


def get_group(value: int) -> int | None:
    if value == 0:
        return None
    return (value - 1) // 12


def get_row(value: int) -> int | None:
    if value == 0:
        return None
    rem = value % 3
    if rem == 1:
        return 2
    if rem == 2:
        return 1
    return 0


def hit_indexes(value: int) -> set[int]:
    group = get_group(value)
    row = get_row(value)
    if group is None or row is None:
        return set()
    return {group, row + 3}


def avg(values: Iterable[float]) -> float:
    vals = list(values)
    return sum(vals) / len(vals) if vals else 0.0


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def variance(values: list[int]) -> float:
    if len(values) < 2:
        return 0.0
    m = avg(values)
    return sum((value - m) ** 2 for value in values) / len(values)


def zone_rate(gaps: list[int], entry_after: int, window: int) -> float:
    recent = gaps[-window:]
    if not recent:
        return 0.0
    lo = entry_after
    hi = entry_after + len(PROGRESSION) - 1
    return sum(1 for gap in recent if lo <= gap <= hi) / len(recent)


def mode_and_concentration(gaps: list[int], window: int) -> tuple[int, float]:
    recent = gaps[-window:]
    if not recent:
        return 0, 0.0
    counts: dict[int, int] = defaultdict(int)
    for gap in recent:
        counts[gap] += 1
    mode = max(counts.items(), key=lambda item: (item[1], -item[0]))[0]
    near = sum(1 for gap in recent if abs(gap - mode) <= 1)
    return mode, near / len(recent)


def tempo_profile(gaps: list[int]) -> dict[str, float | int | str]:
    """
    Estimate current rhythm speed and choose the P&L lookback window.

    The idea is not that "fast" is automatically good. Fast only means the
    local picture changes quickly, so the trend window should be shorter.
    """
    if len(gaps) < 6:
        return {
            "tempo_window": 8,
            "tempo_score": 0.0,
            "tempo_band": "unknown",
            "tempo_mean_6": 0.0,
            "tempo_delta_6": 0.0,
            "tempo_var_6": 0.0,
        }

    recent6 = gaps[-6:]
    recent12 = gaps[-12:]
    previous6 = gaps[-12:-6]
    mean6 = avg(recent6)
    mean12 = avg(recent12)
    prior6 = avg(previous6)
    delta6 = avg(abs(recent6[index] - recent6[index - 1]) for index in range(1, len(recent6)))
    var6 = variance(recent6)

    frequency = clamp((3.2 - mean6) / 2.7)
    churn = clamp(delta6 / 2.8)
    compression = clamp((prior6 - mean6) / 2.5) if previous6 else 0.0
    dispersion = clamp(var6 / 6.0)

    score = 0.42 * frequency + 0.26 * churn + 0.22 * compression + 0.10 * dispersion
    if score >= 0.68:
        window = 4
        band = "fast"
    elif score >= 0.48:
        window = 6
        band = "medium_fast"
    elif score <= 0.24 or mean12 >= 3.4:
        window = 10
        band = "slow"
    else:
        window = 8
        band = "medium"

    return {
        "tempo_window": window,
        "tempo_score": score,
        "tempo_band": band,
        "tempo_mean_6": mean6,
        "tempo_delta_6": delta6,
        "tempo_var_6": var6,
    }


def history_stats(history: list[CompletedOpportunity], window: int) -> dict[str, float | int]:
    recent = history[-window:]
    prior = history[-2 * window : -window]
    recent_net = sum(item.net for item in recent)
    prior_net = sum(item.net for item in prior)
    recent_bet = sum(item.bet for item in recent)
    prior_bet = sum(item.bet for item in prior)
    return {
        "count": len(history),
        "recent_net": recent_net,
        "prior_net": prior_net,
        "improve": recent_net - prior_net,
        "recent_roi": recent_net / recent_bet * 100 if recent_bet else 0.0,
        "prior_roi": prior_net / prior_bet * 100 if prior_bet else 0.0,
        "recent_win": sum(1 for item in recent if item.won) / len(recent) if recent else 0.0,
        "prior_win": sum(1 for item in prior if item.won) / len(prior) if prior else 0.0,
    }


def rank_desc(values: dict[int, float], key: int) -> int:
    ordered = sorted(values.items(), key=lambda item: (-item[1], item[0]))
    for rank, (candidate, _value) in enumerate(ordered, start=1):
        if candidate == key:
            return rank
    return 99


def build_features(
    state: EntityState,
    all_states: list[EntityState],
    entry_after: int,
) -> dict[str, float | int | str | bool]:
    features: dict[str, float | int | str | bool] = {
        "ci": state.ci,
        "kind": state.kind,
        "entry_after": entry_after,
        "gap_count": len(state.gaps),
    }

    gaps = state.gaps
    tempo = tempo_profile(gaps)
    features.update(tempo)

    for window in (6, 12, 18, 24):
        recent = gaps[-window:]
        features[f"gap_mean_{window}"] = avg(recent)
        features[f"gap_var_{window}"] = variance(recent)
        features[f"zone_rate_{window}"] = zone_rate(gaps, entry_after, window)

    last6 = gaps[-6:]
    prev6 = gaps[-12:-6]
    last12 = gaps[-12:]
    prev12 = gaps[-24:-12]
    features["gap_trend_6v6"] = avg(last6) - avg(prev6)
    features["gap_trend_12v12"] = avg(last12) - avg(prev12)

    mode18, conc18 = mode_and_concentration(gaps, 18)
    features["gap_mode_18"] = mode18
    features["gap_conc_18"] = conc18
    features["mode_in_zone"] = entry_after <= mode18 <= entry_after + len(PROGRESSION) - 1

    fixed_windows = (5, 6, 8)
    adaptive_window = int(tempo["tempo_window"])
    for window in fixed_windows:
        recent_net_by_k: dict[int, float] = {}
        improve_by_k: dict[int, float] = {}
        for k in ENTRY_AFTER_VALUES:
            stats = history_stats(state.histories[k], window)
            prefix = f"k{k}_w{window}"
            for name, value in stats.items():
                features[f"{prefix}_{name}"] = value
            recent_net_by_k[k] = float(stats["recent_net"])
            improve_by_k[k] = float(stats["improve"])

        features[f"rank_recent_w{window}"] = rank_desc(recent_net_by_k, entry_after)
        features[f"rank_improve_w{window}"] = rank_desc(improve_by_k, entry_after)
        features[f"best_recent_k_w{window}"] = max(recent_net_by_k.items(), key=lambda item: item[1])[0]
        features[f"best_improve_k_w{window}"] = max(improve_by_k.items(), key=lambda item: item[1])[0]

        peer_recent: dict[int, float] = {}
        peer_improve: dict[int, float] = {}
        for peer in all_states:
            if peer.kind != state.kind:
                continue
            stats = history_stats(peer.histories[entry_after], window)
            peer_recent[peer.ci] = float(stats["recent_net"])
            peer_improve[peer.ci] = float(stats["improve"])
        features[f"entity_rank_recent_w{window}"] = rank_desc(peer_recent, state.ci)
        features[f"entity_rank_improve_w{window}"] = rank_desc(peer_improve, state.ci)

    adaptive_recent_by_k: dict[int, float] = {}
    adaptive_improve_by_k: dict[int, float] = {}
    for k in ENTRY_AFTER_VALUES:
        stats = history_stats(state.histories[k], adaptive_window)
        prefix = f"k{k}_ad"
        for name, value in stats.items():
            features[f"{prefix}_{name}"] = value
        adaptive_recent_by_k[k] = float(stats["recent_net"])
        adaptive_improve_by_k[k] = float(stats["improve"])

    features["rank_recent_ad"] = rank_desc(adaptive_recent_by_k, entry_after)
    features["rank_improve_ad"] = rank_desc(adaptive_improve_by_k, entry_after)
    features["best_recent_k_ad"] = max(adaptive_recent_by_k.items(), key=lambda item: item[1])[0]
    features["best_improve_k_ad"] = max(adaptive_improve_by_k.items(), key=lambda item: item[1])[0]

    adaptive_peer_recent: dict[int, float] = {}
    adaptive_peer_improve: dict[int, float] = {}
    for peer in all_states:
        if peer.kind != state.kind:
            continue
        stats = history_stats(peer.histories[entry_after], adaptive_window)
        adaptive_peer_recent[peer.ci] = float(stats["recent_net"])
        adaptive_peer_improve[peer.ci] = float(stats["improve"])
    features["entity_rank_recent_ad"] = rank_desc(adaptive_peer_recent, state.ci)
    features["entity_rank_improve_ad"] = rank_desc(adaptive_peer_improve, state.ci)

    return features


def complete_active(
    state: EntityState,
    active: ActiveOpportunity,
    hit: bool,
    completed: list[CompletedOpportunity],
) -> bool:
    amount = PROGRESSION[active.round_index]
    active.bet += amount
    if hit:
        result = CompletedOpportunity(
            session_index=active.session_index,
            session_name=active.session_name,
            tms=active.tms,
            entry_spin=active.entry_spin,
            ci=active.ci,
            label=active.label,
            kind=active.kind,
            entry_after=active.entry_after,
            hit_round=active.round_index + 1,
            bet=active.bet,
            net=amount * 3 - active.bet,
            features=active.features,
        )
        completed.append(result)
        state.histories[active.entry_after].append(result)
        return True

    active.round_index += 1
    if active.round_index >= len(PROGRESSION):
        result = CompletedOpportunity(
            session_index=active.session_index,
            session_name=active.session_name,
            tms=active.tms,
            entry_spin=active.entry_spin,
            ci=active.ci,
            label=active.label,
            kind=active.kind,
            entry_after=active.entry_after,
            hit_round=-1,
            bet=active.bet,
            net=-active.bet,
            features=active.features,
        )
        completed.append(result)
        state.histories[active.entry_after].append(result)
        return True

    return False


def generate_opportunities(sessions: list[Session]) -> list[CompletedOpportunity]:
    completed: list[CompletedOpportunity] = []
    for session in sessions:
        states = [
            EntityState(ci=0, label="group1", kind="group"),
            EntityState(ci=1, label="group2", kind="group"),
            EntityState(ci=2, label="group3", kind="group"),
            EntityState(ci=3, label="row1", kind="row"),
            EntityState(ci=4, label="row2", kind="row"),
            EntityState(ci=5, label="row3", kind="row"),
        ]

        for spin_index, value in enumerate(session.numbers):
            hits = hit_indexes(value)

            for state in states:
                hit = state.ci in hits
                done_keys: list[int] = []
                for entry_after, active in list(state.active.items()):
                    if complete_active(state, active, hit, completed):
                        done_keys.append(entry_after)
                for key in done_keys:
                    del state.active[key]

            for state in states:
                hit = state.ci in hits
                if hit:
                    if state.seen:
                        state.gaps.append(state.miss_count)
                    state.miss_count = 0
                    state.seen = True
                else:
                    state.miss_count += 1

            for state in states:
                if not state.seen:
                    continue
                for entry_after in ENTRY_AFTER_VALUES:
                    if state.miss_count != entry_after:
                        continue
                    if entry_after in state.active:
                        continue
                    features = build_features(state, states, entry_after)
                    state.active[entry_after] = ActiveOpportunity(
                        session_index=session.index,
                        session_name=session.name,
                        tms=session.tms,
                        entry_spin=spin_index + 1,
                        ci=state.ci,
                        label=state.label,
                        kind=state.kind,
                        entry_after=entry_after,
                        features=features,
                    )

    return sorted(
        completed,
        key=lambda item: (item.tms, item.session_index, item.entry_spin, item.ci, item.entry_after),
    )


def summarize(events: list[CompletedOpportunity], sessions: list[Session]) -> dict[str, float | int]:
    if not events:
        return {
            "signals": 0,
            "bet": 0,
            "net": 0,
            "roi": 0.0,
            "win_rate": 0.0,
            "max_dd": 0,
            "sessions_win": 0,
            "sessions_loss": 0,
            "from201_signals": 0,
            "from201_roi": 0.0,
            "recent3_roi": 0.0,
            "recent10_roi": 0.0,
            "recent30_roi": 0.0,
        }

    bet = sum(item.bet for item in events)
    net = sum(item.net for item in events)
    wins = sum(1 for item in events if item.won)
    pnl_by_session: dict[str, int] = defaultdict(int)
    for item in events:
        pnl_by_session[item.session_name] += item.net

    cumulative = 0
    peak = 0
    max_dd = 0
    for item in events:
        cumulative += item.net
        peak = max(peak, cumulative)
        max_dd = max(max_dd, peak - cumulative)

    from201 = [item for item in events if item.entry_spin >= 200]
    recent_names = {
        size: {session.name for session in sessions[-size:]}
        for size in (3, 10, 30)
    }

    def roi_for(subset: list[CompletedOpportunity]) -> float:
        sub_bet = sum(item.bet for item in subset)
        sub_net = sum(item.net for item in subset)
        return sub_net / sub_bet * 100 if sub_bet else 0.0

    return {
        "signals": len(events),
        "bet": bet,
        "net": net,
        "roi": net / bet * 100 if bet else 0.0,
        "win_rate": wins / len(events) * 100,
        "max_dd": max_dd,
        "sessions_win": sum(1 for value in pnl_by_session.values() if value > 0),
        "sessions_loss": sum(1 for value in pnl_by_session.values() if value < 0),
        "from201_signals": len(from201),
        "from201_roi": roi_for(from201),
        "recent3_roi": roi_for([item for item in events if item.session_name in recent_names[3]]),
        "recent10_roi": roi_for([item for item in events if item.session_name in recent_names[10]]),
        "recent30_roi": roi_for([item for item in events if item.session_name in recent_names[30]]),
    }


def fmt_summary(summary: dict[str, float | int]) -> str:
    return (
        f"sig={int(summary['signals']):4d} "
        f"ROI={float(summary['roi']):+7.2f}% "
        f"201ROI={float(summary['from201_roi']):+7.2f}% "
        f"R3={float(summary['recent3_roi']):+7.2f}% "
        f"R10={float(summary['recent10_roi']):+7.2f}% "
        f"net={int(summary['net']):+6d} "
        f"DD={int(summary['max_dd']):4d} "
        f"WR={float(summary['win_rate']):5.1f}% "
        f"S={int(summary['sessions_win'])}W/{int(summary['sessions_loss'])}L"
    )


def feature_number(event: CompletedOpportunity, name: str) -> float:
    value = event.features.get(name, 0)
    if isinstance(value, bool):
        return 1.0 if value else 0.0
    if isinstance(value, (int, float)):
        return float(value)
    return 0.0


@dataclass(frozen=True)
class MatrixRule:
    name: str
    window: int
    min_count: int
    min_improve: float
    min_recent_net: float
    min_zone_rate: float
    min_conc: float
    max_rank: int
    max_entity_rank: int
    allow_entries: tuple[int, ...]
    require_prior_loss: bool
    require_mode_in_zone: bool
    require_gap_contract: bool

    def passes(self, event: CompletedOpportunity) -> bool:
        k = event.entry_after
        if k not in self.allow_entries:
            return False
        prefix = f"k{k}_w{self.window}"
        if feature_number(event, f"{prefix}_count") < self.min_count:
            return False
        if feature_number(event, "gap_count") < 18:
            return False
        recent_net = feature_number(event, f"{prefix}_recent_net")
        prior_net = feature_number(event, f"{prefix}_prior_net")
        improve = feature_number(event, f"{prefix}_improve")
        if self.require_prior_loss and prior_net >= 0:
            return False
        if improve < self.min_improve:
            return False
        if recent_net < self.min_recent_net:
            return False
        if feature_number(event, "zone_rate_18") < self.min_zone_rate:
            return False
        if self.require_mode_in_zone and not bool(event.features.get("mode_in_zone")):
            return False
        if feature_number(event, "gap_conc_18") < self.min_conc:
            return False
        rank_recent = feature_number(event, f"rank_recent_w{self.window}")
        rank_improve = feature_number(event, f"rank_improve_w{self.window}")
        if min(rank_recent, rank_improve) > self.max_rank:
            return False
        entity_rank = min(
            feature_number(event, f"entity_rank_recent_w{self.window}"),
            feature_number(event, f"entity_rank_improve_w{self.window}"),
        )
        if entity_rank > self.max_entity_rank:
            return False
        if self.require_gap_contract and feature_number(event, "gap_trend_6v6") >= 0:
            return False
        return True


@dataclass(frozen=True)
class AdaptiveRule:
    name: str
    min_improve: float
    min_recent_net: float
    min_zone_rate: float
    min_conc: float
    max_rank: int
    max_entity_rank: int
    allow_entries: tuple[int, ...]
    allowed_bands: tuple[str, ...]
    require_prior_loss: bool
    require_mode_in_zone: bool
    require_gap_contract: bool

    def passes(self, event: CompletedOpportunity) -> bool:
        k = event.entry_after
        if k not in self.allow_entries:
            return False
        band = str(event.features.get("tempo_band", "unknown"))
        if self.allowed_bands and band not in self.allowed_bands:
            return False
        tempo_window = int(feature_number(event, "tempo_window")) or 8
        prefix = f"k{k}_ad"
        if feature_number(event, f"{prefix}_count") < max(8, tempo_window * 2):
            return False
        if feature_number(event, "gap_count") < 18:
            return False

        recent_net = feature_number(event, f"{prefix}_recent_net")
        prior_net = feature_number(event, f"{prefix}_prior_net")
        improve = feature_number(event, f"{prefix}_improve")
        if self.require_prior_loss and prior_net >= 0:
            return False
        if improve < self.min_improve:
            return False
        if recent_net < self.min_recent_net:
            return False
        if feature_number(event, "zone_rate_18") < self.min_zone_rate:
            return False
        if self.require_mode_in_zone and not bool(event.features.get("mode_in_zone")):
            return False
        if feature_number(event, "gap_conc_18") < self.min_conc:
            return False
        if min(feature_number(event, "rank_recent_ad"), feature_number(event, "rank_improve_ad")) > self.max_rank:
            return False
        if min(
            feature_number(event, "entity_rank_recent_ad"),
            feature_number(event, "entity_rank_improve_ad"),
        ) > self.max_entity_rank:
            return False
        if self.require_gap_contract and feature_number(event, "gap_trend_6v6") >= 0:
            return False
        return True


def rule_score(event: CompletedOpportunity, window: int) -> float:
    k = event.entry_after
    prefix = f"k{k}_w{window}"
    score = 0.0
    recent_net = feature_number(event, f"{prefix}_recent_net")
    prior_net = feature_number(event, f"{prefix}_prior_net")
    improve = feature_number(event, f"{prefix}_improve")

    if prior_net < 0 and improve > 0:
        score += 2
    if recent_net > 0:
        score += 1.5
    if improve >= 7:
        score += 1
    if feature_number(event, f"rank_recent_w{window}") <= 2:
        score += 1
    if feature_number(event, f"rank_improve_w{window}") <= 2:
        score += 1
    if feature_number(event, "zone_rate_18") >= 0.4:
        score += 1.5
    if bool(event.features.get("mode_in_zone")):
        score += 1
    if feature_number(event, "gap_conc_18") >= 0.55:
        score += 1
    if feature_number(event, "gap_trend_6v6") < 0:
        score += 0.75
    if feature_number(event, f"entity_rank_recent_w{window}") <= 2:
        score += 0.75
    if recent_net < 0 and improve <= 0:
        score -= 2
    if feature_number(event, "zone_rate_18") < 0.25 and feature_number(event, "gap_conc_18") < 0.45:
        score -= 1
    return score


def adaptive_score(event: CompletedOpportunity) -> float:
    k = event.entry_after
    prefix = f"k{k}_ad"
    score = 0.0
    recent_net = feature_number(event, f"{prefix}_recent_net")
    prior_net = feature_number(event, f"{prefix}_prior_net")
    improve = feature_number(event, f"{prefix}_improve")
    tempo_score = feature_number(event, "tempo_score")

    if prior_net < 0 and improve > 0:
        score += 2.0
    if recent_net > 0:
        score += 1.5
    if improve >= 4:
        score += 1.0
    if feature_number(event, "rank_recent_ad") <= 2:
        score += 1.0
    if feature_number(event, "rank_improve_ad") <= 2:
        score += 1.0
    if feature_number(event, "zone_rate_18") >= 0.36:
        score += 1.5
    if feature_number(event, "gap_conc_18") >= 0.52:
        score += 1.25
    if bool(event.features.get("mode_in_zone")):
        score += 1.0
    if feature_number(event, "gap_trend_6v6") < 0:
        score += 0.8
    if tempo_score >= 0.48 and feature_number(event, "gap_conc_18") >= 0.5:
        score += 0.8
    if tempo_score < 0.24 and feature_number(event, "gap_conc_18") < 0.58:
        score -= 1.0
    if recent_net < 0 and improve <= 0:
        score -= 2.0
    return score


def generate_rules() -> list[MatrixRule]:
    rules: list[MatrixRule] = []
    allow_sets = {
        "k1-4": (1, 2, 3, 4),
        "k2": (2,),
        "k2-3": (2, 3),
    }
    for window in (6, 8):
        for min_improve in (4, 7):
            for min_recent_net in (-7, 0):
                for min_zone_rate in (0.33, 0.40):
                    for min_conc in (0.50, 0.58):
                        for max_rank in (2,):
                            for max_entity_rank in (2,):
                                for allow_name, allow_entries in allow_sets.items():
                                    for prior_loss in (False, True):
                                        for mode_in_zone in (False, True):
                                            for gap_contract in (False, True):
                                                if min_recent_net > 0 and not prior_loss:
                                                    continue
                                                name = (
                                                    f"w{window}/imp{min_improve}/rn{min_recent_net}/"
                                                    f"zr{min_zone_rate}/c{min_conc}/r{max_rank}/"
                                                    f"er{max_entity_rank}/{allow_name}/"
                                                    f"{'pl' if prior_loss else 'np'}/"
                                                    f"{'mz' if mode_in_zone else 'nm'}/"
                                                    f"{'gc' if gap_contract else 'ng'}"
                                                )
                                                rules.append(
                                                    MatrixRule(
                                                        name=name,
                                                        window=window,
                                                        min_count=window * 2,
                                                        min_improve=min_improve,
                                                        min_recent_net=min_recent_net,
                                                        min_zone_rate=min_zone_rate,
                                                        min_conc=min_conc,
                                                        max_rank=max_rank,
                                                        max_entity_rank=max_entity_rank,
                                                        allow_entries=allow_entries,
                                                        require_prior_loss=prior_loss,
                                                        require_mode_in_zone=mode_in_zone,
                                                        require_gap_contract=gap_contract,
                                                    )
                                                )
    return rules


def generate_adaptive_rules() -> list[AdaptiveRule]:
    rules: list[AdaptiveRule] = []
    allow_sets = {
        "k2": (2,),
        "k2-3": (2, 3),
        "k1-4": (1, 2, 3, 4),
    }
    band_sets = {
        "all": (),
        "not_slow": ("fast", "medium_fast", "medium"),
        "fastish": ("fast", "medium_fast"),
    }
    for min_improve in (2, 4, 7):
        for min_recent_net in (-7, 0):
            for min_zone_rate in (0.33, 0.40):
                for min_conc in (0.50, 0.58):
                    for allow_name, allow_entries in allow_sets.items():
                        for band_name, bands in band_sets.items():
                            for prior_loss in (False, True):
                                for mode_in_zone in (False, True):
                                    for gap_contract in (False, True):
                                        name = (
                                            f"ad/imp{min_improve}/rn{min_recent_net}/"
                                            f"zr{min_zone_rate}/c{min_conc}/r2/er2/"
                                            f"{allow_name}/{band_name}/"
                                            f"{'pl' if prior_loss else 'np'}/"
                                            f"{'mz' if mode_in_zone else 'nm'}/"
                                            f"{'gc' if gap_contract else 'ng'}"
                                        )
                                        rules.append(
                                            AdaptiveRule(
                                                name=name,
                                                min_improve=min_improve,
                                                min_recent_net=min_recent_net,
                                                min_zone_rate=min_zone_rate,
                                                min_conc=min_conc,
                                                max_rank=2,
                                                max_entity_rank=2,
                                                allow_entries=allow_entries,
                                                allowed_bands=bands,
                                                require_prior_loss=prior_loss,
                                                require_mode_in_zone=mode_in_zone,
                                                require_gap_contract=gap_contract,
                                            )
                                        )
    return rules


def apply_regime(
    events: list[CompletedOpportunity],
    entry_rule: Callable[[CompletedOpportunity], bool],
    exit_rule: Callable[[CompletedOpportunity, int], bool],
) -> list[CompletedOpportunity]:
    selected: list[CompletedOpportunity] = []
    active: dict[tuple[int, int, int], int] = {}
    for event in events:
        key = (event.session_index, event.ci, event.entry_after)
        wins = active.get(key, 0)
        is_active = key in active
        if is_active and exit_rule(event, wins):
            active.pop(key, None)
            is_active = False
            wins = 0

        if is_active:
            selected.append(event)
            if event.won:
                active[key] = wins + 1
            else:
                active.pop(key, None)
            continue

        if entry_rule(event):
            selected.append(event)
            if event.won:
                active[key] = 1
            else:
                active.pop(key, None)
    return selected


def print_baselines(events: list[CompletedOpportunity], sessions: list[Session]) -> None:
    print("\n=== Baseline: fixed entry_after, no filter ===")
    for kind_name, kind_filter in (
        ("all", lambda event: True),
        ("rows", lambda event: event.kind == "row"),
        ("groups", lambda event: event.kind == "group"),
    ):
        print(f"\n-- {kind_name} --")
        for k in ENTRY_AFTER_VALUES:
            subset = [event for event in events if event.entry_after == k and kind_filter(event)]
            print(f"entry_after={k}: {fmt_summary(summarize(subset, sessions))}")


def print_entity_matrix(events: list[CompletedOpportunity], sessions: list[Session]) -> None:
    print("\n=== Entity x entry_after matrix ===")
    for label in LABELS:
        print(f"\n-- {label} --")
        for k in ENTRY_AFTER_VALUES:
            subset = [event for event in events if event.label == label and event.entry_after == k]
            print(f"k={k}: {fmt_summary(summarize(subset, sessions))}")


def year_key(event: CompletedOpportunity) -> str:
    match = re.search(r"20\d{2}", event.session_name)
    if match:
        return match.group(0)
    return "unknown"


def print_fixed_candidate_details(events: list[CompletedOpportunity], sessions: list[Session]) -> None:
    print("\n=== Fixed candidate details ===")
    candidates: list[tuple[str, Callable[[CompletedOpportunity], bool]]] = [
        ("all k2", lambda event: event.entry_after == 2),
        ("rows k2", lambda event: event.kind == "row" and event.entry_after == 2),
        ("rows k3", lambda event: event.kind == "row" and event.entry_after == 3),
        ("rows k4", lambda event: event.kind == "row" and event.entry_after == 4),
        ("row2 k3", lambda event: event.label == "row2" and event.entry_after == 3),
        ("row3 k4", lambda event: event.label == "row3" and event.entry_after == 4),
        ("row3 k5", lambda event: event.label == "row3" and event.entry_after == 5),
    ]
    for label, predicate in candidates:
        subset = [event for event in events if predicate(event)]
        print(f"\n-- {label}: {fmt_summary(summarize(subset, sessions))}")
        by_year: dict[str, list[CompletedOpportunity]] = defaultdict(list)
        for event in subset:
            by_year[year_key(event)].append(event)
        print("   years:", end="")
        for year in sorted(by_year):
            summary = summarize(by_year[year], sessions)
            print(
                f" {year}:sig={int(summary['signals'])}/ROI={float(summary['roi']):+.2f}%"
                f"/201={float(summary['from201_roi']):+.2f}%",
                end="",
            )
        print()


def top_rules(events: list[CompletedOpportunity], sessions: list[Session]) -> list[tuple[MatrixRule, dict[str, float | int]]]:
    results: list[tuple[MatrixRule, dict[str, float | int]]] = []
    for rule in generate_rules():
        subset = [event for event in events if rule.passes(event)]
        summary = summarize(subset, sessions)
        if int(summary["signals"]) < 40:
            continue
        if int(summary["from201_signals"]) < 20:
            continue
        results.append((rule, summary))
    results.sort(
        key=lambda item: (
            float(item[1]["from201_roi"]),
            float(item[1]["roi"]),
            -float(item[1]["max_dd"]),
            int(item[1]["signals"]),
        ),
        reverse=True,
    )
    return results


def top_adaptive_rules(events: list[CompletedOpportunity], sessions: list[Session]) -> list[tuple[AdaptiveRule, dict[str, float | int]]]:
    results: list[tuple[AdaptiveRule, dict[str, float | int]]] = []
    for rule in generate_adaptive_rules():
        subset = [event for event in events if rule.passes(event)]
        summary = summarize(subset, sessions)
        if int(summary["signals"]) < 40:
            continue
        if int(summary["from201_signals"]) < 20:
            continue
        results.append((rule, summary))
    results.sort(
        key=lambda item: (
            float(item[1]["from201_roi"]),
            float(item[1]["roi"]),
            -float(item[1]["max_dd"]),
            int(item[1]["signals"]),
        ),
        reverse=True,
    )
    return results


def print_rule_results(events: list[CompletedOpportunity], sessions: list[Session]) -> list[MatrixRule]:
    print("\n=== Matrix-filter candidates, sorted by from-201 ROI ===")
    ranked = top_rules(events, sessions)
    for index, (rule, summary) in enumerate(ranked[:25], start=1):
        print(f"{index:2d}. {fmt_summary(summary)}  {rule.name}")

    balanced = [
        (rule, summary)
        for rule, summary in ranked
        if float(summary["roi"]) > 0
        and float(summary["from201_roi"]) > 0
        and float(summary["recent10_roi"]) > 0
        and float(summary["recent3_roi"]) > 0
    ]
    balanced.sort(
        key=lambda item: (
            min(
                float(item[1]["roi"]),
                float(item[1]["from201_roi"]),
                float(item[1]["recent10_roi"]),
                float(item[1]["recent3_roi"]),
            ),
            float(item[1]["roi"]),
        ),
        reverse=True,
    )
    print("\n=== Balanced matrix candidates, all visible scopes positive ===")
    for index, (rule, summary) in enumerate(balanced[:15], start=1):
        print(f"{index:2d}. {fmt_summary(summary)}  {rule.name}")

    preferred = balanced[:3] + ranked[:5]
    deduped: list[MatrixRule] = []
    seen_names: set[str] = set()
    for rule, _summary in preferred:
        if rule.name in seen_names:
            continue
        seen_names.add(rule.name)
        deduped.append(rule)
    return deduped[:8]


def print_adaptive_rule_results(events: list[CompletedOpportunity], sessions: list[Session]) -> list[AdaptiveRule]:
    print("\n=== Adaptive-window candidates, sorted by from-201 ROI ===")
    ranked = top_adaptive_rules(events, sessions)
    for index, (rule, summary) in enumerate(ranked[:25], start=1):
        print(f"{index:2d}. {fmt_summary(summary)}  {rule.name}")

    balanced = [
        (rule, summary)
        for rule, summary in ranked
        if float(summary["roi"]) > 0
        and float(summary["from201_roi"]) > 0
        and float(summary["recent10_roi"]) > 0
        and float(summary["recent3_roi"]) > 0
    ]
    balanced.sort(
        key=lambda item: (
            min(
                float(item[1]["roi"]),
                float(item[1]["from201_roi"]),
                float(item[1]["recent10_roi"]),
                float(item[1]["recent3_roi"]),
            ),
            float(item[1]["roi"]),
        ),
        reverse=True,
    )
    print("\n=== Balanced adaptive-window candidates, all visible scopes positive ===")
    for index, (rule, summary) in enumerate(balanced[:15], start=1):
        print(f"{index:2d}. {fmt_summary(summary)}  {rule.name}")

    return [rule for rule, _summary in balanced[:5]]


def print_score_thresholds(events: list[CompletedOpportunity], sessions: list[Session]) -> None:
    print("\n=== Simple score thresholds ===")
    for window in (5, 6, 8):
        print(f"\n-- window={window} --")
        scored = [(event, rule_score(event, window)) for event in events]
        for threshold in (4.0, 5.0, 6.0, 7.0, 8.0):
            subset = [
                event
                for event, score in scored
                if score >= threshold and feature_number(event, f"k{event.entry_after}_w{window}_count") >= window * 2
            ]
            print(f"score>={threshold:>3.1f}: {fmt_summary(summarize(subset, sessions))}")

    print("\n-- adaptive --")
    adaptive_scored = [(event, adaptive_score(event)) for event in events]
    for threshold in (4.0, 5.0, 6.0, 7.0, 8.0):
        subset = [
            event
            for event, score in adaptive_scored
            if score >= threshold
            and feature_number(event, f"k{event.entry_after}_ad_count")
            >= max(8, feature_number(event, "tempo_window") * 2)
        ]
        print(f"ad-score>={threshold:>3.1f}: {fmt_summary(summarize(subset, sessions))}")


def print_regime_tests(
    events: list[CompletedOpportunity],
    sessions: list[Session],
    candidate_rules: list[MatrixRule],
) -> None:
    print("\n=== Regime tests: enter on rule, then continue same entity/k ===")
    for rule in candidate_rules[:5]:
        variants: list[tuple[str, list[CompletedOpportunity]]] = []
        variants.append((
            "until_loss",
            apply_regime(events, rule.passes, lambda _event, _wins: False),
        ))
        variants.append((
            "max2wins",
            apply_regime(events, rule.passes, lambda _event, wins: wins >= 2),
        ))
        variants.append((
            "score_guard",
            apply_regime(
                events,
                rule.passes,
                lambda event, _wins: rule_score(event, rule.window) < 4.5
                or feature_number(event, f"k{event.entry_after}_w{rule.window}_improve") < 0,
            ),
        ))
        print(f"\n-- base rule: {rule.name} --")
        independent = [event for event in events if rule.passes(event)]
        print(f"single:      {fmt_summary(summarize(independent, sessions))}")
        for name, subset in variants:
            print(f"{name:<12s} {fmt_summary(summarize(subset, sessions))}")


def print_adaptive_regime_tests(
    events: list[CompletedOpportunity],
    sessions: list[Session],
    candidate_rules: list[AdaptiveRule],
) -> None:
    print("\n=== Adaptive regime tests: enter on adaptive rule, then continue same entity/k ===")
    for rule in candidate_rules[:5]:
        variants: list[tuple[str, list[CompletedOpportunity]]] = []
        variants.append((
            "until_loss",
            apply_regime(events, rule.passes, lambda _event, _wins: False),
        ))
        variants.append((
            "max2wins",
            apply_regime(events, rule.passes, lambda _event, wins: wins >= 2),
        ))
        variants.append((
            "tempo_guard",
            apply_regime(
                events,
                rule.passes,
                lambda event, _wins: adaptive_score(event) < 4.5
                or feature_number(event, f"k{event.entry_after}_ad_improve") < 0
                or (
                    str(event.features.get("tempo_band", "")) == "slow"
                    and feature_number(event, "gap_conc_18") < 0.58
                ),
            ),
        ))
        print(f"\n-- adaptive rule: {rule.name} --")
        independent = [event for event in events if rule.passes(event)]
        print(f"single:      {fmt_summary(summarize(independent, sessions))}")
        for name, subset in variants:
            print(f"{name:<12s} {fmt_summary(summarize(subset, sessions))}")


def high_frequency_candidates(events: list[CompletedOpportunity], sessions: list[Session]) -> list[tuple[str, list[CompletedOpportunity], dict[str, float | int]]]:
    candidates: list[tuple[str, list[CompletedOpportunity], dict[str, float | int]]] = []

    def add(name: str, subset: list[CompletedOpportunity]) -> None:
        summary = summarize(subset, sessions)
        if int(summary["signals"]) < 250:
            return
        if float(summary["roi"]) < -1.0:
            return
        if float(summary["from201_roi"]) < -1.0:
            return
        candidates.append((name, subset, summary))

    for kind_name, predicate in (
        ("all", lambda event: True),
        ("rows", lambda event: event.kind == "row"),
        ("groups", lambda event: event.kind == "group"),
    ):
        for k_set_name, k_set in (
            ("k2", (2,)),
            ("k2-3", (2, 3)),
            ("k3-4", (3, 4)),
            ("k2-4", (2, 3, 4)),
            ("k1-4", (1, 2, 3, 4)),
        ):
            base = [
                event
                for event in events
                if predicate(event) and event.entry_after in k_set and feature_number(event, "gap_count") >= 18
            ]
            add(f"base/{kind_name}/{k_set_name}", base)

            for zone in (0.25, 0.30, 0.33, 0.36):
                for conc in (0.40, 0.45, 0.50):
                    filtered = [
                        event
                        for event in base
                        if feature_number(event, "zone_rate_18") >= zone
                        and feature_number(event, "gap_conc_18") >= conc
                    ]
                    add(f"zc/{kind_name}/{k_set_name}/zr{zone}/c{conc}", filtered)

            for score_threshold in (4.0, 5.0, 6.0):
                scored = [
                    event
                    for event in base
                    if adaptive_score(event) >= score_threshold
                    and feature_number(event, f"k{event.entry_after}_ad_count")
                    >= max(8, feature_number(event, "tempo_window") * 2)
                ]
                add(f"score/{kind_name}/{k_set_name}/ad{score_threshold}", scored)

            for improve in (-4, 0, 2, 4):
                for recent_net in (-14, -7, 0):
                    matrix = [
                        event
                        for event in base
                        if feature_number(event, f"k{event.entry_after}_ad_count")
                        >= max(8, feature_number(event, "tempo_window") * 2)
                        and feature_number(event, f"k{event.entry_after}_ad_improve") >= improve
                        and feature_number(event, f"k{event.entry_after}_ad_recent_net") >= recent_net
                        and min(feature_number(event, "rank_recent_ad"), feature_number(event, "rank_improve_ad")) <= 3
                    ]
                    add(f"matrix/{kind_name}/{k_set_name}/imp{improve}/rn{recent_net}", matrix)

    # Entity-specific candidates are sometimes more stable than broad rows/groups.
    for label in LABELS:
        for k_set_name, k_set in (
            ("k2", (2,)),
            ("k3", (3,)),
            ("k4", (4,)),
            ("k2-3", (2, 3)),
            ("k3-4", (3, 4)),
        ):
            base = [
                event
                for event in events
                if event.label == label and event.entry_after in k_set and feature_number(event, "gap_count") >= 18
            ]
            add(f"entity/{label}/{k_set_name}", base)
            for zone in (0.25, 0.30, 0.33):
                for conc in (0.40, 0.45):
                    filtered = [
                        event
                        for event in base
                        if feature_number(event, "zone_rate_18") >= zone
                        and feature_number(event, "gap_conc_18") >= conc
                    ]
                    add(f"entity-zc/{label}/{k_set_name}/zr{zone}/c{conc}", filtered)

    candidates.sort(
        key=lambda item: (
            int(item[2]["signals"]) >= 1000,
            float(item[2]["from201_roi"]),
            float(item[2]["roi"]),
            -float(item[2]["max_dd"]),
            int(item[2]["signals"]),
        ),
        reverse=True,
    )

    deduped: list[tuple[str, list[CompletedOpportunity], dict[str, float | int]]] = []
    seen: set[tuple[int, int, int, int]] = set()
    for name, subset, summary in candidates:
        signature = (
            int(summary["signals"]),
            int(summary["bet"]),
            int(summary["net"]),
            int(summary["max_dd"]),
        )
        if signature in seen:
            continue
        seen.add(signature)
        deduped.append((name, subset, summary))
    return deduped


def print_high_frequency_candidates(events: list[CompletedOpportunity], sessions: list[Session]) -> None:
    print("\n=== High-frequency candidates, min 250 signals ===")
    candidates = high_frequency_candidates(events, sessions)
    print("\n-- sorted by from-201 ROI, requiring all/full from201 >= -1% --")
    for index, (name, _subset, summary) in enumerate(candidates[:35], start=1):
        print(f"{index:2d}. {fmt_summary(summary)}  {name}")

    print("\n-- high-frequency balanced: signals>=500 and all visible scopes >= 0 --")
    balanced = [
        (name, subset, summary)
        for name, subset, summary in candidates
        if int(summary["signals"]) >= 500
        and float(summary["roi"]) >= 0
        and float(summary["from201_roi"]) >= 0
        and float(summary["recent10_roi"]) >= 0
        and float(summary["recent3_roi"]) >= 0
    ]
    balanced.sort(
        key=lambda item: (
            min(
                float(item[2]["roi"]),
                float(item[2]["from201_roi"]),
                float(item[2]["recent10_roi"]),
                float(item[2]["recent3_roi"]),
            ),
            int(item[2]["signals"]),
            float(item[2]["roi"]),
        ),
        reverse=True,
    )
    for index, (name, _subset, summary) in enumerate(balanced[:20], start=1):
        print(f"{index:2d}. {fmt_summary(summary)}  {name}")


def print_recent_sessions(events: list[CompletedOpportunity], sessions: list[Session], rule: MatrixRule | AdaptiveRule | None) -> None:
    print("\n=== Recent session detail ===")
    if rule is None:
        print("No rule candidate available.")
        return
    selected = [event for event in events if rule.passes(event)]
    by_session: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in selected:
        by_session[event.session_name].append(event)
    print(f"rule: {rule.name}")
    for session in sessions[-10:]:
        subset = by_session.get(session.name, [])
        print(f"{session.name:<28s} {fmt_summary(summarize(subset, [session]))}")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    sessions = load_sessions(root / "history_data.json")
    print(
        f"Loaded {len(sessions)} sessions, "
        f"{sum(len(session.numbers) for session in sessions)} spins, "
        f"{sessions[0].name} -> {sessions[-1].name}"
    )

    events = generate_opportunities(sessions)
    print(f"Generated {len(events)} completed paper opportunities.")

    print_baselines(events, sessions)
    print_entity_matrix(events, sessions)
    print_fixed_candidate_details(events, sessions)
    print_score_thresholds(events, sessions)
    candidate_rules = print_rule_results(events, sessions)
    adaptive_rules = print_adaptive_rule_results(events, sessions)
    print_high_frequency_candidates(events, sessions)
    print_regime_tests(events, sessions, candidate_rules)
    print_adaptive_regime_tests(events, sessions, adaptive_rules)
    print_recent_sessions(events, sessions, candidate_rules[0] if candidate_rules else None)
    print_recent_sessions(events, sessions, adaptive_rules[0] if adaptive_rules else None)


if __name__ == "__main__":
    main()
