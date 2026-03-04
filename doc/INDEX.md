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

- 版本：`v1.1`
- 生成日期：`2026-03-04`
- 适用范围：`glm5` 与 `gpt` 文档体系融合
