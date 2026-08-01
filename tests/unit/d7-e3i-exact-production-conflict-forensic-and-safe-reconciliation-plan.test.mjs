import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

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
