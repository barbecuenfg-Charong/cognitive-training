const PEG_CAPACITY = [3, 2, 1];
const ALL_PROBLEMS = [
    { id: "tol-1", start: [["red", "blue"], ["green"], []], goal: [["green"], ["red"], ["blue"]], optimal: 3 },
    { id: "tol-2", start: [["red", "green"], ["blue"], []], goal: [["blue"], ["green"], ["red"]], optimal: 4 },
    { id: "tol-3", start: [["blue", "green"], ["red"], []], goal: [["red", "blue"], ["green"], []], optimal: 3 },
    { id: "tol-4", start: [["red"], ["green", "blue"], []], goal: [["blue"], ["red"], ["green"]], optimal: 4 },
    { id: "tol-5", start: [["green"], ["red"], ["blue"]], goal: [["red", "green"], [], ["blue"]], optimal: 3 }
];
const CONTENT_VERSION = "london-tower-v2-seeded";

let problemIndex = 0;
let playerState = null;
let selectedPeg = null;
let moves = 0;
let solvedMoves = [];
let optimalSolved = 0;
let timer = null;
let elapsed = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionProblems = [];
let problemOrder = [];
let problemStartedAtMs = 0;
let firstMoveLatencyMs = null;
let problemInvalidMoves = 0;
let problemBacktracks = 0;
let problemRepeatedStates = 0;
let problemMovePath = [];
let stateHistory = [];
let stateVisitCounts = new Map();
let trials = [];

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("tol-panel");
const resultModal = document.getElementById("result-modal");
const playerPegsEl = document.getElementById("player-pegs");
const goalPegsEl = document.getElementById("goal-pegs");
const hint = document.getElementById("hint");

function cloneState(state) {
    return state.map((peg) => [...peg]);
}

function stateKey(state) {
    return JSON.stringify(state);
}

function buildSessionProblems() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("london-tower") : `london-tower-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    const ordered = seeded
        ? seeded.pickShuffled(ALL_PROBLEMS, rng, ALL_PROBLEMS.length)
        : ALL_PROBLEMS.slice();

    problemOrder = ordered.map((item) => item.id);
    sessionProblems = ordered.map((item) => ({ ...item }));
}

function getCurrentProblem() {
    return sessionProblems[problemIndex];
}

function equalState(a, b) {
    return stateKey(a) === stateKey(b);
}

function nextStatesFor(state) {
    const states = [];
    state.forEach((fromPeg, from) => {
        const ball = topBall(fromPeg);
        if (!ball) {
            return;
        }
        state.forEach((toPeg, to) => {
            if (from === to || toPeg.length >= PEG_CAPACITY[to]) {
                return;
            }
            const nextState = cloneState(state);
            nextState[from].pop();
            nextState[to].push(ball);
            states.push(nextState);
        });
    });
    return states;
}

function solveOptimalMoves(start, goal) {
    const startKey = stateKey(start);
    const goalKey = stateKey(goal);
    if (startKey === goalKey) {
        return 0;
    }

    const queue = [{ state: cloneState(start), depth: 0 }];
    const seen = new Set([startKey]);
    const maxStates = 256;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
        if (seen.size > maxStates) {
            return null;
        }
        const current = queue[cursor];
        const nextDepth = current.depth + 1;
        for (const nextState of nextStatesFor(current.state)) {
            const key = stateKey(nextState);
            if (seen.has(key)) {
                continue;
            }
            if (key === goalKey) {
                return nextDepth;
            }
            seen.add(key);
            queue.push({ state: nextState, depth: nextDepth });
        }
    }
    return null;
}

function topBall(peg) {
    if (peg.length === 0) {
        return null;
    }
    return peg[peg.length - 1];
}

function updateBoard() {
    document.getElementById("problem").textContent = String(problemIndex + 1);
    document.getElementById("moves").textContent = String(moves);
    document.getElementById("time").textContent = `${elapsed}s`;
}

function createPegElement(pegBalls, index, interactive) {
    const peg = document.createElement("button");
    peg.type = "button";
    peg.className = "tol-peg";
    if (interactive && selectedPeg === index) {
        peg.classList.add("selected");
    }

    pegBalls.forEach((color) => {
        const ball = document.createElement("div");
        ball.className = `tol-ball ${color}`;
        peg.appendChild(ball);
    });

    if (interactive) {
        peg.addEventListener("click", () => onPegClick(index));
    } else {
        peg.disabled = true;
    }
    return peg;
}

function render() {
    const problem = getCurrentProblem();
    if (!problem) {
        return;
    }

    playerPegsEl.innerHTML = "";
    goalPegsEl.innerHTML = "";

    playerState.forEach((pegBalls, index) => {
        playerPegsEl.appendChild(createPegElement(pegBalls, index, true));
    });
    problem.goal.forEach((pegBalls, index) => {
        goalPegsEl.appendChild(createPegElement(pegBalls, index, false));
    });
    updateBoard();
}

function resetProblemTracking() {
    problemStartedAtMs = Date.now();
    firstMoveLatencyMs = null;
    problemInvalidMoves = 0;
    problemBacktracks = 0;
    problemRepeatedStates = 0;
    problemMovePath = [];
    stateHistory = [stateKey(playerState)];
    stateVisitCounts = new Map([[stateKey(playerState), 1]]);
}

function startCurrentProblem(message) {
    playerState = cloneState(getCurrentProblem().start);
    moves = 0;
    selectedPeg = null;
    hint.textContent = message;
    resetProblemTracking();
    render();
}

function recordInvalidMove(from, to, reason) {
    problemInvalidMoves += 1;
    problemMovePath.push({
        step: problemMovePath.length + 1,
        valid: false,
        from,
        to,
        reason,
        elapsedMs: Math.max(0, Date.now() - problemStartedAtMs),
        state: cloneState(playerState)
    });
}

function moveBall(from, to) {
    const fromPeg = playerState[from];
    const toPeg = playerState[to];
    const ball = topBall(fromPeg);
    if (!ball) {
        recordInvalidMove(from, to, "empty-source");
        hint.textContent = "起始柱没有可移动球。";
        return false;
    }
    if (toPeg.length >= PEG_CAPACITY[to]) {
        recordInvalidMove(from, to, "capacity-full");
        hint.textContent = "目标柱容量已满。";
        return false;
    }

    const beforeState = cloneState(playerState);
    const beforeKey = stateKey(beforeState);
    fromPeg.pop();
    toPeg.push(ball);
    moves += 1;
    if (firstMoveLatencyMs === null) {
        firstMoveLatencyMs = Math.max(0, Date.now() - problemStartedAtMs);
    }

    const afterState = cloneState(playerState);
    const afterKey = stateKey(afterState);
    const previousKey = stateHistory.length >= 2 ? stateHistory[stateHistory.length - 2] : null;
    const backtrack = afterKey === previousKey;
    const repeatedState = stateVisitCounts.has(afterKey);
    if (backtrack) {
        problemBacktracks += 1;
    }
    if (repeatedState) {
        problemRepeatedStates += 1;
    }
    stateVisitCounts.set(afterKey, (stateVisitCounts.get(afterKey) || 0) + 1);
    stateHistory.push(afterKey);
    problemMovePath.push({
        step: moves,
        valid: true,
        from,
        to,
        ball,
        beforeState,
        afterState,
        beforeKey,
        afterKey,
        repeatedState,
        backtrack,
        elapsedMs: Math.max(0, Date.now() - problemStartedAtMs)
    });
    hint.textContent = "移动成功。";
    return true;
}

function onPegClick(index) {
    const problem = getCurrentProblem();
    if (!problem) {
        return;
    }

    if (selectedPeg === null) {
        selectedPeg = index;
        render();
        return;
    }
    if (selectedPeg === index) {
        selectedPeg = null;
        render();
        return;
    }

    const moved = moveBall(selectedPeg, index);
    selectedPeg = null;
    render();
    if (!moved) {
        return;
    }

    const solved = equalState(playerState, problem.goal);
    if (solved) {
        onSolvedProblem();
    }
}

function onSolvedProblem() {
    const problem = getCurrentProblem();
    if (!problem) {
        return;
    }

    const validatedOptimalMoves = solveOptimalMoves(problem.start, problem.goal);
    const effectiveOptimalMoves = Number.isFinite(validatedOptimalMoves) ? validatedOptimalMoves : problem.optimal;
    const optimalSource = Number.isFinite(validatedOptimalMoves) ? "bfs-validated" : "catalog-fallback";
    const optimalMismatch = Number.isFinite(validatedOptimalMoves) && validatedOptimalMoves !== problem.optimal;
    const excessMoves = Math.max(0, moves - effectiveOptimalMoves);
    const planningEfficiency = moves > 0 ? Math.min(100, Math.round((effectiveOptimalMoves / moves) * 100)) : 0;
    solvedMoves.push(moves);
    if (moves <= effectiveOptimalMoves) {
        optimalSolved += 1;
    }
    trials.push({
        index: trials.length,
        problemId: problem.id,
        optimal: problem.optimal,
        validatedOptimalMoves,
        effectiveOptimalMoves,
        optimalSource,
        optimalMismatch,
        moves,
        actualMoves: moves,
        excessMoves,
        planningEfficiency,
        firstMoveLatencyMs,
        invalidMoves: problemInvalidMoves,
        backtracks: problemBacktracks,
        repeatedStates: problemRepeatedStates,
        uniqueStateCount: stateVisitCounts.size,
        startState: cloneState(problem.start),
        goalState: cloneState(problem.goal),
        movePath: problemMovePath.map((item) => ({ ...item }))
    });

    problemIndex += 1;
    if (problemIndex >= sessionProblems.length) {
        finish();
        return;
    }

    startCurrentProblem("下一题开始。");
}

function average(values) {
    if (!values.length) {
        return 0;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function nextDifficultySuggestion(avgExcessMoves, optimalRate) {
    if (optimalRate >= 80 && avgExcessMoves <= 0.5) {
        return "increase-complexity";
    }
    if (optimalRate >= 60 && avgExcessMoves <= 1.5) {
        return "maintain";
    }
    return "repeat-with-planning-pause";
}

function planningPrescription(summary) {
    if (summary.avgExcessMoves > 1.5 || summary.backtracks >= 4) {
        return "repeat-with-planning-pause";
    }
    if (summary.avgFirstMoveLatencyMs < 1200 && summary.avgExcessMoves > 0.5) {
        return "slow-first-move-and-plan";
    }
    if (summary.validatedOptimalRate >= 80 && summary.avgPlanningEfficiency >= 85) {
        return "increase-problem-complexity";
    }
    return "maintain-and-stabilize-path";
}

function finish() {
    if (timer) {
        clearInterval(timer);
    }
    const totalProblems = sessionProblems.length || ALL_PROBLEMS.length;
    const avgMoves = (solvedMoves.reduce((sum, value) => sum + value, 0) / totalProblems).toFixed(1);
    const optimalRate = Math.round((optimalSolved / totalProblems) * 100);
    const avgExcessMoves = Number(average(trials.map((trial) => trial.excessMoves)).toFixed(2));
    const validatedOptimalSolved = trials.filter((trial) => trial.actualMoves <= trial.effectiveOptimalMoves).length;
    const validatedOptimalRate = totalProblems > 0 ? Math.round((validatedOptimalSolved / totalProblems) * 100) : 0;
    const avgPlanningEfficiency = Math.round(average(trials.map((trial) => trial.planningEfficiency)));
    const optimalValidationMismatches = trials.filter((trial) => trial.optimalMismatch).length;
    const avgFirstMoveLatencyMs = Math.round(average(trials
        .map((trial) => trial.firstMoveLatencyMs)
        .filter((value) => Number.isFinite(value))));
    const summary = {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        problems: totalProblems,
        completedProblems: trials.length,
        avgMoves: Number(avgMoves),
        optimalRate,
        validatedOptimalRate,
        avgExcessMoves,
        avgPlanningEfficiency,
        optimalValidationMismatches,
        avgFirstMoveLatencyMs,
        invalidMoves: trials.reduce((sum, trial) => sum + trial.invalidMoves, 0),
        backtracks: trials.reduce((sum, trial) => sum + trial.backtracks, 0),
        repeatedStates: trials.reduce((sum, trial) => sum + trial.repeatedStates, 0),
        timeSec: elapsed,
        problemOrder,
        nextDifficultySuggestion: nextDifficultySuggestion(avgExcessMoves, optimalRate)
    };
    summary.planningPrescription = planningPrescription(summary);

    document.getElementById("result-avg-moves").textContent = String(avgMoves);
    document.getElementById("result-optimal").textContent = `${validatedOptimalRate}%`;
    document.getElementById("result-time").textContent = `${elapsed}s`;

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            gameId: "london-tower",
            gameName: "伦敦塔",
            startedAt: sessionStartedAt || new Date(),
            finishedAt: new Date(),
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: trials.map((trial) => ({ ...trial })),
            metrics: {
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                problems: totalProblems,
                avgMoves: Number(avgMoves),
                optimalRate,
                validatedOptimalRate: summary.validatedOptimalRate,
                avgExcessMoves,
                avgPlanningEfficiency: summary.avgPlanningEfficiency,
                optimalValidationMismatches: summary.optimalValidationMismatches,
                avgFirstMoveLatencyMs,
                invalidMoves: summary.invalidMoves,
                backtracks: summary.backtracks,
                repeatedStates: summary.repeatedStates,
                timeSec: elapsed,
                problemOrder,
                nextDifficultySuggestion: summary.nextDifficultySuggestion,
                planningPrescription: summary.planningPrescription
            }
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    problemIndex = 0;
    moves = 0;
    solvedMoves = [];
    optimalSolved = 0;
    selectedPeg = null;
    elapsed = 0;
    sessionStartedAt = new Date();
    buildSessionProblems();
    trials = [];

    if (timer) {
        clearInterval(timer);
    }
    timer = setInterval(() => {
        elapsed += 1;
        document.getElementById("time").textContent = `${elapsed}s`;
    }, 1000);

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
    startCurrentProblem("点击一个柱子选择球，再点击目标柱移动。");
}

window.startGame = startGame;
