/**
 * Raven's Progressive Matrices - Simplified Web Implementation
 * Generates SVG-based logic puzzles.
 */

const GameState = {
    currentLevel: 0,
    score: 0,
    totalLevels: 12,
    levels: [],
    userAnswers: [],
    trials: [],
    startedAt: null,
    levelStartedAt: null,
    sessionSaved: false,
    answerLocked: false,
    sessionSeed: null,
    rng: null,
    currentOptions: [],
    currentOptionValidation: null,
    currentOptionRationales: [],
    validationIssues: [],
    validationIssueCount: 0,
    generatedTemplateCount: 0
};

const GAME_ID = "raven";
const GAME_NAME = "瑞文推理";
const CONTENT_VERSION = "raven-v3-rule-template-generation";
const OPTION_COUNT = 6;

const RULE_METADATA = {
    "Shape Identity": { ruleId: "shape_identity", puzzleType: "identity" },
    "Generated Shape Progression": { ruleId: "shape_progression", puzzleType: "progression" },
    "Size Progression": { ruleId: "size_progression", puzzleType: "progression" },
    "Rotation (+45°)": { ruleId: "rotation_progression", puzzleType: "progression" },
    "Generated Rotation Progression": { ruleId: "rotation_progression", puzzleType: "progression" },
    "Shape Distribution (Sudoku-like)": { ruleId: "shape_distribution", puzzleType: "distribution" },
    "Fill Alternation": { ruleId: "fill_alternation", puzzleType: "alternation" },
    "Generated Fill Alternation": { ruleId: "fill_alternation", puzzleType: "alternation" },
    "Generated Count Progression": { ruleId: "count_progression", puzzleType: "progression" },
    "Shape Addition": { ruleId: "shape_addition", puzzleType: "composition" },
    "Size Reduction": { ruleId: "size_reduction", puzzleType: "progression" },
    "Complex Progression": { ruleId: "complex_progression", puzzleType: "multi_rule" }
};

const RULE_LABELS = {
    shape_identity: "形状一致",
    shape_progression: "形状递进",
    size_progression: "尺寸递进",
    rotation_progression: "旋转递进",
    shape_distribution: "形状分布",
    fill_alternation: "填充交替",
    count_progression: "数量递进",
    shape_addition: "图形组合",
    size_reduction: "尺寸递减",
    complex_progression: "复合规则"
};

const RULE_FAMILY_LABELS = {
    shape_identity: "identity",
    shape_progression: "sequential_progression",
    size_progression: "sequential_progression",
    rotation_progression: "sequential_progression",
    shape_distribution: "distribution",
    fill_alternation: "alternation",
    count_progression: "sequential_progression",
    shape_addition: "composition",
    size_reduction: "sequential_progression",
    complex_progression: "multi_property_progression"
};

const ERROR_LABELS = {
    none: "无",
    shape_rule: "形状规则",
    size_rule: "尺寸规则",
    rotation_rule: "旋转规则",
    fill_rule: "填充规则",
    count_rule: "数量规则",
    composition_rule: "组合规则",
    multi_property: "多属性混淆",
    unknown: "未分类"
};

function getSeededRandomApi() {
    return typeof window !== "undefined" ? window.SeededRandom : null;
}

function fallbackHashString(value) {
    const text = String(value || "");
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i += 1) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function fallbackMulberry32(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function createFallbackSessionSeed(prefix) {
    if (typeof window !== "undefined" && window.location) {
        const params = new URLSearchParams(window.location.search);
        const urlSeed = params.get("seed");
        if (urlSeed && urlSeed.trim()) {
            return urlSeed.trim();
        }
    }

    let token = `${Math.floor(Math.random() * 1e9).toString(36)}`;
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
        const bytes = new Uint32Array(2);
        window.crypto.getRandomValues(bytes);
        token = `${bytes[0].toString(36)}${bytes[1].toString(36)}`;
    }

    return `${prefix}-${Date.now().toString(36)}-${token}`;
}

function createSessionSeed(prefix) {
    const seeded = getSeededRandomApi();
    if (seeded && typeof seeded.createSessionSeed === "function") {
        return seeded.createSessionSeed(prefix);
    }
    return createFallbackSessionSeed(prefix);
}

function createRng(seed) {
    const seeded = getSeededRandomApi();
    if (seeded && typeof seeded.createRngFromSeed === "function") {
        return seeded.createRngFromSeed(seed);
    }
    return fallbackMulberry32(fallbackHashString(seed));
}

function shuffleInPlace(list, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    for (let i = list.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function pickOne(list, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    return list[Math.floor(random() * list.length)];
}

function sampleUnique(list, count, rng) {
    return shuffleInPlace([...list], rng).slice(0, count);
}

function normalizeAngle(value) {
    return ((value % 360) + 360) % 360;
}

function getRuleFamily(ruleId, puzzleType) {
    return RULE_FAMILY_LABELS[ruleId] || puzzleType || "matrix_completion";
}

function buildTemplateId(level, index) {
    if (level.templateId) return level.templateId;
    if (level.ruleTemplateId) return level.ruleTemplateId;
    if (level.ruleId) return `${level.ruleId}_static_v1`;
    const meta = RULE_METADATA[level.rule] || {};
    return `${meta.ruleId || `rule_${index + 1}`}_static_v1`;
}

function buildAnswerRationale(level) {
    const ruleId = level.ruleId || (RULE_METADATA[level.rule] || {}).ruleId || "unknown_rule";
    const label = RULE_LABELS[ruleId] || level.rule || "矩阵规则";
    const parameterText = level.generated && level.parameters
        ? ` 参数化字段已保存：${Object.keys(level.parameters).sort().join("、") || "none"}。`
        : "";

    const rationaleByRule = {
        shape_identity: "每一行保持同一形状，缺失格延续第三行已出现的形状。",
        shape_progression: "形状按行列位置在模板序列中递进，缺失格由同一序列位置推出。",
        size_progression: "每行尺寸按列递增，缺失格取第三列对应尺寸。",
        rotation_progression: "同一行旋转角按固定步长变化，缺失格延续该角度步长。",
        shape_distribution: "每行和每列应覆盖同一组形状，缺失格补足未出现形状。",
        fill_alternation: "填充状态按行列奇偶交替，缺失格延续交替模式。",
        count_progression: "数量按列递进，缺失格取该行第三列数量。",
        shape_addition: "第三列由前两列视觉部件组合得到，缺失格应是组合结果。",
        size_reduction: "每行尺寸按列递减，缺失格取第三列对应尺寸。",
        complex_progression: "形状、填充与旋转同时按行列规则变化，缺失格需同时满足多个属性。"
    };

    return `${label}：${rationaleByRule[ruleId] || "缺失格由同一矩阵规则推导。"}${parameterText}`;
}

function buildDistractorRationale(level) {
    const ruleId = level.ruleId || (RULE_METADATA[level.rule] || {}).ruleId || "unknown_rule";
    const label = RULE_LABELS[ruleId] || level.rule || "矩阵规则";
    return `${label} 干扰项通过改变一个或多个关键属性生成，用于区分规则推理与固定答案记忆。`;
}

function createTemplateLevel(templateId, variantSeed, parameters, level) {
    return {
        ...level,
        templateId: `${templateId}_template_v1`,
        ruleTemplateId: `${templateId}_template_v1`,
        variantSeed,
        parameters,
        generated: true
    };
}

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

function buildShapeProgressionLevel(rng, variantSeed) {
    const shapes = sampleUnique(['square', 'circle', 'triangle', 'diamond', 'star'], 3, rng);
    const size = pickOne([28, 34, 40, 46], rng);
    const fill = pickOne(['solid', 'outline'], rng);
    const rowOffset = pickOne([0, 1, 2], rng);

    const cell = (row, col) => ({
        t: shapes[(row + col + rowOffset) % shapes.length],
        size,
        fill
    });

    return createTemplateLevel(
        "shape_progression",
        variantSeed,
        { shapes, size, fill, rowOffset },
        {
            matrix: [
                cell(0, 0), cell(0, 1), cell(0, 2),
                cell(1, 0), cell(1, 1), cell(1, 2),
                cell(2, 0), cell(2, 1), null
            ],
            answer: cell(2, 2),
            rule: "Generated Shape Progression"
        }
    );
}

function buildRotationProgressionLevel(rng, variantSeed) {
    const shape = pickOne(['triangle', 'star'], rng);
    const start = pickOne([0, 45, 90, 135], rng);
    const step = pickOne([45, 90], rng);
    const fill = pickOne(['solid', 'outline'], rng);
    const rowOffset = pickOne([0, step, step * 2], rng);

    const cell = (row, col) => ({
        t: shape,
        fill,
        rotate: normalizeAngle(start + (row * rowOffset) + (col * step))
    });

    return createTemplateLevel(
        "rotation_progression",
        variantSeed,
        { shape, start, step, fill, rowOffset },
        {
            matrix: [
                cell(0, 0), cell(0, 1), cell(0, 2),
                cell(1, 0), cell(1, 1), cell(1, 2),
                cell(2, 0), cell(2, 1), null
            ],
            answer: cell(2, 2),
            rule: "Generated Rotation Progression"
        }
    );
}

function buildFillAlternationLevel(rng, variantSeed) {
    const shapes = sampleUnique(['square', 'circle', 'triangle', 'diamond'], 3, rng);
    const startFill = pickOne(['solid', 'outline'], rng);
    const rowShift = pickOne([0, 1], rng);
    const size = pickOne([32, 36, 40], rng);

    const cell = (row, col) => ({
        t: shapes[(row + col) % shapes.length],
        size,
        fill: ((row + col + rowShift) % 2 === 0)
            ? startFill
            : (startFill === 'solid' ? 'outline' : 'solid')
    });

    return createTemplateLevel(
        "fill_alternation",
        variantSeed,
        { shapes, startFill, rowShift, size },
        {
            matrix: [
                cell(0, 0), cell(0, 1), cell(0, 2),
                cell(1, 0), cell(1, 1), cell(1, 2),
                cell(2, 0), cell(2, 1), null
            ],
            answer: cell(2, 2),
            rule: "Generated Fill Alternation"
        }
    );
}

function buildCountProgressionLevel(rng, variantSeed) {
    const shapes = sampleUnique(['circle', 'square', 'triangle', 'diamond'], 3, rng);
    const direction = pickOne(['ascending', 'descending'], rng);
    const counts = direction === 'ascending' ? [1, 2, 3] : [3, 2, 1];
    const fill = pickOne(['solid', 'outline'], rng);
    const size = pickOne([18, 20, 22], rng);

    const cell = (row, col) => ({
        t: shapes[row],
        count: counts[col],
        fill,
        size
    });

    return createTemplateLevel(
        "count_progression",
        variantSeed,
        { shapes, counts, direction, fill, size },
        {
            matrix: [
                cell(0, 0), cell(0, 1), cell(0, 2),
                cell(1, 0), cell(1, 1), cell(1, 2),
                cell(2, 0), cell(2, 1), null
            ],
            answer: cell(2, 2),
            rule: "Generated Count Progression"
        }
    );
}

function generateTemplateLevels(sessionSeed) {
    const templateRng = createRng(`${sessionSeed}:${CONTENT_VERSION}:template-pool`);
    const templateBuilders = [
        buildShapeProgressionLevel,
        buildRotationProgressionLevel,
        buildFillAlternationLevel,
        buildCountProgressionLevel
    ];
    const orderedBuilders = shuffleInPlace([...templateBuilders], templateRng);

    return orderedBuilders.map((builder, index) => {
        const templateId = builder.name.replace(/^build|Level$/g, "").replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
        const variantSeed = `${sessionSeed}:${CONTENT_VERSION}:${templateId}:${index}`;
        const variantRng = createRng(variantSeed);
        return builder(variantRng, variantSeed);
    });
}

function generateLevels(sessionSeed) {
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

    return levels.concat(generateTemplateLevels(sessionSeed || GAME_ID));
}

function enrichLevelMetadata(level, index) {
    const meta = RULE_METADATA[level.rule] || {};
    const ruleId = level.ruleId || meta.ruleId || `rule_${index + 1}`;
    const templateId = buildTemplateId({ ...level, ruleId }, index);
    const puzzleType = level.puzzleType || meta.puzzleType || "matrix_completion";
    return {
        ...level,
        ruleId,
        templateId,
        ruleTemplateId: level.ruleTemplateId || templateId,
        ruleFamily: level.ruleFamily || getRuleFamily(ruleId, puzzleType),
        puzzleType,
        variantSeed: level.variantSeed || null,
        parameters: level.parameters || {},
        generated: Boolean(level.generated),
        answerRationale: level.answerRationale || buildAnswerRationale({
            ...level,
            ruleId,
            puzzleType,
            templateId
        }),
        distractorRationale: level.distractorRationale || buildDistractorRationale({
            ...level,
            ruleId,
            puzzleType,
            templateId
        })
    };
}

function getCountPositions(count) {
    const layouts = {
        1: [[50, 50]],
        2: [[35, 50], [65, 50]],
        3: [[50, 32], [34, 64], [66, 64]],
        4: [[34, 34], [66, 34], [34, 66], [66, 66]]
    };
    return layouts[count] || layouts[4];
}

function drawMiniShape(type, x, y, size, fill, stroke, strokeWidth) {
    const half = size / 2;
    switch (type) {
        case 'square':
            return `<rect x="${x - half}" y="${y - half}" width="${size}" height="${size}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        case 'triangle': {
            const h = size * (Math.sqrt(3) / 2);
            return `<polygon points="${x},${y - h / 2} ${x - half},${y + h / 2} ${x + half},${y + h / 2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        }
        case 'diamond':
            return `<polygon points="${x},${y - half} ${x + half},${y} ${x},${y + half} ${x - half},${y}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
        case 'circle':
        default:
            return `<circle cx="${x}" cy="${y}" r="${half}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    }
}

function drawRepeatedShape(type, props) {
    const countValue = Number.isFinite(props.count) ? props.count : 1;
    const count = Math.max(1, Math.min(4, Math.floor(countValue)));
    const fill = props.fill === 'solid' ? '#2c3e50' : 'none';
    const stroke = '#2c3e50';
    const strokeWidth = 3;
    const size = props.size || (count > 2 ? 18 : 24);
    const content = getCountPositions(count)
        .map(([x, y]) => drawMiniShape(type, x, y, size, fill, stroke, strokeWidth))
        .join('');
    return createSVG(content);
}

// Enhance drawShape to handle Level 6 special types
const originalDrawShape = drawShape;
drawShape = function(type, props) {
    const cx = 50, cy = 50;
    const size = props.size || 40;
    const fill = props.fill === 'solid' ? '#2c3e50' : 'none';
    const stroke = '#2c3e50';

    if (Number.isFinite(props.count)) {
        return drawRepeatedShape(type, props);
    }
    
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
    GameState.sessionSeed = createSessionSeed(GAME_ID);
    GameState.rng = createRng(`${GameState.sessionSeed}:${CONTENT_VERSION}:options`);
    GameState.levels = generateLevels(GameState.sessionSeed).map(enrichLevelMetadata);
    GameState.totalLevels = GameState.levels.length;
    GameState.generatedTemplateCount = GameState.levels.filter(level => level.generated).length;
    GameState.currentLevel = 0;
    GameState.score = 0;
    GameState.userAnswers = [];
    GameState.trials = [];
    GameState.startedAt = new Date();
    GameState.levelStartedAt = null;
    GameState.sessionSaved = false;
    GameState.answerLocked = false;
    GameState.currentOptions = [];
    GameState.currentOptionValidation = null;
    GameState.currentOptionRationales = [];
    GameState.validationIssues = [];
    GameState.validationIssueCount = 0;
    
    renderLevel();
}

function normalizeRotation(type, rotate) {
    const value = Number.isFinite(rotate) ? rotate : 0;
    if (type === "circle") {
        return 0;
    }
    if (type === "square" || type === "diamond" || type === "cross") {
        return ((value % 90) + 90) % 90;
    }
    return ((value % 360) + 360) % 360;
}

function canonicalAnswer(answer) {
    const clean = serializeAnswer(answer);
    const type = clean.t || "";
    return {
        t: type,
        size: Number.isFinite(clean.size) ? clean.size : 40,
        fill: clean.fill || "outline",
        rotate: normalizeRotation(type, clean.rotate),
        count: Number.isFinite(clean.count) ? clean.count : null
    };
}

function answerKey(answer) {
    return JSON.stringify(canonicalAnswer(answer));
}

function createDistractorCandidates(answer) {
    const base = serializeAnswer(answer);
    const answerKeyValue = answerKey(base);
    const candidates = [];
    const seen = new Set();
    const shapes = ['square', 'circle', 'triangle', 'diamond', 'star', 'cross'];
    const fills = ['solid', 'outline'];
    const sizes = [20, 30, 40, 50, 60, 70];
    const rotations = [0, 45, 90, 135, 180];
    const counts = [1, 2, 3, 4];

    function addCandidate(patch) {
        const candidate = { ...base, ...patch };
        const key = answerKey(candidate);
        if (key === answerKeyValue || seen.has(key)) {
            return;
        }
        seen.add(key);
        candidates.push(candidate);
    }

    shapes.forEach(shape => addCandidate({ t: shape }));
    fills.forEach(fill => addCandidate({ fill }));
    sizes.forEach(size => addCandidate({ size }));
    rotations.forEach(rotate => addCandidate({ rotate }));

    shapes.forEach(shape => {
        fills.forEach(fill => addCandidate({ t: shape, fill }));
        sizes.forEach(size => addCandidate({ t: shape, size }));
    });

    fills.forEach(fill => {
        sizes.forEach(size => addCandidate({ fill, size }));
        rotations.forEach(rotate => addCandidate({ fill, rotate }));
    });

    if (Number.isFinite(base.count)) {
        shapes.forEach(shape => {
            counts.forEach(count => addCandidate({ t: shape, count }));
        });
    }

    return candidates;
}

function validateOptions(options, answer, levelIndex) {
    const issues = [];
    const answerKeyValue = answerKey(answer);
    const keyCounts = new Map();
    const matchingAnswerIndices = [];

    if (options.length !== OPTION_COUNT) {
        issues.push({
            type: "option_count_mismatch",
            level: levelIndex + 1,
            count: options.length
        });
    }

    options.forEach((option, index) => {
        const key = answerKey(option);
        keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
        if (key === answerKeyValue) {
            matchingAnswerIndices.push(index);
        }
        option.correct = false;
    });

    const duplicateVisualCount = Array.from(keyCounts.values()).filter(count => count > 1).length;
    if (duplicateVisualCount > 0) {
        issues.push({
            type: "duplicate_option_visuals",
            level: levelIndex + 1,
            count: duplicateVisualCount
        });
    }

    let correctOptionIndex = matchingAnswerIndices[0];
    if (matchingAnswerIndices.length === 0) {
        issues.push({
            type: "missing_correct_answer",
            level: levelIndex + 1,
            count: 0
        });
        correctOptionIndex = 0;
        options[correctOptionIndex] = { ...serializeAnswer(answer), correct: true };
    } else {
        if (matchingAnswerIndices.length > 1) {
            issues.push({
                type: "duplicate_correct_answer",
                level: levelIndex + 1,
                count: matchingAnswerIndices.length
            });
        }
        options[correctOptionIndex].correct = true;
    }

    const correctFlagCount = options.filter(option => option.correct).length;
    if (correctFlagCount !== 1) {
        issues.push({
            type: "correct_flag_count",
            level: levelIndex + 1,
            count: correctFlagCount
        });
        options.forEach((option, index) => {
            option.correct = index === correctOptionIndex;
        });
    }

    return {
        correctOptionIndex,
        issueCount: issues.length,
        issues
    };
}

function generateOptions(answer, levelIndex) {
    const rng = GameState.rng || Math.random;
    const candidates = createDistractorCandidates(answer);
    shuffleInPlace(candidates, rng);

    const options = [];
    const seen = new Set();

    function addOption(option, correct) {
        const key = answerKey(option);
        if (seen.has(key) || options.length >= OPTION_COUNT) {
            return;
        }
        seen.add(key);
        options.push({
            ...serializeAnswer(option),
            correct
        });
    }

    addOption(answer, true);
    candidates.forEach(candidate => addOption(candidate, false));

    shuffleInPlace(options, rng);
    const validation = validateOptions(options, answer, levelIndex);
    return { options, validation };
}

function renderLevel() {
    const level = GameState.levels[GameState.currentLevel];
    const gridEl = document.getElementById('matrix-grid');
    const optionsEl = document.getElementById('options-area');
    GameState.answerLocked = false;
    
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
    const optionResult = generateOptions(level.answer, GameState.currentLevel);
    const options = optionResult.options;
    GameState.currentOptions = options;
    GameState.currentOptionValidation = optionResult.validation;
    if (optionResult.validation.issueCount > 0) {
        const issues = optionResult.validation.issues.map(issue => ({
            ...issue,
            ruleId: level.ruleId,
            ruleTemplateId: level.ruleTemplateId,
            rule: level.rule,
            puzzleType: level.puzzleType,
            variantSeed: level.variantSeed
        }));
        GameState.validationIssues.push(...issues);
        GameState.validationIssueCount += issues.length;
    }

    optionsEl.innerHTML = '';
    options.forEach((opt, idx) => {
        const div = document.createElement('div');
        div.className = 'option-card';
        div.innerHTML = drawShape(opt.t, opt);
        div.onclick = () => checkAnswer(opt, idx);
        optionsEl.appendChild(div);
    });

    GameState.levelStartedAt = new Date();
}

function classifyError(selectedAnswer, correctAnswer, level) {
    if (answerKey(selectedAnswer) === answerKey(correctAnswer)) {
        return "none";
    }

    const selected = canonicalAnswer(selectedAnswer);
    const correct = canonicalAnswer(correctAnswer);
    const mismatches = [];

    if (selected.t !== correct.t) mismatches.push("shape_rule");
    if (selected.size !== correct.size) mismatches.push("size_rule");
    if (selected.rotate !== correct.rotate) mismatches.push("rotation_rule");
    if (selected.fill !== correct.fill) mismatches.push("fill_rule");
    if (selected.count !== correct.count) mismatches.push("count_rule");

    if (mismatches.length === 0) {
        return "unknown";
    }
    if (mismatches.length > 1) {
        return level.puzzleType === "composition" ? "composition_rule" : "multi_property";
    }
    if (level.puzzleType === "composition" && mismatches[0] === "shape_rule") {
        return "composition_rule";
    }
    return mismatches[0];
}

function checkAnswer(selectedOption, selectedOptionIndex) {
    if (GameState.answerLocked) {
        return;
    }

    GameState.answerLocked = true;

    const level = GameState.levels[GameState.currentLevel];
    const answeredAt = new Date();
    const levelStartedAt = GameState.levelStartedAt || GameState.startedAt || answeredAt;
    const startedAt = GameState.startedAt || levelStartedAt;
    const correct = Boolean(selectedOption.correct);
    const userAnswer = serializeAnswer(selectedOption);
    const correctAnswer = serializeAnswer(level.answer);
    const validation = GameState.currentOptionValidation || {};
    const correctOptionIndex = Number.isInteger(validation.correctOptionIndex)
        ? validation.correctOptionIndex
        : GameState.currentOptions.findIndex(option => option.correct);
    const optionCount = GameState.currentOptions.length;
    const errorType = correct ? "none" : classifyError(selectedOption, level.answer, level);
    const rtMs = Math.max(0, answeredAt.getTime() - levelStartedAt.getTime());

    GameState.userAnswers.push(userAnswer);
    GameState.trials.push({
        level: GameState.currentLevel + 1,
        ruleId: level.ruleId,
        ruleTemplateId: level.ruleTemplateId,
        rule: level.rule,
        puzzleType: level.puzzleType,
        variantSeed: level.variantSeed,
        parameters: { ...level.parameters },
        generated: Boolean(level.generated),
        optionCount,
        correctOptionIndex,
        selectedOptionIndex,
        validationIssueCount: validation.issueCount || 0,
        errorType,
        userAnswer,
        correctAnswer,
        correct,
        rtMs,
        elapsedMs: Math.max(0, answeredAt.getTime() - startedAt.getTime())
    });

    if (correct) {
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

function serializeAnswer(answer) {
    const result = {};
    if (!answer || typeof answer !== "object") {
        return result;
    }

    Object.keys(answer).forEach(key => {
        if (key !== "correct") {
            result[key] = answer[key];
        }
    });

    return result;
}

function buildRuleBreakdown(trials) {
    const byRule = new Map();
    trials.forEach(trial => {
        const key = trial.ruleId || trial.rule || "unknown_rule";
        if (!byRule.has(key)) {
            byRule.set(key, {
                ruleId: key,
                rule: trial.rule || key,
                puzzleType: trial.puzzleType || "matrix_completion",
                totalTrials: 0,
                correctCount: 0,
                errorTypes: {}
            });
        }

        const item = byRule.get(key);
        item.totalTrials += 1;
        if (trial.correct) {
            item.correctCount += 1;
        }
        if (trial.errorType && trial.errorType !== "none") {
            item.errorTypes[trial.errorType] = (item.errorTypes[trial.errorType] || 0) + 1;
        }
    });

    return Array.from(byRule.values()).map(item => ({
        ...item,
        accuracy: item.totalTrials > 0 ? item.correctCount / item.totalTrials : 0
    }));
}

function buildAccuracyByRule(ruleBreakdown) {
    return ruleBreakdown.reduce((result, item) => {
        result[item.ruleId] = item.accuracy;
        return result;
    }, {});
}

function buildTemplateBreakdown(trials) {
    const byTemplate = new Map();
    trials.forEach(trial => {
        const key = trial.ruleTemplateId || trial.ruleId || "unknown_template";
        if (!byTemplate.has(key)) {
            byTemplate.set(key, {
                ruleTemplateId: key,
                ruleId: trial.ruleId || "unknown_rule",
                rule: trial.rule || key,
                puzzleType: trial.puzzleType || "matrix_completion",
                totalTrials: 0,
                correctCount: 0
            });
        }

        const item = byTemplate.get(key);
        item.totalTrials += 1;
        if (trial.correct) {
            item.correctCount += 1;
        }
    });

    return Array.from(byTemplate.values()).map(item => ({
        ...item,
        accuracy: item.totalTrials > 0 ? item.correctCount / item.totalTrials : 0
    }));
}

function buildAccuracyByTemplate(templateBreakdown) {
    return templateBreakdown.reduce((result, item) => {
        result[item.ruleTemplateId] = item.accuracy;
        return result;
    }, {});
}

function buildErrorBreakdown(trials) {
    return trials.reduce((result, trial) => {
        const key = trial.errorType || "unknown";
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}

function sortEntriesByCount(entries) {
    return entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function summarizeRules(ruleBreakdown) {
    const labels = ruleBreakdown.map(item => RULE_LABELS[item.ruleId] || item.rule);
    return labels.slice(0, 4).join("、");
}

function summarizeErrors(errorBreakdown) {
    const entries = sortEntriesByCount(Object.entries(errorBreakdown).filter(([key]) => key !== "none"));
    if (entries.length === 0) {
        return "未见明显错误类型";
    }
    return entries.slice(0, 2).map(([key, count]) => `${ERROR_LABELS[key] || key} ${count} 次`).join("、");
}

function buildSessionStats() {
    const totalTrials = GameState.trials.length;
    const correctCount = GameState.trials.filter(trial => trial.correct).length;
    const accuracy = totalTrials > 0 ? correctCount / totalTrials : 0;
    const ruleBreakdown = buildRuleBreakdown(GameState.trials);
    const accuracyByRule = buildAccuracyByRule(ruleBreakdown);
    const templateBreakdown = buildTemplateBreakdown(GameState.trials);
    const accuracyByTemplate = buildAccuracyByTemplate(templateBreakdown);
    const errorBreakdown = buildErrorBreakdown(GameState.trials);

    return {
        totalTrials,
        correctCount,
        accuracy,
        ruleBreakdown,
        accuracyByRule,
        templateBreakdown,
        accuracyByTemplate,
        errorBreakdown,
        generatedTemplateCount: GameState.generatedTemplateCount,
        validationIssueCount: GameState.validationIssueCount,
        seed: GameState.sessionSeed,
        contentVersion: CONTENT_VERSION
    };
}

function buildPerformanceFeedback(stats) {
    const ruleText = summarizeRules(stats.ruleBreakdown);
    const errorText = summarizeErrors(stats.errorBreakdown);
    const validationText = stats.validationIssueCount > 0
        ? `选项校验记录 ${stats.validationIssueCount} 个问题，已写入本次结果。`
        : "选项校验未发现重复正确项。";
    return `本轮主要覆盖 ${ruleText || "矩阵推理"}；错误类型：${errorText}。${validationText} 这些记录用于复盘本轮练习，不代表稳定能力评估。`;
}

function saveTrainingResult(finishedAt) {
    if (GameState.sessionSaved || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") {
        return;
    }

    GameState.sessionSaved = true;

    const startedAt = GameState.startedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    const totalLevels = GameState.levels.length;
    const stats = buildSessionStats();
    const score = GameState.score;

    try {
        window.TrainingResults.saveSession({
            moduleId: GAME_ID,
            gameId: GAME_ID,
            gameName: GAME_NAME,
            seed: stats.seed,
            contentVersion: stats.contentVersion,
            startedAt,
            finishedAt,
            durationMs,
            score,
            summary: {
                totalTrials: stats.totalTrials,
                totalLevels,
                correctCount: stats.correctCount,
                accuracy: stats.accuracy,
                score,
                ruleBreakdown: stats.ruleBreakdown,
                accuracyByRule: stats.accuracyByRule,
                templateBreakdown: stats.templateBreakdown,
                accuracyByTemplate: stats.accuracyByTemplate,
                errorBreakdown: stats.errorBreakdown,
                generatedTemplateCount: stats.generatedTemplateCount,
                validationIssueCount: stats.validationIssueCount,
                seed: stats.seed,
                contentVersion: stats.contentVersion
            },
            trials: GameState.trials.map(trial => ({
                ...trial,
                userAnswer: { ...trial.userAnswer },
                correctAnswer: { ...trial.correctAnswer }
            })),
            metrics: {
                score,
                accuracy: stats.accuracy,
                accuracyPercent: `${Math.round(stats.accuracy * 100)}%`,
                correctCount: stats.correctCount,
                totalTrials: stats.totalTrials,
                ruleBreakdown: stats.ruleBreakdown,
                accuracyByRule: stats.accuracyByRule,
                templateBreakdown: stats.templateBreakdown,
                accuracyByTemplate: stats.accuracyByTemplate,
                generatedTemplateCount: stats.generatedTemplateCount,
                validationIssueCount: stats.validationIssueCount,
                seed: stats.seed,
                contentVersion: stats.contentVersion
            },
            validationIssues: GameState.validationIssues.map(issue => ({ ...issue })),
            tags: ["reasoning", "raven"]
        });
    } catch (error) {
        console.error("Failed to save Raven training result", error);
    }
}

function gameOver() {
    const modal = document.getElementById('result-modal');
    const score = GameState.score;
    const stats = buildSessionStats();
    const accuracy = Math.round(stats.accuracy * 100);
    const finishedAt = new Date();

    document.getElementById('final-score').textContent = score;
    document.getElementById('final-accuracy').textContent = `${accuracy}%`;

    document.getElementById('performance-feedback').textContent = buildPerformanceFeedback(stats);
    modal.classList.remove('hidden');
    saveTrainingResult(finishedAt);
    
    // Final progress bar update
    document.getElementById('progress-bar').style.width = '100%';
}

// Start Game
window.onload = initGame;
