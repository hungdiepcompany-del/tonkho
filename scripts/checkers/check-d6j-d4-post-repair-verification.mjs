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
  'BLOCKED_D6J_D4_REPAIR_APPROVAL_MARKER_STILL_PRESENT',
  'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND',
  'BLOCKED_D6J_D4_PREFLIGHT_WOULD_INSERT_EXISTING_CANONICAL_ROW',
  'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_UNIQUE',
  'BLOCKED_D6J_D4_TARGET_ROW_NUMBER_CHANGED',
  'BLOCKED_D6J_D4_DUPLICATE_ROW_FOUND',
  'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_MISSING',
  'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_NOT_UNIQUE',
  'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_INVALID',
  'inspectD6jD4CanonicalSheetState_',
  'inspectD6jD4FirestoreAudit_',
  'inspectD6jD4DriveArtifactsReadOnly_',
  'inspectD6jD4GmailArtifactsReadOnly_',
  'inspectD6jD4Triggers_',
  'normalizeD6jD4ExactText_',
  'evaluateD6jD4RowFieldMatches_',
  'TARGET_ROW_FIELD_MATCHES',
  'NEAR_CANONICAL_CANDIDATES',
  'SHEET_VERIFICATION_STATUS',
  'FIRESTORE_VERIFICATION_STATUS',
  'DRIVE_VERIFICATION_STATUS',
  'GMAIL_VERIFICATION_STATUS',
  'TRIGGER_VERIFICATION_STATUS',
  'SHEETS_DUPLICATE_STATUS',
  'EXISTING_CANONICAL_MATCH',
  'SHEETS_MUTATION_COUNT',
  'DRIVE_MUTATION_COUNT',
  'GMAIL_MUTATION_COUNT',
  'FIRESTORE_MUTATION_COUNT',
  'TRIGGER_MUTATION_COUNT',
  'DESTRUCTIVE_OPERATION_COUNT',
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
  'zero canonical rows block',
  'multiple canonical rows block',
  'canonical row at another row number blocks',
  'C mismatch blocks',
  'D mismatch blocks',
  'D mismatch returns sanitized field-level diagnostics',
  'F mismatch returns sanitized field-level diagnostics',
  'D6J-D4 blocks if preflight still plans inserting the existing canonical row',
  'UTF-8 integrity checker detects prior mojibake and passes clean escaped source',
  'J numeric mismatch blocks',
  'K numeric mismatch blocks',
  'L numeric mismatch blocks',
  'M numeric mismatch blocks',
  'N mismatch blocks',
  'O mismatch blocks',
  'A mismatch blocks',
  'B not a Date object blocks',
  'B canonical date mismatch blocks',
  'B number format mismatch blocks',
  'E mismatch blocks',
  'F mismatch blocks',
  'G mismatch blocks',
  'H mismatch blocks',
  'I mismatch blocks',
  'missing P formula blocks',
  'wrong P row reference blocks',
  'duplicate InvoiceKey blocks',
  'duplicate HashIndex blocks',
  'duplicate business identity blocks',
  'missing Firestore audit returns reconciliation required',
  'multiple Firestore repair audits return reconciliation required',
  'wrong changedColumns returns reconciliation required',
  'missing beforeHash returns reconciliation required',
  'missing afterHash returns reconciliation required',
  'original job not completed blocks closure',
  'Drive artifact hash mismatch blocks',
  'Gmail artifact hash mismatch blocks',
  'repair approval marker present blocks',
  'unexpected D6J trigger blocks',
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
  'FIRESTORE_REPAIR_AUDIT_VERIFICATION=PASS',
  'DRIVE_ARTIFACT_VERIFICATION=PASS',
  'GMAIL_ARTIFACT_VERIFICATION=PASS',
  'REPAIR_MARKER_ABSENCE_CHECK=PASS',
  'D6J_TRIGGER_CHECK=PASS',
  'D6J_D4_ENTRYPOINT_EXECUTED=NO',
  'REPAIR_FUNCTION_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'NEXT_ACTION=OWNER_RUN_D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_ONCE'
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
