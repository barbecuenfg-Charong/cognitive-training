# 参数化概率模块并行优化记录（2026-05-10）

## 本轮目标

本轮围绕概率类训练模块做并行优化，重点是把题目生成、训练结果结构、报告展示和校验脚本统一到可审计、可回放、可兼容旧数据的状态。

## 分派边界

本轮只处理 Base Rate、Bayes Update、Monty Hall、Gambler Fallacy、Report 展示，以及与这些模块相关的语法检查覆盖。

不处理 13 个尚未接入 TrainingResults 的旧训练页，不处理既有 package-lock 脏状态，不扩展到其他 docs、INDEX、代码结构重构或依赖调整。

## 完成项

- Base Rate 完成 10 题参数化，并接入 TrainingResult v1。
- Bayes Update 完成 12 题种子参数生成。
- Monty Hall 调整为 12 轮 session，接入 seeded RNG，并在 session 结束时保存一次结果。
- Gambler Fallacy 调整为 20 轮训练。
- Report 展示 TrainingResult v1 summary，并补充 Base/Bayes 核心指标展示，同时保留 legacy fallback。
- `package.json` 的 `check:syntax` 覆盖本轮关键 JS 文件和 `src/shared/training-results.js`。

## 审计发现与修复

- Bayes Update 补齐 `summary.meanRtMs`，并保留旧 metrics 的 `mae`、`seed` 和数值型 `approxAccuracy`。
- Gambler Fallacy 补齐结果字段：`moduleId`、`summary`、`trials`、`score`、`durationMs`。
- Gambler Fallacy 单题记录补齐 `correct` 和 `rtMs`。
- Monty Hall 改为 session 结束后一次性保存，避免中途状态反复写入训练结果。

## 验证结果

- `npm run check` 通过。
- picky-player 结果：`high=0`，`medium=5`，`low=18`，`passed=13`。
- `node --check` 通过。
- `git diff --check` 通过，仅有 LF/CRLF 提示。

## 剩余问题

- 仍有 13 个旧训练页未接入 TrainingResults。
- picky-player 仍存在中低风险项，需要后续分批处理。
- 浏览器端完整通关仍需抽样验证。
- `package-lock` 是既有脏状态，本轮未处理。

## 下一步建议

- 优先给 13 个旧训练页补 TrainingResults 接入清单，按风险和使用频率排序推进。
- 对 picky-player 的 5 个 medium 风险项先做复核，再决定是否进入修复批次。
- 抽样跑通浏览器端完整训练流程，覆盖结果保存、报告展示、legacy fallback 三类路径。
- 单独确认 package-lock 的来源和处理策略，避免与本轮模块优化混在一起。
