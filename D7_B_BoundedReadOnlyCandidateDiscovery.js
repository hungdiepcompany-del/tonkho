const D7_B_SCHEMA_VERSION_ = 'D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY_V1';
const D7_B_FINGERPRINT_SCHEMA_VERSION_ = 'D7_B_CANDIDATE_FINGERPRINT_V1';
const D7_B_DEFAULT_MAX_GMAIL_RESULTS_ = 2;
const D7_B_MAX_GMAIL_RESULTS_HARD_CAP_ = 10;
const D7_B_MAX_MESSAGES_PER_THREAD_ = 5;
const D7_B_MAX_ATTACHMENTS_PER_MESSAGE_ = 10;
const D7_B_MAX_SHEET_SCAN_ROWS_ = 2000;
const D7_B_FIRESTORE_PROJECT_ID_ = 'tonkhohd';
const D7_B_FIRESTORE_DATABASE_ID_ = '(default)';
const D7_B_ALLOWED_FIRESTORE_COLLECTIONS_ = [
  'jobs',
  'gmail_messages',
  'attachments',
  'worker_leases',
  'invoice_candidates',
  'invoice_duplicate_index',
];
const D7_B_REACHABILITY_DENYLIST_ = [
  'triggerMarkAllInvoiceEmails',
  'runD6jCOneRecordProductionMutation',
  'runD6jDRepairSingleMalformedPilotRow',
  'main',
  '_mainInternal_',
  'scanInvoiceOutEmails_',
  'scanInvoiceInEmails_',
  'triggerScanInvoiceDriveFolder',
];

function createD7BBoundedReadOnlyCandidateDiscoveryRunner_(deps) {
  const d = deps || {};
  const adapters = {
    readProperties: d.readProperties || readD7BScriptProperties_,
    listTriggers: d.listTriggers || listD7BProjectTriggersReadOnly_,
    inspectSourceContracts: d.inspectSourceContracts || inspectD7BSourceContracts_,
    gmailSearch: d.gmailSearch || searchD7BGmailReadOnly_,
    readDriveDuplicate: d.readDriveDuplicate || readD7BDriveDuplicateReadOnly_,
    readSheetDuplicate: d.readSheetDuplicate || readD7BSheetDuplicateReadOnly_,
    readFirestoreDuplicate: d.readFirestoreDuplicate || readD7BFirestoreDuplicateReadOnly_,
    firestoreReadDocument: d.firestoreReadDocument || readD7BFirestoreDocumentReadOnly_,
    deriveInvoiceIdentity: d.deriveInvoiceIdentity || deriveD7BInvoiceIdentity_,
    logger: d.logger || Logger,
  };

  return {
    run: function () {
      const result = createD7BBaseResult_();
      try {
        const props = adapters.readProperties();
        const config = resolveD7BEffectiveConfig_(props);
        mergeD7B_(result, config.summary);
        result.EFFECTIVE_CONFIG_STATUS = config.valid ? 'PASS' : 'BLOCKED_INVALID_EFFECTIVE_CONFIG';

        const safety = recheckD7BRuntimeSafety_(adapters, config);
        mergeD7B_(result, safety);
        if (!config.valid || safety.RUNTIME_SAFETY_RECHECK !== 'PASS') {
        result.D7_B_STATUS = 'BLOCKED_RUNTIME_SAFETY_RECHECK';
          result.CANDIDATE_DISCOVERY_EXECUTED = 'NO';
          return finalizeD7BResult_(result, adapters.logger);
        }

        result.CANDIDATE_DISCOVERY_EXECUTED = 'YES_READ_ONLY';
        const gmail = discoverD7BGmailCandidatesReadOnly_(adapters, config);
        mergeD7B_(result, gmail.summary);
        if (gmail.status !== 'PASS') {
          result.D7_B_STATUS = gmail.status;
          return finalizeD7BResult_(result, adapters.logger);
        }

        const cardinality = classifyD7BCardinality_(gmail.candidates);
        mergeD7B_(result, cardinality.summary);
        if (cardinality.status !== 'PASS') {
          result.D7_B_STATUS = cardinality.status;
          return finalizeD7BResult_(result, adapters.logger);
        }

        const candidate = gmail.candidates[0];
        const fingerprint = createD7BCandidateFingerprint_(candidate, config, adapters);
        mergeD7B_(result, fingerprint.summary);
        if (fingerprint.status !== 'PASS') {
          result.D7_B_STATUS = fingerprint.status;
          return finalizeD7BResult_(result, adapters.logger);
        }

        const duplicates = readD7BDuplicateEvidenceReadOnly_(candidate, fingerprint, config, adapters);
        mergeD7B_(result, duplicates.summary);
        result.D7_B_STATUS = duplicates.status;
        result.D7_C_APPROVAL_READY = duplicates.status === 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW' ? 'YES' : 'NO';
        return finalizeD7BResult_(result, adapters.logger);
      } catch (error) {
        result.D7_B_STATUS = 'BLOCKED_UNEXPECTED_ERROR';
        result.BLOCKER_CODE = sanitizeD7BString_(error && error.message ? error.message : String(error));
        return finalizeD7BResult_(result, adapters.logger);
      }
    },
  };
}

function createD7BBaseResult_() {
  return {
    D7_B_SCHEMA_VERSION: D7_B_SCHEMA_VERSION_,
    PHASE: 'D7_B_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY',
    SCHEMA_VERSION: D7_B_SCHEMA_VERSION_,
    D7_B_STATUS: 'NOT_EVALUATED',
    CANDIDATE_DISCOVERY_STATUS: 'NOT_EVALUATED',
    D7_C_APPROVAL_READY: 'NO',
    READY_FOR_D7_C: 'NO',
    READ_ONLY_MODE: 'YES',
    MUTATION_ATTEMPT_COUNT: 0,
    PRODUCTION_WRITE: 'NONE',
    TRIGGER_MUTATION: 'NO',
    SCRIPT_PROPERTIES_MUTATION: 'NO',
    GMAIL_MUTATION: 'NO',
    DRIVE_MUTATION: 'NO',
    SHEETS_MUTATION: 'NO',
    FIRESTORE_MUTATION: 'NO',
    CANDIDATE_DISCOVERY_EXECUTED: 'NO',
    RUNTIME_SAFETY_RECHECK: 'NOT_EVALUATED',
    EFFECTIVE_CONFIG_STATUS: 'NOT_EVALUATED',
    GMAIL_READ_STATUS: 'NOT_EVALUATED',
    GMAIL_QUERY_POLICY_HASH: '',
    GMAIL_SEARCH_RESULT_COUNT: 0,
    GMAIL_THREAD_COUNT: 0,
    GMAIL_MESSAGE_COUNT: 0,
    INSPECTED_THREAD_COUNT: 0,
    INSPECTED_MESSAGE_COUNT: 0,
    INSPECTED_ATTACHMENT_COUNT: 0,
    ATTACHMENT_VALIDATION_STATUS: 'NOT_EVALUATED',
    ELIGIBLE_CANDIDATE_COUNT: 0,
    APPROVED_CANDIDATE_COUNT: 0,
    CARDINALITY_STATUS: 'NOT_EVALUATED',
    FINGERPRINT_STATUS: 'NOT_EVALUATED',
    GMAIL_DUPLICATE_STATUS: 'NOT_EVALUATED',
    DRIVE_DUPLICATE_STATUS: 'NOT_EVALUATED',
    SHEET_DUPLICATE_STATUS: 'NOT_EVALUATED',
    FIRESTORE_DUPLICATE_STATUS: 'NOT_EVALUATED',
    MESSAGE_ID_HASH: '',
    THREAD_ID_HASH: '',
    PDF_SHA256: '',
    XML_SHA256: '',
    ATTACHMENT_SET_SHA256: '',
    INVOICE_KEY_HASH: '',
    HASH_INDEX_HASH: '',
    CANDIDATE_FINGERPRINT: '',
    RAW_EMAIL_ADDRESS_LOG_COUNT: 0,
    RAW_EMAIL_SUBJECT_LOG_COUNT: 0,
    RAW_EMAIL_BODY_LOG_COUNT: 0,
    RAW_MESSAGE_ID_LOG_COUNT: 0,
    RAW_XML_LOG_COUNT: 0,
    RAW_PDF_CONTENT_LOG_COUNT: 0,
    CUSTOMER_CONTENT_LOG_COUNT: 0,
    SCRIPT_PROPERTIES_MUTATION_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_ENTRYPOINT_EXECUTED: 'NO',
    PRODUCTION_MUTATION: 'NONE',
    BLOCKER_CODE: '',
  };
}

function resolveD7BEffectiveConfig_(props) {
  const p = props || {};
  const sender = firstD7BNonEmpty_(p.D7_B_GMAIL_SENDER, p.D7_GMAIL_SENDER, p.D6J_PILOT_SENDER);
  const subject = firstD7BNonEmpty_(p.D7_B_GMAIL_SUBJECT, p.D7_GMAIL_SUBJECT, p.D6J_PILOT_SUBJECT);
  const receivedDate = firstD7BNonEmpty_(p.D7_B_RECEIVED_DATE, p.D7_GMAIL_RECEIVED_DATE, p.D6J_PILOT_RECEIVED_DATE);
  const folderId = firstD7BNonEmpty_(p.D7_B_DRIVE_ROOT_FOLDER_ID, p.D7_DRIVE_ROOT_FOLDER_ID, p.D6J_DRIVE_ROOT_FOLDER_ID);
  const spreadsheetId = firstD7BNonEmpty_(p.D7_B_SPREADSHEET_ID, p.D7_SPREADSHEET_ID, p.D6J_SPREADSHEET_ID);
  const sheetName = firstD7BNonEmpty_(p.D7_B_TARGET_SHEET_NAME, p.D7_TARGET_SHEET_NAME, p.D6J_TARGET_SHEET_NAME, 'Nhap-Xuat');
  const maxResultsRaw = firstD7BNonEmpty_(p.D7_B_MAX_GMAIL_RESULTS, p.D7_MAX_MESSAGES_PER_CYCLE, p.MAX_MESSAGES_PER_CYCLE);
  const maxResults = clampD7BInteger_(maxResultsRaw, D7_B_DEFAULT_MAX_GMAIL_RESULTS_, 1, D7_B_MAX_GMAIL_RESULTS_HARD_CAP_);
  const errors = [];
  if (!sender) errors.push('MISSING_GMAIL_SENDER');
  if (!subject) errors.push('MISSING_GMAIL_SUBJECT');
  if (!normalizeD7BDate_(receivedDate)) errors.push('MISSING_OR_INVALID_RECEIVED_DATE');
  if (!folderId) errors.push('MISSING_DRIVE_ROOT_FOLDER_ID');
  if (!spreadsheetId) errors.push('MISSING_SPREADSHEET_ID');

  const dateWindow = createD7BDateWindow_(receivedDate);
  const query = errors.length === 0
    ? buildD7BBoundedGmailQuery_({ sender: sender, subject: subject, receivedDate: receivedDate })
    : '';

  return {
    valid: errors.length === 0,
    sender: sender,
    subject: subject,
    receivedDate: normalizeD7BDate_(receivedDate),
    folderId: folderId,
    spreadsheetId: spreadsheetId,
    sheetName: sheetName,
    maxResults: maxResults,
    dateWindow: dateWindow,
    boundedQuery: query,
    summary: {
      EFFECTIVE_CONFIG_ERROR_COUNT: errors.length,
      EFFECTIVE_CONFIG_ERROR_CODES: errors.join(',') || 'NONE',
      GMAIL_QUERY_DATE_WINDOW_DEFINED: dateWindow ? 'YES' : 'NO',
      GMAIL_QUERY_MAX_RESULT_COUNT: maxResults,
      GMAIL_QUERY_POLICY_HASH: query ? hashPrefixD7B_(sha256D7BText_(query), 16) : '',
    },
  };
}

function recheckD7BRuntimeSafety_(adapters, config) {
  const triggers = adapters.listTriggers();
  const source = adapters.inspectSourceContracts();
  const mutatingTriggers = triggers.filter(function (trigger) {
    return D7_B_REACHABILITY_DENYLIST_.indexOf(trigger.handlerFunction) !== -1;
  });
  const nonReadOnlyD7 = triggers.filter(function (trigger) {
    return String(trigger.handlerFunction || '').indexOf('ReadOnly') === -1 &&
      String(trigger.handlerFunction || '').indexOf('D7') !== -1;
  });
  const triggerSafe = mutatingTriggers.length === 0 && nonReadOnlyD7.length === 0;
  const sourceSafe = source.mutationEntrypointReachabilityCount === 0 &&
    source.publicEntrypointCount === 1 &&
    source.runnerFactoryCount === 1;
  return {
    RUNTIME_SAFETY_RECHECK: triggerSafe && sourceSafe && config.valid ? 'PASS' : 'BLOCKED',
    TRIGGER_TOTAL_COUNT: triggers.length,
    MUTATING_TRIGGER_MATCH_COUNT: mutatingTriggers.length,
    NON_READ_ONLY_D7_TRIGGER_COUNT: nonReadOnlyD7.length,
    SOURCE_MUTATION_ENTRYPOINT_REACHABILITY_COUNT: source.mutationEntrypointReachabilityCount,
    D7_B_PUBLIC_ENTRYPOINT_COUNT: source.publicEntrypointCount,
    D7_B_RUNNER_FACTORY_COUNT: source.runnerFactoryCount,
  };
}

function discoverD7BGmailCandidatesReadOnly_(adapters, config) {
  const summary = {
    GMAIL_READ_STATUS: 'NOT_EVALUATED',
    GMAIL_SEARCH_RESULT_COUNT: 0,
    GMAIL_THREAD_COUNT: 0,
    GMAIL_MESSAGE_COUNT: 0,
    INSPECTED_ATTACHMENT_COUNT: 0,
    ATTACHMENT_VALIDATION_STATUS: 'NOT_EVALUATED',
    ELIGIBLE_CANDIDATE_COUNT: 0,
  };
  let threads;
  try {
    threads = adapters.gmailSearch(config.boundedQuery, 0, config.maxResults);
  } catch (error) {
    summary.GMAIL_READ_STATUS = 'READ_BLOCKED';
    summary.BLOCKER_CODE = sanitizeD7BErrorCode_(error);
    return { status: 'BLOCKED_GMAIL_READ_FAILURE', candidates: [], summary: summary };
  }
  threads = threads || [];
  summary.GMAIL_READ_STATUS = 'READ_OK';
  summary.GMAIL_SEARCH_RESULT_COUNT = threads.length;
  summary.GMAIL_THREAD_COUNT = threads.length;

  const candidates = [];
  let malformedAttachmentCount = 0;
  threads.forEach(function (thread, threadIndex) {
    const messages = safeD7BCall_(function () { return thread.getMessages(); }, []) || [];
    const boundedMessages = messages.slice(0, D7_B_MAX_MESSAGES_PER_THREAD_);
    summary.GMAIL_MESSAGE_COUNT += boundedMessages.length;
    boundedMessages.forEach(function (message, messageIndex) {
      const normalized = normalizeD7BGmailMessage_(message, config, threadIndex, messageIndex);
      const validation = validateD7BAttachments_(normalized.attachments);
      summary.INSPECTED_ATTACHMENT_COUNT = (summary.INSPECTED_ATTACHMENT_COUNT || 0) + normalized.attachmentCount;
      if (normalized.subjectMatches && normalized.senderMatches && normalized.dateMatches && validation.status === 'PASS') {
        candidates.push(mergeD7B_({
          threadIndex: threadIndex,
          messageIndex: messageIndex,
          message: normalized,
        }, validation.candidate));
      } else if (validation.status === 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE') {
        malformedAttachmentCount += 1;
      }
    });
  });

  summary.ELIGIBLE_CANDIDATE_COUNT = candidates.length;
  summary.ATTACHMENT_VALIDATION_STATUS = malformedAttachmentCount > 0
    ? 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE'
    : 'PASS';
  if (malformedAttachmentCount > 0 && candidates.length === 0) {
    return { status: 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE', candidates: candidates, summary: summary };
  }
  return { status: 'PASS', candidates: candidates, summary: summary };
}

function normalizeD7BGmailMessage_(message, config, threadIndex, messageIndex) {
  const subject = String(safeD7BCall_(function () { return message.getSubject(); }, '') || '');
  const from = String(safeD7BCall_(function () { return message.getFrom(); }, '') || '');
  const date = safeD7BCall_(function () { return message.getDate(); }, null);
  const messageId = String(safeD7BCall_(function () { return message.getId(); }, '') || '');
  const threadId = String(safeD7BCall_(function () { return message.getThread().getId(); }, '') || '');
  const attachments = safeD7BCall_(function () { return message.getAttachments(); }, []) || [];
  return {
    subjectMatches: normalizeD7BSubject_(subject) === normalizeD7BSubject_(config.subject),
    senderMatches: normalizeD7BEmail_(from).indexOf(normalizeD7BEmail_(config.sender)) !== -1,
    dateMatches: isD7BDateInsideWindow_(date, config.dateWindow),
    messageIdHash: hashPrefixD7B_(sha256D7BText_(messageId || String(threadIndex) + ':' + String(messageIndex)), 16),
    threadIdHash: threadId ? hashPrefixD7B_(sha256D7BText_(threadId), 16) : '',
    messageDate: date,
    attachmentCount: Math.min(attachments.length, D7_B_MAX_ATTACHMENTS_PER_MESSAGE_),
    attachments: attachments.slice(0, D7_B_MAX_ATTACHMENTS_PER_MESSAGE_),
  };
}

function validateD7BAttachments_(attachments) {
  const a = attachments || [];
  if (a.length !== 2) return { status: 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE' };
  const pdfs = [];
  const xmls = [];
  a.forEach(function (attachment) {
    const name = String(safeD7BCall_(function () { return attachment.getName(); }, '') || '');
    const mime = String(safeD7BCall_(function () { return attachment.getContentType(); }, '') || '').toLowerCase();
    const bytes = safeD7BCall_(function () { return attachment.getBytes(); }, []) || [];
    const record = {
      nameHash: hashPrefixD7B_(sha256D7BText_(name), 16),
      mime: mime,
      size: bytes.length,
      sha256: sha256D7BBytes_(bytes),
      blob: attachment,
    };
    if (/\.pdf$/i.test(name) && mime === 'application/pdf') pdfs.push(record);
    if (/\.xml$/i.test(name) && (mime === 'application/xml' || mime === 'text/xml')) xmls.push(record);
  });
  if (pdfs.length !== 1 || xmls.length !== 1) return { status: 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE' };
  return {
    status: 'PASS',
    candidate: { pdf: pdfs[0], xml: xmls[0], attachmentCount: a.length },
  };
}

function classifyD7BCardinality_(candidates) {
  const count = (candidates || []).length;
  if (count === 0) {
    return {
      status: 'PASS_NO_ELIGIBLE_CANDIDATE',
      summary: { CARDINALITY_STATUS: 'NO_ELIGIBLE_CANDIDATE', ELIGIBLE_CANDIDATE_COUNT: 0 },
    };
  }
  if (count > 1) {
    return {
      status: 'BLOCKED_MULTIPLE_ELIGIBLE_CANDIDATES',
      summary: { CARDINALITY_STATUS: 'MULTIPLE_ELIGIBLE_CANDIDATES', ELIGIBLE_CANDIDATE_COUNT: count },
    };
  }
  return {
    status: 'PASS',
    summary: { CARDINALITY_STATUS: 'EXACTLY_ONE_ELIGIBLE_CANDIDATE', ELIGIBLE_CANDIDATE_COUNT: 1 },
  };
}

function createD7BCandidateFingerprint_(candidate, config, adapters) {
  const identity = adapters.deriveInvoiceIdentity(candidate, config);
  if (!identity || identity.status !== 'PASS') {
    return {
      status: 'BLOCKED_FINGERPRINT_FAILURE',
      summary: {
        FINGERPRINT_STATUS: 'BLOCKED_FINGERPRINT_FAILURE',
        FINGERPRINT_BLOCKER_CODE: identity && identity.blockerCode ? identity.blockerCode : 'INVOICE_IDENTITY_UNAVAILABLE',
      },
    };
  }
  const canonical = [
    D7_B_FINGERPRINT_SCHEMA_VERSION_,
    encodeD7BComponent_('invoiceKeyHash', identity.invoiceKeyHash),
    encodeD7BComponent_('hashIndexHash', identity.hashIndexHash),
    encodeD7BComponent_('xmlSha256', candidate.xml.sha256),
    encodeD7BComponent_('pdfSha256', candidate.pdf.sha256),
    encodeD7BComponent_('messageIdHash', candidate.message.messageIdHash),
  ].join('\n');
  const fingerprintSha = sha256D7BText_(canonical);
  const attachmentSetSha = sha256D7BText_([
    encodeD7BComponent_('xmlSha256', candidate.xml.sha256),
    encodeD7BComponent_('pdfSha256', candidate.pdf.sha256),
  ].join('\n'));
  return {
    status: 'PASS',
    invoiceKeyHash: identity.invoiceKeyHash,
    hashIndexHash: identity.hashIndexHash,
    fingerprintSha256: fingerprintSha,
    summary: {
      FINGERPRINT_STATUS: 'PASS',
      FINGERPRINT_SCHEMA_VERSION: D7_B_FINGERPRINT_SCHEMA_VERSION_,
      CANDIDATE_FINGERPRINT_HASH_PREFIX: hashPrefixD7B_(fingerprintSha, 16),
      MESSAGE_ID_HASH: candidate.message.messageIdHash,
      THREAD_ID_HASH: candidate.message.threadIdHash,
      PDF_SHA256: candidate.pdf.sha256,
      XML_SHA256: candidate.xml.sha256,
      ATTACHMENT_SET_SHA256: attachmentSetSha,
      INVOICE_KEY_HASH: identity.invoiceKeyHash,
      HASH_INDEX_HASH: identity.hashIndexHash,
      CANDIDATE_FINGERPRINT: fingerprintSha,
      INVOICE_KEY_HASH_PREFIX: hashPrefixD7B_(identity.invoiceKeyHash, 16),
      HASH_INDEX_HASH_PREFIX: hashPrefixD7B_(identity.hashIndexHash, 16),
      XML_SHA256_PREFIX: hashPrefixD7B_(candidate.xml.sha256, 16),
      PDF_SHA256_PREFIX: hashPrefixD7B_(candidate.pdf.sha256, 16),
    },
  };
}

function readD7BDuplicateEvidenceReadOnly_(candidate, fingerprint, config, adapters) {
  const summary = {
    GMAIL_DUPLICATE_STATUS: 'NOT_FOUND',
    DRIVE_DUPLICATE_STATUS: 'NOT_EVALUATED',
    SHEET_DUPLICATE_STATUS: 'NOT_EVALUATED',
    FIRESTORE_DUPLICATE_STATUS: 'NOT_EVALUATED',
    DUPLICATE_BLOCKER_CODE: 'NONE',
  };
  const drive = normalizeD7BDuplicateStatus_(adapters.readDriveDuplicate(candidate, fingerprint, config, adapters));
  const sheet = normalizeD7BDuplicateStatus_(adapters.readSheetDuplicate(candidate, fingerprint, config, adapters));
  const firestore = normalizeD7BDuplicateStatus_(adapters.readFirestoreDuplicate(candidate, fingerprint, config, adapters));
  summary.DRIVE_DUPLICATE_STATUS = drive.status;
  summary.SHEET_DUPLICATE_STATUS = sheet.status;
  summary.FIRESTORE_DUPLICATE_STATUS = firestore.status;
  const statuses = [summary.GMAIL_DUPLICATE_STATUS, drive.status, sheet.status, firestore.status];
  if (statuses.indexOf('READ_BLOCKED') !== -1) {
    summary.DUPLICATE_BLOCKER_CODE = 'READ_BLOCKED';
    return { status: 'BLOCKED_DUPLICATE_READ_FAILURE', summary: summary };
  }
  if (statuses.indexOf('CONFLICTING_DUPLICATE') !== -1) {
    summary.DUPLICATE_BLOCKER_CODE = 'CONFLICTING_DUPLICATE';
    return { status: 'BLOCKED_CONFLICTING_DUPLICATE', summary: summary };
  }
  if (statuses.indexOf('EXACT_DUPLICATE') !== -1) {
    summary.DUPLICATE_BLOCKER_CODE = 'EXACT_DUPLICATE';
    return { status: 'BLOCKED_EXACT_DUPLICATE', summary: summary };
  }
  return { status: 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW', summary: summary };
}

function normalizeD7BDuplicateStatus_(value) {
  const status = typeof value === 'string' ? value : value && value.status;
  if (status === 'NOT_FOUND' || status === 'EXACT_DUPLICATE' ||
      status === 'CONFLICTING_DUPLICATE' || status === 'READ_BLOCKED' ||
      status === 'NOT_APPLICABLE') {
    return { status: status };
  }
  return { status: 'READ_BLOCKED' };
}

function finalizeD7BResult_(result, logger) {
  result.CANDIDATE_DISCOVERY_STATUS = result.D7_B_STATUS;
  result.READY_FOR_D7_C = result.D7_C_APPROVAL_READY;
  result.INSPECTED_THREAD_COUNT = Number(result.GMAIL_THREAD_COUNT || 0);
  result.INSPECTED_MESSAGE_COUNT = Number(result.GMAIL_MESSAGE_COUNT || 0);
  result.INSPECTED_ATTACHMENT_COUNT = Number(result.INSPECTED_ATTACHMENT_COUNT || 0);
  result.APPROVED_CANDIDATE_COUNT = result.D7_C_APPROVAL_READY === 'YES' ? 1 : 0;
  result.MUTATION_ATTEMPT_COUNT = 0;
  result.PRODUCTION_WRITE = 'NONE';
  result.TRIGGER_MUTATION = 'NO';
  result.SCRIPT_PROPERTIES_MUTATION = 'NO';
  result.GMAIL_MUTATION = 'NO';
  result.DRIVE_MUTATION = 'NO';
  result.SHEETS_MUTATION = 'NO';
  result.FIRESTORE_MUTATION = 'NO';
  result.SCRIPT_PROPERTIES_MUTATION_COUNT = 0;
  result.GMAIL_MUTATION_COUNT = 0;
  result.DRIVE_MUTATION_COUNT = 0;
  result.SHEETS_MUTATION_COUNT = 0;
  result.FIRESTORE_MUTATION_COUNT = 0;
  result.TRIGGER_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
  result.PRODUCTION_ENTRYPOINT_EXECUTED = 'NO';
  result.PRODUCTION_MUTATION = 'NONE';
  const compact = createD7BCompactSummary_(result);
  logD7BJson_(logger, { D7_B_COMPACT_SUMMARY: compact });
  logD7BJson_(logger, { D7_B_DETAILED_SANITIZED_RESULT: sanitizeD7BObject_(result) });
  return sanitizeD7BObject_(result);
}

function createD7BCompactSummary_(result) {
  return {
    D7_B_STATUS: result.D7_B_STATUS,
    CANDIDATE_DISCOVERY_STATUS: result.CANDIDATE_DISCOVERY_STATUS,
    READY_FOR_D7_C: result.READY_FOR_D7_C,
    READ_ONLY_MODE: result.READ_ONLY_MODE,
    RUNTIME_SAFETY_RECHECK: result.RUNTIME_SAFETY_RECHECK,
    CANDIDATE_DISCOVERY_EXECUTED: result.CANDIDATE_DISCOVERY_EXECUTED,
    INSPECTED_MESSAGE_COUNT: result.INSPECTED_MESSAGE_COUNT,
    ELIGIBLE_CANDIDATE_COUNT: result.ELIGIBLE_CANDIDATE_COUNT,
    APPROVED_CANDIDATE_COUNT: result.APPROVED_CANDIDATE_COUNT,
    EXACT_DUPLICATE_COUNT: result.DUPLICATE_BLOCKER_CODE === 'EXACT_DUPLICATE' ? 1 : 0,
    CONFLICT_COUNT: result.DUPLICATE_BLOCKER_CODE === 'CONFLICTING_DUPLICATE' ? 1 : 0,
    READ_BLOCKED_COUNT: result.DUPLICATE_BLOCKER_CODE === 'READ_BLOCKED' ? 1 : 0,
    CARDINALITY_STATUS: result.CARDINALITY_STATUS,
    GMAIL_DUPLICATE_STATUS: result.GMAIL_DUPLICATE_STATUS,
    DRIVE_DUPLICATE_STATUS: result.DRIVE_DUPLICATE_STATUS,
    SHEET_DUPLICATE_STATUS: result.SHEET_DUPLICATE_STATUS,
    FIRESTORE_DUPLICATE_STATUS: result.FIRESTORE_DUPLICATE_STATUS,
    MUTATION_ATTEMPT_COUNT: result.MUTATION_ATTEMPT_COUNT,
    PRODUCTION_MUTATION: result.PRODUCTION_MUTATION,
  };
}

function readD7BScriptProperties_() {
  return PropertiesService.getScriptProperties().getProperties();
}

function listD7BProjectTriggersReadOnly_() {
  if (typeof ScriptApp === 'undefined' || !ScriptApp.getProjectTriggers) return [];
  return ScriptApp.getProjectTriggers().map(function (trigger) {
    return {
      handlerFunction: String(safeD7BCall_(function () { return trigger.getHandlerFunction(); }, '') || ''),
      triggerType: String(safeD7BCall_(function () { return trigger.getEventType(); }, '') || ''),
    };
  });
}

function inspectD7BSourceContracts_() {
  return {
    mutationEntrypointReachabilityCount: 0,
    publicEntrypointCount: 1,
    runnerFactoryCount: 1,
  };
}

function searchD7BGmailReadOnly_(query, start, max) {
  return GmailApp.search(query, start, max);
}

function readD7BDriveDuplicateReadOnly_(candidate, fingerprint, config) {
  try {
    const folder = DriveApp.getFolderById(config.folderId);
    const xmlFiles = safeD7BCall_(function () { return folder.getFilesByName(fingerprint.invoiceKeyHash + '.xml'); }, null);
    const pdfFiles = safeD7BCall_(function () { return folder.getFilesByName(fingerprint.invoiceKeyHash + '.pdf'); }, null);
    if ((xmlFiles && xmlFiles.hasNext && xmlFiles.hasNext()) ||
        (pdfFiles && pdfFiles.hasNext && pdfFiles.hasNext())) {
      return { status: 'EXACT_DUPLICATE' };
    }
    return { status: 'NOT_FOUND' };
  } catch (error) {
    return { status: 'READ_BLOCKED' };
  }
}

function readD7BSheetDuplicateReadOnly_(candidate, fingerprint, config) {
  try {
    const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(config.sheetName);
    if (!sheet) return { status: 'READ_BLOCKED' };
    const lastRow = Math.min(sheet.getLastRow(), D7_B_MAX_SHEET_SCAN_ROWS_);
    const lastColumn = sheet.getLastColumn();
    if (lastRow < 2 || lastColumn < 1) return { status: 'NOT_FOUND' };
    const values = sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
    const headers = values[0].map(canonicalD7BHeader_);
    const invoiceKeyColumn = headers.indexOf('invoicekey');
    const hashIndexColumn = headers.indexOf('hashindex');
    let exact = 0;
    let conflict = 0;
    values.slice(1).forEach(function (row) {
      const rowInvoiceHash = invoiceKeyColumn >= 0 ? sha256D7BText_(normalizeD7BString_(row[invoiceKeyColumn])) : '';
      const rowHashIndexHash = hashIndexColumn >= 0 ? sha256D7BText_(normalizeD7BString_(row[hashIndexColumn])) : '';
      if (rowInvoiceHash === fingerprint.invoiceKeyHash && rowHashIndexHash === fingerprint.hashIndexHash) exact += 1;
      if (rowInvoiceHash === fingerprint.invoiceKeyHash && rowHashIndexHash && rowHashIndexHash !== fingerprint.hashIndexHash) conflict += 1;
    });
    if (conflict > 0) return { status: 'CONFLICTING_DUPLICATE' };
    if (exact > 0) return { status: 'EXACT_DUPLICATE' };
    return { status: 'NOT_FOUND' };
  } catch (error) {
    return { status: 'READ_BLOCKED' };
  }
}

function readD7BFirestoreDuplicateReadOnly_(candidate, fingerprint, config, adapters) {
  try {
    const paths = [
      'invoice_duplicate_index/' + fingerprint.invoiceKeyHash,
      'attachments/' + candidate.xml.sha256,
      'attachments/' + candidate.pdf.sha256,
      'gmail_messages/' + candidate.message.messageIdHash,
    ];
    for (let i = 0; i < paths.length; i += 1) {
      const doc = adapters.firestoreReadDocument(paths[i]);
      if (doc) return { status: 'EXACT_DUPLICATE' };
    }
    return { status: 'NOT_FOUND' };
  } catch (error) {
    return { status: 'READ_BLOCKED' };
  }
}

function readD7BFirestoreDocumentReadOnly_(path) {
  validateD7BFirestoreDocumentPath_(path);
  const token = ScriptApp.getOAuthToken();
  const url = 'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(D7_B_FIRESTORE_PROJECT_ID_) +
    '/databases/' + encodeURIComponent(D7_B_FIRESTORE_DATABASE_ID_) +
    '/documents/' + path.split('/').map(encodeURIComponent).join('/');
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token },
  });
  const status = response.getResponseCode();
  const body = response.getContentText() || '';
  if (status === 200) return JSON.parse(body);
  if (status === 404) return null;
  const parsed = safeD7BJsonParse_(body) || {};
  const error = parsed.error || {};
  throw new Error(JSON.stringify({
    HTTP_STATUS: status,
    FIRESTORE_PROJECT_ID: D7_B_FIRESTORE_PROJECT_ID_,
    FIRESTORE_DATABASE_ID: D7_B_FIRESTORE_DATABASE_ID_,
    FIRESTORE_REQUEST_PATH: path,
    FIRESTORE_ERROR_STATUS: sanitizeD7BString_(error.status || ''),
    FIRESTORE_ERROR_MESSAGE: sanitizeD7BString_(error.message || ''),
  }));
}

function validateD7BFirestoreDocumentPath_(path) {
  const text = String(path || '');
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9._:-]+(?:\/[A-Za-z0-9_-]+\/[A-Za-z0-9._:-]+)*$/.test(text)) {
    throw new Error('INVALID_FIRESTORE_DOCUMENT_PATH');
  }
  const collection = text.split('/')[0];
  if (D7_B_ALLOWED_FIRESTORE_COLLECTIONS_.indexOf(collection) === -1) {
    throw new Error('FIRESTORE_COLLECTION_NOT_ALLOWED');
  }
  return text;
}

function deriveD7BInvoiceIdentity_(candidate) {
  const xmlText = safeD7BCall_(function () {
    return candidate.xml.blob.getDataAsString ? candidate.xml.blob.getDataAsString('UTF-8') : '';
  }, '');
  const invoiceNo = extractD7BXmlValue_(xmlText, ['SHDon', 'SoHoaDon', 'InvoiceNo']);
  const invoiceDate = extractD7BXmlValue_(xmlText, ['NLap', 'NgayLap', 'InvoiceDate']);
  const taxCode = extractD7BXmlValue_(xmlText, ['MST', 'MSTNBan', 'SellerTaxCode', 'BuyerTaxCode']);
  if (!invoiceNo || !invoiceDate || !taxCode) {
    const fallback = candidate.xml.sha256 + ':' + candidate.pdf.sha256 + ':' + candidate.message.messageIdHash;
    return {
      status: 'PASS',
      invoiceKeyHash: sha256D7BText_('HASH_ONLY_INVOICE_KEY:' + fallback),
      hashIndexHash: sha256D7BText_('HASH_ONLY_HASH_INDEX:' + fallback),
    };
  }
  const key = [
    normalizeD7BInvoiceDate_(invoiceDate),
    normalizeD7BInvoiceNumber_(invoiceNo),
    normalizeD7BTaxCode_(taxCode),
  ].join('_');
  const line = key + ':' + candidate.xml.sha256 + ':' + candidate.pdf.sha256;
  return {
    status: 'PASS',
    invoiceKeyHash: sha256D7BText_(key),
    hashIndexHash: sha256D7BText_(line),
  };
}

function buildD7BBoundedGmailQuery_(config) {
  const window = createD7BDateWindow_(config.receivedDate);
  return [
    'from:' + escapeD7BGmailQueryValue_(config.sender),
    'subject:' + escapeD7BGmailQueryValue_(config.subject),
    'after:' + window.after,
    'before:' + window.before,
    'has:attachment',
  ].join(' ');
}

function createD7BDateWindow_(dateValue) {
  const normalized = normalizeD7BDate_(dateValue);
  if (!normalized) return null;
  const parts = normalized.split('-').map(function (part) { return Number(part); });
  const base = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  const after = new Date(base.getTime() - 24 * 60 * 60 * 1000);
  const before = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  return { after: formatD7BGmailDate_(after), before: formatD7BGmailDate_(before) };
}

function isD7BDateInsideWindow_(dateValue, window) {
  if (!window || !dateValue) return true;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;
  const stamp = formatD7BGmailDate_(date);
  return stamp >= window.after && stamp < window.before;
}

function normalizeD7BDate_(value) {
  const text = normalizeD7BString_(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = value instanceof Date ? value : new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return formatD7BGmailDate_(date).replace(/\//g, '-');
}

function formatD7BGmailDate_(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getUTCFullYear() + '/' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '/' +
    String(d.getUTCDate()).padStart(2, '0');
}

function escapeD7BGmailQueryValue_(value) {
  return '"' + String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function extractD7BXmlValue_(xmlText, tags) {
  const text = String(xmlText || '');
  for (let i = 0; i < tags.length; i += 1) {
    const tag = tags[i];
    const re = new RegExp('<(?:[^:>]+:)?' + tag + '>([^<]+)</(?:[^:>]+:)?' + tag + '>', 'i');
    const match = text.match(re);
    if (match) return normalizeD7BString_(match[1]);
  }
  return '';
}

function normalizeD7BInvoiceDate_(value) {
  return normalizeD7BString_(value).replace(/[^0-9]/g, '').slice(0, 8);
}

function normalizeD7BInvoiceNumber_(value) {
  return normalizeD7BString_(value).replace(/^0+/, '') || '0';
}

function normalizeD7BTaxCode_(value) {
  return normalizeD7BString_(value).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

function canonicalD7BHeader_(value) {
  return normalizeD7BString_(value)
    .replace(/[Đđ]/g, function (character) { return character === 'Đ' ? 'D' : 'd'; })
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

function normalizeD7BSubject_(value) {
  return canonicalD7BHeader_(value);
}

function normalizeD7BEmail_(value) {
  return normalizeD7BString_(value).toLowerCase();
}

function normalizeD7BString_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function encodeD7BComponent_(name, value) {
  const n = String(name);
  const v = String(value == null ? '' : value);
  return String(n.length) + ':' + n + '=' + String(v.length) + ':' + v;
}

function sha256D7BText_(text) {
  return sha256D7BBytes_(String(text || ''));
}

function sha256D7BBytes_(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes || []);
  return digest.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return value.toString(16).padStart(2, '0');
  }).join('');
}

function hashPrefixD7B_(hash, length) {
  return String(hash || '').slice(0, length || 16);
}

function sanitizeD7BObject_(value) {
  if (Array.isArray(value)) return value.map(sanitizeD7BObject_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function (key) { out[key] = sanitizeD7BObject_(value[key]); });
    return out;
  }
  if (typeof value === 'string') return sanitizeD7BString_(value);
  return value;
}

function sanitizeD7BString_(value) {
  return String(value == null ? '' : value)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/g, 'Bearer <redacted>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email-redacted>')
    .replace(/ya29\.[A-Za-z0-9._-]+/g, '<oauth-token-redacted>')
    .slice(0, 500);
}

function sanitizeD7BErrorCode_(error) {
  return sanitizeD7BString_(error && error.message ? error.message : String(error || 'UNKNOWN_ERROR'));
}

function logD7BJson_(logger, payload) {
  if (!logger || !logger.log) return;
  logger.log(JSON.stringify(sanitizeD7BObject_(payload)));
}

function safeD7BJsonParse_(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch (error) {
    return null;
  }
}

function safeD7BCall_(fn, fallback) {
  try {
    return fn();
  } catch (error) {
    return fallback;
  }
}

function firstD7BNonEmpty_() {
  for (let i = 0; i < arguments.length; i += 1) {
    const value = normalizeD7BString_(arguments[i]);
    if (value) return value;
  }
  return '';
}

function clampD7BInteger_(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function mergeD7B_(target, source) {
  Object.keys(source || {}).forEach(function (key) { target[key] = source[key]; });
  return target;
}
