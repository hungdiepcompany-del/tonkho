import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { readFixtureText } from '../harness/fixture-loader.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: ['Shared_Normalization.js', 'invoiceCanonical.js', 'Invoice_AttachmentParser.js', 'gmailProcessInvoiceLINK.js'],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: ['Shared_Normalization.js', 'invoiceCanonical.js', 'normalization.js', 'Invoice_AttachmentParser.js', 'gmailProcessInvoiceLINK.js'],
  exportNames: ['isVatInvoicePDF_', 'extractVatMetaFromPDFText_', 'pickCounterpartyTaxCode_', 'extractAllLinksFromMessage_', 'extractPdfLinkFromHtml_', 'resolveHtmlUrl_'],
  stubs: { CONFIG: { MY_TAXCODE: '0100000999' } },
});

test('metadata', () => assert.equal(TEST_METADATA.testClass, 'REGRESSION_INVARIANT'));

test('PDF VAT detector only recognizes title in first 50 chars', () => {
  assert.equal(gas.call('isVatInvoicePDF_', readFixtureText('pdf-text', 'vat-title-first-line.txt')), true);
  assert.equal(gas.call('isVatInvoicePDF_', readFixtureText('pdf-text', 'vat-title-after-logo.txt')), false);
});

test('PDF metadata chooses counterparty tax code different from own tax code', () => {
  const meta = gas.call('extractVatMetaFromPDFText_', readFixtureText('pdf-text', 'multiple-tax-codes.txt'));
  assert.equal(meta.taxCode, '0100000002');
});

test('PDF input ignores invoice-provider MST and chooses seller MST before own buyer MST', () => {
  const localGas = loadGasSource({
    files: ['Shared_Normalization.js', 'invoiceCanonical.js', 'normalization.js', 'Invoice_AttachmentParser.js'],
    exportNames: ['extractVatMetaFromPDFText_'],
    stubs: { CONFIG: { MY_TAXCODE: '1001035198' } },
  });
  const text = [
    'HÓA ĐƠN GIÁ TRỊ GIA TĂNG',
    'Phát hành bởi phần mềm MeInvoice.vn - Công ty Cổ phần MISA - MST: 0101243150',
    'Ngày 26 tháng 02 năm 2025',
    'Số: 00000118',
    'CÔNG TY TNHH THÉP HOÀNG ĐÀO',
    'Mã số thuế 1000677957',
    'Họ tên người mua hàng:',
    'Tên đơn vị: CÔNG TY TNHH THƯƠNG MẠI VÀ SẢN XUẤT HÙNG DIỆP',
    'Mã số thuế: 1 0 0 1 0 3 5 1 9 8'
  ].join('\n');
  const meta = localGas.call('extractVatMetaFromPDFText_', text);
  assert.equal(meta.taxCode, '1000677957');
  assert.equal(meta.invoiceNo, 118);
  assert.equal(meta.invoiceDate, '2025-02-26');
});

test('PDF output chooses buyer MST after own seller MST and excludes provider MST', () => {
  const localGas = loadGasSource({
    files: ['Shared_Normalization.js', 'invoiceCanonical.js', 'normalization.js', 'Invoice_AttachmentParser.js'],
    exportNames: ['extractVatMetaFromPDFText_'],
    stubs: { CONFIG: { MY_TAXCODE: '1001035198' } },
  });
  const text = [
    'HÓA ĐƠN GIÁ TRỊ GIA TĂNG',
    'Ngày (date) 15 tháng (month) 09 năm (year) 2025',
    'Số (No.): 36',
    'Đơn vị bán hàng (Seller): CÔNG TY TNHH THƯƠNG MẠI VÀ SẢN XUẤT HÙNG DIỆP',
    'Mã số thuế (Tax code): 1001035198',
    "Tên đơn vị (Company's name): CÔNG TY TNHH CƠ KHÍ XÂY DỰNG VÀ THƯƠNG MẠI DŨNG PHÁT",
    'Mã số thuế (Tax code): 0108132308',
    'Đơn vị cung cấp dịch vụ Hóa đơn điện tử: Viettel, MST: 0100109106'
  ].join('\n');
  const meta = localGas.call('extractVatMetaFromPDFText_', text);
  assert.equal(meta.taxCode, '0108132308');
  assert.equal(meta.invoiceNo, 36);
  assert.equal(meta.invoiceDate, '2025-09-15');
});

test('PDF tax-code extraction preserves 10-3 branch suffix', () => {
  const localGas = loadGasSource({
    files: ['Shared_Normalization.js', 'invoiceCanonical.js', 'normalization.js', 'Invoice_AttachmentParser.js'],
    exportNames: ['extractVatMetaFromPDFText_'],
    stubs: { CONFIG: { MY_TAXCODE: '1001035198' } },
  });
  const text = [
    'HÓA ĐƠN GIÁ TRỊ GIA TĂNG',
    'Ngày lập: 10/10/2024',
    'Số: 732830',
    'Đơn vị bán: VIETTEL THÁI BÌNH',
    'MST: 0100109106-029',
    'Tên đơn vị: CÔNG TY TNHH THƯƠNG MẠI VÀ SẢN XUẤT HÙNG DIỆP',
    'MST: 1001035198'
  ].join('\n');
  const meta = localGas.call('extractVatMetaFromPDFText_', text);
  assert.equal(meta.taxCode, '0100109106-029');
  assert.equal(meta.invoiceDate, '2024-10-10');
});

test('PDF counterparty selection fails closed when own MST is absent', () => {
  assert.equal(gas.call('pickCounterpartyTaxCode_', 'MST: 0100000002\nMST: 0100000003', '0100000999'), null);
});

test('URL extraction deduplicates and filters homepage/invalid protocol', () => {
  const msg = { getBody: () => 'https://example.test/ https://example.test/invoice?id=1 ftp://bad.test https://example.test/invoice?id=1' };
  assert.deepEqual(Array.from(gas.call('extractAllLinksFromMessage_', msg)), ['https://example.test/invoice?id=1']);
});

test('HTML PDF link resolver supports relative paths', () => {
  assert.equal(gas.call('extractPdfLinkFromHtml_', '<a href="/files/invoice.pdf?x=1">PDF</a>', 'https://example.test/base/page'), 'https://example.test/files/invoice.pdf?x=1');
});

test('OCR cleanup trashes temporary document when document read throws', () => {
  const calls = [];
  const localGas = loadGasSource({
    files: ['utils.js', 'Invoice_AttachmentParser.js'],
    exportNames: ['extractPdfText_'],
    stubs: {
      CONFIG: { DEBUG_LOG: true },
      Drive: { Files: { insert: () => ({ id: 'temp-doc-1' }) } },
      DocumentApp: { openById: () => ({ getBody: () => ({ getText: () => { throw new Error('read failed raw invoice body'); } }) }) },
      DriveApp: { getFileById: (id) => ({ setTrashed: (flag) => calls.push([id, flag]) }) },
      Logger: { log: () => {} },
    },
  });
  assert.throws(() => localGas.call('extractPdfText_', { name: 'sample.pdf' }), /read failed/);
  assert.deepEqual(calls, [['temp-doc-1', true]]);
});
