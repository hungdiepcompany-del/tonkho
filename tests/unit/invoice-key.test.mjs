import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['Shared_Normalization.js', 'invoiceCanonical.js', 'sheetHoaDon.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['Shared_Normalization.js', 'invoiceCanonical.js', 'sheetHoaDon.js'],
  exportNames: [
    'normalizeInvoiceTaxCode_',
    'buildInvoiceKey_',
    'isCanonicalInvoiceKey_'
  ],
  stubs: {
    CONFIG: {
      SHEET_INVOICE: 'Nhap-Xuat',
      NHAPXUAT_INDEX: { hash: 12, invoiceKey: 13 }
    }
  }
});

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'REGRESSION_INVARIANT'));

test('invoice key canonicalizes date, tax code label, and leading-zero invoice number', () => {
  assert.equal(
    gas.call('buildInvoiceKey_', '15/01/2026', 'MST:0100000001', '000123'),
    '20260115_0100000001_123'
  );
});

test('invoice key preserves tax-code branch suffix', () => {
  assert.equal(
    gas.call('buildInvoiceKey_', '28/05/2026', '0100109106 - 023', '000707968'),
    '20260528_0100109106-023_707968'
  );
});

test('tax code canonicalizer accepts spaced OCR digits and repairs flattened branch code', () => {
  assert.equal(
    gas.call('normalizeInvoiceTaxCode_', '1 0 0 1 0 3 5 1 9 8'),
    '1001035198'
  );
  assert.equal(
    gas.call('normalizeInvoiceTaxCode_', '0100109106023'),
    '0100109106-023'
  );
});

test('invoice key rejects invalid date', () => {
  assert.throws(
    () => gas.call('buildInvoiceKey_', '31/02/2026', '0100000001', '123'),
    /Ngay hoa don khong hop le/
  );
});

test('invoice key rejects missing or invalid tax code', () => {
  assert.throws(
    () => gas.call('buildInvoiceKey_', '15/01/2026', '', '123'),
    /MST hoa don khong hop le/
  );
});

test('invoice key rejects missing invoice number', () => {
  assert.throws(
    () => gas.call('buildInvoiceKey_', '15/01/2026', '0100000001', ''),
    /So hoa don khong hop le/
  );
});

test('canonical key validator requires 10-digit MST with optional 3-digit branch suffix', () => {
  assert.equal(gas.call('isCanonicalInvoiceKey_', '20260528_0100109106-023_707968'), true);
  assert.equal(gas.call('isCanonicalInvoiceKey_', '20260528_0100109106023_707968'), false);
  assert.equal(gas.call('isCanonicalInvoiceKey_', 'UNKNOWN_0100109106_1'), false);
});
