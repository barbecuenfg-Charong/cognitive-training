const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, "src", "shared", "attention-profile.js");

function loadAttentionProfile() {
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
        Promise,
        module: { exports: {} },
        exports: {}
    };
    sandbox.global = sandbox.window;
    sandbox.globalThis = sandbox.window;
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: SOURCE });
    return sandbox.window.AttentionProfile;
}

function main() {
    const api = loadAttentionProfile();
    assert(api, "AttentionProfile should be attached to window");
    assert.strictEqual(typeof api.aggregateAttentionSessions, "function", "aggregateAttentionSessions should exist");

    const sessions = [
        {
            moduleId: "schulte",
            gameName: "舒尔特方格",
            finishedAt: "2026-05-13T08:00:00.000Z",
            summary: { score: 88, scanStability: 90, errorRate: 8 },
            metrics: { score: 88, scanStability: 90, errorRate: 8 }
        },
        {
            moduleId: "cpt",
            gameName: "持续表现任务",
            finishedAt: "2026-05-13T09:00:00.000Z",
            summary: { accuracy: 0.91, hitRate: 0.92, falseAlarmRate: 0.06, dPrime: 1.9 },
            metrics: { accuracy: 0.91, hitRate: 0.92, falseAlarmRate: 0.06, dPrime: 1.9 }
        },
        {
            moduleId: "daily-plan",
            gameName: "非注意力记录",
            finishedAt: "2026-05-13T10:00:00.000Z",
            summary: { score: 100 },
            metrics: { score: 100 }
        }
    ];

    const aggregate = api.aggregateAttentionSessions(sessions);
    assert.strictEqual(aggregate.hasAttentionRecords, true, "expected attention records");
    assert.ok(typeof aggregate.summaryText === "string" && aggregate.summaryText.length > 0, "summaryText should be present");
    assert.ok(aggregate.summaryText.includes("2"), "summaryText should mention record count");
    assert.ok(Array.isArray(aggregate.chips) && aggregate.chips.length > 0, "chips should be present");
    assert.ok(aggregate.chips.every((item) => item && typeof item.label === "string"), "chips should have labels");
    assert.ok(Array.isArray(aggregate.prescriptions) && aggregate.prescriptions.length > 0, "prescriptions should be present");
    assert.ok(aggregate.moduleCount >= 2, "moduleCount should reflect attention modules");
    assert.strictEqual(aggregate.count, 2, "non-attention sessions should be filtered out");
    assert.strictEqual(api.isAttentionModule(sessions[2]), false, "non-attention session should be ignored");
    assert.ok(typeof api.attentionSummaryChipText === "function", "summary chip helper should exist");

    console.log("attention profile smoke passed");
}

main();
