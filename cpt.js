let isGameActive = false;
let currentLetter = '';
let trialStartTime = 0;
let hits = 0;
let misses = 0;
let falseAlarms = 0;
let reactionTimes = [];
let stimulusTimeout;
let isiTimeout;
let gameTimer;
let hasResponded = false;

// Configuration
const TOTAL_DURATION = 120000; // 2 minutes
const STIMULUS_DURATION = 250; // 250ms display time
const ISI = 1500; // 1.5s interval between stimuli
const TARGET_PROB = 0.2; // 20% probability of X
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWYZ"; // Excludes X

function startGame() {
    // Reset state
    isGameActive = true;
    hits = 0;
    misses = 0;
    falseAlarms = 0;
    reactionTimes = [];
    hasResponded = false;
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('cpt-display').style.display = 'flex';
    document.getElementById('click-area').style.display = 'block';
    document.getElementById('result-modal').style.display = 'none';
    
    updateScore();
    
    // Start loop
    runTrial();
    
    // Game Timer
    gameTimer = setTimeout(endGame, TOTAL_DURATION);
}

function runTrial() {
    if (!isGameActive) return;
    
    hasResponded = false;
    
    // Determine letter
    if (Math.random() < TARGET_PROB) {
        currentLetter = 'X';
    } else {
        currentLetter = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    }
    
    // Show letter
    const display = document.getElementById('target-letter');
    display.textContent = currentLetter;
    display.style.visibility = 'visible';
    
    trialStartTime = Date.now();
    
    // Hide letter after STIMULUS_DURATION
    stimulusTimeout = setTimeout(() => {
        if (!isGameActive) return;
        display.style.visibility = 'hidden';
        
        // Wait ISI then next trial
        isiTimeout = setTimeout(() => {
            if (!isGameActive) return;
            
            // Check for miss (if target was X and no response by end of trial)
            if (currentLetter === 'X' && !hasResponded) {
                misses++;
                updateScore();
            }
            
            runTrial();
        }, ISI);
        
    }, STIMULUS_DURATION);
}

function handleResponse() {
    if (!isGameActive || hasResponded) return;
    
    const responseTime = Date.now();
    const rt = responseTime - trialStartTime;
    
    hasResponded = true;
    
    // Check correctness
    if (currentLetter === 'X') {
        hits++;
        reactionTimes.push(rt);
        // Optional: Visual feedback for hit
        const display = document.getElementById('cpt-display');
        display.style.borderColor = '#2ecc71';
        setTimeout(() => display.style.borderColor = '#ecf0f1', 200);
    } else {
        falseAlarms++;
        // Visual feedback for error
        document.body.style.backgroundColor = '#ffdddd';
        setTimeout(() => document.body.style.backgroundColor = '', 200);
    }
    
    updateScore();
}

function updateScore() {
    document.getElementById('hits').textContent = hits;
    document.getElementById('false-alarms').textContent = falseAlarms;
    const avg = reactionTimes.length > 0 ? Math.round(reactionTimes.reduce((a,b)=>a+b,0)/reactionTimes.length) : 0;
    document.getElementById('avg-rt').textContent = avg;
}

function endGame() {
    isGameActive = false;
    clearTimeout(stimulusTimeout);
    clearTimeout(isiTimeout);
    clearTimeout(gameTimer);
    
    document.getElementById('cpt-display').style.display = 'none';
    document.getElementById('click-area').style.display = 'none';
    document.getElementById('result-modal').style.display = 'flex';
    
    document.getElementById('result-hits').textContent = hits;
    document.getElementById('result-misses').textContent = misses;
    document.getElementById('result-fa').textContent = falseAlarms;
    const avg = reactionTimes.length > 0 ? Math.round(reactionTimes.reduce((a,b)=>a+b,0)/reactionTimes.length) : 0;
    document.getElementById('result-rt').textContent = avg + ' ms';
    
    // Calculate performance score (d-prime proxy or simple accuracy)
    const totalTargets = hits + misses;
    const accuracy = totalTargets > 0 ? Math.round((hits / totalTargets) * 100) : 0;
    
    let feedback = "";
    if (accuracy > 90 && falseAlarms < 3) feedback = "非常出色！你的专注力非常稳定且精准。";
    else if (accuracy > 80 && falseAlarms < 5) feedback = "表现不错，继续保持训练。";
    else if (falseAlarms > 5) feedback = "注意控制冲动，看准了再按。";
    else feedback = "加油！试着更加专注，不要错过目标。";
    
    document.getElementById('feedback-text').textContent = feedback;
}

// Event Listeners
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && isGameActive) {
        e.preventDefault(); // Prevent scrolling
        handleResponse();
    }
});

document.getElementById('click-area').addEventListener('mousedown', (e) => {
    if (isGameActive) {
        e.preventDefault();
        handleResponse();
    }
});

// Prevent space scrolling globally
window.addEventListener('keydown', function(e) {
  if(e.keyCode == 32 && e.target == document.body) {
    e.preventDefault();
  }
});