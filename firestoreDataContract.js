const SGDS_D6_SCHEMA_VERSION_ = 'SGDS_FIRESTORE_APPS_SCRIPT_FIRST_V1';

const SGDS_D6_COLLECTIONS_ = Object.freeze([
  'jobs',
  'gmail_messages',
  'attachments',
  'audit_events',
  'worker_leases',
  'commands',
  'runtime_config',
  'authorized_users'
]);

const SGDS_D6_JOB_STATES_ = Object.freeze([
  'discovered',
  'queued',
  'processing',
  'attachment_saved',
  'data_extracted',
  'sheet_written',
  'completed',
  'failed_retryable',
  'failed_terminal',
  'ignored'
]);

const SGDS_D6_TERMINAL_JOB_STATES_ = Object.freeze([
  'completed',
  'failed_terminal',
  'ignored'
]);

const SGDS_D6_JOB_TRANSITIONS_ = Object.freeze({
  discovered: Object.freeze(['queued', 'ignored', 'failed_retryable', 'failed_terminal']),
  queued: Object.freeze(['processing', 'ignored', 'failed_retryable', 'failed_terminal']),
  processing: Object.freeze(['attachment_saved', 'data_extracted', 'failed_retryable', 'failed_terminal']),
  attachment_saved: Object.freeze(['data_extracted', 'failed_retryable', 'failed_terminal']),
  data_extracted: Object.freeze(['sheet_written', 'failed_retryable', 'failed_terminal']),
  sheet_written: Object.freeze(['completed', 'failed_retryable', 'failed_terminal']),
  completed: Object.freeze([]),
  failed_retryable: Object.freeze(['queued', 'processing', 'failed_terminal']),
  failed_terminal: Object.freeze([]),
  ignored: Object.freeze([])
});

const SGDS_D6_JOB_REQUIRED_FIELDS_ = Object.freeze([
  'jobId',
  'gmailMessageId',
  'threadId',
  'status',
  'currentStep',
  'attemptCount',
  'nextRetryAt',
  'leaseOwner',
  'leaseExpiresAt',
  'attachmentIds',
  'driveFileIds',
  'sheetRecordKeys',
  'idempotencyKey',
  'lastErrorCode',
  'lastErrorMessage',
  'createdAt',
  'updatedAt',
  'completedAt',
  'schemaVersion'
]);

const SGDS_D6_COLLECTION_FIELD_ALLOWLIST_ = Object.freeze({
  jobs: Object.freeze(SGDS_D6_JOB_REQUIRED_FIELDS_.concat([
    'version',
    'sourceType',
    'direction',
    'gmailMessageFingerprint',
    'attachmentHashPrefixes',
    'driveReconciliationStatus',
    'sheetBusinessKeyHash',
    'commandId',
    'checkpoint',
    'retryPolicy',
    'schemaCompatibility'
  ])),
  gmail_messages: Object.freeze([
    'schemaVersion',
    'gmailMessageId',
    'threadId',
    'fingerprint',
    'direction',
    'labelProjectionStatus',
    'receivedAt',
    'createdAt',
    'updatedAt'
  ]),
  attachments: Object.freeze([
    'schemaVersion',
    'attachmentId',
    'jobId',
    'gmailMessageId',
    'fileNameHash',
    'mimeType',
    'sha256',
    'byteSize',
    'driveFileId',
    'createdAt',
    'updatedAt'
  ]),
  audit_events: Object.freeze([
    'schemaVersion',
    'eventId',
    'jobId',
    'sequence',
    'eventType',
    'actor',
    'occurredAt',
    'idempotencyKey',
    'safeDetails'
  ]),
  worker_leases: Object.freeze([
    'schemaVersion',
    'leaseId',
    'jobId',
    'leaseOwner',
    'leaseExpiresAt',
    'renewedAt',
    'fencingToken',
    'createdAt',
    'updatedAt'
  ]),
  commands: Object.freeze([
    'schemaVersion',
    'commandId',
    'commandType',
    'status',
    'requestedBy',
    'idempotencyKey',
    'createdAt',
    'updatedAt',
    'completedAt'
  ]),
  runtime_config: Object.freeze([
    'schemaVersion',
    'configId',
    'value',
    'updatedAt'
  ]),
  authorized_users: Object.freeze([
    'schemaVersion',
    'emailHash',
    'role',
    'status',
    'createdAt',
    'updatedAt'
  ])
});

const SGDS_D6_RETRY_POLICY_ = Object.freeze({
  maxAttempts: 5,
  retryableErrorCodes: Object.freeze([
    'FIRESTORE_408',
    'FIRESTORE_429',
    'FIRESTORE_500',
    'FIRESTORE_502',
    'FIRESTORE_503',
    'FIRESTORE_504',
    'GMAIL_TEMPORARY',
    'DRIVE_TEMPORARY',
    'SHEETS_TEMPORARY'
  ]),
  terminalErrorCodes: Object.freeze([
    'AUTH_DENIED',
    'VALIDATION_FAILED',
    'UNSUPPORTED_INVOICE',
    'DUPLICATE_CONFLICT',
    'MANUAL_REVIEW_REQUIRED'
  ])
});

function getSgdsD6FirestoreDataContract_() {
  return Object.freeze({
    schemaVersion: SGDS_D6_SCHEMA_VERSION_,
    collections: SGDS_D6_COLLECTIONS_,
    jobStates: SGDS_D6_JOB_STATES_,
    terminalJobStates: SGDS_D6_TERMINAL_JOB_STATES_,
    jobTransitions: SGDS_D6_JOB_TRANSITIONS_,
    jobRequiredFields: SGDS_D6_JOB_REQUIRED_FIELDS_,
    fieldAllowlists: SGDS_D6_COLLECTION_FIELD_ALLOWLIST_,
    retryPolicy: SGDS_D6_RETRY_POLICY_,
    driveStoresFileBytes: true,
    firestoreStoresFileBytes: false,
    sheetsRemainBusinessLedger: true,
    auditEventsAppendOnly: true,
    frontendMayCompleteJobsDirectly: false
  });
}

function isSgdsD6JobState_(state) {
  return SGDS_D6_JOB_STATES_.includes(String(state || ''));
}

function isSgdsD6TerminalJobState_(state) {
  return SGDS_D6_TERMINAL_JOB_STATES_.includes(String(state || ''));
}

function assertSgdsD6JobTransition_(fromState, toState) {
  const from = String(fromState || '');
  const to = String(toState || '');
  if (!isSgdsD6JobState_(from)) throw sgdsD6ContractError_('SGDS_D6_UNKNOWN_FROM_STATE');
  if (!isSgdsD6JobState_(to)) throw sgdsD6ContractError_('SGDS_D6_UNKNOWN_TO_STATE');
  if (!SGDS_D6_JOB_TRANSITIONS_[from].includes(to)) {
    throw sgdsD6ContractError_('SGDS_D6_INVALID_JOB_TRANSITION');
  }
  return true;
}

function assertSgdsD6RequiredJobFields_(job) {
  const source = job || {};
  const missing = SGDS_D6_JOB_REQUIRED_FIELDS_.filter(field => !Object.prototype.hasOwnProperty.call(source, field));
  if (missing.length) throw sgdsD6ContractError_('SGDS_D6_JOB_REQUIRED_FIELDS_MISSING:' + missing.join(','));
  if (source.schemaVersion !== SGDS_D6_SCHEMA_VERSION_) throw sgdsD6ContractError_('SGDS_D6_SCHEMA_VERSION_MISMATCH');
  if (!isSgdsD6JobState_(source.status)) throw sgdsD6ContractError_('SGDS_D6_UNKNOWN_JOB_STATUS');
  return true;
}

function sgdsD6ContractError_(code) {
  const error = new Error(String(code));
  error.code = String(code).split(':')[0];
  return error;
}
