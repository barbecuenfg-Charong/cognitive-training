(function initTrainingTrends(global) {
    const DEFAULT_WINDOWS = [7, 14, 30];
    const DEFAULT_MODULE_WINDOW_SIZE = 14;
    const SCORE_KEYS = [
        "score",
        "finalScore",
        "totalScore",
        "averageScore",
        "avgScore",
        "performanceScore",
        "sessionScore"
    ];
    const ACCURACY_KEYS = [
        "accuracy",
        "finalAccuracy",
        "correctRate",
        "successRate",
        "hitRate",
        "targetCompletionRate",
        "validatedOptimalRate",
        "optimalRate",
        "goAccuracy",
        "goResponseAccuracy",
        "stopSuccessRate",
        "switchAccuracy",
        "repeatAccuracy",
        "incongruentAccuracy",
        "positionAccuracy",
        "advantageousRate"
    ];
    const STABILITY_KEYS = [
        "stability",
        "spanStability",
        "scanStability",
        "loadStability",
        "adaptiveStability",
        "staircaseQuality",
        "ssdStaircaseQuality",
        "quality"
    ];
    const READINESS_KEYS = [
        "readiness",
        "modeTransitionReadiness",
        "nextLoadReadiness",
        "trainingReadiness",
        "loadReadiness"
    ];
    const VOLATILITY_KEYS = [
        "volatility",
        "adaptationVolatility",
        "scoreVolatility",
        "performanceVolatility"
    ];
    const RT_KEYS = [
        "meanRtMs",
        "avgRtMs",
        "averageRtMs",
        "medianRtMs",
        "rtMs",
        "meanResponseTimeMs",
        "meanResponseTime",
        "reactionTimeMs",
        "ssrtEstimateMs"
    ];
    const MODULE_ID_KEYS = ["moduleId", "gameId", "taskId", "trainingId", "module"];
    const MODULE_NAME_KEYS = ["moduleName", "gameName", "taskName", "title", "name"];
    const TIME_KEYS = ["finishedAt", "completedAt", "endedAt", "timestamp", "date", "startedAt"];

    function toPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        return value;
    }

    function toPositiveInteger(value, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number) || number <= 0) {
            return fallback;
        }
        return Math.floor(number);
    }

    function uniquePositiveWindows(value) {
        const source = Array.isArray(value) && value.length > 0 ? value : DEFAULT_WINDOWS;
        const seen = new Set();
        source.forEach((item) => {
            const number = toPositiveInteger(item, null);
            if (number !== null) {
                seen.add(number);
            }
        });
        return Array.from(seen).sort((a, b) => a - b);
    }

    function normalizeText(value) {
        if (value === null || typeof value === "undefined") {
            return "";
        }
        return String(value).trim();
    }

    function parseNumber(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return {
                value,
                hadPercentSign: false
            };
        }
        if (typeof value === "string") {
            const text = value.trim();
            if (!text) {
                return null;
            }
            const match = text.replace(/[,，]/g, "").match(/-?\d+(?:\.\d+)?/);
            if (!match) {
                return null;
            }
            return {
                value: Number(match[0]),
                hadPercentSign: text.includes("%")
            };
        }
        return null;
    }

    function roundOne(value) {
        if (!Number.isFinite(value)) {
            return null;
        }
        return Math.round(value * 10) / 10;
    }

    function average(values) {
        const finite = values.filter((value) => Number.isFinite(value));
        if (finite.length === 0) {
            return null;
        }
        return finite.reduce((sum, value) => sum + value, 0) / finite.length;
    }

    function standardDeviation(values) {
        const finite = values.filter((value) => Number.isFinite(value));
        if (finite.length < 2) {
            return null;
        }
        const mean = average(finite);
        const variance = average(finite.map((value) => (value - mean) ** 2));
        return Math.sqrt(variance);
    }

    function valueFromSources(sources, keys) {
        for (const source of sources) {
            for (const key of keys) {
                if (
                    Object.prototype.hasOwnProperty.call(source, key)
                    && source[key] !== null
                    && typeof source[key] !== "undefined"
                    && source[key] !== ""
                ) {
                    return {
                        key,
                        value: source[key]
                    };
                }
            }
        }
        return null;
    }

    function numberFromSources(sources, keys) {
        const entry = valueFromSources(sources, keys);
        if (!entry) {
            return null;
        }
        const parsed = parseNumber(entry.value);
        if (!parsed) {
            return null;
        }
        return {
            key: entry.key,
            value: parsed.value,
            hadPercentSign: parsed.hadPercentSign
        };
    }

    function percentLikeFromSources(sources, keys) {
        const parsed = numberFromSources(sources, keys);
        if (!parsed) {
            return null;
        }
        const value = parsed.hadPercentSign || (parsed.value >= 0 && parsed.value <= 1)
            ? parsed.value * (parsed.hadPercentSign ? 1 : 100)
            : parsed.value;
        return {
            key: parsed.key,
            value: roundOne(value)
        };
    }

    function scoreFromSources(sources) {
        const explicit = percentLikeFromSources(sources, SCORE_KEYS);
        if (explicit) {
            return {
                key: explicit.key,
                value: explicit.value,
                source: "score"
            };
        }

        const accuracy = percentLikeFromSources(sources, ACCURACY_KEYS);
        if (accuracy) {
            return {
                key: accuracy.key,
                value: accuracy.value,
                source: "accuracy"
            };
        }
        return null;
    }

    function firstTextFromSources(sources, keys) {
        const entry = valueFromSources(sources, keys);
        if (!entry) {
            return "";
        }
        return normalizeText(entry.value);
    }

    function sessionTimeFromSources(sources, fallbackIndex) {
        const entry = valueFromSources(sources, TIME_KEYS);
        if (!entry) {
            return -fallbackIndex;
        }

        if (typeof entry.value === "number" && Number.isFinite(entry.value)) {
            return entry.value;
        }

        const time = new Date(entry.value).getTime();
        return Number.isFinite(time) ? time : -fallbackIndex;
    }

    function canonicalizeSession(session, index) {
        const sourceSession = toPlainObject(session);
        const summary = toPlainObject(sourceSession.summary);
        const metrics = toPlainObject(sourceSession.metrics);
        const signalSources = [summary, metrics, sourceSession];
        const identitySources = [sourceSession, summary, metrics];
        const moduleId = firstTextFromSources(identitySources, MODULE_ID_KEYS) || "unknown";
        const moduleName = firstTextFromSources(identitySources, MODULE_NAME_KEYS) || moduleId;
        const score = scoreFromSources(signalSources);
        const stability = percentLikeFromSources(signalSources, STABILITY_KEYS);
        const readiness = percentLikeFromSources(signalSources, READINESS_KEYS);
        const volatility = percentLikeFromSources(signalSources, VOLATILITY_KEYS);
        const accuracy = percentLikeFromSources(signalSources, ACCURACY_KEYS);
        const rt = numberFromSources(signalSources, RT_KEYS);
        const time = sessionTimeFromSources(identitySources, index + 1);

        return {
            moduleId,
            moduleName,
            time,
            finishedAt: firstTextFromSources(identitySources, TIME_KEYS) || null,
            score: score ? score.value : null,
            scoreKey: score ? score.key : null,
            scoreSource: score ? score.source : null,
            accuracy: accuracy ? accuracy.value : null,
            accuracyKey: accuracy ? accuracy.key : null,
            stability: stability ? stability.value : null,
            stabilityKey: stability ? stability.key : null,
            readiness: readiness ? readiness.value : null,
            readinessKey: readiness ? readiness.key : null,
            volatility: volatility ? volatility.value : null,
            volatilityKey: volatility ? volatility.key : null,
            rtMs: rt ? roundOne(rt.value) : null,
            rtKey: rt ? rt.key : null,
            original: session || null
        };
    }

    function sortByTimeDesc(a, b) {
        return b.time - a.time;
    }

    function normalizeSessions(sessions) {
        return (Array.isArray(sessions) ? sessions : [])
            .map((session, index) => canonicalizeSession(session, index))
            .sort(sortByTimeDesc);
    }

    function groupByModule(canonicalSessions) {
        const groups = new Map();
        canonicalSessions.forEach((session) => {
            if (!groups.has(session.moduleId)) {
                groups.set(session.moduleId, []);
            }
            groups.get(session.moduleId).push(session);
        });
        return groups;
    }

    function trendLabel(delta, scoreCount) {
        if (scoreCount === 0) {
            return "无评分数据";
        }
        if (scoreCount < 2 || delta === null) {
            return "样本不足";
        }
        if (delta >= 5) {
            return "上升";
        }
        if (delta <= -5) {
            return "下降";
        }
        return "稳定";
    }

    function volatilityLabel(explicitVolatility, scoreVolatility, scoreCount) {
        const value = explicitVolatility !== null ? explicitVolatility : scoreVolatility;
        if (value === null || scoreCount < 2) {
            return "波动未知";
        }
        if (value >= 15) {
            return "波动偏高";
        }
        if (value >= 8) {
            return "波动中等";
        }
        return "波动可控";
    }

    function readinessLabel(summary) {
        if (summary.latest && summary.latest.readiness !== null) {
            if (summary.latest.readiness >= 80) {
                return "可进阶";
            }
            if (summary.latest.readiness >= 60) {
                return "维持巩固";
            }
            return "需降负荷";
        }

        if (summary.averageScore === null) {
            return summary.count >= 3 ? "观察中" : "样本不足";
        }
        if (summary.volatilityLabel === "波动偏高") {
            return "维持巩固";
        }
        if (summary.trendLabel === "下降" || summary.averageScore < 70) {
            return "需降负荷";
        }
        if (summary.averageScore >= 85 && summary.trendLabel !== "下降") {
            return "可进阶";
        }
        return "维持巩固";
    }

    function recommendedAction(summary) {
        if (summary.count === 0) {
            return "暂无训练记录，先完成一轮基线训练。";
        }
        if (summary.averageScore === null) {
            return "继续收集该模块的可评分 session，再做趋势判断。";
        }
        if (summary.volatilityLabel === "波动偏高") {
            return "先稳定训练节奏，降低频繁调参，下一轮以巩固为主。";
        }
        if (summary.trendLabel === "下降" || summary.readinessLabel === "需降负荷") {
            return "建议降负荷巩固，优先排查错误类型和疲劳影响。";
        }
        if (summary.readinessLabel === "可进阶" || summary.trendLabel === "上升") {
            return "可小幅进阶，保留回退条件并继续观察下一轮表现。";
        }
        return "维持当前负荷，连续观察最近几次 session 的稳定性。";
    }

    function summarizeModuleTrend(group, options) {
        const moduleWindowSize = toPositiveInteger(
            options && options.windowSize,
            DEFAULT_MODULE_WINDOW_SIZE
        );
        const sessions = normalizeSessions(group).slice(0, moduleWindowSize);
        const latest = sessions[0] || null;
        const previous = sessions[1] || null;
        const scores = sessions.map((session) => session.score).filter((score) => Number.isFinite(score));
        const recentScores = scores.slice(0, 3);
        const averageScore = roundOne(average(scores));
        const recentScore = roundOne(average(recentScores));
        const delta = latest && previous && Number.isFinite(latest.score) && Number.isFinite(previous.score)
            ? roundOne(latest.score - previous.score)
            : null;
        const explicitVolatility = latest && latest.volatility !== null ? latest.volatility : null;
        const scoreVolatility = roundOne(standardDeviation(scores));

        const summary = {
            moduleId: latest ? latest.moduleId : "unknown",
            moduleName: latest ? latest.moduleName : "unknown",
            count: sessions.length,
            latest,
            previous,
            averageScore,
            recentScore,
            delta,
            scoreCount: scores.length,
            scoreVolatility,
            explicitVolatility,
            trendLabel: trendLabel(delta, scores.length),
            volatilityLabel: volatilityLabel(explicitVolatility, scoreVolatility, scores.length),
            readinessLabel: null,
            recommendedAction: null,
            sessions
        };
        summary.readinessLabel = readinessLabel(summary);
        summary.recommendedAction = recommendedAction(summary);
        return summary;
    }

    function priorityScore(summary) {
        let score = 0;
        if (summary.volatilityLabel === "波动偏高") score += 50;
        if (summary.readinessLabel === "需降负荷") score += 40;
        if (summary.trendLabel === "下降") score += 30;
        if (summary.averageScore !== null && summary.averageScore < 70) score += 20;
        if (summary.averageScore === null) score += 5;
        if (summary.count < 2) score -= 5;
        return score;
    }

    function summarizeGlobal(canonicalSessions, moduleSummaries) {
        const scores = canonicalSessions
            .map((session) => session.score)
            .filter((score) => Number.isFinite(score));
        const latestScore = scores.length > 0 ? scores[0] : null;
        const previousScore = scores.length > 1 ? scores[1] : null;
        const delta = latestScore !== null && previousScore !== null ? roundOne(latestScore - previousScore) : null;
        const averageScore = roundOne(average(scores));
        const scoreVolatility = roundOne(standardDeviation(scores));
        const trend = trendLabel(delta, scores.length);
        const volatility = volatilityLabel(null, scoreVolatility, scores.length);
        const priorityModules = moduleSummaries
            .slice()
            .sort((a, b) => priorityScore(b) - priorityScore(a) || b.count - a.count)
            .slice(0, 3);
        const focus = priorityModules[0] || null;
        const globalSummary = {
            count: canonicalSessions.length,
            moduleCount: moduleSummaries.length,
            averageScore,
            recentScore: roundOne(average(scores.slice(0, 5))),
            delta,
            trendLabel: trend,
            volatilityLabel: volatility,
            readinessLabel: focus ? focus.readinessLabel : "样本不足",
            recommendedAction: focus ? focus.recommendedAction : "暂无训练记录，先完成一轮基线训练。",
            priorityModules
        };
        globalSummary.summaryText = focus
            ? `最近 ${canonicalSessions.length} 条训练记录，优先关注 ${focus.moduleId}：${focus.recommendedAction}`
            : "最近暂无可用训练记录。";
        return globalSummary;
    }

    function buildWindowSummaries(canonicalSessions, windows, options) {
        const result = {};
        windows.forEach((size) => {
            const windowSessions = canonicalSessions.slice(0, size);
            const groups = groupByModule(windowSessions);
            const moduleSummaries = Array.from(groups.values()).map((group) => summarizeModuleTrend(group, options));
            result[`last${size}`] = summarizeGlobal(windowSessions, moduleSummaries);
        });
        return result;
    }

    function analyzeTrainingTrends(sessions, options) {
        const settings = options || {};
        const canonicalSessions = normalizeSessions(sessions);
        const groups = groupByModule(canonicalSessions);
        const moduleSummaries = Array.from(groups.values())
            .map((group) => summarizeModuleTrend(group, settings))
            .sort((a, b) => priorityScore(b) - priorityScore(a) || b.count - a.count || a.moduleId.localeCompare(b.moduleId));
        const moduleMap = {};
        moduleSummaries.forEach((summary) => {
            moduleMap[summary.moduleId] = summary;
        });
        const windows = buildWindowSummaries(canonicalSessions, uniquePositiveWindows(settings.windows), settings);
        const globalSummary = summarizeGlobal(canonicalSessions, moduleSummaries);

        return {
            totalSessions: canonicalSessions.length,
            count: canonicalSessions.length,
            moduleCount: moduleSummaries.length,
            moduleSummaries,
            modules: moduleSummaries,
            moduleMap,
            globalSummary,
            global: globalSummary,
            windows,
            sessions: canonicalSessions
        };
    }

    function buildPlanSignals(sessions, options) {
        const analysis = analyzeTrainingTrends(sessions, options);
        const focusModule = analysis.globalSummary.priorityModules[0] || null;
        if (!focusModule) {
            return {
                hasSignals: false,
                analysis,
                focusModule: null,
                moduleSignals: [],
                recommendedAction: "暂无训练记录，先完成一轮基线训练。",
                summaryText: "最近暂无可用训练记录。"
            };
        }

        const moduleSignals = analysis.moduleSummaries.map((summary) => ({
            moduleId: summary.moduleId,
            moduleName: summary.moduleName,
            count: summary.count,
            trendLabel: summary.trendLabel,
            volatilityLabel: summary.volatilityLabel,
            readinessLabel: summary.readinessLabel,
            recommendedAction: summary.recommendedAction,
            averageScore: summary.averageScore,
            recentScore: summary.recentScore,
            delta: summary.delta
        }));

        return {
            hasSignals: true,
            analysis,
            focusModule,
            moduleSignals,
            recommendedAction: focusModule.recommendedAction,
            readinessLabel: focusModule.readinessLabel,
            trendLabel: focusModule.trendLabel,
            volatilityLabel: focusModule.volatilityLabel,
            summaryText: `最近 ${analysis.totalSessions} 条训练记录，优先关注 ${focusModule.moduleId}：${focusModule.recommendedAction}`
        };
    }

    global.TrainingTrends = {
        analyzeTrainingTrends,
        summarizeModuleTrend,
        buildPlanSignals
    };
})(typeof window !== "undefined" ? window : globalThis);
