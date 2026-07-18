import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const requiredFiles = [
  'sgdsRuntimeArchitecture.js',
  'firestoreDataContract.js',
  'firestoreRestGateway.js',
  'scripts/baseline/collect-sgds-read-only-baseline.mjs',
  'scripts/checkers/check-sgds-apps-script-first-architecture.mjs',
  'docs/phases/SGDS_D5Y_D5Z_D6A_D6B_APPS_SCRIPT_FIRST_FOUNDATION.md',
  'docs/evidence/SGDS_D5Z_READ_ONLY_BASELINE.md',
  'tests/unit/apps-script-first-firestore-foundation.test.mjs',
  'tests/unit/sgds-read-only-baseline.test.mjs',
  'tests/emulator/apps-script-firestore-rest-gateway-emulator.test.mjs',
  'services/sgds-durable-orchestrator/src/app.mjs'
];

for (const file of requiredFiles) assert.equal(exists(file), true, `missing bundle file: ${file}`);

const architecture = read('sgdsRuntimeArchitecture.js');
const contract = read('firestoreDataContract.js');
const gateway = read('firestoreRestGateway.js');
const baseline = read('scripts/baseline/collect-sgds-read-only-baseline.mjs');
const doc = read('docs/phases/SGDS_D5Y_D5Z_D6A_D6B_APPS_SCRIPT_FIRST_FOUNDATION.md');
const evidence = read('docs/evidence/SGDS_D5Z_READ_ONLY_BASELINE.md');
const pkg = JSON.parse(read('package.json'));
const manifest = JSON.parse(read('appsscript.json'));

for (const marker of [
  'APPS_SCRIPT_FIRST_NO_BILLING',
  'GOOGLE_APPS_SCRIPT',
  'GOOGLE_DRIVE',
  'GOOGLE_SHEETS',
  'FIRESTORE',
  'DEFERRED_OPTIONAL'
]) assert.equal(architecture.includes(marker), true, `architecture source missing ${marker}`);

for (const marker of [
  'jobs',
  'gmail_messages',
  'attachments',
  'audit_events',
  'worker_leases',
  'commands',
  'runtime_config',
  'authorized_users',
  'discovered',
  'queued',
  'processing',
  'attachment_saved',
  'data_extracted',
  'sheet_written',
  'completed',
  'failed_retryable',
  'failed_terminal',
  'ignored',
  'sheetsRemainBusinessLedger',
  'firestoreStoresFileBytes: false'
]) assert.equal(contract.includes(marker), true, `contract source missing ${marker}`);

for (const marker of [
  'createFirestoreClient_',
  'createFirestoreValueCodec_',
  'createFirestorePathValidator_',
  'createFirestoreErrorMapper_',
  'createFirestoreRetryPolicy_',
  'createSgdsJobRepository_',
  'createSgdsAuditRepository_',
  'createSgdsLeaseRepository_',
  'createSgdsCommandRepository_',
  'httpTransport',
  'accessTokenProvider',
  'FIRESTORE_IDEMPOTENCY_KEY_REQUIRED',
  'FIRESTORE_COLLECTION_NOT_ALLOWED',
  'FIRESTORE_UPDATE_MASK_UNSAFE'
]) assert.equal(gateway.includes(marker), true, `gateway source missing ${marker}`);

for (const forbidden of [
  'clasp push',
  'firebase deploy',
  'gcloud.cmd services enable',
  'gcloud.cmd run deploy',
  'CloudBuild',
  'GmailApp.',
  'DriveApp.',
  'SpreadsheetApp.',
  'ScriptApp.newTrigger',
  'UrlFetchApp.fetch('
]) assert.equal(gateway.includes(forbidden), false, `gateway must not contain production/deploy operation: ${forbidden}`);

assert.equal(baseline.includes('NOT_LIVE_VERIFIED'), true, 'baseline must support not-live-verified fields');
assert.equal(baseline.includes('PRODUCTION_WRITE_ATTEMPTED'), true, 'baseline must record no write attempt');

for (const marker of [
  'PHASE=D5Y_D5Z_D6A_D6B_APPS_SCRIPT_FIRST_FOUNDATION',
  'ARCHITECTURE_DECISION_LOCKED=YES',
  'BASELINE_REPORT_STATUS=PASS_REPOSITORY_SAFE_BASELINE',
  'DATA_CONTRACT_LOCKED=YES',
  'FIRESTORE_REST_CLIENT=IMPLEMENTED_LOCAL_ONLY',
  'CLOUD_RUN_STATUS=DEFERRED_OPTIONAL',
  'BILLING_REQUIRED=NO',
  'NEXT_ALLOWED_PHASE=D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS'
]) assert.equal(doc.includes(marker), true, `phase doc missing ${marker}`);

for (const marker of [
  'FIREBASE_PROJECT_ID_EXPECTED=tonkhohd',
  'FIREBASE_PROJECT_NUMBER_EXPECTED=587745071207',
  'APPS_SCRIPT_ID_MATCH=YES',
  'LIVE_BASELINE_VERIFICATION=NOT_LIVE_VERIFIED',
  'PRODUCTION_WRITE_ATTEMPTED=NO'
]) assert.equal(evidence.includes(marker), true, `baseline evidence missing ${marker}`);

assert.equal(manifest.oauthScopes.includes('openid'), true, 'openid scope must remain present');
assert.equal(manifest.oauthScopes.includes('https://www.googleapis.com/auth/script.external_request'), true, 'external request scope required for future Firestore REST calls');
assert.equal(pkg.scripts['baseline:sgds-read-only'], 'node scripts/baseline/collect-sgds-read-only-baseline.mjs');
assert.equal(pkg.scripts['check:sgds-apps-script-first-architecture'], 'node scripts/checkers/check-sgds-apps-script-first-architecture.mjs');
assert.equal(pkg.scripts['check:d5y-d5z-d6a-d6b'], 'node scripts/checkers/check-d5y-d5z-d6a-d6b-apps-script-first-foundation.mjs');

for (const source of [architecture, contract, gateway, baseline, doc, evidence]) {
  for (const forbidden of [
    ['refresh', 'token'].join('_'),
    ['private', 'key'].join('_'),
    ['client', 'secret'].join('_'),
    ['BEGIN', 'PRIVATE', 'KEY'].join(' ')
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden secret token marker present: ${forbidden}`);
  }
}

console.log('D5Y_D5Z_D6A_D6B_CHECK=PASS');
