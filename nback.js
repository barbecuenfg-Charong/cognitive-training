document.addEventListener('DOMContentLoaded', () => {
    const GAME_ID = "nback";
    const GAME_NAME = "N-Back 记忆训练";
    const CONTENT_VERSION = "nback-adaptive-staircase-v3";
    const TARGET_PROBABILITY = 0.3;
    const RESPONSE_COOLDOWN_MS = 100;
    const ADAPTIVE_BLOCK_SIZE = 10;
    const MIN_N_LEVEL = 0;
    const MAX_N_LEVEL = 5;
    const MIN_SPEED_MS = 1000;
    const MAX_SPEED_MS = 5000;
    const SPEED_STEP_MS = 250;
    const startBtn = document.getElementById('start-btn');
    const nLevelInput = document.getElementById('n-level');
    const speedInput = document.getElementById('speed');
    const roundsInput = document.getElementById('total-rounds');
    const adaptiveModeInput = document.getElementById('adaptive-mode');
    const display = document.getElementById('display');
    const feedback = document.getElementById('feedback');
    const matchBtn = document.getElementById('match-btn');
    const scoreDisplay = document.getElementById('score');
    const roundDisplay = document.getElementById('round');
    const currentNDisplay = document.getElementById('current-n');
    const resultModal = document.getElementById('result-modal');
    const finalScoreDisplay = document.getElementById('final-score');
    const finalAccuracyDisplay = document.getElementById('final-accuracy');
    const finalTrainingFeedback = document.getElementById('final-training-feedback');
    const restartBtn = document.getElementById('restart-btn');
    const charTypeInputs = Array.from(document.querySelectorAll('input[name="char-type"]'));

    let sequence = [];
    let history = [];
    let currentIndex = 0;
    let score = 0;
    let correctMatches = 0;
    let wrongMatches = 0;
    let missedMatches = 0;
    let isPlaying = false;
    let timer = null;
    let totalRounds = 20;
    let n = 2;
    let startingN = 2;
    let speed = 2000;
    let startingSpeed = 2000;
    let hasResponded = false;
    let charType = 'letters';
    let sessionStartedAt = null;
    let sessionSaved = false;
    let sessionSeed = null;
    let stimulusRng = null;
    let isAdaptiveMode = true;
    let adaptationEvents = [];

    // Characters to use
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    // Common distinct Hanzi - Converted to array for consistent indexing
    const hanzi = "日月山水火木金土天人中大大小多上下左右前后红白蓝绿".split('');

    // Mode selection
    charTypeInputs.forEach(radio => {
        radio.addEventListener('change', (e) => {
            charType = e.target.value;
        });
    });
    nLevelInput.addEventListener('input', () => {
        if (!isPlaying && currentNDisplay) {
            const previewN = clampNumber(parseInt(nLevelInput.value) || 0, MIN_N_LEVEL, MAX_N_LEVEL);
            currentNDisplay.textContent = String(previewN);
        }
    });

    startBtn.addEventListener('click', startGame);
    matchBtn.addEventListener('click', handleMatch);
    restartBtn.addEventListener('click', () => {
        resultModal.classList.add('hidden');
        resetUI();
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.repeat) return; // Prevent key hold repetition
        // Ignore key presses during cooldown
        const roundStartTime = parseInt(display.dataset.startTime || 0);
        if (Date.now() - roundStartTime < RESPONSE_COOLDOWN_MS) return;
        
        if (isPlaying && (e.code === 'Space' || e.code === 'Enter')) {
            handleMatch();
        }
    });

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

    function createFallbackToken() {
        if (window.crypto && typeof window.crypto.getRandomValues === "function") {
            const bytes = new Uint32Array(2);
            window.crypto.getRandomValues(bytes);
            return `${bytes[0].toString(36)}${bytes[1].toString(36)}`;
        }
        const now = Date.now().toString(36);
        const preciseNow = window.performance && typeof window.performance.now === "function"
            ? Math.round(window.performance.now() * 1000).toString(36)
            : "0";
        return `${now}${preciseNow}`;
    }

    function createSessionSeed() {
        if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === "function") {
            return window.SeededRandom.createSessionSeed(GAME_ID);
        }
        return `${GAME_ID}-${Date.now().toString(36)}-${createFallbackToken()}`;
    }

    function createRng(seed) {
        if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
            return window.SeededRandom.createRngFromSeed(seed);
        }
        return fallbackMulberry32(fallbackHashString(seed));
    }

    function nextRandom() {
        if (!stimulusRng) {
            sessionSeed = sessionSeed || createSessionSeed();
            stimulusRng = createRng(`${sessionSeed}:stimuli:${charType}:${n}:${totalRounds}`);
        }
        return stimulusRng();
    }

    function getSourceChars() {
        return charType === 'hanzi' ? hanzi : letters.split('');
    }

    function pickRandom(list) {
        if (!list.length) return null;
        return list[Math.floor(nextRandom() * list.length)];
    }

    function uniqueValues(list) {
        return Array.from(new Set(list));
    }

    function getNBackStimulus() {
        if (n === 0 || sequence.length < n) return null;
        return sequence[sequence.length - n];
    }

    function getTargetCandidates() {
        if (n === 0) {
            return uniqueValues(sequence);
        }
        const nBackStimulus = getNBackStimulus();
        return nBackStimulus === null ? [] : [nBackStimulus];
    }

    function getNonTargetCandidates(sourceChars) {
        if (n === 0) {
            return sourceChars.filter(char => !sequence.includes(char));
        }

        const nBackStimulus = getNBackStimulus();
        const recentWindow = sequence.slice(-Math.max(10, n * 3));
        const strictCandidates = sourceChars.filter(char => {
            if (nBackStimulus !== null && char === nBackStimulus) return false;
            if (sequence.length > 0 && char === sequence[sequence.length - 1]) return false;
            return recentWindow.filter(item => item === char).length < 2;
        });

        if (strictCandidates.length > 0) {
            return strictCandidates;
        }

        const relaxedCandidates = sourceChars.filter(char => nBackStimulus === null || char !== nBackStimulus);
        return relaxedCandidates.length > 0 ? relaxedCandidates : sourceChars.slice();
    }

    function getMatchedStimulus(stimulus) {
        if (n === 0) {
            return sequence.includes(stimulus) ? stimulus : null;
        }

        const nBackStimulus = getNBackStimulus();
        return nBackStimulus !== null && stimulus === nBackStimulus ? nBackStimulus : null;
    }

    function generateStimulus() {
        const sourceChars = getSourceChars();
        const targetCandidates = getTargetCandidates();
        const nonTargetCandidates = getNonTargetCandidates(sourceChars);
        const canGenerateTarget = targetCandidates.length > 0;
        const mustGenerateTarget = canGenerateTarget && nonTargetCandidates.length === 0;
        const shouldGenerateTarget = canGenerateTarget
            && (mustGenerateTarget || nextRandom() < TARGET_PROBABILITY);
        const stimulus = shouldGenerateTarget
            ? pickRandom(targetCandidates)
            : pickRandom(nonTargetCandidates);
        const matchedStimulus = getMatchedStimulus(stimulus);

        return {
            stimulus,
            targetStimulus: n === 0 ? matchedStimulus : getNBackStimulus(),
            matchedStimulus,
            isTarget: matchedStimulus !== null
        };
    }

    function classifyTrial(trial) {
        if (trial.isTarget && trial.responded) return "hit";
        if (trial.isTarget && !trial.responded) return "miss";
        if (!trial.isTarget && trial.responded) return "falseAlarm";
        return "correctRejection";
    }

    function resultFromClassification(classification) {
        if (classification === "hit") return "correct";
        if (classification === "miss") return "missed";
        if (classification === "falseAlarm") return "wrong";
        return "neutral";
    }

    function isCorrectClassification(classification) {
        return classification === "hit" || classification === "correctRejection";
    }

    function average(values) {
        const validValues = values.filter(value => Number.isFinite(value));
        if (validValues.length === 0) return 0;
        return Math.round(validValues.reduce((sum, value) => sum + value, 0) / validValues.length);
    }

    function ratio(numerator, denominator) {
        return denominator > 0 ? numerator / denominator : 0;
    }

    function roundMetric(value, digits = 3) {
        if (!Number.isFinite(value)) return 0;
        const factor = 10 ** digits;
        return Math.round(value * factor) / factor;
    }

    function formatPercent(value) {
        return `${Math.round(value * 100)}%`;
    }

    function clampNumber(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    function inverseNormalCdf(probability) {
        const p = clampNumber(probability, 1e-6, 1 - 1e-6);
        const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
        const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
        const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
        const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
        const plow = 0.02425;
        const phigh = 1 - plow;

        if (p < plow) {
            const q = Math.sqrt(-2 * Math.log(p));
            return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
                / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
        }
        if (p > phigh) {
            const q = Math.sqrt(-2 * Math.log(1 - p));
            return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5])
                / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
        }

        const q = p - 0.5;
        const r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q
            / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }

    function signalDetectionStats(hitCount, falseAlarmCount, targetTrials, nonTargetTrials) {
        if (targetTrials === 0 || nonTargetTrials === 0) {
            return {
                adjustedHitRate: 0,
                adjustedFalseAlarmRate: 0,
                dPrime: 0,
                criterion: 0
            };
        }

        const adjustedHitRate = (hitCount + 0.5) / (targetTrials + 1);
        const adjustedFalseAlarmRate = (falseAlarmCount + 0.5) / (nonTargetTrials + 1);
        const zHit = inverseNormalCdf(adjustedHitRate);
        const zFalseAlarm = inverseNormalCdf(adjustedFalseAlarmRate);

        return {
            adjustedHitRate: roundMetric(adjustedHitRate),
            adjustedFalseAlarmRate: roundMetric(adjustedFalseAlarmRate),
            dPrime: roundMetric(zHit - zFalseAlarm, 2),
            criterion: roundMetric(-0.5 * (zHit + zFalseAlarm), 2)
        };
    }

    function summarizeTrials(trials) {
        const targetTrials = trials.filter(trial => trial.isTarget).length;
        const nonTargetTrials = trials.length - targetTrials;
        const hitCount = trials.filter(trial => trial.classification === "hit").length;
        const missCount = trials.filter(trial => trial.classification === "miss").length;
        const falseAlarmCount = trials.filter(trial => trial.classification === "falseAlarm").length;
        const correctRejectionCount = trials.filter(trial => trial.classification === "correctRejection").length;
        const correctCount = hitCount + correctRejectionCount;

        return {
            totalTrials: trials.length,
            targetTrials,
            nonTargetTrials,
            hitCount,
            missCount,
            falseAlarmCount,
            correctRejectionCount,
            correctCount,
            hitRate: ratio(hitCount, targetTrials),
            missRate: ratio(missCount, targetTrials),
            falseAlarmRate: ratio(falseAlarmCount, nonTargetTrials),
            correctRejectionRate: ratio(correctRejectionCount, nonTargetTrials),
            accuracy: ratio(correctCount, trials.length),
            ...signalDetectionStats(hitCount, falseAlarmCount, targetTrials, nonTargetTrials)
        };
    }

    function updateCurrentNDisplay() {
        if (currentNDisplay) {
            currentNDisplay.textContent = String(n);
        }
    }

    function adaptiveDecision(blockSummary) {
        const canIncreaseN = n < MAX_N_LEVEL;
        const canDecreaseN = n > MIN_N_LEVEL;
        const canSpeedUp = speed > MIN_SPEED_MS;
        const canSlowDown = speed < MAX_SPEED_MS;
        const hasTargets = blockSummary.targetTrials > 0;
        const hasNonTargets = blockSummary.nonTargetTrials > 0;
        const strongHit = !hasTargets || blockSummary.hitRate >= 0.8;
        const lowFalseAlarm = !hasNonTargets || blockSummary.falseAlarmRate <= 0.1;
        const highFalseAlarm = hasNonTargets && blockSummary.falseAlarmRate >= 0.25;
        const weakHit = hasTargets && blockSummary.hitRate < 0.55;

        if (blockSummary.accuracy >= 0.82 && strongHit && lowFalseAlarm) {
            if (canIncreaseN) {
                return {
                    toN: n + 1,
                    toSpeed: speed,
                    direction: "increase-n",
                    reason: "最近一组命中率、误报率和总体准确率达标，增加 N 以提高工作记忆更新负荷。"
                };
            }
            if (canSpeedUp) {
                return {
                    toN: n,
                    toSpeed: speed - SPEED_STEP_MS,
                    direction: "speed-up",
                    reason: "N 已到上限且表现稳定，缩短刺激间隔以提高更新速度要求。"
                };
            }
        }

        if (blockSummary.accuracy < 0.62 || weakHit || highFalseAlarm) {
            if (canDecreaseN && (weakHit || blockSummary.accuracy < 0.55)) {
                return {
                    toN: n - 1,
                    toSpeed: speed,
                    direction: "decrease-n",
                    reason: "最近一组遗漏或总体错误偏多，降低 N 让训练回到可持续负荷。"
                };
            }
            if (canSlowDown) {
                return {
                    toN: n,
                    toSpeed: speed + SPEED_STEP_MS,
                    direction: "slow-down",
                    reason: "最近一组误报或错误偏多，先放慢节奏以恢复判断稳定性。"
                };
            }
        }

        return {
            toN: n,
            toSpeed: speed,
            direction: "hold",
            reason: "最近一组表现处于训练区间，维持当前负荷继续巩固。"
        };
    }

    function maybeAdjustDifficulty(completedTrials) {
        if (!isAdaptiveMode || completedTrials < ADAPTIVE_BLOCK_SIZE || completedTrials >= totalRounds) return;
        if (completedTrials % ADAPTIVE_BLOCK_SIZE !== 0) return;

        const blockTrials = history.slice(completedTrials - ADAPTIVE_BLOCK_SIZE, completedTrials);
        const blockSummary = summarizeTrials(blockTrials);
        const fromN = n;
        const fromSpeed = speed;
        const decision = adaptiveDecision(blockSummary);

        n = clampNumber(decision.toN, MIN_N_LEVEL, MAX_N_LEVEL);
        speed = clampNumber(decision.toSpeed, MIN_SPEED_MS, MAX_SPEED_MS);
        updateCurrentNDisplay();

        const event = {
            afterTrial: completedTrials,
            fromN,
            toN: n,
            fromSpeedMs: fromSpeed,
            toSpeedMs: speed,
            direction: decision.direction,
            reason: decision.reason,
            blockSummary: {
                totalTrials: blockSummary.totalTrials,
                targetTrials: blockSummary.targetTrials,
                hitRate: roundMetric(blockSummary.hitRate),
                falseAlarmRate: roundMetric(blockSummary.falseAlarmRate),
                accuracy: roundMetric(blockSummary.accuracy),
                dPrime: blockSummary.dPrime,
                criterion: blockSummary.criterion
            }
        };

        adaptationEvents.push(event);
        if (decision.direction !== "hold") {
            showFeedback(`负荷调整：N ${fromN}→${n}，速度 ${(fromSpeed / 1000).toFixed(2)}s→${(speed / 1000).toFixed(2)}s`, "correct");
        }
    }

    function buildNBackPrescription(summary, loadAssessment, recommendation, nextN, nextSpeedMs, nextRounds, reason) {
        const hasAdaptiveStabilitySignal = summary && summary.isAdaptive && summary.reversalCount > 0;
        const stabilitySuffix = hasAdaptiveStabilitySignal
            ? `；staircase ${summary.adaptiveStabilityLabel}（N 反转 ${summary.nLevelOscillationCount} 次，速度反转 ${summary.speedOscillationCount} 次，波动 ${Math.round(summary.adaptationVolatility * 100)}%）`
            : "";
        return {
            loadAssessment,
            recommendation,
            nextRecommendedN: clampNumber(nextN, 0, 5),
            nextRecommendedSpeedMs: clampNumber(nextSpeedMs, 1000, 5000),
            nextRecommendedRounds: clampNumber(nextRounds, 5, 100),
            nextPrescriptionReason: `${reason}${stabilitySuffix}`
        };
    }

    function countDirectionReversals(values) {
        let previousDirection = 0;
        let reversalCount = 0;

        values.forEach(value => {
            const direction = Math.sign(value);
            if (direction === 0) return;
            if (previousDirection !== 0 && direction !== previousDirection) {
                reversalCount += 1;
            }
            previousDirection = direction;
        });

        return reversalCount;
    }

    function analyzeAdaptiveStability(adaptationEventList, adaptiveModeEnabled) {
        const relevantEvents = adaptationEventList.filter(event => event && event.direction !== "hold");
        const nDirectionSteps = relevantEvents
            .map(event => (Number.isFinite(event.toN) && Number.isFinite(event.fromN) ? event.toN - event.fromN : 0))
            .filter(delta => delta !== 0);
        const speedDirectionSteps = relevantEvents
            .map(event => (Number.isFinite(event.toSpeedMs) && Number.isFinite(event.fromSpeedMs) ? event.toSpeedMs - event.fromSpeedMs : 0))
            .filter(delta => delta !== 0);
        const nLevelOscillationCount = countDirectionReversals(nDirectionSteps);
        const speedOscillationCount = countDirectionReversals(speedDirectionSteps);
        const reversalCount = nLevelOscillationCount + speedOscillationCount;
        const changeCount = relevantEvents.length;
        const adaptationVolatility = changeCount > 1
            ? roundMetric(clampNumber(reversalCount / (changeCount - 1), 0, 1))
            : 0;
        const adaptiveStabilityScore = roundMetric((1 - adaptationVolatility) * 100, 0);

        let adaptiveStabilityLabel = "stable";
        if (!adaptiveModeEnabled) {
            adaptiveStabilityLabel = "fixed-level";
        } else if (changeCount === 0) {
            adaptiveStabilityLabel = "stable";
        } else if (adaptiveStabilityScore >= 80) {
            adaptiveStabilityLabel = "stable";
        } else if (adaptiveStabilityScore >= 55) {
            adaptiveStabilityLabel = "mixed";
        } else {
            adaptiveStabilityLabel = "volatile";
        }

        return {
            adaptiveStabilityLabel,
            loadStability: adaptiveStabilityLabel,
            adaptiveStabilityScore,
            nLevelOscillationCount,
            speedOscillationCount,
            reversalCount,
            adaptationVolatility
        };
    }

    function getLoadGuidance(summary) {
        const missRate = ratio(summary.missCount, summary.targetTrials);
        const lowHitRate = summary.targetTrials > 0 && summary.hitRate < 0.6;
        const highMissRate = summary.targetTrials > 0 && missRate >= 0.35;
        const highFalseAlarmRate = summary.nonTargetTrials > 0 && summary.falseAlarmRate >= 0.2;

        if (lowHitRate && highFalseAlarmRate) {
            return buildNBackPrescription(
                summary,
                "tooHigh",
                `当前 n=${summary.nLevel} 同时出现较多遗漏和误报，负荷偏高。下一轮建议先降到 n=${Math.max(0, summary.nLevel - 1)}，或把速度放慢 0.5 秒。`,
                summary.nLevel - 1,
                summary.stimulusDurationMs + 500,
                summary.totalTrials,
                "命中率偏低且误报率偏高，先降低记忆负荷并放慢刺激节奏。"
            );
        }

        if (highMissRate || lowHitRate) {
            const nextN = summary.accuracy < 0.65 ? summary.nLevel - 1 : summary.nLevel;
            return buildNBackPrescription(
                summary,
                "possiblyHigh",
                `当前 n=${summary.nLevel} 对更新保持有压力，主要问题是目标遗漏。下一轮建议保持或下调 N，并优先练习“新刺激进入、旧刺激移出”的更新节奏。`,
                nextN,
                summary.stimulusDurationMs + 500,
                summary.totalTrials,
                "目标遗漏较多，下一轮优先稳定命中率，再增加 N 或提速。"
            );
        }

        if (highFalseAlarmRate || summary.falseAlarmCount >= 3) {
            return buildNBackPrescription(
                summary,
                "unstableControl",
                `当前 n=${summary.nLevel} 负荷未必过高，但匹配判断偏急。下一轮建议维持 N，确认当前刺激等于目标位置后再按，先降低误报。`,
                summary.nLevel,
                summary.stimulusDurationMs + 500,
                summary.totalTrials,
                "误报率偏高，保持 N 并放慢节奏以强化反应抑制。"
            );
        }

        if (summary.hitRate >= 0.8 && summary.falseAlarmRate <= 0.1 && summary.accuracy >= 0.8) {
            const nextN = summary.nLevel < 5 ? summary.nLevel + 1 : summary.nLevel;
            const nextRounds = summary.nLevel < 5 ? summary.totalTrials : summary.totalTrials + 5;
            const nextSpeedMs = summary.nLevel < 5
                ? summary.stimulusDurationMs
                : summary.stimulusDurationMs - 250;
            return buildNBackPrescription(
                summary,
                "readyToIncrease",
                `当前 n=${summary.nLevel} 负荷可控。下一轮可以增加 5-10 轮，或尝试 n=${Math.min(5, summary.nLevel + 1)}。`,
                nextN,
                nextSpeedMs,
                nextRounds,
                "命中率、误报率和总体准确率均达标，可以小幅增加负荷。"
            );
        }

        return buildNBackPrescription(
            summary,
            "appropriate",
            `当前 n=${summary.nLevel} 负荷基本合适。下一轮建议维持 N，继续提高命中稳定性并控制误报。`,
            summary.nLevel,
            summary.stimulusDurationMs,
            summary.totalTrials,
            "当前负荷基本匹配表现，下一轮保持设置以巩固稳定性。"
        );
    }

    function buildSummary() {
        const totalTrials = history.length;
        const targetTrials = history.filter(trial => trial.isTarget).length;
        const nonTargetTrials = totalTrials - targetTrials;
        const hitCount = history.filter(trial => trial.classification === "hit").length;
        const missCount = history.filter(trial => trial.classification === "miss").length;
        const falseAlarmCount = history.filter(trial => trial.classification === "falseAlarm").length;
        const correctRejectionCount = history.filter(trial => trial.classification === "correctRejection").length;
        const correctCount = hitCount + correctRejectionCount;
        const hitRts = history
            .filter(trial => trial.classification === "hit")
            .map(trial => trial.rtMs);
        const responseRts = history
            .filter(trial => trial.responded)
            .map(trial => trial.rtMs);
        const nProgression = history.map(trial => ({
            index: trial.index,
            nLevel: trial.nLevel
        }));

        const signalDetection = signalDetectionStats(hitCount, falseAlarmCount, targetTrials, nonTargetTrials);
        const nLevels = history.map(trial => trial.nLevel).filter(value => Number.isFinite(value));
        const adaptiveStability = analyzeAdaptiveStability(adaptationEvents, isAdaptiveMode);
        const summary = {
            totalTrials,
            nLevel: n,
            finalNLevel: n,
            startingNLevel: startingN,
            sessionType: isAdaptiveMode ? "adaptive-staircase" : "fixed-level",
            isAdaptive: isAdaptiveMode,
            adaptationBlockSize: ADAPTIVE_BLOCK_SIZE,
            adaptationEvents: adaptationEvents.map(event => ({ ...event })),
            ...adaptiveStability,
            nProgression,
            minNLevel: nLevels.length ? Math.min(...nLevels) : n,
            maxNLevel: nLevels.length ? Math.max(...nLevels) : n,
            targetTrials,
            nonTargetTrials,
            hitCount,
            missCount,
            falseAlarmCount,
            correctRejectionCount,
            hits: hitCount,
            misses: missCount,
            falseAlarms: falseAlarmCount,
            correctRejections: correctRejectionCount,
            correctCount,
            responseCount: hitCount + falseAlarmCount,
            hitRate: ratio(hitCount, targetTrials),
            missRate: ratio(missCount, targetTrials),
            falseAlarmRate: ratio(falseAlarmCount, nonTargetTrials),
            correctRejectionRate: ratio(correctRejectionCount, nonTargetTrials),
            adjustedHitRate: signalDetection.adjustedHitRate,
            adjustedFalseAlarmRate: signalDetection.adjustedFalseAlarmRate,
            dPrime: signalDetection.dPrime,
            criterion: signalDetection.criterion,
            accuracy: ratio(correctCount, totalTrials),
            meanRtMs: average(hitRts),
            responseMeanRtMs: average(responseRts),
            targetProbability: TARGET_PROBABILITY,
            startingStimulusDurationMs: startingSpeed,
            stimulusDurationMs: speed,
            finalStimulusDurationMs: speed,
            charType,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION
        };

        return {
            ...summary,
            ...getLoadGuidance(summary)
        };
    }

    function buildTrainingFeedback(summary) {
        const omissionText = `目标遗漏 ${summary.missCount}/${summary.targetTrials}，命中率 ${formatPercent(summary.hitRate)}`;
        const falseAlarmText = `误报 ${summary.falseAlarmCount}/${summary.nonTargetTrials}，误报率 ${formatPercent(summary.falseAlarmRate)}`;
        const adaptiveText = summary.isAdaptive
            ? `本轮使用自适应 staircase，N 从 ${summary.startingNLevel} 调整到 ${summary.finalNLevel}，共记录 ${summary.adaptationEvents.length} 次负荷评估。`
            : "本轮使用固定 N 训练。";
        const sensitivityText = `敏感性 d'=${summary.dPrime}，判别标准 criterion=${summary.criterion}。`;
        const speedSeconds = (summary.nextRecommendedSpeedMs / 1000).toFixed(2).replace(/\.?0+$/, "");
        const nextText = `下一轮处方：N=${summary.nextRecommendedN}，速度=${speedSeconds}秒，轮次=${summary.nextRecommendedRounds}。${summary.nextPrescriptionReason}`;
        return `${omissionText}；${falseAlarmText}。${sensitivityText}${adaptiveText}${summary.recommendation} ${nextText}`;
    }

    function serializeTrial(item, index) {
        const classification = item.classification || classifyTrial(item);
        return {
            index: item.index ?? index,
            trialIndex: item.trialIndex ?? index,
            nLevel: item.nLevel,
            stimulus: item.stimulus || item.char,
            targetStimulus: item.targetStimulus ?? null,
            matchedStimulus: item.matchedStimulus ?? null,
            isTarget: item.isTarget,
            response: item.response || 'none',
            responded: Boolean(item.responded),
            correct: item.correct === null ? null : Boolean(item.correct),
            rtMs: Number.isFinite(item.rtMs) ? item.rtMs : null,
            timedOut: Boolean(item.timedOut),
            classification,
            charType: item.charType,
            stimulusDurationMs: item.stimulusDurationMs,
            startedAt: item.startedAt,
            finishedAt: item.finishedAt,
            elapsedMs: item.elapsedMs
        };
    }

    function startGame() {
        if (isPlaying) return;
        
        let val = parseInt(nLevelInput.value);
        if (isNaN(val) || val < 0) val = 0; // Allow 0
        n = val;
        startingN = val;
        
        speed = (parseFloat(speedInput.value) || 2) * 1000;
        startingSpeed = speed;
        
        let r = parseInt(roundsInput.value);
        if (isNaN(r) || r < 5) r = 5;
        if (r > 100) r = 100;
        totalRounds = r;
        
        // Init state
        sequence = [];
        history = [];
        currentIndex = 0;
        score = 0;
        correctMatches = 0;
        wrongMatches = 0;
        missedMatches = 0;
        isPlaying = true;
        sessionStartedAt = new Date();
        sessionSaved = false;
        sessionSeed = createSessionSeed();
        isAdaptiveMode = adaptiveModeInput ? Boolean(adaptiveModeInput.checked) : true;
        adaptationEvents = [];
        stimulusRng = createRng(`${sessionSeed}:stimuli:${charType}:${n}:${totalRounds}:${isAdaptiveMode ? "adaptive" : "fixed"}`);
        
        scoreDisplay.textContent = "0";
        roundDisplay.textContent = `0/${totalRounds}`;
        startBtn.disabled = true;
        matchBtn.disabled = false;
        nLevelInput.disabled = true;
        speedInput.disabled = true;
        roundsInput.disabled = true;
        if (adaptiveModeInput) {
            adaptiveModeInput.disabled = true;
        }
        charTypeInputs.forEach(input => {
            input.disabled = true;
        });
        updateCurrentNDisplay();
        
        feedback.textContent = "";
        feedback.className = "feedback";
        
        nextRound();
    }

    function nextRound() {
        if (currentIndex >= totalRounds) {
            endGame();
            return;
        }

        hasResponded = false;
        
        // Input Cooldown: Ignore clicks for the first 100ms of a new round
        // This prevents "late clicks" from the previous round being registered for the new one.
        const roundStartTime = Date.now();
        display.dataset.startTime = roundStartTime;
        
        const generated = generateStimulus();
        const char = generated.stimulus;
        sequence.push(char);
        
        history.push({
            index: currentIndex,
            trialIndex: currentIndex,
            nLevel: n,
            stimulus: char,
            targetStimulus: generated.targetStimulus,
            matchedStimulus: generated.matchedStimulus,
            char,
            charType,
            isTarget: generated.isTarget,
            response: 'none',
            responded: false,
            userAction: 'none',
            correct: null,
            result: 'neutral',
            rtMs: null,
            elapsedMs: null,
            timedOut: false,
            classification: null,
            stimulusDurationMs: speed,
            startedAt: new Date(roundStartTime).toISOString(),
            finishedAt: null,
            startedAtMs: roundStartTime
        });
        
        display.textContent = char;
        roundDisplay.textContent = `${currentIndex + 1}/${totalRounds}`;
        
        // Visual cue for new letter (flash)
        display.style.color = "#3498db";
        setTimeout(() => display.style.color = "#2c3e50", 200);

        // Schedule next
        timer = setTimeout(() => {
            // Check missed match
            // If it WAS a target, and user did NOTHING, then it is MISSED.
            // If it was NOT a target, and user did NOTHING, then it is CORRECT rejection (neutral/correct).
            
            const currentRound = history[currentIndex];
            if (!currentRound) return;
            currentRound.elapsedMs = Math.max(0, Date.now() - currentRound.startedAtMs);
            if (!currentRound.finishedAt) {
                currentRound.finishedAt = new Date().toISOString();
            }
            if (!currentRound.responded) {
                currentRound.response = 'none';
                currentRound.timedOut = true;
                currentRound.classification = classifyTrial(currentRound);
                currentRound.correct = isCorrectClassification(currentRound.classification);
                currentRound.result = resultFromClassification(currentRound.classification);

                if (currentRound.classification === "miss") {
                    missedMatches++;
                    showFeedback("漏选!", "wrong");
                }
            }
            
            maybeAdjustDifficulty(currentIndex + 1);
            currentIndex++;
            nextRound();
        }, speed);
    }

    function handleMatch() {
        if (!isPlaying || hasResponded) return;
        
        // Check for cooldown (100ms)
        const roundStartTime = parseInt(display.dataset.startTime || 0);
        if (Date.now() - roundStartTime < RESPONSE_COOLDOWN_MS) return;

        const currentRound = history[currentIndex];
        if (!currentRound) return;
        hasResponded = true;
        currentRound.userAction = 'match';
        currentRound.response = 'match';
        currentRound.responded = true;
        currentRound.rtMs = Math.max(0, Date.now() - roundStartTime);
        currentRound.elapsedMs = currentRound.rtMs;
        currentRound.timedOut = false;
        currentRound.finishedAt = new Date().toISOString();
        currentRound.classification = classifyTrial(currentRound);
        currentRound.correct = isCorrectClassification(currentRound.classification);
        currentRound.result = resultFromClassification(currentRound.classification);
        
        if (currentRound.classification === "hit") {
            score += 10;
            correctMatches++;
            showFeedback("正确!", "correct");
            scoreDisplay.textContent = score;
            
            // Visual feedback on button
            matchBtn.classList.add('match');
            setTimeout(() => matchBtn.classList.remove('match'), 200);
        } else {
            score -= 5;
            wrongMatches++;
            const earlyPress = n > 0 && currentRound.targetStimulus === null;
            showFeedback(earlyPress ? "错误 (尚无N-back目标)" : "错误!", "wrong");
            scoreDisplay.textContent = score;
        }
    }

    function showFeedback(text, type) {
        feedback.textContent = text;
        feedback.className = `feedback ${type}`;
        // Clear feedback after 1s
        setTimeout(() => {
            if (feedback.textContent === text) {
                feedback.textContent = "";
            }
        }, 1000);
    }

    function endGame() {
        isPlaying = false;
        clearTimeout(timer);
        const finishedAt = new Date();
        const startedAt = sessionStartedAt || finishedAt;
        const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
        const summary = buildSummary();
            
        finalScoreDisplay.textContent = score;
        finalAccuracyDisplay.textContent = `${formatPercent(summary.accuracy)} (命中: ${summary.hitCount}, 漏选: ${summary.missCount}, 误报: ${summary.falseAlarmCount})`;
        if (finalTrainingFeedback) {
            finalTrainingFeedback.textContent = buildTrainingFeedback(summary);
        }
        saveTrainingResult(finishedAt, durationMs, summary);
        
        // Render history list
        const historyList = document.getElementById('history-list');
        historyList.innerHTML = '';
        
        history.forEach((item, index) => {
            const el = document.createElement('div');
            el.style.padding = '5px 10px';
            el.style.borderRadius = '4px';
            el.style.border = '1px solid #ddd';
            el.style.fontSize = '1.2rem';
            el.style.fontWeight = 'bold';
            el.style.minWidth = '40px';
            el.style.textAlign = 'center';
            el.style.position = 'relative';
            el.textContent = item.char;
            el.title = `${item.classification || 'pending'}${item.targetStimulus ? ` / target: ${item.targetStimulus}` : ''}`;
            
            // Style based on result
            if (item.result === 'correct') {
                el.style.backgroundColor = '#d4edda'; // Green bg
                el.style.color = '#155724';
                el.style.borderColor = '#c3e6cb';
                // Add checkmark
                // el.innerHTML += '<span style="font-size:0.6rem; position:absolute; top:-5px; right:-5px;">✅</span>';
            } else if (item.result === 'wrong') {
                el.style.backgroundColor = '#f8d7da'; // Red bg
                el.style.color = '#721c24';
                el.style.borderColor = '#f5c6cb';
                // Add X mark
                // el.innerHTML += '<span style="font-size:0.6rem; position:absolute; top:-5px; right:-5px;">❌</span>';
            } else if (item.result === 'missed') {
                el.style.backgroundColor = '#fff3cd'; // Yellow bg
                el.style.color = '#856404';
                el.style.borderColor = '#ffeeba';
                // Add Missed mark
                // el.innerHTML += '<span style="font-size:0.6rem; position:absolute; top:-5px; right:-5px;">⚠️</span>';
            } else {
                // Neutral (no match needed, no match clicked)
                el.style.backgroundColor = '#f8f9fa';
                el.style.color = '#6c757d';
            }
            
            // Add label for Target
            if (item.isTarget) {
                el.style.borderWidth = '2px';
                // el.style.borderStyle = 'dashed'; // Indicate it WAS a target
            }
            
            historyList.appendChild(el);
        });
        
        resultModal.classList.remove('hidden');
        resetUI();
    }

    function saveTrainingResult(finishedAt, durationMs, summary) {
        if (sessionSaved) return;
        sessionSaved = true;

        if (!window.TrainingResults || typeof window.TrainingResults.saveSession !== 'function') {
            return;
        }

        const finalSummary = summary || buildSummary();
        const trials = history.map(serializeTrial);

        window.TrainingResults.saveSession({
            moduleId: GAME_ID,
            gameId: GAME_ID,
            gameName: GAME_NAME,
            startedAt: sessionStartedAt || finishedAt,
            finishedAt,
            durationMs,
            score,
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            summary: finalSummary,
            trials,
            metrics: {
                score,
                accuracy: formatPercent(finalSummary.accuracy),
                hitRate: formatPercent(finalSummary.hitRate),
                falseAlarmRate: formatPercent(finalSummary.falseAlarmRate),
                meanRt: `${finalSummary.meanRtMs}ms`,
                dPrime: finalSummary.dPrime,
                criterion: finalSummary.criterion,
                targetTrials: finalSummary.targetTrials,
                misses: finalSummary.missCount,
                falseAlarms: finalSummary.falseAlarmCount,
                startingNLevel: finalSummary.startingNLevel,
                finalNLevel: finalSummary.finalNLevel,
                sessionType: finalSummary.sessionType,
                isAdaptive: finalSummary.isAdaptive,
                adaptiveStabilityLabel: finalSummary.adaptiveStabilityLabel,
                loadStability: finalSummary.loadStability,
                adaptiveStabilityScore: finalSummary.adaptiveStabilityScore,
                nLevelOscillationCount: finalSummary.nLevelOscillationCount,
                speedOscillationCount: finalSummary.speedOscillationCount,
                reversalCount: finalSummary.reversalCount,
                adaptationVolatility: finalSummary.adaptationVolatility,
                nProgression: finalSummary.nProgression,
                adaptationEvents: finalSummary.adaptationEvents,
                loadAssessment: finalSummary.loadAssessment,
                nextRecommendedN: finalSummary.nextRecommendedN,
                nextRecommendedSpeedMs: finalSummary.nextRecommendedSpeedMs,
                nextRecommendedRounds: finalSummary.nextRecommendedRounds,
                nextPrescriptionReason: finalSummary.nextPrescriptionReason,
                seed: sessionSeed,
                contentVersion: CONTENT_VERSION
            },
            tags: ["memory", "working-memory", "updating", "n-back"]
        });
    }

    function resetUI() {
        startBtn.disabled = false;
        matchBtn.disabled = true;
        nLevelInput.disabled = false;
        speedInput.disabled = false;
        roundsInput.disabled = false;
        if (adaptiveModeInput) {
            adaptiveModeInput.disabled = false;
        }
        charTypeInputs.forEach(input => {
            input.disabled = false;
        });
        startBtn.textContent = "开始训练";
        display.textContent = "?";
        feedback.textContent = "";
        updateCurrentNDisplay();
    }
});
