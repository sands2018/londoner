# Table Feature Resonance Deep Dive

Target: `recent-recent-w160-r1-d3-s3-rz0p5`

Meaning: current 160-spin top wheel sector is within 3 wheel slots of the table profile top-1 sector center, recent sector z>=0.5, and the signal bets the current recent sector center 3 numbers.

No-future rule: table profile uses only prior sessions; current spin features use only the prefix before the result.

## Focus Strategy Comparison
| strategy | why | data_2026 | history | latest data_2026 | latest history |
|---|---|---:|---:|---:|---:|
| recent-recent-w160-r1-d3-s3-rz0p5 | Current 160 top sector within 3 of table core rank 1; bet recent 3. | `sig= 3695 bet=  11085 hit= 319 net=     399 roi=    3.6% hr=  8.6% avgBet=3.0 dd=  543 pos=31/67 gini=0.474 top10=53.6% sp100=32.87` | `sig= 3363 bet=  10089 hit= 293 net=     459 roi=    4.5% hr=  8.7% avgBet=3.0 dd=  522 pos=19/55 gini=0.512 top10=55.8% sp100=34.87` | `sig= 1123 bet=   3369 hit= 102 net=     303 roi=    9.0% hr=  9.1% avgBet=3.0 dd=  345 pos= 7/10 gini=0.489 top10=100.0% sp100=37.95` | `sig= 1054 bet=   3162 hit= 102 net=     510 roi=   16.1% hr=  9.7% avgBet=3.0 dd=  261 pos= 6/10 gini=0.502 top10=100.0% sp100=35.62` |
| recent-recent-w160-r1-d3-s3-rz1 | Current 160 top sector within 3 of table core rank 1; bet recent 3. | `sig= 3651 bet=  10953 hit= 314 net=     351 roi=    3.2% hr=  8.6% avgBet=3.0 dd=  600 pos=31/67 gini=0.477 top10=53.6% sp100=32.48` | `sig= 3308 bet=   9924 hit= 290 net=     516 roi=    5.2% hr=  8.8% avgBet=3.0 dd=  474 pos=20/55 gini=0.520 top10=55.8% sp100=34.30` | `sig= 1106 bet=   3318 hit= 101 net=     318 roi=    9.6% hr=  9.1% avgBet=3.0 dd=  333 pos= 7/10 gini=0.489 top10=100.0% sp100=37.38` | `sig= 1033 bet=   3099 hit= 101 net=     537 roi=   17.3% hr=  9.8% avgBet=3.0 dd=  252 pos= 6/10 gini=0.496 top10=100.0% sp100=34.91` |
| recent-recent-w200-r1-d3-s3-rz0p5 | Current 200 top sector within 3 of table core rank 1; bet recent 3. | `sig= 4272 bet=  12816 hit= 366 net=     360 roi=    2.8% hr=  8.6% avgBet=3.0 dd=  603 pos=31/70 gini=0.515 top10=49.8% sp100=38.00` | `sig= 3701 bet=  11103 hit= 315 net=     237 roi=    2.1% hr=  8.5% avgBet=3.0 dd=  657 pos=23/53 gini=0.522 top10=54.2% sp100=38.38` | `sig= 1267 bet=   3801 hit= 122 net=     591 roi=   15.5% hr=  9.6% avgBet=3.0 dd=  282 pos= 6/10 gini=0.403 top10=100.0% sp100=42.82` | `sig= 1206 bet=   3618 hit= 119 net=     666 roi=   18.4% hr=  9.9% avgBet=3.0 dd=  381 pos= 6/10 gini=0.361 top10=100.0% sp100=40.76` |
| recent-recent-w160-r1-d2-s3-rz0p5 | Current 160 top sector within 2 of table core rank 1; bet recent 3. | `sig= 2968 bet=   8904 hit= 255 net=     276 roi=    3.1% hr=  8.6% avgBet=3.0 dd=  564 pos=26/63 gini=0.491 top10=55.7% sp100=26.40` | `sig= 2591 bet=   7773 hit= 222 net=     219 roi=    2.8% hr=  8.6% avgBet=3.0 dd=  633 pos=17/50 gini=0.545 top10=63.3% sp100=26.87` | `sig=  985 bet=   2955 hit=  89 net=     249 roi=    8.4% hr=  9.0% avgBet=3.0 dd=  375 pos= 6/10 gini=0.426 top10=100.0% sp100=33.29` | `sig=  852 bet=   2556 hit=  90 net=     684 roi=   26.8% hr= 10.6% avgBet=3.0 dd=  180 pos= 6/10 gini=0.554 top10=100.0% sp100=28.79` |
| recent-recent-w80-r1-d2-s3-rz1 | Current 80 top sector within 2 of table core rank 1; bet recent 3. | `sig= 2090 bet=   6270 hit= 183 net=     318 roi=    5.1% hr=  8.8% avgBet=3.0 dd=  321 pos=25/62 gini=0.561 top10=54.6% sp100=18.59` | `sig= 2037 bet=   6111 hit= 185 net=     549 roi=    9.0% hr=  9.1% avgBet=3.0 dd=  462 pos=20/50 gini=0.561 top10=63.0% sp100=21.12` | `sig=  656 bet=   1968 hit=  63 net=     300 roi=   15.2% hr=  9.6% avgBet=3.0 dd=  201 pos= 4/10 gini=0.669 top10=100.0% sp100=22.17` | `sig=  640 bet=   1920 hit=  67 net=     492 roi=   25.6% hr= 10.5% avgBet=3.0 dd=  183 pos= 5/10 gini=0.593 top10=100.0% sp100=21.63` |
| intersection-w160-r1-min3-rz0p5 | Bet overlap between current 160 top sector and table core rank 1. | `sig= 4505 bet=  22465 hit= 629 net=     179 roi=    0.8% hr= 14.0% avgBet=5.0 dd=  713 pos=33/72 gini=0.491 top10=48.6% sp100=40.08` | `sig= 3889 bet=  19719 hit= 565 net=     621 roi=    3.1% hr= 14.5% avgBet=5.1 dd=  535 pos=21/56 gini=0.520 top10=53.9% sp100=40.33` | `sig= 1237 bet=   6813 hit= 199 net=     351 roi=    5.2% hr= 16.1% avgBet=5.5 dd=  297 pos= 5/10 gini=0.457 top10=100.0% sp100=41.80` | `sig= 1193 bet=   6463 hit= 192 net=     449 roi=    6.9% hr= 16.1% avgBet=5.4 dd=  377 pos= 5/10 gini=0.499 top10=100.0% sp100=40.32` |

## Target Refinement Candidates
| filter | why | data_2026 | history |
|---|---|---:|---:|
| original | Original target rule. | `sig= 3695 bet=  11085 hit= 319 net=     399 roi=    3.6% hr=  8.6% avgBet=3.0 dd=  543 pos=31/67 gini=0.474 top10=53.6% sp100=32.87` | `sig= 3363 bet=  10089 hit= 293 net=     459 roi=    4.5% hr=  8.7% avgBet=3.0 dd=  522 pos=19/55 gini=0.512 top10=55.8% sp100=34.87` |
| recentZ-1-to-2 | Keep recent 160 z in [1.0, 2.0). Avoid weak and overheated sectors. | `sig= 2018 bet=   6054 hit= 190 net=     786 roi=   13.0% hr=  9.4% avgBet=3.0 dd=  258 pos=31/55 gini=0.479 top10=52.4% sp100=17.95` | `sig= 1700 bet=   5100 hit= 158 net=     588 roi=   11.5% hr=  9.3% avgBet=3.0 dd=  351 pos=20/46 gini=0.500 top10=58.2% sp100=17.63` |
| recentZ-under-2 | Drop overheated recent 160 sectors, keep z<2.0. | `sig= 2062 bet=   6186 hit= 195 net=     834 roi=   13.5% hr=  9.5% avgBet=3.0 dd=  249 pos=31/55 gini=0.465 top10=52.2% sp100=18.34` | `sig= 1755 bet=   5265 hit= 161 net=     531 roi=   10.1% hr=  9.2% avgBet=3.0 dd=  399 pos=20/46 gini=0.507 top10=58.1% sp100=18.20` |
| recentZ-at-least-1 | Require recent 160 z>=1.0. | `sig= 3651 bet=  10953 hit= 314 net=     351 roi=    3.2% hr=  8.6% avgBet=3.0 dd=  600 pos=31/67 gini=0.477 top10=53.6% sp100=32.48` | `sig= 3308 bet=   9924 hit= 290 net=     516 roi=    5.2% hr=  8.8% avgBet=3.0 dd=  474 pos=20/55 gini=0.520 top10=55.8% sp100=34.30` |
| position-200-399 | Only first 200 live spins after the ROI boundary. | `sig= 2426 bet=   7278 hit= 218 net=     570 roi=    7.8% hr=  9.0% avgBet=3.0 dd=  573 pos=30/67 gini=0.510 top10=45.2% sp100=21.58` | `sig= 2410 bet=   7230 hit= 219 net=     654 roi=    9.0% hr=  9.1% avgBet=3.0 dd=  534 pos=22/55 gini=0.508 top10=49.0% sp100=24.99` |
| recentZ-1-to-2-position-200-399 | recentZ in [1,2) and position 200-399. | `sig= 1355 bet=   4065 hit= 132 net=     687 roi=   16.9% hr=  9.7% avgBet=3.0 dd=  231 pos=30/55 gini=0.501 top10=50.0% sp100=12.05` | `sig= 1245 bet=   3735 hit= 122 net=     657 roi=   17.6% hr=  9.8% avgBet=3.0 dd=  294 pos=21/46 gini=0.499 top10=52.4% sp100=12.91` |
| distance-0-or-3 | Keep only exact alignment or outer edge distance 3. | `sig= 1315 bet=   3945 hit= 117 net=     267 roi=    6.8% hr=  8.9% avgBet=3.0 dd=  372 pos=19/46 gini=0.503 top10=64.5% sp100=11.70` | `sig= 1310 bet=   3930 hit= 129 net=     714 roi=   18.2% hr=  9.8% avgBet=3.0 dd=  327 pos=17/37 gini=0.558 top10=66.4% sp100=13.58` |
| distance-not-1 | Drop distance 1, which was weak in both datasets. | `sig= 2584 bet=   7752 hit= 227 net=     420 roi=    5.4% hr=  8.8% avgBet=3.0 dd=  426 pos=26/61 gini=0.489 top10=58.4% sp100=22.99` | `sig= 2341 bet=   7023 hit= 211 net=     573 roi=    8.2% hr=  9.0% avgBet=3.0 dd=  306 pos=20/49 gini=0.529 top10=57.5% sp100=24.27` |
| stability-0p70-plus | Only highly stable table profiles. | `sig= 1241 bet=   3723 hit= 116 net=     453 roi=   12.2% hr=  9.3% avgBet=3.0 dd=  240 pos=14/35 gini=0.562 top10=85.1% sp100=11.04` | `sig= 1280 bet=   3840 hit= 118 net=     408 roi=   10.6% hr=  9.2% avgBet=3.0 dd=  228 pos=13/34 gini=0.516 top10=74.5% sp100=13.27` |
| not-multi-core | Drop multi-core table type. | `sig= 3393 bet=  10179 hit= 295 net=     441 roi=    4.3% hr=  8.7% avgBet=3.0 dd=  360 pos=31/63 gini=0.470 top10=54.2% sp100=30.18` | `sig= 3216 bet=   9648 hit= 284 net=     576 roi=    6.0% hr=  8.8% avgBet=3.0 dd=  408 pos=20/52 gini=0.520 top10=58.3% sp100=33.35` |

## Selected Refinements By Year
| dataset | filter | year | summary + SP100 |
|---|---|---:|---:|
| data_2026.6.11.json | original | 2019 | `sig=  340 bet=   1020 hit=  27 net=     -48 roi=   -4.7% hr=  7.9% avgBet=3.0 dd=  201 pos= 3/8  gini=0.378 top10=100.0% sp100=24.85` |
| data_2026.6.11.json | original | 2021 | `sig=  295 bet=    885 hit=  40 net=     555 roi=   62.7% hr= 13.6% avgBet=3.0 dd=   84 pos=10/14 gini=0.510 top10=93.2% sp100=17.94` |
| data_2026.6.11.json | original | 2023 | `sig=  272 bet=    816 hit=  22 net=     -24 roi=   -2.9% hr=  8.1% avgBet=3.0 dd=  144 pos= 3/8  gini=0.307 top10=100.0% sp100=41.27` |
| data_2026.6.11.json | original | 2024 | `sig=    8 bet=     24 hit=   2 net=      48 roi=  200.0% hr= 25.0% avgBet=3.0 dd=    9 pos= 1/1  gini=0.000 top10=100.0% sp100=72.73` |
| data_2026.6.11.json | original | 2025 | `sig=   48 bet=    144 hit=   0 net=    -144 roi= -100.0% hr=  0.0% avgBet=3.0 dd=  144 pos= 0/6  gini=0.486 top10=100.0% sp100=10.62` |
| data_2026.6.11.json | original | 2026 | `sig= 2732 bet=   8196 hit= 228 net=      12 roi=    0.1% hr=  8.3% avgBet=3.0 dd=  450 pos=14/30 gini=0.457 top10=72.3% sp100=39.66` |
| data_2026.6.11.json | recentZ-1-to-2 | 2019 | `sig=  251 bet=    753 hit=  22 net=      39 roi=    5.2% hr=  8.8% avgBet=3.0 dd=  138 pos= 3/6  gini=0.415 top10=100.0% sp100=18.35` |
| data_2026.6.11.json | recentZ-1-to-2 | 2021 | `sig=  194 bet=    582 hit=  29 net=     462 roi=   79.4% hr= 14.9% avgBet=3.0 dd=   57 pos= 8/11 gini=0.453 top10=99.5% sp100=11.80` |
| data_2026.6.11.json | recentZ-1-to-2 | 2023 | `sig=  192 bet=    576 hit=  17 net=      36 roi=    6.3% hr=  8.9% avgBet=3.0 dd=  120 pos= 3/6  gini=0.467 top10=100.0% sp100=29.14` |
| data_2026.6.11.json | recentZ-1-to-2 | 2024 | `sig=    8 bet=     24 hit=   2 net=      48 roi=  200.0% hr= 25.0% avgBet=3.0 dd=    9 pos= 1/1  gini=0.000 top10=100.0% sp100=72.73` |
| data_2026.6.11.json | recentZ-1-to-2 | 2025 | `sig=    8 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   24 pos= 0/2  gini=0.250 top10=100.0% sp100=1.77` |
| data_2026.6.11.json | recentZ-1-to-2 | 2026 | `sig= 1365 bet=   4095 hit= 120 net=     225 roi=    5.5% hr=  8.8% avgBet=3.0 dd=  258 pos=16/29 gini=0.462 top10=71.6% sp100=19.81` |
| data_2026.6.11.json | position-200-399 | 2019 | `sig=  254 bet=    762 hit=  23 net=      66 roi=    8.7% hr=  9.1% avgBet=3.0 dd=  144 pos= 3/8  gini=0.451 top10=100.0% sp100=18.57` |
| data_2026.6.11.json | position-200-399 | 2021 | `sig=  216 bet=    648 hit=  29 net=     396 roi=   61.1% hr= 13.4% avgBet=3.0 dd=   93 pos= 9/14 gini=0.523 top10=90.7% sp100=13.14` |
| data_2026.6.11.json | position-200-399 | 2023 | `sig=  260 bet=    780 hit=  20 net=     -60 roi=   -7.7% hr=  7.7% avgBet=3.0 dd=  180 pos= 3/8  gini=0.380 top10=100.0% sp100=39.45` |
| data_2026.6.11.json | position-200-399 | 2024 | `sig=    8 bet=     24 hit=   2 net=      48 roi=  200.0% hr= 25.0% avgBet=3.0 dd=    9 pos= 1/1  gini=0.000 top10=100.0% sp100=72.73` |
| data_2026.6.11.json | position-200-399 | 2025 | `sig=   48 bet=    144 hit=   0 net=    -144 roi= -100.0% hr=  0.0% avgBet=3.0 dd=  144 pos= 0/6  gini=0.486 top10=100.0% sp100=10.62` |
| data_2026.6.11.json | position-200-399 | 2026 | `sig= 1640 bet=   4920 hit= 144 net=     264 roi=    5.4% hr=  8.8% avgBet=3.0 dd=  387 pos=14/30 gini=0.484 top10=62.9% sp100=23.81` |
| data_2026.6.11.json | recentZ-1-to-2-position-200-399 | 2019 | `sig=  194 bet=    582 hit=  20 net=     138 roi=   23.7% hr= 10.3% avgBet=3.0 dd=   75 pos= 3/6  gini=0.531 top10=100.0% sp100=14.18` |
| data_2026.6.11.json | recentZ-1-to-2-position-200-399 | 2021 | `sig=  138 bet=    414 hit=  20 net=     306 roi=   73.9% hr= 14.5% avgBet=3.0 dd=   51 pos= 7/11 gini=0.452 top10=99.3% sp100=8.39` |
| data_2026.6.11.json | recentZ-1-to-2-position-200-399 | 2023 | `sig=  180 bet=    540 hit=  15 net=       0 roi=    0.0% hr=  8.3% avgBet=3.0 dd=  120 pos= 3/6  gini=0.321 top10=100.0% sp100=27.31` |
| data_2026.6.11.json | recentZ-1-to-2-position-200-399 | 2024 | `sig=    8 bet=     24 hit=   2 net=      48 roi=  200.0% hr= 25.0% avgBet=3.0 dd=    9 pos= 1/1  gini=0.000 top10=100.0% sp100=72.73` |
| data_2026.6.11.json | recentZ-1-to-2-position-200-399 | 2025 | `sig=    8 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   24 pos= 0/2  gini=0.250 top10=100.0% sp100=1.77` |
| data_2026.6.11.json | recentZ-1-to-2-position-200-399 | 2026 | `sig=  827 bet=   2481 hit=  75 net=     219 roi=    8.8% hr=  9.1% avgBet=3.0 dd=  231 pos=16/29 gini=0.479 top10=68.6% sp100=12.00` |
| history_data.json | original | 2021 | `sig=  421 bet=   1263 hit=  39 net=     141 roi=   11.2% hr=  9.3% avgBet=3.0 dd=  204 pos= 5/12 gini=0.455 top10=99.0% sp100=25.61` |
| history_data.json | original | 2023 | `sig=  233 bet=    699 hit=  19 net=     -15 roi=   -2.1% hr=  8.2% avgBet=3.0 dd=  153 pos= 2/7  gini=0.367 top10=100.0% sp100=35.36` |
| history_data.json | original | 2025 | `sig=  156 bet=    468 hit=  10 net=    -108 roi=  -23.1% hr=  6.4% avgBet=3.0 dd=  147 pos= 1/7  gini=0.435 top10=100.0% sp100=34.51` |
| history_data.json | original | 2026 | `sig= 2553 bet=   7659 hit= 225 net=     441 roi=    5.8% hr=  8.8% avgBet=3.0 dd=  396 pos=11/29 gini=0.523 top10=73.4% sp100=37.06` |
| history_data.json | recentZ-1-to-2 | 2021 | `sig=  280 bet=    840 hit=  29 net=     204 roi=   24.3% hr= 10.4% avgBet=3.0 dd=  141 pos= 4/8  gini=0.423 top10=100.0% sp100=17.03` |
| history_data.json | recentZ-1-to-2 | 2023 | `sig=  134 bet=    402 hit=  10 net=     -42 roi=  -10.4% hr=  7.5% avgBet=3.0 dd=  147 pos= 1/6  gini=0.400 top10=100.0% sp100=20.33` |
| history_data.json | recentZ-1-to-2 | 2025 | `sig=   45 bet=    135 hit=   2 net=     -63 roi=  -46.7% hr=  4.4% avgBet=3.0 dd=  105 pos= 1/3  gini=0.231 top10=100.0% sp100=9.96` |
| history_data.json | recentZ-1-to-2 | 2026 | `sig= 1241 bet=   3723 hit= 117 net=     489 roi=   13.1% hr=  9.4% avgBet=3.0 dd=  288 pos=14/29 gini=0.527 top10=76.5% sp100=18.01` |
| history_data.json | position-200-399 | 2021 | `sig=  367 bet=   1101 hit=  33 net=      87 roi=    7.9% hr=  9.0% avgBet=3.0 dd=  204 pos= 5/12 gini=0.427 top10=98.9% sp100=22.32` |
| history_data.json | position-200-399 | 2023 | `sig=  223 bet=    669 hit=  18 net=     -21 roi=   -3.1% hr=  8.1% avgBet=3.0 dd=  153 pos= 2/7  gini=0.372 top10=100.0% sp100=33.84` |
| history_data.json | position-200-399 | 2025 | `sig=  156 bet=    468 hit=  10 net=    -108 roi=  -23.1% hr=  6.4% avgBet=3.0 dd=  147 pos= 1/7  gini=0.435 top10=100.0% sp100=34.51` |
| history_data.json | position-200-399 | 2026 | `sig= 1664 bet=   4992 hit= 158 net=     696 roi=   13.9% hr=  9.5% avgBet=3.0 dd=  393 pos=14/29 gini=0.522 top10=68.4% sp100=24.15` |
| history_data.json | recentZ-1-to-2-position-200-399 | 2021 | `sig=  262 bet=    786 hit=  26 net=     150 roi=   19.1% hr=  9.9% avgBet=3.0 dd=  141 pos= 4/8  gini=0.408 top10=100.0% sp100=15.94` |
| history_data.json | recentZ-1-to-2-position-200-399 | 2023 | `sig=  124 bet=    372 hit=   9 net=     -48 roi=  -12.9% hr=  7.3% avgBet=3.0 dd=  147 pos= 1/6  gini=0.405 top10=100.0% sp100=18.82` |
| history_data.json | recentZ-1-to-2-position-200-399 | 2025 | `sig=   45 bet=    135 hit=   2 net=     -63 roi=  -46.7% hr=  4.4% avgBet=3.0 dd=  105 pos= 1/3  gini=0.231 top10=100.0% sp100=9.96` |
| history_data.json | recentZ-1-to-2-position-200-399 | 2026 | `sig=  814 bet=   2442 hit=  85 net=     618 roi=   25.3% hr= 10.4% avgBet=3.0 dd=  237 pos=15/29 gini=0.525 top10=71.3% sp100=11.82` |

# Dataset Deep Dive: data_2026.6.11.json
- target strategy: `recent-recent-w160-r1-d3-s3-rz0p5`
- eligible post-200 spins: 11241
- target overall: `sig= 3695 bet=  11085 hit= 319 net=     399 roi=    3.6% hr=  8.6% avgBet=3.0 dd=  543 pos=31/67 gini=0.474 top10=53.6% sp100=32.87`

## data_2026.6.11.json / By Year
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2019 | `sig=  340 bet=   1020 hit=  27 net=     -48 roi=   -4.7% hr=  7.9% avgBet=3.0 dd=  201 pos= 3/8  gini=0.378 top10=100.0% sp100=24.85` | 1.89 | 1.82 | 0.55 |
| 2021 | `sig=  295 bet=    885 hit=  40 net=     555 roi=   62.7% hr= 13.6% avgBet=3.0 dd=   84 pos=10/14 gini=0.510 top10=93.2% sp100=17.94` | 1.64 | 1.91 | 0.46 |
| 2023 | `sig=  272 bet=    816 hit=  22 net=     -24 roi=   -2.9% hr=  8.1% avgBet=3.0 dd=  144 pos= 3/8  gini=0.307 top10=100.0% sp100=41.27` | 1.32 | 1.75 | 0.35 |
| 2024 | `sig=    8 bet=     24 hit=   2 net=      48 roi=  200.0% hr= 25.0% avgBet=3.0 dd=    9 pos= 1/1  gini=0.000 top10=100.0% sp100=72.73` | 2.00 | 1.56 | 0.33 |
| 2025 | `sig=   48 bet=    144 hit=   0 net=    -144 roi= -100.0% hr=  0.0% avgBet=3.0 dd=  144 pos= 0/6  gini=0.486 top10=100.0% sp100=10.62` | 1.10 | 2.43 | 0.51 |
| 2026 | `sig= 2732 bet=   8196 hit= 228 net=      12 roi=    0.1% hr=  8.3% avgBet=3.0 dd=  450 pos=14/30 gini=0.457 top10=72.3% sp100=39.66` | 1.57 | 2.07 | 0.64 |

## data_2026.6.11.json / By Table Type
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| small-sample | `sig= 1047 bet=   3141 hit=  94 net=     243 roi=    7.7% hr=  9.0% avgBet=3.0 dd=  249 pos=11/28 gini=0.547 top10=84.0% sp100=19.16` | 1.19 | 2.01 | 0.90 |
| mixed-core | `sig=  781 bet=   2343 hit=  68 net=     105 roi=    4.5% hr=  8.7% avgBet=3.0 dd=  258 pos=14/26 gini=0.394 top10=79.4% sp100=16.56` | 1.65 | 1.92 | 0.22 |
| single-core | `sig= 1565 bet=   4695 hit= 133 net=      93 roi=    2.0% hr=  8.5% avgBet=3.0 dd=  447 pos=15/39 gini=0.420 top10=76.1% sp100=23.71` | 1.84 | 2.10 | 0.62 |
| multi-core | `sig=  302 bet=    906 hit=  24 net=     -42 roi=   -4.6% hr=  7.9% avgBet=3.0 dd=  297 pos= 2/10 gini=0.513 top10=100.0% sp100=19.82` | 1.37 | 1.84 | 0.30 |

## data_2026.6.11.json / By Assignment Level
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| confirmed | `sig= 1431 bet=   4293 hit= 125 net=     207 roi=    4.8% hr=  8.7% avgBet=3.0 dd=  282 pos=18/48 gini=0.490 top10=66.3% sp100=16.53` | 1.60 | 1.98 | 0.60 |
| probable | `sig= 2264 bet=   6792 hit= 194 net=     192 roi=    2.8% hr=  8.6% avgBet=3.0 dd=  522 pos=23/57 gini=0.492 top10=62.7% sp100=26.10` | 1.56 | 2.04 | 0.59 |

## data_2026.6.11.json / By Distance
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2 | `sig= 1269 bet=   3807 hit= 110 net=     153 roi=    4.0% hr=  8.7% avgBet=3.0 dd=  348 pos=17/45 gini=0.491 top10=64.9% sp100=15.06` | 2.00 | 2.05 | 0.58 |
| 0 | `sig=  588 bet=   1764 hit=  53 net=     144 roi=    8.2% hr=  9.0% avgBet=3.0 dd=  258 pos= 7/22 gini=0.553 top10=87.6% sp100=11.51` | 0.00 | 2.02 | 0.74 |
| 3 | `sig=  727 bet=   2181 hit=  64 net=     123 roi=    5.6% hr=  8.8% avgBet=3.0 dd=  252 pos=14/37 gini=0.438 top10=70.7% sp100=9.61` | 3.00 | 2.00 | 0.58 |
| 1 | `sig= 1111 bet=   3333 hit=  92 net=     -21 roi=   -0.6% hr=  8.3% avgBet=3.0 dd=  345 pos=15/42 gini=0.465 top10=60.4% sp100=13.27` | 1.00 | 1.98 | 0.54 |

## data_2026.6.11.json / By Recent Z
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 1.00-1.49 | `sig=  561 bet=   1683 hit=  61 net=     513 roi=   30.5% hr= 10.9% avgBet=3.0 dd=  156 pos=23/42 gini=0.476 top10=63.3% sp100=6.45` | 1.57 | 1.28 | 0.55 |
| 1.50-1.99 | `sig= 1457 bet=   4371 hit= 129 net=     273 roi=    6.2% hr=  8.9% avgBet=3.0 dd=  354 pos=23/54 gini=0.494 top10=55.5% sp100=14.95` | 1.62 | 1.77 | 0.54 |
| 0.75-0.99 | `sig=   44 bet=    132 hit=   5 net=      48 roi=   36.4% hr= 11.4% avgBet=3.0 dd=   48 pos= 4/15 gini=0.472 top10=88.6% sp100=1.08` | 1.73 | 0.95 | 0.73 |
| 2.00+ | `sig= 1633 bet=   4899 hit= 124 net=    -435 roi=   -8.9% hr=  7.6% avgBet=3.0 dd=  621 pos=16/49 gini=0.515 top10=64.4% sp100=18.60` | 1.54 | 2.52 | 0.65 |

## data_2026.6.11.json / By Table Top1 Z
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2.00+ | `sig= 3303 bet=   9909 hit= 284 net=     315 roi=    3.2% hr=  8.6% avgBet=3.0 dd=  579 pos=27/64 gini=0.492 top10=56.5% sp100=33.33` | 1.58 | 2.02 | 0.57 |
| 1.50-1.99 | `sig=  212 bet=    636 hit=  21 net=     120 roi=   18.9% hr=  9.9% avgBet=3.0 dd=  114 pos= 5/12 gini=0.434 top10=96.7% sp100=7.65` | 1.78 | 1.88 | 0.69 |
| 0.75-0.99 | `sig=  161 bet=    483 hit=  14 net=      21 roi=    4.3% hr=  8.7% avgBet=3.0 dd=  183 pos= 1/1  gini=0.000 top10=100.0% sp100=40.35` | 1.14 | 2.07 | 1.00 |
| 1.00-1.49 | `sig=   19 bet=     57 hit=   0 net=     -57 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   57 pos= 0/2  gini=0.026 top10=100.0% sp100=1.86` | 2.32 | 1.70 | 0.47 |

## data_2026.6.11.json / By Primary Stability
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 0.70+ | `sig= 1241 bet=   3723 hit= 116 net=     453 roi=   12.2% hr=  9.3% avgBet=3.0 dd=  240 pos=14/35 gini=0.562 top10=85.1% sp100=17.92` | 1.31 | 2.06 | 0.94 |
| 0.45-0.69 | `sig= 1331 bet=   3993 hit= 111 net=       3 roi=    0.1% hr=  8.3% avgBet=3.0 dd=  495 pos=13/36 gini=0.461 top10=74.3% sp100=21.81` | 1.86 | 2.07 | 0.57 |
| <0.45 | `sig= 1123 bet=   3369 hit=  92 net=     -57 roi=   -1.7% hr=  8.2% avgBet=3.0 dd=  528 pos=14/34 gini=0.418 top10=75.2% sp100=17.57` | 1.54 | 1.89 | 0.22 |

## data_2026.6.11.json / By Table Numbers
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 500-999 | `sig= 1208 bet=   3624 hit= 112 net=     408 roi=   11.3% hr=  9.3% avgBet=3.0 dd=  252 pos=17/31 gini=0.459 top10=74.7% sp100=18.98` | 1.52 | 1.89 | 0.61 |
| <500 | `sig=  602 bet=   1806 hit=  60 net=     354 roi=   19.6% hr= 10.0% avgBet=3.0 dd=  159 pos= 9/22 gini=0.588 top10=87.0% sp100=14.68` | 1.05 | 2.09 | 0.93 |
| 2000+ | `sig=  928 bet=   2784 hit=  76 net=     -48 roi=   -1.7% hr=  8.2% avgBet=3.0 dd=  270 pos= 8/25 gini=0.380 top10=85.5% sp100=17.60` | 1.83 | 2.15 | 0.45 |
| 1000-1499 | `sig=  585 bet=   1755 hit=  46 net=     -99 roi=   -5.6% hr=  7.9% avgBet=3.0 dd=  261 pos= 6/22 gini=0.485 top10=93.2% sp100=16.01` | 1.51 | 1.97 | 0.49 |
| 1500-1999 | `sig=  372 bet=   1116 hit=  25 net=    -216 roi=  -19.4% hr=  6.7% avgBet=3.0 dd=  306 pos= 6/14 gini=0.427 top10=93.5% sp100=12.73` | 2.09 | 2.03 | 0.49 |

## data_2026.6.11.json / By Position Bucket
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 200-399 | `sig= 2426 bet=   7278 hit= 218 net=     570 roi=    7.8% hr=  9.0% avgBet=3.0 dd=  573 pos=30/67 gini=0.510 top10=45.2% sp100=23.71` | 1.45 | 2.00 | 0.56 |
| 600-799 | `sig=  226 bet=    678 hit=  20 net=      42 roi=    6.2% hr=  8.8% avgBet=3.0 dd=  198 pos= 2/5  gini=0.437 top10=100.0% sp100=7.92` | 1.97 | 1.66 | 0.65 |
| 800-999 | `sig=   65 bet=    195 hit=   6 net=      21 roi=   10.8% hr=  9.2% avgBet=3.0 dd=   66 pos= 1/1  gini=0.000 top10=100.0% sp100=9.77` | 2.00 | 2.60 | 0.56 |
| 400-599 | `sig=  978 bet=   2934 hit=  75 net=    -234 roi=   -8.0% hr=  7.7% avgBet=3.0 dd=  408 pos= 5/16 gini=0.494 top10=89.0% sp100=15.40` | 1.76 | 2.10 | 0.65 |

## data_2026.6.11.json / By Venue
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| unknown | `sig=  367 bet=   1101 hit=  41 net=     375 roi=   34.1% hr= 11.2% avgBet=3.0 dd=  132 pos= 9/14 gini=0.430 top10=94.3% sp100=32.14` | 1.50 | 1.77 | 0.36 |
| 澳门永利 | `sig= 1133 bet=   3399 hit= 102 net=     273 roi=    8.0% hr=  9.0% avgBet=3.0 dd=  345 pos= 7/11 gini=0.491 top10=99.7% sp100=37.63` | 1.24 | 2.07 | 0.81 |
| 电 | `sig=   57 bet=    171 hit=   9 net=     153 roi=   89.5% hr= 15.8% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=19.13` | 1.11 | 1.80 | 0.35 |
| 银河 | `sig=   40 bet=    120 hit=   6 net=      96 roi=   80.0% hr= 15.0% avgBet=3.0 dd=   60 pos= 1/1  gini=0.000 top10=100.0% sp100=100.00` | 1.32 | 2.30 | 0.75 |
| 新 | `sig=   21 bet=     63 hit=   3 net=      45 roi=   71.4% hr= 14.3% avgBet=3.0 dd=   42 pos= 1/1  gini=0.000 top10=100.0% sp100=30.00` | 1.19 | 1.61 | 0.67 |
| 伦敦人 | `sig=   54 bet=    162 hit=   5 net=      18 roi=   11.1% hr=  9.3% avgBet=3.0 dd=   54 pos= 1/3  gini=0.417 top10=100.0% sp100=52.94` | 1.28 | 1.58 | 0.76 |
| 上午全 | `sig=  103 bet=    309 hit=   9 net=      15 roi=    4.9% hr=  8.7% avgBet=3.0 dd=   66 pos= 1/1  gini=0.000 top10=100.0% sp100=60.23` | 1.93 | 1.70 | 0.33 |
| 巴黎人 | `sig=   47 bet=    141 hit=   4 net=       3 roi=    2.1% hr=  8.5% avgBet=3.0 dd=   36 pos= 1/2  gini=0.056 top10=100.0% sp100=57.32` | 2.62 | 2.23 | 0.54 |
| sxr01 | `sig=    6 bet=     18 hit=   0 net=     -18 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   18 pos= 0/1  gini=0.000 top10=100.0% sp100=100.00` | 2.00 | 2.20 | 0.50 |
| 喜来登 | `sig=    8 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   24 pos= 0/2  gini=0.125 top10=100.0% sp100=6.45` | 0.00 | 2.27 | 1.00 |
| 下午全 | `sig=   25 bet=     75 hit=   1 net=     -39 roi=  -52.0% hr=  4.0% avgBet=3.0 dd=   48 pos= 0/1  gini=0.000 top10=100.0% sp100=100.00` | 1.96 | 2.25 | 0.71 |
| 01 | `sig=   71 bet=    213 hit=   4 net=     -69 roi=  -32.4% hr=  5.6% avgBet=3.0 dd=   96 pos= 0/1  gini=0.000 top10=100.0% sp100=24.57` | 2.92 | 1.98 | 1.00 |
| 巴黎人老 | `sig=   31 bet=     93 hit=   0 net=     -93 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   93 pos= 0/1  gini=0.000 top10=100.0% sp100=13.36` | 1.00 | 1.48 | 0.52 |
| 威尼斯人 | `sig=   55 bet=    165 hit=   2 net=     -93 roi=  -56.4% hr=  3.6% avgBet=3.0 dd=   93 pos= 0/1  gini=0.000 top10=100.0% sp100=65.48` | 0.91 | 2.28 | 0.33 |
| wzs | `sig= 1677 bet=   5031 hit= 133 net=    -243 roi=   -4.8% hr=  7.9% avgBet=3.0 dd=  459 pos= 9/26 gini=0.421 top10=86.0% sp100=36.82` | 1.78 | 2.06 | 0.50 |

## data_2026.6.11.json / Latest 10 Sessions
| # | date | name | spins | summary + SP100 | avg distance | avg recentZ |
|---:|---|---|---:|---:|---:|---:|
| 1 | 2026-06-01 | 20260601-1630-澳门永利 | 108 | `sig=   68 bet=    204 hit=   4 net=     -60 roi=  -29.4% hr=  5.9% avgBet=3.0 dd=   78 pos= 0/1  gini=0.000 top10=100.0% sp100=62.96` | 0.91 | 1.41 |
| 2 | 2026-06-01 | 20260602-0018-澳门永利 | 167 | `sig=   95 bet=    285 hit=   9 net=      39 roi=   13.7% hr=  9.5% avgBet=3.0 dd=  114 pos= 1/1  gini=0.000 top10=100.0% sp100=56.89` | 1.06 | 2.16 |
| 3 | 2026-06-02 | 20260603-0030-澳门永利 | 609 | `sig=  279 bet=    837 hit=  30 net=     243 roi=   29.0% hr= 10.8% avgBet=3.0 dd=  207 pos= 1/1  gini=0.000 top10=100.0% sp100=45.81` | 0.65 | 2.21 |
| 4 | 2026-06-02 | 20260603-0230-澳门永利 | 77 | `sig=   16 bet=     48 hit=   2 net=      24 roi=   50.0% hr= 12.5% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=20.78` | 1.00 | 1.90 |
| 5 | 2026-06-03 | 20260603-2101-澳门永利 | 399 | `sig=  190 bet=    570 hit=  16 net=       6 roi=    1.1% hr=  8.4% avgBet=3.0 dd=  183 pos= 1/1  gini=0.000 top10=100.0% sp100=47.62` | 1.25 | 2.05 |
| 6 | 2026-06-04 | 20260604-1630-澳门永利 | 318 | `sig=   84 bet=    252 hit=   3 net=    -144 roi=  -57.1% hr=  3.6% avgBet=3.0 dd=  168 pos= 0/1  gini=0.000 top10=100.0% sp100=26.42` | 1.92 | 1.55 |
| 7 | 2026-06-05 | 20260605-0230-澳门永利 | 111 | `sig=   24 bet=     72 hit=   3 net=      36 roi=   50.0% hr= 12.5% avgBet=3.0 dd=   36 pos= 1/1  gini=0.000 top10=100.0% sp100=21.62` | 0.04 | 1.48 |
| 8 | 2026-06-05 | 20260604-2223-澳门永利 | 53 | `sig=    3 bet=      9 hit=   0 net=      -9 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    9 pos= 0/1  gini=0.000 top10=100.0% sp100=5.66` | 2.33 | 1.16 |
| 9 | 2026-06-10 | 20260606-0131-澳门永利 | 556 | `sig=  160 bet=    480 hit=  16 net=      96 roi=   20.0% hr= 10.0% avgBet=3.0 dd=  105 pos= 1/1  gini=0.000 top10=100.0% sp100=28.78` | 1.55 | 2.45 |
| 10 | 2026-06-10 | 20260607-0217-澳门永利 | 561 | `sig=  204 bet=    612 hit=  19 net=      72 roi=   11.8% hr=  9.3% avgBet=3.0 dd=  126 pos= 1/1  gini=0.000 top10=100.0% sp100=36.36` | 1.84 | 2.14 |

## data_2026.6.11.json / Latest 10 By Distance
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 0 | `sig=  365 bet=   1095 hit=  36 net=     201 roi=   18.4% hr=  9.9% avgBet=3.0 dd=  225 pos= 2/7  gini=0.643 top10=100.0% sp100=16.09` | 0.00 | 2.10 | 0.94 |
| 1 | `sig=  264 bet=    792 hit=  24 net=      72 roi=    9.1% hr=  9.1% avgBet=3.0 dd=  123 pos= 4/10 gini=0.421 top10=100.0% sp100=8.92` | 1.00 | 2.02 | 0.78 |
| 3 | `sig=  138 bet=    414 hit=  13 net=      54 roi=   13.0% hr=  9.4% avgBet=3.0 dd=   72 pos= 2/7  gini=0.598 top10=100.0% sp100=5.18` | 3.00 | 2.03 | 0.74 |
| 2 | `sig=  356 bet=   1068 hit=  29 net=     -24 roi=   -2.2% hr=  8.1% avgBet=3.0 dd=  252 pos= 3/7  gini=0.360 top10=100.0% sp100=13.10` | 2.00 | 2.12 | 0.72 |

## data_2026.6.11.json / Top Winning Sessions
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2026-06-02 / 20260603-0030-澳门永利 | `sig=  279 bet=    837 hit=  30 net=     243 roi=   29.0% hr= 10.8% avgBet=3.0 dd=  207 pos= 1/1  gini=0.000 top10=100.0% sp100=45.81` | 0.65 | 2.21 | 0.94 |
| 2021-06-21 / 20210621-1606 | `sig=   41 bet=    123 hit=   9 net=     201 roi=  163.4% hr= 22.0% avgBet=3.0 dd=   51 pos= 1/1  gini=0.000 top10=100.0% sp100=41.84` | 2.00 | 1.69 | 0.67 |
| 2021-04-23 / wzs-2021-04-23-063 | `sig=   92 bet=    276 hit=  12 net=     156 roi=   56.5% hr= 13.0% avgBet=3.0 dd=   39 pos= 1/1  gini=0.000 top10=100.0% sp100=22.28` | 1.05 | 1.82 | 0.25 |
| 2019-11-17 / 20191010-清晨-喜来登-电 | `sig=   57 bet=    171 hit=   9 net=     153 roi=   89.5% hr= 15.8% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=19.13` | 1.11 | 1.80 | 0.35 |
| 2026-01-13 / 20260113-晚上-银河 | `sig=   40 bet=    120 hit=   6 net=      96 roi=   80.0% hr= 15.0% avgBet=3.0 dd=   60 pos= 1/1  gini=0.000 top10=100.0% sp100=100.00` | 1.32 | 2.30 | 0.75 |
| 2026-06-10 / 20260606-0131-澳门永利 | `sig=  160 bet=    480 hit=  16 net=      96 roi=   20.0% hr= 10.0% avgBet=3.0 dd=  105 pos= 1/1  gini=0.000 top10=100.0% sp100=28.78` | 1.55 | 2.45 | 0.89 |
| 2021-06-19 / 20210619-1545 | `sig=   21 bet=     63 hit=   4 net=      81 roi=  128.6% hr= 19.0% avgBet=3.0 dd=   30 pos= 1/1  gini=0.000 top10=100.0% sp100=84.00` | 1.00 | 2.42 | 0.50 |
| 2026-06-10 / 20260607-0217-澳门永利 | `sig=  204 bet=    612 hit=  19 net=      72 roi=   11.8% hr=  9.3% avgBet=3.0 dd=  126 pos= 1/1  gini=0.000 top10=100.0% sp100=36.36` | 1.84 | 2.14 | 0.63 |
| 2021-06-17 / 20210617-1819 | `sig=   15 bet=     45 hit=   3 net=      63 roi=  140.0% hr= 20.0% avgBet=3.0 dd=   18 pos= 1/1  gini=0.000 top10=100.0% sp100=93.75` | 0.67 | 1.47 | 0.67 |
| 2026-05-11 / wzs-2026-05-11-807 | `sig=   39 bet=    117 hit=   5 net=      63 roi=   53.8% hr= 12.8% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=29.55` | 1.08 | 1.82 | 0.63 |
| 2021-06-20 / 20210620-2016 | `sig=   19 bet=     57 hit=   3 net=      51 roi=   89.5% hr= 15.8% avgBet=3.0 dd=   24 pos= 1/1  gini=0.000 top10=100.0% sp100=12.42` | 3.00 | 1.45 | 0.20 |
| 2024-03-18 / wzs-2024-03-18-001 | `sig=    8 bet=     24 hit=   2 net=      48 roi=  200.0% hr= 25.0% avgBet=3.0 dd=    9 pos= 1/1  gini=0.000 top10=100.0% sp100=72.73` | 2.00 | 1.56 | 0.33 |
| 2019-11-17 / 20191009-晚上-假日-新 | `sig=   21 bet=     63 hit=   3 net=      45 roi=   71.4% hr= 14.3% avgBet=3.0 dd=   42 pos= 1/1  gini=0.000 top10=100.0% sp100=30.00` | 1.19 | 1.61 | 0.67 |
| 2023-06-07 / 20230607-2252 | `sig=  119 bet=    357 hit=  11 net=      39 roi=   10.9% hr=  9.2% avgBet=3.0 dd=  120 pos= 1/1  gini=0.000 top10=100.0% sp100=43.75` | 0.87 | 1.55 | 0.00 |
| 2026-06-01 / 20260602-0018-澳门永利 | `sig=   95 bet=    285 hit=   9 net=      39 roi=   13.7% hr=  9.5% avgBet=3.0 dd=  114 pos= 1/1  gini=0.000 top10=100.0% sp100=56.89` | 1.06 | 2.16 | 0.71 |

## data_2026.6.11.json / Worst Losing Sessions
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2026-06-04 / 20260604-1630-澳门永利 | `sig=   84 bet=    252 hit=   3 net=    -144 roi=  -57.1% hr=  3.6% avgBet=3.0 dd=  168 pos= 0/1  gini=0.000 top10=100.0% sp100=26.42` | 1.92 | 1.55 | 0.56 |
| 2019-11-18 / 20191118-上下午-巴黎人老 | `sig=   31 bet=     93 hit=   0 net=     -93 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   93 pos= 0/1  gini=0.000 top10=100.0% sp100=13.36` | 1.00 | 1.48 | 0.52 |
| 2026-01-15 / 20260115-晚上-威尼斯人 | `sig=   55 bet=    165 hit=   2 net=     -93 roi=  -56.4% hr=  3.6% avgBet=3.0 dd=   93 pos= 0/1  gini=0.000 top10=100.0% sp100=65.48` | 0.91 | 2.28 | 0.33 |
| 2026-04-06 / wzs-2026-04-06-702 | `sig=   38 bet=    114 hit=   1 net=     -78 roi=  -68.4% hr=  2.6% avgBet=3.0 dd=   78 pos= 0/1  gini=0.000 top10=100.0% sp100=25.85` | 1.71 | 1.94 | 0.40 |
| 2019-01-16 / 20181129-01 | `sig=   71 bet=    213 hit=   4 net=     -69 roi=  -32.4% hr=  5.6% avgBet=3.0 dd=   96 pos= 0/1  gini=0.000 top10=100.0% sp100=24.57` | 2.92 | 1.98 | 1.00 |
| 2026-01-11 / wzs-2026-01-11-603 | `sig=   57 bet=    171 hit=   3 net=     -63 roi=  -36.8% hr=  5.3% avgBet=3.0 dd=  123 pos= 0/1  gini=0.000 top10=100.0% sp100=17.17` | 2.28 | 2.20 | 0.53 |
| 2026-05-11 / wzs-2026-05-11-806 | `sig=  153 bet=    459 hit=  11 net=     -63 roi=  -13.7% hr=  7.2% avgBet=3.0 dd=  123 pos= 0/1  gini=0.000 top10=100.0% sp100=51.17` | 2.08 | 2.22 | 0.62 |
| 2026-06-01 / 20260601-1630-澳门永利 | `sig=   68 bet=    204 hit=   4 net=     -60 roi=  -29.4% hr=  5.9% avgBet=3.0 dd=   78 pos= 0/1  gini=0.000 top10=100.0% sp100=62.96` | 0.91 | 1.41 | 0.68 |
| 2025-01-13 / wzs-2025-01-13-301 | `sig=   19 bet=     57 hit=   0 net=     -57 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   57 pos= 0/1  gini=0.000 top10=100.0% sp100=21.11` | 0.53 | 2.23 | 0.42 |
| 2025-12-01 / wzs-2025-12-01-505 | `sig=   18 bet=     54 hit=   0 net=     -54 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   54 pos= 0/1  gini=0.000 top10=100.0% sp100=94.74` | 2.00 | 2.56 | 0.40 |
| 2026-04-06 / wzs-2026-04-06-703 | `sig=   77 bet=    231 hit=   5 net=     -51 roi=  -22.1% hr=  6.5% avgBet=3.0 dd=  108 pos= 0/1  gini=0.000 top10=100.0% sp100=100.00` | 1.70 | 2.74 | 0.67 |
| 2026-05-11 / wzs-2026-05-11-803 | `sig=  125 bet=    375 hit=   9 net=     -51 roi=  -13.6% hr=  7.2% avgBet=3.0 dd=  144 pos= 0/1  gini=0.000 top10=100.0% sp100=44.48` | 2.06 | 2.24 | 0.43 |
| 2023-06-08 / 20230608-1548 | `sig=   16 bet=     48 hit=   0 net=     -48 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   48 pos= 0/1  gini=0.000 top10=100.0% sp100=12.70` | 2.00 | 2.38 | 0.33 |
| 2021-04-23 / wzs-2021-04-23-062 | `sig=   15 bet=     45 hit=   0 net=     -45 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   45 pos= 0/1  gini=0.000 top10=100.0% sp100=20.83` | 2.47 | 2.92 | 0.64 |
| 2019-03-31 / 20190331-上午 | `sig=   26 bet=     78 hit=   1 net=     -42 roi=  -53.8% hr=  3.8% avgBet=3.0 dd=   63 pos= 0/1  gini=0.000 top10=100.0% sp100=33.77` | 2.12 | 2.00 | 0.50 |

# Dataset Deep Dive: history_data.json
- target strategy: `recent-recent-w160-r1-d3-s3-rz0p5`
- eligible post-200 spins: 9644
- target overall: `sig= 3363 bet=  10089 hit= 293 net=     459 roi=    4.5% hr=  8.7% avgBet=3.0 dd=  522 pos=19/55 gini=0.512 top10=55.8% sp100=34.87`

## history_data.json / By Year
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2021 | `sig=  421 bet=   1263 hit=  39 net=     141 roi=   11.2% hr=  9.3% avgBet=3.0 dd=  204 pos= 5/12 gini=0.455 top10=99.0% sp100=25.61` | 1.76 | 1.90 | 0.83 |
| 2023 | `sig=  233 bet=    699 hit=  19 net=     -15 roi=   -2.1% hr=  8.2% avgBet=3.0 dd=  153 pos= 2/7  gini=0.367 top10=100.0% sp100=35.36` | 1.74 | 1.93 | 0.54 |
| 2025 | `sig=  156 bet=    468 hit=  10 net=    -108 roi=  -23.1% hr=  6.4% avgBet=3.0 dd=  147 pos= 1/7  gini=0.435 top10=100.0% sp100=34.51` | 2.03 | 2.40 | 0.48 |
| 2026 | `sig= 2553 bet=   7659 hit= 225 net=     441 roi=    5.8% hr=  8.8% avgBet=3.0 dd=  396 pos=11/29 gini=0.523 top10=73.4% sp100=37.06` | 1.54 | 2.11 | 0.65 |

## history_data.json / By Table Type
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| small-sample | `sig= 1017 bet=   3051 hit=  97 net=     441 roi=   14.5% hr=  9.5% avgBet=3.0 dd=  204 pos=11/29 gini=0.572 top10=78.8% sp100=16.50` | 1.30 | 2.07 | 0.97 |
| mixed-core | `sig=  997 bet=   2991 hit=  85 net=      69 roi=    2.3% hr=  8.5% avgBet=3.0 dd=  366 pos= 9/23 gini=0.511 top10=90.9% sp100=21.64` | 1.75 | 2.00 | 0.35 |
| single-core | `sig= 1202 bet=   3606 hit= 102 net=      66 roi=    1.8% hr=  8.5% avgBet=3.0 dd=  387 pos= 7/23 gini=0.544 top10=88.4% sp100=23.56` | 1.71 | 2.18 | 0.68 |
| multi-core | `sig=  147 bet=    441 hit=   9 net=    -117 roi=  -26.5% hr=  6.1% avgBet=3.0 dd=  117 pos= 0/7  gini=0.359 top10=100.0% sp100=28.11` | 1.86 | 1.88 | 0.30 |

## history_data.json / By Assignment Level
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| probable | `sig= 2213 bet=   6639 hit= 191 net=     237 roi=    3.6% hr=  8.6% avgBet=3.0 dd=  435 pos=16/42 gini=0.529 top10=75.0% sp100=29.49` | 1.55 | 2.05 | 0.62 |
| confirmed | `sig= 1150 bet=   3450 hit= 102 net=     222 roi=    6.4% hr=  8.9% avgBet=3.0 dd=  330 pos=12/39 gini=0.455 top10=58.9% sp100=15.20` | 1.71 | 2.14 | 0.73 |

## history_data.json / By Distance
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 0 | `sig=  538 bet=   1614 hit=  58 net=     474 roi=   29.4% hr= 10.8% avgBet=3.0 dd=  138 pos= 9/20 gini=0.624 top10=91.3% sp100=11.16` | 0.00 | 2.21 | 0.80 |
| 3 | `sig=  772 bet=   2316 hit=  71 net=     240 roi=   10.4% hr=  9.2% avgBet=3.0 dd=  369 pos=11/30 gini=0.485 top10=76.4% sp100=11.85` | 3.00 | 2.00 | 0.63 |
| 1 | `sig= 1022 bet=   3066 hit=  82 net=    -114 roi=   -3.7% hr=  8.0% avgBet=3.0 dd=  468 pos= 8/31 gini=0.519 top10=74.5% sp100=16.08` | 1.00 | 2.04 | 0.66 |
| 2 | `sig= 1031 bet=   3093 hit=  82 net=    -141 roi=   -4.6% hr=  8.0% avgBet=3.0 dd=  354 pos=15/37 gini=0.477 top10=67.5% sp100=14.20` | 2.00 | 2.12 | 0.59 |

## history_data.json / By Recent Z
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 1.00-1.49 | `sig=  411 bet=   1233 hit=  46 net=     423 roi=   34.3% hr= 11.2% avgBet=3.0 dd=  207 pos=15/35 gini=0.551 top10=69.8% sp100=5.84` | 1.73 | 1.28 | 0.59 |
| 1.50-1.99 | `sig= 1289 bet=   3867 hit= 112 net=     165 roi=    4.3% hr=  8.7% avgBet=3.0 dd=  309 pos=16/42 gini=0.490 top10=62.1% sp100=16.85` | 1.66 | 1.77 | 0.66 |
| 0.75-0.99 | `sig=   55 bet=    165 hit=   3 net=     -57 roi=  -34.5% hr=  5.5% avgBet=3.0 dd=  114 pos= 3/14 gini=0.381 top10=92.7% sp100=1.43` | 1.65 | 0.95 | 0.60 |
| 2.00+ | `sig= 1608 bet=   4824 hit= 132 net=     -72 roi=   -1.5% hr=  8.2% avgBet=3.0 dd=  264 pos=15/38 gini=0.490 top10=64.2% sp100=22.65` | 1.53 | 2.57 | 0.67 |

## history_data.json / By Table Top1 Z
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2.00+ | `sig= 2831 bet=   8493 hit= 244 net=     291 roi=    3.4% hr=  8.6% avgBet=3.0 dd=  441 pos=17/50 gini=0.499 top10=56.3% sp100=33.97` | 1.70 | 2.10 | 0.61 |
| 1.50-1.99 | `sig=  417 bet=   1251 hit=  40 net=     189 roi=   15.1% hr=  9.6% avgBet=3.0 dd=  144 pos= 3/10 gini=0.608 top10=100.0% sp100=22.40` | 1.10 | 1.99 | 0.85 |
| 0.75-0.99 | `sig=  104 bet=    312 hit=   9 net=      12 roi=    3.8% hr=  8.7% avgBet=3.0 dd=   87 pos= 1/1  gini=0.000 top10=100.0% sp100=26.07` | 1.10 | 2.02 | 1.00 |
| 1.00-1.49 | `sig=   11 bet=     33 hit=   0 net=     -33 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   33 pos= 0/2  gini=0.318 top10=100.0% sp100=11.83` | 2.18 | 1.47 | 1.00 |

## history_data.json / By Primary Stability
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 0.70+ | `sig= 1280 bet=   3840 hit= 118 net=     408 roi=   10.6% hr=  9.2% avgBet=3.0 dd=  228 pos=13/34 gini=0.516 top10=74.5% sp100=19.14` | 1.31 | 2.11 | 0.98 |
| 0.45-0.69 | `sig=  939 bet=   2817 hit=  81 net=      99 roi=    3.5% hr=  8.6% avgBet=3.0 dd=  252 pos= 7/18 gini=0.577 top10=93.5% sp100=21.30` | 1.82 | 2.16 | 0.60 |
| <0.45 | `sig= 1144 bet=   3432 hit=  94 net=     -48 roi=   -1.4% hr=  8.2% avgBet=3.0 dd=  483 pos= 9/28 gini=0.504 top10=85.7% sp100=23.75` | 1.76 | 1.98 | 0.34 |

## history_data.json / By Table Numbers
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| <500 | `sig=  493 bet=   1479 hit=  50 net=     321 roi=   21.7% hr= 10.1% avgBet=3.0 dd=  210 pos= 6/17 gini=0.581 top10=95.1% sp100=12.57` | 1.21 | 2.06 | 1.00 |
| 1000-1499 | `sig= 1032 bet=   3096 hit=  93 net=     252 roi=    8.1% hr=  9.0% avgBet=3.0 dd=  300 pos=12/24 gini=0.487 top10=85.8% sp100=29.81` | 1.80 | 2.05 | 0.65 |
| 1500-1999 | `sig=  481 bet=   1443 hit=  44 net=     141 roi=    9.8% hr=  9.1% avgBet=3.0 dd=  198 pos= 6/14 gini=0.468 top10=98.1% sp100=16.81` | 1.53 | 2.13 | 0.47 |
| 2000+ | `sig=  634 bet=   1902 hit=  53 net=       6 roi=    0.3% hr=  8.4% avgBet=3.0 dd=  252 pos= 3/11 gini=0.553 top10=99.7% sp100=23.45` | 1.71 | 1.98 | 0.40 |
| 500-999 | `sig=  723 bet=   2169 hit=  53 net=    -261 roi=  -12.0% hr=  7.3% avgBet=3.0 dd=  495 pos= 3/20 gini=0.539 top10=87.6% sp100=18.44` | 1.56 | 2.20 | 0.78 |

## history_data.json / By Position Bucket
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 200-399 | `sig= 2410 bet=   7230 hit= 219 net=     654 roi=    9.0% hr=  9.1% avgBet=3.0 dd=  534 pos=22/55 gini=0.508 top10=49.0% sp100=27.67` | 1.62 | 2.07 | 0.64 |
| 600-799 | `sig=   90 bet=    270 hit=   9 net=      54 roi=   20.0% hr= 10.0% avgBet=3.0 dd=  132 pos= 1/4  gini=0.583 top10=100.0% sp100=3.93` | 1.18 | 1.72 | 0.57 |
| 800-999 | `sig=   65 bet=    195 hit=   6 net=      21 roi=   10.8% hr=  9.2% avgBet=3.0 dd=   66 pos= 1/1  gini=0.000 top10=100.0% sp100=9.77` | 1.00 | 2.60 | 0.40 |
| 400-599 | `sig=  798 bet=   2394 hit=  59 net=    -270 roi=  -11.3% hr=  7.4% avgBet=3.0 dd=  546 pos= 4/12 gini=0.450 top10=97.0% sp100=15.34` | 1.65 | 2.12 | 0.73 |

## history_data.json / By Venue
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 澳门永利 | `sig= 1065 bet=   3195 hit= 102 net=     477 roi=   14.9% hr=  9.6% avgBet=3.0 dd=  261 pos= 6/11 gini=0.498 top10=99.7% sp100=35.37` | 1.26 | 2.08 | 0.73 |
| 银河 | `sig=   40 bet=    120 hit=   6 net=      96 roi=   80.0% hr= 15.0% avgBet=3.0 dd=   60 pos= 1/1  gini=0.000 top10=100.0% sp100=100.00` | 1.32 | 2.30 | 0.50 |
| 喜来登 | `sig=   87 bet=    261 hit=   8 net=      27 roi=   10.3% hr=  9.2% avgBet=3.0 dd=   93 pos= 1/2  gini=0.100 top10=100.0% sp100=70.16` | 2.24 | 2.75 | 0.49 |
| 威尼斯人 | `sig=    8 bet=     24 hit=   1 net=      12 roi=   50.0% hr= 12.5% avgBet=3.0 dd=   12 pos= 1/1  gini=0.000 top10=100.0% sp100=9.52` | 2.25 | 1.46 | 1.00 |
| unknown | `sig=  285 bet=    855 hit=  24 net=       9 roi=    1.1% hr=  8.4% avgBet=3.0 dd=  189 pos= 3/9  gini=0.308 top10=100.0% sp100=38.31` | 1.99 | 1.89 | 0.56 |
| 巴黎人 | `sig=   69 bet=    207 hit=   5 net=     -27 roi=  -13.0% hr=  7.2% avgBet=3.0 dd=   69 pos= 1/3  gini=0.286 top10=100.0% sp100=42.33` | 1.54 | 2.25 | 0.32 |
| 伦敦人 | `sig=   37 bet=    111 hit=   2 net=     -39 roi=  -35.1% hr=  5.4% avgBet=3.0 dd=   87 pos= 0/3  gini=0.051 top10=100.0% sp100=36.27` | 1.65 | 2.13 | 0.62 |
| wzs | `sig= 1772 bet=   5316 hit= 145 net=     -96 roi=   -1.8% hr=  8.2% avgBet=3.0 dd=  567 pos= 6/25 gini=0.547 top10=81.4% sp100=39.90` | 1.72 | 2.07 | 0.65 |

## history_data.json / Latest 10 Sessions
| # | date | name | spins | summary + SP100 | avg distance | avg recentZ |
|---:|---|---|---:|---:|---:|---:|
| 1 | 2026-06-01 | 20260601-1630-澳门永利 | 108 | `sig=   70 bet=    210 hit=   8 net=      78 roi=   37.1% hr= 11.4% avgBet=3.0 dd=   60 pos= 1/1  gini=0.000 top10=100.0% sp100=64.81` | 2.87 | 1.40 |
| 2 | 2026-06-01 | 20260602-0018-澳门永利 | 167 | `sig=   97 bet=    291 hit=   9 net=      33 roi=   11.3% hr=  9.3% avgBet=3.0 dd=  120 pos= 1/1  gini=0.000 top10=100.0% sp100=58.08` | 0.92 | 2.14 |
| 3 | 2026-06-02 | 20260603-0030-澳门永利 | 609 | `sig=  269 bet=    807 hit=  28 net=     201 roi=   24.9% hr= 10.4% avgBet=3.0 dd=  198 pos= 1/1  gini=0.000 top10=100.0% sp100=44.17` | 0.68 | 2.24 |
| 4 | 2026-06-02 | 20260603-0230-澳门永利 | 77 | `sig=   16 bet=     48 hit=   2 net=      24 roi=   50.0% hr= 12.5% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=20.78` | 1.00 | 1.90 |
| 5 | 2026-06-03 | 20260603-2101-澳门永利 | 399 | `sig=  231 bet=    693 hit=  18 net=     -45 roi=   -6.5% hr=  7.8% avgBet=3.0 dd=  183 pos= 0/1  gini=0.000 top10=100.0% sp100=57.89` | 1.43 | 1.98 |
| 6 | 2026-06-04 | 20260604-1630-澳门永利 | 318 | `sig=   36 bet=    108 hit=   3 net=       0 roi=    0.0% hr=  8.3% avgBet=3.0 dd=   39 pos= 0/1  gini=0.000 top10=100.0% sp100=11.32` | 1.64 | 1.39 |
| 7 | 2026-06-05 | 20260605-0230-澳门永利 | 111 | `sig=    8 bet=     24 hit=   0 net=     -24 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   24 pos= 0/1  gini=0.000 top10=100.0% sp100=7.21` | 1.88 | 1.84 |
| 8 | 2026-06-05 | 20260604-2223-澳门永利 | 53 | `sig=    3 bet=      9 hit=   0 net=      -9 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    9 pos= 0/1  gini=0.000 top10=100.0% sp100=5.66` | 2.00 | 1.56 |
| 9 | 2026-06-10 | 20260606-0131-澳门永利 | 556 | `sig=  155 bet=    465 hit=  16 net=     111 roi=   23.9% hr= 10.3% avgBet=3.0 dd=   99 pos= 1/1  gini=0.000 top10=100.0% sp100=27.88` | 0.79 | 2.49 |
| 10 | 2026-06-10 | 20260607-0217-澳门永利 | 561 | `sig=  169 bet=    507 hit=  18 net=     141 roi=   27.8% hr= 10.7% avgBet=3.0 dd=  147 pos= 1/1  gini=0.000 top10=100.0% sp100=30.12` | 1.84 | 2.09 |

## history_data.json / Latest 10 By Distance
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 0 | `sig=  313 bet=    939 hit=  35 net=     321 roi=   34.2% hr= 11.2% avgBet=3.0 dd=  123 pos= 4/7  gini=0.624 top10=100.0% sp100=12.76` | 0.00 | 2.41 | 0.82 |
| 1 | `sig=  352 bet=   1056 hit=  37 net=     276 roi=   26.1% hr= 10.5% avgBet=3.0 dd=  174 pos= 4/9  gini=0.576 top10=100.0% sp100=12.11` | 1.00 | 1.93 | 0.75 |
| 2 | `sig=  187 bet=    561 hit=  18 net=      87 roi=   15.5% hr=  9.6% avgBet=3.0 dd=  126 pos= 4/7  gini=0.449 top10=100.0% sp100=6.87` | 2.00 | 2.14 | 0.72 |
| 3 | `sig=  202 bet=    606 hit=  12 net=    -174 roi=  -28.7% hr=  5.9% avgBet=3.0 dd=  369 pos= 1/7  gini=0.530 top10=100.0% sp100=8.23` | 3.00 | 1.86 | 0.59 |

## history_data.json / Top Winning Sessions
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2026-05-11 / wzs-2026-05-11-803 | `sig=  123 bet=    369 hit=  18 net=     279 roi=   75.6% hr= 14.6% avgBet=3.0 dd=   75 pos= 1/1  gini=0.000 top10=100.0% sp100=43.77` | 1.30 | 2.92 | 0.89 |
| 2026-06-02 / 20260603-0030-澳门永利 | `sig=  269 bet=    807 hit=  28 net=     201 roi=   24.9% hr= 10.4% avgBet=3.0 dd=  198 pos= 1/1  gini=0.000 top10=100.0% sp100=44.17` | 0.68 | 2.24 | 0.98 |
| 2026-06-10 / 20260607-0217-澳门永利 | `sig=  169 bet=    507 hit=  18 net=     141 roi=   27.8% hr= 10.7% avgBet=3.0 dd=  147 pos= 1/1  gini=0.000 top10=100.0% sp100=30.12` | 1.84 | 2.09 | 0.67 |
| 2026-05-11 / wzs-2026-05-11-807 | `sig=   94 bet=    282 hit=  11 net=     114 roi=   40.4% hr= 11.7% avgBet=3.0 dd=   63 pos= 1/1  gini=0.000 top10=100.0% sp100=71.21` | 2.89 | 1.81 | 0.67 |
| 2026-06-10 / 20260606-0131-澳门永利 | `sig=  155 bet=    465 hit=  16 net=     111 roi=   23.9% hr= 10.3% avgBet=3.0 dd=   99 pos= 1/1  gini=0.000 top10=100.0% sp100=27.88` | 0.79 | 2.49 | 0.70 |
| 2021-04-23 / wzs-2021-04-23-063 | `sig=  100 bet=    300 hit=  11 net=      96 roi=   32.0% hr= 11.0% avgBet=3.0 dd=   93 pos= 1/1  gini=0.000 top10=100.0% sp100=24.21` | 3.00 | 2.03 | 1.00 |
| 2023-06-08 / 20230608-1548 | `sig=   52 bet=    156 hit=   7 net=      96 roi=   61.5% hr= 13.5% avgBet=3.0 dd=   39 pos= 1/1  gini=0.000 top10=100.0% sp100=41.27` | 2.67 | 2.54 | 0.75 |
| 2026-01-13 / 20260113-晚上-银河 | `sig=   40 bet=    120 hit=   6 net=      96 roi=   80.0% hr= 15.0% avgBet=3.0 dd=   60 pos= 1/1  gini=0.000 top10=100.0% sp100=100.00` | 1.32 | 2.30 | 0.50 |
| 2021-04-23 / wzs-2021-04-23-066 | `sig=   55 bet=    165 hit=   7 net=      87 roi=   52.7% hr= 12.7% avgBet=3.0 dd=   99 pos= 1/1  gini=0.000 top10=100.0% sp100=46.61` | 0.40 | 1.78 | 1.00 |
| 2025-11-03 / 20251103-下午-喜来登 | `sig=   21 bet=     63 hit=   4 net=      81 roi=  128.6% hr= 19.0% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0% sp100=80.77` | 3.00 | 2.06 | 1.00 |
| 2026-06-01 / 20260601-1630-澳门永利 | `sig=   70 bet=    210 hit=   8 net=      78 roi=   37.1% hr= 11.4% avgBet=3.0 dd=   60 pos= 1/1  gini=0.000 top10=100.0% sp100=64.81` | 2.87 | 1.40 | 0.44 |
| 2021-06-17 / 20210617-1819 | `sig=   15 bet=     45 hit=   3 net=      63 roi=  140.0% hr= 20.0% avgBet=3.0 dd=   18 pos= 1/1  gini=0.000 top10=100.0% sp100=93.75` | 2.67 | 1.47 | 0.20 |
| 2021-06-19 / 20210620-0003 | `sig=   23 bet=     69 hit=   3 net=      39 roi=   56.5% hr= 13.0% avgBet=3.0 dd=   39 pos= 1/1  gini=0.000 top10=100.0% sp100=26.44` | 2.00 | 2.80 | 1.00 |
| 2026-01-01 / wzs-2026-01-01-003 | `sig=    1 bet=      3 hit=   1 net=      33 roi= 1100.0% hr=100.0% avgBet=3.0 dd=    0 pos= 1/1  gini=0.000 top10=100.0% sp100=3.85` | 3.00 | 1.96 | 0.40 |
| 2026-06-01 / 20260602-0018-澳门永利 | `sig=   97 bet=    291 hit=   9 net=      33 roi=   11.3% hr=  9.3% avgBet=3.0 dd=  120 pos= 1/1  gini=0.000 top10=100.0% sp100=58.08` | 0.92 | 2.14 | 0.35 |

## history_data.json / Worst Losing Sessions
| key | summary + SP100 | avg distance | avg recentZ | avg stability |
|---|---:|---:|---:|---:|
| 2026-04-06 / wzs-2026-04-06-703 | `sig=   65 bet=    195 hit=   2 net=    -123 roi=  -63.1% hr=  3.1% avgBet=3.0 dd=  144 pos= 0/1  gini=0.000 top10=100.0% sp100=84.42` | 1.68 | 2.75 | 0.67 |
| 2026-05-11 / wzs-2026-05-11-808 | `sig=  165 bet=    495 hit=  11 net=     -99 roi=  -20.0% hr=  6.7% avgBet=3.0 dd=  126 pos= 0/1  gini=0.000 top10=100.0% sp100=45.08` | 1.67 | 1.98 | 0.49 |
| 2026-04-06 / wzs-2026-04-06-701 | `sig=   32 bet=     96 hit=   0 net=     -96 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   96 pos= 0/1  gini=0.000 top10=100.0% sp100=88.89` | 1.56 | 1.95 | 0.62 |
| 2026-05-11 / wzs-2026-05-11-806 | `sig=   42 bet=    126 hit=   1 net=     -90 roi=  -71.4% hr=  2.4% avgBet=3.0 dd=  120 pos= 0/1  gini=0.000 top10=100.0% sp100=14.05` | 1.90 | 2.60 | 0.57 |
| 2025-01-13 / wzs-2025-01-13-302 | `sig=   27 bet=     81 hit=   0 net=     -81 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   81 pos= 0/1  gini=0.000 top10=100.0% sp100=65.85` | 1.00 | 1.31 | 0.25 |
| 2021-06-18 / 20210618-1633 | `sig=   44 bet=    132 hit=   2 net=     -60 roi=  -45.5% hr=  4.5% avgBet=3.0 dd=   84 pos= 0/1  gini=0.000 top10=100.0% sp100=83.02` | 1.00 | 1.90 | 0.20 |
| 2025-12-02 / 20251202-晚上-喜来登 | `sig=   66 bet=    198 hit=   4 net=     -54 roi=  -27.3% hr=  6.1% avgBet=3.0 dd=   93 pos= 0/1  gini=0.000 top10=100.0% sp100=67.35` | 2.00 | 2.97 | 0.33 |
| 2026-05-11 / wzs-2026-05-11-810 | `sig=  147 bet=    441 hit=  11 net=     -45 roi=  -10.2% hr=  7.5% avgBet=3.0 dd=  123 pos= 0/1  gini=0.000 top10=100.0% sp100=31.82` | 1.29 | 1.92 | 0.62 |
| 2026-06-03 / 20260603-2101-澳门永利 | `sig=  231 bet=    693 hit=  18 net=     -45 roi=   -6.5% hr=  7.8% avgBet=3.0 dd=  183 pos= 0/1  gini=0.000 top10=100.0% sp100=57.89` | 1.43 | 1.98 | 0.73 |
| 2023-06-07 / 20230607-2252 | `sig=   72 bet=    216 hit=   5 net=     -36 roi=  -16.7% hr=  6.9% avgBet=3.0 dd=   63 pos= 0/1  gini=0.000 top10=100.0% sp100=26.47` | 2.42 | 1.44 | 0.33 |
| 2023-10-24 / 20231024-晚上-巴黎人 | `sig=   48 bet=    144 hit=   3 net=     -36 roi=  -25.0% hr=  6.3% avgBet=3.0 dd=   54 pos= 0/1  gini=0.000 top10=100.0% sp100=87.27` | 0.94 | 2.35 | 0.27 |
| 2026-04-09 / 20260409-夜-澳门永利 | `sig=   11 bet=     33 hit=   0 net=     -33 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   33 pos= 0/1  gini=0.000 top10=100.0% sp100=21.15` | 1.09 | 1.29 | 0.75 |
| 2026-05-11 / wzs-2026-05-11-804 | `sig=   11 bet=     33 hit=   0 net=     -33 roi= -100.0% hr=  0.0% avgBet=3.0 dd=   33 pos= 0/1  gini=0.000 top10=100.0% sp100=5.09` | 1.18 | 2.29 | 0.92 |
| 2021-06-20 / 20210620-2329 | `sig=   34 bet=    102 hit=   2 net=     -30 roi=  -29.4% hr=  5.9% avgBet=3.0 dd=   42 pos= 0/1  gini=0.000 top10=100.0% sp100=38.64` | 3.00 | 1.70 | 0.50 |
| 2023-06-05 / 20230605-2221 | `sig=   34 bet=    102 hit=   2 net=     -30 roi=  -29.4% hr=  5.9% avgBet=3.0 dd=   90 pos= 0/1  gini=0.000 top10=100.0% sp100=100.00` | 0.00 | 1.71 | 1.00 |
