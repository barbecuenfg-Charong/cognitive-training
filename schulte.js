document.addEventListener('DOMContentLoaded', () => {
    const MODULE_ID = 'schulte';
    const GAME_NAME = '舒尔特方格';
    const CONTENT_VERSION = 'schulte-visual-search-adaptive-v2';

    const MIN_GRID_SIZE = 3;
    const MAX_GRID_SIZE = 9;
    const MIN_PACE_MS = 300;
    const MAX_PACE_MS = 5000;
    const MIN_TIME_LIMIT_SEC = 10;
    const MAX_TIME_LIMIT_SEC = 300;

    const DISTRACTOR_LEVELS = {
        none: { label: '无干扰', ratio: 0, loadWeight: 0 },
        mild: { label: '轻度干扰', ratio: 0.18, loadWeight: 1 },
        strong: { label: '强干扰', ratio: 0.32, loadWeight: 2 }
    };
    const DISTRACTOR_ORDER = ['none', 'mild', 'strong'];
    const TARGET_PATH_MODES = new Set(['random', 'row', 'snake', 'spiral']);
    const SYMBOL_SETS = new Set(['numbers', 'letters', 'symbols', 'mixed']);
    const SYMBOL_BASE = ['◆', '●', '▲', '■', '★', '◇', '○', '△', '□', '✚', '✦', '✖'];

    const startBtn = document.getElementById('start-btn');
    const gridSizeInput = document.getElementById('grid-size');
    const symbolSetSelect = document.getElementById('symbol-set');
    const distractorLevelSelect = document.getElementById('distractor-level');
    const targetPathSelect = document.getElementById('target-path');
    const paceModeSelect = document.getElementById('pace-mode');
    const paceMsInput = document.getElementById('pace-ms');
    const timeLimitInput = document.getElementById('time-limit');
    const gridContainer = document.getElementById('schulte-grid');
    const timerDisplay = document.getElementById('timer');
    const targetDisplay = document.getElementById('target-num');
    const progressDisplay = document.getElementById('progress');
    const paceStatusDisplay = document.getElementById('pace-status');
    const resultModal = document.getElementById('result-modal');
    const resultTitle = resultModal ? resultModal.querySelector('h2') : null;
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
    let targetSequence = [];
    let sessionSaved = false;
    let sessionSeed = '';
    let sessionRng = null;
    let currentRoundConfig = null;
    let currentAdaptiveState = null;
    let pendingAdaptiveState = null;

    const gameModeInputs = Array.from(document.querySelectorAll('input[name="game-mode"]'));
    const configurableInputs = [
        gridSizeInput,
        symbolSetSelect,
        distractorLevelSelect,
        targetPathSelect,
        paceModeSelect,
        paceMsInput,
        timeLimitInput,
        ...gameModeInputs
    ].filter(Boolean);

    gameModeInputs.forEach(radio => {
        radio.addEventListener('change', (event) => {
            isAdvancedMode = event.target.value === 'advanced';
            if (!isPlaying) generateGrid();
        });
    });

    [gridSizeInput, symbolSetSelect, distractorLevelSelect, targetPathSelect, paceModeSelect, paceMsInput, timeLimitInput]
        .filter(Boolean)
        .forEach(control => {
            control.addEventListener('change', () => {
                readConfig();
                if (!isPlaying) generateGrid();
                updatePaceStatus();
            });
        });

    startBtn.addEventListener('click', startGame);

    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        if (pendingAdaptiveState) {
            applyAdaptiveState(pendingAdaptiveState);
            pendingAdaptiveState = null;
        }
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

    function seededShuffle(items) {
        const rng = sessionRng || createRng(`${MODULE_ID}-preview`);
        if (window.SeededRandom && typeof window.SeededRandom.shuffleInPlace === 'function') {
            return window.SeededRandom.shuffleInPlace(items, rng);
        }
        for (let i = items.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            [items[i], items[j]] = [items[j], items[i]];
        }
        return items;
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function clampInteger(value, min, max, fallback) {
        const parsed = parseInt(value, 10);
        if (Number.isNaN(parsed)) return fallback;
        return clamp(parsed, min, max);
    }

    function sanitizeSelect(select, allowedValues, fallback) {
        if (!select || !allowedValues.has(select.value)) {
            if (select) select.value = fallback;
            return fallback;
        }
        return select.value;
    }

    function readConfig() {
        const gridSize = clampInteger(gridSizeInput.value, MIN_GRID_SIZE, MAX_GRID_SIZE, 5);
        gridSizeInput.value = gridSize;

        const symbolSet = sanitizeSelect(symbolSetSelect, SYMBOL_SETS, 'numbers');
        const distractorLevel = DISTRACTOR_LEVELS[distractorLevelSelect.value] ? distractorLevelSelect.value : 'none';
        if (distractorLevelSelect) distractorLevelSelect.value = distractorLevel;

        const targetPathMode = sanitizeSelect(targetPathSelect, TARGET_PATH_MODES, 'random');
        const paceMode = paceModeSelect && ['self', 'paced', 'timed'].includes(paceModeSelect.value)
            ? paceModeSelect.value
            : 'self';
        if (paceModeSelect) paceModeSelect.value = paceMode;

        const recommendedPaceMs = clampInteger(paceMsInput.value, MIN_PACE_MS, MAX_PACE_MS, 1100);
        paceMsInput.value = recommendedPaceMs;

        const timeLimitSec = clampInteger(timeLimitInput.value, MIN_TIME_LIMIT_SEC, MAX_TIME_LIMIT_SEC, 60);
        timeLimitInput.value = timeLimitSec;

        const cellCount = gridSize * gridSize;
        const distractorCount = calculateDistractorCount(cellCount, gridSize, distractorLevel);
        const targetCount = Math.max(gridSize, cellCount - distractorCount);

        return {
            gridSize,
            symbolSet,
            distractorLevel,
            targetPathMode,
            paceMode,
            recommendedPaceMs,
            timeLimitSec,
            cellCount,
            distractorCount,
            targetCount,
            mode: isAdvancedMode ? 'advanced' : 'simple',
            isAdvancedMode
        };
    }

    function calculateDistractorCount(cellCount, gridSize, distractorLevel) {
        const config = DISTRACTOR_LEVELS[distractorLevel] || DISTRACTOR_LEVELS.none;
        if (config.ratio <= 0) return 0;
        const proposed = Math.round(cellCount * config.ratio);
        return clamp(proposed, 1, Math.max(0, cellCount - gridSize));
    }

    function setControlsDisabled(disabled) {
        configurableInputs.forEach(input => {
            input.disabled = disabled;
        });
    }

    function toAlphabetLabel(index) {
        let value = index;
        let label = '';
        while (value > 0) {
            value -= 1;
            label = String.fromCharCode(65 + (value % 26)) + label;
            value = Math.floor(value / 26);
        }
        return label;
    }

    function valueForTarget(targetNumber, symbolSet) {
        if (symbolSet === 'letters') {
            return toAlphabetLabel(targetNumber);
        }
        if (symbolSet === 'symbols') {
            const symbol = SYMBOL_BASE[(targetNumber - 1) % SYMBOL_BASE.length];
            const cycle = Math.floor((targetNumber - 1) / SYMBOL_BASE.length);
            return cycle > 0 ? `${symbol}${cycle + 1}` : symbol;
        }
        if (symbolSet === 'mixed') {
            return targetNumber % 2 === 1 ? String(targetNumber) : toAlphabetLabel(targetNumber);
        }
        return String(targetNumber);
    }

    function valueForDistractor(distractorIndex, targetCount, symbolSet, usedValues) {
        let candidate = '';
        for (let attempt = 0; attempt < 100; attempt += 1) {
            const offset = targetCount + distractorIndex + attempt + 1;
            if (symbolSet === 'numbers') {
                candidate = String(offset);
            } else if (symbolSet === 'letters') {
                candidate = toAlphabetLabel(offset);
            } else if (symbolSet === 'symbols') {
                candidate = `${SYMBOL_BASE[offset % SYMBOL_BASE.length]}${Math.floor(offset / SYMBOL_BASE.length) + 1}`;
            } else {
                candidate = attempt % 2 === 0 ? String(offset) : toAlphabetLabel(offset);
            }
            if (!usedValues.has(candidate)) return candidate;
        }
        return `D${distractorIndex + 1}`;
    }

    function buildPositions(gridSize) {
        const positions = [];
        for (let row = 0; row < gridSize; row += 1) {
            for (let col = 0; col < gridSize; col += 1) {
                positions.push({ row, col, index: row * gridSize + col });
            }
        }
        return positions;
    }

    function positionKey(position) {
        return `${position.row}:${position.col}`;
    }

    function pathPositions(gridSize, targetPathMode) {
        if (targetPathMode === 'snake') {
            const positions = [];
            for (let row = 0; row < gridSize; row += 1) {
                if (row % 2 === 0) {
                    for (let col = 0; col < gridSize; col += 1) positions.push({ row, col, index: row * gridSize + col });
                } else {
                    for (let col = gridSize - 1; col >= 0; col -= 1) positions.push({ row, col, index: row * gridSize + col });
                }
            }
            return positions;
        }

        if (targetPathMode === 'spiral') {
            const positions = [];
            let top = 0;
            let left = 0;
            let bottom = gridSize - 1;
            let right = gridSize - 1;
            while (top <= bottom && left <= right) {
                for (let col = left; col <= right; col += 1) positions.push({ row: top, col, index: top * gridSize + col });
                top += 1;
                for (let row = top; row <= bottom; row += 1) positions.push({ row, col: right, index: row * gridSize + right });
                right -= 1;
                if (top <= bottom) {
                    for (let col = right; col >= left; col -= 1) positions.push({ row: bottom, col, index: bottom * gridSize + col });
                    bottom -= 1;
                }
                if (left <= right) {
                    for (let row = bottom; row >= top; row -= 1) positions.push({ row, col: left, index: row * gridSize + left });
                    left += 1;
                }
            }
            return positions;
        }

        return buildPositions(gridSize);
    }

    function buildGridModel(config, shuffle) {
        const allPositions = buildPositions(config.gridSize);
        const usedValues = new Set();
        const cellsByIndex = new Map();
        const distractorPositions = selectDistractorPositions(allPositions, config, shuffle);
        const distractorKeys = new Set(distractorPositions.map(positionKey));
        const targetPositions = allPositions.filter(position => !distractorKeys.has(positionKey(position)));
        const orderedTargets = orderTargetPositions(targetPositions, config, shuffle);

        orderedTargets.forEach((position, targetIndex) => {
            const targetNumber = targetIndex + 1;
            const value = valueForTarget(targetNumber, config.symbolSet);
            usedValues.add(value);
            cellsByIndex.set(position.index, {
                value,
                targetNumber,
                isDistractor: false,
                completed: false,
                row: position.row,
                col: position.col,
                index: position.index,
                pathRank: targetIndex
            });
        });

        distractorPositions.forEach((position, distractorIndex) => {
            const value = valueForDistractor(distractorIndex, orderedTargets.length, config.symbolSet, usedValues);
            usedValues.add(value);
            cellsByIndex.set(position.index, {
                value,
                targetNumber: null,
                isDistractor: true,
                completed: false,
                row: position.row,
                col: position.col,
                index: position.index,
                pathRank: null
            });
        });

        return allPositions.map(position => cellsByIndex.get(position.index));
    }

    function selectDistractorPositions(allPositions, config, shuffle) {
        if (config.distractorCount <= 0) return [];
        if (!shuffle) return allPositions.slice(-config.distractorCount);
        return seededShuffle(allPositions.slice()).slice(0, config.distractorCount);
    }

    function orderTargetPositions(targetPositions, config, shuffle) {
        if (shuffle && config.targetPathMode === 'random') {
            return seededShuffle(targetPositions.slice());
        }

        const targetKeys = new Set(targetPositions.map(positionKey));
        const ordered = pathPositions(config.gridSize, config.targetPathMode)
            .filter(position => targetKeys.has(positionKey(position)));

        if (ordered.length === targetPositions.length) return ordered;
        return targetPositions.slice();
    }

    function startGame() {
        if (isPlaying) return;

        resultModal.classList.add('hidden');
        clearTimer();

        currentRoundConfig = readConfig();
        sessionSeed = createSessionSeed();
        sessionRng = createRng(`${sessionSeed}:layout:${JSON.stringify({
            gridSize: currentRoundConfig.gridSize,
            symbolSet: currentRoundConfig.symbolSet,
            distractorLevel: currentRoundConfig.distractorLevel,
            targetPathMode: currentRoundConfig.targetPathMode,
            mode: currentRoundConfig.mode
        })}`);
        currentAdaptiveState = buildAdaptiveState(currentRoundConfig, 'current');

        isPlaying = true;
        startTime = Date.now();
        sessionStartedAt = new Date(startTime);
        targetStartedAt = startTime;
        lastClickAt = startTime;
        trialLog = [];
        sessionSaved = false;
        currentTarget = 1;

        generateGrid(true, currentRoundConfig);

        timerInterval = setInterval(updateTimer, 100);
        startBtn.disabled = true;
        startBtn.textContent = '进行中...';
        setControlsDisabled(true);
        updateTimer();
    }

    function resetGame() {
        currentTarget = 1;
        timerDisplay.textContent = '00:00';
        clearTimer();
        isPlaying = false;
        sessionStartedAt = null;
        targetStartedAt = 0;
        lastClickAt = 0;
        trialLog = [];
        sessionSaved = false;
        sessionSeed = '';
        sessionRng = null;
        currentRoundConfig = readConfig();
        currentAdaptiveState = buildAdaptiveState(currentRoundConfig, 'preview');
        startBtn.disabled = false;
        startBtn.textContent = '开始测试';
        setControlsDisabled(false);
        generateGrid(false, currentRoundConfig);
    }

    function clearTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function generateGrid(shuffle = false, configOverride = null) {
        const config = configOverride || readConfig();
        currentRoundConfig = config;
        totalNumbers = config.targetCount;

        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${config.gridSize}, 1fr)`;

        const maxWidth = Math.min(600, window.innerWidth - 40);
        const size = Math.max(30, Math.floor((maxWidth - (config.gridSize - 1) * 5) / config.gridSize));
        const cells = buildGridModel(config, shuffle);

        targetSequence = cells
            .filter(cell => !cell.isDistractor)
            .sort((a, b) => a.targetNumber - b.targetNumber)
            .map(cell => ({
                targetNumber: cell.targetNumber,
                displayValue: cell.value,
                position: { row: cell.row, col: cell.col, index: cell.index },
                pathRank: cell.pathRank
            }));

        gridLayout = cells.map(cell => ({
            value: cell.value,
            targetNumber: cell.targetNumber,
            isDistractor: cell.isDistractor,
            row: cell.row,
            col: cell.col,
            index: cell.index,
            pathRank: cell.pathRank
        }));

        cells.forEach(cellMeta => {
            const cell = document.createElement('div');
            cell.className = `schulte-cell${cellMeta.isDistractor ? ' distractor' : ''}`;
            cell.textContent = cellMeta.value;
            cell.style.width = `${size}px`;
            cell.style.height = `${size}px`;
            cell.style.fontSize = `${Math.max(14, size * (String(cellMeta.value).length > 2 ? 0.32 : 0.5))}px`;
            cell.dataset.targetNumber = cellMeta.targetNumber || '';
            cell.addEventListener('click', () => handleCellClick(cell, cellMeta));
            gridContainer.appendChild(cell);
        });

        updateTargetDisplay();
        updatePaceStatus();
    }

    function handleCellClick(cell, cellMeta) {
        if (!isPlaying) return;

        const clickTime = Date.now();
        const expectedNumber = currentTarget;
        const expectedTarget = targetSequence[expectedNumber - 1] || null;
        const correct = !cellMeta.isDistractor && cellMeta.targetNumber === expectedNumber;
        const errorType = correct ? null : classifyError(cellMeta, expectedNumber);
        const interClickMs = Math.max(0, clickTime - lastClickAt);
        const elapsedMs = Math.max(0, clickTime - startTime);
        const rtMs = Math.max(0, clickTime - targetStartedAt);
        const paceSnapshot = buildPaceSnapshot(clickTime);
        const cellPosition = { row: cellMeta.row, col: cellMeta.col, index: cellMeta.index };

        trialLog.push({
            index: trialLog.length,
            mode: currentRoundConfig.mode,
            isAdvancedMode,
            targetNumber: expectedNumber,
            targetValue: expectedTarget ? expectedTarget.displayValue : null,
            expectedNumber,
            expectedValue: expectedTarget ? expectedTarget.displayValue : null,
            clickedValue: cellMeta.value,
            clickedNumber: Number.isFinite(cellMeta.targetNumber) ? cellMeta.targetNumber : null,
            clickedTargetNumber: cellMeta.targetNumber,
            correct,
            errorType,
            cellPosition,
            position: { ...cellPosition },
            errorClickPosition: correct ? null : { ...cellPosition },
            rtMs,
            targetIntervalMs: rtMs,
            interClickMs,
            rtSinceLastMs: interClickMs,
            elapsedMs,
            gridSize: currentRoundConfig.gridSize,
            symbolSet: currentRoundConfig.symbolSet,
            distractorLevel: currentRoundConfig.distractorLevel,
            distractorMode: currentRoundConfig.distractorLevel,
            targetPathMode: currentRoundConfig.targetPathMode,
            paceMode: currentRoundConfig.paceMode,
            adaptiveState: clonePlain(currentAdaptiveState),
            nextGridSize: null,
            recommendedPaceMs: currentRoundConfig.recommendedPaceMs,
            ...paceSnapshot
        });
        lastClickAt = clickTime;

        if (correct) {
            cellMeta.completed = true;
            cell.classList.remove('pace-late');
            cell.classList.add('correct');

            if (isAdvancedMode) {
                const allCells = gridContainer.querySelectorAll('.schulte-cell');
                allCells.forEach(item => {
                    if (item !== cell && item.classList.contains('correct')) {
                        item.classList.remove('correct');
                    }
                });
            }

            if (expectedNumber === totalNumbers) {
                currentTarget = totalNumbers + 1;
                endGame(true, 'completed');
            } else {
                currentTarget += 1;
                targetStartedAt = clickTime;
                updateTargetDisplay();
                updatePaceStatus(clickTime);
            }
        } else {
            cell.classList.add('wrong');
            setTimeout(() => cell.classList.remove('wrong'), 200);
        }
    }

    function classifyError(cellMeta, expectedNumber) {
        if (cellMeta.isDistractor) return 'distractor';
        if (cellMeta.completed || cellMeta.targetNumber < expectedNumber) return 'already_completed';
        if (cellMeta.targetNumber > expectedNumber) return 'out_of_sequence';
        return 'wrong_value';
    }

    function updateTargetDisplay() {
        const target = targetSequence[currentTarget - 1];
        if (targetDisplay) {
            targetDisplay.textContent = target ? target.displayValue : '-';
            targetDisplay.title = target ? `目标序号 ${target.targetNumber}/${totalNumbers}` : '';
        }
        if (progressDisplay) {
            progressDisplay.textContent = `${Math.max(0, currentTarget - 1)}/${totalNumbers}`;
        }
    }

    function updateTimer() {
        if (!isPlaying || !currentRoundConfig) return;

        const now = Date.now();
        const elapsedMs = Math.max(0, now - startTime);
        if (currentRoundConfig.paceMode === 'timed') {
            const limitMs = currentRoundConfig.timeLimitSec * 1000;
            const remainingMs = Math.max(0, limitMs - elapsedMs);
            timerDisplay.textContent = `${(elapsedMs / 1000).toFixed(2)} / ${(remainingMs / 1000).toFixed(1)}`;
            if (elapsedMs >= limitMs) {
                endGame(false, 'time_limit');
                return;
            }
        } else {
            timerDisplay.textContent = (elapsedMs / 1000).toFixed(2);
        }
        updatePaceStatus(now);
    }

    function buildPaceSnapshot(clickTime) {
        if (!currentRoundConfig) return {};
        const paceMs = currentRoundConfig.recommendedPaceMs;
        const paceDeadlineMs = targetStartedAt + paceMs;
        const paceDeltaMs = clickTime - paceDeadlineMs;
        const timeRemainingMs = currentRoundConfig.paceMode === 'timed'
            ? Math.max(0, (startTime + currentRoundConfig.timeLimitSec * 1000) - clickTime)
            : null;

        return {
            paceMs,
            paceDeadlineMs,
            paceDeltaMs,
            paceStatus: currentRoundConfig.paceMode === 'paced'
                ? (paceDeltaMs <= 0 ? 'on_pace' : 'late')
                : 'not_paced',
            timeRemainingMs
        };
    }

    function updatePaceStatus(now = Date.now()) {
        if (!paceStatusDisplay || !currentRoundConfig) return;

        gridContainer.querySelectorAll('.pace-late').forEach(cell => cell.classList.remove('pace-late'));

        if (currentRoundConfig.paceMode === 'timed') {
            if (!isPlaying) {
                paceStatusDisplay.textContent = `${currentRoundConfig.timeLimitSec}s`;
                return;
            }
            const remainingMs = Math.max(0, (startTime + currentRoundConfig.timeLimitSec * 1000) - now);
            paceStatusDisplay.textContent = `剩余 ${(remainingMs / 1000).toFixed(1)}s`;
            return;
        }

        if (currentRoundConfig.paceMode !== 'paced') {
            paceStatusDisplay.textContent = '自定';
            return;
        }

        if (!isPlaying) {
            paceStatusDisplay.textContent = `${currentRoundConfig.recommendedPaceMs}ms`;
            return;
        }

        const targetElapsed = Math.max(0, now - targetStartedAt);
        const delta = currentRoundConfig.recommendedPaceMs - targetElapsed;
        paceStatusDisplay.textContent = delta >= 0 ? `剩 ${delta}ms` : `慢 ${Math.abs(delta)}ms`;

        if (delta < 0) {
            const targetCell = gridContainer.querySelector(`[data-target-number="${currentTarget}"]`);
            if (targetCell) targetCell.classList.add('pace-late');
        }
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

    function percentile(values, ratio) {
        const sorted = values.filter(value => Number.isFinite(value)).slice().sort((a, b) => a - b);
        if (sorted.length === 0) return 0;
        const index = (sorted.length - 1) * ratio;
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        if (lower === upper) return Math.round(sorted[lower]);
        const weight = index - lower;
        return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
    }

    function distribution(values) {
        const validValues = values.filter(value => Number.isFinite(value));
        if (validValues.length === 0) {
            return { count: 0, min: 0, q1: 0, median: 0, q3: 0, max: 0 };
        }
        return {
            count: validValues.length,
            min: Math.min(...validValues),
            q1: percentile(validValues, 0.25),
            median: percentile(validValues, 0.5),
            q3: percentile(validValues, 0.75),
            max: Math.max(...validValues)
        };
    }

    function distance(a, b) {
        if (!a || !b) return 0;
        const dx = a.col - b.col;
        const dy = a.row - b.row;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function buildScanMetrics(correctTrials, config) {
        const positions = correctTrials
            .slice()
            .sort((a, b) => a.targetNumber - b.targetNumber)
            .map(trial => trial.cellPosition);

        if (positions.length <= 1) {
            return {
                scanStability: positions.length === 1 ? 50 : 0,
                tempoStability: 0,
                spatialStability: 0,
                totalPathDistanceCells: 0,
                meanStepDistanceCells: 0,
                stepDistanceSdCells: 0,
                directionChangeCount: 0,
                pathBacktrackCount: 0
            };
        }

        const stepDistances = [];
        const directionKeys = [];
        let pathBacktrackCount = 0;
        const ranks = buildPathRankLookup(config.gridSize, config.targetPathMode);
        for (let i = 1; i < positions.length; i += 1) {
            const previous = positions[i - 1];
            const current = positions[i];
            stepDistances.push(distance(previous, current));
            directionKeys.push(`${Math.sign(current.row - previous.row)}:${Math.sign(current.col - previous.col)}`);
            const previousRank = ranks.get(positionKey(previous));
            const currentRank = ranks.get(positionKey(current));
            if (Number.isFinite(previousRank) && Number.isFinite(currentRank) && currentRank < previousRank) {
                pathBacktrackCount += 1;
            }
        }

        let directionChangeCount = 0;
        for (let i = 1; i < directionKeys.length; i += 1) {
            if (directionKeys[i] !== directionKeys[i - 1]) directionChangeCount += 1;
        }

        const rtValues = correctTrials.map(trial => trial.rtMs);
        const meanRt = mean(rtValues);
        const rtSd = standardDeviation(rtValues);
        const tempoStability = meanRt > 0
            ? clamp(Math.round((1 - Math.min(1, rtSd / meanRt)) * 100), 0, 100)
            : 0;

        const meanStepDistance = stepDistances.reduce((sum, value) => sum + value, 0) / stepDistances.length;
        const stepDistanceSd = Math.sqrt(stepDistances.reduce((sum, value) => sum + ((value - meanStepDistance) ** 2), 0) / stepDistances.length);
        const diagonal = Math.sqrt((config.gridSize - 1) ** 2 + (config.gridSize - 1) ** 2) || 1;
        const directionPenalty = directionKeys.length > 0 ? (directionChangeCount / directionKeys.length) * 30 : 0;
        const backtrackPenalty = directionKeys.length > 0 ? (pathBacktrackCount / directionKeys.length) * 25 : 0;
        const jumpPenalty = Math.min(45, (meanStepDistance / diagonal) * 45);
        const variabilityPenalty = meanStepDistance > 0 ? Math.min(25, (stepDistanceSd / meanStepDistance) * 25) : 0;
        const spatialStability = clamp(Math.round(100 - directionPenalty - backtrackPenalty - jumpPenalty - variabilityPenalty), 0, 100);
        const scanStability = clamp(Math.round(tempoStability * 0.55 + spatialStability * 0.45), 0, 100);

        return {
            scanStability,
            tempoStability,
            spatialStability,
            totalPathDistanceCells: Number(stepDistances.reduce((sum, value) => sum + value, 0).toFixed(2)),
            meanStepDistanceCells: Number(meanStepDistance.toFixed(2)),
            stepDistanceSdCells: Number(stepDistanceSd.toFixed(2)),
            directionChangeCount,
            pathBacktrackCount
        };
    }

    function buildPathRankLookup(gridSize, targetPathMode) {
        const ranks = new Map();
        const ordered = targetPathMode === 'random' ? pathPositions(gridSize, 'row') : pathPositions(gridSize, targetPathMode);
        ordered.forEach((position, index) => {
            ranks.set(positionKey(position), index);
        });
        return ranks;
    }

    function buildErrorMetrics(config) {
        const errors = trialLog.filter(trial => !trial.correct);
        const errorTypeCounts = errors.reduce((acc, trial) => {
            acc[trial.errorType] = (acc[trial.errorType] || 0) + 1;
            return acc;
        }, {});
        const heatmap = Array.from({ length: config.gridSize }, () => Array.from({ length: config.gridSize }, () => 0));
        errors.forEach(trial => {
            if (trial.cellPosition && heatmap[trial.cellPosition.row]) {
                heatmap[trial.cellPosition.row][trial.cellPosition.col] += 1;
            }
        });
        return {
            errorTypeCounts,
            errorPositions: errors.map(trial => ({
                targetNumber: trial.targetNumber,
                targetValue: trial.targetValue,
                clickedValue: trial.clickedValue,
                errorType: trial.errorType,
                cellPosition: { ...trial.cellPosition },
                rtMs: trial.rtMs,
                interClickMs: trial.interClickMs,
                elapsedMs: trial.elapsedMs
            })),
            errorHeatmap: heatmap
        };
    }

    function buildTimeBuckets(correctTrials) {
        const buckets = [
            { name: 'early', values: [] },
            { name: 'middle', values: [] },
            { name: 'late', values: [] }
        ];
        correctTrials.forEach(trial => {
            const ratio = totalNumbers > 0 ? trial.targetNumber / totalNumbers : 0;
            const index = ratio <= 1 / 3 ? 0 : ratio <= 2 / 3 ? 1 : 2;
            buckets[index].values.push(trial.rtMs);
        });
        return buckets.reduce((acc, bucket) => {
            acc[bucket.name] = distribution(bucket.values);
            return acc;
        }, {});
    }

    function calculateLoadIndex(config) {
        const symbolLoad = config.symbolSet === 'numbers' ? 0 : config.symbolSet === 'mixed' ? 5 : 7;
        const pathLoad = config.targetPathMode === 'random' ? 8 : config.targetPathMode === 'spiral' ? 4 : 1;
        const distractorLoad = config.distractorCount * (1 + (DISTRACTOR_LEVELS[config.distractorLevel] || DISTRACTOR_LEVELS.none).loadWeight * 0.35);
        return Number((config.cellCount + symbolLoad + pathLoad + distractorLoad).toFixed(1));
    }

    function clonePlain(value) {
        if (!value || typeof value !== 'object') return value;
        return JSON.parse(JSON.stringify(value));
    }

    function buildAdaptiveState(config, source) {
        return {
            source,
            gridSize: config.gridSize,
            symbolSet: config.symbolSet,
            distractorLevel: config.distractorLevel,
            targetPathMode: config.targetPathMode,
            paceMode: config.paceMode,
            recommendedPaceMs: config.recommendedPaceMs,
            timeLimitSec: config.timeLimitSec,
            targetCount: config.targetCount,
            distractorCount: config.distractorCount,
            loadIndex: calculateLoadIndex(config)
        };
    }

    function buildRecommendation(config, stats) {
        const observedPace = stats.meanInterClickRtMs || config.recommendedPaceMs || 1100;
        let nextGridSize = config.gridSize;
        let nextDistractorLevel = config.distractorLevel;
        let nextTargetPathMode = config.targetPathMode;
        let nextPace = observedPace;
        let reasonCode = 'hold';
        let recommendation = `下轮保持 ${config.gridSize}x${config.gridSize}，继续压低搜索间隔。`;

        if (!stats.completed || stats.targetCompletionRate < 0.85) {
            nextGridSize = stats.targetCompletionRate < 0.65 ? Math.max(MIN_GRID_SIZE, config.gridSize - 1) : config.gridSize;
            nextDistractorLevel = easierDistractor(config.distractorLevel);
            nextTargetPathMode = config.targetPathMode === 'random' ? 'snake' : config.targetPathMode;
            nextPace = observedPace * 1.2;
            reasonCode = 'reduce_incomplete_load';
            recommendation = `本轮未完成，下轮降低负荷到 ${nextGridSize}x${nextGridSize}，减少干扰并放慢确认节奏。`;
        } else if (stats.errorRate >= 0.18) {
            nextGridSize = stats.errorRate >= 0.3 ? Math.max(MIN_GRID_SIZE, config.gridSize - 1) : config.gridSize;
            nextDistractorLevel = easierDistractor(config.distractorLevel);
            nextTargetPathMode = config.targetPathMode === 'random' ? 'row' : config.targetPathMode;
            nextPace = observedPace * 1.18;
            reasonCode = 'reduce_error_load';
            recommendation = `错误率偏高，下轮保持或降低网格，减少干扰，先恢复目标确认准确性。`;
        } else if (stats.scanStability < 55) {
            nextDistractorLevel = easierDistractor(config.distractorLevel);
            nextTargetPathMode = config.targetPathMode === 'random' ? 'snake' : config.targetPathMode;
            nextPace = observedPace * 1.08;
            reasonCode = 'stabilize_scan_path';
            recommendation = `扫描稳定性偏低，下轮使用更稳定的空间路径并略放慢节奏。`;
        } else if (stats.errorRate <= 0.05 && stats.scanStability >= 75 && observedPace <= targetPaceThreshold(config)) {
            if (config.targetPathMode !== 'random') {
                nextTargetPathMode = 'random';
                reasonCode = 'increase_path_search';
                recommendation = `路径和节奏稳定，下轮切回随机搜索，提高目标定位负荷。`;
            } else if (config.gridSize < MAX_GRID_SIZE && observedPace <= targetPaceThreshold(config) * 0.9) {
                nextGridSize = config.gridSize + 1;
                nextDistractorLevel = config.distractorLevel === 'strong' ? 'mild' : config.distractorLevel;
                reasonCode = 'increase_grid_size';
                recommendation = `速度、错误率和稳定性达标，下轮提高到 ${nextGridSize}x${nextGridSize}。`;
            } else {
                nextDistractorLevel = harderDistractor(config.distractorLevel);
                reasonCode = 'increase_distractor_load';
                recommendation = nextDistractorLevel === config.distractorLevel
                    ? `已处于高负荷，下轮保持网格并继续缩短搜索间隔。`
                    : `基础表现稳定，下轮增加干扰项，训练目标-干扰区分。`;
            }
            nextPace = observedPace * 0.94;
        } else if (stats.errorRate <= 0.1 && stats.scanStability >= 65) {
            nextPace = observedPace * 0.97;
            reasonCode = 'slightly_speed_up';
            recommendation = `本轮负荷合适，下轮保持设置并小幅提速。`;
        } else {
            nextPace = observedPace * 1.03;
        }

        nextPace = clamp(Math.round(nextPace / 50) * 50, MIN_PACE_MS, MAX_PACE_MS);
        const nextConfig = {
            ...config,
            gridSize: nextGridSize,
            cellCount: nextGridSize * nextGridSize,
            distractorLevel: nextDistractorLevel,
            targetPathMode: nextTargetPathMode,
            recommendedPaceMs: nextPace
        };
        nextConfig.distractorCount = calculateDistractorCount(nextConfig.cellCount, nextConfig.gridSize, nextConfig.distractorLevel);
        nextConfig.targetCount = Math.max(nextConfig.gridSize, nextConfig.cellCount - nextConfig.distractorCount);
        const nextTimeLimitSec = config.paceMode === 'timed'
            ? clamp(Math.ceil((nextConfig.targetCount * nextPace * 1.25) / 1000), MIN_TIME_LIMIT_SEC, MAX_TIME_LIMIT_SEC)
            : config.timeLimitSec;
        nextConfig.timeLimitSec = nextTimeLimitSec;

        const nextAdaptiveState = {
            ...buildAdaptiveState(nextConfig, 'adaptive_next'),
            reasonCode,
            basedOn: {
                completed: stats.completed,
                completionRate: stats.targetCompletionRate,
                errorRate: stats.errorRate,
                scanStability: stats.scanStability,
                meanInterClickRtMs: stats.meanInterClickRtMs
            }
        };

        return {
            nextGridSize,
            nextDistractorLevel,
            nextTargetPathMode,
            recommendedPaceMs: nextPace,
            nextTimeLimitSec,
            recommendation,
            adaptiveReasonCode: reasonCode,
            nextAdaptiveState
        };
    }

    function easierDistractor(level) {
        const index = DISTRACTOR_ORDER.indexOf(level);
        return DISTRACTOR_ORDER[Math.max(0, index - 1)] || 'none';
    }

    function harderDistractor(level) {
        const index = DISTRACTOR_ORDER.indexOf(level);
        return DISTRACTOR_ORDER[Math.min(DISTRACTOR_ORDER.length - 1, Math.max(0, index) + 1)] || 'mild';
    }

    function targetPaceThreshold(config) {
        const distractorWeight = (DISTRACTOR_LEVELS[config.distractorLevel] || DISTRACTOR_LEVELS.none).loadWeight;
        const symbolPenalty = config.symbolSet === 'numbers' ? 0 : 120;
        return 1350 + (config.gridSize - 5) * 110 + distractorWeight * 170 + symbolPenalty;
    }

    function copyTrial(trial, nextAdaptiveState = null) {
        const nextState = nextAdaptiveState || null;
        return {
            ...trial,
            cellPosition: trial.cellPosition ? { ...trial.cellPosition } : null,
            position: trial.position ? { ...trial.position } : null,
            errorClickPosition: trial.errorClickPosition ? { ...trial.errorClickPosition } : null,
            adaptiveState: clonePlain(trial.adaptiveState),
            nextGridSize: nextState ? nextState.gridSize : trial.nextGridSize,
            nextAdaptiveState: nextState ? clonePlain(nextState) : null,
            nextRecommendedPaceMs: nextState ? nextState.recommendedPaceMs : null
        };
    }

    function buildSummary(durationMs, completed, reason) {
        const config = currentRoundConfig || readConfig();
        const correctTrials = trialLog.filter(trial => trial.correct);
        const correctCount = correctTrials.length;
        const wrongClickCount = trialLog.length - correctCount;
        const totalTrials = trialLog.length;
        const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
        const errorRate = totalTrials > 0 ? wrongClickCount / totalTrials : 0;
        const targetCompletionRate = totalNumbers > 0 ? correctCount / totalNumbers : 0;
        const rtValues = correctTrials.map(trial => trial.rtMs);
        const interClickValues = trialLog.map(trial => trial.interClickMs);
        const meanInterClickRtMs = mean(rtValues);
        const rtVariabilityMs = standardDeviation(rtValues);
        const scanMetrics = buildScanMetrics(correctTrials, config);
        const errorMetrics = buildErrorMetrics(config);
        const stats = {
            completed,
            targetCompletionRate,
            errorRate,
            meanInterClickRtMs,
            scanStability: scanMetrics.scanStability
        };
        const recommendation = buildRecommendation(config, stats);
        const savedTrials = trialLog.map(trial => copyTrial(trial, recommendation.nextAdaptiveState));

        return {
            gridSize: config.gridSize,
            mode: config.mode,
            isAdvancedMode,
            symbolSet: config.symbolSet,
            distractorLevel: config.distractorLevel,
            distractorMode: config.distractorLevel,
            distractorCount: config.distractorCount,
            targetPathMode: config.targetPathMode,
            paceMode: config.paceMode,
            currentPaceMs: config.recommendedPaceMs,
            timeLimitSec: config.timeLimitSec,
            targetCount: totalNumbers,
            completed,
            endReason: reason,
            totalTrials,
            correctCount,
            wrongClickCount,
            errorCount: wrongClickCount,
            accuracy,
            errorRate,
            targetCompletionRate,
            totalTimeMs: durationMs,
            completionTime: durationMs,
            meanRtMs: meanInterClickRtMs,
            meanInterClickRtMs,
            rtVariabilityMs,
            rtDistributionMs: distribution(rtValues),
            interClickDistributionMs: distribution(interClickValues),
            timeBuckets: buildTimeBuckets(correctTrials),
            scanStability: scanMetrics.scanStability,
            scanMetrics,
            ...errorMetrics,
            loadIndex: calculateLoadIndex(config),
            adaptiveState: clonePlain(currentAdaptiveState || buildAdaptiveState(config, 'current')),
            nextGridSize: recommendation.nextGridSize,
            nextDistractorLevel: recommendation.nextDistractorLevel,
            nextTargetPathMode: recommendation.nextTargetPathMode,
            recommendedPaceMs: recommendation.recommendedPaceMs,
            nextTimeLimitSec: recommendation.nextTimeLimitSec,
            recommendation: recommendation.recommendation,
            adaptiveReasonCode: recommendation.adaptiveReasonCode,
            nextAdaptiveState: recommendation.nextAdaptiveState,
            gridLayout: gridLayout.map(item => ({ ...item })),
            targetSequence: targetSequence.map(item => ({
                targetNumber: item.targetNumber,
                displayValue: item.displayValue,
                cellPosition: { ...item.position },
                pathRank: item.pathRank
            })),
            clickPath: savedTrials.map(trial => ({
                index: trial.index,
                mode: trial.mode,
                isAdvancedMode: trial.isAdvancedMode,
                targetNumber: trial.targetNumber,
                targetValue: trial.targetValue,
                clickedValue: trial.clickedValue,
                correct: trial.correct,
                errorType: trial.errorType,
                cellPosition: trial.cellPosition ? { ...trial.cellPosition } : null,
                rtMs: trial.rtMs,
                interClickMs: trial.interClickMs,
                elapsedMs: trial.elapsedMs,
                gridSize: trial.gridSize,
                adaptiveState: clonePlain(trial.adaptiveState),
                nextGridSize: trial.nextGridSize,
                recommendedPaceMs: trial.recommendedPaceMs
            })),
            trialLog: savedTrials,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        };
    }

    function applyAdaptiveState(state) {
        if (!state) return;
        gridSizeInput.value = clampInteger(state.gridSize, MIN_GRID_SIZE, MAX_GRID_SIZE, 5);
        if (distractorLevelSelect && DISTRACTOR_LEVELS[state.distractorLevel]) {
            distractorLevelSelect.value = state.distractorLevel;
        }
        if (targetPathSelect && TARGET_PATH_MODES.has(state.targetPathMode)) {
            targetPathSelect.value = state.targetPathMode;
        }
        if (paceMsInput) {
            paceMsInput.value = clampInteger(state.recommendedPaceMs, MIN_PACE_MS, MAX_PACE_MS, 1100);
        }
        if (timeLimitInput && Number.isFinite(state.timeLimitSec)) {
            timeLimitInput.value = clampInteger(state.timeLimitSec, MIN_TIME_LIMIT_SEC, MAX_TIME_LIMIT_SEC, 60);
        }
    }

    function showResultSummary(summary) {
        if (!resultDetails) return;
        const completionText = summary.completed ? '完成' : '未完成';
        resultDetails.innerHTML = `
            <p>结果：${completionText}，完成率 ${Math.round(summary.targetCompletionRate * 100)}%，错误率 ${Math.round(summary.errorRate * 100)}%</p>
            <p>负荷：${summary.gridSize}x${summary.gridSize}，${DISTRACTOR_LEVELS[summary.distractorLevel].label}，目标 ${summary.targetCount} 个，负荷指数 ${summary.loadIndex}</p>
            <p>平均查找间隔：${summary.meanInterClickRtMs}ms；查找时间分布：${summary.rtDistributionMs.q1}/${summary.rtDistributionMs.median}/${summary.rtDistributionMs.q3}ms</p>
            <p>扫描稳定性：${summary.scanStability}/100；空间稳定 ${summary.scanMetrics.spatialStability}/100，节奏稳定 ${summary.scanMetrics.tempoStability}/100</p>
            <p>下一轮建议：${summary.recommendation} 建议网格 ${summary.nextGridSize}x${summary.nextGridSize}，干扰 ${DISTRACTOR_LEVELS[summary.nextDistractorLevel].label}，路径 ${pathLabel(summary.nextTargetPathMode)}，参考节奏 ${summary.recommendedPaceMs}ms。</p>
        `;
    }

    function pathLabel(pathMode) {
        if (pathMode === 'row') return '行扫描';
        if (pathMode === 'snake') return '蛇形扫描';
        if (pathMode === 'spiral') return '螺旋扫描';
        return '随机搜索';
    }

    function endGame(completed, reason) {
        if (sessionSaved) return;

        isPlaying = false;
        clearTimer();
        gridContainer.querySelectorAll('.pace-late').forEach(cell => cell.classList.remove('pace-late'));

        const finishedAt = new Date();
        const durationMs = Math.max(0, finishedAt.getTime() - startTime);
        const summary = buildSummary(durationMs, completed, reason);
        pendingAdaptiveState = summary.nextAdaptiveState;
        const elapsed = durationMs / 1000;

        if (resultTitle) {
            resultTitle.textContent = completed ? '挑战成功！' : '本轮结束';
        }
        finalTimeDisplay.textContent = `${elapsed.toFixed(2)}秒`;
        showResultSummary(summary);

        saveTrainingResult(finishedAt, durationMs, summary);
        sessionSaved = true;

        resultModal.classList.remove('hidden');
        startBtn.disabled = false;
        startBtn.textContent = '开始测试';
        setControlsDisabled(false);
        updateTargetDisplay();
        updatePaceStatus();
    }

    function saveTrainingResult(finishedAt, durationMs, summaryOverride = null) {
        if (!window.TrainingResults || !sessionStartedAt) return;

        const summary = summaryOverride || buildSummary(durationMs, true, 'completed');
        const score = Math.round((
            summary.accuracy * 0.45
            + summary.targetCompletionRate * 0.3
            + (summary.scanStability / 100) * 0.25
        ) * 100);

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
            trials: summary.trialLog || trialLog.map(trial => copyTrial(trial, summary.nextAdaptiveState)),
            metrics: {
                mode: summary.mode,
                isAdvancedMode: summary.isAdvancedMode,
                completed: summary.completed,
                endReason: summary.endReason,
                gridSize: summary.gridSize,
                symbolSet: summary.symbolSet,
                distractorLevel: summary.distractorLevel,
                distractorCount: summary.distractorCount,
                targetPathMode: summary.targetPathMode,
                targetCount: summary.targetCount,
                paceMode: summary.paceMode,
                time: `${(durationMs / 1000).toFixed(2)}秒`,
                completionTime: durationMs,
                targetCompletionRate: summary.targetCompletionRate,
                accuracy: `${Math.round(summary.accuracy * 100)}%`,
                score,
                errorRate: `${Math.round(summary.errorRate * 100)}%`,
                errorCount: summary.errorCount,
                meanInterClickRT: `${summary.meanInterClickRtMs}ms`,
                meanInterClickRtMs: summary.meanInterClickRtMs,
                rtVariability: `${summary.rtVariabilityMs}ms`,
                rtVariabilityMs: summary.rtVariabilityMs,
                rtDistributionMs: summary.rtDistributionMs,
                interClickDistributionMs: summary.interClickDistributionMs,
                scanStability: summary.scanStability,
                spatialStability: summary.scanMetrics.spatialStability,
                tempoStability: summary.scanMetrics.tempoStability,
                wrongClickCount: summary.wrongClickCount,
                wrongClicks: summary.wrongClickCount,
                errorTypeCounts: summary.errorTypeCounts,
                errorPositions: summary.errorPositions,
                loadIndex: summary.loadIndex,
                adaptiveState: summary.adaptiveState,
                nextGridSize: summary.nextGridSize,
                nextDistractorLevel: summary.nextDistractorLevel,
                nextTargetPathMode: summary.nextTargetPathMode,
                recommendedPaceMs: summary.recommendedPaceMs,
                nextTimeLimitSec: summary.nextTimeLimitSec,
                adaptiveReasonCode: summary.adaptiveReasonCode,
                recommendation: summary.recommendation,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ['attention', 'schulte', 'visual-search', 'adaptive-training']
        });
    }
});
