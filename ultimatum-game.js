const TOTAL_ROUNDS = 20;
const TOTAL_PIE = 10;
const CONTENT_VERSION = "ultimatum-game-v2-seeded";

let offers = [];
let round = 0;
let earnings = 0;
let acceptedCount = 0;
let fairAccepted = 0;
let fairTotal = 0;
let unfairAccepted = 0;
let unfairTotal = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let decisions = [];
let trials = [];
let roundStartedAtMs = 0;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("ug-panel");
const resultModal = document.getElementById("result-modal");
const offerText = document.getElementById("offer-text");
const logEl = document.getElementById("log");

function shuffledOffers(rng) {
    const base = [1, 2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 2, 3, 4, 5, 1, 6, 7, 3, 4];
    const arr = [...base];
    if (window.SeededRandom) {
        return window.SeededRandom.shuffleInPlace(arr, rng);
    }
    for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function appendLog(text) {
    const p = document.createElement("p");
    p.textContent = text;
    logEl.prepend(p);
}

function roundTo2(value) {
    return Number(value.toFixed(2));
}

function percentage(count, total) {
    return total === 0 ? 0 : Math.round((count / total) * 100);
}

function offerBand(offer) {
    if (offer <= 3) {
        return "low";
    }
    if (offer <= 5) {
        return "even-to-fair";
    }
    return "generous";
}

function opponentStrategyForOffer(offer) {
    return `seeded-${offerBand(offer)}-offer`;
}

function updateBoard() {
    const rate = round === 0 ? 0 : Math.round((acceptedCount / round) * 100);
    document.getElementById("round").textContent = String(round);
    document.getElementById("earnings").textContent = String(earnings);
    document.getElementById("accept-rate").textContent = `${rate}%`;
}

function renderOffer() {
    if (round >= TOTAL_ROUNDS) {
        return;
    }
    const offer = offers[round];
    offerText.textContent = `对方给你 ${offer} / ${TOTAL_PIE}`;
    roundStartedAtMs = Date.now();
}

function decide(accept) {
    if (round >= TOTAL_ROUNDS) {
        return;
    }

    const roundNo = round + 1;
    const offer = offers[round];
    const fair = offer >= 4;
    const rtMs = roundStartedAtMs ? Math.max(0, Date.now() - roundStartedAtMs) : null;
    if (fair) {
        fairTotal += 1;
    } else {
        unfairTotal += 1;
    }

    let gain = 0;
    if (accept) {
        gain = offer;
        earnings += gain;
        acceptedCount += 1;
        if (fair) {
            fairAccepted += 1;
        } else {
            unfairAccepted += 1;
        }
    }

    const trial = {
        index: trials.length,
        round: roundNo,
        role: "responder",
        offer,
        offerRatio: roundTo2(offer / TOTAL_PIE),
        choice: accept ? "accept" : "reject",
        accept,
        opponentStrategy: opponentStrategyForOffer(offer),
        fairBand: offerBand(offer),
        fair,
        payoff: gain,
        opponentPayoff: accept ? TOTAL_PIE - offer : 0,
        return: null,
        rtMs
    };
    trials.push(trial);
    decisions.push({ ...trial });

    round += 1;
    appendLog(`第 ${round} 回合：提议 ${offer}/${TOTAL_PIE}，你${accept ? "接受" : "拒绝"}，收益 +${gain}`);
    updateBoard();

    if (round >= TOTAL_ROUNDS) {
        finish();
        return;
    }
    renderOffer();
}

function buildOfferDistribution() {
    return offers.reduce((dist, offer) => {
        const band = offerBand(offer);
        dist[band] = (dist[band] || 0) + 1;
        return dist;
    }, {});
}

function buildSummary() {
    const accepted = trials.filter((trial) => trial.accept);
    const fairTrials = trials.filter((trial) => trial.fair);
    const unfairTrials = trials.filter((trial) => !trial.fair);
    const firstHalf = trials.slice(0, Math.floor(trials.length / 2));
    const secondHalf = trials.slice(Math.floor(trials.length / 2));
    const acceptedOffers = accepted.map((trial) => trial.offer);
    const minimumAcceptedOffer = acceptedOffers.length ? Math.min(...acceptedOffers) : null;
    const maxRejectedOffer = trials
        .filter((trial) => !trial.accept)
        .reduce((max, trial) => Math.max(max, trial.offer), 0);
    const fairAcceptanceRate = percentage(fairTrials.filter((trial) => trial.accept).length, fairTrials.length);
    const unfairAcceptanceRate = percentage(unfairTrials.filter((trial) => trial.accept).length, unfairTrials.length);
    const earlyAcceptanceRate = percentage(firstHalf.filter((trial) => trial.accept).length, firstHalf.length);
    const lateAcceptanceRate = percentage(secondHalf.filter((trial) => trial.accept).length, secondHalf.length);

    return {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        rounds: TOTAL_ROUNDS,
        earnings,
        acceptanceRate: percentage(accepted.length, trials.length),
        fairAcceptanceRate,
        unfairAcceptanceRate,
        minimumAcceptedOffer,
        acceptanceThresholdRatio: minimumAcceptedOffer === null ? null : roundTo2(minimumAcceptedOffer / TOTAL_PIE),
        maxRejectedOffer,
        fairnessSensitivity: fairAcceptanceRate - unfairAcceptanceRate,
        earlyAcceptanceRate,
        lateAcceptanceRate,
        strategyAdaptationIndex: lateAcceptanceRate - earlyAcceptanceRate,
        offerDistribution: buildOfferDistribution(),
        opponentStrategy: "seeded-offer-schedule"
    };
}

function finish() {
    const fairRate = fairTotal === 0 ? 0 : Math.round((fairAccepted / fairTotal) * 100);
    const unfairRate = unfairTotal === 0 ? 0 : Math.round((unfairAccepted / unfairTotal) * 100);
    const summary = buildSummary();

    document.getElementById("result-earnings").textContent = String(earnings);
    document.getElementById("result-fair-rate").textContent = `${fairRate}%`;
    document.getElementById("result-unfair-rate").textContent = `${unfairRate}%`;

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            gameId: "ultimatum-game",
            gameName: "最后通牒博弈",
            startedAt: sessionStartedAt || new Date(),
            finishedAt: new Date(),
            score: earnings,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: trials.map((trial) => ({ ...trial })),
            metrics: {
                rounds: TOTAL_ROUNDS,
                earnings,
                fairAcceptanceRate: fairRate,
                unfairAcceptanceRate: unfairRate,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                offerOrder: offers.slice(),
                decisions,
                minimumAcceptedOffer: summary.minimumAcceptedOffer,
                acceptanceThresholdRatio: summary.acceptanceThresholdRatio,
                fairnessSensitivity: summary.fairnessSensitivity,
                strategyAdaptationIndex: summary.strategyAdaptationIndex,
                offerDistribution: summary.offerDistribution
            }
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    round = 0;
    earnings = 0;
    acceptedCount = 0;
    fairAccepted = 0;
    fairTotal = 0;
    unfairAccepted = 0;
    unfairTotal = 0;
    sessionStartedAt = new Date();
    decisions = [];
    trials = [];
    roundStartedAtMs = 0;

    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("ultimatum-game") : `ultimatum-game-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    offers = shuffledOffers(rng);

    logEl.innerHTML = "";
    updateBoard();
    renderOffer();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

document.getElementById("accept-btn").addEventListener("click", () => decide(true));
document.getElementById("reject-btn").addEventListener("click", () => decide(false));

window.startGame = startGame;
