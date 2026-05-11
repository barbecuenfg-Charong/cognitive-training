const MODULE_ID = "balloon-risk";
const GAME_NAME = "气球风险任务";
const CONTENT_VERSION = "balloon-risk-p0d-seeded-v1";
const TOTAL_BALLOONS = 20;
const POINTS_PER_PUMP = 5;
const MIN_BREAK_POINT = 4;
const MAX_BREAK_POINT = 12;

let round = 1;
let bank = 0;
let temp = 0;
let pumpsThisBalloon = 0;
let popThreshold = 0;
let poppedCount = 0;
let totalPumps = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let breakpointRng = null;
let balloonTrials = [];
let currentBalloon = null;
let actionLocked = false;
let sessionSaved = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("bart-panel");
const balloon = document.getElementById("balloon");
const hint = document.getElementById("hint");
const resultModal = document.getElementById("result-modal");
const pumpBtn = document.getElementById("pump-btn");
const bankBtn = document.getElementById("bank-btn");

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

function fallbackSeed() {
    const urlSeed = new URLSearchParams(window.location.search).get("seed");
    if (urlSeed && urlSeed.trim()) return urlSeed.trim();

    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const bytes = new Uint32Array(2);
        window.crypto.getRandomValues(bytes);
        return `${MODULE_ID}-${Date.now().toString(36)}-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
    }

    const perfNow = window.performance && typeof window.performance.now === "function"
        ? Math.round(window.performance.now() * 1000).toString(36)
        : "0";
    return `${MODULE_ID}-${Date.now().toString(36)}-${perfNow}`;
}

function createSessionSeed() {
    if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === "function") {
        return window.SeededRandom.createSessionSeed(MODULE_ID);
    }
    return fallbackSeed();
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return fallbackMulberry32(fallbackHashString(seed));
}

function randomThreshold() {
    const range = MAX_BREAK_POINT - MIN_BREAK_POINT + 1;
    return Math.floor(breakpointRng() * range) + MIN_BREAK_POINT;
}

function setActionLocked(locked) {
    actionLocked = locked;
    pumpBtn.disabled = locked;
    bankBtn.disabled = locked;
}

function updateBoard() {
    document.getElementById("round").textContent = String(round);
    document.getElementById("temp-points").textContent = String(temp);
    document.getElementById("bank-points").textContent = String(bank);

    const scale = 1 + pumpsThisBalloon * 0.08;
    balloon.style.transform = `scale(${Math.min(scale, 2.2)})`;
}

function startBalloon() {
    temp = 0;
    pumpsThisBalloon = 0;
    popThreshold = randomThreshold();
    currentBalloon = {
        index: round - 1,
        trialIndex: round - 1,
        balloonNumber: round,
        breakPoint: popThreshold,
        pumpCount: 0,
        cashout: false,
        burst: false,
        earned: 0,
        runningBank: bank,
        decisionPath: [],
        pumpEvents: []
    };
    balloon.classList.remove("popped");
    hint.textContent = "继续充气，或选择收手入账。";
    setActionLocked(false);
    updateBoard();
}

function startGame() {
    round = 1;
    bank = 0;
    temp = 0;
    pumpsThisBalloon = 0;
    popThreshold = 0;
    poppedCount = 0;
    totalPumps = 0;
    sessionStartedAt = new Date();
    sessionSeed = createSessionSeed();
    breakpointRng = createRng(`${sessionSeed}:breakpoints`);
    balloonTrials = [];
    currentBalloon = null;
    sessionSaved = false;

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
    startBalloon();
}

function saveBalloonTrial(outcome, earned) {
    if (!currentBalloon) return;

    const trial = {
        ...currentBalloon,
        pumpCount: pumpsThisBalloon,
        cashout: outcome === "cashout",
        burst: outcome === "burst",
        outcome,
        earned,
        runningBank: bank,
        decisionPath: currentBalloon.decisionPath.map((event) => ({ ...event })),
        pumpEvents: currentBalloon.pumpEvents.map((event) => ({ ...event }))
    };
    balloonTrials.push(trial);
    currentBalloon = null;
}

function nextRound() {
    round += 1;
    if (round > TOTAL_BALLOONS) {
        finish();
        return;
    }
    startBalloon();
}

function onPump() {
    if (actionLocked || !currentBalloon) return;

    pumpsThisBalloon += 1;
    totalPumps += 1;
    temp += POINTS_PER_PUMP;
    const wouldBurst = pumpsThisBalloon >= popThreshold;
    const pumpEvent = {
        pumpIndex: pumpsThisBalloon,
        tempPoints: temp,
        runningBank: bank,
        wouldBurst,
        afterPump: wouldBurst ? "burst" : "safe"
    };
    currentBalloon.pumpEvents.push(pumpEvent);
    currentBalloon.decisionPath.push({
        action: "pump",
        ...pumpEvent
    });
    updateBoard();

    if (wouldBurst) {
        poppedCount += 1;
        temp = 0;
        setActionLocked(true);
        saveBalloonTrial("burst", 0);
        balloon.classList.add("popped");
        hint.textContent = "气球爆炸！本轮临时分清零。";
        updateBoard();
        setTimeout(nextRound, 700);
    }
}

function onBank() {
    if (actionLocked || !currentBalloon) return;

    const earned = temp;
    bank += earned;
    temp = 0;
    setActionLocked(true);
    currentBalloon.decisionPath.push({
        action: "cashout",
        pumpCount: pumpsThisBalloon,
        tempPoints: earned,
        earned,
        runningBank: bank
    });
    saveBalloonTrial("cashout", earned);
    hint.textContent = `入账成功：+${earned}`;
    updateBoard();
    setTimeout(nextRound, 450);
}

function average(values) {
    const validValues = values.filter((value) => Number.isFinite(value));
    if (validValues.length === 0) return 0;
    return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function roundTo2(value) {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
}

function ratio(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0;
}

function riskTrendFromTrials(trials) {
    if (trials.length < 4) return "stable";

    const split = Math.floor(trials.length / 2);
    const firstHalfAvg = average(trials.slice(0, split).map((trial) => trial.pumpCount));
    const secondHalfAvg = average(trials.slice(split).map((trial) => trial.pumpCount));
    const delta = secondHalfAvg - firstHalfAvg;

    if (delta >= 1) return "up";
    if (delta <= -1) return "down";
    return "stable";
}

function riskTrendLabel(value) {
    if (value === "up") return "上升";
    if (value === "down") return "下降";
    return "稳定";
}

function buildTrainingAdvice(summary) {
    if (summary.burstRate >= 0.45) {
        return "建议下一轮提前 1-2 次收手，先降低爆炸率。";
    }
    if (summary.riskTrend === "up") {
        return "后半程风险有上升，建议先设定固定止盈点再开始。";
    }
    if (summary.adjustedAvgPumps <= 3 && summary.cashoutRate >= 0.8) {
        return "止盈较稳但偏保守，可在爆炸率可控时多尝试 1 次充气。";
    }
    return "当前节奏较稳定，下一轮继续观察止盈点和爆炸率的平衡。";
}

function buildSummary() {
    const totalBalloons = balloonTrials.length;
    const cashoutTrials = balloonTrials.filter((trial) => trial.cashout);
    const burstCount = balloonTrials.filter((trial) => trial.burst).length;
    const cashoutCount = cashoutTrials.length;
    const avgPumps = roundTo2(average(balloonTrials.map((trial) => trial.pumpCount)));
    const adjustedAvgPumps = roundTo2(average(cashoutTrials.map((trial) => trial.pumpCount)));
    const burstRate = ratio(burstCount, totalBalloons);
    const cashoutRate = ratio(cashoutCount, totalBalloons);
    const riskTrend = riskTrendFromTrials(balloonTrials);

    return {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        totalBalloons,
        totalBank: bank,
        avgPumps,
        adjustedAvgPumps,
        burstRate,
        cashoutRate,
        riskTrend,
        burstCount,
        cashoutCount,
        recommendation: buildTrainingAdvice({
            adjustedAvgPumps,
            burstRate,
            cashoutRate,
            riskTrend
        })
    };
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function saveSession(finishedAt, summary) {
    if (sessionSaved || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") return;

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

    window.TrainingResults.saveSession({
        moduleId: MODULE_ID,
        gameId: MODULE_ID,
        gameName: GAME_NAME,
        startedAt,
        finishedAt,
        durationMs,
        score: bank,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        summary,
        trials: balloonTrials.map((trial) => ({ ...trial })),
        metrics: {
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            totalBank: summary.totalBank,
            avgPumps: summary.avgPumps,
            adjustedAvgPumps: summary.adjustedAvgPumps,
            burstRate: summary.burstRate,
            cashoutRate: summary.cashoutRate,
            riskTrend: summary.riskTrend,
            recommendation: summary.recommendation
        }
    });
    sessionSaved = true;
}

function finish() {
    const finishedAt = new Date();
    const summary = buildSummary();

    document.getElementById("result-bank").textContent = String(bank);
    document.getElementById("result-avg-pumps").textContent = String(Math.round(summary.avgPumps));
    document.getElementById("result-pop-rate").textContent = formatPercent(summary.burstRate);
    document.getElementById("result-adjusted-pumps").textContent = String(summary.adjustedAvgPumps);
    document.getElementById("result-risk-trend").textContent = riskTrendLabel(summary.riskTrend);
    document.getElementById("result-advice").textContent = summary.recommendation;

    saveSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

pumpBtn.addEventListener("click", onPump);
bankBtn.addEventListener("click", onBank);

window.startGame = startGame;
