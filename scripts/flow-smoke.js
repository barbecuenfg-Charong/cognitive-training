const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TRAINING_RESULTS = "src/shared/training-results.js";
const ATTENTION_PROFILE = "src/shared/attention-profile.js";
const SEEDED_RANDOM = "src/shared/seeded-random.js";

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function jsWord(value) {
    return new RegExp(`\\b${escapeRegExp(value)}\\b`);
}

function jsField(value) {
    return new RegExp(`\\b${escapeRegExp(value)}\\b\\s*:|\\b${escapeRegExp(value)}\\b`);
}

const SAVE_CHECKS = [
    { label: "TrainingResults.saveSession call", pattern: /TrainingResults\.saveSession\s*\(/ },
    { label: "metrics payload", pattern: /\bmetrics\s*:/ }
];

const SEEDED_SAVE_CHECKS = [
    ...SAVE_CHECKS,
    { label: "session seed field", pattern: /\bseed\s*:/ },
    { label: "contentVersion field", pattern: /\bcontentVersion\s*:/ },
    { label: "CONTENT_VERSION marker", pattern: /\bCONTENT_VERSION\b/ }
];

const START_GAME_CHECKS = [
    { label: "startGame function", pattern: /function\s+startGame\s*\(/ }
];

const FLOWS = [
    {
        name: "Task Switching",
        html: "task-switching.html",
        js: "task-switching.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "accuracy",
            "trial-progress",
            "switch-cost",
            "game-area",
            "instruction-overlay",
            "prestart-actions",
            "ts-display",
            "stimulus-card",
            "btn-a",
            "btn-l",
            "adaptive-mode",
            "result-modal",
            "final-accuracy",
            "final-switch-cost",
            "final-rt",
            "final-adaptive-state"
        ],
        jsChecks: [
            ...START_GAME_CHECKS,
            { label: "practice entry", pattern: /function\s+startPractice\s*\(/ },
            ...SEEDED_SAVE_CHECKS,
            { label: "adaptive switch-cue marker", pattern: /adaptive-switch-cue/ },
            { label: "switch probability field", pattern: jsField("switchProbability") },
            { label: "cue delay field", pattern: jsField("cueDelayMs") },
            { label: "final switch probability metric", pattern: jsField("finalSwitchProbability") },
            { label: "final cue delay metric", pattern: jsField("finalCueDelayMs") },
            { label: "adaptation events metric", pattern: jsField("adaptationEvents") },
            { label: "switch cost metric", pattern: jsField("switchCostMs") },
            { label: "mean RT metric", pattern: jsField("meanRtMs") },
            { label: "repeat accuracy metric", pattern: jsField("repeatAccuracy") },
            { label: "switch accuracy metric", pattern: jsField("switchAccuracy") }
        ]
    },
    {
        name: "Digit Span",
        html: "digit-span.html",
        js: "digit-span.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "speed-select",
            "current-length",
            "score",
            "start-btn",
            "display-area",
            "digit-content",
            "instruction-text",
            "input-area",
            "user-input-display",
            "result-modal",
            "final-span",
            "final-score",
            "performance-rating",
            "restart-btn"
        ],
        jsChecks: [
            { label: "DOMContentLoaded boot", pattern: /addEventListener\s*\(\s*["']DOMContentLoaded["']/ },
            { label: "startGame function", pattern: /function\s+startGame\s*\(/ },
            ...SEEDED_SAVE_CHECKS,
            { label: "sorted span mode", pattern: /value\s*=\s*["']sorted["']|'sorted'|"sorted"/ },
            { label: "sequence mode metric", pattern: jsField("sequenceMode") },
            { label: "expected response trial field", pattern: jsField("expectedResponse") },
            { label: "starting span metric", pattern: jsField("startingSpan") },
            { label: "minimum span metric", pattern: jsField("minSpan") },
            { label: "adaptation events metric", pattern: jsField("adaptationEvents") },
            { label: "final span metric", pattern: jsField("finalSpan") },
            { label: "accuracy metric", pattern: jsField("accuracy") },
            { label: "position accuracy metric", pattern: jsField("positionAccuracy") },
            { label: "score metric", pattern: jsField("score") }
        ]
    },
    {
        name: "Corsi",
        html: "corsi.html",
        js: "corsi.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "adaptive-mode",
            "block-count",
            "start-level",
            "current-level",
            "score",
            "start-btn",
            "stop-btn",
            "game-area",
            "message-display",
            "result-modal",
            "final-level",
            "final-score",
            "memory-span-rating",
            "restart-btn"
        ],
        jsChecks: [
            { label: "DOMContentLoaded boot", pattern: /addEventListener\s*\(\s*["']DOMContentLoaded["']/ },
            { label: "startGame function", pattern: /function\s+startGame\s*\(/ },
            ...SEEDED_SAVE_CHECKS,
            { label: "adaptive staircase marker", pattern: /adaptive-staircase/ },
            { label: "starting span metric", pattern: jsField("startingSpan") },
            { label: "minimum span metric", pattern: jsField("minSpan") },
            { label: "final span metric", pattern: jsField("finalSpan") },
            { label: "session type metric", pattern: jsField("sessionType") },
            { label: "adaptation event count metric", pattern: jsField("adaptationEventCount") },
            { label: "adaptation events metric", pattern: jsField("adaptationEvents") }
        ]
    },
    {
        name: "N-Back",
        html: "nback.html",
        js: "nback.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "n-level",
            "speed",
            "total-rounds",
            "adaptive-mode",
            "current-n",
            "display",
            "feedback",
            "match-btn",
            "result-modal",
            "final-score",
            "final-accuracy",
            "final-training-feedback",
            "history-list"
        ],
        jsChecks: [
            { label: "DOMContentLoaded boot", pattern: /addEventListener\s*\(\s*["']DOMContentLoaded["']/ },
            { label: "startGame function", pattern: /function\s+startGame\s*\(/ },
            ...SEEDED_SAVE_CHECKS,
            { label: "adaptive session marker", pattern: /adaptive-staircase/ },
            { label: "adaptive adjustment function", pattern: /function\s+maybeAdjustDifficulty\s*\(/ },
            { label: "adaptation events metric", pattern: jsField("adaptationEvents") },
            { label: "final N metric", pattern: jsField("finalNLevel") },
            { label: "d-prime metric", pattern: jsField("dPrime") },
            { label: "criterion metric", pattern: jsField("criterion") }
        ]
    },
    {
        name: "Mental Rotation",
        html: "mental-rotation.html",
        js: "mental-rotation.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "score",
            "avg-rt",
            "round",
            "adaptive-status",
            "adaptive-mode",
            "game-area",
            "start-screen",
            "mr-display",
            "stim-left",
            "stim-right",
            "result-modal",
            "result-accuracy",
            "result-rt",
            "result-slope",
            "feedback-text"
        ],
        jsChecks: [
            ...START_GAME_CHECKS,
            ...SEEDED_SAVE_CHECKS,
            { label: "adaptive angle-mirror marker", pattern: /adaptive-angle-mirror/ },
            { label: "adaptation events metric", pattern: jsField("adaptationEvents") },
            { label: "angle progression metric", pattern: jsField("angleSetProgression") },
            { label: "mirror progression metric", pattern: jsField("mirrorRatioProgression") },
            { label: "final mirror ratio metric", pattern: jsField("finalMirrorRatio") },
            { label: "accuracy metric", pattern: jsField("accuracy") },
            { label: "mean RT metric", pattern: jsField("meanRtMs") },
            { label: "accuracy by angle metric", pattern: jsField("accuracyByAngle") },
            { label: "mean RT by angle metric", pattern: jsField("meanRtByAngle") }
        ]
    },
    {
        name: "Raven",
        html: "raven.html",
        js: "raven.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "progress-bar",
            "level-display",
            "score-display",
            "matrix-grid",
            "options-area",
            "result-modal",
            "final-accuracy",
            "final-score",
            "performance-feedback",
            "restart-btn"
        ],
        jsChecks: [
            { label: "initGame function", pattern: /function\s+initGame\s*\(/ },
            { label: "window onload boot", pattern: /window\.onload\s*=\s*initGame/ },
            ...SEEDED_SAVE_CHECKS,
            { label: "accuracy metric", pattern: jsField("accuracy") },
            { label: "accuracy by rule metric", pattern: jsField("accuracyByRule") },
            { label: "accuracy by template metric", pattern: jsField("accuracyByTemplate") },
            { label: "template breakdown metric", pattern: jsField("templateBreakdown") },
            { label: "generated template count metric", pattern: jsField("generatedTemplateCount") },
            { label: "rule template id field", pattern: jsField("ruleTemplateId") },
            { label: "rule breakdown metric", pattern: jsField("ruleBreakdown") },
            { label: "score metric", pattern: jsField("score") }
        ]
    },
    {
        name: "Go/No-Go",
        html: "go-no-go.html",
        js: "go-no-go.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "accuracy",
            "avg-rt",
            "game-area",
            "instruction-overlay",
            "gng-display",
            "stimulus-circle",
            "result-modal",
            "go-accuracy",
            "nogo-accuracy",
            "final-rt",
            "commission-rate",
            "omission-rate",
            "signal-detection",
            "ratio-progression",
            "speed-progression",
            "isi-progression",
            "feedback-text"
        ],
        jsChecks: [
            ...START_GAME_CHECKS,
            ...SEEDED_SAVE_CHECKS,
            { label: "adaptive state", pattern: jsField("adaptiveState") },
            { label: "no-go ratio field", pattern: jsField("noGoRatio") },
            { label: "final no-go ratio metric", pattern: jsField("finalNoGoRatio") },
            { label: "final adaptive settings metric", pattern: jsField("finalAdaptiveSettings") },
            { label: "adaptation events metric", pattern: jsField("adaptationEvents") },
            { label: "ratio progression metric", pattern: jsField("ratioProgression") },
            { label: "speed progression metric", pattern: jsField("speedProgression") },
            { label: "d-prime metric", pattern: jsField("dPrime") },
            { label: "criterion metric", pattern: jsField("criterion") }
        ]
    },
    {
        name: "WCST",
        html: "wisconsin-card.html",
        js: "wisconsin-card.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "trial",
            "acc",
            "categories",
            "start-screen",
            "wcst-panel",
            "stimulus-card",
            "target-grid",
            "feedback",
            "result-modal",
            "result-acc",
            "result-categories",
            "result-errors",
            "result-persev",
            "result-set-losses",
            "result-seed"
        ],
        jsChecks: [
            ...START_GAME_CHECKS,
            ...SEEDED_SAVE_CHECKS,
            { label: "categories metric", pattern: jsField("categoriesCompleted") },
            { label: "perseverative errors metric", pattern: jsField("perseverativeErrors") },
            { label: "perseverative responses metric", pattern: jsField("perseverativeResponses") },
            { label: "set losses metric", pattern: jsField("setLosses") },
            { label: "accuracy metric", pattern: jsField("accuracy") }
        ]
    },
    {
        name: "Reversal Learning",
        html: "reversal-learning.html",
        js: "reversal-learning.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "trial",
            "reward",
            "optimal-rate",
            "start-screen",
            "rl-panel",
            "phase-hint",
            "choose-a",
            "choose-b",
            "feedback",
            "result-modal",
            "result-reward",
            "result-pre",
            "result-post",
            "result-adaptation",
            "result-strategy",
            "result-advice"
        ],
        jsChecks: [
            ...START_GAME_CHECKS,
            ...SEEDED_SAVE_CHECKS,
            { label: "reward metric", pattern: jsField("totalReward") },
            { label: "pre-reversal accuracy metric", pattern: jsField("preReversalAccuracy") },
            { label: "post-reversal accuracy metric", pattern: jsField("postReversalAccuracy") },
            { label: "adaptation metric", pattern: jsField("adaptationTrials") },
            { label: "perseveration metric", pattern: jsField("perseverationRate") }
        ]
    },
    {
        name: "Iowa",
        html: "iowa-gambling.html",
        js: "iowa-gambling.js",
        sharedScripts: [TRAINING_RESULTS, SEEDED_RANDOM],
        domIds: [
            "trial",
            "balance",
            "adv-rate",
            "start-screen",
            "igt-panel",
            "feedback",
            "log",
            "result-modal",
            "result-balance",
            "result-net",
            "result-adv-rate"
        ],
        jsChecks: [
            ...START_GAME_CHECKS,
            ...SEEDED_SAVE_CHECKS,
            { label: "final balance metric", pattern: jsField("finalBalance") },
            { label: "total net metric", pattern: jsField("totalNet") },
            { label: "advantageous rate metric", pattern: jsField("advantageousRate") }
        ]
    },
    {
        name: "Hanoi",
        html: "hanoi.html",
        js: "hanoi.js",
        sharedScripts: [TRAINING_RESULTS],
        domIds: [
            "moves",
            "optimal",
            "time",
            "start-screen",
            "hanoi-panel",
            "disk-count",
            "restart-btn",
            "undo-btn",
            "redo-btn",
            "hint",
            "result-modal",
            "result-moves",
            "result-optimal",
            "result-efficiency"
        ],
        jsChecks: [
            ...START_GAME_CHECKS,
            ...SAVE_CHECKS,
            { label: "moves metric", pattern: jsField("moves") },
            { label: "optimal metric", pattern: jsField("optimal") },
            { label: "efficiency metric", pattern: jsField("efficiency") },
            { label: "disk count metric", pattern: jsField("disks") }
        ]
    },
    {
        name: "Report",
        html: "report.html",
        js: "report.js",
        sharedScripts: [TRAINING_RESULTS, ATTENTION_PROFILE],
        domIds: [
            "selected-date-text",
            "date-picker",
            "today-btn",
            "clear-btn",
            "total-sessions",
            "unique-games",
            "total-duration",
            "avg-duration",
            "sessions-body",
            "empty-hint",
            "attention-system-summary",
            "attention-profile-chips",
            "attention-prescription-list"
        ],
        jsChecks: [
            { label: "DOMContentLoaded boot", pattern: /addEventListener\s*\(\s*["']DOMContentLoaded["']\s*,\s*init\s*\)/ },
            { label: "TrainingResults read access", pattern: /window\.TrainingResults|TrainingResults/ },
            { label: "daily overview read", pattern: /getDailyOverview/ },
            { label: "sessions by date read", pattern: /getSessionsByDate/ },
            { label: "module metric groups", pattern: /MODULE_METRIC_KEY_GROUPS/ },
            { label: "metrics rendering", pattern: /metricsText/ },
            { label: "seed display support", pattern: jsWord("seed") },
            { label: "content version display support", pattern: jsWord("contentVersion") },
            { label: "AttentionProfile read access", pattern: /AttentionProfile/ },
            { label: "attention session aggregation", pattern: /aggregateAttentionSessions/ },
            { label: "attention summary binding", pattern: /attention-system-summary/ },
            { label: "attention chips binding", pattern: /attention-profile-chips/ },
            { label: "attention prescription binding", pattern: /attention-prescription-list/ }
        ]
    },
    {
        name: "Daily Plan",
        html: "daily-plan.html",
        js: "daily-plan.js",
        optionalMissing: true,
        sharedScripts: [TRAINING_RESULTS],
        domIds: [],
        jsChecks: [
            { label: "browser boot entry", pattern: /DOMContentLoaded|window\.onload|function\s+init|function\s+start/ },
            { label: "TrainingResults access", pattern: /TrainingResults/ }
        ]
    }
];

function normalizeLocalRef(ref) {
    const value = String(ref || "").trim();
    if (!value) return null;
    if (/^(?:[a-z]+:)?\/\//i.test(value)) return null;
    if (/^(?:data|mailto|tel|javascript):/i.test(value)) return null;
    if (value.startsWith("#")) return null;

    const withoutHash = value.split("#")[0];
    const withoutQuery = withoutHash.split("?")[0];
    if (!withoutQuery) return null;

    const normalized = path.posix.normalize(withoutQuery.replace(/^\/+/, "").replace(/\\/g, "/"));
    if (normalized === "." || normalized.startsWith("../") || path.isAbsolute(normalized)) {
        return null;
    }
    return normalized;
}

function filePath(relativePath) {
    return path.join(ROOT, relativePath);
}

function isFile(relativePath) {
    try {
        return fs.statSync(filePath(relativePath)).isFile();
    } catch (_error) {
        return false;
    }
}

function readUtf8(relativePath, issues, label) {
    try {
        return fs.readFileSync(filePath(relativePath), "utf8");
    } catch (error) {
        issues.push(`${label} not readable: ${relativePath} (${error.message})`);
        return "";
    }
}

function extractScriptRefs(html) {
    const refs = [];
    const regex = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = regex.exec(html))) {
        const normalized = normalizeLocalRef(match[1]);
        if (normalized) refs.push(normalized);
    }
    return refs;
}

function extractIds(html) {
    const ids = new Set();
    const regex = /\bid\s*=\s*["']([^"']+)["']/gi;
    let match;
    while ((match = regex.exec(html))) {
        ids.add(match[1]);
    }
    return ids;
}

function requiredScriptsFor(flow) {
    return [...flow.sharedScripts, flow.js].map(normalizeLocalRef).filter(Boolean);
}

function checkScripts(flow, html, issues) {
    const scriptRefs = extractScriptRefs(html);
    const requiredScripts = requiredScriptsFor(flow);
    const mainIndex = scriptRefs.indexOf(normalizeLocalRef(flow.js));

    requiredScripts.forEach((script) => {
        if (!scriptRefs.includes(script)) {
            issues.push(`missing script reference: ${script}`);
        }
        if (!isFile(script)) {
            issues.push(`missing script file: ${script}`);
        }
    });

    if (mainIndex === -1) {
        return;
    }

    flow.sharedScripts.map(normalizeLocalRef).filter(Boolean).forEach((script) => {
        const scriptIndex = scriptRefs.indexOf(script);
        if (scriptIndex !== -1 && scriptIndex > mainIndex) {
            issues.push(`shared script loads after main script: ${script}`);
        }
    });
}

function checkDomIds(flow, html, issues) {
    const ids = extractIds(html);
    flow.domIds.forEach((id) => {
        if (!ids.has(id)) {
            issues.push(`missing DOM id: #${id}`);
        }
    });

    if (flow.optionalMissing && ids.size === 0) {
        issues.push("no DOM ids found in optional page");
    }
}

function checkJs(flow, js, issues) {
    flow.jsChecks.forEach((check) => {
        if (!check.pattern.test(js)) {
            issues.push(`missing JS check: ${check.label}`);
        }
    });
}

function checkFlow(flow) {
    const issues = [];
    const htmlExists = isFile(flow.html);
    const jsExists = isFile(flow.js);

    if (flow.optionalMissing && !htmlExists && !jsExists) {
        return {
            name: flow.name,
            status: "pass",
            optionalMissing: true,
            issues
        };
    }

    if (!htmlExists) {
        issues.push(`missing HTML file: ${flow.html}`);
    }
    if (!jsExists) {
        issues.push(`missing JS file: ${flow.js}`);
    }

    const html = htmlExists ? readUtf8(flow.html, issues, "HTML") : "";
    const js = jsExists ? readUtf8(flow.js, issues, "JS") : "";

    if (html) {
        checkScripts(flow, html, issues);
        checkDomIds(flow, html, issues);
    }
    if (js) {
        checkJs(flow, js, issues);
    }

    return {
        name: flow.name,
        status: issues.length === 0 ? "pass" : "fail",
        optionalMissing: false,
        issues
    };
}

function main() {
    const results = FLOWS.map(checkFlow);
    let failed = 0;

    results.forEach((result) => {
        if (result.status === "pass") {
            const suffix = result.optionalMissing ? " (optional: files not present yet)" : "";
            console.log(`[PASS] ${result.name}${suffix}`);
            return;
        }

        failed += 1;
        console.log(`[FAIL] ${result.name}`);
        result.issues.forEach((issue) => {
            console.log(`  - ${issue}`);
        });
    });

    const passed = results.length - failed;
    console.log(`Summary: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exitCode = 1;
    }
}

main();
