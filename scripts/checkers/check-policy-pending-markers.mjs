import fs from 'node:fs';
import assert from 'node:assert/strict';
const text = fs.readFileSync('docs/06_OWNER_DECISIONS.md', 'utf8') + fs.readFileSync('docs/03_DATA_CONTRACT.md', 'utf8');
assert.match(text, /PENDING OWNER DECISIONS/);
assert.match(text, /DRAFT_NOT_OWNER_APPROVED/);
console.log('POLICY_PENDING_MARKERS=PASS');
