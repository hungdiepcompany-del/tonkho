import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  D5J_GCLOUD_CONFIGURATION,
  D5J_OWNER_APPROVAL,
  D5J_SYNTHETIC_SEED,
  buildD5JSyntheticPayload,
  createD5JFirestoreClient,
  inspectD5JExistingTree,
  loadD5JGasContracts,
  runD5JMode,
  validateD5JEnvironment
} from '../../scripts/production/run-sgds-crit-003-d5j-one-job-firestore-shadow.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'scripts/production/run-sgds-crit-003-d5j-one-job-firestore-shadow.mjs',
    'firestoreShadowStateValidator.js'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const D5J_GUARD_SCENARIOS = Object.freeze([
  'missing approval rejected',
  'wrong approval rejected',
  'default gcloud context not trusted',
  'sgds-hungdiep configuration required',
  'emulator config rejected',
  'demo project rejected',
  'sanxuat-lt project rejected',
  'Long Thai account rejected',
  'Long Thai project rejected',
  'project mismatch rejected',
  'database mismatch rejected',
  'principal mismatch rejected',
  'forbidden field rejected',
  'raw Gmail ID rejected',
  'raw Drive ID rejected',
  'email rejected',
  'tax code rejected',
  'invoice number rejected',
  'company name rejected',
  'XML/PDF content rejected',
  'productionMutationAllowed=true rejected',
  'production completion status rejected',
  'no broad query',
  'no broad delete',
  'deterministic job ID stable',
  'event IDs deterministic',
  'report ID deterministic',
  'existing exact match is idempotent',
  'existing mismatch is conflict',
  'dry-run performs zero writes'
]);

const rootDir = process.cwd();
const contracts = loadD5JGasContracts(rootDir);
const validator = contracts.createFirestoreShadowStateValidator();

function commandRunner(account = 'hungdiepcompany@gmail.com', project = 'hung-diep-prod') {
  return (_cmd, args) => {
    const joined = args.join(' ');
    assert.match(joined, /--configuration=sgds-hungdiep/, 'sgds-hungdiep configuration required');
    if (joined === 'config get-value account --configuration=sgds-hungdiep') return `${account}\n`;
    if (joined === 'config get-value project --configuration=sgds-hungdiep') return `${project}\n`;
    if (joined === 'auth print-access-token --configuration=sgds-hungdiep') return 'synthetic-token\n';
    return '';
  };
}

function baseEnv(overrides = {}) {
  return {
    SGDS_D5J_OWNER_APPROVAL: D5J_OWNER_APPROVAL,
    SGDS_D5J_PROJECT_ID: 'hung-diep-prod',
    SGDS_D5J_DATABASE_ID: '(default)',
    SGDS_D5J_EXPECTED_PRINCIPAL: 'hungdiepcompany@gmail.com',
    ...overrides
  };
}

function firestoreDocument(body) {
  const client = createD5JFirestoreClient({
    projectId: 'hung-diep-prod',
    databaseId: '(default)',
    tokenProvider: () => 'synthetic-token',
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => '{}' })
  });
  // Reuse the production serializer through commit and capture would be noisy; tests need only the reverse shape.
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
  for (const [key, value] of Object.entries(body)) fields[key] = toValue(value);
  assert.equal(typeof client.getDocument, 'function');
  return { fields };
}

function createFetchForExisting(payload, options = {}) {
  const docs = new Map();
  if (options.includeExisting) {
    docs.set(payload.targetPaths.job, firestoreDocument(options.mismatch ? { ...payload.job, commitPlanHash: 'mismatch' } : payload.job));
    payload.events.forEach((event, index) => docs.set(payload.targetPaths.events[index], firestoreDocument(event)));
    docs.set(payload.targetPaths.report, firestoreDocument(payload.report));
  }
  const calls = [];
  const fetchImpl = async (url, request = {}) => {
    calls.push([request.method || 'GET', url, request.body || '', request.headers || {}]);
    if (url.includes('firestore.googleapis.com/v1/projects/hung-diep-prod/databases/(default)') && !url.includes('/documents')) {
      const name = options.databaseName || 'projects/hung-diep-prod/databases/(default)';
      return { ok: true, status: 200, json: async () => ({ name, locationId: 'asia-southeast1' }), text: async () => '{}' };
    }
    if (url.includes('firebaserules.googleapis.com/v1/projects/hung-diep-prod/releases/cloud.firestore')) {
      return { ok: true, status: 200, json: async () => ({ rulesetName: 'projects/hung-diep-prod/rulesets/ruleset1' }), text: async () => '{}' };
    }
    if (url.includes('firebaserules.googleapis.com/v1/projects/hung-diep-prod/rulesets/ruleset1')) {
      return { ok: true, status: 200, json: async () => ({ source: { files: [{ content: 'match /invoiceJobs/{jobId} { allow create, update, delete: if sgdsD5fD5iClientWritesDenied(); } match /{document=**} { allow read, write: if false; }' }] } }), text: async () => '{}' };
    }
    if (url.includes('/documents:commit')) {
      const parsed = JSON.parse(request.body);
      for (const write of parsed.writes) {
        const relative = write.update.name.split('/documents/')[1];
        if (docs.has(relative)) return { ok: false, status: 409, text: async () => JSON.stringify({ error: { status: 'ALREADY_EXISTS' } }) };
        docs.set(relative, { fields: write.update.fields });
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

async function assertRejectCode(action, code) {
  await assert.rejects(action, error => error && error.code === code);
}

test('D5J metadata and required guard scenario vocabulary', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(TEST_METADATA.ownerPolicyRequired, true);
  assert.equal(D5J_GUARD_SCENARIOS.length, 30);
  assert.equal(D5J_GCLOUD_CONFIGURATION, 'sgds-hungdiep');
});

test('D5J environment guard rejects missing/wrong approval, emulator, demo/sanxuat, Long Thai, and mismatch contexts', () => {
  assert.throws(() => validateD5JEnvironment(baseEnv({ SGDS_D5J_OWNER_APPROVAL: '' }), '--execute', commandRunner()), /D5J_OWNER_APPROVAL_REQUIRED/);
  assert.throws(() => validateD5JEnvironment(baseEnv({ SGDS_D5J_OWNER_APPROVAL: 'WRONG' }), '--execute', commandRunner()), /D5J_OWNER_APPROVAL_REQUIRED/);
  assert.throws(() => validateD5JEnvironment(baseEnv({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:9099' }), '--execute', commandRunner()), /D5J_EMULATOR_HOST_DENIED/);
  assert.throws(() => validateD5JEnvironment(baseEnv({ SGDS_D5J_PROJECT_ID: 'demo-sgds-local' }), '--execute', commandRunner()), /D5J_PROJECT_ID_DENIED/);
  assert.throws(() => validateD5JEnvironment(baseEnv({ SGDS_D5J_PROJECT_ID: 'sanxuat-lt-prod' }), '--execute', commandRunner()), /D5J_PROJECT_ID_DENIED/);
  assert.throws(() => validateD5JEnvironment(baseEnv({ SGDS_D5J_PROJECT_ID: 'noble-nation-497005-f1' }), '--execute', commandRunner()), /D5J_PROJECT_ID_DENIED/);
  assert.throws(() => validateD5JEnvironment(baseEnv(), '--execute', commandRunner('hung.pham@longthaisteel.com')), /D5J_ACCOUNT_CONTEXT_MISMATCH/);
  assert.throws(() => validateD5JEnvironment(baseEnv(), '--execute', commandRunner('hungdiepcompany@gmail.com', 'other-project')), /D5J_PROJECT_CONTEXT_MISMATCH/);
  assert.throws(() => validateD5JEnvironment(baseEnv({ SGDS_D5J_EXPECTED_PRINCIPAL: 'other@example.invalid' }), '--execute', commandRunner()), /D5J_PRINCIPAL_MISMATCH/);
});

test('D5J default gcloud context is not trusted and every command is pinned to sgds-hungdiep', async () => {
  const calls = [];
  const pinnedRunner = (_cmd, args) => {
    calls.push(args.join(' '));
    assert.match(args.join(' '), /--configuration=sgds-hungdiep/);
    if (args[0] === 'config' && args[2] === 'account') return 'hungdiepcompany@gmail.com\n';
    if (args[0] === 'config' && args[2] === 'project') return 'hung-diep-prod\n';
    if (args[0] === 'auth') return 'synthetic-token\n';
    return '';
  };
  validateD5JEnvironment(baseEnv(), '--execute', pinnedRunner);
  const payload = buildD5JSyntheticPayload({ projectId: 'hung-diep-prod', databaseId: '(default)', validator });
  await runD5JMode({ mode: '--execute', env: baseEnv(), rootDir, commandRunner: pinnedRunner, fetchImpl: createFetchForExisting(payload) });
  assert.deepEqual(new Set(calls), new Set([
    'config get-value account --configuration=sgds-hungdiep',
    'config get-value project --configuration=sgds-hungdiep',
    'auth print-access-token --configuration=sgds-hungdiep'
  ]));
});

test('D5J deterministic synthetic payload is stable, validated, and contains no real invoice/source fields', () => {
  const first = buildD5JSyntheticPayload({ projectId: 'hung-diep-prod', databaseId: '(default)', validator });
  const second = buildD5JSyntheticPayload({ projectId: 'hung-diep-prod', databaseId: '(default)', validator });
  assert.equal(first.jobId, second.jobId);
  assert.deepEqual(first.events.map(event => event.eventId), second.events.map(event => event.eventId));
  assert.equal(first.report.reportId, second.report.reportId);
  assert.equal(first.job.executionMode, 'SHADOW');
  assert.equal(first.job.productionMutationAllowed, false);
  assert.equal(first.job.synthetic, true);
  assert.equal(first.job.environment, 'production-shadow-smoke');
  assert.equal(first.job.caseId, D5J_SYNTHETIC_SEED);
  assert.equal(first.job.businessData, false);
  assert.equal(first.job.canonicalWriteAllowed, false);
  assert.equal(first.job.commitPlan.productionMutationAllowed, false);
  assert.equal(first.job.commitPlan.synthetic, true);
  assert.equal(first.job.commitPlan.environment, 'production-shadow-smoke');
  assert.equal(first.job.commitPlan.caseId, D5J_SYNTHETIC_SEED);
  assert.equal(first.job.commitPlan.businessData, false);
  assert.equal(first.job.commitPlan.canonicalWriteAllowed, false);
  assert.equal(first.job.commitPlan.wouldMutateSteps.length, 0);
  for (const event of first.events) {
    assert.equal(event.safeDetails.synthetic, 'true');
    assert.equal(event.safeDetails.environment, 'production-shadow-smoke');
    assert.equal(event.safeDetails.caseId, D5J_SYNTHETIC_SEED);
  }
  assert.equal(first.report.synthetic, true);
  assert.equal(first.report.environment, 'production-shadow-smoke');
  assert.equal(first.report.caseId, D5J_SYNTHETIC_SEED);
  assert.equal(first.report.businessData, false);
  assert.equal(first.report.canonicalWriteAllowed, false);
  const serialized = JSON.stringify(first);
  for (const forbidden of ['gmailThreadId', 'driveFileId', '@', 'taxCode', 'invoiceNo', 'companyName', '<xml', 'JVBER']) {
    assert.equal(serialized.includes(forbidden), false, `forbidden value present: ${forbidden}`);
  }
  assert.throws(() => validator.assertNoForbiddenPersistence({ gmailThreadId: 'raw' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ driveFileId: 'raw' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ email: 'synthetic@example.invalid' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ taxCode: '1234567890' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ invoiceNo: 'A0000001' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ companyName: 'Synthetic Company' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ xml: '<xml/>' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.assertNoForbiddenPersistence({ pdf: 'JVBERi0x' }), /FIRESTORE_SHADOW_FORBIDDEN_FIELD/);
  assert.throws(() => validator.validateJobDocument({ ...first.job, productionMutationAllowed: true }), /FIRESTORE_SHADOW_PRODUCTION_MUTATION_DENIED/);
  assert.throws(() => validator.validateJobDocument({ ...first.job, status: 'COMPLETED' }), /FIRESTORE_SHADOW_PRODUCTION_STATE_DENIED/);
});

test('D5J dry-run performs zero writes and reports safe target counts', async () => {
  const fetchImpl = createFetchForExisting(buildD5JSyntheticPayload({ projectId: 'hung-diep-prod', databaseId: '(default)', validator }));
  const result = await runD5JMode({
    mode: '--dry-run',
    env: baseEnv(),
    rootDir,
    commandRunner: commandRunner(),
    fetchImpl,
    tokenProvider: () => 'synthetic-token'
  });
  assert.equal(result.dryRunStatus, 'PASS');
  assert.equal(result.productionWrite, 'NONE');
  assert.equal(result.targetReportCount, 1);
  assert.equal(fetchImpl.calls.length, 0);
});

test('D5J execute creates exact one tree, verify reads it back, and rerun is idempotent', async () => {
  const payload = buildD5JSyntheticPayload({ projectId: 'hung-diep-prod', databaseId: '(default)', validator });
  const fetchImpl = createFetchForExisting(payload);
  const first = await runD5JMode({
    mode: '--execute',
    env: baseEnv(),
    rootDir,
    commandRunner: commandRunner(),
    fetchImpl,
    tokenProvider: () => 'synthetic-token'
  });
  assert.equal(first.executionStatus, 'PASS_ONE_JOB_CREATED');
  assert.equal(first.mainJobDocumentCount, 1);
  assert.equal(first.eventDocumentCount, 4);
  assert.equal(first.reconciliationReportCount, 1);
  assert.equal(first.productionFirestoreWriteCount, 6);
  const googleApiCalls = fetchImpl.calls.filter(call => call[1].startsWith('https://firestore.googleapis.com/') || call[1].startsWith('https://firebaserules.googleapis.com/'));
  assert.ok(googleApiCalls.length > 0);
  assert.ok(googleApiCalls.every(call => call[3]['x-goog-user-project'] === 'hung-diep-prod'));

  const verify = await runD5JMode({
    mode: '--verify',
    env: baseEnv(),
    rootDir,
    commandRunner: commandRunner(),
    fetchImpl,
    tokenProvider: () => 'synthetic-token'
  });
  assert.equal(verify.readBackStatus, 'PASS');
  assert.equal(verify.commitPlanHashMatch, 'YES');

  const second = await runD5JMode({
    mode: '--execute',
    env: baseEnv(),
    rootDir,
    commandRunner: commandRunner(),
    fetchImpl,
    tokenProvider: () => 'synthetic-token'
  });
  assert.equal(second.executionStatus, 'PASS_IDEMPOTENT_REUSE');
  assert.equal(second.newJobCreated, 'NO');
  assert.equal(second.eventDocumentCountChange, 0);
  assert.equal(second.reportDocumentCountChange, 0);
});

test('D5J production database mismatch is rejected before commit', async () => {
  const payload = buildD5JSyntheticPayload({ projectId: 'hung-diep-prod', databaseId: '(default)', validator });
  const fetchImpl = createFetchForExisting(payload, { databaseName: 'projects/hung-diep-prod/databases/other' });
  await assertRejectCode(runD5JMode({
    mode: '--execute',
    env: baseEnv(),
    rootDir,
    commandRunner: commandRunner(),
    fetchImpl,
    tokenProvider: () => 'synthetic-token'
  }), 'D5J_DATABASE_MISMATCH');
  assert.equal(fetchImpl.calls.some(call => call[0] === 'POST' && call[1].includes('/documents:commit')), false);
});

test('D5J existing mismatch is a conflict and does not overwrite or choose a different job', async () => {
  const payload = buildD5JSyntheticPayload({ projectId: 'hung-diep-prod', databaseId: '(default)', validator });
  const fetchImpl = createFetchForExisting(payload, { includeExisting: true, mismatch: true });
  await assertRejectCode(runD5JMode({
    mode: '--execute',
    env: baseEnv(),
    rootDir,
    commandRunner: commandRunner(),
    fetchImpl,
    tokenProvider: () => 'synthetic-token'
  }), 'D5J_EXISTING_SMOKE_JOB_CONFLICT');
  assert.equal(fetchImpl.calls.some(call => call[0] === 'POST' && call[1].includes('/documents:commit')), false);
});

test('D5J inspect detects exact match, absent tree, partial conflict, and mismatch conflict', async () => {
  const payload = buildD5JSyntheticPayload({ projectId: 'hung-diep-prod', databaseId: '(default)', validator });
  const absentClient = createD5JFirestoreClient({ projectId: 'hung-diep-prod', databaseId: '(default)', fetchImpl: createFetchForExisting(payload), tokenProvider: () => 'synthetic-token' });
  assert.equal((await inspectD5JExistingTree(absentClient, payload)).state, 'ABSENT');

  const matchFetch = createFetchForExisting(payload, { includeExisting: true });
  const matchClient = createD5JFirestoreClient({ projectId: 'hung-diep-prod', databaseId: '(default)', fetchImpl: matchFetch, tokenProvider: () => 'synthetic-token' });
  assert.equal((await inspectD5JExistingTree(matchClient, payload)).state, 'MATCH');

  const mismatchFetch = createFetchForExisting(payload, { includeExisting: true, mismatch: true });
  const mismatchClient = createD5JFirestoreClient({ projectId: 'hung-diep-prod', databaseId: '(default)', fetchImpl: mismatchFetch, tokenProvider: () => 'synthetic-token' });
  assert.equal((await inspectD5JExistingTree(mismatchClient, payload)).state, 'CONFLICT');
});

test('D5J runner has no broad query and no broad delete code paths', () => {
  const source = fs.readFileSync('scripts/production/run-sgds-crit-003-d5j-one-job-firestore-shadow.mjs', 'utf8');
  for (const forbidden of ['collectionGroup', ':runQuery', 'recursiveDelete', "'DELETE'", '"DELETE"']) {
    assert.equal(source.includes(forbidden), false, `forbidden broad Firestore operation present: ${forbidden}`);
  }
});
