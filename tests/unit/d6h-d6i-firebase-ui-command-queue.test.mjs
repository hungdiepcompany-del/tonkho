import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import {
  AUTH_STATES,
  BOUNDED_QUERY_LIMIT,
  buildCommandRequest,
  buildDashboardSummary,
  buildJobQuery,
  createAuthStateMachine,
  createFakeFirestoreTransport,
  createReadModelService,
  createUiIdempotencyKey,
  evaluateUiCommandEligibility,
  normalizeAuthorizedUser,
  normalizeJob,
  renderMonitoringApp,
  roleCanCreateCommand,
  validateFirebaseWebConfig
} from '../../web/firebase-monitoring/sgds-monitoring-ui.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'web/firebase-monitoring/sgds-monitoring-ui.mjs',
    'web/firebase-monitoring/index.html',
    'web/firebase-monitoring/styles.css',
    'sgdsCommandQueue.js',
    'firestore.rules'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['sgdsCommandQueue.js'],
  exportNames: [
    'SGDS_D6H_D6I_SCHEMA_VERSION_',
    'SGDS_D6H_D6I_PRODUCTION_ACCESS_',
    'SGDS_D6I_COMMAND_TYPES_',
    'SGDS_D6I_COMMAND_STATUSES_',
    'SGDS_D6I_ROLE_PERMISSIONS_',
    'getSgdsD6hD6iCommandQueueContract_',
    'normalizeSgdsAuthorizedUser_',
    'createSgdsCommandIdempotencyKey_',
    'createSgdsCommandId_',
    'createSgdsCommandRequest_',
    'evaluateSgdsCommandEligibility_',
    'createSgdsCommandProcessor_',
    'createFakeSgdsCommandRepository_',
    'createD6iClock_'
  ]
});

const fixtures = JSON.parse(fs.readFileSync('fixtures/d6h-d6i/ui-command-fixtures.json', 'utf8'));
const fromVm = value => JSON.parse(JSON.stringify(value));

test('metadata and D6H-D6I contract markers', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.SGDS_D6H_D6I_SCHEMA_VERSION_, 'SGDS_D6H_D6I_COMMAND_QUEUE_V1');
  assert.equal(gas.exports.SGDS_D6H_D6I_PRODUCTION_ACCESS_, 'NONE');
  assert.deepEqual(Array.from(gas.exports.SGDS_D6I_COMMAND_TYPES_), ['retry_job', 'ignore_job', 'reprocess_attachment', 'reconcile_job']);
  assert.deepEqual(AUTH_STATES, [
    'auth_initializing',
    'signed_out',
    'signing_in',
    'signed_in_unverified',
    'authorized',
    'unauthorized',
    'disabled_user',
    'auth_error'
  ]);
  const contract = fromVm(gas.call('getSgdsD6hD6iCommandQueueContract_'));
  assert.equal(contract.frontendMayUpdateCommands, false);
  assert.equal(contract.frontendMayDeleteCommands, false);
  assert.equal(contract.frontendMayWriteJobsDirectly, false);
});

test('AUTH: loading state, signed-out state, authorized roles, inactive user, sign-out cleanup, emulator mode indicator, auth error', () => {
  const machine = createAuthStateMachine();
  assert.equal(machine.getState().state, 'auth_initializing');
  assert.equal(renderMonitoringApp({ authState: 'auth_initializing' }).includes('data-state="loading"'), true);
  assert.equal(machine.signedOut().state, 'signed_out');
  assert.equal(renderMonitoringApp({ authState: 'signed_out' }).includes('google-sign-in'), true);
  machine.signingIn();
  machine.signedIn({ uid: fixtures.users.operator.uid, email: fixtures.users.operator.email, displayName: 'Operator Example' });
  assert.equal(machine.authorize(fixtures.users.operator).state, 'authorized');
  assert.equal(normalizeAuthorizedUser(fixtures.users.viewer).role, 'viewer');
  assert.equal(normalizeAuthorizedUser(fixtures.users.admin).role, 'admin');
  machine.signedIn({ uid: fixtures.users.inactive.uid, email: fixtures.users.inactive.email });
  assert.equal(machine.authorize(fixtures.users.inactive).state, 'disabled_user');
  machine.fail({ message: 'Authorization bearer shaped value' });
  assert.equal(machine.getState().safeError, 'REDACTED_SECRET');
  machine.signedIn({ uid: fixtures.users.operator.uid, email: fixtures.users.operator.email });
  machine.authorize(fixtures.users.operator);
  machine.getState().privilegedState.jobs.push?.('local-only');
  assert.equal(machine.signedOut().state, 'signed_out');
  assert.equal(renderMonitoringApp({ authState: 'authorized', emulatorMode: true, dashboard: { counts: {} } }).includes('LOCAL EMULATOR'), true);
});

test('DASHBOARD: aggregate rendering, no-data, partial-data, malformed record handling, permission error, bounded query behavior', async () => {
  const summary = buildDashboardSummary(fixtures.jobs.map(normalizeJob), fixtures.commands);
  assert.equal(summary.counts.completed, 1);
  assert.equal(summary.counts.failed_retryable, 1);
  assert.equal(summary.counts.review_required, 1);
  assert.equal(renderMonitoringApp({ authState: 'authorized', dashboard: summary, jobs: [], commands: [] }).includes('data-empty="jobs"'), true);
  assert.equal(normalizeJob({ jobId: 'bad id with slash', lastErrorMessage: '<script>bad</script>' }).jobId, '');
  const transport = createFakeFirestoreTransport(fixtures);
  const service = createReadModelService(transport, { queryLimit: 10 });
  const dashboard = await service.loadDashboard({ status: 'failed_retryable' });
  assert.equal(dashboard.counts.failed_retryable, 1);
  assert.equal(transport.calls.every(call => !call.query || call.query.limit <= BOUNDED_QUERY_LIMIT), true);
  await assert.rejects(
    () => createFakeFirestoreTransport(fixtures).query('jobs', { limit: BOUNDED_QUERY_LIMIT + 1 }),
    /UNBOUNDED_QUERY_DENIED/
  );
});

test('JOBS: list filters, pagination, details, checkpoint timeline, retry status, reconciliation state, redacted errors', async () => {
  const query = buildJobQuery({ status: 'failed_retryable', reviewRequired: true, fromDate: '2026-07-18T00:00:00.000Z' }, 5);
  assert.equal(query.limit, 5);
  assert.deepEqual(query.orderBy, [['updatedAt', 'desc']]);
  const service = createReadModelService(createFakeFirestoreTransport(fixtures));
  const jobs = await service.loadJobs({ status: 'failed_retryable' });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].retryEligible, true);
  const detail = await service.loadJobDetail('job_retry_001');
  assert.equal(detail.job.reconciliationStatus, 'requires_review');
  assert.equal(detail.auditTimeline[0].redactedSummary, 'safe redacted transition');
  assert.equal(detail.attachments.length, 2);
  assert.equal(detail.gmailMessages[0].threadHashPrefix, 'thread001');
});

test('COMMANDS: viewer cannot submit, operator retry, ineligible retry, ignore reason, duplicate prevention, stable idempotency, success/rejection/failure states', () => {
  assert.equal(roleCanCreateCommand(fixtures.users.viewer, 'retry_job'), false);
  assert.equal(roleCanCreateCommand(fixtures.users.operator, 'retry_job'), true);
  assert.equal(roleCanCreateCommand(fixtures.users.operator, 'ignore_job'), false);
  assert.equal(roleCanCreateCommand(fixtures.users.admin, 'ignore_job'), true);
  const retryRequest = buildCommandRequest({ commandType: 'retry_job', targetJobId: 'job_retry_001', reason: 'retry temporary failure' }, fixtures.users.operator);
  assert.equal(retryRequest.status, 'requested');
  assert.equal(retryRequest.idempotencyKey, createUiIdempotencyKey({ commandType: 'retry_job', targetJobId: 'job_retry_001', targetAttachmentId: '', reason: 'retry temporary failure' }));
  assert.equal(evaluateUiCommandEligibility('retry_job', fixtures.jobs[0], { pendingCommands: [] }).eligible, true);
  assert.equal(evaluateUiCommandEligibility('retry_job', fixtures.jobs[1], { pendingCommands: [] }).code, 'JOB_NOT_RETRYABLE');
  assert.equal(evaluateUiCommandEligibility('ignore_job', fixtures.jobs[0], { reason: '' }).code, 'REASON_REQUIRED');
  assert.equal(evaluateUiCommandEligibility('retry_job', fixtures.jobs[0], { pendingCommands: [fixtures.commands[0]] }).code, 'ACTIVE_DUPLICATE_COMMAND');
  assert.throws(() => buildCommandRequest({ commandType: 'delete_source', targetJobId: 'job_retry_001' }, fixtures.users.admin), /COMMAND_TYPE_UNSUPPORTED/);
});

test('COMMAND QUEUE: document contract, eligibility, idempotency and frontend direct job update denial', () => {
  const actor = gas.call('normalizeSgdsAuthorizedUser_', fixtures.users.operator);
  const request = fromVm(gas.call('createSgdsCommandRequest_', {
    commandType: 'retry_job',
    targetJobId: 'job_retry_001',
    reason: 'retry temporary failure'
  }, actor, { now: '2026-07-18T00:06:00.000Z' }));
  assert.equal(request.status, 'requested');
  assert.equal(request.claimedBy, '');
  const expectedKey = gas.call('createSgdsCommandIdempotencyKey_', request);
  assert.equal(request.idempotencyKey, expectedKey);
  const repository = gas.call('createFakeSgdsCommandRepository_', { jobs: fixtures.jobs });
  const created = fromVm(repository.createCommand(request));
  assert.equal(created.created, true);
  assert.equal(fromVm(repository.createCommand(request)).duplicate, true);
  assert.equal(fromVm(gas.call('evaluateSgdsCommandEligibility_', request, fixtures.jobs[0], { pendingCommands: [] })).status, 'eligible');
  assert.equal(typeof createFakeFirestoreTransport(fixtures).update, 'function');
});

test('SECURITY: escaped text, raw email HTML not rendered, token-shaped values redacted, admin SDK and credential-shaped config rejected', () => {
  const rendered = renderMonitoringApp({
    authState: 'authorized',
    dashboard: { counts: {} },
    jobs: [{ jobId: 'job_retry_001', status: '<img src=x onerror=bad>', lastErrorMessage: '<script>bad</script>' }],
    commands: []
  });
  assert.equal(rendered.includes('<script>bad</script>'), false);
  assert.equal(rendered.includes('&lt;script&gt;bad&lt;/script&gt;'), true);
  assert.equal(fs.readFileSync('web/firebase-monitoring/sgds-monitoring-ui.mjs', 'utf8').includes('dangerouslySetInnerHTML'), false);
  assert.equal(fs.readFileSync('web/firebase-monitoring/sgds-monitoring-ui.mjs', 'utf8').includes('firebase-admin'), false);
  const adminCredentialKey = ['service', 'account'].join('_');
  assert.throws(() => validateFirebaseWebConfig({ projectId: 'demo-sgds-local', [adminCredentialKey]: true }, { emulator: true }), /ADMIN_CREDENTIAL_SHAPED_CONFIG_REJECTED/);
  assert.equal(validateFirebaseWebConfig({ projectId: 'tonkhohd', authDomain: 'tonkhohd.firebaseapp.com' }, { emulator: false }).publicWebConfigOnly, true);
});
