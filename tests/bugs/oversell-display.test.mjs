import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'POLICY_PENDING', sourceFiles: ['sheetNhapXuat.js', 'sheetTonKho.js'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
test('BUG-OVERSELL-DISPLAY: BQGQ caps calculation quantity while source row remains original', () => {
  const src = fs.readFileSync('sheetNhapXuat.js', 'utf8');
  assert.match(src, /if \(sl > slTon\)[\s\S]*sl = slTon/);
});
test('BUG-OVERSELL-DISPLAY: TonKho resets oversell state to zero', () => {
  const src = fs.readFileSync('sheetTonKho.js', 'utf8');
  assert.match(src, /setValues\(\[\[realIdx \+ 2, ngay, ma,/);
  assert.match(src, /slTon\[ma\] = 0;[\s\S]*gtTon\[ma\] = 0;[\s\S]*dgBQ\[ma\] = 0;/);
});
