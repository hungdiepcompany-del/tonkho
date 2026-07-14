import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'CURRENT_BEHAVIOR', sourceFiles: ['normalization.js', 'hashUtils.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });

const gas = loadGasSource({
  files: ['normalization.js', 'hashUtils.js'],
  exportNames: ['normalizeHashText_', 'buildHashFromText_', 'buildInvoiceItemHash_'],
});

const base = { invoiceDate: '2026/01/15', invoiceNo: '000123', customerName: 'CÔNG TY MẪU', itemCode: 'THEPTAM', itemName: 'THÉP TẤM MẪU', invoiceType: 'NHAP', qty: 10 };

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('hash is deterministic for same canonical input', () => {
  assert.equal(gas.call('buildHashFromText_', 'A  B'), gas.call('buildHashFromText_', 'A B'));
});

test('current invoice item hash ignores unit price', () => {
  const a = gas.call('buildInvoiceItemHash_', { ...base, price: 1000 });
  const b = gas.call('buildInvoiceItemHash_', { ...base, price: 9999 });
  assert.equal(a, b);
});

test('current invoice item hash ignores invoiceKey', () => {
  const a = gas.call('buildInvoiceItemHash_', { ...base, invoiceKey: 'A' });
  const b = gas.call('buildInvoiceItemHash_', { ...base, invoiceKey: 'B' });
  assert.equal(a, b);
});
