
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
    const modeRadios = document.getElementsByName('mode');

    // Game State
    let state = {
        isPlaying: false,
        currentSpan: 3,
        trials: 0,
        maxSpan: 0,
        score: 0,
        sequence: [],
        userInput: [],
        mode: 'forward',
        speed: 1000
    };

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

    function getSettings() {
        let mode = 'forward';
        for (const radio of modeRadios) {
            if (radio.checked) {
                mode = radio.value;
                break;
            }
        }
        return {
            mode: mode,
            speed: parseInt(speedSelect.value)
        };
    }

    function startGame() {
        const settings = getSettings();
        state.mode = settings.mode;
        state.speed = settings.speed;
        state.isPlaying = true;
        state.currentSpan = 3;
        state.trials = 0;
        state.maxSpan = 0;
        state.score = 0;
        state.sequence = [];
        state.userInput = [];

        // UI Updates
        startBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        scoreEl.textContent = '0';
        currentLengthEl.textContent = '3';
        digitContent.textContent = '';
        inputArea.style.display = 'none';
        instructionText.style.display = 'none';
        
        // Disable settings while playing
        speedSelect.disabled = true;
        modeRadios.forEach(r => r.disabled = true);
        
        nextRound();
    }

    function stopGame() {
        state.isPlaying = false;
        startBtn.style.display = 'inline-block';
        stopBtn.style.display = 'none';
        inputArea.style.display = 'none';
        digitContent.textContent = '已停止';
        instructionText.textContent = '';
        
        // Re-enable settings
        speedSelect.disabled = false;
        modeRadios.forEach(r => r.disabled = false);
    }

    function gameOver() {
        state.isPlaying = false;
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
        resultModal.classList.remove('hidden');
    }

    function generateSequence(length) {
        const seq = [];
        for (let i = 0; i < length; i++) {
            seq.push(Math.floor(Math.random() * 10));
        }
        return seq;
    }

    function updateInputDisplay() {
        // Add spaces for readability
        userInputDisplay.textContent = state.userInput.join(' ');
    }

    function nextRound() {
        if (!state.isPlaying) return;

        state.sequence = generateSequence(state.currentSpan);
        state.userInput = [];
        updateInputDisplay();

        currentLengthEl.textContent = state.currentSpan;
        roundIndicator.textContent = `尝试 ${state.trials + 1}/2`;
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
        instructionText.textContent = state.mode === 'forward' ? '请输入数字 (顺序)' : '请输入数字 (倒序)';
        
        // Highlight active input
        userInputDisplay.classList.add('active');
    }

    function checkAnswer() {
        const target = state.mode === 'forward' ? state.sequence : [...state.sequence].reverse();
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

        showFeedback(isCorrect);
    }

    function showFeedback(isCorrect) {
        inputArea.style.display = 'none';
        instructionText.style.display = 'none';
        
        if (isCorrect) {
            digitContent.textContent = '✔';
            digitContent.style.color = '#2ecc71';
            
            // Logic: Success
            state.score += state.currentSpan * 10;
            scoreEl.textContent = state.score;
            
            // Update max span immediately on success
            if (state.currentSpan > state.maxSpan) {
                state.maxSpan = state.currentSpan;
            }
            
            state.currentSpan++;
            state.trials = 0; // Reset trials for next level
            
            setTimeout(() => {
                if (!state.isPlaying) return;
                digitContent.style.color = '#2c3e50';
                nextRound();
            }, 1500);
        } else {
            digitContent.textContent = '✘';
            digitContent.style.color = '#e74c3c';
            
            const correctSeq = state.mode === 'forward' ? state.sequence.join(' ') : [...state.sequence].reverse().join(' ');
            instructionText.style.display = 'block';
            instructionText.innerHTML = `<span style="color:#7f8c8d; font-size: 16px;">正确答案</span><br><span style="font-size: 24px; color: #2c3e50;">${correctSeq}</span>`;
            
            state.trials++;
            
            setTimeout(() => {
                if (!state.isPlaying) return;
                digitContent.style.color = '#2c3e50';
                instructionText.style.display = 'none';
                
                if (state.trials >= 2) {
                    gameOver();
                } else {
                    // Retry same level
                    nextRound();
                }
            }, 3000); // Longer time to see correct answer
        }
    }
});
