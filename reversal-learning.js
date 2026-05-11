const MODULE_ID = "reversal-learning";
const GAME_NAME = "反转学习任务";
const CONTENT_VERSION = "reversal-learning-seeded-schedule-v1";
const TOTAL_TRIALS = 40;
const REVERSAL_POINT = 20;
const REWARD_POINTS = 10;
const ADAPTATION_STREAK = 3;
const REWARD_SCHEDULE = Object.freeze({
    preReversal: Object.freeze({
        phase: "pre-reversal",
        startTrialIndex: 0,
        endTrialIndex: REVERSAL_POINT - 1,
        optimalChoice: "A",
        probabilities: Object.freeze({ A: 0.8, B: 0.2 })
    }),
    postReversal: Object.freeze({
        phase: "post-reversal",
        startTrialIndex: REVERSAL_POINT,
        endTrialIndex: TOTAL_TRIALS - 1,
        optimalChoice: "B",
        probabilities: Object.freeze({ A: 0.2, B: 0.8 })
    })
});

let trial = 0;
let reward = 0;
let optimalChoices = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let rewardRng = null;
let trialLog = [];
let trialStartedAtMs = 0;
let sessionSaved = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("rl-panel");
const resultModal = document.getElementById("result-modal");
const feedback = document.getElementById("feedback");
const phaseHint = document.getElementById("phase-hint");
const resultAdaptation = document.getElementById("result-adaptation");
const resultStrategy = document.getElementById("result-strategy");
const resultAdvice = document.getElementById("result-advice");

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

function nowMs() {
    return window.performance && typeof window.performance.now === "function"
        ? window.performance.now()
        : Date.now();
}

function phaseForTrial(trialIndex) {
    return trialIndex < REVERSAL_POINT ? REWARD_SCHEDULE.preReversal : REWARD_SCHEDULE.postReversal;
}

function rewardProbability(choice, trialIndex = trial) {
    return phaseForTrial(trialIndex).probabilities[choice] || 0;
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function roundMetric(value, digits = 3) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function ratio(count, total) {
    return total === 0 ? 0 : roundMetric(count / total);
}

function cloneRewardSchedule() {
    return {
        reversalPoint: REVERSAL_POINT,
        rewardPoints: REWARD_POINTS,
        preReversal: {
            startTrialIndex: REWARD_SCHEDULE.preReversal.startTrialIndex,
            endTrialIndex: REWARD_SCHEDULE.preReversal.endTrialIndex,
            optimalChoice: REWARD_SCHEDULE.preReversal.optimalChoice,
            probabilities: { ...REWARD_SCHEDULE.preReversal.probabilities }
        },
        postReversal: {
            startTrialIndex: REWARD_SCHEDULE.postReversal.startTrialIndex,
            endTrialIndex: REWARD_SCHEDULE.postReversal.endTrialIndex,
            optimalChoice: REWARD_SCHEDULE.postReversal.optimalChoice,
            probabilities: { ...REWARD_SCHEDULE.postReversal.probabilities }
        }
    };
}

function updateBoard() {
    const optimalRate = trial === 0 ? 0 : Math.round((optimalChoices / trial) * 100);
    document.getElementById("trial").textContent = String(trial);
    document.getElementById("reward").textContent = String(reward);
    document.getElementById("optimal-rate").textContent = `${optimalRate}%`;
    phaseHint.textContent = trial < REVERSAL_POINT ? "阶段：学习阶段" : "阶段：反转阶段";
}

function buildTrialRecord(option) {
    const trialIndex = trial;
    const phaseInfo = phaseForTrial(trialIndex);
    const optimalChoice = phaseInfo.optimalChoice;
    const probability = rewardProbability(option, trialIndex);
    const previousTrial = trialLog[trialLog.length - 1] || null;
    const previousChoice = previousTrial ? previousTrial.choice : null;
    const draw = rewardRng ? rewardRng() : Math.random();
    const rewarded = draw < probability;

    return {
        trialIndex,
        phase: phaseInfo.phase,
        choice: option,
        optimalChoice,
        rewardProbability: probability,
        rewarded,
        gain: rewarded ? REWARD_POINTS : 0,
        previousChoice,
        winStay: previousTrial ? previousTrial.rewarded && option === previousTrial.choice : null,
        loseShift: previousTrial ? !previousTrial.rewarded && option !== previousTrial.choice : null,
        perseverativeAfterReversal: trialIndex >= REVERSAL_POINT
            && option === REWARD_SCHEDULE.preReversal.optimalChoice,
        rtMs: Math.max(0, Math.round(nowMs() - trialStartedAtMs))
    };
}

function choose(option) {
    if (trial >= TOTAL_TRIALS) {
        return;
    }

    const record = buildTrialRecord(option);
    trialLog.push(record);

    if (record.choice === record.optimalChoice) {
        optimalChoices += 1;
    }

    reward += record.gain;
    trial += 1;

    feedback.textContent = `你选择 ${option}，${record.rewarded ? `获得 +${REWARD_POINTS}` : "未获得奖励"}`;
    if (trial === REVERSAL_POINT) {
        feedback.textContent += "。环境规则已变化";
    }

    updateBoard();
    if (trial >= TOTAL_TRIALS) {
        finish();
        return;
    }
    trialStartedAtMs = nowMs();
}

function accuracyForPhase(phase) {
    const phaseTrials = trialLog.filter((item) => item.phase === phase);
    const correct = phaseTrials.filter((item) => item.choice === item.optimalChoice).length;
    return ratio(correct, phaseTrials.length);
}

function calculateAdaptationTrials() {
    const postTrials = trialLog.filter((item) => item.trialIndex >= REVERSAL_POINT);
    let streak = 0;
    for (let i = 0; i < postTrials.length; i += 1) {
        if (postTrials[i].choice === postTrials[i].optimalChoice) {
            streak += 1;
            if (streak >= ADAPTATION_STREAK) {
                return i + 1;
            }
        } else {
            streak = 0;
        }
    }
    return null;
}

function calculateTransitionRates() {
    let previousRewarded = 0;
    let winStayCount = 0;
    let previousUnrewarded = 0;
    let loseShiftCount = 0;

    for (let i = 1; i < trialLog.length; i += 1) {
        const previousTrial = trialLog[i - 1];
        const currentTrial = trialLog[i];
        if (previousTrial.rewarded) {
            previousRewarded += 1;
            if (currentTrial.choice === previousTrial.choice) {
                winStayCount += 1;
            }
        } else {
            previousUnrewarded += 1;
            if (currentTrial.choice !== previousTrial.choice) {
                loseShiftCount += 1;
            }
        }
    }

    return {
        winStayRate: ratio(winStayCount, previousRewarded),
        loseShiftRate: ratio(loseShiftCount, previousUnrewarded)
    };
}

function buildSummary() {
    const preReversalAccuracy = accuracyForPhase(REWARD_SCHEDULE.preReversal.phase);
    const postReversalAccuracy = accuracyForPhase(REWARD_SCHEDULE.postReversal.phase);
    const postTrials = trialLog.filter((item) => item.trialIndex >= REVERSAL_POINT);
    const perseverativeCount = postTrials.filter((item) => item.perseverativeAfterReversal).length;
    const transitionRates = calculateTransitionRates();

    return {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        totalTrials: TOTAL_TRIALS,
        completedTrials: trialLog.length,
        reversalPoint: REVERSAL_POINT,
        rewardSchedule: cloneRewardSchedule(),
        totalReward: reward,
        preReversalAccuracy,
        postReversalAccuracy,
        adaptationTrials: calculateAdaptationTrials(),
        adaptationCriterion: `first_${ADAPTATION_STREAK}_consecutive_post_reversal_optimal`,
        winStayRate: transitionRates.winStayRate,
        loseShiftRate: transitionRates.loseShiftRate,
        perseverationRate: ratio(perseverativeCount, postTrials.length)
    };
}

function strategyLabel(summary) {
    if (summary.perseverationRate >= 0.5) {
        return "旧规则坚持";
    }
    if (summary.winStayRate >= 0.65 && summary.loseShiftRate >= 0.5) {
        return "反馈驱动切换";
    }
    if (summary.winStayRate >= 0.65 && summary.loseShiftRate < 0.35) {
        return "赢后稳定，输后保守";
    }
    if (summary.winStayRate < 0.4 && summary.loseShiftRate > 0.6) {
        return "频繁探索";
    }
    return "混合探索";
}

function buildResultFeedback(summary) {
    const adaptationText = summary.adaptationTrials === null
        ? `反转后未达到连续 ${ADAPTATION_STREAK} 次选择新高收益选项，适应速度偏慢。`
        : `反转后用 ${summary.adaptationTrials} 个试次达到连续 ${ADAPTATION_STREAK} 次新高收益选择。`;
    const strategyText = `策略倾向：${strategyLabel(summary)}；赢后保持率 ${formatPercent(summary.winStayRate)}，输后转换率 ${formatPercent(summary.loseShiftRate)}，反转后旧规则坚持率 ${formatPercent(summary.perseverationRate)}。`;
    return `${adaptationText}${strategyText}`;
}

function saveTrainingSession(finishedAt, summary) {
    if (sessionSaved || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") {
        return;
    }

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

    window.TrainingResults.saveSession({
        moduleId: MODULE_ID,
        gameId: MODULE_ID,
        gameName: GAME_NAME,
        startedAt,
        finishedAt,
        durationMs,
        score: reward,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        summary,
        trials: trialLog.map((item) => ({ ...item })),
        metrics: {
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            totalReward: summary.totalReward,
            preReversalAccuracy: summary.preReversalAccuracy,
            postReversalAccuracy: summary.postReversalAccuracy,
            adaptationTrials: summary.adaptationTrials,
            winStayRate: summary.winStayRate,
            loseShiftRate: summary.loseShiftRate,
            perseverationRate: summary.perseverationRate,
            reversalPoint: summary.reversalPoint
        },
        tags: ["executive-function", "reversal-learning", "adaptive-control"]
    });
    sessionSaved = true;
}

function finish() {
    const finishedAt = new Date();
    const summary = buildSummary();

    document.getElementById("result-reward").textContent = String(summary.totalReward);
    document.getElementById("result-pre").textContent = formatPercent(summary.preReversalAccuracy);
    document.getElementById("result-post").textContent = formatPercent(summary.postReversalAccuracy);
    resultAdaptation.textContent = summary.adaptationTrials === null
        ? "未达成稳定适应"
        : `${summary.adaptationTrials} 试次`;
    resultStrategy.textContent = strategyLabel(summary);
    resultAdvice.textContent = buildResultFeedback(summary);

    saveTrainingSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    trial = 0;
    reward = 0;
    optimalChoices = 0;
    sessionStartedAt = new Date();
    sessionSeed = createSessionSeed();
    rewardRng = createRng(`${sessionSeed}:${CONTENT_VERSION}:reward-outcomes`);
    trialLog = [];
    trialStartedAtMs = nowMs();
    sessionSaved = false;

    feedback.textContent = "请选择 A 或 B。";
    updateBoard();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

document.getElementById("choose-a").addEventListener("click", () => choose("A"));
document.getElementById("choose-b").addEventListener("click", () => choose("B"));

window.startGame = startGame;
