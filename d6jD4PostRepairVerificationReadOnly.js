const D6J_D4_SCHEMA_VERSION_ = 'D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE_V1';
const D6J_D4_ENTRYPOINT_ = 'runD6jD4PostRepairVerificationReadOnly';
const D6J_D4_PHASE_ = 'D6J_D4_POST_REPAIR_READ_ONLY_VERIFICATION_AND_CHANNEL_CLOSURE';
const D6J_D4C_SCHEMA_VERSION_ = 'D6J_D4C_FIRESTORE_JOB_PATH_CENSUS_AND_REPAIR_AUDIT_RECONCILIATION_DIAGNOSTICS_V1';
const D6J_D4C_ENTRYPOINT_ = 'runD6jD4CFirestoreEvidenceDiagnosticsReadOnly';
const D6J_D4C_PHASE_ = 'D6J_D4C_FIRESTORE_JOB_PATH_CENSUS_AND_REPAIR_AUDIT_RECONCILIATION_DIAGNOSTICS';
const D6J_D4D_SCHEMA_VERSION_ = 'D6J_D4D_DURABLE_JOB_PATH_FIX_AND_POST_HOC_RECONCILIATION_EVIDENCE_V1';
const D6J_D4D_PREVIEW_ENTRYPOINT_ = 'runD6jD4DReconciliationPreviewReadOnly';
const D6J_D4D_MUTATION_ENTRYPOINT_ = 'runD6jD4DRecordPostHocReconciliationEvidenceOnce';
const D6J_D4D_PHASE_ = 'D6J_D4D_DURABLE_JOB_PATH_FIX_AND_POST_HOC_RECONCILIATION_EVIDENCE';
const D6J_D4D_RECONCILIATION_APPROVAL_PROPERTY_ = 'D6J_D4D_RECONCILIATION_APPROVAL_MARKER';
const D6J_D4D_RECONCILIATION_APPROVAL_ = 'OWNER_APPROVED_D6J_D4D_POST_HOC_RECONCILIATION_EVIDENCE';
const D6J_D4D_EVENT_TYPE_ = 'D6J_D_POST_HOC_RECONCILIATION_EVIDENCE';
const D6J_D4D_EVENT_ID_PREFIX_ = 'd6j_d4d_reconciliation_';
const D6J_D4D_RECONCILIATION_REASON_ = 'ORIGINAL_REPAIR_AUDIT_NOT_RECORDED_AFTER_CONFIRMED_SHEET_REPAIR';
const D6J_D4D_VERIFICATION_SOURCE_ = 'INDEPENDENT_POST_REPAIR_READ_ONLY_VERIFICATION';
const D6J_D4D_EXPECTED_D4C_STATUS_ = 'RECONCILIATION_REQUIRED_JOB_PRESENT_AUDIT_MISSING';
const D6J_D4C_JOBS_SCAN_LIMIT_ = 100;
const D6J_D4C_ALTERNATE_CANDIDATE_LIMIT_ = 5;
const D6J_D_LEGACY_JOB_COLLECTION_ = 'jobs';
const D6J_DURABLE_JOB_COLLECTION_ = 'invoiceJobs';
const D6J_D4C_LEGACY_JOB_COLLECTION_ = D6J_D_LEGACY_JOB_COLLECTION_;
const D6J_D4C_DURABLE_JOB_COLLECTION_ = D6J_DURABLE_JOB_COLLECTION_;
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
  D: 'C\u00D4NG TY TNHH TH\u00C9P HO\u00C0NG \u0110\u00C0O',
  E: 'THEPTAM',
  F: 'Th\u00E9p t\u1EA5m ch\u1EA5n m\u00E3 \u0111\u1EA7u c\u1ECDc',
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
  return blockD6kHistoricalPhaseEntrypoint_(D6J_D4_ENTRYPOINT_);
}

function runD6jD4PostRepairVerificationReadOnlyHistoricalImpl_() {
  const runner = createD6jD4PostRepairVerificationReadOnlyRunner_();
  return runner.run();
}

function runD6jD4CFirestoreEvidenceDiagnosticsReadOnly() {
  return blockD6kHistoricalPhaseEntrypoint_(D6J_D4C_ENTRYPOINT_);
}

function runD6jD4CFirestoreEvidenceDiagnosticsReadOnlyHistoricalImpl_() {
  const runner = createD6jD4CFirestoreEvidenceDiagnosticsReadOnlyRunner_();
  return runner.run();
}

function runD6jD4DReconciliationPreviewReadOnly() {
  return blockD6kHistoricalPhaseEntrypoint_(D6J_D4D_PREVIEW_ENTRYPOINT_);
}

function runD6jD4DReconciliationPreviewReadOnlyHistoricalImpl_() {
  const runner = createD6jD4DReconciliationPreviewReadOnlyRunner_();
  return runner.run();
}

function runD6jD4DRecordPostHocReconciliationEvidenceOnce() {
  return blockD6kHistoricalPhaseEntrypoint_(D6J_D4D_MUTATION_ENTRYPOINT_);
}

function runD6jD4DRecordPostHocReconciliationEvidenceOnceHistoricalImpl_() {
  const runner = createD6jD4DRecordPostHocReconciliationEvidenceRunner_();
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
      setD6jD4DReconciliationApprovalMarkerState_(properties, result);
      assertD6jD4RepairMarkerAbsent_(properties, result);
      const preflight = services.runPreflight(properties);
      const preflightState = assertD6jD4Preflight_(preflight, result);
      result.LAST_COMPLETED_VERIFICATION_STAGE = 'PREFLIGHT';
      const snapshot = services.readSheetSnapshot(properties);
      const sheet = inspectD6jD4CanonicalSheetState_(snapshot);
      mergeD6jD4Result_(result, sheet);
      result.SHEET_VERIFICATION_STATUS = 'PASS';
      result.LAST_COMPLETED_VERIFICATION_STAGE = 'SHEET';
      if (preflightState.sheetDuplicateStatus !== 'EXISTING_CANONICAL_MATCH') {
        throw d6jD4Error_('BLOCKED_D6J_D4_PREFLIGHT_CLASSIFIER_DISAGREEMENT', 'CLASSIFIER');
      }
      const fire = await inspectD6jD4FirestoreEvidence_(services, { properties, sheet });
      mergeD6jD4Result_(result, fire);
      if (fire.FIRESTORE_EVIDENCE_MODE === 'POST_HOC_RECONCILIATION') {
        assertD6jD4DPostHocClosureApprovalMarkerAbsent_(result);
      }
      result.FIRESTORE_VERIFICATION_STATUS = 'PASS';
      result.LAST_COMPLETED_VERIFICATION_STAGE = 'FIRESTORE';
      const drive = services.inspectDriveArtifacts(properties, preflight);
      assertD6jD4DriveArtifacts_(drive);
      mergeD6jD4Result_(result, drive);
      result.DRIVE_VERIFICATION_STATUS = 'PASS';
      result.LAST_COMPLETED_VERIFICATION_STAGE = 'DRIVE';
      const gmail = services.inspectGmailArtifacts(properties, preflight);
      assertD6jD4GmailArtifacts_(gmail);
      mergeD6jD4Result_(result, gmail);
      result.GMAIL_VERIFICATION_STATUS = 'PASS';
      result.LAST_COMPLETED_VERIFICATION_STAGE = 'GMAIL';
      const trigger = inspectD6jD4Triggers_(services.listTriggers());
      mergeD6jD4Result_(result, trigger);
      result.TRIGGER_VERIFICATION_STATUS = 'PASS';
      result.LAST_COMPLETED_VERIFICATION_STAGE = 'TRIGGER';
      if (fire.FIRESTORE_EVIDENCE_MODE === 'POST_HOC_RECONCILIATION') {
        result.POST_REPAIR_STATUS = 'PASS_RECONCILED';
        result.D6J_D_CHANNEL_STATUS = 'CLOSED_WITH_RECONCILIATION';
      } else {
        result.POST_REPAIR_STATUS = 'PASS';
        result.D6J_D_CHANNEL_STATUS = 'CLOSED';
      }
      finalizeD6jD4ReadOnlyCounts_(result);
      logD6jD4SanitizedResult_(services.logger, result);
      return result;
    } catch (error) {
      const code = normalizeD6jD4ErrorCode_(error && (error.code || error.message) || 'BLOCKED_D6J_D4_UNKNOWN');
      result.POST_REPAIR_STATUS = code.indexOf('RECONCILIATION_REQUIRED') === 0 ? 'RECONCILIATION_REQUIRED' : 'BLOCKED';
      result.D6J_D_CHANNEL_STATUS = 'NOT_CLOSED';
      result.BLOCKER_CODE = code;
      mergeD6jD4Result_(result, error && error.diagnostics);
      markD6jD4BlockedStage_(result, error, code);
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
    TARGET_ROW_PRESENT: 'NOT_EVALUATED',
    TARGET_ROW_FIELD_MATCHES: {},
    NEAR_CANONICAL_CANDIDATES: [],
    LAST_COMPLETED_VERIFICATION_STAGE: 'NOT_STARTED',
    SHEET_VERIFICATION_STATUS: 'NOT_EVALUATED',
    FIRESTORE_VERIFICATION_STATUS: 'NOT_EVALUATED',
    DRIVE_VERIFICATION_STATUS: 'NOT_EVALUATED',
    GMAIL_VERIFICATION_STATUS: 'NOT_EVALUATED',
    TRIGGER_VERIFICATION_STATUS: 'NOT_EVALUATED',
    SHEETS_INSERTS_PLANNED: 'NOT_EVALUATED',
    SHEETS_UPDATES_PLANNED: 'NOT_EVALUATED',
    SHEETS_DUPLICATE_STATUS: 'NOT_EVALUATED',
    CANONICAL_INVOICE_KEY_MATCH_COUNT: 0,
    CANONICAL_INVOICE_KEY_MATCH_ROWS: [],
    CANONICAL_HASH_INDEX_MATCH_COUNT: 0,
    CANONICAL_HASH_INDEX_MATCH_ROWS: [],
    CANONICAL_KEYS_MATCH_SAME_ROW: 'NOT_EVALUATED',
    CANONICAL_BUSINESS_IDENTITY_MATCH: 'NOT_EVALUATED',
    CANONICAL_BUSINESS_IDENTITY_FIELD_MATCHES: {},
    CANONICAL_DUPLICATE_CONFLICT_REASON: 'NOT_EVALUATED',
    CANONICAL_INVOICE_NUMBER: '',
    RAW_AND_DISPLAY_INVOICE_NUMBER_SEMANTIC_MATCH: 'NOT_EVALUATED',
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
    D6J_D4D_RECONCILIATION_APPROVAL_MARKER_PRESENT: 'UNKNOWN',
    D6J_TRIGGER_COUNT: 0,
    UNEXPECTED_D6J_TRIGGER_FOUND: 'UNKNOWN',
    DURABLE_JOB_COLLECTION: D6J_DURABLE_JOB_COLLECTION_,
    LEGACY_JOB_COLLECTION: D6J_D_LEGACY_JOB_COLLECTION_,
    LEGACY_JOB_PATH_USED_FOR_D6J_D4_CLOSURE: 'NO',
    FIRESTORE_EVIDENCE_MODE: 'NOT_EVALUATED',
    ORIGINAL_REPAIR_AUDIT_STATUS: 'NOT_EVALUATED',
    ORIGINAL_REPAIR_AUDIT_MATCH_COUNT: 0,
    POST_HOC_RECONCILIATION_EVENT_STATUS: 'NOT_EVALUATED',
    POST_HOC_RECONCILIATION_EVENT_MATCH_COUNT: 0,
    POST_HOC_RECONCILIATION_EVENT_FOUND: 'NO',
    VERIFIED_CURRENT_ROW_HASH: '',
    SHEETS_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION: 'NONE',
    D6J_D_CHANNEL_STATUS: 'NOT_CLOSED',
    CURRENT_ENTRYPOINT_EXECUTED: 'NO',
    PROHIBITED_D6J_D4_ENTRYPOINT_EXECUTED: 'NO',
    D6J_D4_ENTRYPOINT_EXECUTED: 'NO',
    D6J_D4C_ENTRYPOINT_EXECUTED: 'NO',
    D6J_D4D_PREVIEW_ENTRYPOINT_EXECUTED: 'NO',
    D6J_D4D_MUTATION_ENTRYPOINT_EXECUTED: 'NO',
    REPAIR_FUNCTION_EXECUTED: 'NO',
    D6J_C_FUNCTION_EXECUTED: 'NO',
    BLOCKER_CODE: '',
    SCHEMA_VERSION: D6J_D4_SCHEMA_VERSION_
  };
}

function assertD6jD4RepairMarkerAbsent_(properties, result) {
  const present = Boolean(normalizeD6jD4String_(properties && properties.D6J_D_REPAIR_APPROVAL_MARKER));
  result.REPAIR_APPROVAL_MARKER_PRESENT = present ? 'YES' : 'NO';
  if (present) throw d6jD4Error_('BLOCKED_D6J_D4_REPAIR_APPROVAL_MARKER_STILL_PRESENT', 'PREFLIGHT');
}

function setD6jD4DReconciliationApprovalMarkerState_(properties, result) {
  const present = Boolean(normalizeD6jD4String_(properties && properties[D6J_D4D_RECONCILIATION_APPROVAL_PROPERTY_]));
  result.D6J_D4D_RECONCILIATION_APPROVAL_MARKER_PRESENT = present ? 'YES' : 'NO';
}

function assertD6jD4DPostHocClosureApprovalMarkerAbsent_(result) {
  const state = normalizeD6jD4String_(result && result.D6J_D4D_RECONCILIATION_APPROVAL_MARKER_PRESENT);
  if (state === 'NO') return;
  if (state === 'YES') {
    throw d6jD4Error_('BLOCKED_D6J_D4D_RECONCILIATION_APPROVAL_MARKER_STILL_PRESENT', 'FIRESTORE');
  }
  throw d6jD4Error_('BLOCKED_D6J_D4D_RECONCILIATION_APPROVAL_MARKER_STATE_UNKNOWN', 'FIRESTORE');
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
    SHEETS_INSERTS_PLANNED: Number(r.SHEETS_INSERTS_PLANNED || 0),
    SHEETS_UPDATES_PLANNED: Number(r.SHEETS_UPDATES_PLANNED || 0),
    SHEETS_DUPLICATE_STATUS: r.SHEETS_DUPLICATE_STATUS || '',
    CANONICAL_INVOICE_KEY_MATCH_COUNT: Number(r.CANONICAL_INVOICE_KEY_MATCH_COUNT || 0),
    CANONICAL_INVOICE_KEY_MATCH_ROWS: Array.isArray(r.CANONICAL_INVOICE_KEY_MATCH_ROWS) ? r.CANONICAL_INVOICE_KEY_MATCH_ROWS.map(Number).filter(Number.isFinite) : [],
    CANONICAL_HASH_INDEX_MATCH_COUNT: Number(r.CANONICAL_HASH_INDEX_MATCH_COUNT || 0),
    CANONICAL_HASH_INDEX_MATCH_ROWS: Array.isArray(r.CANONICAL_HASH_INDEX_MATCH_ROWS) ? r.CANONICAL_HASH_INDEX_MATCH_ROWS.map(Number).filter(Number.isFinite) : [],
    CANONICAL_KEYS_MATCH_SAME_ROW: r.CANONICAL_KEYS_MATCH_SAME_ROW || 'NO',
    CANONICAL_BUSINESS_IDENTITY_MATCH: r.CANONICAL_BUSINESS_IDENTITY_MATCH || 'NO',
    CANONICAL_BUSINESS_IDENTITY_FIELD_MATCHES: r.CANONICAL_BUSINESS_IDENTITY_FIELD_MATCHES || {},
    CANONICAL_DUPLICATE_CONFLICT_REASON: r.CANONICAL_DUPLICATE_CONFLICT_REASON || 'NONE',
    CANONICAL_INVOICE_NUMBER: r.CANONICAL_INVOICE_NUMBER || '',
    RAW_AND_DISPLAY_INVOICE_NUMBER_SEMANTIC_MATCH: r.RAW_AND_DISPLAY_INVOICE_NUMBER_SEMANTIC_MATCH || 'NO',
    PRODUCTION_MUTATION_COUNT: Number(r.PRODUCTION_MUTATION_COUNT || 0)
  });
  if (r.SHEETS_DUPLICATE_STATUS === 'NO_DUPLICATE_FOUND' && Number(r.SHEETS_INSERTS_PLANNED || 0) > 0) {
    throw d6jD4Error_('BLOCKED_D6J_D4_PREFLIGHT_WOULD_INSERT_EXISTING_CANONICAL_ROW', 'SHEET');
  }
  const checks = [
    [r.DRY_RUN_STATUS === 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY' || r.SHEETS_DUPLICATE_STATUS === 'DUPLICATE_CONFLICT_REVIEW_REQUIRED', 'BLOCKED_D6J_D4_PREFLIGHT_STATUS'],
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
    [Number(r.SHEETS_INSERTS_PLANNED || 0) === 0, 'BLOCKED_D6J_D4_PREFLIGHT_SHEET_INSERT_PLAN_NOT_ZERO'],
    [Number(r.SHEETS_UPDATES_PLANNED || 0) === 0, 'BLOCKED_D6J_D4_PREFLIGHT_SHEET_UPDATE_PLAN_NOT_ZERO'],
    [r.SHEETS_DUPLICATE_STATUS === 'EXISTING_CANONICAL_MATCH' || r.SHEETS_DUPLICATE_STATUS === 'DUPLICATE_CONFLICT_REVIEW_REQUIRED', 'BLOCKED_D6J_D4_PREFLIGHT_SHEET_DUPLICATE_STATUS'],
    [Number(r.PRODUCTION_MUTATION_COUNT || 0) === 0, 'BLOCKED_D6J_D4_PREFLIGHT_MUTATION_COUNT']
  ];
  checks.forEach(pair => {
    if (!pair[0]) throw d6jD4Error_(pair[1], 'PREFLIGHT');
  });
  return { sheetDuplicateStatus: r.SHEETS_DUPLICATE_STATUS || '' };
}

function inspectD6jD4CanonicalSheetState_(snapshot) {
  const source = snapshot || {};
  assertD6jDHeaderSchema_(source.headers || []);
  const rows = source.rows || [];
  const canonicalMatches = rows.filter(isD6jD4CanonicalRowMatch_);
  if (canonicalMatches.length === 0) {
    throw d6jD4ErrorWithDiagnostics_('BLOCKED_D6J_D4_CANONICAL_ROW_NOT_FOUND', buildD6jD4CanonicalRowDiagnostics_(rows, canonicalMatches), 'SHEET');
  }
  if (canonicalMatches.length > 1) {
    throw d6jD4ErrorWithDiagnostics_('BLOCKED_D6J_D4_CANONICAL_ROW_NOT_UNIQUE', buildD6jD4CanonicalRowDiagnostics_(rows, canonicalMatches), 'SHEET');
  }
  const target = canonicalMatches[0];
  if (Number(target.rowNumber) !== D6J_D4_TARGET_ROW_NUMBER_) {
    throw d6jD4ErrorWithDiagnostics_('BLOCKED_D6J_D4_TARGET_ROW_NUMBER_CHANGED', buildD6jD4CanonicalRowDiagnostics_(rows, canonicalMatches), 'SHEET');
  }
  const v = target.values || [];
  const displayValues = target.displayValues || [];
  const formats = target.numberFormats || [];
  const formulas = target.formulas || [];
  const formulasR1C1 = target.formulasR1C1 || [];
  assertD6jD4CanonicalValues_(v, displayValues);
  assertD6jD4PreservedCells_(v, formats);
  assertD6jD4Formula_(formulas[15] || formulasR1C1[15], formulasR1C1[15] || formulas[15]);
  const counts = countD6jD4Duplicates_(rows);
  if (counts.invoiceKey > 1 || counts.hashIndex > 1 || counts.businessIdentity > 1) throw d6jD4Error_('BLOCKED_D6J_D4_DUPLICATE_ROW_FOUND', 'SHEET');
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
    UNEXPECTED_DUPLICATE_APPEND_FOUND: 'NO',
    TARGET_ROW_PRESENT: 'YES',
    TARGET_ROW_FIELD_MATCHES: evaluateD6jD4RowFieldMatches_(target),
    NEAR_CANONICAL_CANDIDATES: [],
    VERIFIED_CURRENT_ROW_HASH: buildD6jD4VerifiedCurrentRowHash_(target)
  };
}

function isD6jD4CanonicalRowMatch_(row) {
  const v = row && row.values || [];
  const d = row && row.displayValues || [];
  return normalizeD6jD4String_(v[14]) === D6J_D4_INVOICE_KEY_
    && normalizeD6jD4String_(v[13]) === D6J_D4_HASH_INDEX_
    && tryNormalizeD6jCComparableDate_(v[1]).value === D6J_D4_EXPECTED_ROW_.B
    && normalizeD6jD4InvoiceNumber_(v[2], d[2]).valid
    && normalizeD6jD4ExactText_(v[3]) === normalizeD6jD4ExactText_(D6J_D4_EXPECTED_ROW_.D)
    && normalizeD6jD4String_(v[4]) === D6J_D4_EXPECTED_ROW_.E
    && normalizeD6jD4ExactText_(v[5]) === normalizeD6jD4ExactText_(D6J_D4_EXPECTED_ROW_.F)
    && normalizeD6jD4String_(v[6]) === D6J_D4_EXPECTED_ROW_.G
    && numbersEqualD6jD_(v[7], D6J_D4_EXPECTED_ROW_.H)
    && numbersEqualD6jD_(v[8], D6J_D4_EXPECTED_ROW_.I);
}

function assertD6jD4CanonicalValues_(v, displayValues) {
  const invoice = normalizeD6jD4InvoiceNumber_(v[2], displayValues && displayValues[2]);
  if (!invoice.valid) throw d6jD4Error_('BLOCKED_D6J_D4_C_MISMATCH', 'SHEET');
  [
    [4, D6J_D4_EXPECTED_ROW_.D, 'BLOCKED_D6J_D4_D_MISMATCH'],
    [14, D6J_D4_EXPECTED_ROW_.N, 'BLOCKED_D6J_D4_N_HASH_INDEX_MISMATCH'],
    [15, D6J_D4_EXPECTED_ROW_.O, 'BLOCKED_D6J_D4_O_INVOICE_KEY_MISMATCH']
  ].forEach(([column, expected, code]) => {
    if (normalizeD6jD4ExactText_(v[column - 1]) !== normalizeD6jD4ExactText_(expected)) throw d6jD4Error_(code, 'SHEET');
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
  if (!numbersEqualD6jD_(v[0], D6J_D4_EXPECTED_ROW_.A)) throw d6jD4Error_('BLOCKED_D6J_D4_A_MISMATCH', 'SHEET');
  if (!isD6jCDateObject_(v[1])) throw d6jD4Error_('BLOCKED_D6J_D4_B_NOT_DATE_OBJECT', 'SHEET');
  const date = tryNormalizeD6jCComparableDate_(v[1]);
  if (!date.valid || date.value !== D6J_D4_EXPECTED_ROW_.B) throw d6jD4Error_('BLOCKED_D6J_D4_B_DATE_CANONICAL_MISMATCH', 'SHEET');
  if (!isD6jD4DateNumberFormat_(formats && formats[1])) throw d6jD4Error_('BLOCKED_D6J_D4_B_NUMBER_FORMAT_MISMATCH', 'SHEET');
  [
    [5, D6J_D4_EXPECTED_ROW_.E],
    [6, D6J_D4_EXPECTED_ROW_.F],
    [7, D6J_D4_EXPECTED_ROW_.G]
  ].forEach(([column, expected]) => {
    if (normalizeD6jD4ExactText_(v[column - 1]) !== normalizeD6jD4ExactText_(expected)) throw d6jD4Error_('BLOCKED_D6J_D4_' + columnLetterD6jD_(column) + '_MISMATCH', 'SHEET');
  });
  [
    [8, D6J_D4_EXPECTED_ROW_.H],
    [9, D6J_D4_EXPECTED_ROW_.I]
  ].forEach(([column, expected]) => {
    if (!numbersEqualD6jD_(v[column - 1], expected)) throw d6jD4Error_('BLOCKED_D6J_D4_' + columnLetterD6jD_(column) + '_MISMATCH', 'SHEET');
  });
}

function assertD6jD4Formula_(formula, formulaR1C1) {
  const a1 = normalizeD6jD4Formula_(formula);
  const r1c1 = normalizeD6jD4Formula_(formulaR1C1);
  const combined = (a1 + ' ' + r1c1).trim();
  if (!combined) throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_MISSING', 'SHEET');
  if (combined.indexOf('HYPERLINK') < 0) throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_HYPERLINK_MISSING', 'SHEET');
  if (combined.indexOf('HOA-DON') < 0 && combined.indexOf('HOADON') < 0) throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_HOA_DON_REFERENCE_MISSING', 'SHEET');
  if (combined.indexOf('XLOOKUP') < 0 && combined.indexOf('VLOOKUP') < 0 && combined.indexOf('INDEX') < 0) throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_LOOKUP_MISSING', 'SHEET');
  if (combined.indexOf('O1337') < 0 && combined.indexOf('RC[-1]') < 0) {
    throw d6jD4Error_('BLOCKED_D6J_D4_P_FORMULA_ROW_REFERENCE_MISMATCH', 'SHEET');
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

function buildD6jD4CanonicalRowDiagnostics_(rows, canonicalMatches) {
  const target = (rows || []).find(row => Number(row && row.rowNumber) === D6J_D4_TARGET_ROW_NUMBER_);
  const candidates = (rows || [])
    .map(row => {
      const flags = evaluateD6jD4RowFieldMatches_(row);
      return {
        TARGET_ROW_NUMBER: Number(row && row.rowNumber || 0),
        FIELD_MATCH_COUNT: Object.keys(flags).filter(key => flags[key] === true).length,
        TARGET_ROW_FIELD_MATCHES: flags
      };
    })
    .filter(candidate => candidate.FIELD_MATCH_COUNT > 0)
    .sort((a, b) => b.FIELD_MATCH_COUNT - a.FIELD_MATCH_COUNT || a.TARGET_ROW_NUMBER - b.TARGET_ROW_NUMBER)
    .slice(0, 5);
  return {
    CANONICAL_ROW_MATCH_COUNT: Number((canonicalMatches || []).length),
    TARGET_ROW_PRESENT: target ? 'YES' : 'NO',
    TARGET_ROW_NUMBER: D6J_D4_TARGET_ROW_NUMBER_,
    TARGET_ROW_FIELD_MATCHES: target ? evaluateD6jD4RowFieldMatches_(target) : createD6jD4EmptyFieldMatches_(),
    NEAR_CANONICAL_CANDIDATES: candidates,
    LAST_COMPLETED_VERIFICATION_STAGE: 'PREFLIGHT'
  };
}

function evaluateD6jD4RowFieldMatches_(row) {
  const source = row || {};
  const v = source.values || [];
  const d = source.displayValues || [];
  const formulas = source.formulas || [];
  const formulasR1C1 = source.formulasR1C1 || [];
  return {
    A_MATCH: numbersEqualD6jD_(v[0], D6J_D4_EXPECTED_ROW_.A),
    B_MATCH: tryNormalizeD6jCComparableDate_(v[1]).value === D6J_D4_EXPECTED_ROW_.B,
    C_MATCH: normalizeD6jD4InvoiceNumber_(v[2], d[2]).valid,
    D_MATCH: normalizeD6jD4ExactText_(v[3]) === normalizeD6jD4ExactText_(D6J_D4_EXPECTED_ROW_.D),
    E_MATCH: normalizeD6jD4ExactText_(v[4]) === normalizeD6jD4ExactText_(D6J_D4_EXPECTED_ROW_.E),
    F_MATCH: normalizeD6jD4ExactText_(v[5]) === normalizeD6jD4ExactText_(D6J_D4_EXPECTED_ROW_.F),
    G_MATCH: normalizeD6jD4ExactText_(v[6]) === normalizeD6jD4ExactText_(D6J_D4_EXPECTED_ROW_.G),
    H_MATCH: numbersEqualD6jD_(v[7], D6J_D4_EXPECTED_ROW_.H),
    I_MATCH: numbersEqualD6jD_(v[8], D6J_D4_EXPECTED_ROW_.I),
    J_MATCH: numbersEqualD6jD_(v[9], D6J_D4_EXPECTED_ROW_.J),
    K_MATCH: numbersEqualD6jD_(v[10], D6J_D4_EXPECTED_ROW_.K),
    L_MATCH: numbersEqualD6jD_(v[11], D6J_D4_EXPECTED_ROW_.L),
    M_MATCH: numbersEqualD6jD_(v[12], D6J_D4_EXPECTED_ROW_.M),
    N_MATCH: normalizeD6jD4ExactText_(v[13]) === normalizeD6jD4ExactText_(D6J_D4_EXPECTED_ROW_.N),
    O_MATCH: normalizeD6jD4ExactText_(v[14]) === normalizeD6jD4ExactText_(D6J_D4_EXPECTED_ROW_.O),
    P_FORMULA_MATCH: isD6jD4FormulaMatch_(formulas[15] || formulasR1C1[15], formulasR1C1[15] || formulas[15])
  };
}

function createD6jD4EmptyFieldMatches_() {
  return {
    A_MATCH: false,
    B_MATCH: false,
    C_MATCH: false,
    D_MATCH: false,
    E_MATCH: false,
    F_MATCH: false,
    G_MATCH: false,
    H_MATCH: false,
    I_MATCH: false,
    J_MATCH: false,
    K_MATCH: false,
    L_MATCH: false,
    M_MATCH: false,
    N_MATCH: false,
    O_MATCH: false,
    P_FORMULA_MATCH: false
  };
}

function isD6jD4FormulaMatch_(formula, formulaR1C1) {
  const a1 = normalizeD6jD4Formula_(formula);
  const r1c1 = normalizeD6jD4Formula_(formulaR1C1);
  const combined = (a1 + ' ' + r1c1).trim();
  return Boolean(combined
    && combined.indexOf('HYPERLINK') >= 0
    && (combined.indexOf('HOA-DON') >= 0 || combined.indexOf('HOADON') >= 0)
    && (combined.indexOf('XLOOKUP') >= 0 || combined.indexOf('VLOOKUP') >= 0 || combined.indexOf('INDEX') >= 0)
    && (combined.indexOf('O1337') >= 0 || combined.indexOf('RC[-1]') >= 0));
}

function durableJobPath(jobId) {
  return D6J_DURABLE_JOB_COLLECTION_ + '/' + normalizeD6jD4String_(jobId);
}

function durableJobEventsPath(jobId) {
  return durableJobPath(jobId) + '/events';
}

function workerLeasePath(jobId) {
  return 'worker_leases/' + normalizeD6jD4String_(jobId);
}

async function inspectD6jD4FirestoreEvidence_(services, context) {
  const jobPath = durableJobPath(D6J_D4_ORIGINAL_JOB_ID_);
  const eventsPath = durableJobEventsPath(D6J_D4_ORIGINAL_JOB_ID_);
  const leasePath = workerLeasePath(D6J_D4_ORIGINAL_JOB_ID_);
  const job = await services.readFirestoreDocument(jobPath);
  if (!job) throw d6jD4Error_('RECONCILIATION_REQUIRED_D6J_D4_DURABLE_JOB_NOT_FOUND', 'FIRESTORE');
  const status = normalizeD6jD4String_(job.status).toLowerCase();
  if (status !== 'completed') throw d6jD4Error_('BLOCKED_D6J_D4_DURABLE_JOB_NOT_COMPLETED', 'FIRESTORE');
  const lease = await services.readFirestoreDocument(leasePath);
  const leaseState = inspectD6jD4DLeaseReadState_(lease);
  if (leaseState.LEASE_FOUND !== 'YES') throw d6jD4Error_('BLOCKED_D6J_D4_DURABLE_LEASE_NOT_FOUND', 'FIRESTORE');
  if (leaseState.LEASE_JOB_ID_MATCH !== 'YES') throw d6jD4Error_('BLOCKED_D6J_D4_DURABLE_LEASE_JOB_ID_MISMATCH', 'FIRESTORE');
  if (leaseState.LEASE_STATUS !== 'RELEASED') throw d6jD4Error_('BLOCKED_D6J_D4_DURABLE_LEASE_STATUS', 'FIRESTORE');
  if (leaseState.LEASE_FINAL_JOB_STATUS !== 'COMPLETED') throw d6jD4Error_('BLOCKED_D6J_D4_DURABLE_LEASE_FINAL_STATUS', 'FIRESTORE');
  const events = await services.queryFirestoreCollection(eventsPath);
  const eventEvidence = buildD6jD4EventEvidence_(events, {
    job,
    lease,
    sheet: context && context.sheet,
    phase: D6J_D4_PHASE_
  });
  if (eventEvidence.BLOCKER_CODE) throw d6jD4ErrorWithDiagnostics_(eventEvidence.BLOCKER_CODE, omitD6jD4DInternalEvidenceFields_(eventEvidence), 'FIRESTORE');
  if (eventEvidence.FIRESTORE_EVIDENCE_MODE === 'RECONCILIATION_PENDING_POST_HOC') {
    throw d6jD4ErrorWithDiagnostics_('RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_MISSING', omitD6jD4DInternalEvidenceFields_(eventEvidence), 'FIRESTORE');
  }
  return {
    FIRESTORE_REPAIR_AUDIT_COUNT: Number(eventEvidence.FIRESTORE_REPAIR_AUDIT_COUNT || 0),
    FIRESTORE_REPAIR_AUDIT_FOUND: eventEvidence.FIRESTORE_REPAIR_AUDIT_FOUND || 'NO',
    FIRESTORE_REPAIR_AUDIT_COLUMNS_MATCH: eventEvidence.FIRESTORE_REPAIR_AUDIT_COLUMNS_MATCH || 'NO',
    FIRESTORE_BEFORE_HASH_PRESENT: eventEvidence.FIRESTORE_BEFORE_HASH_PRESENT || 'NO',
    FIRESTORE_AFTER_HASH_PRESENT: eventEvidence.FIRESTORE_AFTER_HASH_PRESENT || 'NO',
    FIRESTORE_BEFORE_AFTER_HASH_DIFFER: eventEvidence.FIRESTORE_BEFORE_AFTER_HASH_DIFFER || 'NO',
    ORIGINAL_JOB_FOUND: 'YES',
    ORIGINAL_JOB_STATUS: 'completed',
    ORIGINAL_JOB_HISTORY_PRESERVED: 'YES',
    DURABLE_JOB_COLLECTION: D6J_DURABLE_JOB_COLLECTION_,
    LEGACY_JOB_COLLECTION: D6J_D_LEGACY_JOB_COLLECTION_,
    LEGACY_JOB_PATH_USED_FOR_D6J_D4_CLOSURE: 'NO',
    FIRESTORE_EVIDENCE_MODE: eventEvidence.FIRESTORE_EVIDENCE_MODE,
    ORIGINAL_REPAIR_AUDIT_STATUS: eventEvidence.ORIGINAL_REPAIR_AUDIT_STATUS,
    ORIGINAL_REPAIR_AUDIT_MATCH_COUNT: eventEvidence.ORIGINAL_REPAIR_AUDIT_MATCH_COUNT,
    POST_HOC_RECONCILIATION_EVENT_STATUS: eventEvidence.POST_HOC_RECONCILIATION_EVENT_STATUS,
    POST_HOC_RECONCILIATION_EVENT_MATCH_COUNT: eventEvidence.POST_HOC_RECONCILIATION_EVENT_MATCH_COUNT,
    POST_HOC_RECONCILIATION_EVENT_FOUND: eventEvidence.POST_HOC_RECONCILIATION_EVENT_FOUND,
    DURABLE_JOB_FOUND: 'YES',
    DURABLE_JOB_STATUS: 'COMPLETED',
    LEASE_FOUND: leaseState.LEASE_FOUND,
    LEASE_JOB_ID_MATCH: leaseState.LEASE_JOB_ID_MATCH,
    LEASE_STATUS: leaseState.LEASE_STATUS,
    LEASE_FINAL_JOB_STATUS: leaseState.LEASE_FINAL_JOB_STATUS,
    LEASE_RELEASED_AT_PRESENT: leaseState.LEASE_RELEASED_AT_PRESENT,
    LEASE_GENERATION_PRESENT: leaseState.LEASE_GENERATION_PRESENT
  };
}

function assertD6jD4DriveArtifacts_(drive) {
  if (!drive || drive.DRIVE_ARTIFACTS_UNCHANGED !== 'YES' || Number(drive.DRIVE_EXACT_MATCH_COUNT) !== 2) {
    throw d6jD4Error_('BLOCKED_D6J_D4_DRIVE_ARTIFACT_MISMATCH', 'DRIVE');
  }
}

function assertD6jD4GmailArtifacts_(gmail) {
  if (!gmail || gmail.GMAIL_SOURCE_ARTIFACTS_UNCHANGED !== 'YES' || gmail.GMAIL_MESSAGE_FOUND !== 'YES' || Number(gmail.ATTACHMENT_COUNT) !== 2) {
    throw d6jD4Error_('BLOCKED_D6J_D4_GMAIL_ARTIFACT_MISMATCH', 'GMAIL');
  }
}

function inspectD6jD4Triggers_(triggers) {
  const names = (triggers || []).map(trigger => normalizeD6jD4String_(typeof trigger.getHandlerFunction === 'function' ? trigger.getHandlerFunction() : trigger.handlerFunction || trigger));
  const count = names.filter(name => D6J_D4_FORBIDDEN_TRIGGERS_.indexOf(name) >= 0).length;
  if (count) throw d6jD4Error_('BLOCKED_D6J_D4_UNEXPECTED_D6J_TRIGGER_FOUND', 'TRIGGER');
  return { D6J_TRIGGER_COUNT: 0, UNEXPECTED_D6J_TRIGGER_FOUND: 'NO', TRIGGER_MUTATION_COUNT: 0 };
}

function readD6jD4PropertiesReadOnly_() {
  const props = PropertiesService.getScriptProperties();
  const out = readD6jBScriptProperties_();
  out.D6J_D_REPAIR_APPROVAL_MARKER = String(props.getProperty('D6J_D_REPAIR_APPROVAL_MARKER') || '').trim();
  out[D6J_D4D_RECONCILIATION_APPROVAL_PROPERTY_] = String(props.getProperty(D6J_D4D_RECONCILIATION_APPROVAL_PROPERTY_) || '').trim();
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

function createD6jD4DReconciliationPreviewReadOnlyRunner_(deps) {
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
    const result = createD6jD4DBaseResult_();
    try {
      const properties = services.readProperties();
      setD6jD4DReconciliationApprovalMarkerState_(properties, result);
      assertD6jD4RepairMarkerAbsent_(properties, result);
      await collectD6jD4DReconciliationVerification_(services, properties, result);
      result.RECONCILIATION_PREVIEW_STATUS = result.POST_HOC_RECONCILIATION_EVENT_FOUND === 'YES'
        ? 'PASS_EXISTING_POST_HOC_RECONCILIATION_EXACT_MATCH'
        : 'PASS_READY_FOR_EXPLICIT_APPROVAL';
    } catch (error) {
      result.RECONCILIATION_PREVIEW_STATUS = 'BLOCKED';
      result.BLOCKER_CODE = normalizeD6jD4ErrorCode_(error && (error.code || error.message) || 'BLOCKED_D6J_D4D_PREVIEW_UNKNOWN');
      mergeD6jD4Result_(result, error && error.diagnostics);
      markD6jD4BlockedStage_(result, error, result.BLOCKER_CODE);
    }
    finalizeD6jD4DPreviewResult_(result);
    logD6jD4SanitizedResult_(services.logger, result);
    return result;
  }

  return Object.freeze({ run });
}

function createD6jD4DRecordPostHocReconciliationEvidenceRunner_(deps) {
  const d = deps || {};
  const services = {
    readProperties: d.readProperties || readD6jD4PropertiesReadOnly_,
    createLock: d.createLock || (() => LockService.getScriptLock()),
    createTransport: d.createTransport || createD6jCFirestoreDurableTransport_,
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
    const result = createD6jD4DBaseResult_();
    let lock = null;
    let lockAcquired = false;
    try {
      const properties = services.readProperties();
      setD6jD4DReconciliationApprovalMarkerState_(properties, result);
      assertD6jD4RepairMarkerAbsent_(properties, result);
      if (normalizeD6jD4String_(properties[D6J_D4D_RECONCILIATION_APPROVAL_PROPERTY_]) !== D6J_D4D_RECONCILIATION_APPROVAL_) {
        throw d6jD4Error_('BLOCKED_INVALID_D6J_D4D_RECONCILIATION_APPROVAL_MARKER', 'PREFLIGHT');
      }
      lock = services.createLock();
      if (!lock || typeof lock.tryLock !== 'function' || !lock.tryLock(30000)) {
        throw d6jD4Error_('BLOCKED_SCRIPT_LOCK_NOT_ACQUIRED', 'PREFLIGHT');
      }
      lockAcquired = true;
      result.SCRIPT_LOCK_ACQUIRED = 'YES';
      await collectD6jD4DReconciliationVerification_(services, properties, result);
      const expectedPayload = result._EXPECTED_POST_HOC_RECONCILIATION_EVENT;
      const eventPath = result._EXPECTED_POST_HOC_RECONCILIATION_EVENT_PATH;
      const transport = services.createTransport();
      if (!transport || typeof transport.runTransaction !== 'function') {
        throw d6jD4Error_('BLOCKED_D6J_D4D_FIRESTORE_TRANSPORT_MISSING', 'FIRESTORE');
      }
      let createCount = 0;
      let mutationCount = 0;
      let mutationStatus = '';
      await transport.runTransaction(async tx => {
        const existing = await tx.getDocument(eventPath);
        if (existing) {
          if (isD6jD4DPostHocEventExactMatch_(existing, expectedPayload)) {
            mutationStatus = 'PASS_IDEMPOTENT_EXISTING_EXACT_MATCH';
            return;
          }
          throw d6jD4ErrorWithDiagnostics_(
            'BLOCKED_D6J_D4D_RECONCILIATION_EVENT_CONFLICT',
            {
              POST_HOC_RECONCILIATION_EVENT_STATUS: 'CONFLICT',
              POST_HOC_RECONCILIATION_EVENT_MATCH_COUNT: 0,
              POST_HOC_RECONCILIATION_EVENT_FOUND: 'YES'
            },
            'FIRESTORE'
          );
        }
        await tx.createDocument(eventPath, expectedPayload, { idempotencyKey: expectedPayload.eventId });
        createCount = 1;
        mutationCount = 1;
        const created = await tx.getDocument(eventPath);
        if (!isD6jD4DPostHocEventExactMatch_(created, expectedPayload)) {
          throw d6jD4Error_('BLOCKED_D6J_D4D_RECONCILIATION_EVENT_READBACK_MISMATCH', 'FIRESTORE');
        }
        mutationStatus = 'PASS_POST_HOC_RECONCILIATION_EVIDENCE_CREATED';
      });
      result.RECONCILIATION_MUTATION_STATUS = mutationStatus || 'BLOCKED';
      result.FIRESTORE_EVENT_CREATE_COUNT = createCount;
      result.FIRESTORE_EVENT_CREATE_PLANNED = createCount ? 1 : 0;
      result.FIRESTORE_MUTATION_COUNT = mutationCount;
      result.PRODUCTION_MUTATION = mutationCount ? 'ONE_DETERMINISTIC_FIRESTORE_RECONCILIATION_EVENT_ONLY' : 'NONE';
    } catch (error) {
      result.RECONCILIATION_MUTATION_STATUS = 'BLOCKED';
      result.BLOCKER_CODE = normalizeD6jD4ErrorCode_(error && (error.code || error.message) || 'BLOCKED_D6J_D4D_MUTATION_UNKNOWN');
      mergeD6jD4Result_(result, error && error.diagnostics);
      markD6jD4BlockedStage_(result, error, result.BLOCKER_CODE);
    } finally {
      if (lockAcquired && lock && typeof lock.releaseLock === 'function') lock.releaseLock();
    }
    finalizeD6jD4DMutationResult_(result);
    logD6jD4SanitizedResult_(services.logger, result);
    return result;
  }

  return Object.freeze({ run });
}

async function collectD6jD4DReconciliationVerification_(services, properties, seedResult) {
  const result = seedResult || createD6jD4DBaseResult_();
  const preflight = services.runPreflight(properties);
  const preflightState = assertD6jD4Preflight_(preflight, result);
  result.LAST_COMPLETED_VERIFICATION_STAGE = 'PREFLIGHT';
  if (preflightState.sheetDuplicateStatus !== 'EXISTING_CANONICAL_MATCH') {
    throw d6jD4Error_('BLOCKED_D6J_D4_PREFLIGHT_CLASSIFIER_DISAGREEMENT', 'CLASSIFIER');
  }
  const snapshot = services.readSheetSnapshot(properties);
  const sheet = inspectD6jD4CanonicalSheetState_(snapshot);
  mergeD6jD4Result_(result, sheet);
  result.SHEET_VERIFICATION_STATUS = 'PASS';
  result.LAST_COMPLETED_VERIFICATION_STAGE = 'SHEET';
  const fire = await inspectD6jD4DReconciliationEvidence_(services, { properties, sheet });
  mergeD6jD4Result_(result, fire);
  result.FIRESTORE_VERIFICATION_STATUS = 'PASS';
  result.LAST_COMPLETED_VERIFICATION_STAGE = 'FIRESTORE';
  const drive = services.inspectDriveArtifacts(properties, preflight);
  assertD6jD4DriveArtifacts_(drive);
  mergeD6jD4Result_(result, drive);
  result.DRIVE_VERIFICATION_STATUS = 'PASS';
  result.LAST_COMPLETED_VERIFICATION_STAGE = 'DRIVE';
  const gmail = services.inspectGmailArtifacts(properties, preflight);
  assertD6jD4GmailArtifacts_(gmail);
  mergeD6jD4Result_(result, gmail);
  result.GMAIL_VERIFICATION_STATUS = 'PASS';
  result.LAST_COMPLETED_VERIFICATION_STAGE = 'GMAIL';
  const trigger = inspectD6jD4Triggers_(services.listTriggers());
  mergeD6jD4Result_(result, trigger);
  result.TRIGGER_VERIFICATION_STATUS = 'PASS';
  result.LAST_COMPLETED_VERIFICATION_STAGE = 'TRIGGER';
  return result;
}

async function inspectD6jD4DReconciliationEvidence_(services, context) {
  const jobPath = durableJobPath(D6J_D4_ORIGINAL_JOB_ID_);
  const eventsPath = durableJobEventsPath(D6J_D4_ORIGINAL_JOB_ID_);
  const leasePath = workerLeasePath(D6J_D4_ORIGINAL_JOB_ID_);
  const job = await services.readFirestoreDocument(jobPath);
  if (!job) throw d6jD4Error_('BLOCKED_D6J_D4D_DURABLE_JOB_NOT_FOUND', 'FIRESTORE');
  if (normalizeD6jD4String_(job.jobId || D6J_D4_ORIGINAL_JOB_ID_) !== D6J_D4_ORIGINAL_JOB_ID_) {
    throw d6jD4Error_('BLOCKED_D6J_D4D_DURABLE_JOB_ID_MISMATCH', 'FIRESTORE');
  }
  const jobStatus = sanitizeD6jD4CCode_(job.status).toUpperCase();
  if (jobStatus !== 'COMPLETED') throw d6jD4Error_('BLOCKED_D6J_D4D_DURABLE_JOB_NOT_COMPLETED', 'FIRESTORE');
  const lease = await services.readFirestoreDocument(leasePath);
  const leaseState = inspectD6jD4DLeaseReadState_(lease);
  if (leaseState.LEASE_FOUND !== 'YES') throw d6jD4Error_('BLOCKED_D6J_D4D_LEASE_NOT_FOUND', 'FIRESTORE');
  if (leaseState.LEASE_JOB_ID_MATCH !== 'YES') throw d6jD4Error_('BLOCKED_D6J_D4D_LEASE_JOB_ID_MISMATCH', 'FIRESTORE');
  if (leaseState.LEASE_STATUS !== 'RELEASED') throw d6jD4Error_('BLOCKED_D6J_D4D_LEASE_STATUS', 'FIRESTORE');
  if (leaseState.LEASE_FINAL_JOB_STATUS !== 'COMPLETED') throw d6jD4Error_('BLOCKED_D6J_D4D_LEASE_FINAL_STATUS', 'FIRESTORE');
  const events = await services.queryFirestoreCollection(eventsPath);
  const eventEvidence = buildD6jD4EventEvidence_(events, {
    job,
    lease,
    sheet: context && context.sheet,
    phase: D6J_D4D_PHASE_
  });
  if (eventEvidence.BLOCKER_CODE) {
    throw d6jD4ErrorWithDiagnostics_(eventEvidence.BLOCKER_CODE, omitD6jD4DInternalEvidenceFields_(eventEvidence), 'FIRESTORE');
  }
  if (eventEvidence.FIRESTORE_EVIDENCE_MODE === 'ORIGINAL_AUDIT') {
    throw d6jD4ErrorWithDiagnostics_('BLOCKED_D6J_D4D_RECONCILIATION_NOT_REQUIRED_ORIGINAL_AUDIT_PRESENT', omitD6jD4DInternalEvidenceFields_(eventEvidence), 'FIRESTORE');
  }
  return {
    DURABLE_JOB_FOUND: 'YES',
    DURABLE_JOB_STATUS: jobStatus,
    LEASE_FOUND: leaseState.LEASE_FOUND,
    LEASE_JOB_ID_MATCH: leaseState.LEASE_JOB_ID_MATCH,
    LEASE_STATUS: leaseState.LEASE_STATUS,
    LEASE_FINAL_JOB_STATUS: leaseState.LEASE_FINAL_JOB_STATUS,
    LEASE_RELEASED_AT_PRESENT: leaseState.LEASE_RELEASED_AT_PRESENT,
    LEASE_GENERATION_PRESENT: leaseState.LEASE_GENERATION_PRESENT,
    ORIGINAL_REPAIR_AUDIT_STATUS: eventEvidence.ORIGINAL_REPAIR_AUDIT_STATUS,
    ORIGINAL_REPAIR_AUDIT_MATCH_COUNT: eventEvidence.ORIGINAL_REPAIR_AUDIT_MATCH_COUNT,
    POST_HOC_RECONCILIATION_EVENT_STATUS: eventEvidence.POST_HOC_RECONCILIATION_EVENT_STATUS,
    POST_HOC_RECONCILIATION_EVENT_MATCH_COUNT: eventEvidence.POST_HOC_RECONCILIATION_EVENT_MATCH_COUNT,
    POST_HOC_RECONCILIATION_EVENT_FOUND: eventEvidence.POST_HOC_RECONCILIATION_EVENT_FOUND,
    FIRESTORE_EVIDENCE_MODE: eventEvidence.FIRESTORE_EVIDENCE_MODE,
    FIRESTORE_EVENT_CREATE_PLANNED: eventEvidence.POST_HOC_RECONCILIATION_EVENT_FOUND === 'YES' ? 0 : 1,
    _EXPECTED_POST_HOC_RECONCILIATION_EVENT: eventEvidence._EXPECTED_POST_HOC_RECONCILIATION_EVENT,
    _EXPECTED_POST_HOC_RECONCILIATION_EVENT_PATH: eventEvidence._EXPECTED_POST_HOC_RECONCILIATION_EVENT_PATH
  };
}

function inspectD6jD4DLeaseReadState_(lease) {
  const source = lease || {};
  return {
    LEASE_FOUND: normalizeD6jD4String_(source.jobId) ? 'YES' : 'NO',
    LEASE_JOB_ID_MATCH: normalizeD6jD4String_(source.jobId) === D6J_D4_ORIGINAL_JOB_ID_ ? 'YES' : 'NO',
    LEASE_STATUS: sanitizeD6jD4CCode_(source.status).toUpperCase(),
    LEASE_FINAL_JOB_STATUS: sanitizeD6jD4CCode_(source.finalJobStatus).toUpperCase(),
    LEASE_RELEASED_AT_PRESENT: isD6jD4ValidTimestamp_(source.releasedAt) ? 'YES' : 'NO',
    LEASE_GENERATION_PRESENT: normalizeD6jD4String_(source.generation || source.leaseGeneration || source.fencingToken) ? 'YES' : 'NO'
  };
}

function buildD6jD4EventEvidence_(events, context) {
  const docs = (events || []).map(item => item && item.data ? item.data : item);
  const expectedPayload = buildD6jD4DExpectedPostHocEvent_(context.job, context.lease, context.sheet);
  const originalMatches = docs.filter(event => normalizeD6jD4String_(event.eventType) === 'D6J_D_SINGLE_ROW_REPAIR'
    && normalizeD6jD4String_(event.jobId || D6J_D4_ORIGINAL_JOB_ID_) === D6J_D4_ORIGINAL_JOB_ID_);
  const originalState = inspectD6jD4OriginalAuditState_(originalMatches);
  const postHocMatches = docs.filter(event => normalizeD6jD4String_(event.eventType) === D6J_D4D_EVENT_TYPE_
    && normalizeD6jD4String_(event.jobId || D6J_D4_ORIGINAL_JOB_ID_) === D6J_D4_ORIGINAL_JOB_ID_);
  const exactPostHocMatches = postHocMatches.filter(event => isD6jD4DPostHocEventExactMatch_(event, expectedPayload));
  const out = {
    FIRESTORE_REPAIR_AUDIT_COUNT: originalState.count,
    FIRESTORE_REPAIR_AUDIT_FOUND: originalState.count === 1 && originalState.valid ? 'YES' : 'NO',
    FIRESTORE_REPAIR_AUDIT_COLUMNS_MATCH: originalState.columnsMatch ? 'YES' : 'NO',
    FIRESTORE_BEFORE_HASH_PRESENT: originalState.beforeHashPresent ? 'YES' : 'NO',
    FIRESTORE_AFTER_HASH_PRESENT: originalState.afterHashPresent ? 'YES' : 'NO',
    FIRESTORE_BEFORE_AFTER_HASH_DIFFER: originalState.beforeAfterHashDiffer ? 'YES' : 'NO',
    ORIGINAL_REPAIR_AUDIT_STATUS: originalState.count === 0 ? 'MISSING' : originalState.valid ? 'PRESENT_VALID' : 'PRESENT_INVALID',
    ORIGINAL_REPAIR_AUDIT_MATCH_COUNT: originalState.count,
    POST_HOC_RECONCILIATION_EVENT_MATCH_COUNT: exactPostHocMatches.length,
    POST_HOC_RECONCILIATION_EVENT_FOUND: exactPostHocMatches.length === 1 ? 'YES' : 'NO',
    POST_HOC_RECONCILIATION_EVENT_STATUS: exactPostHocMatches.length === 1 ? 'EXACT_MATCH' : postHocMatches.length === 0 ? 'NOT_FOUND' : 'CONFLICT',
    _EXPECTED_POST_HOC_RECONCILIATION_EVENT: expectedPayload,
    _EXPECTED_POST_HOC_RECONCILIATION_EVENT_PATH: durableJobEventsPath(D6J_D4_ORIGINAL_JOB_ID_) + '/' + expectedPayload.eventId
  };
  if (originalState.blockerCode) {
    out.BLOCKER_CODE = originalState.blockerCode;
    return out;
  }
  if (originalState.valid && postHocMatches.length > 0) {
    out.BLOCKER_CODE = 'BLOCKED_D6J_D4D_BOTH_ORIGINAL_AND_POST_HOC_EVENTS_PRESENT';
    return out;
  }
  if (originalState.valid) {
    out.FIRESTORE_EVIDENCE_MODE = 'ORIGINAL_AUDIT';
    return out;
  }
  if (postHocMatches.length === 0) {
    out.FIRESTORE_EVIDENCE_MODE = 'RECONCILIATION_PENDING_POST_HOC';
    return out;
  }
  if (exactPostHocMatches.length === 1 && postHocMatches.length === 1) {
    out.FIRESTORE_EVIDENCE_MODE = 'POST_HOC_RECONCILIATION';
    return out;
  }
  out.BLOCKER_CODE = 'BLOCKED_D6J_D4D_RECONCILIATION_EVENT_CONFLICT';
  return out;
}

function inspectD6jD4OriginalAuditState_(matches) {
  const list = matches || [];
  if (list.length === 0) {
    return { count: 0, valid: false, columnsMatch: false, beforeHashPresent: false, afterHashPresent: false, beforeAfterHashDiffer: false, blockerCode: '' };
  }
  if (list.length > 1) {
    return { count: list.length, valid: false, columnsMatch: false, beforeHashPresent: false, afterHashPresent: false, beforeAfterHashDiffer: false, blockerCode: 'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_NOT_UNIQUE' };
  }
  const detail = list[0].safeDetails || list[0];
  const columns = normalizeD6jD4Columns_(detail.changedColumns);
  const expected = D6J_D4_EXPECTED_CHANGED_COLUMNS_.join(',');
  const beforeHash = normalizeD6jD4String_(detail.beforeHash);
  const afterHash = normalizeD6jD4String_(detail.afterHash);
  const valid = columns.join(',') === expected && beforeHash && afterHash && beforeHash !== afterHash && isD6jD4ValidTimestamp_(detail.repairedAt || list[0].occurredAt);
  return {
    count: 1,
    valid,
    columnsMatch: columns.join(',') === expected,
    beforeHashPresent: Boolean(beforeHash),
    afterHashPresent: Boolean(afterHash),
    beforeAfterHashDiffer: Boolean(beforeHash && afterHash && beforeHash !== afterHash),
    blockerCode: valid ? '' : 'RECONCILIATION_REQUIRED_FIRESTORE_REPAIR_AUDIT_INVALID'
  };
}

function buildD6jD4DExpectedPostHocEvent_(job, lease, sheet) {
  const payload = {
    eventType: D6J_D4D_EVENT_TYPE_,
    schemaVersion: D6J_D4D_SCHEMA_VERSION_,
    phase: D6J_D4D_PHASE_,
    jobId: D6J_D4_ORIGINAL_JOB_ID_,
    targetRowNumber: D6J_D4_TARGET_ROW_NUMBER_,
    invoiceKeyHashPrefix: hashPrefixD6jC_(D6J_D4_INVOICE_KEY_, 8),
    hashIndexHashPrefix: hashPrefixD6jC_(D6J_D4_HASH_INDEX_, 8),
    expectedChangedColumns: D6J_D4_EXPECTED_CHANGED_COLUMNS_.slice(),
    canonicalRowVerified: sheet && sheet.CANONICAL_ROW_MATCH_COUNT === 1 && sheet.CANONICAL_VALUES_MATCH === 'YES',
    preservedCellsVerified: sheet && sheet.PRESERVED_VALUES_MATCH === 'YES',
    dateCellPreserved: sheet && sheet.DATE_CELL_STILL_DATE === 'YES' && sheet.DATE_NUMBER_FORMAT_PRESERVED === 'YES',
    formulaPreserved: sheet && sheet.HD_FORMULA_PRESERVED === 'YES',
    duplicateCount: Number(sheet && sheet.DUPLICATE_ROW_COUNT || 0),
    durableJobStatus: sanitizeD6jD4CCode_(job && job.status).toUpperCase(),
    leaseStatus: sanitizeD6jD4CCode_(lease && lease.status).toUpperCase(),
    leaseFinalJobStatus: sanitizeD6jD4CCode_(lease && lease.finalJobStatus).toUpperCase(),
    originalRepairAuditStatus: 'MISSING',
    originalRepairAuditMatchCount: 0,
    reconciliationReason: D6J_D4D_RECONCILIATION_REASON_,
    verificationSource: D6J_D4D_VERIFICATION_SOURCE_,
    verifiedCurrentRowHash: normalizeD6jD4String_(sheet && sheet.VERIFIED_CURRENT_ROW_HASH),
    d4cEvidenceStatus: D6J_D4D_EXPECTED_D4C_STATUS_,
    recordedAt: resolveD6jD4DRecordedAt_(job, lease)
  };
  payload.eventId = buildD6jD4DDeterministicEventId_(payload);
  return payload;
}

function resolveD6jD4DRecordedAt_(job, lease) {
  const candidates = [lease && lease.releasedAt, job && job.completedAt, job && job.updatedAt, '2026-07-26T00:00:00.000Z'];
  return candidates.find(isD6jD4ValidTimestamp_) || '2026-07-26T00:00:00.000Z';
}

function buildD6jD4DDeterministicEventId_(value) {
  const source = value || {};
  const seed = [
    D6J_D4D_EVENT_TYPE_,
    normalizeD6jD4String_(source.jobId || D6J_D4_ORIGINAL_JOB_ID_),
    String(source.targetRowNumber || D6J_D4_TARGET_ROW_NUMBER_),
    D6J_D4_INVOICE_KEY_,
    D6J_D4_HASH_INDEX_,
    normalizeD6jD4String_(source.d4cEvidenceStatus || D6J_D4D_EXPECTED_D4C_STATUS_),
    D6J_D4D_SCHEMA_VERSION_
  ].join('|');
  return D6J_D4D_EVENT_ID_PREFIX_ + hashPrefixD6jC_(seed, 20);
}

function sanitizeD6jD4DPostHocEvent_(event) {
  const source = event && event.data ? event.data : event || {};
  const safe = {
    eventId: normalizeD6jD4String_(source.eventId),
    eventType: normalizeD6jD4String_(source.eventType),
    schemaVersion: normalizeD6jD4String_(source.schemaVersion),
    phase: normalizeD6jD4String_(source.phase),
    jobId: normalizeD6jD4String_(source.jobId),
    targetRowNumber: Number(source.targetRowNumber || 0),
    invoiceKeyHashPrefix: normalizeD6jD4String_(source.invoiceKeyHashPrefix),
    hashIndexHashPrefix: normalizeD6jD4String_(source.hashIndexHashPrefix),
    expectedChangedColumns: normalizeD6jD4Columns_(source.expectedChangedColumns),
    canonicalRowVerified: Boolean(source.canonicalRowVerified),
    preservedCellsVerified: Boolean(source.preservedCellsVerified),
    dateCellPreserved: Boolean(source.dateCellPreserved),
    formulaPreserved: Boolean(source.formulaPreserved),
    duplicateCount: Number(source.duplicateCount || 0),
    durableJobStatus: normalizeD6jD4String_(source.durableJobStatus),
    leaseStatus: normalizeD6jD4String_(source.leaseStatus),
    leaseFinalJobStatus: normalizeD6jD4String_(source.leaseFinalJobStatus),
    originalRepairAuditStatus: normalizeD6jD4String_(source.originalRepairAuditStatus),
    originalRepairAuditMatchCount: Number(source.originalRepairAuditMatchCount || 0),
    reconciliationReason: normalizeD6jD4String_(source.reconciliationReason),
    verificationSource: normalizeD6jD4String_(source.verificationSource),
    verifiedCurrentRowHash: normalizeD6jD4String_(source.verifiedCurrentRowHash),
    d4cEvidenceStatus: normalizeD6jD4String_(source.d4cEvidenceStatus),
    recordedAt: normalizeD6jD4String_(source.recordedAt)
  };
  return safe;
}

function isD6jD4DPostHocEventExactMatch_(event, expectedPayload) {
  const actual = sanitizeD6jD4DPostHocEvent_(event);
  const expected = sanitizeD6jD4DPostHocEvent_(expectedPayload);
  return stableD6jD4Json_(actual) === stableD6jD4Json_(expected);
}

function omitD6jD4DInternalEvidenceFields_(eventEvidence) {
  const out = cloneD6jD4PlainObject_(eventEvidence || {});
  delete out._EXPECTED_POST_HOC_RECONCILIATION_EVENT;
  delete out._EXPECTED_POST_HOC_RECONCILIATION_EVENT_PATH;
  return out;
}

function createD6jD4DBaseResult_() {
  const base = createD6jD4BaseResult_();
  base.PHASE = D6J_D4D_PHASE_;
  base.SCHEMA_VERSION = D6J_D4D_SCHEMA_VERSION_;
  base.RECONCILIATION_PREVIEW_STATUS = 'NOT_STARTED';
  base.RECONCILIATION_MUTATION_STATUS = 'NOT_STARTED';
  base.DURABLE_JOB_FOUND = 'NO';
  base.DURABLE_JOB_STATUS = '';
  base.SHEET_MUTATION_PLANNED = 0;
  base.DRIVE_MUTATION_PLANNED = 0;
  base.GMAIL_MUTATION_PLANNED = 0;
  base.JOB_DOCUMENT_MUTATION_PLANNED = 0;
  base.LEASE_MUTATION_PLANNED = 0;
  base.FIRESTORE_EVENT_CREATE_PLANNED = 0;
  base.FIRESTORE_EVENT_CREATE_COUNT = 0;
  base.SCRIPT_PROPERTIES_MUTATION_COUNT = 0;
  base.SCRIPT_LOCK_ACQUIRED = 'NO';
  return base;
}

function finalizeD6jD4DPreviewResult_(result) {
  result.SHEETS_MUTATION_COUNT = 0;
  result.DRIVE_MUTATION_COUNT = 0;
  result.GMAIL_MUTATION_COUNT = 0;
  result.FIRESTORE_MUTATION_COUNT = 0;
  result.TRIGGER_MUTATION_COUNT = 0;
  result.SCRIPT_PROPERTIES_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
  result.PRODUCTION_MUTATION = 'NONE';
  result.SHEET_MUTATION_PLANNED = 0;
  result.DRIVE_MUTATION_PLANNED = 0;
  result.GMAIL_MUTATION_PLANNED = 0;
  result.JOB_DOCUMENT_MUTATION_PLANNED = 0;
  result.LEASE_MUTATION_PLANNED = 0;
  result.CURRENT_ENTRYPOINT_EXECUTED = 'YES';
  result.D6J_D4_ENTRYPOINT_EXECUTED = 'NO';
  result.D6J_D4C_ENTRYPOINT_EXECUTED = 'NO';
  result.D6J_D4D_PREVIEW_ENTRYPOINT_EXECUTED = 'YES';
  result.D6J_D4D_MUTATION_ENTRYPOINT_EXECUTED = 'NO';
  result.PROHIBITED_D6J_D4_ENTRYPOINT_EXECUTED = 'NO';
  result.REPAIR_FUNCTION_EXECUTED = 'NO';
  result.D6J_C_FUNCTION_EXECUTED = 'NO';
  delete result._EXPECTED_POST_HOC_RECONCILIATION_EVENT;
  delete result._EXPECTED_POST_HOC_RECONCILIATION_EVENT_PATH;
}

function finalizeD6jD4DMutationResult_(result) {
  result.SHEETS_MUTATION_COUNT = 0;
  result.DRIVE_MUTATION_COUNT = 0;
  result.GMAIL_MUTATION_COUNT = 0;
  result.JOB_DOCUMENT_MUTATION_COUNT = 0;
  result.LEASE_MUTATION_COUNT = 0;
  result.TRIGGER_MUTATION_COUNT = 0;
  result.SCRIPT_PROPERTIES_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
  result.CURRENT_ENTRYPOINT_EXECUTED = 'YES';
  result.D6J_D4_ENTRYPOINT_EXECUTED = 'NO';
  result.D6J_D4C_ENTRYPOINT_EXECUTED = 'NO';
  result.D6J_D4D_PREVIEW_ENTRYPOINT_EXECUTED = 'NO';
  result.D6J_D4D_MUTATION_ENTRYPOINT_EXECUTED = 'YES';
  result.PROHIBITED_D6J_D4_ENTRYPOINT_EXECUTED = 'NO';
  result.REPAIR_FUNCTION_EXECUTED = 'NO';
  result.D6J_C_FUNCTION_EXECUTED = 'NO';
  delete result._EXPECTED_POST_HOC_RECONCILIATION_EVENT;
  delete result._EXPECTED_POST_HOC_RECONCILIATION_EVENT_PATH;
}

function createD6jD4CFirestoreEvidenceDiagnosticsReadOnlyRunner_(deps) {
  const d = deps || {};
  const services = {
    readFirestoreDocumentState: d.readFirestoreDocumentState || readD6jD4CFirestoreDocumentStateReadOnly_,
    listFirestoreCollectionState: d.listFirestoreCollectionState || listD6jD4CFirestoreCollectionStateReadOnly_,
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log() {} })
  };

  async function run() {
    const result = createD6jD4CBaseResult_();
    try {
      const paths = buildD6jD4CPaths_();
      mergeD6jD4Result_(result, paths);
      const recomputedJobId = recomputeD6jD4CJobId_();
      result.RECOMPUTED_JOB_ID = recomputedJobId;
      result.EXPECTED_JOB_ID_MATCH = recomputedJobId === D6J_D4_ORIGINAL_JOB_ID_ ? 'YES' : 'NO';

      const legacyJob = await services.readFirestoreDocumentState(paths.EXPECTED_JOB_PATH);
      mergeD6jD4Result_(result, summarizeD6jD4CDocumentState_(legacyJob, 'EXPECTED_JOB'));
      const durableJob = await services.readFirestoreDocumentState(paths.ACTUAL_DURABLE_JOB_PATH);
      mergeD6jD4Result_(result, summarizeD6jD4CDocumentState_(durableJob, 'ACTUAL_DURABLE_JOB'));
      const lease = await services.readFirestoreDocumentState(paths.EXPECTED_LEASE_PATH);
      mergeD6jD4Result_(result, inspectD6jD4CLeaseState_(lease));
      mergeD6jD4Result_(result, summarizeD6jD4CDocumentState_(await services.readFirestoreDocumentState(paths.EXPECTED_GMAIL_RECORD_PATH), 'EXPECTED_GMAIL_RECORD'));
      mergeD6jD4Result_(result, summarizeD6jD4CDocumentState_(await services.readFirestoreDocumentState(paths.EXPECTED_PDF_ATTACHMENT_RECORD_PATH), 'EXPECTED_PDF_ATTACHMENT_RECORD'));
      mergeD6jD4Result_(result, summarizeD6jD4CDocumentState_(await services.readFirestoreDocumentState(paths.EXPECTED_XML_ATTACHMENT_RECORD_PATH), 'EXPECTED_XML_ATTACHMENT_RECORD'));

      const jobs = await services.listFirestoreCollectionState(D6J_D4C_DURABLE_JOB_COLLECTION_, D6J_D4C_JOBS_SCAN_LIMIT_);
      mergeD6jD4Result_(result, inspectD6jD4CJobsCollection_(jobs));
      const audit = await services.listFirestoreCollectionState(paths.REPAIR_AUDIT_COLLECTION_PATH, D6J_D4C_JOBS_SCAN_LIMIT_);
      mergeD6jD4Result_(result, inspectD6jD4CRepairAudit_(audit));
      result.FIRESTORE_EVIDENCE_STATUS = classifyD6jD4CFirestoreEvidence_(result);
    } catch (error) {
      result.FIRESTORE_EVIDENCE_STATUS = 'BLOCKED_FIRESTORE_READ_FAILED';
      result.BLOCKER_CODE = normalizeD6jD4ErrorCode_(error && (error.code || error.message) || 'BLOCKED_D6J_D4C_FIRESTORE_READ_FAILED');
      result.FIRESTORE_READ_ERROR_CODE = result.BLOCKER_CODE;
    }
    finalizeD6jD4CReadOnlyCounts_(result);
    logD6jD4CSanitizedResult_(services.logger, result);
    return result;
  }

  return Object.freeze({ run });
}

function createD6jD4CBaseResult_() {
  return {
    PHASE: D6J_D4C_PHASE_,
    FIRESTORE_EVIDENCE_STATUS: 'NOT_STARTED',
    FIRESTORE_PROJECT_ID: typeof D6J_C_FIRESTORE_PROJECT_ID_ !== 'undefined' ? D6J_C_FIRESTORE_PROJECT_ID_ : 'tonkhohd',
    FIRESTORE_DATABASE_ID: typeof D6J_C_FIRESTORE_DATABASE_ID_ !== 'undefined' ? D6J_C_FIRESTORE_DATABASE_ID_ : '(default)',
    EXPECTED_JOB_ID: D6J_D4_ORIGINAL_JOB_ID_,
    EXPECTED_JOB_PATH: '',
    EXPECTED_JOB_HTTP_STATUS: 0,
    EXPECTED_JOB_FOUND: 'NO',
    ACTUAL_DURABLE_JOB_PATH: '',
    ACTUAL_DURABLE_JOB_HTTP_STATUS: 0,
    ACTUAL_DURABLE_JOB_FOUND: 'NO',
    EXPECTED_LEASE_PATH: '',
    EXPECTED_LEASE_FOUND: 'NO',
    EXPECTED_GMAIL_RECORD_FOUND: 'NO',
    EXPECTED_PDF_ATTACHMENT_RECORD_FOUND: 'NO',
    EXPECTED_XML_ATTACHMENT_RECORD_FOUND: 'NO',
    JOBS_COLLECTION_READ_STATUS: 'NOT_RUN',
    JOBS_COLLECTION_DOCUMENT_COUNT_SCANNED: 0,
    EXPECTED_JOB_ID_MATCH_COUNT: 0,
    PILOT_ID_JOB_MATCH_COUNT: 0,
    CORRELATION_ID_JOB_MATCH_COUNT: 0,
    ALTERNATE_JOB_CANDIDATE_COUNT: 0,
    ALTERNATE_JOB_CANDIDATE_IDS: [],
    RECOMPUTED_JOB_ID: '',
    EXPECTED_JOB_ID_MATCH: 'NO',
    LEASE_FOUND: 'NO',
    LEASE_JOB_ID_MATCH: 'NO',
    LEASE_STATUS: '',
    LEASE_FINAL_JOB_STATUS: '',
    LEASE_RELEASED_AT_PRESENT: 'NO',
    LEASE_GENERATION_PRESENT: 'NO',
    REPAIR_AUDIT_COLLECTION_PATH: '',
    REPAIR_AUDIT_READ_STATUS: 'NOT_RUN',
    REPAIR_AUDIT_MATCH_COUNT: 0,
    REPAIR_AUDIT_FOUND: 'NO',
    REPAIR_AUDIT_CHANGED_COLUMNS_MATCH: 'NO',
    REPAIR_AUDIT_BEFORE_HASH_PRESENT: 'NO',
    REPAIR_AUDIT_AFTER_HASH_PRESENT: 'NO',
    REPAIR_AUDIT_BEFORE_AFTER_HASH_DIFFER: 'NO',
    REPAIR_AUDIT_TIMESTAMP_VALID: 'NO',
    SHEETS_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    SCRIPT_PROPERTIES_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION: 'NONE',
    D6J_D4C_ENTRYPOINT_EXECUTED: 'NO',
    D6J_D4_ENTRYPOINT_EXECUTED: 'NO',
    REPAIR_FUNCTION_EXECUTED: 'NO',
    D6J_C_FUNCTION_EXECUTED: 'NO',
    SCHEMA_VERSION: D6J_D4C_SCHEMA_VERSION_
  };
}

function buildD6jD4CPaths_() {
  const jobId = recomputeD6jD4CJobId_();
  const gmailId = 'd6j_gmail_' + hashPrefixD6jC_(D6J_D4_GMAIL_MESSAGE_ID_, 20);
  const pdfId = 'd6j_att_' + hashPrefixD6jC_(['PDF', D6J_D4_GMAIL_MESSAGE_ID_, D6J_D4_PDF_SHA256_].join('|'), 20);
  const xmlId = 'd6j_att_' + hashPrefixD6jC_(['XML', D6J_D4_GMAIL_MESSAGE_ID_, D6J_D4_XML_SHA256_].join('|'), 20);
  const durablePath = durableJobPath(jobId);
  return {
    EXPECTED_JOB_PATH: D6J_D4C_LEGACY_JOB_COLLECTION_ + '/' + jobId,
    ACTUAL_DURABLE_JOB_PATH: durablePath,
    ACTUAL_JOB_EVENTS_PATH: durableJobEventsPath(jobId),
    ACTUAL_COMMIT_PLAN_PATH: durablePath + '#commitPlan',
    ACTUAL_RECONCILIATION_REPORT_PATH: durablePath + '/reconciliationReports',
    EXPECTED_LEASE_PATH: workerLeasePath(jobId),
    EXPECTED_GMAIL_RECORD_PATH: 'gmail_messages/' + gmailId,
    EXPECTED_PDF_ATTACHMENT_RECORD_PATH: 'attachments/' + pdfId,
    EXPECTED_XML_ATTACHMENT_RECORD_PATH: 'attachments/' + xmlId,
    REPAIR_AUDIT_COLLECTION_PATH: durableJobEventsPath(jobId)
  };
}

function recomputeD6jD4CJobId_() {
  return 'd6j_job_' + hashPrefixD6jC_([D6J_D4_GMAIL_MESSAGE_ID_, D6J_D4_XML_SHA256_].join('|'), 20);
}

function summarizeD6jD4CDocumentState_(state, prefix) {
  const s = state || {};
  const out = {};
  out[prefix + '_HTTP_STATUS'] = Number(s.httpStatus || (s.found ? 200 : 404));
  out[prefix + '_FOUND'] = s.found || s.data ? 'YES' : 'NO';
  return out;
}

function inspectD6jD4CLeaseState_(state) {
  const s = state || {};
  const lease = s.data || {};
  const found = s.found || lease.jobId ? 'YES' : 'NO';
  return {
    EXPECTED_LEASE_HTTP_STATUS: Number(s.httpStatus || (found === 'YES' ? 200 : 404)),
    EXPECTED_LEASE_FOUND: found,
    LEASE_FOUND: found,
    LEASE_JOB_ID_MATCH: normalizeD6jD4String_(lease.jobId) === D6J_D4_ORIGINAL_JOB_ID_ ? 'YES' : 'NO',
    LEASE_STATUS: sanitizeD6jD4CCode_(lease.status),
    LEASE_FINAL_JOB_STATUS: sanitizeD6jD4CCode_(lease.finalJobStatus),
    LEASE_RELEASED_AT_PRESENT: normalizeD6jD4String_(lease.releasedAt) ? 'YES' : 'NO',
    LEASE_GENERATION_PRESENT: normalizeD6jD4String_(lease.generation || lease.fencingToken || lease.leaseGeneration) ? 'YES' : 'NO'
  };
}

function inspectD6jD4CJobsCollection_(state) {
  const s = state || {};
  const docs = (s.documents || []).map(normalizeD6jD4CListedDocument_);
  const expectedMatches = docs.filter(item => item.id === D6J_D4_ORIGINAL_JOB_ID_ || normalizeD6jD4String_(item.data.jobId) === D6J_D4_ORIGINAL_JOB_ID_);
  const pilotMatches = docs.filter(item => d6jD4CSearchText_(item.data).indexOf(D6J_D_PILOT_ID_) >= 0);
  const correlationMatches = docs.filter(item => d6jD4CSearchText_(item.data).indexOf(D6J_D_CORRELATION_ID_) >= 0);
  const alternates = docs.filter(item => item.id !== D6J_D4_ORIGINAL_JOB_ID_
    && normalizeD6jD4String_(item.data.jobId) !== D6J_D4_ORIGINAL_JOB_ID_
    && isD6jD4CAlternateJobCandidate_(item.data));
  return {
    JOBS_COLLECTION_READ_STATUS: s.readStatus || 'READ_OK',
    JOBS_COLLECTION_DOCUMENT_COUNT_SCANNED: docs.length,
    EXPECTED_JOB_ID_MATCH_COUNT: expectedMatches.length,
    PILOT_ID_JOB_MATCH_COUNT: pilotMatches.length,
    CORRELATION_ID_JOB_MATCH_COUNT: correlationMatches.length,
    ALTERNATE_JOB_CANDIDATE_COUNT: alternates.length,
    ALTERNATE_JOB_CANDIDATE_IDS: alternates.map(item => sanitizeD6jD4CDocumentId_(item.id || item.data.jobId)).slice(0, D6J_D4C_ALTERNATE_CANDIDATE_LIMIT_)
  };
}

function normalizeD6jD4CListedDocument_(item) {
  const source = item || {};
  const data = source.data || source;
  const name = normalizeD6jD4String_(source.name);
  return {
    id: sanitizeD6jD4CDocumentId_(source.id || normalizeD6jD4LastPathSegment_(name) || data.jobId),
    data
  };
}

function inspectD6jD4CRepairAudit_(state) {
  const s = state || {};
  const docs = (s.documents || []).map(item => item.data || item);
  const matches = docs.filter(event => normalizeD6jD4String_(event.eventType) === 'D6J_D_SINGLE_ROW_REPAIR'
    && normalizeD6jD4String_(event.jobId || D6J_D4_ORIGINAL_JOB_ID_) === D6J_D4_ORIGINAL_JOB_ID_);
  const detail = matches.length === 1 ? (matches[0].safeDetails || matches[0]) : {};
  const beforeHash = normalizeD6jD4String_(detail.beforeHash);
  const afterHash = normalizeD6jD4String_(detail.afterHash);
  return {
    REPAIR_AUDIT_READ_STATUS: s.readStatus || 'READ_OK',
    REPAIR_AUDIT_MATCH_COUNT: matches.length,
    REPAIR_AUDIT_FOUND: matches.length === 1 ? 'YES' : 'NO',
    REPAIR_AUDIT_CHANGED_COLUMNS_MATCH: normalizeD6jD4Columns_(detail.changedColumns).join(',') === D6J_D4_EXPECTED_CHANGED_COLUMNS_.join(',') ? 'YES' : 'NO',
    REPAIR_AUDIT_BEFORE_HASH_PRESENT: beforeHash ? 'YES' : 'NO',
    REPAIR_AUDIT_AFTER_HASH_PRESENT: afterHash ? 'YES' : 'NO',
    REPAIR_AUDIT_BEFORE_AFTER_HASH_DIFFER: beforeHash && afterHash && beforeHash !== afterHash ? 'YES' : 'NO',
    REPAIR_AUDIT_TIMESTAMP_VALID: isD6jD4ValidTimestamp_(detail.repairedAt || matches[0] && matches[0].occurredAt) ? 'YES' : 'NO'
  };
}

function classifyD6jD4CFirestoreEvidence_(result) {
  if (Number(result.ALTERNATE_JOB_CANDIDATE_COUNT || 0) > 1) return 'BLOCKED_MULTIPLE_JOB_CANDIDATES';
  const jobFound = result.ACTUAL_DURABLE_JOB_FOUND === 'YES';
  const auditFound = result.REPAIR_AUDIT_FOUND === 'YES';
  if (jobFound && auditFound) return 'PASS_EXPECTED_JOB_AND_AUDIT_FOUND';
  if (!jobFound && auditFound) return 'RECONCILIATION_REQUIRED_JOB_MISSING_AUDIT_PRESENT';
  if (jobFound && !auditFound) return 'RECONCILIATION_REQUIRED_JOB_PRESENT_AUDIT_MISSING';
  return 'RECONCILIATION_REQUIRED_JOB_AND_AUDIT_MISSING';
}

function isD6jD4CAlternateJobCandidate_(data) {
  const text = d6jD4CSearchText_(data);
  return text.indexOf(D6J_D_PILOT_ID_) >= 0
    || text.indexOf(D6J_D_CORRELATION_ID_) >= 0
    || text.indexOf(D6J_D4_GMAIL_MESSAGE_ID_) >= 0
    || text.indexOf(D6J_D4_INVOICE_KEY_) >= 0
    || text.indexOf(D6J_D4_XML_SHA256_) >= 0
    || normalizeD6jD4String_(data && data.status).toLowerCase() === 'completed';
}

function d6jD4CSearchText_(value) {
  try {
    return JSON.stringify(value || {});
  } catch (_error) {
    return '';
  }
}

function readD6jD4CFirestoreDocumentStateReadOnly_(path) {
  return requestD6jD4CFirestoreReadOnly_('DOCUMENT', path, D6J_D4C_JOBS_SCAN_LIMIT_);
}

function listD6jD4CFirestoreCollectionStateReadOnly_(path, pageSize) {
  return requestD6jD4CFirestoreReadOnly_('COLLECTION', path, pageSize || D6J_D4C_JOBS_SCAN_LIMIT_);
}

function requestD6jD4CFirestoreReadOnly_(kind, path, pageSize) {
  const safe = kind === 'COLLECTION' ? validateD6jCFirestoreCollectionPath_(path) : validateD6jCFirestorePath_(path);
  const base = d6jCFirestoreBaseUrl_() + '/' + safe.parts.map(encodeURIComponent).join('/');
  const url = kind === 'COLLECTION' ? base + '?pageSize=' + Math.max(1, Math.min(Number(pageSize || D6J_D4C_JOBS_SCAN_LIMIT_), D6J_D4C_JOBS_SCAN_LIMIT_)) : base;
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  const status = Number(response.getResponseCode());
  const text = String(response.getContentText() || '');
  if (status === 404) return kind === 'COLLECTION'
    ? { httpStatus: 404, readStatus: 'READ_OK', documents: [] }
    : { httpStatus: 404, readStatus: 'READ_OK', found: false, data: null };
  if (status < 200 || status >= 300) throw d6jD4Error_(createD6jD4CFirestoreReadErrorCode_(status, safe.path, text), 'FIRESTORE');
  const parsed = text ? JSON.parse(text) : {};
  const codec = createFirestoreValueCodec_();
  if (kind === 'COLLECTION') {
    return {
      httpStatus: status,
      readStatus: 'READ_OK',
      documents: (parsed.documents || []).slice(0, D6J_D4C_JOBS_SCAN_LIMIT_).map(doc => ({
        name: normalizeD6jD4String_(doc.name),
        id: normalizeD6jD4LastPathSegment_(doc.name),
        data: codec.decodeDocument(doc)
      }))
    };
  }
  return {
    httpStatus: status,
    readStatus: 'READ_OK',
    found: true,
    name: normalizeD6jD4String_(parsed.name),
    data: codec.decodeDocument(parsed)
  };
}

function createD6jD4CFirestoreReadErrorCode_(status, path, text) {
  const errorStatus = typeof extractD6jCFirestoreErrorStatus_ === 'function' ? extractD6jCFirestoreErrorStatus_(text || '') : 'UNKNOWN';
  return [
    'BLOCKED_D6J_D4C_FIRESTORE_READ_FAILED',
    'HTTP_STATUS=' + Number(status || 0),
    'FIRESTORE_PROJECT_ID=' + (typeof D6J_C_FIRESTORE_PROJECT_ID_ !== 'undefined' ? D6J_C_FIRESTORE_PROJECT_ID_ : 'tonkhohd'),
    'FIRESTORE_DATABASE_ID=' + (typeof D6J_C_FIRESTORE_DATABASE_ID_ !== 'undefined' ? D6J_C_FIRESTORE_DATABASE_ID_ : '(default)'),
    'FIRESTORE_REQUEST_PATH=' + path,
    'FIRESTORE_ERROR_STATUS=' + sanitizeD6jD4CCode_(errorStatus),
    'FIRESTORE_ERROR_MESSAGE=' + sanitizeD6jD4CText_(text || '')
  ].join(';');
}

function finalizeD6jD4CReadOnlyCounts_(result) {
  result.SHEETS_MUTATION_COUNT = 0;
  result.DRIVE_MUTATION_COUNT = 0;
  result.GMAIL_MUTATION_COUNT = 0;
  result.FIRESTORE_MUTATION_COUNT = 0;
  result.TRIGGER_MUTATION_COUNT = 0;
  result.SCRIPT_PROPERTIES_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
  result.PRODUCTION_MUTATION = 'NONE';
  result.CURRENT_ENTRYPOINT_EXECUTED = 'YES';
  result.D6J_D4C_ENTRYPOINT_EXECUTED = 'YES';
  result.D6J_D4_ENTRYPOINT_EXECUTED = 'NO';
  result.PROHIBITED_D6J_D4_ENTRYPOINT_EXECUTED = 'NO';
  result.REPAIR_FUNCTION_EXECUTED = 'NO';
  result.D6J_C_FUNCTION_EXECUTED = 'NO';
}

function logD6jD4CSanitizedResult_(logger, result) {
  const text = JSON.stringify(result);
  if (/(Bearer|Authorization|refresh_token|private_key|client_secret|<\?xml|<Invoice|JVBERi0|\b80,68,70\b|"fields"\s*:)/i.test(text)) {
    throw d6jD4Error_('BLOCKED_UNSAFE_D6J_D4C_LOG_PAYLOAD');
  }
  logger.log(text);
}

function normalizeD6jD4LastPathSegment_(path) {
  const text = normalizeD6jD4String_(path);
  const parts = text.split('/').filter(Boolean);
  return sanitizeD6jD4CDocumentId_(parts[parts.length - 1] || '');
}

function sanitizeD6jD4CDocumentId_(value) {
  return normalizeD6jD4String_(value).replace(/[^A-Za-z0-9._:-]/g, '_').slice(0, 120);
}

function sanitizeD6jD4CCode_(value) {
  return normalizeD6jD4String_(value).replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 80);
}

function sanitizeD6jD4CText_(value) {
  return normalizeD6jD4String_(value)
    .replace(/Bearer\s+[^\s,;)]*/ig, 'REDACTED')
    .replace(/Authorization\s+[^\s,;)]*/ig, 'REDACTED')
    .replace(/(refresh_token|private_key|client_secret)\s*[=:]?\s*[^\s,;)]*/ig, 'REDACTED')
    .replace(/[^\w .:()/-]/g, ' ')
    .slice(0, 180);
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
  result.CURRENT_ENTRYPOINT_EXECUTED = 'YES';
  result.D6J_D4_ENTRYPOINT_EXECUTED = result.PHASE === D6J_D4_PHASE_ ? 'YES' : 'NO';
  result.PROHIBITED_D6J_D4_ENTRYPOINT_EXECUTED = 'NO';
  result.D6J_D4D_PREVIEW_ENTRYPOINT_EXECUTED = 'NO';
  result.D6J_D4D_MUTATION_ENTRYPOINT_EXECUTED = 'NO';
  result.REPAIR_FUNCTION_EXECUTED = 'NO';
  result.D6J_C_FUNCTION_EXECUTED = 'NO';
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

function buildD6jD4VerifiedCurrentRowHash_(row) {
  const source = row || {};
  const payload = {
    rowNumber: Number(source.rowNumber || 0),
    values: (source.values || []).map(normalizeD6jD4HashValue_),
    displayValues: (source.displayValues || []).map(normalizeD6jD4HashValue_),
    formulas: (source.formulas || []).map(normalizeD6jD4HashValue_),
    formulasR1C1: (source.formulasR1C1 || []).map(normalizeD6jD4HashValue_),
    numberFormats: (source.numberFormats || []).map(normalizeD6jD4HashValue_)
  };
  return buildD6jD4Sha256Hex_(stableD6jD4Json_(payload));
}

function normalizeD6jD4HashValue_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, 'Etc/UTC', "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
  if (Array.isArray(value)) return value.map(normalizeD6jD4HashValue_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      out[key] = normalizeD6jD4HashValue_(value[key]);
    });
    return out;
  }
  return value == null ? '' : value;
}

function stableD6jD4Json_(value) {
  return JSON.stringify(normalizeD6jD4HashValue_(value));
}

function buildD6jD4Sha256Hex_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(text || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(byte => {
    const normalized = byte < 0 ? byte + 256 : byte;
    return (normalized < 16 ? '0' : '') + normalized.toString(16);
  }).join('');
}

function cloneD6jD4PlainObject_(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

function normalizeD6jD4ExactText_(value) {
  return normalizeD6jD4String_(value).normalize('NFC');
}

function normalizeD6jD4InvoiceNumber_(rawValue, displayValue) {
  const raw = normalizeD6jD4InvoiceNumberPart_(rawValue);
  const displayText = normalizeD6jD4String_(displayValue).normalize('NFC');
  const display = displayText ? normalizeD6jD4InvoiceNumberPart_(displayText) : { valid: true, value: raw.value };
  return {
    valid: raw.valid && display.valid && raw.value === display.value && raw.value === D6J_D4_EXPECTED_ROW_.C,
    value: raw.value,
    rawAndDisplaySemanticMatch: raw.valid && display.valid && raw.value === display.value
  };
}

function normalizeD6jD4InvoiceNumberPart_(value) {
  let text = '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.floor(value) !== value || value < 0) return { valid: false, value: '' };
    text = String(value);
  } else {
    text = normalizeD6jD4String_(value).normalize('NFC');
  }
  if (!/^\d+$/.test(text)) return { valid: false, value: '' };
  const normalized = text.replace(/^0+(?=\d)/, '');
  return { valid: true, value: normalized.padStart(D6J_D4_EXPECTED_ROW_.C.length, '0') };
}

function normalizeD6jD4ErrorCode_(value) {
  return normalizeD6jD4String_(value).split(':')[0].split(';')[0].replace(/[^A-Z0-9_]/g, '_').slice(0, 100) || 'BLOCKED_D6J_D4_UNKNOWN';
}

function markD6jD4BlockedStage_(result, error, code) {
  const stage = normalizeD6jD4String_(error && error.stage);
  const status = code.indexOf('RECONCILIATION_REQUIRED') === 0 ? 'RECONCILIATION_REQUIRED' : 'BLOCKED';
  if (stage === 'PREFLIGHT' || stage === 'SHEET') result.SHEET_VERIFICATION_STATUS = status;
  else if (stage === 'FIRESTORE') result.FIRESTORE_VERIFICATION_STATUS = status;
  else if (stage === 'DRIVE') result.DRIVE_VERIFICATION_STATUS = status;
  else if (stage === 'GMAIL') result.GMAIL_VERIFICATION_STATUS = status;
  else if (stage === 'TRIGGER') result.TRIGGER_VERIFICATION_STATUS = status;
}

function d6jD4Error_(code, stage) {
  const error = new Error(String(code));
  error.code = normalizeD6jD4ErrorCode_(code);
  error.stage = stage || '';
  return error;
}

function d6jD4ErrorWithDiagnostics_(code, diagnostics, stage) {
  const error = d6jD4Error_(code, stage);
  error.diagnostics = diagnostics || {};
  return error;
}
