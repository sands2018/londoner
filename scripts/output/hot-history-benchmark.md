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
| enhance | 410 | 16 | 410 | 576 | 166 | +40.5% | 4.25 |
| baseline | 613 | 7 | 613 | 252 | -361 | -58.9% | 6.36 |
| observe | 367 | 12 | 367 | 432 | 65 | +17.7% | 3.81 |
| hint | 0 | 0 | 0 | 0 | 0 | +0.0% | 0.00 |
| block | 920 | 37 | 920 | 1332 | 412 | +44.8% | 9.54 |

## Plan Benchmark
| plan | signals | hits | bet | win | net | ROI | SP100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| raw-all | 2310 | 72 | 2310 | 2592 | 282 | +12.2% | 23.95 |
| default-visible | 1390 | 35 | 1390 | 1260 | -130 | -9.4% | 14.41 |

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
    { action: "enhance", signals: 410, bet: 410, win: 576, hits: 16, net: 166, roi: 40.487805, sp100: 4.251348 },
    { action: "baseline", signals: 613, bet: 613, win: 252, hits: 7, net: -361, roi: -58.890701, sp100: 6.356284 },
    { action: "observe", signals: 367, bet: 367, win: 432, hits: 12, net: 65, roi: 17.711172, sp100: 3.805475 },
    { action: "hint", signals: 0, bet: 0, win: 0, hits: 0, net: 0, roi: 0.000000, sp100: 0.000000 },
    { action: "block", signals: 920, bet: 920, win: 1332, hits: 37, net: 412, roi: 44.782609, sp100: 9.539610 },
  ],
} as const;
```
