import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['D7_E4A1_BoundedFirestoreIdentityCardinalityReadOnlyProof.js'],
  ownerPolicyRequired: true,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['D7_E4A1_BoundedFirestoreIdentityCardinalityReadOnlyProof.js'],
  exportNames: [
    'D7_E4A1_PHASE_',
    'D7_E4A1_PUBLIC_ENTRYPOINT_',
    'D7_E4A1_SCHEMA_VERSION_',
    'D7_E4A1_OWNER_MARKER_',
    'createD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyRunner_',
    'createD7E4A1ProductionFirestoreReadOnly_',
    'durableD7E4A1HashPrefix_'
  ]
});

const source = fs.readFileSync('D7_E4A1_BoundedFirestoreIdentityCardinalityReadOnlyProof.js', 'utf8');
const candidateFingerprint = 'a'.repeat(64);
const xmlSha256 = 'b'.repeat(64);
const pdfSha256 = 'c'.repeat(64);
const attachmentSetHash = 'd'.repeat(64);
const expectedJobId = 'd7e_job_' + candidateFingerprint.slice(0, 24);
const expectedInvoicePrefix = gas.call('durableD7E4A1HashPrefix_', candidateFingerprint);
const sourceThreadHash = '1a2b3c4d';

function fromVm(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactJob(overrides = {}) {
  return {
    jobId: expectedJobId,
    invoiceIdentityHash: expectedInvoicePrefix,
    sourceThreadHash,
    status: 'VALIDATED',
    commitPlan: {
      jobId: expectedJobId,
      expectedLineCount: 1,
      driveEvidenceTargets: {
        xmlContentHash: xmlSha256,
        pdfContentHash: pdfSha256
      }
    },
    ...overrides
  };
}

function readConfiguration(marker = gas.exports.D7_E4A1_OWNER_MARKER_) {
  return {
    D7_E4A1_OWNER_APPROVAL_MARKER: marker,
    D7_E_CANONICAL_CANDIDATE_FINGERPRINT: candidateFingerprint,
    D7_E_CANONICAL_XML_SHA256: xmlSha256,
    D7_E_CANONICAL_PDF_SHA256: pdfSha256,
    D7_E_CANONICAL_INVOICE_IDENTITY_HASH: candidateFingerprint,
    D7_E_CANONICAL_ATTACHMENT_SET_HASH: attachmentSetHash
  };
}

function runScenario({ config = readConfiguration(), direct = exactJob(), jobCandidates = [exactJob()], exactCandidates = [exactJob()], queryError = null } = {}) {
  const logs = [];
  let queryIndex = 0;
  const runner = gas.call('createD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyRunner_', {
    readConfiguration: () => config,
    getDocument: () => direct,
    queryDocuments: request => {
      queryIndex += 1;
      if (queryError && queryIndex === queryError.index) throw queryError.error;
      return queryIndex === 1 ? jobCandidates : exactCandidates;
    },
    now: () => '2026-08-07T00:00:00.000Z',
    logger: { log: value => logs.push(String(value)) }
  });
  return { result: fromVm(runner.run()), logs, queryIndex };
}

function assertZeroMutation(result) {
  for (const [key, value] of Object.entries(result.SAFETY_COUNTS)) assert.equal(value, 0, key);
}

test('D7-E4A1 declares the bounded production read-only cardinality contract', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.D7_E4A1_PHASE_, 'D7_E4A1_BOUNDED_FIRESTORE_IDENTITY_CARDINALITY_READ_ONLY_PROOF');
  assert.equal(gas.exports.D7_E4A1_PUBLIC_ENTRYPOINT_, 'runD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyProof');
  assert.equal(gas.exports.D7_E4A1_SCHEMA_VERSION_, 'D7_E4A1_FIRESTORE_CARDINALITY_RESULT_V1');
});

test('one exact bounded composite result proves cardinality and duplicate absence', () => {
  const { result, logs, queryIndex } = runScenario();
  assert.equal(queryIndex, 2);
  assert.equal(result.FINAL_STATUS, 'PASS_READ_ONLY_CARDINALITY_PROOF_ONE_MATCH');
  assert.equal(result.CARDINALITY.EXACT_MATCHING_JOB_COUNT, 1);
  assert.equal(result.CARDINALITY.EXACT_FIRESTORE_JOB_CARDINALITY_PROVEN, 'YES');
  assert.equal(result.CARDINALITY.DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN, 'YES');
  assert.equal(result.QUERY.QUERY_LIMIT_PER_QUERY, 2);
  assert.equal(result.QUERY.QUERY_COUNT, 2);
  assertZeroMutation(result);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].includes(candidateFingerprint), false);
  assert.equal(logs[0].includes(xmlSha256), false);
  assert.equal(logs[0].includes(pdfSha256), false);
});

test('zero deterministic job candidates is a bounded exact-zero proof', () => {
  const { result, queryIndex } = runScenario({ direct: null, jobCandidates: [] });
  assert.equal(queryIndex, 1);
  assert.equal(result.FINAL_STATUS, 'PASS_READ_ONLY_CARDINALITY_PROOF_ZERO_MATCH');
  assert.equal(result.CARDINALITY.EXACT_MATCHING_JOB_COUNT, 0);
  assert.equal(result.CARDINALITY.DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN, 'YES');
  assertZeroMutation(result);
});

test('two exact composite results fail closed as duplicate matching jobs', () => {
  const { result } = runScenario({
    jobCandidates: [exactJob({ __d7e4a1Reference: 'invoiceJobs/one' }), exactJob({ __d7e4a1Reference: 'invoiceJobs/two' })],
    exactCandidates: [exactJob({ __d7e4a1Reference: 'invoiceJobs/one' }), exactJob({ __d7e4a1Reference: 'invoiceJobs/two' })]
  });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_DUPLICATE_EXACT_FIRESTORE_JOBS');
  assert.equal(result.CARDINALITY.EXACT_MATCHING_JOB_COUNT, '2_PLUS');
  assert.equal(result.CARDINALITY.DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN, 'NO');
  assertZeroMutation(result);
});

test('a partial-identity candidate is classified separately and blocks reconciliation progression', () => {
  const exact = exactJob({ __d7e4a1Reference: 'invoiceJobs/exact' });
  const partial = exactJob({ __d7e4a1Reference: 'invoiceJobs/partial', commitPlan: { jobId: expectedJobId, expectedLineCount: 1, driveEvidenceTargets: { xmlContentHash: xmlSha256, pdfContentHash: 'e'.repeat(64) } } });
  const { result } = runScenario({ jobCandidates: [exact, partial], exactCandidates: [exact] });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_CONFLICTING_PARTIAL_IDENTITY_JOB');
  assert.equal(result.CARDINALITY.CANDIDATE_DOCUMENT_COUNT, '2_PLUS');
  assert.equal(result.CARDINALITY.EXACT_MATCHING_JOB_COUNT, 1);
  assert.equal(result.CARDINALITY.NON_EXACT_CANDIDATE_COUNT, 1);
  assertZeroMutation(result);
});

test('duplicate query references are deduplicated before cardinality classification', () => {
  const exact = exactJob({ __d7e4a1Reference: 'invoiceJobs/exact' });
  const { result } = runScenario({ jobCandidates: [exact], exactCandidates: [exact, exact] });
  assert.equal(result.FINAL_STATUS, 'PASS_READ_ONLY_CARDINALITY_PROOF_ONE_MATCH');
  assert.equal(result.CARDINALITY.EXACT_MATCHING_JOB_COUNT, 1);
  assertZeroMutation(result);
});

test('a missing owner marker blocks before any Firestore read', () => {
  const { result, queryIndex } = runScenario({ config: readConfiguration('WRONG_MARKER') });
  assert.equal(queryIndex, 0);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_OWNER_APPROVAL_MARKER_INVALID');
  assert.equal(result.CONFIGURATION.OWNER_APPROVAL_MARKER_VALID, 'NO');
  assertZeroMutation(result);
});

test('a missing commit plan blocks before the exact composite query', () => {
  const { result, queryIndex } = runScenario({ direct: exactJob({ commitPlan: null }) });
  assert.equal(queryIndex, 1);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_COMMIT_PLAN_OR_SOURCE_THREAD_IDENTITY_UNAVAILABLE');
  assert.equal(result.CARDINALITY.READ_OUTCOME_UNKNOWN, 'YES');
  assertZeroMutation(result);
});

test('a missing persisted source-thread identity blocks before the exact composite query', () => {
  const { result, queryIndex } = runScenario({ direct: exactJob({ sourceThreadHash: '' }) });
  assert.equal(queryIndex, 1);
  assert.equal(result.FINAL_STATUS, 'BLOCKED_COMMIT_PLAN_OR_SOURCE_THREAD_IDENTITY_UNAVAILABLE');
  assertZeroMutation(result);
});

test('a query result that exceeds the limit is blocked as a bounded-response violation', () => {
  const { result } = runScenario({ exactCandidates: [exactJob(), exactJob(), exactJob()] });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_FIRESTORE_EXACT_IDENTITY_QUERY_FAILED');
  assert.equal(result.QUERY.QUERY_ERROR_STATUS, 'FIRESTORE_QUERY_RESPONSE_BOUND_VIOLATION');
  assertZeroMutation(result);
});

test('a Firestore index precondition is sanitized and blocks exact cardinality', () => {
  const error = new Error('request failed');
  error.code = 'FIRESTORE_HTTP_400';
  error.firestoreErrorStatus = 'FAILED_PRECONDITION';
  const { result } = runScenario({ queryError: { index: 2, error } });
  assert.equal(result.FINAL_STATUS, 'BLOCKED_FIRESTORE_EXACT_IDENTITY_QUERY_FAILED');
  assert.equal(result.QUERY.INDEX_STATUS, 'INDEX_REQUIRED_OR_UNAVAILABLE');
  assert.equal(result.QUERY.QUERY_ERROR_STATUS, 'FIRESTORE_HTTP_400');
  assertZeroMutation(result);
});

test('production reader decodes GET and bounded runQuery without exposing the authorization secret', () => {
  const calls = [];
  const response = (status, payload) => ({ getResponseCode: () => status, getContentText: () => JSON.stringify(payload) });
  const firestoreDocument = {
    fields: {
      jobId: { stringValue: expectedJobId },
      commitPlan: { mapValue: { fields: { expectedLineCount: { integerValue: '1' } } } }
    }
  };
  const reader = gas.call('createD7E4A1ProductionFirestoreReadOnly_', {
    getOAuthToken: () => 'synthetic-auth-secret',
    fetch: (url, params) => {
      calls.push({ url, params });
      return calls.length === 1 ? response(200, firestoreDocument) : response(200, [{ document: firestoreDocument }]);
    }
  });
  const document = fromVm(reader.getDocument('invoiceJobs/d7e_job_safe'));
  const rows = fromVm(reader.queryDocuments({ collectionId: 'invoiceJobs', filters: [{ fieldPath: 'jobId', value: 'd7e_job_safe' }], limit: 2 }));
  assert.equal(document.jobId, expectedJobId);
  assert.equal(rows.length, 1);
  assert.equal(calls[0].params.method, 'get');
  assert.equal(calls[1].params.method, 'post');
  assert.match(calls[1].url, /documents:runQuery$/);
  assert.equal(calls[0].params.headers.Authorization.startsWith('Bearer '), true);
  assert.equal(source.includes('synthetic-auth-secret'), false);
});

test('source remains read-only apart from the Firestore runQuery transport method', () => {
  for (const forbidden of [
    /\.setProperty\s*\(/,
    /\.deleteProperty\s*\(/,
    /createDocument\s*\(/,
    /updateDocument\s*\(/,
    /deleteDocument\s*\(/,
    /runTransaction\s*\(/,
    /runD7EOwnerApprovedOneCandidateProductionPilot\s*\(/,
    /runD6jCOneRecordProductionMutation\s*\(/,
    /GmailApp\./,
    /DriveApp\./,
    /SpreadsheetApp\./
  ]) assert.equal(forbidden.test(source), false, forbidden.toString());
  assert.match(source, /documents:runQuery/);
  assert.match(source, /limit: D7_E4A1_QUERY_LIMIT_/);
});
