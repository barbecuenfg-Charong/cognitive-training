const TOTAL_TRIALS = 40;
const STIMULI = [1, 2, 3, 4, 6, 7, 8, 9];
const TASKS = ['parity', 'magnitude'];
const COLORS = {
    'parity': '#3498db',    // Blue
    'magnitude': '#e67e22'  // Orange
};

let currentTrial = 0;
let trials = [];
let responses = [];
let isGameActive = false;
let trialStartTime = 0;
let lastTask = null;

// DOM Elements
const instructionOverlay = document.getElementById('instruction-overlay');
const gameDisplay = document.getElementById('ts-display');
const stimulusCard = document.getElementById('stimulus-card');
const stimulusNumber = document.getElementById('stimulus-number');
const resultModal = document.getElementById('result-modal');
const accuracyDisplay = document.getElementById('accuracy');
const switchCostDisplay = document.getElementById('switch-cost');

// Event Listener for Keys
document.addEventListener('keydown', (e) => {
    if (!isGameActive) return;
    
    const key = e.key.toLowerCase();
    if (key === 'a' || key === 'l') {
        handleResponse(key);
    }
});

function startGame() {
    isGameActive = true;
    currentTrial = 0;
    trials = generateTrials();
    responses = [];
    
    instructionOverlay.style.display = 'none';
    gameDisplay.style.display = 'flex';
    resultModal.style.display = 'none';
    
    // Add a small delay before first trial
    setTimeout(runTrial, 1000);
}

function generateTrials() {
    const trialList = [];
    let previousTask = TASKS[Math.floor(Math.random() * TASKS.length)];
    
    for (let i = 0; i < TOTAL_TRIALS; i++) {
        // 50% chance to switch task
        const isSwitch = Math.random() < 0.5;
        const task = isSwitch ? (previousTask === 'parity' ? 'magnitude' : 'parity') : previousTask;
        
        const number = STIMULI[Math.floor(Math.random() * STIMULI.length)];
        
        // Determine correct answer
        let correctAnswer;
        if (task === 'parity') {
            // Odd -> A, Even -> L
            correctAnswer = (number % 2 !== 0) ? 'a' : 'l';
        } else {
            // Low (<5) -> A, High (>5) -> L
            correctAnswer = (number < 5) ? 'a' : 'l';
        }
        
        trialList.push({
            index: i,
            task: task,
            number: number,
            isSwitch: (i === 0) ? false : (task !== previousTask), // First trial is never a switch cost trial
            correctAnswer: correctAnswer
        });
        
        previousTask = task;
    }
    return trialList;
}

function runTrial() {
    if (currentTrial >= TOTAL_TRIALS) {
        endGame();
        return;
    }
    
    const trial = trials[currentTrial];
    
    // Update Display
    stimulusCard.style.backgroundColor = COLORS[trial.task];
    stimulusNumber.textContent = trial.number;
    stimulusNumber.style.visibility = 'visible';
    
    trialStartTime = Date.now();
}

function handleResponse(key) {
    if (!isGameActive) return;
    
    const rt = Date.now() - trialStartTime;
    // Prevent accidental double taps or too fast responses
    if (rt < 100) return;
    
    const trial = trials[currentTrial];
    const isCorrect = (key === trial.correctAnswer);
    
    // Feedback
    if (!isCorrect) {
        stimulusCard.classList.add('shake');
        setTimeout(() => stimulusCard.classList.remove('shake'), 300);
    }
    
    responses.push({
        ...trial,
        rt: rt,
        correct: isCorrect,
        userKey: key
    });
    
    updateLiveStats();
    
    // Move to next trial
    stimulusNumber.style.visibility = 'hidden';
    currentTrial++;
    
    // ISI (Inter-Stimulus Interval)
    setTimeout(runTrial, 400); // 400ms pause between trials
}

function updateLiveStats() {
    const correctCount = responses.filter(r => r.correct).length;
    const accuracy = Math.round((correctCount / responses.length) * 100) || 0;
    accuracyDisplay.textContent = `${accuracy}%`;
}

function calculateResults() {
    const correctResponses = responses.filter(r => r.correct);
    const accuracy = Math.round((correctResponses.length / TOTAL_TRIALS) * 100);
    const meanRT = Math.round(correctResponses.reduce((sum, r) => sum + r.rt, 0) / correctResponses.length) || 0;
    
    // Calculate Switch Cost
    // Filter for correct trials only
    // Exclude the first trial as it's neither switch nor repeat
    const validResponses = correctResponses.filter(r => r.index > 0);
    
    const switchTrials = validResponses.filter(r => r.isSwitch);
    const repeatTrials = validResponses.filter(r => !r.isSwitch);
    
    const switchRT = switchTrials.length > 0 
        ? switchTrials.reduce((sum, r) => sum + r.rt, 0) / switchTrials.length 
        : 0;
        
    const repeatRT = repeatTrials.length > 0 
        ? repeatTrials.reduce((sum, r) => sum + r.rt, 0) / repeatTrials.length 
        : 0;
        
    const switchCost = (switchRT > 0 && repeatRT > 0) ? Math.round(switchRT - repeatRT) : 0;
    
    return { accuracy, meanRT, switchCost };
}

function endGame() {
    isGameActive = false;
    const results = calculateResults();
    
    document.getElementById('final-accuracy').textContent = `${results.accuracy}%`;
    document.getElementById('final-rt').textContent = `${results.meanRT} ms`;
    document.getElementById('final-switch-cost').textContent = `${results.switchCost} ms`;
    
    gameDisplay.style.display = 'none';
    resultModal.style.display = 'flex';
}
