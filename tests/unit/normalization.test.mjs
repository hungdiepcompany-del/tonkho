import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'CURRENT_BEHAVIOR', sourceFiles: ['normalization.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });

const gas = loadGasSource({
  files: ['normalization.js'],
  exportNames: ['normalizeTextForCompare_', 'parseInvoiceDateValue_', 'normalizeInvoiceNo_', 'normalizeCustomerName_', 'normalizeHashText_'],
});

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'CURRENT_BEHAVIOR'));

test('text compare normalization removes accents, punctuation, and spacing', () => {
  assert.equal(gas.call('normalizeTextForCompare_', '  Công ty (Mẫu) A+B  '), 'cong ty mau a b');
});

test('date parser supports declared formats and rejects invalid dates', () => {
  for (const value of ['2026-01-15', '2026/01/15', '20260115', '15/01/2026', '15-01-2026']) {
    assert.equal(gas.call('parseInvoiceDateValue_', value).getFullYear(), 2026);
  }
  assert.equal(gas.call('parseInvoiceDateValue_', '31/02/2026'), null);
});

test('invoice number normalization converts numeric strings to number', () => {
  assert.equal(gas.call('normalizeInvoiceNo_', '000123'), 123);
  assert.equal(gas.call('normalizeInvoiceNo_', 'AB-000123'), 'AB-000123');
});

test('customer abbreviation replacement escapes regex characters', () => {
  const dic = new Map([['A+B', 'ABBR']]);
  const dicVietTat = new Set(['ABBR']);
  assert.equal(gas.call('normalizeCustomerName_', 'AAAB sample', dic, dicVietTat), 'Aaab Sample');
  assert.equal(gas.call('normalizeCustomerName_', 'A+B sample', dic, dicVietTat), 'ABBR Sample');
});
