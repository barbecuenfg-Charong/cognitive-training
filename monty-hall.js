const TRIAL_COUNT = 12;
const CONTENT_VERSION = "monty-hall-v2-seeded-session";

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
const stayBtn = document.getElementById("stay-btn");
const switchBtn = document.getElementById("switch-btn");
const nextBtn = document.getElementById("next-btn");
const resultModal = document.getElementById("result-modal");

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

function randomDoor(rng) {
    return Math.floor(rng() * 3);
}

function roundTo(value, digits = 4) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function percentage(wins, total) {
    return total === 0 ? 0 : Math.round((wins / total) * 100);
}

function createTrial(index, rng) {
    const prizeDoor = randomDoor(rng);
    const revealByInitialDoor = {};

    [0, 1, 2].forEach((selectedDoor) => {
        const candidates = [0, 1, 2].filter((door) => door !== selectedDoor && door !== prizeDoor);
        revealByInitialDoor[selectedDoor] = candidates[Math.floor(rng() * candidates.length)];
    });

    return {
        id: `mh-${String(index + 1).padStart(2, "0")}`,
        index,
        prizeDoor,
        revealByInitialDoor
    };
}

function buildSessionTrials() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("monty-hall") : `monty-hall-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    sessionTrials = [];

    for (let i = 0; i < TRIAL_COUNT; i += 1) {
        sessionTrials.push(createTrial(i, rng));
    }
}

function createRound(trial) {
    return {
        stage: "pick",
        trialId: trial.id,
        index: trial.index,
        selectedDoor: null,
        initialDoor: null,
        prizeDoor: trial.prizeDoor,
        revealedDoor: null,
        finalDoor: null,
        revealByInitialDoor: { ...trial.revealByInitialDoor },
        completed: false,
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

function getHostRevealDoor(selectedDoor, prizeDoor) {
    if (gameState && Number.isInteger(gameState.revealByInitialDoor[selectedDoor])) {
        return gameState.revealByInitialDoor[selectedDoor];
    }

    const candidates = [0, 1, 2].filter((door) => door !== selectedDoor && door !== prizeDoor);
    return candidates[0];
}

function updateStatsView() {
    const switchRate = percentage(stats.switchWins, stats.switchTotal);
    const stayRate = percentage(stats.stayWins, stats.stayTotal);
    const winRate = percentage(stats.wins, stats.rounds);

    document.getElementById("switch-rate").textContent = `${switchRate}%`;
    document.getElementById("stay-rate").textContent = `${stayRate}%`;
    document.getElementById("win-rate").textContent = `${winRate}%`;
    document.getElementById("round-count").textContent = `${stats.rounds}/${TRIAL_COUNT}`;
}

function renderRound() {
    doorsContainer.innerHTML = "";

    for (let i = 0; i < 3; i += 1) {
        const door = document.createElement("button");
        door.className = "mh-door";
        door.type = "button";
        door.textContent = `门 ${i + 1}`;

        if (gameState.selectedDoor === i) {
            door.classList.add("selected");
        }

        if (gameState.revealedDoor === i) {
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

    stayBtn.disabled = gameState.stage !== "decision";
    switchBtn.disabled = gameState.stage !== "decision";
    nextBtn.style.display = gameState.completed ? "inline-flex" : "none";
    nextBtn.textContent = trialIndex >= sessionTrials.length - 1 ? "查看结果" : "下一回合";

    if (gameState.stage === "pick") {
        hintText.textContent = `第 ${trialIndex + 1} / ${TRIAL_COUNT} 回合：请选择一扇门。`;
    } else if (gameState.stage === "decision") {
        hintText.textContent = `主持人打开了门 ${gameState.revealedDoor + 1}（山羊），请选择“坚持”或“切换”。`;
    }
}

function selectDoor(index) {
    if (gameState.stage !== "pick") {
        return;
    }
    gameState.selectedDoor = index;
    gameState.initialDoor = index;
    gameState.revealedDoor = getHostRevealDoor(index, gameState.prizeDoor);
    gameState.stage = "decision";
    renderRound();
}

function resolveRound(strategy) {
    if (gameState.stage !== "decision") {
        return;
    }

    let finalDoor = gameState.initialDoor;
    if (strategy === "switch") {
        finalDoor = [0, 1, 2].find((door) => door !== gameState.initialDoor && door !== gameState.revealedDoor);
    }

    const finishedAt = new Date();
    const isWin = finalDoor === gameState.prizeDoor;
    gameState.selectedDoor = finalDoor;
    gameState.finalDoor = finalDoor;
    gameState.stage = "result";
    gameState.completed = true;

    stats.rounds += 1;
    if (isWin) {
        stats.wins += 1;
    }
    if (strategy === "switch") {
        stats.switchTotal += 1;
        if (isWin) {
            stats.switchWins += 1;
        }
    } else {
        stats.stayTotal += 1;
        if (isWin) {
            stats.stayWins += 1;
        }
    }

    responses.push({
        index: gameState.index,
        trialId: gameState.trialId,
        initialDoor: gameState.initialDoor,
        revealedDoor: gameState.revealedDoor,
        finalDoor,
        prizeDoor: gameState.prizeDoor,
        strategy,
        switched: strategy === "switch",
        win: isWin,
        rtMs: Math.max(0, finishedAt.getTime() - gameState.startedAtMs),
        startedAt: gameState.startedAt.toISOString(),
        finishedAt: finishedAt.toISOString()
    });

    updateStatsView();

    hintText.textContent = isWin
        ? `你${strategy === "switch" ? "选择了切换" : "选择了坚持"}，恭喜获得汽车！`
        : `你${strategy === "switch" ? "选择了切换" : "选择了坚持"}，结果是山羊。`;

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

function strategyStats(strategy) {
    const total = strategy === "switch" ? stats.switchTotal : stats.stayTotal;
    const wins = strategy === "switch" ? stats.switchWins : stats.stayWins;

    return {
        total,
        wins,
        losses: total - wins,
        winRate: total === 0 ? 0 : roundTo(wins / total),
        winRatePct: percentage(wins, total)
    };
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
    const switchUseRate = total === 0 ? 0 : roundTo(stats.switchTotal / total);
    const stayUseRate = total === 0 ? 0 : roundTo(stats.stayTotal / total);
    const trialOrder = sessionTrials.map((item) => item.id);

    document.getElementById("result-win").textContent = `${stats.wins}/${total}（${winRatePct}%）`;
    document.getElementById("result-switch").textContent = `${switchSummary.wins}/${switchSummary.total}（${switchSummary.winRatePct}%）`;
    document.getElementById("result-stay").textContent = `${staySummary.wins}/${staySummary.total}（${staySummary.winRatePct}%）`;
    document.getElementById("result-strategy").textContent = `切换 ${stats.switchTotal} / 坚持 ${stats.stayTotal}`;

    let message = "12 轮样例已完成。长期看，切换会把初选不中的概率转化为获胜机会。";
    if (stats.stayTotal > stats.switchTotal) {
        message = "你这次更多选择坚持。蒙提霍尔问题中，固定切换的长期胜率约为坚持的两倍。";
    } else if (stats.switchTotal === TRIAL_COUNT) {
        message = "你这次始终选择切换。单次结果会波动，但长期策略优势来自主持人打开羊门后的信息结构。";
    }
    document.getElementById("result-text").textContent = message;

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
                strategy: {
                    switchCount: stats.switchTotal,
                    stayCount: stats.stayTotal,
                    switchRate: switchUseRate,
                    stayRate: stayUseRate,
                    dominant: stats.switchTotal >= stats.stayTotal ? "switch" : "stay"
                },
                switch: switchSummary,
                stay: staySummary,
                seed: sessionSeed,
                sessionSeed,
                contentVersion: CONTENT_VERSION,
                trialOrder
            },
            trials: responses.map((item) => ({ ...item })),
            metrics: {
                wins: `${stats.wins}/${total}`,
                winRate: `${winRatePct}%`,
                switchWinRate: `${switchSummary.winRatePct}%`,
                stayWinRate: `${staySummary.winRatePct}%`,
                strategy: `switch:${stats.switchTotal}, stay:${stats.stayTotal}`,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ["probability", "monty-hall", "decision"]
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
