(function initAttentionProfile(global) {
    const ATTENTION_MODULES = {
        schulte: {
            label: "舒尔特方格",
            domainId: "visual-search",
            domainLabel: "视觉搜索",
            scoreKeys: ["scanStability", "accuracy", "targetCompletionRate"],
            metricKeys: ["scanStability", "meanInterClickRtMs", "errorRate"],
            nextKeys: ["recommendation", "nextRecommendation", "adaptiveReasonCode"]
        },
        flanker: {
            label: "Flanker 专注",
            domainId: "selective-attention",
            domainLabel: "选择性注意",
            scoreKeys: ["accuracy", "incongruentAccuracy", "congruentAccuracy"],
            metricKeys: ["flankerEffectMs", "incongruentAccuracy", "timeoutCount"],
            nextKeys: ["recommendation", "nextRecommendation", "adaptiveReason"]
        },
        stroop: {
            label: "斯特鲁普测试",
            domainId: "conflict-control",
            domainLabel: "冲突控制",
            scoreKeys: ["accuracy", "incongruentAccuracy", "congruentAccuracy"],
            metricKeys: ["stroopEffectMs", "incongruentAccuracy", "omissionRate"],
            nextKeys: ["recommendation", "nextRecommendation", "lastAdjustment"]
        },
        focus: {
            label: "中科院注意力训练",
            domainId: "visual-search",
            domainLabel: "视觉搜索",
            scoreKeys: ["accuracy", "targetCompletionRate", "hitRate"],
            metricKeys: ["accuracy", "meanRtMs", "targetDensity"],
            nextKeys: ["nextRecommendation", "recommendation"]
        },
        cpt: {
            label: "持续表现任务",
            domainId: "sustained-vigilance",
            domainLabel: "持续警觉",
            scoreKeys: ["dPrime", "hitRate", "accuracy", "correctRejectionRate"],
            metricKeys: ["hitRate", "falseAlarmRate", "missRate", "dPrime"],
            nextKeys: ["recommendation", "nextRecommendation", "adaptiveReason"]
        },
        "go-no-go": {
            label: "Go/No-Go",
            domainId: "response-inhibition",
            domainLabel: "反应抑制",
            scoreKeys: ["dPrime", "accuracy", "hitRate"],
            metricKeys: ["commissionErrorRate", "omissionRate", "dPrime"],
            nextKeys: ["recommendation", "feedbackProfile"]
        },
        "stop-signal": {
            label: "停止信号任务",
            domainId: "response-inhibition",
            domainLabel: "反应抑制",
            scoreKeys: ["stopSuccessRate", "goAccuracy", "goResponseAccuracy"],
            metricKeys: ["stopSuccessRate", "ssrtEstimateMs", "meanSsdMs"],
            nextKeys: ["recommendation", "nextRecommendation", "ssrtEstimateNote"]
        }
    };

    const MODULE_ALIASES = new Map([
        ["schulte", "schulte"],
        ["舒尔特", "schulte"],
        ["flanker", "flanker"],
        ["stroop", "stroop"],
        ["斯特鲁普", "stroop"],
        ["focus", "focus"],
        ["中科院", "focus"],
        ["cpt", "cpt"],
        ["持续表现", "cpt"],
        ["go-no-go", "go-no-go"],
        ["gonogo", "go-no-go"],
        ["go_no_go", "go-no-go"],
        ["go/no-go", "go-no-go"],
        ["stop-signal", "stop-signal"],
        ["stopsignal", "stop-signal"],
        ["stop_signal", "stop-signal"],
        ["停止信号", "stop-signal"]
    ]);

    function toPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        return value;
    }

    function normalizeText(value) {
        return String(value || "").trim().toLowerCase();
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

    function normalizeModuleId(session) {
        const explicit = normalizeText((session && (session.moduleId || session.gameId)) || "");
        if (ATTENTION_MODULES[explicit]) {
            return explicit;
        }

        const searchText = sessionSearchText(session);
        for (const [alias, moduleId] of MODULE_ALIASES.entries()) {
            if (searchText.includes(alias)) {
                return moduleId;
            }
        }
        return null;
    }

    function isAttentionModule(session) {
        return Boolean(normalizeModuleId(session));
    }

    function parseNumber(value) {
        if (typeof value === "number" && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === "string") {
            const match = value.replace(/[,，%]/g, "").match(/-?\d+(?:\.\d+)?/);
            if (match) {
                return Number(match[0]);
            }
        }
        return null;
    }

    function valueFromSources(sources, keys) {
        for (const source of sources) {
            for (const key of keys) {
                if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== null && typeof source[key] !== "undefined") {
                    return source[key];
                }
            }
        }
        return null;
    }

    function numberFromSources(sources, keys) {
        const value = valueFromSources(sources, keys);
        return parseNumber(value);
    }

    function percentageLike(value) {
        if (value === null) {
            return null;
        }
        return value >= 0 && value <= 1 ? value * 100 : value;
    }

    function clampScore(value) {
        if (!Number.isFinite(value)) {
            return null;
        }
        return Math.max(0, Math.min(100, Math.round(value)));
    }

    function scoreFromSources(sources, moduleConfig) {
        const explicitScore = numberFromSources(sources, ["score"]);
        if (explicitScore !== null) {
            return clampScore(explicitScore >= 0 && explicitScore <= 1 ? explicitScore * 100 : explicitScore);
        }

        for (const key of moduleConfig.scoreKeys) {
            const value = numberFromSources(sources, [key]);
            if (value === null) continue;
            if (key === "dPrime") {
                return clampScore((Math.max(0, Math.min(3, value)) / 3) * 100);
            }
            return clampScore(percentageLike(value));
        }
        return null;
    }

    function formatMetricValue(key, value) {
        if (value === null || typeof value === "undefined") {
            return null;
        }
        const number = parseNumber(value);
        if (number !== null) {
            if (/rate|accuracy|success|completion|ratio/i.test(key)) {
                const pct = percentageLike(number);
                return `${Math.round(pct)}%`;
            }
            if (/rt|ms|ssd|ssrt|pace/i.test(key)) {
                return `${Math.round(number)}ms`;
            }
            return Number(number.toFixed(2)).toString();
        }
        return String(value);
    }

    function metricLabel(key) {
        const labels = {
            scanStability: "扫描稳定",
            meanInterClickRtMs: "点击间隔",
            errorRate: "错误率",
            flankerEffectMs: "干扰成本",
            stroopEffectMs: "冲突成本",
            incongruentAccuracy: "不一致准确",
            timeoutCount: "超时",
            omissionRate: "遗漏率",
            accuracy: "准确率",
            meanRtMs: "平均RT",
            targetDensity: "目标密度",
            hitRate: "命中率",
            falseAlarmRate: "误报率",
            missRate: "遗漏率",
            dPrime: "d'",
            commissionErrorRate: "误按率",
            stopSuccessRate: "停止成功",
            ssrtEstimateMs: "SSRT",
            meanSsdMs: "平均SSD"
        };
        return labels[key] || key;
    }

    function buildCoreMetric(sources, moduleConfig) {
        for (const key of moduleConfig.metricKeys) {
            const value = valueFromSources(sources, [key]);
            const formatted = formatMetricValue(key, value);
            if (formatted !== null) {
                return `${metricLabel(key)} ${formatted}`;
            }
        }
        return "核心指标不足";
    }

    function buildErrorProfile(sources) {
        const issues = [];
        const errorRate = percentageLike(numberFromSources(sources, ["errorRate"]));
        const falseAlarmRate = percentageLike(numberFromSources(sources, ["falseAlarmRate", "commissionErrorRate"]));
        const missRate = percentageLike(numberFromSources(sources, ["missRate", "omissionRate"]));
        const rtVar = numberFromSources(sources, ["rtStdDevMs", "rtVariabilityMs"]);
        const cost = numberFromSources(sources, ["flankerEffectMs", "stroopEffectMs"]);

        if (errorRate !== null && errorRate >= 20) issues.push("错误偏高");
        if (falseAlarmRate !== null && falseAlarmRate >= 15) issues.push("误报/误按偏高");
        if (missRate !== null && missRate >= 15) issues.push("遗漏偏高");
        if (rtVar !== null && rtVar >= 350) issues.push("反应波动偏大");
        if (cost !== null && cost >= 180) issues.push("干扰成本偏高");
        return issues.length > 0 ? issues.join("；") : "暂无明显错误集中点";
    }

    function buildLoadLevel(sources) {
        const level = valueFromSources(sources, ["level", "loadLevel"]);
        if (level !== null) return `等级 ${level}`;

        const grid = valueFromSources(sources, ["gridSize", "nextGridSize"]);
        if (grid !== null) return `网格 ${grid}`;

        const ratio = valueFromSources(sources, ["incongruentRatio", "finalNoGoRatio", "targetDensity"]);
        const ratioText = formatMetricValue("ratio", ratio);
        if (ratioText) return `负荷 ${ratioText}`;

        const ssd = valueFromSources(sources, ["finalSsdMs", "meanSsdMs"]);
        const ssdText = formatMetricValue("ssd", ssd);
        if (ssdText) return `SSD ${ssdText}`;

        return "沿用当前负荷";
    }

    function buildTrendDirection(score, sources) {
        const explicit = valueFromSources(sources, ["trendDirection", "riskTrend", "adaptiveReasonCode", "lastAdjustment"]);
        if (explicit) return String(explicit);
        if (score === null) return "样本不足";
        if (score >= 85) return "可小幅增负荷";
        if (score >= 70) return "维持当前负荷";
        return "建议降负荷";
    }

    function buildRecommendation(moduleConfig, sources, score, errorProfile) {
        const direct = valueFromSources(sources, moduleConfig.nextKeys);
        if (direct) {
            return String(direct);
        }
        if (score !== null && score >= 85) {
            return `${moduleConfig.domainLabel}表现稳定，下一轮可小幅提高负荷。`;
        }
        if (score !== null && score < 70) {
            return `${moduleConfig.domainLabel}先降负荷巩固；${errorProfile}`;
        }
        return `${moduleConfig.domainLabel}维持当前设置，继续观察错误类型。`;
    }

    function sessionTime(session) {
        const date = new Date((session && (session.finishedAt || session.startedAt)) || 0);
        const value = date.getTime();
        return Number.isFinite(value) ? value : 0;
    }

    function canonicalizeSession(session) {
        const moduleId = normalizeModuleId(session);
        const summary = toPlainObject(session && session.summary);
        const metrics = toPlainObject(session && session.metrics);
        const sessionData = toPlainObject(session);
        const sources = [summary, metrics, sessionData];
        if (!moduleId) {
            const rawModuleId = (session && (session.moduleId || session.gameId)) || "unknown";
            const fallbackScore = numberFromSources(sources, ["score"]);
            const score = fallbackScore === null ? null : clampScore(fallbackScore >= 0 && fallbackScore <= 1 ? fallbackScore * 100 : fallbackScore);
            return {
                isAttentionModule: false,
                moduleId: String(rawModuleId),
                moduleName: (session && session.gameName) || String(rawModuleId),
                domainId: null,
                domainLabel: "非注意力模块",
                coreMetric: "核心指标不足",
                errorProfile: "暂无错误分型",
                loadLevel: "暂无负荷记录",
                trendDirection: "样本不足",
                nextRecommendation: "暂无注意力系统建议",
                score,
                latestSessionTime: sessionTime(session)
            };
        }

        const moduleConfig = ATTENTION_MODULES[moduleId];
        const score = scoreFromSources(sources, moduleConfig);
        const errorProfile = buildErrorProfile(sources);

        return {
            isAttentionModule: true,
            moduleId,
            moduleName: (session && session.gameName) || moduleConfig.label,
            domainId: moduleConfig.domainId,
            domainLabel: moduleConfig.domainLabel,
            coreMetric: buildCoreMetric(sources, moduleConfig),
            errorProfile,
            loadLevel: buildLoadLevel(sources),
            trendDirection: buildTrendDirection(score, sources),
            nextRecommendation: buildRecommendation(moduleConfig, sources, score, errorProfile),
            score,
            latestSessionTime: sessionTime(session)
        };
    }

    function average(values) {
        const finite = values.filter((value) => Number.isFinite(value));
        if (finite.length === 0) return null;
        return finite.reduce((sum, value) => sum + value, 0) / finite.length;
    }

    function moduleProfiles(canonicalSessions) {
        const groups = new Map();
        canonicalSessions.forEach((item) => {
            if (!groups.has(item.moduleId)) {
                groups.set(item.moduleId, []);
            }
            groups.get(item.moduleId).push(item);
        });

        return Array.from(groups.values()).map((items) => {
            items.sort((a, b) => b.latestSessionTime - a.latestSessionTime);
            const latest = items[0];
            const previous = items[1] || null;
            const averageScore = average(items.map((item) => item.score));
            let trendDirection = latest.trendDirection;
            if (latest.score !== null && previous && previous.score !== null) {
                const delta = latest.score - previous.score;
                if (delta >= 5) trendDirection = "上升";
                if (delta <= -5) trendDirection = "下降";
            }

            return {
                ...latest,
                count: items.length,
                sessionCount: items.length,
                averageScore: averageScore === null ? null : Math.round(averageScore),
                trendDirection
            };
        }).sort((a, b) => {
            const scoreA = a.averageScore === null ? 101 : a.averageScore;
            const scoreB = b.averageScore === null ? 101 : b.averageScore;
            return scoreA - scoreB || b.latestSessionTime - a.latestSessionTime;
        });
    }

    function aggregateAttentionSessions(sessions) {
        const canonical = (Array.isArray(sessions) ? sessions : [])
            .map(canonicalizeSession)
            .filter((item) => item && item.isAttentionModule)
            .sort((a, b) => b.latestSessionTime - a.latestSessionTime);
        if (canonical.length === 0) {
            return {
                hasAttentionRecords: false,
                count: 0,
                totalSessions: 0,
                moduleCount: 0,
                domainCount: 0,
                averageScore: null,
                canonicalSessions: [],
                profiles: [],
                latestProfiles: [],
                weakProfiles: [],
                priorityProfiles: [],
                chips: [],
                prescriptions: [],
                summaryText: "最近记录里暂无注意力模块。"
            };
        }

        const profiles = moduleProfiles(canonical);
        const scores = canonical.map((item) => item.score);
        const averageScore = average(scores);
        const domainCount = new Set(profiles.map((profile) => profile.domainId).filter(Boolean)).size;
        const weakProfiles = profiles.filter((profile) => (
            profile.averageScore === null || profile.averageScore < 75 || profile.errorProfile !== "暂无明显错误集中点"
        ));
        const priorityProfiles = weakProfiles.length > 0 ? weakProfiles : profiles;
        const prescriptions = priorityProfiles
            .slice(0, 3)
            .map((profile) => `${profile.moduleName}｜${profile.domainLabel}：${profile.nextRecommendation}`);
        const chips = profiles.map((profile) => ({
            moduleId: profile.moduleId,
            label: attentionSummaryChipText(profile),
            title: `${profile.errorProfile}；${profile.loadLevel}；${profile.nextRecommendation}`
        }));
        const priority = priorityProfiles[0] || profiles[0];
        const averageScoreText = averageScore === null ? "暂无平均评分" : `平均评分 ${Math.round(averageScore)}`;

        return {
            hasAttentionRecords: true,
            count: canonical.length,
            totalSessions: canonical.length,
            moduleCount: profiles.length,
            domainCount,
            averageScore: averageScore === null ? null : Math.round(averageScore),
            canonicalSessions: canonical,
            profiles,
            latestProfiles: profiles,
            weakProfiles,
            priorityProfiles,
            chips,
            prescriptions,
            summaryText: `最近 ${canonical.length} 条注意力记录，覆盖 ${profiles.length} 个模块、${domainCount} 个能力域，${averageScoreText}。下一轮优先 ${priority.moduleName}（${priority.domainLabel}）：${priority.nextRecommendation}`
        };
    }

    function attentionSummaryChipText(profile) {
        if (!profile || typeof profile !== "object") {
            return "暂无注意力画像";
        }
        const score = Object.prototype.hasOwnProperty.call(profile, "averageScore") ? profile.averageScore : profile.score;
        const scoreText = score === null || typeof score === "undefined" ? "暂无评分" : `评分 ${score}`;
        return `${profile.moduleName} · ${profile.coreMetric} · ${profile.trendDirection} · ${scoreText}`;
    }

    global.AttentionProfile = {
        isAttentionModule,
        canonicalizeSession,
        aggregateAttentionSessions,
        attentionSummaryChipText
    };
})(typeof window !== "undefined" ? window : globalThis);
