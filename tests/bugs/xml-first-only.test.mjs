import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['gmailScanner.js', 'gmailProcessInvoiceXML.js'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
test('BUG-XML-FIRST-ONLY: IN scanner passes breakOnFirst true', () => {
  assert.match(fs.readFileSync('gmailScanner.js','utf8'), /processInvoiceAllXMLAttachments_\([\s\S]*\{ breakOnFirst: true \}/);
  assert.match(fs.readFileSync('gmailProcessInvoiceXML.js','utf8'), /if \(options\.breakOnFirst\)[\s\S]*break;/);
});
