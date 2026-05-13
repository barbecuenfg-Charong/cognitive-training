(function initTrainingResults(global) {
    const STORAGE_KEY = "cognitive-training:sessions";
    const SCHEMA_VERSION = "training-result-v1";
    const MAX_STORED_SESSIONS = 300;
    const MAX_TRIALS_PER_SESSION = 500;

    function safeParse(value, fallback) {
        try {
            return JSON.parse(value);
        } catch (_error) {
            return fallback;
        }
    }

    function getStorage() {
        try {
            return global.localStorage || null;
        } catch (_error) {
            return null;
        }
    }

    function loadSessions() {
        const storage = getStorage();
        if (!storage) {
            return [];
        }

        let raw = null;
        try {
            raw = storage.getItem(STORAGE_KEY);
        } catch (_error) {
            return [];
        }

        const data = raw ? safeParse(raw, []) : [];
        return Array.isArray(data) ? data : [];
    }

    function saveSessions(list) {
        const storage = getStorage();
        if (!storage) {
            return false;
        }

        const sessions = Array.isArray(list) ? list.slice(0, MAX_STORED_SESSIONS) : [];
        try {
            storage.setItem(STORAGE_KEY, JSON.stringify(sessions));
            return true;
        } catch (_error) {
            return false;
        }
    }

    function toDateKey(value) {
        const date = value instanceof Date ? value : new Date(value);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function sortByFinishedAtDesc(a, b) {
        return new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime();
    }

    function toPlainObject(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_error) {
            return {};
        }
    }

    function toOptionalString(value) {
        if (value === null || typeof value === "undefined") {
            return null;
        }
        const text = String(value).trim();
        return text ? text : null;
    }

    function normalizeTrials(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.slice(0, MAX_TRIALS_PER_SESSION).map((item, index) => {
            const trial = toPlainObject(item);
            if (!Object.prototype.hasOwnProperty.call(trial, "index")) {
                trial.index = index;
            }
            return trial;
        });
    }

    function normalizeSession(session) {
        const finishedAt = session.finishedAt ? new Date(session.finishedAt) : new Date();
        const startedAt = session.startedAt ? new Date(session.startedAt) : new Date(finishedAt.getTime());
        const durationMs = Number.isFinite(session.durationMs)
            ? Math.max(0, Math.round(session.durationMs))
            : Math.max(0, finishedAt.getTime() - startedAt.getTime());

        const moduleId = session.moduleId || session.gameId || "unknown";
        const summary = toPlainObject(session.summary);
        const metrics = toPlainObject(session.metrics);
        const trials = normalizeTrials(session.trials);
        const seed = toOptionalString(session.seed || summary.seed || metrics.seed || summary.sessionSeed || metrics.sessionSeed);
        const contentVersion = toOptionalString(session.contentVersion || summary.contentVersion || metrics.contentVersion);

        return {
            schemaVersion: session.schemaVersion || SCHEMA_VERSION,
            id: session.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            moduleId,
            gameId: session.gameId || moduleId,
            gameName: session.gameName || "Unknown Game",
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs,
            score: Number.isFinite(session.score) ? session.score : null,
            seed,
            contentVersion,
            summary,
            trials,
            metrics,
            tags: Array.isArray(session.tags) ? session.tags : []
        };
    }

    function saveSession(session) {
        const list = loadSessions();
        const normalized = normalizeSession(session);
        list.push(normalized);
        list.sort(sortByFinishedAtDesc);
        saveSessions(list);
        return normalized;
    }

    function getAllSessions() {
        return loadSessions().sort(sortByFinishedAtDesc);
    }

    function getSessionsByDate(dateKey) {
        return getAllSessions().filter((item) => toDateKey(item.finishedAt) === dateKey);
    }

    function getTodaySessions() {
        return getSessionsByDate(toDateKey(new Date()));
    }

    function getAvailableDates() {
        const unique = new Set(getAllSessions().map((item) => toDateKey(item.finishedAt)));
        return Array.from(unique).sort((a, b) => (a > b ? -1 : 1));
    }

    function getDailyOverview(dateKey) {
        const sessions = getSessionsByDate(dateKey);
        const totalSessions = sessions.length;
        const uniqueGames = new Set(sessions.map((item) => item.gameId)).size;
        const totalDurationMs = sessions.reduce((sum, item) => sum + (item.durationMs || 0), 0);
        const averageDurationMs = totalSessions > 0 ? Math.round(totalDurationMs / totalSessions) : 0;

        return {
            dateKey,
            totalSessions,
            uniqueGames,
            totalDurationMs,
            averageDurationMs
        };
    }

    function clearAllSessions() {
        const storage = getStorage();
        if (!storage) {
            return;
        }

        try {
            storage.removeItem(STORAGE_KEY);
        } catch (_error) {
            // Storage may be disabled or unavailable in restricted browser contexts.
        }
    }

    global.TrainingResults = {
        saveSession,
        getAllSessions,
        getSessionsByDate,
        getTodaySessions,
        getAvailableDates,
        getDailyOverview,
        clearAllSessions
    };
})(window);
