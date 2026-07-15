const FIRESTORE_DURABLE_JOB_SCHEMA_VERSION_ = 'FIRESTORE_DURABLE_JOB_V1';
const FIRESTORE_DURABLE_EVENT_SCHEMA_VERSION_ = 'FIRESTORE_DURABLE_EVENT_V1';
const FIRESTORE_DURABLE_REPORT_SCHEMA_VERSION_ = 'FIRESTORE_DURABLE_REPORT_V1';

const FIRESTORE_DURABLE_ERROR_CODES_ = Object.freeze([
  'DURABLE_JOB_NOT_FOUND',
  'DURABLE_JOB_ALREADY_EXISTS',
  'DURABLE_JOB_VERSION_CONFLICT',
  'DURABLE_JOB_ILLEGAL_TRANSITION',
  'DURABLE_JOB_TERMINAL_STATE',
  'COMMIT_PLAN_MISSING',
  'COMMIT_PLAN_HASH_MISMATCH',
  'COMMIT_PLAN_IMMUTABILITY_VIOLATION',
  'AUDIT_EVENT_SEQUENCE_CONFLICT',
  'RECONCILIATION_REPORT_INVALID',
  'FIRESTORE_TRANSPORT_ERROR',
  'FIRESTORE_WRITE_UNCONFIRMED'
]);

function createDurableInvoiceJobStore(transport, options) {
  if (!transport) throw durableFirestoreError_('FIRESTORE_TRANSPORT_ERROR', 'transport required');
  const clock = (options && options.clock) || null;
  if (!clock || typeof clock.now !== 'function') throw durableFirestoreError_('FIRESTORE_TRANSPORT_ERROR', 'clock.now required');
  const rootCollection = (options && options.rootCollection) || 'invoiceJobs';

  async function createJobIfAbsent(seed) {
    const normalized = normalizeDurableFirestoreJobSeed_(seed, clock.now());
    const path = durableFirestoreJobPath_(rootCollection, normalized.jobId);
    return durableFirestoreWrite_(async () => transport.runTransaction(async tx => {
      const existing = await tx.getDocument(path);
      if (existing) {
        return { resultCode: 'JOB_ALREADY_EXISTS_IDEMPOTENT', created: false, job: cloneDurableFirestoreJson_(existing) };
      }
      await tx.createDocument(path, normalized, { idempotencyKey: normalized.jobId });
      return { resultCode: 'JOB_CREATED', created: true, job: cloneDurableFirestoreJson_(normalized) };
    }));
  }

  async function getJob(jobId) {
    const path = durableFirestoreJobPath_(rootCollection, jobId);
    return cloneDurableFirestoreJson_(await transport.getDocument(path));
  }

  async function saveCommitPlanIfAbsent(request) {
    const req = request || {};
    if (!req.commitPlan) throw durableFirestoreError_('COMMIT_PLAN_MISSING', 'commit plan required');
    const path = durableFirestoreJobPath_(rootCollection, req.jobId);
    const nextPlan = cloneDurableFirestoreJson_(req.commitPlan);
    const nextHash = durableFirestoreHashPrefix_(stableDurableFirestoreJson_(nextPlan));
    return durableFirestoreWrite_(async () => transport.runTransaction(async tx => {
      const current = await tx.getDocument(path);
      if (!current) throw durableFirestoreError_('DURABLE_JOB_NOT_FOUND', 'job not found');
      const currentHash = current.commitPlanHash || '';
      if (current.commitPlan) {
        const existingHash = durableFirestoreHashPrefix_(stableDurableFirestoreJson_(current.commitPlan));
        if (currentHash !== existingHash) throw durableFirestoreError_('COMMIT_PLAN_HASH_MISMATCH', 'stored commit plan hash mismatch');
        if (existingHash === nextHash) {
          return { resultCode: 'IDEMPOTENT_PLAN_MATCH', saved: false, job: cloneDurableFirestoreJson_(current) };
        }
        throw durableFirestoreError_('COMMIT_PLAN_IMMUTABILITY_VIOLATION', 'commit plan already saved');
      }
      assertDurableFirestoreExpectedVersion_(current, req.expectedVersion);
      const nextJob = {
        ...current,
        version: current.version + 1,
        commitPlan: nextPlan,
        commitPlanHash: nextHash,
        commitPlanVersion: safeDurableFirestoreString_(nextPlan.version),
        updatedAt: clock.now()
      };
      await tx.updateDocument(path, nextJob, { expectedVersion: current.version });
      return { resultCode: 'PLAN_SAVED', saved: true, job: cloneDurableFirestoreJson_(nextJob) };
    }));
  }

  async function transitionJob(request) {
    const req = request || {};
    const path = durableFirestoreJobPath_(rootCollection, req.jobId);
    return durableFirestoreWrite_(async () => transport.runTransaction(async tx => {
      const current = await tx.getDocument(path);
      if (!current) throw durableFirestoreError_('DURABLE_JOB_NOT_FOUND', 'job not found');
      const requestKey = safeDurableFirestoreString_(req.idempotencyKey);
      const requestKeyHash = requestKey ? durableFirestoreHashPrefix_(requestKey) : '';
      if (requestKeyHash && current.lastMutationIdempotencyKey === requestKeyHash && safeDurableFirestoreString_(current.status) === safeDurableFirestoreString_(req.toStatus)) {
        return { resultCode: 'IDEMPOTENT_TRANSITION_MATCH', job: cloneDurableFirestoreJson_(current) };
      }
      assertDurableFirestoreExpectedVersion_(current, req.expectedVersion);
      if (safeDurableFirestoreString_(current.status) !== safeDurableFirestoreString_(req.fromStatus)) {
        throw durableFirestoreError_('DURABLE_JOB_VERSION_CONFLICT', 'from status mismatch');
      }
      if (isDurableFirestoreTerminalState_(current.status)) {
        throw durableFirestoreError_('DURABLE_JOB_TERMINAL_STATE', 'terminal job cannot transition');
      }
      assertDurableFirestoreTransition_(current.status, req.toStatus);
      const patch = sanitizeDurableFirestoreJobPatch_(req.patch || {});
      const nextStatus = safeDurableFirestoreString_(req.toStatus);
      const nextJob = {
        ...current,
        ...patch,
        status: nextStatus,
        lastMutationIdempotencyKey: requestKeyHash || current.lastMutationIdempotencyKey || '',
        version: current.version + 1,
        updatedAt: clock.now(),
        completedAt: nextStatus === 'COMPLETED' ? clock.now() : (current.completedAt || null)
      };
      await tx.updateDocument(path, nextJob, { expectedVersion: current.version });
      return { resultCode: 'JOB_TRANSITIONED', job: cloneDurableFirestoreJson_(nextJob) };
    }));
  }

  async function appendAuditEvent(request) {
    const req = request || {};
    const jobPath = durableFirestoreJobPath_(rootCollection, req.jobId);
    const collectionPath = durableFirestoreEventsPath_(rootCollection, req.jobId);
    return durableFirestoreWrite_(async () => transport.runTransaction(async tx => {
      const current = await tx.getDocument(jobPath);
      if (!current) throw durableFirestoreError_('DURABLE_JOB_NOT_FOUND', 'job not found');
      const existing = await tx.queryDocuments(collectionPath);
      const sequence = (req.sequence != null) ? Number(req.sequence) : existing.length + 1;
      if (!Number.isInteger(sequence) || sequence <= 0) throw durableFirestoreError_('AUDIT_EVENT_SEQUENCE_CONFLICT', 'invalid sequence');
      if (existing.some(event => Number(event.sequence) === sequence)) {
        throw durableFirestoreError_('AUDIT_EVENT_SEQUENCE_CONFLICT', 'sequence already exists');
      }
      const event = normalizeDurableFirestoreEvent_(req, sequence, clock.now());
      await tx.appendDocument(collectionPath, event, { idempotencyKey: event.eventId });
      return { resultCode: 'AUDIT_EVENT_APPENDED', event: cloneDurableFirestoreJson_(event) };
    }));
  }

  async function saveReconciliationReport(request) {
    const req = request || {};
    const report = normalizeDurableFirestoreReport_(req.report, clock.now());
    const jobPath = durableFirestoreJobPath_(rootCollection, req.jobId || report.jobId);
    const collectionPath = durableFirestoreReportsPath_(rootCollection, req.jobId || report.jobId);
    return durableFirestoreWrite_(async () => transport.runTransaction(async tx => {
      const current = await tx.getDocument(jobPath);
      if (!current) throw durableFirestoreError_('DURABLE_JOB_NOT_FOUND', 'job not found');
      const reportPath = collectionPath + '/' + report.reportId;
      const existing = await tx.getDocument(reportPath);
      if (existing) {
        return { resultCode: 'RECONCILIATION_REPORT_IDEMPOTENT', report: cloneDurableFirestoreJson_(existing), job: cloneDurableFirestoreJson_(current) };
      }
      assertDurableFirestoreExpectedVersion_(current, req.expectedVersion);
      await tx.createDocument(reportPath, report, { idempotencyKey: report.reportId });
      const reconciliationStatus = report.blockerCount > 0 ? 'RECONCILIATION_REQUIRED' : report.status;
      const nextJob = {
        ...current,
        version: current.version + 1,
        reconciliationStatus,
        latestReconciliationReportId: report.reportId,
        updatedAt: clock.now()
      };
      await tx.updateDocument(jobPath, nextJob, { expectedVersion: current.version });
      return { resultCode: 'RECONCILIATION_REPORT_SAVED', report: cloneDurableFirestoreJson_(report), job: cloneDurableFirestoreJson_(nextJob) };
    }));
  }

  async function getLatestReconciliationReport(jobId) {
    const job = await getJob(jobId);
    if (!job || !job.latestReconciliationReportId) return null;
    return cloneDurableFirestoreJson_(await transport.getDocument(durableFirestoreReportsPath_(rootCollection, jobId) + '/' + job.latestReconciliationReportId));
  }

  async function markReconciliationRequired(request) {
    const req = request || {};
    const path = durableFirestoreJobPath_(rootCollection, req.jobId);
    return durableFirestoreWrite_(async () => transport.runTransaction(async tx => {
      const current = await tx.getDocument(path);
      if (!current) throw durableFirestoreError_('DURABLE_JOB_NOT_FOUND', 'job not found');
      assertDurableFirestoreExpectedVersion_(current, req.expectedVersion);
      const nextJob = {
        ...current,
        version: current.version + 1,
        reconciliationStatus: 'RECONCILIATION_REQUIRED',
        lastErrorCode: safeDurableFirestoreErrorCode_(req.errorCode || current.lastErrorCode || ''),
        lastErrorStage: safeDurableFirestoreString_(req.errorStage || current.lastErrorStage || ''),
        updatedAt: clock.now()
      };
      await tx.updateDocument(path, nextJob, { expectedVersion: current.version });
      return { resultCode: 'RECONCILIATION_REQUIRED_MARKED', job: cloneDurableFirestoreJson_(nextJob) };
    }));
  }

  async function resumeCompletedJob(request) {
    const job = await getJob((request || {}).jobId);
    if (!job) throw durableFirestoreError_('DURABLE_JOB_NOT_FOUND', 'job not found');
    if (job.status !== 'COMPLETED') return { resultCode: 'NOT_COMPLETED', safeToMutate: true, job };
    const verification = (request && request.verification) || {};
    if (typeof resolveDurableCompletedResume_ === 'function') {
      const result = resolveDurableCompletedResume_({ jobId: job.jobId, state: 'COMPLETED' }, verification);
      return { ...cloneDurableFirestoreJson_(result), job };
    }
    return { resultCode: 'IDEMPOTENT_COMPLETE_NOOP', action: 'IDEMPOTENT_COMPLETE_NOOP', safeToMutate: false, job };
  }

  return Object.freeze({
    createJobIfAbsent,
    getJob,
    saveCommitPlanIfAbsent,
    transitionJob,
    appendAuditEvent,
    saveReconciliationReport,
    getLatestReconciliationReport,
    markReconciliationRequired,
    resumeCompletedJob
  });
}

function normalizeDurableFirestoreJobSeed_(seed, now) {
  const source = seed || {};
  const identityHash = safeDurableFirestoreRequired_(source.invoiceIdentityHash, 'invoiceIdentityHash');
  const sourceThreadHash = safeDurableFirestoreRequired_(source.sourceThreadHash, 'sourceThreadHash');
  const jobId = safeDurableFirestoreString_(source.jobId || ('job_' + durableFirestoreHashPrefix_(identityHash + ':' + sourceThreadHash)));
  return {
    schemaVersion: FIRESTORE_DURABLE_JOB_SCHEMA_VERSION_,
    jobId,
    invoiceIdentityHash: durableFirestoreHashPrefix_(identityHash),
    sourceThreadHash: durableFirestoreHashPrefix_(sourceThreadHash),
    status: safeDurableFirestoreString_(source.status || 'DETECTED'),
    version: 1,
    commitPlan: null,
    commitPlanHash: '',
    commitPlanVersion: '',
    attemptCount: Number(source.attemptCount || 0),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    lastErrorCode: '',
    lastErrorStage: '',
    reconciliationStatus: 'NOT_RUN',
    latestReconciliationReportId: ''
  };
}

function normalizeDurableFirestoreEvent_(request, sequence, now) {
  return {
    schemaVersion: FIRESTORE_DURABLE_EVENT_SCHEMA_VERSION_,
    eventId: 'evt_' + String(sequence).padStart(6, '0'),
    jobId: safeDurableFirestoreString_(request.jobId),
    sequence,
    eventType: safeDurableFirestoreString_(request.eventType || 'EVENT'),
    fromStatus: safeDurableFirestoreString_(request.fromStatus || ''),
    toStatus: safeDurableFirestoreString_(request.toStatus || ''),
    actorType: safeDurableFirestoreString_(request.actorType || 'SYSTEM'),
    occurredAt: safeDurableFirestoreString_(request.occurredAt || now),
    errorCode: safeDurableFirestoreErrorCode_(request.errorCode || ''),
    safeDetails: sanitizeDurableFirestoreDetails_(request.safeDetails || {})
  };
}

function normalizeDurableFirestoreReport_(report, now) {
  const source = report || {};
  if (!source.jobId) throw durableFirestoreError_('RECONCILIATION_REPORT_INVALID', 'job id required');
  if (!Array.isArray(source.findings)) throw durableFirestoreError_('RECONCILIATION_REPORT_INVALID', 'findings required');
  const safeFindings = source.findings.map(finding => ({
    code: safeDurableFirestoreErrorCode_(finding && finding.code),
    severity: safeDurableFirestoreString_(finding && finding.severity),
    scope: safeDurableFirestoreString_(finding && finding.scope),
    repairPolicy: safeDurableFirestoreString_(finding && finding.repairPolicy),
    safeMessage: sanitizeDurableFirestoreText_(finding && finding.safeMessage)
  }));
  const body = {
    schemaVersion: FIRESTORE_DURABLE_REPORT_SCHEMA_VERSION_,
    reportId: safeDurableFirestoreString_(source.reportId || ('rpt_' + durableFirestoreHashPrefix_(stableDurableFirestoreJson_({ jobId: source.jobId, status: source.status, findings: safeFindings })))),
    jobId: safeDurableFirestoreString_(source.jobId),
    invoiceKeyHashPrefix: durableFirestoreHashPrefix_(source.invoiceKeyHashPrefix || ''),
    status: safeDurableFirestoreString_(source.status || 'REVIEW_REQUIRED'),
    findingCount: Number(source.findingCount != null ? source.findingCount : safeFindings.length),
    blockerCount: Number(source.blockerCount || 0),
    findings: safeFindings,
    generatedAt: safeDurableFirestoreString_(source.generatedAt || now),
    inputSnapshotVersion: safeDurableFirestoreString_(source.inputSnapshotVersion || ''),
    jobVersion: Number(source.jobVersion || 0)
  };
  if (body.findingCount !== body.findings.length) throw durableFirestoreError_('RECONCILIATION_REPORT_INVALID', 'finding count mismatch');
  return body;
}

async function durableFirestoreWrite_(work) {
  try {
    return await work();
  } catch (error) {
    if (error && error.writeOutcome === 'UNKNOWN') {
      throw durableFirestoreError_('FIRESTORE_WRITE_UNCONFIRMED', 'write outcome unknown');
    }
    if (error && FIRESTORE_DURABLE_ERROR_CODES_.includes(error.code)) throw error;
    throw durableFirestoreError_('FIRESTORE_TRANSPORT_ERROR', 'transport failure');
  }
}

function assertDurableFirestoreExpectedVersion_(current, expectedVersion) {
  if (Number(current.version) !== Number(expectedVersion)) {
    throw durableFirestoreError_('DURABLE_JOB_VERSION_CONFLICT', 'expected version mismatch');
  }
}

function assertDurableFirestoreTransition_(fromStatus, toStatus) {
  try {
    if (typeof assertDurableJobTransition_ === 'function') return assertDurableJobTransition_(fromStatus, toStatus);
  } catch (_err) {
    throw durableFirestoreError_('DURABLE_JOB_ILLEGAL_TRANSITION', 'illegal durable job transition');
  }
  if (safeDurableFirestoreString_(fromStatus) === safeDurableFirestoreString_(toStatus)) return true;
  throw durableFirestoreError_('DURABLE_JOB_ILLEGAL_TRANSITION', 'transition validator unavailable');
}

function isDurableFirestoreTerminalState_(status) {
  if (typeof isDurableTerminalJobState_ === 'function') return isDurableTerminalJobState_(status);
  return ['COMPLETED', 'RECONCILIATION_REQUIRED', 'IGNORED_NOT_INVOICE'].includes(safeDurableFirestoreString_(status));
}

function sanitizeDurableFirestoreJobPatch_(patch) {
  const blocked = {
    jobId: true,
    schemaVersion: true,
    invoiceIdentityHash: true,
    sourceThreadHash: true,
    version: true,
    commitPlan: true,
    commitPlanHash: true,
    commitPlanVersion: true,
    createdAt: true
  };
  const out = {};
  Object.keys(patch || {}).sort().forEach(key => {
    if (!blocked[key]) out[key] = sanitizeDurableFirestoreDetails_(patch[key]);
  });
  return out;
}

function sanitizeDurableFirestoreDetails_(value) {
  if (Array.isArray(value)) return value.map(sanitizeDurableFirestoreDetails_);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      out[key] = sanitizeDurableFirestoreDetails_(value[key]);
    });
    return out;
  }
  return sanitizeDurableFirestoreText_(value);
}

function sanitizeDurableFirestoreText_(value) {
  const text = safeDurableFirestoreString_(value);
  if (!text) return '';
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const tokenPrefix = ['ya', '29'].join('');
  const keyMarker = ['private', 'key'].join('[_-]?');
  const blockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  if (new RegExp(tokenPrefix + '[.]|oauth|token|' + keyMarker + '|' + blockMarker, 'i').test(text)) return 'REDACTED_SECRET';
  if (text.length > 80) return 'REDACTED_LONG_TEXT_' + durableFirestoreHashPrefix_(text);
  return text;
}

function safeDurableFirestoreRequired_(value, field) {
  const text = safeDurableFirestoreString_(value);
  if (!text) throw durableFirestoreError_('RECONCILIATION_REPORT_INVALID', field + ' required');
  return text;
}

function safeDurableFirestoreString_(value) {
  return value == null ? '' : String(value);
}

function safeDurableFirestoreErrorCode_(value) {
  return safeDurableFirestoreString_(value).replace(/[^A-Z0-9_]/g, '').slice(0, 80);
}

function durableFirestoreJobPath_(rootCollection, jobId) {
  return rootCollection + '/' + safeDurableFirestoreString_(jobId);
}

function durableFirestoreEventsPath_(rootCollection, jobId) {
  return durableFirestoreJobPath_(rootCollection, jobId) + '/events';
}

function durableFirestoreReportsPath_(rootCollection, jobId) {
  return durableFirestoreJobPath_(rootCollection, jobId) + '/reconciliationReports';
}

function durableFirestoreError_(code, message) {
  const error = new Error(code + ':' + sanitizeDurableFirestoreText_(message));
  error.code = code;
  return error;
}

function durableFirestoreHashPrefix_(value) {
  const text = safeDurableFirestoreString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function cloneDurableFirestoreJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableDurableFirestoreJson_(value) {
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
