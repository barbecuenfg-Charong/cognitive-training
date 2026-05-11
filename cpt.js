const MODULE_ID = "cpt";
const GAME_NAME = "持续表现任务 (CPT)";
const CONTENT_VERSION = "cpt-v3-block-adaptive-sdt";

let isGameActive = false;
let currentLetter = "";
let trialStartTime = 0;
let hits = 0;
let misses = 0;
let falseAlarms = 0;
let correctRejections = 0;
let reactionTimes = [];
let trialLog = [];
let currentTrial = null;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionRng = fallbackMulberry32(1);
let hasSavedSession = false;
let stimulusTimeout;
let isiTimeout;
let gameTimer;
let hasResponded = false;
let trialPlan = [];
let blockPlans = [];
let adaptationEvents = [];
let adaptiveState = null;
let currentPlanIndex = 0;

const MAX_SESSION_DURATION_MS = 150000;
const BLOCK_SIZE = 18;
const INITIAL_TOTAL_TRIALS = 72;
const MIN_TOTAL_TRIALS = 54;
const MAX_TOTAL_TRIALS = 96;
const TOTAL_TRIAL_STEP = BLOCK_SIZE;
const INITIAL_STIMULUS_DURATION_MS = 250;
const MIN_STIMULUS_DURATION_MS = 180;
const MAX_STIMULUS_DURATION_MS = 420;
const STIMULUS_DURATION_STEP_MS = 30;
const INITIAL_ISI_MIN_MS = 1100;
const INITIAL_ISI_MAX_MS = 1900;
const MIN_ISI_MS = 800;
const MAX_ISI_MS = 2400;
const ISI_STEP_MS = 120;
const INITIAL_TARGET_RATIO = 0.22;
const MIN_TARGET_RATIO = 0.12;
const MAX_TARGET_RATIO = 0.34;
const TARGET_RATIO_STEP = 0.03;
const LURE_RATIO = 0.35;
const TARGET_STIMULUS = "X";
const LURE_LETTERS = ["K", "Y", "V", "W", "Z"];
const NEUTRAL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWYZ"
    .split("")
    .filter((letter) => letter !== TARGET_STIMULUS && !LURE_LETTERS.includes(letter));

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

function buildSessionRng() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed(MODULE_ID) : `${MODULE_ID}-${Date.now()}`;
    sessionRng = seeded ? seeded.createRngFromSeed(sessionSeed) : fallbackMulberry32(fallbackHashString(sessionSeed));
}

function nextRandom() {
    return typeof sessionRng === "function" ? sessionRng() : 0;
}

function randomInt(min, max) {
    return Math.floor(nextRandom() * (max - min + 1)) + min;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function roundMetric(value, digits = 3) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function roundTrialCount(value) {
    const rounded = Math.round(value / BLOCK_SIZE) * BLOCK_SIZE;
    return clampNumber(rounded, MIN_TOTAL_TRIALS, MAX_TOTAL_TRIALS);
}

function normalizeAdaptiveState(settings) {
    const isiMinMs = Math.round(clampNumber(settings.isiMinMs, MIN_ISI_MS, MAX_ISI_MS - 200));
    const isiMaxMs = Math.round(clampNumber(settings.isiMaxMs, isiMinMs + 200, MAX_ISI_MS));
    const targetRatio = roundMetric(clampNumber(settings.targetRatio, MIN_TARGET_RATIO, MAX_TARGET_RATIO), 3);

    return {
        targetRatio,
        nonTargetRatio: roundMetric(1 - targetRatio, 3),
        stimulusDurationMs: Math.round(clampNumber(
            settings.stimulusDurationMs,
            MIN_STIMULUS_DURATION_MS,
            MAX_STIMULUS_DURATION_MS
        )),
        isiMinMs,
        isiMaxMs,
        totalTrials: roundTrialCount(settings.totalTrials),
        blockSize: BLOCK_SIZE
    };
}

function createInitialAdaptiveState() {
    return normalizeAdaptiveState({
        targetRatio: INITIAL_TARGET_RATIO,
        stimulusDurationMs: INITIAL_STIMULUS_DURATION_MS,
        isiMinMs: INITIAL_ISI_MIN_MS,
        isiMaxMs: INITIAL_ISI_MAX_MS,
        totalTrials: INITIAL_TOTAL_TRIALS
    });
}

function cloneAdaptiveState(settings = adaptiveState) {
    return normalizeAdaptiveState(settings || createInitialAdaptiveState());
}

function clearGameTimers() {
    clearTimeout(stimulusTimeout);
    clearTimeout(isiTimeout);
    clearTimeout(gameTimer);
}

function shuffleWithRng(list) {
    if (window.SeededRandom && typeof window.SeededRandom.shuffleInPlace === "function") {
        return window.SeededRandom.shuffleInPlace(list, nextRandom);
    }

    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(nextRandom() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function hasTargetRunOverflow(items) {
    let run = 0;
    for (const item of items) {
        run = item === "target" ? run + 1 : 0;
        if (run > 2) return true;
    }
    return false;
}

function plannedTargetCountForBlock(trialCount, targetRatio) {
    if (trialCount <= 1) return trialCount;
    const planned = Math.round(trialCount * targetRatio);
    return clampNumber(planned, 1, trialCount - 1);
}

function pickNonTargetStimulus(stimulusKind) {
    const pool = stimulusKind === "lure" ? LURE_LETTERS : NEUTRAL_LETTERS;
    return pool[Math.floor(nextRandom() * pool.length)];
}

function buildStimulusKinds(trialCount, targetRatio) {
    const targetCount = plannedTargetCountForBlock(trialCount, targetRatio);
    const nonTargetCount = trialCount - targetCount;
    const lureCount = Math.round(nonTargetCount * LURE_RATIO);
    const neutralCount = nonTargetCount - lureCount;
    const kinds = [];

    for (let i = 0; i < targetCount; i += 1) kinds.push("target");
    for (let i = 0; i < lureCount; i += 1) kinds.push("lure");
    for (let i = 0; i < neutralCount; i += 1) kinds.push("neutral");

    for (let attempt = 0; attempt < 12; attempt += 1) {
        shuffleWithRng(kinds);
        if (!hasTargetRunOverflow(kinds)) break;
    }

    return kinds;
}

function appendAdaptiveBlock() {
    if (!adaptiveState) adaptiveState = createInitialAdaptiveState();

    const remainingTrials = adaptiveState.totalTrials - trialPlan.length;
    if (remainingTrials <= 0) return;

    const settings = cloneAdaptiveState(adaptiveState);
    const blockIndex = blockPlans.length;
    const trialCount = Math.min(BLOCK_SIZE, remainingTrials);
    const fromTrial = trialPlan.length;
    const stimulusKinds = buildStimulusKinds(trialCount, settings.targetRatio);
    const targetCount = stimulusKinds.filter((kind) => kind === "target").length;
    const nonTargetCount = trialCount - targetCount;
    const generatedTrials = stimulusKinds.map((stimulusKind, offset) => {
        const isTarget = stimulusKind === "target";
        const isiMs = randomInt(settings.isiMinMs, settings.isiMaxMs);

        return {
            index: fromTrial + offset,
            trialIndex: fromTrial + offset,
            blockIndex,
            blockNumber: blockIndex + 1,
            withinBlockIndex: offset,
            stimulus: isTarget ? TARGET_STIMULUS : pickNonTargetStimulus(stimulusKind),
            stimulusKind,
            distractorType: isTarget ? "target" : stimulusKind,
            isTarget,
            targetRatio: settings.targetRatio,
            nonTargetRatio: settings.nonTargetRatio,
            plannedTargetRatio: roundMetric(targetCount / trialCount, 3),
            plannedNonTargetRatio: roundMetric(nonTargetCount / trialCount, 3),
            stimulusDurationMs: settings.stimulusDurationMs,
            isiMs,
            isiMinMs: settings.isiMinMs,
            isiMaxMs: settings.isiMaxMs,
            adaptiveState: cloneAdaptiveState(settings)
        };
    });

    blockPlans.push({
        blockIndex,
        blockNumber: blockIndex + 1,
        fromTrial,
        toTrial: fromTrial + trialCount - 1,
        trialCount,
        plannedTargetCount: targetCount,
        plannedNonTargetCount: nonTargetCount,
        plannedTargetRatio: roundMetric(targetCount / trialCount, 3),
        plannedNonTargetRatio: roundMetric(nonTargetCount / trialCount, 3),
        targetRatio: settings.targetRatio,
        nonTargetRatio: settings.nonTargetRatio,
        stimulusDurationMs: settings.stimulusDurationMs,
        isiMinMs: settings.isiMinMs,
        isiMaxMs: settings.isiMaxMs,
        meanPlannedIsiMs: average(generatedTrials.map((trial) => trial.isiMs)),
        adaptiveState: cloneAdaptiveState(settings)
    });

    trialPlan.push(...generatedTrials);
}

function initializeAdaptiveSession() {
    adaptiveState = createInitialAdaptiveState();
    trialPlan = [];
    blockPlans = [];
    adaptationEvents = [];
    currentPlanIndex = 0;
    appendAdaptiveBlock();
}

function startGame() {
    clearGameTimers();

    isGameActive = true;
    hits = 0;
    misses = 0;
    falseAlarms = 0;
    correctRejections = 0;
    reactionTimes = [];
    trialLog = [];
    currentTrial = null;
    sessionStartedAt = new Date();
    hasSavedSession = false;
    hasResponded = false;
    buildSessionRng();
    initializeAdaptiveSession();

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("cpt-display").style.display = "flex";
    document.getElementById("click-area").style.display = "block";
    document.getElementById("result-modal").style.display = "none";

    updateScore();
    runTrial();

    gameTimer = setTimeout(endGame, MAX_SESSION_DURATION_MS);
}

function createCurrentTrial(plannedTrial) {
    return {
        index: plannedTrial.index,
        trialIndex: plannedTrial.trialIndex,
        blockIndex: plannedTrial.blockIndex,
        blockNumber: plannedTrial.blockNumber,
        withinBlockIndex: plannedTrial.withinBlockIndex,
        stimulus: plannedTrial.stimulus,
        stimulusKind: plannedTrial.stimulusKind,
        distractorType: plannedTrial.distractorType,
        isTarget: plannedTrial.isTarget,
        targetRatio: plannedTrial.targetRatio,
        nonTargetRatio: plannedTrial.nonTargetRatio,
        plannedTargetRatio: plannedTrial.plannedTargetRatio,
        plannedNonTargetRatio: plannedTrial.plannedNonTargetRatio,
        correctResponse: plannedTrial.isTarget ? "press" : "withhold",
        response: "none",
        responded: false,
        correct: null,
        errorType: null,
        rtMs: null,
        timedOut: false,
        classification: null,
        stimulusDurationMs: plannedTrial.stimulusDurationMs,
        isiMs: plannedTrial.isiMs,
        isiMinMs: plannedTrial.isiMinMs,
        isiMaxMs: plannedTrial.isiMaxMs,
        responseWindowMs: plannedTrial.stimulusDurationMs + plannedTrial.isiMs,
        adaptiveState: cloneAdaptiveState(plannedTrial.adaptiveState)
    };
}

function runTrial() {
    if (!isGameActive) return;

    if (currentPlanIndex >= adaptiveState.totalTrials) {
        endGame();
        return;
    }

    if (currentPlanIndex >= trialPlan.length) {
        appendAdaptiveBlock();
    }

    if (currentPlanIndex >= trialPlan.length) {
        endGame();
        return;
    }

    hasResponded = false;
    currentTrial = createCurrentTrial(trialPlan[currentPlanIndex]);
    currentLetter = currentTrial.stimulus;

    const display = document.getElementById("target-letter");
    display.textContent = currentLetter;
    display.style.visibility = "visible";

    trialStartTime = Date.now();

    stimulusTimeout = setTimeout(() => {
        if (!isGameActive || !currentTrial) return;
        display.style.visibility = "hidden";

        isiTimeout = setTimeout(() => {
            if (!isGameActive) return;

            completeCurrentTrial(true);
            runTrial();
        }, currentTrial.isiMs);
    }, currentTrial.stimulusDurationMs);
}

function classifyTrial(trial) {
    if (trial.isTarget && trial.responded) return "hit";
    if (trial.isTarget && !trial.responded) return "miss";
    if (!trial.isTarget && trial.responded) return "falseAlarm";
    return "correctRejection";
}

function isCorrectClassification(classification) {
    return classification === "hit" || classification === "correctRejection";
}

function errorTypeForClassification(classification) {
    if (classification === "miss") return "omission";
    if (classification === "falseAlarm") return "commission";
    return "none";
}

function flashHitFeedback() {
    const display = document.getElementById("cpt-display");
    display.style.borderColor = "#2ecc71";
    setTimeout(() => {
        display.style.borderColor = "#ecf0f1";
    }, 200);
}

function flashFalseAlarmFeedback() {
    document.body.style.backgroundColor = "#ffdddd";
    setTimeout(() => {
        document.body.style.backgroundColor = "";
    }, 200);
}

function handleResponse() {
    if (!isGameActive || hasResponded || !currentTrial) return;

    const responseTime = Date.now();
    const rt = Math.max(0, responseTime - trialStartTime);

    hasResponded = true;
    currentTrial.responded = true;
    currentTrial.response = "press";
    currentTrial.rtMs = rt;
    currentTrial.timedOut = false;
    currentTrial.classification = classifyTrial(currentTrial);
    currentTrial.correct = isCorrectClassification(currentTrial.classification);
    currentTrial.errorType = errorTypeForClassification(currentTrial.classification);

    if (currentTrial.classification === "hit") {
        hits += 1;
        reactionTimes.push(rt);
        flashHitFeedback();
    } else {
        falseAlarms += 1;
        flashFalseAlarmFeedback();
    }

    updateScore();
}

function serializeTrial(trial) {
    return {
        index: trial.index,
        trialIndex: trial.trialIndex,
        blockIndex: trial.blockIndex,
        blockNumber: trial.blockNumber,
        withinBlockIndex: trial.withinBlockIndex,
        stimulus: trial.stimulus,
        stimulusKind: trial.stimulusKind,
        distractorType: trial.distractorType,
        isTarget: trial.isTarget,
        targetRatio: trial.targetRatio,
        nonTargetRatio: trial.nonTargetRatio,
        plannedTargetRatio: trial.plannedTargetRatio,
        plannedNonTargetRatio: trial.plannedNonTargetRatio,
        correctResponse: trial.correctResponse,
        response: trial.response,
        responded: trial.responded,
        correct: trial.correct,
        errorType: trial.errorType,
        rtMs: trial.rtMs,
        timedOut: trial.timedOut,
        classification: trial.classification,
        stimulusDurationMs: trial.stimulusDurationMs,
        isiMs: trial.isiMs,
        isiMinMs: trial.isiMinMs,
        isiMaxMs: trial.isiMaxMs,
        responseWindowMs: trial.responseWindowMs,
        adaptiveState: cloneAdaptiveState(trial.adaptiveState)
    };
}

function completeCurrentTrial(includeUnanswered) {
    if (!currentTrial) return;
    if (!currentTrial.responded && !includeUnanswered) {
        currentTrial = null;
        return;
    }

    if (!currentTrial.responded) {
        currentTrial.response = "none";
        currentTrial.timedOut = true;
        currentTrial.classification = classifyTrial(currentTrial);
        currentTrial.correct = isCorrectClassification(currentTrial.classification);
        currentTrial.errorType = errorTypeForClassification(currentTrial.classification);

        if (currentTrial.classification === "miss") {
            misses += 1;
        } else {
            correctRejections += 1;
        }
    }

    const serializedTrial = serializeTrial(currentTrial);
    trialLog.push(serializedTrial);
    currentPlanIndex += 1;
    currentTrial = null;

    const cumulativeSummary = summarizeTrials(trialLog);
    serializedTrial.dPrime = cumulativeSummary.dPrime;
    serializedTrial.criterion = cumulativeSummary.criterion;
    serializedTrial.rtStdDevMs = cumulativeSummary.rtStdDevMs;
    serializedTrial.blockTrend = buildBlockTrend(buildBlockSummaries());

    updateScore();
    maybeAdaptAfterBlock();

    serializedTrial.postTrialAdaptiveState = cloneAdaptiveState(adaptiveState);
    serializedTrial.nextParameters = buildNextParameters(adaptiveState, "post-trial adaptive snapshot");
    serializedTrial.next = serializedTrial.nextParameters;
}

function average(values) {
    const validValues = values.filter((value) => Number.isFinite(value));
    if (validValues.length === 0) return 0;
    return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

function standardDeviation(values) {
    const validValues = values.filter((value) => Number.isFinite(value));
    if (validValues.length <= 1) return 0;

    const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
    const variance = validValues.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / validValues.length;
    return Math.round(Math.sqrt(variance));
}

function ratio(count, total) {
    return total > 0 ? count / total : 0;
}

function adjustedRate(count, total) {
    if (total <= 0) return 0.5;
    return (count + 0.5) / (total + 1);
}

function approximateZ(rate) {
    const p = Math.min(Math.max(rate, 0.0001), 0.9999);
    const x = (2 * p) - 1;
    const a = 0.147;
    const ln = Math.log(1 - (x * x));
    const first = (2 / (Math.PI * a)) + (ln / 2);
    const erfinv = Math.sign(x) * Math.sqrt(Math.sqrt((first * first) - (ln / a)) - first);
    return Math.SQRT2 * erfinv;
}

function buildSignalDetection(hitCount, targetTrials, falseAlarmCount, nonTargetTrials) {
    if (targetTrials === 0 || nonTargetTrials === 0) {
        return {
            dPrime: 0,
            criterion: 0,
            adjustedHitRate: 0,
            adjustedFalseAlarmRate: 0,
            method: "loglinear-corrected approximate dPrime/criterion"
        };
    }

    const adjustedHitRate = adjustedRate(hitCount, targetTrials);
    const adjustedFalseAlarmRate = adjustedRate(falseAlarmCount, nonTargetTrials);
    const zHit = approximateZ(adjustedHitRate);
    const zFalseAlarm = approximateZ(adjustedFalseAlarmRate);

    return {
        dPrime: roundMetric(zHit - zFalseAlarm, 2),
        criterion: roundMetric(-0.5 * (zHit + zFalseAlarm), 2),
        adjustedHitRate: roundMetric(adjustedHitRate, 4),
        adjustedFalseAlarmRate: roundMetric(adjustedFalseAlarmRate, 4),
        method: "loglinear-corrected approximate dPrime/criterion"
    };
}

function summarizeTrials(items) {
    const totalTrials = items.length;
    const targetTrials = items.filter((trial) => trial.isTarget).length;
    const nonTargetTrials = totalTrials - targetTrials;
    const hitCount = items.filter((trial) => trial.classification === "hit").length;
    const missCount = items.filter((trial) => trial.classification === "miss").length;
    const falseAlarmCount = items.filter((trial) => trial.classification === "falseAlarm").length;
    const correctRejectionCount = items.filter((trial) => trial.classification === "correctRejection").length;
    const correctCount = hitCount + correctRejectionCount;
    const hitRts = items
        .filter((trial) => trial.classification === "hit")
        .map((trial) => trial.rtMs);
    const signalDetection = buildSignalDetection(hitCount, targetTrials, falseAlarmCount, nonTargetTrials);

    return {
        totalTrials,
        targetTrials,
        nonTargetTrials,
        hitCount,
        missCount,
        omissionCount: missCount,
        falseAlarmCount,
        commissionCount: falseAlarmCount,
        correctRejectionCount,
        correctCount,
        hitRate: ratio(hitCount, targetTrials),
        missRate: ratio(missCount, targetTrials),
        omissionRate: ratio(missCount, targetTrials),
        falseAlarmRate: ratio(falseAlarmCount, nonTargetTrials),
        commissionRate: ratio(falseAlarmCount, nonTargetTrials),
        correctRejectionRate: ratio(correctRejectionCount, nonTargetTrials),
        accuracy: ratio(correctCount, totalTrials),
        meanRtMs: average(hitRts),
        rtStdDevMs: standardDeviation(hitRts),
        meanIsiMs: average(items.map((trial) => trial.isiMs)),
        dPrime: signalDetection.dPrime,
        criterion: signalDetection.criterion,
        signalDetection
    };
}

function buildBlockSummaries() {
    return blockPlans.map((plan) => {
        const blockTrials = trialLog.filter((trial) => trial.blockIndex === plan.blockIndex);
        const summary = summarizeTrials(blockTrials);

        return {
            blockIndex: plan.blockIndex,
            blockNumber: plan.blockNumber,
            fromTrial: plan.fromTrial,
            toTrial: plan.toTrial,
            trialCount: plan.trialCount,
            completedTrials: blockTrials.length,
            plannedTargetCount: plan.plannedTargetCount,
            plannedNonTargetCount: plan.plannedNonTargetCount,
            plannedTargetRatio: plan.plannedTargetRatio,
            plannedNonTargetRatio: plan.plannedNonTargetRatio,
            targetRatio: plan.targetRatio,
            nonTargetRatio: plan.nonTargetRatio,
            stimulusDurationMs: plan.stimulusDurationMs,
            isiMinMs: plan.isiMinMs,
            isiMaxMs: plan.isiMaxMs,
            meanPlannedIsiMs: plan.meanPlannedIsiMs,
            hitRate: roundMetric(summary.hitRate, 3),
            missRate: roundMetric(summary.missRate, 3),
            falseAlarmRate: roundMetric(summary.falseAlarmRate, 3),
            correctRejectionRate: roundMetric(summary.correctRejectionRate, 3),
            accuracy: roundMetric(summary.accuracy, 3),
            dPrime: summary.dPrime,
            criterion: summary.criterion,
            meanRtMs: summary.meanRtMs,
            rtStdDevMs: summary.rtStdDevMs,
            hitCount: summary.hitCount,
            missCount: summary.missCount,
            falseAlarmCount: summary.falseAlarmCount,
            correctRejectionCount: summary.correctRejectionCount
        };
    });
}

function buildBlockTrend(blockSummaries = buildBlockSummaries()) {
    const completed = blockSummaries.filter((block) => block.completedTrials > 0);
    if (completed.length === 0) {
        return {
            blockCount: 0,
            timeOnTaskDecline: false,
            trendLabel: "无完整 block 数据",
            hitRateDelta: 0,
            missRateDelta: 0,
            falseAlarmRateDelta: 0,
            meanRtDeltaMs: 0,
            rtStdDevDeltaMs: 0,
            dPrimeDelta: 0
        };
    }

    const first = completed[0];
    const last = completed[completed.length - 1];
    const previous = completed.length > 1 ? completed[completed.length - 2] : null;
    const hitRateDelta = roundMetric(last.hitRate - first.hitRate, 3);
    const missRateDelta = roundMetric(last.missRate - first.missRate, 3);
    const falseAlarmRateDelta = roundMetric(last.falseAlarmRate - first.falseAlarmRate, 3);
    const meanRtDeltaMs = last.meanRtMs - first.meanRtMs;
    const rtStdDevDeltaMs = last.rtStdDevMs - first.rtStdDevMs;
    const dPrimeDelta = roundMetric(last.dPrime - first.dPrime, 2);
    const recentHitRateDelta = previous ? roundMetric(last.hitRate - previous.hitRate, 3) : 0;
    const recentMeanRtDeltaMs = previous ? last.meanRtMs - previous.meanRtMs : 0;
    const recentRtStdDevDeltaMs = previous ? last.rtStdDevMs - previous.rtStdDevMs : 0;
    const timeOnTaskDecline = completed.length > 1 && (
        hitRateDelta <= -0.15
        || missRateDelta >= 0.15
        || meanRtDeltaMs >= 150
        || rtStdDevDeltaMs >= 150
        || dPrimeDelta <= -0.75
    );
    const trendLabel = timeOnTaskDecline
        ? "后段较前段出现警觉下降"
        : "block 间表现未见明显下降";

    return {
        blockCount: completed.length,
        firstBlockIndex: first.blockIndex,
        lastBlockIndex: last.blockIndex,
        hitRateDelta,
        missRateDelta,
        falseAlarmRateDelta,
        meanRtDeltaMs,
        rtStdDevDeltaMs,
        dPrimeDelta,
        recentHitRateDelta,
        recentMeanRtDeltaMs,
        recentRtStdDevDeltaMs,
        timeOnTaskDecline,
        trendLabel
    };
}

function settingsChanged(before, after) {
    return before.targetRatio !== after.targetRatio
        || before.stimulusDurationMs !== after.stimulusDurationMs
        || before.isiMinMs !== after.isiMinMs
        || before.isiMaxMs !== after.isiMaxMs
        || before.totalTrials !== after.totalTrials;
}

function determineAdaptiveSettings(blockSummary, beforeSettings, blockTrend) {
    const next = { ...beforeSettings };
    let decision = "maintain";
    let reason = "最近 block 的遗漏、误报和 RT 波动处于训练区间，保持下一段负荷。";

    if (blockSummary.falseAlarmRate >= 0.18 || blockSummary.falseAlarmCount >= 3) {
        decision = "reduce-commission";
        reason = "误报/commission 偏高，降低目标比例、拉开 ISI，并增加一组非目标抑制练习。";
        next.targetRatio -= TARGET_RATIO_STEP;
        next.stimulusDurationMs += STIMULUS_DURATION_STEP_MS;
        next.isiMinMs += ISI_STEP_MS;
        next.isiMaxMs += ISI_STEP_MS;
        next.totalTrials += TOTAL_TRIAL_STEP;
    } else if (blockSummary.missRate >= 0.25 || blockSummary.hitRate < 0.7) {
        decision = "support-vigilance";
        reason = "遗漏/omission 偏高，增加目标机会并放慢呈现速度以恢复警觉维持。";
        next.targetRatio += TARGET_RATIO_STEP;
        next.stimulusDurationMs += STIMULUS_DURATION_STEP_MS;
        next.isiMinMs += ISI_STEP_MS;
        next.isiMaxMs += ISI_STEP_MS;
        if (blockTrend.timeOnTaskDecline) next.totalTrials -= TOTAL_TRIAL_STEP;
    } else if (blockSummary.rtStdDevMs >= 350 || blockTrend.timeOnTaskDecline) {
        decision = "stabilize-vigilance";
        reason = "RT variability 或 time-on-task decline 偏高，放慢节奏并缩短剩余训练量。";
        next.stimulusDurationMs += STIMULUS_DURATION_STEP_MS;
        next.isiMinMs += ISI_STEP_MS;
        next.isiMaxMs += ISI_STEP_MS;
        next.totalTrials -= TOTAL_TRIAL_STEP;
    } else if (
        blockSummary.hitRate >= 0.9
        && blockSummary.falseAlarmRate <= 0.08
        && blockSummary.rtStdDevMs <= 250
        && blockSummary.dPrime >= 2
    ) {
        decision = "increase-load";
        reason = "命中、抑制和 RT 稳定性均达标，目标更稀少、速度更快，并延长一组训练。";
        next.targetRatio -= TARGET_RATIO_STEP / 2;
        next.stimulusDurationMs -= STIMULUS_DURATION_STEP_MS;
        next.isiMinMs -= ISI_STEP_MS;
        next.isiMaxMs -= ISI_STEP_MS;
        next.totalTrials += TOTAL_TRIAL_STEP;
    }

    const afterSettings = normalizeAdaptiveState(next);
    return {
        decision,
        reason,
        afterSettings,
        changed: settingsChanged(beforeSettings, afterSettings)
    };
}

function buildNextParameters(settings, reason = "") {
    const normalized = cloneAdaptiveState(settings);
    return {
        targetRatio: normalized.targetRatio,
        nonTargetRatio: normalized.nonTargetRatio,
        stimulusDurationMs: normalized.stimulusDurationMs,
        isiMinMs: normalized.isiMinMs,
        isiMaxMs: normalized.isiMaxMs,
        totalTrials: normalized.totalTrials,
        blockSize: normalized.blockSize,
        rationale: reason
    };
}

function maybeAdaptAfterBlock() {
    if (trialLog.length === 0 || trialLog.length % BLOCK_SIZE !== 0) return;

    const completedBlockIndex = Math.floor(trialLog.length / BLOCK_SIZE) - 1;
    if (adaptationEvents.some((event) => event.afterBlockIndex === completedBlockIndex)) return;

    const blockTrials = trialLog.filter((trial) => trial.blockIndex === completedBlockIndex);
    if (blockTrials.length === 0) return;

    const beforeSettings = cloneAdaptiveState(adaptiveState);
    const blockSummary = {
        blockIndex: completedBlockIndex,
        ...summarizeTrials(blockTrials)
    };
    const blockSummaries = buildBlockSummaries();
    const blockTrend = buildBlockTrend(blockSummaries);
    const decision = determineAdaptiveSettings(blockSummary, beforeSettings, blockTrend);
    adaptiveState = decision.afterSettings;

    adaptationEvents.push({
        eventIndex: adaptationEvents.length,
        afterBlockIndex: completedBlockIndex,
        afterBlockNumber: completedBlockIndex + 1,
        nextBlockNumber: completedBlockIndex + 2,
        triggerTrialCount: trialLog.length,
        decision: decision.decision,
        reason: decision.reason,
        changed: decision.changed,
        beforeSettings,
        afterSettings: decision.afterSettings,
        nextParameters: buildNextParameters(decision.afterSettings, decision.reason),
        blockMetrics: {
            hitRate: roundMetric(blockSummary.hitRate, 3),
            missRate: roundMetric(blockSummary.missRate, 3),
            falseAlarmRate: roundMetric(blockSummary.falseAlarmRate, 3),
            dPrime: blockSummary.dPrime,
            criterion: blockSummary.criterion,
            meanRtMs: blockSummary.meanRtMs,
            rtStdDevMs: blockSummary.rtStdDevMs
        },
        blockTrend
    });
}

function getMeanRtMs() {
    return average(reactionTimes);
}

function updateScore() {
    document.getElementById("hits").textContent = hits;
    document.getElementById("false-alarms").textContent = falseAlarms;
    document.getElementById("avg-rt").textContent = getMeanRtMs();
}

function buildAdaptiveSummary(finalSummary, blockTrend, blockSummaries) {
    const lastEvent = adaptationEvents[adaptationEvents.length - 1] || null;
    const reason = lastEvent
        ? lastEvent.reason
        : "本轮尚未触发参数调整，沿用当前 CPT 处方。";

    return {
        adaptiveMode: true,
        blockSize: BLOCK_SIZE,
        initialState: createInitialAdaptiveState(),
        finalState: cloneAdaptiveState(adaptiveState),
        nextParameters: buildNextParameters(adaptiveState, reason),
        adaptationEvents: adaptationEvents.map((event) => ({ ...event })),
        blockPlans: blockPlans.map((plan) => ({ ...plan })),
        blockSummaries,
        blockTrend,
        finalMetrics: {
            hitRate: roundMetric(finalSummary.hitRate, 3),
            missRate: roundMetric(finalSummary.missRate, 3),
            falseAlarmRate: roundMetric(finalSummary.falseAlarmRate, 3),
            dPrime: finalSummary.dPrime,
            criterion: finalSummary.criterion,
            rtStdDevMs: finalSummary.rtStdDevMs
        }
    };
}

function buildSummary() {
    const baseSummary = summarizeTrials(trialLog);
    const blockSummaries = buildBlockSummaries();
    const blockTrend = buildBlockTrend(blockSummaries);
    const adaptiveSummary = buildAdaptiveSummary(baseSummary, blockTrend, blockSummaries);
    const finalAdaptiveState = cloneAdaptiveState(adaptiveState);

    return {
        ...baseSummary,
        totalPlannedTrials: finalAdaptiveState.totalTrials,
        completedBlocks: blockTrend.blockCount,
        stimulusDurationMs: finalAdaptiveState.stimulusDurationMs,
        isiMinMs: finalAdaptiveState.isiMinMs,
        isiMaxMs: finalAdaptiveState.isiMaxMs,
        targetProbability: finalAdaptiveState.targetRatio,
        targetRatio: finalAdaptiveState.targetRatio,
        nonTargetRatio: finalAdaptiveState.nonTargetRatio,
        initialTargetRatio: INITIAL_TARGET_RATIO,
        initialTotalTrials: INITIAL_TOTAL_TRIALS,
        finalAdaptiveState,
        adaptiveState: finalAdaptiveState,
        nextParameters: adaptiveSummary.nextParameters,
        next: adaptiveSummary.nextParameters,
        blockTrend,
        blockSummaries,
        adaptiveSummary,
        sessionSeed,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    };
}

function buildScore(summary) {
    if (summary.targetTrials === 0 && summary.nonTargetTrials === 0) return 0;
    const sensitivityScore = summary.targetTrials === 0
        ? 1 - summary.falseAlarmRate
        : summary.nonTargetTrials === 0
            ? summary.hitRate
            : (summary.hitRate + (1 - summary.falseAlarmRate)) / 2;
    const variabilityPenalty = summary.rtStdDevMs >= 350 ? 8 : summary.rtStdDevMs >= 250 ? 4 : 0;
    const declinePenalty = summary.blockTrend.timeOnTaskDecline ? 6 : 0;
    return clampNumber(Math.round((sensitivityScore * 100) - variabilityPenalty - declinePenalty), 0, 100);
}

function formatPercent(value) {
    if (!Number.isFinite(value)) return "0%";
    return `${Math.round(value * 100)}%`;
}

function formatDurationMs(durationMs) {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function formatPrescription(settings) {
    if (!settings) return "下一轮参数未生成";
    return `目标 ${formatPercent(settings.targetRatio)}，刺激 ${settings.stimulusDurationMs}ms，ISI ${settings.isiMinMs}-${settings.isiMaxMs}ms，总轮次 ${settings.totalTrials}`;
}

function buildTrainingFeedback(summary) {
    const missText = `注意遗漏（miss/omission）${summary.missCount}/${summary.targetTrials}，命中率 ${formatPercent(summary.hitRate)}`;
    const impulseText = `冲动误按（false alarm/commission）${summary.falseAlarmCount}/${summary.nonTargetTrials}，误报率 ${formatPercent(summary.falseAlarmRate)}`;
    const sensitivityText = `敏感性 d'=${summary.dPrime}，判别标准 c=${summary.criterion}，RT SD=${summary.rtStdDevMs}ms`;
    const trendText = summary.blockTrend.timeOnTaskDecline
        ? "后段 block 出现 time-on-task 下降"
        : "block 级趋势未见明显警觉衰减";

    return `${missText}；${impulseText}。${sensitivityText}。${trendText}。下一轮参数：${formatPrescription(summary.nextParameters)}。`;
}

function saveTrainingSession(finishedAt) {
    if (hasSavedSession || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") return;

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const summary = buildSummary();
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
            accuracy: formatPercent(summary.accuracy),
            hitRate: formatPercent(summary.hitRate),
            missRate: formatPercent(summary.missRate),
            omissionRate: formatPercent(summary.omissionRate),
            falseAlarmRate: formatPercent(summary.falseAlarmRate),
            commissionRate: formatPercent(summary.commissionRate),
            correctRejectionRate: formatPercent(summary.correctRejectionRate),
            meanRT: `${summary.meanRtMs}ms`,
            meanRtMs: summary.meanRtMs,
            rtStdDev: `${summary.rtStdDevMs}ms`,
            rtStdDevMs: summary.rtStdDevMs,
            dPrime: summary.dPrime,
            criterion: summary.criterion,
            misses: summary.missCount,
            omissions: summary.omissionCount,
            falseAlarms: summary.falseAlarmCount,
            commissions: summary.commissionCount,
            correctRejections: summary.correctRejectionCount,
            blockTrend: summary.blockTrend,
            timeOnTaskDecline: summary.blockTrend.timeOnTaskDecline,
            adaptiveState: summary.adaptiveState,
            nextParameters: summary.nextParameters,
            next: summary.next,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        },
        tags: ["attention", "cpt", "sustained-attention", "vigilance", "impulse-control", "signal-detection"]
    });

    hasSavedSession = true;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function endGame() {
    if (!isGameActive && hasSavedSession) return;

    const finishedAt = new Date();
    completeCurrentTrial(true);
    isGameActive = false;
    clearGameTimers();

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const summary = buildSummary();

    document.getElementById("cpt-display").style.display = "none";
    document.getElementById("click-area").style.display = "none";
    document.getElementById("result-modal").style.display = "flex";

    setText("total-time", formatDurationMs(durationMs));
    setText("result-hits", hits);
    setText("result-misses", misses);
    setText("result-fa", falseAlarms);
    setText("result-cr", correctRejections);
    setText("result-rates", `${formatPercent(summary.hitRate)} / ${formatPercent(summary.falseAlarmRate)}`);
    setText("result-rt", `${summary.meanRtMs} ms`);
    setText("result-sdt", `d' ${summary.dPrime} / c ${summary.criterion}`);
    setText("result-rt-var", `${summary.rtStdDevMs} ms`);
    setText("result-trend", summary.blockTrend.trendLabel);
    setText("result-adaptive", formatPrescription(summary.nextParameters));
    setText("feedback-text", buildTrainingFeedback(summary));

    saveTrainingSession(finishedAt);
}

document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && isGameActive) {
        e.preventDefault();
        handleResponse();
    }
});

document.getElementById("click-area").addEventListener("mousedown", (e) => {
    if (isGameActive) {
        e.preventDefault();
        handleResponse();
    }
});

window.addEventListener("keydown", (e) => {
    if (e.keyCode === 32 && e.target === document.body) {
        e.preventDefault();
    }
});

window.startGame = startGame;
