import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['config.js', 'invoiceCanonical.js', 'SKU_ENGINE.js', 'sheetMenu.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('canonical invoice helpers preserve branch tax identity and reject ambiguous replay', () => {
  const gas = loadGasSource({
    files: ['config.js', 'invoiceCanonical.js'],
    exportNames: ['normalizeInvoiceTaxCode_', 'planDuplicateInvoiceKeyReconciliation_']
  });
  assert.equal(gas.call('normalizeInvoiceTaxCode_', 'MST: 0101234567-001'), '0101234567-001');
  assert.equal(gas.call('normalizeInvoiceTaxCode_', '0101234567001'), '0101234567-001');
  assert.equal(gas.call('normalizeInvoiceTaxCode_', 'not-a-tax-code'), '');

  const row = Array(14).fill('');
  row[12] = 'hash-1';
  const plan = gas.call(
    'planDuplicateInvoiceKeyReconciliation_',
    [[null, null, null, null, null, null, null, null, null, null, null, null, 'hash-1', 'other-key']],
    [{ row, invoiceKey: '20260920_0101234567_1' }]
  );
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.errors[0], 'EXISTING_INVOICEKEY_CONFLICT');
});

test('SKU engine normalization is deterministic and production commit remains disabled', () => {
  const gas = loadGasSource({
    files: ['SKU_ENGINE.js'],
    exportNames: ['skuNormalizeName_', 'skuClassifyNameAmbiguity_', 'skuEngineProductionCommit']
  });
  assert.equal(gas.call('skuNormalizeName_', 'Thép hộp 20 x 40'), 'THEP HOP 20X40');
  assert.equal(gas.call('skuClassifyNameAmbiguity_', 'Thép tấm các loại', '', 'THEPTAM').blocked, true);
  assert.throws(() => gas.call('skuEngineProductionCommit'), /SKU_ENGINE_PRODUCTION_COMMIT_DISABLED_IN_V1/);
});

test('sheet menu exposes only the four reconciled SKU entrypoints', () => {
  const source = fs.readFileSync('sheetMenu.js', 'utf8');
  for (const entrypoint of [
    'skuEngineSetupSheets',
    'skuEngineBootstrapAliases',
    'skuEngineValidateMappings',
    'skuEngineRunDry'
  ]) assert.equal(source.split(`'${entrypoint}'`).length - 1, 1, entrypoint);
  assert.doesNotMatch(source, /skuEngineProductionCommit/);
});
