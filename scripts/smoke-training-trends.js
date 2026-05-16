const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "src", "shared", "training-trends.js");

function loadTrainingTrends() {
    const source = fs.readFileSync(SOURCE, "utf8");
    const sandbox = {
        window: {},
        console,
        Math,
        Number,
        String,
        Array,
        Object,
        Date,
        Map,
        Set,
        JSON,
        RegExp,
        parseInt,
        parseFloat,
        isFinite,
        module: { exports: {} },
        exports: {}
    };
    sandbox.global = sandbox.window;
    sandbox.globalThis = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: SOURCE });
    return sandbox.window.TrainingTrends;
}

function assertClose(actual, expected, message) {
    assert.ok(Math.abs(actual - expected) < 0.2, `${message}: expected ${expected}, got ${actual}`);
}

function sampleSessions() {
    return [
        {
            moduleId: "nback",
            gameName: "N-Back",
            finishedAt: "2026-05-14T08:00:00.000Z",
            summary: {
                score: 0.82,
                accuracy: 0.84,
                stability: 0.86,
                modeTransitionReadiness: 0.88,
                meanRtMs: 690
            },
            metrics: {
                adaptationVolatility: 0.06
            }
        },
        {
            gameId: "nback",
            gameName: "N-Back",
            finishedAt: "2026-05-13T08:00:00.000Z",
            metrics: {
                score: 68,
                accuracy: "74%",
                stability: 0.72
            }
        },
        {
            moduleId: "nback",
            gameName: "N-Back",
            finishedAt: "2026-05-12T08:00:00.000Z",
            score: 64,
            summary: {
                accuracy: 0.66
            }
        },
        {
            moduleId: "task-switching",
            gameName: "Task Switching",
            finishedAt: "2026-05-14T09:00:00.000Z",
            summary: {
                score: 88,
                switchAccuracy: 0.89,
                cueDelayMs: 500
            },
            metrics: {
                adaptationVolatility: 0.28
            }
        },
        {
            moduleId: "task-switching",
            gameName: "Task Switching",
            finishedAt: "2026-05-13T09:00:00.000Z",
            metrics: {
                score: 60,
                finalSwitchProbability: 0.45
            }
        },
        {
            moduleId: "task-switching",
            gameName: "Task Switching",
            finishedAt: "2026-05-12T09:00:00.000Z",
            summary: {
                score: 90
            }
        },
        {
            moduleId: "go-no-go",
            gameName: "Go/No-Go",
            finishedAt: "2026-05-14T10:00:00.000Z",
            metrics: {
                accuracy: 0.76,
                goResponseAccuracy: 0.8,
                commissionErrorRate: 0.18
            }
        },
        {
            moduleId: "rt-only",
            gameName: "Reaction Time Probe",
            finishedAt: "2026-05-14T11:00:00.000Z",
            summary: {
                meanRtMs: 530,
                rtStdDevMs: 120
            }
        }
    ];
}

function main() {
    const api = loadTrainingTrends();
    assert(api, "TrainingTrends should be attached to window");
    assert.strictEqual(typeof api.analyzeTrainingTrends, "function", "analyzeTrainingTrends should exist");
    assert.strictEqual(typeof api.summarizeModuleTrend, "function", "summarizeModuleTrend should exist");
    assert.strictEqual(typeof api.buildPlanSignals, "function", "buildPlanSignals should exist");

    const analysis = api.analyzeTrainingTrends(sampleSessions(), { windows: [2, 4, 7], windowSize: 7 });
    assert.strictEqual(analysis.totalSessions, 8, "all sample sessions should be considered");
    assert.strictEqual(analysis.moduleSummaries.length, 4, "all modules should be grouped");
    assert.ok(analysis.windows.last2, "last2 window should be present");
    assert.ok(analysis.windows.last4, "last4 window should be present");
    assert.ok(analysis.windows.last7, "last7 window should be present");

    const nback = analysis.moduleMap.nback;
    assert.strictEqual(nback.count, 3, "nback should aggregate recent sessions");
    assert.strictEqual(nback.latest.score, 82, "ratio score should normalize to percent");
    assert.strictEqual(nback.previous.score, 68, "previous score should be exposed");
    assert.strictEqual(nback.delta, 14, "delta should compare latest and previous scores");
    assert.strictEqual(nback.trendLabel, "上升", "nback should show upward trend");
    assert.strictEqual(nback.readinessLabel, "可进阶", "readiness should consume readiness-like fields");
    assert.ok(nback.recommendedAction.includes("进阶"), "nback should recommend a cautious progression");
    assertClose(nback.averageScore, 71.3, "nback average score");
    assertClose(nback.recentScore, 71.3, "nback recent score");

    const switching = analysis.moduleMap["task-switching"];
    assert.strictEqual(switching.volatilityLabel, "波动偏高", "explicit volatility should be classified");
    assert.ok(switching.recommendedAction.includes("稳定"), "volatile modules should prefer stabilization");

    const goNoGo = analysis.moduleMap["go-no-go"];
    assert.strictEqual(goNoGo.latest.score, 76, "accuracy should be a conservative score fallback");

    const rtOnly = analysis.moduleMap["rt-only"];
    assert.strictEqual(rtOnly.averageScore, null, "RT-only sessions should not invent scores");
    assert.strictEqual(rtOnly.trendLabel, "无评分数据", "RT-only sessions should report missing score trend");

    const directGroup = api.summarizeModuleTrend(sampleSessions().filter((item) => item.moduleId === "task-switching"));
    assert.strictEqual(directGroup.moduleId, "task-switching", "summarizeModuleTrend should accept raw session groups");
    assert.strictEqual(directGroup.volatilityLabel, "波动偏高", "direct module summary should preserve volatility judgment");

    const planSignals = api.buildPlanSignals(sampleSessions());
    assert.strictEqual(planSignals.hasSignals, true, "plan signals should be available");
    assert.strictEqual(planSignals.focusModule.moduleId, "task-switching", "plan should prioritize volatile module");
    assert.ok(planSignals.recommendedAction.includes("稳定"), "plan should expose an actionable prescription");
    assert.ok(planSignals.summaryText.includes("task-switching"), "plan summary should name the focus module");
    assert.ok(planSignals.moduleSignals.length >= 3, "plan should expose module-level signals");

    console.log("training trends smoke passed");
}

main();
