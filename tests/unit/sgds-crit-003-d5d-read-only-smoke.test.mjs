import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { createD5CReadOnlyFixtures } from '../../fixtures/production-read-only-snapshots/fake-production-read-only-snapshots.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['sgdsCrit003D5dReadOnlySmoke.js', 'productionReadOnlySnapshotAdapters.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const D5D_TEST_SCENARIOS = Object.freeze([
  'all exact references present',
  'one reference missing',
  'invalid expected line count',
  'invalid expected hashes JSON',
  'Gmail read success',
  'Drive XML/PDF read success',
  'Hoa-Don exact row found',
  'two ledger rows found',
  'duplicate Drive evidence detected',
  'duplicate Hoa-Don row detected',
  'duplicate ledger line detected',
  'saved-label mismatch detected',
  'before/after snapshot unchanged',
  'concurrent external change detected',
  'reader exception sanitized',
  'raw IDs absent from logs',
  'PII absent from logs',
  'zero mutation calls',
  'zero Firestore writes'
]);

const gas = loadGasSource({
  files: [
    'durableReconciliation.js',
    'productionReadOnlySnapshotAdapters.js',
    'sgdsCrit003D5dReadOnlySmoke.js'
  ],
  exportNames: [
    'createSgdsCrit003D5dReadOnlySmokeExecutor',
    'createProductionReadOnlySnapshotAdapters',
    'reconcileDurableInvoiceJobReportOnly',
    'SGDS_CRIT_003_D5D_MODE_',
    'SGDS_CRIT_003_D5D_PROPERTY_KEYS_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));

function makeProperties(overrides = {}) {
  return {
    SGDS_D5D_GMAIL_THREAD_ID: 'RAW_GMAIL_THREAD_ID_SHOULD_NOT_LEAK_D5C',
    SGDS_D5D_XML_FILE_ID: 'RAW_XML_FILE_ID_SHOULD_NOT_LEAK_D5C',
    SGDS_D5D_PDF_FILE_ID: 'RAW_PDF_FILE_ID_SHOULD_NOT_LEAK_D5C',
    SGDS_D5D_INVOICE_IDENTITY_HASH: 'syntheticInvoiceIdentityHashD5D',
    SGDS_D5D_EXPECTED_LINE_COUNT: '2',
    SGDS_D5D_EXPECTED_LINE_HASHES_JSON: JSON.stringify(['synthetic-d5c-line-hash-1', 'synthetic-d5c-line-hash-2']),
    SGDS_D5D_EXPECTED_INVOICE_KEY_HASH: 'syntheticInvoiceKeyHashD5D',
    SGDS_D5D_EXPECTED_COMMIT_PLAN_HASH: 'syntheticCommitPlanHashD5D',
    ...overrides
  };
}

function makeHarness(options = {}) {
  const fixtures = createD5CReadOnlyFixtures(options.fixtures || {});
  const properties = makeProperties(options.properties || {});
  const logs = [];
  const propertyReader = {
    getProperty(key) {
      return Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : '';
    }
  };
  const executor = gas.call('createSgdsCrit003D5dReadOnlySmokeExecutor', {
    propertyReader,
    gmailReader: fixtures.gmailReader,
    driveReader: fixtures.driveReader,
    sheetsReader: fixtures.sheetsReader,
    identityHasher: fixtures.identityHasher,
    clock: fixtures.clock,
    logger: { log: line => logs.push(String(line)) },
    reconciliationService: { reconcileDurableInvoiceJobReportOnly: gas.exports.reconcileDurableInvoiceJobReportOnly },
    adapterFactory: options.adapterFactory || gas.exports.createProductionReadOnlySnapshotAdapters,
    limits: options.limits || {}
  });
  return { executor, fixtures, properties, logs };
}

test('metadata', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(D5D_TEST_SCENARIOS.length, 19);
});

test('D5D blocks before production reads when exact reference config is missing or invalid', async () => {
  const missing = makeHarness({ properties: { SGDS_D5D_GMAIL_THREAD_ID: '' } });
  const missingResult = fromVm(await missing.executor.run());
  assert.equal(missingResult.SGDS_CRIT_003_D5D_SMOKE_STATUS, 'BLOCKED_EXACT_REFERENCE_CONFIG_MISSING');
  assert.equal(missingResult.PRODUCTION_API_READ_STARTED, 'NO');
  assert.equal(missing.fixtures.calls.length, 0);

  const badCount = makeHarness({ properties: { SGDS_D5D_EXPECTED_LINE_COUNT: 'x' } });
  const badCountResult = fromVm(await badCount.executor.run());
  assert.equal(badCountResult.FINDING_CODES.includes('INVALID_EXPECTED_LINE_COUNT'), true);

  const badHashes = makeHarness({ properties: { SGDS_D5D_EXPECTED_LINE_HASHES_JSON: '{bad' } });
  const badHashesResult = fromVm(await badHashes.executor.run());
  assert.equal(badHashesResult.FINDING_CODES.includes('INVALID_EXPECTED_LINE_HASHES_JSON'), true);
});

test('D5D all exact references present returns consistent read-only smoke with safe markers', async () => {
  const harness = makeHarness();
  const result = fromVm(await harness.executor.run());
  assert.equal(result.SGDS_CRIT_003_D5D_SMOKE_STATUS, 'PASS_PRODUCTION_READ_ONLY_CONSISTENT');
  assert.equal(result.GMAIL_READ_STATUS, 'READ_OK');
  assert.equal(result.DRIVE_XML_READ_STATUS, 'READ_OK');
  assert.equal(result.DRIVE_PDF_READ_STATUS, 'READ_OK');
  assert.equal(result.HOA_DON_READ_STATUS, 'READ_OK');
  assert.equal(result.LEDGER_READ_STATUS, 'READ_OK');
  assert.equal(result.EXPECTED_LEDGER_LINE_COUNT, 2);
  assert.equal(result.LEDGER_MATCH_COUNT, 2);
  assert.equal(result.HOA_DON_MATCH_COUNT, 1);
  assert.equal(result.DRIVE_ARTIFACT_COUNT, 2);
  assert.equal(result.RECONCILIATION_STATUS, 'CONSISTENT');
  assert.equal(result.BLOCKER_COUNT, 0);
  assert.equal(result.BEFORE_AFTER_SNAPSHOT_MATCH, 'YES');
  assert.equal(result.MUTATION_ATTEMPT_COUNT, 0);
  assert.equal(result.PRODUCTION_WRITE, 'NONE');
});

test('D5D detects duplicate Drive, Hoa-Don, ledger, and saved-label findings without mutation', async () => {
  const duplicateDrive = makeHarness({ fixtures: { duplicateCandidateCount: 9 }, limits: { MAX_DRIVE_DUPLICATE_CANDIDATES: 1 } });
  const duplicateDriveResult = fromVm(await duplicateDrive.executor.run());
  assert.equal(duplicateDriveResult.SGDS_CRIT_003_D5D_SMOKE_STATUS, 'PASS_READ_ONLY_FINDINGS_DETECTED');
  assert.equal(duplicateDriveResult.DRIVE_XML_READ_STATUS, 'READ_OK');

  const duplicateHoaDonFixture = createD5CReadOnlyFixtures();
  const duplicateHoaDon = makeHarness({
    fixtures: {
      hoaDonRows: [
        duplicateHoaDonFixture.input.commitPlan.hoaDonRegistryTarget,
        duplicateHoaDonFixture.input.commitPlan.hoaDonRegistryTarget
      ]
    }
  });
  const duplicateHoaDonResult = fromVm(await duplicateHoaDon.executor.run());
  assert.equal(duplicateHoaDonResult.FINDING_CODES.includes('HOA_DON_ROW_DUPLICATE'), true);

  const duplicateLedger = makeHarness({
    fixtures: {
      ledgerRows: [
        { legacyInvoiceKey: '', invoiceKeyV2: '', legacyHashIndex: 'synthetic-d5c-line-hash-1', lineIdentityV2: 'synthetic-d5c-line-hash-1' },
        { legacyInvoiceKey: '', invoiceKeyV2: '', legacyHashIndex: 'synthetic-d5c-line-hash-2', lineIdentityV2: 'synthetic-d5c-line-hash-1' }
      ]
    }
  });
  const duplicateLedgerResult = fromVm(await duplicateLedger.executor.run());
  assert.equal(duplicateLedgerResult.FINDING_CODES.includes('LEDGER_DUPLICATE_LINE_IDENTITY'), true);

  const missingSaved = makeHarness({ fixtures: { gmailLabels: [] } });
  const missingSavedResult = fromVm(await missingSaved.executor.run());
  assert.equal(missingSavedResult.FINDING_CODES.includes('GMAIL_SAVED_LABEL_MISSING'), true);
});

test('D5D detects before/after concurrent external change', async () => {
  const harness = makeHarness({
    adapterFactory: (() => {
      let calls = 0;
      return function changingAdapterFactory(options) {
        const adapters = gas.exports.createProductionReadOnlySnapshotAdapters(options);
        return {
          ...adapters,
          async readLedgerSnapshot(input) {
            calls += 1;
            const snapshot = await adapters.readLedgerSnapshot(input);
            if (calls > 1) snapshot.matchCount += 1;
            return snapshot;
          }
        };
      };
    })()
  });
  const result = fromVm(await harness.executor.run());
  assert.equal(result.SGDS_CRIT_003_D5D_SMOKE_STATUS, 'REVIEW_REQUIRED_CONCURRENT_EXTERNAL_CHANGE');
  assert.equal(result.BEFORE_AFTER_SNAPSHOT_MATCH, 'NO');
});

test('D5D sanitizes reader exceptions and never emits raw IDs or PII in logs', async () => {
  const harness = makeHarness({ fixtures: { failures: { GMAIL_READ: 'RAW_SECRET_SHOULD_NOT_LEAK' } } });
  const result = fromVm(await harness.executor.run());
  assert.equal(result.GMAIL_READ_STATUS, 'READ_FAILED');
  const output = harness.logs.join('\n') + JSON.stringify(result);
  assert.equal(output.includes('RAW_GMAIL_THREAD_ID_SHOULD_NOT_LEAK_D5C'), false);
  assert.equal(output.includes('RAW_XML_FILE_ID_SHOULD_NOT_LEAK_D5C'), false);
  assert.equal(output.includes('RAW_PDF_FILE_ID_SHOULD_NOT_LEAK_D5C'), false);
  assert.equal(output.includes('0100000001'), false);
  assert.equal(output.includes('C26THD8'), false);
});

test('D5D records zero mutation calls, zero Firestore writes, and no scanner wiring', async () => {
  const harness = makeHarness();
  await harness.executor.run();
  assert.equal(harness.fixtures.mutationCalls.length, 0);
  assert.equal(harness.fixtures.networkCalls.length, 0);

  const source = fs.readFileSync('sgdsCrit003D5dReadOnlySmoke.js', 'utf8');
  assert.equal(source.includes('createDurableInvoiceOrchestrator'), false);
  assert.equal(source.includes('createDurableScannerShadowRunner'), false);
  for (const file of ['main.js', 'gmailScanner.js', '_triggerDriveScanner.js', 'gmailProcessInvoiceXML.js']) {
    const text = fs.readFileSync(file, 'utf8');
    assert.equal(text.includes('runSgdsCrit003D5dProductionReadOnlyShadowSmoke'), false);
  }
});
