const TOTAL_ROUNDS = 20;
const CONTENT_VERSION = "prisoner-dilemma-v2-seeded-trials";

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

function choiceLabel(choice) {
    return choice === "C" ? "合作" : "背叛";
}

function opponentChoice() {
    if (round === 0) {
        return {
            choice: sessionRng() < 0.7 ? "C" : "D",
            opponentStrategy: "initial-cooperation-biased",
            usedNoise: false
        };
    }
    // Tit-for-tat + small noise, prevents trivial exploitation.
    if (sessionRng() < 0.15) {
        return {
            choice: sessionRng() < 0.5 ? "C" : "D",
            opponentStrategy: "tit-for-tat-noise",
            usedNoise: true
        };
    }
    return {
        choice: myLastChoice,
        opponentStrategy: "tit-for-tat",
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

function buildSummary() {
    const coopRate = percentage(cooperateCount, TOTAL_ROUNDS);
    const avgPerRound = Number((myScore / TOTAL_ROUNDS).toFixed(2));
    const firstHalf = trials.slice(0, Math.floor(trials.length / 2));
    const secondHalf = trials.slice(Math.floor(trials.length / 2));
    const firstHalfTitForTatRate = titForTatMatchRateFor(firstHalf);
    const secondHalfTitForTatRate = titForTatMatchRateFor(secondHalf);
    const lastFive = trials.slice(-5);

    return {
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
        titForTatMatchRate: titForTatMatchRateFor(trials),
        firstHalfTitForTatRate,
        secondHalfTitForTatRate,
        strategyAdaptationIndex: secondHalfTitForTatRate - firstHalfTitForTatRate,
        cooperationStability: rateAfterPrevious(
            (trial) => trial.myChoice === "C" && trial.opponentChoice === "C",
            (trial) => trial.myChoice === "C"
        ),
        endGameCooperationRate: percentage(lastFive.filter((trial) => trial.myChoice === "C").length, lastFive.length),
        opponentStrategy: "tit-for-tat-with-noise"
    };
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
                titForTatMatchRate: summary.titForTatMatchRate,
                strategyAdaptationIndex: summary.strategyAdaptationIndex,
                endGameCooperationRate: summary.endGameCooperationRate,
                opponentStrategy: summary.opponentStrategy
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
        choice: myChoice,
        myChoice,
        opponentChoice: opChoice,
        opponentStrategy: opponent.opponentStrategy,
        usedOpponentNoise: opponent.usedNoise,
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
