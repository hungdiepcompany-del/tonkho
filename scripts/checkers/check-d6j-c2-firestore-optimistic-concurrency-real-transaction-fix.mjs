import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const runnerPath = 'd6jCOneRecordProductionMutation.js';
const storePath = 'firestoreDurableJobStore.js';
const testPath = 'tests/unit/d6j-c-one-record-production-mutation.test.mjs';
const phaseDocPath = 'docs/phases/D6J_C2_FIRESTORE_OPTIMISTIC_CONCURRENCY_AND_REAL_TRANSACTION_FIX.md';
const evidenceDocPath = 'docs/evidence/D6J_C2_FIRESTORE_OPTIMISTIC_CONCURRENCY_AND_REAL_TRANSACTION_FIX_EVIDENCE.md';

for (const file of [runnerPath, storePath, testPath, phaseDocPath, evidenceDocPath]) {
  assert.equal(exists(file), true, `missing D6J-C2 file: ${file}`);
}

const runner = read(runnerPath);
const store = read(storePath);
const tests = read(testPath);
const docs = read(phaseDocPath) + '\n' + read(evidenceDocPath);
const packageJson = JSON.parse(read('package.json'));

const hasOptimisticPrecondition =
  runner.includes('readD6jCFirestoreDocumentReadState_')
  && runner.includes('readUpdateTimes')
  && runner.includes('currentDocument.updateTime')
  && runner.includes('FIRESTORE_CONCURRENT_MODIFICATION');
const hasRealRestTransaction =
  runner.includes('beginTransaction') && runner.includes('commit');

assert.equal(
  hasOptimisticPrecondition || hasRealRestTransaction,
  true,
  'Firestore writes must use server updateTime preconditions or actual Firestore transactions'
);

for (const marker of [
  'ScriptApp.getOAuthToken()',
  'UrlFetchApp.fetch(url, params)',
  'currentDocument.updateTime',
  'currentDocument: { exists: false }',
  "method === 'LIST' ? 'GET' : method",
  'validateD6jCFirestoreCollectionPath_',
  'FIRESTORE_PRECONDITION_MISSING',
  'FIRESTORE_CONCURRENT_MODIFICATION',
  'classifyD6jCFirestoreErrorCode_',
  'leaseGeneration',
  'previousLeaseGeneration',
  'createD6jCFirestoreLeaseStore_',
  'createD6jCFirestoreDurableTransport_'
]) {
  assert.equal(runner.includes(marker), true, `runner missing marker: ${marker}`);
}

assert.equal(
  /return work\(\{\s*getDocument,\s*createDocument,\s*updateDocument,\s*appendDocument,\s*queryDocuments\s*\}\)/.test(runner),
  false,
  'runTransaction is still only a callback wrapper'
);

for (const marker of [
  'FIRESTORE_CONCURRENT_MODIFICATION',
  'FIRESTORE_PRECONDITION_MISSING'
]) {
  assert.equal(store.includes(marker), true, `durable store missing concurrency error marker: ${marker}`);
}

for (const marker of [
  'createVersionedFirestoreTransport',
  'D6J-C Firestore source requires server updateTime preconditions',
  'validateD6jCFirestoreCollectionPath_',
  'two writers reading the same released lease cannot both reacquire it',
  'two writers reclaiming the same expired active lease produce exactly one winner',
  'stale owner cannot release a lease after it is reclaimed by a new fencing token',
  'stale durable job transition fails after another transition updates the job',
  'commit plan cannot be overwritten through a stale race',
  'reconciliation update cannot overwrite a newer completed job state',
  'FIRESTORE_CONCURRENT_MODIFICATION',
  'FIRESTORE_PRECONDITION_MISSING'
]) {
  assert.equal(tests.includes(marker), true, `tests missing marker: ${marker}`);
}

for (const docMarker of [
  'PHASE=D6J_C2_FIRESTORE_OPTIMISTIC_CONCURRENCY_AND_REAL_TRANSACTION_FIX',
  'FIRESTORE_SERVER_PRECONDITIONS=PASS',
  'LEASE_CONCURRENCY_TEST=PASS',
  'DURABLE_JOB_CONCURRENCY_TEST=PASS',
  'OWNER_APPROVAL_MARKER_CONFIGURED=NO',
  'PRODUCTION_MUTATION_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'CLASP_FORCE_USED=NO',
  'NEXT_ACTION=OWNER_REVIEW_AND_EXPLICIT_EXECUTION_APPROVAL'
]) {
  assert.equal(docs.includes(docMarker), true, `docs missing marker: ${docMarker}`);
}

for (const forbidden of [
  'runD6jCOneRecordProductionMutation();',
  'mainRun(',
  'scanInvoiceOutEmails_(',
  'scanInvoiceInEmails_(',
  'triggerScanInvoiceDriveFolder(',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  '.setTrashed(',
  '.deleteRow(',
  '.clear(',
  '--force'
]) {
  assert.equal(runner.includes(forbidden), false, `forbidden D6J-C2 runner token: ${forbidden}`);
}

assert.equal(
  packageJson.scripts['check:d6j-c2-firestore-optimistic-concurrency-real-transaction-fix'],
  'node scripts/checkers/check-d6j-c2-firestore-optimistic-concurrency-real-transaction-fix.mjs',
  'package command check:d6j-c2-firestore-optimistic-concurrency-real-transaction-fix missing or changed'
);

console.log('D6J_C2_FIRESTORE_OPTIMISTIC_CONCURRENCY_REAL_TRANSACTION_FIX_CHECK=PASS');
