const MODULE_ID = "torrance-creative";
const GAME_NAME = "托兰斯创造力测验";
const CONTENT_VERSION = "torrance-creative-v3-practice-feedback";
const TRIAL_COUNT = 6;

const PROMPT_POOL = [
    {
        promptId: "ttct-circle-living-thing",
        figureId: "ttct-1",
        promptTitle: "圆形生命体",
        promptText: "把这个圆形改造成一个有生命感或角色感的画面。",
        figureCategory: "closed-curve",
        variant: "character",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><circle cx='90' cy='55' r='28' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-circle-tool",
        figureId: "ttct-1",
        promptTitle: "圆形工具",
        promptText: "把这个圆形改造成一个具体工具或装置。",
        figureCategory: "closed-curve",
        variant: "object-function",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><circle cx='90' cy='55' r='28' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-triangle-place",
        figureId: "ttct-2",
        promptTitle: "三角场景",
        promptText: "把三角形发展成一个场所、建筑或地形。",
        figureCategory: "angular",
        variant: "place",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><path d='M30 70 L90 20 L150 70 Z' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-triangle-machine",
        figureId: "ttct-2",
        promptTitle: "三角机器",
        promptText: "把三角形改造成一个会运动或工作的机器。",
        figureCategory: "angular",
        variant: "machine",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><path d='M30 70 L90 20 L150 70 Z' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-rectangle-container",
        figureId: "ttct-3",
        promptTitle: "矩形容器",
        promptText: "把矩形改造成一个能容纳、保护或展示东西的物体。",
        figureCategory: "box",
        variant: "container",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><rect x='45' y='28' width='90' height='54' rx='8' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-rectangle-screen",
        figureId: "ttct-3",
        promptTitle: "矩形界面",
        promptText: "把矩形发展成一个屏幕、窗口或信息界面。",
        figureCategory: "box",
        variant: "interface",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><rect x='45' y='28' width='90' height='54' rx='8' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-arc-nature",
        figureId: "ttct-4",
        promptTitle: "弧线自然物",
        promptText: "把这条弧线扩展成自然景观或生物结构。",
        figureCategory: "open-curve",
        variant: "nature",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><path d='M40 75 C70 20,110 20,140 75' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-arc-motion",
        figureId: "ttct-4",
        promptTitle: "弧线运动轨迹",
        promptText: "把这条弧线变成一个动作、轨迹或事件的一部分。",
        figureCategory: "open-curve",
        variant: "motion",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><path d='M40 75 C70 20,110 20,140 75' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-cross-map",
        figureId: "ttct-5",
        promptTitle: "十字结构",
        promptText: "把交叉线改造成路径、地图、连接结构或选择点。",
        figureCategory: "intersecting-lines",
        variant: "structure",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><path d='M40 55 H140 M90 20 V90' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    },
    {
        promptId: "ttct-x-signal",
        figureId: "ttct-6",
        promptTitle: "交叉信号",
        promptText: "把 X 形线条改造成标记、警示、机械部件或故事线索。",
        figureCategory: "crossed-diagonals",
        variant: "signal",
        svg: "<svg width='180' height='110' viewBox='0 0 180 110'><path d='M50 30 L130 80 M130 30 L50 80' fill='none' stroke='#2c3e50' stroke-width='4'/></svg>"
    }
];

const CATEGORY_PATTERNS = [
    { id: "living-character", label: "生命/角色", pattern: /人|脸|眼|动物|怪兽|机器人|角色|生命|会说话|表情|animal|robot|face/i },
    { id: "tool-machine", label: "工具/机器", pattern: /工具|机器|装置|按钮|齿轮|发动|工作|修理|车|船|飞机|tool|machine/i },
    { id: "place-structure", label: "场所/结构", pattern: /房|桥|塔|门|窗|地图|路|城市|建筑|山|岛|place|map|bridge/i },
    { id: "nature-space", label: "自然/宇宙", pattern: /太阳|月|星|云|花|树|水|海|山|星球|宇宙|自然|space|planet/i },
    { id: "container-display", label: "容器/展示", pattern: /盒|箱|屏幕|相框|窗口|容器|收纳|保护|展示|舞台|screen|box/i },
    { id: "symbol-signal", label: "符号/信号", pattern: /标志|警示|信号|密码|徽章|路标|符号|提醒|禁止|signal|symbol/i },
    { id: "story-emotion", label: "故事/情绪", pattern: /故事|秘密|冒险|快乐|害怕|孤独|希望|梦|记忆|情绪|story|dream/i }
];

const TRANSFORM_PATTERNS = [
    { id: "identity-shift", label: "身份转化", pattern: /变成|改成|成为|像|化作|伪装|扮成|is a|turn/i },
    { id: "function-added", label: "功能增加", pattern: /用来|可以|帮助|保护|收纳|修理|提醒|照明|运输|检测|for|use/i },
    { id: "context-added", label: "情境加入", pattern: /在|当|夜晚|雨天|城市|公园|海边|太空|课堂|厨房|旅行|during|inside/i },
    { id: "detail-added", label: "细节扩展", pattern: /颜色|材质|纹理|按钮|轮子|翅膀|眼睛|门|窗|光|声音|detail|color/i },
    { id: "motion-added", label: "动作变化", pattern: /飞|跑|转|跳|滚|移动|旋转|伸展|发射|穿过|move|fly|spin/i },
    { id: "scale-shift", label: "尺度变化", pattern: /巨大|微型|放大|缩小|世界|迷你|远处|近处|giant|mini/i },
    { id: "combination", label: "组合连接", pattern: /连接|组合|拼成|连着|一半|另一半|加上|附着|combine|attach/i }
];

const GENERIC_TITLES = new Set([
    "图形",
    "圆形",
    "三角形",
    "方形",
    "线条",
    "叉",
    "作品",
    "无题",
    "不知道",
    "随便"
]);

let index = 0;
let responses = [];
let elapsed = 0;
let timer = null;
let sessionStartedAt = null;
let sessionSeed = "";
let sessionPrompts = [];
let promptOrder = [];
let trialStartedAtMs = 0;
let sessionSaved = false;

const startScreen = document.getElementById("start-screen");
const panel = document.getElementById("ttct-panel");
const resultModal = document.getElementById("result-modal");
const figureEl = document.getElementById("figure");
const promptText = document.getElementById("prompt-text");
const titleInput = document.getElementById("title-input");
const descInput = document.getElementById("desc-input");

function nowMs() {
    return window.performance && typeof window.performance.now === "function"
        ? window.performance.now()
        : Date.now();
}

function roundMetric(value, digits = 2) {
    if (!Number.isFinite(value)) {
        return 0;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function buildSessionPrompts() {
    const seeded = window.SeededRandom;
    sessionSeed = seeded ? seeded.createSessionSeed(MODULE_ID) : `${MODULE_ID}-${Date.now()}`;
    const rng = seeded ? seeded.createRngFromSeed(`${sessionSeed}:${CONTENT_VERSION}`) : Math.random;
    const ordered = seeded
        ? seeded.pickShuffled(PROMPT_POOL, rng, TRIAL_COUNT)
        : PROMPT_POOL.slice(0, TRIAL_COUNT);

    sessionPrompts = ordered.map((item) => ({ ...item }));
    promptOrder = sessionPrompts.map((item) => item.promptId);
}

function words(text) {
    return String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9\u4e00-\u9fa5]+/)
        .filter(Boolean);
}

function normalizeText(text) {
    return String(text || "")
        .trim()
        .toLowerCase()
        .replace(/[，。！？、,.!?;；:\s]+/g, "");
}

function categoriesForResponse(text) {
    const matches = CATEGORY_PATTERNS.filter((category) => category.pattern.test(text));
    if (matches.length === 0) {
        return [{ id: "uncategorized", label: "未归类" }];
    }
    return matches.map((category) => ({ id: category.id, label: category.label }));
}

function markersForResponse(text) {
    return TRANSFORM_PATTERNS
        .filter((marker) => marker.pattern.test(text))
        .map((marker) => ({ id: marker.id, label: marker.label }));
}

function titleSpecificitySignals(title) {
    const normalized = normalizeText(title);
    const tokenList = words(title);
    return {
        hasTitle: Boolean(normalized),
        notGeneric: Boolean(normalized) && !GENERIC_TITLES.has(normalized),
        hasModifier: /的|之|号|秘密|未来|迷你|巨大|会|在|for|of/i.test(title) || tokenList.length >= 2,
        hasConcreteCue: CATEGORY_PATTERNS.some((category) => category.pattern.test(title))
    };
}

function titleSpecificityValue(title) {
    const signals = titleSpecificitySignals(title);
    const signalCount = Object.values(signals).filter(Boolean).length;
    return roundMetric(signalCount / Object.keys(signals).length, 2);
}

function descriptionDetailSignals(description) {
    return {
        hasContext: /在|当|因为|为了|夜晚|白天|城市|家里|户外|公园|海边|太空|课堂|厨房|旅行/.test(description),
        hasActionPurpose: /用来|可以|帮助|保护|收纳|提醒|运输|记录|修理|变成|改成|成为/.test(description),
        hasConcreteDetail: /颜色|材质|纹理|按钮|轮子|翅膀|眼睛|门|窗|光|声音|气味|数字|图案/.test(description),
        referencesFigureChange: /圆|三角|矩形|弧|线|交叉|形状|边|角|弯|连接|加上|延伸|旋转/.test(description)
    };
}

function elaborationValue(description) {
    const signals = descriptionDetailSignals(description);
    return Object.values(signals).filter(Boolean).length;
}

function analyzeResponse(prompt, title, description) {
    const combined = `${title} ${description}`;
    const categories = categoriesForResponse(combined);
    const transformMarkers = markersForResponse(combined);
    const titleSpecificity = titleSpecificityValue(title);
    const elaboration = elaborationValue(description);
    const categoryLabels = categories.map((category) => category.label);
    const transformationLabels = transformMarkers.map((marker) => marker.label);
    const complete = Boolean(normalizeText(title) && normalizeText(description));

    return {
        promptId: prompt.promptId,
        figureId: prompt.figureId,
        promptTitle: prompt.promptTitle,
        promptText: prompt.promptText,
        figureCategory: prompt.figureCategory,
        promptVariant: prompt.variant,
        rawTitle: title,
        rawDescription: description,
        title,
        description,
        detail: description,
        complete,
        categories,
        categoryCount: categories.filter((category) => category.id !== "uncategorized").length,
        categoryIds: categories.map((category) => category.id),
        categoryLabels,
        transformMarkers,
        transformCount: transformMarkers.length,
        transformationLabels,
        transformationCount: transformMarkers.length,
        titleSpecificitySignals: titleSpecificitySignals(title),
        titleSpecificity,
        titleMetric: titleSpecificity,
        titleScore: titleSpecificity,
        titleDiversity: roundMetric(new Set(words(title)).size / Math.max(1, words(title).length), 2),
        descriptionDetailSignals: descriptionDetailSignals(description),
        elaboration,
        detailMetric: elaboration,
        detailScore: elaboration,
        nonStandardizedScoring: true
    };
}

function updateBoard() {
    document.getElementById("progress").textContent = String(index + 1);
    document.getElementById("time").textContent = `${elapsed}s`;
    document.getElementById("done").textContent = String(responses.filter((item) => item.complete).length);
}

function renderFigure() {
    const prompt = sessionPrompts[index];
    if (!prompt) {
        return;
    }

    figureEl.innerHTML = prompt.svg;
    if (promptText) {
        promptText.textContent = prompt.promptText;
    }
    titleInput.value = "";
    descInput.value = "";
    trialStartedAtMs = nowMs();
    updateBoard();
}

function nextFigure() {
    const currentPrompt = sessionPrompts[index];
    if (!currentPrompt || sessionSaved) {
        return;
    }

    const title = titleInput.value.trim();
    const description = descInput.value.trim();
    const analysis = analyzeResponse(currentPrompt, title, description);
    responses.push({
        trialIndex: index,
        ...analysis,
        rtMs: Math.max(0, Math.round(nowMs() - trialStartedAtMs)),
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION
    });

    index += 1;
    if (index >= sessionPrompts.length) {
        finish();
        return;
    }
    renderFigure();
}

function buildNextPracticeRecommendation(summary) {
    if (summary.fluency < summary.totalTrials) {
        return {
            level: "complete-all-items",
            text: "下一轮先保证每个图形都有标题和描述，再扩展新颖性。"
        };
    }
    if (summary.flexibility < 3) {
        return {
            level: "increase-flexibility",
            text: "下一轮每两题主动换一个类别，例如角色、工具、场所、自然或信号。"
        };
    }
    if (summary.titleSpecificity < 0.65) {
        return {
            level: "increase-title-specificity",
            text: "下一轮标题避免只写形状名称，改成带角色、地点或功能的具体标题。"
        };
    }
    if (summary.elaboration < 2) {
        return {
            level: "increase-elaboration",
            text: "下一轮描述按“情境 + 动作/目的 + 一个可见细节”补充。"
        };
    }
    if (summary.transformCount < summary.fluency * 2) {
        return {
            level: "increase-transformation",
            text: "下一轮尝试改变图形身份、功能、尺度或运动方式，而不只是命名。"
        };
    }
    return {
        level: "extend-distance",
        text: "下一轮可以选更陌生的类别组合，继续保持标题具体和细节清楚。"
    };
}

function buildSummary() {
    const totalTrials = sessionPrompts.length || TRIAL_COUNT;
    const completedTrials = responses.filter((item) => item.complete);
    const categoryIds = new Set();
    const categoryLabels = new Set();

    completedTrials.forEach((trial) => {
        trial.categories.forEach((category) => {
            if (category.id !== "uncategorized") {
                categoryIds.add(category.id);
                categoryLabels.add(category.label);
            }
        });
    });

    const fluency = completedTrials.length;
    const elaboration = fluency === 0
        ? 0
        : roundMetric(completedTrials.reduce((sum, item) => sum + item.elaboration, 0) / fluency, 2);
    const titleSpecificity = fluency === 0
        ? 0
        : roundMetric(completedTrials.reduce((sum, item) => sum + item.titleSpecificity, 0) / fluency, 2);
    const transformCount = completedTrials.reduce((sum, item) => sum + item.transformCount, 0);
    const titleTokens = completedTrials.flatMap((item) => words(item.title));
    const titleTokenVariety = titleTokens.length === 0
        ? 0
        : roundMetric(new Set(titleTokens).size / titleTokens.length, 2);
    const transformationLabels = Array.from(new Set(completedTrials.flatMap((item) => item.transformationLabels || [])));

    const summary = {
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        promptOrder,
        promptPool: sessionPrompts.map((prompt) => ({
            promptId: prompt.promptId,
            figureId: prompt.figureId,
            promptTitle: prompt.promptTitle,
            promptText: prompt.promptText,
            figureCategory: prompt.figureCategory,
            variant: prompt.variant
        })),
        totalTrials,
        completedTrials: fluency,
        fluency,
        flexibility: categoryIds.size,
        categoryCount: categoryIds.size,
        categoryLabels: Array.from(categoryLabels),
        detailMetric: elaboration,
        detailScore: elaboration,
        elaboration,
        titleMetric: titleSpecificity,
        titleScore: titleSpecificity,
        titleSpecificity,
        titleDiversity: titleTokenVariety,
        titleTokenVariety,
        transformCount,
        transformationCount: transformCount,
        transformationLabels,
        nonStandardizedScoring: true,
        scoringBoundary: "本页只提供练习反馈：titleMetric/titleSpecificity、detailMetric/elaboration、categoryCount/categoryLabels、transformationCount/transformationLabels 都是启发式指标，不是 TTCT 标准化常模分数。"
    };

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
        score: null,
        seed: sessionSeed,
        contentVersion: CONTENT_VERSION,
        summary,
        trials: responses.map((trial) => ({ ...trial })),
        metrics: {
            seed: sessionSeed,
            contentVersion: CONTENT_VERSION,
            totalTrials: summary.totalTrials,
            completedTrials: summary.completedTrials,
            fluency: summary.fluency,
            flexibility: summary.flexibility,
            categoryCount: summary.categoryCount,
            categoryLabels: summary.categoryLabels,
            detailMetric: summary.detailMetric,
            detailScore: summary.detailScore,
            elaboration: summary.elaboration,
            titleMetric: summary.titleMetric,
            titleScore: summary.titleScore,
            titleSpecificity: summary.titleSpecificity,
            titleDiversity: summary.titleDiversity,
            titleTokenVariety: summary.titleTokenVariety,
            transformCount: summary.transformCount,
            transformationCount: summary.transformationCount,
            transformationLabels: summary.transformationLabels,
            nonStandardizedScoring: true,
            scoringBoundary: summary.scoringBoundary,
            nextPracticeRecommendation: summary.nextPracticeRecommendation
        },
        tags: ["creativity", "figural-divergent-thinking", "practice-feedback"]
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

    setText("result-fluency", `${summary.fluency}/${summary.totalTrials}`);
    setText("result-flexibility", `${summary.flexibility} 类`);
    setText("result-elaboration", `${summary.elaboration} 线索/题`);
    setText("result-title-specificity", `${Math.round(summary.titleSpecificity * 100)}%`);
    setText("result-transform-count", String(summary.transformCount));
    setText("result-note", `${summary.scoringBoundary} ${summary.nextPracticeRecommendation.text}`);

    saveTrainingSession(finishedAt, summary);

    panel.style.display = "none";
    resultModal.style.display = "flex";
}

function startGame() {
    index = 0;
    responses = [];
    elapsed = 0;
    sessionStartedAt = new Date();
    sessionSaved = false;
    buildSessionPrompts();

    if (timer) {
        clearInterval(timer);
    }
    timer = setInterval(() => {
        elapsed += 1;
        document.getElementById("time").textContent = `${elapsed}s`;
    }, 1000);

    renderFigure();
    startScreen.style.display = "none";
    panel.style.display = "block";
    resultModal.style.display = "none";
}

document.getElementById("next-btn").addEventListener("click", nextFigure);

window.startGame = startGame;
