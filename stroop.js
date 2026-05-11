document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const gridSizeInput = document.getElementById('grid-size');
    const gridContainer = document.getElementById('stroop-grid');
    const timerDisplay = document.getElementById('timer');
    const progressDisplay = document.getElementById('progress');
    const correctCountDisplay = document.getElementById('correct-count');
    const avgRtLiveDisplay = document.getElementById('avg-rt-live');
    const feedbackDisplay = document.getElementById('stroop-feedback');
    const manualControls = document.getElementById('manual-controls');
    const voiceStatus = document.getElementById('voice-status');
    const voiceFeedback = document.getElementById('voice-feedback');
    const volumeBar = document.getElementById('volume-bar');
    const transcriptDisplay = document.getElementById('transcript-display');
    const modeRadios = document.querySelectorAll('input[name="play-mode"]');
    const resultModal = document.getElementById('result-modal');
    const finalScoreDisplay = document.getElementById('final-score');
    const resultAccuracyDisplay = document.getElementById('result-accuracy');
    const resultMeanRtDisplay = document.getElementById('result-mean-rt');
    const resultCongruentRtDisplay = document.getElementById('result-congruent-rt');
    const resultIncongruentRtDisplay = document.getElementById('result-incongruent-rt');
    const resultStroopEffectDisplay = document.getElementById('result-stroop-effect');
    const resultErrorCountDisplay = document.getElementById('result-error-count');
    const resultFeedbackDisplay = document.getElementById('result-feedback');
    const restartBtn = document.getElementById('restart-btn');

    const GAME_ID = "stroop";
    const GAME_NAME = "斯特鲁普测试";
    const CONTENT_VERSION = "stroop-p0a-v1";
    const CONGRUENT_RATIO = 0.35;
    let startTime = 0;
    let timerInterval = null;
    let isPlaying = false;
    let isVoiceMode = false;
    let recognition = null;
    let currentIndex = 0;
    let gridData = [];
    let audioContext = null;
    let mediaStream = null;
    let sessionStartedAt = null;
    let sessionInputMode = "manual";
    let sessionSaved = false;
    let sessionTrials = [];
    let currentTrialStartedAt = 0;
    let sessionSeed = null;
    let responseButtons = [];

    // Electron detection
    const isElectron = /Electron/.test(navigator.userAgent);

    // Colors: Red, Orange, Yellow, Green, Cyan, Blue, Purple
    const colors = [
        { name: '红', hex: '#e74c3c' },
        { name: '橙', hex: '#e67e22' },
        { name: '黄', hex: '#f1c40f' },
        { name: '绿', hex: '#2ecc71' },
        { name: '青', hex: '#1abc9c' },
        { name: '蓝', hex: '#3498db' },
        { name: '紫', hex: '#9b59b6' }
    ];

    function average(values) {
        const validValues = values.filter((value) => Number.isFinite(value));
        if (!validValues.length) return null;
        return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
    }

    function ratio(correctCount, totalCount) {
        return totalCount > 0 ? correctCount / totalCount : null;
    }

    function formatPercent(value) {
        return Number.isFinite(value) ? `${Math.round(value * 100)}%` : "--";
    }

    function formatMs(value) {
        return Number.isFinite(value) ? `${value}ms` : "--";
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

    function createFallbackToken() {
        if (window.crypto && typeof window.crypto.getRandomValues === "function") {
            const bytes = new Uint32Array(2);
            window.crypto.getRandomValues(bytes);
            return `${bytes[0].toString(36)}${bytes[1].toString(36)}`;
        }
        const now = Date.now().toString(36);
        const preciseNow = window.performance && typeof window.performance.now === "function"
            ? Math.round(window.performance.now() * 1000).toString(36)
            : "0";
        return `${now}${preciseNow}`;
    }

    function createSessionSeed() {
        if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === "function") {
            return window.SeededRandom.createSessionSeed(GAME_ID);
        }
        return `${GAME_ID}-${Date.now().toString(36)}-${createFallbackToken()}`;
    }

    function createRng(seed) {
        if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
            return window.SeededRandom.createRngFromSeed(seed);
        }
        return fallbackMulberry32(fallbackHashString(seed));
    }

    function createPreviewRng() {
        const previewSeed = `${GAME_ID}-preview-${Date.now().toString(36)}-${gridSizeInput.value}`;
        return createRng(previewSeed);
    }

    function shuffleInPlace(list, rng) {
        if (window.SeededRandom && typeof window.SeededRandom.shuffleInPlace === "function") {
            return window.SeededRandom.shuffleInPlace(list, rng);
        }
        for (let i = list.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [list[i], list[j]] = [list[j], list[i]];
        }
        return list;
    }

    function pickColor(rng) {
        return colors[Math.floor(rng() * colors.length)];
    }

    function pickDifferentColor(wordColor, rng) {
        let colorObj = pickColor(rng);
        while (colorObj.name === wordColor.name) {
            colorObj = pickColor(rng);
        }
        return colorObj;
    }

    function buildConditionList(totalTrials, rng) {
        const congruentCount = Math.max(1, Math.round(totalTrials * CONGRUENT_RATIO));
        const incongruentCount = Math.max(1, totalTrials - congruentCount);
        const conditions = [];

        for (let i = 0; i < congruentCount; i += 1) {
            conditions.push("congruent");
        }
        for (let i = 0; i < incongruentCount; i += 1) {
            conditions.push("incongruent");
        }

        return shuffleInPlace(conditions.slice(0, totalTrials), rng);
    }

    function renderManualControls() {
        if (!manualControls) return;
        manualControls.textContent = "";
        responseButtons = colors.map((color) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "color-choice";
            button.dataset.color = color.name;
            button.textContent = `${color.name}色`;
            button.style.borderColor = color.hex;
            button.style.color = color.hex;
            button.disabled = true;
            button.addEventListener("click", () => handleManualResponse(color.name));
            manualControls.appendChild(button);
            return button;
        });
    }

    function setManualControlsState() {
        if (manualControls) {
            manualControls.style.display = isVoiceMode ? "none" : "flex";
        }
        responseButtons.forEach((button) => {
            button.disabled = !isPlaying || isVoiceMode;
        });
    }

    function createSessionTrials(inputMode) {
        return gridData.map((item, index) => ({
            index,
            condition: item.condition,
            congruency: item.condition,
            stimulusText: item.stimulusText,
            stimulusColor: item.stimulusColor,
            stimulusColorHex: item.stimulusColorHex,
            correctResponse: item.correctResponse,
            response: null,
            correct: null,
            rtMs: null,
            timedOut: false,
            inputMode,
            attemptCount: 0,
            hadError: false,
            wrongResponses: [],
            startedAt: null,
            finishedAt: null,
            _startedAtMs: null
        }));
    }

    function serializeTrials() {
        return sessionTrials.map((trial) => ({
            index: trial.index,
            condition: trial.condition,
            stimulusText: trial.stimulusText,
            stimulusColor: trial.stimulusColor,
            stimulusColorHex: trial.stimulusColorHex,
            correctResponse: trial.correctResponse,
            response: trial.response,
            correct: trial.correct,
            rtMs: trial.rtMs,
            timedOut: trial.timedOut,
            inputMode: trial.inputMode,
            attemptCount: trial.attemptCount,
            hadError: trial.hadError,
            wrongResponses: trial.wrongResponses.slice(),
            startedAt: trial.startedAt,
            finishedAt: trial.finishedAt
        }));
    }

    function markCurrentTrialStart(index) {
        currentTrialStartedAt = Date.now();
        const trial = sessionTrials[index];
        if (trial && !trial.startedAt) {
            trial.startedAt = new Date(currentTrialStartedAt).toISOString();
            trial._startedAtMs = currentTrialStartedAt;
        }
    }

    function recordTrialResponse(index, response, correct, options = {}) {
        const trial = sessionTrials[index];
        if (!trial || trial.finishedAt) return null;

        const now = Date.now();
        const startedAtMs = Number.isFinite(trial._startedAtMs) ? trial._startedAtMs : currentTrialStartedAt;
        const rtMs = startedAtMs > 0 ? Math.max(0, Math.round(now - startedAtMs)) : null;
        const complete = options.complete !== false;
        const timedOut = Boolean(options.timedOut);

        trial.attemptCount += 1;
        trial.response = response;
        trial.rtMs = Number.isFinite(rtMs) ? rtMs : null;

        if (!correct) {
            trial.hadError = true;
            trial.wrongResponses.push({
                response,
                rtMs: trial.rtMs
            });
        }

        if (complete || correct || timedOut) {
            trial.correct = Boolean(correct);
            trial.timedOut = timedOut;
            trial.finishedAt = new Date(now).toISOString();
        }

        return trial;
    }

    function finalizeIncompleteTrials(finishedAt, endReason) {
        if (endReason === "completed") return;

        sessionTrials.forEach((trial) => {
            if (trial.finishedAt) return;

            const startedAtMs = Number.isFinite(trial._startedAtMs) ? trial._startedAtMs : null;
            trial.correct = false;
            trial.timedOut = true;
            trial.hadError = true;
            trial.rtMs = Number.isFinite(trial.rtMs)
                ? trial.rtMs
                : (startedAtMs ? Math.max(0, Math.round(finishedAt.getTime() - startedAtMs)) : null);
            trial.finishedAt = finishedAt.toISOString();
        });
    }

    function getCompletedTrials() {
        return sessionTrials.filter((trial) => trial.finishedAt || trial.correct !== null || trial.timedOut);
    }

    function calculateSessionSummary() {
        const trials = sessionTrials.length ? sessionTrials : createSessionTrials(sessionInputMode);
        const totalTrials = trials.length;
        const completedTrials = trials.filter((trial) => trial.finishedAt || trial.correct !== null || trial.timedOut);
        const correctTrials = trials.filter((trial) => trial.correct === true);
        const congruentTrials = trials.filter((trial) => trial.condition === "congruent");
        const incongruentTrials = trials.filter((trial) => trial.condition === "incongruent");
        const correctRtSamples = correctTrials.map((trial) => trial.rtMs);
        const congruentMeanRtMs = average(congruentTrials
            .filter((trial) => trial.correct === true)
            .map((trial) => trial.rtMs));
        const incongruentMeanRtMs = average(incongruentTrials
            .filter((trial) => trial.correct === true)
            .map((trial) => trial.rtMs));
        const stroopEffectMs = Number.isFinite(congruentMeanRtMs) && Number.isFinite(incongruentMeanRtMs)
            ? incongruentMeanRtMs - congruentMeanRtMs
            : null;
        const errorCount = trials.filter((trial) => trial.correct === false || trial.timedOut || trial.hadError).length;

        return {
            totalTrials,
            completedTrials: completedTrials.length,
            correctCount: correctTrials.length,
            accuracy: ratio(correctTrials.length, totalTrials),
            meanRtMs: average(correctRtSamples),
            congruentMeanRtMs,
            incongruentMeanRtMs,
            stroopEffectMs,
            errorCount,
            congruentTrials: congruentTrials.length,
            incongruentTrials: incongruentTrials.length,
            congruentAccuracy: ratio(congruentTrials.filter((trial) => trial.correct === true).length, congruentTrials.length),
            incongruentAccuracy: ratio(incongruentTrials.filter((trial) => trial.correct === true).length, incongruentTrials.length),
            inputMode: sessionInputMode,
            gridSize: parseInt(gridSizeInput.value, 10) || null,
            completed: completedTrials.length === totalTrials,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        };
    }

    function saveTrainingSession(endReason, finishedAt, summary) {
        if (sessionSaved || !sessionStartedAt) return;
        sessionSaved = true;

        const durationMs = Math.max(0, finishedAt.getTime() - sessionStartedAt.getTime());
        const score = Number.isFinite(summary.accuracy) ? Math.round(summary.accuracy * 100) : null;
        const metrics = {
            accuracy: formatPercent(summary.accuracy),
            meanRT: formatMs(summary.meanRtMs),
            congruentMeanRT: formatMs(summary.congruentMeanRtMs),
            incongruentMeanRT: formatMs(summary.incongruentMeanRtMs),
            stroopEffect: formatMs(summary.stroopEffectMs),
            errorCount: summary.errorCount,
            inputMode: sessionInputMode,
            endReason,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        };

        if (window.TrainingResults && typeof window.TrainingResults.saveSession === "function") {
            try {
                window.TrainingResults.saveSession({
                    moduleId: GAME_ID,
                    gameId: GAME_ID,
                    gameName: GAME_NAME,
                    startedAt: sessionStartedAt,
                    finishedAt,
                    durationMs,
                    score,
                    seed: sessionSeed,
                    contentVersion: CONTENT_VERSION,
                    summary,
                    trials: serializeTrials(),
                    metrics,
                    tags: ["attention", "stroop", "inhibition", "training"]
                });
            } catch (error) {
                console.error("Failed to save Stroop training result", error);
            }
        }
    }

    function updateStats() {
        const total = sessionTrials.length || gridData.length;
        const completedTrials = getCompletedTrials();
        const correctCount = sessionTrials.filter((trial) => trial.correct === true).length;
        const meanRtMs = average(sessionTrials
            .filter((trial) => trial.correct === true)
            .map((trial) => trial.rtMs));

        if (progressDisplay) progressDisplay.textContent = `${completedTrials.length} / ${total}`;
        if (correctCountDisplay) correctCountDisplay.textContent = String(correctCount);
        if (avgRtLiveDisplay) avgRtLiveDisplay.textContent = Number.isFinite(meanRtMs) ? `${meanRtMs} ms` : "--";
    }

    function showFeedback(text, type = "") {
        if (!feedbackDisplay) return;
        feedbackDisplay.textContent = text;
        feedbackDisplay.className = type ? `stroop-feedback ${type}` : "stroop-feedback";
    }

    function buildPerformanceFeedback(summary, endReason) {
        const accuracyText = Number.isFinite(summary.accuracy)
            ? `正确率 ${formatPercent(summary.accuracy)}`
            : "正确率暂无有效样本";
        const speedText = Number.isFinite(summary.meanRtMs)
            ? `平均正确反应 ${summary.meanRtMs}ms`
            : "反应速度暂无有效样本";

        let interferenceText = "一致和不一致条件样本不足，暂不能稳定估计干扰成本";
        if (Number.isFinite(summary.stroopEffectMs)) {
            if (summary.stroopEffectMs > 150) {
                interferenceText = `不一致条件慢 ${summary.stroopEffectMs}ms，语义干扰成本偏高`;
            } else if (summary.stroopEffectMs > 50) {
                interferenceText = `不一致条件慢 ${summary.stroopEffectMs}ms，存在可见干扰成本`;
            } else if (summary.stroopEffectMs >= -50) {
                interferenceText = `干扰成本 ${summary.stroopEffectMs}ms，一致/不一致反应接近`;
            } else {
                interferenceText = `干扰成本 ${summary.stroopEffectMs}ms，本轮不一致条件未慢于一致条件，可能受样本量或策略影响`;
            }
        }

        const completionText = endReason === "completed"
            ? "本轮已完成全部刺激"
            : `本轮提前结束，未完成刺激已作为超时/遗漏记录`;

        return `${completionText}。${accuracyText}；${speedText}；${interferenceText}。可点击“重新训练一轮”再次开始。`;
    }

    function showSessionResult(summary, endReason) {
        if (!resultModal) {
            alert(buildPerformanceFeedback(summary, endReason));
            return;
        }

        if (finalScoreDisplay) {
            finalScoreDisplay.textContent = `${summary.correctCount} / ${summary.totalTrials}`;
        }
        if (resultAccuracyDisplay) resultAccuracyDisplay.textContent = formatPercent(summary.accuracy);
        if (resultMeanRtDisplay) resultMeanRtDisplay.textContent = formatMs(summary.meanRtMs);
        if (resultCongruentRtDisplay) resultCongruentRtDisplay.textContent = formatMs(summary.congruentMeanRtMs);
        if (resultIncongruentRtDisplay) resultIncongruentRtDisplay.textContent = formatMs(summary.incongruentMeanRtMs);
        if (resultStroopEffectDisplay) resultStroopEffectDisplay.textContent = formatMs(summary.stroopEffectMs);
        if (resultErrorCountDisplay) resultErrorCountDisplay.textContent = String(summary.errorCount);
        if (resultFeedbackDisplay) resultFeedbackDisplay.textContent = buildPerformanceFeedback(summary, endReason);

        resultModal.classList.remove("hidden");
    }

    function renderTranscript(displayFinal, displayInterim) {
        if (!transcriptDisplay) return;
        transcriptDisplay.textContent = "";
        const finalSpan = document.createElement("span");
        finalSpan.style.color = "#2c3e50";
        finalSpan.textContent = displayFinal;
        const interimSpan = document.createElement("span");
        interimSpan.style.color = "#95a5a6";
        interimSpan.textContent = displayInterim;
        transcriptDisplay.appendChild(finalSpan);
        transcriptDisplay.appendChild(interimSpan);
    }

    function renderOpenInBrowserHint(linkId) {
        voiceStatus.textContent = "";
        voiceStatus.append("桌面版暂不支持云端语音识别。");
        voiceStatus.appendChild(document.createElement("br"));

        const link = document.createElement("a");
        link.id = linkId;
        link.href = "#";
        link.textContent = "在浏览器中打开";
        link.addEventListener("click", (event) => {
            event.preventDefault();
            try {
                window.electronShell.openPath(window.location.href);
            } catch (_error) {
                alert("无法打开浏览器，请手动复制文件路径到 Chrome/Edge 中打开。");
            }
        });
        voiceStatus.appendChild(link);
    }

    function setControlState(playing) {
        startBtn.style.display = playing ? 'none' : 'inline-block';
        stopBtn.style.display = playing ? 'inline-block' : 'none';
        gridSizeInput.disabled = playing;
        modeRadios.forEach((radio) => {
            radio.disabled = playing;
        });
        setManualControlsState();
    }

    // Mode switching
    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            isVoiceMode = e.target.value === 'voice';
            if (isPlaying) {
                stopGame("mode-changed");
            }
            updateUIForMode();
        });
    });

    function updateUIForMode() {
        if (isVoiceMode) {
            voiceStatus.style.display = 'block';
            voiceFeedback.classList.add('active');
            transcriptDisplay.textContent = "等待语音输入...";

            if (isElectron) {
                renderOpenInBrowserHint("open-browser-link");
                voiceStatus.className = "voice-status";
                voiceStatus.style.height = "auto";
                voiceStatus.style.color = "#e67e22";
            } else {
                voiceStatus.textContent = "请点击“开始”并允许麦克风权限";
                voiceStatus.className = "voice-status";
            }
        } else {
            voiceStatus.style.display = 'none';
            voiceFeedback.classList.remove('active');
        }
        setManualControlsState();
    }

    gridSizeInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 3) val = 3;
        if (val > 7) val = 7;
        e.target.value = val;

        if (!isPlaying) {
            generateGrid(createPreviewRng());
            updateStats();
        }
    });

    startBtn.addEventListener('click', () => {
        if (isPlaying) {
            stopGame();
        } else {
            startGame();
        }
    });
    stopBtn.addEventListener('click', () => stopGame("stopped"));

    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            if (resultModal) resultModal.classList.add("hidden");
            startGame();
        });
    }

    function startGame() {
        sessionSeed = createSessionSeed();
        generateGrid(createRng(sessionSeed));

        currentIndex = 0;
        sessionInputMode = isVoiceMode ? "voice" : "manual";
        sessionSaved = false;
        sessionTrials = createSessionTrials(sessionInputMode);
        currentTrialStartedAt = 0;
        sessionStartedAt = new Date();
        isPlaying = true;

        if (resultModal) resultModal.classList.add("hidden");
        showFeedback(isVoiceMode ? "请读出高亮字的颜色" : "请选择高亮字的颜色", "active");
        setControlState(true);
        startTimer();
        updateStats();

        if (isVoiceMode) {
            initSpeechRecognition();
            startAudioContext();
        }
        highlightCell(0);
    }

    function stopGame(endReason = "stopped") {
        if (!isPlaying || !sessionStartedAt) return;

        const finishedAt = new Date();
        finalizeIncompleteTrials(finishedAt, endReason);
        stopTimer();
        isPlaying = false;
        setControlState(false);

        stopAudioContext();

        if (recognition) {
            recognition.stop();
            recognition = null;
        }

        document.querySelectorAll('.stroop-cell.active').forEach(c => c.classList.remove('active'));

        const summary = calculateSessionSummary();
        saveTrainingSession(endReason, finishedAt, summary);
        updateStats();

        if (endReason === "completed") {
            if (voiceStatus) {
                voiceStatus.textContent = "挑战完成！";
                voiceStatus.className = "voice-status matched";
            }
            showFeedback("训练完成", "correct");
        } else {
            if (voiceStatus) {
                voiceStatus.textContent = "已停止";
                voiceStatus.className = "voice-status";
            }
            showFeedback("训练已结束", "wrong");
        }

        showSessionResult(summary, endReason);
    }

    function generateGrid(rng) {
        const activeRng = typeof rng === "function" ? rng : createPreviewRng();
        const n = parseInt(gridSizeInput.value) || 4;
        gridContainer.innerHTML = '';
        gridData = [];

        gridContainer.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

        const totalCells = n * n;
        const conditions = buildConditionList(totalCells, activeRng);

        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.className = 'stroop-cell';

            const wordColor = pickColor(activeRng);
            const condition = conditions[i];
            const inkColor = condition === "congruent"
                ? wordColor
                : pickDifferentColor(wordColor, activeRng);

            cell.textContent = wordColor.name;
            cell.style.color = inkColor.hex;

            const sizeMap = {
                3: { font: '60px', height: '100px', width: '100px' },
                4: { font: '50px', height: '90px', width: '90px' },
                5: { font: '40px', height: '70px', width: '70px' },
                6: { font: '30px', height: '60px', width: '60px' },
                7: { font: '24px', height: '50px', width: '50px' }
            };
            const style = sizeMap[n] || sizeMap[4];

            if (window.innerWidth <= 768) {
                const mobileSize = Math.floor((window.innerWidth - 40) / n) - 10;
                cell.style.fontSize = `${mobileSize * 0.5}px`;
                cell.style.height = `${mobileSize}px`;
                cell.style.width = `${mobileSize}px`;
            } else {
                cell.style.fontSize = style.font;
                cell.style.height = style.height;
                cell.style.width = style.width;
            }

            gridContainer.appendChild(cell);

            gridData.push({
                element: cell,
                stimulusText: wordColor.name,
                stimulusColor: inkColor.name,
                stimulusColorHex: inkColor.hex,
                correctResponse: inkColor.name,
                condition
            });
        }
    }

    function startTimer() {
        startTime = Date.now();
        timerDisplay.textContent = "00:00";
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const seconds = Math.floor(elapsed / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }

    function stopTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    function highlightCell(index) {
        gridData.forEach(d => d.element.classList.remove('active'));

        if (index < gridData.length) {
            const current = gridData[index];
            current.element.classList.add('active');
            markCurrentTrialStart(index);
            current.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        stopGame("completed");
    }

    function advanceToNextTrial() {
        currentIndex += 1;
        updateStats();
        highlightCell(currentIndex);
    }

    function handleManualResponse(response) {
        if (!isPlaying || isVoiceMode || currentIndex >= gridData.length) return;

        const currentTarget = gridData[currentIndex].correctResponse;
        const correct = response === currentTarget;
        recordTrialResponse(currentIndex, response, correct, { complete: true });

        const cell = gridData[currentIndex].element;
        cell.classList.remove('active');
        cell.classList.add(correct ? 'correct' : 'wrong');
        showFeedback(correct ? "正确" : `错误，应选 ${currentTarget}色`, correct ? "correct" : "wrong");

        advanceToNextTrial();
    }

    // --- Voice Logic ---

    function initSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            alert("您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器。");
            isVoiceMode = false;
            updateUIForMode();
            stopGame("speech-unsupported");
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            voiceStatus.textContent = "正在聆听... 请读出高亮字的颜色";
            voiceStatus.className = "voice-status listening";
        };

        recognition.onresult = (event) => {
            if (!isPlaying) return;

            let displayFinal = '';
            let displayInterim = '';

            for (let i = 0; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    displayFinal += event.results[i][0].transcript;
                } else {
                    displayInterim += event.results[i][0].transcript;
                }
            }
            renderTranscript(displayFinal, displayInterim);

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    handleVoiceInput(event.results[i][0].transcript.trim());
                }
            }
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            if (event.error === 'not-allowed') {
                voiceStatus.textContent = "麦克风权限被拒绝，请允许后重试";
                voiceStatus.className = "voice-status";
                stopGame("microphone-denied");
            } else if (event.error === 'service-not-allowed') {
                voiceStatus.textContent = "当前浏览器不支持语音服务，请使用 Chrome/Edge";
                voiceStatus.className = "voice-status";
                stopGame("speech-service-blocked");
            } else if (event.error === 'network') {
                if (isElectron) {
                    voiceStatus.textContent = "";
                    voiceStatus.append("网络错误：桌面版缺少语音 API 密钥。");
                    voiceStatus.appendChild(document.createElement("br"));
                    const link = document.createElement("a");
                    link.href = "#";
                    link.textContent = "在浏览器中打开";
                    link.addEventListener("click", (e) => {
                        e.preventDefault();
                        try {
                            window.electronShell.openPath(window.location.href);
                        } catch (_err) {
                            // ignore
                        }
                    });
                    voiceStatus.appendChild(link);
                } else {
                    voiceStatus.textContent = "网络错误，无法连接语音服务";
                }
                voiceStatus.className = "voice-status";
                voiceStatus.style.height = "auto";
                stopGame("speech-network-error");
            }
        };

        recognition.onend = () => {
            if (isPlaying && isVoiceMode && recognition) {
                try {
                    recognition.start();
                } catch (e) {
                    console.log("Recognition restart suppressed:", e);
                }
            }
        };

        try {
            recognition.start();
        } catch (e) {
            console.error(e);
        }
    }

    function handleVoiceInput(text) {
        if (currentIndex >= gridData.length) return;

        const currentTarget = gridData[currentIndex].correctResponse;
        const cleanText = text.replace(/[.,?!。，？！]/g, '');
        const matched = cleanText.includes(currentTarget);

        recordTrialResponse(currentIndex, cleanText, matched, { complete: matched });

        const statusEl = voiceStatus;

        if (matched) {
            statusEl.textContent = `识别成功: ${cleanText} (正确)`;
            statusEl.className = "voice-status matched";

            gridData[currentIndex].element.classList.remove('active');
            gridData[currentIndex].element.classList.add('correct');

            advanceToNextTrial();
        } else {
            statusEl.textContent = `识别: ${cleanText} (应读: ${currentTarget}色)`;
            statusEl.className = "voice-status listening";

            const cell = gridData[currentIndex].element;
            cell.classList.add('wrong');
            showFeedback(`错误，应读 ${currentTarget}色`, "wrong");
            setTimeout(() => cell.classList.remove('wrong'), 500);
            updateStats();
        }
    }

    function startAudioContext() {
        if (audioContext) return;

        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                mediaStream = stream;
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const analyser = audioContext.createAnalyser();
                const microphone = audioContext.createMediaStreamSource(stream);
                const javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

                analyser.smoothingTimeConstant = 0.8;
                analyser.fftSize = 1024;

                microphone.connect(analyser);
                analyser.connect(javascriptNode);
                javascriptNode.connect(audioContext.destination);

                javascriptNode.onaudioprocess = () => {
                    if (!isPlaying) return;
                    const array = new Uint8Array(analyser.frequencyBinCount);
                    analyser.getByteFrequencyData(array);
                    let values = 0;
                    const length = array.length;
                    for (let i = 0; i < length; i++) {
                        values += array[i];
                    }
                    const averageVolume = values / length;
                    const percent = Math.min(100, averageVolume * 2);
                    if (volumeBar) volumeBar.style.width = percent + "%";
                };
            })
            .catch(err => {
                console.error("Audio context error", err);
            });
    }

    function stopAudioContext() {
        if (audioContext) {
            audioContext.close().catch(e => console.error(e));
            audioContext = null;
        }
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }
        if (volumeBar) volumeBar.style.width = "0%";
    }

    renderManualControls();
    generateGrid(createPreviewRng());
    updateUIForMode();
    updateStats();
});
