import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['VietHoaDon_GAS.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-VHD-CONFIG: VHD.SHEET_NAME is referenced but not declared', () => {
  const src = fs.readFileSync('VietHoaDon_GAS.js', 'utf8');
  assert.match(src, /getSheetByName\(VHD\.SHEET_NAME\)/);
  assert.equal(/^\s*SHEET_NAME\s*:/m.test(src), false);
  assert.match(src, /TONKHO_SHEET_NAME\s*:/);
});
