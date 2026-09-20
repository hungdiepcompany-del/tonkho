import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['gmailScanner.js', 'gmailProcessInvoiceXML.js'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
test('BUG-XML-FIRST-ONLY fixed: every XML attachment is evaluated', () => {
  assert.doesNotMatch(fs.readFileSync('gmailScanner.js','utf8'), /breakOnFirst/);
  assert.doesNotMatch(fs.readFileSync('gmailProcessInvoiceXML.js','utf8'), /options\.breakOnFirst/);
});
