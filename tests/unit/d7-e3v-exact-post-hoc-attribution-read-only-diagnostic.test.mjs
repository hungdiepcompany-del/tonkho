import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import {
  evaluateD7E3VPhaseFileState_,
  evaluateD7E3VSourceSemantics_
} from '../../scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js',
    'D7_E3R_ExactBoundedProductionReadOnlyAdapters.js',
    'D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js',
    'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
    'docs/phases/D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION.md'
  ],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js'],
  exportNames: [
    'D7_E3V_PHASE_',
    'D7_E3V_PUBLIC_ENTRYPOINT_',
    'D7_E3V_SCHEMA_VERSION_',
    'D7_E3V_ATTRIBUTION_DECISIONS_',
    'D7_E3V_REASON_CODES_',
    'createD7E3VExactPostHocAttributionReadOnlyRunner_',
    'runD7E3VExactPostHocAttributionReadOnly'
  ]
});

const source = fs.readFileSync('D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js', 'utf8');
const checkerDocSource = fs.existsSync('docs/phases/D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION.md')
  ? fs.readFileSync('docs/phases/D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION.md', 'utf8')
  : '';
const packageSource = fs.readFileSync('package.json', 'utf8');
const aggregateCheckSource = fs.readFileSync('scripts/test/run-all-checks.mjs', 'utf8');

const D7_E3V_PHASE_REQUIRED_FILES = [
  'D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js',
  'tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
  'scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
  'docs/phases/D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION.md'
];

function evaluatePhaseState(patch = {}) {
  return evaluateD7E3VPhaseFileState_({
    statusLines: patch.statusLines || [],
    trackedFiles: patch.trackedFiles || D7_E3V_PHASE_REQUIRED_FILES,
    existingFiles: patch.existingFiles || D7_E3V_PHASE_REQUIRED_FILES,
    requiredFiles: D7_E3V_PHASE_REQUIRED_FILES,
    allowedDirtyFiles: [
      ...D7_E3V_PHASE_REQUIRED_FILES,
      'package.json',
      'scripts/test/run-all-checks.mjs',
      'docs/00_INDEX.md'
    ]
  });
}

function evaluateSourceSemantics(runtimePatch = source) {
  return evaluateD7E3VSourceSemantics_({
    runtime: runtimePatch,
    unitTest: fs.readFileSync('tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs', 'utf8'),
    docs: checkerDocSource,
    packageJsonText: packageSource,
    aggregateCheckText: aggregateCheckSource
  });
}

function fromVm(value) {
  return JSON.parse(JSON.stringify(value));
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

function baseFixture() {
  return {
    configuration: {
      status: 'CONFIGURATION_READ_OK',
      rawConfiguration: { SAFE_ONLY: 'YES' }
    },
    beforeSnapshot: {
      status: 'SNAPSHOT_CAPTURED',
      fingerprint: 'stable-safe-snapshot'
    },
    afterSnapshot: {
      status: 'SNAPSHOT_CAPTURED',
      fingerprint: 'stable-safe-snapshot'
    },
    gmail: {
      status: 'READ_OK',
      readerImplementation: 'REAL_BOUNDED_READ_ONLY',
      exactTargetMatched: true,
      candidateCount: 1,
      messageCount: 1,
      xmlAttachmentCount: 1,
      pdfAttachmentCount: 1,
      readCallCount: 1
    },
    driveXml: {
      status: 'READ_OK',
      readerImplementation: 'REAL_BOUNDED_READ_ONLY',
      exactTargetMatched: true,
      candidateCount: 1,
      contentHashMatch: 'MATCH',
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_OK',
      readCallCount: 2
    },
    drivePdf: {
      status: 'READ_OK',
      readerImplementation: 'REAL_BOUNDED_READ_ONLY',
      exactTargetMatched: true,
      candidateCount: 1,
      contentHashMatch: 'MATCH',
      metadataReadStatus: 'READ_OK',
      contentReadStatus: 'READ_OK',
      readCallCount: 2
    },
    sheets: {
      status: 'READ_OK',
      readerImplementation: 'REAL_BOUNDED_READ_ONLY',
      exactTargetMatched: true,
      canonicalRowCount: 1,
      exactIdentityMatchCount: 1,
      conflictingIdentityCount: 0,
      rowTransactionIdentityStatus: 'MATCH',
      contentStatus: 'MATCH',
      auditRowIdentityLinkStatus: 'UNAVAILABLE',
      attachmentRecordLinksExactRowIdentity: false,
      externalEvidenceLinksExactRowIdentity: false,
      conflictingAttributionEvidencePresent: false,
      readCallCount: 1
    },
    firestore: {
      status: 'READ_OK',
      readerImplementation: 'REAL_BOUNDED_READ_ONLY',
      exactTargetMatched: true,
      jobExists: true,
      jobIdentityStatus: 'MATCH',
      jobState: 'VALIDATED',
      commitPlanStatus: 'MATCH',
      commitPlanIdentityStatus: 'MATCH',
      expectedDriveIdentitiesStatus: 'MATCH',
      expectedSheetTransactionIdentityStatus: 'MATCH',
      writeAttemptLinkStatus: 'MATCH',
      exactWriteOutcomeLinkStatus: 'MATCH',
      auditLinkStatus: 'UNAVAILABLE',
      attachmentRecordLinkStatus: 'UNAVAILABLE',
      externalCreatorEvidenceStatus: 'UNAVAILABLE',
      writeOutcomeEvidenceStatus: 'UNKNOWN_WRITE_OUTCOME_EXACT_LINK',
      reconciliationReportStatus: 'ABSENT',
      readCallCount: 5
    }
  };
}

function runScenario(overrides = {}) {
  const fixture = deepMerge(baseFixture(), overrides);
  const logs = [];
  const runner = gas.call('createD7E3VExactPostHocAttributionReadOnlyRunner_', {
    readConfiguration: () => fixture.configuration,
    readSnapshot: args => args.stage === 'AFTER' ? fixture.afterSnapshot : fixture.beforeSnapshot,
    readGmailEvidence: () => fixture.gmail,
    readDriveEvidence: args => args.artifactType === 'PDF' ? fixture.drivePdf : fixture.driveXml,
    readSheetsEvidence: () => fixture.sheets,
    readFirestoreEvidence: () => fixture.firestore,
    now: () => '2026-08-02T00:00:00.000Z',
    logger: { log: value => logs.push(String(value)) }
  });
  return { result: fromVm(runner.run()), logs };
}

function assertZeroMutation(result) {
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
    assert.equal(result.SAFE_COUNTERS[key], 0, key);
  }
}

function assertReason(result, code) {
  assert.ok(result.ATTRIBUTION_REASON_CODES.includes(code), `${code} missing from ${JSON.stringify(result.ATTRIBUTION_REASON_CODES)}`);
}

test('D7-E3V metadata declares a read-only attribution diagnostic', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D7_E3V_PHASE_, 'D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION');
  assert.equal(gas.exports.D7_E3V_PUBLIC_ENTRYPOINT_, 'runD7E3VExactPostHocAttributionReadOnly');
  assert.equal(gas.exports.D7_E3V_SCHEMA_VERSION_, 'D7_E3V_ATTRIBUTION_RESULT_V1');
});

const D7_E3V_SCENARIOS = [
  ['01 exact D7-E job identity match', () => {
    const { result } = runScenario();
    assert.equal(result.JOB_IDENTITY_EXACT, 'YES');
  }],
  ['02 job identity mismatch', () => {
    const { result } = runScenario({ firestore: { jobIdentityStatus: 'CONFLICT' } });
    assertReason(result, 'ATTRIBUTION_JOB_IDENTITY_MISMATCH');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_CONFLICT');
  }],
  ['03 exact commit-plan identity match', () => {
    const { result } = runScenario();
    assert.equal(result.COMMIT_PLAN_IDENTITY_EXACT, 'YES');
  }],
  ['04 commit-plan identity mismatch', () => {
    const { result } = runScenario({ firestore: { commitPlanIdentityStatus: 'CONFLICT' } });
    assertReason(result, 'ATTRIBUTION_COMMIT_PLAN_MISMATCH');
  }],
  ['05 XML exact identity and hash match', () => {
    const { result } = runScenario();
    assert.equal(result.DRIVE_XML_IDENTITY_EXACT, 'YES');
    assert.equal(result.DRIVE_XML_CONTENT_HASH_MATCH, 'YES');
  }],
  ['06 XML identity mismatch', () => {
    const { result } = runScenario({ driveXml: { exactTargetMatched: false } });
    assertReason(result, 'ATTRIBUTION_DRIVE_XML_IDENTITY_MISMATCH');
  }],
  ['07 XML hash conflict', () => {
    const { result } = runScenario({ driveXml: { contentHashMatch: 'CONFLICT' } });
    assertReason(result, 'ATTRIBUTION_DRIVE_XML_HASH_MISMATCH');
  }],
  ['08 PDF exact identity and hash match', () => {
    const { result } = runScenario();
    assert.equal(result.DRIVE_PDF_IDENTITY_EXACT, 'YES');
    assert.equal(result.DRIVE_PDF_CONTENT_HASH_MATCH, 'YES');
  }],
  ['09 PDF identity mismatch', () => {
    const { result } = runScenario({ drivePdf: { exactTargetMatched: false } });
    assertReason(result, 'ATTRIBUTION_DRIVE_PDF_IDENTITY_MISMATCH');
  }],
  ['10 PDF hash conflict', () => {
    const { result } = runScenario({ drivePdf: { contentHashMatch: 'CONFLICT' } });
    assertReason(result, 'ATTRIBUTION_DRIVE_PDF_HASH_MISMATCH');
  }],
  ['11 exact Sheet row identity match', () => {
    const { result } = runScenario();
    assert.equal(result.SHEET_ROW_IDENTITY_EXACT, 'YES');
  }],
  ['12 exact Sheet transaction identity match', () => {
    const { result } = runScenario();
    assert.equal(result.SHEET_TRANSACTION_IDENTITY_EXACT, 'YES');
  }],
  ['13 missing Sheet transaction identity', () => {
    const { result } = runScenario({ sheets: { rowTransactionIdentityStatus: 'UNAVAILABLE' } });
    assertReason(result, 'ATTRIBUTION_SHEET_TRANSACTION_IDENTITY_MISSING');
  }],
  ['14 conflicting Sheet transaction identity', () => {
    const { result } = runScenario({ sheets: { rowTransactionIdentityStatus: 'CONFLICT' } });
    assertReason(result, 'ATTRIBUTION_SHEET_TRANSACTION_IDENTITY_MISSING');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_CONFLICT');
  }],
  ['15 caller attribution label cannot prove origin', () => {
    const { result } = runScenario({
      firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE', writeOutcomeEvidenceStatus: 'UNKNOWN_WRITE_OUTCOME_PRESENT' },
      sheets: { callerAttributionObservation: 'ATTRIBUTION_PROVEN_D7_E' }
    });
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_UNPROVEN');
  }],
  ['16 exact durable write-attempt link proves current state only when identities match', () => {
    const { result } = runScenario();
    assert.equal(result.DURABLE_WRITE_ATTEMPT_LINK_EXACT, 'YES');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_PROVEN_D7_E');
  }],
  ['17 generic unknown-write marker does not prove origin', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE', writeOutcomeEvidenceStatus: 'UNKNOWN_WRITE_OUTCOME_PRESENT' } });
    assert.equal(result.DURABLE_WRITE_ATTEMPT_LINK_EXACT, 'NO');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_UNPROVEN');
  }],
  ['18 exact audit link', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE', auditLinkStatus: 'MATCH' } });
    assert.equal(result.DURABLE_AUDIT_LINK_EXACT, 'YES');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_PROVEN_D7_E');
  }],
  ['19 exact attachment-record link', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE', attachmentRecordLinkStatus: 'MATCH' } });
    assert.equal(result.DURABLE_ATTACHMENT_RECORD_LINK_EXACT, 'YES');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_PROVEN_D7_E');
  }],
  ['20 missing durable link returns ATTRIBUTION_UNPROVEN', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE', auditLinkStatus: 'UNAVAILABLE', attachmentRecordLinkStatus: 'UNAVAILABLE' } });
    assertReason(result, 'ATTRIBUTION_DURABLE_LINK_MISSING');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_UNPROVEN');
  }],
  ['21 conflicting durable links return ATTRIBUTION_CONFLICT', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'MATCH', externalCreatorEvidenceStatus: 'MATCH' } });
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_CONFLICT');
  }],
  ['22 external creator evidence returns ATTRIBUTION_PROVEN_EXTERNAL_OR_USER_CREATED', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE', externalCreatorEvidenceStatus: 'MATCH' } });
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_PROVEN_EXTERNAL_OR_USER_CREATED');
  }],
  ['23 row predating D7-E attempt prevents D7-E attribution', () => {
    const { result } = runScenario({ sheets: { rowTemporalStatus: 'PREDATES_D7_E_ATTEMPT' } });
    assert.notEqual(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_PROVEN_D7_E');
  }],
  ['24 concurrent change prevents attribution decision', () => {
    const { result } = runScenario({ afterSnapshot: { status: 'SNAPSHOT_CAPTURED', fingerprint: 'changed-safe-snapshot' } });
    assert.equal(result.CONCURRENT_CHANGE_DETECTED, 'YES');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_CONFLICT');
  }],
  ['25 incomplete read fails closed', () => {
    const { result } = runScenario({ gmail: { status: 'READ_BLOCKED', reasonCode: 'RESOURCE_ACCESS_DENIED', readCallCount: 1 } });
    assert.equal(result.STATUS, 'BLOCKED_D7_E3V_ATTRIBUTION_READ_INCOMPLETE');
    assertReason(result, 'ATTRIBUTION_READ_INCOMPLETE');
  }],
  ['26 D7-E attribution requires all mandatory elements', () => {
    const { result } = runScenario({ sheets: { contentStatus: 'CONFLICT' } });
    assert.notEqual(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_PROVEN_D7_E');
  }],
  ['27 content similarity alone is insufficient', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE' } });
    assert.equal(result.SHEET_CONTENT_MATCH, 'YES');
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_UNPROVEN');
  }],
  ['28 exact external state plus proven D7-E attribution and incomplete Firestore selects FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED', () => {
    const { result } = runScenario();
    assert.equal(result.RECONCILIATION_PLAN_TYPE, 'FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED');
  }],
  ['29 missing post-hoc event with proven origin selects POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED', () => {
    const { result } = runScenario({ firestore: { writeOutcomeEvidenceStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE', auditLinkStatus: 'MATCH' } });
    assert.equal(result.RECONCILIATION_PLAN_TYPE, 'POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED');
  }],
  ['30 external/user-created state selects OWNER_MANUAL_REVIEW_REQUIRED', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE', externalCreatorEvidenceStatus: 'MATCH' } });
    assert.equal(result.RECONCILIATION_PLAN_TYPE, 'OWNER_MANUAL_REVIEW_REQUIRED');
  }],
  ['31 attribution conflict selects OWNER_MANUAL_REVIEW_REQUIRED', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'MATCH', externalCreatorEvidenceStatus: 'MATCH' } });
    assert.equal(result.RECONCILIATION_PLAN_TYPE, 'OWNER_MANUAL_REVIEW_REQUIRED');
  }],
  ['32 attribution unproven selects OWNER_MANUAL_REVIEW_REQUIRED', () => {
    const { result } = runScenario({ firestore: { writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE' } });
    assert.equal(result.RECONCILIATION_PLAN_TYPE, 'OWNER_MANUAL_REVIEW_REQUIRED');
  }],
  ['33 already consistent state selects NO_ACTION_REQUIRED', () => {
    const { result } = runScenario({ firestore: { jobState: 'COMPLETED', reconciliationReportStatus: 'CONSISTENT' } });
    assert.equal(result.RECONCILIATION_PLAN_TYPE, 'NO_ACTION_REQUIRED');
  }],
  ['34 concurrent change selects FRESH_READ_ONLY_RERUN_REQUIRED', () => {
    const { result } = runScenario({ afterSnapshot: { status: 'SNAPSHOT_CAPTURED', fingerprint: 'changed-safe-snapshot' } });
    assert.equal(result.RECONCILIATION_PLAN_TYPE, 'FRESH_READ_ONLY_RERUN_REQUIRED');
  }],
  ['35 automaticExecutionAllowed remains NO', () => {
    const { result } = runScenario();
    assert.equal(result.RECONCILIATION_AUTOMATIC_EXECUTION_ALLOWED, 'NO');
  }],
  ['36 reconciliation plan is never executed', () => {
    const { result } = runScenario();
    assert.equal(result.RECONCILIATION_PLAN_EXECUTED, 'NO');
  }],
  ['37 all mutation counters remain zero', () => {
    const { result } = runScenario();
    assertZeroMutation(result);
  }],
  ['38 no broad Firestore listing occurs', () => assert.doesNotMatch(source, /runQuery|listCollection|listDocuments|documents:list/)],
  ['39 no Sheet scan occurs', () => assert.doesNotMatch(source, /getDataRange\s*\(|createTextFinder\s*\(/)],
  ['40 no Drive folder scan occurs', () => assert.doesNotMatch(source, /\.getFiles\s*\(|searchFiles\s*\(/)],
  ['41 raw identifiers are redacted', () => {
    const { result, logs } = runScenario({ firestore: { rawDocumentPath: 'invoiceJobs/raw-job', messageId: 'raw-msg-id', driveId: 'raw-drive-id' } });
    const text = JSON.stringify(result) + JSON.stringify(logs);
    assert.doesNotMatch(text, /raw-job|raw-msg-id|raw-drive-id/);
  }],
  ['42 raw exceptions are redacted', () => {
    const runner = gas.call('createD7E3VExactPostHocAttributionReadOnlyRunner_', {
      readSnapshot: () => { throw new Error('Bearer token-value raw-secret'); },
      readGmailEvidence: () => baseFixture().gmail,
      readDriveEvidence: args => args.artifactType === 'PDF' ? baseFixture().drivePdf : baseFixture().driveXml,
      readSheetsEvidence: () => baseFixture().sheets,
      readFirestoreEvidence: () => baseFixture().firestore,
      logger: { log: () => {} }
    });
    const result = fromVm(runner.run());
    assert.doesNotMatch(JSON.stringify(result), /token-value|raw-secret/);
  }],
  ['43 read-call bounds are enforced', () => {
    const { result } = runScenario();
    assert.equal(result.SAFE_COUNTERS.READ_CALLS_WITHIN_MAXIMA, 'YES');
  }],
  ['44 production entrypoint or dedicated D7-E3V entrypoint uses exact readers', () => {
    assert.match(source, /createD7E3RExactBoundedProductionReadOnlyAdapters_/);
    assert.match(source, /readGmailEvidence/);
    assert.match(source, /readFirestoreEvidence/);
  }],
  ['45 existing D7-E3I zero-byte protections remain unchanged', () => {
    const e3i = fs.readFileSync('D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js', 'utf8');
    assert.match(e3i, /ZERO_BYTE_UNPROVEN/);
  }],
  ['46 existing Sheet durable-attribution protections remain unchanged', () => {
    const e3i = fs.readFileSync('D7_E3I_ExactProductionConflictForensicAndSafeReconciliationPlan.js', 'utf8');
    assert.match(e3i, /rowExistenceAttributionProhibited/);
    assert.match(e3i, /labelOnlyAttributionProhibited/);
  }],
  ['47 Firestore COMPLETED or VALIDATED cannot bypass attribution', () => {
    const { result } = runScenario({ firestore: { jobState: 'COMPLETED', reconciliationReportStatus: 'CONSISTENT', writeAttemptLinkStatus: 'UNAVAILABLE', exactWriteOutcomeLinkStatus: 'UNAVAILABLE' } });
    assert.equal(result.ATTRIBUTION_DECISION, 'ATTRIBUTION_UNPROVEN');
  }],
  ['48 classification precedence remains fail-closed', () => {
    const { result } = runScenario({ firestore: { jobIdentityStatus: 'CONFLICT' }, gmail: { status: 'READ_BLOCKED' } });
    assert.equal(result.STATUS, 'BLOCKED_D7_E3V_ATTRIBUTION_READ_INCOMPLETE');
    assertReason(result, 'ATTRIBUTION_READ_INCOMPLETE');
  }]
];

test('D7-E3V scenario matrix contains the required 48 attribution cases', () => {
  assert.equal(D7_E3V_SCENARIOS.length, 48);
});

for (const [name, run] of D7_E3V_SCENARIOS) {
  test(name, run);
}

test('49 checker accepts current approved implementation state', () => {
  const state = evaluatePhaseState({
    statusLines: [
      '?? D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js',
      '?? tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs',
      '?? scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs',
      '?? docs/phases/D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION.md',
      ' M package.json',
      ' M docs/00_INDEX.md',
      ' M GUARD.bat',
      '?? _guard/deploy/safe-output.txt'
    ],
    trackedFiles: ['package.json', 'scripts/test/run-all-checks.mjs', 'docs/00_INDEX.md']
  });
  assert.equal(state.ok, true);
  assert.equal(state.mode, 'APPROVED_LOCAL_IMPLEMENTATION_CHANGES');
});

test('50 checker accepts committed-clean state', () => {
  const state = evaluatePhaseState();
  assert.equal(state.ok, true);
  assert.equal(state.mode, 'ALL_REQUIRED_FILES_TRACKED_AND_CLEAN');
});

test('51 checker rejects missing runtime', () => {
  const state = evaluatePhaseState({ existingFiles: D7_E3V_PHASE_REQUIRED_FILES.filter(file => !file.endsWith('Diagnostic.js')) });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^MISSING_FILE_/);
});

test('52 checker rejects missing test', () => {
  const state = evaluatePhaseState({ existingFiles: D7_E3V_PHASE_REQUIRED_FILES.filter(file => !file.includes('/unit/')) });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^MISSING_FILE_/);
});

test('53 checker rejects staged phase file where prohibited', () => {
  const state = evaluatePhaseState({ statusLines: ['A  D7_E3V_ExactPostHocAttributionReadOnlyDiagnostic.js'] });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^STAGED_FILE_/);
});

test('54 checker rejects unexpected modified file', () => {
  const state = evaluatePhaseState({ statusLines: [' M unrelated-runtime.js'] });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^UNAPPROVED_DIRTY_FILE_/);
});

test('55 checker rejects unexpected untracked file', () => {
  const state = evaluatePhaseState({ statusLines: ['?? docs/unapproved-d7-e3v-note.md'] });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^UNAPPROVED_DIRTY_FILE_/);
});

test('56 checker ignores exact known guard paths', () => {
  const state = evaluatePhaseState({
    statusLines: [
      ' M GUARD.bat',
      ' M _guard/PROJECT_GUARD.config.bat',
      ' M _guard/PROJECT_GUARD_ENGINE.bat',
      ' M _guard/README.md',
      '?? _guard/deploy/output.txt'
    ]
  });
  assert.equal(state.ok, true);
  assert.equal(state.mode, 'ALL_REQUIRED_FILES_TRACKED_AND_CLEAN');
});

test('57 checker rejects similarly named non-approved guard path', () => {
  const state = evaluatePhaseState({ statusLines: ['?? _guarded/PROJECT_GUARD.config.bat'] });
  assert.equal(state.ok, false);
  assert.match(state.failureCode, /^UNAPPROVED_DIRTY_FILE_/);
});

test('58 checker rejects missing durable-link requirement', () => {
  const semantic = evaluateSourceSemantics(source.replace("EXACT_DURABLE_LINK_REQUIRED: 'YES'", "EXACT_DURABLE_LINK_REQUIRED: 'NO'"));
  assert.equal(semantic.ok, false);
  assert.ok(semantic.failures.includes('RUNTIME_MARKER_MISSING_EXACT_DURABLE_LINK_REQUIRED_YES_'));
});

test('59 checker rejects reachable Firestore write', () => {
  const semantic = evaluateSourceSemantics(`${source}\nfunction unsafeFirestoreWrite_() { return { method: 'post' }; }`);
  assert.equal(semantic.ok, false);
  assert.ok(semantic.failures.some(code => code.startsWith('FORBIDDEN_RUNTIME_PATTERN_')));
});

test('60 checker rejects callable D7-E production pilot', () => {
  const semantic = evaluateSourceSemantics(`${source}\nfunction unsafePilotCall_() { return runD7EOwnerApprovedOneCandidateProductionPilot(); }`);
  assert.equal(semantic.ok, false);
  assert.ok(semantic.failures.some(code => code.startsWith('FORBIDDEN_RUNTIME_PATTERN_')));
});

test('61 checker rejects broad Sheet scan', () => {
  const semantic = evaluateSourceSemantics(`${source}\nfunction unsafeSheetScan_(sheet) { return sheet.getDataRange(); }`);
  assert.equal(semantic.ok, false);
  assert.ok(semantic.failures.some(code => code.startsWith('FORBIDDEN_RUNTIME_PATTERN_')));
});

test('62 checker rejects broad Firestore listing', () => {
  const semantic = evaluateSourceSemantics(`${source}\nfunction unsafeFirestoreList_() { return runQuery(); }`);
  assert.equal(semantic.ok, false);
  assert.ok(semantic.failures.some(code => code.startsWith('FORBIDDEN_RUNTIME_PATTERN_')));
});

test('63 checker rejects automatic reconciliation', () => {
  const semantic = evaluateSourceSemantics(source.replace("automaticExecutionAllowed: 'NO'", "automaticExecutionAllowed: 'YES'"));
  assert.equal(semantic.ok, false);
  assert.ok(semantic.failures.includes('RUNTIME_MARKER_MISSING_AUTOMATICEXECUTIONALLOWED_NO_'));
});
