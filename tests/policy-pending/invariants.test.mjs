import test from 'node:test';
import assert from 'node:assert/strict';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'TARGET_INVARIANT_DRAFT', sourceFiles: ['docs/03_DATA_CONTRACT.md'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });

test('target invariants remain draft and skipped for runtime enforcement', { skip: 'STATUS=SKIPPED_RUNTIME_NOT_FIXED' }, () => {
  assert.equal(TEST_METADATA.testClass, 'TARGET_INVARIANT_DRAFT');
});
