const TOTAL_ROUNDS = 20;
const TOTAL_PIE = 10;
const CONTENT_VERSION = "ultimatum-game-v3-strategy-depth";
const DEFAULT_FAIRNESS_THRESHOLD = 4;
const OFFER_BANDS = [
    { id: "very-low", label: "1-2/10", min: 1, max: 2 },
    { id: "low", label: "3/10", min: 3, max: 3 },
    { id: "fair", label: "4-5/10", min: 4, max: 5 },
    { id: "generous", label: "6-10/10", min: 6, max: 10 }
];

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

function roundTo0OrNull(value) {
    return value === null ? null : Math.round(value);
}

function percentage(count, total) {
    return total === 0 ? 0 : Math.round((count / total) * 100);
}

function average(values) {
    const usable = values.filter((value) => Number.isFinite(value));
    if (!usable.length) {
        return null;
    }
    return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}

function offerBand(offer) {
    const match = OFFER_BANDS.find((band) => offer >= band.min && offer <= band.max);
    return match ? match.id : "out-of-range";
}

function offerBandLabel(offer) {
    const match = OFFER_BANDS.find((band) => offer >= band.min && offer <= band.max);
    return match ? match.label : "out-of-range";
}

function opponentStrategyForOffer(offer) {
    return `seeded-${offerBand(offer)}-offer`;
}

function clampOfferThreshold(value) {
    return Math.min(TOTAL_PIE, Math.max(1, value));
}

function dynamicFairnessThresholdFor(history) {
    const acceptedOffers = history.filter((trial) => trial.accept).map((trial) => trial.offer);
    const rejectedOffers = history.filter((trial) => !trial.accept).map((trial) => trial.offer);
    const minimumAccepted = acceptedOffers.length ? Math.min(...acceptedOffers) : null;
    const maximumRejected = rejectedOffers.length ? Math.max(...rejectedOffers) : null;

    if (minimumAccepted !== null && maximumRejected !== null) {
        if (maximumRejected >= minimumAccepted) {
            return clampOfferThreshold(Math.round((maximumRejected + minimumAccepted) / 2));
        }
        return minimumAccepted;
    }
    if (minimumAccepted !== null) {
        return minimumAccepted;
    }
    if (maximumRejected !== null) {
        return clampOfferThreshold(maximumRejected + 1);
    }
    return DEFAULT_FAIRNESS_THRESHOLD;
}

function choiceInconsistencyType(offer, accept, threshold) {
    if (accept && offer < threshold) {
        return "accepted-below-threshold";
    }
    if (!accept && offer >= threshold) {
        return "rejected-at-or-above-threshold";
    }
    return "consistent-with-dynamic-threshold";
}

function fairnessProfileFor(list) {
    const fairTrials = list.filter((trial) => trial.fair);
    const unfairTrials = list.filter((trial) => !trial.fair);
    const acceptanceRate = percentage(list.filter((trial) => trial.accept).length, list.length);
    const fairAcceptanceRate = percentage(fairTrials.filter((trial) => trial.accept).length, fairTrials.length);
    const unfairAcceptanceRate = percentage(unfairTrials.filter((trial) => trial.accept).length, unfairTrials.length);

    return {
        acceptanceRate,
        fairAcceptanceRate,
        unfairAcceptanceRate,
        fairnessSensitivity: fairAcceptanceRate - unfairAcceptanceRate
    };
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
    const dynamicFairnessThreshold = dynamicFairnessThresholdFor(trials);
    const inconsistencyType = choiceInconsistencyType(offer, accept, dynamicFairnessThreshold);
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
        offerBand: offerBand(offer),
        offerBandLabel: offerBandLabel(offer),
        fair,
        dynamicFairnessThreshold,
        dynamicFairnessThresholdRatio: roundTo2(dynamicFairnessThreshold / TOTAL_PIE),
        inconsistentChoice: inconsistencyType !== "consistent-with-dynamic-threshold",
        inconsistencyType,
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

function buildOfferBandBreakdown() {
    return OFFER_BANDS.map((band) => {
        const bandTrials = trials.filter((trial) => trial.offerBand === band.id);
        const meanRt = average(bandTrials.map((trial) => trial.rtMs));

        return {
            band: band.id,
            range: band.label,
            count: bandTrials.length,
            acceptedCount: bandTrials.filter((trial) => trial.accept).length,
            acceptanceRate: percentage(bandTrials.filter((trial) => trial.accept).length, bandTrials.length),
            meanRtMs: roundTo0OrNull(meanRt),
            inconsistentChoiceCount: bandTrials.filter((trial) => trial.inconsistentChoice).length
        };
    });
}

function buildReactionTimeByOfferBand(offerBandBreakdown) {
    return offerBandBreakdown.reduce((acc, item) => {
        acc[item.band] = item.meanRtMs;
        return acc;
    }, {});
}

function buildNextFairnessPractice(summary) {
    if (summary.inconsistentChoiceRate >= 25) {
        return {
            focus: "threshold-consistency",
            baselineThreshold: summary.dynamicFairnessThreshold,
            rule: "下一轮先写下最低可接受报价，再连续 5 轮按同一阈值判断。",
            targetOfferBands: ["low", "fair"],
            feedback: "练习目标是让阈值规则更稳定，尤其比较 3/10 与 4/10 的边界。"
        };
    }
    if (summary.fairnessSensitivity >= 60) {
        return {
            focus: "graded-fairness-sensitivity",
            baselineThreshold: summary.dynamicFairnessThreshold,
            rule: "下一轮把 3/10、4/10、5/10 分开记录理由，避免只用公平/不公平二分。",
            targetOfferBands: ["low", "fair"],
            feedback: "练习目标是细化边界报价的策略判断。"
        };
    }
    if (summary.fairAcceptanceRate < 70) {
        return {
            focus: "fair-offer-acceptance-check",
            baselineThreshold: summary.dynamicFairnessThreshold,
            rule: "下一轮遇到 4/10 以上报价时先判断长期收益，再决定是否拒绝。",
            targetOfferBands: ["fair", "generous"],
            feedback: "练习目标是区分公平敏感性和总收益目标。"
        };
    }
    return {
        focus: "banded-fairness-calibration",
        baselineThreshold: summary.dynamicFairnessThreshold,
        rule: "下一轮继续按报价区间记录接受理由，并观察阈值是否随低报价后移动。",
        targetOfferBands: ["very-low", "low", "fair", "generous"],
        feedback: "练习目标是把报价区间、阈值和反应时间放在同一策略表里复盘。"
    };
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
    const offerBandBreakdown = buildOfferBandBreakdown();
    const firstHalfProfile = fairnessProfileFor(firstHalf);
    const secondHalfProfile = fairnessProfileFor(secondHalf);
    const inconsistentChoiceCount = trials.filter((trial) => trial.inconsistentChoice).length;

    const summary = {
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
        dynamicFairnessThreshold: dynamicFairnessThresholdFor(trials),
        dynamicFairnessThresholdRatio: roundTo2(dynamicFairnessThresholdFor(trials) / TOTAL_PIE),
        inconsistentChoiceCount,
        inconsistentChoiceRate: percentage(inconsistentChoiceCount, trials.length),
        offerDistribution: buildOfferDistribution(),
        offerBandBreakdown,
        reactionTimeByOfferBand: buildReactionTimeByOfferBand(offerBandBreakdown),
        phaseFairnessChange: {
            early: firstHalfProfile,
            late: secondHalfProfile,
            fairnessSensitivityDelta: secondHalfProfile.fairnessSensitivity - firstHalfProfile.fairnessSensitivity,
            acceptanceRateDelta: lateAcceptanceRate - earlyAcceptanceRate
        },
        strategyBaseline: {
            fairOfferCutoff: DEFAULT_FAIRNESS_THRESHOLD,
            thresholdBasis: "running-min-accepted-and-max-rejected",
            offerBandCount: OFFER_BANDS.length
        },
        opponentStrategy: "seeded-offer-schedule"
    };
    summary.nextFairnessPractice = buildNextFairnessPractice(summary);
    return summary;
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
                dynamicFairnessThreshold: summary.dynamicFairnessThreshold,
                dynamicFairnessThresholdRatio: summary.dynamicFairnessThresholdRatio,
                inconsistentChoiceCount: summary.inconsistentChoiceCount,
                inconsistentChoiceRate: summary.inconsistentChoiceRate,
                offerDistribution: summary.offerDistribution,
                offerBandBreakdown: summary.offerBandBreakdown,
                reactionTimeByOfferBand: summary.reactionTimeByOfferBand,
                phaseFairnessChange: summary.phaseFairnessChange,
                strategyBaseline: summary.strategyBaseline,
                nextFairnessPractice: summary.nextFairnessPractice
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
