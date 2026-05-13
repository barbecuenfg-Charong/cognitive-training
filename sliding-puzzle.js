let size = 3;
let tiles = [];
let moves = 0;
let elapsed = 0;
let timer = null;
let sessionStartedAt = null;
const CONTENT_VERSION = "sliding-puzzle-v2-seeded-trials";
let sessionSeed = "";
let sessionRng = Math.random;
let shuffleSteps = 0;
let initialState = [];
let moveLog = [];
let shuffleLog = [];
let stateHistory = [];
let stateVisitCounts = new Map();
let repeatedStateCount = 0;
let backtrackCount = 0;
let blockedMoves = 0;
let firstMoveLatencyMs = null;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("sp-panel");
const boardEl = document.getElementById("board");
const hintEl = document.getElementById("hint");
const resultModal = document.getElementById("result-modal");
const sizeSelect = document.getElementById("board-size");

function goalState(n) {
    const max = n * n;
    return Array.from({ length: max }, (_, i) => (i + 1) % max);
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
        return window.SeededRandom.createSessionSeed("sliding-puzzle");
    }
    return `sliding-puzzle-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return mulberry32(hashString(seed));
}

function stateKey(state) {
    return JSON.stringify(state);
}

function isSolved(state) {
    const goal = goalState(size);
    return state.every((value, idx) => value === goal[idx]);
}

function cloneState(state) {
    return state.slice();
}

function manhattanDistance(state) {
    let distance = 0;
    for (let index = 0; index < state.length; index += 1) {
        const value = state[index];
        if (value === 0) {
            continue;
        }
        const goalIndex = value - 1;
        const row = Math.floor(index / size);
        const col = index % size;
        const goalRow = Math.floor(goalIndex / size);
        const goalCol = goalIndex % size;
        distance += Math.abs(row - goalRow) + Math.abs(col - goalCol);
    }
    return distance;
}

function getNeighbors(emptyIndex) {
    const row = Math.floor(emptyIndex / size);
    const col = emptyIndex % size;
    const neighbors = [];

    if (row > 0) {
        neighbors.push(emptyIndex - size);
    }
    if (row < size - 1) {
        neighbors.push(emptyIndex + size);
    }
    if (col > 0) {
        neighbors.push(emptyIndex - 1);
    }
    if (col < size - 1) {
        neighbors.push(emptyIndex + 1);
    }
    return neighbors;
}

function getNeighborsForSize(emptyIndex, boardSize) {
    const row = Math.floor(emptyIndex / boardSize);
    const col = emptyIndex % boardSize;
    const neighbors = [];

    if (row > 0) {
        neighbors.push(emptyIndex - boardSize);
    }
    if (row < boardSize - 1) {
        neighbors.push(emptyIndex + boardSize);
    }
    if (col > 0) {
        neighbors.push(emptyIndex - 1);
    }
    if (col < boardSize - 1) {
        neighbors.push(emptyIndex + 1);
    }
    return neighbors;
}

function solveExactDistanceForThreeByThree(startState) {
    const boardSize = 3;
    if (size !== boardSize || startState.length !== boardSize * boardSize) {
        return {
            exactSolutionMoves: null,
            searchExpandedStates: 0,
            searchTimedOut: false
        };
    }

    const startKey = startState.join(",");
    const target = goalState(boardSize);
    const targetKey = target.join(",");
    if (startKey === targetKey) {
        return {
            exactSolutionMoves: 0,
            searchExpandedStates: 1,
            searchTimedOut: false
        };
    }

    const maxExpandedStates = 200000;
    const queue = [{ state: startState.slice(), emptyIndex: startState.indexOf(0), depth: 0 }];
    const seen = new Set([startKey]);
    let expandedStates = 0;

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        expandedStates += 1;
        if (expandedStates > maxExpandedStates) {
            return {
                exactSolutionMoves: null,
                searchExpandedStates: expandedStates,
                searchTimedOut: true
            };
        }

        const nextDepth = current.depth + 1;
        for (const targetIndex of getNeighborsForSize(current.emptyIndex, boardSize)) {
            const nextState = current.state.slice();
            [nextState[current.emptyIndex], nextState[targetIndex]] = [nextState[targetIndex], nextState[current.emptyIndex]];
            const nextKey = nextState.join(",");
            if (seen.has(nextKey)) {
                continue;
            }
            if (nextKey === targetKey) {
                return {
                    exactSolutionMoves: nextDepth,
                    searchExpandedStates: expandedStates,
                    searchTimedOut: false
                };
            }
            seen.add(nextKey);
            queue.push({ state: nextState, emptyIndex: targetIndex, depth: nextDepth });
        }
    }

    return {
        exactSolutionMoves: null,
        searchExpandedStates: expandedStates,
        searchTimedOut: false
    };
}

function shuffle() {
    tiles = goalState(size);
    let empty = tiles.indexOf(0);
    shuffleSteps = size === 3 ? 80 : 160;
    shuffleLog = [];
    repeatedStateCount = 0;
    backtrackCount = 0;
    blockedMoves = 0;
    firstMoveLatencyMs = null;

    for (let i = 0; i < shuffleSteps; i += 1) {
        const neighbors = getNeighbors(empty);
        const target = neighbors[Math.floor(sessionRng() * neighbors.length)];
        const movedTile = tiles[target];
        [tiles[empty], tiles[target]] = [tiles[target], tiles[empty]];
        shuffleLog.push({
            step: i + 1,
            emptyFrom: empty,
            emptyTo: target,
            tile: movedTile,
            state: cloneState(tiles)
        });
        empty = target;
    }
    initialState = cloneState(tiles);
    stateHistory = [stateKey(tiles)];
    stateVisitCounts = new Map([[stateKey(tiles), 1]]);
}

function updateBoard() {
    document.getElementById("size-text").textContent = `${size}x${size}`;
    document.getElementById("moves").textContent = String(moves);
    document.getElementById("time").textContent = `${elapsed}s`;

    boardEl.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    boardEl.innerHTML = "";

    tiles.forEach((value, idx) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = `sp-tile${value === 0 ? " empty" : ""}`;
        tile.textContent = value === 0 ? "" : String(value);
        tile.addEventListener("click", () => onTileClick(idx));
        boardEl.appendChild(tile);
    });
}

function resetGame() {
    size = Number(sizeSelect.value);
    moves = 0;
    elapsed = 0;
    sessionStartedAt = new Date();
    sessionSeed = createSessionSeed();
    sessionRng = createRng(sessionSeed);
    moveLog = [];
    hintEl.textContent = "将数字恢复为升序排列。";

    if (timer) {
        clearInterval(timer);
    }
    timer = setInterval(() => {
        elapsed += 1;
        document.getElementById("time").textContent = `${elapsed}s`;
    }, 1000);

    shuffle();
    updateBoard();
}

function onTileClick(index) {
    const empty = tiles.indexOf(0);
    if (!getNeighbors(empty).includes(index)) {
        blockedMoves += 1;
        return;
    }
    const beforeState = cloneState(tiles);
    const beforeKey = stateKey(beforeState);
    [tiles[empty], tiles[index]] = [tiles[index], tiles[empty]];
    moves += 1;
    if (firstMoveLatencyMs === null) {
        firstMoveLatencyMs = Math.max(0, Date.now() - sessionStartedAt.getTime());
    }

    const afterState = cloneState(tiles);
    const afterKey = stateKey(afterState);
    const previousKey = stateHistory.length >= 2 ? stateHistory[stateHistory.length - 2] : null;
    const repeatedState = stateVisitCounts.has(afterKey);
    const backtrack = afterKey === previousKey;
    if (repeatedState) {
        repeatedStateCount += 1;
    }
    if (backtrack) {
        backtrackCount += 1;
    }
    stateVisitCounts.set(afterKey, (stateVisitCounts.get(afterKey) || 0) + 1);
    stateHistory.push(afterKey);
    moveLog.push({
        index: moves - 1,
        tile: beforeState[index],
        fromIndex: index,
        toIndex: empty,
        emptyFrom: empty,
        emptyTo: index,
        beforeState,
        afterState,
        beforeKey,
        afterKey,
        repeatedState,
        backtrack,
        elapsedMs: Math.max(0, Date.now() - sessionStartedAt.getTime())
    });
    updateBoard();

    if (isSolved(tiles)) {
        finish();
    }
}

function buildSummary() {
    const lowerBound = manhattanDistance(initialState);
    const exactResult = solveExactDistanceForThreeByThree(initialState);
    const exactSolutionMoves = exactResult.exactSolutionMoves;
    const solutionBasis = Number.isFinite(exactSolutionMoves) ? "exact-bfs" : "manhattan-lower-bound";
    const referenceMoves = Number.isFinite(exactSolutionMoves) ? exactSolutionMoves : lowerBound;
    const efficiency = moves > 0 ? Math.min(100, Math.round((referenceMoves / moves) * 100)) : 0;
    const solutionGapMoves = moves > 0 ? Math.max(0, moves - referenceMoves) : 0;
    const solutionGapRate = moves > 0 ? Math.round((solutionGapMoves / moves) * 100) : 0;
    const repetitionRate = moveLog.length > 0 ? Math.round((repeatedStateCount / moveLog.length) * 100) : 0;
    const shouldIncrease = solutionBasis === "exact-bfs" && efficiency >= 75 && repetitionRate <= 15 && backtrackCount <= 4;
    return {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        boardSize: size,
        initialState: cloneState(initialState),
        shuffleSteps,
        shuffleLog: shuffleLog.map((item) => ({ ...item })),
        actualMoves: moves,
        moveCount: moves,
        repeatedStateCount,
        backtrackCount,
        blockedMoves,
        firstMoveLatencyMs,
        lowerBoundMoves: lowerBound,
        exactSolutionMoves,
        solutionBasis,
        solutionGapMoves,
        solutionGapRate,
        searchExpandedStates: exactResult.searchExpandedStates,
        searchTimedOut: exactResult.searchTimedOut,
        efficiency,
        efficiencyBasis: solutionBasis,
        repetitionRate,
        nextDifficultyPrescription: {
            boardSize: shouldIncrease && size <= 3 ? size + 1 : size,
            focus: shouldIncrease ? "increase-board-size" : "reduce-backtracks-and-repeat-states",
            shuffleSteps: size === 3 ? 80 : 160,
            note: shouldIncrease
                ? "3x3 精确路径效率稳定后再提高棋盘尺寸"
                : "先减少回退、重复状态和相对最短路径差距，再提升难度"
        }
    };
}

function finish() {
    if (timer) {
        clearInterval(timer);
    }
    const summary = buildSummary();
    document.getElementById("result-moves").textContent = String(moves);
    document.getElementById("result-time").textContent = `${elapsed}s`;
    document.getElementById("result-size").textContent = `${size}x${size}`;

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            gameId: "sliding-puzzle",
            gameName: "八/十五数码问题",
            startedAt: sessionStartedAt || new Date(),
            finishedAt: new Date(),
            seed: sessionSeed,
            contentVersion: summary.contentVersion,
            summary,
            trials: [{
                index: 0,
                boardSize: size,
                initialState: cloneState(initialState),
                shuffleSteps,
                shuffleLog: shuffleLog.map((item) => ({ ...item })),
                moveLog: moveLog.map((item) => ({ ...item })),
                moves,
                repeatedStateCount,
                backtrackCount,
                blockedMoves,
                firstMoveLatencyMs,
                lowerBoundMoves: summary.lowerBoundMoves,
                exactSolutionMoves: summary.exactSolutionMoves,
                solutionBasis: summary.solutionBasis,
                solutionGapMoves: summary.solutionGapMoves,
                solutionGapRate: summary.solutionGapRate,
                searchExpandedStates: summary.searchExpandedStates,
                searchTimedOut: summary.searchTimedOut,
                efficiency: summary.efficiency,
                efficiencyBasis: summary.efficiencyBasis
            }],
            metrics: {
                seed: sessionSeed,
                contentVersion: summary.contentVersion,
                size,
                boardSize: size,
                moves,
                actualMoves: moves,
                shuffleSteps,
                repeatedStateCount,
                backtrackCount,
                blockedMoves,
                firstMoveLatencyMs,
                lowerBoundMoves: summary.lowerBoundMoves,
                exactSolutionMoves: summary.exactSolutionMoves,
                solutionBasis: summary.solutionBasis,
                solutionGapMoves: summary.solutionGapMoves,
                solutionGapRate: summary.solutionGapRate,
                searchExpandedStates: summary.searchExpandedStates,
                searchTimedOut: summary.searchTimedOut,
                efficiency: summary.efficiency,
                efficiencyBasis: summary.efficiencyBasis,
                nextDifficultyPrescription: summary.nextDifficultyPrescription,
                timeSec: elapsed
            }
        });
    }

    resultModal.style.display = "flex";
}

function startGame() {
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
    resetGame();
}

sizeSelect.addEventListener("change", resetGame);
document.getElementById("shuffle-btn").addEventListener("click", resetGame);

window.startGame = startGame;
