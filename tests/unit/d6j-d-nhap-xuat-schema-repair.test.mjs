import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'd6jCOneRecordProductionMutation.js',
    'sgdsSheetsLedgerAdapter.js',
    'hashUtils.js',
    'sheetNhapXuat.js'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'config.js',
    'normalization.js',
    'hashUtils.js',
    'sgdsAdapterErrors.js',
    'sgdsGmailAdapter.js',
    'sgdsDriveAdapter.js',
    'sgdsSheetsLedgerAdapter.js',
    'durableJobState.js',
    'firestoreDataContract.js',
    'firestoreRestGateway.js',
    'firestoreDurableJobStore.js',
    'd6jBProductionDryRunReadOnly.js',
    'd6jCOneRecordProductionMutation.js'
  ],
  exportNames: [
    'D6J_D_INSPECT_ENTRYPOINT_',
    'D6J_D_REPAIR_ENTRYPOINT_',
    'D6J_D_REPAIR_APPROVAL_',
    'D6J_D_REPAIR_APPROVAL_PROPERTY_',
    'createD6jDNhapXuatSchemaRepairRunner_',
    'inspectD6jDMalformedPilotRow_',
    'findD6jDMalformedPilotRows_',
    'buildD6jCNhapXuatRowAP_',
    'calculateD6jDInventoryForTarget_',
    'buildD6jCInvoiceItemHash_',
    'normalizeD6jDNhapXuatRowFromValues_',
    'assertD6jCSheetRowMatches_',
    'createFakeSgdsSheetsLedgerAdapter_'
  ]
});

const fromVm = value => JSON.parse(JSON.stringify(value));

const headers = [
  'STT',
  'Ngay',
  'Hoa don so',
  'Ten khach hang',
  'Ma hang',
  'Ten hang',
  'Phan loai',
  'So luong',
  'Don gia',
  'Thanh tien',
  'Don gia BQ',
  'So luong ton',
  'Gia tri ton',
  'HashIndex',
  'InvoiceKey',
  'HD'
];

function expectedLedgerRow(overrides = {}) {
  const base = {
    issueDate: '2026-03-09',
    invoiceNo: '00000248',
    customerName: 'SYNTHETIC SELLER',
    sellerTaxCode: '0100000001',
    legacyInvoiceKey: '20260309_0100000001_00000248',
    invoiceKeyV2: '20260309_0100000001_00000248',
    sourceLineNo: 1,
    lineIdentityV2: 'synthetic-transaction-identity',
    transactionIdentity: 'synthetic-transaction-identity',
    direction: 'NHAP',
    itemCode: 'ITEM-1',
    itemName: 'Synthetic steel item',
    quantity: 2,
    unitPrice: 100,
    amount: 200
  };
  const merged = { ...base, ...overrides };
  merged.legacyHashIndex = overrides.legacyHashIndex || gas.call('buildD6jCInvoiceItemHash_', merged);
  return merged;
}

function makeContext(overrides = {}) {
  const row = expectedLedgerRow(overrides.row || {});
  return {
    ledgerRows: [row],
    plan: {
      driveTargets: {
        xml: { contentHash: 'synthetic-xml-hash' },
        pdf: { contentHash: 'synthetic-pdf-hash' }
      }
    }
  };
}

function row(values, rowNumber, formulasR1C1 = []) {
  return {
    rowNumber,
    values: values.concat(Array(Math.max(0, 16 - values.length)).fill('')).slice(0, 16),
    formulas: Array(16).fill(''),
    formulasR1C1: Array(16).fill('').map((_, index) => formulasR1C1[index] || ''),
    numberFormats: Array(16).fill('')
  };
}

function priorRow() {
  return row([
    1,
    '2026-01-01',
    '00000100',
    'SYNTHETIC SELLER',
    'ITEM-1',
    'Synthetic steel item',
    'NHAP',
    10,
    50,
    500,
    50,
    10,
    500,
    'prior-hash',
    '20260101_0100000001_00000100',
    ''
  ], 2, { 15: '=HYPERLINK("https://drive.example/"&RC[-1],"HD")' });
}

function malformedRow(context = makeContext()) {
  const rowData = context.ledgerRows[0];
  return row([
    2,
    rowData.issueDate,
    '',
    '',
    rowData.itemCode,
    rowData.itemName,
    rowData.direction,
    rowData.quantity,
    rowData.unitPrice,
    rowData.legacyInvoiceKey,
    rowData.transactionIdentity,
    context.plan.driveTargets.xml.contentHash,
    context.plan.driveTargets.pdf.contentHash,
    rowData.invoiceKeyV2,
    '',
    ''
  ], 3);
}

function makeSnapshot(options = {}) {
  const context = options.context || makeContext();
  const rows = [priorRow()];
  if (options.malformedCount !== 0) rows.push(malformedRow(context));
  if (options.malformedCount === 2) rows.push(malformedRow(context));
  if (options.laterSameItem) {
    rows.push(row([
      4,
      '2026-04-01',
      '00000300',
      'SYNTHETIC SELLER',
      'ITEM-1',
      'Synthetic steel item',
      'XUAT',
      1,
      0,
      50,
      50,
      11,
      550,
      'later-hash',
      'later-key',
      ''
    ], 4, { 15: '=HYPERLINK("https://drive.example/"&RC[-1],"HD")' }));
  }
  return { headers, rows };
}

function makeSource(snapshot) {
  const state = {
    snapshot: fromVm(snapshot),
    updates: [],
    appends: 0,
    deletes: 0,
    driveMutations: 0,
    gmailMutations: 0,
    triggerMutations: 0,
    destructiveOperations: 0
  };
  return {
    state,
    readSnapshot() {
      return fromVm(state.snapshot);
    },
    updateRowCells(request) {
      state.updates.push(fromVm(request));
      const target = state.snapshot.rows.find(item => item.rowNumber === request.rowNumber);
      for (const change of request.changes) {
        const index = change.column - 1;
        if (change.formulaR1C1) target.formulasR1C1[index] = change.formulaR1C1;
        else target.values[index] = change.value;
      }
      return { updatedRowCount: 1, updatedCellCount: request.changes.length };
    }
  };
}

function makeRunner({ props = {}, snapshot = makeSnapshot(), context = makeContext(), source = null } = {}) {
  const actualSource = source || makeSource(snapshot);
  const logger = { lines: [], log(value) { this.lines.push(String(value)); } };
  const runner = gas.call('createD6jDNhapXuatSchemaRepairRunner_', {
    readProperties: () => props,
    buildRepairContext: () => context,
    createSheetsSource: () => actualSource,
    createJobStore: () => ({ appendAuditEvent: async () => ({ status: 'RECORDED' }) }),
    clock: { now: () => '2026-07-26T00:00:00.000Z' },
    logger
  });
  return { runner, source: actualSource, logger, context };
}

test('metadata and D6J-D entrypoint contract are canonical', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D6J_D_INSPECT_ENTRYPOINT_, 'runD6jDInspectMalformedPilotRowReadOnly');
  assert.equal(gas.exports.D6J_D_REPAIR_ENTRYPOINT_, 'runD6jDRepairSingleMalformedPilotRow');
  assert.equal(gas.exports.D6J_D_REPAIR_APPROVAL_PROPERTY_, 'D6J_D_REPAIR_APPROVAL_MARKER');
  assert.equal(gas.exports.D6J_D_REPAIR_APPROVAL_, 'OWNER_APPROVED_D6J_D_SINGLE_PILOT_ROW_REPAIR');
});

test('read-only audit derives exact A:P mapping with invoice number, seller, amount, weighted average, hash, key, and HD formula', () => {
  const context = makeContext();
  const inspection = fromVm(gas.call('inspectD6jDMalformedPilotRow_', makeSnapshot({ context }), context, { includeRawCells: true }));
  assert.equal(inspection.targetRowNumber, 3);
  assert.equal(inspection.headerSchemaStatus, 'PASS');
  assert.equal(inspection.expected.values.length, 16);
  assert.equal(inspection.expected.values[2], '00000248');
  assert.equal(inspection.expected.values[3], 'SYNTHETIC SELLER');
  assert.equal(inspection.expected.values[9], 200);
  assert.equal(inspection.expected.values[10], 700 / 12);
  assert.equal(inspection.expected.values[11], 12);
  assert.equal(inspection.expected.values[12], 700);
  assert.equal(inspection.expected.values[13], context.ledgerRows[0].legacyHashIndex);
  assert.equal(inspection.expected.values[14], context.ledgerRows[0].invoiceKeyV2);
  assert.equal(inspection.hdRule.type, 'ROW_RELATIVE_FORMULA');
  assert.equal(inspection.expected.pFormulaR1C1, '=HYPERLINK("https://drive.example/"&RC[-1],"HD")');
});

test('zero-row and multiple-row malformed matches block before repair', () => {
  const context = makeContext();
  assert.throws(() => gas.call('inspectD6jDMalformedPilotRow_', makeSnapshot({ context, malformedCount: 0 }), context), /BLOCKED_D6J_D_MALFORMED_ROW_NOT_FOUND/);
  assert.throws(() => gas.call('inspectD6jDMalformedPilotRow_', makeSnapshot({ context, malformedCount: 2 }), context), /BLOCKED_D6J_D_MALFORMED_ROW_NOT_UNIQUE/);
});

test('later same-item transactions block the bounded single-row repair', () => {
  const context = makeContext();
  assert.throws(() => gas.call('inspectD6jDMalformedPilotRow_', makeSnapshot({ context, laterSameItem: true }), context), /BLOCKED_LATER_ITEM_TRANSACTIONS_REQUIRE_BOUNDED_REBUILD/);
});

test('missing and wrong repair markers block before mutation', async () => {
  const missing = makeRunner();
  const missingResult = fromVm(await missing.runner.repair());
  assert.equal(missingResult.REPAIR_STATUS, 'BLOCKED_INVALID_D6J_D_REPAIR_APPROVAL_MARKER');
  assert.equal(missing.source.state.updates.length, 0);

  const wrong = makeRunner({ props: { D6J_D_REPAIR_APPROVAL_MARKER: 'OWNER_APPROVED_WRONG' } });
  const wrongResult = fromVm(await wrong.runner.repair());
  assert.equal(wrongResult.REPAIR_STATUS, 'BLOCKED_INVALID_D6J_D_REPAIR_APPROVAL_MARKER');
  assert.equal(wrong.source.state.updates.length, 0);
});

test('successful repair updates exactly one row, appends zero rows, and preserves Drive/Gmail/trigger/destructive counters', async () => {
  const context = makeContext();
  const h = makeRunner({
    props: { D6J_D_REPAIR_APPROVAL_MARKER: 'OWNER_APPROVED_D6J_D_SINGLE_PILOT_ROW_REPAIR' },
    context,
    snapshot: makeSnapshot({ context })
  });
  const result = fromVm(await h.runner.repair());
  assert.equal(result.REPAIR_STATUS, 'PASS_SINGLE_MALFORMED_PILOT_ROW_REPAIRED');
  assert.equal(result.SHEET_ROWS_UPDATED, 1);
  assert.equal(result.SHEET_ROWS_APPENDED, 0);
  assert.equal(result.SHEET_ROWS_DELETED, 0);
  assert.equal(result.DRIVE_MUTATION_COUNT, 0);
  assert.equal(result.GMAIL_MUTATION_COUNT, 0);
  assert.equal(result.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(result.DESTRUCTIVE_OPERATION_COUNT, 0);
  assert.equal(h.source.state.updates.length, 1);
  assert.equal(h.source.state.appends, 0);
  assert.deepEqual(h.source.state.updates[0].changes.map(change => change.column), [3, 4, 10, 11, 12, 13, 14, 15, 16]);
});

test('future D6J-C idempotent rerun recognizes corrected row by canonical HashIndex and InvoiceKey', async () => {
  const context = makeContext();
  const corrected = gas.call('buildD6jCNhapXuatRowAP_', context.ledgerRows[0], context.plan, { averageUnitCost: 700 / 12, stockQuantity: 12, stockValue: 700 }, { type: 'ROW_RELATIVE_FORMULA', formulaR1C1: '=HYPERLINK("https://drive.example/"&RC[-1],"HD")' });
  const normalized = fromVm(gas.call('normalizeD6jDNhapXuatRowFromValues_', corrected.values));
  const fake = gas.call('createFakeSgdsSheetsLedgerAdapter_', { ledgerRows: [normalized] });
  const found = fromVm(await fake.read.findTransactionByIdentity({ hashIndex: context.ledgerRows[0].legacyHashIndex, invoiceKeyV2: context.ledgerRows[0].invoiceKeyV2 }));
  assert.equal(found.status, 'ALREADY_PRESENT');
  assert.equal(found.rows.length, 1);
});

test('malformed J:N layout can never pass D6J-C readback semantics', () => {
  const context = makeContext();
  const malformed = fromVm(gas.call('normalizeD6jDNhapXuatRowFromValues_', malformedRow(context).values));
  assert.throws(() => gas.call('assertD6jCSheetRowMatches_', malformed, context.ledgerRows[0]), /BLOCKED_D6J_C_SHEET_TRANSACTION_CONFLICT/);
});

test('source contains no repair approval marker configuration, forbidden rerun, destructive Sheet, Drive, Gmail, or trigger mutation', () => {
  const source = fs.readFileSync('d6jCOneRecordProductionMutation.js', 'utf8');
  for (const required of [
    'runD6jDInspectMalformedPilotRowReadOnly',
    'runD6jDRepairSingleMalformedPilotRow',
    'D6J_D_REPAIR_APPROVAL_MARKER',
    'OWNER_APPROVED_D6J_D_SINGLE_PILOT_ROW_REPAIR',
    'BLOCKED_HD_COLUMN_RULE_UNRESOLVED',
    'BLOCKED_LATER_ITEM_TRANSACTIONS_REQUIRE_BOUNDED_REBUILD',
    'buildD6jCNhapXuatRowAP_',
    'calculateD6jDInventoryForTarget_',
    'findD6jDMalformedPilotRows_'
  ]) {
    assert.equal(source.includes(required), true, `missing source marker: ${required}`);
  }
  for (const forbidden of [
    'runD6jCOneRecordProductionMutation();',
    'ScriptApp.newTrigger',
    'ScriptApp.deleteTrigger',
    '.deleteRow(',
    '.clear(',
    '.setTrashed(',
    'DriveApp.removeFile',
    'GmailApp.move',
    'GmailApp.mark',
    '--force'
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden source token present: ${forbidden}`);
  }
});
