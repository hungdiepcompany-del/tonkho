import test from 'node:test';
import assert from 'node:assert/strict';
import { validateClaims } from '../src/auth.mjs';
import { createApp } from '../src/app.mjs';
import { createStaticAuthVerifier } from '../src/auth.mjs';
import { testRuntimeConfig } from '../src/config.mjs';
import { SGDS_RUNTIME_PRINCIPAL } from '../src/constants.mjs';
import { buildDurableShadowPayload } from '../src/durable-shadow.mjs';
import { fromFirestoreDocument, toFirestoreFields } from '../src/firestore-client.mjs';
import { createStaticPrincipalInspector } from '../src/principal.mjs';

const clock = Object.freeze({ now: () => '2026-07-17T00:00:00.000Z' });

function validBody(overrides = {}) {
  return {
    schemaVersion: 1,
    requestId: 'req-d5s-001',
    mode: 'shadow',
    candidate: {
      sourceType: 'gmail',
      sourceIdentityHash: 'a'.repeat(64),
      contentIdentityHash: 'b'.repeat(64),
      scannerVersion: 'D5S_TEST_SCANNER',
      receivedAt: '2026-07-17T00:00:00.000Z'
    },
    ...overrides
  };
}

function request(body, headers = {}) {
  return {
    method: 'POST',
    pathname: '/v1/shadow/submit',
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer synthetic-id-token',
      ...headers
    },
    bodyText: JSON.stringify(body)
  };
}

function createMemoryFirestore() {
  const docs = new Map();
  const calls = [];
  const client = {
    calls,
    docs,
    async getDocument(path) {
      calls.push(['GET', path]);
      return docs.get(path) || null;
    },
    async commitCreates(documents) {
      calls.push(['COMMIT', documents.map(doc => doc.path)]);
      for (const doc of documents) {
        if (docs.has(doc.path)) {
          const error = new Error('FIRESTORE_409');
          error.code = 'FIRESTORE_409';
          error.status = 409;
          throw error;
        }
      }
      for (const doc of documents) docs.set(doc.path, { fields: toFirestoreFields(doc.body) });
      return { writeResults: [] };
    },
    async getDatabaseMetadata() {
      calls.push(['GET_DATABASE']);
      return { name: 'projects/tonkhohd/databases/(default)' };
    }
  };
  return client;
}

function appWithStore(store = createMemoryFirestore(), options = {}) {
  return {
    store,
    app: createApp({
      config: testRuntimeConfig(options.env || {}),
      authVerifier: createStaticAuthVerifier({
        email: 'hungdiepcompany@gmail.com',
        sub: 'subject-1',
        aud: 'https://sgds-durable-orchestrator.local',
        iss: 'https://accounts.google.com',
        exp: Math.floor(Date.now() / 1000) + 3600
      }),
      principalInspector: options.principalInspector || createStaticPrincipalInspector(SGDS_RUNTIME_PRINCIPAL),
      firestoreClient: store,
      clock
    })
  };
}

test('healthz returns service metadata and performs no Firestore operation', async () => {
  const { app, store } = appWithStore();
  const result = await app.handle({ method: 'GET', pathname: '/healthz', headers: {}, bodyText: '' });
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.firestoreOperation, 'NONE');
  assert.equal(store.calls.length, 0);
});

test('readyz asserts attached runtime principal and rejects principal mismatch', async () => {
  const { app } = appWithStore();
  const ready = await app.handle({ method: 'GET', pathname: '/readyz', headers: {}, bodyText: '' });
  assert.equal(ready.status, 200);
  assert.equal(ready.body.runtimePrincipalAssertion, 'PASS');

  const mismatch = appWithStore(createMemoryFirestore(), { principalInspector: createStaticPrincipalInspector('owner@example.invalid') }).app;
  const blocked = await mismatch.handle({ method: 'GET', pathname: '/readyz', headers: {}, bodyText: '' });
  assert.equal(blocked.status, 500);
  assert.equal(blocked.body.code, 'BLOCKED_RUNTIME_PRINCIPAL_MISMATCH');
});

test('runtime config fails closed for key file mode, wrong project, and enabled mutations', () => {
  assert.throws(() => testRuntimeConfig({ GOOGLE_APPLICATION_CREDENTIALS: 'key.json' }), /BLOCKED_KEY_FILE_MODE_FOUND/);
  assert.throws(() => testRuntimeConfig({ SGDS_FIRESTORE_PROJECT_ID: 'other' }), /BLOCKED_PROJECT_ID_INVALID/);
  assert.throws(() => testRuntimeConfig({ SGDS_CANONICAL_WRITES_ENABLED: 'true' }), /BLOCKED_CANONICAL_WRITES_ENABLED/);
  assert.throws(() => testRuntimeConfig({ SGDS_MAX_CANDIDATES_PER_REQUEST: '2' }), /BLOCKED_MAX_CANDIDATES_INVALID/);
});

test('auth claim validation rejects invalid audience, issuer, expiry, and caller email', () => {
  const config = testRuntimeConfig();
  const valid = {
    iss: 'https://accounts.google.com',
    aud: 'https://sgds-durable-orchestrator.local',
    email: 'hungdiepcompany@gmail.com',
    exp: Math.floor(Date.now() / 1000) + 3600
  };
  assert.doesNotThrow(() => validateClaims(valid, config));
  assert.throws(() => validateClaims({ ...valid, aud: 'wrong-audience' }, config), /AUTH_AUDIENCE_REJECTED/);
  assert.throws(() => validateClaims({ ...valid, iss: 'https://issuer.invalid' }, config), /AUTH_ISSUER_REJECTED/);
  assert.throws(() => validateClaims({ ...valid, email: 'other@example.invalid' }, config), /AUTH_EMAIL_REJECTED/);
  assert.throws(() => validateClaims({ ...valid, exp: 1 }, config), /AUTH_TOKEN_EXPIRED/);
});

test('plan authenticates, validates one candidate, and performs zero writes', async () => {
  const { app, store } = appWithStore();
  const result = await app.handle({
    ...request(validBody()),
    pathname: '/v1/shadow/plan'
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.operation, 'plan');
  assert.equal(result.body.mutationAttemptCount, 0);
  assert.equal(result.body.productionWrite, 'NONE');
  assert.equal(store.calls.filter(call => call[0] === 'COMMIT').length, 0);
});

test('submit creates one bounded shadow tree and exact replay reuses it', async () => {
  const { app, store } = appWithStore();
  const first = await app.handle(request(validBody()));
  assert.equal(first.status, 200);
  assert.equal(first.body.result, 'SHADOW_JOB_CREATED');
  assert.equal(first.body.documentsCreated, 6);
  assert.equal(first.body.documentsDeleted, 0);
  assert.equal(first.body.workspaceMutationAttemptCount, 0);
  const commitCalls = store.calls.filter(call => call[0] === 'COMMIT');
  assert.equal(commitCalls.length, 1);
  assert.equal(commitCalls[0][1].length, 6);
  assert.equal(commitCalls[0][1].filter(path => /^invoiceJobs\/[^/]+$/.test(path)).length, 1);
  assert.equal(commitCalls[0][1].filter(path => path.includes('/events/')).length, 4);
  assert.equal(commitCalls[0][1].filter(path => path.includes('/reconciliationReports/')).length, 1);

  const second = await app.handle(request(validBody()));
  assert.equal(second.status, 200);
  assert.equal(second.body.result, 'IDEMPOTENT_REUSE');
  assert.equal(second.body.jobCountAfterReplay, 1);
  assert.equal(second.body.duplicateJobCount, 0);
  assert.equal(store.calls.filter(call => call[0] === 'COMMIT').length, 1);
});

test('concurrent same candidate converges to one job', async () => {
  const store = createMemoryFirestore();
  const { app } = appWithStore(store);
  const [first, second] = await Promise.all([app.handle(request(validBody())), app.handle(request(validBody()))]);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.deepEqual([first.body.jobId, second.body.jobId].filter(Boolean), [first.body.jobId, first.body.jobId]);
  assert.equal(store.calls.filter(call => call[0] === 'COMMIT').length >= 1, true);
  const jobPaths = Array.from(store.docs.keys()).filter(path => /^invoiceJobs\/[^/]+$/.test(path));
  assert.equal(jobPaths.length, 1);
});

test('invalid auth, audience, schema, multiple candidates, privileged fields, and oversized body fail closed', async () => {
  const { app } = appWithStore();
  assert.equal((await app.handle(request(validBody(), { authorization: '' }))).status, 401);
  assert.equal((await app.handle(request({ ...validBody(), candidates: [validBody().candidate] }))).body.code, 'MULTIPLE_CANDIDATES_REJECTED');
  assert.equal((await app.handle(request({ ...validBody(), canonicalWriteAllowed: true }))).body.code, 'MUTATION_FLAG_REJECTED');
  assert.equal((await app.handle(request({ ...validBody(), candidate: { ...validBody().candidate, firestorePath: 'invoiceJobs/raw' } }))).body.code, 'REQUEST_FIELD_REJECTED');
  assert.equal((await app.handle({ ...request(validBody()), bodyText: 'x'.repeat(129 * 1024) })).status, 413);
});

test('deterministic payload contains no raw Workspace identifiers and no delete plan', () => {
  const payload = buildDurableShadowPayload(validBody(), { email: 'REDACTED_EMAIL' }, clock.now());
  assert.equal(payload.documents.length, 6);
  assert.equal(payload.job.productionMutationAllowed, false);
  assert.equal(payload.job.canonicalWriteAllowed, false);
  assert.equal(payload.report.repairPolicy, 'REPORT_ONLY');
  const serialized = JSON.stringify(payload);
  for (const forbidden of ['gmailThreadId', 'driveFileId', 'deleteDocument', 'rawToken', 'xmlText', 'pdfText']) {
    assert.equal(serialized.includes(forbidden), false, `forbidden token present: ${forbidden}`);
  }
});

test('stored Firestore document shape round-trips through local serializer', async () => {
  const store = createMemoryFirestore();
  const { app } = appWithStore(store);
  const response = await app.handle(request(validBody()));
  const doc = store.docs.get(`invoiceJobs/${response.body.jobId}`);
  const parsed = fromFirestoreDocument(doc);
  assert.equal(parsed.jobId, response.body.jobId);
  assert.equal(parsed.executionMode, 'SHADOW');
  assert.equal(parsed.commitPlan.workspaceSideEffects, 'DENIED');
});
