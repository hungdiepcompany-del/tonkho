import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const integrationPath = 'durableShadowStateIntegration.js';
const testPath = 'tests/unit/durable-shadow-state-integration.test.mjs';
const phaseDocPath = 'docs/phases/SGDS_CRIT_003_D5E_SHADOW_DURABLE_STATE_INTEGRATION.md';
const securityDocPath = 'docs/phases/SGDS_CRIT_003_D5E_FIRESTORE_SHADOW_STATE_SECURITY_DESIGN.md';

const integration = read(integrationPath);
const tests = read(testPath);
const phaseDoc = fs.existsSync(phaseDocPath) ? read(phaseDocPath) : '';
const securityDoc = fs.existsSync(securityDocPath) ? read(securityDocPath) : '';
const packageJson = JSON.parse(read('package.json'));

const requiredIntegrationMarkers = [
  'function createDurableShadowStateIntegration(options)',
  'createDurableScannerShadowRunner',
  'createDurableInvoiceJobStore',
  'reconcileDurableInvoiceJobReportOnly',
  'runShadowBatch',
  'evaluateShadowCandidate',
  'getDurableJob',
  'listAuditEvents',
  'getLatestReconciliationReport',
  'D5E_EXECUTION_MODE_',
  "'SHADOW'",
  'D5E_PRODUCTION_MUTATION_ALLOWED_',
  'productionMutationAllowed: false',
  'SHADOW_CANDIDATE_DISCOVERED',
  'SHADOW_SOURCE_NORMALIZED',
  'SHADOW_IDENTITY_DERIVED',
  'SHADOW_JOB_CREATED',
  'SHADOW_JOB_REUSED',
  'SHADOW_COMMIT_PLAN_SAVED',
  'SHADOW_COMMIT_PLAN_REUSED',
  'SHADOW_RECONCILIATION_RECORDED',
  'SHADOW_REVIEW_REQUIRED',
  'SHADOW_EVALUATION_COMPLETED',
  'D5E_RETENTION_AND_SANITIZATION_POLICY_',
  'rawIdExclusion: true',
  'piiExclusion: true',
  'rawSourcePayloadPersisted: false',
  'D5E_REPORT_REPAIR_POLICY_',
  "'REPORT_ONLY'",
  'D5E_INPUT_SNAPSHOT_VERSION_',
  'D5E_SHADOW_STATE_SNAPSHOT_V1',
  'mergeD5EFindingCodes_',
  'sanitizeD5EDetails_'
];
for (const marker of requiredIntegrationMarkers) {
  assert.match(integration, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5E integration missing marker: ${marker}`);
}

const forbiddenIntegrationTokens = [
  'GmailApp',
  'DriveApp',
  'SpreadsheetApp',
  'PropertiesService',
  'UrlFetchApp',
  'FirestoreApp',
  'getFirestore',
  'initializeApp',
  'firebaseConfig',
  'clasp',
  'mainRun',
  'scanInvoiceOutEmails_',
  'scanInvoiceInEmails_',
  'triggerScanInvoiceDriveFolder',
  'onOpen',
  'createMenu',
  'addTrigger',
  'automaticRepair',
  'writeXmlIfAbsent',
  'appendInvoiceLinesIfAbsent',
  'applySavedLabel'
];
for (const token of forbiddenIntegrationTokens) {
  assert.equal(integration.includes(token), false, `D5E integration contains forbidden token: ${token}`);
}

const requiredTestMarkers = [
  'D5E_TEST_SCENARIOS.length, 24',
  'D5E_FAULT_INJECTION_CASES.length, 6',
  'single Gmail candidate creates one durable shadow job',
  'single Drive candidate creates one durable shadow job',
  'Gmail and Drive converge to one job',
  'same candidate rerun is idempotent',
  'same invoice from two sources keeps merged provenance',
  'commit plan immutable',
  'commit plan mismatch requires review',
  'version conflict isolated',
  'audit events append-only',
  'duplicate audit events bounded',
  'reconciliation report saved',
  'reconciliation findings deterministic',
  'report-only mode never repairs',
  'completed production state not fabricated',
  'shadow job does not enter production commit states',
  'raw Gmail IDs not persisted',
  'raw Drive IDs not persisted',
  'invoice PII not persisted',
  'XML/PDF contents not persisted',
  'batch isolation',
  'one failed candidate does not fail entire batch',
  'mutation attempt count zero',
  'production API call count zero',
  'production Firestore call count zero'
];
for (const marker of requiredTestMarkers) {
  assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5E tests missing marker: ${marker}`);
}

const requiredDocMarkers = [
  'SGDS_CRIT_003_D5E_STATUS=PASS_LOCAL_SHADOW_DURABLE_STATE_INTEGRATION',
  'D5D_R_PRODUCTION_SMOKE=POSTPONED_BY_OWNER',
  'D5E_DOES_NOT_DEPEND_ON_D5D_R_PRODUCTION_EXECUTION',
  'D5E_PRODUCTION_WRITE=NONE',
  'D2_STORE_REUSED=YES',
  'D3_RECONCILER_REUSED=YES',
  'D5B_RUNNER_REUSED=YES',
  'DETERMINISTIC_JOB_ID=YES',
  'SOURCE_CONVERGENCE=YES',
  'IMMUTABLE_COMMIT_PLAN=YES',
  'OPTIMISTIC_CONCURRENCY=YES',
  'IDEMPOTENT_RERUN=YES',
  'AUDIT_APPEND_ONLY=YES',
  'REPAIR_POLICY=REPORT_ONLY',
  'RAW_GMAIL_ID_PERSISTED=NO',
  'RAW_DRIVE_ID_PERSISTED=NO',
  'INVOICE_PII_PERSISTED=NO',
  'SOURCE_PAYLOAD_PERSISTED=NO',
  'PRODUCTION_FIRESTORE_ACCESS=NONE',
  'SCANNER_RUNTIME_WIRING=NOT_STARTED',
  'MAIN_RUNTIME_WIRING=NOT_STARTED',
  'SGDS_CRIT_003_STATUS=NOT_FIXED'
];
for (const marker of requiredDocMarkers) {
  assert.match(phaseDoc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5E phase doc missing marker: ${marker}`);
}

const requiredSecurityMarkers = [
  'D5E_FIRESTORE_SHADOW_STATE_SECURITY_DESIGN_STATUS=DRAFT_LOCAL_NOT_DEPLOYED',
  'CLIENT_FRONTEND_READ_ONLY=YES',
  'ANONYMOUS_ACCESS=NO',
  'DIRECT_CLIENT_WRITES=NO',
  'GAS_SERVICE_IDENTITY_FUTURE_WRITES_ONLY=YES',
  'APPEND_ONLY_EVENTS=YES',
  'IMMUTABLE_COMMIT_PLAN=YES',
  'OWNER_ADMIN_FINDING_ACCESS=YES',
  'PRODUCTION_FIRESTORE_CREDENTIAL=NOT_CONFIGURED',
  'FIRESTORE_RULES_DEPLOY=NOT_RUN',
  'TTL_DEPLOY=NOT_RUN'
];
for (const marker of requiredSecurityMarkers) {
  assert.match(securityDoc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5E security doc missing marker: ${marker}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5e'],
  'node scripts/checkers/check-sgds-crit-003-d5e-shadow-durable-state-integration.mjs',
  'package command check:sgds-crit-003-d5e missing or changed'
);

console.log('SGDS_CRIT_003_D5E_CHECK=PASS');