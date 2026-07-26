import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const runnerPath = 'd6jCOneRecordProductionMutation.js';
const testPath = 'tests/unit/d6j-c-one-record-production-mutation.test.mjs';
const phaseDocPath = 'docs/phases/D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL.md';
const evidenceDocPath = 'docs/evidence/D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_EVIDENCE.md';

for (const file of [runnerPath, testPath, phaseDocPath, evidenceDocPath]) {
  assert.equal(exists(file), true, `missing D6J-C file: ${file}`);
}

const runner = read(runnerPath);
const tests = read(testPath);
const phaseDoc = read(phaseDocPath);
const evidenceDoc = read(evidenceDocPath);
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'runD6jCOneRecordProductionMutation',
  'D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_V1',
  'OWNER_APPROVED_D6J_C_ONE_RECORD_PRODUCTION_MUTATION',
  'D6J_C_MUTATION_APPROVAL_MARKER',
  'createD6jBProductionDryRunReadOnlyRunner_().run()',
  'assertD6jCPreflightPass_',
  'createDurableInvoiceJobStore',
  'createSgdsDriveMutationAdapter_',
  'createSgdsSheetsLedgerMutationAdapter_',
  'createFirestoreValueCodec_',
  'ScriptApp.getOAuthToken()',
  'UrlFetchApp.fetch(url, params)',
  'createJobIfAbsent',
  'saveCommitPlanIfAbsent',
  'appendAuditEvent',
  'createFileIfAbsent',
  'appendImmutableTransactionsIfAbsent',
  'saveReconciliationReport',
  'markReconciliationRequired',
  'transitionJob',
  'GMAIL_MUTATION_COUNT = 0',
  'TRIGGER_MUTATION_COUNT = 0',
  'DESTRUCTIVE_OPERATION_COUNT = 0'
]) {
  assert.equal(runner.includes(marker), true, `runner missing marker: ${marker}`);
}

for (const marker of [
  'missing owner marker blocks before mutation',
  'invalid marker blocks',
  'failed D6J-B preflight blocks',
  'existing active lease blocks',
  'first successful run creates exactly two Drive files',
  'second identical run creates zero Drive files',
  'existing Drive hash conflict blocks',
  'existing Sheet identity conflict blocks',
  'failure after first Drive file creates reconciliation-required state',
  'failure after both Drive files but before Sheet append resumes safely',
  'failure after Sheet append but before completion resumes without duplicate row',
  'no Gmail mutation, no trigger mutation, and no destructive operation',
  'logs contain no secrets or attachment data',
  'source contains no private pilot values'
]) {
  assert.equal(tests.includes(marker), true, `tests missing marker: ${marker}`);
}

for (const forbidden of [
  'mainRun(',
  'scanInvoiceOutEmails_(',
  'scanInvoiceInEmails_(',
  'triggerScanInvoiceDriveFolder(',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  '.setTrashed(',
  '.deleteRow(',
  '.clear(',
  'clasp --force',
  '--force'
]) {
  assert.equal(runner.includes(forbidden), false, `forbidden runner token: ${forbidden}`);
}

for (const privatePilotValue of [
  ['no-reply', '@', 'meinvoice.vn'].join(''),
  ['0000', '0248'].join(''),
  ['1C26THD_', '0000', '0248'].join(''),
  ['1cNCIC_', 'Tv5Y3td80xMCTCl4vCWAoyFzxW'].join(''),
  ['1yBbalX91VZkGIBaUJZQRt5eVllVlo', '53696M5hMLNAoc'].join(''),
  ['19cd03', 'f07ebbd84e'].join('')
]) {
  assert.equal(runner.includes(privatePilotValue), false, `runner hardcodes private pilot value: ${privatePilotValue}`);
  assert.equal(tests.includes(privatePilotValue), false, `tests hardcode private pilot value: ${privatePilotValue}`);
  assert.equal(phaseDoc.includes(privatePilotValue), false, `phase doc hardcodes private pilot value: ${privatePilotValue}`);
  assert.equal(evidenceDoc.includes(privatePilotValue), false, `evidence doc hardcodes private pilot value: ${privatePilotValue}`);
}

for (const docMarker of [
  'PHASE=D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL',
  'STATUS=IMPLEMENTED_SYNCED_NOT_EXECUTED',
  'PRODUCTION_MUTATION_EXECUTED=NO',
  'OWNER_APPROVAL_MARKER_CONFIGURED=NO',
  'PRIVATE_VALUES_COMMITTED=NO',
  'IDEMPOTENT_RERUN_SUPPORTED=YES',
  'PARTIAL_FAILURE_POLICY=NO_AUTO_DELETE;NO_SHEET_EDIT;NO_CLEAR;SANITIZED_RECONCILIATION_REQUIRED',
  'NEXT_ACTION=OWNER_REVIEW_AND_EXPLICIT_ONE_RECORD_EXECUTION_APPROVAL'
]) {
  assert.equal((phaseDoc + '\n' + evidenceDoc).includes(docMarker), true, `docs missing marker: ${docMarker}`);
}

assert.equal(
  packageJson.scripts['check:d6j-c-controlled-one-record-production-mutation-channel'],
  'node scripts/checkers/check-d6j-c-controlled-one-record-production-mutation-channel.mjs',
  'package command check:d6j-c-controlled-one-record-production-mutation-channel missing or changed'
);

console.log('D6J_C_CONTROLLED_ONE_RECORD_PRODUCTION_MUTATION_CHANNEL_CHECK=PASS');
