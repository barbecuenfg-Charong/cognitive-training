const fs = require("fs");
const http = require("http");
const path = require("path");

const port = process.env.PORT || 3000;
const rootDir = __dirname;

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8"
};

const SECURITY_HEADERS = {
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data:; font-src 'self' data: https://cdnjs.cloudflare.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};

function writeResponse(res, statusCode, headers, body) {
    res.writeHead(statusCode, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
}

function resolveFilePath(urlPath) {
    let safePath = "/";
    try {
        safePath = decodeURIComponent((urlPath || "/").split("?")[0]);
    } catch (_error) {
        return null;
    }

    const candidate = safePath.replace(/^\/+/, "");
    const requested = candidate === "" ? "index.html" : candidate;
    const normalizedPath = path.posix.normalize(requested.replace(/\\/g, "/"));
    if (normalizedPath.startsWith("../") || path.posix.isAbsolute(normalizedPath)) {
        return null;
    }

    const absolutePath = path.resolve(rootDir, normalizedPath);
    const rootPrefix = rootDir.endsWith(path.sep) ? rootDir : `${rootDir}${path.sep}`;
    if (!absolutePath.startsWith(rootPrefix) && absolutePath !== rootDir) {
        return null;
    }
    return absolutePath;
}

const server = http.createServer((req, res) => {
    const filePath = resolveFilePath(req.url || "/");
    if (!filePath) {
        writeResponse(res, 400, { "Content-Type": "text/plain; charset=utf-8" }, "Bad Request");
        return;
    }

    fs.stat(filePath, (statError, stat) => {
        if (statError || !stat.isFile()) {
            writeResponse(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[extension] || "application/octet-stream";
        res.writeHead(200, { ...SECURITY_HEADERS, "Content-Type": contentType });
        const stream = fs.createReadStream(filePath);
        stream.on("error", () => {
            if (!res.headersSent) {
                writeResponse(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Internal Server Error");
            } else {
                res.destroy();
            }
        });
        stream.pipe(res);
    });
});

server.listen(port, () => {
    console.log(`Cognitive Training Hub running at http://localhost:${port}`);
});
