document.addEventListener("DOMContentLoaded", () => {
    const CONTENT_VERSION = "flanker-v3-balanced-adaptive-conflict";
    const BASE_RESPONSE_WINDOW_MS = 2000;
    const BASE_STIMULUS_DURATION_MS = 1200;
    const MIN_RESPONSE_WINDOW_MS = 1100;
    const MAX_RESPONSE_WINDOW_MS = 2400;
    const MIN_STIMULUS_DURATION_MS = 500;
    const MAX_STIMULUS_DURATION_MS = 1600;
    const INTER_TRIAL_INTERVAL_MS = 220;
    const STIMULUS_SIZE = 5;
    const TARGET_POSITION = Math.floor(STIMULUS_SIZE / 2);
    const BLOCK_SIZE = 10;
    const CONDITIONS = ["congruent", "incongruent", "neutral"];
    const CONDITION_LABELS = {
        congruent: "一致",
        incongruent: "不一致",
        neutral: "中性"
    };

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
    const conditionMetricsDisplay = document.getElementById("condition-metrics");
    const captureErrorRateDisplay = document.getElementById("capture-error-rate");
    const conflictAdaptationDisplay = document.getElementById("conflict-adaptation");
    const rtVariabilityDisplay = document.getElementById("rt-variability");
    const nextParametersDisplay = document.getElementById("next-parameters");
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
    let adaptiveState = createInitialAdaptiveState(0);
    let nextBlockIndex = 0;
    let rng = fallbackMulberry32(1);
    let trialTimeout = null;
    let stimulusHideTimeout = null;
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

    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function roundTo(value, digits = 2) {
        if (!Number.isFinite(value)) return 0;
        const factor = 10 ** digits;
        return Math.round(value * factor) / factor;
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
        const avgRt = average(reactionTimes);
        avgRtLiveDisplay.textContent = `${avgRt} ms`;
    }

    function showFeedback(text, type = "") {
        feedback.textContent = text;
        feedback.className = type ? `feedback ${type}` : "feedback";
    }

    function validNumbers(values) {
        return values.filter((value) => Number.isFinite(value));
    }

    function average(values) {
        const validValues = validNumbers(values);
        if (validValues.length === 0) return 0;
        return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
    }

    function median(values) {
        const validValues = validNumbers(values).sort((a, b) => a - b);
        if (validValues.length === 0) return 0;
        const middle = Math.floor(validValues.length / 2);
        if (validValues.length % 2 === 1) return Math.round(validValues[middle]);
        return Math.round((validValues[middle - 1] + validValues[middle]) / 2);
    }

    function percentile(values, percentileValue) {
        const validValues = validNumbers(values).sort((a, b) => a - b);
        if (validValues.length === 0) return 0;
        const index = clamp((validValues.length - 1) * percentileValue, 0, validValues.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) return Math.round(validValues[lower]);
        const weight = index - lower;
        return Math.round(validValues[lower] * (1 - weight) + validValues[upper] * weight);
    }

    function standardDeviation(values) {
        const validValues = validNumbers(values);
        if (validValues.length === 0) return 0;
        const mean = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
        const variance = validValues.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / validValues.length;
        return Math.round(Math.sqrt(variance));
    }

    function accuracyFor(items) {
        if (items.length === 0) return 0;
        return items.filter((item) => item.correct).length / items.length;
    }

    function formatPercent(value) {
        return `${Math.round((Number.isFinite(value) ? value : 0) * 100)}%`;
    }

    function formatSignedMs(value) {
        const rounded = Number.isFinite(value) ? Math.round(value) : 0;
        return `${rounded > 0 ? "+" : ""}${rounded} ms`;
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

    function createInitialAdaptiveState(blockIndex) {
        return {
            blockIndex,
            loadLevel: 1,
            incongruentRatio: roundTo(1 / 3, 2),
            stimulusDurationMs: BASE_STIMULUS_DURATION_MS,
            responseWindowMs: BASE_RESPONSE_WINDOW_MS,
            basis: "initial"
        };
    }

    function cloneAdaptiveState(state) {
        return {
            blockIndex: state.blockIndex,
            loadLevel: state.loadLevel,
            incongruentRatio: roundTo(state.incongruentRatio, 2),
            stimulusDurationMs: state.stimulusDurationMs,
            responseWindowMs: state.responseWindowMs,
            basis: state.basis,
            previousBlockAccuracy: state.previousBlockAccuracy ?? null,
            previousBlockIncongruentAccuracy: state.previousBlockIncongruentAccuracy ?? null,
            previousBlockCaptureErrorRate: state.previousBlockCaptureErrorRate ?? null,
            previousBlockMeanRtMs: state.previousBlockMeanRtMs ?? null
        };
    }

    function summarizeBlockForAdaptation(blockTrials) {
        const trials = blockTrials || [];
        const incongruentTrials = trials.filter((trial) => trial.condition === "incongruent");
        const correctTrials = trials.filter((trial) => trial.correct);
        const captureErrors = incongruentTrials.filter((trial) => trial.errorType === "flanker-capture").length;

        return {
            trialCount: trials.length,
            accuracy: accuracyFor(trials),
            incongruentAccuracy: accuracyFor(incongruentTrials),
            captureErrorRate: incongruentTrials.length > 0 ? captureErrors / incongruentTrials.length : 0,
            meanRtMs: average(correctTrials.map((trial) => trial.rtMs))
        };
    }

    function adaptAdaptiveState(previousState, blockStats, nextIndex) {
        const stats = blockStats || { trialCount: 0, accuracy: 0, incongruentAccuracy: 0, captureErrorRate: 0, meanRtMs: 0 };
        const next = {
            ...cloneAdaptiveState(previousState),
            blockIndex: nextIndex,
            basis: "stable",
            previousBlockAccuracy: roundTo(stats.accuracy, 3),
            previousBlockIncongruentAccuracy: roundTo(stats.incongruentAccuracy, 3),
            previousBlockCaptureErrorRate: roundTo(stats.captureErrorRate, 3),
            previousBlockMeanRtMs: stats.meanRtMs
        };

        if (stats.trialCount < Math.min(6, BLOCK_SIZE)) {
            next.basis = "insufficient-data";
            return next;
        }

        const strongPerformance = stats.accuracy >= 0.9
            && stats.incongruentAccuracy >= 0.85
            && stats.captureErrorRate <= 0.12
            && (stats.meanRtMs === 0 || stats.meanRtMs <= 900);
        const overloaded = stats.accuracy < 0.75
            || stats.incongruentAccuracy < 0.7
            || stats.captureErrorRate >= 0.25;

        if (strongPerformance) {
            next.loadLevel = clamp(next.loadLevel + 1, 1, 8);
            next.incongruentRatio = roundTo(clamp(next.incongruentRatio + 0.07, 0.25, 0.6), 2);
            next.stimulusDurationMs = clamp(next.stimulusDurationMs - 100, MIN_STIMULUS_DURATION_MS, MAX_STIMULUS_DURATION_MS);
            next.responseWindowMs = clamp(next.responseWindowMs - 150, MIN_RESPONSE_WINDOW_MS, MAX_RESPONSE_WINDOW_MS);
            next.basis = "increase-load";
            return next;
        }

        if (overloaded) {
            next.loadLevel = clamp(next.loadLevel - 1, 1, 8);
            next.incongruentRatio = roundTo(clamp(next.incongruentRatio - 0.06, 0.25, 0.6), 2);
            next.stimulusDurationMs = clamp(next.stimulusDurationMs + 150, MIN_STIMULUS_DURATION_MS, MAX_STIMULUS_DURATION_MS);
            next.responseWindowMs = clamp(next.responseWindowMs + 200, MIN_RESPONSE_WINDOW_MS, MAX_RESPONSE_WINDOW_MS);
            next.basis = "reduce-load";
            return next;
        }

        return next;
    }

    function createConditionCounts(size, incongruentRatio) {
        if (size <= 0) {
            return { congruent: 0, incongruent: 0, neutral: 0 };
        }
        if (size < CONDITIONS.length) {
            return {
                congruent: size >= 1 ? 1 : 0,
                incongruent: size >= 2 ? 1 : 0,
                neutral: 0
            };
        }

        let incongruent = Math.round(size * incongruentRatio);
        incongruent = clamp(incongruent, 1, size - 2);
        const remaining = size - incongruent;
        let congruent = Math.ceil(remaining / 2);
        let neutral = remaining - congruent;

        if (neutral === 0 && size >= CONDITIONS.length) {
            neutral = 1;
            congruent = Math.max(1, congruent - 1);
        }

        return { congruent, incongruent, neutral };
    }

    function createBalancedDirections(count, extraDirection) {
        const leftCount = Math.floor(count / 2) + (count % 2 === 1 && extraDirection === "left" ? 1 : 0);
        const rightCount = count - leftCount;
        const directions = [
            ...Array.from({ length: leftCount }, () => "left"),
            ...Array.from({ length: rightCount }, () => "right")
        ];
        return shuffleInPlace(directions);
    }

    function createExtraDirectionMap(counts) {
        const oddConditions = CONDITIONS.filter((condition) => counts[condition] % 2 === 1);
        const firstDirection = rng() < 0.5 ? "left" : "right";
        return oddConditions.reduce((map, condition, index) => {
            map[condition] = index % 2 === 0 ? firstDirection : oppositeDirection(firstDirection);
            return map;
        }, {});
    }

    function sequencePenalty(items, previousCondition) {
        let penalty = 0;
        let lastCondition = previousCondition;
        let conditionRun = previousCondition ? 1 : 0;
        let lastTargetDirection = null;
        let targetRun = 0;

        items.forEach((item) => {
            if (item.condition === lastCondition) {
                conditionRun += 1;
                if (conditionRun > 2) penalty += (conditionRun - 2) * 10;
            } else {
                conditionRun = 1;
                lastCondition = item.condition;
            }

            if (item.targetDirection === lastTargetDirection) {
                targetRun += 1;
                if (targetRun > 3) penalty += (targetRun - 3) * 3;
            } else {
                targetRun = 1;
                lastTargetDirection = item.targetDirection;
            }
        });

        return penalty;
    }

    function shuffleWithSequenceGuard(items, previousCondition) {
        let best = items.map((item) => ({ ...item }));
        let bestPenalty = Number.POSITIVE_INFINITY;

        for (let attempt = 0; attempt < 120; attempt += 1) {
            const candidate = shuffleInPlace(items.map((item) => ({ ...item })));
            const penalty = sequencePenalty(candidate, previousCondition);
            if (penalty < bestPenalty) {
                best = candidate;
                bestPenalty = penalty;
            }
            if (penalty === 0) break;
        }

        return best;
    }

    function buildBlockPlan(size, blockIndex, state, previousCondition, startIndex) {
        const counts = createConditionCounts(size, state.incongruentRatio);
        const extraDirections = createExtraDirectionMap(counts);
        const rawTrials = [];

        CONDITIONS.forEach((condition) => {
            const targetDirections = createBalancedDirections(counts[condition], extraDirections[condition]);
            targetDirections.forEach((targetDirection) => {
                const flankerDirection = condition === "neutral"
                    ? "neutral"
                    : condition === "congruent"
                        ? targetDirection
                        : oppositeDirection(targetDirection);
                rawTrials.push({
                    condition,
                    targetDirection,
                    flankerDirection
                });
            });
        });

        const orderedTrials = shuffleWithSequenceGuard(rawTrials, previousCondition);
        const stateSnapshot = cloneAdaptiveState(state);

        return orderedTrials.map((trial, offset) => ({
            index: startIndex + offset,
            trialIndex: startIndex + offset,
            condition: trial.condition,
            targetDirection: trial.targetDirection,
            flankerDirection: trial.flankerDirection,
            correctResponse: trial.targetDirection,
            previousCondition: offset === 0 ? previousCondition : orderedTrials[offset - 1].condition,
            blockIndex,
            adaptiveState: stateSnapshot,
            targetPosition: TARGET_POSITION
        }));
    }

    function prepareNextBlock() {
        const remaining = totalTrials - trialPlan.length;
        if (remaining <= 0) return;

        if (nextBlockIndex > 0) {
            const previousBlockTrials = trialLog.filter((trial) => trial.blockIndex === nextBlockIndex - 1);
            adaptiveState = adaptAdaptiveState(adaptiveState, summarizeBlockForAdaptation(previousBlockTrials), nextBlockIndex);
        }

        const blockSize = Math.min(BLOCK_SIZE, remaining);
        const previousCondition = trialPlan.length > 0 ? trialPlan[trialPlan.length - 1].condition : null;
        const blockPlan = buildBlockPlan(blockSize, nextBlockIndex, adaptiveState, previousCondition, trialPlan.length);
        trialPlan.push(...blockPlan);
        nextBlockIndex += 1;
    }

    function arrowText(direction) {
        return direction === "left" ? "<" : ">";
    }

    function arrowHtml(direction) {
        return direction === "left" ? "&lt;" : "&gt;";
    }

    function flankerText(trial) {
        return trial.condition === "neutral" ? "-" : arrowText(trial.flankerDirection);
    }

    function flankerHtml(trial) {
        return trial.condition === "neutral" ? "-" : arrowHtml(trial.flankerDirection);
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
            targetDirection: currentStimulus.targetDirection,
            flankerDirection: currentStimulus.flankerDirection,
            stimulus: currentStimulus.text,
            response: response || null,
            correct,
            rtMs: roundedRt,
            errorType,
            previousCondition: currentStimulus.previousCondition,
            blockIndex: currentStimulus.blockIndex,
            adaptiveState: cloneAdaptiveState(currentStimulus.adaptiveState),
            correctResponse: currentStimulus.correctResponse,
            timedOut: Boolean(timedOut),
            targetPosition: currentStimulus.targetPosition
        });
    }

    function buildRtDistribution(values) {
        const validValues = validNumbers(values);
        return {
            count: validValues.length,
            meanRtMs: average(validValues),
            medianRtMs: median(validValues),
            p10RtMs: percentile(validValues, 0.1),
            p90RtMs: percentile(validValues, 0.9),
            minRtMs: validValues.length > 0 ? Math.min(...validValues) : 0,
            maxRtMs: validValues.length > 0 ? Math.max(...validValues) : 0
        };
    }

    function buildConditionMetrics() {
        return CONDITIONS.reduce((metrics, condition) => {
            const trials = trialLog.filter((trial) => trial.condition === condition);
            const correctTrials = trials.filter((trial) => trial.correct);
            const correctRts = correctTrials.map((trial) => trial.rtMs);
            metrics[condition] = {
                label: CONDITION_LABELS[condition],
                count: trials.length,
                correctCount: correctTrials.length,
                accuracy: accuracyFor(trials),
                meanRtMs: average(correctRts),
                medianRtMs: median(correctRts),
                p10RtMs: percentile(correctRts, 0.1),
                p90RtMs: percentile(correctRts, 0.9)
            };
            return metrics;
        }, {});
    }

    function calculateConflictAdaptation() {
        const usableTrials = trialLog.filter((trial) => (
            trial.correct
            && Number.isFinite(trial.rtMs)
            && (trial.condition === "congruent" || trial.condition === "incongruent")
            && (trial.previousCondition === "congruent" || trial.previousCondition === "incongruent")
        ));
        const afterCongruent = usableTrials.filter((trial) => trial.previousCondition === "congruent");
        const afterIncongruent = usableTrials.filter((trial) => trial.previousCondition === "incongruent");
        const afterCongruentIncongruent = afterCongruent.filter((trial) => trial.condition === "incongruent").map((trial) => trial.rtMs);
        const afterCongruentCongruent = afterCongruent.filter((trial) => trial.condition === "congruent").map((trial) => trial.rtMs);
        const afterIncongruentIncongruent = afterIncongruent.filter((trial) => trial.condition === "incongruent").map((trial) => trial.rtMs);
        const afterIncongruentCongruent = afterIncongruent.filter((trial) => trial.condition === "congruent").map((trial) => trial.rtMs);
        const completeCells = [
            afterCongruentIncongruent,
            afterCongruentCongruent,
            afterIncongruentIncongruent,
            afterIncongruentCongruent
        ].every((items) => items.length > 0);
        const effectAfterCongruentMs = completeCells
            ? average(afterCongruentIncongruent) - average(afterCongruentCongruent)
            : 0;
        const effectAfterIncongruentMs = completeCells
            ? average(afterIncongruentIncongruent) - average(afterIncongruentCongruent)
            : 0;

        return {
            usableTrialCount: usableTrials.length,
            completeCells,
            cellCounts: {
                afterCongruentIncongruent: afterCongruentIncongruent.length,
                afterCongruentCongruent: afterCongruentCongruent.length,
                afterIncongruentIncongruent: afterIncongruentIncongruent.length,
                afterIncongruentCongruent: afterIncongruentCongruent.length
            },
            effectAfterCongruentMs,
            effectAfterIncongruentMs,
            effectReductionMs: effectAfterCongruentMs - effectAfterIncongruentMs
        };
    }

    function calculateRtVariability(values) {
        const validValues = validNumbers(values);
        const meanRtMs = average(validValues);
        const sdMs = standardDeviation(validValues);
        return {
            count: validValues.length,
            sdMs,
            coefficientOfVariation: meanRtMs > 0 ? roundTo(sdMs / meanRtMs, 3) : 0
        };
    }

    function getLatestBlockTrials() {
        if (trialLog.length === 0) return [];
        const latestBlockIndex = trialLog[trialLog.length - 1].blockIndex;
        return trialLog.filter((trial) => trial.blockIndex === latestBlockIndex);
    }

    function buildSummary() {
        const completedTrials = trialLog.length;
        const correctTrials = trialLog.filter((trial) => trial.correct);
        const correctCount = correctTrials.length;
        const conditionMetrics = buildConditionMetrics();
        const congruentTrials = trialLog.filter((trial) => trial.condition === "congruent");
        const incongruentTrials = trialLog.filter((trial) => trial.condition === "incongruent");
        const neutralTrials = trialLog.filter((trial) => trial.condition === "neutral");
        const congruentMeanRtMs = conditionMetrics.congruent.meanRtMs;
        const incongruentMeanRtMs = conditionMetrics.incongruent.meanRtMs;
        const canEstimateEffect = congruentMeanRtMs > 0 && incongruentMeanRtMs > 0;
        const flankerCaptureErrorCount = trialLog.filter((trial) => trial.errorType === "flanker-capture").length;
        const latestBlockStats = summarizeBlockForAdaptation(getLatestBlockTrials());
        const nextParameters = adaptAdaptiveState(adaptiveState, latestBlockStats, nextBlockIndex);
        const correctRtValues = correctTrials.map((trial) => trial.rtMs);

        return {
            totalTrials: completedTrials,
            plannedTrials: totalTrials,
            correctCount,
            accuracy: completedTrials > 0 ? correctCount / completedTrials : 0,
            meanRtMs: average(correctRtValues),
            responseMeanRtMs: average(trialLog.map((trial) => trial.rtMs)),
            conditionMetrics,
            congruentAccuracy: accuracyFor(congruentTrials),
            incongruentAccuracy: accuracyFor(incongruentTrials),
            neutralAccuracy: accuracyFor(neutralTrials),
            congruentMeanRtMs,
            incongruentMeanRtMs,
            neutralMeanRtMs: conditionMetrics.neutral.meanRtMs,
            flankerEffectMs: canEstimateEffect ? incongruentMeanRtMs - congruentMeanRtMs : 0,
            errorCount: completedTrials - correctCount,
            timeoutCount: trialLog.filter((trial) => trial.timedOut).length,
            flankerCaptureErrorCount,
            captureErrorRate: incongruentTrials.length > 0 ? flankerCaptureErrorCount / incongruentTrials.length : 0,
            directionErrorCount: trialLog.filter((trial) => trial.errorType === "direction-error").length,
            congruentTrials: congruentTrials.length,
            incongruentTrials: incongruentTrials.length,
            neutralTrials: neutralTrials.length,
            conflictAdaptation: calculateConflictAdaptation(),
            rtVariability: calculateRtVariability(correctRtValues),
            rtDistribution: buildRtDistribution(correctRtValues),
            nextParameters: cloneAdaptiveState(nextParameters),
            baseResponseWindowMs: BASE_RESPONSE_WINDOW_MS,
            baseStimulusDurationMs: BASE_STIMULUS_DURATION_MS,
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
                conditionAccuracy: CONDITIONS.reduce((items, condition) => {
                    items[condition] = summary.conditionMetrics[condition].accuracy;
                    return items;
                }, {}),
                conditionMeanRtMs: CONDITIONS.reduce((items, condition) => {
                    items[condition] = summary.conditionMetrics[condition].meanRtMs;
                    return items;
                }, {}),
                congruentAccuracy: formatPercent(summary.congruentAccuracy),
                incongruentAccuracy: formatPercent(summary.incongruentAccuracy),
                neutralAccuracy: formatPercent(summary.neutralAccuracy),
                flankerEffectMs: summary.flankerEffectMs,
                flankerEffect: `${summary.flankerEffectMs}ms`,
                captureErrorRate: summary.captureErrorRate,
                conflictAdaptation: summary.conflictAdaptation,
                rtVariability: summary.rtVariability,
                rtDistribution: summary.rtDistribution,
                nextParameters: summary.nextParameters,
                errors: summary.errorCount,
                seed: sessionSeed,
                sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ["attention", "selective-attention", "conflict-monitoring", "conflict-adaptation", "flanker"]
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
        trialPlan = [];
        adaptiveState = createInitialAdaptiveState(0);
        nextBlockIndex = 0;
        initializeSessionRandom();
        isPlaying = true;
        isPaused = false;
        roundOpen = false;

        resultModal.classList.add("hidden");
        setControlState(true);
        leftBtn.disabled = false;
        rightBtn.disabled = false;
        showFeedback("开始训练：按中央红色目标箭头方向", "correct");
        updateStats();

        clearTimeout(nextRoundTimeout);
        nextRoundTimeout = setTimeout(nextRound, 300);
    }

    function buildStimulus(trialIndex) {
        const planned = trialPlan[trialIndex];
        const targetHtml = arrowHtml(planned.targetDirection);
        const targetText = arrowText(planned.targetDirection);
        const distractorHtml = flankerHtml(planned);
        const distractorText = flankerText(planned);
        const htmlChars = [];
        const textChars = [];

        for (let i = 0; i < STIMULUS_SIZE; i += 1) {
            if (i === planned.targetPosition) {
                htmlChars.push(`<span style="color:#e74c3c">${targetHtml}</span>`);
                textChars.push(targetText);
            } else {
                htmlChars.push(distractorHtml);
                textChars.push(distractorText);
            }
        }

        return {
            ...planned,
            adaptiveState: cloneAdaptiveState(planned.adaptiveState),
            html: htmlChars.join(" "),
            text: textChars.join(" ")
        };
    }

    function hideStimulusIfOpen(stimulus) {
        if (!roundOpen || !currentStimulus || currentStimulus.index !== stimulus.index) return;
        display.textContent = "+ + + + +";
    }

    function armTrialTimers(stimulus) {
        clearTimeout(trialTimeout);
        clearTimeout(stimulusHideTimeout);

        trialTimeout = setTimeout(handleTimeout, stimulus.adaptiveState.responseWindowMs);
        if (stimulus.adaptiveState.stimulusDurationMs < stimulus.adaptiveState.responseWindowMs) {
            stimulusHideTimeout = setTimeout(() => hideStimulusIfOpen(stimulus), stimulus.adaptiveState.stimulusDurationMs);
        }
    }

    function nextRound() {
        if (!isPlaying || isPaused) return;
        if (finishedTrials >= totalTrials) {
            endGame(false);
            return;
        }

        if (finishedTrials >= trialPlan.length) {
            prepareNextBlock();
        }

        const stimulus = buildStimulus(finishedTrials);
        currentStimulus = stimulus;
        display.innerHTML = stimulus.html;
        stimulusStartTime = Date.now();
        roundOpen = true;
        armTrialTimers(stimulus);
    }

    function handleTimeout() {
        if (!roundOpen || !isPlaying || isPaused) return;

        roundOpen = false;
        clearTimeout(stimulusHideTimeout);
        recordTrial(null, false, null, true);
        currentStimulus = null;
        finishedTrials += 1;
        showFeedback("超时：未在作答窗口内反应", "wrong");
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
        clearTimeout(stimulusHideTimeout);

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
            clearTimeout(stimulusHideTimeout);
            clearTimeout(nextRoundTimeout);
            showFeedback("已暂停");
            return;
        }

        isPaused = false;
        pauseBtn.textContent = "暂停";
        leftBtn.disabled = false;
        rightBtn.disabled = false;
        showFeedback("继续训练", "correct");

        if (roundOpen && currentStimulus) {
            display.innerHTML = currentStimulus.html;
            stimulusStartTime = Date.now();
            armTrialTimers(currentStimulus);
            return;
        }

        scheduleNextRound();
    }

    function buildEffectExplanation(summary) {
        if (summary.congruentMeanRtMs === 0 || summary.incongruentMeanRtMs === 0) {
            return "一致与不一致条件的正确反应不足，暂不能稳定估计 flankerEffect（干扰成本）。";
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

    function formatConditionMetrics(conditionMetrics) {
        return CONDITIONS.map((condition) => {
            const metric = conditionMetrics[condition];
            return `${metric.label}: ${formatPercent(metric.accuracy)} / ${metric.meanRtMs} ms / n=${metric.count}`;
        }).join("；");
    }

    function formatConflictAdaptation(conflictAdaptation) {
        if (conflictAdaptation.usableTrialCount < 4 || !conflictAdaptation.completeCells) {
            return "有效相邻试次不足";
        }
        return `冲突后干扰降低 ${formatSignedMs(conflictAdaptation.effectReductionMs)}（前一一致效应 ${formatSignedMs(conflictAdaptation.effectAfterCongruentMs)}，前一不一致效应 ${formatSignedMs(conflictAdaptation.effectAfterIncongruentMs)}）`;
    }

    function formatRtVariability(rtVariability) {
        return `${rtVariability.sdMs} ms，CV ${rtVariability.coefficientOfVariation}`;
    }

    function formatNextParameters(nextParameters) {
        return `不一致比例 ${formatPercent(nextParameters.incongruentRatio)}；刺激 ${nextParameters.stimulusDurationMs} ms；作答 ${nextParameters.responseWindowMs} ms；负荷 ${nextParameters.loadLevel}`;
    }

    function endGame(forced = false) {
        if (!isPlaying) return;

        isPlaying = false;
        isPaused = false;
        roundOpen = false;
        clearTimeout(trialTimeout);
        clearTimeout(stimulusHideTimeout);
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
        if (conditionMetricsDisplay) {
            conditionMetricsDisplay.textContent = formatConditionMetrics(summary.conditionMetrics);
        }
        if (captureErrorRateDisplay) {
            captureErrorRateDisplay.textContent = formatPercent(summary.captureErrorRate);
        }
        if (conflictAdaptationDisplay) {
            conflictAdaptationDisplay.textContent = formatConflictAdaptation(summary.conflictAdaptation);
        }
        if (rtVariabilityDisplay) {
            rtVariabilityDisplay.textContent = formatRtVariability(summary.rtVariability);
        }
        if (nextParametersDisplay) {
            nextParametersDisplay.textContent = formatNextParameters(summary.nextParameters);
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
        clearTimeout(stimulusHideTimeout);
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
        adaptiveState = createInitialAdaptiveState(0);
        nextBlockIndex = 0;
        rng = fallbackMulberry32(1);
        totalTrials = sanitizeTrials(trialSetting.value);
        if (flankerEffectDisplay) flankerEffectDisplay.textContent = "";
        if (errorBreakdownDisplay) errorBreakdownDisplay.textContent = "";
        if (conditionMetricsDisplay) conditionMetricsDisplay.textContent = "";
        if (captureErrorRateDisplay) captureErrorRateDisplay.textContent = "";
        if (conflictAdaptationDisplay) conflictAdaptationDisplay.textContent = "";
        if (rtVariabilityDisplay) rtVariabilityDisplay.textContent = "";
        if (nextParametersDisplay) nextParametersDisplay.textContent = "";
        if (resultExplanationDisplay) resultExplanationDisplay.textContent = "";
        updateStats();
    }

    resetUI();
});
