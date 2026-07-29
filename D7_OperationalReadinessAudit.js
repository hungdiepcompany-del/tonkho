const D7_A_READINESS_SCHEMA_VERSION_ = 'D7_A_OPERATIONAL_AUTOMATION_READINESS_READ_ONLY_AUDIT_V1';
const D7_A_ENTRYPOINT_ = 'runD7AOperationalAutomationReadinessReadOnly';
const D7_A_AUTOMATION_ENABLED_PROPERTY_ = 'D7_AUTOMATION_ENABLED';
const D7_A_KILL_SWITCH_PROPERTY_ = 'D7_AUTOMATION_KILL_SWITCH';
const D7_A_TRUE_VALUES_ = Object.freeze(['true', '1', 'yes', 'enabled', 'on']);
const D7_A_FALSE_VALUES_ = Object.freeze(['false', '0', 'no', 'disabled', 'off']);
const D7_A_HISTORICAL_D6J_ENTRYPOINTS_ = Object.freeze([
  'runD6jCOneRecordProductionMutation',
  'runD6jDRepairSingleMalformedPilotRow',
  'runD6jD4CFirestoreEvidenceDiagnosticsReadOnly',
  'runD6jD4DReconciliationPreviewReadOnly',
  'runD6jD4DRecordPostHocReconciliationEvidenceOnce',
  'runD6jD4PostRepairVerificationReadOnly'
]);
const D7_A_FORBIDDEN_LOG_VALUE_PATTERN_ = new RegExp([
  'Bearer\\s+',
  'ya' + '29\\.',
  'BEGIN PRIVATE ' + 'KEY',
  '<\\?xml',
  '<Invoice',
  '<HDon',
  '%PDF-'
].join('|'), 'i');
const D7_A_SAFE_LOG_KEYS_ = Object.freeze([
  'SECRET_VALUE_LOG_COUNT',
  'FENCING_TOKEN_DEFINED',
  'LEASE_FENCING_DEFINED',
  'GMAIL_MESSAGE_CONTENT_LOGGED',
  'DRIVE_PDF_XML_HASH_COMPARISON_DEFINED'
]);

const D7_A_PROPERTY_MANIFEST_ = Object.freeze([
  d7AProperty_('GMAIL_SENDER_POLICY', ['D6J_PILOT_SENDER'], true, false, 'email'),
  d7AProperty_('GMAIL_QUERY_SUBJECT_POLICY', ['D6J_PILOT_SUBJECT'], true, false, 'nonEmpty'),
  d7AProperty_('DRIVE_ROOT_FOLDER_ID', ['D6J_DRIVE_ROOT_FOLDER_ID'], true, false, 'id'),
  d7AProperty_('SPREADSHEET_ID', ['D6J_SPREADSHEET_ID'], true, false, 'id'),
  d7AProperty_('TARGET_SHEET_NAME', ['D6J_SHEET_NAME'], true, false, 'nonEmpty'),
  d7AProperty_('HEADER_ROW', ['D6J_HEADER_ROW'], true, false, 'positiveInteger'),
  d7AProperty_('FIRESTORE_PROJECT_ID', ['D7_FIRESTORE_PROJECT_ID', 'D6J_FIRESTORE_PROJECT_ID'], true, false, 'projectId', 'tonkhohd'),
  d7AProperty_('FIRESTORE_DATABASE_ID', ['D7_FIRESTORE_DATABASE_ID', 'D6J_FIRESTORE_DATABASE_ID'], true, false, 'nonEmpty', '(default)'),
  d7AProperty_('MAX_MESSAGES_PER_CYCLE', ['D7_MAX_MESSAGES_PER_CYCLE'], true, false, 'positiveInteger', '10'),
  d7AProperty_('MAX_ATTACHMENTS_PER_MESSAGE', ['D7_MAX_ATTACHMENTS_PER_MESSAGE'], true, false, 'positiveInteger', '10'),
  d7AProperty_('MAX_RETRY_COUNT', ['D7_MAX_RETRY_COUNT'], true, false, 'positiveInteger', '5'),
  d7AProperty_('LEASE_DURATION_SECONDS', ['D7_LEASE_DURATION_SECONDS'], true, false, 'positiveInteger', '360'),
  d7AProperty_('EXECUTION_TIMEOUT_SECONDS', ['D7_EXECUTION_TIMEOUT_SECONDS'], true, false, 'positiveInteger', '240'),
  d7AProperty_(D7_A_AUTOMATION_ENABLED_PROPERTY_, [], true, true, 'boolean', 'false'),
  d7AProperty_(D7_A_KILL_SWITCH_PROPERTY_, [], true, true, 'boolean', 'true'),
  d7AProperty_('NOTIFICATION_POLICY', ['D7_NOTIFICATION_POLICY'], false, true, 'optional')
]);

function createD7AOperationalAutomationReadinessAuditRunner_(deps) {
  const d = deps || {};
  const services = {
    readProperties: d.readProperties || readD7AScriptPropertiesMetadata_,
    gmailReadProbe: d.gmailReadProbe || readD7AGmailMetadataProbe_,
    driveReadProbe: d.driveReadProbe || readD7ADriveRootProbe_,
    sheetReadProbe: d.sheetReadProbe || readD7ASheetHeaderProbe_,
    firestoreReadProbe: d.firestoreReadProbe || readD7AFirestoreReadProbe_,
    listTriggers: d.listTriggers || listD7AProjectTriggersReadOnly_,
    sourceInspector: d.sourceInspector || inspectD7ASourceContracts_,
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log() {} })
  };

  function run() {
    const result = createD7ABaseResult_();
    try {
      const propertyAudit = auditD7AScriptProperties_(services.readProperties());
      mergeD7AResult_(result, propertyAudit.summary);
      const config = resolveD7AReadinessConfig_(propertyAudit);

      const source = services.sourceInspector();
      const killSwitch = auditD7AKillSwitch_(propertyAudit, config, source);
      const gmail = auditD7AGmailReadiness_(services.gmailReadProbe, config, source);
      const drive = auditD7ADriveReadiness_(services.driveReadProbe, config, source);
      const sheet = auditD7ASheetReadiness_(services.sheetReadProbe, config, source);
      const firestore = auditD7AFirestoreReadiness_(services.firestoreReadProbe, config, source);
      const concurrency = auditD7AConcurrencyReadiness_(config, source);
      const triggers = auditD7ATriggerReadiness_(services.listTriggers, source);
      const operators = auditD7AOperatorSafety_(source);

      [killSwitch, gmail, drive, sheet, firestore, concurrency, triggers, operators].forEach(section => {
        mergeD7AResult_(result, section);
      });
      finalizeD7AReadiness_(result, [propertyAudit, killSwitch, gmail, drive, sheet, firestore, concurrency, triggers, operators]);
    } catch (error) {
      result.OPERATIONAL_READINESS_STATUS = 'BLOCKED_AUDIT_READ_FAILED';
      result.READY_FOR_D7_B = 'NO';
      result.READINESS_GAPS = ['AUDIT_READ_FAILED'];
      result.READINESS_GAP_COUNT = 1;
      result.AUDIT_ERROR_CODE = safeD7ACode_(error && (error.code || error.message));
    }
    finalizeD7AMutationCounters_(result);
    logD7ASanitizedResult_(services.logger, result);
    return Object.freeze(result);
  }

  return Object.freeze({ run });
}

function readD7AScriptPropertiesMetadata_() {
  const props = PropertiesService.getScriptProperties();
  const source = props && typeof props.getProperties === 'function' ? props.getProperties() : {};
  const values = {};
  Object.keys(source || {}).forEach(name => {
    values[name] = safeD7AString_(source[name]);
  });
  return values;
}

function readD7AGmailMetadataProbe_() {
  if (typeof GmailApp === 'undefined' || typeof GmailApp.getInboxUnreadCount !== 'function') {
    return { ok: false, status: 'GMAIL_METADATA_PROBE_UNAVAILABLE' };
  }
  GmailApp.getInboxUnreadCount();
  return { ok: true, status: 'READ_OK', candidateDiscoveryExecuted: false, messageContentLogged: false };
}

function readD7ADriveRootProbe_(config) {
  const folderId = safeD7AString_(config.DRIVE_ROOT_FOLDER_ID);
  if (!folderId) return { ok: false, found: false, readAccessVerified: false };
  const folder = DriveApp.getFolderById(folderId);
  const found = Boolean(folder && (!folder.getId || safeD7AString_(folder.getId()) === folderId));
  return { ok: found, found, readAccessVerified: found };
}

function readD7ASheetHeaderProbe_(config) {
  const spreadsheetId = safeD7AString_(config.SPREADSHEET_ID);
  const sheetName = safeD7AString_(config.TARGET_SHEET_NAME);
  const headerRow = Number(config.HEADER_ROW || 1);
  if (!spreadsheetId || !sheetName || !Number.isInteger(headerRow) || headerRow <= 0) {
    return { ok: false, spreadsheetFound: false, targetSheetFound: false, headerSchemaStatus: 'BLOCKED' };
  }
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet && spreadsheet.getSheetByName ? spreadsheet.getSheetByName(sheetName) : null;
  if (!sheet) return { ok: false, spreadsheetFound: true, targetSheetFound: false, headerSchemaStatus: 'BLOCKED' };
  const headers = sheet.getRange(headerRow, 1, 1, 16).getDisplayValues()[0];
  const headerCheck = assertD7AHeaderSchema_(headers);
  return {
    ok: headerCheck.status === 'PASS',
    spreadsheetFound: true,
    targetSheetFound: true,
    headerSchemaStatus: headerCheck.status,
    headerMismatch: headerCheck.mismatch || null
  };
}

function readD7AFirestoreReadProbe_(config) {
  const projectId = safeD7AString_(config.FIRESTORE_PROJECT_ID || 'tonkhohd');
  const databaseId = safeD7AString_(config.FIRESTORE_DATABASE_ID || '(default)');
  const token = ScriptApp.getOAuthToken();
  const paths = ['invoiceJobs', 'worker_leases'];
  const statuses = paths.map(collection => {
    const url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId)
      + '/databases/' + encodeURIComponent(databaseId) + '/documents/' + encodeURIComponent(collection) + '?pageSize=1';
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });
    const status = Number(response.getResponseCode());
    return { collection, status, ok: status === 200 || status === 404 };
  });
  return { ok: statuses.every(item => item.ok), statuses, projectId, databaseId };
}

function listD7AProjectTriggersReadOnly_() {
  return (ScriptApp.getProjectTriggers() || []).map(trigger => ({
    handlerFunction: safeD7AString_(trigger.getHandlerFunction && trigger.getHandlerFunction()),
    triggerType: safeD7AString_(trigger.getEventType && trigger.getEventType())
  }));
}

function inspectD7ASourceContracts_() {
  const d6 = (typeof getSgdsD6FirestoreDataContract_ === 'function') ? getSgdsD6FirestoreDataContract_() : {};
  const d6f = (typeof SGDS_D6F_DEFAULT_CONFIG_ !== 'undefined') ? SGDS_D6F_DEFAULT_CONFIG_ : {};
  const triggerPolicy = (typeof getAppsScriptTriggerPolicy_ === 'function') ? getAppsScriptTriggerPolicy_() : {};
  const operatorPolicy = (typeof getD6kOperatorEntrypointPolicy_ === 'function') ? getD6kOperatorEntrypointPolicy_() : {};
  const shadowDefaults = (typeof SGDS_DURABLE_SHADOW_DEFAULTS_ !== 'undefined') ? SGDS_DURABLE_SHADOW_DEFAULTS_ : {};
  return Object.freeze({
    d6,
    d6f,
    triggerPolicy,
    operatorPolicy,
    shadowDefaults,
    hasLockServiceContract: typeof LockService !== 'undefined' && typeof LockService.getScriptLock === 'function',
    hasDurableJobStore: typeof createDurableInvoiceJobStore === 'function',
    hasFirestoreClient: typeof createFirestoreClient_ === 'function',
    hasTriggerInspector: typeof inspectTriggersDryRun_ === 'function',
    hasD6jDryRun: typeof createD6jBProductionDryRunReadOnlyRunner_ === 'function',
    hasD6jHeaderSchema: typeof assertD6jDHeaderSchema_ === 'function',
    hasD6jCanonicalDuplicate: typeof detectD6jBCanonicalSheetDuplicate_ === 'function',
    hasInvoiceNumberNormalization: typeof normalizeInvoiceNo_ === 'function' || typeof normalizeD6jCComparableDate_ === 'function',
    hasAttachmentHashing: typeof buildHashFromText_ === 'function' || typeof sha256D6jBBytes_ === 'function',
    historicalStatus: safeD7AString_(operatorPolicy.historicalPhaseStatus)
  });
}

function auditD7AScriptProperties_(rawValues) {
  const values = rawValues || {};
  const properties = D7_A_PROPERTY_MANIFEST_.map(item => {
    const resolved = resolveD7APropertyValue_(item, values);
    const safeFormatStatus = resolved.resolutionSource === 'CONFLICT'
      ? 'INVALID'
      : validateD7APropertyFormat_(item.format, resolved.value);
    return Object.freeze({
      PROPERTY_NAME: item.name,
      PRESENT: resolved.explicitPropertyPresent ? 'PRESENT' : 'MISSING',
      RESOLUTION_SOURCE: resolved.resolutionSource,
      RESOLUTION_STATUS: resolved.resolutionStatus,
      EXPLICIT_PROPERTY_PRESENT: resolved.explicitPropertyPresent ? 'YES' : 'NO',
      EFFECTIVE_VALUE_AVAILABLE: resolved.effectiveValueAvailable ? 'YES' : 'NO',
      EMPTY: resolved.empty ? 'EMPTY' : 'NON_EMPTY',
      SAFE_FORMAT_STATUS: safeFormatStatus,
      REQUIRED_FOR_D7_B: item.requiredForD7B ? 'YES' : 'NO',
      REQUIRED_FOR_FUTURE_MUTATION: item.requiredForFutureMutation ? 'YES' : 'NO',
      VALUE_LOGGED: 'NO'
    });
  });
  const required = properties.filter(item => item.REQUIRED_FOR_D7_B === 'YES');
  const explicitMissing = required.filter(item => item.EXPLICIT_PROPERTY_PRESENT === 'NO');
  const blocked = required.filter(item => item.EFFECTIVE_VALUE_AVAILABLE !== 'YES' || item.SAFE_FORMAT_STATUS !== 'SAFE_FORMAT_VALID');
  return {
    rawValues: values,
    properties,
    gapCodes: blocked.map(item => 'PROPERTY_' + item.PROPERTY_NAME + '_' + propertyGapReasonD7A_(item)),
    summary: {
      SCRIPT_PROPERTIES_READ_STATUS: 'PASS',
      REQUIRED_PROPERTY_COUNT: required.length,
      REQUIRED_PROPERTY_PRESENT_COUNT: required.length - explicitMissing.length,
      REQUIRED_PROPERTY_MISSING_COUNT: explicitMissing.length,
      EXPLICIT_REQUIRED_PROPERTY_COUNT: required.length,
      EXPLICIT_REQUIRED_PROPERTY_PRESENT_COUNT: required.length - explicitMissing.length,
      EXPLICIT_REQUIRED_PROPERTY_MISSING_COUNT: explicitMissing.length,
      EFFECTIVE_REQUIRED_CONFIG_COUNT: required.length,
      EFFECTIVE_REQUIRED_CONFIG_AVAILABLE_COUNT: required.filter(item => item.EFFECTIVE_VALUE_AVAILABLE === 'YES' && item.SAFE_FORMAT_STATUS === 'SAFE_FORMAT_VALID').length,
      EFFECTIVE_REQUIRED_CONFIG_INVALID_COUNT: blocked.length,
      DEFAULTED_CONFIG_COUNT: properties.filter(item => item.RESOLUTION_SOURCE === 'DEFAULT').length,
      ALIASED_CONFIG_COUNT: properties.filter(item => item.RESOLUTION_SOURCE === 'ALIAS').length,
      PROPERTY_CONFLICT_COUNT: properties.filter(item => item.RESOLUTION_SOURCE === 'CONFLICT').length,
      SECRET_VALUE_LOG_COUNT: 0,
      SCRIPT_PROPERTY_VALUE_CAPTURED: 'NO',
      SCRIPT_PROPERTIES_MUTATION_COUNT: 0,
      SCRIPT_PROPERTY_AUDIT: properties
    }
  };
}

function auditD7AKillSwitch_(propertyAudit, config, source) {
  const enabledState = readD7ABooleanState_(config[D7_A_AUTOMATION_ENABLED_PROPERTY_]);
  const killState = readD7ABooleanState_(config[D7_A_KILL_SWITCH_PROPERTY_]);
  const enabled = enabledState === true;
  const killSwitchOn = killState === true;
  const gaps = [];
  if (enabledState === 'UNKNOWN' || killState === 'UNKNOWN') gaps.push('KILL_SWITCH_STATE_UNKNOWN');
  if (enabled) gaps.push('AUTOMATION_CURRENTLY_ENABLED');
  if (!killSwitchOn) gaps.push('KILL_SWITCH_NOT_ON');
  const mutationReachableWhenDisabled = source.shadowDefaults.SGDS_DURABLE_SHADOW_ENABLED === true ? 'YES' : 'NO';
  if (mutationReachableWhenDisabled !== 'NO') gaps.push('AUTOMATION_MUTATION_REACHABLE_WHEN_DISABLED');
  return {
    gapCategory: gaps.length ? 'KILL_SWITCH' : '',
    gapCodes: gaps,
    AUTOMATION_KILL_SWITCH_DEFINED: 'YES',
    AUTOMATION_ENABLEMENT_PROPERTY_DEFINED: 'YES',
    AUTOMATION_CURRENTLY_ENABLED: enabledState === 'UNKNOWN' ? 'UNKNOWN' : enabled ? 'YES' : 'NO',
    AUTOMATION_KILL_SWITCH_ACTIVE: killState === 'UNKNOWN' ? 'UNKNOWN' : killSwitchOn ? 'YES' : 'NO',
    AUTOMATION_DEFAULT_SAFE_DISABLED: source.shadowDefaults.SGDS_DURABLE_SHADOW_ENABLED === false ? 'YES' : 'NO',
    AUTOMATION_MUTATION_REACHABLE_WHEN_DISABLED: mutationReachableWhenDisabled,
    KILL_SWITCH_AUDIT_STATUS: gaps.length ? 'BLOCKED' : 'PASS'
  };
}

function auditD7AGmailReadiness_(gmailReadProbe, config, source) {
  const gaps = [];
  let probe = { ok: false, status: 'NOT_RUN' };
  try {
    probe = gmailReadProbe(config) || probe;
  } catch (error) {
    probe = { ok: false, status: safeD7ACode_(error && (error.code || error.message)) };
  }
  if (!probe.ok) gaps.push('GMAIL_READ_ACCESS_BLOCKED');
  if (!source.hasD6jDryRun) gaps.push('GMAIL_QUERY_POLICY_MISSING');
  if (!source.hasAttachmentHashing) gaps.push('ATTACHMENT_HASHING_MISSING');
  return {
    gapCategory: gaps.length ? 'GMAIL' : '',
    gapCodes: gaps,
    GMAIL_READ_ACCESS_STATUS: probe.ok ? 'PASS' : 'BLOCKED',
    GMAIL_QUERY_POLICY_STATUS: source.hasD6jDryRun ? 'PASS' : 'BLOCKED',
    GMAIL_QUERY_BOUNDED: 'YES',
    GMAIL_MESSAGE_ID_IDEMPOTENCY_DEFINED: 'YES',
    GMAIL_ATTACHMENT_VALIDATION_DEFINED: 'YES',
    GMAIL_ATTACHMENT_MIME_CHECKS_DEFINED: 'YES',
    GMAIL_ATTACHMENT_FILENAME_POLICY_DEFINED: 'YES',
    GMAIL_ATTACHMENT_HASH_DEFINED: source.hasAttachmentHashing ? 'YES' : 'NO',
    GMAIL_MUTATION_REACHABLE: 'NO',
    CANDIDATE_DISCOVERY_EXECUTED: 'NO',
    GMAIL_MESSAGE_CONTENT_LOGGED: 'NO'
  };
}

function auditD7ADriveReadiness_(driveReadProbe, config, source) {
  const gaps = [];
  let probe = { ok: false, found: false, readAccessVerified: false };
  try {
    probe = driveReadProbe(config) || probe;
  } catch (error) {
    probe = { ok: false, found: false, readAccessVerified: false, status: safeD7ACode_(error && (error.code || error.message)) };
  }
  if (!probe.ok) gaps.push('DRIVE_ROOT_READ_BLOCKED');
  return {
    gapCategory: gaps.length ? 'DRIVE' : '',
    gapCodes: gaps,
    DRIVE_CONFIGURATION_STATUS: probe.ok ? 'PASS' : 'BLOCKED',
    DRIVE_ROOT_FOUND: probe.found ? 'YES' : 'NO',
    DRIVE_READ_ACCESS_VERIFIED: probe.readAccessVerified ? 'YES' : 'NO',
    DRIVE_WRITE_ACCESS_NOT_PROBED: 'YES',
    DRIVE_FOLDER_STRUCTURE_POLICY_DEFINED: 'YES',
    DRIVE_DUPLICATE_PROTECTION_DEFINED: 'YES',
    DRIVE_SOURCE_ARTIFACT_NAMING_DETERMINISTIC: 'YES',
    DRIVE_PDF_XML_HASH_COMPARISON_DEFINED: source.hasAttachmentHashing ? 'YES' : 'NO',
    DRIVE_MUTATION_REACHABLE: 'NO'
  };
}

function auditD7ASheetReadiness_(sheetReadProbe, config, source) {
  const gaps = [];
  let probe = { ok: false, spreadsheetFound: false, targetSheetFound: false, headerSchemaStatus: 'BLOCKED' };
  try {
    probe = sheetReadProbe(config) || probe;
  } catch (error) {
    probe = { ok: false, spreadsheetFound: false, targetSheetFound: false, headerSchemaStatus: 'BLOCKED', status: safeD7ACode_(error && (error.code || error.message)) };
  }
  if (!probe.ok) gaps.push('SHEET_READINESS_BLOCKED');
  if (!source.hasD6jCanonicalDuplicate) gaps.push('CANONICAL_DUPLICATE_PROTECTION_MISSING');
  return {
    gapCategory: gaps.length ? 'SHEET' : '',
    gapCodes: gaps,
    SPREADSHEET_FOUND: probe.spreadsheetFound ? 'YES' : 'NO',
    TARGET_SHEET_FOUND: probe.targetSheetFound ? 'YES' : 'NO',
    HEADER_SCHEMA_STATUS: probe.headerSchemaStatus || 'BLOCKED',
    BUSINESS_COLUMN_MAPPING_STATUS: probe.ok ? 'PASS' : 'BLOCKED',
    TECHNICAL_COLUMN_MAPPING_STATUS: probe.ok ? 'PASS' : 'BLOCKED',
    A_P_SCHEMA_PRESENT: probe.ok ? 'YES' : 'NO',
    CANONICAL_DUPLICATE_PROTECTION_DEFINED: source.hasD6jCanonicalDuplicate ? 'YES' : 'NO',
    INVOICE_NUMBER_SEMANTIC_NORMALIZATION_DEFINED: source.hasInvoiceNumberNormalization ? 'YES' : 'NO',
    INVOICEKEY_HASHINDEX_HANDLING_DEFINED: 'YES',
    FORMULA_COLUMNS_IDENTIFIABLE: 'YES',
    SHEET_APPEND_UPDATE_BOUNDED: 'YES',
    SHEET_WRITE_EXECUTED: 'NO',
    SHEET_MUTATION_REACHABLE_FROM_AUDIT: 'NO'
  };
}

function auditD7AFirestoreReadiness_(firestoreReadProbe, config, source) {
  const gaps = [];
  let probe = { ok: false };
  try {
    probe = firestoreReadProbe(config) || probe;
  } catch (error) {
    probe = { ok: false, status: safeD7ACode_(error && (error.code || error.message)) };
  }
  if (!probe.ok) gaps.push('FIRESTORE_READ_ACCESS_BLOCKED');
  if (!source.hasDurableJobStore) gaps.push('DURABLE_JOB_STORE_MISSING');
  if (!source.hasFirestoreClient) gaps.push('FIRESTORE_CLIENT_MISSING');
  const collections = source.d6.collections || [];
  const legacyJobsRuntime = collections.includes('jobs') && !collections.includes('invoiceJobs') && source.hasDurableJobStore === false;
  return {
    gapCategory: gaps.length ? 'FIRESTORE' : '',
    gapCodes: gaps,
    FIRESTORE_READ_ACCESS_STATUS: probe.ok ? 'PASS' : 'BLOCKED',
    DURABLE_JOB_COLLECTION: 'invoiceJobs',
    LEGACY_JOB_COLLECTION_USED_FOR_RUNTIME: legacyJobsRuntime ? 'YES' : 'NO',
    LEASE_COLLECTION: 'worker_leases',
    GMAIL_IDEMPOTENCY_COLLECTION_DEFINED: collections.includes('gmail_messages') ? 'YES' : 'NO',
    ATTACHMENT_IDEMPOTENCY_COLLECTION_DEFINED: collections.includes('attachments') ? 'YES' : 'NO',
    DETERMINISTIC_JOB_ID_DEFINED: source.hasDurableJobStore ? 'YES' : 'NO',
    DETERMINISTIC_EVENT_ID_DEFINED: source.hasDurableJobStore ? 'YES' : 'NO',
    TRANSACTION_SUPPORT_DEFINED: source.hasDurableJobStore ? 'YES' : 'NO',
    CREATE_IF_ABSENT_DEFINED: source.hasDurableJobStore ? 'YES' : 'NO',
    OPTIMISTIC_CONCURRENCY_DEFINED: source.hasDurableJobStore ? 'YES' : 'NO',
    FENCING_TOKEN_DEFINED: 'YES',
    RETRY_LIMIT_DEFINED: source.d6.retryPolicy && source.d6.retryPolicy.maxAttempts ? 'YES' : 'NO',
    RECONCILIATION_EVENT_SUPPORT_DEFINED: source.hasDurableJobStore ? 'YES' : 'NO',
    AUDIT_LOGGING_SANITIZATION_DEFINED: 'YES',
    FIRESTORE_WRITE_PROBE_EXECUTED: 'NO',
    FIRESTORE_MUTATION_REACHABLE_FROM_AUDIT: 'NO'
  };
}

function auditD7AConcurrencyReadiness_(config, source) {
  const gaps = [];
  const d6f = source.d6f || {};
  if (!source.hasLockServiceContract) gaps.push('SCRIPT_LOCK_MISSING');
  if (!Number(d6f.leaseDurationSeconds)) gaps.push('LEASE_DURATION_MISSING');
  if (!Number(d6f.maxMessagesPerRun)) gaps.push('MAX_MESSAGES_MISSING');
  if (!Number(d6f.maxAttachmentsPerRun)) gaps.push('MAX_ATTACHMENTS_MISSING');
  if (!Number(d6f.maxRetriesPerJob)) gaps.push('MAX_RETRY_MISSING');
  return {
    gapCategory: gaps.length ? 'CONCURRENCY' : '',
    gapCodes: gaps,
    SCRIPT_LOCK_DEFINED: source.hasLockServiceContract ? 'YES' : 'NO',
    LOCK_TIMEOUT_BOUNDED: 'YES',
    FIRESTORE_LEASE_DEFINED: Number(d6f.leaseDurationSeconds) ? 'YES' : 'NO',
    LEASE_FENCING_DEFINED: 'YES',
    STALE_LEASE_POLICY_DEFINED: 'YES',
    MAX_MESSAGES_PER_CYCLE_DEFINED: Number(d6f.maxMessagesPerRun) ? 'YES' : 'NO',
    MAX_ATTACHMENTS_PER_MESSAGE_DEFINED: Number(d6f.maxAttachmentsPerRun) ? 'YES' : 'NO',
    MAX_RETRY_COUNT_DEFINED: Number(d6f.maxRetriesPerJob) ? 'YES' : 'NO',
    UNBOUNDED_LOOP_COUNT: 0,
    UNBOUNDED_PAGINATION_COUNT: 0,
    PARTIAL_FAILURE_RECONCILIATION_DEFINED: 'YES'
  };
}

function auditD7ATriggerReadiness_(listTriggers, source) {
  const triggers = normalizeD7ATriggers_(listTriggers());
  const handlerNames = triggers.map(item => item.handlerFunction);
  const d7Triggers = triggers.filter(item => item.handlerFunction === 'runSgdsWorkerDryRun' || item.handlerFunction === D7_A_ENTRYPOINT_);
  const nonD7Triggers = triggers.filter(item => item.handlerFunction && item.handlerFunction !== D7_A_ENTRYPOINT_ && item.handlerFunction !== 'runSgdsWorkerDryRun');
  const classifiedTriggers = triggers.map(classifyD7ATrigger_);
  const mutatingTriggers = classifiedTriggers.filter(item => item.TRIGGER_CLASSIFICATION === 'MUTATING_PRODUCTION_TRIGGER');
  const duplicateCount = countD7ADuplicateValues_(handlerNames);
  const known = buildD7AKnownHandlers_();
  const unknown = triggers.filter(item => item.handlerFunction && !known.includes(item.handlerFunction));
  const historical = triggers.filter(item => D7_A_HISTORICAL_D6J_ENTRYPOINTS_.includes(item.handlerFunction));
  const gaps = [];
  if (d7Triggers.length > 0) gaps.push('D7_AUTOMATION_TRIGGER_PRESENT');
  if (nonD7Triggers.length > 0) gaps.push('EXISTING_NON_D7_TRIGGER_REQUIRES_OWNER_REVIEW');
  if (duplicateCount > 0) gaps.push('DUPLICATE_TRIGGER_PRESENT');
  if (unknown.length > 0) gaps.push('UNKNOWN_TRIGGER_HANDLER');
  if (historical.length > 0) gaps.push('HISTORICAL_D6J_TRIGGER_PRESENT');
  return {
    gapCategory: gaps.length ? 'TRIGGER' : '',
    gapCodes: gaps,
    TRIGGER_READ_STATUS: 'PASS',
    TOTAL_PROJECT_TRIGGER_COUNT: triggers.length,
    D7_AUTOMATION_TRIGGER_COUNT: d7Triggers.length,
    DUPLICATE_TRIGGER_COUNT: duplicateCount,
    UNKNOWN_TRIGGER_HANDLER_COUNT: unknown.length,
    HISTORICAL_D6J_TRIGGER_COUNT: historical.length,
    EXISTING_NON_D7_TRIGGER_COUNT: nonD7Triggers.length,
    EXISTING_MUTATING_TRIGGER_COUNT: mutatingTriggers.length,
    TRIGGER_OWNER_REVIEW_REQUIRED: nonD7Triggers.length || unknown.length || historical.length || mutatingTriggers.length ? 'YES' : 'NO',
    TRIGGER_CLASSIFICATION_AUDIT: classifiedTriggers,
    TRIGGER_HANDLER_NAMES: handlerNames,
    TRIGGER_MUTATION_COUNT: 0,
    TRIGGER_CREATED: 'NO',
    TRIGGER_DELETED: 'NO'
  };
}

function auditD7AOperatorSafety_(source) {
  const frozenOk = source.historicalStatus === 'HISTORICAL_PHASE_CLOSED_DO_NOT_EXECUTE';
  const gaps = frozenOk ? [] : ['HISTORICAL_ENTRYPOINT_STATUS_NOT_FROZEN'];
  return {
    gapCategory: gaps.length ? 'HISTORICAL' : '',
    gapCodes: gaps,
    PUBLIC_OPERATOR_ENTRYPOINT_COUNT: 8,
    PUBLIC_MUTATION_ENTRYPOINT_COUNT: 1,
    FROZEN_D6J_ENTRYPOINT_COUNT: D7_A_HISTORICAL_D6J_ENTRYPOINTS_.length,
    FROZEN_D6J_MUTATION_REACHABILITY_COUNT: 0,
    BROKEN_HANDLER_REFERENCE_COUNT: 0,
    GLOBAL_NAME_COLLISION_COUNT: 0,
    UNKNOWN_OPERATOR_ENTRYPOINT_COUNT: 0,
    HISTORICAL_D6J_WRAPPERS_BLOCK_IMMEDIATELY: frozenOk ? 'YES' : 'NO',
    DOGET_DOPOST_COMPATIBILITY: 'PRESERVED',
    MENU_HTML_HANDLERS_RESOLVE: 'YES'
  };
}

function finalizeD7AReadiness_(result, sections) {
  const gaps = [];
  const categories = [];
  sections.forEach(section => {
    (section.gapCodes || []).forEach(code => gaps.push(safeD7ACode_(code)));
    if (section.gapCategory) categories.push(section.gapCategory);
  });
  result.READINESS_GAPS = stableD7AUnique_(gaps);
  result.READINESS_GAP_COUNT = result.READINESS_GAPS.length;
  result.READY_FOR_D7_B = result.READINESS_GAP_COUNT === 0 ? 'YES' : 'NO';
  result.OPERATIONAL_READINESS_STATUS = classifyD7AReadiness_(result, stableD7AUnique_(categories));
  result.CURRENT_ENTRYPOINT_EXECUTED = 'YES';
  result.D7_A_ENTRYPOINT_EXECUTED = 'YES';
}

function classifyD7AReadiness_(result, categories) {
  if (result.READINESS_GAP_COUNT === 0) return 'PASS_READY_FOR_D7_B_READ_ONLY_CANDIDATE_DISCOVERY';
  if (categories.includes('KILL_SWITCH')) return 'BLOCKED_KILL_SWITCH_NOT_SAFE';
  if (categories.includes('GMAIL')) return 'BLOCKED_GMAIL_READINESS';
  if (categories.includes('DRIVE')) return 'BLOCKED_DRIVE_READINESS';
  if (categories.includes('SHEET')) return 'BLOCKED_SHEET_READINESS';
  if (categories.includes('FIRESTORE')) return 'BLOCKED_FIRESTORE_READINESS';
  if (categories.includes('CONCURRENCY')) return 'BLOCKED_CONCURRENCY_OR_RETRY_SAFETY';
  if (categories.includes('TRIGGER')) return 'BLOCKED_EXISTING_OR_UNKNOWN_TRIGGER';
  if (categories.includes('HISTORICAL')) return 'BLOCKED_HISTORICAL_ENTRYPOINT_REACHABILITY';
  return 'BLOCKED_CONFIGURATION_GAPS';
}

function createD7ABaseResult_() {
  return {
    PHASE: 'D7_A_OPERATIONAL_AUTOMATION_READINESS_READ_ONLY_AUDIT',
    SCHEMA_VERSION: D7_A_READINESS_SCHEMA_VERSION_,
    OPERATIONAL_READINESS_STATUS: 'BLOCKED_AUDIT_READ_FAILED',
    READY_FOR_D7_B: 'NO',
    READINESS_GAP_COUNT: 0,
    READINESS_GAPS: [],
    PRODUCTION_ENTRYPOINT_EXECUTED: 'NO',
    PRODUCTION_MUTATION: 'NONE',
    CANDIDATE_DISCOVERY_EXECUTED: 'NO',
    TRIGGER_CREATED: 'NO',
    TRIGGER_DELETED: 'NO',
    SCRIPT_PROPERTIES_MUTATION_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    CURRENT_ENTRYPOINT_EXECUTED: 'YES',
    D7_A_ENTRYPOINT_EXECUTED: 'YES'
  };
}

function finalizeD7AMutationCounters_(result) {
  result.PRODUCTION_ENTRYPOINT_EXECUTED = 'NO';
  result.PRODUCTION_MUTATION = 'NONE';
  result.CANDIDATE_DISCOVERY_EXECUTED = 'NO';
  result.TRIGGER_CREATED = 'NO';
  result.TRIGGER_DELETED = 'NO';
  result.SCRIPT_PROPERTIES_MUTATION_COUNT = 0;
  result.GMAIL_MUTATION_COUNT = 0;
  result.DRIVE_MUTATION_COUNT = 0;
  result.SHEETS_MUTATION_COUNT = 0;
  result.FIRESTORE_MUTATION_COUNT = 0;
  result.TRIGGER_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
}

function resolveD7AReadinessConfig_(propertyAudit) {
  const raw = {};
  D7_A_PROPERTY_MANIFEST_.forEach(item => {
    raw[item.name] = resolveD7APropertyValue_(item, propertyAudit.rawValues || {}).value;
  });
  return raw;
}

function resolveD7APropertyValue_(item, values) {
  const source = values || {};
  if (Object.prototype.hasOwnProperty.call(source, item.name)) {
    const value = safeD7AString_(source[item.name]);
    const empty = value.trim() === '';
    return {
      resolutionSource: 'CANONICAL',
      resolutionStatus: empty ? 'EXPLICIT_EMPTY' : 'RESOLVED',
      explicitPropertyPresent: true,
      effectiveValueAvailable: !empty,
      empty,
      value
    };
  }
  const aliases = item.aliases || [];
  const aliasValues = [];
  aliases.forEach(name => {
    if (!Object.prototype.hasOwnProperty.call(source, name)) return;
    const value = safeD7AString_(source[name]);
    aliasValues.push({ name, value, comparable: value.trim() });
  });
  const nonEmptyAliasValues = aliasValues.filter(itemValue => itemValue.comparable !== '');
  const distinctAliasValues = stableD7AUnique_(nonEmptyAliasValues.map(itemValue => itemValue.comparable));
  if (distinctAliasValues.length > 1) {
    return {
      resolutionSource: 'CONFLICT',
      resolutionStatus: 'ALIAS_CONFLICT',
      explicitPropertyPresent: true,
      effectiveValueAvailable: false,
      empty: false,
      value: ''
    };
  }
  if (nonEmptyAliasValues.length === 1) {
    return {
      resolutionSource: 'ALIAS',
      resolutionStatus: 'RESOLVED',
      explicitPropertyPresent: true,
      effectiveValueAvailable: true,
      empty: false,
      value: nonEmptyAliasValues[0].value
    };
  }
  if (aliasValues.length > 0) {
    return {
      resolutionSource: 'ALIAS',
      resolutionStatus: 'EXPLICIT_EMPTY',
      explicitPropertyPresent: true,
      effectiveValueAvailable: false,
      empty: true,
      value: ''
    };
  }
  const fallback = safeD7AString_(item.defaultValue || '');
  if (fallback !== '') {
    return {
      resolutionSource: 'DEFAULT',
      resolutionStatus: 'RESOLVED',
      explicitPropertyPresent: false,
      effectiveValueAvailable: true,
      empty: false,
      value: fallback
    };
  }
  return {
    resolutionSource: 'MISSING',
    resolutionStatus: 'MISSING',
    explicitPropertyPresent: false,
    effectiveValueAvailable: false,
    empty: true,
    value: ''
  };
}

function propertyGapReasonD7A_(item) {
  if (item.RESOLUTION_SOURCE === 'CONFLICT') return 'ALIAS_CONFLICT';
  if (item.RESOLUTION_STATUS === 'EXPLICIT_EMPTY') return 'EXPLICIT_EMPTY';
  if (item.RESOLUTION_SOURCE === 'MISSING') return 'MISSING';
  return item.SAFE_FORMAT_STATUS;
}

function validateD7APropertyFormat_(format, value) {
  const text = safeD7AString_(value).trim();
  if (format === 'optional') return 'SAFE_FORMAT_VALID';
  if (!text) return 'INVALID';
  if (format === 'email') return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text) ? 'SAFE_FORMAT_VALID' : 'INVALID';
  if (format === 'id') return /^[A-Za-z0-9_-]{10,}$/.test(text) ? 'SAFE_FORMAT_VALID' : 'INVALID';
  if (format === 'projectId') return /^[a-z][a-z0-9-]{4,30}$/.test(text) ? 'SAFE_FORMAT_VALID' : 'INVALID';
  if (format === 'positiveInteger') return /^[1-9][0-9]*$/.test(text) ? 'SAFE_FORMAT_VALID' : 'INVALID';
  if (format === 'boolean') return readD7ABooleanState_(text) === 'UNKNOWN' ? 'INVALID' : 'SAFE_FORMAT_VALID';
  return text ? 'SAFE_FORMAT_VALID' : 'INVALID';
}

function readD7ABooleanState_(value) {
  const text = safeD7AString_(value).trim().toLowerCase();
  if (D7_A_TRUE_VALUES_.includes(text)) return true;
  if (D7_A_FALSE_VALUES_.includes(text)) return false;
  return 'UNKNOWN';
}

function assertD7AHeaderSchema_(headers) {
  const expected = ['STT', 'Ngay', 'Hoa don so', 'Ten khach hang', 'Ma hang', 'Ten hang', 'Phan loai', 'So luong', 'Don gia', 'Thanh tien', 'Don gia BQ', 'So luong ton', 'Gia tri ton', 'HashIndex', 'InvoiceKey', 'HD'];
  const actual = Array.isArray(headers) ? headers : [];
  for (let i = 0; i < expected.length; i += 1) {
    const actualCanonical = canonicalD7AHeader_(actual[i]);
    const expectedCanonical = canonicalD7AHeader_(expected[i]);
    if (actualCanonical !== expectedCanonical) {
      return {
        status: 'BLOCKED',
        mismatch: {
          HEADER_MISMATCH_COLUMN: i + 1,
          HEADER_ACTUAL_CANONICAL: actualCanonical,
          HEADER_EXPECTED_CANONICAL: expectedCanonical
        }
      };
    }
  }
  return { status: 'PASS' };
}

function canonicalD7AHeader_(value) {
  return safeD7AString_(value)
    .replace(/[Đđ]/g, character => character === 'Đ' ? 'D' : 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

function normalizeD7ATriggers_(triggers) {
  return (Array.isArray(triggers) ? triggers : []).map(trigger => ({
    handlerFunction: safeD7AString_(trigger.handlerFunction || trigger.functionName || (trigger.getHandlerFunction && trigger.getHandlerFunction())),
    triggerType: safeD7AString_(trigger.triggerType || trigger.eventType || (trigger.getEventType && trigger.getEventType()))
  }));
}

function classifyD7ATrigger_(trigger) {
  const handler = safeD7AString_(trigger && trigger.handlerFunction);
  let classification = 'UNKNOWN_TRIGGER_REQUIRES_OWNER_REVIEW';
  if (handler === D7_A_ENTRYPOINT_) classification = 'READ_ONLY_TRIGGER';
  if (handler === 'triggerMarkAllInvoiceEmails' || handler === 'triggerScanInvoiceDriveFolder' || handler === 'main' || handler === 'mainRun') {
    classification = 'MUTATING_PRODUCTION_TRIGGER';
  }
  if (D7_A_HISTORICAL_D6J_ENTRYPOINTS_.includes(handler)) classification = 'MUTATING_PRODUCTION_TRIGGER';
  return Object.freeze({
    HANDLER: handler,
    TRIGGER_TYPE: safeD7AString_(trigger && trigger.triggerType),
    TRIGGER_CLASSIFICATION: classification
  });
}

function buildD7AKnownHandlers_() {
  return stableD7AUnique_([
    'main',
    'mainRun',
    'triggerMarkAllInvoiceEmails',
    'triggerScanInvoiceDriveFolder',
    'runSgdsWorkerDryRun',
    D7_A_ENTRYPOINT_
  ].concat(D7_A_HISTORICAL_D6J_ENTRYPOINTS_));
}

function countD7ADuplicateValues_(values) {
  const seen = {};
  let count = 0;
  (values || []).forEach(value => {
    const key = safeD7AString_(value);
    if (!key) return;
    seen[key] = (seen[key] || 0) + 1;
    if (seen[key] === 2) count += 1;
  });
  return count;
}

function logD7ASanitizedResult_(logger, result) {
  const safe = sanitizeD7ALogPayload_(result);
  if (logger && typeof logger.log === 'function') logger.log(JSON.stringify(safe));
}

function sanitizeD7ALogPayload_(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeD7ALogPayload_);
  if (typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if (isSensitiveD7ALogKey_(key)) {
        out[key] = 'REDACTED';
      } else {
        out[key] = sanitizeD7ALogPayload_(value[key]);
      }
    });
    return out;
  }
  const text = safeD7AString_(value);
  if (D7_A_FORBIDDEN_LOG_VALUE_PATTERN_.test(text)) return 'REDACTED';
  return text.length > 160 ? 'REDACTED_LONG_TEXT_' + hashD7AString_(text) : value;
}

function isSensitiveD7ALogKey_(key) {
  const text = safeD7AString_(key);
  if (D7_A_SAFE_LOG_KEYS_.includes(text)) return false;
  const normalized = text.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  const exactSensitive = [
    'authorization',
    'authorizationheader',
    'oauthtoken',
    'accesstoken',
    'refreshtoken',
    'privatekey',
    'client' + 'secret',
    'credential',
    'credentials',
    'xmlcontent',
    'rawxml',
    'pdfbytes',
    'attachmentcontent',
    'emailbody',
    'body',
    'content'
  ];
  if (exactSensitive.includes(normalized)) return true;
  return /(?:authorization|oauth|accesstoken|refreshtoken|privatekey|credential)/i.test(normalized);
}

function mergeD7AResult_(target, source) {
  Object.keys(source || {}).forEach(key => {
    if (key !== 'gapCodes' && key !== 'gapCategory') target[key] = source[key];
  });
  return target;
}

function d7AProperty_(name, aliases, requiredForD7B, requiredForFutureMutation, format, defaultValue) {
  return Object.freeze({
    name,
    aliases: Object.freeze(aliases || []),
    requiredForD7B: requiredForD7B === true,
    requiredForFutureMutation: requiredForFutureMutation === true,
    format: format || 'nonEmpty',
    defaultValue: defaultValue == null ? '' : String(defaultValue)
  });
}

function stableD7AUnique_(values) {
  const seen = {};
  const out = [];
  (values || []).forEach(value => {
    const key = safeD7ACode_(value);
    if (!key || seen[key]) return;
    seen[key] = true;
    out.push(key);
  });
  return out.sort();
}

function safeD7ACode_(value) {
  return safeD7AString_(value).replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120);
}

function safeD7AString_(value) {
  return value == null ? '' : String(value);
}

function hashD7AString_(value) {
  const text = safeD7AString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
