const STIMULI = ['F', 'R', 'G', 'L', 'P', '4', '7', 'J', 'S', 'k'];
const ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const ANGLE_DIFFS = [0, 45, 90, 135, 180];
const REPEATS_PER_CONDITION = 2;
const TOTAL_ROUNDS = ANGLE_DIFFS.length * 2 * REPEATS_PER_CONDITION;
const ADAPTIVE_BLOCK_SIZE = 5;
const ADAPTIVE_LEVELS = [
    { level: 0, label: '低角度校准', angleSet: [0, 45, 90], mirrorRatio: 0.3 },
    { level: 1, label: '中角度扩展', angleSet: [0, 45, 90, 135], mirrorRatio: 0.4 },
    { level: 2, label: '全角度平衡', angleSet: [0, 45, 90, 135, 180], mirrorRatio: 0.5 },
    { level: 3, label: '大角度镜像强化', angleSet: [45, 90, 135, 180], mirrorRatio: 0.6 }
];
const INITIAL_ADAPTIVE_LEVEL_INDEX = 0;
const MIN_MIRROR_RATIO = 0.2;
const MAX_MIRROR_RATIO = 0.7;
const GAME_ID = 'mental-rotation';
const GAME_NAME = '心理旋转测试';
const CONTENT_VERSION = 'mental-rotation-adaptive-spatial-v2';

let currentRound = 0;
let correctCount = 0;
let reactionTimes = [];
let trialPlan = [];
let trialData = []; // { angleDiff, mirror, response, correct, rtMs, condition, stimulusId }
let isGameActive = false;
let canRespond = false;
let sessionStartedAt = null;
let hasSavedSession = false;
let startTime = 0;
let currentTrial = {};
let sessionSeed = '';
let isAdaptiveMode = true;
let adaptiveLevelIndex = INITIAL_ADAPTIVE_LEVEL_INDEX;
let currentAngleSet = ADAPTIVE_LEVELS[INITIAL_ADAPTIVE_LEVEL_INDEX].angleSet.slice();
let currentMirrorRatio = ADAPTIVE_LEVELS[INITIAL_ADAPTIVE_LEVEL_INDEX].mirrorRatio;
let adaptationEvents = [];
let angleSetProgression = [];
let mirrorRatioProgression = [];
let blockSummaries = [];
let lastSummarizedBlockIndex = -1;

function fallbackHashString(value) {
    const text = String(value || '');
    let hash = 2166136261 >>> 0;
    for (let i = 0; i < text.length; i++) {
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

function createSessionSeed() {
    if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === 'function') {
        return window.SeededRandom.createSessionSeed(GAME_ID);
    }

    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get('seed');
    if (urlSeed && urlSeed.trim()) {
        return urlSeed.trim();
    }
    return `${GAME_ID}-${Date.now().toString(36)}`;
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === 'function') {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return fallbackMulberry32(fallbackHashString(seed));
}

function shuffleInPlace(list, rng) {
    if (window.SeededRandom && typeof window.SeededRandom.shuffleInPlace === 'function') {
        return window.SeededRandom.shuffleInPlace(list, rng);
    }

    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

function pickFrom(list, rng) {
    return list[Math.floor(rng() * list.length)];
}

function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}

function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function cloneAngleSet(angleSet) {
    return Array.isArray(angleSet) ? angleSet.slice().sort((a, b) => a - b) : [];
}

function formatAngleSet(angleSet) {
    return cloneAngleSet(angleSet).map((angle) => `${angle}°`).join('/');
}

function getAdaptiveProfile(index = adaptiveLevelIndex) {
    const safeIndex = clampNumber(index, 0, ADAPTIVE_LEVELS.length - 1);
    return ADAPTIVE_LEVELS[safeIndex];
}

function getAdaptiveModeSetting() {
    const adaptiveInput = document.getElementById('adaptive-mode');
    return adaptiveInput ? Boolean(adaptiveInput.checked) : true;
}

function updateAdaptiveStatus() {
    const statusEl = document.getElementById('adaptive-status');
    if (!statusEl) return;

    if (!isAdaptiveMode) {
        statusEl.textContent = '固定平衡';
        return;
    }

    const profile = getAdaptiveProfile();
    statusEl.textContent = `${profile.label} ${formatAngleSet(currentAngleSet)} 镜像${formatPercent(currentMirrorRatio)}`;
}

function resetAdaptiveState() {
    adaptiveLevelIndex = INITIAL_ADAPTIVE_LEVEL_INDEX;
    const profile = getAdaptiveProfile();
    currentAngleSet = cloneAngleSet(profile.angleSet);
    currentMirrorRatio = profile.mirrorRatio;
    adaptationEvents = [];
    angleSetProgression = [];
    mirrorRatioProgression = [];
    blockSummaries = [];
    lastSummarizedBlockIndex = -1;
}

function recordAdaptiveProgression(afterTrial, reason) {
    const profile = getAdaptiveProfile();
    angleSetProgression.push({
        afterTrial,
        nextBlock: Math.floor(afterTrial / ADAPTIVE_BLOCK_SIZE) + 1,
        level: adaptiveLevelIndex,
        label: profile.label,
        angleSet: cloneAngleSet(currentAngleSet),
        reason
    });
    mirrorRatioProgression.push({
        afterTrial,
        nextBlock: Math.floor(afterTrial / ADAPTIVE_BLOCK_SIZE) + 1,
        mirrorRatio: roundMetric(currentMirrorRatio, 2),
        reason
    });
}

function buildAngleSequence(angleSet, size, rng) {
    const sourceAngles = cloneAngleSet(angleSet.length ? angleSet : ANGLE_DIFFS);
    const sequence = [];
    while (sequence.length < size) {
        sequence.push(...shuffleInPlace(sourceAngles.slice(), rng));
    }
    return sequence.slice(0, size);
}

function buildMirrorSequence(size, mirrorRatio, rng) {
    let mirrorCount = Math.round(size * mirrorRatio);
    if (size >= 2) {
        mirrorCount = clampNumber(mirrorCount, 1, size - 1);
    } else {
        mirrorCount = clampNumber(mirrorCount, 0, size);
    }

    const sequence = [
        ...Array.from({ length: mirrorCount }, () => true),
        ...Array.from({ length: size - mirrorCount }, () => false)
    ];
    return shuffleInPlace(sequence, rng);
}

function createTrial({ trialIndex, angleDiff, mirror, stimulus, rng, blockIndex = null }) {
    const angle1 = pickFrom(ANGLES, rng);
    const direction = rng() < 0.5 ? 1 : -1;
    const angle2 = normalizeAngle(angle1 + (direction * angleDiff));
    const profile = getAdaptiveProfile();

    return {
        trialIndex,
        blockIndex,
        blockNumber: blockIndex === null ? null : blockIndex + 1,
        angleDiff,
        mirror,
        stimulus,
        stimulusId: `glyph-${stimulus}`,
        angle1,
        angle2,
        expectedAnswer: mirror ? 'different' : 'same',
        condition: `${mirror ? 'mirror' : 'nonMirror'}_${angleDiff}`,
        adaptiveMode: isAdaptiveMode,
        difficultyLevel: isAdaptiveMode ? adaptiveLevelIndex : null,
        difficultyLabel: isAdaptiveMode ? profile.label : '固定平衡',
        angleSet: isAdaptiveMode ? cloneAngleSet(currentAngleSet) : cloneAngleSet(ANGLE_DIFFS),
        mirrorRatio: isAdaptiveMode ? roundMetric(currentMirrorRatio, 2) : 0.5
    };
}

function buildAdaptiveBlock(seed, blockIndex, startTrialIndex) {
    const remainingTrials = TOTAL_ROUNDS - startTrialIndex;
    const blockSize = Math.min(ADAPTIVE_BLOCK_SIZE, remainingTrials);
    const rng = createRng(`${seed}:${CONTENT_VERSION}:adaptive-block:${blockIndex}:${currentAngleSet.join('-')}:${currentMirrorRatio}`);
    const angleSequence = buildAngleSequence(currentAngleSet, blockSize, rng);
    const mirrorSequence = buildMirrorSequence(blockSize, currentMirrorRatio, rng);
    const stimulusPool = shuffleInPlace(
        Array.from({ length: blockSize }, (_, index) => STIMULI[(startTrialIndex + index) % STIMULI.length]),
        rng
    );

    return Array.from({ length: blockSize }, (_, index) => createTrial({
        trialIndex: startTrialIndex + index,
        blockIndex,
        angleDiff: angleSequence[index],
        mirror: mirrorSequence[index],
        stimulus: stimulusPool[index],
        rng
    }));
}

function buildTrialPlan(seed) {
    const rng = createRng(`${seed}:${CONTENT_VERSION}:trial-plan`);
    const plan = [];
    const stimulusPool = shuffleInPlace(
        Array.from({ length: TOTAL_ROUNDS }, (_, index) => STIMULI[index % STIMULI.length]),
        rng
    );

    ANGLE_DIFFS.forEach((angleDiff) => {
        [false, true].forEach((mirror) => {
            for (let repeat = 0; repeat < REPEATS_PER_CONDITION; repeat++) {
                const stimulus = stimulusPool[plan.length];
                plan.push(createTrial({
                    trialIndex: plan.length,
                    blockIndex: Math.floor(plan.length / ADAPTIVE_BLOCK_SIZE),
                    angleDiff,
                    mirror,
                    stimulus,
                    rng
                }));
            }
        });
    });

    shuffleInPlace(plan, rng);
    return plan.map((trial, index) => ({
        ...trial,
        trialIndex: index
    }));
}

function startGame() {
    currentRound = 0;
    correctCount = 0;
    reactionTimes = [];
    sessionSeed = createSessionSeed();
    isAdaptiveMode = getAdaptiveModeSetting();
    resetAdaptiveState();
    if (isAdaptiveMode) {
        recordAdaptiveProgression(0, 'adaptive-session-start');
        trialPlan = buildAdaptiveBlock(sessionSeed, 0, 0);
    } else {
        trialPlan = buildTrialPlan(sessionSeed);
    }
    trialData = [];
    isGameActive = true;
    canRespond = false;
    sessionStartedAt = new Date();
    hasSavedSession = false;
    const adaptiveInput = document.getElementById('adaptive-mode');
    if (adaptiveInput) adaptiveInput.disabled = true;
    
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('mr-display').style.display = 'flex';
    document.getElementById('result-modal').style.display = 'none';
    
    updateAdaptiveStatus();
    updateScore();
    nextRound();
}

function nextRound() {
    if (currentRound >= trialPlan.length) {
        endGame();
        return;
    }
    
    currentTrial = trialPlan[currentRound];
    currentRound++;
    document.getElementById('round').textContent = `${currentRound}/${TOTAL_ROUNDS}`;
    updateAdaptiveStatus();
    
    // Render
    const left = document.getElementById('stim-left');
    const right = document.getElementById('stim-right');
    
    left.textContent = currentTrial.stimulus;
    right.textContent = currentTrial.stimulus;
    
    // Reset transitions to avoid animation during setup
    left.style.transition = 'none';
    right.style.transition = 'none';
    
    // Apply transforms
    left.style.transform = `rotate(${currentTrial.angle1}deg)`;
    
    if (currentTrial.mirror) {
        // Mirror image (flip horizontal)
        // We apply scaleX(-1) to flip it. 
        // Note: rotate() then scaleX() vs scaleX() then rotate().
        // We want the object to be a mirror image, then rotated to angle2.
        // CSS transform order is right-to-left (or effectively applied in order).
        // transform: rotate(angle) scaleX(-1) means: Flip first, then Rotate.
        // Wait, standard CSS is: transform: A B C -> Apply C, then B, then A?
        // No, it's applied left to right in the coordinate system, or right to left on the object.
        // Let's stick to: rotate(angle2 deg) scaleX(-1). This rotates the flipped object.
        right.style.transform = `rotate(${currentTrial.angle2}deg) scaleX(-1)`;
    } else {
        right.style.transform = `rotate(${currentTrial.angle2}deg)`;
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

    const isCorrect = choice === currentTrial.expectedAnswer;
    
    const display = document.getElementById('mr-display');
    const savedTrial = {
        trialIndex: currentRound - 1,
        angleDiff: currentTrial.angleDiff,
        angle: currentTrial.angleDiff,
        mirror: currentTrial.mirror,
        response: choice,
        correct: isCorrect,
        rtMs: rt,
        condition: currentTrial.condition,
        stimulusId: currentTrial.stimulusId,
        stimulus: currentTrial.stimulus,
        angle1: currentTrial.angle1,
        angle2: currentTrial.angle2,
        expectedAnswer: currentTrial.expectedAnswer,
        correctAnswer: currentTrial.expectedAnswer,
        blockIndex: currentTrial.blockIndex,
        blockNumber: currentTrial.blockNumber,
        adaptiveMode: currentTrial.adaptiveMode,
        difficultyLevel: currentTrial.difficultyLevel,
        difficultyLabel: currentTrial.difficultyLabel,
        angleSet: cloneAngleSet(currentTrial.angleSet),
        mirrorRatio: currentTrial.mirrorRatio,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    };
    
    if (isCorrect) {
        correctCount++;
        reactionTimes.push(rt);
        display.style.borderColor = '#2ecc71';
    } else {
        display.style.borderColor = '#e74c3c';
    }

    trialData.push(savedTrial);
    maybeAdjustDifficulty(trialData.length);
    
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

function mean(values) {
    const validValues = values.filter((value) => Number.isFinite(value));
    if (validValues.length === 0) return 0;
    return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
}

function roundMetric(value, digits = 3) {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function calculateSlope() {
    // Linear regression of RT vs Angle for correct trials
    const correctTrials = trialData.filter(t => t.correct);
    if (correctTrials.length < 2) return 0;
    
    const n = correctTrials.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    
    for (let t of correctTrials) {
        sumX += t.angleDiff;
        const rt = Number.isFinite(t.rtMs) ? t.rtMs : t.rt;
        sumY += rt;
        sumXY += t.angleDiff * rt;
        sumXX += t.angleDiff * t.angleDiff;
    }
    
    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return 0;
    const slope = (n * sumXY - sumX * sumY) / denominator;
    return roundMetric(slope, 2);
}

function buildByAngleMetric(metricBuilder) {
    return ANGLE_DIFFS.reduce((result, angleDiff) => {
        const angleTrials = trialData.filter((trial) => trial.angleDiff === angleDiff);
        result[angleDiff] = metricBuilder(angleTrials);
        return result;
    }, {});
}

function getAccuracy(trials) {
    if (trials.length === 0) return 0;
    return roundMetric(trials.filter((trial) => trial.correct).length / trials.length, 3);
}

function getMeanCorrectRt(trials) {
    return mean(trials.filter((trial) => trial.correct).map((trial) => trial.rtMs));
}

function buildByAngleMetricForTrials(trials, metricBuilder) {
    return ANGLE_DIFFS.reduce((result, angleDiff) => {
        const angleTrials = trials.filter((trial) => trial.angleDiff === angleDiff);
        if (angleTrials.length > 0) {
            result[angleDiff] = metricBuilder(angleTrials);
        }
        return result;
    }, {});
}

function summarizeBlock(blockTrials, blockIndex) {
    const mirrorTrials = blockTrials.filter((trial) => trial.mirror);
    const nonMirrorTrials = blockTrials.filter((trial) => !trial.mirror);
    const correctTrials = blockTrials.filter((trial) => trial.correct);
    const angleSet = cloneAngleSet(Array.from(new Set(blockTrials.map((trial) => trial.angleDiff))));
    const mirrorRatio = blockTrials.length ? mirrorTrials.length / blockTrials.length : 0;
    const summary = {
        blockIndex,
        blockNumber: blockIndex + 1,
        startTrial: blockTrials.length ? blockTrials[0].trialIndex + 1 : 0,
        endTrial: blockTrials.length ? blockTrials[blockTrials.length - 1].trialIndex + 1 : 0,
        totalTrials: blockTrials.length,
        correctCount: correctTrials.length,
        mirrorTrials: mirrorTrials.length,
        nonMirrorTrials: nonMirrorTrials.length,
        accuracy: getAccuracy(blockTrials),
        meanRtMs: getMeanCorrectRt(blockTrials),
        accuracyByAngle: buildByAngleMetricForTrials(blockTrials, getAccuracy),
        meanRtByAngle: buildByAngleMetricForTrials(blockTrials, getMeanCorrectRt),
        mirrorAccuracy: getAccuracy(mirrorTrials),
        nonMirrorAccuracy: getAccuracy(nonMirrorTrials),
        mirrorRatio: roundMetric(mirrorRatio, 2),
        angleSet,
        angleSlopeMsPerDegree: calculateSlopeForTrials(blockTrials)
    };
    return summary;
}

function calculateSlopeForTrials(trials) {
    const correctTrials = trials.filter((trial) => trial.correct);
    if (correctTrials.length < 2) return 0;

    const n = correctTrials.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    correctTrials.forEach((trial) => {
        sumX += trial.angleDiff;
        sumY += trial.rtMs;
        sumXY += trial.angleDiff * trial.rtMs;
        sumXX += trial.angleDiff * trial.angleDiff;
    });

    const denominator = (n * sumXX - sumX * sumX);
    if (denominator === 0) return 0;
    return roundMetric((n * sumXY - sumX * sumY) / denominator, 2);
}

function getAdaptiveDecision(blockSummary) {
    const lowAngles = blockSummary.angleSet.filter((angle) => angle <= 90);
    const lowAngleTrials = trialData.filter((trial) => trial.blockIndex === blockSummary.blockIndex && trial.angleDiff <= 90);
    const lowAngleAccuracy = getAccuracy(lowAngleTrials);
    const highAngleAccuracy = getAccuracy(trialData.filter((trial) => trial.blockIndex === blockSummary.blockIndex && trial.angleDiff >= 135));
    const stableLowAngles = lowAngles.length > 0 && lowAngleAccuracy >= 0.8 && blockSummary.meanRtMs <= 3500;
    const mirrorWeak = blockSummary.mirrorTrials > 0 && blockSummary.mirrorAccuracy < blockSummary.nonMirrorAccuracy - 0.15;
    const angleWeak = blockSummary.angleSlopeMsPerDegree >= 3 || (highAngleAccuracy > 0 && highAngleAccuracy < 0.65);
    const fromLevel = adaptiveLevelIndex;
    let toLevel = adaptiveLevelIndex;
    let toMirrorRatio = currentMirrorRatio;
    let direction = 'hold';
    let reason = '最近一组表现处于训练区间，维持当前角度和镜像比例。';

    if (blockSummary.accuracy >= 0.82 && stableLowAngles && blockSummary.mirrorAccuracy >= 0.7) {
        toLevel = clampNumber(adaptiveLevelIndex + 1, 0, ADAPTIVE_LEVELS.length - 1);
        toMirrorRatio = clampNumber(currentMirrorRatio + 0.1, MIN_MIRROR_RATIO, MAX_MIRROR_RATIO);
        direction = toLevel > adaptiveLevelIndex ? 'increase-angle-and-mirror' : 'increase-mirror';
        reason = '低角度准确且反应稳定，下一组增加大角度和镜像转换负荷。';
    } else if (blockSummary.accuracy < 0.62 || angleWeak) {
        toLevel = clampNumber(adaptiveLevelIndex - 1, 0, ADAPTIVE_LEVELS.length - 1);
        toMirrorRatio = clampNumber(currentMirrorRatio - 0.1, MIN_MIRROR_RATIO, MAX_MIRROR_RATIO);
        direction = toLevel < adaptiveLevelIndex ? 'decrease-angle-and-mirror' : 'decrease-mirror';
        reason = '角度负荷或总体错误偏高，下一组回到更低角度并减少镜像比例。';
    } else if (mirrorWeak) {
        toMirrorRatio = clampNumber(currentMirrorRatio - 0.1, MIN_MIRROR_RATIO, MAX_MIRROR_RATIO);
        direction = 'decrease-mirror';
        reason = '镜像转换正确率弱于非镜像题，下一组先降低镜像比例巩固翻转判断。';
    }

    return {
        fromLevel,
        toLevel,
        fromAngleSet: cloneAngleSet(currentAngleSet),
        toAngleSet: cloneAngleSet(getAdaptiveProfile(toLevel).angleSet),
        fromMirrorRatio: roundMetric(currentMirrorRatio, 2),
        toMirrorRatio: roundMetric(toMirrorRatio, 2),
        direction,
        reason
    };
}

function maybeAdjustDifficulty(completedTrials) {
    if (!isAdaptiveMode || completedTrials === 0 || completedTrials >= TOTAL_ROUNDS) return;
    if (completedTrials % ADAPTIVE_BLOCK_SIZE !== 0) return;

    const blockIndex = Math.floor(completedTrials / ADAPTIVE_BLOCK_SIZE) - 1;
    if (blockIndex <= lastSummarizedBlockIndex) return;

    const blockTrials = trialData.slice(completedTrials - ADAPTIVE_BLOCK_SIZE, completedTrials);
    const blockSummary = summarizeBlock(blockTrials, blockIndex);
    const decision = getAdaptiveDecision(blockSummary);
    blockSummaries.push(blockSummary);

    adaptiveLevelIndex = decision.toLevel;
    currentAngleSet = cloneAngleSet(decision.toAngleSet);
    currentMirrorRatio = decision.toMirrorRatio;
    lastSummarizedBlockIndex = blockIndex;

    const event = {
        afterTrial: completedTrials,
        nextBlock: blockIndex + 2,
        direction: decision.direction,
        reason: decision.reason,
        fromLevel: decision.fromLevel,
        toLevel: decision.toLevel,
        fromAngleSet: decision.fromAngleSet,
        toAngleSet: decision.toAngleSet,
        fromMirrorRatio: decision.fromMirrorRatio,
        toMirrorRatio: decision.toMirrorRatio,
        blockSummary
    };
    adaptationEvents.push(event);
    recordAdaptiveProgression(completedTrials, decision.reason);

    trialPlan.push(...buildAdaptiveBlock(sessionSeed, blockIndex + 1, completedTrials));
    updateAdaptiveStatus();
}

function buildAngleEffect(summary) {
    const firstAngle = ANGLE_DIFFS[0];
    const lastAngle = ANGLE_DIFFS[ANGLE_DIFFS.length - 1];
    const firstRt = summary.meanRtByAngle[firstAngle] || 0;
    const lastRt = summary.meanRtByAngle[lastAngle] || 0;
    const firstAccuracy = summary.accuracyByAngle[firstAngle] || 0;
    const lastAccuracy = summary.accuracyByAngle[lastAngle] || 0;
    const rtIncreaseMs = firstRt > 0 && lastRt > 0 ? lastRt - firstRt : 0;
    const accuracyDrop = roundMetric(firstAccuracy - lastAccuracy, 3);
    const slowerWithAngle = summary.angleSlopeMsPerDegree >= 2 && rtIncreaseMs >= 150;
    const lessAccurateWithAngle = accuracyDrop >= 0.15;

    return {
        rtIncreaseMs,
        accuracyDrop,
        slowerWithAngle,
        lessAccurateWithAngle,
        firstAngle,
        lastAngle
    };
}

function buildFeedback(summary) {
    const angleEffect = buildAngleEffect(summary);
    const finalAngleSetText = summary.finalAngleSet && summary.finalAngleSet.length
        ? formatAngleSet(summary.finalAngleSet)
        : formatAngleSet(ANGLE_DIFFS);
    let feedback = "";

    if (summary.accuracy >= 0.85) feedback = "整体正确率高，判断质量稳定。";
    else if (summary.accuracy >= 0.7) feedback = "整体正确率尚可，继续在速度和准确之间保持平衡。";
    else feedback = "正确率偏低，下一轮先放慢确认镜像关系，再逐步提速。";

    if (angleEffect.slowerWithAngle && angleEffect.lessAccurateWithAngle) {
        feedback += ` 角度从 ${angleEffect.firstAngle}° 到 ${angleEffect.lastAngle}° 时明显变慢且更容易出错，心理旋转负荷较清楚。`;
    } else if (angleEffect.slowerWithAngle) {
        feedback += ` 角度越大反应明显变慢，斜率约 ${summary.angleSlopeMsPerDegree} ms/度，但正确率下降不明显。`;
    } else if (angleEffect.lessAccurateWithAngle) {
        feedback += " 大角度题更容易出错，但反应时间斜率不明显，建议优先提高大角度判断稳定性。";
    } else {
        feedback += " 本轮没有看到角度越大明显变慢或变错，可能是训练效果好，也可能是样本量较小或答题策略偏随机。";
    }

    if (summary.mirrorAccuracy < summary.nonMirrorAccuracy - 0.15) {
        feedback += " 镜像题正确率低于非镜像题，下一轮重点练左右翻转识别。";
    }

    if (summary.meanRtMs >= 2500 && summary.accuracy >= 0.8) {
        feedback += " 速度-准确权衡偏保守：正确率尚可，但平均反应偏慢，可在确认轮廓后更快作答。";
    } else if (summary.meanRtMs < 900 && summary.accuracy < 0.7) {
        feedback += " 速度-准确权衡偏冒进：反应很快但错误偏多，需要先稳定空间转换。";
    }

    if (summary.isAdaptive) {
        feedback += ` 自适应记录 ${summary.adaptationEvents.length} 次调整，最终训练角度 ${finalAngleSetText}，镜像比例 ${formatPercent(summary.finalMirrorRatio)}。`;
    }

    return feedback;
}

function ensureBlockSummaries() {
    const blockIndexes = Array.from(new Set(
        trialData
            .map((trial) => trial.blockIndex)
            .filter((value) => Number.isFinite(value))
    )).sort((a, b) => a - b);

    blockIndexes.forEach((blockIndex) => {
        if (blockSummaries.some((summary) => summary.blockIndex === blockIndex)) return;
        const blockTrials = trialData.filter((trial) => trial.blockIndex === blockIndex);
        blockSummaries.push(summarizeBlock(blockTrials, blockIndex));
    });
    blockSummaries.sort((a, b) => a.blockIndex - b.blockIndex);
}

function buildSessionSummary() {
    ensureBlockSummaries();
    const totalTrials = trialData.length;
    const accuracy = totalTrials > 0 ? roundMetric(correctCount / totalTrials, 3) : 0;
    const meanRtMs = getMeanReactionTime();
    const angleSlopeMsPerDegree = calculateSlope();
    const mirrorTrials = trialData.filter((trial) => trial.mirror);
    const nonMirrorTrials = trialData.filter((trial) => !trial.mirror);
    const accuracyByAngle = buildByAngleMetric(getAccuracy);
    const meanRtByAngle = buildByAngleMetric(getMeanCorrectRt);

    return {
        totalTrials,
        correctCount,
        accuracy,
        meanRtMs,
        accuracyByAngle,
        meanRtByAngle,
        angleSlopeMsPerDegree,
        angleSlope: angleSlopeMsPerDegree,
        slope: angleSlopeMsPerDegree,
        angleEffect: angleSlopeMsPerDegree,
        mirrorAccuracy: getAccuracy(mirrorTrials),
        nonMirrorAccuracy: getAccuracy(nonMirrorTrials),
        isAdaptive: isAdaptiveMode,
        sessionType: isAdaptiveMode ? 'adaptive-angle-mirror' : 'fixed-balanced',
        adaptationBlockSize: ADAPTIVE_BLOCK_SIZE,
        adaptationEvents: adaptationEvents.map((event) => ({ ...event })),
        angleSetProgression: angleSetProgression.map((item) => ({ ...item, angleSet: cloneAngleSet(item.angleSet) })),
        mirrorRatioProgression: mirrorRatioProgression.map((item) => ({ ...item })),
        blockSummaries: blockSummaries.map((item) => ({ ...item })),
        finalAngleSet: cloneAngleSet(currentAngleSet),
        finalMirrorRatio: roundMetric(currentMirrorRatio, 2),
        finalDifficultyLevel: isAdaptiveMode ? adaptiveLevelIndex : null,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        score: Math.round(accuracy * 100)
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
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary,
            trials: trialData.map((trial) => ({ ...trial })),
            metrics: {
                accuracy: summary.accuracy,
                accuracyPercent: `${Math.round(summary.accuracy * 100)}%`,
                meanRtMs: summary.meanRtMs,
                accuracyByAngle: { ...summary.accuracyByAngle },
                meanRtByAngle: { ...summary.meanRtByAngle },
                angleSlopeMsPerDegree: summary.angleSlopeMsPerDegree,
                angleSlope: summary.angleSlope,
                mirrorAccuracy: summary.mirrorAccuracy,
                nonMirrorAccuracy: summary.nonMirrorAccuracy,
                isAdaptive: summary.isAdaptive,
                adaptationEvents: summary.adaptationEvents,
                angleSetProgression: summary.angleSetProgression,
                mirrorRatioProgression: summary.mirrorRatioProgression,
                blockSummaries: summary.blockSummaries,
                finalAngleSet: summary.finalAngleSet,
                finalMirrorRatio: summary.finalMirrorRatio,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ['spatial', 'mental-rotation', 'rotation-speed', 'adaptive-difficulty']
        });
    } catch (error) {
        console.error('Failed to save mental rotation session:', error);
    }
}

function endGame() {
    isGameActive = false;
    canRespond = false;
    const adaptiveInput = document.getElementById('adaptive-mode');
    if (adaptiveInput) adaptiveInput.disabled = false;
    const finishedAt = new Date();
    const summary = buildSessionSummary();

    saveTrainingSession(finishedAt, summary);

    document.getElementById('mr-display').style.display = 'none';
    document.getElementById('result-modal').style.display = 'flex';
    
    const accuracy = Math.round(summary.accuracy * 100);
    const avgRT = summary.meanRtMs;
    const slope = summary.angleSlopeMsPerDegree;
    
    document.getElementById('result-accuracy').textContent = accuracy + '%';
    document.getElementById('result-rt').textContent = avgRT + ' ms';
    
    let slopeText = slope + ' ms/度';
    if (slope >= 2) slopeText += ' (角度负荷明显)';
    else if (slope > 0) slopeText += ' (轻微变慢)';
    else slopeText += ' (未见变慢)';
    
    document.getElementById('result-slope').textContent = slopeText;
    document.getElementById('feedback-text').textContent = buildFeedback(summary);
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
