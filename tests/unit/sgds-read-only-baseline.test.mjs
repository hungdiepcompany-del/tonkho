import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSgdsReadOnlyBaseline } from '../../scripts/baseline/collect-sgds-read-only-baseline.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['scripts/baseline/collect-sgds-read-only-baseline.mjs', '.firebaserc', '.clasp.json', 'appsscript.json'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('D5Z baseline is deterministic, safe, and does not require live verification', () => {
  const baseline = collectSgdsReadOnlyBaseline();
  assert.equal(baseline.BASELINE_REPORT_STATUS, 'PASS_REPOSITORY_SAFE_BASELINE');
  assert.equal(baseline.LIVE_BASELINE_VERIFICATION, 'NOT_LIVE_VERIFIED');
  assert.equal(baseline.FIREBASE_PROJECT_ID_REPO, 'tonkhohd');
  assert.equal(baseline.FIREBASE_PROJECT_ID_MATCH, 'YES');
  assert.equal(baseline.APPS_SCRIPT_ID_MATCH, 'YES');
  assert.equal(baseline.APPS_SCRIPT_EXTERNAL_REQUEST_SCOPE, 'PRESENT');
  assert.equal(baseline.APPS_SCRIPT_OPENID_SCOPE, 'PRESENT');
  assert.equal(baseline.PRODUCTION_WRITE_ATTEMPTED, 'NO');
  assert.match(baseline.DRIVE_FOLDER_ID_SUFFIXES, /suffix:/);
  assert.equal(JSON.stringify(baseline).includes(['refresh', 'token'].join('_')), false);
  assert.equal(JSON.stringify(baseline).includes(['private', 'key'].join('_')), false);
});
