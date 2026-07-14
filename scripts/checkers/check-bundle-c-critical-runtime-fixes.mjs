
import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');

const main = read('main.js');
const scanner = read('gmailScanner.js');
const writer = read('sheetWriter.js');
const drive = read('_triggerDriveScanner.js');
const hash = read('hashUtils.js');
const nx = read('sheetNhapXuat.js');
const tk = read('sheetTonKho.js');
const pdf = read('pdfParser.js');
const utils = read('utils.js');
const config = read('config.js');
const norm = read('normalization.js');
const stats = read('stats.js');
const vhd = read('VietHoaDon_GAS.js');
const sheetHoaDon = read('sheetHoaDon.js');

assert.doesNotMatch(main, /let writeOk = false[\s\S]*const targetLabel = writeOk/, 'batch-level writeOk projection still present');
assert.match(main, /prepareInvoiceRowsForCommit_/, 'main does not use shared preparation');
assert.match(main, /commitPreparedInvoiceRows_/, 'main does not use commit result helper');
assert.match(hash, /projectCommitLabelsByThread_/, 'per-thread projection helper missing');

assert.doesNotMatch(scanner, /thread\.addLabel\(saveSheetLabel\)/, 'scanner still adds saved-sheet label before commit');

assert.doesNotMatch(writer, /deleteEmptyRows_\(sh\)/, 'writer still calls blank-hash deletion helper');
assert.doesNotMatch(writer, /\.deleteRow\(/, 'writer still deletes rows');
assert.match(writer, /reportBlankHashRows_/, 'writer does not report blank-hash rows');

assert.match(drive, /prepareInvoiceRowsForCommit_/, 'Drive scanner does not use shared preparation');
assert.match(drive, /commitPreparedInvoiceRows_/, 'Drive scanner does not use shared commit');
assert.doesNotMatch(drive, /if \(rows\.length\) \{\s*writeInvoicesToSheet_\(rows\)/s, 'Drive scanner still writes raw rows directly');

assert.match(hash, /fields = \[[\s\S]*'invoiceDate'[\s\S]*'invoiceNo'[\s\S]*'customerName'[\s\S]*'itemCode'[\s\S]*'itemName'[\s\S]*'invoiceType'[\s\S]*'qty'[\s\S]*\]/, 'Hash V1 field list changed unexpectedly');
assert.match(sheetHoaDon, /return `\$\{date\}_\$\{mst\}_\$\{inv\}`/, 'invoiceKey persisted helper unexpectedly changed');

assert.match(nx, /if \(sl > slTon\)[\s\S]*sl = slTon/, 'BQGQ over-sell cap changed in Bundle C');
assert.match(tk, /slTon\[ma\] = 0;[\s\S]*gtTon\[ma\] = 0;[\s\S]*dgBQ\[ma\] = 0;/, 'TonKho over-sell reset changed in Bundle C');

for (const [name, src, running] of [['BQGQ', nx, 'NX'], ['TONKHO', tk, 'TK']]) {
  assert.match(src, /LockService\.getScriptLock\(\)/, `${name} ScriptLock missing`);
  assert.match(src, /tryLock\(1000\)/, `${name} lock acquisition missing`);
  assert.match(src, new RegExp(`finally[\\s\\S]*set${running}Running_\\(false\\)[\\s\\S]*releaseLock\\(\\)`), `${name} finally cleanup missing`);
  assert.match(src, /COMPLETED: Khong co du lieu/, `${name} no-data terminal progress missing`);
  assert.match(src, /FAILED:/, `${name} failure terminal progress missing`);
}

assert.match(pdf, /finally[\s\S]*setTrashed\(true\)/, 'OCR cleanup finally missing');
assert.match(utils, /sanitizeLogValue_/, 'log sanitizer missing');
assert.match(utils, /REDACTED_LONG_TEXT/, 'long text redaction missing');
assert.match(utils, /args\.map\(sanitizeLogValue_\)/, 'debugLog does not sanitize all arguments');

assert.match(vhd, /INPUT_SHEET_NAME:\s*'VietHoaDon'/, 'VHD input sheet constant missing');
assert.match(vhd, /getSheetByName\(VHD\.INPUT_SHEET_NAME\)/, 'VHD initial data does not use input sheet constant');
assert.match(config, /MAX_DRIVE_SCAN_FILES:\s*100/, 'MAX_DRIVE_SCAN_FILES missing');
assert.match(norm, /escapeRegExp_/, 'regex escaping helper missing');
assert.match(norm, /new RegExp\(escapeRegExp_\(k\)/, 'dictionary key is not escaped');
assert.match(stats, /emptyHash:\s*0/, 'emptyHash stat missing');
assert.match(stats, /hashed:\s*0/, 'hashed stat missing');
const writerBody = writer.slice(writer.indexOf('function writeInvoicesToSheet_'), writer.indexOf('function reportBlankHashRows_'));
assert.doesNotMatch(writerBody, /return;[\s\S]*apply format/, 'dead code after writer return remains');

const tests = fs.readdirSync('tests', { recursive: true })
  .filter((p) => String(p).endsWith('.mjs'))
  .filter((p) => !String(p).startsWith('harness'));
for (const file of tests) {
  const text = read(`tests/${file}`);
  assert.doesNotMatch(text, /(UrlFetchApp\.fetch\(|GmailApp\.search\(|DriveApp\.getFolderById\(|SpreadsheetApp\.getActive\(\)\.getSheetByName\(CONFIG\.SHEET_INVOICE\)\.appendRow\()/, `test may call production API: ${file}`);
}

console.log('BUNDLE_C_CHECK=PASS');
