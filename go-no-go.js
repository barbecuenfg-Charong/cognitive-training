const TOTAL_TRIALS = 50;
const GO_PROBABILITY = 0.8;
const STIMULUS_TIMEOUT = 1000; // Time window to respond
const FEEDBACK_DURATION = 300;
const MIN_ISI = 800;
const MAX_ISI = 1500;

let currentTrial = 0;
let isGameActive = false;
let trialStartTime = 0;
let trials = [];
let responses = [];
let stimulusTimeoutId = null;
let hasResponded = false;
let sessionStartedAt = null;
let hasSavedSession = false;

// DOM Elements
const instructionOverlay = document.getElementById('instruction-overlay');
const gameDisplay = document.getElementById('gng-display');
const stimulusCircle = document.getElementById('stimulus-circle');
const resultModal = document.getElementById('result-modal');
const accuracyDisplay = document.getElementById('accuracy');
const avgRtDisplay = document.getElementById('avg-rt');

// Event Listener for Spacebar
document.addEventListener('keydown', (e) => {
    if (!isGameActive || hasResponded) return;
    
    if (e.code === 'Space') {
        handleResponse();
    }
});

// Also support touch/click for mobile
gameDisplay.addEventListener('touchstart', (e) => {
    if (!isGameActive || hasResponded) return;
    e.preventDefault();
    handleResponse();
});
gameDisplay.addEventListener('mousedown', (e) => {
    if (!isGameActive || hasResponded) return;
    handleResponse();
});

function startGame() {
    isGameActive = true;
    currentTrial = 0;
    responses = [];
    trials = generateTrials();
    sessionStartedAt = new Date();
    hasSavedSession = false;
    
    instructionOverlay.style.display = 'none';
    gameDisplay.style.display = 'flex';
    resultModal.style.display = 'none';
    
    setTimeout(runTrial, 1000);
}

function generateTrials() {
    const list = [];
    for (let i = 0; i < TOTAL_TRIALS; i++) {
        list.push({
            type: Math.random() < GO_PROBABILITY ? 'go' : 'nogo',
            isi: Math.floor(Math.random() * (MAX_ISI - MIN_ISI) + MIN_ISI)
        });
    }
    return list;
}

function runTrial() {
    if (currentTrial >= TOTAL_TRIALS) {
        endGame();
        return;
    }
    
    const trial = trials[currentTrial];
    hasResponded = false;
    
    // Show Stimulus
    stimulusCircle.className = 'stimulus-circle';
    if (trial.type === 'go') {
        stimulusCircle.style.backgroundColor = '#2ecc71'; // Green
    } else {
        stimulusCircle.style.backgroundColor = '#e74c3c'; // Red
    }
    stimulusCircle.style.transform = 'scale(1)';
    stimulusCircle.style.opacity = '1';
    
    trialStartTime = Date.now();
    
    // Set timeout for response window
    stimulusTimeoutId = setTimeout(() => {
        if (!hasResponded) {
            handleTimeout();
        }
    }, STIMULUS_TIMEOUT);
}

function handleResponse() {
    if (!isGameActive || hasResponded) return;

    hasResponded = true;
    clearTimeout(stimulusTimeoutId);
    
    const rt = Date.now() - trialStartTime;
    const trial = trials[currentTrial];
    const isCorrect = (trial.type === 'go');
    
    // Feedback
    if (!isCorrect) {
        // False Alarm (Pressed on No-Go)
        stimulusCircle.style.backgroundColor = '#95a5a6'; // Grey out
        gameDisplay.style.backgroundColor = 'rgba(231, 76, 60, 0.2)'; // Red flash
        setTimeout(() => gameDisplay.style.backgroundColor = 'transparent', 200);
    } else {
        // Hit (Pressed on Go)
        stimulusCircle.style.transform = 'scale(0.8)';
    }
    
    recordResponse(trial.type, true, rt, isCorrect);
    
    setTimeout(() => {
        stimulusCircle.style.opacity = '0';
        setTimeout(() => {
            currentTrial++;
            runTrial();
        }, trial.isi);
    }, 200);
}

function handleTimeout() {
    if (hasResponded) return;

    hasResponded = true;
    
    const trial = trials[currentTrial];
    const isCorrect = (trial.type === 'nogo'); // Correct if didn't press on No-Go
    
    // Feedback
    if (!isCorrect) {
        // Miss (Didn't press on Go)
        gameDisplay.style.backgroundColor = 'rgba(241, 196, 15, 0.2)'; // Yellow flash
        setTimeout(() => gameDisplay.style.backgroundColor = 'transparent', 200);
    }
    
    recordResponse(trial.type, false, 0, isCorrect);
    
    stimulusCircle.style.opacity = '0';
    setTimeout(() => {
        currentTrial++;
        runTrial();
    }, trial.isi);
}

function recordResponse(type, pressed, rt, correct) {
    const isGo = type === 'go';
    const isNoGo = type === 'nogo';
    const rtMs = pressed ? rt : null;

    responses.push({
        trialIndex: currentTrial,
        type: type,
        isGo: isGo,
        isNoGo: isNoGo,
        pressed: pressed,
        responded: pressed,
        rt: rtMs,
        rtMs: rtMs,
        correct: correct
    });
    updateLiveStats();
}

function updateLiveStats() {
    const correctCount = responses.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / responses.length) * 100) || 100;
    
    const goResponses = responses.filter(r => r.type === 'go' && r.pressed);
    const avgRt = goResponses.length > 0 
        ? Math.round(goResponses.reduce((sum, r) => sum + r.rt, 0) / goResponses.length) 
        : 0;
        
    accuracyDisplay.textContent = `${accuracy}%`;
    if (avgRt > 0) avgRtDisplay.textContent = `${avgRt} ms`;
}

function average(values) {
    const validValues = values.filter((value) => Number.isFinite(value));
    if (validValues.length === 0) return 0;
    return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

function buildSummary() {
    const totalTrials = responses.length;
    const goTrials = responses.filter(r => r.isGo).length;
    const noGoTrials = responses.filter(r => r.isNoGo).length;
    const hitCount = responses.filter(r => r.isGo && r.responded).length;
    const missCount = responses.filter(r => r.isGo && !r.responded).length;
    const falseAlarmCount = responses.filter(r => r.isNoGo && r.responded).length;
    const correctRejectionCount = responses.filter(r => r.isNoGo && !r.responded).length;
    const correctCount = hitCount + correctRejectionCount;
    const hitRts = responses
        .filter(r => r.isGo && r.responded && r.correct)
        .map(r => r.rtMs);

    return {
        totalTrials,
        goTrials,
        noGoTrials,
        hitCount,
        missCount,
        falseAlarmCount,
        correctRejectionCount,
        accuracy: totalTrials > 0 ? correctCount / totalTrials : 0,
        hitRate: goTrials > 0 ? hitCount / goTrials : 0,
        falseAlarmRate: noGoTrials > 0 ? falseAlarmCount / noGoTrials : 0,
        meanRtMs: average(hitRts)
    };
}

function saveTrainingSession(finishedAt) {
    if (hasSavedSession || !window.TrainingResults || typeof window.TrainingResults.saveSession !== 'function') return;

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const summary = buildSummary();

    window.TrainingResults.saveSession({
        moduleId: "go-no-go",
        gameId: "go-no-go",
        gameName: "Go/No-Go 抑制控制",
        startedAt,
        finishedAt,
        durationMs,
        score: Math.round(summary.accuracy * 100),
        summary,
        trials: responses.map((trial) => ({
            trialIndex: trial.trialIndex,
            type: trial.type,
            isGo: trial.isGo,
            isNoGo: trial.isNoGo,
            responded: trial.responded,
            correct: trial.correct,
            rtMs: trial.rtMs
        })),
        metrics: {
            accuracy: `${Math.round(summary.accuracy * 100)}%`,
            hitRate: `${Math.round(summary.hitRate * 100)}%`,
            falseAlarmRate: `${Math.round(summary.falseAlarmRate * 100)}%`,
            meanRt: `${summary.meanRtMs}ms`
        },
        tags: ["attention", "inhibition", "go-no-go"]
    });

    hasSavedSession = true;
}

function endGame() {
    isGameActive = false;
    
    const goTrials = responses.filter(r => r.type === 'go');
    const nogoTrials = responses.filter(r => r.type === 'nogo');
    
    const goAccuracy = goTrials.length > 0 
        ? Math.round((goTrials.filter(r => r.correct).length / goTrials.length) * 100) 
        : 0;
        
    const nogoAccuracy = nogoTrials.length > 0 
        ? Math.round((nogoTrials.filter(r => r.correct).length / nogoTrials.length) * 100) 
        : 0;
        
    const correctGoResponses = goTrials.filter(r => r.correct && r.pressed);
    const avgRt = correctGoResponses.length > 0 
        ? Math.round(correctGoResponses.reduce((sum, r) => sum + r.rt, 0) / correctGoResponses.length) 
        : 0;
        
    document.getElementById('go-accuracy').textContent = `${goAccuracy}%`;
    document.getElementById('nogo-accuracy').textContent = `${nogoAccuracy}%`;
    document.getElementById('final-rt').textContent = `${avgRt} ms`;

    saveTrainingSession(new Date());
    
    gameDisplay.style.display = 'none';
    resultModal.style.display = 'flex';
}
