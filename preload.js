const { contextBridge, shell } = require("electron");
const fs = require("fs");
const path = require("path");
const { fileURLToPath } = require("url");

function getAppRoot() {
    try {
        return fs.realpathSync.native(__dirname);
    } catch (_error) {
        return path.resolve(__dirname);
    }
}

const appRoot = getAppRoot();
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function isProtocolUrl(value) {
    return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value) && !/^[a-zA-Z]:[\\/]/.test(value);
}

function isInsideAppRoot(filePath) {
    const relativePath = path.relative(appRoot, filePath);
    return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function resolveExistingPath(filePath) {
    try {
        return fs.realpathSync.native(filePath);
    } catch (_error) {
        return filePath;
    }
}

function getAllowedLocalUrl(target) {
    if (!isProtocolUrl(target)) {
        return null;
    }

    let url = null;
    try {
        url = new URL(target);
    } catch (_error) {
        return null;
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
    }

    return LOCAL_HOSTS.has(url.hostname.toLowerCase()) ? url : null;
}

function getAllowedFilePath(target) {
    if (!target) {
        return null;
    }

    let filePath = null;
    if (isProtocolUrl(target)) {
        let url = null;
        try {
            url = new URL(target);
        } catch (_error) {
            return null;
        }

        if (url.protocol !== "file:") {
            return null;
        }

        try {
            filePath = fileURLToPath(url);
        } catch (_error) {
            return null;
        }
    } else {
        filePath = path.resolve(appRoot, target);
    }

    const resolvedPath = path.resolve(filePath);
    if (!isInsideAppRoot(resolvedPath)) {
        return null;
    }

    const realPath = resolveExistingPath(resolvedPath);
    return isInsideAppRoot(realPath) ? realPath : null;
}

function blockedResult() {
    return Promise.resolve("Blocked by preload policy");
}

function toErrorMessage(error) {
    return String(error && error.message ? error.message : error);
}

contextBridge.exposeInMainWorld("electronShell", {
    openPath(targetPath) {
        const target = String(targetPath || "").trim();
        const localUrl = getAllowedLocalUrl(target);
        if (localUrl) {
            return shell.openExternal(localUrl.toString()).then(() => "").catch(toErrorMessage);
        }

        const filePath = getAllowedFilePath(target);
        if (!filePath) {
            return blockedResult();
        }

        return shell.openPath(filePath);
    }
});
