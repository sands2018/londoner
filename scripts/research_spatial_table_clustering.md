# 空间分桌算法研究记录

日期：2026-06-23

## 问题

现有 `autoTableProfile` 是局内/顺序匹配工具：如果已有人工桌号或已有画像，它可以判断新局更像哪个画像。但它不是从零开始的“真实分桌”算法。直接把它用于批量无监督建桌，容易把空间状态相似但物理桌号不同的局混在一起，或者拆出过多临时 cluster。

本轮目标是单独做一个批量空间聚类版本：在不知道人工桌号的情况下，尽量根据轮盘空间偏向，把同一场馆/批次的数据分成稳定桌台。

## 数据

使用 `HistoryData/data_2026.6.11整理.json`，过滤出号码数不少于 80 的 session，共 121 条。

重点验证集：

- `202606` 澳门永利 10 条。
- 旧研究人工判断为 3 桌：`澳门永利_01 / 澳门永利_02 / 澳门永利_03`。人工标签只用于结果校验，不参与聚类。

## 算法

脚本：`scripts/research_spatial_table_clustering.ts`

核心步骤：

1. 按场馆分组。先不跨场馆聚类，因为不同场馆混在一起会产生伪相似。
2. 把每局号码映射到欧洲轮盘物理顺序。
3. 对每局扫描所有连续 7 号轮盘弧段，找出最强主弧段：
   - 主弧段中心号码。
   - 主弧段号码集合。
   - 主弧段 z-score。
4. 用“主弧段中心在轮盘上的圆形距离”做聚类主特征。
5. 对小样本批次使用穷举 k-medoids，避免初始点导致局部最优。
6. 自动选 k：
   - 先排除含单条孤岛的候选簇（样本数 >= 6 时）。
   - 在稳定候选里按 silhouette 减少量复杂度惩罚选 k。
   - 这样不会为了高 silhouette 把一两条数据拆成假桌。

## 当前结果

对 2026-06 澳门永利 10 条，算法自动选择 `k=3`，silhouette `0.641`，和旧人工判断一致：

### cluster 1：澳门永利_01

- `20260601-1630`，中心 `7`，弧段 `22-18-29-7-28-12-35`
- `20260602-0018`，中心 `28`，弧段 `18-29-7-28-12-35-3`
- `20260604-1630`，中心 `12`，弧段 `29-7-28-12-35-3-26`

### cluster 2：澳门永利_02

- `20260603-2101`，中心 `16`，弧段 `10-5-24-16-33-1-20`
- `20260603-0030`，中心 `1`，弧段 `24-16-33-1-20-14-31`
- `20260605-0230`，中心 `20`，弧段 `16-33-1-20-14-31-9`
- `20260604-2223`，中心 `9`，弧段 `20-14-31-9-22-18-29`

### cluster 3：澳门永利_03

- `20260606-0131`，中心 `19`，弧段 `0-32-15-19-4-21-2`
- `20260603-0230`，中心 `21`，弧段 `15-19-4-21-2-25-17`
- `20260607-0217`，中心 `6`，弧段 `25-17-34-6-27-13-36`

把 2026-04 那条澳门永利数据也加入后，全部澳门永利 11 条仍自动选择 `k=3`，其中 `20260409-夜` 被归到 `澳门永利_03` 所在空间簇。

## 结论

这个版本已经比在线 `autoTableProfile` 更接近“真正的批量分桌”：它不依赖人工桌号，能在澳门永利验证集上自动恢复 3 桌。

但它目前仍是研究脚本，不应立刻替换产品里的实时画像。原因：

- 它是批量算法，需要同一场馆有多局样本，适合离线建桌/校准。
- 单局刚开始时仍需要在线匹配逻辑。
- 当前主特征只用最强 7 号弧段，后续可以加入次强弧段、冷热反向弧段、位移率、时间衰减等特征，提高边界局的置信度。

建议下一步：

1. 把这个批量算法作为“历史数据分桌/校准”工具。
2. 批量聚类结果可作为人工桌号建议，不自动覆盖人工桌号。
3. 等 Wayne 校验更多场馆后，再考虑把稳定 cluster 写入本地桌号数据，供 `autoTableProfile` 在线匹配使用。

## Product integration (2026-06-23)

The batch spatial clustering research has been promoted into product code:

- Core module: `app/src/core/spatialTableClustering.ts`.
- Integration point: `app/src/core/autoTableProfile.ts`.
- `autoTableProfile` now first runs batch spatial clustering for sessions with a recognizable venue/source key.
- `unknown` venue sessions are intentionally excluded from batch clustering and continue to use the original chronological fallback matcher.
- Manual `tableId` remains authoritative. If a spatial cluster has exactly one manual table id, unassigned sessions in that cluster can adopt that table id automatically.
- If a spatial cluster has no unique manual table id, it lazily receives an `auto_XX` id for the current in-memory profile build only.
- The assignment is not persisted back to session data.

Verification:

- `vitest run src/core/autoTableProfile.test.ts src/core/tableHotProfile.test.ts` passed.
- `npm.cmd run build` passed.
- The product module still recovers the Macau Wynn data as three spatial clusters from `HistoryData/data_2026.6.11整理.json`.
