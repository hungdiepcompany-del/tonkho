const D5A_LOCAL_ONLY = true;

const D5A_STEP_RESULT_STATUSES_ = Object.freeze({
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',
  CONFIRMED_NOT_WRITTEN: 'CONFIRMED_NOT_WRITTEN',
  CONFIRMED_WRITTEN: 'CONFIRMED_WRITTEN',
  ALREADY_PRESENT: 'ALREADY_PRESENT',
  OUTCOME_UNKNOWN: 'OUTCOME_UNKNOWN',
  CONFLICT: 'CONFLICT',
  FAILED: 'FAILED'
});

const D5A_EXECUTION_ORDER_ = Object.freeze([
  'DRIVE_XML',
  'DRIVE_PDF',
  'HOA_DON',
  'LEDGER',
  'GMAIL'
]);

function createDurableInvoiceOrchestrator(deps) {
  const options = deps || {};
  const jobStore = requireD5AObject_(options.jobStore, 'jobStore');
  const sourceAdapter = requireD5AAdapter_(options.sourceAdapter, 'sourceAdapter', [
    'loadSource',
    'parseInvoice',
    'validateInvoice',
    'buildSourceSnapshot'
  ]);
  const driveEvidenceAdapter = requireD5AAdapter_(options.driveEvidenceAdapter, 'driveEvidenceAdapter', [
    'findEvidence',
    'writeXmlIfAbsent',
    'writePdfIfAbsent',
    'verifyEvidence'
  ]);
  const hoaDonAdapter = requireD5AAdapter_(options.hoaDonAdapter, 'hoaDonAdapter', [
    'findInvoiceRow',
    'writeInvoiceRowIfAbsent',
    'verifyInvoiceRow'
  ]);
  const ledgerAdapter = requireD5AAdapter_(options.ledgerAdapter, 'ledgerAdapter', [
    'findInvoiceLines',
    'appendInvoiceLinesIfAbsent',
    'verifyInvoiceLines'
  ]);
  const gmailProjectionAdapter = requireD5AAdapter_(options.gmailProjectionAdapter, 'gmailProjectionAdapter', [
    'readLabels',
    'applySavedLabel',
    'verifySavedLabel'
  ]);
  const reconciliationService = requireD5AObject_(options.reconciliationService, 'reconciliationService');
  const clock = requireD5AAdapter_(options.clock, 'clock', ['now']);

  const requiredStoreMethods = [
    'createJobIfAbsent',
    'getJob',
    'saveCommitPlanIfAbsent',
    'transitionJob',
    'appendAuditEvent',
    'saveReconciliationReport',
    'resumeCompletedJob'
  ];
  requiredStoreMethods.forEach(name => {
    if (typeof jobStore[name] !== 'function') throw new Error('D5A_JOB_STORE_METHOD_REQUIRED:' + name);
  });

  async function executeDurableInvoiceJob(input) {
    const trace = createD5ATrace_('execute');
    const sourceSnapshot = await sourceAdapter.buildSourceSnapshot(cloneD5AJson_(input || {}));
    const jobId = safeD5AString_(sourceSnapshot.jobId || ('job_' + hashD5AString_(sourceSnapshot.invoiceIdentityHash || sourceSnapshot.invoiceKeyV2 || sourceSnapshot.legacyInvoiceKey)));
    const sourceHash = hashD5AString_(sourceSnapshot.sourceFingerprint || sourceSnapshot.sourceHash || 'LOCAL_SOURCE');
    const identityHash = hashD5AString_(sourceSnapshot.invoiceIdentityHash || sourceSnapshot.invoiceKeyV2 || jobId);

    let createResult;
    try {
      createResult = await jobStore.createJobIfAbsent({
        jobId,
        invoiceIdentityHash: identityHash,
        sourceThreadHash: sourceHash,
        status: 'DETECTED'
      });
    } catch (error) {
      return finishD5A_(trace, {
        status: 'FAILED_BEFORE_JOB_CREATE',
        errorCode: d5aErrorCode_(error),
        jobId
      });
    }

    let job = cloneD5AJson_(createResult.job || createResult);
    trace.jobId = job.jobId || jobId;
    await appendD5AAudit_(jobStore, trace, job, 'JOB_CREATED', { created: createResult.created === true });

    const current = durableStatusD5A_(job);
    if (current === 'COMPLETED') return resumeDurableInvoiceJob(job.jobId);
    if (current === 'RECONCILIATION_REQUIRED') {
      return finishD5A_(trace, {
        status: 'RECONCILIATION_REQUIRED_AUTO_RESUME_BLOCKED',
        jobId: job.jobId,
        adapterMutationCount: 0
      });
    }

    let loaded;
    let parsed;
    let validated;
    try {
      loaded = await sourceAdapter.loadSource(cloneD5AJson_(input || {}));
      job = await transitionD5A_(jobStore, trace, job, 'DETECTED', 'COLLECTED', 'SOURCE_LOADED');
      parsed = await sourceAdapter.parseInvoice(loaded);
      job = await transitionD5A_(jobStore, trace, job, 'COLLECTED', 'PARSED', 'SOURCE_PARSED');
      validated = await sourceAdapter.validateInvoice(parsed);
      job = await transitionD5A_(jobStore, trace, job, 'PARSED', 'VALIDATED', 'SOURCE_VALIDATED');
      await appendD5AAudit_(jobStore, trace, job, 'SOURCE_VALIDATED', { expectedLineCount: d5aLineCount_(validated) });
    } catch (error) {
      return finishD5A_(trace, { status: 'SOURCE_FAILED', errorCode: d5aErrorCode_(error), jobId: job.jobId });
    }

    let commitPlan = buildD5ACommitPlan_(job, validated, sourceSnapshot);
    const frozenPlanBeforeSave = cloneD5AJson_(commitPlan);

    try {
      const saved = await jobStore.saveCommitPlanIfAbsent({
        jobId: job.jobId,
        expectedVersion: Number(job.version),
        commitPlan
      });
      job = cloneD5AJson_(saved.job || await jobStore.getJob(job.jobId));
      commitPlan = cloneD5AJson_((job && job.commitPlan) || commitPlan);
      if (stableD5AJson_(frozenPlanBeforeSave) !== stableD5AJson_(commitPlan)) {
        return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, frozenPlanBeforeSave, {
          stepName: 'COMMIT_PLAN_SAVE',
          status: 'CONFLICT',
          errorCode: 'COMMIT_PLAN_MUTATED'
        }, buildObservedD5ASnapshot_, adaptersD5A_());
      }
      await appendD5AAudit_(jobStore, trace, job, 'COMMIT_PLAN_SAVED', { expectedLineCount: commitPlan.expectedLineCount });
      job = await transitionD5A_(jobStore, trace, job, 'VALIDATED', 'FILES_SAVED', 'COMMIT_PLAN_PERSISTED');
    } catch (error) {
      return finishD5A_(trace, {
        status: d5aErrorCode_(error) === 'DURABLE_JOB_VERSION_CONFLICT' ? 'DURABLE_JOB_VERSION_CONFLICT' : 'COMMIT_PLAN_SAVE_FAILED',
        errorCode: d5aErrorCode_(error),
        jobId: job.jobId,
        adapterMutationCount: countAdapterMutationsD5A_(adaptersD5A_())
      });
    }

    const adapters = adaptersD5A_();

    const preLedgerLabels = await gmailProjectionAdapter.readLabels({ commitPlan, job, stage: 'PRE_LEDGER' });
    const normalizedPreLedgerLabels = normalizeD5ALabels_(preLedgerLabels && preLedgerLabels.labels || preLedgerLabels);
    if (normalizedPreLedgerLabels.includes('SAVED') || normalizedPreLedgerLabels.includes('DA_LUU')) {
      return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, {
        stepName: 'GMAIL_FALSE_SAVED_LABEL',
        status: 'CONFLICT',
        errorCode: 'GMAIL_FALSE_SAVED_LABEL'
      }, buildObservedD5ASnapshot_, adapters);
    }

    const driveXml = await runExternalStepD5A_({
      stepName: 'DRIVE_XML',
      auditEvent: 'DRIVE_XML_VERIFIED',
      trace,
      job,
      commitPlan,
      read: () => driveEvidenceAdapter.findEvidence({ kind: 'XML', commitPlan, job }),
      write: () => driveEvidenceAdapter.writeXmlIfAbsent({ commitPlan, job }),
      verify: () => driveEvidenceAdapter.verifyEvidence({ kind: 'XML', commitPlan, job })
    });
    if (!isSuccessfulD5AStep_(driveXml)) return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, driveXml, buildObservedD5ASnapshot_, adapters);
    await appendD5AAudit_(jobStore, trace, job, 'DRIVE_XML_VERIFIED', { status: driveXml.status });

    const drivePdf = await runExternalStepD5A_({
      stepName: 'DRIVE_PDF',
      auditEvent: 'DRIVE_PDF_VERIFIED',
      trace,
      job,
      commitPlan,
      read: () => driveEvidenceAdapter.findEvidence({ kind: 'PDF', commitPlan, job }),
      write: () => driveEvidenceAdapter.writePdfIfAbsent({ commitPlan, job }),
      verify: () => driveEvidenceAdapter.verifyEvidence({ kind: 'PDF', commitPlan, job })
    });
    if (!isSuccessfulD5AStep_(drivePdf)) return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, drivePdf, buildObservedD5ASnapshot_, adapters);
    await appendD5AAudit_(jobStore, trace, job, 'DRIVE_PDF_VERIFIED', { status: drivePdf.status });

    const hoaDon = await runExternalStepD5A_({
      stepName: 'HOA_DON',
      auditEvent: 'HOA_DON_VERIFIED',
      trace,
      job,
      commitPlan,
      read: () => hoaDonAdapter.findInvoiceRow({ commitPlan, job }),
      write: () => hoaDonAdapter.writeInvoiceRowIfAbsent({ commitPlan, job }),
      verify: () => hoaDonAdapter.verifyInvoiceRow({ commitPlan, job })
    });
    if (!isSuccessfulD5AStep_(hoaDon)) return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, hoaDon, buildObservedD5ASnapshot_, adapters);
    await appendD5AAudit_(jobStore, trace, job, 'HOA_DON_VERIFIED', { status: hoaDon.status });

    try {
      job = await transitionD5A_(jobStore, trace, job, 'FILES_SAVED', 'COMMITTING', 'READY_FOR_LEDGER');
    } catch (error) {
      return finishD5A_(trace, { status: 'DURABLE_JOB_VERSION_CONFLICT', errorCode: d5aErrorCode_(error), jobId: job.jobId, adapterMutationCount: countAdapterMutationsD5A_(adapters) });
    }

    const ledger = await runExternalStepD5A_({
      stepName: 'LEDGER',
      auditEvent: 'LEDGER_VERIFIED',
      trace,
      job,
      commitPlan,
      read: () => ledgerAdapter.findInvoiceLines({ commitPlan, job }),
      write: () => ledgerAdapter.appendInvoiceLinesIfAbsent({ commitPlan, job }),
      verify: () => ledgerAdapter.verifyInvoiceLines({ commitPlan, job })
    });
    if (!isSuccessfulD5AStep_(ledger)) return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, ledger, buildObservedD5ASnapshot_, adapters);
    await appendD5AAudit_(jobStore, trace, job, 'LEDGER_VERIFIED', { status: ledger.status, expectedLineCount: commitPlan.expectedLineCount });

    try {
      job = await transitionD5A_(jobStore, trace, job, 'COMMITTING', 'ROWS_COMMITTED', 'LEDGER_VERIFIED');
    } catch (error) {
      return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, {
        stepName: 'LEDGER_STATE_TRANSITION',
        status: 'OUTCOME_UNKNOWN',
        errorCode: d5aErrorCode_(error)
      }, buildObservedD5ASnapshot_, adapters);
    }


    const gmail = await runExternalStepD5A_({
      stepName: 'GMAIL',
      auditEvent: 'GMAIL_LABEL_VERIFIED',
      trace,
      job,
      commitPlan,
      read: () => gmailProjectionAdapter.readLabels({ commitPlan, job }),
      write: () => gmailProjectionAdapter.applySavedLabel({ commitPlan, job }),
      verify: () => gmailProjectionAdapter.verifySavedLabel({ commitPlan, job })
    });
    if (!isSuccessfulD5AStep_(gmail)) return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, gmail, buildObservedD5ASnapshot_, adapters);
    await appendD5AAudit_(jobStore, trace, job, 'GMAIL_LABEL_VERIFIED', { status: gmail.status });

    try {
      job = await transitionD5A_(jobStore, trace, job, 'ROWS_COMMITTED', 'PROJECTIONS_COMMITTED', 'GMAIL_LABEL_VERIFIED');
    } catch (error) {
      return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, {
        stepName: 'GMAIL_STATE_TRANSITION',
        status: 'OUTCOME_UNKNOWN',
        errorCode: d5aErrorCode_(error)
      }, buildObservedD5ASnapshot_, adapters);
    }

    const finalReport = callD5AReconciler_(reconciliationService, {
      ...await buildObservedD5ASnapshot_(job, commitPlan, adapters),
      generatedAt: clock.now()
    });
    if (finalReport.status !== 'CONSISTENT') {
      return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, {
        stepName: 'FINAL_VERIFICATION',
        status: 'CONFLICT',
        errorCode: 'FINAL_RECONCILIATION_NOT_CONSISTENT'
      }, buildObservedD5ASnapshot_, adapters);
    }

    try {
      job = await transitionD5A_(jobStore, trace, job, 'PROJECTIONS_COMMITTED', 'COMPLETED', 'JOB_COMPLETED');
      await appendD5AAudit_(jobStore, trace, job, 'JOB_COMPLETED', { reportStatus: finalReport.status });
    } catch (error) {
      return await reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, {
        stepName: 'COMPLETION_STATE_TRANSITION',
        status: 'OUTCOME_UNKNOWN',
        errorCode: d5aErrorCode_(error)
      }, buildObservedD5ASnapshot_, adapters);
    }

    return finishD5A_(trace, {
      status: 'COMPLETED',
      resultCode: 'JOB_COMPLETED',
      job,
      finalReport,
      adapterMutationCount: countAdapterMutationsD5A_(adapters)
    });
  }

  async function resumeDurableInvoiceJob(jobId) {
    const trace = createD5ATrace_('resume');
    const job = await jobStore.getJob(jobId);
    if (!job) return finishD5A_(trace, { status: 'JOB_NOT_FOUND', errorCode: 'DURABLE_JOB_NOT_FOUND', jobId });
    trace.jobId = job.jobId;
    if (durableStatusD5A_(job) === 'COMPLETED') {
      const result = await jobStore.resumeCompletedJob({
        jobId: job.jobId,
        verification: { ledgerVerified: true, registryVerified: true, projectionVerified: true }
      });
      return finishD5A_(trace, {
        status: 'ALREADY_COMPLETED',
        resultCode: result.action || result.resultCode || 'IDEMPOTENT_COMPLETE_NOOP',
        job,
        adapterMutationCount: 0
      });
    }
    if (durableStatusD5A_(job) === 'RECONCILIATION_REQUIRED') {
      return finishD5A_(trace, {
        status: 'RECONCILIATION_REQUIRED_AUTO_RESUME_BLOCKED',
        resultCode: 'OWNER_REVIEW_REQUIRED',
        job,
        adapterMutationCount: 0
      });
    }
    return finishD5A_(trace, {
      status: 'RESUME_REQUIRES_SOURCE_INPUT',
      resultCode: 'SOURCE_INPUT_REQUIRED',
      job,
      adapterMutationCount: 0
    });
  }

  function adaptersD5A_() {
    return { driveEvidenceAdapter, hoaDonAdapter, ledgerAdapter, gmailProjectionAdapter };
  }

  return Object.freeze({
    executeDurableInvoiceJob,
    resumeDurableInvoiceJob
  });
}

async function runExternalStepD5A_(step) {
  const base = { stepName: step.stepName, status: D5A_STEP_RESULT_STATUSES_.NOT_ATTEMPTED, evidence: {}, errorCode: null };
  try {
    const current = normalizeD5AStepResult_(step.stepName, await step.read());
    if (current.status === D5A_STEP_RESULT_STATUSES_.CONFLICT) return recordD5AStep_(step.trace, current);
    if (isSuccessfulD5AStep_(current)) {
      const verifiedExisting = normalizeD5AStepResult_(step.stepName, await step.verify(), D5A_STEP_RESULT_STATUSES_.ALREADY_PRESENT);
      return recordD5AStep_(step.trace, isSuccessfulD5AStep_(verifiedExisting) ? { ...verifiedExisting, status: D5A_STEP_RESULT_STATUSES_.ALREADY_PRESENT } : verifiedExisting);
    }
    const written = normalizeD5AStepResult_(step.stepName, await step.write());
    if (!isSuccessfulD5AStep_(written)) return recordD5AStep_(step.trace, written);
    const verified = normalizeD5AStepResult_(step.stepName, await step.verify());
    return recordD5AStep_(step.trace, isSuccessfulD5AStep_(verified) ? { ...verified, status: D5A_STEP_RESULT_STATUSES_.CONFIRMED_WRITTEN } : verified);
  } catch (error) {
    return recordD5AStep_(step.trace, {
      ...base,
      status: error && (error.writeOutcome === 'UNKNOWN' || error.code === 'WRITE_OUTCOME_UNKNOWN')
        ? D5A_STEP_RESULT_STATUSES_.OUTCOME_UNKNOWN
        : D5A_STEP_RESULT_STATUSES_.FAILED,
      errorCode: d5aErrorCode_(error)
    });
  }
}

async function reconciliationHandoffD5A_(jobStore, reconciliationService, trace, job, commitPlan, stepResult, snapshotBuilder, adapters) {
  const safeResult = normalizeD5AStepResult_(stepResult.stepName || 'UNKNOWN', stepResult);
  recordD5AStep_(trace, safeResult);
  const snapshot = await snapshotBuilder(job, commitPlan, adapters);
  const report = callD5AReconciler_(reconciliationService, snapshot);
  let latestJob = cloneD5AJson_(job);
  try {
    const saved = await jobStore.saveReconciliationReport({
      jobId: latestJob.jobId,
      expectedVersion: Number(latestJob.version),
      report: {
        ...report,
        jobId: latestJob.jobId,
        jobVersion: Number(latestJob.version),
        inputSnapshotVersion: 'D5A_LOCAL_SNAPSHOT_V1'
      }
    });
    latestJob = cloneD5AJson_(saved.job || latestJob);
  } catch (error) {
    trace.reconciliationSaveErrorCode = d5aErrorCode_(error);
    latestJob = cloneD5AJson_(await jobStore.getJob(latestJob.jobId) || latestJob);
  }

  const fromStatus = durableStatusD5A_(latestJob);
  if (['FILES_SAVED', 'COMMITTING', 'ROWS_COMMITTED', 'PROJECTIONS_COMMITTED'].includes(fromStatus)) {
    try {
      latestJob = await transitionD5A_(jobStore, trace, latestJob, fromStatus, 'RECONCILIATION_REQUIRED', 'RECONCILIATION_REQUIRED');
    } catch (error) {
      trace.reconciliationTransitionErrorCode = d5aErrorCode_(error);
    }
  }
  await appendD5AAudit_(jobStore, trace, latestJob, 'RECONCILIATION_REQUIRED', {
    stepName: safeResult.stepName,
    errorCode: safeResult.errorCode || safeResult.status
  });
  return finishD5A_(trace, {
    status: 'RECONCILIATION_REQUIRED',
    resultCode: safeResult.errorCode || safeResult.status,
    job: latestJob,
    report,
    adapterMutationCount: countAdapterMutationsD5A_(adapters)
  });
}

async function transitionD5A_(jobStore, trace, job, fromStatus, toStatus, idempotencySuffix) {
  const currentStatus = durableStatusD5A_(job);
  if (currentStatus !== fromStatus) {
    const error = new Error('DURABLE_JOB_VERSION_CONFLICT:expected ' + fromStatus + ' got ' + currentStatus);
    error.code = 'DURABLE_JOB_VERSION_CONFLICT';
    throw error;
  }
  const result = await jobStore.transitionJob({
    jobId: job.jobId,
    expectedVersion: Number(job.version),
    fromStatus,
    toStatus,
    idempotencyKey: job.jobId + ':' + idempotencySuffix,
    patch: { lastLocalOrchestrationStep: idempotencySuffix }
  });
  const nextJob = cloneD5AJson_(result.job || result);
  trace.transitions.push({ fromStatus, toStatus, version: nextJob.version });
  return nextJob;
}

async function appendD5AAudit_(jobStore, trace, job, eventType, safeDetails) {
  try {
    const event = await jobStore.appendAuditEvent({
      jobId: job.jobId,
      eventType,
      actorType: 'D5A_LOCAL_ORCHESTRATOR',
      occurredAt: 'D5A_CLOCKED_EVENT',
      safeDetails: sanitizeD5ADetails_(safeDetails || {})
    });
    trace.auditEvents.push(eventType);
    return event;
  } catch (error) {
    trace.auditErrors.push({ eventType, errorCode: d5aErrorCode_(error) });
    return null;
  }
}

function buildD5ACommitPlan_(job, validated, sourceSnapshot) {
  const payload = cloneD5AJson_((validated && (validated.commitPlanInput || validated.invoice || validated)) || {});
  payload.jobId = job.jobId;
  payload.legacyInvoiceKey = payload.legacyInvoiceKey || sourceSnapshot.legacyInvoiceKey;
  payload.invoiceKeyV2 = payload.invoiceKeyV2 || sourceSnapshot.invoiceKeyV2;
  if (typeof buildDurableCommitPlan_ !== 'function') throw new Error('D5A_BUILD_COMMIT_PLAN_HELPER_MISSING');
  const base = buildDurableCommitPlan_(payload);
  const commitPlanHash = hashD5AString_(stableD5AJson_(base));
  return {
    ...base,
    commitPlanHash,
    invoiceKeyHash: hashD5AString_(base.invoiceKeyV2),
    lineIdentityList: base.lineIdentityV2s.slice(),
    lineHashList: base.legacyHashIndexes.slice(),
    projectionState: 'EXPECT_SAVED_LABEL'
  };
}

async function buildObservedD5ASnapshot_(job, commitPlan, adapters) {
  const driveEvidence = typeof adapters.driveEvidenceAdapter.buildSnapshot === 'function'
    ? await adapters.driveEvidenceAdapter.buildSnapshot({ commitPlan, job })
    : [];
  const hoaDonRows = typeof adapters.hoaDonAdapter.buildSnapshot === 'function'
    ? await adapters.hoaDonAdapter.buildSnapshot({ commitPlan, job })
    : [];
  const ledgerRows = typeof adapters.ledgerAdapter.buildSnapshot === 'function'
    ? await adapters.ledgerAdapter.buildSnapshot({ commitPlan, job })
    : [];
  const gmailLabels = typeof adapters.gmailProjectionAdapter.buildSnapshot === 'function'
    ? await adapters.gmailProjectionAdapter.buildSnapshot({ commitPlan, job })
    : [];
  return {
    job: { ...cloneD5AJson_(job), state: durableStatusD5A_(job), commitPlan: cloneD5AJson_(commitPlan) },
    commitPlan: cloneD5AJson_(commitPlan),
    observed: { driveEvidence, hoaDonRows, ledgerRows, gmailLabels },
    generatedAt: 'D5A_LOCAL_REPORT'
  };
}

function callD5AReconciler_(service, snapshot) {
  if (typeof service === 'function') return service(snapshot);
  if (service && typeof service.reconcileDurableInvoiceJobReportOnly === 'function') return service.reconcileDurableInvoiceJobReportOnly(snapshot);
  if (typeof reconcileDurableInvoiceJobReportOnly === 'function') return reconcileDurableInvoiceJobReportOnly(snapshot);
  throw new Error('D5A_RECONCILIATION_SERVICE_REQUIRED');
}

function normalizeD5AStepResult_(stepName, result, defaultSuccessStatus) {
  const raw = result || {};
  let status = raw.status || raw.resultCode || D5A_STEP_RESULT_STATUSES_.CONFIRMED_NOT_WRITTEN;
  if (status === 'MATCH' || status === 'FOUND_MATCH') status = defaultSuccessStatus || D5A_STEP_RESULT_STATUSES_.ALREADY_PRESENT;
  if (status === 'NOT_FOUND' || status === 'ABSENT') status = D5A_STEP_RESULT_STATUSES_.CONFIRMED_NOT_WRITTEN;
  if (status === 'WRITTEN' || status === 'VERIFIED') status = D5A_STEP_RESULT_STATUSES_.CONFIRMED_WRITTEN;
  return {
    stepName,
    status,
    evidence: cloneD5AJson_(raw.evidence || {}),
    errorCode: raw.errorCode || null
  };
}

function recordD5AStep_(trace, result) {
  const safe = cloneD5AJson_(result);
  if (!trace.stepResults.some(item => item.stepName === safe.stepName && item.status === safe.status && item.errorCode === safe.errorCode)) {
    trace.stepResults.push(safe);
  }
  return safe;
}

function isSuccessfulD5AStep_(result) {
  return result && [
    D5A_STEP_RESULT_STATUSES_.CONFIRMED_WRITTEN,
    D5A_STEP_RESULT_STATUSES_.ALREADY_PRESENT
  ].includes(result.status);
}

function finishD5A_(trace, result) {
  return {
    ...cloneD5AJson_(result),
    localOnly: D5A_LOCAL_ONLY,
    executionOrder: D5A_EXECUTION_ORDER_.join('_'),
    stepResults: cloneD5AJson_(trace.stepResults),
    auditEvents: cloneD5AJson_(trace.auditEvents),
    auditErrors: cloneD5AJson_(trace.auditErrors),
    transitions: cloneD5AJson_(trace.transitions)
  };
}

function createD5ATrace_(mode) {
  return { mode, jobId: '', stepResults: [], auditEvents: [], auditErrors: [], transitions: [] };
}

function durableStatusD5A_(job) {
  return safeD5AString_(job && (job.status || job.state));
}

function d5aLineCount_(validated) {
  const input = validated && (validated.commitPlanInput || validated.invoice || validated);
  return Array.isArray(input && input.lines) ? input.lines.length : 0;
}

function normalizeD5ALabels_(value) {
  return (Array.isArray(value) ? value : []).map(label => safeD5AString_(label).toUpperCase());
}

function countAdapterMutationsD5A_(adapters) {
  return Object.keys(adapters || {}).reduce((total, key) => {
    const adapter = adapters[key];
    return total + (typeof adapter.mutationCount === 'function' ? Number(adapter.mutationCount()) : 0);
  }, 0);
}

function sanitizeD5ADetails_(value) {
  if (Array.isArray(value)) return value.map(sanitizeD5ADetails_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      out[key] = sanitizeD5ADetails_(value[key]);
    });
    return out;
  }
  const text = safeD5AString_(value);
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const oauthMarker = ['oa', 'uth'].join('');
  const tokenMarker = ['to', 'ken'].join('');
  const keyMarker = ['private', 'key'].join('[_-]?');
  const blockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  if (new RegExp(oauthMarker + '|' + tokenMarker + '|' + keyMarker + '|' + blockMarker, 'i').test(text)) return 'REDACTED_SECRET';
  return text.length > 80 ? 'REDACTED_LONG_TEXT_' + hashD5AString_(text) : text;
}

function requireD5AObject_(value, name) {
  if (!value || typeof value !== 'object' && typeof value !== 'function') throw new Error('D5A_DEPENDENCY_REQUIRED:' + name);
  return value;
}

function requireD5AAdapter_(adapter, name, methods) {
  requireD5AObject_(adapter, name);
  methods.forEach(method => {
    if (typeof adapter[method] !== 'function') throw new Error('D5A_ADAPTER_METHOD_REQUIRED:' + name + '.' + method);
  });
  return adapter;
}

function d5aErrorCode_(error) {
  return safeD5AString_(error && (error.code || error.message || error)).replace(/[^A-Z0-9_]/gi, '_').toUpperCase().slice(0, 80) || 'D5A_UNKNOWN_ERROR';
}

function safeD5AString_(value) {
  return value == null ? '' : String(value);
}

function cloneD5AJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableD5AJson_(value) {
  function normalize(v) {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') {
      const out = {};
      Object.keys(v).sort().forEach(key => {
        out[key] = normalize(v[key]);
      });
      return out;
    }
    return v;
  }
  return JSON.stringify(normalize(value));
}

function hashD5AString_(value) {
  const text = safeD5AString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
