import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['durableScannerShadowBridge.js', 'gmailScanner.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['durableScannerShadowBridge.js'],
  exportNames: [
    'SGDS_DURABLE_SHADOW_DEFAULTS_',
    'SGDS_DURABLE_SHADOW_WIRING_POINT_',
    'createDurableScannerShadowBridge',
    'resolveDurableShadowConfig_',
    'buildDurableShadowCandidateFromScannerContext_',
    'maybeEvaluateDurableScannerShadow_'
  ]
});

function attachment(name) {
  return { getName: () => name };
}

function context(overrides = {}) {
  return {
    sourceType: 'GMAIL',
    direction: 'IN',
    thread: { getId: () => 'raw-thread-id-only-used-in-memory' },
    attachments: [attachment('invoice.xml'), attachment('invoice.pdf')],
    ...overrides
  };
}

test('D5O bridge metadata and default feature gate', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.SGDS_DURABLE_SHADOW_WIRING_POINT_, 'AFTER_CANDIDATE_DETECTED_BEFORE_CANONICAL_EFFECTS');
  const defaults = JSON.parse(JSON.stringify(gas.exports.SGDS_DURABLE_SHADOW_DEFAULTS_));
  assert.equal(defaults.SGDS_DURABLE_SHADOW_ENABLED, false);
  assert.equal(defaults.SGDS_DURABLE_SHADOW_MAX_CANDIDATES, 1);
  assert.equal(defaults.SGDS_DURABLE_SHADOW_CANONICAL_WRITES, false);
  assert.equal(defaults.SGDS_DURABLE_SHADOW_GMAIL_MUTATIONS, false);
  assert.equal(defaults.SGDS_DURABLE_SHADOW_DRIVE_MUTATIONS, false);
});

test('D5O feature disabled preserves legacy scanner path and makes no durable call', () => {
  const bridge = gas.exports.createDurableScannerShadowBridge({});
  const decision = bridge.evaluateScannerCandidate(context());
  assert.equal(decision.status, 'DURABLE_SHADOW_DISABLED');
  assert.equal(decision.canonicalProcessingAllowed, true);
  assert.equal(decision.durableCallCount, 0);
  assert.equal(decision.googleSheetsMutation, 'NONE');
  assert.equal(decision.gmailLabelMutation, 'NONE');
  assert.equal(decision.googleDriveMutation, 'NONE');
});

test('D5O enabled bridge builds sanitized deterministic candidate and invokes one durable call', async () => {
  const calls = [];
  const bridge = gas.exports.createDurableScannerShadowBridge({
    env: { SGDS_DURABLE_SHADOW_ENABLED: 'true', SGDS_DURABLE_SHADOW_MAX_CANDIDATES: '1' },
    shadowRunner: {
      async evaluateShadowCandidate(candidate) {
        calls.push(JSON.parse(JSON.stringify(candidate)));
        return { status: 'SHADOW_READY', jobId: `job_${candidate.sourceReferenceHash}`, mutationAttemptCount: 0 };
      }
    }
  });
  const first = await bridge.evaluateScannerCandidate(context());
  assert.equal(first.status, 'DURABLE_SHADOW_READY');
  assert.equal(first.canonicalProcessingAllowed, true);
  assert.equal(first.durableCallCount, 1);
  assert.equal(first.mutationAttemptCount, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceType, 'GMAIL');
  assert.equal(calls[0].safeMetadata.rawReferenceCaptured, false);
  assert.equal(calls[0].attachmentSummary.xmlCount, 1);
  assert.equal(calls[0].attachmentSummary.pdfCount, 1);
  assert.equal(JSON.stringify(calls[0]).includes('raw-thread-id-only-used-in-memory'), false);

  const second = await bridge.evaluateScannerCandidate(context());
  assert.equal(second.status, 'DURABLE_SHADOW_MAX_CANDIDATES_REACHED');
  assert.equal(second.canonicalProcessingAllowed, false);
  assert.equal(second.durableCallCount, 0);
});

test('D5O enabled bridge fails closed before canonical effects for missing runtime, mutation gates, and runner failure', async () => {
  const missing = gas.exports.createDurableScannerShadowBridge({
    env: { SGDS_DURABLE_SHADOW_ENABLED: 'true' }
  }).evaluateScannerCandidate(context());
  assert.equal(missing.status, 'DURABLE_SHADOW_RUNTIME_NOT_CONFIGURED');
  assert.equal(missing.canonicalProcessingAllowed, false);

  const mutationGate = gas.exports.createDurableScannerShadowBridge({
    env: { SGDS_DURABLE_SHADOW_ENABLED: 'true', SGDS_DURABLE_SHADOW_CANONICAL_WRITES: 'true' },
    shadowRunner: { evaluateShadowCandidate: () => ({ status: 'SHADOW_READY' }) }
  }).evaluateScannerCandidate(context());
  assert.equal(mutationGate.status, 'DURABLE_SHADOW_MUTATION_GATE_REJECTED');
  assert.equal(mutationGate.canonicalProcessingAllowed, false);

  const failure = await gas.exports.createDurableScannerShadowBridge({
    env: { SGDS_DURABLE_SHADOW_ENABLED: 'true' },
    shadowRunner: {
      evaluateShadowCandidate() {
        const error = new Error('firestore unavailable');
        error.code = 'FIRESTORE_UNAVAILABLE';
        throw error;
      }
    }
  }).evaluateScannerCandidate(context());
  assert.equal(failure.status, 'DURABLE_SHADOW_FAILED_CANONICAL_BLOCKED');
  assert.equal(failure.canonicalProcessingAllowed, false);
});

test('D5O scanner source is wired before canonical side effects while default remains false', () => {
  const source = fs.readFileSync('gmailScanner.js', 'utf8');
  assert.match(source, /maybeEvaluateDurableScannerShadow_\(\{[\s\S]*direction: "OUT"[\s\S]*processInvoiceAllXMLAttachments_/);
  assert.match(source, /maybeEvaluateDurableScannerShadow_\(\{[\s\S]*direction: "IN"[\s\S]*processInvoiceAllXMLAttachments_/);
  assert.equal(source.indexOf('maybeEvaluateDurableScannerShadow_'), source.lastIndexOf('maybeEvaluateDurableScannerShadow_', source.indexOf('processInvoiceAllXMLAttachments_')));

  const bridgeSource = fs.readFileSync('durableScannerShadowBridge.js', 'utf8');
  for (const forbidden of ['SpreadsheetApp', 'DriveApp.createFile', 'GmailApp.search', 'addLabel(', 'removeLabel(', 'commitPreparedInvoiceRows_']) {
    assert.equal(bridgeSource.includes(forbidden), false, `forbidden bridge token present: ${forbidden}`);
  }
});
