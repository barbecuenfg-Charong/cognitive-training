const { contextBridge, shell } = require("electron");

contextBridge.exposeInMainWorld("electronShell", {
    openPath(targetPath) {
        return shell.openPath(String(targetPath || ""));
    }
});

