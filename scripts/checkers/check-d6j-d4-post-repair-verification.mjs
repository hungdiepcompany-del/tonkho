import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const sourcePath = 'd6jD4PostRepairVerificationReadOnly.js';
const testPath = 'tests/unit/d6j-d4-post-repair-verification-read-only.test.mjs';
const phaseDocPath = 'docs/phases/D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE.md';
const evidenceDocPath = 'docs/evidence/D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE_EVIDENCE.md';

for (const file of [sourcePath, testPath, phaseDocPath, evidenceDocPath]) {
  assert.equal(exists(file), true, `missing D6J-D4 file: ${file}`);
}

const source = read(sourcePath);
const tests = read(testPath);
const docs = read(phaseDocPath) + '\n' + read(evidenceDocPath);
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'runD6jD4PostRepairVerificationReadOnly',
  'createD6jD4PostRepairVerificationReadOnlyRunner_',
  'D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE_V1',
  'inspectD6jD4CanonicalSheetState_',
  'inspectD6jD4FirestoreEvidence_',
  'inspectD6jD4DriveArtifactsReadOnly_',
  'inspectD6jD4GmailArtifactsReadOnly_',
  'inspectD6jD4Triggers_',
  'durableJobPath',
  'durableJobEventsPath',
  'workerLeasePath',
  'PASS_RECONCILED',
  'CLOSED_WITH_RECONCILIATION',
  'POST_HOC_RECONCILIATION',
  'CURRENT_ENTRYPOINT_EXECUTED',
  'PROHIBITED_D6J_D4_ENTRYPOINT_EXECUTED',
  'BLOCKED_D6J_D4_DURABLE_JOB_NOT_COMPLETED',
  'RECONCILIATION_REQUIRED_D6J_D4_DURABLE_JOB_NOT_FOUND',
  'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_MISSING',
  'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_NOT_UNIQUE',
  'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_INVALID',
  'LEGACY_JOB_PATH_USED_FOR_D6J_D4_CLOSURE',
  'VERIFIED_CURRENT_ROW_HASH',
  "PRODUCTION_MUTATION: 'NONE'"
]) {
  assert.equal(source.includes(marker), true, `source missing D6J-D4 marker: ${marker}`);
}

for (const forbiddenCall of [
  'runD6jDRepairSingleMalformedPilotRow(',
  'runD6jCOneRecordProductionMutation(',
  'runD6jDInspectMalformedPilotRowReadOnly(',
  '.setValue(',
  '.setValues(',
  '.setFormula(',
  '.setFormulaR1C1(',
  '.appendRow(',
  '.insertRow(',
  '.deleteRow(',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  '.setTrashed(',
  '.createFile(',
  '.makeCopy(',
  '.moveTo(',
  'GmailApp.move',
  'GmailApp.mark',
  'GmailApp.send',
  'PropertiesService.getScriptProperties().setProperty',
  'PropertiesService.getScriptProperties().deleteProperty',
  '--force'
]) {
  assert.equal(source.includes(forbiddenCall), false, `forbidden D6J-D4 source token: ${forbiddenCall}`);
}

for (const testMarker of [
  'exact canonical row 1337 passes',
  'D6J-D4 closes with PASS_RECONCILED when the exact post-hoc reconciliation event exists',
  'D6J-D4D preview uses invoiceJobs and worker_leases with GET/LIST only and plans one event create',
  'D6J-D4D mutation creates exactly one deterministic post-hoc event and releases the lock',
  'D6J-D4D mutation is a zero-write idempotent pass for an existing exact deterministic event',
  'D6J-D4D mutation blocks on a conflicting deterministic event without updating it',
  'missing Firestore audit returns reconciliation required',
  'entrypoint performs zero writes'
]) {
  assert.equal(tests.includes(testMarker), true, `tests missing D6J-D4 marker: ${testMarker}`);
}

for (const docMarker of [
  'PHASE=D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE',
  'SOURCE_IMPLEMENTATION=PASS',
  'READ_ONLY_SAFETY=PASS',
  'CANONICAL_ROW_VERIFICATION=PASS',
  'PRESERVED_CELL_VERIFICATION=PASS',
  'DUPLICATE_DETECTION=PASS',
  'DRIVE_ARTIFACT_VERIFICATION=PASS',
  'GMAIL_ARTIFACT_VERIFICATION=PASS',
  'REPAIR_MARKER_ABSENCE_CHECK=PASS',
  'D6J_TRIGGER_CHECK=PASS',
  'D6J_D4_ENTRYPOINT_EXECUTED=NO',
  'REPAIR_FUNCTION_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE'
]) {
  assert.equal(docs.includes(docMarker), true, `docs missing D6J-D4 marker: ${docMarker}`);
}

assert.equal(
  packageJson.scripts['check:d6j-d4-post-repair-verification'],
  'node scripts/checkers/check-d6j-d4-post-repair-verification.mjs',
  'package command check:d6j-d4-post-repair-verification missing or changed'
);
assert.equal(
  packageJson.scripts['check:d6j-d4-utf8-canonical-integrity'],
  'node scripts/checkers/check-d6j-d4-utf8-canonical-integrity.mjs',
  'package command check:d6j-d4-utf8-canonical-integrity missing or changed'
);

console.log('D6J_D4_POST_REPAIR_VERIFICATION_CHECK=PASS');
