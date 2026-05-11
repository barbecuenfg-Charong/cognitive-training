(function initDailyPlan(global) {
    const DAILY_DOMAINS = ["attention", "memory", "executive", "reasoningSpatial", "decision"];
    const DOMAIN_LABELS = {
        attention: "注意力",
        memory: "工作记忆",
        executive: "执行功能",
        reasoningSpatial: "推理/空间",
        decision: "决策"
    };

    const CANDIDATES = [
        {
            id: "schulte",
            title: "舒尔特方格",
            domain: "attention",
            href: "schulte.html",
            minutes: 4,
            goal: "稳定视觉搜索速度，减少漏扫和回看。",
            params: "建议 5x5 或 1-50 入门量，优先保持节奏稳定。",
            reason: "短时注意力启动项，适合放在每日训练开头。",
            supportsSeed: true
        },
        {
            id: "flanker",
            title: "Flanker 专注",
            domain: "attention",
            href: "flanker.html",
            minutes: 4,
            goal: "在干扰箭头中保持目标判断准确。",
            params: "建议标准轮次，先追求正确率再提速。",
            reason: "补充选择性注意和抗干扰控制。",
            supportsSeed: true
        },
        {
            id: "cpt",
            title: "持续表现任务",
            domain: "attention",
            href: "cpt.html",
            minutes: 5,
            goal: "维持警觉性并减少冲动点击。",
            params: "建议完成一轮短训练，关注漏报和误报。",
            reason: "用于检测注意力持久性，和搜索类任务形成轮换。",
            supportsSeed: true
        },
        {
            id: "nback",
            title: "N-Back 记忆",
            domain: "memory",
            href: "nback.html",
            minutes: 5,
            goal: "训练持续更新和匹配监控。",
            params: "建议 2-back、20 轮、约 2 秒节奏；低于 70% 可降到 1-back。",
            reason: "工作记忆核心项目，适合作为每日主负荷。",
            supportsSeed: true
        },
        {
            id: "corsi",
            title: "科西方块",
            domain: "memory",
            href: "corsi.html",
            minutes: 4,
            goal: "提升视觉空间顺序记忆。",
            params: "建议从当前可稳定完成的跨度开始，连续错误后停止。",
            reason: "和 N-Back 的更新负荷不同，适合隔日轮换。",
            supportsSeed: true
        },
        {
            id: "digit-span",
            title: "数字广度",
            domain: "memory",
            href: "digit-span.html",
            minutes: 4,
            goal: "扩展短时保持和复述容量。",
            params: "建议顺背热身后再做倒背，记录最大稳定跨度。",
            reason: "低设备负担，适合补足记忆广度。",
            supportsSeed: true
        },
        {
            id: "task-switching",
            title: "任务切换",
            domain: "executive",
            href: "task-switching.html",
            minutes: 5,
            goal: "降低规则转换成本，保持切换后准确率。",
            params: "建议标准轮次，重点观察切换题反应时。",
            reason: "执行功能的认知灵活性主项。",
            supportsSeed: true
        },
        {
            id: "go-no-go",
            title: "Go/No-Go",
            domain: "executive",
            href: "go-no-go.html",
            minutes: 4,
            goal: "训练优势反应下的抑制能力。",
            params: "建议标准 go/no-go 比例，误按偏多时放慢节奏。",
            reason: "和任务切换形成抑制控制轮换。",
            supportsSeed: true
        },
        {
            id: "wisconsin-card",
            title: "威斯康星卡片分类",
            domain: "executive",
            href: "wisconsin-card.html",
            minutes: 5,
            goal: "通过反馈推断规则并减少固着错误。",
            params: "建议完成一轮短分类，复盘规则切换节点。",
            reason: "适合训练策略更新和反馈学习。",
            supportsSeed: true
        },
        {
            id: "raven",
            title: "瑞文推理",
            domain: "reasoningSpatial",
            href: "raven.html",
            minutes: 5,
            goal: "识别图形关系并稳定完成抽象推理。",
            params: "建议选择中等难度，限制每题思考时间。",
            reason: "推理/空间域的抽象规律训练。",
            supportsSeed: true
        },
        {
            id: "mental-rotation",
            title: "心理旋转",
            domain: "reasoningSpatial",
            href: "mental-rotation.html",
            minutes: 4,
            goal: "提升空间表征旋转速度和准确性。",
            params: "建议先保证同/异判断准确，再提高反应速度。",
            reason: "和瑞文推理互补，避免推理域单一化。",
            supportsSeed: true
        },
        {
            id: "balloon-risk",
            title: "气球风险任务",
            domain: "decision",
            href: "balloon-risk.html",
            minutes: 4,
            goal: "练习收益、风险和及时止盈的权衡。",
            params: "建议一轮短训练，关注爆炸前平均泵数。",
            reason: "决策域的风险控制代表项目。",
            supportsSeed: true
        },
        {
            id: "iowa-gambling",
            title: "爱荷华赌博任务",
            domain: "decision",
            href: "iowa-gambling.html",
            minutes: 5,
            goal: "在短期奖励和长期收益间建立策略。",
            params: "建议完成一轮，复盘是否偏向高惩罚牌堆。",
            reason: "补充长期反馈下的情感决策训练。",
            supportsSeed: false
        },
        {
            id: "ultimatum-game",
            title: "最后通牒博弈",
            domain: "decision",
            href: "ultimatum-game.html",
            minutes: 4,
            goal: "校准公平阈值和拒绝成本判断。",
            params: "建议标准提议集，关注低公平方案接受率。",
            reason: "用于轮换社会决策，不让风险任务固定占位。",
            supportsSeed: true
        }
    ];

    const DEFAULT_PLAN_IDS = ["schulte", "nback", "task-switching", "mental-rotation"];
    const MAX_RECENT_SESSIONS = 80;

    function toDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function getDayIndex(date) {
        const start = new Date(date.getFullYear(), 0, 1);
        return Math.floor((date - start) / 86400000);
    }

    function getSessions() {
        const api = global.TrainingResults;
        if (!api || typeof api.getAllSessions !== "function") {
            return [];
        }
        return api.getAllSessions();
    }

    function normalizeId(session) {
        return String(session.moduleId || session.gameId || "").trim();
    }

    function buildStats(sessions) {
        const stats = {};
        sessions.slice(0, MAX_RECENT_SESSIONS).forEach((session, index) => {
            const id = normalizeId(session);
            if (!id) return;
            if (!stats[id]) {
                stats[id] = {
                    count: 0,
                    lastIndex: index,
                    lastFinishedAt: session.finishedAt || null
                };
            }
            stats[id].count += 1;
            stats[id].lastIndex = Math.min(stats[id].lastIndex, index);
        });
        return stats;
    }

    function buildDomainStats(sessions) {
        const byId = Object.fromEntries(CANDIDATES.map((item) => [item.id, item]));
        const stats = {};
        sessions.slice(0, MAX_RECENT_SESSIONS).forEach((session, index) => {
            const item = byId[normalizeId(session)];
            if (!item) return;
            if (!stats[item.domain]) {
                stats[item.domain] = { count: 0, lastIndex: index };
            }
            stats[item.domain].count += 1;
            stats[item.domain].lastIndex = Math.min(stats[item.domain].lastIndex, index);
        });
        return stats;
    }

    function rotateDomains(date) {
        const offset = getDayIndex(date) % DAILY_DOMAINS.length;
        return DAILY_DOMAINS.slice(offset).concat(DAILY_DOMAINS.slice(0, offset));
    }

    function getPlanSize(sessions) {
        if (sessions.length === 0) return 4;
        const todayKey = toDateKey(new Date());
        const todayCount = sessions.filter((session) => {
            if (!session.finishedAt) return false;
            return toDateKey(new Date(session.finishedAt)) === todayKey;
        }).length;
        return todayCount >= 2 ? 3 : 4;
    }

    function scoreCandidate(item, itemStats, domainStats, position) {
        const itemStat = itemStats[item.id] || { count: 0, lastIndex: 999 };
        const domainStat = domainStats[item.domain] || { count: 0, lastIndex: 999 };
        let score = 0;
        score += Math.min(itemStat.lastIndex, 30) * 3;
        score += Math.min(domainStat.lastIndex, 30) * 2;
        score -= itemStat.count * 5;
        score -= domainStat.count * 2;
        score += position;
        if (itemStat.lastIndex <= 2) score -= 80;
        if (domainStat.lastIndex <= 1) score -= 25;
        return score;
    }

    function pickBestForDomain(domain, selectedIds, itemStats, domainStats, position) {
        return CANDIDATES
            .filter((item) => item.domain === domain && !selectedIds.has(item.id))
            .map((item) => ({
                item,
                score: scoreCandidate(item, itemStats, domainStats, position)
            }))
            .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "zh-CN"))[0]?.item || null;
    }

    function createDefaultPlan() {
        return DEFAULT_PLAN_IDS.map((id) => CANDIDATES.find((item) => item.id === id)).filter(Boolean);
    }

    function createAdaptivePlan(sessions) {
        if (sessions.length === 0) {
            return createDefaultPlan();
        }

        const itemStats = buildStats(sessions);
        const domainStats = buildDomainStats(sessions);
        const selected = [];
        const selectedIds = new Set();
        const targetSize = getPlanSize(sessions);

        rotateDomains(new Date()).some((domain, index) => {
            const item = pickBestForDomain(domain, selectedIds, itemStats, domainStats, index);
            if (item) {
                selected.push(item);
                selectedIds.add(item.id);
            }
            return selected.length >= targetSize;
        });

        return selected.length >= 3 ? selected : createDefaultPlan();
    }

    function buildSeed(item, index) {
        const dateKey = toDateKey(new Date());
        return `daily-${dateKey}-${index + 1}-${item.id}`;
    }

    function withSeed(item, index) {
        if (!item.supportsSeed) {
            return { href: item.href, seed: null };
        }
        const seed = buildSeed(item, index);
        const separator = item.href.includes("?") ? "&" : "?";
        return {
            href: `${item.href}${separator}seed=${encodeURIComponent(seed)}`,
            seed
        };
    }

    function renderPlan(plan, sessions) {
        const planList = document.getElementById("plan-list");
        const planCount = document.getElementById("plan-count");
        const planMinutes = document.getElementById("plan-minutes");
        const historyCount = document.getElementById("history-count");
        const planDate = document.getElementById("plan-date");

        if (planDate) {
            planDate.textContent = toDateKey(new Date());
        }
        if (planCount) {
            planCount.textContent = String(plan.length);
        }
        if (planMinutes) {
            const minutes = plan.reduce((sum, item) => sum + item.minutes, 0);
            planMinutes.textContent = `${minutes}`;
        }
        if (historyCount) {
            historyCount.textContent = String(sessions.length);
        }
        if (!planList) return;

        const fragment = document.createDocumentFragment();
        plan.forEach((item, index) => {
            const link = withSeed(item, index);
            const article = document.createElement("article");
            article.className = "plan-item";

            const head = document.createElement("div");
            head.className = "plan-item-head";

            const title = document.createElement("h2");
            title.textContent = `${index + 1}. ${item.title}`;

            const domain = document.createElement("span");
            domain.className = "domain-pill";
            domain.textContent = DOMAIN_LABELS[item.domain] || item.domain;

            head.append(title, domain);

            const goal = document.createElement("p");
            goal.className = "plan-detail";
            goal.textContent = `目标：${item.goal}`;

            const params = document.createElement("p");
            params.className = "plan-detail";
            params.textContent = `建议参数：${item.params}`;

            const reason = document.createElement("p");
            reason.className = "plan-reason";
            reason.textContent = `推荐理由：${item.reason}`;

            const actions = document.createElement("div");
            actions.className = "plan-actions";

            const start = document.createElement("a");
            start.className = "btn primary";
            start.href = link.href;
            start.textContent = "开始训练";
            actions.appendChild(start);

            if (link.seed) {
                const seed = document.createElement("span");
                seed.className = "seed-note";
                seed.textContent = `seed: ${link.seed}`;
                actions.appendChild(seed);
            }

            article.append(head, goal, params, reason, actions);
            fragment.appendChild(article);
        });

        planList.innerHTML = "";
        planList.appendChild(fragment);
    }

    function init() {
        const sessions = getSessions();
        const plan = createAdaptivePlan(sessions);
        renderPlan(plan, sessions);
    }

    global.addEventListener("DOMContentLoaded", init);
})(window);
