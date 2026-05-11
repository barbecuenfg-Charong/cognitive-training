const MODULE_ID = "balloon-risk";
const GAME_NAME = "气球风险任务";
const CONTENT_VERSION = "balloon-risk-bart-risk-blocks-v2";
const TOTAL_BALLOONS = 20;
const POINTS_PER_PUMP = 5;
const BLOCK_SIZE = 5;

const RISK_PROFILES = {
    low: {
        level: "low",
        label: "低风险",
        minThreshold: 8,
        maxThreshold: 15,
        targetCashoutPumps: 7,
        thresholdBias: "late"
    },
    medium: {
        level: "medium",
        label: "中风险",
        minThreshold: 5,
        maxThreshold: 12,
        targetCashoutPumps: 5,
        thresholdBias: "middle"
    },
    high: {
        level: "high",
        label: "高风险",
        minThreshold: 3,
        maxThreshold: 8,
        targetCashoutPumps: 3,
        thresholdBias: "early"
    }
};

const BASE_BLOCK_PROFILE_POOL = ["low", "medium", "high", "medium"];

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
let blockProfileRng = null;
let riskBlocks = [];
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

function randomInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

function shuffleWithRng(values, rng) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const swapIndex = randomInt(rng, 0, i);
        [result[i], result[swapIndex]] = [result[swapIndex], result[i]];
    }
    return result;
}

function repairAdjacentRiskRepeats(levels) {
    for (let i = 1; i < levels.length; i += 1) {
        if (levels[i] !== levels[i - 1]) continue;

        const swapIndex = levels.findIndex((level, index) => (
            index > i
            && level !== levels[i - 1]
            && (index === levels.length - 1 || levels[i] !== levels[index + 1])
        ));

        if (swapIndex >= 0) {
            [levels[i], levels[swapIndex]] = [levels[swapIndex], levels[i]];
        }
    }
    return levels;
}

function buildRiskBlocks() {
    const blockCount = Math.ceil(TOTAL_BALLOONS / BLOCK_SIZE);
    let levels = [];

    while (levels.length < blockCount) {
        levels = levels.concat(shuffleWithRng(BASE_BLOCK_PROFILE_POOL, blockProfileRng));
    }

    levels = repairAdjacentRiskRepeats(levels.slice(0, blockCount));

    return levels.map((riskLevel, index) => ({
        blockIndex: index + 1,
        startBalloon: index * BLOCK_SIZE + 1,
        endBalloon: Math.min((index + 1) * BLOCK_SIZE, TOTAL_BALLOONS),
        riskLevel,
        riskLabel: RISK_PROFILES[riskLevel].label
    }));
}

function getRiskBlock(balloonNumber) {
    const blockIndex = Math.floor((balloonNumber - 1) / BLOCK_SIZE);
    return riskBlocks[blockIndex] || riskBlocks[riskBlocks.length - 1];
}

function weightedThresholdValue(profile) {
    const first = breakpointRng();
    const second = breakpointRng();

    if (profile.thresholdBias === "early") return Math.min(first, second);
    if (profile.thresholdBias === "late") return Math.max(first, second);
    return (first + second) / 2;
}

function randomThreshold(profile) {
    const span = profile.maxThreshold - profile.minThreshold + 1;
    const weighted = weightedThresholdValue(profile);
    const threshold = profile.minThreshold + Math.floor(weighted * span);
    return Math.min(profile.maxThreshold, Math.max(profile.minThreshold, threshold));
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
    const riskBlock = getRiskBlock(round);
    const riskProfile = RISK_PROFILES[riskBlock.riskLevel];

    temp = 0;
    pumpsThisBalloon = 0;
    popThreshold = randomThreshold(riskProfile);
    currentBalloon = {
        balloonIndex: round,
        index: round - 1,
        trialIndex: round - 1,
        balloonNumber: round,
        blockIndex: riskBlock.blockIndex,
        blockPosition: round - riskBlock.startBalloon + 1,
        riskLevel: riskProfile.level,
        riskLabel: riskProfile.label,
        threshold: popThreshold,
        thresholdRange: [riskProfile.minThreshold, riskProfile.maxThreshold],
        breakPoint: popThreshold,
        pointsPerPump: POINTS_PER_PUMP,
        pumpCount: 0,
        cashout: false,
        burst: false,
        earnings: 0,
        earned: 0,
        runningBank: bank,
        decisionPath: [],
        pumpEvents: []
    };
    balloon.classList.remove("popped");
    hint.textContent = "爆炸阈值不会显示；根据上一只气球的结果调整下一次收手点。";
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
    blockProfileRng = createRng(`${sessionSeed}:risk-blocks`);
    riskBlocks = buildRiskBlocks();
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
        threshold: popThreshold,
        earnings: earned,
        earned,
        runningBank: bank,
        decisionPath: currentBalloon.decisionPath.map((event) => ({ ...event })),
        pumpEvents: currentBalloon.pumpEvents.map((event) => ({ ...event }))
    };
    const rollingMetrics = buildRollingMetrics([...balloonTrials, trial]);
    trial.adjustedAvgPumps = rollingMetrics.adjustedAvgPumps;
    trial.burstRate = rollingMetrics.burstRate;
    trial.cashoutRate = rollingMetrics.cashoutRate;
    trial.riskTrend = rollingMetrics.riskTrend;
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
        balloonIndex: currentBalloon.balloonIndex,
        riskLevel: currentBalloon.riskLevel,
        pumpIndex: pumpsThisBalloon,
        tempPoints: temp,
        runningBank: bank,
        threshold: popThreshold,
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
        balloonIndex: currentBalloon.balloonIndex,
        riskLevel: currentBalloon.riskLevel,
        pumpCount: pumpsThisBalloon,
        tempPoints: earned,
        earnings: earned,
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

function sumEarnings(trials) {
    return trials.reduce((sum, trial) => sum + (Number(trial.earnings) || 0), 0);
}

function buildTrialStats(trials) {
    const totalBalloons = trials.length;
    const cashoutTrials = trials.filter((trial) => trial.cashout);
    const burstCount = trials.filter((trial) => trial.burst).length;
    const cashoutCount = cashoutTrials.length;

    return {
        totalBalloons,
        burstCount,
        cashoutCount,
        totalEarnings: sumEarnings(trials),
        avgPumps: roundTo2(average(trials.map((trial) => trial.pumpCount))),
        adjustedAvgPumps: roundTo2(average(cashoutTrials.map((trial) => trial.pumpCount))),
        burstRate: ratio(burstCount, totalBalloons),
        cashoutRate: ratio(cashoutCount, totalBalloons)
    };
}

function riskTrendFromTrials(trials) {
    if (trials.length < 8) return "collecting";

    const split = Math.floor(trials.length / 2);
    const firstHalf = buildTrialStats(trials.slice(0, split));
    const secondHalf = buildTrialStats(trials.slice(split));
    const pumpDelta = secondHalf.avgPumps - firstHalf.avgPumps;
    const adjustedPumpDelta = secondHalf.adjustedAvgPumps - firstHalf.adjustedAvgPumps;
    const burstDelta = secondHalf.burstRate - firstHalf.burstRate;

    if (burstDelta <= -0.15 && adjustedPumpDelta >= -0.5) return "adaptive";
    if (burstDelta >= 0.15 && pumpDelta >= 0.5) return "risk-escalation";
    if (adjustedPumpDelta <= -1 && secondHalf.cashoutRate >= firstHalf.cashoutRate) return "risk-reduction";
    if (Math.abs(pumpDelta) < 0.5 && Math.abs(burstDelta) < 0.1) return "flat";
    return "mixed";
}

function riskTrendLabel(value) {
    if (value === "adaptive") return "风险校准改善";
    if (value === "risk-escalation") return "冒险上升";
    if (value === "risk-reduction") return "收手提前";
    if (value === "flat") return "变化不足";
    if (value === "mixed") return "混合变化";
    return "收集中";
}

function buildRollingMetrics(trials) {
    const stats = buildTrialStats(trials);
    return {
        adjustedAvgPumps: stats.adjustedAvgPumps,
        burstRate: stats.burstRate,
        cashoutRate: stats.cashoutRate,
        riskTrend: riskTrendFromTrials(trials)
    };
}

function buildBlockLevelSummary(trials) {
    return riskBlocks.map((block) => {
        const blockTrials = trials.filter((trial) => trial.blockIndex === block.blockIndex);
        const stats = buildTrialStats(blockTrials);

        return {
            blockIndex: block.blockIndex,
            startBalloon: block.startBalloon,
            endBalloon: block.endBalloon,
            riskLevel: block.riskLevel,
            riskLabel: block.riskLabel,
            totalBalloons: stats.totalBalloons,
            avgPumps: stats.avgPumps,
            adjustedAvgPumps: stats.adjustedAvgPumps,
            burstRate: stats.burstRate,
            cashoutRate: stats.cashoutRate,
            totalEarnings: stats.totalEarnings
        };
    }).filter((block) => block.totalBalloons > 0);
}

function buildRiskLevelSummary(trials) {
    return Object.keys(RISK_PROFILES).map((riskLevel) => {
        const profile = RISK_PROFILES[riskLevel];
        const levelTrials = trials.filter((trial) => trial.riskLevel === riskLevel);
        const stats = buildTrialStats(levelTrials);

        return {
            riskLevel,
            riskLabel: profile.label,
            thresholdRange: [profile.minThreshold, profile.maxThreshold],
            targetCashoutPumps: profile.targetCashoutPumps,
            totalBalloons: stats.totalBalloons,
            avgPumps: stats.avgPumps,
            adjustedAvgPumps: stats.adjustedAvgPumps,
            burstRate: stats.burstRate,
            cashoutRate: stats.cashoutRate,
            totalEarnings: stats.totalEarnings
        };
    }).filter((summary) => summary.totalBalloons > 0);
}

function representativePumps(summary) {
    return summary && summary.adjustedAvgPumps > 0 ? summary.adjustedAvgPumps : (summary ? summary.avgPumps : 0);
}

function riskSeparationFromLevels(riskLevelSummary) {
    const lowRisk = riskLevelSummary.find((summary) => summary.riskLevel === "low");
    const highRisk = riskLevelSummary.find((summary) => summary.riskLevel === "high");
    if (!lowRisk || !highRisk) return 0;
    return roundTo2(representativePumps(lowRisk) - representativePumps(highRisk));
}

function classifyTrainingPattern(summary) {
    const highRisk = summary.riskLevelSummary.find((level) => level.riskLevel === "high");

    if (summary.burstRate >= 0.45 || (highRisk && highRisk.burstRate >= 0.6)) {
        return "over-risk";
    }
    if (summary.cashoutRate >= 0.8 && summary.burstRate <= 0.2 && summary.adjustedAvgPumps <= 3.5) {
        return "over-conservative";
    }
    if (summary.riskTrend === "flat" || (summary.totalBalloons >= 12 && summary.riskSeparation < 0.75)) {
        return "learning-insufficient";
    }
    if (summary.riskTrend === "adaptive") {
        return "adaptive";
    }
    return "mixed";
}

function feedbackLabel(value) {
    if (value === "over-risk") return "过度冒险";
    if (value === "over-conservative") return "过度保守";
    if (value === "learning-insufficient") return "学习不足";
    if (value === "adaptive") return "校准改善";
    return "混合表现";
}

function buildNextRiskProfile(summary) {
    if (summary.feedbackType === "over-risk") {
        return {
            focus: "reduce-burst-rate",
            riskLevels: ["low", "medium", "high"],
            startingPumpLimit: Math.max(2, Math.floor(summary.adjustedAvgPumps) - 1),
            rule: "爆炸后下一只气球至少少充 1 次，先把爆炸率压低。"
        };
    }
    if (summary.feedbackType === "over-conservative") {
        return {
            focus: "expand-safe-window",
            riskLevels: ["low", "medium", "medium"],
            startingPumpLimit: Math.max(3, Math.ceil(summary.adjustedAvgPumps) + 1),
            rule: "在连续兑现时逐步多充 1 次，观察收益是否提高。"
        };
    }
    if (summary.feedbackType === "learning-insufficient") {
        return {
            focus: "risk-discrimination",
            riskLevels: ["medium", "high", "low"],
            startingPumpLimit: Math.max(3, Math.round(summary.avgPumps)),
            rule: "记录每组爆炸反馈，下一组按反馈主动调整收手点。"
        };
    }
    return {
        focus: "maintain-calibration",
        riskLevels: ["medium", "low", "high"],
        startingPumpLimit: Math.max(3, Math.round(summary.adjustedAvgPumps)),
        rule: "保持当前兑现点，并在爆炸后缩短下一次充气序列。"
    };
}

function buildTrainingAdvice(summary) {
    if (summary.feedbackType === "over-risk") {
        return "本轮爆炸率偏高，表现为过度冒险；下一轮先降低目标充气次数，再逐步寻找收益上限。";
    }
    if (summary.feedbackType === "over-conservative") {
        return "本轮兑现率高但调整后平均充气偏低，表现为过度保守；可在连续安全时多尝试 1 次充气。";
    }
    if (summary.feedbackType === "learning-insufficient") {
        return "不同风险组下的充气变化不明显，表现为风险学习不足；下一轮重点根据爆炸反馈调整收手点。";
    }
    if (summary.feedbackType === "adaptive") {
        return "后半程爆炸率下降且兑现点保持，风险校准有改善；下一轮继续观察调整后平均充气。";
    }
    return "本轮呈混合表现；下一轮先设定初始收手点，再按每组爆炸和兑现结果微调。";
}

function buildSummary() {
    const trialStats = buildTrialStats(balloonTrials);
    const blockLevelSummary = buildBlockLevelSummary(balloonTrials);
    const riskLevelSummary = buildRiskLevelSummary(balloonTrials);
    const riskTrend = riskTrendFromTrials(balloonTrials);
    const riskSeparation = roundTo2(riskSeparationFromLevels(riskLevelSummary));
    const totalBalloons = trialStats.totalBalloons;
    const feedbackType = classifyTrainingPattern({
        totalBalloons,
        burstRate: trialStats.burstRate,
        cashoutRate: trialStats.cashoutRate,
        adjustedAvgPumps: trialStats.adjustedAvgPumps,
        avgPumps: trialStats.avgPumps,
        riskTrend,
        riskSeparation,
        riskLevelSummary
    });
    const nextRiskProfile = buildNextRiskProfile({
        ...trialStats,
        riskTrend,
        riskSeparation,
        riskLevelSummary,
        feedbackType
    });

    return {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        totalBalloons,
        totalBank: bank,
        avgPumps: trialStats.avgPumps,
        adjustedAvgPumps: trialStats.adjustedAvgPumps,
        burstRate: trialStats.burstRate,
        cashoutRate: trialStats.cashoutRate,
        riskTrend,
        riskTrendLabel: riskTrendLabel(riskTrend),
        riskSeparation,
        feedbackType,
        feedbackLabel: feedbackLabel(feedbackType),
        blockLevelSummary,
        riskLevelSummary,
        nextRiskProfile,
        burstCount: trialStats.burstCount,
        cashoutCount: trialStats.cashoutCount,
        totalEarnings: trialStats.totalEarnings,
        recommendation: buildTrainingAdvice({
            ...trialStats,
            riskTrend,
            riskSeparation,
            riskLevelSummary,
            feedbackType
        })
    };
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function formatBlockSummary(blockLevelSummary) {
    if (!blockLevelSummary.length) return "尚未形成分组表现。";

    return blockLevelSummary.map((block) => (
        `第${block.blockIndex}组(${block.riskLabel}): ` +
        `爆炸率${formatPercent(block.burstRate)}，` +
        `兑现率${formatPercent(block.cashoutRate)}，` +
        `调整后平均充气${block.adjustedAvgPumps}`
    )).join("；");
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
            riskTrendLabel: summary.riskTrendLabel,
            riskSeparation: summary.riskSeparation,
            feedbackType: summary.feedbackType,
            feedbackLabel: summary.feedbackLabel,
            blockLevelSummary: summary.blockLevelSummary,
            riskLevelSummary: summary.riskLevelSummary,
            nextRiskProfile: summary.nextRiskProfile,
            recommendation: summary.recommendation
        }
    });
    sessionSaved = true;
}

function finish() {
    const finishedAt = new Date();
    const summary = buildSummary();

    document.getElementById("result-bank").textContent = String(bank);
    document.getElementById("result-avg-pumps").textContent = String(summary.avgPumps);
    document.getElementById("result-pop-rate").textContent = formatPercent(summary.burstRate);
    document.getElementById("result-adjusted-pumps").textContent = String(summary.adjustedAvgPumps);
    document.getElementById("result-cashout-rate").textContent = formatPercent(summary.cashoutRate);
    document.getElementById("result-risk-trend").textContent = summary.riskTrendLabel;
    const learningPatternEl = document.getElementById("result-learning-pattern");
    if (learningPatternEl) {
        learningPatternEl.textContent = summary.feedbackLabel;
    }
    const blockSummaryEl = document.getElementById("result-block-summary");
    if (blockSummaryEl) {
        blockSummaryEl.textContent = formatBlockSummary(summary.blockLevelSummary);
    }
    const nextRiskProfileEl = document.getElementById("result-next-risk");
    if (nextRiskProfileEl) {
        nextRiskProfileEl.textContent = `下一轮建议：${summary.nextRiskProfile.rule}`;
    }
    document.getElementById("result-advice").textContent = summary.recommendation;

    saveSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

pumpBtn.addEventListener("click", onPump);
bankBtn.addEventListener("click", onBank);

window.startGame = startGame;
