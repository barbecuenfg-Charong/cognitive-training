const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const TEST_DATE = "2026-05-13";
const TRAINING_TRENDS_PATH = path.join(ROOT, "src", "shared", "training-trends.js");

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function createMemoryStorage() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        },
        key(index) {
            return Array.from(store.keys())[index] || null;
        },
        get length() {
            return store.size;
        }
    };
}

function createSandboxWindow() {
    const window = {
        localStorage: createMemoryStorage(),
        performance: {
            now() {
                return Date.now();
            }
        }
    };

    const sandbox = {
        window,
        console,
        Math,
        Number,
        String,
        Boolean,
        Array,
        Object,
        Date,
        Map,
        Set,
        JSON,
        RegExp,
        Error,
        TypeError,
        URL,
        URLSearchParams,
        parseInt,
        parseFloat,
        isFinite,
        isNaN,
        module: { exports: {} },
        exports: {}
    };

    sandbox.global = window;
    sandbox.globalThis = window;
    vm.createContext(sandbox);
    return { sandbox, window };
}

function loadRuntime() {
    const { sandbox, window } = createSandboxWindow();

    vm.runInContext(read("src/shared/training-results.js"), sandbox, {
        filename: "src/shared/training-results.js"
    });
    vm.runInContext(read("src/shared/attention-profile.js"), sandbox, {
        filename: "src/shared/attention-profile.js"
    });

    const trendsPresent = fs.existsSync(TRAINING_TRENDS_PATH);
    if (trendsPresent) {
        vm.runInContext(fs.readFileSync(TRAINING_TRENDS_PATH, "utf8"), sandbox, {
            filename: "src/shared/training-trends.js"
        });
    }

    return { window, trendsPresent };
}

function sessionValue(session, keys) {
    const summary = session && session.summary && typeof session.summary === "object" ? session.summary : {};
    const metrics = session && session.metrics && typeof session.metrics === "object" ? session.metrics : {};
    const sessionData = session && typeof session === "object" ? session : {};

    for (const key of keys) {
        for (const source of [summary, metrics, sessionData]) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                const value = source[key];
                if (value !== null && typeof value !== "undefined" && value !== "") {
                    return value;
                }
            }
        }
    }
    return undefined;
}

function saveRepresentativeSessions(api) {
    const sessions = [
        {
            moduleId: "nback",
            gameId: "nback",
            gameName: "N-Back 记忆",
            startedAt: "2026-05-13T11:50:00.000Z",
            finishedAt: "2026-05-13T12:00:00.000Z",
            durationMs: 600000,
            score: 82,
            seed: "smoke-real-loop-nback",
            contentVersion: "smoke-real-loop-v1",
            summary: {
                accuracy: 0.82,
                nextRecommendedN: 3,
                nextRecommendedSpeedMs: 2100,
                nextRecommendedRounds: 24,
                staircaseQuality: 0.78,
                adaptiveStabilityLabel: "stable",
                nextPrescriptionReason: "accuracy stable enough to hold load",
                nextPracticeRecommendation: "Hold 3-back and add one short consolidation round."
            },
            metrics: {
                hitRate: 0.86,
                falseAlarmRate: 0.08,
                staircaseQuality: 0.78
            },
            trials: [
                { index: 0, stimulus: "A", expectedMatch: false, response: false, correct: true, rtMs: 680 },
                { index: 1, stimulus: "B", expectedMatch: true, response: true, correct: true, rtMs: 720 }
            ]
        },
        {
            moduleId: "corsi",
            gameId: "corsi",
            gameName: "科西方块",
            startedAt: "2026-05-13T12:05:00.000Z",
            finishedAt: "2026-05-13T12:12:00.000Z",
            durationMs: 420000,
            score: 76,
            seed: "smoke-real-loop-corsi",
            contentVersion: "smoke-real-loop-v1",
            summary: {
                maxSpan: 6,
                nextStartSpan: 5,
                nextMode: "forward",
                nextBlockCount: 8,
                spanStability: 0.72,
                spanOscillationCount: 1,
                modeTransitionReadiness: "forward-ready",
                nextPrescriptionReason: "span stable after one reversal",
                nextPracticeRecommendation: "Start at span 5 before trying backward mode."
            },
            metrics: {
                positionAccuracy: 0.79,
                spanStability: 0.72,
                adaptationVolatility: 0.18
            },
            trials: [
                { index: 0, span: 5, correct: true },
                { index: 1, span: 6, correct: false }
            ]
        },
        {
            moduleId: "stop-signal",
            gameId: "stop-signal",
            gameName: "Stop Signal",
            startedAt: "2026-05-13T12:15:00.000Z",
            finishedAt: "2026-05-13T12:21:00.000Z",
            durationMs: 360000,
            score: 74,
            seed: "smoke-real-loop-stop-signal",
            contentVersion: "smoke-real-loop-v1",
            summary: {
                stopSuccessRate: 0.58,
                goAccuracy: 0.91,
                ssrtEstimateMs: 236,
                meanSsdMs: 255,
                ssdStaircaseQuality: 0.64,
                staircaseQuality: 0.64,
                staircaseQualityLabel: "moderate",
                goWaitingFlag: false,
                nextRecommendedSpeedMs: 900,
                nextRecommendedRounds: 3,
                nextPrescriptionReason: "SSD staircase stayed usable but needs stabilization",
                nextPracticeRecommendation: "Repeat the current speed and keep natural go timing."
            },
            metrics: {
                stopSuccessRate: 0.58,
                ssrtEstimateMs: 236,
                meanSsdMs: 255,
                staircaseQuality: 0.64
            },
            trials: [
                { index: 0, trialType: "go", correct: true, rtMs: 520 },
                { index: 1, trialType: "stop", inhibited: true, ssdMs: 250 }
            ]
        },
        {
            moduleId: "eyes-reading",
            gameId: "eyes-reading",
            gameName: "Reading the Mind in the Eyes",
            startedAt: "2026-05-13T12:25:00.000Z",
            finishedAt: "2026-05-13T12:31:00.000Z",
            durationMs: 360000,
            score: 68,
            seed: "smoke-real-loop-eyes",
            contentVersion: "smoke-real-loop-v1",
            summary: {
                accuracy: 0.68,
                vocabularyRiskCount: 2,
                confusionBreakdown: { reflective: 1, suspicious: 1 },
                nextPrescriptionReason: "two high-vocabulary distractors were confused",
                nextPracticeRecommendation: "Review emotion vocabulary before the next eyes-reading block."
            },
            metrics: {
                emotionCategoryBreakdown: { positive: 3, negative: 5, neutral: 2 },
                vocabularyRiskCount: 2
            },
            trials: [
                { index: 0, target: "reflective", response: "suspicious", correct: false },
                { index: 1, target: "friendly", response: "friendly", correct: true }
            ]
        }
    ];

    return sessions.map((session) => api.saveSession(session));
}

function hasPlanSignalPayload(value) {
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (value && typeof value === "object") {
        return Object.keys(value).length > 0;
    }
    if (typeof value === "string") {
        return value.trim().length > 0;
    }
    return false;
}

function evaluateTrainingTrends(window, sessions) {
    const api = window.TrainingTrends;
    assert(api && typeof api === "object", "TrainingTrends should attach an API object to window");

    const functionNames = Object.keys(api).filter((key) => typeof api[key] === "function");
    const prioritized = functionNames
        .filter((key) => /signal|plan|trend|recommend|summary|profile|analyz|build|create|get/i.test(key))
        .concat(functionNames.filter((key) => !/signal|plan|trend|recommend|summary|profile|analyz|build|create|get/i.test(key)));

    for (const name of prioritized) {
        const calls = [
            () => api[name](sessions),
            () => api[name]({ sessions, allSessions: sessions, dateKey: TEST_DATE }),
            () => api[name](sessions, { dateKey: TEST_DATE }),
            () => api[name](window.TrainingResults, { dateKey: TEST_DATE })
        ];

        for (const call of calls) {
            try {
                const result = call();
                if (hasPlanSignalPayload(result)) {
                    return `${name} produced ${Array.isArray(result) ? result.length : typeof result} signal payload`;
                }
            } catch (_error) {
                // Try the next likely call shape; helper APIs may choose one contract.
            }
        }
    }

    throw new Error("TrainingTrends loaded, but no callable helper produced a non-empty plan signal payload");
}

function runCheck(results, label, fn) {
    try {
        fn();
        console.log(`[PASS] ${label}`);
        results.pass += 1;
    } catch (error) {
        console.log(`[FAIL] ${label}`);
        console.log(`  - ${error.message}`);
        results.fail += 1;
    }
}

function skip(results, label, reason) {
    console.log(`[SKIP] ${label}`);
    console.log(`  - ${reason}`);
    results.skip += 1;
}

function main() {
    const results = { pass: 0, fail: 0, skip: 0 };
    const { window, trendsPresent } = loadRuntime();
    let savedSessions = [];
    let allSessions = [];
    let dateSessions = [];

    runCheck(results, "runtime helpers load", () => {
        assert(window.TrainingResults, "TrainingResults should load");
        assert.strictEqual(typeof window.TrainingResults.saveSession, "function", "saveSession should exist");
        assert.strictEqual(typeof window.TrainingResults.getAllSessions, "function", "getAllSessions should exist");
        assert.strictEqual(typeof window.TrainingResults.getSessionsByDate, "function", "getSessionsByDate should exist");
        assert(window.AttentionProfile, "AttentionProfile should load");
        assert.strictEqual(typeof window.AttentionProfile.aggregateAttentionSessions, "function", "aggregateAttentionSessions should exist");
    });

    runCheck(results, "representative sessions save through TrainingResults", () => {
        savedSessions = saveRepresentativeSessions(window.TrainingResults);
        assert.strictEqual(savedSessions.length, 4, "four representative sessions should be saved");
        assert.deepStrictEqual(
            savedSessions.map((session) => session.moduleId).sort(),
            ["corsi", "eyes-reading", "nback", "stop-signal"],
            "saved sessions should cover N-Back, Corsi, Stop Signal, and Eyes Reading"
        );
    });

    runCheck(results, "getAllSessions and getSessionsByDate read saved loop data", () => {
        allSessions = window.TrainingResults.getAllSessions();
        dateSessions = window.TrainingResults.getSessionsByDate(TEST_DATE);
        assert.strictEqual(allSessions.length, 4, "getAllSessions should read all saved sessions");
        assert.strictEqual(dateSessions.length, 4, "getSessionsByDate should read sessions for the test date");
        assert.deepStrictEqual(
            dateSessions.map((session) => session.moduleId).sort(),
            ["corsi", "eyes-reading", "nback", "stop-signal"],
            "date read should preserve all representative module ids"
        );
    });

    runCheck(results, "report and daily-plan source fields remain visible", () => {
        const byModule = new Map(dateSessions.map((session) => [session.moduleId, session]));
        const nback = byModule.get("nback");
        const corsi = byModule.get("corsi");
        const stopSignal = byModule.get("stop-signal");
        const eyes = byModule.get("eyes-reading");

        assert.strictEqual(
            sessionValue(nback, ["nextPracticeRecommendation"]),
            "Hold 3-back and add one short consolidation round.",
            "nextPracticeRecommendation should be preserved in summary"
        );
        assert.strictEqual(
            sessionValue(eyes, ["nextPrescriptionReason"]),
            "two high-vocabulary distractors were confused",
            "nextPrescriptionReason should be preserved in summary"
        );
        assert.strictEqual(sessionValue(stopSignal, ["staircaseQuality"]), 0.64, "staircaseQuality should be visible");
        assert.strictEqual(sessionValue(corsi, ["spanStability"]), 0.72, "spanStability should be visible");
        assert.strictEqual(sessionValue(stopSignal, ["ssdStaircaseQuality", "staircaseQualityLabel"]), 0.64, "report Stop Signal field group should resolve");
    });

    runCheck(results, "AttentionProfile generates an attention profile from saved sessions", () => {
        const aggregate = window.AttentionProfile.aggregateAttentionSessions(allSessions);
        assert.strictEqual(aggregate.hasAttentionRecords, true, "attention profile should detect Stop Signal");
        assert.strictEqual(aggregate.count, 1, "only Stop Signal should be treated as an attention module in this fixture");
        assert.ok(Array.isArray(aggregate.profiles) && aggregate.profiles.length > 0, "profiles should be generated");
        assert.ok(Array.isArray(aggregate.prescriptions) && aggregate.prescriptions.length > 0, "attention prescriptions should be generated");
        assert.ok(String(aggregate.summaryText || "").includes("Stop Signal"), "summary should mention the attention module");
    });

    if (trendsPresent) {
        runCheck(results, "TrainingTrends generates plan signals", () => {
            const detail = evaluateTrainingTrends(window, allSessions);
            assert.ok(detail, "TrainingTrends should produce detail");
            console.log(`  - ${detail}`);
        });
    } else {
        skip(results, "TrainingTrends generates plan signals", "src/shared/training-trends.js is not present");
    }

    console.log(`Summary: ${results.pass} passed, ${results.skip} skipped, ${results.fail} failed`);
    if (results.fail > 0) {
        process.exitCode = 1;
    }
}

main();
