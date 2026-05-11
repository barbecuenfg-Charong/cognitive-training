document.addEventListener("DOMContentLoaded", () => {
    const RESPONSE_WINDOW_MS = 2000;
    const INTER_TRIAL_INTERVAL_MS = 220;

    const startBtn = document.getElementById("start-btn");
    const pauseBtn = document.getElementById("pause-btn");
    const stopBtn = document.getElementById("stop-btn");
    const display = document.getElementById("display");
    const feedback = document.getElementById("feedback");
    const leftBtn = document.getElementById("left-btn");
    const rightBtn = document.getElementById("right-btn");
    const scoreDisplay = document.getElementById("score");
    const progressDisplay = document.getElementById("progress");
    const avgRtLiveDisplay = document.getElementById("avg-rt-live");
    const trialSetting = document.getElementById("trial-setting");
    const resultModal = document.getElementById("result-modal");
    const finalScoreDisplay = document.getElementById("final-score");
    const avgRtDisplay = document.getElementById("avg-rt");
    const restartBtn = document.getElementById("restart-btn");

    let isPlaying = false;
    let isPaused = false;
    let roundOpen = false;
    let totalTrials = 50;
    let finishedTrials = 0;
    let score = 0;
    let missCount = 0;
    let currentDirection = null;
    let currentStimulus = null;
    let sessionStartedAt = null;
    let stimulusStartTime = 0;
    let reactionTimes = [];
    let trialLog = [];
    let trialTimeout = null;
    let nextRoundTimeout = null;

    startBtn.addEventListener("click", startGame);
    pauseBtn.addEventListener("click", togglePause);
    stopBtn.addEventListener("click", () => endGame(true));
    restartBtn.addEventListener("click", () => {
        resultModal.classList.add("hidden");
        resetUI();
    });

    leftBtn.addEventListener("click", () => handleResponse("left"));
    rightBtn.addEventListener("click", () => handleResponse("right"));

    document.addEventListener("keydown", (event) => {
        if (!isPlaying || isPaused) return;
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            handleResponse("left");
        }
        if (event.key === "ArrowRight") {
            event.preventDefault();
            handleResponse("right");
        }
    });

    function sanitizeTrials(raw) {
        const parsed = Number.parseInt(raw, 10);
        if (Number.isNaN(parsed)) return 50;
        return Math.min(200, Math.max(10, parsed));
    }

    function setControlState(playing) {
        startBtn.style.display = playing ? "none" : "inline-block";
        pauseBtn.style.display = playing ? "inline-block" : "none";
        stopBtn.style.display = playing ? "inline-block" : "none";
        pauseBtn.textContent = "暂停";
        trialSetting.disabled = playing;
    }

    function updateStats() {
        scoreDisplay.textContent = String(score);
        progressDisplay.textContent = `${finishedTrials} / ${totalTrials}`;
        const avgRt = reactionTimes.length > 0
            ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length)
            : 0;
        avgRtLiveDisplay.textContent = `${avgRt} ms`;
    }

    function showFeedback(text, type = "") {
        feedback.textContent = text;
        feedback.className = type ? `feedback ${type}` : "feedback";
    }

    function average(values) {
        const validValues = values.filter((value) => Number.isFinite(value));
        if (validValues.length === 0) return 0;
        return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
    }

    function accuracyFor(items) {
        if (items.length === 0) return 0;
        return items.filter((item) => item.correct).length / items.length;
    }

    function recordTrial(response, correct, rtMs) {
        if (!currentStimulus) return;

        trialLog.push({
            trialIndex: currentStimulus.trialIndex,
            condition: currentStimulus.condition,
            congruency: currentStimulus.congruency,
            stimulus: currentStimulus.text,
            targetDirection: currentStimulus.direction,
            response,
            correct,
            rtMs
        });
    }

    function buildSummary() {
        const completedTrials = trialLog.length;
        const correctCount = trialLog.filter((trial) => trial.correct).length;
        const congruentTrials = trialLog.filter((trial) => trial.congruency === "congruent");
        const incongruentTrials = trialLog.filter((trial) => trial.congruency === "incongruent");
        const congruentCorrectRt = congruentTrials
            .filter((trial) => trial.correct)
            .map((trial) => trial.rtMs);
        const incongruentCorrectRt = incongruentTrials
            .filter((trial) => trial.correct)
            .map((trial) => trial.rtMs);
        const congruentMeanRt = average(congruentCorrectRt);
        const incongruentMeanRt = average(incongruentCorrectRt);

        return {
            totalTrials: completedTrials,
            plannedTrials: totalTrials,
            correctCount,
            accuracy: completedTrials > 0 ? correctCount / completedTrials : 0,
            meanRtMs: average(trialLog.map((trial) => trial.rtMs)),
            congruentAccuracy: accuracyFor(congruentTrials),
            incongruentAccuracy: accuracyFor(incongruentTrials),
            congruencyEffectMs: congruentMeanRt > 0 && incongruentMeanRt > 0
                ? incongruentMeanRt - congruentMeanRt
                : 0
        };
    }

    function saveTrainingResult(finishedAt) {
        if (!window.TrainingResults || !sessionStartedAt) return;

        const summary = buildSummary();
        window.TrainingResults.saveSession({
            moduleId: "flanker",
            gameId: "flanker",
            gameName: "Flanker 专注力训练",
            startedAt: sessionStartedAt,
            finishedAt,
            durationMs: Math.max(0, finishedAt.getTime() - sessionStartedAt.getTime()),
            score,
            summary,
            trials: trialLog.map((trial) => ({ ...trial })),
            metrics: {
                accuracy: `${Math.round(summary.accuracy * 100)}%`,
                meanRt: `${summary.meanRtMs}ms`,
                congruencyEffect: `${summary.congruencyEffectMs}ms`
            },
            tags: ["attention", "flanker"]
        });
    }

    function startGame() {
        if (isPlaying) return;

        totalTrials = sanitizeTrials(trialSetting.value);
        trialSetting.value = String(totalTrials);
        finishedTrials = 0;
        score = 0;
        missCount = 0;
        reactionTimes = [];
        currentDirection = null;
        currentStimulus = null;
        sessionStartedAt = new Date();
        trialLog = [];
        isPlaying = true;
        isPaused = false;
        roundOpen = false;

        resultModal.classList.add("hidden");
        setControlState(true);
        leftBtn.disabled = false;
        rightBtn.disabled = false;
        showFeedback("开始训练", "correct");
        updateStats();

        clearTimeout(nextRoundTimeout);
        nextRoundTimeout = setTimeout(nextRound, 300);
    }

    function buildStimulus(trialIndex) {
        const direction = Math.random() < 0.5 ? "left" : "right";
        const isCongruent = Math.random() < 0.6;
        const congruency = isCongruent ? "congruent" : "incongruent";
        const centerChar = direction === "left" ? "<" : ">";
        const flankChar = isCongruent ? centerChar : (direction === "left" ? ">" : "<");
        const count = 5;
        const centerIndex = Math.floor(Math.random() * count);
        const htmlChars = [];
        const textChars = [];
        for (let i = 0; i < count; i += 1) {
            if (i === centerIndex) {
                htmlChars.push(`<span style="color:#e74c3c">${centerChar}</span>`);
                textChars.push(centerChar);
            } else {
                htmlChars.push(flankChar);
                textChars.push(flankChar);
            }
        }
        return {
            trialIndex,
            direction,
            condition: congruency,
            congruency,
            html: htmlChars.join(" "),
            text: textChars.join(" ")
        };
    }

    function nextRound() {
        if (!isPlaying || isPaused) return;
        if (finishedTrials >= totalTrials) {
            endGame(false);
            return;
        }

        const stimulus = buildStimulus(finishedTrials);
        currentDirection = stimulus.direction;
        currentStimulus = stimulus;
        display.innerHTML = stimulus.html;
        stimulusStartTime = Date.now();
        roundOpen = true;

        clearTimeout(trialTimeout);
        trialTimeout = setTimeout(() => {
            if (!roundOpen || !isPlaying || isPaused) return;
            roundOpen = false;
            recordTrial("timeout", false, null);
            currentStimulus = null;
            missCount += 1;
            finishedTrials += 1;
            showFeedback("超时", "wrong");
            updateStats();
            scheduleNextRound();
        }, RESPONSE_WINDOW_MS);
    }

    function scheduleNextRound() {
        clearTimeout(nextRoundTimeout);
        nextRoundTimeout = setTimeout(nextRound, INTER_TRIAL_INTERVAL_MS);
    }

    function handleResponse(response) {
        if (!isPlaying || isPaused || !roundOpen) return;

        roundOpen = false;
        clearTimeout(trialTimeout);

        const rt = Date.now() - stimulusStartTime;
        reactionTimes.push(rt);
        const correct = response === currentDirection;
        recordTrial(response, correct, rt);
        currentStimulus = null;
        if (correct) {
            score += 1;
            showFeedback("正确", "correct");
        } else {
            showFeedback("错误", "wrong");
        }

        finishedTrials += 1;
        updateStats();
        scheduleNextRound();
    }

    function togglePause() {
        if (!isPlaying) return;

        if (!isPaused) {
            isPaused = true;
            pauseBtn.textContent = "继续";
            leftBtn.disabled = true;
            rightBtn.disabled = true;
            clearTimeout(trialTimeout);
            clearTimeout(nextRoundTimeout);
            showFeedback("已暂停");
            return;
        }

        isPaused = false;
        pauseBtn.textContent = "暂停";
        leftBtn.disabled = false;
        rightBtn.disabled = false;
        showFeedback("继续训练", "correct");

        if (roundOpen) {
            stimulusStartTime = Date.now();
            trialTimeout = setTimeout(() => {
                if (!roundOpen || !isPlaying || isPaused) return;
                roundOpen = false;
                recordTrial("timeout", false, null);
                currentStimulus = null;
                missCount += 1;
                finishedTrials += 1;
                showFeedback("超时", "wrong");
                updateStats();
                scheduleNextRound();
            }, RESPONSE_WINDOW_MS);
            return;
        }

        scheduleNextRound();
    }

    function endGame(forced = false) {
        if (!isPlaying) return;

        isPlaying = false;
        isPaused = false;
        roundOpen = false;
        clearTimeout(trialTimeout);
        clearTimeout(nextRoundTimeout);

        leftBtn.disabled = true;
        rightBtn.disabled = true;
        setControlState(false);
        display.textContent = forced ? "已结束" : "训练结束";

        const avgRt = reactionTimes.length > 0
            ? Math.round(reactionTimes.reduce((sum, value) => sum + value, 0) / reactionTimes.length)
            : 0;
        const finishedAt = new Date();
        saveTrainingResult(finishedAt);

        if (forced) {
            showFeedback(`已停止（完成 ${finishedTrials} / ${totalTrials}）`);
            updateStats();
            return;
        }

        const accuracy = totalTrials > 0 ? Math.round((score / totalTrials) * 100) : 0;
        finalScoreDisplay.textContent = `${score} / ${totalTrials}（${accuracy}%）`;
        avgRtDisplay.textContent = String(avgRt);
        showFeedback(`完成：正确 ${score}，超时 ${missCount}`, "correct");
        resultModal.classList.remove("hidden");
    }

    function resetUI() {
        isPlaying = false;
        isPaused = false;
        roundOpen = false;
        clearTimeout(trialTimeout);
        clearTimeout(nextRoundTimeout);
        leftBtn.disabled = true;
        rightBtn.disabled = true;
        setControlState(false);
        display.textContent = "准备";
        showFeedback("");
        finishedTrials = 0;
        score = 0;
        missCount = 0;
        reactionTimes = [];
        trialLog = [];
        currentStimulus = null;
        sessionStartedAt = null;
        totalTrials = sanitizeTrials(trialSetting.value);
        updateStats();
    }

    resetUI();
});
