import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['sheetWriter.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-IMPLICIT-ROW-DELETE: writer deletes blank-hash rows before append', () => {
  const src = fs.readFileSync('sheetWriter.js', 'utf8');
  assert.match(src, /const deleted = deleteEmptyRows_\(sh\)/);
  assert.match(src, /if \(!hash\) \{\s*sh\.deleteRow\(i \+ 2\)/s);
});
