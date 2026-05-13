const CONTENT_VERSION = "sally-anne-v3-social-practice";
const TOTAL_TRIALS = 10;

const SCENARIO_POOL = [
    {
        id: "toy-boxes",
        story: "小明把玩具放进蓝盒子后离开房间。小红在小明看不见时，把玩具移到红盒子。",
        protagonist: "小明",
        observer: "小红",
        item: "玩具",
        initialLocation: "蓝盒子",
        actualLocation: "红盒子"
    },
    {
        id: "teacher-key",
        story: "老师把钥匙放进抽屉后去办公室外接电话。学生趁老师不在，把钥匙放进书包。",
        protagonist: "老师",
        observer: "学生",
        item: "钥匙",
        initialLocation: "抽屉",
        actualLocation: "书包"
    },
    {
        id: "cake-kitchen",
        story: "妈妈把蛋糕放进冰箱后去阳台。爸爸趁妈妈不在，把蛋糕端到餐桌上。",
        protagonist: "妈妈",
        observer: "爸爸",
        item: "蛋糕",
        initialLocation: "冰箱",
        actualLocation: "餐桌"
    },
    {
        id: "basketball-hall",
        story: "阿强把篮球放进柜子后去操场。阿丽在阿强离开后，把篮球移到门后。",
        protagonist: "阿强",
        observer: "阿丽",
        item: "篮球",
        initialLocation: "柜子",
        actualLocation: "门后"
    },
    {
        id: "umbrella-home",
        story: "小李把伞放在门边后去楼下。朋友趁小李不在，把伞拿到阳台。",
        protagonist: "小李",
        observer: "朋友",
        item: "伞",
        initialLocation: "门边",
        actualLocation: "阳台"
    },
    {
        id: "card-office",
        story: "管理员把卡片放进文件夹后去开会。实习生后来把卡片改放进信封。",
        protagonist: "管理员",
        observer: "实习生",
        item: "卡片",
        initialLocation: "文件夹",
        actualLocation: "信封"
    }
];

const SESSION_BLUEPRINT = [
    { questionType: "belief", beliefLevel: 1, controlType: null, count: 3 },
    { questionType: "belief", beliefLevel: 2, controlType: null, count: 3 },
    { questionType: "control", beliefLevel: null, controlType: "reality", count: 2 },
    { questionType: "control", beliefLevel: null, controlType: "memory", count: 2 }
];

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
        story,
        protagonist,
        observer,
        item,
        initialLocation,
        actualLocation
    } = scenario;

    return [
        {
            id: `${id}:first-order`,
            scenarioId: id,
            questionType: "belief",
            beliefLevel: 1,
            controlType: null,
            q: `${story}\n${protagonist}回来后，会先去哪里找${item}？`,
            options: [
                { key: "initial", text: initialLocation },
                { key: "actual", text: actualLocation }
            ],
            correctKey: "initial",
            errorType: "reality_bias",
            explanation: `${protagonist}没有看到${item}被移动，会按照自己离开前看到的${initialLocation}来找。`
        },
        {
            id: `${id}:second-order`,
            scenarioId: id,
            questionType: "belief",
            beliefLevel: 2,
            controlType: null,
            q: `${story}\n${observer}认为${protagonist}回来后，会先去哪里找${item}？`,
            options: [
                { key: "initial", text: initialLocation },
                { key: "actual", text: actualLocation }
            ],
            correctKey: "initial",
            errorType: "second_order_perspective_error",
            explanation: `${observer}知道${protagonist}没有看到移动，所以会认为${protagonist}会去${initialLocation}找。`
        },
        {
            id: `${id}:reality-control`,
            scenarioId: id,
            questionType: "control",
            beliefLevel: null,
            controlType: "reality",
            q: `${story}\n现在${item}实际上在哪里？`,
            options: [
                { key: "initial", text: initialLocation },
                { key: "actual", text: actualLocation }
            ],
            correctKey: "actual",
            errorType: "reality_control_error",
            explanation: `${item}后来被移动到了${actualLocation}，这是真实位置。`
        },
        {
            id: `${id}:memory-control`,
            scenarioId: id,
            questionType: "control",
            beliefLevel: null,
            controlType: "memory",
            q: `${story}\n${protagonist}离开前把${item}放在哪里？`,
            options: [
                { key: "initial", text: initialLocation },
                { key: "actual", text: actualLocation }
            ],
            correctKey: "initial",
            errorType: "memory_control_error",
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
    optionOrder.push({
        id: item.id,
        scenarioId: item.scenarioId,
        questionType: item.questionType,
        beliefLevel: item.beliefLevel,
        controlType: item.controlType,
        order: orderedOptions.map((option) => option.key)
    });

    return {
        id: item.id,
        scenarioId: item.scenarioId,
        questionType: item.questionType,
        beliefLevel: item.beliefLevel,
        controlType: item.controlType,
        q: item.q,
        options: orderedOptions.map((option) => option.text),
        answer: orderedOptions.findIndex((option) => option.key === item.correctKey),
        errorType: item.errorType,
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
    const trial = {
        index: trialLog.length,
        trialIndex: index,
        scenarioId: item.scenarioId,
        questionId: item.id,
        questionType: item.questionType,
        beliefLevel: item.beliefLevel,
        controlType: item.controlType,
        correct,
        rtMs: rt,
        errorType: correct ? "none" : item.errorType,
        explanation: item.explanation,
        prompt: item.q,
        selectedOption: item.options[optionIndex],
        correctOption: item.options[item.answer],
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

function buildNextRecommendation(summary) {
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
    return "下一轮可混合练习一阶、二阶信念和控制题，保持非诊断性训练。";
}

function buildSummary(total, avgRt) {
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
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        scenarioPoolSize: SCENARIO_POOL.length,
        scenarioIds: Array.from(new Set(trialLog.map((trial) => trial.scenarioId))),
        nonDiagnosticPractice: true
    };
    summary.nextRecommendation = buildNextRecommendation(summary);
    summary.explanationFeedback = summary.nextRecommendation;
    summary.feedbackExplanation = summary.nextRecommendation;
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
