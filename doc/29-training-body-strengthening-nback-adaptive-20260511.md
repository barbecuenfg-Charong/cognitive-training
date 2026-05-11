# 训练本体强化：N-Back 自适应负荷实施记录（2026-05-11）

## 1. 本轮决策

本轮从用户最近反复强调的主线出发：训练游戏要真的起到作用，不应停留在固定题目、固定难度、固定模式的小 demo。

本地文档中的关键判断：

- `13-external-solutions-research.md`：从 Demo 到可用训练工具的核心跨越，是把写死内容改为参数化/程序化生成，并增加自适应难度。
- `22-training-effect-alignment-and-module-optimization-20260511.md`：有效训练最低标准包括范式正确、难度可调、数据可复盘、反馈可解释。
- `24-memory-p0b-trainingization-report-20260511.md`：N-Back 当时仍是 `fixed-level`，`nProgression` 已记录但不是真正的自适应 staircase；下一步要把升降级规则落到实现。

因此本轮不优先继续做报告、入口、发布等外围事项，而是先补一个最典型的训练本体缺口：N-Back 的真实自适应负荷。

## 2. 改动范围

改动文件：

- `nback.html`
- `nback.js`
- `report.js`
- `scripts/flow-smoke.js`

## 3. N-Back 本体强化

### 3.1 自适应 staircase

新增默认启用的“自适应负荷”模式。

规则：

- 以用户输入的 N 作为起始 N。
- 每 10 轮形成一个评估 block。
- block 内根据命中率、误报率、总体准确率判断负荷是否合适。
- 表现稳定时升 N；N 到上限后缩短刺激间隔。
- 表现过低或遗漏严重时降 N；误报偏高时优先放慢速度。
- 训练过程中显示当前 N。

这使 N-Back 从“固定 N 的小测验”变成“围绕用户表现寻找训练区间”的任务。

### 3.2 保存负荷曲线

`summary` 和 `metrics` 现在保存：

- `sessionType: "adaptive-staircase"`
- `isAdaptive`
- `startingNLevel`
- `finalNLevel`
- `minNLevel`
- `maxNLevel`
- `adaptationBlockSize`
- `adaptationEvents`
- `nProgression`
- `startingStimulusDurationMs`
- `finalStimulusDurationMs`

`adaptationEvents` 保存每次调整的：

- 发生在第几轮之后
- from/to N
- from/to speed
- 调整方向
- 调整理由
- block 内 hit rate、false alarm rate、accuracy、d-prime、criterion

## 4. 敏感性指标

新增信号检测论指标：

- `dPrime`
- `criterion`
- `adjustedHitRate`
- `adjustedFalseAlarmRate`

这样 N-Back 不再只看总准确率，而能区分：

- 漏选型：目标保持/更新不稳定。
- 误报型：匹配判断过急或反应抑制不足。
- 敏感性不足：目标与非目标区分能力弱。
- 判别标准偏保守或偏激进。

## 5. 反馈变化

结果反馈现在包含：

- 命中/遗漏情况。
- 误报情况。
- `dPrime` 和 `criterion`。
- 本轮是否使用自适应 staircase。
- N 从多少调整到多少。
- 记录了多少次负荷评估。
- 下一轮建议的 N、速度和轮次。

## 6. 门禁变化

`scripts/flow-smoke.js` 新增 N-Back 流程检查，覆盖：

- `adaptive-mode`
- `current-n`
- `final-training-feedback`
- `adaptive-staircase`
- `maybeAdjustDifficulty`
- `adaptationEvents`
- `finalNLevel`
- `dPrime`
- `criterion`

避免后续把 N-Back 退回固定模式而门禁仍然通过。

## 7. 验证结果

已执行：

```powershell
node --check nback.js
node --check report.js
npm run smoke:pages
npm run smoke:flows
npm run check
```

结果：

- `node --check nback.js`：通过。
- `node --check report.js`：通过。
- `npm run smoke:pages`：17 passed, 0 failed。
- `npm run smoke:flows`：11 passed, 0 failed。
- `npm run check`：通过。

## 8. 后续同类原则

后续强化训练本体时，优先顺序应是：

1. 固定难度 -> 自适应难度。
2. 固定题库 -> 参数化/程序化生成。
3. 总分 -> 条件指标、错误类型和敏感性指标。
4. 一次性反馈 -> 下一轮具体训练处方。

下一批建议按同样原则处理：

- Raven：从 seeded 选项继续推进到规则模板生成，而不是只扩题库。
- Focus：把目标密度、干扰强度、视野范围参数化。
- Mental Rotation：加入自适应角度/镜像难度。
- Task Switching：按表现调整 switch/repeat 比例和 cue-stimulus interval。
