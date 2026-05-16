# GLM5/GPT 综合文档系列（2026-02-27）

## 编制依据

本系列文档基于以下两类来源整理：

1. 意见来源（融合建议）  
   `gpt/汇总/GLM5_GPT_综合详细文档.md`（离线来源）
2. 最新资料来源（当前基线）  
   `glm5/汇总/`（离线来源）  
   重点文件：`glm5/汇总/INDEX.md`

## 阅读顺序

1. [01-unified-baseline.md](01-unified-baseline.md)  
   统一口径、系统规模、当前基线。
2. [02-module-mapping-and-numbering.md](02-module-mapping-and-numbering.md)  
   模块映射、编号策略、历史编号兼容。
3. [03-template-and-metrics-standard.md](03-template-and-metrics-standard.md)  
   模板、指标和数据记录的统一规范。
4. [04-roadmap-and-quality-gates.md](04-roadmap-and-quality-gates.md)  
   执行路线、发布门槛与检查清单。
5. [05-overall-merged-from-glm5-gpt.md](05-overall-merged-from-glm5-gpt.md)  
   基于 `glm5/汇总` 与 `gpt/汇总` 的总体整合文档。
6. [06-picky-player-evaluation.md](06-picky-player-evaluation.md)  
   挑剔玩家视角的全量游戏首轮测评记录（访问覆盖、可完成性与追问清单）。
7. [07-work-plan-from-glm5-eval-and-todo.md](07-work-plan-from-glm5-eval-and-todo.md)  
   基于 GLM5 测评报告、对抗测试和待办清单的执行版工作计划（里程碑、验收与门禁）。
8. [08-work-plan-v1.1-and-dev-kickoff.md](08-work-plan-v1.1-and-dev-kickoff.md)  
   基于待办 v1.1 的最新执行计划与本周开发启动清单。
9. [09-self-test-report-after-p1-kickoff.md](09-self-test-report-after-p1-kickoff.md)  
   开发启动后自测结果（语法、结构、巡检、脱敏），用于评审前核对。
10. [10-glm5-game-specs-index.md](10-glm5-game-specs-index.md)  
   GLM5 每个游戏说明文档镜像索引（`doc/glm5-game-specs`）。
11. [11-back-button-standard.md](11-back-button-standard.md)  
   游戏页面返回按钮统一规范（命名、结构、位置与验收标准）。
12. [12-repo-cleanup-numerology-removal.md](12-repo-cleanup-numerology-removal.md)  
   仓库清理记录：移除与主应用无引用关系的 `numerology/` 独立脚手架目录。
13. [13-external-solutions-research.md](13-external-solutions-research.md)
   外部方案检索报告：36个认知训练模块的开源参考实现、科学范式标准与改进方向。
14. [14-next-steps-and-open-questions.md](14-next-steps-and-open-questions.md)
   下一步工作规划与待讨论事项：分阶段实施计划、6项待决策问题、启动检查清单。
15. [15-current-state-and-optimization-review-20260510.md](15-current-state-and-optimization-review-20260510.md)
   主 agent 现状复核：项目边界、协同审计结论、主要矛盾、待优化项与行动顺序。
16. [16-module-status-matrix-20260510.md](16-module-status-matrix-20260510.md)
   模块状态矩阵：36 个入口的实现状态、落库状态、内容池风险和下一步动作。
17. [17-training-result-schema-v1.md](17-training-result-schema-v1.md)
   训练结果数据契约：`TrainingResult` v1 字段、规则和后续模块接入要求。
18. [18-foundation-hardening-report-20260510.md](18-foundation-hardening-report-20260510.md)
   基础加固实施记录：状态矩阵、数据契约、门禁、P0 修复和后续可启动范围。
19. [19-parameterized-probability-modules-report-20260510.md](19-parameterized-probability-modules-report-20260510.md)
   参数化概率模块并行优化记录：Base Rate、Bayes Update、Monty Hall、Gambler Fallacy、Report 和门禁覆盖的协同收口。
20. [20-attention-training-results-closure-20260510.md](20-attention-training-results-closure-20260510.md)
   注意力训练模块结果落库闭环记录：Schulte、Flanker、Focus、CPT、Stroop 的 TrainingResults 接入、审计修复与验证结果。
21. [21-all-training-results-closure-20260511.md](21-all-training-results-closure-20260511.md)
   33 个训练任务 TrainingResults 全量接入闭环记录：本轮 6 个补齐模块、33/33 结果、验收结论与剩余落地计划。
22. [22-training-effect-alignment-and-module-optimization-20260511.md](22-training-effect-alignment-and-module-optimization-20260511.md)
   训练效果目标对齐与模块优化矩阵：从“可运行 demo”转向“范式正确、可训练、可复盘”的下一阶段优化基线。
23. [23-attention-p0a-trainingization-report-20260511.md](23-attention-p0a-trainingization-report-20260511.md)
   注意力 P0-A 训练化实施记录：Stroop、Flanker、CPT 的数据契约、范式指标、反馈闭环和验收结果。
24. [24-memory-p0b-trainingization-report-20260511.md](24-memory-p0b-trainingization-report-20260511.md)
   工作记忆 P0-B 训练化实施记录：N-Back、Corsi 的训练目标、数据契约、验证结果、残余风险和下一步。
25. [25-inhibition-search-risk-p0c-p0d-report-20260511.md](25-inhibition-search-risk-p0c-p0d-report-20260511.md)
   抑制控制、视觉搜索与风险决策 P0-C/P0-D 实施记录：Stop Signal、Go/No-Go、Schulte、BART 的范式指标、数据契约、反馈闭环和验收结果。
26. [26-report-smoke-and-adaptive-prescription-20260511.md](26-report-smoke-and-adaptive-prescription-20260511.md)
   报告展示、Smoke 门禁与自适应处方实施记录：报告页指标优先级、关键页面静态验收、N-Back/Corsi 下一轮训练处方。
27. [27-executive-memory-reasoning-trainingization-report-20260511.md](27-executive-memory-reasoning-trainingization-report-20260511.md)
   执行功能、记忆与推理模块训练化实施记录：Task Switching、Digit Span、Mental Rotation、Raven、WCST、Reversal Learning 的范式指标、数据契约、反馈闭环和验收结果。
28. [28-practical-training-loop-and-planning-report-20260511.md](28-practical-training-loop-and-planning-report-20260511.md)
   实际训练闭环与规划能力补全实施记录：报告页训练反馈、每日训练计划、流程 smoke、Iowa 和 Hanoi 深化。
29. [29-training-body-strengthening-nback-adaptive-20260511.md](29-training-body-strengthening-nback-adaptive-20260511.md)
   训练本体强化实施记录：根据“不要固定 demo、要真实有效训练”的主线，为 N-Back 增加自适应 staircase、敏感性指标和负荷曲线门禁。
30. [30-training-body-strengthening-adaptive-batch-20260511.md](30-training-body-strengthening-adaptive-batch-20260511.md)
   训练本体再强化实施记录：Corsi、Digit Span、Task Switching、Go/No-Go、Mental Rotation、Raven 的自适应难度、参数化内容、诊断指标和流程门禁收口。
31. [31-github-submit-runbook-20260512.md](31-github-submit-runbook-20260512.md)
   GitHub 提交与推送经验记录：当前仓库口径、提交前门禁、网络失败判断顺序、代理全局模式排查项，以及普通 push 不通时的 GitHub API 备用路径。
32. [32-training-body-completeness-roadmap-20260512.md](32-training-body-completeness-roadmap-20260512.md)
   训练项目本体完备性全面迭代计划：成熟度标准、剩余模块优先级、多 agent 闸门、分批执行路线和验收门禁。
33. [33-work-log-20260512.md](33-work-log-20260512.md)
   今日工作记录：训练本体强化提交、GitHub 推送经验、后续路线图和当前未提交文档状态。
34. [34-agent-standard-hardening-and-p0-training-20260512.md](34-agent-standard-hardening-and-p0-training-20260512.md)
   Agent 标准门禁与 P0 训练本体强化记录：多 agent 写集、发布隐私加固、运行时边界、规划/社会决策模块 trial 数据和验收门禁。
35. [35-attention-system-loop-and-trend-feedback-20260513.md](35-attention-system-loop-and-trend-feedback-20260513.md)
   注意力系统级训练闭环与趋势反馈计划：把注意力模块从单页指标推进到系统级画像、跨 session 趋势和下一轮训练处方。
36. [36-attention-loop-round1-review-20260513.md](36-attention-loop-round1-review-20260513.md)
   注意力系统画像闭环第一轮复盘与第二轮计划：helper 合约、报告页系统画像、回归门禁和规划训练第二轮入口。
37. [37-attention-loop-round2-depth-gates-20260513.md](37-attention-loop-round2-depth-gates-20260513.md)
   注意力与规划训练第二轮深化与第三轮门禁计划：London Tower BFS 校验、Sliding Puzzle 精确解距和深度 smoke 门禁。
38. [38-training-body-round3-creativity-social-calibration-20260513.md](38-training-body-round3-creativity-social-calibration-20260513.md)
   训练本体第三轮收口：创造力、社会认知与校准门禁强化，多 agent 单文件收口、训练深度 smoke 扩展与全量验证结论。
39. [39-training-loop-round4-report-plan-runtime-20260513.md](39-training-loop-round4-report-plan-runtime-20260513.md)
   训练本体第四轮计划：报告页与 Daily Plan 的运行时消费、反馈信号门禁和阈值校准口径。
40. [40-training-loop-round5-trend-cycle-20260515.md](40-training-loop-round5-trend-cycle-20260515.md)
   训练本体第五轮：跨 session 趋势闭环、真实训练 smoke 收口与训练本体继续深化。

## 源汇总镜像

以下文档已从源目录镜像到当前 `doc/`，可直接在仓库内查阅：

1. [source-glm5-summary-index.md](source-glm5-summary-index.md)  
   来源：`glm5/汇总/INDEX.md`
2. [source-gpt-glm5-comprehensive.md](source-gpt-glm5-comprehensive.md)  
   来源：`gpt/汇总/GLM5_GPT_综合详细文档.md`
3. `doc/glm5-game-specs/`  
   来源：`glm5/modules/`（按目录结构镜像的游戏说明文档）

## 当前统一结论（摘要）

1. 训练任务基线以 `glm5/汇总/INDEX.md` 为准：10 大系统、36 个训练模块。
2. 平台全量口径保留 40 项：在 36 个训练模块基础上，补充 2 个工具模块（UTI）和 2 个辅助评估模块（AUX）。
3. `GLM5_GPT_综合详细文档.md` 中提出的编号冲突意见，在最新 `glm5/汇总` 里已部分消解（CRE 与 SOC 已重排为连续编号）。
4. 统一维护顺序为：模块详述 -> 系统索引 -> 汇总索引 -> 本系列文档。

## 文档版本

- 版本：`v1.13`
- 生成日期：`2026-05-15`
- 适用范围：`glm5` 与 `gpt` 文档体系融合
