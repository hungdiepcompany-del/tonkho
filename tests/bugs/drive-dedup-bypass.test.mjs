
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['_triggerDriveScanner.js', 'hashUtils.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('C03: Drive scanner routes XML rows through shared preparation and commit helpers', () => {
  const src = fs.readFileSync('_triggerDriveScanner.js', 'utf8');
  assert.match(src, /prepareInvoiceRowsForCommit_/);
  assert.match(src, /commitPreparedInvoiceRows_/);
  assert.doesNotMatch(src, /if \(rows\.length\) \{\s*writeInvoicesToSheet_\(rows\)/s);
});
