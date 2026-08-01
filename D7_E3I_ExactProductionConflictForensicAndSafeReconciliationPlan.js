const D7_E3I_PHASE_ = 'D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN';
const D7_E3I_PUBLIC_ENTRYPOINT_ = 'runD7E3IExactProductionConflictForensicReadOnly';
const D7_E3I_SCHEMA_VERSION_ = 'D7_E3I_FORENSIC_RESULT_V1';

const D7_E3I_CONFIDENCE_ = Object.freeze({
  PROVEN: 'PROVEN',
  SUPPORTED: 'SUPPORTED',
  UNPROVEN: 'UNPROVEN',
  UNAVAILABLE: 'UNAVAILABLE'
});

const D7_E3I_LIMITS_ = Object.freeze({
  GMAIL_MESSAGE_LIMIT: 1,
  XML_ATTACHMENT_LIMIT: 1,
  PDF_ATTACHMENT_LIMIT: 1,
  DRIVE_FILE_LIMIT_PER_ARTIFACT: 2,
  SHEET_CANONICAL_ROW_LIMIT: 2,
  FIRESTORE_EXACT_JOB_LIMIT: 1,
  FIRESTORE_LEASE_LIMIT: 1,
  FIRESTORE_COMMIT_PLAN_LIMIT: 1,
  FIRESTORE_RECONCILIATION_REPORT_LIMIT: 1
});

const D7_E3I_PRIMARY_PRECEDENCE_ = Object.freeze({
  FORENSICS_INCOMPLETE: 1,
  MULTI_SYSTEM_CONFLICT: 2,
  DRIVE_CONTENT_CONFLICT: 3,
  SHEET_IDENTITY_CONFLICT: 4,
  FIRESTORE_STATE_CONFLICT: 5,
  EXTERNAL_USER_CREATED_STATE: 6,
  PARTIAL_UNKNOWN_OUTCOME: 7,
  PARTIAL_CONFIRMED_MUTATION: 8,
  CONSISTENT_ALREADY_COMPLETED: 9
});

const D7_E3I_FINDING_SEVERITY_ = Object.freeze({
  BLOCKER: 1,
  HIGH: 2,
  MEDIUM: 3,
  LOW: 4,
  INFO: 5
});

const D7_E3I_PERMISSION_REASON_CODES_ = Object.freeze({
  READ_OK: 'READ_OK',
  OAUTH_SCOPE_MISSING: 'OAUTH_SCOPE_MISSING',
  OAUTH_REAUTHORIZATION_REQUIRED: 'OAUTH_REAUTHORIZATION_REQUIRED',
  RESOURCE_ACCESS_DENIED: 'RESOURCE_ACCESS_DENIED',
  EXECUTION_IDENTITY_MISMATCH: 'EXECUTION_IDENTITY_MISMATCH',
  FIRESTORE_AUTHORIZATION_FAILED: 'FIRESTORE_AUTHORIZATION_FAILED',
  FIRESTORE_PROJECT_OR_DATABASE_MISMATCH: 'FIRESTORE_PROJECT_OR_DATABASE_MISMATCH',
  INVALID_EXACT_RESOURCE_REFERENCE: 'INVALID_EXACT_RESOURCE_REFERENCE',
  TRANSPORT_FAILED: 'TRANSPORT_FAILED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONTENT_READ_FAILED: 'CONTENT_READ_FAILED',
  METADATA_READ_FAILED: 'METADATA_READ_FAILED',
  ROW_IDENTITY_MISMATCH: 'ROW_IDENTITY_MISMATCH',
  MESSAGE_IDENTITY_MISMATCH: 'MESSAGE_IDENTITY_MISMATCH',
  DOCUMENT_IDENTITY_MISMATCH: 'DOCUMENT_IDENTITY_MISMATCH',
  ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE: 'ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE',
  UNKNOWN_READ_BLOCKER: 'UNKNOWN_READ_BLOCKER'
});

const D7_E3I_MINIMUM_SCOPE_MATRIX_ = Object.freeze({
  GMAIL: 'GMAIL_EXACT_MESSAGE_READ_ONLY',
  DRIVE_XML: 'DRIVE_EXACT_FILE_METADATA_AND_CONTENT_READ_ONLY',
  DRIVE_PDF: 'DRIVE_EXACT_FILE_METADATA_AND_CONTENT_READ_ONLY',
  SHEETS: 'SHEETS_EXACT_ROW_READ_ONLY',
  FIRESTORE: 'FIRESTORE_EXACT_DOCUMENT_READ_ONLY'
});

function runD7E3IExactProductionConflictForensicReadOnly() {
  const runner = createD7E3IExactProductionConflictForensicRunner_();
  return runner.run();
}

function createD7E3IExactProductionConflictForensicRunner_(dependencies) {
  const d = dependencies || {};
  const productionReaders = d.productionReaders || (typeof createD7E3RExactBoundedProductionReadOnlyAdapters_ === 'function'
    ? createD7E3RExactBoundedProductionReadOnlyAdapters_()
    : {});
  const services = {
    readConfiguration: d.readConfiguration || readD7E3IConfigurationReadOnly_,
    readSnapshot: d.readSnapshot || productionReaders.readSnapshot || createD7E3IUnavailableSnapshotReader_(),
    readGmailEvidence: d.readGmailEvidence || productionReaders.readGmailEvidence || createD7E3IUnavailableSystemReader_('GMAIL'),
    readDriveEvidence: d.readDriveEvidence || productionReaders.readDriveEvidence || createD7E3IUnavailableSystemReader_('DRIVE'),
    readSheetsEvidence: d.readSheetsEvidence || productionReaders.readSheetsEvidence || createD7E3IUnavailableSystemReader_('SHEETS'),
    readFirestoreEvidence: d.readFirestoreEvidence || productionReaders.readFirestoreEvidence || createD7E3IUnavailableSystemReader_('FIRESTORE'),
    now: d.now || function nowD7E3I_() { return new Date().toISOString(); },
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log: function noopD7E3I_() {} })
  };

  function run() {
    const result = createD7E3IBaseResult_(services.now());
    const findings = [];
    let configuration = {};
    let beforeSnapshot;
    let afterSnapshot;

    try {
      configuration = normalizeD7E3IConfiguration_(safeD7E3IRead_('CONFIGURATION', services.readConfiguration, {}, findings));
      result.CONFIGURATION = configuration.publicResult;
    } catch (error) {
      configuration = normalizeD7E3IConfiguration_({ status: 'BLOCKED_CONFIGURATION_READ', reasonCode: normalizeD7E3IErrorCode_(error) });
      result.CONFIGURATION = configuration.publicResult;
      addD7E3IFinding_(findings, 'FORENSIC_READ_PERMISSION_BLOCKER', 'BLOCKER', 'CONFIGURATION', 'UNAVAILABLE', {
        reasonCode: result.CONFIGURATION.reasonCode
      });
    }

    beforeSnapshot = normalizeD7E3ISnapshot_(safeD7E3IRead_('BEFORE_SNAPSHOT', services.readSnapshot, { stage: 'BEFORE', configuration: configuration.privateConfig }, findings), 'BEFORE');
    result.BEFORE_SNAPSHOT = beforeSnapshot.publicResult;

    const gmail = analyzeD7E3IGmailEvidence_(safeD7E3IRead_('GMAIL', services.readGmailEvidence, { configuration: configuration.privateConfig }, findings), configuration.privateConfig, findings);
    result.GMAIL_EVIDENCE = gmail.publicResult;

    const driveXml = analyzeD7E3IDriveEvidence_('XML', safeD7E3IRead_('DRIVE_XML', services.readDriveEvidence, { artifactType: 'XML', configuration: configuration.privateConfig }, findings), configuration.privateConfig, findings);
    result.DRIVE_XML_EVIDENCE = driveXml.publicResult;

    const drivePdf = analyzeD7E3IDriveEvidence_('PDF', safeD7E3IRead_('DRIVE_PDF', services.readDriveEvidence, { artifactType: 'PDF', configuration: configuration.privateConfig }, findings), configuration.privateConfig, findings);
    result.DRIVE_PDF_EVIDENCE = drivePdf.publicResult;

    const sheets = analyzeD7E3ISheetsEvidence_(safeD7E3IRead_('SHEETS', services.readSheetsEvidence, { configuration: configuration.privateConfig }, findings), configuration.privateConfig, findings);
    result.SHEETS_EVIDENCE = sheets.publicResult;

    const firestore = analyzeD7E3IFirestoreEvidence_(safeD7E3IRead_('FIRESTORE', services.readFirestoreEvidence, { configuration: configuration.privateConfig }, findings), configuration.privateConfig, findings);
    result.FIRESTORE_EVIDENCE = firestore.publicResult;

    afterSnapshot = normalizeD7E3ISnapshot_(safeD7E3IRead_('AFTER_SNAPSHOT', services.readSnapshot, { stage: 'AFTER', configuration: configuration.privateConfig }, findings), 'AFTER');
    result.AFTER_SNAPSHOT = afterSnapshot.publicResult;

    const concurrency = compareD7E3ISnapshots_(beforeSnapshot, afterSnapshot, findings);
    result.CONCURRENT_CHANGE_STATUS = concurrency.publicResult;

    const analysis = {
      configuration,
      beforeSnapshot,
      afterSnapshot,
      gmail,
      driveXml,
      drivePdf,
      sheets,
      firestore,
      concurrency
    };
    result.READER_DIAGNOSTICS = createD7E3IReaderDiagnostics_(analysis);
    result.PERMISSION_DIAGNOSTICS = createD7E3IPermissionDiagnostics_(analysis);
    result.PRIMARY_CLASSIFICATION = classifyD7E3IPrimary_(analysis, findings);
    result.FINDINGS = sortD7E3IFindings_(findings);
    result.RECONCILIATION_PLAN = buildD7E3IReconciliationPlan_(result.PRIMARY_CLASSIFICATION, result.FINDINGS, analysis);
    result.SAFETY_COUNTS = createD7E3ISafetyCounts_(analysis);
    result.FINAL_STATUS = finalD7E3IStatus_(result.PRIMARY_CLASSIFICATION, result.FINDINGS);

    const jsonSafe = sanitizeD7E3IObject_(result);
    emitD7E3ISummary_(services.logger, jsonSafe);
    return jsonSafe;
  }

  return { run: run };
}

function createD7E3IBaseResult_(createdAt) {
  return {
    METADATA: {
      PHASE: D7_E3I_PHASE_,
      SCHEMA_VERSION: D7_E3I_SCHEMA_VERSION_,
      PUBLIC_ENTRYPOINT: D7_E3I_PUBLIC_ENTRYPOINT_,
      CREATED_AT_STATUS: createdAt ? 'CAPTURED' : 'UNAVAILABLE',
      RUNTIME_MUTATION: 'NONE',
      PRODUCTION_EXECUTION_IN_TESTS: 'NONE',
      REPAIR_EXECUTION: 'NONE',
      RECONCILIATION_WRITE: 'NONE',
      DEPLOYMENT: 'NONE',
      LIMITS: D7_E3I_LIMITS_,
      MINIMUM_SCOPE_MATRIX: D7_E3I_MINIMUM_SCOPE_MATRIX_
    },
    CONFIGURATION: {},
    BEFORE_SNAPSHOT: {},
    GMAIL_EVIDENCE: {},
    DRIVE_XML_EVIDENCE: {},
    DRIVE_PDF_EVIDENCE: {},
    SHEETS_EVIDENCE: {},
    FIRESTORE_EVIDENCE: {},
    READER_DIAGNOSTICS: {},
    PERMISSION_DIAGNOSTICS: {},
    AFTER_SNAPSHOT: {},
    CONCURRENT_CHANGE_STATUS: {},
    PRIMARY_CLASSIFICATION: 'FORENSICS_INCOMPLETE',
    FINDINGS: [],
    RECONCILIATION_PLAN: {},
    SAFETY_COUNTS: {},
    FINAL_STATUS: 'BLOCKED_FORENSIC_CONTRACT_INCOMPLETE'
  };
}

function readD7E3IConfigurationReadOnly_() {
  const canonicalKeys = [
    'D7_E_CANONICAL_CANDIDATE_FINGERPRINT',
    'D7_E_CANONICAL_XML_SHA256',
    'D7_E_CANONICAL_PDF_SHA256',
    'D7_E_CANONICAL_INVOICE_IDENTITY_HASH',
    'D7_E_CANONICAL_ATTACHMENT_SET_HASH'
  ];
  const aliasGroups = {
    expectedXmlSha256: ['D7_E_EXPECTED_XML_SHA256', 'D7_E3G_EXPECTED_XML_SHA256'],
    expectedPdfSha256: ['D7_E_EXPECTED_PDF_SHA256', 'D7_E3G_EXPECTED_PDF_SHA256'],
    expectedIdentityHash: ['D7_E_EXPECTED_INVOICE_IDENTITY_HASH', 'D7_E3G_EXPECTED_INVOICE_IDENTITY_HASH']
  };
  const props = typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties
    ? PropertiesService.getScriptProperties()
    : null;
  const values = {};
  let canonicalPresentCount = 0;
  let canonicalEmptyCount = 0;

  for (const key of canonicalKeys) {
    const raw = props && props.getProperty ? props.getProperty(key) : null;
    if (raw !== null && raw !== undefined) {
      canonicalPresentCount += 1;
      if (String(raw).trim() === '') canonicalEmptyCount += 1;
      values[key] = String(raw);
    }
  }

  const aliasConflictKeys = [];
  for (const [target, keys] of Object.entries(aliasGroups)) {
    const seen = [];
    for (const key of keys) {
      const raw = props && props.getProperty ? props.getProperty(key) : null;
      if (raw !== null && raw !== undefined && String(raw).trim() !== '') seen.push({ key: key, value: String(raw).trim() });
    }
    if (seen.length > 1 && seen.some(function hasConflict(item) { return item.value !== seen[0].value; })) {
      aliasConflictKeys.push(target);
    }
    if (seen.length) values[target] = seen[0].value;
  }

  const blocked = canonicalEmptyCount > 0 || aliasConflictKeys.length > 0;
  return {
    status: blocked ? 'BLOCKED_CONFIGURATION_CONFLICT' : 'CONFIGURATION_READ_OK',
    confidence: blocked ? 'PROVEN' : 'SUPPORTED',
    evidenceSource: 'SCRIPT_PROPERTIES_NAMES_ONLY',
    reasonCode: blocked ? 'CONFIGURATION_CONFLICT_OR_EMPTY_CANONICAL_KEY' : 'CONFIGURATION_SANITIZED',
    canonicalKeysPresentCount: canonicalPresentCount,
    canonicalEmptyKeyCount: canonicalEmptyCount,
    aliasConflictCount: aliasConflictKeys.length,
    aliasConflictKeys: aliasConflictKeys,
    expectedXmlSha256: values.D7_E_CANONICAL_XML_SHA256 || values.expectedXmlSha256 || '',
    expectedPdfSha256: values.D7_E_CANONICAL_PDF_SHA256 || values.expectedPdfSha256 || '',
    expectedIdentityHash: values.D7_E_CANONICAL_INVOICE_IDENTITY_HASH || values.expectedIdentityHash || '',
    expectedAttachmentSetHash: values.D7_E_CANONICAL_ATTACHMENT_SET_HASH || '',
    expectedCandidateFingerprint: values.D7_E_CANONICAL_CANDIDATE_FINGERPRINT || '',
    rawConfiguration: props && props.getProperties ? props.getProperties() : {}
  };
}

function normalizeD7E3IConfiguration_(raw) {
  const input = raw || {};
  const blocked = input.status && String(input.status).indexOf('BLOCKED') === 0;
  const privateConfig = {
    expectedXmlSha256: normalizeD7E3IHash_(input.expectedXmlSha256),
    expectedPdfSha256: normalizeD7E3IHash_(input.expectedPdfSha256),
    expectedIdentityHash: normalizeD7E3IHash_(input.expectedIdentityHash),
    expectedAttachmentSetHash: normalizeD7E3IHash_(input.expectedAttachmentSetHash),
    expectedCandidateFingerprint: normalizeD7E3IHash_(input.expectedCandidateFingerprint),
    rawConfiguration: input.rawConfiguration || {}
  };
  return {
    blocked: blocked,
    privateConfig: privateConfig,
    publicResult: evidenceD7E3IClaim_(blocked ? 'BLOCKED' : (input.status || 'CONFIGURATION_READ_OK'), input.confidence || (blocked ? 'PROVEN' : 'SUPPORTED'), input.evidenceSource || 'INJECTED_OR_SCRIPT_PROPERTIES', input.reasonCode || 'CONFIGURATION_SANITIZED', {
      canonicalKeyPrecedence: 'YES',
      canonicalKeysPresentCount: numberD7E3I_(input.canonicalKeysPresentCount),
      canonicalEmptyKeyCount: numberD7E3I_(input.canonicalEmptyKeyCount),
      aliasConflictCount: numberD7E3I_(input.aliasConflictCount),
      requiredValuePresence: {
        expectedXmlSha256: privateConfig.expectedXmlSha256 ? 'YES' : 'NO',
        expectedPdfSha256: privateConfig.expectedPdfSha256 ? 'YES' : 'NO',
        expectedIdentityHash: privateConfig.expectedIdentityHash ? 'YES' : 'NO',
        expectedAttachmentSetHash: privateConfig.expectedAttachmentSetHash ? 'YES' : 'NO',
        expectedCandidateFingerprint: privateConfig.expectedCandidateFingerprint ? 'YES' : 'NO'
      }
    })
  };
}

function safeD7E3IRead_(label, fn, args, findings) {
  try {
    return fn(args || {});
  } catch (error) {
    addD7E3IFinding_(findings, 'FORENSIC_READ_PERMISSION_BLOCKER', 'BLOCKER', label, 'UNAVAILABLE', {
      errorCode: normalizeD7E3IErrorCode_(error)
    });
    return {
      status: 'READ_BLOCKED',
      confidence: 'UNAVAILABLE',
      evidenceSource: label,
      reasonCode: normalizeD7E3IErrorCode_(error)
    };
  }
}

function analyzeD7E3IGmailEvidence_(raw, config, findings) {
  const input = raw || {};
  const permissionStatus = createD7E3IPermissionStatus_('GMAIL', input, input.status);
  const candidateCount = numberD7E3I_(input.candidateCount);
  const messageCount = numberD7E3I_(input.messageCount, candidateCount);
  const xmlAttachmentCount = numberD7E3I_(input.xmlAttachmentCount);
  const pdfAttachmentCount = numberD7E3I_(input.pdfAttachmentCount);
  const xmlHash = normalizeD7E3IHash_(input.xmlSha256 || input.sourceXmlSha256 || sha256D7E3IBytesIfPresent_(input.xmlBytes));
  const pdfHash = normalizeD7E3IHash_(input.pdfSha256 || input.sourcePdfSha256 || sha256D7E3IBytesIfPresent_(input.pdfBytes));
  const xmlHashMatch = config.expectedXmlSha256 && xmlHash ? boolStatusD7E3I_(xmlHash === config.expectedXmlSha256) : 'UNAVAILABLE';
  const pdfHashMatch = config.expectedPdfSha256 && pdfHash ? boolStatusD7E3I_(pdfHash === config.expectedPdfSha256) : 'UNAVAILABLE';
  let classification = 'GMAIL_CANDIDATE_EXACT';
  let confidence = 'PROVEN';
  let reasonCode = 'GMAIL_SOURCE_VERIFIED';
  let conflict = false;
  let incomplete = false;

  if (isReadBlockedD7E3I_(input.status) || input.readBlocked) {
    classification = 'GMAIL_READ_BLOCKED';
    reasonCode = 'GMAIL_READ_BLOCKED';
    confidence = 'UNAVAILABLE';
    incomplete = true;
    addD7E3IReadIssueFinding_(findings, 'GMAIL', permissionStatus, { readStatus: input.status || 'READ_BLOCKED' });
  } else if (candidateCount === 0 || messageCount === 0) {
    classification = 'GMAIL_CANDIDATE_ABSENT';
    reasonCode = 'GMAIL_CANDIDATE_ABSENT';
    incomplete = true;
    addD7E3IFinding_(findings, 'GMAIL_SOURCE_CONFLICT', 'HIGH', 'GMAIL', 'PROVEN', { candidateCount: candidateCount });
  } else if (candidateCount > D7_E3I_LIMITS_.GMAIL_MESSAGE_LIMIT || messageCount > D7_E3I_LIMITS_.GMAIL_MESSAGE_LIMIT) {
    classification = 'GMAIL_CANDIDATE_AMBIGUOUS';
    reasonCode = 'GMAIL_CANDIDATE_AMBIGUOUS';
    incomplete = true;
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'GMAIL', 'PROVEN', { candidateCount: candidateCount, messageCount: messageCount });
  } else if (input.messageIdentityStatus && input.messageIdentityStatus !== 'MATCH') {
    classification = 'GMAIL_MESSAGE_ID_MISMATCH';
    reasonCode = 'GMAIL_MESSAGE_ID_MISMATCH';
    conflict = true;
    addD7E3IFinding_(findings, 'GMAIL_SOURCE_CONFLICT', 'HIGH', 'GMAIL', 'PROVEN', { messageIdentityStatus: input.messageIdentityStatus });
  } else if (xmlAttachmentCount !== D7_E3I_LIMITS_.XML_ATTACHMENT_LIMIT || pdfAttachmentCount !== D7_E3I_LIMITS_.PDF_ATTACHMENT_LIMIT) {
    classification = 'GMAIL_ATTACHMENT_CARDINALITY_CONFLICT';
    reasonCode = 'GMAIL_ATTACHMENT_CARDINALITY_CONFLICT';
    conflict = true;
    addD7E3IFinding_(findings, 'GMAIL_SOURCE_CONFLICT', 'HIGH', 'GMAIL', 'PROVEN', { xmlAttachmentCount: xmlAttachmentCount, pdfAttachmentCount: pdfAttachmentCount });
  } else if (xmlHashMatch === 'NO') {
    classification = 'GMAIL_XML_HASH_CONFLICT';
    reasonCode = 'GMAIL_XML_HASH_CONFLICT';
    conflict = true;
    addD7E3IFinding_(findings, 'GMAIL_SOURCE_CONFLICT', 'HIGH', 'GMAIL', 'PROVEN', { artifactType: 'XML', sourceHashMatch: 'NO', observedHashPrefix: hashPrefixD7E3I_(xmlHash) });
  } else if (pdfHashMatch === 'NO') {
    classification = 'GMAIL_PDF_HASH_CONFLICT';
    reasonCode = 'GMAIL_PDF_HASH_CONFLICT';
    conflict = true;
    addD7E3IFinding_(findings, 'GMAIL_SOURCE_CONFLICT', 'HIGH', 'GMAIL', 'PROVEN', { artifactType: 'PDF', sourceHashMatch: 'NO', observedHashPrefix: hashPrefixD7E3I_(pdfHash) });
  } else {
    addD7E3IFinding_(findings, 'GMAIL_SOURCE_VERIFIED', 'INFO', 'GMAIL', 'PROVEN', { messageCount: messageCount, xmlAttachmentCount: xmlAttachmentCount, pdfAttachmentCount: pdfAttachmentCount });
  }

  const publicResult = evidenceD7E3IClaim_(classification, confidence, input.evidenceSource || 'INJECTED_GMAIL_READ_ONLY_ADAPTER', reasonCode, {
    readerImplementation: input.readerImplementation || 'UNAVAILABLE',
    readAttempted: boolStatusD7E3I_(input.readAttempted !== false),
    exactTargetMatched: boolStatusD7E3I_(input.exactTargetMatched === true || input.exactTargetMatched === 'YES'),
    exactBoundedQueryContract: 'YES',
    candidateCount: candidateCount,
    messageCount: messageCount,
    xmlAttachmentCount: xmlAttachmentCount,
    pdfAttachmentCount: pdfAttachmentCount,
    xmlAttachmentNameMatch: input.xmlAttachmentNameMatch || 'UNAVAILABLE',
    pdfAttachmentNameMatch: input.pdfAttachmentNameMatch || 'UNAVAILABLE',
    xmlMimeTypeStatus: normalizeD7E3IMimeStatus_(input.xmlMimeTypeStatus || input.xmlMimeType),
    pdfMimeTypeStatus: normalizeD7E3IMimeStatus_(input.pdfMimeTypeStatus || input.pdfMimeType),
    xmlByteLength: numberD7E3I_(input.xmlByteLength, byteLengthD7E3I_(input.xmlBytes)),
    pdfByteLength: numberD7E3I_(input.pdfByteLength, byteLengthD7E3I_(input.pdfBytes)),
    permissionStatus: permissionStatus.status,
    permissionReasonCode: permissionStatus.reasonCode,
    safeErrorClass: permissionStatus.safeErrorClass,
    authorizationType: permissionStatus.authorizationType,
    resourceAccessStatus: permissionStatus.resourceAccessStatus,
    executionIdentityStatus: permissionStatus.executionIdentityStatus,
    sourceXmlHashMatch: xmlHashMatch,
    sourcePdfHashMatch: pdfHashMatch,
    sourceXmlHashPrefix: hashPrefixD7E3I_(xmlHash),
    sourcePdfHashPrefix: hashPrefixD7E3I_(pdfHash),
    snapshotFingerprint: safeFingerprintD7E3I_(input.snapshotFingerprint || {
      candidateCount: candidateCount,
      messageCount: messageCount,
      xmlAttachmentCount: xmlAttachmentCount,
      pdfAttachmentCount: pdfAttachmentCount,
      xmlHashPrefix: hashPrefixD7E3I_(xmlHash),
      pdfHashPrefix: hashPrefixD7E3I_(pdfHash)
    })
  });

  return { publicResult: publicResult, classification: classification, conflict: conflict, incomplete: incomplete, permissionStatus: permissionStatus, readCallCount: boundedCountD7E3I_(input.readCallCount, 1) };
}

function analyzeD7E3IDriveEvidence_(artifactType, raw, config, findings) {
  const input = raw || {};
  const upperType = artifactType === 'PDF' ? 'PDF' : 'XML';
  const candidateCount = numberD7E3I_(input.candidateCount);
  const metadataSize = numberD7E3I_(input.metadataSize, -1);
  const bytesPresent = input.bytes !== undefined || input.contentBytes !== undefined;
  const rawBytes = input.bytes !== undefined ? input.bytes : input.contentBytes;
  const blobByteLength = numberD7E3I_(input.blobByteLength, bytesPresent ? byteLengthD7E3I_(rawBytes) : -1);
  const metadataReadStatus = normalizeD7E3IDriveReadStatus_(input.metadataReadStatus, input.status);
  const contentReadStatus = normalizeD7E3IDriveReadStatus_(input.contentReadStatus, input.status);
  const permissionStatus = createD7E3IPermissionStatus_(
    'DRIVE_' + upperType,
    input,
    isReadBlockedD7E3I_(metadataReadStatus) ? metadataReadStatus : (isReadBlockedD7E3I_(contentReadStatus) ? contentReadStatus : input.status)
  );
  const metadataSizeExplicitlyObserved = input.metadataSizeExplicitlyObserved === true && metadataSize >= 0;
  const contentBytesExplicitlyObserved = input.contentBytesExplicitlyObserved === true && bytesPresent;
  const metadataReadExplicitlySucceeded = metadataReadStatus === 'READ_OK' && metadataSizeExplicitlyObserved;
  const contentReadExplicitlySucceeded = contentReadStatus === 'READ_OK' && contentBytesExplicitlyObserved;
  const structuredReadErrorPresent = !!(input.readErrorCode || input.metadataReadErrorCode || input.contentReadErrorCode || isReadBlockedD7E3I_(metadataReadStatus) || isReadBlockedD7E3I_(contentReadStatus));
  const readerFallbackPossible = input.readerFallbackPossible === true || (contentReadStatus === 'READ_OK' && !contentBytesExplicitlyObserved);
  const expectedHash = upperType === 'XML' ? config.expectedXmlSha256 : config.expectedPdfSha256;
  let computedHash = '';
  let sourceHashMatch = 'UNAVAILABLE';
  let shaStatus = 'NOT_COMPUTED';
  let classification = 'DRIVE_FORENSICS_INCOMPLETE';
  let reasonCode = 'DRIVE_FORENSICS_INCOMPLETE';
  let confidence = 'UNAVAILABLE';
  let conflict = false;
  let incomplete = false;
  let readerFallbackSuspected = false;

  if (candidateCount === 0) {
    classification = 'DRIVE_FILE_ABSENT';
    reasonCode = 'DRIVE_FILE_ABSENT';
    confidence = 'PROVEN';
    incomplete = true;
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'DRIVE_' + upperType, 'PROVEN', { artifactType: upperType, candidateCount: candidateCount });
  } else if (candidateCount > 1) {
    classification = 'DRIVE_DUPLICATE_AMBIGUITY';
    reasonCode = 'DRIVE_DUPLICATE_AMBIGUITY';
    confidence = 'PROVEN';
    incomplete = true;
    addD7E3IFinding_(findings, 'DRIVE_DUPLICATE_AMBIGUITY', 'BLOCKER', 'DRIVE_' + upperType, 'PROVEN', { artifactType: upperType, candidateCount: candidateCount });
  } else if (isReadBlockedD7E3I_(metadataReadStatus)) {
    classification = 'METADATA_READ_BLOCKED';
    reasonCode = 'METADATA_READ_BLOCKED';
    incomplete = true;
    addD7E3IReadIssueFinding_(findings, 'DRIVE_' + upperType, permissionStatus, { artifactType: upperType, metadataReadStatus: metadataReadStatus });
  } else if (isReadBlockedD7E3I_(contentReadStatus)) {
    classification = 'CONTENT_READ_BLOCKED';
    reasonCode = 'CONTENT_READ_BLOCKED';
    incomplete = true;
    addD7E3IReadIssueFinding_(findings, 'DRIVE_' + upperType, permissionStatus, { artifactType: upperType, contentReadStatus: contentReadStatus });
  } else if (contentReadStatus === 'READ_OK' && !contentBytesExplicitlyObserved) {
    if (blobByteLength === 0) {
      classification = 'ZERO_BYTE_UNPROVEN';
      reasonCode = 'ZERO_BYTE_UNPROVEN';
      confidence = 'UNPROVEN';
    }
    incomplete = true;
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'DRIVE_' + upperType, 'UNPROVEN', {
      artifactType: upperType,
      contentReadStatus: contentReadStatus,
      contentBytesExplicitlyObserved: 'NO',
      failedReadNotHashedAsEmpty: 'YES'
    });
  } else if (contentReadExplicitlySucceeded) {
    if (metadataReadExplicitlySucceeded && metadataSize === 0 && blobByteLength === 0 && !readerFallbackPossible && !structuredReadErrorPresent) {
      classification = 'ACTUAL_ZERO_BYTE_FILE';
      reasonCode = 'ACTUAL_ZERO_BYTE_FILE';
      confidence = 'PROVEN';
      conflict = true;
      addD7E3IFinding_(findings, upperType === 'XML' ? 'DRIVE_XML_ACTUAL_ZERO_BYTE' : 'DRIVE_PDF_ACTUAL_ZERO_BYTE', 'HIGH', 'DRIVE_' + upperType, 'PROVEN', {
        metadataSize: metadataSize,
        blobByteLength: blobByteLength,
        metadataReadExplicitlySucceeded: 'YES',
        contentReadExplicitlySucceeded: 'YES',
        readerFallbackPossible: 'NO'
      });
    } else if (metadataReadExplicitlySucceeded && metadataSize > 0 && blobByteLength === 0) {
      classification = 'READER_EMPTY_FALLBACK_SUSPECTED';
      reasonCode = 'READER_EMPTY_FALLBACK_SUSPECTED';
      confidence = 'SUPPORTED';
      readerFallbackSuspected = true;
      incomplete = true;
      addD7E3IFinding_(findings, upperType === 'XML' ? 'DRIVE_XML_READER_EMPTY_FALLBACK_SUSPECTED' : 'DRIVE_PDF_READER_EMPTY_FALLBACK_SUSPECTED', 'BLOCKER', 'DRIVE_' + upperType, 'SUPPORTED', {
        metadataSize: metadataSize,
        blobByteLength: blobByteLength,
        failedReadNotHashedAsEmpty: 'NO_TRUSTED_EMPTY_HASH_CONCLUSION'
      });
    } else if (!metadataReadExplicitlySucceeded && blobByteLength === 0) {
      classification = 'ZERO_BYTE_UNPROVEN';
      reasonCode = 'ZERO_BYTE_UNPROVEN';
      confidence = 'UNPROVEN';
      incomplete = true;
      addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'DRIVE_' + upperType, 'UNPROVEN', {
        artifactType: upperType,
        metadataReadExplicitlySucceeded: 'NO',
        contentReadExplicitlySucceeded: 'YES',
        failedReadNotHashedAsEmpty: 'YES'
      });
    } else if (!metadataReadExplicitlySucceeded) {
      computedHash = sha256D7E3IBytes_(rawBytes);
      shaStatus = 'COMPUTED_FROM_SUCCESSFUL_CONTENT_READ';
      sourceHashMatch = expectedHash ? boolStatusD7E3I_(computedHash === expectedHash) : 'UNAVAILABLE';
      classification = 'DRIVE_FORENSICS_INCOMPLETE';
      reasonCode = 'METADATA_SUCCESS_NOT_PROVEN';
      incomplete = true;
      addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'DRIVE_' + upperType, 'UNPROVEN', {
        artifactType: upperType,
        metadataReadExplicitlySucceeded: 'NO',
        contentReadExplicitlySucceeded: 'YES'
      });
    } else if (metadataSize >= 0 && blobByteLength >= 0 && metadataSize !== blobByteLength) {
      computedHash = blobByteLength > 0 ? sha256D7E3IBytes_(rawBytes) : '';
      shaStatus = blobByteLength > 0 ? 'COMPUTED_FROM_SUCCESSFUL_CONTENT_READ' : 'NOT_COMPUTED';
      sourceHashMatch = computedHash && expectedHash ? boolStatusD7E3I_(computedHash === expectedHash) : 'UNAVAILABLE';
      classification = 'METADATA_CONTENT_SIZE_MISMATCH';
      reasonCode = 'METADATA_CONTENT_SIZE_MISMATCH';
      confidence = 'PROVEN';
      conflict = true;
      addD7E3IFinding_(findings, 'DRIVE_METADATA_CONTENT_SIZE_MISMATCH', 'HIGH', 'DRIVE_' + upperType, 'PROVEN', { metadataSize: metadataSize, blobByteLength: blobByteLength });
    } else {
      computedHash = sha256D7E3IBytes_(rawBytes);
      shaStatus = 'COMPUTED_FROM_SUCCESSFUL_CONTENT_READ';
      sourceHashMatch = expectedHash ? boolStatusD7E3I_(computedHash === expectedHash) : 'UNAVAILABLE';
      if (sourceHashMatch === 'NO') {
      classification = 'CONTENT_HASH_MISMATCH';
      reasonCode = 'CONTENT_HASH_MISMATCH';
      confidence = 'PROVEN';
      conflict = true;
      addD7E3IFinding_(findings, upperType === 'XML' ? 'DRIVE_XML_CONTENT_HASH_MISMATCH' : 'DRIVE_PDF_CONTENT_HASH_MISMATCH', 'HIGH', 'DRIVE_' + upperType, 'PROVEN', {
        contentHashPrefix: hashPrefixD7E3I_(computedHash),
        sourceHashMatch: 'NO'
      });
      } else if (sourceHashMatch === 'YES') {
      classification = 'CONTENT_HASH_MATCH';
      reasonCode = 'CONTENT_HASH_MATCH';
      confidence = 'PROVEN';
      } else {
      classification = 'DRIVE_FORENSICS_INCOMPLETE';
      reasonCode = 'DRIVE_FORENSICS_INCOMPLETE';
      incomplete = true;
      }
    }
  } else if (blobByteLength === 0) {
    classification = 'ZERO_BYTE_UNPROVEN';
    reasonCode = 'ZERO_BYTE_UNPROVEN';
    confidence = 'UNPROVEN';
    incomplete = true;
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'DRIVE_' + upperType, 'UNPROVEN', { artifactType: upperType, failedReadNotHashedAsEmpty: 'YES' });
  } else {
    incomplete = true;
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'DRIVE_' + upperType, 'UNAVAILABLE', { artifactType: upperType, contentReadStatus: contentReadStatus });
  }

  if (input.mimeTypeStatus && input.mimeTypeStatus === 'MISMATCH') {
    classification = 'DRIVE_MIME_MISMATCH';
    reasonCode = 'DRIVE_MIME_MISMATCH';
    conflict = true;
  }

  const publicResult = evidenceD7E3IClaim_(classification, confidence, input.evidenceSource || 'INJECTED_DRIVE_READ_ONLY_ADAPTER', reasonCode, {
    readerImplementation: input.readerImplementation || 'UNAVAILABLE',
    readAttempted: boolStatusD7E3I_(input.readAttempted !== false),
    exactTargetMatched: boolStatusD7E3I_(input.exactTargetMatched === true || input.exactTargetMatched === 'YES'),
    artifactType: upperType,
    candidateCount: candidateCount,
    discoveryStatus: input.discoveryStatus || (candidateCount === 1 ? 'EXACT_CANDIDATE_FOUND' : 'NOT_EXACT'),
    metadataReadStatus: metadataReadStatus,
    contentReadStatus: contentReadStatus,
    metadataSizeExplicitlyObserved: boolStatusD7E3I_(metadataSizeExplicitlyObserved),
    contentBytesExplicitlyObserved: boolStatusD7E3I_(contentBytesExplicitlyObserved),
    metadataReadExplicitlySucceeded: boolStatusD7E3I_(metadataReadExplicitlySucceeded),
    contentReadExplicitlySucceeded: boolStatusD7E3I_(contentReadExplicitlySucceeded),
    readerFallbackPossible: boolStatusD7E3I_(readerFallbackPossible),
    structuredReadErrorPresent: boolStatusD7E3I_(structuredReadErrorPresent),
    metadataSize: metadataSize,
    blobByteLength: blobByteLength,
    mimeTypeStatus: input.mimeTypeStatus || normalizeD7E3IMimeStatus_(input.mimeType),
    permissionStatus: permissionStatus.status,
    permissionReasonCode: permissionStatus.reasonCode,
    safeErrorClass: permissionStatus.safeErrorClass,
    authorizationType: permissionStatus.authorizationType,
    resourceAccessStatus: permissionStatus.resourceAccessStatus,
    executionIdentityStatus: permissionStatus.executionIdentityStatus,
    providerChecksumStatus: input.providerChecksumStatus || 'UNAVAILABLE',
    contentSha256ComputationStatus: shaStatus,
    sourceHashMatch: sourceHashMatch,
    contentHashPrefix: hashPrefixD7E3I_(computedHash),
    failedReadNotHashedAsEmpty: contentReadExplicitlySucceeded && !readerFallbackSuspected ? 'NOT_APPLICABLE' : 'YES',
    readerEmptyFallbackSuspected: boolStatusD7E3I_(readerFallbackSuspected),
    snapshotFingerprint: safeFingerprintD7E3I_(input.snapshotFingerprint || {
      artifactType: upperType,
      candidateCount: candidateCount,
      metadataReadStatus: metadataReadStatus,
      contentReadStatus: contentReadStatus,
      metadataSize: metadataSize,
      blobByteLength: blobByteLength,
      sourceHashMatch: sourceHashMatch
    }),
    classification: classification
  });

  return {
    publicResult: publicResult,
    classification: classification,
    conflict: conflict,
    incomplete: incomplete,
    permissionStatus: permissionStatus,
    readerFallbackSuspected: readerFallbackSuspected,
    actualZeroByte: classification === 'ACTUAL_ZERO_BYTE_FILE',
    contentMismatch: classification === 'CONTENT_HASH_MISMATCH' || classification === 'METADATA_CONTENT_SIZE_MISMATCH',
    readCallCount: boundedCountD7E3I_(input.readCallCount, 1)
  };
}

function analyzeD7E3ISheetsEvidence_(raw, config, findings) {
  const input = raw || {};
  const permissionStatus = createD7E3IPermissionStatus_('SHEETS', input, input.status);
  const canonicalRowCount = numberD7E3I_(input.canonicalRowCount);
  const exactIdentityMatchCount = numberD7E3I_(input.exactIdentityMatchCount);
  const conflictingIdentityCount = numberD7E3I_(input.conflictingIdentityCount);
  const attribution = deriveD7E3ISheetAttribution_(input);
  const attributionStatus = attribution.attributionStatus;
  const contentStatus = input.contentStatus || 'MATCH';
  let classification = 'SHEET_FORENSICS_INCOMPLETE';
  let reasonCode = 'SHEET_FORENSICS_INCOMPLETE';
  let confidence = 'UNAVAILABLE';
  let conflict = false;
  let incomplete = false;

  if (isReadBlockedD7E3I_(input.status) || input.readBlocked) {
    classification = 'SHEET_READ_BLOCKED';
    reasonCode = 'SHEET_READ_BLOCKED';
    incomplete = true;
    addD7E3IReadIssueFinding_(findings, 'SHEETS', permissionStatus, { readStatus: input.status || 'READ_BLOCKED' });
  } else if (input.boundedOverflow || canonicalRowCount > D7_E3I_LIMITS_.SHEET_CANONICAL_ROW_LIMIT) {
    classification = 'SHEET_ROW_AMBIGUOUS';
    reasonCode = 'BOUNDED_QUERY_OVERFLOW';
    confidence = 'PROVEN';
    incomplete = true;
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'SHEETS', 'PROVEN', { canonicalRowCount: canonicalRowCount, boundedOverflow: boolStatusD7E3I_(input.boundedOverflow) });
  } else if (canonicalRowCount === 0) {
    classification = 'SHEET_ROW_ABSENT';
    reasonCode = 'SHEET_ROW_ABSENT';
    confidence = 'PROVEN';
    addD7E3IFinding_(findings, 'SHEET_CANONICAL_ROW_ABSENT', 'MEDIUM', 'SHEETS', 'PROVEN', { canonicalRowCount: canonicalRowCount });
  } else if (canonicalRowCount > 1) {
    classification = 'SHEET_ROW_AMBIGUOUS';
    reasonCode = 'SHEET_ROW_AMBIGUOUS';
    confidence = 'PROVEN';
    incomplete = true;
    addD7E3IFinding_(findings, 'SHEET_CANONICAL_ROW_AMBIGUOUS', 'BLOCKER', 'SHEETS', 'PROVEN', { canonicalRowCount: canonicalRowCount });
  } else if (conflictingIdentityCount > 0 || input.businessIdentityStatus === 'CONFLICT' || input.invoiceKeyStatus === 'CONFLICT' || input.hashIndexStatus === 'CONFLICT') {
    classification = 'SHEET_IDENTITY_CONFLICT';
    reasonCode = 'SHEET_IDENTITY_CONFLICT';
    confidence = 'PROVEN';
    conflict = true;
    addD7E3IFinding_(findings, 'SHEET_IDENTITY_CONFLICT', 'HIGH', 'SHEETS', 'PROVEN', { conflictingIdentityCount: conflictingIdentityCount });
  } else if (contentStatus === 'CONFLICT') {
    classification = 'SHEET_CONTENT_CONFLICT';
    reasonCode = 'SHEET_CONTENT_CONFLICT';
    confidence = 'PROVEN';
    conflict = true;
    addD7E3IFinding_(findings, 'SHEET_IDENTITY_CONFLICT', 'HIGH', 'SHEETS', 'PROVEN', { contentStatus: contentStatus });
  } else if (exactIdentityMatchCount === 1) {
    classification = 'SHEET_ROW_EXACT';
    reasonCode = 'SHEET_ROW_EXACT';
    confidence = 'PROVEN';
    addD7E3IFinding_(findings, 'SHEET_CANONICAL_ROW_EXACT', 'INFO', 'SHEETS', 'PROVEN', { exactIdentityMatchCount: exactIdentityMatchCount });
    if (attribution.conflictingAttributionEvidencePresent) {
      classification = 'SHEET_FORENSICS_INCOMPLETE';
      reasonCode = 'SHEET_ATTRIBUTION_CONFLICT';
      confidence = 'UNPROVEN';
      incomplete = true;
      addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'SHEETS', 'UNPROVEN', attribution.safeDetails);
    } else if (attributionStatus === 'ATTRIBUTION_PROVEN_D7_E') {
      addD7E3IFinding_(findings, 'SHEET_ATTRIBUTION_PROVEN_D7_E', 'INFO', 'SHEETS', 'PROVEN', attribution.safeDetails);
    } else if (attributionStatus === 'ATTRIBUTION_PROVEN_EXTERNAL') {
      addD7E3IFinding_(findings, 'SHEET_ATTRIBUTION_PROVEN_EXTERNAL', 'MEDIUM', 'SHEETS', 'PROVEN', attribution.safeDetails);
    } else {
      addD7E3IFinding_(findings, 'SHEET_ATTRIBUTION_UNPROVEN', 'MEDIUM', 'SHEETS', 'UNPROVEN', attribution.safeDetails);
    }
  } else {
    incomplete = true;
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'SHEETS', 'UNPROVEN', { exactIdentityMatchCount: exactIdentityMatchCount });
  }

  const publicResult = evidenceD7E3IClaim_(classification, confidence, input.evidenceSource || 'INJECTED_SHEETS_READ_ONLY_ADAPTER', reasonCode, {
    readerImplementation: input.readerImplementation || 'UNAVAILABLE',
    readAttempted: boolStatusD7E3I_(input.readAttempted !== false),
    exactTargetMatched: boolStatusD7E3I_(input.exactTargetMatched === true || input.exactTargetMatched === 'YES'),
    schemaValidationStatus: input.schemaValidationStatus || 'NOT_EVALUATED',
    permissionStatus: permissionStatus.status,
    permissionReasonCode: permissionStatus.reasonCode,
    safeErrorClass: permissionStatus.safeErrorClass,
    authorizationType: permissionStatus.authorizationType,
    resourceAccessStatus: permissionStatus.resourceAccessStatus,
    executionIdentityStatus: permissionStatus.executionIdentityStatus,
    canonicalRowCount: canonicalRowCount,
    exactIdentityMatchCount: exactIdentityMatchCount,
    conflictingIdentityCount: conflictingIdentityCount,
    rowNumberStatus: input.rowNumberStatus || 'SANITIZED_ROW_NUMBER_ONLY',
    safeRowNumbers: Array.isArray(input.safeRowNumbers) ? input.safeRowNumbers.map(numberD7E3I_) : [],
    rawValueFingerprint: safeFingerprintD7E3I_(input.rawValueFingerprint || input.rawValues),
    displayValueFingerprint: safeFingerprintD7E3I_(input.displayValueFingerprint || input.displayValues),
    formulaFingerprint: safeFingerprintD7E3I_(input.formulaFingerprint || input.formulas),
    businessIdentityStatus: input.businessIdentityStatus || (conflictingIdentityCount > 0 ? 'CONFLICT' : (exactIdentityMatchCount === 1 ? 'MATCH' : 'UNAVAILABLE')),
    invoiceKeyStatus: input.invoiceKeyStatus || 'UNAVAILABLE',
    hashIndexStatus: input.hashIndexStatus || 'UNAVAILABLE',
    sourceHashLinkStatus: input.sourceHashLinkStatus || 'UNAVAILABLE',
    rowMutationTimestampEvidence: input.rowMutationTimestampEvidence ? 'PRESENT_BUT_NOT_ATTRIBUTION_PROOF' : 'ABSENT_OR_NOT_USED',
    callerAttributionObservation: attribution.callerAttributionObservation,
    attributionStatus: attributionStatus,
    attributionEvidence: attribution.safeDetails,
    timestampOnlyAttributionProhibited: 'YES',
    labelOnlyAttributionProhibited: 'YES',
    classification: classification
  });

  return {
    publicResult: publicResult,
    classification: classification,
    conflict: conflict,
    incomplete: incomplete,
    permissionStatus: permissionStatus,
    rowExact: classification === 'SHEET_ROW_EXACT',
    attributionStatus: attributionStatus,
    attributionConflict: attribution.conflictingAttributionEvidencePresent,
    contentConflict: classification === 'SHEET_CONTENT_CONFLICT',
    identityConflict: classification === 'SHEET_IDENTITY_CONFLICT',
    readCallCount: boundedCountD7E3I_(input.readCallCount, 1)
  };
}

function deriveD7E3ISheetAttribution_(input) {
  const callerAttributionObservation = input.attributionStatus ? sanitizeD7E3IString_(input.attributionStatus) : 'ABSENT';
  const jobIdentityExact = input.jobIdentityExact === true || input.deterministicJobIdentityStatus === 'MATCH';
  const commitPlanSheetIdentityExact = input.commitPlanSheetIdentityExact === true || input.commitPlanSheetIdentityStatus === 'MATCH';
  const rowIdentityExact = input.rowIdentityExact === true || input.rowTransactionIdentityStatus === 'MATCH';
  const auditLinksExactRowIdentity = input.auditLinksExactRowIdentity === true || input.auditRowIdentityLinkStatus === 'MATCH';
  const attachmentRecordLinksExactRowIdentity = input.attachmentRecordLinksExactRowIdentity === true || input.transactionRecordLinksExactRowIdentity === true;
  const externalEvidenceLinksExactRowIdentity = input.externalEvidenceLinksExactRowIdentity === true || input.externalAttributionLinkStatus === 'MATCH';
  const externalActorEvidencePresent = input.externalActorEvidencePresent === true || input.externalActorEvidenceStatus === 'PROVEN';
  const conflictingAttributionEvidencePresent = input.conflictingAttributionEvidencePresent === true ||
    (externalEvidenceLinksExactRowIdentity && (auditLinksExactRowIdentity || attachmentRecordLinksExactRowIdentity));
  const durableD7ELinkageProven = jobIdentityExact &&
    commitPlanSheetIdentityExact &&
    rowIdentityExact &&
    (auditLinksExactRowIdentity || attachmentRecordLinksExactRowIdentity) &&
    !conflictingAttributionEvidencePresent;
  const durableExternalLinkageProven = externalEvidenceLinksExactRowIdentity &&
    externalActorEvidencePresent &&
    rowIdentityExact &&
    !durableD7ELinkageProven &&
    !conflictingAttributionEvidencePresent;

  let attributionStatus = 'ATTRIBUTION_UNPROVEN';
  let confidence = 'UNPROVEN';
  let reasonCode = 'DURABLE_LINKAGE_MISSING';
  if (conflictingAttributionEvidencePresent) {
    reasonCode = 'CONFLICTING_ATTRIBUTION_EVIDENCE';
  } else if (durableD7ELinkageProven) {
    attributionStatus = 'ATTRIBUTION_PROVEN_D7_E';
    confidence = 'PROVEN';
    reasonCode = 'DURABLE_D7_E_ROW_LINKAGE_PROVEN';
  } else if (durableExternalLinkageProven) {
    attributionStatus = 'ATTRIBUTION_PROVEN_EXTERNAL';
    confidence = 'PROVEN';
    reasonCode = 'DURABLE_EXTERNAL_ROW_LINKAGE_PROVEN';
  }

  const safeDetails = {
    attributionStatus: attributionStatus,
    confidence: confidence,
    reasonCode: reasonCode,
    callerAttributionObservation: callerAttributionObservation,
    labelOnlyAttributionProhibited: 'YES',
    timestampOnlyAttributionProhibited: 'YES',
    rowExistenceAttributionProhibited: 'YES',
    matchingBusinessIdentityAloneProhibited: 'YES',
    invoiceKeyHashIndexAloneProhibited: 'YES',
    jobIdentityExact: boolStatusD7E3I_(jobIdentityExact),
    commitPlanSheetIdentityExact: boolStatusD7E3I_(commitPlanSheetIdentityExact),
    rowIdentityExact: boolStatusD7E3I_(rowIdentityExact),
    auditLinksExactRowIdentity: boolStatusD7E3I_(auditLinksExactRowIdentity),
    attachmentRecordLinksExactRowIdentity: boolStatusD7E3I_(attachmentRecordLinksExactRowIdentity),
    externalEvidenceLinksExactRowIdentity: boolStatusD7E3I_(externalEvidenceLinksExactRowIdentity),
    externalActorEvidencePresent: boolStatusD7E3I_(externalActorEvidencePresent),
    conflictingAttributionEvidencePresent: boolStatusD7E3I_(conflictingAttributionEvidencePresent)
  };

  return {
    attributionStatus: attributionStatus,
    confidence: confidence,
    reasonCode: reasonCode,
    callerAttributionObservation: callerAttributionObservation,
    conflictingAttributionEvidencePresent: conflictingAttributionEvidencePresent,
    safeDetails: sanitizeD7E3IObject_(safeDetails)
  };
}

function analyzeD7E3IFirestoreEvidence_(raw, config, findings) {
  const input = raw || {};
  const permissionStatus = createD7E3IPermissionStatus_('FIRESTORE', input, input.status);
  const attachmentRecordCount = numberD7E3I_(input.attachmentRecordCount);
  const auditEventCount = numberD7E3I_(input.auditEventCount);
  const jobState = input.jobState || 'UNAVAILABLE';
  const jobIdentityExact = input.jobIdentityStatus === 'MATCH';
  const commitPlanExact = input.commitPlanStatus === 'MATCH' && input.commitPlanIdentityStatus === 'MATCH';
  const expectedDriveIdentitiesExact = input.expectedDriveIdentitiesStatus === 'MATCH';
  const expectedSheetTransactionIdentityExact = input.expectedSheetTransactionIdentityStatus === 'MATCH';
  let classification = 'FIRESTORE_FORENSICS_INCOMPLETE';
  let reasonCode = 'FIRESTORE_FORENSICS_INCOMPLETE';
  let confidence = 'UNAVAILABLE';
  let conflict = false;
  let incomplete = false;

  if (isReadBlockedD7E3I_(input.status) || input.readBlocked) {
    classification = 'FIRESTORE_READ_BLOCKED';
    reasonCode = 'FIRESTORE_READ_BLOCKED';
    incomplete = true;
    addD7E3IReadIssueFinding_(findings, 'FIRESTORE', permissionStatus, { readStatus: input.status || 'READ_BLOCKED' });
  } else if (input.boundedOverflow) {
    classification = 'FIRESTORE_FORENSICS_INCOMPLETE';
    reasonCode = 'BOUNDED_QUERY_OVERFLOW';
    confidence = 'PROVEN';
    incomplete = true;
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'FIRESTORE', 'PROVEN', { boundedOverflow: 'YES' });
  } else if (!input.jobExists) {
    classification = 'FIRESTORE_JOB_ABSENT';
    reasonCode = 'FIRESTORE_JOB_ABSENT';
    confidence = 'PROVEN';
  } else if (input.jobIdentityStatus === 'CONFLICT') {
    classification = 'FIRESTORE_JOB_IDENTITY_CONFLICT';
    reasonCode = 'FIRESTORE_JOB_IDENTITY_CONFLICT';
    confidence = 'PROVEN';
    conflict = true;
    addD7E3IFinding_(findings, 'FIRESTORE_JOB_IDENTITY_CONFLICT', 'HIGH', 'FIRESTORE', 'PROVEN', { jobIdentityStatus: 'CONFLICT' });
  } else if (input.commitPlanStatus === 'CONFLICT' || input.commitPlanIdentityStatus === 'CONFLICT') {
    classification = 'FIRESTORE_COMMIT_PLAN_CONFLICT';
    reasonCode = 'FIRESTORE_COMMIT_PLAN_CONFLICT';
    confidence = 'PROVEN';
    conflict = true;
    addD7E3IFinding_(findings, 'FIRESTORE_COMMIT_PLAN_CONFLICT', 'HIGH', 'FIRESTORE', 'PROVEN', { commitPlanStatus: input.commitPlanStatus || 'CONFLICT' });
  } else if (input.reconciliationReportStatus === 'CONFLICT') {
    classification = 'FIRESTORE_RECONCILIATION_CONFLICT';
    reasonCode = 'FIRESTORE_RECONCILIATION_CONFLICT';
    confidence = 'PROVEN';
    conflict = true;
    addD7E3IFinding_(findings, 'FIRESTORE_RECONCILIATION_CONFLICT', 'HIGH', 'FIRESTORE', 'PROVEN', { reconciliationReportStatus: 'CONFLICT' });
  } else if (input.leaseStatus === 'CONFLICT') {
    classification = 'FIRESTORE_LEASE_CONFLICT';
    reasonCode = 'FIRESTORE_LEASE_CONFLICT';
    confidence = 'PROVEN';
    conflict = true;
  } else if (jobState === 'VALIDATED') {
    classification = 'FIRESTORE_JOB_STATE_CONFLICT';
    reasonCode = 'FIRESTORE_JOB_VALIDATED_NOT_COMPLETED';
    confidence = 'PROVEN';
    addD7E3IFinding_(findings, 'FIRESTORE_JOB_VALIDATED_NOT_COMPLETED', 'MEDIUM', 'FIRESTORE', 'PROVEN', { jobState: 'VALIDATED' });
  } else if (jobState === 'COMPLETED' && jobIdentityExact && commitPlanExact && expectedDriveIdentitiesExact && expectedSheetTransactionIdentityExact && (input.reconciliationReportStatus === 'CONSISTENT' || input.reconciliationReportStatus === 'MATCH')) {
    classification = 'FIRESTORE_STATE_CONSISTENT';
    reasonCode = 'FIRESTORE_STATE_CONSISTENT';
    confidence = 'PROVEN';
    addD7E3IFinding_(findings, 'FIRESTORE_JOB_COMPLETED', 'INFO', 'FIRESTORE', 'PROVEN', { jobState: 'COMPLETED', attachmentRecordCount: attachmentRecordCount, auditEventCount: auditEventCount });
  } else if (input.commitPlanStatus === 'ABSENT') {
    classification = 'FIRESTORE_COMMIT_PLAN_ABSENT';
    reasonCode = 'FIRESTORE_COMMIT_PLAN_ABSENT';
    confidence = 'PROVEN';
  } else if (attachmentRecordCount === 0 && input.requireAttachmentEvidence) {
    classification = 'FIRESTORE_ATTACHMENT_EVIDENCE_ABSENT';
    reasonCode = 'FIRESTORE_ATTACHMENT_EVIDENCE_ABSENT';
    confidence = 'PROVEN';
  } else if (auditEventCount === 0 && input.requireAuditEvidence) {
    classification = 'FIRESTORE_AUDIT_EVIDENCE_ABSENT';
    reasonCode = 'FIRESTORE_AUDIT_EVIDENCE_ABSENT';
    confidence = 'PROVEN';
    addD7E3IFinding_(findings, 'FIRESTORE_AUDIT_ATTRIBUTION_MISSING', 'MEDIUM', 'FIRESTORE', 'UNPROVEN', { auditEventCount: auditEventCount });
  } else {
    classification = 'FIRESTORE_FORENSICS_INCOMPLETE';
    reasonCode = 'FIRESTORE_FORENSICS_INCOMPLETE';
    incomplete = true;
  }

  if (input.writeOutcomeEvidenceStatus === 'UNKNOWN_WRITE_OUTCOME_PRESENT') {
    addD7E3IFinding_(findings, 'UNKNOWN_WRITE_OUTCOME_EVIDENCE_PRESENT', 'MEDIUM', 'FIRESTORE', 'SUPPORTED', { writeOutcomeEvidenceStatus: input.writeOutcomeEvidenceStatus });
  }
  if (input.confirmedMutationEvidence || input.writeOutcomeEvidenceStatus === 'CONFIRMED_D7_E_MUTATION') {
    addD7E3IFinding_(findings, 'CONFIRMED_D7_E_MUTATION_EVIDENCE_PRESENT', 'MEDIUM', 'FIRESTORE', 'PROVEN', { confirmedMutationEvidence: 'YES' });
  }
  if (input.auditAttributionStatus === 'MISSING') {
    addD7E3IFinding_(findings, 'FIRESTORE_AUDIT_ATTRIBUTION_MISSING', 'MEDIUM', 'FIRESTORE', 'UNPROVEN', { auditAttributionStatus: 'MISSING' });
  }

  const publicResult = evidenceD7E3IClaim_(classification, confidence, input.evidenceSource || 'INJECTED_FIRESTORE_READ_ONLY_ADAPTER', reasonCode, {
    readerImplementation: input.readerImplementation || 'UNAVAILABLE',
    readAttempted: boolStatusD7E3I_(input.readAttempted !== false),
    exactTargetMatched: boolStatusD7E3I_(input.exactTargetMatched === true || input.exactTargetMatched === 'YES'),
    exactPathContract: 'YES',
    permissionStatus: permissionStatus.status,
    permissionReasonCode: permissionStatus.reasonCode,
    safeErrorClass: permissionStatus.safeErrorClass,
    authorizationType: permissionStatus.authorizationType,
    resourceAccessStatus: permissionStatus.resourceAccessStatus,
    executionIdentityStatus: permissionStatus.executionIdentityStatus,
    jobExists: boolStatusD7E3I_(input.jobExists),
    jobIdentityStatus: input.jobIdentityStatus || 'UNAVAILABLE',
    jobIdentityExact: boolStatusD7E3I_(jobIdentityExact),
    jobState: jobState,
    jobVersionStatus: input.jobVersionStatus || 'UNAVAILABLE',
    jobUpdateTimeStatus: input.jobUpdateTimeStatus || 'UNAVAILABLE',
    commitPlanStatus: input.commitPlanStatus || 'UNAVAILABLE',
    commitPlanIdentityStatus: input.commitPlanIdentityStatus || 'UNAVAILABLE',
    commitPlanExact: boolStatusD7E3I_(commitPlanExact),
    expectedDriveIdentitiesStatus: input.expectedDriveIdentitiesStatus || 'UNAVAILABLE',
    expectedSheetTransactionIdentityStatus: input.expectedSheetTransactionIdentityStatus || 'UNAVAILABLE',
    expectedDriveIdentitiesExact: boolStatusD7E3I_(expectedDriveIdentitiesExact),
    expectedSheetTransactionIdentityExact: boolStatusD7E3I_(expectedSheetTransactionIdentityExact),
    attachmentRecordCount: attachmentRecordCount,
    auditEventCount: auditEventCount,
    leaseStatus: input.leaseStatus || 'UNAVAILABLE',
    reconciliationReportStatus: input.reconciliationReportStatus || 'UNAVAILABLE',
    reconciliationFindingCodes: sanitizeFindingCodesD7E3I_(input.reconciliationFindingCodes || []),
    reconciliationRequiredState: input.reconciliationRequiredState || 'UNAVAILABLE',
    idempotencyEvidenceStatus: input.idempotencyEvidenceStatus || 'UNAVAILABLE',
    writeOutcomeEvidenceStatus: input.writeOutcomeEvidenceStatus || 'UNAVAILABLE',
    snapshotFingerprint: safeFingerprintD7E3I_(input.snapshotFingerprint || {
      jobExists: boolStatusD7E3I_(input.jobExists),
      jobState: jobState,
      jobVersionStatus: input.jobVersionStatus || 'UNAVAILABLE',
      commitPlanStatus: input.commitPlanStatus || 'UNAVAILABLE',
      reconciliationReportStatus: input.reconciliationReportStatus || 'UNAVAILABLE',
      attachmentRecordCount: attachmentRecordCount,
      auditEventCount: auditEventCount
    }),
    classification: classification
  });

  return {
    publicResult: publicResult,
    classification: classification,
    conflict: conflict,
    incomplete: incomplete,
    permissionStatus: permissionStatus,
    jobState: jobState,
    jobCompleted: classification === 'FIRESTORE_STATE_CONSISTENT',
    jobIdentityExact: jobIdentityExact,
    commitPlanExact: commitPlanExact,
    expectedDriveIdentitiesExact: expectedDriveIdentitiesExact,
    expectedSheetTransactionIdentityExact: expectedSheetTransactionIdentityExact,
    jobAbsent: classification === 'FIRESTORE_JOB_ABSENT',
    auditAttributionMissing: hasD7E3IFinding_(findings, 'FIRESTORE_AUDIT_ATTRIBUTION_MISSING'),
    unknownWriteOutcome: input.writeOutcomeEvidenceStatus === 'UNKNOWN_WRITE_OUTCOME_PRESENT',
    confirmedD7EMutation: !!input.confirmedMutationEvidence || input.writeOutcomeEvidenceStatus === 'CONFIRMED_D7_E_MUTATION',
    readCallCount: boundedCountD7E3I_(input.readCallCount, 1)
  };
}

function normalizeD7E3ISnapshot_(raw, stage) {
  const input = raw || {};
  const status = input.status || (input.fingerprint || input.fingerprints ? 'SNAPSHOT_CAPTURED' : 'SNAPSHOT_UNAVAILABLE');
  const confidence = input.confidence || (status === 'SNAPSHOT_CAPTURED' ? 'SUPPORTED' : 'UNAVAILABLE');
  const fingerprint = safeFingerprintD7E3I_(input.fingerprint || input.fingerprints || input);
  return {
    fingerprint: status === 'SNAPSHOT_CAPTURED' ? fingerprint : '',
    status: status,
    publicResult: evidenceD7E3IClaim_(status, confidence, input.evidenceSource || 'INJECTED_SNAPSHOT_READ_ONLY_ADAPTER', input.reasonCode || status, {
      stage: stage,
      gmailFingerprintStatus: fingerprint ? 'CAPTURED' : 'UNAVAILABLE',
      driveXmlFingerprintStatus: fingerprint ? 'CAPTURED' : 'UNAVAILABLE',
      drivePdfFingerprintStatus: fingerprint ? 'CAPTURED' : 'UNAVAILABLE',
      sheetCanonicalRowFingerprintStatus: fingerprint ? 'CAPTURED' : 'UNAVAILABLE',
      firestoreJobFingerprintStatus: fingerprint ? 'CAPTURED' : 'UNAVAILABLE',
      leaseFingerprintStatus: fingerprint ? 'CAPTURED' : 'UNAVAILABLE',
      reconciliationReportFingerprintStatus: fingerprint ? 'CAPTURED' : 'UNAVAILABLE',
      snapshotFingerprint: fingerprint
    })
  };
}

function compareD7E3ISnapshots_(beforeSnapshot, afterSnapshot, findings) {
  const beforeOk = beforeSnapshot && beforeSnapshot.status === 'SNAPSHOT_CAPTURED' && beforeSnapshot.fingerprint;
  const afterOk = afterSnapshot && afterSnapshot.status === 'SNAPSHOT_CAPTURED' && afterSnapshot.fingerprint;
  let status = 'CONCURRENT_CHANGE_CHECK_INCOMPLETE';
  let confidence = 'UNAVAILABLE';
  let reasonCode = 'SNAPSHOT_INCOMPLETE';
  let concurrentChange = false;

  if (beforeOk && afterOk && beforeSnapshot.fingerprint === afterSnapshot.fingerprint) {
    status = 'NO_CONCURRENT_CHANGE_DETECTED';
    confidence = 'PROVEN';
    reasonCode = 'BEFORE_AFTER_SNAPSHOT_MATCH';
  } else if (beforeOk && afterOk) {
    status = 'CONCURRENT_CHANGE_DETECTED';
    confidence = 'PROVEN';
    reasonCode = 'BEFORE_AFTER_SNAPSHOT_MISMATCH';
    concurrentChange = true;
    addD7E3IFinding_(findings, 'CONCURRENT_STATE_CHANGE', 'BLOCKER', 'CROSS_SYSTEM', 'PROVEN', {
      beforeAfterSnapshotMatch: 'NO'
    });
  } else {
    addD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE', 'BLOCKER', 'CROSS_SYSTEM', 'UNAVAILABLE', {
      beforeSnapshotStatus: beforeSnapshot ? beforeSnapshot.status : 'UNAVAILABLE',
      afterSnapshotStatus: afterSnapshot ? afterSnapshot.status : 'UNAVAILABLE'
    });
  }

  return {
    publicResult: evidenceD7E3IClaim_(status, confidence, 'BEFORE_AFTER_SNAPSHOT_COMPARISON', reasonCode, {
      beforeAfterSnapshotMatch: boolStatusD7E3I_(beforeOk && afterOk && beforeSnapshot.fingerprint === afterSnapshot.fingerprint),
      concurrentChangeDetected: boolStatusD7E3I_(concurrentChange)
    }),
    status: status,
    incomplete: status === 'CONCURRENT_CHANGE_CHECK_INCOMPLETE',
    concurrentChange: concurrentChange
  };
}

function classifyD7E3IPrimary_(analysis, findings) {
  const systemsWithConflict = {};
  for (const finding of findings) {
    if (finding.code.indexOf('CONFLICT') !== -1 || finding.code.indexOf('MISMATCH') !== -1 || finding.code.indexOf('ACTUAL_ZERO_BYTE') !== -1) {
      systemsWithConflict[finding.system] = true;
    }
  }
  const conflictSystemCount = Object.keys(systemsWithConflict).length;
  const hasIncomplete = analysis.configuration.blocked ||
    analysis.gmail.incomplete ||
    analysis.driveXml.incomplete ||
    analysis.drivePdf.incomplete ||
    analysis.sheets.incomplete ||
    analysis.firestore.incomplete ||
    analysis.concurrency.incomplete ||
    analysis.concurrency.concurrentChange ||
    hasD7E3IFinding_(findings, 'FORENSIC_READ_PERMISSION_BLOCKER') ||
    hasD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE') ||
    hasD7E3IFinding_(findings, 'DRIVE_DUPLICATE_AMBIGUITY') ||
    hasD7E3IFinding_(findings, 'SHEET_CANONICAL_ROW_AMBIGUOUS');

  if (hasIncomplete) return 'FORENSICS_INCOMPLETE';
  if (conflictSystemCount >= 2) return 'MULTI_SYSTEM_CONFLICT';
  if (analysis.driveXml.conflict || analysis.drivePdf.conflict) return 'DRIVE_CONTENT_CONFLICT';
  if (analysis.sheets.identityConflict || analysis.sheets.contentConflict) return 'SHEET_IDENTITY_CONFLICT';
  if (analysis.firestore.conflict || analysis.firestore.classification === 'FIRESTORE_JOB_STATE_CONFLICT') return 'FIRESTORE_STATE_CONFLICT';
  if (analysis.sheets.attributionStatus === 'ATTRIBUTION_PROVEN_EXTERNAL') return 'EXTERNAL_USER_CREATED_STATE';
  if (analysis.firestore.unknownWriteOutcome || analysis.sheets.attributionStatus === 'ATTRIBUTION_UNPROVEN') return 'PARTIAL_UNKNOWN_OUTCOME';
  if (analysis.firestore.confirmedD7EMutation && !allD7E3ICompleteAndConsistent_(analysis)) return 'PARTIAL_CONFIRMED_MUTATION';
  if (allD7E3ICompleteAndConsistent_(analysis)) return 'CONSISTENT_ALREADY_COMPLETED';
  return 'PARTIAL_UNKNOWN_OUTCOME';
}

function allD7E3ICompleteAndConsistent_(analysis) {
  return analysis.gmail.classification === 'GMAIL_CANDIDATE_EXACT' &&
    analysis.driveXml.classification === 'CONTENT_HASH_MATCH' &&
    analysis.drivePdf.classification === 'CONTENT_HASH_MATCH' &&
    analysis.sheets.classification === 'SHEET_ROW_EXACT' &&
    analysis.sheets.attributionStatus === 'ATTRIBUTION_PROVEN_D7_E' &&
    !analysis.sheets.attributionConflict &&
    analysis.firestore.jobCompleted &&
    analysis.firestore.jobIdentityExact &&
    analysis.firestore.commitPlanExact &&
    analysis.firestore.expectedDriveIdentitiesExact &&
    analysis.firestore.expectedSheetTransactionIdentityExact &&
    analysis.concurrency.status === 'NO_CONCURRENT_CHANGE_DETECTED';
}

function buildD7E3IReconciliationPlan_(primaryClassification, findings, analysis) {
  let planType = 'OWNER_MANUAL_REVIEW_REQUIRED';
  const reasonCodes = findings.map(function mapCode(finding) { return finding.code; });
  if (analysis.firestore.auditAttributionMissing && analysis.sheets.rowExact && (analysis.driveXml.classification === 'CONTENT_HASH_MATCH' && analysis.drivePdf.classification === 'CONTENT_HASH_MATCH')) {
    planType = 'POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED';
  } else if (primaryClassification === 'CONSISTENT_ALREADY_COMPLETED') {
    planType = 'NO_ACTION_REQUIRED';
  } else if (analysis.concurrency.concurrentChange || hasD7E3IFinding_(findings, 'FORENSIC_READ_PERMISSION_BLOCKER') || hasD7E3IFinding_(findings, 'FORENSIC_EVIDENCE_INCOMPLETE')) {
    planType = 'FRESH_READ_ONLY_RERUN_REQUIRED';
  } else if (analysis.driveXml.readerFallbackSuspected || analysis.drivePdf.readerFallbackSuspected) {
    planType = 'READBACK_READER_FIX_REQUIRED';
  } else if (analysis.driveXml.actualZeroByte || analysis.drivePdf.actualZeroByte || analysis.driveXml.contentMismatch || analysis.drivePdf.contentMismatch) {
    planType = 'BOUNDED_DRIVE_REPLACEMENT_REVIEW_REQUIRED';
  } else if (analysis.sheets.identityConflict || analysis.sheets.contentConflict) {
    planType = 'BOUNDED_SHEET_REPAIR_REVIEW_REQUIRED';
  } else if (primaryClassification === 'FIRESTORE_STATE_CONFLICT') {
    planType = 'FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED';
  }

  return sanitizeD7E3IObject_({
    planType: planType,
    reasonCodes: sanitizeFindingCodesD7E3I_(reasonCodes),
    evidenceRequiredBeforeAction: evidenceRequiredForPlanD7E3I_(planType),
    exactScope: {
      deterministicCandidateOnly: 'YES',
      noBroadQuery: 'YES',
      noFirstResultSelection: 'YES',
      noAutomaticRetry: 'YES'
    },
    prohibitedActions: [
      'GMAIL_MUTATION',
      'DRIVE_CREATE_UPDATE_MOVE_TRASH_DELETE',
      'SHEETS_APPEND_UPDATE_CLEAR_FORMAT',
      'FIRESTORE_CREATE_UPDATE_PATCH_TRANSITION_LEASE_AUDIT_WRITE',
      'TRIGGER_MUTATION',
      'REPAIR_EXECUTION',
      'POST_HOC_RECONCILIATION_WRITE',
      'DEPLOYMENT'
    ],
    ownerApprovalRequired: planType === 'NO_ACTION_REQUIRED' ? 'NO' : 'YES',
    recommendedNextPhase: recommendedNextPhaseD7E3I_(planType),
    automaticExecutionAllowed: 'NO'
  });
}

function evidenceRequiredForPlanD7E3I_(planType) {
  const requirements = {
    NO_ACTION_REQUIRED: ['NONE'],
    READBACK_READER_FIX_REQUIRED: ['FIX_READBACK_READER', 'RERUN_READ_ONLY_DRIVE_CONTENT_PROOF'],
    POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED: ['OWNER_REVIEW_DURABLE_ATTRIBUTION_GAP', 'SEPARATE_WRITE_APPROVAL'],
    FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED: ['PROVE_EXTERNAL_ARTIFACTS_AND_SHEET_EXACT', 'OWNER_FIRESTORE_RECONCILIATION_APPROVAL'],
    BOUNDED_DRIVE_REPLACEMENT_REVIEW_REQUIRED: ['PROVE_ACTUAL_ZERO_BYTE_OR_HASH_MISMATCH', 'SEPARATE_DRIVE_REPLACEMENT_APPROVAL'],
    BOUNDED_SHEET_REPAIR_REVIEW_REQUIRED: ['PROVE_EXACT_ROW_IDENTITY_OR_CONTENT_CONFLICT', 'SEPARATE_SHEET_REPAIR_APPROVAL'],
    OWNER_MANUAL_REVIEW_REQUIRED: ['OWNER_REVIEW_CONFLICT_OR_UNKNOWN_OUTCOME'],
    FRESH_READ_ONLY_RERUN_REQUIRED: ['WAIT_FOR_STABLE_STATE', 'RERUN_READ_ONLY_FORENSICS']
  };
  return requirements[planType] || requirements.OWNER_MANUAL_REVIEW_REQUIRED;
}

function recommendedNextPhaseD7E3I_(planType) {
  const phases = {
    NO_ACTION_REQUIRED: 'OWNER_CLOSEOUT_REVIEW',
    READBACK_READER_FIX_REQUIRED: 'D7_E3I_READBACK_READER_FIX_REVIEW',
    POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED: 'D7_E3I_POST_HOC_RECONCILIATION_EVENT_OWNER_REVIEW',
    FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED: 'D7_E3I_FIRESTORE_STATE_RECONCILIATION_OWNER_REVIEW',
    BOUNDED_DRIVE_REPLACEMENT_REVIEW_REQUIRED: 'D7_E3I_BOUNDED_DRIVE_REPLACEMENT_OWNER_REVIEW',
    BOUNDED_SHEET_REPAIR_REVIEW_REQUIRED: 'D7_E3I_BOUNDED_SHEET_REPAIR_OWNER_REVIEW',
    OWNER_MANUAL_REVIEW_REQUIRED: 'D7_E3I_OWNER_MANUAL_REVIEW',
    FRESH_READ_ONLY_RERUN_REQUIRED: 'D7_E3I_FRESH_READ_ONLY_RERUN_REVIEW'
  };
  return phases[planType] || phases.OWNER_MANUAL_REVIEW_REQUIRED;
}

function createD7E3ISafetyCounts_(analysis) {
  return {
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    REPAIR_OPERATION_COUNT: 0,
    RECONCILIATION_WRITE_COUNT: 0,
    PRODUCTION_MUTATION_COUNT: 0,
    READ_ONLY_GMAIL_CALL_COUNT: boundedCountD7E3I_(analysis.gmail.readCallCount, 0),
    READ_ONLY_DRIVE_CALL_COUNT: boundedCountD7E3I_(analysis.driveXml.readCallCount, 0) + boundedCountD7E3I_(analysis.drivePdf.readCallCount, 0),
    READ_ONLY_SHEETS_CALL_COUNT: boundedCountD7E3I_(analysis.sheets.readCallCount, 0),
    READ_ONLY_FIRESTORE_CALL_COUNT: boundedCountD7E3I_(analysis.firestore.readCallCount, 0),
    READ_CALLS_WITHIN_MAXIMA: boolStatusD7E3I_(
      boundedCountD7E3I_(analysis.gmail.readCallCount, 0) <= D7_E3I_LIMITS_.GMAIL_MESSAGE_LIMIT &&
      boundedCountD7E3I_(analysis.driveXml.readCallCount, 0) <= D7_E3I_LIMITS_.DRIVE_FILE_LIMIT_PER_ARTIFACT &&
      boundedCountD7E3I_(analysis.drivePdf.readCallCount, 0) <= D7_E3I_LIMITS_.DRIVE_FILE_LIMIT_PER_ARTIFACT &&
      boundedCountD7E3I_(analysis.sheets.readCallCount, 0) <= D7_E3I_LIMITS_.SHEET_CANONICAL_ROW_LIMIT &&
      boundedCountD7E3I_(analysis.firestore.readCallCount, 0) <= 5
    )
  };
}

function finalD7E3IStatus_(primaryClassification, findings) {
  if (primaryClassification === 'CONSISTENT_ALREADY_COMPLETED') return 'PASS_D7_E3I_CONSISTENT_ALREADY_COMPLETED_READ_ONLY';
  if (hasD7E3IFinding_(findings, 'FORENSIC_READ_PERMISSION_BLOCKER')) return 'BLOCKED_D7_E3I_FORENSIC_READ_PERMISSION';
  if (primaryClassification === 'FORENSICS_INCOMPLETE') return 'BLOCKED_D7_E3I_FORENSICS_INCOMPLETE';
  return 'REVIEW_REQUIRED_D7_E3I_' + primaryClassification;
}

function createD7E3IPermissionDiagnostics_(analysis) {
  return sanitizeD7E3IObject_({
    GMAIL_PERMISSION_STATUS: publicD7E3IPermissionStatus_(analysis.gmail.permissionStatus),
    DRIVE_XML_PERMISSION_STATUS: publicD7E3IPermissionStatus_(analysis.driveXml.permissionStatus),
    DRIVE_PDF_PERMISSION_STATUS: publicD7E3IPermissionStatus_(analysis.drivePdf.permissionStatus),
    SHEETS_PERMISSION_STATUS: publicD7E3IPermissionStatus_(analysis.sheets.permissionStatus),
    FIRESTORE_PERMISSION_STATUS: publicD7E3IPermissionStatus_(analysis.firestore.permissionStatus),
    MINIMUM_SCOPE_MATRIX: D7_E3I_MINIMUM_SCOPE_MATRIX_,
    BROAD_SCOPE_ADDITION_REQUIRED: 'NO',
    CLOUD_PLATFORM_SCOPE_REQUIRED: 'NO',
    PRODUCTION_PERMISSION_PROBE_EXECUTED: productionD7E3IPermissionProbeExecuted_(analysis) ? 'YES' : 'NO'
  });
}

function createD7E3IReaderDiagnostics_(analysis) {
  return sanitizeD7E3IObject_({
    GMAIL_READER_IMPLEMENTATION: readerImplementationD7E3I_(analysis.gmail),
    DRIVE_XML_READER_IMPLEMENTATION: readerImplementationD7E3I_(analysis.driveXml),
    DRIVE_PDF_READER_IMPLEMENTATION: readerImplementationD7E3I_(analysis.drivePdf),
    SHEETS_READER_IMPLEMENTATION: readerImplementationD7E3I_(analysis.sheets),
    FIRESTORE_READER_IMPLEMENTATION: readerImplementationD7E3I_(analysis.firestore),
    PLACEHOLDER_PRODUCTION_PATH_DISABLED: productionD7E3IPermissionProbeExecuted_(analysis) ? 'YES' : 'NO',
    REAL_ADAPTER_INVOCATION_PROVEN: productionD7E3IPermissionProbeExecuted_(analysis) ? 'YES' : 'NO'
  });
}

function readerImplementationD7E3I_(analysisPart) {
  const details = analysisPart && analysisPart.publicResult && analysisPart.publicResult.safeDetails || {};
  return details.readerImplementation || details.READER_IMPLEMENTATION || 'UNAVAILABLE';
}

function productionD7E3IPermissionProbeExecuted_(analysis) {
  return ['gmail', 'driveXml', 'drivePdf', 'sheets', 'firestore'].every(function realReader(key) {
    return readerImplementationD7E3I_(analysis && analysis[key]) === 'REAL_BOUNDED_READ_ONLY';
  });
}

function publicD7E3IPermissionStatus_(permissionStatus) {
  const safe = permissionStatus || createD7E3IPermissionStatus_('UNKNOWN', {}, 'UNKNOWN_READ_BLOCKER');
  return {
    status: safe.status,
    reasonCode: safe.reasonCode,
    safeErrorClass: safe.safeErrorClass,
    authorizationType: safe.authorizationType,
    resourceAccessStatus: safe.resourceAccessStatus,
    executionIdentityStatus: safe.executionIdentityStatus
  };
}

function createD7E3IPermissionStatus_(channel, input, readStatus) {
  const safeChannel = sanitizeFindingCodesD7E3I_([channel || 'UNKNOWN'])[0] || 'UNKNOWN';
  const reasonCode = normalizeD7E3IPermissionReason_(safeChannel, input || {}, readStatus);
  return {
    status: statusForD7E3IPermissionReason_(reasonCode),
    reasonCode: reasonCode,
    safeErrorClass: safeErrorClassForD7E3IPermissionReason_(reasonCode),
    authorizationType: normalizeD7E3IAuthorizationType_(safeChannel, input && input.authorizationType),
    resourceAccessStatus: normalizeD7E3IResourceAccessStatus_(reasonCode, input && input.resourceAccessStatus),
    executionIdentityStatus: normalizeD7E3IExecutionIdentityStatus_(reasonCode, input && input.executionIdentityStatus)
  };
}

function normalizeD7E3IPermissionReason_(channel, input, readStatus) {
  const candidateValues = [
    input.permissionReasonCode,
    input.permissionStatus && input.permissionStatus.reasonCode,
    input.permissionStatus,
    input.safeErrorClass,
    input.reasonCode,
    input.errorCode,
    input.readErrorCode,
    input.metadataReadErrorCode,
    input.contentReadErrorCode,
    input.metadataReadStatus,
    input.contentReadStatus,
    readStatus,
    input.status
  ];
  const text = sanitizeFindingCodesD7E3I_(candidateValues).join('_');
  const isFirestore = String(channel || '').indexOf('FIRESTORE') !== -1;
  if (!text || text === 'READ_OK' || text === 'OK') return D7_E3I_PERMISSION_REASON_CODES_.READ_OK;
  if (/NOT_FOUND|NO_SUCH|ABSENT|HTTP_?404/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.RESOURCE_NOT_FOUND;
  if (/PROJECT.*MISMATCH|DATABASE.*MISMATCH|WRONG_PROJECT|WRONG_DATABASE|PROJECT_OR_DATABASE/.test(text)) {
    return D7_E3I_PERMISSION_REASON_CODES_.FIRESTORE_PROJECT_OR_DATABASE_MISMATCH;
  }
  if (/REAUTH|AUTHORIZATION_REQUIRED|CONSENT_REQUIRED/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.OAUTH_REAUTHORIZATION_REQUIRED;
  if (/OAUTH|SCOPE|TOKEN_SCOPE|INSUFFICIENT_SCOPE/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.OAUTH_SCOPE_MISSING;
  if (/INVALID|MALFORMED|BAD_REQUEST|BAD_REFERENCE|REFERENCE/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.INVALID_EXACT_RESOURCE_REFERENCE;
  if (/ROW_IDENTITY/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.ROW_IDENTITY_MISMATCH;
  if (/MESSAGE_IDENTITY/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.MESSAGE_IDENTITY_MISMATCH;
  if (/DOCUMENT_IDENTITY/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.DOCUMENT_IDENTITY_MISMATCH;
  if (/IDENTITY|PRINCIPAL|ACCOUNT_MISMATCH|USER_MISMATCH|EXECUTION_USER/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.EXECUTION_IDENTITY_MISMATCH;
  if (/TRANSPORT|TIMEOUT|NETWORK|FETCH|HTTP_?5\d\d/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.TRANSPORT_FAILED;
  if (/CONTENT_READ_FAILED|CONTENT_FAILED/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.CONTENT_READ_FAILED;
  if (/METADATA_READ_FAILED|METADATA_FAILED/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.METADATA_READ_FAILED;
  if (/DEFAULT_READER_NOT_CONFIGURED|NO_DEFAULT_PRODUCTION_READER|ADAPTER|NOT_CONFIGURED/.test(text)) {
    return D7_E3I_PERMISSION_REASON_CODES_.ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE;
  }
  if (isFirestore && /PERMISSION|DENIED|FORBIDDEN|HTTP_?403|AUTH|IAM/.test(text)) {
    return D7_E3I_PERMISSION_REASON_CODES_.FIRESTORE_AUTHORIZATION_FAILED;
  }
  if (/ACCESS|DENIED|FORBIDDEN|PERMISSION|HTTP_?403/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.RESOURCE_ACCESS_DENIED;
  if (/BLOCKED|ERROR|FAILED|UNKNOWN/.test(text)) return D7_E3I_PERMISSION_REASON_CODES_.UNKNOWN_READ_BLOCKER;
  return D7_E3I_PERMISSION_REASON_CODES_.READ_OK;
}

function statusForD7E3IPermissionReason_(reasonCode) {
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.READ_OK) return 'READ_OK';
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.RESOURCE_NOT_FOUND) return 'RESOURCE_NOT_FOUND';
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.TRANSPORT_FAILED) return 'TRANSPORT_FAILED';
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE) return 'READ_BLOCKED';
  return 'READ_BLOCKED';
}

function safeErrorClassForD7E3IPermissionReason_(reasonCode) {
  const map = {};
  map[D7_E3I_PERMISSION_REASON_CODES_.READ_OK] = 'NONE';
  map[D7_E3I_PERMISSION_REASON_CODES_.OAUTH_SCOPE_MISSING] = 'OAUTH';
  map[D7_E3I_PERMISSION_REASON_CODES_.OAUTH_REAUTHORIZATION_REQUIRED] = 'OAUTH';
  map[D7_E3I_PERMISSION_REASON_CODES_.RESOURCE_ACCESS_DENIED] = 'RESOURCE_ACCESS';
  map[D7_E3I_PERMISSION_REASON_CODES_.EXECUTION_IDENTITY_MISMATCH] = 'IDENTITY';
  map[D7_E3I_PERMISSION_REASON_CODES_.FIRESTORE_AUTHORIZATION_FAILED] = 'AUTHORIZATION';
  map[D7_E3I_PERMISSION_REASON_CODES_.FIRESTORE_PROJECT_OR_DATABASE_MISMATCH] = 'CONFIGURATION';
  map[D7_E3I_PERMISSION_REASON_CODES_.INVALID_EXACT_RESOURCE_REFERENCE] = 'CONFIGURATION';
  map[D7_E3I_PERMISSION_REASON_CODES_.TRANSPORT_FAILED] = 'TRANSPORT';
  map[D7_E3I_PERMISSION_REASON_CODES_.RESOURCE_NOT_FOUND] = 'NOT_FOUND';
  map[D7_E3I_PERMISSION_REASON_CODES_.CONTENT_READ_FAILED] = 'CONTENT_READ';
  map[D7_E3I_PERMISSION_REASON_CODES_.METADATA_READ_FAILED] = 'METADATA_READ';
  map[D7_E3I_PERMISSION_REASON_CODES_.ROW_IDENTITY_MISMATCH] = 'IDENTITY';
  map[D7_E3I_PERMISSION_REASON_CODES_.MESSAGE_IDENTITY_MISMATCH] = 'IDENTITY';
  map[D7_E3I_PERMISSION_REASON_CODES_.DOCUMENT_IDENTITY_MISMATCH] = 'IDENTITY';
  map[D7_E3I_PERMISSION_REASON_CODES_.ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE] = 'ADAPTER_DIAGNOSTIC';
  map[D7_E3I_PERMISSION_REASON_CODES_.UNKNOWN_READ_BLOCKER] = 'UNKNOWN';
  return map[reasonCode] || 'UNKNOWN';
}

function normalizeD7E3IAuthorizationType_(channel, value) {
  const explicit = sanitizeFindingCodesD7E3I_([value])[0];
  if (explicit) return explicit;
  if (channel === 'GMAIL') return 'OAUTH_AND_MAILBOX_ACCESS';
  if (channel === 'DRIVE_XML' || channel === 'DRIVE_PDF') return 'OAUTH_AND_DRIVE_FILE_ACL';
  if (channel === 'SHEETS') return 'OAUTH_AND_SPREADSHEET_ACL';
  if (channel === 'FIRESTORE') return 'OAUTH_DATASTORE_AND_IAM';
  return 'UNKNOWN';
}

function normalizeD7E3IResourceAccessStatus_(reasonCode, value) {
  const explicit = sanitizeFindingCodesD7E3I_([value])[0];
  if (explicit) return explicit;
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.READ_OK) return 'ACCESS_GRANTED';
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.RESOURCE_NOT_FOUND) return 'RESOURCE_NOT_FOUND';
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.RESOURCE_ACCESS_DENIED) return 'ACCESS_DENIED_OR_UNPROVEN';
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.FIRESTORE_AUTHORIZATION_FAILED) return 'IAM_OR_API_DENIED_OR_UNPROVEN';
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE) return 'ADAPTER_NOT_PROVEN';
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.TRANSPORT_FAILED) return 'NOT_EVALUATED_TRANSPORT_FAILED';
  return 'NOT_PROVEN';
}

function normalizeD7E3IExecutionIdentityStatus_(reasonCode, value) {
  const explicit = sanitizeFindingCodesD7E3I_([value])[0];
  if (explicit) return explicit;
  if (reasonCode === D7_E3I_PERMISSION_REASON_CODES_.EXECUTION_IDENTITY_MISMATCH) return 'EXECUTION_IDENTITY_MISMATCH';
  return 'IDENTITY_UNAVAILABLE';
}

function isD7E3IPermissionBlockerReason_(reasonCode) {
  return reasonCode === D7_E3I_PERMISSION_REASON_CODES_.OAUTH_SCOPE_MISSING ||
    reasonCode === D7_E3I_PERMISSION_REASON_CODES_.OAUTH_REAUTHORIZATION_REQUIRED ||
    reasonCode === D7_E3I_PERMISSION_REASON_CODES_.RESOURCE_ACCESS_DENIED ||
    reasonCode === D7_E3I_PERMISSION_REASON_CODES_.EXECUTION_IDENTITY_MISMATCH ||
    reasonCode === D7_E3I_PERMISSION_REASON_CODES_.FIRESTORE_AUTHORIZATION_FAILED ||
    reasonCode === D7_E3I_PERMISSION_REASON_CODES_.FIRESTORE_PROJECT_OR_DATABASE_MISMATCH;
}

function addD7E3IReadIssueFinding_(findings, system, permissionStatus, details) {
  const safeDetails = Object.assign({}, details || {}, publicD7E3IPermissionStatus_(permissionStatus));
  const isPermission = isD7E3IPermissionBlockerReason_(permissionStatus.reasonCode);
  addD7E3IFinding_(
    findings,
    isPermission ? 'FORENSIC_READ_PERMISSION_BLOCKER' : 'FORENSIC_EVIDENCE_INCOMPLETE',
    'BLOCKER',
    system,
    'UNAVAILABLE',
    safeDetails
  );
}

function addD7E3IFinding_(findings, code, severity, system, confidence, safeDetails) {
  findings.push({
    code: code,
    severity: severity,
    severityOrder: D7_E3I_FINDING_SEVERITY_[severity] || 99,
    system: system,
    confidence: confidence,
    safeDetails: sanitizeD7E3IObject_(safeDetails || {})
  });
}

function sortD7E3IFindings_(findings) {
  return findings.map(function cloneFinding(finding) {
    return sanitizeD7E3IObject_(finding);
  }).sort(function compareFindings(a, b) {
    if (a.severityOrder !== b.severityOrder) return a.severityOrder - b.severityOrder;
    if (a.system !== b.system) return String(a.system).localeCompare(String(b.system));
    return String(a.code).localeCompare(String(b.code));
  }).map(function removeOrder(finding) {
    delete finding.severityOrder;
    return finding;
  });
}

function hasD7E3IFinding_(findings, code) {
  return findings.some(function hasCode(finding) { return finding.code === code; });
}

function evidenceD7E3IClaim_(status, confidence, evidenceSource, reasonCode, details) {
  return sanitizeD7E3IObject_({
    status: status || 'UNAVAILABLE',
    confidence: D7_E3I_CONFIDENCE_[confidence] ? confidence : 'UNAVAILABLE',
    evidenceSource: evidenceSource || 'UNAVAILABLE',
    reasonCode: reasonCode || 'UNAVAILABLE',
    safeDetails: details || {}
  });
}

function emitD7E3ISummary_(logger, result) {
  if (!logger || typeof logger.log !== 'function') return;
  logger.log(JSON.stringify({
    phase: result.METADATA.PHASE,
    status: result.FINAL_STATUS,
    classification: result.PRIMARY_CLASSIFICATION,
    findingCodes: result.FINDINGS.map(function codeOnly(finding) { return finding.code; }),
    channelFindingCodes: result.FINDINGS.map(function channelCode(finding) { return finding.code + ':' + finding.system; }),
    permissionDiagnostics: result.PERMISSION_DIAGNOSTICS,
    safeCounters: result.SAFETY_COUNTS
  }));
}

function createD7E3IUnavailableSnapshotReader_() {
  return function readUnavailableSnapshot() {
    return evidenceD7E3IClaim_('SNAPSHOT_UNAVAILABLE', 'UNAVAILABLE', 'NO_DEFAULT_PRODUCTION_READER', 'DEFAULT_READER_NOT_CONFIGURED', {});
  };
}

function createD7E3IUnavailableSystemReader_(system) {
  return function readUnavailableSystem() {
    return evidenceD7E3IClaim_('READ_BLOCKED', 'UNAVAILABLE', 'NO_DEFAULT_PRODUCTION_READER', system + '_DEFAULT_READER_NOT_CONFIGURED', {});
  };
}

function normalizeD7E3IHash_(value) {
  const text = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(text) ? text : '';
}

function hashPrefixD7E3I_(value) {
  const text = String(value || '');
  if (!text) return '';
  const hash = normalizeD7E3IHash_(text) || sha256D7E3IText_(text);
  return hash.slice(0, 12);
}

function safeFingerprintD7E3I_(value) {
  if (!value) return '';
  return hashPrefixD7E3I_(stableD7E3IJson_(sanitizeD7E3IObject_(value)));
}

function sha256D7E3IText_(value) {
  return sha256D7E3IBytes_(String(value || ''));
}

function sha256D7E3IBytesIfPresent_(value) {
  return value === undefined || value === null ? '' : sha256D7E3IBytes_(value);
}

function sha256D7E3IBytes_(value) {
  const bytes = normalizeD7E3IBytes_(value);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  return digest.map(function toHex(byte) {
    const unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function normalizeD7E3IBytes_(value) {
  if (Array.isArray(value)) return value.map(function normalizeByte(byte) { return Number(byte) & 255; });
  if (typeof value === 'string') {
    const out = [];
    for (let i = 0; i < value.length; i += 1) out.push(value.charCodeAt(i) & 255);
    return out;
  }
  if (value && typeof value.getBytes === 'function') return value.getBytes();
  return [];
}

function byteLengthD7E3I_(value) {
  if (value === undefined || value === null) return -1;
  return normalizeD7E3IBytes_(value).length;
}

function numberD7E3I_(value, fallback) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return fallback === undefined ? 0 : fallback;
}

function boundedCountD7E3I_(value, fallback) {
  const n = numberD7E3I_(value, fallback);
  return n < 0 ? 0 : n;
}

function boolStatusD7E3I_(value) {
  if (value === 'YES' || value === true) return 'YES';
  if (value === 'NO' || value === false) return 'NO';
  return 'UNAVAILABLE';
}

function isReadBlockedD7E3I_(status) {
  return /BLOCKED|DENIED|ERROR|FAILED|PERMISSION|TRANSPORT/.test(String(status || '').toUpperCase());
}

function normalizeD7E3IDriveReadStatus_(status, parentStatus) {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'READ_OK' || normalized === 'READ_BLOCKED' || normalized === 'TRANSPORT_FAILED' || normalized === 'UNAVAILABLE' || normalized === 'UNKNOWN') {
    return normalized;
  }
  if (isReadBlockedD7E3I_(normalized)) return normalized.indexOf('TRANSPORT') !== -1 ? 'TRANSPORT_FAILED' : 'READ_BLOCKED';
  if (isReadBlockedD7E3I_(parentStatus)) return 'READ_BLOCKED';
  return status === undefined || status === null || status === '' ? 'UNKNOWN' : 'UNAVAILABLE';
}

function normalizeD7E3IMimeStatus_(value) {
  const text = String(value || '').toLowerCase();
  if (!text) return 'UNAVAILABLE';
  if (text === 'match' || text === 'mime_match') return 'MATCH';
  if (text === 'application/pdf' || text === 'application/xml' || text === 'text/xml') return 'MATCH';
  if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(text)) return 'OBSERVED_' + text.replace(/[^a-z0-9]+/g, '_').toUpperCase();
  return sanitizeD7E3IString_(value);
}

function sanitizeFindingCodesD7E3I_(codes) {
  return (Array.isArray(codes) ? codes : [codes]).filter(Boolean).map(function sanitizeCode(code) {
    return String(code).replace(/[^A-Za-z0-9_]/g, '_').toUpperCase().slice(0, 96);
  }).sort();
}

function sanitizeD7E3IObject_(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitizeD7E3IObject_);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return sanitizeD7E3IString_(value);
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[sanitizeD7E3IKey_(key)] = sanitizeD7E3IObject_(value[key]);
    }
    return out;
  }
  return sanitizeD7E3IString_(String(value));
}

function sanitizeD7E3IKey_(value) {
  return String(value).replace(/[^A-Za-z0-9_]/g, '_').slice(0, 96);
}

function sanitizeD7E3IString_(value) {
  const text = String(value || '');
  if (!text) return '';
  if (/^[A-Z0-9_:-]{1,120}$/.test(text)) return text;
  if (/^[a-f0-9]{1,64}$/.test(text)) return text.slice(0, 12);
  if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(text)) return text.toLowerCase().slice(0, 80);
  if (/^\d{1,12}$/.test(text)) return text;
  return 'REDACTED_HASH_PREFIX_' + hashPrefixD7E3I_(text);
}

function stableD7E3IJson_(value) {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(stableD7E3IJson_).join(',') + ']';
  if (typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function stableKey(key) {
      return JSON.stringify(key) + ':' + stableD7E3IJson_(value[key]);
    }).join(',') + '}';
  }
  return JSON.stringify(value);
}

function normalizeD7E3IErrorCode_(error) {
  if (!error) return 'UNKNOWN_READ_ERROR';
  if (typeof error === 'string') return sanitizeFindingCodesD7E3I_([error])[0] || 'READ_ERROR';
  if (error.code) return sanitizeFindingCodesD7E3I_([error.code])[0] || 'READ_ERROR';
  if (error.name) return sanitizeFindingCodesD7E3I_([error.name])[0] || 'READ_ERROR';
  return 'READ_ERROR';
}
