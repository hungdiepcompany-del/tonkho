import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { createFakeFirestoreTransport } from '../../fixtures/sgds-crit-003-d2/firestore-adapter-fixtures.mjs';
import {
  createD5AClock,
  createD5AFakeAdapters,
  createD5AInvoice,
  D5A_FAULT_INJECTION_CASES,
  D5A_TEST_SCENARIOS
} from '../../fixtures/durable-orchestration/fake-durable-orchestration.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['durableJobState.js', 'firestoreDurableJobStore.js', 'durableReconciliation.js', 'durableInvoiceOrchestrator.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

const gas = loadGasSource({
  files: [
    'durableJobState.js',
    'durableReconciliation.js',
    'firestoreDurableJobStore.js',
    'durableInvoiceOrchestrator.js'
  ],
  exportNames: [
    'createDurableInvoiceJobStore',
    'createDurableInvoiceOrchestrator',
    'reconcileDurableInvoiceJobReportOnly',
    'D5A_LOCAL_ONLY',
    'D5A_STEP_RESULT_STATUSES_',
    'D5A_EXECUTION_ORDER_'
  ]
});

function makeHarness(options = {}) {
  const transport = options.transport || createFakeFirestoreTransport(options.transportOptions || {});
  const clock = options.clock || createD5AClock();
  const store = gas.call('createDurableInvoiceJobStore', transport, { clock });
  const adapters = createD5AFakeAdapters(options.adapters || {});
  const reconciliationService = {
    reconcileDurableInvoiceJobReportOnly: gas.exports.reconcileDurableInvoiceJobReportOnly
  };
  const jobStore = options.decorateStore ? options.decorateStore(store) : store;
  const orchestrator = gas.call('createDurableInvoiceOrchestrator', {
    jobStore,
    sourceAdapter: adapters.sourceAdapter,
    driveEvidenceAdapter: adapters.driveEvidenceAdapter,
    hoaDonAdapter: adapters.hoaDonAdapter,
    ledgerAdapter: adapters.ledgerAdapter,
    gmailProjectionAdapter: adapters.gmailProjectionAdapter,
    reconciliationService,
    clock
  });
  return { orchestrator, adapters, store: jobStore, rawStore: store, transport, clock };
}

function methodOrder(adapters) {
  return adapters.calls.map(call => call.method);
}

async function runScenario(options = {}) {
  const harness = makeHarness(options);
  const input = options.input || harness.adapters.sourceInput;
  const result = fromVm(await harness.orchestrator.executeDurableInvoiceJob(input));
  return { ...harness, result };
}

function assertNoDuplicateExternalWrites(adapters) {
  const mutations = adapters.mutationLog;
  assert.equal(mutations.filter(item => item === 'writeHoaDon').length <= 1, true);
  assert.equal(mutations.filter(item => item === 'writeLedger').length <= 1, true);
  assert.equal(mutations.filter(item => item === 'writeGmail').length <= 1, true);
  assert.equal(mutations.filter(item => item === 'writeDriveXML').length <= 1, true);
  assert.equal(mutations.filter(item => item === 'writeDrivePDF').length <= 1, true);
}

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('D5A exposes local-only orchestrator factory, step-result contract, and required scenario vocabulary', () => {
  assert.equal(gas.exports.D5A_LOCAL_ONLY, true);
  assert.deepEqual(fromVm(gas.exports.D5A_EXECUTION_ORDER_), ['DRIVE_XML', 'DRIVE_PDF', 'HOA_DON', 'LEDGER', 'GMAIL']);
  assert.deepEqual(Object.values(fromVm(gas.exports.D5A_STEP_RESULT_STATUSES_)), [
    'NOT_ATTEMPTED',
    'CONFIRMED_NOT_WRITTEN',
    'CONFIRMED_WRITTEN',
    'ALREADY_PRESENT',
    'OUTCOME_UNKNOWN',
    'CONFLICT',
    'FAILED'
  ]);
  assert.equal(D5A_TEST_SCENARIOS.length, 26);
  assert.equal(D5A_FAULT_INJECTION_CASES.length, 10);
});

test('D5A happy path one-line invoice writes Drive, Hoa-Don, ledger, Gmail in order and completes', async () => {
  const { result, adapters } = await runScenario();
  assert.equal(result.status, 'COMPLETED');
  assert.equal(result.executionOrder, 'DRIVE_XML_DRIVE_PDF_HOA_DON_LEDGER_GMAIL');
  assert.deepEqual(adapters.mutationLog, ['writeDriveXML', 'writeDrivePDF', 'writeHoaDon', 'writeLedger', 'writeGmail']);
  assert.equal(result.auditEvents.includes('JOB_COMPLETED'), true);
  assertNoDuplicateExternalWrites(adapters);
});

test('D5A happy path multi-line invoice persists immutable line identity and hash lists', async () => {
  const { result, adapters } = await runScenario({ adapters: { invoice: { lineCount: 2 } } });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(adapters.state.ledgerRows.length, 2);
  assert.deepEqual(adapters.state.ledgerRows.map(row => row.lineIdentityV2), ['synthetic-line-id-1', 'synthetic-line-id-2']);
  assert.equal(result.finalReport.status, 'CONSISTENT');
});

test('D5A completed job resume and same source resubmission are idempotent no-ops for adapters', async () => {
  const harness = makeHarness();
  const first = fromVm(await harness.orchestrator.executeDurableInvoiceJob(harness.adapters.sourceInput));
  const mutationCountAfterFirst = harness.adapters.mutationLog.length;
  const second = fromVm(await harness.orchestrator.executeDurableInvoiceJob(harness.adapters.sourceInput));
  const resume = fromVm(await harness.orchestrator.resumeDurableInvoiceJob(first.job.jobId));

  assert.equal(first.status, 'COMPLETED');
  assert.equal(second.status, 'ALREADY_COMPLETED');
  assert.equal(resume.status, 'ALREADY_COMPLETED');
  assert.equal(harness.adapters.mutationLog.length, mutationCountAfterFirst);
});

test('D5A Gmail and Drive source snapshots converge to one durable job identity', async () => {
  const harness = makeHarness();
  const gmail = createD5AInvoice({ sourceType: 'GMAIL', sourceLocatorHash: 'gmail-source-a' });
  const drive = createD5AInvoice({ sourceType: 'DRIVE', sourceLocatorHash: 'drive-source-b' });
  const first = fromVm(await harness.orchestrator.executeDurableInvoiceJob(gmail));
  const second = fromVm(await harness.orchestrator.executeDurableInvoiceJob(drive));

  assert.equal(first.status, 'COMPLETED');
  assert.equal(second.status, 'ALREADY_COMPLETED');
  assert.equal(first.job.jobId, second.job.jobId);
});

test('D5A read-before-write prevents duplicate Drive evidence, Hoa-Don rows, and ledger lines', async () => {
  const driveXml = await runScenario({ adapters: { driveXmlExisting: 'matching' } });
  assert.equal(driveXml.result.status, 'COMPLETED');
  assert.equal(driveXml.adapters.mutationLog.includes('writeDriveXML'), false);

  const hoaDon = await runScenario({ adapters: { hoaDonExisting: 'matching' } });
  assert.equal(hoaDon.result.status, 'COMPLETED');
  assert.equal(hoaDon.adapters.mutationLog.includes('writeHoaDon'), false);

  const ledger = await runScenario({ adapters: { ledgerExisting: 'matching' } });
  assert.equal(ledger.result.status, 'COMPLETED');
  assert.equal(ledger.adapters.mutationLog.includes('writeLedger'), false);
});

test('D5A conflicts and unknown outcomes stop the pipeline and hand off to report-only reconciliation', async () => {
  const cases = [
    { name: 'Drive XML existing conflict', adapters: { driveXmlExisting: 'conflict' }, expectMutationAbsent: 'writeDriveXML' },
    { name: 'Drive XML response lost', adapters: { failures: { DRIVE_XML_WRITE: 'OUTCOME_UNKNOWN_AFTER_WRITE' } }, expectedStatus: 'OUTCOME_UNKNOWN' },
    { name: 'Drive PDF write failure', adapters: { failures: { DRIVE_PDF_WRITE: 'FAILED_BEFORE_WRITE' } }, expectedStatus: 'FAILED' },
    { name: 'Hoa-Don duplicate conflict', adapters: { hoaDonExisting: 'conflict' }, expectedCode: 'HOA_DON_ROW_CONFLICT' },
    { name: 'Hoa-Don response lost', adapters: { failures: { HOA_DON_WRITE: 'OUTCOME_UNKNOWN_AFTER_WRITE' } }, expectedStatus: 'OUTCOME_UNKNOWN' },
    { name: 'partial ledger commit', adapters: { partialLedgerCommit: true }, expectedCode: 'LEDGER_PARTIAL_COMMIT' },
    { name: 'ledger response lost', adapters: { failures: { LEDGER_WRITE: 'OUTCOME_UNKNOWN_AFTER_WRITE' } }, expectedStatus: 'OUTCOME_UNKNOWN' },
    { name: 'ledger verification mismatch', adapters: { ledgerVerificationMismatch: true }, expectedCode: 'LEDGER_VERIFY_MISMATCH' },
    { name: 'Gmail false saved label', adapters: { falseSavedLabelBeforeLedger: true }, expectedCode: 'GMAIL_FALSE_SAVED_LABEL' },
    { name: 'Gmail label write failure', adapters: { failures: { GMAIL_WRITE: 'FAILED_BEFORE_WRITE' } }, expectedStatus: 'FAILED' },
    { name: 'Gmail label response lost', adapters: { failures: { GMAIL_WRITE: 'OUTCOME_UNKNOWN_AFTER_WRITE' } }, expectedStatus: 'OUTCOME_UNKNOWN' }
  ];

  for (const item of cases) {
    const { result, adapters } = await runScenario({ adapters: item.adapters });
    assert.equal(result.status, 'RECONCILIATION_REQUIRED', item.name);
    assert.equal(result.report.findings.length > 0, true, item.name);
    assert.equal(result.auditEvents.includes('JOB_COMPLETED'), false, item.name);
    if (item.expectedStatus) assert.equal(result.stepResults.some(step => step.status === item.expectedStatus), true, item.name);
    if (item.expectedCode) assert.equal(result.stepResults.some(step => step.errorCode === item.expectedCode), true, item.name);
    if (item.expectMutationAbsent) assert.equal(adapters.mutationLog.includes(item.expectMutationAbsent), false, item.name);
  }
});

test('D5A saved label is applied last and an already-correct saved label after ledger is idempotent', async () => {
  const { result, adapters } = await runScenario({ adapters: { savedLabelAlreadyCorrect: true } });
  assert.equal(result.status, 'COMPLETED');
  assert.equal(adapters.mutationLog.includes('writeGmail'), false);
  assert.deepEqual(adapters.mutationLog, ['writeDriveXML', 'writeDrivePDF', 'writeHoaDon', 'writeLedger']);
});

test('D5A version conflicts before and after external mutation do not retry mutations blindly', async () => {
  const before = await runScenario({
    decorateStore(store) {
      return {
        ...store,
        async saveCommitPlanIfAbsent() {
          const error = new Error('synthetic version conflict');
          error.code = 'DURABLE_JOB_VERSION_CONFLICT';
          throw error;
        }
      };
    }
  });
  assert.equal(before.result.status, 'DURABLE_JOB_VERSION_CONFLICT');
  assert.equal(before.adapters.mutationLog.length, 0);

  const after = await runScenario({
    decorateStore(store) {
      return {
        ...store,
        async transitionJob(request) {
          if (request.toStatus === 'ROWS_COMMITTED') {
            const error = new Error('synthetic version conflict after ledger');
            error.code = 'DURABLE_JOB_VERSION_CONFLICT';
            throw error;
          }
          return store.transitionJob(request);
        }
      };
    }
  });
  assert.equal(after.result.status, 'RECONCILIATION_REQUIRED');
  assert.equal(after.adapters.mutationLog.includes('writeLedger'), true);
  assert.equal(after.adapters.mutationLog.includes('writeGmail'), false);
});

test('D5A reconciliation-required job cannot auto-resume and completed job cannot transition backward', async () => {
  const recon = await runScenario({ adapters: { driveXmlExisting: 'conflict' } });
  const resume = fromVm(await recon.orchestrator.resumeDurableInvoiceJob(recon.result.job.jobId));
  assert.equal(resume.status, 'RECONCILIATION_REQUIRED_AUTO_RESUME_BLOCKED');

  await assert.rejects(
    recon.rawStore.transitionJob({
      jobId: recon.result.job.jobId,
      expectedVersion: Number(recon.result.job.version),
      fromStatus: 'RECONCILIATION_REQUIRED',
      toStatus: 'COMMITTING'
    }),
    error => error && error.code === 'DURABLE_JOB_TERMINAL_STATE'
  );
});

test('D5A two concurrent orchestration attempts collapse to one job and do not duplicate external writes', async () => {
  const harness = makeHarness();
  const [a, b] = await Promise.all([
    harness.orchestrator.executeDurableInvoiceJob(harness.adapters.sourceInput),
    harness.orchestrator.executeDurableInvoiceJob(harness.adapters.sourceInput)
  ]);
  const statuses = [a.status, b.status].sort();
  assert.equal(statuses.includes('COMPLETED') || statuses.includes('ALREADY_COMPLETED'), true);
  assertNoDuplicateExternalWrites(harness.adapters);
});

test('D5A same local scenario run twice is deterministic and inputs remain immutable', async () => {
  async function scenario() {
    const input = createD5AInvoice({ lineCount: 2 });
    const before = JSON.stringify(input);
    const { result, adapters } = await runScenario({ input, adapters: { invoice: { lineCount: 2 } } });
    assert.equal(JSON.stringify(input), before);
    return {
      status: result.status,
      stepStatuses: result.stepResults.map(step => `${step.stepName}:${step.status}:${step.errorCode || ''}`),
      mutations: adapters.mutationLog,
      calls: methodOrder(adapters)
    };
  }

  assert.deepEqual(await scenario(), await scenario());
});

test('D5A source has no production API access and no scanner entrypoint wiring', () => {
  const source = fs.readFileSync('durableInvoiceOrchestrator.js', 'utf8');
  for (const forbidden of ['GmailApp', 'DriveApp', 'SpreadsheetApp', 'PropertiesService', 'UrlFetchApp', 'firebaseConfig', 'triggerScanInvoiceDriveFolder', 'scanInvoiceOutEmails_', 'scanInvoiceInEmails_', 'mainRun']) {
    assert.equal(source.includes(forbidden), false, `forbidden token present: ${forbidden}`);
  }
});
