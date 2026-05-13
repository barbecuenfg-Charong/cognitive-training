
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const restartBtn = document.getElementById('restart-btn');
    const digitContent = document.getElementById('digit-content');
    const userInputDisplay = document.getElementById('user-input-display');
    const inputArea = document.getElementById('input-area');
    const displayArea = document.getElementById('display-area');
    const currentLengthEl = document.getElementById('current-length');
    const scoreEl = document.getElementById('score');
    const resultModal = document.getElementById('result-modal');
    const finalSpanEl = document.getElementById('final-span');
    const finalScoreEl = document.getElementById('final-score');
    const performanceRatingEl = document.getElementById('performance-rating');
    const instructionText = document.getElementById('instruction-text');
    const roundIndicator = document.getElementById('round-indicator');
    const speedSelect = document.getElementById('speed-select');
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const GAME_ID = 'digit-span';
    const GAME_NAME = '数字广度 (Digit Span)';
    const CONTENT_VERSION = 'digit-span-training-p0a-seeded-v1';
    const START_SPAN = 3;
    const MIN_SPAN = 2;
    const MAX_SPAN = 9;
    const MAX_ATTEMPTS_PER_SPAN = 2;
    const CORRECT_STREAK_TO_INCREASE = 2;
    const FAILURE_STREAK_TO_DECREASE = MAX_ATTEMPTS_PER_SPAN;

    // Game State
    let state = {
        isPlaying: false,
        currentSpan: START_SPAN,
        startSpan: START_SPAN,
        minAttemptedSpan: START_SPAN,
        trials: 0,
        attemptsAtCurrentSpan: 0,
        correctStreak: 0,
        failureStreak: 0,
        maxSpan: 0,
        maxAttemptedSpan: 0,
        score: 0,
        sequence: [],
        sequenceId: '',
        userInput: [],
        mode: 'forward',
        speed: 1000
    };
    let sessionStartedAt = null;
    let trialStartedAt = 0;
    let trialLog = [];
    let sessionSaved = false;
    let sessionSeed = '';
    let sequenceCounter = 0;
    let terminationReason = 'not_started';
    let adaptationEvents = [];

    // Global functions for HTML onclick access
    window.inputDigit = function(digit) {
        if (!state.isPlaying || inputArea.style.display === 'none') return;
        // Limit input length to sequence length
        if (state.userInput.length < state.sequence.length) {
            state.userInput.push(digit);
            updateInputDisplay();
        }
    };

    window.deleteDigit = function() {
        if (!state.isPlaying || inputArea.style.display === 'none') return;
        state.userInput.pop();
        updateInputDisplay();
    };

    window.submitSequence = function() {
        if (!state.isPlaying || inputArea.style.display === 'none') return;
        if (state.userInput.length === 0) return;
        checkAnswer();
    };

    // Event Listeners
    startBtn.addEventListener('click', startGame);
    stopBtn.addEventListener('click', stopGame);
    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        startGame();
    });

    document.addEventListener('keydown', (e) => {
        if (!state.isPlaying || inputArea.style.display === 'none') return;

        if (e.key >= '0' && e.key <= '9') {
            window.inputDigit(parseInt(e.key));
        } else if (e.key === 'Backspace') {
            window.deleteDigit();
        } else if (e.key === 'Enter') {
            window.submitSequence();
        }
    });

    function fallbackHashString(value) {
        const text = String(value || '');
        let hash = 2166136261 >>> 0;
        for (let i = 0; i < text.length; i++) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function fallbackMulberry32(seed) {
        let stateValue = seed >>> 0;
        return function next() {
            stateValue = (stateValue + 0x6D2B79F5) >>> 0;
            let t = stateValue;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function getUrlSeed() {
        try {
            const params = new URLSearchParams(window.location.search);
            const seed = params.get('seed');
            return seed && seed.trim() ? seed.trim() : null;
        } catch (error) {
            return null;
        }
    }

    function createSessionSeed() {
        const seeded = window.SeededRandom;
        if (seeded && typeof seeded.createSessionSeed === 'function') {
            return seeded.createSessionSeed(GAME_ID);
        }
        const urlSeed = getUrlSeed();
        if (urlSeed) return urlSeed;
        const randomToken = Math.floor(Math.random() * 1e9).toString(36);
        return `${GAME_ID}-${Date.now().toString(36)}-${randomToken}`;
    }

    function createRng(seed) {
        const seeded = window.SeededRandom;
        if (seeded && typeof seeded.createRngFromSeed === 'function') {
            return seeded.createRngFromSeed(seed);
        }
        return fallbackMulberry32(fallbackHashString(seed));
    }

    function randomDigit(rng) {
        return Math.floor(rng() * 10);
    }

    function normalizeMode(mode) {
        if (mode === 'backward' || mode === 'sorted') return mode;
        return 'forward';
    }

    function getSettings() {
        let mode = 'forward';
        for (const radio of modeRadios) {
            if (radio.checked) {
                mode = normalizeMode(radio.value);
                break;
            }
        }
        return {
            mode: mode,
            speed: parseInt(speedSelect.value, 10) || 1000
        };
    }

    function startGame() {
        const settings = getSettings();
        state.mode = settings.mode;
        state.speed = settings.speed;
        state.isPlaying = true;
        state.currentSpan = START_SPAN;
        state.startSpan = START_SPAN;
        state.minAttemptedSpan = START_SPAN;
        state.trials = 0;
        state.attemptsAtCurrentSpan = 0;
        state.correctStreak = 0;
        state.failureStreak = 0;
        state.maxSpan = 0;
        state.maxAttemptedSpan = 0;
        state.score = 0;
        state.sequence = [];
        state.sequenceId = '';
        state.userInput = [];
        sessionStartedAt = new Date();
        trialStartedAt = 0;
        trialLog = [];
        sessionSaved = false;
        sessionSeed = createSessionSeed();
        sequenceCounter = 0;
        terminationReason = 'in_progress';
        adaptationEvents = [];

        // UI Updates
        resultModal.classList.add('hidden');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        scoreEl.textContent = '0';
        currentLengthEl.textContent = String(START_SPAN);
        digitContent.textContent = '';
        inputArea.style.display = 'none';
        instructionText.style.display = 'none';
        
        // Disable settings while playing
        speedSelect.disabled = true;
        modeRadios.forEach(r => r.disabled = true);
        
        nextRound();
    }

    function stopGame() {
        const finishedAt = new Date();
        const durationMs = sessionStartedAt
            ? Math.max(0, finishedAt.getTime() - sessionStartedAt.getTime())
            : 0;
        state.isPlaying = false;
        terminationReason = 'manual_stop';
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        inputArea.style.display = 'none';
        digitContent.textContent = '已停止';
        instructionText.textContent = '';
        
        // Re-enable settings
        speedSelect.disabled = false;
        modeRadios.forEach(r => r.disabled = false);

        saveTrainingResult(finishedAt, durationMs);
    }

    function gameOver() {
        state.isPlaying = false;
        if (terminationReason === 'in_progress') {
            terminationReason = 'two_failed_attempts';
        }
        const finishedAt = new Date();
        const durationMs = sessionStartedAt
            ? Math.max(0, finishedAt.getTime() - sessionStartedAt.getTime())
            : 0;
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        
        // Re-enable settings
        speedSelect.disabled = false;
        modeRadios.forEach(r => r.disabled = false);
        
        finalSpanEl.textContent = state.maxSpan; // Max successful span is usually currentSpan - 1 if failed, but here we track maxSpan separately
        finalScoreEl.textContent = state.score;
        
        let rating = '';
        const span = state.maxSpan;
        if (span >= 9) rating = '太棒了！你的短时记忆力非常出色！';
        else if (span >= 7) rating = '很棒！你的记忆力处于优秀水平。';
        else if (span >= 5) rating = '不错！你的记忆力处于正常水平。';
        else rating = '继续加油！多加练习可以提升记忆力。';
        
        performanceRatingEl.textContent = rating;
        saveTrainingResult(finishedAt, durationMs);
        resultModal.classList.remove('hidden');
    }

    function mean(values) {
        const valid = values.filter(value => Number.isFinite(value));
        if (valid.length === 0) return 0;
        return valid.reduce((sum, value) => sum + value, 0) / valid.length;
    }

    function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function clamp01(value) {
        return clampNumber(value, 0, 1);
    }

    function getAdaptiveStabilityLabel(spanStability, adaptationVolatility) {
        if (spanStability >= 0.8 && adaptationVolatility <= 0.2) return '高度稳定';
        if (spanStability >= 0.65 && adaptationVolatility <= 0.35) return '较稳定';
        if (spanStability >= 0.45 && adaptationVolatility <= 0.55) return '波动可控';
        return '不稳定';
    }

    function analyzeAdaptationDynamics(events, totalTrials, exactAccuracy, positionAccuracy) {
        if (totalTrials === 0) {
            return {
                moveCount: 0,
                holdCount: 0,
                holdRate: 0,
                reversalCount: 0,
                reversalRate: 0,
                spanOscillationCount: 0,
                oscillationRate: 0,
                adaptationVolatility: 0,
                spanStability: 0,
                adaptiveStabilityLabel: '样本不足'
            };
        }

        const moveEvents = [];
        const spanHistory = [];
        let reversalCount = 0;
        let spanOscillationCount = 0;
        let previousMoveDirection = 0;

        for (let i = 0; i < events.length; i++) {
            const event = events[i];
            const delta = event.spanAfter - event.spanBefore;
            const direction = delta > 0 ? 1 : delta < 0 ? -1 : 0;

            if (direction !== 0) {
                moveEvents.push(direction);
                if (previousMoveDirection !== 0 && direction !== previousMoveDirection) {
                    reversalCount += 1;
                }
                previousMoveDirection = direction;
            }

            if (spanHistory.length >= 2) {
                const previousSpan = spanHistory[spanHistory.length - 1];
                const twoBackSpan = spanHistory[spanHistory.length - 2];
                if (event.spanAfter === twoBackSpan && event.spanAfter !== previousSpan) {
                    spanOscillationCount += 1;
                }
            }

            spanHistory.push(event.spanAfter);
        }

        const moveCount = moveEvents.length;
        const holdCount = events.filter(event => event.action === 'hold').length;
        const holdRate = totalTrials > 0 ? holdCount / totalTrials : 0;
        const reversalRate = moveCount > 1 ? reversalCount / (moveCount - 1) : 0;
        const oscillationRate = totalTrials > 2 ? spanOscillationCount / (totalTrials - 2) : 0;
        const adaptationVolatility = clamp01((reversalRate * 0.65) + (oscillationRate * 0.35));
        const spanStability = clamp01(
            ((1 - adaptationVolatility) * 0.55) +
            (holdRate * 0.2) +
            (exactAccuracy * 0.15) +
            (positionAccuracy * 0.1)
        );

        return {
            moveCount,
            holdCount,
            holdRate,
            reversalCount,
            reversalRate,
            spanOscillationCount,
            oscillationRate,
            adaptationVolatility,
            spanStability,
            adaptiveStabilityLabel: getAdaptiveStabilityLabel(spanStability, adaptationVolatility)
        };
    }

    function computeModeTransitionReadiness(summary) {
        const performanceCore = clamp01((summary.exactAccuracy * 0.6) + (summary.positionAccuracy * 0.4));
        const stabilityCore = clamp01(summary.spanStability);
        const forwardBonus = summary.sequenceMode === 'forward' ? 0.12 : 0.04;
        const backwardBonus = summary.sequenceMode === 'backward' ? 0.12 : 0.04;
        const sortedBonus = summary.sequenceMode === 'sorted' ? 0.12 : 0.04;

        const backwardReadiness = clamp01((performanceCore * 0.55) + (stabilityCore * 0.35) + forwardBonus);
        const sortedReadiness = clamp01((performanceCore * 0.5) + (stabilityCore * 0.4) + backwardBonus);

        return {
            backwardReadiness,
            sortedReadiness,
            modeTransitionReadiness: {
                backward: backwardReadiness,
                backwardReadiness,
                sorted: sortedReadiness,
                sortedReadiness,
                currentMode: summary.sequenceMode,
                currentModeBonus: summary.sequenceMode === 'sorted' ? sortedBonus : summary.sequenceMode === 'backward' ? backwardBonus : forwardBonus
            }
        };
    }

    function buildDigitSpanPrescription(summary) {
        const currentStart = clampNumber(summary.startingSpan || summary.startSpan || START_SPAN, MIN_SPAN, MAX_SPAN);
        const stableSpan = clampNumber(summary.maxSuccessfulSpan || summary.maxSpan || currentStart, MIN_SPAN, MAX_SPAN);
        const instabilityThreshold = summary.spanStability < 0.5 || summary.adaptationVolatility >= 0.55 || summary.reversalCount >= 2;
        const transitionReadiness = summary.modeTransitionReadiness || {
            backward: summary.backwardReadiness,
            sorted: summary.sortedReadiness
        };

        if (summary.terminationReason === 'manual_stop' || summary.totalTrials === 0) {
            return {
                nextStartSpan: currentStart,
                nextMode: summary.sequenceMode,
                nextPrescriptionReason: '本轮手动停止或样本不足，下一轮先复用当前起始长度和模式完成有效阶梯。'
            };
        }

        if (instabilityThreshold) {
            const loweredStart = clampNumber(Math.max(MIN_SPAN, currentStart - 1), MIN_SPAN, MAX_SPAN);
            return {
                nextStartSpan: loweredStart,
                nextMode: summary.sequenceMode,
                nextPrescriptionReason: `本轮阶梯稳定性偏低（${summary.adaptiveStabilityLabel}，震荡 ${summary.spanOscillationCount} 次，反转 ${summary.reversalCount} 次，波动 ${Math.round(summary.adaptationVolatility * 100)}%），下一轮先把起始长度调到 ${loweredStart} 并保持 ${summary.sequenceMode}，优先稳住当前 span。`
            };
        }

        if (summary.exactAccuracy >= 0.8 && summary.sequenceMode === 'forward' && stableSpan >= 6 && transitionReadiness.backward >= 0.72) {
            return {
                nextStartSpan: clampNumber(Math.max(START_SPAN, stableSpan - 1), MIN_SPAN, MAX_SPAN),
                nextMode: 'backward',
                nextPrescriptionReason: `正向广度已较稳定（${summary.adaptiveStabilityLabel}，质量 ${Math.round(summary.staircaseQuality * 100)}%），倒背 readiness 已达 ${Math.round(transitionReadiness.backward * 100)}%，下一轮切换倒背以增加工作记忆操作负荷。`
            };
        }

        if (summary.exactAccuracy >= 0.8 && summary.sequenceMode === 'backward' && stableSpan >= 6 && transitionReadiness.sorted >= 0.72) {
            return {
                nextStartSpan: clampNumber(Math.max(START_SPAN, stableSpan - 1), MIN_SPAN, MAX_SPAN),
                nextMode: 'sorted',
                nextPrescriptionReason: `倒背广度已较稳定（${summary.adaptiveStabilityLabel}，质量 ${Math.round(summary.staircaseQuality * 100)}%），升序整理 readiness 已达 ${Math.round(transitionReadiness.sorted * 100)}%，下一轮切换升序整理以训练短时保持后的重排能力。`
            };
        }

        if (summary.exactAccuracy >= 0.75 && stableSpan >= summary.startingSpan) {
            return {
                nextStartSpan: clampNumber(stableSpan, MIN_SPAN, MAX_SPAN),
                nextMode: summary.sequenceMode,
                nextPrescriptionReason: `正确率达标且阶梯质量尚可（${summary.adaptiveStabilityLabel}，质量 ${Math.round(summary.staircaseQuality * 100)}%），下一轮从本轮稳定达到的广度附近继续训练。`
            };
        }

        if (summary.positionAccuracy < 0.6 || stableSpan <= summary.startingSpan) {
            return {
                nextStartSpan: clampNumber(Math.max(MIN_SPAN, summary.startingSpan - 1), MIN_SPAN, MAX_SPAN),
                nextMode: 'forward',
                nextPrescriptionReason: `位置正确率或最终广度偏低，且阶梯质量为 ${summary.adaptiveStabilityLabel}（质量 ${Math.round(summary.staircaseQuality * 100)}%），下一轮降低起始负荷并优先稳定顺序回忆。`
            };
        }

        return {
            nextStartSpan: currentStart,
            nextMode: summary.sequenceMode,
            nextPrescriptionReason: `当前负荷基本合适（${summary.adaptiveStabilityLabel}，质量 ${Math.round(summary.staircaseQuality * 100)}%），下一轮保持起始长度和模式巩固稳定性。`
        };
    }

    function buildSummary() {
        const totalTrials = trialLog.length;
        const correctCount = trialLog.filter(trial => trial.correct).length;
        const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
        const exactAccuracy = mean(trialLog.map(trial => trial.exactAccuracy));
        const positionAccuracy = mean(trialLog.map(trial => trial.positionAccuracy));
        const responseDurations = trialLog.map(trial => trial.responseDurationMs);
        const attemptedSpans = trialLog.map(trial => trial.span);
        const adaptationMetrics = analyzeAdaptationDynamics(adaptationEvents, totalTrials, exactAccuracy, positionAccuracy);
        const modeTransitionReadiness = computeModeTransitionReadiness({
            exactAccuracy,
            positionAccuracy,
            spanStability: adaptationMetrics.spanStability,
            sequenceMode: state.mode
        });
        const spanProgression = trialLog.map(trial => ({
            trialIndex: trial.index,
            span: trial.span,
            attempt: trial.attempt,
            sequenceId: trial.sequenceId,
            correct: trial.correct,
            exactAccuracy: trial.exactAccuracy,
            positionAccuracy: trial.positionAccuracy,
            spanAfterTrial: trial.spanAfterTrial,
            adaptationAction: trial.adaptationAction,
            adaptationReason: trial.adaptationReason
        }));
        const maxAttemptedSpan = totalTrials > 0
            ? trialLog.reduce((max, trial) => Math.max(max, trial.span), 0)
            : state.maxAttemptedSpan;
        const minSpan = attemptedSpans.length > 0 ? Math.min(...attemptedSpans) : state.currentSpan;
        const finalSpan = state.currentSpan;
        const summary = {
            maxSpan: state.maxSpan,
            maxSuccessfulSpan: state.maxSpan,
            minSpan,
            startingSpan: state.startSpan,
            finalSpan,
            maxAttemptedSpan,
            totalTrials,
            correctCount,
            accuracy,
            exactAccuracy,
            positionAccuracy,
            spanStability: adaptationMetrics.spanStability,
            adaptiveStabilityLabel: adaptationMetrics.adaptiveStabilityLabel,
            staircaseQuality: clamp01(
                (adaptationMetrics.spanStability * 0.45) +
                (exactAccuracy * 0.35) +
                (positionAccuracy * 0.2)
            ),
            spanOscillationCount: adaptationMetrics.spanOscillationCount,
            reversalCount: adaptationMetrics.reversalCount,
            adaptationVolatility: adaptationMetrics.adaptationVolatility,
            backwardReadiness: modeTransitionReadiness.backwardReadiness,
            sortedReadiness: modeTransitionReadiness.sortedReadiness,
            modeTransitionReadiness: modeTransitionReadiness.modeTransitionReadiness,
            sequenceMode: state.mode,
            spanProgression,
            adaptationEvents: adaptationEvents.map(copyAdaptationEvent),
            startSpan: state.startSpan,
            currentSpan: state.currentSpan,
            mode: state.mode,
            score: state.score,
            speed: state.speed,
            speedMs: state.speed,
            meanResponseDurationMs: Math.round(mean(responseDurations)),
            terminationReason,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        };

        return {
            ...summary,
            ...buildDigitSpanPrescription(summary)
        };
    }

    function copyTrial(trial) {
        return {
            ...trial,
            sequence: [...trial.sequence],
            targetSequence: [...trial.targetSequence],
            expectedResponse: [...trial.expectedResponse],
            response: [...trial.response],
            userInput: [...trial.userInput],
            adaptationEvent: trial.adaptationEvent ? copyAdaptationEvent(trial.adaptationEvent) : null
        };
    }

    function copyAdaptationEvent(event) {
        return { ...event };
    }

    function saveTrainingResult(finishedAt, durationMs) {
        if (sessionSaved || !sessionStartedAt) return;
        sessionSaved = true;

        if (!window.TrainingResults || typeof window.TrainingResults.saveSession !== 'function') {
            return;
        }

        const summary = buildSummary();

        window.TrainingResults.saveSession({
            moduleId: GAME_ID,
            gameId: GAME_ID,
            gameName: GAME_NAME,
            startedAt: sessionStartedAt,
            finishedAt,
            durationMs,
            score: state.score,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: trialLog.map(copyTrial),
            metrics: {
                startingSpan: summary.startingSpan,
                startSpan: summary.startSpan,
                minSpan: summary.minSpan,
                maxSpan: summary.maxSpan,
                maxSuccessfulSpan: summary.maxSuccessfulSpan,
                finalSpan: summary.finalSpan,
                maxAttemptedSpan: summary.maxAttemptedSpan,
                mode: summary.mode,
                totalTrials: summary.totalTrials,
                correctCount: summary.correctCount,
                accuracy: summary.accuracy,
                accuracyPct: `${Math.round(summary.accuracy * 100)}%`,
                exactAccuracy: summary.exactAccuracy,
                exactAccuracyPct: `${Math.round(summary.exactAccuracy * 100)}%`,
                positionAccuracy: summary.positionAccuracy,
                positionAccuracyPct: `${Math.round(summary.positionAccuracy * 100)}%`,
                spanStability: summary.spanStability,
                adaptiveStabilityLabel: summary.adaptiveStabilityLabel,
                staircaseQuality: summary.staircaseQuality,
                spanOscillationCount: summary.spanOscillationCount,
                reversalCount: summary.reversalCount,
                adaptationVolatility: summary.adaptationVolatility,
                backwardReadiness: summary.backwardReadiness,
                sortedReadiness: summary.sortedReadiness,
                modeTransitionReadiness: summary.modeTransitionReadiness,
                sequenceMode: summary.sequenceMode,
                spanProgression: summary.spanProgression,
                adaptationEvents: summary.adaptationEvents,
                nextStartSpan: summary.nextStartSpan,
                nextMode: summary.nextMode,
                nextPrescriptionReason: summary.nextPrescriptionReason,
                score: state.score,
                speed: `${state.speed}ms`,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ['memory', 'digit-span', summary.sequenceMode]
        });
    }

    function generateSequence(length) {
        sequenceCounter += 1;
        const attempt = state.attemptsAtCurrentSpan + 1;
        const sequenceId = `${sessionSeed}:${CONTENT_VERSION}:${state.mode}:trial-${sequenceCounter}:span-${length}:attempt-${attempt}`;
        const rng = createRng(sequenceId);
        const seq = [];
        for (let i = 0; i < length; i++) {
            seq.push(randomDigit(rng));
        }
        return {
            sequence: seq,
            sequenceId
        };
    }

    function updateInputDisplay() {
        // Add spaces for readability
        userInputDisplay.textContent = state.userInput.join(' ');
    }

    function nextRound() {
        if (!state.isPlaying) return;

        const generated = generateSequence(state.currentSpan);
        state.sequence = generated.sequence;
        state.sequenceId = generated.sequenceId;
        state.userInput = [];
        state.maxAttemptedSpan = Math.max(state.maxAttemptedSpan, state.currentSpan);
        state.minAttemptedSpan = Math.min(state.minAttemptedSpan, state.currentSpan);
        updateInputDisplay();

        currentLengthEl.textContent = state.currentSpan;
        roundIndicator.textContent = `阶梯：正确 ${state.correctStreak}/${CORRECT_STREAK_TO_INCREASE} · 失误 ${state.failureStreak}/${FAILURE_STREAK_TO_DECREASE}`;
        roundIndicator.style.display = 'block';

        displaySequence();
    }

    function displaySequence() {
        inputArea.style.display = 'none';
        digitContent.textContent = '';
        instructionText.style.display = 'block';
        instructionText.textContent = '准备...';
        
        // Clear any lingering feedback styles
        digitContent.style.color = '#2c3e50';

        let i = 0;
        const seq = state.sequence;
        
        setTimeout(() => {
            if (!state.isPlaying) return;
            instructionText.style.display = 'none';
            
            // Using a recursive timeout approach for better control than setInterval
            function showNextDigit() {
                if (!state.isPlaying) return;

                if (i < seq.length) {
                    digitContent.textContent = seq[i];
                    digitContent.style.transform = 'scale(1.2)';
                    
                    setTimeout(() => {
                        digitContent.style.transform = 'scale(1)';
                    }, 100);

                    // Display time
                    setTimeout(() => {
                        if (!state.isPlaying) return;
                        digitContent.textContent = ''; // Blank
                        
                        // Interval time
                        setTimeout(() => {
                            i++;
                            showNextDigit();
                        }, 200); // 200ms blank interval
                    }, state.speed); 
                } else {
                    // Sequence finished
                    setTimeout(startInputPhase, 500);
                }
            }
            
            showNextDigit();
        }, 1000);
    }

    function startInputPhase() {
        if (!state.isPlaying) return;
        
        digitContent.textContent = '?';
        inputArea.style.display = 'flex';
        instructionText.style.display = 'block';
        instructionText.textContent = getModePrompt();
        trialStartedAt = Date.now();
        
        // Highlight active input
        userInputDisplay.classList.add('active');
    }

    function getTargetSequence() {
        if (state.mode === 'backward') return [...state.sequence].reverse();
        if (state.mode === 'sorted') return [...state.sequence].sort((a, b) => a - b);
        return [...state.sequence];
    }

    function getModePrompt() {
        if (state.mode === 'backward') return '请输入数字 (倒序)';
        if (state.mode === 'sorted') return '请输入数字 (升序排序)';
        return '请输入数字 (顺序)';
    }

    function calculatePositionAccuracy(response, target) {
        if (target.length === 0) return 0;
        let correctPositions = 0;
        for (let i = 0; i < target.length; i++) {
            if (response[i] === target[i]) {
                correctPositions += 1;
            }
        }
        return correctPositions / target.length;
    }

    function hasSameDigitMultiset(response, target) {
        if (response.length !== target.length) return false;
        const counts = new Map();
        target.forEach(digit => counts.set(digit, (counts.get(digit) || 0) + 1));
        for (const digit of response) {
            const nextCount = (counts.get(digit) || 0) - 1;
            if (nextCount < 0) return false;
            counts.set(digit, nextCount);
        }
        return Array.from(counts.values()).every(count => count === 0);
    }

    function classifyError(response, target, isCorrect) {
        if (isCorrect) return 'none';
        if (response.length === 0) return 'no_response';
        if (response.length < target.length) return 'omission';
        if (response.length > target.length) return 'insertion';
        if (hasSameDigitMultiset(response, target)) return 'order';
        return calculatePositionAccuracy(response, target) > 0 ? 'mixed' : 'content';
    }

    function checkAnswer() {
        const target = getTargetSequence();
        const input = state.userInput;
        
        // We allow submitting even if length is different, but logic dictates it must be same length for correct answer
        let isCorrect = true;
        if (input.length !== target.length) {
            isCorrect = false;
        } else {
            for (let i = 0; i < target.length; i++) {
                if (input[i] !== target[i]) {
                    isCorrect = false;
                    break;
                }
            }
        }

        const trial = recordTrial(isCorrect);
        showFeedback(isCorrect, trial);
    }

    function recordTrial(isCorrect) {
        const now = Date.now();
        const startedMs = sessionStartedAt ? sessionStartedAt.getTime() : now;
        const targetSequence = getTargetSequence();
        const response = [...state.userInput];
        const responseDurationMs = trialStartedAt ? Math.max(0, now - trialStartedAt) : 0;
        const attempt = state.attemptsAtCurrentSpan + 1;
        const positionAccuracy = calculatePositionAccuracy(response, targetSequence);
        const trial = {
            index: trialLog.length,
            trialIndex: trialLog.length,
            sequenceId: state.sequenceId,
            span: state.currentSpan,
            sequenceLength: state.sequence.length,
            attempt,
            attemptInSpan: attempt,
            mode: state.mode,
            sequenceMode: state.mode,
            sequence: [...state.sequence],
            targetSequence,
            expectedResponse: [...targetSequence],
            response,
            userInput: response,
            correct: isCorrect,
            exactAccuracy: isCorrect ? 1 : 0,
            positionAccuracy,
            errorType: classifyError(response, targetSequence, isCorrect),
            rt: responseDurationMs,
            rtMs: responseDurationMs,
            responseDurationMs,
            spanBeforeTrial: state.currentSpan,
            spanAfterTrial: state.currentSpan,
            attemptsAtSpanBeforeTrial: state.attemptsAtCurrentSpan,
            correctStreakBeforeTrial: state.correctStreak,
            failureStreakBeforeTrial: state.failureStreak,
            correctStreakAfterTrial: state.correctStreak,
            failureStreakAfterTrial: state.failureStreak,
            failuresBeforeTrial: state.failureStreak,
            failuresAfterTrial: state.failureStreak,
            adaptationAction: 'pending',
            adaptationReason: 'pending',
            adaptationEvent: null,
            terminalTrial: false,
            elapsedMs: Math.max(0, now - startedMs)
        };
        trialLog.push(trial);
        return trial;
    }

    function recordAdaptationEvent(trial, action, reason, spanBefore, spanAfter, terminal) {
        const event = {
            index: adaptationEvents.length,
            trialIndex: trial.trialIndex,
            sequenceId: trial.sequenceId,
            mode: state.mode,
            sequenceMode: state.mode,
            correct: trial.correct,
            action,
            reason,
            spanBefore,
            spanAfter,
            correctStreak: state.correctStreak,
            failureStreak: state.failureStreak,
            terminal,
            elapsedMs: trial.elapsedMs
        };
        adaptationEvents.push(event);
        trial.spanAfterTrial = spanAfter;
        trial.correctStreakAfterTrial = state.correctStreak;
        trial.failureStreakAfterTrial = state.failureStreak;
        trial.failuresAfterTrial = state.failureStreak;
        trial.adaptationAction = action;
        trial.adaptationReason = reason;
        trial.adaptationEvent = copyAdaptationEvent(event);
        trial.terminalTrial = terminal;
        return event;
    }

    function applyStaircase(isCorrect, trial) {
        const spanBefore = state.currentSpan;
        let action = 'hold';
        let reason = '';
        let terminal = false;

        state.attemptsAtCurrentSpan += 1;

        if (isCorrect) {
            state.score += spanBefore * 10;
            state.maxSpan = Math.max(state.maxSpan, spanBefore);
            state.correctStreak += 1;
            state.failureStreak = 0;
            state.trials = 0;

            if (state.correctStreak >= CORRECT_STREAK_TO_INCREASE) {
                const nextSpan = clampNumber(spanBefore + 1, MIN_SPAN, MAX_SPAN);
                if (nextSpan > spanBefore) {
                    state.currentSpan = nextSpan;
                    action = 'increase';
                    reason = 'consecutive_correct';
                } else {
                    action = 'hold';
                    reason = 'max_span_reached';
                }
                state.correctStreak = 0;
                state.failureStreak = 0;
                state.trials = 0;
                state.attemptsAtCurrentSpan = 0;
            } else {
                reason = 'awaiting_consecutive_correct';
            }
        } else {
            state.failureStreak += 1;
            state.correctStreak = 0;
            state.trials = state.failureStreak;

            if (state.failureStreak >= FAILURE_STREAK_TO_DECREASE) {
                if (spanBefore > MIN_SPAN) {
                    state.currentSpan = spanBefore - 1;
                    action = 'decrease';
                    reason = 'consecutive_failures';
                    state.correctStreak = 0;
                    state.failureStreak = 0;
                    state.trials = 0;
                    state.attemptsAtCurrentSpan = 0;
                } else {
                    action = 'terminate';
                    reason = 'min_span_failed';
                    terminal = true;
                    terminationReason = reason;
                }
            } else {
                reason = 'awaiting_consecutive_failure';
            }
        }

        return recordAdaptationEvent(trial, action, reason, spanBefore, state.currentSpan, terminal);
    }

    function showFeedback(isCorrect, trial) {
        const adaptationEvent = applyStaircase(isCorrect, trial);
        inputArea.style.display = 'none';
        instructionText.style.display = 'none';
        userInputDisplay.classList.remove('active');
        
        if (isCorrect) {
            digitContent.textContent = '✔';
            digitContent.style.color = '#2ecc71';
            scoreEl.textContent = state.score;
            
            setTimeout(() => {
                if (!state.isPlaying) return;
                digitContent.style.color = '#2c3e50';
                nextRound();
            }, 1500);
        } else {
            digitContent.textContent = '✘';
            digitContent.style.color = '#e74c3c';
            
            const correctSeq = getTargetSequence().join(' ');
            instructionText.style.display = 'block';
            instructionText.innerHTML = `<span style="color:#7f8c8d; font-size: 16px;">正确答案</span><br><span style="font-size: 24px; color: #2c3e50;">${correctSeq}</span>`;
            
            setTimeout(() => {
                if (!state.isPlaying) return;
                digitContent.style.color = '#2c3e50';
                instructionText.style.display = 'none';
                
                if (adaptationEvent.terminal) {
                    gameOver();
                } else {
                    nextRound();
                }
            }, 3000); // Longer time to see correct answer
        }
    }
});
