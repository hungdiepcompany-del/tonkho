const D7_E3G_SCHEMA_VERSION_ = 'D7_E3G_PARTIAL_STATE_READ_ONLY_DIAGNOSTIC_V1';
const D7_E3G_PHASE_ = 'D7_E3G_OWNER_APPROVED_READ_ONLY_DIAGNOSTIC_CHANNEL_FOR_PARTIAL_STATE';
const D7_E3G_PUBLIC_ENTRYPOINT_ = 'runD7EPartialStateReadOnlyDiagnostic';
const D7_E3G_EXPECTED_CANDIDATE_FINGERPRINT_ = '3a9aed9dd9050acf6a7b2b59fa47b662a87d3dde011d5cec277f42e223ac79bc';
const D7_E3G_EXPECTED_INVOICE_KEY_HASH_ = 'd7b9112f07b5df9cb0c3acedecda88d560baa5bc31e61d7f7a63aca41a54b614';
const D7_E3G_EXPECTED_ATTACHMENT_SET_SHA256_ = '8b548919f7b0f1035a264a7fb1b92ba978a32a047edf0d75d18c54072660af58';
const D7_E3G_EXPECTED_PDF_SHA256_ = '7c8f7b7a577d9fd83ff1581408113b956166ed95f13704aaed2a3769d8136b07';
const D7_E3G_EXPECTED_XML_SHA256_ = 'cbf4cc62c466e8a94561f862685241060e0302e3ac9067cdacf8bdf4ede984f3';
const D7_E3G_EXPECTED_PILOT_ID_HASH_PREFIX_ = '449e26ed0d0c4e6e';
const D7_E3G_EXPECTED_CORRELATION_ID_HASH_PREFIX_ = 'a3a3c9fd963b0b6b';
const D7_E3G_EXPECTED_JOB_ID_HASH_PREFIX_ = 'b9e4386aa755b9dc';
const D7_E3G_MAX_DRIVE_CANDIDATES_PER_ARTIFACT_ = 10;
const D7_E3G_FIRESTORE_PROJECT_ID_ = 'tonkhohd';
const D7_E3G_FIRESTORE_DATABASE_ID_ = '(default)';

function createD7EPartialStateReadOnlyDiagnosticRunner_(deps) {
  const d = deps || {};
  const services = {
    readProperties: d.readProperties || readD7E3GScriptPropertiesReadOnly_,
    rediscoverCandidate: d.rediscoverCandidate || rediscoverD7E3GCandidateReadOnly_,
    reconstructPlan: d.reconstructPlan || reconstructD7E3GPlanReadOnly_,
    inspectFirestore: d.inspectFirestore || inspectD7E3GFirestoreReadOnly_,
    inspectDriveAdapter: d.inspectDriveAdapter || inspectD7E3GDriveAdapterReadOnly_,
    inspectDriveRaw: d.inspectDriveRaw || inspectD7E3GDriveRawReadOnly_,
    inspectSheets: d.inspectSheets || inspectD7E3GSheetsReadOnly_,
    inspectGmail: d.inspectGmail || inspectD7E3GGmailReadOnly_,
    inspectTriggers: d.inspectTriggers || listD7BProjectTriggersReadOnly_,
    now: d.now || (() => new Date().toISOString()),
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log() {} })
  };

  async function run() {
    const result = createD7E3GBaseResult_();
    try {
      const properties = services.readProperties() || {};
      const before = await collectD7E3GSnapshot_(properties, services, 'BEFORE');
      const after = await collectD7E3GSnapshot_(properties, services, 'AFTER');
      mergeD7E3GResult_(result, before.result || {});
      result.BEFORE_SNAPSHOT_COLLECTED = before.collected ? 'YES' : 'NO';
      result.AFTER_SNAPSHOT_COLLECTED = after.collected ? 'YES' : 'NO';
      result.BEFORE_AFTER_SNAPSHOT_MATCH = stableD7E3GJson_(before.signature || {}) === stableD7E3GJson_(after.signature || {}) ? 'YES' : 'NO';
      result.CONCURRENT_EXTERNAL_CHANGE_DETECTED = result.BEFORE_AFTER_SNAPSHOT_MATCH === 'YES' ? 'NO' : 'YES';
      if (result.BEFORE_AFTER_SNAPSHOT_MATCH !== 'YES') {
        result.STATUS = 'BLOCKED_CONCURRENT_EXTERNAL_CHANGE_DURING_READ_ONLY_DIAGNOSTIC';
        result.PARTIAL_STATE = 'FORENSICS_UNSTABLE';
        result.NEXT_ACTION = 'OWNER_REVIEW_REQUIRED';
        result.NEXT_SAFE_PHASE = 'NONE_UNTIL_OWNER_REVIEW';
        result.NEXT_REQUIRED_OWNER_MARKER = 'NONE';
        result.BLOCKER = result.STATUS;
      } else {
        classifyD7E3GResult_(result);
      }
    } catch (error) {
      result.STATUS = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'BLOCKED_D7_E3G_UNKNOWN');
      result.BLOCKER = result.STATUS;
      result.PARTIAL_STATE = 'READ_ONLY_FORENSICS_INCOMPLETE';
      result.NEXT_ACTION = 'OWNER_AUTH_OR_DIAGNOSTIC_CHANNEL_REVIEW';
      result.NEXT_SAFE_PHASE = 'NONE_UNTIL_READ_ACCESS_RESOLVED';
      result.NEXT_REQUIRED_OWNER_MARKER = 'NONE';
    }
    finalizeD7E3GTripwire_(result);
    const safe = sanitizeD7E3GObject_(result);
    logD7E3GSanitizedResult_(services.logger, safe);
    return safe;
  }

  return Object.freeze({ run });
}

async function collectD7E3GSnapshot_(properties, services, stage) {
  const result = {};
  try {
    const rediscovery = services.rediscoverCandidate(properties, stage);
    mergeD7E3GResult_(result, rediscovery.summary || {});
    result.CANDIDATE_REDISCOVERY_STATUS = rediscovery.status;
    if (rediscovery.status !== 'PASS') throw d7e3gError_(rediscovery.status || 'BLOCKED_D7_E3G_CANDIDATE_REDISCOVERY');

    const planContext = await services.reconstructPlan({
      properties,
      precheck: rediscovery.precheck,
      candidate: rediscovery.candidate,
      fingerprint: rediscovery.fingerprint,
      config: rediscovery.config,
      now: services.now()
    });
    mergeD7E3GResult_(result, planContext.summary || {});
    if (!planContext.plan) throw d7e3gError_('BLOCKED_D7_E3G_PLAN_RECONSTRUCTION');

    mergeD7E3GResult_(result, await services.inspectFirestore({ properties, precheck: rediscovery.precheck, plan: planContext.plan, now: services.now() }) || {});
    mergeD7E3GResult_(result, await services.inspectDriveAdapter({ properties, precheck: rediscovery.precheck, plan: planContext.plan }) || {});
    mergeD7E3GResult_(result, await services.inspectDriveRaw({ properties, precheck: rediscovery.precheck, plan: planContext.plan, config: rediscovery.config }) || {});
    mergeD7E3GResult_(result, await services.inspectSheets({ properties, precheck: rediscovery.precheck, plan: planContext.plan }) || {});
    mergeD7E3GResult_(result, await services.inspectGmail({ properties, precheck: rediscovery.precheck, candidate: rediscovery.candidate, plan: planContext.plan }) || {});
    return { collected: true, result, signature: buildD7E3GSnapshotSignature_(result) };
  } catch (error) {
    result.BLOCKER = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'BLOCKED_D7_E3G_SNAPSHOT');
    return { collected: false, result, signature: buildD7E3GSnapshotSignature_(result) };
  }
}

function rediscoverD7E3GCandidateReadOnly_(properties) {
  const config = resolveD7BEffectiveConfig_(properties || {});
  const summary = {
    EFFECTIVE_CONFIG_STATUS: config.valid ? 'PASS' : 'BLOCKED_INVALID_EFFECTIVE_CONFIG',
    CANDIDATE_DISCOVERY_EXECUTED: 'NO',
    RUNTIME_SOURCE_CONTRACT_INSPECTION: 'PASS_STATIC_APPS_SCRIPT_CONTRACT',
    TRIGGER_INSPECTION_STATUS: 'NOT_EVALUATED'
  };
  mergeD7E3GResult_(summary, config.summary || {});
  if (!config.valid) return { status: 'BLOCKED_INVALID_D7_B_EFFECTIVE_CONFIG', candidates: [], summary };
  mergeD7E3GResult_(summary, inspectD7E3GTriggersReadOnly_());
  const adapters = {
    gmailSearch: searchD7BGmailReadOnly_,
    deriveInvoiceIdentity: deriveD7BInvoiceIdentity_
  };
  const gmail = discoverD7E3GGmailCandidatesReadOnly_(adapters, config);
  mergeD7E3GResult_(summary, gmail.summary || {});
  summary.CANDIDATE_DISCOVERY_EXECUTED = 'YES_READ_ONLY';
  if (gmail.status !== 'PASS') return { status: gmail.status, candidates: gmail.candidates || [], summary };
  const cardinality = classifyD7BCardinality_(gmail.candidates);
  mergeD7E3GResult_(summary, cardinality.summary || {});
  if (cardinality.status !== 'PASS') return { status: cardinality.status, candidates: gmail.candidates || [], summary };
  const candidate = gmail.candidates[0];
  const fingerprint = createD7BCandidateFingerprint_(candidate, config, adapters);
  mergeD7E3GResult_(summary, fingerprint.summary || {});
  if (fingerprint.status !== 'PASS') return { status: fingerprint.status, candidate, fingerprint, summary };
  summary.CANDIDATE_FINGERPRINT_MATCH = normalizeD7E3GString_(summary.CANDIDATE_FINGERPRINT) === D7_E3G_EXPECTED_CANDIDATE_FINGERPRINT_ ? 'YES' : 'NO';
  summary.INVOICE_KEY_HASH_MATCH = normalizeD7E3GString_(summary.INVOICE_KEY_HASH) === D7_E3G_EXPECTED_INVOICE_KEY_HASH_ ? 'YES' : 'NO';
  summary.ATTACHMENT_SET_SHA256_MATCH = normalizeD7E3GString_(summary.ATTACHMENT_SET_SHA256) === D7_E3G_EXPECTED_ATTACHMENT_SET_SHA256_ ? 'YES' : 'NO';
  summary.XML_SOURCE_SHA256_MATCH = normalizeD7E3GString_(summary.XML_SHA256) === D7_E3G_EXPECTED_XML_SHA256_ ? 'YES' : 'NO';
  summary.PDF_SOURCE_SHA256_MATCH = normalizeD7E3GString_(summary.PDF_SHA256) === D7_E3G_EXPECTED_PDF_SHA256_ ? 'YES' : 'NO';
  summary.ELIGIBLE_CANDIDATE_COUNT = 1;
  summary.GMAIL_CANDIDATE_CARDINALITY = 1;
  summary.CANDIDATE_REDISCOVERY_STATUS = 'PASS';
  if (summary.CANDIDATE_FINGERPRINT_MATCH !== 'YES') return { status: 'BLOCKED_D7_E3G_CANDIDATE_FINGERPRINT_MISMATCH', candidate, fingerprint, summary };
  if (summary.INVOICE_KEY_HASH_MATCH !== 'YES') return { status: 'BLOCKED_D7_E3G_INVOICE_KEY_HASH_MISMATCH', candidate, fingerprint, summary };
  if (summary.ATTACHMENT_SET_SHA256_MATCH !== 'YES') return { status: 'BLOCKED_D7_E3G_ATTACHMENT_SET_HASH_MISMATCH', candidate, fingerprint, summary };
  if (summary.XML_SOURCE_SHA256_MATCH !== 'YES' || summary.PDF_SOURCE_SHA256_MATCH !== 'YES') return { status: 'BLOCKED_D7_E3G_SOURCE_ATTACHMENT_HASH_MISMATCH', candidate, fingerprint, summary };
  return { status: 'PASS', config, candidate, fingerprint, precheck: { config, candidate, fingerprint, summary }, summary };
}

function discoverD7E3GGmailCandidatesReadOnly_(adapters, config) {
  const summary = {
    GMAIL_READ_STATUS: 'NOT_EVALUATED',
    GMAIL_SEARCH_RESULT_COUNT: 0,
    GMAIL_THREAD_COUNT: 0,
    GMAIL_MESSAGE_COUNT: 0,
    INSPECTED_ATTACHMENT_COUNT: 0,
    ATTACHMENT_VALIDATION_STATUS: 'NOT_EVALUATED',
    ELIGIBLE_CANDIDATE_COUNT: 0
  };
  let threads;
  try {
    threads = adapters.gmailSearch(config.boundedQuery, 0, config.maxResults) || [];
  } catch (error) {
    summary.GMAIL_READ_STATUS = 'READ_BLOCKED';
    summary.BLOCKER = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'GMAIL_READ_BLOCKED');
    return { status: 'BLOCKED_GMAIL_READ_FAILURE', candidates: [], summary };
  }
  summary.GMAIL_READ_STATUS = 'READ_OK';
  summary.GMAIL_SEARCH_RESULT_COUNT = threads.length;
  summary.GMAIL_THREAD_COUNT = threads.length;
  const candidates = [];
  let malformedAttachmentCount = 0;
  threads.forEach(function (thread, threadIndex) {
    const messages = safeD7E3GCall_(function () { return thread.getMessages(); }, []) || [];
    const boundedMessages = messages.slice(0, D7_B_MAX_MESSAGES_PER_THREAD_);
    summary.GMAIL_MESSAGE_COUNT += boundedMessages.length;
    boundedMessages.forEach(function (message, messageIndex) {
      const normalized = normalizeD7BGmailMessage_(message, config, threadIndex, messageIndex);
      const validation = validateD7BAttachments_(normalized.attachments);
      summary.INSPECTED_ATTACHMENT_COUNT += Number(normalized.attachmentCount || 0);
      if (normalized.subjectMatches && normalized.senderMatches && normalized.dateMatches && validation.status === 'PASS') {
        candidates.push(mergeD7E3GResult_({ threadIndex, messageIndex, threadRef: thread, messageRef: message, message: normalized }, validation.candidate));
      } else if (validation.status === 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE') {
        malformedAttachmentCount += 1;
      }
    });
  });
  summary.ELIGIBLE_CANDIDATE_COUNT = candidates.length;
  summary.ATTACHMENT_VALIDATION_STATUS = malformedAttachmentCount > 0 && candidates.length === 0 ? 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE' : 'PASS';
  if (summary.ATTACHMENT_VALIDATION_STATUS !== 'PASS') return { status: 'BLOCKED_ATTACHMENT_VALIDATION_FAILURE', candidates, summary };
  return { status: 'PASS', candidates, summary };
}

async function reconstructD7E3GPlanReadOnly_(context) {
  const source = context || {};
  const precheck = source.precheck || {
    config: source.config,
    candidate: source.candidate,
    fingerprint: source.fingerprint,
    summary: source.fingerprint && source.fingerprint.summary || {}
  };
  const ledgerRows = await buildD7ELedgerRowsFromCandidate_({
    properties: source.properties || {},
    candidate: precheck.candidate,
    fingerprint: precheck.fingerprint,
    config: precheck.config
  });
  const plan = buildD7EMutationPlan_({ properties: source.properties || {}, precheck, ledgerRows, now: source.now || new Date().toISOString() });
  const row = ledgerRows[0] || {};
  const summary = {
    EXPECTED_JOB_ID_DERIVED: plan && plan.jobId ? 'YES' : 'NO',
    EXPECTED_JOB_ID_HASH_PREFIX: hashPrefixD7E_(plan && plan.jobId, 16),
    EXPECTED_JOB_ID_HASH_PREFIX_MATCH: hashPrefixD7E_(plan && plan.jobId, 16) === D7_E3G_EXPECTED_JOB_ID_HASH_PREFIX_ ? 'YES' : 'NO',
    EXPECTED_LEDGER_ROW_COUNT: ledgerRows.length,
    EXPECTED_XML_LOGICAL_IDENTITY_DERIVED: plan.driveTargets && plan.driveTargets.xml && plan.driveTargets.xml.logicalFileIdentity ? 'YES' : 'NO',
    EXPECTED_PDF_LOGICAL_IDENTITY_DERIVED: plan.driveTargets && plan.driveTargets.pdf && plan.driveTargets.pdf.logicalFileIdentity ? 'YES' : 'NO',
    EXPECTED_SHEET_TRANSACTION_IDENTITY_DERIVED: row.transactionIdentity ? 'YES' : 'NO',
    EXPECTED_PILOT_ID_HASH_PREFIX_MATCH: plan.pilotIdHashPrefix === D7_E3G_EXPECTED_PILOT_ID_HASH_PREFIX_ ? 'YES' : 'NO',
    EXPECTED_CORRELATION_ID_HASH_PREFIX_PRESENT: plan.correlationIdHashPrefix ? 'YES' : 'NO'
  };
  if (summary.EXPECTED_JOB_ID_HASH_PREFIX_MATCH !== 'YES') throw d7e3gError_('BLOCKED_D7_E3G_JOB_ID_HASH_PREFIX_MISMATCH');
  if (summary.EXPECTED_LEDGER_ROW_COUNT !== 1) throw d7e3gError_('BLOCKED_D7_E3G_EXPECTED_LEDGER_ROW_COUNT');
  return { plan, ledgerRows, summary };
}

async function inspectD7E3GFirestoreReadOnly_(context) {
  const result = {
    FIRESTORE_READ_STATUS: 'NOT_EVALUATED',
    FIRESTORE_JOB_FOUND: 'NO',
    FIRESTORE_JOB_IDENTITY_MATCH: 'NO',
    FIRESTORE_JOB_STATUS: 'NOT_FOUND',
    FIRESTORE_JOB_RECONCILIATION_STATUS: 'NOT_FOUND',
    FIRESTORE_JOB_VERSION_PRESENT: 'NO',
    FIRESTORE_COMMIT_PLAN_FOUND: 'NO',
    FIRESTORE_COMMIT_PLAN_IDENTITY_MATCH: 'NO',
    FIRESTORE_COMMIT_PLAN_HASH_MATCH: 'NO',
    FIRESTORE_LEASE_FOUND: 'NO',
    FIRESTORE_LEASE_STATUS: 'NOT_FOUND',
    FIRESTORE_LEASE_OWNER_MATCH: 'NO',
    FIRESTORE_LEASE_EXPIRED: 'NO',
    FIRESTORE_AUDIT_EVENT_COUNT: 0,
    FIRESTORE_RECONCILIATION_REPORT_FOUND: 'NO',
    FIRESTORE_RECONCILIATION_STATUS: 'NOT_FOUND',
    FIRESTORE_RECONCILIATION_FINDING_CODES: 'NONE',
    FIRESTORE_ATTACHMENT_RECORD_COUNT: 0,
    FIRESTORE_MUTATION_ATTEMPT_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0
  };
  try {
    const plan = context.plan || {};
    const client = createD7E3GFirestoreRestReadOnlyClient_();
    const job = await client.getDocument('invoiceJobs/' + plan.jobId);
    result.FIRESTORE_READ_STATUS = 'READ_OK';
    if (job) {
      result.FIRESTORE_JOB_FOUND = 'YES';
      result.FIRESTORE_JOB_IDENTITY_MATCH = normalizeD7E3GString_(job.invoiceIdentityHash) === durableIdentityHashPrefixD7E_(plan.invoiceIdentityHash) ? 'YES' : 'NO';
      result.FIRESTORE_JOB_STATUS = normalizeD7E3GString_(job.status || 'UNKNOWN');
      result.FIRESTORE_JOB_RECONCILIATION_STATUS = normalizeD7E3GString_(job.reconciliationStatus || 'NOT_RUN');
      result.FIRESTORE_JOB_VERSION_PRESENT = Number(job.version || 0) > 0 ? 'YES' : 'NO';
      if (job.commitPlan) {
        const storedPlanHash = durableFirestoreHashPrefix_(stableDurableFirestoreJson_(job.commitPlan));
        const expectedPlanHash = durableFirestoreHashPrefix_(stableDurableFirestoreJson_(plan.commitPlan));
        result.FIRESTORE_COMMIT_PLAN_FOUND = 'YES';
        result.FIRESTORE_COMMIT_PLAN_IDENTITY_MATCH = normalizeD7E3GString_(job.commitPlan.jobId) === normalizeD7E3GString_(plan.jobId) ? 'YES' : 'NO';
        result.FIRESTORE_COMMIT_PLAN_HASH_MATCH = storedPlanHash === expectedPlanHash && (!job.commitPlanHash || normalizeD7E3GString_(job.commitPlanHash) === storedPlanHash) ? 'YES' : 'NO';
      }
    }
    const lease = await client.getDocument('worker_leases/' + plan.jobId);
    if (lease) {
      result.FIRESTORE_LEASE_FOUND = 'YES';
      result.FIRESTORE_LEASE_STATUS = normalizeD7E3GString_(lease.status || 'UNKNOWN');
      result.FIRESTORE_LEASE_OWNER_MATCH = normalizeD7E3GString_(lease.leaseOwner) === 'apps_script_d7_e' ? 'YES' : 'NO';
      result.FIRESTORE_LEASE_EXPIRED = isD7E3GTimestampExpired_(lease.expiresAt, context.now) ? 'YES' : 'NO';
    }
    const events = await client.listCollection('invoiceJobs/' + plan.jobId + '/events', 10);
    result.FIRESTORE_AUDIT_EVENT_COUNT = events.length;
    let report = null;
    if (job && job.latestReconciliationReportId) report = await client.getDocument('invoiceJobs/' + plan.jobId + '/reconciliationReports/' + job.latestReconciliationReportId);
    if (!report) {
      const reports = await client.listCollection('invoiceJobs/' + plan.jobId + '/reconciliationReports', 10);
      report = reports[0] || null;
    }
    if (report) {
      result.FIRESTORE_RECONCILIATION_REPORT_FOUND = 'YES';
      result.FIRESTORE_RECONCILIATION_STATUS = normalizeD7E3GString_(report.status || 'UNKNOWN');
      const codes = (report.findings || []).map(function (finding) {
        return normalizeD7E3GErrorCode_(finding && finding.code || '');
      }).filter(Boolean);
      result.FIRESTORE_RECONCILIATION_FINDING_CODES = codes.join(',') || 'NONE';
    }
    let attachmentCount = 0;
    const records = plan.attachmentRecords || [];
    for (let i = 0; i < records.length; i += 1) {
      const record = records[i] || {};
      const doc = await client.getDocument('attachments/' + record.attachmentId);
      if (doc) attachmentCount += 1;
    }
    result.FIRESTORE_ATTACHMENT_RECORD_COUNT = attachmentCount;
  } catch (error) {
    result.FIRESTORE_READ_STATUS = 'READ_BLOCKED';
    result.FIRESTORE_BLOCKER_CODE = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'FIRESTORE_READ_BLOCKED');
  }
  return result;
}

async function inspectD7E3GDriveAdapterReadOnly_(context) {
  const result = {
    DRIVE_ADAPTER_XML_READ_STATUS: 'NOT_EVALUATED',
    DRIVE_ADAPTER_XML_ERROR_CODE: 'NONE',
    DRIVE_ADAPTER_PDF_READ_STATUS: 'NOT_EVALUATED',
    DRIVE_ADAPTER_PDF_ERROR_CODE: 'NONE'
  };
  try {
    const read = createD7E3GLogicalDriveReadAdapter_(context);
    const xml = await read.readFileMetadata({ logicalFileIdentity: context.plan.driveTargets.xml.logicalFileIdentity });
    result.DRIVE_ADAPTER_XML_READ_STATUS = xml && xml.exists !== false ? 'READ_OK' : 'NOT_FOUND';
    result.ADAPTER_REPORTED_XML_HASH = normalizeD7E3GString_(xml && xml.contentHash);
  } catch (error) {
    result.DRIVE_ADAPTER_XML_READ_STATUS = 'READ_BLOCKED';
    result.DRIVE_ADAPTER_XML_ERROR_CODE = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'DRIVE_XML_ADAPTER_READ_BLOCKED');
  }
  try {
    const read = createD7E3GLogicalDriveReadAdapter_(context);
    const pdf = await read.readFileMetadata({ logicalFileIdentity: context.plan.driveTargets.pdf.logicalFileIdentity });
    result.DRIVE_ADAPTER_PDF_READ_STATUS = pdf && pdf.exists !== false ? 'READ_OK' : 'NOT_FOUND';
    result.ADAPTER_REPORTED_PDF_HASH = normalizeD7E3GString_(pdf && pdf.contentHash);
  } catch (error) {
    result.DRIVE_ADAPTER_PDF_READ_STATUS = 'READ_BLOCKED';
    result.DRIVE_ADAPTER_PDF_ERROR_CODE = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'DRIVE_PDF_ADAPTER_READ_BLOCKED');
  }
  return result;
}

async function inspectD7E3GDriveRawReadOnly_(context) {
  const plan = context.plan || {};
  const result = {
    DRIVE_EXPECTED_FILE_COUNT: 2,
    DRIVE_XML_CANDIDATE_COUNT: 0,
    DRIVE_XML_MATCHED_FILE_COUNT: 0,
    DRIVE_XML_ACTUAL_SHA256: '',
    DRIVE_XML_EXPECTED_SHA256: D7_E3G_EXPECTED_XML_SHA256_,
    DRIVE_XML_HASH_MATCH: 'NO',
    DRIVE_XML_BYTE_SIZE_MATCH: 'NO',
    DRIVE_XML_MIME_TYPE_MATCH: 'NO',
    DRIVE_XML_LOGICAL_IDENTITY_MATCH: 'NO',
    DRIVE_XML_DESTINATION_MATCH: 'NO',
    DRIVE_XML_STORED_METADATA_HASH_MATCH: 'NOT_AVAILABLE',
    DRIVE_PDF_CANDIDATE_COUNT: 0,
    DRIVE_PDF_MATCHED_FILE_COUNT: 0,
    DRIVE_PDF_ACTUAL_SHA256: '',
    DRIVE_PDF_EXPECTED_SHA256: D7_E3G_EXPECTED_PDF_SHA256_,
    DRIVE_PDF_HASH_MATCH: 'NO',
    DRIVE_PDF_BYTE_SIZE_MATCH: 'NO',
    DRIVE_PDF_MIME_TYPE_MATCH: 'NO',
    DRIVE_PDF_LOGICAL_IDENTITY_MATCH: 'NO',
    DRIVE_PDF_DESTINATION_MATCH: 'NO',
    DRIVE_PDF_STORED_METADATA_HASH_MATCH: 'NOT_AVAILABLE',
    DRIVE_MATCHED_FILE_COUNT: 0,
    DRIVE_EXTRA_CONFLICT_FILE_COUNT: 0,
    DRIVE_DUPLICATE_STATUS: 'NOT_EVALUATED',
    DRIVE_READ_STATUS: 'NOT_EVALUATED',
    DRIVE_MUTATION_ATTEMPT_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SOURCE_XML_HASH: D7_E3G_EXPECTED_XML_SHA256_,
    EXPECTED_XML_HASH: D7_E3G_EXPECTED_XML_SHA256_,
    ACTUAL_DRIVE_XML_BLOB_HASH: '',
    STORED_XML_METADATA_HASH: 'NOT_AVAILABLE',
    DRIVE_XML_CONFLICT_CLASSIFICATION: 'XML_CONFLICT_ROOT_CAUSE_NOT_PROVEN',
    D7_E_CALLED_D6J_C_PUBLIC_ENTRYPOINT: 'NO',
    D7_E_REUSED_D6J_C_PRIVATE_DRIVE_HELPER: 'YES',
    HISTORICAL_ERROR_CODE_PREFIX_ONLY: 'YES'
  };
  try {
    const folder = DriveApp.getFolderById(plan.driveTargets.xml.folderReference || (context.config && context.config.folderId));
    const xml = inspectD7E3GDriveArtifactRaw_(folder, plan.driveTargets.xml, D7_E3G_EXPECTED_XML_SHA256_);
    const pdf = inspectD7E3GDriveArtifactRaw_(folder, plan.driveTargets.pdf, D7_E3G_EXPECTED_PDF_SHA256_);
    mergeD7E3GResult_(result, prefixD7E3GArtifactResult_('DRIVE_XML_', xml));
    mergeD7E3GResult_(result, prefixD7E3GArtifactResult_('DRIVE_PDF_', pdf));
    result.DRIVE_MATCHED_FILE_COUNT = Number(result.DRIVE_XML_MATCHED_FILE_COUNT || 0) + Number(result.DRIVE_PDF_MATCHED_FILE_COUNT || 0);
    result.DRIVE_EXTRA_CONFLICT_FILE_COUNT = Number(xml.conflictCount || 0) + Number(pdf.conflictCount || 0);
    result.ACTUAL_DRIVE_XML_BLOB_HASH = result.DRIVE_XML_ACTUAL_SHA256 || '';
    result.STORED_XML_METADATA_HASH = xml.storedMetadataHash || 'NOT_AVAILABLE';
    result.DRIVE_XML_STORED_METADATA_HASH_MATCH = xml.storedMetadataHashMatch || 'NOT_AVAILABLE';
    result.DRIVE_PDF_STORED_METADATA_HASH_MATCH = pdf.storedMetadataHashMatch || 'NOT_AVAILABLE';
    result.DRIVE_DUPLICATE_STATUS = classifyD7E3GDriveDuplicateStatus_(xml, pdf);
    result.DRIVE_XML_CONFLICT_CLASSIFICATION = classifyD7E3GXmlConflict_(result, xml);
    result.DRIVE_READ_STATUS = xml.readStatus === 'READ_OK' && pdf.readStatus === 'READ_OK' ? 'READ_OK' : 'READ_BLOCKED';
  } catch (error) {
    result.DRIVE_READ_STATUS = 'READ_BLOCKED';
    result.DRIVE_BLOCKER_CODE = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'DRIVE_READ_BLOCKED');
  }
  return result;
}

function inspectD7E3GDriveArtifactRaw_(folder, target, expectedHash) {
  const candidates = [];
  const iterator = folder.getFilesByName(target.fileName);
  while (iterator.hasNext()) {
    if (candidates.length >= D7_E3G_MAX_DRIVE_CANDIDATES_PER_ARTIFACT_) {
      return { readStatus: 'READ_OK', candidateCount: D7_E3G_MAX_DRIVE_CANDIDATES_PER_ARTIFACT_ + 1, matchedFileCount: 0, conflictCount: D7_E3G_MAX_DRIVE_CANDIDATES_PER_ARTIFACT_ + 1, actualSha256: '', hashMatch: 'NO', byteSizeMatch: 'NO', mimeTypeMatch: 'NO', logicalIdentityMatch: 'NO', destinationMatch: 'NO', storedMetadataHashMatch: 'NOT_AVAILABLE', storedMetadataHash: 'NOT_AVAILABLE' };
    }
    const file = iterator.next();
    const blob = file.getBlob();
    const bytes = blob.getBytes() || [];
    const actualHash = sha256D7E3GBytes_(bytes);
    const mimeType = normalizeD7E3GString_(file.getMimeType ? file.getMimeType() : blob.getContentType && blob.getContentType());
    const byteSize = Number(file.getSize ? file.getSize() : bytes.length);
    const advanced = readD7E3GDriveAdvancedMetadata_(file);
    const storedHash = normalizeD7E3GString_(advanced.contentHash || advanced.sha256 || '');
    const metadataLogical = normalizeD7E3GString_(advanced.logicalFileIdentity || '');
    const matched = actualHash === expectedHash && actualHash === normalizeD7E3GString_(target.contentHash) && Number(byteSize) === Number(target.byteSize || bytes.length) && mimeType === normalizeD7E3GString_(target.mimeType);
    candidates.push({ actualHash, byteSize, mimeType, storedHash, metadataLogical, matched });
  }
  const matched = candidates.filter(function (candidate) { return candidate.matched; });
  const primary = matched[0] || candidates[0] || {};
  const storedMetadataHashMatch = primary.storedHash ? (primary.storedHash === expectedHash ? 'YES' : 'NO') : 'NOT_AVAILABLE';
  const logicalIdentityMatch = primary.metadataLogical ? (primary.metadataLogical === normalizeD7E3GString_(target.logicalFileIdentity) ? 'YES' : 'NO') : (matched.length === 1 ? 'YES' : 'NO');
  return { readStatus: 'READ_OK', candidateCount: candidates.length, matchedFileCount: matched.length, conflictCount: candidates.length - matched.length, actualSha256: primary.actualHash || '', hashMatch: matched.length === 1 ? 'YES' : 'NO', byteSizeMatch: matched.length === 1 ? 'YES' : 'NO', mimeTypeMatch: matched.length === 1 ? 'YES' : 'NO', logicalIdentityMatch, destinationMatch: matched.length === 1 ? 'YES' : 'NO', storedMetadataHashMatch, storedMetadataHash: primary.storedHash || 'NOT_AVAILABLE' };
}

async function inspectD7E3GSheetsReadOnly_(context) {
  const result = { SHEET_READ_STATUS: 'NOT_EVALUATED', SHEET_SCHEMA_STATUS: 'NOT_EVALUATED', SHEET_CANONICAL_MATCHING_ROW_COUNT: 0, SHEET_EXACT_MATCHING_ROW_COUNT: 0, SHEET_CONFLICTING_ROW_COUNT: 0, SHEET_ROWS_CREATED_BY_D7_E_ATTEMPT: 0, SHEET_DUPLICATE_STATUS: 'NOT_EVALUATED', SHEETS_MUTATION_ATTEMPT_COUNT: 0, SHEETS_MUTATION_COUNT: 0 };
  try {
    validateD7ESheetSchemaReadOnly_(context.properties || {}, context.precheck && context.precheck.config || {});
    result.SHEET_SCHEMA_STATUS = 'PASS';
    const read = createD7E3GLogicalSheetsReadAdapter_(context);
    const row = context.plan.ledgerRows[0] || {};
    const found = await read.findTransactionByIdentity({ transactionIdentity: row.transactionIdentity, legacyHashIndex: row.legacyHashIndex, hashIndex: row.legacyHashIndex, invoiceKeyV2: row.invoiceKeyV2, legacyInvoiceKey: row.legacyInvoiceKey });
    const rows = (found && found.rows) || [];
    result.SHEET_READ_STATUS = 'READ_OK';
    result.SHEET_DUPLICATE_STATUS = normalizeD7E3GString_(found && found.status || 'CONFIRMED_NOT_WRITTEN');
    result.SHEET_CANONICAL_MATCHING_ROW_COUNT = rows.length;
    result.SHEET_EXACT_MATCHING_ROW_COUNT = rows.filter(function (actual) { return d7E3GLedgerRowMatches_(actual, row); }).length;
    result.SHEET_CONFLICTING_ROW_COUNT = rows.length - result.SHEET_EXACT_MATCHING_ROW_COUNT;
    result.SHEET_ROWS_CREATED_BY_D7_E_ATTEMPT = result.SHEET_EXACT_MATCHING_ROW_COUNT;
  } catch (error) {
    result.SHEET_READ_STATUS = 'READ_BLOCKED';
    result.SHEET_SCHEMA_STATUS = result.SHEET_SCHEMA_STATUS === 'PASS' ? 'PASS' : 'NOT_VERIFIED_TOKEN_SCOPE_OR_PERMISSION';
    result.SHEET_BLOCKER_CODE = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'SHEET_READ_BLOCKED');
  }
  return result;
}

async function inspectD7E3GGmailReadOnly_(context) {
  const result = { GMAIL_READ_STATUS: 'NOT_EVALUATED', GMAIL_CANDIDATE_FOUND: 'NO', GMAIL_CANDIDATE_CARDINALITY: 0, GMAIL_MESSAGE_COUNT: 0, GMAIL_XML_ATTACHMENT_COUNT: 0, GMAIL_PDF_ATTACHMENT_COUNT: 0, GMAIL_COMPLETION_LABEL_PRESENT: 'NO', GMAIL_PROJECTION_MUTATION_FOUND: 'NO', GMAIL_CANDIDATE_FINGERPRINT_STILL_MATCHES: 'NO', GMAIL_MUTATION_ATTEMPT_COUNT: 0, GMAIL_MUTATION_COUNT: 0 };
  try {
    const candidate = context.candidate || {};
    const thread = candidate.threadRef || (candidate.messageRef && candidate.messageRef.getThread && candidate.messageRef.getThread());
    const messages = thread && thread.getMessages ? thread.getMessages() : [];
    const labels = thread && thread.getLabels ? thread.getLabels() : [];
    result.GMAIL_READ_STATUS = 'READ_OK';
    result.GMAIL_CANDIDATE_FOUND = candidate && candidate.message ? 'YES' : 'NO';
    result.GMAIL_CANDIDATE_CARDINALITY = result.GMAIL_CANDIDATE_FOUND === 'YES' ? 1 : 0;
    result.GMAIL_MESSAGE_COUNT = messages.length;
    result.GMAIL_XML_ATTACHMENT_COUNT = countD7E3GAttachments_(candidate, 'XML');
    result.GMAIL_PDF_ATTACHMENT_COUNT = countD7E3GAttachments_(candidate, 'PDF');
    result.GMAIL_COMPLETION_LABEL_PRESENT = labels.some(isD7E3GCompletionLabel_) ? 'YES' : 'NO';
    result.GMAIL_PROJECTION_MUTATION_FOUND = result.GMAIL_COMPLETION_LABEL_PRESENT;
    result.GMAIL_CANDIDATE_FINGERPRINT_STILL_MATCHES = normalizeD7E3GString_(context.precheck && context.precheck.summary && context.precheck.summary.CANDIDATE_FINGERPRINT) === D7_E3G_EXPECTED_CANDIDATE_FINGERPRINT_ ? 'YES' : 'NO';
  } catch (error) {
    result.GMAIL_READ_STATUS = 'READ_BLOCKED';
    result.GMAIL_BLOCKER_CODE = normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'GMAIL_READ_BLOCKED');
  }
  return result;
}

function createD7E3GLogicalDriveReadAdapter_(context) {
  const mapped = mapD7EContextToD6jCContext_(context || {});
  const source = createD6jCGasDriveSource_(mapped);
  return createSgdsDriveReadAdapter_({ source });
}

function createD7E3GLogicalSheetsReadAdapter_(context) {
  const mapped = mapD7EContextToD6jCContext_(context || {});
  const source = createD6jCGasSheetsSource_(mapped);
  return createSgdsSheetsLedgerReadAdapter_({ source });
}

function createD7E3GFirestoreRestReadOnlyClient_() {
  const codec = typeof createFirestoreValueCodec_ === 'function' ? createFirestoreValueCodec_() : null;
  async function getDocument(path) {
    const doc = fetchD7E3GFirestoreReadOnly_('DOCUMENT', path, 0);
    return doc ? decodeD7E3GFirestoreDocument_(doc, codec) : null;
  }
  async function listCollection(path, pageSize) {
    const body = fetchD7E3GFirestoreReadOnly_('COLLECTION', path, pageSize || 10);
    return ((body && body.documents) || []).map(function (doc) { return decodeD7E3GFirestoreDocument_(doc, codec); });
  }
  return Object.freeze({ getDocument, listCollection });
}

function fetchD7E3GFirestoreReadOnly_(kind, path, pageSize) {
  const safePath = kind === 'COLLECTION' ? validateD7E3GFirestoreCollectionPath_(path) : validateD7E3GFirestoreDocumentPath_(path);
  const token = ScriptApp.getOAuthToken();
  let url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(D7_E3G_FIRESTORE_PROJECT_ID_) + '/databases/' + encodeURIComponent(D7_E3G_FIRESTORE_DATABASE_ID_) + '/documents/' + safePath.split('/').map(encodeURIComponent).join('/');
  if (kind === 'COLLECTION') url += '?pageSize=' + encodeURIComponent(String(Math.min(20, Math.max(1, Number(pageSize || 10)))));
  const response = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token } });
  const status = Number(response.getResponseCode());
  const text = String(response.getContentText() || '');
  if (status === 200) return text ? JSON.parse(text) : {};
  if (status === 404) return null;
  const parsed = safeD7E3GJsonParse_(text) || {};
  const error = parsed.error || {};
  throw d7e3gError_(JSON.stringify({ HTTP_STATUS: status, FIRESTORE_PROJECT_ID: D7_E3G_FIRESTORE_PROJECT_ID_, FIRESTORE_DATABASE_ID: D7_E3G_FIRESTORE_DATABASE_ID_, FIRESTORE_REQUEST_PATH_HASH_PREFIX: hashPrefixD7E_(safePath, 16), FIRESTORE_ERROR_STATUS: normalizeD7E3GErrorCode_(error.status || ''), FIRESTORE_ERROR_MESSAGE: sanitizeD7E3GString_(error.message || '') }));
}

function validateD7E3GFirestoreDocumentPath_(path) {
  const text = normalizeD7E3GString_(path);
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9._:-]+(?:\/[A-Za-z0-9_-]+\/[A-Za-z0-9._:-]+)*$/.test(text)) throw d7e3gError_('INVALID_FIRESTORE_DOCUMENT_PATH');
  const collection = text.split('/')[0];
  if (['invoiceJobs', 'worker_leases', 'attachments'].indexOf(collection) < 0) throw d7e3gError_('FIRESTORE_COLLECTION_NOT_ALLOWED');
  return text;
}

function validateD7E3GFirestoreCollectionPath_(path) {
  const text = normalizeD7E3GString_(path);
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9._:-]+\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9._:-]+\/[A-Za-z0-9_-]+)*$/.test(text)) throw d7e3gError_('INVALID_FIRESTORE_COLLECTION_PATH');
  if (text.split('/').length % 2 !== 1) throw d7e3gError_('INVALID_FIRESTORE_COLLECTION_PATH_DEPTH');
  return text;
}

function decodeD7E3GFirestoreDocument_(document, codec) {
  if (!document) return null;
  if (codec && typeof codec.decodeDocument === 'function') return codec.decodeDocument(document);
  const fields = document.fields || {};
  const out = {};
  Object.keys(fields).forEach(function (key) { out[key] = decodeD7E3GFirestoreValue_(fields[key]); });
  return out;
}

function decodeD7E3GFirestoreValue_(value) {
  const source = value || {};
  if (Object.prototype.hasOwnProperty.call(source, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(source, 'booleanValue')) return Boolean(source.booleanValue);
  if (Object.prototype.hasOwnProperty.call(source, 'integerValue')) return Number(source.integerValue);
  if (Object.prototype.hasOwnProperty.call(source, 'doubleValue')) return Number(source.doubleValue);
  if (Object.prototype.hasOwnProperty.call(source, 'stringValue')) return String(source.stringValue);
  if (Object.prototype.hasOwnProperty.call(source, 'timestampValue')) return String(source.timestampValue);
  if (Object.prototype.hasOwnProperty.call(source, 'arrayValue')) return ((source.arrayValue && source.arrayValue.values) || []).map(decodeD7E3GFirestoreValue_);
  if (Object.prototype.hasOwnProperty.call(source, 'mapValue')) {
    const out = {};
    const mapFields = (source.mapValue && source.mapValue.fields) || {};
    Object.keys(mapFields).forEach(function (key) { out[key] = decodeD7E3GFirestoreValue_(mapFields[key]); });
    return out;
  }
  return null;
}

function readD7E3GDriveAdvancedMetadata_(file) {
  try {
    if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.get || !file || !file.getId) return {};
    const metadata = Drive.Files.get(file.getId());
    const out = {};
    const properties = [].concat(metadata && metadata.properties || []).concat(metadata && metadata.appProperties || []);
    properties.forEach(function (property) {
      const key = normalizeD7E3GString_(property && property.key);
      const value = normalizeD7E3GString_(property && property.value);
      if (/^(contentHash|sha256|logicalFileIdentity)$/i.test(key)) out[key] = value;
    });
    return out;
  } catch (_error) {
    return {};
  }
}

function inspectD7E3GTriggersReadOnly_() {
  try {
    const triggers = listD7BProjectTriggersReadOnly_();
    return { TRIGGER_INSPECTION_STATUS: 'READ_OK', TRIGGER_TOTAL_COUNT: triggers.length, MUTATING_TRIGGER_MATCH_COUNT: triggers.filter(function (trigger) { return ['triggerMarkAllInvoiceEmails', 'triggerScanInvoiceDriveFolder'].indexOf(trigger.handlerFunction) >= 0; }).length };
  } catch (error) {
    return { TRIGGER_INSPECTION_STATUS: 'READ_BLOCKED', TRIGGER_BLOCKER_CODE: normalizeD7E3GErrorCode_(error && (error.code || error.message) || 'TRIGGER_READ_BLOCKED') };
  }
}

function prefixD7E3GArtifactResult_(prefix, artifact) {
  const source = artifact || {};
  const out = {};
  out[prefix + 'CANDIDATE_COUNT'] = Number(source.candidateCount || 0);
  out[prefix + 'MATCHED_FILE_COUNT'] = Number(source.matchedFileCount || 0);
  out[prefix + 'ACTUAL_SHA256'] = normalizeD7E3GString_(source.actualSha256);
  out[prefix + 'HASH_MATCH'] = source.hashMatch || 'NO';
  out[prefix + 'BYTE_SIZE_MATCH'] = source.byteSizeMatch || 'NO';
  out[prefix + 'MIME_TYPE_MATCH'] = source.mimeTypeMatch || 'NO';
  out[prefix + 'LOGICAL_IDENTITY_MATCH'] = source.logicalIdentityMatch || 'NO';
  out[prefix + 'DESTINATION_MATCH'] = source.destinationMatch || 'NO';
  return out;
}

function classifyD7E3GDriveDuplicateStatus_(xml, pdf) {
  if (Number(xml.candidateCount || 0) > D7_E3G_MAX_DRIVE_CANDIDATES_PER_ARTIFACT_ || Number(pdf.candidateCount || 0) > D7_E3G_MAX_DRIVE_CANDIDATES_PER_ARTIFACT_) return 'DUPLICATE_FILE_AMBIGUITY';
  if (Number(xml.matchedFileCount || 0) === 1 && Number(pdf.matchedFileCount || 0) === 1 && Number(xml.conflictCount || 0) === 0 && Number(pdf.conflictCount || 0) === 0) return 'NO_CONFLICTING_DUPLICATES';
  if (Number(xml.candidateCount || 0) > 1 || Number(pdf.candidateCount || 0) > 1) return 'DUPLICATE_FILE_AMBIGUITY';
  if (Number(xml.candidateCount || 0) === 0 || Number(pdf.candidateCount || 0) === 0) return 'MISSING_DRIVE_ARTIFACT';
  return 'CONFLICTING_DRIVE_ARTIFACT';
}

function classifyD7E3GXmlConflict_(result, xml) {
  if (result.DRIVE_XML_DESTINATION_MATCH !== 'YES') return 'XML_CONFLICT_DESTINATION_MISMATCH';
  if (result.DRIVE_DUPLICATE_STATUS === 'DUPLICATE_FILE_AMBIGUITY') return 'XML_CONFLICT_DUPLICATE_FILE_AMBIGUITY';
  if (result.DRIVE_XML_HASH_MATCH === 'YES' && result.DRIVE_XML_LOGICAL_IDENTITY_MATCH === 'YES') {
    if (result.DRIVE_ADAPTER_XML_READ_STATUS === 'READ_BLOCKED' && result.DRIVE_ADAPTER_XML_ERROR_CODE.indexOf('HASH_CONFLICT') >= 0) return 'XML_CONFLICT_FALSE_POSITIVE_ADAPTER_HASH_ALGORITHM_MISMATCH';
    if (xml.storedMetadataHash && xml.storedMetadataHash !== 'NOT_AVAILABLE' && xml.storedMetadataHash !== result.DRIVE_XML_EXPECTED_SHA256) return 'XML_CONFLICT_STORED_METADATA_HASH_MISMATCH_BLOB_CONTENT_VALID';
    return 'XML_CONFLICT_NOT_REPRODUCIBLE_CURRENT_FILES_VALID';
  }
  if (result.DRIVE_XML_ACTUAL_SHA256 && result.DRIVE_XML_ACTUAL_SHA256 !== result.DRIVE_XML_EXPECTED_SHA256) return 'XML_CONFLICT_ACTUAL_DRIVE_BLOB_CONTENT_MISMATCH';
  if (result.XML_SOURCE_SHA256_MATCH === 'NO') return 'XML_CONFLICT_SOURCE_ATTACHMENT_CHANGED';
  return 'XML_CONFLICT_ROOT_CAUSE_NOT_PROVEN';
}

function classifyD7E3GResult_(result) {
  result.D7_E_REPORTING_INCONSISTENCY_FOUND = 'YES';
  result.D7_E_REPORTED_PRODUCTION_MUTATION = 'NONE';
  result.D7_E_OBSERVED_PRODUCTION_MUTATION_COUNT = 10;
  result.D7_E_EFFECTIVE_PRODUCTION_MUTATION = 'PARTIAL';
  result.D7_E_REPORTING_FIX_REQUIRED = 'YES';
  if (Number(result.PRODUCTION_MUTATION_COUNT || 0) !== 0) {
    result.STATUS = 'BLOCKED_READ_ONLY_CONTRACT_VIOLATION';
    result.PARTIAL_STATE = 'READ_ONLY_CONTRACT_VIOLATION';
    result.NEXT_ACTION = 'OWNER_REVIEW_REQUIRED';
    result.NEXT_SAFE_PHASE = 'NONE_UNTIL_OWNER_REVIEW';
    result.NEXT_REQUIRED_OWNER_MARKER = 'NONE';
    result.BLOCKER = result.STATUS;
    return result;
  }
  if (hasD7E3GReadBlocker_(result)) {
    result.STATUS = 'BLOCKED_READ_ONLY_FORENSICS_INCOMPLETE';
    result.PARTIAL_STATE = 'READ_ONLY_FORENSICS_INCOMPLETE';
    result.NEXT_ACTION = 'OWNER_AUTH_OR_DIAGNOSTIC_CHANNEL_REVIEW';
    result.NEXT_SAFE_PHASE = 'NONE_UNTIL_READ_ACCESS_RESOLVED';
    result.NEXT_REQUIRED_OWNER_MARKER = 'NONE';
    result.BLOCKER = 'READ_ONLY_DIAGNOSTIC_INCOMPLETE';
    return result;
  }
  if (!firestoreD7E3GExpected_(result)) {
    result.STATUS = 'PASS_D7_E3G_READ_ONLY_DIAGNOSTIC_COMPLETE';
    result.PARTIAL_STATE = 'UNEXPECTED_FIRESTORE_STATE';
    result.NEXT_ACTION = 'OWNER_REVIEW_REQUIRED';
    result.NEXT_SAFE_PHASE = 'NONE_UNTIL_OWNER_REVIEW';
    result.NEXT_REQUIRED_OWNER_MARKER = 'NONE';
    result.BLOCKER = 'UNEXPECTED_FIRESTORE_STATE';
    return result;
  }
  if (Number(result.SHEET_EXACT_MATCHING_ROW_COUNT || 0) > 0 || Number(result.SHEET_CONFLICTING_ROW_COUNT || 0) > 0 || result.GMAIL_PROJECTION_MUTATION_FOUND === 'YES') {
    result.STATUS = 'PASS_D7_E3G_READ_ONLY_DIAGNOSTIC_COMPLETE';
    result.PARTIAL_STATE = 'UNEXPECTED_SHEET_OR_GMAIL_STATE';
    result.NEXT_ACTION = 'OWNER_REVIEW_AND_RECONCILIATION_DESIGN_REQUIRED';
    result.NEXT_SAFE_PHASE = 'D7_E3H_UNEXPECTED_STATE_RECONCILIATION_DESIGN';
    result.NEXT_REQUIRED_OWNER_MARKER = 'OWNER_APPROVE_D7E_UNEXPECTED_STATE_RECONCILIATION_DESIGN_ONLY';
    result.BLOCKER = '';
    return result;
  }
  if (driveD7E3GExpected_(result)) {
    result.STATUS = 'PASS_D7_E3G_READ_ONLY_DIAGNOSTIC_COMPLETE';
    result.PARTIAL_STATE = 'DRIVE_ARTIFACTS_VALID_SHEET_ABSENT_FIRESTORE_RECONCILIATION_REQUIRED';
    result.NEXT_ACTION = 'DESIGN_IDEMPOTENT_RESUME_FROM_VERIFIED_DRIVE_STATE';
    result.NEXT_SAFE_PHASE = 'D7_E3H_VERIFIED_PARTIAL_STATE_RESUME_DESIGN';
    result.NEXT_REQUIRED_OWNER_MARKER = 'OWNER_APPROVE_D7E_VERIFIED_PARTIAL_STATE_RESUME_DESIGN_ONLY';
    result.BLOCKER = '';
    return result;
  }
  result.STATUS = 'PASS_D7_E3G_READ_ONLY_DIAGNOSTIC_COMPLETE';
  result.PARTIAL_STATE = 'DRIVE_ARTIFACT_CONFLICT_REQUIRES_COMPENSATING_ACTION_REVIEW';
  result.NEXT_ACTION = 'DESIGN_OWNER_APPROVED_COMPENSATING_ACTION';
  result.NEXT_SAFE_PHASE = 'D7_E3H_DRIVE_CONFLICT_COMPENSATING_ACTION_DESIGN';
  result.NEXT_REQUIRED_OWNER_MARKER = 'OWNER_APPROVE_D7E_DRIVE_CONFLICT_COMPENSATING_ACTION_DESIGN_ONLY';
  result.BLOCKER = '';
  return result;
}

function hasD7E3GReadBlocker_(result) {
  return [result.CANDIDATE_REDISCOVERY_STATUS, result.FIRESTORE_READ_STATUS, result.DRIVE_READ_STATUS, result.SHEET_READ_STATUS, result.GMAIL_READ_STATUS].some(function (status) {
    return !status || status === 'NOT_EVALUATED' || String(status).indexOf('BLOCKED') >= 0 || String(status).indexOf('READ_BLOCKED') >= 0;
  });
}

function firestoreD7E3GExpected_(result) {
  return result.FIRESTORE_JOB_FOUND === 'YES' && result.FIRESTORE_JOB_IDENTITY_MATCH === 'YES' && result.FIRESTORE_JOB_STATUS === 'VALIDATED' && result.FIRESTORE_JOB_RECONCILIATION_STATUS === 'RECONCILIATION_REQUIRED' && result.FIRESTORE_COMMIT_PLAN_FOUND === 'YES' && result.FIRESTORE_COMMIT_PLAN_IDENTITY_MATCH === 'YES' && result.FIRESTORE_COMMIT_PLAN_HASH_MATCH === 'YES' && result.FIRESTORE_LEASE_STATUS === 'RECONCILIATION_REQUIRED' && result.FIRESTORE_LEASE_EXPIRED === 'YES' && Number(result.FIRESTORE_AUDIT_EVENT_COUNT || 0) === 2 && result.FIRESTORE_RECONCILIATION_REPORT_FOUND === 'YES' && result.FIRESTORE_RECONCILIATION_STATUS === 'RECONCILIATION_REQUIRED' && Number(result.FIRESTORE_ATTACHMENT_RECORD_COUNT || 0) === 0;
}

function driveD7E3GExpected_(result) {
  return Number(result.DRIVE_MATCHED_FILE_COUNT || 0) === 2 && Number(result.DRIVE_EXTRA_CONFLICT_FILE_COUNT || 0) === 0 && result.DRIVE_DUPLICATE_STATUS === 'NO_CONFLICTING_DUPLICATES' && result.DRIVE_XML_HASH_MATCH === 'YES' && result.DRIVE_XML_LOGICAL_IDENTITY_MATCH === 'YES' && result.DRIVE_XML_DESTINATION_MATCH === 'YES' && result.DRIVE_PDF_HASH_MATCH === 'YES' && result.DRIVE_PDF_LOGICAL_IDENTITY_MATCH === 'YES' && result.DRIVE_PDF_DESTINATION_MATCH === 'YES' && Number(result.SHEET_EXACT_MATCHING_ROW_COUNT || 0) === 0 && Number(result.SHEET_CONFLICTING_ROW_COUNT || 0) === 0 && result.GMAIL_PROJECTION_MUTATION_FOUND === 'NO';
}

function createD7E3GBaseResult_() {
  return {
    PHASE: D7_E3G_PHASE_,
    SCHEMA_VERSION: D7_E3G_SCHEMA_VERSION_,
    STATUS: 'NOT_STARTED',
    OWNER_MARKER_SCOPE: 'PREAUTHORIZED_BY_PHASE_PROMPT',
    CURRENT_PHASE_MARKER_PREAUTHORIZED: 'YES',
    FUTURE_MUTATION_MARKERS_PREAUTHORIZED: 'NO',
    DIAGNOSTIC_MODE: 'BOUNDED_EXACT_CANDIDATE_READ_ONLY',
    D7_E3G_EXECUTION_ATTEMPT_COUNT: 1,
    D7_E_RERUN_ATTEMPT_COUNT: 0,
    D6J_C_PUBLIC_ENTRYPOINT_EXECUTION_COUNT: 0,
    CANDIDATE_REDISCOVERY_STATUS: 'NOT_EVALUATED',
    ELIGIBLE_CANDIDATE_COUNT: 0,
    INSPECTED_ATTACHMENT_COUNT: 0,
    CANDIDATE_FINGERPRINT_MATCH: 'NO',
    INVOICE_KEY_HASH_MATCH: 'NO',
    ATTACHMENT_SET_SHA256_MATCH: 'NO',
    XML_SOURCE_SHA256_MATCH: 'NO',
    PDF_SOURCE_SHA256_MATCH: 'NO',
    EXPECTED_JOB_ID_DERIVED: 'NO',
    EXPECTED_JOB_ID_HASH_PREFIX: '',
    EXPECTED_LEDGER_ROW_COUNT: 0,
    EXPECTED_XML_LOGICAL_IDENTITY_DERIVED: 'NO',
    EXPECTED_PDF_LOGICAL_IDENTITY_DERIVED: 'NO',
    EXPECTED_SHEET_TRANSACTION_IDENTITY_DERIVED: 'NO',
    BEFORE_SNAPSHOT_COLLECTED: 'NO',
    AFTER_SNAPSHOT_COLLECTED: 'NO',
    BEFORE_AFTER_SNAPSHOT_MATCH: 'NOT_EVALUATED',
    CONCURRENT_EXTERNAL_CHANGE_DETECTED: 'NOT_EVALUATED',
    FIRESTORE_READ_STATUS: 'NOT_EVALUATED',
    DRIVE_READ_STATUS: 'NOT_EVALUATED',
    SHEET_READ_STATUS: 'NOT_EVALUATED',
    GMAIL_READ_STATUS: 'NOT_EVALUATED',
    SCRIPT_PROPERTY_MUTATION_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION_COUNT: 0,
    PRODUCTION_MUTATION: 'NONE',
    PARTIAL_STATE: 'NOT_CLASSIFIED',
    NEXT_ACTION: 'NOT_EVALUATED',
    NEXT_SAFE_PHASE: 'NOT_EVALUATED',
    NEXT_REQUIRED_OWNER_MARKER: 'NOT_EVALUATED',
    BLOCKER: '',
    RAW_GMAIL_IDS_LOGGED: 'NO',
    RAW_DRIVE_IDS_LOGGED: 'NO',
    RAW_SPREADSHEET_IDS_LOGGED: 'NO',
    RAW_FIRESTORE_DOCUMENT_PATHS_LOGGED: 'NO',
    CUSTOMER_CONTENT_LOGGED: 'NO'
  };
}

function finalizeD7E3GTripwire_(result) {
  result.SCRIPT_PROPERTY_MUTATION_COUNT = 0;
  result.GMAIL_MUTATION_COUNT = Number(result.GMAIL_MUTATION_COUNT || 0);
  result.DRIVE_MUTATION_COUNT = Number(result.DRIVE_MUTATION_COUNT || 0);
  result.SHEETS_MUTATION_COUNT = Number(result.SHEETS_MUTATION_COUNT || 0);
  result.FIRESTORE_MUTATION_COUNT = Number(result.FIRESTORE_MUTATION_COUNT || 0);
  result.TRIGGER_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
  result.PRODUCTION_MUTATION_COUNT = result.SCRIPT_PROPERTY_MUTATION_COUNT + result.GMAIL_MUTATION_COUNT + result.DRIVE_MUTATION_COUNT + result.SHEETS_MUTATION_COUNT + result.FIRESTORE_MUTATION_COUNT + result.TRIGGER_MUTATION_COUNT + result.DESTRUCTIVE_OPERATION_COUNT;
  result.PRODUCTION_MUTATION = result.PRODUCTION_MUTATION_COUNT === 0 ? 'NONE' : 'UNEXPECTED_MUTATION';
}

function buildD7E3GSnapshotSignature_(result) {
  const keys = ['CANDIDATE_REDISCOVERY_STATUS', 'ELIGIBLE_CANDIDATE_COUNT', 'CANDIDATE_FINGERPRINT_MATCH', 'INVOICE_KEY_HASH_MATCH', 'ATTACHMENT_SET_SHA256_MATCH', 'XML_SOURCE_SHA256_MATCH', 'PDF_SOURCE_SHA256_MATCH', 'EXPECTED_JOB_ID_HASH_PREFIX', 'FIRESTORE_JOB_FOUND', 'FIRESTORE_JOB_IDENTITY_MATCH', 'FIRESTORE_JOB_STATUS', 'FIRESTORE_JOB_RECONCILIATION_STATUS', 'FIRESTORE_COMMIT_PLAN_FOUND', 'FIRESTORE_COMMIT_PLAN_IDENTITY_MATCH', 'FIRESTORE_COMMIT_PLAN_HASH_MATCH', 'FIRESTORE_LEASE_STATUS', 'FIRESTORE_AUDIT_EVENT_COUNT', 'FIRESTORE_RECONCILIATION_REPORT_FOUND', 'FIRESTORE_RECONCILIATION_STATUS', 'FIRESTORE_ATTACHMENT_RECORD_COUNT', 'DRIVE_XML_CANDIDATE_COUNT', 'DRIVE_XML_MATCHED_FILE_COUNT', 'DRIVE_XML_HASH_MATCH', 'DRIVE_PDF_CANDIDATE_COUNT', 'DRIVE_PDF_MATCHED_FILE_COUNT', 'DRIVE_PDF_HASH_MATCH', 'DRIVE_DUPLICATE_STATUS', 'SHEET_CANONICAL_MATCHING_ROW_COUNT', 'SHEET_EXACT_MATCHING_ROW_COUNT', 'SHEET_CONFLICTING_ROW_COUNT', 'GMAIL_CANDIDATE_FOUND', 'GMAIL_CANDIDATE_CARDINALITY', 'GMAIL_COMPLETION_LABEL_PRESENT', 'GMAIL_PROJECTION_MUTATION_FOUND'];
  const out = {};
  keys.forEach(function (key) { out[key] = result[key]; });
  return out;
}

function d7E3GLedgerRowMatches_(actual, expected) {
  const a = actual || {};
  const e = expected || {};
  return normalizeD7E3GString_(a.transactionIdentity || a.lineIdentityV2) === normalizeD7E3GString_(e.transactionIdentity || e.lineIdentityV2) && normalizeD7E3GString_(a.legacyHashIndex) === normalizeD7E3GString_(e.legacyHashIndex) && normalizeD7E3GString_(a.invoiceKeyV2 || a.legacyInvoiceKey) === normalizeD7E3GString_(e.invoiceKeyV2 || e.legacyInvoiceKey);
}

function countD7E3GAttachments_(candidate, kind) {
  const key = normalizeD7E3GString_(kind).toLowerCase();
  return candidate && candidate[key] ? 1 : 0;
}

function isD7E3GCompletionLabel_(label) {
  const name = normalizeD7E3GString_(label && label.getName ? label.getName() : label).toUpperCase();
  return /(SAVED|PROCESSED|COMPLETED|DA_LUU|D7_E_DONE|D7_E_COMPLETED|HOAN_THANH)/.test(name);
}

function isD7E3GTimestampExpired_(value, nowValue) {
  const expires = new Date(normalizeD7E3GString_(value)).getTime();
  const now = new Date(normalizeD7E3GString_(nowValue || new Date().toISOString())).getTime();
  return Number.isFinite(expires) && Number.isFinite(now) && expires <= now;
}

function sha256D7E3GBytes_(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes || []);
  return digest.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return value.toString(16).padStart(2, '0');
  }).join('');
}

function readD7E3GScriptPropertiesReadOnly_() {
  return PropertiesService.getScriptProperties().getProperties();
}

function logD7E3GSanitizedResult_(logger, result) {
  const text = JSON.stringify(sanitizeD7E3GObject_(result));
  if (/(Bearer|Authorization|refresh_token|private_key|client_secret|<\?xml|<Invoice|JVBERi0|\b80,68,70\b|@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i.test(text)) throw d7e3gError_('BLOCKED_UNSAFE_D7_E3G_LOG_PAYLOAD');
  if (logger && typeof logger.log === 'function') logger.log(text);
}

function sanitizeD7E3GObject_(value) {
  if (Array.isArray(value)) return value.map(sanitizeD7E3GObject_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(function (key) {
      if (/Ref$|Reference$|threadRef|messageRef|blob|bytes|fileName/i.test(key)) return;
      out[key] = sanitizeD7E3GObject_(value[key]);
    });
    return out;
  }
  if (typeof value === 'string') return sanitizeD7E3GString_(value);
  return value;
}

function sanitizeD7E3GString_(value) {
  return String(value == null ? '' : value).replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/g, 'OAUTH_TOKEN_REDACTED').replace(/Authorization\s+[A-Za-z0-9._~+\/=-]+/g, 'AUTHORIZATION_REDACTED').replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email-redacted>').replace(/ya29\.[A-Za-z0-9._-]+/g, '<oauth-token-redacted>').replace(/(refresh_token|private_key|client_secret)\s*[=:]?\s*[^\s,;)]*/ig, 'REDACTED').slice(0, 500);
}

function normalizeD7E3GString_(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function normalizeD7E3GErrorCode_(value) {
  return normalizeD7E3GString_(value).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 120) || 'BLOCKED_D7_E3G_UNKNOWN';
}

function mergeD7E3GResult_(target, patch) {
  Object.keys(patch || {}).forEach(function (key) { target[key] = patch[key]; });
  return target;
}

function stableD7E3GJson_(value) {
  function normalize(v) {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach(function (key) { out[key] = normalize(v[key]); });
      return out;
    }
    return v;
  }
  return JSON.stringify(normalize(value));
}

function safeD7E3GJsonParse_(text) {
  try {
    return JSON.parse(String(text || ''));
  } catch (_error) {
    return null;
  }
}

function safeD7E3GCall_(fn, fallback) {
  try {
    return fn();
  } catch (_error) {
    return fallback;
  }
}

function d7e3gError_(code) {
  const error = new Error(String(code));
  error.code = normalizeD7E3GErrorCode_(code);
  return error;
}
