import http from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.mjs';
import { createStaticAuthVerifier } from '../src/auth.mjs';
import { testRuntimeConfig } from '../src/config.mjs';
import { SGDS_RUNTIME_PRINCIPAL } from '../src/constants.mjs';
import { toFirestoreFields } from '../src/firestore-client.mjs';
import { createStaticPrincipalInspector } from '../src/principal.mjs';

function memoryFirestore() {
  const docs = new Map();
  return {
    async getDocument(path) {
      return docs.get(path) || null;
    },
    async commitCreates(documents) {
      for (const doc of documents) {
        if (docs.has(doc.path)) {
          const error = new Error('FIRESTORE_409');
          error.code = 'FIRESTORE_409';
          error.status = 409;
          throw error;
        }
      }
      for (const doc of documents) docs.set(doc.path, { fields: toFirestoreFields(doc.body) });
    }
  };
}

function validPayload() {
  return {
    schemaVersion: 1,
    requestId: 'req-http-smoke',
    mode: 'shadow',
    candidate: {
      sourceType: 'gmail',
      sourceIdentityHash: 'c'.repeat(64),
      contentIdentityHash: 'd'.repeat(64),
      scannerVersion: 'HTTP_SMOKE',
      receivedAt: '2026-07-17T00:00:00.000Z'
    }
  };
}

async function startSmokeServer() {
  const app = createApp({
    config: testRuntimeConfig(),
    authVerifier: createStaticAuthVerifier({
      email: 'hungdiepcompany@gmail.com',
      sub: 'subject-1',
      aud: 'https://sgds-durable-orchestrator.local',
      iss: 'https://accounts.google.com',
      exp: Math.floor(Date.now() / 1000) + 3600
    }),
    principalInspector: createStaticPrincipalInspector(SGDS_RUNTIME_PRINCIPAL),
    firestoreClient: memoryFirestore(),
    clock: { now: () => '2026-07-17T00:00:00.000Z' }
  });
  const server = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const result = await app.handle({
      method: req.method,
      url: req.url,
      pathname: new URL(req.url || '/', 'http://localhost').pathname,
      headers: req.headers,
      bodyText: Buffer.concat(chunks).toString('utf8')
    });
    res.writeHead(result.status, result.headers);
    res.end(JSON.stringify(result.body));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

test('local HTTP smoke covers health, ready, plan, submit, and replay', async () => {
  const { server, url } = await startSmokeServer();
  try {
    const health = await fetch(`${url}/healthz`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).firestoreOperation, 'NONE');

    const ready = await fetch(`${url}/readyz`);
    assert.equal(ready.status, 200);
    assert.equal((await ready.json()).runtimePrincipalAssertion, 'PASS');

    const headers = { 'content-type': 'application/json', authorization: 'Bearer synthetic-id-token' };
    const plan = await fetch(`${url}/v1/shadow/plan`, { method: 'POST', headers, body: JSON.stringify(validPayload()) });
    assert.equal(plan.status, 200);
    assert.equal((await plan.json()).productionWrite, 'NONE');

    const submit = await fetch(`${url}/v1/shadow/submit`, { method: 'POST', headers, body: JSON.stringify(validPayload()) });
    assert.equal(submit.status, 200);
    assert.equal((await submit.json()).result, 'SHADOW_JOB_CREATED');

    const replay = await fetch(`${url}/v1/shadow/submit`, { method: 'POST', headers, body: JSON.stringify(validPayload()) });
    assert.equal(replay.status, 200);
    assert.equal((await replay.json()).result, 'IDEMPOTENT_REUSE');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
