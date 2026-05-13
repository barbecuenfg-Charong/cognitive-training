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

    assertAll("alternative-uses.js", [
        { label: "prompt variant tracking", pattern: /promptVariant/ },
        { label: "raw answer count", pattern: /rawAnswerCount/ },
        { label: "fluency metric", pattern: /\bfluency\b/ },
        { label: "flexibility metric", pattern: /\bflexibility\b/ },
        { label: "category count", pattern: /categoryCount/ },
        { label: "duplicate answer count", pattern: /duplicateCount/ },
        { label: "vague answer count", pattern: /vagueCount/ },
        { label: "elaboration metric", pattern: /\belaboration\b|meanElaboration/ },
        { label: "originality boundary", pattern: /originalityBoundary/ }
    ]);

    assertAll("remote-associates.js", [
        { label: "difficulty grading", pattern: /\bdifficulty\b/ },
        { label: "correct answer field", pattern: /correctAnswer/ },
        { label: "hint level tracking", pattern: /hintLevelUsed/ },
        { label: "response time tracking", pattern: /rtMs/ },
        { label: "give-up rate", pattern: /giveUpRate/ },
        { label: "semantic distance", pattern: /semanticDistance/ },
        { label: "clue distance explanation", pattern: /clueDistanceDescription/ },
        { label: "difficulty accuracy breakdown", pattern: /accuracyByDifficulty/ }
    ]);

    assertAll("torrance-creative.js", [
        { label: "figure or prompt pool", pattern: /ALL_(?:FIGURES|PROMPTS)|figureOrder|promptOrder/ },
        { label: "title metric", pattern: /title(?:Diversity|Metric|Score|Specificity)/ },
        { label: "detail metric", pattern: /detailMetric|detailScore|detailCount|elaboration/ },
        { label: "category metric", pattern: /categoryCount|categoryLabels|categoryMetric/ },
        { label: "transformation metric", pattern: /transform(?:ation)?Metric|transformationCount|transformationLabels/ },
        { label: "raw response preservation", pattern: /rawResponse|rawAnswer|rawTitle|rawDescription/ },
        { label: "non-standardized scoring boundary", pattern: /nonStandard|standardizedBoundary|scoringBoundary/ }
    ]);

    assertAll("ultimatum-game.js", [
        { label: "offer ratio", pattern: /offerRatio/ },
        { label: "dynamic fairness threshold", pattern: /dynamicFairnessThreshold/ },
        { label: "offer band breakdown", pattern: /offerBandBreakdown/ },
        { label: "inconsistent choice", pattern: /inconsistentChoice/ },
        { label: "strategy adaptation index", pattern: /strategyAdaptationIndex/ }
    ]);

    assertAll("trust-game.js", [
        { label: "reciprocity sensitivity", pattern: /reciprocitySensitivity/ },
        { label: "trust trend", pattern: /trustTrend/ },
        { label: "low return event", pattern: /lowReturnEvent/ },
        { label: "reciprocity phase change", pattern: /reciprocityPhaseChange/ },
        { label: "strategy adaptation index", pattern: /strategyAdaptationIndex/ }
    ]);

    assertAll("prisoner-dilemma.js", [
        { label: "tit for tat match rate", pattern: /titForTatMatchRate/ },
        { label: "strategy adaptation index", pattern: /strategyAdaptationIndex/ },
        { label: "end game effect", pattern: /endGameEffect/ },
        { label: "cooperation after opponent cooperation rate", pattern: /cooperationAfterOpponentCooperationRate/ },
        { label: "forgiveness after defection rate", pattern: /forgivenessAfterDefectionRate|forgivenessAfterOpponentDefectionRate|forgiveAfterDefectionRate|defectionForgivenessRate/ }
    ]);

    assertAll("raven.js", [
        { label: "rule id", pattern: /ruleId/ },
        { label: "rule breakdown", pattern: /ruleBreakdown/ },
        { label: "template breakdown", pattern: /templateBreakdown/ },
        { label: "error breakdown", pattern: /errorBreakdown/ },
        { label: "answer rationale", pattern: /answerRationale/ },
        { label: "distractor rationale", pattern: /distractorRationale/ }
    ]);

    assertAll("stop-signal.js", [
        { label: "ssrt estimate", pattern: /ssrtEstimate/ },
        { label: "ssd trajectory", pattern: /ssdTrajectory/ },
        { label: "ssd staircase quality", pattern: /ssdStaircaseQuality|staircaseQuality/ },
        { label: "go waiting flag", pattern: /goWaitingFlag|strategicSlowingFlag/ },
        { label: "next practice recommendation", pattern: /nextPracticeRecommendation|practiceRecommendation|nextPracticeAdvice/ }
    ]);

    assertAll("nback.js", [
        { label: "adaptation events", pattern: /adaptationEvents/ },
        { label: "next recommended n", pattern: /nextRecommendedN/ },
        { label: "adaptive stability label", pattern: /adaptiveStabilityLabel|loadStability/ },
        { label: "oscillation or reversal", pattern: /oscillation|reversal/ },
        { label: "next prescription reason", pattern: /nextPrescriptionReason/ }
    ]);

    assertAll("corsi.js", [
        { label: "adaptation events", pattern: /adaptationEvents/ },
        { label: "next start span", pattern: /nextStartSpan/ },
        { label: "adaptive stability label", pattern: /adaptiveStabilityLabel|spanStability/ },
        { label: "oscillation or reversal", pattern: /oscillation|reversal/ },
        { label: "next mode", pattern: /nextMode|modeTransitionReadiness/ }
    ]);

    assertAll("digit-span.js", [
        { label: "adaptation events", pattern: /adaptationEvents/ },
        { label: "next start span", pattern: /nextStartSpan/ },
        { label: "adaptive stability label", pattern: /adaptiveStabilityLabel|spanStability/ },
        { label: "oscillation or reversal", pattern: /oscillation|reversal/ },
        { label: "next mode or readiness", pattern: /nextMode|backwardReadiness|sortedReadiness/ }
    ]);

    assertAll("sally-anne.js", [
        { label: "scenario pool", pattern: /ALL_(?:SCENARIOS|ITEMS)|scenario/ },
        { label: "belief order level", pattern: /beliefOrder|beliefLevel|firstOrderBelief|secondOrderBelief/ },
        { label: "reality control question", pattern: /realityControl|realityQuestion|actualLocation/ },
        { label: "memory control question", pattern: /memoryControl|memoryQuestion|rememberedLocation/ },
        { label: "question type tracking", pattern: /questionType/ },
        { label: "error type tracking", pattern: /errorType/ },
        { label: "explanation feedback", pattern: /explanationFeedback|feedbackExplanation|explanationText/ }
    ]);

    assertAll("eyes-reading.js", [
        { label: "material source boundary", pattern: /materialSource|sourceCredit|licenseBoundary|copyright/ },
        { label: "item id tracking", pattern: /itemId|itemOrder/ },
        { label: "option tracking", pattern: /optionOrder|options/ },
        { label: "correctness tracking", pattern: /\bcorrect\b/ },
        { label: "emotion category", pattern: /emotionCategory|\bemotion\b/ },
        { label: "confusable category", pattern: /confusable|confusionSet|distractorCategory/ },
        { label: "vocabulary risk", pattern: /vocabulary|lexical|wordComprehension|comprehensionRisk/ },
        { label: "non-diagnostic boundary", pattern: /nonDiagnostic|diagnosticBoundary|notDiagnostic/ }
    ]);

    console.log("training depth smoke passed");
}

main();
