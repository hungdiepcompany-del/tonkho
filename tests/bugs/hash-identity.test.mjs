import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['Shared_Normalization.js', 'Shared_Hashing.js', 'normalization.js', 'Shared_Hashing.js',
    'hashUtils.js'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
const gas = loadGasSource({ files: ['Shared_Normalization.js', 'Shared_Hashing.js', 'normalization.js', 'hashUtils.js'], exportNames: ['buildInvoiceItemHash_', 'buildLineIdentityV2_'] });
test('BUG-HASH-IDENTITY fixed: V2 identity includes economic fields while legacy hash remains compatible', () => {
  const base = { invoiceKeyV2: '0100000001_C26TST_123_20260115', sourceLineNo: 1, rawItemName: 'THÉP TẤM MẪU', unit: 'KG', quantity: 10, unitPrice: 1000, amount: 10000 };
  assert.notEqual(gas.call('buildLineIdentityV2_', base), gas.call('buildLineIdentityV2_', { ...base, unitPrice: 9999, amount: 99990 }));
});
