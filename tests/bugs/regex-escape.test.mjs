import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['normalization.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
const gas = loadGasSource({ files: ['normalization.js'], exportNames: ['normalizeCustomerName_'] });
test('BUG-REGEX-ESCAPE: abbreviation key is used as raw RegExp', () => {
  const dic = new Map([['A+B', 'ABBR']]);
  const out = gas.call('normalizeCustomerName_', 'AAAB', dic, new Set(['ABBR']));
  assert.equal(out, 'ABBR');
});
