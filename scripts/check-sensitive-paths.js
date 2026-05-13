const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TEXT_EXT = new Set([
    ".bat",
    ".cmd",
    ".conf",
    ".config",
    ".css",
    ".csv",
    ".md",
    ".html",
    ".ini",
    ".js",
    ".jsx",
    ".json",
    ".key",
    ".pem",
    ".properties",
    ".ps1",
    ".sh",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".xml",
    ".yml",
    ".yaml"
]);
const TEXT_FILE_NAMES = new Set([".env", ".envrc"]);
const SKIP_DIRS = new Set([".git", "node_modules"]);

const SENSITIVE_RULES = [
    { name: "windows-administrator-profile", pattern: /C:\\Users\\Administrator/i },
    { name: "windows-user-profile", pattern: /[A-Za-z]:\\Users\\/i },
    { name: "macos-user-profile", pattern: /\/Users\//i },
    { name: "absolute-windows-path", pattern: /(^|[^A-Za-z0-9_])[A-Za-z]:\\[^`"'<>|]+/i },
    { name: "personal-github-handle", pattern: new RegExp("barbecue" + "nfg", "i") },
    { name: "personal-github-pages", pattern: new RegExp("barbecue" + "nfg-charong\\.github\\.io", "i") },
    { name: "private-key-block", pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/i },
    { name: "openai-api-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
    { name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/ },
    { name: "google-api-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
    { name: "aws-access-key", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
    { name: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
    { name: "jwt-token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
    { name: "authorization-bearer", pattern: /\bBearer\s+[A-Za-z0-9._+/=-]{20,}\b/i },
    { name: "url-embedded-credentials", pattern: /\bhttps?:\/\/[^/\s:@]+:[^@\s]+@/i },
    { name: "static-token-assignment", pattern: /\b(?:token|session[_-]?token)\b\s*[:=]\s*["'][A-Za-z0-9._+/=-]{20,}["']/i },
    {
        name: "sensitive-assignment",
        pattern:
            /\b(?:api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|secret[_-]?key|client[_-]?secret|password|passwd|pwd|private[_-]?key)\b\s*[:=]\s*["']?(?!<redacted>|redacted|example|sample|dummy|placeholder|changeme|your[-_ ]?)[^"'\s#,;]{8,}/i
    },
    {
        name: "environment-secret-assignment",
        pattern:
            /^\s*[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD|PASSWD|PWD|PRIVATE_KEY)\s*=\s*(?!<redacted>|redacted|example|sample|dummy|placeholder|changeme|your[-_ ]?).{8,}/i
    }
];

function isTextFile(filePath) {
    const baseName = path.basename(filePath);
    if (TEXT_FILE_NAMES.has(baseName)) return true;
    if (baseName.startsWith(".env.")) return true;
    return TEXT_EXT.has(path.extname(baseName).toLowerCase());
}

function walk(dir, out = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            walk(fullPath, out);
            continue;
        }

        if (!isTextFile(fullPath)) continue;
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
        for (const rule of SENSITIVE_RULES) {
            if (rule.pattern.test(line)) {
                hits.push({ line: i + 1, rule: rule.name });
            }
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
                rule: match.rule
            });
        }
    }

    if (findings.length === 0) {
        console.log("No sensitive path or credential patterns found.");
        return;
    }

    console.log(`Found ${findings.length} potential sensitive match(es):`);
    for (const item of findings) {
        console.log(`${item.file}:${item.line}: ${item.rule}`);
    }
    process.exit(1);
}

main();
