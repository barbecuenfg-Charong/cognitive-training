# 实际训练闭环与规划能力补全实施记录（2026-05-11）

## 1. 本轮目标

上一轮已经把 Task Switching、Digit Span、Mental Rotation、Raven、WCST、Reversal Learning 推进到可复现、可落库、可解释。本轮不继续单纯扩模块，而是补“实际可用应用”的闭环：

1. 报告页从 session 列表升级为训练反馈页。
2. 首页新增每日训练计划入口。
3. 补一个可运行的流程 smoke，避免只检查脚本引用。
4. 深化下一批实际功能：Iowa Gambling 和 Hanoi。

## 2. 多 agent 分工

| 写集 | 负责人边界 | 结果 |
|---|---|---|
| `report.html` / `report.js` | 报告页训练反馈 | 完成 |
| `daily-plan.html` / `daily-plan.js` / `src/home/config.js` | 每日训练计划入口 | 完成 |
| `scripts/flow-smoke.js` / `package.json` | 流程级验收脚本 | 完成 |
| `iowa-gambling.html` / `iowa-gambling.js` | Iowa 长期收益训练化 | 完成 |
| `hanoi.html` / `hanoi.js` | Hanoi 规划指标补全 | 完成 |

主 agent 负责边界控制、收口指令、门禁接入、最终验证和文档。

## 3. 报告页训练反馈

改动文件：

- `report.html`
- `report.js`

新增能力：

- “训练反馈”区域：最近训练趋势、能力域概览、弱项识别、下一轮建议、最近 5 次表现提示。
- 兼容读取 `TrainingResults.getSessions()`、`getAllSessions()`、`getSessionsByDate()`。
- 按 `moduleId/gameId/tags` 推断能力域，避免只看游戏名。
- 文案聚焦下一轮练什么、怎么调参数，不做医学化或疗效承诺。
- 原日期筛选、今天按钮、清空记录和 session 表格保留。

## 4. 每日训练计划

新增文件：

- `daily-plan.html`
- `daily-plan.js`

改动文件：

- `src/home/config.js`

新增能力：

- 首页新增 active 入口“今日训练计划”。
- 无记录时给默认入门计划。
- 有记录时读取 `TrainingResults`，按注意力、工作记忆、执行功能、推理/空间、决策轮换。
- 避免总是推荐最近刚练过的同一项目。
- 每个计划项输出目标、建议参数、推荐理由和开始按钮。
- 支持 seed 的项目会带 `seed` 参数，便于同一计划内复盘。

## 5. 流程级 Smoke

新增文件：

- `scripts/flow-smoke.js`

改动文件：

- `package.json`
- `scripts/smoke-pages.js`

新增能力：

- `npm run smoke:flows` 覆盖 10 个关键流程：
  - Task Switching
  - Digit Span
  - Mental Rotation
  - Raven
  - WCST
  - Reversal Learning
  - Iowa
  - Hanoi
  - Report
  - Daily Plan
- 检查 HTML 关键 DOM id、主脚本、shared 脚本顺序、JS 中的 `TrainingResults.saveSession`、`seed/contentVersion`、核心指标字段。
- `npm run check` 已接入 `smoke:flows`，避免流程 smoke 只作为手动脚本存在。
- `smoke:pages` 已扩展到 17 个页面，新增 Iowa、Hanoi、Daily Plan。

## 6. Iowa Gambling 深化

改动文件：

- `iowa-gambling.html`
- `iowa-gambling.js`

新增能力：

- 增加 `seed/contentVersion`，优先使用 `window.SeededRandom`，并提供本文件 fallback。
- 明确 A/B/C/D 牌堆的 gain/loss 结构。
- 每轮保存 `card`、`deck`、`gain`、`loss`、`net`、`blockIndex`。
- summary/metrics 保存：
  - `totalNet`
  - `advantageousChoices`
  - `disadvantageousChoices`
  - `advantageousMinusDisadvantageous`
  - `blockNetScores`
  - `blockChoiceBalance`
  - `learningTrend`
  - `seed/contentVersion`
- 结果页解释用户是否从短期高收益牌堆转向长期有利牌堆。

## 7. Hanoi 深化

改动文件：

- `hanoi.html`
- `hanoi.js`

新增能力：

- 保留现有撤销/重做交互。
- summary/trials 增加：
  - 最优步数
  - 实际步数
  - 超额步数
  - 非法操作
  - 撤销/回退次数
  - 重做次数
  - 首次移动延迟
  - 重复状态/循环
  - 偏离最优路径
- `TrainingResults.saveSession` 保存 `summary`、`trials`、`metrics`、`tags`、`seed`、`contentVersion`、`puzzleConfig`。
- 结果弹窗解释计划效率、回退行为和偏离最优路径。

## 8. 验证结果

已执行：

```powershell
npm run smoke:pages
npm run smoke:flows
npm run check
```

结果：

- `npm run smoke:pages`：17 passed, 0 failed。
- `npm run smoke:flows`：10 passed, 0 failed。
- `npm run check`：通过。
- `check:picky-player`：`high=0, medium=5, low=18, passed=14`，fail threshold 为 high。

## 9. 残余风险

1. 本轮已经把结构 smoke 和流程 smoke 接入门禁，但仍不是 Playwright 级真实点击回归。
2. Daily Plan 现在是本地规则引擎，后续可进一步把用户连续多日趋势纳入计划生成。
3. Iowa 和 Hanoi 的指标已经可落库，但报告页对这两个模块的趋势解释仍可继续细化。
4. 创造力与社会认知类开放任务仍应后置，先明确评分边界，避免伪精确评分。

## 10. 下一步建议

1. 对 Daily Plan -> 训练页 -> Report 做真实浏览器通关抽样。
2. 把报告页的“下一轮建议”进一步落到 Daily Plan 的排序权重里。
3. 继续深改 London Tower、Sliding Puzzle、Focus。
4. 在稳定网络窗口统一提交并推送 GitHub。
