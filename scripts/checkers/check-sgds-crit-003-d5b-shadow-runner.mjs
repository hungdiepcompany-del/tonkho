import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const sourcePath = 'durableScannerShadowRunner.js';
const testPath = 'tests/unit/durable-scanner-shadow-runner.test.mjs';
const fixturePath = 'fixtures/durable-shadow/fake-durable-shadow.mjs';
const docPath = 'docs/phases/SGDS_CRIT_003_D5B_LOCAL_SHADOW_RUNNER.md';

const source = read(sourcePath);
const tests = read(testPath);
const fixture = read(fixturePath);
const doc = fs.existsSync(docPath) ? read(docPath) : '';
const packageJson = JSON.parse(read('package.json'));

const requiredSourceMarkers = [
  'const D5B_LOCAL_SHADOW_ONLY = true',
  'const D5B_EXECUTION_MODE_ = \'SHADOW\'',
  'const D5B_PRODUCTION_MUTATION_ALLOWED_ = false',
  'function createDurableScannerShadowRunner',
  'runShadowDiscoveryBatch',
  'evaluateShadowCandidate',
  'gmailCandidateAdapter',
  'driveCandidateAdapter',
  'sourceNormalizer',
  'identityBuilder',
  'commitPlanBuilder',
  'jobStore',
  'reconciliationService',
  'saveCommitPlanIfAbsent',
  'reconcileDurableInvoiceJobReportOnly',
  'sourceConvergenceStatus: \'PREVIEW\'',
  'productionMutationAllowed: false',
  'mutationAttemptCount: 0',
  'COMMIT_PLAN_MISMATCH',
  'D5B_WOULD_MUTATE_STEPS_',
  'compareD5BCandidates_',
  'deterministicD5BJobId_'
];
for (const marker of requiredSourceMarkers) {
  assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5B source missing marker: ${marker}`);
}

const requiredStatuses = [
  'SHADOW_READY',
  'SHADOW_ALREADY_SEEN',
  'SHADOW_DUPLICATE_SOURCE',
  'SHADOW_CONFLICT',
  'SHADOW_REVIEW_REQUIRED',
  'SHADOW_FAILED'
];
for (const status of requiredStatuses) assert.match(source, new RegExp(status), `D5B status missing: ${status}`);

const forbiddenSourceTokens = [
  'GmailApp',
  'DriveApp',
  'SpreadsheetApp',
  'PropertiesService',
  'UrlFetchApp',
  'firebaseConfig',
  'main(',
  'mainRun',
  'commitPreparedInvoiceRows',
  'applySavedLabel',
  'automatic repair'
];
for (const token of forbiddenSourceTokens) {
  assert.equal(source.includes(token), false, `D5B source contains forbidden production/wiring token: ${token}`);
}

const runtimeFiles = ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js', 'hashUtils.js', 'sheetWriter.js', 'sheetHoaDon.js'];
for (const file of runtimeFiles) {
  const text = read(file);
  assert.doesNotMatch(text, /durableScannerShadowRunner|createDurableScannerShadowRunner|D5B_LOCAL_SHADOW_RUNNER/, `D5B checker detected runtime wiring in ${file}`);
}

const requiredTestMarkers = [
  'D5B_TEST_SCENARIOS.length, 19',
  'D5B_FAULT_INJECTION_CASES.length, 6',
  'one Gmail candidate and one Drive candidate without mutation',
  'converges same Gmail and Drive invoice to one deterministic job',
  'duplicate Gmail and Drive discovery collapses',
  'parse failure does not stop batch',
  'batch limit is enforced',
  'commit-plan preview includes multi-line expected count',
  'report-only reconciliation preview',
  'same candidate rerun is idempotent',
  'terminal/reconciliation jobs are skipped',
  'commit-plan mismatch and conflicting identity produce review required',
  'fault injection covers source, identity, store, and reconciliation failures',
  'zero mutation adapter calls',
  'zero external API calls',
  'no scanner wiring',
  'same suite run twice is deterministic'
];
for (const marker of requiredTestMarkers) assert.match(tests, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5B tests missing marker: ${marker}`);

const requiredFixtureMarkers = [
  'D5B_TEST_SCENARIOS',
  'D5B_FAULT_INJECTION_CASES',
  'createD5BShadowFixtures',
  'gmailCandidateAdapter',
  'driveCandidateAdapter',
  'sourceNormalizer',
  'identityBuilder',
  'mutationAdapterSentinel',
  'writeXmlIfAbsent',
  'appendInvoiceLinesIfAbsent',
  'GMAIL_DISCOVERY',
  'DRIVE_DISCOVERY',
  'SOURCE_LOAD',
  'PARSE',
  'IDENTITY_BUILD',
  'RESPONSE_LOST'
];
for (const marker of requiredFixtureMarkers) assert.match(fixture, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5B fixture missing marker: ${marker}`);

const requiredDocMarkers = [
  'SGDS_CRIT_003_D5B_STATUS=PASS_LOCAL_SHADOW_RUNNER',
  'D5B_MODE=LOCAL_SHADOW_ONLY',
  'EXECUTION_MODE=SHADOW',
  'PRODUCTION_MUTATION_ALLOWED=NO',
  'PRODUCTION_READ=NONE',
  'PRODUCTION_WRITE=NONE',
  'PRODUCTION_FIRESTORE_ACCESS=NONE',
  'SCANNER_RUNTIME_WIRING=NOT_STARTED',
  'MAIN_RUNTIME_WIRING=NOT_STARTED',
  'MUTATION_ATTEMPT_COUNT=0',
  'AUTOMATIC_REPAIR=DISABLED',
  'SOURCE_CONVERGENCE=YES',
  'DETERMINISTIC_JOB_ID=YES',
  'COMMIT_PLAN_PREVIEW=YES',
  'RECONCILIATION_PREVIEW=REPORT_ONLY',
  'BATCH_ISOLATION=YES',
  'DETERMINISTIC_ORDERING=YES',
  'TEST_SCENARIO_COUNT=19',
  'FAULT_INJECTION_CASE_COUNT=6',
  'SGDS_CRIT_003_STATUS=NOT_FIXED',
  'NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5C_PRODUCTION_READ_ONLY_SNAPSHOT_ADAPTERS'
];
for (const marker of requiredDocMarkers) assert.match(doc, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `D5B doc missing marker: ${marker}`);

assert.equal(
  packageJson.scripts['check:sgds-crit-003-d5b'],
  'node scripts/checkers/check-sgds-crit-003-d5b-shadow-runner.mjs',
  'package command check:sgds-crit-003-d5b missing or changed'
);

console.log('SGDS_CRIT_003_D5B_CHECK=PASS');
