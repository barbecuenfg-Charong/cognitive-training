export const sections = [
    {
        title: "1. 注意力系统",
        icon: "fas fa-eye",
        tasks: [
            {
                title: "舒尔特方格",
                tag: "专注稳定性",
                desc: "飞行员专用训练法。在高度集中的状态下快速扫描网格，提升抗干扰能力。",
                href: "schulte.html",
                icon: "fas fa-th",
                cardClass: "card-schulte",
                status: "active"
            },
            {
                title: "Flanker 专注",
                tag: "选择性注意",
                desc: "在强干扰环境中精准锁定目标。提升排除无关信息、聚焦核心任务的能力。",
                href: "flanker.html",
                icon: "fas fa-arrows-alt-h",
                cardClass: "card-flanker",
                status: "active"
            },
            {
                title: "斯特鲁普测试",
                tag: "抑制控制",
                desc: "克服字义干扰，快速识别颜色。锻炼大脑的冲突解决能力与反应速度。",
                href: "stroop.html",
                icon: "fas fa-palette",
                cardClass: "card-stroop",
                status: "active"
            },
            {
                title: "中科院注意力训练",
                tag: "视觉广度",
                desc: "在不规则分布的碎片中快速寻找数字，打破视觉定势，扩展视幅广度。",
                href: "focus.html",
                icon: "fas fa-search",
                cardClass: "card-focus",
                status: "active"
            },
            {
                title: "持续表现任务",
                tag: "警觉性",
                desc: "保持高度专注，在快速变化的字母流中捕捉目标。测试注意力持久性与冲动控制。",
                href: "cpt.html",
                icon: "fas fa-stopwatch",
                cardClass: "card-cpt",
                status: "active"
            }
        ]
    },
    {
        title: "2. 工作记忆系统",
        icon: "fas fa-memory",
        tasks: [
            {
                title: "N-Back 记忆",
                tag: "工作记忆更新",
                desc: "经典的流体智力训练。持续更新大脑中的信息缓存，挑战记忆极限。",
                href: "nback.html",
                icon: "fas fa-brain",
                cardClass: "card-nback",
                status: "active"
            },
            {
                title: "科西方块",
                tag: "空间工作记忆",
                desc: "观察方块的点亮顺序并复现。经典的视觉空间短时记忆广度测试。",
                href: "corsi.html",
                icon: "fas fa-cubes",
                cardClass: "card-corsi",
                status: "active"
            },
            {
                title: "数字广度",
                tag: "短时记忆容量",
                desc: "经典的短时记忆测试。记住屏幕上的数字序列并准确复述。",
                href: "digit-span.html",
                icon: "fas fa-sort-numeric-up",
                cardClass: "card-digit-span",
                status: "active"
            }
        ]
    },
    {
        title: "3. 推理与流体智力",
        icon: "fas fa-puzzle-piece",
        tasks: [
            {
                title: "瑞文推理",
                tag: "抽象逻辑",
                desc: "观察图形规律，推导出缺失的图案。经典的流体智力与抽象逻辑测试。",
                href: "raven.html",
                icon: "fas fa-shapes",
                cardClass: "card-raven",
                status: "active"
            }
        ]
    },
    {
        title: "4. 空间认知系统",
        icon: "fas fa-cube",
        tasks: [
            {
                title: "心理旋转",
                tag: "空间想象",
                desc: "判断两个旋转的图形是否相同。测试空间想象力与心理旋转速度。",
                href: "mental-rotation.html",
                icon: "fas fa-sync-alt",
                cardClass: "card-mental-rotation",
                status: "active"
            }
        ]
    },
    {
        title: "5. 执行功能系统",
        icon: "fas fa-tasks",
        tasks: [
            {
                title: "任务切换",
                tag: "认知灵活性",
                desc: "快速在不同规则间切换。测试认知灵活性与转换成本。",
                href: "task-switching.html",
                icon: "fas fa-random",
                cardClass: "card-task-switching",
                status: "active"
            },
            {
                title: "Go/No-Go",
                tag: "冲动抑制",
                desc: "高频Go，见红停手。测量反应抑制与冲动控制。",
                href: "go-no-go.html",
                icon: "fas fa-traffic-light",
                cardClass: "card-go-no-go",
                status: "active"
            },
            {
                title: "停止信号任务",
                tag: "反应抑制",
                desc: "在出现停止信号时抑制已准备好的反应，评估反应抑制与停止信号反应时。",
                icon: "fas fa-hand-paper",
                href: "stop-signal.html",
                cardClass: "card-stop-signal",
                status: "active"
            },
            {
                title: "威斯康星卡片分类",
                tag: "规则转换",
                desc: "通过反馈推断并切换分类规则，训练认知灵活性与策略更新能力。",
                icon: "fas fa-layer-group",
                href: "wisconsin-card.html",
                cardClass: "card-wcst",
                status: "active"
            },
            {
                title: "反转学习任务",
                tag: "适应性学习",
                desc: "在奖励概率反转后快速重建策略，提升适应变化与纠错能力。",
                icon: "fas fa-undo",
                href: "reversal-learning.html",
                cardClass: "card-reversal-learning",
                status: "active"
            }
        ]
    },
    {
        title: "6. 决策与风险",
        icon: "fas fa-balance-scale",
        tasks: [
            {
                title: "爱荷华赌博任务",
                tag: "情感决策",
                desc: "在短期收益和长期损失之间权衡，训练风险判断与长期决策。",
                icon: "fas fa-dice",
                href: "iowa-gambling.html",
                cardClass: "card-iowa-gambling",
                status: "active"
            },
            {
                title: "最后通牒博弈",
                tag: "公平决策",
                desc: "面对公平与不公平提议做出接受或拒绝，训练社会公平权衡。",
                icon: "fas fa-handshake",
                href: "ultimatum-game.html",
                cardClass: "card-ultimatum-game",
                status: "active"
            },
            {
                title: "信任博弈",
                tag: "社会互惠",
                desc: "在重复互动中动态调整投入，训练信任形成与互惠预期管理。",
                icon: "fas fa-users",
                href: "trust-game.html",
                cardClass: "card-trust-game",
                status: "active"
            },
            {
                title: "囚徒困境",
                tag: "合作与背叛",
                desc: "在重复博弈中平衡短期收益与长期合作，训练策略稳定性与博弈推断。",
                icon: "fas fa-handcuffs",
                href: "prisoner-dilemma.html",
                cardClass: "card-prisoner-dilemma",
                status: "active"
            },
            {
                title: "气球风险任务",
                tag: "风险承担",
                desc: "在爆炸风险下持续充气或及时止盈，评估风险偏好与冲动管理。",
                icon: "fas fa-balloon",
                href: "balloon-risk.html",
                cardClass: "card-balloon-risk",
                status: "active"
            }
        ]
    },
    {
        title: "7. 概率与偏误",
        icon: "fas fa-percentage",
        tasks: [
            {
                title: "蒙提霍尔问题",
                tag: "条件概率",
                desc: "在换门与坚持之间做选择，通过重复反馈理解条件概率与直觉偏差。",
                icon: "fas fa-door-open",
                href: "monty-hall.html",
                cardClass: "card-monty-hall",
                status: "active"
            },
            {
                title: "基率忽略任务",
                tag: "统计直觉",
                desc: "在检测准确率和基础发生率之间权衡，训练把基率纳入概率判断。",
                icon: "fas fa-chart-pie",
                href: "base-rate.html",
                cardClass: "card-base-rate",
                status: "active"
            },
            {
                title: "赌徒谬误任务",
                tag: "随机性认知",
                desc: "面对随机序列做下一次预测，识别连串后的反向预测倾向。",
                icon: "fas fa-coins",
                href: "gambler-fallacy.html",
                cardClass: "card-gambler",
                status: "active"
            },
            {
                title: "贝叶斯更新任务",
                tag: "信念修正",
                desc: "根据先验和新证据修正概率估计，练习贝叶斯式信念更新。",
                icon: "fas fa-chart-bar",
                href: "bayes-update.html",
                cardClass: "card-bayes",
                status: "active"
            }
        ]
    },
    {
        title: "8. 规划与问题解决",
        icon: "fas fa-chess-board",
        tasks: [
            {
                title: "河内塔",
                tag: "递归规划",
                desc: "在最少步数约束下完成圆盘搬移，训练多步规划与规则执行。",
                icon: "fas fa-chess-rook",
                href: "hanoi.html",
                cardClass: "card-hanoi",
                status: "active"
            },
            {
                title: "伦敦塔",
                tag: "前瞻规划",
                desc: "在多步约束下完成目标布局，训练前瞻规划与执行控制。",
                icon: "fas fa-building",
                href: "london-tower.html",
                cardClass: "card-london-tower",
                status: "active"
            },
            {
                title: "八/十五数码问题",
                tag: "路径搜索",
                desc: "通过移动方块还原序列，训练状态搜索、局面评估与问题求解能力。",
                icon: "fas fa-puzzle-piece",
                href: "sliding-puzzle.html",
                cardClass: "card-sliding-puzzle",
                status: "active"
            }
        ]
    },
    {
        title: "9. 创造性思维",
        icon: "fas fa-paint-brush",
        tasks: [
            {
                title: "替代用途测验",
                tag: "发散思维",
                desc: "围绕常见物体生成多样用途，提升发散联想与创意流畅性。",
                icon: "fas fa-paperclip",
                href: "alternative-uses.html",
                cardClass: "card-alternative-uses",
                status: "active"
            },
            {
                title: "远距离联想测验",
                tag: "聚合思维",
                desc: "从离散线索中提炼共同关联词，训练聚合推理与概念整合。",
                icon: "fas fa-link",
                href: "remote-associates.html",
                cardClass: "card-remote-associates",
                status: "active"
            },
            {
                title: "托兰斯创造力测验",
                tag: "图形创造",
                desc: "基于抽象图形进行命名与描述，训练原创表达与细节扩展能力。",
                icon: "fas fa-pencil-alt",
                href: "torrance-creative.html",
                cardClass: "card-torrance-creative",
                status: "active"
            }
        ]
    },
    {
        title: "10. 社会认知与元认知",
        icon: "fas fa-users",
        tasks: [
            {
                title: "萨莉-安妮任务",
                tag: "心理理论",
                desc: "在信念与事实冲突情境下判断他人行为，训练心理理论能力。",
                icon: "fas fa-child",
                href: "sally-anne.html",
                cardClass: "card-sally-anne",
                status: "active"
            },
            {
                title: "眼神读心测验",
                tag: "情绪识别",
                desc: "根据眼部线索识别情绪状态，训练社会线索解读与共情推断。",
                icon: "fas fa-eye",
                href: "eyes-reading.html",
                cardClass: "card-eyes-reading",
                status: "active"
            },
            {
                title: "置信度判断任务",
                tag: "元认知监控",
                desc: "对每题给出答案置信度并对比准确率，校准自我评估与决策信心。",
                icon: "fas fa-balance-scale",
                href: "confidence-judgment.html",
                cardClass: "card-confidence-judgment",
                status: "active"
            }
        ]
    },
    {
        title: "辅助工具",
        icon: "fas fa-tools",
        tasks: [
            {
                title: "麦克风测试",
                tag: "工具",
                desc: "测试设备麦克风是否正常工作，确保语音交互功能可用。",
                href: "mic-test.html",
                icon: "fas fa-microphone-alt",
                cardClass: "card-mic-test",
                status: "active"
            },
            {
                title: "每日训练报告",
                tag: "数据分析",
                desc: "查看当日训练场次、时长和关键指标，进行进度回顾。",
                href: "report.html",
                icon: "fas fa-chart-line",
                cardClass: "card-report",
                status: "active"
            },
            {
                title: "文档中心",
                tag: "文档查阅",
                desc: "查看 GLM5/GPT 综合文档系列，包含口径、映射、模板规范与发布门禁。",
                href: "doc/index.html",
                icon: "fas fa-book-open",
                cardClass: "card-doc-center",
                status: "active"
            }
        ]
    }
];
