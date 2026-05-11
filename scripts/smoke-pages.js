const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const PAGES = [
    {
        file: "stop-signal.html",
        requiredScripts: ["src/shared/training-results.js", "src/shared/seeded-random.js", "stop-signal.js"]
    },
    {
        file: "go-no-go.html",
        requiredScripts: ["src/shared/training-results.js", "src/shared/seeded-random.js", "go-no-go.js"]
    },
    {
        file: "schulte.html",
        requiredScripts: ["src/shared/training-results.js", "src/shared/seeded-random.js", "schulte.js"]
    },
    {
        file: "balloon-risk.html",
        requiredScripts: ["src/shared/training-results.js", "src/shared/seeded-random.js", "balloon-risk.js"]
    },
    {
        file: "nback.html",
        requiredScripts: ["src/shared/training-results.js", "src/shared/seeded-random.js", "nback.js"]
    },
    {
        file: "corsi.html",
        requiredScripts: ["src/shared/training-results.js", "src/shared/seeded-random.js", "corsi.js"]
    },
    {
        file: "report.html",
        requiredScripts: ["src/shared/training-results.js", "report.js"]
    },
    {
        file: "index.html",
        requiredScripts: ["src/home/index.js"]
    }
];

function cleanLocalRef(ref) {
    const value = (ref || "").trim();
    if (!value) return null;
    if (/^(?:[a-z]+:)?\/\//i.test(value)) return null;
    if (/^(?:data|mailto|tel|javascript):/i.test(value)) return null;
    if (value.startsWith("#")) return null;

    const withoutHash = value.split("#")[0];
    const withoutQuery = withoutHash.split("?")[0];
    if (!withoutQuery) return null;

    const normalized = path.normalize(withoutQuery.replace(/^\/+/, ""));
    if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
        return null;
    }
    return normalized.replace(/\\/g, "/");
}

function extractRefs(html, tagName, attrName) {
    const refs = [];
    const regex = new RegExp(`<${tagName}\\b[^>]*\\b${attrName}\\s*=\\s*["']([^"']+)["'][^>]*>`, "gi");
    let match;
    while ((match = regex.exec(html))) {
        const cleaned = cleanLocalRef(match[1]);
        if (cleaned) refs.push(cleaned);
    }
    return refs;
}

function fileExists(relativePath) {
    const fullPath = path.join(ROOT, relativePath);
    try {
        return fs.statSync(fullPath).isFile();
    } catch (_error) {
        return false;
    }
}

function checkPage(page) {
    const issues = [];
    const pagePath = path.join(ROOT, page.file);
    let html = "";

    try {
        html = fs.readFileSync(pagePath, "utf8");
    } catch (error) {
        issues.push(`HTML not readable: ${error.message}`);
        return { page: page.file, issues, checkedAssets: 0 };
    }

    const scripts = extractRefs(html, "script", "src");
    const cssRefs = extractRefs(html, "link", "href").filter((ref) => path.extname(ref).toLowerCase() === ".css");
    const assets = [...new Set([...scripts, ...cssRefs])];

    for (const asset of assets) {
        if (!fileExists(asset)) {
            issues.push(`Missing referenced asset: ${asset}`);
        }
    }

    for (const requiredScript of page.requiredScripts) {
        const normalized = cleanLocalRef(requiredScript);
        if (!normalized || !scripts.includes(normalized)) {
            issues.push(`Missing required script reference: ${requiredScript}`);
        }
    }

    return { page: page.file, issues, checkedAssets: assets.length };
}

function main() {
    const results = PAGES.map(checkPage);
    let failed = 0;

    for (const result of results) {
        if (result.issues.length === 0) {
            console.log(`[PASS] ${result.page} (${result.checkedAssets} local JS/CSS refs)`);
            continue;
        }

        failed += 1;
        console.log(`[FAIL] ${result.page}`);
        for (const issue of result.issues) {
            console.log(`  - ${issue}`);
        }
    }

    const passed = results.length - failed;
    console.log(`Summary: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exitCode = 1;
    }
}

main();
