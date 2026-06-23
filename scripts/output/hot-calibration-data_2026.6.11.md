# Hot Calibration Walk-Forward Report: data_2026.6.11.json

- file: `HistoryData\data_2026.6.11.json`
- sessions: 133
- spins: 33597
- manual table-tagged sessions: 0
- ROI scope: betting-zone only, index >= 200
- no-future rule: session N uses only sessions 1..N-1 for calibration/profile state; each current hot signal uses only numbers before that signal for current table matching.
- table modes:
  - legacy-match: current signal uses prefix-only profile matching, without forcing an auto table assignment.
  - auto-prefix: current signal first runs new automatic table assignment on the prefix only, then uses that assigned table if available.

## Auto-Prefix vs Legacy-Match Delta
| action | legacy-match | auto-prefix | delta net | delta roi pp | delta signals |
|---|---:|---:|---:|---:|---:|
| enhance | `sig=  178 hit=   5 net=      2 roi=    1.1% wr=  2.8% dd=  134 pos= 3/10 mean=   0.2 sd=  38.7 gini=0.442 top10=100.0%` | `sig=  342 hit=  10 net=     18 roi=    5.3% wr=  2.9% dd=  102 pos= 5/13 mean=   1.4 sd=  39.7 gini=0.494 top10=95.6%` | 16 | 4.1 | 164 |
| baseline | `sig= 1418 hit=  39 net=    -14 roi=   -1.0% wr=  2.8% dd=  367 pos=14/37 mean=  -0.4 sd=  39.4 gini=0.504 top10=69.1%` | `sig= 1012 hit=  24 net=   -148 roi=  -14.6% wr=  2.4% dd=  299 pos=11/33 mean=  -4.5 sd=  32.3 gini=0.566 top10=79.3%` | -134 | -13.6 | -406 |
| observe | `sig=  123 hit=   4 net=     21 roi=   17.1% wr=  3.3% dd=   66 pos= 2/11 mean=   1.9 sd=  15.1 gini=0.552 top10=99.2%` | `sig=  325 hit=  16 net=    251 roi=   77.2% wr=  4.9% dd=   98 pos= 5/16 mean=  15.7 sd=  54.5 gini=0.685 top10=96.0%` | 230 | 60.2 | 202 |
| hint | `sig=  118 hit=   2 net=    -46 roi=  -39.0% wr=  1.7% dd=   48 pos= 2/8  mean=  -5.8 sd=  11.9 gini=0.408 top10=100.0%` | `sig=  135 hit=   4 net=      9 roi=    6.7% wr=  3.0% dd=  120 pos= 2/11 mean=   0.8 sd=  25.5 gini=0.559 top10=99.3%` | 55 | 45.6 | 17 |
| block | `sig=  926 hit=  35 net=    334 roi=   36.1% wr=  3.8% dd=  135 pos=15/35 mean=   9.5 sd=  34.2 gini=0.539 top10=71.1%` | `sig=  949 hit=  31 net=    167 roi=   17.6% wr=  3.3% dd=  135 pos=13/39 mean=   4.3 sd=  28.7 gini=0.564 top10=66.9%` | -167 | -18.5 | 23 |

### Changed Event Summary
| changed set | summary |
|---|---:|
| all changed events | `sig= 1020 hit=  40 net=    420 roi=   41.2% wr=  3.9% dd=  118 pos=15/35 mean=  12.0 sd=  41.0 gini=0.575 top10=69.4%` |
| changed into enhance | `sig=  203 hit=   7 net=     49 roi=   24.1% wr=  3.4% dd=   58 pos= 3/10 mean=   4.9 sd=  28.4 gini=0.486 top10=100.0%` |
| changed into baseline | `sig=  150 hit=   3 net=    -42 roi=  -28.0% wr=  2.0% dd=   63 pos= 3/9  mean=  -4.7 sd=  20.9 gini=0.608 top10=100.0%` |
| changed into observe | `sig=  217 hit=  12 net=    215 roi=   99.1% wr=  5.5% dd=   98 pos= 2/5  mean=  43.0 sd=  88.9 gini=0.577 top10=100.0%` |
| changed into hint | `sig=   95 hit=   3 net=     13 roi=   13.7% wr=  3.2% dd=   85 pos= 2/10 mean=   1.3 sd=  27.4 gini=0.584 top10=100.0%` |
| changed into block | `sig=  355 hit=  15 net=    185 roi=   52.1% wr=  4.2% dd=   60 pos= 7/23 mean=   8.0 sd=  29.1 gini=0.655 top10=87.6%` |

## Latest 10 Sessions Focus

These rows are still walk-forward: each latest session uses only earlier sessions, and each signal uses only prefix numbers before that signal.

| order | date | session | spins | legacy signals/net | auto signals/net |
|---:|---|---|---:|---:|---:|
| 1 | 2026-06-01 | 20260601-1630-澳门永利 | 308 | 83/25/30.1% | 83/25/30.1% |
| 2 | 2026-06-01 | 20260602-0018-澳门永利 | 367 | 0/0/0.0% | 0/0/0.0% |
| 3 | 2026-06-02 | 20260603-0030-澳门永利 | 809 | 172/188/109.3% | 172/188/109.3% |
| 4 | 2026-06-02 | 20260603-0230-澳门永利 | 277 | 27/-27/-100.0% | 27/-27/-100.0% |
| 5 | 2026-06-03 | 20260603-2101-澳门永利 | 599 | 69/75/108.7% | 69/75/108.7% |
| 6 | 2026-06-04 | 20260604-1630-澳门永利 | 518 | 21/51/242.9% | 21/51/242.9% |
| 7 | 2026-06-05 | 20260605-0230-澳门永利 | 311 | 91/-91/-100.0% | 91/-91/-100.0% |
| 8 | 2026-06-05 | 20260604-2223-澳门永利 | 253 | 0/0/0.0% | 0/0/0.0% |
| 9 | 2026-06-10 | 20260606-0131-澳门永利 | 756 | 151/29/19.2% | 151/29/19.2% |
| 10 | 2026-06-10 | 20260607-0217-澳门永利 | 761 | 76/104/136.8% | 76/104/136.8% |

### Latest 10 Action Delta
| action | legacy-match | auto-prefix | delta net | delta roi pp | delta signals |
|---|---:|---:|---:|---:|---:|
| enhance | `sig=   85 hit=   4 net=     59 roi=   69.4% wr=  4.7% dd=   77 pos= 2/5  mean=  11.8 sd=  48.8 gini=0.357 top10=100.0%` | `sig=  228 hit=   9 net=     96 roi=   42.1% wr=  3.9% dd=  102 pos= 4/6  mean=  16.0 sd=  53.9 gini=0.336 top10=100.0%` | 37 | -27.3 | 143 |
| baseline | `sig=  317 hit=  12 net=    115 roi=   36.3% wr=  3.8% dd=   77 pos= 3/5  mean=  23.0 sd=  30.2 gini=0.392 top10=100.0%` | `sig=  176 hit=   4 net=    -32 roi=  -18.2% wr=  2.3% dd=   75 pos= 2/5  mean=  -6.4 sd=  23.1 gini=0.500 top10=100.0%` | -147 | -54.5 | -141 |
| observe | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` | `sig=  217 hit=  12 net=    215 roi=   99.1% wr=  5.5% dd=   98 pos= 2/4  mean=  53.8 sd=  96.6 gini=0.482 top10=100.0%` | 230 | 199.1 | 202 |
| hint | `sig=   62 hit=   1 net=    -26 roi=  -41.9% wr=  1.6% dd=   33 pos= 1/2  mean= -13.0 sd=  20.0 gini=0.325 top10=100.0%` | `sig=    3 hit=   2 net=     69 roi= 2300.0% wr= 66.7% dd=    1 pos= 1/2  mean=  34.5 sd=  35.5 gini=0.486 top10=100.0%` | 95 | 2341.9 | -59 |
| block | `sig=  211 hit=  12 net=    221 roi=  104.7% wr=  5.7% dd=   34 pos= 5/7  mean=  31.6 sd=  41.0 gini=0.514 top10=100.0%` | `sig=   66 hit=   2 net=      6 roi=    9.1% wr=  3.0% dd=   33 pos= 2/6  mean=   1.0 sd=  11.7 gini=0.374 top10=100.0%` | -215 | -95.6 | -145 |

### Latest 10 Legacy Action ROI
| bucket | summary |
|---|---:|
| enhance | `sig=   85 hit=   4 net=     59 roi=   69.4% wr=  4.7% dd=   77 pos= 2/5  mean=  11.8 sd=  48.8 gini=0.357 top10=100.0%` |
| baseline | `sig=  317 hit=  12 net=    115 roi=   36.3% wr=  3.8% dd=   77 pos= 3/5  mean=  23.0 sd=  30.2 gini=0.392 top10=100.0%` |
| observe | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| hint | `sig=   62 hit=   1 net=    -26 roi=  -41.9% wr=  1.6% dd=   33 pos= 1/2  mean= -13.0 sd=  20.0 gini=0.325 top10=100.0%` |
| block | `sig=  211 hit=  12 net=    221 roi=  104.7% wr=  5.7% dd=   34 pos= 5/7  mean=  31.6 sd=  41.0 gini=0.514 top10=100.0%` |

### Latest 10 Auto-Prefix Action ROI
| bucket | summary |
|---|---:|
| enhance | `sig=  228 hit=   9 net=     96 roi=   42.1% wr=  3.9% dd=  102 pos= 4/6  mean=  16.0 sd=  53.9 gini=0.336 top10=100.0%` |
| baseline | `sig=  176 hit=   4 net=    -32 roi=  -18.2% wr=  2.3% dd=   75 pos= 2/5  mean=  -6.4 sd=  23.1 gini=0.500 top10=100.0%` |
| observe | `sig=  217 hit=  12 net=    215 roi=   99.1% wr=  5.5% dd=   98 pos= 2/4  mean=  53.8 sd=  96.6 gini=0.482 top10=100.0%` |
| hint | `sig=    3 hit=   2 net=     69 roi= 2300.0% wr= 66.7% dd=    1 pos= 1/2  mean=  34.5 sd=  35.5 gini=0.486 top10=100.0%` |
| block | `sig=   66 hit=   2 net=      6 roi=    9.1% wr=  3.0% dd=   33 pos= 2/6  mean=   1.0 sd=  11.7 gini=0.374 top10=100.0%` |

### Latest 10 Plan ROI
| bucket | summary |
|---|---:|
| legacy raw-all | `sig=  690 hit=  29 net=    354 roi=   51.3% wr=  4.2% dd=   99 pos= 6/8  mean=  44.3 sd=  78.4 gini=0.368 top10=100.0%` |
| legacy default-visible | `sig=  417 hit=  16 net=    159 roi=   38.1% wr=  3.8% dd=   86 pos= 4/7  mean=  22.7 sd=  56.1 gini=0.293 top10=100.0%` |
| legacy hidden | `sig=  273 hit=  13 net=    195 roi=   71.4% wr=  4.8% dd=   54 pos= 5/7  mean=  27.9 sd=  48.2 gini=0.431 top10=100.0%` |
| auto raw-all | `sig=  690 hit=  29 net=    354 roi=   51.3% wr=  4.2% dd=   99 pos= 6/8  mean=  44.3 sd=  78.4 gini=0.368 top10=100.0%` |
| auto default-visible | `sig=  621 hit=  25 net=    279 roi=   44.9% wr=  4.0% dd=  159 pos= 5/8  mean=  34.9 sd=  75.9 gini=0.309 top10=100.0%` |
| auto hidden | `sig=   69 hit=   4 net=     75 roi=  108.7% wr=  5.8% dd=   24 pos= 3/6  mean=  12.5 sd=  26.1 gini=0.511 top10=100.0%` |

### Latest 10 Changed Event Summary
| changed set | summary |
|---|---:|
| all changed events | `sig=  474 hit=  23 net=    354 roi=   74.7% wr=  4.9% dd=   83 pos= 6/7  mean=  50.6 sd=  53.0 gini=0.378 top10=100.0%` |
| changed into enhance | `sig=  151 hit=   7 net=    101 roi=   66.9% wr=  4.6% dd=   54 pos= 3/4  mean=  25.3 sd=  36.0 gini=0.334 top10=100.0%` |
| changed into baseline | `sig=   86 hit=   1 net=    -50 roi=  -58.1% wr=  1.2% dd=   55 pos= 1/2  mean= -25.0 sd=  27.0 gini=0.463 top10=100.0%` |
| changed into observe | `sig=  202 hit=  12 net=    230 roi=  113.9% wr=  5.9% dd=   98 pos= 2/3  mean=  76.7 sd= 101.7 gini=0.391 top10=100.0%` |
| changed into hint | `sig=    3 hit=   2 net=     69 roi= 2300.0% wr= 66.7% dd=    1 pos= 1/2  mean=  34.5 sd=  35.5 gini=0.486 top10=100.0%` |
| changed into block | `sig=   32 hit=   1 net=      4 roi=   12.5% wr=  3.1% dd=   24 pos= 1/4  mean=   1.0 sd=  12.9 gini=0.450 top10=100.0%` |

### Latest 10 Legacy by Session/Action
| key | summary |
|---|---:|
| 20260606-0131-澳门永利/baseline | `sig=  109 hit=   3 net=     -1 roi=   -0.9% wr=  2.8% dd=   68 pos= 0/1  mean=  -1.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/baseline | `sig=   83 hit=   4 net=     61 roi=   73.5% wr=  4.8% dd=   29 pos= 1/1  mean=  61.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/block | `sig=   83 hit=   3 net=     25 roi=   30.1% wr=  3.6% dd=   34 pos= 1/1  mean=  25.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/block | `sig=   60 hit=   5 net=    120 roi=  200.0% wr=  8.3% dd=   27 pos= 1/1  mean= 120.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/enhance | `sig=   60 hit=   0 net=    -60 roi= -100.0% wr=  0.0% dd=   60 pos= 0/1  mean= -60.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/baseline | `sig=   57 hit=   3 net=     51 roi=   89.5% wr=  5.3% dd=   32 pos= 1/1  mean=  51.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/baseline | `sig=   49 hit=   2 net=     23 roi=   46.9% wr=  4.1% dd=   39 pos= 1/1  mean=  23.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/hint | `sig=   33 hit=   0 net=    -33 roi= -100.0% wr=  0.0% dd=   33 pos= 0/1  mean= -33.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/hint | `sig=   29 hit=   1 net=      7 roi=   24.1% wr=  3.4% dd=   28 pos= 1/1  mean=   7.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/block | `sig=   23 hit=   1 net=     13 roi=   56.5% wr=  4.3% dd=   17 pos= 1/1  mean=  13.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260604-1630-澳门永利/block | `sig=   19 hit=   2 net=     53 roi=  278.9% wr= 10.5% dd=   11 pos= 1/1  mean=  53.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/baseline | `sig=   19 hit=   0 net=    -19 roi= -100.0% wr=  0.0% dd=   19 pos= 0/1  mean= -19.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/observe | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/block | `sig=   12 hit=   1 net=     24 roi=  200.0% wr=  8.3% dd=    9 pos= 1/1  mean=  24.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/enhance | `sig=   12 hit=   0 net=    -12 roi= -100.0% wr=  0.0% dd=   12 pos= 0/1  mean= -12.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/block | `sig=   12 hit=   0 net=    -12 roi= -100.0% wr=  0.0% dd=   12 pos= 0/1  mean= -12.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/enhance | `sig=    7 hit=   2 net=     65 roi=  928.6% wr= 28.6% dd=    3 pos= 1/1  mean=  65.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/enhance | `sig=    4 hit=   2 net=     68 roi= 1700.0% wr= 50.0% dd=    2 pos= 1/1  mean=  68.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260604-1630-澳门永利/enhance | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/block | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Latest 10 Auto by Session/Action
| key | summary |
|---|---:|
| 20260606-0131-澳门永利/observe | `sig=  107 hit=   2 net=    -35 roi=  -32.7% wr=  1.9% dd=   98 pos= 0/1  mean= -35.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/enhance | `sig=   84 hit=   0 net=    -84 roi= -100.0% wr=  0.0% dd=   84 pos= 0/1  mean= -84.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/baseline | `sig=   81 hit=   1 net=    -45 roi=  -55.6% wr=  1.2% dd=   72 pos= 0/1  mean= -45.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/observe | `sig=   77 hit=   8 net=    211 roi=  274.0% wr= 10.4% dd=   26 pos= 1/1  mean= 211.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/enhance | `sig=   69 hit=   4 net=     75 roi=  108.7% wr=  5.8% dd=   32 pos= 1/1  mean=  75.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/baseline | `sig=   46 hit=   2 net=     26 roi=   56.5% wr=  4.3% dd=   36 pos= 1/1  mean=  26.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/enhance | `sig=   35 hit=   2 net=     37 roi=  105.7% wr=  5.7% dd=   22 pos= 1/1  mean=  37.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/baseline | `sig=   34 hit=   1 net=      2 roi=    5.9% wr=  2.9% dd=   30 pos= 1/1  mean=   2.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/block | `sig=   26 hit=   1 net=     10 roi=   38.5% wr=  3.8% dd=   17 pos= 1/1  mean=  10.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/enhance | `sig=   24 hit=   1 net=     12 roi=   50.0% wr=  4.2% dd=   16 pos= 1/1  mean=  12.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260604-1630-澳门永利/observe | `sig=   18 hit=   2 net=     54 roi=  300.0% wr= 11.1% dd=   13 pos= 1/1  mean=  54.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/observe | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/block | `sig=   14 hit=   1 net=     22 roi=  157.1% wr=  7.1% dd=   13 pos= 1/1  mean=  22.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/block | `sig=   14 hit=   0 net=    -14 roi= -100.0% wr=  0.0% dd=   14 pos= 0/1  mean= -14.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/baseline | `sig=   13 hit=   0 net=    -13 roi= -100.0% wr=  0.0% dd=   13 pos= 0/1  mean= -13.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/enhance | `sig=   12 hit=   0 net=    -12 roi= -100.0% wr=  0.0% dd=   12 pos= 0/1  mean= -12.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/block | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/enhance | `sig=    4 hit=   2 net=     68 roi= 1700.0% wr= 50.0% dd=    2 pos= 1/1  mean=  68.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/block | `sig=    4 hit=   0 net=     -4 roi= -100.0% wr=  0.0% dd=    4 pos= 0/1  mean=  -4.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260604-1630-澳门永利/block | `sig=    3 hit=   0 net=     -3 roi= -100.0% wr=  0.0% dd=    3 pos= 0/1  mean=  -3.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/hint | `sig=    2 hit=   2 net=     70 roi= 3500.0% wr=100.0% dd=    0 pos= 1/1  mean=  70.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/baseline | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/hint | `sig=    1 hit=   0 net=     -1 roi= -100.0% wr=  0.0% dd=    1 pos= 0/1  mean=  -1.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Latest 10 Auto Assignment Source
| key | summary |
|---|---:|
| auto/enhance | `sig=  228 hit=   9 net=     96 roi=   42.1% wr=  3.9% dd=  102 pos= 4/6  mean=  16.0 sd=  53.9 gini=0.336 top10=100.0%` |
| auto/observe | `sig=  217 hit=  12 net=    215 roi=   99.1% wr=  5.5% dd=   98 pos= 2/4  mean=  53.8 sd=  96.6 gini=0.482 top10=100.0%` |
| auto/baseline | `sig=  143 hit=   3 net=    -35 roi=  -24.5% wr=  2.1% dd=   72 pos= 2/4  mean=  -8.8 sd=  22.1 gini=0.417 top10=100.0%` |
| auto/block | `sig=   53 hit=   2 net=     19 roi=   35.8% wr=  3.8% dd=   30 pos= 2/6  mean=   3.2 sd=  13.3 gini=0.423 top10=100.0%` |
| none/baseline | `sig=   33 hit=   1 net=      3 roi=    9.1% wr=  3.0% dd=   22 pos= 1/3  mean=   1.0 sd=   5.0 gini=0.308 top10=100.0%` |
| none/block | `sig=   13 hit=   0 net=    -13 roi= -100.0% wr=  0.0% dd=   13 pos= 0/2  mean=  -6.5 sd=   3.5 gini=0.269 top10=100.0%` |
| auto/hint | `sig=    3 hit=   2 net=     69 roi= 2300.0% wr= 66.7% dd=    1 pos= 1/2  mean=  34.5 sd=  35.5 gini=0.486 top10=100.0%` |

### Latest 10 Auto Support x Action
| key | summary |
|---|---:|
| watch/observe | `sig=  179 hit=  10 net=    181 roi=  101.1% wr=  5.6% dd=   82 pos= 2/4  mean=  45.3 sd=  99.9 gini=0.491 top10=100.0%` |
| watch/enhance | `sig=  123 hit=   7 net=    129 roi=  104.9% wr=  5.7% dd=   62 pos= 3/4  mean=  32.3 sd=  59.5 gini=0.256 top10=100.0%` |
| conflict/enhance | `sig=   61 hit=   0 net=    -61 roi= -100.0% wr=  0.0% dd=   61 pos= 0/4  mean= -15.3 sd=   7.7 gini=0.266 top10=100.0%` |
| strong/baseline | `sig=   48 hit=   0 net=    -48 roi= -100.0% wr=  0.0% dd=   48 pos= 0/4  mean= -12.0 sd=  11.2 gini=0.500 top10=100.0%` |
| watch/baseline | `sig=   47 hit=   1 net=    -11 roi=  -23.4% wr=  2.1% dd=   43 pos= 1/4  mean=  -2.8 sd=  12.3 gini=0.272 top10=100.0%` |
| conflict/baseline | `sig=   46 hit=   2 net=     26 roi=   56.5% wr=  4.3% dd=   23 pos= 2/3  mean=   8.7 sd=   9.5 gini=0.422 top10=100.0%` |
| watch/block | `sig=   40 hit=   1 net=     -4 roi=  -10.0% wr=  2.5% dd=   25 pos= 1/6  mean=  -0.7 sd=  11.8 gini=0.474 top10=100.0%` |
| support/observe | `sig=   27 hit=   2 net=     45 roi=  166.7% wr=  7.4% dd=   15 pos= 2/2  mean=  22.5 sd=   3.5 gini=0.078 top10=100.0%` |
| unknown/baseline | `sig=   26 hit=   1 net=     10 roi=   38.5% wr=  3.8% dd=   21 pos= 1/1  mean=  10.0 sd=   0.0 gini=0.000 top10=100.0%` |
| strong/enhance | `sig=   23 hit=   2 net=     49 roi=  213.0% wr=  8.7% dd=   21 pos= 1/4  mean=  12.3 sd=  32.3 gini=0.578 top10=100.0%` |
| support/enhance | `sig=   21 hit=   0 net=    -21 roi= -100.0% wr=  0.0% dd=   21 pos= 0/3  mean=  -7.0 sd=   4.3 gini=0.317 top10=100.0%` |
| unknown/block | `sig=   13 hit=   0 net=    -13 roi= -100.0% wr=  0.0% dd=   13 pos= 0/2  mean=  -6.5 sd=   3.5 gini=0.269 top10=100.0%` |
| conflict/block | `sig=   12 hit=   1 net=     24 roi=  200.0% wr=  8.3% dd=    6 pos= 1/2  mean=  12.0 sd=  14.0 gini=0.429 top10=100.0%` |
| support/baseline | `sig=    9 hit=   0 net=     -9 roi= -100.0% wr=  0.0% dd=    9 pos= 0/1  mean=  -9.0 sd=   0.0 gini=0.000 top10=100.0%` |
| strong/observe | `sig=    6 hit=   0 net=     -6 roi= -100.0% wr=  0.0% dd=    6 pos= 0/1  mean=  -6.0 sd=   0.0 gini=0.000 top10=100.0%` |
| conflict/observe | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |
| strong/hint | `sig=    3 hit=   2 net=     69 roi= 2300.0% wr= 66.7% dd=    1 pos= 1/2  mean=  34.5 sd=  35.5 gini=0.486 top10=100.0%` |
| support/block | `sig=    1 hit=   0 net=     -1 roi= -100.0% wr=  0.0% dd=    1 pos= 0/1  mean=  -1.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Latest 10 Auto Calibration Buckets, min 10 signals
| key | summary |
|---|---:|
| observe/venue:澳门永利/澳门永利 | `sig=  199 hit=  10 net=    161 roi=   80.9% wr=  5.0% dd=   98 pos= 1/3  mean=  53.7 sd= 111.6 gini=0.501 top10=100.0%` |
| baseline/none/none | `sig=  176 hit=   4 net=    -32 roi=  -18.2% wr=  2.3% dd=   75 pos= 2/5  mean=  -6.4 sd=  23.1 gini=0.500 top10=100.0%` |
| enhance/table:auto_53/自动画像53 | `sig=   69 hit=   4 net=     75 roi=  108.7% wr=  5.8% dd=   32 pos= 1/1  mean=  75.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/table:auto_45/自动画像45 | `sig=   60 hit=   0 net=    -60 roi= -100.0% wr=  0.0% dd=   60 pos= 0/1  mean= -60.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/venue:澳门永利/澳门永利 | `sig=   54 hit=   0 net=    -54 roi= -100.0% wr=  0.0% dd=   54 pos= 0/3  mean= -18.0 sd=   4.9 gini=0.148 top10=100.0%` |
| enhance/table:auto_01/自动画像1 | `sig=   36 hit=   2 net=     36 roi=  100.0% wr=  5.6% dd=   23 pos= 1/2  mean=  18.0 sd=  19.0 gini=0.474 top10=100.0%` |
| observe/table:auto_51/自动画像51 | `sig=   18 hit=   2 net=     54 roi=  300.0% wr= 11.1% dd=   13 pos= 1/1  mean=  54.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_06/自动画像6 | `sig=   14 hit=   0 net=    -14 roi= -100.0% wr=  0.0% dd=   14 pos= 0/1  mean= -14.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_48/自动画像48 | `sig=   12 hit=   0 net=    -12 roi= -100.0% wr=  0.0% dd=   12 pos= 0/1  mean= -12.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_52/自动画像52 | `sig=   11 hit=   1 net=     25 roi=  227.3% wr=  9.1% dd=    7 pos= 1/1  mean=  25.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/venue:喜来登/喜来登 | `sig=   10 hit=   0 net=    -10 roi= -100.0% wr=  0.0% dd=   10 pos= 0/1  mean= -10.0 sd=   0.0 gini=0.000 top10=100.0%` |

## legacy-match

### Action ROI
| bucket | summary |
|---|---:|
| enhance | `sig=  178 hit=   5 net=      2 roi=    1.1% wr=  2.8% dd=  134 pos= 3/10 mean=   0.2 sd=  38.7 gini=0.442 top10=100.0%` |
| baseline | `sig= 1418 hit=  39 net=    -14 roi=   -1.0% wr=  2.8% dd=  367 pos=14/37 mean=  -0.4 sd=  39.4 gini=0.504 top10=69.1%` |
| observe | `sig=  123 hit=   4 net=     21 roi=   17.1% wr=  3.3% dd=   66 pos= 2/11 mean=   1.9 sd=  15.1 gini=0.552 top10=99.2%` |
| hint | `sig=  118 hit=   2 net=    -46 roi=  -39.0% wr=  1.7% dd=   48 pos= 2/8  mean=  -5.8 sd=  11.9 gini=0.408 top10=100.0%` |
| block | `sig=  926 hit=  35 net=    334 roi=   36.1% wr=  3.8% dd=  135 pos=15/35 mean=   9.5 sd=  34.2 gini=0.539 top10=71.1%` |

### Plan ROI
| bucket | summary |
|---|---:|
| raw-all | `sig= 2763 hit=  85 net=    297 roi=   10.7% wr=  3.1% dd=  380 pos=24/56 mean=   5.3 sd=  52.4 gini=0.502 top10=49.0%` |
| default-visible(enhance+baseline+observe) | `sig= 1719 hit=  48 net=      9 roi=    0.5% wr=  2.8% dd=  371 pos=17/46 mean=   0.2 sd=  42.3 gini=0.511 top10=61.3%` |
| hidden(hint+block) | `sig= 1044 hit=  37 net=    288 roi=   27.6% wr=  3.5% dd=  152 pos=16/38 mean=   7.6 sd=  34.4 gini=0.529 top10=66.9%` |
| non-baseline | `sig= 1345 hit=  46 net=    311 roi=   23.1% wr=  3.4% dd=  239 pos=16/42 mean=   7.4 sd=  40.4 gini=0.531 top10=63.0%` |
| table-only | `sig= 1194 hit=  42 net=    318 roi=   26.6% wr=  3.5% dd=  236 pos=15/40 mean=   8.0 sd=  38.6 gini=0.558 top10=69.4%` |
| known-feature | `sig= 1728 hit=  51 net=    108 roi=    6.3% wr=  3.0% dd=  349 pos=17/50 mean=   2.2 sd=  42.5 gini=0.545 top10=57.5%` |

### Action Uniformity
| action | summary | worst sessions | best sessions |
|---|---:|---|---|
| enhance | `sig=  178 hit=   5 net=      2 roi=    1.1% wr=  2.8% dd=  134 pos= 3/10 mean=   0.2 sd=  38.7 gini=0.442 top10=100.0%` | 20260605-0230-澳门永利:-60/60<br>wzs-2026-01-11-604:-30/30<br>20251202-晚上-喜来登:-29/29<br>20231024-晚上-巴黎人:-16/16<br>20260603-0230-澳门永利:-12/12 | 20260607-0217-澳门永利:68/4<br>20260606-0131-澳门永利:65/7<br>wzs-2026-05-11-808:19/17<br>wzs-2026-05-11-803:-1/1<br>20260604-1630-澳门永利:-2/2 |
| baseline | `sig= 1418 hit=  39 net=    -14 roi=   -1.0% wr=  2.8% dd=  367 pos=14/37 mean=  -0.4 sd=  39.4 gini=0.504 top10=69.1%` | wzs-2021-04-23-063:-136/208<br>20190331-上午:-66/66<br>20210618-1633:-31/31<br>wzs-2026-05-11-808:-31/31<br>20191118-上下午-巴黎人老:-27/27 | wzs-2026-05-11-807:103/77<br>wzs-2026-01-01-002:80/28<br>20260603-0030-澳门永利:61/83<br>20260603-2101-澳门永利:51/57<br>wzs-2018-11-27-014:32/4 |
| observe | `sig=  123 hit=   4 net=     21 roi=   17.1% wr=  3.3% dd=   66 pos= 2/11 mean=   1.9 sd=  15.1 gini=0.552 top10=99.2%` | 20260603-0230-澳门永利:-15/15<br>wzs-2019-01-28-024:-6/6<br>20210621-1606:-6/6<br>20231024-晚上-巴黎人:-6/6<br>wzs-2026-05-11-808:-5/5 | 20210619-1232:33/3<br>20210620-2016:33/3<br>wzs-2026-01-11-604:0/72<br>20210620-0003:-1/1<br>wzs-2024-03-18-001:-2/2 |
| hint | `sig=  118 hit=   2 net=    -46 roi=  -39.0% wr=  1.7% dd=   48 pos= 2/8  mean=  -5.8 sd=  11.9 gini=0.408 top10=100.0%` | 20260606-0131-澳门永利:-33/33<br>wzs-2024-03-18-001:-9/9<br>wzs-2026-05-11-810:-8/8<br>20210620-2016:-4/4<br>20231025-晚上-伦敦人:-4/4 | wzs-2026-01-11-604:8/28<br>20260603-0030-澳门永利:7/29<br>wzs-2026-05-11-809:-3/3<br>20210620-2016:-4/4<br>20231025-晚上-伦敦人:-4/4 |
| block | `sig=  926 hit=  35 net=    334 roi=   36.1% wr=  3.8% dd=  135 pos=15/35 mean=   9.5 sd=  34.2 gini=0.539 top10=71.1%` | 20210621-1606:-54/54<br>wzs-2026-05-11-804:-48/48<br>wzs-2025-01-13-301:-32/32<br>20230606-2153:-19/19<br>20210619-0052:-14/14 | 20260603-0030-澳门永利:120/60<br>wzs-2026-05-11-806:90/18<br>20210619-1232:64/8<br>20260604-1630-澳门永利:53/19<br>wzs-2026-05-11-808:44/28 |

### Action by Year
| key | summary |
|---|---:|
| 2026/block | `sig=  552 hit=  24 net=    312 roi=   56.5% wr=  4.3% dd=  102 pos= 8/15 mean=  20.8 sd=  41.0 gini=0.539 top10=93.3%` |
| 2026/baseline | `sig=  517 hit=  22 net=    275 roi=   53.2% wr=  4.3% dd=   77 pos= 7/13 mean=  21.2 sd=  40.4 gini=0.446 top10=95.6%` |
| 2021/baseline | `sig=  448 hit=   7 net=   -196 roi=  -43.8% wr=  1.6% dd=  236 pos= 2/7  mean= -28.0 sd=  46.2 gini=0.594 top10=100.0%` |
| 2019/baseline | `sig=  342 hit=   7 net=    -90 roi=  -26.3% wr=  2.0% dd=  139 pos= 2/8  mean= -11.3 sd=  27.1 gini=0.426 top10=100.0%` |
| 2026/enhance | `sig=  133 hit=   5 net=     47 roi=   35.3% wr=  3.8% dd=   89 pos= 3/8  mean=   5.9 sd=  41.2 gini=0.457 top10=100.0%` |
| 2021/block | `sig=  111 hit=   3 net=     -3 roi=   -2.7% wr=  2.7% dd=   63 pos= 2/9  mean=  -0.3 sd=  29.6 gini=0.564 top10=100.0%` |
| 2026/hint | `sig=  101 hit=   2 net=    -29 roi=  -28.7% wr=  2.0% dd=   39 pos= 2/5  mean=  -5.8 sd=  14.9 gini=0.414 top10=100.0%` |
| 2023/block | `sig=  100 hit=   3 net=      8 roi=    8.0% wr=  3.0% dd=   72 pos= 1/3  mean=   2.7 sd=  19.9 gini=0.360 top10=100.0%` |
| 2026/observe | `sig=   92 hit=   2 net=    -20 roi=  -21.7% wr=  2.2% dd=   51 pos= 0/3  mean=  -6.7 sd=   6.2 gini=0.500 top10=100.0%` |
| 2025/block | `sig=   82 hit=   1 net=    -46 roi=  -56.1% wr=  1.2% dd=   64 pos= 1/4  mean= -11.5 sd=  12.6 gini=0.521 top10=100.0%` |
| 2019/block | `sig=   81 hit=   4 net=     63 roi=   77.8% wr=  4.9% dd=   27 pos= 3/4  mean=  15.8 sd=  17.8 gini=0.199 top10=100.0%` |
| 2025/baseline | `sig=   63 hit=   1 net=    -27 roi=  -42.9% wr=  1.6% dd=   38 pos= 1/4  mean=  -6.8 sd=  10.4 gini=0.320 top10=100.0%` |
| 2023/baseline | `sig=   35 hit=   0 net=    -35 roi= -100.0% wr=  0.0% dd=   35 pos= 0/3  mean= -11.7 sd=   9.5 gini=0.438 top10=100.0%` |
| 2025/enhance | `sig=   29 hit=   0 net=    -29 roi= -100.0% wr=  0.0% dd=   29 pos= 0/1  mean= -29.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2021/observe | `sig=   17 hit=   2 net=     55 roi=  323.5% wr= 11.8% dd=    7 pos= 2/5  mean=  11.0 sd=  18.0 gini=0.483 top10=100.0%` |
| 2023/enhance | `sig=   16 hit=   0 net=    -16 roi= -100.0% wr=  0.0% dd=   16 pos= 0/1  mean= -16.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2018/baseline | `sig=   13 hit=   2 net=     59 roi=  453.8% wr= 15.4% dd=    6 pos= 2/2  mean=  29.5 sd=   2.5 gini=0.042 top10=100.0%` |
| 2024/hint | `sig=    9 hit=   0 net=     -9 roi= -100.0% wr=  0.0% dd=    9 pos= 0/1  mean=  -9.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2019/observe | `sig=    6 hit=   0 net=     -6 roi= -100.0% wr=  0.0% dd=    6 pos= 0/1  mean=  -6.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2023/observe | `sig=    6 hit=   0 net=     -6 roi= -100.0% wr=  0.0% dd=    6 pos= 0/1  mean=  -6.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2021/hint | `sig=    4 hit=   0 net=     -4 roi= -100.0% wr=  0.0% dd=    4 pos= 0/1  mean=  -4.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2023/hint | `sig=    4 hit=   0 net=     -4 roi= -100.0% wr=  0.0% dd=    4 pos= 0/1  mean=  -4.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2024/observe | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Action by Venue, min 40 signals
| key | summary |
|---|---:|
| wzs/baseline | `sig=  632 hit=  19 net=     52 roi=    8.2% wr=  3.0% dd=  238 pos= 8/16 mean=   3.3 sd=  50.7 gini=0.488 top10=92.4%` |
| wzs/block | `sig=  410 hit=  13 net=     58 roi=   14.1% wr=  3.2% dd=  102 pos= 4/13 mean=   4.5 sd=  33.0 gini=0.556 top10=97.3%` |
| 澳门永利/baseline | `sig=  317 hit=  12 net=    115 roi=   36.3% wr=  3.8% dd=   77 pos= 3/5  mean=  23.0 sd=  30.2 gini=0.392 top10=100.0%` |
| 澳门永利/block | `sig=  211 hit=  12 net=    221 roi=  104.7% wr=  5.7% dd=   34 pos= 5/7  mean=  31.6 sd=  41.0 gini=0.514 top10=100.0%` |
| unknown/block | `sig=  195 hit=   6 net=     21 roi=   10.8% wr=  3.1% dd=  135 pos= 3/9  mean=   2.3 sd=  31.5 gini=0.488 top10=100.0%` |
| unknown/baseline | `sig=  140 hit=   1 net=   -104 roi=  -74.3% wr=  0.7% dd=  123 pos= 1/6  mean= -17.3 sd=  24.4 gini=0.621 top10=100.0%` |
| 01/baseline | `sig=  131 hit=   3 net=    -23 roi=  -17.6% wr=  2.3% dd=   45 pos= 0/1  mean= -23.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 电/baseline | `sig=   90 hit=   3 net=     18 roi=   20.0% wr=  3.3% dd=   41 pos= 1/1  mean=  18.0 sd=   0.0 gini=0.000 top10=100.0%` |
| wzs/observe | `sig=   89 hit=   2 net=    -17 roi=  -19.1% wr=  2.2% dd=   63 pos= 0/5  mean=  -3.4 sd=   2.2 gini=0.353 top10=100.0%` |
| 澳门永利/enhance | `sig=   85 hit=   4 net=     59 roi=   69.4% wr=  4.7% dd=   77 pos= 2/5  mean=  11.8 sd=  48.8 gini=0.357 top10=100.0%` |
| 澳门永利/hint | `sig=   62 hit=   1 net=    -26 roi=  -41.9% wr=  1.6% dd=   33 pos= 1/2  mean= -13.0 sd=  20.0 gini=0.325 top10=100.0%` |
| wzs/hint | `sig=   48 hit=   1 net=    -12 roi=  -25.0% wr=  2.1% dd=   36 pos= 1/4  mean=  -3.0 sd=   6.7 gini=0.161 top10=100.0%` |
| wzs/enhance | `sig=   48 hit=   1 net=    -12 roi=  -25.0% wr=  2.1% dd=   45 pos= 1/3  mean=  -4.0 sd=  20.1 gini=0.387 top10=100.0%` |
| 喜来登/block | `sig=   46 hit=   1 net=    -10 roi=  -21.7% wr=  2.2% dd=   28 pos= 1/2  mean=  -5.0 sd=   6.0 gini=0.417 top10=100.0%` |
| 新/block | `sig=   43 hit=   2 net=     29 roi=   67.4% wr=  4.7% dd=   21 pos= 1/1  mean=  29.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Action x Scope/Sample
| key | summary |
|---|---:|
| baseline/none/none | `sig= 1418 hit=  39 net=    -14 roi=   -1.0% wr=  2.8% dd=  367 pos=14/37 mean=  -0.4 sd=  39.4 gini=0.504 top10=69.1%` |
| block/table/tier | `sig=  544 hit=  22 net=    248 roi=   45.6% wr=  4.0% dd=  125 pos=11/28 mean=   8.9 sd=  29.7 gini=0.537 top10=80.5%` |
| block/table/overall | `sig=  258 hit=   9 net=     66 roi=   25.6% wr=  3.5% dd=   68 pos= 5/18 mean=   3.7 sd=  22.0 gini=0.587 top10=92.2%` |
| enhance/table/tier | `sig=  146 hit=   3 net=    -38 roi=  -26.0% wr=  2.1% dd=  108 pos= 2/6  mean=  -6.3 sd=  40.5 gini=0.310 top10=100.0%` |
| observe/table/overall | `sig=   99 hit=   4 net=     45 roi=   45.5% wr=  4.0% dd=   64 pos= 2/7  mean=   6.4 sd=  16.9 gini=0.519 top10=100.0%` |
| hint/table/overall | `sig=   79 hit=   1 net=    -43 roi=  -54.4% wr=  1.3% dd=   45 pos= 1/5  mean=  -8.6 sd=  13.3 gini=0.442 top10=100.0%` |
| block/venue/tier | `sig=   76 hit=   4 net=     68 roi=   89.5% wr=  5.3% dd=   25 pos= 3/5  mean=  13.6 sd=  22.7 gini=0.625 top10=100.0%` |
| block/venue/overall | `sig=   48 hit=   0 net=    -48 roi= -100.0% wr=  0.0% dd=   48 pos= 0/2  mean= -24.0 sd=  19.0 gini=0.396 top10=100.0%` |
| hint/table/tier | `sig=   39 hit=   1 net=     -3 roi=   -7.7% wr=  2.6% dd=   27 pos= 1/3  mean=  -1.0 sd=   6.7 gini=0.175 top10=100.0%` |
| enhance/table/overall | `sig=   20 hit=   2 net=     52 roi=  260.0% wr= 10.0% dd=   16 pos= 1/4  mean=  13.0 sd=  30.2 gini=0.641 top10=100.0%` |
| observe/venue/tier | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/venue/overall | `sig=   12 hit=   0 net=    -12 roi= -100.0% wr=  0.0% dd=   12 pos= 0/1  mean= -12.0 sd=   0.0 gini=0.000 top10=100.0%` |
| observe/table/tier | `sig=    9 hit=   0 net=     -9 roi= -100.0% wr=  0.0% dd=    9 pos= 0/3  mean=  -3.0 sd=   2.2 gini=0.370 top10=100.0%` |

### Support x Action
| key | summary |
|---|---:|
| watch/baseline | `sig=  493 hit=  15 net=     47 roi=    9.5% wr=  3.0% dd=  138 pos= 8/25 mean=   1.9 sd=  17.7 gini=0.431 top10=78.3%` |
| unknown/baseline | `sig=  473 hit=  15 net=     67 roi=   14.2% wr=  3.2% dd=  105 pos= 9/28 mean=   2.4 sd=  21.4 gini=0.499 top10=74.8%` |
| watch/block | `sig=  429 hit=  16 net=    147 roi=   34.3% wr=  3.7% dd=  125 pos= 6/19 mean=   7.7 sd=  32.3 gini=0.578 top10=95.3%` |
| unknown/block | `sig=  397 hit=  15 net=    143 roi=   36.0% wr=  3.8% dd=   80 pos=10/29 mean=   4.9 sd=  24.1 gini=0.563 top10=71.5%` |
| conflict/baseline | `sig=  158 hit=   2 net=    -86 roi=  -54.4% wr=  1.3% dd=  118 pos= 2/16 mean=  -5.4 sd=  13.4 gini=0.471 top10=89.9%` |
| support/baseline | `sig=  153 hit=   4 net=     -9 roi=   -5.9% wr=  2.6% dd=   72 pos= 2/15 mean=  -0.6 sd=  21.3 gini=0.559 top10=92.2%` |
| strong/baseline | `sig=  141 hit=   3 net=    -33 roi=  -23.4% wr=  2.1% dd=  100 pos= 2/15 mean=  -2.2 sd=  21.4 gini=0.590 top10=95.7%` |
| watch/enhance | `sig=   91 hit=   1 net=    -55 roi=  -60.4% wr=  1.1% dd=   59 pos= 1/4  mean= -13.8 sd=  27.9 gini=0.460 top10=100.0%` |
| unknown/hint | `sig=   85 hit=   1 net=    -49 roi=  -57.6% wr=  1.2% dd=   51 pos= 1/7  mean=  -7.0 sd=  11.4 gini=0.458 top10=100.0%` |
| conflict/block | `sig=   61 hit=   2 net=     11 roi=   18.0% wr=  3.3% dd=   48 pos= 2/7  mean=   1.6 sd=  13.7 gini=0.393 top10=100.0%` |
| unknown/enhance | `sig=   58 hit=   2 net=     14 roi=   24.1% wr=  3.4% dd=   55 pos= 1/5  mean=   2.8 sd=  33.4 gini=0.536 top10=100.0%` |
| support/observe | `sig=   44 hit=   2 net=     28 roi=   63.6% wr=  4.5% dd=   27 pos= 1/3  mean=   9.3 sd=  16.8 gini=0.561 top10=100.0%` |
| conflict/observe | `sig=   33 hit=   1 net=      3 roi=    9.1% wr=  3.0% dd=   32 pos= 1/4  mean=   0.8 sd=  21.7 gini=0.451 top10=100.0%` |
| watch/hint | `sig=   28 hit=   1 net=      8 roi=   28.6% wr=  3.6% dd=   27 pos= 1/1  mean=   8.0 sd=   0.0 gini=0.000 top10=100.0%` |
| support/block | `sig=   23 hit=   1 net=     13 roi=   56.5% wr=  4.3% dd=   20 pos= 1/5  mean=   2.6 sd=  15.8 gini=0.604 top10=100.0%` |
| watch/observe | `sig=   23 hit=   0 net=    -23 roi= -100.0% wr=  0.0% dd=   23 pos= 0/3  mean=  -7.7 sd=   5.4 gini=0.377 top10=100.0%` |
| unknown/observe | `sig=   22 hit=   1 net=     14 roi=   63.6% wr=  4.5% dd=   14 pos= 1/6  mean=   2.3 sd=  13.9 gini=0.571 top10=100.0%` |
| strong/enhance | `sig=   19 hit=   2 net=     53 roi=  278.9% wr= 10.5% dd=   17 pos= 1/4  mean=  13.3 sd=  31.7 gini=0.605 top10=100.0%` |
| strong/block | `sig=   16 hit=   1 net=     20 roi=  125.0% wr=  6.3% dd=    8 pos= 1/3  mean=   6.7 sd=  16.7 gini=0.467 top10=100.0%` |
| support/enhance | `sig=   10 hit=   0 net=    -10 roi= -100.0% wr=  0.0% dd=   10 pos= 0/2  mean=  -5.0 sd=   4.0 gini=0.400 top10=100.0%` |
| support/hint | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |
| strong/observe | `sig=    1 hit=   0 net=     -1 roi= -100.0% wr=  0.0% dd=    1 pos= 0/1  mean=  -1.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Realized ROI by Historical Calibration ROI Band
| key | summary |
|---|---:|
| none/baseline | `sig= 1418 hit=  39 net=    -14 roi=   -1.0% wr=  2.8% dd=  367 pos=14/37 mean=  -0.4 sd=  39.4 gini=0.504 top10=69.1%` |
| <-50/block | `sig=  686 hit=  24 net=    178 roi=   25.9% wr=  3.5% dd=  141 pos=10/31 mean=   5.7 sd=  28.1 gini=0.603 top10=79.4%` |
| -20..-5/block | `sig=  179 hit=   6 net=     37 roi=   20.7% wr=  3.4% dd=  100 pos= 4/8  mean=   4.6 sd=  29.8 gini=0.366 top10=100.0%` |
| >=35/enhance | `sig=  178 hit=   5 net=      2 roi=    1.1% wr=  2.8% dd=  134 pos= 3/10 mean=   0.2 sd=  38.7 gini=0.442 top10=100.0%` |
| 10..35/observe | `sig=  123 hit=   4 net=     21 roi=   17.1% wr=  3.3% dd=   66 pos= 2/11 mean=   1.9 sd=  15.1 gini=0.552 top10=99.2%` |
| -5..10/hint | `sig=  118 hit=   2 net=    -46 roi=  -39.0% wr=  1.7% dd=   48 pos= 2/8  mean=  -5.8 sd=  11.9 gini=0.408 top10=100.0%` |
| -50..-20/block | `sig=   61 hit=   5 net=    119 roi=  195.1% wr=  8.2% dd=   21 pos= 4/12 mean=   9.9 sd=  21.9 gini=0.651 top10=96.7%` |

### Top Calibration Buckets, min 25 signals
| key | summary |
|---|---:|
| baseline/none/none | `sig= 1418 hit=  39 net=    -14 roi=   -1.0% wr=  2.8% dd=  367 pos=14/37 mean=  -0.4 sd=  39.4 gini=0.504 top10=69.1%` |
| block/table:auto_37/自动画像37 | `sig=  186 hit=   5 net=     -6 roi=   -3.2% wr=  2.7% dd=   97 pos= 0/1  mean=  -6.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_19/自动画像19 | `sig=  167 hit=   3 net=    -59 roi=  -35.3% wr=  1.8% dd=  107 pos= 1/4  mean= -14.8 sd=  31.3 gini=0.340 top10=100.0%` |
| block/table:auto_02/自动画像2 | `sig=  110 hit=   4 net=     34 roi=   30.9% wr=  3.6% dd=   32 pos= 4/12 mean=   2.8 sd=  17.3 gini=0.472 top10=97.3%` |
| observe/table:auto_05/自动画像5 | `sig=   72 hit=   2 net=      0 roi=    0.0% wr=  2.8% dd=   51 pos= 0/1  mean=   0.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_33/自动画像33 | `sig=   64 hit=   4 net=     80 roi=  125.0% wr=  6.3% dd=   29 pos= 2/2  mean=  40.0 sd=  13.0 gini=0.163 top10=100.0%` |
| hint/table:auto_02/自动画像2 | `sig=   62 hit=   1 net=    -26 roi=  -41.9% wr=  1.6% dd=   33 pos= 1/2  mean= -13.0 sd=  20.0 gini=0.325 top10=100.0%` |
| enhance/table:auto_45/自动画像45 | `sig=   60 hit=   0 net=    -60 roi= -100.0% wr=  0.0% dd=   60 pos= 0/1  mean= -60.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/venue:wzs/wzs | `sig=   53 hit=   0 net=    -53 roi= -100.0% wr=  0.0% dd=   53 pos= 0/2  mean= -26.5 sd=  21.5 gini=0.406 top10=100.0%` |
| block/table:auto_48/自动画像48 | `sig=   51 hit=   3 net=     57 roi=  111.8% wr=  5.9% dd=   19 pos= 1/2  mean=  28.5 sd=  31.5 gini=0.452 top10=100.0%` |
| block/venue:巴黎人/巴黎人 | `sig=   49 hit=   3 net=     59 roi=  120.4% wr=  6.1% dd=   20 pos= 2/2  mean=  29.5 sd=  27.5 gini=0.466 top10=100.0%` |
| block/table:auto_06/自动画像6 | `sig=   43 hit=   3 net=     65 roi=  151.2% wr=  7.0% dd=   24 pos= 2/2  mean=  32.5 sd=  31.5 gini=0.485 top10=100.0%` |
| block/table:auto_32/自动画像32 | `sig=   38 hit=   1 net=     -2 roi=   -5.3% wr=  2.6% dd=   21 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |
| hint/table:auto_05/自动画像5 | `sig=   36 hit=   1 net=      0 roi=    0.0% wr=  2.8% dd=   35 pos= 1/3  mean=   0.0 sd=   5.7 gini=0.167 top10=100.0%` |
| block/table:auto_42/自动画像42 | `sig=   34 hit=   4 net=    110 roi=  323.5% wr= 11.8% dd=   19 pos= 2/3  mean=  36.7 sd=  39.4 gini=0.486 top10=100.0%` |
| enhance/table:auto_19/自动画像19 | `sig=   30 hit=   0 net=    -30 roi= -100.0% wr=  0.0% dd=   30 pos= 0/2  mean= -15.0 sd=  14.0 gini=0.467 top10=100.0%` |
| enhance/table:auto_28/自动画像28 | `sig=   30 hit=   0 net=    -30 roi= -100.0% wr=  0.0% dd=   30 pos= 0/1  mean= -30.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_01/自动画像1 | `sig=   27 hit=   1 net=      9 roi=   33.3% wr=  3.7% dd=   15 pos= 1/2  mean=   4.5 sd=  10.5 gini=0.214 top10=100.0%` |
| enhance/table:auto_01/自动画像1 | `sig=   26 hit=   3 net=     82 roi=  315.4% wr= 11.5% dd=   14 pos= 2/3  mean=  27.3 sd=  28.0 gini=0.488 top10=100.0%` |

### Auto Assignment Source
| key | summary |
|---|---:|
| profile-match/baseline | `sig= 1418 hit=  39 net=    -14 roi=   -1.0% wr=  2.8% dd=  367 pos=14/37 mean=  -0.4 sd=  39.4 gini=0.504 top10=69.1%` |
| profile-match/block | `sig=  926 hit=  35 net=    334 roi=   36.1% wr=  3.8% dd=  135 pos=15/35 mean=   9.5 sd=  34.2 gini=0.539 top10=71.1%` |
| profile-match/enhance | `sig=  178 hit=   5 net=      2 roi=    1.1% wr=  2.8% dd=  134 pos= 3/10 mean=   0.2 sd=  38.7 gini=0.442 top10=100.0%` |
| profile-match/observe | `sig=  123 hit=   4 net=     21 roi=   17.1% wr=  3.3% dd=   66 pos= 2/11 mean=   1.9 sd=  15.1 gini=0.552 top10=99.2%` |
| profile-match/hint | `sig=  118 hit=   2 net=    -46 roi=  -39.0% wr=  1.7% dd=   48 pos= 2/8  mean=  -5.8 sd=  11.9 gini=0.408 top10=100.0%` |

## auto-prefix

### Action ROI
| bucket | summary |
|---|---:|
| enhance | `sig=  342 hit=  10 net=     18 roi=    5.3% wr=  2.9% dd=  102 pos= 5/13 mean=   1.4 sd=  39.7 gini=0.494 top10=95.6%` |
| baseline | `sig= 1012 hit=  24 net=   -148 roi=  -14.6% wr=  2.4% dd=  299 pos=11/33 mean=  -4.5 sd=  32.3 gini=0.566 top10=79.3%` |
| observe | `sig=  325 hit=  16 net=    251 roi=   77.2% wr=  4.9% dd=   98 pos= 5/16 mean=  15.7 sd=  54.5 gini=0.685 top10=96.0%` |
| hint | `sig=  135 hit=   4 net=      9 roi=    6.7% wr=  3.0% dd=  120 pos= 2/11 mean=   0.8 sd=  25.5 gini=0.559 top10=99.3%` |
| block | `sig=  949 hit=  31 net=    167 roi=   17.6% wr=  3.3% dd=  135 pos=13/39 mean=   4.3 sd=  28.7 gini=0.564 top10=66.9%` |

### Plan ROI
| bucket | summary |
|---|---:|
| raw-all | `sig= 2763 hit=  85 net=    297 roi=   10.7% wr=  3.1% dd=  380 pos=24/56 mean=   5.3 sd=  52.4 gini=0.502 top10=49.0%` |
| default-visible(enhance+baseline+observe) | `sig= 1679 hit=  50 net=    121 roi=    7.2% wr=  3.0% dd=  343 pos=17/45 mean=   2.7 sd=  45.9 gini=0.557 top10=64.2%` |
| hidden(hint+block) | `sig= 1084 hit=  35 net=    176 roi=   16.2% wr=  3.2% dd=  166 pos=15/41 mean=   4.3 sd=  30.6 gini=0.494 top10=61.1%` |
| non-baseline | `sig= 1751 hit=  61 net=    445 roi=   25.4% wr=  3.5% dd=  222 pos=18/43 mean=  10.3 sd=  53.3 gini=0.519 top10=57.7%` |
| table-only | `sig= 1409 hit=  50 net=    391 roi=   27.8% wr=  3.5% dd=  204 pos=17/42 mean=   9.3 sd=  41.2 gini=0.497 top10=60.2%` |
| known-feature | `sig= 2479 hit=  77 net=    293 roi=   11.8% wr=  3.1% dd=  319 pos=21/53 mean=   5.5 sd=  51.6 gini=0.504 top10=52.7%` |

### Action Uniformity
| action | summary | worst sessions | best sessions |
|---|---:|---|---|
| enhance | `sig=  342 hit=  10 net=     18 roi=    5.3% wr=  2.9% dd=  102 pos= 5/13 mean=   1.4 sd=  39.7 gini=0.494 top10=95.6%` | 20260605-0230-澳门永利:-84/84<br>20251202-晚上-喜来登:-29/29<br>20231024-晚上-巴黎人:-19/19<br>20210618-1633:-13/13<br>20260603-0230-澳门永利:-12/12 | 20260603-2101-澳门永利:75/69<br>20260607-0217-澳门永利:68/4<br>20260601-1630-澳门永利:37/35<br>20260606-0131-澳门永利:12/24<br>wzs-2026-05-11-808:4/32 |
| baseline | `sig= 1012 hit=  24 net=   -148 roi=  -14.6% wr=  2.4% dd=  299 pos=11/33 mean=  -4.5 sd=  32.3 gini=0.566 top10=79.3%` | wzs-2021-04-23-063:-120/192<br>20190331-上午:-66/66<br>20260603-0030-澳门永利:-45/81<br>wzs-2021-04-23-062:-29/65<br>20191118-上下午-巴黎人老:-27/27 | wzs-2026-05-11-807:79/65<br>wzs-2018-11-27-014:32/4<br>20191119-上午-巴黎人-老:32/4<br>wzs-2018-11-27-012:27/9<br>20190329-下午全:27/9 |
| observe | `sig=  325 hit=  16 net=    251 roi=   77.2% wr=  4.9% dd=   98 pos= 5/16 mean=  15.7 sd=  54.5 gini=0.685 top10=96.0%` | 20260606-0131-澳门永利:-35/107<br>20260603-0230-澳门永利:-15/15<br>20210618-1633:-8/8<br>wzs-2026-05-11-804:-7/7<br>wzs-2019-01-28-024:-6/6 | 20260603-0030-澳门永利:211/77<br>20260604-1630-澳门永利:54/18<br>20210619-1232:35/1<br>20210620-2016:33/3<br>wzs-2026-01-11-604:8/64 |
| hint | `sig=  135 hit=   4 net=      9 roi=    6.7% wr=  3.0% dd=  120 pos= 2/11 mean=   0.8 sd=  25.5 gini=0.559 top10=99.3%` | wzs-2026-01-11-604:-25/61<br>20231025-晚上-伦敦人:-24/24<br>wzs-2021-04-23-063:-15/15<br>wzs-2024-03-18-001:-9/9<br>20231024-晚上-巴黎人:-6/6 | 20260606-0131-澳门永利:70/2<br>wzs-2026-05-11-803:26/10<br>wzs-2026-05-11-804:-1/1<br>20260605-0230-澳门永利:-1/1<br>20210618-1633:-2/2 |
| block | `sig=  949 hit=  31 net=    167 roi=   17.6% wr=  3.3% dd=  135 pos=13/39 mean=   4.3 sd=  28.7 gini=0.564 top10=66.9%` | 20210621-1606:-54/54<br>wzs-2026-05-11-804:-34/34<br>wzs-2025-01-13-301:-32/32<br>20230606-2153:-19/19<br>20210619-0052:-14/14 | wzs-2026-05-11-806:111/33<br>wzs-2026-01-01-002:73/35<br>20210619-1232:62/10<br>20191009-晚上-假日-新:30/42<br>20230608-1548:29/79 |

### Action by Year
| key | summary |
|---|---:|
| 2026/block | `sig=  492 hit=  19 net=    192 roi=   39.0% wr=  3.9% dd=  112 pos= 7/16 mean=  12.0 sd=  34.6 gini=0.556 top10=91.9%` |
| 2019/baseline | `sig=  347 hit=   8 net=    -59 roi=  -17.0% wr=  2.3% dd=  140 pos= 3/9  mean=  -6.6 sd=  28.9 gini=0.391 top10=100.0%` |
| 2021/baseline | `sig=  328 hit=   5 net=   -148 roi=  -45.1% wr=  1.5% dd=  223 pos= 2/7  mean= -21.1 sd=  42.2 gini=0.659 top10=100.0%` |
| 2026/observe | `sig=  292 hit=  14 net=    212 roi=   72.6% wr=  4.8% dd=   98 pos= 3/7  mean=  30.3 sd=  78.0 gini=0.635 top10=100.0%` |
| 2026/enhance | `sig=  281 hit=  10 net=     79 roi=   28.1% wr=  3.6% dd=  102 pos= 5/10 mean=   7.9 sd=  43.0 gini=0.512 top10=100.0%` |
| 2026/baseline | `sig=  255 hit=   8 net=     33 roi=   12.9% wr=  3.1% dd=   75 pos= 3/8  mean=   4.1 sd=  33.8 gini=0.575 top10=100.0%` |
| 2021/block | `sig=  195 hit=   5 net=    -15 roi=   -7.7% wr=  2.6% dd=   77 pos= 2/11 mean=  -1.4 sd=  26.4 gini=0.584 top10=99.5%` |
| 2023/block | `sig=  104 hit=   3 net=      4 roi=    3.8% wr=  2.9% dd=   72 pos= 1/5  mean=   0.8 sd=  15.6 gini=0.541 top10=100.0%` |
| 2025/block | `sig=   82 hit=   1 net=    -46 roi=  -56.1% wr=  1.2% dd=   64 pos= 1/4  mean= -11.5 sd=  12.6 gini=0.521 top10=100.0%` |
| 2019/block | `sig=   76 hit=   3 net=     32 roi=   42.1% wr=  3.9% dd=   27 pos= 2/3  mean=  10.7 sd=  17.8 gini=0.195 top10=100.0%` |
| 2026/hint | `sig=   75 hit=   4 net=     69 roi=   92.0% wr=  5.3% dd=   60 pos= 2/5  mean=  13.8 sd=  32.4 gini=0.530 top10=100.0%` |
| 2025/baseline | `sig=   63 hit=   1 net=    -27 roi=  -42.9% wr=  1.6% dd=   38 pos= 1/4  mean=  -6.8 sd=  10.4 gini=0.320 top10=100.0%` |
| 2023/hint | `sig=   30 hit=   0 net=    -30 roi= -100.0% wr=  0.0% dd=   30 pos= 0/2  mean= -15.0 sd=   9.0 gini=0.300 top10=100.0%` |
| 2025/enhance | `sig=   29 hit=   0 net=    -29 roi= -100.0% wr=  0.0% dd=   29 pos= 0/1  mean= -29.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2021/observe | `sig=   23 hit=   2 net=     49 roi=  213.0% wr=  8.7% dd=   12 pos= 2/6  mean=   8.2 sd=  18.4 gini=0.496 top10=100.0%` |
| 2021/hint | `sig=   21 hit=   0 net=    -21 roi= -100.0% wr=  0.0% dd=   21 pos= 0/3  mean=  -7.0 sd=   5.7 gini=0.413 top10=100.0%` |
| 2023/enhance | `sig=   19 hit=   0 net=    -19 roi= -100.0% wr=  0.0% dd=   19 pos= 0/1  mean= -19.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2018/baseline | `sig=   13 hit=   2 net=     59 roi=  453.8% wr= 15.4% dd=    6 pos= 2/2  mean=  29.5 sd=   2.5 gini=0.042 top10=100.0%` |
| 2021/enhance | `sig=   13 hit=   0 net=    -13 roi= -100.0% wr=  0.0% dd=   13 pos= 0/1  mean= -13.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2024/hint | `sig=    9 hit=   0 net=     -9 roi= -100.0% wr=  0.0% dd=    9 pos= 0/1  mean=  -9.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2019/observe | `sig=    6 hit=   0 net=     -6 roi= -100.0% wr=  0.0% dd=    6 pos= 0/1  mean=  -6.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2023/baseline | `sig=    6 hit=   0 net=     -6 roi= -100.0% wr=  0.0% dd=    6 pos= 0/3  mean=  -2.0 sd=   0.8 gini=0.222 top10=100.0%` |
| 2023/observe | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2024/observe | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Action by Venue, min 40 signals
| key | summary |
|---|---:|
| wzs/block | `sig=  568 hit=  20 net=    152 roi=   26.8% wr=  3.5% dd=  112 pos= 6/15 mean=  10.1 sd=  37.0 gini=0.541 top10=93.0%` |
| wzs/baseline | `sig=  423 hit=  11 net=    -27 roi=   -6.4% wr=  2.6% dd=  225 pos= 5/11 mean=  -2.5 sd=  46.6 gini=0.517 top10=99.8%` |
| 澳门永利/enhance | `sig=  228 hit=   9 net=     96 roi=   42.1% wr=  3.9% dd=  102 pos= 4/6  mean=  16.0 sd=  53.9 gini=0.336 top10=100.0%` |
| 澳门永利/observe | `sig=  217 hit=  12 net=    215 roi=   99.1% wr=  5.5% dd=   98 pos= 2/4  mean=  53.8 sd=  96.6 gini=0.482 top10=100.0%` |
| unknown/block | `sig=  206 hit=   6 net=     10 roi=    4.9% wr=  2.9% dd=  135 pos= 3/11 mean=   0.9 sd=  28.2 gini=0.530 top10=99.0%` |
| 澳门永利/baseline | `sig=  176 hit=   4 net=    -32 roi=  -18.2% wr=  2.3% dd=   75 pos= 2/5  mean=  -6.4 sd=  23.1 gini=0.500 top10=100.0%` |
| 01/baseline | `sig=  131 hit=   3 net=    -23 roi=  -17.6% wr=  2.3% dd=   45 pos= 0/1  mean= -23.0 sd=   0.0 gini=0.000 top10=100.0%` |
| unknown/baseline | `sig=  108 hit=   1 net=    -72 roi=  -66.7% wr=  0.9% dd=   91 pos= 1/6  mean= -12.0 sd=  24.2 gini=0.714 top10=100.0%` |
| wzs/hint | `sig=   96 hit=   2 net=    -24 roi=  -25.0% wr=  2.1% dd=   84 pos= 1/5  mean=  -4.8 sd=  17.3 gini=0.347 top10=100.0%` |
| 电/baseline | `sig=   90 hit=   3 net=     18 roi=   20.0% wr=  3.3% dd=   41 pos= 1/1  mean=  18.0 sd=   0.0 gini=0.000 top10=100.0%` |
| wzs/observe | `sig=   87 hit=   2 net=    -15 roi=  -17.2% wr=  2.3% dd=   63 pos= 1/6  mean=  -2.5 sd=   5.0 gini=0.220 top10=100.0%` |
| 澳门永利/block | `sig=   66 hit=   2 net=      6 roi=    9.1% wr=  3.0% dd=   33 pos= 2/6  mean=   1.0 sd=  11.7 gini=0.374 top10=100.0%` |
| wzs/enhance | `sig=   53 hit=   1 net=    -17 roi=  -32.1% wr=  1.9% dd=   29 pos= 1/4  mean=  -4.3 sd=   5.1 gini=0.190 top10=100.0%` |
| 喜来登/block | `sig=   46 hit=   1 net=    -10 roi=  -21.7% wr=  2.2% dd=   28 pos= 1/2  mean=  -5.0 sd=   6.0 gini=0.417 top10=100.0%` |
| 新/block | `sig=   42 hit=   2 net=     30 roi=   71.4% wr=  4.8% dd=   20 pos= 1/1  mean=  30.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Action x Scope/Sample
| key | summary |
|---|---:|
| baseline/none/none | `sig= 1012 hit=  24 net=   -148 roi=  -14.6% wr=  2.4% dd=  299 pos=11/33 mean=  -4.5 sd=  32.3 gini=0.566 top10=79.3%` |
| block/table/tier | `sig=  683 hit=  24 net=    181 roi=   26.5% wr=  3.5% dd=  125 pos=11/33 mean=   5.5 sd=  26.5 gini=0.547 top10=79.4%` |
| block/table/overall | `sig=  202 hit=   6 net=     14 roi=    6.9% wr=  3.0% dd=   63 pos= 4/18 mean=   0.8 sd=  20.5 gini=0.519 top10=88.6%` |
| enhance/table/tier | `sig=  190 hit=   6 net=     26 roi=   13.7% wr=  3.2% dd=   77 pos= 4/10 mean=   2.6 sd=  34.8 gini=0.448 top10=100.0%` |
| observe/venue/tier | `sig=  176 hit=   9 net=    148 roi=   84.1% wr=  5.1% dd=   98 pos= 1/3  mean=  49.3 sd= 115.1 gini=0.477 top10=100.0%` |
| observe/table/overall | `sig=  110 hit=   6 net=    106 roi=   96.4% wr=  5.5% dd=   60 pos= 4/9  mean=  11.8 sd=  21.6 gini=0.521 top10=100.0%` |
| enhance/table/overall | `sig=   88 hit=   4 net=     56 roi=   63.6% wr=  4.5% dd=   50 pos= 1/4  mean=  14.0 sd=  35.4 gini=0.596 top10=100.0%` |
| hint/table/tier | `sig=   73 hit=   2 net=     -1 roi=   -1.4% wr=  2.7% dd=   62 pos= 1/3  mean=  -0.3 sd=  20.9 gini=0.302 top10=100.0%` |
| block/venue/tier | `sig=   55 hit=   1 net=    -19 roi=  -34.5% wr=  1.8% dd=   37 pos= 1/5  mean=  -3.8 sd=   4.1 gini=0.365 top10=100.0%` |
| hint/table/overall | `sig=   47 hit=   2 net=     25 roi=   53.2% wr=  4.3% dd=   45 pos= 1/7  mean=   3.6 sd=  28.1 gini=0.641 top10=100.0%` |
| enhance/venue/tier | `sig=   44 hit=   0 net=    -44 roi= -100.0% wr=  0.0% dd=   44 pos= 0/3  mean= -14.7 sd=   3.4 gini=0.121 top10=100.0%` |
| observe/venue/overall | `sig=   23 hit=   1 net=     13 roi=   56.5% wr=  4.3% dd=   21 pos= 1/1  mean=  13.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/venue/overall | `sig=   20 hit=   0 net=    -20 roi= -100.0% wr=  0.0% dd=   20 pos= 0/2  mean= -10.0 sd=   2.0 gini=0.100 top10=100.0%` |
| observe/table/tier | `sig=   16 hit=   0 net=    -16 roi= -100.0% wr=  0.0% dd=   16 pos= 0/4  mean=  -4.0 sd=   2.5 gini=0.344 top10=100.0%` |
| hint/venue/overall | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/venue/overall | `sig=    9 hit=   0 net=     -9 roi= -100.0% wr=  0.0% dd=    9 pos= 0/2  mean=  -4.5 sd=   0.5 gini=0.056 top10=100.0%` |

### Support x Action
| key | summary |
|---|---:|
| watch/block | `sig=  662 hit=  22 net=    130 roi=   19.6% wr=  3.3% dd=  125 pos=10/31 mean=   4.2 sd=  26.0 gini=0.551 top10=80.2%` |
| watch/baseline | `sig=  459 hit=  12 net=    -27 roi=   -5.9% wr=  2.6% dd=  125 pos= 6/25 mean=  -1.1 sd=  15.6 gini=0.415 top10=81.7%` |
| watch/enhance | `sig=  188 hit=   8 net=    100 roi=   53.2% wr=  4.3% dd=   62 pos= 4/8  mean=  12.5 sd=  46.9 gini=0.507 top10=100.0%` |
| watch/observe | `sig=  187 hit=  10 net=    173 roi=   92.5% wr=  5.3% dd=   82 pos= 2/6  mean=  28.8 sd=  84.8 gini=0.629 top10=100.0%` |
| strong/baseline | `sig=  153 hit=   0 net=   -153 roi= -100.0% wr=  0.0% dd=  153 pos= 0/13 mean= -11.8 sd=  11.8 gini=0.530 top10=97.4%` |
| unknown/baseline | `sig=  145 hit=   6 net=     71 roi=   49.0% wr=  4.1% dd=   43 pos= 6/12 mean=   5.9 sd=  17.0 gini=0.361 top10=97.9%` |
| conflict/baseline | `sig=  137 hit=   2 net=    -65 roi=  -47.4% wr=  1.5% dd=  102 pos= 2/14 mean=  -4.6 sd=  12.6 gini=0.590 top10=97.1%` |
| support/baseline | `sig=  118 hit=   4 net=     26 roi=   22.0% wr=  3.4% dd=   55 pos= 2/10 mean=   2.6 sd=  26.0 gini=0.568 top10=100.0%` |
| unknown/block | `sig=  106 hit=   1 net=    -70 roi=  -66.0% wr=  0.9% dd=   75 pos= 1/10 mean=  -7.0 sd=   4.5 gini=0.317 top10=100.0%` |
| conflict/block | `sig=   98 hit=   4 net=     46 roi=   46.9% wr=  4.1% dd=   42 pos= 3/12 mean=   3.8 sd=  20.0 gini=0.534 top10=95.9%` |
| support/observe | `sig=   71 hit=   4 net=     73 roi=  102.8% wr=  5.6% dd=   27 pos= 3/5  mean=  14.6 sd=  14.7 gini=0.414 top10=100.0%` |
| watch/hint | `sig=   71 hit=   2 net=      1 roi=    1.4% wr=  2.8% dd=   60 pos= 1/2  mean=   0.5 sd=  25.5 gini=0.010 top10=100.0%` |
| conflict/enhance | `sig=   61 hit=   0 net=    -61 roi= -100.0% wr=  0.0% dd=   61 pos= 0/4  mean= -15.3 sd=   7.7 gini=0.266 top10=100.0%` |
| strong/enhance | `sig=   47 hit=   2 net=     25 roi=   53.2% wr=  4.3% dd=   45 pos= 1/7  mean=   3.6 sd=  26.4 gini=0.546 top10=100.0%` |
| conflict/observe | `sig=   45 hit=   1 net=     -9 roi=  -20.0% wr=  2.2% dd=   44 pos= 1/6  mean=  -1.5 sd=  18.0 gini=0.487 top10=100.0%` |
| support/block | `sig=   42 hit=   2 net=     30 roi=   71.4% wr=  4.8% dd=   32 pos= 2/10 mean=   3.0 sd=  15.2 gini=0.610 top10=100.0%` |
| strong/block | `sig=   41 hit=   2 net=     31 roi=   75.6% wr=  4.9% dd=   19 pos= 2/6  mean=   5.2 sd=  14.1 gini=0.470 top10=100.0%` |
| conflict/hint | `sig=   31 hit=   0 net=    -31 roi= -100.0% wr=  0.0% dd=   31 pos= 0/4  mean=  -7.8 sd=   7.2 gini=0.460 top10=100.0%` |
| support/enhance | `sig=   27 hit=   0 net=    -27 roi= -100.0% wr=  0.0% dd=   27 pos= 0/4  mean=  -6.8 sd=   3.8 gini=0.306 top10=100.0%` |
| unknown/enhance | `sig=   19 hit=   0 net=    -19 roi= -100.0% wr=  0.0% dd=   19 pos= 0/1  mean= -19.0 sd=   0.0 gini=0.000 top10=100.0%` |
| strong/hint | `sig=   15 hit=   2 net=     57 roi=  380.0% wr= 13.3% dd=   13 pos= 1/3  mean=  19.0 sd=  36.3 gini=0.554 top10=100.0%` |
| strong/observe | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/3  mean=  -5.0 sd=   2.9 gini=0.311 top10=100.0%` |
| support/hint | `sig=   11 hit=   0 net=    -11 roi= -100.0% wr=  0.0% dd=   11 pos= 0/3  mean=  -3.7 sd=   2.1 gini=0.303 top10=100.0%` |
| unknown/observe | `sig=    7 hit=   1 net=     29 roi=  414.3% wr= 14.3% dd=    5 pos= 1/2  mean=  14.5 sd=  18.5 gini=0.392 top10=100.0%` |
| unknown/hint | `sig=    7 hit=   0 net=     -7 roi= -100.0% wr=  0.0% dd=    7 pos= 0/2  mean=  -3.5 sd=   0.5 gini=0.071 top10=100.0%` |

### Realized ROI by Historical Calibration ROI Band
| key | summary |
|---|---:|
| none/baseline | `sig= 1012 hit=  24 net=   -148 roi=  -14.6% wr=  2.4% dd=  299 pos=11/33 mean=  -4.5 sd=  32.3 gini=0.566 top10=79.3%` |
| <-50/block | `sig=  619 hit=  20 net=    101 roi=   16.3% wr=  3.2% dd=  134 pos= 8/24 mean=   4.2 sd=  33.8 gini=0.554 top10=82.7%` |
| >=35/enhance | `sig=  342 hit=  10 net=     18 roi=    5.3% wr=  2.9% dd=  102 pos= 5/13 mean=   1.4 sd=  39.7 gini=0.494 top10=95.6%` |
| 10..35/observe | `sig=  325 hit=  16 net=    251 roi=   77.2% wr=  4.9% dd=   98 pos= 5/16 mean=  15.7 sd=  54.5 gini=0.685 top10=96.0%` |
| -50..-20/block | `sig=  169 hit=   7 net=     83 roi=   49.1% wr=  4.1% dd=   48 pos= 5/21 mean=   4.0 sd=  18.4 gini=0.647 top10=90.5%` |
| -20..-5/block | `sig=  161 hit=   4 net=    -17 roi=  -10.6% wr=  2.5% dd=   80 pos= 4/14 mean=  -1.2 sd=  12.2 gini=0.445 top10=94.4%` |
| -5..10/hint | `sig=  135 hit=   4 net=      9 roi=    6.7% wr=  3.0% dd=  120 pos= 2/11 mean=   0.8 sd=  25.5 gini=0.559 top10=99.3%` |

### Top Calibration Buckets, min 25 signals
| key | summary |
|---|---:|
| baseline/none/none | `sig= 1012 hit=  24 net=   -148 roi=  -14.6% wr=  2.4% dd=  299 pos=11/33 mean=  -4.5 sd=  32.3 gini=0.566 top10=79.3%` |
| observe/venue:澳门永利/澳门永利 | `sig=  199 hit=  10 net=    161 roi=   80.9% wr=  5.0% dd=   98 pos= 1/3  mean=  53.7 sd= 111.6 gini=0.501 top10=100.0%` |
| block/table:auto_02/自动画像2 | `sig=  189 hit=   6 net=     27 roi=   14.3% wr=  3.2% dd=   86 pos= 5/14 mean=   1.9 sd=  18.6 gini=0.417 top10=95.8%` |
| block/table:auto_19/自动画像19 | `sig=  167 hit=   3 net=    -59 roi=  -35.3% wr=  1.8% dd=  107 pos= 1/4  mean= -14.8 sd=  31.3 gini=0.340 top10=100.0%` |
| block/table:auto_37/自动画像37 | `sig=  164 hit=   4 net=    -20 roi=  -12.2% wr=  2.4% dd=   93 pos= 0/1  mean= -20.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_01/自动画像1 | `sig=  150 hit=   6 net=     66 roi=   44.0% wr=  4.0% dd=   47 pos= 2/7  mean=   9.4 sd=  26.9 gini=0.631 top10=100.0%` |
| hint/table:auto_05/自动画像5 | `sig=   95 hit=   1 net=    -59 roi=  -62.1% wr=  1.1% dd=   94 pos= 0/4  mean= -14.8 sd=   9.8 gini=0.343 top10=100.0%` |
| enhance/table:auto_01/自动画像1 | `sig=   81 hit=   3 net=     27 roi=   33.3% wr=  3.7% dd=   27 pos= 2/4  mean=   6.8 sd=  18.5 gini=0.532 top10=100.0%` |
| enhance/table:auto_53/自动画像53 | `sig=   69 hit=   4 net=     75 roi=  108.7% wr=  5.8% dd=   32 pos= 1/1  mean=  75.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_05/自动画像5 | `sig=   69 hit=   3 net=     39 roi=   56.5% wr=  4.3% dd=   29 pos= 3/8  mean=   4.9 sd=  10.7 gini=0.546 top10=100.0%` |
| observe/table:auto_05/自动画像5 | `sig=   64 hit=   2 net=      8 roi=   12.5% wr=  3.1% dd=   51 pos= 1/1  mean=   8.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/table:auto_45/自动画像45 | `sig=   60 hit=   0 net=    -60 roi= -100.0% wr=  0.0% dd=   60 pos= 0/1  mean= -60.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_06/自动画像6 | `sig=   56 hit=   5 net=    124 roi=  221.4% wr=  8.9% dd=   21 pos= 2/7  mean=  17.7 sd=  38.6 gini=0.607 top10=100.0%` |
| enhance/venue:澳门永利/澳门永利 | `sig=   54 hit=   0 net=    -54 roi= -100.0% wr=  0.0% dd=   54 pos= 0/3  mean= -18.0 sd=   4.9 gini=0.148 top10=100.0%` |
| block/table:auto_32/自动画像32 | `sig=   36 hit=   1 net=      0 roi=    0.0% wr=  2.8% dd=   21 pos= 0/1  mean=   0.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/venue:巴黎人/巴黎人 | `sig=   34 hit=   1 net=      2 roi=    5.9% wr=  2.9% dd=   17 pos= 1/1  mean=   2.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/table:auto_19/自动画像19 | `sig=   29 hit=   0 net=    -29 roi= -100.0% wr=  0.0% dd=   29 pos= 0/1  mean= -29.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Auto Assignment Source
| key | summary |
|---|---:|
| auto/block | `sig=  834 hit=  30 net=    246 roi=   29.5% wr=  3.6% dd=  127 pos=12/36 mean=   6.8 sd=  30.0 gini=0.570 top10=73.6%` |
| auto/baseline | `sig=  741 hit=  16 net=   -165 roi=  -22.3% wr=  2.2% dd=  252 pos= 7/26 mean=  -6.3 sd=  32.2 gini=0.561 top10=84.8%` |
| auto/observe | `sig=  318 hit=  15 net=    222 roi=   69.8% wr=  4.7% dd=   98 pos= 4/14 mean=  15.9 sd=  57.9 gini=0.701 top10=98.1%` |
| auto/enhance | `sig=  316 hit=  10 net=     44 roi=   13.9% wr=  3.2% dd=  102 pos= 5/13 mean=   3.4 sd=  38.8 gini=0.533 top10=96.2%` |
| none/baseline | `sig=  271 hit=   8 net=     17 roi=    6.3% wr=  3.0% dd=   76 pos= 5/17 mean=   1.0 sd=  14.1 gini=0.497 top10=93.7%` |
| auto/hint | `sig=  128 hit=   4 net=     16 roi=   12.5% wr=  3.1% dd=  113 pos= 2/10 mean=   1.6 sd=  26.6 gini=0.553 top10=100.0%` |
| none/block | `sig=  115 hit=   1 net=    -79 roi=  -68.7% wr=  0.9% dd=   84 pos= 1/10 mean=  -7.9 sd=   5.8 gini=0.372 top10=100.0%` |
| none/enhance | `sig=   26 hit=   0 net=    -26 roi= -100.0% wr=  0.0% dd=   26 pos= 0/1  mean= -26.0 sd=   0.0 gini=0.000 top10=100.0%` |
| none/observe | `sig=    7 hit=   1 net=     29 roi=  414.3% wr= 14.3% dd=    5 pos= 1/2  mean=  14.5 sd=  18.5 gini=0.392 top10=100.0%` |
| none/hint | `sig=    7 hit=   0 net=     -7 roi= -100.0% wr=  0.0% dd=    7 pos= 0/2  mean=  -3.5 sd=   0.5 gini=0.071 top10=100.0%` |
