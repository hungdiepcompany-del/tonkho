import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const files = {
  source: 'd6jD4PostRepairVerificationReadOnly.js',
  test: 'tests/unit/d6j-d4-post-repair-verification-read-only.test.mjs',
  packageJson: 'package.json',
  phaseDoc: 'docs/phases/D6J_D4C_FIRESTORE_JOB_PATH_CENSUS_AND_REPAIR_AUDIT_RECONCILIATION_DIAGNOSTICS.md',
  evidenceDoc: 'docs/evidence/D6J_D4C_FIRESTORE_JOB_PATH_CENSUS_AND_REPAIR_AUDIT_RECONCILIATION_DIAGNOSTICS_EVIDENCE.md'
};

Object.values(files).forEach(file => {
  assert.equal(exists(file), true, `missing D6J-D4C file: ${file}`);
});

const source = read(files.source);
const tests = read(files.test);
const docs = read(files.phaseDoc) + '\n' + read(files.evidenceDoc);
const packageJson = JSON.parse(read(files.packageJson));

for (const marker of [
  'runD6jD4CFirestoreEvidenceDiagnosticsReadOnly',
  'createD6jD4CFirestoreEvidenceDiagnosticsReadOnlyRunner_',
  'D6J_D4C_FIRESTORE_JOB_PATH_CENSUS_AND_REPAIR_AUDIT_RECONCILIATION_DIAGNOSTICS_V1',
  "D6J_D4C_LEGACY_JOB_COLLECTION_ = 'jobs'",
  "D6J_D4C_DURABLE_JOB_COLLECTION_ = 'invoiceJobs'",
  'buildD6jD4CPaths_',
  'recomputeD6jD4CJobId_',
  'EXPECTED_JOB_PATH',
  'ACTUAL_DURABLE_JOB_PATH',
  'ACTUAL_JOB_EVENTS_PATH',
  'ACTUAL_COMMIT_PLAN_PATH',
  'ACTUAL_RECONCILIATION_REPORT_PATH',
  'worker_leases/',
  'gmail_messages/',
  'attachments/',
  'REPAIR_AUDIT_COLLECTION_PATH',
  'D6J_D_SINGLE_ROW_REPAIR',
  'RECONCILIATION_REQUIRED_D6J_D4_ORIGINAL_JOB_NOT_FOUND',
  'BLOCKED_MULTIPLE_JOB_CANDIDATES',
  'PASS_EXPECTED_JOB_AND_AUDIT_FOUND',
  'RECONCILIATION_REQUIRED_JOB_MISSING_AUDIT_PRESENT',
  'RECONCILIATION_REQUIRED_JOB_PRESENT_AUDIT_MISSING',
  'RECONCILIATION_REQUIRED_JOB_AND_AUDIT_MISSING',
  'BLOCKED_FIRESTORE_READ_FAILED',
  "method: 'get'",
  'D6J_D4C_JOBS_SCAN_LIMIT_',
  'D6J_D4C_ALTERNATE_CANDIDATE_LIMIT_'
]) {
  assert.equal(source.includes(marker), true, `source missing D6J-D4C marker: ${marker}`);
}

for (const forbidden of [
  "method: 'post'",
  "method: 'patch'",
  "method: 'delete'",
  '.setValue(',
  '.setValues(',
  '.appendRow(',
  '.insertRow(',
  '.deleteRow(',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  '.setProperty(',
  '.deleteProperty(',
  'runD6jDRepairSingleMalformedPilotRow(',
  'runD6jCOneRecordProductionMutation(',
  '--force'
]) {
  assert.equal(source.includes(forbidden), false, `forbidden D6J-D4C source token: ${forbidden}`);
}

for (const marker of [
  'D6J-D4C exact expected job path found and actual durable path found with valid repair audit',
  'D6J-D4C exact expected job path 404 and lease exists while actual job is missing',
  'D6J-D4C job exists while repair audit is missing',
  'D6J-D4C both job and audit missing',
  'D6J-D4C alternate job candidate does not replace exact job',
  'D6J-D4C multiple alternate candidates block without choosing one',
  'D6J-D4C Firestore diagnostics use GET/LIST only and logs are sanitized',
  'D6J-D4 missing original job returns reconciliation required after Sheet verification',
  'RECONCILIATION_REQUIRED_D6J_D4_ORIGINAL_JOB_NOT_FOUND'
]) {
  assert.equal(tests.includes(marker), true, `tests missing D6J-D4C marker: ${marker}`);
}

for (const marker of [
  'PHASE=D6J_D4C_FIRESTORE_JOB_PATH_CENSUS_AND_REPAIR_AUDIT_RECONCILIATION_DIAGNOSTICS',
  'EXACT_PATH_CENSUS=PASS',
  'JOB_ID_RECOMPUTATION=PASS',
  'JOBS_COLLECTION_CENSUS=PASS',
  'LEASE_EVIDENCE_INSPECTION=PASS',
  'REPAIR_AUDIT_PATH_INSPECTION=PASS',
  'READ_ONLY_SAFETY=PASS',
  'D6J_D4C_ENTRYPOINT_EXECUTED=NO',
  'D6J_D4_ENTRYPOINT_EXECUTED=NO',
  'REPAIR_FUNCTION_EXECUTED=NO',
  'D6J_C_FUNCTION_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'NEXT_ACTION=OWNER_RUN_D6J_D4C_READ_ONLY_ONCE'
]) {
  assert.equal(docs.includes(marker), true, `docs missing D6J-D4C marker: ${marker}`);
}

assert.equal(
  packageJson.scripts['check:d6j-d4c-firestore-job-path-census'],
  'node scripts/checkers/check-d6j-d4c-firestore-job-path-census.mjs',
  'package command check:d6j-d4c-firestore-job-path-census missing or changed'
);

console.log('D6J_D4C_FIRESTORE_JOB_PATH_CENSUS_CHECK=PASS');
