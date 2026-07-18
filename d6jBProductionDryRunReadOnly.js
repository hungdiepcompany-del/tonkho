const D6J_B_DRY_RUN_SCHEMA_VERSION_ = 'D6J_B_SAFE_EXACT_PRODUCTION_DRY_RUN_CHANNEL_V1';
const D6J_B_DRY_RUN_ENTRYPOINT_ = 'runD6jBProductionDryRunReadOnly';
const D6J_B_DRY_RUN_APPROVAL_ = 'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN';
const D6J_B_MAX_GMAIL_CANDIDATES_ = 2;
const D6J_B_MAX_SHEET_SCAN_ROWS_ = 2000;

const D6J_B_REQUIRED_SCRIPT_PROPERTIES_ = Object.freeze([
  'D6J_PILOT_SENDER',
  'D6J_PILOT_SUBJECT',
  'D6J_PILOT_RECEIVED_DATE',
  'D6J_PILOT_MESSAGE_ID',
  'D6J_PILOT_PDF_FILENAME',
  'D6J_PILOT_XML_FILENAME',
  'D6J_DRIVE_ROOT_FOLDER_ID',
  'D6J_SPREADSHEET_ID',
  'D6J_SHEET_NAME',
  'D6J_HEADER_ROW',
  'D6J_EXPECTED_ATTACHMENT_COUNT',
  'D6J_MAX_DRIVE_FILES',
  'D6J_MAX_SHEET_INSERTS',
  'D6J_MAX_SHEET_UPDATES',
  'D6J_MAX_FIRESTORE_ATTACHMENTS',
  'D6J_DRY_RUN_APPROVAL_MARKER'
]);

function runD6jBProductionDryRunReadOnly() {
  const runner = createD6jBProductionDryRunReadOnlyRunner_();
  return runner.run();
}

function createD6jBProductionDryRunReadOnlyRunner_(deps) {
  const d = deps || {};
  const services = {
    readProperties: d.readProperties || readD6jBScriptProperties_,
    gmailSearch: d.gmailSearch || ((query, start, max) => GmailApp.search(query, start, max)),
    driveGetFolderById: d.driveGetFolderById || (folderId => DriveApp.getFolderById(folderId)),
    openSpreadsheetById: d.openSpreadsheetById || (spreadsheetId => SpreadsheetApp.openById(spreadsheetId)),
    firestoreReadDocument: d.firestoreReadDocument || null,
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log() {} })
  };

  function run() {
    const base = createD6jBBaseResult_();
    try {
      const config = validateD6jBConfig_(services.readProperties());
      const query = buildD6jBGmailQuery_(config);
      const gmail = inspectD6jBGmailReadOnly_(services.gmailSearch, query, config);
      const attachments = gmail.attachments || {};
      const drive = gmail.readyForPlanning
        ? inspectD6jBDriveReadOnly_(services.driveGetFolderById, config, attachments)
        : createD6jBDriveBlockedPlan_();
      const sheets = gmail.readyForPlanning
        ? inspectD6jBSheetsReadOnly_(services.openSpreadsheetById, config, attachments)
        : createD6jBSheetsBlockedPlan_();
      const fire = gmail.readyForPlanning
        ? inspectD6jBFirestoreReadOnly_(services.firestoreReadDocument, config, attachments)
        : createD6jBFirestoreBlockedPlan_('BLOCKED_GMAIL_GATE');
      const result = finalizeD6jBResult_(base, config, gmail, drive, sheets, fire);
      logD6jBSanitizedResult_(services.logger, result);
      return result;
    } catch (error) {
      const result = {
        ...base,
        DRY_RUN_STATUS: String(error && error.code || error && error.message || 'BLOCKED_UNKNOWN'),
        BLOCKER_CODE: String(error && error.code || 'D6J_B_DRY_RUN_BLOCKED'),
        BLOCKER_MESSAGE: sanitizeD6jBLogText_(String(error && error.message || error || 'unknown'))
      };
      logD6jBSanitizedResult_(services.logger, result);
      return result;
    }
  }

  return Object.freeze({ run });
}

function readD6jBScriptProperties_() {
  const props = PropertiesService.getScriptProperties();
  const out = {};
  D6J_B_REQUIRED_SCRIPT_PROPERTIES_.forEach(name => {
    out[name] = String(props.getProperty(name) || '').trim();
  });
  return out;
}

function validateD6jBConfig_(raw) {
  const source = raw || {};
  const missing = D6J_B_REQUIRED_SCRIPT_PROPERTIES_.filter(name => !String(source[name] || '').trim());
  if (missing.length) throw d6jBError_('BLOCKED_MISSING_SCRIPT_PROPERTIES:' + missing.join(','));
  if (String(source.D6J_DRY_RUN_APPROVAL_MARKER).trim() !== D6J_B_DRY_RUN_APPROVAL_) {
    throw d6jBError_('BLOCKED_INVALID_DRY_RUN_APPROVAL_MARKER');
  }
  const received = normalizeD6jBDate_(source.D6J_PILOT_RECEIVED_DATE);
  return Object.freeze({
    sender: normalizeD6jBEmail_(source.D6J_PILOT_SENDER),
    subject: normalizeD6jBString_(source.D6J_PILOT_SUBJECT),
    receivedDate: received.isoDate,
    messageId: normalizeD6jBString_(source.D6J_PILOT_MESSAGE_ID),
    pdfFilename: normalizeD6jBString_(source.D6J_PILOT_PDF_FILENAME),
    xmlFilename: normalizeD6jBString_(source.D6J_PILOT_XML_FILENAME),
    driveRootFolderId: normalizeD6jBString_(source.D6J_DRIVE_ROOT_FOLDER_ID),
    spreadsheetId: normalizeD6jBString_(source.D6J_SPREADSHEET_ID),
    sheetName: normalizeD6jBString_(source.D6J_SHEET_NAME),
    headerRow: parseD6jBPositiveInteger_(source.D6J_HEADER_ROW, 'D6J_HEADER_ROW'),
    expectedAttachmentCount: parseD6jBPositiveInteger_(source.D6J_EXPECTED_ATTACHMENT_COUNT, 'D6J_EXPECTED_ATTACHMENT_COUNT'),
    maxDriveFiles: parseD6jBPositiveInteger_(source.D6J_MAX_DRIVE_FILES, 'D6J_MAX_DRIVE_FILES'),
    maxSheetInserts: parseD6jBPositiveInteger_(source.D6J_MAX_SHEET_INSERTS, 'D6J_MAX_SHEET_INSERTS'),
    maxSheetUpdates: parseD6jBNonNegativeInteger_(source.D6J_MAX_SHEET_UPDATES, 'D6J_MAX_SHEET_UPDATES'),
    maxFirestoreAttachments: parseD6jBPositiveInteger_(source.D6J_MAX_FIRESTORE_ATTACHMENTS, 'D6J_MAX_FIRESTORE_ATTACHMENTS')
  });
}

function buildD6jBGmailQuery_(config) {
  const date = normalizeD6jBDate_(config.receivedDate);
  return [
    'from:' + escapeD6jBGmailQueryValue_(config.sender),
    'subject:' + escapeD6jBGmailQueryValue_(config.subject),
    'after:' + date.previousCompactDate,
    'before:' + date.nextCompactDate,
    'has:attachment'
  ].join(' ');
}

function inspectD6jBGmailReadOnly_(gmailSearch, query, config) {
  const threads = gmailSearch(query, 0, D6J_B_MAX_GMAIL_CANDIDATES_) || [];
  const candidates = [];
  threads.slice(0, D6J_B_MAX_GMAIL_CANDIDATES_).forEach(thread => {
    const messages = typeof thread.getMessages === 'function' ? thread.getMessages() : [];
    messages.forEach(message => {
      if (!d6jBMessageMatchesQuery_(message, config)) return;
      candidates.push({ thread, message });
    });
  });
  if (candidates.length === 0) {
    return { DRY_RUN_STATUS: 'BLOCKED_GMAIL_QUERY_ZERO_MATCH', GMAIL_QUERY_MATCH_COUNT: 0, readyForPlanning: false };
  }
  if (candidates.length > 1) {
    return { DRY_RUN_STATUS: 'BLOCKED_GMAIL_QUERY_NOT_UNIQUE', GMAIL_QUERY_MATCH_COUNT: candidates.length, readyForPlanning: false };
  }
  const message = candidates[0].message;
  const messageId = normalizeD6jBString_(message.getId && message.getId());
  const messageIdMatch = messageId === config.messageId;
  const attachments = normalizeD6jBAttachments_(message.getAttachments({ includeInlineImages: false }) || []);
  const attachmentCheck = validateD6jBAttachments_(attachments, config);
  const status = !messageIdMatch
    ? 'BLOCKED_GMAIL_MESSAGE_ID_MISMATCH'
    : attachmentCheck.status;
  return {
    DRY_RUN_STATUS: status,
    GMAIL_QUERY_MATCH_COUNT: 1,
    MESSAGE_COUNT: 1,
    GMAIL_MESSAGE_ID: messageId,
    GMAIL_MESSAGE_ID_MATCH: messageIdMatch ? 'YES' : 'NO',
    ATTACHMENT_COUNT: attachments.length,
    PDF_FILENAME_MATCH: attachmentCheck.pdfFilenameMatch,
    PDF_MIME_TYPE_MATCH: attachmentCheck.pdfMimeTypeMatch,
    PDF_SIZE_BYTES: attachmentCheck.pdf ? attachmentCheck.pdf.sizeBytes : 0,
    PDF_SHA256: attachmentCheck.pdf ? attachmentCheck.pdf.sha256 : '',
    XML_FILENAME_MATCH: attachmentCheck.xmlFilenameMatch,
    XML_MIME_TYPE_MATCH: attachmentCheck.xmlMimeTypeMatch,
    XML_SIZE_BYTES: attachmentCheck.xml ? attachmentCheck.xml.sizeBytes : 0,
    XML_SHA256: attachmentCheck.xml ? attachmentCheck.xml.sha256 : '',
    readyForPlanning: status === 'PASS_GMAIL_EXACT_MESSAGE_AND_ATTACHMENTS',
    attachments: attachmentCheck
  };
}

function d6jBMessageMatchesQuery_(message, config) {
  const subject = normalizeD6jBString_(message.getSubject && message.getSubject());
  const from = normalizeD6jBEmail_(message.getFrom && message.getFrom());
  const date = normalizeD6jBMessageDate_(message.getDate && message.getDate());
  const attachments = message.getAttachments({ includeInlineImages: false }) || [];
  return subject === config.subject
    && from.indexOf(config.sender) >= 0
    && date === config.receivedDate
    && attachments.length > 0;
}

function normalizeD6jBAttachments_(attachments) {
  return (Array.isArray(attachments) ? attachments : []).map(attachment => {
    const bytes = typeof attachment.getBytes === 'function'
      ? attachment.getBytes()
      : (attachment.getBlob && attachment.getBlob().getBytes ? attachment.getBlob().getBytes() : []);
    return {
      name: normalizeD6jBString_(attachment.getName && attachment.getName()),
      mimeType: normalizeD6jBString_(attachment.getContentType && attachment.getContentType()).toLowerCase(),
      sizeBytes: bytes.length,
      sha256: sha256D6jBBytes_(bytes)
    };
  });
}

function validateD6jBAttachments_(attachments, config) {
  const pdf = attachments.find(att => att.name === config.pdfFilename);
  const xml = attachments.find(att => att.name === config.xmlFilename);
  const pdfMimeOk = Boolean(pdf && pdf.mimeType === 'application/pdf');
  const xmlMimeOk = Boolean(xml && (xml.mimeType === 'application/xml' || xml.mimeType === 'text/xml'));
  let status = 'PASS_GMAIL_EXACT_MESSAGE_AND_ATTACHMENTS';
  if (attachments.length !== config.expectedAttachmentCount) status = 'BLOCKED_ATTACHMENT_COUNT_MISMATCH';
  else if (!pdf) status = 'BLOCKED_PDF_FILENAME_MISMATCH';
  else if (!xml) status = 'BLOCKED_XML_FILENAME_MISMATCH';
  else if (!pdfMimeOk) status = 'BLOCKED_PDF_MIME_TYPE_MISMATCH';
  else if (!xmlMimeOk) status = 'BLOCKED_XML_MIME_TYPE_MISMATCH';
  return {
    status,
    pdf,
    xml,
    pdfFilenameMatch: pdf ? 'YES' : 'NO',
    pdfMimeTypeMatch: pdfMimeOk ? 'YES' : 'NO',
    xmlFilenameMatch: xml ? 'YES' : 'NO',
    xmlMimeTypeMatch: xmlMimeOk ? 'YES' : 'NO'
  };
}

function inspectD6jBDriveReadOnly_(driveGetFolderById, config, attachments) {
  try {
    const folder = driveGetFolderById(config.driveRootFolderId);
    const folderId = normalizeD6jBString_(folder && folder.getId && folder.getId());
    const rootMatch = !folderId || folderId === config.driveRootFolderId;
    const duplicate = detectD6jBDriveDuplicates_(folder, [attachments.pdf, attachments.xml]);
    const filesPlanned = Math.min(config.maxDriveFiles, duplicate.filesPlanned);
    return {
      DRIVE_ROOT_MATCH: rootMatch ? 'YES' : 'NO',
      DRIVE_ACCESS_READ_VERIFIED: 'YES',
      DRIVE_WRITE_ACCESS_NOT_PROBED: 'YES',
      DRIVE_FILES_PLANNED: filesPlanned,
      DRIVE_FOLDERS_PLANNED: 0,
      DRIVE_DUPLICATE_STATUS: duplicate.status
    };
  } catch (error) {
    return {
      DRIVE_ROOT_MATCH: 'NO',
      DRIVE_ACCESS_READ_VERIFIED: 'NO',
      DRIVE_WRITE_ACCESS_NOT_PROBED: 'YES',
      DRIVE_FILES_PLANNED: 0,
      DRIVE_FOLDERS_PLANNED: 0,
      DRIVE_DUPLICATE_STATUS: 'READ_BLOCKED'
    };
  }
}

function detectD6jBDriveDuplicates_(folder, plannedAttachments) {
  let exactMatches = 0;
  let nameConflicts = 0;
  plannedAttachments.filter(Boolean).forEach(att => {
    const iterator = folder && typeof folder.getFilesByName === 'function' ? folder.getFilesByName(att.name) : null;
    let inspected = 0;
    let exactForAttachment = false;
    while (iterator && iterator.hasNext && iterator.hasNext() && inspected < 2) {
      inspected += 1;
      const file = iterator.next();
      const blob = file && file.getBlob && file.getBlob();
      const bytes = blob && blob.getBytes ? blob.getBytes() : [];
      const hash = bytes.length ? sha256D6jBBytes_(bytes) : '';
      if (hash && hash === att.sha256) exactForAttachment = true;
      else nameConflicts += 1;
    }
    if (exactForAttachment) exactMatches += 1;
  });
  const plannedCount = plannedAttachments.filter(Boolean).length;
  if (exactMatches === plannedCount && plannedCount > 0) return { status: 'EXISTING_EXACT_MATCH', filesPlanned: 0 };
  if (exactMatches > 0) return { status: 'PARTIAL_EXACT_MATCH', filesPlanned: plannedCount - exactMatches };
  if (nameConflicts > 0) return { status: 'NAME_CONFLICT_REVIEW_REQUIRED', filesPlanned: plannedCount };
  return { status: 'NO_DUPLICATE_FOUND', filesPlanned: plannedCount };
}

function inspectD6jBSheetsReadOnly_(openSpreadsheetById, config, attachments) {
  try {
    const spreadsheet = openSpreadsheetById(config.spreadsheetId);
    const spreadsheetId = normalizeD6jBString_(spreadsheet && spreadsheet.getId && spreadsheet.getId());
    const sheet = spreadsheet && spreadsheet.getSheetByName && spreadsheet.getSheetByName(config.sheetName);
    if (!sheet) return { ...createD6jBSheetsBlockedPlan_(), SPREADSHEET_ID_MATCH: spreadsheetId === config.spreadsheetId ? 'YES' : 'NO', TARGET_SHEET_MATCH: 'NO' };
    const lastColumn = Math.max(1, Number(sheet.getLastColumn && sheet.getLastColumn() || 1));
    const header = sheet.getRange(config.headerRow, 1, 1, lastColumn).getValues()[0].map(value => normalizeD6jBString_(value));
    const headerOk = header.filter(Boolean).length >= 4;
    const duplicate = detectD6jBSheetDuplicate_(sheet, config, attachments, lastColumn);
    return {
      SPREADSHEET_ID_MATCH: !spreadsheetId || spreadsheetId === config.spreadsheetId ? 'YES' : 'NO',
      TARGET_SHEET_MATCH: 'YES',
      HEADER_ROW_MATCH: 'YES',
      HEADER_SCHEMA_STATUS: headerOk ? 'PASS' : 'BLOCKED_HEADER_SCHEMA_MISMATCH',
      SHEETS_INSERTS_PLANNED: headerOk && duplicate.status === 'NO_DUPLICATE_FOUND' ? Math.min(1, config.maxSheetInserts) : 0,
      SHEETS_UPDATES_PLANNED: 0,
      SHEETS_DUPLICATE_STATUS: duplicate.status
    };
  } catch (error) {
    return createD6jBSheetsBlockedPlan_();
  }
}

function detectD6jBSheetDuplicate_(sheet, config, attachments, lastColumn) {
  const lastRow = Math.max(0, Number(sheet.getLastRow && sheet.getLastRow() || 0));
  const rowsToRead = Math.min(D6J_B_MAX_SHEET_SCAN_ROWS_, Math.max(0, lastRow - config.headerRow));
  if (!rowsToRead) return { status: 'NO_DUPLICATE_FOUND' };
  const values = sheet.getRange(config.headerRow + 1, 1, rowsToRead, Math.min(lastColumn, 32)).getValues();
  const needles = [config.messageId, attachments.pdf && attachments.pdf.sha256, attachments.xml && attachments.xml.sha256]
    .filter(Boolean)
    .map(normalizeD6jBString_);
  const found = values.some(row => row.some(cell => needles.includes(normalizeD6jBString_(cell))));
  return { status: found ? 'EXISTING_MATCH' : 'NO_DUPLICATE_FOUND' };
}

function inspectD6jBFirestoreReadOnly_(firestoreReadDocument, config, attachments) {
  const plan = buildD6jBFirestorePlan_(config, attachments);
  if (typeof firestoreReadDocument !== 'function') {
    return { ...plan, FIRESTORE_READ_ONLY_GATE: 'BLOCKED_PERMISSION', FIRESTORE_ACTIVE_LEASE_STATUS: 'UNKNOWN_PERMISSION_BLOCKED' };
  }
  try {
    const reads = plan.targetPaths.map(path => {
      try {
        return firestoreReadDocument(path);
      } catch (error) {
        const code = String(error && error.code || error && error.message || '');
        if (code.indexOf('PERMISSION') >= 0 || code.indexOf('403') >= 0) throw d6jBError_('BLOCKED_PERMISSION');
        return null;
      }
    });
    const existingCount = reads.filter(Boolean).length;
    return {
      ...plan,
      FIRESTORE_READ_ONLY_GATE: 'READ_OK',
      FIRESTORE_ACTIVE_LEASE_STATUS: existingCount ? 'EXISTING_RECORDS_FOUND' : 'NO_ACTIVE_LEASE_FOUND'
    };
  } catch (error) {
    return { ...plan, FIRESTORE_READ_ONLY_GATE: 'BLOCKED_PERMISSION', FIRESTORE_ACTIVE_LEASE_STATUS: 'UNKNOWN_PERMISSION_BLOCKED' };
  }
}

function buildD6jBFirestorePlan_(config, attachments) {
  const jobId = 'd6j_job_' + hashPrefixD6jB_([config.messageId, attachments.xml && attachments.xml.sha256].join('|'), 20);
  const gmailId = 'd6j_gmail_' + hashPrefixD6jB_(config.messageId, 20);
  const pdfId = 'd6j_att_' + hashPrefixD6jB_(['PDF', config.messageId, attachments.pdf && attachments.pdf.sha256].join('|'), 20);
  const xmlId = 'd6j_att_' + hashPrefixD6jB_(['XML', config.messageId, attachments.xml && attachments.xml.sha256].join('|'), 20);
  return {
    PILOT_ID: 'd6j_pilot_' + hashPrefixD6jB_(config.messageId, 16),
    CORRELATION_ID: 'd6j_corr_' + hashPrefixD6jB_([config.messageId, config.receivedDate].join('|'), 16),
    FIRESTORE_JOBS_PLANNED: 1,
    FIRESTORE_GMAIL_RECORDS_PLANNED: 1,
    FIRESTORE_ATTACHMENT_RECORDS_PLANNED: 2,
    targetPaths: [
      'jobs/' + jobId,
      'gmail_messages/' + gmailId,
      'attachments/' + pdfId,
      'attachments/' + xmlId,
      'worker_leases/' + jobId
    ]
  };
}

function finalizeD6jBResult_(base, config, gmail, drive, sheets, fire) {
  const gateOk = gmail.readyForPlanning
    && drive.DRIVE_ROOT_MATCH === 'YES'
    && drive.DRIVE_FOLDERS_PLANNED === 0
    && Number(drive.DRIVE_FILES_PLANNED) <= config.maxDriveFiles
    && sheets.SPREADSHEET_ID_MATCH === 'YES'
    && sheets.TARGET_SHEET_MATCH === 'YES'
    && sheets.HEADER_ROW_MATCH === 'YES'
    && sheets.HEADER_SCHEMA_STATUS === 'PASS'
    && Number(sheets.SHEETS_INSERTS_PLANNED) <= config.maxSheetInserts
    && Number(sheets.SHEETS_UPDATES_PLANNED) === config.maxSheetUpdates
    && Number(fire.FIRESTORE_ATTACHMENT_RECORDS_PLANNED) <= config.maxFirestoreAttachments;
  const planningBlocker = classifyD6jBPlanningBlocker_(gmail, drive, sheets, fire, config);
  const dryRunStatus = gateOk && fire.FIRESTORE_READ_ONLY_GATE !== 'BLOCKED_PERMISSION'
    ? 'PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY'
    : gateOk
      ? 'PASS_READ_ONLY_WITH_FIRESTORE_PERMISSION_BLOCKER'
      : planningBlocker;
  return {
    ...base,
    DRY_RUN_STATUS: dryRunStatus,
    PILOT_ID: fire.PILOT_ID || base.PILOT_ID,
    CORRELATION_ID: fire.CORRELATION_ID || base.CORRELATION_ID,
    GMAIL_QUERY_MATCH_COUNT: Number(gmail.GMAIL_QUERY_MATCH_COUNT || 0),
    MESSAGE_COUNT: Number(gmail.MESSAGE_COUNT || 0),
    GMAIL_MESSAGE_ID: gmail.GMAIL_MESSAGE_ID || '',
    GMAIL_MESSAGE_ID_MATCH: gmail.GMAIL_MESSAGE_ID_MATCH || 'NO',
    ATTACHMENT_COUNT: Number(gmail.ATTACHMENT_COUNT || 0),
    PDF_FILENAME_MATCH: gmail.PDF_FILENAME_MATCH || 'NO',
    PDF_MIME_TYPE_MATCH: gmail.PDF_MIME_TYPE_MATCH || 'NO',
    PDF_SIZE_BYTES: Number(gmail.PDF_SIZE_BYTES || 0),
    PDF_SHA256: gmail.PDF_SHA256 || '',
    XML_FILENAME_MATCH: gmail.XML_FILENAME_MATCH || 'NO',
    XML_MIME_TYPE_MATCH: gmail.XML_MIME_TYPE_MATCH || 'NO',
    XML_SIZE_BYTES: Number(gmail.XML_SIZE_BYTES || 0),
    XML_SHA256: gmail.XML_SHA256 || '',
    ...drive,
    ...sheets,
    FIRESTORE_JOBS_PLANNED: Number(fire.FIRESTORE_JOBS_PLANNED || 0),
    FIRESTORE_GMAIL_RECORDS_PLANNED: Number(fire.FIRESTORE_GMAIL_RECORDS_PLANNED || 0),
    FIRESTORE_ATTACHMENT_RECORDS_PLANNED: Number(fire.FIRESTORE_ATTACHMENT_RECORDS_PLANNED || 0),
    FIRESTORE_READ_ONLY_GATE: fire.FIRESTORE_READ_ONLY_GATE || 'BLOCKED_PERMISSION',
    FIRESTORE_ACTIVE_LEASE_STATUS: fire.FIRESTORE_ACTIVE_LEASE_STATUS || 'UNKNOWN',
    IDEMPOTENCY_KEYS_VALID: gateOk ? 'YES' : 'NO',
    ROLLBACK_OWNERSHIP_PROVABLE: gateOk ? 'YES' : 'NO',
    RECONCILIATION_PLAN_COMPLETE: gateOk ? 'YES' : 'NO'
  };
}

function classifyD6jBPlanningBlocker_(gmail, drive, sheets, fire, config) {
  if (!gmail.readyForPlanning) return gmail.DRY_RUN_STATUS;
  if (drive.DRIVE_ROOT_MATCH !== 'YES') return 'BLOCKED_DRIVE_ROOT_MISMATCH';
  if (Number(drive.DRIVE_FOLDERS_PLANNED) !== 0) return 'BLOCKED_DRIVE_FOLDER_PLAN_NOT_ZERO';
  if (Number(drive.DRIVE_FILES_PLANNED) > config.maxDriveFiles) return 'BLOCKED_DRIVE_FILE_PLAN_LIMIT';
  if (sheets.SPREADSHEET_ID_MATCH !== 'YES') return 'BLOCKED_SPREADSHEET_ID_MISMATCH';
  if (sheets.TARGET_SHEET_MATCH !== 'YES') return 'BLOCKED_TARGET_SHEET_MISSING';
  if (sheets.HEADER_ROW_MATCH !== 'YES' || sheets.HEADER_SCHEMA_STATUS !== 'PASS') return 'BLOCKED_HEADER_SCHEMA_MISMATCH';
  if (Number(sheets.SHEETS_INSERTS_PLANNED) > config.maxSheetInserts) return 'BLOCKED_SHEET_INSERT_LIMIT';
  if (Number(sheets.SHEETS_UPDATES_PLANNED) !== config.maxSheetUpdates) return 'BLOCKED_SHEET_UPDATE_PLAN_NOT_ZERO';
  if (Number(fire.FIRESTORE_ATTACHMENT_RECORDS_PLANNED) > config.maxFirestoreAttachments) return 'BLOCKED_FIRESTORE_ATTACHMENT_PLAN_LIMIT';
  return 'BLOCKED_DRY_RUN_PLAN_INCOMPLETE';
}

function createD6jBBaseResult_() {
  return {
    PHASE: 'D6J_B_SAFE_EXACT_PRODUCTION_DRY_RUN_CHANNEL',
    DRY_RUN_STATUS: 'NOT_STARTED',
    PILOT_ID: '',
    CORRELATION_ID: '',
    GMAIL_QUERY_MATCH_COUNT: 0,
    MESSAGE_COUNT: 0,
    GMAIL_MESSAGE_ID: '',
    GMAIL_MESSAGE_ID_MATCH: 'NO',
    ATTACHMENT_COUNT: 0,
    PDF_FILENAME_MATCH: 'NO',
    PDF_MIME_TYPE_MATCH: 'NO',
    PDF_SIZE_BYTES: 0,
    PDF_SHA256: '',
    XML_FILENAME_MATCH: 'NO',
    XML_MIME_TYPE_MATCH: 'NO',
    XML_SIZE_BYTES: 0,
    XML_SHA256: '',
    DRIVE_ROOT_MATCH: 'NO',
    DRIVE_ACCESS_READ_VERIFIED: 'NO',
    DRIVE_WRITE_ACCESS_NOT_PROBED: 'YES',
    DRIVE_FILES_PLANNED: 0,
    DRIVE_FOLDERS_PLANNED: 0,
    DRIVE_DUPLICATE_STATUS: 'NOT_EVALUATED',
    SPREADSHEET_ID_MATCH: 'NO',
    TARGET_SHEET_MATCH: 'NO',
    HEADER_ROW_MATCH: 'NO',
    HEADER_SCHEMA_STATUS: 'NOT_EVALUATED',
    SHEETS_INSERTS_PLANNED: 0,
    SHEETS_UPDATES_PLANNED: 0,
    SHEETS_DUPLICATE_STATUS: 'NOT_EVALUATED',
    FIRESTORE_JOBS_PLANNED: 0,
    FIRESTORE_GMAIL_RECORDS_PLANNED: 0,
    FIRESTORE_ATTACHMENT_RECORDS_PLANNED: 0,
    FIRESTORE_ACTIVE_LEASE_STATUS: 'NOT_EVALUATED',
    FIRESTORE_READ_ONLY_GATE: 'NOT_EVALUATED',
    IDEMPOTENCY_KEYS_VALID: 'NO',
    ROLLBACK_OWNERSHIP_PROVABLE: 'NO',
    RECONCILIATION_PLAN_COMPLETE: 'NO',
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION_COUNT: 0,
    MUTATION_GATE_STATUS: 'NOT_EVALUATED_IN_THIS_PHASE',
    SCHEMA_VERSION: D6J_B_DRY_RUN_SCHEMA_VERSION_
  };
}

function createD6jBDriveBlockedPlan_() {
  return {
    DRIVE_ROOT_MATCH: 'NO',
    DRIVE_ACCESS_READ_VERIFIED: 'NO',
    DRIVE_WRITE_ACCESS_NOT_PROBED: 'YES',
    DRIVE_FILES_PLANNED: 0,
    DRIVE_FOLDERS_PLANNED: 0,
    DRIVE_DUPLICATE_STATUS: 'BLOCKED_GMAIL_GATE'
  };
}

function createD6jBSheetsBlockedPlan_() {
  return {
    SPREADSHEET_ID_MATCH: 'NO',
    TARGET_SHEET_MATCH: 'NO',
    HEADER_ROW_MATCH: 'NO',
    HEADER_SCHEMA_STATUS: 'BLOCKED',
    SHEETS_INSERTS_PLANNED: 0,
    SHEETS_UPDATES_PLANNED: 0,
    SHEETS_DUPLICATE_STATUS: 'BLOCKED'
  };
}

function createD6jBFirestoreBlockedPlan_(reason) {
  return {
    PILOT_ID: '',
    CORRELATION_ID: '',
    FIRESTORE_JOBS_PLANNED: 0,
    FIRESTORE_GMAIL_RECORDS_PLANNED: 0,
    FIRESTORE_ATTACHMENT_RECORDS_PLANNED: 0,
    FIRESTORE_READ_ONLY_GATE: reason || 'BLOCKED_PERMISSION',
    FIRESTORE_ACTIVE_LEASE_STATUS: 'NOT_EVALUATED',
    targetPaths: []
  };
}

function logD6jBSanitizedResult_(logger, result) {
  const text = JSON.stringify(result);
  if (/(Bearer|Authorization|refresh_token|private_key|client_secret|<\?xml|<Invoice|JVBERi0)/i.test(text)) {
    throw d6jBError_('BLOCKED_UNSAFE_DRY_RUN_LOG_PAYLOAD');
  }
  logger.log(text);
}

function sha256D6jBBytes_(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes || []);
  return digest.map(byte => {
    const value = byte < 0 ? byte + 256 : byte;
    return ('0' + value.toString(16)).slice(-2);
  }).join('');
}

function hashPrefixD6jB_(value, length) {
  const bytes = [];
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) bytes.push(text.charCodeAt(i) & 255);
  return sha256D6jBBytes_(bytes).slice(0, Number(length || 16));
}

function normalizeD6jBString_(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function normalizeD6jBEmail_(value) {
  const text = normalizeD6jBString_(value).toLowerCase();
  const match = text.match(/<([^>\s]+@[^>\s]+)>/) || text.match(/([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
  return match ? match[1].toLowerCase() : text;
}

function normalizeD6jBDate_(value) {
  const text = normalizeD6jBString_(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw d6jBError_('BLOCKED_INVALID_RECEIVED_DATE');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  const prev = new Date(date.getTime() - 24 * 60 * 60 * 1000);
  const next = new Date(date.getTime() + 24 * 60 * 60 * 1000);
  return {
    isoDate: text,
    previousCompactDate: formatD6jBGmailDate_(prev),
    nextCompactDate: formatD6jBGmailDate_(next)
  };
}

function normalizeD6jBMessageDate_(value) {
  if (!value || typeof value.getFullYear !== 'function' || typeof value.getMonth !== 'function' || typeof value.getDate !== 'function') return '';
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return [yyyy, mm, dd].join('-');
}

function formatD6jBGmailDate_(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return [yyyy, mm, dd].join('/');
}

function escapeD6jBGmailQueryValue_(value) {
  const text = normalizeD6jBString_(value).replace(/["\\]/g, ' ');
  return /\s/.test(text) ? '"' + text.trim() + '"' : text.trim();
}

function parseD6jBPositiveInteger_(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw d6jBError_('BLOCKED_INVALID_INTEGER:' + name);
  return number;
}

function parseD6jBNonNegativeInteger_(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw d6jBError_('BLOCKED_INVALID_INTEGER:' + name);
  return number;
}

function sanitizeD6jBLogText_(value) {
  return normalizeD6jBString_(value).replace(/(Bearer|Authorization|refresh_token|private_key|client_secret)[^\s,;)]*/ig, 'REDACTED');
}

function d6jBError_(code) {
  const error = new Error(String(code));
  error.code = String(code).split(':')[0];
  return error;
}
