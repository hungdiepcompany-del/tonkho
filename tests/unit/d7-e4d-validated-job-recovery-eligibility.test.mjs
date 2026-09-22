import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['D7_E4D_ValidatedJobRecoveryEligibility.js'],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['D7_E4D_ValidatedJobRecoveryEligibility.js'],
  exportNames: [
    'D7_E4D_EVIDENCE_IDS_',
    'D7_E4D_CAPABILITY_IDS_',
    'D7_E4D_RECOVERY_STATE_PATH_',
    'evaluateD7E4DValidatedJobRecoveryEligibility_'
  ]
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function fixture() {
  const expected = {
    jobId: 'job-redacted',
    invoiceIdentityHash: 'identity-redacted',
    xmlSha256: 'xml-redacted',
    pdfSha256: 'pdf-redacted',
    leaseFence: 'fence-redacted'
  };
  return {
    expected,
    snapshot: {
      exactJobCount: 1,
      nonExactCandidateCount: 0,
      readOutcomeUnknown: false,
      job: {
        jobId: expected.jobId,
        invoiceIdentityHash: expected.invoiceIdentityHash,
        status: 'VALIDATED',
        version: 4,
        reconciliationStatus: 'RECONCILIATION_REQUIRED',
        commitPlan: {
          jobId: expected.jobId,
          expectedLineCount: 1,
          driveEvidenceTargets: {
            xmlContentHash: expected.xmlSha256,
            pdfContentHash: expected.pdfSha256
          }
        }
      },
      lease: { status: 'RECONCILIATION_REQUIRED', jobId: expected.jobId, fencingToken: expected.leaseFence, leaseGeneration: 2 },
      events: [{}, {}],
      eventsComplete: true,
      reports: [{}],
      reportsComplete: true,
      latestReportEvidenceAvailable: true,
      latestReportValid: true,
      xmlAttachmentPresent: false,
      pdfAttachmentPresent: false,
      sheetEvidenceAvailable: true,
      sheetEvidenceComplete: true,
      sheetExactRowPresent: false,
      sheetContentMatches: false,
      driveEvidenceAvailable: true,
      driveEvidenceComplete: true,
      driveXmlMatches: false,
      drivePdfMatches: false
    },
    sourceEvidence: {
      gmailSourceVerified: true,
      candidateIdentityVerified: true,
      recomputedCommitPlanMatches: true
    },
    capabilities: {
      sameJobValidatedResumeSupported: false,
      currentIdentityContractSupported: false,
      hoaDonAdapterAvailable: false,
      inventoryAdapterAvailable: false,
      gmailProjectionAdapterAvailable: false,
      exactWriteBudgetDesigned: false,
      oneShotMarkerLifecycleDesigned: false
    }
  };
}

function evaluate(input) {
  return JSON.parse(JSON.stringify(gas.call('evaluateD7E4DValidatedJobRecoveryEligibility_', input)));
}

test('fresh D7-E3I-shaped evidence is same-job eligible but runtime remains fail-closed', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  const result = evaluate(fixture());
  assert.deepEqual(result.evidenceSummary, { PASS: 27, FAIL: 0, NOT_PROVEN: 0 });
  assert.deepEqual(result.capabilitySummary, { PASS: 0, FAIL: 7, NOT_PROVEN: 0 });
  assert.equal(result.classification, 'BLOCKED_RUNTIME_CAPABILITY_GAP');
  assert.equal(result.sameJobDisposition, 'PRESERVE_EXISTING_JOB_ID');
  assert.equal(result.productionExecutionAuthorized, 'NO');
  assert.deepEqual(result.requiredStatePath, ['VALIDATED', 'FILES_SAVED', 'COMMITTING', 'ROWS_COMMITTED', 'INVENTORY_PENDING', 'PROJECTIONS_COMMITTED', 'COMPLETED']);
});

test('all required runtime capabilities produce local implementation readiness only', () => {
  const input = fixture();
  Object.keys(input.capabilities).forEach(key => { input.capabilities[key] = true; });
  const result = evaluate(input);
  assert.equal(result.classification, 'READY_FOR_LOCAL_RUNTIME_IMPLEMENTATION');
  assert.deepEqual(result.capabilitySummary, { PASS: 7, FAIL: 0, NOT_PROVEN: 0 });
  assert.equal(result.productionExecutionAuthorized, 'NO');
});

test('external artifact presence or terminal drift blocks recovery evidence', () => {
  for (const mutate of [
    input => { input.snapshot.driveXmlMatches = true; },
    input => { input.snapshot.sheetExactRowPresent = true; },
    input => { input.snapshot.job.status = 'RECONCILIATION_REQUIRED'; },
    input => { input.snapshot.job.version = 5; },
    input => { input.snapshot.exactJobCount = 2; }
  ]) {
    const input = fixture();
    mutate(input);
    assert.equal(evaluate(input).classification, 'BLOCKED_RECOVERY_EVIDENCE');
  }
});

test('unknown and incomplete reads remain not proven', () => {
  const unknown = fixture();
  unknown.snapshot.readOutcomeUnknown = true;
  const unknownResult = evaluate(unknown);
  assert.equal(unknownResult.classification, 'BLOCKED_RECOVERY_EVIDENCE');
  assert.equal(unknownResult.evidence.some(item => item.reason === 'UNKNOWN_OUTCOME'), true);

  const incomplete = fixture();
  incomplete.snapshot.reportsComplete = false;
  const incompleteResult = evaluate(incomplete);
  assert.equal(incompleteResult.classification, 'BLOCKED_RECOVERY_EVIDENCE');
  assert.equal(incompleteResult.evidence.some(item => item.reason === 'INCOMPLETE_LISTING'), true);
});

test('output is ordered, deterministic, and excludes exact identities', () => {
  const input = fixture();
  const first = JSON.stringify(evaluate(input));
  const second = JSON.stringify(evaluate(clone(input)));
  assert.equal(first, second);
  assert.deepEqual(evaluate(input).evidence.map(item => item.id), Array.from(gas.exports.D7_E4D_EVIDENCE_IDS_));
  assert.deepEqual(evaluate(input).capabilities.map(item => item.id), Array.from(gas.exports.D7_E4D_CAPABILITY_IDS_));
  for (const forbidden of Object.values(input.expected)) assert.equal(first.includes(forbidden), false);
});
