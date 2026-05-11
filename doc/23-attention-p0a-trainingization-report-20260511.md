# 注意力 P0-A 训练化实施记录（2026-05-11）

## 1. 本轮目标

本轮按 `22-training-effect-alignment-and-module-optimization-20260511.md` 的 P0 批次，先改造 3 个注意力主干模块：

- `stroop.html` / `stroop.js`
- `flanker.html` / `flanker.js`
- `cpt.html` / `cpt.js`

目标不是扩展新游戏，而是把已有模块从“可运行 demo”推进到“可训练、可复盘、可解释”的范式化训练。

## 2. 共享结果存储增强

`src/shared/training-results.js` 已增强 `TrainingResults.saveSession` 的归一化逻辑：

- 原生保留顶层 `seed`
- 原生保留顶层 `contentVersion`
- 如果调用方只把这些字段放在 `summary` 或 `metrics`，共享层会兜底提取到顶层

这避免各训练页直接补写 `localStorage`，后续模块统一走共享数据契约。

## 3. Stroop

完成项：

- 页面加载 `src/shared/seeded-random.js`
- 刺激生成接入 seed 派生 RNG
- 真实混合 `congruent` 与 `incongruent` 条件，默认约 35% 一致条件
- 手动模式从“自我计时”改为逐 trial 点击颜色作答
- 每条 trial 记录 `condition`、`stimulusText`、`stimulusColor`、`correctResponse`、`response`、`correct`、`rtMs`、`timedOut`
- `summary` 输出正确率、平均反应、分条件反应时、`stroopEffectMs`、错误数
- 结束弹窗解释正确率、反应速度和语义干扰成本，并提供“重新训练一轮”

剩余风险：

- 语音模式仍依赖浏览器 `SpeechRecognition` 与麦克风权限，需要真实浏览器权限抽样
- 早停时未完成 trial 的统计口径后续可继续细分为 `notPresented` 与 `timedOut`

## 4. Flanker

完成项：

- 页面加载 `src/shared/seeded-random.js`
- 生成可复现 trial plan，并平衡 `congruent` / `incongruent`
- 每条 trial 记录 `condition`、`targetDirection`、`flankerDirection`、`correctResponse`、`response`、`correct`、`rtMs`、`timedOut`
- `summary` 输出分条件正确率、分条件反应时、`flankerEffectMs`、错误数、超时数和错误类型
- 结束反馈解释干扰成本和主要错误来源
- 顶层、`summary`、`metrics` 均保留 `seed/contentVersion`

剩余风险：

- 尚未做真实浏览器点击完整通关，只完成静态检查和代码审计

## 5. CPT

完成项：

- 页面加载 `src/shared/seeded-random.js`
- 刺激生成接入 seed 派生 RNG
- 每条 trial 记录 `stimulus`、`isTarget`、`correctResponse`、`response`、`responded`、`correct`、`rtMs`、`timedOut`、`classification`
- `classification` 区分 `hit`、`miss`、`falseAlarm`、`correctRejection`
- `summary` 输出 target/non-target 试次数、hit/miss/false alarm/correct rejection、hit rate、false alarm rate、accuracy、mean RT、RT SD
- 结束反馈区分注意遗漏和冲动误按
- 结束瞬间会把当前已呈现但未响应 trial 记录为 miss 或 correct rejection，不再丢失最后一个 trial
- 顶层、`summary`、`metrics` 均保留 `seed/contentVersion`

剩余风险：

- CPT 标准时长为 2 分钟，真实浏览器通关需要专项抽样或测试模式

## 6. 验收结果

已通过：

- `node --check stroop.js`
- `node --check flanker.js`
- `node --check cpt.js`
- `node --check src/shared/training-results.js`
- `npm run check`

当前 `npm run check` 结果：

- `high=0`
- `medium=5`
- `low=17`
- `passed=14`

未完成：

- 尝试用 Playwright 做三页浏览器 smoke test，但当前项目环境无法解析 `@playwright/test`，临时测试文件已删除，未纳入仓库。
- 后续应把 Playwright 或等价浏览器测试作为正式 devDependency 或独立验收脚本，再覆盖“首页进入 -> 完成训练 -> 保存 session -> report 读取”链路。

## 7. 下一步

进入 P0-B：

1. `nback`：补 hit/miss/false alarm/correct rejection、负荷曲线、seed/contentVersion、trial 级序列记录
2. `corsi`：补 span progression、位置序列、复现序列、正/倒序边界、seed/contentVersion
3. 把浏览器 smoke test 作为独立基础设施任务处理，不再用临时脚本验证
