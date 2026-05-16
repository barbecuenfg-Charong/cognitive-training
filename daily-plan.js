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
            id: "stop-signal",
            title: "Stop Signal",
            domain: "attention",
            href: "stop-signal.html",
            minutes: 4,
            goal: "在抑制已启动反应时保持节奏和稳定性。",
            params: "建议标准短回合，先按最新处方完成，再看速度与稳定性。",
            reason: "用于补齐抑制控制的停止成分，和 Go/No-Go 形成互补。",
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
    const TREND_MIN_SAMPLE_SIZE = 3;
    const TREND_HELPER_WAIT_MS = 900;
    const TREND_ADVICE = {
        "sample-insufficient": {
            label: "样本不足",
            boost: 22,
            params: "趋势样本不足，先补同模块可比记录，暂不升难度。",
            reason: "补样本后再判断周期调整。"
        },
        declining: {
            label: "趋势下降",
            boost: 34,
            params: "跨次趋势下降，本轮降负荷，只降低一个难度参数或缩短轮次。",
            reason: "优先恢复准确性和节奏稳定。"
        },
        "high-volatility": {
            label: "高波动",
            boost: 28,
            params: "跨次波动偏高，本轮做巩固，保持当前难度并减少参数变化。",
            reason: "先观察能否连续稳定，再考虑升阶。"
        },
        "stable-rising": {
            label: "稳定上升",
            boost: 14,
            params: "跨次表现稳定上升，可小幅升阶，但一次只调整一个参数。",
            reason: "用小步进验证负荷是否合适。"
        }
    };

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

    function getSessionTime(session) {
        const value = session && (session.finishedAt || session.startedAt);
        const time = value ? new Date(value).getTime() : 0;
        return Number.isFinite(time) ? time : 0;
    }

    function sortRecentSessions(sessions) {
        return sessions
            .slice()
            .filter((session) => session && Object.keys(session).length > 0)
            .sort((a, b) => getSessionTime(b) - getSessionTime(a));
    }

    function getSessions() {
        const api = global.TrainingResults;
        if (!api || typeof api.getAllSessions !== "function") {
            return [];
        }
        return sortRecentSessions(api.getAllSessions());
    }

    function normalizeId(session) {
        return normalizeModuleId(session && (session.moduleId || session.gameId));
    }

    function normalizeModuleId(value) {
        return String(value || "").trim();
    }

    function toPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        return value;
    }

    function hasDisplayValue(value) {
        if (value === null || value === undefined) {
            return false;
        }
        if (typeof value === "string") {
            return value.trim().length > 0;
        }
        if (typeof value === "number") {
            return Number.isFinite(value);
        }
        if (typeof value === "boolean") {
            return true;
        }
        if (Array.isArray(value)) {
            return value.length > 0;
        }
        if (typeof value === "object") {
            return Object.keys(value).length > 0;
        }
        return false;
    }

    function readSessionValue(session, keys) {
        const summary = toPlainObject(session && session.summary);
        const metrics = toPlainObject(session && session.metrics);
        const sessionData = toPlainObject(session);
        const sources = [summary, metrics, sessionData];

        for (const key of keys) {
            for (const source of sources) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    const value = source[key];
                    if (hasDisplayValue(value)) {
                        return value;
                    }
                }
            }
        }

        return undefined;
    }

    function readObjectValue(source, keys) {
        const root = toPlainObject(source);
        const sources = [
            root,
            toPlainObject(root.trend),
            toPlainObject(root.summary),
            toPlainObject(root.signal),
            toPlainObject(root.plan),
            toPlainObject(root.recommendation),
            toPlainObject(root.advice)
        ];

        for (const key of keys) {
            for (const candidate of sources) {
                if (Object.prototype.hasOwnProperty.call(candidate, key)) {
                    const value = candidate[key];
                    if (hasDisplayValue(value)) {
                        return value;
                    }
                }
            }
        }

        return undefined;
    }

    function toNumber(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string" && value.trim()) {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }

    function compactText(values) {
        return values
            .filter(hasDisplayValue)
            .map((value) => String(value).toLowerCase())
            .join(" ");
    }

    function includesAny(text, patterns) {
        return patterns.some((pattern) => text.includes(pattern));
    }

    function normalizedDelta(value) {
        const number = toNumber(value);
        if (number === null) {
            return null;
        }
        return Math.abs(number) > 1 ? number / 100 : number;
    }

    function isHighVolatilityValue(value) {
        const number = normalizedDelta(value);
        return number !== null && number >= 0.25;
    }

    function isLowVolatilityValue(value) {
        const number = normalizedDelta(value);
        return number !== null && number <= 0.12;
    }

    function getTrainingTrendsApi() {
        const api = global.TrainingTrends;
        return api && typeof api === "object" ? api : null;
    }

    function callTrendHelper(api, name, args) {
        if (!api || typeof api[name] !== "function") {
            return null;
        }
        try {
            const result = api[name](...args);
            return result && typeof result === "object" ? result : null;
        } catch (_error) {
            return null;
        }
    }

    function addTrendSignal(target, moduleId, signal) {
        const id = normalizeModuleId(moduleId);
        if (!id || !signal || typeof signal !== "object" || Array.isArray(signal)) {
            return;
        }
        target[id] = Object.assign({}, target[id] || {}, signal, { moduleId: id });
    }

    function signalModuleId(signal) {
        const value = readObjectValue(signal, [
            "moduleId",
            "gameId",
            "id",
            "taskId",
            "module"
        ]);
        if (value && typeof value === "object") {
            return "";
        }
        return normalizeModuleId(value);
    }

    function collectTrendSignals(target, value) {
        if (!value) {
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item) => collectTrendSignals(target, item));
            return;
        }

        if (typeof value !== "object") {
            return;
        }

        const id = signalModuleId(value);
        if (id) {
            addTrendSignal(target, id, value);
        }

        const containerKeys = [
            "modules",
            "moduleTrends",
            "moduleSignals",
            "byModule",
            "trends",
            "signals",
            "planSignals",
            "recommendations",
            "items"
        ];

        containerKeys.forEach((key) => {
            const container = value[key];
            if (Array.isArray(container)) {
                container.forEach((item) => collectTrendSignals(target, item));
                return;
            }
            if (!container || typeof container !== "object") {
                return;
            }
            Object.keys(container).forEach((moduleId) => {
                const signal = container[moduleId];
                if (signal && typeof signal === "object") {
                    addTrendSignal(target, moduleId, signal);
                    collectTrendSignals(target, signal);
                }
            });
        });

        if (!id) {
            const candidateIds = new Set(CANDIDATES.map((item) => item.id));
            Object.keys(value).forEach((moduleId) => {
                const signal = value[moduleId];
                if (candidateIds.has(moduleId) && signal && typeof signal === "object") {
                    addTrendSignal(target, moduleId, signal);
                    collectTrendSignals(target, signal);
                }
            });
        }
    }

    function groupSessionsByModule(sessions) {
        const groups = {};
        sessions.forEach((session) => {
            const id = normalizeId(session);
            if (!id) return;
            if (!groups[id]) {
                groups[id] = [];
            }
            groups[id].push(session);
        });
        Object.keys(groups).forEach((id) => {
            groups[id].sort((a, b) => getSessionTime(a) - getSessionTime(b));
        });
        return groups;
    }

    function buildTrendContext(sessions) {
        const api = getTrainingTrendsApi();
        const recentSessions = sortRecentSessions(sessions).slice(0, MAX_RECENT_SESSIONS);
        const context = {
            available: Boolean(api),
            analysis: null,
            planSignals: null,
            moduleSignals: {},
            groups: groupSessionsByModule(recentSessions)
        };

        if (!api) {
            return context;
        }

        context.analysis = callTrendHelper(api, "analyzeTrainingTrends", [
            recentSessions,
            { maxSessions: MAX_RECENT_SESSIONS, minSampleSize: TREND_MIN_SAMPLE_SIZE }
        ]);
        context.planSignals = callTrendHelper(api, "buildPlanSignals", [recentSessions]);

        collectTrendSignals(context.moduleSignals, context.analysis);
        collectTrendSignals(context.moduleSignals, context.planSignals);

        if (typeof api.summarizeModuleTrend === "function") {
            Object.keys(context.groups).forEach((moduleId) => {
                const summary = callTrendHelper(api, "summarizeModuleTrend", [context.groups[moduleId]]);
                if (summary) {
                    addTrendSignal(context.moduleSignals, moduleId, summary);
                    collectTrendSignals(context.moduleSignals, summary);
                }
            });
        }

        return context;
    }

    function getTrendSampleCount(signal, moduleSessions) {
        const count = toNumber(readObjectValue(signal, [
            "sampleCount",
            "sampleSize",
            "sessionCount",
            "count",
            "n",
            "observations"
        ]));
        if (count !== null) {
            return count;
        }
        return moduleSessions ? moduleSessions.length : 0;
    }

    function isTrendHighVolatility(signal, text) {
        const explicit = readObjectValue(signal, ["highVolatility", "isVolatile", "volatile"]);
        if (explicit === true) {
            return true;
        }
        const volatility = readObjectValue(signal, [
            "volatility",
            "adaptationVolatility",
            "variability",
            "coefficientOfVariation"
        ]);
        return isHighVolatilityValue(volatility) || includesAny(text, [
            "high volatility",
            "volatile",
            "unstable",
            "波动",
            "不稳"
        ]);
    }

    function trendStatusFromSignal(signal, moduleSessions) {
        if (!signal) {
            return "neutral";
        }

        const sampleCount = getTrendSampleCount(signal, moduleSessions);
        const statusText = compactText([
            readObjectValue(signal, ["status", "trendStatus", "planStatus", "category", "phase", "state"]),
            readObjectValue(signal, ["direction", "trend", "trendDirection", "trajectory", "performanceTrend"]),
            readObjectValue(signal, ["recommendationType", "adviceType", "nextAction"]),
            readObjectValue(signal, ["label", "summary", "reason", "rationale", "advice", "recommendation"])
        ]);
        const delta = normalizedDelta(readObjectValue(signal, [
            "delta",
            "recentDelta",
            "change",
            "scoreDelta",
            "qualityDelta",
            "slope",
            "trendSlope",
            "scoreSlope",
            "qualitySlope"
        ]));
        const volatility = readObjectValue(signal, [
            "volatility",
            "adaptationVolatility",
            "variability",
            "coefficientOfVariation"
        ]);

        if (
            (sampleCount > 0 && sampleCount < TREND_MIN_SAMPLE_SIZE) ||
            includesAny(statusText, ["insufficient", "not enough", "sample", "样本", "补样本"])
        ) {
            return "sample-insufficient";
        }

        if (
            includesAny(statusText, ["declin", "down", "worse", "regress", "drop", "下降", "下滑", "退步", "走弱"]) ||
            (delta !== null && delta <= -0.03)
        ) {
            return "declining";
        }

        if (isTrendHighVolatility(signal, statusText)) {
            return "high-volatility";
        }

        if (
            (includesAny(statusText, ["stable rising", "stable up", "improving", "rising", "upward", "稳定上升", "稳定提升", "上升", "提升"]) ||
                (delta !== null && delta >= 0.03)) &&
            (isLowVolatilityValue(volatility) || includesAny(statusText, ["stable", "steady", "低波动", "稳定"]))
        ) {
            return "stable-rising";
        }

        return "neutral";
    }

    function moduleTrendSummary(moduleId, trendContext) {
        if (!trendContext || !trendContext.available) {
            return null;
        }
        const id = normalizeModuleId(moduleId);
        const signal = trendContext.moduleSignals[id];
        const moduleSessions = trendContext.groups[id] || [];
        if (!signal) {
            return null;
        }
        const status = trendStatusFromSignal(signal, moduleSessions);
        const sampleCount = getTrendSampleCount(signal, moduleSessions);
        return {
            status,
            sampleCount,
            signal
        };
    }

    function trendBoostForItem(item, trendContext) {
        const summary = moduleTrendSummary(item.id, trendContext);
        if (!summary || !TREND_ADVICE[summary.status]) {
            return 0;
        }
        return TREND_ADVICE[summary.status].boost;
    }

    function trendAdviceForItem(item, trendContext) {
        const summary = moduleTrendSummary(item.id, trendContext);
        if (!summary || !TREND_ADVICE[summary.status]) {
            return null;
        }

        const advice = TREND_ADVICE[summary.status];
        const helperReason = readObjectValue(summary.signal, [
            "reason",
            "rationale",
            "summary",
            "description",
            "advice",
            "recommendation"
        ]);
        const evidence = [];
        if (summary.sampleCount > 0) {
            evidence.push(`${summary.sampleCount} 次记录`);
        }
        if (typeof helperReason === "string" && helperReason.trim()) {
            evidence.push(shortText(helperReason, 36));
        }

        return {
            params: advice.params,
            reason: `${advice.label}：${advice.reason}${evidence.length ? `（${evidence.join("；")}）` : ""}`
        };
    }

    function shortText(value, maxLength) {
        const text = String(value).trim();
        if (text.length <= maxLength) {
            return text;
        }
        return `${text.slice(0, maxLength - 1)}…`;
    }

    function formatHintValue(key, value) {
        if (!hasDisplayValue(value)) {
            return "";
        }

        if (typeof value === "boolean") {
            return value ? "是" : "否";
        }

        if (typeof value === "number") {
            if (/ms|speed|duration|time/i.test(key)) {
                return `${Math.round(value)}ms`;
            }
            return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100);
        }

        if (Array.isArray(value)) {
            return value.length > 0 ? shortText(value.join("、"), 24) : "";
        }

        if (typeof value === "object") {
            return shortText(JSON.stringify(value), 28);
        }

        return shortText(value, 32);
    }

    function qualityBoostFromValue(value, direction) {
        if (!hasDisplayValue(value)) {
            return 0;
        }

        if (typeof value === "boolean") {
            return direction === "positive" && value ? 14 : 0;
        }

        if (typeof value === "number") {
            const normalized = value > 1 ? value / 100 : value;
            if (direction === "positive") {
                if (normalized <= 0.3) return 16;
                if (normalized <= 0.5) return 12;
                if (normalized <= 0.7) return 6;
                return 0;
            }
            if (normalized >= 0.75) return 14;
            if (normalized >= 0.55) return 8;
            return 0;
        }

        const text = String(value).toLowerCase();
        const weakPatterns = ["low", "poor", "weak", "unstable", "volatile", "needs", "risk", "fragile", "低", "差", "弱", "不稳", "波动", "待巩固"];
        const strongPatterns = ["good", "stable", "ready", "smooth", "high", "clear", "steady", "稳", "高", "良", "可", "准备好"];
        if (direction === "positive") {
            return weakPatterns.some((pattern) => text.includes(pattern)) ? 14 : 0;
        }
        return strongPatterns.some((pattern) => text.includes(pattern)) ? 12 : 0;
    }

    function consolidationBoost(item, latestSession) {
        if (!latestSession) {
            return 0;
        }

        let boost = 0;
        boost += qualityBoostFromValue(readSessionValue(latestSession, ["staircaseQuality"]), "positive");
        boost += qualityBoostFromValue(readSessionValue(latestSession, ["adaptiveStabilityLabel"]), "positive");
        boost += qualityBoostFromValue(readSessionValue(latestSession, ["spanStability"]), "positive");
        boost += qualityBoostFromValue(readSessionValue(latestSession, ["adaptationVolatility"]), "negative");
        boost += qualityBoostFromValue(readSessionValue(latestSession, ["goWaitingFlag"]), "positive");
        boost += qualityBoostFromValue(readSessionValue(latestSession, ["modeTransitionReadiness"]), "positive");

        if (item.id === "nback" || item.id === "corsi" || item.id === "digit-span") {
            boost += qualityBoostFromValue(readSessionValue(latestSession, ["adaptiveStabilityLabel"]), "positive");
            boost += qualityBoostFromValue(readSessionValue(latestSession, ["spanStability"]), "positive");
            boost += qualityBoostFromValue(readSessionValue(latestSession, ["modeTransitionReadiness"]), "positive");
            boost += qualityBoostFromValue(readSessionValue(latestSession, ["adaptationVolatility"]), "negative");
        }

        if (item.id === "stop-signal") {
            boost += qualityBoostFromValue(readSessionValue(latestSession, ["staircaseQuality", "staircaseQualityLabel"]), "positive");
            boost += qualityBoostFromValue(readSessionValue(latestSession, ["goWaitingFlag"]), "positive");
        }

        return boost;
    }

    function buildStats(sessions) {
        const stats = {};
        sortRecentSessions(sessions).slice(0, MAX_RECENT_SESSIONS).forEach((session, index) => {
            const id = normalizeId(session);
            if (!id) return;
            if (!stats[id]) {
                stats[id] = {
                    count: 0,
                    lastIndex: index,
                    lastFinishedAt: session.finishedAt || null,
                    latestSession: session,
                    latestTime: getSessionTime(session)
                };
            }
            stats[id].count += 1;
            stats[id].lastIndex = Math.min(stats[id].lastIndex, index);
            const sessionTime = getSessionTime(session);
            if (sessionTime >= (stats[id].latestTime || 0)) {
                stats[id].latestSession = session;
                stats[id].latestTime = sessionTime;
                stats[id].lastFinishedAt = session.finishedAt || null;
            }
        });
        return stats;
    }

    function buildDomainStats(sessions) {
        const byId = Object.fromEntries(CANDIDATES.map((item) => [item.id, item]));
        const stats = {};
        sortRecentSessions(sessions).slice(0, MAX_RECENT_SESSIONS).forEach((session, index) => {
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

    function scoreCandidate(item, itemStats, domainStats, position, trendContext) {
        const itemStat = itemStats[item.id] || { count: 0, lastIndex: 999 };
        const domainStat = domainStats[item.domain] || { count: 0, lastIndex: 999 };
        const latestSession = itemStat.latestSession || null;
        let score = 0;
        score += Math.min(itemStat.lastIndex, 30) * 3;
        score += Math.min(domainStat.lastIndex, 30) * 2;
        score -= itemStat.count * 5;
        score -= domainStat.count * 2;
        score += position;
        score += consolidationBoost(item, latestSession);
        score += trendBoostForItem(item, trendContext);
        if (itemStat.lastIndex <= 2) score -= 80;
        if (domainStat.lastIndex <= 1) score -= 25;
        return score;
    }

    function pickBestForDomain(domain, selectedIds, itemStats, domainStats, position, trendContext) {
        return CANDIDATES
            .filter((item) => item.domain === domain && !selectedIds.has(item.id))
            .map((item) => ({
                item,
                score: scoreCandidate(item, itemStats, domainStats, position, trendContext)
            }))
            .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, "zh-CN"))[0]?.item || null;
    }

    function createDefaultPlan() {
        return DEFAULT_PLAN_IDS.map((id) => CANDIDATES.find((item) => item.id === id)).filter(Boolean);
    }

    function createAdaptivePlan(sessions, trendContext) {
        if (sessions.length === 0) {
            return createDefaultPlan();
        }

        const itemStats = buildStats(sessions);
        const domainStats = buildDomainStats(sessions);
        const selected = [];
        const selectedIds = new Set();
        const targetSize = getPlanSize(sessions);

        rotateDomains(new Date()).some((domain, index) => {
            const item = pickBestForDomain(domain, selectedIds, itemStats, domainStats, index, trendContext);
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

    function latestSessionHint(item, latestSession) {
        if (!latestSession) {
            return `最近训练：暂无该模块记录，先按默认参数完成一轮。`;
        }

        const dateText = latestSession.finishedAt ? toDateKey(new Date(latestSession.finishedAt)) : "最近";
        const fields = [];
        const pushField = (label, keys) => {
            const value = readSessionValue(latestSession, keys);
            const text = formatHintValue(keys[0], value);
            if (text) {
                fields.push(`${label}${text}`);
            }
        };

        if (item.id === "nback") {
            pushField("建议N ", ["nextRecommendedN"]);
            pushField("速度 ", ["nextRecommendedSpeedMs"]);
            pushField("轮次 ", ["nextRecommendedRounds"]);
            pushField("稳定性 ", ["adaptiveStabilityLabel", "staircaseQuality"]);
        } else if (item.id === "corsi" || item.id === "digit-span") {
            pushField("起始跨度 ", ["nextStartSpan", "startSpan"]);
            pushField("模式 ", ["nextMode", "mode", "sequenceMode"]);
            pushField("方块/轮次 ", ["nextBlockCount", "nextRecommendedRounds"]);
            pushField("稳定性 ", ["adaptiveStabilityLabel", "spanStability", "staircaseQuality"]);
            pushField("切换准备 ", ["modeTransitionReadiness"]);
        } else if (item.id === "stop-signal") {
            pushField("速度 ", ["nextRecommendedSpeedMs"]);
            pushField("轮次 ", ["nextRecommendedRounds"]);
            pushField("稳定性 ", ["staircaseQuality", "adaptiveStabilityLabel"]);
            pushField("切换准备 ", ["modeTransitionReadiness"]);
        } else {
            pushField("处方 ", ["nextPracticeRecommendation", "nextPrescriptionReason", "recommendation"]);
        }

        const practiceRecommendation = readSessionValue(latestSession, [
            "nextPracticeRecommendation",
            "nextPrescriptionReason",
            "recommendation"
        ]);
        const practiceText = formatHintValue("recommendation", practiceRecommendation);
        if (practiceText && fields.length < 2) {
            fields.push(practiceText);
        }

        const summaryText = fields.length > 0
            ? fields.join("；")
            : "最近一轮已完成，按现有参数继续即可。";
        return `最近训练（${dateText}）：${summaryText}`;
    }

    function appendTrendAdvice(details, item, trendContext) {
        const trendAdvice = trendAdviceForItem(item, trendContext);
        if (!trendAdvice) {
            return details;
        }
        return {
            params: `${details.params}；${trendAdvice.params}`,
            reason: `${details.reason}；跨次趋势：${trendAdvice.reason}`,
            hint: details.hint
        };
    }

    function buildPlanDetails(item, latestSession, trendContext) {
        if (!latestSession) {
            return appendTrendAdvice({
                params: item.params,
                reason: item.reason,
                hint: latestSessionHint(item, null)
            }, item, trendContext);
        }

        const prescriptionFields = [];
        const pushPrescription = (label, keys) => {
            const value = readSessionValue(latestSession, keys);
            const text = formatHintValue(keys[0], value);
            if (text) {
                prescriptionFields.push(`${label}${text}`);
            }
        };

        if (item.id === "nback") {
            pushPrescription("建议N ", ["nextRecommendedN"]);
            pushPrescription("速度 ", ["nextRecommendedSpeedMs"]);
            pushPrescription("轮次 ", ["nextRecommendedRounds"]);
        } else if (item.id === "corsi" || item.id === "digit-span") {
            pushPrescription("起始跨度 ", ["nextStartSpan", "startSpan"]);
            pushPrescription("模式 ", ["nextMode", "mode", "sequenceMode"]);
            pushPrescription("方块/轮次 ", ["nextBlockCount", "nextRecommendedRounds"]);
        } else if (item.id === "stop-signal") {
            pushPrescription("速度 ", ["nextRecommendedSpeedMs"]);
            pushPrescription("轮次 ", ["nextRecommendedRounds"]);
        }

        const practiceRecommendation = readSessionValue(latestSession, [
            "nextPracticeRecommendation",
            "nextPrescriptionReason",
            "recommendation"
        ]);
        const stabilityLabel = readSessionValue(latestSession, [
            "adaptiveStabilityLabel",
            "staircaseQuality",
            "modeTransitionReadiness",
            "spanStability"
        ]);
        const practiceText = formatHintValue("recommendation", practiceRecommendation);
        const stabilityText = formatHintValue("stability", stabilityLabel);

        const dynamicParams = prescriptionFields.length > 0 ? prescriptionFields.join("；") : item.params;
        const dynamicReasonParts = [item.reason];
        if (practiceText) {
            dynamicReasonParts.push(`最近提示：${practiceText}`);
        }
        if (stabilityText) {
            dynamicReasonParts.push(`状态：${stabilityText}`);
        }

        return appendTrendAdvice({
            params: dynamicParams,
            reason: dynamicReasonParts.join("；"),
            hint: latestSessionHint(item, latestSession)
        }, item, trendContext);
    }

    function renderPlan(plan, sessions, trendContext) {
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

        const itemStats = buildStats(sessions);
        const fragment = document.createDocumentFragment();
        plan.forEach((item, index) => {
            const link = withSeed(item, index);
            const latestSession = itemStats[item.id] ? itemStats[item.id].latestSession : null;
            const dynamicDetails = buildPlanDetails(item, latestSession, trendContext);
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
            params.textContent = `建议参数：${dynamicDetails.params}`;

            const reason = document.createElement("p");
            reason.className = "plan-reason";
            reason.textContent = `推荐理由：${dynamicDetails.reason}`;

            const hint = document.createElement("p");
            hint.className = "plan-detail";
            hint.textContent = dynamicDetails.hint;

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

            article.append(head, goal, params, reason, hint, actions);
            fragment.appendChild(article);
        });

        planList.innerHTML = "";
        planList.appendChild(fragment);
    }

    function waitForTrainingTrends() {
        if (getTrainingTrendsApi()) {
            return Promise.resolve(true);
        }
        const ready = global.trainingTrendsReady;
        if (!ready || typeof ready.then !== "function") {
            return Promise.resolve(false);
        }
        const timeout = new Promise((resolve) => {
            global.setTimeout(() => resolve(false), TREND_HELPER_WAIT_MS);
        });
        return Promise.race([
            ready.catch(() => false),
            timeout
        ]);
    }

    function init() {
        waitForTrainingTrends().then(() => {
            const sessions = getSessions();
            const trendContext = buildTrendContext(sessions);
            const plan = createAdaptivePlan(sessions, trendContext);
            renderPlan(plan, sessions, trendContext);
        });
    }

    global.addEventListener("DOMContentLoaded", init);
})(window);
