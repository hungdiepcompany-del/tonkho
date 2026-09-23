const D7_E4E_PHASE_ = 'D7_E4E_LOCAL_SAME_JOB_RECOVERY_RUNTIME';
const D7_E4E_SCHEMA_VERSION_ = 'D7_E4E_VALIDATED_JOB_RECOVERY_RUNTIME_V1';
const D7_E4E_PUBLIC_ENTRYPOINT_ = 'runD7E4EValidatedJobRecovery';
const D7_E4E_OWNER_MARKER_PROPERTY_ = 'D7_E4E_OWNER_APPROVAL_MARKER';
const D7_E4E_OWNER_MARKER_VALUE_ = 'OWNER_APPROVED_D7_E4E_EXACT_SAME_JOB_RECOVERY_ONCE_V1';

const D7_E4E_STATE_PATH_ = Object.freeze([
  'VALIDATED',
  'FILES_SAVED',
  'COMMITTING',
  'ROWS_COMMITTED',
  'INVENTORY_PENDING',
  'PROJECTIONS_COMMITTED',
  'COMPLETED'
]);

const D7_E4E_CAPABILITIES_ = Object.freeze({
  sameJobValidatedResumeSupported: true,
  currentIdentityContractSupported: true,
  hoaDonAdapterAvailable: true,
  inventoryAdapterAvailable: true,
  gmailProjectionAdapterAvailable: true,
  exactWriteBudgetDesigned: true,
  oneShotMarkerLifecycleDesigned: true
});

const D7_E4E_WRITE_BUDGET_ = Object.freeze({
  FIRESTORE_JOB_CREATES: 0,
  FIRESTORE_JOB_TRANSITIONS: 6,
  FIRESTORE_LEASE_UPDATES: 2,
  FIRESTORE_AUDIT_EVENT_CREATES: 1,
  FIRESTORE_ATTACHMENT_CREATES: 0,
  FIRESTORE_RECONCILIATION_REPORT_CREATES: 0,
  FIRESTORE_TOTAL: 9,
  DRIVE_FILE_CREATES: 2,
  HOA_DON_ROW_MUTATIONS: 1,
  LEDGER_ROW_APPENDS: 1,
  INVENTORY_REBUILDS: 1,
  GMAIL_LABEL_MUTATIONS: 1,
  SCRIPT_PROPERTY_MUTATIONS: 1,
  TRIGGER_MUTATIONS: 0,
  DESTRUCTIVE_OPERATIONS: 0
});

async function runD7E4EValidatedJobRecovery() {
  const runner = createD7E4EValidatedJobRecoveryRunner_(createD7E4EDefaultDependencies_());
  return runner.run();
}

function createD7E4EValidatedJobRecoveryRunner_(dependencies) {
  const d = dependencies || {};
  const services = {
    readAuthorization: d.readAuthorization,
    inspectRecoveryContext: d.inspectRecoveryContext,
    markerLifecycle: d.markerLifecycle,
    createJobStore: d.createJobStore,
    createLeaseStore: d.createLeaseStore,
    createAdapters: d.createAdapters,
    createLock: d.createLock,
    clock: d.clock || { now: function nowD7E4E_() { return new Date().toISOString(); } },
    logger: d.logger || { log: function noopD7E4E_() {} }
  };
  assertD7E4EDependencies_(services);

  async function run() {
    const result = createD7E4EResult_();
    let lock = null;
    let lockAcquired = false;
    let leaseStore = null;
    let activeLease = null;
    let leaseFinalized = false;
    let stage = 'OWNER_AUTHORIZATION';
    try {
      const authorization = validateD7E4EAuthorization_(await services.readAuthorization());
      result.OWNER_MARKER_STATUS = 'PASS';

      lock = services.createLock();
      if (!lock || typeof lock.tryLock !== 'function' || !lock.tryLock(30000)) {
        throw d7e4eError_('BLOCKED_D7_E4E_SCRIPT_LOCK_NOT_ACQUIRED');
      }
      lockAcquired = true;

      stage = 'FRESH_PRE_MUTATION_INSPECTION';
      const context = await services.inspectRecoveryContext(authorization);
      assertD7E4ERecoveryContext_(context);
      assertD7E4EPlannedBudget_(context.plannedBudget || D7_E4E_WRITE_BUDGET_);
      result.PREFLIGHT_STATUS = 'PASS_27_OF_27_AND_7_OF_7';
      result.JOB_ID_HASH_PREFIX = hashPrefixD7E4E_(context.plan.jobId, 16);

      stage = 'ONE_SHOT_MARKER_CLAIM';
      const claim = await invokeD7E4EMutation_(function claimD7E4E_() {
        return services.markerLifecycle.claim({
          propertyName: D7_E4E_OWNER_MARKER_PROPERTY_,
          expectedValue: D7_E4E_OWNER_MARKER_VALUE_,
          authorization: authorization
        });
      });
      if (!claim || claim.status !== 'CLAIMED' || !isD7E4EExactMutationCount_(claim.mutationCount, 1)) {
        throw d7e4eError_('BLOCKED_D7_E4E_MARKER_CLAIM_NOT_CONFIRMED');
      }
      result.MARKER_CLAIM_STATUS = 'CLAIMED_AND_CONSUMED';
      result.COUNTERS.SCRIPT_PROPERTY_MUTATIONS = 1;

      stage = 'POST_MARKER_SETUP';
      const jobStore = services.createJobStore(context);
      leaseStore = services.createLeaseStore(context);
      stage = 'LEASE_REACQUIRE';
      activeLease = await invokeD7E4EMutation_(function reacquireD7E4ELease_() {
        return leaseStore.reacquireReconciliationLease({
          jobId: context.plan.jobId,
          expectedFence: context.snapshot.lease.fencingToken,
          expectedGeneration: context.snapshot.lease.leaseGeneration,
          leaseOwner: 'apps_script_d7_e4e',
          acquiredAt: services.clock.now()
        });
      });
      if (!activeLease || activeLease.status !== 'ACTIVE' || !isD7E4EExactMutationCount_(activeLease.mutationCount, 1)) {
        throw d7e4eError_('BLOCKED_D7_E4E_LEASE_REACQUIRE_NOT_CONFIRMED');
      }
      result.COUNTERS.FIRESTORE_LEASE_UPDATES = 1;

      lock.releaseLock();
      lockAcquired = false;

      stage = 'POST_LEASE_READ';
      let job = await jobStore.getJob(context.plan.jobId);
      assertD7E4EJob_(job, context.snapshot.job.version, 'VALIDATED', context.plan.jobId);
      const adapters = services.createAdapters(context);
      assertD7E4EAdapters_(adapters);

      stage = 'DRIVE_ARTIFACTS';
      const artifacts = await invokeD7E4EMutation_(function persistD7E4EArtifacts_() { return adapters.artifacts.persistAndVerify(context.plan); });
      assertD7E4EConfirmedAdapterResponse_(artifacts, 'DRIVE_ARTIFACTS');
      addD7E4EExternalCount_(result, 'DRIVE_FILE_CREATES', artifacts && artifacts.mutationCount, D7_E4E_WRITE_BUDGET_.DRIVE_FILE_CREATES);
      job = await transitionD7E4E_(jobStore, result, job, 'VALIDATED', 'FILES_SAVED', 'files-saved', {
        reconciliationStatus: 'RECOVERY_IN_PROGRESS',
        recoveryPhase: D7_E4E_PHASE_
      });

      stage = 'COMMITTING_TRANSITION';
      job = await transitionD7E4E_(jobStore, result, job, 'FILES_SAVED', 'COMMITTING', 'committing', {});

      stage = 'HOA_DON';
      const hoaDon = await invokeD7E4EMutation_(function upsertD7E4EHoaDon_() { return adapters.hoaDon.upsertAndVerify(context.plan, artifacts); });
      assertD7E4EConfirmedAdapterResponse_(hoaDon, 'HOA_DON');
      addD7E4EExternalCount_(result, 'HOA_DON_ROW_MUTATIONS', hoaDon && hoaDon.mutationCount, D7_E4E_WRITE_BUDGET_.HOA_DON_ROW_MUTATIONS);

      stage = 'LEDGER';
      const ledger = await invokeD7E4EMutation_(function appendD7E4ELedger_() { return adapters.ledger.appendAndVerify(context.plan); });
      assertD7E4EConfirmedAdapterResponse_(ledger, 'LEDGER');
      addD7E4EExternalCount_(result, 'LEDGER_ROW_APPENDS', ledger && ledger.mutationCount, D7_E4E_WRITE_BUDGET_.LEDGER_ROW_APPENDS);
      job = await transitionD7E4E_(jobStore, result, job, 'COMMITTING', 'ROWS_COMMITTED', 'rows-committed', {});

      stage = 'INVENTORY_PENDING_TRANSITION';
      job = await transitionD7E4E_(jobStore, result, job, 'ROWS_COMMITTED', 'INVENTORY_PENDING', 'inventory-pending', {});

      stage = 'INVENTORY';
      const inventory = await invokeD7E4EMutation_(function rebuildD7E4EInventory_() { return adapters.inventory.rebuildAndVerify(context.plan); });
      assertD7E4EConfirmedAdapterResponse_(inventory, 'INVENTORY');
      addD7E4EExternalCount_(result, 'INVENTORY_REBUILDS', inventory && inventory.mutationCount, D7_E4E_WRITE_BUDGET_.INVENTORY_REBUILDS);

      stage = 'GMAIL_PROJECTION';
      const gmail = await invokeD7E4EMutation_(function applyD7E4EGmailProjection_() { return adapters.gmail.applyAndVerify(context.plan); });
      assertD7E4EConfirmedAdapterResponse_(gmail, 'GMAIL_PROJECTION');
      addD7E4EExternalCount_(result, 'GMAIL_LABEL_MUTATIONS', gmail && gmail.mutationCount, D7_E4E_WRITE_BUDGET_.GMAIL_LABEL_MUTATIONS);
      job = await transitionD7E4E_(jobStore, result, job, 'INVENTORY_PENDING', 'PROJECTIONS_COMMITTED', 'projections-committed', {});

      stage = 'FINAL_READ_ONLY_VERIFICATION';
      const finalVerification = await adapters.verifyAll(context.plan, { artifacts: artifacts, hoaDon: hoaDon, ledger: ledger, inventory: inventory, gmail: gmail });
      if (!finalVerification || finalVerification.status !== 'PASS') {
        throw d7e4eError_('BLOCKED_D7_E4E_FINAL_VERIFICATION_FAILED');
      }

      stage = 'COMPLETION_TRANSITION';
      job = await transitionD7E4E_(jobStore, result, job, 'PROJECTIONS_COMMITTED', 'COMPLETED', 'completed', {
        reconciliationStatus: 'CONSISTENT',
        recoveryCompletedBy: D7_E4E_PHASE_
      });

      stage = 'COMPLETION_AUDIT';
      const audit = await invokeD7E4EMutation_(function appendD7E4EAudit_() {
        return jobStore.appendAuditEvent({
          jobId: context.plan.jobId,
          sequence: Number(context.snapshot.events.length) + 1,
          eventType: 'D7_E4E_SAME_JOB_RECOVERY_COMPLETED',
          actorType: 'APPS_SCRIPT_D7_E4E',
          occurredAt: services.clock.now(),
          safeDetails: { statePath: D7_E4E_STATE_PATH_.join('>'), writeBudget: 'D7_E4E_EXACT_V1' }
        });
      });
      if (!audit || audit.resultCode !== 'AUDIT_EVENT_APPENDED') {
        const error = d7e4eError_('BLOCKED_D7_E4E_AUDIT_NOT_CONFIRMED');
        error.writeOutcome = 'UNKNOWN';
        throw error;
      }
      result.COUNTERS.FIRESTORE_AUDIT_EVENT_CREATES = 1;

      stage = 'LEASE_FINALIZE';
      const finalized = await invokeD7E4EMutation_(function finalizeD7E4ECompletedLease_() {
        return leaseStore.finalizeReconciliationLease({
          jobId: context.plan.jobId,
          expectedFence: activeLease.lease && activeLease.lease.fencingToken || context.snapshot.lease.fencingToken,
          expectedGeneration: activeLease.lease && activeLease.lease.leaseGeneration || activeLease.leaseGeneration,
          leaseOwner: 'apps_script_d7_e4e',
          status: 'COMPLETED',
          releasedAt: services.clock.now(),
          errorCode: ''
        });
      });
      if (!finalized || finalized.status !== 'COMPLETED' || !isD7E4EExactMutationCount_(finalized.mutationCount, 1)) {
        throw d7e4eError_('BLOCKED_D7_E4E_LEASE_FINALIZATION_NOT_CONFIRMED');
      }
      leaseFinalized = true;
      result.COUNTERS.FIRESTORE_LEASE_UPDATES += 1;

      finalizeD7E4ECounters_(result);
      assertD7E4EObservedBudget_(result.COUNTERS);
      result.STATE_PATH_STATUS = 'PASS_EXACT_PATH';
      result.FINAL_JOB_STATUS = job.status;
      result.FINAL_STATUS = 'PASS_D7_E4E_SAME_JOB_RECOVERY_COMPLETED';
      services.logger.log(JSON.stringify(sanitizeD7E4EResult_(result)));
      return sanitizeD7E4EResult_(result);
    } catch (error) {
      if (lockAcquired && lock && typeof lock.releaseLock === 'function') {
        lock.releaseLock();
        lockAcquired = false;
      }
      let unknown = isD7E4EUnknownWriteOutcome_(error, stage);
      if (activeLease && leaseStore && !leaseFinalized && !unknown) {
        try {
          const closed = await invokeD7E4EMutation_(function finalizeD7E4EFailedLease_() {
            return leaseStore.finalizeReconciliationLease({
              jobId: activeLease.lease && activeLease.lease.jobId,
              expectedFence: activeLease.lease && activeLease.lease.fencingToken,
              expectedGeneration: activeLease.lease && activeLease.lease.leaseGeneration,
              leaseOwner: 'apps_script_d7_e4e',
              status: 'RECONCILIATION_REQUIRED',
              releasedAt: services.clock.now(),
              errorCode: d7e4eErrorCode_(error)
            });
          });
          if (!closed || closed.status !== 'RECONCILIATION_REQUIRED' || !isD7E4EExactMutationCount_(closed.mutationCount, 1)) {
            const closeError = d7e4eError_('BLOCKED_D7_E4E_LEASE_FAILURE_FINALIZATION_NOT_CONFIRMED');
            closeError.writeOutcome = 'UNKNOWN';
            throw closeError;
          }
          result.COUNTERS.FIRESTORE_LEASE_UPDATES += 1;
        } catch (leaseError) {
          result.LEASE_CLOSE_STATUS = 'NOT_CONFIRMED';
          if (isD7E4EUnknownWriteOutcome_(leaseError, 'LEASE_FAILURE_FINALIZE')) unknown = true;
        }
      }
      finalizeD7E4ECounters_(result);
      result.BLOCKER_CODE = d7e4eErrorCode_(error);
      result.FINAL_STATUS = unknown ? 'PENDING_LATE_COMPLETION_QUARANTINE' : result.BLOCKER_CODE;
      services.logger.log(JSON.stringify(sanitizeD7E4EResult_(result)));
      return sanitizeD7E4EResult_(result);
    } finally {
      if (lockAcquired && lock && typeof lock.releaseLock === 'function') lock.releaseLock();
    }
  }

  return Object.freeze({ run: run });
}

function createD7E4EDefaultDependencies_() {
  return {
    readAuthorization: readD7E4EAuthorization_,
    inspectRecoveryContext: inspectD7E4EProductionContext_,
    markerLifecycle: createD7E4EPropertyMarkerLifecycle_(),
    createJobStore: function createD7E4EJobStore_() { return createD7EDefaultDurableJobStore_(); },
    createLeaseStore: function createD7E4ELeaseStore_() {
      return createD7E4EExactLeaseStore_(createD6jCFirestoreDurableTransport_(), { clock: { now: function nowD7E4ELease_() { return new Date().toISOString(); } } });
    },
    createAdapters: createD7E4EProductionAdapters_,
    createLock: function createD7E4ELock_() { return LockService.getScriptLock(); },
    clock: { now: function nowD7E4EDefault_() { return new Date().toISOString(); } },
    logger: typeof Logger !== 'undefined' ? Logger : { log: function noopD7E4EDefault_() {} }
  };
}

function readD7E4EAuthorization_() {
  const properties = PropertiesService.getScriptProperties();
  const values = properties && typeof properties.getProperties === 'function' ? properties.getProperties() : {};
  return {
    marker: values[D7_E4E_OWNER_MARKER_PROPERTY_],
    canonical: {
      candidateFingerprint: values.D7_E_CANONICAL_CANDIDATE_FINGERPRINT,
      invoiceIdentityHash: values.D7_E_CANONICAL_INVOICE_IDENTITY_HASH,
      xmlSha256: values.D7_E_CANONICAL_XML_SHA256,
      pdfSha256: values.D7_E_CANONICAL_PDF_SHA256,
      attachmentSetHash: values.D7_E_CANONICAL_ATTACHMENT_SET_HASH
    },
    rawProperties: values
  };
}

function createD7E4EPropertyMarkerLifecycle_() {
  return Object.freeze({
    claim: async function claimD7E4EMarker_(request) {
      const store = PropertiesService.getScriptProperties();
      const current = String(store.getProperty(request.propertyName) || '');
      if (current !== request.expectedValue) throw d7e4eConfirmedNotWrittenError_('BLOCKED_D7_E4E_OWNER_MARKER_INVALID');
      store.deleteProperty(request.propertyName);
      if (store.getProperty(request.propertyName)) throw d7e4eError_('BLOCKED_D7_E4E_MARKER_CONSUMPTION_NOT_CONFIRMED');
      return { status: 'CLAIMED', mutationCount: 1 };
    }
  });
}

function createD7E4EExactLeaseStore_(transport, options) {
  if (!transport || typeof transport.runTransaction !== 'function') throw d7e4eError_('BLOCKED_D7_E4E_LEASE_TRANSPORT_MISSING');
  const clock = options && options.clock || { now: function nowD7E4ELeaseStore_() { return new Date().toISOString(); } };

  function normalizeRequest(request) {
    const value = request || {};
    const jobId = String(value.jobId || '');
    const expectedFence = String(value.expectedFence || '');
    const expectedGeneration = Number(value.expectedGeneration);
    const leaseOwner = String(value.leaseOwner || '');
    if (!jobId || !expectedFence || !Number.isInteger(expectedGeneration) || expectedGeneration <= 0 || !leaseOwner) throw d7e4eConfirmedNotWrittenError_('BLOCKED_D7_E4E_LEASE_REQUEST_INVALID');
    return { jobId: jobId, expectedFence: expectedFence, expectedGeneration: expectedGeneration, leaseOwner: leaseOwner };
  }

  function assertIdentity(current, request) {
    if (!current || current.jobId !== request.jobId || current.fencingToken !== request.expectedFence || Number(current.leaseGeneration) !== request.expectedGeneration) throw d7e4eConfirmedNotWrittenError_('BLOCKED_D7_E4E_LEASE_FENCE_OR_GENERATION_MISMATCH');
  }

  async function reacquireReconciliationLease(request) {
    const req = normalizeRequest(request);
    return transport.runTransaction(async function reacquireD7E4ELease_(transaction) {
      const path = 'worker_leases/' + req.jobId;
      const current = await transaction.getDocument(path);
      assertIdentity(current, req);
      if (current.status !== 'RECONCILIATION_REQUIRED') throw d7e4eConfirmedNotWrittenError_('BLOCKED_D7_E4E_LEASE_STATE_CHANGED');
      const acquiredAt = String(request.acquiredAt || clock.now());
      const next = Object.assign({}, current, {
        status: 'ACTIVE',
        leaseOwner: req.leaseOwner,
        leaseGeneration: req.expectedGeneration + 1,
        acquiredAt: acquiredAt,
        releasedAt: '',
        finalJobStatus: '',
        updatedAt: acquiredAt
      });
      await transaction.updateDocument(path, next);
      return { status: 'ACTIVE', mutationCount: 1, lease: JSON.parse(JSON.stringify(next)) };
    });
  }

  async function finalizeReconciliationLease(request) {
    const req = normalizeRequest(request);
    const finalStatus = String(request.status || '');
    if (['COMPLETED', 'RECONCILIATION_REQUIRED'].indexOf(finalStatus) < 0) throw d7e4eConfirmedNotWrittenError_('BLOCKED_D7_E4E_LEASE_FINAL_STATUS_INVALID');
    return transport.runTransaction(async function finalizeD7E4ELease_(transaction) {
      const path = 'worker_leases/' + req.jobId;
      const current = await transaction.getDocument(path);
      assertIdentity(current, req);
      if (current.status !== 'ACTIVE' || current.leaseOwner !== req.leaseOwner) throw d7e4eError_('BLOCKED_D7_E4E_ACTIVE_LEASE_OWNERSHIP_CHANGED');
      const releasedAt = String(request.releasedAt || clock.now());
      const next = Object.assign({}, current, {
        status: finalStatus,
        releasedAt: releasedAt,
        finalJobStatus: finalStatus,
        reconciliationErrorCode: finalStatus === 'RECONCILIATION_REQUIRED' ? d7e4eErrorCode_(request.errorCode) : '',
        updatedAt: releasedAt
      });
      await transaction.updateDocument(path, next);
      return { status: finalStatus, mutationCount: 1, lease: JSON.parse(JSON.stringify(next)) };
    });
  }

  return Object.freeze({ reacquireReconciliationLease: reacquireReconciliationLease, finalizeReconciliationLease: finalizeReconciliationLease });
}

async function inspectD7E4EProductionContext_(authorization) {
  const expected = buildD7E4BExpectedIdentity_({ canonical: authorization.canonical });
  const precheck = rediscoverD7ECandidateReadOnly_(authorization.rawProperties);
  const rows = await buildD7ELedgerRowsFromCandidate_({
    properties: authorization.rawProperties,
    candidate: precheck.candidate,
    fingerprint: precheck.fingerprint,
    config: precheck.config
  });
  const plan = buildD7EMutationPlan_({ properties: authorization.rawProperties, precheck: precheck, ledgerRows: rows, now: new Date().toISOString() });
  const snapshot = await captureD7E4BProductionSnapshotExact_({
    authorization: { canonical: authorization.canonical, rawProperties: authorization.rawProperties },
    expected: expected
  });
  const sourceEvidence = {
    gmailSourceVerified: Boolean(precheck.candidate && precheck.fingerprint),
    candidateIdentityVerified: plan.jobId === expected.jobId && plan.invoiceIdentityHash === authorization.canonical.candidateFingerprint,
    recomputedCommitPlanMatches: stableD7E4EJson_(plan.commitPlan) === stableD7E4EJson_(snapshot.job && snapshot.job.commitPlan)
  };
  const eligibility = evaluateD7E4DValidatedJobRecoveryEligibility_({
    expected: expected,
    snapshot: snapshot,
    sourceEvidence: sourceEvidence,
    capabilities: D7_E4E_CAPABILITIES_
  });
  return { authorization: authorization, expected: expected, precheck: precheck, snapshot: snapshot, sourceEvidence: sourceEvidence, eligibility: eligibility, plan: plan, plannedBudget: D7_E4E_WRITE_BUDGET_ };
}

function createD7E4EProductionAdapters_(context) {
  const drive = createD7EDefaultDriveAdapters_({ properties: context.authorization.rawProperties, precheck: context.precheck, plan: context.plan });
  const sheets = createD7EDefaultSheetsAdapters_({ properties: context.authorization.rawProperties, precheck: context.precheck, plan: context.plan });
  const verification = { artifacts: false, hoaDon: false, ledger: false, inventory: false, gmail: false };
  const finalVerifier = createD7E4EFreshReadOnlyVerifier_([
    function verifyDriveD7E4E_(plan, evidence) { return verifyD7E4EDriveReadOnly_(drive, plan, evidence.artifacts); },
    function verifyHoaDonD7E4E_(plan, evidence) { return verifyD7E4EHoaDonReadOnly_(context, plan, evidence.artifacts); },
    function verifyLedgerD7E4E_(plan) { return verifyD7E4ELedgerReadOnly_(sheets, plan); },
    function verifyInventoryD7E4E_(plan) { return verifyD7E4EInventoryReadOnly_(context, plan); },
    function verifyGmailD7E4E_() { return verifyD7E4EGmailReadOnly_(context); }
  ]);
  return Object.freeze({
    artifacts: {
      async persistAndVerify(plan) {
        const results = [];
        for (const kind of ['xml', 'pdf']) {
          const target = plan.driveTargets[kind];
          const written = await drive.mutate.createFileIfAbsent({ ...target, idempotencyKey: plan.idempotencyKeys[kind] });
          assertD7E4EKnownOutcome_(written, 'DRIVE_' + kind.toUpperCase());
          const found = await drive.read.readFileMetadata({ logicalFileIdentity: target.logicalFileIdentity, fileReference: written.fileReference });
          if (!found || found.contentHash !== target.contentHash || !found.fileReference) throw d7e4eError_('BLOCKED_D7_E4E_DRIVE_VERIFY_FAILED');
          results.push({ status: written.status, fileReference: found.fileReference, mutationCount: written.status === 'CONFIRMED_WRITTEN' && !written.idempotent ? 1 : 0 });
        }
        verification.artifacts = true;
        return { status: 'PASS', xmlFileReference: results[0].fileReference, pdfFileReference: results[1].fileReference, mutationCount: results[0].mutationCount + results[1].mutationCount };
      }
    },
    hoaDon: createD7E4EHoaDonAdapter_(context, verification),
    ledger: {
      async appendAndVerify(plan) {
        const value = await appendAndVerifyD7ESheetTransaction_(sheets, plan);
        verification.ledger = value && value.safeResult && value.safeResult.SHEETS_VERIFICATION_STATUS === 'PASS';
        return { status: verification.ledger ? 'PASS' : 'BLOCKED', mutationCount: Number(value && value.appendedCount || 0) };
      }
    },
    inventory: {
      async rebuildAndVerify(plan) {
        const runId = 'd7e4e-' + hashPrefixD7E4E_(plan.jobId, 12);
        const cutoff = normalizeD7E4EInventoryDate_(plan.ledgerRows[0].issueDate, 'BLOCKED_D7_E4E_INVENTORY_CUTOFF_INVALID');
        const value = await capNhatTonKho(cutoff, runId);
        verification.inventory = Boolean(value && value.status === 'COMPLETED');
        if (!verification.inventory) throw d7e4eError_('BLOCKED_D7_E4E_INVENTORY_VERIFY_FAILED');
        return { status: 'PASS', mutationCount: 1 };
      }
    },
    gmail: createD7E4EGmailProjectionAdapter_(context, verification),
    async verifyAll(plan, evidence) {
      return finalVerifier(plan, evidence || {});
    }
  });
}

function createD7E4EFreshReadOnlyVerifier_(checks) {
  const requiredChecks = Array.isArray(checks) ? checks.slice() : [];
  if (requiredChecks.length !== 5 || requiredChecks.some(function invalidD7E4ECheck_(check) { return typeof check !== 'function'; })) {
    throw d7e4eError_('BLOCKED_D7_E4E_FINAL_VERIFIER_INCOMPLETE');
  }
  return async function verifyAllD7E4EFresh_(plan, evidence) {
    for (const check of requiredChecks) {
      const confirmed = await check(plan, evidence || {});
      if (confirmed !== true) throw d7e4eError_('BLOCKED_D7_E4E_FINAL_VERIFICATION_FAILED');
    }
    return { status: 'PASS', freshReadOnlyVerification: true };
  };
}

async function verifyD7E4EDriveReadOnly_(drive, plan, artifacts) {
  if (!drive || !drive.read || typeof drive.read.readFileMetadata !== 'function') throw d7e4eError_('BLOCKED_D7_E4E_DRIVE_READ_ADAPTER_MISSING');
  for (const kind of ['xml', 'pdf']) {
    const target = plan.driveTargets[kind];
    const expectedReference = artifacts && artifacts[kind + 'FileReference'];
    const found = await drive.read.readFileMetadata({ logicalFileIdentity: target.logicalFileIdentity, fileReference: expectedReference });
    assertD7EDriveReadback_(found, target, kind.toUpperCase());
    if (String(found.fileReference || '') !== String(expectedReference || '')) throw d7e4eError_('BLOCKED_D7_E4E_DRIVE_FINAL_REFERENCE_MISMATCH');
  }
  return true;
}

function verifyD7E4EHoaDonReadOnly_(context, plan, artifacts) {
  const spreadsheet = SpreadsheetApp.openById(context.precheck.config.spreadsheetId);
  const sheetName = typeof CONFIG !== 'undefined' && CONFIG.SHEET_FILES ? CONFIG.SHEET_FILES : 'Hoa-Don';
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw d7e4eError_('BLOCKED_D7_E4E_HOA_DON_SHEET_MISSING');
  const values = sheet.getDataRange().getValues();
  const header = values[0] || [];
  const columns = ['invoiceKey', 'XML_id', 'XML_status', 'PDF_id', 'PDF_status'].map(function columnD7E4E_(name) { return header.indexOf(name); });
  if (columns.some(function missingD7E4EColumn_(value) { return value < 0; })) throw d7e4eError_('BLOCKED_D7_E4E_HOA_DON_SCHEMA_INVALID');
  const matches = values.slice(1).filter(function exactD7E4EHoaDon_(row) { return String(row[columns[0]] || '') === String(plan.commitPlan.legacyInvoiceKey); });
  const savedStatus = String.fromCharCode(10004);
  if (matches.length !== 1 || String(matches[0][columns[1]] || '') !== String(artifacts && artifacts.xmlFileReference || '') || String(matches[0][columns[2]] || '') !== savedStatus || String(matches[0][columns[3]] || '') !== String(artifacts && artifacts.pdfFileReference || '') || String(matches[0][columns[4]] || '') !== savedStatus) {
    throw d7e4eError_('BLOCKED_D7_E4E_HOA_DON_FINAL_VERIFY_FAILED');
  }
  return true;
}

async function verifyD7E4ELedgerReadOnly_(sheets, plan) {
  if (!sheets || !sheets.read || typeof sheets.read.findTransactionByIdentity !== 'function') throw d7e4eError_('BLOCKED_D7_E4E_SHEETS_READ_ADAPTER_MISSING');
  const found = await sheets.read.findTransactionByIdentity({
    transactionIdentity: plan.ledgerRows[0].transactionIdentity,
    hashIndex: plan.ledgerRows[0].legacyHashIndex,
    invoiceKeyV2: plan.ledgerRows[0].invoiceKeyV2,
    legacyInvoiceKey: plan.ledgerRows[0].legacyInvoiceKey
  });
  if (!found || found.status !== 'ALREADY_PRESENT' || !Array.isArray(found.rows) || found.rows.length !== 1) throw d7e4eError_('BLOCKED_D7_E4E_LEDGER_FINAL_VERIFY_FAILED');
  assertD7ESheetRowMatches_(found.rows[0], plan.ledgerRows[0]);
  return true;
}

function verifyD7E4EInventoryReadOnly_(context, plan) {
  const spreadsheet = SpreadsheetApp.openById(context.precheck.config.spreadsheetId);
  const invoiceSheet = spreadsheet.getSheetByName(CONFIG.SHEET_INVOICE);
  const inventorySheet = spreadsheet.getSheetByName(CONFIG.SHEET_TONKHO);
  const itemSheet = spreadsheet.getSheetByName(CONFIG.SHEET_ITEMCODE);
  if (!invoiceSheet || !inventorySheet || !itemSheet) throw d7e4eError_('BLOCKED_D7_E4E_INVENTORY_SHEET_MISSING');
  assertD7E4EInventoryCutoffReadback_(inventorySheet.getRange('H6').getValue(), plan.ledgerRows[0].issueDate);
  const invoiceRows = invoiceSheet.getLastRow() < 2 ? [] : invoiceSheet.getRange(2, 1, invoiceSheet.getLastRow() - 1, 13).getValues();
  const itemRows = itemSheet.getDataRange().getValues().slice(1);
  const inventoryValues = inventorySheet.getDataRange().getValues();
  let totalIndex = inventoryValues.length;
  for (let index = inventoryValues.length - 1; index >= 1; index -= 1) {
    if (String(inventoryValues[index][0] || '').toUpperCase().indexOf('TỔNG') >= 0) { totalIndex = index; break; }
  }
  const actualRows = inventoryValues.slice(1, totalIndex).filter(function nonblankD7E4EInventory_(row) { return String(row[0] || '').trim(); });
  assertD7E4EInventorySnapshot_(invoiceRows, itemRows, actualRows, plan.ledgerRows[0].issueDate);
  return true;
}

function assertD7E4EInventoryCutoffReadback_(actualValue, expectedValue) {
  const actual = normalizeD7E4EInventoryDate_(actualValue, 'BLOCKED_D7_E4E_INVENTORY_CUTOFF_READBACK_INVALID');
  const expected = normalizeD7E4EInventoryDate_(expectedValue, 'BLOCKED_D7_E4E_INVENTORY_CUTOFF_INVALID');
  if (actual.getTime() !== expected.getTime()) throw d7e4eConfirmedNotWrittenError_('BLOCKED_D7_E4E_INVENTORY_CUTOFF_READBACK_DRIFT');
  return true;
}

function assertD7E4EInventorySnapshot_(invoiceRows, itemRows, actualRows, cutoffValue) {
  const cutoffMs = parseD7E4EInventoryDateMs_(cutoffValue, 'BLOCKED_D7_E4E_INVENTORY_CUTOFF_INVALID');
  const names = {};
  const units = {};
  (itemRows || []).forEach(function itemD7E4E_(row) {
    const code = String(row[0] || '').trim();
    if (code) { names[code] = row[1] || ''; units[code] = row[2] || ''; }
  });
  const balances = {};
  const ordered = (invoiceRows || []).map(function rowD7E4E_(row) {
    const time = parseD7E4EInventoryDateMs_(row[1], 'BLOCKED_D7_E4E_INVENTORY_SOURCE_INVALID');
    const sequence = Number(row[0]);
    if (!Number.isInteger(sequence) || sequence < 1) throw d7e4eError_('BLOCKED_D7_E4E_INVENTORY_SOURCE_INVALID');
    return { row: row, time: time, sequence: sequence };
  }).sort(function orderD7E4E_(left, right) { return left.time - right.time || left.sequence - right.sequence; });
  ordered.forEach(function accumulateD7E4E_(item) {
    if (item.time > cutoffMs) return;
    const row = item.row;
    const code = String(row[4] || '').trim();
    const direction = String(row[6] || '').toUpperCase();
    if (!code || (direction !== 'NHAP' && direction !== 'XUAT')) return;
    const quantity = Number(row[7]) || 0;
    if (!balances[code]) balances[code] = { quantity: 0, value: 0, average: 0 };
    const balance = balances[code];
    if (direction === 'NHAP') {
      balance.quantity += quantity;
      balance.value += quantity * (Number(row[8]) || 0);
      balance.average = balance.quantity ? balance.value / balance.quantity : 0;
    } else {
      if (quantity > balance.quantity) throw d7e4eError_('BLOCKED_D7_E4E_INVENTORY_OVERSELL');
      balance.quantity -= quantity;
      balance.value -= quantity * balance.average;
    }
  });
  const expectedCodes = Object.keys(balances).sort();
  const actualByCode = {};
  (actualRows || []).forEach(function actualD7E4E_(row) {
    const code = String(row[0] || '').trim();
    if (!code || actualByCode[code]) throw d7e4eError_('BLOCKED_D7_E4E_INVENTORY_FINAL_VERIFY_FAILED');
    actualByCode[code] = row;
  });
  if (Object.keys(actualByCode).sort().join('|') !== expectedCodes.join('|')) throw d7e4eError_('BLOCKED_D7_E4E_INVENTORY_FINAL_VERIFY_FAILED');
  expectedCodes.forEach(function compareD7E4E_(code) {
    const row = actualByCode[code];
    const balance = balances[code];
    if (String(row[1] || '').trim() !== String(names[code] || '#LOI').trim() || String(row[2] || '').trim() !== String(units[code] || '#LOI').trim() || !d7e4eNumbersEqual_(row[3], balance.quantity) || !d7e4eNumbersEqual_(row[4], balance.value) || !d7e4eNumbersEqual_(row[5], balance.quantity ? balance.value / balance.quantity : 0)) {
      throw d7e4eError_('BLOCKED_D7_E4E_INVENTORY_FINAL_VERIFY_FAILED');
    }
  });
  return true;
}

function parseD7E4EInventoryDateMs_(value, blockerCode) {
  return normalizeD7E4EInventoryDate_(value, blockerCode).getTime();
}

function normalizeD7E4EInventoryDate_(value, blockerCode) {
  const parsed = parseInvoiceDateValue_(value);
  const time = parsed && typeof parsed.getTime === 'function' ? parsed.getTime() : NaN;
  if (!Number.isFinite(time)) throw d7e4eConfirmedNotWrittenError_(blockerCode);
  return parsed;
}

function d7e4eNumbersEqual_(left, right) {
  return Number.isFinite(Number(left)) && Number.isFinite(Number(right)) && Math.abs(Number(left) - Number(right)) <= 1e-6;
}

function createD7E4EHoaDonAdapter_(context, verification) {
  return Object.freeze({
    async upsertAndVerify(plan, artifacts) {
      const spreadsheet = SpreadsheetApp.openById(context.precheck.config.spreadsheetId);
      const sheetName = typeof CONFIG !== 'undefined' && CONFIG.SHEET_FILES ? CONFIG.SHEET_FILES : 'Hoa-Don';
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) throw d7e4eError_('BLOCKED_D7_E4E_HOA_DON_SHEET_MISSING');
      const values = sheet.getDataRange().getValues();
      const header = values[0] || [];
      const keyColumn = header.indexOf('invoiceKey');
      const xmlColumn = header.indexOf('XML_id');
      const xmlStatusColumn = header.indexOf('XML_status');
      const pdfColumn = header.indexOf('PDF_id');
      const pdfStatusColumn = header.indexOf('PDF_status');
      if ([keyColumn, xmlColumn, xmlStatusColumn, pdfColumn, pdfStatusColumn].some(function missingD7E4E_(value) { return value < 0; })) throw d7e4eError_('BLOCKED_D7_E4E_HOA_DON_SCHEMA_INVALID');
      const key = plan.commitPlan.legacyInvoiceKey;
      const savedStatus = String.fromCharCode(10004);
      const matches = values.slice(1).map(function rowD7E4E_(row, index) { return { row: row, index: index + 2 }; }).filter(function matchD7E4E_(item) { return String(item.row[keyColumn] || '') === String(key); });
      if (matches.length > 1) throw d7e4eError_('BLOCKED_D7_E4E_HOA_DON_DUPLICATE');
      let rowNumber;
      let mutationCount = 0;
      if (matches.length === 0) {
        const row = Array(header.length).fill('');
        row[keyColumn] = key;
        row[xmlColumn] = artifacts.xmlFileReference;
        row[xmlStatusColumn] = savedStatus;
        row[pdfColumn] = artifacts.pdfFileReference;
        row[pdfStatusColumn] = savedStatus;
        sheet.appendRow(row);
        rowNumber = sheet.getLastRow();
        mutationCount = 1;
      } else {
        rowNumber = matches[0].index;
        const currentXml = String(matches[0].row[xmlColumn] || '');
        const currentPdf = String(matches[0].row[pdfColumn] || '');
        if ((currentXml && currentXml !== artifacts.xmlFileReference) || (currentPdf && currentPdf !== artifacts.pdfFileReference)) throw d7e4eError_('BLOCKED_D7_E4E_HOA_DON_CONFLICT');
        if (!currentXml) { sheet.getRange(rowNumber, xmlColumn + 1).setValue(artifacts.xmlFileReference); mutationCount = 1; }
        if (!currentPdf) { sheet.getRange(rowNumber, pdfColumn + 1).setValue(artifacts.pdfFileReference); mutationCount = 1; }
        if (String(matches[0].row[xmlStatusColumn] || '') !== savedStatus) { sheet.getRange(rowNumber, xmlStatusColumn + 1).setValue(savedStatus); mutationCount = 1; }
        if (String(matches[0].row[pdfStatusColumn] || '') !== savedStatus) { sheet.getRange(rowNumber, pdfStatusColumn + 1).setValue(savedStatus); mutationCount = 1; }
      }
      const verified = sheet.getRange(rowNumber, 1, 1, header.length).getValues()[0];
      verification.hoaDon = String(verified[keyColumn] || '') === String(key) && String(verified[xmlColumn] || '') === String(artifacts.xmlFileReference) && String(verified[pdfColumn] || '') === String(artifacts.pdfFileReference) && String(verified[xmlStatusColumn] || '') === savedStatus && String(verified[pdfStatusColumn] || '') === savedStatus;
      if (!verification.hoaDon) throw d7e4eError_('BLOCKED_D7_E4E_HOA_DON_VERIFY_FAILED');
      return { status: 'PASS', mutationCount: mutationCount };
    }
  });
}

function createD7E4EGmailProjectionAdapter_(context, verification) {
  return Object.freeze({
    async applyAndVerify() {
      const thread = findD7E4EExactGmailThread_(context);
      const saved = GmailApp.getUserLabelByName(CONFIG.SAVE_SHEET_LABEL);
      const pending = GmailApp.getUserLabelByName(CONFIG.PENDING_LABEL);
      if (!saved || !pending) throw d7e4eError_('BLOCKED_D7_E4E_GMAIL_LABEL_MISSING');
      const before = thread.getLabels().map(function nameD7E4E_(label) { return label.getName(); });
      const needsMutation = before.indexOf(CONFIG.SAVE_SHEET_LABEL) < 0 || before.indexOf(CONFIG.PENDING_LABEL) >= 0;
      if (needsMutation) {
        thread.addLabel(saved);
        thread.removeLabel(pending);
      }
      const after = thread.getLabels().map(function nameAfterD7E4E_(label) { return label.getName(); });
      verification.gmail = after.indexOf(CONFIG.SAVE_SHEET_LABEL) >= 0 && after.indexOf(CONFIG.PENDING_LABEL) < 0;
      if (!verification.gmail) throw d7e4eError_('BLOCKED_D7_E4E_GMAIL_VERIFY_FAILED');
      return { status: 'PASS', mutationCount: needsMutation ? 1 : 0 };
    }
  });
}

function findD7E4EExactGmailThread_(context) {
  const threads = GmailApp.search(context.precheck.config.query, 0, context.precheck.config.maxResults);
  const expectedThreadHash = String(context.plan.sourceThreadHash || '');
  const candidateThreadHash = String(context.precheck.candidate && context.precheck.candidate.message && context.precheck.candidate.message.threadIdHash || '');
  if (!/^[a-f0-9]{16}$/.test(expectedThreadHash) || candidateThreadHash !== expectedThreadHash) {
    throw d7e4eConfirmedNotWrittenError_('BLOCKED_D7_E4E_GMAIL_THREAD_IDENTITY_INVALID');
  }
  const matchingThreads = (threads || []).filter(function exactD7E4EThread_(thread) {
    const threadId = String(thread && typeof thread.getId === 'function' && thread.getId() || '');
    return threadId && hashPrefixD7B_(sha256D7BText_(threadId), 16) === expectedThreadHash;
  });
  if (matchingThreads.length !== 1) throw d7e4eConfirmedNotWrittenError_('BLOCKED_D7_E4E_GMAIL_THREAD_IDENTITY_NOT_EXACT');
  return matchingThreads[0];
}

function verifyD7E4EGmailReadOnly_(context) {
  const thread = findD7E4EExactGmailThread_(context);
  const labels = thread.getLabels().map(function finalD7E4ELabel_(label) { return label.getName(); });
  if (labels.indexOf(CONFIG.SAVE_SHEET_LABEL) < 0 || labels.indexOf(CONFIG.PENDING_LABEL) >= 0) throw d7e4eError_('BLOCKED_D7_E4E_GMAIL_FINAL_VERIFY_FAILED');
  return true;
}

function validateD7E4EAuthorization_(input) {
  const value = d7e4eObject_(input);
  const canonical = d7e4eObject_(value.canonical);
  if (String(value.marker || '') !== D7_E4E_OWNER_MARKER_VALUE_) throw d7e4eError_('BLOCKED_D7_E4E_OWNER_MARKER_INVALID');
  ['candidateFingerprint', 'invoiceIdentityHash', 'xmlSha256', 'pdfSha256', 'attachmentSetHash'].forEach(function canonicalD7E4E_(key) {
    if (!/^[a-f0-9]{64}$/.test(String(canonical[key] || ''))) throw d7e4eError_('BLOCKED_D7_E4E_CANONICAL_IDENTITY_INVALID');
  });
  if (canonical.candidateFingerprint !== canonical.invoiceIdentityHash) throw d7e4eError_('BLOCKED_D7_E4E_CURRENT_IDENTITY_MISMATCH');
  return { marker: value.marker, canonical: canonical, rawProperties: d7e4eObject_(value.rawProperties) };
}

function assertD7E4ERecoveryContext_(context) {
  const value = d7e4eObject_(context);
  const eligibility = d7e4eObject_(value.eligibility);
  const plan = d7e4eObject_(value.plan);
  const snapshot = d7e4eObject_(value.snapshot);
  const job = d7e4eObject_(snapshot.job);
  if (eligibility.classification !== 'READY_FOR_LOCAL_RUNTIME_IMPLEMENTATION') throw d7e4eError_('BLOCKED_D7_E4E_ELIGIBILITY_NOT_PROVEN');
  if (!eligibility.capabilitySummary || Number(eligibility.capabilitySummary.PASS) !== 7) throw d7e4eError_('BLOCKED_D7_E4E_CAPABILITY_SET_INCOMPLETE');
  if (!plan.jobId || plan.jobId !== job.jobId || plan.jobId !== value.expected.jobId) throw d7e4eError_('BLOCKED_D7_E4E_SAME_JOB_IDENTITY_MISMATCH');
  if (job.status !== 'VALIDATED' || Number(job.version) !== 4) throw d7e4eError_('BLOCKED_D7_E4E_JOB_STATE_CHANGED');
  if (!snapshot.lease || snapshot.lease.status !== 'RECONCILIATION_REQUIRED') throw d7e4eError_('BLOCKED_D7_E4E_LEASE_STATE_CHANGED');
  if (!Array.isArray(snapshot.events) || snapshot.events.length !== 2 || snapshot.eventsComplete !== true) throw d7e4eError_('BLOCKED_D7_E4E_AUDIT_BASELINE_CHANGED');
}

function assertD7E4EPlannedBudget_(budget) {
  if (stableD7E4EJson_(budget) !== stableD7E4EJson_(D7_E4E_WRITE_BUDGET_)) throw d7e4eError_('BLOCKED_D7_E4E_PLANNED_WRITE_BUDGET_INVALID');
}

function assertD7E4EObservedBudget_(counters) {
  const c = counters || {};
  Object.keys(D7_E4E_WRITE_BUDGET_).forEach(function budgetD7E4E_(key) {
    if (Number(c[key] || 0) > Number(D7_E4E_WRITE_BUDGET_[key])) throw d7e4eError_('BLOCKED_D7_E4E_WRITE_BUDGET_EXCEEDED');
  });
  if (Number(c.FIRESTORE_JOB_CREATES || 0) !== 0 || Number(c.FIRESTORE_ATTACHMENT_CREATES || 0) !== 0 || Number(c.FIRESTORE_RECONCILIATION_REPORT_CREATES || 0) !== 0 || Number(c.TRIGGER_MUTATIONS || 0) !== 0 || Number(c.DESTRUCTIVE_OPERATIONS || 0) !== 0) throw d7e4eError_('BLOCKED_D7_E4E_FORBIDDEN_WRITE_OBSERVED');
}

async function transitionD7E4E_(jobStore, result, job, fromStatus, toStatus, suffix, patch) {
  assertD7E4EJob_(job, job.version, fromStatus, job.jobId);
  const value = await invokeD7E4EMutation_(function transitionD7E4EJob_() {
    return jobStore.transitionJob({
      jobId: job.jobId,
      expectedVersion: Number(job.version),
      fromStatus: fromStatus,
      toStatus: toStatus,
      idempotencyKey: 'd7e4e:' + job.jobId + ':' + suffix,
      patch: patch || {}
    });
  });
  const next = value && (value.job || value);
  if (!next || next.status !== toStatus || Number(next.version) !== Number(job.version) + 1) throw d7e4eError_('BLOCKED_D7_E4E_TRANSITION_NOT_CONFIRMED');
  result.COUNTERS.FIRESTORE_JOB_TRANSITIONS += 1;
  result.TRANSITIONS.push(fromStatus + '>' + toStatus);
  return next;
}

function assertD7E4EJob_(job, version, status, jobId) {
  if (!job || job.jobId !== jobId || job.status !== status || Number(job.version) !== Number(version)) throw d7e4eError_('BLOCKED_D7_E4E_OPTIMISTIC_CONCURRENCY_MISMATCH');
}

function assertD7E4EAdapters_(adapters) {
  const value = adapters || {};
  const required = [
    [value.artifacts, 'persistAndVerify'],
    [value.hoaDon, 'upsertAndVerify'],
    [value.ledger, 'appendAndVerify'],
    [value.inventory, 'rebuildAndVerify'],
    [value.gmail, 'applyAndVerify'],
    [value, 'verifyAll']
  ];
  required.forEach(function adapterD7E4E_(item) { if (!item[0] || typeof item[0][item[1]] !== 'function') throw d7e4eError_('BLOCKED_D7_E4E_ADAPTER_MISSING'); });
}

function assertD7E4EDependencies_(services) {
  ['readAuthorization', 'inspectRecoveryContext', 'createJobStore', 'createLeaseStore', 'createAdapters', 'createLock'].forEach(function dependencyD7E4E_(name) {
    if (typeof services[name] !== 'function') throw d7e4eError_('BLOCKED_D7_E4E_DEPENDENCY_MISSING');
  });
  if (!services.markerLifecycle || typeof services.markerLifecycle.claim !== 'function') throw d7e4eError_('BLOCKED_D7_E4E_MARKER_LIFECYCLE_MISSING');
}

function addD7E4EExternalCount_(result, name, value, maximum) {
  if (!Number.isInteger(value) || value < 0) {
    const error = d7e4eError_('BLOCKED_D7_E4E_WRITE_BUDGET_EXCEEDED');
    error.writeOutcome = 'UNKNOWN';
    throw error;
  }
  const count = value;
  if (count > maximum) {
    const error = d7e4eError_('BLOCKED_D7_E4E_WRITE_BUDGET_EXCEEDED');
    error.writeOutcome = 'CONFIRMED';
    throw error;
  }
  result.COUNTERS[name] = count;
}

function isD7E4EExactMutationCount_(value, expected) {
  return Number.isInteger(value) && value === expected;
}

function assertD7E4EConfirmedAdapterResponse_(value, stage) {
  if (value && value.status === 'PASS') return;
  const error = d7e4eError_('BLOCKED_D7_E4E_' + stage + '_MUTATION_NOT_CONFIRMED');
  error.writeOutcome = 'UNKNOWN';
  throw error;
}

function finalizeD7E4ECounters_(result) {
  const c = result.COUNTERS;
  c.FIRESTORE_TOTAL = Number(c.FIRESTORE_JOB_TRANSITIONS || 0) + Number(c.FIRESTORE_LEASE_UPDATES || 0) + Number(c.FIRESTORE_AUDIT_EVENT_CREATES || 0);
}

function assertD7E4EKnownOutcome_(value, stage) {
  if (value && value.status === 'OUTCOME_UNKNOWN') {
    const error = d7e4eError_('BLOCKED_D7_E4E_' + stage + '_WRITE_OUTCOME_UNKNOWN');
    error.writeOutcome = 'UNKNOWN';
    throw error;
  }
}

async function invokeD7E4EMutation_(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error && (error.writeOutcome === 'UNKNOWN' || error.writeOutcome === 'CONFIRMED_NOT_WRITTEN')) throw error;
    const uncertain = d7e4eError_('BLOCKED_D7_E4E_WRITE_OUTCOME_UNKNOWN');
    uncertain.writeOutcome = 'UNKNOWN';
    throw uncertain;
  }
}

function isD7E4EUnknownWriteOutcome_(error, stage) {
  if (!error) return false;
  if (error.writeOutcome === 'CONFIRMED_NOT_WRITTEN' || error.writeOutcome === 'CONFIRMED') return false;
  if (error.writeOutcome === 'UNKNOWN') return true;
  if (['OWNER_AUTHORIZATION', 'FRESH_PRE_MUTATION_INSPECTION', 'FINAL_READ_ONLY_VERIFICATION'].indexOf(stage) >= 0) return false;
  const code = d7e4eErrorCode_(error);
  if (['FIRESTORE_WRITE_UNCONFIRMED', 'FIRESTORE_TRANSPORT_ERROR', 'WRITE_OUTCOME_UNKNOWN'].indexOf(code) >= 0) return true;
  return [
    'ONE_SHOT_MARKER_CLAIM',
    'LEASE_REACQUIRE',
    'DRIVE_ARTIFACTS',
    'COMMITTING_TRANSITION',
    'HOA_DON',
    'LEDGER',
    'INVENTORY_PENDING_TRANSITION',
    'INVENTORY',
    'GMAIL_PROJECTION',
    'COMPLETION_TRANSITION',
    'COMPLETION_AUDIT',
    'LEASE_FINALIZE',
    'LEASE_FAILURE_FINALIZE'
  ].indexOf(stage) >= 0;
}

function createD7E4EResult_() {
  return {
    PHASE: D7_E4E_PHASE_,
    SCHEMA_VERSION: D7_E4E_SCHEMA_VERSION_,
    PUBLIC_ENTRYPOINT: D7_E4E_PUBLIC_ENTRYPOINT_,
    OWNER_MARKER_STATUS: 'NOT_EVALUATED',
    MARKER_CLAIM_STATUS: 'NOT_ATTEMPTED',
    PREFLIGHT_STATUS: 'NOT_EVALUATED',
    JOB_ID_HASH_PREFIX: '',
    STATE_PATH_STATUS: 'NOT_RUN',
    FINAL_JOB_STATUS: 'NOT_RUN',
    FINAL_STATUS: 'BLOCKED_D7_E4E_NOT_RUN',
    BLOCKER_CODE: '',
    LEASE_CLOSE_STATUS: 'NOT_REQUIRED',
    TRANSITIONS: [],
    COUNTERS: {
      FIRESTORE_JOB_CREATES: 0,
      FIRESTORE_JOB_TRANSITIONS: 0,
      FIRESTORE_LEASE_UPDATES: 0,
      FIRESTORE_AUDIT_EVENT_CREATES: 0,
      FIRESTORE_ATTACHMENT_CREATES: 0,
      FIRESTORE_RECONCILIATION_REPORT_CREATES: 0,
      FIRESTORE_TOTAL: 0,
      DRIVE_FILE_CREATES: 0,
      HOA_DON_ROW_MUTATIONS: 0,
      LEDGER_ROW_APPENDS: 0,
      INVENTORY_REBUILDS: 0,
      GMAIL_LABEL_MUTATIONS: 0,
      SCRIPT_PROPERTY_MUTATIONS: 0,
      TRIGGER_MUTATIONS: 0,
      DESTRUCTIVE_OPERATIONS: 0
    },
    PRODUCTION_EXECUTION_AUTHORIZED: 'NO_LOCAL_IMPLEMENTATION_ONLY'
  };
}

function sanitizeD7E4EResult_(result) {
  return JSON.parse(JSON.stringify(result));
}

function d7e4eObject_(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableD7E4EJson_(value) {
  function normalize(input) {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      const output = {};
      Object.keys(input).sort().forEach(function keyD7E4E_(key) { output[key] = normalize(input[key]); });
      return output;
    }
    return input;
  }
  return JSON.stringify(normalize(value));
}

function hashPrefixD7E4E_(value, length) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hex = ('00000000' + (hash >>> 0).toString(16)).slice(-8);
  return (hex + hex + hex + hex).slice(0, Number(length || 8));
}

function d7e4eError_(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function d7e4eConfirmedNotWrittenError_(code) {
  const error = d7e4eError_(code);
  error.writeOutcome = 'CONFIRMED_NOT_WRITTEN';
  return error;
}

function d7e4eErrorCode_(error) {
  return String(error && (error.code || error.message || error) || 'BLOCKED_D7_E4E_UNKNOWN').replace(/[^A-Z0-9_]/gi, '_').toUpperCase().slice(0, 120);
}
