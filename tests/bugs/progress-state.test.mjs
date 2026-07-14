import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['sheetNhapXuat.js', 'sheetTonKho.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-PROGRESS: running cache TTL is 300 seconds', () => {
  assert.match(fs.readFileSync('sheetNhapXuat.js','utf8'), /cache\.put\("NX_RUNNING", "1", 300\)/);
  assert.match(fs.readFileSync('sheetTonKho.js','utf8'), /cache\.put\("TK_RUNNING", "1", 300\)/);
});
test('BUG-PROGRESS: early return exists after progress/running starts', () => {
  assert.match(fs.readFileSync('sheetNhapXuat.js','utf8'), /setNXRunning_\(true\)[\s\S]*if \(lastRow < 2\) return/);
  assert.match(fs.readFileSync('sheetTonKho.js','utf8'), /setTKRunning_\(true\)[\s\S]*if \(lastRowNX < 2\) return/);
});
