import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['sheetWriter.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-DEAD-CODE: writer has code after unconditional return', () => {
  const src = fs.readFileSync('sheetWriter.js','utf8');
  assert.match(src, /return;[\s\S]*apply format/);
});
