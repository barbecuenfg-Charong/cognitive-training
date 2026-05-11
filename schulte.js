document.addEventListener('DOMContentLoaded', () => {
    const MODULE_ID = 'schulte';
    const GAME_NAME = '舒尔特方格';
    const CONTENT_VERSION = 'schulte-p0d-minimal-v1';

    const startBtn = document.getElementById('start-btn');
    const gridSizeInput = document.getElementById('grid-size');
    const gridContainer = document.getElementById('schulte-grid');
    const timerDisplay = document.getElementById('timer');
    const targetDisplay = document.getElementById('target-num');
    const resultModal = document.getElementById('result-modal');
    const finalTimeDisplay = document.getElementById('final-time');
    const resultDetails = document.getElementById('result-details');
    const restartBtn = document.getElementById('restart-btn');

    let startTime = 0;
    let timerInterval = null;
    let isPlaying = false;
    let currentTarget = 1;
    let totalNumbers = 25;
    let isAdvancedMode = false;
    let sessionStartedAt = null;
    let targetStartedAt = 0;
    let lastClickAt = 0;
    let trialLog = [];
    let gridLayout = [];
    let sessionSaved = false;
    let sessionSeed = '';
    let sessionRng = null;

    document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            isAdvancedMode = e.target.value === 'advanced';
        });
    });

    gridSizeInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (Number.isNaN(val) || val < 3) val = 3;
        if (val > 9) val = 9;
        e.target.value = val;
        if (!isPlaying) generateGrid();
    });

    startBtn.addEventListener('click', startGame);

    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        resetGame();
    });

    generateGrid();

    function fallbackHashString(value) {
        const text = String(value || '');
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

    function createSessionSeed() {
        if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === 'function') {
            return window.SeededRandom.createSessionSeed(MODULE_ID);
        }
        return `${MODULE_ID}-${Date.now().toString(36)}`;
    }

    function createRng(seed) {
        if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === 'function') {
            return window.SeededRandom.createRngFromSeed(seed);
        }
        return fallbackMulberry32(fallbackHashString(seed));
    }

    function seededShuffle(numbers) {
        const rng = sessionRng || createRng(`${MODULE_ID}-preview`);
        if (window.SeededRandom && typeof window.SeededRandom.shuffleInPlace === 'function') {
            return window.SeededRandom.shuffleInPlace(numbers, rng);
        }
        for (let i = numbers.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
        }
        return numbers;
    }

    function startGame() {
        if (isPlaying) return;

        resetGame();
        sessionSeed = createSessionSeed();
        sessionRng = createRng(`${sessionSeed}:layout:${gridSizeInput.value}:${isAdvancedMode ? 'advanced' : 'simple'}`);
        isPlaying = true;
        startTime = Date.now();
        sessionStartedAt = new Date(startTime);
        targetStartedAt = startTime;
        lastClickAt = startTime;
        trialLog = [];
        sessionSaved = false;

        generateGrid(true);

        timerInterval = setInterval(updateTimer, 100);
        startBtn.disabled = true;
        startBtn.textContent = "进行中...";
        gridSizeInput.disabled = true;
    }

    function resetGame() {
        currentTarget = 1;
        targetDisplay.textContent = currentTarget;
        timerDisplay.textContent = "00:00";
        if (timerInterval) clearInterval(timerInterval);
        isPlaying = false;
        sessionStartedAt = null;
        targetStartedAt = 0;
        lastClickAt = 0;
        trialLog = [];
        sessionSaved = false;
        sessionSeed = '';
        sessionRng = null;
        startBtn.disabled = false;
        startBtn.textContent = "开始测试";
        gridSizeInput.disabled = false;
        generateGrid();
    }

    function generateGrid(shuffle = false) {
        const n = parseInt(gridSizeInput.value, 10) || 5;
        totalNumbers = n * n;

        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${n}, 1fr)`;

        const numbers = Array.from({ length: totalNumbers }, (_, i) => i + 1);
        if (shuffle) {
            seededShuffle(numbers);
        }

        const maxWidth = Math.min(600, window.innerWidth - 40);
        const size = Math.max(30, Math.floor((maxWidth - (n - 1) * 5) / n));
        gridLayout = [];

        numbers.forEach((num, index) => {
            const row = Math.floor(index / n);
            const col = index % n;
            const position = { row, col, index };
            const cell = document.createElement('div');

            gridLayout.push({
                number: num,
                row,
                col,
                index
            });

            cell.className = 'schulte-cell';
            cell.textContent = num;
            cell.style.width = `${size}px`;
            cell.style.height = `${size}px`;
            cell.style.fontSize = `${size * 0.5}px`;
            cell.addEventListener('click', () => handleCellClick(cell, num, position));
            gridContainer.appendChild(cell);
        });
    }

    function handleCellClick(cell, num, position) {
        if (!isPlaying) return;

        const clickTime = Date.now();
        const expectedNumber = currentTarget;
        const correct = num === expectedNumber;
        const rtSinceLastMs = Math.max(0, clickTime - lastClickAt);
        const elapsedMs = Math.max(0, clickTime - startTime);
        const targetIntervalMs = Math.max(0, clickTime - targetStartedAt);

        trialLog.push({
            index: trialLog.length,
            mode: isAdvancedMode ? 'advanced' : 'simple',
            isAdvancedMode,
            targetNumber: expectedNumber,
            expectedNumber,
            clickedNumber: num,
            correct,
            position: { ...position },
            errorClickPosition: correct ? null : { ...position },
            rtMs: targetIntervalMs,
            targetIntervalMs,
            rtSinceLastMs,
            elapsedMs
        });
        lastClickAt = clickTime;

        if (correct) {
            cell.classList.add('correct');

            if (isAdvancedMode) {
                const allCells = gridContainer.querySelectorAll('.schulte-cell');
                allCells.forEach(c => {
                    if (c !== cell && c.classList.contains('correct')) {
                        c.classList.remove('correct');
                    }
                });
            }

            if (num === totalNumbers) {
                endGame();
            } else {
                currentTarget++;
                targetDisplay.textContent = currentTarget;
                targetStartedAt = clickTime;
            }
        } else {
            cell.classList.add('wrong');
            setTimeout(() => cell.classList.remove('wrong'), 200);
        }
    }

    function updateTimer() {
        const elapsed = (Date.now() - startTime) / 1000;
        timerDisplay.textContent = elapsed.toFixed(2);
    }

    function mean(values) {
        const validValues = values.filter(value => Number.isFinite(value));
        if (validValues.length === 0) return 0;
        return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
    }

    function standardDeviation(values) {
        const validValues = values.filter(value => Number.isFinite(value));
        if (validValues.length <= 1) return 0;
        const avg = validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
        const variance = validValues.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / validValues.length;
        return Math.round(Math.sqrt(variance));
    }

    function copyTrial(trial) {
        return {
            ...trial,
            position: { ...trial.position },
            errorClickPosition: trial.errorClickPosition ? { ...trial.errorClickPosition } : null
        };
    }

    function buildRecommendation(gridSize, errorRate, meanInterClickRtMs, scanStability) {
        const basePace = meanInterClickRtMs || 1200;
        if (errorRate > 0.1) {
            return {
                nextGridSize: gridSize,
                recommendedPaceMs: Math.round(basePace * 1.15),
                recommendation: `错误率偏高，下轮保持 ${gridSize}x${gridSize}，先放慢并确认目标后再点。`
            };
        }
        if (scanStability < 60) {
            return {
                nextGridSize: gridSize,
                recommendedPaceMs: Math.round(basePace * 1.05),
                recommendation: `节奏波动偏大，下轮保持 ${gridSize}x${gridSize}，优先练稳定扫描节奏。`
            };
        }
        if (errorRate <= 0.03 && scanStability >= 75 && meanInterClickRtMs > 0 && meanInterClickRtMs <= 1200) {
            const nextGridSize = Math.min(9, gridSize + 1);
            return {
                nextGridSize,
                recommendedPaceMs: Math.round(basePace * 1.1),
                recommendation: nextGridSize > gridSize
                    ? `速度和稳定性达标，下轮可以尝试 ${nextGridSize}x${nextGridSize}。`
                    : `已到最大网格，下轮保持 ${gridSize}x${gridSize}，继续压低平均间隔。`
            };
        }
        return {
            nextGridSize: gridSize,
            recommendedPaceMs: Math.max(450, Math.round(basePace * 0.95)),
            recommendation: `下轮保持 ${gridSize}x${gridSize}，在不增加错误的前提下略微提速。`
        };
    }

    function buildSummary(durationMs) {
        const correctTrials = trialLog.filter(trial => trial.correct);
        const correctCount = correctTrials.length;
        const wrongClickCount = trialLog.length - correctCount;
        const totalTrials = trialLog.length;
        const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
        const errorRate = totalTrials > 0 ? wrongClickCount / totalTrials : 0;
        const intervals = correctTrials.map(trial => trial.targetIntervalMs);
        const meanInterClickRtMs = mean(intervals);
        const rtVariabilityMs = standardDeviation(intervals);
        const scanStability = meanInterClickRtMs > 0
            ? Math.max(0, Math.min(100, Math.round((1 - (rtVariabilityMs / meanInterClickRtMs)) * 100)))
            : 0;

        const gridSize = parseInt(gridSizeInput.value, 10) || 5;
        const recommendation = buildRecommendation(gridSize, errorRate, meanInterClickRtMs, scanStability);

        return {
            gridSize,
            mode: isAdvancedMode ? 'advanced' : 'simple',
            isAdvancedMode,
            totalTrials,
            correctCount,
            accuracy,
            errorRate,
            totalTimeMs: durationMs,
            meanRtMs: meanInterClickRtMs,
            meanInterClickRtMs,
            rtVariabilityMs,
            scanStability,
            wrongClickCount,
            gridLayout: gridLayout.map(item => ({ ...item })),
            clickPath: trialLog.map(trial => ({
                index: trial.index,
                mode: trial.mode,
                isAdvancedMode: trial.isAdvancedMode,
                targetNumber: trial.targetNumber,
                expectedNumber: trial.expectedNumber,
                clickedNumber: trial.clickedNumber,
                correct: trial.correct,
                position: { ...trial.position },
                rtSinceLastMs: trial.rtSinceLastMs,
                elapsedMs: trial.elapsedMs
            })),
            trialLog: trialLog.map(copyTrial),
            ...recommendation,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        };
    }

    function showResultSummary(summary) {
        if (!resultDetails) return;
        resultDetails.innerHTML = `
            <p>错误率：${Math.round(summary.errorRate * 100)}%</p>
            <p>平均目标间隔：${summary.meanInterClickRtMs}ms</p>
            <p>节奏波动：${summary.rtVariabilityMs}ms</p>
            <p>扫描稳定性：${summary.scanStability}/100</p>
            <p>下一轮建议：${summary.recommendation} 建议网格 ${summary.nextGridSize}x${summary.nextGridSize}，参考节奏 ${summary.recommendedPaceMs}ms。</p>
        `;
    }

    function endGame() {
        if (sessionSaved) return;

        isPlaying = false;
        clearInterval(timerInterval);
        const finishedAt = new Date();
        const durationMs = Math.max(0, finishedAt.getTime() - startTime);
        const summary = buildSummary(durationMs);
        const elapsed = durationMs / 1000;
        finalTimeDisplay.textContent = elapsed.toFixed(2) + "秒";
        showResultSummary(summary);

        saveTrainingResult(finishedAt, durationMs, summary);
        sessionSaved = true;

        resultModal.classList.remove('hidden');
        startBtn.disabled = false;
        startBtn.textContent = "开始测试";
        gridSizeInput.disabled = false;
    }

    function saveTrainingResult(finishedAt, durationMs, summaryOverride = null) {
        if (!window.TrainingResults || !sessionStartedAt) return;

        const summary = summaryOverride || buildSummary(durationMs);
        const score = Math.round(summary.accuracy * 100);

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
                mode: summary.mode,
                isAdvancedMode: summary.isAdvancedMode,
                time: `${(durationMs / 1000).toFixed(2)}秒`,
                accuracy: `${score}%`,
                errorRate: `${Math.round(summary.errorRate * 100)}%`,
                meanInterClickRT: `${summary.meanInterClickRtMs}ms`,
                rtVariability: `${summary.rtVariabilityMs}ms`,
                scanStability: summary.scanStability,
                nextGridSize: summary.nextGridSize,
                recommendedPaceMs: summary.recommendedPaceMs,
                recommendation: summary.recommendation,
                wrongClicks: summary.wrongClickCount,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ["attention", "schulte", "visual-search"]
        });
    }
});
