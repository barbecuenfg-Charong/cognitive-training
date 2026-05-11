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

- 版本：`v1.4`
- 生成日期：`2026-05-10`
- 适用范围：`glm5` 与 `gpt` 文档体系融合
