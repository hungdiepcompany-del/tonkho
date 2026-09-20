import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'POLICY_PENDING', sourceFiles: ['sheetNhapXuat.js'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
test('BUG-BQGQ-ORDERING fixed: processing sorts by issue date then immutable transaction sequence', () => {
  const src = fs.readFileSync('sheetNhapXuat.js', 'utf8');
  assert.match(src, /parseInvoiceDateValue_\(data\[left\]\[0\]\).*transactionSequences\[left\]/s);
  assert.match(src, /INVALID_TRANSACTION_SEQUENCE/);
});
