# Table Strategy Focused Deep Dive

Focus strategies: `stable-exact160-recent3` and `intersection160-zone`.

No-future rule: each session uses only prior sessions to build auto table state / TableProfile / table card; each signal uses only the current prefix before the result spin.

SP100: overall/year/latest10 use all eligible post-200 spins in that scope. Other diagnostic splits use active-session eligible spins for that split.

## Dataset: data_2026.6.11.json
- sessions: 133
- eligible post-200 spins: 11241

### Focus Strategy Overall
| strategy | summary + SP100 | no-future rule |
|---|---:|---|
| stable-exact160-recent3 | `sig=  382 bet=   1146 hit=  39 net=     258 roi=   22.5% hr= 10.2% avgBet=3.0 dd=  159 pos= 3/16 gini=0.705 top10=96.9% sp100=3.40` | prior sessions + current prefix only |
| intersection160-zone | `sig=  588 bet=   4116 hit= 127 net=     456 roi=   11.1% hr= 21.6% avgBet=7.0 dd=  373 pos=12/22 gini=0.557 top10=87.6% sp100=5.23` | prior sessions + current prefix only |

### Latest 10 Sessions Summary
| strategy | summary + SP100 |
|---|---:|
| stable-exact160-recent3 | `sig=  290 bet=    870 hit=  32 net=     282 roi=   32.4% hr= 11.0% avgBet=3.0 dd=  123 pos= 1/7  gini=0.740 top10=100.0% sp100=9.80` |
| intersection160-zone | `sig=  365 bet=   2555 hit=  84 net=     469 roi=   18.4% hr= 23.0% avgBet=7.0 dd=  141 pos= 3/7  gini=0.599 top10=100.0% sp100=12.34` |

### Latest 10 Sessions Detail
| # | date | session | prior sessions used | spins post-200 | stable summary | intersection summary | signal table snapshots |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | 2026-06-01 | 20260601-1630-澳门永利 | 123 | 108 | `sig=36 bet=108 hit=3 net=0 roi=0.0% sp100=33.33 dd=57` | `sig=36 bet=252 hit=7 net=0 roi=0.0% sp100=33.33 dd=74` | stable: auto_42/small-sample/probable<br>auto_15/small-sample/confirmed<br>intersection: auto_42/small-sample/probable<br>auto_15/small-sample/confirmed |
| 2 | 2026-06-01 | 20260602-0018-澳门永利 | 124 | 167 | `sig=20 bet=60 hit=1 net=-24 roi=-40.0% sp100=11.98 dd=51` | `sig=25 bet=175 hit=3 net=-67 roi=-38.3% sp100=14.97 dd=96` | stable: auto_21/small-sample/confirmed<br>intersection: auto_21/small-sample/confirmed<br>auto_01/mixed-core/probable |
| 3 | 2026-06-02 | 20260603-0030-澳门永利 | 125 | 609 | `sig=192 bet=576 hit=26 net=360 roi=62.5% sp100=31.53 dd=93` | `sig=192 bet=1344 hit=49 net=420 roi=31.3% sp100=31.53 dd=84` | stable: auto_37/small-sample/confirmed<br>auto_50/small-sample/probable<br>intersection: auto_37/small-sample/confirmed<br>auto_50/small-sample/probable |
| 4 | 2026-06-02 | 20260603-0230-澳门永利 | 126 | 77 | `-` | `-` | stable: -<br>intersection: - |
| 5 | 2026-06-03 | 20260603-2101-澳门永利 | 127 | 399 | `sig=8 bet=24 hit=0 net=-24 roi=-100.0% sp100=2.01 dd=24` | `sig=56 bet=392 hit=14 net=112 roi=28.6% sp100=14.04 dd=49` | stable: auto_42/small-sample/confirmed<br>intersection: auto_42/small-sample/confirmed<br>auto_53/small-sample/probable |
| 6 | 2026-06-04 | 20260604-1630-澳门永利 | 128 | 318 | `sig=4 bet=12 hit=0 net=-12 roi=-100.0% sp100=1.26 dd=12` | `sig=4 bet=28 hit=0 net=-28 roi=-100.0% sp100=1.26 dd=28` | stable: auto_52/small-sample/probable<br>intersection: auto_52/small-sample/probable |
| 7 | 2026-06-05 | 20260605-0230-澳门永利 | 129 | 111 | `sig=1 bet=3 hit=0 net=-3 roi=-100.0% sp100=0.90 dd=3` | `sig=23 bet=161 hit=6 net=55 roi=34.2% sp100=20.72 dd=63` | stable: auto_51/single-core/probable<br>intersection: auto_51/single-core/probable<br>auto_45/multi-core/confirmed |
| 8 | 2026-06-05 | 20260604-2223-澳门永利 | 130 | 53 | `-` | `-` | stable: -<br>intersection: - |
| 9 | 2026-06-10 | 20260606-0131-澳门永利 | 131 | 556 | `sig=29 bet=87 hit=2 net=-15 roi=-17.2% sp100=5.22 dd=63` | `sig=29 bet=203 hit=5 net=-23 roi=-11.3% sp100=5.22 dd=84` | stable: auto_15/small-sample/confirmed<br>auto_52/single-core/probable<br>intersection: auto_15/small-sample/confirmed<br>auto_52/single-core/probable |
| 10 | 2026-06-10 | 20260607-0217-澳门永利 | 132 | 561 | `-` | `-` | stable: -<br>intersection: - |

### By Year: stable-exact160-recent3
| key | summary + SP100 |
|---|---:|
| 2019 | `sig=    2 bet=      6 hit=   0 net=      -6 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    6 pos= 0/1  gini=0.000 top10=100.0% sp100=0.15` |
| 2021 | `sig=    9 bet=     27 hit=   3 net=      81 roi=  300.0% hr= 33.3% avgBet=3.0 dd=    6 pos= 2/2  gini=0.204 top10=100.0% sp100=0.55` |
| 2023 | `sig=    6 bet=     18 hit=   0 net=     -18 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   18 pos= 0/1  gini=0.000 top10=100.0% sp100=0.91` |
| 2025 | `sig=    8 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   24 pos= 0/2  gini=0.125 top10=100.0% sp100=1.77` |
| 2026 | `sig=  357 bet=   1071 hit=  36 net=     225 roi=   21.0% hr= 10.1% avgBet=3.0 dd=  135 pos= 1/10 gini=0.757 top10=100.0% sp100=5.18` |

### By Year: intersection160-zone
| key | summary + SP100 |
|---|---:|
| 2019 | `sig=   16 bet=    112 hit=   4 net=      32 roi=   28.6% hr= 25.0% avgBet=7.0 dd=   42 pos= 1/2  gini=0.267 top10=100.0% sp100=1.17` |
| 2021 | `sig=    9 bet=     63 hit=   3 net=      45 roi=   71.4% hr= 33.3% avgBet=7.0 dd=   14 pos= 2/2  gini=0.322 top10=100.0% sp100=0.55` |
| 2023 | `sig=   41 bet=    287 hit=   4 net=    -143 roi=  -49.8% hr=  9.8% avgBet=7.0 dd=  158 pos= 0/3  gini=0.513 top10=100.0% sp100=6.22` |
| 2025 | `sig=   21 bet=    147 hit=   1 net=    -111 roi=  -75.5% hr=  4.8% avgBet=7.0 dd=  140 pos= 1/3  gini=0.359 top10=100.0% sp100=4.65` |
| 2026 | `sig=  501 bet=   3507 hit= 115 net=     633 roi=   18.0% hr= 23.0% avgBet=7.0 dd=  141 pos= 8/12 gini=0.573 top10=98.8% sp100=7.27` |

### Stable vs Intersection Same-Spin Overlap
| slice | summary + SP100 |
|---|---:|
| stable in both spins | `sig=  382 bet=   1146 hit=  39 net=     258 roi=   22.5% hr= 10.2% avgBet=3.0 dd=  159 pos= 3/16 gini=0.705 top10=96.9% sp100=8.97` |
| stable only | `sig=    0 bet=      0 hit=   0 net=       0 roi=    0.0% hr=  0.0% avgBet=0.0 dd=    0 pos= 0/0  gini=0.000 top10=0.0% sp100=0.00` |
| intersection in both spins | `sig=  382 bet=   2674 hit=  85 net=     386 roi=   14.4% hr= 22.3% avgBet=7.0 dd=  154 pos= 6/16 gini=0.661 top10=96.9% sp100=8.97` |
| intersection only | `sig=  206 bet=   1442 hit=  42 net=      70 roi=    4.9% hr= 20.4% avgBet=7.0 dd=  294 pos= 6/11 gini=0.397 top10=99.0% sp100=10.48` |

- intersection extra-ring hits when stable missed on the same spin: 46

### Hot Number Overlap With Focus Strategies
| slice | summary + SP100 |
|---|---:|
| stable-exact160-recent3 / original strategy | `sig=  382 bet=   1146 hit=  39 net=     258 roi=   22.5% hr= 10.2% avgBet=3.0 dd=  159 pos= 3/16 gini=0.705 top10=96.9% sp100=3.40` |
| stable-exact160-recent3 / hot-overlap single number | `sig=   24 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=1.0 dd=   24 pos= 0/3  gini=0.306 top10=100.0% sp100=0.21` |
| stable-exact160-recent3 / strategy zone when hot overlaps | `sig=   24 bet=     72 hit=   0 net=     -72 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   72 pos= 0/3  gini=0.306 top10=100.0% sp100=0.21` |
| stable-exact160-recent3 / strategy zone without hot overlap | `sig=  358 bet=   1074 hit=  39 net=     330 roi=   30.7% hr= 10.9% avgBet=3.0 dd=  123 pos= 4/15 gini=0.672 top10=97.5% sp100=3.18` |
| intersection160-zone / original strategy | `sig=  588 bet=   4116 hit= 127 net=     456 roi=   11.1% hr= 21.6% avgBet=7.0 dd=  373 pos=12/22 gini=0.557 top10=87.6% sp100=5.23` |
| intersection160-zone / hot-overlap single number | `sig=  106 bet=    106 hit=   4 net=      38 roi=   35.8% hr=  3.8% avgBet=1.0 dd=   33 pos= 2/7  gini=0.447 top10=100.0% sp100=0.94` |
| intersection160-zone / strategy zone when hot overlaps | `sig=  106 bet=    742 hit=  23 net=      86 roi=   11.6% hr= 21.7% avgBet=7.0 dd=  146 pos= 5/7  gini=0.401 top10=100.0% sp100=0.94` |
| intersection160-zone / strategy zone without hot overlap | `sig=  482 bet=   3374 hit= 104 net=     370 roi=   11.0% hr= 21.6% avgBet=7.0 dd=  290 pos=10/21 gini=0.546 top10=86.3% sp100=4.29` |

### Latest 10 Hot Overlap
| slice | summary + SP100 |
|---|---:|
| stable-exact160-recent3 / original strategy | `sig=  290 bet=    870 hit=  32 net=     282 roi=   32.4% hr= 11.0% avgBet=3.0 dd=  123 pos= 1/7  gini=0.740 top10=100.0% sp100=9.80` |
| stable-exact160-recent3 / hot-overlap single number | `sig=   21 bet=     21 hit=   0 net=     -21 roi= -100.0% hr=  0.0% avgBet=1.0 dd=   21 pos= 0/2  gini=0.167 top10=100.0% sp100=0.71` |
| stable-exact160-recent3 / strategy zone when hot overlaps | `sig=   21 bet=     63 hit=   0 net=     -63 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   63 pos= 0/2  gini=0.167 top10=100.0% sp100=0.71` |
| stable-exact160-recent3 / strategy zone without hot overlap | `sig=  269 bet=    807 hit=  32 net=     345 roi=   42.8% hr= 11.9% avgBet=3.0 dd=  123 pos= 2/7  gini=0.686 top10=100.0% sp100=9.09` |
| intersection160-zone / original strategy | `sig=  365 bet=   2555 hit=  84 net=     469 roi=   18.4% hr= 23.0% avgBet=7.0 dd=  141 pos= 3/7  gini=0.599 top10=100.0% sp100=12.34` |
| intersection160-zone / hot-overlap single number | `sig=   68 bet=     68 hit=   2 net=       4 roi=    5.9% hr=  2.9% avgBet=1.0 dd=   33 pos= 1/4  gini=0.288 top10=100.0% sp100=2.30` |
| intersection160-zone / strategy zone when hot overlaps | `sig=   68 bet=    476 hit=  18 net=     172 roi=   36.1% hr= 26.5% avgBet=7.0 dd=   84 pos= 4/4  gini=0.349 top10=100.0% sp100=2.30` |
| intersection160-zone / strategy zone without hot overlap | `sig=  297 bet=   2079 hit=  66 net=     297 roi=   14.3% hr= 22.2% avgBet=7.0 dd=  137 pos= 2/7  gini=0.615 top10=100.0% sp100=10.04` |

### Hot Overlap Single By Hot Mode: stable-exact160-recent3
| key | summary + SP100 |
|---|---:|
| short | `sig=    8 bet=      8 hit=   0 net=      -8 roi= -100.0% hr=  0.0% avgBet=1.0 dd=    8 pos= 0/2  gini=0.375 top10=100.0% sp100=1.12` |
| long | `sig=   16 bet=     16 hit=   0 net=     -16 roi= -100.0% hr=  0.0% avgBet=1.0 dd=   16 pos= 0/2  gini=0.313 top10=100.0% sp100=7.77` |

### Hot Overlap Strategy Zone By Table Type: stable-exact160-recent3
| key | summary + SP100 |
|---|---:|
| small-sample | `sig=   24 bet=     72 hit=   0 net=     -72 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   72 pos= 0/3  gini=0.306 top10=100.0% sp100=2.94` |

### Hot Overlap Single By Hot Mode: intersection160-zone
| key | summary + SP100 |
|---|---:|
| long | `sig=   75 bet=     75 hit=   4 net=      69 roi=   92.0% hr=  5.3% avgBet=1.0 dd=   29 pos= 2/6  gini=0.497 top10=100.0% sp100=3.97` |
| short | `sig=   31 bet=     31 hit=   0 net=     -31 roi= -100.0% hr=  0.0% avgBet=1.0 dd=   31 pos= 0/5  gini=0.387 top10=100.0% sp100=1.64` |

### Hot Overlap Strategy Zone By Table Type: intersection160-zone
| key | summary + SP100 |
|---|---:|
| small-sample | `sig=   61 bet=    427 hit=  15 net=     113 roi=   26.5% hr= 24.6% avgBet=7.0 dd=   84 pos= 4/5  gini=0.414 top10=100.0% sp100=4.03` |
| multi-core | `sig=   12 bet=     84 hit=   4 net=      60 roi=   71.4% hr= 33.3% avgBet=7.0 dd=   35 pos= 1/1  gini=0.000 top10=100.0% sp100=10.81` |
| single-core | `sig=   33 bet=    231 hit=   4 net=     -87 roi=  -37.7% hr= 12.1% avgBet=7.0 dd=  146 pos= 0/1  gini=0.000 top10=100.0% sp100=4.96` |

### Hot Number Reverse Filter View
| slice | summary + SP100 |
|---|---:|
| hot original | `sig= 2763 bet=   2763 hit=  85 net=     297 roi=   10.7% hr=  3.1% avgBet=1.0 dd=  380 pos=24/56 gini=0.502 top10=49.0% sp100=24.58` |
| hot excluding stable-overlap | `sig= 2739 bet=   2739 hit=  85 net=     321 roi=   11.7% hr=  3.1% avgBet=1.0 dd=  377 pos=24/56 gini=0.502 top10=49.1% sp100=24.37` |
| hot stable-overlap only | `sig=   24 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=1.0 dd=   24 pos= 0/3  gini=0.306 top10=100.0% sp100=0.21` |
| hot excluding intersection-overlap | `sig= 2657 bet=   2657 hit=  81 net=     259 roi=    9.7% hr=  3.0% avgBet=1.0 dd=  408 pos=24/56 gini=0.486 top10=48.1% sp100=23.64` |
| hot intersection-overlap only | `sig=  106 bet=    106 hit=   4 net=      38 roi=   35.8% hr=  3.8% avgBet=1.0 dd=   33 pos= 2/7  gini=0.447 top10=100.0% sp100=0.94` |
| hot excluding any focus-overlap | `sig= 2657 bet=   2657 hit=  81 net=     259 roi=    9.7% hr=  3.0% avgBet=1.0 dd=  408 pos=24/56 gini=0.486 top10=48.1% sp100=23.64` |
| hot any focus-overlap only | `sig=  106 bet=    106 hit=   4 net=      38 roi=   35.8% hr=  3.8% avgBet=1.0 dd=   33 pos= 2/7  gini=0.447 top10=100.0% sp100=0.94` |

### Latest 10 Hot Reverse Filter View
| slice | summary + SP100 |
|---|---:|
| hot original | `sig=  690 bet=    690 hit=  29 net=     354 roi=   51.3% hr=  4.2% avgBet=1.0 dd=   99 pos= 6/8  gini=0.368 top10=100.0% sp100=23.32` |
| hot excluding stable-overlap | `sig=  669 bet=    669 hit=  29 net=     375 roi=   56.1% hr=  4.3% avgBet=1.0 dd=   99 pos= 6/8  gini=0.354 top10=100.0% sp100=22.61` |
| hot stable-overlap only | `sig=   21 bet=     21 hit=   0 net=     -21 roi= -100.0% hr=  0.0% avgBet=1.0 dd=   21 pos= 0/2  gini=0.167 top10=100.0% sp100=0.71` |
| hot excluding intersection-overlap | `sig=  622 bet=    622 hit=  27 net=     350 roi=   56.3% hr=  4.3% avgBet=1.0 dd=   87 pos= 6/8  gini=0.307 top10=100.0% sp100=21.02` |
| hot intersection-overlap only | `sig=   68 bet=     68 hit=   2 net=       4 roi=    5.9% hr=  2.9% avgBet=1.0 dd=   33 pos= 1/4  gini=0.288 top10=100.0% sp100=2.30` |
| hot excluding any focus-overlap | `sig=  622 bet=    622 hit=  27 net=     350 roi=   56.3% hr=  4.3% avgBet=1.0 dd=   87 pos= 6/8  gini=0.307 top10=100.0% sp100=21.02` |
| hot any focus-overlap only | `sig=   68 bet=     68 hit=   2 net=       4 roi=    5.9% hr=  2.9% avgBet=1.0 dd=   33 pos= 1/4  gini=0.288 top10=100.0% sp100=2.30` |

### Hot Reverse Filter By Mode
| slice | summary + SP100 |
|---|---:|
| exclude intersection / long | `sig= 1481 bet=   1481 hit=  51 net=     355 roi=   24.0% hr=  3.4% avgBet=1.0 dd=  208 pos=22/51 gini=0.491 top10=53.0% sp100=13.17` |
| exclude intersection / short | `sig= 1176 bet=   1176 hit=  30 net=     -96 roi=   -8.2% hr=  2.6% avgBet=1.0 dd=  328 pos=15/51 gini=0.422 top10=52.6% sp100=10.46` |
| exclude stable / long | `sig= 1540 bet=   1540 hit=  55 net=     440 roi=   28.6% hr=  3.6% avgBet=1.0 dd=  210 pos=23/51 gini=0.503 top10=54.4% sp100=13.70` |
| exclude stable / short | `sig= 1199 bet=   1199 hit=  30 net=    -119 roi=   -9.9% hr=  2.5% avgBet=1.0 dd=  336 pos=15/51 gini=0.421 top10=52.5% sp100=10.67` |
| original / long | `sig= 1556 bet=   1556 hit=  55 net=     424 roi=   27.2% hr=  3.5% avgBet=1.0 dd=  210 pos=23/51 gini=0.500 top10=54.6% sp100=13.84` |
| original / short | `sig= 1207 bet=   1207 hit=  30 net=    -127 roi=  -10.5% hr=  2.5% avgBet=1.0 dd=  336 pos=15/51 gini=0.428 top10=52.7% sp100=10.74` |

## Deep Splits: data_2026.6.11.json / stable-exact160-recent3

### By Table Type
| key | summary + SP100 |
|---|---:|
| small-sample | `sig=  308 bet=    924 hit=  33 net=     264 roi=   28.6% hr= 10.7% avgBet=3.0 dd=  114 pos= 2/12 gini=0.724 top10=99.0% sp100=9.31` |
| single-core | `sig=   74 bet=    222 hit=   6 net=      -6 roi=   -2.7% hr=  8.1% avgBet=3.0 dd=   96 pos= 1/5  gini=0.520 top10=100.0% sp100=4.92` |

### By Assignment Level
| key | summary + SP100 |
|---|---:|
| probable | `sig=  250 bet=    750 hit=  32 net=     402 roi=   53.6% hr= 12.8% avgBet=3.0 dd=   93 pos= 4/9  gini=0.711 top10=100.0% sp100=9.67` |
| confirmed | `sig=  132 bet=    396 hit=   7 net=    -144 roi=  -36.4% hr=  5.3% avgBet=3.0 dd=  165 pos= 2/11 gini=0.446 top10=99.2% sp100=3.66` |

### By Prior Card Session Count
| key | summary + SP100 |
|---|---:|
| 02 | `sig=  217 bet=    651 hit=  26 net=     285 roi=   43.8% hr= 12.0% avgBet=3.0 dd=   93 pos= 1/4  gini=0.644 top10=100.0% sp100=22.10` |
| 03-04 | `sig=    9 bet=     27 hit=   2 net=      45 roi=  166.7% hr= 22.2% avgBet=3.0 dd=   15 pos= 1/4  gini=0.598 top10=100.0% sp100=1.07` |
| 01 | `sig=   91 bet=    273 hit=   7 net=     -21 roi=   -7.7% hr=  7.7% avgBet=3.0 dd=   96 pos= 3/10 gini=0.284 top10=100.0% sp100=2.99` |
| 05-08 | `sig=   65 bet=    195 hit=   4 net=     -51 roi=  -26.2% hr=  6.2% avgBet=3.0 dd=   96 pos= 0/1  gini=0.000 top10=100.0% sp100=9.77` |

### By Prior Card Total Numbers
| key | summary + SP100 |
|---|---:|
| <500 | `sig=  276 bet=    828 hit=  32 net=     324 roi=   39.1% hr= 11.6% avgBet=3.0 dd=  102 pos= 3/9  gini=0.710 top10=100.0% sp100=10.13` |
| 1000-1999 | `sig=   74 bet=    222 hit=   6 net=      -6 roi=   -2.7% hr=  8.1% avgBet=3.0 dd=   96 pos= 1/5  gini=0.520 top10=100.0% sp100=4.92` |
| 500-999 | `sig=   32 bet=     96 hit=   1 net=     -60 roi=  -62.5% hr=  3.1% avgBet=3.0 dd=   63 pos= 0/4  gini=0.200 top10=100.0% sp100=4.63` |

### By Primary Stability
| key | summary + SP100 |
|---|---:|
| 0.70+ | `sig=  305 bet=    915 hit=  33 net=     273 roi=   29.8% hr= 10.8% avgBet=3.0 dd=  117 pos= 3/14 gini=0.715 top10=98.4% sp100=8.53` |
| 0.45-0.69 | `sig=   77 bet=    231 hit=   6 net=     -15 roi=   -6.5% hr=  7.8% avgBet=3.0 dd=   96 pos= 1/4  gini=0.366 top10=100.0% sp100=5.72` |

### By Table Top1 Z
| key | summary + SP100 |
|---|---:|
| 2.0+ | `sig=  368 bet=   1104 hit=  38 net=     264 roi=   23.9% hr= 10.3% avgBet=3.0 dd=  141 pos= 2/12 gini=0.718 top10=99.5% sp100=11.33` |
| 1.5-1.99 | `sig=   14 bet=     42 hit=   1 net=      -6 roi=  -14.3% hr=  7.1% avgBet=3.0 dd=   27 pos= 1/5  gini=0.378 top10=100.0% sp100=0.89` |

### By Current 160-Window Z
| key | summary + SP100 |
|---|---:|
| 1.0-1.49 | `sig=   58 bet=    174 hit=   9 net=     150 roi=   86.2% hr= 15.5% avgBet=3.0 dd=   45 pos= 5/10 gini=0.500 top10=100.0% sp100=2.24` |
| 2.0+ | `sig=  205 bet=    615 hit=  20 net=     105 roi=   17.1% hr=  9.8% avgBet=3.0 dd=  117 pos= 1/9  gini=0.708 top10=100.0% sp100=7.21` |
| <1.0 | `sig=    6 bet=     18 hit=   1 net=      18 roi=  100.0% hr= 16.7% avgBet=3.0 dd=   15 pos= 1/1  gini=0.000 top10=100.0% sp100=0.99` |
| 1.5-1.99 | `sig=  113 bet=    339 hit=   9 net=     -15 roi=   -4.4% hr=  8.0% avgBet=3.0 dd=   81 pos= 2/8  gini=0.428 top10=100.0% sp100=4.53` |

### By Candidate Count
| key | summary + SP100 |
|---|---:|
| 3 | `sig=  382 bet=   1146 hit=  39 net=     258 roi=   22.5% hr= 10.2% avgBet=3.0 dd=  159 pos= 3/16 gini=0.705 top10=96.9% sp100=8.97` |

### By Venue
| key | summary + SP100 |
|---|---:|
| 澳门永利 | `sig=  290 bet=    870 hit=  32 net=     282 roi=   32.4% hr= 11.0% avgBet=3.0 dd=  123 pos= 1/7  gini=0.740 top10=100.0% sp100=12.79` |
| unknown | `sig=    5 bet=     15 hit=   2 net=      57 roi=  380.0% hr= 40.0% avgBet=3.0 dd=    3 pos= 1/1  gini=0.000 top10=100.0% sp100=31.25` |
| 01 | `sig=    2 bet=      6 hit=   0 net=      -6 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    6 pos= 0/1  gini=0.000 top10=100.0% sp100=0.69` |
| 伦敦人 | `sig=    6 bet=     18 hit=   0 net=     -18 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   18 pos= 0/1  gini=0.000 top10=100.0% sp100=13.64` |
| 喜来登 | `sig=    8 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   24 pos= 0/2  gini=0.125 top10=100.0% sp100=6.45` |
| wzs | `sig=   71 bet=    213 hit=   5 net=     -33 roi=  -15.5% hr=  7.0% avgBet=3.0 dd=   96 pos= 1/4  gini=0.509 top10=100.0% sp100=4.68` |

### Top Evolving Table Cards
| key | summary + SP100 |
|---|---:|
| auto_50 / small-sample | `sig=  189 bet=    567 hit=  25 net=     333 roi=   58.7% hr= 13.2% avgBet=3.0 dd=   93 pos= 1/1  gini=0.000 top10=100.0% sp100=31.03` |
| auto_06 / single-core | `sig=    5 bet=     15 hit=   2 net=      57 roi=  380.0% hr= 40.0% avgBet=3.0 dd=    3 pos= 1/1  gini=0.000 top10=100.0% sp100=31.25` |
| auto_37 / small-sample | `sig=    3 bet=      9 hit=   1 net=      27 roi=  300.0% hr= 33.3% avgBet=3.0 dd=    6 pos= 1/1  gini=0.000 top10=100.0% sp100=0.49` |
| auto_15 / small-sample | `sig=   36 bet=    108 hit=   3 net=       0 roi=    0.0% hr=  8.3% avgBet=3.0 dd=   57 pos= 1/3  gini=0.208 top10=100.0% sp100=3.34` |
| auto_07 / single-core | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.64` |
| auto_38 / small-sample | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.36` |
| auto_51 / single-core | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.90` |
| auto_01 / small-sample | `sig=    2 bet=      6 hit=   0 net=      -6 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    6 pos= 0/1  gini=0.000 top10=100.0% sp100=0.69` |
| auto_52 / single-core | `sig=    2 bet=      6 hit=   0 net=      -6 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    6 pos= 0/1  gini=0.000 top10=100.0% sp100=0.36` |
| auto_42 / small-sample | `sig=   39 bet=    117 hit=   3 net=      -9 roi=   -7.7% hr=  7.7% avgBet=3.0 dd=   57 pos= 1/2  gini=0.115 top10=100.0% sp100=7.69` |
| auto_19 / small-sample | `sig=    3 bet=      9 hit=   0 net=      -9 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    9 pos= 0/1  gini=0.000 top10=100.0% sp100=3.06` |
| auto_52 / small-sample | `sig=    4 bet=     12 hit=   0 net=     -12 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   12 pos= 0/1  gini=0.000 top10=100.0% sp100=1.26` |
| auto_20 / small-sample | `sig=    5 bet=     15 hit=   0 net=     -15 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   15 pos= 0/1  gini=0.000 top10=100.0% sp100=19.23` |
| auto_36 / small-sample | `sig=    6 bet=     18 hit=   0 net=     -18 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   18 pos= 0/1  gini=0.000 top10=100.0% sp100=13.64` |
| auto_21 / small-sample | `sig=   20 bet=     60 hit=   1 net=     -24 roi=  -40.0% hr=  5.0% avgBet=3.0 dd=   51 pos= 0/1  gini=0.000 top10=100.0% sp100=11.98` |
| auto_05 / single-core | `sig=   65 bet=    195 hit=   4 net=     -51 roi=  -26.2% hr=  6.2% avgBet=3.0 dd=   96 pos= 0/1  gini=0.000 top10=100.0% sp100=9.77` |

### Per-Session Net
| key | summary + SP100 |
|---|---:|
| 2026-06-02 / 20260603-0030-澳门永利 | `sig=  192 bet=    576 hit=  26 net=     360 roi=   62.5% hr= 13.5% avgBet=3.0 dd=   93 pos= 1/1  gini=0.000 top10=100.0% sp100=31.53` |
| 2021-06-17 / 20210617-1819 | `sig=    5 bet=     15 hit=   2 net=      57 roi=  380.0% hr= 40.0% avgBet=3.0 dd=    3 pos= 1/1  gini=0.000 top10=100.0% sp100=31.25` |
| 2021-04-23 / wzs-2021-04-23-063 | `sig=    4 bet=     12 hit=   1 net=      24 roi=  200.0% hr= 25.0% avgBet=3.0 dd=    6 pos= 1/1  gini=0.000 top10=100.0% sp100=0.97` |
| 2026-06-01 / 20260601-1630-澳门永利 | `sig=   36 bet=    108 hit=   3 net=       0 roi=    0.0% hr=  8.3% avgBet=3.0 dd=   57 pos= 0/1  gini=0.000 top10=100.0% sp100=33.33` |
| 2026-01-11 / wzs-2026-01-11-606 | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.64` |
| 2026-05-11 / wzs-2026-05-11-803 | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.36` |
| 2026-06-05 / 20260605-0230-澳门永利 | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.90` |
| 2019-01-16 / 20181129-01 | `sig=    2 bet=      6 hit=   0 net=      -6 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    6 pos= 0/1  gini=0.000 top10=100.0% sp100=0.69` |
| 2025-12-02 / 20251202-晚上-喜来登 | `sig=    3 bet=      9 hit=   0 net=      -9 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    9 pos= 0/1  gini=0.000 top10=100.0% sp100=3.06` |
| 2026-06-04 / 20260604-1630-澳门永利 | `sig=    4 bet=     12 hit=   0 net=     -12 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   12 pos= 0/1  gini=0.000 top10=100.0% sp100=1.26` |
| 2026-06-10 / 20260606-0131-澳门永利 | `sig=   29 bet=     87 hit=   2 net=     -15 roi=  -17.2% hr=  6.9% avgBet=3.0 dd=   63 pos= 0/1  gini=0.000 top10=100.0% sp100=5.22` |
| 2025-11-03 / 20251103-下午-喜来登 | `sig=    5 bet=     15 hit=   0 net=     -15 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   15 pos= 0/1  gini=0.000 top10=100.0% sp100=19.23` |
| 2023-10-24 / 20231025-凌晨-伦敦人 | `sig=    6 bet=     18 hit=   0 net=     -18 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   18 pos= 0/1  gini=0.000 top10=100.0% sp100=13.64` |
| 2026-06-01 / 20260602-0018-澳门永利 | `sig=   20 bet=     60 hit=   1 net=     -24 roi=  -40.0% hr=  5.0% avgBet=3.0 dd=   51 pos= 0/1  gini=0.000 top10=100.0% sp100=11.98` |
| 2026-06-03 / 20260603-2101-澳门永利 | `sig=    8 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   24 pos= 0/1  gini=0.000 top10=100.0% sp100=2.01` |
| 2026-01-11 / wzs-2026-01-11-604 | `sig=   65 bet=    195 hit=   4 net=     -51 roi=  -26.2% hr=  6.2% avgBet=3.0 dd=   96 pos= 0/1  gini=0.000 top10=100.0% sp100=9.77` |

## Deep Splits: data_2026.6.11.json / intersection160-zone

### By Table Type
| key | summary + SP100 |
|---|---:|
| small-sample | `sig=  370 bet=   2590 hit=  86 net=     506 roi=   19.5% hr= 23.2% avgBet=7.0 dd=  106 pos= 6/13 gini=0.679 top10=98.4% sp100=10.26` |
| single-core | `sig=   74 bet=    518 hit=  16 net=      58 roi=   11.2% hr= 21.6% avgBet=7.0 dd=  119 pos= 2/5  gini=0.400 top10=100.0% sp100=4.92` |
| mixed-core | `sig=   76 bet=    532 hit=  14 net=     -28 roi=   -5.3% hr= 18.4% avgBet=7.0 dd=  131 pos= 3/5  gini=0.331 top10=100.0% sp100=9.71` |
| multi-core | `sig=   68 bet=    476 hit=  11 net=     -80 roi=  -16.8% hr= 16.2% avgBet=7.0 dd=  165 pos= 1/5  gini=0.429 top10=100.0% sp100=11.93` |

### By Assignment Level
| key | summary + SP100 |
|---|---:|
| probable | `sig=  377 bet=   2639 hit=  91 net=     637 roi=   24.1% hr= 24.1% avgBet=7.0 dd=  132 pos=10/17 gini=0.557 top10=94.2% sp100=9.40` |
| confirmed | `sig=  211 bet=   1477 hit=  36 net=    -181 roi=  -12.3% hr= 17.1% avgBet=7.0 dd=  268 pos= 5/15 gini=0.447 top10=92.9% sp100=4.82` |

### By Prior Card Session Count
| key | summary + SP100 |
|---|---:|
| 02 | `sig=  231 bet=   1617 hit=  56 net=     399 roi=   24.7% hr= 24.2% avgBet=7.0 dd=  108 pos= 3/5  gini=0.596 top10=100.0% sp100=18.05` |
| 01 | `sig=  139 bet=    973 hit=  30 net=     107 roi=   11.0% hr= 21.6% avgBet=7.0 dd=   91 pos= 5/10 gini=0.457 top10=100.0% sp100=4.57` |
| 05-08 | `sig=  141 bet=    987 hit=  29 net=      57 roi=    5.8% hr= 20.6% avgBet=7.0 dd=  203 pos= 3/5  gini=0.357 top10=100.0% sp100=11.04` |
| 09+ | `sig=    7 bet=     49 hit=   1 net=     -13 roi=  -26.5% hr= 14.3% avgBet=7.0 dd=   42 pos= 1/2  gini=0.114 top10=100.0% sp100=2.59` |
| 03-04 | `sig=   70 bet=    490 hit=  11 net=     -94 roi=  -19.2% hr= 15.7% avgBet=7.0 dd=  193 pos= 2/7  gini=0.437 top10=100.0% sp100=5.83` |

### By Prior Card Total Numbers
| key | summary + SP100 |
|---|---:|
| <500 | `sig=  290 bet=   2030 hit=  69 net=     454 roi=   22.4% hr= 23.8% avgBet=7.0 dd=  110 pos= 5/10 gini=0.674 top10=100.0% sp100=9.59` |
| 1000-1999 | `sig=  179 bet=   1253 hit=  37 net=      79 roi=    6.3% hr= 20.7% avgBet=7.0 dd=  231 pos= 5/9  gini=0.367 top10=100.0% sp100=9.11` |
| 2000+ | `sig=    7 bet=     49 hit=   1 net=     -13 roi=  -26.5% hr= 14.3% avgBet=7.0 dd=   42 pos= 1/2  gini=0.114 top10=100.0% sp100=2.59` |
| 500-999 | `sig=  112 bet=    784 hit=  20 net=     -64 roi=   -8.2% hr= 17.9% avgBet=7.0 dd=  168 pos= 2/6  gini=0.397 top10=100.0% sp100=8.22` |

### By Primary Stability
| key | summary + SP100 |
|---|---:|
| 0.70+ | `sig=  353 bet=   2471 hit=  82 net=     481 roi=   19.5% hr= 23.2% avgBet=7.0 dd=   98 pos= 6/14 gini=0.675 top10=98.6% sp100=9.87` |
| 0.45-0.69 | `sig=   77 bet=    539 hit=  16 net=      37 roi=    6.9% hr= 20.8% avgBet=7.0 dd=  119 pos= 2/4  gini=0.198 top10=100.0% sp100=5.72` |
| <0.45 | `sig=  158 bet=   1106 hit=  29 net=     -62 roi=   -5.6% hr= 18.4% avgBet=7.0 dd=  294 pos= 5/10 gini=0.378 top10=100.0% sp100=10.08` |

### By Table Top1 Z
| key | summary + SP100 |
|---|---:|
| 2.0+ | `sig=  490 bet=   3430 hit= 102 net=     242 roi=    7.1% hr= 20.8% avgBet=7.0 dd=  338 pos= 7/18 gini=0.642 top10=93.5% sp100=12.00` |
| <1.0 | `sig=   48 bet=    336 hit=  13 net=     132 roi=   39.3% hr= 27.1% avgBet=7.0 dd=   49 pos= 1/1  gini=0.000 top10=100.0% sp100=12.03` |
| 1.5-1.99 | `sig=   50 bet=    350 hit=  12 net=      82 roi=   23.4% hr= 24.0% avgBet=7.0 dd=   69 pos= 4/7  gini=0.339 top10=100.0% sp100=2.53` |

### By Current 160-Window Z
| key | summary + SP100 |
|---|---:|
| 1.0-1.49 | `sig=  112 bet=    784 hit=  26 net=     152 roi=   19.4% hr= 23.2% avgBet=7.0 dd=   82 pos= 8/13 gini=0.453 top10=95.5% sp100=3.47` |
| 1.5-1.99 | `sig=  186 bet=   1302 hit=  40 net=     138 roi=   10.6% hr= 21.5% avgBet=7.0 dd=  183 pos= 9/17 gini=0.612 top10=90.9% sp100=4.34` |
| 2.0+ | `sig=  282 bet=   1974 hit=  58 net=     114 roi=    5.8% hr= 20.6% avgBet=7.0 dd=  237 pos= 6/13 gini=0.474 top10=98.2% sp100=8.49` |
| <1.0 | `sig=    8 bet=     56 hit=   3 net=      52 roi=   92.9% hr= 37.5% avgBet=7.0 dd=   28 pos= 2/2  gini=0.077 top10=100.0% sp100=0.90` |

### By Candidate Count
| key | summary + SP100 |
|---|---:|
| 7 | `sig=  588 bet=   4116 hit= 127 net=     456 roi=   11.1% hr= 21.6% avgBet=7.0 dd=  373 pos=12/22 gini=0.557 top10=87.6% sp100=11.51` |

### By Venue
| key | summary + SP100 |
|---|---:|
| 澳门永利 | `sig=  365 bet=   2555 hit=  84 net=     469 roi=   18.4% hr= 23.0% avgBet=7.0 dd=  141 pos= 3/7  gini=0.599 top10=100.0% sp100=16.09` |
| 电 | `sig=   14 bet=     98 hit=   4 net=      46 roi=   46.9% hr= 28.6% avgBet=7.0 dd=   42 pos= 1/1  gini=0.000 top10=100.0% sp100=4.70` |
| 威尼斯人 | `sig=   30 bet=    210 hit=   7 net=      42 roi=   20.0% hr= 23.3% avgBet=7.0 dd=   56 pos= 1/1  gini=0.000 top10=100.0% sp100=35.71` |
| wzs | `sig=  123 bet=    861 hit=  25 net=      39 roi=    4.5% hr= 20.3% avgBet=7.0 dd=  210 pos= 5/6  gini=0.376 top10=100.0% sp100=7.20` |
| 伦敦人 | `sig=    6 bet=     42 hit=   1 net=      -6 roi=  -14.3% hr= 16.7% avgBet=7.0 dd=   21 pos= 0/1  gini=0.000 top10=100.0% sp100=13.64` |
| 01 | `sig=    2 bet=     14 hit=   0 net=     -14 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   14 pos= 0/1  gini=0.000 top10=100.0% sp100=0.69` |
| 喜来登 | `sig=    8 bet=     56 hit=   1 net=     -20 roi=  -35.7% hr= 12.5% avgBet=7.0 dd=   49 pos= 1/2  gini=0.200 top10=100.0% sp100=6.45` |
| unknown | `sig=   40 bet=    280 hit=   5 net=    -100 roi=  -35.7% hr= 12.5% avgBet=7.0 dd=  159 pos= 1/3  gini=0.364 top10=100.0% sp100=13.70` |

### Top Evolving Table Cards
| key | summary + SP100 |
|---|---:|
| auto_50 / small-sample | `sig=  189 bet=   1323 hit=  48 net=     405 roi=   30.6% hr= 25.4% avgBet=7.0 dd=   84 pos= 1/1  gini=0.000 top10=100.0% sp100=31.03` |
| auto_53 / small-sample | `sig=   48 bet=    336 hit=  13 net=     132 roi=   39.3% hr= 27.1% avgBet=7.0 dd=   49 pos= 1/1  gini=0.000 top10=100.0% sp100=12.03` |
| auto_45 / multi-core | `sig=   22 bet=    154 hit=   6 net=      62 roi=   40.3% hr= 27.3% avgBet=7.0 dd=   63 pos= 1/1  gini=0.000 top10=100.0% sp100=19.82` |
| auto_05 / single-core | `sig=   65 bet=    455 hit=  14 net=      49 roi=   10.8% hr= 21.5% avgBet=7.0 dd=  112 pos= 1/1  gini=0.000 top10=100.0% sp100=9.77` |
| auto_05 / small-sample | `sig=   14 bet=     98 hit=   4 net=      46 roi=   46.9% hr= 28.6% avgBet=7.0 dd=   42 pos= 1/1  gini=0.000 top10=100.0% sp100=4.70` |
| auto_06 / single-core | `sig=    5 bet=     35 hit=   2 net=      37 roi=  105.7% hr= 40.0% avgBet=7.0 dd=    7 pos= 1/1  gini=0.000 top10=100.0% sp100=31.25` |
| auto_38 / small-sample | `sig=    1 bet=      7 hit=   1 net=      29 roi=  414.3% hr=100.0% avgBet=7.0 dd=    0 pos= 1/1  gini=0.000 top10=100.0% sp100=0.36` |
| auto_01 / mixed-core | `sig=   18 bet=    126 hit=   4 net=      18 roi=   14.3% hr= 22.2% avgBet=7.0 dd=   42 pos= 2/3  gini=0.098 top10=100.0% sp100=4.22` |
| auto_42 / small-sample | `sig=   39 bet=    273 hit=   8 net=      15 roi=    5.5% hr= 20.5% avgBet=7.0 dd=   63 pos= 1/2  gini=0.136 top10=100.0% sp100=7.69` |
| auto_19 / small-sample | `sig=    3 bet=     21 hit=   1 net=      15 roi=   71.4% hr= 33.3% avgBet=7.0 dd=   14 pos= 1/1  gini=0.000 top10=100.0% sp100=3.06` |
| auto_37 / small-sample | `sig=    3 bet=     21 hit=   1 net=      15 roi=   71.4% hr= 33.3% avgBet=7.0 dd=   14 pos= 1/1  gini=0.000 top10=100.0% sp100=0.49` |
| auto_21 / multi-core | `sig=   26 bet=    182 hit=   5 net=      -2 roi=   -1.1% hr= 19.2% avgBet=7.0 dd=   69 pos= 0/1  gini=0.000 top10=100.0% sp100=9.25` |
| auto_36 / small-sample | `sig=    6 bet=     42 hit=   1 net=      -6 roi=  -14.3% hr= 16.7% avgBet=7.0 dd=   21 pos= 0/1  gini=0.000 top10=100.0% sp100=13.64` |
| auto_07 / single-core | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=0.64` |
| auto_51 / single-core | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=0.90` |
| auto_01 / small-sample | `sig=    2 bet=     14 hit=   0 net=     -14 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   14 pos= 0/1  gini=0.000 top10=100.0% sp100=0.69` |
| auto_52 / single-core | `sig=    2 bet=     14 hit=   0 net=     -14 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   14 pos= 0/1  gini=0.000 top10=100.0% sp100=0.36` |
| auto_29 / multi-core | `sig=    4 bet=     28 hit=   0 net=     -28 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   28 pos= 0/1  gini=0.000 top10=100.0% sp100=4.76` |
| auto_52 / small-sample | `sig=    4 bet=     28 hit=   0 net=     -28 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   28 pos= 0/1  gini=0.000 top10=100.0% sp100=1.26` |
| auto_21 / small-sample | `sig=   20 bet=    140 hit=   3 net=     -32 roi=  -22.9% hr= 15.0% avgBet=7.0 dd=   84 pos= 0/1  gini=0.000 top10=100.0% sp100=11.98` |

### Per-Session Net
| key | summary + SP100 |
|---|---:|
| 2026-06-02 / 20260603-0030-澳门永利 | `sig=  192 bet=   1344 hit=  49 net=     420 roi=   31.3% hr= 25.5% avgBet=7.0 dd=   84 pos= 1/1  gini=0.000 top10=100.0% sp100=31.53` |
| 2026-06-03 / 20260603-2101-澳门永利 | `sig=   56 bet=    392 hit=  14 net=     112 roi=   28.6% hr= 25.0% avgBet=7.0 dd=   49 pos= 1/1  gini=0.000 top10=100.0% sp100=14.04` |
| 2026-06-05 / 20260605-0230-澳门永利 | `sig=   23 bet=    161 hit=   6 net=      55 roi=   34.2% hr= 26.1% avgBet=7.0 dd=   63 pos= 1/1  gini=0.000 top10=100.0% sp100=20.72` |
| 2026-01-11 / wzs-2026-01-11-604 | `sig=   65 bet=    455 hit=  14 net=      49 roi=   10.8% hr= 21.5% avgBet=7.0 dd=  112 pos= 1/1  gini=0.000 top10=100.0% sp100=9.77` |
| 2019-11-17 / 20191010-清晨-喜来登-电 | `sig=   14 bet=     98 hit=   4 net=      46 roi=   46.9% hr= 28.6% avgBet=7.0 dd=   42 pos= 1/1  gini=0.000 top10=100.0% sp100=4.70` |
| 2026-01-15 / 20260115-晚上-威尼斯人 | `sig=   30 bet=    210 hit=   7 net=      42 roi=   20.0% hr= 23.3% avgBet=7.0 dd=   56 pos= 1/1  gini=0.000 top10=100.0% sp100=35.71` |
| 2021-06-17 / 20210617-1819 | `sig=    5 bet=     35 hit=   2 net=      37 roi=  105.7% hr= 40.0% avgBet=7.0 dd=    7 pos= 1/1  gini=0.000 top10=100.0% sp100=31.25` |
| 2026-05-11 / wzs-2026-05-11-803 | `sig=   27 bet=    189 hit=   6 net=      27 roi=   14.3% hr= 22.2% avgBet=7.0 dd=   69 pos= 1/1  gini=0.000 top10=100.0% sp100=9.61` |
| 2026-01-11 / wzs-2026-01-11-606 | `sig=   12 bet=     84 hit=   3 net=      24 roi=   28.6% hr= 25.0% avgBet=7.0 dd=   28 pos= 1/1  gini=0.000 top10=100.0% sp100=7.64` |
| 2026-05-11 / wzs-2026-05-11-802 | `sig=    2 bet=     14 hit=   1 net=      22 roi=  157.1% hr= 50.0% avgBet=7.0 dd=    7 pos= 1/1  gini=0.000 top10=100.0% sp100=1.94` |
| 2025-12-02 / 20251202-晚上-喜来登 | `sig=    3 bet=     21 hit=   1 net=      15 roi=   71.4% hr= 33.3% avgBet=7.0 dd=   14 pos= 1/1  gini=0.000 top10=100.0% sp100=3.06` |
| 2021-04-23 / wzs-2021-04-23-063 | `sig=    4 bet=     28 hit=   1 net=       8 roi=   28.6% hr= 25.0% avgBet=7.0 dd=   14 pos= 1/1  gini=0.000 top10=100.0% sp100=0.97` |
| 2026-06-01 / 20260601-1630-澳门永利 | `sig=   36 bet=    252 hit=   7 net=       0 roi=    0.0% hr= 19.4% avgBet=7.0 dd=   74 pos= 0/1  gini=0.000 top10=100.0% sp100=33.33` |
| 2023-10-24 / 20231025-凌晨-伦敦人 | `sig=    6 bet=     42 hit=   1 net=      -6 roi=  -14.3% hr= 16.7% avgBet=7.0 dd=   21 pos= 0/1  gini=0.000 top10=100.0% sp100=13.64` |
| 2019-01-16 / 20181129-01 | `sig=    2 bet=     14 hit=   0 net=     -14 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   14 pos= 0/1  gini=0.000 top10=100.0% sp100=0.69` |
| 2023-06-06 / 20230606-2307 | `sig=    3 bet=     21 hit=   0 net=     -21 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   21 pos= 0/1  gini=0.000 top10=100.0% sp100=75.00` |
| 2026-06-10 / 20260606-0131-澳门永利 | `sig=   29 bet=    203 hit=   5 net=     -23 roi=  -11.3% hr= 17.2% avgBet=7.0 dd=   84 pos= 0/1  gini=0.000 top10=100.0% sp100=5.22` |
| 2026-06-04 / 20260604-1630-澳门永利 | `sig=    4 bet=     28 hit=   0 net=     -28 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   28 pos= 0/1  gini=0.000 top10=100.0% sp100=1.26` |
| 2025-11-03 / 20251103-下午-喜来登 | `sig=    5 bet=     35 hit=   0 net=     -35 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   35 pos= 0/1  gini=0.000 top10=100.0% sp100=19.23` |
| 2026-06-01 / 20260602-0018-澳门永利 | `sig=   25 bet=    175 hit=   3 net=     -67 roi=  -38.3% hr= 12.0% avgBet=7.0 dd=   96 pos= 0/1  gini=0.000 top10=100.0% sp100=14.97` |

## Dataset: history_data.json
- sessions: 76
- eligible post-200 spins: 9644

### Focus Strategy Overall
| strategy | summary + SP100 | no-future rule |
|---|---:|---|
| stable-exact160-recent3 | `sig=  453 bet=   1359 hit=  52 net=     513 roi=   37.7% hr= 11.5% avgBet=3.0 dd=  123 pos= 7/14 gini=0.597 top10=97.8% sp100=4.70` | prior sessions + current prefix only |
| intersection160-zone | `sig=  538 bet=   3766 hit= 118 net=     482 roi=   12.8% hr= 21.9% avgBet=7.0 dd=  402 pos= 9/20 gini=0.563 top10=91.3% sp100=5.58` | prior sessions + current prefix only |

### Latest 10 Sessions Summary
| strategy | summary + SP100 |
|---|---:|
| stable-exact160-recent3 | `sig=  282 bet=    846 hit=  34 net=     378 roi=   44.7% hr= 12.1% avgBet=3.0 dd=  108 pos= 4/5  gini=0.588 top10=100.0% sp100=9.53` |
| intersection160-zone | `sig=  313 bet=   2191 hit=  75 net=     509 roi=   23.2% hr= 24.0% avgBet=7.0 dd=  143 pos= 4/7  gini=0.564 top10=100.0% sp100=10.58` |

### Latest 10 Sessions Detail
| # | date | session | prior sessions used | spins post-200 | stable summary | intersection summary | signal table snapshots |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | 2026-06-01 | 20260601-1630-澳门永利 | 66 | 108 | `-` | `sig=1 bet=7 hit=0 net=-7 roi=-100.0% sp100=0.93 dd=7` | stable: -<br>intersection: auto_16/mixed-core/probable |
| 2 | 2026-06-01 | 20260602-0018-澳门永利 | 67 | 167 | `-` | `sig=13 bet=91 hit=0 net=-91 roi=-100.0% sp100=7.78 dd=91` | stable: -<br>intersection: auto_16/mixed-core/probable |
| 3 | 2026-06-02 | 20260603-0030-澳门永利 | 68 | 609 | `sig=154 bet=462 hit=20 net=258 roi=55.8% sp100=25.29 dd=102` | `sig=154 bet=1078 hit=40 net=362 roi=33.6% sp100=25.29 dd=94` | stable: auto_22/small-sample/probable<br>auto_12/single-core/probable<br>auto_02/single-core/confirmed<br>intersection: auto_22/small-sample/probable<br>auto_12/single-core/probable<br>auto_02/single-core/confirmed |
| 4 | 2026-06-02 | 20260603-0230-澳门永利 | 69 | 77 | `-` | `-` | stable: -<br>intersection: - |
| 5 | 2026-06-03 | 20260603-2101-澳门永利 | 70 | 399 | `sig=23 bet=69 hit=4 net=75 roi=108.7% sp100=5.76 dd=21` | `sig=40 bet=280 hit=12 net=152 roi=54.3% sp100=10.03 dd=49` | stable: auto_08/single-core/probable<br>intersection: auto_25/small-sample/probable<br>auto_08/single-core/probable |
| 6 | 2026-06-04 | 20260604-1630-澳门永利 | 71 | 318 | `-` | `-` | stable: -<br>intersection: - |
| 7 | 2026-06-05 | 20260605-0230-澳门永利 | 72 | 111 | `-` | `-` | stable: -<br>intersection: - |
| 8 | 2026-06-05 | 20260604-2223-澳门永利 | 73 | 53 | `sig=1 bet=3 hit=0 net=-3 roi=-100.0% sp100=1.89 dd=3` | `sig=1 bet=7 hit=0 net=-7 roi=-100.0% sp100=1.89 dd=7` | stable: auto_23/single-core/probable<br>intersection: auto_23/single-core/probable |
| 9 | 2026-06-10 | 20260606-0131-澳门永利 | 74 | 556 | `sig=77 bet=231 hit=7 net=21 roi=9.1% sp100=13.85 dd=84` | `sig=77 bet=539 hit=17 net=73 roi=13.5% sp100=13.85 dd=143` | stable: auto_12/single-core/probable<br>auto_12/single-core/confirmed<br>auto_14/small-sample/confirmed<br>intersection: auto_12/single-core/probable<br>auto_12/single-core/confirmed<br>auto_14/small-sample/confirmed |
| 10 | 2026-06-10 | 20260607-0217-澳门永利 | 75 | 561 | `sig=27 bet=81 hit=3 net=27 roi=33.3% sp100=4.81 dd=27` | `sig=27 bet=189 hit=6 net=27 roi=14.3% sp100=4.81 dd=63` | stable: auto_22/single-core/probable<br>intersection: auto_22/single-core/probable |

### By Year: stable-exact160-recent3
| key | summary + SP100 |
|---|---:|
| 2021 | `sig=   44 bet=    132 hit=   6 net=      84 roi=   63.6% hr= 13.6% avgBet=3.0 dd=   69 pos= 1/1  gini=0.000 top10=100.0% sp100=2.68` |
| 2023 | `sig=   34 bet=    102 hit=   2 net=     -30 roi=  -29.4% hr=  5.9% avgBet=3.0 dd=   90 pos= 0/1  gini=0.000 top10=100.0% sp100=5.16` |
| 2025 | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.22` |
| 2026 | `sig=  374 bet=   1122 hit=  44 net=     462 roi=   41.2% hr= 11.8% avgBet=3.0 dd=  108 pos= 6/11 gini=0.606 top10=99.7% sp100=5.43` |

### By Year: intersection160-zone
| key | summary + SP100 |
|---|---:|
| 2021 | `sig=   44 bet=    308 hit=  11 net=      88 roi=   28.6% hr= 25.0% avgBet=7.0 dd=  126 pos= 1/1  gini=0.000 top10=100.0% sp100=2.68` |
| 2023 | `sig=   59 bet=    413 hit=  13 net=      55 roi=   13.3% hr= 22.0% avgBet=7.0 dd=   90 pos= 2/3  gini=0.199 top10=100.0% sp100=8.95` |
| 2025 | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=0.22` |
| 2026 | `sig=  434 bet=   3038 hit=  94 net=     346 roi=   11.4% hr= 21.7% avgBet=7.0 dd=  402 pos= 6/15 gini=0.563 top10=96.3% sp100=6.30` |

### Stable vs Intersection Same-Spin Overlap
| slice | summary + SP100 |
|---|---:|
| stable in both spins | `sig=  453 bet=   1359 hit=  52 net=     513 roi=   37.7% hr= 11.5% avgBet=3.0 dd=  123 pos= 7/14 gini=0.597 top10=97.8% sp100=10.98` |
| stable only | `sig=    0 bet=      0 hit=   0 net=       0 roi=    0.0% hr=  0.0% avgBet=0.0 dd=    0 pos= 0/0  gini=0.000 top10=0.0% sp100=0.00` |
| intersection in both spins | `sig=  453 bet=   3171 hit= 101 net=     465 roi=   14.7% hr= 22.3% avgBet=7.0 dd=  304 pos= 8/14 gini=0.577 top10=97.8% sp100=10.98` |
| intersection only | `sig=   85 bet=    595 hit=  17 net=      17 roi=    2.9% hr= 20.0% avgBet=7.0 dd=  149 pos= 3/8  gini=0.456 top10=100.0% sp100=6.17` |

- intersection extra-ring hits when stable missed on the same spin: 49

### Hot Number Overlap With Focus Strategies
| slice | summary + SP100 |
|---|---:|
| stable-exact160-recent3 / original strategy | `sig=  453 bet=   1359 hit=  52 net=     513 roi=   37.7% hr= 11.5% avgBet=3.0 dd=  123 pos= 7/14 gini=0.597 top10=97.8% sp100=4.70` |
| stable-exact160-recent3 / hot-overlap single number | `sig=    5 bet=      5 hit=   1 net=      31 roi=  620.0% hr= 20.0% avgBet=1.0 dd=    4 pos= 1/2  gini=0.419 top10=100.0% sp100=0.05` |
| stable-exact160-recent3 / strategy zone when hot overlaps | `sig=    5 bet=     15 hit=   1 net=      21 roi=  140.0% hr= 20.0% avgBet=3.0 dd=   12 pos= 1/2  gini=0.269 top10=100.0% sp100=0.05` |
| stable-exact160-recent3 / strategy zone without hot overlap | `sig=  448 bet=   1344 hit=  51 net=     492 roi=   36.6% hr= 11.4% avgBet=3.0 dd=  123 pos= 7/14 gini=0.593 top10=97.8% sp100=4.65` |
| intersection160-zone / original strategy | `sig=  538 bet=   3766 hit= 118 net=     482 roi=   12.8% hr= 21.9% avgBet=7.0 dd=  402 pos= 9/20 gini=0.563 top10=91.3% sp100=5.58` |
| intersection160-zone / hot-overlap single number | `sig=   37 bet=     37 hit=   3 net=      71 roi=  191.9% hr=  8.1% avgBet=1.0 dd=   14 pos= 2/5  gini=0.569 top10=100.0% sp100=0.38` |
| intersection160-zone / strategy zone when hot overlaps | `sig=   37 bet=    259 hit=  12 net=     173 roi=   66.8% hr= 32.4% avgBet=7.0 dd=   42 pos= 4/5  gini=0.406 top10=100.0% sp100=0.38` |
| intersection160-zone / strategy zone without hot overlap | `sig=  501 bet=   3507 hit= 106 net=     309 roi=    8.8% hr= 21.2% avgBet=7.0 dd=  405 pos= 9/20 gini=0.569 top10=90.8% sp100=5.19` |

### Latest 10 Hot Overlap
| slice | summary + SP100 |
|---|---:|
| stable-exact160-recent3 / original strategy | `sig=  282 bet=    846 hit=  34 net=     378 roi=   44.7% hr= 12.1% avgBet=3.0 dd=  108 pos= 4/5  gini=0.588 top10=100.0% sp100=9.53` |
| stable-exact160-recent3 / hot-overlap single number | `sig=    3 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=1.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.10` |
| stable-exact160-recent3 / strategy zone when hot overlaps | `sig=    3 bet=      9 hit=   0 net=      -9 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    9 pos= 0/1  gini=0.000 top10=100.0% sp100=0.10` |
| stable-exact160-recent3 / strategy zone without hot overlap | `sig=  279 bet=    837 hit=  34 net=     387 roi=   46.2% hr= 12.2% avgBet=3.0 dd=  108 pos= 4/5  gini=0.592 top10=100.0% sp100=9.43` |
| intersection160-zone / original strategy | `sig=  313 bet=   2191 hit=  75 net=     509 roi=   23.2% hr= 24.0% avgBet=7.0 dd=  143 pos= 4/7  gini=0.564 top10=100.0% sp100=10.58` |
| intersection160-zone / hot-overlap single number | `sig=   27 bet=     27 hit=   2 net=      45 roi=  166.7% hr=  7.4% avgBet=1.0 dd=   13 pos= 1/2  gini=0.459 top10=100.0% sp100=0.91` |
| intersection160-zone / strategy zone when hot overlaps | `sig=   27 bet=    189 hit=   9 net=     135 roi=   71.4% hr= 33.3% avgBet=7.0 dd=   42 pos= 2/2  gini=0.070 top10=100.0% sp100=0.91` |
| intersection160-zone / strategy zone without hot overlap | `sig=  286 bet=   2002 hit=  66 net=     374 roi=   18.7% hr= 23.1% avgBet=7.0 dd=  143 pos= 4/7  gini=0.587 top10=100.0% sp100=9.67` |

### Hot Overlap Single By Hot Mode: stable-exact160-recent3
| key | summary + SP100 |
|---|---:|
| long | `sig=    2 bet=      2 hit=   1 net=      34 roi= 1700.0% hr= 50.0% avgBet=1.0 dd=    1 pos= 1/1  gini=0.000 top10=100.0% sp100=0.71` |
| short | `sig=    3 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=1.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.49` |

### Hot Overlap Strategy Zone By Table Type: stable-exact160-recent3
| key | summary + SP100 |
|---|---:|
| small-sample | `sig=    5 bet=     15 hit=   1 net=      21 roi=  140.0% hr= 20.0% avgBet=3.0 dd=   12 pos= 1/2  gini=0.269 top10=100.0% sp100=0.56` |

### Hot Overlap Single By Hot Mode: intersection160-zone
| key | summary + SP100 |
|---|---:|
| long | `sig=   29 bet=     29 hit=   3 net=      79 roi=  272.4% hr= 10.3% avgBet=1.0 dd=   14 pos= 2/5  gini=0.576 top10=100.0% sp100=1.88` |
| short | `sig=    8 bet=      8 hit=   0 net=      -8 roi= -100.0% hr=  0.0% avgBet=1.0 dd=    8 pos= 0/2  gini=0.125 top10=100.0% sp100=0.90` |

### Hot Overlap Strategy Zone By Table Type: intersection160-zone
| key | summary + SP100 |
|---|---:|
| small-sample | `sig=   30 bet=    210 hit=   9 net=     114 roi=   54.3% hr= 30.0% avgBet=7.0 dd=   42 pos= 2/2  gini=0.175 top10=100.0% sp100=3.37` |
| single-core | `sig=    2 bet=     14 hit=   2 net=      58 roi=  414.3% hr=100.0% avgBet=7.0 dd=    0 pos= 1/1  gini=0.000 top10=100.0% sp100=0.36` |
| multi-core | `sig=    5 bet=     35 hit=   1 net=       1 roi=    2.9% hr= 20.0% avgBet=7.0 dd=   21 pos= 1/2  gini=0.033 top10=100.0% sp100=5.15` |

### Hot Number Reverse Filter View
| slice | summary + SP100 |
|---|---:|
| hot original | `sig= 2310 bet=   2310 hit=  72 net=     282 roi=   12.2% hr=  3.1% avgBet=1.0 dd=  319 pos=17/43 gini=0.520 top10=56.1% sp100=23.95` |
| hot excluding stable-overlap | `sig= 2305 bet=   2305 hit=  71 net=     251 roi=   10.9% hr=  3.1% avgBet=1.0 dd=  319 pos=16/43 gini=0.529 top10=56.1% sp100=23.90` |
| hot stable-overlap only | `sig=    5 bet=      5 hit=   1 net=      31 roi=  620.0% hr= 20.0% avgBet=1.0 dd=    4 pos= 1/2  gini=0.419 top10=100.0% sp100=0.05` |
| hot excluding intersection-overlap | `sig= 2273 bet=   2273 hit=  69 net=     211 roi=    9.3% hr=  3.0% avgBet=1.0 dd=  314 pos=16/43 gini=0.518 top10=55.8% sp100=23.57` |
| hot intersection-overlap only | `sig=   37 bet=     37 hit=   3 net=      71 roi=  191.9% hr=  8.1% avgBet=1.0 dd=   14 pos= 2/5  gini=0.569 top10=100.0% sp100=0.38` |
| hot excluding any focus-overlap | `sig= 2273 bet=   2273 hit=  69 net=     211 roi=    9.3% hr=  3.0% avgBet=1.0 dd=  314 pos=16/43 gini=0.518 top10=55.8% sp100=23.57` |
| hot any focus-overlap only | `sig=   37 bet=     37 hit=   3 net=      71 roi=  191.9% hr=  8.1% avgBet=1.0 dd=   14 pos= 2/5  gini=0.569 top10=100.0% sp100=0.38` |

### Latest 10 Hot Reverse Filter View
| slice | summary + SP100 |
|---|---:|
| hot original | `sig=  690 bet=    690 hit=  29 net=     354 roi=   51.3% hr=  4.2% avgBet=1.0 dd=   99 pos= 6/8  gini=0.368 top10=100.0% sp100=23.32` |
| hot excluding stable-overlap | `sig=  687 bet=    687 hit=  29 net=     357 roi=   52.0% hr=  4.2% avgBet=1.0 dd=   99 pos= 6/8  gini=0.370 top10=100.0% sp100=23.22` |
| hot stable-overlap only | `sig=    3 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=1.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.10` |
| hot excluding intersection-overlap | `sig=  663 bet=    663 hit=  27 net=     309 roi=   46.6% hr=  4.1% avgBet=1.0 dd=   97 pos= 6/8  gini=0.321 top10=100.0% sp100=22.41` |
| hot intersection-overlap only | `sig=   27 bet=     27 hit=   2 net=      45 roi=  166.7% hr=  7.4% avgBet=1.0 dd=   13 pos= 1/2  gini=0.459 top10=100.0% sp100=0.91` |
| hot excluding any focus-overlap | `sig=  663 bet=    663 hit=  27 net=     309 roi=   46.6% hr=  4.1% avgBet=1.0 dd=   97 pos= 6/8  gini=0.321 top10=100.0% sp100=22.41` |
| hot any focus-overlap only | `sig=   27 bet=     27 hit=   2 net=      45 roi=  166.7% hr=  7.4% avgBet=1.0 dd=   13 pos= 1/2  gini=0.459 top10=100.0% sp100=0.91` |

### Hot Reverse Filter By Mode
| slice | summary + SP100 |
|---|---:|
| exclude intersection / long | `sig= 1298 bet=   1298 hit=  46 net=     358 roi=   27.6% hr=  3.5% avgBet=1.0 dd=  169 pos=18/39 gini=0.496 top10=62.0% sp100=13.46` |
| exclude intersection / short | `sig=  975 bet=    975 hit=  23 net=    -147 roi=  -15.1% hr=  2.4% avgBet=1.0 dd=  294 pos=10/39 gini=0.444 top10=59.4% sp100=10.11` |
| exclude stable / long | `sig= 1325 bet=   1325 hit=  48 net=     403 roi=   30.4% hr=  3.6% avgBet=1.0 dd=  169 pos=18/39 gini=0.513 top10=62.4% sp100=13.74` |
| exclude stable / short | `sig=  980 bet=    980 hit=  23 net=    -152 roi=  -15.5% hr=  2.3% avgBet=1.0 dd=  294 pos=10/39 gini=0.443 top10=59.3% sp100=10.16` |
| original / long | `sig= 1327 bet=   1327 hit=  49 net=     437 roi=   32.9% hr=  3.7% avgBet=1.0 dd=  169 pos=19/40 gini=0.506 top10=62.3% sp100=13.76` |
| original / short | `sig=  983 bet=    983 hit=  23 net=    -155 roi=  -15.8% hr=  2.3% avgBet=1.0 dd=  294 pos=10/39 gini=0.448 top10=59.4% sp100=10.19` |

## Deep Splits: history_data.json / stable-exact160-recent3

### By Table Type
| key | summary + SP100 |
|---|---:|
| small-sample | `sig=  267 bet=    801 hit=  35 net=     459 roi=   57.3% hr= 13.1% avgBet=3.0 dd=  120 pos= 4/8  gini=0.608 top10=100.0% sp100=10.28` |
| single-core | `sig=  186 bet=    558 hit=  17 net=      54 roi=    9.7% hr=  9.1% avgBet=3.0 dd=   84 pos= 3/8  gini=0.424 top10=100.0% sp100=6.91` |

### By Assignment Level
| key | summary + SP100 |
|---|---:|
| probable | `sig=  281 bet=    843 hit=  33 net=     345 roi=   40.9% hr= 11.7% avgBet=3.0 dd=   99 pos= 4/7  gini=0.617 top10=100.0% sp100=10.50` |
| confirmed | `sig=  172 bet=    516 hit=  19 net=     168 roi=   32.6% hr= 11.0% avgBet=3.0 dd=  123 pos= 4/9  gini=0.600 top10=100.0% sp100=6.58` |

### By Prior Card Session Count
| key | summary + SP100 |
|---|---:|
| 01 | `sig=  235 bet=    705 hit=  29 net=     339 roi=   48.1% hr= 12.3% avgBet=3.0 dd=  120 pos= 3/6  gini=0.611 top10=100.0% sp100=12.95` |
| 02 | `sig=   32 bet=     96 hit=   6 net=     120 roi=  125.0% hr= 18.8% avgBet=3.0 dd=   27 pos= 2/3  gini=0.500 top10=100.0% sp100=3.01` |
| 03-04 | `sig=   59 bet=    177 hit=   7 net=      75 roi=   42.4% hr= 11.9% avgBet=3.0 dd=   48 pos= 2/6  gini=0.562 top10=100.0% sp100=3.52` |
| 05-08 | `sig=  127 bet=    381 hit=  10 net=     -21 roi=   -5.5% hr=  7.9% avgBet=3.0 dd=   84 pos= 1/3  gini=0.087 top10=100.0% sp100=7.81` |

### By Prior Card Total Numbers
| key | summary + SP100 |
|---|---:|
| <500 | `sig=  235 bet=    705 hit=  29 net=     339 roi=   48.1% hr= 12.3% avgBet=3.0 dd=  120 pos= 3/6  gini=0.611 top10=100.0% sp100=12.95` |
| 500-999 | `sig=   33 bet=     99 hit=   6 net=     117 roi=  118.2% hr= 18.2% avgBet=3.0 dd=   27 pos= 2/4  gini=0.597 top10=100.0% sp100=3.06` |
| 1000-1999 | `sig=  182 bet=    546 hit=  17 net=      66 roi=   12.1% hr=  9.3% avgBet=3.0 dd=   84 pos= 3/7  gini=0.392 top10=100.0% sp100=6.80` |
| 2000+ | `sig=    3 bet=      9 hit=   0 net=      -9 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    9 pos= 0/1  gini=0.000 top10=100.0% sp100=0.65` |

### By Primary Stability
| key | summary + SP100 |
|---|---:|
| 0.70+ | `sig=  316 bet=    948 hit=  38 net=     420 roi=   44.3% hr= 12.0% avgBet=3.0 dd=  120 pos= 4/10 gini=0.623 top10=100.0% sp100=10.21` |
| 0.45-0.69 | `sig=  137 bet=    411 hit=  14 net=      93 roi=   22.6% hr= 10.2% avgBet=3.0 dd=   84 pos= 3/7  gini=0.501 top10=100.0% sp100=5.16` |

### By Table Top1 Z
| key | summary + SP100 |
|---|---:|
| 1.5-1.99 | `sig=  150 bet=    450 hit=  21 net=     306 roi=   68.0% hr= 14.0% avgBet=3.0 dd=   75 pos= 2/2  gini=0.431 top10=100.0% sp100=16.85` |
| 2.0+ | `sig=  303 bet=    909 hit=  31 net=     207 roi=   22.8% hr= 10.2% avgBet=3.0 dd=  123 pos= 6/14 gini=0.487 top10=96.7% sp100=7.35` |

### By Current 160-Window Z
| key | summary + SP100 |
|---|---:|
| 2.0+ | `sig=  276 bet=    828 hit=  31 net=     288 roi=   34.8% hr= 11.2% avgBet=3.0 dd=  105 pos= 5/11 gini=0.575 top10=99.6% sp100=8.39` |
| 1.5-1.99 | `sig=  148 bet=    444 hit=  18 net=     204 roi=   45.9% hr= 12.2% avgBet=3.0 dd=  102 pos= 5/8  gini=0.470 top10=100.0% sp100=5.00` |
| 1.0-1.49 | `sig=   21 bet=     63 hit=   3 net=      45 roi=   71.4% hr= 14.3% avgBet=3.0 dd=   30 pos= 3/6  gini=0.308 top10=100.0% sp100=1.35` |
| <1.0 | `sig=    8 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   24 pos= 0/1  gini=0.000 top10=100.0% sp100=1.31` |

### By Candidate Count
| key | summary + SP100 |
|---|---:|
| 3 | `sig=  453 bet=   1359 hit=  52 net=     513 roi=   37.7% hr= 11.5% avgBet=3.0 dd=  123 pos= 7/14 gini=0.597 top10=97.8% sp100=10.98` |

### By Venue
| key | summary + SP100 |
|---|---:|
| 澳门永利 | `sig=  282 bet=    846 hit=  34 net=     378 roi=   44.7% hr= 12.1% avgBet=3.0 dd=  108 pos= 4/5  gini=0.588 top10=100.0% sp100=12.95` |
| wzs | `sig=  136 bet=    408 hit=  16 net=     168 roi=   41.2% hr= 11.8% avgBet=3.0 dd=   90 pos= 3/7  gini=0.510 top10=100.0% sp100=7.17` |
| 伦敦人 | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=6.25` |
| unknown | `sig=   34 bet=    102 hit=   2 net=     -30 roi=  -29.4% hr=  5.9% avgBet=3.0 dd=   90 pos= 0/1  gini=0.000 top10=100.0% sp100=100.00` |

### Top Evolving Table Cards
| key | summary + SP100 |
|---|---:|
| auto_22 / small-sample | `sig=  145 bet=    435 hit=  20 net=     285 roi=   65.5% hr= 13.8% avgBet=3.0 dd=   75 pos= 1/1  gini=0.000 top10=100.0% sp100=23.81` |
| auto_09 / small-sample | `sig=   32 bet=     96 hit=   6 net=     120 roi=  125.0% hr= 18.8% avgBet=3.0 dd=   27 pos= 2/3  gini=0.500 top10=100.0% sp100=3.01` |
| auto_02 / small-sample | `sig=   44 bet=    132 hit=   6 net=      84 roi=   63.6% hr= 13.6% avgBet=3.0 dd=   69 pos= 1/1  gini=0.000 top10=100.0% sp100=37.29` |
| auto_08 / single-core | `sig=   23 bet=     69 hit=   4 net=      75 roi=  108.7% hr= 17.4% avgBet=3.0 dd=   21 pos= 1/1  gini=0.000 top10=100.0% sp100=5.76` |
| auto_22 / single-core | `sig=   27 bet=     81 hit=   3 net=      27 roi=   33.3% hr= 11.1% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=4.81` |
| auto_20 / small-sample | `sig=    5 bet=     15 hit=   1 net=      21 roi=  140.0% hr= 20.0% avgBet=3.0 dd=    9 pos= 1/1  gini=0.000 top10=100.0% sp100=1.78` |
| auto_12 / single-core | `sig=   82 bet=    246 hit=   7 net=       6 roi=    2.4% hr=  8.5% avgBet=3.0 dd=   84 pos= 1/2  gini=0.071 top10=100.0% sp100=7.04` |
| auto_01 / single-core | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=6.25` |
| auto_23 / single-core | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=1.89` |
| auto_14 / small-sample | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=0.18` |
| auto_03 / single-core | `sig=    3 bet=      9 hit=   0 net=      -9 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    9 pos= 0/1  gini=0.000 top10=100.0% sp100=0.65` |
| auto_10 / small-sample | `sig=    6 bet=     18 hit=   0 net=     -18 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   18 pos= 0/1  gini=0.000 top10=100.0% sp100=2.78` |
| auto_06 / small-sample | `sig=   34 bet=    102 hit=   2 net=     -30 roi=  -29.4% hr=  5.9% avgBet=3.0 dd=   90 pos= 0/1  gini=0.000 top10=100.0% sp100=100.00` |
| auto_02 / single-core | `sig=   49 bet=    147 hit=   3 net=     -39 roi=  -26.5% hr=  6.1% avgBet=3.0 dd=   54 pos= 0/3  gini=0.154 top10=100.0% sp100=4.43` |

### Per-Session Net
| key | summary + SP100 |
|---|---:|
| 2026-06-02 / 20260603-0030-澳门永利 | `sig=  154 bet=    462 hit=  20 net=     258 roi=   55.8% hr= 13.0% avgBet=3.0 dd=  102 pos= 1/1  gini=0.000 top10=100.0% sp100=25.29` |
| 2026-05-11 / wzs-2026-05-11-803 | `sig=   25 bet=     75 hit=   6 net=     141 roi=  188.0% hr= 24.0% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=8.90` |
| 2021-04-23 / wzs-2021-04-23-066 | `sig=   44 bet=    132 hit=   6 net=      84 roi=   63.6% hr= 13.6% avgBet=3.0 dd=   69 pos= 1/1  gini=0.000 top10=100.0% sp100=37.29` |
| 2026-06-03 / 20260603-2101-澳门永利 | `sig=   23 bet=     69 hit=   4 net=      75 roi=  108.7% hr= 17.4% avgBet=3.0 dd=   21 pos= 1/1  gini=0.000 top10=100.0% sp100=5.76` |
| 2026-06-10 / 20260607-0217-澳门永利 | `sig=   27 bet=     81 hit=   3 net=      27 roi=   33.3% hr= 11.1% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=4.81` |
| 2026-06-10 / 20260606-0131-澳门永利 | `sig=   77 bet=    231 hit=   7 net=      21 roi=    9.1% hr=  9.1% avgBet=3.0 dd=   84 pos= 1/1  gini=0.000 top10=100.0% sp100=13.85` |
| 2026-01-11 / wzs-2026-01-11-605 | `sig=    8 bet=     24 hit=   1 net=      12 roi=   50.0% hr= 12.5% avgBet=3.0 dd=   12 pos= 1/1  gini=0.000 top10=100.0% sp100=6.78` |
| 2025-11-03 / 20251102-下午-伦敦人 | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=6.25` |
| 2026-06-05 / 20260604-2223-澳门永利 | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0% sp100=1.89` |
| 2026-01-11 / wzs-2026-01-11-604 | `sig=    4 bet=     12 hit=   0 net=     -12 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   12 pos= 0/1  gini=0.000 top10=100.0% sp100=0.60` |
| 2026-04-06 / wzs-2026-04-06-701 | `sig=    4 bet=     12 hit=   0 net=     -12 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   12 pos= 0/1  gini=0.000 top10=100.0% sp100=11.11` |
| 2026-05-11 / wzs-2026-05-11-804 | `sig=    6 bet=     18 hit=   0 net=     -18 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   18 pos= 0/1  gini=0.000 top10=100.0% sp100=2.78` |
| 2026-05-11 / wzs-2026-05-11-810 | `sig=   45 bet=    135 hit=   3 net=     -27 roi=  -20.0% hr=  6.7% avgBet=3.0 dd=   48 pos= 0/1  gini=0.000 top10=100.0% sp100=9.74` |
| 2023-06-05 / 20230605-2221 | `sig=   34 bet=    102 hit=   2 net=     -30 roi=  -29.4% hr=  5.9% avgBet=3.0 dd=   90 pos= 0/1  gini=0.000 top10=100.0% sp100=100.00` |

## Deep Splits: history_data.json / intersection160-zone

### By Table Type
| key | summary + SP100 |
|---|---:|
| small-sample | `sig=  284 bet=   1988 hit=  76 net=     748 roi=   37.6% hr= 26.8% avgBet=7.0 dd=  133 pos= 6/9  gini=0.572 top10=100.0% sp100=9.48` |
| multi-core | `sig=   25 bet=    175 hit=   5 net=       5 roi=    2.9% hr= 20.0% avgBet=7.0 dd=   55 pos= 1/2  gini=0.053 top10=100.0% sp100=25.77` |
| mixed-core | `sig=   43 bet=    301 hit=   5 net=    -121 roi=  -40.2% hr= 11.6% avgBet=7.0 dd=  129 pos= 1/5  gini=0.412 top10=100.0% sp100=4.88` |
| single-core | `sig=  186 bet=   1302 hit=  32 net=    -150 roi=  -11.5% hr= 17.2% avgBet=7.0 dd=  310 pos= 3/8  gini=0.512 top10=100.0% sp100=6.91` |

### By Assignment Level
| key | summary + SP100 |
|---|---:|
| probable | `sig=  361 bet=   2527 hit=  78 net=     281 roi=   11.1% hr= 21.6% avgBet=7.0 dd=  383 pos= 5/14 gini=0.583 top10=97.5% sp100=9.88` |
| confirmed | `sig=  177 bet=   1239 hit=  40 net=     201 roi=   16.2% hr= 22.6% avgBet=7.0 dd=  168 pos= 5/10 gini=0.468 top10=100.0% sp100=6.63` |

### By Prior Card Session Count
| key | summary + SP100 |
|---|---:|
| 01 | `sig=  252 bet=   1764 hit=  67 net=     648 roi=   36.7% hr= 26.6% avgBet=7.0 dd=  145 pos= 5/7  gini=0.601 top10=100.0% sp100=11.39` |
| 02 | `sig=   32 bet=    224 hit=   9 net=     100 roi=   44.6% hr= 28.1% avgBet=7.0 dd=   63 pos= 2/3  gini=0.495 top10=100.0% sp100=3.01` |
| 03-04 | `sig=   59 bet=    413 hit=  11 net=     -17 roi=   -4.1% hr= 18.6% avgBet=7.0 dd=   75 pos= 2/6  gini=0.255 top10=100.0% sp100=3.52` |
| 09+ | `sig=   15 bet=    105 hit=   1 net=     -69 roi=  -65.7% hr=  6.7% avgBet=7.0 dd=   77 pos= 0/1  gini=0.000 top10=100.0% sp100=9.55` |
| 05-08 | `sig=  180 bet=   1260 hit=  30 net=    -180 roi=  -14.3% hr= 16.7% avgBet=7.0 dd=  364 pos= 3/9  gini=0.473 top10=100.0% sp100=7.35` |

### By Prior Card Total Numbers
| key | summary + SP100 |
|---|---:|
| <500 | `sig=  235 bet=   1645 hit=  60 net=     515 roi=   31.3% hr= 25.5% avgBet=7.0 dd=  145 pos= 4/6  gini=0.645 top10=100.0% sp100=12.95` |
| 500-999 | `sig=   50 bet=    350 hit=  16 net=     226 roi=   64.6% hr= 32.0% avgBet=7.0 dd=   63 pos= 3/5  gini=0.509 top10=100.0% sp100=3.38` |
| 2000+ | `sig=   54 bet=    378 hit=  10 net=     -18 roi=   -4.8% hr= 18.5% avgBet=7.0 dd=  118 pos= 2/5  gini=0.361 top10=100.0% sp100=4.80` |
| 1000-1999 | `sig=  199 bet=   1393 hit=  32 net=    -241 roi=  -17.3% hr= 16.1% avgBet=7.0 dd=  401 pos= 3/10 gini=0.468 top10=100.0% sp100=6.65` |

### By Primary Stability
| key | summary + SP100 |
|---|---:|
| 0.70+ | `sig=  333 bet=   2331 hit=  80 net=     549 roi=   23.6% hr= 24.0% avgBet=7.0 dd=  283 pos= 6/11 gini=0.542 top10=99.7% sp100=9.53` |
| 0.45-0.69 | `sig=  137 bet=    959 hit=  28 net=      49 roi=    5.1% hr= 20.4% avgBet=7.0 dd=  143 pos= 3/7  gini=0.418 top10=100.0% sp100=5.16` |
| <0.45 | `sig=   68 bet=    476 hit=  10 net=    -116 roi=  -24.4% hr= 14.7% avgBet=7.0 dd=  149 pos= 2/7  gini=0.431 top10=100.0% sp100=6.95` |

### By Table Top1 Z
| key | summary + SP100 |
|---|---:|
| 1.5-1.99 | `sig=  150 bet=   1050 hit=  41 net=     426 roi=   40.6% hr= 27.3% avgBet=7.0 dd=   77 pos= 2/2  gini=0.498 top10=100.0% sp100=16.85` |
| <1.0 | `sig=   17 bet=    119 hit=   7 net=     133 roi=  111.8% hr= 41.2% avgBet=7.0 dd=   42 pos= 1/1  gini=0.000 top10=100.0% sp100=4.26` |
| 2.0+ | `sig=  371 bet=   2597 hit=  70 net=     -77 roi=   -3.0% hr= 18.9% avgBet=7.0 dd=  478 pos= 8/20 gini=0.495 top10=88.4% sp100=7.69` |

### By Current 160-Window Z
| key | summary + SP100 |
|---|---:|
| 1.5-1.99 | `sig=  157 bet=   1099 hit=  42 net=     413 roi=   37.6% hr= 26.8% avgBet=7.0 dd=  103 pos= 7/9  gini=0.462 top10=100.0% sp100=4.84` |
| 2.0+ | `sig=  327 bet=   2289 hit=  67 net=     123 roi=    5.4% hr= 20.5% avgBet=7.0 dd=  349 pos= 6/13 gini=0.457 top10=98.2% sp100=9.32` |
| 1.0-1.49 | `sig=   44 bet=    308 hit=   8 net=     -20 roi=   -6.5% hr= 18.2% avgBet=7.0 dd=  137 pos= 5/10 gini=0.502 top10=100.0% sp100=2.16` |
| <1.0 | `sig=   10 bet=     70 hit=   1 net=     -34 roi=  -48.6% hr= 10.0% avgBet=7.0 dd=   42 pos= 0/3  gini=0.255 top10=100.0% sp100=1.07` |

### By Candidate Count
| key | summary + SP100 |
|---|---:|
| 7 | `sig=  538 bet=   3766 hit= 118 net=     482 roi=   12.8% hr= 21.9% avgBet=7.0 dd=  402 pos= 9/20 gini=0.563 top10=91.3% sp100=11.16` |

### By Venue
| key | summary + SP100 |
|---|---:|
| 澳门永利 | `sig=  313 bet=   2191 hit=  75 net=     509 roi=   23.2% hr= 24.0% avgBet=7.0 dd=  143 pos= 4/7  gini=0.564 top10=100.0% sp100=12.76` |
| unknown | `sig=   34 bet=    238 hit=   8 net=      50 roi=   21.0% hr= 23.5% avgBet=7.0 dd=   35 pos= 1/1  gini=0.000 top10=100.0% sp100=100.00` |
| 巴黎人 | `sig=   22 bet=    154 hit=   5 net=      26 roi=   16.9% hr= 22.7% avgBet=7.0 dd=   55 pos= 1/1  gini=0.000 top10=100.0% sp100=40.00` |
| 伦敦人 | `sig=    4 bet=     28 hit=   0 net=     -28 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   28 pos= 0/2  gini=0.250 top10=100.0% sp100=6.90` |
| wzs | `sig=  165 bet=   1155 hit=  30 net=     -75 roi=   -6.5% hr= 18.2% avgBet=7.0 dd=  289 pos= 3/9  gini=0.487 top10=100.0% sp100=7.43` |

### Top Evolving Table Cards
| key | summary + SP100 |
|---|---:|
| auto_22 / small-sample | `sig=  145 bet=   1015 hit=  40 net=     425 roi=   41.9% hr= 27.6% avgBet=7.0 dd=   77 pos= 1/1  gini=0.000 top10=100.0% sp100=23.81` |
| auto_25 / small-sample | `sig=   17 bet=    119 hit=   7 net=     133 roi=  111.8% hr= 41.2% avgBet=7.0 dd=   42 pos= 1/1  gini=0.000 top10=100.0% sp100=4.26` |
| auto_09 / small-sample | `sig=   32 bet=    224 hit=   9 net=     100 roi=   44.6% hr= 28.1% avgBet=7.0 dd=   63 pos= 2/3  gini=0.495 top10=100.0% sp100=3.01` |
| auto_02 / small-sample | `sig=   44 bet=    308 hit=  11 net=      88 roi=   28.6% hr= 25.0% avgBet=7.0 dd=  126 pos= 1/1  gini=0.000 top10=100.0% sp100=37.29` |
| auto_15 / mixed-core | `sig=    8 bet=     56 hit=   3 net=      52 roi=   92.9% hr= 37.5% avgBet=7.0 dd=   35 pos= 1/1  gini=0.000 top10=100.0% sp100=2.85` |
| auto_06 / small-sample | `sig=   34 bet=    238 hit=   8 net=      50 roi=   21.0% hr= 23.5% avgBet=7.0 dd=   35 pos= 1/1  gini=0.000 top10=100.0% sp100=100.00` |
| auto_12 / single-core | `sig=   82 bet=    574 hit=  17 net=      38 roi=    6.6% hr= 20.7% avgBet=7.0 dd=  143 pos= 1/2  gini=0.156 top10=100.0% sp100=7.04` |
| auto_22 / single-core | `sig=   27 bet=    189 hit=   6 net=      27 roi=   14.3% hr= 22.2% avgBet=7.0 dd=   63 pos= 1/1  gini=0.000 top10=100.0% sp100=4.81` |
| auto_08 / single-core | `sig=   23 bet=    161 hit=   5 net=      19 roi=   11.8% hr= 21.7% avgBet=7.0 dd=   49 pos= 1/1  gini=0.000 top10=100.0% sp100=5.76` |
| auto_01 / multi-core | `sig=   25 bet=    175 hit=   5 net=       5 roi=    2.9% hr= 20.0% avgBet=7.0 dd=   55 pos= 1/2  gini=0.053 top10=100.0% sp100=25.77` |
| auto_20 / small-sample | `sig=    5 bet=     35 hit=   1 net=       1 roi=    2.9% hr= 20.0% avgBet=7.0 dd=   21 pos= 1/1  gini=0.000 top10=100.0% sp100=1.78` |
| auto_02 / mixed-core | `sig=    6 bet=     42 hit=   1 net=      -6 roi=  -14.3% hr= 16.7% avgBet=7.0 dd=   28 pos= 0/1  gini=0.000 top10=100.0% sp100=3.55` |
| auto_01 / single-core | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=6.25` |
| auto_23 / single-core | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=1.89` |
| auto_14 / small-sample | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=0.18` |
| auto_03 / single-core | `sig=    3 bet=     21 hit=   0 net=     -21 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   21 pos= 0/1  gini=0.000 top10=100.0% sp100=0.65` |
| auto_10 / small-sample | `sig=    6 bet=     42 hit=   0 net=     -42 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   42 pos= 0/1  gini=0.000 top10=100.0% sp100=2.78` |
| auto_03 / mixed-core | `sig=   15 bet=    105 hit=   1 net=     -69 roi=  -65.7% hr=  6.7% avgBet=7.0 dd=   77 pos= 0/1  gini=0.000 top10=100.0% sp100=9.55` |
| auto_16 / mixed-core | `sig=   14 bet=     98 hit=   0 net=     -98 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   98 pos= 0/2  gini=0.429 top10=100.0% sp100=5.09` |
| auto_02 / single-core | `sig=   49 bet=    343 hit=   4 net=    -199 roi=  -58.0% hr=  8.2% avgBet=7.0 dd=  199 pos= 0/3  gini=0.432 top10=100.0% sp100=4.43` |

### Per-Session Net
| key | summary + SP100 |
|---|---:|
| 2026-06-02 / 20260603-0030-澳门永利 | `sig=  154 bet=   1078 hit=  40 net=     362 roi=   33.6% hr= 26.0% avgBet=7.0 dd=   94 pos= 1/1  gini=0.000 top10=100.0% sp100=25.29` |
| 2026-05-11 / wzs-2026-05-11-803 | `sig=   33 bet=    231 hit=  11 net=     165 roi=   71.4% hr= 33.3% avgBet=7.0 dd=   63 pos= 1/1  gini=0.000 top10=100.0% sp100=11.74` |
| 2026-06-03 / 20260603-2101-澳门永利 | `sig=   40 bet=    280 hit=  12 net=     152 roi=   54.3% hr= 30.0% avgBet=7.0 dd=   49 pos= 1/1  gini=0.000 top10=100.0% sp100=10.03` |
| 2021-04-23 / wzs-2021-04-23-066 | `sig=   44 bet=    308 hit=  11 net=      88 roi=   28.6% hr= 25.0% avgBet=7.0 dd=  126 pos= 1/1  gini=0.000 top10=100.0% sp100=37.29` |
| 2026-06-10 / 20260606-0131-澳门永利 | `sig=   77 bet=    539 hit=  17 net=      73 roi=   13.5% hr= 22.1% avgBet=7.0 dd=  143 pos= 1/1  gini=0.000 top10=100.0% sp100=13.85` |
| 2023-06-05 / 20230605-2221 | `sig=   34 bet=    238 hit=   8 net=      50 roi=   21.0% hr= 23.5% avgBet=7.0 dd=   35 pos= 1/1  gini=0.000 top10=100.0% sp100=100.00` |
| 2026-06-10 / 20260607-0217-澳门永利 | `sig=   27 bet=    189 hit=   6 net=      27 roi=   14.3% hr= 22.2% avgBet=7.0 dd=   63 pos= 1/1  gini=0.000 top10=100.0% sp100=4.81` |
| 2023-10-24 / 20231024-晚上-巴黎人 | `sig=   22 bet=    154 hit=   5 net=      26 roi=   16.9% hr= 22.7% avgBet=7.0 dd=   55 pos= 1/1  gini=0.000 top10=100.0% sp100=40.00` |
| 2026-01-11 / wzs-2026-01-11-604 | `sig=    4 bet=     28 hit=   1 net=       8 roi=   28.6% hr= 25.0% avgBet=7.0 dd=   21 pos= 1/1  gini=0.000 top10=100.0% sp100=0.60` |
| 2026-01-11 / wzs-2026-01-11-607 | `sig=    6 bet=     42 hit=   1 net=      -6 roi=  -14.3% hr= 16.7% avgBet=7.0 dd=   28 pos= 0/1  gini=0.000 top10=100.0% sp100=3.55` |
| 2025-11-03 / 20251102-下午-伦敦人 | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=6.25` |
| 2026-06-01 / 20260601-1630-澳门永利 | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=0.93` |
| 2026-06-05 / 20260604-2223-澳门永利 | `sig=    1 bet=      7 hit=   0 net=      -7 roi= -100.0% hr=  0.0% avgBet=7.0 dd=    7 pos= 0/1  gini=0.000 top10=100.0% sp100=1.89` |
| 2026-01-11 / wzs-2026-01-11-605 | `sig=    8 bet=     56 hit=   1 net=     -20 roi=  -35.7% hr= 12.5% avgBet=7.0 dd=   28 pos= 0/1  gini=0.000 top10=100.0% sp100=6.78` |
| 2023-10-30 / 20231025-晚上-伦敦人 | `sig=    3 bet=     21 hit=   0 net=     -21 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   21 pos= 0/1  gini=0.000 top10=100.0% sp100=7.14` |
| 2026-04-06 / wzs-2026-04-06-701 | `sig=    4 bet=     28 hit=   0 net=     -28 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   28 pos= 0/1  gini=0.000 top10=100.0% sp100=11.11` |
| 2026-05-11 / wzs-2026-05-11-804 | `sig=    6 bet=     42 hit=   0 net=     -42 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   42 pos= 0/1  gini=0.000 top10=100.0% sp100=2.78` |
| 2026-01-11 / wzs-2026-01-11-606 | `sig=   15 bet=    105 hit=   1 net=     -69 roi=  -65.7% hr=  6.7% avgBet=7.0 dd=   77 pos= 0/1  gini=0.000 top10=100.0% sp100=9.55` |
| 2026-06-01 / 20260602-0018-澳门永利 | `sig=   13 bet=     91 hit=   0 net=     -91 roi= -100.0% hr=  0.0% avgBet=7.0 dd=   91 pos= 0/1  gini=0.000 top10=100.0% sp100=7.78` |
| 2026-05-11 / wzs-2026-05-11-810 | `sig=   45 bet=    315 hit=   4 net=    -171 roi=  -54.3% hr=  8.9% avgBet=7.0 dd=  171 pos= 0/1  gini=0.000 top10=100.0% sp100=9.74` |

## Cross-Dataset Focus Summary
| strategy | data_2026.6.11 | history_data | minROI | max top10 signal share |
|---|---:|---:|---:|---:|
| stable-exact160-recent3 | `sig=  382 bet=   1146 hit=  39 net=     258 roi=   22.5% hr= 10.2% avgBet=3.0 dd=  159 pos= 3/16 gini=0.705 top10=96.9% sp100=3.40` | `sig=  453 bet=   1359 hit=  52 net=     513 roi=   37.7% hr= 11.5% avgBet=3.0 dd=  123 pos= 7/14 gini=0.597 top10=97.8% sp100=4.70` | 22.5% | 97.8% |
| intersection160-zone | `sig=  588 bet=   4116 hit= 127 net=     456 roi=   11.1% hr= 21.6% avgBet=7.0 dd=  373 pos=12/22 gini=0.557 top10=87.6% sp100=5.23` | `sig=  538 bet=   3766 hit= 118 net=     482 roi=   12.8% hr= 21.9% avgBet=7.0 dd=  402 pos= 9/20 gini=0.563 top10=91.3% sp100=5.58` | 11.1% | 91.3% |
