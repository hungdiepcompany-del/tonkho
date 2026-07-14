import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['sheetWriter.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('C06: writer has no presentation-formatting dead block after unconditional return', () => {
  const src = fs.readFileSync('sheetWriter.js','utf8');
  const writerBody = src.slice(
    src.indexOf('function writeInvoicesToSheet_'),
    src.indexOf('function reportBlankHashRows_')
  );
  assert.doesNotMatch(writerBody, /return;[\s\S]*apply format/);
});
