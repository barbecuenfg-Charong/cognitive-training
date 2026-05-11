# 执行功能、记忆与推理模块训练化实施记录（2026-05-11）

## 1. 本轮目标

本轮延续 `22-training-effect-alignment-and-module-optimization-20260511.md` 的原则：不再把游戏数量作为主要成果，而是把经典认知范式改造成可复现、可落库、可解释、可迭代的训练工具。

本轮覆盖 6 个模块：

| 模块 | 训练目标 | 本轮定位 |
|---|---|---|
| Task Switching | 认知灵活性、任务集转换 | 从随机出题改为平衡 repeat/switch 的可复现训练 |
| Digit Span | 数字短时记忆广度 | 记录正背/倒背、span progression 与下一轮处方 |
| Mental Rotation | 空间旋转速度与准确性 | 平衡角度和镜像条件，输出角度斜率 |
| Raven | 抽象推理、规则归纳 | 小步补强可复现选项、规则追踪和唯一答案校验 |
| WCST | 规则发现、集合转换、持续错误控制 | 保存隐藏规则、规则切换、持续错误和集合维持 |
| Reversal Learning | 奖励概率变化后的策略更新 | 保存反转点、概率奖励、win-stay/lose-shift 与适应速度 |

## 2. 多 agent 分工与边界

本轮采用主 agent 统筹、worker 分模块写集的方式推进。每个 worker 只允许修改对应模块的 HTML/JS；主 agent 只处理异常纠偏、集成门禁、报告页指标和文档。

过程中出现过两个 worker 留下删除中间态：

- `task-switching.js`
- `reversal-learning.js`

处理原则是立即打断并恢复，不允许审计或集成基于中间态做结论。最终 `reversal-learning` 由 worker 完成；`task-switching` 因 worker 无产出，改由主 agent 收口实现。

## 3. 模块实施结果

### 3.1 Task Switching

改动文件：

- `task-switching.js`
- `task-switching.html`

核心变化：

- 新增 `CONTENT_VERSION = "task-switching-balanced-csi-v1"`、session seed 和本文件 fallback RNG。
- 生成平衡的 `repeat/switch` trial plan，记录 `task`、`number/stimulus`、`condition`、`expectedResponse`、`cueDelayMs`。
- 结果保存 `repeatRT`、`switchRT`、`switchCostMs`、`repeatAccuracy`、`switchAccuracy`、`switchErrorCost`、`tooFastCount`。
- 过快响应不再让流程卡住，而是作为 `too_fast` 错误试次记录并推进。
- 结果页补充对切换成本和切换准确率的解释反馈。

### 3.2 Digit Span

改动文件：

- `digit-span.js`
- `digit-span.html`

核心变化：

- 加载 `src/shared/seeded-random.js`，每轮保存 `seed/contentVersion`。
- 每个 trial 用 `sequenceId` 派生可复现数字序列。
- trial 记录 `span`、`attempt`、`sequence`、`response`、`correct`、`exactAccuracy`、`positionAccuracy`、`responseDurationMs`。
- summary/metrics 保存 `maxSpan/finalSpan`、`maxAttemptedSpan`、`sequenceMode`、`spanProgression`、下一轮 `nextStartSpan/nextMode/nextPrescriptionReason`。

### 3.3 Mental Rotation

改动文件：

- `mental-rotation.js`
- `mental-rotation.html`

核心变化：

- 新增 seed/contentVersion 和 fallback RNG。
- 20 轮 trial plan 改为 `5 个 angleDiff x mirror/nonMirror x 2 次` 的平衡结构。
- trial 记录 `angleDiff`、`mirror`、`response`、`correct`、`rtMs`、`condition`、`stimulusId`、`angle1/angle2`。
- summary/metrics 输出 `accuracyByAngle`、`meanRtByAngle`、`angleSlopeMsPerDegree`、`mirrorAccuracy/nonMirrorAccuracy`。
- 结果反馈解释角度增加是否带来明显变慢或变错。

### 3.4 Raven

改动文件：

- `raven.js`
- `raven.html`

核心变化：

- 新增 `CONTENT_VERSION = "raven-v2-seeded-options-validation"`。
- distractor 选择和选项顺序改为 seeded RNG。
- trial 保存 `ruleId/rule/puzzleType`、`optionCount`、`correctOptionIndex`、`selectedOptionIndex`、`errorType`、`rtMs`。
- 增加唯一答案校验，异常进入 `validationIssueCount` 和 `validationIssues`。
- summary/metrics 保存 `ruleBreakdown/accuracyByRule`、`validationIssueCount`、`seed/contentVersion`。
- 本轮不重写大型题目生成器，避免把高风险生成器和训练闭环混在一起。

### 3.5 Wisconsin Card Sorting

改动文件：

- `wisconsin-card.js`
- `wisconsin-card.html`

核心变化：

- 新增 seed/contentVersion 和 fallback RNG。
- 卡牌序列、初始隐藏规则、规则切换流程可复现。
- trial 记录 `card`、`selectedDeck/target`、`hiddenRule`、`feedback`、`isPerseverative`、`rtMs`、`categoryIndex`、`ruleBefore/ruleAfter`。
- summary/metrics 保存 `categoriesCompleted`、`perseverativeResponses`、`perseverativeErrors`、`perseverativeErrorRate`、`setLosses`。
- 结果页区分普通错误、持续性错误和集合维持丢失。

### 3.6 Reversal Learning

改动文件：

- `reversal-learning.js`
- `reversal-learning.html`

核心变化：

- 新增 `CONTENT_VERSION = "reversal-learning-seeded-schedule-v1"`。
- 固化 `REVERSAL_POINT = 20` 和 0.8/0.2 -> 0.2/0.8 的概率奖励 schedule。
- trial 记录 `phase`、`choice`、`optimalChoice`、`rewardProbability`、`rewarded/gain`、`winStay`、`loseShift`、`perseverativeAfterReversal`、`rtMs`。
- summary/metrics 保存 `preReversalAccuracy`、`postReversalAccuracy`、`adaptationTrials`、`winStayRate`、`loseShiftRate`、`perseverationRate`。
- 结果页解释反转后适应速度和策略倾向。

## 4. 集成改动

| 文件 | 改动 |
|---|---|
| `report.js` | 新增本轮 6 个模块的指标优先级和中文标签。 |
| `scripts/smoke-pages.js` | 将本轮 6 个模块加入页面 smoke，检查主脚本、`training-results.js` 和 `seeded-random.js` 引用。 |
| `package.json` | 将 `wisconsin-card.js` 和 `reversal-learning.js` 纳入 `check:syntax`。 |

## 5. 验证结果

已执行：

```powershell
npm run smoke:pages
npm run check
git diff --check
```

结果：

- `npm run smoke:pages`：14 passed, 0 failed。
- `npm run check`：通过。
- `check:picky-player`：`high=0, medium=5, low=17, passed=14`，fail threshold 为 high。
- `git diff --check`：无 whitespace 错误；仅有 Git 的 LF/CRLF 工作区提示。

## 6. 残余风险

1. 本轮主要完成结构化训练闭环，尚未做真实浏览器逐项交互回归。
2. Raven 仍是保守增强：唯一答案校验和规则追踪已补上，但题目生成器还不是完整的程序化矩阵系统。
3. 报告页目前能展示关键指标，但还不是长期趋势面板；跨 session 趋势、弱项识别和训练计划仍在下一阶段。
4. `picky-player` 仍有 5 个 medium 风险，虽然不阻断本轮，但后续应继续压低。

## 7. 下一步建议

1. 用浏览器对本轮 6 个模块做人工通关抽样，重点确认按钮、结果弹窗、移动端输入和落库内容。
2. 将 `TrainingResults` 中的本轮指标接入趋势视图，而不是只在 session 摘要里显示。
3. 对 Raven 单独开一轮题目模板/唯一答案生成器设计，不和其他模块混做。
4. 下一批可转向 Iowa Gambling、Hanoi、London Tower、Sliding Puzzle；开放创造力任务继续后置，先明确评分边界。
