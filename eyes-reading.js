const CONTENT_VERSION = "eyes-reading-v3-trial-metadata";

const MATERIAL_BOUNDARY = {
    materialSource: "自绘/合成的眼周线索练习材料",
    sourceCredit: "仓库内自建内容，不使用 RMET 标准材料原图或原题复刻",
    licenseBoundary: "仅限本仓库训练与演示用途，不作为标准题库复制、商用分发或二次发布素材",
    nonDiagnosticBoundary: "这是社会认知练习，不用于诊断、筛查或临床结论"
};

const ALL_ITEMS = [
    {
        id: "eyes-1",
        emotion: "警惕",
        emotionCategory: "威胁警觉",
        confusableEmotion: "困惑",
        distractorCategory: "认知不确定",
        confusionSet: ["警惕", "困惑", "平静"],
        vocabularyLevel: "basic",
        wordComprehensionRisk: "low",
        lexicalDemand: 1,
        leftBrow: -18,
        rightBrow: 18,
        pupilX: 36,
        options: ["平静", "警惕", "悲伤", "困惑"]
    },
    {
        id: "eyes-2",
        emotion: "愤怒",
        emotionCategory: "威胁警觉",
        confusableEmotion: "兴奋",
        distractorCategory: "高唤醒正向",
        confusionSet: ["愤怒", "兴奋", "尴尬"],
        vocabularyLevel: "basic",
        wordComprehensionRisk: "low",
        lexicalDemand: 1,
        leftBrow: -25,
        rightBrow: 25,
        pupilX: 30,
        options: ["兴奋", "愤怒", "放松", "尴尬"]
    },
    {
        id: "eyes-3",
        emotion: "悲伤",
        emotionCategory: "低落耗竭",
        confusableEmotion: "高兴",
        distractorCategory: "高唤醒正向",
        confusionSet: ["悲伤", "高兴", "惊讶"],
        vocabularyLevel: "basic",
        wordComprehensionRisk: "low",
        lexicalDemand: 1,
        leftBrow: 20,
        rightBrow: -20,
        pupilX: 30,
        options: ["悲伤", "惊讶", "专注", "高兴"]
    },
    {
        id: "eyes-4",
        emotion: "惊讶",
        emotionCategory: "突发反应",
        confusableEmotion: "怀疑",
        distractorCategory: "认知不确定",
        confusionSet: ["惊讶", "怀疑", "羞愧"],
        vocabularyLevel: "basic",
        wordComprehensionRisk: "low",
        lexicalDemand: 1,
        leftBrow: 0,
        rightBrow: 0,
        pupilX: 30,
        options: ["惊讶", "怀疑", "厌烦", "羞愧"]
    },
    {
        id: "eyes-5",
        emotion: "怀疑",
        emotionCategory: "认知不确定",
        confusableEmotion: "自豪",
        distractorCategory: "目标导向控制",
        confusionSet: ["怀疑", "自豪", "满足"],
        vocabularyLevel: "intermediate",
        wordComprehensionRisk: "medium",
        lexicalDemand: 2,
        leftBrow: -8,
        rightBrow: 8,
        pupilX: 24,
        options: ["怀疑", "满足", "悲伤", "自豪"]
    },
    {
        id: "eyes-6",
        emotion: "专注",
        emotionCategory: "目标导向控制",
        confusableEmotion: "紧张",
        distractorCategory: "威胁警觉",
        confusionSet: ["专注", "紧张", "疲惫"],
        vocabularyLevel: "intermediate",
        wordComprehensionRisk: "medium",
        lexicalDemand: 2,
        leftBrow: -6,
        rightBrow: 6,
        pupilX: 32,
        options: ["专注", "沮丧", "紧张", "疲惫"]
    },
    {
        id: "eyes-7",
        emotion: "困惑",
        emotionCategory: "认知不确定",
        confusableEmotion: "冷漠",
        distractorCategory: "低唤醒/疏离",
        confusionSet: ["困惑", "冷漠", "坚定"],
        vocabularyLevel: "intermediate",
        wordComprehensionRisk: "medium",
        lexicalDemand: 2,
        leftBrow: 15,
        rightBrow: 15,
        pupilX: 26,
        options: ["轻松", "困惑", "冷漠", "坚定"]
    },
    {
        id: "eyes-8",
        emotion: "紧张",
        emotionCategory: "威胁警觉",
        confusableEmotion: "困倦",
        distractorCategory: "低唤醒/疏离",
        confusionSet: ["紧张", "困倦", "平静"],
        vocabularyLevel: "basic",
        wordComprehensionRisk: "low",
        lexicalDemand: 1,
        leftBrow: -16,
        rightBrow: 16,
        pupilX: 28,
        options: ["愉快", "紧张", "平静", "困倦"]
    },
    {
        id: "eyes-9",
        emotion: "冷漠",
        emotionCategory: "低唤醒/疏离",
        confusableEmotion: "惊喜",
        distractorCategory: "突发反应",
        confusionSet: ["冷漠", "惊喜", "恐惧"],
        vocabularyLevel: "intermediate",
        wordComprehensionRisk: "medium",
        lexicalDemand: 2,
        leftBrow: 2,
        rightBrow: -2,
        pupilX: 30,
        options: ["惊喜", "冷漠", "恐惧", "兴奋"]
    },
    {
        id: "eyes-10",
        emotion: "坚定",
        emotionCategory: "目标导向控制",
        confusableEmotion: "害怕",
        distractorCategory: "威胁警觉",
        confusionSet: ["坚定", "害怕", "尴尬"],
        vocabularyLevel: "intermediate",
        wordComprehensionRisk: "medium",
        lexicalDemand: 2,
        leftBrow: -12,
        rightBrow: 12,
        pupilX: 34,
        options: ["害怕", "坚定", "悲伤", "尴尬"]
    },
    {
        id: "eyes-11",
        emotion: "疲惫",
        emotionCategory: "低落耗竭",
        confusableEmotion: "得意",
        distractorCategory: "高唤醒正向",
        confusionSet: ["疲惫", "得意", "挑衅"],
        vocabularyLevel: "intermediate",
        wordComprehensionRisk: "medium",
        lexicalDemand: 2,
        leftBrow: 12,
        rightBrow: -12,
        pupilX: 32,
        options: ["活跃", "疲惫", "得意", "挑衅"]
    },
    {
        id: "eyes-12",
        emotion: "平静",
        emotionCategory: "低唤醒/稳定",
        confusableEmotion: "愤怒",
        distractorCategory: "威胁警觉",
        confusionSet: ["平静", "愤怒", "惊慌"],
        vocabularyLevel: "basic",
        wordComprehensionRisk: "low",
        lexicalDemand: 1,
        leftBrow: 0,
        rightBrow: 0,
        pupilX: 30,
        options: ["平静", "愤怒", "惊慌", "厌恶"]
    }
];

let index = 0;
let correctCount = 0;
let totalRt = 0;
let shownAt = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionItems = [];
let sessionTrials = [];
let itemOrder = [];
let optionOrder = [];

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("eyes-panel");
const resultModal = document.getElementById("result-modal");
const optionsEl = document.getElementById("options");
const feedback = document.getElementById("feedback");

function buildSessionItems() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("eyes-reading") : `eyes-reading-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    const ordered = seeded
        ? seeded.pickShuffled(ALL_ITEMS, rng, ALL_ITEMS.length)
        : ALL_ITEMS.slice();

    itemOrder = ordered.map((item) => item.id);
    optionOrder = [];
    sessionItems = ordered.map((item) => {
        const options = item.options.slice();
        if (seeded) {
            seeded.shuffleInPlace(options, rng);
        }
        optionOrder.push({ id: item.id, itemId: item.id, options: options.slice() });
        return { ...item, options };
    });
}

function updateBoard() {
    const answered = index;
    const acc = answered === 0 ? 0 : Math.round((correctCount / answered) * 100);
    const avgRt = answered === 0 ? 0 : Math.round(totalRt / answered);
    document.getElementById("progress").textContent = String(Math.min(index + 1, sessionItems.length));
    document.getElementById("acc").textContent = `${acc}%`;
    document.getElementById("avg-rt").textContent = `${avgRt}ms`;
}

function applyFace(item) {
    const left = document.getElementById("brow-left");
    const right = document.getElementById("brow-right");
    const pupilLeft = document.getElementById("pupil-left");
    const pupilRight = document.getElementById("pupil-right");

    left.style.transform = `rotate(${item.leftBrow}deg)`;
    right.style.transform = `rotate(${item.rightBrow}deg)`;
    pupilLeft.style.left = `${item.pupilX}px`;
    pupilRight.style.left = `${item.pupilX}px`;
}

function renderQuestion() {
    const item = sessionItems[index];
    applyFace(item);
    optionsEl.innerHTML = "";
    item.options.forEach((option) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = option;
        btn.addEventListener("click", () => choose(option));
        optionsEl.appendChild(btn);
    });
    shownAt = performance.now();
    updateBoard();
}

function recordTrial(item, selectedOption, rtMs, correct) {
    const trial = {
        itemId: item.id,
        emotion: item.emotion,
        emotionCategory: item.emotionCategory,
        confusableEmotion: item.confusableEmotion,
        distractorCategory: item.distractorCategory,
        confusionSet: item.confusionSet.slice(),
        vocabularyLevel: item.vocabularyLevel,
        wordComprehensionRisk: item.wordComprehensionRisk,
        lexicalDemand: item.lexicalDemand,
        optionOrder: item.options.slice(),
        selectedOption,
        correct,
        rtMs
    };
    sessionTrials.push(trial);
    return trial;
}

function choose(option) {
    if (index >= sessionItems.length) {
        return;
    }
    const item = sessionItems[index];
    const rt = Math.round(performance.now() - shownAt);
    totalRt += rt;

    const correct = option === item.emotion;
    recordTrial(item, option, rt, correct);

    if (correct) {
        correctCount += 1;
        feedback.textContent = `正确（${rt}ms）`;
    } else {
        feedback.textContent = `不正确，答案是“${item.emotion}”（${rt}ms）`;
    }

    index += 1;
    if (index >= sessionItems.length) {
        finish();
        return;
    }
    setTimeout(() => {
        feedback.textContent = "";
        renderQuestion();
    }, 380);
}

function tallyCounts(entries) {
    return entries.reduce((result, entry) => {
        result[entry] = (result[entry] || 0) + 1;
        return result;
    }, {});
}

function buildEmotionCategoryBreakdown(trials) {
    const breakdown = {};
    trials.forEach((trial) => {
        const category = trial.emotionCategory || "未分类";
        if (!breakdown[category]) {
            breakdown[category] = { attempts: 0, correct: 0, accuracy: 0, avgReactionMs: 0 };
        }
        const bucket = breakdown[category];
        bucket.attempts += 1;
        bucket.correct += trial.correct ? 1 : 0;
        bucket.avgReactionMs += trial.rtMs;
    });

    Object.values(breakdown).forEach((bucket) => {
        bucket.accuracy = bucket.attempts === 0 ? 0 : Math.round((bucket.correct / bucket.attempts) * 100);
        bucket.avgReactionMs = bucket.attempts === 0 ? 0 : Math.round(bucket.avgReactionMs / bucket.attempts);
    });

    return breakdown;
}

function buildConfusionBreakdown(trials) {
    const wrongTrials = trials.filter((trial) => !trial.correct);
    return {
        bySelectedOption: tallyCounts(wrongTrials.map((trial) => trial.selectedOption || "未作答")),
        byConfusableEmotion: tallyCounts(
            wrongTrials
                .filter((trial) => trial.selectedOption === trial.confusableEmotion)
                .map((trial) => trial.confusableEmotion || "未归类")
        ),
        byDistractorCategory: tallyCounts(wrongTrials.map((trial) => trial.distractorCategory || "未分类")),
        wrongTrialCount: wrongTrials.length
    };
}

function buildNextPracticeRecommendation(summary) {
    const categoryEntries = Object.entries(summary.emotionCategoryBreakdown || {});
    const hardestCategory = categoryEntries
        .slice()
        .sort((a, b) => a[1].accuracy - b[1].accuracy || b[1].attempts - a[1].attempts)[0];
    const topConfusionEntry = Object.entries(summary.confusionBreakdown?.bySelectedOption || {})
        .slice()
        .sort((a, b) => b[1] - a[1])[0];
    const vocabRiskShare = summary.total === 0 ? 0 : summary.vocabularyRiskCount / summary.total;

    if (summary.accuracy < 60) {
        return {
            focus: "先稳住词义核对",
            priority: "vocabulary-first",
            text: "先放慢一点，确认词义再看眉眼线索，避免把读词负荷当成表情判断。"
        };
    }

    if (vocabRiskShare >= 0.34) {
        return {
            focus: "降低词汇负荷",
            priority: "lexical-load",
            text: "本轮词汇负荷偏高，下一轮先做词义核对，再进入表情辨认，减少把读词难度误判成表情难度。"
        };
    }

    if (hardestCategory && hardestCategory[1].attempts >= 2 && hardestCategory[1].accuracy < 70) {
        return {
            focus: `强化${hardestCategory[0]}`,
            priority: "emotion-discrimination",
            text: `下一轮可以优先练${hardestCategory[0]}这一类线索，先看眉形和视线方向，再选最接近的词。`
        };
    }

    if (topConfusionEntry && topConfusionEntry[1] >= 2) {
        return {
            focus: `注意${topConfusionEntry[0]}`,
            priority: "confusion-pattern",
            text: `错答里较常落到“${topConfusionEntry[0]}”，下一轮可以专门比较它和目标词的差异。`
        };
    }

    return {
        focus: "保持节奏",
        priority: "balanced",
        text: "当前更适合继续保持节奏，同时留意相近情绪词之间的细微差别。"
    };
}

function buildSessionSummary(trials) {
    const total = trials.length;
    const correct = trials.filter((trial) => trial.correct).length;
    const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100);
    const avgReactionMs = total === 0 ? 0 : Math.round(trials.reduce((sum, trial) => sum + trial.rtMs, 0) / total);
    const emotionCategoryBreakdown = buildEmotionCategoryBreakdown(trials);
    const confusionBreakdown = buildConfusionBreakdown(trials);
    const vocabularyRiskCount = trials.filter((trial) => trial.wordComprehensionRisk && trial.wordComprehensionRisk !== "low").length;
    const summary = {
        total,
        correctCount: correct,
        accuracy,
        avgReactionMs,
        emotionCategoryBreakdown,
        confusionBreakdown,
        vocabularyRiskCount,
        materialSource: MATERIAL_BOUNDARY.materialSource,
        sourceCredit: MATERIAL_BOUNDARY.sourceCredit,
        licenseBoundary: MATERIAL_BOUNDARY.licenseBoundary,
        nonDiagnosticBoundary: MATERIAL_BOUNDARY.nonDiagnosticBoundary
    };

    summary.nextPracticeRecommendation = buildNextPracticeRecommendation(summary);
    return summary;
}

function finish() {
    const summary = buildSessionSummary(sessionTrials);
    const total = summary.total;
    const accuracy = summary.accuracy;
    const avgRt = summary.avgReactionMs;

    document.getElementById("result-acc").textContent = `${accuracy}%`;
    document.getElementById("result-rt").textContent = `${avgRt}ms`;
    document.getElementById("result-correct").textContent = String(summary.correctCount);

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            moduleId: "eyes-reading",
            gameId: "eyes-reading",
            gameName: "眼神读心测验",
            startedAt: sessionStartedAt || new Date(),
            finishedAt: new Date(),
            score: summary.correctCount,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: sessionTrials,
            metrics: {
                total,
                correct: summary.correctCount,
                accuracy,
                avgReactionMs: avgRt,
                emotionCategoryBreakdown: summary.emotionCategoryBreakdown,
                confusionBreakdown: summary.confusionBreakdown,
                vocabularyRiskCount: summary.vocabularyRiskCount,
                nextPracticeRecommendation: summary.nextPracticeRecommendation,
                materialSource: MATERIAL_BOUNDARY.materialSource,
                sourceCredit: MATERIAL_BOUNDARY.sourceCredit,
                licenseBoundary: MATERIAL_BOUNDARY.licenseBoundary,
                nonDiagnosticBoundary: MATERIAL_BOUNDARY.nonDiagnosticBoundary,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                itemOrder,
                optionOrder
            }
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    index = 0;
    correctCount = 0;
    totalRt = 0;
    sessionTrials = [];
    sessionStartedAt = new Date();
    buildSessionItems();

    feedback.textContent = "";
    renderQuestion();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

window.startGame = startGame;
