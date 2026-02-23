document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const nLevelInput = document.getElementById('n-level');
    const speedInput = document.getElementById('speed');
    const roundsInput = document.getElementById('total-rounds');
    const display = document.getElementById('display');
    const feedback = document.getElementById('feedback');
    const matchBtn = document.getElementById('match-btn');
    const scoreDisplay = document.getElementById('score');
    const roundDisplay = document.getElementById('round');
    const resultModal = document.getElementById('result-modal');
    const finalScoreDisplay = document.getElementById('final-score');
    const finalAccuracyDisplay = document.getElementById('final-accuracy');
    const restartBtn = document.getElementById('restart-btn');

    let sequence = [];
    let history = []; // Stores { char, isTarget, userAction: 'none'|'match', result: 'correct'|'wrong'|'missed'|'neutral' }
    let currentIndex = 0;
    let score = 0;
    let correctMatches = 0;
    let wrongMatches = 0;
    let missedMatches = 0;
    let isPlaying = false;
    let timer = null;
    let totalRounds = 20;
    let n = 2;
    let speed = 2000;
    let hasResponded = false;
    let charType = 'letters';

    // Characters to use
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    // Common distinct Hanzi - Converted to array for consistent indexing
    const hanzi = "日月山水火木金土天人中大大小多上下左右前后红白蓝绿".split('');

    // Mode selection
    document.querySelectorAll('input[name="char-type"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            charType = e.target.value;
        });
    });

    startBtn.addEventListener('click', startGame);
    matchBtn.addEventListener('click', handleMatch);
    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        resetUI();
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.repeat) return; // Prevent key hold repetition
        // Ignore key presses during cooldown
        const roundStartTime = parseInt(display.dataset.startTime || 0);
        if (Date.now() - roundStartTime < 100) return;
        
        if (isPlaying && (e.code === 'Space' || e.code === 'Enter')) {
            handleMatch();
        }
    });

    function startGame() {
        if (isPlaying) return;
        
        let val = parseInt(nLevelInput.value);
        if (isNaN(val) || val < 0) val = 0; // Allow 0
        n = val;
        
        speed = (parseFloat(speedInput.value) || 2) * 1000;
        
        let r = parseInt(roundsInput.value);
        if (isNaN(r) || r < 5) r = 5;
        if (r > 100) r = 100;
        totalRounds = r;
        
        // Init state
        sequence = [];
        history = [];
        currentIndex = 0;
        score = 0;
        correctMatches = 0;
        wrongMatches = 0;
        missedMatches = 0;
        isPlaying = true;
        
        scoreDisplay.textContent = "0";
        roundDisplay.textContent = `0/${totalRounds}`;
        startBtn.disabled = true;
        matchBtn.disabled = false;
        nLevelInput.disabled = true;
        speedInput.disabled = true;
        roundsInput.disabled = true;
        
        feedback.textContent = "";
        feedback.className = "feedback";
        
        nextRound();
    }

    function nextRound() {
        if (currentIndex >= totalRounds) {
            endGame();
            return;
        }

        hasResponded = false;
        
        // Input Cooldown: Ignore clicks for the first 100ms of a new round
        // This prevents "late clicks" from the previous round being registered for the new one.
        const roundStartTime = Date.now();
        display.dataset.startTime = roundStartTime;
        
        // Generate next letter
        // To make it playable, we want ~30% chance of a match
        let char;
        const shouldMatch = Math.random() < 0.3 && sequence.length >= (n === 0 ? 1 : n);
        const sourceChars = (charType === 'hanzi') ? hanzi : letters;
        
        if (shouldMatch) {
            if (n === 0) {
                // N=0 Match: Pick ANY char that appeared before
                // We must pick from sequence history
                // sequence is not empty here because of the condition `sequence.length >= 1`
                char = sequence[Math.floor(Math.random() * sequence.length)];
            } else {
                // N-Back Match: Pick the specific N-back char
                char = sequence[sequence.length - n];
            }
        } else {
            // Pick a random char, but avoid accidental match if possible
            
            do {
                // For N=0, "New" means NOT in sequence.
                // If sequence contains ALL chars, we can't generate a non-match.
                // We will try to find a new one.
                // If sequence is very long, this might be hard, but with 20 rounds and 26 chars, it's fine.
                // Fallback: if we loop too much, just pick random (might be accidental match).
                
                char = sourceChars[Math.floor(Math.random() * sourceChars.length)];
            } while (
                (n > 0 && sequence.length >= n && char === sequence[sequence.length - n]) || // Avoid accidental N-back match
                (n === 0 && sequence.includes(char)) || // Avoid accidental 0-back match (must be NEW)
                (n > 0 && sequence.length > 0 && char === sequence[sequence.length - 1]) || // Avoid immediate 1-back repetition (A-A)
                
                // Repetition check (only for N>0, because for N=0, "repetition" is literally the definition of a match)
                (n > 0 && sequence.slice(-Math.max(10, n*3)).filter(c => c === char).length >= 2)
            );
        }
        
        sequence.push(char);
        
        // Record history for this round (initial state)
        // CRITICAL FIX: The target check logic here must be identical to the one in handleMatch()
        let isTarget = false;
        if (n === 0) {
            // N=0: Target if char exists in PREVIOUS sequence (excluding current newly added one)
            // sequence has just been pushed. So check sequence[0...length-2]
            isTarget = sequence.slice(0, sequence.length - 1).includes(char);
        } else {
            isTarget = (sequence.length > n && char === sequence[sequence.length - 1 - n]);
        }
        
        history.push({
            char: char,
            isTarget: isTarget,
            userAction: 'none',
            result: 'neutral'
        });
        
        display.textContent = char;
        roundDisplay.textContent = `${currentIndex + 1}/${totalRounds}`;
        
        // Visual cue for new letter (flash)
        display.style.color = "#3498db";
        setTimeout(() => display.style.color = "#2c3e50", 200);

        // Schedule next
        timer = setTimeout(() => {
            // Check missed match
            // If it WAS a target, and user did NOTHING, then it is MISSED.
            // If it was NOT a target, and user did NOTHING, then it is CORRECT rejection (neutral/correct).
            
            const currentRound = history[currentIndex];
            if (currentRound.userAction === 'none') {
                if (currentRound.isTarget) {
                    missedMatches++;
                    currentRound.result = 'missed';
                    showFeedback("漏选!", "wrong");
                } else {
                    currentRound.result = 'neutral'; // Correct rejection
                }
            }
            
            currentIndex++;
            nextRound();
        }, speed);
    }

    function handleMatch() {
        if (!isPlaying || hasResponded) return;
        
        // Check for cooldown (100ms)
        const roundStartTime = parseInt(display.dataset.startTime || 0);
        if (Date.now() - roundStartTime < 100) return;

        hasResponded = true;
        const currentRound = history[currentIndex];
        currentRound.userAction = 'match';
        
        if (sequence.length <= n) {
            // Impossible to match yet
            wrongMatches++;
            currentRound.result = 'wrong';
            showFeedback("错误 (过早)", "wrong");
            return;
        }

        if (currentRound.isTarget) {
            score += 10;
            correctMatches++;
            currentRound.result = 'correct';
            showFeedback("正确!", "correct");
            scoreDisplay.textContent = score;
            
            // Visual feedback on button
            matchBtn.classList.add('match');
            setTimeout(() => matchBtn.classList.remove('match'), 200);
        } else {
            score -= 5;
            wrongMatches++;
            currentRound.result = 'wrong';
            showFeedback("错误!", "wrong");
            scoreDisplay.textContent = score;
        }
    }

    function showFeedback(text, type) {
        feedback.textContent = text;
        feedback.className = `feedback ${type}`;
        // Clear feedback after 1s
        setTimeout(() => {
            if (feedback.textContent === text) {
                feedback.textContent = "";
            }
        }, 1000);
    }

    function endGame() {
        isPlaying = false;
        clearTimeout(timer);
        
        const totalPossible = correctMatches + missedMatches;
        // Avoid division by zero
        const accuracy = totalPossible > 0 
            ? Math.round((correctMatches / (totalPossible + wrongMatches)) * 100) 
            : 0; // Simple accuracy metric
            
        finalScoreDisplay.textContent = score;
        finalAccuracyDisplay.textContent = `${accuracy}% (正确: ${correctMatches}, 错误: ${wrongMatches}, 漏选: ${missedMatches})`;
        
        // Render history list
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        
        history.forEach((item, index) => {
            const el = document.createElement('div');
            el.style.padding = '5px 10px';
            el.style.borderRadius = '4px';
            el.style.border = '1px solid #ddd';
            el.style.fontSize = '1.2rem';
            el.style.fontWeight = 'bold';
            el.style.minWidth = '40px';
            el.style.textAlign = 'center';
            el.style.position = 'relative';
            el.textContent = item.char;
            
            // Style based on result
            if (item.result === 'correct') {
                el.style.backgroundColor = '#d4edda'; // Green bg
                el.style.color = '#155724';
                el.style.borderColor = '#c3e6cb';
                // Add checkmark
                // el.innerHTML += '<span style="font-size:0.6rem; position:absolute; top:-5px; right:-5px;">✅</span>';
            } else if (item.result === 'wrong') {
                el.style.backgroundColor = '#f8d7da'; // Red bg
                el.style.color = '#721c24';
                el.style.borderColor = '#f5c6cb';
                // Add X mark
                // el.innerHTML += '<span style="font-size:0.6rem; position:absolute; top:-5px; right:-5px;">❌</span>';
            } else if (item.result === 'missed') {
                el.style.backgroundColor = '#fff3cd'; // Yellow bg
                el.style.color = '#856404';
                el.style.borderColor = '#ffeeba';
                // Add Missed mark
                // el.innerHTML += '<span style="font-size:0.6rem; position:absolute; top:-5px; right:-5px;">⚠️</span>';
            } else {
                // Neutral (no match needed, no match clicked)
                el.style.backgroundColor = '#f8f9fa';
                el.style.color = '#6c757d';
            }
            
            // Add label for Target
            if (item.isTarget) {
                el.style.borderWidth = '2px';
                // el.style.borderStyle = 'dashed'; // Indicate it WAS a target
            }
            
            historyList.appendChild(el);
        });
        
        resultModal.classList.remove('hidden');
        resetUI();
    }

    function resetUI() {
        startBtn.disabled = false;
        matchBtn.disabled = true;
        nLevelInput.disabled = false;
        speedInput.disabled = false;
        roundsInput.disabled = false;
        startBtn.textContent = "开始训练";
        display.textContent = "?";
        feedback.textContent = "";
    }
});