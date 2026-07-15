const DURABLE_JOB_STATES_ = Object.freeze({
  DETECTED: 'DETECTED',
  COLLECTED: 'COLLECTED',
  PARSED: 'PARSED',
  VALIDATED: 'VALIDATED',
  FILES_SAVED: 'FILES_SAVED',
  COMMITTING: 'COMMITTING',
  ROWS_COMMITTED: 'ROWS_COMMITTED',
  PROJECTIONS_COMMITTED: 'PROJECTIONS_COMMITTED',
  COMPLETED: 'COMPLETED',
  FAILED_RETRYABLE: 'FAILED_RETRYABLE',
  FAILED_REVIEW_REQUIRED: 'FAILED_REVIEW_REQUIRED',
  RECONCILIATION_REQUIRED: 'RECONCILIATION_REQUIRED',
  IGNORED_NOT_INVOICE: 'IGNORED_NOT_INVOICE'
});

const DURABLE_JOB_INITIAL_STATE_ = DURABLE_JOB_STATES_.DETECTED;

const DURABLE_JOB_TRANSITIONS_ = Object.freeze({
  DETECTED: Object.freeze(['COLLECTED', 'FAILED_RETRYABLE', 'FAILED_REVIEW_REQUIRED', 'IGNORED_NOT_INVOICE']),
  COLLECTED: Object.freeze(['PARSED', 'FAILED_RETRYABLE', 'FAILED_REVIEW_REQUIRED']),
  PARSED: Object.freeze(['VALIDATED', 'FAILED_RETRYABLE', 'FAILED_REVIEW_REQUIRED']),
  VALIDATED: Object.freeze(['FILES_SAVED', 'FAILED_RETRYABLE', 'FAILED_REVIEW_REQUIRED']),
  FILES_SAVED: Object.freeze(['COMMITTING', 'FAILED_RETRYABLE', 'RECONCILIATION_REQUIRED']),
  COMMITTING: Object.freeze(['ROWS_COMMITTED', 'FAILED_RETRYABLE', 'RECONCILIATION_REQUIRED']),
  ROWS_COMMITTED: Object.freeze(['PROJECTIONS_COMMITTED', 'RECONCILIATION_REQUIRED']),
  PROJECTIONS_COMMITTED: Object.freeze(['COMPLETED', 'RECONCILIATION_REQUIRED']),
  COMPLETED: Object.freeze([]),
  FAILED_RETRYABLE: Object.freeze(['COLLECTED', 'PARSED', 'VALIDATED', 'FILES_SAVED', 'COMMITTING', 'RECONCILIATION_REQUIRED']),
  FAILED_REVIEW_REQUIRED: Object.freeze(['COLLECTED', 'PARSED', 'VALIDATED', 'RECONCILIATION_REQUIRED']),
  RECONCILIATION_REQUIRED: Object.freeze([]),
  IGNORED_NOT_INVOICE: Object.freeze([])
});

function isDurableJobState_(state) {
  return Object.prototype.hasOwnProperty.call(DURABLE_JOB_TRANSITIONS_, String(state || ''));
}

function isDurableTerminalJobState_(state) {
  return ['COMPLETED', 'RECONCILIATION_REQUIRED', 'IGNORED_NOT_INVOICE'].includes(String(state || ''));
}

function assertDurableJobTransition_(fromState, toState) {
  const from = String(fromState || '');
  const to = String(toState || '');

  if (!isDurableJobState_(from)) {
    throw new Error('DURABLE_JOB_UNKNOWN_FROM_STATE:' + from);
  }
  if (!isDurableJobState_(to)) {
    throw new Error('DURABLE_JOB_UNKNOWN_TO_STATE:' + to);
  }
  if (!DURABLE_JOB_TRANSITIONS_[from].includes(to)) {
    throw new Error('DURABLE_JOB_INVALID_TRANSITION:' + from + '->' + to);
  }
  return true;
}

function createLocalDurableJobStore_(options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const jobs = {};
  const events = {};

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function requireJobId(jobId) {
    const id = String(jobId || '').trim();
    if (!id) throw new Error('DURABLE_JOB_ID_REQUIRED');
    return id;
  }

  function appendEvent(jobId, event) {
    const id = requireJobId(jobId);
    events[id] = events[id] || [];
    const safeEvent = {
      eventId: 'evt_' + String(events[id].length + 1).padStart(4, '0'),
      jobId: id,
      at: now(),
      type: String((event && event.type) || 'EVENT'),
      data: clone((event && event.data) || {})
    };
    events[id].push(safeEvent);
    return clone(safeEvent);
  }

  function createJob(seed) {
    const id = requireJobId(seed && seed.jobId);
    if (jobs[id]) throw new Error('DURABLE_JOB_ALREADY_EXISTS:' + id);
    const state = (seed && seed.state) || DURABLE_JOB_INITIAL_STATE_;
    if (!isDurableJobState_(state)) throw new Error('DURABLE_JOB_UNKNOWN_STATE:' + state);

    const job = {
      jobId: id,
      state,
      sourceFingerprint: String((seed && seed.sourceFingerprint) || ''),
      invoiceKeyV2: String((seed && seed.invoiceKeyV2) || ''),
      legacyInvoiceKey: String((seed && seed.legacyInvoiceKey) || ''),
      commitPlan: null,
      createdAt: now(),
      updatedAt: now()
    };
    jobs[id] = clone(job);
    appendEvent(id, { type: 'JOB_CREATED', data: { state } });
    return clone(jobs[id]);
  }

  function getJob(jobId) {
    const id = requireJobId(jobId);
    return clone(jobs[id] || null);
  }

  function putJob(job) {
    const id = requireJobId(job && job.jobId);
    if (!isDurableJobState_(job.state)) throw new Error('DURABLE_JOB_UNKNOWN_STATE:' + job.state);
    jobs[id] = clone({ ...job, updatedAt: now() });
    return clone(jobs[id]);
  }

  function transitionJob(jobId, toState, details = {}) {
    const id = requireJobId(jobId);
    const current = jobs[id];
    if (!current) throw new Error('DURABLE_JOB_NOT_FOUND:' + id);
    assertDurableJobTransition_(current.state, toState);
    const fromState = current.state;
    current.state = String(toState);
    current.updatedAt = now();
    jobs[id] = clone(current);
    appendEvent(id, { type: 'STATE_TRANSITION', data: { fromState, toState, details: clone(details) } });
    return clone(jobs[id]);
  }

  function saveCommitPlan(jobId, plan) {
    const id = requireJobId(jobId);
    const current = jobs[id];
    if (!current) throw new Error('DURABLE_JOB_NOT_FOUND:' + id);
    const nextPlan = normalizeDurableCommitPlan_(plan);

    if (current.commitPlan) {
      const currentKey = stableDurableJson_(current.commitPlan);
      const nextKey = stableDurableJson_(nextPlan);
      if (currentKey !== nextKey) throw new Error('DURABLE_COMMIT_PLAN_IMMUTABLE:' + id);
      return clone(current.commitPlan);
    }

    current.commitPlan = nextPlan;
    current.updatedAt = now();
    jobs[id] = clone(current);
    appendEvent(id, { type: 'COMMIT_PLAN_SAVED', data: { expectedLineCount: nextPlan.expectedLineCount } });
    return clone(nextPlan);
  }

  function listEvents(jobId) {
    const id = requireJobId(jobId);
    return clone(events[id] || []);
  }

  return Object.freeze({
    createJob,
    getJob,
    putJob,
    transitionJob,
    saveCommitPlan,
    appendEvent,
    listEvents
  });
}

function buildDurableCommitPlan_(input) {
  const source = input || {};
  const lines = source.lines || [];
  if (!source.jobId) throw new Error('DURABLE_COMMIT_PLAN_JOB_ID_REQUIRED');
  if (!source.legacyInvoiceKey) throw new Error('DURABLE_COMMIT_PLAN_LEGACY_INVOICE_KEY_REQUIRED');
  if (!source.invoiceKeyV2) throw new Error('DURABLE_COMMIT_PLAN_INVOICE_KEY_V2_REQUIRED');
  if (!Array.isArray(lines) || lines.length === 0) throw new Error('DURABLE_COMMIT_PLAN_LINES_REQUIRED');

  const normalizedLines = lines.map((line, index) => {
    const legacyHashIndex = String(line && line.legacyHashIndex || '').trim();
    const lineIdentityV2 = String(line && line.lineIdentityV2 || '').trim();
    if (!legacyHashIndex) throw new Error('DURABLE_COMMIT_PLAN_LINE_HASH_REQUIRED:' + (index + 1));
    if (!lineIdentityV2) throw new Error('DURABLE_COMMIT_PLAN_LINE_IDENTITY_REQUIRED:' + (index + 1));
    return {
      sourceLineNo: line.sourceLineNo || index + 1,
      legacyHashIndex,
      lineIdentityV2,
      immutableFields: cloneDurableJson_(line.immutableFields || {})
    };
  });

  return normalizeDurableCommitPlan_({
    version: 'DURABLE_COMMIT_PLAN_V1',
    jobId: String(source.jobId),
    legacyInvoiceKey: String(source.legacyInvoiceKey),
    invoiceKeyV2: String(source.invoiceKeyV2),
    expectedLineCount: normalizedLines.length,
    legacyHashIndexes: normalizedLines.map(line => line.legacyHashIndex),
    lineIdentityV2s: normalizedLines.map(line => line.lineIdentityV2),
    lines: normalizedLines,
    hoaDonRegistryTarget: cloneDurableJson_(source.hoaDonRegistryTarget || {}),
    driveEvidenceTargets: cloneDurableJson_(source.driveEvidenceTargets || {}),
    preCommitLedgerProbe: cloneDurableJson_(source.preCommitLedgerProbe || { status: 'NOT_RUN' })
  });
}

function normalizeDurableCommitPlan_(plan) {
  const safe = cloneDurableJson_(plan || {});
  if (safe.version !== 'DURABLE_COMMIT_PLAN_V1') throw new Error('DURABLE_COMMIT_PLAN_VERSION_REQUIRED');
  if (!safe.jobId) throw new Error('DURABLE_COMMIT_PLAN_JOB_ID_REQUIRED');
  if (!safe.legacyInvoiceKey) throw new Error('DURABLE_COMMIT_PLAN_LEGACY_INVOICE_KEY_REQUIRED');
  if (!safe.invoiceKeyV2) throw new Error('DURABLE_COMMIT_PLAN_INVOICE_KEY_V2_REQUIRED');
  if (!Array.isArray(safe.lines) || safe.lines.length === 0) throw new Error('DURABLE_COMMIT_PLAN_LINES_REQUIRED');
  if (safe.expectedLineCount !== safe.lines.length) throw new Error('DURABLE_COMMIT_PLAN_LINE_COUNT_MISMATCH');
  if (!Array.isArray(safe.legacyHashIndexes) || safe.legacyHashIndexes.length !== safe.expectedLineCount) {
    throw new Error('DURABLE_COMMIT_PLAN_HASH_COUNT_MISMATCH');
  }
  if (!Array.isArray(safe.lineIdentityV2s) || safe.lineIdentityV2s.length !== safe.expectedLineCount) {
    throw new Error('DURABLE_COMMIT_PLAN_LINE_IDENTITY_COUNT_MISMATCH');
  }
  return safe;
}

function resolveDurableCompletedResume_(job, verification) {
  if (!job || job.state !== DURABLE_JOB_STATES_.COMPLETED) {
    return { action: 'NOT_COMPLETED', safeToMutate: true };
  }
  const safeVerification = verification || {};
  const ledgerVerified = safeVerification.ledgerVerified === true;
  const registryVerified = safeVerification.registryVerified === true;
  const projectionVerified = safeVerification.projectionVerified === true;

  if (ledgerVerified && registryVerified && projectionVerified) {
    return { action: 'IDEMPOTENT_COMPLETE_NOOP', safeToMutate: false };
  }
  return {
    action: 'RECONCILIATION_REQUIRED',
    safeToMutate: false,
    findingCodes: ['JOB_COMPLETED_BUT_PROJECTION_NOT_VERIFIED']
  };
}

function cloneDurableJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableDurableJson_(value) {
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
