const MODULE_ID = "cpt";
const GAME_NAME = "持续表现任务 (CPT)";
const CONTENT_VERSION = "cpt-v2-seeded-commission-omission";

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

// Configuration
const TOTAL_DURATION = 120000; // 2 minutes
const STIMULUS_DURATION = 250; // 250ms display time
const ISI = 1500; // 1.5s interval between stimuli
const TARGET_PROB = 0.2; // 20% probability of X
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWYZ"; // Excludes X

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

function clearGameTimers() {
    clearTimeout(stimulusTimeout);
    clearTimeout(isiTimeout);
    clearTimeout(gameTimer);
}

function startGame() {
    clearGameTimers();

    // Reset state
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

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("cpt-display").style.display = "flex";
    document.getElementById("click-area").style.display = "block";
    document.getElementById("result-modal").style.display = "none";

    updateScore();

    // Start loop
    runTrial();

    // Game Timer
    gameTimer = setTimeout(endGame, TOTAL_DURATION);
}

function createCurrentTrial(stimulus) {
    const isTarget = stimulus === "X";

    return {
        index: trialLog.length,
        trialIndex: trialLog.length,
        stimulus,
        isTarget,
        correctResponse: isTarget ? "press" : "withhold",
        response: "none",
        responded: false,
        correct: null,
        rtMs: null,
        timedOut: false,
        classification: null,
        stimulusDurationMs: STIMULUS_DURATION,
        isiMs: ISI
    };
}

function runTrial() {
    if (!isGameActive) return;

    hasResponded = false;

    // Determine letter
    if (nextRandom() < TARGET_PROB) {
        currentLetter = "X";
    } else {
        currentLetter = LETTERS[Math.floor(nextRandom() * LETTERS.length)];
    }

    currentTrial = createCurrentTrial(currentLetter);

    // Show letter
    const display = document.getElementById("target-letter");
    display.textContent = currentLetter;
    display.style.visibility = "visible";

    trialStartTime = Date.now();

    // Hide letter after STIMULUS_DURATION
    stimulusTimeout = setTimeout(() => {
        if (!isGameActive) return;
        display.style.visibility = "hidden";

        // Wait ISI then next trial
        isiTimeout = setTimeout(() => {
            if (!isGameActive) return;

            completeCurrentTrial(true);
            runTrial();
        }, ISI);
    }, STIMULUS_DURATION);
}

function classifyTrial(trial) {
    if (trial.isTarget && trial.responded) return "hit";
    if (trial.isTarget && !trial.responded) return "miss";
    if (!trial.isTarget && trial.responded) return "falseAlarm";
    return "correctRejection";
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
    currentTrial.correct = currentTrial.classification === "hit";

    // Check correctness
    if (currentTrial.classification === "hit") {
        hits += 1;
        reactionTimes.push(rt);
        const display = document.getElementById("cpt-display");
        display.style.borderColor = "#2ecc71";
        setTimeout(() => {
            display.style.borderColor = "#ecf0f1";
        }, 200);
    } else {
        falseAlarms += 1;
        document.body.style.backgroundColor = "#ffdddd";
        setTimeout(() => {
            document.body.style.backgroundColor = "";
        }, 200);
    }

    updateScore();
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
        currentTrial.correct = currentTrial.classification === "correctRejection";

        if (currentTrial.classification === "miss") {
            misses += 1;
        } else {
            correctRejections += 1;
        }
    }

    trialLog.push({
        index: currentTrial.index,
        trialIndex: currentTrial.trialIndex,
        stimulus: currentTrial.stimulus,
        isTarget: currentTrial.isTarget,
        correctResponse: currentTrial.correctResponse,
        response: currentTrial.response,
        responded: currentTrial.responded,
        correct: currentTrial.correct,
        rtMs: currentTrial.rtMs,
        timedOut: currentTrial.timedOut,
        classification: currentTrial.classification,
        stimulusDurationMs: currentTrial.stimulusDurationMs,
        isiMs: currentTrial.isiMs
    });

    currentTrial = null;
    updateScore();
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

function getMeanRtMs() {
    return average(reactionTimes);
}

function updateScore() {
    document.getElementById("hits").textContent = hits;
    document.getElementById("false-alarms").textContent = falseAlarms;
    document.getElementById("avg-rt").textContent = getMeanRtMs();
}

function buildSummary() {
    const totalTrials = trialLog.length;
    const targetTrials = trialLog.filter((trial) => trial.isTarget).length;
    const nonTargetTrials = totalTrials - targetTrials;
    const hitCount = trialLog.filter((trial) => trial.classification === "hit").length;
    const missCount = trialLog.filter((trial) => trial.classification === "miss").length;
    const falseAlarmCount = trialLog.filter((trial) => trial.classification === "falseAlarm").length;
    const correctRejectionCount = trialLog.filter((trial) => trial.classification === "correctRejection").length;
    const correctCount = hitCount + correctRejectionCount;
    const hitRts = trialLog
        .filter((trial) => trial.classification === "hit")
        .map((trial) => trial.rtMs);
    const hitRate = targetTrials > 0 ? hitCount / targetTrials : 0;
    const falseAlarmRate = nonTargetTrials > 0 ? falseAlarmCount / nonTargetTrials : 0;
    const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
    const meanRtMs = average(hitRts);
    const rtStdDevMs = standardDeviation(hitRts);

    return {
        totalTrials,
        targetTrials,
        nonTargetTrials,
        hitCount,
        missCount,
        falseAlarmCount,
        correctRejectionCount,
        correctCount,
        hitRate,
        missRate: targetTrials > 0 ? missCount / targetTrials : 0,
        falseAlarmRate,
        correctRejectionRate: nonTargetTrials > 0 ? correctRejectionCount / nonTargetTrials : 0,
        accuracy,
        meanRtMs,
        rtStdDevMs,
        stimulusDurationMs: STIMULUS_DURATION,
        isiMs: ISI,
        targetProbability: TARGET_PROB,
        sessionSeed,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    };
}

function buildScore(summary) {
    if (summary.targetTrials === 0 && summary.nonTargetTrials === 0) return 0;
    if (summary.targetTrials === 0) return Math.round((1 - summary.falseAlarmRate) * 100);
    if (summary.nonTargetTrials === 0) return Math.round(summary.hitRate * 100);
    return Math.round(((summary.hitRate + (1 - summary.falseAlarmRate)) / 2) * 100);
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function formatDurationMs(durationMs) {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function buildTrainingFeedback(summary) {
    const missText = `注意遗漏（miss）${summary.missCount}/${summary.targetTrials}，命中率 ${formatPercent(summary.hitRate)}`;
    const impulseText = `冲动误按（false alarm）${summary.falseAlarmCount}/${summary.nonTargetTrials}，误报率 ${formatPercent(summary.falseAlarmRate)}`;

    let advice = "下一轮建议：保持当前节奏，继续把反应集中在 X 上。";
    if (summary.missRate >= 0.25 && summary.falseAlarmRate >= 0.1) {
        advice = "下一轮建议：先放慢抢按冲动，盯住中央刺激；确认是 X 再按，非 X 保持抑制。";
    } else if (summary.missRate >= 0.25) {
        advice = "下一轮建议：重点训练警觉性，保持视线停在中央，看到 X 后立即响应，减少目标遗漏。";
    } else if (summary.falseAlarmRate >= 0.1 || summary.falseAlarmCount >= 5) {
        advice = "下一轮建议：重点训练冲动控制，非 X 出现时刻意暂停，确认目标后再按。";
    } else if (summary.rtStdDevMs > 350) {
        advice = "下一轮建议：反应速度波动偏大，尝试稳定呼吸和注视点，让每次命中反应更均匀。";
    }

    return `${missText}；${impulseText}。${advice}`;
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
            falseAlarmRate: formatPercent(summary.falseAlarmRate),
            meanRT: `${summary.meanRtMs}ms`,
            rtStdDev: `${summary.rtStdDevMs}ms`,
            misses: summary.missCount,
            falseAlarms: summary.falseAlarmCount,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        },
        tags: ["attention", "cpt", "sustained-attention", "vigilance", "impulse-control"]
    });

    hasSavedSession = true;
}

function endGame() {
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

    document.getElementById("total-time").textContent = formatDurationMs(durationMs);
    document.getElementById("result-hits").textContent = hits;
    document.getElementById("result-misses").textContent = misses;
    document.getElementById("result-fa").textContent = falseAlarms;
    document.getElementById("result-cr").textContent = correctRejections;
    document.getElementById("result-rates").textContent = `${formatPercent(summary.hitRate)} / ${formatPercent(summary.falseAlarmRate)}`;
    document.getElementById("result-rt").textContent = `${summary.meanRtMs} ms`;
    document.getElementById("feedback-text").textContent = buildTrainingFeedback(summary);

    saveTrainingSession(finishedAt);
}

// Event Listeners
document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && isGameActive) {
        e.preventDefault(); // Prevent scrolling
        handleResponse();
    }
});

document.getElementById("click-area").addEventListener("mousedown", (e) => {
    if (isGameActive) {
        e.preventDefault();
        handleResponse();
    }
});

// Prevent space scrolling globally
window.addEventListener("keydown", (e) => {
    if (e.keyCode === 32 && e.target === document.body) {
        e.preventDefault();
    }
});

window.startGame = startGame;
