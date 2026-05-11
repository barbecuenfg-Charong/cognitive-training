const TOTAL_ROUNDS = 24;
const HISTORY_SIZE = 8;
const STREAK_THRESHOLD = 3;
const BLOCK_SIZE = 6;
const CONTENT_VERSION = "gambler-fallacy-v3-randomness-calibration";
const CONDITIONS = ["streak", "alternation", "balanced", "biasedCoin"];
const CONDITION_COUNTS = {
    streak: 6,
    alternation: 6,
    balanced: 6,
    biasedCoin: 6
};
const BIASED_BASE_PROBABILITIES = [0.3, 0.35, 0.65, 0.7];

let round = 0;
let correct = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let rng = Math.random;
let sessionTrials = [];
let trialLog = [];
let trialStartedAtMs = 0;
let acceptingChoice = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("gf-panel");
const historyEl = document.getElementById("history");
const feedbackEl = document.getElementById("feedback");
const resultModal = document.getElementById("result-modal");
const trialLabelEl = document.getElementById("trial-label");
const probabilityInfoEl = document.getElementById("probability-info");
const pickHBtn = document.getElementById("pick-h");
const pickTBtn = document.getElementById("pick-t");

function otherOutcome(outcome) {
    return outcome === "H" ? "T" : "H";
}

function roundTo(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function pctFromRatio(value) {
    return `${Math.round(value * 100)}%`;
}

function signedPctFromRatio(value) {
    const percent = Math.round(value * 100);
    return `${percent > 0 ? "+" : ""}${percent}%`;
}

function randomInt(min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

function pickOne(values) {
    return values[Math.floor(rng() * values.length)];
}

function shuffle(values) {
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

function sampleOutcome(baseProbabilityH) {
    return rng() < baseProbabilityH ? "H" : "T";
}

function getTailStreak(context) {
    const last = context[context.length - 1];
    let streak = 1;
    for (let i = context.length - 2; i >= 0; i -= 1) {
        if (context[i] !== last) {
            break;
        }
        streak += 1;
    }
    return { last, streak };
}

function isAlternating(context) {
    for (let i = 1; i < context.length; i += 1) {
        if (context[i] === context[i - 1]) {
            return false;
        }
    }
    return true;
}

function createStreakContext() {
    const tail = pickOne(["H", "T"]);
    const streakLength = randomInt(STREAK_THRESHOLD, Math.min(6, HISTORY_SIZE));
    const prefixLength = HISTORY_SIZE - streakLength;
    const prefix = [];

    for (let i = 0; i < prefixLength; i += 1) {
        prefix.push(pickOne(["H", "T"]));
    }
    if (prefix.length > 0) {
        prefix[prefix.length - 1] = otherOutcome(tail);
    }

    return prefix.concat(Array(streakLength).fill(tail));
}

function createAlternationContext() {
    const first = pickOne(["H", "T"]);
    const context = [];
    for (let i = 0; i < HISTORY_SIZE; i += 1) {
        context.push(i % 2 === 0 ? first : otherOutcome(first));
    }
    return context;
}

function createBalancedContext() {
    const values = Array(HISTORY_SIZE / 2).fill("H").concat(Array(HISTORY_SIZE / 2).fill("T"));

    for (let attempt = 0; attempt < 80; attempt += 1) {
        const context = shuffle(values);
        const { streak } = getTailStreak(context);
        if (streak < STREAK_THRESHOLD && !isAlternating(context)) {
            return context;
        }
    }

    return ["H", "T", "T", "H", "H", "T", "H", "T"];
}

function createBiasedContext(baseProbabilityH) {
    const likely = baseProbabilityH > 0.5 ? "H" : "T";
    const tempting = otherOutcome(likely);
    const temptingCount = randomInt(5, 6);
    const context = Array(temptingCount).fill(tempting)
        .concat(Array(HISTORY_SIZE - temptingCount).fill(likely));

    return shuffle(context);
}

function createContext(condition, baseProbabilityH) {
    if (condition === "streak") {
        return createStreakContext();
    }
    if (condition === "alternation") {
        return createAlternationContext();
    }
    if (condition === "biasedCoin") {
        return createBiasedContext(baseProbabilityH);
    }
    return createBalancedContext();
}

function buildConditionPlan() {
    const plan = [];
    CONDITIONS.forEach((condition) => {
        for (let i = 0; i < CONDITION_COUNTS[condition]; i += 1) {
            plan.push(condition);
        }
    });
    return shuffle(plan);
}

function createTrial(index, condition) {
    const baseProbability = condition === "biasedCoin" ? pickOne(BIASED_BASE_PROBABILITIES) : 0.5;
    const context = createContext(condition, baseProbability);
    const { last, streak } = getTailStreak(context);
    const actualOutcome = sampleOutcome(baseProbability);

    return {
        index,
        trialId: `gf-${String(index + 1).padStart(2, "0")}`,
        condition,
        blockIndex: Math.floor(index / BLOCK_SIZE) + 1,
        context,
        sequenceContext: context.join(""),
        lastOutcome: last,
        streakLength: streak,
        baseProbability,
        actualOutcome
    };
}

function buildSessionTrials() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("gambler-fallacy") : `gambler-fallacy-${Date.now()}`;
    rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    sessionTrials = buildConditionPlan().map((condition, index) => createTrial(index, condition));
}

function moreLikelyOutcome(baseProbability) {
    if (baseProbability > 0.5) {
        return "H";
    }
    if (baseProbability < 0.5) {
        return "T";
    }
    return null;
}

function classifyPrediction(trial, predictedOutcome) {
    const opposite = otherOutcome(trial.lastOutcome);
    const likelyOutcome = moreLikelyOutcome(trial.baseProbability);
    const baseRateAligned = Boolean(likelyOutcome && predictedOutcome === likelyOutcome);
    const baseRateNeglect = Boolean(likelyOutcome && predictedOutcome !== likelyOutcome);
    const reversalOpportunity = trial.condition === "alternation" || trial.streakLength >= STREAK_THRESHOLD;
    const hotHandOpportunity = trial.streakLength >= STREAK_THRESHOLD;
    const reversalBias = reversalOpportunity && predictedOutcome === opposite && !baseRateAligned;
    const hotHandBias = hotHandOpportunity && predictedOutcome === trial.lastOutcome && !baseRateAligned;

    let biasType = "none";
    if (baseRateNeglect) {
        biasType = "baseRateNeglect";
    } else if (reversalBias) {
        biasType = "reversalBias";
    } else if (hotHandBias) {
        biasType = "hotHandBias";
    }

    return {
        biasType,
        reversalBias,
        hotHandBias,
        baseRateNeglect,
        reversalOpportunity,
        hotHandOpportunity,
        baseRateAligned,
        likelyOutcome
    };
}

function setChoiceButtonsDisabled(disabled) {
    pickHBtn.disabled = disabled;
    pickTBtn.disabled = disabled;
}

function renderHistory(context) {
    historyEl.innerHTML = "";
    context.forEach((item) => {
        const chip = document.createElement("div");
        chip.className = `gf-chip ${item.toLowerCase()}`;
        chip.textContent = item;
        historyEl.appendChild(chip);
    });
}

function conditionLabel(condition) {
    if (condition === "streak") {
        return "连串序列";
    }
    if (condition === "alternation") {
        return "交替序列";
    }
    if (condition === "biasedCoin") {
        return "非均匀基础概率";
    }
    return "均衡序列";
}

function renderTrial() {
    if (round >= sessionTrials.length) {
        return;
    }

    const trial = sessionTrials[round];
    const probabilityH = Math.round(trial.baseProbability * 100);
    const probabilityT = 100 - probabilityH;

    trialLabelEl.textContent = `第 ${round + 1} / ${sessionTrials.length} 轮 · 第 ${trial.blockIndex} 组 · ${conditionLabel(trial.condition)}`;
    probabilityInfoEl.innerHTML = `<span>H: ${probabilityH}%</span><span>T: ${probabilityT}%</span>`;
    feedbackEl.textContent = "请先区分短序列的直观印象和本轮独立事件的基础概率。";
    renderHistory(trial.context);
    setChoiceButtonsDisabled(false);
    acceptingChoice = true;
    trialStartedAtMs = Date.now();
}

function baseRateUseRate(log) {
    const baseTrials = log.filter((item) => item.likelyOutcome);
    if (baseTrials.length === 0) {
        return 0;
    }
    const aligned = baseTrials.filter((item) => item.predictedOutcome === item.likelyOutcome).length;
    return roundTo(aligned / baseTrials.length);
}

function rate(count, total) {
    return total === 0 ? 0 : roundTo(count / total);
}

function mean(values) {
    if (values.length === 0) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function repeatPredictionRate(items) {
    if (items.length === 0) {
        return 0;
    }
    return roundTo(items.filter((item) => item.predictedOutcome === item.lastOutcome).length / items.length);
}

function calibrationForItems(items) {
    const total = items.length;
    const correctCount = items.filter((item) => item.correct).length;
    const reversalOpportunityCount = items.filter((item) => item.reversalOpportunity).length;
    const hotHandOpportunityCount = items.filter((item) => item.hotHandOpportunity).length;
    const baseTrials = items.filter((item) => item.likelyOutcome);
    const expectedHitRates = items.map((item) => (
        item.predictedOutcome === "H" ? item.baseProbability : 1 - item.baseProbability
    ));

    return {
        total,
        correctCount,
        accuracy: rate(correctCount, total),
        predictedHRate: rate(items.filter((item) => item.predictedOutcome === "H").length, total),
        actualHRate: rate(items.filter((item) => item.actualOutcome === "H").length, total),
        reversalBiasRate: rate(items.filter((item) => item.reversalBias).length, reversalOpportunityCount),
        hotHandBiasRate: rate(items.filter((item) => item.hotHandBias).length, hotHandOpportunityCount),
        baseRateUse: rate(baseTrials.filter((item) => item.predictedOutcome === item.likelyOutcome).length, baseTrials.length),
        expectedHitRate: roundTo(mean(expectedHitRates)),
        meanRtMs: Math.round(mean(items.map((item) => item.rtMs)))
    };
}

function calibrationByCondition(log) {
    return CONDITIONS.reduce((result, condition) => {
        result[condition] = calibrationForItems(log.filter((item) => item.condition === condition));
        return result;
    }, {});
}

function computeMetrics(log = trialLog) {
    const total = log.length;
    const correctCount = log.filter((item) => item.correct).length;
    const reversalOpportunityCount = log.filter((item) => item.reversalOpportunity).length;
    const hotHandOpportunityCount = log.filter((item) => item.hotHandOpportunity).length;
    const streakItems = log.filter((item) => item.streakLength >= STREAK_THRESHOLD);
    const balancedItems = log.filter((item) => item.condition === "balanced");
    const streakRepeatRate = repeatPredictionRate(streakItems);
    const balancedRepeatRate = repeatPredictionRate(balancedItems);
    const reversalBiasRate = rate(log.filter((item) => item.reversalBias).length, reversalOpportunityCount);
    const hotHandBiasRate = rate(log.filter((item) => item.hotHandBias).length, hotHandOpportunityCount);
    const baseRateUse = baseRateUseRate(log);
    const streakSensitivity = roundTo(streakRepeatRate - balancedRepeatRate);
    const byCondition = calibrationByCondition(log);
    const nextParameters = createNextParameters({
        reversalBiasRate,
        hotHandBiasRate,
        baseRateUse,
        streakSensitivity
    });

    return {
        total,
        correctCount,
        accuracy: rate(correctCount, total),
        reversalBiasRate,
        hotHandBiasRate,
        baseRateUse,
        streakSensitivity,
        streakRepeatRate,
        balancedRepeatRate,
        meanRtMs: Math.round(mean(log.map((item) => item.rtMs))),
        calibrationByCondition: byCondition,
        nextParameters
    };
}

function createNextParameters(metrics) {
    const focus = [];
    if (metrics.reversalBiasRate >= 0.45) {
        focus.push("streak-independence");
    }
    if (metrics.hotHandBiasRate >= 0.45) {
        focus.push("representativeness-cue");
    }
    if (metrics.baseRateUse < 0.65) {
        focus.push("base-probability");
    }
    if (focus.length === 0) {
        focus.push("mixed-calibration");
    }

    return {
        totalRounds: TOTAL_ROUNDS,
        focus,
        conditionWeights: {
            streak: metrics.reversalBiasRate >= 0.45 || metrics.hotHandBiasRate >= 0.45 ? 0.32 : 0.25,
            alternation: metrics.reversalBiasRate >= 0.45 ? 0.28 : 0.25,
            balanced: 0.2,
            biasedCoin: metrics.baseRateUse < 0.65 ? 0.32 : 0.25
        },
        baseProbabilityRange: metrics.baseRateUse < 0.65 ? [0.25, 0.75] : [0.35, 0.65],
        minStreakLength: metrics.reversalBiasRate >= 0.45 || metrics.hotHandBiasRate >= 0.45 ? 4 : STREAK_THRESHOLD,
        feedbackMode: "independence-and-long-run-frequency"
    };
}

function updateStats() {
    const metrics = computeMetrics();
    const acc = pctFromRatio(metrics.accuracy);

    document.getElementById("round").textContent = String(round);
    document.getElementById("round-total").textContent = String(sessionTrials.length || TOTAL_ROUNDS);
    document.getElementById("acc").textContent = acc;
    document.getElementById("reversal-rate").textContent = pctFromRatio(metrics.reversalBiasRate);
    document.getElementById("base-use-rate").textContent = pctFromRatio(metrics.baseRateUse);
}

function startGame() {
    round = 0;
    correct = 0;
    trialLog = [];
    trialStartedAtMs = 0;
    acceptingChoice = false;
    sessionStartedAt = new Date();
    buildSessionTrials();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";

    updateStats();
    renderTrial();
}

function buildFeedback(trial, predictedOutcome, isCorrect, bias) {
    const probabilityH = Math.round(trial.baseProbability * 100);
    const probabilityT = 100 - probabilityH;
    const hitText = isCorrect ? "这次命中" : "这次没有命中";
    const independenceText = `本轮结果为 ${trial.actualOutcome}，${hitText}。下一次仍按当轮基础概率抽样，H ${probabilityH}% / T ${probabilityT}%。`;

    if (bias.baseRateNeglect) {
        return `${independenceText} 这轮你的预测更贴近短序列印象，而不是较高的基础概率。`;
    }
    if (bias.reversalBias) {
        return `${independenceText} 连串或交替序列不会让下一次自动补偿反转。`;
    }
    if (bias.hotHandBias) {
        return `${independenceText} 连串看起来有代表性，但独立事件不会因为刚出现过就提高同面概率。`;
    }
    if (predictedOutcome === bias.likelyOutcome) {
        return `${independenceText} 这轮预测与较高基础概率一致，单次结果仍会波动。`;
    }
    return `${independenceText} 短期序列会波动，长期频率才会逐步靠近基础概率。`;
}

function choose(predictedOutcome) {
    if (!acceptingChoice || round >= sessionTrials.length) {
        return;
    }

    acceptingChoice = false;
    setChoiceButtonsDisabled(true);

    const answeredAt = new Date();
    const trial = sessionTrials[round];
    const rtMs = trialStartedAtMs ? Math.max(0, answeredAt.getTime() - trialStartedAtMs) : 0;
    const isCorrect = predictedOutcome === trial.actualOutcome;
    const bias = classifyPrediction(trial, predictedOutcome);
    const trialRecord = {
        index: round,
        round: round + 1,
        trialId: trial.trialId,
        blockIndex: trial.blockIndex,
        condition: trial.condition,
        sequenceCondition: trial.condition,
        sequenceContext: trial.sequenceContext,
        sequenceContextList: trial.context.slice(),
        lastOutcome: trial.lastOutcome,
        streakLength: trial.streakLength,
        baseProbability: trial.baseProbability,
        baseProbabilityH: trial.baseProbability,
        baseProbabilityT: roundTo(1 - trial.baseProbability),
        predictedOutcome,
        actualOutcome: trial.actualOutcome,
        biasType: bias.biasType,
        reversalBias: bias.reversalBias,
        hotHandBias: bias.hotHandBias,
        baseRateNeglect: bias.baseRateNeglect,
        reversalOpportunity: bias.reversalOpportunity,
        hotHandOpportunity: bias.hotHandOpportunity,
        likelyOutcome: bias.likelyOutcome,
        correct: isCorrect,
        rtMs,
        submittedAt: answeredAt.toISOString()
    };

    trialLog.push(trialRecord);
    if (isCorrect) {
        correct += 1;
    }

    feedbackEl.textContent = buildFeedback(trial, predictedOutcome, isCorrect, bias);
    round += 1;
    updateStats();

    if (round >= sessionTrials.length) {
        setTimeout(finish, 900);
        return;
    }

    setTimeout(renderTrial, 900);
}

function finish() {
    const metrics = computeMetrics();
    const acc = Math.round(metrics.accuracy * 100);
    const finishedAt = new Date();
    const durationMs = sessionStartedAt ? finishedAt.getTime() - sessionStartedAt.getTime() : 0;
    const trialOrder = sessionTrials.map((item) => item.trialId);

    document.getElementById("result-acc").textContent = pctFromRatio(metrics.accuracy);
    document.getElementById("result-reversal").textContent = pctFromRatio(metrics.reversalBiasRate);
    document.getElementById("result-base-use").textContent = pctFromRatio(metrics.baseRateUse);
    document.getElementById("result-streak-sensitivity").textContent = signedPctFromRatio(metrics.streakSensitivity);

    let message = "本轮结果展示了短序列波动和长期频率之间的差异。下一轮会继续混合连串、交替、均衡和非均匀基础概率。";
    if (metrics.baseRateUse < 0.5) {
        message = "本轮更常让短序列印象压过基础概率。后续训练会增加基础概率冲突题。";
    } else if (metrics.reversalBiasRate >= 0.5) {
        message = "本轮连串或交替后反转预测偏多。后续训练会继续强调每次抽样相互独立。";
    } else if (metrics.hotHandBiasRate >= 0.5) {
        message = "本轮连串后顺势预测偏多。后续训练会继续区分代表性印象和独立概率。";
    }
    document.getElementById("result-text").textContent = message;

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            moduleId: "gambler-fallacy",
            gameId: "gambler-fallacy",
            gameName: "随机性校准训练",
            startedAt: sessionStartedAt || finishedAt,
            finishedAt,
            durationMs,
            score: acc,
            summary: {
                totalTrials: metrics.total,
                correctCount: metrics.correctCount,
                accuracy: metrics.accuracy,
                reversalBiasRate: metrics.reversalBiasRate,
                hotHandBiasRate: metrics.hotHandBiasRate,
                streakSensitivity: metrics.streakSensitivity,
                baseRateUse: metrics.baseRateUse,
                calibrationByCondition: metrics.calibrationByCondition,
                nextParameters: metrics.nextParameters,
                meanRtMs: metrics.meanRtMs,
                contentVersion: CONTENT_VERSION,
                sessionSeed,
                trialOrder,
                theoryAnchors: ["representativeness-heuristic", "law-of-small-numbers", "independent-events"]
            },
            trials: trialLog.map((item) => ({ ...item })),
            metrics: {
                accuracy: acc,
                accuracyRate: metrics.accuracy,
                reversalBiasRate: metrics.reversalBiasRate,
                hotHandBiasRate: metrics.hotHandBiasRate,
                streakSensitivity: metrics.streakSensitivity,
                baseRateUse: metrics.baseRateUse,
                calibrationByCondition: metrics.calibrationByCondition,
                nextParameters: metrics.nextParameters,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                trialOrder
            },
            tags: ["probability", "gambler-fallacy", "randomness", "independent-events"]
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

pickHBtn.addEventListener("click", () => choose("H"));
pickTBtn.addEventListener("click", () => choose("T"));

window.startGame = startGame;
