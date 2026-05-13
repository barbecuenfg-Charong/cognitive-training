const TOTAL_ROUNDS = 20;
const ENDOWMENT = 10;
const CONTENT_VERSION = "trust-game-v3-strategy-depth";
const OPPONENT_STRATEGY_VERSION = "adaptive-reciprocal-noisy-v2-recovery";
const LOW_RETURN_THRESHOLD = 0.34;
const HIGH_RETURN_THRESHOLD = 0.5;

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
    const usable = values.filter((value) => Number.isFinite(value));
    if (!usable.length) {
        return 0;
    }
    return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function percentage(count, total) {
    return total === 0 ? 0 : Math.round((count / total) * 100);
}

function roundTo2(value) {
    return Number(value.toFixed(2));
}

function nullableRoundTo2(value) {
    return value === null ? null : roundTo2(value);
}

function phaseForRound(roundNo) {
    return roundNo <= TOTAL_ROUNDS / 2 ? "early" : "late";
}

function standardDeviation(values) {
    const usable = values.filter((value) => Number.isFinite(value));
    if (usable.length <= 1) {
        return 0;
    }
    const mean = average(usable);
    const variance = average(usable.map((value) => (value - mean) ** 2));
    return Math.sqrt(variance);
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
    const previousInvest = trials.length ? trials[trials.length - 1].invest : null;
    const rtMs = roundStartedAtMs ? Math.max(0, Date.now() - roundStartedAtMs) : null;
    const rate = nextReturnRate(invest);
    const returned = Math.round(multiplied * rate);
    const gain = (ENDOWMENT - invest) + returned;

    round += 1;
    totalInvest += invest;
    totalReturned += returned;
    totalEarnings += gain;
    const lowReturnEvent = rate <= LOW_RETURN_THRESHOLD;
    trials.push({
        index: trials.length,
        round,
        phase: phaseForRound(round),
        role: "investor",
        choice: invest,
        invest,
        endowment: ENDOWMENT,
        multiplied,
        opponentStrategy: "adaptive-reciprocal-noisy",
        opponentStrategyVersion: OPPONENT_STRATEGY_VERSION,
        previousReturnRate: Number(previousReturnRate.toFixed(3)),
        returnRate: Number(rate.toFixed(3)),
        lowReturnEvent,
        betrayalEvent: lowReturnEvent,
        investmentDeltaFromPrevious: previousInvest === null ? null : invest - previousInvest,
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

function buildInvestmentVolatility() {
    const investments = trials.map((trial) => trial.invest);
    const deltas = [];
    let directionChanges = 0;
    let previousDirection = 0;

    for (let i = 1; i < trials.length; i += 1) {
        const delta = trials[i].invest - trials[i - 1].invest;
        deltas.push(delta);
        const direction = Math.sign(delta);
        if (direction !== 0 && previousDirection !== 0 && direction !== previousDirection) {
            directionChanges += 1;
        }
        if (direction !== 0) {
            previousDirection = direction;
        }
    }

    const meanInvest = average(investments);
    return {
        standardDeviation: roundTo2(standardDeviation(investments)),
        meanAbsoluteDelta: roundTo2(average(deltas.map((delta) => Math.abs(delta)))),
        maxSwing: deltas.length ? Math.max(...deltas.map((delta) => Math.abs(delta))) : 0,
        directionChanges,
        coefficientOfVariation: meanInvest === 0 ? 0 : roundTo2(standardDeviation(investments) / meanInvest)
    };
}

function buildRecoveryCurve() {
    const lowReturnIndexes = trials
        .map((trial, index) => ({ trial, index }))
        .filter((item) => item.trial.returnRate <= LOW_RETURN_THRESHOLD)
        .map((item) => item.index);

    return [1, 2, 3].map((lag) => {
        const changes = [];
        let recoveredCount = 0;
        let opportunities = 0;

        lowReturnIndexes.forEach((index) => {
            const followUp = trials[index + lag];
            if (!followUp) {
                return;
            }
            const eventTrial = trials[index];
            const preEventInvestment = index > 0 ? trials[index - 1].invest : eventTrial.invest;
            opportunities += 1;
            changes.push(followUp.invest - eventTrial.invest);
            if (followUp.invest >= preEventInvestment) {
                recoveredCount += 1;
            }
        });

        return {
            lag,
            opportunities,
            avgInvestmentChangeFromLowReturn: nullableRoundTo2(changes.length ? average(changes) : null),
            recoveryRate: percentage(recoveredCount, opportunities)
        };
    });
}

function buildReciprocityProfile(list) {
    const afterHighReturn = [];
    const afterLowReturn = [];

    for (let i = 1; i < list.length; i += 1) {
        const previous = list[i - 1];
        const current = list[i];
        if (previous.returnRate >= HIGH_RETURN_THRESHOLD) {
            afterHighReturn.push(current.invest);
        }
        if (previous.returnRate <= LOW_RETURN_THRESHOLD) {
            afterLowReturn.push(current.invest);
        }
    }

    const sensitivity = afterHighReturn.length > 0 && afterLowReturn.length > 0
        ? average(afterHighReturn) - average(afterLowReturn)
        : null;
    return {
        afterHighReturnAvgInvest: nullableRoundTo2(afterHighReturn.length ? average(afterHighReturn) : null),
        afterLowReturnAvgInvest: nullableRoundTo2(afterLowReturn.length ? average(afterLowReturn) : null),
        sensitivity: nullableRoundTo2(sensitivity),
        highReturnOpportunities: afterHighReturn.length,
        lowReturnOpportunities: afterLowReturn.length
    };
}

function buildNextTrustPractice(summary) {
    if (summary.investmentVolatility.meanAbsoluteDelta >= 3) {
        return {
            focus: "stabilize-investment-updates",
            rule: "下一轮每次投入变化限制在 2 点以内，先观察返还率连续两轮趋势再大幅调整。",
            startingInvestment: Math.max(2, Math.round(summary.avgInvestment)),
            feedback: "练习目标是降低投入波动，让调整更多来自返还证据。"
        };
    }
    if (summary.lowReturnEventCount > 0 && summary.betrayalRecoveryRate < 50) {
        return {
            focus: "graded-recovery-after-low-return",
            rule: "下一轮遇到低返还后，先降 1-2 点投入，再用两轮返还证据决定是否恢复。",
            startingInvestment: Math.max(2, Math.round(summary.firstHalfAvgInvest)),
            feedback: "练习目标是把低返还后的恢复拆成小步验证。"
        };
    }
    if (summary.reciprocityPhaseChange.sensitivityDelta !== null
            && Math.abs(summary.reciprocityPhaseChange.sensitivityDelta) >= 2) {
        return {
            focus: "phase-reciprocity-calibration",
            rule: "下一轮前 10 轮保持探索，后 10 轮只根据最近两轮返还率微调投入。",
            startingInvestment: Math.max(2, Math.round(summary.secondHalfAvgInvest)),
            feedback: "练习目标是比较早期探索和后期互惠调整的差异。"
        };
    }
    return {
        focus: "reciprocal-baseline-practice",
        rule: "下一轮以 5 点为基线，返还率高于 50% 加 1 点，低于 34% 减 1 点。",
        startingInvestment: 5,
        feedback: "练习目标是把互惠敏感性固定成可复盘的简单规则。"
    };
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
        if (previous.returnRate >= HIGH_RETURN_THRESHOLD) {
            afterHighReturn.push(current.invest);
        }
        if (previous.returnRate <= LOW_RETURN_THRESHOLD) {
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
    const earlyReciprocity = buildReciprocityProfile(firstHalf);
    const lateReciprocity = buildReciprocityProfile(secondHalf);
    const sensitivityDelta = earlyReciprocity.sensitivity === null || lateReciprocity.sensitivity === null
        ? null
        : roundTo2(lateReciprocity.sensitivity - earlyReciprocity.sensitivity);

    const summary = {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        rounds: TOTAL_ROUNDS,
        totalEarnings,
        avgInvestment: avgInvest,
        averageReturnRate: returnRate,
        highTrustThreshold: 6,
        breakEvenReturnRateThreshold: LOW_RETURN_THRESHOLD,
        trustThresholdInvestment: trustThresholdInvestment === Infinity ? null : trustThresholdInvestment,
        highInvestmentRate: percentage(trials.filter((trial) => trial.invest >= 6).length, trials.length),
        firstHalfAvgInvest,
        secondHalfAvgInvest,
        trustTrend: strategyAdaptationIndex,
        reciprocitySensitivity,
        betrayalRecoveryRate: percentage(recoveryCount, recoveryOpportunities),
        lowReturnEventCount: trials.filter((trial) => trial.lowReturnEvent).length,
        recoveryCurve: buildRecoveryCurve(),
        investmentVolatility: buildInvestmentVolatility(),
        reciprocityPhaseChange: {
            early: earlyReciprocity,
            late: lateReciprocity,
            sensitivityDelta
        },
        strategyAdaptationIndex,
        opponentStrategy: "adaptive-reciprocal-noisy",
        opponentStrategyVersion: OPPONENT_STRATEGY_VERSION,
        strategyBaseline: {
            highInvestmentThreshold: 6,
            lowReturnThreshold: LOW_RETURN_THRESHOLD,
            highReturnThreshold: HIGH_RETURN_THRESHOLD,
            opponentStrategyVersion: OPPONENT_STRATEGY_VERSION
        },
        nextStrategySuggestion: avgInvest >= 7 && returnRate < 35
            ? "calibrate-down-after-low-return"
            : "keep-gradual-investment-adjustment"
    };
    summary.nextTrustPractice = buildNextTrustPractice(summary);
    return summary;
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
                lowReturnEventCount: summary.lowReturnEventCount,
                recoveryCurve: summary.recoveryCurve,
                investmentVolatility: summary.investmentVolatility,
                reciprocityPhaseChange: summary.reciprocityPhaseChange,
                strategyAdaptationIndex: summary.strategyAdaptationIndex,
                opponentStrategy: summary.opponentStrategy,
                opponentStrategyVersion: summary.opponentStrategyVersion,
                strategyBaseline: summary.strategyBaseline,
                nextTrustPractice: summary.nextTrustPractice
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
