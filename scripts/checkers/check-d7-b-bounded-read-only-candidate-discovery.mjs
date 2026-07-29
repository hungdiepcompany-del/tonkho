import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function fail(code) {
  console.error('D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY_CHECK=FAIL');
  console.error(`FAILED_GATE=${code}`);
  process.exit(1);
}

function assertIncludes(text, needle, code) {
  if (!text.includes(needle)) fail(code);
}

function countFunctionDeclarations(text, name) {
  const withoutComments = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const re = new RegExp(`\\bfunction\\s+${name}\\s*\\(`, 'g');
  return [...withoutComments.matchAll(re)].length;
}

const runtimePath = 'D7_B_BoundedReadOnlyCandidateDiscovery.js';
const entrypointsPath = 'Operator_Entrypoints.js';
const testPath = 'tests/unit/d7-b-bounded-read-only-candidate-discovery.test.mjs';
const phaseDocPath = 'docs/phases/D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY.md';
const architectureDocPath = 'docs/architecture/D7_B_CANDIDATE_IDENTITY_AND_DUPLICATE_CHECK_MODEL.md';
const operationsDocPath = 'docs/operations/D7_B_OWNER_EXECUTION_AND_RESULT_INTERPRETATION.md';
const evidenceDocPath = 'docs/evidence/D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY_EVIDENCE.md';

const runtime = read(runtimePath);
const entrypoints = read(entrypointsPath);
const tests = read(testPath);
const packageJson = JSON.parse(read('package.json'));

if (countFunctionDeclarations(entrypoints, 'runD7BBoundedReadOnlyCandidateDiscovery') !== 1) {
  fail('PUBLIC_ENTRYPOINT_DECLARATION_COUNT_NOT_ONE');
}
assertIncludes(entrypoints, 'function runD7BBoundedReadOnlyCandidateDiscovery() {\n  const runner = createD7BBoundedReadOnlyCandidateDiscoveryRunner_();\n  return runner.run();\n}', 'PUBLIC_ENTRYPOINT_BODY_NOT_EXACT');
if (countFunctionDeclarations(runtime, 'createD7BBoundedReadOnlyCandidateDiscoveryRunner_') !== 1) {
  fail('RUNNER_FACTORY_DECLARATION_COUNT_NOT_ONE');
}

for (const marker of [
  'D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY_V1',
  'D7_B_CANDIDATE_FINGERPRINT_V1',
  'D7_B_COMPACT_SUMMARY',
  'D7_B_DETAILED_SANITIZED_RESULT',
  'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW',
  'PASS_NO_ELIGIBLE_CANDIDATE',
  'BLOCKED_MULTIPLE_ELIGIBLE_CANDIDATES',
  'BLOCKED_GMAIL_READ_FAILURE',
  'BLOCKED_ATTACHMENT_VALIDATION_FAILURE',
  'BLOCKED_EXACT_DUPLICATE',
  'BLOCKED_CONFLICTING_DUPLICATE',
  'BLOCKED_DUPLICATE_READ_FAILURE',
  'BLOCKED_RUNTIME_SAFETY_RECHECK',
  'D7_C_APPROVAL_READY',
  'MUTATION_ATTEMPT_COUNT',
  "PRODUCTION_WRITE = 'NONE'",
  'GMAIL_QUERY_DATE_WINDOW_DEFINED',
  'GMAIL_QUERY_MAX_RESULT_COUNT',
  'GMAIL_QUERY_POLICY_HASH',
  'validateD7BFirestoreDocumentPath_',
]) {
  assertIncludes(runtime, marker, `RUNTIME_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}

for (const forbidden of [
  'GmailApp.createLabel',
  'addToThread(',
  'markImportant(',
  'star(',
  'markRead(',
  'markUnread(',
  'Drive.Files.insert',
  'DriveApp.createFile',
  'setTrashed(',
  'appendRow(',
  'setValue(',
  'setValues(',
  'PropertiesService.getScriptProperties().setProperty',
  'PropertiesService.getScriptProperties().deleteProperty',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  'FirestoreApp.write',
]) {
  if (runtime.includes(forbidden) || entrypoints.includes(forbidden)) {
    fail(`FORBIDDEN_MUTATION_REACHABILITY_${forbidden.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
  }
}

for (const forbiddenEntrypoint of [
  'triggerMarkAllInvoiceEmails(',
  'runD6jCOneRecordProductionMutation(',
  'runD6jDRepairSingleMalformedPilotRow(',
  'scanInvoiceOutEmails_(',
  'scanInvoiceInEmails_(',
  'triggerScanInvoiceDriveFolder(',
]) {
  if (runtime.includes(forbiddenEntrypoint)) fail('FORBIDDEN_PRODUCTION_ENTRYPOINT_CALL');
}

if (!/UrlFetchApp\.fetch\(url,\s*\{[\s\S]*?method:\s*'get'[\s\S]*?muteHttpExceptions:\s*true[\s\S]*?\}\)/.test(runtime)) {
  fail('FIRESTORE_READ_ONLY_FETCH_CONTRACT_MISSING');
}
if (/method:\s*['"`](post|put|patch|delete)['"`]/i.test(runtime)) {
  fail('FIRESTORE_WRITE_METHOD_PRESENT');
}

for (const marker of [
  'D7-B builds a bounded sender, subject, date-window Gmail query',
  'D7-B approved path is read-only and ready for D7-C',
  'D7-B blocks before Gmail when runtime safety or config is unsafe',
  'D7-B classifies Gmail, attachment, cardinality, fingerprint, and duplicate outcomes',
  'D7-B helper contracts cover sanitized output, hash stability, and Firestore path policy',
  'D7-B scenario matrix documents forty required read-only cases',
]) {
  assertIncludes(tests, marker, `TEST_MARKER_MISSING_${marker.replace(/[^A-Z0-9]+/gi, '_').toUpperCase()}`);
}
assertIncludes(tests, 'assert.equal(scenarioNames.length, 40)', 'FORTY_CASE_MATRIX_NOT_ASSERTED');

for (const doc of [phaseDocPath, architectureDocPath, operationsDocPath, evidenceDocPath]) {
  const text = read(doc);
  assertIncludes(text, 'PHASE=D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY', `DOC_PHASE_MISSING_${doc}`);
  assertIncludes(text, 'READ_ONLY_MODE=YES', `DOC_READ_ONLY_MISSING_${doc}`);
  assertIncludes(text, 'PRODUCTION_MUTATION=NONE', `DOC_PRODUCTION_BOUNDARY_MISSING_${doc}`);
  assertIncludes(text, 'D7_C_APPROVAL_READY', `DOC_D7C_READY_MISSING_${doc}`);
}

if (packageJson.scripts['check:d7-b-bounded-read-only-candidate-discovery'] !== `node ${runtimePath.replace('D7_B_BoundedReadOnlyCandidateDiscovery.js', 'scripts/checkers/check-d7-b-bounded-read-only-candidate-discovery.mjs')}`) {
  fail('PACKAGE_COMMAND_MISSING');
}

console.log('D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY_CHECK=PASS');
