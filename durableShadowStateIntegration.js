const D5E_LOCAL_ONLY = true;
const D5E_EXECUTION_MODE_ = 'SHADOW';
const D5E_PRODUCTION_MUTATION_ALLOWED_ = false;
const D5E_INPUT_SNAPSHOT_VERSION_ = 'D5E_SHADOW_STATE_SNAPSHOT_V1';
const D5E_REPORT_REPAIR_POLICY_ = 'REPORT_ONLY';
const D5E_D2_STORE_FACTORY_CONTRACT_ = 'createDurableInvoiceJobStore';

const D5E_SHADOW_STATUSES_ = Object.freeze({
  READY: 'READY',
  REVIEW_REQUIRED: 'REVIEW_REQUIRED',
  CONFLICT: 'CONFLICT',
  FAILED: 'FAILED'
});

const D5E_AUDIT_EVENTS_ = Object.freeze([
  'SHADOW_CANDIDATE_DISCOVERED',
  'SHADOW_SOURCE_NORMALIZED',
  'SHADOW_IDENTITY_DERIVED',
  'SHADOW_JOB_CREATED',
  'SHADOW_JOB_REUSED',
  'SHADOW_COMMIT_PLAN_SAVED',
  'SHADOW_COMMIT_PLAN_REUSED',
  'SHADOW_RECONCILIATION_RECORDED',
  'SHADOW_REVIEW_REQUIRED',
  'SHADOW_EVALUATION_COMPLETED'
]);

const D5E_PRODUCTION_COMMIT_STATES_ = Object.freeze([
  'FILES_SAVED',
  'COMMITTING',
  'ROWS_COMMITTED',
  'PROJECTIONS_COMMITTED',
  'COMPLETED'
]);

const D5E_RETENTION_AND_SANITIZATION_POLICY_ = Object.freeze({
  invoiceJobs: 'retain according to audit policy',
  events: 'bounded append-only events with archive policy',
  reconciliationReports: 'retain latest plus audit-required history',
  ttlCandidate: 'short-lived local discovery candidate only',
  safeFieldAllowlist: ['jobId', 'invoiceIdentityHash', 'sourceReferenceHash', 'executionMode', 'shadowEvaluationStatus'],
  piiExclusion: true,
  rawIdExclusion: true,
  rawSourcePayloadPersisted: false,
  maximumDocumentSize: 'future Firestore limit guard',
  maximumEventCountPerJob: 40
});

function createDurableShadowStateIntegration(options) {
  const opts = options || {};
  const jobStore = requireD5EObject_(opts.jobStore, 'jobStore');
  const reconciliationService = requireD5EObject_(opts.reconciliationService, 'reconciliationService');
  const clock = requireD5EAdapter_(opts.clock, 'clock', ['now']);
  const shadowRunner = opts.shadowRunner || createD5EShadowRunner_(opts);
  const eventLedger = Object.create(null);
  const eventKeys = Object.create(null);
  const latestReports = Object.create(null);

  ['createJobIfAbsent', 'getJob', 'saveCommitPlanIfAbsent', 'transitionJob', 'appendAuditEvent', 'saveReconciliationReport', 'getLatestReconciliationReport'].forEach(name => {
    if (typeof jobStore[name] !== 'function') throw new Error('D5E_JOB_STORE_METHOD_REQUIRED:' + name);
  });

  async function runShadowBatch(batchOptions) {
    const safeOptions = batchOptions || {};
    const rawCandidates = [];
    const results = [];
    const failures = [];

    try {
      rawCandidates.push(...await discoverD5ECandidates_(opts.gmailCandidateAdapter, 'GMAIL', safeOptions));
    } catch (error) {
      failures.push(failedD5EResult_('GMAIL_DISCOVERY_FAILED', error));
    }
    try {
      rawCandidates.push(...await discoverD5ECandidates_(opts.driveCandidateAdapter, 'DRIVE', safeOptions));
    } catch (error) {
      failures.push(failedD5EResult_('DRIVE_DISCOVERY_FAILED', error));
    }

    const ordered = rawCandidates
      .map(sanitizeD5ECandidate_)
      .sort(compareD5ECandidates_)
      .slice(0, Number(safeOptions.candidateLimit || rawCandidates.length || 0));

    for (const candidate of ordered) {
      results.push(await evaluateShadowCandidate(candidate));
    }

    results.push(...failures);
    const uniqueJobIds = new Set(results.map(result => result.jobId).filter(Boolean));
    return {
      executionMode: D5E_EXECUTION_MODE_,
      productionMutationAllowed: D5E_PRODUCTION_MUTATION_ALLOWED_,
      localOnly: D5E_LOCAL_ONLY,
      discoveredCount: rawCandidates.length,
      evaluatedCount: results.length,
      uniqueJobCount: uniqueJobIds.size,
      readyCount: results.filter(result => result.shadowEvaluationStatus === D5E_SHADOW_STATUSES_.READY).length,
      reviewRequiredCount: results.filter(result => result.shadowEvaluationStatus === D5E_SHADOW_STATUSES_.REVIEW_REQUIRED).length,
      conflictCount: results.filter(result => result.shadowEvaluationStatus === D5E_SHADOW_STATUSES_.CONFLICT).length,
      failedCount: results.filter(result => result.shadowEvaluationStatus === D5E_SHADOW_STATUSES_.FAILED).length,
      mutationAttemptCount: 0,
      results: results.sort(compareD5EResults_)
    };
  }

  async function evaluateShadowCandidate(candidate) {
    const safeCandidate = sanitizeD5ECandidate_(candidate);
    const predictedJobId = predictD5EJobIdFromCandidate_(safeCandidate);
    const preRunnerJob = predictedJobId ? await safeD5EGetJob_(jobStore, predictedJobId) : null;
    let runnerResult;
    try {
      runnerResult = await shadowRunner.evaluateShadowCandidate(safeCandidate);
    } catch (error) {
      return failedD5EResult_('SHADOW_RUNNER_FAILED', error, safeCandidate);
    }

    const jobId = safeD5EString_(runnerResult && runnerResult.jobId);
    if (!jobId) return normalizeD5EResult_(runnerResult, safeCandidate, null, null, mergeD5EFindingCodes_(runnerResult, null, ['JOB_ID_NOT_DERIVED']));

    const auditErrors = [];
    await appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, 'SHADOW_CANDIDATE_DISCOVERED', safeCandidate.sourceReferenceHash, {
      sourceType: safeCandidate.sourceType,
      sourceReferenceHash: safeCandidate.sourceReferenceHash
    });
    await appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, 'SHADOW_SOURCE_NORMALIZED', safeCandidate.sourceReferenceHash, {
      sourceType: safeCandidate.sourceType
    });
    await appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, 'SHADOW_IDENTITY_DERIVED', runnerResult.commitPlanHash || safeCandidate.sourceReferenceHash, {
      invoiceIdentityHash: hashD5EValue_(jobId)
    });
    await appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, preRunnerJob ? 'SHADOW_JOB_REUSED' : 'SHADOW_JOB_CREATED', 'job', {
      status: preRunnerJob ? safeD5EStatus_(preRunnerJob) : 'DETECTED'
    });
    await appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, runnerResult.commitPlanHash ? 'SHADOW_COMMIT_PLAN_SAVED' : 'SHADOW_COMMIT_PLAN_REUSED', runnerResult.commitPlanHash || 'plan', {
      commitPlanHash: runnerResult.commitPlanHash || ''
    });

    let job = await safeD5EGetJob_(jobStore, jobId);
    const transition = await advanceShadowObservationState_(jobStore, job, auditErrors);
    job = transition.job || await safeD5EGetJob_(jobStore, jobId);
    const reportResult = await recordShadowReconciliationReport_(jobStore, reconciliationService, latestReports, job, clock, auditErrors);
    const findingCodes = mergeD5EFindingCodes_(runnerResult, reportResult.report, auditErrors);
    const hasReview = findingCodes.includes('COMMIT_PLAN_MISMATCH') ||
      findingCodes.includes('DURABLE_JOB_VERSION_CONFLICT') ||
      findingCodes.some(code => code.indexOf('IMMUTAB') >= 0);
    const hasFailure = auditErrors.length > 0 || reportResult.errorCode;
    const status = hasFailure
      ? D5E_SHADOW_STATUSES_.FAILED
      : hasReview
        ? D5E_SHADOW_STATUSES_.REVIEW_REQUIRED
        : D5E_SHADOW_STATUSES_.READY;

    if (status !== D5E_SHADOW_STATUSES_.READY) {
      await appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, 'SHADOW_REVIEW_REQUIRED', findingCodes.join(';') || status, {
        findingCodes
      });
    }
    await appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, 'SHADOW_RECONCILIATION_RECORDED', reportResult.reportId || 'report', {
      reportStatus: reportResult.status || ''
    });
    await appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, 'SHADOW_EVALUATION_COMPLETED', safeCandidate.sourceReferenceHash, {
      shadowEvaluationStatus: status
    });

    return normalizeD5EResult_(runnerResult, safeCandidate, job, reportResult.report, findingCodes, {
      shadowEvaluationStatus: status,
      auditErrorCount: auditErrors.length,
      transitionCount: transition.transitionCount || 0
    });
  }

  async function getDurableJob(jobId) {
    return sanitizeD5EStoredJob_(await jobStore.getJob(jobId));
  }

  function listAuditEvents(jobId) {
    return cloneD5EJson_(eventLedger[safeD5EString_(jobId)] || []);
  }

  async function getLatestReconciliationReport(jobId) {
    const id = safeD5EString_(jobId);
    if (latestReports[id]) return cloneD5EJson_(latestReports[id]);
    const stored = await jobStore.getLatestReconciliationReport(id);
    return sanitizeD5EReport_(stored);
  }

  return Object.freeze({
    runShadowBatch,
    evaluateShadowCandidate,
    getDurableJob,
    listAuditEvents,
    getLatestReconciliationReport
  });
}

function predictD5EJobIdFromCandidate_(candidate) {
  const key = candidate && candidate.safeMetadata && candidate.safeMetadata.syntheticInvoiceKey;
  if (!key) return '';
  return 'job_' + hashD5EValue_('syntheticIdentity' + key);
}

function createD5EShadowRunner_(opts) {
  if (typeof createDurableScannerShadowRunner !== 'function') throw new Error('D5E_D5B_RUNNER_REQUIRED');
  return createDurableScannerShadowRunner({
    gmailCandidateAdapter: requireD5EAdapter_(opts.gmailCandidateAdapter, 'gmailCandidateAdapter', ['discoverCandidates']),
    driveCandidateAdapter: requireD5EAdapter_(opts.driveCandidateAdapter, 'driveCandidateAdapter', ['discoverCandidates']),
    sourceNormalizer: requireD5EAdapter_(opts.sourceNormalizer, 'sourceNormalizer', ['normalizeCandidate']),
    identityBuilder: requireD5EAdapter_(opts.identityBuilder, 'identityBuilder', ['buildIdentity']),
    commitPlanBuilder: opts.commitPlanBuilder,
    jobStore: opts.jobStore,
    reconciliationService: opts.reconciliationService,
    clock: opts.clock
  });
}

async function discoverD5ECandidates_(adapter, sourceType, options) {
  if (!adapter || typeof adapter.discoverCandidates !== 'function') return [];
  const candidates = await adapter.discoverCandidates({ ...cloneD5EJson_(options || {}), sourceType });
  return (Array.isArray(candidates) ? candidates : []).map(candidate => ({ ...candidate, sourceType: candidate.sourceType || sourceType }));
}

async function advanceShadowObservationState_(jobStore, job, auditErrors) {
  let current = cloneD5EJson_(job);
  let transitionCount = 0;
  const chain = [
    ['DETECTED', 'COLLECTED', 'SHADOW_SOURCE_COLLECTED'],
    ['COLLECTED', 'PARSED', 'SHADOW_SOURCE_PARSED'],
    ['PARSED', 'VALIDATED', 'SHADOW_SOURCE_VALIDATED']
  ];
  for (const [fromStatus, toStatus, key] of chain) {
    if (!current || safeD5EStatus_(current) !== fromStatus) continue;
    try {
      const transitioned = await jobStore.transitionJob({
        jobId: current.jobId,
        expectedVersion: Number(current.version),
        fromStatus,
        toStatus,
        idempotencyKey: current.jobId + ':' + key,
        patch: {
          executionMode: D5E_EXECUTION_MODE_,
          productionMutationAllowed: false,
          shadowEvaluationStatus: D5E_SHADOW_STATUSES_.READY
        }
      });
      current = cloneD5EJson_(transitioned.job || transitioned);
      transitionCount += 1;
    } catch (error) {
      auditErrors.push(safeD5EErrorCode_(error));
      break;
    }
  }
  return { job: current, transitionCount };
}

async function recordShadowReconciliationReport_(jobStore, reconciliationService, latestReports, job, clock, auditErrors) {
  if (!job) return { errorCode: 'JOB_MISSING', report: null, blockerCount: 1 };
  const commitPlan = cloneD5EJson_(job.commitPlan || null);
  const snapshot = {
    job: { ...cloneD5EJson_(job), state: safeD5EStatus_(job), commitPlan },
    commitPlan,
    observed: { driveEvidence: [], hoaDonRows: [], ledgerRows: [], gmailLabels: [] },
    generatedAt: clock.now()
  };
  let baseReport;
  try {
    baseReport = callD5EReconciler_(reconciliationService, snapshot);
  } catch (error) {
    auditErrors.push(safeD5EErrorCode_(error));
    return { errorCode: safeD5EErrorCode_(error), report: null, blockerCount: 1 };
  }
  const report = sanitizeD5EReport_({
    ...baseReport,
    jobId: job.jobId,
    jobVersion: Number(job.version || 0),
    generatedAt: baseReport.generatedAt || clock.now(),
    inputSnapshotVersion: D5E_INPUT_SNAPSHOT_VERSION_,
    executionMode: D5E_EXECUTION_MODE_,
    repairPolicy: D5E_REPORT_REPAIR_POLICY_
  });
  try {
    const saved = await jobStore.saveReconciliationReport({
      jobId: job.jobId,
      expectedVersion: Number(job.version),
      report
    });
    const savedReport = sanitizeD5EReport_((saved && saved.report) || report);
    latestReports[job.jobId] = {
      ...savedReport,
      executionMode: D5E_EXECUTION_MODE_,
      repairPolicy: D5E_REPORT_REPAIR_POLICY_,
      inputSnapshotVersion: D5E_INPUT_SNAPSHOT_VERSION_
    };
    return {
      report: latestReports[job.jobId],
      reportId: latestReports[job.jobId].reportId,
      status: latestReports[job.jobId].status,
      blockerCount: latestReports[job.jobId].blockerCount
    };
  } catch (error) {
    auditErrors.push(safeD5EErrorCode_(error));
    return { errorCode: safeD5EErrorCode_(error), report, blockerCount: Number(report.blockerCount || 0) };
  }
}

async function appendShadowAudit_(jobStore, eventLedger, eventKeys, auditErrors, jobId, eventType, key, safeDetails) {
  const id = safeD5EString_(jobId);
  const type = safeD5ECode_(eventType);
  const dedupeKey = id + ':' + type + ':' + safeD5EHash_(key || type);
  eventKeys[id] = eventKeys[id] || Object.create(null);
  eventLedger[id] = eventLedger[id] || [];
  if (eventKeys[id][dedupeKey]) return eventKeys[id][dedupeKey];
  try {
    const appended = await jobStore.appendAuditEvent({
      jobId: id,
      eventType: type,
      actorType: 'D5E_LOCAL_SHADOW_STATE_INTEGRATION',
      occurredAt: 'D5E_CLOCKED_EVENT',
      safeDetails: sanitizeD5EDetails_(safeDetails || {})
    });
    const event = sanitizeD5EEvent_((appended && appended.event) || appended || { eventType: type, jobId: id });
    eventKeys[id][dedupeKey] = event;
    if (eventLedger[id].length < D5E_RETENTION_AND_SANITIZATION_POLICY_.maximumEventCountPerJob) eventLedger[id].push(event);
    return event;
  } catch (error) {
    auditErrors.push(safeD5EErrorCode_(error));
    return null;
  }
}

function normalizeD5EResult_(runnerResult, candidate, job, report, findingCodes, extra) {
  const source = runnerResult || {};
  const codes = (findingCodes && findingCodes.length ? findingCodes : mergeD5EFindingCodes_(source, report, [])).sort();
  const status = (extra && extra.shadowEvaluationStatus) || (
    source.status === 'SHADOW_FAILED'
      ? D5E_SHADOW_STATUSES_.FAILED
      : source.status === 'SHADOW_REVIEW_REQUIRED'
        ? D5E_SHADOW_STATUSES_.REVIEW_REQUIRED
        : codes.some(code => code.indexOf('CONFLICT') >= 0 || code.indexOf('IMMUTAB') >= 0)
        ? D5E_SHADOW_STATUSES_.REVIEW_REQUIRED
        : D5E_SHADOW_STATUSES_.READY
  );
  return {
    status: source.status || '',
    shadowEvaluationStatus: status,
    executionMode: D5E_EXECUTION_MODE_,
    productionMutationAllowed: D5E_PRODUCTION_MUTATION_ALLOWED_,
    jobId: safeD5EString_(source.jobId),
    durableJobStatus: safeD5EStatus_(job),
    commitPlanHash: safeD5EHash_(source.commitPlanHash),
    expectedLineCount: Number(source.expectedLineCount || (job && job.commitPlan && job.commitPlan.expectedLineCount) || 0),
    sourceType: safeD5ECode_(candidate && candidate.sourceType),
    sourceReferenceHash: safeD5EHash_(candidate && candidate.sourceReferenceHash),
    sourceConvergence: safeD5EString_(source.sourceConvergence || ''),
    reconciliationStatus: safeD5EString_(report && report.status || ''),
    findingCount: Number(report && report.findingCount || codes.length || 0),
    blockerCount: Number(report && report.blockerCount || 0),
    findingCodes: codes,
    repairPolicy: D5E_REPORT_REPAIR_POLICY_,
    mutationAttemptCount: 0,
    productionFirestoreAccess: 'NONE',
    productionFirestoreWrite: 'NONE',
    gmailApiCall: 'NONE',
    driveApiCall: 'NONE',
    sheetsApiCall: 'NONE',
    auditErrorCount: Number(extra && extra.auditErrorCount || 0),
    transitionCount: Number(extra && extra.transitionCount || 0)
  };
}

function mergeD5EFindingCodes_(runnerResult, report, auditErrors) {
  const codes = [];
  (Array.isArray(runnerResult && runnerResult.findings) ? runnerResult.findings : []).forEach(finding => {
    const code = safeD5ECode_(finding && finding.code);
    if (code) codes.push(code);
  });
  (Array.isArray(report && report.findings) ? report.findings : []).forEach(finding => {
    const code = safeD5ECode_(finding && finding.code);
    if (code) codes.push(code);
  });
  (auditErrors || []).forEach(code => {
    if (code) codes.push(safeD5ECode_(code));
  });
  return Array.from(new Set(codes)).sort();
}

function failedD5EResult_(scope, error, candidate) {
  return {
    status: 'SHADOW_FAILED',
    shadowEvaluationStatus: D5E_SHADOW_STATUSES_.FAILED,
    executionMode: D5E_EXECUTION_MODE_,
    productionMutationAllowed: D5E_PRODUCTION_MUTATION_ALLOWED_,
    jobId: '',
    commitPlanHash: '',
    sourceType: safeD5ECode_(candidate && candidate.sourceType),
    sourceReferenceHash: safeD5EHash_(candidate && candidate.sourceReferenceHash),
    findingCodes: [safeD5ECode_(scope), safeD5EErrorCode_(error)].filter(Boolean).sort(),
    repairPolicy: D5E_REPORT_REPAIR_POLICY_,
    mutationAttemptCount: 0,
    productionFirestoreAccess: 'NONE',
    productionFirestoreWrite: 'NONE',
    gmailApiCall: 'NONE',
    driveApiCall: 'NONE',
    sheetsApiCall: 'NONE',
    errorCode: safeD5EErrorCode_(error)
  };
}

function sanitizeD5ECandidate_(candidate) {
  const source = cloneD5EJson_(candidate || {});
  const sourceType = safeD5ECode_(source.sourceType);
  if (!['GMAIL', 'DRIVE'].includes(sourceType)) throw new Error('D5E_CANDIDATE_SOURCE_TYPE_INVALID');
  const sourceReferenceHash = safeD5EHash_(source.sourceReferenceHash || source.sourceHash || '');
  if (!sourceReferenceHash) throw new Error('D5E_CANDIDATE_SOURCE_REFERENCE_HASH_REQUIRED');
  return {
    sourceType,
    sourceReferenceHash,
    discoveredAt: safeD5EString_(source.discoveredAt || 'D5E_LOCAL_DISCOVERY'),
    attachmentSummary: sanitizeD5EDetails_(source.attachmentSummary || {}),
    safeMetadata: sanitizeD5EDetails_(source.safeMetadata || {})
  };
}

function sanitizeD5EStoredJob_(job) {
  if (!job) return null;
  const safe = cloneD5EJson_(job);
  delete safe.rawGmailId;
  delete safe.rawDriveId;
  delete safe.emailBody;
  delete safe.xmlText;
  delete safe.pdfText;
  return sanitizeD5EDetails_(safe);
}

function sanitizeD5EReport_(report) {
  if (!report) return null;
  const safe = sanitizeD5EDetails_(report);
  return {
    ...safe,
    executionMode: safe.executionMode || D5E_EXECUTION_MODE_,
    repairPolicy: safe.repairPolicy || D5E_REPORT_REPAIR_POLICY_
  };
}

function sanitizeD5EEvent_(event) {
  return sanitizeD5EDetails_(event || {});
}

function sanitizeD5EDetails_(value) {
  if (Array.isArray(value)) return value.map(sanitizeD5EDetails_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if (/raw|body|xmlText|pdfText|payload|content/i.test(key) && !/Hash|Count|Captured/i.test(key)) return;
      out[key] = sanitizeD5EDetails_(value[key]);
    });
    return out;
  }
  const text = safeD5EString_(value);
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const tokenMarker = ['to', 'ken'].join('');
  const keyMarker = ['private', 'key'].join('[_-]?');
  const blockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  if (new RegExp(tokenMarker + '|oauth|' + keyMarker + '|' + blockMarker, 'i').test(text)) return 'REDACTED_SECRET';
  return text.length > 80 ? 'REDACTED_LONG_TEXT_' + hashD5EValue_(text) : text;
}

function callD5EReconciler_(service, snapshot) {
  if (typeof service === 'function') return cloneD5EJson_(service(snapshot));
  if (service && typeof service.reconcileDurableInvoiceJobReportOnly === 'function') return cloneD5EJson_(service.reconcileDurableInvoiceJobReportOnly(snapshot));
  if (typeof reconcileDurableInvoiceJobReportOnly === 'function') return cloneD5EJson_(reconcileDurableInvoiceJobReportOnly(snapshot));
  throw new Error('D5E_RECONCILIATION_SERVICE_REQUIRED');
}

async function safeD5EGetJob_(jobStore, jobId) {
  try {
    return cloneD5EJson_(await jobStore.getJob(jobId));
  } catch (_error) {
    return null;
  }
}

function compareD5ECandidates_(a, b) {
  return [a.discoveredAt, a.sourceType, a.sourceReferenceHash].join('|').localeCompare([b.discoveredAt, b.sourceType, b.sourceReferenceHash].join('|'));
}

function compareD5EResults_(a, b) {
  return [a.jobId, a.sourceType, a.sourceReferenceHash, a.shadowEvaluationStatus].join('|').localeCompare([b.jobId, b.sourceType, b.sourceReferenceHash, b.shadowEvaluationStatus].join('|'));
}

function requireD5EObject_(value, name) {
  if (!value || typeof value !== 'object' && typeof value !== 'function') throw new Error('D5E_DEPENDENCY_REQUIRED:' + name);
  return value;
}

function requireD5EAdapter_(adapter, name, methods) {
  requireD5EObject_(adapter, name);
  methods.forEach(method => {
    if (typeof adapter[method] !== 'function') throw new Error('D5E_ADAPTER_METHOD_REQUIRED:' + name + '.' + method);
  });
  return adapter;
}

function safeD5EStatus_(job) {
  return safeD5EString_(job && (job.status || job.state));
}

function safeD5EString_(value) {
  return value == null ? '' : String(value);
}

function safeD5ECode_(value) {
  return safeD5EString_(value).replace(/[^A-Z0-9_]/gi, '_').toUpperCase().slice(0, 100);
}

function safeD5EErrorCode_(error) {
  return safeD5ECode_(error && (error.code || error.message || error)) || 'D5E_UNKNOWN_ERROR';
}

function safeD5EHash_(value) {
  return safeD5EString_(value).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
}

function hashD5EValue_(value) {
  const text = safeD5EString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function cloneD5EJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
