# 基础加固实施记录（2026-05-10）

本文记录按 `15-current-state-and-optimization-review-20260510.md` 执行的基础加固结果。目标是把项目推进到足够启动 `13/14` 参数化迭代的状态。

## 本轮目标

本轮不做新训练模块，不启动大规模参数化改造。只处理会阻断后续迭代的地基问题：

1. 统一模块状态口径。
2. 修复已知 P0/P1 交互缺陷。
3. 建立 `TrainingResult` v1 兼容契约。
4. 建立只读门禁和 CI 检查。
5. 消除首页“待开发”误导文案。

## 已完成改动

### 1. 状态口径

| 改动 | 文件 |
|------|------|
| 新增模块状态矩阵，作为 36 个入口的当前状态源 | `doc/16-module-status-matrix-20260510.md` |
| 新增训练结果数据契约 | `doc/17-training-result-schema-v1.md` |
| 更新文档索引，纳入 16/17/18 | `doc/INDEX.md` |
| README 增加当前基线入口 | `README.md` |

### 2. 首页状态修正

已将 5 个已有入口从“待开发...”改成真实功能描述：

| 模块 | 页面 |
|------|------|
| 停止信号任务 | `stop-signal.html` |
| 蒙提霍尔问题 | `monty-hall.html` |
| 基率忽略任务 | `base-rate.html` |
| 赌徒谬误任务 | `gambler-fallacy.html` |
| 贝叶斯更新任务 | `bayes-update.html` |

扫描结果：当前首页配置中 `待开发` 命中为 0。

### 3. 交互缺陷修复

| 问题 | 处理 |
|------|------|
| `task-switching.js` 超快输入后响应锁死 | 过快输入恢复响应并重置反应时基准 |
| `task-switching.js` 长按键重复触发风险 | `keydown` 过滤 `e.repeat` |
| `task-switching.html` 触控和点击双入口 | 移除内联 `ontouchstart`，保留单一点击入口 |
| `mental-rotation.js` 重复点击/重复键可重复计分 | 增加 `canRespond` 锁和 `e.repeat` 过滤 |

### 4. 训练结果契约

`src/shared/training-results.js` 已兼容 `TrainingResult v1`：

- 自动补 `schemaVersion`
- 支持 `moduleId`
- 保留 `gameId/gameName/score/metrics/tags`
- 支持结构化 `summary`
- 支持最多 500 条 `trials`

本轮新增 `task-switching` 结果落库。当前状态：

| 指标 | 数量 |
|------|------|
| 写入 `TrainingResults` 的训练页 | 22 |
| 读取 `TrainingResults` 的报告页 | 1 |
| 未接入 `TrainingResults` 的训练页 | 13 |

### 5. 门禁和 CI

| 改动 | 文件 |
|------|------|
| `picky-player-audit.js` 支持 `--check` 只读模式 | `scripts/picky-player-audit.js` |
| Font Awesome 阻塞加载检查发现问题时返回非 0 | `scripts/audit-fontawesome-loading.js` |
| 增加 `npm run check` 系列脚本 | `package.json` |
| GitHub Pages 部署前执行只读门禁 | `.github/workflows/deploy-pages.yml` |

新增脚本：

```bash
npm run check
npm run check:syntax
npm run check:sensitive-paths
npm run check:fontawesome-loading
npm run check:picky-player
npm run audit:picky-player
```

### 6. Electron 和本地文档体验

| 问题 | 处理 |
|------|------|
| Electron 渲染进程开启 `nodeIntegration` 且关闭 `contextIsolation` | 改为 `nodeIntegration: false`、`contextIsolation: true` |
| 页面直接 `require("electron")` | 新增 `preload.js`，只暴露 `window.electronShell.openPath` |
| 本地服务未配置 Markdown MIME | `server.js` 增加 `.md` -> `text/markdown; charset=utf-8` |

## 验证结果

已执行：

```bash
npm run check
```

结果：

| 检查 | 结果 |
|------|------|
| 语法检查 | 通过 |
| 敏感路径扫描 | 通过，未发现本地敏感路径模式 |
| Font Awesome 加载检查 | 通过，阻塞加载 0 |
| 只读全站巡检 | 通过，36 个 active 入口，高风险 0 |

`picky-player` 当前仍报告中风险 5、低风险 18。这些是体验和内容完整度问题，不阻断 `13/14` 中的蒙提霍尔参数化样板启动。

## 当前可启动范围

现在可以启动：

1. `13/14` 的蒙提霍尔参数化样板。
2. 旧模块 `TrainingResults` 批量接入。
3. 报告页 schema 化改造。
4. 语音路径实机验收。

不建议马上启动：

1. 6 个 P0 参数化模块并行开发。
2. 账号系统或云同步。
3. 跨模块能力评分或常模化解释。

## 剩余基础债

| 优先级 | 剩余项 |
|--------|--------|
| P1 | 13 个旧训练页未接入统一结果存储 |
| P1 | 报告页仍主要展示旧 `metrics`，未完全 schema 驱动 |
| P1 | 语音/麦克风路径未做 Chrome/Edge/Electron/GitHub Pages 实机矩阵 |
| P2 | 中/低风险体验项仍存在，包括重开入口、内容池有限和开放题评分边界 |
| P2 | `package-lock.json` 仍有既有未提交清理变更，需要单独决策是否接受 |

## 结论

基础已经达到 `13/14` 可启动的最低状态：状态源已统一、门禁已只读化并接入 CI、首页不再误标待开发、P0 交互锁死已修、结果契约已落地。

下一步建议按单线程样板推进：先做蒙提霍尔参数化，并以 `17-training-result-schema-v1.md` 作为输出契约。

