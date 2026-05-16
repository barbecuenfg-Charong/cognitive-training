const MODULE_ID = "alternative-uses";
const GAME_NAME = "替代用途练习";
const CONTENT_VERSION = "alternative-uses-training-feedback-v4";
const ROUND_SECONDS = 60;
const ROUND_COUNT = 3;
const ORIGINALITY_HEURISTIC_METHOD = "valid-use-rare-category-plus-elaboration";
const ORIGINALITY_HEURISTIC_NOTE = "originalityHeuristic 只标记本轮类别稀有且细节较充分的回答，用于练习反馈，不是标准化创造力或常模分数。";
const PRACTICE_FEEDBACK_BOUNDARY = "本练习只基于本轮文本给出 fluency/flexibility/elaboration 练习反馈，不作诊断、排名或标准化创造力评分。";
const PROMPT_DIFFICULTY_PLAN = ["easy", "medium", "hard"];
const PRACTICE_SCORING_BOUNDARY = {
    nonStandardizedScoring: true,
    fluency: "有效、非重复、非空泛用途数量。",
    flexibility: "本练习规则类别覆盖数。",
    elaboration: "有效答案中场景、动作、目的和细节信号的均值。",
    originality: ORIGINALITY_HEURISTIC_NOTE,
    feedbackUse: "用于下一轮练习调参，不用于能力诊断或常模比较。"
};

const ALL_PROMPTS = [
    {
        id: "aut-brick-home",
        baseObject: "砖头",
        variant: "家庭场景",
        text: "砖头（家庭场景）",
        difficulty: "easy"
    },
    {
        id: "aut-brick-outdoor",
        baseObject: "砖头",
        variant: "户外/临时工具",
        text: "砖头（户外或临时工具）",
        difficulty: "medium"
    },
    {
        id: "aut-paperclip-office",
        baseObject: "回形针",
        variant: "办公/维修",
        text: "回形针（办公或维修）",
        difficulty: "easy"
    },
    {
        id: "aut-paperclip-travel",
        baseObject: "回形针",
        variant: "旅行/应急",
        text: "回形针（旅行或应急）",
        difficulty: "medium"
    },
    {
        id: "aut-bottle-home",
        baseObject: "塑料瓶",
        variant: "家庭改造",
        text: "塑料瓶（家庭改造）",
        difficulty: "easy"
    },
    {
        id: "aut-bottle-garden",
        baseObject: "塑料瓶",
        variant: "园艺/户外",
        text: "塑料瓶（园艺或户外）",
        difficulty: "medium"
    },
    {
        id: "aut-cardboard-education",
        baseObject: "纸板",
        variant: "学习/游戏",
        text: "纸板（学习或游戏）",
        difficulty: "medium"
    },
    {
        id: "aut-towel-emergency",
        baseObject: "毛巾",
        variant: "应急/旅行",
        text: "毛巾（应急或旅行）",
        difficulty: "medium"
    },
    {
        id: "aut-newspaper-protection",
        baseObject: "旧报纸",
        variant: "保护/包装",
        text: "旧报纸（保护或包装）",
        difficulty: "easy",
        distanceFocus: "从阅读材料转到缓冲、遮挡、标记等场景"
    },
    {
        id: "aut-rubberband-desk",
        baseObject: "橡皮筋",
        variant: "桌面/整理",
        text: "橡皮筋（桌面或整理）",
        difficulty: "easy",
        distanceFocus: "从捆扎转到标记、提醒、结构固定"
    },
    {
        id: "aut-paper-cup-sound",
        baseObject: "纸杯",
        variant: "声音/测量",
        text: "纸杯（声音或测量）",
        difficulty: "medium",
        distanceFocus: "从容器转到声音、刻度、实验道具"
    },
    {
        id: "aut-shoebox-organizing",
        baseObject: "鞋盒",
        variant: "整理/展示",
        text: "鞋盒（整理或展示）",
        difficulty: "medium",
        distanceFocus: "从包装转到分类、展示、规则容器"
    },
    {
        id: "aut-chopsticks-structure",
        baseObject: "一次性筷子",
        variant: "结构/教学",
        text: "一次性筷子（结构或教学）",
        difficulty: "medium",
        distanceFocus: "从餐具转到支架、模型、课堂演示"
    },
    {
        id: "aut-old-shirt-repair",
        baseObject: "旧 T 恤",
        variant: "修补/户外",
        text: "旧 T 恤（修补或户外）",
        difficulty: "medium",
        distanceFocus: "从衣物转到绑扎、过滤、保护层"
    },
    {
        id: "aut-umbrella-broken",
        baseObject: "坏雨伞",
        variant: "非遮雨场景",
        text: "坏雨伞（不要写遮雨）",
        difficulty: "hard",
        distanceFocus: "避开原本用途，转向骨架、布面、警示或收纳"
    },
    {
        id: "aut-expired-card",
        baseObject: "过期银行卡",
        variant: "非支付场景",
        text: "过期银行卡（不要写支付）",
        difficulty: "hard",
        distanceFocus: "从身份/支付物转到刮片、标签、量尺或分隔片"
    },
    {
        id: "aut-bottlecap-sorting",
        baseObject: "瓶盖",
        variant: "分类/计数",
        text: "瓶盖（分类或计数）",
        difficulty: "hard",
        distanceFocus: "从封口件转到标记、游戏规则、实验材料"
    },
    {
        id: "aut-straw-science",
        baseObject: "吸管",
        variant: "结构/科学实验",
        text: "吸管（结构或科学实验）",
        difficulty: "hard",
        distanceFocus: "从饮用工具转到管路、支撑、气流观察"
    },
    {
        id: "aut-envelope-private",
        baseObject: "旧信封",
        variant: "隐私/分类",
        text: "旧信封（隐私或分类）",
        difficulty: "hard",
        distanceFocus: "从邮寄转到遮挡、归档、标签和信息保护"
    }
];

const CATEGORY_PATTERNS = [
    { id: "fastening", label: "固定/连接", pattern: /夹|固定|绑|扎|挂|扣|连接|支架|支撑|缠|绕|线|绳|clip|tie/i },
    { id: "tool", label: "工具/加工", pattern: /锤|撬|刮|量|压|打|敲|切|铲|勺|工具|修|维修|开锁|tool/i },
    { id: "container", label: "容器/收纳", pattern: /装|收纳|容器|瓶|盒|杯|存|盛|储|漏斗|篮|袋|container|storage/i },
    { id: "weight-barrier", label: "重物/阻隔", pattern: /压|门挡|镇|重物|垫|阻|挡|隔|堵|防滑|weight|stopper/i },
    { id: "art-decor", label: "手工/装饰", pattern: /画|雕|装饰|手工|模型|玩具|摆件|拼贴|艺术|craft|decor/i },
    { id: "cleaning-filter", label: "清洁/过滤", pattern: /擦|刷|清洁|过滤|吸|扫|沥|筛|拖|clean|filter/i },
    { id: "safety-emergency", label: "安全/应急", pattern: /急救|警示|反光|灭火|求救|防护|止血|防晒|避雨|安全|emergency|safety/i },
    { id: "learning-play", label: "学习/游戏", pattern: /教|实验|游戏|练习|演示|拼|计数|道具|课堂|game|learn/i },
    { id: "garden-nature", label: "园艺/自然", pattern: /种|盆栽|浇水|育苗|花|园|土|鸟|植物|garden|plant/i },
    { id: "sound-signal", label: "声音/信号", pattern: /声|音|响|哨|提醒|提示|信号|标记|标签|signal|sound/i },
    { id: "measure-structure", label: "测量/结构", pattern: /测量|刻度|尺|对齐|框架|骨架|结构|平衡|模型|支点|measure|structure/i },
    { id: "privacy-sorting", label: "隐私/分类", pattern: /隐私|遮挡|分类|归档|编号|分隔|文件|信息|privacy|sort|label/i }
];

const VAGUE_RESPONSES = new Set([
    "用",
    "玩",
    "东西",
    "工具",
    "好用",
    "不知道",
    "随便",
    "其他",
    "很多",
    "用途",
    "使用",
    "备用",
    "应急",
    "有用",
    "摆着",
    "解决问题",
    "做东西",
    "做手工"
]);

let round = 0;
let timeLeft = ROUND_SECONDS;
let timer = null;
let trialLog = [];
let sessionStartedAt = null;
let sessionSeed = "";
let sessionPrompts = [];
let promptOrder = [];
let roundStartedAtMs = 0;
let sessionSaved = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("aut-panel");
const resultModal = document.getElementById("result-modal");
const promptText = document.getElementById("prompt-text");
const usesInput = document.getElementById("uses-input");

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

function parseRawLines(text) {
    return String(text || "")
        .split(/\r?\n/)
        .map((line) => line.trim());
}

function normalizeUse(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/[，。！？、,.!?;；:\s]+/g, "");
}

function duplicateReasonFor(normalized, previousAnswers) {
    if (!normalized) {
        return "";
    }
    const exactMatch = previousAnswers.find((answer) => answer.normalized === normalized);
    if (exactMatch) {
        return "exact-repeat";
    }
    const nearMatch = previousAnswers.find((answer) => {
        const shorter = Math.min(answer.normalized.length, normalized.length);
        const longer = Math.max(answer.normalized.length, normalized.length);
        if (shorter < 4 || longer === 0) {
            return false;
        }
        return (answer.normalized.includes(normalized) || normalized.includes(answer.normalized))
            && shorter / longer >= 0.7;
    });
    return nearMatch ? "near-repeat" : "";
}

function tokenize(list) {
    return list
        .join(" ")
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fa5]+/)
        .filter(Boolean);
}

function categoryForUse(text) {
    const matched = CATEGORY_PATTERNS.filter((category) => category.pattern.test(text));
    if (matched.length === 0) {
        return [{ id: "uncategorized", label: "未归类" }];
    }
    return matched.map((category) => ({ id: category.id, label: category.label }));
}

function vagueReasonFor(text, normalized) {
    if (!normalized) {
        return "blank";
    }
    if (VAGUE_RESPONSES.has(normalized)) {
        return "generic-word";
    }
    if (normalized.length <= 1) {
        return "too-short";
    }
    if (/^用来?(做)?(东西|工具|玩|用)?$/.test(normalized)) {
        return "generic-purpose";
    }
    if (normalized.length <= 3 && !/[门桌线厨房户外旅行课堂花园车包墙鞋窗水电手机实验分类]/.test(text)) {
        return "underspecified";
    }
    return "";
}

function isVagueUse(text, normalized) {
    return Boolean(vagueReasonFor(text, normalized));
}

function elaborationSignals(text) {
    const normalized = normalizeUse(text);
    return {
        hasConcreteContext: /门|桌|线|厨房|户外|旅行|课堂|花园|车|包|墙|鞋|窗|水|电|手机/.test(text),
        hasActionPurpose: /用来|作为|临时|防止|固定|改成|制作|帮助|替代|支撑|保护/.test(text),
        hasSpecificDetail: normalized.length >= 6
    };
}

function elaborationScore(text) {
    const signals = elaborationSignals(text);
    return Object.values(signals).filter(Boolean).length;
}

function compactAnswer(entry) {
    return {
        lineIndex: entry.lineIndex,
        text: entry.text,
        normalized: entry.normalized,
        duplicateReason: entry.duplicateReason || undefined,
        vagueReason: entry.vagueReason || undefined
    };
}

function buildOriginalityHeuristic(entries, validEntries, categoryFrequency) {
    const flaggedEntries = validEntries.filter((entry) => {
        const hasRareCategory = entry.categories.some((category) => categoryFrequency[category.id] === 1);
        return hasRareCategory && entry.elaborationScore >= 2;
    });
    const flaggedIndexes = new Set(flaggedEntries.map((entry) => entry.lineIndex));

    entries.forEach((entry) => {
        entry.originalityHeuristic = flaggedIndexes.has(entry.lineIndex);
    });

    return {
        nonStandardizedScoring: true,
        method: ORIGINALITY_HEURISTIC_METHOD,
        note: ORIGINALITY_HEURISTIC_NOTE,
        count: flaggedEntries.length,
        rate: validEntries.length === 0
            ? 0
            : roundMetric(flaggedEntries.length / validEntries.length, 3),
        flaggedAnswers: flaggedEntries.map(compactAnswer)
    };
}

function buildAnswerQualityFeedback(stats) {
    const tips = [];
    if (stats.duplicateCount > 0) {
        tips.push({
            type: "repeat",
            count: stats.duplicateCount,
            text: `有 ${stats.duplicateCount} 条回答像重复或换词复述；下一轮先换类别，再补细节。`
        });
    }
    if (stats.vagueCount > 0) {
        tips.push({
            type: "vague",
            count: stats.vagueCount,
            text: `有 ${stats.vagueCount} 条回答偏空泛；把答案写成“具体场景 + 动作 + 目的”。`
        });
    }
    if (stats.blankLineCount > 0) {
        tips.push({
            type: "blank",
            count: stats.blankLineCount,
            text: `有 ${stats.blankLineCount} 个空行；下一轮可以先连续列点，再回头润色。`
        });
    }
    if (stats.validUseCount > 0 && stats.categoryCount <= 1) {
        tips.push({
            type: "narrow-category",
            count: stats.categoryCount,
            text: "有效答案集中在少数类别；下一轮每两条答案主动切换一个用途类别。"
        });
    }
    if (stats.validUseCount > 0 && stats.meanElaboration < 1.5) {
        tips.push({
            type: "thin-detail",
            count: stats.validUseCount,
            text: "答案已有数量基础，但细节偏薄；下一轮为每条用途补充对象、场景或限制条件。"
        });
    }
    if (tips.length === 0) {
        tips.push({
            type: "steady-practice",
            count: stats.validUseCount || 0,
            text: "本轮低质量提示较少；下一轮可尝试更陌生的物品变体或更远的用途类别。"
        });
    }
    return tips;
}

function analyzeUses(rawText) {
    const rawLines = parseRawLines(rawText);
    const previousAnswers = [];
    const entries = rawLines.map((text, lineIndex) => {
        const normalized = normalizeUse(text);
        const isBlank = !normalized;
        const duplicateReason = duplicateReasonFor(normalized, previousAnswers);
        const duplicate = Boolean(duplicateReason);
        if (normalized) {
            previousAnswers.push({ lineIndex, text, normalized });
        }
        const vagueReason = vagueReasonFor(text, normalized);
        const vague = Boolean(vagueReason);
        const categories = isBlank ? [] : categoryForUse(text);
        const validForPractice = !isBlank && !duplicate && !vague;
        return {
            lineIndex,
            text,
            normalized,
            isBlank,
            duplicate,
            duplicateReason,
            vague,
            vagueReason,
            categories,
            elaborationSignals: elaborationSignals(text),
            elaborationScore: validForPractice ? elaborationScore(text) : 0,
            validForPractice
        };
    });
    const validEntries = entries.filter((entry) => entry.validForPractice);
    const categoryIds = new Set();
    validEntries.forEach((entry) => {
        entry.categories.forEach((category) => {
            if (category.id !== "uncategorized" || entry.categories.length === 1) {
                categoryIds.add(category.id);
            }
        });
    });
    const categoryLabels = Array.from(new Set(
        validEntries.flatMap((entry) => entry.categories.map((category) => category.label))
    ));
    const categoryFrequency = validEntries.reduce((result, entry) => {
        entry.categories.forEach((category) => {
            result[category.id] = (result[category.id] || 0) + 1;
        });
        return result;
    }, {});
    const originalityHeuristic = buildOriginalityHeuristic(entries, validEntries, categoryFrequency);
    const duplicateAnswers = entries.filter((entry) => entry.duplicate).map(compactAnswer);
    const vagueAnswers = entries.filter((entry) => entry.vague && !entry.isBlank).map(compactAnswer);

    return {
        entries,
        rawAnswerCount: rawLines.filter((line) => line).length,
        blankLineCount: entries.filter((entry) => entry.isBlank).length,
        duplicateCount: duplicateAnswers.length,
        duplicateAnswers,
        vagueCount: vagueAnswers.length,
        vagueAnswers,
        validUseCount: validEntries.length,
        categoryCount: categoryIds.size,
        categoryLabels,
        meanElaboration: validEntries.length === 0
            ? 0
            : roundMetric(validEntries.reduce((sum, entry) => sum + entry.elaborationScore, 0) / validEntries.length, 2),
        originalityHeuristic,
        qualityFeedback: buildAnswerQualityFeedback({
            duplicateCount: duplicateAnswers.length,
            vagueCount: vagueAnswers.length,
            blankLineCount: entries.filter((entry) => entry.isBlank).length,
            validUseCount: validEntries.length,
            categoryCount: categoryIds.size,
            meanElaboration: validEntries.length === 0
                ? 0
                : roundMetric(validEntries.reduce((sum, entry) => sum + entry.elaborationScore, 0) / validEntries.length, 2)
        }),
        nonStandardizedScoring: true
    };
}

function currentUsesCount() {
    return parseRawLines(usesInput.value).filter((line) => line).length;
}

function updateBoard() {
    document.getElementById("round").textContent = String(Math.min(round + 1, sessionPrompts.length));
    document.getElementById("time").textContent = `${timeLeft}s`;
    document.getElementById("uses-count").textContent = String(currentUsesCount());
}

function shuffleList(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function pickSessionPrompts(rng) {
    const selected = [];
    PROMPT_DIFFICULTY_PLAN.forEach((difficulty) => {
        const candidates = shuffleList(ALL_PROMPTS.filter((item) => item.difficulty === difficulty), rng);
        if (candidates.length > 0 && selected.length < ROUND_COUNT) {
            selected.push(candidates[0]);
        }
    });
    if (selected.length < ROUND_COUNT) {
        const selectedIds = new Set(selected.map((item) => item.id));
        const remaining = shuffleList(ALL_PROMPTS.filter((item) => !selectedIds.has(item.id)), rng);
        selected.push(...remaining.slice(0, ROUND_COUNT - selected.length));
    }
    return shuffleList(selected, rng).slice(0, ROUND_COUNT);
}

function buildSessionPrompts() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed(MODULE_ID) : `${MODULE_ID}-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(`${sessionSeed}:${CONTENT_VERSION}`) : Math.random;
    sessionPrompts = pickSessionPrompts(rng);
    promptOrder = sessionPrompts.map((item) => item.id);
}

function loadRound() {
    const prompt = sessionPrompts[round];
    if (!prompt) {
        finish();
        return;
    }
    promptText.textContent = prompt.text;
    usesInput.value = "";
    timeLeft = ROUND_SECONDS;
    roundStartedAtMs = nowMs();
    updateBoard();
    usesInput.focus();
}

function nextRound() {
    if (round >= sessionPrompts.length || sessionSaved) {
        return;
    }

    const prompt = sessionPrompts[round];
    const analysis = analyzeUses(usesInput.value);
    trialLog.push({
        trialIndex: round,
        promptId: prompt.id,
        baseObject: prompt.baseObject,
        promptVariant: prompt.variant,
        promptText: prompt.text,
        promptDistanceFocus: prompt.distanceFocus || "",
        difficulty: prompt.difficulty,
        timeLimitSec: ROUND_SECONDS,
        rtMs: Math.max(0, Math.round(nowMs() - roundStartedAtMs)),
        rawResponseText: usesInput.value,
        rawAnswerCount: analysis.rawAnswerCount,
        validUseCount: analysis.validUseCount,
        fluency: analysis.validUseCount,
        flexibility: analysis.categoryCount,
        categoryCount: analysis.categoryCount,
        categoryLabels: analysis.categoryLabels,
        duplicateCount: analysis.duplicateCount,
        duplicateAnswers: analysis.duplicateAnswers,
        blankLineCount: analysis.blankLineCount,
        vagueCount: analysis.vagueCount,
        vagueAnswers: analysis.vagueAnswers,
        meanElaboration: analysis.meanElaboration,
        elaboration: analysis.meanElaboration,
        originalityHeuristic: analysis.originalityHeuristic,
        practiceFeedback: analysis.qualityFeedback,
        scoringBoundary: PRACTICE_SCORING_BOUNDARY,
        practiceFeedbackBoundary: PRACTICE_FEEDBACK_BOUNDARY,
        nonStandardizedScoring: true,
        answers: analysis.entries,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    });

    round += 1;
    if (round >= sessionPrompts.length) {
        finish();
        return;
    }
    loadRound();
}

function buildNextPracticeRecommendation(summary) {
    const targetValidUses = Math.max(6, summary.validUseCount + 3);
    if (summary.validUseCount < 8) {
        return {
            level: "increase-fluency",
            focusMetric: "fluency",
            reason: "有效用途数量还不足以支撑后续类别切换练习。",
            suggestedNextRound: {
                targetValidUses,
                targetPerPrompt: 4,
                difficultyMix: "easy + medium + hard"
            },
            text: "下一轮先把目标设为每题至少 4 个有效用途，再追求新颖性。"
        };
    }
    if (summary.flexibility < 4) {
        return {
            level: "increase-flexibility",
            focusMetric: "flexibility",
            reason: "有效答案已出现，但类别跨度偏窄。",
            suggestedNextRound: {
                targetCategoryCount: 4,
                categorySwitchRule: "每写 2 个用途就换一个类别"
            },
            text: "下一轮每写 2 个用途就主动换一个类别，例如工具、收纳、应急、游戏。"
        };
    }
    if (summary.duplicateCount + summary.vagueCount >= 3) {
        return {
            level: "reduce-repetition",
            focusMetric: "answer-quality",
            reason: "重复或空泛答案会让练习反馈失真。",
            suggestedNextRound: {
                reviewBeforeSubmit: true,
                answerFrame: "场景 + 动作 + 目的"
            },
            text: "下一轮先检查是否只是换词复述，尽量写清具体场景和动作。"
        };
    }
    if (summary.meanElaboration < 1.8) {
        return {
            level: "increase-elaboration",
            focusMetric: "elaboration",
            reason: "用途数量和类别已有基础，细节可以继续加厚。",
            suggestedNextRound: {
                targetMeanElaboration: 2,
                answerFrame: "场景 + 动作 + 目的"
            },
            text: "下一轮保留当前速度，但把每个用途写成“场景 + 动作 + 目的”。"
        };
    }
    return {
        level: "increase-distance",
        focusMetric: "transfer-distance",
        reason: "本轮低质量信号较少，可以增加物品和用途之间的距离。",
        suggestedNextRound: {
            preferredDifficulty: "hard",
            targetCategoryCount: Math.max(summary.flexibility, 5)
        },
        text: "下一轮可以换更陌生的物品变体，继续扩展类别跨度。"
    };
}

function buildPracticeTargets(summary) {
    return [
        {
            metric: "fluency",
            current: summary.fluency,
            nextTarget: Math.max(summary.fluency + 2, 8),
            description: "有效、非重复、非空泛用途数量。"
        },
        {
            metric: "flexibility",
            current: summary.flexibility,
            nextTarget: Math.max(summary.flexibility + 1, 4),
            description: "覆盖不同用途类别的数量。"
        },
        {
            metric: "elaboration",
            current: summary.elaboration,
            nextTarget: Math.max(summary.elaboration, 2),
            description: "每条有效用途的场景、动作和目的细节。"
        }
    ];
}

function buildSummary() {
    const validUseCount = trialLog.reduce((sum, item) => sum + item.validUseCount, 0);
    const rawAnswerCount = trialLog.reduce((sum, item) => sum + item.rawAnswerCount, 0);
    const duplicateCount = trialLog.reduce((sum, item) => sum + item.duplicateCount, 0);
    const blankLineCount = trialLog.reduce((sum, item) => sum + item.blankLineCount, 0);
    const vagueCount = trialLog.reduce((sum, item) => sum + item.vagueCount, 0);
    const categories = new Set(trialLog.flatMap((item) => item.categoryLabels));
    const duplicateAnswers = trialLog.flatMap((trial) => trial.duplicateAnswers.map((answer) => ({
        ...answer,
        trialIndex: trial.trialIndex,
        promptId: trial.promptId
    })));
    const vagueAnswers = trialLog.flatMap((trial) => trial.vagueAnswers.map((answer) => ({
        ...answer,
        trialIndex: trial.trialIndex,
        promptId: trial.promptId
    })));
    const elaborationTotal = trialLog.reduce(
        (sum, item) => sum + (item.meanElaboration * item.validUseCount),
        0
    );
    const meanElaboration = validUseCount === 0
        ? 0
        : roundMetric(elaborationTotal / validUseCount, 2);
    const originalityHeuristicCount = trialLog.reduce((sum, item) => sum + item.originalityHeuristic.count, 0);
    const originalityHeuristic = {
        nonStandardizedScoring: true,
        method: ORIGINALITY_HEURISTIC_METHOD,
        note: ORIGINALITY_HEURISTIC_NOTE,
        count: originalityHeuristicCount,
        rate: validUseCount === 0
            ? 0
            : roundMetric(originalityHeuristicCount / validUseCount, 3),
        byTrial: trialLog.map((trial) => ({
            trialIndex: trial.trialIndex,
            promptId: trial.promptId,
            count: trial.originalityHeuristic.count,
            rate: trial.originalityHeuristic.rate,
            flaggedAnswers: trial.originalityHeuristic.flaggedAnswers
        }))
    };
    const summary = {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        nonStandardizedScoring: true,
        promptOrder,
        promptVariants: sessionPrompts.map((item) => ({
            id: item.id,
            baseObject: item.baseObject,
            variant: item.variant,
            difficulty: item.difficulty,
            distanceFocus: item.distanceFocus || ""
        })),
        promptPoolSize: ALL_PROMPTS.length,
        promptDifficultyPlan: PROMPT_DIFFICULTY_PLAN.slice(),
        totalPrompts: sessionPrompts.length,
        rawAnswerCount,
        validUseCount,
        answerCount: rawAnswerCount,
        fluency: validUseCount,
        flexibility: categories.size,
        categoryCount: categories.size,
        categoryLabels: Array.from(categories),
        duplicateCount,
        duplicateAnswers,
        blankLineCount,
        vagueCount,
        vagueAnswers,
        meanElaboration,
        elaboration: meanElaboration,
        originalityHeuristic,
        originalityBoundary: ORIGINALITY_HEURISTIC_NOTE,
        scoringBoundary: PRACTICE_SCORING_BOUNDARY,
        practiceFeedbackBoundary: PRACTICE_FEEDBACK_BOUNDARY,
        nonStandardizedScoring: true
    };
    summary.lowQualityAnswerTips = buildAnswerQualityFeedback(summary);
    summary.practiceTargets = buildPracticeTargets(summary);
    summary.nextPracticeRecommendation = buildNextPracticeRecommendation(summary);
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
        score: summary.fluency,
        scoreMeaning: "本轮有效用途数，仅用于练习进度显示。",
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        nonStandardizedScoring: true,
        summary,
        trials: trialLog.map((trial) => ({ ...trial })),
        metrics: {
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            nonStandardizedScoring: true,
            fluency: summary.fluency,
            flexibility: summary.flexibility,
            categoryCount: summary.categoryCount,
            duplicateCount: summary.duplicateCount,
            duplicateAnswers: summary.duplicateAnswers,
            blankLineCount: summary.blankLineCount,
            vagueCount: summary.vagueCount,
            vagueAnswers: summary.vagueAnswers,
            meanElaboration: summary.meanElaboration,
            elaboration: summary.elaboration,
            originalityHeuristic: summary.originalityHeuristic,
            originalityBoundary: summary.originalityBoundary,
            scoringBoundary: summary.scoringBoundary,
            practiceFeedbackBoundary: summary.practiceFeedbackBoundary,
            lowQualityAnswerTips: summary.lowQualityAnswerTips,
            practiceTargets: summary.practiceTargets,
            nextPracticeRecommendation: summary.nextPracticeRecommendation
        },
        tags: ["creativity", "divergent-thinking", "practice-feedback"]
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

    setText("result-fluency", String(summary.fluency));
    setText("result-diversity", `${summary.flexibility} 类`);
    setText("result-length", String(summary.meanElaboration));
    setText("result-note", `${summary.originalityBoundary} ${summary.nextPracticeRecommendation.text}`);

    saveTrainingSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    round = 0;
    trialLog = [];
    sessionStartedAt = new Date();
    sessionSaved = false;
    buildSessionPrompts();

    if (timer) {
        clearInterval(timer);
    }
    timer = setInterval(() => {
        timeLeft -= 1;
        updateBoard();
        if (timeLeft <= 0) {
            nextRound();
        }
    }, 1000);

    loadRound();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

document.getElementById("next-btn").addEventListener("click", nextRound);
usesInput.addEventListener("input", () => {
    document.getElementById("uses-count").textContent = String(currentUsesCount());
});

window.startGame = startGame;
