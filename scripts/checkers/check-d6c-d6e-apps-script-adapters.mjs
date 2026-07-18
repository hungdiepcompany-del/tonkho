import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const requiredFiles = [
  'sgdsAdapterErrors.js',
  'sgdsGmailAdapter.js',
  'sgdsDriveAdapter.js',
  'sgdsSheetsLedgerAdapter.js',
  'sgdsD6LocalAdapterPlanning.js',
  'sgdsRuntimeAdapterFactory.js',
  'tests/unit/apps-script-adapters.test.mjs',
  'tests/unit/d6c-d6e-local-planning.test.mjs',
  'fixtures/d6c-d6e/adapter-fixtures.json',
  'docs/phases/D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS.md',
  'docs/evidence/D6C_D6D_D6E_LOCAL_ADAPTER_EVIDENCE.md'
];

for (const file of requiredFiles) assert.equal(exists(file), true, `missing D6C-D6E file: ${file}`);

const gmail = read('sgdsGmailAdapter.js');
const drive = read('sgdsDriveAdapter.js');
const sheets = read('sgdsSheetsLedgerAdapter.js');
const planning = read('sgdsD6LocalAdapterPlanning.js');
const factory = read('sgdsRuntimeAdapterFactory.js');
const errors = read('sgdsAdapterErrors.js');
const tests = read('tests/unit/apps-script-adapters.test.mjs');
const planningTests = read('tests/unit/d6c-d6e-local-planning.test.mjs');
const fixtures = JSON.parse(read('fixtures/d6c-d6e/adapter-fixtures.json'));
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
  'SGDS_D6C_D6E_LOCAL_ADAPTERS_V1',
  'GmailDiscoveryService',
  'GmailQueryBuilder',
  'GmailMessageNormalizer',
  'GmailAttachmentNormalizer',
  'GmailClassificationEngine',
  'GmailFingerprintService',
  'GmailDiscoveryCursor',
  'GmailTransport interface',
  'FakeGmailTransport',
  'GmailDiscoveryDryRunPlanner',
  'DriveEvidenceStore',
  'DrivePathPlanner',
  'DriveFileNameSanitizer',
  'DriveFolderResolver',
  'DriveDuplicateDetector',
  'DriveMetadataBuilder',
  'DriveReconciliationService',
  'DriveTransport interface',
  'FakeDriveTransport',
  'DriveWriteDryRunPlanner',
  'SheetsLedgerAdapter',
  'SheetSchemaRegistry',
  'SheetRowNormalizer',
  'SheetBusinessKeyBuilder',
  'SheetRecordMatcher',
  'SheetUpsertPlanner',
  'SheetColumnOwnershipPolicy',
  'SheetConflictDetector',
  'SheetReconciliationService',
  'SheetsTransport interface',
  'FakeSheetsTransport',
  'SheetWriteDryRunPlanner',
  'planned_new_file',
  'existing_exact_match',
  'existing_source_identity_match',
  'conflicting_hash',
  'conflicting_metadata',
  'missing_source_attachment',
  'invalid_path',
  'requires_review',
  'DRY_RUN_CREATE_FIRESTORE_JOB',
  'productionGoogleApiCallCount: 0',
  'productionFirestoreAccess: \'NONE\''
]) assert.equal(planning.includes(marker), true, `D6 local planning missing ${marker}`);

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

for (const marker of [
  'fixture catalogue contains the required 18 sanitized D6C-D6E cases',
  'D6C Gmail query builder is bounded, deterministic, capped, and fail-closed',
  'D6D duplicate and reconciliation statuses cover exact, source identity, hash conflict, and missing source',
  'D6E upsert planner emits INSERT, UPDATE, NO_OP, HOLD_FOR_REVIEW, and REJECT_INVALID',
  'combined dry-run planner is deterministic, idempotent, resumable, and production-safe'
]) assert.equal(planningTests.includes(marker), true, `planning tests missing ${marker}`);

assert.equal(fixtures.fixturePolicy.realPrivateContent, false, 'fixtures must be synthetic');
assert.equal(fixtures.fixturePolicy.rawAttachmentBytes, false, 'fixtures must not include raw attachment bytes');
assert.equal(fixtures.fixturePolicy.productionGoogleApi, false, 'fixtures must not require live Google APIs');
assert.equal(fixtures.fixturePolicy.productionFirestore, false, 'fixtures must not require production Firestore');
assert.equal(fixtures.cases.length >= 18, true, 'D6 fixture catalogue must contain at least 18 cases');
for (const id of [
  'invoice_pdf_email',
  'quotation_excel_email',
  'two_attachments',
  'no_attachment',
  'inline_image',
  'duplicate_message',
  'duplicate_attachment_hash',
  'invalid_path_chars',
  'very_long_filename',
  'unknown_mime',
  'ambiguous_date',
  'same_business_key_identical',
  'same_business_key_changed_system_owned',
  'same_business_key_conflicting_user_editable',
  'multiple_existing_sheets_matches',
  'missing_required_business_field',
  'retryable_injected_transport_failure',
  'terminal_validation_failure'
]) assert.equal(fixtures.cases.some(item => item.id === id), true, `fixture missing ${id}`);

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
  assert.equal(planning.includes(forbidden), false, `local D6 planner must not call or name production surface: ${forbidden}`);
}

for (const marker of [
  'STATUS=PASS_LOCAL_IMPLEMENTATION_VALIDATED',
  'STATUS=PASS_LOCAL_APPS_SCRIPT_ADAPTERS_IMPLEMENTED',
  'GMAIL_DISCOVERY_ADAPTER=IMPLEMENTED_LOCAL_ONLY',
  'DRIVE_EVIDENCE_STORE_ADAPTER=IMPLEMENTED_LOCAL_ONLY',
  'SHEETS_LEDGER_ADAPTER=IMPLEMENTED_LOCAL_ONLY',
  'SHARED_NORMALIZATION_CONTRACT=IMPLEMENTED',
  'SHARED_IDEMPOTENCY_CONTRACT=IMPLEMENTED',
  'COMBINED_DRY_RUN_PIPELINE=IMPLEMENTED_LOCAL_ONLY',
  'FIXTURE_CATALOGUE=fixtures/d6c-d6e/adapter-fixtures.json',
  'LIVE_CONFIGURATION_STATUS=NOT_LIVE_VERIFIED_PLACEHOLDERS_ONLY',
  'PRIMARY_RUNTIME=apps_script',
  'CLOUD_RUN_FALLBACK_AUTOMATIC=false',
  'DIRECT_HISTORY_EDIT_BLOCKED=true',
  'DIRECT_HISTORY_DELETE_BLOCKED=true',
  'ADJUSTMENT_IS_APPEND_ONLY=true',
  'LOCAL_END_TO_END_ADAPTER_FLOW_PASS=true',
  'PRODUCTION_GOOGLE_API_CALL_COUNT=0'
]) assert.equal(phaseDoc.includes(marker), true, `phase doc missing ${marker}`);

for (const marker of [
  'D6C_GMAIL_DISCOVERY_STRICT_TESTS_PASS=PASS',
  'D6D_DRIVE_EVIDENCE_STORE_STRICT_TESTS_PASS=PASS',
  'D6E_SHEETS_LEDGER_STRICT_TESTS_PASS=PASS',
  'COMBINED_DRY_RUN_PIPELINE_TESTS_PASS=PASS',
  'FIXTURE_CATALOGUE_CASE_COUNT=18',
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
