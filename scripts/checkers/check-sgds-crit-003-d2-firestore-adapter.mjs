import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');

const adapter = read('firestoreDurableJobStore.js');
const tests = read('tests/unit/firestore-durable-job-store.test.mjs');
const fixtures = read('fixtures/sgds-crit-003-d2/firestore-adapter-fixtures.mjs');
const packageJson = JSON.parse(read('package.json'));

const requiredErrors = [
  'DURABLE_JOB_NOT_FOUND',
  'DURABLE_JOB_ALREADY_EXISTS',
  'DURABLE_JOB_VERSION_CONFLICT',
  'DURABLE_JOB_ILLEGAL_TRANSITION',
  'DURABLE_JOB_TERMINAL_STATE',
  'COMMIT_PLAN_MISSING',
  'COMMIT_PLAN_HASH_MISMATCH',
  'COMMIT_PLAN_IMMUTABILITY_VIOLATION',
  'AUDIT_EVENT_SEQUENCE_CONFLICT',
  'RECONCILIATION_REPORT_INVALID',
  'FIRESTORE_TRANSPORT_ERROR',
  'FIRESTORE_WRITE_UNCONFIRMED'
];

const requiredOperations = [
  'createJobIfAbsent',
  'getJob',
  'saveCommitPlanIfAbsent',
  'transitionJob',
  'appendAuditEvent',
  'saveReconciliationReport',
  'getLatestReconciliationReport',
  'markReconciliationRequired'
];

assert.match(adapter, /function createDurableInvoiceJobStore\(transport, options\)/, 'adapter interface missing');
for (const operation of requiredOperations) {
  assert.match(adapter, new RegExp(`\\b${operation}\\b`), `adapter operation missing: ${operation}`);
}

assert.match(adapter, /invoiceJobs/, 'job collection contract missing');
assert.match(adapter, /\/events/, 'audit collection contract missing');
assert.match(adapter, /\/reconciliationReports/, 'reconciliation report collection contract missing');
assert.match(adapter, /expectedVersion/, 'expected-version concurrency missing');
assert.match(adapter, /DURABLE_JOB_VERSION_CONFLICT/, 'version conflict error missing');
assert.match(adapter, /version:\s*current\.version \+ 1/, 'successful mutation does not increment version');
assert.doesNotMatch(adapter, /last[-_ ]?write[-_ ]?wins/i, 'last-write-wins language must not appear');
assert.match(adapter, /COMMIT_PLAN_IMMUTABILITY_VIOLATION/, 'commit-plan immutability missing');
assert.match(adapter, /IDEMPOTENT_PLAN_MATCH/, 'same-plan idempotency missing');
assert.match(adapter, /appendAuditEvent/, 'audit append operation missing');
assert.match(adapter, /sequence already exists/, 'audit append-only sequence check missing');
assert.match(adapter, /saveReconciliationReport/, 'reconciliation report persistence missing');
assert.match(adapter, /RECONCILIATION_REQUIRED/, 'blocker reconciliation status missing');
assert.match(adapter, /transport\.runTransaction/, 'injected transaction transport missing');
assert.match(adapter, /transport\.getDocument|tx\.getDocument/, 'injected getDocument transport missing');
assert.match(adapter, /transport\.createDocument|tx\.createDocument/, 'injected createDocument transport missing');
assert.match(adapter, /transport\.updateDocument|tx\.updateDocument/, 'injected updateDocument transport missing');
assert.match(adapter, /clock\.now\(\)/, 'injected clock missing');

for (const code of requiredErrors) {
  assert.match(adapter, new RegExp(`['"]${code}['"]`), `required error code missing from adapter: ${code}`);
  assert.match(tests, new RegExp(`['"]${code}['"]|${code}`), `required error code missing from tests: ${code}`);
}

for (const forbidden of ['GmailApp', 'DriveApp', 'SpreadsheetApp', 'PropertiesService', 'UrlFetchApp']) {
  assert.doesNotMatch(adapter, new RegExp(`\\b${forbidden}\\b`), `adapter references forbidden production API: ${forbidden}`);
}
assert.doesNotMatch(adapter, /function\s+(repairJob|autoFixJob|deleteLedgerRows|deleteDriveEvidence|removeGmailLabel)\s*\(/, 'forbidden repair/delete function exported');
const adapterWithoutSanitizerPattern = adapter.replace(/if \(\/[^\n]+REDACTED_SECRET[^\n]+/g, '');
const serviceMarker = ['service', 'account'].join('_');
const keyMarker = ['private', 'key'].join('_');
const blockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
const refreshMarker = ['refresh', 'token'].join('_');
const tokenPrefix = ['ya', '29'].join('');
const credentialPattern = new RegExp([serviceMarker, keyMarker, blockMarker, 'apiKey', 'AIza', tokenPrefix + '[.]', refreshMarker].join('|'), 'i');
assert.doesNotMatch(adapterWithoutSanitizerPattern, credentialPattern, 'production credential marker in adapter');

const productionFiles = ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'onOpen.js', 'Code.js'].filter(file => fs.existsSync(file));
for (const file of productionFiles) {
  const text = read(file);
  assert.doesNotMatch(text, /createDurableInvoiceJobStore|firestoreDurableJobStore/, `D2 adapter is wired into production file: ${file}`);
}

assert.match(fixtures, /createFakeFirestoreTransport/, 'fake transport missing');
assert.match(fixtures, /fail before job create/, 'fault case missing: fail before job create');
assert.match(fixtures, /fail after create response lost/, 'fault case missing: fail after create response lost');
assert.match(fixtures, /fail before transition commit/, 'fault case missing: fail before transition commit');
assert.match(fixtures, /fail after transition commit response lost/, 'fault case missing: fail after transition commit response lost');
assert.match(fixtures, /fail while appending audit event/, 'fault case missing: fail while appending audit event');
assert.match(fixtures, /fail while saving reconciliation report/, 'fault case missing: fail while saving reconciliation report');
assert.match(fixtures, /version conflict during resume/, 'fault case missing: version conflict during resume');
assert.match(fixtures, /duplicate request with same idempotency key/, 'fault case missing: duplicate idempotency key');

assert.match(tests, /same local scenario run twice is deterministic/, 'deterministic repeated suite scenario missing');
assert.match(tests, /FIRESTORE_WRITE_UNCONFIRMED/, 'unknown write outcome test missing');
assert.match(tests, /IDEMPOTENT_TRANSITION_MATCH/, 'idempotent retry test missing');

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d2'],
  'node scripts/checkers/check-sgds-crit-003-d2-firestore-adapter.mjs',
  'package command check:sgds-crit-003-d2 missing or changed'
);

console.log('SGDS_CRIT_003_D2_CHECK=PASS');
