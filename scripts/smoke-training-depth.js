const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
    return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertContains(source, pattern, label) {
    if (!pattern.test(source)) {
        throw new Error(`Missing ${label}`);
    }
}

function assertAll(relativePath, checks) {
    const source = read(relativePath);
    checks.forEach((check) => assertContains(source, check.pattern, `${relativePath}: ${check.label}`));
    console.log(`[PASS] ${relativePath} (${checks.length} depth checks)`);
}

function main() {
    assertAll("src/shared/attention-profile.js", [
        { label: "attention records flag", pattern: /hasAttentionRecords/ },
        { label: "system summary text", pattern: /summaryText/ },
        { label: "profile chips", pattern: /chips/ },
        { label: "training prescriptions", pattern: /prescriptions/ },
        { label: "attention aggregation", pattern: /aggregateAttentionSessions/ }
    ]);

    assertAll("london-tower.js", [
        { label: "optimal solver", pattern: /function\s+solveOptimalMoves/ },
        { label: "BFS next state expansion", pattern: /function\s+nextStatesFor/ },
        { label: "validated optimal moves", pattern: /validatedOptimalMoves/ },
        { label: "optimal mismatch tracking", pattern: /optimalMismatch/ },
        { label: "planning efficiency", pattern: /planningEfficiency/ },
        { label: "validated optimal rate", pattern: /validatedOptimalRate/ },
        { label: "planning prescription", pattern: /planningPrescription/ }
    ]);

    assertAll("sliding-puzzle.js", [
        { label: "3x3 exact solver", pattern: /function\s+solveExactDistanceForThreeByThree/ },
        { label: "exact solution moves", pattern: /exactSolutionMoves/ },
        { label: "solution basis", pattern: /solutionBasis/ },
        { label: "solution gap moves", pattern: /solutionGapMoves/ },
        { label: "solution gap rate", pattern: /solutionGapRate/ },
        { label: "search expansion count", pattern: /searchExpandedStates/ },
        { label: "search timeout flag", pattern: /searchTimedOut/ }
    ]);

    console.log("training depth smoke passed");
}

main();
