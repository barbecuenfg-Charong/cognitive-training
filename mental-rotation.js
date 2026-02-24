const STIMULI = ['F', 'R', 'G', 'L', 'P', '4', '7', 'J', 'S', 'k'];
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const TOTAL_ROUNDS = 20;

let currentRound = 0;
let correctCount = 0;
let reactionTimes = [];
let trialData = []; // { angle: 0, rt: 0, correct: true }
let isGameActive = false;
let startTime = 0;
let currentTrial = {};

function startGame() {
    currentRound = 0;
    correctCount = 0;
    reactionTimes = [];
    trialData = [];
    isGameActive = true;
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('mr-display').style.display = 'flex';
    document.getElementById('result-modal').style.display = 'none';
    
    updateScore();
    nextRound();
}

function nextRound() {
    if (currentRound >= TOTAL_ROUNDS) {
        endGame();
        return;
    }
    
    currentRound++;
    document.getElementById('round').textContent = `${currentRound}/${TOTAL_ROUNDS}`;
    
    // Generate Trial
    const char = STIMULI[Math.floor(Math.random() * STIMULI.length)];
    const angle1 = ANGLES[Math.floor(Math.random() * ANGLES.length)];
    
    // Determine angle difference (0 to 180)
    // We want a good distribution of angle differences
    const possibleDiffs = [0, 45, 90, 135, 180];
    const angleDiff = possibleDiffs[Math.floor(Math.random() * possibleDiffs.length)];
    
    // Randomly add or subtract diff to get angle2
    const direction = Math.random() < 0.5 ? 1 : -1;
    let angle2 = (angle1 + direction * angleDiff) % 360;
    if (angle2 < 0) angle2 += 360;
    
    const isMirror = Math.random() < 0.5;
    
    currentTrial = {
        char: char,
        angle1: angle1,
        angle2: angle2,
        isMirror: isMirror,
        angleDiff: angleDiff
    };
    
    // Render
    const left = document.getElementById('stim-left');
    const right = document.getElementById('stim-right');
    
    left.textContent = char;
    right.textContent = char;
    
    // Reset transitions to avoid animation during setup
    left.style.transition = 'none';
    right.style.transition = 'none';
    
    // Apply transforms
    left.style.transform = `rotate(${angle1}deg)`;
    
    if (isMirror) {
        // Mirror image (flip horizontal)
        // We apply scaleX(-1) to flip it. 
        // Note: rotate() then scaleX() vs scaleX() then rotate().
        // We want the object to be a mirror image, then rotated to angle2.
        // CSS transform order is right-to-left (or effectively applied in order).
        // transform: rotate(angle) scaleX(-1) means: Flip first, then Rotate.
        // Wait, standard CSS is: transform: A B C -> Apply C, then B, then A?
        // No, it's applied left to right in the coordinate system, or right to left on the object.
        // Let's stick to: rotate(angle2 deg) scaleX(-1). This rotates the flipped object.
        right.style.transform = `rotate(${angle2}deg) scaleX(-1)`;
    } else {
        right.style.transform = `rotate(${angle2}deg)`;
    }
    
    startTime = Date.now();
}

function checkAnswer(choice) {
    if (!isGameActive) return;
    
    const rt = Date.now() - startTime;
    // Debounce very fast clicks
    if (rt < 100) return;
    
    const isCorrect = (choice === 'same' && !currentTrial.isMirror) || 
                      (choice === 'different' && currentTrial.isMirror);
    
    const display = document.getElementById('mr-display');
    
    if (isCorrect) {
        correctCount++;
        reactionTimes.push(rt);
        trialData.push({ angle: currentTrial.angleDiff, rt: rt, correct: true });
        display.style.borderColor = '#2ecc71';
    } else {
        trialData.push({ angle: currentTrial.angleDiff, rt: rt, correct: false });
        display.style.borderColor = '#e74c3c';
    }
    
    updateScore();
    
    // Brief delay before next round
    setTimeout(() => {
        if (!isGameActive) return;
        display.style.borderColor = '#ecf0f1';
        nextRound();
    }, 300);
}

function updateScore() {
    document.getElementById('score').textContent = correctCount;
    const avg = reactionTimes.length > 0 ? Math.round(reactionTimes.reduce((a,b)=>a+b,0)/reactionTimes.length) : 0;
    document.getElementById('avg-rt').textContent = avg;
}

function calculateSlope() {
    // Linear regression of RT vs Angle for correct trials
    const correctTrials = trialData.filter(t => t.correct);
    if (correctTrials.length < 2) return 0;
    
    const n = correctTrials.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let t of correctTrials) {
        sumX += t.angle;
        sumY += t.rt;
        sumXY += t.angle * t.rt;
        sumXX += t.angle * t.angle;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    return Math.round(slope);
}

function endGame() {
    isGameActive = false;
    document.getElementById('mr-display').style.display = 'none';
    document.getElementById('result-modal').style.display = 'flex';
    
    const accuracy = Math.round((correctCount / TOTAL_ROUNDS) * 100);
    const avgRT = reactionTimes.length > 0 ? Math.round(reactionTimes.reduce((a,b)=>a+b,0)/reactionTimes.length) : 0;
    const slope = calculateSlope();
    
    document.getElementById('result-accuracy').textContent = accuracy + '%';
    document.getElementById('result-rt').textContent = avgRT + ' ms';
    
    let slopeText = slope + ' ms/度';
    if (slope > 0) slopeText += ' (正常)';
    else slopeText += ' (异常/随机)';
    
    document.getElementById('result-slope').textContent = slopeText;
    
    let feedback = "";
    if (accuracy > 85) feedback = "空间想象力非常出色！";
    else if (accuracy > 70) feedback = "表现不错，继续加油。";
    else feedback = "试着在脑海中旋转物体，不要着急。";
    
    if (slope > 10) feedback += " 检测到了明显的心理旋转效应。";
    
    document.getElementById('feedback-text').textContent = feedback;
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (!isGameActive) return;
    
    if (e.key === 'a' || e.key === 'A') {
        checkAnswer('same');
    } else if (e.key === 'l' || e.key === 'L') {
        checkAnswer('different');
    }
});
