
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['sheetNhapXuat.js', 'sheetTonKho.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('C04: BQGQ and TonKho use ScriptLock plus cleanup in finally', () => {
  const nx = fs.readFileSync('sheetNhapXuat.js','utf8');
  const tk = fs.readFileSync('sheetTonKho.js','utf8');
  assert.match(nx, /LockService\.getScriptLock\(\)/);
  assert.match(nx, /lock\.tryLock\(1000\)/);
  assert.match(nx, /finally[\s\S]*setNXRunning_\(false\)[\s\S]*lock\.releaseLock\(\)/);
  assert.match(tk, /LockService\.getScriptLock\(\)/);
  assert.match(tk, /finally[\s\S]*setTKRunning_\(false\)[\s\S]*lock\.releaseLock\(\)/);
});
test('C04: early no-data paths record terminal progress before return', () => {
  assert.match(fs.readFileSync('sheetNhapXuat.js','utf8'), /if \(lastRow < 2\) \{\s*setProgressNX_\(100, "COMPLETED: Khong co du lieu"\);\s*return;/s);
  assert.match(fs.readFileSync('sheetTonKho.js','utf8'), /if \(lastRowNX < 2\) \{\s*setProgressTK_\(100, "COMPLETED: Khong co du lieu"\);\s*return;/s);
});
