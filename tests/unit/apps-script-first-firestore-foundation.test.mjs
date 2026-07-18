import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'sgdsRuntimeArchitecture.js',
    'firestoreDataContract.js',
    'firestoreRestGateway.js'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'sgdsRuntimeArchitecture.js',
    'firestoreDataContract.js',
    'firestoreRestGateway.js'
  ],
  exportNames: [
    'getSgdsRuntimeArchitectureDecision_',
    'getSgdsD6FirestoreDataContract_',
    'assertSgdsD6JobTransition_',
    'assertSgdsD6RequiredJobFields_',
    'createFirestoreValueCodec_',
    'createFirestorePathValidator_',
    'createFirestoreErrorMapper_',
    'createFirestoreRetryPolicy_',
    'createSgdsFirestoreGateway_',
    'SGDS_D6_SCHEMA_VERSION_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

function createFakeHttpTransport(options = {}) {
  const docs = new Map();
  const calls = [];
  const failures = options.failures ? options.failures.slice() : [];

  function urlToPath(url) {
    const clean = String(url).split('?')[0];
    const marker = '/documents/';
    const index = clean.indexOf(marker);
    return decodeURIComponent(clean.slice(index + marker.length));
  }

  return {
    calls,
    docs,
    async transport(request) {
      calls.push({
        method: request.method,
        url: request.url,
        hasAuthorization: Boolean(request.headers && request.headers.Authorization),
        idempotencyKey: request.headers && request.headers['X-SGDS-Idempotency-Key'],
        bodyContainsAuthorization: String(request.body || '').includes('Authorization')
      });
      if (failures.length) return failures.shift();
      const path = urlToPath(request.url);
      if (request.method === 'GET') {
        const existing = docs.get(path);
        return existing ? { status: 200, body: JSON.stringify(existing) } : { status: 404, body: 'missing' };
      }
      if (request.method === 'POST') {
        if (docs.has(path)) return { status: 409, body: 'already exists' };
        const doc = JSON.parse(request.body);
        docs.set(path, doc);
        return { status: 200, body: JSON.stringify(doc) };
      }
      if (request.method === 'PATCH') {
        const current = docs.get(path) || { fields: {} };
        const patch = JSON.parse(request.body);
        const next = { fields: { ...current.fields, ...patch.fields } };
        docs.set(path, next);
        return { status: 200, body: JSON.stringify(next) };
      }
      if (request.method === 'DELETE') {
        docs.delete(path);
        return { status: 200, body: '{}' };
      }
      return { status: 400, body: 'bad method' };
    }
  };
}

function createJob(overrides = {}) {
  return {
    jobId: 'job_apps_script_first_1',
    gmailMessageId: 'gmail_hash_only',
    threadId: 'thread_hash_only',
    status: 'discovered',
    currentStep: 'discovered',
    attemptCount: 0,
    nextRetryAt: null,
    leaseOwner: '',
    leaseExpiresAt: null,
    attachmentIds: [],
    driveFileIds: [],
    sheetRecordKeys: [],
    idempotencyKey: 'idem-create-job-1',
    lastErrorCode: '',
    lastErrorMessage: '',
    createdAt: '2026-07-18T00:00:00.000Z',
    updatedAt: '2026-07-18T00:00:00.000Z',
    completedAt: null,
    schemaVersion: gas.exports.SGDS_D6_SCHEMA_VERSION_,
    ...overrides
  };
}

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('architecture decision locks Apps Script first and makes Cloud Run optional', () => {
  const decision = fromVm(gas.call('getSgdsRuntimeArchitectureDecision_'));
  assert.equal(decision.SGDS_RUNTIME_STRATEGY, 'APPS_SCRIPT_FIRST_NO_BILLING');
  assert.equal(decision.PRIMARY_WORKER, 'GOOGLE_APPS_SCRIPT');
  assert.equal(decision.BILLING_REQUIRED, 'NO');
  assert.equal(decision.CLOUD_RUN_STATUS, 'DEFERRED_OPTIONAL');
  assert.equal(decision.CLOUD_RUN_PRIMARY_PATH, 'NO');
  assert.equal(decision.CLOUD_RUN_CODE_RETAINED, 'YES_OPTIONAL_ADAPTER');
});

test('D6 data contract exposes required collections, fields, transitions, and ledger boundary', () => {
  const contract = fromVm(gas.call('getSgdsD6FirestoreDataContract_'));
  assert.deepEqual(contract.collections, [
    'jobs',
    'gmail_messages',
    'attachments',
    'audit_events',
    'worker_leases',
    'commands',
    'runtime_config',
    'authorized_users'
  ]);
  assert.equal(contract.jobRequiredFields.includes('idempotencyKey'), true);
  assert.equal(contract.firestoreStoresFileBytes, false);
  assert.equal(contract.sheetsRemainBusinessLedger, true);
  assert.equal(contract.auditEventsAppendOnly, true);
  assert.equal(contract.frontendMayCompleteJobsDirectly, false);
  assert.equal(gas.call('assertSgdsD6JobTransition_', 'discovered', 'queued'), true);
  assert.throws(() => gas.call('assertSgdsD6JobTransition_', 'discovered', 'completed'), /SGDS_D6_INVALID_JOB_TRANSITION/);
  assert.equal(gas.call('assertSgdsD6RequiredJobFields_', createJob()), true);
});

test('Firestore value codec round trips typed values without storing file bytes', () => {
  const codec = gas.call('createFirestoreValueCodec_');
  const encoded = fromVm(codec.encodeDocument({
    n: null,
    b: true,
    i: 12,
    d: 12.5,
    s: 'safe',
    t: '2026-07-18T00:00:00.000Z',
    a: [1, 'x'],
    m: { k: 'v' }
  }));
  assert.deepEqual(encoded.fields.i, { integerValue: '12' });
  assert.deepEqual(fromVm(codec.decodeDocument(encoded)), {
    a: [1, 'x'],
    b: true,
    d: 12.5,
    i: 12,
    m: { k: 'v' },
    n: null,
    s: 'safe',
    t: '2026-07-18T00:00:00.000Z'
  });
  assert.throws(() => codec.encode({ constructor: 'blocked' }), /FIRESTORE_VALUE_FORBIDDEN_KEY/);
});

test('path validator rejects arbitrary collections and unsafe update masks', () => {
  const validator = gas.call('createFirestorePathValidator_');
  assert.deepEqual(fromVm(validator.validateDocumentPath('jobs/job_1')), { collection: 'jobs', documentId: 'job_1', path: 'jobs/job_1' });
  assert.throws(() => validator.validateDocumentPath('unknown/doc'), /FIRESTORE_COLLECTION_NOT_ALLOWED/);
  assert.throws(() => validator.validateDocumentPath('jobs/doc/audit_events/event'), /FIRESTORE_PATH_DEPTH_UNSUPPORTED/);
  assert.throws(() => validator.validateUpdateMask('jobs', ['jobId']), /FIRESTORE_UPDATE_MASK_UNSAFE|FIRESTORE_UPDATE_MASK_REQUIRED/);
  assert.deepEqual(fromVm(validator.validateUpdateMask('jobs', ['status', 'updatedAt'])), ['status', 'updatedAt']);
});

test('error mapper redacts token-bearing text and retry policy caps retryable errors', async () => {
  const mapper = gas.call('createFirestoreErrorMapper_');
  const secretText = ['Bearer ', 'abc ', 'ya29', '.synthetic ', ['refresh', 'token'].join('_')].join('');
  const err = mapper.mapHttpError({ status: 503, body: secretText }, { operation: 'GET' });
  assert.equal(err.message.includes('abc'), false);
  assert.equal(err.message.includes('ya29'), false);
  assert.equal(err.status, 503);

  const delays = [];
  const retry = gas.call('createFirestoreRetryPolicy_', { maxAttempts: 3, baseDelayMs: 5, jitter: () => 0, delay: async ms => delays.push(ms) });
  let attempts = 0;
  const result = await retry.run(async () => {
    attempts += 1;
    if (attempts < 3) {
      const e = new Error('temporary');
      e.status = 503;
      throw e;
    }
    return 'ok';
  });
  assert.equal(result, 'ok');
  assert.deepEqual(delays, [5, 10]);
});

test('Apps Script Firestore gateway uses injected transport, idempotency keys, and redacts auth from errors', async () => {
  const fake = createFakeHttpTransport();
  const gateway = gas.call('createSgdsFirestoreGateway_', {
    projectId: 'demo-sgds-local',
    databaseId: '(default)',
    baseUrl: 'http://127.0.0.1:9099/v1/projects/demo-sgds-local/databases/(default)/documents',
    accessTokenProvider: async () => 'synthetic-token',
    httpTransport: fake.transport,
    clock: { now: () => '2026-07-18T00:01:00.000Z' }
  });

  const created = fromVm(await gateway.jobs.createJob(createJob()));
  assert.equal(created.status, 'discovered');
  const transitioned = fromVm(await gateway.jobs.transitionJob({
    jobId: created.jobId,
    fromStatus: 'discovered',
    toStatus: 'queued',
    currentStep: 'queued',
    idempotencyKey: 'idem-transition-1'
  }));
  assert.equal(transitioned.status, 'queued');
  await gateway.audit.appendEvent({
    schemaVersion: gas.exports.SGDS_D6_SCHEMA_VERSION_,
    eventId: 'evt_1',
    jobId: created.jobId,
    sequence: 1,
    eventType: 'JOB_QUEUED',
    actor: 'APPS_SCRIPT',
    occurredAt: '2026-07-18T00:01:00.000Z',
    idempotencyKey: 'idem-event-1',
    safeDetails: { status: 'queued' }
  });

  assert.equal(fake.calls.every(call => call.hasAuthorization), true);
  assert.equal(fake.calls.every(call => call.bodyContainsAuthorization === false), true);
  assert.equal(fake.calls.some(call => call.idempotencyKey === 'idem-transition-1'), true);
  await assert.rejects(gateway.client.deleteDocument('jobs/' + created.jobId), /FIRESTORE_DELETE_FORBIDDEN/);
});
