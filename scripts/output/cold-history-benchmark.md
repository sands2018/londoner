# Cold History Benchmark

- source: `HistoryData\history_data.json`
- sessions: 76
- spins: 24812
- bettingSpins: 9644
- ROI/SP100 scope: index >= 200
- no-future: adaptive modes choose row/group from same-year sessions before the current session only; in-session signals are generated before future settlement spins.

## Mode Benchmark
| mode | signals | bet | win | hits | failures | net | ROI | SP100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 自适应+默认行 | 291 | 2049 | 1806 | 220 | 71 | -243 | -11.9% | 3.02 |
| 自适应 | 294 | 2060 | 1827 | 223 | 71 | -233 | -11.3% | 3.05 |
| 不切换 | 568 | 3696 | 3468 | 446 | 122 | -228 | -6.2% | 5.89 |
| 仅行 | 275 | 1745 | 1686 | 219 | 56 | -59 | -3.4% | 2.85 |
| 仅组 | 293 | 1951 | 1782 | 227 | 66 | -169 | -8.7% | 3.04 |

## Row/Group Benchmark
| row | signals | bet | win | hits | failures | net | ROI | SP100 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 一组 | 101 | 669 | 651 | 80 | 21 | -18 | -2.7% | 1.05 |
| 二组 | 90 | 582 | 552 | 71 | 19 | -30 | -5.2% | 0.93 |
| 三组 | 102 | 700 | 579 | 76 | 26 | -121 | -17.3% | 1.06 |
| 1行 | 99 | 697 | 642 | 76 | 23 | -55 | -7.9% | 1.03 |
| 2行 | 79 | 501 | 462 | 62 | 17 | -39 | -7.8% | 0.82 |
| 3行 | 97 | 547 | 582 | 81 | 16 | 35 | +6.4% | 1.01 |

## TypeScript Literal
```ts
export const COLD_HISTORY_BENCHMARK = {
  source: "HistoryData/history_data.json",
  roiStartIndex: 200,
  sessions: 76,
  spins: 24812,
  bettingSpins: 9644,
  modes: [
    { id: "adaptiveRow", label: "自适应+默认行", signals: 291, bet: 2049, win: 1806, hits: 220, failures: 71, net: -243, roi: -11.859444, sp100: 3.017420 },
    { id: "adaptive", label: "自适应", signals: 294, bet: 2060, win: 1827, hits: 223, failures: 71, net: -233, roi: -11.310680, sp100: 3.048528 },
    { id: "all", label: "不切换", signals: 568, bet: 3696, win: 3468, hits: 446, failures: 122, net: -228, roi: -6.168831, sp100: 5.889672 },
    { id: "rows", label: "仅行", signals: 275, bet: 1745, win: 1686, hits: 219, failures: 56, net: -59, roi: -3.381089, sp100: 2.851514 },
    { id: "groups", label: "仅组", signals: 293, bet: 1951, win: 1782, hits: 227, failures: 66, net: -169, roi: -8.662225, sp100: 3.038158 },
  ],
  rows: [
    { ci: 0, label: "一组", signals: 101, bet: 669, win: 651, hits: 80, failures: 21, net: -18, roi: -2.690583, sp100: 1.047283 },
    { ci: 1, label: "二组", signals: 90, bet: 582, win: 552, hits: 71, failures: 19, net: -30, roi: -5.154639, sp100: 0.933223 },
    { ci: 2, label: "三组", signals: 102, bet: 700, win: 579, hits: 76, failures: 26, net: -121, roi: -17.285714, sp100: 1.057652 },
    { ci: 3, label: "1行", signals: 99, bet: 697, win: 642, hits: 76, failures: 23, net: -55, roi: -7.890961, sp100: 1.026545 },
    { ci: 4, label: "2行", signals: 79, bet: 501, win: 462, hits: 62, failures: 17, net: -39, roi: -7.784431, sp100: 0.819162 },
    { ci: 5, label: "3行", signals: 97, bet: 547, win: 582, hits: 81, failures: 16, net: 35, roi: 6.398537, sp100: 1.005807 },
  ],
} as const;
```
