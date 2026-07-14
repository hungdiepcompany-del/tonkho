import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['normalization.js', 'hashUtils.js'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
const gas = loadGasSource({ files: ['normalization.js', 'hashUtils.js'], exportNames: ['buildInvoiceItemHash_'] });
test('BUG-HASH-IDENTITY: different price creates same current hash', () => {
  const base = { invoiceDate: '2026-01-15', invoiceNo: '000123', customerName: 'CÔNG TY MẪU', itemCode: 'THEPTAM', itemName: 'THÉP TẤM MẪU', invoiceType: 'NHAP', qty: 10 };
  assert.equal(gas.call('buildInvoiceItemHash_', { ...base, price: 1000 }), gas.call('buildInvoiceItemHash_', { ...base, price: 9999 }));
});
