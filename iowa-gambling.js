const MODULE_ID = "iowa-gambling";
const GAME_NAME = "爱荷华赌博任务";
const CONTENT_VERSION = "iowa-gambling-igt-seeded-v1";
const TOTAL_TRIALS = 60;
const BLOCK_SIZE = 10;
const INITIAL_BALANCE = 2000;

const DECK_TEMPLATE = {
    A: {
        gain: 100,
        losses: [0, -150, 0, -300, -200, 0, -250, 0, -350, -200],
        advantageous: false,
        label: "短期高收益 / 长期不利"
    },
    B: {
        gain: 100,
        losses: [0, 0, 0, -1250, 0, 0, 0, 0, 0, 0],
        advantageous: false,
        label: "短期高收益 / 长期不利"
    },
    C: {
        gain: 50,
        losses: [0, -25, -50, 0, -75, 0, -25, -50, 0, -75],
        advantageous: true,
        label: "短期低收益 / 长期有利"
    },
    D: {
        gain: 50,
        losses: [0, 0, -250, 0, 0, 0, -250, 0, 0, 0],
        advantageous: true,
        label: "短期低收益 / 长期有利"
    }
};

let trial = 0;
let balance = INITIAL_BALANCE;
let advantageousChoices = 0;
let sessionStartedAt = null;
let sessionSeed = "";
let deckState = null;
let trialLog = [];
let sessionSaved = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("igt-panel");
const resultModal = document.getElementById("result-modal");
const feedback = document.getElementById("feedback");
const logEl = document.getElementById("log");

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

function randomToken() {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
        const bytes = new Uint32Array(2);
        window.crypto.getRandomValues(bytes);
        return `${bytes[0].toString(36)}${bytes[1].toString(36)}`;
    }
    return Math.floor(Math.random() * 1e9).toString(36);
}

function createSessionSeed() {
    if (window.SeededRandom && typeof window.SeededRandom.createSessionSeed === "function") {
        return window.SeededRandom.createSessionSeed(MODULE_ID);
    }

    const params = new URLSearchParams(window.location.search);
    const urlSeed = params.get("seed");
    if (urlSeed && urlSeed.trim()) {
        return urlSeed.trim();
    }
    return `${MODULE_ID}-${Date.now().toString(36)}-${randomToken()}`;
}

function createRng(seed) {
    if (window.SeededRandom && typeof window.SeededRandom.createRngFromSeed === "function") {
        return window.SeededRandom.createRngFromSeed(seed);
    }
    return fallbackMulberry32(fallbackHashString(seed));
}

function shuffleCopy(list, rng) {
    const copy = list.slice();
    if (window.SeededRandom && typeof window.SeededRandom.shuffleInPlace === "function") {
        return window.SeededRandom.shuffleInPlace(copy, rng);
    }

    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}

function ratio(numerator, denominator) {
    return denominator > 0 ? numerator / denominator : 0;
}

function roundTo(value, digits = 3) {
    const factor = 10 ** digits;
    return Number.isFinite(value) ? Math.round(value * factor) / factor : 0;
}

function formatSigned(value) {
    return value >= 0 ? `+${value}` : String(value);
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function getDeckCycleNet(deckName) {
    const template = DECK_TEMPLATE[deckName];
    return template.gain * template.losses.length + sum(template.losses);
}

function buildDeckStructure() {
    const structure = {};
    Object.keys(DECK_TEMPLATE).forEach((deckName) => {
        const template = DECK_TEMPLATE[deckName];
        const totalLossPerCycle = sum(template.losses);
        structure[deckName] = {
            deck: deckName,
            gain: template.gain,
            losses: template.losses.slice(),
            netPerTenCards: getDeckCycleNet(deckName),
            totalLossPerTenCards: totalLossPerCycle,
            advantageous: template.advantageous,
            label: template.label
        };
    });
    return structure;
}

function buildDeckCards(deckName, seed) {
    const template = DECK_TEMPLATE[deckName];
    const cycles = Math.ceil(TOTAL_TRIALS / template.losses.length);
    const rng = createRng(`${seed}:${CONTENT_VERSION}:deck:${deckName}`);
    const cards = [];

    for (let cycleIndex = 0; cycleIndex < cycles; cycleIndex += 1) {
        const lossSchedule = template.losses.map((loss, patternIndex) => ({ loss, patternIndex }));
        shuffleCopy(lossSchedule, rng).forEach((entry) => {
            const gain = template.gain;
            cards.push({
                deck: deckName,
                deckCardIndex: cards.length,
                cycleIndex,
                patternIndex: entry.patternIndex,
                gain,
                loss: entry.loss,
                net: gain + entry.loss,
                advantageous: template.advantageous,
                deckLabel: template.label,
                expectedNetPerTenCards: getDeckCycleNet(deckName),
                contentVersion: CONTENT_VERSION
            });
        });
    }

    return cards;
}

function cloneDeckState(seed) {
    const state = {};
    Object.keys(DECK_TEMPLATE).forEach((key) => {
        state[key] = {
            gain: DECK_TEMPLATE[key].gain,
            losses: DECK_TEMPLATE[key].losses.slice(),
            advantageous: DECK_TEMPLATE[key].advantageous,
            cards: buildDeckCards(key, seed),
            index: 0
        };
    });
    return state;
}

function updateBoard() {
    const advRate = trial === 0 ? 0 : Math.round((advantageousChoices / trial) * 100);
    document.getElementById("trial").textContent = String(trial);
    document.getElementById("balance").textContent = String(balance);
    document.getElementById("adv-rate").textContent = `${advRate}%`;
}

function appendLog(text) {
    const p = document.createElement("p");
    p.textContent = text;
    logEl.prepend(p);
}

function copyTrialRecord(record) {
    return {
        ...record,
        card: { ...record.card }
    };
}

function getDeckDrawCounts() {
    return Object.keys(DECK_TEMPLATE).reduce((counts, deckName) => {
        counts[deckName] = trialLog.filter((record) => record.deck === deckName).length;
        return counts;
    }, {});
}

function buildBlockStats() {
    const blockCount = Math.ceil(TOTAL_TRIALS / BLOCK_SIZE);
    const blocks = Array.from({ length: blockCount }, (_item, blockIndex) => ({
        blockIndex,
        trialStart: blockIndex * BLOCK_SIZE + 1,
        trialEnd: Math.min((blockIndex + 1) * BLOCK_SIZE, TOTAL_TRIALS),
        totalNet: 0,
        advantageousChoices: 0,
        disadvantageousChoices: 0,
        choiceBalance: 0
    }));

    trialLog.forEach((record) => {
        const block = blocks[record.blockIndex];
        if (!block) return;
        block.totalNet += record.net;
        if (record.advantageous) {
            block.advantageousChoices += 1;
        } else {
            block.disadvantageousChoices += 1;
        }
        block.choiceBalance = block.advantageousChoices - block.disadvantageousChoices;
    });

    return blocks;
}

function sumBlockField(blocks, field) {
    return blocks.reduce((total, block) => total + block[field], 0);
}

function analyzeLearningTrend(blockStats) {
    const earlyBlocks = blockStats.slice(0, 2);
    const lateBlocks = blockStats.slice(-2);
    const earlyChoiceBalance = sumBlockField(earlyBlocks, "choiceBalance");
    const lateChoiceBalance = sumBlockField(lateBlocks, "choiceBalance");
    const earlyNet = sumBlockField(earlyBlocks, "totalNet");
    const lateNet = sumBlockField(lateBlocks, "totalNet");
    const choiceBalanceDelta = lateChoiceBalance - earlyChoiceBalance;
    let status = "mixed";

    if (lateChoiceBalance > 0 && choiceBalanceDelta >= 4) {
        status = "shifted_to_advantageous";
    } else if (lateChoiceBalance > 0 && earlyChoiceBalance > 0) {
        status = "maintained_advantageous";
    } else if (lateChoiceBalance > 0) {
        status = "late_advantageous";
    } else if (choiceBalanceDelta >= 4) {
        status = "partial_shift_to_advantageous";
    } else if (lateChoiceBalance < 0 && choiceBalanceDelta <= -4) {
        status = "shifted_to_short_term";
    } else if (lateChoiceBalance < 0) {
        status = "remained_short_term";
    }

    return {
        status,
        earlyChoiceBalance,
        lateChoiceBalance,
        choiceBalanceDelta,
        earlyNet,
        lateNet,
        netDelta: lateNet - earlyNet
    };
}

function learningTrendLabel(status) {
    if (status === "shifted_to_advantageous") return "明显转向长期有利牌堆";
    if (status === "partial_shift_to_advantageous") return "有转向迹象";
    if (status === "maintained_advantageous") return "持续偏向长期有利牌堆";
    if (status === "late_advantageous") return "后半程偏向长期有利牌堆";
    if (status === "shifted_to_short_term") return "后半程转向短期高收益牌堆";
    if (status === "remained_short_term") return "仍偏向短期高收益牌堆";
    return "选择模式混合";
}

function buildResultFeedback(summary) {
    const trend = summary.learningTrendDetails;
    const early = formatSigned(trend.earlyChoiceBalance);
    const late = formatSigned(trend.lateChoiceBalance);
    const delta = formatSigned(trend.choiceBalanceDelta);

    if (summary.learningTrend === "shifted_to_advantageous") {
        return `你在后半程减少了 A/B 短期高收益牌堆，更多转向 C/D 长期有利牌堆。前 20 轮选择平衡为 ${early}，后 20 轮为 ${late}，变化 ${delta}。`;
    }
    if (summary.learningTrend === "partial_shift_to_advantageous" || summary.learningTrend === "late_advantageous") {
        return `后半程已经出现向 C/D 长期有利牌堆靠拢的迹象，但转向还不稳定。前 20 轮选择平衡为 ${early}，后 20 轮为 ${late}。`;
    }
    if (summary.learningTrend === "maintained_advantageous") {
        return `整轮基本保持对 C/D 长期有利牌堆的偏好，说明你较少被 A/B 的高即时收益吸引。前 20 轮选择平衡为 ${early}，后 20 轮为 ${late}。`;
    }
    if (summary.learningTrend === "shifted_to_short_term" || summary.learningTrend === "remained_short_term") {
        return `本轮后半程仍较多选择 A/B 短期高收益牌堆，长期收益线索没有充分转化为稳定策略。前 20 轮选择平衡为 ${early}，后 20 轮为 ${late}。`;
    }
    return `本轮选择在短期高收益牌堆和长期有利牌堆之间来回摆动。前 20 轮选择平衡为 ${early}，后 20 轮为 ${late}。`;
}

function buildSummary() {
    const totalTrials = trialLog.length;
    const advantageousCount = trialLog.filter((record) => record.advantageous).length;
    const disadvantageousCount = totalTrials - advantageousCount;
    const totalNet = balance - INITIAL_BALANCE;
    const blockStats = buildBlockStats();
    const learningTrendDetails = analyzeLearningTrend(blockStats);

    return {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        totalTrials,
        plannedTrials: TOTAL_TRIALS,
        finalBalance: balance,
        totalNet,
        advantageousChoices: advantageousCount,
        disadvantageousChoices: disadvantageousCount,
        advantageousMinusDisadvantageous: advantageousCount - disadvantageousCount,
        advantageousRate: roundTo(ratio(advantageousCount, totalTrials)),
        blockNetScores: blockStats.map((block) => block.totalNet),
        blockChoiceBalance: blockStats.map((block) => block.choiceBalance),
        learningTrend: learningTrendDetails.status,
        learningTrendDetails,
        blockStats,
        deckDrawCounts: getDeckDrawCounts(),
        deckStructure: buildDeckStructure()
    };
}

function saveTrainingSession(finishedAt, summary) {
    if (sessionSaved || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") return;

    const startedAt = sessionStartedAt || finishedAt;
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());

    window.TrainingResults.saveSession({
        moduleId: MODULE_ID,
        gameId: MODULE_ID,
        gameName: GAME_NAME,
        startedAt,
        finishedAt,
        durationMs,
        score: balance,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        summary,
        trials: trialLog.map(copyTrialRecord),
        metrics: {
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            totalTrials: summary.totalTrials,
            finalBalance: summary.finalBalance,
            totalNet: summary.totalNet,
            advantageousChoices: summary.advantageousChoices,
            disadvantageousChoices: summary.disadvantageousChoices,
            advantageousMinusDisadvantageous: summary.advantageousMinusDisadvantageous,
            advantageousRate: summary.advantageousRate,
            blockNetScores: summary.blockNetScores.slice(),
            blockChoiceBalance: summary.blockChoiceBalance.slice(),
            learningTrend: summary.learningTrend,
            learningTrendDetails: { ...summary.learningTrendDetails },
            deckDrawCounts: { ...summary.deckDrawCounts }
        },
        tags: ["decision-making", "iowa-gambling", "long-term-reward", "impulse-control"]
    });

    sessionSaved = true;
}

function chooseDeck(name) {
    if (trial >= TOTAL_TRIALS) {
        return;
    }

    const deck = deckState[name];
    const card = deck.cards[deck.index % deck.cards.length];
    const trialIndex = trial;
    const blockIndex = Math.floor(trialIndex / BLOCK_SIZE);
    const balanceBefore = balance;
    const gain = card.gain;
    const loss = card.loss;
    const delta = card.net;
    const balanceAfter = balanceBefore + delta;
    deck.index += 1;

    trial += 1;
    balance = balanceAfter;
    if (deck.advantageous) {
        advantageousChoices += 1;
    }

    const record = {
        index: trialIndex,
        trialIndex,
        trialNumber: trialIndex + 1,
        blockIndex,
        deck: name,
        deckDrawIndex: deck.index - 1,
        gain,
        loss,
        net: delta,
        balanceBefore,
        balanceAfter,
        advantageous: deck.advantageous,
        deckLabel: DECK_TEMPLATE[name].label,
        card: {
            ...card,
            blockIndex
        },
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    };
    trialLog.push(record);

    const deltaText = formatSigned(delta);
    const lossText = formatSigned(loss);
    feedback.textContent = `选择牌堆 ${name}，收益 +${gain}，损失 ${lossText}，净变化 ${deltaText}`;
    appendLog(`第 ${trial} 轮：${name} 堆 -> 收益 +${gain} / 损失 ${lossText} / 净 ${deltaText}，余额 ${balance}`);
    updateBoard();

    if (trial >= TOTAL_TRIALS) {
        finish();
    }
}

function finish() {
    const finishedAt = new Date();
    const summary = buildSummary();

    document.getElementById("result-balance").textContent = String(balance);
    document.getElementById("result-net").textContent = formatSigned(summary.totalNet);
    document.getElementById("result-adv-rate").textContent = formatPercent(summary.advantageousRate);
    document.getElementById("result-choice-balance").textContent = formatSigned(summary.advantageousMinusDisadvantageous);
    document.getElementById("result-learning-trend").textContent = learningTrendLabel(summary.learningTrend);
    document.getElementById("result-feedback").textContent = buildResultFeedback(summary);
    document.getElementById("result-seed").textContent = sessionSeed;

    saveTrainingSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    trial = 0;
    balance = INITIAL_BALANCE;
    advantageousChoices = 0;
    sessionStartedAt = new Date();
    sessionSeed = createSessionSeed();
    deckState = cloneDeckState(sessionSeed);
    trialLog = [];
    sessionSaved = false;

    logEl.innerHTML = "";
    feedback.textContent = "请选择一个牌堆。";
    updateBoard();

    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

document.querySelectorAll(".deck-btn").forEach((button) => {
    button.addEventListener("click", () => chooseDeck(button.dataset.deck));
});

window.startGame = startGame;
