import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const docPath = 'docs/phases/SGDS_CRIT_003_D5F_PRODUCTION_FIRESTORE_SHADOW_WRITE_REVIEW.md';
const schemaPath = 'firestoreShadowStateValidator.js';
const adapterPath = 'firestoreEmulatorDurableShadowIntegration.js';

const doc = read(docPath);
const schema = read(schemaPath);
const adapter = read(adapterPath);
const joined = `${schema}\n${adapter}`;

const requiredDocMarkers = [
  'D5F_REVIEW_STATUS=PASS',
  'PRODUCTION_FIRESTORE_PROJECT_ID=UNCONFIRMED',
  'PRODUCTION_FIRESTORE_WRITE=NONE',
  'FIRESTORE_RULES_DEPLOY=NOT_RUN',
  'SHADOW_WRITE_SCOPE=invoiceJobs;events;reconciliationReports;safe source projections',
  'GOOGLE_SHEETS_CANONICAL_LEDGER=PRESERVED',
  'GOOGLE_DRIVE_EVIDENCE_STORE=PRESERVED',
  'GMAIL_SOURCE=PRESERVED',
  'APPROVED_FIELD_ALLOWLIST=DEFINED',
  'FORBIDDEN_FIELD_LIST=DEFINED',
  'DOCUMENT_PATH_CONTRACT=invoiceJobs/{jobId};invoiceJobs/{jobId}/events/{eventId};invoiceJobs/{jobId}/reconciliationReports/{reportId}',
  'IDEMPOTENCY_CONTRACT=DETERMINISTIC_JOB_ID_AND_IDEMPOTENCY_KEYS',
  'VERSIONING_CONTRACT=OPTIMISTIC_VERSION_PLUS_IMMUTABLE_COMMIT_PLAN',
  'ONE_JOB_SMOKE_BOUNDARY=ONE_JOB_ONLY',
  'OWNER_EVIDENCE_REQUIRED_BEFORE_PRODUCTION_EXECUTION=YES',
  'AUTOMATIC_REPAIR=DISABLED',
  'SGDS_CRIT_003_STATUS=NOT_FIXED'
];
for (const marker of requiredDocMarkers) {
  assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5F doc missing marker: ${marker}`);
}

const requiredSchemaMarkers = [
  'SGDS_D5F_D5I_JOB_FIELD_ALLOWLIST_',
  'SGDS_D5F_D5I_FORBIDDEN_FIELD_PATTERNS_',
  'SGDS_D5F_D5I_COLLECTION_PATHS_',
  'SGDS_D5F_D5I_PRODUCTION_MUTATION_ALLOWED_',
  'SGDS_D5F_D5I_REPAIR_POLICY_',
  'createFirestoreShadowStateValidator',
  'validateJobDocument',
  'validateAuditEvent',
  'validateReconciliationReport',
  'FIRESTORE_SHADOW_PRODUCTION_MUTATION_DENIED',
  'FIRESTORE_SHADOW_PRODUCTION_STATE_DENIED'
];
for (const marker of requiredSchemaMarkers) {
  assert.match(schema, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5F schema missing marker: ${marker}`);
}

for (const token of ['GmailApp', 'DriveApp', 'SpreadsheetApp', 'UrlFetchApp', 'PropertiesService', 'FirestoreApp', 'getFirestore', 'initializeApp', 'firebaseConfig', 'automaticRepair', 'mainRun', 'scanInvoiceOutEmails_', 'scanInvoiceInEmails_']) {
  assert.equal(joined.includes(token), false, `D5F implementation contains forbidden production token: ${token}`);
}

console.log('SGDS_CRIT_003_D5F_CHECK=PASS');
