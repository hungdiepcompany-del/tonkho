import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const files = Object.freeze({
  source: 'D7_E4E_ValidatedJobRecoveryRuntime.js',
  inventoryWriter: 'sheetTonKho.js',
  test: 'tests/unit/d7-e4e-validated-job-recovery-runtime.test.mjs',
  docs: 'docs/phases/D7_E4E_VALIDATED_JOB_RECOVERY_RUNTIME.md',
  packageJson: 'package.json',
  aggregate: 'scripts/test/run-all-checks.mjs'
});

function read(path) {
  assert.equal(fs.existsSync(path), true, `missing ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function main() {
  const source = read(files.source);
  const inventoryWriter = read(files.inventoryWriter);
  const test = read(files.test);
  const docs = read(files.docs);
  const packageJson = JSON.parse(read(files.packageJson));
  const aggregate = read(files.aggregate);

  for (const token of [
    'runD7E4EValidatedJobRecovery',
    'createD7E4EValidatedJobRecoveryRunner_',
    'D7_E4E_OWNER_APPROVAL_MARKER',
    'OWNER_APPROVED_D7_E4E_EXACT_SAME_JOB_RECOVERY_ONCE_V1',
    'PENDING_LATE_COMPLETION_QUARANTINE',
    'SAME_JOB_RECOVERY_COMPLETED',
    'NO_LOCAL_IMPLEMENTATION_ONLY'
  ]) assert.match(source, new RegExp(token));

  const orderedStates = ['VALIDATED', 'FILES_SAVED', 'COMMITTING', 'ROWS_COMMITTED', 'INVENTORY_PENDING', 'PROJECTIONS_COMMITTED', 'COMPLETED'];
  let cursor = -1;
  for (const state of orderedStates) {
    const next = source.indexOf(`'${state}'`, cursor + 1);
    assert.ok(next > cursor, `state path order missing ${state}`);
    cursor = next;
  }

  for (const capability of [
    'sameJobValidatedResumeSupported',
    'currentIdentityContractSupported',
    'hoaDonAdapterAvailable',
    'inventoryAdapterAvailable',
    'gmailProjectionAdapterAvailable',
    'exactWriteBudgetDesigned',
    'oneShotMarkerLifecycleDesigned'
  ]) assert.match(source, new RegExp(`${capability}: true`));

  for (const forbidden of ['createJobIfAbsent', 'createAttachmentRecordIfAbsent', 'saveReconciliationReport', 'runD7EOwnerApprovedOneCandidateProductionPilot']) assert.doesNotMatch(source, new RegExp(`\\b${forbidden}\\b`));
  assert.ok(source.indexOf('markerLifecycle.claim') < source.indexOf('reacquireReconciliationLease'));
  assert.ok(source.indexOf("'INVENTORY_PENDING', 'PROJECTIONS_COMMITTED'") > source.indexOf("'ROWS_COMMITTED', 'INVENTORY_PENDING'"));
  assert.match(source, /store\.deleteProperty\(request\.propertyName\)/);
  assert.match(source, /if \(activeLease && leaseStore && !leaseFinalized && !unknown\)/);
  assert.match(source, /async function invokeD7E4EMutation_/);
  assert.match(source, /function assertD7E4EConfirmedAdapterResponse_/);
  assert.match(source, /function createD7E4EFreshReadOnlyVerifier_/);
  assert.match(source, /verifyD7E4EDriveReadOnly_/);
  assert.match(source, /verifyD7E4EHoaDonReadOnly_/);
  assert.match(source, /verifyD7E4ELedgerReadOnly_/);
  assert.match(source, /verifyD7E4EInventoryReadOnly_/);
  assert.match(source, /function assertD7E4EInventoryCutoffReadback_/);
  assert.match(source, /inventorySheet\.getRange\('H6'\)\.getValue\(\)/);
  assert.match(source, /BLOCKED_D7_E4E_INVENTORY_CUTOFF_READBACK_INVALID/);
  assert.match(source, /BLOCKED_D7_E4E_INVENTORY_CUTOFF_READBACK_DRIFT/);
  assert.match(source, /actual\.getTime\(\) !== expected\.getTime\(\)/);
  assert.match(source, /verifyD7E4EGmailReadOnly_/);
  assert.match(source, /function parseD7E4EInventoryDateMs_/);
  assert.match(source, /function normalizeD7E4EInventoryDate_/);
  assert.match(source, /parseInvoiceDateValue_\(value\)/);
  assert.match(source, /BLOCKED_D7_E4E_INVENTORY_CUTOFF_INVALID/);
  assert.match(source, /capNhatTonKho\(cutoff, runId\)/);
  assert.doesNotMatch(source, /capNhatTonKho\(plan\.ledgerRows\[0\]\.issueDate, runId\)/);
  assert.doesNotMatch(source, /new Date\(row\[1\]\)\.getTime\(\)/);
  assert.doesNotMatch(source, /Object\.keys\(verification\)\.every/);
  assert.match(source, /BLOCKED_D7_E4E_GMAIL_THREAD_IDENTITY_NOT_EXACT/);
  assert.match(source, /hashPrefixD7B_\(sha256D7BText_\(threadId\), 16\)/);
  assert.doesNotMatch(source, /threads\[context\.precheck\.candidate\.threadIndex\]/);
  assert.match(source, /CONFIRMED_NOT_WRITTEN/);
  assert.match(inventoryWriter, /function normalizeTonKhoCutoff_/);
  assert.match(inventoryWriter, /const normalizedCutoff = normalizeTonKhoCutoff_\(ngayDen\)/);
  assert.ok(inventoryWriter.indexOf('const normalizedCutoff = normalizeTonKhoCutoff_(ngayDen);') < inventoryWriter.indexOf('if (lastRowNX < 2)'), 'CUTOFF_VALIDATION_PRECEDES_ZERO_ROW_COMPLETION_REQUIRED');
  assert.match(inventoryWriter, /if \(normalizedCutoff && issueDate > normalizedCutoff\) return/);
  assert.match(inventoryWriter, /const ngayCapNhat = normalizedCutoff \|\| ngayMax/);
  assert.doesNotMatch(inventoryWriter, /row\[1\] instanceof Date \? row\[1\] : null/);

  for (const marker of [
    'MODE=LOCAL_RUNTIME_IMPLEMENTED_NOT_SYNCED_NOT_EXECUTED',
    'CAPABILITY_STATUS=PASS_7_OF_7',
    'JOB_DISPOSITION=PRESERVE_EXISTING_JOB_ID',
    'PRODUCTION_EXECUTION_AUTHORIZED=NO',
    'SOURCE_SYNC=NO'
  ]) assert.match(docs, new RegExp(marker));

  assert.match(test, /unknown write outcome enters quarantine/);
  assert.match(test, /native adapter exception is quarantined/);
  assert.match(test, /resolved .* adapter response is quarantined/);
  assert.match(test, /resolved unconfirmed later adapter response cannot advance/);
  assert.match(test, /PASS adapter response with .* mutation count is quarantined/);
  assert.match(test, /unconfirmed audit response quarantines the completed job/);
  assert.match(test, /Gmail projection fences a reordered search result to the exact thread identity/);
  assert.match(test, /Gmail projection blocks identity drift before any label mutation/);
  assert.match(test, /unknown lease close outcome promotes a known failure to quarantine/);
  assert.match(test, /failure lease close response promotes the result to quarantine/);
  assert.match(test, /final verifier executes all five fresh read-only checks/);
  assert.match(test, /final verifier blocks when any fresh read-only check is not confirmed/);
  assert.match(test, /fresh inventory verification recomputes and accepts an exact snapshot/);
  assert.match(test, /fresh inventory verification accepts valid day-first source dates/);
  assert.match(test, /fresh inventory verification applies a supported string cutoff/);
  assert.match(test, /fresh inventory verification rejects an invalid cutoff/);
  assert.match(test, /exact TonKho H6 passes fresh inventory verification/);
  assert.match(test, /H6-only drift blocks final inventory verification/);
  assert.match(test, /fresh inventory verification rejects blank or invalid TonKho H6/);
  assert.match(test, /invalid cutoff with zero invoice rows is rejected before COMPLETED/);
  assert.match(test, /inventory adapter passes a normalized Date cutoff to capNhatTonKho/);
  assert.match(test, /inventory adapter rejects an invalid cutoff before capNhatTonKho/);
  assert.match(test, /fresh inventory verification blocks a drifted snapshot/);
  assert.match(test, /real inventory writer and final verifier share Date, ISO, and day-first cutoff semantics/);
  assert.match(test, /real inventory writer rejects an invalid cutoff and retains no-cutoff full rebuild behavior/);
  assert.match(test, /requires no create-job or new-attempt API/);
  assert.equal(packageJson.scripts['check:d7-e4e-validated-job-recovery-runtime'], 'node scripts/checkers/check-d7-e4e-validated-job-recovery-runtime.mjs');
  assert.match(aggregate, /check-d7-e4e-validated-job-recovery-runtime\.mjs/);
  execFileSync('node', ['--test', files.test], { stdio: 'inherit' });
  console.log('D7_E4E_VALIDATED_JOB_RECOVERY_RUNTIME_CHECK=PASS');
}

main();
