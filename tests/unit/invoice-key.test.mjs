import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['Shared_Normalization.js', 'Shared_Hashing.js', 'normalization.js', 'sheetHoaDon.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
const gas = loadGasSource({
  files: ['Shared_Normalization.js', 'Shared_Hashing.js', 'normalization.js', 'sheetHoaDon.js'],
  exportNames: ['buildInvoiceKey_', 'buildInvoiceKeyV2_'],
});

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'REGRESSION_INVARIANT'));

test('invoice key helper normalizes date and tax code but preserves invoice number string', () => {
  assert.equal(gas.call('buildInvoiceKey_', '15/01/2026', 'MST:0100000001', '000123'), '20260115_0100000001_000123');
});

test('invoice key helper rejects invalid date', () => {
  assert.throws(() => gas.call('buildInvoiceKey_', '31/02/2026', '0100000001', '000123'), /Ngay hoa don khong hop le/);
});

test('InvoiceKeyV2 includes seller tax code, symbol, normalized number, and date', () => {
  assert.equal(gas.call('buildInvoiceKeyV2_', '15/01/2026', 'MST:0100000001', 'c26tst', '000123'), '0100000001_C26TST_123_20260115');
});

test('InvoiceKeyV2 rejects incomplete canonical identity', () => {
  assert.throws(() => gas.call('buildInvoiceKeyV2_', '15/01/2026', '0100000001', '', '000123'), /InvoiceKeyV2 thieu/);
});
