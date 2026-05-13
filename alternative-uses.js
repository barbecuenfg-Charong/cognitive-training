const MODULE_ID = "alternative-uses";
const GAME_NAME = "替代用途测验";
const CONTENT_VERSION = "alternative-uses-training-feedback-v3";
const ROUND_SECONDS = 60;
const ROUND_COUNT = 3;
const ORIGINALITY_HEURISTIC_METHOD = "valid-use-rare-category-plus-elaboration";
const ORIGINALITY_HEURISTIC_NOTE = "originalityHeuristic 只标记本轮类别稀有且细节较充分的回答，用于练习反馈，不是标准化创造力或常模分数。";

const ALL_PROMPTS = [
    {
        id: "aut-brick-home",
        baseObject: "砖头",
        variant: "家庭场景",
        text: "砖头（家庭场景）",
        difficulty: "easy"
    },
    {
        id: "aut-brick-outdoor",
        baseObject: "砖头",
        variant: "户外/临时工具",
        text: "砖头（户外或临时工具）",
        difficulty: "medium"
    },
    {
        id: "aut-paperclip-office",
        baseObject: "回形针",
        variant: "办公/维修",
        text: "回形针（办公或维修）",
        difficulty: "easy"
    },
    {
        id: "aut-paperclip-travel",
        baseObject: "回形针",
        variant: "旅行/应急",
        text: "回形针（旅行或应急）",
        difficulty: "medium"
    },
    {
        id: "aut-bottle-home",
        baseObject: "塑料瓶",
        variant: "家庭改造",
        text: "塑料瓶（家庭改造）",
        difficulty: "easy"
    },
    {
        id: "aut-bottle-garden",
        baseObject: "塑料瓶",
        variant: "园艺/户外",
        text: "塑料瓶（园艺或户外）",
        difficulty: "medium"
    },
    {
        id: "aut-cardboard-education",
        baseObject: "纸板",
        variant: "学习/游戏",
        text: "纸板（学习或游戏）",
        difficulty: "medium"
    },
    {
        id: "aut-towel-emergency",
        baseObject: "毛巾",
        variant: "应急/旅行",
        text: "毛巾（应急或旅行）",
        difficulty: "medium"
    }
];

const CATEGORY_PATTERNS = [
    { id: "fastening", label: "固定/连接", pattern: /夹|固定|绑|扎|挂|扣|连接|支架|支撑|缠|绕|线|绳|clip|tie/i },
    { id: "tool", label: "工具/加工", pattern: /锤|撬|刮|量|压|打|敲|切|铲|勺|工具|修|维修|开锁|tool/i },
    { id: "container", label: "容器/收纳", pattern: /装|收纳|容器|瓶|盒|杯|存|盛|储|漏斗|篮|袋|container|storage/i },
    { id: "weight-barrier", label: "重物/阻隔", pattern: /压|门挡|镇|重物|垫|阻|挡|隔|堵|防滑|weight|stopper/i },
    { id: "art-decor", label: "手工/装饰", pattern: /画|雕|装饰|手工|模型|玩具|摆件|拼贴|艺术|craft|decor/i },
    { id: "cleaning-filter", label: "清洁/过滤", pattern: /擦|刷|清洁|过滤|吸|扫|沥|筛|拖|clean|filter/i },
    { id: "safety-emergency", label: "安全/应急", pattern: /急救|警示|反光|灭火|求救|防护|止血|防晒|避雨|安全|emergency|safety/i },
    { id: "learning-play", label: "学习/游戏", pattern: /教|实验|游戏|练习|演示|拼|计数|道具|课堂|game|learn/i },
    { id: "garden-nature", label: "园艺/自然", pattern: /种|盆栽|浇水|育苗|花|园|土|鸟|植物|garden|plant/i }
];

const VAGUE_RESPONSES = new Set([
    "用",
    "玩",
    "东西",
    "工具",
    "好用",
    "不知道",
    "随便",
    "其他",
    "很多",
    "用途",
    "使用"
]);

let round = 0;
let timeLeft = ROUND_SECONDS;
let timer = null;
let trialLog = [];
let sessionStartedAt = null;
let sessionSeed = "";
let sessionPrompts = [];
let promptOrder = [];
let roundStartedAtMs = 0;
let sessionSaved = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("aut-panel");
const resultModal = document.getElementById("result-modal");
const promptText = document.getElementById("prompt-text");
const usesInput = document.getElementById("uses-input");

function nowMs() {
    return window.performance && typeof window.performance.now === "function"
        ? window.performance.now()
        : Date.now();
}

function roundMetric(value, digits = 3) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function parseRawLines(text) {
    return String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim());
}

function normalizeUse(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/[，。！？、,.!?;；:\s]+/g, "");
}

function tokenize(list) {
    return list
        .join(" ")
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fa5]+/)
        .filter(Boolean);
}

function categoryForUse(text) {
    const matched = CATEGORY_PATTERNS.filter((category) => category.pattern.test(text));
    if (matched.length === 0) {
        return [{ id: "uncategorized", label: "未归类" }];
    }
    return matched.map((category) => ({ id: category.id, label: category.label }));
}

function isVagueUse(text, normalized) {
    if (!normalized) {
        return true;
    }
    if (VAGUE_RESPONSES.has(normalized)) {
        return true;
    }
    return normalized.length <= 1 || /^用来?(做)?(东西|工具|玩)?$/.test(normalized);
}

function elaborationSignals(text) {
    const normalized = normalizeUse(text);
    return {
        hasConcreteContext: /门|桌|线|厨房|户外|旅行|课堂|花园|车|包|墙|鞋|窗|水|电|手机/.test(text),
        hasActionPurpose: /用来|作为|临时|防止|固定|改成|制作|帮助|替代|支撑|保护/.test(text),
        hasSpecificDetail: normalized.length >= 6
    };
}

function elaborationScore(text) {
    const signals = elaborationSignals(text);
    return Object.values(signals).filter(Boolean).length;
}

function compactAnswer(entry) {
    return {
        lineIndex: entry.lineIndex,
        text: entry.text,
        normalized: entry.normalized
    };
}

function buildOriginalityHeuristic(entries, validEntries, categoryFrequency) {
    const flaggedEntries = validEntries.filter((entry) => {
        const hasRareCategory = entry.categories.some((category) => categoryFrequency[category.id] === 1);
        return hasRareCategory && entry.elaborationScore >= 2;
    });
    const flaggedIndexes = new Set(flaggedEntries.map((entry) => entry.lineIndex));

    entries.forEach((entry) => {
        entry.originalityHeuristic = flaggedIndexes.has(entry.lineIndex);
    });

    return {
        nonStandardizedScoring: true,
        method: ORIGINALITY_HEURISTIC_METHOD,
        note: ORIGINALITY_HEURISTIC_NOTE,
        count: flaggedEntries.length,
        rate: validEntries.length === 0
            ? 0
            : roundMetric(flaggedEntries.length / validEntries.length, 3),
        flaggedAnswers: flaggedEntries.map(compactAnswer)
    };
}

function analyzeUses(rawText) {
    const rawLines = parseRawLines(rawText);
    const seen = new Set();
    const entries = rawLines.map((text, lineIndex) => {
        const normalized = normalizeUse(text);
        const isBlank = !normalized;
        const duplicate = normalized ? seen.has(normalized) : false;
        if (normalized) {
            seen.add(normalized);
        }
        const vague = isVagueUse(text, normalized);
        const categories = isBlank ? [] : categoryForUse(text);
        const validForPractice = !isBlank && !duplicate && !vague;
        return {
            lineIndex,
            text,
            normalized,
            isBlank,
            duplicate,
            vague,
            categories,
            elaborationSignals: elaborationSignals(text),
            elaborationScore: validForPractice ? elaborationScore(text) : 0,
            validForPractice
        };
    });
    const validEntries = entries.filter((entry) => entry.validForPractice);
    const categoryIds = new Set();
    validEntries.forEach((entry) => {
        entry.categories.forEach((category) => {
            if (category.id !== "uncategorized" || entry.categories.length === 1) {
                categoryIds.add(category.id);
            }
        });
    });
    const categoryLabels = Array.from(new Set(
        validEntries.flatMap((entry) => entry.categories.map((category) => category.label))
    ));
    const categoryFrequency = validEntries.reduce((result, entry) => {
        entry.categories.forEach((category) => {
            result[category.id] = (result[category.id] || 0) + 1;
        });
        return result;
    }, {});
    const originalityHeuristic = buildOriginalityHeuristic(entries, validEntries, categoryFrequency);
    const duplicateAnswers = entries.filter((entry) => entry.duplicate).map(compactAnswer);
    const vagueAnswers = entries.filter((entry) => entry.vague && !entry.isBlank).map(compactAnswer);

    return {
        entries,
        rawAnswerCount: rawLines.filter((line) => line).length,
        blankLineCount: entries.filter((entry) => entry.isBlank).length,
        duplicateCount: duplicateAnswers.length,
        duplicateAnswers,
        vagueCount: vagueAnswers.length,
        vagueAnswers,
        validUseCount: validEntries.length,
        categoryCount: categoryIds.size,
        categoryLabels,
        meanElaboration: validEntries.length === 0
            ? 0
            : roundMetric(validEntries.reduce((sum, entry) => sum + entry.elaborationScore, 0) / validEntries.length, 2),
        originalityHeuristic,
        nonStandardizedScoring: true
    };
}

function currentUsesCount() {
    return parseRawLines(usesInput.value).filter((line) => line).length;
}

function updateBoard() {
    document.getElementById("round").textContent = String(Math.min(round + 1, sessionPrompts.length));
    document.getElementById("time").textContent = `${timeLeft}s`;
    document.getElementById("uses-count").textContent = String(currentUsesCount());
}

function buildSessionPrompts() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed(MODULE_ID) : `${MODULE_ID}-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(`${sessionSeed}:${CONTENT_VERSION}`) : Math.random;
    sessionPrompts = seeded
        ? seeded.pickShuffled(ALL_PROMPTS, rng, ROUND_COUNT)
        : ALL_PROMPTS.slice(0, ROUND_COUNT);
    promptOrder = sessionPrompts.map((item) => item.id);
}

function loadRound() {
    const prompt = sessionPrompts[round];
    if (!prompt) {
        finish();
        return;
    }
    promptText.textContent = prompt.text;
    usesInput.value = "";
    timeLeft = ROUND_SECONDS;
    roundStartedAtMs = nowMs();
    updateBoard();
    usesInput.focus();
}

function nextRound() {
    if (round >= sessionPrompts.length || sessionSaved) {
        return;
    }

    const prompt = sessionPrompts[round];
    const analysis = analyzeUses(usesInput.value);
    trialLog.push({
        trialIndex: round,
        promptId: prompt.id,
        baseObject: prompt.baseObject,
        promptVariant: prompt.variant,
        promptText: prompt.text,
        difficulty: prompt.difficulty,
        timeLimitSec: ROUND_SECONDS,
        rtMs: Math.max(0, Math.round(nowMs() - roundStartedAtMs)),
        rawResponseText: usesInput.value,
        rawAnswerCount: analysis.rawAnswerCount,
        validUseCount: analysis.validUseCount,
        fluency: analysis.validUseCount,
        flexibility: analysis.categoryCount,
        categoryCount: analysis.categoryCount,
        categoryLabels: analysis.categoryLabels,
        duplicateCount: analysis.duplicateCount,
        duplicateAnswers: analysis.duplicateAnswers,
        blankLineCount: analysis.blankLineCount,
        vagueCount: analysis.vagueCount,
        vagueAnswers: analysis.vagueAnswers,
        meanElaboration: analysis.meanElaboration,
        elaboration: analysis.meanElaboration,
        originalityHeuristic: analysis.originalityHeuristic,
        nonStandardizedScoring: true,
        answers: analysis.entries,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    });

    round += 1;
    if (round >= sessionPrompts.length) {
        finish();
        return;
    }
    loadRound();
}

function buildNextPracticeRecommendation(summary) {
    if (summary.validUseCount < 8) {
        return {
            level: "increase-fluency",
            text: "下一轮先把目标设为每题至少 4 个有效用途，再追求新颖性。"
        };
    }
    if (summary.flexibility < 4) {
        return {
            level: "increase-flexibility",
            text: "下一轮每写 2 个用途就主动换一个类别，例如工具、收纳、应急、游戏。"
        };
    }
    if (summary.duplicateCount + summary.vagueCount >= 3) {
        return {
            level: "reduce-repetition",
            text: "下一轮先检查是否只是换词复述，尽量写清具体场景和动作。"
        };
    }
    if (summary.meanElaboration < 1.8) {
        return {
            level: "increase-elaboration",
            text: "下一轮保留当前速度，但把每个用途写成“场景 + 动作 + 目的”。"
        };
    }
    return {
        level: "increase-distance",
        text: "下一轮可以换更陌生的物品变体，继续扩展类别跨度。"
    };
}

function buildSummary() {
    const validUseCount = trialLog.reduce((sum, item) => sum + item.validUseCount, 0);
    const rawAnswerCount = trialLog.reduce((sum, item) => sum + item.rawAnswerCount, 0);
    const duplicateCount = trialLog.reduce((sum, item) => sum + item.duplicateCount, 0);
    const blankLineCount = trialLog.reduce((sum, item) => sum + item.blankLineCount, 0);
    const vagueCount = trialLog.reduce((sum, item) => sum + item.vagueCount, 0);
    const categories = new Set(trialLog.flatMap((item) => item.categoryLabels));
    const duplicateAnswers = trialLog.flatMap((trial) => trial.duplicateAnswers.map((answer) => ({
        ...answer,
        trialIndex: trial.trialIndex,
        promptId: trial.promptId
    })));
    const vagueAnswers = trialLog.flatMap((trial) => trial.vagueAnswers.map((answer) => ({
        ...answer,
        trialIndex: trial.trialIndex,
        promptId: trial.promptId
    })));
    const elaborationTotal = trialLog.reduce(
        (sum, item) => sum + (item.meanElaboration * item.validUseCount),
        0
    );
    const meanElaboration = validUseCount === 0
        ? 0
        : roundMetric(elaborationTotal / validUseCount, 2);
    const originalityHeuristicCount = trialLog.reduce((sum, item) => sum + item.originalityHeuristic.count, 0);
    const originalityHeuristic = {
        nonStandardizedScoring: true,
        method: ORIGINALITY_HEURISTIC_METHOD,
        note: ORIGINALITY_HEURISTIC_NOTE,
        count: originalityHeuristicCount,
        rate: validUseCount === 0
            ? 0
            : roundMetric(originalityHeuristicCount / validUseCount, 3),
        byTrial: trialLog.map((trial) => ({
            trialIndex: trial.trialIndex,
            promptId: trial.promptId,
            count: trial.originalityHeuristic.count,
            rate: trial.originalityHeuristic.rate,
            flaggedAnswers: trial.originalityHeuristic.flaggedAnswers
        }))
    };
    const summary = {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        nonStandardizedScoring: true,
        promptOrder,
        promptVariants: sessionPrompts.map((item) => ({
            id: item.id,
            baseObject: item.baseObject,
            variant: item.variant,
            difficulty: item.difficulty
        })),
        totalPrompts: sessionPrompts.length,
        rawAnswerCount,
        validUseCount,
        answerCount: rawAnswerCount,
        fluency: validUseCount,
        flexibility: categories.size,
        categoryCount: categories.size,
        categoryLabels: Array.from(categories),
        duplicateCount,
        duplicateAnswers,
        blankLineCount,
        vagueCount,
        vagueAnswers,
        meanElaboration,
        elaboration: meanElaboration,
        originalityHeuristic,
        originalityBoundary: ORIGINALITY_HEURISTIC_NOTE
    };
    summary.nextPracticeRecommendation = buildNextPracticeRecommendation(summary);
    return summary;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function saveTrainingSession(finishedAt, summary) {
    if (sessionSaved || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") {
        return;
    }
    const startedAt = sessionStartedAt || finishedAt;
    window.TrainingResults.saveSession({
        moduleId: MODULE_ID,
        gameId: MODULE_ID,
        gameName: GAME_NAME,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        score: summary.fluency,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        nonStandardizedScoring: true,
        summary,
        trials: trialLog.map((trial) => ({ ...trial })),
        metrics: {
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            nonStandardizedScoring: true,
            fluency: summary.fluency,
            flexibility: summary.flexibility,
            categoryCount: summary.categoryCount,
            duplicateCount: summary.duplicateCount,
            duplicateAnswers: summary.duplicateAnswers,
            blankLineCount: summary.blankLineCount,
            vagueCount: summary.vagueCount,
            vagueAnswers: summary.vagueAnswers,
            meanElaboration: summary.meanElaboration,
            elaboration: summary.elaboration,
            originalityHeuristic: summary.originalityHeuristic,
            originalityBoundary: summary.originalityBoundary,
            nextPracticeRecommendation: summary.nextPracticeRecommendation
        },
        tags: ["creativity", "divergent-thinking", "practice-feedback"]
    });
    sessionSaved = true;
}

function finish() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    const finishedAt = new Date();
    const summary = buildSummary();

    setText("result-fluency", String(summary.fluency));
    setText("result-diversity", `${summary.flexibility} 类`);
    setText("result-length", String(summary.meanElaboration));
    setText("result-note", `${summary.originalityBoundary} ${summary.nextPracticeRecommendation.text}`);

    saveTrainingSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    round = 0;
    trialLog = [];
    sessionStartedAt = new Date();
    sessionSaved = false;
    buildSessionPrompts();

    if (timer) {
        clearInterval(timer);
    }
    timer = setInterval(() => {
        timeLeft -= 1;
        updateBoard();
        if (timeLeft <= 0) {
            nextRound();
        }
    }, 1000);

    loadRound();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

document.getElementById("next-btn").addEventListener("click", nextRound);
usesInput.addEventListener("input", () => {
    document.getElementById("uses-count").textContent = String(currentUsesCount());
});

window.startGame = startGame;
