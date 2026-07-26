const D6J_D4_SCHEMA_VERSION_ = 'D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE_V1';
const D6J_D4_ENTRYPOINT_ = 'runD6jD4PostRepairVerificationReadOnly';
const D6J_D4_PHASE_ = 'D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE';
const D6J_D4_TARGET_ROW_NUMBER_ = 1337;
const D6J_D4_ORIGINAL_JOB_ID_ = 'd6j_job_10ad66ede74a1121b0d6';
const D6J_D4_GMAIL_MESSAGE_ID_ = '19cd03f07ebbd84e';
const D6J_D4_PDF_FILENAME_ = '1C26THD_00000248.pdf';
const D6J_D4_XML_FILENAME_ = '1C26THD_00000248.xml';
const D6J_D4_PDF_SHA256_ = '7c8f7b7a577d9fd83ff1581408113b956166ed95f13704aaed2a3769d8136b07';
const D6J_D4_XML_SHA256_ = 'cbf4cc62c466e8a94561f862685241060e0302e3ac9067cdacf8bdf4ede984f3';
const D6J_D4_INVOICE_KEY_ = '20260309_1000677957_00000248';
const D6J_D4_HASH_INDEX_ = 'a0b8fab983cef571272e723c155e5fa4c0c118f05ccf5a77080bee3e7b4a5472';
const D6J_D4_EXPECTED_CHANGED_COLUMNS_ = Object.freeze([3, 4, 10, 11, 12, 13, 14, 15]);
const D6J_D4_FORBIDDEN_TRIGGERS_ = Object.freeze([
  'runD6jBProductionDryRunReadOnly',
  'runD6jCOneRecordProductionMutation',
  'runD6jDInspectMalformedPilotRowReadOnly',
  'runD6jDRepairSingleMalformedPilotRow',
  D6J_D4_ENTRYPOINT_
]);

const D6J_D4_EXPECTED_ROW_ = Object.freeze({
  A: 1282,
  B: '20260309',
  C: '00000248',
  D: 'CÃ”NG TY TNHH THÃ‰P HOÃ€NG ÄÃ€O',
  E: 'THEPTAM',
  F: 'ThÃ©p táº¥m cháº¥n mÃ£ Ä‘áº§u cá»c',
  G: 'NHAP',
  H: 2282,
  I: 15455,
  J: 35268310,
  K: 15155.064244559413,
  L: 14352.011000000035,
  M: 217505648.7436239,
  N: D6J_D4_HASH_INDEX_,
  O: D6J_D4_INVOICE_KEY_
});

function runD6jD4PostRepairVerificationReadOnly() {
  const runner = createD6jD4PostRepairVerificationReadOnlyRunner_();
  return runner.run();
}

function createD6jD4PostRepairVerificationReadOnlyRunner_(deps) {
  const d = deps || {};
  const services = {
    readProperties: d.readProperties || readD6jD4PropertiesReadOnly_,
    runPreflight: d.runPreflight || (() => createD6jBProductionDryRunReadOnlyRunner_().run()),
    readSheetSnapshot: d.readSheetSnapshot || readD6jD4SheetSnapshotReadOnly_,
    readFirestoreDocument: d.readFirestoreDocument || readD6jD4FirestoreDocumentReadOnly_,
    queryFirestoreCollection: d.queryFirestoreCollection || queryD6jD4FirestoreCollectionReadOnly_,
    inspectDriveArtifacts: d.inspectDriveArtifacts || inspectD6jD4DriveArtifactsReadOnly_,
    inspectGmailArtifacts: d.inspectGmailArtifacts || inspectD6jD4GmailArtifactsReadOnly_,
    listTriggers: d.listTriggers || listD6jD4TriggersReadOnly_,
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log() {} })
  };

  async function run() {
    const result = createD6jD4BaseResult_();
    try {
      const properties = services.readProperties();
      assertD6jD4RepairMarkerAbsent_(properties, result);
      const preflight = services.runPreflight(properties);
      assertD6jD4Preflight_(preflight, result);
      const snapshot = services.readSheetSnapshot(properties);
      const sheet = inspectD6jD4CanonicalSheetState_(snapshot);
      mergeD6jD4Result_(result, sheet);
      const fire = await inspectD6jD4FirestoreAudit_(services);
      mergeD6jD4Result_(result, fire);
      const drive = services.inspectDriveArtifacts(properties, preflight);
      assertD6jD4DriveArtifacts_(drive);
      mergeD6jD4Result_(result, drive);
      const gmail = services.inspectGmailArtifacts(properties, preflight);
      assertD6jD4GmailArtifacts_(gmail);
      mergeD6jD4Result_(result, gmail);
      const trigger = inspectD6jD4Triggers_(services.listTriggers());
      mergeD6jD4Result_(result, trigger);
      result.POST_REPAIR_STATUS = 'PASS';
      result.D6J_D_CHANNEL_STATUS = 'CLOSED';
      finalizeD6jD4ReadOnlyCounts_(result);
      logD6jD4SanitizedResult_(services.logger, result);
      return result;
    } catch (error) {
      const code = normalizeD6jD4ErrorCode_(error && (error.code || error.message) || 'BLOCKED_D6J_D4_UNKNOWN');
      result.POST_REPAIR_STATUS = code.indexOf('RECONCILIATION_REQUIRED') === 0 ? 'RECONCILIATION_REQUIRED' : 'BLOCKED';
      result.D6J_D_CHANNEL_STATUS = 'NOT_CLOSED';
      result.BLOCKER_CODE = code;
      finalizeD6jD4ReadOnlyCounts_(result);
      logD6jD4SanitizedResult_(services.logger, result);
      return result;
    }
  }

  return Object.freeze({ run });
}

function createD6jD4BaseResult_() {
  return {
    PHASE: D6J_D4_PHASE_,
    POST_REPAIR_STATUS: 'NOT_STARTED',
    TARGET_ROW_NUMBER: D6J_D4_TARGET_ROW_NUMBER_,
    CANONICAL_ROW_MATCH_COUNT: 0,
    CANONICAL_VALUES_MATCH: 'NO',
    AMOUNT_MATCH: 'NO',
    AVERAGE_UNIT_COST_MATCH: 'NO',
    STOCK_QUANTITY_MATCH: 'NO',
    STOCK_VALUE_MATCH: 'NO',
    HASH_INDEX_MATCH: 'NO',
    INVOICE_KEY_MATCH: 'NO',
    PRESERVED_VALUES_MATCH: 'NO',
    DATE_CELL_STILL_DATE: 'NO',
    DATE_CANONICAL_MATCH: 'NO',
    DATE_NUMBER_FORMAT_PRESERVED: 'NO',
    HD_FORMULA_PRESENT: 'NO',
    HD_FORMULA_ROW_REFERENCE_MATCH: 'NO',
    HD_FORMULA_PRESERVED: 'NO',
    INVOICE_KEY_ROW_COUNT: 0,
    HASH_INDEX_ROW_COUNT: 0,
    BUSINESS_IDENTITY_ROW_COUNT: 0,
    DUPLICATE_ROW_COUNT: 0,
    UNEXPECTED_DUPLICATE_APPEND_FOUND: 'NO',
    FIRESTORE_REPAIR_AUDIT_COUNT: 0,
    FIRESTORE_REPAIR_AUDIT_FOUND: 'NO',
    FIRESTORE_REPAIR_AUDIT_COLUMNS_MATCH: 'NO',
    FIRESTORE_BEFORE_HASH_PRESENT: 'NO',
    FIRESTORE_AFTER_HASH_PRESENT: 'NO',
    FIRESTORE_BEFORE_AFTER_HASH_DIFFER: 'NO',
    ORIGINAL_JOB_FOUND: 'NO',
    ORIGINAL_JOB_STATUS: '',
    ORIGINAL_JOB_HISTORY_PRESERVED: 'NO',
    DRIVE_ARTIFACTS_UNCHANGED: 'NO',
    DRIVE_EXPECTED_FILE_COUNT: 2,
    DRIVE_EXACT_MATCH_COUNT: 0,
    GMAIL_SOURCE_ARTIFACTS_UNCHANGED: 'NO',
    GMAIL_MESSAGE_ID: D6J_D4_GMAIL_MESSAGE_ID_,
    GMAIL_MESSAGE_FOUND: 'NO',
    ATTACHMENT_COUNT: 0,
    REPAIR_APPROVAL_MARKER_PRESENT: 'UNKNOWN',
    D6J_TRIGGER_COUNT: 0,
    UNEXPECTED_D6J_TRIGGER_FOUND: 'UNKNOWN',
    SHEETS_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION: 'NONE',
    D6J_D_CHANNEL_STATUS: 'NOT_CLOSED',
    BLOCKER_CODE: '',
    SCHEMA_VERSION: D6J_D4_SCHEMA_VERSION_
  };
}

function assertD6jD4RepairMarkerAbsent_(properties, result) {
  const present = Boolean(normalizeD6jD4String_(properties && properties.D6J_D_REPAIR_APPROVAL_MARKER));
  result.REPAIR_APPROVAL_MARKER_PRESENT = present ? 'YES' : 'NO';
  if (present) throw d6jD4Error_('BLOCKED_D6J_D4_REPAIR_APPROVAL_MARKER_STILL_PRESENT');
}

function assertD6jD4Preflight_(preflight, result) {
  const r = preflight || {};
  mergeD6jD4Result_(result, {
    DRY_RUN_STATUS: r.DRY_RUN_STATUS || '',
    GMAIL_MESSAGE_ID_MATCH: r.GMAIL_MESSAGE_ID_MATCH || 'NO',
    PDF_FILENAME_MATCH: r.PDF_FILENAME_MATCH || 'NO',
    PDF_MIME_TYPE_MATCH: r.PDF_MIME_TYPE_MATCH || 'NO',
    XML_FILENAME_MATCH: r.XML_FILENAME_MATCH || 'NO',
    XML_MIME_TYPE_MATCH: r.XML_MIME_TYPE_MATCH || 'NO',
    DRIVE_DUPLICATE_STATUS: r.DRIVE_DUPLICATE_STATUS || '',
    SPREADSHEET_ID_MATCH: r.SPREADSHEET_ID_MATCH || 'NO',
    TARGET_SHEET_MATCH: r.TARGET_SHEET_MATCH || 'NO',
    HEADER_SCHEMA_STATUS: r.HEADER_SCHEMA_STATUS || '',
    PRODUCTION_MUTATION_COUNT: Number(r.PRODUCTION_MUTATION_COUNT || 0)
  });
  const checks = [
    [r.DRY_RUN_STATUS === 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY', 'BLOCKED_D6J_D4_PREFLIGHT_STATUS'],
    [r.GMAIL_MESSAGE_ID_MATCH === 'YES' && normalizeD6jD4String_(r.GMAIL_MESSAGE_ID) === D6J_D4_GMAIL_MESSAGE_ID_, 'BLOCKED_D6J_D4_GMAIL_MESSAGE_ID_MISMATCH'],
    [Number(r.ATTACHMENT_COUNT) === 2, 'BLOCKED_D6J_D4_ATTACHMENT_COUNT'],
    [r.PDF_FILENAME_MATCH === 'YES' && normalizeD6jD4String_(r.PDF_SHA256) === D6J_D4_PDF_SHA256_, 'BLOCKED_D6J_D4_PDF_PREFLIGHT_MISMATCH'],
    [r.XML_FILENAME_MATCH === 'YES' && normalizeD6jD4String_(r.XML_SHA256) === D6J_D4_XML_SHA256_, 'BLOCKED_D6J_D4_XML_PREFLIGHT_MISMATCH'],
    [r.PDF_MIME_TYPE_MATCH === 'YES', 'BLOCKED_D6J_D4_PDF_MIME_TYPE_MISMATCH'],
    [r.XML_MIME_TYPE_MATCH === 'YES', 'BLOCKED_D6J_D4_XML_MIME_TYPE_MISMATCH'],
    [r.DRIVE_DUPLICATE_STATUS === 'EXISTING_EXACT_MATCH', 'BLOCKED_D6J_D4_DRIVE_DUPLICATE_STATUS'],
    [r.SPREADSHEET_ID_MATCH === 'YES', 'BLOCKED_D6J_D4_SPREADSHEET_ID_MISMATCH'],
    [r.TARGET_SHEET_MATCH === 'YES', 'BLOCKED_D6J_D4_TARGET_SHEET_MISMATCH'],
    [r.HEADER_SCHEMA_STATUS === 'PASS', 'BLOCKED_D6J_D4_HEADER_SCHEMA_STATUS'],
    [Number(r.PRODUCTION_MUTATION_COUNT || 0) === 0, 'BLOCKED_D6J_D4_PREFLIGHT_MUTATION_COUNT']
  ];
  checks.forEach(pair => {
    if (!pair[0]) throw d6jD4Error_(pair[1]);
  });
}

function inspectD6jD4CanonicalSheetState_(snapshot) {
  const source = snapshot || {};
  assertD6jDHeaderSchema_(source.headers || []);
  const rows = source.rows || [];
  const canonicalMatches = rows.filter(isD6jD4CanonicalRowMatch_);
  if (canonicalMatches.length === 0) throw d6jD4Error_('BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND');
  if (canonicalMatches.length > 1) throw d6jD4Error_('BLOCKED_D6J_D4_CANONICAL_ROW_NOT_UNIQUE');
  const target = canonicalMatches[0];
  if (Number(target.rowNumber) !== D6J_D4_TARGET_ROW_NUMBER_) throw d6jD4Error_('BLOCKED_D6J_D4_TARGET_ROW_NUMBER_CHANGED');
  const v = target.values || [];
  const formats = target.numberFormats || [];
  const formulas = target.formulas || [];
  const formulasR1C1 = target.formulasR1C1 || [];
  assertD6jD4CanonicalValues_(v);
  assertD6jD4PreservedCells_(v, formats);
  assertD6jD4Formula_(formulas[15] || formulasR1C1[15], formulasR1C1[15] || formulas[15]);
  const counts = countD6jD4Duplicates_(rows);
  if (counts.invoiceKey > 1 || counts.hashIndex > 1 || counts.businessIdentity > 1) throw d6jD4Error_('BLOCKED_D6J_D4_DUPLICATE_ROW_FOUND');
  return {
    CANONICAL_ROW_MATCH_COUNT: 1,
    TARGET_ROW_NUMBER: Number(target.rowNumber),
    CANONICAL_VALUES_MATCH: 'YES',
    AMOUNT_MATCH: 'YES',
    AVERAGE_UNIT_COST_MATCH: 'YES',
    STOCK_QUANTITY_MATCH: 'YES',
    STOCK_VALUE_MATCH: 'YES',
    HASH_INDEX_MATCH: 'YES',
    INVOICE_KEY_MATCH: 'YES',
    PRESERVED_VALUES_MATCH: 'YES',
    DATE_CELL_STILL_DATE: 'YES',
    DATE_CANONICAL_MATCH: 'YES',
    DATE_NUMBER_FORMAT_PRESERVED: 'YES',
    HD_FORMULA_PRESENT: 'YES',
    HD_FORMULA_ROW_REFERENCE_MATCH: 'YES',
    HD_FORMULA_PRESERVED: 'YES',
    INVOICE_KEY_ROW_COUNT: counts.invoiceKey,
    HASH_INDEX_ROW_COUNT: counts.hashIndex,
    BUSINESS_IDENTITY_ROW_COUNT: counts.businessIdentity,
    DUPLICATE_ROW_COUNT: 0,
    UNEXPECTED_DUPLICATE_APPEND_FOUND: 'NO'
  };
}

function isD6jD4CanonicalRowMatch_(row) {
  const v = row && row.values || [];
  return normalizeD6jD4String_(v[14]) === D6J_D4_INVOICE_KEY_
    && normalizeD6jD4String_(v[13]) === D6J_D4_HASH_INDEX_
    && tryNormalizeD6jCComparableDate_(v[1]).value === D6J_D4_EXPECTED_ROW_.B
    && normalizeD6jD4String_(v[2]) === D6J_D4_EXPECTED_ROW_.C
    && normalizeD6jD4String_(v[3]) === D6J_D4_EXPECTED_ROW_.D
    && normalizeD6jD4String_(v[4]) === D6J_D4_EXPECTED_ROW_.E
    && normalizeD6jD4String_(v[5]) === D6J_D4_EXPECTED_ROW_.F
    && normalizeD6jD4String_(v[6]) === D6J_D4_EXPECTED_ROW_.G
    && numbersEqualD6jD_(v[7], D6J_D4_EXPECTED_ROW_.H)
    && numbersEqualD6jD_(v[8], D6J_D4_EXPECTED_ROW_.I);
}

function assertD6jD4CanonicalValues_(v) {
  [
    [3, D6J_D4_EXPECTED_ROW_.C, 'BLOCKED_D6J_D4_C_MISMATCH'],
    [4, D6J_D4_EXPECTED_ROW_.D, 'BLOCKED_D6J_D4_D_MISMATCH'],
    [14, D6J_D4_EXPECTED_ROW_.N, 'BLOCKED_D6J_D4_N_HASH_INDEX_MISMATCH'],
    [15, D6J_D4_EXPECTED_ROW_.O, 'BLOCKED_D6J_D4_O_INVOICE_KEY_MISMATCH']
  ].forEach(([column, expected, code]) => {
    if (normalizeD6jD4String_(v[column - 1]) !== expected) throw d6jD4Error_(code);
  });
  [
    [10, D6J_D4_EXPECTED_ROW_.J, 'BLOCKED_D6J_D4_J_AMOUNT_MISMATCH'],
    [11, D6J_D4_EXPECTED_ROW_.K, 'BLOCKED_D6J_D4_K_AVERAGE_UNIT_COST_MISMATCH'],
    [12, D6J_D4_EXPECTED_ROW_.L, 'BLOCKED_D6J_D4_L_STOCK_QUANTITY_MISMATCH'],
    [13, D6J_D4_EXPECTED_ROW_.M, 'BLOCKED_D6J_D4_M_STOCK_VALUE_MISMATCH']
  ].forEach(([column, expected, code]) => {
    if (!numbersEqualD6jD_(v[column - 1], expected)) throw d6jD4Error_(code);
  });
}

function assertD6jD4PreservedCells_(v, formats) {
  if (!numbersEqualD6jD_(v[0], D6J_D4_EXPECTED_ROW_.A)) throw d6jD4Error_('BLOCKED_D6J_D4_A_MISMATCH');
  if (!isD6jCDateObject_(v[1])) throw d6jD4Error_('BLOCKED_D6J_D4_B_NOT_DATE_OBJECT');
  const date = tryNormalizeD6jCComparableDate_(v[1]);
  if (!date.valid || date.value !== D6J_D4_EXPECTED_ROW_.B) throw d6jD4Error_('BLOCKED_D6J_D4_B_DATE_CANONICAL_MISMATCH');
  if (!isD6jD4DateNumberFormat_(formats && formats[1])) throw d6jD4Error_('BLOCKED_D6J_D4_B_NUMBER_FORMAT_MISMATCH');
  [
    [5, D6J_D4_EXPECTED_ROW_.E],
    [6, D6J_D4_EXPECTED_ROW_.F],
    [7, D6J_D4_EXPECTED_ROW_.G]
  ].forEach(([column, expected]) => {
    if (normalizeD6jD4String_(v[column - 1]) !== expected) throw d6jD4Error_('BLOCKED_D6J_D4_' + columnLetterD6jD_(column) + '_MISMATCH');
  });
  [
    [8, D6J_D4_EXPECTED_ROW_.H],
    [9, D6J_D4_EXPECTED_ROW_.I]
  ].forEach(([column, expected]) => {
    if (!numbersEqualD6jD_(v[column - 1], expected)) throw d6jD4Error_('BLOCKED_D6J_D4_' + columnLetterD6jD_(column) + '_MISMATCH');
  });
}

function assertD6jD4Formula_(formula, formulaR1C1) {
  const a1 = normalizeD6jD4Formula_(formula);
  const r1c1 = normalizeD6jD4Formula_(formulaR1C1);
  const combined = (a1 + ' ' + r1c1).trim();
  if (!combined) throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_MISSING');
  if (combined.indexOf('HYPERLINK') < 0) throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_HYPERLINK_MISSING');
  if (combined.indexOf('HOA-DON') < 0 && combined.indexOf('HOADON') < 0) throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_HOA_DON_REFERENCE_MISSING');
  if (combined.indexOf('XLOOKUP') < 0 && combined.indexOf('VLOOKUP') < 0 && combined.indexOf('INDEX') < 0) throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_LOOKUP_MISSING');
  if (combined.indexOf('O1337') < 0 && combined.indexOf('RC[-1]') < 0 && combined.indexOf('RC[-1'.toUpperCase()) < 0) {
    throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_ROW_REFERENCE_MISMATCH');
  }
}

function countD6jD4Duplicates_(rows) {
  return (rows || []).reduce((acc, row) => {
    const v = row.values || [];
    if (normalizeD6jD4String_(v[14]) === D6J_D4_INVOICE_KEY_) acc.invoiceKey += 1;
    if (normalizeD6jD4String_(v[13]) === D6J_D4_HASH_INDEX_) acc.hashIndex += 1;
    if (tryNormalizeD6jCComparableDate_(v[1]).value === D6J_D4_EXPECTED_ROW_.B
      && normalizeD6jD4String_(v[4]) === D6J_D4_EXPECTED_ROW_.E
      && normalizeD6jD4String_(v[5]) === D6J_D4_EXPECTED_ROW_.F
      && normalizeD6jD4String_(v[6]) === D6J_D4_EXPECTED_ROW_.G
      && numbersEqualD6jD_(v[7], D6J_D4_EXPECTED_ROW_.H)
      && numbersEqualD6jD_(v[8], D6J_D4_EXPECTED_ROW_.I)) {
      acc.businessIdentity += 1;
    }
    return acc;
  }, { invoiceKey: 0, hashIndex: 0, businessIdentity: 0 });
}

async function inspectD6jD4FirestoreAudit_(services) {
  const job = await services.readFirestoreDocument('jobs/' + D6J_D4_ORIGINAL_JOB_ID_);
  if (!job) throw d6jD4Error_('BLOCKED_D6J_D4_ORIGINAL_JOB_NOT_FOUND');
  const status = normalizeD6jD4String_(job.status).toLowerCase();
  if (status !== 'completed') throw d6jD4Error_('BLOCKED_D6J_D4_ORIGINAL_JOB_NOT_COMPLETED');
  const events = await services.queryFirestoreCollection('jobs/' + D6J_D4_ORIGINAL_JOB_ID_ + '/events');
  const matches = (events || []).filter(event => normalizeD6jD4String_(event.eventType) === 'D6J_D_SINGLE_ROW_REPAIR'
    && normalizeD6jD4String_(event.jobId || D6J_D4_ORIGINAL_JOB_ID_) === D6J_D4_ORIGINAL_JOB_ID_);
  if (matches.length === 0) throw d6jD4Error_('RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_MISSING');
  if (matches.length > 1) throw d6jD4Error_('RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_NOT_UNIQUE');
  const detail = matches[0].safeDetails || matches[0];
  const columns = normalizeD6jD4Columns_(detail.changedColumns);
  const expected = D6J_D4_EXPECTED_CHANGED_COLUMNS_.join(',');
  if (columns.join(',') !== expected) throw d6jD4Error_('RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_INVALID');
  const beforeHash = normalizeD6jD4String_(detail.beforeHash);
  const afterHash = normalizeD6jD4String_(detail.afterHash);
  if (!beforeHash || !afterHash || beforeHash === afterHash || !isD6jD4ValidTimestamp_(detail.repairedAt)) {
    throw d6jD4Error_('RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_INVALID');
  }
  return {
    FIRESTORE_REPAIR_AUDIT_COUNT: 1,
    FIRESTORE_REPAIR_AUDIT_FOUND: 'YES',
    FIRESTORE_REPAIR_AUDIT_COLUMNS_MATCH: 'YES',
    FIRESTORE_BEFORE_HASH_PRESENT: 'YES',
    FIRESTORE_AFTER_HASH_PRESENT: 'YES',
    FIRESTORE_BEFORE_AFTER_HASH_DIFFER: 'YES',
    ORIGINAL_JOB_FOUND: 'YES',
    ORIGINAL_JOB_STATUS: 'completed',
    ORIGINAL_JOB_HISTORY_PRESERVED: 'YES'
  };
}

function assertD6jD4DriveArtifacts_(drive) {
  if (!drive || drive.DRIVE_ARTIFACTS_UNCHANGED !== 'YES' || Number(drive.DRIVE_EXACT_MATCH_COUNT) !== 2) {
    throw d6jD4Error_('BLOCKED_D6J_D4_DRIVE_ARTIFACT_MISMATCH');
  }
}

function assertD6jD4GmailArtifacts_(gmail) {
  if (!gmail || gmail.GMAIL_SOURCE_ARTIFACTS_UNCHANGED !== 'YES' || gmail.GMAIL_MESSAGE_FOUND !== 'YES' || Number(gmail.ATTACHMENT_COUNT) !== 2) {
    throw d6jD4Error_('BLOCKED_D6J_D4_GMAIL_ARTIFACT_MISMATCH');
  }
}

function inspectD6jD4Triggers_(triggers) {
  const names = (triggers || []).map(trigger => normalizeD6jD4String_(typeof trigger.getHandlerFunction === 'function' ? trigger.getHandlerFunction() : trigger.handlerFunction || trigger));
  const count = names.filter(name => D6J_D4_FORBIDDEN_TRIGGERS_.indexOf(name) >= 0).length;
  if (count) throw d6jD4Error_('BLOCKED_D6J_D4_UNEXPECTED_D6J_TRIGGER_FOUND');
  return { D6J_TRIGGER_COUNT: 0, UNEXPECTED_D6J_TRIGGER_FOUND: 'NO', TRIGGER_MUTATION_COUNT: 0 };
}

function readD6jD4PropertiesReadOnly_() {
  const props = PropertiesService.getScriptProperties();
  const out = readD6jBScriptProperties_();
  out.D6J_D_REPAIR_APPROVAL_MARKER = String(props.getProperty('D6J_D_REPAIR_APPROVAL_MARKER') || '').trim();
  return out;
}

function readD6jD4SheetSnapshotReadOnly_(properties) {
  const spreadsheet = SpreadsheetApp.openById(properties.D6J_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(properties.D6J_SHEET_NAME);
  if (!sheet) throw d6jD4Error_('BLOCKED_D6J_D4_TARGET_SHEET_MISSING');
  return readD6jDSheetSnapshotFromSheet_(sheet);
}

function readD6jD4FirestoreDocumentReadOnly_(path) {
  return createD6jCFirestoreDurableTransport_().getDocument(path);
}

function queryD6jD4FirestoreCollectionReadOnly_(path) {
  return createD6jCFirestoreDurableTransport_().queryDocuments(path);
}

function inspectD6jD4DriveArtifactsReadOnly_(properties, preflight) {
  const folder = DriveApp.getFolderById(properties.D6J_DRIVE_ROOT_FOLDER_ID);
  const expected = [
    { name: D6J_D4_PDF_FILENAME_, sha256: D6J_D4_PDF_SHA256_ },
    { name: D6J_D4_XML_FILENAME_, sha256: D6J_D4_XML_SHA256_ }
  ];
  let exact = 0;
  expected.forEach(item => {
    const iterator = folder.getFilesByName(item.name);
    while (iterator.hasNext()) {
      const file = iterator.next();
      const bytes = file.getBlob().getBytes();
      if (sha256D6jBBytes_(bytes) === item.sha256) exact += 1;
    }
  });
  return {
    DRIVE_ARTIFACTS_UNCHANGED: exact === 2 && preflight.DRIVE_DUPLICATE_STATUS === 'EXISTING_EXACT_MATCH' ? 'YES' : 'NO',
    DRIVE_EXPECTED_FILE_COUNT: 2,
    DRIVE_EXACT_MATCH_COUNT: exact,
    DRIVE_MUTATION_COUNT: 0
  };
}

function inspectD6jD4GmailArtifactsReadOnly_(properties) {
  const config = validateD6jBConfig_(properties);
  const query = buildD6jBGmailQuery_(config);
  const gmail = inspectD6jBGmailReadOnly_((q, start, max) => GmailApp.search(q, start, max), query, config);
  const ok = gmail.GMAIL_MESSAGE_ID === D6J_D4_GMAIL_MESSAGE_ID_
    && Number(gmail.ATTACHMENT_COUNT) === 2
    && gmail.PDF_SHA256 === D6J_D4_PDF_SHA256_
    && gmail.XML_SHA256 === D6J_D4_XML_SHA256_;
  return {
    GMAIL_MESSAGE_ID: D6J_D4_GMAIL_MESSAGE_ID_,
    GMAIL_MESSAGE_FOUND: ok ? 'YES' : 'NO',
    ATTACHMENT_COUNT: Number(gmail.ATTACHMENT_COUNT || 0),
    GMAIL_SOURCE_ARTIFACTS_UNCHANGED: ok ? 'YES' : 'NO',
    GMAIL_MUTATION_COUNT: 0
  };
}

function listD6jD4TriggersReadOnly_() {
  return ScriptApp.getProjectTriggers();
}

function isD6jD4DateNumberFormat_(format) {
  const value = normalizeD6jD4String_(format).toLowerCase().replace(/\\/g, '');
  return value === 'yyyy-mm-dd' || value === 'yyyy/mm/dd' || value.indexOf('yyyy') >= 0 && value.indexOf('mm') >= 0 && value.indexOf('dd') >= 0;
}

function normalizeD6jD4Formula_(value) {
  return normalizeD6jD4String_(value).toUpperCase().replace(/\s+/g, '');
}

function normalizeD6jD4Columns_(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return source.map(Number).filter(number => Number.isInteger(number)).sort((a, b) => a - b);
}

function isD6jD4ValidTimestamp_(value) {
  return Number.isFinite(Date.parse(normalizeD6jD4String_(value)));
}

function finalizeD6jD4ReadOnlyCounts_(result) {
  result.SHEETS_MUTATION_COUNT = 0;
  result.DRIVE_MUTATION_COUNT = 0;
  result.GMAIL_MUTATION_COUNT = 0;
  result.FIRESTORE_MUTATION_COUNT = 0;
  result.TRIGGER_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
  result.PRODUCTION_MUTATION = 'NONE';
}

function mergeD6jD4Result_(target, patch) {
  Object.keys(patch || {}).forEach(key => {
    target[key] = patch[key];
  });
}

function logD6jD4SanitizedResult_(logger, result) {
  const text = JSON.stringify(result);
  if (/(Bearer|Authorization|refresh_token|private_key|client_secret|<\?xml|<Invoice|JVBERi0|\b80,68,70\b)/i.test(text)) {
    throw d6jD4Error_('BLOCKED_UNSAFE_D6J_D4_LOG_PAYLOAD');
  }
  logger.log(text);
}

function normalizeD6jD4String_(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function normalizeD6jD4ErrorCode_(value) {
  return normalizeD6jD4String_(value).split(':')[0].split(';')[0].replace(/[^A-Z0-9_]/g, '_').slice(0, 100) || 'BLOCKED_D6J_D4_UNKNOWN';
}

function d6jD4Error_(code) {
  const error = new Error(String(code));
  error.code = normalizeD6jD4ErrorCode_(code);
  return error;
}
