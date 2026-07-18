const SGDS_D6G_TRIGGER_SCHEMA_VERSION_ = 'SGDS_D6G_TRIGGER_GUARDS_V1';
const SGDS_D6G_TRIGGER_MUTATION_BLOCKED_STATUS_ = 'TRIGGER_MUTATION_BLOCKED_PHASE_NOT_AUTHORIZED';

const SGDS_D6G_TRIGGER_COMPONENTS_ = Object.freeze([
  'AppsScriptTriggerPolicy',
  'TriggerPlanBuilder',
  'TriggerDuplicateDetector',
  'TriggerInspectionNormalizer',
  'TriggerMutationGuard',
  'AppsScriptQuotaGuard',
  'WorkerInvocationPolicy',
  'RuntimeConfigurationValidator',
  'TriggerTransport interface',
  'FakeTriggerTransport',
  'TriggerDryRunInspector',
  'TriggerDryRunPlanner'
]);

const SGDS_D6G_DEFAULT_TRIGGER_POLICY_ = Object.freeze({
  handlerFunction: 'runSgdsWorkerDryRun',
  triggerType: 'time_based',
  intervalMinutes: 10,
  timezone: 'Asia/Ho_Chi_Minh',
  enabledIntent: true,
  expectedTriggerCount: 1,
  ownerApprovalRequired: true,
  dryRun: true,
  liveMutationAllowed: false,
  schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
});

function getAppsScriptTriggerPolicy_() {
  return cloneD6gJson_(SGDS_D6G_DEFAULT_TRIGGER_POLICY_);
}

function buildTriggerPlan_(overrides) {
  const plan = {
    ...getAppsScriptTriggerPolicy_(),
    ...cloneD6gJson_(overrides || {}),
    dryRun: true,
    ownerApprovalRequired: true,
    schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
  };
  validateTriggerPlan_(plan);
  return Object.freeze(plan);
}

function validateTriggerPlan_(plan) {
  const source = plan || {};
  if (source.handlerFunction !== SGDS_D6G_DEFAULT_TRIGGER_POLICY_.handlerFunction) throw d6gError_('TRIGGER_PLAN_WRONG_HANDLER');
  if (source.triggerType !== 'time_based') throw d6gError_('TRIGGER_PLAN_UNSUPPORTED_TYPE');
  if (Number(source.intervalMinutes) !== 10) throw d6gError_('TRIGGER_PLAN_WRONG_INTERVAL');
  if (source.expectedTriggerCount !== 1) throw d6gError_('TRIGGER_PLAN_EXPECTED_COUNT_REQUIRED');
  if (source.ownerApprovalRequired !== true) throw d6gError_('TRIGGER_PLAN_OWNER_APPROVAL_REQUIRED');
  if (source.dryRun !== true) throw d6gError_('TRIGGER_PLAN_DRY_RUN_REQUIRED');
  return true;
}

function normalizeTriggerInspection_(trigger) {
  const source = trigger || {};
  return {
    triggerIdHashPrefix: d6gHashPrefix_(source.triggerId || source.uniqueId || source.id || ''),
    handlerFunction: safeD6gString_(source.handlerFunction || source.functionName),
    triggerType: normalizeTriggerType_(source.triggerType || source.eventType),
    intervalMinutes: Number(source.intervalMinutes || source.everyMinutes || 0),
    timezone: safeD6gString_(source.timezone || ''),
    ownedBySgds: /sgds/i.test(safeD6gString_(source.handlerFunction || source.functionName || source.description || '')),
    rawIdLogged: false,
    schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
  };
}

function inspectTriggersDryRun_(triggers, policyInput) {
  const policy = buildTriggerPlan_(policyInput || {});
  const normalized = (Array.isArray(triggers) ? triggers : []).map(normalizeTriggerInspection_);
  const matching = normalized.filter(item =>
    item.handlerFunction === policy.handlerFunction &&
    item.triggerType === policy.triggerType &&
    item.intervalMinutes === policy.intervalMinutes
  );
  const obsolete = normalized.filter(item => item.ownedBySgds && item.handlerFunction !== policy.handlerFunction);
  const wrongHandler = normalized.filter(item => item.ownedBySgds && item.handlerFunction !== policy.handlerFunction);
  const wrongInterval = normalized.filter(item => item.handlerFunction === policy.handlerFunction && item.intervalMinutes !== policy.intervalMinutes);
  const unsupported = normalized.filter(item => item.ownedBySgds && item.triggerType !== policy.triggerType);
  const unrelated = normalized.filter(item => !item.ownedBySgds && item.handlerFunction !== policy.handlerFunction);
  let status = 'TRIGGER_MISSING';
  if (matching.length === 1 && !wrongInterval.length && !unsupported.length) status = 'TRIGGER_EXACTLY_ONE_MATCH';
  if (matching.length > 1) status = 'TRIGGER_DUPLICATE_CANONICAL';
  if (wrongInterval.length) status = 'TRIGGER_WRONG_INTERVAL';
  if (wrongHandler.length) status = 'TRIGGER_WRONG_HANDLER';
  if (unsupported.length) status = 'TRIGGER_UNSUPPORTED_TYPE';
  return {
    status,
    matchingCanonicalCount: matching.length,
    duplicateCanonicalCount: Math.max(0, matching.length - 1),
    obsoleteSgdsTriggerCount: obsolete.length,
    unrelatedTriggerCount: unrelated.length,
    unsupportedTriggerCount: unsupported.length,
    wrongHandlerCount: wrongHandler.length,
    wrongIntervalCount: wrongInterval.length,
    wrongTimezoneCount: normalized.filter(item => item.handlerFunction === policy.handlerFunction && item.timezone && item.timezone !== policy.timezone).length,
    ambiguousOwnershipCount: normalized.filter(item => item.ownedBySgds && !item.triggerIdHashPrefix).length,
    deletionCandidates: [],
    triggers: normalized,
    dryRun: true,
    liveMutationAllowed: false,
    schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
  };
}

function detectDuplicateTriggers_(inspection) {
  const source = inspection || {};
  return {
    duplicate: Number(source.duplicateCanonicalCount || 0) > 0,
    duplicateCanonicalCount: Number(source.duplicateCanonicalCount || 0),
    unrelatedTriggersPreserved: true,
    schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
  };
}

function guardTriggerMutation_(request) {
  const source = request || {};
  const genericForce = source.force === true;
  const missing = [];
  ['operation', 'ownerMarker', 'handlerFunction', 'expectedCurrentTriggerFingerprint', 'expectedCount', 'environment'].forEach(field => {
    if (!safeD6gString_(source[field]) && source[field] !== 0) missing.push(field);
  });
  const authorized = false;
  return {
    status: SGDS_D6G_TRIGGER_MUTATION_BLOCKED_STATUS_,
    authorized,
    genericForceAccepted: false,
    genericForceRejected: genericForce,
    missingFields: missing,
    requiredOwnerMarker: 'FUTURE_OWNER_APPROVE_D6G_TRIGGER_MUTATION',
    dryRunRequiredToBeFalseInFutureApprovedPhase: true,
    liveMutationAllowed: false,
    schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
  };
}

function createAppsScriptQuotaGuard_(configInput) {
  const config = normalizeD6gRuntimeConfiguration_(configInput || {});
  return Object.freeze({
    config,
    assertCanStartRun() {
      validateD6gQuotaConfig_(config);
      return { allowed: true, quotaLimits: quotaD6gSnapshot_(config), schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_ };
    },
    evaluateUsage(usage) {
      const source = usage || {};
      const violations = [];
      if (Number(source.messages || 0) > config.maxMessagesPerRun) violations.push('message_limit');
      if (Number(source.jobs || 0) > config.maxJobsPerRun) violations.push('job_limit');
      if (Number(source.attachments || 0) > config.maxAttachmentsPerRun) violations.push('attachment_limit');
      if (Number(source.retryActions || 0) > config.maxRetryActionsPerRun) violations.push('retry_action_limit');
      if (Number(source.virtualDriveWrites || 0) > config.maximumVirtualDriveWritesPerRun) violations.push('virtual_drive_write_limit');
      if (Number(source.virtualSheetsWrites || 0) > config.maximumVirtualSheetsWritesPerRun) violations.push('virtual_sheets_write_limit');
      if (Number(source.firestoreOperations || 0) > config.maximumFirestoreOperationsPerRun) violations.push('firestore_operation_limit');
      if (Number(source.consecutiveFailures || 0) > config.maximumConsecutiveFailures) violations.push('consecutive_failure_limit');
      if (Number(source.runtimeSeconds || 0) > config.softRuntimeDeadlineSeconds) violations.push('runtime_limit');
      return {
        allowed: violations.length === 0,
        stoppedReason: violations[0] || '',
        violations,
        quotaLimits: quotaD6gSnapshot_(config),
        schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
      };
    }
  });
}

function normalizeD6gRuntimeConfiguration_(overrides) {
  const defaults = (typeof SGDS_D6F_DEFAULT_CONFIG_ !== 'undefined') ? SGDS_D6F_DEFAULT_CONFIG_ : {
    runtimeMode: 'local',
    dryRun: true,
    environment: 'local',
    timezone: 'Asia/Ho_Chi_Minh',
    maxMessagesPerRun: 10,
    maxJobsPerRun: 10,
    maxAttachmentsPerRun: 10,
    maxRetriesPerJob: 5,
    maxRetryActionsPerRun: 5,
    softRuntimeDeadlineSeconds: 240,
    leaseDurationSeconds: 360,
    triggerIntervalMinutes: 10,
    maximumConsecutiveFailures: 3,
    supportedMimeTypes: ['application/xml', 'application/pdf'],
    maximumAttachmentBytes: 5000000,
    maximumAuditEventsPerJob: 50,
    maximumFirestoreOperationsPerRun: 200,
    maximumVirtualDriveWritesPerRun: 10,
    maximumVirtualSheetsWritesPerRun: 10,
    canonicalTriggerHandler: 'runSgdsWorkerDryRun'
  };
  const config = {
    ...cloneD6gJson_(defaults),
    ...cloneD6gJson_(overrides || {}),
    dryRun: true,
    environment: safeD6gString_((overrides || {}).environment || defaults.environment),
    triggerIntervalMinutes: Number((overrides || {}).triggerIntervalMinutes || 10),
    schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
  };
  validateD6gRuntimeConfiguration_(config);
  return Object.freeze(config);
}

function validateD6gRuntimeConfiguration_(config) {
  const source = config || {};
  if (!source.environment) throw d6gError_('RUNTIME_CONFIGURATION_MISSING_ENVIRONMENT');
  if (source.environment === 'production') throw d6gError_('RUNTIME_CONFIGURATION_PRODUCTION_BLOCKED');
  if (source.dryRun !== true) throw d6gError_('RUNTIME_CONFIGURATION_DRY_RUN_REQUIRED');
  validateD6gQuotaConfig_(source);
  if (source.canonicalTriggerHandler !== 'runSgdsWorkerDryRun') throw d6gError_('RUNTIME_CONFIGURATION_CANONICAL_HANDLER_REQUIRED');
  return true;
}

function validateD6gQuotaConfig_(config) {
  const checks = [
    ['maxMessagesPerRun', 1, 50],
    ['maxJobsPerRun', 1, 50],
    ['maxAttachmentsPerRun', 1, 50],
    ['maxRetryActionsPerRun', 0, 20],
    ['softRuntimeDeadlineSeconds', 1, 540],
    ['leaseDurationSeconds', 1, 900],
    ['maximumConsecutiveFailures', 1, 10],
    ['maximumAttachmentBytes', 1, 50000000],
    ['maximumAuditEventsPerJob', 1, 200],
    ['maximumFirestoreOperationsPerRun', 1, 1000],
    ['maximumVirtualDriveWritesPerRun', 0, 50],
    ['maximumVirtualSheetsWritesPerRun', 0, 50]
  ];
  checks.forEach(([field, min, max]) => {
    const value = Number(config[field]);
    if (!Number.isFinite(value) || value < min || value > max) throw d6gError_('QUOTA_LIMIT_INVALID:' + field);
  });
  if (!Array.isArray(config.supportedMimeTypes) || !config.supportedMimeTypes.length) throw d6gError_('QUOTA_SUPPORTED_MIME_TYPES_REQUIRED');
  return true;
}

function inspectSgdsTriggerPlan(config) {
  return {
    status: 'TRIGGER_DRY_RUN_PLAN_READY',
    triggerPlan: buildTriggerPlan_(config || {}),
    mutationGuard: guardTriggerMutation_({ operation: 'create', force: true }),
    liveMutationAllowed: false,
    schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
  };
}

function createFakeTriggerTransport_(triggers) {
  const state = { triggers: cloneD6gJson_(triggers || []), mutationCalls: [] };
  return Object.freeze({
    state,
    listTriggers() {
      return cloneD6gJson_(state.triggers);
    },
    createTrigger(request) {
      state.mutationCalls.push({ method: 'createTrigger', request: cloneD6gJson_(request || {}) });
      return guardTriggerMutation_(request || {});
    },
    deleteTrigger(request) {
      state.mutationCalls.push({ method: 'deleteTrigger', request: cloneD6gJson_(request || {}) });
      return guardTriggerMutation_(request || {});
    }
  });
}

function quotaD6gSnapshot_(config) {
  return {
    maxMessagesPerRun: Number(config.maxMessagesPerRun),
    maxJobsPerRun: Number(config.maxJobsPerRun),
    maxAttachmentsPerRun: Number(config.maxAttachmentsPerRun),
    maxRetryActionsPerRun: Number(config.maxRetryActionsPerRun),
    softRuntimeDeadlineSeconds: Number(config.softRuntimeDeadlineSeconds),
    leaseDurationSeconds: Number(config.leaseDurationSeconds),
    maximumConsecutiveFailures: Number(config.maximumConsecutiveFailures),
    maximumAttachmentBytes: Number(config.maximumAttachmentBytes),
    maximumAuditEventsPerJob: Number(config.maximumAuditEventsPerJob),
    maximumFirestoreOperationsPerRun: Number(config.maximumFirestoreOperationsPerRun),
    maximumVirtualDriveWritesPerRun: Number(config.maximumVirtualDriveWritesPerRun),
    maximumVirtualSheetsWritesPerRun: Number(config.maximumVirtualSheetsWritesPerRun),
    schemaVersion: SGDS_D6G_TRIGGER_SCHEMA_VERSION_
  };
}

function normalizeTriggerType_(value) {
  const text = safeD6gString_(value).toLowerCase();
  if (text.includes('clock') || text.includes('time')) return 'time_based';
  return text || 'unknown';
}

function d6gError_(code) {
  const error = new Error(safeD6gString_(code));
  error.code = safeD6gString_(code).split(':')[0];
  return error;
}

function d6gHashPrefix_(value) {
  const text = safeD6gString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function safeD6gString_(value) {
  return value == null ? '' : String(value);
}

function cloneD6gJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
