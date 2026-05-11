# 认知能力训练平台现状与待优化项复核（2026-05-10）

## 1. 本轮任务边界

本轮目标不是继续扩展功能，而是作为主 agent 重新判断项目现状、拆分审计边界、吸收但不盲从已有智能体文档，形成下一阶段优化基线。

项目目录：`D:\Docs\03AI\02TraeCN\20260304work001`

本轮协同分工：

| 角色 | 关注点 | 输出用途 |
|------|--------|----------|
| 文档审计 agent | 最近文档、状态口径、开放问题 | 判断文档是否能支撑开发排期 |
| 代码与体验审计 agent | 代码结构、脚本、任务页、数据记录 | 判断实现事实和训练闭环 |
| 监督复核 agent | 挑战“看似完成”的风险 | 补充科学性、隐私、部署和验收风险 |
| 主 agent | 目标裁剪、证据复核、优先级判断 | 形成最终结论和行动顺序 |

主流程实际执行的本地验证包括：

| 检查项 | 命令/方式 | 结论 |
|--------|-----------|------|
| 工作树状态 | `git status --short` | 近期主要新增 `doc/13`、`doc/14`，`doc/INDEX.md` 和 `package-lock.json` 有未提交变更 |
| 全站入口巡检 | `node scripts/picky-player-audit.js` | 36/36 入口可访问，0 高风险，5 中风险，18 低风险 |
| 敏感路径扫描 | `node scripts/check-sensitive-paths.js` | 未发现本地敏感路径模式 |
| Font Awesome 加载检查 | `node scripts/audit-fontawesome-loading.js` | 37 个 HTML，30 个已 preload，0 个阻塞加载 |
| 首页任务配置统计 | 读取 `src/home/config.js` | 11 个分区、36 个入口、全部 active |
| 结果落库覆盖统计 | 扫描 `TrainingResults.saveSession` | 35 个 HTML 训练/工具页中 21 个 JS 接入统一训练结果，14 个未接入 |

代码与体验审计 agent 另行完成只读验证：

| 检查项 | 结论 |
|--------|------|
| JS 语法检查 | 48 个 JS 文件 `node --check` 通过 |
| 本地服务冒烟 | 短暂启动 `node server.js` 后首页 HTTP 200 |
| 只读脚本检查 | `audit-fontawesome-loading`、`check-sensitive-paths` 通过 |
| 巡检脚本定位 | `picky-player-audit.js` 会写 `doc/06-picky-player-evaluation.md`，更像报告生成器，不适合直接作为 CI 断言 |

## 2. 当前现状判断

项目不是早期原型。它已经有静态 Web/Electron 双入口、配置驱动首页、36 个 active 入口、统一文档中心、自动巡检脚本和一批已实现训练页面。

但项目也不是可直接继续堆功能的稳定产品。最大问题不是“页面数量不够”，而是实现状态、文档状态、科学测量口径和验收口径没有统一。

### 2.1 已具备的基础

1. 首页已经配置驱动，当前 `src/home/config.js` 有 11 个分区、36 个 active 入口。证据：`src/home/config.js:3`、`src/home/config.js:54`、`src/home/config.js:117`、`src/home/config.js:360`。
2. Web 本地服务存在，`package.json` 只保留 `web/start/package` 三个脚本。证据：`package.json:6-9`。
3. 全站自动巡检能覆盖 active 入口，最近重跑结果仍是 36/36 可访问、0 高风险。证据：`doc/06-picky-player-evaluation.md:12-18`。
4. 新增模块并非完全空白。README 明确记录 2026-02-26 已完成停止信号、蒙提霍尔、赌徒谬误、基率忽略、贝叶斯更新。证据：`README.md:120-129`。
5. 一部分新模块已经接入统一结果存储。证据：`src/shared/training-results.js:54-59`，以及本轮扫描到 21 个 `TrainingResults.saveSession` 调用。

### 2.2 不能被“已实现”掩盖的问题

1. 首页仍把 5 个已有页面标成“待开发”。证据：`src/home/config.js:139-143`、`src/home/config.js:223-254`。
2. 最新规划文档仍把停止信号、蒙提霍尔、基率忽略、赌徒谬误归为“无代码或仅有骨架”。证据：`doc/14-next-steps-and-open-questions.md:20-26`、`doc/14-next-steps-and-open-questions.md:38-41`、`doc/14-next-steps-and-open-questions.md:56`。
3. 自动巡检范围有限，脚本自己声明只覆盖“是否能访问、是否有可开局/可反馈/可重开线索、是否存在待开发痕迹”。证据：`scripts/picky-player-audit.js:323`。
4. 自测报告承认还没有真人通关、浏览器矩阵、语音权限验证。证据：`doc/09-self-test-report-after-p1-kickoff.md:40-43`。
5. 结果数据结构仍是宽松对象，`metrics` 原样接收模块传入对象，缺少白名单和 schema 校验。证据：`src/shared/training-results.js:34-49`。

## 3. 主要矛盾

本项目当前的主要矛盾是：**项目已经从“页面能跑”进入“训练是否可信、数据是否可复用、发布是否可控”的阶段，但文档和工程基线仍停留在“页面存在即可算完成”的层次。**

因此下一阶段不应优先追求新增模块数量，而应先完成四件事：

1. 建立唯一资产清单。
2. 校准每个模块的真实状态。
3. 固化统一训练结果 schema 和验收门禁。
4. 把科学测量口径从“描述性文案”提升到“可测试指标”。

## 4. 待优化项优先级

### P0-1：统一资产清单和状态口径

问题：
文档存在多套口径。`INDEX` 摘要仍写 36 个训练模块、全量 40 项；`13/14` 使用 36 个项目、33 个训练模块 + 3 个工具；`README` 的“当前已实现功能”仍停在早期 7 个模块；`SUMMARY` 是 2026-02-24 的阶段总结。

证据：
- `doc/INDEX.md:55-58`
- `doc/13-external-solutions-research.md:1`
- `doc/14-next-steps-and-open-questions.md:15-26`
- `README.md:45-49`
- `SUMMARY.md:1-4`

判断：
这是 P0，因为如果资产清单不唯一，后续“完成率”“P0/P1/P2”“验收对象”都会失真。

建议：
新增或重写一个唯一状态表，字段至少包括：`moduleId`、中文名、页面、JS、所属系统、active 状态、实现等级、结果落库、可重开、参数化程度、科学指标、验收状态。

### P0-2：修正“待开发”与实际实现冲突

问题：
停止信号、蒙提霍尔、基率忽略、赌徒谬误、贝叶斯更新都有页面和脚本，部分还有结果落库，但首页和规划文档仍把它们标成“待开发”或“无代码/骨架”。

证据：
- `README.md:120-129`
- `src/home/config.js:139-143`
- `src/home/config.js:223-254`
- `doc/13-external-solutions-research.md:166`
- `doc/13-external-solutions-research.md:255-285`
- `doc/14-next-steps-and-open-questions.md:38-41`

判断：
这不是文字小错，而是排期风险。真正状态应拆为：

| 状态 | 含义 |
|------|------|
| 未实现 | 没有可运行页面或核心交互不可用 |
| 骨架可用 | 页面存在，但缺关键算法/结果/闭环 |
| 基础实现 | 可完成一轮训练，有结果反馈 |
| 训练闭环 | 可重开、可记录、可复盘、可验收 |
| 科学增强 | 有参数化、指标解释、趋势或自适应 |

当前这 5 个模块大多应从“待开发”改为“基础实现/骨架可用”，再分别列优化项。

### P0-3：建立统一 `TrainingResult` schema 并补齐落库覆盖

问题：
统一结果存储已经存在，但不是全模块覆盖，也没有 schema 校验。本轮静态扫描显示 35 个 HTML 训练/工具页里有 35 个对应 JS，其中 21 个调用 `TrainingResults.saveSession`，14 个没有调用。

未接入清单：

| 模块 | JS |
|------|----|
| 舒尔特方格 | `schulte.js` |
| Flanker 专注 | `flanker.js` |
| 斯特鲁普测试 | `stroop.js` |
| 中科院注意力训练 | `focus.js` |
| 持续表现任务 | `cpt.js` |
| N-Back 记忆 | `nback.js` |
| 科西方块 | `corsi.js` |
| 数字广度 | `digit-span.js` |
| 瑞文推理 | `raven.js` |
| 心理旋转 | `mental-rotation.js` |
| 任务切换 | `task-switching.js` |
| Go/No-Go | `go-no-go.js` |
| 麦克风测试 | `mic-test.js` |
| 每日训练报告 | `report.js` |

证据：
- `src/shared/training-results.js:34-59`
- `report.js:28-41`
- `doc/14-next-steps-and-open-questions.md:108-138`

判断：
数据 schema 是训练平台的地基。没有统一 schema，报告页、趋势图、账号同步、科学指标都只能靠各模块临时拼接。

建议：
把 `doc/14` 的 schema 草案升级为仓库内正式契约，并实现：

1. `moduleId` 白名单。
2. `summary` 基础字段统一：`durationMs`、`totalTrials`、`correctCount`、`accuracy`、`meanRtMs`。
3. `trials` 可选但结构固定。
4. `metrics` 允许模块扩展，但必须限定可序列化类型和字段大小。
5. 报告页不再直接展示任意 `metrics` 对象，而按 schema 渲染。

### P0-4：把验收从“能访问”升级为“能完成训练闭环”

问题：
现有自动巡检价值很高，但它不能证明训练完成质量。文档也明确未做真人通关、浏览器矩阵和语音权限验证。

证据：
- `doc/06-picky-player-evaluation.md:18`
- `doc/06-picky-player-evaluation.md:36`
- `doc/06-picky-player-evaluation.md:44-47`
- `scripts/picky-player-audit.js:323`
- `doc/09-self-test-report-after-p1-kickoff.md:40-43`

判断：
自动巡检应作为最低门槛，而不是完成定义。

建议：
建立三层验收：

| 层级 | 验收内容 | 工具/方式 |
|------|----------|----------|
| L1 静态门禁 | 页面可访问、资源存在、无占位、无敏感路径 | 现有脚本 |
| L2 交互门禁 | 能开始、完成、重开、退出、写入结果 | Playwright 或手工脚本 |
| L3 科学门禁 | 指标计算正确、随机生成合法、边界输入稳定 | 模块级测试 + 固定种子 |

### P0-5：修复任务切换超快输入锁死

问题：
`task-switching.js` 在用户输入反应时低于 100ms 时先把 `canRespond` 置为 `false`，随后直接 `return`，没有恢复响应、记录错误或推进下一试次。移动端按钮同时有 `ontouchstart` 和 `onclick` 入口，更容易触发边界输入。

证据：
- `task-switching.js:126`
- `task-switching.js:128`
- `task-switching.html:100`

判断：
这是实际交互 P0。它不属于文档口径问题，而是会让训练流程在极端但真实的输入情况下卡死。

建议：
低于最小反应时的输入应按无效试次处理：恢复 `canRespond`、给出过快反馈、记录 trial 状态，并自动进入下一试次或允许重试。移动端需要去重触控和点击事件。

### P1-1：参数化内容池是近期主线，但 P0 范围需要收窄

问题：
`doc/14` 把 P0 定为 6 个模块一起处理：蒙提霍尔、基率忽略、赌徒谬误、贝叶斯、瑞文、RAT。这个方向正确，但同时开 6 个容易把“生成器、验收、schema”三个问题搅在一起。

证据：
- `doc/14-next-steps-and-open-questions.md:32-48`
- `doc/13-external-solutions-research.md:441-454`

判断：
首期只应选一个最简单模块打样。第一性原理上，样板模块必须满足：规则清晰、正确答案可自动计算、随机生成合法性容易验证、数据 schema 有代表性。蒙提霍尔最符合。

建议：
首期只做 `monty-hall` 参数化样板：

1. 多轮而不是单轮。
2. 记录每轮是否换门、是否获胜。
3. 显示换门/不换门胜率对比。
4. 支持固定随机种子用于测试。
5. 输出符合统一 `TrainingResult` schema。

样板通过后，再复制到基率忽略、赌徒谬误、贝叶斯更新。

### P1-2：科学解释和评分阈值未定，避免过早输出能力结论

问题：
多个规格文档仍在讨论评分阈值和常模问题；校准曲线、meta-d' 等关键解释指标也还在 P2。当前页面如果用分数直接暗示能力强弱，风险较高。

证据：
- `doc/glm5-game-specs/attention/flanker.md:46-62`
- `doc/glm5-game-specs/memory/corsi.md:48-64`
- `doc/glm5-game-specs/executive/go-no-go.md:41-57`
- `doc/14-next-steps-and-open-questions.md:72-76`

判断：
训练平台可以先做个人趋势和任务内反馈，不应急着输出跨人群等级、诊断式评价或年龄常模。

建议：
短期统一文案：结果仅代表本次任务表现，不作医学、诊断或常模判断。中期再补模块指标说明、置信区间、训练曲线和自适应难度。

### P1-3：语音/麦克风路径需要实机专项验收

问题：
Stroop 和麦克风测试依赖 `SpeechRecognition` 与 `getUserMedia`，自动巡检无法覆盖权限、浏览器差异和 Electron 行为。

证据：
- `stroop.js:253-262`
- `stroop.js:423`
- `mic-test.js:63-64`
- `mic-test.js:171`
- `doc/09-self-test-report-after-p1-kickoff.md:42`

建议：
建立单独的语音验收清单：Chrome、Edge、Electron、本地 HTTP、GitHub Pages 五种场景分别记录是否能授权、是否能识别、失败提示是否可恢复。

### P1-4：发布门禁没有进入 GitHub Actions

问题：
GitHub Pages workflow 在 main push 后直接上传整个仓库目录，没有运行现有检查脚本，也没有构建/测试步骤。

证据：
- `.github/workflows/deploy-pages.yml:3-6`
- `.github/workflows/deploy-pages.yml:29-31`
- `package.json:6-9`
- `doc/07-work-plan-from-glm5-eval-and-todo.md:94-95`

建议：
补 `npm run check`，至少串联：

1. `node scripts/check-sensitive-paths.js`
2. `node scripts/audit-fontawesome-loading.js`
3. `node scripts/picky-player-audit.js --check` 或新增只读检查模式
4. 将 `node_modules/`、临时文件、开发脚本输出排除出 Pages artifact

### P1-5：Electron 桌面入口权限过高

问题：
Electron 主进程开启 `nodeIntegration` 且关闭 `contextIsolation`。目前页面数据主要来自本地常量，短期风险可控；但项目存在大量普通页面脚本和 `innerHTML` 用法，长期看不应运行在高权限渲染环境中。

证据：
- `main.js:9`

建议：
如果 Electron 仍作为正式分发形态，应改为 `contextIsolation: true`、`nodeIntegration: false`，通过 preload 暴露最小 API。若桌面版只是历史入口，应在 README 中降级说明。

### P2-1：README/SUMMARY 应降级为历史材料或重写为当前入口

问题：
README 的功能清单停在早期 7 个模块，但后面又补了 5 个新增任务和训练报告。SUMMARY 是 2026-02-24 工作总结。二者都不再适合作为当前项目状态入口。

证据：
- `README.md:45-86`
- `README.md:120-132`
- `SUMMARY.md:1-4`

建议：
README 保留面向用户的最短介绍、运行方式、入口链接；现状和待办全部指向 `doc/15` 或后续唯一状态表。

### P2-2：依赖元数据需要清账

问题：
当前 `package.json` 不包含 `express`，但 `package-lock.json` 有大段依赖删除变更，说明锁文件处于清理后的未提交状态。这个变更可能是合理清理，也可能是由不同 npm 版本重写产生。

证据：
- `package.json:6-9`
- `package.json:18`
- `git status --short` 显示 `package-lock.json` 已修改

建议：
单独决定 `package-lock.json` 是否接受本次变更。不要把依赖锁文件清账混进功能开发 PR。

### P2-3：移动端和文档中心存在体验断点

问题：
部分说明层使用绝对定位和固定高度，移动端只调整了 header/grid，没有给说明层滚动兜底；本地文档中心链接 Markdown，但服务端未配置 `.md` MIME，可能在浏览器中表现为下载或裸文件。

证据：
- `style.css:432`
- `style.css:436`
- `style.css:1250`
- `doc/index.html:67`
- `server.js:69`

建议：
移动端补充说明层滚动和最大高度约束；本地服务为 `.md` 配置 `text/markdown; charset=utf-8`，或文档中心统一链接 HTML 包装页。

## 5. 建议行动顺序

### 第一阶段：1 天内完成状态校准

1. 生成唯一资产清单 `doc/module-status-matrix.md`。
2. 修正 `src/home/config.js` 中 5 个“待开发...”描述，改为真实状态。
3. 更新 `doc/14` 或新增决策记录，把“待确认”变成明确决策。
4. README 改为入口页，不再维护重复功能清单。

### 第二阶段：2-3 天完成训练闭环地基

1. 正式定义 `TrainingResult` schema。
2. 给 14 个未接入模块补结果落库，工具页除外。
3. 报告页改为 schema 驱动展示。
4. 给巡检脚本增加只读检查模式，避免每次检查都覆盖历史报告。

### 第三阶段：以蒙提霍尔为样板做参数化

1. 蒙提霍尔改为多轮参数化训练。
2. 建固定随机种子测试。
3. 验证题目合法性、结果落库、报告展示。
4. 样板通过后复制到基率忽略、赌徒谬误、贝叶斯更新。

### 第四阶段：发布与科学解释收口

1. GitHub Actions 加检查门禁。
2. 语音/麦克风做专项实机验收。
3. 页面结果文案统一加“非诊断、仅代表本次任务表现”边界。
4. 再推进趋势图、自适应难度、效应量等 P2 能力。

## 6. 最终判断

项目的当前价值在于：已经有足够多可运行任务，适合进入“训练平台化”的工程阶段。

项目的当前风险在于：如果继续按“新增模块/外部方案研究”推进，会把状态口径、数据口径和科学口径的债务继续放大。

下一步最务实的主线不是新增第 37 个入口，而是把现有 36 个入口变成可信、可验收、可复盘的训练系统。
