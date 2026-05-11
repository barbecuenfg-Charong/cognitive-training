# TrainingResult v1 数据契约

本文档定义训练结果在本地 `localStorage` 中的最低兼容结构。后续趋势图、日报、账号同步和参数化模块都以本契约为基础。

## 存储位置

| 项 | 值 |
|----|----|
| 存储介质 | `localStorage` |
| key | `cognitive-training:sessions` |
| 写入入口 | `src/shared/training-results.js` |
| schema version | `training-result-v1` |

## 字段定义

```javascript
{
  schemaVersion: "training-result-v1",
  id: "1715350000000-abc123",
  moduleId: "task-switching",
  gameId: "task-switching",
  gameName: "任务切换",
  startedAt: "2026-05-10T13:00:00.000Z",
  finishedAt: "2026-05-10T13:02:00.000Z",
  durationMs: 120000,
  score: 85,
  summary: {
    totalTrials: 40,
    correctCount: 34,
    accuracy: 0.85,
    meanRtMs: 620
  },
  trials: [
    {
      index: 0,
      rtMs: 610,
      correct: true
    }
  ],
  metrics: {
    accuracy: "85%",
    meanRT: "620ms"
  },
  tags: ["executive", "task-switching"]
}
```

## 规则

1. `moduleId` 是后续跨页面统计的主键，新增模块必须显式传入。
2. `gameId` 保留向后兼容，默认等于 `moduleId`。
3. `summary` 放结构化指标，用于报表和趋势图。
4. `metrics` 只保留展示友好的少量字段，用于旧报表兼容，不作为长期分析主数据。
5. `trials` 可为空，但如果存在，单场最多保存 500 条，避免 localStorage 过大。
6. 开放题、语音题和图片题不得把原始隐私内容无节制写入 `trials`；优先保存计数、评分和题目 id。
7. 所有时间统一保存 ISO 字符串。

## 当前实现状态

`src/shared/training-results.js` 已兼容该结构：

- 自动补 `schemaVersion`
- 自动补 `moduleId`
- 保留旧的 `gameId/gameName/score/metrics/tags`
- 支持 `summary`
- 支持最多 500 条 `trials`

## 后续模块接入要求

接入统一结果存储时，训练页至少提供：

```javascript
window.TrainingResults.saveSession({
  moduleId: "module-id",
  gameId: "module-id",
  gameName: "中文名",
  startedAt,
  finishedAt,
  durationMs,
  score,
  summary: {
    totalTrials,
    correctCount,
    accuracy,
    meanRtMs
  },
  trials,
  metrics,
  tags
});
```

## 与 13/14 的关系

`13/14` 中的参数化生成、训练曲线和自适应难度都必须以本 schema 输出结果。蒙提霍尔样板通过后，再复制到基率忽略、赌徒谬误、贝叶斯更新等概率模块。

