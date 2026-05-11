const MODULE_ID = "task-switching";
const GAME_NAME = "任务切换";
const CONTENT_VERSION = "task-switching-adaptive-csi-v2";
const TOTAL_TRIALS = 40;
const PRACTICE_TRIALS = 12;
const MIN_RT_MS = 100;
const RESPONSE_INTERVAL_MS = 400;
const STIMULI = [1, 2, 3, 4, 6, 7, 8, 9];
const TASKS = ["parity", "magnitude"];
const CUE_DELAYS_MS = [500, 650, 800];
const ADAPTIVE_BLOCK_SIZE = 8;
const BASE_SWITCH_PROBABILITY = 0.5;
const MIN_SWITCH_PROBABILITY = 0.25;
const MAX_SWITCH_PROBABILITY = 0.75;
const SWITCH_PROBABILITY_STEP = 0.1;
const BASE_CUE_DELAY_MS = 650;
const MIN_CUE_DELAY_MS = 450;
const MAX_CUE_DELAY_MS = 950;
const CUE_DELAY_STEP_MS = 100;
const COLORS = {
    parity: "#3498db",
    magnitude: "#e67e22"
};

let currentTrial = 0;
let totalTrials = TOTAL_TRIALS;
let trials = [];
let responses = [];
let isGameActive = false;
let trialStartTime = 0;
let canRespond = false;
let currentPhase = "test";
let sessionStartedAt = null;
let sessionSeed = "";
let sessionRng = null;
let cueTimer = null;
let sessionSaved = false;
let isAdaptiveMode = true;
let switchProbability = BASE_SWITCH_PROBABILITY;
let cueDelayMs = BASE_CUE_DELAY_MS;
let adaptationEvents = [];
let switchCueProgression = [];
let generatedPreviousTask = null;

// DOM Elements
const instructionOverlay = document.getElementById("instruction-overlay");
const gameDisplay = document.getElementById("ts-display");
const stimulusCard = document.getElementById("stimulus-card");
const stimulusNumber = document.getElementById("stimulus-number");
const resultModal = document.getElementById("result-modal");
const accuracyDisplay = document.getElementById("accuracy");
const progressDisplay = document.getElementById("trial-progress");
const switchCostDisplay = document.getElementById("switch-cost");
const phaseLabel = document.getElementById("phase-label");
const prestartActions = document.getElementById("prestart-actions");
const practiceStatus = document.getElementById("practice-status");
const finalFeedback = document.getElementById("final-feedback");
const adaptiveModeInput = document.getElementById("adaptive-mode");
const finalAdaptiveState = document.getElementById("final-adaptive-state");

document.addEventListener("keydown", (e) => {
    if (!isGameActive || !canRespond) return;
    if (e.repeat) return;

    const key = e.key.toLowerCase();
    if (key === "a" || key === "l") {
        handleResponse(key);
    }
});

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

function shuffleInPlace(list, rng) {
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function mean(values) {
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ratio(count, total) {
    return total === 0 ? 0 : Math.round((count / total) * 1000) / 1000;
}

function roundMetric(value) {
    return Math.round(value * 1000) / 1000;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function oppositeTask(task) {
    return task === "parity" ? "magnitude" : "parity";
}

function expectedResponse(task, number) {
    if (task === "parity") {
        return number % 2 !== 0 ? "a" : "l";
    }
    return number < 5 ? "a" : "l";
}

function taskCueText(task) {
    return task === "parity" ? "奇偶" : "大小";
}

function updatePhaseLabel() {
    const phaseText = currentPhase === "practice" ? "练习模式" : "正式训练";
    const modeText = isAdaptiveMode
        ? `自适应 · 切换${formatPercent(switchProbability)} · 线索${cueDelayMs}ms`
        : "固定平衡";
    phaseLabel.textContent = `${phaseText} · ${modeText}`;
}

function handleButtonClick(key) {
    if (!isGameActive || !canRespond) return;
    handleResponse(key);
}

function startGame() {
    beginSession("test");
}

function startPractice() {
    beginSession("practice");
}

function beginSession(phase) {
    currentPhase = phase;
    totalTrials = phase === "practice" ? PRACTICE_TRIALS : TOTAL_TRIALS;
    isGameActive = true;
    canRespond = false;
    currentTrial = 0;
    sessionStartedAt = new Date();
    sessionSeed = createSessionSeed();
    sessionRng = createRng(`${sessionSeed}:${CONTENT_VERSION}:${phase}`);
    sessionSaved = false;
    isAdaptiveMode = phase === "test" && adaptiveModeInput ? Boolean(adaptiveModeInput.checked) : false;
    switchProbability = BASE_SWITCH_PROBABILITY;
    cueDelayMs = BASE_CUE_DELAY_MS;
    adaptationEvents = [];
    switchCueProgression = [{
        afterTrial: 0,
        switchProbability,
        cueDelayMs,
        reason: isAdaptiveMode ? "adaptive-session-start" : "fixed-balanced-start"
    }];
    generatedPreviousTask = TASKS[Math.floor(sessionRng() * TASKS.length)];
    trials = isAdaptiveMode ? [] : generateTrials(totalTrials, sessionRng);
    responses = [];

    if (cueTimer) {
        clearTimeout(cueTimer);
        cueTimer = null;
    }

    instructionOverlay.style.display = "none";
    gameDisplay.style.display = "flex";
    resultModal.style.display = "none";
    updatePhaseLabel();
    progressDisplay.textContent = `0/${totalTrials}`;
    accuracyDisplay.textContent = "0%";
    switchCostDisplay.textContent = "-- ms";
    practiceStatus.style.display = "none";
    if (finalFeedback) finalFeedback.textContent = "";

    setTimeout(runTrial, 600);
}

function generateConditionPlan(count, rng) {
    if (count <= 0) return [];
    const plan = ["start"];
    const remaining = count - 1;
    const switchCount = Math.floor(remaining / 2);
    const repeatCount = remaining - switchCount;
    const rest = [
        ...Array.from({ length: switchCount }, () => "switch"),
        ...Array.from({ length: repeatCount }, () => "repeat")
    ];
    shuffleInPlace(rest, rng);
    return plan.concat(rest);
}

function generateAdaptiveConditionPlan(count, probability, isFirstBlock, rng) {
    if (count <= 0) return [];
    const plan = [];
    const firstTrialCount = isFirstBlock ? 1 : 0;

    if (isFirstBlock) {
        plan.push("start");
    }

    const remaining = count - firstTrialCount;
    const switchCount = clampNumber(Math.round(remaining * probability), 0, remaining);
    const repeatCount = remaining - switchCount;
    const rest = [
        ...Array.from({ length: switchCount }, () => "switch"),
        ...Array.from({ length: repeatCount }, () => "repeat")
    ];
    shuffleInPlace(rest, rng);
    return plan.concat(rest);
}

function generateTrials(count, rng = Math.random) {
    const trialList = [];
    const conditionPlan = generateConditionPlan(count, rng);
    let previousTask = TASKS[Math.floor(rng() * TASKS.length)];

    for (let i = 0; i < count; i += 1) {
        const condition = conditionPlan[i] || "repeat";
        const task = condition === "switch"
            ? (previousTask === "parity" ? "magnitude" : "parity")
            : previousTask;
        const number = STIMULI[Math.floor(rng() * STIMULI.length)];
        const cueDelayMs = CUE_DELAYS_MS[i % CUE_DELAYS_MS.length];

        trialList.push({
            index: i,
            task,
            number,
            stimulus: number,
            condition,
            isSwitch: condition === "switch",
            expectedResponse: expectedResponse(task, number),
            correctAnswer: expectedResponse(task, number),
            cueDelayMs,
            switchProbability: BASE_SWITCH_PROBABILITY,
            adaptiveMode: false,
            adaptiveBlockIndex: Math.floor(i / ADAPTIVE_BLOCK_SIZE),
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        });

        previousTask = task;
    }
    return trialList;
}

function generateAdaptiveTrialsIfNeeded(targetCount) {
    if (!isAdaptiveMode) return;
    while (trials.length < targetCount && trials.length < totalTrials) {
        const blockStartIndex = trials.length;
        const blockSize = Math.min(ADAPTIVE_BLOCK_SIZE, totalTrials - blockStartIndex);
        const blockIndex = Math.floor(blockStartIndex / ADAPTIVE_BLOCK_SIZE);
        const conditionPlan = generateAdaptiveConditionPlan(
            blockSize,
            switchProbability,
            blockIndex === 0,
            sessionRng
        );

        for (let offset = 0; offset < blockSize; offset += 1) {
            const index = blockStartIndex + offset;
            const condition = conditionPlan[offset] || "repeat";
            const task = condition === "switch"
                ? oppositeTask(generatedPreviousTask)
                : generatedPreviousTask;
            const number = STIMULI[Math.floor(sessionRng() * STIMULI.length)];

            trials.push({
                index,
                task,
                number,
                stimulus: number,
                condition,
                isSwitch: condition === "switch",
                expectedResponse: expectedResponse(task, number),
                correctAnswer: expectedResponse(task, number),
                cueDelayMs,
                switchProbability: roundMetric(switchProbability),
                adaptiveMode: true,
                adaptiveBlockIndex: blockIndex,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            });

            generatedPreviousTask = task;
        }
    }
}

function runTrial() {
    if (currentTrial >= totalTrials) {
        endSession();
        return;
    }

    generateAdaptiveTrialsIfNeeded(currentTrial + 1);
    const trial = trials[currentTrial];
    progressDisplay.textContent = `${currentTrial + 1}/${totalTrials}`;
    stimulusCard.style.backgroundColor = COLORS[trial.task];
    stimulusNumber.textContent = taskCueText(trial.task);
    stimulusNumber.style.visibility = "visible";
    canRespond = false;

    cueTimer = setTimeout(() => {
        cueTimer = null;
        if (!isGameActive || currentTrial >= totalTrials) return;
        stimulusNumber.textContent = trial.number;
        canRespond = true;
        trialStartTime = Date.now();
    }, trial.cueDelayMs);
}

function recordResponse(key, rt, tooFast) {
    const trial = trials[currentTrial];
    const isCorrect = !tooFast && key === trial.expectedResponse;
    const errorType = tooFast ? "too_fast" : (isCorrect ? "none" : "wrong_key");

    responses.push({
        ...trial,
        rt,
        rtMs: rt,
        correct: isCorrect,
        userKey: key,
        response: key,
        tooFast,
        errorType,
        respondedAt: new Date().toISOString()
    });

    if (!isCorrect) {
        stimulusCard.classList.add("shake");
        setTimeout(() => stimulusCard.classList.remove("shake"), 260);
    }
}

function handleResponse(key) {
    if (!isGameActive || !canRespond) return;

    canRespond = false;
    const rt = Date.now() - trialStartTime;
    const tooFast = rt < MIN_RT_MS;
    recordResponse(key, rt, tooFast);

    updateLiveStats();
    stimulusNumber.style.visibility = "hidden";
    currentTrial += 1;
    maybeAdjustAdaptiveDifficulty(currentTrial);

    setTimeout(runTrial, RESPONSE_INTERVAL_MS);
}

function updateLiveStats() {
    const correctCount = responses.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / responses.length) * 100) || 0;
    accuracyDisplay.textContent = `${accuracy}%`;
}

function summarizeConditionFrom(list, condition) {
    const conditionResponses = list.filter(r => r.condition === condition);
    const correctResponses = conditionResponses.filter(r => r.correct);
    const correctRt = correctResponses.map(r => r.rtMs);
    return {
        count: conditionResponses.length,
        correctCount: correctResponses.length,
        accuracy: ratio(correctResponses.length, conditionResponses.length),
        meanRtMs: mean(correctRt),
        errorRate: ratio(conditionResponses.length - correctResponses.length, conditionResponses.length)
    };
}

function summarizeCondition(condition) {
    return summarizeConditionFrom(responses, condition);
}

function summarizeBlock(blockResponses, blockIndex) {
    const repeatStats = summarizeConditionFrom(blockResponses, "repeat");
    const switchStats = summarizeConditionFrom(blockResponses, "switch");
    const correctResponses = blockResponses.filter(r => r.correct);
    const correctRt = correctResponses.map(r => r.rtMs);
    const tooFastCount = blockResponses.filter(r => r.tooFast).length;
    const cueDelayValues = blockResponses.map(r => Number(r.cueDelayMs) || 0);
    const switchProbabilityValues = blockResponses.map(r => Number(r.switchProbability) || 0);
    return {
        blockIndex,
        startTrial: blockResponses.length > 0 ? blockResponses[0].index : blockIndex * ADAPTIVE_BLOCK_SIZE,
        endTrial: blockResponses.length > 0 ? blockResponses[blockResponses.length - 1].index : blockIndex * ADAPTIVE_BLOCK_SIZE,
        totalTrials: blockResponses.length,
        correctCount: correctResponses.length,
        accuracy: ratio(correctResponses.length, blockResponses.length),
        meanRtMs: mean(correctRt),
        repeatCount: repeatStats.count,
        switchCount: switchStats.count,
        repeatAccuracy: repeatStats.accuracy,
        switchAccuracy: switchStats.accuracy,
        repeatRtMs: repeatStats.meanRtMs,
        switchRtMs: switchStats.meanRtMs,
        switchCostMs: switchStats.meanRtMs > 0 && repeatStats.meanRtMs > 0
            ? Math.round(switchStats.meanRtMs - repeatStats.meanRtMs)
            : 0,
        tooFastCount,
        switchProbability: roundMetric(switchProbabilityValues.length
            ? switchProbabilityValues.reduce((sum, value) => sum + value, 0) / switchProbabilityValues.length
            : BASE_SWITCH_PROBABILITY),
        cueDelayMs: Math.round(cueDelayValues.length ? mean(cueDelayValues) : BASE_CUE_DELAY_MS)
    };
}

function calculateBlockSummaries() {
    const blockSummaries = [];
    for (let start = 0; start < responses.length; start += ADAPTIVE_BLOCK_SIZE) {
        const blockResponses = responses.slice(start, Math.min(start + ADAPTIVE_BLOCK_SIZE, responses.length));
        if (!blockResponses.length) continue;
        blockSummaries.push(summarizeBlock(blockResponses, blockSummaries.length));
    }
    return blockSummaries;
}

function adaptiveDecision(blockSummary) {
    const highSwitchCost = blockSummary.switchCount > 0 && blockSummary.repeatCount > 0 && blockSummary.switchCostMs > 180;
    const lowSwitchAccuracy = blockSummary.switchCount > 0 && blockSummary.switchAccuracy < 0.7;
    const weakRepeatAccuracy = blockSummary.repeatCount > 0 && blockSummary.repeatAccuracy < 0.75;
    const tooFast = blockSummary.tooFastCount >= 2;
    const stableSwitching = blockSummary.switchCount > 0
        && blockSummary.repeatCount > 0
        && blockSummary.switchCostMs <= 120
        && blockSummary.switchAccuracy >= 0.85
        && blockSummary.repeatAccuracy >= 0.85
        && blockSummary.tooFastCount === 0;

    if (tooFast || highSwitchCost || lowSwitchAccuracy || weakRepeatAccuracy) {
        return {
            switchProbability: clampNumber(switchProbability - SWITCH_PROBABILITY_STEP, MIN_SWITCH_PROBABILITY, MAX_SWITCH_PROBABILITY),
            cueDelayMs: clampNumber(cueDelayMs + CUE_DELAY_STEP_MS, MIN_CUE_DELAY_MS, MAX_CUE_DELAY_MS),
            direction: "support",
            reason: tooFast
                ? "过快响应偏多，增加线索准备时间并降低切换比例。"
                : "最近一组切换成本或准确率未达标，降低切换密度并延长线索。"
        };
    }

    if (stableSwitching) {
        return {
            switchProbability: clampNumber(switchProbability + SWITCH_PROBABILITY_STEP, MIN_SWITCH_PROBABILITY, MAX_SWITCH_PROBABILITY),
            cueDelayMs: clampNumber(cueDelayMs - CUE_DELAY_STEP_MS, MIN_CUE_DELAY_MS, MAX_CUE_DELAY_MS),
            direction: "challenge",
            reason: "最近一组切换成本低且准确率稳定，提高切换比例并缩短线索。"
        };
    }

    return {
        switchProbability,
        cueDelayMs,
        direction: "hold",
        reason: "最近一组处于训练区间，保持当前切换比例和线索时长。"
    };
}

function maybeAdjustAdaptiveDifficulty(completedTrials) {
    if (!isAdaptiveMode || completedTrials < ADAPTIVE_BLOCK_SIZE || completedTrials >= totalTrials) return;
    if (completedTrials % ADAPTIVE_BLOCK_SIZE !== 0) return;

    const blockIndex = Math.floor(completedTrials / ADAPTIVE_BLOCK_SIZE) - 1;
    const blockResponses = responses.slice(completedTrials - ADAPTIVE_BLOCK_SIZE, completedTrials);
    const blockSummary = summarizeBlock(blockResponses, blockIndex);
    const fromSwitchProbability = switchProbability;
    const fromCueDelayMs = cueDelayMs;
    const decision = adaptiveDecision(blockSummary);

    switchProbability = decision.switchProbability;
    cueDelayMs = decision.cueDelayMs;

    const event = {
        afterTrial: completedTrials,
        blockIndex,
        fromSwitchProbability: roundMetric(fromSwitchProbability),
        toSwitchProbability: roundMetric(switchProbability),
        fromCueDelayMs,
        toCueDelayMs: cueDelayMs,
        direction: decision.direction,
        reason: decision.reason,
        blockSummary
    };

    adaptationEvents.push(event);
    switchCueProgression.push({
        afterTrial: completedTrials,
        switchProbability: roundMetric(switchProbability),
        cueDelayMs,
        reason: decision.direction
    });
    updatePhaseLabel();
}

function buildNextTrainingRange(results) {
    let targetSwitchProbability = switchProbability;
    let targetCueDelayMs = cueDelayMs;
    let reason = "维持当前训练区间，继续观察切换成本和错误分布。";

    if (results.tooFastCount > 0) {
        targetSwitchProbability = clampNumber(targetSwitchProbability - SWITCH_PROBABILITY_STEP, MIN_SWITCH_PROBABILITY, MAX_SWITCH_PROBABILITY);
        targetCueDelayMs = clampNumber(targetCueDelayMs + CUE_DELAY_STEP_MS, MIN_CUE_DELAY_MS, MAX_CUE_DELAY_MS);
        reason = "过快响应仍需控制，下一轮降低切换比例并拉长线索。";
    } else if (results.switchAccuracy < 0.75 || results.switchCostMs > 180) {
        targetSwitchProbability = clampNumber(targetSwitchProbability - SWITCH_PROBABILITY_STEP, MIN_SWITCH_PROBABILITY, MAX_SWITCH_PROBABILITY);
        targetCueDelayMs = clampNumber(targetCueDelayMs + CUE_DELAY_STEP_MS, MIN_CUE_DELAY_MS, MAX_CUE_DELAY_MS);
        reason = "切换成本高或切换正确率低，下一轮先回到更可控的切换密度。";
    } else if (results.switchAccuracy >= 0.85 && results.repeatAccuracy >= 0.85 && results.switchCostMs <= 120) {
        targetSwitchProbability = clampNumber(targetSwitchProbability + SWITCH_PROBABILITY_STEP, MIN_SWITCH_PROBABILITY, MAX_SWITCH_PROBABILITY);
        targetCueDelayMs = clampNumber(targetCueDelayMs - CUE_DELAY_STEP_MS, MIN_CUE_DELAY_MS, MAX_CUE_DELAY_MS);
        reason = "切换表现稳定，下一轮可以增加切换比例并缩短准备线索。";
    }

    return {
        switchProbabilityMin: roundMetric(clampNumber(targetSwitchProbability - 0.05, MIN_SWITCH_PROBABILITY, MAX_SWITCH_PROBABILITY)),
        switchProbabilityMax: roundMetric(clampNumber(targetSwitchProbability + 0.05, MIN_SWITCH_PROBABILITY, MAX_SWITCH_PROBABILITY)),
        cueDelayMinMs: clampNumber(targetCueDelayMs - 50, MIN_CUE_DELAY_MS, MAX_CUE_DELAY_MS),
        cueDelayMaxMs: clampNumber(targetCueDelayMs + 50, MIN_CUE_DELAY_MS, MAX_CUE_DELAY_MS),
        reason
    };
}

function calculateResults() {
    const correctResponses = responses.filter(r => r.correct);
    const repeatStats = summarizeCondition("repeat");
    const switchStats = summarizeCondition("switch");
    const correctRt = correctResponses.map(r => r.rtMs);
    const tooFastCount = responses.filter(r => r.tooFast).length;
    const blockSummaries = calculateBlockSummaries();
    const switchCostMs = switchStats.meanRtMs > 0 && repeatStats.meanRtMs > 0
        ? Math.round(switchStats.meanRtMs - repeatStats.meanRtMs)
        : 0;
    const switchErrorCost = Math.round((switchStats.errorRate - repeatStats.errorRate) * 1000) / 1000;
    const accuracy = ratio(correctResponses.length, totalTrials);

    const summary = {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        phase: currentPhase,
        sessionType: isAdaptiveMode ? "adaptive-switch-cue" : "fixed-balanced",
        isAdaptive: isAdaptiveMode,
        adaptationBlockSize: ADAPTIVE_BLOCK_SIZE,
        totalTrials,
        completedTrials: responses.length,
        correctCount: correctResponses.length,
        accuracy,
        meanRtMs: mean(correctRt),
        repeatRT: repeatStats.meanRtMs,
        switchRT: switchStats.meanRtMs,
        repeatRtMs: repeatStats.meanRtMs,
        switchRtMs: switchStats.meanRtMs,
        switchCostMs,
        repeatAccuracy: repeatStats.accuracy,
        switchAccuracy: switchStats.accuracy,
        switchErrorCost,
        errorSwitchCost: switchErrorCost,
        repeatCount: repeatStats.count,
        switchCount: switchStats.count,
        tooFastCount,
        startingSwitchProbability: BASE_SWITCH_PROBABILITY,
        finalSwitchProbability: roundMetric(switchProbability),
        startingCueDelayMs: BASE_CUE_DELAY_MS,
        finalCueDelayMs: cueDelayMs,
        switchProbabilityRange: [MIN_SWITCH_PROBABILITY, MAX_SWITCH_PROBABILITY],
        cueDelayRangeMs: [MIN_CUE_DELAY_MS, MAX_CUE_DELAY_MS],
        cueDelaysMs: isAdaptiveMode ? [...new Set(trials.map(trial => trial.cueDelayMs))] : CUE_DELAYS_MS.slice(),
        switchCueProgression: switchCueProgression.map(item => ({ ...item })),
        adaptationEvents: adaptationEvents.map(item => ({ ...item })),
        blockSummaries
    };

    return {
        ...summary,
        nextTrainingRange: buildNextTrainingRange(summary)
    };
}

function buildFeedback(results) {
    const next = results.nextTrainingRange;
    const switchCostText = results.switchCostMs > 150
        ? "切换成本偏高，下一轮先降低切换密度并给足线索准备时间。"
        : "切换成本可控，下一轮可以保持速度并观察错误是否集中在切换试次。";
    const errorText = results.switchAccuracy < 0.75 || results.switchAccuracy < results.repeatAccuracy
        ? "切换试次正确率低于目标区间，规则转换阶段仍是主要负荷。"
        : "切换试次正确率没有明显落后，当前主要训练点可转向提速和稳定性。";
    const fastText = results.tooFastCount > 0
        ? `本轮记录 ${results.tooFastCount} 次过快响应，已按错误试次处理。`
        : "本轮没有过快响应。";
    const nextText = next
        ? `下一轮训练区间：切换比例 ${formatPercent(next.switchProbabilityMin)}-${formatPercent(next.switchProbabilityMax)}，线索 ${next.cueDelayMinMs}-${next.cueDelayMaxMs}ms。${next.reason}`
        : "";
    return `${switchCostText}${errorText}${fastText}${nextText}`;
}

function endSession() {
    isGameActive = false;
    canRespond = false;
    if (cueTimer) {
        clearTimeout(cueTimer);
        cueTimer = null;
    }

    const results = calculateResults();
    const finishedAt = new Date();

    if (currentPhase === "practice") {
        gameDisplay.style.display = "none";
        instructionOverlay.style.display = "flex";
        practiceStatus.style.display = "block";
        practiceStatus.textContent = `练习完成：正确率 ${Math.round(results.accuracy * 100)}% ，可以开始正式测试。`;
        prestartActions.innerHTML = '<button class="start-btn" onclick="startGame()">开始正式测试</button>';
        progressDisplay.textContent = `0/${TOTAL_TRIALS}`;
        accuracyDisplay.textContent = "0%";
        switchCostDisplay.textContent = "-- ms";
        return;
    }

    document.getElementById("final-accuracy").textContent = `${Math.round(results.accuracy * 100)}%`;
    document.getElementById("final-rt").textContent = `${results.meanRtMs} ms`;
    document.getElementById("final-switch-cost").textContent = `${results.switchCostMs} ms`;
    switchCostDisplay.textContent = `${results.switchCostMs} ms`;
    if (finalFeedback) finalFeedback.textContent = buildFeedback(results);
    if (finalAdaptiveState) {
        finalAdaptiveState.textContent = results.isAdaptive
            ? `自适应记录：${results.adaptationEvents.length} 次评估，切换比例 ${formatPercent(results.startingSwitchProbability)}→${formatPercent(results.finalSwitchProbability)}，线索 ${results.startingCueDelayMs}→${results.finalCueDelayMs}ms。`
            : "本轮使用固定平衡切换比例。";
    }
    gameDisplay.style.display = "none";
    resultModal.style.display = "flex";

    if (!sessionSaved && window.TrainingResults && typeof window.TrainingResults.saveSession === "function") {
        window.TrainingResults.saveSession({
            moduleId: MODULE_ID,
            gameId: MODULE_ID,
            gameName: GAME_NAME,
            startedAt: sessionStartedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - sessionStartedAt.getTime(),
            score: Math.round(results.accuracy * 100),
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary: results,
            trials: responses.map((item) => ({
                index: item.index,
                task: item.task,
                number: item.number,
                stimulus: item.stimulus,
                condition: item.condition,
                isSwitch: item.isSwitch,
                expectedResponse: item.expectedResponse,
                cueDelayMs: item.cueDelayMs,
                switchProbability: item.switchProbability,
                adaptiveBlockIndex: item.adaptiveBlockIndex,
                rtMs: item.rtMs,
                correct: item.correct,
                userKey: item.userKey,
                response: item.response,
                tooFast: item.tooFast,
                errorType: item.errorType
            })),
            metrics: {
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                accuracy: results.accuracy,
                meanRtMs: results.meanRtMs,
                repeatRT: results.repeatRT,
                switchRT: results.switchRT,
                switchCostMs: results.switchCostMs,
                repeatAccuracy: results.repeatAccuracy,
                switchAccuracy: results.switchAccuracy,
                switchErrorCost: results.switchErrorCost,
                repeatCount: results.repeatCount,
                switchCount: results.switchCount,
                tooFastCount: results.tooFastCount,
                isAdaptive: results.isAdaptive,
                finalSwitchProbability: results.finalSwitchProbability,
                finalCueDelayMs: results.finalCueDelayMs,
                adaptationEvents: results.adaptationEvents,
                switchCueProgression: results.switchCueProgression,
                blockSummaries: results.blockSummaries,
                nextTrainingRange: results.nextTrainingRange
            },
            tags: ["executive", "task-switching", "cognitive-flexibility"]
        });
        sessionSaved = true;
    }
}

window.startGame = startGame;
window.startPractice = startPractice;
window.handleButtonClick = handleButtonClick;
