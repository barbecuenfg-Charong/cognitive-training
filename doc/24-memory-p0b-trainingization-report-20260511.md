# 工作记忆 P0-B 训练化实施记录（2026-05-11）

## 1. 本轮目标

本轮按 `22-training-effect-alignment-and-module-optimization-20260511.md` 的 P0-B 批次，整理并验收 2 个工作记忆主干模块：

- `nback.html` / `nback.js`
- `corsi.html` / `corsi.js`

目标不是新增玩法，而是确认当前实现已经从“可运行 demo”推进到“可训练、可复盘、可解释”的工作记忆训练页。

能力边界：

- N-Back：训练工作记忆更新、目标保持、持续注意和匹配判断控制。
- Corsi：训练视觉空间短时记忆广度、空间路径保持和正向/逆向顺序复现。

## 2. N-Back

训练目标：

- 在连续刺激流中保持最近 `N` 个项目，并判断当前刺激是否匹配目标位置。
- 通过 target / non-target 区分，观察目标遗漏和误报，避免只用总分判断表现。

已落地改造：

- 页面加载 `src/shared/seeded-random.js` 和 `src/shared/training-results.js`。
- 刺激生成接入 session seed 派生 RNG，保存顶层 `seed` 与 `contentVersion`。
- 刺激计划按约 30% target 概率生成，并保留 `stimulus`、`targetStimulus`、`matchedStimulus`、`isTarget`。
- trial 分类补齐 `hit`、`miss`、`falseAlarm`、`correctRejection`。
- 每条 trial 记录 `nLevel`、`charType`、`response`、`responded`、`correct`、`rtMs`、`timedOut`、`classification`、`startedAt`、`finishedAt`、`elapsedMs`。
- `summary` 输出 target/non-target 试次数、命中、漏选、误报、正确拒绝、命中率、误报率、正确率、平均反应时、`nProgression`、`loadAssessment` 和下一轮建议。
- 结束弹窗展示准确率、命中/漏选/误报统计、负荷建议和逐 trial 历史。
- `TrainingResults.saveSession` 保存 `summary`、`trials`、`metrics`、`seed`、`contentVersion` 和 memory/updating 标签。

当前数据结构：

- 顶层：`moduleId/gameId/gameName/startedAt/finishedAt/durationMs/score/seed/contentVersion`。
- `summary`：`totalTrials`、`nLevel`、`sessionType: fixed-level`、`isAdaptive: false`、`nProgression`、四分类计数与比率、`accuracy`、`meanRtMs`、`responseMeanRtMs`、`targetProbability`、`stimulusDurationMs`、`charType`、`loadAssessment`、`recommendation`。
- `trials[]`：逐刺激记录，支持复盘刺激序列、目标标记、用户响应、反应时和分类结果。
- `metrics`：报告页摘要字段，包括准确率、命中率、误报率、平均反应、miss/false alarm 计数、负荷评估和版本信息。

## 3. Corsi

训练目标：

- 观察空间方块点亮路径并复现，测量视觉空间短时记忆广度。
- 正向模式偏向空间路径保持，逆向模式额外增加顺序操作和工作记忆重排负荷。

已落地改造：

- 页面加载 `src/shared/seeded-random.js` 和 `src/shared/training-results.js`。
- 每场 session 生成 `seed`，并用派生 RNG 控制方块布局和序列生成。
- 方块布局保留经典不规则空间分布，同时把 `blockLayout` 写入 `summary`，便于复现。
- 支持 `forward` / `backward` 两种回忆模式，`expectedResponseSequence` 会随模式切换为正序或逆序。
- 每条 trial 记录 `sequenceLength`、`level`、`sequenceMode`、`blockCount`、`blockSequence`、`expectedResponseSequence`、`responseSequence`、`correct`、`rtMs/responseDurationMs`、`spanBeforeTrial`、`spanAfterTrial`、`attemptInSpan`、`errorType`、`errorPosition`、`elapsedMs`。
- `summary` 输出总 trial、正确数、正确率、`maxSpan`、`finalSpan`、最长正确序列、平均响应时长、`spanProgression`、终止原因、起始广度、最高尝试广度、顺序错误数、`seed`、`contentVersion` 和 `blockLayout`。
- 手动停止不再静默丢失数据；会保存 `terminationReason: manual_stop`、已有 trials、seed 和方块布局，并展示中断结果。
- 结束反馈解释空间记忆广度、顺序错误、最高尝试长度和下一轮设置建议。
- `TrainingResults.saveSession` 保存 `summary`、`trials`、`metrics`、`seed`、`contentVersion` 和 visuospatial-memory/span 标签。

当前数据结构：

- 顶层：`moduleId/gameId/gameName/startedAt/finishedAt/durationMs/score/seed/contentVersion`。
- `summary`：`totalTrials`、`correctCount`、`accuracy`、`maxSpan`、`finalSpan`、`longestCorrectSequence`、`meanResponseDurationMs`、`sequenceMode`、`spanProgression`、`terminationReason`、`blockCount`、`startSpan`、`maxAttemptedSpan`、`orderErrorCount`、`blockLayout`。
- `trials[]`：逐序列记录，支持复盘原始点亮序列、期望响应、用户响应、错误位置和广度变化。
- `metrics`：报告页摘要字段，包括模式、方块数、准确率、最大/最终广度、最长正确序列、平均响应时长、顺序错误数和版本信息。

## 4. 验收结果

本轮文档 worker 基于当前工作区实现做了只读检查，未编辑代码文件。

已通过：

- `node --check nback.js`
- `node --check corsi.js`
- `npm run check`

当前 `npm run check` 结果：

- `high=0`
- `medium=5`
- `low=17`
- `passed=14`

未完成：

- 未做真实浏览器通关 smoke test。
- 未验证“首页进入 -> 完成训练 -> 保存 session -> report 读取”的端到端链路。
- 未校验移动端触摸、浏览器音频权限和长 session 下 target 分布稳定性。

## 5. 残余风险

- 本报告生成时，`nback.html/js` 与 `corsi.html/js` 已由其他 worker 修改且仍处于工作区 modified 状态；本文只记录当前可见实现，不代表并行 worker 后续不会继续改动。
- N-Back 当前是 `fixed-level`，`nProgression` 已记录但还不是真正的自适应 staircase；下一步若要形成训练处方，需要把升降级规则落到实现。
- N-Back target 比例是概率生成，短 session 下不保证严格平衡；如用于趋势比较，应记录实际 target/non-target 计数。
- N-Back 尚未计算 d-prime、criterion 等敏感性指标；当前四分类计数已经为后续计算留出数据。
- Corsi 的手动停止已保存为 `manual_stop` session，但“中断原因”仍只能从用户点击停止推断，尚未区分疲劳、负荷过高或主动退出。
- Corsi 的空间布局依赖当前容器尺寸和 viewport，虽然已保存 `blockLayout`，但跨设备复现实验条件仍需要说明。
- 两个模块都还缺正式浏览器自动化验收，尤其是 session 保存后在报告页读取与趋势展示的验证。

## 6. 下一步

1. 为 N-Back 增加真实自适应负荷规则：命中率、误报率和正确率达到阈值后升 N，负荷过高时降 N 或放慢速度。
2. 为 N-Back 补 d-prime/criterion 或等价敏感性指标，并在报告页解释“遗漏型”与“冲动误报型”错误。
3. 为 Corsi 增加更明确的中断反馈入口，区分疲劳、负荷过高、误触和主动退出。
4. 建立 P0-B 浏览器 smoke test，覆盖自然完成、错误终止、重开、保存和报告页读取。
5. 把 N-Back 的负荷曲线和 Corsi 的 span progression 接入长期报告趋势，避免只看单次分数。
