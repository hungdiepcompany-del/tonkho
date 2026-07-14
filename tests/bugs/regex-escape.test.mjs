
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['normalization.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
const gas = loadGasSource({ files: ['normalization.js'], exportNames: ['normalizeCustomerName_'] });
test('C06: customer abbreviation keys are escaped before RegExp use', () => {
  const dic = new Map([['A+B', 'ABBR']]);
  assert.equal(gas.call('normalizeCustomerName_', 'AAAB', dic, new Set(['ABBR'])), 'Aaab');
  assert.equal(gas.call('normalizeCustomerName_', 'A+B sample', dic, new Set(['ABBR'])), 'ABBR Sample');
});
