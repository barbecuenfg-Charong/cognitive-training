# 训练本体第五轮：跨 session 趋势闭环与真实训练 smoke 收口（2026-05-15）

## 1. 本轮目标

本轮继续围绕“让训练本体真的变强”推进，不再只看单次 session 的分数和反馈，而是把最近多次训练折叠成可读趋势，并把趋势信号送回 `report.js` 与 `daily-plan.js`。

本轮目标有四件事：

1. 补一个共享趋势层，让 report / daily-plan 读到最近 7/14/30 次训练走势。
2. 把 report 页的单次反馈升级为跨 session 趋势 + 推荐行动。
3. 把 Daily Plan 升级为基于趋势的周期化训练建议，而不是只看最近一轮。
4. 用真实训练闭环 smoke 验证 `TrainingResults -> AttentionProfile -> TrainingTrends -> Report / Daily Plan` 这条链路。

## 2. 实际写集

本轮实际写集如下：

1. `src/shared/training-trends.js`
2. `scripts/smoke-training-trends.js`
3. `scripts/smoke-real-training-loop.js`
4. `report.html`
5. `report.js`
6. `daily-plan.html`
7. `daily-plan.js`
8. `alternative-uses.js`
9. `remote-associates.js`
10. `sally-anne.js`
11. `eyes-reading.js`
12. `package.json`

## 3. 已落地内容

### 3.1 共享趋势层

新增 `src/shared/training-trends.js`，提供浏览器全局 `window.TrainingTrends`。

核心 API：

- `analyzeTrainingTrends(sessions, options)`
- `summarizeModuleTrend(group, options)`
- `buildPlanSignals(sessions, options)`

能力范围：

- 按 `moduleId / gameId / taskId` 聚合最近 session。
- 从 `summary -> metrics -> session 顶层` 保守读取评分、稳定性、readiness、波动、RT 等信号。
- 输出 `count / latest / previous / averageScore / recentScore / delta / trendLabel / volatilityLabel / readinessLabel / recommendedAction`。
- 支持最近 7/14/30 次窗口摘要。

### 3.2 Report 消费层

`report.html` / `report.js` 已开始消费 `TrainingTrends`。

主要变化：

- 报告页可选加载 `src/shared/training-trends.js`。
- `report.js` 防守式读取 `TrainingTrends`，helper 缺失时自动降级。
- 新增“推荐行动”区块，把趋势归一成 `升阶 / 巩固 / 降负荷 / 补样本`。
- 弱项模块区会在 helper 可用时补充模块趋势。

### 3.3 Daily Plan 消费层

`daily-plan.html` / `daily-plan.js` 已升级为趋势驱动。

主要变化：

- 动态加载 `src/shared/training-trends.js`，失败不阻断页面。
- 读取 `analyzeTrainingTrends`、`buildPlanSignals`、`summarizeModuleTrend`。
- 候选排序和卡片说明会根据样本不足、下降、高波动、稳定上升等趋势变化调整。
- 继续保留并消费 `nextPracticeRecommendation` / `nextPrescriptionReason`。

### 3.4 训练本体补强

本轮同步增强了四个训练模块：

- `alternative-uses.js`
- `remote-associates.js`
- `sally-anne.js`
- `eyes-reading.js`

这些模块继续围绕“训练本体要有效”做内容池、错误分型、下一轮建议和练习反馈边界收口，而不是做固定 demo。

## 4. 真实闭环验证

已运行的验证命令：

```powershell
node --check report.js
node --check daily-plan.js
node --check src\shared\training-trends.js
node --check scripts\smoke-training-trends.js
node --check scripts\smoke-real-training-loop.js
node --check alternative-uses.js
node --check remote-associates.js
node --check sally-anne.js
node --check eyes-reading.js
node scripts\smoke-training-trends.js
node scripts\smoke-real-training-loop.js
node scripts\smoke-feedback-signals.js
node scripts\smoke-training-loop.js
node scripts\smoke-training-depth.js
npm run check
git diff --check
```

验证结果：

- 趋势 helper smoke 通过。
- 真实训练闭环 smoke 通过。
- 反馈信号 smoke 通过。
- 训练闭环 smoke 通过。
- 训练深度 smoke 通过。
- `npm run check` 通过，已串入趋势 smoke 和真实闭环 smoke。

## 5. 残余风险

1. 趋势判断仍是启发式，后续仍要靠真实 session 持续校准阈值。
2. smoke 能证明链路可用，但不能替代真人连续试玩。
3. 当前仍以本地闭环为主，跨周 / 跨月趋势还需要更强的历史聚合。

## 6. 下一步

下一轮优先继续做三件事：

1. 让更多模块输出更强的可解释过程指标。
2. 让 report / daily-plan 把最近多次训练真正折叠成周级趋势。
3. 按真实体验再压低 picky-player 的中低风险项。
