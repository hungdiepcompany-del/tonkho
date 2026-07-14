import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['_triggerDriveScanner.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-DRIVE-DEDUP-BYPASS: Drive scanner writes rows directly', () => {
  const src = fs.readFileSync('_triggerDriveScanner.js', 'utf8');
  assert.match(src, /parseInvoiceXMLFile_[\s\S]*writeInvoicesToSheet_\(rows\)/);
  assert.doesNotMatch(src, /processInvoiceAllXMLAttachments_/);
});
