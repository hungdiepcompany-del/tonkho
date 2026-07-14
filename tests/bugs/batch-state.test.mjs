
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['main.js', 'gmailScanner.js', 'hashUtils.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('C01: main uses per-source commit results instead of one writeOk for all threads', () => {
  const main = fs.readFileSync('main.js', 'utf8');
  const hash = fs.readFileSync('hashUtils.js', 'utf8');
  assert.doesNotMatch(main, /let writeOk = false/);
  assert.doesNotMatch(main, /const targetLabel = writeOk/);
  assert.match(main, /prepareInvoiceRowsForCommit_/);
  assert.match(main, /commitPreparedInvoiceRows_/);
  assert.match(main, /projectCommitLabelsByThread_/);
  assert.match(hash, /writeStatus:\s*"COMMITTED"/);
  assert.match(hash, /writeStatus:\s*"ALREADY_COMMITTED"/);
});
test('C01: scanner no longer projects saved-sheet label before commit', () => {
  const src = fs.readFileSync('gmailScanner.js', 'utf8');
  assert.doesNotMatch(src, /thread\.addLabel\(saveSheetLabel\)/);
  assert.match(src, /saved-sheet label deferred until commit/);
});
