const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TEXT_EXT = new Set([
    ".md",
    ".html",
    ".js",
    ".json",
    ".css",
    ".yml",
    ".yaml",
    ".txt",
    ".ts",
    ".tsx",
    ".jsx",
    ".cmd"
]);

const SENSITIVE_PATTERNS = [
    /C:\\Users\\Administrator/gi,
    /[A-Za-z]:\\Users\\/gi,
    /\/Users\//gi,
    /(^|[^A-Za-z0-9_])[A-Za-z]:\\[^`"'<>|]+/gi,
    new RegExp("barbecue" + "nfg", "gi"),
    new RegExp("barbecue" + "nfg-charong\\.github\\.io", "gi")
];

function walk(dir, out = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === ".git" || entry.name === "node_modules") continue;
            walk(fullPath, out);
            continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (!TEXT_EXT.has(ext)) continue;
        if (path.basename(fullPath) === "check-sensitive-paths.js") continue;
        out.push(fullPath);
    }
    return out;
}

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split(/\r?\n/);
    const hits = [];
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        if (SENSITIVE_PATTERNS.some((p) => p.test(line))) {
            hits.push({ line: i + 1, text: line.trim() });
        }
        for (const pattern of SENSITIVE_PATTERNS) {
            pattern.lastIndex = 0;
        }
    }
    return hits;
}

function main() {
    const files = walk(ROOT);
    const findings = [];
    for (const file of files) {
        const matches = scanFile(file);
        if (matches.length === 0) continue;
        for (const match of matches) {
            findings.push({
                file: path.relative(ROOT, file).replace(/\\/g, "/"),
                line: match.line,
                text: match.text
            });
        }
    }

    if (findings.length === 0) {
        console.log("No sensitive local path patterns found.");
        return;
    }

    console.log(`Found ${findings.length} potential sensitive lines:`);
    for (const item of findings) {
        console.log(`${item.file}:${item.line}: ${item.text}`);
    }
    process.exit(1);
}

main();
