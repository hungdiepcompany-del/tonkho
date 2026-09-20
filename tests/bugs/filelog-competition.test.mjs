import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';
const TEST_METADATA = defineTestMetadata({ testClass: 'CONFIRMED_BUG_REPRODUCTION', sourceFiles: ['sheetNhapXuat.js', 'sheetTonKho.js', 'sheetFileLog.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
test('BUG-FILELOG-COMPETITION fixed: jobs append one shared four-column audit schema', () => {
  assert.match(fs.readFileSync('config.js','utf8'), /SHEET_LOG: "FileLog"/);
  assert.doesNotMatch(fs.readFileSync('sheetNhapXuat.js','utf8'), /getMaxRows\(\).*clearContent/);
  assert.doesNotMatch(fs.readFileSync('sheetTonKho.js','utf8'), /getMaxRows\(\).*clearContent/);
  assert.match(fs.readFileSync('sheetFileLog.js','utf8'), /appendFileLogEntries_[\s\S]*row\.length === 4/);
});
