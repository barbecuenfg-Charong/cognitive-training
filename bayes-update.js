const MIN_CASE_COUNT = 10;
const CASE_COUNT = 12;
const CONTENT_VERSION = "bayes-update-v3-parameterized";
const CASE_LIMITS = {
    priorMin: 12,
    priorMax: 88,
    evidenceMin: 10,
    evidenceMax: 90,
    minEvidenceGap: 12,
    maxEvidenceGap: 50,
    minPosterior: 8,
    maxPosterior: 92,
    minUpdateDelta: 4
};

let index = 0;
let approxCorrect = 0;
let totalAbsError = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionCases = [];
let caseOrder = [];
let trialLog = [];
let acceptingAnswer = false;
let caseStartedAtMs = 0;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("bayes-panel");
const questionEl = document.getElementById("question");
const answerInput = document.getElementById("answer-input");
const submitBtn = document.getElementById("submit-btn");
const feedbackEl = document.getElementById("feedback");
const resultModal = document.getElementById("result-modal");

function randomInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
}

function roundTo(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function formatPct(value) {
    const rounded = roundTo(value, 1);
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

function calcPosteriorRaw(priorA, pEgivenA, pEgivenB) {
    const pA = priorA / 100;
    const pB = 1 - pA;
    const numerator = pEgivenA / 100 * pA;
    const denominator = numerator + (pEgivenB / 100) * pB;
    if (denominator <= 0) {
        return NaN;
    }
    return (numerator / denominator) * 100;
}

function calcPosterior(priorA, pEgivenA, pEgivenB) {
    return Math.round(calcPosteriorRaw(priorA, pEgivenA, pEgivenB));
}

function createCandidate(rng) {
    const priorA = randomInt(rng, CASE_LIMITS.priorMin, CASE_LIMITS.priorMax);
    const gap = randomInt(rng, CASE_LIMITS.minEvidenceGap, CASE_LIMITS.maxEvidenceGap);
    const lowEvidence = randomInt(rng, CASE_LIMITS.evidenceMin, CASE_LIMITS.evidenceMax - gap);
    const highEvidence = lowEvidence + gap;
    const evidenceSupportsA = rng() >= 0.25;

    return {
        priorA,
        pEgivenA: evidenceSupportsA ? highEvidence : lowEvidence,
        pEgivenB: evidenceSupportsA ? lowEvidence : highEvidence,
        evidenceDirection: evidenceSupportsA ? "supportsA" : "supportsB"
    };
}

function createFallbackCandidate(position) {
    const templates = [
        { priorA: 18, pEgivenA: 76, pEgivenB: 24, evidenceDirection: "supportsA" },
        { priorA: 28, pEgivenA: 66, pEgivenB: 20, evidenceDirection: "supportsA" },
        { priorA: 42, pEgivenA: 82, pEgivenB: 36, evidenceDirection: "supportsA" },
        { priorA: 58, pEgivenA: 28, pEgivenB: 72, evidenceDirection: "supportsB" },
        { priorA: 36, pEgivenA: 70, pEgivenB: 18, evidenceDirection: "supportsA" },
        { priorA: 64, pEgivenA: 48, pEgivenB: 78, evidenceDirection: "supportsB" },
        { priorA: 24, pEgivenA: 88, pEgivenB: 40, evidenceDirection: "supportsA" },
        { priorA: 52, pEgivenA: 68, pEgivenB: 26, evidenceDirection: "supportsA" },
        { priorA: 74, pEgivenA: 34, pEgivenB: 70, evidenceDirection: "supportsB" },
        { priorA: 32, pEgivenA: 62, pEgivenB: 16, evidenceDirection: "supportsA" },
        { priorA: 48, pEgivenA: 84, pEgivenB: 44, evidenceDirection: "supportsA" },
        { priorA: 68, pEgivenA: 42, pEgivenB: 82, evidenceDirection: "supportsB" }
    ];
    return templates[position % templates.length];
}

function isMeaningfulCase(candidate) {
    const posterior = calcPosteriorRaw(candidate.priorA, candidate.pEgivenA, candidate.pEgivenB);
    if (!Number.isFinite(posterior)) {
        return false;
    }
    if (posterior < CASE_LIMITS.minPosterior || posterior > CASE_LIMITS.maxPosterior) {
        return false;
    }
    if (Math.abs(candidate.pEgivenA - candidate.pEgivenB) < CASE_LIMITS.minEvidenceGap) {
        return false;
    }
    return Math.abs(posterior - candidate.priorA) >= CASE_LIMITS.minUpdateDelta;
}

function buildCase(idNumber, candidate) {
    const posteriorRaw = calcPosteriorRaw(candidate.priorA, candidate.pEgivenA, candidate.pEgivenB);
    return {
        id: `bu-${String(idNumber).padStart(2, "0")}`,
        priorA: candidate.priorA,
        pEgivenA: candidate.pEgivenA,
        pEgivenB: candidate.pEgivenB,
        evidenceDirection: candidate.evidenceDirection,
        posteriorRaw: roundTo(posteriorRaw, 4),
        posterior: Math.round(posteriorRaw)
    };
}

function generateSessionCases(rng, count) {
    const targetCount = Math.max(count, MIN_CASE_COUNT);
    const cases = [];
    const seen = new Set();
    let attempts = 0;

    while (cases.length < targetCount && attempts < targetCount * 100) {
        attempts += 1;
        const candidate = createCandidate(rng);
        const key = `${candidate.priorA}-${candidate.pEgivenA}-${candidate.pEgivenB}`;
        if (seen.has(key) || !isMeaningfulCase(candidate)) {
            continue;
        }
        seen.add(key);
        cases.push(buildCase(cases.length + 1, candidate));
    }

    while (cases.length < targetCount) {
        const candidate = createFallbackCandidate(cases.length);
        cases.push(buildCase(cases.length + 1, candidate));
    }

    return cases;
}

function buildSessionCases() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed("bayes-update") : `bayes-update-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(sessionSeed) : Math.random;
    sessionCases = generateSessionCases(rng, CASE_COUNT);
    caseOrder = sessionCases.map((item) => item.id);
}

function updateLiveBoard() {
    const answered = index;
    const acc = answered === 0 ? 0 : Math.round((approxCorrect / answered) * 100);
    const mae = answered === 0 ? 0 : totalAbsError / answered;
    const total = sessionCases.length || CASE_COUNT;

    document.getElementById("progress").textContent = `${answered}/${total}`;
    document.getElementById("accuracy").textContent = `${acc}%`;
    document.getElementById("mae").textContent = formatPct(mae);
}

function renderCase() {
    const item = sessionCases[index];
    const priorB = 100 - item.priorA;
    questionEl.innerHTML = `
        <p><strong>题目 ${index + 1}</strong></p>
        <p>先验：P(A) = <strong>${item.priorA}%</strong>，P(B) = <strong>${priorB}%</strong></p>
        <p>证据强度：P(E|A) = <strong>${item.pEgivenA}%</strong>，P(E|B) = <strong>${item.pEgivenB}%</strong></p>
        <p>已观察到证据 E，估计后验 P(A|E)。</p>
    `;
    answerInput.value = "";
    answerInput.disabled = false;
    submitBtn.disabled = false;
    feedbackEl.textContent = "";
    acceptingAnswer = true;
    caseStartedAtMs = Date.now();
    answerInput.focus();
}

function submitAnswer() {
    if (!acceptingAnswer) {
        return;
    }

    const rawText = answerInput.value.trim();
    const raw = Number(rawText);
    if (rawText === "" || !Number.isFinite(raw) || raw < 0 || raw > 100) {
        feedbackEl.textContent = "请输入 0-100 的数值。";
        return;
    }

    const item = sessionCases[index];
    const correct = item.posterior;
    const error = Math.abs(raw - item.posteriorRaw);
    const isApproxCorrect = error <= 5;
    const finishedAt = new Date();

    acceptingAnswer = false;
    answerInput.disabled = true;
    submitBtn.disabled = true;
    totalAbsError += error;
    if (isApproxCorrect) {
        approxCorrect += 1;
    }

    trialLog.push({
        index,
        caseId: item.id,
        priorA: item.priorA,
        priorB: 100 - item.priorA,
        pEgivenA: item.pEgivenA,
        pEgivenB: item.pEgivenB,
        evidenceDirection: item.evidenceDirection,
        posteriorPct: roundTo(item.posteriorRaw, 2),
        roundedPosteriorPct: correct,
        userEstimatePct: raw,
        absErrorPct: roundTo(error, 2),
        approxCorrect: isApproxCorrect,
        rtMs: Math.max(0, Date.now() - caseStartedAtMs),
        submittedAt: finishedAt.toISOString()
    });

    feedbackEl.textContent = `正确值约为 ${correct}%，你的误差为 ${formatPct(error)}。`;
    index += 1;
    updateLiveBoard();

    if (index >= sessionCases.length) {
        finish();
        return;
    }

    setTimeout(renderCase, 700);
}

function finish() {
    const total = sessionCases.length;
    const acc = Math.round((approxCorrect / total) * 100);
    const accuracyRatio = roundTo(approxCorrect / total, 4);
    const mae = roundTo(totalAbsError / total, 2);
    const finishedAt = new Date();
    const durationMs = sessionStartedAt ? finishedAt.getTime() - sessionStartedAt.getTime() : 0;
    const meanRtMs = Math.round(trialLog.reduce((sum, item) => sum + item.rtMs, 0) / Math.max(1, trialLog.length));

    document.getElementById("result-acc").textContent = `${acc}%`;
    document.getElementById("result-mae").textContent = formatPct(mae);

    let message = "你已具备不错的后验更新能力。";
    if (mae > 20) {
        message = "后验估计偏差较大，建议先写出分子/分母再计算。";
    } else if (mae > 10) {
        message = "整体可用，但在先验与证据冲突时仍有偏差。";
    }
    document.getElementById("result-text").textContent = message;

    if (window.TrainingResults) {
        window.TrainingResults.saveSession({
            moduleId: "bayes-update",
            gameId: "bayes-update",
            gameName: "贝叶斯更新任务",
            startedAt: sessionStartedAt || finishedAt,
            finishedAt,
            durationMs,
            score: acc,
            summary: {
                totalTrials: total,
                correctCount: approxCorrect,
                approxCorrectCount: approxCorrect,
                accuracy: accuracyRatio,
                approxAccuracy: accuracyRatio,
                meanAbsErrorPct: mae,
                meanRtMs,
                contentVersion: CONTENT_VERSION,
                sessionSeed,
                caseOrder: caseOrder.slice(),
                generatedCaseCount: total,
                caseLimits: { ...CASE_LIMITS }
            },
            trials: trialLog.map((item) => ({ ...item })),
            metrics: {
                approxAccuracy: acc,
                mae,
                seed: sessionSeed,
                meanAbsErrorPct: mae,
                meanAbsError: formatPct(mae),
                contentVersion: CONTENT_VERSION,
                sessionSeed,
                caseOrder
            },
            tags: ["probability", "bayes-update"]
        });
    }

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    index = 0;
    approxCorrect = 0;
    totalAbsError = 0;
    sessionStartedAt = new Date();
    trialLog = [];
    acceptingAnswer = false;
    caseStartedAtMs = 0;
    buildSessionCases();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
    updateLiveBoard();
    renderCase();
}

submitBtn.addEventListener("click", submitAnswer);
answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        submitAnswer();
    }
});

window.startGame = startGame;
