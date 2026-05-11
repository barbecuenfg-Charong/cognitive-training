const MODULE_ID = "wisconsin-card";
const GAME_NAME = "威斯康星卡片分类";
const CONTENT_VERSION = "wisconsin-card-wcst-seeded-v2";

const TOTAL_TRIALS = 36;
const SWITCH_STREAK = 6;
const SET_LOSS_STREAK = 4;
const RULES = ["color", "shape", "count"];
const COLORS = ["red", "green", "blue", "yellow"];
const SHAPES = ["circle", "triangle", "square", "star"];
const COUNTS = [1, 2, 3, 4];

const TARGET_CARDS = [
    { id: "deck-1", color: "red", shape: "circle", count: 1 },
    { id: "deck-2", color: "green", shape: "triangle", count: 2 },
    { id: "deck-3", color: "blue", shape: "square", count: 3 },
    { id: "deck-4", color: "yellow", shape: "star", count: 4 }
];

let hiddenRule = "color";
let previousRule = null;
let trial = 0;
let correctCount = 0;
let errorCount = 0;
let streak = 0;
let categoriesCompleted = 0;
let perseverativeResponses = 0;
let perseverativeErrors = 0;
let setLosses = 0;
let stimulus = null;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionRng = null;
let trialPlan = [];
let rulePlan = [];
let trialLog = [];
let ruleChangeEvents = [];
let trialStartedAtMs = 0;
let hasSavedSession = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("wcst-panel");
const resultModal = document.getElementById("result-modal");
const stimulusCard = document.getElementById("stimulus-card");
const targetGrid = document.getElementById("target-grid");
const feedback = document.getElementById("feedback");

function fallbackHashString(value) {
    const text = String(value || "");
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function fallbackMulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomToken() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const bytes = new Uint32Array(2);
        window.crypto.getRandomValues(bytes);
        return `${bytes[0].toString(36)}${bytes[1].toString(36)}`;
    }
    return Math.floor(Math.random() * 1e9).toString(36);
}

function createSessionSeed() {
    if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === "function") {
        return window.SeededRandom.createSessionSeed(MODULE_ID);
    }

    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get("seed");
    if (urlSeed && urlSeed.trim()) {
        return urlSeed.trim();
    }
    return `${MODULE_ID}-${Date.now().toString(36)}-${randomToken()}`;
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return fallbackMulberry32(fallbackHashString(seed));
}

function shuffle(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function pick(list, rng = sessionRng) {
    return list[Math.floor(rng() * list.length)];
}

function shapeChar(shape) {
    if (shape === "circle") {
        return "●";
    }
    if (shape === "triangle") {
        return "▲";
    }
    if (shape === "square") {
        return "■";
    }
    return "★";
}

function colorLabel(color) {
    if (color === "red") {
        return "红";
    }
    if (color === "green") {
        return "绿";
    }
    if (color === "blue") {
        return "蓝";
    }
    return "黄";
}

function shapeLabel(shape) {
    if (shape === "circle") {
        return "圆形";
    }
    if (shape === "triangle") {
        return "三角";
    }
    if (shape === "square") {
        return "方形";
    }
    return "星形";
}

function cardHtml(card) {
    const symbols = Array.from({ length: card.count }, () => shapeChar(card.shape))
        .map((symbol) => `<span style="color:${card.color};">${symbol}</span>`)
        .join("");
    return `
        <div class="wcst-symbols">${symbols}</div>
        <div style="font-size:0.9rem;color:#7f8c8d;">${colorLabel(card.color)} | ${shapeLabel(card.shape)} | ${card.count}</div>
    `;
}

function copyCard(card) {
    return {
        color: card.color,
        shape: card.shape,
        count: card.count
    };
}

function isMatch(cardA, cardB, rule) {
    return cardA[rule] === cardB[rule];
}

function findTargetIndexForRule(card, rule) {
    return TARGET_CARDS.findIndex((target) => isMatch(target, card, rule));
}

function buildRuleTargets(card) {
    return RULES.reduce((targets, rule) => {
        const targetIndex = findTargetIndexForRule(card, rule);
        targets[rule] = {
            targetIndex,
            selectedDeck: TARGET_CARDS[targetIndex].id
        };
        return targets;
    }, {});
}

function generateDiscriminatingCard(rng, previousCard) {
    let card = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const indexes = shuffle([0, 1, 2, 3], rng);
        card = {
            color: COLORS[indexes[0]],
            shape: SHAPES[indexes[1]],
            count: COUNTS[indexes[2]]
        };

        if (!previousCard
            || card.color !== previousCard.color
            || card.shape !== previousCard.shape
            || card.count !== previousCard.count) {
            return card;
        }
    }
    return card;
}

function generateTrialPlan(seed) {
    const rng = createRng(`${seed}:${CONTENT_VERSION}:cards`);
    const list = [];
    let previousCard = null;

    for (let i = 0; i < TOTAL_TRIALS; i += 1) {
        const card = generateDiscriminatingCard(rng, previousCard);
        list.push({
            trialIndex: i,
            card,
            ruleTargets: buildRuleTargets(card)
        });
        previousCard = card;
    }

    return list;
}

function generateRulePlan(seed) {
    const rng = createRng(`${seed}:${CONTENT_VERSION}:rules`);
    const maxCategories = Math.ceil(TOTAL_TRIALS / SWITCH_STREAK) + 2;
    const rules = [pick(RULES, rng)];

    while (rules.length < maxCategories) {
        const currentRule = rules[rules.length - 1];
        const candidates = RULES.filter((rule) => rule !== currentRule);
        rules.push(pick(candidates, rng));
    }

    return rules;
}

function nowMs() {
    if (window.performance && typeof window.performance.now === "function") {
        return window.performance.now();
    }
    return Date.now();
}

function roundTo(value, digits = 3) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function setFeedback(message, kind = "") {
    feedback.textContent = message;
    feedback.className = kind ? `wcst-feedback ${kind}` : "wcst-feedback";
}

function updateBoard() {
    const acc = trial === 0 ? 0 : Math.round((correctCount / trial) * 100);
    document.getElementById("trial").textContent = String(trial);
    document.getElementById("acc").textContent = `${acc}%`;
    document.getElementById("categories").textContent = String(categoriesCompleted);
}

function renderStimulus() {
    stimulusCard.innerHTML = cardHtml(stimulus);
}

function renderTargets() {
    targetGrid.innerHTML = "";
    TARGET_CARDS.forEach((card, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "wcst-target";
        button.innerHTML = cardHtml(card);
        button.addEventListener("click", () => onChoose(index));
        targetGrid.appendChild(button);
    });
}

function loadTrialStimulus() {
    stimulus = trialPlan[trial].card;
    renderStimulus();
    trialStartedAtMs = nowMs();
}

function buildRuleChangeEvent(fromRule, toRule, completedTrialIndex) {
    return {
        afterTrialIndex: completedTrialIndex,
        afterTrialNumber: completedTrialIndex + 1,
        ruleSwitchIndex: completedTrialIndex + 1,
        ruleSwitchTrialNumber: completedTrialIndex + 2,
        from: fromRule,
        to: toRule,
        categoryCompleted: categoriesCompleted,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    };
}

function onChoose(targetIndex) {
    if (trial >= TOTAL_TRIALS) {
        return;
    }

    const trialIndex = trial;
    const plan = trialPlan[trialIndex];
    const card = plan.card;
    const target = TARGET_CARDS[targetIndex];
    const ruleBefore = hiddenRule;
    const categoryIndex = categoriesCompleted;
    const streakBefore = streak;
    const rtMs = Math.max(0, Math.round(nowMs() - trialStartedAtMs));
    const correct = isMatch(target, card, ruleBefore);
    const selectedRuleMatches = RULES.filter((rule) => isMatch(target, card, rule));
    const isPerseverative = previousRule !== null
        && previousRule !== ruleBefore
        && isMatch(target, card, previousRule);
    const isSetLoss = !correct && streakBefore >= SET_LOSS_STREAK;

    let feedbackText = "正确";
    let feedbackKind = "correct";
    let ruleAfter = ruleBefore;
    let ruleChange = null;

    if (isPerseverative) {
        perseverativeResponses += 1;
    }

    if (correct) {
        correctCount += 1;
        streak += 1;
    } else {
        errorCount += 1;
        streak = 0;

        if (isPerseverative) {
            perseverativeErrors += 1;
            feedbackText = "持续错误：你仍像在使用上一条规则，请换一个分类维度。";
            feedbackKind = "perseverative";
        } else {
            feedbackText = isSetLoss
                ? "错误：你刚刚丢失了已建立的规则线索，请重新稳定当前策略。"
                : "错误：当前隐藏规则不是这次选择对应的维度。";
            feedbackKind = "error";
        }

        if (isSetLoss) {
            setLosses += 1;
        }
    }

    trial += 1;

    if (correct && streak >= SWITCH_STREAK) {
        categoriesCompleted += 1;
        streak = 0;
        if (trial < TOTAL_TRIALS) {
            const oldRule = hiddenRule;
            previousRule = oldRule;
            hiddenRule = rulePlan[categoriesCompleted] || pick(RULES.filter((rule) => rule !== oldRule));
            ruleAfter = hiddenRule;
            ruleChange = buildRuleChangeEvent(oldRule, hiddenRule, trialIndex);
            ruleChangeEvents.push(ruleChange);
            feedbackText = "正确。规则已经改变，请重新发现分类维度。";
            feedbackKind = "shift";
        } else {
            feedbackText = "正确，完成一个分类。";
            feedbackKind = "correct";
        }
    }

    trialLog.push({
        index: trialIndex,
        trialIndex,
        trialNumber: trialIndex + 1,
        card: copyCard(card),
        selectedDeck: target.id,
        targetIndex,
        target: copyCard(target),
        hiddenRule: ruleBefore,
        correct,
        feedback: feedbackText,
        isPerseverative,
        isPerseverativeError: !correct && isPerseverative,
        rtMs,
        categoryIndex,
        ruleBefore,
        ruleAfter,
        ruleTargets: plan.ruleTargets,
        selectedRuleMatches,
        streakBefore,
        streakAfter: streak,
        isSetLoss,
        ruleChange
    });

    setFeedback(feedbackText, feedbackKind);
    updateBoard();

    if (trial >= TOTAL_TRIALS) {
        finish();
        return;
    }

    loadTrialStimulus();
}

function buildSummary() {
    const trialsCompleted = trialLog.length;
    const ordinaryErrors = errorCount - perseverativeErrors;
    const accuracy = trialsCompleted === 0 ? 0 : correctCount / trialsCompleted;
    const perseverativeErrorRate = errorCount === 0 ? 0 : perseverativeErrors / errorCount;
    const appliedRuleOrder = [
        rulePlan[0],
        ...ruleChangeEvents.map((event) => event.to)
    ].filter(Boolean);

    return {
        trialsCompleted,
        correctCount,
        errorCount,
        ordinaryErrors,
        categoriesCompleted,
        perseverativeResponses,
        perseverativeErrors,
        perseverativeErrorRate: roundTo(perseverativeErrorRate),
        setLosses,
        accuracy: roundTo(accuracy),
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        hiddenRuleStart: rulePlan[0],
        ruleOrder: appliedRuleOrder,
        ruleSwitchIndices: ruleChangeEvents.map((event) => event.ruleSwitchIndex),
        ruleChangeEvents: ruleChangeEvents.map((event) => ({ ...event }))
    };
}

function resultMessage(summary) {
    if (summary.perseverativeErrors > summary.ordinaryErrors) {
        return "主要错误来自持续沿用旧规则；下一轮重点是在连续反馈改变后主动切换维度。";
    }
    if (summary.setLosses > 0) {
        return "出现了集合维持丢失：已经找到线索后仍有中途偏离。下一轮先稳定当前规则，再等待明确错误反馈。";
    }
    if (summary.categoriesCompleted >= 4) {
        return "规则发现和转换表现较稳定，错误主要是普通探索错误。";
    }
    return "普通错误较多，说明当前轮仍在规则发现阶段。下一轮可以更系统地测试颜色、形状和数量三个维度。";
}

function saveTrainingSession(finishedAt, summary) {
    if (hasSavedSession || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") {
        return;
    }

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

    window.TrainingResults.saveSession({
        moduleId: MODULE_ID,
        gameId: MODULE_ID,
        gameName: GAME_NAME,
        startedAt,
        finishedAt,
        durationMs,
        score: correctCount,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        summary,
        trials: trialLog.map((item) => ({ ...item })),
        metrics: {
            trialsCompleted: summary.trialsCompleted,
            correctCount: summary.correctCount,
            errorCount: summary.errorCount,
            categoriesCompleted: summary.categoriesCompleted,
            perseverativeResponses: summary.perseverativeResponses,
            perseverativeErrors: summary.perseverativeErrors,
            perseverativeErrorRate: summary.perseverativeErrorRate,
            setLosses: summary.setLosses,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            accuracy: summary.accuracy,
            ordinaryErrors: summary.ordinaryErrors
        },
        tags: ["executive-function", "wcst", "set-shifting", "rule-discovery"]
    });

    hasSavedSession = true;
}

function finish() {
    const finishedAt = new Date();
    const summary = buildSummary();

    document.getElementById("result-acc").textContent = formatPercent(summary.accuracy);
    document.getElementById("result-categories").textContent = String(summary.categoriesCompleted);
    document.getElementById("result-errors").textContent = `${summary.errorCount}（普通 ${summary.ordinaryErrors}，持续 ${summary.perseverativeErrors}）`;
    document.getElementById("result-persev").textContent = `${summary.perseverativeErrors} (${formatPercent(summary.perseverativeErrorRate)})`;
    document.getElementById("result-set-losses").textContent = String(summary.setLosses);
    document.getElementById("result-seed").textContent = sessionSeed;
    document.getElementById("result-feedback").textContent = resultMessage(summary);

    saveTrainingSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    sessionSeed = createSessionSeed();
    sessionRng = createRng(`${sessionSeed}:${CONTENT_VERSION}:session`);
    trialPlan = generateTrialPlan(sessionSeed);
    rulePlan = generateRulePlan(sessionSeed);
    hiddenRule = rulePlan[0];
    previousRule = null;
    trial = 0;
    correctCount = 0;
    errorCount = 0;
    streak = 0;
    categoriesCompleted = 0;
    perseverativeResponses = 0;
    perseverativeErrors = 0;
    setLosses = 0;
    trialLog = [];
    ruleChangeEvents = [];
    sessionStartedAt = new Date();
    hasSavedSession = false;

    setFeedback("根据反馈寻找当前规则。");
    renderTargets();
    loadTrialStimulus();
    updateBoard();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

window.startGame = startGame;
