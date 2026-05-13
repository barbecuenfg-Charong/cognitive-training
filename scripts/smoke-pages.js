const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const HOME_CONFIG = "src/home/config.js";
const EXTRA_PAGES = ["index.html", "health-check.html"];

function cleanLocalRef(ref, baseDir = "") {
    const value = (ref || "").trim();
    if (!value) return null;
    if (/^(?:[a-z]+:)?\/\//i.test(value)) return null;
    if (/^(?:data|mailto|tel|javascript):/i.test(value)) return null;
    if (value.startsWith("#")) return null;

    const withoutHash = value.split("#")[0];
    const withoutQuery = withoutHash.split("?")[0];
    if (!withoutQuery) return null;

    const posixRef = withoutQuery.replace(/\\/g, "/");
    if (/^[a-z]:\//i.test(posixRef)) return null;

    const normalized = path.posix.normalize(
        posixRef.startsWith("/")
            ? posixRef.replace(/^\/+/, "")
            : path.posix.join(baseDir, posixRef)
    );
    const isInvalidPath =
        normalized === "." ||
        normalized.startsWith("../") ||
        normalized === ".." ||
        path.isAbsolute(normalized);
    if (isInvalidPath) {
        return null;
    }
    return normalized;
}

function extractRefs(html, tagName, attrName, baseDir) {
    const refs = [];
    const regex = new RegExp(`<${tagName}\\b[^>]*\\b${attrName}\\s*=\\s*["']([^"']+)["'][^>]*>`, "gi");
    let match;
    while ((match = regex.exec(html))) {
        const cleaned = cleanLocalRef(match[1], baseDir);
        if (cleaned) refs.push(cleaned);
    }
    return refs;
}

function loadSections() {
    const configPath = path.join(ROOT, HOME_CONFIG);
    const source = fs.readFileSync(configPath, "utf8");
    const runnableSource = source.replace(/^\s*export\s+const\s+sections\s*=/m, "const sections =");

    if (runnableSource === source) {
        throw new Error(`Unable to find sections export in ${HOME_CONFIG}`);
    }

    const sections = vm.runInNewContext(`${runnableSource}\nsections;`, Object.create(null), {
        filename: HOME_CONFIG,
        timeout: 1000
    });

    if (!Array.isArray(sections)) {
        throw new Error(`${HOME_CONFIG} did not export a sections array`);
    }

    return sections;
}

function collectActivePages(sections) {
    const pages = [];

    for (const section of sections) {
        const tasks = section && Array.isArray(section.tasks) ? section.tasks : [];
        for (const task of tasks) {
            if (!task || task.status !== "active") continue;

            const page = cleanLocalRef(task.href);
            if (!page) {
                throw new Error(`Active task has an invalid local href: ${task.href || "<empty>"}`);
            }
            pages.push(page);
        }
    }

    if (pages.length === 0) {
        throw new Error(`No active page hrefs found in ${HOME_CONFIG}`);
    }

    return pages;
}

function uniquePages(pages) {
    const seen = new Set();
    const unique = [];

    for (const page of pages) {
        if (seen.has(page)) continue;
        seen.add(page);
        unique.push(page);
    }

    return unique;
}

function buildPageList() {
    return uniquePages([...collectActivePages(loadSections()), ...EXTRA_PAGES]);
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
    const pagePath = path.join(ROOT, page);
    const pageDir = path.posix.dirname(page) === "." ? "" : path.posix.dirname(page);
    let html = "";

    try {
        html = fs.readFileSync(pagePath, "utf8");
    } catch (error) {
        issues.push(`HTML not readable: ${error.message}`);
        return { page, issues, checkedAssets: 0 };
    }

    const scripts = extractRefs(html, "script", "src", pageDir);
    const cssRefs = extractRefs(html, "link", "href", pageDir).filter(
        (ref) => path.extname(ref).toLowerCase() === ".css"
    );
    const assets = [...new Set([...scripts, ...cssRefs])];

    for (const asset of assets) {
        if (!fileExists(asset)) {
            issues.push(`Missing referenced asset: ${asset}`);
        }
    }

    return { page, issues, checkedAssets: assets.length };
}

function main() {
    let pages;
    try {
        pages = buildPageList();
    } catch (error) {
        console.log(`[FAIL] ${HOME_CONFIG}`);
        console.log(`  - ${error.message}`);
        process.exitCode = 1;
        return;
    }

    const results = pages.map(checkPage);
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
