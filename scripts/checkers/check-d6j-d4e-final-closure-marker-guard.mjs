import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const files = {
  source: 'd6jD4PostRepairVerificationReadOnly.js',
  tests: 'tests/unit/d6j-d4-post-repair-verification-read-only.test.mjs',
  packageJson: 'package.json'
};

Object.values(files).forEach(file => {
  assert.equal(exists(file), true, `missing D6J-D4E file: ${file}`);
});

const source = read(files.source);
const tests = read(files.tests);
const packageJson = JSON.parse(read(files.packageJson));

for (const marker of [
  'setD6jD4DReconciliationApprovalMarkerState_',
  'assertD6jD4DPostHocClosureApprovalMarkerAbsent_',
  "result.D6J_D4D_RECONCILIATION_APPROVAL_MARKER_PRESENT = present ? 'YES' : 'NO'",
  "if (state === 'NO') return",
  'BLOCKED_D6J_D4D_RECONCILIATION_APPROVAL_MARKER_STILL_PRESENT',
  'BLOCKED_D6J_D4D_RECONCILIATION_APPROVAL_MARKER_STATE_UNKNOWN',
  "fire.FIRESTORE_EVIDENCE_MODE === 'POST_HOC_RECONCILIATION'",
  'PASS_RECONCILED',
  'CLOSED_WITH_RECONCILIATION',
  "PRODUCTION_MUTATION: 'NONE'"
]) {
  assert.equal(source.includes(marker), true, `source missing D6J-D4E marker: ${marker}`);
}

assert.match(
  source,
  /const properties = services\.readProperties\(\);\s*setD6jD4DReconciliationApprovalMarkerState_\(properties, result\);\s*assertD6jD4RepairMarkerAbsent_\(properties, result\);/,
  'final D6J-D4 runner must assign D4D marker state immediately after properties read'
);

assert.match(
  source,
  /if \(fire\.FIRESTORE_EVIDENCE_MODE === 'POST_HOC_RECONCILIATION'\) {\s*assertD6jD4DPostHocClosureApprovalMarkerAbsent_\(result\);\s*}/,
  'post-hoc closure must require explicit marker absence guard'
);

for (const forbidden of [
  '.setProperty(',
  '.deleteProperty(',
  'PropertiesService.getScriptProperties().setProperty',
  'PropertiesService.getScriptProperties().deleteProperty',
  '.setValue(',
  '.setValues(',
  '.appendRow(',
  '.insertRow(',
  '.deleteRow(',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  '--force'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden D6J-D4E source token: ${forbidden}`);
}

for (const marker of [
  'maps an absent D4D reconciliation approval marker to NO',
  'maps a non-empty D4D reconciliation approval marker to YES',
  'blocks post-hoc closure',
  'post-hoc closure guard blocks UNKNOWN marker state distinctly',
  'original-audit closure remains compatible',
  'entrypoint performs zero writes'
]) {
  assert.equal(tests.includes(marker), true, `tests missing D6J-D4E marker: ${marker}`);
}

assert.equal(
  packageJson.scripts['check:d6j-d4e-final-closure-marker-guard'],
  'node scripts/checkers/check-d6j-d4e-final-closure-marker-guard.mjs',
  'package command check:d6j-d4e-final-closure-marker-guard missing or changed'
);

console.log('D6J_D4E_FINAL_CLOSURE_MARKER_GUARD_CHECK=PASS');
