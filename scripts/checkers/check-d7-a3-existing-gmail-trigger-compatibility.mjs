import fs from 'node:fs';
import path from 'node:path';
import { analyzeD7A3ExistingGmailTriggerCompatibility } from '../analysis/d7-a3-existing-gmail-trigger-compatibility.mjs';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function fail(code) {
  console.error('D7_A3_EXISTING_GMAIL_TRIGGER_COMPATIBILITY_CHECK=FAIL');
  console.error(`FAILED_GATE=${code}`);
  process.exit(1);
}

function assertIncludes(text, pattern, code) {
  if (typeof pattern === 'string') {
    if (!text.includes(pattern)) fail(code);
  } else if (!pattern.test(text)) {
    fail(code);
  }
}

const analyzerPath = 'scripts/analysis/d7-a3-existing-gmail-trigger-compatibility.mjs';
const testPath = 'tests/unit/d7-a3-existing-gmail-trigger-compatibility.test.mjs';
const d7AuditPath = 'D7_OperationalReadinessAudit.js';
const checkerPath = 'scripts/checkers/check-d7-a3-existing-gmail-trigger-compatibility.mjs';
const packageJson = JSON.parse(read('package.json'));

const analyzer = read(analyzerPath);
const tests = read(testPath);
const d7Audit = read(d7AuditPath);
const triggerSource = read('_triggerMarkInvoiceEmails.js');
const labels = read('gmailLabels.js');
const security = read('sercurity.js');
const parser = read('Invoice_AttachmentParser.js');

assertIncludes(analyzer, 'analyzeD7A3ExistingGmailTriggerCompatibility', 'ANALYZER_EXPORT_MISSING');
assertIncludes(analyzer, 'decideD7A3OwnerDecision', 'DECISION_EXPORT_MISSING');
assertIncludes(analyzer, 'triggerMarkAllInvoiceEmails', 'TRIGGER_HANDLER_NOT_ANALYZED');
assertIncludes(analyzer, 'MUTATING_GMAIL_TRIGGER', 'MUTATING_GMAIL_TRIGGER_CLASSIFICATION_MISSING');
assertIncludes(analyzer, 'GMAIL_LABEL_CREATION_REACHABLE', 'LABEL_CREATION_FIELD_MISSING');
assertIncludes(analyzer, 'GMAIL_LABEL_ASSIGNMENT_REACHABLE', 'LABEL_ASSIGNMENT_FIELD_MISSING');
assertIncludes(analyzer, 'GMAIL_IMPORTANT_MUTATION_REACHABLE', 'IMPORTANT_FIELD_MISSING');
assertIncludes(analyzer, 'GMAIL_STAR_MUTATION_REACHABLE', 'STAR_FIELD_MISSING');
assertIncludes(analyzer, 'D7_B_CANDIDATE_DISCOVERY_INTERFERENCE_RISK', 'INTERFERENCE_RISK_FIELD_MISSING');
assertIncludes(analyzer, 'D7_FUTURE_AUTOMATION_CONCURRENCY_RISK', 'CONCURRENCY_RISK_FIELD_MISSING');
assertIncludes(analyzer, 'OWNER_DISABLE_TRIGGER_BEFORE_D7_B', 'OWNER_DECISION_NOT_DOCUMENTED_IN_ANALYZER');
assertIncludes(analyzer, 'NO_PENDING_OWNER_TRIGGER_DECISION', 'D7_B_BLOCK_FIELD_MISSING');
assertIncludes(analyzer, "TRIGGER_EXECUTED: 'NO'", 'TRIGGER_EXECUTION_BOUNDARY_MISSING');
assertIncludes(analyzer, "CANDIDATE_DISCOVERY_EXECUTED: 'NO'", 'CANDIDATE_DISCOVERY_BOUNDARY_MISSING');
assertIncludes(analyzer, "PRODUCTION_MUTATION: 'NONE'", 'PRODUCTION_MUTATION_BOUNDARY_MISSING');
assertIncludes(analyzer, 'PRODUCTION_MUTATION_REACHABILITY_COUNT: 0', 'PRODUCTION_REACHABILITY_COUNTER_MISSING');

assertIncludes(triggerSource, 'outLabel.addToThread(thread)', 'TRIGGER_LABEL_ASSIGNMENT_SOURCE_NOT_FOUND');
assertIncludes(triggerSource, 'thread.markImportant()', 'TRIGGER_IMPORTANT_SOURCE_NOT_FOUND');
assertIncludes(triggerSource, 'm.star()', 'TRIGGER_STAR_SOURCE_NOT_FOUND');
assertIncludes(labels, 'GmailApp.createLabel', 'TRIGGER_LABEL_CREATION_HELPER_NOT_FOUND');
assertIncludes(security, 'LockService.getScriptLock', 'TRIGGER_LOCK_GUARD_NOT_FOUND');
assertIncludes(security, 'LAST_TRIGGER_RUN', 'TRIGGER_REPLAY_PROPERTY_NOT_FOUND');
assertIncludes(parser, 'Drive.Files.insert', 'PDF_OCR_DRIVE_CREATE_REACHABILITY_NOT_FOUND');
assertIncludes(parser, 'setTrashed', 'PDF_OCR_DRIVE_CLEANUP_REACHABILITY_NOT_FOUND');

assertIncludes(d7Audit, 'createD7ACompactSummary_', 'D7_A_COMPACT_SUMMARY_MISSING');
assertIncludes(d7Audit, 'D7_A_COMPACT_READINESS_SUMMARY', 'D7_A_COMPACT_LOG_MARKER_MISSING');
assertIncludes(d7Audit, 'EXISTING_NON_D7_TRIGGER_COUNT', 'COMPACT_NON_D7_TRIGGER_COUNT_MISSING');
assertIncludes(d7Audit, 'EXISTING_MUTATING_TRIGGER_COUNT', 'COMPACT_MUTATING_TRIGGER_COUNT_MISSING');
assertIncludes(d7Audit, 'TRIGGER_OWNER_REVIEW_REQUIRED', 'COMPACT_OWNER_REVIEW_MISSING');
assertIncludes(d7Audit, 'PRODUCTION_MUTATION', 'COMPACT_PRODUCTION_MUTATION_MISSING');

const forbiddenAnalyzerCalls = [
  /ScriptApp\.(?:newTrigger|deleteTrigger|run)\s*\(/,
  /runD7AOperationalAutomationReadinessReadOnly\s*\(/,
  /triggerMarkAllInvoiceEmails\s*\(/,
  /runD6jCOneRecordProductionMutation\s*\(/,
  /runD6jDRepairSingleMalformedPilotRow\s*\(/,
  /GmailApp\.[A-Za-z_]+\s*\(/,
  /DriveApp\.[A-Za-z_]+\s*\(/,
  /SpreadsheetApp\.[A-Za-z_]+\s*\(/,
  /UrlFetchApp\.fetch\s*\(/,
];
for (const pattern of forbiddenAnalyzerCalls) {
  if (pattern.test(analyzer)) fail('ANALYZER_CONTAINS_FORBIDDEN_RUNTIME_CALL');
}

const report = analyzeD7A3ExistingGmailTriggerCompatibility({ rootDir: root });
if (report.EXISTING_TRIGGER_CLASSIFICATION !== 'MUTATING_GMAIL_TRIGGER') fail('REPORT_TRIGGER_CLASSIFICATION_NOT_MUTATING');
if (report.GMAIL_LABEL_CREATION_REACHABLE !== 'YES') fail('REPORT_LABEL_CREATION_NOT_REACHABLE');
if (report.GMAIL_LABEL_ASSIGNMENT_REACHABLE !== 'YES') fail('REPORT_LABEL_ASSIGNMENT_NOT_REACHABLE');
if (report.GMAIL_IMPORTANT_MUTATION_REACHABLE !== 'YES') fail('REPORT_IMPORTANT_NOT_REACHABLE');
if (report.GMAIL_STAR_MUTATION_REACHABLE !== 'YES') fail('REPORT_STAR_NOT_REACHABLE');
if (report.DRIVE_MUTATION_REACHABLE !== 'YES') fail('REPORT_DRIVE_MUTATION_NOT_REACHABLE');
if (report.SHEET_MUTATION_REACHABLE !== 'NO') fail('REPORT_SHEET_MUTATION_NOT_BLOCKED');
if (report.FIRESTORE_MUTATION_REACHABLE !== 'NO') fail('REPORT_FIRESTORE_MUTATION_NOT_BLOCKED');
if (report.D7_B_CANDIDATE_DISCOVERY_INTERFERENCE_RISK !== 'HIGH') fail('REPORT_INTERFERENCE_RISK_NOT_HIGH');
if (report.D7_FUTURE_AUTOMATION_CONCURRENCY_RISK !== 'HIGH') fail('REPORT_CONCURRENCY_RISK_NOT_HIGH');
if (report.RECOMMENDED_OWNER_DECISION !== 'OWNER_DISABLE_TRIGGER_BEFORE_D7_B') fail('REPORT_RECOMMENDED_DECISION_UNEXPECTED');
if (report.READY_FOR_D7_B !== 'NO_PENDING_OWNER_TRIGGER_DECISION') fail('REPORT_D7_B_NOT_BLOCKED');
if (report.TRIGGER_EXECUTED !== 'NO' || report.TRIGGER_MUTATION_COUNT !== 0) fail('REPORT_TRIGGER_EXECUTION_BOUNDARY_FAILED');
if (report.CANDIDATE_DISCOVERY_EXECUTED !== 'NO' || report.PRODUCTION_MUTATION !== 'NONE') fail('REPORT_PRODUCTION_BOUNDARY_FAILED');

for (const marker of [
  'classifies Gmail label creation and assignment as mutation',
  'markImportant and star as Gmail mutations',
  'UNKNOWN and HIGH interference block continuation',
  'coexistence requires all explicit safety proofs',
  'executes no Apps Script, Gmail, Drive, Sheet, Firestore, trigger, or candidate mutation',
  'compact log summary is emitted before detailed data',
]) {
  assertIncludes(tests, marker, `TEST_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const doc of [
  'docs/architecture/D7_A3_EXISTING_GMAIL_TRIGGER_COMPATIBILITY_ANALYSIS.md',
  'docs/operations/D7_A3_OWNER_TRIGGER_DECISION_OPTIONS.md',
  'docs/evidence/D7_A3_EXISTING_GMAIL_TRIGGER_COMPATIBILITY_EVIDENCE.md',
]) {
  const text = read(doc);
  assertIncludes(text, 'D7_A3_EXISTING_GMAIL_TRIGGER_COMPATIBILITY_AND_OWNER_DECISION_GATE', `DOC_PHASE_MISSING_${doc}`);
  assertIncludes(text, 'OWNER_DISABLE_TRIGGER_BEFORE_D7_B', `DOC_OWNER_DECISION_MISSING_${doc}`);
  assertIncludes(text, 'PRODUCTION_MUTATION=NONE', `DOC_PRODUCTION_BOUNDARY_MISSING_${doc}`);
}

if (packageJson.scripts['check:d7-a3-existing-gmail-trigger-compatibility'] !== `node ${checkerPath}`) {
  fail('PACKAGE_COMMAND_MISSING');
}

console.log('D7_A3_EXISTING_GMAIL_TRIGGER_COMPATIBILITY_CHECK=PASS');
