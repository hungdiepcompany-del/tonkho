import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { readFixtureText } from '../harness/fixture-loader.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'CURRENT_BEHAVIOR', sourceFiles: ['normalization.js', 'xmlParser.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
const sheet = {
  getLastRow: () => 3,
  getRange: () => ({ getValues: () => [['THEPTAM', 'THÉP TẤM MẪU'], ['THEPCUON', 'THÉP CUỘN MẪU']] }),
};
const gas = loadGasSource({
  files: ['config.js', 'normalization.js', 'xmlParser.js'],
  exportNames: ['parseInvoiceXML_', 'isVatInvoiceXML_'],
  stubs: { SpreadsheetApp: { getActive: () => ({ getSheetByName: () => sheet }) } },
});

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('parses supported synthetic invoice XML', () => {
  const parsed = gas.call('parseInvoiceXML_', readFixtureText('xml', 'valid-invoice-in.xml'), { type: 'NHAP' });
  assert.equal(parsed.meta.invoiceNo, '000123');
  assert.equal(parsed.seller.taxCode, '0100000001');
  assert.equal(parsed.items[0].code, 'THEPTAM');
  assert.equal(gas.call('isVatInvoiceXML_', parsed.meta), true);
});

test('namespace variant is current-behavior unsupported', () => {
  const parsed = gas.call('parseInvoiceXML_', readFixtureText('xml', 'valid-namespace-variant.xml'), { type: 'NHAP' });
  assert.equal(parsed.meta, null);
});

test('malformed XML throws through current parser path', () => {
  assert.throws(() => gas.call('parseInvoiceXML_', readFixtureText('xml', 'malformed.xml'), { type: 'NHAP' }));
});
