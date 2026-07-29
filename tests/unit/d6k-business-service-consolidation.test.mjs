import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { buildD6kSourceEntrypointInventory } from '../../scripts/analysis/build-d6k-source-entrypoint-inventory.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['Invoice_AttachmentParser.js', 'xmlParser.js', 'pdfParser.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE',
});

const ATTACHMENT_EXPORTS = [
  'parseInvoiceXML_',
  'isVatInvoiceXML_',
  'extractXmlMeta_',
  'isVatInvoicePDF_',
  'extractPdfText_',
  'extractVatMetaFromPDFText_',
  'buildVatPdfFileName_',
];

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'REGRESSION_INVARIANT'));

test('D6K-C attachment parser module preserves global parser function names', () => {
  const gas = loadGasSource({
    files: ['config.js', 'utils.js', 'Shared_Normalization.js', 'normalization.js', 'Invoice_AttachmentParser.js', 'xmlParser.js', 'pdfParser.js'],
    exportNames: ATTACHMENT_EXPORTS,
    stubs: {
      CONFIG: { MY_TAXCODE: '0100000999', DEBUG_LOG: false },
      Logger: { log: () => {} },
    },
  });

  for (const name of ATTACHMENT_EXPORTS) {
    assert.equal(typeof gas.context[name], 'function', name);
  }
});

test('D6K-C compatibility stubs do not duplicate parser declarations', () => {
  for (const file of ['xmlParser.js', 'pdfParser.js']) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /^\s*function\s+[A-Za-z_$][\w$]*\s*\(/m, file);
    assert.match(source, /D6K-C compatibility stub/);
  }
});

test('D6K-C inventory remains collision-free with attachment parser module', () => {
  const inventory = buildD6kSourceEntrypointInventory({ root: process.cwd() });
  const module = inventory.runtimeFiles.find(file => file.filePath === 'Invoice_AttachmentParser.js');
  assert.ok(module, 'Invoice_AttachmentParser.js inventory entry missing');
  for (const name of ATTACHMENT_EXPORTS) {
    assert.equal(module.topLevelFunctions.includes(name), true, name);
  }
  assert.equal(inventory.metrics.globalNameCollisionCount, 0);
  assert.equal(inventory.metrics.unknownRequiresReviewCount, 0);
});

test('D6K-C attachment module does not introduce additional write primitives', () => {
  const source = fs.readFileSync('Invoice_AttachmentParser.js', 'utf8');
  assert.doesNotMatch(source, /GmailApp\.|Firestore|setProperty|newTrigger|appendRow|setValues\(/);
});
