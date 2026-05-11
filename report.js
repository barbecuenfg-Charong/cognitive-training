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
const MODULE_SUMMARY_ENTRY_LIMIT = 6;
const MODULE_METRIC_KEY_GROUPS = {
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
    noGoAccuracy: "No-Go准确率",
    commissionErrors: "误按",
    omissionErrors: "漏按",
    perseverativeErrors: "持续错误",
    netScore: "净得分",
    score: "得分",
    neglectRate: "基率忽略率",
    neglectCount: "基率忽略数",
    approxAccuracy: "近似准确率",
    approxCorrectCount: "近似正确",
    meanAbsErrorPct: "平均绝对误差"
};

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
    return /accuracy|rate|率|pct|percent/i.test(key);
}

function isStoredAsRatioKey(key) {
    return /accuracy|rate|率/i.test(key) && !/pct|percent/i.test(key);
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
