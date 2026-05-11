document.addEventListener("DOMContentLoaded", () => {
    const CONTENT_VERSION = "flanker-v2-conflict-training";
    const RESPONSE_WINDOW_MS = 2000;
    const INTER_TRIAL_INTERVAL_MS = 220;
    const STIMULUS_SIZE = 5;

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
    const flankerEffectDisplay = document.getElementById("flanker-effect");
    const errorBreakdownDisplay = document.getElementById("error-breakdown");
    const resultExplanationDisplay = document.getElementById("result-explanation");
    const restartBtn = document.getElementById("restart-btn");

    let isPlaying = false;
    let isPaused = false;
    let roundOpen = false;
    let totalTrials = 50;
    let finishedTrials = 0;
    let score = 0;
    let currentStimulus = null;
    let sessionStartedAt = null;
    let sessionSeed = "";
    let sessionSaved = false;
    let stimulusStartTime = 0;
    let reactionTimes = [];
    let trialPlan = [];
    let trialLog = [];
    let rng = fallbackMulberry32(1);
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

    function formatPercent(value) {
        return `${Math.round(value * 100)}%`;
    }

    function oppositeDirection(direction) {
        return direction === "left" ? "right" : "left";
    }

    function createFallbackSeed(prefix) {
        if (window.crypto && typeof window.crypto.getRandomValues === "function") {
            const bytes = new Uint32Array(2);
            window.crypto.getRandomValues(bytes);
            return `${prefix}-${bytes[0].toString(36)}${bytes[1].toString(36)}`;
        }
        return `${prefix}-${Date.now().toString(36)}-${Math.round(performance.now() * 1000).toString(36)}`;
    }

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

    function initializeSessionRandom() {
        const seeded = window.SeededRandom;
        sessionSeed = seeded ? seeded.createSessionSeed("flanker") : createFallbackSeed("flanker");
        rng = seeded ? seeded.createRngFromSeed(sessionSeed) : fallbackMulberry32(fallbackHashString(sessionSeed));
    }

    function shuffleInPlace(list) {
        if (window.SeededRandom) {
            return window.SeededRandom.shuffleInPlace(list, rng);
        }
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    function buildTrialPlan(count) {
        initializeSessionRandom();
        const list = [];
        const congruentCount = Math.ceil(count / 2);
        const incongruentCount = count - congruentCount;

        function addCondition(condition, conditionCount) {
            for (let i = 0; i < conditionCount; i += 1) {
                list.push({
                    condition,
                    targetDirection: i % 2 === 0 ? "left" : "right"
                });
            }
        }

        addCondition("congruent", congruentCount);
        addCondition("incongruent", incongruentCount);

        shuffleInPlace(list);
        return list.map((item, index) => {
            const flankerDirection = item.condition === "congruent"
                ? item.targetDirection
                : oppositeDirection(item.targetDirection);
            return {
                index,
                condition: item.condition,
                targetDirection: item.targetDirection,
                flankerDirection,
                correctResponse: item.targetDirection,
                targetPosition: Math.floor(rng() * STIMULUS_SIZE)
            };
        });
    }

    function errorTypeFor(stimulus, response, timedOut, correct) {
        if (correct) return null;
        if (timedOut) return "timeout";
        if (stimulus.condition === "incongruent" && response === stimulus.flankerDirection) {
            return "flanker-capture";
        }
        return "direction-error";
    }

    function recordTrial(response, correct, rtMs, timedOut = false) {
        if (!currentStimulus) return;

        const roundedRt = Number.isFinite(rtMs) ? Math.round(rtMs) : null;
        const errorType = errorTypeFor(currentStimulus, response, timedOut, correct);

        trialLog.push({
            index: currentStimulus.index,
            trialIndex: currentStimulus.index,
            condition: currentStimulus.condition,
            stimulus: currentStimulus.text,
            targetDirection: currentStimulus.targetDirection,
            flankerDirection: currentStimulus.flankerDirection,
            correctResponse: currentStimulus.correctResponse,
            response: response || null,
            correct,
            rtMs: roundedRt,
            timedOut: Boolean(timedOut),
            errorType,
            targetPosition: currentStimulus.targetPosition
        });
    }

    function buildSummary() {
        const completedTrials = trialLog.length;
        const correctTrials = trialLog.filter((trial) => trial.correct);
        const correctCount = correctTrials.length;
        const congruentTrials = trialLog.filter((trial) => trial.condition === "congruent");
        const incongruentTrials = trialLog.filter((trial) => trial.condition === "incongruent");
        const congruentCorrectRt = congruentTrials
            .filter((trial) => trial.correct)
            .map((trial) => trial.rtMs);
        const incongruentCorrectRt = incongruentTrials
            .filter((trial) => trial.correct)
            .map((trial) => trial.rtMs);
        const congruentMeanRtMs = average(congruentCorrectRt);
        const incongruentMeanRtMs = average(incongruentCorrectRt);
        const canEstimateEffect = congruentMeanRtMs > 0 && incongruentMeanRtMs > 0;

        return {
            totalTrials: completedTrials,
            plannedTrials: totalTrials,
            correctCount,
            accuracy: completedTrials > 0 ? correctCount / completedTrials : 0,
            meanRtMs: average(correctTrials.map((trial) => trial.rtMs)),
            responseMeanRtMs: average(trialLog.map((trial) => trial.rtMs)),
            congruentAccuracy: accuracyFor(congruentTrials),
            incongruentAccuracy: accuracyFor(incongruentTrials),
            congruentMeanRtMs,
            incongruentMeanRtMs,
            flankerEffectMs: canEstimateEffect ? incongruentMeanRtMs - congruentMeanRtMs : 0,
            errorCount: completedTrials - correctCount,
            timeoutCount: trialLog.filter((trial) => trial.timedOut).length,
            flankerCaptureErrorCount: trialLog.filter((trial) => trial.errorType === "flanker-capture").length,
            directionErrorCount: trialLog.filter((trial) => trial.errorType === "direction-error").length,
            congruentTrials: congruentTrials.length,
            incongruentTrials: incongruentTrials.length,
            responseWindowMs: RESPONSE_WINDOW_MS,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            sessionSeed
        };
    }

    function saveTrainingResult(finishedAt, summary = buildSummary()) {
        if (
            sessionSaved
            || !window.TrainingResults
            || typeof window.TrainingResults.saveSession !== "function"
            || !sessionStartedAt
        ) {
            return;
        }

        window.TrainingResults.saveSession({
            moduleId: "flanker",
            gameId: "flanker",
            gameName: "Flanker 专注力训练",
            startedAt: sessionStartedAt,
            finishedAt,
            durationMs: Math.max(0, finishedAt.getTime() - sessionStartedAt.getTime()),
            score,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: trialLog.map((trial) => ({ ...trial })),
            metrics: {
                accuracy: formatPercent(summary.accuracy),
                meanRt: `${summary.meanRtMs}ms`,
                congruentAccuracy: formatPercent(summary.congruentAccuracy),
                incongruentAccuracy: formatPercent(summary.incongruentAccuracy),
                flankerEffect: `${summary.flankerEffectMs}ms`,
                errors: summary.errorCount,
                seed: sessionSeed,
                sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ["attention", "selective-attention", "conflict-inhibition", "flanker"]
        });

        sessionSaved = true;
    }

    function startGame() {
        if (isPlaying) return;

        totalTrials = sanitizeTrials(trialSetting.value);
        trialSetting.value = String(totalTrials);
        finishedTrials = 0;
        score = 0;
        reactionTimes = [];
        currentStimulus = null;
        sessionStartedAt = new Date();
        sessionSaved = false;
        trialLog = [];
        trialPlan = buildTrialPlan(totalTrials);
        isPlaying = true;
        isPaused = false;
        roundOpen = false;

        resultModal.classList.add("hidden");
        setControlState(true);
        leftBtn.disabled = false;
        rightBtn.disabled = false;
        showFeedback("开始训练：只按红色目标箭头方向", "correct");
        updateStats();

        clearTimeout(nextRoundTimeout);
        nextRoundTimeout = setTimeout(nextRound, 300);
    }

    function buildStimulus(trialIndex) {
        const planned = trialPlan[trialIndex];
        const targetChar = planned.targetDirection === "left" ? "<" : ">";
        const flankerChar = planned.flankerDirection === "left" ? "<" : ">";
        const htmlChars = [];
        const textChars = [];

        for (let i = 0; i < STIMULUS_SIZE; i += 1) {
            if (i === planned.targetPosition) {
                htmlChars.push(`<span style="color:#e74c3c">${targetChar}</span>`);
                textChars.push(targetChar);
            } else {
                htmlChars.push(flankerChar);
                textChars.push(flankerChar);
            }
        }

        return {
            ...planned,
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
        currentStimulus = stimulus;
        display.innerHTML = stimulus.html;
        stimulusStartTime = Date.now();
        roundOpen = true;

        clearTimeout(trialTimeout);
        trialTimeout = setTimeout(handleTimeout, RESPONSE_WINDOW_MS);
    }

    function handleTimeout() {
        if (!roundOpen || !isPlaying || isPaused) return;

        roundOpen = false;
        recordTrial(null, false, null, true);
        currentStimulus = null;
        finishedTrials += 1;
        showFeedback("超时：未在 2 秒内作答", "wrong");
        updateStats();
        scheduleNextRound();
    }

    function scheduleNextRound() {
        clearTimeout(nextRoundTimeout);
        nextRoundTimeout = setTimeout(nextRound, INTER_TRIAL_INTERVAL_MS);
    }

    function handleResponse(response) {
        if (!isPlaying || isPaused || !roundOpen || !currentStimulus) return;

        roundOpen = false;
        clearTimeout(trialTimeout);

        const stimulus = currentStimulus;
        const rt = Date.now() - stimulusStartTime;
        reactionTimes.push(rt);
        const correct = response === stimulus.correctResponse;
        recordTrial(response, correct, rt, false);
        currentStimulus = null;
        if (correct) {
            score += 1;
            showFeedback("正确", "correct");
        } else if (stimulus.condition === "incongruent" && response === stimulus.flankerDirection) {
            showFeedback("受干扰箭头影响", "wrong");
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
            trialTimeout = setTimeout(handleTimeout, RESPONSE_WINDOW_MS);
            return;
        }

        scheduleNextRound();
    }

    function buildEffectExplanation(summary) {
        if (summary.congruentMeanRtMs === 0 || summary.incongruentMeanRtMs === 0) {
            return "两类条件的正确反应不足，暂不能稳定估计 flankerEffect（干扰成本）。";
        }
        if (summary.flankerEffectMs > 0) {
            return `flankerEffect（干扰成本）为 ${summary.flankerEffectMs} ms：不一致条件平均比一致条件慢，表示抑制干扰箭头需要额外时间。`;
        }
        if (summary.flankerEffectMs < 0) {
            return `flankerEffect（干扰成本）为 ${summary.flankerEffectMs} ms：不一致条件平均比一致条件快 ${Math.abs(summary.flankerEffectMs)} ms，可能来自练习波动或样本量偏小。`;
        }
        return "flankerEffect（干扰成本）为 0 ms：本轮一致与不一致条件的平均正确反应时间相同。";
    }

    function buildErrorBreakdown(summary) {
        const errorTypes = [
            { label: "超时", count: summary.timeoutCount },
            { label: "被干扰方向带偏", count: summary.flankerCaptureErrorCount },
            { label: "其他方向错误", count: summary.directionErrorCount }
        ].filter((item) => item.count > 0);
        const primaryError = errorTypes.length > 0
            ? errorTypes.sort((a, b) => b.count - a.count)[0]
            : null;
        const primaryText = primaryError
            ? `主要错误类型：${primaryError.label}（${primaryError.count} 次）。`
            : "主要错误类型：无。";

        return `超时 ${summary.timeoutCount} 次；被干扰方向带偏 ${summary.flankerCaptureErrorCount} 次；其他方向错误 ${summary.directionErrorCount} 次。${primaryText}`;
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

        const finishedAt = new Date();
        const summary = buildSummary();
        saveTrainingResult(finishedAt, summary);

        if (forced) {
            showFeedback(`已停止（完成 ${finishedTrials} / ${totalTrials}，错误 ${summary.errorCount}）`);
            updateStats();
            return;
        }

        finalScoreDisplay.textContent = `${summary.correctCount} / ${summary.totalTrials}（${formatPercent(summary.accuracy)}）`;
        avgRtDisplay.textContent = String(summary.meanRtMs);
        if (flankerEffectDisplay) {
            flankerEffectDisplay.textContent = `${summary.flankerEffectMs} ms`;
        }
        if (errorBreakdownDisplay) {
            errorBreakdownDisplay.textContent = buildErrorBreakdown(summary);
        }
        if (resultExplanationDisplay) {
            resultExplanationDisplay.textContent = buildEffectExplanation(summary);
        }
        showFeedback(`完成：正确 ${summary.correctCount}，错误 ${summary.errorCount}，干扰成本 ${summary.flankerEffectMs} ms`, "correct");
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
        reactionTimes = [];
        trialPlan = [];
        trialLog = [];
        currentStimulus = null;
        sessionStartedAt = null;
        sessionSeed = "";
        sessionSaved = false;
        rng = fallbackMulberry32(1);
        totalTrials = sanitizeTrials(trialSetting.value);
        if (flankerEffectDisplay) flankerEffectDisplay.textContent = "";
        if (errorBreakdownDisplay) errorBreakdownDisplay.textContent = "";
        if (resultExplanationDisplay) resultExplanationDisplay.textContent = "";
        updateStats();
    }

    resetUI();
});
