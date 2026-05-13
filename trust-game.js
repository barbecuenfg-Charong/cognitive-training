const TOTAL_ROUNDS = 20;
const ENDOWMENT = 10;
const CONTENT_VERSION = "trust-game-v2-seeded-trials";

let round = 0;
let totalEarnings = 0;
let totalInvest = 0;
let totalReturned = 0;
let returnRateState = 0.42;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionRng = Math.random;
let trials = [];
let roundStartedAtMs = 0;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("tg-panel");
const resultModal = document.getElementById("result-modal");
const investInput = document.getElementById("invest-input");
const investValue = document.getElementById("invest-value");
const feedback = document.getElementById("feedback");
const logEl = document.getElementById("log");

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function hashString(value) {
    const text = String(value || "");
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function mulberry32(seed) {
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
    if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === "function") {
        return window.SeededRandom.createSessionSeed("trust-game");
    }
    return `trust-game-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return mulberry32(hashString(seed));
}

function average(values) {
    if (!values.length) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(count, total) {
    return total === 0 ? 0 : Math.round((count / total) * 100);
}

function nextReturnRate(invest) {
    const trustDrift = invest >= 6 ? 0.04 : -0.02;
    const noise = (sessionRng() - 0.5) * 0.16;
    returnRateState = clamp(returnRateState + trustDrift + noise, 0.15, 0.75);
    return returnRateState;
}

function updateBoard() {
    const avgInvest = round === 0 ? 0 : (totalInvest / round).toFixed(1);
    document.getElementById("round").textContent = String(round);
    document.getElementById("total").textContent = String(totalEarnings);
    document.getElementById("avg-invest").textContent = String(avgInvest);
}

function appendLog(text) {
    const p = document.createElement("p");
    p.textContent = text;
    logEl.prepend(p);
}

function playRound() {
    if (round >= TOTAL_ROUNDS) {
        return;
    }

    const invest = Number(investInput.value);
    const multiplied = invest * 3;
    const previousReturnRate = returnRateState;
    const rtMs = roundStartedAtMs ? Math.max(0, Date.now() - roundStartedAtMs) : null;
    const rate = nextReturnRate(invest);
    const returned = Math.round(multiplied * rate);
    const gain = (ENDOWMENT - invest) + returned;

    round += 1;
    totalInvest += invest;
    totalReturned += returned;
    totalEarnings += gain;
    trials.push({
        index: trials.length,
        round,
        role: "investor",
        choice: invest,
        invest,
        endowment: ENDOWMENT,
        multiplied,
        opponentStrategy: "adaptive-reciprocal-noisy",
        previousReturnRate: Number(previousReturnRate.toFixed(3)),
        returnRate: Number(rate.toFixed(3)),
        returned,
        returnAmount: returned,
        return: returned,
        payoff: gain,
        totalEarningsAfter: totalEarnings,
        rtMs
    });

    feedback.textContent = `投入 ${invest}，对方返还 ${returned}，本轮收益 ${gain}`;
    appendLog(`第 ${round} 回合：投入 ${invest} -> 变为 ${multiplied} -> 返还 ${returned}，收益 ${gain}`);
    updateBoard();

    if (round >= TOTAL_ROUNDS) {
        finish();
        return;
    }
    roundStartedAtMs = Date.now();
}

function buildTrustSummary() {
    const avgInvest = Number((totalInvest / TOTAL_ROUNDS).toFixed(1));
    const returnRate = totalInvest === 0
        ? 0
        : Math.round((totalReturned / (totalInvest * 3)) * 100);
    const split = Math.floor(trials.length / 2);
    const firstHalf = trials.slice(0, split);
    const secondHalf = trials.slice(split);
    const firstHalfAvgInvest = Number(average(firstHalf.map((trial) => trial.invest)).toFixed(2));
    const secondHalfAvgInvest = Number(average(secondHalf.map((trial) => trial.invest)).toFixed(2));
    const afterHighReturn = [];
    const afterLowReturn = [];
    let recoveryCount = 0;
    let recoveryOpportunities = 0;

    for (let i = 1; i < trials.length; i += 1) {
        const previous = trials[i - 1];
        const current = trials[i];
        if (previous.returnRate >= 0.5) {
            afterHighReturn.push(current.invest);
        }
        if (previous.returnRate <= 0.34) {
            afterLowReturn.push(current.invest);
            recoveryOpportunities += 1;
            if (current.invest >= previous.invest) {
                recoveryCount += 1;
            }
        }
    }

    const trustThresholdInvestment = trials
        .filter((trial) => trial.invest > 0 && trial.returned >= trial.invest)
        .reduce((min, trial) => Math.min(min, trial.invest), Infinity);
    const reciprocitySensitivity = afterHighReturn.length > 0 && afterLowReturn.length > 0
        ? Number((average(afterHighReturn) - average(afterLowReturn)).toFixed(2))
        : null;
    const strategyAdaptationIndex = Number((secondHalfAvgInvest - firstHalfAvgInvest).toFixed(2));

    return {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        rounds: TOTAL_ROUNDS,
        totalEarnings,
        avgInvestment: avgInvest,
        averageReturnRate: returnRate,
        highTrustThreshold: 6,
        breakEvenReturnRateThreshold: 0.34,
        trustThresholdInvestment: trustThresholdInvestment === Infinity ? null : trustThresholdInvestment,
        highInvestmentRate: percentage(trials.filter((trial) => trial.invest >= 6).length, trials.length),
        firstHalfAvgInvest,
        secondHalfAvgInvest,
        trustTrend: strategyAdaptationIndex,
        reciprocitySensitivity,
        betrayalRecoveryRate: percentage(recoveryCount, recoveryOpportunities),
        strategyAdaptationIndex,
        opponentStrategy: "adaptive-reciprocal-noisy",
        nextStrategySuggestion: avgInvest >= 7 && returnRate < 35
            ? "calibrate-down-after-low-return"
            : "keep-gradual-investment-adjustment"
    };
}

function finish() {
    const avgInvest = (totalInvest / TOTAL_ROUNDS).toFixed(1);
    const returnRate = totalInvest === 0
        ? 0
        : Math.round((totalReturned / (totalInvest * 3)) * 100);
    const summary = buildTrustSummary();

    document.getElementById("result-total").textContent = String(totalEarnings);
    document.getElementById("result-invest").textContent = String(avgInvest);
    document.getElementById("result-return-rate").textContent = `${returnRate}%`;

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            gameId: "trust-game",
            gameName: "信任博弈",
            startedAt: sessionStartedAt || new Date(),
            finishedAt: new Date(),
            score: totalEarnings,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: trials.map((trial) => ({ ...trial })),
            metrics: {
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                rounds: TOTAL_ROUNDS,
                totalEarnings,
                avgInvestment: Number(avgInvest),
                averageReturnRate: returnRate,
                highTrustThreshold: summary.highTrustThreshold,
                breakEvenReturnRateThreshold: summary.breakEvenReturnRateThreshold,
                trustThresholdInvestment: summary.trustThresholdInvestment,
                highInvestmentRate: summary.highInvestmentRate,
                reciprocitySensitivity: summary.reciprocitySensitivity,
                betrayalRecoveryRate: summary.betrayalRecoveryRate,
                strategyAdaptationIndex: summary.strategyAdaptationIndex,
                opponentStrategy: summary.opponentStrategy
            }
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    round = 0;
    totalEarnings = 0;
    totalInvest = 0;
    totalReturned = 0;
    returnRateState = 0.42;
    sessionStartedAt = new Date();
    sessionSeed = createSessionSeed();
    sessionRng = createRng(sessionSeed);
    trials = [];
    roundStartedAtMs = Date.now();

    logEl.innerHTML = "";
    feedback.textContent = "调整滑杆后点击确认投入。";
    investInput.value = "5";
    investValue.textContent = "5";
    updateBoard();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

investInput.addEventListener("input", () => {
    investValue.textContent = investInput.value;
});
document.getElementById("invest-btn").addEventListener("click", playRound);

window.startGame = startGame;
