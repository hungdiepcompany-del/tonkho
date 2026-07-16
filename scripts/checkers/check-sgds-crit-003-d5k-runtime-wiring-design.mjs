import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = file => fs.readFileSync(file, 'utf8');
const runtimeDoc = read('docs/phases/SGDS_CRIT_003_D5K_PRODUCTION_SHADOW_RUNTIME_WIRING_DESIGN.md');
const iamDoc = read('docs/phases/SGDS_CRIT_003_D5K_CREDENTIAL_IAM_DESIGN.md');
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'D5K_RUNTIME_WIRING_DESIGN_STATUS=PASS',
  'D5K_SCOPE=DESIGN_DOCS_CHECKER_ONLY',
  'D5K_RUNTIME_ACTIVATION=NOT_RUN',
  'SCANNER_RUNTIME_WIRING=NOT_STARTED',
  'MAIN_RUNTIME_WIRING=NOT_STARTED',
  'FIREBASE_DEPLOY=NOT_RUN',
  'CLASP_PUSH=NOT_RUN',
  'FUTURE_RUNTIME_MODE=SHADOW_ONLY',
  'COMMIT_PLAN_BEFORE_MUTATION=YES',
  'REPORT_ONLY_RECONCILIATION_REQUIRED=YES',
  'AUTOMATIC_REPAIR=DISABLED'
]) {
  assert.match(runtimeDoc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5K runtime doc missing marker: ${marker}`);
}

for (const marker of [
  'D5K_CREDENTIAL_IAM_DESIGN_STATUS=PASS',
  'D5K_LONG_LIVED_CREDENTIAL_KEY_CREATED=NO',
  'D5K_IAM_CHANGED=NO',
  'LONG_LIVED_CREDENTIAL_KEY_FILE_CREATION=FORBIDDEN',
  'IAM_CHANGE_IN_THIS_PHASE=NO',
  'DEFAULT_LONGTHAI_CONFIGURATION_MODIFIED=NO',
  'GCLOUD_CONFIGURATION_REQUIRED=sgds-hungdiep',
  'EXPECTED_ACCOUNT=hungdiepcompany@gmail.com',
  'FORBIDDEN_ACCOUNT_DOMAIN=longthaisteel.com',
  'TOKEN_VALUES_CAPTURED=NO',
  'CREDENTIAL_VALUES_COMMITTED=NO'
]) {
  assert.match(iamDoc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5K IAM doc missing marker: ${marker}`);
}

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5k'],
  'node scripts/checkers/check-sgds-crit-003-d5k-runtime-wiring-design.mjs'
);

console.log('SGDS_CRIT_003_D5K_CHECK=PASS');
