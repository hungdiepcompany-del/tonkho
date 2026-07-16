import test from 'node:test';
import assert from 'node:assert/strict';
import {
  D5N_DATABASE_ID,
  D5N_OWNER_APPROVAL,
  D5N_PROJECT_ID,
  D5N_RUNTIME_PRINCIPAL,
  D5N_SYNTHETIC_CASE_ID,
  D5N_SYNTHETIC_JOB_ID,
  buildD5NIdentityPayload,
  createD5NFirestoreClient,
  runD5NMode,
  validateD5NEnvironment
} from '../../scripts/production/run-sgds-crit-003-d5n-runtime-identity-smoke.mjs';
import { loadD5JGasContracts } from '../../scripts/production/run-sgds-crit-003-d5j-one-job-firestore-shadow.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'scripts/production/run-sgds-crit-003-d5n-runtime-identity-smoke.mjs',
    'firestoreShadowStateValidator.js'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const rootDir = process.cwd();
const contracts = loadD5JGasContracts(rootDir);
const validator = contracts.createFirestoreShadowStateValidator();

function commandRunner(account = 'hungdiepcompany@gmail.com', project = D5N_PROJECT_ID) {
  return (_cmd, args) => {
    const joined = args.join(' ');
    assert.match(joined, /--configuration=sgds-hungdiep/);
    if (joined === 'config get-value account --configuration=sgds-hungdiep') return `${account}\n`;
    if (joined === 'config get-value project --configuration=sgds-hungdiep') return `${project}\n`;
    if (joined.includes('auth print-access-token')) {
      assert.match(joined, new RegExp(`--impersonate-service-account=${D5N_RUNTIME_PRINCIPAL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      return 'synthetic-impersonated-token\n';
    }
    return '';
  };
}

function baseEnv(overrides = {}) {
  return {
    SGDS_D5N_OWNER_APPROVAL: D5N_OWNER_APPROVAL,
    SGDS_D5N_PROJECT_ID: D5N_PROJECT_ID,
    SGDS_D5N_DATABASE_ID: D5N_DATABASE_ID,
    SGDS_D5N_EXPECTED_PRINCIPAL: D5N_RUNTIME_PRINCIPAL,
    ...overrides
  };
}

function firestoreDocument(body) {
  function toValue(value) {
    if (value === null || value === undefined) return { nullValue: null };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (Number.isInteger(value)) return { integerValue: String(value) };
    if (typeof value === 'number') return { doubleValue: value };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(toValue) } };
    if (typeof value === 'object') {
      const fields = {};
      for (const [key, item] of Object.entries(value)) fields[key] = toValue(item);
      return { mapValue: { fields } };
    }
    return { stringValue: String(value) };
  }
  const fields = {};
  for (const [key, value] of Object.entries(body || {})) fields[key] = toValue(value);
  return { fields };
}

function createD5NFetch(payload, options = {}) {
  const docs = new Map();
  docs.set(payload.targetPaths.existingD5JJob, firestoreDocument({ jobId: 'sgds-d5j-3400731da7823d5d8690f242', synthetic: true }));
  if (options.includeExisting) {
    docs.set(payload.targetPaths.job, firestoreDocument(options.mismatch ? { ...payload.jobFinal, version: 99 } : payload.jobFinal));
    payload.events.forEach((event, index) => docs.set(payload.targetPaths.events[index], firestoreDocument(event)));
    docs.set(payload.targetPaths.report, firestoreDocument(payload.report));
  }
  const calls = [];
  const fetchImpl = async (url, request = {}) => {
    calls.push([request.method || 'GET', url, request.body || '', request.headers || {}]);
    if (url.includes('/documents:commit')) {
      const parsed = JSON.parse(request.body);
      for (const write of parsed.writes || []) {
        const relative = write.update.name.split('/documents/')[1];
        if (write.currentDocument && write.currentDocument.exists === false && docs.has(relative)) {
          return { ok: false, status: 409, text: async () => JSON.stringify({ error: { status: 'ALREADY_EXISTS' } }) };
        }
        const current = docs.get(relative);
        const next = write.updateMask && current
          ? { fields: { ...current.fields, ...write.update.fields } }
          : { fields: write.update.fields };
        docs.set(relative, next);
      }
      return { ok: true, status: 200, text: async () => JSON.stringify({ writeResults: [] }) };
    }
    const relative = decodeURIComponent(url.split('/documents/')[1] || '');
    if (!docs.has(relative)) return { ok: false, status: 404, text: async () => '{}' };
    return { ok: true, status: 200, text: async () => JSON.stringify(docs.get(relative)) };
  };
  fetchImpl.calls = calls;
  fetchImpl.docs = docs;
  return fetchImpl;
}

test('D5N environment guard requires approved project, owner approval for execute, and keyless impersonation context', () => {
  assert.equal(TEST_METADATA.ownerPolicyRequired, true);
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.throws(() => validateD5NEnvironment(baseEnv({ SGDS_D5N_PROJECT_ID: 'other' }), '--dry-run', commandRunner()), /D5N_PROJECT_MISMATCH/);
  assert.throws(() => validateD5NEnvironment(baseEnv({ GOOGLE_APPLICATION_CREDENTIALS: 'key.json' }), '--dry-run', commandRunner()), /D5N_KEY_FILE_DENIED/);
  assert.throws(() => validateD5NEnvironment(baseEnv({ SGDS_D5N_OWNER_APPROVAL: '' }), '--execute', commandRunner()), /D5N_OWNER_APPROVAL_REQUIRED/);
  assert.throws(() => validateD5NEnvironment(baseEnv(), '--execute', commandRunner('hung.pham@longthaisteel.com')), /D5N_ADMIN_ACCOUNT_MISMATCH/);
  assert.throws(() => validateD5NEnvironment(baseEnv(), '--execute', commandRunner('hungdiepcompany@gmail.com', 'other')), /D5N_PROJECT_CONTEXT_MISMATCH/);
});

test('D5N payload is fixed, synthetic, sanitized, and contains no real source identifiers', () => {
  const payload = buildD5NIdentityPayload({ validator });
  assert.equal(payload.jobId, D5N_SYNTHETIC_JOB_ID);
  assert.equal(payload.jobFinal.caseId, ['SGDS_D5N_SERVICE', 'ACCOUNT_IDENTITY_SMOKE_V1'].join('_'));
  assert.equal(payload.jobFinal.caseId, D5N_SYNTHETIC_CASE_ID);
  assert.equal(payload.jobFinal.environment, 'production-identity-smoke');
  assert.equal(payload.jobFinal.businessData, false);
  assert.equal(payload.jobFinal.canonicalWriteAllowed, false);
  assert.equal(payload.jobFinal.version, 2);
  assert.equal(payload.events.length, 4);
  assert.equal(payload.report.reportId, 'rpt-d5n-runtime-identity-smoke-v1');
  assert.equal(payload.jobFinal.commitPlan.runtimePrincipalExpected, 'REDACTED_EMAIL');
  const serialized = JSON.stringify(payload);
  for (const forbidden of ['gmailThreadId', 'driveFileId', 'taxCode', 'invoiceNo', 'companyName', '<Invoice', 'JVBER']) {
    assert.equal(serialized.includes(forbidden), false, `forbidden value present: ${forbidden}`);
  }
});

test('D5N dry-run and read mode do not write', async () => {
  const payload = buildD5NIdentityPayload({ validator });
  const fetchImpl = createD5NFetch(payload);
  const dryRun = await runD5NMode({ mode: '--dry-run', env: baseEnv(), rootDir, commandRunner: commandRunner(), fetchImpl });
  assert.equal(dryRun.dryRun, 'PASS');
  assert.equal(dryRun.firestoreWrite, 'NO');
  assert.equal(fetchImpl.calls.length, 0);
  const read = await runD5NMode({ mode: '--read', env: baseEnv(), rootDir, commandRunner: commandRunner(), fetchImpl, tokenProvider: () => 'synthetic-token' });
  assert.equal(read.impersonatedRead, 'PASS');
  assert.equal(read.existingD5JJobFound, 'YES');
  assert.equal(fetchImpl.calls.some(call => call[0] === 'POST'), false);
});

test('D5N execute creates one bounded tree, updates the job once, verify passes, and replay is idempotent', async () => {
  const payload = buildD5NIdentityPayload({ validator });
  const fetchImpl = createD5NFetch(payload);
  const first = await runD5NMode({ mode: '--execute', env: baseEnv(), rootDir, commandRunner: commandRunner(), fetchImpl, tokenProvider: () => 'synthetic-token' });
  assert.equal(first.executionStatus, 'PASS_ONE_IDENTITY_JOB_CREATED');
  assert.equal(first.firestoreDocumentsCreated, 6);
  assert.equal(first.firestoreDocumentsUpdated, 1);
  assert.equal(first.duplicateJobCount, 0);
  assert.equal(first.actualPrincipal, D5N_RUNTIME_PRINCIPAL);
  assert.equal(first.tokenMaterialLogged, 'NO');
  assert.equal(fetchImpl.calls.filter(call => call[0] === 'POST' && call[1].includes('/documents:commit')).length, 1);

  const verify = await runD5NMode({ mode: '--verify', env: baseEnv(), rootDir, commandRunner: commandRunner(), fetchImpl, tokenProvider: () => 'synthetic-token' });
  assert.equal(verify.readBackStatus, 'PASS');

  const second = await runD5NMode({ mode: '--execute', env: baseEnv(), rootDir, commandRunner: commandRunner(), fetchImpl, tokenProvider: () => 'synthetic-token' });
  assert.equal(second.executionStatus, 'PASS_IDEMPOTENT_REUSE');
  assert.equal(second.jobCountAfterReplay, 1);
  assert.equal(second.duplicateJobCount, 0);
  assert.equal(second.idempotency, 'PASS');
});

test('D5N existing mismatch blocks without overwrite or alternate target', async () => {
  const payload = buildD5NIdentityPayload({ validator });
  const fetchImpl = createD5NFetch(payload, { includeExisting: true, mismatch: true });
  await assert.rejects(
    runD5NMode({ mode: '--execute', env: baseEnv(), rootDir, commandRunner: commandRunner(), fetchImpl, tokenProvider: () => 'synthetic-token' }),
    error => error && error.code === 'D5N_SYNTHETIC_TARGET_COLLISION'
  );
  assert.equal(fetchImpl.calls.some(call => call[0] === 'POST' && call[1].includes('/documents:commit')), false);
});

test('D5N Firestore client exposes no delete or broad query method', () => {
  const client = createD5NFirestoreClient({
    projectId: D5N_PROJECT_ID,
    databaseId: D5N_DATABASE_ID,
    tokenProvider: () => 'synthetic-token',
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{}' })
  });
  assert.deepEqual(Object.keys(client).sort(), ['commitWrites', 'getDocument']);
});
