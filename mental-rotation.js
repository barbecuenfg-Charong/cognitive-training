const STIMULI = ['F', 'R', 'G', 'L', 'P', '4', '7', 'J', 'S', 'k'];
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const TOTAL_ROUNDS = 20;
const GAME_ID = 'mental-rotation';
const GAME_NAME = '心理旋转测试';

let currentRound = 0;
let correctCount = 0;
let reactionTimes = [];
let trialData = []; // { angle, correctAnswer, response, correct, rtMs }
let isGameActive = false;
let canRespond = false;
let sessionStartedAt = null;
let hasSavedSession = false;
let startTime = 0;
let currentTrial = {};

function startGame() {
    currentRound = 0;
    correctCount = 0;
    reactionTimes = [];
    trialData = [];
    isGameActive = true;
    canRespond = false;
    sessionStartedAt = new Date();
    hasSavedSession = false;
    
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
    canRespond = true;
}

function checkAnswer(choice) {
    if (!isGameActive || !canRespond) return;
    
    const rt = Date.now() - startTime;
    // Debounce very fast clicks
    if (rt < 100) {
        startTime = Date.now();
        return;
    }

    canRespond = false;

    const isCorrect = (choice === 'same' && !currentTrial.isMirror) || 
                      (choice === 'different' && currentTrial.isMirror);
    
    const display = document.getElementById('mr-display');
    const trial = {
        angle: currentTrial.angleDiff,
        correctAnswer: currentTrial.isMirror ? 'mirrored' : 'same',
        response: choice,
        correct: isCorrect,
        rtMs: rt
    };
    
    if (isCorrect) {
        correctCount++;
        reactionTimes.push(rt);
        display.style.borderColor = '#2ecc71';
    } else {
        display.style.borderColor = '#e74c3c';
    }

    trialData.push(trial);
    
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
    const avg = getMeanReactionTime();
    document.getElementById('avg-rt').textContent = avg;
}

function getMeanReactionTime() {
    if (reactionTimes.length === 0) return 0;
    return Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length);
}

function calculateSlope() {
    // Linear regression of RT vs Angle for correct trials
    const correctTrials = trialData.filter(t => t.correct);
    if (correctTrials.length < 2) return 0;
    
    const n = correctTrials.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let t of correctTrials) {
        sumX += t.angle;
        const rt = Number.isFinite(t.rtMs) ? t.rtMs : t.rt;
        sumY += rt;
        sumXY += t.angle * rt;
        sumXX += t.angle * t.angle;
    }
    
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return 0;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    return Math.round(slope);
}

function buildSessionSummary() {
    const totalTrials = trialData.length;
    const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
    const meanRtMs = getMeanReactionTime();
    const slope = calculateSlope();

    return {
        totalTrials,
        correctCount,
        accuracy,
        meanRtMs,
        slope,
        angleEffect: slope,
        score: correctCount
    };
}

function saveTrainingSession(finishedAt, summary) {
    if (hasSavedSession) return;
    hasSavedSession = true;

    if (!window.TrainingResults || typeof window.TrainingResults.saveSession !== 'function' || !sessionStartedAt) {
        return;
    }

    const durationMs = Math.max(0, finishedAt.getTime() - sessionStartedAt.getTime());

    try {
        window.TrainingResults.saveSession({
            moduleId: GAME_ID,
            gameId: GAME_ID,
            gameName: GAME_NAME,
            startedAt: sessionStartedAt,
            finishedAt,
            durationMs,
            score: summary.score,
            summary,
            trials: trialData.map((trial) => ({ ...trial }))
        });
    } catch (error) {
        console.error('Failed to save mental rotation session:', error);
    }
}

function endGame() {
    isGameActive = false;
    canRespond = false;
    const finishedAt = new Date();
    const summary = buildSessionSummary();

    saveTrainingSession(finishedAt, summary);

    document.getElementById('mr-display').style.display = 'none';
    document.getElementById('result-modal').style.display = 'flex';
    
    const accuracy = Math.round(summary.accuracy * 100);
    const avgRT = summary.meanRtMs;
    const slope = summary.slope;
    
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
    if (e.repeat) return;
    
    if (e.key === 'a' || e.key === 'A') {
        checkAnswer('same');
    } else if (e.key === 'l' || e.key === 'L') {
        checkAnswer('different');
    }
});
