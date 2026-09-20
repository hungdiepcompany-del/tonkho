import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'POLICY_PENDING', sourceFiles: ['sheetNhapXuat.js', 'sheetTonKho.js'], ownerPolicyRequired: true, runtimeMutation: 'NONE' });
test('BUG-OVERSELL-DISPLAY fixed: BQGQ blocks oversell before writing', () => {
  const src = fs.readFileSync('sheetNhapXuat.js', 'utf8');
  assert.match(src, /if \(sl > slTon\)[\s\S]*OVERSELL_BLOCKED[\s\S]*throw new Error/);
  assert.doesNotMatch(src, /sl = slTon/);
});
test('BUG-OVERSELL-DISPLAY fixed: TonKho blocks instead of resetting inventory', () => {
  const src = fs.readFileSync('sheetTonKho.js', 'utf8');
  assert.match(src, /OVERSELL_BLOCKED:[\s\S]*throw new Error/);
  assert.doesNotMatch(src, /else \{\s*slTon\[ma\] = 0;[\s\S]*gtTon\[ma\] = 0;[\s\S]*dgBQ\[ma\] = 0;/);
});
