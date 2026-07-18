import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const runnerPath = 'd6jBProductionDryRunReadOnly.js';
const testPath = 'tests/unit/d6j-b-production-dry-run-read-only.test.mjs';
const phaseDocPath = 'docs/phases/D6J_B_SAFE_EXACT_PRODUCTION_DRY_RUN_CHANNEL.md';
const evidenceDocPath = 'docs/evidence/D6J_B_SAFE_EXACT_PRODUCTION_DRY_RUN_CHANNEL_EVIDENCE.md';

for (const file of [runnerPath, testPath, phaseDocPath, evidenceDocPath]) {
  assert.equal(exists(file), true, `missing D6J-B dry-run channel file: ${file}`);
}

const runner = read(runnerPath);
const tests = read(testPath);
const phaseDoc = read(phaseDocPath);
const evidenceDoc = read(evidenceDocPath);
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'runD6jBProductionDryRunReadOnly',
  'D6J_B_SAFE_EXACT_PRODUCTION_DRY_RUN_CHANNEL_V1',
  'D6J_B_REQUIRED_SCRIPT_PROPERTIES_',
  'OWNER_APPROVED_D6J_PRODUCTION_DRY_RUN',
  'GmailApp.search(query, start, max)',
  'D6J_B_MAX_GMAIL_CANDIDATES_ = 2',
  'BLOCKED_GMAIL_QUERY_NOT_UNIQUE',
  'BLOCKED_GMAIL_MESSAGE_ID_MISMATCH',
  'BLOCKED_ATTACHMENT_COUNT_MISMATCH',
  'BLOCKED_PDF_FILENAME_MISMATCH',
  'BLOCKED_XML_FILENAME_MISMATCH',
  'application/pdf',
  'application/xml',
  'text/xml',
  'DriveApp.getFolderById',
  'DRIVE_WRITE_ACCESS_NOT_PROBED',
  'SpreadsheetApp.openById',
  'D6J_B_MAX_SHEET_SCAN_ROWS_ = 2000',
  'FIRESTORE_READ_ONLY_GATE',
  'BLOCKED_PERMISSION',
  'IDEMPOTENCY_KEYS_VALID',
  'ROLLBACK_OWNERSHIP_PROVABLE',
  'RECONCILIATION_PLAN_COMPLETE',
  'PRODUCTION_MUTATION_COUNT',
  'MUTATION_GATE_STATUS'
]) {
  assert.equal(runner.includes(marker), true, `runner missing marker: ${marker}`);
}

for (const marker of [
  'missing Script Properties fail closed before reads',
  'invalid approval marker is rejected',
  'exact Gmail query generation is bounded and date-scoped',
  'query count zero blocks',
  'query count one builds read-only plans',
  'query count two blocks as not unique',
  'message-ID mismatch blocks',
  'attachment count mismatch blocks',
  'PDF filename mismatch blocks',
  'XML filename mismatch blocks',
  'XML text/xml is accepted',
  'XML application/xml is accepted',
  'SHA-256 is deterministic',
  'Drive root mismatch blocks planning',
  'Drive duplicate detection reduces planned files',
  'Sheet missing blocks target sheet gate',
  'header mismatch blocks sheet plan',
  'Sheets duplicate detection plans zero inserts',
  'Firestore permission blocker is explicit and safe',
  'Firestore exact read success can produce full dry-run pass',
  'idempotency, rollback ownership, and reconciliation completeness',
  'tokens and attachment bytes are not logged',
  'source contains no private pilot values'
]) {
  assert.equal(tests.includes(marker), true, `tests missing marker: ${marker}`);
}

for (const forbidden of [
  '.addLabel(',
  '.removeLabel(',
  '.markRead(',
  '.markUnread(',
  '.moveToArchive(',
  '.moveToTrash(',
  '.star(',
  'GmailApp.create',
  'DriveApp.createFile',
  '.createFile(',
  '.createFolder(',
  '.setTrashed(',
  '.setName(',
  '.setDescription(',
  '.appendRow(',
  '.setValue(',
  '.setValues(',
  '.insertRow',
  '.deleteRow',
  '.clear(',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  'UrlFetchApp.fetch',
  "method: 'POST'",
  'method: "POST"',
  "method: 'PATCH'",
  'method: "PATCH"',
  "method: 'DELETE'",
  'method: "DELETE"',
  'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION',
  'runApprovedBundleCSingleThreadSmoke',
  'mainRun(',
  'scanInvoiceOutEmails_(',
  'scanInvoiceInEmails_(',
  'triggerScanInvoiceDriveFolder(',
  'getDataRange()',
  'CONFIG.MAX_EMAIL_SCAN'
]) {
  assert.equal(runner.includes(forbidden), false, `runner contains forbidden token: ${forbidden}`);
}

const privatePilotValues = [
  ['no-reply', '@', 'meinvoice.vn'].join(''),
  ['0000', '0248'].join(''),
  ['1C26THD_', '0000', '0248'].join(''),
  ['1cNCIC_', 'Tv5Y3td80xMCTCl4vCWAoyFzxW'].join(''),
  ['1yBbalX91VZkGIBaUJZQRt5eVllVlo', '53696M5hMLNAoc'].join(''),
  ['19cd03', 'f07ebbd84e'].join('')
];

for (const privatePilotValue of privatePilotValues) {
  assert.equal(runner.includes(privatePilotValue), false, `runner hardcodes private pilot value: ${privatePilotValue}`);
  assert.equal(tests.includes(privatePilotValue), false, `tests hardcode private pilot value: ${privatePilotValue}`);
  assert.equal(phaseDoc.includes(privatePilotValue), false, `phase doc hardcodes private pilot value: ${privatePilotValue}`);
  assert.equal(evidenceDoc.includes(privatePilotValue), false, `evidence doc hardcodes private pilot value: ${privatePilotValue}`);
}

for (const docMarker of [
  'PHASE=D6J_B_SAFE_EXACT_PRODUCTION_DRY_RUN_CHANNEL',
  'READ_ONLY_ENTRYPOINT=runD6jBProductionDryRunReadOnly',
  'PRIVATE_VALUES_COMMITTED=NO',
  'OWNER_APPROVED_D6J_ONE_RECORD_PRODUCTION_MUTATION=NOT_GRANTED',
  'PRODUCTION_MUTATION=NONE',
  'GMAIL_MUTATION=NONE',
  'DRIVE_MUTATION=NONE',
  'GOOGLE_SHEETS_MUTATION=NONE',
  'PRODUCTION_FIRESTORE_WRITE=NONE',
  'TRIGGER_MUTATION=NONE'
]) {
  assert.equal((phaseDoc + '\n' + evidenceDoc).includes(docMarker), true, `docs missing marker: ${docMarker}`);
}

assert.equal(
  packageJson.scripts['check:d6j-b-safe-exact-production-dry-run-channel'],
  'node scripts/checkers/check-d6j-b-safe-exact-production-dry-run-channel.mjs',
  'package command check:d6j-b-safe-exact-production-dry-run-channel missing or changed'
);

console.log('D6J_B_SAFE_EXACT_PRODUCTION_DRY_RUN_CHANNEL_CHECK=PASS');
