const CONTENT_VERSION = "sally-anne-v4-belief-controls";
const TOTAL_TRIALS = 10;

const SCENARIO_POOL = [
    {
        id: "toy-boxes",
        contextTag: "home-play",
        story: "小明把玩具放进蓝盒子后离开房间。小红在小明看不见时，把玩具移到红盒子。",
        protagonist: "小明",
        observer: "小红",
        item: "玩具",
        initialLocation: "蓝盒子",
        actualLocation: "红盒子",
        protagonistKnowledge: "只看到玩具在蓝盒子",
        observerKnowledge: "知道小明没看到移动"
    },
    {
        id: "teacher-key",
        contextTag: "school-object",
        story: "老师把钥匙放进抽屉后去办公室外接电话。学生趁老师不在，把钥匙放进书包。",
        protagonist: "老师",
        observer: "学生",
        item: "钥匙",
        initialLocation: "抽屉",
        actualLocation: "书包",
        protagonistKnowledge: "只记得钥匙在抽屉",
        observerKnowledge: "知道老师离开后物品被移动"
    },
    {
        id: "cake-kitchen",
        contextTag: "family-food",
        story: "妈妈把蛋糕放进冰箱后去阳台。爸爸趁妈妈不在，把蛋糕端到餐桌上。",
        protagonist: "妈妈",
        observer: "爸爸",
        item: "蛋糕",
        initialLocation: "冰箱",
        actualLocation: "餐桌",
        protagonistKnowledge: "离开前看到蛋糕在冰箱",
        observerKnowledge: "知道妈妈没有看到后来位置"
    },
    {
        id: "basketball-hall",
        contextTag: "school-sports",
        story: "阿强把篮球放进柜子后去操场。阿丽在阿强离开后，把篮球移到门后。",
        protagonist: "阿强",
        observer: "阿丽",
        item: "篮球",
        initialLocation: "柜子",
        actualLocation: "门后",
        protagonistKnowledge: "只知道篮球原来在柜子",
        observerKnowledge: "知道移动发生在阿强离开后"
    },
    {
        id: "umbrella-home",
        contextTag: "home-daily",
        story: "小李把伞放在门边后去楼下。朋友趁小李不在，把伞拿到阳台。",
        protagonist: "小李",
        observer: "朋友",
        item: "伞",
        initialLocation: "门边",
        actualLocation: "阳台",
        protagonistKnowledge: "离开前看到伞在门边",
        observerKnowledge: "知道小李没看到伞被拿走"
    },
    {
        id: "card-office",
        contextTag: "office-paper",
        story: "管理员把卡片放进文件夹后去开会。实习生后来把卡片改放进信封。",
        protagonist: "管理员",
        observer: "实习生",
        item: "卡片",
        initialLocation: "文件夹",
        actualLocation: "信封",
        protagonistKnowledge: "只看到卡片在文件夹",
        observerKnowledge: "知道管理员不在场"
    },
    {
        id: "library-notebook",
        contextTag: "library-study",
        story: "小周把笔记本放在阅览桌上后去借书。同学趁小周离开，把笔记本收到书架旁。",
        protagonist: "小周",
        observer: "同学",
        item: "笔记本",
        initialLocation: "阅览桌",
        actualLocation: "书架旁",
        protagonistKnowledge: "只看到笔记本在阅览桌",
        observerKnowledge: "知道小周没看到整理过程"
    },
    {
        id: "market-wallet",
        contextTag: "market-shopping",
        story: "阿姨把钱包放进布袋后去称水果。摊主看到家人把钱包移到外套口袋。",
        protagonist: "阿姨",
        observer: "摊主",
        item: "钱包",
        initialLocation: "布袋",
        actualLocation: "外套口袋",
        protagonistKnowledge: "离开前只确认钱包在布袋",
        observerKnowledge: "知道阿姨没有看到家人移动钱包"
    }
];

const SESSION_BLUEPRINT = [
    { questionType: "belief", beliefLevel: 1, controlType: null, count: 3 },
    { questionType: "belief", beliefLevel: 2, controlType: null, count: 3 },
    { questionType: "control", beliefLevel: null, controlType: "reality", count: 2 },
    { questionType: "control", beliefLevel: null, controlType: "memory", count: 2 }
];

const ERROR_FEEDBACK = {
    reality_bias: "把真实位置当成角色知道的位置。",
    second_order_perspective_error: "没有先判断旁观者知道主角看到了什么。",
    reality_control_error: "把角色最初记得的位置当成当前真实位置。",
    memory_control_error: "把后来移动后的位置当成角色离开前的位置。"
};

let index = 0;
let correctCount = 0;
let totalRt = 0;
let shownAt = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionItems = [];
let itemOrder = [];
let optionOrder = [];
let trialLog = [];

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("sa-panel");
const resultModal = document.getElementById("result-modal");
const questionEl = document.getElementById("question");
const optionsEl = document.getElementById("options");
const feedback = document.getElementById("feedback");

function updateBoard() {
    const answered = index;
    const avgRt = answered === 0 ? 0 : Math.round(totalRt / answered);
    document.getElementById("progress").textContent = String(Math.min(index + 1, sessionItems.length));
    document.getElementById("correct").textContent = String(correctCount);
    document.getElementById("avg-rt").textContent = `${avgRt}ms`;
}

function shuffleCopy(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function buildScenarioQuestions(scenario) {
    const {
        id,
        contextTag,
        story,
        protagonist,
        observer,
        item,
        initialLocation,
        actualLocation,
        protagonistKnowledge,
        observerKnowledge
    } = scenario;
    const knowledgeContrast = {
        protagonist: protagonistKnowledge || `${protagonist}只看到${item}在${initialLocation}`,
        observer: observerKnowledge || `${observer}知道${protagonist}没有看到移动`,
        reality: `${item}现在在${actualLocation}`,
        memory: `${protagonist}离开前看到${item}在${initialLocation}`
    };

    return [
        {
            id: `${id}:first-order`,
            scenarioId: id,
            contextTag,
            questionType: "belief",
            questionLayer: "first_order_belief",
            beliefLevel: 1,
            beliefOrder: 1,
            controlType: null,
            controlDimension: null,
            trainingTarget: "根据主角可见信息判断一阶信念",
            knowledgeContrast,
            q: `${story}\n${protagonist}回来后，会先去哪里找${item}？`,
            options: [
                { key: "initial", text: initialLocation },
                { key: "actual", text: actualLocation }
            ],
            correctKey: "initial",
            errorByChoice: { actual: "reality_bias" },
            explanation: `${protagonist}没有看到${item}被移动，会按照自己离开前看到的${initialLocation}来找。`
        },
        {
            id: `${id}:second-order`,
            scenarioId: id,
            contextTag,
            questionType: "belief",
            questionLayer: "second_order_belief",
            beliefLevel: 2,
            beliefOrder: 2,
            controlType: null,
            controlDimension: null,
            trainingTarget: "先判断旁观者知道的信息，再判断旁观者如何推测主角",
            knowledgeContrast,
            q: `${story}\n${observer}认为${protagonist}回来后，会先去哪里找${item}？`,
            options: [
                { key: "initial", text: initialLocation },
                { key: "actual", text: actualLocation }
            ],
            correctKey: "initial",
            errorByChoice: { actual: "second_order_perspective_error" },
            explanation: `${observer}知道${protagonist}没有看到移动，所以会认为${protagonist}会去${initialLocation}找。`
        },
        {
            id: `${id}:reality-control`,
            scenarioId: id,
            contextTag,
            questionType: "control",
            questionLayer: "reality_control",
            beliefLevel: null,
            beliefOrder: null,
            controlType: "reality",
            controlDimension: "reality",
            trainingTarget: "确认当前真实位置，避免把控制题当信念题",
            knowledgeContrast,
            q: `${story}\n现在${item}实际上在哪里？`,
            options: [
                { key: "initial", text: initialLocation },
                { key: "actual", text: actualLocation }
            ],
            correctKey: "actual",
            errorByChoice: { initial: "reality_control_error" },
            explanation: `${item}后来被移动到了${actualLocation}，这是真实位置。`
        },
        {
            id: `${id}:memory-control`,
            scenarioId: id,
            contextTag,
            questionType: "control",
            questionLayer: "memory_control",
            beliefLevel: null,
            beliefOrder: null,
            controlType: "memory",
            controlDimension: "memory",
            trainingTarget: "确认离开前记忆位置，作为信念判断基础",
            knowledgeContrast,
            q: `${story}\n${protagonist}离开前把${item}放在哪里？`,
            options: [
                { key: "initial", text: initialLocation },
                { key: "actual", text: actualLocation }
            ],
            correctKey: "initial",
            errorByChoice: { actual: "memory_control_error" },
            explanation: `${protagonist}最初把${item}放在${initialLocation}，这是记忆控制题要确认的信息。`
        }
    ];
}

function buildQuestionPool() {
    return SCENARIO_POOL.flatMap(buildScenarioQuestions);
}

function pickForBlueprint(pool, rng) {
    const selected = [];
    SESSION_BLUEPRINT.forEach((blueprint) => {
        const matches = pool.filter((item) => (
            item.questionType === blueprint.questionType
            && item.beliefLevel === blueprint.beliefLevel
            && item.controlType === blueprint.controlType
        ));
        selected.push(...shuffleCopy(matches, rng).slice(0, blueprint.count));
    });
    return shuffleCopy(selected, rng).slice(0, TOTAL_TRIALS);
}

function toSessionItem(item, rng) {
    const orderedOptions = shuffleCopy(item.options, rng);
    const optionKeys = orderedOptions.map((option) => option.key);
    optionOrder.push({
        id: item.id,
        scenarioId: item.scenarioId,
        questionType: item.questionType,
        questionLayer: item.questionLayer,
        beliefLevel: item.beliefLevel,
        beliefOrder: item.beliefOrder,
        controlType: item.controlType,
        controlDimension: item.controlDimension,
        order: optionKeys
    });

    return {
        id: item.id,
        scenarioId: item.scenarioId,
        contextTag: item.contextTag,
        questionType: item.questionType,
        questionLayer: item.questionLayer,
        beliefLevel: item.beliefLevel,
        beliefOrder: item.beliefOrder,
        controlType: item.controlType,
        controlDimension: item.controlDimension,
        trainingTarget: item.trainingTarget,
        knowledgeContrast: item.knowledgeContrast,
        q: item.q,
        options: orderedOptions.map((option) => option.text),
        optionKeys,
        correctKey: item.correctKey,
        answer: orderedOptions.findIndex((option) => option.key === item.correctKey),
        errorByChoice: item.errorByChoice,
        explanation: item.explanation
    };
}

function buildSessionItems() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("sally-anne") : `sally-anne-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;

    optionOrder = [];
    sessionItems = pickForBlueprint(buildQuestionPool(), rng)
        .map((item) => toSessionItem(item, rng));
    itemOrder = sessionItems.map((item) => item.id);
}

function renderQuestion() {
    const item = sessionItems[index];
    questionEl.textContent = item.q;
    optionsEl.innerHTML = "";
    item.options.forEach((text, optionIndex) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn secondary";
        btn.textContent = text;
        btn.addEventListener("click", () => choose(optionIndex));
        optionsEl.appendChild(btn);
    });
    shownAt = performance.now();
    updateBoard();
}

function choose(optionIndex) {
    if (index >= sessionItems.length) {
        return;
    }
    const rt = Math.round(performance.now() - shownAt);
    totalRt += rt;

    const item = sessionItems[index];
    const correct = optionIndex === item.answer;
    const responseKey = item.optionKeys[optionIndex];
    const errorType = correct ? "none" : (item.errorByChoice[responseKey] || "unclassified_social_cognition_error");
    const trial = {
        index: trialLog.length,
        trialIndex: index,
        scenarioId: item.scenarioId,
        contextTag: item.contextTag,
        questionId: item.id,
        questionType: item.questionType,
        questionLayer: item.questionLayer,
        beliefLevel: item.beliefLevel,
        beliefOrder: item.beliefOrder,
        controlType: item.controlType,
        controlDimension: item.controlDimension,
        trainingTarget: item.trainingTarget,
        knowledgeContrast: item.knowledgeContrast,
        correct,
        rt,
        rtMs: rt,
        errorType,
        errorFeedback: correct ? "作答与当前题层一致。" : (ERROR_FEEDBACK[errorType] || "需要重新区分角色视角和事实位置。"),
        explanation: item.explanation,
        explanationFeedback: item.explanation,
        prompt: item.q,
        responseKey,
        response: item.options[optionIndex],
        selectedOption: item.options[optionIndex],
        correctKey: item.correctKey,
        correctOption: item.options[item.answer],
        optionOrder: item.optionKeys.slice(),
        contentVersion: CONTENT_VERSION
    };
    trialLog.push(trial);

    if (correct) {
        correctCount += 1;
        feedback.textContent = `正确（${rt}ms）：${item.explanation}`;
    } else {
        feedback.textContent = `错误（${rt}ms）：${item.explanation}`;
    }

    index += 1;
    if (index >= sessionItems.length) {
        finish();
        return;
    }
    setTimeout(() => {
        feedback.textContent = "";
        renderQuestion();
    }, 400);
}

function percent(part, whole) {
    return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

function accuracyFor(filterFn) {
    const matches = trialLog.filter(filterFn);
    const correct = matches.filter((trial) => trial.correct).length;
    return percent(correct, matches.length);
}

function countErrorTypes() {
    return trialLog.reduce((counts, trial) => {
        if (trial.errorType && trial.errorType !== "none") {
            counts[trial.errorType] = (counts[trial.errorType] || 0) + 1;
        }
        return counts;
    }, {});
}

function countBy(list, getKey) {
    return list.reduce((counts, item) => {
        const key = getKey(item);
        if (key) {
            counts[key] = (counts[key] || 0) + 1;
        }
        return counts;
    }, {});
}

function buildQuestionLayerBreakdown() {
    const breakdown = {};
    trialLog.forEach((trial) => {
        const layer = trial.questionLayer || "unknown";
        if (!breakdown[layer]) {
            breakdown[layer] = { attempts: 0, correct: 0, accuracy: 0, avgReactionMs: 0 };
        }
        const bucket = breakdown[layer];
        bucket.attempts += 1;
        bucket.correct += trial.correct ? 1 : 0;
        bucket.avgReactionMs += trial.rtMs;
    });

    Object.values(breakdown).forEach((bucket) => {
        bucket.accuracy = percent(bucket.correct, bucket.attempts);
        bucket.avgReactionMs = bucket.attempts === 0 ? 0 : Math.round(bucket.avgReactionMs / bucket.attempts);
    });

    return breakdown;
}

function buildConfusionBreakdown() {
    const wrongTrials = trialLog.filter((trial) => !trial.correct);
    return {
        wrongTrialCount: wrongTrials.length,
        byErrorType: countBy(wrongTrials, (trial) => trial.errorType),
        byQuestionType: countBy(wrongTrials, (trial) => trial.questionType),
        byQuestionLayer: countBy(wrongTrials, (trial) => trial.questionLayer),
        byBeliefOrder: countBy(wrongTrials, (trial) => (trial.beliefOrder ? `order-${trial.beliefOrder}` : null)),
        byControlDimension: countBy(wrongTrials, (trial) => trial.controlDimension),
        byResponseKey: countBy(wrongTrials, (trial) => trial.responseKey),
        realityBiasCount: wrongTrials.filter((trial) => trial.errorType === "reality_bias").length,
        secondOrderPerspectiveErrorCount: wrongTrials.filter((trial) => trial.errorType === "second_order_perspective_error").length,
        controlSwapCount: wrongTrials.filter((trial) => (
            trial.errorType === "reality_control_error" || trial.errorType === "memory_control_error"
        )).length
    };
}

function buildExplanationFeedback(summary) {
    const errorEntries = Object.entries(summary.confusionBreakdown.byErrorType || {})
        .sort((a, b) => b[1] - a[1]);

    if (errorEntries.length === 0) {
        return "本轮能稳定区分角色所见信息、真实位置和离开前位置。";
    }

    const [topError] = errorEntries[0];
    return ERROR_FEEDBACK[topError] || "下一轮先标记每个角色看到的信息，再回答。";
}

function buildNextPracticeRecommendation(summary) {
    if (summary.memoryControlAccuracy < 80) {
        return "下一轮先复述角色最初放置位置，再回答信念题。";
    }
    if (summary.controlAccuracy < 80) {
        return "下一轮先区分真实位置和角色记忆位置，再进入信念判断。";
    }
    if (summary.firstOrderAccuracy < 80) {
        return "下一轮优先练习一阶信念：根据角色看到的信息作答。";
    }
    if (summary.secondOrderAccuracy < 80) {
        return "下一轮增加二阶信念练习：先判断旁观者知道谁看到了什么。";
    }
    return "下一轮可混合练习一阶、二阶信念和控制题，只保留练习反馈。";
}

function buildSummary(total, avgRt) {
    const confusionBreakdown = buildConfusionBreakdown();
    const summary = {
        total,
        correct: correctCount,
        accuracy: percent(correctCount, total),
        avgReactionMs: avgRt,
        firstOrderAccuracy: accuracyFor((trial) => trial.questionType === "belief" && trial.beliefLevel === 1),
        secondOrderAccuracy: accuracyFor((trial) => trial.questionType === "belief" && trial.beliefLevel === 2),
        controlAccuracy: accuracyFor((trial) => trial.questionType === "control"),
        memoryControlAccuracy: accuracyFor((trial) => trial.controlType === "memory"),
        errorTypeCounts: countErrorTypes(),
        confusionBreakdown,
        questionLayerBreakdown: buildQuestionLayerBreakdown(),
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        scenarioPoolSize: SCENARIO_POOL.length,
        scenarioIds: Array.from(new Set(trialLog.map((trial) => trial.scenarioId))),
        nonDiagnosticPractice: true
    };
    summary.nextPracticeRecommendation = buildNextPracticeRecommendation(summary);
    summary.nextRecommendation = summary.nextPracticeRecommendation;
    summary.explanationFeedback = buildExplanationFeedback(summary);
    summary.feedbackExplanation = summary.explanationFeedback;
    return summary;
}

function finish() {
    const total = sessionItems.length;
    const avgRt = Math.round(totalRt / total);
    const summary = buildSummary(total, avgRt);
    const accuracy = summary.accuracy;
    const errors = total - correctCount;

    document.getElementById("result-acc").textContent = `${accuracy}%`;
    document.getElementById("result-rt").textContent = `${avgRt}ms`;
    document.getElementById("result-errors").textContent = String(errors);

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            gameId: "sally-anne",
            gameName: "萨莉-安妮任务",
            startedAt: sessionStartedAt || new Date(),
            finishedAt: new Date(),
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            score: correctCount,
            summary,
            trials: trialLog.map((trial) => ({ ...trial })),
            metrics: {
                ...summary,
                itemOrder,
                optionOrder,
                confusionBreakdown: summary.confusionBreakdown,
                nextPracticeRecommendation: summary.nextPracticeRecommendation,
                explanationFeedback: summary.explanationFeedback,
                feedbackExplanation: summary.feedbackExplanation,
                trialCountByQuestionType: {
                    firstOrderBelief: trialLog.filter((trial) => trial.questionType === "belief" && trial.beliefLevel === 1).length,
                    secondOrderBelief: trialLog.filter((trial) => trial.questionType === "belief" && trial.beliefLevel === 2).length,
                    realityControl: trialLog.filter((trial) => trial.controlType === "reality").length,
                    memoryControl: trialLog.filter((trial) => trial.controlType === "memory").length
                }
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
    trialLog = [];
    sessionStartedAt = new Date();
    buildSessionItems();

    feedback.textContent = "";
    renderQuestion();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

window.startGame = startGame;
