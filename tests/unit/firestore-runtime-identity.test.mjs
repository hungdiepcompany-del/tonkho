import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['firestoreRuntimeIdentity.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['firestoreRuntimeIdentity.js'],
  exportNames: [
    'SGDS_FIRESTORE_RUNTIME_MODES_',
    'SGDS_FIRESTORE_REQUIRED_ENV_NAMES_',
    'createFirestoreRuntimeCredentialProvider',
    'validateFirestoreRuntimeIdentityConfig',
    'assertFirestoreRuntimePrincipal'
  ]
});

function env(overrides = {}) {
  return {
    SGDS_FIRESTORE_PROJECT_ID: 'tonkhohd',
    SGDS_FIRESTORE_DATABASE_ID: '(default)',
    SGDS_FIRESTORE_RUNTIME_MODE: 'dedicated-service-account',
    SGDS_FIRESTORE_EXPECTED_PRINCIPAL: 'sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com',
    ...overrides
  };
}

test('D5M runtime identity metadata and required env contract', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.deepEqual(JSON.parse(JSON.stringify(gas.exports.SGDS_FIRESTORE_REQUIRED_ENV_NAMES_)), [
    'SGDS_FIRESTORE_PROJECT_ID',
    'SGDS_FIRESTORE_DATABASE_ID',
    'SGDS_FIRESTORE_RUNTIME_MODE',
    'SGDS_FIRESTORE_EXPECTED_PRINCIPAL'
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(gas.exports.SGDS_FIRESTORE_RUNTIME_MODES_)), [
    'emulator',
    'manual-owner-smoke',
    'service-account-impersonation',
    'attached-workload-identity',
    'dedicated-service-account'
  ]);
});

test('D5M runtime identity rejects missing env, key file mode, unsupported modes, Long Thai, and owner automation principal', () => {
  assert.throws(() => gas.exports.validateFirestoreRuntimeIdentityConfig(env({ SGDS_FIRESTORE_PROJECT_ID: '' })), /FIRESTORE_RUNTIME_ENV_REQUIRED/);
  assert.throws(() => gas.exports.validateFirestoreRuntimeIdentityConfig(env({ GOOGLE_APPLICATION_CREDENTIALS: 'C:/tmp/service-account.json' })), /FIRESTORE_RUNTIME_KEY_FILE_FORBIDDEN/);
  assert.throws(() => gas.exports.validateFirestoreRuntimeIdentityConfig(env({ SGDS_FIRESTORE_RUNTIME_MODE: 'service-account-key' })), /FIRESTORE_RUNTIME_MODE_UNSUPPORTED/);
  assert.throws(() => gas.exports.validateFirestoreRuntimeIdentityConfig(env({ SGDS_FIRESTORE_EXPECTED_PRINCIPAL: 'hung.pham@longthaisteel.com' })), /FIRESTORE_RUNTIME_PRINCIPAL_FORBIDDEN/);
  assert.throws(() => gas.exports.validateFirestoreRuntimeIdentityConfig(env({ SGDS_FIRESTORE_EXPECTED_PRINCIPAL: 'hungdiepcompany@gmail.com' })), /FIRESTORE_AUTOMATION_SA_REQUIRED|FIRESTORE_OWNER_PRINCIPAL_USED_FOR_AUTOMATION/);
});

test('D5M manual owner smoke is explicit and non-production', () => {
  assert.throws(() => gas.exports.validateFirestoreRuntimeIdentityConfig(env({
    SGDS_FIRESTORE_RUNTIME_MODE: 'manual-owner-smoke',
    SGDS_FIRESTORE_EXPECTED_PRINCIPAL: 'hungdiepcompany@gmail.com'
  })), /FIRESTORE_MANUAL_OWNER_SMOKE_FLAG_REQUIRED/);
  const config = JSON.parse(JSON.stringify(gas.exports.validateFirestoreRuntimeIdentityConfig(env({
    SGDS_FIRESTORE_RUNTIME_MODE: 'manual-owner-smoke',
    SGDS_FIRESTORE_EXPECTED_PRINCIPAL: 'hungdiepcompany@gmail.com',
    SGDS_FIRESTORE_ALLOW_MANUAL_OWNER_SMOKE: 'true'
  }))));
  assert.equal(config.manualOwnerSmoke, true);
  assert.equal(config.productionAutomation, false);
  assert.equal(config.keyFileCredential, 'ABSENT');
});

test('D5M provider verifies actual dedicated service account principal without returning token material', async () => {
  const provider = gas.exports.createFirestoreRuntimeCredentialProvider({
    env: env(),
    actualPrincipalResolver: () => 'sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com',
    tokenProvider: () => 'short-lived-token-not-returned'
  });
  const inspection = await provider.inspectPrincipal();
  assert.equal(inspection.actualPrincipal, 'sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com');
  assert.equal(inspection.keyless, true);
  assert.equal(inspection.productionAutomation, true);
  const token = await provider.getAccessToken();
  assert.equal(token.accessTokenAvailable, true);
  assert.equal(token.tokenMaterialReturned, false);

  const mismatch = gas.exports.createFirestoreRuntimeCredentialProvider({
    env: env(),
    actualPrincipalResolver: () => 'hungdiepcompany@gmail.com'
  });
  await assert.rejects(() => mismatch.inspectPrincipal(), /FIRESTORE_RUNTIME_PRINCIPAL_MISMATCH/);
});
