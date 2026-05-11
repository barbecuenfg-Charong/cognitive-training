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
    const modeRadios = document.querySelectorAll('input[name="mode"]');

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
        if (isNaN(val) || val < 2) val = 2;
        if (val > 20) val = 20;
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

    function copyTrial(trial) {
        return {
            ...trial,
            blockSequence: trial.blockSequence.slice(),
            responseSequence: trial.responseSequence.slice(),
            expectedResponseSequence: trial.expectedResponseSequence.slice()
        };
    }

    function recordTrial({ correct, spanAfterTrial, errorType }) {
        const now = Date.now();
        const responseDurationMs = responseStartedAt > 0 ? Math.max(0, now - responseStartedAt) : 0;
        const expectedResponseSequence = getExpectedResponseSequence();

        trialLog.push({
            index: trialLog.length,
            sequenceLength: sequence.length,
            level: currentLevel,
            sequenceMode: getMode(),
            mode: getMode(),
            blockCount,
            blockSequence: sequence.slice(),
            expectedResponseSequence,
            responseSequence: userSequence.slice(),
            correct,
            rtMs: responseDurationMs,
            responseDurationMs,
            spanBeforeTrial: currentLevel,
            spanAfterTrial,
            attemptInSpan: levelErrorCount + 1,
            errorType,
            errorPosition: correct ? null : Math.max(0, userSequence.length - 1),
            elapsedMs: sessionStartedMs > 0 ? Math.max(0, now - sessionStartedMs) : 0
        });
    }

    function meanResponseDurationMs() {
        const durations = trialLog
            .map(trial => trial.responseDurationMs)
            .filter(value => Number.isFinite(value));

        if (durations.length === 0) return 0;
        const total = durations.reduce((sum, value) => sum + value, 0);
        return Math.round(total / durations.length);
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
        const orderErrorCount = trialLog.filter(trial => trial.errorType === 'order_error').length;
        const spanProgression = trialLog.map(trial => ({
            trialIndex: trial.index,
            sequenceLength: trial.sequenceLength,
            spanBeforeTrial: trial.spanBeforeTrial,
            spanAfterTrial: trial.spanAfterTrial,
            correct: trial.correct,
            errorType: trial.errorType
        }));

        return {
            totalTrials,
            correctCount,
            accuracy,
            maxSpan: Math.max(finalSpan, longestCorrectSequence),
            finalSpan,
            longestCorrectSequence,
            meanResponseDurationMs: meanResponseDurationMs(),
            sequenceMode: getMode(),
            spanProgression,
            terminationReason,
            mode: getMode(),
            blockCount,
            startSpan: initialLevel,
            maxAttemptedSpan: maxLevel,
            currentSpan: currentLevel,
            score,
            errorCount: totalTrials - correctCount,
            orderErrorCount,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            blockLayout: cloneBlockLayout()
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
                longestCorrectSequence: summary.longestCorrectSequence,
                meanResponseDurationMs: summary.meanResponseDurationMs,
                orderErrorCount: summary.orderErrorCount,
                maxAttemptedSpan: summary.maxAttemptedSpan,
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
        modeRadios.forEach(radio => {
            radio.disabled = disabled;
        });
    }

    function startGame() {
        if (isPlaying) return;

        const selectedMode = document.querySelector('input[name="mode"]:checked');
        isBackwardMode = selectedMode ? selectedMode.value === 'backward' : isBackwardMode;
        score = 0;
        currentLevel = parseInt(startLevelInput.value, 10) || 3;
        blockCount = parseInt(blockCountInput.value, 10) || 9;
        if (blockCount < 2) blockCount = 2;
        if (blockCount > 20) blockCount = 20;
        blockCountInput.value = blockCount;
        initialLevel = currentLevel;
        levelErrorCount = 0;
        sessionStartedAt = new Date();
        sessionStartedMs = sessionStartedAt.getTime();
        responseStartedAt = 0;
        trialLog = [];
        sessionSaved = false;
        sessionSeed = createSessionSeed();
        sequenceRng = createRng(`${sessionSeed}:sequence:${getMode()}:${blockCount}`);
        terminationReason = 'in_progress';
        highestCorrectLevel = 0;
        maxLevel = currentLevel;

        isPlaying = true;

        scoreDisplay.textContent = score;
        levelDisplay.textContent = currentLevel;
        memorySpanRating.textContent = '';
        resultModal.classList.add('hidden');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        setSettingsDisabled(true);

        initBlocks(createRng(`${sessionSeed}:layout:${getMode()}:${blockCount}`));

        startRound();
    }

    function startRound() {
        if (!isPlaying) return;

        userSequence = [];
        sequence = generateBlockSequence(currentLevel);
        isShowingSequence = true;
        responseStartedAt = 0;
        maxLevel = Math.max(maxLevel, currentLevel);
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
                messageDisplay.textContent = isBackwardMode ? '请逆序点击!' : '请按顺序点击!';
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
            isShowingSequence = true;
            recordTrial({
                correct: false,
                spanAfterTrial: currentLevel,
                errorType: 'order_error'
            });

            levelErrorCount++;

            if (levelErrorCount > maxErrorsPerLevel) {
                messageDisplay.textContent = '错误两次，测试结束!';
                terminationReason = 'failed_span';
                endGame();
            } else {
                messageDisplay.textContent = '顺序错误，同级再试一次...';
                setTimeout(() => {
                    if (!isPlaying) return;
                    block.classList.remove('error');
                    startRound();
                }, 1500);
            }
            return;
        }

        if (userSequence.length === sequence.length) {
            isShowingSequence = true;
            recordTrial({
                correct: true,
                spanAfterTrial: currentLevel + 1,
                errorType: 'none'
            });
            highestCorrectLevel = Math.max(highestCorrectLevel, currentLevel);
            score += currentLevel * 10;
            scoreDisplay.textContent = score;
            messageDisplay.textContent = '正确! 难度升级...';
            playSound(880, 'sine', 0.2);
            setTimeout(() => playSound(1100, 'sine', 0.2), 150);

            levelErrorCount = 0;
            currentLevel++;
            levelDisplay.textContent = currentLevel;

            setTimeout(() => {
                if (isPlaying) startRound();
            }, 1500);
        }
    }

    function getRatingText(span) {
        if (span >= 7) return '评级: 卓越 (Excellent)';
        if (span >= 6) return '评级: 优秀 (Good)';
        if (span >= 5) return '评级: 正常 (Average)';
        return '评级: 需加强 (Below Average)';
    }

    function getNextRoundAdvice(summary) {
        if (summary.totalTrials === 0) {
            return '先完成至少一个序列，再根据正确率调整起始长度。';
        }
        if (summary.accuracy >= 0.8 && summary.sequenceMode === 'forward' && summary.finalSpan >= 6) {
            return '正向广度已经稳定，可以保持方块数量不变，尝试逆向回忆来增加顺序操作负荷。';
        }
        if (summary.accuracy >= 0.75) {
            const nextStart = Math.min(5, Math.max(2, summary.startSpan + 1));
            return `下一轮可将起始长度调到 ${nextStart}，保持同样方块数量，观察错误是否集中在末端位置。`;
        }
        if (summary.orderErrorCount > summary.correctCount) {
            return '下一轮保持当前起始长度，先用正向模式稳定空间路径，再提高长度或切换逆向。';
        }
        return '下一轮保持当前设置，重点在每次点亮时默记空间路径和点击顺序。';
    }

    function buildResultFeedback(summary) {
        const modeText = summary.sequenceMode === 'backward' ? '逆向回忆' : '正向回忆';
        const accuracyText = `${Math.round(summary.accuracy * 100)}%`;
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
            <p>顺序/长度负荷：${orderText}本轮最高尝试长度为 ${summary.maxAttemptedSpan}，长度增加会同时提高空间位置保持和顺序复现负荷。</p>
            <p>下一轮建议：${getNextRoundAdvice(summary)}</p>
        `;
    }

    function endGame(forced = false) {
        if (!isPlaying && (forced || sessionSaved)) return;

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
            responseStartedAt = 0;
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
