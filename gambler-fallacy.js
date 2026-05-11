const TOTAL_ROUNDS = 20;
const HISTORY_SIZE = 6;
const STREAK_THRESHOLD = 3;
const CONTENT_VERSION = "gambler-fallacy-v2-seeded";

let history = [];
let round = 0;
let correct = 0;
let streakContextCount = 0;
let antiStreakChoiceCount = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let rng = Math.random;
let initialHistory = [];
let trialLog = [];
let trialStartedAtMs = 0;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("gf-panel");
const historyEl = document.getElementById("history");
const feedbackEl = document.getElementById("feedback");
const resultModal = document.getElementById("result-modal");

function randomCoin() {
    return rng() < 0.5 ? "H" : "T";
}

function initHistory() {
    history = [];
    for (let i = 0; i < HISTORY_SIZE; i += 1) {
        history.push(randomCoin());
    }
    initialHistory = history.slice();
}

function getTailStreak() {
    const last = history[history.length - 1];
    let streak = 1;
    for (let i = history.length - 2; i >= 0; i -= 1) {
        if (history[i] !== last) {
            break;
        }
        streak += 1;
    }
    return { last, streak };
}

function renderHistory() {
    historyEl.innerHTML = "";
    history.slice(-HISTORY_SIZE).forEach((item) => {
        const chip = document.createElement("div");
        chip.className = `gf-chip ${item.toLowerCase()}`;
        chip.textContent = item;
        historyEl.appendChild(chip);
    });
}

function updateStats() {
    const acc = round === 0 ? 0 : Math.round((correct / round) * 100);
    const antiRate = streakContextCount === 0 ? 0 : Math.round((antiStreakChoiceCount / streakContextCount) * 100);

    document.getElementById("round").textContent = String(round);
    document.getElementById("acc").textContent = `${acc}%`;
    document.getElementById("anti-rate").textContent = `${antiRate}%`;
}

function startGame() {
    round = 0;
    correct = 0;
    streakContextCount = 0;
    antiStreakChoiceCount = 0;
    sessionStartedAt = new Date();
    trialLog = [];
    trialStartedAtMs = 0;

    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("gambler-fallacy") : `gambler-fallacy-${Date.now()}`;
    rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    initHistory();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";

    feedbackEl.textContent = "请选择下一次抛硬币结果。";
    renderHistory();
    updateStats();
    trialStartedAtMs = Date.now();
}

function choose(prediction) {
    if (round >= TOTAL_ROUNDS) {
        return;
    }

    const answeredAt = new Date();
    const rtMs = trialStartedAtMs ? Math.max(0, answeredAt.getTime() - trialStartedAtMs) : 0;
    const historyBefore = history.slice(-HISTORY_SIZE);
    const { last, streak } = getTailStreak();
    const streakContext = streak >= STREAK_THRESHOLD;
    const opposite = last === "H" ? "T" : "H";
    const antiStreakChoice = streakContext && prediction === opposite;

    if (streakContext) {
        streakContextCount += 1;
        if (antiStreakChoice) {
            antiStreakChoiceCount += 1;
        }
    }

    const outcome = randomCoin();
    const isCorrect = prediction === outcome;
    trialLog.push({
        index: round,
        round: round + 1,
        trialId: `gf-${String(round + 1).padStart(2, "0")}`,
        historyBefore,
        choice: prediction,
        prediction,
        outcome,
        correct: isCorrect,
        tail: last,
        tailStreak: streak,
        streakContext,
        antiStreakChoice,
        rtMs,
        submittedAt: answeredAt.toISOString()
    });

    if (isCorrect) {
        correct += 1;
        feedbackEl.textContent = `本轮结果: ${outcome}，预测正确。`;
    } else {
        feedbackEl.textContent = `本轮结果: ${outcome}，预测错误。`;
    }

    history.push(outcome);
    round += 1;
    renderHistory();
    updateStats();

    if (round >= TOTAL_ROUNDS) {
        finish();
    } else {
        trialStartedAtMs = Date.now();
    }
}

function finish() {
    const acc = Math.round((correct / TOTAL_ROUNDS) * 100);
    const antiRate = streakContextCount === 0 ? 0 : Math.round((antiStreakChoiceCount / streakContextCount) * 100);
    const finishedAt = new Date();
    const durationMs = sessionStartedAt ? finishedAt.getTime() - sessionStartedAt.getTime() : 0;
    const meanRtMs = Math.round(trialLog.reduce((sum, item) => sum + item.rtMs, 0) / Math.max(1, trialLog.length));

    document.getElementById("result-acc").textContent = `${acc}%`;
    document.getElementById("result-anti").textContent = `${antiRate}%`;

    let message = "随机事件彼此独立，下一次并不会“补偿”前面的连串。";
    if (antiRate >= 70) {
        message = "你在连串后经常做反向预测，存在较明显“赌徒谬误”倾向。";
    } else if (antiRate >= 40) {
        message = "你有一定连串后反向预测倾向，建议继续训练随机性直觉。";
    }
    document.getElementById("result-text").textContent = message;

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            moduleId: "gambler-fallacy",
            gameId: "gambler-fallacy",
            gameName: "赌徒谬误任务",
            startedAt: sessionStartedAt || finishedAt,
            finishedAt,
            durationMs,
            score: acc,
            summary: {
                totalTrials: TOTAL_ROUNDS,
                correctCount: correct,
                accuracy: correct / TOTAL_ROUNDS,
                streakContextCount,
                antiStreakChoiceCount,
                antiStreakChoiceRate: streakContextCount === 0 ? 0 : antiStreakChoiceCount / streakContextCount,
                meanRtMs,
                contentVersion: CONTENT_VERSION,
                sessionSeed,
                initialHistory: initialHistory.slice()
            },
            trials: trialLog.map((item) => ({ ...item })),
            metrics: {
                accuracy: acc,
                antiRate,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION,
                initialHistory: initialHistory.slice(),
                trials: trialLog.map((item) => ({ ...item }))
            },
            tags: ["probability", "gambler-fallacy", "randomness"]
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

document.getElementById("pick-h").addEventListener("click", () => choose("H"));
document.getElementById("pick-t").addEventListener("click", () => choose("T"));

window.startGame = startGame;
