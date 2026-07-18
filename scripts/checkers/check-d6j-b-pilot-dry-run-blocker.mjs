import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const phasePath = 'docs/phases/D6J_B_LIMITED_PRODUCTION_PILOT.md';
const evidencePath = 'docs/evidence/D6J_B_LIMITED_PRODUCTION_PILOT_BLOCKER.md';

for (const file of [phasePath, evidencePath]) {
  assert.equal(exists(file), true, `missing D6J-B blocker artifact: ${file}`);
}

const text = [read(phasePath), read(evidencePath)].join('\n');

for (const marker of [
  'PHASE=D6J_B_LIMITED_PRODUCTION_PILOT',
  'BLOCKED_PRODUCTION_DRY_RUN_EXECUTION_CHANNEL_NOT_AVAILABLE',
  'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN=PRESENT',
  'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION=NOT_PRESENT',
  'PRODUCTION_DRY_RUN_EXECUTED=NO',
  'D6J_B_EXACT_QUERY_RUNNER_PRESENT=NO',
  'OLD_SCANNER_SEARCH_PATH_USED=NO',
  'GMAIL_MUTATION=NONE',
  'GOOGLE_DRIVE_MUTATION=NONE',
  'GOOGLE_SHEETS_MUTATION=NONE',
  'PRODUCTION_FIRESTORE_WRITE=NONE',
  'TRIGGER_MUTATION=NONE',
  'PRODUCTION_MUTATION=NONE',
  'NEXT_ALLOWED_PHASE=D6J_B_RESUME_WITH_SAFE_EXACT_GMAIL_DRY_RUN_EXECUTION_CHANNEL'
]) {
  assert.equal(text.includes(marker), true, `D6J-B blocker evidence missing marker: ${marker}`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(
  packageJson.scripts['check:d6j-b-pilot-dry-run-blocker'],
  'node scripts/checkers/check-d6j-b-pilot-dry-run-blocker.mjs',
  'package command check:d6j-b-pilot-dry-run-blocker missing or changed'
);

console.log('D6J_B_PILOT_DRY_RUN_BLOCKER_CHECK=PASS');
