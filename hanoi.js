const MODULE_ID = "hanoi";
const GAME_NAME = "河内塔";
const CONTENT_VERSION = "hanoi-planning-metrics-v1";
const START_PEG = 0;
const SPARE_PEG = 1;
const TARGET_PEG = 2;

let pegs = [[], [], []];
let selectedPeg = null;
let diskCount = 4;
let moves = 0;
let timer = null;
let elapsed = 0;
let sessionStartedAt = null;
let sessionStartMs = 0;
let sessionSeed = "";
let sessionSaved = false;
let moveHistory = [];
let redoHistory = [];
let trials = [];
let stateVisitCounts = new Map();
let stateTimeline = [];
let optimalSequence = [];
let totalMoveActions = 0;
let illegalMoves = 0;
let undoCount = 0;
let redoCount = 0;
let directBacktrackCount = 0;
let repeatedStateCount = 0;
let loopCount = 0;
let optimalPathDeviationCount = 0;
let firstMoveLatencyMs = null;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("hanoi-panel");
const resultModal = document.getElementById("result-modal");
const hint = document.getElementById("hint");
const diskCountSelect = document.getElementById("disk-count");
const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = String(value);
    }
}

function optimalMoves(n) {
    return Math.pow(2, n) - 1;
}

function buildOptimalMoveSequence(n, from = START_PEG, to = TARGET_PEG, spare = SPARE_PEG, result = []) {
    if (n <= 0) {
        return result;
    }

    buildOptimalMoveSequence(n - 1, from, spare, to, result);
    result.push({ disk: n, from, to });
    buildOptimalMoveSequence(n - 1, spare, to, from, result);
    return result;
}

function randomToken() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const bytes = new Uint32Array(2);
        window.crypto.getRandomValues(bytes);
        return `${bytes[0].toString(36)}${bytes[1].toString(36)}`;
    }
    return Math.floor(Math.random() * 1e9).toString(36);
}

function createSessionSeed() {
    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get("seed");
    if (urlSeed && urlSeed.trim()) {
        return urlSeed.trim();
    }
    if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === "function") {
        return window.SeededRandom.createSessionSeed(MODULE_ID);
    }
    return `${MODULE_ID}-${Date.now().toString(36)}-${randomToken()}`;
}

function elapsedMs() {
    if (!sessionStartMs) {
        return 0;
    }
    return Date.now() - sessionStartMs;
}

function stateSnapshot() {
    return pegs.map((peg) => peg.slice());
}

function stateSignature() {
    return pegs.map((peg) => peg.join("-")).join("|");
}

function getPuzzleConfig() {
    return {
        diskCount,
        startPeg: START_PEG,
        sparePeg: SPARE_PEG,
        targetPeg: TARGET_PEG,
        ruleSet: "classic-hanoi",
        optimalMoves: optimalMoves(diskCount)
    };
}

function resetStateTracking() {
    const initialState = stateSignature();
    stateVisitCounts = new Map([[initialState, 1]]);
    stateTimeline = [initialState];
}

function registerStateVisit(signature) {
    const previousVisits = stateVisitCounts.get(signature) || 0;
    const repeatedState = previousVisits > 0;
    const looped = stateTimeline.length >= 2 && stateTimeline[stateTimeline.length - 2] === signature;

    if (repeatedState) {
        repeatedStateCount += 1;
    }
    if (looped) {
        loopCount += 1;
    }

    stateVisitCounts.set(signature, previousVisits + 1);
    stateTimeline.push(signature);

    return {
        repeatedState,
        looped,
        visitCount: previousVisits + 1
    };
}

function recordAction(record) {
    const nowMs = elapsedMs();
    trials.push({
        index: trials.length,
        timestamp: new Date().toISOString(),
        elapsedMs: nowMs,
        elapsedSec: Math.round(nowMs / 1000),
        diskCount,
        optimalMoves: optimalMoves(diskCount),
        pathMoves: moves,
        actualMoves: totalMoveActions,
        excessMoves: Math.max(0, totalMoveActions - optimalMoves(diskCount)),
        illegalMoves,
        undoCount,
        redoCount,
        backtrackCount: undoCount + directBacktrackCount,
        directBacktrackCount,
        firstMoveLatencyMs,
        repeatedStateCount,
        loopCount,
        ...record
    });
}

function recordInvalidMove(from, to, reason, beforeState, beforeSignature, countAsIllegal) {
    if (countAsIllegal) {
        illegalMoves += 1;
    }

    recordAction({
        action: countAsIllegal ? "illegal_move" : "failed_redo",
        legal: false,
        fromPeg: from,
        toPeg: to,
        reason,
        stateBefore: beforeState,
        stateAfter: stateSnapshot(),
        stateBeforeKey: beforeSignature,
        stateAfterKey: stateSignature()
    });
}

function updateBoard() {
    setText("moves", moves);
    setText("optimal", optimalMoves(diskCount));
    setText("time", `${elapsed}s`);
    setText("illegal-count", illegalMoves);
    setText("backtrack-count", undoCount + directBacktrackCount);
    undoBtn.disabled = moveHistory.length === 0;
    redoBtn.disabled = redoHistory.length === 0;

    const pegEls = document.querySelectorAll(".peg");
    pegEls.forEach((pegEl, idx) => {
        pegEl.innerHTML = "";
        pegEl.classList.toggle("selected", selectedPeg === idx);

        pegs[idx].forEach((size) => {
            const disk = document.createElement("div");
            disk.className = "disk";
            disk.style.width = `${40 + size * 18}px`;
            disk.style.background = `hsl(${20 + size * 32}, 70%, 55%)`;
            pegEl.appendChild(disk);
        });
    });
}

function resetGame() {
    diskCount = Number(diskCountSelect.value);
    pegs = [[], [], []];
    for (let i = diskCount; i >= 1; i -= 1) {
        pegs[START_PEG].push(i);
    }
    selectedPeg = null;
    moves = 0;
    elapsed = 0;
    moveHistory = [];
    redoHistory = [];
    trials = [];
    totalMoveActions = 0;
    illegalMoves = 0;
    undoCount = 0;
    redoCount = 0;
    directBacktrackCount = 0;
    repeatedStateCount = 0;
    loopCount = 0;
    optimalPathDeviationCount = 0;
    firstMoveLatencyMs = null;
    optimalSequence = buildOptimalMoveSequence(diskCount);
    sessionStartedAt = new Date();
    sessionStartMs = Date.now();
    sessionSeed = createSessionSeed();
    sessionSaved = false;
    resetStateTracking();
    hint.textContent = "点击起始柱，再点击目标柱。";
    resultModal.style.display = "none";

    if (timer) {
        clearInterval(timer);
    }
    timer = setInterval(() => {
        elapsed += 1;
        setText("time", `${elapsed}s`);
    }, 1000);

    updateBoard();
}

function topDisk(pegIndex) {
    const peg = pegs[pegIndex];
    if (peg.length === 0) {
        return null;
    }
    return peg[peg.length - 1];
}

function normalizeMoveOptions(options) {
    if (typeof options === "boolean") {
        return {
            trackHistory: options,
            actionType: options ? "move" : "redo",
            countIllegal: options
        };
    }

    const normalized = options || {};
    return {
        trackHistory: normalized.trackHistory !== false,
        actionType: normalized.actionType || "move",
        countIllegal: normalized.countIllegal !== false
    };
}

function tryMove(from, to, options = {}) {
    const settings = normalizeMoveOptions(options);
    const beforeState = stateSnapshot();
    const beforeSignature = stateSignature();
    const fromDisk = topDisk(from);
    if (fromDisk === null) {
        hint.textContent = "起始柱没有可移动的圆盘。";
        recordInvalidMove(from, to, "empty_source", beforeState, beforeSignature, settings.countIllegal);
        return false;
    }
    const toDisk = topDisk(to);
    if (toDisk !== null && toDisk < fromDisk) {
        hint.textContent = "不能把大盘放在小盘上。";
        recordInvalidMove(from, to, "larger_on_smaller", beforeState, beforeSignature, settings.countIllegal);
        return false;
    }

    const expectedMove = optimalSequence[moves] || null;
    const matchesOptimalNextMove = Boolean(
        expectedMove
        && expectedMove.from === from
        && expectedMove.to === to
        && expectedMove.disk === fromDisk
    );
    const previousMove = moveHistory[moveHistory.length - 1] || null;
    const directBacktrack = settings.actionType === "move"
        && previousMove
        && previousMove.from === to
        && previousMove.to === from
        && previousMove.disk === fromDisk;

    pegs[from].pop();
    pegs[to].push(fromDisk);
    if (trackableAction(settings.actionType)) {
        totalMoveActions += 1;
    }
    if (settings.actionType === "redo") {
        redoCount += 1;
    }
    if (directBacktrack) {
        directBacktrackCount += 1;
    }
    if (!matchesOptimalNextMove && trackableAction(settings.actionType)) {
        optimalPathDeviationCount += 1;
    }
    if (firstMoveLatencyMs === null && trackableAction(settings.actionType)) {
        firstMoveLatencyMs = elapsedMs();
    }
    if (settings.trackHistory) {
        moveHistory.push({ from, to, disk: fromDisk });
        redoHistory = [];
    }
    moves += 1;

    const afterSignature = stateSignature();
    const stateInfo = registerStateVisit(afterSignature);
    recordAction({
        action: settings.actionType,
        legal: true,
        fromPeg: from,
        toPeg: to,
        disk: fromDisk,
        matchesOptimalNextMove,
        optimalMoveIndex: moves - 1,
        expectedMove,
        directBacktrack,
        repeatedState: stateInfo.repeatedState,
        loop: stateInfo.looped,
        stateVisitCount: stateInfo.visitCount,
        stateBefore: beforeState,
        stateAfter: stateSnapshot(),
        stateBeforeKey: beforeSignature,
        stateAfterKey: afterSignature
    });

    hint.textContent = "移动成功。";
    return true;
}

function trackableAction(actionType) {
    return actionType === "move" || actionType === "redo";
}

function undoMove() {
    if (moveHistory.length === 0) {
        hint.textContent = "没有可撤销的步骤。";
        return;
    }

    const lastMove = moveHistory.pop();
    const topOnTo = topDisk(lastMove.to);
    if (topOnTo !== lastMove.disk) {
        hint.textContent = "当前状态无法执行撤销。";
        moveHistory.push(lastMove);
        return;
    }

    const beforeState = stateSnapshot();
    const beforeSignature = stateSignature();
    pegs[lastMove.to].pop();
    pegs[lastMove.from].push(lastMove.disk);
    moves = Math.max(0, moves - 1);
    undoCount += 1;
    redoHistory.push(lastMove);
    selectedPeg = null;
    resultModal.style.display = "none";

    const afterSignature = stateSignature();
    const stateInfo = registerStateVisit(afterSignature);
    recordAction({
        action: "undo",
        legal: true,
        fromPeg: lastMove.to,
        toPeg: lastMove.from,
        originalFromPeg: lastMove.from,
        originalToPeg: lastMove.to,
        disk: lastMove.disk,
        repeatedState: stateInfo.repeatedState,
        loop: stateInfo.looped,
        stateVisitCount: stateInfo.visitCount,
        stateBefore: beforeState,
        stateAfter: stateSnapshot(),
        stateBeforeKey: beforeSignature,
        stateAfterKey: afterSignature
    });

    hint.textContent = "已撤销一步。";
    updateBoard();
}

function redoMove() {
    if (redoHistory.length === 0) {
        hint.textContent = "没有可重做的步骤。";
        return;
    }

    const move = redoHistory.pop();
    const moved = tryMove(move.from, move.to, {
        trackHistory: false,
        actionType: "redo",
        countIllegal: false
    });
    if (!moved) {
        redoHistory.push(move);
        hint.textContent = "当前状态无法执行重做。";
        updateBoard();
        return;
    }

    moveHistory.push(move);
    selectedPeg = null;
    hint.textContent = "已重做一步。";
    updateBoard();

    if (pegs[TARGET_PEG].length === diskCount) {
        finish();
    }
}

function onPegClick(pegIndex) {
    if (selectedPeg === null) {
        selectedPeg = pegIndex;
        updateBoard();
        return;
    }
    if (selectedPeg === pegIndex) {
        selectedPeg = null;
        updateBoard();
        return;
    }

    const moved = tryMove(selectedPeg, pegIndex);
    selectedPeg = null;
    updateBoard();

    if (moved && pegs[TARGET_PEG].length === diskCount) {
        finish();
    }
}

function ratio(count, total) {
    return total === 0 ? 0 : Math.round((count / total) * 1000) / 1000;
}

function formatLatency(ms) {
    if (!Number.isFinite(ms)) {
        return "--";
    }
    if (ms < 1000) {
        return `${ms} ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
}

function calculateSummary(finishedAt) {
    const optimal = optimalMoves(diskCount);
    const actualMoves = totalMoveActions;
    const finalPathMoves = moves;
    const excessMoves = Math.max(0, actualMoves - optimal);
    const finalPathExcessMoves = Math.max(0, finalPathMoves - optimal);
    const backtrackCount = undoCount + directBacktrackCount;
    const actionCount = actualMoves + undoCount + illegalMoves;
    const planningEfficiency = Math.min(100, Math.round((optimal / Math.max(actualMoves, 1)) * 100));
    const finalPathEfficiency = Math.min(100, Math.round((optimal / Math.max(finalPathMoves, 1)) * 100));

    return {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        puzzleConfig: getPuzzleConfig(),
        completed: true,
        diskCount,
        optimalMoves: optimal,
        actualMoves,
        finalPathMoves,
        moves: actualMoves,
        excessMoves,
        finalPathExcessMoves,
        illegalMoves,
        undoCount,
        redoCount,
        directBacktrackCount,
        backtrackCount,
        firstMoveLatencyMs,
        firstMoveLatencySec: Number.isFinite(firstMoveLatencyMs) ? Math.round(firstMoveLatencyMs / 100) / 10 : null,
        repeatedStateCount,
        loopCount,
        uniqueStateCount: stateVisitCounts.size,
        stateVisitCount: stateTimeline.length,
        optimalPathDeviationCount,
        optimalPathMatchRate: ratio(Math.max(0, actualMoves - optimalPathDeviationCount), actualMoves),
        illegalOperationRate: ratio(illegalMoves, actionCount),
        repeatedStateRate: ratio(repeatedStateCount, Math.max(0, stateTimeline.length - 1)),
        planningEfficiency,
        finalPathEfficiency,
        durationMs: finishedAt.getTime() - (sessionStartedAt || finishedAt).getTime(),
        timeSec: elapsed
    };
}

function buildResultFeedback(summary) {
    const feedback = [
        `计划效率 ${summary.planningEfficiency}%：实际移动 ${summary.actualMoves} 步，最优 ${summary.optimalMoves} 步，超额 ${summary.excessMoves} 步。`
    ];

    if (summary.excessMoves === 0 && summary.backtrackCount === 0 && summary.illegalMoves === 0) {
        feedback.push("本轮保持最优路径，没有回退或非法尝试。");
    } else if (summary.excessMoves <= Math.max(1, Math.floor(summary.optimalMoves * 0.2))) {
        feedback.push("整体接近最优，但仍有少量探索成本。");
    } else {
        feedback.push("移动明显超过最优步数，建议下一轮先在心里完成子目标顺序再开始移动。");
    }

    if (summary.backtrackCount >= 3 || summary.backtrackCount > summary.optimalMoves * 0.2) {
        feedback.push(`回退/反向移动 ${summary.backtrackCount} 次偏多，说明中途多次修正计划。`);
    } else if (summary.backtrackCount > 0) {
        feedback.push(`回退/反向移动 ${summary.backtrackCount} 次，修正成本可控。`);
    } else {
        feedback.push("没有记录到回退动作。");
    }

    if (summary.optimalPathDeviationCount > 0) {
        feedback.push(`有 ${summary.optimalPathDeviationCount} 次移动偏离下一步最优路径。`);
    } else {
        feedback.push("每次实际移动都贴合下一步最优路径。");
    }

    if (summary.illegalMoves > 0 || summary.repeatedStateCount > 0) {
        feedback.push(`非法操作 ${summary.illegalMoves} 次，重复状态 ${summary.repeatedStateCount} 次，循环 ${summary.loopCount} 次。`);
    }

    return feedback.join("");
}

function finish() {
    if (timer) {
        clearInterval(timer);
    }

    const finishedAt = new Date();
    const summary = calculateSummary(finishedAt);
    const feedback = buildResultFeedback(summary);

    setText("result-moves", summary.actualMoves);
    setText("result-optimal", summary.optimalMoves);
    setText("result-excess", summary.excessMoves);
    setText("result-path-moves", summary.finalPathMoves);
    setText("result-illegal", summary.illegalMoves);
    setText("result-backtrack", summary.backtrackCount);
    setText("result-first-latency", formatLatency(summary.firstMoveLatencyMs));
    setText("result-repeat", `${summary.repeatedStateCount}/${summary.loopCount}`);
    setText("result-efficiency", `${summary.planningEfficiency}%`);
    setText("result-feedback", feedback);

    if (!sessionSaved && window.TrainingResults && typeof window.TrainingResults.saveSession === "function") {
        window.TrainingResults.saveSession({
            moduleId: MODULE_ID,
            gameId: MODULE_ID,
            gameName: GAME_NAME,
            startedAt: sessionStartedAt || finishedAt,
            finishedAt,
            durationMs: summary.durationMs,
            score: summary.planningEfficiency,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials,
            metrics: {
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                puzzleConfig: summary.puzzleConfig,
                disks: diskCount,
                diskCount,
                moves: summary.actualMoves,
                actualMoves: summary.actualMoves,
                finalPathMoves: summary.finalPathMoves,
                optimal: summary.optimalMoves,
                optimalMoves: summary.optimalMoves,
                excessMoves: summary.excessMoves,
                finalPathExcessMoves: summary.finalPathExcessMoves,
                efficiency: summary.planningEfficiency,
                planningEfficiency: summary.planningEfficiency,
                finalPathEfficiency: summary.finalPathEfficiency,
                illegalMoves: summary.illegalMoves,
                undoCount: summary.undoCount,
                redoCount: summary.redoCount,
                backtrackCount: summary.backtrackCount,
                directBacktrackCount: summary.directBacktrackCount,
                firstMoveLatencyMs: summary.firstMoveLatencyMs,
                repeatedStateCount: summary.repeatedStateCount,
                loopCount: summary.loopCount,
                uniqueStateCount: summary.uniqueStateCount,
                optimalPathDeviationCount: summary.optimalPathDeviationCount,
                optimalPathMatchRate: summary.optimalPathMatchRate
            },
            tags: ["planning", "executive-function", "problem-solving", "hanoi"]
        });
        sessionSaved = true;
    }

    resultModal.style.display = "flex";
}

function startGame() {
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
    resetGame();
}

document.querySelectorAll(".peg").forEach((pegEl) => {
    pegEl.addEventListener("click", () => onPegClick(Number(pegEl.dataset.peg)));
});
diskCountSelect.addEventListener("change", resetGame);
document.getElementById("restart-btn").addEventListener("click", resetGame);
undoBtn.addEventListener("click", undoMove);
redoBtn.addEventListener("click", redoMove);

window.startGame = startGame;
