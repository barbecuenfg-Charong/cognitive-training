# 注意力系统画像闭环第一轮复盘与第二轮计划（2026-05-13）

## 1. 本轮目标

本轮目标不是再强化某一个注意力小游戏，而是把已有注意力模块合成一个系统级训练反馈入口。

要解决的核心问题是：用户练完 Schulte、Flanker、Stroop、Focus、CPT、Go/No-Go、Stop Signal 后，报告页能否回答“最近注意力训练覆盖了哪些能力域、当前弱项在哪里、下一轮优先练什么”。

## 2. 本轮改动

### 2.1 注意力画像 helper

新增 `src/shared/attention-profile.js`，统一识别注意力模块，并把不同 session 的 `summary`、`metrics`、session 顶层字段映射成保守 canonical 结构。

核心输出包括：

- `moduleId`
- `moduleName`
- `domainId`
- `domainLabel`
- `coreMetric`
- `errorProfile`
- `loadLevel`
- `trendDirection`
- `nextRecommendation`
- `score`
- `latestSessionTime`

聚合输出保留底层结构，同时补齐报告页直接消费的字段：

- `hasAttentionRecords`
- `summaryText`
- `chips`
- `prescriptions`
- `profiles`
- `weakProfiles`
- `priorityProfiles`

### 2.2 报告页系统画像

`report.html` 新增“注意力系统画像”面板，`report.js` 新增 `renderAttentionSystemFeedback(recentSessions)` 并接入原训练反馈流。

渲染原则：

1. helper 缺失时显示降级文案。
2. 无注意力记录时显示空态。
3. 有注意力记录时显示系统摘要、模块标签和下一轮处方。
4. 不从缺失字段里编造指标，只使用 helper 提供的保守聚合结果。

### 2.3 回归门禁

`scripts/flow-smoke.js` 补充 Report 对 `src/shared/attention-profile.js`、画像 DOM id 和聚合调用的静态检查。

新增 `scripts/smoke-attention-profile.js`，用样例 attention sessions 验证 helper 的真实数据契约：

- `aggregateAttentionSessions` 必须存在。
- 非注意力 session 不计入聚合。
- 聚合结果必须包含 `hasAttentionRecords`、`summaryText`、`chips`、`prescriptions`。

## 3. 验证结果

本轮实际执行并通过：

```powershell
node --check src/shared/attention-profile.js
node --check scripts/smoke-attention-profile.js
node scripts/smoke-attention-profile.js
node --check report.js
node --check scripts/flow-smoke.js
npm run smoke:flows
npm run smoke:pages
node scripts/check-sensitive-paths.js
git diff --check -- report.html report.js scripts/flow-smoke.js scripts/smoke-attention-profile.js src/shared/attention-profile.js
```

其中 `git diff --check` 只有 Windows LF/CRLF 提示，没有 whitespace error。

## 4. 第一轮复盘

### 4.1 做对的地方

1. 没有把注意力系统画像写死在报告页里，而是放到共享 helper，使后续模块可以逐步补 canonical 字段。
2. 报告页没有替代原来的趋势、弱项和最近提示，而是新增一个系统级视角。
3. smoke 从“页面有字符串”推进到“helper 合约能被样例 session 验证”。
4. 子 agent 迟到结果没有直接采信，主 agent 用本地文件和命令重新验证。

### 4.2 暴露的问题

1. 第一批 worker 曾出现接口错配：`report.js` 读取 `hasAttentionRecords / summaryText / chips`，helper 初版没有输出这些字段。
2. 静态 smoke 对真实渲染合约仍不够强，必须配合 helper smoke。
3. 审计 agent 或迟到 worker 的报告不能作为事实，只能作为线索。

## 5. 第二轮计划

第二轮不再继续堆注意力报告，而是转向训练本体的客观评分强度。

优先处理两个规划任务：

| 模块 | 第二轮目标 |
|---|---|
| London Tower | 用小状态空间 BFS 校验最少步数，让规划效率和路径偏离不只依赖题库手写字段 |
| Sliding Puzzle | 3x3 用精确解距，4x4 回退到 Manhattan 下界，避免把下界误当真实最短路径 |

第二轮不改社交决策模块，不改首页，不改发布流程。完成后再由审计 agent 检查写集、训练指标、保存契约和门禁结果。

## 6. 下一轮验收

第二轮收口至少执行：

```powershell
node --check london-tower.js
node --check sliding-puzzle.js
npm run smoke:flows
npm run smoke:pages
node scripts/check-sensitive-paths.js
git diff --check -- london-tower.js sliding-puzzle.js
```

若新增验证脚本，再追加对应 `node --check` 和运行命令。
