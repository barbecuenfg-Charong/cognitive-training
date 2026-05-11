# 训练本体再强化：多模块自适应训练批次实施记录（2026-05-11）

## 1. 本轮目标

用户最近明确的主线不是“把页面做出来”，而是让训练本身真的起作用。

从第一性原理看，训练有效性至少要满足四件事：

1. 难度要会跟着表现变，不是固定题面。
2. 题目要有参数化变化，不是同一套内容循环播放。
3. 结果要能区分“对/错”之外的诊断信息。
4. 下一轮要能给出具体处方，而不是只给一个总分。

所以本轮不再扩外围 demo，而是集中加强 6 个训练本体：

- Corsi
- Digit Span
- Task Switching
- Go/No-Go
- Mental Rotation
- Raven

## 2. 主要改动

### 2.1 Corsi

- 增加自适应 staircase。
- 记录 `sessionType: adaptive-staircase`。
- 落库 `startingSpan`、`minSpan`、`finalSpan`、`adaptationEvents`。
- 结果页和报告页能看到这轮 span 是怎么变化的。

### 2.2 Digit Span

- 支持 `forward / backward / sorted` 三种模式。
- 用正确率和位置正确率驱动难度调整。
- 保存 `startingSpan`、`minSpan`、`maxSpan`、`maxAttemptedSpan`、`sequenceMode`、`adaptationEvents`。
- 让训练从“背一串数字”变成“围绕工作记忆边界做分层负荷训练”。

### 2.3 Task Switching

- 把固定切换任务改为自适应切换训练。
- 按 block 调整 `switchProbability` 和 `cueDelayMs`。
- 保存 `startingSwitchProbability`、`finalSwitchProbability`、`startingCueDelayMs`、`finalCueDelayMs`、`adaptationEvents`。
- 把转换成本真正纳入训练闭环，而不只是统计一个平均反应时。

### 2.4 Go/No-Go

- 增加 No-Go 比例、刺激时长、ISI 的自适应联动。
- 保留并强化 `dPrime`、`criterion` 这类信号检测指标。
- 保存 `finalNoGoRatio`、`finalStimulusDuration`、`finalIsiRange`、`adaptationEvents`、`speedProgression`、`ratioProgression`。
- 让“抑制控制”不只是按不按键，而是能调负荷、看判别力。

### 2.5 Mental Rotation

- 增加角度集和镜像比例的自适应进程。
- 保存 `angleSetProgression`、`mirrorRatioProgression`、`finalMirrorRatio`、`adaptationEvents`。
- 让空间旋转训练不再是固定角度题库，而是能围绕难度边界推进。

### 2.6 Raven

- 强化规则模板生成和模板级统计。
- 保存 `generatedTemplateCount`、`ruleTemplateId`、`accuracyByTemplate`、`validationIssueCount`。
- 训练从“做几道矩阵题”升级为“按规则模板生成并验证的推理训练”。

## 3. 配套基础

### 3.1 流程门禁

新增并补齐 `scripts/flow-smoke.js` 覆盖：

- Corsi
- Digit Span
- Task Switching
- Go/No-Go
- Mental Rotation
- Raven

现在 `npm run smoke:flows` 不只看页面能不能开，还会检查这些模块是否真的保存了自适应字段和关键训练指标。

### 3.2 报告页

`report.js` 做了两类增强：

- 比例/概率类指标按百分比显示。
- 数组和对象类指标可以展示为简短摘要，不再完全空白。

这让 `finalNoGoRatio`、`finalSwitchProbability`、`finalMirrorRatio`、`accuracyByTemplate`、`adaptationEvents` 这些训练有效性信息能在报告页直接被读到。

## 4. 验证结果

已执行：

```powershell
node --check scripts/flow-smoke.js
node --check report.js
node --check corsi.js
node --check digit-span.js
node --check task-switching.js
node --check go-no-go.js
node --check mental-rotation.js
node --check raven.js
npm run smoke:pages
npm run smoke:flows
npm run check
git diff --check
```

结果：

- `npm run smoke:pages`：17 passed, 0 failed。
- `npm run smoke:flows`：13 passed, 0 failed。
- `npm run check`：通过。
- `git diff --check`：无实质格式错误，仅有 LF/CRLF 提示。

## 5. 这轮的结论

这轮不是把几个小游戏“做得更热闹”，而是把训练从静态演示推进到真实训练闭环：

- 题目会变。
- 难度会调。
- 错误会分型。
- 下一轮有处方。
- 报告能读出训练变化。

这才是后续继续扩展到其他模块时应当沿用的标准。

## 6. 下一步建议

1. 继续补尚未做到真正自适应的训练模块。
2. 把 Daily Plan 的推荐权重进一步和这些自适应结果联动。
3. 做一次真实浏览器抽测，确认“结果页看到的训练变化”与用户实际体感一致。
