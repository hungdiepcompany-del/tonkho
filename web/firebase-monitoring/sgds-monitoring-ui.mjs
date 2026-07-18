export const SGDS_D6H_UI_SCHEMA_VERSION = 'SGDS_D6H_D6I_FIREBASE_UI_COMMAND_QUEUE_V1';

export const AUTH_STATES = Object.freeze([
  'auth_initializing',
  'signed_out',
  'signing_in',
  'signed_in_unverified',
  'authorized',
  'unauthorized',
  'disabled_user',
  'auth_error'
]);

export const COMMAND_TYPES = Object.freeze(['retry_job', 'ignore_job', 'reprocess_attachment', 'reconcile_job']);
export const COMMAND_STATUSES = Object.freeze(['requested', 'claimed', 'executing', 'completed', 'rejected', 'failed']);
export const AUTHORIZED_USER_COLLECTION_CONTRACT = 'authorized_users/{uid}';
export const BOUNDED_QUERY_LIMIT = 25;

export function createAuthStateMachine() {
  let state = 'auth_initializing';
  let currentUser = null;
  let authorizedUser = null;
  let safeError = '';
  const privilegedState = { jobs: [], commands: [], selectedJob: null };
  return {
    getState() {
      return { state, currentUser, authorizedUser, safeError, privilegedState: clone(privilegedState) };
    },
    signedOut() {
      state = 'signed_out';
      currentUser = null;
      authorizedUser = null;
      safeError = '';
      clearPrivilegedState(privilegedState);
      return this.getState();
    },
    signingIn() {
      state = 'signing_in';
      return this.getState();
    },
    signedIn(firebaseUser) {
      currentUser = normalizeFirebaseUser(firebaseUser);
      state = currentUser.uid ? 'signed_in_unverified' : 'signed_out';
      return this.getState();
    },
    authorize(authDoc) {
      const normalized = normalizeAuthorizedUser(authDoc || {});
      if (!currentUser || normalized.uid !== currentUser.uid) {
        state = 'unauthorized';
        authorizedUser = null;
      } else if (normalized.active !== true) {
        state = 'disabled_user';
        authorizedUser = normalized;
      } else {
        state = 'authorized';
        authorizedUser = normalized;
      }
      return this.getState();
    },
    fail(error) {
      state = 'auth_error';
      safeError = sanitizeUiText(error && (error.code || error.message || error));
      clearPrivilegedState(privilegedState);
      return this.getState();
    },
    clearPrivilegedState() {
      clearPrivilegedState(privilegedState);
      return this.getState();
    }
  };
}

export function normalizeFirebaseUser(user) {
  const source = user || {};
  return {
    uid: safeDocumentId(source.uid),
    email: normalizeEmail(source.email),
    displayName: sanitizeUiText(source.displayName || ''),
    photoURL: ''
  };
}

export function normalizeAuthorizedUser(doc) {
  const source = doc || {};
  const role = ['admin', 'operator', 'viewer'].includes(source.role) ? source.role : 'viewer';
  return {
    uid: safeDocumentId(source.uid),
    email: normalizeEmail(source.email),
    normalizedEmail: normalizeEmail(source.normalizedEmail || source.email),
    displayName: sanitizeUiText(source.displayName || ''),
    role,
    active: source.active === true,
    allowedCommands: normalizeStringList(source.allowedCommands).filter(item => COMMAND_TYPES.includes(item)),
    createdAt: safeTimestamp(source.createdAt),
    updatedAt: safeTimestamp(source.updatedAt),
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function createReadModelService(transport, options = {}) {
  const queryLimit = boundedLimit(options.queryLimit || BOUNDED_QUERY_LIMIT);
  return {
    async loadDashboard(filters = {}) {
      const jobs = (await transport.query('jobs', buildJobQuery(filters, queryLimit))).map(normalizeJob);
      const commands = (await transport.query('commands', { orderBy: [['requestedAt', 'desc']], limit: queryLimit })).map(normalizeCommand);
      return buildDashboardSummary(jobs, commands);
    },
    async loadJobs(filters = {}) {
      return (await transport.query('jobs', buildJobQuery(filters, queryLimit))).map(normalizeJob);
    },
    async loadJobDetail(jobId) {
      const safeJobId = safeDocumentId(jobId);
      if (!safeJobId) throw safeUiError('INVALID_JOB_ID');
      const [job, audit, attachments, gmailMessages, commands] = await Promise.all([
        transport.get('jobs', safeJobId),
        transport.query('audit_events', { where: [['jobId', '==', safeJobId]], orderBy: [['occurredAt', 'asc']], limit: queryLimit }),
        transport.query('attachments', { where: [['jobId', '==', safeJobId]], orderBy: [['updatedAt', 'desc']], limit: queryLimit }),
        transport.query('gmail_messages', { where: [['jobId', '==', safeJobId]], orderBy: [['receivedAt', 'desc']], limit: queryLimit }),
        transport.query('commands', { where: [['targetJobId', '==', safeJobId]], orderBy: [['requestedAt', 'desc']], limit: queryLimit })
      ]);
      return {
        job: normalizeJob(job),
        auditTimeline: audit.map(normalizeAuditEvent),
        attachments: attachments.map(normalizeAttachment),
        gmailMessages: gmailMessages.map(normalizeGmailMessage),
        commands: commands.map(normalizeCommand),
        schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
      };
    },
    async loadRunSummaries() {
      return (await transport.query('worker_run_summaries', { orderBy: [['startedAt', 'desc']], limit: Math.min(queryLimit, 10) })).map(normalizeRunSummary);
    }
  };
}

export function buildJobQuery(filters = {}, queryLimit = BOUNDED_QUERY_LIMIT) {
  const where = [];
  if (filters.status) where.push(['status', '==', sanitizeUiText(filters.status)]);
  if (filters.reviewRequired === true) where.push(['reviewRequired', '==', true]);
  if (filters.source) where.push(['sourceType', '==', sanitizeUiText(filters.source)]);
  if (filters.fromDate) where.push(['updatedAt', '>=', safeTimestamp(filters.fromDate)]);
  if (filters.toDate) where.push(['updatedAt', '<=', safeTimestamp(filters.toDate)]);
  return { where, orderBy: [['updatedAt', 'desc']], limit: boundedLimit(queryLimit) };
}

export function buildDashboardSummary(jobs, commands) {
  const counts = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed_retryable: 0,
    failed_terminal: 0,
    review_required: 0,
    commands_pending: 0,
    commands_failed: 0,
    duplicate_no_op: 0
  };
  jobs.forEach(job => {
    if (Object.prototype.hasOwnProperty.call(counts, job.status)) counts[job.status] += 1;
    if (job.reviewRequired || job.reconciliationStatus === 'requires_review') counts.review_required += 1;
    if (job.reconciliationStatus === 'duplicate_source_no_op') counts.duplicate_no_op += 1;
  });
  commands.forEach(command => {
    if (['requested', 'claimed', 'executing'].includes(command.status)) counts.commands_pending += 1;
    if (command.status === 'failed' || command.status === 'rejected') counts.commands_failed += 1;
  });
  return {
    counts,
    mostRecentWorkerRun: jobs[0] ? jobs[0].updatedAt : '',
    mostRecentSuccessfulCompletion: jobs.find(job => job.status === 'completed')?.completedAt || '',
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function normalizeJob(job) {
  const source = job || {};
  return {
    jobId: safeDocumentId(source.jobId || source.id),
    status: sanitizeUiText(source.status || 'unknown'),
    currentStep: sanitizeUiText(source.currentStep || ''),
    attemptCount: Number(source.attemptCount || 0),
    retryEligible: source.retryEligible === true || source.status === 'failed_retryable',
    nextRetryAt: safeTimestamp(source.nextRetryAt),
    leaseOwner: source.leaseOwner ? 'LEASE_PRESENT' : '',
    attachmentIds: normalizeStringList(source.attachmentIds).map(safeDocumentId).filter(Boolean),
    gmailMessageId: safeDocumentId(source.gmailMessageId),
    sheetBusinessKeyHash: sanitizeUiText(source.sheetBusinessKeyHash || ''),
    reconciliationStatus: sanitizeUiText(source.reconciliationStatus || source.latestReconciliationStatus || ''),
    reviewRequired: source.reviewRequired === true,
    lastErrorCode: sanitizeUiText(source.lastErrorCode || ''),
    lastErrorMessage: sanitizeUiText(source.lastErrorMessage || ''),
    updatedAt: safeTimestamp(source.updatedAt),
    completedAt: safeTimestamp(source.completedAt),
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function normalizeCommand(command) {
  const source = command || {};
  return {
    commandId: safeDocumentId(source.commandId || source.id),
    commandType: COMMAND_TYPES.includes(source.commandType) ? source.commandType : 'unsupported',
    targetJobId: safeDocumentId(source.targetJobId),
    targetAttachmentId: safeDocumentId(source.targetAttachmentId || ''),
    requestedByUid: safeDocumentId(source.requestedByUid),
    requestedByEmail: normalizeEmail(source.requestedByEmail),
    requestedAt: safeTimestamp(source.requestedAt),
    reason: sanitizeUiText(source.reason || ''),
    idempotencyKey: sanitizeUiText(source.idempotencyKey || ''),
    status: COMMAND_STATUSES.includes(source.status) ? source.status : 'requested',
    resultCode: sanitizeUiText(source.resultCode || ''),
    resultSummary: sanitizeUiText(source.resultSummary || ''),
    failureCode: sanitizeUiText(source.failureCode || ''),
    failureSummary: sanitizeUiText(source.failureSummary || ''),
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function normalizeAuditEvent(event) {
  const source = event || {};
  return {
    eventType: sanitizeUiText(source.eventType || ''),
    timestamp: safeTimestamp(source.occurredAt || source.timestamp),
    actorType: sanitizeUiText(source.actorType || source.actor && source.actor.type || ''),
    actorId: safeDocumentId(source.actorId || source.actor && source.actor.id || ''),
    priorState: sanitizeUiText(source.priorState || ''),
    nextState: sanitizeUiText(source.nextState || ''),
    correlationId: sanitizeUiText(source.correlationId || ''),
    redactedSummary: sanitizeUiText(source.redactedSummary || source.summary || source.safeDetails || ''),
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function normalizeAttachment(attachment) {
  const source = attachment || {};
  return {
    attachmentId: safeDocumentId(source.attachmentId || source.id),
    jobId: safeDocumentId(source.jobId),
    mimeType: sanitizeUiText(source.mimeType || ''),
    sha256Prefix: sanitizeUiText(source.sha256Prefix || source.sha256 || '').slice(0, 12),
    driveFileIdHashPrefix: sanitizeUiText(source.driveFileIdHashPrefix || ''),
    sizeBytes: Number(source.sizeBytes || source.byteSize || 0),
    updatedAt: safeTimestamp(source.updatedAt),
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function normalizeGmailMessage(message) {
  const source = message || {};
  return {
    gmailMessageId: safeDocumentId(source.gmailMessageId || source.id),
    jobId: safeDocumentId(source.jobId),
    threadHashPrefix: sanitizeUiText(source.threadHashPrefix || ''),
    senderHashPrefix: sanitizeUiText(source.senderHashPrefix || ''),
    subjectHashPrefix: sanitizeUiText(source.subjectHashPrefix || ''),
    direction: sanitizeUiText(source.direction || ''),
    receivedAt: safeTimestamp(source.receivedAt),
    labelProjectionStatus: sanitizeUiText(source.labelProjectionStatus || ''),
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function normalizeRunSummary(summary) {
  const source = summary || {};
  return {
    runId: safeDocumentId(source.runId || source.id),
    startedAt: safeTimestamp(source.startedAt),
    finishedAt: safeTimestamp(source.finishedAt),
    status: sanitizeUiText(source.status || ''),
    attemptedJobCount: Number(source.attemptedJobCount || 0),
    completedCount: Number(source.completedCount || 0),
    failedCount: Number(source.failedCount || 0),
    productionCallCount: Number(source.productionCallCount || 0),
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function evaluateUiCommandEligibility(commandType, job, context = {}) {
  const normalizedJob = normalizeJob(job);
  const pending = Array.isArray(context.pendingCommands) ? context.pendingCommands.map(normalizeCommand) : [];
  const targetAttachmentId = safeDocumentId(context.targetAttachmentId || '');
  const duplicate = pending.some(command =>
    ['requested', 'claimed', 'executing'].includes(command.status) &&
    command.commandType === commandType &&
    command.targetJobId === normalizedJob.jobId &&
    command.targetAttachmentId === targetAttachmentId
  );
  if (duplicate) return { eligible: false, code: 'ACTIVE_DUPLICATE_COMMAND' };
  if (commandType === 'retry_job') {
    if (normalizedJob.status !== 'failed_retryable') return { eligible: false, code: 'JOB_NOT_RETRYABLE' };
    if (normalizedJob.attemptCount >= Number(context.maxAttempts || 5)) return { eligible: false, code: 'RETRY_EXHAUSTED' };
    return { eligible: true, code: 'RETRY_ALLOWED' };
  }
  if (commandType === 'ignore_job') {
    if (!sanitizeUiText(context.reason || '')) return { eligible: false, code: 'REASON_REQUIRED' };
    if (['completed', 'ignored'].includes(normalizedJob.status)) return { eligible: false, code: 'JOB_ALREADY_TERMINAL' };
    return { eligible: true, code: 'IGNORE_ALLOWED' };
  }
  if (commandType === 'reprocess_attachment') {
    if (!targetAttachmentId || !normalizedJob.attachmentIds.includes(targetAttachmentId)) return { eligible: false, code: 'ATTACHMENT_MISSING' };
    if (normalizedJob.leaseOwner) return { eligible: false, code: 'JOB_ACTIVE_LEASE' };
    return { eligible: true, code: 'REPROCESS_ALLOWED' };
  }
  if (commandType === 'reconcile_job') {
    if (!['incomplete', 'conflicting', 'requires_review', 'partially_reconciled_resumable'].includes(normalizedJob.reconciliationStatus)) {
      return { eligible: false, code: 'RECONCILIATION_NOT_REQUIRED' };
    }
    return { eligible: true, code: 'RECONCILE_ALLOWED' };
  }
  return { eligible: false, code: 'COMMAND_TYPE_UNSUPPORTED' };
}

export function buildCommandRequest(input, actor, options = {}) {
  const commandType = COMMAND_TYPES.includes(input && input.commandType) ? input.commandType : '';
  if (!commandType) throw safeUiError('COMMAND_TYPE_UNSUPPORTED');
  const authorizedUser = normalizeAuthorizedUser(actor || {});
  if (!authorizedUser.active || !roleCanCreateCommand(authorizedUser, commandType)) throw safeUiError('ROLE_NOT_ALLOWED');
  const reason = sanitizeReason(input.reason || '');
  if ((commandType === 'ignore_job' || commandType === 'reprocess_attachment') && !reason) throw safeUiError('REASON_REQUIRED');
  const targetJobId = safeDocumentId(input.targetJobId);
  if (!targetJobId) throw safeUiError('INVALID_TARGET_JOB');
  const targetAttachmentId = safeDocumentId(input.targetAttachmentId || '');
  const intent = { commandType, targetJobId, targetAttachmentId, reason };
  const idempotencyKey = createUiIdempotencyKey(intent);
  return {
    commandId: 'cmd_' + idempotencyKey.replace(/^cmdem_/, ''),
    commandType,
    targetJobId,
    targetAttachmentId,
    requestedByUid: authorizedUser.uid,
    requestedByEmail: authorizedUser.email,
    requestedAt: options.serverTimestamp || 'SERVER_TIMESTAMP',
    reason,
    idempotencyKey,
    status: 'requested',
    schemaVersion: SGDS_D6H_UI_SCHEMA_VERSION
  };
}

export function createUiIdempotencyKey(input) {
  const source = input || {};
  return 'cmdem_' + hashPrefix([
    source.commandType,
    safeDocumentId(source.targetJobId),
    safeDocumentId(source.targetAttachmentId || ''),
    sanitizeReason(source.reason || '').toLowerCase().replace(/\s+/g, ' '),
    SGDS_D6H_UI_SCHEMA_VERSION
  ].join('|'));
}

export function roleCanCreateCommand(user, commandType) {
  const source = normalizeAuthorizedUser(user || {});
  if (source.role === 'viewer') return false;
  const roleDefault = source.role === 'admin'
    ? COMMAND_TYPES
    : ['retry_job', 'reprocess_attachment', 'reconcile_job'];
  const allowed = source.allowedCommands.length ? source.allowedCommands : roleDefault;
  return allowed.includes(commandType);
}

export function renderMonitoringApp(model) {
  const state = model || {};
  if (state.authState === 'auth_initializing') return '<section data-state="loading">Loading</section>';
  if (state.authState === 'signed_out') return '<section data-state="signed-out"><button data-action="google-sign-in">Sign in with Google</button></section>';
  if (state.authState === 'unauthorized' || state.authState === 'disabled_user') return '<section data-state="access-denied">Access denied</section>';
  if (state.authState === 'auth_error') return `<section data-state="auth-error">${escapeHtml(state.safeError || 'Authentication error')}</section>`;
  const dashboard = state.dashboard || { counts: {} };
  const jobs = Array.isArray(state.jobs) ? state.jobs.map(normalizeJob) : [];
  const commands = Array.isArray(state.commands) ? state.commands.map(normalizeCommand) : [];
  return [
    '<main data-state="authorized">',
    state.emulatorMode ? '<strong data-testid="emulator-mode">LOCAL EMULATOR</strong>' : '',
    '<section data-view="dashboard">',
    renderMetric('Queued', dashboard.counts.queued),
    renderMetric('Processing', dashboard.counts.processing),
    renderMetric('Completed', dashboard.counts.completed),
    renderMetric('Review', dashboard.counts.review_required),
    '</section>',
    '<section data-view="jobs">',
    jobs.length ? jobs.map(renderJobRow).join('') : '<p data-empty="jobs">No jobs</p>',
    '</section>',
    '<section data-view="commands">',
    commands.length ? commands.map(command => `<article data-command-id="${escapeAttr(command.commandId)}">${escapeHtml(command.commandType)} ${escapeHtml(command.status)}</article>`).join('') : '<p data-empty="commands">No commands</p>',
    '</section>',
    '</main>'
  ].join('');
}

export function createFakeFirestoreTransport(seed = {}) {
  const collections = new Map(Object.entries(seed)
    .filter(([, docs]) => Array.isArray(docs))
    .map(([name, docs]) => [name, new Map((docs || []).map(doc => [doc.id || doc.jobId || doc.commandId || doc.attachmentId || doc.eventId || doc.runId, clone(doc)]))]));
  const calls = [];
  return {
    calls,
    async query(collection, query) {
      calls.push({ method: 'query', collection, query: clone(query) });
      if (!query || !Number.isFinite(Number(query.limit)) || Number(query.limit) > BOUNDED_QUERY_LIMIT) throw safeUiError('UNBOUNDED_QUERY_DENIED');
      const docs = Array.from((collections.get(collection) || new Map()).values());
      return applyLocalQuery(docs, query);
    },
    async get(collection, id) {
      calls.push({ method: 'get', collection, id: safeDocumentId(id) });
      return clone((collections.get(collection) || new Map()).get(safeDocumentId(id)) || null);
    },
    async create(collection, id, doc) {
      calls.push({ method: 'create', collection, id: safeDocumentId(id), doc: sanitizeForCallLog(doc) });
      if (collection !== 'commands') throw safeUiError('FRONTEND_DIRECT_WRITE_DENIED');
      const map = collections.get(collection) || new Map();
      if (map.has(id)) throw safeUiError('DUPLICATE_COMMAND');
      map.set(id, clone(doc));
      collections.set(collection, map);
      return clone(doc);
    },
    async update() {
      throw safeUiError('FRONTEND_UPDATE_DENIED');
    },
    async delete() {
      throw safeUiError('FRONTEND_DELETE_DENIED');
    }
  };
}

export function validateFirebaseWebConfig(config, options = {}) {
  const source = config || {};
  if (options.emulator !== true && source.projectId && /^demo-/.test(source.projectId)) throw safeUiError('DEMO_PROJECT_IN_PRODUCTION_CONFIG');
  const serialized = JSON.stringify(source).toLowerCase();
  const privateKeyMarker = ['private', 'key'].join('_');
  const clientSecretMarker = ['client', 'secret'].join('_');
  const serviceAccountMarker = ['service', 'account'].join('_');
  if (serialized.includes(privateKeyMarker) || serialized.includes(clientSecretMarker) || serialized.includes(serviceAccountMarker)) {
    throw safeUiError('ADMIN_CREDENTIAL_SHAPED_CONFIG_REJECTED');
  }
  return {
    projectId: sanitizeUiText(source.projectId || ''),
    authDomain: sanitizeUiText(source.authDomain || ''),
    emulator: options.emulator === true,
    publicWebConfigOnly: true
  };
}

function applyLocalQuery(docs, query) {
  let out = docs.map(clone);
  (query.where || []).forEach(([field, op, expected]) => {
    out = out.filter(doc => op === '==' ? doc[field] === expected : op === '>=' ? doc[field] >= expected : op === '<=' ? doc[field] <= expected : false);
  });
  (query.orderBy || []).slice().reverse().forEach(([field, direction]) => {
    out.sort((a, b) => direction === 'asc' ? String(a[field] || '').localeCompare(String(b[field] || '')) : String(b[field] || '').localeCompare(String(a[field] || '')));
  });
  return out.slice(0, boundedLimit(query.limit));
}

function renderMetric(label, value) {
  return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${Number(value || 0)}</strong></div>`;
}

function renderJobRow(job) {
  return `<article data-job-id="${escapeAttr(job.jobId)}"><h2>${escapeHtml(job.jobId)}</h2><p>${escapeHtml(job.status)} ${escapeHtml(job.currentStep)}</p><small>${escapeHtml(job.lastErrorMessage)}</small></article>`;
}

function clearPrivilegedState(state) {
  state.jobs = [];
  state.commands = [];
  state.selectedJob = null;
}

function boundedLimit(value) {
  return Math.min(Math.max(Number(value || BOUNDED_QUERY_LIMIT), 1), BOUNDED_QUERY_LIMIT);
}

function sanitizeReason(value) {
  return sanitizeUiText(value).slice(0, 300).trim();
}

function sanitizeUiText(value) {
  const text = value == null ? '' : String(value);
  if (!text) return '';
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const secretNeedles = ['authorization', 'bearer', 'oauth', 'token', 'credential', 'cookie', ['ya', '29'].join(''), ['private', 'key'].join(' ')];
  if (secretNeedles.some(marker => text.toLowerCase().includes(marker))) return 'REDACTED_SECRET';
  return text.slice(0, 500);
}

function sanitizeForCallLog(value) {
  if (Array.isArray(value)) return value.map(sanitizeForCallLog);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach(key => { out[key] = sanitizeForCallLog(value[key]); });
    return out;
  }
  return sanitizeUiText(value);
}

function normalizeEmail(value) {
  const text = value == null ? '' : String(value).trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text) ? text : '';
}

function normalizeStringList(value) {
  return (Array.isArray(value) ? value : []).map(item => item == null ? '' : String(item)).filter(Boolean);
}

function safeDocumentId(value) {
  const text = value == null ? '' : String(value).trim();
  return /^[A-Za-z0-9_-]{1,96}$/.test(text) ? text : '';
}

function safeTimestamp(value) {
  if (value === 'SERVER_TIMESTAMP') return value;
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : '';
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function hashPrefix(value) {
  const text = String(value == null ? '' : value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return ('00000000' + (hash >>> 0).toString(16)).slice(-8);
}

function safeUiError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
