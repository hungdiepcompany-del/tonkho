import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const files = {
  source: 'd6jD4PostRepairVerificationReadOnly.js',
  test: 'tests/unit/d6j-d4-post-repair-verification-read-only.test.mjs',
  packageJson: 'package.json',
  phaseDoc: 'docs/phases/D6J_D4D_DURABLE_JOB_PATH_FIX_AND_POST_HOC_RECONCILIATION_EVIDENCE.md',
  evidenceDoc: 'docs/evidence/D6J_D4D_DURABLE_JOB_PATH_FIX_AND_POST_HOC_RECONCILIATION_EVIDENCE_EVIDENCE.md'
};

Object.values(files).forEach(file => {
  assert.equal(exists(file), true, `missing D6J-D4D file: ${file}`);
});

const source = read(files.source);
const tests = read(files.test);
const docs = read(files.phaseDoc) + '\n' + read(files.evidenceDoc);
const packageJson = JSON.parse(read(files.packageJson));

for (const marker of [
  'runD6jD4DReconciliationPreviewReadOnly',
  'runD6jD4DRecordPostHocReconciliationEvidenceOnce',
  'createD6jD4DReconciliationPreviewReadOnlyRunner_',
  'createD6jD4DRecordPostHocReconciliationEvidenceRunner_',
  'D6J_D4D_DURABLE_JOB_PATH_FIX_AND_POST_HOC_RECONCILIATION_EVIDENCE_V1',
  "D6J_D4D_RECONCILIATION_APPROVAL_PROPERTY_ = 'D6J_D4D_RECONCILIATION_APPROVAL_MARKER'",
  "D6J_D4D_RECONCILIATION_APPROVAL_ = 'OWNER_APPROVED_D6J_D4D_POST_HOC_RECONCILIATION_EVIDENCE'",
  "D6J_D4D_EVENT_TYPE_ = 'D6J_D_POST_HOC_RECONCILIATION_EVIDENCE'",
  "D6J_D4D_EVENT_ID_PREFIX_ = 'd6j_d4d_reconciliation_'",
  'durableJobPath',
  'durableJobEventsPath',
  'workerLeasePath',
  'buildD6jD4DDeterministicEventId_',
  'buildD6jD4DExpectedPostHocEvent_',
  'isD6jD4DPostHocEventExactMatch_',
  'POST_HOC_RECONCILIATION',
  'RECONCILIATION_PENDING_POST_HOC',
  'PASS_READY_FOR_EXPLICIT_APPROVAL',
  'PASS_POST_HOC_RECONCILIATION_EVIDENCE_CREATED',
  'PASS_IDEMPOTENT_EXISTING_EXACT_MATCH',
  'BLOCKED_D6J_D4D_RECONCILIATION_EVENT_CONFLICT',
  'BLOCKED_INVALID_D6J_D4D_RECONCILIATION_APPROVAL_MARKER',
  'ONE_DETERMINISTIC_FIRESTORE_RECONCILIATION_EVENT_ONLY',
  'CURRENT_ENTRYPOINT_EXECUTED',
  'CLOSED_WITH_RECONCILIATION',
  'PASS_RECONCILED',
  'tx.createDocument',
  'createTransport: d.createTransport || createD6jCFirestoreDurableTransport_',
  'createLock: d.createLock || (() => LockService.getScriptLock())'
]) {
  assert.equal(source.includes(marker), true, `source missing D6J-D4D marker: ${marker}`);
}

for (const forbidden of [
  '.setValue(',
  '.setValues(',
  '.appendRow(',
  '.insertRow(',
  '.deleteRow(',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  '.setProperty(',
  '.deleteProperty(',
  'tx.updateDocument(',
  'tx.appendDocument(',
  "method: 'patch'",
  "method: 'delete'",
  '--force'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden D6J-D4D source token: ${forbidden}`);
}

for (const marker of [
  'D6J-D4D preview uses invoiceJobs and worker_leases with GET/LIST only and plans one event create',
  'D6J-D4D mutation blocks without the exact approval marker',
  'D6J-D4D mutation creates exactly one deterministic post-hoc event and releases the lock',
  'D6J-D4D mutation is a zero-write idempotent pass for an existing exact deterministic event',
  'D6J-D4D mutation blocks on a conflicting deterministic event without updating it',
  'D6J-D4 closes with PASS_RECONCILED when the exact post-hoc reconciliation event exists'
]) {
  assert.equal(tests.includes(marker), true, `tests missing D6J-D4D marker: ${marker}`);
}

for (const marker of [
  'PHASE=D6J_D4D_DURABLE_JOB_PATH_FIX_AND_POST_HOC_RECONCILIATION_EVIDENCE',
  'DURABLE_JOB_PATH_FIX=PASS',
  'ORIGINAL_AUDIT_TRUTH_PRESERVED=PASS',
  'READ_ONLY_RECONCILIATION_PREVIEW=PASS',
  'CONTROLLED_POST_HOC_EVENT_CHANNEL=PASS',
  'DETERMINISTIC_EVENT_IDEMPOTENCY=PASS',
  'D6J_D4_RECONCILED_CLOSURE_SEMANTICS=PASS',
  'CURRENT_ENTRYPOINT_EXECUTION_SEMANTICS=PASS',
  'READ_ONLY_SAFETY=PASS',
  'D6J_D4D_PREVIEW_ENTRYPOINT_EXECUTED=NO',
  'D6J_D4D_MUTATION_ENTRYPOINT_EXECUTED=NO',
  'D6J_D4_ENTRYPOINT_EXECUTED=NO',
  'D6J_D4C_ENTRYPOINT_EXECUTED_DURING_IMPLEMENTATION=NO',
  'REPAIR_FUNCTION_EXECUTED=NO',
  'D6J_C_FUNCTION_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'OWNER_RUN_D6J_D4D_RECONCILIATION_PREVIEW_READ_ONLY_ONCE'
]) {
  assert.equal(docs.includes(marker), true, `docs missing D6J-D4D marker: ${marker}`);
}

assert.equal(
  packageJson.scripts['check:d6j-d4d-durable-job-path-post-hoc-reconciliation'],
  'node scripts/checkers/check-d6j-d4d-durable-job-path-post-hoc-reconciliation.mjs',
  'package command check:d6j-d4d-durable-job-path-post-hoc-reconciliation missing or changed'
);

console.log('D6J_D4D_DURABLE_JOB_PATH_POST_HOC_RECONCILIATION_CHECK=PASS');
