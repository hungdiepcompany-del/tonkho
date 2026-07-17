import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['cloudRunShadowCaller.js'],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

function loadCaller(extra = {}) {
  const context = vm.createContext({
    console,
    ...extra
  });
  vm.runInContext(fs.readFileSync('cloudRunShadowCaller.js', 'utf8'), context, { filename: 'cloudRunShadowCaller.js' });
  return context;
}

function candidate(overrides = {}) {
  return {
    sourceType: 'gmail',
    sourceIdentityHash: 'a'.repeat(64),
    contentIdentityHash: 'b'.repeat(64),
    scannerVersion: 'TEST_SCANNER',
    receivedAt: '2026-07-17T00:00:00.000Z',
    ...overrides
  };
}

test('feature default is false and disabled caller makes no HTTP call', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  const ctx = loadCaller();
  const result = ctx.sgdsCallCloudRunShadowOrchestrator_(candidate(), { properties: {} });
  assert.equal(result.status, 'FEATURE_DISABLED');
  assert.equal(result.httpCallCount, 0);
  assert.equal(result.canonicalSideEffectAllowed, false);
});

test('request builder emits one bounded shadow candidate with no auth token in safe inspection', () => {
  const ctx = loadCaller();
  const built = ctx.sgdsBuildCloudRunShadowFetchRequest_(candidate(), {
    requestId: 'req-test',
    url: 'https://run.example/v1/shadow/plan'
  });
  assert.equal(built.safeInspection.payload.schemaVersion, 1);
  assert.equal(built.safeInspection.payload.mode, 'shadow');
  assert.equal(built.safeInspection.payload.canonicalWriteAllowed, false);
  assert.equal(built.safeInspection.payload.gmailMutationAllowed, false);
  assert.equal(built.safeInspection.hasAuthorizationHeader, false);
  assert.equal(JSON.stringify(built.safeInspection).includes('Bearer'), false);
});

test('enabled caller obtains identity token only when enabled and handles response schema', () => {
  let fetchCount = 0;
  const ctx = loadCaller({
    ScriptApp: { getIdentityToken: () => 'header.payload.sig' },
    UrlFetchApp: {
      fetch: (_url, params) => {
        fetchCount += 1;
        assert.match(params.headers.Authorization, /^Bearer /);
        assert.equal(params.muteHttpExceptions, true);
        return {
          getResponseCode: () => 200,
          getContentText: () => JSON.stringify({ ok: true, jobId: 'job_1' })
        };
      }
    }
  });
  const result = ctx.sgdsCallCloudRunShadowOrchestrator_(candidate(), {
    properties: { SGDS_CLOUD_RUN_SHADOW_ENABLED: 'true' }
  });
  assert.equal(result.status, 'SHADOW_CALL_ACCEPTED');
  assert.equal(result.httpCallCount, 1);
  assert.equal(fetchCount, 1);
});

test('multiple candidates, invalid hash, non-2xx, invalid response, and missing identity token fail closed', () => {
  const ctx = loadCaller();
  assert.throws(() => ctx.sgdsBuildCloudRunShadowRequest_([candidate()], {}), /ONE_CANDIDATE_REQUIRED/);
  assert.throws(() => ctx.sgdsBuildCloudRunShadowRequest_(candidate({ sourceIdentityHash: 'bad' }), {}), /SOURCE_IDENTITY_HASH_INVALID/);

  const missingToken = loadCaller({ ScriptApp: { getIdentityToken: () => '' } });
  assert.throws(() => missingToken.sgdsCallCloudRunShadowOrchestrator_(candidate(), { properties: { SGDS_CLOUD_RUN_SHADOW_ENABLED: 'true' } }), /IDENTITY_TOKEN_UNAVAILABLE/);

  const http500 = loadCaller({
    ScriptApp: { getIdentityToken: () => 'header.payload.sig' },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 500, getContentText: () => '{}' }) }
  });
  assert.throws(() => http500.sgdsCallCloudRunShadowOrchestrator_(candidate(), { properties: { SGDS_CLOUD_RUN_SHADOW_ENABLED: 'true' } }), /HTTP_500/);

  const invalidResponse = loadCaller({
    ScriptApp: { getIdentityToken: () => 'header.payload.sig' },
    UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{"ok":false}' }) }
  });
  assert.throws(() => invalidResponse.sgdsCallCloudRunShadowOrchestrator_(candidate(), { properties: { SGDS_CLOUD_RUN_SHADOW_ENABLED: 'true' } }), /RESPONSE_INVALID/);
});
