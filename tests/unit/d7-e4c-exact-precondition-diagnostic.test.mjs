import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['D7_E4C_ExactPreconditionDiagnostic.js'],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['D7_E4C_ExactPreconditionDiagnostic.js'],
  exportNames: ['D7_E4C_PRECONDITION_IDS_', 'D7_E4C_EVIDENCE_CLASSES_', 'evaluateD7E4BInitialPreconditions_', 'createD7E4CExactPreconditionDiagnosticRunner_']
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function fixture() {
  const candidate = 'a'.repeat(64);
  const jobId = 'job-safe';
  const expected = { jobId, invoiceIdentityHash: 'identity-safe', xmlSha256: 'xml-safe', pdfSha256: 'pdf-safe', leaseFence: 'fence-safe' };
  return {
    authorization: { canonicalCount: 5, identityAligned: true, priorMarkerAbsent: true },
    expected,
    snapshot: {
      exactJobCount: 1, nonExactCandidateCount: 0, readOutcomeUnknown: false,
      job: {
        jobId, invoiceIdentityHash: expected.invoiceIdentityHash, sourceThreadHash: '1a2b3c4d', status: 'VALIDATED', version: 4,
        reconciliationStatus: 'RECONCILIATION_REQUIRED',
        commitPlan: { jobId, expectedLineCount: 1, driveEvidenceTargets: { xmlContentHash: expected.xmlSha256, pdfContentHash: expected.pdfSha256 } }
      },
      lease: { status: 'RECONCILIATION_REQUIRED', jobId, fencingToken: expected.leaseFence, leaseGeneration: 2 },
      eventsComplete: true, events: [{}, {}], reportsComplete: true, reports: [{}], latestReportEvidenceAvailable: true, latestReportValid: true,
      xmlAttachmentPresent: false, pdfAttachmentPresent: false, sheetExactRowPresent: true, sheetContentMatches: true,
      sheetEvidenceAvailable: true, sheetEvidenceComplete: true,
      driveEvidenceAvailable: true, driveEvidenceComplete: true, driveXmlMatches: true, drivePdfMatches: true,
      ignoredSensitiveFixtureValue: candidate
    }
  };
}

function evaluate(input = fixture()) {
  return JSON.parse(JSON.stringify(gas.call('evaluateD7E4BInitialPreconditions_', input.authorization, input.snapshot, input.expected)));
}

function byId(result, id) { return result.results.find(item => item.id === id); }

test('D7-E4C all-pass fixture returns ordered 34/34 sanitized exact evidence', () => {
  assert.equal(TEST_METADATA.ownerPolicyRequired, true);
  const result = evaluate();
  assert.deepEqual(result.results.map(item => item.id), Array.from(gas.exports.D7_E4C_PRECONDITION_IDS_));
  assert.deepEqual(result.summary, { PASS: 34, FAIL: 0, NOT_PROVEN: 0 });
  assert.equal(result.overallStatus, 'PASS');
  for (const item of result.results) {
    assert.deepEqual(Object.keys(item), ['id', 'status', 'reason', 'evidenceClass']);
    assert.deepEqual(item, { id: item.id, status: 'PASS', reason: 'EXACT_TRUE', evidenceClass: 'EXACT_EVIDENCE' });
  }
});

const fail = ['FAIL', 'CONTRADICTORY_EVIDENCE', 'CONTRADICTORY_EVIDENCE'];
const malformed = ['NOT_PROVEN', 'MALFORMED_EVIDENCE', 'MALFORMED_EVIDENCE'];
const incomplete = ['NOT_PROVEN', 'INCOMPLETE_LISTING', 'INCOMPLETE_EVIDENCE'];
const isolatedCases = [
  ['P01', x => { x.authorization.canonicalCount = 4; }, fail],
  ['P02', x => { x.authorization.identityAligned = false; }, fail],
  ['P03', x => { x.authorization.priorMarkerAbsent = false; }, fail],
  ['P04', x => { x.snapshot.exactJobCount = 0; }, fail],
  ['P05', x => { x.snapshot.nonExactCandidateCount = 1; }, fail],
  ['P06', x => { x.snapshot.readOutcomeUnknown = true; }, ['NOT_PROVEN', 'UNKNOWN_OUTCOME', 'UNKNOWN_EVIDENCE']],
  ['P07', x => { x.snapshot.job.jobId = 'other'; }, fail],
  ['P08', x => { x.snapshot.job.invoiceIdentityHash = 'other'; }, fail],
  ['P09', x => { x.snapshot.job.sourceThreadHash = 'invalid'; }, fail],
  ['P10', x => { x.snapshot.job.status = 'other'; }, fail],
  ['P11', x => { x.snapshot.job.version = 3; }, fail],
  ['P12', x => { x.snapshot.job.reconciliationStatus = 'other'; }, fail],
  ['P13', x => { x.snapshot.job.commitPlan.jobId = 'other'; }, fail],
  ['P14', x => { x.snapshot.job.commitPlan.expectedLineCount = 2; }, fail],
  ['P15', x => { x.snapshot.job.commitPlan.driveEvidenceTargets.xmlContentHash = 'other'; }, fail],
  ['P16', x => { x.snapshot.job.commitPlan.driveEvidenceTargets.pdfContentHash = 'other'; }, fail],
  ['P17', x => { x.snapshot.lease.status = 'other'; }, fail],
  ['P18', x => { x.snapshot.lease.jobId = 'other'; }, fail],
  ['P19', x => { x.snapshot.lease.fencingToken = 'other'; }, fail],
  ['P20', x => { x.snapshot.lease.leaseGeneration = 'bad'; }, malformed],
  ['P21', x => { x.snapshot.lease.leaseGeneration = 0; }, fail],
  ['P22', x => { x.snapshot.eventsComplete = false; }, incomplete],
  ['P23', x => { x.snapshot.events = {}; }, malformed],
  ['P24', x => { x.snapshot.events.pop(); }, fail],
  ['P25', x => { x.snapshot.reportsComplete = false; }, incomplete],
  ['P26', x => { x.snapshot.reports = {}; }, malformed],
  ['P27', x => { x.snapshot.reports.push({}); }, fail],
  ['P28', x => { x.snapshot.latestReportValid = false; }, fail],
  ['P29', x => { x.snapshot.xmlAttachmentPresent = true; }, fail],
  ['P30', x => { x.snapshot.pdfAttachmentPresent = true; }, fail],
  ['P31', x => { x.snapshot.sheetExactRowPresent = false; }, fail],
  ['P32', x => { x.snapshot.sheetContentMatches = false; }, fail],
  ['P33', x => { x.snapshot.driveXmlMatches = false; }, fail],
  ['P34', x => { x.snapshot.drivePdfMatches = false; }, fail]
];

for (const [id, mutate, expected] of isolatedCases) {
  test(`D7-E4C ${id} isolated non-pass is enumerated without leaking values`, () => {
    const input = clone(fixture());
    mutate(input);
    const result = evaluate(input);
    assert.deepEqual(byId(result, id), { id, status: expected[0], reason: expected[1], evidenceClass: expected[2] });
    assert.equal(result.results.filter(item => item.status !== 'PASS').some(item => item.id === id), true);
    assert.notEqual(result.overallStatus, 'PASS');
  });
}

test('D7-E4C missing, malformed, unknown, incomplete, and upstream evidence fail closed as not proven', () => {
  const cases = [
    ['MISSING_EVIDENCE', x => { delete x.snapshot.job.jobId; }],
    ['MALFORMED_EVIDENCE', x => { x.snapshot.events = {}; }],
    ['UNKNOWN_OUTCOME', x => { x.snapshot.readOutcomeUnknown = true; }],
    ['INCOMPLETE_LISTING', x => { x.snapshot.reportsComplete = false; }],
    ['UPSTREAM_UNDELIVERABLE', x => { x.snapshot.readOutcomeUndeliverable = true; }]
  ];
  for (const [reason, mutate] of cases) {
    const input = clone(fixture());
    mutate(input);
    const result = evaluate(input);
    assert.equal(result.overallStatus, 'NOT_PROVEN');
    assert.equal(result.results.some(item => item.status === 'NOT_PROVEN' && item.reason === reason), true);
  }

  const numericTargets = [
    ['P01', (x, value) => { x.authorization.canonicalCount = value; }],
    ['P04', (x, value) => { x.snapshot.exactJobCount = value; }],
    ['P05', (x, value) => { x.snapshot.nonExactCandidateCount = value; }],
    ['P11', (x, value) => { x.snapshot.job.version = value; }],
    ['P14', (x, value) => { x.snapshot.job.commitPlan.expectedLineCount = value; }],
    ['P20', (x, value) => { x.snapshot.lease.leaseGeneration = value; }],
    ['P21', (x, value) => { x.snapshot.lease.leaseGeneration = value; }]
  ];
  for (const [id, mutate] of numericTargets) {
    for (const value of [true, false, null, '', [], {}, '4']) {
      const input = clone(fixture());
      mutate(input, value);
      assert.deepEqual(byId(evaluate(input), id), { id, status: malformed[0], reason: malformed[1], evidenceClass: malformed[2] });
    }
  }

  const provenanceCases = [
    ['P24', x => { x.snapshot.eventsComplete = false; }, incomplete],
    ['P24', x => { delete x.snapshot.eventsComplete; }, ['NOT_PROVEN', 'MISSING_EVIDENCE', 'MISSING_EVIDENCE']],
    ['P24', x => { x.snapshot.eventsComplete = 'complete'; }, malformed],
    ['P27', x => { x.snapshot.reportsComplete = false; }, incomplete],
    ['P27', x => { x.snapshot.reportsComplete = 'complete'; }, malformed],
    ['P28', x => { x.snapshot.reportsComplete = false; }, incomplete],
    ['P28', x => { x.snapshot.reports = {}; }, malformed],
    ['P28', x => { x.snapshot.latestReportEvidenceAvailable = false; }, ['NOT_PROVEN', 'MISSING_EVIDENCE', 'MISSING_EVIDENCE']],
    ['P28', x => { x.snapshot.latestReportEvidenceAvailable = 'available'; }, malformed],
    ['P31', x => { x.snapshot.sheetEvidenceAvailable = false; }, ['NOT_PROVEN', 'MISSING_EVIDENCE', 'MISSING_EVIDENCE']],
    ['P32', x => { x.snapshot.sheetEvidenceComplete = false; }, incomplete],
    ['P31', x => { x.snapshot.sheetEvidenceAvailable = 'available'; }, malformed],
    ['P33', x => { x.snapshot.driveEvidenceAvailable = false; }, ['NOT_PROVEN', 'MISSING_EVIDENCE', 'MISSING_EVIDENCE']],
    ['P34', x => { x.snapshot.driveEvidenceComplete = false; }, incomplete],
    ['P33', x => { x.snapshot.driveEvidenceComplete = 'complete'; }, malformed]
  ];
  for (const [id, mutate, expected] of provenanceCases) {
    const input = clone(fixture());
    mutate(input);
    assert.deepEqual(byId(evaluate(input), id), { id, status: expected[0], reason: expected[1], evidenceClass: expected[2] });
  }
});

test('D7-E4C preserves every independent contradiction in a multi-failure result', () => {
  const input = fixture();
  input.snapshot.sheetContentMatches = false;
  input.snapshot.driveXmlMatches = false;
  input.snapshot.xmlAttachmentPresent = true;
  input.snapshot.lease.fencingToken = 'other';
  input.snapshot.eventsComplete = false;
  const result = evaluate(input);
  assert.equal(result.overallStatus, 'FAIL');
  assert.deepEqual(result.results.filter(item => item.status !== 'PASS').map(item => item.id), ['P19', 'P22', 'P24', 'P29', 'P32', 'P33']);
});

test('D7-E4C runner uses only the supplied local capture adapter and makes no mutation or service call', async () => {
  let calls = 0;
  const runner = gas.call('createD7E4CExactPreconditionDiagnosticRunner_', {
    capture: async () => { calls += 1; return fixture(); },
    createLock: () => { throw new Error('unexpected lock'); },
    createStore: () => { throw new Error('unexpected store'); },
    reconcile: () => { throw new Error('unexpected reconcile'); }
  });
  const result = JSON.parse(JSON.stringify(await runner.run()));
  assert.equal(calls, 1);
  assert.equal(result.overallStatus, 'PASS');
});

test('D7-E4C output is deterministic and excludes fixture values', () => {
  const first = JSON.stringify(evaluate());
  const second = JSON.stringify(evaluate());
  assert.equal(first, second);
  for (const forbidden of ['job-safe', 'identity-safe', 'xml-safe', 'pdf-safe', 'fence-safe', 'a'.repeat(64)]) assert.equal(first.includes(forbidden), false);
});
