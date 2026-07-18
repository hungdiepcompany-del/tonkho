import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const requiredFiles = [
  'sgdsAdapterErrors.js',
  'sgdsGmailAdapter.js',
  'sgdsDriveAdapter.js',
  'sgdsSheetsLedgerAdapter.js',
  'sgdsRuntimeAdapterFactory.js',
  'tests/unit/apps-script-adapters.test.mjs',
  'docs/phases/D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS.md',
  'docs/evidence/D6C_D6D_D6E_LOCAL_ADAPTER_EVIDENCE.md'
];

for (const file of requiredFiles) assert.equal(exists(file), true, `missing D6C-D6E file: ${file}`);

const gmail = read('sgdsGmailAdapter.js');
const drive = read('sgdsDriveAdapter.js');
const sheets = read('sgdsSheetsLedgerAdapter.js');
const factory = read('sgdsRuntimeAdapterFactory.js');
const errors = read('sgdsAdapterErrors.js');
const tests = read('tests/unit/apps-script-adapters.test.mjs');
const phaseDoc = read('docs/phases/D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS.md');
const evidenceDoc = read('docs/evidence/D6C_D6D_D6E_LOCAL_ADAPTER_EVIDENCE.md');
const pkg = JSON.parse(read('package.json'));

for (const marker of [
  'GMAIL_ADAPTER',
  'createSgdsGmailReadAdapter_',
  'createSgdsGmailMutationAdapter_',
  'createFakeSgdsGmailAdapter_',
  'createSgdsGmailJobCandidates_',
  'PDF_ONLY_REVIEW_REQUIRED',
  'LINK_ONLY_REVIEW_REQUIRED'
]) assert.equal(gmail.includes(marker), true, `gmail adapter missing ${marker}`);

for (const marker of [
  'DRIVE_ADAPTER',
  'createSgdsDriveReadAdapter_',
  'createSgdsDriveMutationAdapter_',
  'createFakeSgdsDriveAdapter_',
  'buildSgdsDriveArtifactIdentity_',
  'fileIdentityModel'
]) assert.equal(drive.includes(marker), true, `drive adapter missing ${marker}`);

for (const marker of [
  'SHEETS_LEDGER_ADAPTER',
  'createSgdsSheetsLedgerReadAdapter_',
  'createSgdsSheetsLedgerMutationAdapter_',
  'createFakeSgdsSheetsLedgerAdapter_',
  'DIRECT_HISTORY_EDIT_BLOCKED',
  'DIRECT_HISTORY_DELETE_BLOCKED',
  'ADJUSTMENT_IS_APPEND_ONLY',
  'append_only_transaction_sequence',
  'oversell blocked'
]) assert.equal(sheets.includes(marker), true, `sheets adapter missing ${marker}`);

for (const marker of [
  'adapter_auth_error',
  'adapter_permission_error',
  'adapter_not_found',
  'adapter_rate_limited',
  'adapter_transient_error',
  'adapter_contract_error',
  'adapter_conflict',
  'adapter_idempotent_replay',
  'retryable',
  'review-required',
  'idempotent-success'
]) assert.equal(errors.includes(marker), true, `adapter errors missing ${marker}`);

assert.equal(factory.includes("SGDS_DEFAULT_PRODUCTION_RUNTIME_ = 'apps_script'"), true, 'Apps Script must be production default');
assert.equal(factory.includes('SGDS_CLOUD_RUN_FALLBACK_AUTOMATIC_ = false'), true, 'Cloud Run fallback must remain false');
assert.equal(factory.includes('automatic Cloud Run fallback is forbidden'), true, 'automatic Cloud Run fallback guard missing');

for (const marker of [
  'candidates.filter(item => item.attachmentKind === \'XML\').length, 2',
  'PDF_ONLY_REVIEW_REQUIRED',
  'LINK_ONLY_REVIEW_REQUIRED',
  'same-name.xml',
  'oversell',
  'appendAdjustment',
  'appendReplacement',
  'appendCancellation',
  'local end-to-end adapter flow',
  'fakeHttp.calls.length, 1'
]) assert.equal(tests.includes(marker), true, `tests missing scenario marker: ${marker}`);

for (const forbidden of [
  'GmailApp',
  'DriveApp',
  'SpreadsheetApp',
  'UrlFetchApp',
  'firebase deploy',
  'clasp push',
  'gcloud.cmd services enable'
]) {
  assert.equal(tests.includes(forbidden), false, `new adapter tests must not call or name production surface: ${forbidden}`);
}

for (const marker of [
  'STATUS=PASS_LOCAL_APPS_SCRIPT_ADAPTERS_IMPLEMENTED',
  'PRIMARY_RUNTIME=apps_script',
  'CLOUD_RUN_FALLBACK_AUTOMATIC=false',
  'DIRECT_HISTORY_EDIT_BLOCKED=true',
  'DIRECT_HISTORY_DELETE_BLOCKED=true',
  'ADJUSTMENT_IS_APPEND_ONLY=true',
  'LOCAL_END_TO_END_ADAPTER_FLOW_PASS=true',
  'PRODUCTION_GOOGLE_API_CALL_COUNT=0'
]) assert.equal(phaseDoc.includes(marker), true, `phase doc missing ${marker}`);

for (const marker of [
  'GMAIL_ADAPTER_TESTS_PASS=PASS',
  'DRIVE_ADAPTER_TESTS_PASS=PASS',
  'SHEETS_ADAPTER_TESTS_PASS=PASS',
  'ADAPTER_FACTORY_TESTS_PASS=PASS',
  'ERROR_CLASSIFICATION_TESTS_PASS=PASS',
  'IDEMPOTENCY_TESTS_PASS=PASS',
  'D6C_D6E_CHECK=PASS'
]) assert.equal(evidenceDoc.includes(marker), true, `evidence doc missing ${marker}`);

assert.equal(pkg.scripts['check:d6c-d6e-apps-script-adapters'], 'node scripts/checkers/check-d6c-d6e-apps-script-adapters.mjs');

console.log('D6C_D6E_APPS_SCRIPT_ADAPTERS_CHECK=PASS');
