import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = Object.freeze({
  source: 'D7_E4D_ValidatedJobRecoveryEligibility.js',
  test: 'tests/unit/d7-e4d-validated-job-recovery-eligibility.test.mjs',
  docs: 'docs/phases/D7_E4D_VALIDATED_JOB_RECOVERY_ELIGIBILITY.md',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

function read(path) {
  assert.equal(fs.existsSync(path), true, `missing ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function main() {
  const source = read(files.source);
  const test = read(files.test);
  const docs = read(files.docs);
  const packageJson = JSON.parse(read(files.packageJson));
  const aggregate = read(files.aggregate);

  for (const id of Array.from({ length: 27 }, (_, index) => `R${String(index + 1).padStart(2, '0')}`)) assert.match(source, new RegExp(`'${id}'`));
  for (const id of Array.from({ length: 7 }, (_, index) => `C${String(index + 1).padStart(2, '0')}`)) assert.match(source, new RegExp(`'${id}'`));
  for (const token of ['PRESERVE_EXISTING_JOB_ID', 'BLOCKED_RECOVERY_EVIDENCE', 'BLOCKED_RUNTIME_CAPABILITY_GAP', 'READY_FOR_LOCAL_RUNTIME_IMPLEMENTATION', 'INVENTORY_PENDING', "productionExecutionAuthorized: 'NO'"]) assert.match(source, new RegExp(token));
  for (const forbidden of ['LockService', 'PropertiesService', 'UrlFetchApp', 'GmailApp', 'DriveApp', 'SpreadsheetApp', 'ScriptApp']) assert.doesNotMatch(source, new RegExp(`\\b${forbidden}\\b`));
  assert.doesNotMatch(source, /^function\s+runD7E4D/m);
  for (const marker of ['MODE=LOCAL_ONLY_PURE_ELIGIBILITY_NO_SERVICE_CALLS', 'CURRENT_EVIDENCE_ELIGIBILITY=PASS_27_OF_27', 'CURRENT_RUNTIME_CAPABILITY=BLOCKED_0_OF_7', 'PRODUCTION_EXECUTION_AUTHORIZED=NO']) assert.match(docs, new RegExp(marker));
  assert.match(test, /same-job eligible but runtime remains fail-closed/);
  assert.equal(packageJson.scripts['check:d7-e4d-validated-job-recovery-eligibility'], 'node scripts/checkers/check-d7-e4d-validated-job-recovery-eligibility.mjs');
  assert.match(aggregate, /check-d7-e4d-validated-job-recovery-eligibility\.mjs/);
  execFileSync('node', ['--test', files.test], { stdio: 'inherit' });
  console.log('D7_E4D_VALIDATED_JOB_RECOVERY_ELIGIBILITY_CHECK=PASS');
}

main();
