import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const requiredFiles = [
  'sgdsCommandQueue.js',
  'web/firebase-monitoring/index.html',
  'web/firebase-monitoring/styles.css',
  'web/firebase-monitoring/sgds-monitoring-ui.mjs',
  'fixtures/d6h-d6i/ui-command-fixtures.json',
  'tests/unit/d6h-d6i-firebase-ui-command-queue.test.mjs',
  'tests/emulator/d6h-d6i-command-processor-emulator.test.mjs',
  'tests/emulator/d6h-d6i-firestore-rules-emulator.test.mjs',
  'docs/phases/D6H_D6I_FIREBASE_UI_COMMAND_QUEUE.md',
  'docs/evidence/D6H_D6I_LOCAL_UI_COMMAND_QUEUE_EVIDENCE.md'
];

for (const file of requiredFiles) assert.equal(exists(file), true, `missing D6H-D6I file: ${file}`);

const ui = read('web/firebase-monitoring/sgds-monitoring-ui.mjs');
const html = read('web/firebase-monitoring/index.html');
const command = read('sgdsCommandQueue.js');
const rules = read('firestore.rules');
const indexes = JSON.parse(read('firestore.indexes.json'));
const unitTests = read('tests/unit/d6h-d6i-firebase-ui-command-queue.test.mjs');
const emulatorTests = read('tests/emulator/d6h-d6i-command-processor-emulator.test.mjs') + read('tests/emulator/d6h-d6i-firestore-rules-emulator.test.mjs');
const fixtures = JSON.parse(read('fixtures/d6h-d6i/ui-command-fixtures.json'));
const phaseDoc = read('docs/phases/D6H_D6I_FIREBASE_UI_COMMAND_QUEUE.md');
const evidenceDoc = read('docs/evidence/D6H_D6I_LOCAL_UI_COMMAND_QUEUE_EVIDENCE.md');
const pkg = JSON.parse(read('package.json'));

for (const marker of [
  'auth_initializing',
  'signed_out',
  'signing_in',
  'signed_in_unverified',
  'authorized',
  'unauthorized',
  'disabled_user',
  'auth_error',
  'authorized_users/{uid}',
  'createAuthStateMachine',
  'createReadModelService',
  'buildDashboardSummary',
  'loadJobDetail',
  'normalizeAuditEvent',
  'normalizeRunSummary',
  'buildCommandRequest',
  'evaluateUiCommandEligibility',
  'createUiIdempotencyKey',
  'validateFirebaseWebConfig',
  'FRONTEND_DIRECT_WRITE_DENIED',
  'UNBOUNDED_QUERY_DENIED',
  'LOCAL EMULATOR'
]) assert.equal(ui.includes(marker) || html.includes(marker), true, `UI missing marker: ${marker}`);

for (const marker of [
  'getSgdsD6hD6iCommandQueueContract_',
  'commands/{commandId}',
  'authorized_users/{uid}',
  'retry_job',
  'ignore_job',
  'reprocess_attachment',
  'reconcile_job',
  'requested',
  'claimed',
  'executing',
  'completed',
  'rejected',
  'failed',
  'createSgdsCommandRequest_',
  'createSgdsCommandProcessor_',
  'createFakeSgdsCommandRepository_',
  'frontendMayUpdateCommands: false',
  'frontendMayDeleteCommands: false',
  'frontendMayWriteJobsDirectly: false',
  'LOCAL_EMULATOR_SIMULATED',
  'productionCallCount: 0',
  'productionMutationCount: 0'
]) assert.equal(command.includes(marker), true, `command queue missing marker: ${marker}`);

for (const marker of [
  'function isD6hD6iAuthorized()',
  'authorized_users/$(request.auth.uid)',
  'match /jobs/{jobId}',
  'match /gmail_messages/{messageId}',
  'match /attachments/{attachmentId}',
  'match /audit_events/{eventId}',
  'match /worker_leases/{leaseId}',
  'match /runtime_config/{configId}',
  'match /commands/{commandId}',
  'allow create: if d6hD6iCanCreateCommand',
  'allow update, delete: if false',
  'allow read, write: if false'
]) assert.equal(rules.includes(marker), true, `rules missing marker: ${marker}`);

const indexFields = indexes.indexes.map(index => `${index.collectionGroup}:${index.fields.map(field => `${field.fieldPath}:${field.order}`).join('+')}`);
for (const expected of [
  'jobs:status:ASCENDING+updatedAt:DESCENDING',
  'jobs:reviewRequired:ASCENDING+updatedAt:DESCENDING',
  'commands:status:ASCENDING+requestedAt:DESCENDING',
  'commands:targetJobId:ASCENDING+requestedAt:DESCENDING',
  'audit_events:jobId:ASCENDING+occurredAt:ASCENDING'
]) assert.equal(indexFields.includes(expected), true, `missing index: ${expected}`);

for (const marker of [
  'AUTH: loading state',
  'DASHBOARD: aggregate rendering',
  'JOBS: list filters',
  'COMMANDS: viewer cannot submit',
  'SECURITY: escaped text',
  'COMMAND QUEUE: document contract'
]) assert.equal(unitTests.includes(marker), true, `unit tests missing marker: ${marker}`);

for (const marker of [
  'valid retry command claimed once',
  'duplicate command rejected or no-op',
  'target job missing',
  'ignore, reprocess attachment and reconciliation command simulate safely',
  'Firestore rules tests 1-4',
  'Firestore rules tests 5-13',
  'Firestore rules tests 14-18',
  'Firestore rules tests 19-25'
]) assert.equal(emulatorTests.includes(marker), true, `emulator tests missing marker: ${marker}`);

assert.equal(fixtures.fixturePolicy.syntheticOnly, true, 'fixtures must be synthetic');
assert.equal(fixtures.fixturePolicy.liveFirebase, false, 'fixtures must not use live Firebase');
assert.equal(fixtures.fixturePolicy.liveWorkspaceApis, false, 'fixtures must not call live Workspace APIs');
assert.equal(fixtures.fixturePolicy.productionFirestore, false, 'fixtures must not use production Firestore');
assert.equal(fixtures.fixturePolicy.adminCredentials, false, 'fixtures must not contain admin credentials');
assert.equal(fixtures.rulesCases.length, 25, 'rules fixture must cover 25 cases');

for (const marker of [
  'PHASE=D6H_D6I_FIREBASE_UI_COMMAND_QUEUE',
  'STATUS=PASS_LOCAL_IMPLEMENTATION_VALIDATED',
  'FIREBASE_UI=IMPLEMENTED_LOCAL_STATIC',
  'AUTHENTICATION_FOUNDATION=IMPLEMENTED',
  'COMMAND_QUEUE_CONTRACT=IMPLEMENTED',
  'COMMAND_PROCESSOR_MODE=LOCAL_EMULATOR_SIMULATED',
  'FIRESTORE_RULES=IMPLEMENTED_LOCAL_NOT_DEPLOYED',
  'DEFAULT_DENY=YES',
  'PRODUCTION_FIRESTORE_ACCESS=NONE',
  'FIREBASE_DEPLOY=NOT_RUN',
  'NEXT_ALLOWED_PHASE=D6J_LIMITED_PRODUCTION_PILOT_PREPARATION'
]) {
  assert.equal(phaseDoc.includes(marker), true, `phase doc missing ${marker}`);
  assert.equal(evidenceDoc.includes(marker), true, `evidence doc missing ${marker}`);
}

const forbiddenPlain = [
  'firebase-admin',
  'dangerouslySetInnerHTML',
  'innerHTML =',
  '.setDoc(',
  '.updateDoc(',
  '.deleteDoc(',
  'collection(db, \'jobs\')',
  'collection(db, "jobs")',
  'firebase deploy',
  'firebase deploy --only firestore',
  'firebase deploy --only hosting',
  'clasp push',
  'gcloud services enable',
  'gcloud run deploy',
  'Cloud Run becomes primary',
  'authorizationDomainOnly'
];
for (const token of forbiddenPlain) {
  assert.equal(ui.includes(token), false, `UI contains forbidden token: ${token}`);
  assert.equal(command.includes(token), false, `command queue contains forbidden token: ${token}`);
}

for (const token of [
  ['service', 'account'].join('_'),
  ['private', 'key'].join('_'),
  ['client', 'secret'].join('_'),
  ['refresh', 'token'].join('_'),
  ['ya', '29.'].join('')
]) {
  assert.equal(ui.includes(token), false, `UI contains secret-shaped token: ${token}`);
  assert.equal(command.includes(token), false, `command queue contains secret-shaped token: ${token}`);
  assert.equal(JSON.stringify(fixtures).includes(token), false, `fixtures contain secret-shaped token: ${token}`);
}

assert.equal(pkg.scripts['check:d6h-d6i-firebase-ui-command-queue'], 'node scripts/checkers/check-d6h-d6i-firebase-ui-command-queue.mjs');
assert.equal(pkg.scripts['build:firebase-monitoring-ui'], 'node scripts/checkers/check-d6h-d6i-firebase-ui-command-queue.mjs');

console.log('D6H_D6I_FIREBASE_UI_COMMAND_QUEUE_CHECK=PASS');
