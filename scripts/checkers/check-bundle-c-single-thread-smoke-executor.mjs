import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');
const smoke = read('bundleCSingleThreadSmoke.js');
const menu = read('sheetMenu.js') + read('sheetSidebar.html') + read('VietHoaDon_UI.html');
const triggers = read('triggers.js') + read('appsscript.json');
const hash = read('hashUtils.js');
const sheetHoaDon = read('sheetHoaDon.js');
const tests = fs.readdirSync('tests', { recursive: true })
  .filter(p => String(p).endsWith('.mjs'))
  .map(p => read(`tests/${p}`))
  .join('\n');

assert.match(smoke, /function runApprovedBundleCSingleThreadSmoke\(\)/, 'entrypoint missing');
assert.doesNotMatch(menu, /runApprovedBundleCSingleThreadSmoke/, 'executor is exposed in menu/sidebar');
assert.doesNotMatch(triggers, /runApprovedBundleCSingleThreadSmoke/, 'executor is wired to trigger/manifest');
assert.doesNotMatch(smoke, /GmailApp\.search\s*\(/, 'executor must not use global Gmail search');
assert.match(smoke, /GmailApp\.getThreadById\s*\(/, 'executor must resolve exact thread id');
assert.match(smoke, /OWNER_APPROVE_BUNDLE_C_SINGLE_INVOICE_MUTATION_SMOKE/, 'approval marker missing');
assert.match(smoke, /READY/, 'READY state missing');
assert.match(smoke, /LockService\.getScriptLock\(\)/, 'ScriptLock missing');
assert.match(smoke, /SMOKE_REPLAY_BLOCKED/, 'replay block missing');
assert.doesNotMatch(smoke, /\bmain\s*\(/, 'executor must not call main');
assert.doesNotMatch(smoke, /\bscanInvoice(In|Out)Emails_\s*\(/, 'executor must not call batch scanners');
assert.doesNotMatch(smoke, /triggerScanInvoiceDriveFolder\s*\(/, 'executor must not call Drive backfill');
assert.doesNotMatch(smoke, /capNhatNhapXuatBQGQ\s*\(/, 'executor must not call BQGQ');
assert.doesNotMatch(smoke, /capNhatTonKho\s*\(/, 'executor must not call TonKho');
assert.match(smoke, /prepareInvoiceRowsForCommit_\s*\(/, 'shared preparation missing');
assert.match(smoke, /commitPreparedInvoiceRows_\s*\(/, 'shared commit missing');
assert.match(smoke, /projectCommitLabelsByThread_\s*\(/, 'shared label projection missing');
assert.match(smoke, /processInvoiceXMLAttachment_\s*\(/, 'shared XML row model missing');
assert.match(smoke, /saveInvoiceXmlToDrive_\s*\(/, 'shared XML Drive save missing');
assert.match(smoke, /upsertHoaDonFile_\s*\(/, 'shared Hoa-Don upsert missing');
assert.match(hash, /fields = \[[\s\S]*'invoiceDate'[\s\S]*'invoiceNo'[\s\S]*'customerName'[\s\S]*'itemCode'[\s\S]*'itemName'[\s\S]*'invoiceType'[\s\S]*'qty'[\s\S]*\]/, 'Hash V1 field list changed');
assert.match(sheetHoaDon, /return `\$\{date\}_\$\{mst\}_\$\{inv\}`/, 'invoiceKey persisted format changed');
assert.doesNotMatch(smoke, /FMfcgz|1C26THD|00000248|Hoàng Đào|Hoang Dao/i, 'real sample invoice/thread data leaked');
assert.doesNotMatch(smoke, /Logger\.log\([^)]*(threadId|invoiceNo|taxCode|companyName|rawXml|XML)/, 'raw content logging risk');
assert.doesNotMatch(smoke, /getDataAsString\([^)]*\)[\s\S]{0,80}debugLog_/, 'raw XML logging risk');
assert.doesNotMatch(tests, /(UrlFetchApp\.fetch\(|DriveApp\.getFolderById\(|SpreadsheetApp\.getActive\(\)\.getSheetByName\(CONFIG\.SHEET_INVOICE\)\.appendRow\()/, 'test may call production API');

console.log('BUNDLE_C_SINGLE_THREAD_EXECUTOR_CHECK=PASS');
