import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['sheetNhapXuat.js', 'sheetTonKho.js', 'sheetFileLog.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-FILELOG-COMPETITION: two jobs clear/write same FileLog with different schema widths', () => {
  assert.match(fs.readFileSync('config.js','utf8'), /SHEET_LOG: "FileLog"/);
  assert.match(fs.readFileSync('sheetNhapXuat.js','utf8'), /getMaxRows\(\), 2\)\.clearContent\(\)/);
  assert.match(fs.readFileSync('sheetTonKho.js','utf8'), /getMaxRows\(\), 4\)\.clearContent\(\)/);
});
