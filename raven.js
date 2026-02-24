/**
 * Raven's Progressive Matrices - Simplified Web Implementation
 * Generates SVG-based logic puzzles.
 */

const GameState = {
    currentLevel: 0,
    score: 0,
    totalLevels: 8, // Fixed number of levels for MVP
    levels: [],
    userAnswers: []
};

// --- SVG Generator ---
const SVG_NS = "http://www.w3.org/2000/svg";

function createSVG(content) {
    return `<svg viewBox="0 0 100 100" xmlns="${SVG_NS}">${content}</svg>`;
}

function drawShape(type, props) {
    let shape = "";
    const cx = 50, cy = 50;
    const size = props.size || 40;
    const fill = props.fill === 'solid' ? '#2c3e50' : 'none';
    const stroke = '#2c3e50';
    const strokeWidth = 3;
    const rotate = props.rotate || 0;

    let transform = `transform="rotate(${rotate}, ${cx}, ${cy})"`;

    switch (type) {
        case 'square':
            shape = `<rect x="${cx - size/2}" y="${cy - size/2}" width="${size}" height="${size}" 
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${transform} />`;
            break;
        case 'circle':
            shape = `<circle cx="${cx}" cy="${cy}" r="${size/2}" 
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        case 'triangle':
            // Equilateral triangle
            const h = size * (Math.sqrt(3)/2);
            shape = `<polygon points="${cx},${cy - h/2} ${cx - size/2},${cy + h/2} ${cx + size/2},${cy + h/2}" 
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${transform} />`;
            break;
        case 'diamond':
            shape = `<polygon points="${cx},${cy - size/1.2} ${cx + size/1.2},${cy} ${cx},${cy + size/1.2} ${cx - size/1.2},${cy}" 
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" ${transform} />`;
            break;
        case 'cross':
            const w = size / 3;
            // Draw as two rects
            shape = `<g ${transform}>
                        <rect x="${cx - w/2}" y="${cy - size/2}" width="${w}" height="${size}" fill="${fill}" stroke="${stroke}" />
                        <rect x="${cx - size/2}" y="${cy - w/2}" width="${size}" height="${w}" fill="${fill}" stroke="${stroke}" />
                     </g>`;
            break;
        case 'star':
            // Simple 5-point star approximation
            // Using a path for better control
            // (Simplified for now to a polygon)
            // Points calculated for 5-pointed star
            const points = "50,15 61,35 85,35 65,50 75,75 50,60 25,75 35,50 15,35 39,35";
            // Scale points manually if needed, but fixed size is okay for now
            shape = `<polygon points="${points}" transform="translate(${cx-50}, ${cy-50}) scale(${size/70}) translate(${50-cx}, ${50-cy}) rotate(${rotate}, 50, 50)"
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        
        // Composite shapes for addition logic
        case 'left-half':
            shape = `<rect x="${cx - size/2}" y="${cy - size/2}" width="${size/2}" height="${size}" 
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        case 'right-half':
            shape = `<rect x="${cx}" y="${cy - size/2}" width="${size/2}" height="${size}" 
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
            break;
        case 'top-half':
             shape = `<rect x="${cx - size/2}" y="${cy - size/2}" width="${size}" height="${size/2}" 
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
             break;
        case 'bottom-half':
             shape = `<rect x="${cx - size/2}" y="${cy}" width="${size}" height="${size/2}" 
                      fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
             break;
    }

    // Special handling for 'outline' with inner pattern (optional, keep simple for now)
    if (props.fill === 'striped') {
        // Add a pattern definition to SVG (advanced, skipping for MVP)
        // Just use 'none' for outline
    }

    return createSVG(shape);
}


// --- Level Generator ---

function generateLevels() {
    const levels = [];

    // Level 1: Shape Consistency (Identity)
    // Row 1: A A A
    // Row 2: B B B
    // Row 3: C C ? -> C
    levels.push({
        matrix: [
            {t:'square'}, {t:'square'}, {t:'square'},
            {t:'circle'}, {t:'circle'}, {t:'circle'},
            {t:'triangle'}, {t:'triangle'}, null
        ],
        answer: {t:'triangle'},
        rule: "Shape Identity"
    });

    // Level 2: Size Progression
    // Row: Small, Medium, Large
    levels.push({
        matrix: [
            {t:'diamond', size:20}, {t:'diamond', size:40}, {t:'diamond', size:60},
            {t:'square', size:20}, {t:'square', size:40}, {t:'square', size:60},
            {t:'circle', size:20}, {t:'circle', size:40}, null
        ],
        answer: {t:'circle', size:60},
        rule: "Size Progression"
    });

    // Level 3: Rotation Progression (+45 deg)
    levels.push({
        matrix: [
            {t:'square', rotate:0}, {t:'square', rotate:45}, {t:'square', rotate:90},
            {t:'triangle', rotate:0}, {t:'triangle', rotate:45}, {t:'triangle', rotate:90},
            {t:'cross', rotate:0}, {t:'cross', rotate:45}, null
        ],
        answer: {t:'cross', rotate:90},
        rule: "Rotation (+45°)"
    });

    // Level 4: Shape Distribution (Row contains set {A, B, C})
    levels.push({
        matrix: [
            {t:'circle'}, {t:'square'}, {t:'triangle'},
            {t:'triangle'}, {t:'circle'}, {t:'square'},
            {t:'square'}, {t:'triangle'}, null
        ],
        answer: {t:'circle'},
        rule: "Shape Distribution (Sudoku-like)"
    });

    // Level 5: Fill Alternation
    // Solid, Outline, Solid...
    levels.push({
        matrix: [
            {t:'square', fill:'solid'}, {t:'square', fill:'outline'}, {t:'square', fill:'solid'},
            {t:'circle', fill:'outline'}, {t:'circle', fill:'solid'}, {t:'circle', fill:'outline'},
            {t:'diamond', fill:'solid'}, {t:'diamond', fill:'outline'}, null
        ],
        answer: {t:'diamond', fill:'solid'},
        rule: "Fill Alternation"
    });

    // Level 6: Addition (Left + Right = Full)
    // Using special types 'left-half', 'right-half', 'square' (as full)
    levels.push({
        matrix: [
            {t:'left-half'}, {t:'right-half'}, {t:'square', fill:'solid'}, // Logic: A+B forms Square
            // Wait, standard visual addition usually overlays them. 
            // Let's simulate visual addition by drawing both in the 3rd cell.
            // But my drawShape takes one type. 
            // Workaround: Define 'full-rect' which looks like left+right.
            // Let's simplify: A, B, A+B.
            // Row 1: Left-Rect, Right-Rect, Full-Rect
            {t:'left-half'}, {t:'right-half'}, {t:'square', fill:'solid'},
            {t:'top-half'}, {t:'bottom-half'}, {t:'square', fill:'solid'},
            // Row 3: Left-Half-Circle? Too complex for current engine.
            // Let's do: Vertical Bar, Horizontal Bar, Cross.
            // I need a 'v-bar' and 'h-bar' type.
            // 'cross' is already V+H.
            {t:'v-bar', size:60}, {t:'h-bar', size:60}, null
        ],
        answer: {t:'cross', size:60},
        rule: "Shape Addition"
    });
    
    // Fix for Level 6 types in drawShape:
    // I need to add 'v-bar' and 'h-bar' to drawShape or map them.
    // 'v-bar' -> rect width=small, height=large.
    // 'h-bar' -> rect width=large, height=small.
    
    // Level 7: Subtraction / XOR (Simulated)
    // Row: 3 objects, 2 objects, 1 object? 
    // Or: Outline, Solid, Outline (XOR logic?)
    // Let's do Count Progression: 1, 2, 3 shapes.
    // Hard to draw multiple shapes with current drawShape.
    // Let's do Size Subtraction: Large, Medium, Small.
    levels.push({
        matrix: [
             {t:'star', size:70}, {t:'star', size:50}, {t:'star', size:30},
             {t:'circle', size:70}, {t:'circle', size:50}, {t:'circle', size:30},
             {t:'square', size:70}, {t:'square', size:50}, null
        ],
        answer: {t:'square', size:30},
        rule: "Size Reduction"
    });

    // Level 8: Complex (Shape + Fill + Rotation)
    // Row 1: Square(Solid,0), Square(Outline,45), Square(Solid,90)
    levels.push({
        matrix: [
            {t:'triangle', fill:'solid', rotate:0}, {t:'triangle', fill:'outline', rotate:90}, {t:'triangle', fill:'solid', rotate:180},
            {t:'diamond', fill:'solid', rotate:0}, {t:'diamond', fill:'outline', rotate:90}, {t:'diamond', fill:'solid', rotate:180},
            {t:'star', fill:'solid', rotate:0}, {t:'star', fill:'outline', rotate:90}, null
        ],
        answer: {t:'star', fill:'solid', rotate:180},
        rule: "Complex Progression"
    });

    return levels;
}

// Enhance drawShape to handle Level 6 special types
const originalDrawShape = drawShape;
drawShape = function(type, props) {
    const cx = 50, cy = 50;
    const size = props.size || 40;
    const fill = props.fill === 'solid' ? '#2c3e50' : 'none';
    const stroke = '#2c3e50';
    
    if (type === 'v-bar') {
        const w = size / 3;
        const shape = `<rect x="${cx - w/2}" y="${cy - size/2}" width="${w}" height="${size}" fill="${fill}" stroke="${stroke}" />`;
        return createSVG(shape);
    }
    if (type === 'h-bar') {
        const w = size / 3;
        const shape = `<rect x="${cx - size/2}" y="${cy - w/2}" width="${size}" height="${w}" fill="${fill}" stroke="${stroke}" />`;
        return createSVG(shape);
    }
    return originalDrawShape(type, props);
}

// --- Game Logic ---

function initGame() {
    GameState.levels = generateLevels();
    GameState.currentLevel = 0;
    GameState.score = 0;
    GameState.userAnswers = [];
    
    renderLevel();
}

function generateOptions(answer, levelIndex) {
    // Generate 6 options: 1 correct, 5 distractors
    const options = [];
    options.push({ ...answer, correct: true }); // Correct

    // Distractor strategies
    const shapes = ['square', 'circle', 'triangle', 'diamond', 'star', 'cross'];
    const fills = ['solid', 'outline'];
    const sizes = [20, 30, 40, 50, 60, 70];
    const rotations = [0, 45, 90, 135, 180];

    // Helper to get random item excluding current
    const getRandom = (arr, exclude) => {
        const filtered = arr.filter(x => x !== exclude);
        return filtered[Math.floor(Math.random() * filtered.length)];
    };

    // 5 Distractors
    for (let i = 0; i < 5; i++) {
        let distractor = { ...answer };
        distractor.correct = false;

        // Randomly change one property
        const r = Math.random();
        if (r < 0.33) {
            distractor.t = getRandom(shapes, answer.t);
        } else if (r < 0.66) {
            if (answer.fill) distractor.fill = getRandom(fills, answer.fill);
            else distractor.size = getRandom(sizes, answer.size);
        } else {
            if (answer.rotate !== undefined) distractor.rotate = getRandom(rotations, answer.rotate);
            else distractor.t = getRandom(shapes, answer.t); // Fallback
        }
        options.push(distractor);
    }

    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
}

function renderLevel() {
    const level = GameState.levels[GameState.currentLevel];
    const gridEl = document.getElementById('matrix-grid');
    const optionsEl = document.getElementById('options-area');
    
    // Update Info
    document.getElementById('level-display').textContent = `${GameState.currentLevel + 1} / ${GameState.levels.length}`;
    document.getElementById('score-display').textContent = GameState.score;
    
    // Update Progress Bar
    const progress = ((GameState.currentLevel) / GameState.levels.length) * 100;
    document.getElementById('progress-bar').style.width = `${progress}%`;

    // Render Matrix
    gridEl.innerHTML = '';
    level.matrix.forEach(cell => {
        const div = document.createElement('div');
        div.className = 'matrix-cell';
        if (cell) {
            div.innerHTML = drawShape(cell.t, cell);
        } else {
            div.className += ' empty';
            div.textContent = '?';
        }
        gridEl.appendChild(div);
    });

    // Render Options
    const options = generateOptions(level.answer, GameState.currentLevel);
    optionsEl.innerHTML = '';
    options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-card';
        div.innerHTML = drawShape(opt.t, opt);
        div.onclick = () => checkAnswer(opt);
        optionsEl.appendChild(div);
    });
}

function checkAnswer(selectedOption) {
    if (selectedOption.correct) {
        GameState.score += 10;
        showFeedback(true);
    } else {
        showFeedback(false);
    }

    setTimeout(() => {
        GameState.currentLevel++;
        if (GameState.currentLevel < GameState.levels.length) {
            renderLevel();
        } else {
            gameOver();
        }
    }, 500); // Short delay to show selection feedback if we add it
}

function showFeedback(isCorrect) {
    // Optional: Visual feedback on the selected card
    // For now, just proceeding
}

function gameOver() {
    const modal = document.getElementById('result-modal');
    const score = GameState.score;
    const maxScore = GameState.levels.length * 10;
    const accuracy = Math.round((score / maxScore) * 100);

    document.getElementById('final-score').textContent = score;
    document.getElementById('final-accuracy').textContent = `${accuracy}%`;

    let feedback = "";
    if (accuracy >= 90) feedback = "卓越的逻辑推理能力！";
    else if (accuracy >= 70) feedback = "优秀的表现！";
    else if (accuracy >= 50) feedback = "表现尚可，继续加油！";
    else feedback = "多多练习，潜力无限！";

    document.getElementById('performance-feedback').textContent = feedback;
    modal.classList.remove('hidden');
    
    // Final progress bar update
    document.getElementById('progress-bar').style.width = '100%';
}

// Start Game
window.onload = initGame;
