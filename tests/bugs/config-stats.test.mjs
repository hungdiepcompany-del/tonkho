
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['config.js', 'stats.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });

test('C06: Drive scan limit and stats fields are initialized', () => {
  assert.match(fs.readFileSync('config.js', 'utf8'), /MAX_DRIVE_SCAN_FILES:\s*100/);
  const stats = fs.readFileSync('stats.js', 'utf8');
  assert.match(stats, /emptyHash:\s*0/);
  assert.match(stats, /hashed:\s*0/);
});
