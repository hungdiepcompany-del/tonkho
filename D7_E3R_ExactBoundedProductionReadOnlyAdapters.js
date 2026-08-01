const D7_E3R_READER_IMPLEMENTATION_ = 'REAL_BOUNDED_READ_ONLY';
const D7_E3R_FIRESTORE_PROJECT_ID_ = 'tonkhohd';
const D7_E3R_FIRESTORE_DATABASE_ID_ = '(default)';
const D7_E3R_FIRESTORE_MAX_READ_CALLS_ = 5;
const D7_E3R_DRIVE_MAX_FILES_PER_ARTIFACT_ = 2;

function createD7E3RExactBoundedProductionReadOnlyAdapters_(dependencies) {
  const d = dependencies || {};
  const services = {
    readProperties: d.readProperties || readD7E3RScriptPropertiesReadOnly_,
    gmailSearch: d.gmailSearch || function d7e3rGmailSearch(query, start, max) { return GmailApp.search(query, start, max); },
    driveGetFolderById: d.driveGetFolderById || function d7e3rDriveFolder(id) { return DriveApp.getFolderById(id); },
    openSpreadsheetById: d.openSpreadsheetById || function d7e3rSpreadsheet(id) { return SpreadsheetApp.openById(id); },
    fetch: d.fetch || function d7e3rFetch(url, params) { return UrlFetchApp.fetch(url, params); },
    getOAuthToken: d.getOAuthToken || function d7e3rOAuthToken() { return ScriptApp.getOAuthToken(); },
    getIdentity: d.getIdentity || readD7E3RExecutionIdentityReadOnly_,
    buildContext: d.buildContext || null,
    now: d.now || function d7e3rNow() { return new Date().toISOString(); }
  };
  const cache = { context: null };

  function context(args) {
    if (!cache.context) cache.context = buildD7E3RContext_(services, args || {});
    return cache.context;
  }

  return Object.freeze({
    readSnapshot: function readSnapshot(args) { return readD7E3RSnapshot_(context(args), args || {}); },
    readGmailEvidence: function readGmailEvidence(args) { return readD7E3RGmailEvidence_(context(args)); },
    readDriveEvidence: function readDriveEvidence(args) { return readD7E3RDriveEvidence_(context(args), args && args.artifactType, services); },
    readSheetsEvidence: function readSheetsEvidence(args) { return readD7E3RSheetsEvidence_(context(args), services); },
    readFirestoreEvidence: function readFirestoreEvidence(args) { return readD7E3RFirestoreEvidence_(context(args), services); }
  });
}

function readD7E3RScriptPropertiesReadOnly_() {
  const props = PropertiesService.getScriptProperties();
  return props && props.getProperties ? props.getProperties() : {};
}

function buildD7E3RContext_(services, args) {
  if (services.buildContext) return normalizeD7E3RContext_(services.buildContext(args || {}), services);
  const configuration = args && args.configuration || {};
  const properties = mergeD7E3RObjects_(services.readProperties() || {}, configuration.rawConfiguration || {});
  const config = resolveD7E3REffectiveConfig_(properties);
  if (!config.valid) return normalizeD7E3RContext_({ status: 'READ_CONFIGURATION_INVALID', properties, config, reasonCode: 'D7_E3R_EFFECTIVE_CONFIG_INVALID' }, services);
  const gmail = discoverD7E3RExactCandidateReadOnly_(services, config, configuration);
  if (gmail.status !== 'READ_OK') return normalizeD7E3RContext_({ status: gmail.status, reasonCode: gmail.reasonCode, properties, config, gmail }, services);
  const fingerprint = fingerprintD7E3RCandidate_(gmail.candidate, config);
  const fingerprintStatus = validateD7E3RFingerprint_(fingerprint, gmail.candidate, configuration);
  if (fingerprintStatus.status !== 'READ_OK') return normalizeD7E3RContext_({ status: fingerprintStatus.status, reasonCode: fingerprintStatus.reasonCode, properties, config, gmail, fingerprint }, services);
  const planContext = reconstructD7E3RPlan_(properties, config, gmail.candidate, fingerprint, services);
  if (planContext.status !== 'READ_OK') return normalizeD7E3RContext_({ status: planContext.status, reasonCode: planContext.reasonCode, properties, config, gmail, fingerprint, planContext }, services);
  return normalizeD7E3RContext_({
    status: 'READ_OK',
    reasonCode: 'D7_E3R_CONTEXT_READY',
    properties,
    config,
    gmail,
    candidate: gmail.candidate,
    fingerprint,
    plan: planContext.plan,
    ledgerRows: planContext.ledgerRows,
    identity: services.getIdentity()
  }, services);
}

function normalizeD7E3RContext_(context, services) {
  const source = context || {};
  return {
    status: source.status || 'READ_CONFIGURATION_INVALID',
    reasonCode: source.reasonCode || source.status || 'D7_E3R_CONTEXT_UNAVAILABLE',
    properties: source.properties || {},
    config: source.config || {},
    gmail: source.gmail || {},
    candidate: source.candidate || (source.gmail && source.gmail.candidate) || null,
    fingerprint: source.fingerprint || {},
    plan: source.plan || (source.planContext && source.planContext.plan) || null,
    ledgerRows: source.ledgerRows || (source.planContext && source.planContext.ledgerRows) || [],
    identity: source.identity || (services && services.getIdentity ? services.getIdentity() : { executionIdentityStatus: 'IDENTITY_UNAVAILABLE' }),
    now: services && services.now ? services.now() : ''
  };
}

function resolveD7E3REffectiveConfig_(properties) {
  if (typeof resolveD7BEffectiveConfig_ === 'function') return resolveD7BEffectiveConfig_(properties || {});
  const p = properties || {};
  const sender = stringD7E3R_(p.D7_B_GMAIL_SENDER || p.D7_GMAIL_SENDER || p.D6J_PILOT_SENDER);
  const subject = stringD7E3R_(p.D7_B_GMAIL_SUBJECT || p.D7_GMAIL_SUBJECT || p.D6J_PILOT_SUBJECT);
  const receivedDate = stringD7E3R_(p.D7_B_RECEIVED_DATE || p.D7_GMAIL_RECEIVED_DATE || p.D6J_PILOT_RECEIVED_DATE);
  const folderId = stringD7E3R_(p.D7_B_DRIVE_ROOT_FOLDER_ID || p.D7_DRIVE_ROOT_FOLDER_ID || p.D6J_DRIVE_ROOT_FOLDER_ID);
  const spreadsheetId = stringD7E3R_(p.D7_B_SPREADSHEET_ID || p.D7_SPREADSHEET_ID || p.D6J_SPREADSHEET_ID);
  const sheetName = stringD7E3R_(p.D7_B_TARGET_SHEET_NAME || p.D7_TARGET_SHEET_NAME || p.D6J_TARGET_SHEET_NAME || p.D6J_SHEET_NAME || 'Nhap-Xuat');
  const dateWindow = createD7E3RDateWindow_(receivedDate);
  const valid = Boolean(sender && subject && receivedDate && folderId && spreadsheetId && dateWindow);
  return {
    valid,
    sender,
    subject,
    receivedDate,
    folderId,
    spreadsheetId,
    sheetName,
    maxResults: 1,
    dateWindow,
    boundedQuery: valid ? buildD7E3RBoundedGmailQuery_(sender, subject, dateWindow) : ''
  };
}

function discoverD7E3RExactCandidateReadOnly_(services, config) {
  try {
    const threads = services.gmailSearch(config.boundedQuery, 0, Math.min(2, Number(config.maxResults || 1))) || [];
    if (threads.length === 0) return { status: 'READ_NOT_FOUND', reasonCode: 'RESOURCE_NOT_FOUND', candidateCount: 0, messageCount: 0 };
    if (threads.length > 1) return { status: 'READ_CONFIGURATION_INVALID', reasonCode: 'D7_E3R_GMAIL_MULTIPLE_THREADS', candidateCount: threads.length, messageCount: 0 };
    const thread = threads[0];
    const messages = thread.getMessages ? thread.getMessages() : [];
    if (messages.length !== 1) return { status: 'READ_CONFIGURATION_INVALID', reasonCode: 'D7_E3R_GMAIL_MESSAGE_COUNT_NOT_ONE', candidateCount: 1, messageCount: messages.length };
    const message = messages[0];
    const candidate = normalizeD7E3RGmailMessage_(thread, message, config);
    if (!candidate.subjectMatches || !candidate.senderMatches || !candidate.dateMatches) {
      return { status: 'READ_CONFIGURATION_INVALID', reasonCode: 'D7_E3R_GMAIL_EXACT_CONSTRAINT_MISMATCH', candidateCount: 1, messageCount: 1, candidate };
    }
    if (candidate.xmlAttachments.length !== 1 || candidate.pdfAttachments.length !== 1) {
      return { status: 'READ_CONFIGURATION_INVALID', reasonCode: 'D7_E3R_GMAIL_ATTACHMENT_CARDINALITY', candidateCount: 1, messageCount: 1, candidate };
    }
    candidate.xml = candidate.xmlAttachments[0];
    candidate.pdf = candidate.pdfAttachments[0];
    return { status: 'READ_OK', reasonCode: 'READ_OK', candidateCount: 1, messageCount: 1, candidate };
  } catch (error) {
    return { status: 'READ_BLOCKED', reasonCode: classifyD7E3RError_(error, 'GMAIL'), safeErrorClass: safeErrorClassD7E3R_(error) };
  }
}

function normalizeD7E3RGmailMessage_(thread, message, config) {
  const attachments = message.getAttachments ? message.getAttachments({ includeInlineImages: false }) : [];
  const subject = stringD7E3R_(callD7E3R_(function () { return message.getSubject(); }, ''));
  const sender = stringD7E3R_(callD7E3R_(function () { return message.getFrom(); }, ''));
  const date = callD7E3R_(function () { return message.getDate(); }, null);
  const messageId = stringD7E3R_(callD7E3R_(function () { return message.getId(); }, ''));
  const threadId = stringD7E3R_(callD7E3R_(function () { return thread.getId(); }, ''));
  const xmlAttachments = [];
  const pdfAttachments = [];
  attachments.slice(0, 10).forEach(function eachAttachment(attachment) {
    const name = stringD7E3R_(callD7E3R_(function () { return attachment.getName(); }, ''));
    const mime = stringD7E3R_(callD7E3R_(function () { return attachment.getContentType(); }, '')).toLowerCase();
    const bytes = callD7E3R_(function () { return attachment.getBytes(); }, []);
    const record = {
      fileName: name,
      nameHash: hashPrefixD7E3R_(sha256D7E3RText_(name), 16),
      mimeType: mime,
      byteSize: bytesD7E3R_(bytes).length,
      sha256: sha256D7E3RBytes_(bytes),
      bytes,
      blob: attachment
    };
    if (/\.xml$/i.test(name) && (mime === 'application/xml' || mime === 'text/xml')) xmlAttachments.push(record);
    if (/\.pdf$/i.test(name) && mime === 'application/pdf') pdfAttachments.push(record);
  });
  return {
    threadRef: thread,
    messageRef: message,
    message: {
      messageIdHash: hashPrefixD7E3R_(sha256D7E3RText_(messageId), 16),
      threadIdHash: hashPrefixD7E3R_(sha256D7E3RText_(threadId || messageId), 16)
    },
    subjectMatches: canonicalD7E3R_(subject) === canonicalD7E3R_(config.subject),
    senderMatches: stringD7E3R_(sender).toLowerCase().indexOf(stringD7E3R_(config.sender).toLowerCase()) !== -1,
    dateMatches: isD7E3RDateInsideWindow_(date, config.dateWindow),
    attachmentCount: attachments.length,
    xmlAttachments,
    pdfAttachments
  };
}

function fingerprintD7E3RCandidate_(candidate, config) {
  if (typeof createD7BCandidateFingerprint_ === 'function' && typeof deriveD7BInvoiceIdentity_ === 'function') {
    return createD7BCandidateFingerprint_(candidate, config, { deriveInvoiceIdentity: deriveD7BInvoiceIdentity_ });
  }
  const attachmentSet = sha256D7E3RText_(['xmlSha256=' + (candidate.xml && candidate.xml.sha256 || ''), 'pdfSha256=' + (candidate.pdf && candidate.pdf.sha256 || '')].join('\n'));
  const fingerprint = sha256D7E3RText_(['D7_B_CANDIDATE_FINGERPRINT_V1', candidate.message && candidate.message.messageIdHash, candidate.xml && candidate.xml.sha256, candidate.pdf && candidate.pdf.sha256].join('\n'));
  return {
    status: 'PASS',
    fingerprintSha256: fingerprint,
    invoiceKeyHash: '',
    hashIndexHash: '',
    summary: {
      CANDIDATE_FINGERPRINT: fingerprint,
      ATTACHMENT_SET_SHA256: attachmentSet,
      XML_SHA256: candidate.xml && candidate.xml.sha256 || '',
      PDF_SHA256: candidate.pdf && candidate.pdf.sha256 || ''
    }
  };
}

function validateD7E3RFingerprint_(fingerprint, candidate, configuration) {
  const summary = fingerprint && fingerprint.summary || {};
  const expectedCandidate = stringD7E3R_(configuration.expectedCandidateFingerprint || (typeof D7_E3G_EXPECTED_CANDIDATE_FINGERPRINT_ !== 'undefined' ? D7_E3G_EXPECTED_CANDIDATE_FINGERPRINT_ : ''));
  const expectedAttachmentSet = stringD7E3R_(configuration.expectedAttachmentSetHash || (typeof D7_E3G_EXPECTED_ATTACHMENT_SET_SHA256_ !== 'undefined' ? D7_E3G_EXPECTED_ATTACHMENT_SET_SHA256_ : ''));
  const expectedXml = stringD7E3R_(configuration.expectedXmlSha256 || (typeof D7_E3G_EXPECTED_XML_SHA256_ !== 'undefined' ? D7_E3G_EXPECTED_XML_SHA256_ : ''));
  const expectedPdf = stringD7E3R_(configuration.expectedPdfSha256 || (typeof D7_E3G_EXPECTED_PDF_SHA256_ !== 'undefined' ? D7_E3G_EXPECTED_PDF_SHA256_ : ''));
  if (expectedCandidate && stringD7E3R_(summary.CANDIDATE_FINGERPRINT) !== expectedCandidate) return { status: 'READ_IDENTITY_MISMATCH', reasonCode: 'MESSAGE_IDENTITY_MISMATCH' };
  if (expectedAttachmentSet && stringD7E3R_(summary.ATTACHMENT_SET_SHA256) !== expectedAttachmentSet) return { status: 'READ_IDENTITY_MISMATCH', reasonCode: 'DOCUMENT_IDENTITY_MISMATCH' };
  if (expectedXml && candidate.xml && candidate.xml.sha256 !== expectedXml) return { status: 'READ_IDENTITY_MISMATCH', reasonCode: 'DOCUMENT_IDENTITY_MISMATCH' };
  if (expectedPdf && candidate.pdf && candidate.pdf.sha256 !== expectedPdf) return { status: 'READ_IDENTITY_MISMATCH', reasonCode: 'DOCUMENT_IDENTITY_MISMATCH' };
  return { status: 'READ_OK', reasonCode: 'READ_OK' };
}

function reconstructD7E3RPlan_(properties, config, candidate, fingerprint, services) {
  try {
    if (typeof buildD7ELedgerRowsFromCandidate_ !== 'function' || typeof buildD7EMutationPlan_ !== 'function') {
      return { status: 'READ_CONFIGURATION_INVALID', reasonCode: 'D7_E3R_D7_E_PLAN_HELPERS_UNAVAILABLE' };
    }
    const precheck = {
      config,
      candidate,
      fingerprint,
      summary: mergeD7E3RObjects_(fingerprint.summary || {}, {
        CANDIDATE_FINGERPRINT: fingerprint.summary && fingerprint.summary.CANDIDATE_FINGERPRINT || fingerprint.fingerprintSha256 || '',
        MESSAGE_ID_HASH: candidate.message && candidate.message.messageIdHash || '',
        THREAD_ID_HASH: candidate.message && candidate.message.threadIdHash || ''
      })
    };
    const ledgerRows = buildD7ELedgerRowsFromCandidate_({ properties, candidate, fingerprint, config });
    const plan = buildD7EMutationPlan_({ properties, precheck, ledgerRows, now: services.now() });
    return { status: 'READ_OK', plan, ledgerRows };
  } catch (error) {
    return { status: 'READ_CONFIGURATION_INVALID', reasonCode: classifyD7E3RError_(error, 'PLAN') };
  }
}

function readD7E3RSnapshot_(context, args) {
  const stage = stringD7E3R_(args && args.stage || 'UNKNOWN');
  return {
    status: context.status === 'READ_OK' ? 'SNAPSHOT_CAPTURED' : 'SNAPSHOT_UNAVAILABLE',
    evidenceSource: 'D7_E3R_REAL_BOUNDED_READ_ONLY_ADAPTERS',
    reasonCode: context.reasonCode,
    stage,
    fingerprints: {
      contextStatus: context.status,
      candidateFingerprintHashPrefix: hashPrefixD7E3R_(context.fingerprint && context.fingerprint.summary && context.fingerprint.summary.CANDIDATE_FINGERPRINT, 16),
      jobIdHashPrefix: hashPrefixD7E3R_(context.plan && context.plan.jobId, 16),
      sheetRowNumber: exactD7E3RSheetRowNumber_(context)
    }
  };
}

function readD7E3RGmailEvidence_(context) {
  if (context.status !== 'READ_OK') return blockedD7E3RResult_('GMAIL', context.status, context.reasonCode);
  const candidate = context.candidate || {};
  return {
    status: 'READ_OK',
    readerImplementation: D7_E3R_READER_IMPLEMENTATION_,
    readAttempted: true,
    readSucceeded: true,
    exactTargetMatched: true,
    evidenceSource: 'D7_E3R_GMAIL_EXACT_BOUNDED_READ_ONLY_ADAPTER',
    reasonCode: 'READ_OK',
    authorizationType: 'OAUTH_AND_MAILBOX_ACCESS',
    resourceAccessStatus: 'READ_CONFIRMED',
    executionIdentityStatus: context.identity.executionIdentityStatus,
    candidateCount: 1,
    messageCount: context.gmail.messageCount || 1,
    xmlAttachmentCount: candidate.xml ? 1 : 0,
    pdfAttachmentCount: candidate.pdf ? 1 : 0,
    xmlSha256: candidate.xml && candidate.xml.sha256 || '',
    pdfSha256: candidate.pdf && candidate.pdf.sha256 || '',
    xmlByteLength: candidate.xml && candidate.xml.byteSize || 0,
    pdfByteLength: candidate.pdf && candidate.pdf.byteSize || 0,
    xmlMimeType: candidate.xml && candidate.xml.mimeType || '',
    pdfMimeType: candidate.pdf && candidate.pdf.mimeType || '',
    xmlAttachmentNameMatch: candidate.xml ? 'YES' : 'NO',
    pdfAttachmentNameMatch: candidate.pdf ? 'YES' : 'NO',
    xmlBytes: candidate.xml && candidate.xml.bytes,
    pdfBytes: candidate.pdf && candidate.pdf.bytes,
    readCallCount: 1
  };
}

function readD7E3RDriveEvidence_(context, artifactType, services) {
  if (context.status !== 'READ_OK') return blockedD7E3RResult_('DRIVE_' + stringD7E3R_(artifactType || 'UNKNOWN'), context.status, context.reasonCode);
  const kind = stringD7E3R_(artifactType).toUpperCase() === 'PDF' ? 'pdf' : 'xml';
  const target = context.plan && context.plan.driveTargets && context.plan.driveTargets[kind];
  if (!target || !target.fileName || !target.contentHash) return blockedD7E3RResult_('DRIVE_' + kind.toUpperCase(), 'READ_CONFIGURATION_INVALID', 'INVALID_EXACT_RESOURCE_REFERENCE');
  try {
    const folder = services.driveGetFolderById(target.folderReference || context.config.folderId);
    const iterator = folder && folder.getFilesByName ? folder.getFilesByName(target.fileName) : null;
    const matches = [];
    let observed = 0;
    while (iterator && iterator.hasNext && iterator.hasNext()) {
      observed += 1;
      if (observed > D7_E3R_DRIVE_MAX_FILES_PER_ARTIFACT_) break;
      const file = iterator.next();
      const blob = file.getBlob();
      const bytes = blob.getBytes() || [];
      const hash = sha256D7E3RBytes_(bytes);
      const mime = stringD7E3R_(file.getMimeType ? file.getMimeType() : blob.getContentType && blob.getContentType()).toLowerCase();
      const size = Number(file.getSize ? file.getSize() : bytesD7E3R_(bytes).length);
      if (hash === target.contentHash && mime === stringD7E3R_(target.mimeType).toLowerCase()) {
        matches.push({ file, bytes, hash, mime, size });
      }
    }
    if (observed === 0) return driveD7E3RResult_(kind, { candidateCount: 0, metadataReadStatus: 'READ_NOT_FOUND', contentReadStatus: 'READ_NOT_FOUND', reasonCode: 'RESOURCE_NOT_FOUND' }, context);
    if (observed > 1 || matches.length > 1) return driveD7E3RResult_(kind, { candidateCount: observed, metadataReadStatus: 'READ_OK', contentReadStatus: 'READ_OK', reasonCode: 'D7_E3R_DRIVE_DUPLICATE_AMBIGUITY' }, context);
    if (matches.length !== 1) return driveD7E3RResult_(kind, { candidateCount: observed, metadataReadStatus: 'READ_OK', contentReadStatus: 'READ_OK', reasonCode: 'DOCUMENT_IDENTITY_MISMATCH' }, context);
    const match = matches[0];
    return driveD7E3RResult_(kind, {
      candidateCount: 1,
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_OK',
      metadataSize: match.size,
      bytes: match.bytes,
      mimeType: match.mime,
      providerChecksumStatus: 'HASH_VERIFIED_BY_CONTENT',
      contentBytesExplicitlyObserved: true,
      metadataSizeExplicitlyObserved: true,
      exactTargetMatched: true,
      reasonCode: 'READ_OK'
    }, context);
  } catch (error) {
    return driveD7E3RResult_(kind, { candidateCount: 0, metadataReadStatus: 'READ_BLOCKED', contentReadStatus: 'READ_BLOCKED', reasonCode: classifyD7E3RError_(error, 'DRIVE') }, context);
  }
}

function driveD7E3RResult_(kind, patch, context) {
  return mergeD7E3RObjects_({
    status: patch.reasonCode === 'RESOURCE_NOT_FOUND' ? 'READ_NOT_FOUND' : (patch.reasonCode === 'READ_OK' ? 'READ_OK' : 'READ_BLOCKED'),
    readerImplementation: D7_E3R_READER_IMPLEMENTATION_,
    evidenceSource: 'D7_E3R_DRIVE_EXACT_BOUNDED_READ_ONLY_ADAPTER',
    readAttempted: true,
    readSucceeded: patch.reasonCode === 'READ_OK',
    exactTargetMatched: patch.exactTargetMatched === true,
    authorizationType: 'OAUTH_AND_DRIVE_FILE_ACL',
    resourceAccessStatus: patch.reasonCode === 'READ_OK' ? 'READ_CONFIRMED' : 'NOT_PROVEN',
    executionIdentityStatus: context.identity.executionIdentityStatus,
    artifactType: kind.toUpperCase(),
    readCallCount: 2,
    discoveryStatus: 'EXACT_NAME_HASH_MIME_BOUNDED'
  }, patch);
}

function readD7E3RSheetsEvidence_(context, services) {
  if (context.status !== 'READ_OK') return blockedD7E3RResult_('SHEETS', context.status, context.reasonCode);
  const rowNumber = exactD7E3RSheetRowNumber_(context);
  if (!rowNumber) return blockedD7E3RResult_('SHEETS', 'READ_CONFIGURATION_INVALID', 'INVALID_EXACT_RESOURCE_REFERENCE');
  try {
    const spreadsheet = services.openSpreadsheetById(context.config.spreadsheetId);
    const sheet = spreadsheet.getSheetByName(context.config.sheetName || 'Nhap-Xuat');
    if (!sheet) return blockedD7E3RResult_('SHEETS', 'READ_NOT_FOUND', 'RESOURCE_NOT_FOUND');
    const width = 16;
    const values = sheet.getRange(rowNumber, 1, 1, width).getValues()[0];
    const displayValues = sheet.getRange(rowNumber, 1, 1, width).getDisplayValues()[0];
    const formulas = sheet.getRange(rowNumber, 1, 1, width).getFormulas()[0];
    const expected = context.ledgerRows && context.ledgerRows[0] || {};
    const hashMatch = stringD7E3R_(values[13]) === stringD7E3R_(expected.legacyHashIndex);
    const invoiceKeyMatch = stringD7E3R_(values[14]) === stringD7E3R_(expected.invoiceKeyV2 || expected.legacyInvoiceKey);
    const rowExact = hashMatch && invoiceKeyMatch;
    return {
      status: 'READ_OK',
      readerImplementation: D7_E3R_READER_IMPLEMENTATION_,
      evidenceSource: 'D7_E3R_SHEETS_EXACT_ROW_READ_ONLY_ADAPTER',
      reasonCode: 'READ_OK',
      readAttempted: true,
      readSucceeded: true,
      exactTargetMatched: rowExact,
      authorizationType: 'OAUTH_AND_SPREADSHEET_ACL',
      resourceAccessStatus: 'READ_CONFIRMED',
      executionIdentityStatus: context.identity.executionIdentityStatus,
      schemaValidationStatus: 'PASS_OR_NOT_REQUIRED_FOR_EXACT_ROW',
      canonicalRowCount: rowExact ? 1 : 0,
      exactIdentityMatchCount: rowExact ? 1 : 0,
      conflictingIdentityCount: rowExact ? 0 : 1,
      businessIdentityStatus: rowExact ? 'MATCH' : 'CONFLICT',
      invoiceKeyStatus: invoiceKeyMatch ? 'MATCH' : 'CONFLICT',
      hashIndexStatus: hashMatch ? 'MATCH' : 'CONFLICT',
      sourceHashLinkStatus: 'MATCH',
      contentStatus: rowExact ? 'MATCH' : 'CONFLICT',
      deterministicJobIdentityStatus: context.plan && context.plan.jobId ? 'MATCH' : 'UNAVAILABLE',
      commitPlanSheetIdentityStatus: context.plan && context.plan.commitPlan ? 'MATCH' : 'UNAVAILABLE',
      rowTransactionIdentityStatus: rowExact ? 'MATCH' : 'CONFLICT',
      auditRowIdentityLinkStatus: 'UNAVAILABLE',
      safeRowNumbers: [rowNumber],
      rawValueFingerprint: { rowNumber, values },
      displayValueFingerprint: { rowNumber, displayValues },
      formulaFingerprint: { rowNumber, formulas },
      readCallCount: 1
    };
  } catch (error) {
    return blockedD7E3RResult_('SHEETS', 'READ_BLOCKED', classifyD7E3RError_(error, 'SHEETS'));
  }
}

function readD7E3RFirestoreEvidence_(context, services) {
  if (context.status !== 'READ_OK') return blockedD7E3RResult_('FIRESTORE', context.status, context.reasonCode);
  const plan = context.plan || {};
  if (!plan.jobId) return blockedD7E3RResult_('FIRESTORE', 'READ_CONFIGURATION_INVALID', 'INVALID_EXACT_RESOURCE_REFERENCE');
  const reader = createD7E3RFirestoreReader_(services);
  try {
    let readCallCount = 0;
    const job = reader.getDocument('invoiceJobs/' + plan.jobId); readCallCount += 1;
    const lease = reader.getDocument('worker_leases/' + plan.jobId); readCallCount += 1;
    const attachmentRecords = plan.attachmentRecords || [];
    let attachmentRecordCount = 0;
    for (let i = 0; i < attachmentRecords.length && readCallCount < D7_E3R_FIRESTORE_MAX_READ_CALLS_; i += 1) {
      const record = reader.getDocument('attachments/' + attachmentRecords[i].attachmentId);
      readCallCount += 1;
      if (record) attachmentRecordCount += 1;
    }
    let report = null;
    if (job && job.latestReconciliationReportId && readCallCount < D7_E3R_FIRESTORE_MAX_READ_CALLS_) {
      report = reader.getDocument('invoiceJobs/' + plan.jobId + '/reconciliationReports/' + job.latestReconciliationReportId);
      readCallCount += 1;
    }
    const expectedIdentity = typeof durableIdentityHashPrefixD7E_ === 'function' ? durableIdentityHashPrefixD7E_(plan.invoiceIdentityHash) : hashPrefixD7E3R_(plan.invoiceIdentityHash, 8);
    const commitPlanStatus = job && job.commitPlan ? 'MATCH' : 'ABSENT';
    return {
      status: 'READ_OK',
      readerImplementation: D7_E3R_READER_IMPLEMENTATION_,
      evidenceSource: 'D7_E3R_FIRESTORE_EXACT_DOCUMENT_READ_ONLY_ADAPTER',
      reasonCode: 'READ_OK',
      readAttempted: true,
      readSucceeded: true,
      exactTargetMatched: true,
      authorizationType: 'OAUTH_DATASTORE_AND_IAM',
      resourceAccessStatus: 'READ_CONFIRMED',
      executionIdentityStatus: context.identity.executionIdentityStatus,
      jobExists: Boolean(job),
      jobIdentityStatus: !job ? 'ABSENT' : (stringD7E3R_(job.invoiceIdentityHash) === stringD7E3R_(expectedIdentity) ? 'MATCH' : 'CONFLICT'),
      jobState: job && job.status ? stringD7E3R_(job.status) : 'ABSENT',
      jobVersionStatus: job && Number(job.version || 0) > 0 ? 'PRESENT' : 'UNAVAILABLE',
      jobUpdateTimeStatus: job && job.updatedAt ? 'PRESENT' : 'UNAVAILABLE',
      commitPlanStatus,
      commitPlanIdentityStatus: commitPlanStatus === 'MATCH' && job.commitPlan && stringD7E3R_(job.commitPlan.jobId) === stringD7E3R_(plan.jobId) ? 'MATCH' : commitPlanStatus,
      expectedDriveIdentitiesStatus: commitPlanStatus === 'MATCH' ? 'MATCH' : 'UNAVAILABLE',
      expectedSheetTransactionIdentityStatus: commitPlanStatus === 'MATCH' ? 'MATCH' : 'UNAVAILABLE',
      attachmentRecordCount,
      auditEventCount: Number(job && job.auditEventCount || 0),
      leaseStatus: lease ? stringD7E3R_(lease.status || 'PRESENT') : 'NO_ACTIVE_LEASE_FOUND',
      reconciliationReportStatus: report ? stringD7E3R_(report.status || 'PRESENT') : (job && job.reconciliationStatus ? stringD7E3R_(job.reconciliationStatus) : 'ABSENT'),
      reconciliationFindingCodes: report && report.findings ? report.findings.map(function code(f) { return f && f.code || ''; }) : [],
      reconciliationRequiredState: job && job.reconciliationStatus ? stringD7E3R_(job.reconciliationStatus) : 'UNAVAILABLE',
      idempotencyEvidenceStatus: job && job.lastMutationIdempotencyKey ? 'PRESENT' : 'UNAVAILABLE',
      writeOutcomeEvidenceStatus: job && /RECONCILIATION|UNKNOWN/i.test(stringD7E3R_(job.reconciliationStatus || job.status)) ? 'UNKNOWN_WRITE_OUTCOME_PRESENT' : 'UNAVAILABLE',
      readCallCount
    };
  } catch (error) {
    return mergeD7E3RObjects_(blockedD7E3RResult_('FIRESTORE', 'READ_BLOCKED', classifyD7E3RError_(error, 'FIRESTORE')), {
      httpStatus: Number(error && error.httpStatus || 0),
      firestoreProjectId: D7_E3R_FIRESTORE_PROJECT_ID_,
      firestoreDatabaseId: D7_E3R_FIRESTORE_DATABASE_ID_,
      firestoreRequestPathHashPrefix: stringD7E3R_(error && error.requestPathHashPrefix),
      firestoreErrorStatus: stringD7E3R_(error && error.firestoreErrorStatus),
      firestoreErrorMessage: stringD7E3R_(error && error.firestoreErrorMessage)
    });
  }
}

function createD7E3RFirestoreReader_(services) {
  function getDocument(path) {
    const safePath = validateD7E3RFirestoreDocumentPath_(path);
    const url = 'https://firestore.googleapis.com/v1/projects/' +
      encodeURIComponent(D7_E3R_FIRESTORE_PROJECT_ID_) +
      '/databases/' + encodeURIComponent(D7_E3R_FIRESTORE_DATABASE_ID_) +
      '/documents/' + safePath.split('/').map(encodeURIComponent).join('/');
    const response = services.fetch(url, {
      method: 'get',
      muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + services.getOAuthToken() }
    });
    const status = Number(response.getResponseCode());
    const body = String(response.getContentText() || '');
    if (status === 200) return decodeD7E3RFirestoreDocument_(JSON.parse(body));
    if (status === 404) return null;
    const parsed = safeJsonD7E3R_(body) || {};
    const error = parsed.error || {};
    throw d7e3rError_({
      code: status === 401 || status === 403 ? 'FIRESTORE_AUTHORIZATION_FAILED' : (status >= 500 || status === 429 ? 'TRANSPORT_FAILED' : 'UNKNOWN_READ_BLOCKER'),
      httpStatus: status,
      requestPathHashPrefix: hashPrefixD7E3R_(safePath, 16),
      firestoreErrorStatus: stringD7E3R_(error.status),
      firestoreErrorMessage: stringD7E3R_(error.message)
    });
  }
  return Object.freeze({ getDocument });
}

function validateD7E3RFirestoreDocumentPath_(path) {
  const text = stringD7E3R_(path);
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9._:-]+(?:\/[A-Za-z0-9_-]+\/[A-Za-z0-9._:-]+)*$/.test(text)) throw d7e3rError_({ code: 'INVALID_EXACT_RESOURCE_REFERENCE' });
  const collection = text.split('/')[0];
  if (['invoiceJobs', 'worker_leases', 'attachments'].indexOf(collection) < 0) throw d7e3rError_({ code: 'INVALID_EXACT_RESOURCE_REFERENCE' });
  return text;
}

function decodeD7E3RFirestoreDocument_(document) {
  const fields = document && document.fields || {};
  const out = {};
  Object.keys(fields).forEach(function eachField(key) { out[key] = decodeD7E3RFirestoreValue_(fields[key]); });
  return out;
}

function decodeD7E3RFirestoreValue_(value) {
  const source = value || {};
  if (Object.prototype.hasOwnProperty.call(source, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(source, 'booleanValue')) return Boolean(source.booleanValue);
  if (Object.prototype.hasOwnProperty.call(source, 'integerValue')) return Number(source.integerValue);
  if (Object.prototype.hasOwnProperty.call(source, 'doubleValue')) return Number(source.doubleValue);
  if (Object.prototype.hasOwnProperty.call(source, 'stringValue')) return String(source.stringValue);
  if (Object.prototype.hasOwnProperty.call(source, 'timestampValue')) return String(source.timestampValue);
  if (source.arrayValue) return ((source.arrayValue && source.arrayValue.values) || []).map(decodeD7E3RFirestoreValue_);
  if (source.mapValue) return decodeD7E3RFirestoreDocument_({ fields: source.mapValue.fields || {} });
  return '';
}

function blockedD7E3RResult_(channel, status, reasonCode) {
  return {
    status: status || 'READ_BLOCKED',
    readerImplementation: D7_E3R_READER_IMPLEMENTATION_,
    evidenceSource: 'D7_E3R_' + stringD7E3R_(channel).toUpperCase() + '_REAL_BOUNDED_READ_ONLY_ADAPTER',
    reasonCode: reasonCode || 'UNKNOWN_READ_BLOCKER',
    readAttempted: true,
    readSucceeded: false,
    exactTargetMatched: false,
    readBlocked: status !== 'READ_NOT_FOUND',
    permissionReasonCode: reasonCode || 'UNKNOWN_READ_BLOCKER',
    authorizationType: channel === 'FIRESTORE' ? 'OAUTH_DATASTORE_AND_IAM' : 'OAUTH_AND_RESOURCE_ACL',
    resourceAccessStatus: 'NOT_PROVEN',
    executionIdentityStatus: 'IDENTITY_UNAVAILABLE',
    readCallCount: 1
  };
}

function exactD7E3RSheetRowNumber_(context) {
  const properties = context && context.properties || {};
  const configured = Number(properties.D7_E3R_SHEET_ROW_NUMBER || properties.D7_E3I_SHEET_ROW_NUMBER || properties.D6J_D4_TARGET_ROW_NUMBER || 0);
  if (Number.isInteger(configured) && configured > 1) return configured;
  if (typeof D6J_D4_TARGET_ROW_NUMBER_ !== 'undefined' && Number(D6J_D4_TARGET_ROW_NUMBER_) > 1) return Number(D6J_D4_TARGET_ROW_NUMBER_);
  return 0;
}

function readD7E3RExecutionIdentityReadOnly_() {
  try {
    const effective = typeof Session !== 'undefined' && Session.getEffectiveUser ? stringD7E3R_(Session.getEffectiveUser().getEmail()) : '';
    const active = typeof Session !== 'undefined' && Session.getActiveUser ? stringD7E3R_(Session.getActiveUser().getEmail()) : '';
    if (effective && active && effective !== active) return { executionIdentityStatus: 'ACTIVE_USER_DIFFERS_FROM_EFFECTIVE_USER' };
    if (effective && active && effective === active) return { executionIdentityStatus: 'ACTIVE_USER_EQUALS_EFFECTIVE_USER' };
    if (effective || active) return { executionIdentityStatus: 'MANUAL_OWNER_EXECUTION' };
    return { executionIdentityStatus: 'IDENTITY_UNAVAILABLE' };
  } catch (error) {
    return { executionIdentityStatus: 'IDENTITY_UNAVAILABLE' };
  }
}

function classifyD7E3RError_(error, channel) {
  const code = stringD7E3R_(error && (error.code || error.message || error.name || error)).toUpperCase();
  if (/NOT_FOUND|NO_SUCH|404/.test(code)) return 'RESOURCE_NOT_FOUND';
  if (/SCOPE|OAUTH|CONSENT/.test(code)) return 'OAUTH_SCOPE_MISSING';
  if (/REAUTH|AUTHORIZATION_REQUIRED/.test(code)) return 'OAUTH_REAUTHORIZATION_REQUIRED';
  if (channel === 'FIRESTORE' && /AUTH|IAM|403|401|DENIED|FORBIDDEN/.test(code)) return 'FIRESTORE_AUTHORIZATION_FAILED';
  if (/DENIED|FORBIDDEN|PERMISSION|403|401/.test(code)) return 'RESOURCE_ACCESS_DENIED';
  if (/INVALID|REFERENCE|MALFORMED|CONFIG/.test(code)) return 'INVALID_EXACT_RESOURCE_REFERENCE';
  if (/TIMEOUT|FETCH|NETWORK|429|500|503|TRANSPORT/.test(code)) return 'TRANSPORT_FAILED';
  return code || 'UNKNOWN_READ_BLOCKER';
}

function safeErrorClassD7E3R_(error) {
  return classifyD7E3RError_(error, 'UNKNOWN');
}

function d7e3rError_(details) {
  const safe = details || {};
  const error = new Error(stringD7E3R_(safe.code || 'UNKNOWN_READ_BLOCKER'));
  error.code = stringD7E3R_(safe.code || 'UNKNOWN_READ_BLOCKER');
  error.httpStatus = Number(safe.httpStatus || 0);
  error.requestPathHashPrefix = stringD7E3R_(safe.requestPathHashPrefix);
  error.firestoreErrorStatus = stringD7E3R_(safe.firestoreErrorStatus);
  error.firestoreErrorMessage = stringD7E3R_(safe.firestoreErrorMessage).slice(0, 120);
  return error;
}

function buildD7E3RBoundedGmailQuery_(sender, subject, window) {
  return [
    'from:' + quoteD7E3RGmailQuery_(sender),
    'subject:' + quoteD7E3RGmailQuery_(subject),
    'after:' + window.after,
    'before:' + window.before,
    'has:attachment'
  ].join(' ');
}

function createD7E3RDateWindow_(dateValue) {
  const text = stringD7E3R_(dateValue);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parts = text.split('-').map(Number);
  const base = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return {
    after: formatD7E3RDate_(new Date(base.getTime() - 24 * 60 * 60 * 1000)),
    before: formatD7E3RDate_(new Date(base.getTime() + 24 * 60 * 60 * 1000))
  };
}

function isD7E3RDateInsideWindow_(dateValue, window) {
  if (!dateValue || !window) return true;
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;
  const stamp = formatD7E3RDate_(date);
  return stamp >= window.after && stamp < window.before;
}

function formatD7E3RDate_(date) {
  return date.getUTCFullYear() + '/' + String(date.getUTCMonth() + 1).padStart(2, '0') + '/' + String(date.getUTCDate()).padStart(2, '0');
}

function quoteD7E3RGmailQuery_(value) {
  return '"' + String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function callD7E3R_(fn, fallback) {
  try { return fn(); } catch (error) { return fallback; }
}

function canonicalD7E3R_(value) {
  return stringD7E3R_(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function stringD7E3R_(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function bytesD7E3R_(value) {
  if (Array.isArray(value)) return value.map(function normalizeByte(byte) { return Number(byte) & 255; });
  if (typeof value === 'string') {
    const out = [];
    for (let i = 0; i < value.length; i += 1) out.push(value.charCodeAt(i) & 255);
    return out;
  }
  if (value && typeof value.getBytes === 'function') return value.getBytes();
  return [];
}

function sha256D7E3RText_(value) {
  return sha256D7E3RBytes_(String(value || ''));
}

function sha256D7E3RBytes_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytesD7E3R_(value));
  return digest.map(function toHex(byte) {
    const unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function hashPrefixD7E3R_(value, length) {
  const text = stringD7E3R_(value);
  if (!text) return '';
  const hash = /^[a-f0-9]{64}$/i.test(text) ? text.toLowerCase() : sha256D7E3RText_(text);
  return hash.slice(0, length || 12);
}

function mergeD7E3RObjects_(base, patch) {
  const output = {};
  Object.keys(base || {}).forEach(function baseKey(key) { output[key] = base[key]; });
  Object.keys(patch || {}).forEach(function patchKey(key) { output[key] = patch[key]; });
  return output;
}

function safeJsonD7E3R_(text) {
  try { return JSON.parse(String(text || '')); } catch (error) { return null; }
}
