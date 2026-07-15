const SGDS_D5H_EMULATOR_ONLY_ = true;
const SGDS_D5H_EMULATOR_PROJECT_ID_ = 'demo-sgds-local';
const SGDS_D5H_EMULATOR_DATABASE_ID_ = '(default)';
const SGDS_D5H_PRODUCTION_FIRESTORE_ACCESS_ = 'NONE';
const SGDS_D5H_PRODUCTION_WRITE_EXECUTED_ = false;

function createFirestoreEmulatorDurableShadowIntegration(options) {
  const opts = options || {};
  const config = validateFirestoreShadowEmulatorConfig(opts);
  const clock = requireD5HAdapter_(opts.clock, 'clock', ['now']);
  const transport = requireD5HObject_(opts.transport, 'transport');
  const validator = opts.validator || createFirestoreShadowStateValidator();
  const baseStore = opts.jobStore || createDurableInvoiceJobStore(transport, {
    clock,
    rootCollection: opts.rootCollection || 'invoiceJobs'
  });
  const jobStore = createFirestoreShadowJobStoreAdapter(baseStore, {
    clock,
    validator,
    rootCollection: opts.rootCollection || 'invoiceJobs'
  });
  const reconciliationService = opts.reconciliationService || {
    reconcileDurableInvoiceJobReportOnly
  };
  const integration = createDurableShadowStateIntegration({
    ...opts,
    jobStore,
    reconciliationService,
    clock
  });

  return Object.freeze({
    ...integration,
    getEmulatorConfig() {
      return cloneD5HJson_(config);
    },
    getJobStore() {
      return jobStore;
    },
    getWriteBoundary() {
      return {
        emulatorOnly: SGDS_D5H_EMULATOR_ONLY_,
        productionFirestoreAccess: SGDS_D5H_PRODUCTION_FIRESTORE_ACCESS_,
        productionWriteExecuted: SGDS_D5H_PRODUCTION_WRITE_EXECUTED_,
        clientWritePolicy: SGDS_D5F_D5I_CLIENT_WRITE_POLICY_,
        anonymousAccessPolicy: SGDS_D5F_D5I_ANONYMOUS_ACCESS_POLICY_
      };
    },
    validateJobDocument: validator.validateJobDocument,
    validateAuditEvent: validator.validateAuditEvent,
    validateReconciliationReport: validator.validateReconciliationReport
  });
}

function validateFirestoreShadowEmulatorConfig(options) {
  const emulatorHost = safeD5HString_(options.emulatorHost || (typeof process !== 'undefined' && process.env && process.env.FIRESTORE_EMULATOR_HOST) || '');
  const projectId = safeD5HString_(options.projectId || (typeof process !== 'undefined' && process.env && process.env.GCLOUD_PROJECT) || '');
  const databaseId = safeD5HString_(options.databaseId || SGDS_D5H_EMULATOR_DATABASE_ID_);
  if (!/^(127[.]0[.]0[.]1|localhost):[0-9]{2,5}$/.test(emulatorHost)) throw d5hError_('FIRESTORE_EMULATOR_HOST_REQUIRED');
  if (!/^(demo-|local-)/.test(projectId)) throw d5hError_('FIRESTORE_EMULATOR_PROJECT_ID_REQUIRED');
  if (/prod|production|hung|longthai|syncgmaildrivesheet/i.test(projectId) && projectId !== SGDS_D5H_EMULATOR_PROJECT_ID_) {
    throw d5hError_('PRODUCTION_LIKE_FIRESTORE_PROJECT_DENIED');
  }
  if (!databaseId) throw d5hError_('FIRESTORE_EMULATOR_DATABASE_ID_REQUIRED');
  return {
    emulatorHost,
    projectId,
    databaseId,
    productionFirestoreAccess: SGDS_D5H_PRODUCTION_FIRESTORE_ACCESS_,
    firestoreRulesDeploy: SGDS_D5F_D5I_FIRESTORE_RULES_DEPLOY_,
    firestoreIndexDeploy: SGDS_D5F_D5I_FIRESTORE_INDEX_DEPLOY_
  };
}

function createFirestoreShadowJobStoreAdapter(baseStore, options) {
  const opts = options || {};
  const clock = requireD5HAdapter_(opts.clock, 'clock', ['now']);
  const validator = opts.validator || createFirestoreShadowStateValidator();
  const eventIdempotency = Object.create(null);
  const reportIdempotency = Object.create(null);

  async function createJobIfAbsent(seed) {
    const safeSeed = sanitizeD5HSeed_(seed);
    let result;
    try {
      result = await baseStore.createJobIfAbsent(safeSeed);
    } catch (error) {
      if (error && error.code === 'DURABLE_JOB_ALREADY_EXISTS') {
        const existing = await baseStore.getJob(safeSeed.jobId);
        return {
          resultCode: 'JOB_ALREADY_EXISTS_IDEMPOTENT',
          created: false,
          job: validator.validateJobDocument(enrichShadowJob_(existing, safeSeed))
        };
      }
      throw error;
    }
    return { ...cloneD5HJson_(result), job: validator.validateJobDocument(enrichShadowJob_(result.job || result, safeSeed)) };
  }

  async function getJob(jobId) {
    const job = await baseStore.getJob(jobId);
    return job ? validator.validateJobDocument(enrichShadowJob_(job, {})) : null;
  }

  async function saveCommitPlanIfAbsent(request) {
    const req = cloneD5HJson_(request || {});
    validator.validateCommitPlan(req.commitPlan || {});
    const result = await baseStore.saveCommitPlanIfAbsent(req);
    return { ...cloneD5HJson_(result), job: validator.validateJobDocument(enrichShadowJob_(result.job, {})) };
  }

  async function transitionJob(request) {
    const req = cloneD5HJson_(request || {});
    if (SGDS_D5F_D5I_PRODUCTION_COMPLETION_STATES_.includes(safeD5HString_(req.toStatus))) {
      throw d5hError_('FIRESTORE_SHADOW_PRODUCTION_STATE_DENIED');
    }
    const result = await baseStore.transitionJob(req);
    return { ...cloneD5HJson_(result), job: validator.validateJobDocument(enrichShadowJob_(result.job, { shadowEvaluationStatus: statusToShadowEvaluation_(result.job && result.job.status) })) };
  }

  async function appendAuditEvent(request) {
    const req = cloneD5HJson_(request || {});
    const key = safeD5HString_(req.jobId) + ':' + safeD5HString_(req.idempotencyKey || req.eventType + ':' + stableD5HJson_(req.safeDetails || {}));
    if (eventIdempotency[key]) return { resultCode: 'AUDIT_EVENT_IDEMPOTENT', event: cloneD5HJson_(eventIdempotency[key]) };
    const safeEvent = validator.validateAuditEvent({
      ...req,
      idempotencyKey: req.idempotencyKey || key,
      schemaVersion: SGDS_D5F_D5I_EVENT_SCHEMA_VERSION_
    });
    const result = await baseStore.appendAuditEvent(safeEvent);
    eventIdempotency[key] = validator.validateAuditEvent({ ...result.event, idempotencyKey: safeEvent.idempotencyKey });
    return { ...cloneD5HJson_(result), event: cloneD5HJson_(eventIdempotency[key]) };
  }

  async function saveReconciliationReport(request) {
    const req = cloneD5HJson_(request || {});
    const safeReport = validator.validateReconciliationReport(req.report || {});
    const key = safeD5HString_(req.jobId || safeReport.jobId) + ':' + safeD5HString_(safeReport.reportId);
    if (reportIdempotency[key]) return { resultCode: 'RECONCILIATION_REPORT_IDEMPOTENT', report: cloneD5HJson_(reportIdempotency[key]), job: await getJob(req.jobId || safeReport.jobId) };
    const result = await baseStore.saveReconciliationReport({ ...req, report: safeReport });
    reportIdempotency[key] = validator.validateReconciliationReport(result.report || safeReport);
    return {
      ...cloneD5HJson_(result),
      report: cloneD5HJson_(reportIdempotency[key]),
      job: validator.validateJobDocument(enrichShadowJob_(result.job, { latestReconciliationStatus: safeReport.status }))
    };
  }

  async function getLatestReconciliationReport(jobId) {
    const report = await baseStore.getLatestReconciliationReport(jobId);
    return report ? validator.validateReconciliationReport(report) : null;
  }

  return Object.freeze({
    createJobIfAbsent,
    getJob,
    saveCommitPlanIfAbsent,
    transitionJob,
    appendAuditEvent,
    saveReconciliationReport,
    getLatestReconciliationReport
  });
}

function sanitizeD5HSeed_(seed) {
  const safe = cloneD5HJson_(seed || {});
  return {
    ...safe,
    status: safe.status || 'DETECTED',
    executionMode: SGDS_D5F_D5I_EXECUTION_MODE_,
    productionMutationAllowed: false,
    sourceTypes: Array.isArray(safe.sourceTypes) ? safe.sourceTypes.slice().sort() : [],
    sourceReferenceHashes: Array.isArray(safe.sourceReferenceHashes) ? safe.sourceReferenceHashes.slice().sort() : [safe.sourceThreadHash || safe.sourceReferenceHash || ''].filter(Boolean),
    retentionClass: safe.retentionClass || 'DURABLE_AUDIT'
  };
}

function enrichShadowJob_(job, seed) {
  const source = cloneD5HJson_(job || {});
  const shadowStatus = statusToShadowEvaluation_(source.status);
  const sourceHash = source.sourceThreadHash || (seed && seed.sourceThreadHash) || '';
  return {
    ...source,
    schemaVersion: SGDS_D5F_D5I_SCHEMA_VERSION_,
    executionMode: SGDS_D5F_D5I_EXECUTION_MODE_,
    productionMutationAllowed: false,
    shadowEvaluationStatus: (seed && seed.shadowEvaluationStatus) || shadowStatus,
    sourceReferenceHashes: Array.isArray(source.sourceReferenceHashes) ? source.sourceReferenceHashes : [sourceHash].filter(Boolean),
    sourceTypes: Array.isArray(source.sourceTypes) ? source.sourceTypes : ((seed && seed.sourceTypes) || []),
    expectedLineCount: Number((source.commitPlan && source.commitPlan.expectedLineCount) || source.expectedLineCount || 0),
    lastObservedAt: source.lastObservedAt || source.updatedAt || (seed && seed.lastObservedAt) || clockSafeNow_(seed),
    latestReconciliationStatus: source.latestReconciliationStatus || source.reconciliationStatus || 'NOT_RUN',
    latestFindingCodes: Array.isArray(source.latestFindingCodes) ? source.latestFindingCodes : [],
    retentionClass: source.retentionClass || 'DURABLE_AUDIT'
  };
}

function statusToShadowEvaluation_(status) {
  const value = safeD5HString_(status);
  if (value === 'RECONCILIATION_REQUIRED' || value === 'FAILED_REVIEW_REQUIRED') return 'SHADOW_REVIEW_REQUIRED';
  if (value === 'FAILED_RETRYABLE') return 'SHADOW_FAILED';
  if (['DETECTED', 'COLLECTED', 'PARSED'].includes(value)) return 'SHADOW_EVALUATING';
  if (value === 'VALIDATED') return 'SHADOW_READY';
  return value || 'SHADOW_DETECTED';
}

function clockSafeNow_(seed) {
  return safeD5HString_(seed && seed.updatedAt) || 'LOCAL_EMULATOR_TIME';
}

function requireD5HObject_(value, name) {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) throw d5hError_('D5H_DEPENDENCY_REQUIRED:' + name);
  return value;
}

function requireD5HAdapter_(adapter, name, methods) {
  requireD5HObject_(adapter, name);
  methods.forEach(method => {
    if (typeof adapter[method] !== 'function') throw d5hError_('D5H_ADAPTER_METHOD_REQUIRED:' + name + '.' + method);
  });
  return adapter;
}

function d5hError_(code) {
  const error = new Error(code);
  error.code = code.split(':')[0];
  return error;
}

function safeD5HString_(value) {
  return value == null ? '' : String(value);
}

function cloneD5HJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function stableD5HJson_(value) {
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
