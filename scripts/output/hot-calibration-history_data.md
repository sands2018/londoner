# Hot Calibration Walk-Forward Report: history_data.json

- file: `HistoryData\history_data.json`
- sessions: 76
- spins: 24812
- manual table-tagged sessions: 0
- ROI scope: betting-zone only, index >= 200
- no-future rule: session N uses only sessions 1..N-1 for calibration/profile state; each current hot signal uses only numbers before that signal for current table matching.
- table modes:
  - legacy-match: current signal uses prefix-only profile matching, without forcing an auto table assignment.
  - auto-prefix: current signal first runs new automatic table assignment on the prefix only, then uses that assigned table if available.

## Auto-Prefix vs Legacy-Match Delta
| action | legacy-match | auto-prefix | delta net | delta roi pp | delta signals |
|---|---:|---:|---:|---:|---:|
| enhance | `sig=  263 hit=  13 net=    205 roi=   77.9% wr=  4.9% dd=   55 pos= 6/13 mean=  15.8 sd=  36.7 gini=0.427 top10=94.7%` | `sig=  410 hit=  16 net=    166 roi=   40.5% wr=  3.9% dd=   75 pos= 7/16 mean=  10.4 sd=  35.8 gini=0.455 top10=90.5%` | -39 | -37.5 | 147 |
| baseline | `sig=  843 hit=  11 net=   -447 roi=  -53.0% wr=  1.3% dd=  447 pos= 3/25 mean= -17.9 sd=  34.0 gini=0.456 top10=76.9%` | `sig=  613 hit=   7 net=   -361 roi=  -58.9% wr=  1.1% dd=  378 pos= 2/21 mean= -17.2 sd=  32.6 gini=0.530 top10=86.9%` | 86 | -5.9 | -230 |
| observe | `sig=  179 hit=   9 net=    145 roi=   81.0% wr=  5.0% dd=   54 pos= 4/8  mean=  18.1 sd=  28.3 gini=0.517 top10=100.0%` | `sig=  367 hit=  12 net=     65 roi=   17.7% wr=  3.3% dd=  207 pos= 3/10 mean=   6.5 sd=  52.1 gini=0.548 top10=100.0%` | -80 | -63.3 | 188 |
| hint | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` | 5 | 100.0 | -5 |
| block | `sig= 1020 hit=  39 net=    384 roi=   37.6% wr=  3.8% dd=  119 pos=15/31 mean=  12.4 sd=  44.9 gini=0.543 top10=72.3%` | `sig=  920 hit=  37 net=    412 roi=   44.8% wr=  4.0% dd=   83 pos=14/27 mean=  15.3 sd=  40.4 gini=0.491 top10=73.5%` | 28 | 7.1 | -100 |

### Changed Event Summary
| changed set | summary |
|---|---:|
| all changed events | `sig=  808 hit=  18 net=   -160 roi=  -19.8% wr=  2.2% dd=  252 pos= 4/21 mean=  -7.6 sd=  32.8 gini=0.509 top10=89.4%` |
| changed into enhance | `sig=  233 hit=   5 net=    -53 roi=  -22.7% wr=  2.1% dd=  110 pos= 2/12 mean=  -4.4 sd=  21.7 gini=0.538 top10=98.7%` |
| changed into baseline | `sig=   35 hit=   0 net=    -35 roi= -100.0% wr=  0.0% dd=   35 pos= 0/1  mean= -35.0 sd=   0.0 gini=0.000 top10=100.0%` |
| changed into observe | `sig=  296 hit=   9 net=     28 roi=    9.5% wr=  3.0% dd=  174 pos= 1/6  mean=   4.7 sd=  62.7 gini=0.517 top10=100.0%` |
| changed into hint | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` |
| changed into block | `sig=  244 hit=   4 net=   -100 roi=  -41.0% wr=  1.6% dd=  100 pos= 1/11 mean=  -9.1 sd=  15.8 gini=0.418 top10=98.8%` |

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
| enhance | `sig=   74 hit=   5 net=    106 roi=  143.2% wr=  6.8% dd=   43 pos= 3/6  mean=  17.7 sd=  33.3 gini=0.413 top10=100.0%` | `sig=  221 hit=   8 net=     67 roi=   30.3% wr=  3.6% dd=   61 pos= 4/6  mean=  11.2 sd=  35.7 gini=0.274 top10=100.0%` | -39 | -112.9 | 147 |
| baseline | `sig=  150 hit=   3 net=    -42 roi=  -28.0% wr=  2.0% dd=   72 pos= 1/5  mean=  -8.4 sd=  24.6 gini=0.298 top10=100.0%` | `sig=  104 hit=   1 net=    -68 roi=  -65.4% wr=  1.0% dd=   85 pos= 0/4  mean= -17.0 sd=  11.0 gini=0.338 top10=100.0%` | -26 | -37.4 | -46 |
| observe | `sig=   63 hit=   4 net=     81 roi=  128.6% wr=  6.3% dd=   27 pos= 3/5  mean=  16.2 sd=  25.4 gini=0.364 top10=100.0%` | `sig=  143 hit=   9 net=    181 roi=  126.6% wr=  6.3% dd=   32 pos= 3/6  mean=  30.2 sd=  52.4 gini=0.571 top10=100.0%` | 100 | -2.0 | 80 |
| hint | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` | 0 | 0.0 | 0 |
| block | `sig=  403 hit=  17 net=    209 roi=   51.9% wr=  4.2% dd=   78 pos= 4/8  mean=  26.1 sd=  65.1 gini=0.542 top10=100.0%` | `sig=  222 hit=  11 net=    174 roi=   78.4% wr=  5.0% dd=   47 pos= 3/6  mean=  29.0 sd=  48.9 gini=0.472 top10=100.0%` | -35 | 26.5 | -181 |

### Latest 10 Legacy Action ROI
| bucket | summary |
|---|---:|
| enhance | `sig=   74 hit=   5 net=    106 roi=  143.2% wr=  6.8% dd=   43 pos= 3/6  mean=  17.7 sd=  33.3 gini=0.413 top10=100.0%` |
| baseline | `sig=  150 hit=   3 net=    -42 roi=  -28.0% wr=  2.0% dd=   72 pos= 1/5  mean=  -8.4 sd=  24.6 gini=0.298 top10=100.0%` |
| observe | `sig=   63 hit=   4 net=     81 roi=  128.6% wr=  6.3% dd=   27 pos= 3/5  mean=  16.2 sd=  25.4 gini=0.364 top10=100.0%` |
| hint | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` |
| block | `sig=  403 hit=  17 net=    209 roi=   51.9% wr=  4.2% dd=   78 pos= 4/8  mean=  26.1 sd=  65.1 gini=0.542 top10=100.0%` |

### Latest 10 Auto-Prefix Action ROI
| bucket | summary |
|---|---:|
| enhance | `sig=  221 hit=   8 net=     67 roi=   30.3% wr=  3.6% dd=   61 pos= 4/6  mean=  11.2 sd=  35.7 gini=0.274 top10=100.0%` |
| baseline | `sig=  104 hit=   1 net=    -68 roi=  -65.4% wr=  1.0% dd=   85 pos= 0/4  mean= -17.0 sd=  11.0 gini=0.338 top10=100.0%` |
| observe | `sig=  143 hit=   9 net=    181 roi=  126.6% wr=  6.3% dd=   32 pos= 3/6  mean=  30.2 sd=  52.4 gini=0.571 top10=100.0%` |
| hint | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` |
| block | `sig=  222 hit=  11 net=    174 roi=   78.4% wr=  5.0% dd=   47 pos= 3/6  mean=  29.0 sd=  48.9 gini=0.472 top10=100.0%` |

### Latest 10 Plan ROI
| bucket | summary |
|---|---:|
| legacy raw-all | `sig=  690 hit=  29 net=    354 roi=   51.3% wr=  4.2% dd=   99 pos= 6/8  mean=  44.3 sd=  78.4 gini=0.368 top10=100.0%` |
| legacy default-visible | `sig=  287 hit=  12 net=    145 roi=   50.5% wr=  4.2% dd=   59 pos= 5/8  mean=  18.1 sd=  40.1 gini=0.314 top10=100.0%` |
| legacy hidden | `sig=  403 hit=  17 net=    209 roi=   51.9% wr=  4.2% dd=   78 pos= 4/8  mean=  26.1 sd=  65.1 gini=0.542 top10=100.0%` |
| auto raw-all | `sig=  690 hit=  29 net=    354 roi=   51.3% wr=  4.2% dd=   99 pos= 6/8  mean=  44.3 sd=  78.4 gini=0.368 top10=100.0%` |
| auto default-visible | `sig=  468 hit=  18 net=    180 roi=   38.5% wr=  3.8% dd=   93 pos= 5/8  mean=  22.5 sd=  56.4 gini=0.378 top10=100.0%` |
| auto hidden | `sig=  222 hit=  11 net=    174 roi=   78.4% wr=  5.0% dd=   47 pos= 3/6  mean=  29.0 sd=  48.9 gini=0.472 top10=100.0%` |

### Latest 10 Changed Event Summary
| changed set | summary |
|---|---:|
| all changed events | `sig=  330 hit=   9 net=     -6 roi=   -1.8% wr=  2.7% dd=  145 pos= 2/8  mean=  -0.8 sd=  45.3 gini=0.494 top10=100.0%` |
| changed into enhance | `sig=  176 hit=   3 net=    -68 roi=  -38.6% wr=  1.7% dd=  110 pos= 1/5  mean= -13.6 sd=  23.2 gini=0.389 top10=100.0%` |
| changed into baseline | `sig=   35 hit=   0 net=    -35 roi= -100.0% wr=  0.0% dd=   35 pos= 0/1  mean= -35.0 sd=   0.0 gini=0.000 top10=100.0%` |
| changed into observe | `sig=  105 hit=   6 net=    111 roi=  105.7% wr=  5.7% dd=   35 pos= 1/3  mean=  37.0 sd=  73.5 gini=0.491 top10=100.0%` |
| changed into hint | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` |
| changed into block | `sig=   14 hit=   0 net=    -14 roi= -100.0% wr=  0.0% dd=   14 pos= 0/2  mean=  -7.0 sd=   4.0 gini=0.286 top10=100.0%` |

### Latest 10 Legacy by Session/Action
| key | summary |
|---|---:|
| 20260603-0030-澳门永利/block | `sig=  136 hit=   8 net=    152 roi=  111.8% wr=  5.9% dd=   39 pos= 1/1  mean= 152.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/baseline | `sig=   72 hit=   1 net=    -36 roi=  -50.0% wr=  1.4% dd=   46 pos= 0/1  mean= -36.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/block | `sig=   65 hit=   5 net=    115 roi=  176.9% wr=  7.7% dd=   21 pos= 1/1  mean= 115.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/block | `sig=   63 hit=   2 net=      9 roi=   14.3% wr=  3.2% dd=   35 pos= 1/1  mean=   9.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/block | `sig=   55 hit=   1 net=    -19 roi=  -34.5% wr=  1.8% dd=   31 pos= 0/1  mean= -19.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/block | `sig=   45 hit=   0 net=    -45 roi= -100.0% wr=  0.0% dd=   45 pos= 0/1  mean= -45.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/baseline | `sig=   36 hit=   2 net=     36 roi=  100.0% wr=  5.6% dd=   28 pos= 1/1  mean=  36.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/baseline | `sig=   25 hit=   0 net=    -25 roi= -100.0% wr=  0.0% dd=   25 pos= 0/1  mean= -25.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/observe | `sig=   22 hit=   1 net=     14 roi=   63.6% wr=  4.5% dd=   16 pos= 1/1  mean=  14.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/enhance | `sig=   21 hit=   0 net=    -21 roi= -100.0% wr=  0.0% dd=   21 pos= 0/1  mean= -21.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260604-1630-澳门永利/block | `sig=   18 hit=   1 net=     18 roi=  100.0% wr=  5.6% dd=   15 pos= 1/1  mean=  18.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/enhance | `sig=   17 hit=   2 net=     55 roi=  323.5% wr= 11.8% dd=   10 pos= 1/1  mean=  55.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/observe | `sig=   17 hit=   2 net=     55 roi=  323.5% wr= 11.8% dd=   12 pos= 1/1  mean=  55.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/enhance | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/block | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/enhance | `sig=   14 hit=   1 net=     22 roi=  157.1% wr=  7.1% dd=    9 pos= 1/1  mean=  22.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/observe | `sig=   11 hit=   0 net=    -11 roi= -100.0% wr=  0.0% dd=   11 pos= 0/1  mean= -11.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/baseline | `sig=   11 hit=   0 net=    -11 roi= -100.0% wr=  0.0% dd=   11 pos= 0/1  mean= -11.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/observe | `sig=   10 hit=   0 net=    -10 roi= -100.0% wr=  0.0% dd=   10 pos= 0/1  mean= -10.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/enhance | `sig=    6 hit=   2 net=     66 roi= 1100.0% wr= 33.3% dd=    2 pos= 1/1  mean=  66.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/baseline | `sig=    6 hit=   0 net=     -6 roi= -100.0% wr=  0.0% dd=    6 pos= 0/1  mean=  -6.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/block | `sig=    6 hit=   0 net=     -6 roi= -100.0% wr=  0.0% dd=    6 pos= 0/1  mean=  -6.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260604-1630-澳门永利/observe | `sig=    3 hit=   1 net=     33 roi= 1100.0% wr= 33.3% dd=    1 pos= 1/1  mean=  33.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/enhance | `sig=    1 hit=   0 net=     -1 roi= -100.0% wr=  0.0% dd=    1 pos= 0/1  mean=  -1.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Latest 10 Auto by Session/Action
| key | summary |
|---|---:|
| 20260603-0030-澳门永利/observe | `sig=   81 hit=   6 net=    135 roi=  166.7% wr=  7.4% dd=   32 pos= 1/1  mean= 135.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/enhance | `sig=   69 hit=   3 net=     39 roi=   56.5% wr=  4.3% dd=   61 pos= 1/1  mean=  39.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/block | `sig=   65 hit=   5 net=    115 roi=  176.9% wr=  7.7% dd=   21 pos= 1/1  mean= 115.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/enhance | `sig=   55 hit=   0 net=    -55 roi= -100.0% wr=  0.0% dd=   55 pos= 0/1  mean= -55.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/block | `sig=   53 hit=   1 net=    -17 roi=  -32.1% wr=  1.9% dd=   31 pos= 0/1  mean= -17.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/enhance | `sig=   52 hit=   2 net=     20 roi=   38.5% wr=  3.8% dd=   32 pos= 1/1  mean=  20.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/block | `sig=   42 hit=   3 net=     66 roi=  157.1% wr=  7.1% dd=   26 pos= 1/1  mean=  66.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/baseline | `sig=   42 hit=   1 net=     -6 roi=  -14.3% wr=  2.4% dd=   34 pos= 0/1  mean=  -6.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/block | `sig=   39 hit=   1 net=     -3 roi=   -7.7% wr=  2.6% dd=   22 pos= 0/1  mean=  -3.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/baseline | `sig=   35 hit=   0 net=    -35 roi= -100.0% wr=  0.0% dd=   35 pos= 0/1  mean= -35.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/block | `sig=   20 hit=   0 net=    -20 roi= -100.0% wr=  0.0% dd=   20 pos= 0/1  mean= -20.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/enhance | `sig=   19 hit=   2 net=     53 roi=  278.9% wr= 10.5% dd=   10 pos= 1/1  mean=  53.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260604-1630-澳门永利/observe | `sig=   18 hit=   1 net=     18 roi=  100.0% wr=  5.6% dd=   13 pos= 1/1  mean=  18.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-2101-澳门永利/observe | `sig=   17 hit=   2 net=     55 roi=  323.5% wr= 11.8% dd=   12 pos= 1/1  mean=  55.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260605-0230-澳门永利/baseline | `sig=   16 hit=   0 net=    -16 roi= -100.0% wr=  0.0% dd=   16 pos= 0/1  mean= -16.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/observe | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0030-澳门永利/enhance | `sig=   14 hit=   1 net=     22 roi=  157.1% wr=  7.1% dd=    9 pos= 1/1  mean=  22.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260603-0230-澳门永利/enhance | `sig=   12 hit=   0 net=    -12 roi= -100.0% wr=  0.0% dd=   12 pos= 0/1  mean= -12.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260601-1630-澳门永利/observe | `sig=   11 hit=   0 net=    -11 roi= -100.0% wr=  0.0% dd=   11 pos= 0/1  mean= -11.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260607-0217-澳门永利/baseline | `sig=   11 hit=   0 net=    -11 roi= -100.0% wr=  0.0% dd=   11 pos= 0/1  mean= -11.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260604-1630-澳门永利/block | `sig=    3 hit=   1 net=     33 roi= 1100.0% wr= 33.3% dd=    2 pos= 1/1  mean=  33.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 20260606-0131-澳门永利/observe | `sig=    1 hit=   0 net=     -1 roi= -100.0% wr=  0.0% dd=    1 pos= 0/1  mean=  -1.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Latest 10 Auto Assignment Source
| key | summary |
|---|---:|
| auto/enhance | `sig=  219 hit=   8 net=     69 roi=   31.5% wr=  3.7% dd=   61 pos= 4/6  mean=  11.5 sd=  35.1 gini=0.269 top10=100.0%` |
| auto/block | `sig=  166 hit=  10 net=    194 roi=  116.9% wr=  6.0% dd=   31 pos= 3/5  mean=  38.8 sd=  40.4 gini=0.484 top10=100.0%` |
| auto/observe | `sig=  139 hit=   9 net=    185 roi=  133.1% wr=  6.5% dd=   32 pos= 3/6  mean=  30.8 sd=  51.9 gini=0.589 top10=100.0%` |
| auto/baseline | `sig=   84 hit=   1 net=    -48 roi=  -57.1% wr=  1.2% dd=   76 pos= 0/3  mean= -16.0 sd=  13.4 gini=0.403 top10=100.0%` |
| none/block | `sig=   56 hit=   1 net=    -20 roi=  -35.7% wr=  1.8% dd=   43 pos= 1/4  mean=  -5.0 sd=  14.6 gini=0.198 top10=100.0%` |
| none/baseline | `sig=   20 hit=   0 net=    -20 roi= -100.0% wr=  0.0% dd=   20 pos= 0/2  mean= -10.0 sd=   1.0 gini=0.050 top10=100.0%` |
| none/observe | `sig=    4 hit=   0 net=     -4 roi= -100.0% wr=  0.0% dd=    4 pos= 0/1  mean=  -4.0 sd=   0.0 gini=0.000 top10=100.0%` |
| none/enhance | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Latest 10 Auto Support x Action
| key | summary |
|---|---:|
| watch/block | `sig=  123 hit=   7 net=    129 roi=  104.9% wr=  5.7% dd=   31 pos= 4/5  mean=  25.8 sd=  18.5 gini=0.361 top10=100.0%` |
| watch/observe | `sig=  107 hit=   6 net=    109 roi=  101.9% wr=  5.6% dd=   32 pos= 1/3  mean=  36.3 sd=  69.8 gini=0.513 top10=100.0%` |
| watch/enhance | `sig=  101 hit=   3 net=      7 roi=    6.9% wr=  3.0% dd=   72 pos= 1/3  mean=   2.3 sd=  28.8 gini=0.219 top10=100.0%` |
| conflict/enhance | `sig=   56 hit=   3 net=     52 roi=   92.9% wr=  5.4% dd=   31 pos= 2/4  mean=  13.0 sd=  29.7 gini=0.289 top10=100.0%` |
| unknown/block | `sig=   56 hit=   1 net=    -20 roi=  -35.7% wr=  1.8% dd=   43 pos= 1/4  mean=  -5.0 sd=  14.6 gini=0.198 top10=100.0%` |
| support/enhance | `sig=   48 hit=   0 net=    -48 roi= -100.0% wr=  0.0% dd=   48 pos= 0/5  mean=  -9.6 sd=   2.9 gini=0.150 top10=100.0%` |
| watch/baseline | `sig=   43 hit=   0 net=    -43 roi= -100.0% wr=  0.0% dd=   43 pos= 0/2  mean= -21.5 sd=   5.5 gini=0.128 top10=100.0%` |
| conflict/block | `sig=   33 hit=   1 net=      3 roi=    9.1% wr=  3.0% dd=   23 pos= 1/3  mean=   1.0 sd=  17.0 gini=0.213 top10=100.0%` |
| conflict/baseline | `sig=   26 hit=   1 net=     10 roi=   38.5% wr=  3.8% dd=   20 pos= 1/2  mean=   5.0 sd=  16.0 gini=0.156 top10=100.0%` |
| strong/baseline | `sig=   20 hit=   0 net=    -20 roi= -100.0% wr=  0.0% dd=   20 pos= 0/1  mean= -20.0 sd=   0.0 gini=0.000 top10=100.0%` |
| strong/observe | `sig=   17 hit=   2 net=     55 roi=  323.5% wr= 11.8% dd=   12 pos= 1/1  mean=  55.0 sd=   0.0 gini=0.000 top10=100.0%` |
| strong/enhance | `sig=   14 hit=   2 net=     58 roi=  414.3% wr= 14.3% dd=   12 pos= 1/3  mean=  19.3 sd=  35.9 gini=0.537 top10=100.0%` |
| support/observe | `sig=   11 hit=   0 net=    -11 roi= -100.0% wr=  0.0% dd=   11 pos= 0/2  mean=  -5.5 sd=   4.5 gini=0.409 top10=100.0%` |
| unknown/baseline | `sig=   11 hit=   0 net=    -11 roi= -100.0% wr=  0.0% dd=   11 pos= 0/1  mean= -11.0 sd=   0.0 gini=0.000 top10=100.0%` |
| strong/block | `sig=    8 hit=   2 net=     64 roi=  800.0% wr= 25.0% dd=    5 pos= 1/2  mean=  32.0 sd=  35.0 gini=0.457 top10=100.0%` |
| conflict/observe | `sig=    8 hit=   1 net=     28 roi=  350.0% wr= 12.5% dd=    5 pos= 1/1  mean=  28.0 sd=   0.0 gini=0.000 top10=100.0%` |
| support/baseline | `sig=    4 hit=   0 net=     -4 roi= -100.0% wr=  0.0% dd=    4 pos= 0/1  mean=  -4.0 sd=   0.0 gini=0.000 top10=100.0%` |
| unknown/enhance | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |
| support/block | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Latest 10 Auto Calibration Buckets, min 10 signals
| key | summary |
|---|---:|
| enhance/venue:澳门永利/澳门永利 | `sig=  123 hit=   1 net=    -87 roi=  -70.7% wr=  0.8% dd=  120 pos= 0/3  mean= -29.0 sd=  14.8 gini=0.276 top10=100.0%` |
| baseline/none/none | `sig=  104 hit=   1 net=    -68 roi=  -65.4% wr=  1.0% dd=   85 pos= 0/4  mean= -17.0 sd=  11.0 gini=0.338 top10=100.0%` |
| observe/venue:澳门永利/澳门永利 | `sig=   90 hit=   6 net=    126 roi=  140.0% wr=  6.7% dd=   26 pos= 1/2  mean=  63.0 sd=  78.0 gini=0.404 top10=100.0%` |
| block/table:auto_15/自动画像15 | `sig=   56 hit=   5 net=    124 roi=  221.4% wr=  8.9% dd=   21 pos= 1/1  mean= 124.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/table:auto_25/自动画像25 | `sig=   51 hit=   2 net=     21 roi=   41.2% wr=  3.9% dd=   32 pos= 1/1  mean=  21.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_01/自动画像1 | `sig=   45 hit=   1 net=     -9 roi=  -20.0% wr=  2.2% dd=   31 pos= 0/1  mean=  -9.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_12/自动画像12 | `sig=   34 hit=   1 net=      2 roi=    5.9% wr=  2.9% dd=   22 pos= 1/2  mean=   1.0 sd=   7.0 gini=0.071 top10=100.0%` |
| enhance/table:auto_01/自动画像1 | `sig=   19 hit=   2 net=     53 roi=  278.9% wr= 10.5% dd=   10 pos= 1/1  mean=  53.0 sd=   0.0 gini=0.000 top10=100.0%` |
| observe/table:auto_08/自动画像8 | `sig=   17 hit=   2 net=     55 roi=  323.5% wr= 11.8% dd=   12 pos= 1/1  mean=  55.0 sd=   0.0 gini=0.000 top10=100.0%` |
| observe/table:auto_18/自动画像18 | `sig=   17 hit=   0 net=    -17 roi= -100.0% wr=  0.0% dd=   17 pos= 0/2  mean=  -8.5 sd=   2.5 gini=0.147 top10=100.0%` |
| block/table:auto_16/自动画像16 | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_20/自动画像20 | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/2  mean=  -7.5 sd=   4.5 gini=0.300 top10=100.0%` |
| observe/table:auto_23/自动画像23 | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_18/自动画像18 | `sig=   14 hit=   1 net=     22 roi=  157.1% wr=  7.1% dd=   12 pos= 1/2  mean=  11.0 sd=  14.0 gini=0.393 top10=100.0%` |
| enhance/venue:wzs/wzs | `sig=   14 hit=   1 net=     22 roi=  157.1% wr=  7.1% dd=    9 pos= 1/1  mean=  22.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/venue:wzs/wzs | `sig=   13 hit=   2 net=     59 roi=  453.8% wr= 15.4% dd=   11 pos= 1/1  mean=  59.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/venue:澳门永利/澳门永利 | `sig=   11 hit=   0 net=    -11 roi= -100.0% wr=  0.0% dd=   11 pos= 0/1  mean= -11.0 sd=   0.0 gini=0.000 top10=100.0%` |

## legacy-match

### Action ROI
| bucket | summary |
|---|---:|
| enhance | `sig=  263 hit=  13 net=    205 roi=   77.9% wr=  4.9% dd=   55 pos= 6/13 mean=  15.8 sd=  36.7 gini=0.427 top10=94.7%` |
| baseline | `sig=  843 hit=  11 net=   -447 roi=  -53.0% wr=  1.3% dd=  447 pos= 3/25 mean= -17.9 sd=  34.0 gini=0.456 top10=76.9%` |
| observe | `sig=  179 hit=   9 net=    145 roi=   81.0% wr=  5.0% dd=   54 pos= 4/8  mean=  18.1 sd=  28.3 gini=0.517 top10=100.0%` |
| hint | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block | `sig= 1020 hit=  39 net=    384 roi=   37.6% wr=  3.8% dd=  119 pos=15/31 mean=  12.4 sd=  44.9 gini=0.543 top10=72.3%` |

### Plan ROI
| bucket | summary |
|---|---:|
| raw-all | `sig= 2310 hit=  72 net=    282 roi=   12.2% wr=  3.1% dd=  319 pos=17/43 mean=   6.6 sd=  57.5 gini=0.520 top10=56.1%` |
| default-visible(enhance+baseline+observe) | `sig= 1285 hit=  33 net=    -97 roi=   -7.5% wr=  2.6% dd=  427 pos=10/33 mean=  -2.9 sd=  42.9 gini=0.462 top10=70.4%` |
| hidden(hint+block) | `sig= 1025 hit=  39 net=    379 roi=   37.0% wr=  3.8% dd=  119 pos=15/31 mean=  12.2 sd=  45.0 gini=0.537 top10=71.9%` |
| non-baseline | `sig= 1467 hit=  61 net=    729 roi=   49.7% wr=  4.2% dd=  105 pos=19/33 mean=  22.1 sd=  51.6 gini=0.508 top10=66.3%` |
| table-only | `sig=  976 hit=  45 net=    644 roi=   66.0% wr=  4.6% dd=  101 pos=16/28 mean=  23.0 sd=  47.8 gini=0.452 top10=72.2%` |
| known-feature | `sig= 1443 hit=  49 net=    321 roi=   22.2% wr=  3.4% dd=  293 pos=16/36 mean=   8.9 sd=  49.5 gini=0.488 top10=67.4%` |

### Action Uniformity
| action | summary | worst sessions | best sessions |
|---|---:|---|---|
| enhance | `sig=  263 hit=  13 net=    205 roi=   77.9% wr=  4.9% dd=   55 pos= 6/13 mean=  15.8 sd=  36.7 gini=0.427 top10=94.7%` | 20260605-0230-澳门永利:-21/21<br>20210618-1633:-15/15<br>20231024-晚上-巴黎人:-15/15<br>20260603-0230-澳门永利:-15/15<br>wzs-2026-05-11-802:-14/14 | wzs-2026-05-11-807:99/81<br>20260606-0131-澳门永利:66/6<br>20260601-1630-澳门永利:55/17<br>20210619-1232:29/7<br>wzs-2026-01-11-604:28/44 |
| baseline | `sig=  843 hit=  11 net=   -447 roi=  -53.0% wr=  1.3% dd=  447 pos= 3/25 mean= -17.9 sd=  34.0 gini=0.456 top10=76.9%` | wzs-2021-04-23-063:-140/212<br>wzs-2025-01-13-301:-44/44<br>wzs-2026-01-11-604:-40/76<br>wzs-2026-05-11-804:-39/39<br>20210619-0052:-36/36 | wzs-2026-05-11-806:54/18<br>20260603-2101-澳门永利:36/36<br>wzs-2026-05-11-803:25/11<br>20210620-0003:-1/1<br>20230606-2307:-2/2 |
| observe | `sig=  179 hit=   9 net=    145 roi=   81.0% wr=  5.0% dd=   54 pos= 4/8  mean=  18.1 sd=  28.3 gini=0.517 top10=100.0%` | 20260601-1630-澳门永利:-11/11<br>20260606-0131-澳门永利:-10/10<br>20251102-下午-伦敦人:-2/2<br>20231024-晚上-巴黎人:-1/1<br>20260603-0030-澳门永利:14/22 | wzs-2026-05-11-810:67/113<br>20260603-2101-澳门永利:55/17<br>20260604-1630-澳门永利:33/3<br>20260603-0030-澳门永利:14/22<br>20231024-晚上-巴黎人:-1/1 |
| hint | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` | wzs-2026-01-11-604:-5/5 | wzs-2026-01-11-604:-5/5 |
| block | `sig= 1020 hit=  39 net=    384 roi=   37.6% wr=  3.8% dd=  119 pos=15/31 mean=  12.4 sd=  44.9 gini=0.543 top10=72.3%` | 20251202-晚上-喜来登:-60/60<br>wzs-2026-05-11-810:-52/52<br>20260605-0230-澳门永利:-45/45<br>20210621-1606:-30/30<br>20231025-晚上-伦敦人:-20/20 | 20260603-0030-澳门永利:152/136<br>20260607-0217-澳门永利:115/65<br>wzs-2026-01-01-002:73/35<br>20210619-1232:68/4<br>20210620-2016:64/8 |

### Action by Year
| key | summary |
|---|---:|
| 2026/block | `sig=  639 hit=  27 net=    333 roi=   52.1% wr=  4.2% dd=  119 pos= 9/15 mean=  22.2 sd=  54.4 gini=0.513 top10=90.8%` |
| 2021/baseline | `sig=  373 hit=   3 net=   -265 roi=  -71.0% wr=  0.8% dd=  265 pos= 0/8  mean= -33.1 sd=  42.1 gini=0.566 top10=100.0%` |
| 2026/baseline | `sig=  349 hit=   7 net=    -97 roi=  -27.8% wr=  2.0% dd=  116 pos= 3/11 mean=  -8.8 sd=  31.2 gini=0.239 top10=98.3%` |
| 2026/enhance | `sig=  226 hit=  12 net=    206 roi=   91.2% wr=  5.3% dd=   55 pos= 5/10 mean=  20.6 sd=  39.0 gini=0.449 top10=100.0%` |
| 2021/block | `sig=  185 hit=   8 net=    103 roi=   55.7% wr=  4.3% dd=   75 pos= 4/9  mean=  11.4 sd=  32.4 gini=0.500 top10=100.0%` |
| 2026/observe | `sig=  176 hit=   9 net=    148 roi=   84.1% wr=  5.1% dd=   54 pos= 4/6  mean=  24.7 sd=  29.9 gini=0.382 top10=100.0%` |
| 2023/block | `sig=  106 hit=   3 net=      2 roi=    1.9% wr=  2.8% dd=   52 pos= 1/4  mean=   0.5 sd=  17.9 gini=0.438 top10=100.0%` |
| 2025/block | `sig=   90 hit=   1 net=    -54 roi=  -60.0% wr=  1.1% dd=   77 pos= 1/3  mean= -18.0 sd=  30.0 gini=0.552 top10=100.0%` |
| 2025/baseline | `sig=   82 hit=   1 net=    -46 roi=  -56.1% wr=  1.2% dd=   62 pos= 0/2  mean= -23.0 sd=  21.0 gini=0.457 top10=100.0%` |
| 2023/baseline | `sig=   39 hit=   0 net=    -39 roi= -100.0% wr=  0.0% dd=   39 pos= 0/4  mean=  -9.8 sd=   6.1 gini=0.340 top10=100.0%` |
| 2021/enhance | `sig=   22 hit=   1 net=     14 roi=   63.6% wr=  4.5% dd=   20 pos= 1/2  mean=   7.0 sd=  22.0 gini=0.159 top10=100.0%` |
| 2023/enhance | `sig=   15 hit=   0 net=    -15 roi= -100.0% wr=  0.0% dd=   15 pos= 0/1  mean= -15.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2026/hint | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2025/observe | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2023/observe | `sig=    1 hit=   0 net=     -1 roi= -100.0% wr=  0.0% dd=    1 pos= 0/1  mean=  -1.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Action by Venue, min 40 signals
| key | summary |
|---|---:|
| wzs/baseline | `sig=  532 hit=   7 net=   -280 roi=  -52.6% wr=  1.3% dd=  293 pos= 2/10 mean= -28.0 sd=  47.8 gini=0.340 top10=100.0%` |
| 澳门永利/block | `sig=  403 hit=  17 net=    209 roi=   51.9% wr=  4.2% dd=   78 pos= 4/8  mean=  26.1 sd=  65.1 gini=0.542 top10=100.0%` |
| wzs/block | `sig=  374 hit=  14 net=    130 roi=   34.8% wr=  3.7% dd=   66 pos= 7/10 mean=  13.0 sd=  32.9 gini=0.472 top10=100.0%` |
| unknown/block | `sig=  155 hit=   8 net=    133 roi=   85.8% wr=  5.2% dd=   84 pos= 4/9  mean=  14.8 sd=  32.3 gini=0.483 top10=100.0%` |
| wzs/enhance | `sig=  152 hit=   7 net=    100 roi=   65.8% wr=  4.6% dd=   55 pos= 2/4  mean=  25.0 sd=  46.0 gini=0.442 top10=100.0%` |
| 澳门永利/baseline | `sig=  150 hit=   3 net=    -42 roi=  -28.0% wr=  2.0% dd=   72 pos= 1/5  mean=  -8.4 sd=  24.6 gini=0.298 top10=100.0%` |
| wzs/observe | `sig=  113 hit=   5 net=     67 roi=   59.3% wr=  4.4% dd=   54 pos= 1/1  mean=  67.0 sd=   0.0 gini=0.000 top10=100.0%` |
| unknown/baseline | `sig=  105 hit=   0 net=   -105 roi= -100.0% wr=  0.0% dd=  105 pos= 0/7  mean= -15.0 sd=  12.9 gini=0.476 top10=100.0%` |
| 澳门永利/enhance | `sig=   74 hit=   5 net=    106 roi=  143.2% wr=  6.8% dd=   43 pos= 3/6  mean=  17.7 sd=  33.3 gini=0.413 top10=100.0%` |
| 澳门永利/observe | `sig=   63 hit=   4 net=     81 roi=  128.6% wr=  6.3% dd=   27 pos= 3/5  mean=  16.2 sd=  25.4 gini=0.364 top10=100.0%` |
| 喜来登/block | `sig=   60 hit=   0 net=    -60 roi= -100.0% wr=  0.0% dd=   60 pos= 0/1  mean= -60.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Action x Scope/Sample
| key | summary |
|---|---:|
| baseline/none/none | `sig=  843 hit=  11 net=   -447 roi=  -53.0% wr=  1.3% dd=  447 pos= 3/25 mean= -17.9 sd=  34.0 gini=0.456 top10=76.9%` |
| block/table/tier | `sig=  429 hit=  22 net=    363 roi=   84.6% wr=  5.1% dd=   84 pos=11/24 mean=  15.1 sd=  34.6 gini=0.497 top10=76.7%` |
| block/table/overall | `sig=  312 hit=  11 net=     84 roi=   26.9% wr=  3.5% dd=  105 pos= 5/14 mean=   6.0 sd=  32.8 gini=0.478 top10=94.2%` |
| block/venue/tier | `sig=  247 hit=   5 net=    -67 roi=  -27.1% wr=  2.0% dd=  133 pos= 2/12 mean=  -5.6 sd=  15.9 gini=0.427 top10=98.8%` |
| observe/venue/tier | `sig=  126 hit=   7 net=    126 roi=  100.0% wr=  5.6% dd=   54 pos= 3/4  mean=  31.5 sd=  24.5 gini=0.385 top10=100.0%` |
| enhance/table/tier | `sig=  100 hit=   5 net=     80 roi=   80.0% wr=  5.0% dd=   38 pos= 3/8  mean=  10.0 sd=  28.9 gini=0.405 top10=100.0%` |
| enhance/venue/tier | `sig=   86 hit=   3 net=     22 roi=   25.6% wr=  3.5% dd=   22 pos= 2/4  mean=   5.5 sd=  19.6 gini=0.167 top10=100.0%` |
| enhance/table/overall | `sig=   77 hit=   5 net=    103 roi=  133.8% wr=  6.5% dd=   23 pos= 2/3  mean=  34.3 sd=  31.7 gini=0.314 top10=100.0%` |
| observe/table/tier | `sig=   43 hit=   2 net=     29 roi=   67.4% wr=  4.7% dd=   37 pos= 1/4  mean=   7.3 sd=  28.0 gini=0.509 top10=100.0%` |
| block/venue/overall | `sig=   32 hit=   1 net=      4 roi=   12.5% wr=  3.1% dd=   18 pos= 1/3  mean=   1.3 sd=  19.9 gini=0.259 top10=100.0%` |
| observe/table/overall | `sig=   10 hit=   0 net=    -10 roi= -100.0% wr=  0.0% dd=   10 pos= 0/2  mean=  -5.0 sd=   4.0 gini=0.400 top10=100.0%` |
| hint/table/tier | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Support x Action
| key | summary |
|---|---:|
| unknown/block | `sig=  501 hit=  16 net=     75 roi=   15.0% wr=  3.2% dd=  119 pos= 8/25 mean=   3.0 sd=  30.1 gini=0.520 top10=77.8%` |
| watch/block | `sig=  370 hit=  15 net=    170 roi=   45.9% wr=  4.1% dd=   98 pos= 9/20 mean=   8.5 sd=  24.7 gini=0.500 top10=85.9%` |
| watch/baseline | `sig=  304 hit=   3 net=   -196 roi=  -64.5% wr=  1.0% dd=  199 pos= 0/13 mean= -15.1 sd=  11.7 gini=0.425 top10=97.4%` |
| unknown/baseline | `sig=  285 hit=   5 net=   -105 roi=  -36.8% wr=  1.8% dd=  159 pos= 2/15 mean=  -7.0 sd=  23.2 gini=0.432 top10=94.4%` |
| watch/observe | `sig=  146 hit=   6 net=     70 roi=   47.9% wr=  4.1% dd=   54 pos= 2/3  mean=  23.3 sd=  32.5 gini=0.406 top10=100.0%` |
| conflict/baseline | `sig=  131 hit=   2 net=    -59 roi=  -45.0% wr=  1.5% dd=   80 pos= 2/9  mean=  -6.6 sd=  19.8 gini=0.605 top10=100.0%` |
| support/baseline | `sig=   76 hit=   0 net=    -76 roi= -100.0% wr=  0.0% dd=   76 pos= 0/9  mean=  -8.4 sd=  11.1 gini=0.529 top10=100.0%` |
| unknown/enhance | `sig=   67 hit=   2 net=      5 roi=    7.5% wr=  3.0% dd=   23 pos= 1/3  mean=   1.7 sd=  18.8 gini=0.261 top10=100.0%` |
| conflict/enhance | `sig=   62 hit=   4 net=     82 roi=  132.3% wr=  6.5% dd=   28 pos= 3/6  mean=  13.7 sd=  26.1 gini=0.368 top10=100.0%` |
| conflict/block | `sig=   61 hit=   3 net=     47 roi=   77.0% wr=  4.9% dd=   33 pos= 2/6  mean=   7.8 sd=  20.4 gini=0.496 top10=100.0%` |
| support/enhance | `sig=   58 hit=   3 net=     50 roi=   86.2% wr=  5.2% dd=   26 pos= 1/4  mean=  12.5 sd=  31.5 gini=0.577 top10=100.0%` |
| watch/enhance | `sig=   52 hit=   2 net=     20 roi=   38.5% wr=  3.8% dd=   36 pos= 1/5  mean=   4.0 sd=  25.1 gini=0.535 top10=100.0%` |
| strong/baseline | `sig=   47 hit=   1 net=    -11 roi=  -23.4% wr=  2.1% dd=   39 pos= 1/3  mean=  -3.7 sd=  28.2 gini=0.347 top10=100.0%` |
| strong/block | `sig=   45 hit=   3 net=     63 roi=  140.0% wr=  6.7% dd=   29 pos= 2/9  mean=   7.0 sd=  23.1 gini=0.619 top10=100.0%` |
| support/block | `sig=   43 hit=   2 net=     29 roi=   67.4% wr=  4.7% dd=   18 pos= 2/5  mean=   5.8 sd=  15.6 gini=0.412 top10=100.0%` |
| strong/enhance | `sig=   24 hit=   2 net=     48 roi=  200.0% wr=  8.3% dd=   22 pos= 1/3  mean=  16.0 sd=  38.6 gini=0.478 top10=100.0%` |
| strong/observe | `sig=   20 hit=   2 net=     52 roi=  260.0% wr= 10.0% dd=   15 pos= 1/3  mean=  17.3 sd=  26.6 gini=0.621 top10=100.0%` |
| unknown/observe | `sig=    9 hit=   0 net=     -9 roi= -100.0% wr=  0.0% dd=    9 pos= 0/1  mean=  -9.0 sd=   0.0 gini=0.000 top10=100.0%` |
| unknown/hint | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |
| conflict/observe | `sig=    3 hit=   1 net=     33 roi= 1100.0% wr= 33.3% dd=    1 pos= 1/1  mean=  33.0 sd=   0.0 gini=0.000 top10=100.0%` |
| support/observe | `sig=    1 hit=   0 net=     -1 roi= -100.0% wr=  0.0% dd=    1 pos= 0/1  mean=  -1.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Realized ROI by Historical Calibration ROI Band
| key | summary |
|---|---:|
| none/baseline | `sig=  843 hit=  11 net=   -447 roi=  -53.0% wr=  1.3% dd=  447 pos= 3/25 mean= -17.9 sd=  34.0 gini=0.456 top10=76.9%` |
| <-50/block | `sig=  705 hit=  27 net=    267 roi=   37.9% wr=  3.8% dd=   86 pos=12/25 mean=  10.7 sd=  35.1 gini=0.527 top10=80.1%` |
| >=35/enhance | `sig=  263 hit=  13 net=    205 roi=   77.9% wr=  4.9% dd=   55 pos= 6/13 mean=  15.8 sd=  36.7 gini=0.427 top10=94.7%` |
| -50..-20/block | `sig=  261 hit=  11 net=    135 roi=   51.7% wr=  4.2% dd=   80 pos= 5/16 mean=   8.4 sd=  38.7 gini=0.638 top10=93.9%` |
| 10..35/observe | `sig=  179 hit=   9 net=    145 roi=   81.0% wr=  5.0% dd=   54 pos= 4/8  mean=  18.1 sd=  28.3 gini=0.517 top10=100.0%` |
| -20..-5/block | `sig=   54 hit=   1 net=    -18 roi=  -33.3% wr=  1.9% dd=   33 pos= 1/5  mean=  -3.6 sd=  13.4 gini=0.327 top10=100.0%` |
| -5..10/hint | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Top Calibration Buckets, min 25 signals
| key | summary |
|---|---:|
| baseline/none/none | `sig=  843 hit=  11 net=   -447 roi=  -53.0% wr=  1.3% dd=  447 pos= 3/25 mean= -17.9 sd=  34.0 gini=0.456 top10=76.9%` |
| block/venue:wzs/wzs | `sig=  193 hit=   6 net=     23 roi=   11.9% wr=  3.1% dd=   72 pos= 3/8  mean=   2.9 sd=  13.3 gini=0.473 top10=100.0%` |
| block/table:auto_06/自动画像6 | `sig=  167 hit=   4 net=    -23 roi=  -13.8% wr=  2.4% dd=   67 pos= 2/6  mean=  -3.8 sd=  23.7 gini=0.562 top10=100.0%` |
| observe/venue:喜来登/喜来登 | `sig=  121 hit=   6 net=     95 roi=   78.5% wr=  5.0% dd=   54 pos= 2/2  mean=  47.5 sd=  19.5 gini=0.205 top10=100.0%` |
| enhance/table:auto_08/自动画像8 | `sig=   82 hit=   5 net=     98 roi=  119.5% wr=  6.1% dd=   28 pos= 1/2  mean=  49.0 sd=  50.0 gini=0.490 top10=100.0%` |
| block/table:auto_17/自动画像17 | `sig=   81 hit=   3 net=     27 roi=   33.3% wr=  3.7% dd=   48 pos= 1/1  mean=  27.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_01/自动画像1 | `sig=   76 hit=   3 net=     32 roi=   42.1% wr=  3.9% dd=   38 pos= 1/6  mean=   5.3 sd=  28.5 gini=0.612 top10=100.0%` |
| block/table:auto_15/自动画像15 | `sig=   75 hit=   6 net=    141 roi=  188.0% wr=  8.0% dd=   21 pos= 2/3  mean=  47.0 sd=  58.3 gini=0.408 top10=100.0%` |
| block/table:auto_16/自动画像16 | `sig=   75 hit=   5 net=    105 roi=  140.0% wr=  6.7% dd=   28 pos= 2/4  mean=  26.3 sd=  35.3 gini=0.476 top10=100.0%` |
| block/venue:喜来登/喜来登 | `sig=   73 hit=   0 net=    -73 roi= -100.0% wr=  0.0% dd=   73 pos= 0/3  mean= -24.3 sd=  20.3 gini=0.438 top10=100.0%` |
| enhance/table:auto_01/自动画像1 | `sig=   54 hit=   3 net=     54 roi=  100.0% wr=  5.6% dd=   26 pos= 2/4  mean=  13.5 sd=  29.9 gini=0.294 top10=100.0%` |
| block/table:auto_02/自动画像2 | `sig=   54 hit=   1 net=    -18 roi=  -33.3% wr=  1.9% dd=   37 pos= 1/4  mean=  -4.5 sd=  19.6 gini=0.346 top10=100.0%` |
| block/table:auto_12/自动画像12 | `sig=   52 hit=   1 net=    -16 roi=  -30.8% wr=  1.9% dd=   28 pos= 0/2  mean=  -8.0 sd=   1.0 gini=0.063 top10=100.0%` |
| enhance/venue:伦敦人/伦敦人 | `sig=   44 hit=   2 net=     28 roi=   63.6% wr=  4.5% dd=   22 pos= 1/1  mean=  28.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_18/自动画像18 | `sig=   40 hit=   3 net=     68 roi=  170.0% wr=  7.5% dd=   18 pos= 1/3  mean=  22.7 sd=  34.9 gini=0.623 top10=100.0%` |
| block/table:auto_08/自动画像8 | `sig=   35 hit=   1 net=      1 roi=    2.9% wr=  2.9% dd=   21 pos= 1/4  mean=   0.3 sd=  16.2 gini=0.392 top10=100.0%` |
| block/table:auto_11/自动画像11 | `sig=   30 hit=   1 net=      6 roi=   20.0% wr=  3.3% dd=   20 pos= 1/2  mean=   3.0 sd=   9.0 gini=0.167 top10=100.0%` |
| block/table:auto_05/自动画像5 | `sig=   28 hit=   4 net=    116 roi=  414.3% wr= 14.3% dd=   18 pos= 3/4  mean=  29.0 sd=  27.0 gini=0.282 top10=100.0%` |
| block/table:auto_20/自动画像20 | `sig=   28 hit=   1 net=      8 roi=   28.6% wr=  3.6% dd=   20 pos= 1/2  mean=   4.0 sd=  18.0 gini=0.111 top10=100.0%` |
| observe/table:auto_18/自动画像18 | `sig=   25 hit=   0 net=    -25 roi= -100.0% wr=  0.0% dd=   25 pos= 0/2  mean= -12.5 sd=   1.5 gini=0.060 top10=100.0%` |

### Auto Assignment Source
| key | summary |
|---|---:|
| profile-match/block | `sig= 1020 hit=  39 net=    384 roi=   37.6% wr=  3.8% dd=  119 pos=15/31 mean=  12.4 sd=  44.9 gini=0.543 top10=72.3%` |
| profile-match/baseline | `sig=  843 hit=  11 net=   -447 roi=  -53.0% wr=  1.3% dd=  447 pos= 3/25 mean= -17.9 sd=  34.0 gini=0.456 top10=76.9%` |
| profile-match/enhance | `sig=  263 hit=  13 net=    205 roi=   77.9% wr=  4.9% dd=   55 pos= 6/13 mean=  15.8 sd=  36.7 gini=0.427 top10=94.7%` |
| profile-match/observe | `sig=  179 hit=   9 net=    145 roi=   81.0% wr=  5.0% dd=   54 pos= 4/8  mean=  18.1 sd=  28.3 gini=0.517 top10=100.0%` |
| profile-match/hint | `sig=    5 hit=   0 net=     -5 roi= -100.0% wr=  0.0% dd=    5 pos= 0/1  mean=  -5.0 sd=   0.0 gini=0.000 top10=100.0%` |

## auto-prefix

### Action ROI
| bucket | summary |
|---|---:|
| enhance | `sig=  410 hit=  16 net=    166 roi=   40.5% wr=  3.9% dd=   75 pos= 7/16 mean=  10.4 sd=  35.8 gini=0.455 top10=90.5%` |
| baseline | `sig=  613 hit=   7 net=   -361 roi=  -58.9% wr=  1.1% dd=  378 pos= 2/21 mean= -17.2 sd=  32.6 gini=0.530 top10=86.9%` |
| observe | `sig=  367 hit=  12 net=     65 roi=   17.7% wr=  3.3% dd=  207 pos= 3/10 mean=   6.5 sd=  52.1 gini=0.548 top10=100.0%` |
| hint | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` |
| block | `sig=  920 hit=  37 net=    412 roi=   44.8% wr=  4.0% dd=   83 pos=14/27 mean=  15.3 sd=  40.4 gini=0.491 top10=73.5%` |

### Plan ROI
| bucket | summary |
|---|---:|
| raw-all | `sig= 2310 hit=  72 net=    282 roi=   12.2% wr=  3.1% dd=  319 pos=17/43 mean=   6.6 sd=  57.5 gini=0.520 top10=56.1%` |
| default-visible(enhance+baseline+observe) | `sig= 1390 hit=  35 net=   -130 roi=   -9.4% wr=  2.5% dd=  430 pos= 9/33 mean=  -3.9 sd=  46.8 gini=0.508 top10=74.1%` |
| hidden(hint+block) | `sig=  920 hit=  37 net=    412 roi=   44.8% wr=  4.0% dd=   83 pos=14/27 mean=  15.3 sd=  40.4 gini=0.491 top10=73.5%` |
| non-baseline | `sig= 1697 hit=  65 net=    643 roi=   37.9% wr=  3.8% dd=  138 pos=17/33 mean=  19.5 sd=  59.3 gini=0.502 top10=62.5%` |
| table-only | `sig= 1286 hit=  50 net=    514 roi=   40.0% wr=  3.9% dd=  134 pos=17/30 mean=  17.1 sd=  47.2 gini=0.451 top10=66.4%` |
| known-feature | `sig= 1957 hit=  59 net=    167 roi=    8.5% wr=  3.0% dd=  401 pos=14/41 mean=   4.1 sd=  54.4 gini=0.531 top10=63.0%` |

### Action Uniformity
| action | summary | worst sessions | best sessions |
|---|---:|---|---|
| enhance | `sig=  410 hit=  16 net=    166 roi=   40.5% wr=  3.9% dd=   75 pos= 7/16 mean=  10.4 sd=  35.8 gini=0.455 top10=90.5%` | 20260605-0230-澳门永利:-55/55<br>wzs-2026-05-11-802:-22/22<br>20231024-晚上-巴黎人:-17/17<br>20210618-1633:-15/15<br>20260603-0230-澳门永利:-12/12 | wzs-2026-05-11-807:99/81<br>20260601-1630-澳门永利:53/19<br>wzs-2026-05-11-810:45/27<br>20260606-0131-澳门永利:39/69<br>20210619-1232:29/7 |
| baseline | `sig=  613 hit=   7 net=   -361 roi=  -58.9% wr=  1.1% dd=  378 pos= 2/21 mean= -17.2 sd=  32.6 gini=0.530 top10=86.9%` | wzs-2021-04-23-063:-140/212<br>wzs-2025-01-13-301:-44/44<br>20210619-0052:-36/36<br>20260603-0030-澳门永利:-35/35<br>wzs-2021-04-23-062:-29/65 | wzs-2026-05-11-806:33/3<br>wzs-2026-05-11-803:25/11<br>20230606-2307:-2/2<br>20251204-晚上-喜来登:-2/38<br>20231025-晚上-伦敦人:-4/4 |
| observe | `sig=  367 hit=  12 net=     65 roi=   17.7% wr=  3.3% dd=  207 pos= 3/10 mean=   6.5 sd=  52.1 gini=0.548 top10=100.0%` | 20210621-1606:-54/54<br>wzs-2026-05-11-810:-51/159<br>20260603-0230-澳门永利:-15/15<br>20260601-1630-澳门永利:-11/11<br>20231024-晚上-巴黎人:-9/9 | 20260603-0030-澳门永利:135/81<br>20260603-2101-澳门永利:55/17<br>20260604-1630-澳门永利:18/18<br>20260606-0131-澳门永利:-1/1<br>20251102-下午-伦敦人:-2/2 |
| hint | `sig=    0 hit=   0 net=      0 roi=    0.0% wr=  0.0% dd=    0 pos= 0/0  mean=   0.0 sd=   0.0 gini=0.000 top10=0.0%` | - | - |
| block | `sig=  920 hit=  37 net=    412 roi=   44.8% wr=  4.0% dd=   83 pos=14/27 mean=  15.3 sd=  40.4 gini=0.491 top10=73.5%` | 20251202-晚上-喜来登:-60/60<br>wzs-2026-05-11-804:-52/52<br>20231025-晚上-伦敦人:-24/24<br>20260605-0230-澳门永利:-20/20<br>20260601-1630-澳门永利:-17/53 | 20260607-0217-澳门永利:115/65<br>wzs-2026-05-11-806:78/30<br>wzs-2026-01-01-002:73/35<br>20210619-1232:68/4<br>20260603-0030-澳门永利:66/42 |

### Action by Year
| key | summary |
|---|---:|
| 2026/block | `sig=  572 hit=  25 net=    328 roi=   57.3% wr=  4.4% dd=   83 pos= 8/14 mean=  23.4 sd=  44.6 gini=0.454 top10=91.8%` |
| 2026/enhance | `sig=  368 hit=  15 net=    172 roi=   46.7% wr=  4.1% dd=   61 pos= 6/11 mean=  15.6 sd=  40.6 gini=0.393 top10=98.4%` |
| 2021/baseline | `sig=  347 hit=   3 net=   -239 roi=  -68.9% wr=  0.9% dd=  243 pos= 0/7  mean= -34.1 sd=  44.6 gini=0.579 top10=100.0%` |
| 2026/observe | `sig=  302 hit=  12 net=    130 roi=   43.0% wr=  4.0% dd=  142 pos= 3/7  mean=  18.6 sd=  56.2 gini=0.525 top10=100.0%` |
| 2021/block | `sig=  154 hit=   8 net=    134 roi=   87.0% wr=  5.2% dd=   73 pos= 4/7  mean=  19.1 sd=  32.1 gini=0.470 top10=100.0%` |
| 2026/baseline | `sig=  153 hit=   3 net=    -45 roi=  -29.4% wr=  2.0% dd=   91 pos= 2/8  mean=  -5.6 sd=  22.0 gini=0.293 top10=100.0%` |
| 2023/block | `sig=  104 hit=   3 net=      4 roi=    3.8% wr=  2.9% dd=   52 pos= 1/3  mean=   1.3 sd=  21.7 gini=0.346 top10=100.0%` |
| 2025/block | `sig=   90 hit=   1 net=    -54 roi=  -60.0% wr=  1.1% dd=   77 pos= 1/3  mean= -18.0 sd=  30.0 gini=0.552 top10=100.0%` |
| 2025/baseline | `sig=   82 hit=   1 net=    -46 roi=  -56.1% wr=  1.2% dd=   62 pos= 0/2  mean= -23.0 sd=  21.0 gini=0.457 top10=100.0%` |
| 2021/observe | `sig=   54 hit=   0 net=    -54 roi= -100.0% wr=  0.0% dd=   54 pos= 0/1  mean= -54.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2023/baseline | `sig=   31 hit=   0 net=    -31 roi= -100.0% wr=  0.0% dd=   31 pos= 0/4  mean=  -7.8 sd=   6.6 gini=0.427 top10=100.0%` |
| 2021/enhance | `sig=   25 hit=   1 net=     11 roi=   44.0% wr=  4.0% dd=   22 pos= 1/4  mean=   2.8 sd=  16.1 gini=0.516 top10=100.0%` |
| 2023/enhance | `sig=   17 hit=   0 net=    -17 roi= -100.0% wr=  0.0% dd=   17 pos= 0/1  mean= -17.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2023/observe | `sig=    9 hit=   0 net=     -9 roi= -100.0% wr=  0.0% dd=    9 pos= 0/1  mean=  -9.0 sd=   0.0 gini=0.000 top10=100.0%` |
| 2025/observe | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Action by Venue, min 40 signals
| key | summary |
|---|---:|
| wzs/block | `sig=  488 hit=  18 net=    160 roi=   32.8% wr=  3.7% dd=   83 pos= 7/11 mean=  14.5 sd=  35.8 gini=0.479 top10=98.4%` |
| wzs/baseline | `sig=  382 hit=   5 net=   -202 roi=  -52.9% wr=  1.3% dd=  262 pos= 2/8  mean= -25.3 sd=  49.9 gini=0.434 top10=100.0%` |
| 澳门永利/block | `sig=  222 hit=  11 net=    174 roi=   78.4% wr=  5.0% dd=   47 pos= 3/6  mean=  29.0 sd=  48.9 gini=0.472 top10=100.0%` |
| 澳门永利/enhance | `sig=  221 hit=   8 net=     67 roi=   30.3% wr=  3.6% dd=   61 pos= 4/6  mean=  11.2 sd=  35.7 gini=0.274 top10=100.0%` |
| wzs/observe | `sig=  159 hit=   3 net=    -51 roi=  -32.1% wr=  1.9% dd=  142 pos= 0/1  mean= -51.0 sd=   0.0 gini=0.000 top10=100.0%` |
| wzs/enhance | `sig=  147 hit=   7 net=    105 roi=   71.4% wr=  4.8% dd=   56 pos= 2/5  mean=  21.0 sd=  45.3 gini=0.481 top10=100.0%` |
| 澳门永利/observe | `sig=  143 hit=   9 net=    181 roi=  126.6% wr=  6.3% dd=   32 pos= 3/6  mean=  30.2 sd=  52.4 gini=0.571 top10=100.0%` |
| unknown/block | `sig=  124 hit=   8 net=    164 roi=  132.3% wr=  6.5% dd=   54 pos= 4/7  mean=  23.4 sd=  30.8 gini=0.456 top10=100.0%` |
| 澳门永利/baseline | `sig=  104 hit=   1 net=    -68 roi=  -65.4% wr=  1.0% dd=   85 pos= 0/4  mean= -17.0 sd=  11.0 gini=0.338 top10=100.0%` |
| unknown/baseline | `sig=   79 hit=   0 net=    -79 roi= -100.0% wr=  0.0% dd=   79 pos= 0/6  mean= -13.2 sd=  11.7 gini=0.462 top10=100.0%` |
| 喜来登/block | `sig=   60 hit=   0 net=    -60 roi= -100.0% wr=  0.0% dd=   60 pos= 0/1  mean= -60.0 sd=   0.0 gini=0.000 top10=100.0%` |
| unknown/observe | `sig=   54 hit=   0 net=    -54 roi= -100.0% wr=  0.0% dd=   54 pos= 0/1  mean= -54.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Action x Scope/Sample
| key | summary |
|---|---:|
| baseline/none/none | `sig=  613 hit=   7 net=   -361 roi=  -58.9% wr=  1.1% dd=  378 pos= 2/21 mean= -17.2 sd=  32.6 gini=0.530 top10=86.9%` |
| block/table/tier | `sig=  420 hit=  18 net=    228 roi=   54.3% wr=  4.3% dd=   69 pos=10/22 mean=  10.4 sd=  33.8 gini=0.492 top10=79.3%` |
| block/table/overall | `sig=  351 hit=  13 net=    117 roi=   33.3% wr=  3.7% dd=  106 pos= 7/19 mean=   6.2 sd=  30.2 gini=0.505 top10=84.3%` |
| observe/table/tier | `sig=  198 hit=   5 net=    -18 roi=   -9.1% wr=  2.5% dd=  146 pos= 1/6  mean=  -3.0 sd=  31.7 gini=0.565 top10=100.0%` |
| enhance/table/tier | `sig=  151 hit=   7 net=    101 roi=   66.9% wr=  4.6% dd=   55 pos= 4/13 mean=   7.8 sd=  26.1 gini=0.509 top10=97.4%` |
| block/venue/tier | `sig=  134 hit=   5 net=     46 roi=   34.3% wr=  3.7% dd=   59 pos= 2/7  mean=   6.6 sd=  22.8 gini=0.571 top10=100.0%` |
| observe/venue/tier | `sig=  125 hit=   7 net=    127 roi=  101.6% wr=  5.6% dd=   32 pos= 2/5  mean=  25.4 sd=  61.4 gini=0.536 top10=100.0%` |
| enhance/table/overall | `sig=  122 hit=   7 net=    130 roi=  106.6% wr=  5.7% dd=   44 pos= 3/4  mean=  32.5 sd=  26.0 gini=0.393 top10=100.0%` |
| enhance/venue/tier | `sig=   84 hit=   2 net=    -12 roi=  -14.3% wr=  2.4% dd=   71 pos= 1/3  mean=  -4.0 sd=  18.5 gini=0.083 top10=100.0%` |
| enhance/venue/overall | `sig=   53 hit=   0 net=    -53 roi= -100.0% wr=  0.0% dd=   53 pos= 0/3  mean= -17.7 sd=  11.0 gini=0.314 top10=100.0%` |
| observe/table/overall | `sig=   44 hit=   0 net=    -44 roi= -100.0% wr=  0.0% dd=   44 pos= 0/3  mean= -14.7 sd=   4.5 gini=0.167 top10=100.0%` |
| block/venue/overall | `sig=   15 hit=   1 net=     21 roi=  140.0% wr=  6.7% dd=   13 pos= 1/2  mean=  10.5 sd=  18.5 gini=0.284 top10=100.0%` |

### Support x Action
| key | summary |
|---|---:|
| watch/block | `sig=  487 hit=  16 net=     89 roi=   18.3% wr=  3.3% dd=  173 pos= 9/23 mean=   3.9 sd=  27.0 gini=0.474 top10=82.3%` |
| watch/observe | `sig=  272 hit=   9 net=     52 roi=   19.1% wr=  3.3% dd=  148 pos= 1/5  mean=  10.4 sd=  64.7 gini=0.563 top10=100.0%` |
| watch/baseline | `sig=  222 hit=   2 net=   -150 roi=  -67.6% wr=  0.9% dd=  153 pos= 0/11 mean= -13.6 sd=   6.7 gini=0.273 top10=97.3%` |
| unknown/block | `sig=  210 hit=  11 net=    186 roi=   88.6% wr=  5.2% dd=   48 pos= 6/12 mean=  15.5 sd=  31.4 gini=0.495 top10=96.7%` |
| unknown/baseline | `sig=  141 hit=   2 net=    -69 roi=  -48.9% wr=  1.4% dd=   93 pos= 1/9  mean=  -7.7 sd=  17.0 gini=0.420 top10=100.0%` |
| watch/enhance | `sig=  137 hit=   5 net=     43 roi=   31.4% wr=  3.6% dd=   72 pos= 2/5  mean=   8.6 sd=  32.3 gini=0.263 top10=100.0%` |
| conflict/enhance | `sig=  123 hit=   4 net=     21 roi=   17.1% wr=  3.3% dd=   54 pos= 3/12 mean=   1.8 sd=  22.1 gini=0.455 top10=97.6%` |
| conflict/baseline | `sig=  117 hit=   2 net=    -45 roi=  -38.5% wr=  1.7% dd=   75 pos= 2/8  mean=  -5.6 sd=  22.6 gini=0.527 top10=100.0%` |
| strong/block | `sig=   93 hit=   6 net=    123 roi=  132.3% wr=  6.5% dd=   29 pos= 4/9  mean=  13.7 sd=  23.8 gini=0.527 top10=100.0%` |
| support/enhance | `sig=   89 hit=   3 net=     19 roi=   21.3% wr=  3.4% dd=   57 pos= 1/6  mean=   3.2 sd=  28.7 gini=0.468 top10=100.0%` |
| support/baseline | `sig=   68 hit=   0 net=    -68 roi= -100.0% wr=  0.0% dd=   68 pos= 0/9  mean=  -7.6 sd=  11.2 gini=0.556 top10=100.0%` |
| conflict/block | `sig=   67 hit=   2 net=      5 roi=    7.5% wr=  3.0% dd=   26 pos= 2/8  mean=   0.6 sd=  14.8 gini=0.342 top10=100.0%` |
| strong/baseline | `sig=   65 hit=   1 net=    -29 roi=  -44.6% wr=  1.5% dd=   39 pos= 1/3  mean=  -9.7 sd=  29.1 gini=0.142 top10=100.0%` |
| support/block | `sig=   63 hit=   2 net=      9 roi=   14.3% wr=  3.2% dd=   34 pos= 2/8  mean=   1.1 sd=  14.5 gini=0.523 top10=100.0%` |
| strong/enhance | `sig=   59 hit=   4 net=     85 roi=  144.1% wr=  6.8% dd=   33 pos= 2/5  mean=  17.0 sd=  34.3 gini=0.466 top10=100.0%` |
| conflict/observe | `sig=   36 hit=   1 net=      0 roi=    0.0% wr=  2.8% dd=   30 pos= 1/2  mean=   0.0 sd=  28.0 gini=0.000 top10=100.0%` |
| support/observe | `sig=   31 hit=   0 net=    -31 roi= -100.0% wr=  0.0% dd=   31 pos= 0/3  mean= -10.3 sd=   7.8 gini=0.409 top10=100.0%` |
| strong/observe | `sig=   28 hit=   2 net=     44 roi=  157.1% wr=  7.1% dd=   23 pos= 1/3  mean=  14.7 sd=  28.7 gini=0.535 top10=100.0%` |
| unknown/enhance | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |

### Realized ROI by Historical Calibration ROI Band
| key | summary |
|---|---:|
| <-50/block | `sig=  625 hit=  26 net=    311 roi=   49.8% wr=  4.2% dd=   80 pos=10/24 mean=  13.0 sd=  37.7 gini=0.562 top10=83.8%` |
| none/baseline | `sig=  613 hit=   7 net=   -361 roi=  -58.9% wr=  1.1% dd=  378 pos= 2/21 mean= -17.2 sd=  32.6 gini=0.530 top10=86.9%` |
| >=35/enhance | `sig=  410 hit=  16 net=    166 roi=   40.5% wr=  3.9% dd=   75 pos= 7/16 mean=  10.4 sd=  35.8 gini=0.455 top10=90.5%` |
| 10..35/observe | `sig=  367 hit=  12 net=     65 roi=   17.7% wr=  3.3% dd=  207 pos= 3/10 mean=   6.5 sd=  52.1 gini=0.548 top10=100.0%` |
| -50..-20/block | `sig=  229 hit=   9 net=     95 roi=   41.5% wr=  3.9% dd=  133 pos= 5/12 mean=   7.9 sd=  35.1 gini=0.520 top10=98.7%` |
| -20..-5/block | `sig=   66 hit=   2 net=      6 roi=    9.1% wr=  3.0% dd=   35 pos= 1/4  mean=   1.5 sd=  15.1 gini=0.406 top10=100.0%` |

### Top Calibration Buckets, min 25 signals
| key | summary |
|---|---:|
| baseline/none/none | `sig=  613 hit=   7 net=   -361 roi=  -58.9% wr=  1.1% dd=  378 pos= 2/21 mean= -17.2 sd=  32.6 gini=0.530 top10=86.9%` |
| block/table:auto_06/自动画像6 | `sig=  166 hit=   4 net=    -22 roi=  -13.3% wr=  2.4% dd=   67 pos= 2/6  mean=  -3.7 sd=  23.7 gini=0.569 top10=100.0%` |
| block/venue:wzs/wzs | `sig=  132 hit=   6 net=     84 roi=   63.6% wr=  4.5% dd=   48 pos= 3/4  mean=  21.0 sd=  23.3 gini=0.523 top10=100.0%` |
| observe/table:auto_03/自动画像3 | `sig=  129 hit=   3 net=    -21 roi=  -16.3% wr=  2.3% dd=  112 pos= 0/1  mean= -21.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/venue:澳门永利/澳门永利 | `sig=  123 hit=   1 net=    -87 roi=  -70.7% wr=  0.8% dd=  120 pos= 0/3  mean= -29.0 sd=  14.8 gini=0.276 top10=100.0%` |
| block/table:auto_03/自动画像3 | `sig=  116 hit=   3 net=     -8 roi=   -6.9% wr=  2.6% dd=   70 pos= 0/2  mean=  -4.0 sd=   3.0 gini=0.375 top10=100.0%` |
| block/table:auto_02/自动画像2 | `sig=   95 hit=   2 net=    -23 roi=  -24.2% wr=  2.1% dd=   62 pos= 2/6  mean=  -3.8 sd=  25.2 gini=0.459 top10=100.0%` |
| observe/venue:澳门永利/澳门永利 | `sig=   90 hit=   6 net=    126 roi=  140.0% wr=  6.7% dd=   26 pos= 1/2  mean=  63.0 sd=  78.0 gini=0.404 top10=100.0%` |
| enhance/table:auto_08/自动画像8 | `sig=   82 hit=   5 net=     98 roi=  119.5% wr=  6.1% dd=   28 pos= 1/2  mean=  49.0 sd=  50.0 gini=0.490 top10=100.0%` |
| block/table:auto_01/自动画像1 | `sig=   81 hit=   3 net=     27 roi=   33.3% wr=  3.7% dd=   47 pos= 1/5  mean=   5.4 sd=  31.4 gini=0.473 top10=100.0%` |
| observe/table:auto_01/自动画像1 | `sig=   63 hit=   0 net=    -63 roi= -100.0% wr=  0.0% dd=   63 pos= 0/2  mean= -31.5 sd=  22.5 gini=0.357 top10=100.0%` |
| block/table:auto_15/自动画像15 | `sig=   62 hit=   5 net=    118 roi=  190.3% wr=  8.1% dd=   21 pos= 1/2  mean=  59.0 sd=  65.0 gini=0.454 top10=100.0%` |
| enhance/table:auto_01/自动画像1 | `sig=   61 hit=   3 net=     47 roi=   77.0% wr=  4.9% dd=   29 pos= 2/6  mean=   7.8 sd=  25.2 gini=0.489 top10=100.0%` |
| block/table:auto_17/自动画像17 | `sig=   61 hit=   3 net=     47 roi=   77.0% wr=  4.9% dd=   28 pos= 1/1  mean=  47.0 sd=   0.0 gini=0.000 top10=100.0%` |
| enhance/table:auto_25/自动画像25 | `sig=   51 hit=   2 net=     21 roi=   41.2% wr=  3.9% dd=   32 pos= 1/1  mean=  21.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_16/自动画像16 | `sig=   48 hit=   3 net=     60 roi=  125.0% wr=  6.3% dd=   25 pos= 1/2  mean=  30.0 sd=  45.0 gini=0.333 top10=100.0%` |
| block/table:auto_12/自动画像12 | `sig=   42 hit=   1 net=     -6 roi=  -14.3% wr=  2.4% dd=   30 pos= 1/3  mean=  -2.0 sd=   7.1 gini=0.061 top10=100.0%` |
| enhance/table:auto_03/自动画像3 | `sig=   33 hit=   2 net=     39 roi=  118.2% wr=  6.1% dd=   21 pos= 1/2  mean=  19.5 sd=  25.5 gini=0.382 top10=100.0%` |
| enhance/table:auto_15/自动画像15 | `sig=   33 hit=   0 net=    -33 roi= -100.0% wr=  0.0% dd=   33 pos= 0/2  mean= -16.5 sd=   5.5 gini=0.167 top10=100.0%` |
| block/table:auto_11/自动画像11 | `sig=   30 hit=   1 net=      6 roi=   20.0% wr=  3.3% dd=   20 pos= 1/2  mean=   3.0 sd=   9.0 gini=0.167 top10=100.0%` |
| observe/venue:喜来登/喜来登 | `sig=   30 hit=   0 net=    -30 roi= -100.0% wr=  0.0% dd=   30 pos= 0/1  mean= -30.0 sd=   0.0 gini=0.000 top10=100.0%` |
| block/table:auto_05/自动画像5 | `sig=   27 hit=   4 net=    117 roi=  433.3% wr= 14.8% dd=   17 pos= 3/4  mean=  29.3 sd=  26.7 gini=0.290 top10=100.0%` |

### Auto Assignment Source
| key | summary |
|---|---:|
| auto/block | `sig=  690 hit=  26 net=    246 roi=   35.7% wr=  3.8% dd=  117 pos=10/25 mean=   9.8 sd=  34.9 gini=0.556 top10=81.4%` |
| auto/enhance | `sig=  408 hit=  16 net=    168 roi=   41.2% wr=  3.9% dd=   75 pos= 7/16 mean=  10.5 sd=  35.6 gini=0.453 top10=90.4%` |
| auto/baseline | `sig=  374 hit=   5 net=   -194 roi=  -51.9% wr=  1.3% dd=  222 pos= 2/12 mean= -16.2 sd=  26.6 gini=0.520 top10=97.1%` |
| auto/observe | `sig=  363 hit=  12 net=     69 roi=   19.0% wr=  3.3% dd=  207 pos= 3/10 mean=   6.9 sd=  51.9 gini=0.559 top10=100.0%` |
| none/baseline | `sig=  239 hit=   2 net=   -167 roi=  -69.9% wr=  0.8% dd=  182 pos= 1/14 mean= -11.9 sd=  18.7 gini=0.479 top10=96.2%` |
| none/block | `sig=  230 hit=  11 net=    166 roi=   72.2% wr=  4.8% dd=   48 pos= 6/12 mean=  13.8 sd=  28.8 gini=0.488 top10=97.0%` |
| none/observe | `sig=    4 hit=   0 net=     -4 roi= -100.0% wr=  0.0% dd=    4 pos= 0/1  mean=  -4.0 sd=   0.0 gini=0.000 top10=100.0%` |
| none/enhance | `sig=    2 hit=   0 net=     -2 roi= -100.0% wr=  0.0% dd=    2 pos= 0/1  mean=  -2.0 sd=   0.0 gini=0.000 top10=100.0%` |
