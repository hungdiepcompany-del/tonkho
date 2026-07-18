import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
import {
  classifyD6jADeploymentGap,
  classifyD6jALiveBaseline,
  createD6jAPilotManifestTemplate,
  evaluateD6jAPilotCandidate,
  getD6jALimitedProductionPilotContract,
  redactD6jAPrivateIdentifiers,
  validateD6jAOwnerMarkerSeparation,
  validateD6jAPilotManifest
} from '../../d6jPilotReadiness.js';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'd6jPilotReadiness.js',
    'docs/templates/D6J_A_PILOT_MANIFEST_TEMPLATE.json',
    'fixtures/d6j-a/pilot-readiness-fixtures.json'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const fixtures = JSON.parse(fs.readFileSync('fixtures/d6j-a/pilot-readiness-fixtures.json', 'utf8'));
const template = JSON.parse(fs.readFileSync('docs/templates/D6J_A_PILOT_MANIFEST_TEMPLATE.json', 'utf8'));

test('D6J-A contract keeps Apps Script first, no Billing, and separate owner markers', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  const contract = getD6jALimitedProductionPilotContract();
  assert.equal(contract.phase, 'D6J_A_LIMITED_PRODUCTION_PILOT_READINESS');
  assert.equal(contract.runtimeStrategy, 'APPS_SCRIPT_FIRST_NO_BILLING');
  assert.equal(contract.primaryWorker, 'GOOGLE_APPS_SCRIPT');
  assert.equal(contract.cloudRunStatus, 'DEFERRED_OPTIONAL');
  assert.deepEqual(contract.ownerMarkers, [
    'OWNER_APPROVED_D6J_REQUIRED_DEPLOYMENTS',
    'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN',
    'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION',
    'OWNER_APPROVED_D6J_PILOT_ROLLBACK'
  ]);
  assert.deepEqual(Object.values(contract.productionMutationCounts), [0, 0, 0, 0, 0, 0]);
  assert.equal(validateD6jAOwnerMarkerSeparation(contract.ownerMarkers).ok, true);
});

test('pilot manifest schema and committed template enforce one-record dry-run-first policy', () => {
  for (const manifest of [createD6jAPilotManifestTemplate(), template]) {
    assert.equal(validateD6jAPilotManifest(manifest).status, 'PASS_D6J_A_MANIFEST_VALID');
    assert.equal(manifest.gmail.queryShape.maxResults, 1);
    assert.equal(manifest.gmail.queryShape.hasAttachment, true);
    assert.equal(manifest.drive.maximumFilesCreated, 1);
    assert.equal(manifest.sheets.maximumInsertedRows, 1);
    assert.equal(manifest.sheets.maximumUpdatedRows, 0);
    assert.equal(manifest.dryRun.required, true);
    assert.equal(manifest.dryRun.mutationAfterDryRunAutomatic, false);
  }
});

test('candidate limit enforcement blocks non-exact message, attachment, mutation and destructive cases', () => {
  assert.equal(evaluateD6jAPilotCandidate(fixtures.validCandidate).ok, true);
  for (const item of fixtures.invalidCandidates) {
    const result = evaluateD6jAPilotCandidate(item.candidate);
    assert.equal(result.ok, false, item.name);
    assert.equal(result.blockingCodes.includes(item.code), true, item.code);
  }
});

test('deployment gap classification separates required deployment, optional UI, and Billing blocker', () => {
  const result = classifyD6jADeploymentGap(fixtures.deploymentGap);
  assert.equal(result.ok, true);
  assert.equal(result.required.includes('CLASP_PUSH'), true);
  assert.equal(result.required.includes('FIRESTORE_RULES_DEPLOY'), true);
  assert.equal(result.required.includes('FIRESTORE_INDEX_DEPLOY'), true);
  assert.equal(result.required.includes('AUTHORIZED_USER_PROVISIONING'), true);
  assert.equal(result.cloudRunStatus, 'DEFERRED_OPTIONAL');
  assert.deepEqual(classifyD6jADeploymentGap({ billingRequired: true }).blockers, ['D6J_A_BILLING_REQUIRED_NOT_ALLOWED']);
});

test('readiness requires owner input for exact Gmail, Drive and Sheets resources', () => {
  const classified = classifyD6jALiveBaseline(fixtures.liveBaselineClassification);
  assert.equal(classified.status, 'OWNER_INPUT_REQUIRED');
  assert.deepEqual(classified.missing, ['PILOT_EMAIL_SELECTION', 'DRIVE_ROOT_FOLDER', 'PRODUCTION_SHEET_TARGET']);
  assert.equal(classified.mutationCountsZero, true);
});

test('rollback, idempotency and reconciliation evidence remain mandatory and ownership-scoped', () => {
  const manifest = createD6jAPilotManifestTemplate();
  assert.equal(manifest.rollbackPlan.deletePreExistingData, false);
  assert.equal(manifest.rollbackPlan.requirePilotOwnershipProof, true);
  assert.equal(manifest.idempotencyVerificationPlan.duplicateDriveFile, false);
  assert.equal(manifest.idempotencyVerificationPlan.duplicateSheetRow, false);
  assert.equal(manifest.idempotencyVerificationPlan.duplicateActiveJob, false);
  assert.equal(manifest.reconciliationRequirements.requirePilotId, true);
  assert.equal(manifest.reconciliationRequirements.requireCorrelationId, true);
  assert.equal(manifest.reconciliationRequirements.traceAuditEvent, true);
});

test('private identifier redaction preserves owner placeholders but removes raw identifier-shaped values', () => {
  const redacted = redactD6jAPrivateIdentifiers({
    placeholder: '<OWNER_CONFIRMED_GMAIL_MESSAGE_ID>',
    rawDriveLikeId: '1abcdefghijklmnopqrstuvwxyz123456',
    nested: ['abcdefabcdefabcdefabcdef']
  });
  assert.equal(redacted.placeholder, '<OWNER_CONFIRMED_GMAIL_MESSAGE_ID>');
  assert.equal(redacted.rawDriveLikeId, 'REDACTED_PRIVATE_IDENTIFIER');
  assert.deepEqual(redacted.nested, ['REDACTED_PRIVATE_IDENTIFIER']);
});

test('fixtures remain synthetic and local-only', () => {
  assert.equal(fixtures.fixturePolicy.syntheticOnly, true);
  assert.equal(fixtures.fixturePolicy.liveFirebase, false);
  assert.equal(fixtures.fixturePolicy.liveWorkspaceApis, false);
  assert.equal(fixtures.fixturePolicy.productionFirestoreMutation, false);
  assert.equal(fixtures.fixturePolicy.privateIdentifiers, false);
});
