# 33 个训练任务结果落库闭环记录（2026-05-11）

## 本轮目标

本轮目标是补齐最后 6 个尚未接入统一训练结果存储的训练页：`nback`、`corsi`、`digit-span`、`raven`、`mental-rotation`、`go-no-go`。

完成标准不是重做训练范式或扩展题库，而是让 33 个训练任务全部进入 `TrainingResults` 链路：训练结束时调用 `TrainingResults.saveSession` 保存 session，后续由报告页读取统一结果。

## 分派边界

本轮采用主 agent 分派、多 worker 并行落地、文档 worker 收口的边界。

- 开发边界：只补齐最后 6 个训练页的 `TrainingResults.saveSession` 接入，不把科学指标增强、题库扩展、浏览器全量通关混入同一批次。
- 结果边界：训练页负责写入统一结果；`report.html` / `report.js` 作为 1 个读取端，继续保持读取 `TrainingResults`。
- 验收边界：以 `npm run check` 和 picky-player 风险分布作为本轮全局验收口径，文档收口只更新 `doc/16`、新增本文档并追加 `doc/INDEX.md` 链接。
- 遗留边界：`package-lock.json` 是否纳入版本变更单独决策，不在本轮文档收口中修改。

## 6 模块完成项

| 系统 | 模块 | 页面 / 脚本 | 本轮完成项 |
|------|------|-------------|------------|
| 工作记忆 | N-Back 记忆 | `nback.html` / `nback.js` | 已接入 `TrainingResults.saveSession`，训练 session 进入统一结果存储。 |
| 工作记忆 | 科西方块 | `corsi.html` / `corsi.js` | 已接入 `TrainingResults.saveSession`，空间序列记忆结果进入统一结果存储。 |
| 工作记忆 | 数字广度 | `digit-span.html` / `digit-span.js` | 已接入 `TrainingResults.saveSession`，正背/倒背训练结果进入统一结果存储。 |
| 推理 | 瑞文推理 | `raven.html` / `raven.js` | 已接入 `TrainingResults.saveSession`，推理答题 session 进入统一结果存储。 |
| 空间认知 | 心理旋转 | `mental-rotation.html` / `mental-rotation.js` | 已接入 `TrainingResults.saveSession`，角度、正确率等训练结果进入统一结果存储。 |
| 执行功能 | Go/No-Go | `go-no-go.html` / `go-no-go.js` | 已接入 `TrainingResults.saveSession`，反应抑制结果进入统一结果存储。 |

## 全量结果

| 指标 | 结果 |
|------|------|
| 训练任务入口 | 33 |
| 已接入 `TrainingResults.saveSession` 的训练任务 | 33 |
| 未接入 `TrainingResults.saveSession` 的训练任务 | 0 |
| 读取 `TrainingResults` 的报告页 | 1 |
| 本轮补齐训练页 | 6 |

结论：统一结果落库已经从局部接入推进到 33/33 全量覆盖。后续风险不再是“是否落库”，而是“落库后的端到端可用性、风险消化、发布决策和科学质量”。

## 验收结果

- `npm run check` 已通过。
- picky-player 审计结果：`high=0`，`medium=5`，`low=18`，`passed=13`。
- `doc/16-module-status-matrix-20260510.md` 已同步为 33 个训练任务已接入、0 个未接入。

## 剩余落地计划

1. 浏览器通关抽样：对本轮 6 个补齐页和代表性旧页做真实浏览器从开始到结束的抽样，确认保存、重开、异常兜底和报告读取。
2. 5 个 medium 风险处理：先复核 picky-player 的 5 个 medium 项，按阻断程度拆成修复任务，避免与 low 项混排。
3. `package-lock.json` 决策：确认锁文件变更来源和发布策略，决定保留、重生或独立清理。
4. 发布路径验收：验证本地启动、静态资源、文档入口、报告页读取和发布构建路径是否一致。
5. 科学指标增强：在已落库基础上补强 N-Back、Corsi、Digit Span、Raven、Mental Rotation、Go/No-Go 等模块的范式指标、评分解释和后续扩展边界。
