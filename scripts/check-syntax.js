const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules", "dist", "dist-pages"]);
const SKIP_FILES = new Set(["d3.v7.min.js"]);

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

        if (path.extname(entry.name).toLowerCase() !== ".js") continue;
        if (SKIP_FILES.has(entry.name)) continue;
        out.push(fullPath);
    }

    return out;
}

function formatRelative(filePath) {
    return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function checkFile(filePath) {
    return spawnSync(process.execPath, ["--check", filePath], {
        cwd: ROOT,
        encoding: "utf8"
    });
}

function main() {
    const files = walk(ROOT);
    const failures = [];

    for (const file of files) {
        const result = checkFile(file);
        if (result.status === 0) continue;

        failures.push(file);
        console.error(`Syntax check failed: ${formatRelative(file)}`);
        if (result.stdout) console.error(result.stdout.trimEnd());
        if (result.stderr) console.error(result.stderr.trimEnd());
    }

    if (failures.length > 0) {
        console.error(`Syntax check failed for ${failures.length} file(s).`);
        process.exit(1);
    }

    console.log(`Syntax check passed for ${files.length} JavaScript file(s).`);
}

main();
