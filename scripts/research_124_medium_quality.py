"""
Focused research for the medium-frequency / higher-quality 124 candidates.

The script reuses the neutral opportunity generator from research_124_timing.py
and then studies the group2/group3, k3/k4, zone/concentration family:

- entity and k-set decomposition
- threshold sensitivity
- optional guards: mode-in-zone, gap contraction, tempo band, adaptive score
- year/session/recent stability
- hit-round mix and concentration of profit

Run:
  python scripts/research_124_medium_quality.py
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Callable, Iterable

from research_124_timing import (
    CompletedOpportunity,
    feature_number,
    fmt_summary,
    generate_opportunities,
    load_sessions,
    summarize,
    year_key,
)


EventPredicate = Callable[[CompletedOpportunity], bool]


@dataclass(frozen=True)
class CandidateSpec:
    name: str
    labels: tuple[str, ...]
    entries: tuple[int, ...]
    zone: float = 0.25
    conc: float = 0.45
    require_mode_in_zone: bool = False
    require_gap_contract: bool = False
    allowed_bands: tuple[str, ...] = ()
    min_adaptive_score: float | None = None


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


def predicate_for(spec: CandidateSpec) -> EventPredicate:
    def passes(event: CompletedOpportunity) -> bool:
        if event.label not in spec.labels:
            return False
        if event.entry_after not in spec.entries:
            return False
        if feature_number(event, "gap_count") < 18:
            return False
        if feature_number(event, "zone_rate_18") < spec.zone:
            return False
        if feature_number(event, "gap_conc_18") < spec.conc:
            return False
        if spec.require_mode_in_zone and not bool(event.features.get("mode_in_zone")):
            return False
        if spec.require_gap_contract and feature_number(event, "gap_trend_6v6") >= 0:
            return False
        if spec.allowed_bands and str(event.features.get("tempo_band", "")) not in spec.allowed_bands:
            return False
        if spec.min_adaptive_score is not None:
            prefix = f"k{event.entry_after}_ad"
            required_count = max(8, feature_number(event, "tempo_window") * 2)
            if feature_number(event, f"{prefix}_count") < required_count:
                return False
            if adaptive_score(event) < spec.min_adaptive_score:
                return False
        return True

    return passes


def select(events: list[CompletedOpportunity], spec: CandidateSpec) -> list[CompletedOpportunity]:
    pred = predicate_for(spec)
    return [event for event in events if pred(event)]


def roi(events: Iterable[CompletedOpportunity]) -> float:
    items = list(events)
    bet = sum(event.bet for event in items)
    net = sum(event.net for event in items)
    return net / bet * 100 if bet else 0.0


def print_spec_summary(
    events: list[CompletedOpportunity],
    sessions,
    specs: list[CandidateSpec],
) -> None:
    print("\n=== Core medium-quality candidates ===")
    for spec in specs:
        subset = select(events, spec)
        print(f"{spec.name:<42s} {fmt_summary(summarize(subset, sessions))}")


def print_decomposition(events: list[CompletedOpportunity], sessions) -> None:
    print("\n=== Entity x k decomposition, z>=0.25 c>=0.45 ===")
    for label in ("group2", "group3"):
        for entries_name, entries in (
            ("k3", (3,)),
            ("k4", (4,)),
            ("k3-4", (3, 4)),
        ):
            spec = CandidateSpec(
                name=f"{label}/{entries_name}",
                labels=(label,),
                entries=entries,
            )
            subset = select(events, spec)
            print(f"{spec.name:<14s} {fmt_summary(summarize(subset, sessions))}")


def print_threshold_grid(events: list[CompletedOpportunity], sessions) -> None:
    print("\n=== Threshold sensitivity: labels=group2+group3, k3-4 ===")
    results: list[tuple[float, float, dict[str, float | int]]] = []
    for zone in (0.20, 0.25, 0.30, 0.33, 0.36, 0.40, 0.45):
        for conc in (0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65):
            spec = CandidateSpec(
                name=f"z{zone}/c{conc}",
                labels=("group2", "group3"),
                entries=(3, 4),
                zone=zone,
                conc=conc,
            )
            summary = summarize(select(events, spec), sessions)
            if int(summary["signals"]) < 120:
                continue
            if float(summary["roi"]) <= 0 or float(summary["from201_roi"]) <= 0:
                continue
            results.append((zone, conc, summary))

    results.sort(
        key=lambda item: (
            min(
                float(item[2]["roi"]),
                float(item[2]["from201_roi"]),
                float(item[2]["recent10_roi"]),
                float(item[2]["recent3_roi"]),
            ),
            float(item[2]["roi"]),
            int(item[2]["signals"]),
        ),
        reverse=True,
    )
    for index, (zone, conc, summary) in enumerate(results[:20], start=1):
        print(f"{index:2d}. z>={zone:.2f} c>={conc:.2f} {fmt_summary(summary)}")


def print_guard_scan(events: list[CompletedOpportunity], sessions) -> None:
    print("\n=== Guard scan from group2+group3/k3-4/z0.25/c0.45 ===")
    specs = [
        CandidateSpec("base", ("group2", "group3"), (3, 4)),
        CandidateSpec("mode-in-zone", ("group2", "group3"), (3, 4), require_mode_in_zone=True),
        CandidateSpec("gap-contract", ("group2", "group3"), (3, 4), require_gap_contract=True),
        CandidateSpec(
            "exclude-slow",
            ("group2", "group3"),
            (3, 4),
            allowed_bands=("fast", "medium_fast", "medium"),
        ),
        CandidateSpec(
            "exclude-fast",
            ("group2", "group3"),
            (3, 4),
            allowed_bands=("medium_fast", "medium", "slow"),
        ),
        CandidateSpec(
            "medium+slow",
            ("group2", "group3"),
            (3, 4),
            allowed_bands=("medium", "slow"),
        ),
        CandidateSpec(
            "fastish",
            ("group2", "group3"),
            (3, 4),
            allowed_bands=("fast", "medium_fast"),
        ),
        CandidateSpec("ad-score>=4", ("group2", "group3"), (3, 4), min_adaptive_score=4.0),
        CandidateSpec("ad-score>=5", ("group2", "group3"), (3, 4), min_adaptive_score=5.0),
        CandidateSpec("ad-score>=6", ("group2", "group3"), (3, 4), min_adaptive_score=6.0),
        CandidateSpec(
            "mode+ad>=4",
            ("group2", "group3"),
            (3, 4),
            require_mode_in_zone=True,
            min_adaptive_score=4.0,
        ),
        CandidateSpec(
            "exclude-fast+ad>=4",
            ("group2", "group3"),
            (3, 4),
            allowed_bands=("medium_fast", "medium", "slow"),
            min_adaptive_score=4.0,
        ),
    ]
    for spec in specs:
        subset = select(events, spec)
        print(f"{spec.name:<16s} {fmt_summary(summarize(subset, sessions))}")


def print_tempos(events: list[CompletedOpportunity], sessions) -> None:
    print("\n=== Tempo bands for base group2+group3/k3-4/z0.25/c0.45 ===")
    base = select(events, CandidateSpec("base", ("group2", "group3"), (3, 4)))
    by_band: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in base:
        by_band[str(event.features.get("tempo_band", "unknown"))].append(event)
    for band in ("fast", "medium_fast", "medium", "slow", "unknown"):
        subset = by_band.get(band, [])
        if subset:
            print(f"{band:<12s} {fmt_summary(summarize(subset, sessions))}")


def print_years(events: list[CompletedOpportunity], sessions, spec: CandidateSpec) -> None:
    subset = select(events, spec)
    by_year: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in subset:
        by_year[year_key(event)].append(event)

    print(f"\n=== Year stability: {spec.name} ===")
    for year in sorted(by_year):
        print(f"{year:<8s} {fmt_summary(summarize(by_year[year], sessions))}")


def print_recent_sessions(events: list[CompletedOpportunity], sessions, spec: CandidateSpec) -> None:
    subset = select(events, spec)
    by_session: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in subset:
        by_session[event.session_name].append(event)

    print(f"\n=== Recent 12 sessions: {spec.name} ===")
    for session in sessions[-12:]:
        session_events = by_session.get(session.name, [])
        print(f"{session.name:<34s} {fmt_summary(summarize(session_events, [session]))}")


def print_session_concentration(events: list[CompletedOpportunity], sessions, spec: CandidateSpec) -> None:
    subset = select(events, spec)
    by_session: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in subset:
        by_session[event.session_name].append(event)

    session_rows = []
    for session in sessions:
        items = by_session.get(session.name, [])
        if not items:
            continue
        session_rows.append((session.name, len(items), sum(event.net for event in items), roi(items)))

    nets = [row[2] for row in session_rows]
    wins = sum(1 for value in nets if value > 0)
    losses = sum(1 for value in nets if value < 0)
    flats = sum(1 for value in nets if value == 0)
    positive_total = sum(value for value in nets if value > 0)
    top_winners = sorted(session_rows, key=lambda row: row[2], reverse=True)[:5]
    top_losers = sorted(session_rows, key=lambda row: row[2])[:5]
    top3_positive = sum(max(0, row[2]) for row in top_winners[:3])
    positive_share = top3_positive / positive_total * 100 if positive_total else 0.0

    print(f"\n=== Session concentration: {spec.name} ===")
    print(
        f"sessions_with_signals={len(session_rows)} "
        f"W/L/F={wins}/{losses}/{flats} "
        f"median_session_net={median(nets) if nets else 0:+.1f} "
        f"top3_positive_share={positive_share:.1f}%"
    )
    print("top winners:")
    for name, count, net, session_roi in top_winners:
        print(f"  {name:<34s} sig={count:3d} net={net:+4d} ROI={session_roi:+7.2f}%")
    print("top losers:")
    for name, count, net, session_roi in top_losers:
        print(f"  {name:<34s} sig={count:3d} net={net:+4d} ROI={session_roi:+7.2f}%")


def print_hit_mix(events: list[CompletedOpportunity], sessions, spec: CandidateSpec) -> None:
    subset = select(events, spec)
    counts: dict[int, int] = defaultdict(int)
    net_by_round: dict[int, int] = defaultdict(int)
    bet_by_round: dict[int, int] = defaultdict(int)
    for event in subset:
        counts[event.hit_round] += 1
        net_by_round[event.hit_round] += event.net
        bet_by_round[event.hit_round] += event.bet

    print(f"\n=== Hit-round mix: {spec.name} ===")
    total = len(subset)
    for round_key, label in ((1, "hit1"), (2, "hit2"), (3, "hit3"), (-1, "miss")):
        count = counts.get(round_key, 0)
        rate = count / total * 100 if total else 0
        bet = bet_by_round.get(round_key, 0)
        net = net_by_round.get(round_key, 0)
        round_roi = net / bet * 100 if bet else 0
        print(f"{label:<6s} count={count:4d} rate={rate:5.1f}% net={net:+5d} ROI={round_roi:+7.2f}%")


def print_best_rule_scan(events: list[CompletedOpportunity], sessions) -> None:
    print("\n=== Best robust medium scans, 180-800 signals, all visible scopes positive ===")
    medium_pool = [
        event
        for event in events
        if event.label in ("group2", "group3")
        and event.entry_after in (3, 4)
        and feature_number(event, "gap_count") >= 18
    ]
    label_sets = {
        "g2": ("group2",),
        "g3": ("group3",),
        "g2+g3": ("group2", "group3"),
    }
    entry_sets = {
        "k3": (3,),
        "k4": (4,),
        "k3-4": (3, 4),
    }
    band_sets = {
        "all": (),
        "exclude_fast": ("medium_fast", "medium", "slow"),
        "medium_slow": ("medium", "slow"),
    }
    results = []
    for label_name, labels in label_sets.items():
        for entry_name, entries in entry_sets.items():
            for zone in (0.20, 0.25, 0.30, 0.33, 0.36, 0.40):
                for conc in (0.40, 0.45, 0.50, 0.55):
                    for mode in (False, True):
                        for band_name, bands in band_sets.items():
                            for ad_score in (None, 4.0):
                                spec = CandidateSpec(
                                    name=(
                                        f"{label_name}/{entry_name}/z{zone}/c{conc}/"
                                        f"{'mz' if mode else 'nm'}/"
                                        f"{band_name}/"
                                        f"ad{ad_score if ad_score is not None else 'none'}"
                                    ),
                                    labels=labels,
                                    entries=entries,
                                    zone=zone,
                                    conc=conc,
                                    require_mode_in_zone=mode,
                                    allowed_bands=bands,
                                    min_adaptive_score=ad_score,
                                )
                                summary = summarize(select(medium_pool, spec), sessions)
                                signals = int(summary["signals"])
                                if signals < 180 or signals > 800:
                                    continue
                                visible = (
                                    float(summary["roi"]),
                                    float(summary["from201_roi"]),
                                    float(summary["recent10_roi"]),
                                    float(summary["recent3_roi"]),
                                )
                                if min(visible) <= 0:
                                    continue
                                robust_score = min(visible)
                                results.append((robust_score, spec, summary))

    results.sort(
        key=lambda item: (
            item[0],
            float(item[2]["roi"]),
            float(item[2]["from201_roi"]),
            -float(item[2]["max_dd"]),
            int(item[2]["signals"]),
        ),
        reverse=True,
    )
    seen: set[tuple[int, int, int, int]] = set()
    shown = 0
    for robust_score, spec, summary in results:
        signature = (
            int(summary["signals"]),
            int(summary["bet"]),
            int(summary["net"]),
            int(summary["max_dd"]),
        )
        if signature in seen:
            continue
        seen.add(signature)
        shown += 1
        print(f"{shown:2d}. floor={robust_score:+6.2f}% {fmt_summary(summary)}  {spec.name}")
        if shown >= 25:
            break


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    sessions = load_sessions(root / "history_data.json")
    events = generate_opportunities(sessions)
    print(
        f"Loaded {len(sessions)} sessions, "
        f"{sum(len(session.numbers) for session in sessions)} spins, "
        f"events={len(events)}"
    )

    core_specs = [
        CandidateSpec("group2/k3-4/z0.25/c0.45", ("group2",), (3, 4)),
        CandidateSpec("group3/k3-4/z0.25/c0.45", ("group3",), (3, 4)),
        CandidateSpec("group2+group3/k3-4/z0.25/c0.45", ("group2", "group3"), (3, 4)),
        CandidateSpec("group2+group3/k3-4/z0.30/c0.45", ("group2", "group3"), (3, 4), zone=0.30),
        CandidateSpec(
            "group2+group3/k3-4/z0.25/c0.45/exclude-fast",
            ("group2", "group3"),
            (3, 4),
            allowed_bands=("medium_fast", "medium", "slow"),
        ),
        CandidateSpec(
            "group2+group3/k3-4/z0.30/c0.45/exclude-fast",
            ("group2", "group3"),
            (3, 4),
            zone=0.30,
            allowed_bands=("medium_fast", "medium", "slow"),
        ),
        CandidateSpec(
            "group3/k3-4/z0.25/c0.45/exclude-fast",
            ("group3",),
            (3, 4),
            allowed_bands=("medium_fast", "medium", "slow"),
        ),
        CandidateSpec("group3/k3/z0.25/c0.45", ("group3",), (3,)),
        CandidateSpec("group2/k3/z0.25/c0.45", ("group2",), (3,)),
    ]
    print_spec_summary(events, sessions, core_specs)
    print_decomposition(events, sessions)
    print_threshold_grid(events, sessions)
    print_guard_scan(events, sessions)
    print_tempos(events, sessions)
    print_best_rule_scan(events, sessions)

    chosen = CandidateSpec("group2+group3/k3-4/z0.25/c0.45", ("group2", "group3"), (3, 4))
    tighter = CandidateSpec("group2+group3/k3-4/z0.30/c0.45", ("group2", "group3"), (3, 4), zone=0.30)
    chosen_no_fast = CandidateSpec(
        "group2+group3/k3-4/z0.25/c0.45/exclude-fast",
        ("group2", "group3"),
        (3, 4),
        allowed_bands=("medium_fast", "medium", "slow"),
    )
    tighter_no_fast = CandidateSpec(
        "group2+group3/k3-4/z0.30/c0.45/exclude-fast",
        ("group2", "group3"),
        (3, 4),
        zone=0.30,
        allowed_bands=("medium_fast", "medium", "slow"),
    )
    stronger = CandidateSpec("group3/k3-4/z0.25/c0.45", ("group3",), (3, 4))
    stronger_no_fast = CandidateSpec(
        "group3/k3-4/z0.25/c0.45/exclude-fast",
        ("group3",),
        (3, 4),
        allowed_bands=("medium_fast", "medium", "slow"),
    )
    print_years(events, sessions, chosen)
    print_years(events, sessions, tighter)
    print_years(events, sessions, chosen_no_fast)
    print_years(events, sessions, tighter_no_fast)
    print_years(events, sessions, stronger)
    print_years(events, sessions, stronger_no_fast)
    print_recent_sessions(events, sessions, chosen)
    print_recent_sessions(events, sessions, tighter)
    print_recent_sessions(events, sessions, chosen_no_fast)
    print_recent_sessions(events, sessions, tighter_no_fast)
    print_session_concentration(events, sessions, chosen)
    print_session_concentration(events, sessions, tighter)
    print_session_concentration(events, sessions, chosen_no_fast)
    print_session_concentration(events, sessions, tighter_no_fast)
    print_session_concentration(events, sessions, stronger)
    print_session_concentration(events, sessions, stronger_no_fast)
    print_hit_mix(events, sessions, chosen)
    print_hit_mix(events, sessions, tighter)
    print_hit_mix(events, sessions, chosen_no_fast)
    print_hit_mix(events, sessions, tighter_no_fast)
    print_hit_mix(events, sessions, stronger)
    print_hit_mix(events, sessions, stronger_no_fast)


if __name__ == "__main__":
    main()
