import test from 'node:test';
import assert from 'node:assert/strict';
import { readFixtureJson } from '../harness/fixture-loader.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({ testClass: 'SCHEMA_CONTRACT', sourceFiles: ['config.js', 'sheetWriter.js'], ownerPolicyRequired: false, runtimeMutation: 'NONE' });
const schema = readFixtureJson('sheets', 'workbook-schema-snapshot.json');

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'SCHEMA_CONTRACT'));

test('workbook sheet names match current contract', () => {
  assert.deepEqual(schema.sheetNames, ['TonKho', 'Nhap-Xuat', 'Hoa-Don', 'MaHangHoa', 'PhanLoai', 'VietTat', 'FileLog', 'VietHoaDon']);
});

test('Nhap-Xuat key columns match source CONFIG indices', () => {
  const nx = schema.sheets.find((s) => s.name === 'Nhap-Xuat');
  assert.equal(nx.headers[13], 'HashIndex');
  assert.equal(nx.headers[14], 'InvoiceKey');
  assert.equal(nx.headers[15], 'HĐ');
});

test('VietHoaDon workbook exposes second-line named ranges not read by source', () => {
  const names = schema.namedRanges.map((n) => n.name);
  for (const name of ['VHD_SL2_BE', 'VHD_SL2_TO', 'VHD_DG2_BE', 'VHD_DG2_TO']) assert.ok(names.includes(name));
});
