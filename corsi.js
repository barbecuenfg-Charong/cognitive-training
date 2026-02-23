document.addEventListener('DOMContentLoaded', () => {
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
    let blockCount = 9; // Standard Corsi is usually 9 blocks

    // Audio context for sound feedback
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    startBtn.addEventListener('click', startGame);
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

    function startGame() {
        if (isPlaying) return;
        
        score = 0;
        currentLevel = parseInt(startLevelInput.value) || 3;
        blockCount = parseInt(blockCountInput.value) || 9;
        if (blockCount < 2) blockCount = 2;
        if (blockCount > 20) blockCount = 20;
        
        isPlaying = true;
        
        scoreDisplay.textContent = score;
        levelDisplay.textContent = currentLevel;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        startLevelInput.disabled = true;
        blockCountInput.disabled = true;
        
        // Re-generate layout every game for variety
        initBlocks();
        
        startRound();
    }

    function startRound() {
        userSequence = [];
        sequence = [];
        isShowingSequence = true;
        messageDisplay.textContent = "请观察...";
        
        // Generate sequence
        let lastIdx = -1;
        for (let i = 0; i < currentLevel; i++) {
            let idx;
            do {
                idx = Math.floor(Math.random() * blockCount);
            } while (idx === lastIdx); // Avoid immediate repetition for clarity
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
                messageDisplay.textContent = isBackwardMode ? "请逆序点击!" : "请按顺序点击!";
                gameArea.style.cursor = 'pointer';
                return;
            }
            
            highlightBlock(sequence[i]);
            i++;
        }, 1000); // 1 second interval
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
        
        // User feedback
        block.classList.add('user-active');
        playSound(660, 'triangle', 0.1);
        setTimeout(() => block.classList.remove('user-active'), 200);
        
        userSequence.push(index);
        
        // Check correctness immediately
        const step = userSequence.length - 1;
        let expectedIndex;
        
        if (isBackwardMode) {
            // In backward mode, 1st click matches last item of sequence
            expectedIndex = sequence[sequence.length - 1 - step];
        } else {
            // In forward mode, 1st click matches 1st item of sequence
            expectedIndex = sequence[step];
        }

        if (index !== expectedIndex) {
            // Wrong click
            block.classList.add('error');
            playSound(150, 'sawtooth', 0.3);
            messageDisplay.textContent = "错误!";
            endGame();
            return;
        }

        // Check if round complete
        if (userSequence.length === sequence.length) {
            // Round success
            score += currentLevel * 10;
            scoreDisplay.textContent = score;
            messageDisplay.textContent = "正确! 难度升级...";
            playSound(880, 'sine', 0.2);
            setTimeout(() => playSound(1100, 'sine', 0.2), 150);
            
            currentLevel++;
            levelDisplay.textContent = currentLevel;
            
            setTimeout(startRound, 1500);
        }
    }

    function endGame(forced = false) {
        isPlaying = false;
        
        startBtn.style.display = 'inline-block';
        startBtn.disabled = false;
        stopBtn.style.display = 'none';
        startLevelInput.disabled = false;
        blockCountInput.disabled = false;
        gameArea.style.cursor = 'default';
        
        if (forced) {
            messageDisplay.textContent = "已停止";
            return;
        }
        
        finalLevelDisplay.textContent = currentLevel - 1; // Last successful level
        finalScoreDisplay.textContent = score;
        
        const span = currentLevel - 1;
        let rating = "";
        if (span >= 7) rating = "评级: 卓越 (Excellent)";
        else if (span >= 6) rating = "评级: 优秀 (Good)";
        else if (span >= 5) rating = "评级: 正常 (Average)";
        else rating = "评级: 需加强 (Below Average)";
        
        memorySpanRating.textContent = rating;
        
        setTimeout(() => {
            resultModal.classList.remove('hidden');
        }, 800);
    }
    
    // Initial draw for visual
    initBlocks();
});
