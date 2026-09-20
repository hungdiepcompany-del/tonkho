
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
  assert.match(fs.readFileSync('sheetNhapXuat.js','utf8'), /setProgressNX_\(runId, 100, "COMPLETED: Khong co du lieu", "COMPLETED"\)/);
  assert.match(fs.readFileSync('sheetTonKho.js','utf8'), /setProgressTK_\(runId, 100, "COMPLETED: Khong co du lieu", "COMPLETED"\)/);
});
test('C04: progress is bound to run identity and sidebar chains only successful NX', () => {
  const service = fs.readFileSync('sheetUtils.js','utf8');
  const sidebar = fs.readFileSync('sheetSidebar.html','utf8');
  assert.match(service, /runId: normalizeRunId/);
  assert.match(service, /progress\.runId !== expectedRunId/);
  assert.match(sidebar, /p\.status === "COMPLETED" && !tkStarted/);
  assert.doesNotMatch(sidebar, /if \(p\.value >= 100\)/);
});
