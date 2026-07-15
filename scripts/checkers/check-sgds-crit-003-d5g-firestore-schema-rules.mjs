import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const docPath = 'docs/phases/SGDS_CRIT_003_D5G_FIRESTORE_SCHEMA_RULES_RETENTION.md';
const rulesPath = 'firestore.rules';
const indexesPath = 'firestore.indexes.json';
const schemaPath = 'firestoreShadowStateValidator.js';

const doc = read(docPath);
const rules = read(rulesPath);
const indexes = JSON.parse(read(indexesPath));
const schema = read(schemaPath);

const requiredDocMarkers = [
  'D5G_SCHEMA_RULES_STATUS=PASS',
  'COLLECTION_SCHEMA=invoiceJobs/{jobId};invoiceJobs/{jobId}/events/{eventId};invoiceJobs/{jobId}/reconciliationReports/{reportId}',
  'IMMUTABLE_COMMIT_PLAN_RULE=YES',
  'APPEND_ONLY_EVENTS=YES',
  'REPORT_ONLY_RECONCILIATION=YES',
  'CLIENT_WRITE_POLICY=DENY',
  'ANONYMOUS_ACCESS_POLICY=DENY',
  'ADMIN_SDK_RULES_BYPASS_ACKNOWLEDGED=YES',
  'BACKEND_ALLOWLIST_ENFORCEMENT_REQUIRED=YES',
  'FIRESTORE_RULES_DEPLOY=NOT_RUN',
  'FIRESTORE_INDEX_DEPLOY=NOT_RUN',
  'TTL_ENABLEMENT=NOT_RUN',
  'RAW_GMAIL_ID_PERSISTED=NO',
  'RAW_DRIVE_ID_PERSISTED=NO',
  'INVOICE_PII_PERSISTED=NO',
  'XML_PERSISTED=NO',
  'PDF_PERSISTED=NO'
];
for (const marker of requiredDocMarkers) {
  assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5G doc missing marker: ${marker}`);
}

assert.match(rules, /match \/invoiceJobs\/\{jobId\}/, 'rules missing invoiceJobs path');
assert.match(rules, /allow read: if sgdsD5fD5iClientReadsDeniedByDefault\(\)/, 'rules must deny default frontend reads');
assert.match(rules, /allow create, update, delete: if sgdsD5fD5iClientWritesDenied\(\)/, 'rules must deny client writes');
assert.match(rules, /allow read, write: if false/, 'rules missing catch-all deny');

const indexFields = indexes.indexes.map(index => index.fields.map(field => field.fieldPath).join('+'));
for (const expected of ['status+updatedAt', 'executionMode+updatedAt', 'latestReconciliationStatus+updatedAt', 'invoiceIdentityHash', 'retentionClass+updatedAt']) {
  assert.equal(indexFields.includes(expected), true, `missing Firestore index: ${expected}`);
}

for (const marker of ['maximumJobDocumentBytes', 'maximumSafeDetailsBytes', 'maximumFindingCodes', 'maximumProvenanceHashes', 'maximumCommitPlanLines', 'maximumEventCountPerBatch']) {
  assert.match(schema, new RegExp(marker), `D5G schema missing limit: ${marker}`);
}

console.log('SGDS_CRIT_003_D5G_CHECK=PASS');
