import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'CURRENT_BEHAVIOR', sourceFiles: ['normalization.js', 'sheetHoaDon.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
const gas = loadGasSource({
  files: ['normalization.js', 'sheetHoaDon.js'],
  exportNames: ['buildInvoiceKey_'],
});

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'CURRENT_BEHAVIOR'));

test('invoice key helper normalizes date and tax code but preserves invoice number string', () => {
  assert.equal(gas.call('buildInvoiceKey_', '15/01/2026', 'MST:0100000001', '000123'), '20260115_0100000001_000123');
});

test('invoice key helper rejects invalid date', () => {
  assert.throws(() => gas.call('buildInvoiceKey_', '31/02/2026', '0100000001', '000123'), /Ngay hoa don khong hop le/);
});
