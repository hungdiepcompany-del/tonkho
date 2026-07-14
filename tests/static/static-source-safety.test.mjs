
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'STATIC_SOURCE_SAFETY', sourceFiles: ['main.js', 'sheetWriter.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
const read = (p) => fs.readFileSync(p, 'utf8');

test('metadata', () => assert.equal(TEST_METADATA.runtimeMutation, 'NONE'));

test('production entrypoints are not invoked by tests', () => {
  const tests = fs.readdirSync('tests', { recursive: true }).filter((p) => String(p).endsWith('.mjs'));
  for (const file of tests) {
    const text = read(`tests/${file}`);
    assert.doesNotMatch(text, /\.call\(['"](main|mainRun|triggerMarkAllInvoiceEmails|triggerScanInvoiceDriveFolder|capNhatNhapXuatBQGQ|capNhatTonKho|onEdit|doGet)['"]/);
  }
});

test('Bundle C fixed critical safety patterns remain blocked', () => {
  assert.doesNotMatch(read('main.js'), /let writeOk = false[\s\S]*const targetLabel = writeOk/);
  assert.doesNotMatch(read('sheetWriter.js'), /deleteEmptyRows_\(sh\)[\s\S]*sh\.deleteRow/);
});
