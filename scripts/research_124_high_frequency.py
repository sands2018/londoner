"""
Focused research for high-frequency 124 candidates.

High-frequency here means at least 500 complete 1-2-4 opportunities. The goal
is to find rules that fire often enough to matter while keeping ROI, recent
performance, and drawdown acceptable.

Run:
  python scripts/research_124_high_frequency.py
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from statistics import median
from typing import Iterable

from research_124_timing import (
    CompletedOpportunity,
    feature_number,
    fmt_summary,
    generate_opportunities,
    load_sessions,
    summarize,
    year_key,
)


@dataclass(frozen=True)
class RuleSpec:
    name: str
    labels: tuple[str, ...] = ()
    kinds: tuple[str, ...] = ()
    entries: tuple[int, ...] = ()
    min_gap_count: int = 0
    min_zone: float | None = None
    min_conc: float | None = None
    allowed_bands: tuple[str, ...] = ()
    excluded_bands: tuple[str, ...] = ()


def passes(event: CompletedOpportunity, spec: RuleSpec) -> bool:
    if spec.labels and event.label not in spec.labels:
        return False
    if spec.kinds and event.kind not in spec.kinds:
        return False
    if spec.entries and event.entry_after not in spec.entries:
        return False
    if feature_number(event, "gap_count") < spec.min_gap_count:
        return False
    if spec.min_zone is not None and feature_number(event, "zone_rate_18") < spec.min_zone:
        return False
    if spec.min_conc is not None and feature_number(event, "gap_conc_18") < spec.min_conc:
        return False
    band = str(event.features.get("tempo_band", "unknown"))
    if spec.allowed_bands and band not in spec.allowed_bands:
        return False
    if spec.excluded_bands and band in spec.excluded_bands:
        return False
    return True


def select(events: list[CompletedOpportunity], spec: RuleSpec) -> list[CompletedOpportunity]:
    return [event for event in events if passes(event, spec)]


def roi(events: Iterable[CompletedOpportunity]) -> float:
    items = list(events)
    bet = sum(event.bet for event in items)
    net = sum(event.net for event in items)
    return net / bet * 100 if bet else 0.0


def print_core(events: list[CompletedOpportunity], sessions) -> None:
    print("\n=== Core high-frequency candidates ===")
    specs = [
        RuleSpec("row3/k4", labels=("row3",), entries=(4,)),
        RuleSpec("row3/k4/gap18", labels=("row3",), entries=(4,), min_gap_count=18),
        RuleSpec("row3/k4/exclude-fast", labels=("row3",), entries=(4,), excluded_bands=("fast",)),
        RuleSpec("row3/k4/gap18/exclude-fast", labels=("row3",), entries=(4,), min_gap_count=18, excluded_bands=("fast",)),
        RuleSpec("row3/k4/medium+slow", labels=("row3",), entries=(4,), allowed_bands=("medium", "slow")),
        RuleSpec("row3/k4/gap18/medium+slow", labels=("row3",), entries=(4,), min_gap_count=18, allowed_bands=("medium", "slow")),
        RuleSpec("row3/k4/z0.25/c0.45", labels=("row3",), entries=(4,), min_gap_count=18, min_zone=0.25, min_conc=0.45),
        RuleSpec("all/k3-4/z0.25/c0.45", entries=(3, 4), min_gap_count=18, min_zone=0.25, min_conc=0.45),
        RuleSpec("all/k3-4/z0.25/c0.45/exclude-fast", entries=(3, 4), min_gap_count=18, min_zone=0.25, min_conc=0.45, excluded_bands=("fast",)),
        RuleSpec("rows/k3-4/z0.25/c0.45", kinds=("row",), entries=(3, 4), min_gap_count=18, min_zone=0.25, min_conc=0.45),
        RuleSpec("groups/k3-4/z0.25/c0.45", kinds=("group",), entries=(3, 4), min_gap_count=18, min_zone=0.25, min_conc=0.45),
        RuleSpec("g2+g3/k3-4/z0.20/c0.35", labels=("group2", "group3"), entries=(3, 4), min_gap_count=18, min_zone=0.20, min_conc=0.35),
        RuleSpec("g2+g3/k3-4/z0.25/c0.40", labels=("group2", "group3"), entries=(3, 4), min_gap_count=18, min_zone=0.25, min_conc=0.40),
    ]
    for spec in specs:
        subset = select(events, spec)
        print(f"{spec.name:<42s} {fmt_summary(summarize(subset, sessions))}")


def print_threshold_scan(events: list[CompletedOpportunity], sessions) -> None:
    print("\n=== High-frequency threshold scan, signals>=500 ===")
    label_sets = {
        "all": RuleSpec("all"),
        "rows": RuleSpec("rows", kinds=("row",)),
        "groups": RuleSpec("groups", kinds=("group",)),
        "g2+g3": RuleSpec("g2+g3", labels=("group2", "group3")),
        "row3": RuleSpec("row3", labels=("row3",)),
    }
    entry_sets = {
        "k3": (3,),
        "k4": (4,),
        "k3-4": (3, 4),
        "k2-4": (2, 3, 4),
    }
    results: list[tuple[float, RuleSpec, dict[str, float | int]]] = []
    for label_name, base in label_sets.items():
        for entry_name, entries in entry_sets.items():
            for zone in (None, 0.20, 0.25, 0.30):
                for conc in (None, 0.35, 0.40, 0.45):
                    if zone is None and conc is not None:
                        continue
                    if conc is None and zone is not None:
                        continue
                    for band_name, allowed, excluded in (
                        ("all", (), ()),
                        ("exclude_fast", (), ("fast",)),
                        ("medium_slow", ("medium", "slow"), ()),
                    ):
                        spec = RuleSpec(
                            name=(
                                f"{label_name}/{entry_name}/"
                                f"z{zone if zone is not None else 'none'}/"
                                f"c{conc if conc is not None else 'none'}/"
                                f"{band_name}"
                            ),
                            labels=base.labels,
                            kinds=base.kinds,
                            entries=entries,
                            min_gap_count=18 if zone is not None else 0,
                            min_zone=zone,
                            min_conc=conc,
                            allowed_bands=allowed,
                            excluded_bands=excluded,
                        )
                        subset = select(events, spec)
                        summary = summarize(subset, sessions)
                        signals = int(summary["signals"])
                        if signals < 500:
                            continue
                        visible = (
                            float(summary["roi"]),
                            float(summary["from201_roi"]),
                            float(summary["recent10_roi"]),
                            float(summary["recent3_roi"]),
                        )
                        if min(visible) < 0:
                            continue
                        floor = min(visible)
                        results.append((floor, spec, summary))

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
    for floor, spec, summary in results:
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
        print(f"{shown:2d}. floor={floor:+6.2f}% {fmt_summary(summary)}  {spec.name}")
        if shown >= 35:
            break


def print_tempo_breakdown(events: list[CompletedOpportunity], sessions, spec: RuleSpec) -> None:
    print(f"\n=== Tempo bands: {spec.name} ===")
    subset = select(events, spec)
    by_band: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in subset:
        by_band[str(event.features.get("tempo_band", "unknown"))].append(event)
    for band in ("fast", "medium_fast", "medium", "slow", "unknown"):
        items = by_band.get(band, [])
        if items:
            print(f"{band:<12s} {fmt_summary(summarize(items, sessions))}")


def print_years(events: list[CompletedOpportunity], sessions, spec: RuleSpec) -> None:
    print(f"\n=== Year stability: {spec.name} ===")
    subset = select(events, spec)
    by_year: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in subset:
        by_year[year_key(event)].append(event)
    for year in sorted(by_year):
        print(f"{year:<8s} {fmt_summary(summarize(by_year[year], sessions))}")


def print_recent_sessions(events: list[CompletedOpportunity], sessions, spec: RuleSpec) -> None:
    print(f"\n=== Recent 12 sessions: {spec.name} ===")
    subset = select(events, spec)
    by_session: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in subset:
        by_session[event.session_name].append(event)
    for session in sessions[-12:]:
        items = by_session.get(session.name, [])
        print(f"{session.name:<34s} {fmt_summary(summarize(items, [session]))}")


def print_session_concentration(events: list[CompletedOpportunity], sessions, spec: RuleSpec) -> None:
    print(f"\n=== Session concentration: {spec.name} ===")
    subset = select(events, spec)
    by_session: dict[str, list[CompletedOpportunity]] = defaultdict(list)
    for event in subset:
        by_session[event.session_name].append(event)

    rows = []
    for session in sessions:
        items = by_session.get(session.name, [])
        if not items:
            continue
        rows.append((session.name, len(items), sum(event.net for event in items), roi(items)))

    nets = [row[2] for row in rows]
    wins = sum(1 for value in nets if value > 0)
    losses = sum(1 for value in nets if value < 0)
    flats = sum(1 for value in nets if value == 0)
    positive_total = sum(value for value in nets if value > 0)
    top_winners = sorted(rows, key=lambda row: row[2], reverse=True)[:5]
    top_losers = sorted(rows, key=lambda row: row[2])[:5]
    top3_positive = sum(max(0, row[2]) for row in top_winners[:3])
    share = top3_positive / positive_total * 100 if positive_total else 0.0
    print(
        f"sessions_with_signals={len(rows)} W/L/F={wins}/{losses}/{flats} "
        f"median_session_net={median(nets) if nets else 0:+.1f} "
        f"top3_positive_share={share:.1f}%"
    )
    print("top winners:")
    for name, count, net, item_roi in top_winners:
        print(f"  {name:<34s} sig={count:3d} net={net:+4d} ROI={item_roi:+7.2f}%")
    print("top losers:")
    for name, count, net, item_roi in top_losers:
        print(f"  {name:<34s} sig={count:3d} net={net:+4d} ROI={item_roi:+7.2f}%")


def print_hit_mix(events: list[CompletedOpportunity], sessions, spec: RuleSpec) -> None:
    print(f"\n=== Hit-round mix: {spec.name} ===")
    subset = select(events, spec)
    counts: dict[int, int] = defaultdict(int)
    net_by_round: dict[int, int] = defaultdict(int)
    bet_by_round: dict[int, int] = defaultdict(int)
    for event in subset:
        counts[event.hit_round] += 1
        net_by_round[event.hit_round] += event.net
        bet_by_round[event.hit_round] += event.bet

    total = len(subset)
    for round_key, label in ((1, "hit1"), (2, "hit2"), (3, "hit3"), (-1, "miss")):
        count = counts.get(round_key, 0)
        rate = count / total * 100 if total else 0.0
        bet = bet_by_round.get(round_key, 0)
        net = net_by_round.get(round_key, 0)
        item_roi = net / bet * 100 if bet else 0.0
        print(f"{label:<6s} count={count:4d} rate={rate:5.1f}% net={net:+5d} ROI={item_roi:+7.2f}%")


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    sessions = load_sessions(root / "history_data.json")
    events = generate_opportunities(sessions)
    print(
        f"Loaded {len(sessions)} sessions, "
        f"{sum(len(session.numbers) for session in sessions)} spins, "
        f"events={len(events)}"
    )

    print_core(events, sessions)
    print_threshold_scan(events, sessions)

    primary = RuleSpec("row3/k4/gap18", labels=("row3",), entries=(4,), min_gap_count=18)
    broad = RuleSpec("all/k3-4/z0.25/c0.45", entries=(3, 4), min_gap_count=18, min_zone=0.25, min_conc=0.45)
    broad_no_fast = RuleSpec(
        "all/k3-4/z0.25/c0.45/exclude-fast",
        entries=(3, 4),
        min_gap_count=18,
        min_zone=0.25,
        min_conc=0.45,
        excluded_bands=("fast",),
    )
    high_quality = RuleSpec(
        "g2+g3/k3-4/z0.25/c0.45/exclude-fast",
        labels=("group2", "group3"),
        entries=(3, 4),
        min_gap_count=18,
        min_zone=0.25,
        min_conc=0.45,
        excluded_bands=("fast",),
    )
    high_1000 = RuleSpec(
        "g2+g3/k3/z0.20/c0.45/exclude-fast",
        labels=("group2", "group3"),
        entries=(3,),
        min_gap_count=18,
        min_zone=0.20,
        min_conc=0.45,
        excluded_bands=("fast",),
    )

    for spec in (primary, high_quality, high_1000, broad, broad_no_fast):
        print_tempo_breakdown(events, sessions, spec)
        print_years(events, sessions, spec)
        print_recent_sessions(events, sessions, spec)
        print_session_concentration(events, sessions, spec)
        print_hit_mix(events, sessions, spec)


if __name__ == "__main__":
    main()
