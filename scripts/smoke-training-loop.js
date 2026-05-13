const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");

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
        }
    };
}

function loadRuntime() {
    const window = {
        localStorage: createMemoryStorage()
    };
    const sandbox = {
        window,
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
    sandbox.global = window;
    sandbox.globalThis = window;
    vm.createContext(sandbox);
    vm.runInContext(read("src/shared/training-results.js"), sandbox, { filename: "training-results.js" });
    vm.runInContext(read("src/shared/attention-profile.js"), sandbox, { filename: "attention-profile.js" });
    return window;
}

function main() {
    const window = loadRuntime();
    assert(window.TrainingResults, "TrainingResults should load");
    assert(window.AttentionProfile, "AttentionProfile should load");

    const finishedAt = "2026-05-13T10:00:00.000Z";
    const attention = window.TrainingResults.saveSession({
        gameId: "schulte",
        gameName: "舒尔特方格",
        startedAt: "2026-05-13T09:55:00.000Z",
        finishedAt,
        score: 86,
        seed: "sample-schulte-seed",
        contentVersion: "smoke-attention-v1",
        summary: {
            scanStability: 88,
            targetCompletionRate: 1,
            errorRate: 0.04,
            recommendation: "维持当前负荷，继续稳定扫描路径。"
        },
        metrics: {
            scanStability: 88,
            meanInterClickRtMs: 720,
            errorRate: 0.04
        },
        trials: [
            { index: 0, target: 1, correct: true, rtMs: 710 },
            { index: 1, target: 2, correct: true, rtMs: 730 }
        ]
    });

    const planning = window.TrainingResults.saveSession({
        gameId: "london-tower",
        gameName: "伦敦塔",
        startedAt: "2026-05-13T10:05:00.000Z",
        finishedAt: "2026-05-13T10:10:00.000Z",
        seed: "sample-planning-seed",
        contentVersion: "smoke-planning-v1",
        summary: {
            validatedOptimalRate: 80,
            avgPlanningEfficiency: 86,
            planningPrescription: "maintain-and-stabilize-path"
        },
        metrics: {
            validatedOptimalRate: 80,
            avgPlanningEfficiency: 86,
            optimalValidationMismatches: 0,
            planningPrescription: "maintain-and-stabilize-path"
        },
        trials: [
            {
                index: 0,
                validatedOptimalMoves: 5,
                actualMoves: 6,
                planningEfficiency: 83,
                optimalSource: "bfs-validated"
            }
        ]
    });

    const sessions = window.TrainingResults.getAllSessions();
    assert.strictEqual(sessions.length, 2, "saved sessions should be readable");
    assert.strictEqual(attention.trials.length, 2, "attention trials should be normalized");
    assert.strictEqual(planning.trials[0].validatedOptimalMoves, 5, "planning trial field should persist");

    const dates = window.TrainingResults.getAvailableDates();
    assert.ok(dates.includes("2026-05-13"), "available dates should include saved session date");

    const overview = window.TrainingResults.getDailyOverview("2026-05-13");
    assert.strictEqual(overview.totalSessions, 2, "daily overview should count saved sessions");

    const aggregate = window.AttentionProfile.aggregateAttentionSessions(sessions);
    assert.strictEqual(aggregate.hasAttentionRecords, true, "attention aggregate should find saved attention session");
    assert.strictEqual(aggregate.count, 1, "attention aggregate should ignore non-attention planning session");
    assert.ok(aggregate.summaryText.includes("1"), "attention summary should mention the attention count");
    assert.ok(aggregate.prescriptions.length > 0, "attention aggregate should produce a prescription");

    console.log("training loop smoke passed");
}

main();
