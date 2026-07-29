import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import { buildD6kSourceEntrypointInventory } from '../../scripts/analysis/build-d6k-source-entrypoint-inventory.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['Operator_Entrypoints.js', 'd6jCOneRecordProductionMutation.js', 'd6jD4PostRepairVerificationReadOnly.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE',
});

const FROZEN_ENTRYPOINTS = [
  'runD6jCOneRecordProductionMutation',
  'runD6jDRepairSingleMalformedPilotRow',
  'runD6jD4PostRepairVerificationReadOnly',
  'runD6jD4CFirestoreEvidenceDiagnosticsReadOnly',
  'runD6jD4DReconciliationPreviewReadOnly',
  'runD6jD4DRecordPostHocReconciliationEvidenceOnce',
];

const INTERNAL_FACTORIES = [
  'createD6jCOneRecordProductionMutationRunner_',
  'createD6jDNhapXuatSchemaRepairRunner_',
  'createD6jD4PostRepairVerificationReadOnlyRunner_',
  'createD6jD4CFirestoreEvidenceDiagnosticsReadOnlyRunner_',
  'createD6jD4DReconciliationPreviewReadOnlyRunner_',
  'createD6jD4DRecordPostHocReconciliationEvidenceRunner_',
];

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('D6K-D frozen historical wrappers block before runner creation', () => {
  const gas = loadGasSource({
    files: ['Operator_Entrypoints.js', 'd6jBProductionDryRunReadOnly.js', 'd6jCOneRecordProductionMutation.js', 'd6jD4PostRepairVerificationReadOnly.js'],
    exportNames: [...FROZEN_ENTRYPOINTS, ...INTERNAL_FACTORIES, 'getD6kOperatorEntrypointPolicy_'],
    stubs: {},
  });

  for (const name of FROZEN_ENTRYPOINTS) {
    assert.throws(
      () => gas.call(name),
      error => error && error.code === 'HISTORICAL_PHASE_CLOSED_DO_NOT_EXECUTE' && error.entrypointName === name,
      name
    );
  }

  for (const name of INTERNAL_FACTORIES) {
    assert.equal(typeof gas.context[name], 'function', name);
  }
  assert.equal(gas.call('getD6kOperatorEntrypointPolicy_').productionMutationDuringD6K, 'NONE');
});

test('D6K-D wrapper bodies do not call historical runners', () => {
  const combined = fs.readFileSync('d6jCOneRecordProductionMutation.js', 'utf8') + '\n' + fs.readFileSync('d6jD4PostRepairVerificationReadOnly.js', 'utf8');
  for (const name of FROZEN_ENTRYPOINTS) {
    const match = combined.match(new RegExp('function\\s+' + name + '\\(\\)\\s*\\{([\\s\\S]*?)\\n\\}'));
    assert.ok(match, name);
    assert.match(match[1], /blockD6kHistoricalPhaseEntrypoint_/);
    assert.doesNotMatch(match[1], /createD6j.*Runner_\(\)/);
  }
});
test('D6K-D inventory remains collision-free and frozen names are still visible wrappers', () => {
  const inventory = buildD6kSourceEntrypointInventory({ root: process.cwd() });
  assert.equal(inventory.metrics.globalNameCollisionCount, 0);
  assert.equal(inventory.metrics.unknownRequiresReviewCount, 0);
  for (const name of FROZEN_ENTRYPOINTS) {
    const item = inventory.functions.find(fn => fn.name === name);
    assert.ok(item, name);
    assert.equal(item.classification, 'HISTORICAL_PHASE_ENTRYPOINT');
    assert.equal(item.frozenDoNotExecute, true);
  }
});
