# 训练效果目标对齐与模块优化矩阵（2026-05-11）

## 1. 目标重定义

本项目下一阶段不再以“训练页数量”作为主要目标，而以“经典认知范式能否产品化为有效训练工具”作为主要目标。

有效训练的最低标准：

1. 训练对象明确：每个任务只承诺它实际刺激的认知能力，不做泛化过度的宣传。
2. 任务机制有效：刺激、反馈、干扰、记忆负荷或奖励结构必须逼近目标能力边界。
3. 难度可调：训练要贴近用户当前能力，过易只会娱乐化，过难只会挫败。
4. 反馈可解释：结束页和报告页要告诉用户“错在哪里、下一轮怎么练”，不是只给分数。
5. 数据可复盘：每场训练必须能回看 trial、条件、反应时、错误类型、seed 和内容版本。

当前仓库已经完成 33 个 active 训练任务的 `TrainingResults.saveSession` 接入。主要矛盾已经转为：数据和范式深度不足，无法充分支撑长期训练效果判断。

## 2. 仓库链接与隐私口径

- GitHub 仓库：以本地 `origin` 远端配置为准，公开文档不记录具体账号 URL。
- GitHub Pages：以仓库 Pages 设置为准，公开文档不记录具体账号域名。
- 文档入口：`doc/INDEX.md`

仓库内文档不得再指向旧的 GitHub 空间，也不得写入个人账号、访问凭据、本机绝对路径或代理配置输出。内部文档链接优先使用相对路径。

## 3. 外部范式参考带来的约束

以下资料不是要求项目成为临床测评工具，而是用来校准“游戏如何更像训练范式，而不是 demo”。

| 来源 | 对本项目的约束 |
|---|---|
| eLife Stop Signal consensus guide, <https://elifesciences.org/articles/46323> | Stop Signal 必须围绕 response inhibition、SSD、SSRT、go/stop trial 比例、race-model 假设和分析有效性设计。 |
| PsyToolkit Flanker, <https://www.psytoolkit.org/experiment-library/flanker.html> | Flanker 应保存 stimulus、congruent/incongruent、status、RT，并保证足够 trial 数。 |
| PsyToolkit Stroop, <https://us.psytoolkit.org/experiment-library/stroop.html> | Stroop 关键是 congruent/incongruent 条件差异、反应时和错误，而不是单纯颜色选择。 |
| jsPsych Flanker example, <https://jspsych.github.io/webbook/experiment-flanker.html> | Flanker 应逐 trial 评分、反馈并汇总 congruent/incongruent 表现。 |
| jsPsych plugin/data model, <https://www.jspsych.org/v7/overview/plugins/> | 每个 trial 应保存刺激、条件、反应、正确性、反应时，方便后续分析。 |
| Cambridge Cognition N-Back, <https://cambridgecognition.com/cognitionkit-n-back-nbx/> | N-Back 是注意力和工作记忆任务，关键指标包括 hits、misses、false alarms、correct rejections、敏感性。 |
| eCorsi tablet implementation, <https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2014.00939/full> | Corsi 数字化实现应保留 span、反应时、forward/backward 条件，并注意数字界面对原始任务的改变。 |
| BART measurement notes, <https://www.impulsivity.org/measurement/bart/> | BART 的核心分数通常是未爆气球的 adjusted average pumps，同时记录爆炸率和学习过程。 |
| Frontiers IGT analysis, <https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2012.00061/full> | IGT 不应只看总收益，还要按 20 轮 block 分析长期收益、gain frequency、loss frequency 的权重。 |
| WCST review, <https://pubmed.ncbi.nlm.nih.gov/33754321/> | WCST 要区分 perseverative responses、perseverative errors、总错误和完成类别。 |
| Reversal learning review, <https://pmc.ncbi.nlm.nih.gov/articles/PMC9205533/> | 反转学习应记录概率奖励、反转阶段、perseveration、win-stay/lose-shift。 |
| AUT scoring research, <https://pubmed.ncbi.nlm.nih.gov/32882380/> | Alternative Uses 不应只数答案数量，还要明确 fluency、flexibility、originality、elaboration 或人工/自动评分边界。 |
| RAT empirical study, <https://ucrisportal.univie.ac.at/en/publications/remote-associates-test-an-empirical-proof-of-concept/> | RAT 更偏聚合联想，难度与线索-答案关联距离有关，应记录题目难度和反应时。 |
| TTCT scoring overview, <https://www.creativitics.com/ttct> | Torrance 类任务必须区分 figural/verbal 评分维度，不能把文本长度直接等同创造力。 |
| Autism Research Centre Eyes Test, <https://www.autismresearchcentre.com/tests/eyes-test-adult/> | Eyes Reading 若使用 RMET 口径，需要明确材料来源、授权、36 项结构和非诊断边界。 |
| Metacognition calibration overview, <https://cognitioncommons.org/research/uncertainty-metacognition> | Confidence Judgment 应报告 confidence-accuracy calibration，而不是只报告平均信心。 |

## 4. 全局 P0 优化线

1. 统一数据契约：所有训练页输出 `summary`、`trials`、`metrics`、`seed`、`contentVersion`。开放题可以不保存原文，但必须保存题目 id、计数、评分维度和隐私边界。
2. 统一可复现随机：仍使用 `Math.random` 生成刺激的模块，改为 `src/shared/seeded-random.js`，并保存 session seed。
3. 统一训练反馈：结束页至少输出核心能力、主要错误类型、下一轮训练建议、重开入口。
4. 建立真实通关验收：静态 `npm run check` 保留，但新增浏览器通关抽样，覆盖从首页进入、完成训练、保存、报告页读取。
5. 收窄宣传口径：项目可称为“认知训练/练习工具”，不宣称临床诊断、治疗或通用智力提升。

## 5. 模块优化矩阵

### 5.1 注意力系统

| 模块 | 核心训练目标 | 当前优化方向 |
|---|---|---|
| Schulte | 视觉搜索、专注稳定性、扫描策略 | 保存点击路径、错误点击、每格间隔、网格大小；引入自适应网格和干扰条件，反馈扫描稳定性。 |
| Flanker | 选择性注意、抗干扰、冲突处理 | 明确 congruent/incongruent 条件；保存条件、方向、rt、correct；报告 flanker interference cost。 |
| Stroop | 抑制语义干扰、冲突控制 | 保存兼容/不兼容条件、反应时、错误、超时；报告 Stroop effect，而不是只看总分。 |
| Focus | 视觉广度、目标搜索、抗视觉噪声 | 把碎片复杂度、目标密度、视野范围参数化；保存搜索路径/点击时间，减少调试输出。 |
| CPT | 持续注意、警觉性、冲动控制 | 明确 CPT 或 AX-CPT 边界；保存 omission、commission/false alarm、hit RT、RT variability。 |

### 5.2 工作记忆、推理、空间

| 模块 | 核心训练目标 | 当前优化方向 |
|---|---|---|
| N-Back | 工作记忆更新、持续注意 | 用 hits/misses/false alarms/correct rejections 计算敏感性；按表现自适应 n 值，保存 stimulus sequence 和 target flag。 |
| Corsi | 视觉空间短时记忆广度 | 保存序列长度、位置序列、复现序列、span progression；增加正向/反向边界说明。 |
| Digit Span | 语音/数字短时记忆广度 | 保存正背/倒背、长度、序列 id、完全正确率；用 staircase 控制长度。 |
| Raven | 抽象推理、规则归纳 | 把题目规则模板化，保存 rule id、选项、错误类型；避免固定小题库造成记忆化。 |
| Mental Rotation | 空间表征与旋转速度 | 保存角度差、镜像/非镜像、rt、correct；报告 angle slope 和 accuracy by angle。 |

### 5.3 执行功能

| 模块 | 核心训练目标 | 当前优化方向 |
|---|---|---|
| Task Switching | 认知灵活性、任务集转换 | 已有 switch cost 基础；继续补 cue-stimulus interval、repeat/switch 条件明细、错误切换成本。 |
| Go/No-Go | 前优势反应抑制 | 保存 go RT、no-go commission、go omission、d-prime/response bias；动态调整 go/no-go 比例和节奏。 |
| Stop Signal | 已启动反应的取消能力 | 按 eLife guide 补 SSD staircase、stop trial 明细、SSRT 估算、go waiting 检测；不要只用简化 `goRt - meanSsd`。 |
| WCST | 规则发现、集合转换、持续错误控制 | 保存当前隐藏规则、反馈、rule switch、perseverative errors、categories completed；区分反应和错误口径。 |
| Reversal Learning | 奖励概率变化后的策略更新 | 保存奖励概率、反转点、选择、reward、win-stay/lose-shift、perseveration；反馈适应速度。 |

### 5.4 决策与风险

| 模块 | 核心训练目标 | 当前优化方向 |
|---|---|---|
| Iowa Gambling | 长期收益与短期诱惑权衡 | 保存每张牌、deck、gain/loss、block net score；报告 advantageous minus disadvantageous by block。 |
| Ultimatum Game | 公平阈值、社会决策 | 保存 offer ratio、role、accept/reject、reaction time；报告最低接受阈值和公平敏感性。 |
| Trust Game | 信任形成、互惠预期 | 保存每轮投资、回报、伙伴策略、belief 更新；区分固定策略和随机噪声。 |
| Prisoner Dilemma | 重复博弈、合作稳定性 | 保存双方动作、收益、上一轮状态、策略标签；加入 tit-for-tat 等可解释对手策略。 |
| Balloon Risk | 风险承担、止盈与损失学习 | 保存每个气球 break point、pump count、cashout/burst；报告 adjusted average pumps 和爆炸率。 |

### 5.5 概率与偏误

| 模块 | 核心训练目标 | 当前优化方向 |
|---|---|---|
| Monty Hall | 条件概率、反直觉更新 | 保持参数化样板；保存 car door、choice、host open、switch/stay、win；补多轮学习曲线。 |
| Base Rate | 基率整合、贝叶斯直觉 | 随机生成 base rate、sensitivity、specificity；保存用户估计和标准答案差距。 |
| Gambler Fallacy | 独立随机事件理解 | 分离赌徒谬误和热手谬误；保存 streak length、prediction、confidence、是否反向预测。 |
| Bayes Update | 证据更新、似然比推理 | 扩展先验和似然组合；反馈用户估计偏差方向，消除占位文案。 |

### 5.6 规划、创造力、社会认知

| 模块 | 核心训练目标 | 当前优化方向 |
|---|---|---|
| Hanoi | 递归规划、目标-子目标管理 | 保存最优步数、实际步数、非法操作、回退次数；反馈计划深度和偏离最优程度。 |
| London Tower | 前瞻规划、约束内搜索 | 保存题目 id、最少步数、首次移动延迟、总移动数；区分冲动开局和有效规划。 |
| Sliding Puzzle | 状态搜索、启发式规划 | 保存初始乱序、最短路径估计、实际步数、回退循环；可引入 A* 生成可解且分级的局面。 |
| Alternative Uses | 发散思维、用途生成 | 至少区分 fluency、flexibility、originality、elaboration；开放题不做伪精确评分，明确人工/启发式边界。 |
| Remote Associates | 聚合联想、语义整合 | 扩充中文题库，保存题目难度、线索距离、正确率、反应时；消除占位文案。 |
| Torrance Creative | 图形发散、标题抽象、细节扩展 | 扩展图形池；区分 figural 评分维度，不把标题多样性或描述长度直接等同创造力。 |
| Sally-Anne | 错误信念、心理理论 | 扩展场景库，保存事实位置、信念位置、问题类型和解释反馈；避免儿童经典题过少导致记忆化。 |
| Eyes Reading | 情绪/心理状态识别 | 先解决 RMET 图片版权和材料来源；保存 item id、选项、正确性和词汇理解风险。 |
| Confidence Judgment | 元认知校准 | 保存每题答案、正确性、confidence；报告 calibration curve、overconfidence、Brier score 或分箱准确率。 |

## 6. 未开放但已有规格的文档

以下规格文档存在，但不是当前首页 33 个 active 训练页。后续不要把它们误判为“漏接入”，应标注为 backlog 或辅助评估：

| 规格文档 | 建议状态 |
|---|---|
| `doc/glm5-game-specs/auxiliary/attention-test.md` | 辅助测评 backlog |
| `doc/glm5-game-specs/auxiliary/cognitive-assessment.md` | 综合测评 backlog |
| `doc/glm5-game-specs/creativity/creative-writing.md` | 创造力扩展 backlog |
| `doc/glm5-game-specs/social/error-awareness.md` | 社会/元认知扩展 backlog |
| `doc/glm5-game-specs/social/theory-of-mind.md` | 社会认知扩展 backlog |

## 7. 执行顺序

### P0：从 demo 到训练闭环

1. 修复所有旧 GitHub 空间链接。
2. 处理 picky-player 的 medium 风险和占位文案。
3. 对 8 个主干模块做训练化改造：Schulte、Flanker、Stroop、CPT、N-Back、Corsi、Go/No-Go、Stop Signal。
4. 每个主干模块补 `summary/trials/seed/contentVersion` 和真实重开入口。
5. 建立浏览器通关抽样脚本或人工验收清单。

### P1：自适应和科学指标

1. 注意力/执行模块加入条件差异、反应时分布、错误类型和自适应难度。
2. 工作记忆模块加入 span progression 和负荷调节。
3. 决策模块加入 block analysis、策略分类和学习曲线。
4. 开放题模块建立评分边界，避免把启发式指标包装成标准化创造力测评。

### P2：长期训练系统

1. 从“自由点游戏”升级为训练计划：每日 10-20 分钟，按能力域轮换。
2. 报告页从 session 列表升级为趋势面板、弱项识别和下一次训练建议。
3. 引入内容版本管理，避免题库变更污染长期趋势。
4. 如未来有账号同步，再把本地 `TrainingResult` 映射到远端用户训练记录。

## 8. 下一步推荐工作包

第一批只做主干 8 项，不扩新游戏：

| 批次 | 模块 | 完成标准 |
|---|---|---|
| A | Stroop、Flanker、CPT | 条件明细、反应时、错误类型、干扰成本进入 `summary/trials`。 |
| B | N-Back、Corsi | 负荷/广度 progression、hits/misses/false alarms、seed 进入结果。 |
| C | Go/No-Go、Stop Signal | commission/omission、SSD/SSRT、go waiting 检测和重开闭环。 |
| D | Schulte | 点击路径、扫描稳定性、网格自适应和训练反馈。 |

完成以上批次后，再进入 BART、WCST、Reversal Learning、IGT 和创造力任务的第二轮深改。
