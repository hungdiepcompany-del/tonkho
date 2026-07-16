const SGDS_D5F_D5I_LOCAL_FIRESTORE_SHADOW_READINESS_ = true;
const SGDS_D5F_D5I_SCHEMA_VERSION_ = 'SGDS_FIRESTORE_SHADOW_SCHEMA_V1';
const SGDS_D5F_D5I_EVENT_SCHEMA_VERSION_ = 'SGDS_FIRESTORE_SHADOW_EVENT_V1';
const SGDS_D5F_D5I_REPORT_SCHEMA_VERSION_ = 'SGDS_FIRESTORE_SHADOW_REPORT_V1';
const SGDS_D5F_D5I_EXECUTION_MODE_ = 'SHADOW';
const SGDS_D5F_D5I_PRODUCTION_MUTATION_ALLOWED_ = false;
const SGDS_D5F_D5I_REPAIR_POLICY_ = 'REPORT_ONLY';
const SGDS_D5F_D5I_INPUT_SNAPSHOT_VERSION_ = 'D5F_D5I_SHADOW_STATE_SNAPSHOT_V1';

const SGDS_D5F_D5I_COLLECTION_PATHS_ = Object.freeze([
  'invoiceJobs/{jobId}',
  'invoiceJobs/{jobId}/events/{eventId}',
  'invoiceJobs/{jobId}/reconciliationReports/{reportId}'
]);

const SGDS_D5F_D5I_JOB_FIELD_ALLOWLIST_ = Object.freeze([
  'schemaVersion',
  'jobId',
  'status',
  'shadowEvaluationStatus',
  'executionMode',
  'productionMutationAllowed',
  'synthetic',
  'environment',
  'caseId',
  'businessData',
  'canonicalWriteAllowed',
  'invoiceIdentityHash',
  'sourceReferenceHashes',
  'sourceTypes',
  'sourceThreadHash',
  'commitPlan',
  'commitPlanHash',
  'commitPlanVersion',
  'expectedLineCount',
  'version',
  'createdAt',
  'updatedAt',
  'lastObservedAt',
  'latestReconciliationStatus',
  'latestFindingCodes',
  'latestReconciliationReportId',
  'reconciliationStatus',
  'retentionClass',
  'attemptCount',
  'completedAt',
  'lastErrorCode',
  'lastErrorStage',
  'lastMutationIdempotencyKey'
]);

const SGDS_D5F_D5I_FORBIDDEN_FIELD_PATTERNS_ = Object.freeze([
  /gmailThreadId/i,
  /messageId/i,
  /driveFileId/i,
  /email/i,
  /taxCode/i,
  /invoiceNo/i,
  /companyName/i,
  /(^|[^a-z])xml($|[^a-z])/i,
  /(^|[^a-z])pdf($|[^a-z])/i,
  /attachmentContent/i,
  /(^|[^a-z])body($|[^a-z])/i,
  /token/i,
  /credential/i,
  /privateKey/i
]);

const SGDS_D5F_D5I_SHADOW_STATUS_ALLOWLIST_ = Object.freeze([
  'SHADOW_DETECTED',
  'SHADOW_EVALUATING',
  'SHADOW_READY',
  'SHADOW_REVIEW_REQUIRED',
  'SHADOW_CONFLICT',
  'SHADOW_FAILED',
  'READY',
  'REVIEW_REQUIRED',
  'CONFLICT',
  'FAILED',
  'DETECTED',
  'COLLECTED',
  'PARSED',
  'VALIDATED',
  'FAILED_RETRYABLE',
  'FAILED_REVIEW_REQUIRED'
]);

const SGDS_D5F_D5I_PRODUCTION_COMPLETION_STATES_ = Object.freeze([
  'FILES_SAVED',
  'COMMITTING',
  'ROWS_COMMITTED',
  'PROJECTIONS_COMMITTED',
  'COMPLETED'
]);

const SGDS_D5F_D5I_EVENT_TYPE_ALLOWLIST_ = Object.freeze([
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

const SGDS_D5F_D5I_LIMITS_ = Object.freeze({
  maximumJobDocumentBytes: 24000,
  maximumSafeDetailsBytes: 2000,
  maximumFindingCodes: 40,
  maximumProvenanceHashes: 16,
  maximumCommitPlanLines: 40,
  maximumEventCountPerBatch: 40,
  maximumReportsPerJob: 20
});

const SGDS_D5F_D5I_CLIENT_WRITE_POLICY_ = 'DENY';
const SGDS_D5F_D5I_ANONYMOUS_ACCESS_POLICY_ = 'DENY';
const SGDS_D5F_D5I_FIRESTORE_RULES_DEPLOY_ = 'NOT_RUN';
const SGDS_D5F_D5I_FIRESTORE_INDEX_DEPLOY_ = 'NOT_RUN';

function createFirestoreShadowStateValidator(options) {
  const limits = Object.freeze({ ...SGDS_D5F_D5I_LIMITS_, ...((options && options.limits) || {}) });

  function sanitizeProjection(value) {
    return sanitizeD5FValue_(value, []);
  }

  function validateJobDocument(job) {
    const safe = sanitizeProjection(job || {});
    assertD5FObject_(safe, 'job');
    assertD5FNoForbiddenFields_(safe, []);
    assertD5FOnlyAllowedFields_(safe, SGDS_D5F_D5I_JOB_FIELD_ALLOWLIST_, 'job');
    if (safe.executionMode !== SGDS_D5F_D5I_EXECUTION_MODE_) throw d5fError_('FIRESTORE_SHADOW_EXECUTION_MODE_INVALID');
    if (safe.productionMutationAllowed !== false) throw d5fError_('FIRESTORE_SHADOW_PRODUCTION_MUTATION_DENIED');
    if (SGDS_D5F_D5I_PRODUCTION_COMPLETION_STATES_.includes(safe.status)) throw d5fError_('FIRESTORE_SHADOW_PRODUCTION_STATE_DENIED');
    const shadowStatus = safe.shadowEvaluationStatus || safe.status || '';
    if (!SGDS_D5F_D5I_SHADOW_STATUS_ALLOWLIST_.includes(shadowStatus)) throw d5fError_('FIRESTORE_SHADOW_STATUS_INVALID');
    if (safe.commitPlan) validateCommitPlan(safe.commitPlan);
    assertD5FSize_(safe, limits.maximumJobDocumentBytes, 'FIRESTORE_SHADOW_JOB_TOO_LARGE');
    return safe;
  }

  function validateCommitPlan(commitPlan) {
    const safe = sanitizeProjection(commitPlan || {});
    assertD5FNoForbiddenFields_(safe, ['commitPlan']);
    if (safe.productionMutationAllowed === true) throw d5fError_('FIRESTORE_SHADOW_PRODUCTION_MUTATION_DENIED');
    const lines = Array.isArray(safe.lines) ? safe.lines : [];
    if (lines.length > limits.maximumCommitPlanLines) throw d5fError_('FIRESTORE_SHADOW_COMMIT_PLAN_TOO_LARGE');
    assertD5FSize_(safe, limits.maximumJobDocumentBytes, 'FIRESTORE_SHADOW_COMMIT_PLAN_TOO_LARGE');
    return safe;
  }

  function validateAuditEvent(event) {
    const safe = sanitizeProjection(event || {});
    assertD5FNoForbiddenFields_(safe, []);
    if (!SGDS_D5F_D5I_EVENT_TYPE_ALLOWLIST_.includes(safe.eventType)) throw d5fError_('FIRESTORE_SHADOW_EVENT_TYPE_INVALID');
    assertD5FSize_(safe.safeDetails || {}, limits.maximumSafeDetailsBytes, 'FIRESTORE_SHADOW_EVENT_TOO_LARGE');
    return {
      schemaVersion: safe.schemaVersion || SGDS_D5F_D5I_EVENT_SCHEMA_VERSION_,
      eventId: safe.eventId || '',
      jobId: safe.jobId || '',
      eventType: safe.eventType,
      idempotencyKey: safe.idempotencyKey || '',
      actorType: safe.actorType || 'SYSTEM',
      occurredAt: safe.occurredAt || '',
      safeDetails: safe.safeDetails || {}
    };
  }

  function validateReconciliationReport(report) {
    const safe = sanitizeProjection(report || {});
    assertD5FNoForbiddenFields_(safe, []);
    const findingCodes = Array.isArray(safe.findingCodes)
      ? safe.findingCodes
      : (Array.isArray(safe.findings) ? safe.findings.map(finding => finding && finding.code).filter(Boolean) : []);
    if (findingCodes.length > limits.maximumFindingCodes) throw d5fError_('FIRESTORE_SHADOW_REPORT_TOO_LARGE');
    if ((safe.repairPolicy || SGDS_D5F_D5I_REPAIR_POLICY_) !== SGDS_D5F_D5I_REPAIR_POLICY_) throw d5fError_('FIRESTORE_SHADOW_REPAIR_POLICY_INVALID');
    return {
      ...safe,
      schemaVersion: safe.schemaVersion || SGDS_D5F_D5I_REPORT_SCHEMA_VERSION_,
      repairPolicy: SGDS_D5F_D5I_REPAIR_POLICY_,
      executionMode: SGDS_D5F_D5I_EXECUTION_MODE_,
      inputSnapshotVersion: safe.inputSnapshotVersion || SGDS_D5F_D5I_INPUT_SNAPSHOT_VERSION_,
      findingCodes
    };
  }

  function assertNoForbiddenPersistence(value) {
    assertD5FNoForbiddenFields_(value || {}, []);
    return true;
  }

  return Object.freeze({
    sanitizeProjection,
    validateJobDocument,
    validateCommitPlan,
    validateAuditEvent,
    validateReconciliationReport,
    assertNoForbiddenPersistence,
    limits
  });
}

function sanitizeD5FValue_(value, path) {
  if (Array.isArray(value)) return value.slice(0, 80).map((item, index) => sanitizeD5FValue_(item, path.concat(String(index))));
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => {
      if (isD5FForbiddenField_(key)) throw d5fError_('FIRESTORE_SHADOW_FORBIDDEN_FIELD:' + key);
      out[key] = sanitizeD5FValue_(value[key], path.concat(key));
    });
    return out;
  }
  const text = value == null ? '' : String(value);
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const tokenMarker = ['to', 'ken'].join('');
  const keyMarker = ['private', 'key'].join('[_-]?');
  const blockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  if (new RegExp(tokenMarker + '|oauth|' + keyMarker + '|' + blockMarker + '|credential', 'i').test(text)) return 'REDACTED_SECRET';
  return text.length > 120 ? 'REDACTED_LONG_TEXT_' + hashD5FValue_(text) : value;
}

function assertD5FNoForbiddenFields_(value, path) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertD5FNoForbiddenFields_(item, path.concat(String(index))));
    return;
  }
  if (!value || typeof value !== 'object') return;
  Object.keys(value).forEach(key => {
    if (isD5FForbiddenField_(key)) throw d5fError_('FIRESTORE_SHADOW_FORBIDDEN_FIELD:' + path.concat(key).join('.'));
    assertD5FNoForbiddenFields_(value[key], path.concat(key));
  });
}

function assertD5FOnlyAllowedFields_(value, allowlist, label) {
  const allowed = {};
  allowlist.forEach(field => { allowed[field] = true; });
  Object.keys(value || {}).forEach(key => {
    if (!allowed[key]) throw d5fError_('FIRESTORE_SHADOW_UNAPPROVED_FIELD:' + label + '.' + key);
  });
}

function assertD5FObject_(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw d5fError_('FIRESTORE_SHADOW_OBJECT_REQUIRED:' + label);
}

function assertD5FSize_(value, limit, code) {
  if (JSON.stringify(value || {}).length > limit) throw d5fError_(code);
}

function isD5FForbiddenField_(key) {
  return SGDS_D5F_D5I_FORBIDDEN_FIELD_PATTERNS_.some(pattern => pattern.test(String(key || '')));
}

function d5fError_(code) {
  const error = new Error(code);
  error.code = code.split(':')[0];
  return error;
}

function hashD5FValue_(value) {
  const text = String(value || '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}
