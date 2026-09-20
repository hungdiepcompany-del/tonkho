import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['gmailCollection.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-BODY-DEDUP-ATTACHMENT fixed: body dedup does not skip attachment collection', () => {
  const src = fs.readFileSync('gmailCollection.js','utf8');
  assert.doesNotMatch(src, /if \(EmailDedupService\.isDuplicateBodyInThread\(msg\)\) continue/);
  assert.match(src, /const duplicateBody = EmailDedupService\.isDuplicateBodyInThread\(msg\);[\s\S]*msg\.getAttachments/);
});
