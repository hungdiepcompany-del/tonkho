import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const requiredFiles = [
  'd6jPilotReadiness.js',
  'fixtures/d6j-a/pilot-readiness-fixtures.json',
  'docs/templates/D6J_A_PILOT_MANIFEST_TEMPLATE.json',
  'tests/unit/d6j-a-limited-production-pilot-readiness.test.mjs',
  'scripts/checkers/check-d6j-a-limited-production-pilot-readiness.mjs',
  'docs/phases/D6J_A_LIMITED_PRODUCTION_PILOT_READINESS.md',
  'docs/evidence/D6J_A_LIVE_BASELINE_EVIDENCE.md',
  'docs/evidence/D6J_A_DEPLOYMENT_GAP_ANALYSIS.md',
  'docs/evidence/D6J_A_PILOT_MANIFEST_SPEC.md'
];

for (const file of requiredFiles) assert.equal(exists(file), true, `missing D6J-A file: ${file}`);

const source = read('d6jPilotReadiness.js');
const unitTests = read('tests/unit/d6j-a-limited-production-pilot-readiness.test.mjs');
const fixtureText = read('fixtures/d6j-a/pilot-readiness-fixtures.json');
const manifestTemplate = read('docs/templates/D6J_A_PILOT_MANIFEST_TEMPLATE.json');
const phaseDoc = read('docs/phases/D6J_A_LIMITED_PRODUCTION_PILOT_READINESS.md');
const baselineDoc = read('docs/evidence/D6J_A_LIVE_BASELINE_EVIDENCE.md');
const gapDoc = read('docs/evidence/D6J_A_DEPLOYMENT_GAP_ANALYSIS.md');
const manifestDoc = read('docs/evidence/D6J_A_PILOT_MANIFEST_SPEC.md');
const pkg = JSON.parse(read('package.json'));

const combinedDocs = [phaseDoc, baselineDoc, gapDoc, manifestDoc].join('\n');

for (const marker of [
  'PHASE=D6J_A_LIMITED_PRODUCTION_PILOT_READINESS',
  'STATUS=PASS_READINESS_VALIDATED',
  'READ_ONLY_PHASE=YES',
  'SGDS_RUNTIME_STRATEGY=APPS_SCRIPT_FIRST_NO_BILLING',
  'PRIMARY_WORKER=GOOGLE_APPS_SCRIPT',
  'CLOUD_RUN_STATUS=DEFERRED_OPTIONAL',
  'PILOT_EMAIL_SELECTION=OWNER_INPUT_REQUIRED',
  'DRIVE_ROOT_FOLDER=OWNER_INPUT_REQUIRED',
  'PRODUCTION_SHEET_TARGET=OWNER_INPUT_REQUIRED',
  'OWNER_APPROVAL_MARKERS_PRESENT=NO',
  'OWNER_APPROVED_D6J_REQUIRED_DEPLOYMENTS',
  'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN',
  'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION',
  'OWNER_APPROVED_D6J_PILOT_ROLLBACK',
  'PRODUCTION_DRY_RUN_GATE=SEPARATE_FROM_MUTATION',
  'ROLLBACK_PLAN=READY_OWNER_GATED',
  'IDEMPOTENCY_PLAN=READY',
  'RECONCILIATION_PLAN=READY',
  'BILLING_CHANGED=NO',
  'GOOGLE_CLOUD_API_CHANGED=NO',
  'SA_KEY_CREATED=NO',
  'CLASP_PUSH=NOT_RUN',
  'FIREBASE_DEPLOY=NOT_RUN',
  'FIRESTORE_RULES_DEPLOY=NOT_RUN',
  'FIRESTORE_INDEX_DEPLOY=NOT_RUN',
  'AUTHORIZED_USER_PRODUCTION_MUTATION=NONE',
  'TRIGGER_MUTATION=NONE',
  'GMAIL_MUTATION=NONE',
  'DRIVE_MUTATION=NONE',
  'GOOGLE_SHEETS_MUTATION=NONE',
  'PRODUCTION_FIRESTORE_MUTATION=NONE',
  'PRODUCTION_COMMAND_CREATED=NO',
  'PRODUCTION_COMMAND_EXECUTED=NO',
  'PRODUCTION_HTTP_WRITE_COUNT=0',
  'PRODUCTION_GOOGLE_API_WRITE_COUNT=0',
  'NEXT_ALLOWED_PHASE=D6J_B_LIMITED_PRODUCTION_PILOT'
]) assert.equal(combinedDocs.includes(marker), true, `docs missing marker: ${marker}`);

for (const marker of [
  'getD6jALimitedProductionPilotContract',
  'createD6jAPilotManifestTemplate',
  'validateD6jAPilotManifest',
  'evaluateD6jAPilotCandidate',
  'classifyD6jADeploymentGap',
  'validateD6jAOwnerMarkerSeparation',
  'redactD6jAPrivateIdentifiers',
  'classifyD6jALiveBaseline',
  'D6J_A_EXACT_ONE_MESSAGE_REQUIRED',
  'D6J_A_EXACT_ONE_ATTACHMENT_REQUIRED',
  'D6J_A_GMAIL_MUTATION_FORBIDDEN',
  'D6J_A_DRIVE_FILE_LIMIT_EXCEEDED',
  'D6J_A_SHEET_INSERT_LIMIT_EXCEEDED',
  'D6J_A_DESTRUCTIVE_OPERATION_FORBIDDEN'
]) assert.equal(source.includes(marker), true, `source missing marker: ${marker}`);

for (const marker of [
  'pilot manifest schema',
  'candidate limit enforcement',
  'deployment gap classification',
  'owner input',
  'rollback, idempotency and reconciliation',
  'private identifier redaction'
]) assert.equal(unitTests.includes(marker), true, `unit tests missing marker: ${marker}`);

const template = JSON.parse(manifestTemplate);
assert.equal(template.schemaVersion, 'D6J_A_PILOT_MANIFEST_V1');
assert.equal(template.gmail.queryShape.maxResults, 1);
assert.equal(template.gmail.queryShape.hasAttachment, true);
assert.equal(template.drive.maximumFilesCreated, 1);
assert.equal(template.drive.createFolderAllowed, false);
assert.equal(template.sheets.maximumInsertedRows, 1);
assert.equal(template.sheets.maximumUpdatedRows, 0);
assert.equal(template.firestore.maximumJobsCreated, 1);
assert.equal(template.firestore.commandDocumentsCreated, 0);
assert.equal(template.dryRun.mutationAfterDryRunAutomatic, false);

for (const placeholder of [
  '<OWNER_CONFIRMED_GMAIL_MESSAGE_ID>',
  '<OWNER_CONFIRMED_ATTACHMENT_ID>',
  '<OWNER_CONFIRMED_DRIVE_ROOT_FOLDER_ID>',
  '<OWNER_CONFIRMED_SPREADSHEET_ID>',
  '<OWNER_CONFIRMED_SHEET_NAME>'
]) assert.equal(manifestTemplate.includes(placeholder), true, `manifest missing placeholder: ${placeholder}`);

for (const forbidden of [
  'firebase deploy',
  'clasp push',
  'gcloud services enable',
  'gcloud run deploy',
  'firestore:indexes',
  'triggerScanInvoiceDriveFolder(',
  'scanInvoiceOutEmails_(',
  'scanInvoiceInEmails_(',
  'mainRun(',
  'GmailApp.search',
  'DriveApp.createFile',
  'SpreadsheetApp.openById'
]) {
  assert.equal(source.includes(forbidden), false, `source contains forbidden live/mutation token: ${forbidden}`);
  assert.equal(fixtureText.includes(forbidden), false, `fixtures contain forbidden live/mutation token: ${forbidden}`);
  assert.equal(manifestTemplate.includes(forbidden), false, `manifest contains forbidden live/mutation token: ${forbidden}`);
}

for (const forbiddenSecretShape of [
  ['service', 'account'].join('_'),
  ['private', 'key'].join('_'),
  ['client', 'secret'].join('_'),
  ['refresh', 'token'].join('_'),
  ['ya', '29.'].join('')
]) {
  assert.equal(source.includes(forbiddenSecretShape), false, `source contains secret-shaped token: ${forbiddenSecretShape}`);
  assert.equal(fixtureText.includes(forbiddenSecretShape), false, `fixtures contain secret-shaped token: ${forbiddenSecretShape}`);
  assert.equal(manifestTemplate.includes(forbiddenSecretShape), false, `manifest contains secret-shaped token: ${forbiddenSecretShape}`);
}

assert.equal(pkg.scripts['check:d6j-a-limited-production-pilot-readiness'], 'node scripts/checkers/check-d6j-a-limited-production-pilot-readiness.mjs');

console.log('D6J_A_LIMITED_PRODUCTION_PILOT_READINESS_CHECK=PASS');
