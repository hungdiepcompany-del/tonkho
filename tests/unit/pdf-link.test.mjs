import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { readFixtureText } from '../harness/fixture-loader.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'CURRENT_BEHAVIOR', sourceFiles: ['pdfParser.js', 'gmailProcessInvoiceLINK.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
const gas = loadGasSource({
  files: ['normalization.js', 'pdfParser.js', 'gmailProcessInvoiceLINK.js'],
  exportNames: ['isVatInvoicePDF_', 'extractVatMetaFromPDFText_', 'extractAllLinksFromMessage_', 'extractPdfLinkFromHtml_', 'resolveHtmlUrl_'],
  stubs: { CONFIG: { MY_TAXCODE: '0100000999' } },
});

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'CURRENT_BEHAVIOR'));

test('PDF VAT detector only recognizes title in first 50 chars', () => {
  assert.equal(gas.call('isVatInvoicePDF_', readFixtureText('pdf-text', 'vat-title-first-line.txt')), true);
  assert.equal(gas.call('isVatInvoicePDF_', readFixtureText('pdf-text', 'vat-title-after-logo.txt')), false);
});

test('PDF metadata chooses counterparty tax code different from own tax code', () => {
  const meta = gas.call('extractVatMetaFromPDFText_', readFixtureText('pdf-text', 'multiple-tax-codes.txt'));
  assert.equal(meta.taxCode, '0100000002');
});

test('URL extraction deduplicates and filters homepage/invalid protocol', () => {
  const msg = { getBody: () => 'https://example.test/ https://example.test/invoice?id=1 ftp://bad.test https://example.test/invoice?id=1' };
  assert.deepEqual(Array.from(gas.call('extractAllLinksFromMessage_', msg)), ['https://example.test/invoice?id=1']);
});

test('HTML PDF link resolver supports relative paths', () => {
  assert.equal(gas.call('extractPdfLinkFromHtml_', '<a href="/files/invoice.pdf?x=1">PDF</a>', 'https://example.test/base/page'), 'https://example.test/files/invoice.pdf?x=1');
});


test('OCR cleanup trashes temporary document when document read throws', () => {
  const calls = [];
  const localGas = loadGasSource({
    files: ['utils.js', 'pdfParser.js'],
    exportNames: ['extractPdfText_'],
    stubs: {
      CONFIG: { DEBUG_LOG: true },
      Drive: { Files: { insert: () => ({ id: 'temp-doc-1' }) } },
      DocumentApp: { openById: () => ({ getBody: () => ({ getText: () => { throw new Error('read failed raw invoice body'); } }) }) },
      DriveApp: { getFileById: (id) => ({ setTrashed: (flag) => calls.push([id, flag]) }) },
      Logger: { log: () => {} },
    },
  });
  assert.throws(() => localGas.call('extractPdfText_', { name: 'sample.pdf' }), /read failed/);
  assert.deepEqual(calls, [['temp-doc-1', true]]);
});
