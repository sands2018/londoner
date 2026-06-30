# Hot History Benchmark

- source: `HistoryData\history_data.json`
- sessions: 76
- spins: 24812
- bettingSpins: 9644
- ROI/SP100 scope: index >= 200
- no-future: session N uses sessions 1..N-1; each signal uses prefix before the signal; auto table assignment is prefix-only.

## Action Benchmark
| action | signals | hits | bet | win | net | ROI | SP100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| enhance | 262 | 12 | 262 | 432 | 170 | +64.9% | 2.72 |
| baseline | 1188 | 34 | 1188 | 1224 | 36 | +3.0% | 12.32 |
| observe | 125 | 0 | 125 | 0 | -125 | -100.0% | 1.30 |
| hint | 0 | 0 | 0 | 0 | 0 | +0.0% | 0.00 |
| block | 1210 | 44 | 1210 | 1584 | 374 | +30.9% | 12.55 |

## Plan Benchmark
| plan | signals | hits | bet | win | net | ROI | SP100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| raw-all | 2785 | 90 | 2785 | 3240 | 455 | +16.3% | 28.88 |
| default-visible | 1575 | 46 | 1575 | 1656 | 81 | +5.1% | 16.33 |

## TypeScript Literal
```ts
export const HOT_HISTORY_BENCHMARK = {
  source: "HistoryData/history_data.json",
  roiStartIndex: 200,
  sessions: 76,
  spins: 24812,
  bettingSpins: 9644,
  tableMode: "auto-prefix",
  rows: [
    { action: "enhance", signals: 262, bet: 262, win: 432, hits: 12, net: 170, roi: 64.885496, sp100: 2.716715 },
    { action: "baseline", signals: 1188, bet: 1188, win: 1224, hits: 34, net: 36, roi: 3.030303, sp100: 12.318540 },
    { action: "observe", signals: 125, bet: 125, win: 0, hits: 0, net: -125, roi: -100.000000, sp100: 1.296143 },
    { action: "hint", signals: 0, bet: 0, win: 0, hits: 0, net: 0, roi: 0.000000, sp100: 0.000000 },
    { action: "block", signals: 1210, bet: 1210, win: 1584, hits: 44, net: 374, roi: 30.909091, sp100: 12.546661 },
  ],
} as const;
```
