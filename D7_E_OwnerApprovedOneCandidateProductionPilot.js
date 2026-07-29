const D7_E_SCHEMA_VERSION_ = 'D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT_V1';
const D7_E_ENTRYPOINT_ = 'runD7EOwnerApprovedOneCandidateProductionPilot';
const D7_E_APPROVAL_PROPERTY_ = 'D7_E_OWNER_APPROVAL_MARKER';
const D7_E_APPROVAL_MARKER_ = 'OWNER_APPROVE_D7E_ONE_CANDIDATE_PRODUCTION_PILOT';
const D7_E_EXPECTED_CANDIDATE_FINGERPRINT_PROPERTY_ = 'D7_E_EXPECTED_CANDIDATE_FINGERPRINT';
const D7_E_EXPECTED_INVOICE_KEY_HASH_PROPERTY_ = 'D7_E_EXPECTED_INVOICE_KEY_HASH';
const D7_E_EXPECTED_ATTACHMENT_SET_SHA256_PROPERTY_ = 'D7_E_EXPECTED_ATTACHMENT_SET_SHA256';
const D7_E_LEGACY_D6J_APPROVAL_PROPERTY_ = 'D6J_C_MUTATION_APPROVAL_MARKER';
const D7_E_LEGACY_D6J_APPROVAL_MARKER_ = ['OWNER', 'APPROVED', 'D6J', 'C', 'ONE', 'RECORD', 'PRODUCTION', 'MUTATION'].join('_');
const D7_E_DIRECTION_ = 'NHAP';
const D7_E_LEASE_OWNER_ = 'apps_script_d7_e';
const D7_E_LEASE_DURATION_MS_ = 10 * 60 * 1000;
const D7_E_MAX_GMAIL_CANDIDATES_ = 1;
const D7_E_MAX_INVOICES_ = 1;
const D7_E_MAX_PDF_ATTACHMENTS_ = 1;
const D7_E_MAX_XML_ATTACHMENTS_ = 1;
const D7_E_MAX_DRIVE_FOLDER_CREATIONS_ = 0;
const D7_E_MAX_DRIVE_FILES_CREATED_ = 2;
const D7_E_MAX_SHEET_ROWS_INSERTED_ = 1;
const D7_E_MAX_SHEET_ROWS_UPDATED_ = 0;
const D7_E_MAX_FIRESTORE_JOBS_CREATED_ = 1;
const D7_E_MAX_FIRESTORE_ATTACHMENT_RECORDS_CREATED_ = 2;
const D7_E_MAX_FIRESTORE_JOB_TRANSITIONS_ = 5;
const D7_E_MAX_FIRESTORE_AUDIT_EVENTS_ = 3;
const D7_E_MAX_FIRESTORE_RECONCILIATION_REPORTS_ = 1;
const D7_E_MAX_FIRESTORE_TOTAL_WRITE_OPERATIONS_ = 16;
const D7_E_MAX_GMAIL_LABEL_MUTATIONS_ = 0;
const D7_E_MAX_SCRIPT_PROPERTY_MUTATIONS_ = 0;
const D7_E_MAX_TRIGGER_MUTATIONS_ = 0;
const D7_E_MAX_DESTRUCTIVE_OPERATIONS_ = 0;

function createD7EOwnerApprovedOneCandidateProductionPilotRunner_(deps) {
  const d = deps || {};
  const services = {
    readProperties: d.readProperties || readD7EScriptProperties_,
    rediscoverCandidate: d.rediscoverCandidate || rediscoverD7ECandidateReadOnly_,
    buildLedgerRows: d.buildLedgerRows || buildD7ELedgerRowsFromCandidate_,
    validateSheetSchema: d.validateSheetSchema || validateD7ESheetSchemaReadOnly_,
    createLock: d.createLock || (() => LockService.getScriptLock()),
    createJobStore: d.createJobStore || (() => createD7EDefaultDurableJobStore_()),
    createLeaseStore: d.createLeaseStore || (() => createD7EDefaultLeaseStore_()),
    createAttachmentRecordStore: d.createAttachmentRecordStore || (() => createD7EDefaultAttachmentRecordStore_()),
    createDriveAdapters: d.createDriveAdapters || (context => createD7EDefaultDriveAdapters_(context)),
    createSheetsAdapters: d.createSheetsAdapters || (context => createD7EDefaultSheetsAdapters_(context)),
    clock: d.clock || { now: () => new Date().toISOString() },
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log() {} })
  };

  async function run() {
    const result = createD7EBaseResult_();
    let lock = null;
    let lockAcquired = false;
    let activePlan = null;
    let activeJobStore = null;
    let activeJob = null;
    let activeLeaseStore = null;
    let activeLease = null;
    try {
      const properties = validateD7EApproval_(services.readProperties());
      result.APPROVAL_STATUS = 'PASS';
      result.OWNER_APPROVAL_MARKER_VALID = 'YES';
      assertD7EKillSwitchInactive_(properties);

      const precheck = runD7EFreshPrecheck_(properties, services, result, 'PRE_LOCK');
      assertD7EApprovedIdentityMatches_(properties, precheck, result);

      const ledgerRows = await services.buildLedgerRows({
        properties,
        candidate: precheck.candidate,
        fingerprint: precheck.fingerprint,
        config: precheck.config
      });
      const plan = buildD7EMutationPlan_({
        properties,
        precheck,
        ledgerRows,
        now: services.clock.now()
      });
      activePlan = plan;
      mergeD7EResult_(result, {
        PILOT_ID_HASH_PREFIX: plan.pilotIdHashPrefix,
        CORRELATION_ID_HASH_PREFIX: plan.correlationIdHashPrefix,
        JOB_ID_HASH_PREFIX: hashPrefixD7E_(plan.jobId, 16),
        MUTATION_BUDGET_STATUS: assertD7EMutationBudget_(plan)
      });

      lock = services.createLock();
      if (!lock || typeof lock.tryLock !== 'function' || !lock.tryLock(30000)) {
        throw d7eError_('BLOCKED_SCRIPT_LOCK_NOT_ACQUIRED');
      }
      lockAcquired = true;
      result.LOCK_STATUS = 'ACQUIRED';

      const lockedPrecheck = runD7EFreshPrecheck_(properties, services, result, 'IN_LOCK');
      assertD7EApprovedIdentityMatches_(properties, lockedPrecheck, result);
      assertD7ESamePrecheck_(precheck, lockedPrecheck);
      result.LOCK_RECHECK_STATUS = 'PASS';

      const schema = services.validateSheetSchema(properties, lockedPrecheck.config || {});
      result.SHEET_SCHEMA_STATUS = normalizeD7EString_(schema && schema.status) || 'BLOCKED_D7_E_SHEET_SCHEMA_UNKNOWN';
      if (result.SHEET_SCHEMA_STATUS !== 'PASS') throw d7eError_(result.SHEET_SCHEMA_STATUS);

      const jobStore = services.createJobStore({ properties, precheck: lockedPrecheck, plan });
      activeJobStore = jobStore;
      const existingJob = await jobStore.getJob(plan.jobId);
      if (existingJob && existingJob.status === 'COMPLETED') {
        const noop = await verifyD7ECompletedNoop_(jobStore, plan, services, result);
        logD7ESanitizedResult_(services.logger, noop);
        return noop;
      }
      if (existingJob && (existingJob.status === 'RECONCILIATION_REQUIRED' || existingJob.reconciliationStatus === 'RECONCILIATION_REQUIRED')) {
        throw d7eError_('BLOCKED_RECONCILIATION_REQUIRED');
      }
      if (existingJob && existingJob.invoiceIdentityHash && existingJob.invoiceIdentityHash !== durableIdentityHashPrefixD7E_(plan.invoiceIdentityHash)) {
        throw d7eError_('BLOCKED_DIFFERENT_IDENTITY_EXISTING_JOB');
      }
      assertD7ENoDuplicateBeforeFirstMutation_(lockedPrecheck.summary || {});

      const leaseStore = services.createLeaseStore({ properties, precheck: lockedPrecheck, plan });
      activeLeaseStore = leaseStore;
      const lease = await acquireD7ELease_(leaseStore, plan, services.clock);
      activeLease = lease;
      result.LEASE_STATUS = lease.status;
      result.LEASE_RECLAIM_STATUS = lease.reclaimStatus || 'NOT_RECLAIMED';
      result.LEASE_EXPIRES_AT_PRESENT = lease.expiresAt ? 'YES' : 'NO';
      result.FIRESTORE_LEASE_WRITE_COUNT += Number(lease.mutationCount || 0);
      if (!isD7ELeaseAcquiredStatus_(lease.status)) throw d7eError_('BLOCKED_ACTIVE_LEASE');

      let jobCreate = await jobStore.createJobIfAbsent({
        jobId: plan.jobId,
        invoiceIdentityHash: plan.invoiceIdentityHash,
        sourceThreadHash: plan.sourceThreadHash,
        status: 'VALIDATED',
        attemptCount: 1
      });
      result.FIRESTORE_JOBS_CREATED += jobCreate.created ? 1 : 0;
      result.FIRESTORE_JOB_WRITE_COUNT += jobCreate.created ? 1 : 0;
      result.FIRESTORE_JOB_STATUS = jobCreate.resultCode;
      let job = jobCreate.job;
      activeJob = job;

      const approvedAudit = await appendD7EAuditEvent_(jobStore, plan, job, 1, 'D7E_APPROVED_CANDIDATE_ACCEPTED');
      result.FIRESTORE_AUDIT_EVENT_COUNT += 1;
      result.FIRESTORE_AUDIT_WRITE_COUNT += 1;

      const planSave = await jobStore.saveCommitPlanIfAbsent({
        jobId: plan.jobId,
        expectedVersion: Number(job.version || 1),
        commitPlan: plan.commitPlan
      });
      result.COMMIT_PLAN_STATUS = planSave.resultCode;
      result.FIRESTORE_COMMIT_PLAN_WRITE_COUNT += planSave.saved ? 1 : 0;
      job = planSave.job;
      activeJob = job;

      await appendD7EAuditEvent_(jobStore, plan, job, 2, 'D7E_COMMIT_PLAN_ACCEPTED');
      result.FIRESTORE_AUDIT_EVENT_COUNT += 1;
      result.FIRESTORE_AUDIT_WRITE_COUNT += 1;

      const drive = services.createDriveAdapters({ properties, precheck: lockedPrecheck, plan });
      const driveResult = await writeAndVerifyD7EDriveArtifacts_(drive, plan);
      mergeD7EResult_(result, driveResult.safeResult);
      result.DRIVE_MUTATION_COUNT += driveResult.createdCount;
      job = await transitionD7EJob_(jobStore, plan, job, 'FILES_SAVED', 'd7e-files-saved', result);
      activeJob = job;

      job = await transitionD7EJob_(jobStore, plan, job, 'COMMITTING', 'd7e-committing', result);
      activeJob = job;

      const sheets = services.createSheetsAdapters({ properties, precheck: lockedPrecheck, plan });
      const sheetResult = await appendAndVerifyD7ESheetTransaction_(sheets, plan);
      mergeD7EResult_(result, sheetResult.safeResult);
      result.SHEETS_MUTATION_COUNT += sheetResult.appendedCount;
      job = await transitionD7EJob_(jobStore, plan, job, 'ROWS_COMMITTED', 'd7e-rows-committed', result);
      activeJob = job;

      const attachmentStore = services.createAttachmentRecordStore({ properties, precheck: lockedPrecheck, plan });
      const attachmentResult = await saveD7EAttachmentRecords_(attachmentStore, plan);
      mergeD7EResult_(result, attachmentResult.safeResult);
      result.FIRESTORE_ATTACHMENT_WRITE_COUNT += attachmentResult.createdCount;
      job = await transitionD7EJob_(jobStore, plan, job, 'PROJECTIONS_COMMITTED', 'd7e-projections-committed', result);
      activeJob = job;

      const report = await saveD7EReconciliationReport_(jobStore, plan, job, 'CONSISTENT', []);
      result.RECONCILIATION_STATUS = report.report.status;
      result.FIRESTORE_RECONCILIATION_REPORT_COUNT += 1;
      result.FIRESTORE_RECONCILIATION_WRITE_COUNT += 2;
      job = report.job;
      activeJob = job;

      job = await transitionD7EJob_(jobStore, plan, job, 'COMPLETED', 'd7e-completed', result);
      activeJob = job;
      result.FIRESTORE_JOB_STATUS = job.status;

      await appendD7EAuditEvent_(jobStore, plan, job, 3, 'D7E_JOB_COMPLETED');
      result.FIRESTORE_AUDIT_EVENT_COUNT += 1;
      result.FIRESTORE_AUDIT_WRITE_COUNT += 1;

      result.GMAIL_PROJECTION_STATUS = 'NOT_REQUIRED_BUDGET_ZERO';
      result.IDEMPOTENT_RERUN_STATUS = 'READY_FOR_IDEMPOTENT_RERUN';
      result.D7_E_STATUS = 'PASS_ONE_CANDIDATE_PRODUCTION_PILOT_COMPLETED';
      await releaseD7ELease_(leaseStore, lease, result, 'COMPLETED', { clock: services.clock, mustConfirm: true });
      finalizeD7EMutationCounts_(result);
      assertD7EObservedMutationBudget_(result);
      logD7ESanitizedResult_(services.logger, result);
      return result;
    } catch (error) {
      if (Number(error && error.driveMutationCount || 0) > 0) result.DRIVE_MUTATION_COUNT += Number(error.driveMutationCount);
      if (Number(error && error.sheetsMutationCount || 0) > 0) result.SHEETS_MUTATION_COUNT += Number(error.sheetsMutationCount);
      if (error && error.partialSafeResult) mergeD7EResult_(result, error.partialSafeResult);
      await maybeMarkD7EReconciliationRequired_(activeJobStore, activePlan, activeJob, error, result);
      const externalMutationCount = Number(result.DRIVE_MUTATION_COUNT || 0) + Number(result.SHEETS_MUTATION_COUNT || 0);
      await closeD7ELeaseAfterFailure_(activeLeaseStore, activeLease, result, externalMutationCount > 0 ? 'RECONCILIATION_REQUIRED' : 'FAILED_BEFORE_EXTERNAL_MUTATION', {
        clock: services.clock,
        error
      });
      const blocked = finalizeD7EBlockedResult_(result, error);
      logD7ESanitizedResult_(services.logger, blocked);
      return blocked;
    } finally {
      if (lockAcquired && lock && typeof lock.releaseLock === 'function') lock.releaseLock();
    }
  }

  return Object.freeze({ run });
}

function readD7EScriptProperties_() {
  return PropertiesService.getScriptProperties().getProperties();
}

function validateD7EApproval_(raw) {
  const properties = cloneD7EJson_(raw || {});
  const marker = normalizeD7EString_(properties[D7_E_APPROVAL_PROPERTY_]);
  const oldMarker = normalizeD7EString_(properties[D7_E_LEGACY_D6J_APPROVAL_PROPERTY_]);
  if (marker !== D7_E_APPROVAL_MARKER_) {
    if (oldMarker === D7_E_LEGACY_D6J_APPROVAL_MARKER_) {
      throw d7eError_('BLOCKED_OLD_D6J_MARKER_CANNOT_AUTHORIZE_D7_E');
    }
    throw d7eError_('BLOCKED_INVALID_D7_E_APPROVAL_MARKER');
  }
  [
    D7_E_EXPECTED_CANDIDATE_FINGERPRINT_PROPERTY_,
    D7_E_EXPECTED_INVOICE_KEY_HASH_PROPERTY_,
    D7_E_EXPECTED_ATTACHMENT_SET_SHA256_PROPERTY_
  ].forEach(name => {
    const value = normalizeD7EString_(properties[name]);
    if (!value || value === 'UNKNOWN' || !/^[a-f0-9]{64}$/.test(value)) {
      throw d7eError_('BLOCKED_MALFORMED_D7_E_EXPECTED_HASH_' + name);
    }
  });
  return properties;
}

function assertD7EKillSwitchInactive_(properties) {
  const state = normalizeD7EString_(properties && (properties.D7_E_KILL_SWITCH || properties.SGDS_D7_E_KILL_SWITCH)).toUpperCase();
  if (['ON', 'TRUE', 'YES', '1', 'ENABLED', 'BLOCK'].indexOf(state) >= 0) {
    throw d7eError_('BLOCKED_D7_E_KILL_SWITCH_ACTIVE');
  }
  return 'PASS';
}

function runD7EFreshPrecheck_(properties, services, result, stage) {
  const precheck = services.rediscoverCandidate(properties, stage);
  const summary = precheck && precheck.summary || precheck && precheck.result || {};
  mergeD7EResult_(result, {
    CANDIDATE_REDISCOVERY_STATUS: normalizeD7EString_(summary.D7_B_STATUS || summary.CANDIDATE_DISCOVERY_STATUS || ''),
    RUNTIME_SAFETY_RECHECK: normalizeD7EString_(summary.RUNTIME_SAFETY_RECHECK || ''),
    EFFECTIVE_CONFIG_STATUS: normalizeD7EString_(summary.EFFECTIVE_CONFIG_STATUS || ''),
    CANDIDATE_DISCOVERY_EXECUTED: normalizeD7EString_(summary.CANDIDATE_DISCOVERY_EXECUTED || ''),
    ELIGIBLE_CANDIDATE_COUNT: Number(summary.ELIGIBLE_CANDIDATE_COUNT || 0),
    APPROVED_CANDIDATE_COUNT: Number(summary.APPROVED_CANDIDATE_COUNT || 0),
    INSPECTED_ATTACHMENT_COUNT: Number(summary.INSPECTED_ATTACHMENT_COUNT || 0),
    ATTACHMENT_VALIDATION_STATUS: normalizeD7EString_(summary.ATTACHMENT_VALIDATION_STATUS || ''),
    CARDINALITY_STATUS: normalizeD7EString_(summary.CARDINALITY_STATUS || ''),
    FINGERPRINT_STATUS: normalizeD7EString_(summary.FINGERPRINT_STATUS || ''),
    GMAIL_DUPLICATE_STATUS: normalizeD7EString_(summary.GMAIL_DUPLICATE_STATUS || ''),
    DRIVE_DUPLICATE_STATUS: normalizeD7EString_(summary.DRIVE_DUPLICATE_STATUS || ''),
    SHEET_DUPLICATE_STATUS: normalizeD7EString_(summary.SHEET_DUPLICATE_STATUS || ''),
    FIRESTORE_DUPLICATE_STATUS: normalizeD7EString_(summary.FIRESTORE_DUPLICATE_STATUS || '')
  });
  assertD7EPrecheckReady_(precheck, summary);
  return precheck;
}

function rediscoverD7ECandidateReadOnly_(properties) {
  const config = resolveD7BEffectiveConfig_(properties);
  if (!config.valid) throw d7eError_('BLOCKED_INVALID_D7_B_EFFECTIVE_CONFIG');
  const adapters = {
    listTriggers: listD7BProjectTriggersReadOnly_,
    inspectSourceContracts: inspectD7BSourceContracts_,
    gmailSearch: searchD7BGmailReadOnly_,
    readDriveDuplicate: readD7BDriveDuplicateReadOnly_,
    readSheetDuplicate: readD7BSheetDuplicateReadOnly_,
    readFirestoreDuplicate: readD7BFirestoreDuplicateReadOnly_,
    firestoreReadDocument: readD7BFirestoreDocumentReadOnly_,
    deriveInvoiceIdentity: deriveD7BInvoiceIdentity_,
    logger: { log() {} }
  };
  const safety = recheckD7BRuntimeSafety_(adapters, config);
  if (safety.RUNTIME_SAFETY_RECHECK !== 'PASS') throw d7eError_('BLOCKED_D7_B_RUNTIME_SAFETY_RECHECK');
  const gmail = discoverD7BGmailCandidatesReadOnly_(adapters, config);
  if (gmail.status !== 'PASS') throw d7eError_(gmail.status || 'BLOCKED_D7_E_CANDIDATE_REDISCOVERY');
  const cardinality = classifyD7BCardinality_(gmail.candidates);
  if (cardinality.status !== 'PASS') throw d7eError_(cardinality.status || 'BLOCKED_D7_E_CARDINALITY');
  const candidate = gmail.candidates[0];
  const fingerprint = createD7BCandidateFingerprint_(candidate, config, adapters);
  if (fingerprint.status !== 'PASS') throw d7eError_(fingerprint.status || 'BLOCKED_D7_E_FINGERPRINT');
  const duplicates = readD7BDuplicateEvidenceReadOnly_(candidate, fingerprint, config, adapters);
  const summary = createD7EPrecheckSummary_(config, safety, gmail, cardinality, fingerprint, duplicates);
  return { config, candidate, fingerprint, summary };
}

function createD7EPrecheckSummary_(config, safety, gmail, cardinality, fingerprint, duplicates) {
  const summary = {};
  mergeD7EResult_(summary, config.summary || {});
  mergeD7EResult_(summary, safety || {});
  mergeD7EResult_(summary, gmail.summary || {});
  mergeD7EResult_(summary, cardinality.summary || {});
  mergeD7EResult_(summary, fingerprint.summary || {});
  mergeD7EResult_(summary, duplicates.summary || {});
  summary.EFFECTIVE_CONFIG_STATUS = config.valid ? 'PASS' : 'BLOCKED_INVALID_EFFECTIVE_CONFIG';
  summary.CANDIDATE_DISCOVERY_EXECUTED = 'YES_READ_ONLY';
  summary.D7_B_STATUS = duplicates.status;
  summary.CANDIDATE_DISCOVERY_STATUS = duplicates.status;
  summary.APPROVED_CANDIDATE_COUNT = (
    duplicates.status === 'PASS_EXACTLY_ONE_ELIGIBLE_CANDIDATE_READY_FOR_OWNER_REVIEW' ||
    duplicates.status === 'BLOCKED_EXACT_DUPLICATE'
  ) ? 1 : 0;
  return summary;
}

function assertD7EPrecheckReady_(precheck, summary) {
  const safeSummary = summary || {};
  assertD7EDuplicateStatusEvaluable_('GMAIL', safeSummary.GMAIL_DUPLICATE_STATUS);
  assertD7EDuplicateStatusEvaluable_('DRIVE', safeSummary.DRIVE_DUPLICATE_STATUS);
  assertD7EDuplicateStatusEvaluable_('SHEET', safeSummary.SHEET_DUPLICATE_STATUS);
  assertD7EDuplicateStatusEvaluable_('FIRESTORE', safeSummary.FIRESTORE_DUPLICATE_STATUS);
  const checks = [
    [safeSummary.RUNTIME_SAFETY_RECHECK === 'PASS', 'BLOCKED_D7_E_RUNTIME_SAFETY_RECHECK'],
    [safeSummary.EFFECTIVE_CONFIG_STATUS === 'PASS', 'BLOCKED_D7_E_EFFECTIVE_CONFIG'],
    [safeSummary.CANDIDATE_DISCOVERY_EXECUTED === 'YES_READ_ONLY', 'BLOCKED_D7_E_CANDIDATE_REDISCOVERY_NOT_RUN'],
    [Number(safeSummary.ELIGIBLE_CANDIDATE_COUNT) === 1, 'BLOCKED_D7_E_CANDIDATE_COUNT_NOT_ONE'],
    [Number(safeSummary.APPROVED_CANDIDATE_COUNT) === 1, 'BLOCKED_D7_E_APPROVED_COUNT_NOT_ONE'],
    [safeSummary.ATTACHMENT_VALIDATION_STATUS === 'PASS', 'BLOCKED_D7_E_ATTACHMENT_VALIDATION'],
    [safeSummary.CARDINALITY_STATUS === 'EXACTLY_ONE_ELIGIBLE_CANDIDATE', 'BLOCKED_D7_E_CARDINALITY'],
    [safeSummary.FINGERPRINT_STATUS === 'PASS', 'BLOCKED_D7_E_FINGERPRINT_STATUS'],
    [Number(safeSummary.INSPECTED_ATTACHMENT_COUNT) === 2, 'BLOCKED_D7_E_ATTACHMENT_COUNT']
  ];
  checks.forEach(pair => {
    if (!pair[0]) throw d7eError_(pair[1]);
  });
  if (!precheck || !precheck.candidate || !precheck.fingerprint) throw d7eError_('BLOCKED_D7_E_PRECHECK_CONTEXT_MISSING');
  if (!precheck.candidate.xml || !precheck.candidate.pdf) throw d7eError_('BLOCKED_D7_E_ATTACHMENT_SET_MISSING');
}

function assertD7EDuplicateStatusEvaluable_(system, status) {
  const normalized = normalizeD7EString_(status);
  if (['NOT_FOUND', 'EXACT_DUPLICATE'].indexOf(normalized) >= 0) return true;
  if (!normalized || normalized === 'NOT_EVALUATED') throw d7eError_('BLOCKED_D7_E_' + system + '_DUPLICATE_STATUS_UNKNOWN');
  if (normalized.indexOf('READ') >= 0) throw d7eError_('BLOCKED_D7_E_' + system + '_DUPLICATE_READ_BLOCKED');
  throw d7eError_('BLOCKED_D7_E_' + system + '_DUPLICATE');
}

function assertD7ENoDuplicateBeforeFirstMutation_(summary) {
  [
    ['GMAIL', summary.GMAIL_DUPLICATE_STATUS],
    ['DRIVE', summary.DRIVE_DUPLICATE_STATUS],
    ['SHEET', summary.SHEET_DUPLICATE_STATUS],
    ['FIRESTORE', summary.FIRESTORE_DUPLICATE_STATUS]
  ].forEach(pair => {
    if (normalizeD7EString_(pair[1]) !== 'NOT_FOUND') {
      throw d7eError_('BLOCKED_D7_E_' + pair[0] + '_DUPLICATE');
    }
  });
}

function assertD7EApprovedIdentityMatches_(properties, precheck, result) {
  const summary = precheck && precheck.fingerprint && precheck.fingerprint.summary || precheck && precheck.summary || {};
  const candidateFingerprint = normalizeD7EString_(summary.CANDIDATE_FINGERPRINT);
  const invoiceKeyHash = normalizeD7EString_(summary.INVOICE_KEY_HASH);
  const attachmentSetHash = normalizeD7EString_(summary.ATTACHMENT_SET_SHA256);
  const expectedFingerprint = normalizeD7EString_(properties[D7_E_EXPECTED_CANDIDATE_FINGERPRINT_PROPERTY_]);
  const expectedInvoice = normalizeD7EString_(properties[D7_E_EXPECTED_INVOICE_KEY_HASH_PROPERTY_]);
  const expectedAttachmentSet = normalizeD7EString_(properties[D7_E_EXPECTED_ATTACHMENT_SET_SHA256_PROPERTY_]);
  result.CANDIDATE_FINGERPRINT_MATCH = candidateFingerprint === expectedFingerprint ? 'YES' : 'NO';
  result.INVOICE_KEY_HASH_MATCH = invoiceKeyHash === expectedInvoice ? 'YES' : 'NO';
  result.ATTACHMENT_SET_SHA256_MATCH = attachmentSetHash === expectedAttachmentSet ? 'YES' : 'NO';
  result.CANDIDATE_FINGERPRINT_HASH_PREFIX = hashPrefixD7E_(candidateFingerprint, 16);
  result.INVOICE_KEY_HASH_PREFIX = hashPrefixD7E_(invoiceKeyHash, 16);
  result.ATTACHMENT_SET_SHA256_PREFIX = hashPrefixD7E_(attachmentSetHash, 16);
  if (result.CANDIDATE_FINGERPRINT_MATCH !== 'YES') throw d7eError_('BLOCKED_D7_E_CANDIDATE_FINGERPRINT_MISMATCH');
  if (result.INVOICE_KEY_HASH_MATCH !== 'YES') throw d7eError_('BLOCKED_D7_E_INVOICE_KEY_HASH_MISMATCH');
  if (result.ATTACHMENT_SET_SHA256_MATCH !== 'YES') throw d7eError_('BLOCKED_D7_E_ATTACHMENT_SET_HASH_MISMATCH');
}

function assertD7ESamePrecheck_(first, second) {
  const a = first && first.summary || {};
  const b = second && second.summary || {};
  ['CANDIDATE_FINGERPRINT', 'INVOICE_KEY_HASH', 'ATTACHMENT_SET_SHA256'].forEach(key => {
    if (normalizeD7EString_(a[key]) !== normalizeD7EString_(b[key])) {
      throw d7eError_('BLOCKED_D7_E_LOCK_RECHECK_' + key + '_CHANGED');
    }
  });
}

function buildD7EMutationPlan_(context) {
  const precheck = context.precheck || {};
  const candidate = precheck.candidate || {};
  const summary = precheck.summary || {};
  const config = precheck.config || {};
  const rows = context.ledgerRows || [];
  if (rows.length !== 1) throw d7eError_('BLOCKED_D7_E_EXPECTED_ONE_LEDGER_LINE');
  const row = rows[0];
  const candidateFingerprint = normalizeD7EString_(summary.CANDIDATE_FINGERPRINT);
  const jobId = 'd7e_job_' + hashPrefixD7E_(candidateFingerprint, 24);
  const correlationSeed = [candidateFingerprint, summary.ATTACHMENT_SET_SHA256, context.now].join('|');
  const correlationIdHashPrefix = hashPrefixD7E_(correlationSeed, 16);
  const pilotIdHashPrefix = hashPrefixD7E_(['D7E', candidateFingerprint].join('|'), 16);
  const xmlTarget = buildD7EDriveTarget_('XML', candidate.xml, row, config, summary, jobId);
  const pdfTarget = buildD7EDriveTarget_('PDF', candidate.pdf, row, config, summary, jobId);
  const commitPlan = buildDurableCommitPlan_({
    jobId,
    legacyInvoiceKey: row.legacyInvoiceKey,
    invoiceKeyV2: row.invoiceKeyV2,
    lines: [{
      sourceLineNo: 1,
      legacyHashIndex: row.legacyHashIndex,
      lineIdentityV2: row.lineIdentityV2,
      immutableFields: {
        direction: row.direction,
        itemCode: row.itemCode,
        quantity: row.quantity,
        unitPrice: row.unitPrice
      }
    }],
    driveEvidenceTargets: {
      xmlContentHash: candidate.xml.sha256,
      pdfContentHash: candidate.pdf.sha256,
      xmlLogicalIdentityHashPrefix: hashPrefixD7E_(xmlTarget.logicalFileIdentity, 16),
      pdfLogicalIdentityHashPrefix: hashPrefixD7E_(pdfTarget.logicalFileIdentity, 16)
    },
    preCommitLedgerProbe: { status: 'D7_E_PREFLIGHT_PASS' }
  });
  return {
    jobId,
    pilotIdHashPrefix,
    correlationIdHashPrefix,
    invoiceIdentityHash: candidateFingerprint,
    sourceThreadHash: normalizeD7EString_(summary.THREAD_ID_HASH || candidate.message && candidate.message.threadIdHash),
    candidateFingerprint,
    commitPlan,
    ledgerRows: rows,
    driveTargets: { xml: xmlTarget, pdf: pdfTarget },
    attachmentRecords: [
      buildD7EAttachmentRecord_('XML', candidate.xml, jobId, summary),
      buildD7EAttachmentRecord_('PDF', candidate.pdf, jobId, summary)
    ],
    idempotencyKeys: {
      lease: 'd7e_lease_' + jobId,
      job: 'd7e_job_' + jobId,
      plan: 'd7e_plan_' + jobId,
      xml: 'd7e_xml_' + hashPrefixD7E_(candidate.xml.sha256, 20),
      pdf: 'd7e_pdf_' + hashPrefixD7E_(candidate.pdf.sha256, 20),
      sheet: 'd7e_sheet_' + hashPrefixD7E_(row.transactionIdentity || row.lineIdentityV2, 20)
    },
    budgets: getD7EMutationBudgets_()
  };
}

function buildD7EDriveTarget_(kind, attachment, row, config, summary, jobId) {
  const target = {
    invoiceKeyV2: row.invoiceKeyV2,
    messageId: normalizeD7EString_(summary.MESSAGE_ID_HASH),
    attachmentId: kind + '_' + hashPrefixD7E_(attachment.sha256, 20),
    contentHash: attachment.sha256,
    artifactType: kind,
    kind,
    fileName: normalizeD7EString_(attachment.fileName || attachment.name || (kind.toLowerCase() + '.invoice')),
    mimeType: normalizeD7EString_(attachment.mimeType || attachment.mime || (kind === 'PDF' ? 'application/pdf' : 'application/xml')),
    byteSize: Number(attachment.byteSize || attachment.size || 0),
    bytes: attachment.bytes || [],
    direction: D7_E_DIRECTION_,
    year: getD7EInvoiceYear_(row.issueDate),
    folderReference: normalizeD7EString_(config.folderId),
    metadata: {
      schemaVersion: D7_E_SCHEMA_VERSION_,
      jobIdHashPrefix: hashPrefixD7E_(jobId, 16),
      candidateFingerprintHashPrefix: hashPrefixD7E_(summary.CANDIDATE_FINGERPRINT, 16),
      artifactType: kind
    }
  };
  target.logicalFileIdentity = buildSgdsDriveArtifactIdentity_(target);
  return target;
}

function buildD7EAttachmentRecord_(kind, attachment, jobId, summary) {
  const contentHash = normalizeD7EString_(attachment && attachment.sha256);
  return {
    attachmentId: 'd7e_att_' + hashPrefixD7E_([kind, jobId, contentHash].join('|'), 24),
    jobId,
    artifactType: kind,
    contentHash,
    byteSize: Number(attachment && (attachment.byteSize || attachment.size) || 0),
    mimeType: normalizeD7EString_(attachment && (attachment.mimeType || attachment.mime)),
    candidateFingerprintHashPrefix: hashPrefixD7E_(summary.CANDIDATE_FINGERPRINT, 16),
    schemaVersion: D7_E_SCHEMA_VERSION_
  };
}

function buildD7ELedgerRowsFromCandidate_(context) {
  const candidate = context && context.candidate || {};
  const xml = candidate.xml || {};
  const bytes = xml.bytes || (xml.blob && xml.blob.getBytes ? xml.blob.getBytes() : []);
  const blob = Utilities.newBlob(bytes || [], xml.mimeType || xml.mime || 'application/xml', xml.fileName || xml.name || 'invoice.xml');
  const parsed = parseInvoiceXML_(blob, { type: D7_E_DIRECTION_ });
  if (!isVatInvoiceXML_(parsed && parsed.meta)) throw d7eError_('BLOCKED_D7_E_XML_NOT_VAT_INVOICE');
  if (!parsed.items || parsed.items.length !== 1) throw d7eError_('BLOCKED_D7_E_EXPECTED_ONE_LEDGER_LINE');
  const meta = parsed.meta || {};
  const seller = parsed.seller || {};
  const item = parsed.items[0] || {};
  const legacyInvoiceKey = buildD7ELegacyInvoiceKey_(meta.invoiceDate, seller.taxCode, meta.invoiceNo);
  const lineIdentity = hashPrefixD7E_([legacyInvoiceKey, xml.sha256, item.code, item.name, item.qty, item.price].join('|'), 32);
  const legacyHashIndex = buildInvoiceItemHash_({
    invoiceDate: meta.invoiceDate,
    invoiceNo: meta.invoiceNo,
    customerName: seller.name,
    itemCode: item.code || 'Unknown_ID',
    itemName: item.name,
    invoiceType: D7_E_DIRECTION_,
    qty: item.qty
  });
  return [{
    issueDate: normalizeD7EString_(meta.invoiceDate),
    invoiceNo: normalizeD7EString_(meta.invoiceNo),
    customerName: normalizeD7EString_(seller.name),
    sellerTaxCode: normalizeD7EString_(seller.taxCode),
    legacyInvoiceKey,
    invoiceKeyV2: legacyInvoiceKey,
    sourceLineNo: 1,
    lineIdentityV2: lineIdentity,
    legacyHashIndex,
    transactionIdentity: lineIdentity,
    direction: D7_E_DIRECTION_,
    itemCode: normalizeD7EString_(item.code || 'Unknown_ID'),
    itemName: normalizeD7EString_(item.name),
    quantity: Number(item.qty || 0),
    unitPrice: Number(item.price || 0),
    amount: Number(item.qty || 0) * Number(item.price || 0)
  }];
}

function validateD7ESheetSchemaReadOnly_(properties, config) {
  const spreadsheetId = normalizeD7EString_(config && config.spreadsheetId || properties && (properties.D7_B_SPREADSHEET_ID || properties.D7_SPREADSHEET_ID || properties.D6J_SPREADSHEET_ID));
  const sheetName = normalizeD7EString_(config && config.sheetName || properties && (properties.D7_B_TARGET_SHEET_NAME || properties.D7_TARGET_SHEET_NAME || properties.D6J_SHEET_NAME) || 'Nhap-Xuat');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw d7eError_('BLOCKED_D7_E_TARGET_SHEET_MISSING');
  const width = Math.max(16, Number(sheet.getLastColumn && sheet.getLastColumn() || 16));
  const header = sheet.getRange(1, 1, 1, width).getValues()[0].slice(0, 16);
  if (typeof assertD6jDHeaderSchema_ === 'function') assertD6jDHeaderSchema_(header);
  return { status: 'PASS' };
}

function assertD7EMutationBudget_(plan) {
  const budgets = plan.budgets || {};
  if (Number(budgets.MAX_DRIVE_FOLDER_CREATIONS) !== 0) throw d7eError_('BLOCKED_D7_E_DRIVE_FOLDER_BUDGET_NOT_ZERO');
  if (Number(budgets.MAX_SHEET_ROWS_UPDATED) !== 0) throw d7eError_('BLOCKED_D7_E_SHEET_UPDATE_BUDGET_NOT_ZERO');
  if (Number(budgets.MAX_SCRIPT_PROPERTY_MUTATIONS) !== 0) throw d7eError_('BLOCKED_D7_E_SCRIPT_PROPERTY_BUDGET_NOT_ZERO');
  if (Number(budgets.MAX_TRIGGER_MUTATIONS) !== 0) throw d7eError_('BLOCKED_D7_E_TRIGGER_BUDGET_NOT_ZERO');
  if (Number(budgets.MAX_DESTRUCTIVE_OPERATIONS) !== 0) throw d7eError_('BLOCKED_D7_E_DESTRUCTIVE_BUDGET_NOT_ZERO');
  if (Number(budgets.MAX_GMAIL_LABEL_MUTATIONS) !== 0) throw d7eError_('BLOCKED_D7_E_GMAIL_LABEL_BUDGET_NOT_ZERO');
  if (Number(budgets.MAX_FIRESTORE_TOTAL_WRITE_OPERATIONS) !== 16) throw d7eError_('BLOCKED_D7_E_FIRESTORE_BUDGET_INCOMPLETE');
  return 'PASS';
}

function getD7EMutationBudgets_() {
  return Object.freeze({
    MAX_GMAIL_CANDIDATES: D7_E_MAX_GMAIL_CANDIDATES_,
    MAX_INVOICES: D7_E_MAX_INVOICES_,
    MAX_PDF_ATTACHMENTS: D7_E_MAX_PDF_ATTACHMENTS_,
    MAX_XML_ATTACHMENTS: D7_E_MAX_XML_ATTACHMENTS_,
    MAX_DRIVE_FOLDER_CREATIONS: D7_E_MAX_DRIVE_FOLDER_CREATIONS_,
    MAX_DRIVE_FILES_CREATED: D7_E_MAX_DRIVE_FILES_CREATED_,
    MAX_SHEET_ROWS_INSERTED: D7_E_MAX_SHEET_ROWS_INSERTED_,
    MAX_SHEET_ROWS_UPDATED: D7_E_MAX_SHEET_ROWS_UPDATED_,
    MAX_FIRESTORE_JOBS_CREATED: D7_E_MAX_FIRESTORE_JOBS_CREATED_,
    MAX_FIRESTORE_ATTACHMENT_RECORDS_CREATED: D7_E_MAX_FIRESTORE_ATTACHMENT_RECORDS_CREATED_,
    MAX_FIRESTORE_JOB_TRANSITIONS: D7_E_MAX_FIRESTORE_JOB_TRANSITIONS_,
    MAX_FIRESTORE_AUDIT_EVENTS: D7_E_MAX_FIRESTORE_AUDIT_EVENTS_,
    MAX_FIRESTORE_RECONCILIATION_REPORTS: D7_E_MAX_FIRESTORE_RECONCILIATION_REPORTS_,
    MAX_FIRESTORE_TOTAL_WRITE_OPERATIONS: D7_E_MAX_FIRESTORE_TOTAL_WRITE_OPERATIONS_,
    MAX_GMAIL_LABEL_MUTATIONS: D7_E_MAX_GMAIL_LABEL_MUTATIONS_,
    MAX_SCRIPT_PROPERTY_MUTATIONS: D7_E_MAX_SCRIPT_PROPERTY_MUTATIONS_,
    MAX_TRIGGER_MUTATIONS: D7_E_MAX_TRIGGER_MUTATIONS_,
    MAX_DESTRUCTIVE_OPERATIONS: D7_E_MAX_DESTRUCTIVE_OPERATIONS_
  });
}

async function acquireD7ELease_(leaseStore, plan, clock) {
  if (!leaseStore || typeof leaseStore.acquireLease !== 'function') throw d7eError_('BLOCKED_D7_E_LEASE_STORE_MISSING');
  const acquiredAt = clock.now();
  const expiresAt = new Date(Date.parse(acquiredAt) + D7_E_LEASE_DURATION_MS_).toISOString();
  return leaseStore.acquireLease({
    leaseId: plan.jobId,
    jobId: plan.jobId,
    leaseOwner: D7_E_LEASE_OWNER_,
    fencingToken: plan.idempotencyKeys.lease,
    acquiredAt,
    expiresAt
  });
}

function isD7ELeaseAcquiredStatus_(status) {
  return ['ACQUIRED', 'ALREADY_HELD_BY_SAME_JOB', 'LEASE_RECLAIMED_EXPIRED', 'ACQUIRED_AFTER_RELEASED', 'ACQUIRED_AFTER_RECONCILIATION_REQUIRED'].indexOf(String(status || '')) >= 0;
}

async function releaseD7ELease_(leaseStore, lease, result, finalJobStatus, opts) {
  if (!leaseStore || !lease || typeof leaseStore.releaseLease !== 'function') return null;
  const options = opts || {};
  try {
    const outcome = await leaseStore.releaseLease({
      leaseId: lease.leaseId || lease.jobId || (lease.lease && lease.lease.leaseId),
      jobId: lease.jobId || (lease.lease && lease.lease.jobId),
      leaseOwner: D7_E_LEASE_OWNER_,
      fencingToken: lease.fencingToken || (lease.lease && lease.lease.fencingToken),
      releasedAt: options.clock.now(),
      finalJobStatus
    });
    result.LEASE_FINAL_STATUS = 'RELEASED';
    result.LEASE_RELEASE_STATUS = normalizeD7EString_(outcome && outcome.status) || 'CONFIRMED';
    result.FIRESTORE_LEASE_WRITE_COUNT += Number(outcome && outcome.mutationCount || 0);
    return outcome;
  } catch (error) {
    result.LEASE_RELEASE_STATUS = 'FAILED_' + normalizeD7EErrorCode_(error && (error.code || error.message));
    if (options.mustConfirm) throw error;
    return null;
  }
}

async function closeD7ELeaseAfterFailure_(leaseStore, lease, result, finalJobStatus, opts) {
  if (!leaseStore || !lease) return null;
  if (finalJobStatus === 'RECONCILIATION_REQUIRED' && typeof leaseStore.markLeaseReconciliationRequired === 'function') {
    try {
      const outcome = await leaseStore.markLeaseReconciliationRequired({
        leaseId: lease.leaseId || lease.jobId || (lease.lease && lease.lease.leaseId),
        jobId: lease.jobId || (lease.lease && lease.lease.jobId),
        leaseOwner: D7_E_LEASE_OWNER_,
        fencingToken: lease.fencingToken || (lease.lease && lease.lease.fencingToken),
        releasedAt: opts.clock.now(),
        errorCode: normalizeD7EErrorCode_(opts.error && (opts.error.code || opts.error.message))
      });
      result.LEASE_FINAL_STATUS = 'RECONCILIATION_REQUIRED';
      result.LEASE_RELEASE_STATUS = 'RECONCILIATION_REQUIRED';
      result.FIRESTORE_LEASE_WRITE_COUNT += Number(outcome && outcome.mutationCount || 0);
      return outcome;
    } catch (_ignored) {
      result.LEASE_RELEASE_STATUS = 'RECONCILIATION_MARK_ATTEMPTED_BUT_UNCONFIRMED';
      return null;
    }
  }
  return releaseD7ELease_(leaseStore, lease, result, finalJobStatus, { clock: opts.clock, mustConfirm: false });
}

async function transitionD7EJob_(jobStore, plan, currentJob, toStatus, keySuffix, result) {
  const transitioned = await jobStore.transitionJob({
    jobId: plan.jobId,
    expectedVersion: Number(currentJob.version),
    fromStatus: currentJob.status,
    toStatus,
    idempotencyKey: keySuffix + '_' + plan.jobId
  });
  result.FIRESTORE_JOB_TRANSITION_COUNT += 1;
  result.FIRESTORE_JOB_WRITE_COUNT += 1;
  return transitioned.job;
}

async function appendD7EAuditEvent_(jobStore, plan, job, sequence, eventType) {
  return jobStore.appendAuditEvent({
    jobId: plan.jobId,
    sequence,
    eventType,
    actorType: 'APPS_SCRIPT_D7_E',
    safeDetails: {
      schemaVersion: D7_E_SCHEMA_VERSION_,
      candidateFingerprintHashPrefix: hashPrefixD7E_(plan.candidateFingerprint, 16),
      jobStatus: normalizeD7EString_(job && job.status)
    }
  });
}

async function writeAndVerifyD7EDriveArtifacts_(drive, plan) {
  const mutate = drive && drive.mutate;
  const read = drive && drive.read;
  if (!mutate || !read) throw d7eError_('BLOCKED_D7_E_DRIVE_ADAPTER_MISSING');
  let xml = null;
  let pdf = null;
  let createdCount = 0;
  let alreadyCount = 0;
  try {
    xml = await mutate.createFileIfAbsent({ ...plan.driveTargets.xml, idempotencyKey: plan.idempotencyKeys.xml });
    if (xml.status === 'CONFIRMED_WRITTEN' && !xml.idempotent) createdCount += 1;
    if (xml.status === 'ALREADY_PRESENT' || xml.idempotent) alreadyCount += 1;
    pdf = await mutate.createFileIfAbsent({ ...plan.driveTargets.pdf, idempotencyKey: plan.idempotencyKeys.pdf });
    if (pdf.status === 'CONFIRMED_WRITTEN' && !pdf.idempotent) createdCount += 1;
    if (pdf.status === 'ALREADY_PRESENT' || pdf.idempotent) alreadyCount += 1;
  } catch (error) {
    error.driveMutationCount = createdCount;
    error.partialSafeResult = {
      DRIVE_XML_STATUS: xml ? xml.status : 'NOT_ATTEMPTED',
      DRIVE_PDF_STATUS: pdf ? pdf.status : 'NOT_ATTEMPTED',
      DRIVE_FILES_CREATED: createdCount,
      DRIVE_FILES_ALREADY_PRESENT: alreadyCount
    };
    throw error;
  }
  try {
    const verifiedXml = await read.readFileMetadata({ logicalFileIdentity: plan.driveTargets.xml.logicalFileIdentity, fileReference: xml.fileReference });
    const verifiedPdf = await read.readFileMetadata({ logicalFileIdentity: plan.driveTargets.pdf.logicalFileIdentity, fileReference: pdf.fileReference });
    assertD7EDriveReadback_(verifiedXml, plan.driveTargets.xml, 'XML');
    assertD7EDriveReadback_(verifiedPdf, plan.driveTargets.pdf, 'PDF');
  } catch (error) {
    error.driveMutationCount = createdCount;
    error.partialSafeResult = {
      DRIVE_XML_STATUS: xml ? xml.status : 'NOT_ATTEMPTED',
      DRIVE_PDF_STATUS: pdf ? pdf.status : 'NOT_ATTEMPTED',
      DRIVE_FILES_CREATED: createdCount,
      DRIVE_FILES_ALREADY_PRESENT: alreadyCount
    };
    throw error;
  }
  return {
    createdCount,
    safeResult: {
      DRIVE_XML_STATUS: xml.status,
      DRIVE_PDF_STATUS: pdf.status,
      DRIVE_FILES_CREATED: createdCount,
      DRIVE_FILES_ALREADY_PRESENT: alreadyCount,
      DRIVE_VERIFICATION_STATUS: 'PASS'
    }
  };
}

function assertD7EDriveReadback_(file, target, kind) {
  if (!file || file.exists === false) throw d7eError_('BLOCKED_D7_E_DRIVE_' + kind + '_READBACK_MISSING');
  if (file.logicalFileIdentity !== target.logicalFileIdentity) throw d7eError_('BLOCKED_D7_E_DRIVE_' + kind + '_IDENTITY_MISMATCH');
  if (!file.fileReference) throw d7eError_('BLOCKED_D7_E_DRIVE_' + kind + '_REFERENCE_MISSING');
  if (file.contentHash !== target.contentHash) throw d7eError_('BLOCKED_D7_E_DRIVE_' + kind + '_HASH_MISMATCH');
  if (Number(file.byteSize) !== Number(target.byteSize)) throw d7eError_('BLOCKED_D7_E_DRIVE_' + kind + '_BYTE_SIZE_MISMATCH');
}

async function appendAndVerifyD7ESheetTransaction_(sheets, plan) {
  const mutate = sheets && sheets.mutate;
  const read = sheets && sheets.read;
  if (!mutate || !read) throw d7eError_('BLOCKED_D7_E_SHEETS_ADAPTER_MISSING');
  let append = null;
  try {
    append = await mutate.appendImmutableTransactionsIfAbsent({
      rows: plan.ledgerRows,
      idempotencyKey: plan.idempotencyKeys.sheet
    });
    const verify = await read.findTransactionByIdentity({
      transactionIdentity: plan.ledgerRows[0].transactionIdentity,
      hashIndex: plan.ledgerRows[0].legacyHashIndex,
      invoiceKeyV2: plan.ledgerRows[0].invoiceKeyV2,
      legacyInvoiceKey: plan.ledgerRows[0].legacyInvoiceKey
    });
    if (verify.status !== 'ALREADY_PRESENT' || verify.rows.length !== 1) throw d7eError_('BLOCKED_D7_E_SHEET_READBACK_MISSING');
    assertD7ESheetRowMatches_(verify.rows[0], plan.ledgerRows[0]);
  } catch (error) {
    error.sheetsMutationCount = Number(append && append.appendedCount || 0);
    error.partialSafeResult = {
      SHEETS_TRANSACTION_STATUS: append ? append.status : 'NOT_ATTEMPTED',
      SHEETS_ROWS_APPENDED: Number(append && append.appendedCount || 0),
      SHEETS_ROWS_ALREADY_PRESENT: append && append.idempotent ? 1 : 0
    };
    throw error;
  }
  return {
    appendedCount: Number(append.appendedCount || 0),
    safeResult: {
      SHEETS_TRANSACTION_STATUS: append.status,
      SHEETS_ROWS_APPENDED: Number(append.appendedCount || 0),
      SHEETS_ROWS_ALREADY_PRESENT: append.idempotent ? 1 : 0,
      SHEETS_VERIFICATION_STATUS: 'PASS'
    }
  };
}

function assertD7ESheetRowMatches_(actual, expected) {
  ['invoiceKeyV2', 'legacyInvoiceKey', 'legacyHashIndex'].forEach(field => {
    if (normalizeD7EString_(actual && actual[field]) !== normalizeD7EString_(expected && expected[field])) {
      throw d7eError_('BLOCKED_D7_E_SHEET_TRANSACTION_CONFLICT');
    }
  });
  ['issueDate', 'direction', 'itemCode', 'itemName'].forEach(field => {
    if (!normalizeD7EString_(expected && expected[field])) return;
    if (normalizeD7EString_(actual && actual[field]).toUpperCase() !== normalizeD7EString_(expected && expected[field]).toUpperCase()) {
      throw d7eError_('BLOCKED_D7_E_SHEET_TRANSACTION_CONFLICT');
    }
  });
  ['quantity', 'unitPrice', 'amount'].forEach(field => {
    if (!numbersEqualD7E_(actual && actual[field], expected && expected[field])) {
      throw d7eError_('BLOCKED_D7_E_SHEET_TRANSACTION_CONFLICT');
    }
  });
}

async function saveD7EAttachmentRecords_(store, plan) {
  if (!store || typeof store.createAttachmentRecordIfAbsent !== 'function') throw d7eError_('BLOCKED_D7_E_ATTACHMENT_STORE_MISSING');
  let createdCount = 0;
  let alreadyCount = 0;
  const statuses = [];
  for (let i = 0; i < plan.attachmentRecords.length; i += 1) {
    const record = await store.createAttachmentRecordIfAbsent(plan.attachmentRecords[i]);
    if (record.created) createdCount += 1;
    if (!record.created || record.idempotent) alreadyCount += 1;
    statuses.push(record.status || (record.created ? 'CREATED' : 'ALREADY_PRESENT'));
  }
  return {
    createdCount,
    safeResult: {
      FIRESTORE_ATTACHMENT_RECORDS_STATUS: statuses.join(','),
      FIRESTORE_ATTACHMENT_RECORDS_CREATED: createdCount,
      FIRESTORE_ATTACHMENT_RECORDS_ALREADY_PRESENT: alreadyCount
    }
  };
}

async function saveD7EReconciliationReport_(jobStore, plan, job, status, findings) {
  return jobStore.saveReconciliationReport({
    jobId: plan.jobId,
    expectedVersion: Number(job.version),
    report: {
      jobId: plan.jobId,
      reportId: 'd7e_rpt_' + hashPrefixD7E_([plan.jobId, status, (findings || []).map(f => f.code).join('|')].join('|'), 20),
      invoiceKeyHashPrefix: hashPrefixD7E_(plan.commitPlan.invoiceKeyV2, 8),
      status,
      findingCount: (findings || []).length,
      blockerCount: (findings || []).filter(f => f.severity === 'ERROR').length,
      findings: findings || [],
      inputSnapshotVersion: D7_E_SCHEMA_VERSION_,
      jobVersion: Number(job.version)
    }
  });
}

async function maybeMarkD7EReconciliationRequired_(jobStore, plan, job, error, result) {
  if (!jobStore || !plan || !job || !result) return;
  const externalMutationCount = Number(result.DRIVE_MUTATION_COUNT || 0) + Number(result.SHEETS_MUTATION_COUNT || 0);
  if (externalMutationCount <= 0) return;
  if (job.status === 'COMPLETED' || job.status === 'RECONCILIATION_REQUIRED') return;
  try {
    const finding = {
      code: normalizeD7EErrorCode_(error && (error.code || error.message) || 'D7_E_PARTIAL_FAILURE'),
      severity: 'ERROR',
      scope: 'D7_E_ONE_CANDIDATE_PILOT',
      repairPolicy: 'REPORT_ONLY_OWNER_REVIEW',
      safeMessage: 'D7_E_PARTIAL_FAILURE_AFTER_CONFIRMED_MUTATION'
    };
    const report = await saveD7EReconciliationReport_(jobStore, plan, job, 'CONFLICTED', [finding]);
    result.RECONCILIATION_STATUS = 'RECONCILIATION_REQUIRED';
    result.FIRESTORE_RECONCILIATION_REPORT_COUNT += 1;
    result.FIRESTORE_RECONCILIATION_WRITE_COUNT += 2;
    await jobStore.markReconciliationRequired({
      jobId: plan.jobId,
      expectedVersion: Number(report.job.version),
      errorCode: finding.code,
      errorStage: 'D7_E_PARTIAL_FAILURE'
    });
    result.FIRESTORE_JOB_WRITE_COUNT += 1;
    result.FIRESTORE_JOB_STATUS = 'RECONCILIATION_REQUIRED';
  } catch (_ignored) {
    result.RECONCILIATION_STATUS = 'RECONCILIATION_MARK_ATTEMPTED_BUT_UNCONFIRMED';
  }
}

async function verifyD7ECompletedNoop_(jobStore, plan, services, result) {
  const drive = services.createDriveAdapters({ plan });
  const sheets = services.createSheetsAdapters({ plan });
  const xml = await drive.read.readFileMetadata({ logicalFileIdentity: plan.driveTargets.xml.logicalFileIdentity });
  const pdf = await drive.read.readFileMetadata({ logicalFileIdentity: plan.driveTargets.pdf.logicalFileIdentity });
  const sheet = await sheets.read.findTransactionByIdentity({ transactionIdentity: plan.ledgerRows[0].transactionIdentity });
  assertD7EDriveReadback_(xml, plan.driveTargets.xml, 'XML');
  assertD7EDriveReadback_(pdf, plan.driveTargets.pdf, 'PDF');
  if (sheet.status !== 'ALREADY_PRESENT') throw d7eError_('BLOCKED_D7_E_COMPLETED_SHEET_VERIFY_FAILED');
  const resume = await jobStore.resumeCompletedJob({
    jobId: plan.jobId,
    verification: { ledgerVerified: true, registryVerified: true, projectionVerified: true }
  });
  mergeD7EResult_(result, {
    D7_E_STATUS: 'PASS_ALREADY_COMPLETED_IDEMPOTENT_NOOP',
    COMMIT_PLAN_STATUS: 'IDEMPOTENT_PLAN_MATCH',
    DRIVE_XML_STATUS: 'ALREADY_PRESENT',
    DRIVE_PDF_STATUS: 'ALREADY_PRESENT',
    DRIVE_FILES_CREATED: 0,
    DRIVE_FILES_ALREADY_PRESENT: 2,
    SHEETS_TRANSACTION_STATUS: 'ALREADY_PRESENT',
    SHEETS_ROWS_APPENDED: 0,
    SHEETS_ROWS_ALREADY_PRESENT: 1,
    FIRESTORE_JOB_STATUS: 'COMPLETED',
    RECONCILIATION_STATUS: 'CONSISTENT',
    IDEMPOTENT_RERUN_STATUS: resume.action || 'IDEMPOTENT_COMPLETE_NOOP',
    PRODUCTION_MUTATION: 'NONE'
  });
  finalizeD7EMutationCounts_(result);
  return result;
}

function createD7EDefaultDurableJobStore_() {
  if (typeof createDurableInvoiceJobStore !== 'function') throw d7eError_('BLOCKED_D7_E_DURABLE_STORE_MISSING');
  return createDurableInvoiceJobStore(createD6jCFirestoreDurableTransport_(), { clock: { now: () => new Date().toISOString() } });
}

function createD7EDefaultLeaseStore_() {
  return createD6jCFirestoreLeaseStore_(createD6jCFirestoreDurableTransport_(), {
    clock: { now: () => new Date().toISOString() },
    leaseDurationMs: D7_E_LEASE_DURATION_MS_
  });
}

function createD7EDefaultAttachmentRecordStore_() {
  return createD7EAttachmentRecordStore_(createD6jCFirestoreDurableTransport_());
}

function createD7EAttachmentRecordStore_(transport) {
  if (!transport || typeof transport.runTransaction !== 'function') throw d7eError_('BLOCKED_D7_E_ATTACHMENT_TRANSPORT_MISSING');
  return Object.freeze({
    async createAttachmentRecordIfAbsent(record) {
      const safe = sanitizeD7EAttachmentRecord_(record || {});
      const path = 'attachments/' + safe.attachmentId;
      return transport.runTransaction(async tx => {
        const existing = await tx.getDocument(path);
        if (existing) {
          if (normalizeD7EString_(existing.contentHash) !== safe.contentHash ||
              normalizeD7EString_(existing.jobId) !== safe.jobId ||
              normalizeD7EString_(existing.artifactType) !== safe.artifactType) {
            throw d7eError_('BLOCKED_D7_E_ATTACHMENT_RECORD_CONFLICT');
          }
          return { status: 'ALREADY_PRESENT', created: false, idempotent: true, record: existing };
        }
        await tx.createDocument(path, safe, { idempotencyKey: safe.attachmentId });
        return { status: 'CREATED', created: true, idempotent: false, record: safe };
      });
    }
  });
}

function sanitizeD7EAttachmentRecord_(record) {
  const safe = {
    schemaVersion: D7_E_SCHEMA_VERSION_,
    attachmentId: normalizeD7EString_(record.attachmentId),
    jobId: normalizeD7EString_(record.jobId),
    artifactType: normalizeD7EString_(record.artifactType).toUpperCase(),
    contentHash: normalizeD7EString_(record.contentHash),
    byteSize: Number(record.byteSize || 0),
    mimeType: normalizeD7EString_(record.mimeType),
    candidateFingerprintHashPrefix: normalizeD7EString_(record.candidateFingerprintHashPrefix)
  };
  if (!/^d7e_att_[a-f0-9]{16,32}$/.test(safe.attachmentId)) throw d7eError_('BLOCKED_D7_E_ATTACHMENT_ID_INVALID');
  if (!/^d7e_job_[a-f0-9]{16,32}$/.test(safe.jobId)) throw d7eError_('BLOCKED_D7_E_ATTACHMENT_JOB_ID_INVALID');
  if (['XML', 'PDF'].indexOf(safe.artifactType) < 0) throw d7eError_('BLOCKED_D7_E_ATTACHMENT_KIND_INVALID');
  if (!/^[a-f0-9]{64}$/.test(safe.contentHash)) throw d7eError_('BLOCKED_D7_E_ATTACHMENT_HASH_INVALID');
  return safe;
}

function createD7EDefaultDriveAdapters_(context) {
  const mapped = mapD7EContextToD6jCContext_(context || {});
  return createD6jCDefaultDriveAdapters_(mapped);
}

function createD7EDefaultSheetsAdapters_(context) {
  const mapped = mapD7EContextToD6jCContext_(context || {});
  return createD6jCDefaultSheetsAdapters_(mapped);
}

function mapD7EContextToD6jCContext_(context) {
  const properties = context.properties || {};
  const config = context.precheck && context.precheck.config || {};
  const mappedProperties = {
    D6J_DRIVE_ROOT_FOLDER_ID: normalizeD7EString_(config.folderId || properties.D7_B_DRIVE_ROOT_FOLDER_ID || properties.D7_DRIVE_ROOT_FOLDER_ID || properties.D6J_DRIVE_ROOT_FOLDER_ID),
    D6J_SPREADSHEET_ID: normalizeD7EString_(config.spreadsheetId || properties.D7_B_SPREADSHEET_ID || properties.D7_SPREADSHEET_ID || properties.D6J_SPREADSHEET_ID),
    D6J_SHEET_NAME: normalizeD7EString_(config.sheetName || properties.D7_B_TARGET_SHEET_NAME || properties.D7_TARGET_SHEET_NAME || properties.D6J_SHEET_NAME || 'Nhap-Xuat')
  };
  return { ...context, properties: mappedProperties };
}

function assertD7EObservedMutationBudget_(result) {
  const total = Number(result.FIRESTORE_TOTAL_WRITE_OPERATIONS || 0);
  if (Number(result.DRIVE_FILES_CREATED || 0) > D7_E_MAX_DRIVE_FILES_CREATED_) throw d7eError_('BLOCKED_D7_E_DRIVE_FILE_BUDGET_EXCEEDED');
  if (Number(result.SHEETS_ROWS_APPENDED || 0) > D7_E_MAX_SHEET_ROWS_INSERTED_) throw d7eError_('BLOCKED_D7_E_SHEET_INSERT_BUDGET_EXCEEDED');
  if (Number(result.SHEETS_ROWS_UPDATED || 0) !== 0) throw d7eError_('BLOCKED_D7_E_SHEET_UPDATE_BUDGET_EXCEEDED');
  if (Number(result.FIRESTORE_JOBS_CREATED || 0) > D7_E_MAX_FIRESTORE_JOBS_CREATED_) throw d7eError_('BLOCKED_D7_E_JOB_BUDGET_EXCEEDED');
  if (Number(result.FIRESTORE_ATTACHMENT_RECORDS_CREATED || 0) > D7_E_MAX_FIRESTORE_ATTACHMENT_RECORDS_CREATED_) throw d7eError_('BLOCKED_D7_E_ATTACHMENT_BUDGET_EXCEEDED');
  if (total > D7_E_MAX_FIRESTORE_TOTAL_WRITE_OPERATIONS_) throw d7eError_('BLOCKED_D7_E_FIRESTORE_TOTAL_BUDGET_EXCEEDED');
}

function finalizeD7EMutationCounts_(result) {
  result.SCRIPT_PROPERTY_MUTATION_COUNT = 0;
  result.GMAIL_MUTATION_COUNT = 0;
  result.GMAIL_LABEL_MUTATION_COUNT = 0;
  result.TRIGGER_MUTATION_COUNT = 0;
  result.DESTRUCTIVE_OPERATION_COUNT = 0;
  result.SHEETS_ROWS_UPDATED = 0;
  result.DRIVE_FOLDER_CREATION_COUNT = 0;
  result.FIRESTORE_TOTAL_WRITE_OPERATIONS = Number(result.FIRESTORE_LEASE_WRITE_COUNT || 0)
    + Number(result.FIRESTORE_JOB_WRITE_COUNT || 0)
    + Number(result.FIRESTORE_COMMIT_PLAN_WRITE_COUNT || 0)
    + Number(result.FIRESTORE_AUDIT_WRITE_COUNT || 0)
    + Number(result.FIRESTORE_ATTACHMENT_WRITE_COUNT || 0)
    + Number(result.FIRESTORE_RECONCILIATION_WRITE_COUNT || 0);
  result.FIRESTORE_MUTATION_COUNT = result.FIRESTORE_TOTAL_WRITE_OPERATIONS;
  result.PRODUCTION_MUTATION_COUNT = Number(result.DRIVE_MUTATION_COUNT || 0)
    + Number(result.SHEETS_MUTATION_COUNT || 0)
    + Number(result.FIRESTORE_TOTAL_WRITE_OPERATIONS || 0);
  if (result.D7_E_STATUS === 'PASS_ONE_CANDIDATE_PRODUCTION_PILOT_COMPLETED') {
    result.PRODUCTION_MUTATION = result.PRODUCTION_MUTATION_COUNT > 0 ? 'BOUNDED_ONE_CANDIDATE_PILOT' : 'NONE';
  }
}

function finalizeD7EBlockedResult_(result, error) {
  result.D7_E_STATUS = normalizeD7EErrorCode_(error && (error.code || error.message) || 'BLOCKED_D7_E_UNKNOWN');
  result.BLOCKER_CODE = result.D7_E_STATUS;
  finalizeD7EMutationCounts_(result);
  return result;
}

function createD7EBaseResult_() {
  return {
    PHASE: 'D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT',
    SCHEMA_VERSION: D7_E_SCHEMA_VERSION_,
    D7_E_STATUS: 'NOT_STARTED',
    APPROVAL_STATUS: 'NOT_EVALUATED',
    OWNER_APPROVAL_MARKER_VALID: 'NO',
    CANDIDATE_REDISCOVERY_STATUS: 'NOT_EVALUATED',
    RUNTIME_SAFETY_RECHECK: 'NOT_EVALUATED',
    EFFECTIVE_CONFIG_STATUS: 'NOT_EVALUATED',
    CANDIDATE_DISCOVERY_EXECUTED: 'NO',
    ELIGIBLE_CANDIDATE_COUNT: 0,
    APPROVED_CANDIDATE_COUNT: 0,
    INSPECTED_ATTACHMENT_COUNT: 0,
    ATTACHMENT_VALIDATION_STATUS: 'NOT_EVALUATED',
    CARDINALITY_STATUS: 'NOT_EVALUATED',
    FINGERPRINT_STATUS: 'NOT_EVALUATED',
    CANDIDATE_FINGERPRINT_MATCH: 'NO',
    INVOICE_KEY_HASH_MATCH: 'NO',
    ATTACHMENT_SET_SHA256_MATCH: 'NO',
    CANDIDATE_FINGERPRINT_HASH_PREFIX: '',
    INVOICE_KEY_HASH_PREFIX: '',
    ATTACHMENT_SET_SHA256_PREFIX: '',
    GMAIL_DUPLICATE_STATUS: 'NOT_EVALUATED',
    DRIVE_DUPLICATE_STATUS: 'NOT_EVALUATED',
    SHEET_DUPLICATE_STATUS: 'NOT_EVALUATED',
    FIRESTORE_DUPLICATE_STATUS: 'NOT_EVALUATED',
    SHEET_SCHEMA_STATUS: 'NOT_EVALUATED',
    MUTATION_BUDGET_STATUS: 'NOT_EVALUATED',
    LOCK_STATUS: 'NOT_ATTEMPTED',
    LOCK_RECHECK_STATUS: 'NOT_ATTEMPTED',
    LEASE_STATUS: 'NOT_ATTEMPTED',
    LEASE_FINAL_STATUS: 'NOT_ATTEMPTED',
    LEASE_RELEASE_STATUS: 'NOT_ATTEMPTED',
    LEASE_RECLAIM_STATUS: 'NOT_EVALUATED',
    LEASE_EXPIRES_AT_PRESENT: 'NO',
    COMMIT_PLAN_STATUS: 'NOT_ATTEMPTED',
    DRIVE_XML_STATUS: 'NOT_ATTEMPTED',
    DRIVE_PDF_STATUS: 'NOT_ATTEMPTED',
    DRIVE_VERIFICATION_STATUS: 'NOT_ATTEMPTED',
    DRIVE_FILES_CREATED: 0,
    DRIVE_FILES_ALREADY_PRESENT: 0,
    DRIVE_FOLDER_CREATION_COUNT: 0,
    SHEETS_TRANSACTION_STATUS: 'NOT_ATTEMPTED',
    SHEETS_VERIFICATION_STATUS: 'NOT_ATTEMPTED',
    SHEETS_ROWS_APPENDED: 0,
    SHEETS_ROWS_ALREADY_PRESENT: 0,
    SHEETS_ROWS_UPDATED: 0,
    FIRESTORE_JOB_STATUS: 'NOT_ATTEMPTED',
    FIRESTORE_ATTACHMENT_RECORDS_STATUS: 'NOT_ATTEMPTED',
    FIRESTORE_ATTACHMENT_RECORDS_CREATED: 0,
    FIRESTORE_ATTACHMENT_RECORDS_ALREADY_PRESENT: 0,
    FIRESTORE_JOBS_CREATED: 0,
    FIRESTORE_JOB_TRANSITION_COUNT: 0,
    FIRESTORE_AUDIT_EVENT_COUNT: 0,
    FIRESTORE_RECONCILIATION_REPORT_COUNT: 0,
    FIRESTORE_LEASE_WRITE_COUNT: 0,
    FIRESTORE_JOB_WRITE_COUNT: 0,
    FIRESTORE_COMMIT_PLAN_WRITE_COUNT: 0,
    FIRESTORE_AUDIT_WRITE_COUNT: 0,
    FIRESTORE_ATTACHMENT_WRITE_COUNT: 0,
    FIRESTORE_RECONCILIATION_WRITE_COUNT: 0,
    FIRESTORE_TOTAL_WRITE_OPERATIONS: 0,
    GMAIL_PROJECTION_STATUS: 'NOT_REQUIRED_BUDGET_ZERO',
    GMAIL_LABEL_MUTATION_COUNT: 0,
    RECONCILIATION_STATUS: 'NOT_ATTEMPTED',
    IDEMPOTENT_RERUN_STATUS: 'NOT_EVALUATED',
    SCRIPT_PROPERTY_MUTATION_COUNT: 0,
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    FIRESTORE_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    PRODUCTION_MUTATION_COUNT: 0,
    RAW_EMAIL_ADDRESS_LOG_COUNT: 0,
    RAW_EMAIL_SUBJECT_LOG_COUNT: 0,
    RAW_EMAIL_BODY_LOG_COUNT: 0,
    RAW_MESSAGE_ID_LOG_COUNT: 0,
    RAW_XML_LOG_COUNT: 0,
    RAW_PDF_CONTENT_LOG_COUNT: 0,
    CUSTOMER_CONTENT_LOG_COUNT: 0,
    PRODUCTION_MUTATION: 'NONE',
    BLOCKER_CODE: ''
  };
}

function logD7ESanitizedResult_(logger, result) {
  const safe = sanitizeD7EObject_(result);
  const text = JSON.stringify(safe);
  if (/(Bearer|Authorization|refresh_token|private_key|client_secret|<\?xml|<Invoice|JVBERi0|\b80,68,70\b|@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i.test(text)) {
    throw d7eError_('BLOCKED_UNSAFE_D7_E_LOG_PAYLOAD');
  }
  if (logger && typeof logger.log === 'function') logger.log(text);
}

function sanitizeD7EObject_(value) {
  if (Array.isArray(value)) return value.map(sanitizeD7EObject_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).forEach(key => {
      out[key] = sanitizeD7EObject_(value[key]);
    });
    return out;
  }
  if (typeof value === 'string') return sanitizeD7EString_(value);
  return value;
}

function sanitizeD7EString_(value) {
  return String(value == null ? '' : value)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/=-]+/g, 'Bearer <redacted>')
    .replace(/Authorization\s+[A-Za-z0-9._~+\/=-]+/g, 'Authorization <redacted>')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email-redacted>')
    .replace(/ya29\.[A-Za-z0-9._-]+/g, '<oauth-token-redacted>')
    .replace(/(refresh_token|private_key|client_secret)\s*[=:]?\s*[^\s,;)]*/ig, 'REDACTED')
    .slice(0, 500);
}

function buildD7ELegacyInvoiceKey_(issueDate, taxCode, invoiceNo) {
  const date = normalizeD7EString_(issueDate).replace(/\D/g, '');
  const tax = normalizeD7EString_(taxCode).replace(/\D/g, '') || 'UNKNOWNTAXCODE';
  const inv = normalizeD7EString_(invoiceNo);
  return [date, tax, inv].join('_');
}

function getD7EInvoiceYear_(issueDate) {
  const text = normalizeD7EString_(issueDate);
  const match = text.match(/^(\d{4})/);
  return match ? match[1] : 'UNKNOWN';
}

function numbersEqualD7E_(a, b) {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) < 0.000001;
}

function hashPrefixD7E_(value, length) {
  const text = String(value || '');
  if (/^[a-f0-9]{16,}$/i.test(text)) return text.toLowerCase().slice(0, Number(length || 16));
  if (typeof hashPrefixD6jB_ === 'function') return hashPrefixD6jB_(text, length || 16);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-Number(length || 8));
}

function durableIdentityHashPrefixD7E_(value) {
  if (typeof durableFirestoreHashPrefix_ === 'function') return durableFirestoreHashPrefix_(value);
  return hashPrefixD7E_(value, 8);
}

function normalizeD7EString_(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function normalizeD7EErrorCode_(value) {
  return normalizeD7EString_(value).toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 100) || 'BLOCKED_D7_E_UNKNOWN';
}

function cloneD7EJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function mergeD7EResult_(target, patch) {
  Object.keys(patch || {}).forEach(key => {
    target[key] = patch[key];
  });
  return target;
}

function d7eError_(code) {
  const error = new Error(String(code));
  error.code = String(code).split(':')[0];
  return error;
}
