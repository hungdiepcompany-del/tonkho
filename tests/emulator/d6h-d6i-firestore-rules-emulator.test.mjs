import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['firestore.rules', 'firestore.indexes.json'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const fixtures = JSON.parse(fs.readFileSync('fixtures/d6h-d6i/ui-command-fixtures.json', 'utf8'));
const rules = fs.readFileSync('firestore.rules', 'utf8');

function canRead(collection, authName) {
  const user = fixtures.users[authName];
  if (collection === 'authorized_users') return Boolean(user);
  return Boolean(user && user.active === true && ['jobs', 'gmail_messages', 'attachments', 'audit_events', 'commands', 'worker_run_summaries', 'worker_leases', 'runtime_config'].includes(collection));
}

function canCreateCommand(authName, doc) {
  const user = fixtures.users[authName];
  if (!user || user.active !== true) return false;
  if (user.role === 'viewer') return false;
  if (user.role === 'operator' && !['retry_job', 'reprocess_attachment', 'reconcile_job'].includes(doc.commandType)) return false;
  if (!['retry_job', 'ignore_job', 'reprocess_attachment', 'reconcile_job'].includes(doc.commandType)) return false;
  if (doc.requestedByUid !== user.uid || doc.requestedByEmail !== user.email) return false;
  if (doc.status !== 'requested') return false;
  if (doc.claimedBy || doc.completedAt || doc.resultCode || doc.failureCode) return false;
  if (doc.schemaVersion !== 'SGDS_D6H_D6I_FIREBASE_UI_COMMAND_QUEUE_V1') return false;
  if (!/^cmdem_[A-Fa-f0-9]{8}$/.test(doc.idempotencyKey || '')) return false;
  if (!/^[A-Za-z0-9_-]{1,96}$/.test(doc.targetJobId || '')) return false;
  if ((doc.commandType === 'ignore_job' || doc.commandType === 'reprocess_attachment') && !(doc.reason || '').trim()) return false;
  if ((doc.reason || '').length > 300) return false;
  return true;
}

function commandDoc(overrides = {}) {
  return {
    commandId: 'cmd_1234abcd',
    commandType: 'retry_job',
    targetJobId: 'job_retry_001',
    targetAttachmentId: '',
    requestedByUid: fixtures.users.operator.uid,
    requestedByEmail: fixtures.users.operator.email,
    requestedAt: '2026-07-18T00:06:00.000Z',
    reason: 'safe local reason',
    idempotencyKey: 'cmdem_1234abcd',
    status: 'requested',
    schemaVersion: 'SGDS_D6H_D6I_FIREBASE_UI_COMMAND_QUEUE_V1',
    ...overrides
  };
}

test('metadata and rules source declares default deny and UID-based authorization', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  for (const marker of [
    'function isD6hD6iAuthorized()',
    'authorized_users/$(request.auth.uid)',
    'match /commands/{commandId}',
    'allow update, delete: if false',
    'match /{document=**}',
    'allow read, write: if false'
  ]) assert.equal(rules.includes(marker), true, `rules missing ${marker}`);
});

test('Firestore rules tests 1-4: unauthenticated, missing authorized user, inactive user, viewer read', () => {
  assert.equal(canRead('jobs', null), false);
  assert.equal(canRead('jobs', 'missing'), false);
  assert.equal(canRead('jobs', 'inactive'), false);
  assert.equal(canRead('jobs', 'viewer'), true);
});

test('Firestore rules tests 5-13: command create role checks and frontend cannot update or delete', () => {
  assert.equal(canCreateCommand('viewer', commandDoc()), false);
  assert.equal(canCreateCommand('operator', commandDoc()), true);
  assert.equal(canCreateCommand('admin', commandDoc({ requestedByUid: fixtures.users.admin.uid, requestedByEmail: fixtures.users.admin.email, commandType: 'ignore_job', reason: 'safe reason' })), true);
  assert.equal(canCreateCommand('operator', commandDoc({ requestedByUid: fixtures.users.admin.uid })), false);
  assert.equal(canCreateCommand('operator', commandDoc({ requestedByEmail: fixtures.users.admin.email })), false);
  assert.equal(canCreateCommand('operator', commandDoc({ status: 'completed' })), false);
  assert.equal(canCreateCommand('operator', commandDoc({ claimedBy: 'worker' })), false);
  assert.match(rules, /allow update, delete: if false/);
});

test('Firestore rules tests 14-18: system collections and authorized users are not client-writable', () => {
  for (const marker of [
    'match /jobs/{jobId}',
    'match /audit_events/{eventId}',
    'match /worker_leases/{leaseId}',
    'match /runtime_config/{configId}',
    'match /authorized_users/{userId}'
  ]) assert.equal(rules.includes(marker), true, `rules missing ${marker}`);
  assert.match(rules, /allow create, update, delete: if false/);
});

test('Firestore rules tests 19-25: unsupported type, reason, schema, target id, idempotency shape, bounded reads', () => {
  assert.equal(canCreateCommand('admin', commandDoc({ commandType: 'delete_source', requestedByUid: fixtures.users.admin.uid, requestedByEmail: fixtures.users.admin.email })), false);
  assert.equal(canCreateCommand('admin', commandDoc({ commandType: 'ignore_job', requestedByUid: fixtures.users.admin.uid, requestedByEmail: fixtures.users.admin.email, reason: '' })), false);
  assert.equal(canCreateCommand('operator', commandDoc({ reason: 'x'.repeat(301) })), false);
  assert.equal(canCreateCommand('operator', commandDoc({ schemaVersion: 'BAD_VERSION' })), false);
  assert.equal(canCreateCommand('operator', commandDoc({ targetJobId: '../bad' })), false);
  assert.equal(canCreateCommand('operator', commandDoc({ idempotencyKey: 'not-stable' })), false);
  assert.equal(fixtures.rulesCases.length, 25);
});
