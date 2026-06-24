# 桌画像 + 当前局短窗共振专项研究报告

本报告是 `table-resonance-deep-dive.md` 的中文结论版。原始完整参数表保留在 `scripts/output/table-resonance-deep-dive.md`。

## 回测口径

- 数据：
  - `HistoryData/data_2026.6.11.json`：133 局，33597 口。
  - `HistoryData/history_data.json`：76 局，24812 口。
- 规则数量：6030 条共振规则。
- ROI：每局 index >= 200 后计押注区。
- 不偷看未来：
  - 第 N 局只用第 1 到 N-1 局构建自动桌画像和 TableProfile。
  - 当前局每一口只用该口之前的号码前缀。
- 本轮故意排除：
  - raw 桌画像热区直接押。
  - 自适应元筛选。
  - 桌历史最高频单号。

## 测试维度

- 当前局短窗：60、80、100、120、160、200。
- 共振距离：桌画像热区中心与当前短窗热区中心距离 0、1、2、3、4。
- 候选打法：
  - 桌画像中心 3/5/7 邻。
  - 当前短窗中心 3/5/7 邻。
  - 两个 7 邻交集。
  - 两个中心号。
  - 两个 7 邻并集，最多 12 码。
- z 阈值：
  - 桌画像热区 z >= 0、0.5、1。
  - 当前短窗热区 z >= 0、0.5、1、1.5。
- 自动归桌可信度：
  - probable+：confirmed 或 probable。
  - confirmed only。
- profile 样本量：
  - any。
  - large：>=3 局且 >=500 口。
  - mature：>=5 局且 >=1000 口。
- double resonance：
  - 当前短窗贴近桌画像。
  - 同时全前缀主热区也贴近桌画像。

## 最重要发现

### 1. 核心不是“距离<=2”，而是“中心完全重合”

跨两个数据的全量 Top 30 里：

- window：60 出现 16 次，160 出现 14 次。
- distance：30/30 都是 0。
- doubleAll：30/30 都是 false。
- assignment：30/30 都是 probable+。
- profileTier：30/30 都是 any。

这说明当前最有效的共振不是“差不多贴近”，而是桌画像热区中心和当前短窗热区中心完全重合。

代表规则：

- `w60-d0-profile5-pz1-rz15-one-prob-any`
  - data：217 信号，ROI +22.8%，pos 13/27。
  - history：248 信号，ROI +16.1%，pos 8/17。
  - 问题：top10 为 75.1% / 95.2%，集中度很高。

- `w160-d0-profile3-pz1-rz0-one-prob-any`
  - data：540 信号，ROI +15.6%，pos 7/22。
  - history：521 信号，ROI +31.3%，pos 9/20。
  - 问题：top10 为 87.6% / 91.0%，更集中。

结论：这类可以作为“强观察”方向，但不能直接当稳定押注规则，因为收益集中在少数局。

## 120 口共振

120 口窗口是最值得继续做产品观察层的方向，因为它兼顾近期性和样本量。

全量跨数据最好的 120 规则：

- `w120-d1-recent3-pz1-rz15-one-prob-any`
  - 条件：120 口热区中心与桌画像中心距离 <=1；桌画像 z>=1；120 口 z>=1.5；打当前 120 口中心 3 邻。
  - data：949 信号，ROI +12.5%，pos 18/41，top10 65.6%。
  - history：950 信号，ROI +7.4%，pos 11/25，top10 79.5%。

更宽一点的版本：

- `w120-d2-recent3-pz1-rz15-one-prob-any`
  - data：1865 信号，ROI +4.2%，pos 22/57，top10 59.7%。
  - history：1747 信号，ROI +7.8%，pos 16/38，top10 68.6%。

最近 10 组里，120 口更强：

- `w120-d1-recent3-pz1-rz15-one-prob-any`
  - data 最近 10：292 信号，ROI +23.3%，pos 4/8。
  - history 最近 10：348 信号，ROI +31.0%，pos 5/6。

- `w120-d1-profile3-pz1-rz15-one-prob-any`
  - data 最近 10：292 信号，ROI +19.2%。
  - history 最近 10：348 信号，ROI +34.5%。

结论：120 口共振建议继续保留为第一候选。产品层可以先显示为“观察/提示”，文案上强调“桌画像与 120 口短窗同向”，不要写成“强押”。

## Double Resonance

double resonance 全量并不强。

全量最好的 double 规则：

- `w120-d2-profile5-pz0-rz05-dbl-prob-mature`
  - data：850 信号，ROI +3.3%。
  - history：542 信号，ROI +1.0%。
  - minROI 只有 +1.0%。

其他 double 规则大多在打平附近或转负。

最近 10 组里 double 有短期强表现：

- `w80-d1-recent5-pz0-rz05-dbl-prob-any`
  - data 最近 10：230 信号，ROI +12.7%。
  - history 最近 10：202 信号，ROI +14.1%。

- `w120-d2-profile7-pz0-rz15-dbl-conf-any`
  - data 最近 10：144 信号，ROI +14.3%。
  - history 最近 10：60 信号，ROI +11.4%。

结论：double resonance 不适合作为全量规则，但可以作为“当前 regime 加强证据”。也就是说，它更适合给 120/80 共振卡片加一个小标记，而不是自己单独出信号。

## 交集打法

交集打法在“中心完全重合”时其实等价于 7 邻打法，因为两个 7 邻几乎完全重合，所以全量看起来很强但候选偏宽。

全量交集代表：

- `w160-d0-intersect3-pz0-rz0-one-prob-any`
  - data：588 信号，ROI +11.1%，hit rate 21.6%，avgBet 7.0。
  - history：538 信号，ROI +12.8%，hit rate 21.9%，avgBet 7.0。

最近 10 组：

- `w160-d0-intersect3...`
  - data 最近 10：ROI +18.4%。
  - history 最近 10：ROI +23.2%。

- `w200-d0-intersect3...`
  - data 最近 10：ROI +17.2%。
  - history 最近 10：ROI +18.0%。

结论：交集打法更像“高命中率观察区”，不是最好的投注效率。若做 UI，可以用它画出共振区域；实际候选提示更适合显示中心 3 邻或中心 5 邻。

## 产品化建议

第一版不要上强下注，只做观察/提示层。

建议显示层级：

1. 观察：桌画像热区中心与当前短窗热区中心距离 <=1。
2. 提示：同时满足桌画像 z>=1、短窗 z>=1.5。
3. 强提示但不叫增强：中心完全重合 distance=0，显示中心 3 邻和 5 邻。
4. 辅助标记：如果 double resonance 也成立，显示“全局前缀同向”小标记。

推荐先实现的规则：

- 主观察规则：
  - window=120
  - distance<=1
  - profileZ>=1
  - recentZ>=1.5
  - candidate：recent center 3 邻
  - assignment：confirmed 或 probable

- UI 辅助区域：
  - 同时显示 profile center 3 邻。
  - 如果 distance=0，可显示“中心重合”。
  - 如果交集 >=5，可画 7 邻交集区域，但不要把 7 邻作为强投注。

不建议：

- 不建议直接使用 double resonance 单独出信号。
- 不建议用 mature/large profile 作为硬门槛；本轮 top 规则反而 mostly 是 profileTier=any。
- 不建议放宽到 distance<=4；收益明显被稀释。
- 不建议把 7 邻交集直接升为强信号，候选太宽且分布集中。

## 风险

这些正收益规则仍有明显集中度问题：

- 很多强规则 top10 超过 70%，有些超过 90%。
- 最近 10 组本身 top10 必然是 100%，不能用它证明长期稳定。
- 6030 规则属于大规模参数扫描，有事后筛选风险。

因此下一步应该做“滚动时间验证”：规则参数先固定，再按历史时间一段一段验证最近 10/20 局是否能持续正向，而不是继续扩大参数搜索。
