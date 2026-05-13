document.addEventListener('DOMContentLoaded', () => {
    const MODULE_ID = 'corsi';
    const GAME_NAME = '科西方块';
    const CONTENT_VERSION = 'corsi-training-p0b-2026-05-11';

    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    const restartBtn = document.getElementById('restart-btn');
    const gameArea = document.getElementById('game-area');
    const levelDisplay = document.getElementById('current-level');
    const scoreDisplay = document.getElementById('score');
    const messageDisplay = document.getElementById('message-display');
    const resultModal = document.getElementById('result-modal');
    const finalLevelDisplay = document.getElementById('final-level');
    const finalScoreDisplay = document.getElementById('final-score');
    const memorySpanRating = document.getElementById('memory-span-rating');
    const startLevelInput = document.getElementById('start-level');
    const blockCountInput = document.getElementById('block-count');
    const adaptiveModeInput = document.getElementById('adaptive-mode');
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const MIN_SPAN = 2;
    const MAX_SPAN = 12;
    const MIN_BLOCK_COUNT = 2;
    const MAX_BLOCK_COUNT = 20;
    const ADAPTIVE_MAX_TRIALS = 16;
    const ADAPTIVE_WINDOW_SIZE = 3;
    const ADAPTIVE_UP_STREAK = 2;
    const STABILITY_ADVANCE_THRESHOLD = 0.65;
    const STABILITY_SWITCH_THRESHOLD = 0.72;

    let blocks = [];
    let blockLayout = [];
    let sequence = [];
    let userSequence = [];
    let currentLevel = 3;
    let initialLevel = 3;
    let score = 0;
    let isPlaying = false;
    let isShowingSequence = false;
    let isBackwardMode = false;
    let blockCount = 9;
    let levelErrorCount = 0;
    let maxErrorsPerLevel = 1;
    let sessionStartedAt = null;
    let sessionStartedMs = 0;
    let responseStartedAt = 0;
    let trialLog = [];
    let sessionSaved = false;
    let sessionSeed = '';
    let sequenceRng = null;
    let terminationReason = 'not_started';
    let highestCorrectLevel = 0;
    let maxLevel = currentLevel;
    let minLevel = currentLevel;
    let isAdaptiveMode = true;
    let startingMode = 'forward';
    let startingBlockCount = blockCount;
    let adaptationEvents = [];
    let modeChanges = [];
    let blockLayoutSeed = '';
    let blockLayoutSeedHistory = [];
    let consecutiveCorrect = 0;
    let consecutiveIncorrect = 0;
    let trialInProgress = false;
    let responseTimer = null;

    // Audio context for sound feedback
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    startBtn.addEventListener('click', startGame);
    stopBtn.addEventListener('click', () => endGame(true));
    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        startGame();
    });

    modeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            isBackwardMode = e.target.value === 'backward';
        });
    });

    blockCountInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < MIN_BLOCK_COUNT) val = MIN_BLOCK_COUNT;
        if (val > MAX_BLOCK_COUNT) val = MAX_BLOCK_COUNT;
        e.target.value = val;
        blockCount = val;
        if (!isPlaying) initBlocks(createPreviewRng());
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
        const seeded = window.SeededRandom;
        if (seeded && typeof seeded.createSessionSeed === 'function') {
            return seeded.createSessionSeed(MODULE_ID);
        }
        return `${MODULE_ID}-${Date.now().toString(36)}`;
    }

    function createRng(seed) {
        const seeded = window.SeededRandom;
        if (seeded && typeof seeded.createRngFromSeed === 'function') {
            return seeded.createRngFromSeed(seed);
        }
        return fallbackMulberry32(fallbackHashString(seed));
    }

    function createPreviewRng() {
        return createRng(`${MODULE_ID}-preview-${Date.now().toString(36)}-${blockCount}`);
    }

    function randomIndex(rng, maxExclusive) {
        return Math.floor(rng() * maxExclusive);
    }

    function playSound(freq, type = 'sine', duration = 0.1) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
        osc.stop(audioCtx.currentTime + duration);
    }

    function initBlocks(rng = createPreviewRng()) {
        const activeRng = typeof rng === 'function' ? rng : createPreviewRng();
        gameArea.innerHTML = '';
        blocks = [];
        blockLayout = [];

        // Keep the classic irregular Corsi layout, but make offsets replayable from the session seed.
        const cols = Math.ceil(Math.sqrt(blockCount));
        const rows = Math.ceil(blockCount / cols);
        const cellW = gameArea.clientWidth / cols;
        const cellH = gameArea.clientHeight / rows;
        const padding = 10;
        const blockSize = window.innerWidth <= 768 ? 50 : 60;

        for (let i = 0; i < blockCount; i++) {
            const block = document.createElement('div');
            block.className = 'corsi-block';
            block.dataset.index = i;

            const col = i % cols;
            const row = Math.floor(i / cols);
            const maxOffsetX = Math.max(0, cellW - blockSize - padding * 2);
            const maxOffsetY = Math.max(0, cellH - blockSize - padding * 2);
            const offsetX = activeRng() * maxOffsetX + padding;
            const offsetY = activeRng() * maxOffsetY + padding;
            const left = col * cellW + offsetX;
            const top = row * cellH + offsetY;

            block.style.left = `${left}px`;
            block.style.top = `${top}px`;

            block.addEventListener('mousedown', handleBlockClick);
            block.addEventListener('touchstart', (e) => {
                e.preventDefault(); // Prevent double firing
                handleBlockClick(e);
            });

            gameArea.appendChild(block);
            blocks.push(block);
            blockLayout.push({
                id: `block-${i}`,
                index: i,
                x: Math.round(left),
                y: Math.round(top),
                left: Math.round(left),
                top: Math.round(top),
                size: blockSize
            });
        }
    }

    function getMode() {
        return isBackwardMode ? 'backward' : 'forward';
    }

    function getMemorySpan() {
        return Math.max(0, highestCorrectLevel);
    }

    function getExpectedResponseSequence() {
        return isBackwardMode ? sequence.slice().reverse() : sequence.slice();
    }

    function cloneBlockLayout() {
        return blockLayout.map(item => ({ ...item }));
    }

    function createBlockLayoutSeed(reason = 'layout') {
        const index = blockLayoutSeedHistory.length;
        return `${sessionSeed || MODULE_ID}:layout:${blockCount}:${index}:${reason}`;
    }

    function applyBlockLayout(reason = 'layout') {
        blockLayoutSeed = createBlockLayoutSeed(reason);
        initBlocks(createRng(blockLayoutSeed));
        blockLayoutSeedHistory.push({
            index: blockLayoutSeedHistory.length,
            seed: blockLayoutSeed,
            blockCount,
            mode: getMode(),
            reason,
            elapsedMs: sessionStartedMs > 0 ? Math.max(0, Date.now() - sessionStartedMs) : 0
        });
    }

    function setMode(nextMode, reason, afterTrial = trialLog.length) {
        const normalizedMode = nextMode === 'backward' ? 'backward' : 'forward';
        const previousMode = getMode();
        if (previousMode === normalizedMode) return null;

        isBackwardMode = normalizedMode === 'backward';
        modeRadios.forEach(radio => {
            radio.checked = radio.value === normalizedMode;
        });

        const event = {
            index: modeChanges.length,
            afterTrial,
            fromMode: previousMode,
            toMode: normalizedMode,
            reason,
            elapsedMs: sessionStartedMs > 0 ? Math.max(0, Date.now() - sessionStartedMs) : 0
        };
        modeChanges.push(event);
        return event;
    }

    function clearResponseTimer() {
        if (responseTimer) {
            clearTimeout(responseTimer);
            responseTimer = null;
        }
    }

    function getResponseTimeoutMs() {
        return Math.max(7000, currentLevel * 2200);
    }

    function startResponseTimer() {
        clearResponseTimer();
        responseTimer = setTimeout(handleResponseTimeout, getResponseTimeoutMs());
    }

    function copyTrial(trial) {
        return {
            ...trial,
            blockSequence: trial.blockSequence.slice(),
            responseSequence: trial.responseSequence.slice(),
            expectedResponseSequence: trial.expectedResponseSequence.slice()
        };
    }

    function recordTrial({ correct, spanAfterTrial, errorType, timedOut = false, interruptedDuring = null }) {
        const now = Date.now();
        const responseDurationMs = responseStartedAt > 0 ? Math.max(0, now - responseStartedAt) : 0;
        const expectedResponseSequence = getExpectedResponseSequence();
        const errorPosition = correct
            ? null
            : (userSequence.length > 0 ? Math.max(0, userSequence.length - 1) : null);
        const expectedBlock = !correct && errorPosition !== null
            ? expectedResponseSequence[errorPosition] ?? null
            : null;
        const selectedBlock = !correct && userSequence.length > 0
            ? userSequence[userSequence.length - 1]
            : null;

        const trial = {
            index: trialLog.length,
            sequenceLength: sequence.length,
            level: currentLevel,
            sequenceMode: getMode(),
            mode: getMode(),
            blockCount,
            blockLayoutSeed,
            blockSequence: sequence.slice(),
            expectedResponseSequence,
            responseSequence: userSequence.slice(),
            expectedResponseLength: expectedResponseSequence.length,
            responseLength: userSequence.length,
            responseLengthMismatch: userSequence.length !== expectedResponseSequence.length,
            correct,
            rtMs: responseDurationMs,
            responseDurationMs,
            spanBeforeTrial: currentLevel,
            spanAfterTrial,
            attemptInSpan: levelErrorCount + 1,
            errorType,
            errorPosition,
            expectedBlock,
            selectedBlock,
            timedOut,
            interruptedDuring,
            elapsedMs: sessionStartedMs > 0 ? Math.max(0, now - sessionStartedMs) : 0
        };

        trialLog.push(trial);
        trialInProgress = false;
        return trial;
    }

    function meanResponseDurationMs() {
        const durations = trialLog
            .map(trial => trial.responseDurationMs)
            .filter(value => Number.isFinite(value));

        if (durations.length === 0) return 0;
        const total = durations.reduce((sum, value) => sum + value, 0);
        return Math.round(total / durations.length);
    }

    function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function countErrorTypes() {
        return trialLog.reduce((counts, trial) => {
            const type = trial.errorType || 'unknown';
            if (type !== 'none') {
                counts[type] = (counts[type] || 0) + 1;
            }
            return counts;
        }, {});
    }

    function cloneAdaptationEvent(event) {
        return {
            ...event,
            recentSummary: event.recentSummary
                ? {
                    ...event.recentSummary,
                    errorTypes: { ...(event.recentSummary.errorTypes || {}) }
                }
                : null
        };
    }

    function ratio(count, total) {
        return total > 0 ? count / total : 0;
    }

    function roundMetric(value) {
        return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : 0;
    }

    function getRecentTrialSummary(size = ADAPTIVE_WINDOW_SIZE) {
        const recentTrials = trialLog.slice(Math.max(0, trialLog.length - size));
        const errorTypes = {};
        recentTrials.forEach(trial => {
            if (trial.errorType && trial.errorType !== 'none') {
                errorTypes[trial.errorType] = (errorTypes[trial.errorType] || 0) + 1;
            }
        });

        const correctCount = recentTrials.filter(trial => trial.correct).length;
        return {
            totalTrials: recentTrials.length,
            correctCount,
            accuracy: ratio(correctCount, recentTrials.length),
            errorTypes
        };
    }

    function analyzeSpanStability(summaryCore) {
        const spanTrace = trialLog.map(trial => {
            const span = Number.isFinite(trial.spanAfterTrial)
                ? trial.spanAfterTrial
                : (Number.isFinite(trial.spanBeforeTrial) ? trial.spanBeforeTrial : currentLevel);
            return {
                trialIndex: trial.index,
                span
            };
        });

        if (spanTrace.length <= 1) {
            return {
                spanOscillationCount: 0,
                reversalCount: 0,
                adaptationVolatility: 0,
                spanStability: 1,
                staircaseQuality: roundMetric(clampNumber(summaryCore.accuracy || 0, 0, 1)),
                adaptiveStabilityLabel: 'insufficient-data',
                backwardReadiness: roundMetric(clampNumber((summaryCore.accuracy || 0) * 0.5, 0, 1)),
                forwardReadiness: roundMetric(clampNumber((summaryCore.accuracy || 0) * 0.5, 0, 1)),
                modeTransitionReadiness: roundMetric(clampNumber((summaryCore.accuracy || 0) * 0.5, 0, 1))
            };
        }

        let spanOscillationCount = 0;
        let reversalCount = 0;
        let totalAbsDelta = 0;
        let meaningfulTransitions = 0;
        let previousDirection = 0;

        for (let i = 1; i < spanTrace.length; i++) {
            const previousSpan = spanTrace[i - 1].span;
            const currentSpan = spanTrace[i].span;
            const delta = currentSpan - previousSpan;

            totalAbsDelta += Math.abs(delta);

            if (delta === 0) continue;

            meaningfulTransitions++;
            const direction = Math.sign(delta);

            if (previousDirection !== 0 && direction !== previousDirection) {
                spanOscillationCount++;
                if (i >= 2 && currentSpan === spanTrace[i - 2].span) {
                    reversalCount++;
                }
            }

            previousDirection = direction;
        }

        const transitionCount = Math.max(1, spanTrace.length - 1);
        const meanAbsDelta = totalAbsDelta / transitionCount;
        const spanRange = Math.max(1, MAX_SPAN - MIN_SPAN);
        const directionChangeRate = spanOscillationCount / Math.max(1, meaningfulTransitions - 1);
        const reversalRate = reversalCount / Math.max(1, meaningfulTransitions - 1);
        const adaptationVolatility = roundMetric(clampNumber(
            (meanAbsDelta / spanRange) * 0.5 +
            directionChangeRate * 0.3 +
            reversalRate * 0.2,
            0,
            1
        ));
        const spanStability = roundMetric(clampNumber(1 - adaptationVolatility, 0, 1));
        const staircaseQuality = roundMetric(clampNumber(
            (spanStability * 0.7) + (clampNumber(summaryCore.accuracy || 0, 0, 1) * 0.3),
            0,
            1
        ));
        const adaptiveStabilityLabel = spanStability >= 0.82 && spanOscillationCount === 0
            ? 'stable'
            : spanStability >= 0.65 && reversalCount <= 1
                ? 'steady'
                : spanStability >= 0.45
                    ? 'mixed'
                    : 'volatile';
        const orderPenalty = clampNumber(
            ((summaryCore.orderErrorCount || 0) * 0.1) +
            ((summaryCore.timeoutCount || 0) * 0.12),
            0,
            0.6
        );
        const spanFactor = clampNumber((summaryCore.finalSpan || 0) / Math.max(1, MAX_SPAN), 0, 1);
        const baseReadiness = clampNumber(
            (clampNumber(summaryCore.accuracy || 0, 0, 1) * 0.35) +
            (spanStability * 0.25) +
            (staircaseQuality * 0.2) +
            (spanFactor * 0.2) -
            orderPenalty,
            0,
            1
        );
        const backwardReadiness = roundMetric(clampNumber(
            baseReadiness + (summaryCore.sequenceMode === 'forward' ? 0.08 : 0) + (summaryCore.finalSpan >= 6 ? 0.05 : 0),
            0,
            1
        ));
        const forwardReadiness = roundMetric(clampNumber(
            baseReadiness + (summaryCore.sequenceMode === 'backward' ? 0.08 : 0) + (summaryCore.finalSpan <= 4 ? 0.05 : 0),
            0,
            1
        ));
        const modeTransitionReadiness = summaryCore.sequenceMode === 'forward'
            ? backwardReadiness
            : forwardReadiness;

        return {
            spanOscillationCount,
            reversalCount,
            adaptationVolatility,
            spanStability,
            staircaseQuality,
            adaptiveStabilityLabel,
            backwardReadiness,
            forwardReadiness,
            modeTransitionReadiness
        };
    }

    function classifyClickError(clickedIndex) {
        return sequence.includes(clickedIndex) ? 'order_error' : 'wrong_block';
    }

    function shouldFallbackToForward(errorType) {
        return ['order_error', 'wrong_block', 'length_error', 'timeout'].includes(errorType);
    }

    function updateSpanBounds(value) {
        minLevel = Math.min(minLevel, value);
        maxLevel = Math.max(maxLevel, value);
    }

    function applyAdaptiveDecision(trial) {
        if (!isAdaptiveMode) return null;

        const fromSpan = currentLevel;
        const fromMode = getMode();
        const fromBlockCount = blockCount;
        const fromLayoutSeed = blockLayoutSeed;
        const recent = getRecentTrialSummary();
        let toSpan = fromSpan;
        let toMode = fromMode;
        let toBlockCount = fromBlockCount;
        let direction = 'hold';
        let reason = '当前表现处于训练区间，下一轮保持负荷继续巩固。';

        if (trial.correct) {
            consecutiveCorrect++;
            consecutiveIncorrect = 0;

            const highRecentAccuracy = recent.totalTrials >= ADAPTIVE_WINDOW_SIZE && recent.accuracy >= 0.8;
            if (consecutiveCorrect >= ADAPTIVE_UP_STREAK || highRecentAccuracy) {
                if (fromMode === 'forward' && fromSpan >= 6 && recent.accuracy >= 0.8) {
                    toMode = 'backward';
                    direction = 'up_mode';
                    reason = '正向回忆已稳定，下一轮切换到逆向回忆以增加顺序操作负荷。';
                } else if (fromSpan >= fromBlockCount - 1 && fromBlockCount < MAX_BLOCK_COUNT) {
                    toBlockCount = fromBlockCount + 1;
                    direction = 'up_blocks';
                    reason = '当前长度接近方块容量上限，下一轮增加方块数量以扩大空间搜索集合。';
                } else {
                    toSpan = clampNumber(fromSpan + 1, MIN_SPAN, MAX_SPAN);
                    direction = toSpan > fromSpan ? 'up_span' : 'hold';
                    reason = direction === 'up_span'
                        ? '连续正确或近期高准确率达标，下一轮提高一个序列长度。'
                        : '已达到本训练的长度上限，下一轮保持长度并继续稳定表现。';
                }
                consecutiveCorrect = 0;
            } else {
                reason = `本轮正确，连续正确 ${consecutiveCorrect}/${ADAPTIVE_UP_STREAK}，下一轮保持长度确认稳定性。`;
            }
        } else {
            consecutiveIncorrect++;
            consecutiveCorrect = 0;

            if (fromMode === 'backward' && shouldFallbackToForward(trial.errorType)) {
                toMode = 'forward';
                direction = 'down_mode';
                reason = '逆向回忆出现错误，下一轮回退到正向回忆先稳住空间路径。';
            } else if (fromSpan > MIN_SPAN) {
                toSpan = clampNumber(fromSpan - 1, MIN_SPAN, MAX_SPAN);
                direction = 'down_span';
                reason = '本轮未正确复现，下一轮降低一个长度以恢复稳定完成率。';
            } else if (trial.errorType === 'wrong_block' && fromBlockCount > MIN_BLOCK_COUNT) {
                toBlockCount = fromBlockCount - 1;
                direction = 'down_blocks';
                reason = '低长度仍点到目标路径外方块，下一轮减少方块数量降低空间干扰。';
            } else {
                reason = '已处于最低长度，下一轮保持正向低负荷练习点击顺序。';
            }
        }

        const modeEvent = toMode !== fromMode
            ? setMode(toMode, reason, trial.index + 1)
            : null;

        currentLevel = clampNumber(toSpan, MIN_SPAN, MAX_SPAN);
        updateSpanBounds(currentLevel);

        if (toBlockCount !== fromBlockCount) {
            blockCount = clampNumber(toBlockCount, MIN_BLOCK_COUNT, MAX_BLOCK_COUNT);
            blockCountInput.value = blockCount;
            applyBlockLayout(`adaptive-${direction}`);
        }

        levelDisplay.textContent = currentLevel;
        trial.spanAfterTrial = currentLevel;

        const event = {
            index: adaptationEvents.length,
            afterTrial: trial.index + 1,
            trialIndex: trial.index,
            correct: trial.correct,
            errorType: trial.errorType,
            fromSpan,
            toSpan: currentLevel,
            fromMode,
            toMode: getMode(),
            fromBlockCount,
            toBlockCount: blockCount,
            fromLayoutSeed,
            toLayoutSeed: blockLayoutSeed,
            direction,
            reason,
            consecutiveCorrect,
            consecutiveIncorrect,
            recentSummary: {
                totalTrials: recent.totalTrials,
                correctCount: recent.correctCount,
                accuracy: roundMetric(recent.accuracy),
                errorTypes: recent.errorTypes
            },
            modeChangeIndex: modeEvent ? modeEvent.index : null,
            elapsedMs: trial.elapsedMs
        };

        adaptationEvents.push(event);
        trial.adaptationEventIndex = event.index;
        return event;
    }

    function getTrialFeedback(trial, adaptationEvent) {
        if (!isAdaptiveMode) {
            if (trial.correct) return '正确! 难度升级...';
            if (trial.errorType === 'wrong_block') return '点到了序列外方块，同级再试一次...';
            return '顺序错误，同级再试一次...';
        }

        const nextModeText = getMode() === 'backward' ? '逆向' : '正向';
        const nextLoad = `下一轮：${nextModeText}，长度 ${currentLevel}，方块 ${blockCount}`;
        if (trial.correct) {
            return adaptationEvent && adaptationEvent.direction !== 'hold'
                ? `正确。${adaptationEvent.reason}${nextLoad}。`
                : `正确，先保持负荷确认稳定性。${nextLoad}。`;
        }

        const detailByType = {
            order_error: '顺序错位：下一轮先盯住路径转折点，再按节奏复现。',
            wrong_block: '目标路径外点击：下一轮先编码方块位置集合，再开始排序。',
            length_error: '回答长度不足：下一轮降低负荷并一次完成整条路径。',
            timeout: '响应超时：下一轮缩短路径或回到正向，先提高完成速度。',
            manual_stop: '手动停止：下一轮复用较低负荷完成一整条序列。'
        };
        return `${detailByType[trial.errorType] || '本轮未正确完成。'}${adaptationEvent ? adaptationEvent.reason : ''}${nextLoad}。`;
    }

    function completeTrial(correct, errorType, options = {}) {
        clearResponseTimer();
        isShowingSequence = true;

        const spanAfterTrial = correct && !isAdaptiveMode ? currentLevel + 1 : currentLevel;
        const trial = recordTrial({
            correct,
            spanAfterTrial,
            errorType,
            timedOut: Boolean(options.timedOut),
            interruptedDuring: options.interruptedDuring || null
        });

        if (correct) {
            highestCorrectLevel = Math.max(highestCorrectLevel, currentLevel);
            score += currentLevel * 10;
            scoreDisplay.textContent = score;
            playSound(880, 'sine', 0.2);
            setTimeout(() => playSound(1100, 'sine', 0.2), 150);
        }

        if (isAdaptiveMode) {
            const adaptationEvent = applyAdaptiveDecision(trial);
            messageDisplay.textContent = getTrialFeedback(trial, adaptationEvent);

            if (trialLog.length >= ADAPTIVE_MAX_TRIALS) {
                terminationReason = 'adaptive_trial_limit';
                setTimeout(() => {
                    if (isPlaying) endGame();
                }, 900);
                return;
            }

            setTimeout(() => {
                if (!isPlaying) return;
                if (options.errorBlock) options.errorBlock.classList.remove('error');
                startRound();
            }, 1500);
            return;
        }

        if (correct) {
            levelErrorCount = 0;
            currentLevel++;
            updateSpanBounds(currentLevel);
            levelDisplay.textContent = currentLevel;
            messageDisplay.textContent = getTrialFeedback(trial, null);

            setTimeout(() => {
                if (isPlaying) startRound();
            }, 1500);
            return;
        }

        levelErrorCount++;
        if (levelErrorCount > maxErrorsPerLevel) {
            messageDisplay.textContent = errorType === 'wrong_block'
                ? '连续错误，测试结束：先减少空间干扰再练。'
                : '错误两次，测试结束!';
            terminationReason = 'failed_span';
            endGame();
        } else {
            messageDisplay.textContent = getTrialFeedback(trial, null);
            setTimeout(() => {
                if (!isPlaying) return;
                if (options.errorBlock) options.errorBlock.classList.remove('error');
                startRound();
            }, 1500);
        }
    }

    function handleResponseTimeout() {
        if (!isPlaying || isShowingSequence || !trialInProgress) return;
        const errorType = userSequence.length === 0 ? 'timeout' : 'length_error';
        playSound(150, 'sawtooth', 0.3);
        completeTrial(false, errorType, {
            timedOut: true,
            interruptedDuring: 'response'
        });
    }

    function buildCorsiPrescription(summary) {
        const baseStart = summary.isAdaptive ? summary.currentSpan : summary.startSpan;
        const currentStart = clampNumber(baseStart, 2, 5);
        const currentBlockCount = clampNumber(summary.blockCount, 2, 20);

        if (summary.terminationReason === 'manual_stop' || summary.totalTrials === 0) {
            return {
                nextStartSpan: currentStart,
                nextMode: summary.sequenceMode,
                nextBlockCount: currentBlockCount,
                nextPrescriptionReason: `本轮手动停止或样本不足，下一轮先复用当前设置完成可计入序列；阶梯稳定性=${summary.adaptiveStabilityLabel}，波动=${summary.adaptationVolatility}。`
            };
        }

        if (
            summary.sequenceMode === 'forward' &&
            summary.modeTransitionReadiness >= STABILITY_SWITCH_THRESHOLD &&
            summary.backwardReadiness >= STABILITY_SWITCH_THRESHOLD &&
            summary.finalSpan >= 6
        ) {
            return {
                nextStartSpan: currentStart,
                nextMode: 'backward',
                nextBlockCount: currentBlockCount,
                nextPrescriptionReason: `正向广度和阶梯稳定性已达可切换水平（${summary.adaptiveStabilityLabel}，波动 ${summary.adaptationVolatility}，逆向准备度 ${summary.backwardReadiness}），下一轮切换逆向回忆增加顺序操作负荷。`
            };
        }

        if (
            summary.sequenceMode === 'backward' &&
            summary.modeTransitionReadiness >= STABILITY_SWITCH_THRESHOLD &&
            summary.forwardReadiness >= STABILITY_SWITCH_THRESHOLD
        ) {
            return {
                nextStartSpan: currentStart,
                nextMode: 'forward',
                nextBlockCount: currentBlockCount,
                nextPrescriptionReason: `逆向回忆的阶梯稳定性已达可切回正向水平（${summary.adaptiveStabilityLabel}，波动 ${summary.adaptationVolatility}，正向准备度 ${summary.forwardReadiness}），下一轮切回正向巩固路径编码。`
            };
        }

        if (summary.accuracy >= 0.75 && summary.staircaseQuality >= STABILITY_ADVANCE_THRESHOLD) {
            return {
                nextStartSpan: clampNumber(baseStart + 1, 2, 5),
                nextMode: summary.sequenceMode,
                nextBlockCount: currentBlockCount,
                nextPrescriptionReason: `正确率和阶梯质量都已达标（${summary.staircaseQuality}，稳定性 ${summary.spanStability}），下一轮小幅提高起始长度并保持模式与方块数量。`
            };
        }

        if (summary.accuracy >= 0.75 && summary.staircaseQuality < STABILITY_ADVANCE_THRESHOLD) {
            return {
                nextStartSpan: currentStart,
                nextMode: summary.sequenceMode,
                nextBlockCount: currentBlockCount,
                nextPrescriptionReason: `正确率虽然达标，但阶梯稳定性仍偏弱（${summary.adaptiveStabilityLabel}，震荡 ${summary.spanOscillationCount} 次，反转 ${summary.reversalCount} 次），下一轮先保持设置巩固 span 变化。`
            };
        }

        if (summary.orderErrorCount > summary.correctCount) {
            const nextStart = clampNumber(Math.min(summary.startSpan, Math.max(2, summary.finalSpan || summary.startSpan - 1)), 2, 5);
            return {
                nextStartSpan: nextStart,
                nextMode: 'forward',
                nextBlockCount: currentBlockCount,
                nextPrescriptionReason: `顺序错误多于正确序列，且当前阶梯稳定性=${summary.adaptiveStabilityLabel}，下一轮优先用正向模式稳定点击顺序。`
            };
        }

        if (summary.accuracy < 0.5 && summary.finalSpan <= summary.startSpan) {
            return {
                nextStartSpan: clampNumber(baseStart - 1, 2, 5),
                nextMode: summary.sequenceMode === 'backward' ? 'forward' : summary.sequenceMode,
                nextBlockCount: currentBlockCount,
                nextPrescriptionReason: `正确率偏低且最终广度未超过起始长度，阶梯稳定性=${summary.adaptiveStabilityLabel}，下一轮降低起始长度以恢复稳定完成率。`
            };
        }

        return {
            nextStartSpan: currentStart,
            nextMode: summary.sequenceMode,
            nextBlockCount: currentBlockCount,
            nextPrescriptionReason: `当前负荷基本合适，但阶梯稳定性=${summary.adaptiveStabilityLabel}、波动=${summary.adaptationVolatility}、模式切换准备度=${summary.modeTransitionReadiness}，下一轮保持设置并继续巩固空间路径和点击顺序。`
        };
    }

    function buildSummary() {
        const totalTrials = trialLog.length;
        const correctTrials = trialLog.filter(trial => trial.correct);
        const correctCount = correctTrials.length;
        const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
        const longestCorrectSequence = correctTrials.reduce(
            (max, trial) => Math.max(max, trial.sequenceLength),
            0
        );
        const finalSpan = getMemorySpan();
        const errorTypes = countErrorTypes();
        const orderErrorCount = errorTypes.order_error || 0;
        const lengthErrorCount = errorTypes.length_error || 0;
        const wrongBlockCount = errorTypes.wrong_block || 0;
        const timeoutCount = errorTypes.timeout || 0;
        const manualStopCount = errorTypes.manual_stop || 0;
        const spanProgression = trialLog.map(trial => ({
            trialIndex: trial.index,
            sequenceLength: trial.sequenceLength,
            spanBeforeTrial: trial.spanBeforeTrial,
            spanAfterTrial: trial.spanAfterTrial,
            mode: trial.mode,
            blockCount: trial.blockCount,
            correct: trial.correct,
            errorType: trial.errorType,
            adaptationEventIndex: trial.adaptationEventIndex ?? null
        }));
        const summaryCore = {
            totalTrials,
            correctCount,
            accuracy,
            maxSpan: Math.max(finalSpan, longestCorrectSequence),
            finalSpan,
            startingSpan: initialLevel,
            minSpan: minLevel,
            minObservedSpan: minLevel,
            maxObservedSpan: maxLevel,
            longestCorrectSequence,
            meanResponseDurationMs: meanResponseDurationMs(),
            sequenceMode: getMode(),
            spanProgression,
            terminationReason,
            mode: getMode(),
            startingMode,
            finalMode: getMode(),
            modeChanges: modeChanges.map(event => ({ ...event })),
            blockCount,
            startingBlockCount,
            finalBlockCount: blockCount,
            startSpan: initialLevel,
            maxAttemptedSpan: maxLevel,
            currentSpan: currentLevel,
            score,
            errorCount: totalTrials - correctCount,
            errorTypes,
            orderErrorCount,
            lengthErrorCount,
            wrongBlockCount,
            timeoutCount,
            manualStopCount,
            sessionType: isAdaptiveMode ? 'adaptive-staircase' : 'fixed-challenge',
            isAdaptive: isAdaptiveMode,
            adaptationEvents: adaptationEvents.map(cloneAdaptationEvent),
            adaptationBlockSize: ADAPTIVE_WINDOW_SIZE,
            adaptiveMaxTrials: ADAPTIVE_MAX_TRIALS,
            seed: sessionSeed,
            blockLayoutSeed,
            blockLayoutSeedHistory: blockLayoutSeedHistory.map(event => ({ ...event })),
            contentVersion: CONTENT_VERSION,
            blockLayout: cloneBlockLayout()
        };
        const staircaseMetrics = analyzeSpanStability(summaryCore);

        const summary = {
            ...summaryCore,
            ...staircaseMetrics
        };

        return {
            ...summary,
            ...buildCorsiPrescription(summary)
        };
    }

    function saveTrainingResult(finishedAt, durationMs, summaryOverride = null) {
        if (sessionSaved || !sessionStartedAt) return;
        sessionSaved = true;

        if (!window.TrainingResults || typeof window.TrainingResults.saveSession !== 'function') return;

        const summary = summaryOverride || buildSummary();
        window.TrainingResults.saveSession({
            moduleId: MODULE_ID,
            gameId: MODULE_ID,
            gameName: GAME_NAME,
            startedAt: sessionStartedAt,
            finishedAt,
            durationMs,
            score,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: trialLog.map(copyTrial),
            metrics: {
                sequenceMode: summary.sequenceMode,
                blockCount: summary.blockCount,
                totalTrials: summary.totalTrials,
                correctCount: summary.correctCount,
                accuracy: summary.accuracy,
                accuracyPct: `${Math.round(summary.accuracy * 100)}%`,
                maxSpan: summary.maxSpan,
                finalSpan: summary.finalSpan,
                startingSpan: summary.startingSpan,
                minSpan: summary.minSpan,
                minObservedSpan: summary.minObservedSpan,
                maxObservedSpan: summary.maxObservedSpan,
                longestCorrectSequence: summary.longestCorrectSequence,
                meanResponseDurationMs: summary.meanResponseDurationMs,
                errorTypes: summary.errorTypes,
                orderErrorCount: summary.orderErrorCount,
                lengthErrorCount: summary.lengthErrorCount,
                wrongBlockCount: summary.wrongBlockCount,
                timeoutCount: summary.timeoutCount,
                manualStopCount: summary.manualStopCount,
                maxAttemptedSpan: summary.maxAttemptedSpan,
                sessionType: summary.sessionType,
                isAdaptive: summary.isAdaptive,
                adaptationEventCount: summary.adaptationEvents.length,
                adaptationEvents: summary.adaptationEvents,
                spanProgression: summary.spanProgression,
                spanOscillationCount: summary.spanOscillationCount,
                reversalCount: summary.reversalCount,
                adaptationVolatility: summary.adaptationVolatility,
                spanStability: summary.spanStability,
                staircaseQuality: summary.staircaseQuality,
                adaptiveStabilityLabel: summary.adaptiveStabilityLabel,
                backwardReadiness: summary.backwardReadiness,
                forwardReadiness: summary.forwardReadiness,
                modeTransitionReadiness: summary.modeTransitionReadiness,
                startingMode: summary.startingMode,
                finalMode: summary.finalMode,
                modeChanges: summary.modeChanges,
                startingBlockCount: summary.startingBlockCount,
                finalBlockCount: summary.finalBlockCount,
                blockLayoutSeed: summary.blockLayoutSeed,
                blockLayoutSeedHistory: summary.blockLayoutSeedHistory,
                nextStartSpan: summary.nextStartSpan,
                nextMode: summary.nextMode,
                nextBlockCount: summary.nextBlockCount,
                nextPrescriptionReason: summary.nextPrescriptionReason,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ['memory', 'visuospatial-memory', 'span', 'corsi', summary.sequenceMode]
        });
    }

    function generateBlockSequence(length) {
        const seq = [];
        const rng = sequenceRng || createRng(`${sessionSeed || MODULE_ID}:sequence-fallback`);
        let lastIdx = -1;

        for (let i = 0; i < length; i++) {
            let idx = randomIndex(rng, blockCount);
            if (blockCount > 1 && idx === lastIdx) {
                idx = (idx + 1 + randomIndex(rng, blockCount - 1)) % blockCount;
            }
            seq.push(idx);
            lastIdx = idx;
        }

        return seq;
    }

    function setSettingsDisabled(disabled) {
        startLevelInput.disabled = disabled;
        blockCountInput.disabled = disabled;
        if (adaptiveModeInput) {
            adaptiveModeInput.disabled = disabled;
        }
        modeRadios.forEach(radio => {
            radio.disabled = disabled;
        });
    }

    function startGame() {
        if (isPlaying) return;

        const selectedMode = document.querySelector('input[name="mode"]:checked');
        isBackwardMode = selectedMode ? selectedMode.value === 'backward' : isBackwardMode;
        isAdaptiveMode = adaptiveModeInput ? Boolean(adaptiveModeInput.checked) : true;
        score = 0;
        currentLevel = clampNumber(parseInt(startLevelInput.value, 10) || 3, MIN_SPAN, MAX_SPAN);
        blockCount = parseInt(blockCountInput.value, 10) || 9;
        if (blockCount < MIN_BLOCK_COUNT) blockCount = MIN_BLOCK_COUNT;
        if (blockCount > MAX_BLOCK_COUNT) blockCount = MAX_BLOCK_COUNT;
        startLevelInput.value = currentLevel;
        blockCountInput.value = blockCount;
        initialLevel = currentLevel;
        startingMode = getMode();
        startingBlockCount = blockCount;
        levelErrorCount = 0;
        sessionStartedAt = new Date();
        sessionStartedMs = sessionStartedAt.getTime();
        responseStartedAt = 0;
        trialLog = [];
        sessionSaved = false;
        sessionSeed = createSessionSeed();
        sequenceRng = createRng(`${sessionSeed}:sequence:${getMode()}:${blockCount}:${isAdaptiveMode ? 'adaptive' : 'challenge'}`);
        terminationReason = 'in_progress';
        highestCorrectLevel = 0;
        maxLevel = currentLevel;
        minLevel = currentLevel;
        adaptationEvents = [];
        modeChanges = [];
        blockLayoutSeed = '';
        blockLayoutSeedHistory = [];
        consecutiveCorrect = 0;
        consecutiveIncorrect = 0;
        trialInProgress = false;
        clearResponseTimer();

        isPlaying = true;

        scoreDisplay.textContent = score;
        levelDisplay.textContent = currentLevel;
        memorySpanRating.textContent = '';
        resultModal.classList.add('hidden');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        setSettingsDisabled(true);

        applyBlockLayout('start');

        startRound();
    }

    function startRound() {
        if (!isPlaying) return;

        clearResponseTimer();
        userSequence = [];
        sequence = generateBlockSequence(currentLevel);
        trialInProgress = true;
        isShowingSequence = true;
        responseStartedAt = 0;
        updateSpanBounds(currentLevel);
        messageDisplay.textContent = '请观察...';

        let i = 0;
        const interval = setInterval(() => {
            if (!isPlaying) {
                clearInterval(interval);
                return;
            }
            if (i >= sequence.length) {
                clearInterval(interval);
                isShowingSequence = false;
                responseStartedAt = Date.now();
                startResponseTimer();
                const seconds = Math.round(getResponseTimeoutMs() / 1000);
                messageDisplay.textContent = isBackwardMode
                    ? `请逆序点击! ${seconds}秒内完成`
                    : `请按顺序点击! ${seconds}秒内完成`;
                gameArea.style.cursor = 'pointer';
                return;
            }

            highlightBlock(sequence[i]);
            i++;
        }, 1000);
    }

    function highlightBlock(index) {
        const block = blocks[index];
        if (!block) return;
        block.classList.add('active');
        playSound(440, 'sine', 0.1);

        setTimeout(() => {
            block.classList.remove('active');
        }, 500);
    }

    function handleBlockClick(e) {
        if (!isPlaying || isShowingSequence) return;

        const block = e.currentTarget || e.target;
        const index = parseInt(block.dataset.index, 10);
        if (isNaN(index)) return;

        block.classList.add('user-active');
        playSound(660, 'triangle', 0.1);
        setTimeout(() => block.classList.remove('user-active'), 200);

        userSequence.push(index);

        const step = userSequence.length - 1;
        const expectedIndex = isBackwardMode
            ? sequence[sequence.length - 1 - step]
            : sequence[step];

        if (index !== expectedIndex) {
            block.classList.add('error');
            playSound(150, 'sawtooth', 0.3);
            const errorType = classifyClickError(index);
            completeTrial(false, errorType, {
                errorBlock: block,
                interruptedDuring: 'response'
            });
            return;
        }

        if (userSequence.length === sequence.length) {
            completeTrial(true, 'none', {
                interruptedDuring: 'response'
            });
        }
    }

    function getRatingText(span) {
        if (span >= 7) return '评级: 卓越 (Excellent)';
        if (span >= 6) return '评级: 优秀 (Good)';
        if (span >= 5) return '评级: 正常 (Average)';
        return '评级: 需加强 (Below Average)';
    }

    function getNextRoundAdvice(summary) {
        const modeText = summary.nextMode === 'backward' ? '逆向回忆' : '正向回忆';
        return `起始长度=${summary.nextStartSpan}，模式=${modeText}，方块数量=${summary.nextBlockCount}。${summary.nextPrescriptionReason}`;
    }

    function formatErrorProfile(summary) {
        const parts = [];
        if (summary.orderErrorCount) parts.push(`顺序错误 ${summary.orderErrorCount}`);
        if (summary.lengthErrorCount) parts.push(`长度不足 ${summary.lengthErrorCount}`);
        if (summary.wrongBlockCount) parts.push(`目标外方块 ${summary.wrongBlockCount}`);
        if (summary.timeoutCount) parts.push(`超时 ${summary.timeoutCount}`);
        if (summary.manualStopCount) parts.push(`手动停止 ${summary.manualStopCount}`);
        return parts.length > 0 ? parts.join('，') : '未记录到错误类型';
    }

    function buildResultFeedback(summary) {
        const modeText = summary.sequenceMode === 'backward' ? '逆向回忆' : '正向回忆';
        const accuracyText = `${Math.round(summary.accuracy * 100)}%`;
        const adaptiveText = summary.isAdaptive
            ? `本轮使用自适应 staircase，span ${summary.startingSpan}→${summary.currentSpan}，范围 ${summary.minObservedSpan}-${summary.maxObservedSpan}，记录 ${summary.adaptationEvents.length} 次调整评估。`
            : '本轮使用固定挑战流程。';
        if (summary.totalTrials === 0) {
            return `
                <p><strong>${getRatingText(summary.finalSpan)}</strong></p>
                <p>空间记忆广度：${modeText}条件下，本轮手动停止，尚未完成可计入的一整条序列。</p>
                <p>顺序/长度负荷：当前尝试长度为 ${summary.maxAttemptedSpan}，已有 seed 和方块布局会随 manual_stop summary 一起保存，便于复盘训练中断点。</p>
                <p>下一轮建议：${getNextRoundAdvice(summary)}</p>
            `;
        }
        const orderText = summary.orderErrorCount > 0
            ? `出现 ${summary.orderErrorCount} 次顺序错误，说明位置保持后还需要更稳定地绑定点击顺序。`
            : '本轮没有记录到顺序错误，主要限制来自更长序列带来的保持负荷。';

        return `
            <p><strong>${getRatingText(summary.finalSpan)}</strong></p>
            <p>空间记忆广度：${modeText}条件下，最终广度为 ${summary.finalSpan}，最长正确序列为 ${summary.longestCorrectSequence}，正确率 ${accuracyText}。</p>
            <p>自适应轨迹：${adaptiveText}</p>
            <p>阶梯稳定性：${summary.adaptiveStabilityLabel}，span 稳定度 ${Math.round(summary.spanStability * 100)}%，震荡 ${summary.spanOscillationCount} 次，反转 ${summary.reversalCount} 次，波动 ${Math.round(summary.adaptationVolatility * 100)}%。</p>
            <p>模式准备度：逆向 ${Math.round(summary.backwardReadiness * 100)}%，正向 ${Math.round(summary.forwardReadiness * 100)}%，切换准备度 ${Math.round(summary.modeTransitionReadiness * 100)}%。</p>
            <p>错误类型：${formatErrorProfile(summary)}。</p>
            <p>顺序/长度负荷：${orderText}本轮最高尝试长度为 ${summary.maxAttemptedSpan}，长度增加会同时提高空间位置保持和顺序复现负荷。</p>
            <p>下一轮建议：${getNextRoundAdvice(summary)}</p>
        `;
    }

    function endGame(forced = false) {
        if (!isPlaying && (forced || sessionSaved)) return;

        if (forced && trialInProgress && sequence.length > 0) {
            recordTrial({
                correct: false,
                spanAfterTrial: currentLevel,
                errorType: 'manual_stop',
                timedOut: false,
                interruptedDuring: responseStartedAt > 0 && !isShowingSequence ? 'response' : 'presentation'
            });
        }
        clearResponseTimer();

        isPlaying = false;
        isShowingSequence = false;

        startBtn.style.display = 'inline-block';
        startBtn.disabled = false;
        stopBtn.style.display = 'none';
        setSettingsDisabled(false);
        gameArea.style.cursor = 'default';

        if (forced) {
            messageDisplay.textContent = '已停止';
            terminationReason = 'manual_stop';
        }

        const finishedAt = new Date();
        const durationMs = sessionStartedAt
            ? Math.max(0, finishedAt.getTime() - sessionStartedAt.getTime())
            : 0;
        if (!forced && terminationReason === 'in_progress') {
            terminationReason = 'failed_span';
        }
        const summary = buildSummary();
        finalLevelDisplay.textContent = summary.finalSpan; // Last successful level
        finalScoreDisplay.textContent = score;
        memorySpanRating.innerHTML = buildResultFeedback(summary);
        saveTrainingResult(finishedAt, durationMs, summary);

        setTimeout(() => {
            resultModal.classList.remove('hidden');
        }, 800);
    }

    // Initial draw for visual preview.
    initBlocks(createPreviewRng());
});
