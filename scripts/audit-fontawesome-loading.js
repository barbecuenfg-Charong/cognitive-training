const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FA_HREF = "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css";

function listRootHtmlFiles() {
    return fs
        .readdirSync(ROOT, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
        .map((entry) => path.join(ROOT, entry.name));
}

function main() {
    const files = listRootHtmlFiles();
    let blockingCount = 0;
    let preloadCount = 0;
    const blockingFiles = [];
    const legacyLink = `<link rel="stylesheet" href="${FA_HREF}">`;
    const noscriptLink = `<noscript><link rel="stylesheet" href="${FA_HREF}"></noscript>`;

    for (const filePath of files) {
        const content = fs.readFileSync(filePath, "utf8");
        const hasLegacyBlocking = content.includes(legacyLink) && !content.includes(noscriptLink);
        const hasPreload = content.includes(`rel="preload" href="${FA_HREF}"`);
        if (hasLegacyBlocking) {
            blockingCount += 1;
            blockingFiles.push(path.basename(filePath));
        }
        if (hasPreload) {
            preloadCount += 1;
        }
    }

    console.log(`HTML files: ${files.length}`);
    console.log(`Font Awesome preload pages: ${preloadCount}`);
    console.log(`Blocking Font Awesome pages: ${blockingCount}`);
    if (blockingFiles.length > 0) {
        console.log("Blocking files:");
        console.log(blockingFiles.join("\n"));
        process.exitCode = 1;
    }
}

main();
