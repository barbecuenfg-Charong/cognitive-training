const TOTAL_ROUNDS = 20;
const CONTENT_VERSION = "prisoner-dilemma-v3-strategy-depth";
const OPPONENT_STRATEGY_VERSION = "tit-for-tat-noise-v2-phase-metrics";
const INITIAL_COOPERATION_PROBABILITY = 0.7;
const OPPONENT_NOISE_RATE = 0.15;

let round = 0;
let myScore = 0;
let opponentScore = 0;
let cooperateCount = 0;
let myLastChoice = "C";
let sessionStartedAt = null;
let sessionSeed = "";
let sessionRng = Math.random;
let trials = [];
let roundStartedAtMs = 0;

const PAYOFF = {
    CC: [3, 3],
    CD: [0, 5],
    DC: [5, 0],
    DD: [1, 1]
};

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("pd-panel");
const resultModal = document.getElementById("result-modal");
const logEl = document.getElementById("log");
const lastRow = document.getElementById("last-row");

function updateBoard() {
    document.getElementById("round").textContent = String(round);
    document.getElementById("my-score").textContent = String(myScore);
    document.getElementById("op-score").textContent = String(opponentScore);
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
        return window.SeededRandom.createSessionSeed("prisoner-dilemma");
    }
    return `prisoner-dilemma-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return mulberry32(hashString(seed));
}

function percentage(count, total) {
    return total === 0 ? 0 : Math.round((count / total) * 100);
}

function phaseForRound(roundNo) {
    return roundNo <= TOTAL_ROUNDS / 2 ? "early" : "late";
}

function choiceLabel(choice) {
    return choice === "C" ? "合作" : "背叛";
}

function opponentChoice() {
    if (round === 0) {
        return {
            choice: sessionRng() < INITIAL_COOPERATION_PROBABILITY ? "C" : "D",
            opponentStrategy: "initial-cooperation-biased",
            opponentStrategyVersion: OPPONENT_STRATEGY_VERSION,
            usedNoise: false
        };
    }
    // Tit-for-tat + small noise, prevents trivial exploitation.
    if (sessionRng() < OPPONENT_NOISE_RATE) {
        return {
            choice: sessionRng() < 0.5 ? "C" : "D",
            opponentStrategy: "tit-for-tat-noise",
            opponentStrategyVersion: OPPONENT_STRATEGY_VERSION,
            usedNoise: true
        };
    }
    return {
        choice: myLastChoice,
        opponentStrategy: "tit-for-tat",
        opponentStrategyVersion: OPPONENT_STRATEGY_VERSION,
        usedNoise: false
    };
}

function appendLog(text) {
    const p = document.createElement("p");
    p.textContent = text;
    logEl.prepend(p);
}

function updateLastRow(myChoice, opChoice, myGain, opGain) {
    lastRow.innerHTML = `<tr><td>${choiceLabel(myChoice)}</td><td>${choiceLabel(opChoice)}</td><td>${myGain}</td><td>${opGain}</td></tr>`;
}

function rateAfterPrevious(filterPrevious, chooseCurrent) {
    let opportunities = 0;
    let hits = 0;
    for (let i = 1; i < trials.length; i += 1) {
        if (filterPrevious(trials[i - 1])) {
            opportunities += 1;
            if (chooseCurrent(trials[i])) {
                hits += 1;
            }
        }
    }
    return percentage(hits, opportunities);
}

function rateAfterPreviousForRange(start, endExclusive, filterPrevious, chooseCurrent) {
    let opportunities = 0;
    let hits = 0;
    for (let i = Math.max(1, start); i < endExclusive; i += 1) {
        if (filterPrevious(trials[i - 1])) {
            opportunities += 1;
            if (chooseCurrent(trials[i])) {
                hits += 1;
            }
        }
    }
    return percentage(hits, opportunities);
}

function titForTatMatchRateFor(list) {
    if (list.length <= 1) {
        return 0;
    }
    let opportunities = 0;
    let hits = 0;
    for (let i = 1; i < list.length; i += 1) {
        opportunities += 1;
        if (list[i].myChoice === list[i - 1].opponentChoice) {
            hits += 1;
        }
    }
    return percentage(hits, opportunities);
}

function buildTitForTatTrajectory() {
    const windowSize = 5;
    const trajectory = [];
    for (let start = 0; start < trials.length; start += windowSize) {
        const windowTrials = trials.slice(start, start + windowSize);
        const opportunities = windowTrials.filter((trial) => trial.expectedTitForTatChoice !== null).length;
        const matches = windowTrials.filter((trial) => trial.titForTatMatch).length;
        const first = windowTrials[0];
        const last = windowTrials[windowTrials.length - 1];
        trajectory.push({
            startRound: first.round,
            endRound: last.round,
            matchRate: percentage(matches, opportunities),
            opportunities,
            matches
        });
    }
    return trajectory;
}

function buildEndGameEffect(lastFive) {
    const baseline = trials.slice(0, Math.max(0, trials.length - lastFive.length));
    const baselineCooperationRate = percentage(
        baseline.filter((trial) => trial.myChoice === "C").length,
        baseline.length
    );
    const endGameCooperationRate = percentage(
        lastFive.filter((trial) => trial.myChoice === "C").length,
        lastFive.length
    );

    return {
        baselineCooperationRate,
        endGameCooperationRate,
        cooperationRateDelta: endGameCooperationRate - baselineCooperationRate,
        endGameDefectionRate: percentage(lastFive.filter((trial) => trial.myChoice === "D").length, lastFive.length),
        rounds: lastFive.map((trial) => trial.round)
    };
}

function buildNextStrategyPractice(summary) {
    if (summary.titForTatMatchRate < 50) {
        return {
            focus: "track-previous-opponent-choice",
            rule: "下一轮每回合先标记对手上一轮选择，再决定是否匹配 tit-for-tat。",
            targetRounds: "1-10",
            feedback: "练习目标是提高对上一轮对手行为的跟踪稳定性。"
        };
    }
    if (summary.retaliationRate >= 70 && summary.forgivenessRate <= 30) {
        return {
            focus: "planned-forgiveness-probe",
            rule: "下一轮对手背叛后，至少安排 1 次合作试探，并观察下一轮是否恢复合作。",
            targetRounds: "after-opponent-defection",
            feedback: "练习目标是在报复反应之外加入可控的修复试探。"
        };
    }
    if (summary.endGameEffect.cooperationRateDelta <= -20) {
        return {
            focus: "end-game-cooperation-check",
            rule: "下一轮最后 5 回合保持既定策略，避免只因临近结束突然改变。",
            targetRounds: "16-20",
            feedback: "练习目标是分辨末轮效应和真实策略调整。"
        };
    }
    return {
        focus: "tit-for-tat-with-forgiveness",
        rule: "下一轮继续匹配对手上一轮选择，并预设一次合作修复窗口。",
        targetRounds: "full-session",
        feedback: "练习目标是同时记录匹配、报复和宽恕三个策略通道。"
    };
}

function buildSummary() {
    const coopRate = percentage(cooperateCount, TOTAL_ROUNDS);
    const avgPerRound = Number((myScore / TOTAL_ROUNDS).toFixed(2));
    const firstHalf = trials.slice(0, Math.floor(trials.length / 2));
    const secondHalf = trials.slice(Math.floor(trials.length / 2));
    const firstHalfTitForTatRate = titForTatMatchRateFor(firstHalf);
    const secondHalfTitForTatRate = titForTatMatchRateFor(secondHalf);
    const lastFive = trials.slice(-5);
    const firstHalfEnd = firstHalf.length;
    const retaliationPhaseChange = {
        earlyRate: rateAfterPreviousForRange(
            0,
            firstHalfEnd,
            (trial) => trial.opponentChoice === "D",
            (trial) => trial.myChoice === "D"
        ),
        lateRate: rateAfterPreviousForRange(
            firstHalfEnd,
            trials.length,
            (trial) => trial.opponentChoice === "D",
            (trial) => trial.myChoice === "D"
        )
    };
    retaliationPhaseChange.delta = retaliationPhaseChange.lateRate - retaliationPhaseChange.earlyRate;
    const forgivenessPhaseChange = {
        earlyRate: rateAfterPreviousForRange(
            0,
            firstHalfEnd,
            (trial) => trial.opponentChoice === "D",
            (trial) => trial.myChoice === "C"
        ),
        lateRate: rateAfterPreviousForRange(
            firstHalfEnd,
            trials.length,
            (trial) => trial.opponentChoice === "D",
            (trial) => trial.myChoice === "C"
        )
    };
    forgivenessPhaseChange.delta = forgivenessPhaseChange.lateRate - forgivenessPhaseChange.earlyRate;

    const summary = {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        rounds: TOTAL_ROUNDS,
        myScore,
        opponentScore,
        cooperationRate: coopRate,
        averagePerRound: avgPerRound,
        cooperationThreshold: 0.5,
        thresholdBasis: "previous-opponent-cooperation-rate",
        cooperationAfterOpponentCooperationRate: rateAfterPrevious(
            (trial) => trial.opponentChoice === "C",
            (trial) => trial.myChoice === "C"
        ),
        retaliationRate: rateAfterPrevious(
            (trial) => trial.opponentChoice === "D",
            (trial) => trial.myChoice === "D"
        ),
        forgivenessRate: rateAfterPrevious(
            (trial) => trial.opponentChoice === "D",
            (trial) => trial.myChoice === "C"
        ),
        forgivenessAfterOpponentDefectionRate: rateAfterPrevious(
            (trial) => trial.opponentChoice === "D",
            (trial) => trial.myChoice === "C"
        ),
        titForTatMatchRate: titForTatMatchRateFor(trials),
        titForTatTrajectory: buildTitForTatTrajectory(),
        firstHalfTitForTatRate,
        secondHalfTitForTatRate,
        strategyAdaptationIndex: secondHalfTitForTatRate - firstHalfTitForTatRate,
        retaliationPhaseChange,
        forgivenessPhaseChange,
        cooperationStability: rateAfterPrevious(
            (trial) => trial.myChoice === "C" && trial.opponentChoice === "C",
            (trial) => trial.myChoice === "C"
        ),
        endGameCooperationRate: percentage(lastFive.filter((trial) => trial.myChoice === "C").length, lastFive.length),
        endGameEffect: buildEndGameEffect(lastFive),
        opponentStrategy: "tit-for-tat-with-noise",
        opponentStrategyVersion: OPPONENT_STRATEGY_VERSION,
        strategyBaseline: {
            opponentStrategy: "tit-for-tat-with-noise",
            opponentStrategyVersion: OPPONENT_STRATEGY_VERSION,
            initialCooperationProbability: INITIAL_COOPERATION_PROBABILITY,
            opponentNoiseRate: OPPONENT_NOISE_RATE,
            matchingRule: "current-choice-compared-with-previous-opponent-choice"
        }
    };
    summary.nextStrategyPractice = buildNextStrategyPractice(summary);
    return summary;
}

function finish() {
    const coopRate = Math.round((cooperateCount / TOTAL_ROUNDS) * 100);
    const avgPerRound = Number((myScore / TOTAL_ROUNDS).toFixed(2));
    const summary = buildSummary();

    document.getElementById("result-my").textContent = String(myScore);
    document.getElementById("result-coop-rate").textContent = `${coopRate}%`;
    document.getElementById("result-avg").textContent = String(avgPerRound);

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            gameId: "prisoner-dilemma",
            gameName: "囚徒困境",
            startedAt: sessionStartedAt || new Date(),
            finishedAt: new Date(),
            score: myScore,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: trials.map((trial) => ({ ...trial })),
            metrics: {
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                rounds: TOTAL_ROUNDS,
                myScore,
                opponentScore,
                cooperationRate: coopRate,
                averagePerRound: avgPerRound,
                cooperationThreshold: summary.cooperationThreshold,
                cooperationAfterOpponentCooperationRate: summary.cooperationAfterOpponentCooperationRate,
                retaliationRate: summary.retaliationRate,
                forgivenessRate: summary.forgivenessRate,
                forgivenessAfterOpponentDefectionRate: summary.forgivenessAfterOpponentDefectionRate,
                titForTatMatchRate: summary.titForTatMatchRate,
                titForTatTrajectory: summary.titForTatTrajectory,
                strategyAdaptationIndex: summary.strategyAdaptationIndex,
                retaliationPhaseChange: summary.retaliationPhaseChange,
                forgivenessPhaseChange: summary.forgivenessPhaseChange,
                endGameCooperationRate: summary.endGameCooperationRate,
                endGameEffect: summary.endGameEffect,
                opponentStrategy: summary.opponentStrategy,
                opponentStrategyVersion: summary.opponentStrategyVersion,
                strategyBaseline: summary.strategyBaseline,
                nextStrategyPractice: summary.nextStrategyPractice
            }
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function playRound(myChoice) {
    if (round >= TOTAL_ROUNDS) {
        return;
    }
    const roundNo = round + 1;
    const previousOpponentChoice = trials.length ? trials[trials.length - 1].opponentChoice : null;
    const expectedTitForTatChoice = previousOpponentChoice;
    const titForTatMatch = expectedTitForTatChoice === null ? null : myChoice === expectedTitForTatChoice;
    const retaliationOpportunity = previousOpponentChoice === "D";
    const forgivenessOpportunity = previousOpponentChoice === "D";
    const opponent = opponentChoice();
    const opChoice = opponent.choice;
    const key = `${myChoice}${opChoice}`;
    const [myGain, opGain] = PAYOFF[key];
    const rtMs = roundStartedAtMs ? Math.max(0, Date.now() - roundStartedAtMs) : null;

    round += 1;
    myScore += myGain;
    opponentScore += opGain;
    if (myChoice === "C") {
        cooperateCount += 1;
    }
    myLastChoice = myChoice;
    trials.push({
        index: trials.length,
        round,
        phase: phaseForRound(roundNo),
        choice: myChoice,
        myChoice,
        opponentChoice: opChoice,
        opponentStrategy: opponent.opponentStrategy,
        opponentStrategyVersion: opponent.opponentStrategyVersion,
        usedOpponentNoise: opponent.usedNoise,
        expectedTitForTatChoice,
        titForTatMatch,
        retaliationOpportunity,
        retaliationChoice: retaliationOpportunity && myChoice === "D",
        forgivenessOpportunity,
        forgivenessChoice: forgivenessOpportunity && myChoice === "C",
        endGameRound: roundNo > TOTAL_ROUNDS - 5,
        payoff: myGain,
        opponentPayoff: opGain,
        return: myGain,
        cumulativeScore: myScore,
        opponentCumulativeScore: opponentScore,
        rtMs
    });

    updateLastRow(myChoice, opChoice, myGain, opGain);
    appendLog(`第 ${round} 回合：你${choiceLabel(myChoice)}，对手${choiceLabel(opChoice)}，得分 ${myGain}:${opGain}`);
    updateBoard();

    if (round >= TOTAL_ROUNDS) {
        finish();
        return;
    }
    roundStartedAtMs = Date.now();
}

function startGame() {
    round = 0;
    myScore = 0;
    opponentScore = 0;
    cooperateCount = 0;
    myLastChoice = "C";
    sessionStartedAt = new Date();
    sessionSeed = createSessionSeed();
    sessionRng = createRng(sessionSeed);
    trials = [];
    roundStartedAtMs = Date.now();

    logEl.innerHTML = "";
    lastRow.innerHTML = "<tr><td>--</td><td>--</td><td>--</td><td>--</td></tr>";
    updateBoard();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

document.getElementById("cooperate-btn").addEventListener("click", () => playRound("C"));
document.getElementById("defect-btn").addEventListener("click", () => playRound("D"));

document.addEventListener("keydown", (event) => {
    if (panel.style.display !== "block") {
        return;
    }
    const key = event.key.toLowerCase();
    if (key === "c") {
        playRound("C");
    } else if (key === "d") {
        playRound("D");
    }
});

window.startGame = startGame;
