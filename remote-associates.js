const MODULE_ID = "remote-associates";
const GAME_NAME = "远距联想练习";
const CONTENT_VERSION = "remote-associates-graded-hints-v5";
const SESSION_ITEM_COUNT = 12;
const PRACTICE_FEEDBACK_BOUNDARY = "本页只给远距联想练习反馈；正确率、反应时和线索距离均为本题库内的练习信号，不是诊断或标准化创造力评分。";
const HINT_LADDER = [
    { level: 1, label: "语义域提示", purpose: "缩小答案所在语义范围，不直接暴露词位。" },
    { level: 2, label: "词位结构提示", purpose: "说明答案与三个线索的前后组合方式。" },
    { level: 3, label: "答案揭示", purpose: "给出答案，用于复盘而不是计分优势。" }
];
const DIFFICULTY_PRACTICE_TARGETS = {
    easy: "巩固高频组合和快速检索。",
    medium: "练习跨情境组合，把三个线索分别前后试拼。",
    hard: "练习跨语义域或隐喻线索，先找共同结构再作答。"
};

const ALL_ITEMS = [
    {
        id: "rat-easy-flower",
        triad: ["开", "瓶", "园"],
        answer: "花",
        acceptedAnswers: ["花"],
        compounds: ["开花", "花瓶", "花园"],
        difficulty: "easy",
        semanticDistance: 1,
        clueDistanceDescription: "近距离：三个线索都能组成高频双字词。",
        hints: ["答案常见于植物相关词。", "它可以接在“开”后，也可以放在“瓶”“园”前。", "答案是：花。"]
    },
    {
        id: "rat-easy-water",
        triad: ["口", "杯", "果"],
        answer: "水",
        acceptedAnswers: ["水"],
        compounds: ["口水", "水杯", "水果"],
        difficulty: "easy",
        semanticDistance: 1,
        clueDistanceDescription: "近距离：日常名词组合，语义线索直接。",
        hints: ["答案和日常饮用有关。", "它可以组成“口__”“__杯”“__果”。", "答案是：水。"]
    },
    {
        id: "rat-easy-fire",
        triad: ["大", "车", "锅"],
        answer: "火",
        acceptedAnswers: ["火"],
        compounds: ["大火", "火车", "火锅"],
        difficulty: "easy",
        semanticDistance: 1,
        clueDistanceDescription: "近距离：三个线索均为高频生活词。",
        hints: ["答案常见于热、燃烧或食物场景。", "它能组成“大__”“__车”“__锅”。", "答案是：火。"]
    },
    {
        id: "rat-easy-electric",
        triad: ["充", "脑", "话"],
        answer: "电",
        acceptedAnswers: ["电"],
        compounds: ["充电", "电脑", "电话"],
        difficulty: "easy",
        semanticDistance: 1,
        clueDistanceDescription: "近距离：电子设备线索集中。",
        hints: ["答案和设备、能源有关。", "它能组成“充__”“__脑”“__话”。", "答案是：电。"]
    },
    {
        id: "rat-easy-grass",
        triad: ["青", "地", "莓"],
        answer: "草",
        acceptedAnswers: ["草"],
        compounds: ["青草", "草地", "草莓"],
        difficulty: "easy",
        semanticDistance: 1,
        clueDistanceDescription: "近距离：自然和食物线索都较直接。",
        hints: ["答案常见于植物或地面场景。", "它能组成“青__”“__地”“__莓”。", "答案是：草。"]
    },
    {
        id: "rat-easy-book",
        triad: ["看", "包", "店"],
        answer: "书",
        acceptedAnswers: ["书"],
        compounds: ["看书", "书包", "书店"],
        difficulty: "easy",
        semanticDistance: 1,
        clueDistanceDescription: "近距离：阅读和学习用品线索集中。",
        hints: ["答案和阅读、学习有关。", "它能组成“看__”“__包”“__店”。", "答案是：书。"]
    },
    {
        id: "rat-easy-mountain",
        triad: ["高", "水", "洞"],
        answer: "山",
        acceptedAnswers: ["山"],
        compounds: ["高山", "山水", "山洞"],
        difficulty: "easy",
        semanticDistance: 1,
        clueDistanceDescription: "近距离：自然地貌线索较直接。",
        hints: ["答案和地貌有关。", "它能组成“高__”“__水”“__洞”。", "答案是：山。"]
    },
    {
        id: "rat-easy-door",
        triad: ["开", "口", "铃"],
        answer: "门",
        acceptedAnswers: ["门"],
        compounds: ["开门", "门口", "门铃"],
        difficulty: "easy",
        semanticDistance: 1,
        clueDistanceDescription: "近距离：家庭入口线索直接。",
        hints: ["答案和入口有关。", "它能组成“开__”“__口”“__铃”。", "答案是：门。"]
    },
    {
        id: "rat-medium-heart",
        triad: ["开", "理", "中"],
        answer: "心",
        acceptedAnswers: ["心"],
        compounds: ["开心", "心理", "中心"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：情绪、心理和位置三类线索需要转换。",
        hints: ["答案可以表示情绪或位置。", "它能组成“开__”“__理”“中__”。", "答案是：心。"]
    },
    {
        id: "rat-medium-dragon",
        triad: ["恐", "舟", "头"],
        answer: "龙",
        acceptedAnswers: ["龙"],
        compounds: ["恐龙", "龙舟", "龙头"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：动物、活动和物体部件线索混合。",
        hints: ["答案和一种传统意象有关。", "它能组成“恐__”“__舟”“__头”。", "答案是：龙。"]
    },
    {
        id: "rat-medium-cloud",
        triad: ["白", "南", "梯"],
        answer: "云",
        acceptedAnswers: ["云"],
        compounds: ["白云", "云南", "云梯"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：自然、地名和工具线索混合。",
        hints: ["答案可指天空中的东西，也可出现在地名里。", "它能组成“白__”“__南”“__梯”。", "答案是：云。"]
    },
    {
        id: "rat-medium-star",
        triad: ["明", "球", "火"],
        answer: "星",
        acceptedAnswers: ["星"],
        compounds: ["明星", "星球", "火星"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：人物称谓、天体和行星线索混合。",
        hints: ["答案和天空、知名人物都能关联。", "它能组成“明__”“__球”“火__”。", "答案是：星。"]
    },
    {
        id: "rat-medium-bridge",
        triad: ["天", "梁", "过"],
        answer: "桥",
        acceptedAnswers: ["桥"],
        compounds: ["天桥", "桥梁", "过桥"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：建筑名词与动作线索混合。",
        hints: ["答案常和通行有关。", "它能组成“天__”“__梁”“过__”。", "答案是：桥。"]
    },
    {
        id: "rat-medium-wind",
        triad: ["台", "铃", "景"],
        answer: "风",
        acceptedAnswers: ["风"],
        compounds: ["台风", "风铃", "风景"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：天气、物件和景象线索混合。",
        hints: ["答案可指自然现象，也可出现在物件或景象词里。", "它能组成“台__”“__铃”“__景”。", "答案是：风。"]
    },
    {
        id: "rat-medium-light",
        triad: ["阳", "盘", "速"],
        answer: "光",
        acceptedAnswers: ["光"],
        compounds: ["阳光", "光盘", "光速"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：自然、媒介和物理概念混合。",
        hints: ["答案和明亮、介质或速度都能关联。", "它能组成“阳__”“__盘”“__速”。", "答案是：光。"]
    },
    {
        id: "rat-medium-sea",
        triad: ["上", "报", "豚"],
        answer: "海",
        acceptedAnswers: ["海"],
        compounds: ["上海", "海报", "海豚"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：地名、媒介和动物线索混合。",
        hints: ["答案可出现在地名，也可和海洋动物有关。", "它能组成“上__”“__报”“__豚”。", "答案是：海。"]
    },
    {
        id: "rat-medium-line",
        triad: ["红", "路", "索"],
        answer: "线",
        acceptedAnswers: ["线"],
        compounds: ["红线", "线路", "线索"],
        difficulty: "medium",
        semanticDistance: 2,
        clueDistanceDescription: "中距离：颜色边界、路径和推理线索混合。",
        hints: ["答案可表示细长物、路径或推理方向。", "它能组成“红__”“__路”“__索”。", "答案是：线。"]
    },
    {
        id: "rat-hard-ink",
        triad: ["水", "镜", "笔"],
        answer: "墨",
        acceptedAnswers: ["墨"],
        compounds: ["水墨", "墨镜", "笔墨"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：艺术材料、物品和书写概念跨域。",
        hints: ["答案和书写、颜色或传统绘画有关。", "它能组成“水__”“__镜”“笔__”。", "答案是：墨。"]
    },
    {
        id: "rat-hard-cold",
        triad: ["假", "冷", "伤"],
        answer: "寒",
        acceptedAnswers: ["寒"],
        compounds: ["寒假", "寒冷", "伤寒"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：时间、温度和疾病线索跨域。",
        hints: ["答案和冷有关，但不只表示温度。", "它能组成“__假”“__冷”“伤__”。", "答案是：寒。"]
    },
    {
        id: "rat-hard-wing",
        triad: ["机", "龙", "羽"],
        answer: "翼",
        acceptedAnswers: ["翼"],
        compounds: ["机翼", "翼龙", "羽翼"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：机械、古生物和身体部位线索混合。",
        hints: ["答案和飞行结构有关。", "它能组成“机__”“__龙”“羽__”。", "答案是：翼。"]
    },
    {
        id: "rat-hard-string",
        triad: ["琴", "月", "心"],
        answer: "弦",
        acceptedAnswers: ["弦"],
        compounds: ["琴弦", "弦月", "心弦"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：乐器、天象和情感隐喻线索混合。",
        hints: ["答案可指乐器上的细线，也可用于比喻。", "它能组成“琴__”“__月”“心__”。", "答案是：弦。"]
    },
    {
        id: "rat-hard-shadow",
        triad: ["电", "背", "倒"],
        answer: "影",
        acceptedAnswers: ["影"],
        compounds: ["电影", "背影", "倒影"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：媒介、人物轮廓和反射线索混合。",
        hints: ["答案和光线或画面有关。", "它能组成“电__”“背__”“倒__”。", "答案是：影。"]
    },
    {
        id: "rat-hard-tide",
        triad: ["海", "思", "流"],
        answer: "潮",
        acceptedAnswers: ["潮"],
        compounds: ["海潮", "思潮", "潮流"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：自然现象、思想和流行趋势跨域。",
        hints: ["答案可指水面变化，也可用于思想或流行。", "它能组成“海__”“思__”“__流”。", "答案是：潮。"]
    },
    {
        id: "rat-hard-wheel",
        triad: ["年", "齿", "回"],
        answer: "轮",
        acceptedAnswers: ["轮"],
        compounds: ["年轮", "齿轮", "轮回"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：时间痕迹、机械部件和循环概念跨域。",
        hints: ["答案可指圆形结构，也可表示循环。", "它能组成“年__”“齿__”“__回”。", "答案是：轮。"]
    },
    {
        id: "rat-hard-score",
        triad: ["乐", "族", "食"],
        answer: "谱",
        acceptedAnswers: ["谱"],
        compounds: ["乐谱", "族谱", "食谱"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：音乐、亲属记录和烹饪说明跨域。",
        hints: ["答案可表示成体系的记录或说明。", "它能组成“乐__”“族__”“食__”。", "答案是：谱。"]
    },
    {
        id: "rat-hard-curtain",
        triad: ["开", "夜", "银"],
        answer: "幕",
        acceptedAnswers: ["幕"],
        compounds: ["开幕", "夜幕", "银幕"],
        difficulty: "hard",
        semanticDistance: 3,
        clueDistanceDescription: "远距离：事件、时间氛围和影像媒介跨域。",
        hints: ["答案可和舞台或画面有关，也可指夜色。", "它能组成“开__”“夜__”“银__”。", "答案是：幕。"]
    }
];
const ITEM_BANK = ALL_ITEMS.map((item) => ({
    ...item,
    itemId: item.itemId || item.id,
    cueWords: item.cueWords || item.triad.slice(),
    correctAnswer: item.correctAnswer || item.answer,
    associationDistance: item.associationDistance || item.semanticDistance,
    associationDistanceDescription: item.associationDistanceDescription || item.clueDistanceDescription
}));

let index = 0;
let correctCount = 0;
let elapsed = 0;
let timer = null;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionItems = [];
let itemOrder = [];
let trialLog = [];
let trialStartedAtMs = 0;
let currentHintLevel = 0;
let locked = false;
let sessionSaved = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("rat-panel");
const resultModal = document.getElementById("result-modal");
const triadEl = document.getElementById("triad");
const answerEl = document.getElementById("answer");
const feedback = document.getElementById("feedback");
const hintEl = document.getElementById("hint-text");
const hintBtn = document.getElementById("hint-btn");
const giveUpBtn = document.getElementById("giveup-btn");

function nowMs() {
    return window.performance && typeof window.performance.now === "function"
        ? window.performance.now()
        : Date.now();
}

function roundMetric(value, digits = 3) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function normalize(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/[，。！？、,.!?;；:\s]+/g, "");
}

function shuffle(list, rng) {
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

function pickBalancedItems(rng) {
    const groups = {
        easy: shuffle(ITEM_BANK.filter((item) => item.difficulty === "easy"), rng),
        medium: shuffle(ITEM_BANK.filter((item) => item.difficulty === "medium"), rng),
        hard: shuffle(ITEM_BANK.filter((item) => item.difficulty === "hard"), rng)
    };
    const selected = [
        ...groups.easy.slice(0, 4),
        ...groups.medium.slice(0, 4),
        ...groups.hard.slice(0, 4)
    ];
    return shuffle(selected, rng).slice(0, SESSION_ITEM_COUNT);
}

function updateBoard() {
    document.getElementById("progress").textContent = String(Math.min(index + 1, sessionItems.length));
    document.getElementById("correct").textContent = String(correctCount);
    document.getElementById("time").textContent = `${elapsed}s`;
}

function buildSessionItems() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed(MODULE_ID) : `${MODULE_ID}-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(`${sessionSeed}:${CONTENT_VERSION}`) : Math.random;
    sessionItems = pickBalancedItems(rng);
    itemOrder = sessionItems.map((item) => item.itemId);
}

function renderQuestion() {
    const item = sessionItems[index];
    if (!item) {
        finish();
        return;
    }
    locked = false;
    currentHintLevel = 0;
    trialStartedAtMs = nowMs();
    triadEl.textContent = item.triad.join("  ·  ");
    answerEl.value = "";
    feedback.textContent = item.clueDistanceDescription;
    if (hintEl) {
        hintEl.textContent = "";
    }
    answerEl.disabled = false;
    if (hintBtn) {
        hintBtn.disabled = false;
    }
    if (giveUpBtn) {
        giveUpBtn.disabled = false;
    }
    answerEl.focus();
    updateBoard();
}

function isCorrectResponse(response, item) {
    const normalized = normalize(response);
    return item.acceptedAnswers.some((answer) => normalize(answer) === normalized);
}

function mean(values) {
    const valid = values.filter((value) => Number.isFinite(value));
    if (valid.length === 0) {
        return 0;
    }
    return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function pushTrial({ abandoned }) {
    const item = sessionItems[index];
    const response = answerEl.value.trim();
    const correct = !abandoned && isCorrectResponse(response, item);
    const rtMs = Math.max(0, Math.round(nowMs() - trialStartedAtMs));
    const hintUsage = {
        levelUsed: currentHintLevel,
        hintsAvailable: item.hints.length,
        usedAnyHint: currentHintLevel > 0,
        revealedHints: item.hints.slice(0, currentHintLevel),
        ladder: HINT_LADDER.slice(0, item.hints.length)
    };
    const trial = {
        trialIndex: index,
        itemId: item.itemId,
        cueWords: item.cueWords.slice(),
        triad: item.cueWords.slice(),
        correctAnswer: item.correctAnswer,
        acceptedAnswers: item.acceptedAnswers.slice(),
        compounds: item.compounds.slice(),
        response,
        correct,
        abandoned,
        abandon: abandoned,
        gaveUp: abandoned,
        rtMs,
        responseTimeMs: rtMs,
        responseTimeSec: roundMetric(rtMs / 1000, 2),
        hintLevelUsed: currentHintLevel,
        hintStage: currentHintLevel === 0
            ? "no-hint"
            : (HINT_LADDER[currentHintLevel - 1] || { label: "提示" }).label,
        hintsAvailable: item.hints.length,
        hintUsage,
        difficulty: item.difficulty,
        difficultyPracticeTarget: DIFFICULTY_PRACTICE_TARGETS[item.difficulty],
        semanticDistance: item.semanticDistance,
        associationDistance: item.associationDistance,
        clueDistanceDescription: item.clueDistanceDescription,
        associationDistanceDescription: item.associationDistanceDescription,
        practiceFeedbackBoundary: PRACTICE_FEEDBACK_BOUNDARY,
        nonStandardizedScoring: true,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    };
    trialLog.push(trial);
    if (correct) {
        correctCount += 1;
    }
    return trial;
}

function advanceWithFeedback(text) {
    locked = true;
    feedback.textContent = text;
    answerEl.disabled = true;
    if (hintBtn) {
        hintBtn.disabled = true;
    }
    if (giveUpBtn) {
        giveUpBtn.disabled = true;
    }

    index += 1;
    if (index >= sessionItems.length) {
        finish();
        return;
    }
    setTimeout(() => {
        renderQuestion();
    }, 550);
}

function submitAnswer(abandoned = false) {
    if (locked || index >= sessionItems.length) {
        return;
    }
    const item = sessionItems[index];
    const trial = pushTrial({ abandoned });
    if (trial.correct) {
        advanceWithFeedback("正确");
    } else if (abandoned) {
        advanceWithFeedback(`已放弃，参考答案：${item.answer}（${item.compounds.join(" / ")}）`);
    } else {
        advanceWithFeedback(`不正确，参考答案：${item.answer}（${item.compounds.join(" / ")}）`);
    }
}

function showHint() {
    if (locked || index >= sessionItems.length) {
        return;
    }
    const item = sessionItems[index];
    if (currentHintLevel >= item.hints.length) {
        return;
    }
    currentHintLevel += 1;
    if (hintEl) {
        hintEl.textContent = `提示 ${currentHintLevel}/${item.hints.length}: ${item.hints[currentHintLevel - 1]}`;
    }
    if (hintBtn && currentHintLevel >= item.hints.length) {
        hintBtn.disabled = true;
    }
}

function byDifficulty(metricBuilder) {
    return ["easy", "medium", "hard"].reduce((result, difficulty) => {
        const items = trialLog.filter((trial) => trial.difficulty === difficulty);
        result[difficulty] = metricBuilder(items);
        return result;
    }, {});
}

function buildHintUsage() {
    const total = trialLog.length;
    if (total === 0) {
        return {
            hintedTrials: 0,
            hintedTrialRate: 0,
            meanHintLevel: 0,
            totalHintsUsed: 0,
            maxHintLevelUsed: 0,
            byLevel: {
                0: 0,
                1: 0,
                2: 0,
                3: 0
            }
        };
    }
    const byLevel = trialLog.reduce((result, trial) => {
        const level = trial.hintLevelUsed;
        result[level] = (result[level] || 0) + 1;
        return result;
    }, {
        0: 0,
        1: 0,
        2: 0,
        3: 0
    });
    const totalHintsUsed = trialLog.reduce((sum, trial) => sum + trial.hintLevelUsed, 0);
    const hintedTrials = trialLog.filter((trial) => trial.hintLevelUsed > 0).length;
    return {
        hintedTrials,
        hintedTrialRate: roundMetric(hintedTrials / total, 3),
        meanHintLevel: roundMetric(totalHintsUsed / total, 2),
        totalHintsUsed,
        maxHintLevelUsed: Math.max(...trialLog.map((trial) => trial.hintLevelUsed)),
        byLevel
    };
}

function buildDifficultyBreakdown() {
    return byDifficulty((trials) => ({
        total: trials.length,
        correct: trials.filter((trial) => trial.correct).length,
        abandoned: trials.filter((trial) => trial.abandoned).length,
        accuracy: accuracyFor(trials),
        giveUpRate: giveUpRateFor(trials),
        meanRtMs: mean(trials.map((trial) => trial.rtMs)),
        meanHintLevel: trials.length === 0
            ? 0
            : roundMetric(trials.reduce((sum, trial) => sum + trial.hintLevelUsed, 0) / trials.length, 2)
    }));
}

function accuracyFor(trials) {
    if (trials.length === 0) {
        return 0;
    }
    return roundMetric(trials.filter((trial) => trial.correct).length / trials.length, 3);
}

function giveUpRateFor(trials) {
    if (trials.length === 0) {
        return 0;
    }
    return roundMetric(trials.filter((trial) => trial.abandoned).length / trials.length, 3);
}

function buildNextPracticeRecommendation(summary) {
    if (summary.giveUpRate >= 0.25) {
        return {
            level: "reduce-distance",
            text: "下一轮先降低远距离题比例，并在第 1 层提示后再作答，减少直接放弃。"
        };
    }
    if (summary.accuracy >= 0.8 && summary.meanHintLevel <= 0.5) {
        return {
            level: "increase-distance",
            text: "下一轮可以提高 hard 题比例，重点练跨语义域联想。"
        };
    }
    if ((summary.accuracyByDifficulty.hard || 0) < 0.4) {
        return {
            level: "hard-clue-practice",
            text: "下一轮保留中等难度，先练习把线索分别放在答案前后组成词。"
        };
    }
    return {
        level: "hold",
        text: "下一轮维持当前难度，尝试在少用提示的情况下缩短反应时。"
    };
}

function serializeItemMetadata(item) {
    return {
        itemId: item.itemId,
        difficulty: item.difficulty,
        cueWords: item.cueWords.slice(),
        correctAnswer: item.correctAnswer,
        semanticDistance: item.semanticDistance,
        associationDistance: item.associationDistance,
        distanceDescription: item.associationDistanceDescription,
        compounds: item.compounds.slice()
    };
}

function buildSummary() {
    const total = sessionItems.length;
    const correct = trialLog.filter((trial) => trial.correct).length;
    const abandoned = trialLog.filter((trial) => trial.abandoned).length;
    const hintUsage = buildHintUsage();
    const difficultyBreakdown = buildDifficultyBreakdown();
    const summary = {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        itemOrder,
        itemBank: sessionItems.map(serializeItemMetadata),
        itemBankVersion: CONTENT_VERSION,
        itemPoolSize: ITEM_BANK.length,
        hintLadder: HINT_LADDER.slice(),
        difficultyPracticeTargets: { ...DIFFICULTY_PRACTICE_TARGETS },
        practiceFeedbackBoundary: PRACTICE_FEEDBACK_BOUNDARY,
        nonStandardizedScoring: true,
        total,
        completedTrials: trialLog.length,
        correct,
        abandoned,
        attempted: total - abandoned,
        accuracy: total === 0 ? 0 : roundMetric(correct / total, 3),
        giveUpRate: total === 0 ? 0 : roundMetric(abandoned / total, 3),
        meanRtMs: mean(trialLog.map((trial) => trial.rtMs)),
        correctMeanRtMs: mean(trialLog.filter((trial) => trial.correct).map((trial) => trial.rtMs)),
        hintUsage,
        meanHintLevel: hintUsage.meanHintLevel,
        hintedTrialRate: hintUsage.hintedTrialRate,
        difficultyBreakdown,
        accuracyByDifficulty: byDifficulty(accuracyFor),
        giveUpRateByDifficulty: byDifficulty(giveUpRateFor),
        meanRtByDifficulty: byDifficulty((trials) => mean(trials.map((trial) => trial.rtMs))),
        semanticDistanceScale: {
            1: "近距离线索：高频、同一生活域组合。",
            2: "中距离线索：需要跨情境组合。",
            3: "远距离线索：跨语义域或隐喻关系组合。"
        },
        cueDistanceBoundary: "线索距离是本题库内的练习分级，不是标准化语义距离测量。"
    };
    summary.nextPracticeRecommendation = buildNextPracticeRecommendation(summary);
    summary.nextRecommendation = summary.nextPracticeRecommendation;
    return summary;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = value;
    }
}

function saveTrainingSession(finishedAt, summary) {
    if (sessionSaved || !window.TrainingResults || typeof window.TrainingResults.saveSession !== "function") {
        return;
    }
    const startedAt = sessionStartedAt || finishedAt;
    window.TrainingResults.saveSession({
        moduleId: MODULE_ID,
        gameId: MODULE_ID,
        gameName: GAME_NAME,
        startedAt,
        finishedAt,
        durationMs: Math.max(0, finishedAt.getTime() - startedAt.getTime()),
        score: summary.correct,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        summary,
        trials: trialLog.map((trial) => ({ ...trial })),
        metrics: {
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            nonStandardizedScoring: true,
            total: summary.total,
            correct: summary.correct,
            accuracy: summary.accuracy,
            giveUpRate: summary.giveUpRate,
            meanRtMs: summary.meanRtMs,
            correctMeanRtMs: summary.correctMeanRtMs,
            hintUsage: summary.hintUsage,
            meanHintLevel: summary.meanHintLevel,
            hintedTrialRate: summary.hintedTrialRate,
            difficultyBreakdown: summary.difficultyBreakdown,
            accuracyByDifficulty: summary.accuracyByDifficulty,
            giveUpRateByDifficulty: summary.giveUpRateByDifficulty,
            meanRtByDifficulty: summary.meanRtByDifficulty,
            semanticDistanceScale: summary.semanticDistanceScale,
            cueDistanceBoundary: summary.cueDistanceBoundary,
            hintLadder: summary.hintLadder,
            difficultyPracticeTargets: summary.difficultyPracticeTargets,
            practiceFeedbackBoundary: summary.practiceFeedbackBoundary,
            nextRecommendation: summary.nextRecommendation,
            nextPracticeRecommendation: summary.nextPracticeRecommendation
        },
        tags: ["creativity", "remote-associates", "convergent-thinking"]
    });
    sessionSaved = true;
}

function finish() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    const finishedAt = new Date();
    const summary = buildSummary();

    setText("result-acc", formatPercent(summary.accuracy));
    setText("result-avg-time", `${(summary.meanRtMs / 1000).toFixed(1)}s`);
    setText("result-total-time", `放弃 ${summary.abandoned} 题 / 平均提示 ${summary.meanHintLevel}`);
    setText("result-note", `${summary.cueDistanceBoundary} ${summary.nextPracticeRecommendation.text}`);

    saveTrainingSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    index = 0;
    correctCount = 0;
    elapsed = 0;
    trialLog = [];
    sessionStartedAt = new Date();
    sessionSaved = false;
    buildSessionItems();

    if (timer) {
        clearInterval(timer);
    }
    timer = setInterval(() => {
        elapsed += 1;
        document.getElementById("time").textContent = `${elapsed}s`;
    }, 1000);

    renderQuestion();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

document.getElementById("submit-btn").addEventListener("click", () => submitAnswer(false));
if (hintBtn) {
    hintBtn.addEventListener("click", showHint);
}
if (giveUpBtn) {
    giveUpBtn.addEventListener("click", () => submitAnswer(true));
}
answerEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        submitAnswer(false);
    }
});

window.startGame = startGame;
