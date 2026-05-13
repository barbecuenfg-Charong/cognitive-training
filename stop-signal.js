const MODULE_ID = "stop-signal";
const GAME_NAME = "停止信号任务";
const CONTENT_VERSION = "stop-signal-p0c-inhibition-v2";

const TOTAL_TRIALS = 40;
const STOP_PROBABILITY = 0.25;
const STOP_TRIAL_COUNT = Math.round(TOTAL_TRIALS * STOP_PROBABILITY);
const GO_TRIAL_COUNT = TOTAL_TRIALS - STOP_TRIAL_COUNT;
const RESPONSE_WINDOW_MS = 1200;
const INTER_TRIAL_MS = 700;
const INITIAL_SSD_MS = 250;
const SSD_STEP_MS = 50;
const SSD_MIN_MS = 50;
const SSD_MAX_MS = 900;
const MAX_CONSECUTIVE_STOP_TRIALS = 2;
const MAX_CONSECUTIVE_GO_TRIALS = 8;

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
    const trialTypes = buildTrialTypeSequence();
    const directionQueues = {
        go: buildBalancedDirectionQueue(GO_TRIAL_COUNT),
        stop: buildBalancedDirectionQueue(STOP_TRIAL_COUNT)
    };

    return trialTypes.map((trialType, index) => {
        const direction = directionQueues[trialType].pop();

        return {
            index,
            trialIndex: index,
            trialType,
            isStopTrial: trialType === "stop",
            direction,
            correctResponse: direction
        };
    });
}

function buildTrialTypeSequence() {
    const baseTypes = [
        ...Array.from({ length: GO_TRIAL_COUNT }, () => "go"),
        ...Array.from({ length: STOP_TRIAL_COUNT }, () => "stop")
    ];

    for (let attempt = 0; attempt < 500; attempt += 1) {
        const candidate = shuffleInPlace(baseTypes.slice());
        if (
            candidate[0] === "go"
            && !hasRunLongerThan(candidate, "stop", MAX_CONSECUTIVE_STOP_TRIALS)
            && !hasRunLongerThan(candidate, "go", MAX_CONSECUTIVE_GO_TRIALS)
        ) {
            return candidate;
        }
    }

    return buildGreedyTrialTypeSequence();
}

function buildGreedyTrialTypeSequence() {
    const sequence = [];
    let goRemaining = GO_TRIAL_COUNT;
    let stopRemaining = STOP_TRIAL_COUNT;

    while (sequence.length < TOTAL_TRIALS) {
        const stopRun = countTrailingRun(sequence, "stop");
        const goRun = countTrailingRun(sequence, "go");
        const remaining = goRemaining + stopRemaining;
        let nextType = rng() < ratio(stopRemaining, remaining) ? "stop" : "go";

        if (goRemaining === 0) {
            nextType = "stop";
        } else if (sequence.length === 0 || stopRemaining === 0 || stopRun >= MAX_CONSECUTIVE_STOP_TRIALS) {
            nextType = "go";
        } else if (goRun >= MAX_CONSECUTIVE_GO_TRIALS) {
            nextType = "stop";
        }

        if (nextType === "stop") {
            stopRemaining -= 1;
        } else {
            goRemaining -= 1;
        }
        sequence.push(nextType);
    }

    return sequence;
}

function buildBalancedDirectionQueue(count) {
    const leftCount = Math.floor(count / 2) + (count % 2 === 1 && rng() < 0.5 ? 1 : 0);
    const rightCount = count - leftCount;
    const directions = [
        ...Array.from({ length: leftCount }, () => "left"),
        ...Array.from({ length: rightCount }, () => "right")
    ];

    return shuffleInPlace(directions);
}

function hasRunLongerThan(sequence, trialType, maxRunLength) {
    let runLength = 0;
    for (let i = 0; i < sequence.length; i += 1) {
        runLength = sequence[i] === trialType ? runLength + 1 : 0;
        if (runLength > maxRunLength) {
            return true;
        }
    }
    return false;
}

function countTrailingRun(sequence, trialType) {
    let count = 0;
    for (let i = sequence.length - 1; i >= 0; i -= 1) {
        if (sequence[i] !== trialType) {
            break;
        }
        count += 1;
    }
    return count;
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

function buildStaircaseState(beforeMs, afterMs, outcome, intendedAdjustmentMs) {
    const actualAdjustmentMs = Number.isFinite(afterMs) && Number.isFinite(beforeMs)
        ? afterMs - beforeMs
        : 0;

    return {
        beforeMs,
        afterMs,
        stepMs: SSD_STEP_MS,
        minMs: SSD_MIN_MS,
        maxMs: SSD_MAX_MS,
        outcome,
        intendedAdjustmentMs,
        actualAdjustmentMs,
        clamped: actualAdjustmentMs !== intendedAdjustmentMs
    };
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

function averageRoundedOrNull(values) {
    const value = averageFloat(values);
    return Number.isFinite(value) ? Math.round(value) : null;
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function formatMs(value) {
    return Number.isFinite(value) ? `${value}ms` : "--";
}

function formatSignedMs(value) {
    if (!Number.isFinite(value)) {
        return "--";
    }
    return value > 0 ? `+${value}ms` : `${value}ms`;
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
    const ssdBeforeTrial = currentSsdMs;
    const plannedSsd = planItem.isStopTrial ? ssdBeforeTrial : null;
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
        ssdMs: ssdBeforeTrial,
        signalDelay: plannedSsd,
        ssdBeforeTrial,
        ssdAfterTrial: ssdBeforeTrial,
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
        errorType: null,
        staircaseState: buildStaircaseState(
            ssdBeforeTrial,
            ssdBeforeTrial,
            planItem.isStopTrial ? "pendingStopOutcome" : "goTrialNoAdjustment",
            0
        ),
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
        ssdMs: trial.ssdMs,
        signalDelay: trial.signalDelay,
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
        errorType: trial.errorType,
        staircaseState: trial.staircaseState ? { ...trial.staircaseState } : null,
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
    const beforeMs = currentSsdMs;
    const intendedAdjustmentMs = success ? SSD_STEP_MS : -SSD_STEP_MS;
    const afterMs = clampSsd(beforeMs + intendedAdjustmentMs);
    currentSsdMs = afterMs;

    return buildStaircaseState(
        beforeMs,
        afterMs,
        success ? "stopSuccessIncreaseSsd" : "stopFailureDecreaseSsd",
        intendedAdjustmentMs
    );
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
        const staircaseState = updateSsdAfterStop(false);
        const errorType = stopActive ? "stopCommissionAfterSignal" : "stopCommissionBeforeSignal";
        completeCurrentTrial({
            actualResponse: direction,
            response: direction,
            rtMs,
            success: false,
            correct: false,
            classification: stopActive ? "stopFailureAfterSignal" : "stopFailureBeforeSignal",
            errorType,
            timedOut: false,
            ssdAfterTrial: staircaseState.afterMs,
            staircaseState
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
            errorType: correct ? null : "choiceError",
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
        const staircaseState = updateSsdAfterStop(true);
        completeCurrentTrial({
            actualResponse: "none",
            response: "none",
            responded: false,
            rtMs: null,
            success: true,
            correct: true,
            classification: "stopSuccess",
            errorType: null,
            timedOut: true,
            ssdAfterTrial: staircaseState.afterMs,
            staircaseState
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
            errorType: "goOmission",
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
            ssdMs: trial.ssdMs,
            signalDelay: trial.signalDelay,
            ssdBeforeTrial: trial.ssdBeforeTrial,
            ssdAfterTrial: trial.ssdAfterTrial,
            staircaseState: trial.staircaseState ? { ...trial.staircaseState } : null,
            success: trial.success,
            classification: trial.classification,
            errorType: trial.errorType,
            rtMs: trial.rtMs
        }));
}

function countDirections(trials) {
    return trials.reduce((acc, trial) => {
        acc[trial.direction] = (acc[trial.direction] || 0) + 1;
        return acc;
    }, { left: 0, right: 0 });
}

function computePostStopSlowing() {
    const postStopGoRts = [];
    const postGoGoRts = [];

    for (let i = 1; i < trialLog.length; i += 1) {
        const trial = trialLog[i];
        const previousTrial = trialLog[i - 1];
        if (trial.trialType !== "go" || trial.classification !== "goCorrect") {
            continue;
        }

        if (previousTrial.trialType === "stop") {
            postStopGoRts.push(trial.rtMs);
        } else if (previousTrial.trialType === "go") {
            postGoGoRts.push(trial.rtMs);
        }
    }

    const postStopGoMeanRtMs = averageRoundedOrNull(postStopGoRts);
    const postGoGoMeanRtMs = averageRoundedOrNull(postGoGoRts);
    const postStopSlowingMs = Number.isFinite(postStopGoMeanRtMs) && Number.isFinite(postGoGoMeanRtMs)
        ? postStopGoMeanRtMs - postGoGoMeanRtMs
        : null;

    return {
        postStopGoMeanRtMs,
        postGoGoMeanRtMs,
        postStopSlowingMs,
        postStopGoSampleCount: postStopGoRts.length,
        postGoGoSampleCount: postGoGoRts.length
    };
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

function countStaircaseReversals(stopTrials) {
    let reversalCount = 0;
    let previousDirection = null;

    stopTrials.forEach((trial) => {
        const state = trial.staircaseState || {};
        const rawAdjustmentMs = Number.isFinite(state.actualAdjustmentMs) && state.actualAdjustmentMs !== 0
            ? state.actualAdjustmentMs
            : state.intendedAdjustmentMs;
        const currentDirection = Math.sign(rawAdjustmentMs);

        if (!currentDirection) {
            return;
        }

        if (previousDirection !== null && currentDirection !== previousDirection) {
            reversalCount += 1;
        }

        previousDirection = currentDirection;
    });

    return reversalCount;
}

function buildNextPracticeRecommendation(summary) {
    if (summary.goWaitingFlag || summary.strategicSlowingFlag) {
        return "下一轮建议：不要等待 stop 信号再按键，保持 Go 反应自然、快速且一致，把整体反应速度拉回正常区间，让 SSRT 更接近真实抑制边界。";
    }

    if (summary.staircaseQualityLabel === "insufficient") {
        return "下一轮建议：继续完成更多 stop trial，先把 staircase 样本补足；同时把 stop 成功率稳定在中间区间，避免 SSRT 只剩单个数值没有可用性判断。";
    }

    if (summary.staircaseClampCount > 0) {
        return "下一轮建议：当前 SSD 已碰到上下限，继续保持正常 Go 速度，让 staircase 回到中间区间，这样后续 SSD 才更有解释力。";
    }

    if (summary.staircaseQualityLabel === "weak") {
        return "下一轮建议：当前 staircase 还不够稳定，继续练习并把 stop 成功率往 50% 附近拉；只有这样，SSD 和 SSRT 才更可信。";
    }

    return "下一轮建议：维持当前节奏，继续保持 Go 快而稳、Stop 成功率接近 50%，让 staircase 在可解释区间内围绕边界收敛。";
}

function analyzeStopSignalQuality(stopTrials, goResponseTrials, stopSuccessRate) {
    const staircaseClampCount = stopTrials.filter((trial) => trial.staircaseState && trial.staircaseState.clamped).length;
    const usableStopSampleCount = stopTrials.length - staircaseClampCount;
    const staircaseReversalCount = countStaircaseReversals(stopTrials);
    const staircaseClampRate = ratio(staircaseClampCount, stopTrials.length);
    const usableStopSampleRate = ratio(usableStopSampleCount, stopTrials.length);
    const staircaseReversalRate = ratio(staircaseReversalCount, Math.max(0, usableStopSampleCount - 1));
    const goWaitingThresholdMs = 650;
    const lateGoThresholdMs = 900;
    const goWaitingCount = goResponseTrials.filter((trial) => Number.isFinite(trial.rtMs) && trial.rtMs >= goWaitingThresholdMs).length;
    const lateGoResponseCount = goResponseTrials.filter((trial) => Number.isFinite(trial.rtMs) && trial.rtMs >= lateGoThresholdMs).length;
    const goWaitingRate = ratio(goWaitingCount, goResponseTrials.length);
    const lateGoResponseRate = ratio(lateGoResponseCount, goResponseTrials.length);
    const goResponseMeanMs = averageRoundedOrNull(goResponseTrials.map((trial) => trial.rtMs));
    const goWaitingFlag = goResponseTrials.length > 0 && (
        goWaitingRate >= 0.35
        || lateGoResponseRate >= 0.2
        || (Number.isFinite(goResponseMeanMs) && goResponseMeanMs >= 650)
    );
    const strategicSlowingFlag = goWaitingFlag && (
        stopSuccessRate >= 0.65
        || goWaitingRate >= 0.45
        || (Number.isFinite(goResponseMeanMs) && goResponseMeanMs >= 700)
    );
    const stopBalanceScore = 1 - Math.min(1, Math.abs(stopSuccessRate - 0.5) * 2);
    const sampleCoverageScore = usableStopSampleRate;
    const clampPenaltyScore = 1 - staircaseClampRate;
    const reversalCoverageScore = ratio(staircaseReversalCount, Math.max(1, usableStopSampleCount - 1));
    const ssdStaircaseQuality = Math.max(0, Math.min(1, (
        (stopBalanceScore * 0.4)
        + (sampleCoverageScore * 0.3)
        + (clampPenaltyScore * 0.2)
        + (Math.min(1, reversalCoverageScore) * 0.1)
    )));
    let staircaseQualityLabel = "weak";

    if (stopTrials.length < 3 || usableStopSampleCount < 3) {
        staircaseQualityLabel = "insufficient";
    } else if (ssdStaircaseQuality >= 0.75 && staircaseClampRate <= 0.1) {
        staircaseQualityLabel = "strong";
    } else if (ssdStaircaseQuality >= 0.55) {
        staircaseQualityLabel = "usable";
    }

    const staircaseQualityNote = staircaseQualityLabel === "insufficient"
        ? "stop 样本太少或可用 staircase 样本不足，SSRT/SSD 只适合看趋势。"
        : staircaseClampCount > 0
            ? "部分 stop trial 已触及 SSD 上下限，说明 staircase 有边界压力。"
            : staircaseReversalCount < 2
                ? "staircase 调整回转次数偏少，说明边界附近的采样还不够。"
                : "staircase 样本分布较完整，可用于同任务内比较。";

    return {
        staircaseClampCount,
        staircaseClampRate,
        staircaseReversalCount,
        staircaseReversalRate,
        usableStopSampleCount,
        usableStopSampleRate,
        ssdStaircaseQuality,
        staircaseQualityLabel,
        staircaseQualityNote,
        goWaitingRate,
        lateGoResponseRate,
        goWaitingFlag,
        strategicSlowingFlag
    };
}

function buildSummary() {
    const totalTrials = trialLog.length;
    const goTrials = trialLog.filter((trial) => trial.trialType === "go");
    const stopTrials = trialLog.filter((trial) => trial.trialType === "stop");
    const goCorrectTrials = goTrials.filter((trial) => trial.classification === "goCorrect");
    const goResponseTrials = goTrials.filter((trial) => trial.responded);
    const stopSuccessTrials = stopTrials.filter((trial) => trial.classification === "stopSuccess");
    const goOmissionCount = goTrials.filter((trial) => trial.classification === "goOmission").length;
    const goChoiceErrorCount = goTrials.filter((trial) => trial.errorType === "choiceError").length;
    const goMeanRtMs = averageRoundedOrNull(goCorrectTrials.map((trial) => trial.rtMs));
    const goResponseMeanRtMs = averageRoundedOrNull(goResponseTrials.map((trial) => trial.rtMs));
    const stopSuccessRate = ratio(stopSuccessTrials.length, stopTrials.length);
    const goAccuracy = ratio(goCorrectTrials.length, goTrials.length);
    const goResponseAccuracy = ratio(goCorrectTrials.length, goResponseTrials.length);
    const ssdTrajectory = buildSsdTrajectory();
    const postStopSlowing = computePostStopSlowing();
    const ssrt = estimateSsrt(
        goCorrectTrials.map((trial) => trial.rtMs),
        stopTrials
    );
    const stopSignalQuality = analyzeStopSignalQuality(stopTrials, goResponseTrials, stopSuccessRate);
    const nextPracticeRecommendation = buildNextPracticeRecommendation({
        ...stopSignalQuality,
        goMeanRtMs,
        goResponseMeanRtMs,
        stopSuccessRate
    });

    return {
        totalTrials,
        plannedTrials: TOTAL_TRIALS,
        goTrials: goTrials.length,
        stopTrials: stopTrials.length,
        plannedGoTrials: GO_TRIAL_COUNT,
        plannedStopTrials: STOP_TRIAL_COUNT,
        plannedStopProbability: STOP_PROBABILITY,
        actualStopProbability: ratio(stopTrials.length, totalTrials),
        goDirectionBalance: countDirections(goTrials),
        stopDirectionBalance: countDirections(stopTrials),
        goCorrectCount: goCorrectTrials.length,
        goOmissionCount,
        goOmissionRate: ratio(goOmissionCount, goTrials.length),
        goDirectionErrorCount: goChoiceErrorCount,
        goChoiceErrorCount,
        goChoiceErrorRate: ratio(goChoiceErrorCount, goTrials.length),
        stopSuccessCount: stopSuccessTrials.length,
        stopFailureCount: stopTrials.length - stopSuccessTrials.length,
        stopFailureBeforeSignalCount: stopTrials.filter((trial) => trial.classification === "stopFailureBeforeSignal").length,
        stopFailureAfterSignalCount: stopTrials.filter((trial) => trial.classification === "stopFailureAfterSignal").length,
        correctCount: trialLog.filter((trial) => trial.correct).length,
        timedOutCount: trialLog.filter((trial) => trial.timedOut).length,
        goAccuracy,
        accuracy: ratio(trialLog.filter((trial) => trial.correct).length, totalTrials),
        goMeanRtMs,
        goRtMs: goMeanRtMs,
        meanRtMs: goMeanRtMs,
        goResponseMeanRtMs,
        goResponseAccuracy,
        stopSuccessRate,
        stopProbability: STOP_PROBABILITY,
        responseWindowMs: RESPONSE_WINDOW_MS,
        initialSsdMs: INITIAL_SSD_MS,
        finalSsdMs: currentSsdMs,
        finalSSD: currentSsdMs,
        ssdStepMs: SSD_STEP_MS,
        ssdMinMs: SSD_MIN_MS,
        ssdMaxMs: SSD_MAX_MS,
        meanSsdMs: ssrt.meanSsdMs,
        meanSSD: ssrt.meanSsdMs,
        ssdTrajectory,
        ...stopSignalQuality,
        ...postStopSlowing,
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
        nextPracticeRecommendation,
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
    const qualityText = `staircase 质量 ${summary.staircaseQualityLabel}（${Math.round(summary.ssdStaircaseQuality * 100)}%）`;
    const slowingText = Number.isFinite(summary.postStopSlowingMs)
        ? `停后 Go 反应变化 ${formatSignedMs(summary.postStopSlowingMs)}`
        : "停后减速样本不足";
    const methodText = summary.ssrtEstimateAvailable
        ? `integration-percentile 估计 SSRT ${summary.ssrtEstimateMs}ms`
        : "本轮 stop 失败率过于极端或样本不足，未给出稳定 SSRT 数值";

    let advice = "下一轮建议：保持快速 Go 反应，同时继续让 stop 成功率靠近 50%，这样 SSD staircase 才能贴近你的抑制边界。";
    if (summary.goAccuracy < 0.85 || summary.goOmissionCount >= 3) {
        advice = "下一轮建议：先提高 Go 方向反应稳定性，看到箭头立即按对应方向；Go 基线稳定后，SSRT 才更有解释力。";
    } else if (summary.goWaitingFlag || summary.strategicSlowingFlag) {
        advice = "下一轮建议：目前存在等待 stop 信号或策略性放慢的迹象；请把 Go 反应拉回自然快速区间，不要靠整体变慢换取更高停止成功率。";
    } else if (summary.stopSuccessRate <= 0.25) {
        advice = "下一轮建议：停止失败较多，先把注意焦点放在红色边框出现后的立即刹车；系统会降低 SSD，让任务回到可训练区间。";
    } else if (summary.stopSuccessRate >= 0.75) {
        advice = "下一轮建议：抑制成功率偏高，系统会继续增加 SSD；请维持 Go 速度，让停止信号更接近真实反应取消边界。";
    } else if (summary.goMeanRtMs > 0 && summary.goMeanRtMs <= 450 && summary.stopSuccessRate < 0.4) {
        advice = "下一轮建议：Go 反应很快但抑制偏低，尝试减少抢按惯性，看到红色停止信号后立刻中断动作。";
    } else if (summary.postStopSlowingMs >= 150) {
        advice = "下一轮建议：停后减速较明显，说明停止信号影响了后续 Go 反应；继续保持快速、准确的 Go 基线。";
    }

    return `${speedText}；${stopText}；${qualityText}；${slowingText}。Stop Signal 训练的关键不是单纯越快越好，也不是停止成功率越高越好，而是在快速反应和及时抑制之间找到边界。${methodText}。${summary.nextPracticeRecommendation || advice}`;
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
            goAccuracyValue: summary.goAccuracy,
            goResponseAccuracy: formatPercent(summary.goResponseAccuracy),
            goResponseAccuracyValue: summary.goResponseAccuracy,
            goOmissionRate: formatPercent(summary.goOmissionRate),
            goOmissionRateValue: summary.goOmissionRate,
            goOmissionCount: summary.goOmissionCount,
            goChoiceErrorRate: formatPercent(summary.goChoiceErrorRate),
            goChoiceErrorRateValue: summary.goChoiceErrorRate,
            goChoiceErrorCount: summary.goChoiceErrorCount,
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
            finalSsdMs: summary.finalSsdMs,
            ssdTrajectory: summary.ssdTrajectory,
            staircaseQualityLabel: summary.staircaseQualityLabel,
            ssdStaircaseQuality: summary.ssdStaircaseQuality,
            staircaseQualityNote: summary.staircaseQualityNote,
            staircaseClampCount: summary.staircaseClampCount,
            staircaseClampRate: formatPercent(summary.staircaseClampRate),
            staircaseClampRateValue: summary.staircaseClampRate,
            staircaseReversalCount: summary.staircaseReversalCount,
            staircaseReversalRate: formatPercent(summary.staircaseReversalRate),
            staircaseReversalRateValue: summary.staircaseReversalRate,
            usableStopSampleCount: summary.usableStopSampleCount,
            usableStopSampleRate: formatPercent(summary.usableStopSampleRate),
            usableStopSampleRateValue: summary.usableStopSampleRate,
            goWaitingRate: formatPercent(summary.goWaitingRate),
            goWaitingRateValue: summary.goWaitingRate,
            lateGoResponseRate: formatPercent(summary.lateGoResponseRate),
            lateGoResponseRateValue: summary.lateGoResponseRate,
            goWaitingFlag: summary.goWaitingFlag,
            strategicSlowingFlag: summary.strategicSlowingFlag,
            nextPracticeRecommendation: summary.nextPracticeRecommendation,
            pRespondOnStop: summary.pRespondOnStop,
            postStopSlowing: formatSignedMs(summary.postStopSlowingMs),
            postStopSlowingMs: summary.postStopSlowingMs,
            postStopGoMeanRtMs: summary.postStopGoMeanRtMs,
            postGoGoMeanRtMs: summary.postGoGoMeanRtMs,
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
    const resultMeanSsdEl = document.getElementById("result-mean-ssd");
    const resultGoOmissionEl = document.getElementById("result-go-omission");
    const resultPostStopSlowingEl = document.getElementById("result-post-stop-slowing");
    if (resultMeanSsdEl) {
        resultMeanSsdEl.textContent = formatMs(summary.meanSsdMs);
    }
    if (resultGoOmissionEl) {
        resultGoOmissionEl.textContent = formatPercent(summary.goOmissionRate);
    }
    if (resultPostStopSlowingEl) {
        resultPostStopSlowingEl.textContent = formatSignedMs(summary.postStopSlowingMs);
    }
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
