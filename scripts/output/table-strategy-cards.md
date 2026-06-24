# Table Strategy Cards

Research goal: describe each auto table/regime, classify table types, then test fixed strategy families by table type in strict walk-forward.

Descriptive final cards are for interpretation only. Betting summaries are walk-forward: prior sessions only build the table card; current spin uses prefix only.

## Dataset: data_2026.6.11.json
- sessions: 133
- spins: 33597
- final descriptive cards: 36
- walk-forward strategy events: 19767
- no-future: strategy events only use prior sessions for table cards and current prefix for live features.

### Final Descriptive Table Cards
| table | card |
|---|---|
| 自动画像2 (auto_02) | single-core; sessions=12; nums=3743; top=15(z=4.3), 16(z=0.5), 27(z=-1.3); stability=0.71; gapZ=3.80; offset=15 lift=1.19 |
| 自动画像5 (auto_05) | single-core; sessions=9; nums=3353; top=8(z=4.3), 19(z=0.3), 12(z=-0.3); stability=0.54; gapZ=3.97; offset=32 lift=1.24 |
| 自动画像1 (auto_01) | mixed-core; sessions=11; nums=2942; top=7(z=3.6), 33(z=0.0), 32(z=-0.2); stability=0.36; gapZ=3.62; offset=24 lift=1.39 |
| 自动画像50 (auto_50) | mixed-core; sessions=5; nums=2250; top=19(z=3.1), 8(z=0.7), 1(z=-0.4); stability=0.40; gapZ=2.48; offset=23 lift=1.19 |
| 自动画像52 (auto_52) | single-core; sessions=4; nums=1972; top=1(z=1.8), 8(z=1.0), 4(z=0.7); stability=0.50; gapZ=0.80; offset=10 lift=1.28 |
| 自动画像7 (auto_07) | single-core; sessions=7; nums=1706; top=34(z=4.2), 7(z=0.1), 16(z=-0.4); stability=0.75; gapZ=4.08; offset=25 lift=1.38 |
| 自动画像6 (auto_06) | single-core; sessions=6; nums=1564; top=1(z=3.8), 12(z=1.2), 21(z=0.1); stability=0.57; gapZ=2.58; offset=21 lift=1.33 |
| 自动画像51 (auto_51) | single-core; sessions=4; nums=1470; top=28(z=2.8), 16(z=0.9), 36(z=0.4); stability=1.00; gapZ=1.93; offset=1 lift=1.32 |
| 自动画像38 (auto_38) | single-core; sessions=4; nums=1215; top=8(z=3.5), 20(z=1.4), 28(z=0.2); stability=0.80; gapZ=2.05; offset=35 lift=1.43 |
| 自动画像29 (auto_29) | multi-core; sessions=3; nums=1122; top=8(z=2.6), 34(z=2.5), 1(z=-0.5); stability=0.33; gapZ=0.08; offset=29 lift=1.45 |
| 自动画像33 (auto_33) | mixed-core; sessions=3; nums=965; top=31(z=2.5), 5(z=1.3), 35(z=0.6); stability=0.33; gapZ=1.23; offset=9 lift=1.38 |
| 自动画像43 (auto_43) | small-sample; sessions=2; nums=725; top=12(z=2.5), 5(z=1.4), 6(z=1.0); stability=0.50; gapZ=1.14; offset=15 lift=1.64 |
| 自动画像32 (auto_32) | mixed-core; sessions=3; nums=649; top=17(z=2.9), 32(z=0.4), 33(z=0.3); stability=0.00; gapZ=2.51; offset=27 lift=1.48 |
| 自动画像28 (auto_28) | small-sample; sessions=2; nums=623; top=35(z=2.8), 10(z=1.2), 34(z=-0.7); stability=1.00; gapZ=1.53; offset=24 lift=1.43 |
| 自动画像45 (auto_45) | small-sample; sessions=2; nums=575; top=30(z=2.0), 15(z=1.7), 31(z=1.0); stability=0.50; gapZ=0.32; offset=34 lift=1.81 |
| 自动画像41 (auto_41) | small-sample; sessions=2; nums=557; top=33(z=1.9), 27(z=0.8), 15(z=0.5); stability=0.33; gapZ=1.08; offset=3 lift=1.37 |
| 自动画像48 (auto_48) | small-sample; sessions=2; nums=552; top=22(z=1.1), 26(z=1.1), 10(z=0.3); stability=0.00; gapZ=0.00; offset=29 lift=1.61 |
| 自动画像34 (auto_34) | small-sample; sessions=2; nums=425; top=6(z=1.6), 35(z=1.3), 1(z=1.2); stability=0.50; gapZ=0.25; offset=29 lift=1.66 |
| 自动画像46 (auto_46) | small-sample; sessions=2; nums=425; top=22(z=2.9), 11(z=0.9), 32(z=0.4); stability=1.00; gapZ=1.98; offset=11 lift=1.92 |
| 自动画像21 (auto_21) | small-sample; sessions=1; nums=371; top=28(z=2.1), 17(z=1.2), 14(z=0.1); stability=1.00; gapZ=0.93; offset=5 lift=1.60 |

### Walk-Forward By Strategy
| key | summary |
|---|---:|
| intersection160-zone | `sig=  588 bet=   4116 hit= 127 net=     456 roi=   11.1% hr= 21.6% avgBet=7.0 dd=  373 pos=12/22 gini=0.557 top10=87.6%` |
| stable-exact160-recent3 | `sig=  382 bet=   1146 hit=  39 net=     258 roi=   22.5% hr= 10.2% avgBet=3.0 dd=  159 pos= 3/16 gini=0.705 top10=96.9%` |
| core-cold120-profile5 | `sig=  863 bet=   4315 hit= 127 net=     257 roi=    6.0% hr= 14.7% avgBet=5.0 dd=  237 pos=17/35 gini=0.475 top10=72.8%` |
| single-exact60-recent5 | `sig=  217 bet=   1085 hit=  37 net=     247 roi=   22.8% hr= 17.1% avgBet=5.0 dd=  128 pos=13/27 gini=0.576 top10=75.1%` |
| core-cold80-profile5 | `sig= 1139 bet=   5695 hit= 165 net=     245 roi=    4.3% hr= 14.5% avgBet=5.0 dd=  360 pos=22/43 gini=0.408 top10=64.4%` |
| single-near120-recent3 | `sig=  584 bet=   1752 hit=  53 net=     156 roi=    8.9% hr=  9.1% avgBet=3.0 dd=  120 pos=14/26 gini=0.491 top10=74.7%` |
| offset-top1 | `sig= 6637 bet=   6637 hit= 184 net=     -13 roi=   -0.2% hr=  2.8% avgBet=1.0 dd=  463 pos=34/69 gini=0.470 top10=49.6%` |
| multi-follow120-recent3 | `sig=  713 bet=   2139 hit=  58 net=     -51 roi=   -2.4% hr=  8.1% avgBet=3.0 dd=  207 pos= 8/22 gini=0.517 top10=83.2%` |
| multi-follow120-recent5 | `sig=  532 bet=   2660 hit=  71 net=    -104 roi=   -3.9% hr= 13.3% avgBet=5.0 dd=  252 pos= 8/20 gini=0.432 top10=85.0%` |
| single-exact120-recent3 | `sig=  113 bet=    339 hit=   5 net=    -159 roi=  -46.9% hr=  4.4% avgBet=3.0 dd=  204 pos= 2/8  gini=0.542 top10=100.0%` |
| offset-top3 | `sig= 7999 bet=  22339 hit= 614 net=    -235 roi=   -1.1% hr=  7.7% avgBet=2.8 dd= 1039 pos=31/72 gini=0.462 top10=47.0%` |

### Walk-Forward By Table Type
| key | summary |
|---|---:|
| small-sample | `sig= 2908 bet=   8316 hit= 275 net=    1584 roi=   19.0% hr=  9.5% avgBet=2.9 dd=  292 pos=17/27 gini=0.632 top10=89.6%` |
| single-core | `sig= 8063 bet=  19934 hit= 569 net=     550 roi=    2.8% hr=  7.1% avgBet=2.5 dd= 1016 pos=18/41 gini=0.491 top10=77.7%` |
| multi-core | `sig= 2736 bet=   7522 hit= 206 net=    -106 roi=   -1.4% hr=  7.5% avgBet=2.7 dd=  539 pos= 5/16 gini=0.512 top10=94.0%` |
| mixed-core | `sig= 6060 bet=  16451 hit= 430 net=    -971 roi=   -5.9% hr=  7.1% avgBet=2.7 dd= 1118 pos=15/40 gini=0.497 top10=64.5%` |

### Walk-Forward By Table Type + Strategy
| key | summary |
|---|---:|
| small-sample / intersection160-zone | `sig=  370 bet=   2590 hit=  86 net=     506 roi=   19.5% hr= 23.2% avgBet=7.0 dd=  106 pos= 6/13 gini=0.679 top10=98.4%` |
| small-sample / offset-top1 | `sig= 1058 bet=   1058 hit=  39 net=     346 roi=   32.7% hr=  3.7% avgBet=1.0 dd=  105 pos=11/17 gini=0.427 top10=92.9%` |
| single-core / offset-top3 | `sig= 3533 bet=   9706 hit= 279 net=     338 roi=    3.5% hr=  7.9% avgBet=2.7 dd=  771 pos=19/41 gini=0.466 top10=75.5%` |
| mixed-core / core-cold80-profile5 | `sig=  377 bet=   1885 hit=  61 net=     311 roi=   16.5% hr= 16.2% avgBet=5.0 dd=  148 pos=14/24 gini=0.360 top10=75.3%` |
| small-sample / stable-exact160-recent3 | `sig=  308 bet=    924 hit=  33 net=     264 roi=   28.6% hr= 10.7% avgBet=3.0 dd=  114 pos= 2/12 gini=0.724 top10=99.0%` |
| small-sample / single-exact60-recent5 | `sig=  114 bet=    570 hit=  23 net=     258 roi=   45.3% hr= 20.2% avgBet=5.0 dd=   65 pos= 7/13 gini=0.664 top10=97.4%` |
| small-sample / offset-top3 | `sig= 1058 bet=   3174 hit=  94 net=     210 roi=    6.6% hr=  8.9% avgBet=3.0 dd=  264 pos= 8/17 gini=0.389 top10=92.9%` |
| mixed-core / core-cold120-profile5 | `sig=  254 bet=   1270 hit=  41 net=     206 roi=   16.2% hr= 16.1% avgBet=5.0 dd=  116 pos= 9/19 gini=0.484 top10=88.2%` |
| single-core / single-near120-recent3 | `sig=  395 bet=   1185 hit=  38 net=     183 roi=   15.4% hr=  9.6% avgBet=3.0 dd=   96 pos=11/17 gini=0.447 top10=89.4%` |
| multi-core / offset-top3 | `sig= 1189 bet=   3063 hit=  89 net=     141 roi=    4.6% hr=  7.5% avgBet=2.6 dd=  282 pos= 7/16 gini=0.461 top10=95.0%` |
| multi-core / offset-top1 | `sig=  734 bet=    734 hit=  24 net=     130 roi=   17.7% hr=  3.3% avgBet=1.0 dd=  122 pos= 6/13 gini=0.529 top10=98.8%` |
| single-core / core-cold120-profile5 | `sig=  457 bet=   2285 hit=  67 net=     127 roi=    5.6% hr= 14.7% avgBet=5.0 dd=  192 pos= 9/16 gini=0.454 top10=94.7%` |
| mixed-core / multi-follow120-recent5 | `sig=  376 bet=   1880 hit=  55 net=     100 roi=    5.3% hr= 14.6% avgBet=5.0 dd=  189 pos= 7/15 gini=0.403 top10=91.8%` |
| single-core / intersection160-zone | `sig=   74 bet=    518 hit=  16 net=      58 roi=   11.2% hr= 21.6% avgBet=7.0 dd=  119 pos= 2/5  gini=0.400 top10=100.0%` |
| multi-core / multi-follow120-recent3 | `sig=  238 bet=    714 hit=  21 net=      42 roi=    5.9% hr=  8.8% avgBet=3.0 dd=  174 pos= 4/9  gini=0.539 top10=100.0%` |
| mixed-core / single-exact60-recent5 | `sig=   64 bet=    320 hit=  10 net=      40 roi=   12.5% hr= 15.6% avgBet=5.0 dd=  104 pos= 4/8  gini=0.315 top10=100.0%` |
| single-core / stable-exact160-recent3 | `sig=   74 bet=    222 hit=   6 net=      -6 roi=   -2.7% hr=  8.1% avgBet=3.0 dd=   96 pos= 1/5  gini=0.520 top10=100.0%` |
| single-core / core-cold80-profile5 | `sig=  563 bet=   2815 hit=  78 net=      -7 roi=   -0.2% hr= 13.9% avgBet=5.0 dd=  263 pos= 6/17 gini=0.432 top10=94.3%` |
| single-core / offset-top1 | `sig= 2888 bet=   2888 hit=  80 net=      -8 roi=   -0.3% hr=  2.8% avgBet=1.0 dd=  341 pos=15/38 gini=0.508 top10=77.6%` |
| mixed-core / single-near120-recent3 | `sig=  189 bet=    567 hit=  15 net=     -27 roi=   -4.8% hr=  7.9% avgBet=3.0 dd=  126 pos= 4/10 gini=0.518 top10=100.0%` |
| mixed-core / intersection160-zone | `sig=   76 bet=    532 hit=  14 net=     -28 roi=   -5.3% hr= 18.4% avgBet=7.0 dd=  131 pos= 3/5  gini=0.331 top10=100.0%` |
| single-core / single-exact60-recent5 | `sig=   39 bet=    195 hit=   4 net=     -51 roi=  -26.2% hr= 10.3% avgBet=5.0 dd=   60 pos= 3/9  gini=0.261 top10=100.0%` |
| multi-core / core-cold80-profile5 | `sig=  199 bet=    995 hit=  26 net=     -59 roi=   -5.9% hr= 13.1% avgBet=5.0 dd=  208 pos= 3/8  gini=0.404 top10=100.0%` |
| mixed-core / single-exact120-recent3 | `sig=   73 bet=    219 hit=   4 net=     -75 roi=  -34.2% hr=  5.5% avgBet=3.0 dd=  126 pos= 2/3  gini=0.440 top10=100.0%` |
| multi-core / core-cold120-profile5 | `sig=  152 bet=    760 hit=  19 net=     -76 roi=  -10.0% hr= 12.5% avgBet=5.0 dd=  168 pos= 3/7  gini=0.369 top10=100.0%` |
| multi-core / intersection160-zone | `sig=   68 bet=    476 hit=  11 net=     -80 roi=  -16.8% hr= 16.2% avgBet=7.0 dd=  165 pos= 1/5  gini=0.429 top10=100.0%` |
| single-core / single-exact120-recent3 | `sig=   40 bet=    120 hit=   1 net=     -84 roi=  -70.0% hr=  2.5% avgBet=3.0 dd=  105 pos= 0/5  gini=0.457 top10=100.0%` |
| mixed-core / multi-follow120-recent3 | `sig=  475 bet=   1425 hit=  37 net=     -93 roi=   -6.5% hr=  7.8% avgBet=3.0 dd=  180 pos= 4/16 gini=0.520 top10=90.3%` |
| multi-core / multi-follow120-recent5 | `sig=  156 bet=    780 hit=  16 net=    -204 roi=  -26.2% hr= 10.3% avgBet=5.0 dd=  325 pos= 2/7  gini=0.489 top10=100.0%` |
| mixed-core / offset-top1 | `sig= 1957 bet=   1957 hit=  41 net=    -481 roi=  -24.6% hr=  2.1% avgBet=1.0 dd=  535 pos=13/37 gini=0.515 top10=66.0%` |
| mixed-core / offset-top3 | `sig= 2219 bet=   6396 hit= 152 net=    -924 roi=  -14.4% hr=  6.8% avgBet=2.9 dd=  975 pos=13/40 gini=0.498 top10=65.0%` |

### Walk-Forward By Evolving Table Card + Strategy
| key | summary |
|---|---:|
| auto_50 / small-sample / intersection160-zone | `sig=  189 bet=   1323 hit=  48 net=     405 roi=   30.6% hr= 25.4% avgBet=7.0 dd=   84 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_50 / small-sample / stable-exact160-recent3 | `sig=  189 bet=    567 hit=  25 net=     333 roi=   58.7% hr= 13.2% avgBet=3.0 dd=   93 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_19 / multi-core / offset-top3 | `sig=  261 bet=    783 hit=  31 net=     333 roi=   42.5% hr= 11.9% avgBet=3.0 dd=  156 pos= 4/5  gini=0.499 top10=100.0%` |
| auto_05 / single-core / offset-top3 | `sig= 1108 bet=   3324 hit=  99 net=     240 roi=    7.2% hr=  8.9% avgBet=3.0 dd=  216 pos= 9/19 gini=0.507 top10=93.3%` |
| auto_50 / small-sample / single-exact60-recent5 | `sig=   59 bet=    295 hit=  14 net=     209 roi=   70.8% hr= 23.7% avgBet=5.0 dd=   65 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_01 / mixed-core / core-cold80-profile5 | `sig=  103 bet=    515 hit=  20 net=     205 roi=   39.8% hr= 19.4% avgBet=5.0 dd=  119 pos= 7/10 gini=0.413 top10=100.0%` |
| auto_05 / single-core / single-near120-recent3 | `sig=  188 bet=    564 hit=  21 net=     192 roi=   34.0% hr= 11.2% avgBet=3.0 dd=   69 pos= 5/7  gini=0.402 top10=100.0%` |
| auto_01 / single-core / offset-top3 | `sig=   27 bet=     81 hit=   7 net=     171 roi=  211.1% hr= 25.9% avgBet=3.0 dd=   24 pos= 2/3  gini=0.497 top10=100.0%` |
| auto_19 / multi-core / offset-top1 | `sig=  261 bet=    261 hit=  12 net=     171 roi=   65.5% hr=  4.6% avgBet=1.0 dd=   53 pos= 3/5  gini=0.597 top10=100.0%` |
| auto_02 / mixed-core / multi-follow120-recent5 | `sig=  113 bet=    565 hit=  20 net=     155 roi=   27.4% hr= 17.7% avgBet=5.0 dd=  113 pos= 2/3  gini=0.285 top10=100.0%` |
| auto_38 / small-sample / offset-top3 | `sig=   39 bet=    117 hit=   7 net=     135 roi=  115.4% hr= 17.9% avgBet=3.0 dd=   39 pos= 2/2  gini=0.322 top10=100.0%` |
| auto_53 / small-sample / intersection160-zone | `sig=   48 bet=    336 hit=  13 net=     132 roi=   39.3% hr= 27.1% avgBet=7.0 dd=   49 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_02 / single-core / offset-top1 | `sig=  199 bet=    199 hit=   9 net=     125 roi=   62.8% hr=  4.5% avgBet=1.0 dd=   78 pos= 5/7  gini=0.392 top10=100.0%` |
| auto_02 / mixed-core / multi-follow120-recent3 | `sig=  116 bet=    348 hit=  13 net=     120 roi=   34.5% hr= 11.2% avgBet=3.0 dd=  126 pos= 1/3  gini=0.525 top10=100.0%` |
| auto_02 / small-sample / offset-top3 | `sig=  107 bet=    321 hit=  12 net=     111 roi=   34.6% hr= 11.2% avgBet=3.0 dd=   90 pos= 2/2  gini=0.014 top10=100.0%` |
| auto_02 / mixed-core / core-cold80-profile5 | `sig=  101 bet=    505 hit=  17 net=     107 roi=   21.2% hr= 16.8% avgBet=5.0 dd=   88 pos= 4/6  gini=0.209 top10=100.0%` |
| auto_38 / small-sample / offset-top1 | `sig=   39 bet=     39 hit=   4 net=     105 roi=  269.2% hr= 10.3% avgBet=1.0 dd=   18 pos= 2/2  gini=0.310 top10=100.0%` |
| auto_50 / single-core / offset-top3 | `sig=  410 bet=   1230 hit=  37 net=     102 roi=    8.3% hr=  9.0% avgBet=3.0 dd=  270 pos= 2/3  gini=0.386 top10=100.0%` |
| auto_06 / single-core / single-near120-recent3 | `sig=   51 bet=    153 hit=   7 net=      99 roi=   64.7% hr= 13.7% avgBet=3.0 dd=   33 pos= 4/5  gini=0.351 top10=100.0%` |
| auto_05 / mixed-core / core-cold120-profile5 | `sig=   74 bet=    370 hit=  13 net=      98 roi=   26.5% hr= 17.6% avgBet=5.0 dd=   82 pos= 1/3  gini=0.600 top10=100.0%` |
| auto_17 / small-sample / offset-top3 | `sig=   76 bet=    228 hit=   9 net=      96 roi=   42.1% hr= 11.8% avgBet=3.0 dd=   72 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_01 / multi-core / multi-follow120-recent3 | `sig=  125 bet=    375 hit=  13 net=      93 roi=   24.8% hr= 10.4% avgBet=3.0 dd=  120 pos= 2/2  gini=0.468 top10=100.0%` |
| auto_06 / single-core / core-cold80-profile5 | `sig=   40 bet=    200 hit=   8 net=      88 roi=   44.0% hr= 20.0% avgBet=5.0 dd=   35 pos= 1/2  gini=0.407 top10=100.0%` |
| auto_38 / single-core / offset-top3 | `sig=   21 bet=     63 hit=   4 net=      81 roi=  128.6% hr= 19.0% avgBet=3.0 dd=   24 pos= 2/2  gini=0.278 top10=100.0%` |
| auto_28 / small-sample / offset-top1 | `sig=  140 bet=    140 hit=   6 net=      76 roi=   54.3% hr=  4.3% avgBet=1.0 dd=   39 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_06 / multi-core / core-cold120-profile5 | `sig=   21 bet=    105 hit=   5 net=      75 roi=   71.4% hr= 23.8% avgBet=5.0 dd=   50 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_06 / mixed-core / multi-follow120-recent5 | `sig=   93 bet=    465 hit=  15 net=      75 roi=   16.1% hr= 16.1% avgBet=5.0 dd=   69 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_07 / mixed-core / multi-follow120-recent5 | `sig=   50 bet=    250 hit=   9 net=      74 roi=   29.6% hr= 18.0% avgBet=5.0 dd=   60 pos= 2/2  gini=0.068 top10=100.0%` |
| auto_21 / small-sample / offset-top3 | `sig=   96 bet=    288 hit=  10 net=      72 roi=   25.0% hr= 10.4% avgBet=3.0 dd=   57 pos= 1/2  gini=0.400 top10=100.0%` |
| auto_07 / mixed-core / single-near120-recent3 | `sig=   50 bet=    150 hit=   6 net=      66 roi=   44.0% hr= 12.0% avgBet=3.0 dd=   48 pos= 2/2  gini=0.318 top10=100.0%` |
| auto_37 / single-core / core-cold80-profile5 | `sig=   59 bet=    295 hit=  10 net=      65 roi=   22.0% hr= 16.9% avgBet=5.0 dd=   58 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_19 / small-sample / offset-top3 | `sig=    3 bet=      9 hit=   2 net=      63 roi=  700.0% hr= 66.7% avgBet=3.0 dd=    3 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_05 / single-core / core-cold120-profile5 | `sig=  189 bet=    945 hit=  28 net=      63 roi=    6.7% hr= 14.8% avgBet=5.0 dd=  130 pos= 4/7  gini=0.495 top10=100.0%` |
| auto_45 / multi-core / intersection160-zone | `sig=   22 bet=    154 hit=   6 net=      62 roi=   40.3% hr= 27.3% avgBet=7.0 dd=   63 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_19 / multi-core / core-cold80-profile5 | `sig=   10 bet=     50 hit=   3 net=      58 roi=  116.0% hr= 30.0% avgBet=5.0 dd=   15 pos= 2/2  gini=0.224 top10=100.0%` |
| auto_06 / single-core / stable-exact160-recent3 | `sig=    5 bet=     15 hit=   2 net=      57 roi=  380.0% hr= 40.0% avgBet=3.0 dd=    3 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_37 / single-core / offset-top1 | `sig=  375 bet=    375 hit=  12 net=      57 roi=   15.2% hr=  3.2% avgBet=1.0 dd=  122 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_48 / small-sample / offset-top1 | `sig=   18 bet=     18 hit=   2 net=      54 roi=  300.0% hr= 11.1% avgBet=1.0 dd=   10 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_50 / single-core / single-near120-recent3 | `sig=   30 bet=     90 hit=   4 net=      54 roi=   60.0% hr= 13.3% avgBet=3.0 dd=   27 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_07 / mixed-core / core-cold80-profile5 | `sig=   40 bet=    200 hit=   7 net=      52 roi=   26.0% hr= 17.5% avgBet=5.0 dd=   69 pos= 2/4  gini=0.434 top10=100.0%` |

### Latest 10 By Strategy
| key | summary |
|---|---:|
| intersection160-zone | `sig=  365 bet=   2555 hit=  84 net=     469 roi=   18.4% hr= 23.0% avgBet=7.0 dd=  141 pos= 3/7  gini=0.599 top10=100.0%` |
| stable-exact160-recent3 | `sig=  290 bet=    870 hit=  32 net=     282 roi=   32.4% hr= 11.0% avgBet=3.0 dd=  123 pos= 1/7  gini=0.740 top10=100.0%` |
| single-exact60-recent5 | `sig=  108 bet=    540 hit=  20 net=     180 roi=   33.3% hr= 18.5% avgBet=5.0 dd=   75 pos= 4/7  gini=0.654 top10=100.0%` |
| core-cold80-profile5 | `sig=  190 bet=    950 hit=  29 net=      94 roi=    9.9% hr= 15.3% avgBet=5.0 dd=  186 pos= 3/6  gini=0.413 top10=100.0%` |
| core-cold120-profile5 | `sig=  177 bet=    885 hit=  25 net=      15 roi=    1.7% hr= 14.1% avgBet=5.0 dd=   93 pos= 2/5  gini=0.249 top10=100.0%` |
| single-exact120-recent3 | `sig=    1 bet=      3 hit=   0 net=      -3 roi= -100.0% hr=  0.0% avgBet=3.0 dd=    3 pos= 0/1  gini=0.000 top10=100.0%` |
| single-near120-recent3 | `sig=   87 bet=    261 hit=   6 net=     -45 roi=  -17.2% hr=  6.9% avgBet=3.0 dd=   90 pos= 1/3  gini=0.385 top10=100.0%` |
| multi-follow120-recent3 | `sig=   64 bet=    192 hit=   3 net=     -84 roi=  -43.8% hr=  4.7% avgBet=3.0 dd=  135 pos= 1/3  gini=0.556 top10=100.0%` |
| multi-follow120-recent5 | `sig=   44 bet=    220 hit=   1 net=    -184 roi=  -83.6% hr=  2.3% avgBet=5.0 dd=  215 pos= 0/3  gini=0.203 top10=100.0%` |
| offset-top1 | `sig= 1574 bet=   1574 hit=  37 net=    -242 roi=  -15.4% hr=  2.4% avgBet=1.0 dd=  347 pos= 2/9  gini=0.308 top10=100.0%` |
| offset-top3 | `sig= 1856 bet=   4878 hit= 128 net=    -270 roi=   -5.5% hr=  6.9% avgBet=2.6 dd=  599 pos= 2/9  gini=0.329 top10=100.0%` |

### Strategy Legend
| strategy | family | description |
|---|---|---|
| single-exact120-recent3 | single-core | Single/mixed core, 120-window center exactly matches table top1, bet recent center 3-neighbor. |
| single-near120-recent3 | single-core | Single/mixed core, 120-window center within 1 of table top1, recent z>=1.5, bet recent center 3-neighbor. |
| single-exact60-recent5 | single-core | Fast short-window exact center match, bet recent center 5-neighbor. |
| stable-exact160-recent3 | stability | Stable profile, 160-window exact center match, bet recent center 3-neighbor. |
| multi-follow120-recent3 | multi-core | Multi/mixed core, 120-window center follows any top-3 table core, bet recent center 3-neighbor. |
| multi-follow120-recent5 | multi-core | Multi/mixed core, 120-window follows any top-3 table core, bet recent center 5-neighbor. |
| core-cold120-profile5 | rebound | Table top1 is hot historically but cold in recent 120 spins, bet table top1 center 5-neighbor. |
| core-cold80-profile5 | rebound | Table top1 is hot historically but cold in recent 80 spins, bet table top1 center 5-neighbor. |
| intersection160-zone | zone-observe | 160-window exact center match, draw/bet the 7-neighbor intersection zone. |
| offset-top1 | transition | Same-table historical wheel offset top-1 has lift>=1.25, bet one number. |
| offset-top3 | transition | Same-table historical wheel offset top-3 has lift>=1.15, bet three numbers. |

## Dataset: history_data.json
- sessions: 76
- spins: 24812
- final descriptive cards: 23
- walk-forward strategy events: 18185
- no-future: strategy events only use prior sessions for table cards and current prefix for live features.

### Final Descriptive Table Cards
| table | card |
|---|---|
| 自动画像3 (auto_03) | mixed-core; sessions=9; nums=3545; top=8(z=4.3), 19(z=-0.1), 12(z=-0.8); stability=0.44; gapZ=4.42; offset=11 lift=1.25 |
| 自动画像16 (auto_16) | mixed-core; sessions=8; nums=2169; top=7(z=3.6), 21(z=1.4), 36(z=-0.7); stability=0.38; gapZ=2.25; offset=33 lift=1.25 |
| 自动画像22 (auto_22) | single-core; sessions=4; nums=2046; top=19(z=2.5), 16(z=0.3), 6(z=0.2); stability=0.50; gapZ=2.20; offset=23 lift=1.23 |
| 自动画像24 (auto_24) | single-core; sessions=4; nums=1972; top=1(z=1.8), 8(z=1.0), 4(z=0.7); stability=0.50; gapZ=0.80; offset=10 lift=1.28 |
| 自动画像12 (auto_12) | single-core; sessions=6; nums=1673; top=2(z=4.2), 36(z=0.5), 7(z=0.3); stability=0.67; gapZ=3.68; offset=12 lift=1.33 |
| 自动画像2 (auto_02) | single-core; sessions=5; nums=1658; top=19(z=3.9), 16(z=0.7), 27(z=0.0); stability=1.00; gapZ=3.20; offset=7 lift=1.39 |
| 自动画像1 (auto_01) | single-core; sessions=6; nums=1583; top=9(z=2.5), 24(z=1.6), 34(z=0.2); stability=0.67; gapZ=0.96; offset=29 lift=1.34 |
| 自动画像9 (auto_09) | single-core; sessions=4; nums=1396; top=3(z=3.5), 5(z=1.8), 6(z=0.7); stability=0.75; gapZ=1.78; offset=15 lift=1.36 |
| 自动画像5 (auto_05) | single-core; sessions=4; nums=1261; top=8(z=3.4), 20(z=1.3), 28(z=0.5); stability=0.75; gapZ=2.16; offset=35 lift=1.44 |
| 自动画像11 (auto_11) | single-core; sessions=4; nums=1107; top=30(z=3.1), 21(z=1.0), 22(z=0.1); stability=0.75; gapZ=2.07; offset=6 lift=1.34 |
| 自动画像23 (auto_23) | single-core; sessions=3; nums=1101; top=12(z=2.2), 20(z=1.2), 36(z=0.5); stability=0.67; gapZ=1.00; offset=33 lift=1.38 |
| 自动画像8 (auto_08) | single-core; sessions=3; nums=1007; top=24(z=2.6), 21(z=0.5), 29(z=-0.0); stability=0.67; gapZ=2.09; offset=6 lift=1.51 |
| 自动画像18 (auto_18) | small-sample; sessions=2; nums=864; top=26(z=2.4), 18(z=0.7), 10(z=0.7); stability=0.00; gapZ=1.65; offset=22 lift=1.46 |
| 自动画像4 (auto_04) | single-core; sessions=3; nums=613; top=6(z=3.4), 29(z=0.8), 33(z=-0.1); stability=0.67; gapZ=2.58; offset=34 lift=1.64 |
| 自动画像17 (auto_17) | small-sample; sessions=2; nums=531; top=5(z=1.3), 19(z=0.7), 9(z=0.2); stability=1.00; gapZ=0.55; offset=6 lift=1.75 |
| 自动画像21 (auto_21) | small-sample; sessions=1; nums=284; top=25(z=1.9), 24(z=1.6), 22(z=0.6); stability=1.00; gapZ=0.30; offset=4 lift=1.57 |
| 自动画像20 (auto_20) | small-sample; sessions=1; nums=254; top=31(z=1.9), 36(z=0.5), 21(z=0.3); stability=1.00; gapZ=1.44; offset=29 lift=1.90 |
| 自动画像7 (auto_07) | small-sample; sessions=1; nums=227; top=14(z=1.4), 23(z=1.2), 15(z=0.9); stability=1.00; gapZ=0.17; offset=24 lift=1.64 |
| 自动画像14 (auto_14) | small-sample; sessions=1; nums=226; top=21(z=2.1), 33(z=1.6), 29(z=-0.3); stability=1.00; gapZ=0.51; offset=27 lift=1.97 |
| 自动画像19 (auto_19) | small-sample; sessions=1; nums=225; top=36(z=2.8), 21(z=0.9), 3(z=-0.4); stability=1.00; gapZ=1.87; offset=13 lift=1.98 |

### Walk-Forward By Strategy
| key | summary |
|---|---:|
| stable-exact160-recent3 | `sig=  453 bet=   1359 hit=  52 net=     513 roi=   37.7% hr= 11.5% avgBet=3.0 dd=  123 pos= 7/14 gini=0.597 top10=97.8%` |
| intersection160-zone | `sig=  538 bet=   3766 hit= 118 net=     482 roi=   12.8% hr= 21.9% avgBet=7.0 dd=  402 pos= 9/20 gini=0.563 top10=91.3%` |
| single-exact60-recent5 | `sig=  248 bet=   1240 hit=  40 net=     200 roi=   16.1% hr= 16.1% avgBet=5.0 dd=  146 pos= 8/17 gini=0.606 top10=95.2%` |
| offset-top1 | `sig= 5864 bet=   5864 hit= 166 net=     112 roi=    1.9% hr=  2.8% avgBet=1.0 dd=  317 pos=27/55 gini=0.516 top10=53.3%` |
| single-near120-recent3 | `sig=  629 bet=   1887 hit=  54 net=      57 roi=    3.0% hr=  8.6% avgBet=3.0 dd=  207 pos= 7/17 gini=0.473 top10=91.3%` |
| multi-follow120-recent3 | `sig=  697 bet=   2091 hit=  58 net=      -3 roi=   -0.1% hr=  8.3% avgBet=3.0 dd=  228 pos= 9/24 gini=0.440 top10=86.4%` |
| multi-follow120-recent5 | `sig=  518 bet=   2590 hit=  69 net=    -106 roi=   -4.1% hr= 13.3% avgBet=5.0 dd=  258 pos= 6/19 gini=0.591 top10=93.1%` |
| single-exact120-recent3 | `sig=  151 bet=    453 hit=   9 net=    -129 roi=  -28.5% hr=  6.0% avgBet=3.0 dd=  147 pos= 2/9  gini=0.504 top10=100.0%` |
| core-cold120-profile5 | `sig= 1089 bet=   5445 hit= 144 net=    -261 roi=   -4.8% hr= 13.2% avgBet=5.0 dd=  602 pos=15/28 gini=0.380 top10=81.9%` |
| core-cold80-profile5 | `sig= 1216 bet=   6080 hit= 157 net=    -428 roi=   -7.0% hr= 12.9% avgBet=5.0 dd=  751 pos=16/32 gini=0.443 top10=78.5%` |
| offset-top3 | `sig= 6782 bet=  18509 hit= 464 net=   -1805 roi=   -9.8% hr=  6.8% avgBet=2.7 dd= 2108 pos=22/55 gini=0.512 top10=53.8%` |

### Walk-Forward By Table Type
| key | summary |
|---|---:|
| small-sample | `sig= 3207 bet=   8561 hit= 269 net=    1123 roi=   13.1% hr=  8.4% avgBet=2.7 dd=  435 pos=10/24 gini=0.625 top10=84.6%` |
| multi-core | `sig= 1583 bet=   4195 hit= 123 net=     233 roi=    5.6% hr=  7.8% avgBet=2.7 dd=  269 pos= 5/9  gini=0.505 top10=100.0%` |
| mixed-core | `sig= 6013 bet=  17325 hit= 477 net=    -153 roi=   -0.9% hr=  7.9% avgBet=2.9 dd=  980 pos=14/29 gini=0.535 top10=80.5%` |
| single-core | `sig= 7382 bet=  19203 hit= 462 net=   -2571 roi=  -13.4% hr=  6.3% avgBet=2.6 dd= 2895 pos= 9/28 gini=0.619 top10=80.2%` |

### Walk-Forward By Table Type + Strategy
| key | summary |
|---|---:|
| small-sample / intersection160-zone | `sig=  284 bet=   1988 hit=  76 net=     748 roi=   37.6% hr= 26.8% avgBet=7.0 dd=  133 pos= 6/9  gini=0.572 top10=100.0%` |
| small-sample / stable-exact160-recent3 | `sig=  267 bet=    801 hit=  35 net=     459 roi=   57.3% hr= 13.1% avgBet=3.0 dd=  120 pos= 4/8  gini=0.608 top10=100.0%` |
| mixed-core / offset-top1 | `sig= 1321 bet=   1321 hit=  48 net=     407 roi=   30.8% hr=  3.6% avgBet=1.0 dd=   92 pos=14/24 gini=0.621 top10=81.6%` |
| small-sample / single-exact60-recent5 | `sig=  149 bet=    745 hit=  28 net=     263 roi=   35.3% hr= 18.8% avgBet=5.0 dd=   85 pos= 5/10 gini=0.638 top10=100.0%` |
| multi-core / core-cold80-profile5 | `sig=  121 bet=    605 hit=  21 net=     151 roi=   25.0% hr= 17.4% avgBet=5.0 dd=  149 pos= 3/3  gini=0.172 top10=100.0%` |
| mixed-core / single-near120-recent3 | `sig=  265 bet=    795 hit=  26 net=     141 roi=   17.7% hr=  9.8% avgBet=3.0 dd=  132 pos= 4/8  gini=0.501 top10=100.0%` |
| multi-core / core-cold120-profile5 | `sig=   92 bet=    460 hit=  16 net=     116 roi=   25.2% hr= 17.4% avgBet=5.0 dd=  110 pos= 4/4  gini=0.086 top10=100.0%` |
| multi-core / offset-top3 | `sig=  652 bet=   1956 hit=  57 net=      96 roi=    4.9% hr=  8.7% avgBet=3.0 dd=  198 pos= 4/9  gini=0.363 top10=100.0%` |
| single-core / stable-exact160-recent3 | `sig=  186 bet=    558 hit=  17 net=      54 roi=    9.7% hr=  9.1% avgBet=3.0 dd=   84 pos= 3/8  gini=0.424 top10=100.0%` |
| mixed-core / multi-follow120-recent3 | `sig=  644 bet=   1932 hit=  55 net=      48 roi=    2.5% hr=  8.5% avgBet=3.0 dd=  177 pos= 8/19 gini=0.409 top10=90.4%` |
| small-sample / offset-top1 | `sig= 1247 bet=   1247 hit=  35 net=      13 roi=    1.0% hr=  2.8% avgBet=1.0 dd=  187 pos= 8/19 gini=0.562 top10=88.1%` |
| mixed-core / single-exact60-recent5 | `sig=   13 bet=     65 hit=   2 net=       7 roi=   10.8% hr= 15.4% avgBet=5.0 dd=   20 pos= 2/4  gini=0.250 top10=100.0%` |
| multi-core / intersection160-zone | `sig=   25 bet=    175 hit=   5 net=       5 roi=    2.9% hr= 20.0% avgBet=7.0 dd=   55 pos= 1/2  gini=0.053 top10=100.0%` |
| single-core / single-exact60-recent5 | `sig=   74 bet=    370 hit=  10 net=     -10 roi=   -2.7% hr= 13.5% avgBet=5.0 dd=  116 pos= 4/6  gini=0.352 top10=100.0%` |
| multi-core / multi-follow120-recent5 | `sig=   38 bet=    190 hit=   5 net=     -10 roi=   -5.3% hr= 13.2% avgBet=5.0 dd=   38 pos= 1/4  gini=0.167 top10=100.0%` |
| multi-core / offset-top1 | `sig=  590 bet=    590 hit=  16 net=     -14 roi=   -2.4% hr=  2.7% avgBet=1.0 dd=  212 pos= 3/8  gini=0.459 top10=100.0%` |
| mixed-core / single-exact120-recent3 | `sig=   33 bet=     99 hit=   2 net=     -27 roi=  -27.3% hr=  6.1% avgBet=3.0 dd=   66 pos= 2/5  gini=0.267 top10=100.0%` |
| multi-core / multi-follow120-recent3 | `sig=   53 bet=    159 hit=   3 net=     -51 roi=  -32.1% hr=  5.7% avgBet=3.0 dd=   51 pos= 1/5  gini=0.248 top10=100.0%` |
| mixed-core / core-cold80-profile5 | `sig=  573 bet=   2865 hit=  78 net=     -57 roi=   -2.0% hr= 13.6% avgBet=5.0 dd=  275 pos=10/19 gini=0.461 top10=90.4%` |
| multi-core / single-exact60-recent5 | `sig=   12 bet=     60 hit=   0 net=     -60 roi= -100.0% hr=  0.0% avgBet=5.0 dd=   60 pos= 0/2  gini=0.333 top10=100.0%` |
| single-core / single-near120-recent3 | `sig=  364 bet=   1092 hit=  28 net=     -84 roi=   -7.7% hr=  7.7% avgBet=3.0 dd=  180 pos= 3/9  gini=0.417 top10=100.0%` |
| mixed-core / multi-follow120-recent5 | `sig=  480 bet=   2400 hit=  64 net=     -96 roi=   -4.0% hr= 13.3% avgBet=5.0 dd=  258 pos= 5/15 gini=0.542 top10=95.0%` |
| single-core / single-exact120-recent3 | `sig=  118 bet=    354 hit=   7 net=    -102 roi=  -28.8% hr=  5.9% avgBet=3.0 dd=  126 pos= 0/4  gini=0.603 top10=100.0%` |
| mixed-core / core-cold120-profile5 | `sig=  477 bet=   2385 hit=  63 net=    -117 roi=   -4.9% hr= 13.2% avgBet=5.0 dd=  299 pos= 9/16 gini=0.450 top10=94.1%` |
| mixed-core / intersection160-zone | `sig=   43 bet=    301 hit=   5 net=    -121 roi=  -40.2% hr= 11.6% avgBet=7.0 dd=  129 pos= 1/5  gini=0.412 top10=100.0%` |
| single-core / intersection160-zone | `sig=  186 bet=   1302 hit=  32 net=    -150 roi=  -11.5% hr= 17.2% avgBet=7.0 dd=  310 pos= 3/8  gini=0.512 top10=100.0%` |
| single-core / core-cold120-profile5 | `sig=  520 bet=   2600 hit=  65 net=    -260 roi=  -10.0% hr= 12.5% avgBet=5.0 dd=  458 pos= 5/11 gini=0.396 top10=99.6%` |
| single-core / offset-top1 | `sig= 2706 bet=   2706 hit=  67 net=    -294 roi=  -10.9% hr=  2.5% avgBet=1.0 dd=  368 pos= 9/28 gini=0.511 top10=78.3%` |
| mixed-core / offset-top3 | `sig= 2164 bet=   5162 hit= 134 net=    -338 roi=   -6.5% hr=  6.2% avgBet=2.4 dd=  707 pos=11/29 gini=0.472 top10=79.3%` |
| small-sample / offset-top3 | `sig= 1260 bet=   3780 hit=  95 net=    -360 roi=   -9.5% hr=  7.5% avgBet=3.0 dd=  666 pos= 8/19 gini=0.484 top10=88.2%` |
| single-core / core-cold80-profile5 | `sig=  522 bet=   2610 hit=  58 net=    -522 roi=  -20.0% hr= 11.1% avgBet=5.0 dd=  633 pos= 4/14 gini=0.431 top10=98.5%` |
| single-core / offset-top3 | `sig= 2706 bet=   7611 hit= 178 net=   -1203 roi=  -15.8% hr=  6.6% avgBet=2.8 dd= 1251 pos= 9/28 gini=0.584 top10=78.3%` |

### Walk-Forward By Evolving Table Card + Strategy
| key | summary |
|---|---:|
| auto_22 / small-sample / intersection160-zone | `sig=  145 bet=   1015 hit=  40 net=     425 roi=   41.9% hr= 27.6% avgBet=7.0 dd=   77 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_22 / small-sample / stable-exact160-recent3 | `sig=  145 bet=    435 hit=  20 net=     285 roi=   65.5% hr= 13.8% avgBet=3.0 dd=   75 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_15 / mixed-core / offset-top3 | `sig=  260 bet=    780 hit=  28 net=     228 roi=   29.2% hr= 10.8% avgBet=3.0 dd=  132 pos= 3/3  gini=0.237 top10=100.0%` |
| auto_22 / small-sample / single-exact60-recent5 | `sig=   50 bet=    250 hit=  12 net=     182 roi=   72.8% hr= 24.0% avgBet=5.0 dd=   80 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_05 / mixed-core / offset-top1 | `sig=  229 bet=    229 hit=  11 net=     167 roi=   72.9% hr=  4.8% avgBet=1.0 dd=   62 pos= 1/2  gini=0.352 top10=100.0%` |
| auto_05 / multi-core / offset-top3 | `sig=  343 bet=   1029 hit=  33 net=     159 roi=   15.5% hr=  9.6% avgBet=3.0 dd=  102 pos= 2/3  gini=0.404 top10=100.0%` |
| auto_25 / small-sample / intersection160-zone | `sig=   17 bet=    119 hit=   7 net=     133 roi=  111.8% hr= 41.2% avgBet=7.0 dd=   42 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_09 / small-sample / stable-exact160-recent3 | `sig=   32 bet=     96 hit=   6 net=     120 roi=  125.0% hr= 18.8% avgBet=3.0 dd=   27 pos= 2/3  gini=0.500 top10=100.0%` |
| auto_16 / mixed-core / single-near120-recent3 | `sig=   57 bet=    171 hit=   8 net=     117 roi=   68.4% hr= 14.0% avgBet=3.0 dd=   66 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_16 / mixed-core / multi-follow120-recent5 | `sig=   78 bet=    390 hit=  14 net=     114 roi=   29.2% hr= 17.9% avgBet=5.0 dd=   75 pos= 3/3  gini=0.643 top10=100.0%` |
| auto_09 / small-sample / intersection160-zone | `sig=   32 bet=    224 hit=   9 net=     100 roi=   44.6% hr= 28.1% avgBet=7.0 dd=   63 pos= 2/3  gini=0.495 top10=100.0%` |
| auto_15 / mixed-core / offset-top1 | `sig=  260 bet=    260 hit=  10 net=     100 roi=   38.5% hr=  3.8% avgBet=1.0 dd=   86 pos= 3/3  gini=0.167 top10=100.0%` |
| auto_02 / mixed-core / offset-top1 | `sig=  155 bet=    155 hit=   7 net=      97 roi=   62.6% hr=  4.5% avgBet=1.0 dd=   61 pos= 3/3  gini=0.399 top10=100.0%` |
| auto_03 / mixed-core / multi-follow120-recent5 | `sig=  103 bet=    515 hit=  17 net=      97 roi=   18.8% hr= 16.5% avgBet=5.0 dd=   70 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_09 / small-sample / single-exact60-recent5 | `sig=   24 bet=    120 hit=   6 net=      96 roi=   80.0% hr= 25.0% avgBet=5.0 dd=   25 pos= 2/3  gini=0.623 top10=100.0%` |
| auto_16 / mixed-core / multi-follow120-recent3 | `sig=   89 bet=    267 hit=  10 net=      93 roi=   34.8% hr= 11.2% avgBet=3.0 dd=   78 pos= 3/4  gini=0.419 top10=100.0%` |
| auto_06 / mixed-core / offset-top3 | `sig=  114 bet=    342 hit=  12 net=      90 roi=   26.3% hr= 10.5% avgBet=3.0 dd=   57 pos= 2/3  gini=0.375 top10=100.0%` |
| auto_02 / small-sample / intersection160-zone | `sig=   44 bet=    308 hit=  11 net=      88 roi=   28.6% hr= 25.0% avgBet=7.0 dd=  126 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_03 / mixed-core / single-near120-recent3 | `sig=  103 bet=    309 hit=  11 net=      87 roi=   28.2% hr= 10.7% avgBet=3.0 dd=   66 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_02 / small-sample / stable-exact160-recent3 | `sig=   44 bet=    132 hit=   6 net=      84 roi=   63.6% hr= 13.6% avgBet=3.0 dd=   69 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_08 / single-core / stable-exact160-recent3 | `sig=   23 bet=     69 hit=   4 net=      75 roi=  108.7% hr= 17.4% avgBet=3.0 dd=   21 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_02 / mixed-core / offset-top3 | `sig=  155 bet=    465 hit=  15 net=      75 roi=   16.1% hr=  9.7% avgBet=3.0 dd=   93 pos= 3/3  gini=0.080 top10=100.0%` |
| auto_04 / multi-core / core-cold80-profile5 | `sig=   36 bet=    180 hit=   7 net=      72 roi=   40.0% hr= 19.4% avgBet=5.0 dd=   60 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_01 / mixed-core / offset-top1 | `sig=  328 bet=    328 hit=  11 net=      68 roi=   20.7% hr=  3.4% avgBet=1.0 dd=   65 pos= 5/10 gini=0.438 top10=100.0%` |
| auto_03 / small-sample / offset-top3 | `sig=  206 bet=    618 hit=  19 net=      66 roi=   10.7% hr=  9.2% avgBet=3.0 dd=  120 pos= 2/2  gini=0.364 top10=100.0%` |
| auto_03 / mixed-core / core-cold80-profile5 | `sig=  196 bet=    980 hit=  29 net=      64 roi=    6.5% hr= 14.8% avgBet=5.0 dd=  153 pos= 4/5  gini=0.200 top10=100.0%` |
| auto_01 / mixed-core / core-cold120-profile5 | `sig=  117 bet=    585 hit=  18 net=      63 roi=   10.8% hr= 15.4% avgBet=5.0 dd=   85 pos= 4/7  gini=0.364 top10=100.0%` |
| auto_22 / small-sample / offset-top1 | `sig=  227 bet=    227 hit=   8 net=      61 roi=   26.9% hr=  3.5% avgBet=1.0 dd=   63 pos= 1/2  gini=0.484 top10=100.0%` |
| auto_02 / small-sample / offset-top3 | `sig=   53 bet=    159 hit=   6 net=      57 roi=   35.8% hr= 11.3% avgBet=3.0 dd=   48 pos= 2/3  gini=0.551 top10=100.0%` |
| auto_02 / small-sample / single-exact60-recent5 | `sig=   39 bet=    195 hit=   7 net=      57 roi=   29.2% hr= 17.9% avgBet=5.0 dd=   70 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_16 / mixed-core / core-cold80-profile5 | `sig=   39 bet=    195 hit=   7 net=      57 roi=   29.2% hr= 17.9% avgBet=5.0 dd=   50 pos= 2/3  gini=0.458 top10=100.0%` |
| auto_05 / multi-core / offset-top1 | `sig=  343 bet=    343 hit=  11 net=      53 roi=   15.5% hr=  3.2% avgBet=1.0 dd=  114 pos= 1/3  gini=0.551 top10=100.0%` |
| auto_06 / mixed-core / core-cold80-profile5 | `sig=    4 bet=     20 hit=   2 net=      52 roi=  260.0% hr= 50.0% avgBet=5.0 dd=    5 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_15 / mixed-core / intersection160-zone | `sig=    8 bet=     56 hit=   3 net=      52 roi=   92.9% hr= 37.5% avgBet=7.0 dd=   35 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_06 / small-sample / intersection160-zone | `sig=   34 bet=    238 hit=   8 net=      50 roi=   21.0% hr= 23.5% avgBet=7.0 dd=   35 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_05 / multi-core / core-cold80-profile5 | `sig=   70 bet=    350 hit=  11 net=      46 roi=   13.1% hr= 15.7% avgBet=5.0 dd=  149 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_05 / single-core / core-cold80-profile5 | `sig=   20 bet=    100 hit=   4 net=      44 roi=   44.0% hr= 20.0% avgBet=5.0 dd=   35 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_04 / small-sample / offset-top1 | `sig=   69 bet=     69 hit=   3 net=      39 roi=   56.5% hr=  4.3% avgBet=1.0 dd=   32 pos= 1/1  gini=0.000 top10=100.0%` |
| auto_05 / mixed-core / multi-follow120-recent3 | `sig=  119 bet=    357 hit=  11 net=      39 roi=   10.9% hr=  9.2% avgBet=3.0 dd=  102 pos= 1/2  gini=0.144 top10=100.0%` |
| auto_12 / single-core / intersection160-zone | `sig=   82 bet=    574 hit=  17 net=      38 roi=    6.6% hr= 20.7% avgBet=7.0 dd=  143 pos= 1/2  gini=0.156 top10=100.0%` |

### Latest 10 By Strategy
| key | summary |
|---|---:|
| intersection160-zone | `sig=  313 bet=   2191 hit=  75 net=     509 roi=   23.2% hr= 24.0% avgBet=7.0 dd=  143 pos= 4/7  gini=0.564 top10=100.0%` |
| stable-exact160-recent3 | `sig=  282 bet=    846 hit=  34 net=     378 roi=   44.7% hr= 12.1% avgBet=3.0 dd=  108 pos= 4/5  gini=0.588 top10=100.0%` |
| single-exact60-recent5 | `sig=  119 bet=    595 hit=  19 net=      89 roi=   15.0% hr= 16.0% avgBet=5.0 dd=  146 pos= 2/4  gini=0.508 top10=100.0%` |
| offset-top1 | `sig= 2087 bet=   2087 hit=  60 net=      73 roi=    3.5% hr=  2.9% avgBet=1.0 dd=  315 pos= 5/9  gini=0.435 top10=100.0%` |
| single-near120-recent3 | `sig=  229 bet=    687 hit=  21 net=      69 roi=   10.0% hr=  9.2% avgBet=3.0 dd=  147 pos= 3/5  gini=0.456 top10=100.0%` |
| core-cold80-profile5 | `sig=  283 bet=   1415 hit=  41 net=      61 roi=    4.3% hr= 14.5% avgBet=5.0 dd=  193 pos= 4/7  gini=0.455 top10=100.0%` |
| multi-follow120-recent3 | `sig=  199 bet=    597 hit=  18 net=      51 roi=    8.5% hr=  9.0% avgBet=3.0 dd=   96 pos= 3/5  gini=0.389 top10=100.0%` |
| core-cold120-profile5 | `sig=  240 bet=   1200 hit=  34 net=      24 roi=    2.0% hr= 14.2% avgBet=5.0 dd=  218 pos= 2/4  gini=0.231 top10=100.0%` |
| multi-follow120-recent5 | `sig=  142 bet=    710 hit=  18 net=     -62 roi=   -8.7% hr= 12.7% avgBet=5.0 dd=  206 pos= 2/4  gini=0.512 top10=100.0%` |
| single-exact120-recent3 | `sig=   97 bet=    291 hit=   6 net=     -75 roi=  -25.8% hr=  6.2% avgBet=3.0 dd=  126 pos= 1/4  gini=0.574 top10=100.0%` |
| offset-top3 | `sig= 2102 bet=   6140 hit= 137 net=   -1208 roi=  -19.7% hr=  6.5% avgBet=2.9 dd= 1223 pos= 2/9  gini=0.434 top10=100.0%` |

### Strategy Legend
| strategy | family | description |
|---|---|---|
| single-exact120-recent3 | single-core | Single/mixed core, 120-window center exactly matches table top1, bet recent center 3-neighbor. |
| single-near120-recent3 | single-core | Single/mixed core, 120-window center within 1 of table top1, recent z>=1.5, bet recent center 3-neighbor. |
| single-exact60-recent5 | single-core | Fast short-window exact center match, bet recent center 5-neighbor. |
| stable-exact160-recent3 | stability | Stable profile, 160-window exact center match, bet recent center 3-neighbor. |
| multi-follow120-recent3 | multi-core | Multi/mixed core, 120-window center follows any top-3 table core, bet recent center 3-neighbor. |
| multi-follow120-recent5 | multi-core | Multi/mixed core, 120-window follows any top-3 table core, bet recent center 5-neighbor. |
| core-cold120-profile5 | rebound | Table top1 is hot historically but cold in recent 120 spins, bet table top1 center 5-neighbor. |
| core-cold80-profile5 | rebound | Table top1 is hot historically but cold in recent 80 spins, bet table top1 center 5-neighbor. |
| intersection160-zone | zone-observe | 160-window exact center match, draw/bet the 7-neighbor intersection zone. |
| offset-top1 | transition | Same-table historical wheel offset top-1 has lift>=1.25, bet one number. |
| offset-top3 | transition | Same-table historical wheel offset top-3 has lift>=1.15, bet three numbers. |

## Cross-Dataset Robustness

### Strategy
| strategy | data_2026.6.11 | history_data | minROI | description |
|---|---:|---:|---:|---|
| single-exact120-recent3 | `sig=  113 bet=    339 hit=   5 net=    -159 roi=  -46.9% hr=  4.4% avgBet=3.0 dd=  204 pos= 2/8  gini=0.542 top10=100.0%` | `sig=  151 bet=    453 hit=   9 net=    -129 roi=  -28.5% hr=  6.0% avgBet=3.0 dd=  147 pos= 2/9  gini=0.504 top10=100.0%` | -46.9% | Single/mixed core, 120-window center exactly matches table top1, bet recent center 3-neighbor. |
| single-near120-recent3 | `sig=  584 bet=   1752 hit=  53 net=     156 roi=    8.9% hr=  9.1% avgBet=3.0 dd=  120 pos=14/26 gini=0.491 top10=74.7%` | `sig=  629 bet=   1887 hit=  54 net=      57 roi=    3.0% hr=  8.6% avgBet=3.0 dd=  207 pos= 7/17 gini=0.473 top10=91.3%` | 3.0% | Single/mixed core, 120-window center within 1 of table top1, recent z>=1.5, bet recent center 3-neighbor. |
| single-exact60-recent5 | `sig=  217 bet=   1085 hit=  37 net=     247 roi=   22.8% hr= 17.1% avgBet=5.0 dd=  128 pos=13/27 gini=0.576 top10=75.1%` | `sig=  248 bet=   1240 hit=  40 net=     200 roi=   16.1% hr= 16.1% avgBet=5.0 dd=  146 pos= 8/17 gini=0.606 top10=95.2%` | 16.1% | Fast short-window exact center match, bet recent center 5-neighbor. |
| stable-exact160-recent3 | `sig=  382 bet=   1146 hit=  39 net=     258 roi=   22.5% hr= 10.2% avgBet=3.0 dd=  159 pos= 3/16 gini=0.705 top10=96.9%` | `sig=  453 bet=   1359 hit=  52 net=     513 roi=   37.7% hr= 11.5% avgBet=3.0 dd=  123 pos= 7/14 gini=0.597 top10=97.8%` | 22.5% | Stable profile, 160-window exact center match, bet recent center 3-neighbor. |
| multi-follow120-recent3 | `sig=  713 bet=   2139 hit=  58 net=     -51 roi=   -2.4% hr=  8.1% avgBet=3.0 dd=  207 pos= 8/22 gini=0.517 top10=83.2%` | `sig=  697 bet=   2091 hit=  58 net=      -3 roi=   -0.1% hr=  8.3% avgBet=3.0 dd=  228 pos= 9/24 gini=0.440 top10=86.4%` | -2.4% | Multi/mixed core, 120-window center follows any top-3 table core, bet recent center 3-neighbor. |
| multi-follow120-recent5 | `sig=  532 bet=   2660 hit=  71 net=    -104 roi=   -3.9% hr= 13.3% avgBet=5.0 dd=  252 pos= 8/20 gini=0.432 top10=85.0%` | `sig=  518 bet=   2590 hit=  69 net=    -106 roi=   -4.1% hr= 13.3% avgBet=5.0 dd=  258 pos= 6/19 gini=0.591 top10=93.1%` | -4.1% | Multi/mixed core, 120-window follows any top-3 table core, bet recent center 5-neighbor. |
| core-cold120-profile5 | `sig=  863 bet=   4315 hit= 127 net=     257 roi=    6.0% hr= 14.7% avgBet=5.0 dd=  237 pos=17/35 gini=0.475 top10=72.8%` | `sig= 1089 bet=   5445 hit= 144 net=    -261 roi=   -4.8% hr= 13.2% avgBet=5.0 dd=  602 pos=15/28 gini=0.380 top10=81.9%` | -4.8% | Table top1 is hot historically but cold in recent 120 spins, bet table top1 center 5-neighbor. |
| core-cold80-profile5 | `sig= 1139 bet=   5695 hit= 165 net=     245 roi=    4.3% hr= 14.5% avgBet=5.0 dd=  360 pos=22/43 gini=0.408 top10=64.4%` | `sig= 1216 bet=   6080 hit= 157 net=    -428 roi=   -7.0% hr= 12.9% avgBet=5.0 dd=  751 pos=16/32 gini=0.443 top10=78.5%` | -7.0% | Table top1 is hot historically but cold in recent 80 spins, bet table top1 center 5-neighbor. |
| intersection160-zone | `sig=  588 bet=   4116 hit= 127 net=     456 roi=   11.1% hr= 21.6% avgBet=7.0 dd=  373 pos=12/22 gini=0.557 top10=87.6%` | `sig=  538 bet=   3766 hit= 118 net=     482 roi=   12.8% hr= 21.9% avgBet=7.0 dd=  402 pos= 9/20 gini=0.563 top10=91.3%` | 11.1% | 160-window exact center match, draw/bet the 7-neighbor intersection zone. |
| offset-top1 | `sig= 6637 bet=   6637 hit= 184 net=     -13 roi=   -0.2% hr=  2.8% avgBet=1.0 dd=  463 pos=34/69 gini=0.470 top10=49.6%` | `sig= 5864 bet=   5864 hit= 166 net=     112 roi=    1.9% hr=  2.8% avgBet=1.0 dd=  317 pos=27/55 gini=0.516 top10=53.3%` | -0.2% | Same-table historical wheel offset top-1 has lift>=1.25, bet one number. |
| offset-top3 | `sig= 7999 bet=  22339 hit= 614 net=    -235 roi=   -1.1% hr=  7.7% avgBet=2.8 dd= 1039 pos=31/72 gini=0.462 top10=47.0%` | `sig= 6782 bet=  18509 hit= 464 net=   -1805 roi=   -9.8% hr=  6.8% avgBet=2.7 dd= 2108 pos=22/55 gini=0.512 top10=53.8%` | -9.8% | Same-table historical wheel offset top-3 has lift>=1.15, bet three numbers. |

### Table Type + Strategy
| key | data_2026.6.11 | history_data | minROI |
|---|---:|---:|---:|
| small-sample / single-exact60-recent5 | `sig=  114 bet=    570 hit=  23 net=     258 roi=   45.3% hr= 20.2% avgBet=5.0 dd=   65 pos= 7/13 gini=0.664 top10=97.4%` | `sig=  149 bet=    745 hit=  28 net=     263 roi=   35.3% hr= 18.8% avgBet=5.0 dd=   85 pos= 5/10 gini=0.638 top10=100.0%` | 35.3% |
| small-sample / stable-exact160-recent3 | `sig=  308 bet=    924 hit=  33 net=     264 roi=   28.6% hr= 10.7% avgBet=3.0 dd=  114 pos= 2/12 gini=0.724 top10=99.0%` | `sig=  267 bet=    801 hit=  35 net=     459 roi=   57.3% hr= 13.1% avgBet=3.0 dd=  120 pos= 4/8  gini=0.608 top10=100.0%` | 28.6% |
| small-sample / intersection160-zone | `sig=  370 bet=   2590 hit=  86 net=     506 roi=   19.5% hr= 23.2% avgBet=7.0 dd=  106 pos= 6/13 gini=0.679 top10=98.4%` | `sig=  284 bet=   1988 hit=  76 net=     748 roi=   37.6% hr= 26.8% avgBet=7.0 dd=  133 pos= 6/9  gini=0.572 top10=100.0%` | 19.5% |
| multi-core / offset-top3 | `sig= 1189 bet=   3063 hit=  89 net=     141 roi=    4.6% hr=  7.5% avgBet=2.6 dd=  282 pos= 7/16 gini=0.461 top10=95.0%` | `sig=  652 bet=   1956 hit=  57 net=      96 roi=    4.9% hr=  8.7% avgBet=3.0 dd=  198 pos= 4/9  gini=0.363 top10=100.0%` | 4.6% |
| small-sample / offset-top1 | `sig= 1058 bet=   1058 hit=  39 net=     346 roi=   32.7% hr=  3.7% avgBet=1.0 dd=  105 pos=11/17 gini=0.427 top10=92.9%` | `sig= 1247 bet=   1247 hit=  35 net=      13 roi=    1.0% hr=  2.8% avgBet=1.0 dd=  187 pos= 8/19 gini=0.562 top10=88.1%` | 1.0% |
| mixed-core / core-cold80-profile5 | `sig=  377 bet=   1885 hit=  61 net=     311 roi=   16.5% hr= 16.2% avgBet=5.0 dd=  148 pos=14/24 gini=0.360 top10=75.3%` | `sig=  573 bet=   2865 hit=  78 net=     -57 roi=   -2.0% hr= 13.6% avgBet=5.0 dd=  275 pos=10/19 gini=0.461 top10=90.4%` | -2.0% |
| multi-core / offset-top1 | `sig=  734 bet=    734 hit=  24 net=     130 roi=   17.7% hr=  3.3% avgBet=1.0 dd=  122 pos= 6/13 gini=0.529 top10=98.8%` | `sig=  590 bet=    590 hit=  16 net=     -14 roi=   -2.4% hr=  2.7% avgBet=1.0 dd=  212 pos= 3/8  gini=0.459 top10=100.0%` | -2.4% |
| mixed-core / multi-follow120-recent5 | `sig=  376 bet=   1880 hit=  55 net=     100 roi=    5.3% hr= 14.6% avgBet=5.0 dd=  189 pos= 7/15 gini=0.403 top10=91.8%` | `sig=  480 bet=   2400 hit=  64 net=     -96 roi=   -4.0% hr= 13.3% avgBet=5.0 dd=  258 pos= 5/15 gini=0.542 top10=95.0%` | -4.0% |
| mixed-core / single-near120-recent3 | `sig=  189 bet=    567 hit=  15 net=     -27 roi=   -4.8% hr=  7.9% avgBet=3.0 dd=  126 pos= 4/10 gini=0.518 top10=100.0%` | `sig=  265 bet=    795 hit=  26 net=     141 roi=   17.7% hr=  9.8% avgBet=3.0 dd=  132 pos= 4/8  gini=0.501 top10=100.0%` | -4.8% |
| mixed-core / core-cold120-profile5 | `sig=  254 bet=   1270 hit=  41 net=     206 roi=   16.2% hr= 16.1% avgBet=5.0 dd=  116 pos= 9/19 gini=0.484 top10=88.2%` | `sig=  477 bet=   2385 hit=  63 net=    -117 roi=   -4.9% hr= 13.2% avgBet=5.0 dd=  299 pos= 9/16 gini=0.450 top10=94.1%` | -4.9% |
| mixed-core / multi-follow120-recent3 | `sig=  475 bet=   1425 hit=  37 net=     -93 roi=   -6.5% hr=  7.8% avgBet=3.0 dd=  180 pos= 4/16 gini=0.520 top10=90.3%` | `sig=  644 bet=   1932 hit=  55 net=      48 roi=    2.5% hr=  8.5% avgBet=3.0 dd=  177 pos= 8/19 gini=0.409 top10=90.4%` | -6.5% |
| single-core / single-near120-recent3 | `sig=  395 bet=   1185 hit=  38 net=     183 roi=   15.4% hr=  9.6% avgBet=3.0 dd=   96 pos=11/17 gini=0.447 top10=89.4%` | `sig=  364 bet=   1092 hit=  28 net=     -84 roi=   -7.7% hr=  7.7% avgBet=3.0 dd=  180 pos= 3/9  gini=0.417 top10=100.0%` | -7.7% |
| small-sample / offset-top3 | `sig= 1058 bet=   3174 hit=  94 net=     210 roi=    6.6% hr=  8.9% avgBet=3.0 dd=  264 pos= 8/17 gini=0.389 top10=92.9%` | `sig= 1260 bet=   3780 hit=  95 net=    -360 roi=   -9.5% hr=  7.5% avgBet=3.0 dd=  666 pos= 8/19 gini=0.484 top10=88.2%` | -9.5% |
| single-core / core-cold120-profile5 | `sig=  457 bet=   2285 hit=  67 net=     127 roi=    5.6% hr= 14.7% avgBet=5.0 dd=  192 pos= 9/16 gini=0.454 top10=94.7%` | `sig=  520 bet=   2600 hit=  65 net=    -260 roi=  -10.0% hr= 12.5% avgBet=5.0 dd=  458 pos= 5/11 gini=0.396 top10=99.6%` | -10.0% |
| single-core / offset-top1 | `sig= 2888 bet=   2888 hit=  80 net=      -8 roi=   -0.3% hr=  2.8% avgBet=1.0 dd=  341 pos=15/38 gini=0.508 top10=77.6%` | `sig= 2706 bet=   2706 hit=  67 net=    -294 roi=  -10.9% hr=  2.5% avgBet=1.0 dd=  368 pos= 9/28 gini=0.511 top10=78.3%` | -10.9% |
| single-core / intersection160-zone | `sig=   74 bet=    518 hit=  16 net=      58 roi=   11.2% hr= 21.6% avgBet=7.0 dd=  119 pos= 2/5  gini=0.400 top10=100.0%` | `sig=  186 bet=   1302 hit=  32 net=    -150 roi=  -11.5% hr= 17.2% avgBet=7.0 dd=  310 pos= 3/8  gini=0.512 top10=100.0%` | -11.5% |
| mixed-core / offset-top3 | `sig= 2219 bet=   6396 hit= 152 net=    -924 roi=  -14.4% hr=  6.8% avgBet=2.9 dd=  975 pos=13/40 gini=0.498 top10=65.0%` | `sig= 2164 bet=   5162 hit= 134 net=    -338 roi=   -6.5% hr=  6.2% avgBet=2.4 dd=  707 pos=11/29 gini=0.472 top10=79.3%` | -14.4% |
| single-core / offset-top3 | `sig= 3533 bet=   9706 hit= 279 net=     338 roi=    3.5% hr=  7.9% avgBet=2.7 dd=  771 pos=19/41 gini=0.466 top10=75.5%` | `sig= 2706 bet=   7611 hit= 178 net=   -1203 roi=  -15.8% hr=  6.6% avgBet=2.8 dd= 1251 pos= 9/28 gini=0.584 top10=78.3%` | -15.8% |
| single-core / core-cold80-profile5 | `sig=  563 bet=   2815 hit=  78 net=      -7 roi=   -0.2% hr= 13.9% avgBet=5.0 dd=  263 pos= 6/17 gini=0.432 top10=94.3%` | `sig=  522 bet=   2610 hit=  58 net=    -522 roi=  -20.0% hr= 11.1% avgBet=5.0 dd=  633 pos= 4/14 gini=0.431 top10=98.5%` | -20.0% |
| mixed-core / offset-top1 | `sig= 1957 bet=   1957 hit=  41 net=    -481 roi=  -24.6% hr=  2.1% avgBet=1.0 dd=  535 pos=13/37 gini=0.515 top10=66.0%` | `sig= 1321 bet=   1321 hit=  48 net=     407 roi=   30.8% hr=  3.6% avgBet=1.0 dd=   92 pos=14/24 gini=0.621 top10=81.6%` | -24.6% |
| mixed-core / intersection160-zone | `sig=   76 bet=    532 hit=  14 net=     -28 roi=   -5.3% hr= 18.4% avgBet=7.0 dd=  131 pos= 3/5  gini=0.331 top10=100.0%` | `sig=   43 bet=    301 hit=   5 net=    -121 roi=  -40.2% hr= 11.6% avgBet=7.0 dd=  129 pos= 1/5  gini=0.412 top10=100.0%` | -40.2% |
