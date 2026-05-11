const MODULE_ID = 'go-no-go';
const CONTENT_VERSION = 'go-no-go-p0c-seeded-sdt-adaptive-v3';

const TOTAL_TRIALS = 50;
const BLOCK_SIZE = 10;
const ADAPTIVE_MODE = true;
const INITIAL_NO_GO_RATIO = 0.2;
const GO_PROBABILITY = 1 - INITIAL_NO_GO_RATIO;
const INITIAL_STIMULUS_TIMEOUT = 1000; // Initial time window to respond
const STIMULUS_TIMEOUT = INITIAL_STIMULUS_TIMEOUT;
const FEEDBACK_DURATION = 300;
const MIN_ISI = 800;
const MAX_ISI = 1500;
const MIN_NO_GO_RATIO = 0.12;
const MAX_NO_GO_RATIO = 0.4;
const NO_GO_RATIO_STEP = 0.04;
const MIN_STIMULUS_DURATION = 650;
const MAX_STIMULUS_DURATION = 1250;
const STIMULUS_DURATION_STEP = 100;
const MIN_ADAPTIVE_ISI = 550;
const MAX_ADAPTIVE_ISI = 1900;
const MIN_ISI_SPREAD = 350;
const ISI_STEP = 120;

let currentTrial = 0;
let isGameActive = false;
let trialStartTime = 0;
let trials = [];
let responses = [];
let stimulusTimeoutId = null;
let hasResponded = false;
let sessionStartedAt = null;
let sessionSeed = '';
let hasSavedSession = false;
let adaptiveState = null;
let adaptationEvents = [];
let blockPlans = [];
let trialPlanRng = null;

// DOM Elements
const instructionOverlay = document.getElementById('instruction-overlay');
const gameDisplay = document.getElementById('gng-display');
const stimulusCircle = document.getElementById('stimulus-circle');
const resultModal = document.getElementById('result-modal');
const accuracyDisplay = document.getElementById('accuracy');
const avgRtDisplay = document.getElementById('avg-rt');
const ratioProgressionDisplay = document.getElementById('ratio-progression');
const speedProgressionDisplay = document.getElementById('speed-progression');
const isiProgressionDisplay = document.getElementById('isi-progression');

// Event Listener for Spacebar
document.addEventListener('keydown', (e) => {
    if (!isGameActive || hasResponded) return;

    if (e.code === 'Space') {
        e.preventDefault();
        handleResponse();
    }
});

// Also support touch/click for mobile
gameDisplay.addEventListener('touchstart', (e) => {
    if (!isGameActive || hasResponded) return;
    e.preventDefault();
    handleResponse();
});
gameDisplay.addEventListener('mousedown', (e) => {
    if (!isGameActive || hasResponded) return;
    e.preventDefault();
    handleResponse();
});

function fallbackHashString(value) {
    const text = String(value || '');
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
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

function createSessionSeed() {
    if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === 'function') {
        return window.SeededRandom.createSessionSeed(MODULE_ID);
    }

    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get('seed');
    if (urlSeed && urlSeed.trim()) {
        return urlSeed.trim();
    }
    return `${MODULE_ID}-${Date.now().toString(36)}`;
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === 'function') {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return fallbackMulberry32(fallbackHashString(seed));
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizeAdaptiveSettings(settings) {
    const noGoRatio = roundMetric(clamp(settings.noGoRatio, MIN_NO_GO_RATIO, MAX_NO_GO_RATIO), 3);
    const stimulusDurationMs = Math.round(clamp(
        settings.stimulusDurationMs,
        MIN_STIMULUS_DURATION,
        MAX_STIMULUS_DURATION
    ));
    let isiMinMs = Math.round(clamp(
        settings.isiMinMs,
        MIN_ADAPTIVE_ISI,
        MAX_ADAPTIVE_ISI - MIN_ISI_SPREAD
    ));
    let isiMaxMs = Math.round(clamp(
        settings.isiMaxMs,
        MIN_ADAPTIVE_ISI + MIN_ISI_SPREAD,
        MAX_ADAPTIVE_ISI
    ));

    if (isiMaxMs < isiMinMs + MIN_ISI_SPREAD) {
        isiMaxMs = Math.min(MAX_ADAPTIVE_ISI, isiMinMs + MIN_ISI_SPREAD);
    }
    if (isiMaxMs < isiMinMs + MIN_ISI_SPREAD) {
        isiMinMs = Math.max(MIN_ADAPTIVE_ISI, isiMaxMs - MIN_ISI_SPREAD);
    }

    return {
        noGoRatio,
        goRatio: roundMetric(1 - noGoRatio, 3),
        stimulusDurationMs,
        isiMinMs,
        isiMaxMs
    };
}

function createInitialAdaptiveState() {
    return normalizeAdaptiveSettings({
        noGoRatio: INITIAL_NO_GO_RATIO,
        stimulusDurationMs: STIMULUS_TIMEOUT,
        isiMinMs: MIN_ISI,
        isiMaxMs: MAX_ISI
    });
}

function cloneAdaptiveSettings(settings) {
    return normalizeAdaptiveSettings({ ...settings });
}

function shuffleWithRng(list, rng) {
    if (window.SeededRandom && typeof window.SeededRandom.shuffleInPlace === 'function') {
        return window.SeededRandom.shuffleInPlace(list, rng);
    }

    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function initializeAdaptiveSession(seed) {
    adaptiveState = createInitialAdaptiveState();
    adaptationEvents = [];
    blockPlans = [];
    trialPlanRng = createRng(`${seed}:${CONTENT_VERSION}:adaptive-trial-plan`);
}

function plannedNoGoCountForBlock(trialCount, noGoRatio) {
    if (trialCount <= 1) {
        return noGoRatio >= 0.5 ? 1 : 0;
    }
    return Math.min(trialCount - 1, Math.max(1, Math.round(trialCount * noGoRatio)));
}

function appendAdaptiveBlock(targetTrials = trials) {
    const remainingTrials = TOTAL_TRIALS - targetTrials.length;
    if (remainingTrials <= 0) return;

    if (!adaptiveState) {
        adaptiveState = createInitialAdaptiveState();
    }
    if (!trialPlanRng) {
        trialPlanRng = createRng(`${sessionSeed || MODULE_ID}:${CONTENT_VERSION}:adaptive-trial-plan:fallback`);
    }

    const blockIndex = blockPlans.length;
    const trialCount = Math.min(BLOCK_SIZE, remainingTrials);
    const settings = cloneAdaptiveSettings(adaptiveState);
    const noGoCount = plannedNoGoCountForBlock(trialCount, settings.noGoRatio);
    const goCount = trialCount - noGoCount;
    const plannedTypes = [];

    for (let i = 0; i < goCount; i++) plannedTypes.push('go');
    for (let i = 0; i < noGoCount; i++) plannedTypes.push('nogo');
    shuffleWithRng(plannedTypes, trialPlanRng);

    const fromTrial = targetTrials.length;
    const plannedGoRatio = trialCount > 0 ? goCount / trialCount : 0;
    const plannedNoGoRatio = trialCount > 0 ? noGoCount / trialCount : 0;
    const generatedTrials = plannedTypes.map((plannedType, offset) => {
        const isi = Math.floor(
            trialPlanRng() * (settings.isiMaxMs - settings.isiMinMs + 1)
        ) + settings.isiMinMs;
        return {
            trialIndex: fromTrial + offset,
            blockIndex,
            blockNumber: blockIndex + 1,
            withinBlockIndex: offset,
            plannedType,
            type: plannedType,
            stimulus: plannedType === 'go' ? 'greenCircle' : 'redCircle',
            isi,
            isiMinMs: settings.isiMinMs,
            isiMaxMs: settings.isiMaxMs,
            stimulusDurationMs: settings.stimulusDurationMs,
            responseWindowMs: settings.stimulusDurationMs,
            targetGoRatio: settings.goRatio,
            targetNoGoRatio: settings.noGoRatio,
            plannedGoRatio: roundMetric(plannedGoRatio, 3),
            plannedNoGoRatio: roundMetric(plannedNoGoRatio, 3),
            adaptiveMode: ADAPTIVE_MODE
        };
    });

    blockPlans.push({
        blockIndex,
        blockNumber: blockIndex + 1,
        fromTrial,
        toTrial: fromTrial + trialCount - 1,
        trialCount,
        plannedGoCount: goCount,
        plannedNoGoCount: noGoCount,
        plannedGoRatio: roundMetric(plannedGoRatio, 3),
        plannedNoGoRatio: roundMetric(plannedNoGoRatio, 3),
        targetGoRatio: settings.goRatio,
        targetNoGoRatio: settings.noGoRatio,
        stimulusDurationMs: settings.stimulusDurationMs,
        isiMinMs: settings.isiMinMs,
        isiMaxMs: settings.isiMaxMs,
        meanPlannedIsiMs: average(generatedTrials.map((trial) => trial.isi))
    });

    targetTrials.push(...generatedTrials);
}

function startGame() {
    isGameActive = true;
    currentTrial = 0;
    responses = [];
    sessionSeed = createSessionSeed();
    trials = generateTrials(sessionSeed);
    sessionStartedAt = new Date();
    hasSavedSession = false;

    instructionOverlay.style.display = 'none';
    gameDisplay.style.display = 'flex';
    resultModal.style.display = 'none';
    accuracyDisplay.textContent = '100%';
    avgRtDisplay.textContent = '-- ms';

    setTimeout(runTrial, 1000);
}

function generateTrials(seed) {
    const list = [];
    initializeAdaptiveSession(seed);
    appendAdaptiveBlock(list);
    return list;
}

function runTrial() {
    if (currentTrial >= TOTAL_TRIALS) {
        endGame();
        return;
    }

    if (currentTrial >= trials.length) {
        appendAdaptiveBlock();
    }

    if (currentTrial >= trials.length) {
        endGame();
        return;
    }

    const trial = trials[currentTrial];
    hasResponded = false;

    // Show Stimulus
    stimulusCircle.className = 'stimulus-circle';
    if (trial.plannedType === 'go') {
        stimulusCircle.style.backgroundColor = '#2ecc71'; // Green
    } else {
        stimulusCircle.style.backgroundColor = '#e74c3c'; // Red
    }
    stimulusCircle.style.transform = 'scale(1)';
    stimulusCircle.style.opacity = '1';

    trialStartTime = Date.now();

    // Set timeout for response window
    stimulusTimeoutId = setTimeout(() => {
        if (!hasResponded) {
            handleTimeout();
        }
    }, trial.stimulusDurationMs);
}

function classifyTrial(plannedType, pressed) {
    if (plannedType === 'go' && pressed) return 'goHit';
    if (plannedType === 'go' && !pressed) return 'goOmission';
    if (plannedType === 'nogo' && pressed) return 'noGoCommission';
    return 'noGoCorrect';
}

function isCorrectClassification(classification) {
    return classification === 'goHit' || classification === 'noGoCorrect';
}

function handleResponse() {
    if (!isGameActive || hasResponded) return;

    hasResponded = true;
    clearTimeout(stimulusTimeoutId);

    const rt = Date.now() - trialStartTime;
    const trial = trials[currentTrial];
    const isCorrect = (trial.plannedType === 'go');

    // Feedback
    if (!isCorrect) {
        // False Alarm (Pressed on No-Go)
        stimulusCircle.style.backgroundColor = '#95a5a6'; // Grey out
        gameDisplay.style.backgroundColor = 'rgba(231, 76, 60, 0.2)'; // Red flash
        setTimeout(() => gameDisplay.style.backgroundColor = 'transparent', 200);
    } else {
        // Hit (Pressed on Go)
        stimulusCircle.style.transform = 'scale(0.8)';
    }

    recordResponse(trial, true, rt);

    setTimeout(() => {
        stimulusCircle.style.opacity = '0';
        setTimeout(() => {
            currentTrial++;
            runTrial();
        }, trial.isi);
    }, 200);
}

function handleTimeout() {
    if (hasResponded) return;

    hasResponded = true;

    const trial = trials[currentTrial];
    const isCorrect = (trial.plannedType === 'nogo'); // Correct if didn't press on No-Go

    // Feedback
    if (!isCorrect) {
        // Miss (Didn't press on Go)
        gameDisplay.style.backgroundColor = 'rgba(241, 196, 15, 0.2)'; // Yellow flash
        setTimeout(() => gameDisplay.style.backgroundColor = 'transparent', 200);
    }

    recordResponse(trial, false, 0);

    stimulusCircle.style.opacity = '0';
    setTimeout(() => {
        currentTrial++;
        runTrial();
    }, trial.isi);
}

function recordResponse(trial, pressed, rt) {
    const plannedType = trial.plannedType;
    const classification = classifyTrial(plannedType, pressed);
    const correct = isCorrectClassification(classification);
    const rtMs = pressed ? rt : null;

    responses.push({
        trialIndex: currentTrial,
        blockIndex: trial.blockIndex,
        blockNumber: trial.blockNumber,
        withinBlockIndex: trial.withinBlockIndex,
        plannedType,
        type: plannedType,
        stimulus: trial.stimulus,
        adaptiveMode: trial.adaptiveMode,
        targetGoRatio: trial.targetGoRatio,
        targetNoGoRatio: trial.targetNoGoRatio,
        plannedGoRatio: trial.plannedGoRatio,
        plannedNoGoRatio: trial.plannedNoGoRatio,
        stimulusDurationMs: trial.stimulusDurationMs,
        responseWindowMs: trial.responseWindowMs,
        isiMs: trial.isi,
        isiMinMs: trial.isiMinMs,
        isiMaxMs: trial.isiMaxMs,
        response: pressed ? 'press' : 'none',
        isGo: plannedType === 'go',
        isNoGo: plannedType === 'nogo',
        pressed,
        responded: pressed,
        rt: rtMs,
        rtMs,
        classification,
        correct,
        timedOut: !pressed
    });
    updateLiveStats();
    maybeAdaptAfterBlock();
}

function updateLiveStats() {
    const correctCount = responses.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / responses.length) * 100) || 100;

    const goResponses = responses.filter(r => r.classification === 'goHit');
    const avgRt = goResponses.length > 0
        ? Math.round(goResponses.reduce((sum, r) => sum + r.rt, 0) / goResponses.length)
        : 0;

    accuracyDisplay.textContent = `${accuracy}%`;
    if (avgRt > 0) avgRtDisplay.textContent = `${avgRt} ms`;
}

function average(values) {
    const validValues = values.filter((value) => Number.isFinite(value));
    if (validValues.length === 0) return 0;
    return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

function roundMetric(value, digits = 3) {
    if (!Number.isFinite(value)) return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
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

function buildSignalDetection(hitCount, goTrials, commissionCount, noGoTrials) {
    const hitRateAdjusted = adjustedRate(hitCount, goTrials);
    const commissionRateAdjusted = adjustedRate(commissionCount, noGoTrials);
    const zHit = approximateZ(hitRateAdjusted);
    const zCommission = approximateZ(commissionRateAdjusted);

    return {
        dPrime: roundMetric(zHit - zCommission),
        criterion: roundMetric(-0.5 * (zHit + zCommission)),
        hitRateAdjusted: roundMetric(hitRateAdjusted, 4),
        commissionRateAdjusted: roundMetric(commissionRateAdjusted, 4),
        method: 'loglinear-corrected approximate dPrime/criterion'
    };
}

function summarizeResponseSet(items) {
    const totalTrials = items.length;
    const goTrials = items.filter(r => r.isGo).length;
    const noGoTrials = items.filter(r => r.isNoGo).length;
    const hitCount = items.filter(r => r.classification === 'goHit').length;
    const omissionCount = items.filter(r => r.classification === 'goOmission').length;
    const noGoCorrectCount = items.filter(r => r.classification === 'noGoCorrect').length;
    const commissionCount = items.filter(r => r.classification === 'noGoCommission').length;
    const correctCount = hitCount + noGoCorrectCount;
    const hitRts = items
        .filter(r => r.classification === 'goHit')
        .map(r => r.rtMs);
    const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
    const hitRate = goTrials > 0 ? hitCount / goTrials : 0;
    const commissionErrorRate = noGoTrials > 0 ? commissionCount / noGoTrials : 0;
    const omissionRate = goTrials > 0 ? omissionCount / goTrials : 0;
    const signalDetection = buildSignalDetection(hitCount, goTrials, commissionCount, noGoTrials);

    return {
        totalTrials,
        goTrials,
        noGoTrials,
        hitCount,
        omissionCount,
        noGoCorrectCount,
        commissionCount,
        correctCount,
        accuracy,
        hitRate,
        commissionErrorRate,
        omissionRate,
        meanRtMs: average(hitRts),
        dPrime: signalDetection.dPrime,
        criterion: signalDetection.criterion,
        signalDetection
    };
}

function buildRatioProgression() {
    return blockPlans.map((plan) => ({
        blockNumber: plan.blockNumber,
        targetGoRatio: plan.targetGoRatio,
        targetNoGoRatio: plan.targetNoGoRatio,
        plannedGoRatio: plan.plannedGoRatio,
        plannedNoGoRatio: plan.plannedNoGoRatio,
        plannedGoCount: plan.plannedGoCount,
        plannedNoGoCount: plan.plannedNoGoCount
    }));
}

function buildSpeedProgression() {
    return blockPlans.map((plan) => ({
        blockNumber: plan.blockNumber,
        stimulusDurationMs: plan.stimulusDurationMs,
        isiMinMs: plan.isiMinMs,
        isiMaxMs: plan.isiMaxMs,
        meanPlannedIsiMs: plan.meanPlannedIsiMs
    }));
}

function settingsChanged(before, after) {
    return before.noGoRatio !== after.noGoRatio
        || before.stimulusDurationMs !== after.stimulusDurationMs
        || before.isiMinMs !== after.isiMinMs
        || before.isiMaxMs !== after.isiMaxMs;
}

function determineAdaptiveSettings(blockSummary, beforeSettings) {
    const next = { ...beforeSettings };
    let decision = 'maintain';
    let reason = '当前 block 表现处于训练区间，保持下一段负荷。';

    if (blockSummary.commissionErrorRate >= 0.25) {
        decision = 'ease-impulse-control';
        reason = 'No-Go commission 偏高，先增加 No-Go 练习密度并放慢节奏。';
        next.noGoRatio += NO_GO_RATIO_STEP;
        next.stimulusDurationMs += STIMULUS_DURATION_STEP;
        next.isiMinMs += ISI_STEP;
        next.isiMaxMs += ISI_STEP;
    } else if (blockSummary.omissionRate >= 0.2 || blockSummary.hitRate < 0.82) {
        decision = 'ease-speed-load';
        reason = 'Go hit 率偏低或遗漏偏高，说明当前速度负荷过高。';
        next.stimulusDurationMs += STIMULUS_DURATION_STEP;
        next.isiMinMs += ISI_STEP;
        next.isiMaxMs += ISI_STEP;
    } else if (
        blockSummary.commissionErrorRate <= 0.1
        && blockSummary.omissionRate <= 0.08
        && blockSummary.hitRate >= 0.92
        && blockSummary.dPrime !== null
        && blockSummary.dPrime >= 2
    ) {
        decision = 'increase-inhibition-load';
        reason = '抑制和 Go 反应都稳定，降低 No-Go 概率并加快节奏。';
        next.noGoRatio -= NO_GO_RATIO_STEP;
        next.stimulusDurationMs -= STIMULUS_DURATION_STEP;
        next.isiMinMs -= ISI_STEP;
        next.isiMaxMs -= ISI_STEP;
    } else if (blockSummary.dPrime !== null && blockSummary.dPrime < 1) {
        decision = 'stabilize-discrimination';
        reason = "d' 偏低，先降低判别与节奏压力。";
        next.noGoRatio += NO_GO_RATIO_STEP / 2;
        next.stimulusDurationMs += STIMULUS_DURATION_STEP;
        next.isiMinMs += Math.round(ISI_STEP / 2);
        next.isiMaxMs += Math.round(ISI_STEP / 2);
    }

    const afterSettings = normalizeAdaptiveSettings(next);
    return {
        decision,
        reason,
        afterSettings,
        changed: settingsChanged(beforeSettings, afterSettings)
    };
}

function maybeAdaptAfterBlock() {
    if (!ADAPTIVE_MODE || responses.length === 0) return;
    if (responses.length % BLOCK_SIZE !== 0) return;

    const completedBlockIndex = Math.floor(responses.length / BLOCK_SIZE) - 1;
    if (adaptationEvents.some((event) => event.afterBlockIndex === completedBlockIndex)) return;

    const blockResponses = responses.filter((response) => response.blockIndex === completedBlockIndex);
    if (blockResponses.length === 0) return;

    const beforeSettings = cloneAdaptiveSettings(adaptiveState || createInitialAdaptiveState());
    const blockSummary = summarizeResponseSet(blockResponses);
    const decision = determineAdaptiveSettings(blockSummary, beforeSettings);
    adaptiveState = decision.afterSettings;

    adaptationEvents.push({
        eventIndex: adaptationEvents.length,
        afterBlockIndex: completedBlockIndex,
        afterBlockNumber: completedBlockIndex + 1,
        nextBlockNumber: completedBlockIndex + 2,
        triggerTrialCount: responses.length,
        decision: decision.decision,
        reason: decision.reason,
        changed: decision.changed,
        beforeSettings,
        afterSettings: decision.afterSettings,
        blockMetrics: {
            hitRate: roundMetric(blockSummary.hitRate, 3),
            commissionErrorRate: roundMetric(blockSummary.commissionErrorRate, 3),
            omissionRate: roundMetric(blockSummary.omissionRate, 3),
            dPrime: blockSummary.dPrime,
            criterion: blockSummary.criterion,
            meanRtMs: blockSummary.meanRtMs
        }
    });
}

function buildBlockLevelSummary() {
    return blockPlans.map((plan) => {
        const blockResponses = responses.filter((response) => response.blockIndex === plan.blockIndex);
        const performance = summarizeResponseSet(blockResponses);
        const event = adaptationEvents.find((item) => item.afterBlockIndex === plan.blockIndex) || null;

        return {
            blockIndex: plan.blockIndex,
            blockNumber: plan.blockNumber,
            fromTrial: plan.fromTrial,
            toTrial: plan.toTrial,
            trialCount: plan.trialCount,
            plannedGoCount: plan.plannedGoCount,
            plannedNoGoCount: plan.plannedNoGoCount,
            plannedGoRatio: plan.plannedGoRatio,
            plannedNoGoRatio: plan.plannedNoGoRatio,
            targetGoRatio: plan.targetGoRatio,
            targetNoGoRatio: plan.targetNoGoRatio,
            stimulusDurationMs: plan.stimulusDurationMs,
            isiMinMs: plan.isiMinMs,
            isiMaxMs: plan.isiMaxMs,
            hitRate: roundMetric(performance.hitRate, 3),
            commissionErrorRate: roundMetric(performance.commissionErrorRate, 3),
            omissionRate: roundMetric(performance.omissionRate, 3),
            dPrime: performance.dPrime,
            criterion: performance.criterion,
            meanRtMs: performance.meanRtMs,
            adaptationDecision: event ? event.decision : 'none',
            nextSettings: event ? event.afterSettings : null
        };
    });
}

function buildAdaptiveSummary() {
    return {
        adaptiveMode: ADAPTIVE_MODE,
        blockSize: BLOCK_SIZE,
        initialSettings: createInitialAdaptiveState(),
        finalSettings: cloneAdaptiveSettings(adaptiveState || createInitialAdaptiveState()),
        adaptationEvents: adaptationEvents.map((event) => ({ ...event })),
        ratioProgression: buildRatioProgression(),
        speedProgression: buildSpeedProgression(),
        blockLevelSummary: buildBlockLevelSummary()
    };
}

function formatPrescription(settings) {
    return `下一轮处方：No-Go ${formatPercent(settings.noGoRatio)}，刺激 ${settings.stimulusDurationMs}ms，ISI ${settings.isiMinMs}-${settings.isiMaxMs}ms。`;
}

function buildFeedback(summary) {
    const prescription = formatPrescription(summary.finalAdaptiveSettings || createInitialAdaptiveState());
    const speedLoadHigh = summary.omissionRate >= 0.2 || summary.hitRate < 0.82;

    if (speedLoadHigh) {
        return {
            profile: '速度负荷过高型',
            recommendation: `本轮 Go 命中不足或遗漏偏高，下一轮先延长反应窗口并拉开 ISI，避免为了赶速度牺牲 Go 稳定性。${prescription}`
        };
    }
    if (summary.commissionErrorRate >= 0.2 || summary.commissionCount >= 2) {
        return {
            profile: '冲动误按型',
            recommendation: `红色 No-Go 上误按偏多，下一轮先增加停手练习密度并放慢节奏，按键前确认不是红色。${prescription}`
        };
    }
    if (summary.omissionRate >= 0.15 || summary.omissionCount >= 5) {
        return {
            profile: '注意遗漏型',
            recommendation: `绿色 Go 漏按偏多，下一轮保持中央注视，绿色出现即响应，先把 hit rate 拉回稳定区间。${prescription}`
        };
    }
    return {
        profile: '遗漏与冲动误按控制较均衡',
        recommendation: `下一轮可维持或小幅增加抑制负荷，在不增加红色误按的前提下稳定绿色反应。${prescription}`
    };
}

function buildSummary() {
    const performance = summarizeResponseSet(responses);
    const adaptiveSummary = buildAdaptiveSummary();
    const feedback = buildFeedback({
        ...performance,
        finalAdaptiveSettings: adaptiveSummary.finalSettings
    });

    return {
        ...performance,
        feedbackProfile: feedback.profile,
        recommendation: feedback.recommendation,
        adaptiveMode: adaptiveSummary.adaptiveMode,
        blockSize: adaptiveSummary.blockSize,
        initialAdaptiveSettings: adaptiveSummary.initialSettings,
        finalAdaptiveSettings: adaptiveSummary.finalSettings,
        adaptationEvents: adaptiveSummary.adaptationEvents,
        ratioProgression: adaptiveSummary.ratioProgression,
        speedProgression: adaptiveSummary.speedProgression,
        blockLevelSummary: adaptiveSummary.blockLevelSummary,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    };
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function formatRatioProgression(progression) {
    if (!progression || progression.length === 0) return '--';
    return progression
        .map((item) => `B${item.blockNumber} ${formatPercent(item.plannedNoGoRatio)}`)
        .join(' → ');
}

function formatSpeedProgression(progression) {
    if (!progression || progression.length === 0) return '--';
    return progression
        .map((item) => `B${item.blockNumber} ${item.stimulusDurationMs}ms`)
        .join(' → ');
}

function formatIsiProgression(progression) {
    if (!progression || progression.length === 0) return '--';
    return progression
        .map((item) => `B${item.blockNumber} ${item.isiMinMs}-${item.isiMaxMs}ms`)
        .join(' → ');
}

function saveTrainingSession(finishedAt) {
    if (hasSavedSession || !window.TrainingResults || typeof window.TrainingResults.saveSession !== 'function') return;

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const summary = buildSummary();

    window.TrainingResults.saveSession({
        moduleId: MODULE_ID,
        gameId: MODULE_ID,
        gameName: "Go/No-Go 抑制控制",
        startedAt,
        finishedAt,
        durationMs,
        score: Math.round(summary.accuracy * 100),
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        summary,
        trials: responses.map((trial) => ({
            trialIndex: trial.trialIndex,
            blockIndex: trial.blockIndex,
            blockNumber: trial.blockNumber,
            withinBlockIndex: trial.withinBlockIndex,
            plannedType: trial.plannedType,
            type: trial.type,
            stimulus: trial.stimulus,
            adaptiveMode: trial.adaptiveMode,
            targetGoRatio: trial.targetGoRatio,
            targetNoGoRatio: trial.targetNoGoRatio,
            plannedGoRatio: trial.plannedGoRatio,
            plannedNoGoRatio: trial.plannedNoGoRatio,
            stimulusDurationMs: trial.stimulusDurationMs,
            responseWindowMs: trial.responseWindowMs,
            isiMs: trial.isiMs,
            isiMinMs: trial.isiMinMs,
            isiMaxMs: trial.isiMaxMs,
            response: trial.response,
            isGo: trial.isGo,
            isNoGo: trial.isNoGo,
            responded: trial.responded,
            correct: trial.correct,
            rtMs: trial.rtMs,
            classification: trial.classification,
            timedOut: trial.timedOut
        })),
        metrics: {
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            accuracy: formatPercent(summary.accuracy),
            hitRate: formatPercent(summary.hitRate),
            commissionErrorRate: formatPercent(summary.commissionErrorRate),
            omissionRate: formatPercent(summary.omissionRate),
            dPrime: summary.dPrime,
            criterion: summary.criterion,
            meanRt: `${summary.meanRtMs}ms`,
            adaptiveMode: summary.adaptiveMode,
            finalNoGoRatio: formatPercent(summary.finalAdaptiveSettings.noGoRatio),
            finalStimulusDuration: `${summary.finalAdaptiveSettings.stimulusDurationMs}ms`,
            finalIsiRange: `${summary.finalAdaptiveSettings.isiMinMs}-${summary.finalAdaptiveSettings.isiMaxMs}ms`,
            adaptationEvents: summary.adaptationEvents,
            ratioProgression: summary.ratioProgression,
            speedProgression: summary.speedProgression,
            blockLevelSummary: summary.blockLevelSummary
        },
        tags: ["attention", "inhibition", "go-no-go"]
    });

    hasSavedSession = true;
}

function endGame() {
    isGameActive = false;

    const goTrials = responses.filter(r => r.type === 'go');
    const nogoTrials = responses.filter(r => r.type === 'nogo');

    const goAccuracy = goTrials.length > 0
        ? Math.round((goTrials.filter(r => r.correct).length / goTrials.length) * 100)
        : 0;

    const nogoAccuracy = nogoTrials.length > 0
        ? Math.round((nogoTrials.filter(r => r.correct).length / nogoTrials.length) * 100)
        : 0;

    const correctGoResponses = goTrials.filter(r => r.correct && r.pressed);
    const avgRt = correctGoResponses.length > 0
        ? Math.round(correctGoResponses.reduce((sum, r) => sum + r.rt, 0) / correctGoResponses.length)
        : 0;
    const summary = buildSummary();

    document.getElementById('go-accuracy').textContent = `${goAccuracy}%`;
    document.getElementById('nogo-accuracy').textContent = `${nogoAccuracy}%`;
    document.getElementById('final-rt').textContent = `${avgRt} ms`;
    document.getElementById('commission-rate').textContent = formatPercent(summary.commissionErrorRate);
    document.getElementById('omission-rate').textContent = formatPercent(summary.omissionRate);
    document.getElementById('signal-detection').textContent = `d' ${summary.dPrime} / c ${summary.criterion}`;
    if (ratioProgressionDisplay) {
        ratioProgressionDisplay.textContent = formatRatioProgression(summary.ratioProgression);
    }
    if (speedProgressionDisplay) {
        speedProgressionDisplay.textContent = formatSpeedProgression(summary.speedProgression);
    }
    if (isiProgressionDisplay) {
        isiProgressionDisplay.textContent = formatIsiProgression(summary.speedProgression);
    }
    document.getElementById('feedback-text').textContent = `${summary.feedbackProfile}。${summary.recommendation}`;

    saveTrainingSession(new Date());

    gameDisplay.style.display = 'none';
    resultModal.style.display = 'flex';
}
