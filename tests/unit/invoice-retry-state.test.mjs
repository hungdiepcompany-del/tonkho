import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['gmailSearch.js', 'gmailLabels.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const CONFIG = {
  INVOICE_FROMDATE: '2026/01/01',
  MAX_EMAIL_SCAN: 50,
  SAVE_SHEET_LABEL: 'SAVED_SHEET',
  SAVE_PDF_LABEL: 'SAVED_PDF',
  SAVE_XML_LABEL: 'SAVED_XML',
  PENDING_LABEL: 'PENDING'
};

const labels = new Map();
function labelFor(name) {
  if (!labels.has(name)) {
    labels.set(name, { getName: () => name });
  }
  return labels.get(name);
}

const gas = loadGasSource({
  files: ['gmailSearch.js', 'gmailLabels.js'],
  exportNames: [
    'buildInvoiceQuery_',
    'threadHasAllLabel_',
    'setExclusiveLabel_'
  ],
  stubs: {
    CONFIG,
    GmailApp: {
      getUserLabelByName: name => labelFor(name),
      createLabel: name => labelFor(name)
    }
  }
});

function makeThread(initialNames = []) {
  const names = new Set(initialNames);
  return {
    names,
    getLabels: () => Array.from(names, labelFor),
    addLabel: label => names.add(label.getName()),
    removeLabel: label => names.delete(label.getName())
  };
}

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'REGRESSION_INVARIANT'));

test('invoice Gmail query always rediscovers PENDING partial states', () => {
  const query = gas.call(
    'buildInvoiceQuery_',
    'INVOICE_IN',
    CONFIG.SAVE_SHEET_LABEL,
    CONFIG.SAVE_PDF_LABEL
  );

  assert.match(query, /-label:"SAVED_SHEET"/);
  assert.match(query, /-label:"SAVED_PDF"/);
  assert.match(query, /label:"PENDING"/);
  assert.match(query, / OR /);
});

test('PENDING overrides normal done labels for early-skip checks', () => {
  const partial = makeThread([
    CONFIG.SAVE_SHEET_LABEL,
    CONFIG.SAVE_XML_LABEL,
    CONFIG.PENDING_LABEL
  ]);

  assert.equal(
    gas.call(
      'threadHasAllLabel_',
      partial,
      [CONFIG.SAVE_SHEET_LABEL, CONFIG.SAVE_XML_LABEL]
    ),
    false
  );

  const complete = makeThread([
    CONFIG.SAVE_SHEET_LABEL,
    CONFIG.SAVE_XML_LABEL
  ]);

  assert.equal(
    gas.call(
      'threadHasAllLabel_',
      complete,
      [CONFIG.SAVE_SHEET_LABEL, CONFIG.SAVE_XML_LABEL]
    ),
    true
  );
});

test('ledger success adds SAVED_SHEET without erasing scanner-owned PENDING', () => {
  const thread = makeThread([CONFIG.PENDING_LABEL]);

  gas.call('setExclusiveLabel_', thread, 'SAVED_SHEET');

  assert.equal(thread.names.has(CONFIG.SAVE_SHEET_LABEL), true);
  assert.equal(thread.names.has(CONFIG.PENDING_LABEL), true);
});

test('failed ledger projection still removes stale SAVED_SHEET and asserts PENDING', () => {
  const thread = makeThread([CONFIG.SAVE_SHEET_LABEL]);

  gas.call('setExclusiveLabel_', thread, 'PENDING');

  assert.equal(thread.names.has(CONFIG.SAVE_SHEET_LABEL), false);
  assert.equal(thread.names.has(CONFIG.PENDING_LABEL), true);
});
