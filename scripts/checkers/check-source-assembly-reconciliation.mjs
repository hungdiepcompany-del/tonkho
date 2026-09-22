import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { phase0CandidateScope } from './check-ai-governance-bootstrap.mjs';

const read = file => fs.readFileSync(file, 'utf8');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const contract = read('docs/exec-plans/active/SGDS_PHASE0_CURRENT_STATE_NORMALIZATION_AND_PRODUCTION_RECOVERY_HANDOFF.md');
const mutationSection = contract.match(/## Source assembly mutation scope\r?\n([\s\S]*?)\r?\n## /)?.[1] || '';
const mutationScope = [...mutationSection.matchAll(/^- `([^`]+)`/gm)].map(match => match[1]);
const allowedSection = contract.match(/## Allowed mutation scope\r?\n([\s\S]*?)\r?\n## /)?.[1] || '';
const allowedScope = [...allowedSection.matchAll(/^- `([^`]+)`/gm)].map(match => match[1]);

assert.equal(mutationScope.length, 17, 'SOURCE_ASSEMBLY_MUTATION_SCOPE_MUST_HAVE_17_PATHS');
assert.equal(new Set(mutationScope).size, 17, 'SOURCE_ASSEMBLY_MUTATION_SCOPE_DUPLICATE');
assert.deepEqual(allowedScope, phase0CandidateScope, 'SOURCE_ASSEMBLY_CANDIDATE_SCOPE_MUST_MATCH_CANONICAL_CANDIDATE_SCOPE');
assert.equal(new Set(allowedScope).size, allowedScope.length, 'SOURCE_ASSEMBLY_CANDIDATE_SCOPE_DUPLICATE');
for (const file of mutationScope) assert.equal(fs.existsSync(file), true, `SOURCE_ASSEMBLY_SCOPE_PATH_MISSING:${file}`);

assert.match(contract, /`authority_id=OWNER_GO_LOCAL_SOURCE_ASSEMBLY_RECONCILIATION_INVOICECANONICAL_SKUENGINE_SHEETMENU_V1_20260920`/);
assert.equal(hash('invoiceCanonical.js'), 'e59ba2bb5a0bacc04da4d7a46ad033ff98de4fb60a36fb4ca6e318951847515d');
assert.equal(hash('SKU_ENGINE.js'), '4879f2ea2bd713c0272ba746c77b7c150e2ba2fd4afb5d87d23ecde7cc8dfebb');

const invoice = read('invoiceCanonical.js');
const sku = read('SKU_ENGINE.js');
const menu = read('sheetMenu.js');
for (const token of ['normalizeInvoiceTaxCode_', 'ensureInvoicePdfLinkFormulas_', 'reconcileDuplicateInvoiceKeysAfterCommit_']) assert.match(invoice, new RegExp(`function ${token}`));
for (const token of ['skuEngineSetupSheets', 'skuEngineBootstrapAliases', 'skuEngineValidateMappings', 'skuEngineRunDry']) {
  assert.match(sku, new RegExp(`function ${token}`));
  assert.equal(menu.split(`'${token}'`).length - 1, 1, `MENU_ENTRYPOINT_CARDINALITY:${token}`);
}
assert.match(sku, /function skuEngineProductionCommit\(\) \{\s*throw new Error\('SKU_ENGINE_PRODUCTION_COMMIT_DISABLED_IN_V1'\);/);
assert.doesNotMatch(menu, /skuEngineProductionCommit/);
for (const token of [
  'PRODUCTION_MUTATION_AUTHORITY=NONE',
  'NO_CLASP_PUSH',
  'NO_GAS_EXECUTION',
  'NO_GIT_STAGE_COMMIT_PUSH'
]) assert.match(contract, new RegExp(token), `SOURCE_ASSEMBLY_BOUNDARY_MISSING:${token}`);

console.log('SOURCE_ASSEMBLY_RECONCILIATION_CHECK=PASS');
