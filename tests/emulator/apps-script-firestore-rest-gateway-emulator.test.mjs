import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['firestoreDataContract.js', 'firestoreRestGateway.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['firestoreDataContract.js', 'firestoreRestGateway.js'],
  exportNames: [
    'createSgdsFirestoreGateway_',
    'SGDS_D6_SCHEMA_VERSION_'
  ]
});

const fromVm = value => JSON.parse(JSON.stringify(value));

function createEmulatorTransport() {
  const docs = new Map();
  const createKeys = new Map();
  const auditSequences = new Set();

  function pathFromUrl(url) {
    const clean = String(url).split('?')[0];
    return decodeURIComponent(clean.slice(clean.indexOf('/documents/') + '/documents/'.length));
  }

  function decode(doc) {
    const fields = doc.fields || {};
    const out = {};
    for (const [key, value] of Object.entries(fields)) {
      if ('stringValue' in value) out[key] = value.stringValue;
      else if ('integerValue' in value) out[key] = Number(value.integerValue);
      else if ('booleanValue' in value) out[key] = value.booleanValue;
      else if ('nullValue' in value) out[key] = null;
      else if ('timestampValue' in value) out[key] = value.timestampValue;
      else if ('arrayValue' in value) out[key] = (value.arrayValue.values || []).map(v => 'stringValue' in v ? v.stringValue : Number(v.integerValue));
      else if ('mapValue' in value) out[key] = {};
    }
    return out;
  }

  async function transport(request) {
    assert.equal(String(request.body || '').includes('Authorization'), false);
    const path = pathFromUrl(request.url);
    if (request.method === 'GET') {
      const existing = docs.get(path);
      return existing ? { status: 200, body: JSON.stringify(existing) } : { status: 404, body: 'missing' };
    }
    if (request.method === 'POST') {
      const key = request.headers['X-SGDS-Idempotency-Key'];
      const body = JSON.parse(request.body);
      if (path.startsWith('worker_leases/') && docs.has(path)) return { status: 409, body: 'active lease exists' };
      if (path.startsWith('audit_events/')) {
        const event = decode(body);
        const seqKey = `${event.jobId}:${event.sequence}`;
        if (auditSequences.has(seqKey)) return { status: 409, body: 'audit sequence exists' };
        auditSequences.add(seqKey);
      }
      if (createKeys.get(path) === key && docs.has(path)) return { status: 200, body: JSON.stringify(docs.get(path)) };
      if (docs.has(path)) return { status: 409, body: 'already exists' };
      createKeys.set(path, key);
      docs.set(path, body);
      return { status: 200, body: JSON.stringify(body) };
    }
    if (request.method === 'PATCH') {
      const current = docs.get(path) || { fields: {} };
      const body = JSON.parse(request.body);
      const next = { fields: { ...current.fields, ...body.fields } };
      docs.set(path, next);
      return { status: 200, body: JSON.stringify(next) };
    }
    return { status: 400, body: 'unsupported' };
  }

  return { transport, docs };
}

function createJob(overrides = {}) {
  return {
    jobId: 'job_emulator_contract',
    gmailMessageId: 'gmail_hash',
    threadId: 'thread_hash',
    status: 'discovered',
    currentStep: 'discovered',
    attemptCount: 0,
    nextRetryAt: null,
    leaseOwner: '',
    leaseExpiresAt: null,
    attachmentIds: [],
    driveFileIds: [],
    sheetRecordKeys: [],
    idempotencyKey: 'idem-create-emulator-job',
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

test('D6B emulator transport covers job, transition, lease, idempotency, audit, and redaction boundaries', async () => {
  const emulator = createEmulatorTransport();
  const gateway = gas.call('createSgdsFirestoreGateway_', {
    projectId: 'demo-sgds-local',
    databaseId: '(default)',
    baseUrl: 'http://127.0.0.1:9099/v1/projects/demo-sgds-local/databases/(default)/documents',
    httpTransport: emulator.transport,
    accessTokenProvider: async () => ['synthetic', 'token'].join('-'),
    clock: { now: () => '2026-07-18T00:05:00.000Z' }
  });

  const created = fromVm(await gateway.jobs.createJob(createJob()));
  const read = fromVm(await gateway.jobs.getJob(created.jobId));
  assert.equal(read.status, 'discovered');

  const queued = fromVm(await gateway.jobs.transitionJob({
    jobId: created.jobId,
    fromStatus: 'discovered',
    toStatus: 'queued',
    currentStep: 'queued',
    idempotencyKey: 'idem-queue'
  }));
  assert.equal(queued.status, 'queued');
  await assert.rejects(gateway.jobs.transitionJob({
    jobId: created.jobId,
    fromStatus: 'queued',
    toStatus: 'completed',
    currentStep: 'completed',
    idempotencyKey: 'idem-invalid'
  }), /SGDS_D6_INVALID_JOB_TRANSITION/);

  const lease = await gateway.leases.acquireLease({
    leaseId: 'lease_1',
    jobId: created.jobId,
    leaseOwner: 'apps-script-worker',
    leaseExpiresAt: '2026-07-18T00:10:00.000Z',
    idempotencyKey: 'idem-lease-1'
  });
  assert.equal(fromVm(lease).leaseOwner, 'apps-script-worker');
  await assert.rejects(gateway.leases.acquireLease({
    leaseId: 'lease_1',
    jobId: created.jobId,
    leaseOwner: 'other-worker',
    leaseExpiresAt: '2026-07-18T00:10:00.000Z',
    idempotencyKey: 'idem-lease-conflict'
  }), /FIRESTORE_HTTP_409/);
  const recovered = await gateway.leases.renewLease({
    leaseId: 'lease_1',
    leaseExpiresAt: '2026-07-18T00:20:00.000Z',
    idempotencyKey: 'idem-lease-renew'
  });
  assert.equal(fromVm(recovered).leaseExpiresAt, '2026-07-18T00:20:00.000Z');

  const event = await gateway.audit.appendEvent({
    schemaVersion: gas.exports.SGDS_D6_SCHEMA_VERSION_,
    eventId: 'evt_emulator_1',
    jobId: created.jobId,
    sequence: 1,
    eventType: 'JOB_QUEUED',
    actor: 'APPS_SCRIPT',
    occurredAt: '2026-07-18T00:05:00.000Z',
    idempotencyKey: 'idem-audit-1',
    safeDetails: { status: 'queued' }
  });
  assert.equal(fromVm(event).eventType, 'JOB_QUEUED');
  await assert.rejects(gateway.audit.appendEvent({
    schemaVersion: gas.exports.SGDS_D6_SCHEMA_VERSION_,
    eventId: 'evt_emulator_duplicate_sequence',
    jobId: created.jobId,
    sequence: 1,
    eventType: 'DUPLICATE_SEQUENCE',
    actor: 'APPS_SCRIPT',
    occurredAt: '2026-07-18T00:06:00.000Z',
    idempotencyKey: 'idem-audit-duplicate'
  }), /FIRESTORE_HTTP_409/);
});
