const BLOCK_CONFIGS = [
    {
        title: "强制切换",
        condition: "forced-switch-classic",
        conditionLabel: "强制切换",
        lockedStrategy: "switch",
        doorCount: 3,
        feedbackLevel: "high",
        trials: 8,
        description: "每轮都在主持人排除羊门后切换，用来建立切换条件的长期样本。"
    },
    {
        title: "强制坚持",
        condition: "forced-stay-classic",
        conditionLabel: "强制坚持",
        lockedStrategy: "stay",
        doorCount: 3,
        feedbackLevel: "high",
        trials: 8,
        description: "每轮都保留初选，用同样的 3 门范式对照坚持条件的长期样本。"
    },
    {
        title: "自由选择",
        condition: "free-choice-classic",
        conditionLabel: "自由选择",
        lockedStrategy: null,
        doorCount: 3,
        feedbackLevel: "medium",
        trials: 8,
        description: "回到经典 3 门范式，观察你是否把前两个 block 的概率差异用于策略选择。"
    },
    {
        title: "参数变化",
        condition: "free-choice-expanded",
        conditionLabel: "自由选择",
        lockedStrategy: null,
        doorCount: 4,
        feedbackLevel: "low",
        trials: 8,
        description: "门数增加后，主持人会排除更多羊门，检查你能否迁移切换优势。"
    }
];

const TRIAL_COUNT = BLOCK_CONFIGS.reduce((sum, block) => sum + block.trials, 0);
const CONTENT_VERSION = "monty-hall-v3-block-training";

let gameState = null;
let trialIndex = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionTrials = [];
let responses = [];
let sessionSaved = false;
let stats = createEmptyStats();

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("mh-panel");
const doorsContainer = document.getElementById("doors");
const hintText = document.getElementById("hint-text");
const feedbackText = document.getElementById("feedback-text");
const stayBtn = document.getElementById("stay-btn");
const switchBtn = document.getElementById("switch-btn");
const nextBtn = document.getElementById("next-btn");
const resultModal = document.getElementById("result-modal");
const blockTitle = document.getElementById("block-title");
const conditionText = document.getElementById("condition-text");
const parameterText = document.getElementById("parameter-text");
const comparisonText = document.getElementById("comparison-text");

function createEmptyStats() {
    return {
        rounds: 0,
        wins: 0,
        switchWins: 0,
        switchTotal: 0,
        stayWins: 0,
        stayTotal: 0
    };
}

function randomDoor(rng, doorCount) {
    return Math.floor(rng() * doorCount);
}

function roundTo(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function rate(count, total) {
    return total === 0 ? 0 : count / total;
}

function percentage(count, total) {
    return Math.round(rate(count, total) * 100);
}

function formatRate(count, total) {
    return `${percentage(count, total)}%`;
}

function formatRatio(wins, total) {
    return `${wins}/${total}（${formatRate(wins, total)}）`;
}

function feedbackLevelLabel(level) {
    if (level === "high") {
        return "强提示";
    }
    if (level === "medium") {
        return "中提示";
    }
    return "弱提示";
}

function strategyLabel(strategy) {
    return strategy === "switch" ? "切换" : "坚持";
}

function createRevealMap(prizeDoor, doorCount, rng) {
    const doors = Array.from({ length: doorCount }, (_, index) => index);
    const revealByInitialChoice = {};

    doors.forEach((initialChoice) => {
        let switchTarget = prizeDoor;

        if (initialChoice === prizeDoor) {
            const goatDoors = doors.filter((door) => door !== initialChoice);
            switchTarget = goatDoors[Math.floor(rng() * goatDoors.length)];
        }

        const openedDoors = doors.filter((door) => (
            door !== initialChoice
            && door !== switchTarget
            && door !== prizeDoor
        ));

        revealByInitialChoice[initialChoice] = {
            openedDoor: openedDoors[0],
            openedDoors,
            switchTarget
        };
    });

    return revealByInitialChoice;
}

function createTrial(index, blockIndex, blockTrialIndex, block, rng) {
    const prizeDoor = randomDoor(rng, block.doorCount);

    return {
        id: `mh-b${blockIndex + 1}-${String(blockTrialIndex + 1).padStart(2, "0")}`,
        index,
        blockIndex,
        blockTrialIndex,
        condition: block.condition,
        conditionLabel: block.conditionLabel,
        lockedStrategy: block.lockedStrategy,
        doorCount: block.doorCount,
        feedbackLevel: block.feedbackLevel,
        prizeDoor,
        revealByInitialChoice: createRevealMap(prizeDoor, block.doorCount, rng)
    };
}

function buildSessionTrials() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("monty-hall") : `monty-hall-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    sessionTrials = [];

    BLOCK_CONFIGS.forEach((block, blockIndex) => {
        for (let blockTrialIndex = 0; blockTrialIndex < block.trials; blockTrialIndex += 1) {
            sessionTrials.push(createTrial(
                sessionTrials.length,
                blockIndex,
                blockTrialIndex,
                block,
                rng
            ));
        }
    });
}

function createRound(trial) {
    return {
        stage: "pick",
        trialId: trial.id,
        index: trial.index,
        blockIndex: trial.blockIndex,
        blockTrialIndex: trial.blockTrialIndex,
        condition: trial.condition,
        conditionLabel: trial.conditionLabel,
        lockedStrategy: trial.lockedStrategy,
        doorCount: trial.doorCount,
        feedbackLevel: trial.feedbackLevel,
        selectedDoor: null,
        initialChoice: null,
        prizeDoor: trial.prizeDoor,
        openedDoor: null,
        openedDoors: [],
        switchTarget: null,
        finalChoice: null,
        revealByInitialChoice: { ...trial.revealByInitialChoice },
        completed: false,
        feedbackMessage: "",
        feedbackClass: "",
        startedAt: new Date(),
        startedAtMs: Date.now()
    };
}

function startGame() {
    trialIndex = 0;
    stats = createEmptyStats();
    responses = [];
    sessionSaved = false;
    sessionStartedAt = new Date();
    buildSessionTrials();
    gameState = createRound(sessionTrials[trialIndex]);

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
    updateStatsView();
    renderRound();
}

function getCurrentBlock() {
    return BLOCK_CONFIGS[gameState.blockIndex];
}

function getRevealState(initialChoice) {
    const revealState = gameState.revealByInitialChoice[initialChoice];
    if (revealState && Array.isArray(revealState.openedDoors)) {
        return revealState;
    }

    const doors = Array.from({ length: gameState.doorCount }, (_, index) => index);
    const openedDoors = doors.filter((door) => (
        door !== initialChoice
        && door !== gameState.prizeDoor
    )).slice(0, Math.max(1, gameState.doorCount - 2));
    const switchTarget = doors.find((door) => door !== initialChoice && !openedDoors.includes(door));

    return {
        openedDoor: openedDoors[0],
        openedDoors,
        switchTarget
    };
}

function theoreticalStayWinRate(doorCount) {
    return 1 / doorCount;
}

function theoreticalSwitchWinRate(doorCount) {
    return (doorCount - 1) / doorCount;
}

function updateStatsView() {
    const switchWinRate = percentage(stats.switchWins, stats.switchTotal);
    const stayWinRate = percentage(stats.stayWins, stats.stayTotal);
    const winRate = percentage(stats.wins, stats.rounds);
    const switchUseRate = percentage(stats.switchTotal, stats.rounds);

    document.getElementById("switch-use-rate").textContent = `${switchUseRate}%`;
    document.getElementById("switch-rate").textContent = `${switchWinRate}%`;
    document.getElementById("stay-rate").textContent = `${stayWinRate}%`;
    document.getElementById("win-rate").textContent = `${winRate}%`;
    document.getElementById("round-count").textContent = `${stats.rounds}/${TRIAL_COUNT}`;
}

function updateBlockView() {
    const block = getCurrentBlock();
    const stayPct = Math.round(theoreticalStayWinRate(block.doorCount) * 100);
    const switchPct = Math.round(theoreticalSwitchWinRate(block.doorCount) * 100);
    const completedInBlock = responses.filter((item) => item.blockIndex === gameState.blockIndex).length;

    blockTitle.textContent = `${gameState.blockIndex + 1}/${BLOCK_CONFIGS.length} ${block.title}`;
    conditionText.textContent = block.lockedStrategy
        ? `${block.conditionLabel}：只能${strategyLabel(block.lockedStrategy)}`
        : "自由选择：自行决定坚持或切换";
    parameterText.textContent = `${block.doorCount} 门 · ${feedbackLevelLabel(block.feedbackLevel)} · ${completedInBlock}/${block.trials}`;
    comparisonText.textContent = `${block.description} 理论基准：坚持约 ${stayPct}%，切换约 ${switchPct}%。`;
}

function renderRound() {
    updateBlockView();
    doorsContainer.innerHTML = "";

    for (let i = 0; i < gameState.doorCount; i += 1) {
        const door = document.createElement("button");
        door.className = "mh-door";
        door.type = "button";
        door.textContent = `门 ${i + 1}`;

        if (gameState.selectedDoor === i || gameState.finalChoice === i) {
            door.classList.add("selected");
        }

        if (gameState.openedDoors.includes(i)) {
            door.classList.add("revealed");
            door.textContent = `门 ${i + 1}（羊）`;
        }

        if (gameState.completed && gameState.prizeDoor === i) {
            door.classList.add("winner");
            door.textContent = `门 ${i + 1}（汽车）`;
        }

        door.disabled = gameState.stage !== "pick";
        door.addEventListener("click", () => selectDoor(i));
        doorsContainer.appendChild(door);
    }

    const lockedStrategy = gameState.lockedStrategy;
    const inDecisionStage = gameState.stage === "decision";
    stayBtn.disabled = !inDecisionStage || lockedStrategy === "switch";
    switchBtn.disabled = !inDecisionStage || lockedStrategy === "stay";
    stayBtn.textContent = lockedStrategy === "stay" ? "按本块规则坚持" : "坚持原选择";
    switchBtn.textContent = lockedStrategy === "switch" ? "按本块规则切换" : "切换到另一扇未开门";
    nextBtn.style.display = gameState.completed ? "inline-flex" : "none";
    nextBtn.textContent = trialIndex >= sessionTrials.length - 1 ? "查看结果" : "下一回合";

    feedbackText.className = `mh-feedback${gameState.feedbackClass ? ` ${gameState.feedbackClass}` : ""}`;

    if (gameState.stage === "pick") {
        hintText.textContent = `第 ${trialIndex + 1} / ${TRIAL_COUNT} 轮：请选择一扇门作为初选。`;
        feedbackText.textContent = "训练目标是比较条件胜率。单轮输赢会波动，关键是观察切换和坚持在同类条件下的累计差异。";
    } else if (gameState.stage === "decision") {
        const opened = gameState.openedDoors.map((door) => `门 ${door + 1}`).join("、");
        hintText.textContent = `主持人打开了 ${opened}（山羊），现在按本 block 条件完成最终选择。`;
        feedbackText.textContent = `概率校准：初选命中概率仍是 ${Math.round(theoreticalStayWinRate(gameState.doorCount) * 100)}%，切换承接的是初选未命中的 ${Math.round(theoreticalSwitchWinRate(gameState.doorCount) * 100)}%。`;
    } else if (gameState.stage === "result") {
        const choice = strategyLabel(gameState.lastStrategy);
        hintText.textContent = `本轮已记录：${choice}，${gameState.lastWon ? "赢得汽车" : "未赢得汽车"}。`;
        feedbackText.textContent = gameState.feedbackMessage;
    }
}

function selectDoor(index) {
    if (gameState.stage !== "pick") {
        return;
    }

    const revealState = getRevealState(index);
    gameState.selectedDoor = index;
    gameState.initialChoice = index;
    gameState.openedDoor = revealState.openedDoor;
    gameState.openedDoors = [...revealState.openedDoors];
    gameState.switchTarget = revealState.switchTarget;
    gameState.stage = "decision";
    renderRound();
}

function buildTrialFeedback(record) {
    const switchSummary = strategyStats("switch");
    const staySummary = strategyStats("stay");
    const stayPct = Math.round(record.theoreticalStayWinRate * 100);
    const switchPct = Math.round(record.theoreticalSwitchWinRate * 100);
    const observedSwitch = formatRatio(switchSummary.wins, switchSummary.total);
    const observedStay = formatRatio(staySummary.wins, staySummary.total);
    const resultPhrase = record.won ? "本轮赢了" : "本轮输了";

    if (record.feedbackLevel === "high") {
        return `${resultPhrase}，但训练信号不是单题对错。${record.doorCount} 门下坚持长期约 ${stayPct}%，切换长期约 ${switchPct}%。当前累计：切换 ${observedSwitch}，坚持 ${observedStay}。`;
    }

    if (record.feedbackLevel === "medium") {
        return `${resultPhrase}。请把这轮放进累计样本看：切换理论 ${switchPct}%，坚持理论 ${stayPct}%；当前切换 ${observedSwitch}，坚持 ${observedStay}。`;
    }

    return `${resultPhrase}。弱提示只给校准锚点：切换理论 ${switchPct}%，坚持理论 ${stayPct}%，继续看累计差异。`;
}

function resolveRound(strategy) {
    if (gameState.stage !== "decision") {
        return;
    }

    if (gameState.lockedStrategy && strategy !== gameState.lockedStrategy) {
        return;
    }

    const finalChoice = strategy === "switch" ? gameState.switchTarget : gameState.initialChoice;
    const finishedAt = new Date();
    const won = finalChoice === gameState.prizeDoor;

    gameState.selectedDoor = finalChoice;
    gameState.finalChoice = finalChoice;
    gameState.stage = "result";
    gameState.completed = true;
    gameState.lastStrategy = strategy;
    gameState.lastWon = won;

    stats.rounds += 1;
    if (won) {
        stats.wins += 1;
    }
    if (strategy === "switch") {
        stats.switchTotal += 1;
        if (won) {
            stats.switchWins += 1;
        }
    } else {
        stats.stayTotal += 1;
        if (won) {
            stats.stayWins += 1;
        }
    }

    const record = {
        index: gameState.index,
        trialId: gameState.trialId,
        initialChoice: gameState.initialChoice,
        prizeDoor: gameState.prizeDoor,
        openedDoor: gameState.openedDoor,
        openedDoors: [...gameState.openedDoors],
        finalChoice,
        strategy,
        switched: strategy === "switch",
        won,
        blockIndex: gameState.blockIndex,
        blockTrialIndex: gameState.blockTrialIndex,
        condition: gameState.condition,
        conditionLabel: gameState.conditionLabel,
        feedbackLevel: gameState.feedbackLevel,
        doorCount: gameState.doorCount,
        lockedStrategy: gameState.lockedStrategy || "free",
        switchTarget: gameState.switchTarget,
        theoreticalStayWinRate: roundTo(theoreticalStayWinRate(gameState.doorCount)),
        theoreticalSwitchWinRate: roundTo(theoreticalSwitchWinRate(gameState.doorCount)),
        rtMs: Math.max(0, finishedAt.getTime() - gameState.startedAtMs),
        startedAt: gameState.startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        initialDoor: gameState.initialChoice,
        revealedDoor: gameState.openedDoor,
        finalDoor: finalChoice,
        win: won
    };

    responses.push(record);
    gameState.feedbackMessage = buildTrialFeedback(record);
    gameState.feedbackClass = won ? "win" : "loss";

    updateStatsView();
    renderRound();
}

function nextRound() {
    if (!gameState || !gameState.completed) {
        return;
    }

    if (trialIndex >= sessionTrials.length - 1) {
        finish();
        return;
    }

    trialIndex += 1;
    gameState = createRound(sessionTrials[trialIndex]);
    renderRound();
}

function strategyStats(strategy, items = responses) {
    const filtered = items.filter((item) => item.strategy === strategy);
    const wins = filtered.filter((item) => item.won).length;

    return {
        total: filtered.length,
        wins,
        losses: filtered.length - wins,
        winRate: filtered.length === 0 ? 0 : roundTo(wins / filtered.length),
        winRatePct: percentage(wins, filtered.length)
    };
}

function summarizeBlock(block, blockIndex) {
    const items = responses.filter((item) => item.blockIndex === blockIndex);
    const wins = items.filter((item) => item.won).length;
    const switchItems = strategyStats("switch", items);
    const stayItems = strategyStats("stay", items);

    return {
        blockIndex,
        condition: block.condition,
        conditionLabel: block.conditionLabel,
        doorCount: block.doorCount,
        feedbackLevel: block.feedbackLevel,
        totalTrials: items.length,
        wins,
        winRate: items.length === 0 ? 0 : roundTo(wins / items.length),
        switchRate: items.length === 0 ? 0 : roundTo(switchItems.total / items.length),
        switchWinRate: switchItems.winRate,
        stayWinRate: stayItems.winRate
    };
}

function switchUseRateFor(items) {
    return items.length === 0 ? 0 : roundTo(items.filter((item) => item.strategy === "switch").length / items.length);
}

function computeStrategyLearningTrend(items) {
    const freeItems = items.filter((item) => item.lockedStrategy === "free");

    if (freeItems.length < 2) {
        return {
            code: "insufficient-free-choice",
            label: "自由选择样本不足",
            freeTrials: freeItems.length,
            firstHalfSwitchRate: null,
            secondHalfSwitchRate: null,
            deltaSwitchRate: null
        };
    }

    const midpoint = Math.ceil(freeItems.length / 2);
    const firstHalf = freeItems.slice(0, midpoint);
    const secondHalf = freeItems.slice(midpoint);
    const firstHalfSwitchRate = switchUseRateFor(firstHalf);
    const secondHalfSwitchRate = switchUseRateFor(secondHalf);
    const deltaSwitchRate = roundTo(secondHalfSwitchRate - firstHalfSwitchRate);
    let code = "mixed-strategy";
    let label = "自由选择仍在混合试探";

    if (secondHalfSwitchRate >= 0.75 && deltaSwitchRate >= 0.1) {
        code = "improving-switch-adoption";
        label = "自由选择后段更偏向切换";
    } else if (secondHalfSwitchRate >= 0.75) {
        code = "stable-switch-leaning";
        label = "自由选择已稳定偏向切换";
    } else if (deltaSwitchRate >= 0.15) {
        code = "rising-switch-adoption";
        label = "切换采用率上升";
    } else if (secondHalfSwitchRate <= 0.4) {
        code = "persistent-stay-bias";
        label = "后段仍明显偏向坚持";
    }

    return {
        code,
        label,
        freeTrials: freeItems.length,
        firstHalfSwitchRate,
        secondHalfSwitchRate,
        deltaSwitchRate
    };
}

function computeBiasPattern(items, switchSummary, staySummary) {
    const freeItems = items.filter((item) => item.lockedStrategy === "free");
    const freeSwitchRate = switchUseRateFor(freeItems);
    let code = "mixed-strategy";
    let label = "策略混合，仍需更多自由选择样本";

    if (freeItems.length === 0) {
        code = "no-free-choice";
        label = "没有自由选择样本";
    } else if (freeSwitchRate < 0.4) {
        code = "stay-bias";
        label = "坚持偏误：自由选择中仍倾向保留初选";
    } else if (freeSwitchRate >= 0.75) {
        code = "calibrated-switch";
        label = "策略校准：自由选择中已明显偏向切换";
    }

    const observedNote = (
        switchSummary.total >= 4
        && staySummary.total >= 4
        && staySummary.winRate > switchSummary.winRate
    )
        ? "本次小样本的观察胜率暂时有反向波动，应继续按理论概率复测。"
        : "观察胜率与理论方向可继续用更多轮次校准。";

    return {
        code,
        label,
        freeTrials: freeItems.length,
        freeSwitchRate,
        observedNote
    };
}

function recommendNextParameters(trend, biasPattern) {
    if (biasPattern.code === "stay-bias" || trend.code === "persistent-stay-bias") {
        return {
            doorCount: 3,
            feedbackLevel: "high",
            blockPlan: ["forced-switch-classic", "free-choice-classic"],
            focus: "回到经典 3 门，增加切换条件反馈"
        };
    }

    if (biasPattern.code === "calibrated-switch" && trend.secondHalfSwitchRate >= 0.75) {
        return {
            doorCount: 5,
            feedbackLevel: "low",
            blockPlan: ["free-choice-expanded"],
            focus: "提高门数并降低提示，检验策略迁移"
        };
    }

    return {
        doorCount: 4,
        feedbackLevel: "medium",
        blockPlan: ["forced-switch-classic", "free-choice-expanded"],
        focus: "保留对照 block，再加入参数变化"
    };
}

function buildSessionFeedback(trend, biasPattern, nextParameters) {
    const switchSummary = strategyStats("switch");
    const staySummary = strategyStats("stay");

    return `本次训练重点是策略校准：切换累计 ${formatRatio(switchSummary.wins, switchSummary.total)}，坚持累计 ${formatRatio(staySummary.wins, staySummary.total)}。${trend.label}；${biasPattern.label}。下一轮建议：${nextParameters.focus}。`;
}

function finish() {
    if (sessionSaved) {
        resultModal.style.display = "flex";
        return;
    }

    const finishedAt = new Date();
    const durationMs = sessionStartedAt ? finishedAt.getTime() - sessionStartedAt.getTime() : 0;
    const total = responses.length;
    const winRate = total === 0 ? 0 : roundTo(stats.wins / total);
    const winRatePct = percentage(stats.wins, total);
    const meanRtMs = Math.round(responses.reduce((sum, item) => sum + item.rtMs, 0) / Math.max(1, total));
    const switchSummary = strategyStats("switch");
    const staySummary = strategyStats("stay");
    const switchRate = total === 0 ? 0 : roundTo(stats.switchTotal / total);
    const stayRate = total === 0 ? 0 : roundTo(stats.stayTotal / total);
    const blockSummaries = BLOCK_CONFIGS.map((block, index) => summarizeBlock(block, index));
    const strategyLearningTrend = computeStrategyLearningTrend(responses);
    const biasPattern = computeBiasPattern(responses, switchSummary, staySummary);
    const nextParameters = recommendNextParameters(strategyLearningTrend, biasPattern);
    const trialOrder = sessionTrials.map((item) => item.id);

    document.getElementById("result-win").textContent = formatRatio(stats.wins, total);
    document.getElementById("result-switch").textContent = formatRatio(switchSummary.wins, switchSummary.total);
    document.getElementById("result-stay").textContent = formatRatio(staySummary.wins, staySummary.total);
    document.getElementById("result-strategy").textContent = `切换 ${stats.switchTotal} / 坚持 ${stats.stayTotal}`;
    document.getElementById("result-switch-rate").textContent = `${Math.round(switchRate * 100)}%`;
    document.getElementById("result-trend").textContent = strategyLearningTrend.label;
    document.getElementById("result-bias").textContent = biasPattern.label;
    document.getElementById("result-next").textContent = `${nextParameters.doorCount} 门 · ${feedbackLevelLabel(nextParameters.feedbackLevel)}`;
    document.getElementById("result-text").textContent = buildSessionFeedback(strategyLearningTrend, biasPattern, nextParameters);

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            moduleId: "monty-hall",
            gameId: "monty-hall",
            gameName: "蒙提霍尔问题",
            startedAt: sessionStartedAt || finishedAt,
            finishedAt,
            durationMs,
            score: winRatePct,
            summary: {
                totalTrials: total,
                completedTrials: total,
                correctCount: stats.wins,
                winCount: stats.wins,
                accuracy: winRate,
                winRate,
                winRatePct,
                meanRtMs,
                switchRate,
                stayRate,
                switchWinRate: switchSummary.winRate,
                stayWinRate: staySummary.winRate,
                strategyLearningTrend,
                biasPattern,
                nextParameters,
                strategy: {
                    switchCount: stats.switchTotal,
                    stayCount: stats.stayTotal,
                    switchRate,
                    stayRate,
                    dominant: stats.switchTotal >= stats.stayTotal ? "switch" : "stay"
                },
                switch: switchSummary,
                stay: staySummary,
                blocks: blockSummaries,
                parameters: {
                    blockCount: BLOCK_CONFIGS.length,
                    doorCounts: [...new Set(BLOCK_CONFIGS.map((block) => block.doorCount))],
                    feedbackLevels: [...new Set(BLOCK_CONFIGS.map((block) => block.feedbackLevel))],
                    classicDoorCountRetained: BLOCK_CONFIGS.some((block) => block.doorCount === 3)
                },
                seed: sessionSeed,
                sessionSeed,
                contentVersion: CONTENT_VERSION,
                trialOrder
            },
            trials: responses.map((item) => ({ ...item })),
            metrics: {
                wins: `${stats.wins}/${total}`,
                winRate: `${winRatePct}%`,
                switchRate: `${Math.round(switchRate * 100)}%`,
                switchWinRate: `${switchSummary.winRatePct}%`,
                stayWinRate: `${staySummary.winRatePct}%`,
                strategyLearningTrend: strategyLearningTrend.label,
                biasPattern: biasPattern.label,
                nextParameters: `${nextParameters.doorCount}门/${feedbackLevelLabel(nextParameters.feedbackLevel)}`,
                strategy: `switch:${stats.switchTotal}, stay:${stats.stayTotal}`,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ["probability", "conditional-probability", "monty-hall", "strategy-training"]
        });
    }

    sessionSaved = true;
    panel.style.display = "none";
    resultModal.style.display = "flex";
}

stayBtn.addEventListener("click", () => resolveRound("stay"));
switchBtn.addEventListener("click", () => resolveRound("switch"));
nextBtn.addEventListener("click", nextRound);

window.startGame = startGame;
