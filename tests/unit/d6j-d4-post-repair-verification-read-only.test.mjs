import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { findD6jD4MojibakeIndicatorsInSource } from '../../scripts/checkers/check-d6j-d4-utf8-canonical-integrity.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['d6jD4PostRepairVerificationReadOnly.js', 'd6jBProductionDryRunReadOnly.js', 'd6jCOneRecordProductionMutation.js'],
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
    'd6jCOneRecordProductionMutation.js',
    'd6jD4PostRepairVerificationReadOnly.js'
  ],
  exportNames: [
    'D6J_D4_ENTRYPOINT_',
    'D6J_D4_SCHEMA_VERSION_',
    'D6J_D4_EXPECTED_ROW_',
    'createD6jD4PostRepairVerificationReadOnlyRunner_',
    'inspectD6jD4CanonicalSheetState_',
    'normalizeD6jD4ExactText_',
    'evaluateD6jD4RowFieldMatches_',
    'inspectD6jD4Triggers_',
    'assertD6jD4DriveArtifacts_',
    'assertD6jD4GmailArtifacts_'
  ]
});

const fromVm = value => JSON.parse(JSON.stringify(value));
const seller = 'C\u00D4NG TY TNHH TH\u00C9P HO\u00C0NG \u0110\u00C0O';
const itemName = 'Th\u00E9p t\u1EA5m ch\u1EA5n m\u00E3 \u0111\u1EA7u c\u1ECDc';
const mojibakeSeller = 'C\u00C3\u201DNG TY TNHH TH\u00C3\u2030P HO\u00C3\u20ACNG \u00C4\u0090\u00C3\u20ACO';
const mojibakeItemName = 'Th\u00C3\u00A9p t\u00E1\u00BA\u00A5m ch\u00E1\u00BA\u00A5n m\u00C3\u00A3 \u00C4\u2018\u00E1\u00BA\u00A7u c\u00E1\u00BB\u008Dc';
const hashIndex = 'a0b8fab983cef571272e723c155e5fa4c0c118f05ccf5a77080bee3e7b4a5472';
const invoiceKey = '20260309_1000677957_00000248';
const pdfHash = '7c8f7b7a577d9fd83ff1581408113b956166ed95f13704aaed2a3769d8136b07';
const xmlHash = 'cbf4cc62c466e8a94561f862685241060e0302e3ac9067cdacf8bdf4ede984f3';
const formula = '=HYPERLINK(XLOOKUP(O1337,\'Hoa-Don\'!O:O,\'Hoa-Don\'!P:P),"HD")';
const formulaR1C1 = '=HYPERLINK(XLOOKUP(RC[-1],\'Hoa-Don\'!C15,\'Hoa-Don\'!C16),"HD")';

const headers = [
  'STT',
  'Ngày',
  'Hóa đơn số',
  'Tên khách hàng',
  'Mã hàng',
  'Tên hàng',
  'Phân loại',
  'Số lượng',
  'Đơn giá',
  'Thành tiền',
  'Đơn giá BQ',
  'Số lượng tồn',
  'Giá trị tồn',
  'HashIndex',
  'InvoiceKey',
  'HĐ'
];

function clone(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
  return value;
}

function repairedRow(overrides = {}) {
  const values = [
    1282,
    new Date(2026, 2, 9),
    '00000248',
    seller,
    'THEPTAM',
    itemName,
    'NHAP',
    2282,
    15455,
    35268310,
    15155.064244559413,
    14352.011000000035,
    217505648.7436239,
    hashIndex,
    invoiceKey,
    ''
  ];
  Object.entries(overrides.values || {}).forEach(([index, value]) => {
    values[Number(index)] = value;
  });
  return {
    rowNumber: overrides.rowNumber || 1337,
    values,
    formulas: Array(16).fill('').map((_, index) => index === 15 ? (overrides.formula === undefined ? formula : overrides.formula) : ''),
    formulasR1C1: Array(16).fill('').map((_, index) => index === 15 ? (overrides.formulaR1C1 === undefined ? formulaR1C1 : overrides.formulaR1C1) : ''),
    numberFormats: Array(16).fill('').map((_, index) => index === 1 ? (overrides.dateFormat || 'yyyy-mm-dd') : '')
  };
}

function snapshot(options = {}) {
  const rows = [
    { rowNumber: 2, values: [1, new Date(2026, 0, 1), 'x', 'Other', 'OTHER', 'Other item', 'NHAP', 1, 2, 2, 2, 1, 2, 'other-hash', 'other-key', ''], formulas: Array(16).fill(''), formulasR1C1: Array(16).fill(''), numberFormats: Array(16).fill('') }
  ];
  if (options.target !== false) rows.push(repairedRow(options.targetOverrides || {}));
  if (options.extraRows) rows.push(...options.extraRows);
  return { headers, rows };
}

function passPreflight(overrides = {}) {
  return {
    DRY_RUN_STATUS: 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY',
    GMAIL_MESSAGE_ID: '19cd03f07ebbd84e',
    GMAIL_MESSAGE_ID_MATCH: 'YES',
    ATTACHMENT_COUNT: 2,
    PDF_FILENAME_MATCH: 'YES',
    PDF_MIME_TYPE_MATCH: 'YES',
    PDF_SHA256: pdfHash,
    XML_FILENAME_MATCH: 'YES',
    XML_MIME_TYPE_MATCH: 'YES',
    XML_SHA256: xmlHash,
    DRIVE_DUPLICATE_STATUS: 'EXISTING_EXACT_MATCH',
    SPREADSHEET_ID_MATCH: 'YES',
    TARGET_SHEET_MATCH: 'YES',
    HEADER_SCHEMA_STATUS: 'PASS',
    SHEETS_INSERTS_PLANNED: 0,
    SHEETS_UPDATES_PLANNED: 0,
    SHEETS_DUPLICATE_STATUS: 'EXISTING_CANONICAL_MATCH',
    PRODUCTION_MUTATION_COUNT: 0,
    ...overrides
  };
}

function firestore(overrides = {}) {
  const event = {
    jobId: 'd6j_job_10ad66ede74a1121b0d6',
    eventType: 'D6J_D_SINGLE_ROW_REPAIR',
    safeDetails: {
      changedColumns: [3, 4, 10, 11, 12, 13, 14, 15],
      beforeHash: 'before-hash',
      afterHash: 'after-hash',
      repairedAt: '2026-07-26T00:00:00.000Z'
    }
  };
  return {
    job: { jobId: 'd6j_job_10ad66ede74a1121b0d6', status: 'COMPLETED' },
    events: [event],
    ...overrides
  };
}

function makeRunner(options = {}) {
  const state = { driveMutations: 0, gmailMutations: 0, sheetMutations: 0, firestoreWrites: 0, triggerMutations: 0, repairCalled: 0 };
  const fire = firestore(options.firestore || {});
  const logger = { lines: [], log(value) { this.lines.push(String(value)); } };
  const runner = gas.call('createD6jD4PostRepairVerificationReadOnlyRunner_', {
    readProperties: () => ({ D6J_D_REPAIR_APPROVAL_MARKER: options.repairMarker || '' }),
    runPreflight: () => passPreflight(options.preflight || {}),
    readSheetSnapshot: () => clone(options.snapshot || snapshot()),
    readFirestoreDocument: async () => clone(fire.job),
    queryFirestoreCollection: async () => clone(fire.events),
    inspectDriveArtifacts: () => options.drive || { DRIVE_ARTIFACTS_UNCHANGED: 'YES', DRIVE_EXPECTED_FILE_COUNT: 2, DRIVE_EXACT_MATCH_COUNT: 2, DRIVE_MUTATION_COUNT: 0 },
    inspectGmailArtifacts: () => options.gmail || { GMAIL_MESSAGE_ID: '19cd03f07ebbd84e', GMAIL_MESSAGE_FOUND: 'YES', ATTACHMENT_COUNT: 2, GMAIL_SOURCE_ARTIFACTS_UNCHANGED: 'YES', GMAIL_MUTATION_COUNT: 0 },
    listTriggers: () => options.triggers || [],
    logger
  });
  return { runner, state, logger };
}

test('metadata and D6J-D4 entrypoint contract are canonical', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D6J_D4_ENTRYPOINT_, 'runD6jD4PostRepairVerificationReadOnly');
  assert.equal(gas.exports.D6J_D4_SCHEMA_VERSION_, 'D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE_V1');
});

test('exact Vietnamese customer and item expectations are clean NFC runtime values', () => {
  const expected = fromVm(gas.exports.D6J_D4_EXPECTED_ROW_);
  assert.equal(expected.D, seller);
  assert.equal(expected.F, itemName);
  assert.equal(gas.call('normalizeD6jD4ExactText_', seller.normalize('NFD')), seller);
  assert.equal(gas.call('normalizeD6jD4ExactText_', itemName.normalize('NFD')), itemName);
  assert.equal([...expected.D].some(character => character.codePointAt(0) === 0x0110), true);
  assert.equal([...expected.F].some(character => character.codePointAt(0) === 0x1EA5), true);
  assert.notEqual(gas.call('normalizeD6jD4ExactText_', mojibakeSeller), seller);
  assert.notEqual(gas.call('normalizeD6jD4ExactText_', mojibakeItemName), itemName);
});

test('UTF-8 integrity checker detects prior mojibake and passes clean escaped source', () => {
  const corruptedSource = [
    'const customer = "',
    '\u00C3\u0192',
    '"; const item = "',
    '\u00C3\u00A1\u00C2\u00BA',
    '";'
  ].join('');
  const cleanEscapedSource = "const customer = 'C\\u00D4NG TY TNHH TH\\u00C9P HO\\u00C0NG \\u0110\\u00C0O';";
  assert.equal(findD6jD4MojibakeIndicatorsInSource(corruptedSource).length >= 2, true);
  assert.equal(findD6jD4MojibakeIndicatorsInSource(cleanEscapedSource).length, 0);
});

test('exact canonical row 1337 passes and closes the D6J-D channel', async () => {
  const h = makeRunner();
  const result = fromVm(await h.runner.run());
  assert.equal(result.POST_REPAIR_STATUS, 'PASS');
  assert.equal(result.D6J_D_CHANNEL_STATUS, 'CLOSED');
  assert.equal(result.TARGET_ROW_NUMBER, 1337);
  assert.equal(result.CANONICAL_ROW_MATCH_COUNT, 1);
  assert.equal(result.TARGET_ROW_PRESENT, 'YES');
  assert.deepEqual(result.TARGET_ROW_FIELD_MATCHES, {
    A_MATCH: true,
    B_MATCH: true,
    C_MATCH: true,
    D_MATCH: true,
    E_MATCH: true,
    F_MATCH: true,
    G_MATCH: true,
    H_MATCH: true,
    I_MATCH: true,
    J_MATCH: true,
    K_MATCH: true,
    L_MATCH: true,
    M_MATCH: true,
    N_MATCH: true,
    O_MATCH: true,
    P_FORMULA_MATCH: true
  });
  assert.equal(result.CANONICAL_VALUES_MATCH, 'YES');
  assert.equal(result.PRESERVED_VALUES_MATCH, 'YES');
  assert.equal(result.DATE_CELL_STILL_DATE, 'YES');
  assert.equal(result.DATE_CANONICAL_MATCH, 'YES');
  assert.equal(result.DATE_NUMBER_FORMAT_PRESERVED, 'YES');
  assert.equal(result.HD_FORMULA_PRESENT, 'YES');
  assert.equal(result.HD_FORMULA_PRESERVED, 'YES');
  assert.equal(result.INVOICE_KEY_ROW_COUNT, 1);
  assert.equal(result.HASH_INDEX_ROW_COUNT, 1);
  assert.equal(result.BUSINESS_IDENTITY_ROW_COUNT, 1);
  assert.equal(result.DUPLICATE_ROW_COUNT, 0);
  assert.equal(result.FIRESTORE_REPAIR_AUDIT_FOUND, 'YES');
  assert.equal(result.ORIGINAL_JOB_STATUS, 'completed');
  assert.equal(result.DRIVE_ARTIFACTS_UNCHANGED, 'YES');
  assert.equal(result.GMAIL_SOURCE_ARTIFACTS_UNCHANGED, 'YES');
  assert.equal(result.REPAIR_APPROVAL_MARKER_PRESENT, 'NO');
  assert.equal(result.D6J_TRIGGER_COUNT, 0);
  assert.equal(result.SHEETS_INSERTS_PLANNED, 0);
  assert.equal(result.SHEETS_UPDATES_PLANNED, 0);
  assert.equal(result.SHEETS_DUPLICATE_STATUS, 'EXISTING_CANONICAL_MATCH');
  assert.equal(result.SHEET_VERIFICATION_STATUS, 'PASS');
  assert.equal(result.FIRESTORE_VERIFICATION_STATUS, 'PASS');
  assert.equal(result.DRIVE_VERIFICATION_STATUS, 'PASS');
  assert.equal(result.GMAIL_VERIFICATION_STATUS, 'PASS');
  assert.equal(result.TRIGGER_VERIFICATION_STATUS, 'PASS');
  assert.equal(result.PRODUCTION_MUTATION, 'NONE');
});

test('D mismatch returns sanitized field-level diagnostics and leaves later stages not evaluated', async () => {
  const h = makeRunner({ snapshot: snapshot({ targetOverrides: { values: { 3: 'BAD SELLER' } } }) });
  const result = fromVm(await h.runner.run());
  assert.equal(result.BLOCKER_CODE, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND');
  assert.equal(result.TARGET_ROW_PRESENT, 'YES');
  assert.equal(result.TARGET_ROW_FIELD_MATCHES.D_MATCH, false);
  assert.equal(result.TARGET_ROW_FIELD_MATCHES.F_MATCH, true);
  assert.equal(result.SHEET_VERIFICATION_STATUS, 'BLOCKED');
  assert.equal(result.FIRESTORE_VERIFICATION_STATUS, 'NOT_EVALUATED');
  assert.equal(result.DRIVE_VERIFICATION_STATUS, 'NOT_EVALUATED');
  assert.equal(result.GMAIL_VERIFICATION_STATUS, 'NOT_EVALUATED');
  assert.equal(result.TRIGGER_VERIFICATION_STATUS, 'NOT_EVALUATED');
  assert.equal(JSON.stringify(result).includes('BAD SELLER'), false);
});

test('F mismatch returns sanitized field-level diagnostics', async () => {
  const h = makeRunner({ snapshot: snapshot({ targetOverrides: { values: { 5: 'BAD ITEM' } } }) });
  const result = fromVm(await h.runner.run());
  assert.equal(result.BLOCKER_CODE, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND');
  assert.equal(result.TARGET_ROW_FIELD_MATCHES.D_MATCH, true);
  assert.equal(result.TARGET_ROW_FIELD_MATCHES.F_MATCH, false);
  assert.equal(JSON.stringify(result).includes('BAD ITEM'), false);
});

test('D6J-D4 blocks if preflight still plans inserting the existing canonical row', async () => {
  const h = makeRunner({ preflight: { SHEETS_INSERTS_PLANNED: 1, SHEETS_DUPLICATE_STATUS: 'NO_DUPLICATE_FOUND' } });
  const result = fromVm(await h.runner.run());
  assert.equal(result.BLOCKER_CODE, 'BLOCKED_D6J_D4_PREFLIGHT_WOULD_INSERT_EXISTING_CANONICAL_ROW');
  assert.equal(result.SHEETS_INSERTS_PLANNED, 1);
  assert.equal(result.SHEET_VERIFICATION_STATUS, 'BLOCKED');
  assert.equal(result.FIRESTORE_VERIFICATION_STATUS, 'NOT_EVALUATED');
  assert.equal(result.PRODUCTION_MUTATION, 'NONE');
});

const blockedCases = [
  ['zero canonical rows block', { snapshot: snapshot({ target: false }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['multiple canonical rows block', { snapshot: snapshot({ extraRows: [repairedRow({ rowNumber: 1400 })] }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_UNIQUE'],
  ['canonical row at another row number blocks', { snapshot: snapshot({ targetOverrides: { rowNumber: 1338 } }) }, 'BLOCKED_D6J_D4_TARGET_ROW_NUMBER_CHANGED'],
  ['C mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 2: 'BAD' } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['D mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 3: 'BAD SELLER' } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['J numeric mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 9: 1 } } }) }, 'BLOCKED_D6J_D4_J_AMOUNT_MISMATCH'],
  ['K numeric mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 10: 1 } } }) }, 'BLOCKED_D6J_D4_K_AVERAGE_UNIT_COST_MISMATCH'],
  ['L numeric mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 11: 1 } } }) }, 'BLOCKED_D6J_D4_L_STOCK_QUANTITY_MISMATCH'],
  ['M numeric mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 12: 1 } } }) }, 'BLOCKED_D6J_D4_M_STOCK_VALUE_MISMATCH'],
  ['N mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 13: 'bad-hash' } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['O mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 14: 'bad-key' } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['A mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 0: 999 } } }) }, 'BLOCKED_D6J_D4_A_MISMATCH'],
  ['B not a Date object blocks', { snapshot: snapshot({ targetOverrides: { values: { 1: '2026-03-09' } } }) }, 'BLOCKED_D6J_D4_B_NOT_DATE_OBJECT'],
  ['B canonical date mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 1: new Date(2026, 2, 10) } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['B number format mismatch blocks', { snapshot: snapshot({ targetOverrides: { dateFormat: 'General' } }) }, 'BLOCKED_D6J_D4_B_NUMBER_FORMAT_MISMATCH'],
  ['E mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 4: 'BAD' } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['F mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 5: 'BAD' } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['G mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 6: 'XUAT' } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['H mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 7: 1 } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['I mismatch blocks', { snapshot: snapshot({ targetOverrides: { values: { 8: 1 } } }) }, 'BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND'],
  ['missing P formula blocks', { snapshot: snapshot({ targetOverrides: { formula: '', formulaR1C1: '' } }) }, 'BLOCKED_D6J_D4_P_FORMULA_MISSING'],
  ['wrong P row reference blocks', { snapshot: snapshot({ targetOverrides: { formula: "=HYPERLINK(XLOOKUP(O999,'Hoa-Don'!O:O,'Hoa-Don'!P:P),\"HD\")", formulaR1C1: "=HYPERLINK(XLOOKUP(R[1]C[-1],'Hoa-Don'!C15,'Hoa-Don'!C16),\"HD\")" } }) }, 'BLOCKED_D6J_D4_P_FORMULA_ROW_REFERENCE_MISMATCH'],
  ['duplicate InvoiceKey blocks', { snapshot: snapshot({ extraRows: [{ ...repairedRow({ rowNumber: 1400 }), values: repairedRow({ rowNumber: 1400, values: { 13: 'other-hash', 4: 'OTHER', 5: 'Other', 7: 1, 8: 2 } }).values } ] }) }, 'BLOCKED_D6J_D4_DUPLICATE_ROW_FOUND'],
  ['duplicate HashIndex blocks', { snapshot: snapshot({ extraRows: [{ ...repairedRow({ rowNumber: 1400 }), values: repairedRow({ rowNumber: 1400, values: { 14: 'other-key', 4: 'OTHER', 5: 'Other', 7: 1, 8: 2 } }).values } ] }) }, 'BLOCKED_D6J_D4_DUPLICATE_ROW_FOUND'],
  ['duplicate business identity blocks', { snapshot: snapshot({ extraRows: [{ ...repairedRow({ rowNumber: 1400 }), values: repairedRow({ rowNumber: 1400, values: { 13: 'other-hash', 14: 'other-key' } }).values } ] }) }, 'BLOCKED_D6J_D4_DUPLICATE_ROW_FOUND'],
  ['missing Firestore audit returns reconciliation required', { firestore: { events: [] } }, 'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_MISSING'],
  ['multiple Firestore repair audits return reconciliation required', { firestore: { events: [firestore().events[0], firestore().events[0]] } }, 'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_NOT_UNIQUE'],
  ['wrong changedColumns returns reconciliation required', { firestore: { events: [{ ...firestore().events[0], safeDetails: { ...firestore().events[0].safeDetails, changedColumns: [3] } }] } }, 'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_INVALID'],
  ['missing beforeHash returns reconciliation required', { firestore: { events: [{ ...firestore().events[0], safeDetails: { ...firestore().events[0].safeDetails, beforeHash: '' } }] } }, 'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_INVALID'],
  ['missing afterHash returns reconciliation required', { firestore: { events: [{ ...firestore().events[0], safeDetails: { ...firestore().events[0].safeDetails, afterHash: '' } }] } }, 'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_INVALID'],
  ['original job not completed blocks closure', { firestore: { job: { jobId: 'd6j_job_10ad66ede74a1121b0d6', status: 'VALIDATED' } } }, 'BLOCKED_D6J_D4_ORIGINAL_JOB_NOT_COMPLETED'],
  ['Drive artifact hash mismatch blocks', { drive: { DRIVE_ARTIFACTS_UNCHANGED: 'NO', DRIVE_EXPECTED_FILE_COUNT: 2, DRIVE_EXACT_MATCH_COUNT: 1, DRIVE_MUTATION_COUNT: 0 } }, 'BLOCKED_D6J_D4_DRIVE_ARTIFACT_MISMATCH'],
  ['Gmail artifact hash mismatch blocks', { gmail: { GMAIL_MESSAGE_ID: '19cd03f07ebbd84e', GMAIL_MESSAGE_FOUND: 'YES', ATTACHMENT_COUNT: 2, GMAIL_SOURCE_ARTIFACTS_UNCHANGED: 'NO', GMAIL_MUTATION_COUNT: 0 } }, 'BLOCKED_D6J_D4_GMAIL_ARTIFACT_MISMATCH'],
  ['repair approval marker present blocks', { repairMarker: 'OWNER_APPROVED_D6J_D_SINGLE_PILOT_ROW_REPAIR' }, 'BLOCKED_D6J_D4_REPAIR_APPROVAL_MARKER_STILL_PRESENT'],
  ['unexpected D6J trigger blocks', { triggers: [{ handlerFunction: 'runD6jDRepairSingleMalformedPilotRow' }] }, 'BLOCKED_D6J_D4_UNEXPECTED_D6J_TRIGGER_FOUND']
];

for (const [name, options, code] of blockedCases) {
  test(`D6J-D4 ${name}`, async () => {
    const h = makeRunner(options);
    const result = fromVm(await h.runner.run());
    assert.equal(result.D6J_D_CHANNEL_STATUS, 'NOT_CLOSED');
    assert.equal(result.BLOCKER_CODE, code);
    assert.equal(result.PRODUCTION_MUTATION, 'NONE');
  });
}

test('D6J-D4 entrypoint performs zero writes and never invokes repair or production mutation entrypoints', async () => {
  const source = fs.readFileSync('d6jD4PostRepairVerificationReadOnly.js', 'utf8');
  for (const forbidden of [
    'runD6jDRepairSingleMalformedPilotRow(',
    'runD6jCOneRecordProductionMutation(',
    '.setValue(',
    '.setValues(',
    '.appendRow(',
    '.insertRow(',
    '.deleteRow(',
    'ScriptApp.newTrigger',
    'ScriptApp.deleteTrigger',
    '.setTrashed(',
    '.createFile(',
    'GmailApp.move',
    'GmailApp.mark',
    "method: 'post'",
    "method: 'patch'",
    "method: 'delete'"
  ]) {
    assert.equal(source.includes(forbidden), false, `forbidden mutation token present: ${forbidden}`);
  }
  const h = makeRunner();
  const result = fromVm(await h.runner.run());
  assert.equal(result.SHEETS_MUTATION_COUNT, 0);
  assert.equal(result.DRIVE_MUTATION_COUNT, 0);
  assert.equal(result.GMAIL_MUTATION_COUNT, 0);
  assert.equal(result.FIRESTORE_MUTATION_COUNT, 0);
  assert.equal(result.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(result.DESTRUCTIVE_OPERATION_COUNT, 0);
});
