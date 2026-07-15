import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const docPath = 'docs/phases/SGDS_CRIT_003_D4_DURABLE_SCANNER_INTEGRATION_DESIGN.md';
const doc = read(docPath);
const packageJson = JSON.parse(read('package.json'));

const required = [
  'CURRENT_GMAIL_DISCOVERY_ENTRYPOINT=main -> _mainInternal_ -> scanInvoiceOutEmails_;scanInvoiceInEmails_',
  'CURRENT_DRIVE_DISCOVERY_ENTRYPOINT=triggerScanInvoiceDriveFolder -> scanFilesInFolder_',
  'CURRENT_SINGLE_INVOICE_PROCESSOR=processInvoiceXMLAttachment_;parseInvoiceXMLFile_',
  'CURRENT_COMMIT_CORE=prepareInvoiceRowsForCommit_;commitPreparedInvoiceRows_',
  'CURRENT_DRIVE_EVIDENCE_WRITER=saveInvoiceXmlToDrive_;saveInvoicePdfToDrive_',
  'CURRENT_HOA_DON_WRITER=upsertHoaDonFile_',
  'CURRENT_LEDGER_WRITER=writeInvoicesToSheet_',
  'CURRENT_GMAIL_LABEL_PROJECTOR=projectCommitLabelsByThread_;setExclusiveLabel_',
  'SAME_INVOICE_FROM_GMAIL_AND_DRIVE=SAME_DURABLE_JOB',
  'DURABLE_STATE_MAPPING=COMPLETE',
  'MUTATION_ORDER_SELECTED=Drive -> Hoa-Don -> Nhap-Xuat -> Gmail saved-label projection',
  'Commit-Step Contracts',
  'MULTI_LINE_ATOMICITY_DESIGN=COMPLETE',
  'OPTIMISTIC_CONCURRENCY_DESIGN=COMPLETE',
  'UNKNOWN_OUTCOME_POLICY=RECONCILIATION_REQUIRED',
  'Batch Scanner Behavior',
  'GMAIL_LABEL_PROJECTION_RULE=saved label only after verified ledger commit',
  'RECONCILIATION_HANDOFF=DESIGNED',
  'LEGACY_COMPATIBILITY=DESIGNED',
  'FAILURE_MATRIX_CASE_COUNT=20',
  'ROLLOUT_SLICE_COUNT=6',
  'RELEASE_GATE_COUNT=12'
];

for (const marker of required) {
  assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D4 design missing marker: ${marker}`);
}

const stateRows = [
  'candidate discovered',
  'job created',
  'source loaded',
  'XML parsed',
  'invoice validated',
  'commit plan persisted',
  'Drive evidence persisted',
  'Hoa-Don row persisted',
  'Nhap-Xuat rows persisted',
  'Gmail label projected',
  'post-commit verified',
  'completed',
  'failed before mutation',
  'outcome unknown after mutation',
  'reconciliation required'
];
for (const row of stateRows) assert.match(doc, new RegExp(row, 'i'), `state mapping missing: ${row}`);

const commitSteps = [
  'DRIVE_XML_WRITE',
  'DRIVE_PDF_WRITE',
  'HOA_DON_WRITE',
  'LEDGER_MULTI_LINE_WRITE',
  'GMAIL_SAVED_LABEL_PROJECTION'
];
for (const step of commitSteps) assert.match(doc, new RegExp(step), `commit step missing: ${step}`);

const failureCases = [
  'failure before job create',
  'failure after job create',
  'failure after parse',
  'failure after plan persist',
  'failure during XML Drive write',
  'failure after XML write response lost',
  'failure during PDF write',
  'failure during Hoa-Don write',
  'failure after Hoa-Don response lost',
  'failure before ledger append',
  'partial ledger append',
  'ledger append succeeded response lost',
  'post-ledger verification mismatch',
  'Gmail label write failed',
  'Gmail label succeeded response lost',
  'audit-event append failed',
  'Firestore state transition failed',
  'version conflict',
  'scanner timeout',
  'duplicate scanner execution'
];
for (const item of failureCases) assert.match(doc, new RegExp(item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `failure matrix missing: ${item}`);

const forbiddenApprovals = [
  'RUNTIME_SCANNER_WIRING=APPROVED',
  'PRODUCTION_FIRESTORE_ACCESS=APPROVED',
  'AUTOMATIC_REPAIR=ENABLED',
  'BATCH_ACTIVATION=APPROVED',
  'HISTORICAL_BACKFILL=APPROVED',
  'PRODUCTION_MUTATION=APPROVED'
];
for (const forbidden of forbiddenApprovals) assert.doesNotMatch(doc, new RegExp(forbidden), `D4 design accidentally approves forbidden scope: ${forbidden}`);

assert.match(doc, /RUNTIME_SCANNER_WIRING=NOT_APPROVED/, 'runtime scanner wiring non-approval missing');
assert.match(doc, /PRODUCTION_FIRESTORE_ACCESS=NONE/, 'production Firestore non-approval missing');
assert.match(doc, /AUTOMATIC_REPAIR=DISABLED/, 'automatic repair disabled marker missing');
assert.match(doc, /BATCH_ACTIVATION=NOT_APPROVED/, 'batch activation non-approval missing');
assert.match(doc, /HISTORICAL_BACKFILL=NOT_APPROVED/, 'historical backfill non-approval missing');
assert.match(doc, /PRODUCTION_MUTATION=NONE/, 'production mutation none marker missing');

const runtimeFiles = ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js', 'hashUtils.js', 'sheetWriter.js', 'sheetHoaDon.js'];
for (const file of runtimeFiles) {
  const text = read(file);
  assert.doesNotMatch(text, /createDurableInvoiceJobStore|D4_DURABLE_SCANNER_INTEGRATION|D5A_LOCAL_DURABLE_ORCHESTRATION/, `D4 checker detected runtime wiring in ${file}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d4'],
  'node scripts/checkers/check-sgds-crit-003-d4-scanner-integration-design.mjs',
  'package command check:sgds-crit-003-d4 missing or changed'
);

console.log('SGDS_CRIT_003_D4_CHECK=PASS');