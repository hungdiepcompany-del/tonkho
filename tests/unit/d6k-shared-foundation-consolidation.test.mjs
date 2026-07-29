import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { buildD6kSourceEntrypointInventory } from '../../scripts/analysis/build-d6k-source-entrypoint-inventory.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['Shared_Normalization.js', 'Shared_Hashing.js', 'normalization.js', 'hashUtils.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['Shared_Normalization.js', 'Shared_Hashing.js', 'normalization.js', 'hashUtils.js'],
  exportNames: [
    'normalizeInvoiceNo_',
    'parseInvoiceDateValue_',
    'normalizeTextForCompare_',
    'normalizeHashText_',
    'buildHashFromText_',
    'buildInvoiceItemHash_',
    'prepareInvoiceRowsForCommit_'
  ]
});

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('D6K-B shared helper global names remain available after file move', () => {
  for (const name of Object.keys(gas.exports)) {
    assert.equal(typeof gas.exports[name], 'function', name + ' should remain globally callable');
  }
});

test('D6K-B normalization and hashing outputs remain stable', () => {
  assert.equal(gas.call('normalizeInvoiceNo_', '00000248'), 248);
  assert.equal(gas.call('normalizeTextForCompare_', 'C\u00d4NG TY M\u1eaaU  A+B'), 'cong ty mau a b');
  assert.equal(gas.call('normalizeHashText_', ['2026/03/09', '00000248', ' abc ', null]), '2026-03-09|248|ABC');
  assert.equal(gas.call('buildHashFromText_', 'A  B'), gas.call('buildHashFromText_', 'A B'));
  assert.equal(
    gas.call('buildInvoiceItemHash_', {
      invoiceDate: '2026/03/09',
      invoiceNo: '00000248',
      customerName: 'Cong ty Mau',
      itemCode: 'THEPTAM',
      itemName: 'Thep tam',
      invoiceType: 'NHAP',
      qty: 1,
      price: 100
    }),
    gas.call('buildInvoiceItemHash_', {
      invoiceDate: '2026/03/09',
      invoiceNo: '00000248',
      customerName: 'Cong ty Mau',
      itemCode: 'THEPTAM',
      itemName: 'Thep tam',
      invoiceType: 'NHAP',
      qty: 1,
      price: 999
    })
  );
});

test('D6K-B shared files introduce no production API calls and no global collisions', () => {
  const sharedSource = fs.readFileSync('Shared_Normalization.js', 'utf8') + '\n' + fs.readFileSync('Shared_Hashing.js', 'utf8');
  assert.doesNotMatch(sharedSource, /GmailApp|DriveApp|SpreadsheetApp|UrlFetchApp|PropertiesService|LockService/);
  const inventory = buildD6kSourceEntrypointInventory({ root: process.cwd() });
  assert.equal(inventory.metrics.globalNameCollisionCount, 0);
  assert.equal(inventory.metrics.unknownRequiresReviewCount, 0);
});
