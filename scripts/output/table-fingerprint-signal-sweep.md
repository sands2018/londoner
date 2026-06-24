# Table Fingerprint Signal Sweep

Exploratory walk-forward research for using table fingerprints directly, not only as a hot-number filter.

Bet accounting: each candidate number is one straight-up unit. A signal with 7 candidates risks 7 units and wins 36 units if any candidate hits.

Important caveat: this is a broad multi-method sweep. Treat strong rows as research leads, not product rules, until they survive stricter holdout and parameter-free validation.

## Dataset: data_2026.6.11.json
- sessions: 133
- spins: 33597
- signal positions: index >= 200
- no-future: prior table state uses only earlier sessions; current assignment and all current features use only prefix before the predicted spin.

### Top By Net
| method | group | summary | description |
|---|---|---:|---|
| num-top1-z1 | table-number | `sig= 9733 bet=  9733 hit= 276 net=    203 roi=    2.1% hr=  2.8% avgBet=1.0 dd=  577 pos=32/78 gini=0.447 top10=43.8%` | 桌历史最高频单号，单号z>=1。 |
| offset-top1-min500-lift12 | transition | `sig= 7224 bet=  7224 hit= 201 net=     12 roi=    0.2% hr=  2.8% avgBet=1.0 dd=  473 pos=36/72 gini=0.466 top10=46.8%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |
| tablehot-missing20-sector5 | reversion | `sig=   66 bet=   330 hit=   8 net=    -42 roi=  -12.7% hr= 12.1% avgBet=5.0 dd=  155 pos= 7/13 gini=0.230 top10=90.9%` | 桌第一热区20口未出，打中心5邻。 |
| tablehot-cold-r120-sector7 | reversion | `sig= 1239 bet=  8673 hit= 239 net=    -69 roi=   -0.8% hr= 19.3% avgBet=7.0 dd=  372 pos=23/42 gini=0.477 top10=70.0%` | 桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。 |
| offset-top5-min500 | transition | `sig= 7999 bet= 39995 hit=1102 net=   -323 roi=   -0.8% hr= 13.8% avgBet=5.0 dd= 1820 pos=33/72 gini=0.456 top10=47.0%` | 桌内下一口轮盘偏移前五，转移样本>=500。 |
| num-top3-z1 | table-number | `sig= 9733 bet= 29199 hit= 799 net=   -435 roi=   -1.5% hr=  8.2% avgBet=3.0 dd= 1089 pos=35/78 gini=0.495 top10=43.8%` | 桌历史高频前三，单号z>=1。 |
| tablehot-cold-r80-sector7 | reversion | `sig= 1714 bet= 11998 hit= 320 net=   -478 roi=   -4.0% hr= 18.7% avgBet=7.0 dd=  780 pos=24/51 gini=0.501 top10=59.5%` | 桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。 |
| resonance-r80-sector5-d2 | resonance | `sig= 2102 bet= 10510 hit= 277 net=   -538 roi=   -5.1% hr= 13.2% avgBet=5.0 dd=  875 pos=25/62 gini=0.477 top10=54.7%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| num-top3-recent37-support | table-number | `sig= 9446 bet= 19909 hit= 538 net=   -541 roi=   -2.7% hr=  5.7% avgBet=2.1 dd= 1172 pos=34/78 gini=0.486 top10=43.7%` | 桌历史前三单号，且最近37口出现过。 |
| offset-top3-min500-lift11 | transition | `sig= 7999 bet= 23997 hit= 649 net=   -633 roi=   -2.6% hr=  8.1% avgBet=3.0 dd= 1470 pos=29/72 gini=0.486 top10=47.0%` | 桌内下一口轮盘偏移前三，转移样本>=500，lift>=1.1。 |
| resonance-double-sector7-d2 | resonance | `sig= 1892 bet= 13244 hit= 348 net=   -716 roi=   -5.4% hr= 18.4% avgBet=7.0 dd= 1320 pos=17/53 gini=0.496 top10=64.2%` | 全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。 |
| offset-top3-large-profile | transition | `sig= 6941 bet= 20823 hit= 555 net=   -843 roi=   -4.0% hr=  8.0% avgBet=3.0 dd= 1443 pos=25/66 gini=0.504 top10=50.6%` | 大样本桌画像的轮盘偏移前三，lift>=1.05。 |

### Robust Candidates, min bet 500 and min 8 active sessions
| method | group | summary | description |
|---|---|---:|---|
| num-top1-z1 | table-number | `sig= 9733 bet=  9733 hit= 276 net=    203 roi=    2.1% hr=  2.8% avgBet=1.0 dd=  577 pos=32/78 gini=0.447 top10=43.8%` | 桌历史最高频单号，单号z>=1。 |
| offset-top1-min500-lift12 | transition | `sig= 7224 bet=  7224 hit= 201 net=     12 roi=    0.2% hr=  2.8% avgBet=1.0 dd=  473 pos=36/72 gini=0.466 top10=46.8%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |
| tablehot-cold-r120-sector7 | reversion | `sig= 1239 bet=  8673 hit= 239 net=    -69 roi=   -0.8% hr= 19.3% avgBet=7.0 dd=  372 pos=23/42 gini=0.477 top10=70.0%` | 桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。 |
| offset-top5-min500 | transition | `sig= 7999 bet= 39995 hit=1102 net=   -323 roi=   -0.8% hr= 13.8% avgBet=5.0 dd= 1820 pos=33/72 gini=0.456 top10=47.0%` | 桌内下一口轮盘偏移前五，转移样本>=500。 |
| num-top3-z1 | table-number | `sig= 9733 bet= 29199 hit= 799 net=   -435 roi=   -1.5% hr=  8.2% avgBet=3.0 dd= 1089 pos=35/78 gini=0.495 top10=43.8%` | 桌历史高频前三，单号z>=1。 |
| offset-top3-min500-lift11 | transition | `sig= 7999 bet= 23997 hit= 649 net=   -633 roi=   -2.6% hr=  8.1% avgBet=3.0 dd= 1470 pos=29/72 gini=0.486 top10=47.0%` | 桌内下一口轮盘偏移前三，转移样本>=500，lift>=1.1。 |
| num-top3-recent37-support | table-number | `sig= 9446 bet= 19909 hit= 538 net=   -541 roi=   -2.7% hr=  5.7% avgBet=2.1 dd= 1172 pos=34/78 gini=0.486 top10=43.7%` | 桌历史前三单号，且最近37口出现过。 |
| resonance-all-sector7-d2 | resonance | `sig= 5165 bet= 36155 hit= 974 net=  -1091 roi=   -3.0% hr= 18.9% avgBet=7.0 dd= 1260 pos=27/64 gini=0.522 top10=61.1%` | 全前缀主热区与桌第一热区中心距离<=2，打7邻。 |
| tablehot-cold-r80-sector7 | reversion | `sig= 1714 bet= 11998 hit= 320 net=   -478 roi=   -4.0% hr= 18.7% avgBet=7.0 dd=  780 pos=24/51 gini=0.501 top10=59.5%` | 桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。 |
| offset-top3-large-profile | transition | `sig= 6941 bet= 20823 hit= 555 net=   -843 roi=   -4.0% hr=  8.0% avgBet=3.0 dd= 1443 pos=25/66 gini=0.504 top10=50.6%` | 大样本桌画像的轮盘偏移前三，lift>=1.05。 |
| num-top5-z05 | table-number | `sig= 9733 bet= 48665 hit=1289 net=  -2261 roi=   -4.6% hr= 13.2% avgBet=5.0 dd= 2969 pos=32/78 gini=0.535 top10=43.8%` | 桌历史高频前五，单号z>=0.5。 |
| sector7-top2-z1 | profile-sector | `sig= 9491 bet=106498 hit=2812 net=  -5266 roi=   -4.9% hr= 29.6% avgBet=11.2 dd= 5382 pos=28/78 gini=0.520 top10=44.9%` | 桌画像前二热区7邻并集，单区z>=1。 |
| resonance-r80-sector5-d2 | resonance | `sig= 2102 bet= 10510 hit= 277 net=   -538 roi=   -5.1% hr= 13.2% avgBet=5.0 dd=  875 pos=25/62 gini=0.477 top10=54.7%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| sector5-top1-z1 | profile-sector | `sig= 9491 bet= 47455 hit=1250 net=  -2455 roi=   -5.2% hr= 13.2% avgBet=5.0 dd= 2673 pos=32/78 gini=0.461 top10=44.9%` | 桌画像第一热区中心5邻，z>=1。 |
| resonance-top2-r120-sector5-d2 | resonance | `sig= 3519 bet= 17595 hit= 463 net=   -927 roi=   -5.3% hr= 13.2% avgBet=5.0 dd= 1143 pos=24/69 gini=0.523 top10=49.1%` | 最近120口主热区贴近桌前二热区之一，打该桌热区中心5邻。 |
| resonance-double-sector7-d2 | resonance | `sig= 1892 bet= 13244 hit= 348 net=   -716 roi=   -5.4% hr= 18.4% avgBet=7.0 dd= 1320 pos=17/53 gini=0.496 top10=64.2%` | 全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。 |

### All Methods
| method | group | summary | description |
|---|---|---:|---|
| sector7-top1-z0 | profile-sector | `sig= 9733 bet= 68131 hit=1790 net=  -3691 roi=   -5.4% hr= 18.4% avgBet=7.0 dd= 3807 pos=32/78 gini=0.490 top10=43.8%` | 桌画像第一热区7邻，z>=0，自动归桌即可。 |
| sector7-top1-z1 | profile-sector | `sig= 9491 bet= 66437 hit=1732 net=  -4085 roi=   -6.1% hr= 18.2% avgBet=7.0 dd= 4201 pos=31/78 gini=0.485 top10=44.9%` | 桌画像第一热区7邻，z>=1。 |
| sector5-top1-z1 | profile-sector | `sig= 9491 bet= 47455 hit=1250 net=  -2455 roi=   -5.2% hr= 13.2% avgBet=5.0 dd= 2673 pos=32/78 gini=0.461 top10=44.9%` | 桌画像第一热区中心5邻，z>=1。 |
| sector3-top1-z1 | profile-sector | `sig= 9491 bet= 28473 hit= 732 net=  -2121 roi=   -7.4% hr=  7.7% avgBet=3.0 dd= 2625 pos=31/78 gini=0.480 top10=44.9%` | 桌画像第一热区中心3邻，z>=1。 |
| sector7-top2-z1 | profile-sector | `sig= 9491 bet=106498 hit=2812 net=  -5266 roi=   -4.9% hr= 29.6% avgBet=11.2 dd= 5382 pos=28/78 gini=0.520 top10=44.9%` | 桌画像前二热区7邻并集，单区z>=1。 |
| sector7-top1-large-profile | profile-sector | `sig= 6941 bet= 48587 hit=1259 net=  -3263 roi=   -6.7% hr= 18.1% avgBet=7.0 dd= 3447 pos=27/66 gini=0.443 top10=50.6%` | 大样本桌画像第一热区7邻，桌样本>=3局/500口。 |
| resonance-all-sector7-d2 | resonance | `sig= 5165 bet= 36155 hit= 974 net=  -1091 roi=   -3.0% hr= 18.9% avgBet=7.0 dd= 1260 pos=27/64 gini=0.522 top10=61.1%` | 全前缀主热区与桌第一热区中心距离<=2，打7邻。 |
| resonance-r120-sector7-d2 | resonance | `sig= 2510 bet= 17570 hit= 452 net=  -1298 roi=   -7.4% hr= 18.0% avgBet=7.0 dd= 1952 pos=18/62 gini=0.531 top10=55.8%` | 最近120口主热区与桌第一热区中心距离<=2，打7邻。 |
| resonance-r80-sector5-d2 | resonance | `sig= 2102 bet= 10510 hit= 277 net=   -538 roi=   -5.1% hr= 13.2% avgBet=5.0 dd=  875 pos=25/62 gini=0.477 top10=54.7%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| resonance-double-sector7-d2 | resonance | `sig= 1892 bet= 13244 hit= 348 net=   -716 roi=   -5.4% hr= 18.4% avgBet=7.0 dd= 1320 pos=17/53 gini=0.496 top10=64.2%` | 全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。 |
| resonance-top2-r120-sector5-d2 | resonance | `sig= 3519 bet= 17595 hit= 463 net=   -927 roi=   -5.3% hr= 13.2% avgBet=5.0 dd= 1143 pos=24/69 gini=0.523 top10=49.1%` | 最近120口主热区贴近桌前二热区之一，打该桌热区中心5邻。 |
| intersection-profile7-r120-7 | resonance | `sig= 3977 bet= 19455 hit= 501 net=  -1419 roi=   -7.3% hr= 12.6% avgBet=4.9 dd= 2099 pos=21/70 gini=0.497 top10=48.9%` | 桌第一热区7邻与最近120口主热区7邻交集>=3，只打交集。 |
| tablehot-cold-r80-sector7 | reversion | `sig= 1714 bet= 11998 hit= 320 net=   -478 roi=   -4.0% hr= 18.7% avgBet=7.0 dd=  780 pos=24/51 gini=0.501 top10=59.5%` | 桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。 |
| tablehot-cold-r120-sector7 | reversion | `sig= 1239 bet=  8673 hit= 239 net=    -69 roi=   -0.8% hr= 19.3% avgBet=7.0 dd=  372 pos=23/42 gini=0.477 top10=70.0%` | 桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。 |
| tablehot-missing20-sector5 | reversion | `sig=   66 bet=   330 hit=   8 net=    -42 roi=  -12.7% hr= 12.1% avgBet=5.0 dd=  155 pos= 7/13 gini=0.230 top10=90.9%` | 桌第一热区20口未出，打中心5邻。 |
| num-top1-z1 | table-number | `sig= 9733 bet=  9733 hit= 276 net=    203 roi=    2.1% hr=  2.8% avgBet=1.0 dd=  577 pos=32/78 gini=0.447 top10=43.8%` | 桌历史最高频单号，单号z>=1。 |
| num-top3-z1 | table-number | `sig= 9733 bet= 29199 hit= 799 net=   -435 roi=   -1.5% hr=  8.2% avgBet=3.0 dd= 1089 pos=35/78 gini=0.495 top10=43.8%` | 桌历史高频前三，单号z>=1。 |
| num-top5-z05 | table-number | `sig= 9733 bet= 48665 hit=1289 net=  -2261 roi=   -4.6% hr= 13.2% avgBet=5.0 dd= 2969 pos=32/78 gini=0.535 top10=43.8%` | 桌历史高频前五，单号z>=0.5。 |
| num-top3-recent37-support | table-number | `sig= 9446 bet= 19909 hit= 538 net=   -541 roi=   -2.7% hr=  5.7% avgBet=2.1 dd= 1172 pos=34/78 gini=0.486 top10=43.7%` | 桌历史前三单号，且最近37口出现过。 |
| num-top5-missing37 | table-number | `sig= 8429 bet= 16097 hit= 422 net=   -905 roi=   -5.6% hr=  5.0% avgBet=1.9 dd= 1507 pos=32/76 gini=0.512 top10=45.5%` | 桌历史前五单号，最近37口未出，均值回补。 |
| num-intersect-table10-recent74-10 | table-number | `sig= 9607 bet= 30186 hit= 760 net=  -2826 roi=   -9.4% hr=  7.9% avgBet=3.1 dd= 3117 pos=25/78 gini=0.524 top10=44.0%` | 桌历史前10单号与最近74口前10单号交集。 |
| offset-top1-min500-lift12 | transition | `sig= 7224 bet=  7224 hit= 201 net=     12 roi=    0.2% hr=  2.8% avgBet=1.0 dd=  473 pos=36/72 gini=0.466 top10=46.8%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |
| offset-top3-min500-lift11 | transition | `sig= 7999 bet= 23997 hit= 649 net=   -633 roi=   -2.6% hr=  8.1% avgBet=3.0 dd= 1470 pos=29/72 gini=0.486 top10=47.0%` | 桌内下一口轮盘偏移前三，转移样本>=500，lift>=1.1。 |
| offset-top5-min500 | transition | `sig= 7999 bet= 39995 hit=1102 net=   -323 roi=   -0.8% hr= 13.8% avgBet=5.0 dd= 1820 pos=33/72 gini=0.456 top10=47.0%` | 桌内下一口轮盘偏移前五，转移样本>=500。 |
| offset-top3-large-profile | transition | `sig= 6941 bet= 20823 hit= 555 net=   -843 roi=   -4.0% hr=  8.0% avgBet=3.0 dd= 1443 pos=25/66 gini=0.504 top10=50.6%` | 大样本桌画像的轮盘偏移前三，lift>=1.05。 |

### Latest 10 Sessions, Top By Net
| method | group | summary | description |
|---|---|---:|---|
| resonance-r120-sector7-d2 | resonance | `sig=  763 bet=  5341 hit= 162 net=    491 roi=    9.2% hr= 21.2% avgBet=7.0 dd=  228 pos= 6/9  gini=0.472 top10=100.0%` | 最近120口主热区与桌第一热区中心距离<=2，打7邻。 |
| resonance-double-sector7-d2 | resonance | `sig=  702 bet=  4914 hit= 150 net=    486 roi=    9.9% hr= 21.4% avgBet=7.0 dd=  265 pos= 5/9  gini=0.424 top10=100.0%` | 全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。 |
| intersection-profile7-r120-7 | resonance | `sig= 1026 bet=  5405 hit= 158 net=    283 roi=    5.2% hr= 15.4% avgBet=5.3 dd=  295 pos= 5/9  gini=0.414 top10=100.0%` | 桌第一热区7邻与最近120口主热区7邻交集>=3，只打交集。 |
| num-top1-z1 | table-number | `sig= 2598 bet=  2598 hit=  77 net=    174 roi=    6.7% hr=  3.0% avgBet=1.0 dd=  308 pos= 5/10 gini=0.458 top10=100.0%` | 桌历史最高频单号，单号z>=1。 |
| resonance-r80-sector5-d2 | resonance | `sig=  658 bet=  3290 hit=  93 net=     58 roi=    1.8% hr= 14.1% avgBet=5.0 dd=  243 pos= 5/10 gini=0.600 top10=100.0%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| tablehot-missing20-sector5 | reversion | `sig=   10 bet=    50 hit=   3 net=     58 roi=  116.0% hr= 30.0% avgBet=5.0 dd=   15 pos= 3/3  gini=0.057 top10=100.0%` | 桌第一热区20口未出，打中心5邻。 |
| tablehot-cold-r120-sector7 | reversion | `sig=  337 bet=  2359 hit=  63 net=    -91 roi=   -3.9% hr= 18.7% avgBet=7.0 dd=  348 pos= 4/7  gini=0.433 top10=100.0%` | 桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。 |
| resonance-top2-r120-sector5-d2 | resonance | `sig= 1082 bet=  5410 hit= 147 net=   -118 roi=   -2.2% hr= 13.6% avgBet=5.0 dd=  511 pos= 5/9  gini=0.352 top10=100.0%` | 最近120口主热区贴近桌前二热区之一，打该桌热区中心5邻。 |
| resonance-all-sector7-d2 | resonance | `sig= 2106 bet= 14742 hit= 405 net=   -162 roi=   -1.1% hr= 19.2% avgBet=7.0 dd=  904 pos= 5/10 gini=0.339 top10=100.0%` | 全前缀主热区与桌第一热区中心距离<=2，打7邻。 |
| tablehot-cold-r80-sector7 | reversion | `sig=  468 bet=  3276 hit=  86 net=   -180 roi=   -5.5% hr= 18.4% avgBet=7.0 dd=  552 pos= 5/8  gini=0.486 top10=100.0%` | 桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。 |
| num-top3-recent37-support | table-number | `sig= 2456 bet=  5055 hit= 135 net=   -195 roi=   -3.9% hr=  5.5% avgBet=2.1 dd=  598 pos= 6/10 gini=0.412 top10=100.0%` | 桌历史前三单号，且最近37口出现过。 |
| offset-top3-large-profile | transition | `sig= 1284 bet=  3852 hit= 101 net=   -216 roi=   -5.6% hr=  7.9% avgBet=3.0 dd=  603 pos= 2/8  gini=0.442 top10=100.0%` | 大样本桌画像的轮盘偏移前三，lift>=1.05。 |

### Best Method By Group
| method | group | summary | description |
|---|---|---:|---|
| sector3-top1-z1 | profile-sector | `sig= 9491 bet= 28473 hit= 732 net=  -2121 roi=   -7.4% hr=  7.7% avgBet=3.0 dd= 2625 pos=31/78 gini=0.480 top10=44.9%` | 桌画像第一热区中心3邻，z>=1。 |
| resonance-r80-sector5-d2 | resonance | `sig= 2102 bet= 10510 hit= 277 net=   -538 roi=   -5.1% hr= 13.2% avgBet=5.0 dd=  875 pos=25/62 gini=0.477 top10=54.7%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| tablehot-missing20-sector5 | reversion | `sig=   66 bet=   330 hit=   8 net=    -42 roi=  -12.7% hr= 12.1% avgBet=5.0 dd=  155 pos= 7/13 gini=0.230 top10=90.9%` | 桌第一热区20口未出，打中心5邻。 |
| num-top1-z1 | table-number | `sig= 9733 bet=  9733 hit= 276 net=    203 roi=    2.1% hr=  2.8% avgBet=1.0 dd=  577 pos=32/78 gini=0.447 top10=43.8%` | 桌历史最高频单号，单号z>=1。 |
| offset-top1-min500-lift12 | transition | `sig= 7224 bet=  7224 hit= 201 net=     12 roi=    0.2% hr=  2.8% avgBet=1.0 dd=  473 pos=36/72 gini=0.466 top10=46.8%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |

### Adaptive No-Future Meta-Gates
| method | group | summary | description |
|---|---|---:|---|
| meta-resonance-group-beats-house-cap12 | adaptive | `sig=   27 bet=   167 hit=   0 net=   -167 roi= -100.0% hr=  0.0% avgBet=6.2 dd=  167 pos= 0/3  gini=0.303 top10=100.0%` | Only resonance methods while the resonance group is better than -1% live, min prior group bet 1000. |
| meta-resonance-global-positive-cap10 | adaptive | `sig=  666 bet=  3582 hit=  76 net=   -846 roi=  -23.6% hr= 11.4% avgBet=5.4 dd=  858 pos= 8/29 gini=0.481 top10=67.3%` | Only resonance methods with positive prior method ROI, min prior bet 300, merged candidates <=10. |
| meta-global-positive-cap12 | adaptive | `sig= 9148 bet= 56314 hit=1512 net=  -1882 roi=   -3.3% hr= 16.5% avgBet=6.2 dd= 2437 pos=34/75 gini=0.490 top10=44.9%` | Enable methods whose own prior live ROI is positive, min prior bet 500, merged candidates <=12. |
| meta-table-beats-house-cap12 | adaptive | `sig= 5937 bet= 52206 hit=1393 net=  -2058 roi=   -3.9% hr= 23.5% avgBet=8.8 dd= 2602 pos=26/73 gini=0.513 top10=45.4%` | Enable methods better than -1% on the same auto table/profile, min prior table-method bet 250. |
| meta-consensus2-cap12 | adaptive | `sig= 7899 bet= 49587 hit=1315 net=  -2247 roi=   -4.5% hr= 16.6% avgBet=6.3 dd= 2457 pos=28/76 gini=0.511 top10=46.8%` | Enable methods only when at least two of global/table/venue prior records are positive. |
| meta-global-beats-house-cap12 | adaptive | `sig= 9003 bet= 65671 hit=1755 net=  -2491 roi=   -3.8% hr= 19.5% avgBet=7.3 dd= 2874 pos=30/74 gini=0.532 top10=46.9%` | Enable methods whose prior live ROI is better than -1%, min prior bet 1000, merged candidates <=12. |
| meta-table-positive-cap12 | adaptive | `sig= 6544 bet= 56327 hit=1487 net=  -2795 roi=   -5.0% hr= 22.7% avgBet=8.6 dd= 3201 pos=24/74 gini=0.513 top10=45.6%` | Enable methods positive on the same auto table/profile, min prior table-method bet 150. |
| meta-table-positive-session-stop-cap12 | adaptive | `sig= 6816 bet= 54387 hit=1432 net=  -2835 roi=   -5.2% hr= 21.0% avgBet=8.0 dd= 3410 pos=26/75 gini=0.514 top10=46.7%` | Same-table positive method, but stop that method for the current session after live session net <= -72. |
| meta-venue-positive-cap12 | adaptive | `sig= 7331 bet= 49909 hit=1306 net=  -2893 roi=   -5.8% hr= 17.8% avgBet=6.8 dd= 3170 pos=22/69 gini=0.585 top10=48.9%` | Enable methods positive in the same inferred venue, min prior venue-method bet 250. |
| meta-venue-positive-session-stop-cap12 | adaptive | `sig= 7127 bet= 44300 hit=1141 net=  -3224 roi=   -7.3% hr= 16.0% avgBet=6.2 dd= 3500 pos=23/69 gini=0.577 top10=49.0%` | Same-venue positive method, but stop that method for the current session after live session net <= -72. |

### Latest 10 Sessions, Adaptive Meta-Gates
| method | group | summary | description |
|---|---|---:|---|
| meta-resonance-global-positive-cap10 | adaptive | `sig=    0 bet=     0 hit=   0 net=      0 roi=    0.0% hr=  0.0% avgBet=0.0 dd=    0 pos= 0/0  gini=0.000 top10=0.0%` | Only resonance methods with positive prior method ROI, min prior bet 300, merged candidates <=10. |
| meta-resonance-group-beats-house-cap12 | adaptive | `sig=    0 bet=     0 hit=   0 net=      0 roi=    0.0% hr=  0.0% avgBet=0.0 dd=    0 pos= 0/0  gini=0.000 top10=0.0%` | Only resonance methods while the resonance group is better than -1% live, min prior group bet 1000. |
| meta-global-positive-cap12 | adaptive | `sig= 2358 bet=  6116 hit= 153 net=   -608 roi=   -9.9% hr=  6.5% avgBet=2.6 dd=  689 pos= 2/9  gini=0.346 top10=100.0%` | Enable methods whose own prior live ROI is positive, min prior bet 500, merged candidates <=12. |
| meta-consensus2-cap12 | adaptive | `sig= 2116 bet= 11746 hit= 302 net=   -874 roi=   -7.4% hr= 14.3% avgBet=5.6 dd= 1128 pos= 4/10 gini=0.369 top10=100.0%` | Enable methods only when at least two of global/table/venue prior records are positive. |
| meta-venue-positive-cap12 | adaptive | `sig= 2162 bet= 15852 hit= 414 net=   -948 roi=   -6.0% hr= 19.1% avgBet=7.3 dd= 1232 pos= 4/10 gini=0.485 top10=100.0%` | Enable methods positive in the same inferred venue, min prior venue-method bet 250. |
| meta-venue-positive-session-stop-cap12 | adaptive | `sig= 2198 bet= 14166 hit= 367 net=   -954 roi=   -6.7% hr= 16.7% avgBet=6.4 dd= 1185 pos= 4/10 gini=0.466 top10=100.0%` | Same-venue positive method, but stop that method for the current session after live session net <= -72. |
| meta-table-beats-house-cap12 | adaptive | `sig= 1502 bet= 11639 hit= 296 net=   -983 roi=   -8.4% hr= 19.7% avgBet=7.7 dd= 1119 pos= 1/10 gini=0.489 top10=100.0%` | Enable methods better than -1% on the same auto table/profile, min prior table-method bet 250. |
| meta-global-beats-house-cap12 | adaptive | `sig= 2563 bet= 13377 hit= 334 net=  -1353 roi=  -10.1% hr= 13.0% avgBet=5.2 dd= 1604 pos= 1/10 gini=0.575 top10=100.0%` | Enable methods whose prior live ROI is better than -1%, min prior bet 1000, merged candidates <=12. |
| meta-table-positive-cap12 | adaptive | `sig= 1668 bet= 13134 hit= 322 net=  -1542 roi=  -11.7% hr= 19.3% avgBet=7.9 dd= 1683 pos= 1/10 gini=0.395 top10=100.0%` | Enable methods positive on the same auto table/profile, min prior table-method bet 150. |
| meta-table-positive-session-stop-cap12 | adaptive | `sig= 1832 bet= 13337 hit= 319 net=  -1853 roi=  -13.9% hr= 17.4% avgBet=7.3 dd= 2038 pos= 1/10 gini=0.465 top10=100.0%` | Same-table positive method, but stop that method for the current session after live session net <= -72. |

## Dataset: history_data.json
- sessions: 76
- spins: 24812
- signal positions: index >= 200
- no-future: prior table state uses only earlier sessions; current assignment and all current features use only prefix before the predicted spin.

### Top By Net
| method | group | summary | description |
|---|---|---:|---|
| tablehot-missing20-sector5 | reversion | `sig=   77 bet=   385 hit=  15 net=    155 roi=   40.3% hr= 19.5% avgBet=5.0 dd=   83 pos=10/15 gini=0.249 top10=85.7%` | 桌第一热区20口未出，打中心5邻。 |
| intersection-profile7-r120-7 | resonance | `sig= 3494 bet= 17502 hit= 488 net=     66 roi=    0.4% hr= 14.0% avgBet=5.0 dd=  849 pos=19/55 gini=0.542 top10=53.7%` | 桌第一热区7邻与最近120口主热区7邻交集>=3，只打交集。 |
| tablehot-cold-r120-sector7 | reversion | `sig= 1382 bet=  9674 hit= 269 net=     10 roi=    0.1% hr= 19.5% avgBet=7.0 dd=  687 pos=19/35 gini=0.486 top10=73.8%` | 桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。 |
| resonance-r120-sector7-d2 | resonance | `sig= 2297 bet= 16079 hit= 446 net=    -23 roi=   -0.1% hr= 19.4% avgBet=7.0 dd=  703 pos=19/45 gini=0.414 top10=64.7%` | 最近120口主热区与桌第一热区中心距离<=2，打7邻。 |
| resonance-double-sector7-d2 | resonance | `sig= 1631 bet= 11417 hit= 316 net=    -41 roi=   -0.4% hr= 19.4% avgBet=7.0 dd=  841 pos=14/38 gini=0.495 top10=71.1%` | 全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。 |
| resonance-r80-sector5-d2 | resonance | `sig= 2045 bet= 10225 hit= 282 net=    -73 roi=   -0.7% hr= 13.8% avgBet=5.0 dd=  646 pos=18/50 gini=0.541 top10=62.8%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| offset-top1-min500-lift12 | transition | `sig= 6691 bet=  6691 hit= 182 net=   -139 roi=   -2.1% hr=  2.7% avgBet=1.0 dd=  461 pos=26/55 gini=0.519 top10=54.6%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |
| num-top5-missing37 | table-number | `sig= 7213 bet= 13774 hit= 378 net=   -166 roi=   -1.2% hr=  5.2% avgBet=1.9 dd=  988 pos=28/63 gini=0.533 top10=53.4%` | 桌历史前五单号，最近37口未出，均值回补。 |
| tablehot-cold-r80-sector7 | reversion | `sig= 1659 bet= 11613 hit= 314 net=   -309 roi=   -2.7% hr= 18.9% avgBet=7.0 dd=  899 pos=25/41 gini=0.508 top10=66.9%` | 桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。 |
| resonance-top2-r120-sector5-d2 | resonance | `sig= 3406 bet= 17030 hit= 461 net=   -434 roi=   -2.5% hr= 13.5% avgBet=5.0 dd=  901 pos=20/52 gini=0.476 top10=57.0%` | 最近120口主热区贴近桌前二热区之一，打该桌热区中心5邻。 |
| num-top3-z1 | table-number | `sig= 8259 bet= 24327 hit= 661 net=   -531 roi=   -2.2% hr=  8.0% avgBet=2.9 dd=  824 pos=23/64 gini=0.545 top10=53.3%` | 桌历史高频前三，单号z>=1。 |
| num-top1-z1 | table-number | `sig= 8259 bet=  8259 hit= 211 net=   -663 roi=   -8.0% hr=  2.6% avgBet=1.0 dd= 1005 pos=23/64 gini=0.502 top10=53.3%` | 桌历史最高频单号，单号z>=1。 |

### Robust Candidates, min bet 500 and min 8 active sessions
| method | group | summary | description |
|---|---|---:|---|
| intersection-profile7-r120-7 | resonance | `sig= 3494 bet= 17502 hit= 488 net=     66 roi=    0.4% hr= 14.0% avgBet=5.0 dd=  849 pos=19/55 gini=0.542 top10=53.7%` | 桌第一热区7邻与最近120口主热区7邻交集>=3，只打交集。 |
| tablehot-cold-r120-sector7 | reversion | `sig= 1382 bet=  9674 hit= 269 net=     10 roi=    0.1% hr= 19.5% avgBet=7.0 dd=  687 pos=19/35 gini=0.486 top10=73.8%` | 桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。 |
| resonance-r120-sector7-d2 | resonance | `sig= 2297 bet= 16079 hit= 446 net=    -23 roi=   -0.1% hr= 19.4% avgBet=7.0 dd=  703 pos=19/45 gini=0.414 top10=64.7%` | 最近120口主热区与桌第一热区中心距离<=2，打7邻。 |
| resonance-double-sector7-d2 | resonance | `sig= 1631 bet= 11417 hit= 316 net=    -41 roi=   -0.4% hr= 19.4% avgBet=7.0 dd=  841 pos=14/38 gini=0.495 top10=71.1%` | 全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。 |
| resonance-r80-sector5-d2 | resonance | `sig= 2045 bet= 10225 hit= 282 net=    -73 roi=   -0.7% hr= 13.8% avgBet=5.0 dd=  646 pos=18/50 gini=0.541 top10=62.8%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| num-top5-missing37 | table-number | `sig= 7213 bet= 13774 hit= 378 net=   -166 roi=   -1.2% hr=  5.2% avgBet=1.9 dd=  988 pos=28/63 gini=0.533 top10=53.4%` | 桌历史前五单号，最近37口未出，均值回补。 |
| offset-top1-min500-lift12 | transition | `sig= 6691 bet=  6691 hit= 182 net=   -139 roi=   -2.1% hr=  2.7% avgBet=1.0 dd=  461 pos=26/55 gini=0.519 top10=54.6%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |
| num-top3-z1 | table-number | `sig= 8259 bet= 24327 hit= 661 net=   -531 roi=   -2.2% hr=  8.0% avgBet=2.9 dd=  824 pos=23/64 gini=0.545 top10=53.3%` | 桌历史高频前三，单号z>=1。 |
| resonance-top2-r120-sector5-d2 | resonance | `sig= 3406 bet= 17030 hit= 461 net=   -434 roi=   -2.5% hr= 13.5% avgBet=5.0 dd=  901 pos=20/52 gini=0.476 top10=57.0%` | 最近120口主热区贴近桌前二热区之一，打该桌热区中心5邻。 |
| tablehot-cold-r80-sector7 | reversion | `sig= 1659 bet= 11613 hit= 314 net=   -309 roi=   -2.7% hr= 18.9% avgBet=7.0 dd=  899 pos=25/41 gini=0.508 top10=66.9%` | 桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。 |
| resonance-all-sector7-d2 | resonance | `sig= 4445 bet= 31115 hit= 840 net=   -875 roi=   -2.8% hr= 18.9% avgBet=7.0 dd= 1631 pos=19/55 gini=0.502 top10=63.8%` | 全前缀主热区与桌第一热区中心距离<=2，打7邻。 |
| sector7-top2-z1 | profile-sector | `sig= 8082 bet= 84952 hit=2284 net=  -2728 roi=   -3.2% hr= 28.3% avgBet=10.5 dd= 3509 pos=23/64 gini=0.516 top10=53.8%` | 桌画像前二热区7邻并集，单区z>=1。 |
| num-top5-z05 | table-number | `sig= 8259 bet= 41295 hit=1109 net=  -1371 roi=   -3.3% hr= 13.4% avgBet=5.0 dd= 1904 pos=24/64 gini=0.449 top10=53.3%` | 桌历史高频前五，单号z>=0.5。 |
| sector5-top1-z1 | profile-sector | `sig= 8082 bet= 40410 hit=1084 net=  -1386 roi=   -3.4% hr= 13.4% avgBet=5.0 dd= 2109 pos=23/64 gini=0.524 top10=53.8%` | 桌画像第一热区中心5邻，z>=1。 |
| sector7-top1-z0 | profile-sector | `sig= 8259 bet= 57813 hit=1549 net=  -2049 roi=   -3.5% hr= 18.8% avgBet=7.0 dd= 3150 pos=23/64 gini=0.532 top10=53.3%` | 桌画像第一热区7邻，z>=0，自动归桌即可。 |
| sector3-top1-z1 | profile-sector | `sig= 8082 bet= 24246 hit= 649 net=   -882 roi=   -3.6% hr=  8.0% avgBet=3.0 dd= 1116 pos=23/64 gini=0.486 top10=53.8%` | 桌画像第一热区中心3邻，z>=1。 |

### All Methods
| method | group | summary | description |
|---|---|---:|---|
| sector7-top1-z0 | profile-sector | `sig= 8259 bet= 57813 hit=1549 net=  -2049 roi=   -3.5% hr= 18.8% avgBet=7.0 dd= 3150 pos=23/64 gini=0.532 top10=53.3%` | 桌画像第一热区7邻，z>=0，自动归桌即可。 |
| sector7-top1-z1 | profile-sector | `sig= 8082 bet= 56574 hit=1503 net=  -2466 roi=   -4.4% hr= 18.6% avgBet=7.0 dd= 3567 pos=22/64 gini=0.528 top10=53.8%` | 桌画像第一热区7邻，z>=1。 |
| sector5-top1-z1 | profile-sector | `sig= 8082 bet= 40410 hit=1084 net=  -1386 roi=   -3.4% hr= 13.4% avgBet=5.0 dd= 2109 pos=23/64 gini=0.524 top10=53.8%` | 桌画像第一热区中心5邻，z>=1。 |
| sector3-top1-z1 | profile-sector | `sig= 8082 bet= 24246 hit= 649 net=   -882 roi=   -3.6% hr=  8.0% avgBet=3.0 dd= 1116 pos=23/64 gini=0.486 top10=53.8%` | 桌画像第一热区中心3邻，z>=1。 |
| sector7-top2-z1 | profile-sector | `sig= 8082 bet= 84952 hit=2284 net=  -2728 roi=   -3.2% hr= 28.3% avgBet=10.5 dd= 3509 pos=23/64 gini=0.516 top10=53.8%` | 桌画像前二热区7邻并集，单区z>=1。 |
| sector7-top1-large-profile | profile-sector | `sig= 5522 bet= 38654 hit=1003 net=  -2546 roi=   -6.6% hr= 18.2% avgBet=7.0 dd= 3691 pos=17/51 gini=0.522 top10=54.9%` | 大样本桌画像第一热区7邻，桌样本>=3局/500口。 |
| resonance-all-sector7-d2 | resonance | `sig= 4445 bet= 31115 hit= 840 net=   -875 roi=   -2.8% hr= 18.9% avgBet=7.0 dd= 1631 pos=19/55 gini=0.502 top10=63.8%` | 全前缀主热区与桌第一热区中心距离<=2，打7邻。 |
| resonance-r120-sector7-d2 | resonance | `sig= 2297 bet= 16079 hit= 446 net=    -23 roi=   -0.1% hr= 19.4% avgBet=7.0 dd=  703 pos=19/45 gini=0.414 top10=64.7%` | 最近120口主热区与桌第一热区中心距离<=2，打7邻。 |
| resonance-r80-sector5-d2 | resonance | `sig= 2045 bet= 10225 hit= 282 net=    -73 roi=   -0.7% hr= 13.8% avgBet=5.0 dd=  646 pos=18/50 gini=0.541 top10=62.8%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| resonance-double-sector7-d2 | resonance | `sig= 1631 bet= 11417 hit= 316 net=    -41 roi=   -0.4% hr= 19.4% avgBet=7.0 dd=  841 pos=14/38 gini=0.495 top10=71.1%` | 全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。 |
| resonance-top2-r120-sector5-d2 | resonance | `sig= 3406 bet= 17030 hit= 461 net=   -434 roi=   -2.5% hr= 13.5% avgBet=5.0 dd=  901 pos=20/52 gini=0.476 top10=57.0%` | 最近120口主热区贴近桌前二热区之一，打该桌热区中心5邻。 |
| intersection-profile7-r120-7 | resonance | `sig= 3494 bet= 17502 hit= 488 net=     66 roi=    0.4% hr= 14.0% avgBet=5.0 dd=  849 pos=19/55 gini=0.542 top10=53.7%` | 桌第一热区7邻与最近120口主热区7邻交集>=3，只打交集。 |
| tablehot-cold-r80-sector7 | reversion | `sig= 1659 bet= 11613 hit= 314 net=   -309 roi=   -2.7% hr= 18.9% avgBet=7.0 dd=  899 pos=25/41 gini=0.508 top10=66.9%` | 桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。 |
| tablehot-cold-r120-sector7 | reversion | `sig= 1382 bet=  9674 hit= 269 net=     10 roi=    0.1% hr= 19.5% avgBet=7.0 dd=  687 pos=19/35 gini=0.486 top10=73.8%` | 桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。 |
| tablehot-missing20-sector5 | reversion | `sig=   77 bet=   385 hit=  15 net=    155 roi=   40.3% hr= 19.5% avgBet=5.0 dd=   83 pos=10/15 gini=0.249 top10=85.7%` | 桌第一热区20口未出，打中心5邻。 |
| num-top1-z1 | table-number | `sig= 8259 bet=  8259 hit= 211 net=   -663 roi=   -8.0% hr=  2.6% avgBet=1.0 dd= 1005 pos=23/64 gini=0.502 top10=53.3%` | 桌历史最高频单号，单号z>=1。 |
| num-top3-z1 | table-number | `sig= 8259 bet= 24327 hit= 661 net=   -531 roi=   -2.2% hr=  8.0% avgBet=2.9 dd=  824 pos=23/64 gini=0.545 top10=53.3%` | 桌历史高频前三，单号z>=1。 |
| num-top5-z05 | table-number | `sig= 8259 bet= 41295 hit=1109 net=  -1371 roi=   -3.3% hr= 13.4% avgBet=5.0 dd= 1904 pos=24/64 gini=0.449 top10=53.3%` | 桌历史高频前五，单号z>=0.5。 |
| num-top3-recent37-support | table-number | `sig= 7950 bet= 16999 hit= 444 net=  -1015 roi=   -6.0% hr=  5.6% avgBet=2.1 dd= 1181 pos=22/64 gini=0.489 top10=52.8%` | 桌历史前三单号，且最近37口出现过。 |
| num-top5-missing37 | table-number | `sig= 7213 bet= 13774 hit= 378 net=   -166 roi=   -1.2% hr=  5.2% avgBet=1.9 dd=  988 pos=28/63 gini=0.533 top10=53.4%` | 桌历史前五单号，最近37口未出，均值回补。 |
| num-intersect-table10-recent74-10 | table-number | `sig= 8151 bet= 24000 hit= 629 net=  -1356 roi=   -5.7% hr=  7.7% avgBet=2.9 dd= 1681 pos=21/64 gini=0.554 top10=53.6%` | 桌历史前10单号与最近74口前10单号交集。 |
| offset-top1-min500-lift12 | transition | `sig= 6691 bet=  6691 hit= 182 net=   -139 roi=   -2.1% hr=  2.7% avgBet=1.0 dd=  461 pos=26/55 gini=0.519 top10=54.6%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |
| offset-top3-min500-lift11 | transition | `sig= 6782 bet= 20346 hit= 518 net=  -1698 roi=   -8.3% hr=  7.6% avgBet=3.0 dd= 2064 pos=22/55 gini=0.494 top10=53.8%` | 桌内下一口轮盘偏移前三，转移样本>=500，lift>=1.1。 |
| offset-top5-min500 | transition | `sig= 6782 bet= 33910 hit= 880 net=  -2230 roi=   -6.6% hr= 13.0% avgBet=5.0 dd= 2859 pos=23/55 gini=0.528 top10=53.8%` | 桌内下一口轮盘偏移前五，转移样本>=500。 |
| offset-top3-large-profile | transition | `sig= 5522 bet= 16566 hit= 423 net=  -1338 roi=   -8.1% hr=  7.7% avgBet=3.0 dd= 1563 pos=19/51 gini=0.505 top10=54.9%` | 大样本桌画像的轮盘偏移前三，lift>=1.05。 |

### Latest 10 Sessions, Top By Net
| method | group | summary | description |
|---|---|---:|---|
| intersection-profile7-r120-7 | resonance | `sig= 1054 bet=  5486 hit= 168 net=    562 roi=   10.2% hr= 15.9% avgBet=5.2 dd=  268 pos= 5/9  gini=0.555 top10=100.0%` | 桌第一热区7邻与最近120口主热区7邻交集>=3，只打交集。 |
| resonance-r120-sector7-d2 | resonance | `sig=  713 bet=  4991 hit= 151 net=    445 roi=    8.9% hr= 21.2% avgBet=7.0 dd=  375 pos= 6/9  gini=0.419 top10=100.0%` | 最近120口主热区与桌第一热区中心距离<=2，打7邻。 |
| resonance-double-sector7-d2 | resonance | `sig=  660 bet=  4620 hit= 140 net=    420 roi=    9.1% hr= 21.2% avgBet=7.0 dd=  312 pos= 6/8  gini=0.512 top10=100.0%` | 全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。 |
| resonance-r80-sector5-d2 | resonance | `sig=  643 bet=  3215 hit=  95 net=    205 roi=    6.4% hr= 14.8% avgBet=5.0 dd=  305 pos= 5/10 gini=0.505 top10=100.0%` | 最近80口主热区与桌第一热区中心距离<=2，打中心5邻。 |
| resonance-all-sector7-d2 | resonance | `sig= 1905 bet= 13335 hit= 375 net=    165 roi=    1.2% hr= 19.7% avgBet=7.0 dd=  561 pos= 5/10 gini=0.487 top10=100.0%` | 全前缀主热区与桌第一热区中心距离<=2，打7邻。 |
| tablehot-cold-r120-sector7 | reversion | `sig=  440 bet=  3080 hit=  90 net=    160 roi=    5.2% hr= 20.5% avgBet=7.0 dd=  328 pos= 3/7  gini=0.468 top10=100.0%` | 桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。 |
| resonance-top2-r120-sector5-d2 | resonance | `sig= 1115 bet=  5575 hit= 159 net=    149 roi=    2.7% hr= 14.3% avgBet=5.0 dd=  561 pos= 5/9  gini=0.441 top10=100.0%` | 最近120口主热区贴近桌前二热区之一，打该桌热区中心5邻。 |
| tablehot-missing20-sector5 | reversion | `sig=   25 bet=   125 hit=   7 net=    127 roi=  101.6% hr= 28.0% avgBet=5.0 dd=   40 pos= 5/5  gini=0.246 top10=100.0%` | 桌第一热区20口未出，打中心5邻。 |
| offset-top1-min500-lift12 | transition | `sig= 2102 bet=  2102 hit=  61 net=     94 roi=    4.5% hr=  2.9% avgBet=1.0 dd=  315 pos= 5/9  gini=0.426 top10=100.0%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |
| num-top5-missing37 | table-number | `sig= 2361 bet=  4630 hit= 131 net=     86 roi=    1.9% hr=  5.5% avgBet=2.0 dd=  368 pos= 5/10 gini=0.488 top10=100.0%` | 桌历史前五单号，最近37口未出，均值回补。 |
| tablehot-cold-r80-sector7 | reversion | `sig=  556 bet=  3892 hit= 107 net=    -40 roi=   -1.0% hr= 19.2% avgBet=7.0 dd=  459 pos= 4/7  gini=0.279 top10=100.0%` | 桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。 |
| num-top1-z1 | table-number | `sig= 2656 bet=  2656 hit=  72 net=    -64 roi=   -2.4% hr=  2.7% avgBet=1.0 dd=  297 pos= 5/10 gini=0.486 top10=100.0%` | 桌历史最高频单号，单号z>=1。 |

### Best Method By Group
| method | group | summary | description |
|---|---|---:|---|
| sector3-top1-z1 | profile-sector | `sig= 8082 bet= 24246 hit= 649 net=   -882 roi=   -3.6% hr=  8.0% avgBet=3.0 dd= 1116 pos=23/64 gini=0.486 top10=53.8%` | 桌画像第一热区中心3邻，z>=1。 |
| intersection-profile7-r120-7 | resonance | `sig= 3494 bet= 17502 hit= 488 net=     66 roi=    0.4% hr= 14.0% avgBet=5.0 dd=  849 pos=19/55 gini=0.542 top10=53.7%` | 桌第一热区7邻与最近120口主热区7邻交集>=3，只打交集。 |
| tablehot-missing20-sector5 | reversion | `sig=   77 bet=   385 hit=  15 net=    155 roi=   40.3% hr= 19.5% avgBet=5.0 dd=   83 pos=10/15 gini=0.249 top10=85.7%` | 桌第一热区20口未出，打中心5邻。 |
| num-top5-missing37 | table-number | `sig= 7213 bet= 13774 hit= 378 net=   -166 roi=   -1.2% hr=  5.2% avgBet=1.9 dd=  988 pos=28/63 gini=0.533 top10=53.4%` | 桌历史前五单号，最近37口未出，均值回补。 |
| offset-top1-min500-lift12 | transition | `sig= 6691 bet=  6691 hit= 182 net=   -139 roi=   -2.1% hr=  2.7% avgBet=1.0 dd=  461 pos=26/55 gini=0.519 top10=54.6%` | 桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。 |

### Adaptive No-Future Meta-Gates
| method | group | summary | description |
|---|---|---:|---|
| meta-table-beats-house-cap12 | adaptive | `sig= 3871 bet= 35202 hit= 966 net=   -426 roi=   -1.2% hr= 25.0% avgBet=9.1 dd= 1586 pos=21/47 gini=0.524 top10=63.4%` | Enable methods better than -1% on the same auto table/profile, min prior table-method bet 250. |
| meta-resonance-global-positive-cap10 | adaptive | `sig= 2263 bet= 13135 hit= 346 net=   -679 roi=   -5.2% hr= 15.3% avgBet=5.8 dd= 1259 pos=14/46 gini=0.479 top10=65.7%` | Only resonance methods with positive prior method ROI, min prior bet 300, merged candidates <=10. |
| meta-table-positive-cap12 | adaptive | `sig= 4182 bet= 37191 hit=1010 net=   -831 roi=   -2.2% hr= 24.2% avgBet=8.9 dd= 1854 pos=19/51 gini=0.519 top10=63.5%` | Enable methods positive on the same auto table/profile, min prior table-method bet 150. |
| meta-resonance-group-beats-house-cap12 | adaptive | `sig= 1230 bet=  8068 hit= 194 net=  -1084 roi=  -13.4% hr= 15.8% avgBet=6.6 dd= 1310 pos= 5/32 gini=0.452 top10=64.6%` | Only resonance methods while the resonance group is better than -1% live, min prior group bet 1000. |
| meta-global-positive-cap12 | adaptive | `sig= 2795 bet= 19654 hit= 512 net=  -1222 roi=   -6.2% hr= 18.3% avgBet=7.0 dd= 1547 pos=13/40 gini=0.530 top10=67.4%` | Enable methods whose own prior live ROI is positive, min prior bet 500, merged candidates <=12. |
| meta-table-positive-session-stop-cap12 | adaptive | `sig= 4999 bet= 40850 hit=1095 net=  -1430 roi=   -3.5% hr= 21.9% avgBet=8.2 dd= 2233 pos=19/54 gini=0.494 top10=63.2%` | Same-table positive method, but stop that method for the current session after live session net <= -72. |
| meta-global-beats-house-cap12 | adaptive | `sig= 3514 bet= 23416 hit= 610 net=  -1456 roi=   -6.2% hr= 17.4% avgBet=6.7 dd= 2098 pos=16/38 gini=0.552 top10=73.0%` | Enable methods whose prior live ROI is better than -1%, min prior bet 1000, merged candidates <=12. |
| meta-venue-positive-session-stop-cap12 | adaptive | `sig= 4972 bet= 38746 hit=1024 net=  -1882 roi=   -4.9% hr= 20.6% avgBet=7.8 dd= 2719 pos=22/54 gini=0.539 top10=63.3%` | Same-venue positive method, but stop that method for the current session after live session net <= -72. |
| meta-consensus2-cap12 | adaptive | `sig= 4394 bet= 32851 hit= 858 net=  -1963 roi=   -6.0% hr= 19.5% avgBet=7.5 dd= 2305 pos=18/50 gini=0.531 top10=67.6%` | Enable methods only when at least two of global/table/venue prior records are positive. |
| meta-venue-positive-cap12 | adaptive | `sig= 4659 bet= 38300 hit=1008 net=  -2012 roi=   -5.3% hr= 21.6% avgBet=8.2 dd= 2834 pos=17/49 gini=0.554 top10=66.9%` | Enable methods positive in the same inferred venue, min prior venue-method bet 250. |

### Latest 10 Sessions, Adaptive Meta-Gates
| method | group | summary | description |
|---|---|---:|---|
| meta-table-beats-house-cap12 | adaptive | `sig= 1415 bet= 12101 hit= 332 net=   -149 roi=   -1.2% hr= 23.5% avgBet=8.6 dd=  544 pos= 4/9  gini=0.492 top10=100.0%` | Enable methods better than -1% on the same auto table/profile, min prior table-method bet 250. |
| meta-resonance-group-beats-house-cap12 | adaptive | `sig=  232 bet=  1579 hit=  38 net=   -211 roi=  -13.4% hr= 16.4% avgBet=6.8 dd=  300 pos= 1/4  gini=0.238 top10=100.0%` | Only resonance methods while the resonance group is better than -1% live, min prior group bet 1000. |
| meta-resonance-global-positive-cap10 | adaptive | `sig=  730 bet=  3711 hit=  94 net=   -327 roi=   -8.8% hr= 12.9% avgBet=5.1 dd=  433 pos= 1/7  gini=0.375 top10=100.0%` | Only resonance methods with positive prior method ROI, min prior bet 300, merged candidates <=10. |
| meta-global-positive-cap12 | adaptive | `sig= 1181 bet=  4988 hit= 124 net=   -524 roi=  -10.5% hr= 10.5% avgBet=4.2 dd=  524 pos= 3/10 gini=0.405 top10=100.0%` | Enable methods whose own prior live ROI is positive, min prior bet 500, merged candidates <=12. |
| meta-table-positive-cap12 | adaptive | `sig= 1547 bet= 12997 hit= 346 net=   -541 roi=   -4.2% hr= 22.4% avgBet=8.4 dd=  949 pos= 2/9  gini=0.420 top10=100.0%` | Enable methods positive on the same auto table/profile, min prior table-method bet 150. |
| meta-consensus2-cap12 | adaptive | `sig= 2258 bet= 15000 hit= 398 net=   -672 roi=   -4.5% hr= 17.6% avgBet=6.6 dd= 1204 pos= 3/10 gini=0.513 top10=100.0%` | Enable methods only when at least two of global/table/venue prior records are positive. |
| meta-global-beats-house-cap12 | adaptive | `sig= 2066 bet=  9791 hit= 250 net=   -791 roi=   -8.1% hr= 12.1% avgBet=4.7 dd= 1064 pos= 4/10 gini=0.451 top10=100.0%` | Enable methods whose prior live ROI is better than -1%, min prior bet 1000, merged candidates <=12. |
| meta-venue-positive-session-stop-cap12 | adaptive | `sig= 2292 bet= 18283 hit= 479 net=  -1039 roi=   -5.7% hr= 20.9% avgBet=8.0 dd= 1587 pos= 4/10 gini=0.469 top10=100.0%` | Same-venue positive method, but stop that method for the current session after live session net <= -72. |
| meta-table-positive-session-stop-cap12 | adaptive | `sig= 1980 bet= 15415 hit= 398 net=  -1087 roi=   -7.1% hr= 20.1% avgBet=7.8 dd= 1463 pos= 3/10 gini=0.427 top10=100.0%` | Same-table positive method, but stop that method for the current session after live session net <= -72. |
| meta-venue-positive-cap12 | adaptive | `sig= 2339 bet= 19478 hit= 506 net=  -1262 roi=   -6.5% hr= 21.6% avgBet=8.3 dd= 1815 pos= 3/10 gini=0.551 top10=100.0%` | Enable methods positive in the same inferred venue, min prior venue-method bet 250. |

## Cross-Dataset Robustness
| method | group | data_2026.6.11 | history_data | note |
|---|---|---:|---:|---|
| sector7-top1-z0 | profile-sector | `sig= 9733 bet= 68131 hit=1790 net=  -3691 roi=   -5.4% hr= 18.4% avgBet=7.0 dd= 3807 pos=32/78 gini=0.490 top10=43.8%` | `sig= 8259 bet= 57813 hit=1549 net=  -2049 roi=   -3.5% hr= 18.8% avgBet=7.0 dd= 3150 pos=23/64 gini=0.532 top10=53.3%` | mixed/negative |
| sector7-top1-z1 | profile-sector | `sig= 9491 bet= 66437 hit=1732 net=  -4085 roi=   -6.1% hr= 18.2% avgBet=7.0 dd= 4201 pos=31/78 gini=0.485 top10=44.9%` | `sig= 8082 bet= 56574 hit=1503 net=  -2466 roi=   -4.4% hr= 18.6% avgBet=7.0 dd= 3567 pos=22/64 gini=0.528 top10=53.8%` | mixed/negative |
| sector5-top1-z1 | profile-sector | `sig= 9491 bet= 47455 hit=1250 net=  -2455 roi=   -5.2% hr= 13.2% avgBet=5.0 dd= 2673 pos=32/78 gini=0.461 top10=44.9%` | `sig= 8082 bet= 40410 hit=1084 net=  -1386 roi=   -3.4% hr= 13.4% avgBet=5.0 dd= 2109 pos=23/64 gini=0.524 top10=53.8%` | mixed/negative |
| sector3-top1-z1 | profile-sector | `sig= 9491 bet= 28473 hit= 732 net=  -2121 roi=   -7.4% hr=  7.7% avgBet=3.0 dd= 2625 pos=31/78 gini=0.480 top10=44.9%` | `sig= 8082 bet= 24246 hit= 649 net=   -882 roi=   -3.6% hr=  8.0% avgBet=3.0 dd= 1116 pos=23/64 gini=0.486 top10=53.8%` | mixed/negative |
| sector7-top2-z1 | profile-sector | `sig= 9491 bet=106498 hit=2812 net=  -5266 roi=   -4.9% hr= 29.6% avgBet=11.2 dd= 5382 pos=28/78 gini=0.520 top10=44.9%` | `sig= 8082 bet= 84952 hit=2284 net=  -2728 roi=   -3.2% hr= 28.3% avgBet=10.5 dd= 3509 pos=23/64 gini=0.516 top10=53.8%` | mixed/negative |
| sector7-top1-large-profile | profile-sector | `sig= 6941 bet= 48587 hit=1259 net=  -3263 roi=   -6.7% hr= 18.1% avgBet=7.0 dd= 3447 pos=27/66 gini=0.443 top10=50.6%` | `sig= 5522 bet= 38654 hit=1003 net=  -2546 roi=   -6.6% hr= 18.2% avgBet=7.0 dd= 3691 pos=17/51 gini=0.522 top10=54.9%` | mixed/negative |
| resonance-all-sector7-d2 | resonance | `sig= 5165 bet= 36155 hit= 974 net=  -1091 roi=   -3.0% hr= 18.9% avgBet=7.0 dd= 1260 pos=27/64 gini=0.522 top10=61.1%` | `sig= 4445 bet= 31115 hit= 840 net=   -875 roi=   -2.8% hr= 18.9% avgBet=7.0 dd= 1631 pos=19/55 gini=0.502 top10=63.8%` | mixed/negative |
| resonance-r120-sector7-d2 | resonance | `sig= 2510 bet= 17570 hit= 452 net=  -1298 roi=   -7.4% hr= 18.0% avgBet=7.0 dd= 1952 pos=18/62 gini=0.531 top10=55.8%` | `sig= 2297 bet= 16079 hit= 446 net=    -23 roi=   -0.1% hr= 19.4% avgBet=7.0 dd=  703 pos=19/45 gini=0.414 top10=64.7%` | mixed/negative |
| resonance-r80-sector5-d2 | resonance | `sig= 2102 bet= 10510 hit= 277 net=   -538 roi=   -5.1% hr= 13.2% avgBet=5.0 dd=  875 pos=25/62 gini=0.477 top10=54.7%` | `sig= 2045 bet= 10225 hit= 282 net=    -73 roi=   -0.7% hr= 13.8% avgBet=5.0 dd=  646 pos=18/50 gini=0.541 top10=62.8%` | mixed/negative |
| resonance-double-sector7-d2 | resonance | `sig= 1892 bet= 13244 hit= 348 net=   -716 roi=   -5.4% hr= 18.4% avgBet=7.0 dd= 1320 pos=17/53 gini=0.496 top10=64.2%` | `sig= 1631 bet= 11417 hit= 316 net=    -41 roi=   -0.4% hr= 19.4% avgBet=7.0 dd=  841 pos=14/38 gini=0.495 top10=71.1%` | mixed/negative |
| resonance-top2-r120-sector5-d2 | resonance | `sig= 3519 bet= 17595 hit= 463 net=   -927 roi=   -5.3% hr= 13.2% avgBet=5.0 dd= 1143 pos=24/69 gini=0.523 top10=49.1%` | `sig= 3406 bet= 17030 hit= 461 net=   -434 roi=   -2.5% hr= 13.5% avgBet=5.0 dd=  901 pos=20/52 gini=0.476 top10=57.0%` | mixed/negative |
| intersection-profile7-r120-7 | resonance | `sig= 3977 bet= 19455 hit= 501 net=  -1419 roi=   -7.3% hr= 12.6% avgBet=4.9 dd= 2099 pos=21/70 gini=0.497 top10=48.9%` | `sig= 3494 bet= 17502 hit= 488 net=     66 roi=    0.4% hr= 14.0% avgBet=5.0 dd=  849 pos=19/55 gini=0.542 top10=53.7%` | mixed/negative |
| tablehot-cold-r80-sector7 | reversion | `sig= 1714 bet= 11998 hit= 320 net=   -478 roi=   -4.0% hr= 18.7% avgBet=7.0 dd=  780 pos=24/51 gini=0.501 top10=59.5%` | `sig= 1659 bet= 11613 hit= 314 net=   -309 roi=   -2.7% hr= 18.9% avgBet=7.0 dd=  899 pos=25/41 gini=0.508 top10=66.9%` | mixed/negative |
| tablehot-cold-r120-sector7 | reversion | `sig= 1239 bet=  8673 hit= 239 net=    -69 roi=   -0.8% hr= 19.3% avgBet=7.0 dd=  372 pos=23/42 gini=0.477 top10=70.0%` | `sig= 1382 bet=  9674 hit= 269 net=     10 roi=    0.1% hr= 19.5% avgBet=7.0 dd=  687 pos=19/35 gini=0.486 top10=73.8%` | mixed/negative |
| tablehot-missing20-sector5 | reversion | `sig=   66 bet=   330 hit=   8 net=    -42 roi=  -12.7% hr= 12.1% avgBet=5.0 dd=  155 pos= 7/13 gini=0.230 top10=90.9%` | `sig=   77 bet=   385 hit=  15 net=    155 roi=   40.3% hr= 19.5% avgBet=5.0 dd=   83 pos=10/15 gini=0.249 top10=85.7%` | mixed/negative |
| num-top1-z1 | table-number | `sig= 9733 bet=  9733 hit= 276 net=    203 roi=    2.1% hr=  2.8% avgBet=1.0 dd=  577 pos=32/78 gini=0.447 top10=43.8%` | `sig= 8259 bet=  8259 hit= 211 net=   -663 roi=   -8.0% hr=  2.6% avgBet=1.0 dd= 1005 pos=23/64 gini=0.502 top10=53.3%` | mixed/negative |
| num-top3-z1 | table-number | `sig= 9733 bet= 29199 hit= 799 net=   -435 roi=   -1.5% hr=  8.2% avgBet=3.0 dd= 1089 pos=35/78 gini=0.495 top10=43.8%` | `sig= 8259 bet= 24327 hit= 661 net=   -531 roi=   -2.2% hr=  8.0% avgBet=2.9 dd=  824 pos=23/64 gini=0.545 top10=53.3%` | mixed/negative |
| num-top5-z05 | table-number | `sig= 9733 bet= 48665 hit=1289 net=  -2261 roi=   -4.6% hr= 13.2% avgBet=5.0 dd= 2969 pos=32/78 gini=0.535 top10=43.8%` | `sig= 8259 bet= 41295 hit=1109 net=  -1371 roi=   -3.3% hr= 13.4% avgBet=5.0 dd= 1904 pos=24/64 gini=0.449 top10=53.3%` | mixed/negative |
| num-top3-recent37-support | table-number | `sig= 9446 bet= 19909 hit= 538 net=   -541 roi=   -2.7% hr=  5.7% avgBet=2.1 dd= 1172 pos=34/78 gini=0.486 top10=43.7%` | `sig= 7950 bet= 16999 hit= 444 net=  -1015 roi=   -6.0% hr=  5.6% avgBet=2.1 dd= 1181 pos=22/64 gini=0.489 top10=52.8%` | mixed/negative |
| num-top5-missing37 | table-number | `sig= 8429 bet= 16097 hit= 422 net=   -905 roi=   -5.6% hr=  5.0% avgBet=1.9 dd= 1507 pos=32/76 gini=0.512 top10=45.5%` | `sig= 7213 bet= 13774 hit= 378 net=   -166 roi=   -1.2% hr=  5.2% avgBet=1.9 dd=  988 pos=28/63 gini=0.533 top10=53.4%` | mixed/negative |
| num-intersect-table10-recent74-10 | table-number | `sig= 9607 bet= 30186 hit= 760 net=  -2826 roi=   -9.4% hr=  7.9% avgBet=3.1 dd= 3117 pos=25/78 gini=0.524 top10=44.0%` | `sig= 8151 bet= 24000 hit= 629 net=  -1356 roi=   -5.7% hr=  7.7% avgBet=2.9 dd= 1681 pos=21/64 gini=0.554 top10=53.6%` | mixed/negative |
| offset-top1-min500-lift12 | transition | `sig= 7224 bet=  7224 hit= 201 net=     12 roi=    0.2% hr=  2.8% avgBet=1.0 dd=  473 pos=36/72 gini=0.466 top10=46.8%` | `sig= 6691 bet=  6691 hit= 182 net=   -139 roi=   -2.1% hr=  2.7% avgBet=1.0 dd=  461 pos=26/55 gini=0.519 top10=54.6%` | mixed/negative |
| offset-top3-min500-lift11 | transition | `sig= 7999 bet= 23997 hit= 649 net=   -633 roi=   -2.6% hr=  8.1% avgBet=3.0 dd= 1470 pos=29/72 gini=0.486 top10=47.0%` | `sig= 6782 bet= 20346 hit= 518 net=  -1698 roi=   -8.3% hr=  7.6% avgBet=3.0 dd= 2064 pos=22/55 gini=0.494 top10=53.8%` | mixed/negative |
| offset-top5-min500 | transition | `sig= 7999 bet= 39995 hit=1102 net=   -323 roi=   -0.8% hr= 13.8% avgBet=5.0 dd= 1820 pos=33/72 gini=0.456 top10=47.0%` | `sig= 6782 bet= 33910 hit= 880 net=  -2230 roi=   -6.6% hr= 13.0% avgBet=5.0 dd= 2859 pos=23/55 gini=0.528 top10=53.8%` | mixed/negative |
| offset-top3-large-profile | transition | `sig= 6941 bet= 20823 hit= 555 net=   -843 roi=   -4.0% hr=  8.0% avgBet=3.0 dd= 1443 pos=25/66 gini=0.504 top10=50.6%` | `sig= 5522 bet= 16566 hit= 423 net=  -1338 roi=   -8.1% hr=  7.7% avgBet=3.0 dd= 1563 pos=19/51 gini=0.505 top10=54.9%` | mixed/negative |

## Cross-Dataset Adaptive Robustness
| rule | data_2026.6.11 | history_data | note |
|---|---:|---:|---|
| meta-global-positive-cap12 | `sig= 9148 bet= 56314 hit=1512 net=  -1882 roi=   -3.3% hr= 16.5% avgBet=6.2 dd= 2437 pos=34/75 gini=0.490 top10=44.9%` | `sig= 2795 bet= 19654 hit= 512 net=  -1222 roi=   -6.2% hr= 18.3% avgBet=7.0 dd= 1547 pos=13/40 gini=0.530 top10=67.4%` | mixed/negative |
| meta-global-beats-house-cap12 | `sig= 9003 bet= 65671 hit=1755 net=  -2491 roi=   -3.8% hr= 19.5% avgBet=7.3 dd= 2874 pos=30/74 gini=0.532 top10=46.9%` | `sig= 3514 bet= 23416 hit= 610 net=  -1456 roi=   -6.2% hr= 17.4% avgBet=6.7 dd= 2098 pos=16/38 gini=0.552 top10=73.0%` | mixed/negative |
| meta-table-positive-cap12 | `sig= 6544 bet= 56327 hit=1487 net=  -2795 roi=   -5.0% hr= 22.7% avgBet=8.6 dd= 3201 pos=24/74 gini=0.513 top10=45.6%` | `sig= 4182 bet= 37191 hit=1010 net=   -831 roi=   -2.2% hr= 24.2% avgBet=8.9 dd= 1854 pos=19/51 gini=0.519 top10=63.5%` | mixed/negative |
| meta-table-beats-house-cap12 | `sig= 5937 bet= 52206 hit=1393 net=  -2058 roi=   -3.9% hr= 23.5% avgBet=8.8 dd= 2602 pos=26/73 gini=0.513 top10=45.4%` | `sig= 3871 bet= 35202 hit= 966 net=   -426 roi=   -1.2% hr= 25.0% avgBet=9.1 dd= 1586 pos=21/47 gini=0.524 top10=63.4%` | mixed/negative |
| meta-venue-positive-cap12 | `sig= 7331 bet= 49909 hit=1306 net=  -2893 roi=   -5.8% hr= 17.8% avgBet=6.8 dd= 3170 pos=22/69 gini=0.585 top10=48.9%` | `sig= 4659 bet= 38300 hit=1008 net=  -2012 roi=   -5.3% hr= 21.6% avgBet=8.2 dd= 2834 pos=17/49 gini=0.554 top10=66.9%` | mixed/negative |
| meta-consensus2-cap12 | `sig= 7899 bet= 49587 hit=1315 net=  -2247 roi=   -4.5% hr= 16.6% avgBet=6.3 dd= 2457 pos=28/76 gini=0.511 top10=46.8%` | `sig= 4394 bet= 32851 hit= 858 net=  -1963 roi=   -6.0% hr= 19.5% avgBet=7.5 dd= 2305 pos=18/50 gini=0.531 top10=67.6%` | mixed/negative |
| meta-resonance-global-positive-cap10 | `sig=  666 bet=  3582 hit=  76 net=   -846 roi=  -23.6% hr= 11.4% avgBet=5.4 dd=  858 pos= 8/29 gini=0.481 top10=67.3%` | `sig= 2263 bet= 13135 hit= 346 net=   -679 roi=   -5.2% hr= 15.3% avgBet=5.8 dd= 1259 pos=14/46 gini=0.479 top10=65.7%` | mixed/negative |
| meta-resonance-group-beats-house-cap12 | `sig=   27 bet=   167 hit=   0 net=   -167 roi= -100.0% hr=  0.0% avgBet=6.2 dd=  167 pos= 0/3  gini=0.303 top10=100.0%` | `sig= 1230 bet=  8068 hit= 194 net=  -1084 roi=  -13.4% hr= 15.8% avgBet=6.6 dd= 1310 pos= 5/32 gini=0.452 top10=64.6%` | mixed/negative |
| meta-table-positive-session-stop-cap12 | `sig= 6816 bet= 54387 hit=1432 net=  -2835 roi=   -5.2% hr= 21.0% avgBet=8.0 dd= 3410 pos=26/75 gini=0.514 top10=46.7%` | `sig= 4999 bet= 40850 hit=1095 net=  -1430 roi=   -3.5% hr= 21.9% avgBet=8.2 dd= 2233 pos=19/54 gini=0.494 top10=63.2%` | mixed/negative |
| meta-venue-positive-session-stop-cap12 | `sig= 7127 bet= 44300 hit=1141 net=  -3224 roi=   -7.3% hr= 16.0% avgBet=6.2 dd= 3500 pos=23/69 gini=0.577 top10=49.0%` | `sig= 4972 bet= 38746 hit=1024 net=  -1882 roi=   -4.9% hr= 20.6% avgBet=7.8 dd= 2719 pos=22/54 gini=0.539 top10=63.3%` | mixed/negative |
