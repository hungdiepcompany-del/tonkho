import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const contract = read('docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md');
const correctionSection = contract.match(/## Correction mutation scope\r?\n([\s\S]*?)\r?\n## /)?.[1] || '';
const correctionScope = [...correctionSection.matchAll(/^- `([^`]+)`/gm)].map(match => match[1]);
const scopeSection = contract.match(/## Allowed mutation scope\r?\n([\s\S]*?)\r?\n## /)?.[1] || '';
const scope = [...scopeSection.matchAll(/^- `([^`]+)`/gm)].map(match => match[1]);

assert.equal(correctionScope.length, 11, 'EXACT17_CORRECTION_SCOPE_MUST_HAVE_11_PATHS');
assert.equal(new Set(correctionScope).size, 11, 'EXACT17_CORRECTION_SCOPE_DUPLICATE');
assert.equal(scope.length, 71, 'EXACT17_IMPLEMENTATION_SCOPE_MUST_HAVE_71_PATHS');
assert.equal(new Set(scope).size, 71, 'EXACT17_IMPLEMENTATION_SCOPE_DUPLICATE');
for (const file of scope) assert.equal(fs.existsSync(file), true, `EXACT17_SCOPE_PATH_MISSING:${file}`);

assert.match(contract, /AUTHORITY_ID=OWNER_GO_EXACT17_AGGREGATE_COMPATIBILITY_CORRECTION_EXACT_11_PATHS_V1_20260920/);
assert.match(read('Shared_Hashing.js'), /function buildInvoiceKeyV2_/);
assert.match(read('Shared_Hashing.js'), /function buildLineIdentityV2_/);
assert.match(read('gmailProcessInvoiceXML.js'), /sourceLineNo[\s\S]*lineIdentityV2/);
assert.doesNotMatch(read('gmailScanner.js'), /breakOnFirst/);
assert.match(read('durableJobState.js'), /INVENTORY_PENDING/);
assert.match(read('durableInvoiceOrchestrator.js'), /'LEDGER',[\s\S]*'INVENTORY',[\s\S]*'GMAIL'/);
assert.match(read('sheetNhapXuat.js'), /OVERSELL_BLOCKED[\s\S]*throw new Error/);
assert.match(read('sheetTonKho.js'), /nxData\.sort[\s\S]*OVERSELL_BLOCKED/);
assert.match(read('sheetSidebar.html'), /p\.status === "COMPLETED" && !tkStarted/);
assert.match(read('triggers.js'), /NEED_LEDGER_RECONCILIATION/);

console.log('EXACT17_LOCAL_CANDIDATE_IMPLEMENTATION_CHECK=PASS');
