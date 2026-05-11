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
    const resultNeutralRtDisplay = document.getElementById('result-neutral-rt');
    const resultStroopEffectDisplay = document.getElementById('result-stroop-effect');
    const resultConflictAdaptationDisplay = document.getElementById('result-conflict-adaptation');
    const resultErrorCountDisplay = document.getElementById('result-error-count');
    const resultNextParametersDisplay = document.getElementById('result-next-parameters');
    const resultFeedbackDisplay = document.getElementById('result-feedback');
    const restartBtn = document.getElementById('restart-btn');

    const GAME_ID = "stroop";
    const GAME_NAME = "斯特鲁普测试";
    const CONTENT_VERSION = "stroop-conflict-v2";
    const ADAPTATION_CONFIG = {
        blockSize: 8,
        neutralRatio: 0.25,
        initialIncongruentRatio: 0.4,
        minIncongruentRatio: 0.3,
        maxIncongruentRatio: 0.65,
        initialResponseWindowMs: 3600,
        minResponseWindowMs: 1800,
        maxResponseWindowMs: 5200,
        initialCueDelayMs: 180,
        minCueDelayMs: 70,
        maxCueDelayMs: 520,
        targetAccuracy: 0.86,
        targetMeanRtMs: 1200
    };
    let startTime = 0;
    let timerInterval = null;
    let currentTrialTimeout = null;
    let trialAdvanceTimer = null;
    let isPlaying = false;
    let isVoiceMode = false;
    let isAdvancing = false;
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
    let sessionRng = null;
    let adaptiveState = createInitialAdaptiveState();
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
    const neutralWords = ['形', '点', '线', '块', '圆', '方', '星'];

    function average(values) {
        const validValues = values.filter((value) => Number.isFinite(value));
        if (!validValues.length) return null;
        return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
    }

    function ratio(correctCount, totalCount) {
        return totalCount > 0 ? correctCount / totalCount : null;
    }

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function roundRatio(value) {
        return Math.round(value * 100) / 100;
    }

    function createInitialAdaptiveState(overrides = {}) {
        return {
            level: 1,
            blockSize: ADAPTATION_CONFIG.blockSize,
            incongruentRatio: ADAPTATION_CONFIG.initialIncongruentRatio,
            neutralRatio: ADAPTATION_CONFIG.neutralRatio,
            responseWindowMs: ADAPTATION_CONFIG.initialResponseWindowMs,
            cueDelayMs: ADAPTATION_CONFIG.initialCueDelayMs,
            lastAdjustment: "baseline",
            ...overrides
        };
    }

    function snapshotAdaptiveState(state = adaptiveState, blockIndex = null) {
        return {
            level: state.level,
            blockIndex,
            blockSize: state.blockSize,
            incongruentRatio: roundRatio(state.incongruentRatio),
            neutralRatio: roundRatio(state.neutralRatio),
            responseWindowMs: state.responseWindowMs,
            cueDelayMs: state.cueDelayMs,
            lastAdjustment: state.lastAdjustment
        };
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

    function pickColor(rng, avoidName = null) {
        const candidates = colors.filter((color) => color.name !== avoidName);
        const pool = candidates.length ? candidates : colors;
        return pool[Math.floor(rng() * pool.length)];
    }

    function pickDifferentColor(referenceColor, rng, avoidName = null) {
        const candidates = colors.filter((color) => (
            color.name !== referenceColor.name && color.name !== avoidName
        ));
        const pool = candidates.length
            ? candidates
            : colors.filter((color) => color.name !== referenceColor.name);
        return pool[Math.floor(rng() * pool.length)];
    }

    function pickNeutralWord(rng, avoidWord = null) {
        const candidates = neutralWords.filter((word) => word !== avoidWord);
        const pool = candidates.length ? candidates : neutralWords;
        return pool[Math.floor(rng() * pool.length)];
    }

    function calculateConditionCounts(totalTrials, parameters) {
        if (totalTrials <= 0) {
            return { congruent: 0, incongruent: 0, neutral: 0 };
        }
        if (totalTrials === 1) {
            return { congruent: 0, incongruent: 1, neutral: 0 };
        }
        if (totalTrials === 2) {
            return { congruent: 0, incongruent: 1, neutral: 1 };
        }

        const neutralCount = clamp(
            Math.round(totalTrials * parameters.neutralRatio),
            1,
            totalTrials - 2
        );
        const maxIncongruent = totalTrials - neutralCount - 1;
        const incongruentCount = clamp(
            Math.round(totalTrials * parameters.incongruentRatio),
            1,
            maxIncongruent
        );
        const congruentCount = totalTrials - neutralCount - incongruentCount;

        return {
            congruent: congruentCount,
            incongruent: incongruentCount,
            neutral: neutralCount
        };
    }

    function scoreConditionSequence(conditions) {
        let score = 0;
        for (let i = 1; i < conditions.length; i += 1) {
            if (conditions[i] === conditions[i - 1]) {
                score += 2;
            }
            if (i > 1 && conditions[i] === conditions[i - 1] && conditions[i] === conditions[i - 2]) {
                score += 12;
            }
        }
        return score;
    }

    function buildConditionList(totalTrials, rng, parameters = adaptiveState) {
        const counts = calculateConditionCounts(totalTrials, parameters);
        const conditions = [];

        for (let i = 0; i < counts.congruent; i += 1) {
            conditions.push("congruent");
        }
        for (let i = 0; i < counts.incongruent; i += 1) {
            conditions.push("incongruent");
        }
        for (let i = 0; i < counts.neutral; i += 1) {
            conditions.push("neutral");
        }

        let bestSequence = conditions.slice(0, totalTrials);
        let bestScore = Number.POSITIVE_INFINITY;

        for (let attempt = 0; attempt < 80; attempt += 1) {
            const candidate = shuffleInPlace(conditions.slice(0, totalTrials), rng);
            const score = scoreConditionSequence(candidate);
            if (score < bestScore) {
                bestSequence = candidate;
                bestScore = score;
            }
            if (score === 0) break;
        }

        return bestSequence;
    }

    function createStimulus(condition, rng, previousStimulus = {}) {
        const inkColor = pickColor(rng, previousStimulus.inkColor);

        if (condition === "congruent") {
            return {
                word: inkColor.name,
                inkColor
            };
        }

        if (condition === "neutral") {
            return {
                word: pickNeutralWord(rng, previousStimulus.word),
                inkColor
            };
        }

        const wordColor = pickDifferentColor(inkColor, rng, previousStimulus.word);
        return {
            word: wordColor.name,
            inkColor
        };
    }

    function getBlockIndexForTrial(index, parameters = adaptiveState) {
        return Math.floor(index / parameters.blockSize);
    }

    function applyStimulusToCell(cell, stimulus) {
        cell.textContent = stimulus.word;
        cell.style.color = stimulus.inkColor.hex;
    }

    function createGridItem(cell, index, condition, previousCondition, rng, parameters, previousStimulus = {}) {
        const stimulus = createStimulus(condition, rng, previousStimulus);
        const blockIndex = getBlockIndexForTrial(index, parameters);

        applyStimulusToCell(cell, stimulus);

        return {
            element: cell,
            condition,
            word: stimulus.word,
            inkColor: stimulus.inkColor.name,
            inkColorHex: stimulus.inkColor.hex,
            expectedResponse: stimulus.inkColor.name,
            previousCondition,
            blockIndex,
            adaptiveState: snapshotAdaptiveState(parameters, blockIndex),
            stimulusText: stimulus.word,
            stimulusColor: stimulus.inkColor.name,
            stimulusColorHex: stimulus.inkColor.hex,
            correctResponse: stimulus.inkColor.name
        };
    }

    function updatePendingTrialFromGridItem(index, item) {
        const trial = sessionTrials[index];
        if (!trial || trial.startedAt || trial.finishedAt) return;

        trial.condition = item.condition;
        trial.congruency = item.condition;
        trial.word = item.word;
        trial.inkColor = item.inkColor;
        trial.inkColorHex = item.inkColorHex;
        trial.expectedResponse = item.expectedResponse;
        trial.previousCondition = item.previousCondition;
        trial.blockIndex = item.blockIndex;
        trial.adaptiveState = { ...item.adaptiveState };
        trial.stimulusText = item.word;
        trial.stimulusColor = item.inkColor;
        trial.stimulusColorHex = item.inkColorHex;
        trial.correctResponse = item.expectedResponse;
    }

    function rebalanceUpcomingTrials(startIndex) {
        if (startIndex >= gridData.length) return;

        const rng = sessionRng || createPreviewRng();
        const remainingCount = gridData.length - startIndex;
        const conditions = buildConditionList(remainingCount, rng, adaptiveState);
        let previousCondition = startIndex > 0 ? gridData[startIndex - 1].condition : null;
        let previousStimulus = startIndex > 0
            ? { word: gridData[startIndex - 1].word, inkColor: gridData[startIndex - 1].inkColor }
            : {};

        for (let offset = 0; offset < remainingCount; offset += 1) {
            const index = startIndex + offset;
            const cell = gridData[index].element;
            cell.classList.remove("active", "correct", "wrong");
            const item = createGridItem(
                cell,
                index,
                conditions[offset],
                previousCondition,
                rng,
                adaptiveState,
                previousStimulus
            );
            gridData[index] = item;
            updatePendingTrialFromGridItem(index, item);
            previousCondition = item.condition;
            previousStimulus = { word: item.word, inkColor: item.inkColor };
        }
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
            button.disabled = !isPlaying || isVoiceMode || isAdvancing;
        });
    }

    function createSessionTrials(inputMode) {
        return gridData.map((item, index) => ({
            index,
            condition: item.condition,
            congruency: item.condition,
            word: item.word,
            inkColor: item.inkColor,
            inkColorHex: item.inkColorHex,
            expectedResponse: item.expectedResponse,
            previousCondition: item.previousCondition,
            blockIndex: item.blockIndex,
            adaptiveState: { ...item.adaptiveState },
            stimulusText: item.stimulusText,
            stimulusColor: item.stimulusColor,
            stimulusColorHex: item.stimulusColorHex,
            correctResponse: item.correctResponse,
            response: null,
            correct: null,
            rtMs: null,
            errorType: null,
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
            word: trial.word,
            inkColor: trial.inkColor,
            inkColorHex: trial.inkColorHex,
            expectedResponse: trial.expectedResponse,
            stimulusText: trial.stimulusText,
            stimulusColor: trial.stimulusColor,
            stimulusColorHex: trial.stimulusColorHex,
            correctResponse: trial.correctResponse,
            response: trial.response,
            correct: trial.correct,
            rtMs: trial.rtMs,
            errorType: trial.errorType,
            previousCondition: trial.previousCondition,
            blockIndex: trial.blockIndex,
            adaptiveState: trial.adaptiveState ? { ...trial.adaptiveState } : null,
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
            const blockIndex = getBlockIndexForTrial(index, adaptiveState);
            trial.blockIndex = blockIndex;
            trial.adaptiveState = snapshotAdaptiveState(adaptiveState, blockIndex);
            trial.startedAt = new Date(currentTrialStartedAt).toISOString();
            trial._startedAtMs = currentTrialStartedAt;
        }
    }

    function classifyErrorType(trial, response, options = {}) {
        if (options.timedOut) {
            return trial.hadError ? "omission_after_error" : "omission";
        }

        const normalized = String(response || "").trim();
        if (!normalized) return "omission";

        if (
            trial.condition === "incongruent"
            && trial.word
            && normalized.includes(trial.word)
        ) {
            return "word_reading";
        }

        const namedColor = colors.find((color) => normalized.includes(color.name));
        if (namedColor && namedColor.name !== trial.expectedResponse) {
            return "wrong_color";
        }

        return "unrecognized_response";
    }

    function recordTrialResponse(index, response, correct, options = {}) {
        const trial = sessionTrials[index];
        if (!trial || trial.finishedAt) return null;

        const now = Date.now();
        const startedAtMs = Number.isFinite(trial._startedAtMs) ? trial._startedAtMs : currentTrialStartedAt;
        const rtMs = startedAtMs > 0 ? Math.max(0, Math.round(now - startedAtMs)) : null;
        const complete = options.complete !== false;
        const timedOut = Boolean(options.timedOut);
        const errorType = correct ? null : classifyErrorType(trial, response, { timedOut });

        trial.attemptCount += 1;
        trial.response = response;
        trial.rtMs = Number.isFinite(rtMs) ? rtMs : null;

        if (!correct) {
            trial.hadError = true;
            trial.errorType = errorType;
            trial.wrongResponses.push({
                response,
                rtMs: trial.rtMs,
                errorType
            });
        }

        if (complete || correct || timedOut) {
            trial.correct = Boolean(correct);
            trial.timedOut = timedOut;
            if (correct && trial.hadError) {
                trial.errorType = "self_corrected";
            }
            if (!correct && !trial.errorType) {
                trial.errorType = errorType || "wrong_color";
            }
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
            trial.errorType = trial.hadError && trial.attemptCount > 0 ? "omission_after_error" : "omission";
            trial.rtMs = Number.isFinite(trial.rtMs)
                ? trial.rtMs
                : (startedAtMs ? Math.max(0, Math.round(finishedAt.getTime() - startedAtMs)) : null);
            trial.finishedAt = finishedAt.toISOString();
        });
    }

    function getCompletedTrials() {
        return sessionTrials.filter((trial) => trial.finishedAt || trial.correct !== null || trial.timedOut);
    }

    function calculateConditionStats(trials, condition) {
        const conditionTrials = trials.filter((trial) => trial.condition === condition);
        const correctTrials = conditionTrials.filter((trial) => trial.correct === true);

        return {
            trialCount: conditionTrials.length,
            correctCount: correctTrials.length,
            accuracy: ratio(correctTrials.length, conditionTrials.length),
            meanRtMs: average(correctTrials.map((trial) => trial.rtMs)),
            errorCount: conditionTrials.filter((trial) => trial.correct === false || trial.timedOut || trial.hadError).length
        };
    }

    function countErrorTypes(trials) {
        return trials.reduce((counts, trial) => {
            if (!trial.errorType) return counts;
            counts[trial.errorType] = (counts[trial.errorType] || 0) + 1;
            return counts;
        }, {});
    }

    function calculateConflictAdaptation(trials) {
        const incongruentAfterCongruent = trials.filter((trial) => (
            trial.condition === "incongruent"
            && trial.previousCondition === "congruent"
        ));
        const incongruentAfterIncongruent = trials.filter((trial) => (
            trial.condition === "incongruent"
            && trial.previousCondition === "incongruent"
        ));
        const afterCongruentCorrect = incongruentAfterCongruent.filter((trial) => trial.correct === true);
        const afterIncongruentCorrect = incongruentAfterIncongruent.filter((trial) => trial.correct === true);
        const afterCongruentRt = average(afterCongruentCorrect.map((trial) => trial.rtMs));
        const afterIncongruentRt = average(afterIncongruentCorrect.map((trial) => trial.rtMs));
        const afterCongruentAccuracy = ratio(afterCongruentCorrect.length, incongruentAfterCongruent.length);
        const afterIncongruentAccuracy = ratio(afterIncongruentCorrect.length, incongruentAfterIncongruent.length);

        return {
            incongruentAfterCongruentTrials: incongruentAfterCongruent.length,
            incongruentAfterIncongruentTrials: incongruentAfterIncongruent.length,
            incongruentAfterCongruentMeanRtMs: afterCongruentRt,
            incongruentAfterIncongruentMeanRtMs: afterIncongruentRt,
            rtBenefitMs: Number.isFinite(afterCongruentRt) && Number.isFinite(afterIncongruentRt)
                ? afterCongruentRt - afterIncongruentRt
                : null,
            incongruentAfterCongruentAccuracy: afterCongruentAccuracy,
            incongruentAfterIncongruentAccuracy: afterIncongruentAccuracy,
            accuracyBenefit: Number.isFinite(afterCongruentAccuracy) && Number.isFinite(afterIncongruentAccuracy)
                ? afterIncongruentAccuracy - afterCongruentAccuracy
                : null
        };
    }

    function calculateBlockPerformance(trials) {
        const completedTrials = trials.filter((trial) => trial.finishedAt || trial.correct !== null || trial.timedOut);
        const correctTrials = completedTrials.filter((trial) => trial.correct === true);
        return {
            total: completedTrials.length,
            accuracy: ratio(correctTrials.length, completedTrials.length),
            meanRtMs: average(correctTrials.map((trial) => trial.rtMs)),
            omissionRate: ratio(completedTrials.filter((trial) => trial.errorType === "omission" || trial.errorType === "omission_after_error").length, completedTrials.length)
        };
    }

    function adjustAdaptiveState(currentState, performance) {
        if (!performance.total) return currentState;

        const nextState = { ...currentState };
        const fastEnough = Number.isFinite(performance.meanRtMs)
            && performance.meanRtMs <= ADAPTATION_CONFIG.targetMeanRtMs;
        const accurateEnough = Number.isFinite(performance.accuracy)
            && performance.accuracy >= ADAPTATION_CONFIG.targetAccuracy;
        const tooManyErrors = Number.isFinite(performance.accuracy) && performance.accuracy < 0.72;
        const tooManyOmissions = Number.isFinite(performance.omissionRate) && performance.omissionRate > 0.18;

        if (accurateEnough && fastEnough && !tooManyOmissions) {
            nextState.level = currentState.level + 1;
            nextState.incongruentRatio = clamp(currentState.incongruentRatio + 0.05, ADAPTATION_CONFIG.minIncongruentRatio, ADAPTATION_CONFIG.maxIncongruentRatio);
            nextState.responseWindowMs = clamp(currentState.responseWindowMs - 250, ADAPTATION_CONFIG.minResponseWindowMs, ADAPTATION_CONFIG.maxResponseWindowMs);
            nextState.cueDelayMs = clamp(currentState.cueDelayMs - 25, ADAPTATION_CONFIG.minCueDelayMs, ADAPTATION_CONFIG.maxCueDelayMs);
            nextState.lastAdjustment = "increase_load";
        } else if (tooManyErrors || tooManyOmissions) {
            nextState.level = Math.max(1, currentState.level - 1);
            nextState.incongruentRatio = clamp(currentState.incongruentRatio - 0.05, ADAPTATION_CONFIG.minIncongruentRatio, ADAPTATION_CONFIG.maxIncongruentRatio);
            nextState.responseWindowMs = clamp(currentState.responseWindowMs + 350, ADAPTATION_CONFIG.minResponseWindowMs, ADAPTATION_CONFIG.maxResponseWindowMs);
            nextState.cueDelayMs = clamp(currentState.cueDelayMs + 50, ADAPTATION_CONFIG.minCueDelayMs, ADAPTATION_CONFIG.maxCueDelayMs);
            nextState.lastAdjustment = "decrease_load";
        } else {
            nextState.lastAdjustment = "maintain_load";
        }

        nextState.incongruentRatio = roundRatio(nextState.incongruentRatio);
        nextState.neutralRatio = roundRatio(nextState.neutralRatio);
        return nextState;
    }

    function updateAdaptiveStateAfterTrial(completedIndex, nextIndex) {
        if ((completedIndex + 1) % adaptiveState.blockSize !== 0) return;

        const blockStart = Math.max(0, completedIndex - adaptiveState.blockSize + 1);
        const blockTrials = sessionTrials.slice(blockStart, completedIndex + 1);
        const blockPerformance = calculateBlockPerformance(blockTrials);
        adaptiveState = adjustAdaptiveState(adaptiveState, blockPerformance);
        rebalanceUpcomingTrials(nextIndex);
    }

    function calculateSessionSummary() {
        const trials = sessionTrials.length ? sessionTrials : createSessionTrials(sessionInputMode);
        const totalTrials = trials.length;
        const completedTrials = trials.filter((trial) => trial.finishedAt || trial.correct !== null || trial.timedOut);
        const correctTrials = trials.filter((trial) => trial.correct === true);
        const conditionMetrics = {
            congruent: calculateConditionStats(trials, "congruent"),
            incongruent: calculateConditionStats(trials, "incongruent"),
            neutral: calculateConditionStats(trials, "neutral")
        };
        const correctRtSamples = correctTrials.map((trial) => trial.rtMs);
        const congruentMeanRtMs = conditionMetrics.congruent.meanRtMs;
        const incongruentMeanRtMs = conditionMetrics.incongruent.meanRtMs;
        const neutralMeanRtMs = conditionMetrics.neutral.meanRtMs;
        const stroopEffectMs = Number.isFinite(congruentMeanRtMs) && Number.isFinite(incongruentMeanRtMs)
            ? incongruentMeanRtMs - congruentMeanRtMs
            : null;
        const errorCount = trials.filter((trial) => trial.correct === false || trial.timedOut || trial.hadError).length;
        const errorTypeCounts = countErrorTypes(trials);
        const conflictAdaptation = calculateConflictAdaptation(trials);
        const nextParameters = snapshotAdaptiveState(adaptiveState, null);

        return {
            totalTrials,
            completedTrials: completedTrials.length,
            correctCount: correctTrials.length,
            accuracy: ratio(correctTrials.length, totalTrials),
            meanRtMs: average(correctRtSamples),
            conditionMetrics,
            congruentMeanRtMs,
            incongruentMeanRtMs,
            neutralMeanRtMs,
            stroopEffectMs,
            errorCount,
            errorTypeCounts,
            conflictAdaptation,
            nextParameters,
            congruentTrials: conditionMetrics.congruent.trialCount,
            incongruentTrials: conditionMetrics.incongruent.trialCount,
            neutralTrials: conditionMetrics.neutral.trialCount,
            congruentAccuracy: conditionMetrics.congruent.accuracy,
            incongruentAccuracy: conditionMetrics.incongruent.accuracy,
            neutralAccuracy: conditionMetrics.neutral.accuracy,
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
            neutralMeanRT: formatMs(summary.neutralMeanRtMs),
            stroopEffect: formatMs(summary.stroopEffectMs),
            stroopEffectMs: summary.stroopEffectMs,
            conditionAccuracy: {
                congruent: formatPercent(summary.congruentAccuracy),
                incongruent: formatPercent(summary.incongruentAccuracy),
                neutral: formatPercent(summary.neutralAccuracy)
            },
            conditionMeanRT: {
                congruent: formatMs(summary.congruentMeanRtMs),
                incongruent: formatMs(summary.incongruentMeanRtMs),
                neutral: formatMs(summary.neutralMeanRtMs)
            },
            conflictAdaptation: summary.conflictAdaptation,
            errorTypeCounts: summary.errorTypeCounts,
            nextParameters: summary.nextParameters,
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

    function formatConflictAdaptation(conflictAdaptation) {
        if (!conflictAdaptation || !Number.isFinite(conflictAdaptation.rtBenefitMs)) {
            return "--";
        }
        const sign = conflictAdaptation.rtBenefitMs >= 0 ? "+" : "";
        return `${sign}${conflictAdaptation.rtBenefitMs}ms`;
    }

    function formatNextParameters(parameters) {
        if (!parameters) return "--";
        return `L${parameters.level} / 冲突${Math.round(parameters.incongruentRatio * 100)}% / ${parameters.responseWindowMs}ms`;
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
        const adaptationText = Number.isFinite(summary.conflictAdaptation.rtBenefitMs)
            ? `冲突后适应 ${formatConflictAdaptation(summary.conflictAdaptation)}`
            : "冲突后适应样本不足";

        return `${completionText}。${accuracyText}；${speedText}；${interferenceText}；${adaptationText}。可点击“重新训练一轮”再次开始。`;
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
        if (resultNeutralRtDisplay) resultNeutralRtDisplay.textContent = formatMs(summary.neutralMeanRtMs);
        if (resultStroopEffectDisplay) resultStroopEffectDisplay.textContent = formatMs(summary.stroopEffectMs);
        if (resultConflictAdaptationDisplay) resultConflictAdaptationDisplay.textContent = formatConflictAdaptation(summary.conflictAdaptation);
        if (resultErrorCountDisplay) resultErrorCountDisplay.textContent = String(summary.errorCount);
        if (resultNextParametersDisplay) resultNextParametersDisplay.textContent = formatNextParameters(summary.nextParameters);
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
        sessionRng = createRng(sessionSeed);
        generateGrid(sessionRng);

        currentIndex = 0;
        isAdvancing = false;
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
        clearCurrentTrialTimeout();
        clearAdvanceTimer();
        finalizeIncompleteTrials(finishedAt, endReason);
        stopTimer();
        isPlaying = false;
        isAdvancing = false;
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
        const conditions = buildConditionList(totalCells, activeRng, adaptiveState);
        let previousCondition = null;
        let previousStimulus = {};

        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.className = 'stroop-cell';

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

            const item = createGridItem(
                cell,
                i,
                conditions[i],
                previousCondition,
                activeRng,
                adaptiveState,
                previousStimulus
            );
            gridData.push(item);
            previousCondition = item.condition;
            previousStimulus = { word: item.word, inkColor: item.inkColor };
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

    function clearCurrentTrialTimeout() {
        if (currentTrialTimeout) {
            clearTimeout(currentTrialTimeout);
            currentTrialTimeout = null;
        }
    }

    function clearAdvanceTimer() {
        if (trialAdvanceTimer) {
            clearTimeout(trialAdvanceTimer);
            trialAdvanceTimer = null;
        }
    }

    function startResponseWindow(index) {
        clearCurrentTrialTimeout();
        const trial = sessionTrials[index];
        if (!trial) return;

        const windowMs = trial.adaptiveState && Number.isFinite(trial.adaptiveState.responseWindowMs)
            ? trial.adaptiveState.responseWindowMs
            : adaptiveState.responseWindowMs;

        currentTrialTimeout = setTimeout(() => {
            handleTrialTimeout(index);
        }, windowMs);
    }

    function handleTrialTimeout(index) {
        if (!isPlaying || isAdvancing || index !== currentIndex || index >= gridData.length) return;

        recordTrialResponse(index, null, false, { complete: true, timedOut: true });
        const cell = gridData[index].element;
        cell.classList.remove('active');
        cell.classList.add('wrong');
        showFeedback("超时，进入下一题", "wrong");
        advanceToNextTrial();
    }

    function highlightCell(index) {
        gridData.forEach(d => d.element.classList.remove('active'));

        if (index < gridData.length) {
            const current = gridData[index];
            isAdvancing = false;
            setManualControlsState();
            current.element.classList.add('active');
            markCurrentTrialStart(index);
            startResponseWindow(index);
            current.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        stopGame("completed");
    }

    function advanceToNextTrial() {
        clearCurrentTrialTimeout();
        const completedIndex = currentIndex;
        const nextIndex = currentIndex + 1;
        isAdvancing = true;
        setManualControlsState();
        updateStats();
        updateAdaptiveStateAfterTrial(completedIndex, nextIndex);
        currentIndex = nextIndex;

        if (currentIndex >= gridData.length) {
            isAdvancing = false;
            highlightCell(currentIndex);
            return;
        }

        const delayMs = adaptiveState.cueDelayMs;
        clearAdvanceTimer();
        trialAdvanceTimer = setTimeout(() => {
            trialAdvanceTimer = null;
            highlightCell(currentIndex);
        }, delayMs);
    }

    function handleManualResponse(response) {
        if (!isPlaying || isVoiceMode || isAdvancing || currentIndex >= gridData.length) return;

        const currentTarget = gridData[currentIndex].expectedResponse;
        const correct = response === currentTarget;
        clearCurrentTrialTimeout();
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
        if (!isPlaying || isAdvancing || currentIndex >= gridData.length) return;

        const currentTarget = gridData[currentIndex].expectedResponse;
        const cleanText = text.replace(/[.,?!。，？！]/g, '');
        const matched = cleanText.includes(currentTarget);

        recordTrialResponse(currentIndex, cleanText, matched, { complete: matched });

        const statusEl = voiceStatus;

        if (matched) {
            clearCurrentTrialTimeout();
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
