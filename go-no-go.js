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
    responses.push({
        type: type,
        pressed: pressed,
        rt: rt,
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
    
    gameDisplay.style.display = 'none';
    resultModal.style.display = 'flex';
}
