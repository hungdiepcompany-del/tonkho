import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['main.js', 'gmailScanner.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-BATCH-STATE: main uses one writeOk for all thread labels', () => {
  const src = fs.readFileSync('main.js', 'utf8');
  assert.match(src, /let writeOk = false/);
  assert.match(src, /writeOk = true/);
  assert.match(src, /const targetLabel = writeOk \? "SAVED_SHEET" : "PENDING"/);
  assert.match(src, /threadSet\.forEach\(thread => \{\s*setExclusiveLabel_\(thread, targetLabel\)/s);
});
test('BUG-BATCH-STATE: scanner can add saved sheet label before main writer commit', () => {
  const src = fs.readFileSync('gmailScanner.js', 'utf8');
  assert.match(src, /if \(sheetWritten\) \{\s*thread\.addLabel\(saveSheetLabel\)/s);
});
