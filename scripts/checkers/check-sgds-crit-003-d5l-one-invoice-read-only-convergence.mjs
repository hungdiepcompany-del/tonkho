import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const doc = read('docs/phases/SGDS_CRIT_003_D5L_ONE_INVOICE_READ_ONLY_SOURCE_CONVERGENCE_DESIGN.md');
const runbook = read('docs/runbooks/SGDS_CRIT_003_D5L_ONE_INVOICE_READ_ONLY_SHADOW_SMOKE.md');
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'D5L_SOURCE_CONVERGENCE_DESIGN_STATUS=PASS',
  'D5L_SCOPE=DESIGN_DOCS_CHECKER_ONLY',
  'D5L_SOURCE_READ_EXECUTED=NO',
  'D5L_SOURCE_MUTATION_EXECUTED=NO',
  'D5L_ROLLOUT_PLAN=DEFINED',
  'D5L_ROLLBACK_PLAN=DEFINED',
  'READ_ONLY_SOURCE_CONVERGENCE=YES',
  'GMAIL_LABEL_MUTATION=NO',
  'DRIVE_FILE_MUTATION=NO',
  'SHEET_CELL_EDIT=NO',
  'FIRESTORE_REPAIR=NONE',
  'RAW_THREAD_ID_COMMITTED=NO',
  'RAW_DRIVE_ID_COMMITTED=NO',
  'INVOICE_PII_COMMITTED=NO'
]) {
  assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5L doc missing marker: ${marker}`);
}

for (const marker of [
  'D5L_ONE_INVOICE_RUNBOOK=READY',
  'ONE_INVOICE_ONLY=YES',
  'READ_ONLY_ONLY=YES',
  'SOURCE_MUTATION=NONE',
  'FIRESTORE_REPAIR=NONE',
  'GMAIL_LABEL_MUTATION=NO',
  'DRIVE_FILE_MUTATION=NO',
  'SHEET_CELL_EDIT=NO',
  'FIRESTORE_WRITE=NONE',
  'MAIN_SCANNER_RUN=NO',
  'BATCH_PROCESSING=NO',
  'REPAIR_RUN=NO'
]) {
  assert.match(runbook, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5L runbook missing marker: ${marker}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5l'],
  'node scripts/checkers/check-sgds-crit-003-d5l-one-invoice-read-only-convergence.mjs'
);

console.log('SGDS_CRIT_003_D5L_CHECK=PASS');
