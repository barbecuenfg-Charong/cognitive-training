document.addEventListener('DOMContentLoaded', () => {
    const MODULE_ID = 'corsi';
    const GAME_NAME = '科西方块';

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
    let sequence = [];
    let userSequence = [];
    let currentLevel = 3;
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
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 2) val = 2;
        if (val > 20) val = 20;
        e.target.value = val;
        blockCount = val;
        if (!isPlaying) initBlocks();
    });

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

    function initBlocks() {
        gameArea.innerHTML = '';
        blocks = [];
        
        // Use a grid-like distribution but with some randomness to simulate irregular placement
        // while avoiding overlap. 
        // Simple strategy: Divide area into dynamic grid cells based on block count
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
            
            // Calculate grid position
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Add random offset within the cell
            const maxOffsetX = cellW - blockSize - padding * 2;
            const maxOffsetY = cellH - blockSize - padding * 2;
            
            const offsetX = Math.random() * maxOffsetX + padding;
            const offsetY = Math.random() * maxOffsetY + padding;
            
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
        }
    }

    function getMode() {
        return isBackwardMode ? 'backward' : 'forward';
    }

    function getMemorySpan() {
        return Math.max(0, highestCorrectLevel);
    }

    function copyTrial(trial) {
        return {
            ...trial,
            sequence: trial.sequence.slice(),
            userSequence: trial.userSequence.slice()
        };
    }

    function recordTrial(correct) {
        const now = Date.now();
        trialLog.push({
            index: trialLog.length,
            level: currentLevel,
            mode: getMode(),
            sequence: sequence.slice(),
            userSequence: userSequence.slice(),
            correct,
            rtMs: responseStartedAt > 0 ? Math.max(0, now - responseStartedAt) : 0,
            elapsedMs: sessionStartedMs > 0 ? Math.max(0, now - sessionStartedMs) : 0
        });
    }

    function buildSummary() {
        const totalTrials = trialLog.length;
        const correctCount = trialLog.filter(trial => trial.correct).length;
        const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;

        return {
            mode: getMode(),
            blockCount,
            maxLevel,
            currentLevel,
            score,
            totalTrials,
            correctCount,
            accuracy,
            memorySpan: getMemorySpan()
        };
    }

    function saveTrainingResult(finishedAt, durationMs) {
        if (sessionSaved || !sessionStartedAt) return;
        sessionSaved = true;

        if (!window.TrainingResults || typeof window.TrainingResults.saveSession !== 'function') return;

        const summary = buildSummary();
        window.TrainingResults.saveSession({
            moduleId: MODULE_ID,
            gameId: MODULE_ID,
            gameName: GAME_NAME,
            startedAt: sessionStartedAt,
            finishedAt,
            durationMs,
            score,
            summary,
            trials: trialLog.map(copyTrial),
            metrics: {
                mode: summary.mode,
                accuracy: `${Math.round(summary.accuracy * 100)}%`,
                memorySpan: summary.memorySpan,
                totalTrials: summary.totalTrials
            },
            tags: ['memory', 'corsi']
        });
    }

    function startGame() {
        if (isPlaying) return;
        
        const selectedMode = document.querySelector('input[name="mode"]:checked');
        isBackwardMode = selectedMode ? selectedMode.value === 'backward' : isBackwardMode;
        score = 0;
        currentLevel = parseInt(startLevelInput.value) || 3;
        blockCount = parseInt(blockCountInput.value) || 9;
        if (blockCount < 2) blockCount = 2;
        if (blockCount > 20) blockCount = 20;
        levelErrorCount = 0;
        sessionStartedAt = new Date();
        sessionStartedMs = sessionStartedAt.getTime();
        responseStartedAt = 0;
        trialLog = [];
        sessionSaved = false;
        highestCorrectLevel = Math.max(0, currentLevel - 1);
        maxLevel = currentLevel;
        
        isPlaying = true;
        
        scoreDisplay.textContent = score;
        levelDisplay.textContent = currentLevel;
        resultModal.classList.add('hidden');
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        startLevelInput.disabled = true;
        blockCountInput.disabled = true;
        
        // Re-generate layout every game for variety
        initBlocks();
        
        startRound();
    }

    function startRound() {
        if (!isPlaying) return;

        userSequence = [];
        sequence = [];
        isShowingSequence = true;
        responseStartedAt = 0;
        maxLevel = Math.max(maxLevel, currentLevel);
        messageDisplay.textContent = "请观察...";
        
        // Generate sequence
        let lastIdx = -1;
        for (let i = 0; i < currentLevel; i++) {
            let idx;
            do {
                idx = Math.floor(Math.random() * blockCount);
            } while (idx === lastIdx);
            sequence.push(idx);
            lastIdx = idx;
        }

        // Play sequence
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
                messageDisplay.textContent = isBackwardMode ? "请逆序点击!" : "请按顺序点击!";
                gameArea.style.cursor = 'pointer';
                return;
            }
            
            highlightBlock(sequence[i]);
            i++;
        }, 1000);
    }

    function highlightBlock(index) {
        const block = blocks[index];
        block.classList.add('active');
        playSound(440, 'sine', 0.1);
        
        setTimeout(() => {
            block.classList.remove('active');
        }, 500);
    }

    function handleBlockClick(e) {
        if (!isPlaying || isShowingSequence) return;
        
        const block = e.target;
        const index = parseInt(block.dataset.index);
        
        block.classList.add('user-active');
        playSound(660, 'triangle', 0.1);
        setTimeout(() => block.classList.remove('user-active'), 200);
        
        userSequence.push(index);
        
        const step = userSequence.length - 1;
        let expectedIndex;
        
        if (isBackwardMode) {
            expectedIndex = sequence[sequence.length - 1 - step];
        } else {
            expectedIndex = sequence[step];
        }

        if (index !== expectedIndex) {
            block.classList.add('error');
            playSound(150, 'sawtooth', 0.3);
            isShowingSequence = true;
            recordTrial(false);
            
            levelErrorCount++;
            
            if (levelErrorCount > maxErrorsPerLevel) {
                messageDisplay.textContent = "错误两次，测试结束!";
                endGame();
            } else {
                messageDisplay.textContent = "错误! 同级再试一次...";
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
            recordTrial(true);
            highestCorrectLevel = Math.max(highestCorrectLevel, currentLevel);
            score += currentLevel * 10;
            scoreDisplay.textContent = score;
            messageDisplay.textContent = "正确! 难度升级...";
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

    function endGame(forced = false) {
        if (!isPlaying && (forced || sessionSaved)) return;

        isPlaying = false;
        isShowingSequence = false;
        
        startBtn.style.display = 'inline-block';
        startBtn.disabled = false;
        stopBtn.style.display = 'none';
        startLevelInput.disabled = false;
        blockCountInput.disabled = false;
        gameArea.style.cursor = 'default';
        
        if (forced) {
            messageDisplay.textContent = "已停止";
            sessionStartedAt = null;
            sessionStartedMs = 0;
            responseStartedAt = 0;
            return;
        }
        
        const finishedAt = new Date();
        const durationMs = sessionStartedAt
            ? Math.max(0, finishedAt.getTime() - sessionStartedAt.getTime())
            : 0;
        const span = getMemorySpan();
        finalLevelDisplay.textContent = span; // Last successful level
        finalScoreDisplay.textContent = score;
        
        let rating = "";
        if (span >= 7) rating = "评级: 卓越 (Excellent)";
        else if (span >= 6) rating = "评级: 优秀 (Good)";
        else if (span >= 5) rating = "评级: 正常 (Average)";
        else rating = "评级: 需加强 (Below Average)";
        
        memorySpanRating.textContent = rating;
        saveTrainingResult(finishedAt, durationMs);
        
        setTimeout(() => {
            resultModal.classList.remove('hidden');
        }, 800);
    }
    
    // Initial draw for visual
    initBlocks();
});
