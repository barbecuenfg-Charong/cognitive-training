# 训练本体第三轮收口：创造力、社会认知与校准门禁（2026-05-13）

## 1. 本轮目标

本轮不是继续加新游戏，而是把 `doc/32-training-body-completeness-roadmap-20260512.md` 里已经点名的剩余重点模块往“可训练、可复盘、可解释”推进。

这一轮集中处理三类缺口：

1. 创造力模块还停留在“有输入有结果”的层面，但评分边界和维度命名不够清楚。
2. 社会认知模块能玩，但 trial 级训练信息和非诊断边界不够完整。
3. 校准类模块已有自适应或核心指标，但缺少“这轮结果是否可信”的稳定性和质量字段。

## 2. 本轮实施范围

### 2.1 创造力模块

本轮继续保留已经强化过的 `alternative-uses.js`、`remote-associates.js`，并补强 `torrance-creative.js` 的显式指标命名。

`torrance-creative.js` 本轮补齐和统一了：

- `rawTitle`
- `rawDescription`
- `titleMetric`
- `titleScore`
- `titleDiversity`
- `detailMetric`
- `detailScore`
- `categoryCount`
- `transformationLabels`
- `transformationCount`

训练边界没有放松，`scoringBoundary` 仍明确声明这些是启发式训练反馈，不是 TTCT 标准化常模分数。

### 2.2 社会认知模块

`sally-anne.js` 和 `eyes-reading.js` 从“可答题”推进到“可复盘”。

`sally-anne.js` 当前已具备：

- 场景池
- 一阶/二阶信念区分
- reality control / memory control
- `questionType`
- `errorType`
- trial 级 `explanation`
- summary/metrics 级 `explanationFeedback`

`eyes-reading.js` 本轮新增了完整的社会认知训练元数据：

- `materialSource`
- `sourceCredit`
- `licenseBoundary`
- `nonDiagnosticBoundary`
- `emotionCategory`
- `confusableEmotion`
- `distractorCategory`
- `confusionSet`
- `vocabularyLevel`
- `wordComprehensionRisk`
- `lexicalDemand`
- 完整 `trials`
- `emotionCategoryBreakdown`
- `confusionBreakdown`
- `vocabularyRiskCount`
- `nextPracticeRecommendation`

这样结果可以区分“表情判断错误”和“词汇理解负荷”，不再只是一个准确率。

### 2.3 校准与稳定性模块

这一轮没有再重写玩法，而是给已有模块补“结果质量”字段。

`stop-signal.js` 新增：

- `ssdStaircaseQuality`
- `staircaseQualityLabel`
- `staircaseClampCount`
- `staircaseReversalCount`
- `usableStopSampleCount`
- `staircaseQualityNote`
- `goWaitingRate`
- `lateGoResponseRate`
- `goWaitingFlag`
- `strategicSlowingFlag`
- `nextPracticeRecommendation`

`nback.js` 新增：

- `adaptiveStabilityLabel`
- `loadStability`
- `adaptiveStabilityScore`
- `nLevelOscillationCount`
- `speedOscillationCount`
- `reversalCount`
- `adaptationVolatility`

`corsi.js` 新增：

- `adaptiveStabilityLabel`
- `spanStability`
- `staircaseQuality`
- `spanOscillationCount`
- `reversalCount`
- `adaptationVolatility`
- `backwardReadiness`
- `forwardReadiness`
- `modeTransitionReadiness`

`digit-span.js` 新增：

- `spanStability`
- `adaptiveStabilityLabel`
- `staircaseQuality`
- `spanOscillationCount`
- `reversalCount`
- `adaptationVolatility`
- `backwardReadiness`
- `sortedReadiness`
- `modeTransitionReadiness`

`prisoner-dilemma.js` 额外补了显式语义字段：

- `forgivenessAfterOpponentDefectionRate`

它和原有 `forgivenessRate` 同口径，但对后续读取 summary/metrics 更直接。

## 3. 多 agent 执行方式

这轮没有继续放任宽任务并行，而是按单文件 worker 收口：

1. 每个 worker 只拥有一个 `.js` 写集。
2. 文档、Git、共享脚本和其他训练页不允许越权修改。
3. 共享门禁 `scripts/smoke-training-depth.js` 独立由单文件 worker 处理。
4. 主线程不直接相信 worker 汇报，只认本地 diff 和验证命令。

实际证明这一点是必要的：早期宽任务出现过模型容量失败和结果不可直接采信的问题，重新拆成单文件后，收口效率和真实性都更高。

## 4. 门禁扩展

本轮同步扩展了 `scripts/smoke-training-depth.js`。

它现在除了原有的：

- `src/shared/attention-profile.js`
- `london-tower.js`
- `sliding-puzzle.js`
- `alternative-uses.js`
- `remote-associates.js`

还新增检查：

- `torrance-creative.js`
- `ultimatum-game.js`
- `trust-game.js`
- `prisoner-dilemma.js`
- `raven.js`
- `stop-signal.js`
- `nback.js`
- `corsi.js`
- `digit-span.js`
- `sally-anne.js`
- `eyes-reading.js`

另外，主线程新增了 `scripts/smoke-training-loop.js`，用于验证 `TrainingResults` 与注意力画像 helper 的最小运行时闭环，避免只做静态字段检查。

## 5. 实际验证

本轮主线程实际执行并通过：

```powershell
node --check eyes-reading.js
node --check stop-signal.js
node --check nback.js
node --check corsi.js
node --check digit-span.js
node --check torrance-creative.js
node --check prisoner-dilemma.js
node --check scripts/smoke-training-depth.js
node --check scripts/smoke-training-loop.js
node scripts/smoke-training-depth.js
node scripts/smoke-training-loop.js
npm run smoke:pages
npm run smoke:flows
node scripts/check-sensitive-paths.js
npm run check
```

验证结论：

1. 训练深度 smoke 通过，说明本轮新增的训练字段和门禁已接上。
2. 训练结果最小闭环 smoke 通过，说明 `TrainingResults` 与系统级 helper 没被破坏。
3. 页面和流程 smoke 通过，说明新增字段没有破坏现有入口。
4. 敏感路径扫描通过，当前变更没有把本机路径、账户信息或凭据写入仓库文件。

## 6. 当前完成判断

以 `doc/32` 的路线看，本轮有三个结果：

1. 创造力模块里，`alternative-uses`、`remote-associates`、`torrance-creative` 现在都具备更清楚的维度字段和边界说明，已从“开放题 demo”向“可解释训练反馈”推进了一步。
2. 社会认知模块里，`sally-anne`、`eyes-reading` 已不再只有正确率，而是开始保存错误来源、控制题和解释反馈。
3. 校准类模块里，`stop-signal`、`nback`、`corsi`、`digit-span` 已经能输出“这轮 staircase 是否稳定、结果是否可信”的辅助判断。

换句话说，这一轮不是把所有训练都做到最终形态，而是把“训练本体强度”和“门禁可验证性”一起向前推了一层。

## 7. 残余问题

本轮仍然有三类残余问题：

1. 这些稳定性、readiness、质量标签大多还是启发式阈值，后续还需要结合真实 session 数据做再校准。
2. 一部分新 summary/metrics 字段已经保存，但报告页和日计划还没有全面消费这些新信号。
3. `smoke-training-depth.js` 目前仍是静态正则门禁，它能证明“字段存在”，不能证明“字段值正确”。

## 8. 下一轮建议

下一轮应优先做三件事：

1. 挑 2 到 3 个已强化模块做真实运行时抽测，把启发式质量字段和实际训练手感对齐。
2. 让报告页或训练计划页开始消费部分新字段，至少接入 `stop-signal`、`nback`、`corsi`、`digit-span` 的稳定性/处方信息。
3. 对 `ultimatum-game`、`trust-game`、`prisoner-dilemma` 增加更接近运行时的 smoke，而不只停留在字段门禁。
