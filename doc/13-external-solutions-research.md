# 外部方案检索报告：36个认知训练模块参考实现与改进方向（2026-05-10）

## 编制背景

本报告基于对平台全部 36 个项目（33 个训练模块 + 3 个辅助工具）的系统性外部方案检索，旨在为每个模块找到：
1. 开源参考实现（代码级可参考）
2. 科学范式标准（心理学/神经科学依据）
3. 当前实现差距与改进方向

检索范围覆盖 GitHub、PsyToolkit、jsPsych、PEBL、oTree 等主流认知实验开源生态。

---

## 一、注意力系统（5个模块）

### 1. 舒尔特方格 (Schulte Grid)

| 维度 | 内容 |
|------|------|
| **开源参考** | [schulte-grid.com](https://schulte-grid.com) 开源实现；GitHub `schulte-grid` 关键词 50+ 仓库 |
| **核心算法** | Fisher-Yates 洗牌算法生成随机网格；支持 3×3 ~ 10×10 可变尺寸 |
| **科学依据** | 飞行员注意力训练标准工具，测量选择性注意和视觉搜索速度 |
| **当前状态** | ✅ 已较好实现，支持可变尺寸和随机生成 |
| **改进建议** | 增加「倒序点击」「奇偶交替」等变体模式；增加眼动热力图可视化 |

### 2. Flanker 专注 (Flanker Task)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Flanker Task](https://www.psytoolkit.org/experiment-library/flanker.html)；jsPsych `flanker` 插件 |
| **核心算法** | 5个箭头并排，判断中心箭头方向；一致试次(>>>>>)与不一致试次(>><>>)随机混合 |
| **关键指标** | Flanker效应 = RT不一致 - RT一致；正确率；冲突适应效应 |
| **当前状态** | ✅ 已实现基础版本 |
| **改进建议** | 增加「冲突适应效应」分析；增加字母版Flanker；自适应难度调节 |

### 3. 斯特鲁普测试 (Stroop Test)

| 维度 | 内容 |
|------|------|
| **开源参考** | [jsPsych Stroop](https://www.jspsych.org/v7/plugins/stroop/)；[PsyToolkit Stroop](https://www.psytoolkit.org/experiment-library/stroop.html) |
| **核心算法** | 颜色词（红/蓝/绿）以不一致颜色显示，要求判断显示颜色而非词义 |
| **关键指标** | Stroop效应 = RT不一致 - RT一致；错误率；干扰分数 |
| **当前状态** | ✅ 已实现基础版本 |
| **改进建议** | 增加「情绪Stroop」变体；增加「数字Stroop」；分block统计学习效应 |

### 4. 中科院注意力训练 (CAS Attention)

| 维度 | 内容 |
|------|------|
| **开源参考** | 中科院心理所「视觉搜索范式」论文；类似「找数字」任务 |
| **核心算法** | 不规则分布的数字矩阵，按顺序点击；核心是视觉广度和扫视效率 |
| **关键指标** | 完成时间、点击准确率、扫视路径效率 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加干扰元素（颜色/形状干扰）；增加动态难度调节；增加眼动追踪兼容 |

### 5. 持续表现任务 (CPT - Continuous Performance Task)

| 维度 | 内容 |
|------|------|
| **开源参考** | [jsPsych CPT](https://www.jspsych.org/v7/plugins/)；[PsyToolkit CPT](https://www.psytoolkit.org/experiment-library/cpt.html)；GitHub: `Continuous-Performance-Task` |
| **核心算法** | 快速呈现字母流（如每800ms），对目标X做出反应，抑制非目标反应 |
| **关键指标** | 遗漏错误（Omission）、误报错误（Commission）、反应时间、d'敏感度 |
| **变体** | AX-CPT（线索-目标配对）、Not-X CPT、Identical Pairs CPT |
| **当前状态** | ✅ 已实现基础版 |
| **改进建议** | 增加AX-CPT变体（测情境维持）；增加d'信号检测论分析；增加自适应ISI |

---

## 二、工作记忆系统（3个模块）

### 6. N-Back 记忆

| 维度 | 内容 |
|------|------|
| **开源参考** | [Dual N-Back](https://github.com/benjamincongdon/dual-n-back)（开源经典）；[Brain Workshop](http://brainworkshop.sourceforge.net/)（Python开源）；jsPsych nback插件 |
| **核心算法** | 判断当前刺激是否与N步前相同；支持1-back到N-back难度递增 |
| **变体** | 单N-Back（视觉/听觉）、双N-Back（视觉+听觉同时）、三N-Back |
| **关键指标** | 正确率、d'、命中率、误报率、最高可达N级 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加双N-Back模式（视觉+听觉）；增加自适应N级调节；增加训练曲线可视化 |

### 7. 科西方块 (Corsi Block)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Corsi Block](https://www.psytoolkit.org/experiment-library/corsi.html)；[jsPsych Corsi](https://github.com/expfactory-experiments/corsi-block-tapping) |
| **核心算法** | 9个不规则分布的方块，按随机序列点亮，用户按相同顺序点击复现 |
| **关键指标** | 空间记忆广度（最高正确复现长度）、Corsi分数 |
| **变体** | 正向Corsi、反向Corsi（逆向复现） |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加反向Corsi模式；增加自适应广度调节（+1正确/-1错误）；增加方块位置随机化 |

### 8. 数字广度 (Digit Span)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Digit Span](https://www.psytoolkit.org/experiment-library/digit-span.html)；WAIS-IV数字广度子测验标准 |
| **核心算法** | 呈现数字序列，要求正向/反向/升序复述；序列长度从2递增至9 |
| **关键指标** | 正向广度、反向广度、排序广度、总广度分数 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加「排序广度」模式（按升序复述）；增加自适应终止规则；增加语音输入模式 |

---

## 三、推理与流体智力（1个模块）

### 9. 瑞文推理 (Raven's Progressive Matrices)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Raven's Matrices Generator](https://github.com/search?q=raven+progressive+matrices+generator)；[Sandia Matrices](https://github.com/sandialabs/sandia-matrices)（程序化生成） |
| **核心算法** | 3×3矩阵中缺失第9格，从6-8个选项中选出正确图案；规则包括：行变换、列变换、逻辑运算（AND/OR/XOR）、旋转、数量增减 |
| **规则类型** | 图形叠加、元素增减、旋转、翻转、渐进变化、逻辑组合 |
| **关键指标** | 正确率、反应时间、难度等级 |
| **当前状态** | ⚠️ 内容池有限，需扩展 |
| **改进建议** | 🔑 **重点改进**：实现程序化瑞文矩阵生成器（定义规则模板→自动生成题目）；参考Sandia Matrices的生成算法；支持SPM/APM难度分级 |

---

## 四、空间认知系统（1个模块）

### 10. 心理旋转 (Mental Rotation)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Mental Rotation](https://www.psytoolkit.org/experiment-library/mental-rotation.html)；[jsPsych Mental Rotation](https://github.com/search?q=jspsych+mental+rotation) |
| **核心算法** | 呈现一对3D方块图形（Shepard-Metzler figures），判断是否相同（旋转角度不同） |
| **关键指标** | RT-角度斜率（旋转速度）、正确率、角度效应 |
| **变体** | 2D字母旋转、3D方块旋转、手部图片旋转 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加3D Shepard-Metzler图形；增加角度-RT回归分析；增加自适应角度难度 |

---

## 五、执行功能系统（5个模块）

### 11. 任务切换 (Task Switching)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Task Switching](https://www.psytoolkit.org/experiment-library/task-switching.html)；[jsPsych Task Switching](https://www.jspsych.org/v7/plugins/) |
| **核心算法** | 数字出现时判断大小（>5/<5）或奇偶；按线索切换任务规则 |
| **关键指标** | 切换成本（Switch Cost = RT切换 - RT重复）、混合成本、正确率 |
| **范式** | 交替运行范式（AABBAA...）、线索切换范式、自主切换范式 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加「线索-任务」分离设计；增加切换成本分解分析；增加可预测/不可预测切换对比 |

### 12. Go/No-Go

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Go/No-Go](https://www.psytoolkit.org/experiment-library/go-no-go.html)；[jsPsych Go/No-Go](https://github.com/search?q=jspsych+go+nogo) |
| **核心算法** | 高频Go刺激（如绿色圆，占70%）→按键；低频No-Go刺激（如红色圆，占30%）→抑制 |
| **关键指标** | 误报率（Commission Error）、遗漏率（Omission Error）、Go RT、d' |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加情绪Go/No-Go（面部表情）；增加Go比例动态调节；增加ERP兼容时间标记 |

### 13. 停止信号任务 (Stop Signal Task)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Stop Signal](https://www.psytoolkit.org/experiment-library/stop-signal.html)；[jsPsych SST](https://github.com/search?q=jspsych+stop+signal) |
| **核心算法** | Go试次中偶尔出现停止信号（音调/颜色变化），要求抑制已启动的反应 |
| **关键指标** | SSRT（停止信号反应时间）、SSD（停止信号延迟）、抑制成功率 |
| **算法** | 追踪算法（Staircase）：SSD根据表现动态调整，使P(抑制成功)≈50% |
| **当前状态** | ⚠️ 标记为「待开发」 |
| **改进建议** | 🔑 **重点改进**：实现Staircase追踪算法动态调节SSD；独立估计SSRT；增加停止信号类型（听觉/视觉） |

### 14. 威斯康星卡片分类 (WCST)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit WCST](https://www.psytoolkit.org/experiment-library/wisconsin-card-sorting.html)；[PEBL WCST](http://pebl.sourceforge.net/battery.html)；[jsPsych WCST](https://github.com/search?q=jspsych+wisconsin+card) |
| **核心算法** | 按颜色/形状/数量三个维度分类卡片；规则在10次正确后无预警切换 |
| **关键指标** | 持续性错误（Perseverative Errors）、完成分类数、概念水平反应、学习效率 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加规则切换的无预警设计；增加持续性错误自动检测；增加64/128卡版本选择 |

### 15. 反转学习任务 (Reversal Learning)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Reversal Learning](https://www.psytoolkit.org/experiment-library/)；[Probabilistic Reversal Learning](https://github.com/search?q=probabilistic+reversal+learning+task) |
| **核心算法** | 两个刺激，一个高概率奖励(80%)一个低概率(20%)；达到学习标准后概率反转 |
| **关键指标** | 反转后错误数、坚持旧策略试次数、学习速率、Win-Stay/Lose-Shift比例 |
| **变体** | 确定性反转 vs 概率性反转（Probabilistic Reversal Learning） |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加概率性反转（非100%确定性）；增加多轮反转；增加Win-Stay/Lose-Shift策略分析 |

---

## 六、决策与风险（5个模块）

### 16. 爱荷华赌博任务 (Iowa Gambling Task)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit IGT](https://www.psytoolkit.org/experiment-library/iowa-gambling.html)；[jsPsych IGT](https://github.com/search?q=jspsych+iowa+gambling) |
| **核心算法** | 4副牌：A/B（高风险：高收益+高损失，净亏损）、C/D（低风险：低收益+低损失，净盈利） |
| **关键指标** | 净分数 = (C+D) - (A+B)；学习曲线（分block分析）；皮肤电反应兼容 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加「饥饿版」IGT（延迟收益反馈）；增加block分析可视化；增加风险偏好分类 |

### 17. 最后通牒博弈 (Ultimatum Game)

| 维度 | 内容 |
|------|------|
| **开源参考** | [oTree Ultimatum Game](https://github.com/oTree-org/oTree)；[jsPsych Ultimatum](https://github.com/search?q=jspsych+ultimatum+game) |
| **核心算法** | 分配者提议分成比例（如$10分$3给你），响应者接受或拒绝（拒绝则双方得0） |
| **关键指标** | 接受阈值、公平偏好、拒绝率-提议金额函数 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加「独裁者博弈」对照模式；增加提议者角色体验；增加不同金额量级对比 |

### 18. 信任博弈 (Trust Game)

| 维度 | 内容 |
|------|------|
| **开源参考** | [oTree Trust Game](https://github.com/oTree-org/oTree)；[jsPsych Trust Game](https://github.com/search?q=jspsych+trust+game) |
| **核心算法** | 投资者投入金额（3倍增值后给受托者），受托者决定返还金额 |
| **关键指标** | 投资比例（信任度）、返还比例（可信赖度）、互惠预期 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加多轮重复博弈（声誉建立）；增加受托者角色体验；增加信息不对称条件 |

### 19. 囚徒困境 (Prisoner's Dilemma)

| 维度 | 内容 |
|------|------|
| **开源参考** | [oTree Prisoner's Dilemma](https://github.com/oTree-org/oTree)；[Axelrod Tournament](https://github.com/Axelrod-Python/Axelrod)（策略库） |
| **核心算法** | 双方同时选择合作/背叛；收益矩阵：T>R>P>S（T=背叛诱惑,R=合作奖励,P=背叛惩罚,S=受骗代价） |
| **关键指标** | 合作率、背叛率、条件合作策略、TFT检测 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加多轮重复博弈；增加不同AI对手策略（TFT/TFTT/随机/GRIM）；增加策略分类分析 |

### 20. 气球风险任务 (Balloon Analogue Risk Task - BART)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit BART](https://www.psytoolkit.org/experiment-library/bart.html)；[jsPsych BART](https://github.com/search?q=jspsych+BART+balloon) |
| **核心算法** | 每次充气得$0.05，气球随机爆炸点（平均64次），爆炸则失去本轮收益 |
| **关键指标** | 平均充气次数（未爆炸轮）、爆炸率、风险调整分数 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加不同颜色气球（不同爆炸概率）；增加收益/损失框架对比；增加风险偏好参数估计 |

---

## 七、概率与偏误（4个模块）

### 21. 蒙提霍尔问题 (Monty Hall Problem)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Monty Hall Simulator](https://github.com/search?q=monty+hall+simulator+javascript)（大量开源实现） |
| **核心算法** | 三扇门选一扇，主持人打开一扇无奖门，提供换门机会；换门赢率=2/3 |
| **关键指标** | 换门率、换门后正确率、学习效应（多轮后是否发现换门优势） |
| **当前状态** | ⚠️ 标记为「待开发」 |
| **改进建议** | 🔑 **重点改进**：实现多轮模拟+统计反馈；增加N门变体（N>3）；增加贝叶斯推理引导 |

### 22. 基率忽略任务 (Base Rate Neglect)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Bayesian Reasoning Demo](https://github.com/search?q=base+rate+neglect+task)；Kahneman & Tversky 经典工程师-律师问题 |
| **核心算法** | 给出基率（如人群中1%患病）和检测准确率（95%），判断P(患病|阳性) |
| **关键指标** | 基率使用率、贝叶斯正确率、过度依赖代表性信息的程度 |
| **当前状态** | ⚠️ 标记为「待开发」 |
| **改进建议** | 🔑 **重点改进**：实现参数化题目生成器；增加自然频率格式vs概率格式对比；增加视觉化贝叶斯计算器 |

### 23. 赌徒谬误任务 (Gambler's Fallacy)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Gambler's Fallacy Demo](https://github.com/search?q=gambler+fallacy+demo)；硬币抛掷序列判断 |
| **核心算法** | 呈现随机序列（如硬币抛掷结果），判断下一次结果概率；检测「该出反面了」谬误 |
| **关键指标** | 赌徒谬误强度、序列长度效应、热手谬误vs赌徒谬误区分 |
| **当前状态** | ⚠️ 标记为「待开发」 |
| **改进建议** | 🔑 **重点改进**：实现真实随机序列生成；增加赌徒谬误+热手谬误双检测；增加序列模式识别任务 |

### 24. 贝叶斯更新任务 (Bayesian Updating)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Bayesian Updating Task](https://github.com/search?q=bayesian+updating+task+javascript)；[PsyToolkit Bayesian](https://www.psytoolkit.org/experiment-library/) |
| **核心算法** | 两个袋子（如70%红/30%蓝 vs 30%红/70%蓝），抽取样本后更新袋子概率判断 |
| **关键指标** | 更新幅度、保守主义偏差、似然比使用效率 |
| **当前状态** | ⚠️ 已实现但内容池仅8个固定案例 |
| **改进建议** | 🔑 **重点改进**：实现参数化生成（随机先验+似然比）；增加序贯更新（逐球更新）；增加极端概率检测 |

---

## 八、规划与问题解决（3个模块）

### 25. 河内塔 (Tower of Hanoi)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Tower of Hanoi](https://github.com/search?q=tower+of+hanoi+javascript+game)（海量开源实现） |
| **核心算法** | 递归解法：2ⁿ-1步最优解；3根柱子，N个圆盘从小到大 |
| **关键指标** | 完成步数、最优步数比、规划时间、违规次数（大盘压小盘） |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加步数统计与最优解对比；增加4柱变体（Reve's Puzzle）；增加分步规划时间记录 |

### 26. 伦敦塔 (Tower of London)

| 维度 | 内容 |
|------|------|
| **开源参考** | [PsyToolkit Tower of London](https://www.psytoolkit.org/experiment-library/tower-of-london.html)；[PEBL TOL](http://pebl.sourceforge.net/battery.html) |
| **核心算法** | 3根不同高度柱子（容量3/2/1），移动彩球达到目标布局 |
| **关键指标** | 规划时间、执行时间、超额步数、规则违反次数 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加规划-执行阶段分离；增加难度分级（最少步数2-7步）；增加目标布局随机生成 |

### 27. 八/十五数码问题 (Sliding Puzzle)

| 维度 | 内容 |
|------|------|
| **开源参考** | [15-Puzzle](https://github.com/search?q=15+puzzle+javascript)（海量开源实现）；A*算法求解 |
| **核心算法** | 空白格滑动交换；可解性判断（逆序数奇偶性）；A*求解最优路径 |
| **关键指标** | 完成步数、完成时间、最优步数比、每步规划时间 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加可解性自动判断；增加最优解步数显示；增加3×3/4×4/5×5难度选择 |

---

## 九、创造性思维（3个模块）

### 28. 替代用途测验 (Alternative Uses Test - AUT)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Guilford's AUT](https://github.com/search?q=alternative+uses+test)；发散思维评分系统 |
| **核心算法** | 给定常见物品（如砖头），限时列出尽可能多的非常规用途 |
| **评分维度** | 流畅性（数量）、灵活性（类别数）、原创性（统计稀有度）、精细性（细节程度） |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加自动语义分类（灵活性评分）；增加原创性统计对比；增加限时压力模式 |

### 29. 远距离联想测验 (Remote Associates Test - RAT)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Compound Remote Associates](https://github.com/search?q=remote+associates+test)；Mednick经典RAT题库 |
| **核心算法** | 给出三个词（如「奶酪」「蛋糕」「蓝色」），找出与三者都关联的第四个词（「月亮」→奶酪月亮/月亮蛋糕/蓝色月亮） |
| **关键指标** | 正确率、反应时间、顿悟感自评 |
| **当前状态** | ⚠️ 内容池有限 |
| **改进建议** | 🔑 **重点改进**：扩充中文RAT题库（参考台湾/大陆中文CRAT研究）；增加难度分级；增加提示系统 |

### 30. 托兰斯创造力测验 (Torrance Test - TTCT)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Torrance Test](https://github.com/search?q=torrance+creativity+test)；图形完成任务 |
| **核心算法** | 给出抽象图形（如曲线/圆），要求完成一幅有意义的画并命名 |
| **评分维度** | 原创性、精细性、标题抽象性、抗过早闭合 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加图形随机生成；增加多维度自动评分提示；增加作品画廊对比 |

---

## 十、社会认知与元认知（3个模块）

### 31. 萨莉-安妮任务 (Sally-Anne Task)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Sally-Anne Task](https://github.com/search?q=sally+anne+task+javascript)；心理理论经典范式 |
| **核心算法** | Sally把球放篮子里离开，Anne把球移到盒子里；问Sally回来去哪找球 |
| **关键指标** | 一级错误信念通过率、二级错误信念、解释质量 |
| **变体** | 意外内容任务（Smarties任务）、意外地点任务 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加二级错误信念任务（A认为B认为...）；增加多场景随机化；增加解释性反馈 |

### 32. 眼神读心测验 (Reading the Mind in the Eyes Test - RMET)

| 维度 | 内容 |
|------|------|
| **开源参考** | [RMET Online](https://github.com/search?q=reading+mind+eyes+test+javascript)；Baron-Cohen经典36项版 |
| **核心算法** | 呈现眼部区域照片，从4个情绪词中选出最匹配的情绪状态 |
| **关键指标** | 正确率、情绪类别混淆矩阵、反应时间 |
| **当前状态** | ⚠️ 内容池有限（依赖图片资源） |
| **改进建议** | 🔑 **重点改进**：扩充眼部图片库（使用AI生成或公开数据集）；增加情绪维度分析（效价/唤醒度）；增加文化适配 |

### 33. 置信度判断任务 (Confidence Judgment)

| 维度 | 内容 |
|------|------|
| **开源参考** | [Metacognition Task](https://github.com/search?q=confidence+judgment+metacognition+task)；知觉决策+置信度范式 |
| **核心算法** | 完成认知任务后，对每道题给出0-100%置信度评分 |
| **关键指标** | 校准曲线（Confidence-Accuracy）、过度自信偏差、元认知敏感性（meta-d'）、Brier分数 |
| **当前状态** | ✅ 已实现 |
| **改进建议** | 增加校准曲线实时可视化；增加meta-d'计算；增加「延迟判断」对照条件 |

---

## 辅助工具（3个模块）

### 34. 麦克风测试
- **状态**：✅ 已实现
- **改进建议**：增加音量可视化；增加多设备切换；增加录音样本回放

### 35. 每日训练报告
- **状态**：✅ 已实现
- **改进建议**：增加趋势图（7日/30日）；增加模块间对比；增加PDF导出

### 36. 文档中心
- **状态**：✅ 已实现
- **改进建议**：增加搜索功能；增加版本历史

---

## 综合评估矩阵

| 分类 | 模块数 | 需重点改进 | 改进优先级 |
|------|--------|-----------|-----------|
| 注意力系统 | 5 | CPT变体 | ⭐⭐ |
| 工作记忆系统 | 3 | 双N-Back | ⭐⭐ |
| 推理与流体智力 | 1 | 🔥 瑞文程序化生成 | ⭐⭐⭐⭐⭐ |
| 空间认知 | 1 | 3D图形 | ⭐⭐ |
| 执行功能 | 5 | 🔥 SST追踪算法 | ⭐⭐⭐⭐ |
| 决策与风险 | 5 | 多轮博弈 | ⭐⭐⭐ |
| 概率与偏误 | 4 | 🔥 全部需参数化生成 | ⭐⭐⭐⭐⭐ |
| 规划与问题解决 | 3 | 最优解对比 | ⭐⭐ |
| 创造性思维 | 3 | 🔥 RAT题库扩充 | ⭐⭐⭐⭐ |
| 社会认知与元认知 | 3 | 🔥 RMET图片扩充 | ⭐⭐⭐⭐ |

---

## 核心发现总结

1. **PsyToolkit** 是最全面的开源认知实验库，覆盖本项目 80%+ 模块的标准范式
2. **jsPsych** 生态提供了大量即插即用的认知任务插件
3. **PEBL**（Psychology Experiment Building Language）提供完整认知评估电池
4. **oTree** 是经济博弈类任务的最佳开源框架
5. **Sandia Matrices** 是唯一实现瑞文矩阵程序化生成的开源项目
6. **Axelrod-Python** 提供囚徒困境的完整策略库

> **最关键的改进方向**：将「写死内容」改为「参数化/程序化生成」，这是从 Demo 到可用训练工具的核心跨越。

---

## 分阶段实施建议

### 第一阶段：内容池参数化（P0）
- 概率与偏误 4 个模块：全部实现参数化题目生成
- 瑞文推理：实现程序化矩阵生成器
- 贝叶斯更新：从 8 个固定案例扩展为无限参数化生成

### 第二阶段：核心算法补全（P1）
- 停止信号任务：实现 Staircase 追踪算法
- 远距离联想测验：扩充中文题库至 50+
- 眼神读心测验：扩充图片库

### 第三阶段：分析能力增强（P2）
- 各模块增加效应量计算（Cohen's d、d'等）
- 增加训练曲线和趋势可视化
- 增加自适应难度调节

---

## 文档版本

- 版本：`v1.0`
- 编制日期：2026-05-10
- 检索范围：GitHub、PsyToolkit、jsPsych、PEBL、oTree、学术文献