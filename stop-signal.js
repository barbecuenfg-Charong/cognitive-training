const MODULE_ID = "stop-signal";
const GAME_NAME = "停止信号任务";
const CONTENT_VERSION = "stop-signal-p0c-inhibition-v1";

const TOTAL_TRIALS = 40;
const STOP_PROBABILITY = 0.25;
const RESPONSE_WINDOW_MS = 1200;
const INTER_TRIAL_MS = 700;
const INITIAL_SSD_MS = 250;
const SSD_STEP_MS = 50;
const SSD_MIN_MS = 50;
const SSD_MAX_MS = 900;

let isGameActive = false;
let trialIndex = 0;
let currentSsdMs = INITIAL_SSD_MS;
let currentTrial = null;
let trialStartTime = 0;
let awaitingResponse = false;
let stopActive = false;
let timerIds = [];
let sessionStartedAt = null;
let sessionSeed = "";
let rng = fallbackMulberry32(1);
let trialPlan = [];
let trialLog = [];
let hasSavedSession = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("sst-panel");
const stimulus = document.getElementById("stimulus");
const trialInfo = document.getElementById("trial-info");
const resultModal = document.getElementById("result-modal");
const goAccEl = document.getElementById("go-acc");
const stopAccEl = document.getElementById("stop-acc");
const ssdLiveEl = document.getElementById("ssd-live");
const resultFeedbackEl = document.getElementById("result-feedback");
const resultSsrtMethodEl = document.getElementById("result-ssrt-method");

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

function createFallbackToken() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const bytes = new Uint32Array(2);
        window.crypto.getRandomValues(bytes);
        return `${bytes[0].toString(36)}${bytes[1].toString(36)}`;
    }
    const now = Date.now().toString(36);
    const preciseNow = window.performance && typeof window.performance.now === "function"
        ? Math.round(window.performance.now() * 1000).toString(36)
        : "0";
    return `${now}${preciseNow}`;
}

function createSessionSeed() {
    if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === "function") {
        return window.SeededRandom.createSessionSeed(MODULE_ID);
    }
    return `${MODULE_ID}-${Date.now().toString(36)}-${createFallbackToken()}`;
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return fallbackMulberry32(fallbackHashString(seed));
}

function shuffleInPlace(list) {
    if (window.SeededRandom && typeof window.SeededRandom.shuffleInPlace === "function") {
        return window.SeededRandom.shuffleInPlace(list, rng);
    }
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function buildTrialPlan() {
    const stopCount = Math.round(TOTAL_TRIALS * STOP_PROBABILITY);
    const goCount = TOTAL_TRIALS - stopCount;
    const trialTypes = [];
    const directions = [];

    for (let i = 0; i < goCount; i += 1) {
        trialTypes.push("go");
    }
    for (let i = 0; i < stopCount; i += 1) {
        trialTypes.push("stop");
    }
    for (let i = 0; i < TOTAL_TRIALS; i += 1) {
        directions.push(i % 2 === 0 ? "left" : "right");
    }

    shuffleInPlace(trialTypes);
    shuffleInPlace(directions);

    return trialTypes.map((trialType, index) => ({
        index,
        trialIndex: index,
        trialType,
        isStopTrial: trialType === "stop",
        direction: directions[index],
        correctResponse: directions[index]
    }));
}

function schedule(callback, delay) {
    const id = setTimeout(callback, delay);
    timerIds.push(id);
    return id;
}

function clearAllTimers() {
    timerIds.forEach((id) => clearTimeout(id));
    timerIds = [];
}

function clampSsd(value) {
    return Math.max(SSD_MIN_MS, Math.min(SSD_MAX_MS, value));
}

function ratio(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0;
}

function average(values) {
    const validValues = values.filter((value) => Number.isFinite(value));
    if (validValues.length === 0) return 0;
    return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

function averageFloat(values) {
    const validValues = values.filter((value) => Number.isFinite(value));
    if (validValues.length === 0) return null;
    return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function formatMs(value) {
    return Number.isFinite(value) ? `${value}ms` : "--";
}

function directionToArrow(direction) {
    return direction === "left" ? "\u2190" : "\u2192";
}

function keyToDirection(code) {
    if (code === "ArrowLeft") {
        return "left";
    }
    if (code === "ArrowRight") {
        return "right";
    }
    return null;
}

function createRuntimeTrial(planItem) {
    const plannedSsd = planItem.isStopTrial ? currentSsdMs : null;
    const now = new Date();

    return {
        index: planItem.index,
        trialIndex: planItem.trialIndex,
        trialType: planItem.trialType,
        type: planItem.trialType,
        isStopTrial: planItem.isStopTrial,
        direction: planItem.direction,
        correctResponse: planItem.correctResponse,
        plannedSsd,
        ssdBeforeTrial: currentSsdMs,
        ssdAfterTrial: null,
        responseWindowMs: RESPONSE_WINDOW_MS,
        stopSignalShown: false,
        stopSignalShownAtMs: null,
        actualResponse: "none",
        response: "none",
        responded: false,
        rtMs: null,
        success: null,
        correct: null,
        classification: null,
        timedOut: false,
        startedAt: now.toISOString(),
        finishedAt: null,
        _startedAtMs: now.getTime()
    };
}

function serializeTrial(trial) {
    return {
        index: trial.index,
        trialIndex: trial.trialIndex,
        trialType: trial.trialType,
        type: trial.type,
        isStopTrial: trial.isStopTrial,
        direction: trial.direction,
        correctResponse: trial.correctResponse,
        plannedSsd: trial.plannedSsd,
        ssdBeforeTrial: trial.ssdBeforeTrial,
        ssdAfterTrial: trial.ssdAfterTrial,
        responseWindowMs: trial.responseWindowMs,
        stopSignalShown: trial.stopSignalShown,
        stopSignalShownAtMs: trial.stopSignalShownAtMs,
        actualResponse: trial.actualResponse,
        response: trial.response,
        responded: trial.responded,
        rtMs: trial.rtMs,
        success: trial.success,
        correct: trial.correct,
        classification: trial.classification,
        timedOut: trial.timedOut,
        startedAt: trial.startedAt,
        finishedAt: trial.finishedAt
    };
}

function completeCurrentTrial(fields) {
    if (!currentTrial || currentTrial.finishedAt) {
        return;
    }

    Object.assign(currentTrial, fields);
    currentTrial.finishedAt = new Date().toISOString();
    trialLog.push(serializeTrial(currentTrial));
}

function updateSsdAfterStop(success) {
    if (success) {
        currentSsdMs = clampSsd(currentSsdMs + SSD_STEP_MS);
    } else {
        currentSsdMs = clampSsd(currentSsdMs - SSD_STEP_MS);
    }
    return currentSsdMs;
}

function startGame() {
    clearAllTimers();
    isGameActive = true;
    trialIndex = 0;
    currentSsdMs = INITIAL_SSD_MS;
    currentTrial = null;
    trialLog = [];
    sessionStartedAt = new Date();
    hasSavedSession = false;
    sessionSeed = createSessionSeed();
    rng = createRng(`${sessionSeed}:trial-plan:${TOTAL_TRIALS}:${STOP_PROBABILITY}`);
    trialPlan = buildTrialPlan();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";

    updateLiveBoard();
    runTrial();
}

function runTrial() {
    if (!isGameActive) {
        return;
    }

    if (trialIndex >= trialPlan.length) {
        endGame();
        return;
    }

    const planItem = trialPlan[trialIndex];
    currentTrial = createRuntimeTrial(planItem);
    trialStartTime = currentTrial._startedAtMs;
    awaitingResponse = true;
    stopActive = false;

    stimulus.classList.remove("stop");
    stimulus.textContent = directionToArrow(currentTrial.direction);
    trialInfo.textContent = `试次 ${trialIndex + 1} / ${TOTAL_TRIALS}`;

    if (currentTrial.isStopTrial) {
        schedule(() => {
            if (!awaitingResponse || !currentTrial) {
                return;
            }
            stopActive = true;
            currentTrial.stopSignalShown = true;
            currentTrial.stopSignalShownAtMs = Math.max(0, Date.now() - trialStartTime);
            stimulus.classList.add("stop");
        }, currentTrial.plannedSsd);
    }

    schedule(() => finalizeTrial(), RESPONSE_WINDOW_MS);
}

function handleResponse(direction) {
    if (!isGameActive || !awaitingResponse || !currentTrial || currentTrial.responded) {
        return;
    }

    const rtMs = Math.max(0, Date.now() - trialStartTime);
    currentTrial.responded = true;

    if (currentTrial.isStopTrial) {
        const nextSsd = updateSsdAfterStop(false);
        completeCurrentTrial({
            actualResponse: direction,
            response: direction,
            rtMs,
            success: false,
            correct: false,
            classification: stopActive ? "stopFailureAfterSignal" : "stopFailureBeforeSignal",
            timedOut: false,
            ssdAfterTrial: nextSsd
        });
    } else {
        const correct = direction === currentTrial.direction;
        completeCurrentTrial({
            actualResponse: direction,
            response: direction,
            rtMs,
            success: correct,
            correct,
            classification: correct ? "goCorrect" : "goDirectionError",
            timedOut: false,
            ssdAfterTrial: currentSsdMs
        });
    }

    finishTrialDisplay();
}

function finalizeTrial() {
    if (!awaitingResponse || !currentTrial) {
        return;
    }

    if (currentTrial.responded) {
        finishTrialDisplay();
        return;
    }

    if (currentTrial.isStopTrial) {
        const nextSsd = updateSsdAfterStop(true);
        completeCurrentTrial({
            actualResponse: "none",
            response: "none",
            responded: false,
            rtMs: null,
            success: true,
            correct: true,
            classification: "stopSuccess",
            timedOut: true,
            ssdAfterTrial: nextSsd
        });
    } else {
        completeCurrentTrial({
            actualResponse: "none",
            response: "none",
            responded: false,
            rtMs: null,
            success: false,
            correct: false,
            classification: "goOmission",
            timedOut: true,
            ssdAfterTrial: currentSsdMs
        });
    }

    finishTrialDisplay();
}

function finishTrialDisplay() {
    if (!awaitingResponse) {
        return;
    }

    awaitingResponse = false;
    clearAllTimers();
    updateLiveBoard();
    stimulus.classList.remove("stop");
    stimulus.textContent = "+";
    trialIndex += 1;
    currentTrial = null;
    schedule(runTrial, INTER_TRIAL_MS);
}

function updateLiveBoard() {
    const goTrials = trialLog.filter((item) => item.trialType === "go");
    const goSuccess = goTrials.filter((item) => item.success).length;
    const stopTrials = trialLog.filter((item) => item.trialType === "stop");
    const stopSuccess = stopTrials.filter((item) => item.success).length;

    goAccEl.textContent = formatPercent(ratio(goSuccess, goTrials.length));
    stopAccEl.textContent = formatPercent(ratio(stopSuccess, stopTrials.length));
    ssdLiveEl.textContent = String(currentSsdMs);
}

function countByClassification() {
    return trialLog.reduce((acc, trial) => {
        acc[trial.classification] = (acc[trial.classification] || 0) + 1;
        return acc;
    }, {});
}

function buildSsdTrajectory() {
    return trialLog
        .filter((trial) => trial.trialType === "stop")
        .map((trial) => ({
            index: trial.index,
            trialIndex: trial.trialIndex,
            plannedSsd: trial.plannedSsd,
            ssdBeforeTrial: trial.ssdBeforeTrial,
            ssdAfterTrial: trial.ssdAfterTrial,
            success: trial.success,
            classification: trial.classification,
            rtMs: trial.rtMs
        }));
}

function estimateSsrt(goRtSamples, stopTrials) {
    const method = "integration-percentile";
    const methodDescription = "integration-percentile: 按 stop 失败率 p(response|stop) 在正确 Go RT 分布中取对应分位点，再减去 stop trial 的平均 planned SSD。";
    const sortedGoRts = goRtSamples
        .filter((value) => Number.isFinite(value))
        .slice()
        .sort((a, b) => a - b);
    const stopSsdSamples = stopTrials
        .map((trial) => trial.plannedSsd)
        .filter((value) => Number.isFinite(value));
    const failedStopCount = stopTrials.filter((trial) => trial.responded).length;
    const pRespondOnStop = ratio(failedStopCount, stopTrials.length);
    const meanSsdRaw = averageFloat(stopSsdSamples);
    const meanSsdMs = Number.isFinite(meanSsdRaw) ? Math.round(meanSsdRaw) : null;
    const base = {
        ssrtEstimateMethod: method,
        ssrtEstimateMethodDescription: methodDescription,
        pRespondOnStop,
        failedStopCount,
        stopTrialCount: stopTrials.length,
        goRtSampleCount: sortedGoRts.length,
        meanSsdMs,
        goRtPercentileMs: null,
        percentileRank: null,
        ssrtMs: null,
        ssrtEstimateAvailable: false,
        ssrtEstimateNote: "样本不足或停止成功率处于极端区间，SSRT 不稳定；本轮仅保存原始 trial 与 SSD 轨迹。"
    };

    if (
        sortedGoRts.length < 5
        || stopTrials.length < 3
        || !Number.isFinite(meanSsdRaw)
        || pRespondOnStop <= 0
        || pRespondOnStop >= 1
    ) {
        return base;
    }

    const rankIndex = Math.min(
        sortedGoRts.length - 1,
        Math.max(0, Math.ceil(pRespondOnStop * sortedGoRts.length) - 1)
    );
    const goRtPercentileMs = sortedGoRts[rankIndex];
    const ssrtMs = Math.max(0, Math.round(goRtPercentileMs - meanSsdRaw));

    return {
        ...base,
        goRtPercentileMs,
        percentileRank: pRespondOnStop,
        ssrtMs,
        ssrtEstimateAvailable: true,
        ssrtEstimateNote: "短训练局数下该 SSRT 只适合看同一任务内趋势；若 Go 反应被刻意放慢、stop 成功率过高/过低或样本太少，估计会偏移。"
    };
}

function buildSummary() {
    const totalTrials = trialLog.length;
    const goTrials = trialLog.filter((trial) => trial.trialType === "go");
    const stopTrials = trialLog.filter((trial) => trial.trialType === "stop");
    const goCorrectTrials = goTrials.filter((trial) => trial.classification === "goCorrect");
    const goResponseTrials = goTrials.filter((trial) => trial.responded);
    const stopSuccessTrials = stopTrials.filter((trial) => trial.classification === "stopSuccess");
    const goMeanRtMs = average(goCorrectTrials.map((trial) => trial.rtMs));
    const goResponseMeanRtMs = average(goResponseTrials.map((trial) => trial.rtMs));
    const stopSuccessRate = ratio(stopSuccessTrials.length, stopTrials.length);
    const goAccuracy = ratio(goCorrectTrials.length, goTrials.length);
    const ssdTrajectory = buildSsdTrajectory();
    const ssrt = estimateSsrt(
        goCorrectTrials.map((trial) => trial.rtMs),
        stopTrials
    );

    return {
        totalTrials,
        plannedTrials: TOTAL_TRIALS,
        goTrials: goTrials.length,
        stopTrials: stopTrials.length,
        goCorrectCount: goCorrectTrials.length,
        goOmissionCount: goTrials.filter((trial) => trial.classification === "goOmission").length,
        goDirectionErrorCount: goTrials.filter((trial) => trial.classification === "goDirectionError").length,
        stopSuccessCount: stopSuccessTrials.length,
        stopFailureCount: stopTrials.length - stopSuccessTrials.length,
        stopFailureBeforeSignalCount: stopTrials.filter((trial) => trial.classification === "stopFailureBeforeSignal").length,
        stopFailureAfterSignalCount: stopTrials.filter((trial) => trial.classification === "stopFailureAfterSignal").length,
        correctCount: trialLog.filter((trial) => trial.correct).length,
        timedOutCount: trialLog.filter((trial) => trial.timedOut).length,
        goAccuracy,
        accuracy: ratio(trialLog.filter((trial) => trial.correct).length, totalTrials),
        goMeanRtMs,
        meanRtMs: goMeanRtMs,
        goResponseMeanRtMs,
        stopSuccessRate,
        stopProbability: STOP_PROBABILITY,
        responseWindowMs: RESPONSE_WINDOW_MS,
        initialSsdMs: INITIAL_SSD_MS,
        finalSsdMs: currentSsdMs,
        ssdStepMs: SSD_STEP_MS,
        ssdMinMs: SSD_MIN_MS,
        ssdMaxMs: SSD_MAX_MS,
        meanSsdMs: ssrt.meanSsdMs,
        ssdTrajectory,
        classificationCounts: countByClassification(),
        ssrtEstimateMs: ssrt.ssrtMs,
        ssrtEstimateAvailable: ssrt.ssrtEstimateAvailable,
        ssrtEstimateMethod: ssrt.ssrtEstimateMethod,
        ssrtEstimateMethodDescription: ssrt.ssrtEstimateMethodDescription,
        ssrtEstimateNote: ssrt.ssrtEstimateNote,
        pRespondOnStop: ssrt.pRespondOnStop,
        goRtPercentileMs: ssrt.goRtPercentileMs,
        ssrtPercentileRank: ssrt.percentileRank,
        goRtSampleCount: ssrt.goRtSampleCount,
        seed: sessionSeed,
        sessionSeed,
        contentVersion: CONTENT_VERSION
    };
}

function buildScore(summary) {
    const inhibitionBalance = 1 - Math.min(1, Math.abs(summary.stopSuccessRate - 0.5) * 2);
    const goComponent = summary.goAccuracy;
    return Math.round(((goComponent * 0.65) + (inhibitionBalance * 0.35)) * 100);
}

function buildTrainingFeedback(summary) {
    const speedText = summary.goMeanRtMs > 0
        ? `Go 平均正确反应 ${summary.goMeanRtMs}ms`
        : "Go 正确反应样本不足";
    const stopText = `停止成功率 ${formatPercent(summary.stopSuccessRate)}（${summary.stopSuccessCount}/${summary.stopTrials}）`;
    const methodText = summary.ssrtEstimateAvailable
        ? `integration-percentile 估计 SSRT ${summary.ssrtEstimateMs}ms`
        : "本轮 stop 失败率过于极端或样本不足，未给出稳定 SSRT 数值";

    let advice = "下一轮建议：保持快速 Go 反应，同时继续让 stop 成功率靠近 50%，这样 SSD staircase 才能贴近你的抑制边界。";
    if (summary.goAccuracy < 0.85 || summary.goOmissionCount >= 3) {
        advice = "下一轮建议：先提高 Go 方向反应稳定性，看到箭头立即按对应方向；Go 基线稳定后，SSRT 才更有解释力。";
    } else if (summary.stopSuccessRate >= 0.75 && summary.goMeanRtMs >= 700) {
        advice = "下一轮建议：停止成功率很高但 Go 反应偏慢，可能在等待停止信号；请优先保持快速反应，不要为了抑制而拖慢所有 Go。";
    } else if (summary.stopSuccessRate <= 0.25) {
        advice = "下一轮建议：停止失败较多，先把注意焦点放在红色边框出现后的立即刹车；系统会降低 SSD，让任务回到可训练区间。";
    } else if (summary.stopSuccessRate >= 0.75) {
        advice = "下一轮建议：抑制成功率偏高，系统会继续增加 SSD；请维持 Go 速度，让停止信号更接近真实反应取消边界。";
    } else if (summary.goMeanRtMs > 0 && summary.goMeanRtMs <= 450 && summary.stopSuccessRate < 0.4) {
        advice = "下一轮建议：Go 反应很快但抑制偏低，尝试减少抢按惯性，看到红色停止信号后立刻中断动作。";
    }

    return `${speedText}；${stopText}。Stop Signal 训练的关键不是单纯越快越好，也不是停止成功率越高越好，而是在快速反应和及时抑制之间找到边界。${methodText}。${advice}`;
}

function buildSsrtMethodText(summary) {
    return `${summary.ssrtEstimateMethodDescription} ${summary.ssrtEstimateNote}`;
}

function saveTrainingSession(finishedAt, summary) {
    if (hasSavedSession || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") {
        return;
    }

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const score = buildScore(summary);

    window.TrainingResults.saveSession({
        moduleId: MODULE_ID,
        gameId: MODULE_ID,
        gameName: GAME_NAME,
        startedAt,
        finishedAt,
        durationMs,
        score,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        summary,
        trials: trialLog.map((trial) => ({ ...trial })),
        metrics: {
            score,
            goAccuracy: formatPercent(summary.goAccuracy),
            goMeanRT: formatMs(summary.goMeanRtMs),
            goMeanRtMs: summary.goMeanRtMs,
            stopSuccessRate: formatPercent(summary.stopSuccessRate),
            stopSuccessRateValue: summary.stopSuccessRate,
            ssrtEstimate: formatMs(summary.ssrtEstimateMs),
            ssrtEstimateMs: summary.ssrtEstimateMs,
            ssrtEstimateMethod: summary.ssrtEstimateMethod,
            ssrtEstimateMethodDescription: summary.ssrtEstimateMethodDescription,
            meanSSD: formatMs(summary.meanSsdMs),
            meanSsdMs: summary.meanSsdMs,
            finalSSD: `${summary.finalSsdMs}ms`,
            ssdTrajectory: summary.ssdTrajectory,
            pRespondOnStop: summary.pRespondOnStop,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        },
        tags: ["executive-function", "response-inhibition", "stop-signal", "sst"]
    });

    hasSavedSession = true;
}

function endGame() {
    if (!isGameActive && hasSavedSession) {
        return;
    }

    isGameActive = false;
    awaitingResponse = false;
    clearAllTimers();

    const finishedAt = new Date();
    const summary = buildSummary();
    const feedback = buildTrainingFeedback(summary);
    const methodText = buildSsrtMethodText(summary);

    document.getElementById("result-go-acc").textContent = formatPercent(summary.goAccuracy);
    document.getElementById("result-stop-acc").textContent = formatPercent(summary.stopSuccessRate);
    document.getElementById("result-go-rt").textContent = formatMs(summary.goMeanRtMs);
    document.getElementById("result-ssrt").textContent = formatMs(summary.ssrtEstimateMs);
    if (resultFeedbackEl) {
        resultFeedbackEl.textContent = feedback;
    }
    if (resultSsrtMethodEl) {
        resultSsrtMethodEl.textContent = methodText;
    }

    saveTrainingSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

document.addEventListener("keydown", (event) => {
    const direction = keyToDirection(event.code);
    if (!direction) {
        return;
    }
    if (isGameActive) {
        event.preventDefault();
    }
    handleResponse(direction);
});

window.startGame = startGame;
