const TOTAL_TRIALS = 40;
const PRACTICE_TRIALS = 12;
const STIMULI = [1, 2, 3, 4, 6, 7, 8, 9];
const TASKS = ["parity", "magnitude"];
const COLORS = {
    parity: "#3498db",
    magnitude: "#e67e22"
};

let currentTrial = 0;
let totalTrials = TOTAL_TRIALS;
let trials = [];
let responses = [];
let isGameActive = false;
let trialStartTime = 0;
let canRespond = false;
let currentPhase = "test";
let sessionStartedAt = null;

// DOM Elements
const instructionOverlay = document.getElementById("instruction-overlay");
const gameDisplay = document.getElementById("ts-display");
const stimulusCard = document.getElementById("stimulus-card");
const stimulusNumber = document.getElementById("stimulus-number");
const resultModal = document.getElementById("result-modal");
const accuracyDisplay = document.getElementById("accuracy");
const progressDisplay = document.getElementById("trial-progress");
const switchCostDisplay = document.getElementById("switch-cost");
const phaseLabel = document.getElementById("phase-label");
const prestartActions = document.getElementById("prestart-actions");
const practiceStatus = document.getElementById("practice-status");

// Event Listener for Keys
document.addEventListener("keydown", (e) => {
    if (!isGameActive || !canRespond) return;
    if (e.repeat) return;

    const key = e.key.toLowerCase();
    if (key === "a" || key === "l") {
        handleResponse(key);
    }
});

function handleButtonClick(key) {
    if (!isGameActive || !canRespond) return;
    handleResponse(key);
}

function startGame() {
    beginSession("test");
}

function startPractice() {
    beginSession("practice");
}

function beginSession(phase) {
    currentPhase = phase;
    totalTrials = phase === "practice" ? PRACTICE_TRIALS : TOTAL_TRIALS;
    isGameActive = true;
    canRespond = false;
    currentTrial = 0;
    sessionStartedAt = new Date();
    trials = generateTrials(totalTrials);
    responses = [];

    instructionOverlay.style.display = "none";
    gameDisplay.style.display = "flex";
    resultModal.style.display = "none";
    phaseLabel.textContent = currentPhase === "practice" ? "练习模式" : "正式测试";
    progressDisplay.textContent = `0/${totalTrials}`;
    accuracyDisplay.textContent = "0%";
    switchCostDisplay.textContent = "-- ms";
    practiceStatus.style.display = "none";

    setTimeout(runTrial, 1000);
}

function generateTrials(count) {
    const trialList = [];
    let previousTask = TASKS[Math.floor(Math.random() * TASKS.length)];

    for (let i = 0; i < count; i++) {
        // 50% chance to switch task
        const isSwitch = Math.random() < 0.5;
        const task = isSwitch ? (previousTask === "parity" ? "magnitude" : "parity") : previousTask;
        const number = STIMULI[Math.floor(Math.random() * STIMULI.length)];

        // Determine correct answer
        let correctAnswer;
        if (task === "parity") {
            correctAnswer = number % 2 !== 0 ? "a" : "l";
        } else {
            correctAnswer = number < 5 ? "a" : "l";
        }

        trialList.push({
            index: i,
            task,
            number,
            isSwitch: i === 0 ? false : task !== previousTask,
            correctAnswer
        });

        previousTask = task;
    }
    return trialList;
}

function runTrial() {
    if (currentTrial >= totalTrials) {
        endSession();
        return;
    }

    const trial = trials[currentTrial];
    progressDisplay.textContent = `${currentTrial + 1}/${totalTrials}`;
    stimulusCard.style.backgroundColor = COLORS[trial.task];
    stimulusNumber.textContent = trial.number;
    stimulusNumber.style.visibility = "visible";

    canRespond = true;
    trialStartTime = Date.now();
}

function handleResponse(key) {
    if (!isGameActive || !canRespond) return;

    canRespond = false;
    const rt = Date.now() - trialStartTime;
    if (rt < 100) {
        trialStartTime = Date.now();
        canRespond = true;
        stimulusCard.classList.add("shake");
        setTimeout(() => stimulusCard.classList.remove("shake"), 180);
        return;
    }

    const trial = trials[currentTrial];
    const isCorrect = (key === trial.correctAnswer);

    if (!isCorrect) {
        stimulusCard.classList.add("shake");
        setTimeout(() => stimulusCard.classList.remove("shake"), 300);
    }

    responses.push({
        ...trial,
        rt,
        correct: isCorrect,
        userKey: key
    });

    updateLiveStats();
    stimulusNumber.style.visibility = "hidden";
    currentTrial++;

    setTimeout(runTrial, 400);
}

function updateLiveStats() {
    const correctCount = responses.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / responses.length) * 100) || 0;
    accuracyDisplay.textContent = `${accuracy}%`;
}

function calculateResults() {
    const correctResponses = responses.filter(r => r.correct);
    const accuracy = Math.round((correctResponses.length / totalTrials) * 100);
    const meanRT = Math.round(correctResponses.reduce((sum, r) => sum + r.rt, 0) / correctResponses.length) || 0;
    const validResponses = correctResponses.filter(r => r.index > 0);
    const switchTrials = validResponses.filter(r => r.isSwitch);
    const repeatTrials = validResponses.filter(r => !r.isSwitch);

    const switchRT = switchTrials.length > 0
        ? switchTrials.reduce((sum, r) => sum + r.rt, 0) / switchTrials.length
        : 0;

    const repeatRT = repeatTrials.length > 0
        ? repeatTrials.reduce((sum, r) => sum + r.rt, 0) / repeatTrials.length
        : 0;

    const switchCost = (switchRT > 0 && repeatRT > 0) ? Math.round(switchRT - repeatRT) : 0;

    return { accuracy, meanRT, switchCost };
}

function endSession() {
    isGameActive = false;
    canRespond = false;
    const results = calculateResults();
    const finishedAt = new Date();

    if (currentPhase === "practice") {
        gameDisplay.style.display = "none";
        instructionOverlay.style.display = "flex";
        practiceStatus.style.display = "block";
        practiceStatus.textContent = `练习完成：正确率 ${results.accuracy}% ，可以开始正式测试。`;
        prestartActions.innerHTML = '<button class="start-btn" onclick="startGame()">开始正式测试</button>';
        progressDisplay.textContent = `0/${TOTAL_TRIALS}`;
        accuracyDisplay.textContent = "0%";
        switchCostDisplay.textContent = "-- ms";
        return;
    }

    document.getElementById("final-accuracy").textContent = `${results.accuracy}%`;
    document.getElementById("final-rt").textContent = `${results.meanRT} ms`;
    document.getElementById("final-switch-cost").textContent = `${results.switchCost} ms`;
    switchCostDisplay.textContent = `${results.switchCost} ms`;
    gameDisplay.style.display = "none";
    resultModal.style.display = "flex";

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            moduleId: "task-switching",
            gameId: "task-switching",
            gameName: "任务切换",
            startedAt: sessionStartedAt,
            finishedAt,
            durationMs: finishedAt.getTime() - sessionStartedAt.getTime(),
            score: results.accuracy,
            summary: {
                totalTrials,
                correctCount: responses.filter(r => r.correct).length,
                accuracy: results.accuracy / 100,
                meanRtMs: results.meanRT,
                switchCostMs: results.switchCost
            },
            trials: responses.map((item) => ({
                index: item.index,
                task: item.task,
                isSwitch: item.isSwitch,
                rtMs: item.rt,
                correct: item.correct,
                userKey: item.userKey
            })),
            metrics: {
                accuracy: `${results.accuracy}%`,
                meanRT: `${results.meanRT}ms`,
                switchCost: `${results.switchCost}ms`
            },
            tags: ["executive", "task-switching"]
        });
    }
}

window.startGame = startGame;
window.startPractice = startPractice;
window.handleButtonClick = handleButtonClick;
