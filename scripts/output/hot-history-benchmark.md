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
| enhance | 233 | 12 | 233 | 432 | 199 | +85.4% | 2.42 |
| baseline | 1191 | 34 | 1191 | 1224 | 33 | +2.8% | 12.35 |
| observe | 125 | 0 | 125 | 0 | -125 | -100.0% | 1.30 |
| hint | 0 | 0 | 0 | 0 | 0 | +0.0% | 0.00 |
| block | 1236 | 44 | 1236 | 1584 | 348 | +28.2% | 12.82 |

## Plan Benchmark
| plan | signals | hits | bet | win | net | ROI | SP100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| raw-all | 2785 | 90 | 2785 | 3240 | 455 | +16.3% | 28.88 |
| default-visible | 1549 | 46 | 1549 | 1656 | 107 | +6.9% | 16.06 |

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
    { action: "enhance", signals: 233, bet: 233, win: 432, hits: 12, net: 199, roi: 85.407725, sp100: 2.416010 },
    { action: "baseline", signals: 1191, bet: 1191, win: 1224, hits: 34, net: 33, roi: 2.770781, sp100: 12.349647 },
    { action: "observe", signals: 125, bet: 125, win: 0, hits: 0, net: -125, roi: -100.000000, sp100: 1.296143 },
    { action: "hint", signals: 0, bet: 0, win: 0, hits: 0, net: 0, roi: 0.000000, sp100: 0.000000 },
    { action: "block", signals: 1236, bet: 1236, win: 1584, hits: 44, net: 348, roi: 28.155340, sp100: 12.816259 },
  ],
} as const;
```
