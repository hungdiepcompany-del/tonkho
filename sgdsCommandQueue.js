const SGDS_D6H_D6I_SCHEMA_VERSION_ = 'SGDS_D6H_D6I_COMMAND_QUEUE_V1';
const SGDS_D6H_D6I_PRODUCTION_ACCESS_ = 'NONE';

const SGDS_D6I_COMMAND_TYPES_ = Object.freeze([
  'retry_job',
  'ignore_job',
  'reprocess_attachment',
  'reconcile_job'
]);

const SGDS_D6I_COMMAND_STATUSES_ = Object.freeze([
  'requested',
  'claimed',
  'executing',
  'completed',
  'rejected',
  'failed'
]);

const SGDS_D6I_ROLE_PERMISSIONS_ = Object.freeze({
  viewer: Object.freeze({ canReadMonitoring: true, canCreateCommands: false, allowedCommands: Object.freeze([]) }),
  operator: Object.freeze({ canReadMonitoring: true, canCreateCommands: true, allowedCommands: Object.freeze(['retry_job', 'reprocess_attachment', 'reconcile_job']) }),
  admin: Object.freeze({ canReadMonitoring: true, canCreateCommands: true, allowedCommands: SGDS_D6I_COMMAND_TYPES_ })
});

const SGDS_D6I_ACTIVE_COMMAND_STATUSES_ = Object.freeze(['requested', 'claimed', 'executing']);

function getSgdsD6hD6iCommandQueueContract_() {
  return Object.freeze({
    schemaVersion: SGDS_D6H_D6I_SCHEMA_VERSION_,
    commandCollection: 'commands/{commandId}',
    authorizedUserCollection: 'authorized_users/{uid}',
    commandTypes: SGDS_D6I_COMMAND_TYPES_,
    statuses: SGDS_D6I_COMMAND_STATUSES_,
    activeStatuses: SGDS_D6I_ACTIVE_COMMAND_STATUSES_,
    roles: Object.keys(SGDS_D6I_ROLE_PERMISSIONS_),
    frontendMayCreateCommands: true,
    frontendMayUpdateCommands: false,
    frontendMayDeleteCommands: false,
    frontendMayWriteJobsDirectly: false,
    productionAccess: SGDS_D6H_D6I_PRODUCTION_ACCESS_
  });
}

function normalizeSgdsAuthorizedUser_(user) {
  const source = user || {};
  const uid = safeD6iString_(source.uid);
  const email = normalizeD6iEmail_(source.email || source.requestedByEmail);
  const role = SGDS_D6I_ROLE_PERMISSIONS_[source.role] ? source.role : 'viewer';
  const allowedCommands = normalizeD6iStringList_(source.allowedCommands).filter(command => SGDS_D6I_COMMAND_TYPES_.includes(command));
  return {
    uid,
    email,
    normalizedEmail: normalizeD6iEmail_(source.normalizedEmail || email),
    displayName: sanitizeD6iText_(source.displayName || ''),
    role,
    active: source.active === true,
    allowedCommands,
    createdAt: safeD6iTimestamp_(source.createdAt),
    updatedAt: safeD6iTimestamp_(source.updatedAt),
    schemaVersion: SGDS_D6H_D6I_SCHEMA_VERSION_
  };
}

function createSgdsCommandIdempotencyKey_(request) {
  const source = request || {};
  const parts = [
    safeD6iString_(source.commandType),
    safeD6iDocumentId_(source.targetJobId),
    safeD6iDocumentId_(source.targetAttachmentId || ''),
    normalizeD6iReasonIntent_(source.reason),
    SGDS_D6H_D6I_SCHEMA_VERSION_
  ];
  return 'cmdem_' + d6iHashPrefix_(parts.join('|'));
}

function createSgdsCommandId_(request) {
  return 'cmd_' + createSgdsCommandIdempotencyKey_(request).replace(/^cmdem_/, '');
}

function createSgdsCommandRequest_(input, actorInput, options) {
  const actor = normalizeSgdsAuthorizedUser_(actorInput || {});
  const source = input || {};
  const commandType = safeD6iString_(source.commandType);
  if (!SGDS_D6I_COMMAND_TYPES_.includes(commandType)) throw d6iError_('COMMAND_TYPE_UNSUPPORTED', 'unsupported command type');
  const targetJobId = safeD6iDocumentId_(source.targetJobId);
  if (!targetJobId) throw d6iError_('TARGET_JOB_ID_INVALID', 'target job id required');
  const targetAttachmentId = safeD6iDocumentId_(source.targetAttachmentId || '');
  const reason = sanitizeD6iReason_(source.reason || '');
  if ((commandType === 'ignore_job' || commandType === 'reprocess_attachment') && !reason) {
    throw d6iError_('COMMAND_REASON_REQUIRED', 'reason required');
  }
  if (!actor.uid || actor.active !== true) throw d6iError_('ACTOR_UNAUTHORIZED', 'active authorized user required');
  if (!isSgdsRoleAllowedForCommand_(actor, commandType)) throw d6iError_('ROLE_NOT_ALLOWED', 'role cannot create command');
  const base = { commandType, targetJobId, targetAttachmentId, reason };
  const idempotencyKey = safeD6iString_(source.idempotencyKey) || createSgdsCommandIdempotencyKey_(base);
  const expectedKey = createSgdsCommandIdempotencyKey_(base);
  if (idempotencyKey !== expectedKey) throw d6iError_('IDEMPOTENCY_KEY_MISMATCH', 'command idempotency mismatch');
  const commandId = safeD6iDocumentId_(source.commandId || createSgdsCommandId_(base));
  if (commandId !== createSgdsCommandId_(base)) throw d6iError_('COMMAND_ID_MISMATCH', 'command id mismatch');
  return Object.freeze({
    commandId,
    commandType,
    targetJobId,
    targetAttachmentId,
    requestedByUid: actor.uid,
    requestedByEmail: actor.email,
    requestedAt: safeD6iTimestamp_(source.requestedAt || (options && options.now) || 'SERVER_TIMESTAMP'),
    reason,
    idempotencyKey,
    status: 'requested',
    claimedBy: '',
    claimedAt: '',
    completedAt: '',
    resultCode: '',
    resultSummary: '',
    failureCode: '',
    failureSummary: '',
    schemaVersion: SGDS_D6H_D6I_SCHEMA_VERSION_
  });
}

function evaluateSgdsCommandEligibility_(commandInput, jobInput, contextInput) {
  const commandType = safeD6iString_(commandInput && commandInput.commandType);
  const job = normalizeD6iJob_(jobInput || {});
  const context = contextInput || {};
  const pendingCommands = Array.isArray(context.pendingCommands) ? context.pendingCommands : [];
  const targetAttachmentId = safeD6iDocumentId_(commandInput && commandInput.targetAttachmentId);
  const currentCommandId = safeD6iDocumentId_(commandInput && commandInput.commandId);
  const duplicateActive = pendingCommands.some(item =>
    safeD6iDocumentId_(item.commandId) !== currentCommandId &&
    SGDS_D6I_ACTIVE_COMMAND_STATUSES_.includes(safeD6iString_(item.status)) &&
    safeD6iString_(item.commandType) === commandType &&
    safeD6iString_(item.targetJobId) === job.jobId &&
    safeD6iString_(item.targetAttachmentId || '') === targetAttachmentId
  );
  if (duplicateActive) return d6iEligibility_('ineligible', 'ACTIVE_DUPLICATE_COMMAND');
  if (!job.jobId) return d6iEligibility_('ineligible', 'TARGET_JOB_MISSING');
  if (commandType === 'retry_job') {
    if (job.status !== 'failed_retryable') return d6iEligibility_('ineligible', 'JOB_NOT_RETRYABLE');
    if (Number(job.attemptCount) >= Number(job.retryPolicy.maxAttempts)) return d6iEligibility_('ineligible', 'RETRY_EXHAUSTED');
    return d6iEligibility_('eligible', 'RETRY_ALLOWED');
  }
  if (commandType === 'ignore_job') {
    if (job.status === 'completed' || job.status === 'ignored') return d6iEligibility_('ineligible', 'JOB_ALREADY_TERMINAL');
    if (!sanitizeD6iReason_(commandInput && commandInput.reason)) return d6iEligibility_('ineligible', 'REASON_REQUIRED');
    return d6iEligibility_('eligible', 'IGNORE_ALLOWED');
  }
  if (commandType === 'reprocess_attachment') {
    if (!targetAttachmentId || !job.attachmentIds.includes(targetAttachmentId)) return d6iEligibility_('ineligible', 'ATTACHMENT_MISSING');
    if (job.leaseOwner) return d6iEligibility_('ineligible', 'JOB_ACTIVE_LEASE');
    return d6iEligibility_('eligible', 'REPROCESS_ALLOWED');
  }
  if (commandType === 'reconcile_job') {
    if (!['incomplete', 'conflicting', 'requires_review', 'partially_reconciled_resumable'].includes(job.reconciliationStatus)) {
      return d6iEligibility_('ineligible', 'RECONCILIATION_NOT_REQUIRED');
    }
    return d6iEligibility_('eligible', 'RECONCILE_ALLOWED');
  }
  return d6iEligibility_('ineligible', 'COMMAND_TYPE_UNSUPPORTED');
}

function createSgdsCommandProcessor_(options) {
  const repository = options && options.repository;
  const worker = options && options.worker;
  const clock = (options && options.clock) || createD6iClock_();
  if (!repository) throw d6iError_('COMMAND_PROCESSOR_REPOSITORY_REQUIRED', 'repository required');
  return Object.freeze({
    runOnce(input) {
      const limit = Math.min(Math.max(Number(input && input.limit || 1), 1), 10);
      const requested = repository.listRequestedCommands(limit);
      const results = [];
      requested.forEach(command => {
        results.push(processD6iCommand_(command, repository, worker, clock));
      });
      return {
        processedCount: results.length,
        results,
        productionCallCount: 0,
        productionMutationCount: 0,
        commandProcessorMode: 'LOCAL_EMULATOR_SIMULATED',
        schemaVersion: SGDS_D6H_D6I_SCHEMA_VERSION_
      };
    }
  });
}

function processD6iCommand_(command, repository, worker, clock) {
  const safeCommand = normalizeD6iCommand_(command);
  try {
    const job = repository.getJob(safeCommand.targetJobId);
    const eligibility = evaluateSgdsCommandEligibility_(safeCommand, job, { pendingCommands: repository.listCommands() });
    if (eligibility.status !== 'eligible') {
      repository.updateCommandStatus(safeCommand.commandId, {
        status: 'rejected',
        failureCode: eligibility.code,
        failureSummary: sanitizeD6iText_(eligibility.code),
        completedAt: clock.now()
      });
      repository.appendCommandAudit(safeCommand.commandId, 'command_rejected', eligibility.code);
      return d6iProcessorResult_(safeCommand, 'rejected', eligibility.code);
    }
    const claimed = repository.claimCommand(safeCommand.commandId, 'local-apps-script-worker', clock.now());
    if (!claimed.claimed) return d6iProcessorResult_(safeCommand, 'no_op', claimed.code || 'COMMAND_ALREADY_CLAIMED');
    repository.appendCommandAudit(safeCommand.commandId, 'command_claimed', safeCommand.commandType);
    const action = simulateD6iCommandAction_(safeCommand, job, repository, worker);
    repository.updateCommandStatus(safeCommand.commandId, {
      status: action.ok ? 'completed' : 'failed',
      resultCode: action.ok ? action.code : '',
      resultSummary: action.ok ? sanitizeD6iText_(action.summary) : '',
      failureCode: action.ok ? '' : action.code,
      failureSummary: action.ok ? '' : sanitizeD6iText_(action.summary),
      completedAt: clock.now()
    });
    repository.appendCommandAudit(safeCommand.commandId, action.ok ? 'command_completed' : 'command_failed', action.code);
    return d6iProcessorResult_(safeCommand, action.ok ? 'completed' : 'failed', action.code);
  } catch (error) {
    repository.updateCommandStatus(safeCommand.commandId, {
      status: 'failed',
      failureCode: error.code || 'COMMAND_PROCESSOR_ERROR',
      failureSummary: sanitizeD6iText_(error.safeMessage || error.message),
      completedAt: clock.now()
    });
    repository.appendCommandAudit(safeCommand.commandId, 'command_failed', error.code || 'COMMAND_PROCESSOR_ERROR');
    return d6iProcessorResult_(safeCommand, 'failed', error.code || 'COMMAND_PROCESSOR_ERROR');
  }
}

function simulateD6iCommandAction_(command, job, repository, worker) {
  if (command.commandType === 'retry_job') {
    repository.updateJob(job.jobId, { status: 'queued', nextRetryAt: '', commandId: command.commandId });
    if (worker && typeof worker.run === 'function') worker.run({ invocationSource: 'retry_command', correlationId: 'cmd_' + command.commandId });
    return { ok: true, code: 'RETRY_REQUEUED', summary: 'retry queued locally' };
  }
  if (command.commandType === 'ignore_job') {
    repository.updateJob(job.jobId, { status: 'ignored', commandId: command.commandId });
    return { ok: true, code: 'JOB_IGNORED_LOCALLY', summary: 'job ignored locally' };
  }
  if (command.commandType === 'reprocess_attachment') {
    repository.addCheckpoint(job.jobId, 'attachment_reprocess_requested', command.commandId);
    return { ok: true, code: 'ATTACHMENT_REPROCESS_SIMULATED', summary: 'attachment reprocess simulated' };
  }
  if (command.commandType === 'reconcile_job') {
    repository.setReconciliation(job.jobId, { state: 'requires_review', commandId: command.commandId });
    return { ok: true, code: 'RECONCILIATION_SIMULATED', summary: 'reconciliation simulated' };
  }
  return { ok: false, code: 'COMMAND_TYPE_UNSUPPORTED', summary: 'unsupported command type' };
}

function createFakeSgdsCommandRepository_(seed) {
  const source = seed || {};
  const jobs = new Map((Array.isArray(source.jobs) ? source.jobs : []).map(job => [safeD6iDocumentId_(job.jobId), normalizeD6iJob_(job)]));
  const commands = new Map((Array.isArray(source.commands) ? source.commands : []).map(command => [safeD6iDocumentId_(command.commandId), normalizeD6iCommand_(command)]));
  const commandAudit = [];
  const checkpoints = [];
  const reconciliations = new Map((Array.isArray(source.reconciliations) ? source.reconciliations : []).map(item => [safeD6iDocumentId_(item.jobId), cloneD6iJson_(item)]));
  return Object.freeze({
    createCommand(command) {
      const normalized = normalizeD6iCommand_(command);
      const existing = commands.get(normalized.commandId);
      if (existing) {
        if (existing.idempotencyKey === normalized.idempotencyKey) return { created: false, duplicate: true, command: cloneD6iJson_(existing) };
        throw d6iError_('COMMAND_ID_CONFLICT', 'command id conflict');
      }
      commands.set(normalized.commandId, normalized);
      return { created: true, duplicate: false, command: cloneD6iJson_(normalized) };
    },
    listCommands() {
      return Array.from(commands.values()).map(cloneD6iJson_);
    },
    listRequestedCommands(limit) {
      return Array.from(commands.values()).filter(command => command.status === 'requested').slice(0, Number(limit || 1)).map(cloneD6iJson_);
    },
    getCommand(commandId) {
      const command = commands.get(safeD6iDocumentId_(commandId));
      return command ? cloneD6iJson_(command) : null;
    },
    claimCommand(commandId, workerId, now) {
      const command = commands.get(safeD6iDocumentId_(commandId));
      if (!command) return { claimed: false, code: 'COMMAND_MISSING' };
      if (command.status !== 'requested') return { claimed: false, code: 'COMMAND_NOT_REQUESTED' };
      command.status = 'claimed';
      command.claimedBy = sanitizeD6iText_(workerId);
      command.claimedAt = safeD6iTimestamp_(now);
      return { claimed: true, command: cloneD6iJson_(command) };
    },
    updateCommandStatus(commandId, patch) {
      const command = commands.get(safeD6iDocumentId_(commandId));
      if (!command) throw d6iError_('COMMAND_MISSING', 'command missing');
      Object.assign(command, cloneD6iJson_(patch || {}));
      return cloneD6iJson_(command);
    },
    getJob(jobId) {
      const job = jobs.get(safeD6iDocumentId_(jobId));
      return job ? cloneD6iJson_(job) : null;
    },
    updateJob(jobId, patch) {
      const id = safeD6iDocumentId_(jobId);
      const job = jobs.get(id);
      if (!job) throw d6iError_('TARGET_JOB_MISSING', 'target job missing');
      Object.assign(job, cloneD6iJson_(patch || {}));
      return cloneD6iJson_(job);
    },
    addCheckpoint(jobId, name, correlationId) {
      checkpoints.push({ jobId: safeD6iDocumentId_(jobId), name: safeD6iString_(name), correlationId: safeD6iString_(correlationId) });
      return cloneD6iJson_(checkpoints[checkpoints.length - 1]);
    },
    listCheckpoints(jobId) {
      return checkpoints.filter(item => item.jobId === safeD6iDocumentId_(jobId)).map(cloneD6iJson_);
    },
    setReconciliation(jobId, report) {
      reconciliations.set(safeD6iDocumentId_(jobId), cloneD6iJson_(report || {}));
      return cloneD6iJson_(report || {});
    },
    appendCommandAudit(commandId, eventType, summary) {
      commandAudit.push({
        commandId: safeD6iDocumentId_(commandId),
        eventType: safeD6iString_(eventType),
        summary: sanitizeD6iText_(summary),
        schemaVersion: SGDS_D6H_D6I_SCHEMA_VERSION_
      });
      return cloneD6iJson_(commandAudit[commandAudit.length - 1]);
    },
    listCommandAudit() {
      return commandAudit.map(cloneD6iJson_);
    }
  });
}

function normalizeD6iCommand_(command) {
  const source = command || {};
  return {
    commandId: safeD6iDocumentId_(source.commandId),
    commandType: safeD6iString_(source.commandType),
    targetJobId: safeD6iDocumentId_(source.targetJobId),
    targetAttachmentId: safeD6iDocumentId_(source.targetAttachmentId || ''),
    requestedByUid: safeD6iDocumentId_(source.requestedByUid),
    requestedByEmail: normalizeD6iEmail_(source.requestedByEmail),
    requestedAt: safeD6iTimestamp_(source.requestedAt),
    reason: sanitizeD6iReason_(source.reason || ''),
    idempotencyKey: safeD6iString_(source.idempotencyKey),
    status: SGDS_D6I_COMMAND_STATUSES_.includes(source.status) ? source.status : 'requested',
    claimedBy: sanitizeD6iText_(source.claimedBy || ''),
    claimedAt: safeD6iTimestamp_(source.claimedAt || ''),
    completedAt: safeD6iTimestamp_(source.completedAt || ''),
    resultCode: safeD6iString_(source.resultCode || ''),
    resultSummary: sanitizeD6iText_(source.resultSummary || ''),
    failureCode: safeD6iString_(source.failureCode || ''),
    failureSummary: sanitizeD6iText_(source.failureSummary || ''),
    schemaVersion: SGDS_D6H_D6I_SCHEMA_VERSION_
  };
}

function normalizeD6iJob_(job) {
  const source = job || {};
  return {
    jobId: safeD6iDocumentId_(source.jobId),
    status: safeD6iString_(source.status || 'queued'),
    attemptCount: Number(source.attemptCount || 0),
    retryPolicy: {
      maxAttempts: Number(source.retryPolicy && source.retryPolicy.maxAttempts || source.maxAttempts || 5)
    },
    leaseOwner: safeD6iString_(source.leaseOwner || ''),
    attachmentIds: normalizeD6iStringList_(source.attachmentIds),
    reconciliationStatus: safeD6iString_(source.reconciliationStatus || source.latestReconciliationStatus || 'consistent'),
    currentStep: safeD6iString_(source.currentStep || ''),
    lastErrorMessage: sanitizeD6iText_(source.lastErrorMessage || '')
  };
}

function isSgdsRoleAllowedForCommand_(actor, commandType) {
  const permissions = SGDS_D6I_ROLE_PERMISSIONS_[actor.role] || SGDS_D6I_ROLE_PERMISSIONS_.viewer;
  if (!permissions.canCreateCommands) return false;
  const explicit = actor.allowedCommands && actor.allowedCommands.length ? actor.allowedCommands : permissions.allowedCommands;
  return explicit.includes(commandType);
}

function d6iEligibility_(status, code) {
  return { status, code, eligible: status === 'eligible', schemaVersion: SGDS_D6H_D6I_SCHEMA_VERSION_ };
}

function d6iProcessorResult_(command, status, code) {
  return {
    commandId: command.commandId,
    commandType: command.commandType,
    status,
    code,
    productionCallCount: 0,
    productionMutationCount: 0,
    schemaVersion: SGDS_D6H_D6I_SCHEMA_VERSION_
  };
}

function createD6iClock_(start) {
  let current = Date.parse(start || '2026-07-18T00:00:00.000Z');
  return Object.freeze({
    now() {
      return new Date(current).toISOString();
    },
    advanceSeconds(seconds) {
      current += Number(seconds || 0) * 1000;
      return new Date(current).toISOString();
    }
  });
}

function sanitizeD6iReason_(value) {
  return sanitizeD6iText_(value).slice(0, 300).trim();
}

function normalizeD6iReasonIntent_(value) {
  return sanitizeD6iReason_(value).toLowerCase().replace(/\s+/g, ' ');
}

function sanitizeD6iText_(value) {
  const text = safeD6iString_(value);
  if (!text) return '';
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const secretWords = ['authorization', 'bearer', 'oauth', 'token', 'credential', 'cookie', ['ya', '29'].join(''), ['private', 'key'].join(' ')];
  const secretPattern = new RegExp(secretWords.join('|'), 'i');
  if (secretPattern.test(text)) return 'REDACTED_SECRET';
  if (text.length > 500) return text.slice(0, 500);
  return text;
}

function safeD6iDocumentId_(value) {
  const text = safeD6iString_(value).trim();
  if (!text) return '';
  return /^[A-Za-z0-9_-]{1,96}$/.test(text) ? text : '';
}

function normalizeD6iEmail_(value) {
  const text = safeD6iString_(value).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text) ? text : '';
}

function normalizeD6iStringList_(value) {
  return (Array.isArray(value) ? value : []).map(safeD6iString_).filter(Boolean);
}

function safeD6iTimestamp_(value) {
  const text = safeD6iString_(value);
  if (text === 'SERVER_TIMESTAMP') return text;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function d6iHashPrefix_(value) {
  const text = safeD6iString_(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function d6iError_(code, message) {
  const error = new Error(safeD6iString_(code) + ':' + sanitizeD6iText_(message || code));
  error.code = safeD6iString_(code);
  error.safeMessage = sanitizeD6iText_(message || code);
  return error;
}

function safeD6iString_(value) {
  return value == null ? '' : String(value);
}

function cloneD6iJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
