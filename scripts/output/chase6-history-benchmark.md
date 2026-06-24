# Chase6 History Benchmark

- source: `HistoryData\history_data.json`
- sessions: 76
- spins: 24812
- bettingSpins: 9644
- historyWindow: 200
- ROI/SP100 scope: index >= 200
- no-future: each spin only uses its preceding history window to trigger a signal; future spins are settlement only.

## Benchmark
| tier | signals | bet | win | hits | net | ROI | SP100 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 全部 | 108 | 372 | 414 | 48 | 42 | +11.3% | 1.12 |
| 一组窗 | 44 | 155 | 156 | 19 | 1 | +0.6% | 0.46 |
| 二组窗 | 57 | 195 | 216 | 26 | 21 | +10.8% | 0.59 |
| 三组窗 | 33 | 113 | 120 | 13 | 7 | +6.2% | 0.34 |
| 强信号 | 108 | 372 | 414 | 48 | 42 | +11.3% | 1.12 |
| 波浪强 | 99 | 337 | 402 | 46 | 65 | +19.3% | 1.03 |
| 波浪排除 | 9 | 35 | 12 | 2 | -23 | -65.7% | 0.09 |

## TypeScript Literal
```ts
export const CHASE6_HISTORY_BENCHMARK = {
  source: "HistoryData/history_data.json",
  roiStartIndex: 200,
  historyWindow: 200,
  sessions: 76,
  spins: 24812,
  bettingSpins: 9644,
  rows: [
    { id: "total", label: "全部", signals: 108, bet: 372, win: 414, hits: 48, net: 42, roi: 11.290323, sp100: 1.119867 },
    { id: "group1", label: "一组窗", signals: 44, bet: 155, win: 156, hits: 19, net: 1, roi: 0.645161, sp100: 0.456242 },
    { id: "group2", label: "二组窗", signals: 57, bet: 195, win: 216, hits: 26, net: 21, roi: 10.769231, sp100: 0.591041 },
    { id: "group3", label: "三组窗", signals: 33, bet: 113, win: 120, hits: 13, net: 7, roi: 6.194690, sp100: 0.342182 },
    { id: "strong", label: "强信号", signals: 108, bet: 372, win: 414, hits: 48, net: 42, roi: 11.290323, sp100: 1.119867 },
    { id: "waveStrong", label: "波浪强", signals: 99, bet: 337, win: 402, hits: 46, net: 65, roi: 19.287834, sp100: 1.026545 },
    { id: "waveFiltered", label: "波浪排除", signals: 9, bet: 35, win: 12, hits: 2, net: -23, roi: -65.714286, sp100: 0.093322 },
  ],
} as const;
```
