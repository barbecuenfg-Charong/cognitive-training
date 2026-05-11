const fs = require("fs");
const path = require("path");
const http = require("http");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "src", "home", "config.js");
const OUTPUT_PATH = path.join(ROOT, "doc", "06-picky-player-evaluation.md");
const args = new Set(process.argv.slice(2));
const CHECK_MODE = args.has("--check");
const FAIL_ON = process.argv
    .slice(2)
    .find((item) => item.startsWith("--fail-on="))
    ?.split("=")[1] || "high";

const PLACEHOLDER_PATTERNS = [
    /待开发/gi,
    /TODO/gi,
    /to be done/gi,
    /coming soon/gi,
    /placeholder/gi,
    /未实现/gi
];

const START_PATTERNS = [
    /开始测试/i,
    /开始训练/i,
    /开始游戏/i,
    /开始挑战/i,
    /start/i
];

const FEEDBACK_PATTERNS = [
    /结果/i,
    /得分/i,
    /评分/i,
    /score/i,
    /result/i,
    /accuracy/i,
    /正确率/i,
    /完成/i,
    /反馈/i
];

const RETRY_PATTERNS = [
    /再来一次/i,
    /重新开始/i,
    /restart/i,
    /重试/i,
    /继续训练/i
];

function loadSections() {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const transformed = raw.replace("export const sections =", "module.exports =");
    const sandbox = { module: { exports: null }, exports: {} };
    vm.runInNewContext(transformed, sandbox, { filename: "config.js" });
    return sandbox.module.exports || [];
}

function collectActiveTasks(sections) {
    const tasks = [];
    for (const section of sections) {
        const sectionTitle = section.title || "未命名分组";
        for (const task of section.tasks || []) {
            if (task.status !== "active") continue;
            if (!task.href || !task.href.endsWith(".html")) continue;
            tasks.push({
                sectionTitle,
                title: task.title || task.href,
                href: task.href
            });
        }
    }
    return tasks;
}

function startStaticServer() {
    const MIME_TYPES = {
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".ico": "image/x-icon",
        ".js": "application/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml; charset=utf-8"
    };

    const server = http.createServer((req, res) => {
        const safePath = decodeURIComponent((req.url || "/").split("?")[0]);
        const candidate = safePath.replace(/^\/+/, "");
        const requested = candidate === "" ? "index.html" : candidate;
        const normalized = path.normalize(requested).replace(/^(\.\.[\\/])+/, "");
        const filePath = path.join(ROOT, normalized);

        fs.stat(filePath, (statError, stat) => {
            if (statError || !stat.isFile()) {
                res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
                res.end("Not Found");
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, {
                "Content-Type": MIME_TYPES[ext] || "application/octet-stream"
            });
            fs.createReadStream(filePath).pipe(res);
        });
    });

    return new Promise((resolve, reject) => {
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            if (!address || typeof address === "string") {
                reject(new Error("Failed to bind local test server"));
                return;
            }
            resolve({
                server,
                baseUrl: `http://127.0.0.1:${address.port}`
            });
        });
    });
}

async function fetchPage(baseUrl, href) {
    const url = `${baseUrl}/${href.replace(/^\/+/, "")}`;
    const response = await fetch(url);
    return {
        status: response.status,
        ok: response.ok,
        body: await response.text()
    };
}

function extractScriptSources(html) {
    const scripts = [];
    const regex = /<script[^>]*\ssrc=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = regex.exec(html))) {
        scripts.push(match[1]);
    }
    return scripts;
}

function countPatternHits(text, patterns) {
    let count = 0;
    for (const pattern of patterns) {
        const matches = text.match(pattern);
        if (matches) {
            count += matches.length;
        }
    }
    return count;
}

function hasAnyPattern(text, patterns) {
    return patterns.some((pattern) => pattern.test(text));
}

async function evaluateTask(baseUrl, task) {
    const pagePath = path.join(ROOT, task.href);
    const result = {
        ...task,
        pageExists: fs.existsSync(pagePath),
        pageHttpOk: false,
        scriptCount: 0,
        missingScripts: [],
        hasStartControl: false,
        hasFeedbackHint: false,
        hasRetryHint: false,
        placeholderHits: 0,
        issues: [],
        questions: []
    };

    if (!result.pageExists) {
        result.issues.push("页面文件缺失");
        result.questions.push("该游戏入口已上架但页面不存在，是否应先下架入口？");
        return result;
    }

    let html = fs.readFileSync(pagePath, "utf8");
    let fetchedBody = html;
    try {
        const fetched = await fetchPage(baseUrl, task.href);
        result.pageHttpOk = fetched.ok;
        if (!fetched.ok) {
            result.issues.push(`HTTP 访问失败（状态码 ${fetched.status}）`);
            result.questions.push("线上部署后该页面是否会出现同样的 404/加载失败？");
        } else {
            fetchedBody = fetched.body;
        }
    } catch (error) {
        result.issues.push("HTTP 访问异常");
        result.questions.push("本地可读但通过 HTTP 访问异常，是否存在服务端路由限制？");
    }

    const htmlForScan = `${html}\n${fetchedBody}`;
    const scripts = extractScriptSources(html);
    result.scriptCount = scripts.length;

    let scriptBundle = "";
    for (const scriptSrc of scripts) {
        if (/^https?:\/\//i.test(scriptSrc)) continue;
        const cleaned = scriptSrc.replace(/^\.\//, "");
        const scriptPath = path.join(ROOT, cleaned);
        if (!fs.existsSync(scriptPath)) {
            result.missingScripts.push(scriptSrc);
            continue;
        }
        scriptBundle += `\n${fs.readFileSync(scriptPath, "utf8")}`;
    }

    if (result.missingScripts.length > 0) {
        result.issues.push(`脚本文件缺失：${result.missingScripts.join(", ")}`);
        result.questions.push("缺失脚本会导致无法开局，是否已在构建流程中做静态资源校验？");
    }

    const fullText = `${htmlForScan}\n${scriptBundle}`;
    result.placeholderHits = countPatternHits(fullText, PLACEHOLDER_PATTERNS);
    result.hasStartControl = hasAnyPattern(fullText, START_PATTERNS);
    result.hasFeedbackHint = hasAnyPattern(fullText, FEEDBACK_PATTERNS);
    result.hasRetryHint = hasAnyPattern(fullText, RETRY_PATTERNS);

    if (result.placeholderHits > 0) {
        result.issues.push(`存在占位/待开发痕迹（${result.placeholderHits} 处）`);
        result.questions.push("该游戏是否应标注为 Beta，而不是作为正式任务开放？");
    }
    if (!result.hasStartControl) {
        result.issues.push("未检测到明显开局控件文案");
        result.questions.push("新玩家第一次进入时，如何明确知道“从哪里开始”？");
    }
    if (!result.hasFeedbackHint) {
        result.issues.push("未检测到明显结果反馈文案");
        result.questions.push("完成后如果没有分数或结论，玩家如何判断自己是否进步？");
    }
    if (!result.hasRetryHint) {
        result.issues.push("未检测到明显重开/再挑战入口文案");
        result.questions.push("一次完成后是否支持低摩擦重复挑战来刷熟练度？");
    }

    return result;
}

function severityOf(taskResult) {
    if (!taskResult.pageExists || !taskResult.pageHttpOk || taskResult.missingScripts.length > 0) {
        return "高";
    }
    if (taskResult.placeholderHits > 0) return "中";
    if (!taskResult.hasStartControl || !taskResult.hasFeedbackHint) return "中";
    if (!taskResult.hasRetryHint) return "低";
    return "通过";
}

function summarizeResults(results) {
    const gameResults = results.filter((r) => !r.sectionTitle.includes("辅助工具") && r.title !== "文档中心");
    return {
        all: results.length,
        games: gameResults.length,
        passed: results.filter((r) => severityOf(r) === "通过").length,
        high: results.filter((r) => severityOf(r) === "高").length,
        medium: results.filter((r) => severityOf(r) === "中").length,
        low: results.filter((r) => severityOf(r) === "低").length
    };
}

function shouldFail(totals) {
    if (FAIL_ON === "low") {
        return totals.high > 0 || totals.medium > 0 || totals.low > 0;
    }
    if (FAIL_ON === "medium") {
        return totals.high > 0 || totals.medium > 0;
    }
    return totals.high > 0;
}

function toMarkdown(results) {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);

    const gameResults = results.filter((r) => !r.sectionTitle.includes("辅助工具") && r.title !== "文档中心");
    const totals = summarizeResults(results);

    const lines = [];
    lines.push("# 06-挑剔玩家全量测评记录");
    lines.push("");
    lines.push(`- 评测日期：${date}`);
    lines.push("- 评测方式：本地自动化首轮（逐页 HTTP 访问 + 页面/脚本规则扫描）");
    lines.push("- 评测范围：主页配置中的全部 `active` 入口（含工具页面）");
    lines.push("");
    lines.push("## 总览");
    lines.push("");
    lines.push(`- 入口总数：${totals.all}`);
    lines.push(`- 游戏入口数（不含工具/文档）：${totals.games}`);
    lines.push(`- 通过：${totals.passed}`);
    lines.push(`- 高风险：${totals.high}`);
    lines.push(`- 中风险：${totals.medium}`);
    lines.push(`- 低风险：${totals.low}`);
    lines.push("");

    lines.push("## 高优先级问题");
    lines.push("");
    const highIssues = results.filter((r) => severityOf(r) === "高");
    if (highIssues.length === 0) {
        lines.push("- 未发现高风险阻断问题（页面均可访问且脚本资源可解析）。");
    } else {
        for (const r of highIssues) {
            lines.push(`- ${r.title}（${r.href}）：${r.issues.join("；")}`);
        }
    }
    lines.push("");

    lines.push("## 分项记录");
    lines.push("");
    lines.push("| 游戏 | 页面 | 级别 | 主要问题 |");
    lines.push("|---|---|---|---|");
    for (const r of gameResults) {
        const level = severityOf(r);
        const issueText = r.issues.length > 0 ? r.issues.join("；") : "未发现阻断问题";
        lines.push(`| ${r.title} | ${r.href} | ${level} | ${issueText} |`);
    }
    lines.push("");

    lines.push("## 挑剔玩家追问清单（汇总）");
    lines.push("");
    const questionSet = new Set();
    for (const r of gameResults) {
        for (const q of r.questions) {
            questionSet.add(q);
        }
    }
    if (questionSet.size === 0) {
        lines.push("- 本轮未产生新增追问。");
    } else {
        let i = 1;
        for (const q of questionSet) {
            lines.push(`${i}. ${q}`);
            i += 1;
        }
    }
    lines.push("");

    lines.push("## 说明与限制");
    lines.push("");
    lines.push("- 本报告覆盖“是否能访问、是否有可开局/可反馈/可重开线索、是否存在待开发痕迹”。");
    lines.push("- 本轮未执行真人交互通关（例如鼠标轨迹、键盘节奏、心理负荷主观体验），建议后续补充人工试玩回合。");
    lines.push("- 报告中未包含任何本地绝对路径，满足脱敏要求。");
    lines.push("");

    return lines.join("\n");
}

async function main() {
    const sections = loadSections();
    const tasks = collectActiveTasks(sections);
    const { server, baseUrl } = await startStaticServer();

    try {
        const results = [];
        for (const task of tasks) {
            // Serial execution keeps output deterministic and avoids random race noise.
            // This report is intended as a stable baseline for further manual playtesting.
            // eslint-disable-next-line no-await-in-loop
            const evaluated = await evaluateTask(baseUrl, task);
            results.push(evaluated);
        }
        const markdown = toMarkdown(results);
        const totals = summarizeResults(results);
        if (CHECK_MODE) {
            console.log(`Checked active entries: ${results.length}`);
            console.log(`Risk summary: high=${totals.high}, medium=${totals.medium}, low=${totals.low}, passed=${totals.passed}`);
            console.log(`Fail threshold: ${FAIL_ON}`);
            if (shouldFail(totals)) {
                process.exitCode = 1;
            }
        } else {
            fs.writeFileSync(OUTPUT_PATH, markdown, "utf8");
            console.log(`Generated: ${path.relative(ROOT, OUTPUT_PATH)}`);
        }
        console.log(`Visited active entries: ${results.length}`);
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
