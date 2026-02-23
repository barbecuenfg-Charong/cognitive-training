document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const display = document.getElementById('display');
    const feedback = document.getElementById('feedback');
    const leftBtn = document.getElementById('left-btn');
    const rightBtn = document.getElementById('right-btn');
    const scoreDisplay = document.getElementById('score');
    const timeDisplay = document.getElementById('time-left');
    const timeSettingInput = document.getElementById('time-setting');
    const resultModal = document.getElementById('result-modal');
    const finalScoreDisplay = document.getElementById('final-score');
    const avgRtDisplay = document.getElementById('avg-rt');
    const restartBtn = document.getElementById('restart-btn');

    let isPlaying = false;
    let score = 0;
    let timeLeft = 30;
    let timerInterval = null;
    let currentDirection = null; // 'left' or 'right'
    let stimulusStartTime = 0;
    let reactionTimes = [];

    startBtn.addEventListener('click', startGame);
    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        resetUI();
    });

    leftBtn.addEventListener('click', () => handleResponse('left'));
    rightBtn.addEventListener('click', () => handleResponse('right'));

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (!isPlaying) return;
        if (e.key === 'ArrowLeft') handleResponse('left');
        if (e.key === 'ArrowRight') handleResponse('right');
    });

    function startGame() {
        if (isPlaying) return;
        
        score = 0;
        let t = parseInt(timeSettingInput.value);
        if (isNaN(t) || t < 5) t = 5;
        if (t > 300) t = 300;
        timeLeft = t;
        
        reactionTimes = [];
        isPlaying = true;
        
        scoreDisplay.textContent = score;
        timeDisplay.textContent = timeLeft + "s";
        startBtn.disabled = true;
        timeSettingInput.disabled = true;
        leftBtn.disabled = false;
        rightBtn.disabled = false;
        feedback.textContent = "";
        
        timerInterval = setInterval(() => {
            timeLeft--;
            timeDisplay.textContent = timeLeft + "s";
            if (timeLeft <= 0) {
                endGame();
            }
        }, 1000);
        
        nextRound();
    }

    function nextRound() {
        if (!isPlaying) return;
        
        // Randomize condition
        // Congruent: <<<<< or >>>>>
        // Incongruent: <<><< or >><>>
        
        const direction = Math.random() < 0.5 ? 'left' : 'right';
        const isCongruent = Math.random() < 0.6; // 60% congruent
        
        currentDirection = direction;
        
        const centerChar = direction === 'left' ? '<' : '>';
        const flankerChar = isCongruent ? centerChar : (direction === 'left' ? '>' : '<');
        
        // Randomly choose target position (0 to 4)
        // Array of 5 items
        const count = 5;
        const targetIndex = Math.floor(Math.random() * count);
        
        let chars = [];
        for (let i = 0; i < count; i++) {
            if (i === targetIndex) {
                chars.push(`<span style="color:#e74c3c">${centerChar}</span>`);
            } else {
                chars.push(flankerChar);
            }
        }
        
        // Construct string
        const text = chars.join(' ');
        
        display.innerHTML = text;
        stimulusStartTime = Date.now();
    }

    function handleResponse(response) {
        if (!isPlaying) return;
        
        const rt = Date.now() - stimulusStartTime;
        reactionTimes.push(rt);
        
        if (response === currentDirection) {
            score++;
            scoreDisplay.textContent = score;
            showFeedback("正确", "correct");
        } else {
            // Optional: penalty?
            showFeedback("错误", "wrong");
        }
        
        // Immediate next round? Or small delay?
        // Small delay to prevent spamming
        setTimeout(nextRound, 150); 
    }

    function showFeedback(text, type) {
        feedback.textContent = text;
        feedback.className = `feedback ${type}`;
    }

    function endGame() {
        isPlaying = false;
        clearInterval(timerInterval);
        
        const avgRt = reactionTimes.length > 0 
            ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length) 
            : 0;
            
        finalScoreDisplay.textContent = score;
        avgRtDisplay.textContent = avgRt;
        
        resultModal.classList.remove('hidden');
        resetUI();
    }

    function resetUI() {
        startBtn.disabled = false;
        timeSettingInput.disabled = false;
        leftBtn.disabled = true;
        rightBtn.disabled = true;
        startBtn.textContent = "开始挑战";
        display.textContent = "准备";
        feedback.textContent = "";
    }
});