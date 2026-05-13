const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.join(ROOT, "report.js");
const DAILY_PLAN_PATH = path.join(ROOT, "daily-plan.js");

function readText(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

function checkPattern(source, pattern, label, issues) {
    if (!pattern.test(source)) {
        issues.push(label);
    }
}

function checkReport(reportSource) {
    const issues = [];

    [
        [/ssdStaircaseQuality/, "report consumes ssdStaircaseQuality"],
        [/staircaseQualityLabel/, "report consumes staircaseQualityLabel"],
        [/goWaitingFlag/, "report consumes goWaitingFlag"],
        [/adaptationVolatility/, "report consumes adaptationVolatility"],
        [/spanStability/, "report consumes spanStability"],
        [/modeTransitionReadiness/, "report consumes modeTransitionReadiness"],
        [/vocabularyRiskCount/, "report consumes vocabularyRiskCount"],
        [/nextPracticeRecommendation/, "report consumes nextPracticeRecommendation"]
    ].forEach(([pattern, label]) => checkPattern(reportSource, pattern, label, issues));

    return issues;
}

function checkDailyPlan(dailyPlanSource) {
    const issues = [];

    [
        [/getAllSessions\s*\(/, "daily-plan reads latest session source"],
        [/TrainingResults/, "daily-plan references TrainingResults"],
        [/Stop Signal|stop-signal|stop signal/i, "daily-plan includes Stop Signal candidate"],
        [/nextPracticeRecommendation/, "daily-plan consumes nextPracticeRecommendation"],
        [/nextPrescriptionReason/, "daily-plan consumes nextPrescriptionReason"],
        [/adaptationVolatility/, "daily-plan consumes adaptationVolatility"],
        [/modeTransitionReadiness/, "daily-plan consumes modeTransitionReadiness"],
        [/(?:dynamic|prompt|hint)[\s\S]{0,120}(?:field|fields|function|text)/i, "daily-plan exposes dynamic prompt or hint logic"]
    ].forEach(([pattern, label]) => checkPattern(dailyPlanSource, pattern, label, issues));

    return issues;
}

function printResult(name, issues) {
    if (issues.length === 0) {
        console.log(`[PASS] ${name}`);
        return true;
    }

    console.log(`[FAIL] ${name}`);
    for (const issue of issues) {
        console.log(`  - ${issue}`);
    }
    return false;
}

function main() {
    let reportSource;
    let dailyPlanSource;
    const failures = [];

    try {
        reportSource = readText(REPORT_PATH);
    } catch (error) {
        failures.push(`unable to read report.js: ${error.message}`);
    }

    try {
        dailyPlanSource = readText(DAILY_PLAN_PATH);
    } catch (error) {
        failures.push(`unable to read daily-plan.js: ${error.message}`);
    }

    if (failures.length > 0) {
        console.log("[FAIL] smoke-feedback-signals");
        for (const failure of failures) {
            console.log(`  - ${failure}`);
        }
        process.exitCode = 1;
        return;
    }

    const reportIssues = checkReport(reportSource);
    const dailyPlanIssues = checkDailyPlan(dailyPlanSource);

    const reportPassed = printResult("report feedback signal checks", reportIssues);
    const dailyPlanPassed = printResult("daily-plan feedback signal checks", dailyPlanIssues);

    if (reportPassed && dailyPlanPassed) {
        console.log("Summary: 2 passed, 0 failed");
        return;
    }

    const passed = [reportPassed, dailyPlanPassed].filter(Boolean).length;
    const failed = 2 - passed;
    console.log(`Summary: ${passed} passed, ${failed} failed`);
    process.exitCode = 1;
}

main();
