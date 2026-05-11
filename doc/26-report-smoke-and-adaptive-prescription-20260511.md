# 报告展示、Smoke 门禁与自适应处方实施记录（2026-05-11）

## 1. 本轮目标

本轮目标是补齐“训练完成后真正用起来”的闭环：

- 报告页能优先展示关键训练指标，而不是只显示通用字段。
- 项目有轻量 smoke 门禁，能发现关键页面和脚本引用断裂。
- N-Back 与 Corsi 给出结构化下一轮训练处方。

本轮不扩展新训练项目，优先让已有训练数据能被读取、解释和指导下一轮训练。

## 2. Report 指标展示

改动文件：

- `report.js`

已落地：

- 扩展 `MODULE_METRIC_KEY_GROUPS`。
- `moduleMetricGroups()` 新增模块识别：
  - `stop-signal`
  - `go-no-go`
  - `schulte`
  - `balloon-risk`
  - `nback`
  - `corsi`
  - `stroop`
  - `flanker`
  - `cpt`
- 保留 `base-rate` 和 `bayes-update` 原有分支。
- 新增中文指标标签，覆盖 SSRT、dPrime、criterion、scan stability、adjusted avg pumps、N-Back/Corsi 下一轮处方等字段。
- 模块指标展示上限从 6 调整到 7，避免关键专属指标被通用字段挤掉。

结果：

- report 表格的 metrics 单元现在优先显示训练相关核心指标。
- N-Back / Corsi 的结构化下一轮处方会进入报告摘要。

## 3. Smoke 门禁

改动文件：

- `scripts/smoke-pages.js`
- `package.json`

已落地：

- 新增 `npm run smoke:pages`。
- 覆盖 8 个关键页面：
  - `stop-signal.html`
  - `go-no-go.html`
  - `schulte.html`
  - `balloon-risk.html`
  - `nback.html`
  - `corsi.html`
  - `report.html`
  - `index.html`
- 检查内容：
  - HTML 可读。
  - 页面引用的本地 JS/CSS 文件存在。
  - 关键训练页必须引用 `training-results.js`、`seeded-random.js` 和各自主脚本。
  - report 页必须引用 `training-results.js` 和 `report.js`。
  - index 页必须引用 `src/home/index.js`。
- `scripts/smoke-pages.js` 已纳入 `npm run check` 的语法检查。

边界：

- 当前 smoke 是静态门禁，不是浏览器真实交互测试。
- 它能发现页面引用断裂，但不能验证点击流程、localStorage 保存和 report 页运行时读取。

## 4. N-Back 自适应处方

改动文件：

- `nback.js`

已落地：

- `summary` 增加：
  - `nextRecommendedN`
  - `nextRecommendedSpeedMs`
  - `nextRecommendedRounds`
  - `nextPrescriptionReason`
- 处方规则基于现有 `loadAssessment`：
  - `tooHigh`：降低 N，放慢速度。
  - `possiblyHigh`：保持或小降 N，放慢速度。
  - `unstableControl`：保持 N，放慢速度，优先降低误报。
  - `readyToIncrease`：提高 N；若已到上限则增加轮次或小幅提速。
  - `appropriate`：保持当前设置。
- 结果反馈展示“下一轮处方”。
- `metrics` 保存上述处方字段。

## 5. Corsi 自适应处方

改动文件：

- `corsi.js`

已落地：

- `summary` 增加：
  - `nextStartSpan`
  - `nextMode`
  - `nextBlockCount`
  - `nextPrescriptionReason`
- 处方规则：
  - `manual_stop` 或样本不足：复用当前设置，先完成可计入序列。
  - 正向高准确且 `finalSpan >= 6`：建议切换逆向回忆。
  - 正确率达标：小幅提高起始长度。
  - 顺序错误偏多：优先正向模式稳定顺序。
  - 低准确且最终广度不超过起始长度：降低起始长度或从逆向回到正向。
- 结果反馈展示结构化处方。
- `metrics` 保存上述处方字段。

## 6. 验收结果

已通过：

- `node --check report.js`
- `node --check scripts/smoke-pages.js`
- `node --check nback.js`
- `node --check corsi.js`
- `npm run smoke:pages`
- `npm run check`
- `git diff --check`

当前 `npm run smoke:pages`：

- `8 passed`
- `0 failed`

当前 `npm run check`：

- `high=0`
- `medium=5`
- `low=17`
- `passed=14`

## 7. 审计结论

最终态审计没有发现阻断问题。

审计指出的低风险项是 smoke 脚本可能漏掉页面主脚本引用被误删的情况。已修复：每个关键页面现在都把主脚本纳入 `requiredScripts`。

## 8. 下一步

1. 增加真正的浏览器交互 smoke test，覆盖“开始训练 -> 完成 -> 保存 -> report 读取”。
2. 把 report 从单日表格推进到跨 session 趋势，尤其是 N-Back/Corsi 的处方变化。
3. 对 N-Back/Corsi 增加可选“应用上轮处方”的入口，把处方从显示推进到实际预填参数。
4. 再处理 Raven 题目生成和唯一答案校验，避免和当前闭环建设混在一起。
