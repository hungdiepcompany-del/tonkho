import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { evaluateD7E3IPhaseFileState_ } from '../../scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js',
    'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
    'docs/phases/D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN.md'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js'],
  exportNames: [
    'D7_E3I_PHASE_',
    'D7_E3I_PUBLIC_ENTRYPOINT_',
    'D7_E3I_SCHEMA_VERSION_',
    'createD7E3IExactProductionConflictForensicRunner_',
    'runD7E3IExactProductionConflictForensicReadOnly',
    'sha256D7E3IBytes_'
  ]
});

const fromVm = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(Buffer.from(value)).digest('hex');
const XML_BYTES = '<invoice><line>synthetic</line></invoice>';
const PDF_BYTES = '%PDF-synthetic';
const EXPECTED_XML = hash(XML_BYTES);
const EXPECTED_PDF = hash(PDF_BYTES);
const EXPECTED_IDENTITY = hash('synthetic-identity');
const EXPECTED_ATTACHMENT_SET = hash(`${EXPECTED_XML}:${EXPECTED_PDF}`);
const D7_E3I_PHASE_FILES = [
  'D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js',
  'tests/unit/d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.test.mjs',
  'scripts/checkers/check-d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.mjs',
  'docs/phases/D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN.md'
];
const D7_E3I_RUNTIME_FILE = D7_E3I_PHASE_FILES[0];
const D7_E3I_TEST_FILE = D7_E3I_PHASE_FILES[1];
const D7_E3I_CHECKER_FILE = D7_E3I_PHASE_FILES[2];
const D7_E3I_DOCS_FILE = D7_E3I_PHASE_FILES[3];

function evaluatePhaseState(overrides = {}) {
  return evaluateD7E3IPhaseFileState_({
    statusLines: [],
    trackedFiles: D7_E3I_PHASE_FILES,
    existingFiles: D7_E3I_PHASE_FILES,
    requiredFiles: D7_E3I_PHASE_FILES,
    allowedDirtyFiles: D7_E3I_PHASE_FILES,
    ...overrides
  });
}

function baseFixture() {
  return {
    configuration: {
      status: 'CONFIGURATION_READ_OK',
      confidence: 'SUPPORTED',
      canonicalKeysPresentCount: 4,
      canonicalEmptyKeyCount: 0,
      aliasConflictCount: 0,
      expectedXmlSha256: EXPECTED_XML,
      expectedPdfSha256: EXPECTED_PDF,
      expectedIdentityHash: EXPECTED_IDENTITY,
      expectedAttachmentSetHash: EXPECTED_ATTACHMENT_SET
    },
    beforeSnapshot: { status: 'SNAPSHOT_CAPTURED', fingerprint: 'stable-snapshot' },
    afterSnapshot: { status: 'SNAPSHOT_CAPTURED', fingerprint: 'stable-snapshot' },
    gmail: {
      status: 'READ_OK',
      candidateCount: 1,
      messageCount: 1,
      messageIdentityStatus: 'MATCH',
      xmlAttachmentCount: 1,
      pdfAttachmentCount: 1,
      xmlMimeType: 'application/xml',
      pdfMimeType: 'application/pdf',
      xmlBytes: XML_BYTES,
      pdfBytes: PDF_BYTES,
      xmlAttachmentNameMatch: 'YES',
      pdfAttachmentNameMatch: 'YES',
      readCallCount: 1
    },
    driveXml: {
      status: 'READ_OK',
      candidateCount: 1,
      discoveryStatus: 'EXACT_CANDIDATE_FOUND',
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_OK',
      metadataSizeExplicitlyObserved: true,
      contentBytesExplicitlyObserved: true,
      metadataSize: XML_BYTES.length,
      bytes: XML_BYTES,
      readerFallbackPossible: false,
      mimeType: 'application/xml',
      readCallCount: 1
    },
    drivePdf: {
      status: 'READ_OK',
      candidateCount: 1,
      discoveryStatus: 'EXACT_CANDIDATE_FOUND',
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_OK',
      metadataSizeExplicitlyObserved: true,
      contentBytesExplicitlyObserved: true,
      metadataSize: PDF_BYTES.length,
      bytes: PDF_BYTES,
      readerFallbackPossible: false,
      mimeType: 'application/pdf',
      readCallCount: 1
    },
    sheets: {
      status: 'READ_OK',
      schemaValidationStatus: 'PASS',
      canonicalRowCount: 1,
      exactIdentityMatchCount: 1,
      conflictingIdentityCount: 0,
      businessIdentityStatus: 'MATCH',
      invoiceKeyStatus: 'MATCH',
      hashIndexStatus: 'MATCH',
      sourceHashLinkStatus: 'MATCH',
      callerAttributionObservation: 'ATTRIBUTION_PROVEN_D7_E',
      jobIdentityExact: true,
      commitPlanSheetIdentityExact: true,
      rowIdentityExact: true,
      auditLinksExactRowIdentity: true,
      attachmentRecordLinksExactRowIdentity: false,
      externalEvidenceLinksExactRowIdentity: false,
      conflictingAttributionEvidencePresent: false,
      contentStatus: 'MATCH',
      safeRowNumbers: [42],
      readCallCount: 1
    },
    firestore: {
      status: 'READ_OK',
      jobExists: true,
      jobIdentityStatus: 'MATCH',
      jobState: 'COMPLETED',
      jobVersionStatus: 'MATCH',
      jobUpdateTimeStatus: 'PRESENT',
      commitPlanStatus: 'MATCH',
      commitPlanIdentityStatus: 'MATCH',
      expectedDriveIdentitiesStatus: 'MATCH',
      expectedSheetTransactionIdentityStatus: 'MATCH',
      attachmentRecordCount: 2,
      auditEventCount: 2,
      leaseStatus: 'NO_ACTIVE_LEASE_FOUND',
      reconciliationReportStatus: 'CONSISTENT',
      idempotencyEvidenceStatus: 'MATCH',
      readCallCount: 1
    }
  };
}

function deepMerge(base, patch) {
  const output = Array.isArray(base) ? [...base] : { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      output[key] = deepMerge(base[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function runScenario(overrides = {}) {
  const fixture = deepMerge(baseFixture(), overrides);
  const original = JSON.stringify(fixture);
  const logs = [];
  const runner = gas.call('createD7E3IExactProductionConflictForensicRunner_', {
    readConfiguration: () => fixture.configuration,
    readSnapshot: ({ stage }) => (stage === 'BEFORE' ? fixture.beforeSnapshot : fixture.afterSnapshot),
    readGmailEvidence: () => fixture.gmail,
    readDriveEvidence: ({ artifactType }) => (artifactType === 'XML' ? fixture.driveXml : fixture.drivePdf),
    readSheetsEvidence: () => fixture.sheets,
    readFirestoreEvidence: () => fixture.firestore,
    now: () => '2026-08-01T00:00:00.000Z',
    logger: { log: line => logs.push(line) }
  });
  const result = fromVm(runner.run());
  assert.equal(JSON.stringify(fixture), original, 'INPUT_FIXTURE_MUTATED');
  return { result, logs, fixture };
}

function findingCodes(result) {
  return result.FINDINGS.map(finding => finding.code);
}

function assertFinding(result, code) {
  assert.ok(findingCodes(result).includes(code), `missing ${code}`);
}

function assertNoFinding(result, code) {
  assert.equal(findingCodes(result).includes(code), false, `unexpected ${code}`);
}

function permissionDiagnostic(result, key) {
  assert.ok(result.PERMISSION_DIAGNOSTICS, 'PERMISSION_DIAGNOSTICS_MISSING');
  assert.ok(result.PERMISSION_DIAGNOSTICS[key], `${key}_MISSING`);
  return result.PERMISSION_DIAGNOSTICS[key];
}

function assertPermissionReason(result, key, expectedReason, expectedStatus = 'READ_BLOCKED') {
  const permission = permissionDiagnostic(result, key);
  assert.equal(permission.reasonCode, expectedReason);
  assert.equal(permission.status, expectedStatus);
  return permission;
}

function parseSummaryLog(logs) {
  assert.ok(logs.length > 0, 'SUMMARY_LOG_MISSING');
  return JSON.parse(logs[logs.length - 1]);
}

test('1. metadata and public entrypoint contract are canonical', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D7_E3I_PHASE_, 'D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN');
  assert.equal(gas.exports.D7_E3I_PUBLIC_ENTRYPOINT_, 'runD7E3IExactProductionConflictForensicReadOnly');
  assert.equal(gas.exports.D7_E3I_SCHEMA_VERSION_, 'D7_E3I_FORENSIC_RESULT_V1');
  assert.equal(typeof gas.exports.runD7E3IExactProductionConflictForensicReadOnly, 'function');
  assert.equal(typeof gas.exports.createD7E3IExactProductionConflictForensicRunner_, 'function');
  const source = fs.readFileSync('D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js', 'utf8');
  assert.match(source, /function runD7E3IExactProductionConflictForensicReadOnly\(\)/);
  assert.doesNotMatch(source, /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/);
  assert.doesNotMatch(source, /runD6jCOneRecordProductionMutation\s*\(/);
});

test('2. exact fully consistent state returns CONSISTENT_ALREADY_COMPLETED and NO_ACTION_REQUIRED', () => {
  const { result } = runScenario();
  assert.equal(result.PRIMARY_CLASSIFICATION, 'CONSISTENT_ALREADY_COMPLETED');
  assert.equal(result.RECONCILIATION_PLAN.planType, 'NO_ACTION_REQUIRED');
  assert.equal(result.FINAL_STATUS, 'PASS_D7_E3I_CONSISTENT_ALREADY_COMPLETED_READ_ONLY');
});

test('3. Gmail candidate absent is a source conflict and blocks exact completion', () => {
  const { result } = runScenario({ gmail: { candidateCount: 0, messageCount: 0 } });
  assert.equal(result.GMAIL_EVIDENCE.status, 'GMAIL_CANDIDATE_ABSENT');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
  assertFinding(result, 'GMAIL_SOURCE_CONFLICT');
});

test('4. Gmail multiple candidates fail closed instead of picking one result', () => {
  const { result } = runScenario({ gmail: { candidateCount: 2, messageCount: 2 } });
  assert.equal(result.GMAIL_EVIDENCE.status, 'GMAIL_CANDIDATE_AMBIGUOUS');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
  assertFinding(result, 'FORENSIC_EVIDENCE_INCOMPLETE');
});

test('5. source XML hash mismatch is reported as a Gmail source conflict', () => {
  const { result } = runScenario({ gmail: { xmlBytes: '<invoice>changed</invoice>' } });
  assert.equal(result.GMAIL_EVIDENCE.status, 'GMAIL_XML_HASH_CONFLICT');
  assertFinding(result, 'GMAIL_SOURCE_CONFLICT');
});

test('6. source PDF hash mismatch is reported as a Gmail source conflict', () => {
  const { result } = runScenario({ gmail: { pdfBytes: '%PDF-changed' } });
  assert.equal(result.GMAIL_EVIDENCE.status, 'GMAIL_PDF_HASH_CONFLICT');
  assertFinding(result, 'GMAIL_SOURCE_CONFLICT');
});

test('7. Drive actual zero-byte XML requires successful zero metadata and blob evidence', () => {
  const { result } = runScenario({
    driveXml: {
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_OK',
      metadataSizeExplicitlyObserved: true,
      contentBytesExplicitlyObserved: true,
      metadataSize: 0,
      bytes: '',
      blobByteLength: 0,
      readerFallbackPossible: false
    }
  });
  assert.equal(result.DRIVE_XML_EVIDENCE.status, 'ACTUAL_ZERO_BYTE_FILE');
  assert.equal(result.DRIVE_XML_EVIDENCE.safeDetails.metadataReadExplicitlySucceeded, 'YES');
  assert.equal(result.DRIVE_XML_EVIDENCE.safeDetails.contentReadExplicitlySucceeded, 'YES');
  assert.equal(result.DRIVE_XML_EVIDENCE.safeDetails.readerFallbackPossible, 'NO');
  assertFinding(result, 'DRIVE_XML_ACTUAL_ZERO_BYTE');
});

test('8. Drive actual zero-byte PDF uses the same successful-read proof contract', () => {
  const { result } = runScenario({
    drivePdf: {
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_OK',
      metadataSizeExplicitlyObserved: true,
      contentBytesExplicitlyObserved: true,
      metadataSize: 0,
      bytes: '',
      blobByteLength: 0,
      readerFallbackPossible: false
    }
  });
  assert.equal(result.DRIVE_PDF_EVIDENCE.status, 'ACTUAL_ZERO_BYTE_FILE');
  assert.equal(result.DRIVE_PDF_EVIDENCE.safeDetails.metadataReadExplicitlySucceeded, 'YES');
  assert.equal(result.DRIVE_PDF_EVIDENCE.safeDetails.contentReadExplicitlySucceeded, 'YES');
  assertFinding(result, 'DRIVE_PDF_ACTUAL_ZERO_BYTE');
});

test('9. Drive nonzero metadata with empty reader output is fallback suspected', () => {
  const { result } = runScenario({ driveXml: { metadataSize: 9, bytes: '', blobByteLength: 0 } });
  assert.equal(result.DRIVE_XML_EVIDENCE.status, 'READER_EMPTY_FALLBACK_SUSPECTED');
  assert.equal(result.DRIVE_XML_EVIDENCE.safeDetails.contentSha256ComputationStatus, 'NOT_COMPUTED');
  assert.equal(result.RECONCILIATION_PLAN.planType, 'READBACK_READER_FIX_REQUIRED');
  assertFinding(result, 'DRIVE_XML_READER_EMPTY_FALLBACK_SUSPECTED');
});

test('10. Drive content read throws or blocks and remains FORENSICS_INCOMPLETE', () => {
  const { result } = runScenario({ driveXml: { contentReadStatus: 'PERMISSION_DENIED', bytes: undefined, blobByteLength: -1 } });
  assert.equal(result.DRIVE_XML_EVIDENCE.status, 'CONTENT_READ_BLOCKED');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
  assertFinding(result, 'FORENSIC_READ_PERMISSION_BLOCKER');
});

test('11. Drive metadata read throws or blocks and remains FORENSICS_INCOMPLETE', () => {
  const { result } = runScenario({ drivePdf: { metadataReadStatus: 'TRANSPORT_FAILED', contentReadStatus: 'UNAVAILABLE', bytes: undefined } });
  assert.equal(result.DRIVE_PDF_EVIDENCE.status, 'METADATA_READ_BLOCKED');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
});

test('12. Drive successful non-empty content hash mismatch is DRIVE_CONTENT_CONFLICT', () => {
  const changed = '<invoice>drive-different</invoice>';
  const { result } = runScenario({ driveXml: { metadataSize: changed.length, bytes: changed } });
  assert.equal(result.DRIVE_XML_EVIDENCE.status, 'CONTENT_HASH_MISMATCH');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'DRIVE_CONTENT_CONFLICT');
  assertFinding(result, 'DRIVE_XML_CONTENT_HASH_MISMATCH');
});

test('13. Drive duplicate ambiguity blocks without first-result selection', () => {
  const { result } = runScenario({ drivePdf: { candidateCount: 2 } });
  assert.equal(result.DRIVE_PDF_EVIDENCE.status, 'DRIVE_DUPLICATE_AMBIGUITY');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
  assertFinding(result, 'DRIVE_DUPLICATE_AMBIGUITY');
});

test('14. Drive metadata/content size mismatch is a proven content conflict', () => {
  const { result } = runScenario({ driveXml: { metadataSize: XML_BYTES.length + 1, bytes: XML_BYTES } });
  assert.equal(result.DRIVE_XML_EVIDENCE.status, 'METADATA_CONTENT_SIZE_MISMATCH');
  assertFinding(result, 'DRIVE_METADATA_CONTENT_SIZE_MISMATCH');
});

test('15. exact canonical Sheet row can have attribution proven to D7-E', () => {
  const { result } = runScenario();
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.attributionStatus, 'ATTRIBUTION_PROVEN_D7_E');
  assertFinding(result, 'SHEET_ATTRIBUTION_PROVEN_D7_E');
});

test('16. exact canonical Sheet row with attribution unproven stays partial unknown and does not recommend repair', () => {
  const { result } = runScenario({
    sheets: {
      attributionStatus: 'ATTRIBUTION_UNPROVEN',
      jobIdentityExact: false,
      commitPlanSheetIdentityExact: false,
      rowIdentityExact: true,
      auditLinksExactRowIdentity: false,
      attachmentRecordLinksExactRowIdentity: false
    }
  });
  assert.equal(result.PRIMARY_CLASSIFICATION, 'PARTIAL_UNKNOWN_OUTCOME');
  assertFinding(result, 'SHEET_ATTRIBUTION_UNPROVEN');
  assert.notEqual(result.RECONCILIATION_PLAN.planType, 'BOUNDED_SHEET_REPAIR_REVIEW_REQUIRED');
});

test('17. exact canonical Sheet row proven external is classified separately', () => {
  const { result } = runScenario({
    sheets: {
      jobIdentityExact: false,
      commitPlanSheetIdentityExact: false,
      auditLinksExactRowIdentity: false,
      attachmentRecordLinksExactRowIdentity: false,
      rowIdentityExact: true,
      externalEvidenceLinksExactRowIdentity: true,
      externalActorEvidenceStatus: 'PROVEN'
    }
  });
  assert.equal(result.PRIMARY_CLASSIFICATION, 'EXTERNAL_USER_CREATED_STATE');
  assertFinding(result, 'SHEET_ATTRIBUTION_PROVEN_EXTERNAL');
});

test('18. Sheet row absent is reported without creating a repair action', () => {
  const { result } = runScenario({ sheets: { canonicalRowCount: 0, exactIdentityMatchCount: 0, attributionStatus: 'ATTRIBUTION_UNPROVEN' } });
  assert.equal(result.SHEETS_EVIDENCE.status, 'SHEET_ROW_ABSENT');
  assertFinding(result, 'SHEET_CANONICAL_ROW_ABSENT');
  assert.equal(result.SAFETY_COUNTS.SHEETS_MUTATION_COUNT, 0);
});

test('19. multiple canonical rows are ambiguous and fail closed', () => {
  const { result } = runScenario({ sheets: { canonicalRowCount: 2, exactIdentityMatchCount: 2 } });
  assert.equal(result.SHEETS_EVIDENCE.status, 'SHEET_ROW_AMBIGUOUS');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
  assertFinding(result, 'SHEET_CANONICAL_ROW_AMBIGUOUS');
});

test('20. canonical key conflict is a Sheet identity conflict', () => {
  const { result } = runScenario({ sheets: { conflictingIdentityCount: 1, invoiceKeyStatus: 'CONFLICT' } });
  assert.equal(result.SHEETS_EVIDENCE.status, 'SHEET_IDENTITY_CONFLICT');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'SHEET_IDENTITY_CONFLICT');
});

test('21. row-content conflict is separated from attribution status', () => {
  const { result } = runScenario({ sheets: { contentStatus: 'CONFLICT' } });
  assert.equal(result.SHEETS_EVIDENCE.status, 'SHEET_CONTENT_CONFLICT');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'SHEET_IDENTITY_CONFLICT');
});

test('22. Firestore job absent leaves the exact outcome unknown', () => {
  const { result } = runScenario({ firestore: { jobExists: false, jobState: 'ABSENT', commitPlanStatus: 'ABSENT', reconciliationReportStatus: 'ABSENT' } });
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_JOB_ABSENT');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'PARTIAL_UNKNOWN_OUTCOME');
});

test('23. Firestore job VALIDATED while external state is complete is a state conflict', () => {
  const { result } = runScenario({ firestore: { jobState: 'VALIDATED' } });
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_JOB_STATE_CONFLICT');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FIRESTORE_STATE_CONFLICT');
  assertFinding(result, 'FIRESTORE_JOB_VALIDATED_NOT_COMPLETED');
});

test('24. Firestore job COMPLETED with exact plan and evidence is consistent', () => {
  const { result } = runScenario();
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_STATE_CONSISTENT');
  assertFinding(result, 'FIRESTORE_JOB_COMPLETED');
});

test('25. Firestore deterministic identity conflict is reported', () => {
  const { result } = runScenario({ firestore: { jobIdentityStatus: 'CONFLICT' } });
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_JOB_IDENTITY_CONFLICT');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FIRESTORE_STATE_CONFLICT');
});

test('26. Firestore commit plan conflict is reported', () => {
  const { result } = runScenario({ firestore: { commitPlanStatus: 'CONFLICT' } });
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_COMMIT_PLAN_CONFLICT');
  assertFinding(result, 'FIRESTORE_COMMIT_PLAN_CONFLICT');
});

test('27. Firestore reconciliation report conflict is reported', () => {
  const { result } = runScenario({ firestore: { reconciliationReportStatus: 'CONFLICT' } });
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_RECONCILIATION_CONFLICT');
  assertFinding(result, 'FIRESTORE_RECONCILIATION_CONFLICT');
});

test('28. Firestore audit attribution missing requests post-hoc review only', () => {
  const { result } = runScenario({ firestore: { auditAttributionStatus: 'MISSING' } });
  assertFinding(result, 'FIRESTORE_AUDIT_ATTRIBUTION_MISSING');
  assert.equal(result.RECONCILIATION_PLAN.planType, 'POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED');
  assert.equal(result.RECONCILIATION_PLAN.automaticExecutionAllowed, 'NO');
});

test('29. Firestore read permission blocker is fail-closed', () => {
  const { result } = runScenario({ firestore: { status: 'PERMISSION_DENIED', readBlocked: true } });
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_READ_BLOCKED');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
  assertFinding(result, 'FORENSIC_READ_PERMISSION_BLOCKER');
});

test('30. unknown write-outcome evidence from D7-E3H fields produces PARTIAL_UNKNOWN_OUTCOME', () => {
  const { result } = runScenario({ firestore: { writeOutcomeEvidenceStatus: 'UNKNOWN_WRITE_OUTCOME_PRESENT' } });
  assert.equal(result.PRIMARY_CLASSIFICATION, 'PARTIAL_UNKNOWN_OUTCOME');
  assertFinding(result, 'UNKNOWN_WRITE_OUTCOME_EVIDENCE_PRESENT');
});

test('31. confirmed D7-E mutation evidence with incomplete transaction produces PARTIAL_CONFIRMED_MUTATION', () => {
  const { result } = runScenario({
    sheets: { canonicalRowCount: 0, exactIdentityMatchCount: 0, attributionStatus: 'ATTRIBUTION_PROVEN_D7_E' },
    firestore: { confirmedMutationEvidence: true }
  });
  assert.equal(result.PRIMARY_CLASSIFICATION, 'PARTIAL_CONFIRMED_MUTATION');
  assertFinding(result, 'CONFIRMED_D7_E_MUTATION_EVIDENCE_PRESENT');
});

test('32. two independent system conflicts produce MULTI_SYSTEM_CONFLICT', () => {
  const { result } = runScenario({
    driveXml: { metadataSize: XML_BYTES.length + 2, bytes: XML_BYTES },
    sheets: { conflictingIdentityCount: 1 }
  });
  assert.equal(result.PRIMARY_CLASSIFICATION, 'MULTI_SYSTEM_CONFLICT');
});

test('33. before/after snapshot mismatch requires a fresh read-only rerun', () => {
  const { result } = runScenario({ afterSnapshot: { status: 'SNAPSHOT_CAPTURED', fingerprint: 'changed-snapshot' } });
  assert.equal(result.CONCURRENT_CHANGE_STATUS.status, 'CONCURRENT_CHANGE_DETECTED');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
  assert.equal(result.RECONCILIATION_PLAN.planType, 'FRESH_READ_ONLY_RERUN_REQUIRED');
  assertFinding(result, 'CONCURRENT_STATE_CHANGE');
});

test('34. bounded event query overflow blocks forensics', () => {
  const { result } = runScenario({ firestore: { boundedOverflow: true, auditEventCount: 99 } });
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_FORENSICS_INCOMPLETE');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
});

test('35. safe output contains no raw identifiers or token-shaped values', () => {
  const atSign = String.fromCharCode(64);
  const tokenish = ['ya', '29', '.', 'synthetic', '_secret'].join('');
  const urlish = ['https://', 'example.invalid', '?private=1'].join('');
  const { result, logs } = runScenario({
    gmail: {
      rawEmail: ['reader', atSign, 'example.invalid'].join(''),
      rawToken: tokenish,
      rawUrl: urlish,
      rawSubject: 'synthetic subject with private words'
    },
    sheets: { rawValues: [['private row text']] }
  });
  const serialized = JSON.stringify({ result, logs });
  assert.doesNotMatch(serialized, /reader@example\.invalid/);
  assert.doesNotMatch(serialized, /synthetic_secret/);
  assert.doesNotMatch(serialized, /private=1/);
  assert.doesNotMatch(serialized, /private row text/);
});

test('36. every mutation counter remains zero', () => {
  const { result } = runScenario();
  for (const key of [
    'GMAIL_MUTATION_COUNT',
    'DRIVE_MUTATION_COUNT',
    'SHEETS_MUTATION_COUNT',
    'FIRESTORE_MUTATION_COUNT',
    'TRIGGER_MUTATION_COUNT',
    'DESTRUCTIVE_OPERATION_COUNT',
    'REPAIR_OPERATION_COUNT',
    'RECONCILIATION_WRITE_COUNT',
    'PRODUCTION_MUTATION_COUNT'
  ]) {
    assert.equal(result.SAFETY_COUNTS[key], 0, key);
  }
});

test('37. read-call counts remain within maxima', () => {
  const { result } = runScenario();
  assert.equal(result.SAFETY_COUNTS.READ_ONLY_GMAIL_CALL_COUNT, 1);
  assert.equal(result.SAFETY_COUNTS.READ_ONLY_DRIVE_CALL_COUNT, 2);
  assert.equal(result.SAFETY_COUNTS.READ_ONLY_SHEETS_CALL_COUNT, 1);
  assert.equal(result.SAFETY_COUNTS.READ_ONLY_FIRESTORE_CALL_COUNT, 1);
  assert.equal(result.SAFETY_COUNTS.READ_CALLS_WITHIN_MAXIMA, 'YES');
});

test('38. same synthetic input twice produces deterministic equivalent result', () => {
  const first = runScenario().result;
  const second = runScenario().result;
  assert.deepEqual(second, first);
});

test('39. input fixtures remain immutable', () => {
  const fixture = baseFixture();
  const original = JSON.stringify(fixture);
  runScenario(fixture);
  assert.equal(JSON.stringify(fixture), original);
});

test('40. source shape contains no mutation primitives, deploy commands or forbidden production calls', () => {
  const source = fs.readFileSync('D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js', 'utf8');
  const testSource = fs.readFileSync('tests/unit/d7-e3i-exact-production-conflict-forensic-and-safe-reconciliation-plan.test.mjs', 'utf8');
  for (const pattern of [
    /\.setProperty\s*\(/,
    /\.deleteProperty\s*\(/,
    /ScriptApp\.newTrigger/,
    /GmailApp\./,
    /DriveApp\./,
    /SpreadsheetApp/,
    /\.createFile\s*\(/,
    /\.appendRow\s*\(/,
    /\.setValue\s*\(/,
    /method:\s*['"`](post|put|patch|delete)['"`]/i,
    /runTransaction\s*\(/,
    /createDocument\s*\(/,
    /updateDocument\s*\(/,
    /deleteDocument\s*\(/,
    /clasp\s+push/i,
    /firebase\s+deploy/i,
    /git\s+commit/i
  ]) {
    assert.doesNotMatch(source, pattern, pattern.toString());
  }
  assert.doesNotMatch(testSource, /gas\.call\(['"]runD7E3IExactProductionConflictForensicReadOnly['"]/);
});

test('41. zero metadata and empty bytes with absent statuses cannot prove actual zero-byte Drive file', () => {
  const { result } = runScenario({
    driveXml: {
      metadataReadStatus: undefined,
      contentReadStatus: undefined,
      metadataSizeExplicitlyObserved: false,
      contentBytesExplicitlyObserved: false,
      metadataSize: 0,
      bytes: '',
      blobByteLength: 0
    }
  });
  assert.notEqual(result.DRIVE_XML_EVIDENCE.status, 'ACTUAL_ZERO_BYTE_FILE');
  assert.match(result.DRIVE_XML_EVIDENCE.status, /ZERO_BYTE_UNPROVEN|DRIVE_FORENSICS_INCOMPLETE/);
  assert.notEqual(result.DRIVE_XML_EVIDENCE.confidence, 'PROVEN');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
});

test('42. explicit metadata READ_OK without content success cannot prove actual zero-byte Drive file', () => {
  const { result } = runScenario({
    driveXml: {
      metadataReadStatus: 'READ_OK',
      contentReadStatus: undefined,
      metadataSizeExplicitlyObserved: true,
      contentBytesExplicitlyObserved: false,
      metadataSize: 0,
      bytes: '',
      blobByteLength: 0
    }
  });
  assert.notEqual(result.DRIVE_XML_EVIDENCE.status, 'ACTUAL_ZERO_BYTE_FILE');
  assert.equal(result.DRIVE_XML_EVIDENCE.safeDetails.contentReadExplicitlySucceeded, 'NO');
});

test('43. explicit content READ_OK without metadata success cannot prove actual zero-byte Drive file', () => {
  const { result } = runScenario({
    drivePdf: {
      metadataReadStatus: undefined,
      contentReadStatus: 'READ_OK',
      metadataSizeExplicitlyObserved: false,
      contentBytesExplicitlyObserved: true,
      metadataSize: 0,
      bytes: '',
      blobByteLength: 0
    }
  });
  assert.notEqual(result.DRIVE_PDF_EVIDENCE.status, 'ACTUAL_ZERO_BYTE_FILE');
  assert.equal(result.DRIVE_PDF_EVIDENCE.safeDetails.metadataReadExplicitlySucceeded, 'NO');
});

test('44. content READ_BLOCKED with fallback empty bytes does not hash fallback data', () => {
  const { result } = runScenario({
    driveXml: {
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_BLOCKED',
      metadataSizeExplicitlyObserved: true,
      contentBytesExplicitlyObserved: true,
      metadataSize: 0,
      bytes: '',
      blobByteLength: 0
    }
  });
  assert.equal(result.DRIVE_XML_EVIDENCE.status, 'CONTENT_READ_BLOCKED');
  assert.equal(result.DRIVE_XML_EVIDENCE.safeDetails.contentSha256ComputationStatus, 'NOT_COMPUTED');
  assert.equal(result.DRIVE_XML_EVIDENCE.safeDetails.failedReadNotHashedAsEmpty, 'YES');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
});

test('45. positive metadata with explicit successful empty content read is reader fallback suspected', () => {
  const { result } = runScenario({
    drivePdf: {
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_OK',
      metadataSizeExplicitlyObserved: true,
      contentBytesExplicitlyObserved: true,
      metadataSize: 12,
      bytes: '',
      blobByteLength: 0
    }
  });
  assert.equal(result.DRIVE_PDF_EVIDENCE.status, 'READER_EMPTY_FALLBACK_SUSPECTED');
  assert.equal(result.DRIVE_PDF_EVIDENCE.safeDetails.contentSha256ComputationStatus, 'NOT_COMPUTED');
  assert.equal(result.RECONCILIATION_PLAN.planType, 'READBACK_READER_FIX_REQUIRED');
});

test('46. label-only D7-E attribution is downgraded to unproven without durable links', () => {
  const { result } = runScenario({
    sheets: {
      attributionStatus: 'ATTRIBUTION_PROVEN_D7_E',
      jobIdentityExact: false,
      commitPlanSheetIdentityExact: false,
      rowIdentityExact: true,
      auditLinksExactRowIdentity: false,
      attachmentRecordLinksExactRowIdentity: false
    }
  });
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.attributionStatus, 'ATTRIBUTION_UNPROVEN');
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.labelOnlyAttributionProhibited, 'YES');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'PARTIAL_UNKNOWN_OUTCOME');
});

test('47. completed Firestore job without exact row linkage cannot produce CONSISTENT_ALREADY_COMPLETED', () => {
  const { result } = runScenario({
    sheets: {
      jobIdentityExact: true,
      commitPlanSheetIdentityExact: true,
      rowIdentityExact: true,
      auditLinksExactRowIdentity: false,
      attachmentRecordLinksExactRowIdentity: false
    },
    firestore: { jobState: 'COMPLETED' }
  });
  assert.notEqual(result.PRIMARY_CLASSIFICATION, 'CONSISTENT_ALREADY_COMPLETED');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'PARTIAL_UNKNOWN_OUTCOME');
  assertFinding(result, 'SHEET_ATTRIBUTION_UNPROVEN');
});

test('48. timestamp-only row evidence remains attribution unproven', () => {
  const { result } = runScenario({
    sheets: {
      rowMutationTimestampEvidence: true,
      jobIdentityExact: false,
      commitPlanSheetIdentityExact: false,
      rowIdentityExact: true,
      auditLinksExactRowIdentity: false,
      attachmentRecordLinksExactRowIdentity: false
    }
  });
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.attributionStatus, 'ATTRIBUTION_UNPROVEN');
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.timestampOnlyAttributionProhibited, 'YES');
});

test('49. InvoiceKey and HashIndex match without audit linkage remains attribution unproven', () => {
  const { result } = runScenario({
    sheets: {
      invoiceKeyStatus: 'MATCH',
      hashIndexStatus: 'MATCH',
      jobIdentityExact: false,
      commitPlanSheetIdentityExact: false,
      rowIdentityExact: true,
      auditLinksExactRowIdentity: false,
      attachmentRecordLinksExactRowIdentity: false
    }
  });
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.attributionStatus, 'ATTRIBUTION_UNPROVEN');
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.attributionEvidence.invoiceKeyHashIndexAloneProhibited, 'YES');
});

test('50. explicit external durable linkage proves external Sheet attribution', () => {
  const { result } = runScenario({
    sheets: {
      jobIdentityExact: false,
      commitPlanSheetIdentityExact: false,
      auditLinksExactRowIdentity: false,
      attachmentRecordLinksExactRowIdentity: false,
      rowIdentityExact: true,
      externalEvidenceLinksExactRowIdentity: true,
      externalActorEvidencePresent: true
    }
  });
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.attributionStatus, 'ATTRIBUTION_PROVEN_EXTERNAL');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'EXTERNAL_USER_CREATED_STATE');
});

test('51. conflicting D7-E and external attribution evidence fails closed', () => {
  const { result } = runScenario({
    sheets: {
      rowIdentityExact: true,
      jobIdentityExact: true,
      commitPlanSheetIdentityExact: true,
      auditLinksExactRowIdentity: true,
      externalEvidenceLinksExactRowIdentity: true,
      externalActorEvidencePresent: true,
      conflictingAttributionEvidencePresent: true
    }
  });
  assert.equal(result.SHEETS_EVIDENCE.status, 'SHEET_FORENSICS_INCOMPLETE');
  assert.equal(result.SHEETS_EVIDENCE.safeDetails.attributionEvidence.conflictingAttributionEvidencePresent, 'YES');
  assert.equal(result.PRIMARY_CLASSIFICATION, 'FORENSICS_INCOMPLETE');
});

test('52. all required D7-E3I files tracked and clean passes committed-baseline mode', () => {
  const state = evaluatePhaseState();
  assert.equal(state.ok, true);
  assert.equal(state.mode, 'ALL_REQUIRED_FILES_TRACKED_AND_CLEAN');
});

test('53. runtime and docs clean while checker and test are approved dirty passes mixed corrective mode', () => {
  const state = evaluatePhaseState({
    statusLines: [
      ` M ${D7_E3I_CHECKER_FILE}`,
      ` M ${D7_E3I_TEST_FILE}`
    ]
  });
  assert.equal(state.ok, true);
  assert.equal(state.mode, 'MIXED_APPROVED_CORRECTIVE_STATE');
});

test('54. runtime source approved modified passes implementation-change mode', () => {
  const state = evaluatePhaseState({ statusLines: [` M ${D7_E3I_RUNTIME_FILE}`] });
  assert.equal(state.ok, true);
  assert.equal(state.mode, 'APPROVED_LOCAL_IMPLEMENTATION_CHANGES');
});

test('55. one required D7-E3I file missing fails', () => {
  const state = evaluatePhaseState({
    existingFiles: D7_E3I_PHASE_FILES.filter(file => file !== D7_E3I_DOCS_FILE)
  });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^MISSING_FILE_/);
});

test('56. runtime source absent from working copy and HEAD fails', () => {
  const state = evaluatePhaseState({
    trackedFiles: D7_E3I_PHASE_FILES.filter(file => file !== D7_E3I_RUNTIME_FILE),
    existingFiles: D7_E3I_PHASE_FILES.filter(file => file !== D7_E3I_RUNTIME_FILE)
  });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^MISSING_FILE_/);
});

test('57. one approved D7-E3I file staged fails', () => {
  const state = evaluatePhaseState({ statusLines: [`M  ${D7_E3I_TEST_FILE}`] });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^STAGED_FILE_/);
});

test('58. unexpected non-guard modified file fails', () => {
  const state = evaluatePhaseState({ statusLines: [' M unexpected-runtime.js'] });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^UNAPPROVED_DIRTY_FILE_/);
});

test('59. unexpected non-guard untracked file fails', () => {
  const state = evaluatePhaseState({ statusLines: ['?? unexpected-notes.txt'] });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^UNAPPROVED_DIRTY_FILE_/);
});

test('60. exact known guard paths dirty or untracked are ignored', () => {
  const state = evaluatePhaseState({
    statusLines: [
      ' M GUARD.bat',
      ' M _guard/PROJECT_GUARD.config.bat',
      ' M _guard/PROJECT_GUARD_ENGINE.bat',
      ' M _guard/README.md',
      '?? _guard/deploy/',
      '?? _guard/deploy/snapshot.txt'
    ]
  });
  assert.equal(state.ok, true);
  assert.equal(state.mode, 'ALL_REQUIRED_FILES_TRACKED_AND_CLEAN');
});

test('61. similarly named guard-like path outside exact allowlist fails', () => {
  const state = evaluatePhaseState({ statusLines: ['?? _guardrail/deploy/snapshot.txt'] });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^UNAPPROVED_DIRTY_FILE_/);
});

test('62. runtime source tracked clean is accepted without requiring runtime dirt', () => {
  const state = evaluatePhaseState({ statusLines: [` M ${D7_E3I_CHECKER_FILE}`] });
  assert.equal(state.ok, true);
  assert.equal(state.fileStates[D7_E3I_RUNTIME_FILE], 'TRACKED_CLEAN');
  assert.notEqual(state.approvedDirtyFiles.includes(D7_E3I_RUNTIME_FILE), true);
});

test('63. state evaluator PASS cannot bypass failed semantic source validation', () => {
  const repoRoot = process.cwd();
  const checkerPath = path.join(repoRoot, D7_E3I_CHECKER_FILE);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'd7-e3i-checker-'));
  try {
    for (const file of D7_E3I_PHASE_FILES) {
      fs.mkdirSync(path.dirname(path.join(tempRoot, file)), { recursive: true });
      fs.writeFileSync(path.join(tempRoot, file), 'synthetic placeholder\n', 'utf8');
    }
    fs.writeFileSync(path.join(tempRoot, D7_E3I_RUNTIME_FILE), 'function unsafePlaceholder_() {}\n', 'utf8');
    execFileSync('git', ['init'], { cwd: tempRoot, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.name', 'Checker Test'], { cwd: tempRoot, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', ['checker', 'invalid.local'].join('@')], { cwd: tempRoot, stdio: 'ignore' });
    execFileSync('git', ['add', ...D7_E3I_PHASE_FILES], { cwd: tempRoot, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'synthetic baseline'], { cwd: tempRoot, stdio: 'ignore' });
    const result = spawnSync(process.execPath, [checkerPath], { cwd: tempRoot, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /FAILED_GATE=PHASE_MARKER_MISSING/);
  } finally {
    const resolvedTemp = path.resolve(tempRoot);
    assert.ok(resolvedTemp.startsWith(path.resolve(os.tmpdir())));
    fs.rmSync(resolvedTemp, { recursive: true, force: true });
  }
});

test('64. Gmail OAuth scope missing is classified separately from generic permission blocker', () => {
  const { result } = runScenario({
    gmail: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'OAUTH_SCOPE_MISSING' }
  });
  const permission = assertPermissionReason(result, 'GMAIL_PERMISSION_STATUS', 'OAUTH_SCOPE_MISSING');
  assert.equal(permission.safeErrorClass, 'OAUTH');
  assert.equal(permission.authorizationType, 'OAUTH_AND_MAILBOX_ACCESS');
  assert.equal(result.GMAIL_EVIDENCE.safeDetails.permissionReasonCode, 'OAUTH_SCOPE_MISSING');
  assertFinding(result, 'FORENSIC_READ_PERMISSION_BLOCKER');
});

test('65. Gmail mailbox access denied is separated from OAuth scope failure', () => {
  const { result } = runScenario({
    gmail: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'RESOURCE_ACCESS_DENIED' }
  });
  const permission = assertPermissionReason(result, 'GMAIL_PERMISSION_STATUS', 'RESOURCE_ACCESS_DENIED');
  assert.equal(permission.safeErrorClass, 'RESOURCE_ACCESS');
  assert.equal(permission.resourceAccessStatus, 'ACCESS_DENIED_OR_UNPROVEN');
});

test('66. unavailable default Gmail adapter is a diagnostic defect, not proven OAuth or ACL denial', () => {
  const { result } = runScenario({
    gmail: { status: 'READ_BLOCKED', readBlocked: true, reasonCode: 'GMAIL_DEFAULT_READER_NOT_CONFIGURED' }
  });
  const permission = assertPermissionReason(result, 'GMAIL_PERMISSION_STATUS', 'ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE');
  assert.equal(permission.safeErrorClass, 'ADAPTER_DIAGNOSTIC');
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E3I_FORENSICS_INCOMPLETE');
  assertNoFinding(result, 'FORENSIC_READ_PERMISSION_BLOCKER');
});

test('67. Drive XML OAuth scope missing is channel-attributed', () => {
  const { result } = runScenario({
    driveXml: { metadataReadStatus: 'READ_BLOCKED', permissionReasonCode: 'OAUTH_SCOPE_MISSING', bytes: undefined }
  });
  const permission = assertPermissionReason(result, 'DRIVE_XML_PERMISSION_STATUS', 'OAUTH_SCOPE_MISSING');
  assert.equal(permission.authorizationType, 'OAUTH_AND_DRIVE_FILE_ACL');
  assert.equal(result.DRIVE_XML_EVIDENCE.safeDetails.permissionReasonCode, 'OAUTH_SCOPE_MISSING');
});

test('68. Drive XML file ACL denial is channel-attributed', () => {
  const { result } = runScenario({
    driveXml: { contentReadStatus: 'PERMISSION_DENIED', permissionReasonCode: 'RESOURCE_ACCESS_DENIED', bytes: undefined }
  });
  const permission = assertPermissionReason(result, 'DRIVE_XML_PERMISSION_STATUS', 'RESOURCE_ACCESS_DENIED');
  assert.equal(permission.safeErrorClass, 'RESOURCE_ACCESS');
  assertFinding(result, 'FORENSIC_READ_PERMISSION_BLOCKER');
});

test('69. Drive PDF file ACL denial is distinct from Drive XML diagnostics', () => {
  const { result } = runScenario({
    drivePdf: { metadataReadStatus: 'PERMISSION_DENIED', permissionReasonCode: 'RESOURCE_ACCESS_DENIED', bytes: undefined }
  });
  assertPermissionReason(result, 'DRIVE_PDF_PERMISSION_STATUS', 'RESOURCE_ACCESS_DENIED');
  assertPermissionReason(result, 'DRIVE_XML_PERMISSION_STATUS', 'READ_OK', 'READ_OK');
});

test('70. Sheets OAuth scope missing is separated from spreadsheet ACL failure', () => {
  const { result } = runScenario({
    sheets: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'OAUTH_SCOPE_MISSING' }
  });
  const permission = assertPermissionReason(result, 'SHEETS_PERMISSION_STATUS', 'OAUTH_SCOPE_MISSING');
  assert.equal(permission.authorizationType, 'OAUTH_AND_SPREADSHEET_ACL');
});

test('71. spreadsheet access denied is a resource-access blocker', () => {
  const { result } = runScenario({
    sheets: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'RESOURCE_ACCESS_DENIED' }
  });
  const permission = assertPermissionReason(result, 'SHEETS_PERMISSION_STATUS', 'RESOURCE_ACCESS_DENIED');
  assert.equal(permission.resourceAccessStatus, 'ACCESS_DENIED_OR_UNPROVEN');
});

test('72. Firestore IAM or API authorization failure is classified as Firestore authorization', () => {
  const { result } = runScenario({
    firestore: { status: 'PERMISSION_DENIED', readBlocked: true, permissionReasonCode: 'FIRESTORE_AUTHORIZATION_FAILED' }
  });
  const permission = assertPermissionReason(result, 'FIRESTORE_PERMISSION_STATUS', 'FIRESTORE_AUTHORIZATION_FAILED');
  assert.equal(permission.authorizationType, 'OAUTH_DATASTORE_AND_IAM');
  assert.equal(permission.resourceAccessStatus, 'IAM_OR_API_DENIED_OR_UNPROVEN');
});

test('73. Firestore project or database mismatch is not collapsed into Gmail or Sheets permission', () => {
  const { result } = runScenario({
    firestore: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'FIRESTORE_PROJECT_OR_DATABASE_MISMATCH' }
  });
  assertPermissionReason(result, 'FIRESTORE_PERMISSION_STATUS', 'FIRESTORE_PROJECT_OR_DATABASE_MISMATCH');
  assertPermissionReason(result, 'GMAIL_PERMISSION_STATUS', 'READ_OK', 'READ_OK');
  assertPermissionReason(result, 'SHEETS_PERMISSION_STATUS', 'READ_OK', 'READ_OK');
});

test('74. Firestore exact document not found is evidence absence, not permission denied', () => {
  const { result } = runScenario({
    firestore: {
      status: 'NOT_FOUND',
      permissionReasonCode: 'RESOURCE_NOT_FOUND',
      jobExists: false,
      jobState: 'ABSENT',
      commitPlanStatus: 'ABSENT',
      reconciliationReportStatus: 'ABSENT'
    }
  });
  assertPermissionReason(result, 'FIRESTORE_PERMISSION_STATUS', 'RESOURCE_NOT_FOUND', 'RESOURCE_NOT_FOUND');
  assert.equal(result.FIRESTORE_EVIDENCE.status, 'FIRESTORE_JOB_ABSENT');
  assertNoFinding(result, 'FORENSIC_READ_PERMISSION_BLOCKER');
});

test('75. transport failure is diagnostic incomplete, not a permission-denied finding', () => {
  const { result } = runScenario({
    drivePdf: { metadataReadStatus: 'TRANSPORT_FAILED', contentReadStatus: 'UNAVAILABLE', permissionReasonCode: 'TRANSPORT_FAILED', bytes: undefined }
  });
  const permission = assertPermissionReason(result, 'DRIVE_PDF_PERMISSION_STATUS', 'TRANSPORT_FAILED', 'TRANSPORT_FAILED');
  assert.equal(permission.safeErrorClass, 'TRANSPORT');
  assertNoFinding(result, 'FORENSIC_READ_PERMISSION_BLOCKER');
  assertFinding(result, 'FORENSIC_EVIDENCE_INCOMPLETE');
});

test('76. execution identity mismatch is a distinct blocker category', () => {
  const { result } = runScenario({
    sheets: {
      status: 'READ_BLOCKED',
      readBlocked: true,
      permissionReasonCode: 'EXECUTION_IDENTITY_MISMATCH',
      executionIdentityStatus: 'EXECUTION_IDENTITY_MISMATCH'
    }
  });
  const permission = assertPermissionReason(result, 'SHEETS_PERMISSION_STATUS', 'EXECUTION_IDENTITY_MISMATCH');
  assert.equal(permission.safeErrorClass, 'IDENTITY');
  assert.equal(permission.executionIdentityStatus, 'EXECUTION_IDENTITY_MISMATCH');
});

test('77. unknown adapter read error fails closed without fabricating OAuth or ACL cause', () => {
  const { result } = runScenario({
    gmail: { status: 'READ_BLOCKED', readBlocked: true, reasonCode: 'SYNTHETIC_UNKNOWN_FAILURE' }
  });
  const permission = assertPermissionReason(result, 'GMAIL_PERMISSION_STATUS', 'UNKNOWN_READ_BLOCKER');
  assert.equal(permission.safeErrorClass, 'UNKNOWN');
  assertNoFinding(result, 'FORENSIC_READ_PERMISSION_BLOCKER');
  assert.equal(result.FINAL_STATUS, 'BLOCKED_D7_E3I_FORENSICS_INCOMPLETE');
});

test('78. all five channel permission diagnostics are independently visible', () => {
  const { result } = runScenario({
    gmail: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'OAUTH_SCOPE_MISSING' },
    driveXml: { metadataReadStatus: 'PERMISSION_DENIED', permissionReasonCode: 'RESOURCE_ACCESS_DENIED', bytes: undefined },
    drivePdf: { metadataReadStatus: 'TRANSPORT_FAILED', permissionReasonCode: 'TRANSPORT_FAILED', bytes: undefined },
    sheets: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'EXECUTION_IDENTITY_MISMATCH' },
    firestore: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'FIRESTORE_AUTHORIZATION_FAILED' }
  });
  assertPermissionReason(result, 'GMAIL_PERMISSION_STATUS', 'OAUTH_SCOPE_MISSING');
  assertPermissionReason(result, 'DRIVE_XML_PERMISSION_STATUS', 'RESOURCE_ACCESS_DENIED');
  assertPermissionReason(result, 'DRIVE_PDF_PERMISSION_STATUS', 'TRANSPORT_FAILED', 'TRANSPORT_FAILED');
  assertPermissionReason(result, 'SHEETS_PERMISSION_STATUS', 'EXECUTION_IDENTITY_MISMATCH');
  assertPermissionReason(result, 'FIRESTORE_PERMISSION_STATUS', 'FIRESTORE_AUTHORIZATION_FAILED');
});

test('79. repeated read-permission finding codes retain channel attribution in the summary log', () => {
  const { logs } = runScenario({
    gmail: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'OAUTH_SCOPE_MISSING' },
    sheets: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'RESOURCE_ACCESS_DENIED' },
    firestore: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'FIRESTORE_AUTHORIZATION_FAILED' }
  });
  const summary = parseSummaryLog(logs);
  assert.ok(summary.findingCodes.filter(code => code === 'FORENSIC_READ_PERMISSION_BLOCKER').length >= 3);
  assert.ok(summary.channelFindingCodes.includes('FORENSIC_READ_PERMISSION_BLOCKER:GMAIL'));
  assert.ok(summary.channelFindingCodes.includes('FORENSIC_READ_PERMISSION_BLOCKER:SHEETS'));
  assert.ok(summary.channelFindingCodes.includes('FORENSIC_READ_PERMISSION_BLOCKER:FIRESTORE'));
});

test('80. permission diagnostics redact raw user and token-shaped error text', () => {
  const atSign = String.fromCharCode(64);
  const rawUser = ['reader', atSign, 'example.invalid'].join('');
  const rawToken = ['synthetic', '_private', '_marker'].join('');
  const { result, logs } = runScenario({
    gmail: {
      status: 'READ_BLOCKED',
      readBlocked: true,
      reasonCode: ['OAuth denied for', rawUser, rawToken].join(' ')
    }
  });
  const serialized = JSON.stringify({ result, logs });
  assert.doesNotMatch(serialized, /reader@example\.invalid/);
  assert.doesNotMatch(serialized, /synthetic_private_marker/);
  assertPermissionReason(result, 'GMAIL_PERMISSION_STATUS', 'OAUTH_SCOPE_MISSING');
});

test('81. permission blockers still keep every mutation counter at zero', () => {
  const { result } = runScenario({
    gmail: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'OAUTH_SCOPE_MISSING' },
    firestore: { status: 'PERMISSION_DENIED', readBlocked: true, permissionReasonCode: 'FIRESTORE_AUTHORIZATION_FAILED' }
  });
  for (const [key, value] of Object.entries(result.SAFETY_COUNTS)) {
    if (/MUTATION|DESTRUCTIVE|REPAIR|WRITE/.test(key)) assert.equal(value, 0, key);
  }
});

test('82. permission diagnostics preserve read-call maxima and do not widen bounded reads', () => {
  const { result } = runScenario({
    gmail: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'OAUTH_SCOPE_MISSING', readCallCount: 1 },
    driveXml: { metadataReadStatus: 'PERMISSION_DENIED', permissionReasonCode: 'RESOURCE_ACCESS_DENIED', readCallCount: 1, bytes: undefined },
    drivePdf: { metadataReadStatus: 'PERMISSION_DENIED', permissionReasonCode: 'RESOURCE_ACCESS_DENIED', readCallCount: 1, bytes: undefined },
    sheets: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'RESOURCE_ACCESS_DENIED', readCallCount: 1 },
    firestore: { status: 'READ_BLOCKED', readBlocked: true, permissionReasonCode: 'FIRESTORE_AUTHORIZATION_FAILED', readCallCount: 1 }
  });
  assert.equal(result.SAFETY_COUNTS.READ_ONLY_GMAIL_CALL_COUNT, 1);
  assert.equal(result.SAFETY_COUNTS.READ_ONLY_DRIVE_CALL_COUNT, 2);
  assert.equal(result.SAFETY_COUNTS.READ_ONLY_SHEETS_CALL_COUNT, 1);
  assert.equal(result.SAFETY_COUNTS.READ_ONLY_FIRESTORE_CALL_COUNT, 1);
  assert.equal(result.SAFETY_COUNTS.READ_CALLS_WITHIN_MAXIMA, 'YES');
});

test('83. minimum-scope matrix is explicit and Cloud Platform broad scope is not required', () => {
  const { result } = runScenario();
  assert.equal(result.PERMISSION_DIAGNOSTICS.MINIMUM_SCOPE_MATRIX.GMAIL, 'GMAIL_EXACT_MESSAGE_READ_ONLY');
  assert.equal(result.PERMISSION_DIAGNOSTICS.MINIMUM_SCOPE_MATRIX.DRIVE_XML, 'DRIVE_EXACT_FILE_METADATA_AND_CONTENT_READ_ONLY');
  assert.equal(result.PERMISSION_DIAGNOSTICS.MINIMUM_SCOPE_MATRIX.SHEETS, 'SHEETS_EXACT_ROW_READ_ONLY');
  assert.equal(result.PERMISSION_DIAGNOSTICS.MINIMUM_SCOPE_MATRIX.FIRESTORE, 'FIRESTORE_EXACT_DOCUMENT_READ_ONLY');
  assert.equal(result.PERMISSION_DIAGNOSTICS.BROAD_SCOPE_ADDITION_REQUIRED, 'NO');
  assert.equal(result.PERMISSION_DIAGNOSTICS.CLOUD_PLATFORM_SCOPE_REQUIRED, 'NO');
  const manifest = fs.readFileSync('appsscript.json', 'utf8');
  assert.doesNotMatch(manifest, /cloud-platform/);
});
