const fs = require("fs");
const http = require("http");
const path = require("path");

const port = process.env.PORT || 3000;
const host = process.env.HOST || "127.0.0.1";
const rootDir = __dirname;
const REQUEST_BASE = "http://127.0.0.1";

const MIME_TYPES = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".svg": "image/svg+xml; charset=utf-8"
};

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);
const FORBIDDEN_SEGMENTS = new Set([".git", ".github", "node_modules", "dist", "dist-pages"]);
const SAFE_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

const SECURITY_HEADERS = {
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data:; font-src 'self' data: https://cdnjs.cloudflare.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'"
};

function writeResponse(req, res, statusCode, headers, body) {
    res.writeHead(statusCode, { ...SECURITY_HEADERS, ...headers });
    res.end(req.method === "HEAD" ? "" : body);
}

function formatHostForUrl(value) {
    return value.includes(":") && !value.startsWith("[") ? `[${value}]` : value;
}

function resolveFilePath(urlPath) {
    let decodedPath = "/";
    try {
        const requestUrl = new URL(urlPath || "/", REQUEST_BASE);
        decodedPath = decodeURIComponent(requestUrl.pathname);
    } catch (_error) {
        return { statusCode: 400, message: "Bad Request" };
    }

    const candidate = decodedPath.replace(/^\/+/, "");
    const requested = candidate === "" ? "index.html" : candidate;
    const normalizedPath = path.posix.normalize(requested.replace(/\\/g, "/"));
    if (normalizedPath === ".." || normalizedPath.startsWith("../") || path.posix.isAbsolute(normalizedPath) || path.win32.isAbsolute(normalizedPath)) {
        return { statusCode: 403, message: "Forbidden" };
    }

    const segments = normalizedPath.split("/").filter(Boolean);
    if (segments.some((segment) => {
        const lowerSegment = segment.toLowerCase();
        return lowerSegment.startsWith(".") || FORBIDDEN_SEGMENTS.has(lowerSegment);
    })) {
        return { statusCode: 403, message: "Forbidden" };
    }

    const extension = path.extname(normalizedPath).toLowerCase();
    if (!SAFE_EXTENSIONS.has(extension)) {
        return { statusCode: 403, message: "Forbidden" };
    }

    const absolutePath = path.resolve(rootDir, normalizedPath);
    const resolvedRoot = path.resolve(rootDir);
    const rootPrefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : `${resolvedRoot}${path.sep}`;
    const lowerAbsolutePath = absolutePath.toLowerCase();
    const lowerRoot = resolvedRoot.toLowerCase();
    const lowerRootPrefix = rootPrefix.toLowerCase();
    if (!lowerAbsolutePath.startsWith(lowerRootPrefix) && lowerAbsolutePath !== lowerRoot) {
        return { statusCode: 403, message: "Forbidden" };
    }
    return { filePath: absolutePath };
}

const server = http.createServer((req, res) => {
    if (!ALLOWED_METHODS.has(req.method)) {
        writeResponse(req, res, 405, { "Allow": "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
        return;
    }

    const resolved = resolveFilePath(req.url || "/");
    if (!resolved.filePath) {
        writeResponse(req, res, resolved.statusCode, { "Content-Type": "text/plain; charset=utf-8" }, resolved.message);
        return;
    }

    fs.stat(resolved.filePath, (statError, stat) => {
        if (statError || !stat.isFile()) {
            writeResponse(req, res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
            return;
        }

        const extension = path.extname(resolved.filePath).toLowerCase();
        const contentType = MIME_TYPES[extension];
        res.writeHead(200, { ...SECURITY_HEADERS, "Content-Length": stat.size, "Content-Type": contentType });
        if (req.method === "HEAD") {
            res.end();
            return;
        }

        const stream = fs.createReadStream(resolved.filePath);
        stream.on("error", () => {
            if (!res.headersSent) {
                writeResponse(req, res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Internal Server Error");
            } else {
                res.destroy();
            }
        });
        stream.pipe(res);
    });
});

server.listen(port, host, () => {
    console.log(`Cognitive Training Hub running at http://${formatHostForUrl(host)}:${port}`);
});
