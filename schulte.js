document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-btn');
    const gridSizeInput = document.getElementById('grid-size');
    const gridContainer = document.getElementById('schulte-grid');
    const timerDisplay = document.getElementById('timer');
    const targetDisplay = document.getElementById('target-num');
    const resultModal = document.getElementById('result-modal');
    const finalTimeDisplay = document.getElementById('final-time');
    const restartBtn = document.getElementById('restart-btn');
    
    let startTime = 0;
    let timerInterval = null;
    let isPlaying = false;
    let currentTarget = 1;
    let totalNumbers = 25;
    let isAdvancedMode = false;
    
    // Mode selection
    document.querySelectorAll('input[name="game-mode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            isAdvancedMode = e.target.value === 'advanced';
        });
    });
    
    // Initial setup
    gridSizeInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value);
        if (isNaN(val) || val < 3) val = 3;
        if (val > 9) val = 9;
        e.target.value = val;
        if (!isPlaying) generateGrid();
    });

    startBtn.addEventListener('click', startGame);
    
    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        resetGame();
    });

    // Initial render
    generateGrid();

    function startGame() {
        if (isPlaying) return;
        
        resetGame();
        isPlaying = true;
        startTime = Date.now();
        
        generateGrid(true); // Shuffle and render
        
        timerInterval = setInterval(updateTimer, 100); // 100ms precision
        startBtn.disabled = true;
        startBtn.textContent = "进行中...";
        gridSizeInput.disabled = true;
    }
    
    function resetGame() {
        currentTarget = 1;
        targetDisplay.textContent = currentTarget;
        timerDisplay.textContent = "00:00";
        if (timerInterval) clearInterval(timerInterval);
        isPlaying = false;
        startBtn.disabled = false;
        startBtn.textContent = "开始测试";
        gridSizeInput.disabled = false;
        generateGrid(); // Reset to sorted or keep current? Let's just keep current layout but reset state
    }

    function generateGrid(shuffle = false) {
        const n = parseInt(gridSizeInput.value) || 5;
        totalNumbers = n * n;
        
        gridContainer.innerHTML = '';
        gridContainer.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
        
        // Generate numbers
        let numbers = Array.from({length: totalNumbers}, (_, i) => i + 1);
        if (shuffle) {
            // Fisher-Yates shuffle
            for (let i = numbers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
            }
        }
        
        numbers.forEach(num => {
            const cell = document.createElement('div');
            cell.className = 'schulte-cell';
            cell.textContent = num;
            
            // Adjust size based on N and viewport
            const maxWidth = Math.min(600, window.innerWidth - 40);
            const size = Math.max(30, Math.floor((maxWidth - (n - 1) * 5) / n));
            
            cell.style.width = `${size}px`;
            cell.style.height = `${size}px`;
            cell.style.fontSize = `${size * 0.5}px`;
            
            cell.textContent = num;
            cell.className = 'schulte-cell';
            
            cell.addEventListener('click', () => handleCellClick(cell, num));
            gridContainer.appendChild(cell);
        });
    }
    
    function handleCellClick(cell, num) {
        if (!isPlaying) return;
        
        if (num === currentTarget) {
            // Correct
            cell.classList.add('correct');
            
            // Advanced Mode Logic: Only keep the LATEST number gray
            if (isAdvancedMode) {
                // Remove 'correct' class from ALL other cells
                // But we don't have easy access to "previous correct" unless we query.
                const allCells = gridContainer.querySelectorAll('.schulte-cell');
                allCells.forEach(c => {
                    if (c !== cell && c.classList.contains('correct')) {
                        c.classList.remove('correct');
                    }
                });
            }
            
            if (num === totalNumbers) {
                endGame();
            } else {
                currentTarget++;
                targetDisplay.textContent = currentTarget;
            }
        } else {
            // Wrong
            cell.classList.add('wrong');
            setTimeout(() => cell.classList.remove('wrong'), 200);
        }
    }
    
    function updateTimer() {
        const elapsed = (Date.now() - startTime) / 1000;
        timerDisplay.textContent = elapsed.toFixed(2);
    }
    
    function endGame() {
        isPlaying = false;
        clearInterval(timerInterval);
        const elapsed = (Date.now() - startTime) / 1000;
        finalTimeDisplay.textContent = elapsed.toFixed(2) + "秒";
        resultModal.classList.remove('hidden');
        startBtn.disabled = false;
        startBtn.textContent = "开始测试";
        gridSizeInput.disabled = false;
    }
});