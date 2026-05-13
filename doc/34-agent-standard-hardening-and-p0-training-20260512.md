# Agent 标准门禁与 P0 训练本体强化记录（2026-05-12）

## 1. 记录范围

本记录对应当前认知/注意力训练项目仓库。

- 本地仓库：`<repo-root>`
- 远端仓库：以本地 `origin` 配置为准，公开文档不记录具体账号 URL
- 记录日期：`2026-05-12`
- 本轮主线：按 coding-agent 标准门禁，继续把 P0 训练项目从“可玩 demo”推进到“可复盘训练”

本轮不是以 Git 提交、发布包装或界面装饰为主，而是先补强训练本体、运行门禁、沉淀文档。Git 同步仅作为后续辅助动作。

## 2. 本轮多 agent 分工

本轮采用主 agent 控制目标和写集，worker 分模块实施，审计 agent 只读复核。

| 角色 | 写入范围 | 目标 |
|---|---|---|
| 发布与隐私 worker | `.github/workflows/deploy-pages.yml`、`.gitignore` | 缩小 Pages artifact，排除本地、凭据、构建和依赖文件 |
| 门禁 worker | `package.json`、`scripts/check-sensitive-paths.js`、`scripts/check-syntax.js` | 扩展语法、隐私、页面 smoke 门禁 |
| 运行时加固 worker | `server.js`、`preload.js`、`src/shared/training-results.js` | 限制本地服务和 Electron 打开范围，增强结果存储容错 |
| P0 训练 worker | `london-tower.js`、`sliding-puzzle.js`、`ultimatum-game.js`、`trust-game.js`、`prisoner-dilemma.js` | 补 trial-level 数据、训练摘要和下一轮处方 |
| 页面 smoke worker | `scripts/smoke-pages.js` | 从首页配置自动覆盖 active 页面引用 |
| 审计 agent | 只读 | worker 完成后复核训练本体、隐私、发布和门禁风险 |

闸门规则：

1. worker 只改授权文件。
2. 审计 agent 不抢跑，不参与写入。
3. 主 agent 负责目标纠偏、文档记录和最终门禁。
4. 本轮不写入真实账号、token、代理、凭据输出或本机绝对路径。

## 3. 训练本体强化

### 3.1 London Tower

强化方向：规划能力不只看是否完成，而要看规划效率、路径偏离和冲动移动。

新增训练信息：

- `seed`、`contentVersion`、`problemOrder`
- 每题 `problemId`、`optimal`、`actualMoves`、`excessMoves`
- `firstMoveLatencyMs`、`invalidMoves`、`backtracks`、`repeatedStates`
- `movePath`、起始状态、目标状态、唯一状态数量
- `avgExcessMoves`、`optimalRate`、`nextDifficultySuggestion`

训练意义：从“搬球成功”推进到“能看出是否先规划、是否反复回退、是否偏离最少步数”。

### 3.2 Sliding Puzzle

强化方向：滑块任务应训练空间规划和状态搜索，而不是单纯拖动。

新增训练信息：

- 可复盘的 `seed`、`initialState`、`shuffleSteps`、`shuffleLog`
- 每步 `moveLog`、重复状态、回退次数、阻塞点击
- `manhattan-lower-bound` 作为最短路径启发式下界
- `efficiency`、`repetitionRate`、`nextDifficultyPrescription`

训练意义：能识别“靠试错乱走”与“稳定接近目标状态”的差异。

### 3.3 Ultimatum Game

强化方向：社会决策不能只保存总收益，应看到公平阈值和不同报价区间的选择。

新增训练信息：

- 每轮 `offer`、`offerRatio`、`choice`、`opponentStrategy`
- `payoff`、`opponentPayoff`、`rtMs`
- `minimumAcceptedOffer`、`acceptanceThresholdRatio`
- `fairAcceptanceRate`、`unfairAcceptanceRate`、`fairnessSensitivity`
- 前后半程 `strategyAdaptationIndex`

训练意义：从“接受/拒绝小游戏”推进到“能复盘公平敏感性和策略变化”。

### 3.4 Trust Game

强化方向：信任训练要看投入、返还、互惠反应和背叛后的调整。

新增训练信息：

- 每轮 `invest`、`returnRate`、`returned`、`payoff`、`rtMs`
- 对手策略标记为 `adaptive-reciprocal-noisy`
- `highInvestmentRate`、`trustThresholdInvestment`
- `reciprocitySensitivity`、`betrayalRecoveryRate`
- 前后半程投资变化和下一轮策略建议

训练意义：能看出用户是盲目信任、过度防御，还是能随反馈调整投入。

### 3.5 Prisoner Dilemma

强化方向：囚徒困境应训练合作稳定性、报复/宽恕和对策略的适应。

新增训练信息：

- 每轮 `myChoice`、`opponentChoice`、`opponentStrategy`、`payoff`
- seeded tit-for-tat with noise 对手
- `cooperationAfterOpponentCooperationRate`
- `retaliationRate`、`forgivenessRate`
- `titForTatMatchRate`、`strategyAdaptationIndex`、`endGameCooperationRate`

训练意义：不再只看合作率，而是能复盘合作是否稳定、是否过度报复、是否理解对手策略。

## 4. 工程和隐私加固

### 4.1 Pages artifact 收窄

GitHub Pages 不再直接上传整个仓库根目录，而是构建 `dist-pages`：

- 复制根目录 HTML/CSS
- 复制根目录 HTML 引用的根级 JS
- 复制 `.nojekyll`、`src/`、`doc/`
- 排除 `.git`、`.github`、`node_modules`、`scripts`、`dist`、package 文件、registry 配置和 env 文件

目的：降低把本地脚本、配置、依赖或凭据类文件发布到 Pages 的风险。

### 4.2 隐私扫描增强

`scripts/check-sensitive-paths.js` 扩展为隐私与凭据扫描门禁：

- 覆盖更多文本类扩展，包括 shell、PowerShell、TOML、INI、证书和 key 文件
- 检测本机用户路径、个人 GitHub Pages 标识、常见 token、Bearer、JWT、私钥块、URL 嵌入凭据
- 输出只保留 `file:line:rule`，不打印完整敏感行

目的：扫描结果本身不二次泄露敏感内容。

### 4.3 语法与页面门禁

新增 `scripts/check-syntax.js`：

- 自动遍历仓库内 JS 文件
- 跳过 `.git`、`node_modules`、`dist`、`dist-pages` 和第三方压缩库
- 避免在 `package.json` 里维护过长的手写 `node --check` 列表

`scripts/smoke-pages.js` 改为从 `src/home/config.js` 读取 active 训练页面，并额外覆盖 `index.html` 与 `health-check.html`。

目的：新增训练页面后，门禁能随首页配置自动扩展，而不是依赖人工同步列表。

### 4.4 本地运行时边界

`server.js`：

- 默认监听 `127.0.0.1`
- 仅允许 `GET` / `HEAD`
- 阻止隐藏路径段和 `.git`、`.github`、`node_modules`、`dist`、`dist-pages`
- 仅服务白名单扩展

`preload.js`：

- `electronShell.openPath` 只允许打开应用目录内文件
- 仅允许打开 `localhost`、`127.0.0.1`、`::1` 的 HTTP(S) URL
- 远程 URL、任意本机路径和非 file/http(s) 协议默认阻断

`src/shared/training-results.js`：

- `localStorage` 读写删除都加容错
- 坏 JSON 返回空数组
- 存储失败不打断训练完成流程
- 最多保留 300 条 session，单 session 最多 500 条 trial

目的：让训练结果保存更稳，同时收紧桌面壳和本地服务器的暴露面。

## 5. 本轮检查结果

本轮收口时执行以下门禁：

| 检查 | 结果 |
|---|---|
| 改动 JS 文件 `node --check` | 通过 |
| `git diff --check` | 通过，仅有 Windows LF/CRLF 提示 |
| `node scripts/check-sensitive-paths.js` | 通过 |
| `npm run check` | 通过 |
| `npm run smoke:pages` | 通过 |
| `npm run smoke:flows` | 通过 |

`npm run check` 内部覆盖：

- JS 语法检查
- 隐私/凭据扫描
- Font Awesome 加载检查
- 页面引用 smoke
- 训练流程 smoke
- picky-player 高风险门禁

当前 `picky-player` 仍保留中低风险项，作为后续体验打磨和训练解释改进对象；本轮没有发现阻塞发布或阻塞训练落库的高风险项。

## 6. 剩余风险

1. London Tower 当前使用内置题目 `optimal` 值，后续应补自动验证或求解器抽检，避免题库标注漂移。
2. London Tower 的路径序号在无效移动后可能与有效移动序号不完全连续；不影响训练完成，但后续做路径可视化前应统一事件序号。
3. Sliding Puzzle 当前用曼哈顿距离作为路径下界，不等于真实最短步数；下一轮可考虑小尺寸 A* 抽样验证。
4. Sliding Puzzle 的 `shuffleLog` 和 `moveLog` 保存较多状态快照，长局可能增加 localStorage 压力；目前共享存储层已限制 session 和 trial 数量，但后续可压缩路径日志。
5. Ultimatum / Trust / Prisoner Dilemma 已有策略和 trial 数据，但仍是轻量模拟，不应包装成社会能力诊断。
6. 跨模块 `trial.return` 语义尚未统一：囚徒困境表示本轮收益，信任游戏表示返还金额，最后通牒为 `null`；后续跨模块分析应优先使用 `payoff`、`returnAmount` 等更明确字段。
7. `contentVersion` 后缀命名存在轻微不一致，不影响运行，但后续按版本聚合时应统一命名规范。
8. Pages artifact 已收窄，但发布前仍需依赖 GitHub Actions 上的同一套门禁确认。
9. 本轮主要是静态与脚本门禁，未执行真实浏览器或 Electron 人工通关验收。

## 7. 下一步

下一批应继续围绕“训练本体变强”推进，而不是转向包装细节。

建议顺序：

1. 为 London Tower 和 Sliding Puzzle 增加求解器或抽样校验，提升规划任务的客观评分强度。
2. 为社会决策三项增加对手策略版本、策略解释和跨 session 趋势对比。
3. 进入创造力模块前，先定义“训练反馈”与“标准化评分”的边界，避免伪精确。
4. 对已强化模块做真实浏览器通关抽测，确认 trial 数据不是只在代码层面存在。
5. 若需要提交 Git，再运行提交前门禁，并检查 staged 文件只包含本轮授权改动。
