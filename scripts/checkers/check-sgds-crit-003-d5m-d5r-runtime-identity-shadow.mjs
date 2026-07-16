import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const phaseDocPath = 'docs/phases/SGDS_CRIT_003_D5M_D5R_RUNTIME_IDENTITY_AND_SCANNER_SHADOW_INTEGRATION.md';
const runtimeIdentityPath = 'firestoreRuntimeIdentity.js';
const shadowBridgePath = 'durableScannerShadowBridge.js';
const scannerPath = 'gmailScanner.js';

const phaseDoc = read(phaseDocPath);
const runtimeIdentity = read(runtimeIdentityPath);
const shadowBridge = read(shadowBridgePath);
const scanner = read(scannerPath);
const packageJson = JSON.parse(read('package.json'));

function requireMarker(text, marker, label) {
  assert.match(text, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${label} missing marker: ${marker}`);
}

for (const marker of [
  'SGDS_D5M_D5R_STATUS=PARTIAL_PASS_DESIGN_AND_LOCAL_WIRING_COMPLETE',
  'D5M_A_RUNTIME_DISCOVERY=PASS',
  'D5M_B_ARCHITECTURE_DECISION=PASS',
  'D5M_C_PERMISSION_DESIGN=PASS',
  'D5N_A_SA=BLOCKED_SA_CREATION_APPROVAL_MISSING',
  'D5N_B_IAM_BINDINGS=BLOCKED_IAM_APPROVAL_MISSING',
  'D5N_C_KEYLESS_VALIDATION=NOT_RUN_SA_APPROVAL_MISSING',
  'D5O_A_CREDENTIAL_ABSTRACTION=PASS',
  'D5O_B_SCANNER_WIRING=PASS_LOCAL',
  'D5O_C_LOCAL_EMULATOR_VALIDATION=PASS',
  'D5P_A_PRODUCTION_DRY_RUN=NOT_RUN_IDENTITY_PENDING',
  'D5P_B_ONE_CYCLE_SHADOW_SCAN=NOT_RUN_APPROVAL_MISSING',
  'D5P_C_REPLAY_IDEMPOTENCY=NOT_RUN_APPROVAL_MISSING',
  'D5Q_A_AUDIT_RECONCILIATION=LOCAL_ONLY',
  'D5R_A_AUTOMATION_READINESS=BLOCKED_IDENTITY_OR_IAM',
  'GMAIL_SCANNER_RUNTIME=Apps Script V8',
  'FIRESTORE_WRITER_RUNTIME=local Node D5J runner for current smoke; future dedicated runtime pending',
  'SELECTED_PRODUCTION_PATTERN=PATTERN_C_HOSTED_DURABLE_ORCHESTRATOR_WITH_ATTACHED_SA_PENDING_INFRASTRUCTURE_APPROVAL',
  'SELECTED_LOCAL_VALIDATION_PATTERN=PATTERN_D_GCLOUD_SA_IMPERSONATION_KEYLESS_PENDING_APPROVAL',
  'SA_ID=sgds-firestore-runtime',
  'SA_CREATED=NO_APPROVAL_MISSING',
  'SA_KEY_COUNT=0',
  'RECOMMENDED_ROLE_STRATEGY=custom project role without delete; roles/datastore.user only as broader fallback after owner review',
  'DELETE_PERMISSION_INCLUDED=NO_FOR_CUSTOM_ROLE;YES_IN_roles/datastore.user_FALLBACK',
  'KEYLESS_AUTH=NOT_RUN_SA_APPROVAL_MISSING',
  'SCANNER_SHADOW_FEATURE_DEFAULT=false',
  'SCANNER_SHADOW_MAX_CANDIDATES=1',
  'GOOGLE_SHEETS_MUTATION=NONE',
  'GMAIL_MESSAGE_MUTATION=NONE',
  'GMAIL_LABEL_MUTATION=NONE',
  'GOOGLE_DRIVE_MUTATION=NONE',
  'GAS_DEPLOY=NOT_RUN',
  'FIREBASE_DEPLOY=NOT_RUN',
  'CLOUD_RUN_DEPLOY=NOT_RUN',
  'CLOUD_FUNCTIONS_DEPLOY=NOT_RUN',
  'PRODUCTION_TRIGGER_CREATED=NO',
  'DEDICATED_IDENTITY_READY=NO',
  'LEAST_PRIVILEGE_READY=NO',
  'KEYLESS_AUTH_READY=NO',
  'SCANNER_SHADOW_WIRING_READY=YES_LOCAL_DEFAULT_DISABLED',
  'CANONICAL_PIPELINE_READY=NO',
  'SGDS_CRIT_003_STATUS=BLOCKED_IDENTITY_OR_IAM',
  'SGDS_CRIT_003_LIMITATION=NO_DISTRIBUTED_ACID_TRANSACTION_ACROSS_GMAIL_DRIVE_SHEETS_LABELS',
  'NEXT_ALLOWED_ACTION=OWNER_APPROVE_D5N_CREATE_SA_sgds-firestore-runtime_PROJECT_tonkhohd_OR_KEEP_LOCAL_ONLY'
]) {
  requireMarker(phaseDoc, marker, phaseDocPath);
}

for (const marker of [
  'SGDS_FIRESTORE_PROJECT_ID',
  'SGDS_FIRESTORE_DATABASE_ID',
  'SGDS_FIRESTORE_RUNTIME_MODE',
  'SGDS_FIRESTORE_EXPECTED_PRINCIPAL',
  'service-account-impersonation',
  'attached-workload-identity',
  'dedicated-service-account',
  'FIRESTORE_RUNTIME_KEY_FILE_FORBIDDEN',
  'FIRESTORE_OWNER_PRINCIPAL_USED_FOR_AUTOMATION',
  'FIRESTORE_RUNTIME_PRINCIPAL_UNVERIFIABLE'
]) {
  requireMarker(runtimeIdentity, marker, runtimeIdentityPath);
}

assert.equal(runtimeIdentity.includes('GOOGLE_APPLICATION_CREDENTIALS'), true, 'runtime identity must explicitly reject key file credentials');
assert.equal(runtimeIdentity.includes('tokenMaterialReturned: false'), true, 'runtime identity provider must not return token material');
assert.doesNotMatch(runtimeIdentity, /service[-_ ]account[-_ ]key[-_ ]mode/i, 'runtime identity must not add a service account key mode label outside forbidden metadata');

for (const marker of [
  'SGDS_DURABLE_SHADOW_ENABLED: false',
  'SGDS_DURABLE_SHADOW_MAX_CANDIDATES: 1',
  'SGDS_DURABLE_SHADOW_CANONICAL_WRITES: false',
  'SGDS_DURABLE_SHADOW_GMAIL_MUTATIONS: false',
  'SGDS_DURABLE_SHADOW_DRIVE_MUTATIONS: false',
  'AFTER_CANDIDATE_DETECTED_BEFORE_CANONICAL_EFFECTS',
  'DURABLE_SHADOW_RUNTIME_NOT_CONFIGURED',
  'DURABLE_SHADOW_MAX_CANDIDATES_REACHED',
  'DURABLE_SHADOW_FAILED_CANONICAL_BLOCKED',
  'googleSheetsMutation',
  'gmailLabelMutation',
  'googleDriveMutation'
]) {
  requireMarker(shadowBridge, marker, shadowBridgePath);
}

const outHook = scanner.indexOf('direction: "OUT"');
const inHook = scanner.indexOf('direction: "IN"');
assert.notEqual(outHook, -1, 'OUT scanner hook missing');
assert.notEqual(inHook, -1, 'IN scanner hook missing');
assert.ok(outHook < scanner.indexOf('processInvoiceAllXMLAttachments_', outHook), 'OUT shadow hook must run before XML canonical processing');
assert.ok(inHook < scanner.indexOf('processInvoiceAllXMLAttachments_', inHook), 'IN shadow hook must run before XML canonical processing');
assert.match(scanner, /canonicalProcessingAllowed === false/, 'scanner must fail closed before canonical effects');

for (const forbidden of [
  'firebase deploy',
  'clasp push',
  'gcloud run deploy',
  'gcloud functions deploy',
  'git reset --hard',
  'git stash',
  ['ya29', '.'].join(''),
  `refresh_${'token'}`,
  `private_${'key'}`,
  ['BEGIN', 'PRIVATE', 'KEY'].join(' ')
]) {
  assert.equal(phaseDoc.includes(forbidden), false, `phase doc contains forbidden token/command: ${forbidden}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5m-d5r'],
  'node scripts/checkers/check-sgds-crit-003-d5m-d5r-runtime-identity-shadow.mjs',
  'package command check:sgds-crit-003-d5m-d5r missing or changed'
);

console.log('SGDS_CRIT_003_D5M_D5R_CHECK=PASS');
