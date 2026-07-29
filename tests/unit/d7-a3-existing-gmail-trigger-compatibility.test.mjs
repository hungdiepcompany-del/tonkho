import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import {
  analyzeD7A3ExistingGmailTriggerCompatibility,
  decideD7A3OwnerDecision,
} from '../../scripts/analysis/d7-a3-existing-gmail-trigger-compatibility.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'scripts/analysis/d7-a3-existing-gmail-trigger-compatibility.mjs',
    'D7_OperationalReadinessAudit.js',
    '_triggerMarkInvoiceEmails.js',
    'gmailLabels.js',
    'sercurity.js',
    'Invoice_AttachmentParser.js',
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE',
});

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

function analyze() {
  return analyzeD7A3ExistingGmailTriggerCompatibility({ rootDir: process.cwd() });
}

function loadD7A() {
  return loadGasSource({
    files: ['D7_OperationalReadinessAudit.js', 'Operator_Entrypoints.js'],
    exportNames: [
      'createD7AOperationalAutomationReadinessAuditRunner_',
      'createD7ACompactSummary_',
    ],
  }).exports;
}

function completeProperties() {
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
  };
}

function sourceContracts() {
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
  };
}

test('D7-A3 classifies Gmail label creation and assignment as mutation', () => {
  const report = analyze();
  assert.equal(report.EXISTING_TRIGGER_CLASSIFICATION, 'MUTATING_GMAIL_TRIGGER');
  assert.equal(report.GMAIL_LABEL_CREATION_REACHABLE, 'YES');
  assert.equal(report.GMAIL_LABEL_ASSIGNMENT_REACHABLE, 'YES');
  assert.deepEqual(report.LABEL_CREATION_METHODS, ['GmailApp.createLabel']);
  assert.deepEqual(report.LABEL_ASSIGNMENT_METHODS, ['label.addToThread']);
});

test('D7-A3 classifies markImportant and star as Gmail mutations', () => {
  const report = analyze();
  assert.equal(report.GMAIL_IMPORTANT_MUTATION_REACHABLE, 'YES');
  assert.equal(report.GMAIL_STAR_MUTATION_REACHABLE, 'YES');
  assert.ok(report.GMAIL_MUTATION_METHODS.includes('thread.markImportant'));
  assert.ok(report.GMAIL_MUTATION_METHODS.includes('message.star'));
});

test('D7-A3 trigger presence is known and cannot be silently allowlisted', () => {
  const report = analyze();
  assert.equal(report.SOURCE_HANDLER_EXISTS, 'YES');
  assert.equal(report.INSTALLED_TRIGGER_HANDLER, 'triggerMarkAllInvoiceEmails');
  assert.notEqual(report.EXISTING_TRIGGER_CLASSIFICATION, 'UNKNOWN_TRIGGER_REQUIRES_OWNER_REVIEW');
  assert.notEqual(report.RECOMMENDED_OWNER_DECISION, 'PRESERVE_AND_ALLOW_COEXISTENCE_WITH_EXPLICIT_GUARDS');
  assert.equal(report.READY_FOR_D7_B, 'NO_PENDING_OWNER_TRIGGER_DECISION');
});

test('D7-A3 records reachable Drive mutation from PDF OCR cleanup but no Sheet or Firestore mutation', () => {
  const report = analyze();
  assert.equal(report.XML_PARSING_REACHABLE, 'YES');
  assert.equal(report.PDF_PARSING_REACHABLE, 'YES');
  assert.equal(report.DRIVE_MUTATION_REACHABLE, 'YES');
  assert.equal(report.SHEET_MUTATION_REACHABLE, 'NO');
  assert.equal(report.FIRESTORE_MUTATION_REACHABLE, 'NO');
});

test('D7-A3 UNKNOWN and HIGH interference block continuation', () => {
  assert.equal(
    decideD7A3OwnerDecision({ interferenceRisk: 'UNKNOWN', futureConcurrencyRisk: 'LOW', safetyProofs: {} }),
    'BLOCK_PENDING_MORE_EVIDENCE',
  );
  assert.equal(
    decideD7A3OwnerDecision({ interferenceRisk: 'HIGH', futureConcurrencyRisk: 'LOW', safetyProofs: {} }),
    'OWNER_DISABLE_TRIGGER_BEFORE_D7_B',
  );
});

test('D7-A3 coexistence requires all explicit safety proofs', () => {
  const partial = decideD7A3OwnerDecision({
    interferenceRisk: 'LOW',
    futureConcurrencyRisk: 'LOW',
    safetyProofs: { rollbackDefined: true },
  });
  assert.equal(partial, 'BLOCK_PENDING_MORE_EVIDENCE');

  const full = decideD7A3OwnerDecision({
    interferenceRisk: 'LOW',
    futureConcurrencyRisk: 'LOW',
    safetyProofs: {
      d7BDoesNotDependOnMutableLabels: true,
      triggerCannotAlterApprovedCandidateIdentity: true,
      noConflictingLocks: true,
      noDuplicateAttachmentProcessing: true,
      gmailMutationDoesNotAlterD7Idempotency: true,
      concurrentExecutionBounded: true,
      triggerScheduleUnderstood: true,
      rollbackDefined: true,
    },
  });
  assert.equal(full, 'PRESERVE_AND_ALLOW_COEXISTENCE_WITH_EXPLICIT_GUARDS');
});

test('D7-A3 analyzer executes no Apps Script, Gmail, Drive, Sheet, Firestore, trigger, or candidate mutation', () => {
  const report = analyze();
  assert.equal(report.TRIGGER_EXECUTED, 'NO');
  assert.equal(report.TRIGGER_MUTATION_COUNT, 0);
  assert.equal(report.D7_A_ENTRYPOINT_EXECUTED, 'NO');
  assert.equal(report.CANDIDATE_DISCOVERY_EXECUTED, 'NO');
  assert.equal(report.PRODUCTION_MUTATION, 'NONE');
  assert.equal(report.PRODUCTION_MUTATION_REACHABILITY_COUNT, 0);

  const analyzerSource = fs.readFileSync('scripts/analysis/d7-a3-existing-gmail-trigger-compatibility.mjs', 'utf8');
  assert.doesNotMatch(analyzerSource, /ScriptApp\.(?:newTrigger|deleteTrigger|run)/);
  assert.doesNotMatch(analyzerSource, /GmailApp\.[A-Za-z_]+\s*\(/);
  assert.doesNotMatch(analyzerSource, /DriveApp\.[A-Za-z_]+\s*\(/);
  assert.doesNotMatch(analyzerSource, /SpreadsheetApp\.[A-Za-z_]+\s*\(/);
  assert.doesNotMatch(analyzerSource, /UrlFetchApp\.fetch\s*\(/);
  assert.doesNotMatch(analyzerSource, /runD7AOperationalAutomationReadinessReadOnly\s*\(/);
});

test('D7-A compact log summary is emitted before detailed data', () => {
  const { createD7AOperationalAutomationReadinessAuditRunner_, createD7ACompactSummary_ } = loadD7A();
  assert.equal(typeof createD7ACompactSummary_, 'function');
  const logs = [];
  const runner = createD7AOperationalAutomationReadinessAuditRunner_({
    readProperties: () => completeProperties(),
    sourceInspector: () => sourceContracts(),
    gmailReadProbe: () => ({ ok: true }),
    driveReadProbe: () => ({ ok: true, found: true, readAccessVerified: true }),
    sheetReadProbe: () => ({ ok: true, spreadsheetFound: true, targetSheetFound: true, headerSchemaStatus: 'PASS' }),
    firestoreReadProbe: () => ({ ok: true }),
    listTriggers: () => [{ handlerFunction: 'triggerMarkAllInvoiceEmails', triggerType: 'CLOCK' }],
    logger: { log: line => logs.push(String(line)) },
  });
  const result = runner.run();
  const first = JSON.parse(logs[0]);
  const second = JSON.parse(logs[1]);
  assert.ok(first.D7_A_COMPACT_READINESS_SUMMARY);
  assert.equal(first.D7_A_COMPACT_READINESS_SUMMARY.OPERATIONAL_READINESS_STATUS, 'BLOCKED_EXISTING_OR_UNKNOWN_TRIGGER');
  assert.equal(first.D7_A_COMPACT_READINESS_SUMMARY.READY_FOR_D7_B, 'NO');
  assert.equal(first.D7_A_COMPACT_READINESS_SUMMARY.READINESS_GAP_COUNT, 1);
  assert.deepEqual(first.D7_A_COMPACT_READINESS_SUMMARY.READINESS_GAPS, ['EXISTING_NON_D7_TRIGGER_REQUIRES_OWNER_REVIEW']);
  assert.equal(first.D7_A_COMPACT_READINESS_SUMMARY.EXISTING_NON_D7_TRIGGER_COUNT, 1);
  assert.equal(first.D7_A_COMPACT_READINESS_SUMMARY.EXISTING_MUTATING_TRIGGER_COUNT, 1);
  assert.equal(first.D7_A_COMPACT_READINESS_SUMMARY.TRIGGER_OWNER_REVIEW_REQUIRED, 'YES');
  assert.equal(first.D7_A_COMPACT_READINESS_SUMMARY.PRODUCTION_MUTATION, 'NONE');
  assert.equal(second.OPERATIONAL_READINESS_STATUS, result.OPERATIONAL_READINESS_STATUS);
});
