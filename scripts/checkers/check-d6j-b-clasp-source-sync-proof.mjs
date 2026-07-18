import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const proofPath = 'docs/evidence/D6J_B_CLASP_SOURCE_SYNC_PROOF.md';
const phasePath = 'docs/phases/D6J_B_SAFE_EXACT_PRODUCTION_DRY_RUN_CHANNEL.md';
const indexPath = 'docs/00_INDEX.md';
const workLogPath = 'docs/07_WORK_LOG.md';
const validationLogPath = 'docs/09_VALIDATION_LOG.md';
const handoffPath = 'docs/99_NEXT_AI_HANDOFF.md';

for (const file of [proofPath, phasePath, indexPath, workLogPath, validationLogPath, handoffPath]) {
  assert.equal(exists(file), true, `missing D6J-B source-sync proof artifact: ${file}`);
}

const proof = read(proofPath);
const docs = [
  proof,
  read(phasePath),
  read(indexPath),
  read(workLogPath),
  read(validationLogPath),
  read(handoffPath)
].join('\n');
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'PHASE=D6J_B_CLASP_SOURCE_SYNC_PROOF',
  'STATUS=BLOCKED_CLASP_PUSH_SKIPPED_REMOTE_SOURCE_MISSING',
  'ACTUAL_START_HEAD=02e431386aac9221f1568b9da56fb5da8f922e8f',
  'VALID_GIT_SHA=YES',
  'APPS_SCRIPT_ID=19qIN0cXmBY9GY7ma8B2MJh25ioBsmrlrIwsr27ZB1oyFxH8VPMj0dmhM',
  'CLASP_ACCOUNT=hungdiepcompany@gmail.com',
  'CLASP_ROOT_DIR=.',
  'CLASPIGNORE_EXCLUDES=d6jPilotReadiness.js',
  'LOCAL_ENTRYPOINT_PRESENT=YES',
  'LOCAL_ENTRYPOINT_INCLUDED_BY_CLASP=YES',
  'LOCAL_ONLY_HELPER_EXCLUDED=YES',
  'LOCAL_DEPLOYABLE_FILE_COUNT=64',
  'd6jBProductionDryRunReadOnly.js',
  'REMOTE_SOURCE_FETCH_METHOD=clasp clone',
  'REMOTE_SOURCE_FETCH_STATUS=PASS',
  'REMOTE_ENTRYPOINT_PRESENT=NO',
  'REMOTE_SUPPORT_FUNCTIONS_PRESENT=NO',
  'LOCAL_SOURCE_HASH=',
  'REMOTE_SOURCE_HASH=NOT_AVAILABLE_REMOTE_FILE_ABSENT',
  'SOURCE_HASH_MATCH=NO_REMOTE_SOURCE_ABSENT',
  'SOURCE_SEMANTIC_MATCH=NO_REMOTE_SOURCE_ABSENT',
  'LOCAL_MAPPING_DEFECT_FOUND=NO',
  'CLASP_PUSH_ATTEMPT_COUNT_THIS_PHASE=1',
  'CLASP_PUSH_RESULT=SKIPPED_BY_CLASP',
  'CLASP_PUSH_OUTPUT=Skipping push.',
  'APPS_SCRIPT_SOURCE_SYNC=BLOCKED_NOT_PROVEN',
  'FINAL_SYNCHRONIZATION_CLASSIFICATION=REMOTE_SOURCE_MISSING_PUSH_STILL_SKIPPED',
  'PRODUCTION_DRY_RUN_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'GMAIL_MUTATION=NONE',
  'DRIVE_MUTATION=NONE',
  'GOOGLE_SHEETS_MUTATION=NONE',
  'PRODUCTION_FIRESTORE_WRITE=NONE',
  'TRIGGER_MUTATION=NONE',
  'CLASP_PULL_IN_REPOSITORY=NOT_RUN',
  'CLASP_PUSH_FORCE=NOT_RUN',
  'APPS_SCRIPT_FUNCTION_RUN=NO'
]) {
  assert.equal(proof.includes(marker), true, `source-sync proof missing marker: ${marker}`);
}

for (const marker of [
  'D6J-B Clasp Source Sync Proof',
  'D6J_B_CLASP_SOURCE_SYNC_PROOF_CHECK=PASS',
  'BLOCKED_CLASP_PUSH_SKIPPED_REMOTE_SOURCE_MISSING',
  'RESOLVE_D6J_B_CLASP_PUSH_SKIPPED_REMOTE_SOURCE_MISSING_WITHOUT_FORCE'
]) {
  assert.equal(docs.includes(marker), true, `D6J-B source-sync docs missing marker: ${marker}`);
}

for (const forbidden of [
  'clasp push --force',
  'clasp.cmd push --force',
  'CLASP_PULL_IN_REPOSITORY=RUN',
  'CLASP_PUSH_FORCE=RUN',
  'runD6jBProductionDryRunReadOnly() executed',
  'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION=PRESENT',
  'PRODUCTION_DRY_RUN_EXECUTED=YES',
  'PRODUCTION_MUTATION=YES',
  'GMAIL_MUTATION=YES',
  'DRIVE_MUTATION=YES',
  'GOOGLE_SHEETS_MUTATION=YES',
  'PRODUCTION_FIRESTORE_WRITE=YES',
  'TRIGGER_MUTATION=YES',
  'APPS_SCRIPT_DEPLOYMENT=CREATED'
]) {
  assert.equal(proof.includes(forbidden), false, `proof contains forbidden marker: ${forbidden}`);
}

const privatePilotValues = [
  ['no-reply', '@', 'meinvoice.vn'].join(''),
  ['0000', '0248'].join(''),
  ['1C26THD_', '0000', '0248'].join(''),
  ['1cNCIC_', 'Tv5Y3td80xMCTCl4vCWAoyFzxW'].join(''),
  ['1yBbalX91VZkGIBaUJZQRt5eVllVlo', '53696M5hMLNAoc'].join(''),
  ['19cd03', 'f07ebbd84e'].join('')
];

for (const privatePilotValue of privatePilotValues) {
  assert.equal(docs.includes(privatePilotValue), false, `docs hardcode private pilot value: ${privatePilotValue}`);
}

assert.equal(
  packageJson.scripts['check:d6j-b-clasp-source-sync-proof'],
  'node scripts/checkers/check-d6j-b-clasp-source-sync-proof.mjs',
  'package command check:d6j-b-clasp-source-sync-proof missing or changed'
);

console.log('D6J_B_CLASP_SOURCE_SYNC_PROOF_CHECK=PASS');
