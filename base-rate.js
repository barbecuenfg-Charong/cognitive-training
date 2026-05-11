const QUESTION_COUNT = 10;
const CONTENT_VERSION = "base-rate-v3-parameterized";
const BASE_RATE_VALUES = [1, 2, 3, 4, 5, 8, 10, 12, 15, 20, 25, 30, 35, 40];
const SENSITIVITY_VALUES = [72, 75, 78, 80, 82, 85, 88, 90, 92, 95, 97, 99];
const SPECIFICITY_VALUES = [70, 75, 78, 80, 82, 85, 88, 90, 92, 95, 97, 99];
const POPULATION_SIZE = 10000;

let index = 0;
let correctCount = 0;
let neglectCount = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionQuestions = [];
let questionOrder = [];
let responses = [];
let trialStartTime = 0;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("br-panel");
const questionCard = document.getElementById("question-card");
const optionsEl = document.getElementById("options");
const feedbackEl = document.getElementById("feedback");
const resultModal = document.getElementById("result-modal");

function posterior(baseRate, sensitivity, specificity) {
    const pD = baseRate / 100;
    const pNotD = 1 - pD;
    const pPosGivenD = sensitivity / 100;
    const pPosGivenNotD = 1 - specificity / 100;
    const numerator = pPosGivenD * pD;
    const denominator = numerator + pPosGivenNotD * pNotD;
    return Math.round((numerator / denominator) * 100);
}

function pickOne(values, rng) {
    return values[Math.floor(rng() * values.length)];
}

function clampPercent(value) {
    return Math.max(1, Math.min(99, Math.round(value)));
}

function naturalFrequency(baseRate, sensitivity, specificity) {
    const diseased = Math.round(POPULATION_SIZE * (baseRate / 100));
    const healthy = POPULATION_SIZE - diseased;
    const truePositive = Math.round(diseased * (sensitivity / 100));
    const falsePositive = Math.round(healthy * ((100 - specificity) / 100));
    const positiveTotal = truePositive + falsePositive;

    return {
        population: POPULATION_SIZE,
        diseased,
        healthy,
        truePositive,
        falsePositive,
        positiveTotal
    };
}

function shuffle(values, rng) {
    const copy = values.slice();
    if (window.SeededRandom) {
        return window.SeededRandom.shuffleInPlace(copy, rng);
    }
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function buildOptions(question, rng) {
    const set = new Set([question.correctValue, question.heuristicValue, question.baseRate]);
    const nearby = shuffle([-25, -20, -15, -10, -5, 5, 10, 15, 20, 25], rng);
    const anchors = shuffle([2, 5, 8, 12, 15, 20, 25, 35, 45, 55, 65, 75, 85, 95], rng);
    const candidates = [
        ...nearby.map((offset) => clampPercent(question.correctValue + offset)),
        clampPercent((question.correctValue + question.heuristicValue) / 2),
        ...anchors
    ];

    for (const candidate of candidates) {
        if (set.size >= 4) {
            break;
        }
        set.add(candidate);
    }

    return shuffle(Array.from(set).slice(0, 4), rng);
}

function createQuestion(questionIndex, rng, usedSignatures) {
    for (let attempt = 0; attempt < 500; attempt += 1) {
        const baseRate = pickOne(BASE_RATE_VALUES, rng);
        const sensitivity = pickOne(SENSITIVITY_VALUES, rng);
        const specificity = pickOne(SPECIFICITY_VALUES, rng);
        const signature = `${baseRate}-${sensitivity}-${specificity}`;
        const correctValue = posterior(baseRate, sensitivity, specificity);
        const heuristicValue = sensitivity;

        if (usedSignatures.has(signature) || correctValue === heuristicValue || Math.abs(correctValue - heuristicValue) < 5) {
            continue;
        }

        usedSignatures.add(signature);
        const question = {
            id: `br-${questionIndex + 1}-${signature}`,
            baseRate,
            sensitivity,
            specificity,
            correctValue,
            heuristicValue,
            frequency: naturalFrequency(baseRate, sensitivity, specificity)
        };
        question.options = buildOptions(question, rng);
        return question;
    }

    throw new Error("Unable to generate enough unique base-rate questions.");
}

function buildSessionQuestions() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("base-rate") : `base-rate-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    const usedSignatures = new Set();
    const generated = [];

    for (let i = 0; i < QUESTION_COUNT; i += 1) {
        generated.push(createQuestion(i, rng, usedSignatures));
    }

    questionOrder = generated.map((item) => item.id);
    sessionQuestions = generated;
}

function updateBoard() {
    const answered = index;
    const acc = answered === 0 ? 0 : Math.round((correctCount / answered) * 100);
    const neglectRate = answered === 0 ? 0 : Math.round((neglectCount / answered) * 100);
    const total = sessionQuestions.length || QUESTION_COUNT;

    document.getElementById("progress").textContent = `${answered}/${total}`;
    document.getElementById("accuracy").textContent = `${acc}%`;
    document.getElementById("neglect-rate").textContent = `${neglectRate}%`;
}

function renderQuestion() {
    const q = sessionQuestions[index];

    questionCard.innerHTML = `
        <p><strong>场景 ${index + 1}</strong></p>
        <p>某疾病患病率（基率）为 <strong>${q.baseRate}%</strong>。</p>
        <p>检测灵敏度为 <strong>${q.sensitivity}%</strong>，特异度为 <strong>${q.specificity}%</strong>。</p>
        <p>自然频率提示：可以把它看成每 <strong>${q.frequency.population}</strong> 人中的阳性检测构成。</p>
        <p>若某人检测结果为阳性，其真实患病概率最接近以下哪项？</p>
    `;

    optionsEl.innerHTML = "";
    q.options.forEach((value) => {
        const btn = document.createElement("button");
        btn.className = "btn primary";
        btn.type = "button";
        btn.textContent = `${value}%`;
        btn.addEventListener("click", () => answer(value));
        optionsEl.appendChild(btn);
    });

    feedbackEl.textContent = "";
    trialStartTime = Date.now();
}

function answer(chosen) {
    const q = sessionQuestions[index];
    const correctValue = q.correctValue;
    const heuristicValue = q.heuristicValue;
    const isCorrect = chosen === correctValue;
    const choseSensitivityTrap = chosen === heuristicValue && !isCorrect;
    const rtMs = Math.max(0, Date.now() - trialStartTime);
    const explanation = `按每 ${q.frequency.population} 人估算：约 ${q.frequency.diseased} 人患病，其中 ${q.frequency.truePositive} 人阳性；约 ${q.frequency.healthy} 人未患病，其中 ${q.frequency.falsePositive} 人误报。阳性共 ${q.frequency.positiveTotal} 人，真实患病约 ${correctValue}%。`;

    optionsEl.querySelectorAll("button").forEach((button) => {
        button.disabled = true;
    });

    if (isCorrect) {
        correctCount += 1;
        feedbackEl.textContent = `正确。${explanation}`;
    } else {
        if (choseSensitivityTrap) {
            neglectCount += 1;
        }
        feedbackEl.textContent = `不正确。${explanation} 不能只看灵敏度 ${heuristicValue}%。`;
    }

    responses.push({
        index,
        questionId: q.id,
        baseRate: q.baseRate,
        sensitivity: q.sensitivity,
        specificity: q.specificity,
        chosenValue: chosen,
        correctValue,
        heuristicValue,
        correct: isCorrect,
        choseSensitivityTrap,
        rtMs,
        options: q.options.slice(),
        naturalFrequency: {
            population: q.frequency.population,
            diseased: q.frequency.diseased,
            truePositive: q.frequency.truePositive,
            falsePositive: q.frequency.falsePositive,
            positiveTotal: q.frequency.positiveTotal
        }
    });

    index += 1;
    updateBoard();

    if (index >= sessionQuestions.length) {
        finish();
        return;
    }

    setTimeout(renderQuestion, 700);
}

function finish() {
    const total = sessionQuestions.length;
    const acc = Math.round((correctCount / total) * 100);
    const neglectRate = Math.round((neglectCount / total) * 100);
    const finishedAt = new Date();
    const durationMs = sessionStartedAt ? finishedAt.getTime() - sessionStartedAt.getTime() : 0;
    const meanRtMs = Math.round(responses.reduce((sum, item) => sum + item.rtMs, 0) / Math.max(1, responses.length));
    const optionOrder = sessionQuestions.map((item) => ({ id: item.id, options: item.options }));

    document.getElementById("result-acc").textContent = `${acc}%`;
    document.getElementById("result-neglect").textContent = `${neglectRate}%`;

    let message = "表现稳定，继续保持把“基率+检测性能”一起纳入判断。";
    if (neglectRate >= 50) {
        message = "你较常只看检测命中率，忽略了基率。建议重点训练贝叶斯思维。";
    } else if (neglectRate >= 20) {
        message = "存在一定基率忽略倾向，继续训练可明显改善。";
    }

    document.getElementById("result-text").textContent = message;

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            moduleId: "base-rate",
            gameId: "base-rate",
            gameName: "基率忽略任务",
            startedAt: sessionStartedAt || finishedAt,
            finishedAt,
            durationMs,
            score: acc,
            summary: {
                totalTrials: total,
                correctCount,
                accuracy: correctCount / total,
                neglectCount,
                neglectRate: neglectCount / total,
                meanRtMs,
                contentVersion: CONTENT_VERSION,
                sessionSeed,
                questionOrder: questionOrder.slice(),
                optionOrder
            },
            trials: responses.map((item) => ({ ...item })),
            metrics: {
                accuracy: acc,
                neglectRate,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                questionOrder,
                optionOrder
            },
            tags: ["probability", "base-rate", "bayesian"]
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    index = 0;
    correctCount = 0;
    neglectCount = 0;
    responses = [];
    sessionStartedAt = new Date();
    buildSessionQuestions();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
    updateBoard();
    renderQuestion();
}

window.startGame = startGame;
