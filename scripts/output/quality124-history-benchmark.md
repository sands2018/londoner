# 124EXT History Benchmark

- source: `HistoryData\history_data.json`
- sessions: 76
- spins: 24812
- bettingSpins: 9644
- ROI/SP100 scope: index >= 200
- no-future: each session is scanned in chronological spin order; each signal is created before its future settlement spins are known.

## Total Benchmark
| signals | bet | win | hits | net | ROI | SP100 |
|---:|---:|---:|---:|---:|---:|---:|
| 523 | 1006 | 1374 | 248 | 368 | +36.6% | 5.42 |

## Tier Benchmark
| tier | signals | bet | win | hits | net | ROI | SP100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 一组 | 146 | 146 | 198 | 66 | 52 | +35.6% | 1.51 |
| 二组 | 29 | 101 | 159 | 26 | 58 | +57.4% | 0.30 |
| 二组短追 | 142 | 284 | 330 | 55 | 46 | +16.2% | 1.47 |
| 三组 | 9 | 56 | 54 | 7 | -2 | -3.6% | 0.09 |
| 1行 | 123 | 123 | 165 | 55 | 42 | +34.1% | 1.28 |
| 2行 | 74 | 296 | 468 | 39 | 172 | +58.1% | 0.77 |
| 3行 | 0 | 0 | 0 | 0 | 0 | +0.0% | 0.00 |

## TypeScript Literal
```ts
export const QUALITY_124_HISTORY_BENCHMARK = {
  source: "HistoryData/history_data.json",
  roiStartIndex: 200,
  sessions: 76,
  spins: 24812,
  bettingSpins: 9644,
  total: { signals: 523, bet: 1006, win: 1374, hits: 248, net: 368, roi: 36.580517, sp100: 5.423061 },
  rows: [
    { tier: "group1", signals: 146, bet: 146, win: 198, hits: 66, net: 52, roi: 35.616438, sp100: 1.513895 },
    { tier: "group2", signals: 29, bet: 101, win: 159, hits: 26, net: 58, roi: 57.425743, sp100: 0.300705 },
    { tier: "group2tempo", signals: 142, bet: 284, win: 330, hits: 55, net: 46, roi: 16.197183, sp100: 1.472418 },
    { tier: "group3", signals: 9, bet: 56, win: 54, hits: 7, net: -2, roi: -3.571429, sp100: 0.093322 },
    { tier: "row1", signals: 123, bet: 123, win: 165, hits: 55, net: 42, roi: 34.146341, sp100: 1.275404 },
    { tier: "row2", signals: 74, bet: 296, win: 468, hits: 39, net: 172, roi: 58.108108, sp100: 0.767316 },
    { tier: "row3", signals: 0, bet: 0, win: 0, hits: 0, net: 0, roi: 0.000000, sp100: 0.000000 },
  ],
} as const;
```
