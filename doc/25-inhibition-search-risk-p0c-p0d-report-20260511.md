# 抑制控制、视觉搜索与风险决策 P0-C/P0-D 实施记录（2026-05-11）

## 1. 本轮目标

本轮承接 `22-training-effect-alignment-and-module-optimization-20260511.md`，继续把高收益模块从“可运行 demo”推进到“可训练、可复盘、可解释”：

- `stop-signal.html` / `stop-signal.js`
- `go-no-go.html` / `go-no-go.js`
- `schulte.html` / `schulte.js`
- `balloon-risk.html` / `balloon-risk.js`

本轮优先级不是增加玩法数量，而是让每个训练页更接近它应训练的核心能力：反应抑制、视觉搜索稳定性和风险收益校准。

## 2. Stop Signal

训练目标：

- 训练已经启动的反应取消能力。
- 通过 SSD staircase 和 SSRT 估算观察抑制控制，而不是只看是否按对方向键。

已落地改造：

- 页面加载 `src/shared/seeded-random.js` 与 `src/shared/training-results.js`。
- 生成 seeded trial plan，平衡 go/stop 与左右方向；核心生成不再依赖裸 `Math.random`。
- 每条 trial 记录 `trialType`、`direction`、`plannedSsd`、`ssdBeforeTrial`、`ssdAfterTrial`、`actualResponse`、`rtMs`、`success`、`classification`、`timedOut`。
- `classification` 区分 `goCorrect`、`goOmission`、`goDirectionError`、`stopSuccess`、`stopFailureBeforeSignal`、`stopFailureAfterSignal`。
- SSRT 从原先粗略 `goRt - meanSsd` 推进到 `integration-percentile` 估算，并保存 `ssrtEstimateMethod`、方法说明和样本不足时的不可估计说明。
- 结束反馈解释速度、停止成功率、SSRT 估算边界和下一轮训练建议。
- `TrainingResults.saveSession` 保存顶层 `seed/contentVersion`、`summary`、`trials`、`metrics`。

## 3. Go/No-Go

训练目标：

- 训练前优势反应抑制，区分绿色 go 响应不足和红色 no-go 冲动误按。

已落地改造：

- 页面加载 `src/shared/seeded-random.js` 与 `src/shared/training-results.js`。
- 使用 session seed 生成 trial plan，保存 `plannedType`、`stimulus`、`isi`。
- 每条 trial 记录 `response`、`responded`、`rtMs`、`classification`、`correct`、`timedOut`。
- `classification` 区分 `goHit`、`goOmission`、`noGoCorrect`、`noGoCommission`。
- `summary` 输出 hit rate、commission error rate、omission rate、平均 go hit RT。
- 补入 loglinear-corrected 近似 `dPrime` / `criterion`，并在 `signalDetection.method` 中标注方法边界。
- 结果页显示 commission、omission、信号检测指标和分型建议。

## 4. Schulte

训练目标：

- 训练视觉搜索、注意稳定性和连续扫描节奏。

已落地改造：

- 页面加载 `src/shared/seeded-random.js` 与 `src/shared/training-results.js`。
- 数字布局使用 session seed 派生 RNG 洗牌，保存 `gridLayout`。
- 每次点击保存 `targetNumber`、`expectedNumber`、`clickedNumber`、点击位置、错误位置、`targetIntervalMs`、`rtSinceLastMs`、`elapsedMs`。
- `summary` 输出完成时间、错误率、平均目标间隔、RT variability、`scanStability`、`clickPath`。
- 补入 `recommendation`、`nextGridSize`、`recommendedPaceMs`，并在结果弹窗展示节奏稳定性和下一轮建议。

## 5. BART 气球风险

训练目标：

- 训练风险承担、止盈时机和损失反馈下的策略调整。

已落地改造：

- 页面加载 `src/shared/seeded-random.js` 与 `src/shared/training-results.js`。
- 每个气球的 `breakPoint` 使用 session seed 派生 RNG 生成。
- 每个气球 trial 保存 `breakPoint`、`pumpCount`、`cashout`、`burst`、`outcome`、`earned`、`runningBank`。
- 新增 `decisionPath` / `pumpEvents`，逐次记录 `pumpIndex`、`tempPoints`、`runningBank`、`wouldBurst`、`afterPump`，cashout 也记录为决策事件。
- `summary` 输出 `totalBank`、`avgPumps`、未爆气球 `adjustedAvgPumps`、`burstRate`、`cashoutRate`、`riskTrend` 和训练建议。
- 结果页显示 adjusted pumps、风险趋势和简短下一轮建议。
- `TrainingResults.saveSession` 补齐顶层 `durationMs`、`seed`、`contentVersion`。

## 6. 验收结果

已通过：

- `node --check stop-signal.js`
- `node --check go-no-go.js`
- `node --check schulte.js`
- `node --check balloon-risk.js`
- `git diff --check`
- `npm run check`

当前 `npm run check` 结果：

- `high=0`
- `medium=5`
- `low=17`
- `passed=14`

未完成：

- 未做真实浏览器通关 smoke test。
- 未验证“完成训练 -> 保存 session -> report 读取 -> 趋势展示”的端到端链路。
- 未做移动端触摸、浏览器音频权限、长 session 稳定性验收。

## 7. 残余风险

- Stop Signal 的 `integration-percentile` SSRT 已比原先口径更合理，但 40 trial 仍偏短，只适合看同一任务内趋势，不宜当作正式测评结论。
- Go/No-Go 的 `dPrime/criterion` 是无依赖近似实现，适合训练反馈；如后续做严肃评估，应统一统计函数和报告解释。
- Schulte 的 `scanStability` 依赖点击间隔，能反映节奏波动，但还不是眼动级扫描策略指标。
- BART 的 `riskTrend` 只比较前半程与后半程平均泵数，是训练反馈指标，不代表完整风险偏好模型。
- 这批仍未接入正式浏览器自动化验收，实际应用前应补一次端到端 smoke。

## 8. 下一步

1. 优先建立浏览器 smoke test 基础设施，覆盖本轮 4 个模块的开始、完成、保存和报告页读取。
2. 把 Stop Signal、Go/No-Go 的抑制控制指标接入长期趋势页，避免只看单次总分。
3. 为 Schulte 增加多轮趋势对比，观察完成时间、错误率和 scan stability 是否同步改善。
4. 为 BART 增加跨 session 策略变化图，区分稳定止盈、过度保守和追涨式风险上升。
5. 下一批再处理 `Raven` 的题目生成/唯一答案校验，避免把高风险生成器和本轮收口混在一起。
