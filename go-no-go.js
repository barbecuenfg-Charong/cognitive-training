const MODULE_ID = 'go-no-go';
const CONTENT_VERSION = 'go-no-go-p0c-seeded-sdt-v2';

const TOTAL_TRIALS = 50;
const GO_PROBABILITY = 0.8;
const STIMULUS_TIMEOUT = 1000; // Time window to respond
const FEEDBACK_DURATION = 300;
const MIN_ISI = 800;
const MAX_ISI = 1500;

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

// DOM Elements
const instructionOverlay = document.getElementById('instruction-overlay');
const gameDisplay = document.getElementById('gng-display');
const stimulusCircle = document.getElementById('stimulus-circle');
const resultModal = document.getElementById('result-modal');
const accuracyDisplay = document.getElementById('accuracy');
const avgRtDisplay = document.getElementById('avg-rt');

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

    setTimeout(runTrial, 1000);
}

function generateTrials(seed) {
    const rng = createRng(`${seed}:${CONTENT_VERSION}:trial-plan`);
    const list = [];
    for (let i = 0; i < TOTAL_TRIALS; i++) {
        const plannedType = rng() < GO_PROBABILITY ? 'go' : 'nogo';
        list.push({
            trialIndex: i,
            plannedType,
            type: plannedType,
            stimulus: plannedType === 'go' ? 'greenCircle' : 'redCircle',
            isi: Math.floor(rng() * (MAX_ISI - MIN_ISI) + MIN_ISI)
        });
    }
    return list;
}

function runTrial() {
    if (currentTrial >= TOTAL_TRIALS) {
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
    }, STIMULUS_TIMEOUT);
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
        plannedType,
        type: plannedType,
        stimulus: trial.stimulus,
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

function buildFeedback(summary) {
    if (summary.omissionRate >= 0.15 && summary.commissionErrorRate >= 0.2) {
        return {
            profile: '注意遗漏与冲动误按并存',
            recommendation: '下一轮先放慢半拍确认颜色，保持注视中央，绿色再按、红色停手。'
        };
    }
    if (summary.omissionRate >= 0.15 || summary.omissionCount >= 5) {
        return {
            profile: '遗漏型注意不足更突出',
            recommendation: '下一轮重点提高警觉性，绿色出现后立即响应，避免等到刺激快消失。'
        };
    }
    if (summary.commissionErrorRate >= 0.2 || summary.commissionCount >= 2) {
        return {
            profile: 'commission 冲动抑制不足更突出',
            recommendation: '下一轮重点练抑制，看到刺激先确认是否为红色，红色时保持不按。'
        };
    }
    return {
        profile: '遗漏与冲动误按控制较均衡',
        recommendation: '下一轮保持当前节奏，在不增加红色误按的前提下稳定绿色反应。'
    };
}

function buildSummary() {
    const totalTrials = responses.length;
    const goTrials = responses.filter(r => r.isGo).length;
    const noGoTrials = responses.filter(r => r.isNoGo).length;
    const hitCount = responses.filter(r => r.classification === 'goHit').length;
    const omissionCount = responses.filter(r => r.classification === 'goOmission').length;
    const noGoCorrectCount = responses.filter(r => r.classification === 'noGoCorrect').length;
    const commissionCount = responses.filter(r => r.classification === 'noGoCommission').length;
    const correctCount = hitCount + noGoCorrectCount;
    const hitRts = responses
        .filter(r => r.classification === 'goHit')
        .map(r => r.rtMs);
    const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
    const hitRate = goTrials > 0 ? hitCount / goTrials : 0;
    const commissionErrorRate = noGoTrials > 0 ? commissionCount / noGoTrials : 0;
    const omissionRate = goTrials > 0 ? omissionCount / goTrials : 0;
    const signalDetection = buildSignalDetection(hitCount, goTrials, commissionCount, noGoTrials);
    const feedback = buildFeedback({
        omissionRate,
        omissionCount,
        commissionErrorRate,
        commissionCount
    });

    return {
        totalTrials,
        goTrials,
        noGoTrials,
        hitCount,
        omissionCount,
        noGoCorrectCount,
        commissionCount,
        accuracy,
        hitRate,
        commissionErrorRate,
        omissionRate,
        meanRtMs: average(hitRts),
        dPrime: signalDetection.dPrime,
        criterion: signalDetection.criterion,
        signalDetection,
        feedbackProfile: feedback.profile,
        recommendation: feedback.recommendation,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    };
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
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
            plannedType: trial.plannedType,
            type: trial.type,
            stimulus: trial.stimulus,
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
            meanRt: `${summary.meanRtMs}ms`
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
    document.getElementById('feedback-text').textContent = `${summary.feedbackProfile}。${summary.recommendation}`;

    saveTrainingSession(new Date());

    gameDisplay.style.display = 'none';
    resultModal.style.display = 'flex';
}
