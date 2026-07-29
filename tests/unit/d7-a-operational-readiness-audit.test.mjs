import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['D7_OperationalReadinessAudit.js', 'Operator_Entrypoints.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE',
});

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

function loadD7A() {
  return loadGasSource({
    files: ['D7_OperationalReadinessAudit.js', 'Operator_Entrypoints.js'],
    exportNames: [
      'runD7AOperationalAutomationReadinessReadOnly',
      'createD7AOperationalAutomationReadinessAuditRunner_',
      'assertD7AHeaderSchema_',
      'canonicalD7AHeader_',
      'sanitizeD7ALogPayload_'
    ],
  }).exports;
}

function completeProperties(overrides = {}) {
  return {
    D6J_PILOT_SENDER: 'no-reply@example.com',
    D6J_PILOT_SUBJECT: 'bounded invoice policy',
    D6J_DRIVE_ROOT_FOLDER_ID: '1cNCIC_Tv5Y3td80xMCTCl4vCWAoyFzxW',
    D6J_SPREADSHEET_ID: '1yBbalX91VZkGIBaUJZQRt5eVllVlo53696M5hMLNAoc',
    D6J_SHEET_NAME: 'Nhap-Xuat',
    D6J_HEADER_ROW: '1',
    D7_FIRESTORE_PROJECT_ID: 'tonkhohd',
    D7_FIRESTORE_DATABASE_ID: '(default)',
    D7_MAX_MESSAGES_PER_CYCLE: '10',
    D7_MAX_ATTACHMENTS_PER_MESSAGE: '10',
    D7_MAX_RETRY_COUNT: '5',
    D7_LEASE_DURATION_SECONDS: '360',
    D7_EXECUTION_TIMEOUT_SECONDS: '240',
    D7_AUTOMATION_ENABLED: 'false',
    D7_AUTOMATION_KILL_SWITCH: 'true',
    ...overrides,
  };
}

function sourceContracts(overrides = {}) {
  return {
    d6: {
      collections: ['jobs', 'gmail_messages', 'attachments', 'audit_events', 'worker_leases'],
      retryPolicy: { maxAttempts: 5 },
    },
    d6f: {
      maxMessagesPerRun: 10,
      maxAttachmentsPerRun: 10,
      maxRetriesPerJob: 5,
      leaseDurationSeconds: 360,
    },
    shadowDefaults: { SGDS_DURABLE_SHADOW_ENABLED: false },
    hasLockServiceContract: true,
    hasDurableJobStore: true,
    hasFirestoreClient: true,
    hasTriggerInspector: true,
    hasD6jDryRun: true,
    hasD6jHeaderSchema: true,
    hasD6jCanonicalDuplicate: true,
    hasInvoiceNumberNormalization: true,
    hasAttachmentHashing: true,
    historicalStatus: 'HISTORICAL_PHASE_CLOSED_DO_NOT_EXECUTE',
    ...overrides,
  };
}

function runAudit({
  properties = completeProperties(),
  source = sourceContracts(),
  gmail = { ok: true },
  drive = { ok: true, found: true, readAccessVerified: true },
  sheet = { ok: true, spreadsheetFound: true, targetSheetFound: true, headerSchemaStatus: 'PASS' },
  firestore = { ok: true },
  triggers = [],
} = {}) {
  const logs = [];
  const { createD7AOperationalAutomationReadinessAuditRunner_ } = loadD7A();
  const runner = createD7AOperationalAutomationReadinessAuditRunner_({
    readProperties: () => properties,
    sourceInspector: () => source,
    gmailReadProbe: () => gmail,
    driveReadProbe: () => drive,
    sheetReadProbe: () => sheet,
    firestoreReadProbe: () => firestore,
    listTriggers: () => triggers,
    logger: { log: (line) => logs.push(String(line)) },
  });
  return { result: runner.run(), logs };
}

test('D7-A public entrypoint exists but unit tests use only the internal runner', () => {
  const exports = loadD7A();
  assert.equal(typeof exports.runD7AOperationalAutomationReadinessReadOnly, 'function');
  assert.equal(typeof exports.createD7AOperationalAutomationReadinessAuditRunner_, 'function');
});

test('D7-A all readiness checks passing yields read-only D7-B readiness', () => {
  const { result, logs } = runAudit();
  assert.equal(result.OPERATIONAL_READINESS_STATUS, 'PASS_READY_FOR_D7_B_READ_ONLY_CANDIDATE_DISCOVERY');
  assert.equal(result.READY_FOR_D7_B, 'YES');
  assert.equal(result.READINESS_GAP_COUNT, 0);
  assert.equal(result.SCRIPT_PROPERTIES_READ_STATUS, 'PASS');
  assert.equal(result.GMAIL_QUERY_BOUNDED, 'YES');
  assert.equal(result.GMAIL_MUTATION_REACHABLE, 'NO');
  assert.equal(result.DRIVE_WRITE_ACCESS_NOT_PROBED, 'YES');
  assert.equal(result.SHEET_WRITE_EXECUTED, 'NO');
  assert.equal(result.FIRESTORE_WRITE_PROBE_EXECUTED, 'NO');
  assert.equal(result.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(result.CANDIDATE_DISCOVERY_EXECUTED, 'NO');
  assert.equal(result.PRODUCTION_MUTATION, 'NONE');
  assert.equal(logs.some(line => line.includes('PASS_READY_FOR_D7_B_READ_ONLY_CANDIDATE_DISCOVERY')), true);
});

test('D7-A reports missing required properties without logging values', () => {
  const props = completeProperties();
  delete props.D6J_DRIVE_ROOT_FOLDER_ID;
  const { result, logs } = runAudit({ properties: props, drive: { ok: false, found: false, readAccessVerified: false } });
  assert.equal(result.OPERATIONAL_READINESS_STATUS, 'BLOCKED_DRIVE_READINESS');
  assert.ok(result.READINESS_GAPS.includes('PROPERTY_DRIVE_ROOT_FOLDER_ID_MISSING'));
  assert.equal(JSON.stringify(result).includes('1cNCIC_Tv5Y3td80xMCTCl4vCWAoyFzxW'), false);
  assert.equal(logs.join('\n').includes('1cNCIC_Tv5Y3td80xMCTCl4vCWAoyFzxW'), false);
});

test('D7-A never emits secret-like values from properties or logs', () => {
  const { result, logs } = runAudit({
    properties: completeProperties({ D7_NOTIFICATION_POLICY: 'Bearer ' + 'ya' + '29.redacted-token <Invoice>private</Invoice>' }),
  });
  const text = JSON.stringify(result) + logs.join('\n');
  assert.equal(text.includes('ya' + '29.redacted-token'), false);
  assert.equal(text.includes('<Invoice>'), false);
  assert.equal(result.SECRET_VALUE_LOG_COUNT, 0);
});

test('D7-A kill-switch disabled safe, enabled blocks, and unknown blocks', () => {
  assert.equal(runAudit().result.KILL_SWITCH_AUDIT_STATUS, 'PASS');

  const enabled = runAudit({ properties: completeProperties({ D7_AUTOMATION_ENABLED: 'true' }) }).result;
  assert.equal(enabled.OPERATIONAL_READINESS_STATUS, 'BLOCKED_KILL_SWITCH_NOT_SAFE');
  assert.ok(enabled.READINESS_GAPS.includes('AUTOMATION_CURRENTLY_ENABLED'));

  const unknown = runAudit({ properties: completeProperties({ D7_AUTOMATION_KILL_SWITCH: 'maybe' }) }).result;
  assert.equal(unknown.OPERATIONAL_READINESS_STATUS, 'BLOCKED_KILL_SWITCH_NOT_SAFE');
  assert.ok(unknown.READINESS_GAPS.includes('KILL_SWITCH_STATE_UNKNOWN'));
});

test('D7-A blocks Gmail readiness when bounded read access or query contract is absent', () => {
  const result = runAudit({
    gmail: { ok: false },
    source: sourceContracts({ hasD6jDryRun: false }),
  }).result;
  assert.equal(result.OPERATIONAL_READINESS_STATUS, 'BLOCKED_GMAIL_READINESS');
  assert.equal(result.GMAIL_READ_ACCESS_STATUS, 'BLOCKED');
  assert.equal(result.GMAIL_QUERY_POLICY_STATUS, 'BLOCKED');
  assert.equal(result.GMAIL_MESSAGE_CONTENT_LOGGED, 'NO');
});

test('D7-A blocks Sheet readiness on schema mismatch and keeps writes unreachable', () => {
  const { assertD7AHeaderSchema_, canonicalD7AHeader_ } = loadD7A();
  const productionHeader = ['STT', 'Ngày', 'Hóa đơn số', 'Tên khách hàng', 'Mã hàng', 'Tên hàng', 'Phân loại', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Đơn giá BQ', 'Số lượng tồn', 'Giá trị tồn', 'HashIndex', 'InvoiceKey', 'HĐ'];
  assert.equal(assertD7AHeaderSchema_(productionHeader).status, 'PASS');
  assert.equal(canonicalD7AHeader_('Đơn giá BQ'), 'dongiabq');

  const result = runAudit({
    sheet: { ok: false, spreadsheetFound: true, targetSheetFound: true, headerSchemaStatus: 'BLOCKED' },
  }).result;
  assert.equal(result.OPERATIONAL_READINESS_STATUS, 'BLOCKED_SHEET_READINESS');
  assert.equal(result.SHEET_MUTATION_REACHABLE_FROM_AUDIT, 'NO');
});

test('D7-A blocks Firestore readiness without read access and does not use legacy jobs collection for runtime', () => {
  const result = runAudit({ firestore: { ok: false } }).result;
  assert.equal(result.OPERATIONAL_READINESS_STATUS, 'BLOCKED_FIRESTORE_READINESS');
  assert.equal(result.DURABLE_JOB_COLLECTION, 'invoiceJobs');
  assert.equal(result.LEGACY_JOB_COLLECTION_USED_FOR_RUNTIME, 'NO');
  assert.equal(result.FIRESTORE_MUTATION_REACHABLE_FROM_AUDIT, 'NO');
});

test('D7-A blocks missing lock, missing lease fencing inputs, and unbounded retry or batch limits', () => {
  const result = runAudit({
    source: sourceContracts({
      hasLockServiceContract: false,
      d6f: { maxMessagesPerRun: 0, maxAttachmentsPerRun: 0, maxRetriesPerJob: 0, leaseDurationSeconds: 0 },
    }),
  }).result;
  assert.equal(result.OPERATIONAL_READINESS_STATUS, 'BLOCKED_CONCURRENCY_OR_RETRY_SAFETY');
  assert.equal(result.SCRIPT_LOCK_DEFINED, 'NO');
  assert.equal(result.FIRESTORE_LEASE_DEFINED, 'NO');
  assert.equal(result.MAX_RETRY_COUNT_DEFINED, 'NO');
  assert.equal(result.UNBOUNDED_LOOP_COUNT, 0);
  assert.equal(result.UNBOUNDED_PAGINATION_COUNT, 0);
});

test('D7-A blocks existing, duplicate, unknown, and historical triggers without mutating triggers', () => {
  const d7 = runAudit({ triggers: [{ handlerFunction: 'runSgdsWorkerDryRun', triggerType: 'time_based' }] }).result;
  assert.equal(d7.OPERATIONAL_READINESS_STATUS, 'BLOCKED_EXISTING_OR_UNKNOWN_TRIGGER');
  assert.equal(d7.D7_AUTOMATION_TRIGGER_COUNT, 1);

  const duplicate = runAudit({ triggers: [{ handlerFunction: 'main' }, { handlerFunction: 'main' }] }).result;
  assert.equal(duplicate.DUPLICATE_TRIGGER_COUNT, 1);

  const unknown = runAudit({ triggers: [{ handlerFunction: 'runUnexpectedAutomation' }] }).result;
  assert.equal(unknown.UNKNOWN_TRIGGER_HANDLER_COUNT, 1);

  const historical = runAudit({ triggers: [{ handlerFunction: 'runD6jCOneRecordProductionMutation' }] }).result;
  assert.equal(historical.HISTORICAL_D6J_TRIGGER_COUNT, 1);
  assert.equal(historical.TRIGGER_MUTATION_COUNT, 0);
});

test('D7-A frozen D6J mutation reachability remains zero and raw payload sanitizer redacts forbidden content', () => {
  const { sanitizeD7ALogPayload_ } = loadD7A();
  const result = runAudit().result;
  assert.equal(result.FROZEN_D6J_ENTRYPOINT_COUNT, 6);
  assert.equal(result.FROZEN_D6J_MUTATION_REACHABILITY_COUNT, 0);
  assert.equal(result.BROKEN_HANDLER_REFERENCE_COUNT, 0);
  assert.equal(result.GLOBAL_NAME_COLLISION_COUNT, 0);
  const sanitized = sanitizeD7ALogPayload_({ xmlContent: '<Invoice>secret</Invoice>', safe: 'ok' });
  assert.equal(sanitized.xmlContent, 'REDACTED');
  assert.equal(sanitized.safe, 'ok');
});
