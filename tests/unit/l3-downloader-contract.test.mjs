import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOWNLOAD_PROVIDER,
  DOWNLOAD_STRATEGY,
  classifyInvoiceLink,
  selectBestInvoiceLink,
  validateDownloaderRequest
} from '../../services/sgds-invoice-downloader/src/contract.mjs';

test('EasyInvoice direct token route is the highest-priority browser candidate', () => {
  const result = classifyInvoiceLink('https://0200661889hd.easyinvoice.vn/Invoice/DownloadInvPdf?token=secret-value');
  assert.equal(result.provider, DOWNLOAD_PROVIDER.EASYINVOICE_BROWSER);
  assert.equal(result.strategy, DOWNLOAD_STRATEGY.CLOUD_BROWSER);
  assert.equal(result.supported, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.safeSource.queryKeys, ['token']);
  assert.equal(JSON.stringify(result.safeSource).includes('secret-value'), false);
});

test('EasyInvoice ViewFromEmail is supported but ranks below direct download', () => {
  const result = selectBestInvoiceLink([
    'https://0200661889hd.easyinvoice.vn/Invoice/ViewFromEmail?token=view-secret',
    'https://0200661889hd.easyinvoice.vn/Invoice/DownloadInvPdf?token=download-secret'
  ]);
  assert.equal(result.provider, DOWNLOAD_PROVIDER.EASYINVOICE_BROWSER);
  assert.equal(result.reason, 'EASYINVOICE_DIRECT_DOWNLOAD_TOKEN');
  assert.match(result.rawUrl, /DownloadInvPdf/);
});

test('MISA public lookup is never routed to cloud browser', () => {
  const result = classifyInvoiceLink('https://www.meinvoice.vn/tra-cuu/?sc=lookup-code&m=user%40example.com');
  assert.equal(result.provider, DOWNLOAD_PROVIDER.MISA_PUBLIC_LOOKUP);
  assert.equal(result.strategy, DOWNLOAD_STRATEGY.OFFICIAL_API_REQUIRED);
  assert.equal(result.supported, false);
  assert.deepEqual(result.safeSource.queryKeys, ['m', 'sc']);
});

test('MISA public lookup request fails closed with explicit official API requirement', () => {
  assert.throws(() => validateDownloaderRequest({
    schemaVersion: 1,
    requestId: 'l3-misa-0001',
    direction: 'IN',
    sourceUrl: 'https://www.meinvoice.vn/tra-cuu/?sc=lookup-code'
  }), /DOWNLOADER_MISA_OFFICIAL_API_REQUIRED/);
});

test('direct HTTPS PDF remains eligible for cheap HTTP path', () => {
  const result = classifyInvoiceLink('https://invoices.example.com/files/invoice.pdf?sig=private');
  assert.equal(result.provider, DOWNLOAD_PROVIDER.DIRECT_HTTP);
  assert.equal(result.strategy, DOWNLOAD_STRATEGY.DIRECT_HTTP);
  assert.equal(result.supported, true);
  assert.equal(result.score, 90);
  assert.deepEqual(result.safeSource.queryKeys, ['sig']);
});

test('private/local SSRF destinations are rejected', () => {
  for (const url of [
    'https://localhost/invoice.pdf',
    'https://127.0.0.1/invoice.pdf',
    'https://10.0.0.2/invoice.pdf',
    'https://172.20.0.2/invoice.pdf',
    'https://192.168.1.10/invoice.pdf'
  ]) {
    assert.throws(() => classifyInvoiceLink(url), /DOWNLOADER_HOST_REJECTED/);
  }
});

test('non-HTTPS links are rejected', () => {
  assert.throws(() => classifyInvoiceLink('http://example.com/invoice.pdf'), /DOWNLOADER_HTTPS_REQUIRED/);
});

test('validated worker request is mutation-denied by contract', () => {
  const request = validateDownloaderRequest({
    schemaVersion: 1,
    requestId: 'l3-easyinvoice-0001',
    direction: 'IN',
    sourceUrl: 'https://0200661889hd.easyinvoice.vn/Invoice/DownloadInvPdf?token=secret-value'
  });
  assert.equal(request.provider, DOWNLOAD_PROVIDER.EASYINVOICE_BROWSER);
  assert.equal(request.canonicalWriteAllowed, false);
  assert.equal(request.gmailMutationAllowed, false);
  assert.equal(request.driveMutationAllowed, false);
  assert.equal(request.sheetsMutationAllowed, false);
  assert.equal(JSON.stringify(request.safeSource).includes('secret-value'), false);
});
