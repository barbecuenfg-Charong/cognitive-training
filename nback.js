document.addEventListener('DOMContentLoaded', () => {
    const GAME_ID = "nback";
    const GAME_NAME = "N-Back 记忆训练";
    const CONTENT_VERSION = "nback-working-memory-update-v2";
    const TARGET_PROBABILITY = 0.3;
    const RESPONSE_COOLDOWN_MS = 100;
    const startBtn = document.getElementById('start-btn');
    const nLevelInput = document.getElementById('n-level');
    const speedInput = document.getElementById('speed');
    const roundsInput = document.getElementById('total-rounds');
    const display = document.getElementById('display');
    const feedback = document.getElementById('feedback');
    const matchBtn = document.getElementById('match-btn');
    const scoreDisplay = document.getElementById('score');
    const roundDisplay = document.getElementById('round');
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
    let speed = 2000;
    let hasResponded = false;
    let charType = 'letters';
    let sessionStartedAt = null;
    let sessionSaved = false;
    let sessionSeed = null;
    let stimulusRng = null;

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

    function formatPercent(value) {
        return `${Math.round(value * 100)}%`;
    }

    function getLoadGuidance(summary) {
        const missRate = ratio(summary.missCount, summary.targetTrials);
        const lowHitRate = summary.targetTrials > 0 && summary.hitRate < 0.6;
        const highMissRate = summary.targetTrials > 0 && missRate >= 0.35;
        const highFalseAlarmRate = summary.nonTargetTrials > 0 && summary.falseAlarmRate >= 0.2;

        if (lowHitRate && highFalseAlarmRate) {
            return {
                loadAssessment: "tooHigh",
                recommendation: `当前 n=${summary.nLevel} 同时出现较多遗漏和误报，负荷偏高。下一轮建议先降到 n=${Math.max(0, summary.nLevel - 1)}，或把速度放慢 0.5 秒。`
            };
        }

        if (highMissRate || lowHitRate) {
            return {
                loadAssessment: "possiblyHigh",
                recommendation: `当前 n=${summary.nLevel} 对更新保持有压力，主要问题是目标遗漏。下一轮建议保持或下调 N，并优先练习“新刺激进入、旧刺激移出”的更新节奏。`
            };
        }

        if (highFalseAlarmRate || summary.falseAlarmCount >= 3) {
            return {
                loadAssessment: "unstableControl",
                recommendation: `当前 n=${summary.nLevel} 负荷未必过高，但匹配判断偏急。下一轮建议维持 N，确认当前刺激等于目标位置后再按，先降低误报。`
            };
        }

        if (summary.hitRate >= 0.8 && summary.falseAlarmRate <= 0.1 && summary.accuracy >= 0.8) {
            return {
                loadAssessment: "readyToIncrease",
                recommendation: `当前 n=${summary.nLevel} 负荷可控。下一轮可以增加 5-10 轮，或尝试 n=${Math.min(5, summary.nLevel + 1)}。`
            };
        }

        return {
            loadAssessment: "appropriate",
            recommendation: `当前 n=${summary.nLevel} 负荷基本合适。下一轮建议维持 N，继续提高命中稳定性并控制误报。`
        };
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

        const summary = {
            totalTrials,
            nLevel: n,
            sessionType: "fixed-level",
            isAdaptive: false,
            nProgression,
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
            accuracy: ratio(correctCount, totalTrials),
            meanRtMs: average(hitRts),
            responseMeanRtMs: average(responseRts),
            targetProbability: TARGET_PROBABILITY,
            stimulusDurationMs: speed,
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
        return `${omissionText}；${falseAlarmText}。${summary.recommendation}`;
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
        
        speed = (parseFloat(speedInput.value) || 2) * 1000;
        
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
        stimulusRng = createRng(`${sessionSeed}:stimuli:${charType}:${n}:${totalRounds}`);
        
        scoreDisplay.textContent = "0";
        roundDisplay.textContent = `0/${totalRounds}`;
        startBtn.disabled = true;
        matchBtn.disabled = false;
        nLevelInput.disabled = true;
        speedInput.disabled = true;
        roundsInput.disabled = true;
        charTypeInputs.forEach(input => {
            input.disabled = true;
        });
        
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
                targetTrials: finalSummary.targetTrials,
                misses: finalSummary.missCount,
                falseAlarms: finalSummary.falseAlarmCount,
                sessionType: finalSummary.sessionType,
                isAdaptive: finalSummary.isAdaptive,
                nProgression: finalSummary.nProgression,
                loadAssessment: finalSummary.loadAssessment,
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
        charTypeInputs.forEach(input => {
            input.disabled = false;
        });
        startBtn.textContent = "开始训练";
        display.textContent = "?";
        feedback.textContent = "";
    }
});
