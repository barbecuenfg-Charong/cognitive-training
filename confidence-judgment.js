const ALL_QUESTIONS = [
    { id: "cj-easy-fact-capital", difficulty: "easy", category: "fact", q: "中国的首都是哪座城市？", options: ["上海", "北京", "广州", "深圳"], answer: 1 },
    { id: "cj-easy-arithmetic-square", difficulty: "easy", category: "arithmetic", q: "3 的平方是多少？", options: ["6", "8", "9", "12"], answer: 2 },
    { id: "cj-easy-science-orbit", difficulty: "easy", category: "science", q: "地球围绕哪颗恒星运行？", options: ["月球", "火星", "太阳", "木星"], answer: 2 },
    { id: "cj-easy-time-week", difficulty: "easy", category: "fact", q: "一周通常有几天？", options: ["5", "6", "7", "8"], answer: 2 },
    { id: "cj-easy-tech-length", difficulty: "easy", category: "technical", q: "JavaScript 中数组长度属性是？", options: [".size", ".length", ".count", ".len"], answer: 1 },
    { id: "cj-easy-language-antonym", difficulty: "easy", category: "language", q: "“增加”的反义词更接近哪一个？", options: ["扩大", "减少", "提升", "累积"], answer: 1 },

    { id: "cj-medium-arithmetic-order", difficulty: "medium", category: "arithmetic", q: "2 + 5 × 2 = ?", options: ["14", "12", "10", "9"], answer: 1 },
    { id: "cj-medium-logic-syllogism", difficulty: "medium", category: "logic", q: "若所有 A 都是 B，所有 B 都是 C，则一定成立的是？", options: ["所有 C 都是 A", "所有 A 都是 C", "有些 C 不是 B", "所有 B 都不是 A"], answer: 1 },
    { id: "cj-medium-stat-median", difficulty: "medium", category: "probability", q: "在一组数据中，哪个指标通常比均值更不容易受极端值影响？", options: ["最大值", "方差", "中位数", "总和"], answer: 2 },
    { id: "cj-medium-tech-http", difficulty: "medium", category: "technical", q: "HTTP 的默认端口通常是？", options: ["21", "80", "443", "3306"], answer: 1 },
    { id: "cj-medium-arithmetic-price", difficulty: "medium", category: "arithmetic", q: "价格先上涨 25%，再下降 20%，最终价格相对原价如何？", options: ["上涨 5%", "下降 5%", "回到原价", "上涨 10%"], answer: 2 },
    { id: "cj-medium-science-blood", difficulty: "medium", category: "science", q: "人体中主要负责运输氧气的血细胞是？", options: ["血小板", "白细胞", "红细胞", "淋巴细胞"], answer: 2 },

    { id: "cj-hard-prob-base-rate", difficulty: "hard", category: "probability", q: "某病患病率 10%，检测灵敏度 90%，特异度 90%。检测阳性者真正患病概率约为？", options: ["10%", "50%", "90%", "99%"], answer: 1 },
    { id: "cj-hard-cal-brier-wrong", difficulty: "hard", category: "calibration", q: "若你对错误答案给出 80% 置信度，该题 Brier 分量是多少？", options: ["0.04", "0.20", "0.64", "0.80"], answer: 2 },
    { id: "cj-hard-cal-underconfidence", difficulty: "hard", category: "calibration", q: "某类题平均置信度 70%，实际正确率 85%，主要校准问题是？", options: ["过度自信", "低信心/低估", "随机作答", "无法判断"], answer: 1 },
    { id: "cj-hard-cal-overconfidence-bin", difficulty: "hard", category: "calibration", q: "90%-100% 置信分箱的实际正确率只有 60%，最应优先调整什么？", options: ["提高该分箱信心", "降低高信心使用门槛", "忽略该分箱", "只看总正确率"], answer: 1 },
    { id: "cj-hard-cal-resolution", difficulty: "hard", category: "calibration", q: "校准训练中的 resolution/discrimination 更高，通常表示什么？", options: ["信心能更好区分正确与错误", "所有题都答对", "反应时更短", "题目更简单"], answer: 0 },
    { id: "cj-hard-prob-coin", difficulty: "hard", category: "probability", q: "公平硬币连续 5 次正面后，下一次正面的概率是？", options: ["小于 50%", "50%", "大于 50%", "取决于前 5 次间隔"], answer: 1 }
];

const CONTENT_VERSION = "confidence-judgment-v3-calibration";
const DIFFICULTY_BLOCKS = [
    { difficulty: "easy", label: "基础", targetCount: 4 },
    { difficulty: "medium", label: "中等", targetCount: 4 },
    { difficulty: "hard", label: "挑战", targetCount: 4 }
];
const DIFFICULTY_LABELS = {
    easy: "基础",
    medium: "中等",
    hard: "挑战"
};
const CATEGORY_LABELS = {
    fact: "事实识记",
    arithmetic: "数字计算",
    science: "科学常识",
    technical: "技术概念",
    language: "语言判断",
    logic: "逻辑推理",
    probability: "概率判断",
    calibration: "校准概念"
};
const CALIBRATION_BINS = [
    { label: "50-59", min: 50, max: 59 },
    { label: "60-69", min: 60, max: 69 },
    { label: "70-79", min: 70, max: 79 },
    { label: "80-89", min: 80, max: 89 },
    { label: "90-100", min: 90, max: 100 }
];

let index = 0;
let selected = null;
let awaitingNext = false;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionQuestions = [];
let questionOrder = [];
let optionOrder = [];
let trials = [];
let questionStartedAt = 0;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("cj-panel");
const questionBox = document.getElementById("question-box");
const optionsBox = document.getElementById("options-box");
const confidenceInput = document.getElementById("confidence");
const confidenceLabel = document.getElementById("confidence-label");
const confidenceMeaning = document.getElementById("confidence-meaning");
const feedback = document.getElementById("feedback");
const resultModal = document.getElementById("result-modal");
const submitBtn = document.getElementById("submit-btn");

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[char]));
}

function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

function formatPercent(value, digits = 0) {
    return `${round(value, digits)}%`;
}

function formatSignedPercent(value, digits = 0) {
    const rounded = round(value, digits);
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function getNowMs() {
    return window.performance && typeof window.performance.now === "function"
        ? window.performance.now()
        : Date.now();
}

function shuffleCopy(items, rng, seeded) {
    const copy = items.slice();
    if (seeded && typeof seeded.shuffleInPlace === "function") {
        seeded.shuffleInPlace(copy, rng);
        return copy;
    }
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function getConfidenceMeaning(value) {
    const conf = Number(value);
    if (conf <= 55) return "接近猜测，保留不确定性";
    if (conf <= 70) return "有一些证据，但仍需校验";
    if (conf <= 85) return "较有把握，适合用于熟悉题型";
    if (conf < 100) return "高把握，错误时需明显下调";
    return "完全确定，仅用于可复核事实";
}

function updateConfidenceLabel() {
    confidenceLabel.textContent = `${confidenceInput.value}%`;
    confidenceMeaning.textContent = getConfidenceMeaning(confidenceInput.value);
}

function buildSessionQuestions() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("confidence-judgment") : `confidence-judgment-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    const prepared = [];

    optionOrder = [];
    DIFFICULTY_BLOCKS.forEach((block, blockIndex) => {
        const candidates = ALL_QUESTIONS.filter((item) => item.difficulty === block.difficulty);
        const picked = shuffleCopy(candidates, rng, seeded).slice(0, block.targetCount);
        picked.forEach((item) => {
            const correctAnswer = item.options[item.answer];
            const options = shuffleCopy(item.options, rng, seeded);
            optionOrder.push({ id: item.id, options: options.slice() });
            prepared.push({
                id: item.id,
                q: item.q,
                options,
                correctAnswer,
                correctIndex: options.indexOf(correctAnswer),
                difficulty: item.difficulty,
                category: item.category,
                blockIndex
            });
        });
    });

    sessionQuestions = prepared;
    questionOrder = prepared.map((item) => item.id);
}

function buildCalibrationBins(inputTrials) {
    return CALIBRATION_BINS.map((bin) => {
        const members = inputTrials.filter((trial) => trial.confidence >= bin.min && trial.confidence <= bin.max);
        const count = members.length;
        if (count === 0) {
            return {
                bin: bin.label,
                minConfidence: bin.min,
                maxConfidence: bin.max,
                count: 0,
                meanConfidence: null,
                accuracy: null,
                gap: null,
                brierScore: null
            };
        }
        const meanConfidence = members.reduce((sum, trial) => sum + trial.confidence, 0) / count;
        const accuracy = (members.filter((trial) => trial.isCorrect).length / count) * 100;
        const brierScore = members.reduce((sum, trial) => sum + trial.brierComponent, 0) / count;
        return {
            bin: bin.label,
            minConfidence: bin.min,
            maxConfidence: bin.max,
            count,
            meanConfidence: round(meanConfidence, 1),
            accuracy: round(accuracy, 1),
            gap: round(meanConfidence - accuracy, 1),
            brierScore: round(brierScore, 4)
        };
    });
}

function aggregateBy(inputTrials, keyFn, labelFn) {
    const groups = new Map();
    inputTrials.forEach((trial) => {
        const key = keyFn(trial);
        if (!groups.has(key)) {
            groups.set(key, {
                key,
                label: labelFn(trial),
                count: 0,
                correct: 0,
                confidenceSum: 0,
                brierSum: 0
            });
        }
        const group = groups.get(key);
        group.count += 1;
        group.correct += trial.isCorrect ? 1 : 0;
        group.confidenceSum += trial.confidence;
        group.brierSum += trial.brierComponent;
    });

    return Array.from(groups.values()).map((group) => {
        const accuracy = (group.correct / group.count) * 100;
        const meanConfidence = group.confidenceSum / group.count;
        return {
            key: group.key,
            label: group.label,
            count: group.count,
            accuracy: round(accuracy, 1),
            meanConfidence: round(meanConfidence, 1),
            gap: round(meanConfidence - accuracy, 1),
            brierScore: round(group.brierSum / group.count, 4)
        };
    });
}

function buildNextParameters(inputTrials, metrics) {
    const categoryGroups = aggregateBy(
        inputTrials,
        (trial) => trial.category,
        (trial) => CATEGORY_LABELS[trial.category] || trial.category
    );
    const difficultyGroups = aggregateBy(
        inputTrials,
        (trial) => trial.difficulty,
        (trial) => DIFFICULTY_LABELS[trial.difficulty] || trial.difficulty
    );
    const candidates = categoryGroups.concat(difficultyGroups);
    const lowerConfidenceOn = candidates
        .filter((group) => group.count >= 1 && group.gap >= 15)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 3)
        .map((group) => ({
            label: group.label,
            gap: group.gap,
            count: group.count
        }));
    const raiseConfidenceOn = candidates
        .filter((group) => group.count >= 1 && group.gap <= -15)
        .sort((a, b) => a.gap - b.gap)
        .slice(0, 3)
        .map((group) => ({
            label: group.label,
            gap: group.gap,
            count: group.count
        }));

    let startingConfidence = 70;
    if (metrics.overconfidenceGap >= 10) {
        startingConfidence = 65;
    } else if (metrics.overconfidenceGap <= -10) {
        startingConfidence = 75;
    }

    const difficultyMix = {
        easy: metrics.accuracy < 55 ? 5 : 3,
        medium: 4,
        hard: metrics.accuracy > 75 && metrics.brierScore <= 0.2 ? 5 : 3
    };

    const textParts = [];
    if (lowerConfidenceOn.length) {
        textParts.push(`降低信心：${lowerConfidenceOn.map((item) => `${item.label}(${formatSignedPercent(item.gap)})`).join("、")}。`);
    }
    if (raiseConfidenceOn.length) {
        textParts.push(`提高信心：${raiseConfidenceOn.map((item) => `${item.label}(${formatSignedPercent(item.gap)})`).join("、")}。`);
    }
    if (!textParts.length) {
        textParts.push("整体信心与正确率接近，下轮继续保持分层题目并观察高置信分箱。");
    }

    return {
        suggestedStartingConfidence: startingConfidence,
        difficultyMix,
        lowerConfidenceOn,
        raiseConfidenceOn,
        text: textParts.join(" ")
    };
}

function calculateMetrics(inputTrials) {
    const total = inputTrials.length;
    if (total === 0) {
        const emptyMetrics = {
            brierScore: 0,
            meanConfidence: 0,
            accuracy: 0,
            overconfidenceGap: 0,
            calibrationBins: buildCalibrationBins([]),
            resolution: 0
        };
        return {
            ...emptyMetrics,
            nextParameters: {
                suggestedStartingConfidence: 70,
                difficultyMix: { easy: 4, medium: 4, hard: 4 },
                lowerConfidenceOn: [],
                raiseConfidenceOn: [],
                text: "完成至少一组题目后生成下一轮参数。"
            }
        };
    }

    const correct = inputTrials.filter((trial) => trial.isCorrect).length;
    const confidenceSum = inputTrials.reduce((sum, trial) => sum + trial.confidence, 0);
    const brierSum = inputTrials.reduce((sum, trial) => sum + trial.brierComponent, 0);
    const accuracy = round((correct / total) * 100, 1);
    const meanConfidence = round(confidenceSum / total, 1);
    const calibrationBins = buildCalibrationBins(inputTrials);
    const overallAccuracyRatio = accuracy / 100;
    const resolution = calibrationBins.reduce((sum, bin) => {
        if (!bin.count) return sum;
        const binAccuracyRatio = bin.accuracy / 100;
        return sum + (bin.count / total) * ((binAccuracyRatio - overallAccuracyRatio) ** 2);
    }, 0);
    const metrics = {
        brierScore: round(brierSum / total, 4),
        meanConfidence,
        accuracy,
        overconfidenceGap: round(meanConfidence - accuracy, 1),
        calibrationBins,
        resolution: round(resolution, 4)
    };

    return {
        ...metrics,
        nextParameters: buildNextParameters(inputTrials, metrics)
    };
}

function updateBoard() {
    const metrics = calculateMetrics(trials);
    const total = sessionQuestions.length || DIFFICULTY_BLOCKS.reduce((sum, block) => sum + block.targetCount, 0);

    document.getElementById("progress").textContent = `${trials.length}/${total}`;
    document.getElementById("acc").textContent = formatPercent(metrics.accuracy);
    document.getElementById("gap").textContent = formatSignedPercent(metrics.overconfidenceGap);
}

function setQuestionControlsDisabled(disabled) {
    optionsBox.querySelectorAll("input").forEach((input) => {
        input.disabled = disabled;
    });
    confidenceInput.disabled = disabled;
}

function renderQuestion() {
    const item = sessionQuestions[index];
    selected = null;
    awaitingNext = false;
    feedback.textContent = "";
    submitBtn.textContent = "提交本题";
    submitBtn.disabled = false;
    confidenceInput.value = item.difficulty === "hard" ? 60 : item.difficulty === "medium" ? 70 : 75;
    confidenceInput.disabled = false;
    updateConfidenceLabel();

    questionBox.innerHTML = `
        <div class="cj-meta">
            <span class="cj-pill">难度：${escapeHtml(DIFFICULTY_LABELS[item.difficulty] || item.difficulty)}</span>
            <span class="cj-pill">题型：${escapeHtml(CATEGORY_LABELS[item.category] || item.category)}</span>
            <span class="cj-pill">区块：${item.blockIndex + 1}</span>
        </div>
        <strong>题目 ${index + 1}</strong>
        <p>${escapeHtml(item.q)}</p>
    `;
    optionsBox.innerHTML = "";

    item.options.forEach((text, idx) => {
        const label = document.createElement("label");
        const input = document.createElement("input");
        const span = document.createElement("span");
        label.className = "cj-option";
        input.type = "radio";
        input.name = "option";
        input.value = String(idx);
        span.textContent = text;
        input.addEventListener("change", () => {
            selected = idx;
        });
        label.appendChild(input);
        label.appendChild(span);
        optionsBox.appendChild(label);
    });

    questionStartedAt = getNowMs();
}

function getTrialFeedback(trial) {
    const category = CATEGORY_LABELS[trial.category] || trial.category;
    const difficulty = DIFFICULTY_LABELS[trial.difficulty] || trial.difficulty;
    const absError = Math.abs(trial.calibrationError);
    const brierText = trial.brierComponent.toFixed(3);

    if (!trial.isCorrect && trial.confidence >= 80) {
        return `<strong>高信心错误。</strong>在“${escapeHtml(category)} / ${escapeHtml(difficulty)}”题型先降低 10-20 个百分点信心；本题校准误差 ${absError}pp，Brier ${brierText}。正确答案：${escapeHtml(trial.correctAnswer)}。`;
    }
    if (!trial.isCorrect) {
        return `<strong>答案错误但信心未到高位。</strong>保持谨慎，并在“${escapeHtml(category)} / ${escapeHtml(difficulty)}”题型复查关键线索；本题校准误差 ${absError}pp，Brier ${brierText}。正确答案：${escapeHtml(trial.correctAnswer)}。`;
    }
    if (trial.confidence <= 70) {
        return `<strong>答对但信心偏低。</strong>在“${escapeHtml(category)} / ${escapeHtml(difficulty)}”相似题型可尝试上调 5-10 个百分点；本题校准误差 ${absError}pp，Brier ${brierText}。`;
    }
    return `<strong>答对且信心较匹配。</strong>“${escapeHtml(category)} / ${escapeHtml(difficulty)}”题型可维持当前信心水平；本题校准误差 ${absError}pp，Brier ${brierText}。`;
}

function recordCurrentAnswer() {
    if (selected === null) {
        feedback.textContent = "请先选择答案。";
        return;
    }

    const conf = Number(confidenceInput.value);
    const item = sessionQuestions[index];
    const isCorrect = selected === item.correctIndex;
    const outcome = isCorrect ? 1 : 0;
    const brierComponent = (conf / 100 - outcome) ** 2;
    const trial = {
        questionId: item.id,
        difficulty: item.difficulty,
        difficultyLabel: DIFFICULTY_LABELS[item.difficulty] || item.difficulty,
        category: item.category,
        categoryLabel: CATEGORY_LABELS[item.category] || item.category,
        answer: item.options[selected],
        correctAnswer: item.correctAnswer,
        isCorrect,
        confidence: conf,
        rtMs: Math.max(0, Math.round(getNowMs() - questionStartedAt)),
        calibrationError: round(conf - (outcome * 100), 1),
        brierComponent: round(brierComponent, 4),
        blockIndex: item.blockIndex
    };

    trials.push(trial);
    feedback.innerHTML = getTrialFeedback(trial);
    awaitingNext = true;
    setQuestionControlsDisabled(true);
    submitBtn.textContent = trials.length >= sessionQuestions.length ? "查看总结" : "下一题";
    updateBoard();
}

function renderCalibrationBins(metrics) {
    const container = document.getElementById("calibration-bins");
    container.innerHTML = metrics.calibrationBins.map((bin) => {
        if (!bin.count) {
            return `<div class="bin-row"><span>${escapeHtml(bin.bin)}%</span><span>n=0</span><span>无数据</span><span>无数据</span></div>`;
        }
        return `
            <div class="bin-row">
                <span>${escapeHtml(bin.bin)}%</span>
                <span>n=${bin.count}</span>
                <span>信心 ${formatPercent(bin.meanConfidence, 1)}</span>
                <span>正确 ${formatPercent(bin.accuracy, 1)} / 差 ${formatSignedPercent(bin.gap, 1)}</span>
            </div>
        `;
    }).join("");
}

function finish() {
    const metrics = calculateMetrics(trials);
    const compatibilityGap = Math.abs(metrics.overconfidenceGap);
    const score = Math.max(0, Math.round((1 - metrics.brierScore) * 100));

    document.getElementById("result-acc").textContent = formatPercent(metrics.accuracy, 1);
    document.getElementById("result-conf").textContent = formatPercent(metrics.meanConfidence, 1);
    document.getElementById("result-gap").textContent = formatSignedPercent(metrics.overconfidenceGap, 1);
    document.getElementById("result-brier").textContent = metrics.brierScore.toFixed(4);
    document.getElementById("result-resolution").textContent = metrics.resolution.toFixed(4);
    document.getElementById("result-feedback").textContent = metrics.nextParameters.text;
    document.getElementById("result-next").textContent = `建议初始信心 ${metrics.nextParameters.suggestedStartingConfidence}%；难度配比 基础:${metrics.nextParameters.difficultyMix.easy} 中等:${metrics.nextParameters.difficultyMix.medium} 挑战:${metrics.nextParameters.difficultyMix.hard}。`;
    renderCalibrationBins(metrics);

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            gameId: "confidence-judgment",
            gameName: "置信度判断任务",
            startedAt: sessionStartedAt || new Date(),
            finishedAt: new Date(),
            score,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary: {
                brierScore: metrics.brierScore,
                meanConfidence: metrics.meanConfidence,
                accuracy: metrics.accuracy,
                overconfidenceGap: metrics.overconfidenceGap,
                calibrationBins: metrics.calibrationBins,
                resolution: metrics.resolution,
                nextParameters: metrics.nextParameters
            },
            trials,
            metrics: {
                ...metrics,
                avgConfidence: metrics.meanConfidence,
                calibrationGap: round(compatibilityGap, 1),
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                questionOrder,
                optionOrder
            }
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function goToNextQuestion() {
    if (trials.length >= sessionQuestions.length) {
        finish();
        return;
    }
    index = trials.length;
    renderQuestion();
}

function submitAnswer() {
    if (awaitingNext) {
        goToNextQuestion();
        return;
    }
    recordCurrentAnswer();
}

function startGame() {
    index = 0;
    selected = null;
    awaitingNext = false;
    trials = [];
    sessionStartedAt = new Date();
    buildSessionQuestions();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
    updateBoard();
    renderQuestion();
}

confidenceInput.addEventListener("input", updateConfidenceLabel);
submitBtn.addEventListener("click", submitAnswer);
updateConfidenceLabel();

window.startGame = startGame;
