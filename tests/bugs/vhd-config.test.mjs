
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'REGRESSION_INVARIANT', sourceFiles: ['VietHoaDon_GAS.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('C06: VHD initial data reads the VietHoaDon input sheet constant', () => {
  const src = fs.readFileSync('VietHoaDon_GAS.js', 'utf8');
  assert.match(src, /INPUT_SHEET_NAME:\s*'VietHoaDon'/);
  assert.match(src, /getSheetByName\(VHD\.INPUT_SHEET_NAME\)/);
  assert.match(src, /TONKHO_SHEET_NAME\s*:/);
});
