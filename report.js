function formatDuration(ms) {
    const value = Number(ms);
    const seconds = Number.isFinite(value) ? Math.max(0, Math.round(value / 1000)) : 0;
    const minutes = Math.floor(seconds / 60);
    const remain = seconds % 60;
    if (minutes === 0) {
        return `${remain}s`;
    }
    return `${minutes}m ${remain}s`;
}

function todayDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function toLocaleTime(isoString) {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
        return "--";
    }

    return date.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

const SUMMARY_PRIORITY_KEYS = ["totalTrials", "correctCount", "accuracy", "meanRtMs"];
const DEFAULT_SUMMARY_ENTRY_LIMIT = 5;
const MODULE_SUMMARY_ENTRY_LIMIT = 8;
const MODULE_METRIC_KEY_GROUPS = {
    "stop-signal": [
        ["stopSuccessRate", "stopSuccessRateValue"],
        ["ssrtEstimateMs", "ssrtEstimate"],
        ["stopFailureRate", "pRespondOnStop"],
        ["meanSsdMs", "meanSSD"],
        ["finalSsdMs", "finalSSD"]
    ],
    "go-no-go": [
        ["hitRate"],
        ["commissionErrorRate"],
        ["omissionRate"],
        ["finalNoGoRatio"],
        ["finalStimulusDuration"],
        ["finalIsiRange"],
        ["adaptationEvents"],
        ["dPrime"],
        ["criterion"]
    ],
    schulte: [
        ["scanStability"],
        ["errorRate"],
        ["gridSize"],
        ["rtVariabilityMs", "rtVariability"],
        ["wrongClickCount", "wrongClicks"],
        ["nextGridSize"],
        ["recommendedPaceMs"]
    ],
    "balloon-risk": [
        ["totalBank"],
        ["adjustedAvgPumps"],
        ["burstRate"],
        ["cashoutRate"],
        ["riskTrend"],
        ["avgPumps"],
        ["totalBalloons"]
    ],
    nback: [
        ["nLevel"],
        ["finalNLevel"],
        ["startingNLevel"],
        ["dPrime"],
        ["criterion"],
        ["nextRecommendedN"],
        ["nextRecommendedSpeedMs"],
        ["nextRecommendedRounds"],
        ["hitRate"],
        ["falseAlarmRate"],
        ["missRate"],
        ["correctRejectionRate"]
    ],
    corsi: [
        ["maxSpan"],
        ["finalSpan"],
        ["startingSpan", "startSpan"],
        ["minSpan", "minObservedSpan"],
        ["sessionType"],
        ["adaptationEventCount", "adaptationEvents"],
        ["nextStartSpan"],
        ["nextMode"],
        ["nextBlockCount"],
        ["longestCorrectSequence"],
        ["sequenceMode"],
        ["orderErrorCount"]
    ],
    stroop: [
        ["stroopEffectMs", "stroopEffect"],
        ["congruentMeanRtMs", "congruentMeanRT"],
        ["incongruentMeanRtMs", "incongruentMeanRT"],
        ["incongruentAccuracy"],
        ["congruentAccuracy"],
        ["errorCount"],
        ["inputMode"]
    ],
    flanker: [
        ["flankerEffectMs", "flankerEffect"],
        ["incongruentAccuracy"],
        ["congruentAccuracy"],
        ["flankerCaptureErrorCount"],
        ["timeoutCount"],
        ["directionErrorCount"],
        ["errorCount", "errors"]
    ],
    cpt: [
        ["hitRate"],
        ["falseAlarmRate"],
        ["missRate"],
        ["rtStdDevMs", "rtStdDev"],
        ["missCount", "misses"],
        ["falseAlarmCount", "falseAlarms"],
        ["correctRejectionRate"]
    ],
    "task-switching": [
        ["switchCostMs", "switchCost"],
        ["startingSwitchProbability"],
        ["finalSwitchProbability"],
        ["startingCueDelayMs"],
        ["finalCueDelayMs"],
        ["adaptationEvents"],
        ["switchRT", "switchRtMs"],
        ["repeatRT", "repeatRtMs"],
        ["switchAccuracy"],
        ["repeatAccuracy"],
        ["switchErrorCost", "errorSwitchCost"],
        ["tooFastCount"]
    ],
    "digit-span": [
        ["maxSpan"],
        ["finalSpan"],
        ["startingSpan", "startSpan"],
        ["maxAttemptedSpan"],
        ["exactAccuracy"],
        ["sequenceMode"],
        ["adaptationEvents"],
        ["positionAccuracy"],
        ["nextStartSpan"],
        ["nextMode"]
    ],
    "mental-rotation": [
        ["angleSlopeMsPerDegree", "angleSlope"],
        ["finalMirrorRatio"],
        ["adaptationEvents"],
        ["angleSetProgression"],
        ["mirrorRatioProgression"],
        ["mirrorAccuracy"],
        ["nonMirrorAccuracy"],
        ["meanRtMs"],
        ["accuracyByAngle"],
        ["meanRtByAngle"],
        ["seed"]
    ],
    raven: [
        ["generatedTemplateCount"],
        ["validationIssueCount"],
        ["accuracyByTemplate"],
        ["ruleBreakdown", "accuracyByRule"],
        ["totalTrials"],
        ["correctCount"],
        ["accuracy"],
        ["contentVersion"]
    ],
    "wisconsin-card": [
        ["categoriesCompleted"],
        ["perseverativeErrors"],
        ["perseverativeResponses"],
        ["perseverativeErrorRate"],
        ["setLosses"],
        ["trialsCompleted"],
        ["errorCount"]
    ],
    "reversal-learning": [
        ["totalReward"],
        ["preReversalAccuracy"],
        ["postReversalAccuracy"],
        ["adaptationTrials"],
        ["winStayRate"],
        ["loseShiftRate"],
        ["perseverationRate"]
    ],
    "base-rate": [
        ["neglectRate", "baseRateNeglectRate", "neglectRatio", "baseRateNeglectRatio", "neglectPct", "baseRateNeglectPct"],
        ["neglectCount", "baseRateNeglectCount", "ignoredBaseRateCount", "baseRateIgnoredCount"]
    ],
    "bayes-update": [
        ["meanAbsErrorPct", "meanAbsoluteErrorPct", "meanAbsError", "maePct", "mae"],
        ["approxAccuracy", "approximateAccuracy", "approxAccuracyRate", "approxCorrectRate"],
        ["approxCorrectCount", "approximateCorrectCount", "approxCorrect", "approxCorrectTrials"]
    ]
};
const METRIC_LABELS = {
    totalTrials: "试次",
    correctCount: "正确",
    accuracy: "准确率",
    meanRtMs: "平均RT",
    medianRtMs: "中位RT",
    switchCostMs: "切换成本",
    goAccuracy: "Go准确率",
    goMeanRtMs: "Go平均RT",
    noGoAccuracy: "No-Go准确率",
    commissionErrors: "误按",
    commissionErrorRate: "误按率",
    omissionErrors: "漏按",
    omissionRate: "漏按率",
    perseverativeErrors: "持续错误",
    netScore: "净得分",
    score: "得分",
    hitRate: "命中率",
    missRate: "遗漏率",
    falseAlarmRate: "误报率",
    correctRejectionRate: "正确拒绝率",
    dPrime: "d'",
    criterion: "判别标准",
    stopSuccessRate: "停止成功率",
    stopFailureRate: "Stop响应率",
    ssrtEstimateMs: "SSRT",
    meanSsdMs: "平均SSD",
    finalSsdMs: "最终SSD",
    scanStability: "扫描稳定性",
    errorRate: "错误率",
    gridSize: "网格",
    rtVariabilityMs: "RT波动",
    wrongClickCount: "误点",
    nextGridSize: "建议网格",
    recommendedPaceMs: "建议节奏",
    totalBank: "总收益",
    adjustedAvgPumps: "调整后均充",
    burstRate: "爆炸率",
    cashoutRate: "兑现率",
    riskTrend: "风险趋势",
    avgPumps: "平均充气",
    totalBalloons: "气球数",
    nLevel: "N值",
    finalNLevel: "最终N",
    startingNLevel: "起始N",
    nextRecommendedN: "建议N",
    nextRecommendedSpeedMs: "建议速度",
    nextRecommendedRounds: "建议轮次",
    missCount: "遗漏",
    falseAlarmCount: "误报",
    maxSpan: "最大广度",
    finalSpan: "最终广度",
    startingSpan: "起始广度",
    minSpan: "最低广度",
    minObservedSpan: "最低观察",
    maxObservedSpan: "最高观察",
    nextStartSpan: "建议起始",
    nextMode: "建议模式",
    nextBlockCount: "建议方块",
    longestCorrectSequence: "最长正确序列",
    sequenceMode: "序列模式",
    orderErrorCount: "顺序错误",
    sessionType: "训练类型",
    isAdaptive: "自适应",
    adaptiveMode: "自适应",
    adaptationEventCount: "调整次数",
    adaptationEvents: "自适应调整",
    meanResponseDurationMs: "平均复现时长",
    maxAttemptedSpan: "最高尝试广度",
    stroopEffectMs: "Stroop效应",
    congruentMeanRtMs: "一致RT",
    incongruentMeanRtMs: "不一致RT",
    congruentAccuracy: "一致准确率",
    incongruentAccuracy: "不一致准确率",
    errorCount: "错误",
    inputMode: "输入模式",
    flankerEffectMs: "Flanker效应",
    flankerCaptureErrorCount: "干扰捕获",
    timeoutCount: "超时",
    directionErrorCount: "方向错误",
    rtStdDevMs: "RT标准差",
    neglectRate: "基率忽略率",
    neglectCount: "基率忽略数",
    approxAccuracy: "近似准确率",
    approxCorrectCount: "近似正确",
    meanAbsErrorPct: "平均绝对误差",
    repeatRT: "重复RT",
    switchRT: "切换RT",
    repeatAccuracy: "重复准确率",
    switchAccuracy: "切换准确率",
    switchErrorCost: "切换错误成本",
    errorSwitchCost: "切换错误成本",
    tooFastCount: "过快响应",
    finalSwitchProbability: "最终切换比例",
    startingSwitchProbability: "起始切换比例",
    finalCueDelayMs: "最终线索时长",
    startingCueDelayMs: "起始线索时长",
    switchProbability: "切换比例",
    cueDelayMs: "线索时长",
    exactAccuracy: "完全正确率",
    positionAccuracy: "位置正确率",
    angleSlopeMsPerDegree: "角度斜率",
    angleSlope: "角度斜率",
    mirrorAccuracy: "镜像准确率",
    nonMirrorAccuracy: "非镜像准确率",
    finalMirrorRatio: "最终镜像比例",
    finalDifficultyLevel: "最终难度",
    finalAngleSet: "最终角度组",
    angleSetProgression: "角度进程",
    mirrorRatioProgression: "镜像比例进程",
    accuracyByAngle: "角度准确率",
    meanRtByAngle: "角度RT",
    ruleBreakdown: "规则表现",
    accuracyByRule: "规则表现",
    templateBreakdown: "模板表现",
    accuracyByTemplate: "模板准确率",
    generatedTemplateCount: "生成题数",
    ruleTemplateId: "模板ID",
    validationIssueCount: "校验问题",
    finalNoGoRatio: "最终No-Go比例",
    finalStimulusDuration: "最终刺激时长",
    finalIsiRange: "最终ISI",
    ratioProgression: "比例进程",
    speedProgression: "速度进程",
    blockLevelSummary: "Block摘要",
    categoriesCompleted: "完成类别",
    perseverativeResponses: "持续反应",
    perseverativeErrorRate: "持续错误率",
    setLosses: "集合维持丢失",
    trialsCompleted: "完成试次",
    totalReward: "总奖励",
    preReversalAccuracy: "反转前准确率",
    postReversalAccuracy: "反转后准确率",
    adaptationTrials: "适应试次",
    winStayRate: "赢后保持",
    loseShiftRate: "输后转换",
    perseverationRate: "旧规则坚持",
    recommendation: "训练提示",
    nextPrescriptionReason: "调整原因",
    mode: "模式",
    blockCount: "方块数",
    startSpan: "起始广度",
    targetTrials: "目标试次",
    nonTargetTrials: "非目标试次"
};

const RECENT_ANALYSIS_LIMIT = 30;
const RECENT_BASELINE_LIMIT = 12;
const RECENT_HINT_LIMIT = 5;
const WEAKNESS_LIMIT = 3;
const NEXT_ROUND_LIMIT = 3;
const DEFAULT_DOMAIN = {
    id: "general",
    label: "综合练习"
};
const DOMAIN_RULES = [
    {
        id: "response-inhibition",
        label: "抑制控制",
        keywords: ["stop-signal", "go-no-go", "stroop", "response-inhibition", "impulse-control", "inhibition"]
    },
    {
        id: "working-memory",
        label: "工作记忆",
        keywords: ["nback", "n-back", "digit-span", "corsi", "memory", "span", "visuospatial-memory"]
    },
    {
        id: "flexibility",
        label: "认知灵活性",
        keywords: ["task-switching", "wisconsin", "wcst", "reversal-learning", "set-shifting", "cognitive-flexibility"]
    },
    {
        id: "attention",
        label: "注意与视觉搜索",
        keywords: ["attention", "schulte", "focus", "cpt", "flanker", "vigilance", "visual-search", "selective-attention", "sustained-attention"]
    },
    {
        id: "reasoning",
        label: "推理与概率更新",
        keywords: ["raven", "base-rate", "bayes-update", "gambler", "monty-hall", "probability", "bayesian", "reasoning"]
    },
    {
        id: "planning",
        label: "计划与问题解决",
        keywords: ["hanoi", "london-tower", "sliding-puzzle", "planning", "problem-solving"]
    },
    {
        id: "decision-risk",
        label: "风险/决策",
        keywords: ["balloon-risk", "iowa-gambling", "ultimatum-game", "trust-game", "prisoner-dilemma", "risk", "decision", "reward"]
    },
    {
        id: "social-cognition",
        label: "社会认知",
        keywords: ["sally-anne", "eyes-reading", "theory-of-mind", "social"]
    },
    {
        id: "creative-language",
        label: "创造/语义联想",
        keywords: ["alternative-uses", "remote-associates", "torrance", "creative", "creativity", "language", "semantic"]
    }
];
const SCORE_PERCENT_KEY_GROUPS = [
    ["accuracy", "exactAccuracy", "positionAccuracy"],
    ["hitRate"],
    ["correctRejectionRate"],
    ["goAccuracy"],
    ["noGoAccuracy"],
    ["congruentAccuracy"],
    ["incongruentAccuracy"],
    ["switchAccuracy"],
    ["repeatAccuracy"],
    ["mirrorAccuracy"],
    ["nonMirrorAccuracy"],
    ["preReversalAccuracy"],
    ["postReversalAccuracy"],
    ["approxAccuracy", "approximateAccuracy", "approxCorrectRate"],
    ["cashoutRate"],
    ["scanStability"]
];
const ERROR_PERCENT_KEY_GROUPS = [
    ["errorRate"],
    ["missRate"],
    ["falseAlarmRate"],
    ["commissionErrorRate"],
    ["omissionRate"],
    ["perseverativeErrorRate"],
    ["perseverationRate"],
    ["neglectRate", "baseRateNeglectRate", "neglectRatio", "baseRateNeglectRatio", "neglectPct", "baseRateNeglectPct"],
    ["meanAbsErrorPct", "meanAbsoluteErrorPct", "maePct"]
];
const NEXT_PARAMETER_KEY_GROUPS = [
    ["recommendation"],
    ["nextPrescriptionReason"],
    ["nextRecommendedN"],
    ["nextRecommendedSpeedMs"],
    ["nextRecommendedRounds"],
    ["nextStartSpan"],
    ["nextMode"],
    ["nextBlockCount"],
    ["nextGridSize"],
    ["recommendedPaceMs"],
    ["nLevel"],
    ["gridSize"],
    ["startSpan"],
    ["sequenceMode"],
    ["mode"],
    ["inputMode"]
];

function toPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {};
    }
    return value;
}

function shortText(value, maxLength) {
    const text = String(value).trim();
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength - 1)}…`;
}

function isPercentKey(key) {
    return /accuracy|rate|ratio|probability|率|pct|percent/i.test(key);
}

function isStoredAsRatioKey(key) {
    return /accuracy|rate|ratio|probability|率/i.test(key) && !/pct|percent/i.test(key);
}

function isMillisecondsKey(key) {
    return /rt(ms)?$|Ms$|milliseconds/i.test(key);
}

function formatNumber(value, fractionDigits) {
    const rounded = Number(value.toFixed(fractionDigits));
    return String(rounded);
}

function formatMetricValue(key, value) {
    if (value === null || value === undefined) {
        return "";
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            return "";
        }
        if (isPercentKey(key)) {
            const percentage = isStoredAsRatioKey(key) && value >= 0 && value <= 1 ? value * 100 : value;
            return `${formatNumber(percentage, 1)}%`;
        }
        if (isMillisecondsKey(key)) {
            return `${Math.round(value)}ms`;
        }
        return formatNumber(value, Number.isInteger(value) ? 0 : 2);
    }

    if (typeof value === "string") {
        return shortText(value, 32);
    }

    if (typeof value === "boolean") {
        return value ? "是" : "否";
    }

    if (Array.isArray(value)) {
        if (value.length === 0) {
            return "";
        }

        const primitiveItems = value.filter(item => (
            item !== null
            && item !== undefined
            && ["number", "string", "boolean"].includes(typeof item)
        ));
        if (primitiveItems.length === value.length) {
            const sample = primitiveItems.slice(0, 3)
                .map(item => formatMetricValue(key, item))
                .filter(Boolean)
                .join(", ");
            return value.length > 3 && sample ? `${sample}…` : sample;
        }

        const unit = /event|adaptation|adjust/i.test(key) ? "次" : "项";
        return `${value.length}${unit}`;
    }

    if (typeof value === "object") {
        const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined);
        if (entries.length === 0) {
            return "";
        }

        const primitiveEntries = entries.filter(([, item]) => ["number", "string", "boolean"].includes(typeof item));
        if (primitiveEntries.length === 0) {
            return `${entries.length}项`;
        }

        const sample = primitiveEntries.slice(0, 3)
            .map(([entryKey, item]) => {
                const formatted = formatMetricValue(key, item);
                return formatted ? `${shortText(entryKey, 12)} ${formatted}` : "";
            })
            .filter(Boolean)
            .join(", ");
        if (!sample) {
            return `${entries.length}项`;
        }
        return entries.length > 3 ? `${sample}…` : sample;
    }

    return "";
}

function metricLabel(key) {
    return METRIC_LABELS[key] || key;
}

function pushMetricEntry(entries, usedKeys, source, key, displayKey) {
    const labelKey = displayKey || key;
    if (usedKeys.has(key) || usedKeys.has(labelKey) || !Object.prototype.hasOwnProperty.call(source, key)) {
        return false;
    }

    const value = formatMetricValue(labelKey, source[key]);
    if (!value) {
        return false;
    }

    usedKeys.add(key);
    usedKeys.add(labelKey);
    entries.push(`${metricLabel(labelKey)}:${value}`);
    return true;
}

function pushMetricEntryFromSources(entries, usedKeys, sources, keys) {
    const displayKey = keys[0];
    if (usedKeys.has(displayKey)) {
        return;
    }

    for (const source of sources) {
        for (const key of keys) {
            if (pushMetricEntry(entries, usedKeys, source, key, displayKey)) {
                return;
            }
        }
    }
}

function appendMetricEntries(entries, usedKeys, source, keys, maxEntries) {
    keys.forEach((key) => {
        if (entries.length < maxEntries) {
            pushMetricEntry(entries, usedKeys, source, key);
        }
    });
}

function appendRemainingMetricEntries(entries, usedKeys, source, maxEntries) {
    Object.keys(source).forEach((key) => {
        if (entries.length < maxEntries) {
            pushMetricEntry(entries, usedKeys, source, key);
        }
    });
}

function metricEntries(source, priorityKeys, maxEntries) {
    const entries = [];
    const usedKeys = new Set();

    appendMetricEntries(entries, usedKeys, source, priorityKeys, maxEntries);
    appendRemainingMetricEntries(entries, usedKeys, source, maxEntries);

    return entries;
}

function moduleMetricGroups(session) {
    const moduleText = [
        session && session.moduleId,
        session && session.gameId,
        session && session.gameName
    ].filter(Boolean).join(" ").toLowerCase();

    if (/stop[-_ ]?signal|\bsst\b/.test(moduleText) || moduleText.includes("停止信号")) {
        return MODULE_METRIC_KEY_GROUPS["stop-signal"];
    }
    if (/go[-_ /]?no[-_ /]?go/.test(moduleText) || moduleText.includes("抑制控制")) {
        return MODULE_METRIC_KEY_GROUPS["go-no-go"];
    }
    if (/schulte/.test(moduleText) || moduleText.includes("舒尔特")) {
        return MODULE_METRIC_KEY_GROUPS.schulte;
    }
    if (/balloon[-_ ]?risk|bart/.test(moduleText) || moduleText.includes("气球")) {
        return MODULE_METRIC_KEY_GROUPS["balloon-risk"];
    }
    if (/n[-_ ]?back|nback/.test(moduleText)) {
        return MODULE_METRIC_KEY_GROUPS.nback;
    }
    if (/corsi/.test(moduleText) || moduleText.includes("科西")) {
        return MODULE_METRIC_KEY_GROUPS.corsi;
    }
    if (/stroop/.test(moduleText) || moduleText.includes("斯特鲁普")) {
        return MODULE_METRIC_KEY_GROUPS.stroop;
    }
    if (/flanker/.test(moduleText)) {
        return MODULE_METRIC_KEY_GROUPS.flanker;
    }
    if (/\bcpt\b/.test(moduleText) || moduleText.includes("持续表现") || moduleText.includes("持续注意")) {
        return MODULE_METRIC_KEY_GROUPS.cpt;
    }
    if (/task[-_ ]?switch/.test(moduleText) || moduleText.includes("任务切换")) {
        return MODULE_METRIC_KEY_GROUPS["task-switching"];
    }
    if (/digit[-_ ]?span/.test(moduleText) || moduleText.includes("数字广度")) {
        return MODULE_METRIC_KEY_GROUPS["digit-span"];
    }
    if (/mental[-_ ]?rotation/.test(moduleText) || moduleText.includes("心理旋转")) {
        return MODULE_METRIC_KEY_GROUPS["mental-rotation"];
    }
    if (/raven/.test(moduleText) || moduleText.includes("瑞文")) {
        return MODULE_METRIC_KEY_GROUPS.raven;
    }
    if (/wisconsin|wcst/.test(moduleText) || moduleText.includes("威斯康星")) {
        return MODULE_METRIC_KEY_GROUPS["wisconsin-card"];
    }
    if (/reversal[-_ ]?learning/.test(moduleText) || moduleText.includes("反转学习")) {
        return MODULE_METRIC_KEY_GROUPS["reversal-learning"];
    }
    if (/base[-_]?rate/.test(moduleText) || moduleText.includes("基率")) {
        return MODULE_METRIC_KEY_GROUPS["base-rate"];
    }
    if (/bayes[-_]?update|bayesian/.test(moduleText) || moduleText.includes("贝叶斯")) {
        return MODULE_METRIC_KEY_GROUPS["bayes-update"];
    }
    return [];
}

function summaryMetricEntries(session) {
    const summary = toPlainObject(session && session.summary);
    const metrics = toPlainObject(session && session.metrics);
    const moduleGroups = moduleMetricGroups(session);
    const maxEntries = moduleGroups.length > 0 ? MODULE_SUMMARY_ENTRY_LIMIT : DEFAULT_SUMMARY_ENTRY_LIMIT;
    const entries = [];
    const usedKeys = new Set();

    appendMetricEntries(entries, usedKeys, summary, SUMMARY_PRIORITY_KEYS, maxEntries);
    moduleGroups.forEach((keys) => {
        if (entries.length < maxEntries) {
            pushMetricEntryFromSources(entries, usedKeys, [summary, metrics], keys);
        }
    });
    appendRemainingMetricEntries(entries, usedKeys, summary, maxEntries);

    return entries;
}

function metricsText(session) {
    const summaryEntries = summaryMetricEntries(session);
    if (summaryEntries.length > 0) {
        return summaryEntries.join(" | ");
    }

    const metrics = toPlainObject(session && session.metrics);
    const fallbackEntries = metricEntries(metrics, [], 3);
    return fallbackEntries.length > 0 ? fallbackEntries.join(" | ") : "--";
}

function compactSchemaVersion(value) {
    const text = value ? String(value) : "legacy";
    if (text === "training-result-v1") {
        return "v1";
    }
    return shortText(text, 18);
}

function sessionModuleId(session) {
    const value = session && (session.moduleId || session.gameId);
    return value ? shortText(value, 28) : "unknown";
}

function sessionGameName(session) {
    if (session && session.gameName) {
        return String(session.gameName);
    }
    return sessionModuleId(session);
}

function getTrainingResults() {
    return window.TrainingResults || null;
}

function emptyOverview(dateKey) {
    return {
        dateKey,
        totalSessions: 0,
        uniqueGames: 0,
        totalDurationMs: 0,
        averageDurationMs: 0
    };
}

function safeDailyOverview(dateKey) {
    const api = getTrainingResults();
    if (!api || typeof api.getDailyOverview !== "function") {
        return emptyOverview(dateKey);
    }

    try {
        const overview = api.getDailyOverview(dateKey);
        return overview && typeof overview === "object" ? overview : emptyOverview(dateKey);
    } catch (error) {
        console.warn("Failed to render daily overview:", error);
        return emptyOverview(dateKey);
    }
}

function safeSessionsByDate(dateKey) {
    const api = getTrainingResults();
    if (!api || typeof api.getSessionsByDate !== "function") {
        return { sessions: [], error: true };
    }

    try {
        const sessions = api.getSessionsByDate(dateKey);
        return { sessions: Array.isArray(sessions) ? sessions : [], error: false };
    } catch (error) {
        console.warn("Failed to read training sessions:", error);
        return { sessions: [], error: true };
    }
}

function dateKeyFromIso(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function sessionFinishedTime(session) {
    const value = session && (session.finishedAt || session.startedAt);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortSessionsDesc(sessions) {
    return sessions
        .map(toPlainObject)
        .filter((session) => Object.keys(session).length > 0)
        .sort((a, b) => sessionFinishedTime(b) - sessionFinishedTime(a));
}

function safeAllSessions(dateKey) {
    const api = getTrainingResults();
    if (!api) {
        return { sessions: [], error: true };
    }

    try {
        let sessions = [];
        if (typeof api.getSessions === "function") {
            sessions = api.getSessions();
        } else if (typeof api.getAllSessions === "function") {
            sessions = api.getAllSessions();
        } else if (typeof api.getSessionsByDate === "function") {
            sessions = api.getSessionsByDate(dateKey);
        }
        return { sessions: Array.isArray(sessions) ? sortSessionsDesc(sessions) : [], error: false };
    } catch (error) {
        console.warn("Failed to read recent training sessions:", error);
        return { sessions: [], error: true };
    }
}

function parseMetricNumber(key, value) {
    if (value === null || value === undefined) {
        return null;
    }

    let parsed = null;
    let rawText = "";
    if (typeof value === "number") {
        parsed = value;
    } else if (typeof value === "string") {
        rawText = value;
        const match = value.replace(/[,，]/g, "").match(/-?\d+(?:\.\d+)?/);
        if (match) {
            parsed = Number(match[0]);
        }
    }

    if (!Number.isFinite(parsed)) {
        return null;
    }

    if (isPercentKey(key) && parsed >= 0 && parsed <= 1 && !rawText.includes("%")) {
        return parsed * 100;
    }

    return parsed;
}

function metricNumberFromSources(session, keys) {
    const summary = toPlainObject(session && session.summary);
    const metrics = toPlainObject(session && session.metrics);
    const sessionData = toPlainObject(session);
    const sources = [summary, metrics, sessionData];

    for (const source of sources) {
        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const value = parseMetricNumber(key, source[key]);
                if (value !== null) {
                    return value;
                }
            }
        }
    }

    return null;
}

function clampScore(value) {
    if (!Number.isFinite(value)) {
        return null;
    }
    return Math.max(0, Math.min(100, value));
}

function averageNumber(values) {
    const finiteValues = values.filter((value) => Number.isFinite(value));
    if (finiteValues.length === 0) {
        return null;
    }
    return finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length;
}

function performanceScore(session) {
    const scores = [];
    const explicitScore = metricNumberFromSources(session, ["score"]);
    if (explicitScore !== null) {
        scores.push(clampScore(explicitScore >= 0 && explicitScore <= 1 ? explicitScore * 100 : explicitScore));
    }

    SCORE_PERCENT_KEY_GROUPS.forEach((keys) => {
        const value = metricNumberFromSources(session, keys);
        if (value !== null) {
            scores.push(clampScore(value >= 0 && value <= 1 ? value * 100 : value));
        }
    });

    ERROR_PERCENT_KEY_GROUPS.forEach((keys) => {
        const value = metricNumberFromSources(session, keys);
        if (value !== null) {
            scores.push(clampScore(100 - value));
        }
    });

    const correctCount = metricNumberFromSources(session, ["correctCount"]);
    const totalTrials = metricNumberFromSources(session, ["totalTrials", "trialsCompleted"]);
    if (correctCount !== null && totalTrials > 0) {
        scores.push(clampScore((correctCount / totalTrials) * 100));
    }

    const categoriesCompleted = metricNumberFromSources(session, ["categoriesCompleted"]);
    if (categoriesCompleted !== null) {
        scores.push(clampScore((categoriesCompleted / 6) * 100));
    }

    return averageNumber(scores.filter((score) => score !== null));
}

function addUniqueIssue(issues, text) {
    if (!issues.includes(text)) {
        issues.push(text);
    }
}

function sessionIssueSignals(session) {
    const issues = [];
    const overallAccuracy = metricNumberFromSources(session, [
        "accuracy",
        "exactAccuracy",
        "positionAccuracy",
        "hitRate",
        "goAccuracy",
        "switchAccuracy",
        "repeatAccuracy",
        "postReversalAccuracy"
    ]);
    const missRate = metricNumberFromSources(session, ["missRate", "omissionRate"]);
    const falseAlarmRate = metricNumberFromSources(session, ["falseAlarmRate", "commissionErrorRate"]);
    const errorRate = metricNumberFromSources(session, ["errorRate", "perseverativeErrorRate", "perseverationRate"]);
    const neglectRate = metricNumberFromSources(session, ["neglectRate", "baseRateNeglectRate", "neglectRatio", "baseRateNeglectRatio"]);
    const meanAbsError = metricNumberFromSources(session, ["meanAbsErrorPct", "meanAbsoluteErrorPct", "maePct"]);
    const costMs = metricNumberFromSources(session, ["switchCostMs", "switchCost", "stroopEffectMs", "stroopEffect", "flankerEffectMs", "flankerEffect"]);
    const rtStdDev = metricNumberFromSources(session, ["rtStdDevMs", "rtStdDev", "rtVariabilityMs", "rtVariability"]);
    const tooFastCount = metricNumberFromSources(session, ["tooFastCount"]);
    const validationIssueCount = metricNumberFromSources(session, ["validationIssueCount"]);
    const score = performanceScore(session);

    if (overallAccuracy !== null && overallAccuracy < 70) {
        addUniqueIssue(issues, "正确率偏低，下一轮先降一点速度或难度");
    }
    if (missRate !== null && missRate >= 20) {
        addUniqueIssue(issues, "遗漏偏多，下一轮缩短单轮时长并提高目标提示节奏");
    }
    if (falseAlarmRate !== null && falseAlarmRate >= 15) {
        addUniqueIssue(issues, "误报/误按偏多，下一轮放慢启动反应");
    }
    if (errorRate !== null && errorRate >= 20) {
        addUniqueIssue(issues, "错误率偏高，下一轮先稳定规则再加难度");
    }
    if (neglectRate !== null && neglectRate >= 25) {
        addUniqueIssue(issues, "基率信息使用不足，下一轮先写出先验再更新");
    }
    if (meanAbsError !== null && meanAbsError >= 20) {
        addUniqueIssue(issues, "概率估计误差偏大，下一轮放慢计算步骤");
    }
    if (costMs !== null && costMs >= 180) {
        addUniqueIssue(issues, "干扰/切换成本偏高，下一轮减少速度压力");
    }
    if (rtStdDev !== null && rtStdDev >= 350) {
        addUniqueIssue(issues, "反应波动较大，下一轮用更短回合保持节奏");
    }
    if (tooFastCount !== null && tooFastCount > 0) {
        addUniqueIssue(issues, "过快响应出现，下一轮先确认规则再按键");
    }
    if (validationIssueCount !== null && validationIssueCount > 0) {
        addUniqueIssue(issues, "题目校验问题较多，下一轮先复盘错题规则");
    }
    if (issues.length === 0 && score !== null && score < 65) {
        addUniqueIssue(issues, "综合表现低于近期目标，下一轮先做低负荷巩固");
    }

    return issues.slice(0, 3);
}

function sessionSearchText(session) {
    const tags = Array.isArray(session && session.tags) ? session.tags : [];
    return [
        session && session.moduleId,
        session && session.gameId,
        session && session.gameName,
        ...tags
    ].filter(Boolean).join(" ").toLowerCase();
}

function inferCapabilityDomain(session) {
    const text = sessionSearchText(session);
    const matched = DOMAIN_RULES.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
    return matched || DEFAULT_DOMAIN;
}

function summarizeSessionSet(sessions) {
    const scores = sessions.map(performanceScore).filter((score) => score !== null);
    const totalDurationMs = sessions.reduce((sum, session) => sum + (Number(session.durationMs) || 0), 0);
    const domainCount = new Set(sessions.map((session) => inferCapabilityDomain(session).id)).size;

    return {
        count: sessions.length,
        totalDurationMs,
        averageDurationMs: sessions.length > 0 ? Math.round(totalDurationMs / sessions.length) : 0,
        averageScore: averageNumber(scores),
        domainCount
    };
}

function scoreText(score) {
    return score === null ? "暂无可比指标" : `${formatNumber(score, 0)}分`;
}

function buildTrendText(dateKey, selectedSessions, baselineSessions) {
    const currentLabel = dateKey === todayDateKey() ? "今日" : "所选日期";
    const current = summarizeSessionSet(selectedSessions);
    const baseline = summarizeSessionSet(baselineSessions);

    if (current.count === 0 && baseline.count === 0) {
        return "暂无训练记录。先完成一轮训练后，这里会给出趋势、弱项和下一轮项目建议。";
    }
    if (current.count === 0) {
        return `${currentLabel}暂无记录；最近 ${baseline.count} 场平均表现为 ${scoreText(baseline.averageScore)}，平均单场 ${formatDuration(baseline.averageDurationMs)}。下一轮先补 1 个短回合，再观察是否回到近期节奏。`;
    }
    if (baseline.count === 0) {
        return `${currentLabel}完成 ${current.count} 场，覆盖 ${current.domainCount} 个能力域，总时长 ${formatDuration(current.totalDurationMs)}，平均表现 ${scoreText(current.averageScore)}。继续积累几场后再判断趋势。`;
    }

    let trendSentence = "表现接近最近基线，下一轮维持当前负荷并补一个短项。";
    if (current.averageScore !== null && baseline.averageScore !== null) {
        const delta = current.averageScore - baseline.averageScore;
        if (delta >= 5) {
            trendSentence = "表现高于最近基线，下一轮可维持主项并小幅增加难度。";
        } else if (delta <= -5) {
            trendSentence = "表现低于最近基线，下一轮先降低速度、跨度或干扰强度。";
        }
    } else if (current.averageDurationMs < baseline.averageDurationMs * 0.7) {
        trendSentence = "单场时长明显短于最近基线，下一轮先补足一个完整回合。";
    }

    return `${currentLabel} ${current.count} 场，覆盖 ${current.domainCount} 个能力域，平均表现 ${scoreText(current.averageScore)}，总时长 ${formatDuration(current.totalDurationMs)}；最近 ${baseline.count} 场基线平均表现 ${scoreText(baseline.averageScore)}、平均单场 ${formatDuration(baseline.averageDurationMs)}。${trendSentence}`;
}

function aggregateDomains(sessions) {
    const groups = new Map();
    sessions.forEach((session) => {
        const domain = inferCapabilityDomain(session);
        if (!groups.has(domain.id)) {
            groups.set(domain.id, {
                id: domain.id,
                label: domain.label,
                count: 0,
                scores: [],
                modules: new Set()
            });
        }

        const group = groups.get(domain.id);
        const score = performanceScore(session);
        group.count += 1;
        group.modules.add(sessionGameName(session));
        if (score !== null) {
            group.scores.push(score);
        }
    });

    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            averageScore: averageNumber(group.scores),
            moduleNames: Array.from(group.modules).slice(0, 3)
        }))
        .sort((a, b) => b.count - a.count || (b.averageScore || 0) - (a.averageScore || 0));
}

function aggregateModules(sessions) {
    const groups = new Map();
    sessions.forEach((session) => {
        const moduleId = sessionModuleId(session);
        const domain = inferCapabilityDomain(session);
        if (!groups.has(moduleId)) {
            groups.set(moduleId, {
                id: moduleId,
                label: sessionGameName(session),
                domain,
                sessions: [],
                scores: [],
                issueCount: 0
            });
        }

        const group = groups.get(moduleId);
        const score = performanceScore(session);
        group.sessions.push(session);
        if (score !== null) {
            group.scores.push(score);
        }
        group.issueCount += sessionIssueSignals(session).length;
    });

    return Array.from(groups.values()).map((group) => {
        group.sessions.sort((a, b) => sessionFinishedTime(b) - sessionFinishedTime(a));
        group.latest = group.sessions[0];
        group.count = group.sessions.length;
        group.averageScore = averageNumber(group.scores);
        group.issueRate = group.count > 0 ? group.issueCount / group.count : 0;
        return group;
    });
}

function weakModuleGroups(sessions) {
    return aggregateModules(sessions)
        .filter((group) => group.issueCount > 0 || (group.averageScore !== null && group.averageScore < 75))
        .sort((a, b) => {
            if (b.issueRate !== a.issueRate) {
                return b.issueRate - a.issueRate;
            }
            if (a.averageScore !== b.averageScore) {
                return (a.averageScore ?? 101) - (b.averageScore ?? 101);
            }
            return sessionFinishedTime(b.latest) - sessionFinishedTime(a.latest);
        })
        .slice(0, WEAKNESS_LIMIT);
}

function moduleWeakReason(group) {
    const latestIssues = sessionIssueSignals(group.latest);
    if (latestIssues.length > 0) {
        return latestIssues.join("；");
    }
    if (group.averageScore !== null && group.averageScore < 75) {
        return `最近平均表现 ${scoreText(group.averageScore)}，低于当前巩固目标`;
    }
    return "最近数据样本较少，先用短回合复核稳定性";
}

function nextParameterEntries(session, maxEntries) {
    const entries = [];
    const usedKeys = new Set();
    const summary = toPlainObject(session && session.summary);
    const metrics = toPlainObject(session && session.metrics);
    const sessionData = toPlainObject(session);
    NEXT_PARAMETER_KEY_GROUPS.forEach((keys) => {
        if (entries.length < maxEntries) {
            pushMetricEntryFromSources(entries, usedKeys, [summary, metrics, sessionData], keys);
        }
    });
    return entries;
}

function fallbackDomainAdvice(domainId) {
    const advice = {
        "response-inhibition": "保持上次规则，先把正确率稳定后再提速",
        "working-memory": "跨度或 N 值先沿用上次，连续稳定后再上调一级",
        flexibility: "先减少切换速度压力，确认规则后再追求反应速度",
        attention: "用较短回合维持节奏，错误下降后再扩大搜索量",
        reasoning: "先写出关键条件和基率，再提交概率判断",
        planning: "先用较低步数或层级复盘路径，再增加难度",
        "decision-risk": "先固定一套兑现/选择规则，再观察收益波动",
        "social-cognition": "先复盘题干线索，再增加题量",
        "creative-language": "先保留流畅输出，再增加独特性要求"
    };
    return advice[domainId] || "沿用上次参数完成一个短回合，再根据错误类型调整";
}

function buildNextRoundSuggestions(weakGroups, domainGroups, recentSessions) {
    if (recentSessions.length === 0) {
        return ["先选择一个 5-8 分钟的基础项目，完成后再根据正确率、错误率和反应稳定性调整下一轮。"];
    }

    const moduleGroups = aggregateModules(recentSessions).sort((a, b) => sessionFinishedTime(b.latest) - sessionFinishedTime(a.latest));
    const targetGroups = weakGroups.length > 0 ? weakGroups : moduleGroups.slice(0, NEXT_ROUND_LIMIT);

    if (weakGroups.length === 0 && domainGroups.length > 0) {
        const primaryDomain = domainGroups[0];
        const latest = moduleGroups[0];
        return [
            `维持 ${primaryDomain.label} 主项，优先选择 ${latest.label}：参数沿用上次设置，目标是稳定完成一轮后再小幅加难度。`,
            `补一个覆盖较少的能力域；如果时间不足，做 1 个短回合即可，重点记录错误类型而不是追求高分。`
        ];
    }

    return targetGroups.slice(0, NEXT_ROUND_LIMIT).map((group) => {
        const params = nextParameterEntries(group.latest, 4);
        const parameterText = params.length > 0 ? params.join("；") : fallbackDomainAdvice(group.domain.id);
        return `优先 ${group.label}（${group.domain.label}）：${moduleWeakReason(group)}。下一轮：${parameterText}。`;
    });
}

function recentHintText(session) {
    const dateKey = dateKeyFromIso(session.finishedAt || session.startedAt);
    const timeText = toLocaleTime(session.finishedAt || session.startedAt);
    const metrics = summaryMetricEntries(session).slice(0, 3);
    const metricText = metrics.length > 0 ? metrics.join(" | ") : metricsText(session);
    const issues = sessionIssueSignals(session);
    const nextParams = nextParameterEntries(session, 2);
    const nextText = nextParams.length > 0 ? `下一轮参考 ${nextParams.join("；")}` : fallbackDomainAdvice(inferCapabilityDomain(session).id);
    const cue = issues.length > 0 ? `${issues[0]}；${nextText}` : `表现相对稳定；${nextText}`;

    return `${dateKey} ${timeText} ${sessionGameName(session)}：${metricText}。${cue}。`;
}

function setListItems(listId, items, emptyText) {
    const list = document.getElementById(listId);
    list.innerHTML = "";
    const displayItems = items.length > 0 ? items : [emptyText];
    displayItems.forEach((text, index) => {
        const item = document.createElement("li");
        item.textContent = text;
        if (items.length === 0 || index === 0 && text === emptyText) {
            item.className = "feedback-empty";
        }
        list.appendChild(item);
    });
}

function renderDomainSummary(domains) {
    const container = document.getElementById("domain-summary");
    container.innerHTML = "";
    if (domains.length === 0) {
        const empty = document.createElement("span");
        empty.className = "feedback-empty";
        empty.textContent = "暂无能力域记录。";
        container.appendChild(empty);
        return;
    }

    domains.slice(0, 6).forEach((domain) => {
        const chip = document.createElement("span");
        chip.className = "domain-chip";
        const scorePart = domain.averageScore === null ? "暂无评分" : `均值 ${scoreText(domain.averageScore)}`;
        chip.textContent = `${domain.label} · ${domain.count}次 · ${scorePart}`;
        chip.title = domain.moduleNames.join("、");
        container.appendChild(chip);
    });
}

function renderWeaknesses(weakGroups) {
    const items = weakGroups.map((group) => {
        const scorePart = group.averageScore === null ? "暂无可比评分" : `平均表现 ${scoreText(group.averageScore)}`;
        return `${group.label}｜${group.domain.label}｜最近 ${group.count} 次：${scorePart}；${moduleWeakReason(group)}。`;
    });
    setListItems("weakness-list", items, "最近记录没有明显弱项；下一轮可按当前节奏巩固，并继续观察错误类型。");
}

function renderTrainingFeedback(dateKey) {
    const result = safeAllSessions(dateKey);
    const allSessions = result.sessions;
    const recentSessions = allSessions.slice(0, RECENT_ANALYSIS_LIMIT);
    const selectedSessions = allSessions.filter((session) => dateKeyFromIso(session.finishedAt || session.startedAt) === dateKey);
    const baselineSessions = allSessions
        .filter((session) => dateKeyFromIso(session.finishedAt || session.startedAt) !== dateKey)
        .slice(0, RECENT_BASELINE_LIMIT);
    const domains = aggregateDomains(recentSessions);
    const weakGroups = weakModuleGroups(recentSessions);
    const windowText = allSessions.length > 0
        ? `基于最近 ${recentSessions.length} / ${allSessions.length} 场 · 当前日期 ${dateKey}`
        : `当前日期 ${dateKey}`;

    document.getElementById("feedback-window").textContent = windowText;
    if (result.error) {
        document.getElementById("feedback-trend").textContent = "训练记录读取失败，暂时无法生成趋势反馈。";
        renderDomainSummary([]);
        setListItems("weakness-list", [], "暂无可用记录。");
        setListItems("next-round-list", [], "记录恢复后再生成下一轮建议。");
        setListItems("recent-hints-list", [], "暂无可用记录。");
        return;
    }

    document.getElementById("feedback-trend").textContent = buildTrendText(dateKey, selectedSessions, baselineSessions);
    renderDomainSummary(domains);
    renderWeaknesses(weakGroups);
    setListItems("next-round-list", buildNextRoundSuggestions(weakGroups, domains, recentSessions), "暂无下一轮建议。");
    setListItems(
        "recent-hints-list",
        allSessions.slice(0, RECENT_HINT_LIMIT).map(recentHintText),
        "暂无最近表现提示。"
    );
}

function renderSummary(dateKey) {
    const overview = safeDailyOverview(dateKey);
    document.getElementById("selected-date-text").textContent = dateKey;
    document.getElementById("total-sessions").textContent = String(overview.totalSessions || 0);
    document.getElementById("unique-games").textContent = String(overview.uniqueGames || 0);
    document.getElementById("total-duration").textContent = formatDuration(overview.totalDurationMs);
    document.getElementById("avg-duration").textContent = formatDuration(overview.averageDurationMs);
}

function renderTable(dateKey) {
    const result = safeSessionsByDate(dateKey);
    const sessions = result.sessions;
    const body = document.getElementById("sessions-body");
    const emptyHint = document.getElementById("empty-hint");
    body.innerHTML = "";

    if (result.error) {
        emptyHint.textContent = "训练记录读取失败，已保留本地数据。";
        return;
    }

    if (sessions.length === 0) {
        emptyHint.textContent = "当天暂无训练记录。";
        return;
    }

    emptyHint.textContent = "";
    sessions.forEach((session) => {
        const sessionData = toPlainObject(session);
        const row = document.createElement("tr");
        const timeCell = document.createElement("td");
        const gameCell = document.createElement("td");
        const durationCell = document.createElement("td");
        const metricsCell = document.createElement("td");
        const gameName = document.createElement("div");
        const sessionMeta = document.createElement("div");
        const moduleId = sessionModuleId(sessionData);
        const schemaVersion = compactSchemaVersion(sessionData.schemaVersion);

        // Use textContent to avoid DOM injection from persisted values.
        timeCell.textContent = toLocaleTime(sessionData.finishedAt);
        gameName.className = "session-name";
        gameName.textContent = sessionGameName(sessionData);
        sessionMeta.className = "session-meta";
        sessionMeta.textContent = `${moduleId} · ${schemaVersion}`;
        sessionMeta.title = `moduleId: ${moduleId}; schemaVersion: ${sessionData.schemaVersion || "legacy"}`;
        gameCell.appendChild(gameName);
        gameCell.appendChild(sessionMeta);
        durationCell.textContent = formatDuration(sessionData.durationMs || 0);
        metricsCell.className = "metrics-cell";
        metricsCell.textContent = metricsText(sessionData);

        row.appendChild(timeCell);
        row.appendChild(gameCell);
        row.appendChild(durationCell);
        row.appendChild(metricsCell);
        body.appendChild(row);
    });
}

function render(dateKey) {
    renderSummary(dateKey);
    renderTrainingFeedback(dateKey);
    renderTable(dateKey);
}

function init() {
    const picker = document.getElementById("date-picker");
    const todayBtn = document.getElementById("today-btn");
    const clearBtn = document.getElementById("clear-btn");

    const initialDate = todayDateKey();
    picker.value = initialDate;
    render(initialDate);

    picker.addEventListener("change", () => {
        if (!picker.value) {
            return;
        }
        render(picker.value);
    });

    todayBtn.addEventListener("click", () => {
        const today = todayDateKey();
        picker.value = today;
        render(today);
    });

    clearBtn.addEventListener("click", () => {
        const confirmed = window.confirm("确定清空全部训练记录？此操作不可撤销。");
        if (!confirmed) {
            return;
        }
        window.TrainingResults.clearAllSessions();
        render(picker.value || todayDateKey());
    });
}

window.addEventListener("DOMContentLoaded", init);
