import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['invoiceCanonical.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['invoiceCanonical.js'],
  exportNames: [
    'canonicalInvoicePdfLinkFormulaForRow_',
    'planDuplicateInvoiceKeyReconciliation_'
  ],
  stubs: {
    CONFIG: {
      SHEET_INVOICE: 'Nhap-Xuat',
      NHAPXUAT_INDEX: { hash: 12, invoiceKey: 13 }
    }
  }
});

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'REGRESSION_INVARIANT'));

test('P formula only links when Hoa-Don has a real PDF_id', () => {
  assert.equal(
    gas.call('canonicalInvoicePdfLinkFormulaForRow_', 123),
    '=IF(O123="";"";IFERROR(IF(XLOOKUP(O123;\'Hoa-Don\'!A:A;\'Hoa-Don\'!D:D;"")="";"";HYPERLINK("https://drive.google.com/file/d/"&XLOOKUP(O123;\'Hoa-Don\'!A:A;\'Hoa-Don\'!D:D;"")&"/view";"🔎"));""))'
  );
});

test('duplicate replay fills blank O for every exact legacy-hash row', () => {
  const ledgerRows = [
    Array(12).fill('').concat(['hash-a', '']),
    Array(12).fill('').concat(['hash-a', '']),
    Array(12).fill('').concat(['hash-b', '20250101_1000000001_2'])
  ];

  const duplicateItems = [{
    invoiceKey: '20250101_1000000001_1',
    row: Array(12).fill('').concat(['hash-a', '20250101_1000000001_1'])
  }];

  const plan = gas.call('planDuplicateInvoiceKeyReconciliation_', ledgerRows, duplicateItems);
  assert.deepEqual(
    Array.from(plan.updates, x => ({ ...x })),
    [
      { rowOffset: 0, invoiceKey: '20250101_1000000001_1' },
      { rowOffset: 1, invoiceKey: '20250101_1000000001_1' }
    ]
  );
  assert.deepEqual(Array.from(plan.errors), ['']);
});

test('duplicate replay is idempotent when O already matches', () => {
  const ledgerRows = [
    Array(12).fill('').concat(['hash-a', '20250101_1000000001_1'])
  ];
  const duplicateItems = [{
    invoiceKey: '20250101_1000000001_1',
    row: Array(12).fill('').concat(['hash-a', '20250101_1000000001_1'])
  }];

  const plan = gas.call('planDuplicateInvoiceKeyReconciliation_', ledgerRows, duplicateItems);
  assert.equal(plan.updates.length, 0);
  assert.deepEqual(Array.from(plan.errors), ['']);
});

test('duplicate replay fails closed when existing O conflicts', () => {
  const ledgerRows = [
    Array(12).fill('').concat(['hash-a', '20250101_1000000002_1'])
  ];
  const duplicateItems = [{
    invoiceKey: '20250101_1000000001_1',
    row: Array(12).fill('').concat(['hash-a', '20250101_1000000001_1'])
  }];

  const plan = gas.call('planDuplicateInvoiceKeyReconciliation_', ledgerRows, duplicateItems);
  assert.equal(plan.updates.length, 0);
  assert.deepEqual(Array.from(plan.errors), ['EXISTING_INVOICEKEY_CONFLICT']);
});

test('same legacy hash cannot be reconciled to two invoice keys', () => {
  const ledgerRows = [Array(12).fill('').concat(['hash-a', ''])];
  const duplicateItems = [
    {
      invoiceKey: '20250101_1000000001_1',
      row: Array(12).fill('').concat(['hash-a', '20250101_1000000001_1'])
    },
    {
      invoiceKey: '20250101_1000000002_1',
      row: Array(12).fill('').concat(['hash-a', '20250101_1000000002_1'])
    }
  ];

  const plan = gas.call('planDuplicateInvoiceKeyReconciliation_', ledgerRows, duplicateItems);
  assert.equal(plan.updates.length, 0);
  assert.deepEqual(
    Array.from(plan.errors),
    ['AMBIGUOUS_HASH_TO_INVOICEKEY', 'AMBIGUOUS_HASH_TO_INVOICEKEY']
  );
});
