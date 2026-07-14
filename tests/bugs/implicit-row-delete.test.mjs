
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['sheetWriter.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('C02: writer reports blank-hash rows without deleting ledger history', () => {
  const src = fs.readFileSync('sheetWriter.js', 'utf8');
  assert.doesNotMatch(src, /deleteEmptyRows_\(sh\)/);
  assert.doesNotMatch(src, /\.deleteRow\(/);
  assert.match(src, /reportBlankHashRows_\(sh\)/);
  assert.match(src, /no automatic deletion/i);
});
