# 训练本体第四轮：报告页 / Daily Plan 运行时消费与阈值校准记录（2026-05-13）

## 1. 本轮目标

本轮不再继续证明“字段能不能落库”，而是把已经具备的训练结果信号推进到真正可用的消费层。

本轮目标有三件事：

1. 报告页从“显示字段存在”转向“稳定展示稳定性与质量信号”。
2. Daily Plan 从“生成计划”转向“消费下一步处方信号并给出可执行建议”。
3. 增加反馈信号门禁，检查消费端是否真的读取了训练质量、稳定性和下一步处方字段。

这轮的中心矛盾是：字段已经大体齐了，但消费端必须把这些字段变成用户能读懂、能依赖的训练闭环，否则训练项目仍然会退回“做完一局、给个分数”的 demo 形态。

## 2. 实际写集

本轮实际写集控制在下面这些文件边界内：

1. `report.js`
2. `daily-plan.js`
3. `scripts/smoke-feedback-signals.js`
4. `package.json`
5. `doc/39-training-loop-round4-report-plan-runtime-20260513.md`
6. `doc/INDEX.md`

未扩散到训练页本体大改、首页结构重排或新增独立训练模块。

## 3. 已落地内容

### 3.1 报告页

`report.js` 这一轮把更多训练质量和稳定性字段纳入报告页消费链路。

已接入的重点信号包括：

- `stop-signal`：阶梯质量、等待信号、策略性减速等抑制控制相关反馈。
- `nback`：负荷稳定性、N 水平振荡、反转次数、下一步练习建议。
- `corsi`：速度振荡、负荷稳定性、下一步处方理由。
- `digit-span`：广度稳定性、广度振荡、倒背 / 排序模式准备度。
- `sally-anne`、`eyes-reading`、`torrance`：题干 / 细节 / 词汇 / 混淆 / 解释反馈等更贴近任务本体的信号。

报告页同时增加了更保守的信号读取方式：优先从 `summary` 读取，其次从 `metrics` 和 session 顶层读取，避免模块输出结构轻微差异时直接丢失反馈。

### 3.2 Daily Plan

`daily-plan.js` 这一轮开始把训练结果里的下一步处方信号纳入计划生成。

已接入的重点包括：

- 读取 `nextRecommendedN`、`nextRecommendedSpeedMs`、`nextRecommendedRounds`、`nextStartSpan`、`nextMode`、`nextBlockCount` 等下一轮参数。
- 读取 `nextPracticeRecommendation`、`nextPrescriptionReason`，把模块给出的处方理由带入当日计划。
- 在计划卡片中显示“最近训练”提示，让用户看到计划不是静态列表，而是基于上一轮结果调整。
- 对低阶梯质量、高波动、等待信号、广度不稳定等情况增加巩固优先级，避免只按完成次数机械轮换。

这一步的意义是把“训练结果”变成“下一次训练入口”，让闭环更像可持续训练系统，而不是单局游戏分数页。

### 3.3 反馈信号门禁

新增 `scripts/smoke-feedback-signals.js`，并接入 `package.json` 的 `npm run check`。

门禁覆盖两类问题：

- 报告页是否读取并展示训练质量、稳定性、处方类反馈信号。
- Daily Plan 是否消费下一步处方字段，并将其用于计划生成与展示。

这不是完整的人工试玩验证，但它能防止后续改动把关键反馈字段“写了但没人用”的问题重新引入。

### 3.4 阈值修正

本轮修正了稳定性 / 质量类字段的比例值判断问题。

部分模块会输出 `0..1` 比例值，部分展示逻辑又按百分制理解。`report.js` 已将 `quality`、`stability`、`readiness`、`volatility` 等字段纳入百分比类展示与判断，并对 `staircaseQuality` 使用比例 / 百分制兼容阈值，避免把 `0.75` 这类合理质量误判为过低。

## 4. 验收结果

本轮验收口径盯住“消费效果”，不是只盯住“字段存在”。

已运行的验证命令：

```powershell
node --check report.js
node --check daily-plan.js
node --check scripts\smoke-feedback-signals.js
node scripts\smoke-feedback-signals.js
node scripts\smoke-training-loop.js
node scripts\smoke-training-depth.js
npm run check
git diff --check
```

验证结果：

- JS 语法检查通过。
- `scripts/smoke-feedback-signals.js` 通过，确认报告页和 Daily Plan 都在消费反馈信号。
- `scripts/smoke-training-loop.js` 通过。
- `scripts/smoke-training-depth.js` 通过。
- `npm run check` 通过，覆盖语法、敏感路径、页面 smoke、流程 smoke、反馈信号和 picky-player。
- `git diff --check` 无空白错误，仅出现 Windows 换行提示。

## 5. 残余风险

这一轮完成后，仍然保留三个明确风险：

1. 启发式阈值仍然需要真实 session 再校准。静态规则只能给出可用起点，不能证明长期稳定。
2. 静态 smoke 和运行时样例门禁不等于真人试玩。它们能证明消费链路更完整，但不能替代真实训练体验。
3. Daily Plan 当前已经能消费模块处方，但还没有形成跨周趋势模型。下一轮应继续推进“短期表现 -> 巩固 / 升阶 / 降负荷 -> 趋势复盘”的周期化训练策略。

## 6. 衔接关系

这轮的定位不是重新定义训练体系，而是把前几轮已经积累的字段和处方信号收进可用的消费层。

它承接的是前面几轮已经完成的三件事：

1. 训练结果字段逐步补齐。
2. 报告页开始具备反馈展示能力。
3. 日计划已经存在，下一步需要从“生成”走向“消费”。

下一轮的主线应继续围绕训练本体有效性推进：让更多模块输出可解释的过程指标，让计划页基于多次 session 做趋势判断，并用真实试玩记录校准阈值，而不是继续堆静态展示字段。
