const D7_E4B_PHASE_ = 'D7_E4B1_EXACT_RECONCILIATION_RUNTIME_IMPLEMENTATION_AND_SOURCE_SYNC';
const D7_E4B_SCHEMA_VERSION_ = 'D7_E4B_EXACT_FIRESTORE_RECONCILIATION_RESULT_V1';
const D7_E4B_PUBLIC_ENTRYPOINT_ = 'runD7E4BExactFirestoreReconciliation';
const D7_E4B_OWNER_MARKER_PROPERTY_ = 'D7_E4B_OWNER_APPROVAL_MARKER';
const D7_E4B_OWNER_MARKER_VALUE_ = 'OWNER_APPROVED_D7_E4B_ONE_EXACT_JOB_SEVEN_FIRESTORE_WRITES_NO_EXTERNAL_MUTATION_V1';
const D7_E4B_OWNER_DISPOSITION_ = 'ADOPT_CURRENT_EXACT_SHEET_ROW_AS_UNKNOWN_EXTERNAL_STATE';
const D7_E4B_AUDIT_EVENT_TYPE_ = 'OWNER_APPROVED_POST_HOC_EXTERNAL_SHEET_STATE_ADOPTION_RECONCILIATION';
const D7_E4B_EXPECTED_INITIAL_JOB_STATUS_ = 'VALIDATED';
const D7_E4B_EXPECTED_INITIAL_JOB_VERSION_ = 4;
const D7_E4B_EXPECTED_FINAL_JOB_VERSION_ = 7;
const D7_E4B_EXPECTED_RECONCILIATION_STATUS_ = 'RECONCILIATION_REQUIRED';
const D7_E4B_EXPECTED_INITIAL_AUDIT_COUNT_ = 2;
const D7_E4B_EXPECTED_INITIAL_REPORT_COUNT_ = 1;
const D7_E4B_EXPECTED_FINAL_AUDIT_COUNT_ = 3;
const D7_E4B_EXPECTED_FINAL_REPORT_COUNT_ = 2;
const D7_E4B_LEASE_DURATION_MS_ = 10 * 60 * 1000;
const D7_E4B_DRIVE_SCAN_LIMIT_ = 20;
const D7_E4B_FIRESTORE_PROJECT_ID_ = 'tonkhohd';
const D7_E4B_FIRESTORE_DATABASE_ID_ = '(default)';

const D7_E4B_WRITE_BUDGET_ = Object.freeze({
  JOB_UPDATES: 3,
  LEASE_UPDATES: 2,
  RECONCILIATION_REPORT_CREATES: 1,
  AUDIT_EVENT_CREATES: 1,
  ATTACHMENT_CREATES: 0,
  FIRESTORE_TOTAL: 7,
  GMAIL: 0,
  DRIVE: 0,
  SHEETS: 0,
  SCRIPT_PROPERTIES: 0,
  TRIGGERS: 0,
  DESTRUCTIVE: 0
});

function createD7E4BExactFirestoreReconciliationRunner_(dependencies) {
  const d = dependencies || {};
  const services = {
    readProperties: d.readProperties || readD7E4BScriptPropertiesReadOnly_,
    captureSnapshot: d.captureSnapshot || captureD7E4BProductionSnapshot_,
    createJobStore: d.createJobStore || function createD7E4BJobStore_() { return createD7EDefaultDurableJobStore_(); },
    createLeaseStore: d.createLeaseStore || function createD7E4BLeaseStore_() {
      return createD7E4BExactLeaseStore_(createD6jCFirestoreDurableTransport_(), { clock: services.clock });
    },
    createLock: d.createLock || function createD7E4BLock_() { return LockService.getScriptLock(); },
    clock: d.clock || { now: function nowD7E4B_() { return new Date().toISOString(); } },
    logger: d.logger || (typeof Logger !== 'undefined' ? Logger : { log: function noopD7E4B_() {} })
  };

  async function run() {
    const result = createD7E4BBaseResult_();
    let lock = null;
    let lockAcquired = false;
    let activeLease = null;
    let leaseStore = null;
    let stage = 'OWNER_AUTHORIZATION';
    try {
      const authorization = validateD7E4BAuthorization_(services.readProperties());
      result.OWNER_APPROVAL_MARKER_VALID = authorization.ownerMarkerValid ? 'YES' : 'NO';
      if (!authorization.ownerMarkerValid) throw d7e4bError_('BLOCKED_D7_E4B_OWNER_MARKER_INVALID');
      if (!authorization.ready) throw d7e4bError_('BLOCKED_D7_E4B_PRECONDITION_CHANGED');

      lock = services.createLock();
      if (!lock || typeof lock.tryLock !== 'function' || !lock.tryLock(30000)) throw d7e4bError_('BLOCKED_D7_E4B_SCRIPT_LOCK_NOT_ACQUIRED');
      lockAcquired = true;

      stage = 'FRESH_PRE_MUTATION_READ';
      const expected = buildD7E4BExpectedIdentity_(authorization);
      const snapshot = await services.captureSnapshot({ authorization: authorization, expected: expected, rawProperties: authorization.rawProperties, stage: stage });
      copyD7E4BInitialState_(result, snapshot);
      const plan = buildD7E4BReconciliationPlan_(expected, snapshot, services.clock.now());

      if (isD7E4BConfirmedSuccessfulReplay_(snapshot, plan)) {
        result.PRECONDITION_STATUS = 'ALREADY_RECONCILED_CONFIRMED';
        result.FINAL_JOB_STATUS = D7_E4B_EXPECTED_RECONCILIATION_STATUS_;
        result.FINAL_JOB_VERSION = D7_E4B_EXPECTED_FINAL_JOB_VERSION_;
        result.FINAL_RECONCILIATION_STATUS = D7_E4B_EXPECTED_RECONCILIATION_STATUS_;
        result.FINAL_LEASE_STATUS = D7_E4B_EXPECTED_RECONCILIATION_STATUS_;
        result.POST_WRITE_VERIFICATION_STATUS = 'NOT_REQUIRED_CONFIRMED_REPLAY_NOOP';
        result.FINAL_STATUS = 'PASS_D7_E4B_ALREADY_RECONCILED_NOOP';
        finalizeD7E4BResult_(result);
        logD7E4BSanitizedResult_(services.logger, result);
        return result;
      }

      assertD7E4BInitialPreconditions_(authorization, snapshot, expected);
      result.PRECONDITION_STATUS = 'PASS';
      assertD7E4BPlannedBudget_(plan);
      const jobStore = services.createJobStore({ authorization: authorization, expected: expected, snapshot: snapshot, plan: plan });
      leaseStore = services.createLeaseStore({ authorization: authorization, expected: expected, snapshot: snapshot, plan: plan });

      stage = 'LEASE_REACQUIRE';
      assertD7E4BBudgetAvailable_(result, { LEASE_UPDATE_COUNT: 1 });
      const acquiredAt = services.clock.now();
      activeLease = await leaseStore.reacquireReconciliationLease({
        leaseId: expected.jobId,
        jobId: expected.jobId,
        fencingToken: expected.leaseFence,
        expectedGeneration: Number(snapshot.lease && snapshot.lease.leaseGeneration),
        leaseOwner: 'apps_script_d7_e4b',
        acquiredAt: acquiredAt,
        expiresAt: addD7E4BMilliseconds_(acquiredAt, D7_E4B_LEASE_DURATION_MS_)
      });
      if (!activeLease || activeLease.status !== 'ACQUIRED_AFTER_RECONCILIATION_REQUIRED' || Number(activeLease.mutationCount) !== 1) {
        throw d7e4bError_('BLOCKED_D7_E4B_LEASE_REACQUIRE_NOT_CONFIRMED');
      }
      result.LEASE_UPDATE_COUNT += 1;

      stage = 'RECONCILIATION_REPORT_TRANSACTION';
      assertD7E4BBudgetAvailable_(result, { REPORT_CREATE_COUNT: 1, JOB_UPDATE_COUNT: 1 });
      const reportSaved = await jobStore.saveReconciliationReport({
        jobId: expected.jobId,
        expectedVersion: D7_E4B_EXPECTED_INITIAL_JOB_VERSION_,
        report: plan.report
      });
      if (!reportSaved || reportSaved.resultCode !== 'RECONCILIATION_REPORT_SAVED') {
        throw d7e4bError_('BLOCKED_D7_E4B_REPORT_TRANSACTION_NOT_EXACT_CREATE');
      }
      result.REPORT_CREATE_COUNT += 1;
      result.JOB_UPDATE_COUNT += 1;
      let job = reportSaved.job;
      assertD7E4BJobVersionAndState_(job, 5, 'VALIDATED');

      stage = 'TRANSITION_FAILED_REVIEW_REQUIRED';
      assertD7E4BBudgetAvailable_(result, { JOB_UPDATE_COUNT: 1 });
      const failedReview = await jobStore.transitionJob({
        jobId: expected.jobId,
        expectedVersion: 5,
        fromStatus: 'VALIDATED',
        toStatus: 'FAILED_REVIEW_REQUIRED',
        idempotencyKey: plan.transitionToFailedReviewKey
      });
      if (!failedReview || failedReview.resultCode !== 'JOB_TRANSITIONED') throw d7e4bError_('BLOCKED_D7_E4B_FIRST_TRANSITION_NOT_CONFIRMED');
      result.JOB_UPDATE_COUNT += 1;
      job = failedReview.job;
      assertD7E4BJobVersionAndState_(job, 6, 'FAILED_REVIEW_REQUIRED');

      stage = 'TRANSITION_RECONCILIATION_REQUIRED';
      assertD7E4BBudgetAvailable_(result, { JOB_UPDATE_COUNT: 1 });
      const reconciled = await jobStore.transitionJob({
        jobId: expected.jobId,
        expectedVersion: 6,
        fromStatus: 'FAILED_REVIEW_REQUIRED',
        toStatus: 'RECONCILIATION_REQUIRED',
        idempotencyKey: plan.transitionToReconciliationKey
      });
      if (!reconciled || reconciled.resultCode !== 'JOB_TRANSITIONED') throw d7e4bError_('BLOCKED_D7_E4B_SECOND_TRANSITION_NOT_CONFIRMED');
      result.JOB_UPDATE_COUNT += 1;
      job = reconciled.job;
      assertD7E4BJobVersionAndState_(job, D7_E4B_EXPECTED_FINAL_JOB_VERSION_, 'RECONCILIATION_REQUIRED');

      stage = 'DETERMINISTIC_AUDIT_EVENT';
      assertD7E4BBudgetAvailable_(result, { AUDIT_CREATE_COUNT: 1 });
      const audit = await jobStore.appendAuditEvent({
        jobId: expected.jobId,
        sequence: 3,
        eventType: D7_E4B_AUDIT_EVENT_TYPE_,
        actorType: 'APPS_SCRIPT_D7_E4B',
        safeDetails: {
          disposition: D7_E4B_OWNER_DISPOSITION_,
          sheetCreator: 'UNKNOWN',
          historicalAttribution: 'ATTRIBUTION_UNPROVEN',
          externalRepair: 'NONE',
          attachmentRecordsCreated: 0,
          jobStatus: 'RECONCILIATION_REQUIRED',
          originalTransactionOutcome: 'NOT_CLAIMED_COMPLETED'
        }
      });
      if (!audit || audit.resultCode !== 'AUDIT_EVENT_APPENDED' || !audit.event || audit.event.eventId !== plan.auditEventId) {
        throw d7e4bError_('BLOCKED_D7_E4B_AUDIT_CREATE_NOT_CONFIRMED');
      }
      result.AUDIT_CREATE_COUNT += 1;

      stage = 'LEASE_FINALIZE';
      assertD7E4BBudgetAvailable_(result, { LEASE_UPDATE_COUNT: 1 });
      const finalizedLease = await leaseStore.finalizeReconciliationLease({
        leaseId: expected.jobId,
        jobId: expected.jobId,
        fencingToken: expected.leaseFence,
        expectedGeneration: Number(activeLease.lease && activeLease.lease.leaseGeneration),
        leaseOwner: 'apps_script_d7_e4b',
        releasedAt: services.clock.now(),
        errorCode: 'D7_E4B_OWNER_ADOPTION_RECONCILIATION'
      });
      if (!finalizedLease || finalizedLease.status !== 'RECONCILIATION_REQUIRED' || Number(finalizedLease.mutationCount) !== 1) {
        throw d7e4bError_('BLOCKED_D7_E4B_LEASE_FINALIZATION_NOT_CONFIRMED');
      }
      result.LEASE_UPDATE_COUNT += 1;
      activeLease = null;

      stage = 'POST_WRITE_READ_ONLY_VERIFICATION';
      const postSnapshot = await services.captureSnapshot({ authorization: authorization, expected: expected, rawProperties: authorization.rawProperties, stage: stage, plan: plan });
      assertD7E4BSuccessfulPostWriteSnapshot_(postSnapshot, plan);
      result.POST_WRITE_VERIFICATION_STATUS = 'PASS';
      result.FINAL_JOB_STATUS = postSnapshot.job.status;
      result.FINAL_JOB_VERSION = Number(postSnapshot.job.version);
      result.FINAL_RECONCILIATION_STATUS = postSnapshot.job.reconciliationStatus;
      result.FINAL_LEASE_STATUS = postSnapshot.lease.status;
      result.FINAL_STATUS = 'PASS_D7_E4B1_EXACT_RECONCILIATION_RUNTIME_READY_NOT_EXECUTED';
      finalizeD7E4BResult_(result);
      assertD7E4BExactSuccessCounters_(result);
      logD7E4BSanitizedResult_(services.logger, result);
      return result;
    } catch (error) {
      const unknown = isD7E4BUnknownWriteOutcome_(error, stage);
      if (unknown) {
        result.UNKNOWN_WRITE_OUTCOME = 'YES';
        result.BLOCKER_CODE = 'UNKNOWN_WRITE_OUTCOME_REQUIRES_OWNER_REVIEW';
        result.FINAL_STATUS = 'UNKNOWN_WRITE_OUTCOME_REQUIRES_OWNER_REVIEW';
      } else {
        result.BLOCKER_CODE = normalizeD7E4BErrorCode_(error && (error.code || error.message));
        result.FINAL_STATUS = result.BLOCKER_CODE || 'BLOCKED_D7_E4B_PRECONDITION_CHANGED';
      }
      if (!unknown && activeLease && leaseStore && stage !== 'LEASE_FINALIZE') {
        await finalizeD7E4BLeaseAfterKnownFailure_(leaseStore, activeLease, result, services.clock, error);
      }
      finalizeD7E4BResult_(result);
      logD7E4BSanitizedResult_(services.logger, result);
      return result;
    } finally {
      if (lockAcquired && lock && typeof lock.releaseLock === 'function') lock.releaseLock();
    }
  }

  return Object.freeze({ run: run });
}

function readD7E4BScriptPropertiesReadOnly_() {
  const properties = PropertiesService.getScriptProperties();
  return properties && typeof properties.getProperties === 'function' ? properties.getProperties() : {};
}

function validateD7E4BAuthorization_(raw) {
  const values = raw || {};
  const canonical = {
    candidateFingerprint: normalizeD7E4BSha256_(values.D7_E_CANONICAL_CANDIDATE_FINGERPRINT),
    xmlSha256: normalizeD7E4BSha256_(values.D7_E_CANONICAL_XML_SHA256),
    pdfSha256: normalizeD7E4BSha256_(values.D7_E_CANONICAL_PDF_SHA256),
    invoiceIdentityHash: normalizeD7E4BSha256_(values.D7_E_CANONICAL_INVOICE_IDENTITY_HASH),
    attachmentSetHash: normalizeD7E4BSha256_(values.D7_E_CANONICAL_ATTACHMENT_SET_HASH)
  };
  const canonicalCount = Object.keys(canonical).filter(function presentD7E4B_(key) { return Boolean(canonical[key]); }).length;
  const ownerMarkerValid = normalizeD7E4BString_(values[D7_E4B_OWNER_MARKER_PROPERTY_]) === D7_E4B_OWNER_MARKER_VALUE_;
  const priorMarkerAbsent = !normalizeD7E4BString_(values.D7_E4A1_OWNER_APPROVAL_MARKER);
  const identityAligned = canonical.candidateFingerprint && canonical.candidateFingerprint === canonical.invoiceIdentityHash;
  return {
    ownerMarkerValid: ownerMarkerValid,
    ready: ownerMarkerValid && canonicalCount === 5 && identityAligned && priorMarkerAbsent,
    canonicalCount: canonicalCount,
    priorMarkerAbsent: priorMarkerAbsent,
    identityAligned: Boolean(identityAligned),
    canonical: canonical,
    rawProperties: values
  };
}

function buildD7E4BExpectedIdentity_(authorization) {
  const canonical = authorization.canonical;
  const jobId = 'd7e_job_' + canonical.candidateFingerprint.slice(0, 24);
  return Object.freeze({
    jobId: jobId,
    invoiceIdentityHash: durableIdentityHashPrefixD7E_(canonical.invoiceIdentityHash),
    xmlSha256: canonical.xmlSha256,
    pdfSha256: canonical.pdfSha256,
    leaseFence: 'd7e_lease_' + jobId,
    xmlAttachmentId: 'd7e_att_' + hashPrefixD7E4B_(['XML', jobId, canonical.xmlSha256].join('|'), 24),
    pdfAttachmentId: 'd7e_att_' + hashPrefixD7E4B_(['PDF', jobId, canonical.pdfSha256].join('|'), 24)
  });
}

function buildD7E4BReconciliationPlan_(expected, snapshot, now) {
  const reportId = 'd7e4b_owner_adoption_' + hashPrefixD7E4B_([expected.jobId, D7_E4B_OWNER_DISPOSITION_, 'EXPECTED_VERSION_4', 'SEVEN_FIRESTORE_WRITES'].join('|'), 24);
  const invoiceKey = snapshot && snapshot.job && snapshot.job.commitPlan && snapshot.job.commitPlan.invoiceKeyV2 || '';
  return Object.freeze({
    reportId: reportId,
    auditEventId: 'evt_000003',
    transitionToFailedReviewKey: 'd7e4b_failed_review_' + reportId,
    transitionToReconciliationKey: 'd7e4b_reconciliation_required_' + reportId,
    report: {
      reportId: reportId,
      jobId: expected.jobId,
      invoiceKeyHashPrefix: hashPrefixD7E4B_(invoiceKey, 8),
      status: 'RECONCILIATION_REQUIRED',
      findingCount: 6,
      blockerCount: 1,
      findings: [
        {
          code: 'OWNER_ADOPTED_UNKNOWN_EXTERNAL_SHEET_STATE',
          severity: 'REVIEW_REQUIRED',
          scope: 'SHEET_ATTRIBUTION',
          repairPolicy: 'NO_EXTERNAL_REPAIR',
          safeMessage: 'Owner adopted the existing Sheet row as unknown external state.'
        },
        {
          code: 'SHEET_CREATOR_UNKNOWN',
          severity: 'REVIEW_REQUIRED',
          scope: 'SHEET_ATTRIBUTION',
          repairPolicy: 'DO_NOT_INFER_CREATOR',
          safeMessage: 'The Sheet row creator remains unknown.'
        },
        {
          code: 'HISTORICAL_D7E_ATTRIBUTION_UNPROVEN',
          severity: 'REVIEW_REQUIRED',
          scope: 'HISTORICAL_ATTRIBUTION',
          repairPolicy: 'DO_NOT_CLAIM_D7E_CREATION',
          safeMessage: 'Historical D7-E attribution remains unproven.'
        },
        {
          code: 'NO_DRIVE_OR_SHEET_REPAIR_PERFORMED',
          severity: 'INFORMATIONAL',
          scope: 'EXTERNAL_REPAIR',
          repairPolicy: 'NO_EXTERNAL_REPAIR',
          safeMessage: 'No Drive or Sheet repair was performed.'
        },
        {
          code: 'NO_ATTACHMENT_RECORDS_FABRICATED',
          severity: 'INFORMATIONAL',
          scope: 'ATTACHMENT_PROVENANCE',
          repairPolicy: 'CREATE_ZERO_ATTACHMENT_RECORDS',
          safeMessage: 'No attachment record was created or fabricated.'
        },
        {
          code: 'JOB_REMAINS_RECONCILIATION_REQUIRED_NOT_COMPLETED',
          severity: 'REVIEW_REQUIRED',
          scope: 'JOB_STATE',
          repairPolicy: 'DO_NOT_MARK_COMPLETED',
          safeMessage: 'The job remains reconciliation-required, not completed.'
        }
      ],
      generatedAt: now,
      inputSnapshotVersion: 'D7_E4A2_EXACT_ONE_JOB_VERSION_4',
      jobVersion: D7_E4B_EXPECTED_INITIAL_JOB_VERSION_
    },
    budget: D7_E4B_WRITE_BUDGET_
  });
}

function assertD7E4BInitialPreconditions_(authorization, snapshot, expected) {
  const s = snapshot || {};
  const job = s.job || {};
  const lease = s.lease || {};
  const commitPlan = job.commitPlan || {};
  const targets = commitPlan.driveEvidenceTargets || {};
  const valid = authorization.canonicalCount === 5 && authorization.identityAligned && authorization.priorMarkerAbsent &&
    Number(s.exactJobCount) === 1 && Number(s.nonExactCandidateCount) === 0 && s.readOutcomeUnknown === false &&
    job.jobId === expected.jobId && job.invoiceIdentityHash === expected.invoiceIdentityHash && /^[a-f0-9]{8}$/i.test(String(job.sourceThreadHash || '')) &&
    job.status === D7_E4B_EXPECTED_INITIAL_JOB_STATUS_ && Number(job.version) === D7_E4B_EXPECTED_INITIAL_JOB_VERSION_ &&
    job.reconciliationStatus === D7_E4B_EXPECTED_RECONCILIATION_STATUS_ && commitPlan.jobId === expected.jobId &&
    Number(commitPlan.expectedLineCount) === 1 && targets.xmlContentHash === expected.xmlSha256 && targets.pdfContentHash === expected.pdfSha256 &&
    lease.status === D7_E4B_EXPECTED_RECONCILIATION_STATUS_ && lease.jobId === expected.jobId && lease.fencingToken === expected.leaseFence &&
    Number.isInteger(Number(lease.leaseGeneration)) && Number(lease.leaseGeneration) > 0 &&
    s.eventsComplete === true && Array.isArray(s.events) && s.events.length === D7_E4B_EXPECTED_INITIAL_AUDIT_COUNT_ &&
    s.reportsComplete === true && Array.isArray(s.reports) && s.reports.length === D7_E4B_EXPECTED_INITIAL_REPORT_COUNT_ && s.latestReportValid === true &&
    s.xmlAttachmentPresent === false && s.pdfAttachmentPresent === false && s.sheetExactRowPresent === true && s.sheetContentMatches === true &&
    s.driveXmlMatches === true && s.drivePdfMatches === true;
  if (!valid) throw d7e4bError_('BLOCKED_D7_E4B_PRECONDITION_CHANGED');
}

function isD7E4BConfirmedSuccessfulReplay_(snapshot, plan) {
  const s = snapshot || {};
  const job = s.job || {};
  const lease = s.lease || {};
  const reports = Array.isArray(s.reports) ? s.reports : [];
  const events = Array.isArray(s.events) ? s.events : [];
  return Number(s.exactJobCount) === 1 && Number(s.nonExactCandidateCount) === 0 && s.readOutcomeUnknown === false &&
    job.status === 'RECONCILIATION_REQUIRED' && Number(job.version) === D7_E4B_EXPECTED_FINAL_JOB_VERSION_ && job.reconciliationStatus === 'RECONCILIATION_REQUIRED' &&
    lease.status === 'RECONCILIATION_REQUIRED' && s.reportsComplete === true && reports.length === D7_E4B_EXPECTED_FINAL_REPORT_COUNT_ &&
    reports.some(function reportMatchD7E4B_(item) { return item && item.reportId === plan.reportId; }) &&
    s.eventsComplete === true && events.length === D7_E4B_EXPECTED_FINAL_AUDIT_COUNT_ &&
    events.some(function eventMatchD7E4B_(item) { return item && item.eventId === plan.auditEventId && item.eventType === D7_E4B_AUDIT_EVENT_TYPE_; }) &&
    s.xmlAttachmentPresent === false && s.pdfAttachmentPresent === false && s.sheetExactRowPresent === true && s.sheetContentMatches === true &&
    s.driveXmlMatches === true && s.drivePdfMatches === true;
}

function assertD7E4BSuccessfulPostWriteSnapshot_(snapshot, plan) {
  if (!isD7E4BConfirmedSuccessfulReplay_(snapshot, plan)) throw d7e4bError_('BLOCKED_D7_E4B_POST_WRITE_VERIFICATION_MISMATCH');
}

function assertD7E4BPlannedBudget_(plan) {
  const b = plan && plan.budget || {};
  if (b.JOB_UPDATES !== 3 || b.LEASE_UPDATES !== 2 || b.RECONCILIATION_REPORT_CREATES !== 1 || b.AUDIT_EVENT_CREATES !== 1 ||
      b.ATTACHMENT_CREATES !== 0 || b.FIRESTORE_TOTAL !== 7 || b.GMAIL !== 0 || b.DRIVE !== 0 || b.SHEETS !== 0 ||
      b.SCRIPT_PROPERTIES !== 0 || b.TRIGGERS !== 0 || b.DESTRUCTIVE !== 0) {
    throw d7e4bError_('BLOCKED_D7_E4B_PLANNED_WRITE_BUDGET_INVALID');
  }
}

function assertD7E4BBudgetAvailable_(result, additions) {
  const next = additions || {};
  const job = Number(result.JOB_UPDATE_COUNT || 0) + Number(next.JOB_UPDATE_COUNT || 0);
  const lease = Number(result.LEASE_UPDATE_COUNT || 0) + Number(next.LEASE_UPDATE_COUNT || 0);
  const report = Number(result.REPORT_CREATE_COUNT || 0) + Number(next.REPORT_CREATE_COUNT || 0);
  const audit = Number(result.AUDIT_CREATE_COUNT || 0) + Number(next.AUDIT_CREATE_COUNT || 0);
  const attachment = Number(result.ATTACHMENT_CREATE_COUNT || 0) + Number(next.ATTACHMENT_CREATE_COUNT || 0);
  if (job > 3 || lease > 2 || report > 1 || audit > 1 || attachment > 0 || job + lease + report + audit + attachment > 7) {
    throw d7e4bError_('BLOCKED_D7_E4B_WRITE_BUDGET_EXCEEDED');
  }
}

async function finalizeD7E4BLeaseAfterKnownFailure_(leaseStore, activeLease, result, clock, error) {
  try {
    assertD7E4BBudgetAvailable_(result, { LEASE_UPDATE_COUNT: 1 });
    const lease = activeLease.lease || {};
    const outcome = await leaseStore.finalizeReconciliationLease({
      leaseId: lease.leaseId || lease.jobId,
      jobId: lease.jobId,
      fencingToken: lease.fencingToken,
      expectedGeneration: Number(lease.leaseGeneration),
      leaseOwner: 'apps_script_d7_e4b',
      releasedAt: clock.now(),
      errorCode: normalizeD7E4BErrorCode_(error && (error.code || error.message))
    });
    if (!outcome || outcome.status !== 'RECONCILIATION_REQUIRED' || Number(outcome.mutationCount) !== 1) {
      throw d7e4bError_('BLOCKED_D7_E4B_FAILURE_LEASE_FINALIZATION_NOT_CONFIRMED');
    }
    result.LEASE_UPDATE_COUNT += 1;
    result.FINAL_LEASE_STATUS = 'RECONCILIATION_REQUIRED';
  } catch (finalizeError) {
    if (isD7E4BUnknownWriteOutcome_(finalizeError, 'LEASE_FINALIZE')) {
      result.UNKNOWN_WRITE_OUTCOME = 'YES';
      result.BLOCKER_CODE = 'UNKNOWN_WRITE_OUTCOME_REQUIRES_OWNER_REVIEW';
      result.FINAL_STATUS = 'UNKNOWN_WRITE_OUTCOME_REQUIRES_OWNER_REVIEW';
    }
  }
}

function createD7E4BExactLeaseStore_(transport, options) {
  if (!transport || typeof transport.runTransaction !== 'function') throw d7e4bError_('BLOCKED_D7_E4B_LEASE_TRANSPORT_MISSING');
  const clock = options && options.clock || { now: function nowD7E4BLease_() { return new Date().toISOString(); } };

  function validateRequest(request) {
    const req = request || {};
    const leaseId = normalizeD7E4BString_(req.leaseId);
    const jobId = normalizeD7E4BString_(req.jobId);
    const fencingToken = normalizeD7E4BString_(req.fencingToken);
    const expectedGeneration = Number(req.expectedGeneration);
    if (!leaseId || leaseId !== jobId || !fencingToken || !Number.isInteger(expectedGeneration) || expectedGeneration <= 0) {
      throw d7e4bError_('BLOCKED_D7_E4B_LEASE_REQUEST_INVALID');
    }
    return {
      leaseId: leaseId,
      jobId: jobId,
      fencingToken: fencingToken,
      expectedGeneration: expectedGeneration,
      leaseOwner: normalizeD7E4BString_(req.leaseOwner || 'apps_script_d7_e4b'),
      acquiredAt: normalizeD7E4BString_(req.acquiredAt || clock.now()),
      expiresAt: normalizeD7E4BString_(req.expiresAt || addD7E4BMilliseconds_(clock.now(), D7_E4B_LEASE_DURATION_MS_)),
      releasedAt: normalizeD7E4BString_(req.releasedAt || clock.now()),
      errorCode: normalizeD7E4BErrorCode_(req.errorCode || 'D7_E4B_RECONCILIATION_REQUIRED')
    };
  }

  function assertIdentity(current, req) {
    if (!current || current.jobId !== req.jobId || current.fencingToken !== req.fencingToken || Number(current.leaseGeneration) !== req.expectedGeneration) {
      throw d7e4bError_('BLOCKED_D7_E4B_LEASE_FENCE_OR_GENERATION_MISMATCH');
    }
  }

  async function reacquireReconciliationLease(request) {
    const req = validateRequest(request);
    return transport.runTransaction(async function reacquireD7E4BTx_(tx) {
      const path = 'worker_leases/' + req.leaseId;
      const current = await tx.getDocument(path);
      assertIdentity(current, req);
      if (current.status !== 'RECONCILIATION_REQUIRED') throw d7e4bError_('BLOCKED_D7_E4B_LEASE_STATUS_CHANGED');
      const next = Object.assign({}, current, {
        status: 'ACTIVE', leaseOwner: req.leaseOwner, leaseGeneration: req.expectedGeneration + 1,
        acquiredAt: req.acquiredAt, expiresAt: req.expiresAt, releasedAt: '', finalJobStatus: '', updatedAt: req.acquiredAt
      });
      await tx.updateDocument(path, next);
      return { status: 'ACQUIRED_AFTER_RECONCILIATION_REQUIRED', mutationCount: 1, lease: cloneD7E4BJson_(next) };
    });
  }

  async function finalizeReconciliationLease(request) {
    const req = validateRequest(request);
    return transport.runTransaction(async function finalizeD7E4BTx_(tx) {
      const path = 'worker_leases/' + req.leaseId;
      const current = await tx.getDocument(path);
      assertIdentity(current, req);
      if (current.status !== 'ACTIVE' || current.leaseOwner !== req.leaseOwner) throw d7e4bError_('BLOCKED_D7_E4B_ACTIVE_LEASE_OWNERSHIP_CHANGED');
      const next = Object.assign({}, current, {
        status: 'RECONCILIATION_REQUIRED', releasedAt: req.releasedAt, finalJobStatus: 'RECONCILIATION_REQUIRED',
        reconciliationErrorCode: req.errorCode, updatedAt: req.releasedAt
      });
      await tx.updateDocument(path, next);
      return { status: 'RECONCILIATION_REQUIRED', mutationCount: 1, lease: cloneD7E4BJson_(next) };
    });
  }

  return Object.freeze({ reacquireReconciliationLease: reacquireReconciliationLease, finalizeReconciliationLease: finalizeReconciliationLease });
}

async function captureD7E4BProductionSnapshot_(context) {
  const expected = context.expected;
  const authorization = context.authorization;
  const reader = createD7E4BProductionFirestoreReader_();
  const directJob = reader.getDocument('invoiceJobs/' + expected.jobId);
  const jobCandidates = reader.queryDocuments({
    collectionId: 'invoiceJobs',
    filters: [{ fieldPath: 'jobId', value: expected.jobId }],
    limit: 2
  });
  const sourceThreadHash = directJob && String(directJob.sourceThreadHash || '');
  const exactCandidates = sourceThreadHash ? reader.queryDocuments({
    collectionId: 'invoiceJobs',
    filters: [
      { fieldPath: 'jobId', value: expected.jobId },
      { fieldPath: 'invoiceIdentityHash', value: expected.invoiceIdentityHash },
      { fieldPath: 'sourceThreadHash', value: sourceThreadHash },
      { fieldPath: 'commitPlan.jobId', value: expected.jobId },
      { fieldPath: 'commitPlan.driveEvidenceTargets.xmlContentHash', value: expected.xmlSha256 },
      { fieldPath: 'commitPlan.driveEvidenceTargets.pdfContentHash', value: expected.pdfSha256 }
    ],
    limit: 2
  }) : [];
  const nonExactCandidateCount = jobCandidates.filter(function nonExactD7E4B_(job) {
    return !isD7E4BExactJobIdentity_(job, expected, sourceThreadHash);
  }).length;
  const lease = reader.getDocument('worker_leases/' + expected.jobId);
  const eventsPage = reader.listDocuments('invoiceJobs/' + expected.jobId + '/events', 4);
  const reportsPage = reader.listDocuments('invoiceJobs/' + expected.jobId + '/reconciliationReports', 3);
  const xmlAttachment = reader.getDocument('attachments/' + expected.xmlAttachmentId);
  const pdfAttachment = reader.getDocument('attachments/' + expected.pdfAttachmentId);
  const sheet = await inspectD7E4BSheetReadOnly_(authorization.rawProperties, directJob);
  const drive = inspectD7E4BDriveReadOnly_(authorization.rawProperties, directJob);
  const reports = reportsPage.documents || [];
  const latestId = directJob && directJob.latestReconciliationReportId || '';
  const latestReport = reports.filter(function latestD7E4B_(report) { return report && report.reportId === latestId; })[0] || null;
  return {
    exactJobCount: exactCandidates.length,
    nonExactCandidateCount: nonExactCandidateCount,
    readOutcomeUnknown: false,
    job: directJob,
    lease: lease,
    events: eventsPage.documents || [],
    eventsComplete: eventsPage.complete,
    reports: reports,
    reportsComplete: reportsPage.complete,
    latestReportValid: Boolean(latestReport && latestReport.jobId === expected.jobId && latestReport.status === 'RECONCILIATION_REQUIRED'),
    xmlAttachmentPresent: Boolean(xmlAttachment),
    pdfAttachmentPresent: Boolean(pdfAttachment),
    sheetExactRowPresent: sheet.exactRowPresent,
    sheetContentMatches: sheet.contentMatches,
    driveXmlMatches: drive.xmlMatches,
    drivePdfMatches: drive.pdfMatches
  };
}

function createD7E4BProductionFirestoreReader_(dependencies) {
  const d = dependencies || {};
  const fetch = d.fetch || function fetchD7E4B_(url, params) { return UrlFetchApp.fetch(url, params); };
  const token = d.getOAuthToken || function tokenD7E4B_() { return ScriptApp.getOAuthToken(); };
  const queryReader = createD7E4A1ProductionFirestoreReadOnly_({ fetch: fetch, getOAuthToken: token });

  function request(path, list, pageSize) {
    const safePath = validateD7E4BFirestorePath_(path, list);
    const base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(D7_E4B_FIRESTORE_PROJECT_ID_) +
      '/databases/' + encodeURIComponent(D7_E4B_FIRESTORE_DATABASE_ID_) + '/documents/' + safePath.split('/').map(encodeURIComponent).join('/');
    const url = list ? base + '?pageSize=' + Number(pageSize) : base;
    const response = fetch(url, { method: 'get', headers: { Authorization: 'Bearer ' + token() }, muteHttpExceptions: true });
    const status = Number(response.getResponseCode());
    const body = String(response.getContentText() || '');
    if (!list && status === 404) return null;
    if (status !== 200) throw d7e4bError_('BLOCKED_D7_E4B_FIRESTORE_READ_FAILED');
    return body ? JSON.parse(body) : {};
  }

  function getDocument(path) {
    const doc = request(path, false, 0);
    return doc ? decodeD7E4BFirestoreDocument_(doc) : null;
  }

  function listDocuments(path, pageSize) {
    const body = request(path, true, pageSize);
    const documents = (body.documents || []).map(decodeD7E4BFirestoreDocument_);
    return { documents: documents, complete: !body.nextPageToken && documents.length < Number(pageSize) };
  }

  return Object.freeze({ getDocument: getDocument, listDocuments: listDocuments, queryDocuments: queryReader.queryDocuments });
}

function validateD7E4BFirestorePath_(path, collection) {
  const value = normalizeD7E4BString_(path);
  if (!/^[A-Za-z0-9_-]+\/[A-Za-z0-9._:-]+(?:\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9._:-]+)?)?$/.test(value)) {
    throw d7e4bError_('BLOCKED_D7_E4B_FIRESTORE_PATH_INVALID');
  }
  const parts = value.split('/');
  if (collection ? parts.length % 2 !== 1 : parts.length % 2 !== 0) throw d7e4bError_('BLOCKED_D7_E4B_FIRESTORE_PATH_INVALID');
  if (['invoiceJobs', 'worker_leases', 'attachments'].indexOf(parts[0]) < 0) throw d7e4bError_('BLOCKED_D7_E4B_FIRESTORE_PATH_INVALID');
  return value;
}

function decodeD7E4BFirestoreDocument_(document) {
  const codec = createFirestoreValueCodec_();
  const decoded = codec.decodeDocument(document || {});
  const name = String(document && document.name || '');
  if (name) decoded.__documentId = name.split('/').pop();
  return decoded;
}

async function inspectD7E4BSheetReadOnly_(properties, job) {
  const commitPlan = job && job.commitPlan || {};
  const line = commitPlan.lines && commitPlan.lines[0] || {};
  const immutable = line.immutableFields || {};
  const expectedRow = {
    invoiceKeyV2: commitPlan.invoiceKeyV2,
    legacyInvoiceKey: commitPlan.legacyInvoiceKey,
    legacyHashIndex: line.legacyHashIndex || commitPlan.legacyHashIndexes && commitPlan.legacyHashIndexes[0],
    lineIdentityV2: line.lineIdentityV2 || commitPlan.lineIdentityV2s && commitPlan.lineIdentityV2s[0],
    transactionIdentity: line.lineIdentityV2 || commitPlan.lineIdentityV2s && commitPlan.lineIdentityV2s[0],
    direction: immutable.direction,
    itemCode: immutable.itemCode,
    quantity: Number(immutable.quantity),
    unitPrice: Number(immutable.unitPrice),
    amount: Number(immutable.quantity) * Number(immutable.unitPrice)
  };
  if (!expectedRow.invoiceKeyV2 || !expectedRow.legacyHashIndex || !expectedRow.itemCode) return { exactRowPresent: false, contentMatches: false };
  const config = {
    spreadsheetId: properties.D7_B_SPREADSHEET_ID || properties.D7_SPREADSHEET_ID || properties.D6J_SPREADSHEET_ID,
    sheetName: properties.D7_B_TARGET_SHEET_NAME || properties.D7_TARGET_SHEET_NAME || properties.D6J_SHEET_NAME || 'Nhap-Xuat'
  };
  const adapters = createD7EDefaultSheetsAdapters_({ properties: properties, precheck: { config: config }, plan: { ledgerRows: [expectedRow] } });
  const found = await adapters.read.findTransactionByIdentity({
    transactionIdentity: expectedRow.transactionIdentity,
    hashIndex: expectedRow.legacyHashIndex,
    invoiceKeyV2: expectedRow.invoiceKeyV2,
    legacyInvoiceKey: expectedRow.legacyInvoiceKey
  });
  const rows = found && found.rows || [];
  return {
    exactRowPresent: found && found.status === 'ALREADY_PRESENT' && rows.length === 1,
    contentMatches: rows.length === 1 && doesD7E4BSheetRowMatchCommitPlan_(rows[0], expectedRow)
  };
}

function doesD7E4BSheetRowMatchCommitPlan_(actual, expected) {
  return normalizeD7E4BString_(actual && actual.invoiceKeyV2) === normalizeD7E4BString_(expected.invoiceKeyV2) &&
    normalizeD7E4BString_(actual && actual.legacyHashIndex) === normalizeD7E4BString_(expected.legacyHashIndex) &&
    normalizeD7E4BString_(actual && actual.direction).toUpperCase() === normalizeD7E4BString_(expected.direction).toUpperCase() &&
    normalizeD7E4BString_(actual && actual.itemCode) === normalizeD7E4BString_(expected.itemCode) &&
    numbersEqualD7E_(actual && actual.quantity, expected.quantity) && numbersEqualD7E_(actual && actual.unitPrice, expected.unitPrice) &&
    numbersEqualD7E_(actual && actual.amount, expected.amount);
}

function inspectD7E4BDriveReadOnly_(properties, job) {
  const commitPlan = job && job.commitPlan || {};
  const targets = commitPlan.driveEvidenceTargets || {};
  const folderId = properties.D7_B_DRIVE_ROOT_FOLDER_ID || properties.D7_DRIVE_ROOT_FOLDER_ID || properties.D6J_DRIVE_ROOT_FOLDER_ID;
  if (!folderId || !targets.xmlContentHash || !targets.pdfContentHash) return { xmlMatches: false, pdfMatches: false };
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  let scanned = 0;
  let complete = true;
  let xmlMatches = 0;
  let pdfMatches = 0;
  while (files.hasNext()) {
    scanned += 1;
    if (scanned > D7_E4B_DRIVE_SCAN_LIMIT_) { complete = false; break; }
    const file = files.next();
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    const hash = sha256D7E4BBytes_(bytes);
    const mime = normalizeD7E4BString_(file.getMimeType ? file.getMimeType() : blob.getContentType()).toLowerCase();
    if (hash === targets.xmlContentHash && (mime === 'application/xml' || mime === 'text/xml')) xmlMatches += 1;
    if (hash === targets.pdfContentHash && mime === 'application/pdf') pdfMatches += 1;
  }
  return { xmlMatches: complete && xmlMatches === 1, pdfMatches: complete && pdfMatches === 1 };
}

function isD7E4BExactJobIdentity_(job, expected, sourceThreadHash) {
  const commitPlan = job && job.commitPlan || {};
  const targets = commitPlan.driveEvidenceTargets || {};
  return Boolean(job) && job.jobId === expected.jobId && job.invoiceIdentityHash === expected.invoiceIdentityHash && job.sourceThreadHash === sourceThreadHash &&
    commitPlan.jobId === expected.jobId && Number(commitPlan.expectedLineCount) === 1 && targets.xmlContentHash === expected.xmlSha256 && targets.pdfContentHash === expected.pdfSha256;
}

function copyD7E4BInitialState_(result, snapshot) {
  const job = snapshot && snapshot.job || {};
  const lease = snapshot && snapshot.lease || {};
  result.INITIAL_JOB_STATUS = normalizeD7E4BString_(job.status) || 'UNAVAILABLE';
  result.INITIAL_JOB_VERSION = Number(job.version || 0);
  result.INITIAL_RECONCILIATION_STATUS = normalizeD7E4BString_(job.reconciliationStatus) || 'UNAVAILABLE';
  result.INITIAL_LEASE_STATUS = normalizeD7E4BString_(lease.status) || 'UNAVAILABLE';
  result.EXACT_CARDINALITY_STATUS = snapshot && Number(snapshot.exactJobCount) === 1 && Number(snapshot.nonExactCandidateCount) === 0 && snapshot.readOutcomeUnknown === false ? 'EXACT_ONE_MATCH' : 'NOT_PROVEN';
}

function assertD7E4BJobVersionAndState_(job, version, status) {
  if (!job || Number(job.version) !== Number(version) || job.status !== status) throw d7e4bError_('BLOCKED_D7_E4B_OPTIMISTIC_CONCURRENCY_MISMATCH');
}

function isD7E4BUnknownWriteOutcome_(error, stage) {
  if (!error || ['OWNER_AUTHORIZATION', 'FRESH_PRE_MUTATION_READ', 'POST_WRITE_READ_ONLY_VERIFICATION'].indexOf(stage) >= 0) return false;
  if (error.writeOutcome === 'KNOWN_NOT_COMMITTED' || error.knownFailure === true) return false;
  if (error.writeOutcome === 'UNKNOWN') return true;
  const code = normalizeD7E4BErrorCode_(error.code || error.message);
  if (code === 'FIRESTORE_WRITE_UNCONFIRMED' || code === 'FIRESTORE_TRANSPORT_ERROR' || code === 'FIRESTORE_HTTP_REQUEST_FAILED') return true;
  if (stage === 'RECONCILIATION_REPORT_TRANSACTION' && code === 'FIRESTORE_CONCURRENT_MODIFICATION') return true;
  if (/^BLOCKED_D7_E4B_/.test(code) || ['DURABLE_JOB_VERSION_CONFLICT', 'DURABLE_JOB_ILLEGAL_TRANSITION', 'AUDIT_EVENT_SEQUENCE_CONFLICT', 'FIRESTORE_CONCURRENT_MODIFICATION'].indexOf(code) >= 0) return false;
  return true;
}

function createD7E4BBaseResult_() {
  return {
    PHASE: D7_E4B_PHASE_,
    SCHEMA_VERSION: D7_E4B_SCHEMA_VERSION_,
    PUBLIC_ENTRYPOINT: D7_E4B_PUBLIC_ENTRYPOINT_,
    OWNER_APPROVAL_MARKER_VALID: 'NO',
    PRECONDITION_STATUS: 'NOT_RUN',
    INITIAL_JOB_STATUS: 'NOT_READ',
    INITIAL_JOB_VERSION: 0,
    INITIAL_RECONCILIATION_STATUS: 'NOT_READ',
    INITIAL_LEASE_STATUS: 'NOT_READ',
    EXACT_CARDINALITY_STATUS: 'NOT_RUN',
    REPORT_CREATE_COUNT: 0,
    AUDIT_CREATE_COUNT: 0,
    ATTACHMENT_CREATE_COUNT: 0,
    JOB_UPDATE_COUNT: 0,
    LEASE_UPDATE_COUNT: 0,
    FIRESTORE_TOTAL_WRITE_COUNT: 0,
    FINAL_JOB_STATUS: 'NOT_VERIFIED',
    FINAL_JOB_VERSION: 0,
    FINAL_RECONCILIATION_STATUS: 'NOT_VERIFIED',
    FINAL_LEASE_STATUS: 'NOT_VERIFIED',
    POST_WRITE_VERIFICATION_STATUS: 'NOT_RUN',
    UNKNOWN_WRITE_OUTCOME: 'NO',
    GMAIL_MUTATION_COUNT: 0,
    DRIVE_MUTATION_COUNT: 0,
    SHEETS_MUTATION_COUNT: 0,
    SCRIPT_PROPERTY_MUTATION_COUNT: 0,
    TRIGGER_MUTATION_COUNT: 0,
    DESTRUCTIVE_OPERATION_COUNT: 0,
    RAW_SENSITIVE_VALUE_LOGGED_COUNT: 0,
    FINAL_STATUS: 'BLOCKED_D7_E4B_NOT_RUN',
    BLOCKER_CODE: 'NONE'
  };
}

function finalizeD7E4BResult_(result) {
  result.FIRESTORE_TOTAL_WRITE_COUNT = Number(result.REPORT_CREATE_COUNT || 0) + Number(result.AUDIT_CREATE_COUNT || 0) +
    Number(result.ATTACHMENT_CREATE_COUNT || 0) + Number(result.JOB_UPDATE_COUNT || 0) + Number(result.LEASE_UPDATE_COUNT || 0);
  if (result.FIRESTORE_TOTAL_WRITE_COUNT > D7_E4B_WRITE_BUDGET_.FIRESTORE_TOTAL) {
    result.FINAL_STATUS = 'BLOCKED_D7_E4B_WRITE_BUDGET_EXCEEDED';
    result.BLOCKER_CODE = 'BLOCKED_D7_E4B_WRITE_BUDGET_EXCEEDED';
  }
  return result;
}

function assertD7E4BExactSuccessCounters_(result) {
  if (result.REPORT_CREATE_COUNT !== 1 || result.AUDIT_CREATE_COUNT !== 1 || result.ATTACHMENT_CREATE_COUNT !== 0 ||
      result.JOB_UPDATE_COUNT !== 3 || result.LEASE_UPDATE_COUNT !== 2 || result.FIRESTORE_TOTAL_WRITE_COUNT !== 7 ||
      result.GMAIL_MUTATION_COUNT !== 0 || result.DRIVE_MUTATION_COUNT !== 0 || result.SHEETS_MUTATION_COUNT !== 0 ||
      result.SCRIPT_PROPERTY_MUTATION_COUNT !== 0 || result.TRIGGER_MUTATION_COUNT !== 0 || result.DESTRUCTIVE_OPERATION_COUNT !== 0) {
    throw d7e4bError_('BLOCKED_D7_E4B_SUCCESS_COUNTER_MISMATCH');
  }
}

function logD7E4BSanitizedResult_(logger, result) {
  if (logger && typeof logger.log === 'function') logger.log(JSON.stringify(sanitizeD7E4BObject_(result)));
}

function sanitizeD7E4BObject_(value) {
  if (Array.isArray(value)) return value.map(sanitizeD7E4BObject_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(function sanitizeKeyD7E4B_(key) { out[key] = sanitizeD7E4BObject_(value[key]); });
    return out;
  }
  if (typeof value !== 'string') return value;
  if (/\b[a-f0-9]{32,}\b/i.test(value) || /@/.test(value) || /Bearer\s|oauth|token|private[_ -]?key/i.test(value)) return 'REDACTED';
  return value.length > 160 ? value.slice(0, 160) : value;
}

function sha256D7E4BBytes_(bytes) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes || []);
  return digest.map(function hexD7E4B_(byte) { const value = byte < 0 ? byte + 256 : byte; return ('0' + value.toString(16)).slice(-2); }).join('');
}

function hashPrefixD7E4B_(value, length) {
  if (typeof hashPrefixD7E_ === 'function') return hashPrefixD7E_(value, length);
  return String(value || '').slice(0, length || 16);
}

function normalizeD7E4BSha256_(value) {
  const text = normalizeD7E4BString_(value).toLowerCase();
  return /^[a-f0-9]{64}$/.test(text) ? text : '';
}

function normalizeD7E4BString_(value) {
  return value == null ? '' : String(value).replace(/\s+/g, ' ').trim();
}

function normalizeD7E4BErrorCode_(value) {
  const text = normalizeD7E4BString_(value).split(':')[0].split(';')[0].toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  return text.slice(0, 100) || 'BLOCKED_D7_E4B_UNKNOWN';
}

function addD7E4BMilliseconds_(value, milliseconds) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw d7e4bError_('BLOCKED_D7_E4B_CLOCK_INVALID');
  return new Date(date.getTime() + Number(milliseconds || 0)).toISOString();
}

function cloneD7E4BJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function d7e4bError_(code) {
  const error = new Error(normalizeD7E4BErrorCode_(code));
  error.code = normalizeD7E4BErrorCode_(code);
  return error;
}
