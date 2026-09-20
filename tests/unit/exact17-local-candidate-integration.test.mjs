import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { readFixtureText } from '../harness/fixture-loader.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'Shared_Hashing.js', 'Invoice_AttachmentParser.js', 'gmailScanner.js',
    'durableJobState.js', 'sheetNhapXuat.js', 'sheetTonKho.js', 'sheetUtils.js'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const sheet = {
  getLastRow: () => 2,
  getRange: () => ({ getValues: () => [['THEPTAM', 'THÉP TẤM MẪU']] })
};
const gas = loadGasSource({
  files: ['config.js', 'Shared_Normalization.js', 'Shared_Hashing.js', 'Invoice_AttachmentParser.js'],
  exportNames: ['parseInvoiceXML_', 'buildInvoiceKeyV2_', 'buildLineIdentityV2_'],
  stubs: { SpreadsheetApp: { getActive: () => ({ getSheetByName: () => sheet }) } }
});

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('Exact17 V2 fixture produces one canonical invoice and distinct economic lines', () => {
  const parsed = gas.call('parseInvoiceXML_', readFixtureText('xml', 'valid-invoice-v2-multiline.xml'), { type: 'NHAP' });
  const key = gas.call('buildInvoiceKeyV2_', parsed.meta.invoiceDate, parsed.seller.taxCode, parsed.meta.invoiceSymbol, parsed.meta.invoiceNo);
  assert.equal(key, '0100000001_C26V2_321_20260920');
  assert.equal(parsed.items.length, 2);
  const identities = parsed.items.map(item => gas.call('buildLineIdentityV2_', {
    invoiceKeyV2: key,
    sourceLineNo: item.sourceLineNo,
    rawItemName: item.rawItemName,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.amount
  }));
  assert.equal(new Set(identities).size, 2);
});

test('Exact17 retry, lifecycle, inventory, progress, and audit boundaries are wired locally', () => {
  const read = file => fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(read('gmailScanner.js'), /breakOnFirst/);
  assert.match(read('gmailSearch.js'), /CONFIG\.PENDING_LABEL/);
  assert.match(read('gmailCollection.js'), /duplicateBody[\s\S]*getAttachments/);
  assert.match(read('durableJobState.js'), /ROWS_COMMITTED: Object\.freeze\(\['INVENTORY_PENDING'/);
  assert.match(read('durableInvoiceOrchestrator.js'), /stepName: 'INVENTORY'/);
  assert.match(read('sheetNhapXuat.js'), /INVALID_TRANSACTION_SEQUENCE[\s\S]*OVERSELL_BLOCKED/);
  assert.match(read('sheetTonKho.js'), /nxData\.sort[\s\S]*OVERSELL_BLOCKED/);
  assert.match(read('sheetUtils.js'), /runId:[\s\S]*status:[\s\S]*updatedAt:/);
  assert.match(read('sheetSidebar.html'), /p\.status === "COMPLETED" && !tkStarted/);
  assert.match(read('sheetFileLog.js'), /appendFileLogEntries_/);
  assert.match(read('triggers.js'), /HISTORICAL_EDIT_REVERTED/);
});

test('Exact17 preserves physical sheet schema and legacy identity helpers', () => {
  assert.match(fs.readFileSync('config.js', 'utf8'), /hash:\s*12,[\s\S]*invoiceKey:\s*13/);
  assert.match(fs.readFileSync('Shared_Hashing.js', 'utf8'), /function buildInvoiceItemHash_/);
  assert.match(fs.readFileSync('sheetHoaDon.js', 'utf8'), /function buildInvoiceKey_/);
  assert.match(fs.readFileSync('sheetWriter.js', 'utf8'), /nextTransactionSequence_/);
});
