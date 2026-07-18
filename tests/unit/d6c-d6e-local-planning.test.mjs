import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { loadGasSource } from '../harness/load-gas-source.mjs';
import { defineTestMetadata } from '../harness/test-metadata.mjs';

const TEST_METADATA = defineTestMetadata({
  testClass: 'REGRESSION_INVARIANT',
  sourceFiles: [
    'sgdsAdapterErrors.js',
    'sgdsD6LocalAdapterPlanning.js'
  ],
  ownerPolicyRequired: false,
  runtimeMutation: 'NONE'
});

const gas = loadGasSource({
  files: [
    'sgdsAdapterErrors.js',
    'sgdsD6LocalAdapterPlanning.js'
  ],
  exportNames: [
    'SGDS_D6C_D6E_SCHEMA_VERSION_',
    'SGDS_D6C_D6E_LOCAL_COMPONENTS_',
    'createD6AdapterConfig_',
    'buildGmailDiscoveryQuery_',
    'normalizeGmailMessageForDiscovery_',
    'normalizeGmailAttachmentForDiscovery_',
    'classifyGmailCandidate_',
    'fingerprintGmailMessage_',
    'fingerprintGmailAttachment_',
    'createGmailDiscoveryCursor_',
    'serializeGmailDiscoveryCursor_',
    'planGmailDiscoveryDryRun_',
    'planDrivePath_',
    'sanitizeDriveFileName_',
    'buildDriveEvidenceMetadata_',
    'detectDriveDuplicate_',
    'reconcileDriveEvidence_',
    'planDriveWriteDryRun_',
    'getSheetSchemaRegistry_',
    'normalizeSheetRecord_',
    'buildSheetBusinessKey_',
    'matchSheetRecords_',
    'getSheetColumnOwnershipPolicy_',
    'detectSheetConflict_',
    'planSheetUpsert_',
    'reconcileSheetLinks_',
    'planSheetWriteDryRun_',
    'normalizeD6String_',
    'normalizeD6Email_',
    'normalizeD6DocumentNumber_',
    'normalizeD6Date_',
    'normalizeD6Decimal_',
    'normalizeD6Currency_',
    'normalizeD6Boolean_',
    'normalizeD6Url_',
    'createD6CombinedDryRunPlanner_',
    'planD6CombinedDryRun_'
  ]
});

const fromVm = (value) => JSON.parse(JSON.stringify(value));
const fixtures = JSON.parse(fs.readFileSync('fixtures/d6c-d6e/adapter-fixtures.json', 'utf8'));

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function fixture(id) {
  return fixtures.cases.find(item => item.id === id);
}

function baseRecord(overrides = {}) {
  return {
    documentType: 'invoice',
    documentNumber: 'INV-100',
    documentDate: '2026-02-20',
    senderSupplier: 'supplier@example.test',
    sourceSha256: 'sha256_base_record',
    amount: 1000,
    currency: 'vnd',
    gmailMessageId: 'msg-100',
    gmailThreadId: 'thread-100',
    attachmentId: 'att-100',
    driveFileId: 'drive-100',
    driveFileUrl: 'https://drive.google.test/file/d/safe',
    ...overrides
  };
}

test('metadata', () => {
  assert.equal(TEST_METADATA.runtimeMutation, 'NONE');
  assert.equal(gas.exports.SGDS_D6C_D6E_SCHEMA_VERSION_, 'SGDS_D6C_D6E_LOCAL_ADAPTERS_V1');
});

test('fixture catalogue contains the required 18 sanitized D6C-D6E cases', () => {
  assert.equal(fixtures.fixturePolicy.realPrivateContent, false);
  assert.equal(fixtures.fixturePolicy.rawAttachmentBytes, false);
  assert.equal(fixtures.cases.length >= 18, true);
  for (const id of [
    'invoice_pdf_email',
    'quotation_excel_email',
    'two_attachments',
    'no_attachment',
    'inline_image',
    'duplicate_message',
    'duplicate_attachment_hash',
    'invalid_path_chars',
    'very_long_filename',
    'unknown_mime',
    'ambiguous_date',
    'same_business_key_identical',
    'same_business_key_changed_system_owned',
    'same_business_key_conflicting_user_editable',
    'multiple_existing_sheets_matches',
    'missing_required_business_field',
    'retryable_injected_transport_failure',
    'terminal_validation_failure'
  ]) {
    assert.ok(fixture(id), `missing fixture ${id}`);
  }
});

test('D6C component catalogue names explicit Gmail discovery services', () => {
  const components = fromVm(gas.exports.SGDS_D6C_D6E_LOCAL_COMPONENTS_);
  assert.ok(components.D6C.includes('GmailDiscoveryService'));
  assert.ok(components.D6C.includes('GmailQueryBuilder'));
  assert.ok(components.D6C.includes('GmailMessageNormalizer'));
  assert.ok(components.D6C.includes('GmailAttachmentNormalizer'));
  assert.ok(components.D6C.includes('GmailClassificationEngine'));
  assert.ok(components.D6C.includes('GmailFingerprintService'));
  assert.ok(components.D6C.includes('GmailDiscoveryCursor'));
  assert.ok(components.D6C.includes('GmailTransport interface'));
  assert.ok(components.D6C.includes('FakeGmailTransport'));
  assert.ok(components.D6C.includes('GmailDiscoveryDryRunPlanner'));
});

test('D6C Gmail query builder is bounded, deterministic, capped, and fail-closed', () => {
  const one = fromVm(gas.call('buildGmailDiscoveryQuery_', {
    from: 'Supplier One <supplier.one@example.test>',
    subject: 'Sanitized invoice',
    hasAttachment: true,
    after: '2026-02-01',
    labels: ['SGDS/PENDING'],
    maxResults: 999
  }));
  const two = fromVm(gas.call('buildGmailDiscoveryQuery_', {
    from: 'Supplier One <supplier.one@example.test>',
    subject: 'Sanitized invoice',
    hasAttachment: true,
    after: '2026-02-01',
    labels: ['SGDS/PENDING'],
    maxResults: 999
  }));
  assert.deepEqual(one, two);
  assert.equal(one.maxResults, 10);
  assert.equal(one.dryRunSummary.wholeMailbox, false);
  assert.throws(() => gas.call('buildGmailDiscoveryQuery_', {}), /bounded Gmail discovery filter required/);
  assert.throws(() => gas.call('buildGmailDiscoveryQuery_', { rawQuery: 'newer_than:30d' }), /unsafe raw Gmail query rejected/);
  const trusted = fromVm(gas.call('buildGmailDiscoveryQuery_', { rawQuery: 'newer_than:1d', trustedRaw: true }, { allowTrustedRawQuery: true }));
  assert.equal(trusted.query, 'newer_than:1d');
});

test('D6C Gmail message and attachment DTOs normalize expected fields and fingerprints', () => {
  const caseData = fixture('invoice_pdf_email');
  const message = fromVm(gas.call('normalizeGmailMessageForDiscovery_', caseData.message));
  assert.equal(message.gmailMessageId, 'msg-fixture-001');
  assert.equal(message.threadId, 'thread-fixture-001');
  assert.equal(message.senderEmail, 'supplier.one@example.test');
  assert.equal(message.senderDisplayName, 'Supplier One');
  assert.deepEqual(message.recipientEmails, ['accounting@example.test']);
  assert.equal(message.attachmentCandidates.length, 2);
  assert.equal(message.schemaVersion, 'SGDS_D6C_D6E_LOCAL_ADAPTERS_V1');
  assert.equal(typeof message.messageFingerprint, 'string');
  assert.equal(message.messageFingerprint.length, 16);

  const attachment = fromVm(gas.call('normalizeGmailAttachmentForDiscovery_', {
    gmailMessageId: 'msg-hash',
    attachmentId: 'att-hash',
    fileName: 'hash.xml',
    mimeType: 'application/xml',
    fixtureBytes: '<xml/>'
  }, { sha256Provider: sha256 }));
  assert.equal(attachment.computedSha256, sha256('<xml/>'));
  assert.equal(attachment.expectedSha256, sha256('<xml/>'));
  assert.equal(attachment.attachmentFingerprint.length, 16);
});

test('D6C classification supports invoice, quotation, spreadsheet/image/pdf/unknown review contracts', () => {
  const invoiceMessage = fromVm(gas.call('normalizeGmailMessageForDiscovery_', fixture('invoice_pdf_email').message));
  const quotationMessage = fromVm(gas.call('normalizeGmailMessageForDiscovery_', fixture('quotation_excel_email').message));
  const imageMessage = fromVm(gas.call('normalizeGmailMessageForDiscovery_', fixture('inline_image').message));
  const unknownAttachment = fromVm(gas.call('normalizeGmailAttachmentForDiscovery_', fixture('unknown_mime').attachment));

  assert.equal(fromVm(gas.call('classifyGmailCandidate_', { ...invoiceMessage, attachment: invoiceMessage.attachmentCandidates[0] })).classification, 'invoice');
  assert.equal(fromVm(gas.call('classifyGmailCandidate_', { ...quotationMessage, attachment: quotationMessage.attachmentCandidates[0] })).classification, 'quotation');
  assert.equal(fromVm(gas.call('classifyGmailCandidate_', { ...imageMessage, attachment: imageMessage.attachmentCandidates[0] })).classification, 'image');
  const unknown = fromVm(gas.call('classifyGmailCandidate_', { attachment: unknownAttachment }));
  assert.equal(unknown.classification, 'unknown');
  assert.equal(unknown.requiresReview, true);
});

test('D6C cursor serialization is deterministic and raw page token is reduced to hash prefix', () => {
  const cursor = fromVm(gas.call('createGmailDiscoveryCursor_', {
    lastThreadId: 'thread-safe',
    lastMessageId: 'msg-safe',
    lastReceivedAt: '2026-02-01',
    pageToken: 'opaque-token'
  }));
  const serialized = gas.call('serializeGmailDiscoveryCursor_', { ...cursor, pageToken: 'opaque-token' });
  assert.equal(cursor.lastReceivedAt, '2026-02-01T00:00:00.000Z');
  assert.equal(cursor.pageTokenHashPrefix.length, 12);
  assert.equal(serialized.includes('opaque-token'), false);
});

test('D6D component catalogue and path planner follow evidence-store contract', () => {
  const components = fromVm(gas.exports.SGDS_D6C_D6E_LOCAL_COMPONENTS_);
  assert.ok(components.D6D.includes('DriveEvidenceStore'));
  assert.ok(components.D6D.includes('DrivePathPlanner'));
  assert.ok(components.D6D.includes('DriveDuplicateDetector'));
  const path = fromVm(gas.call('planDrivePath_', {
    classification: 'invoice',
    receivedAt: '2026-02-01',
    senderBusinessFolder: 'Supplier: One'
  }));
  assert.equal(path.path, 'SyncGmailDriveSheet/2026/02/invoice/Supplier_ One');
  assert.equal(path.timezone, 'Asia/Ho_Chi_Minh');
});

test('D6D filename sanitizer preserves extension, rejects traversal, caps length, and avoids ambiguous executable extension', () => {
  const sanitized = fromVm(gas.call('sanitizeDriveFileName_', 'bad:name?.xml'));
  assert.equal(sanitized.sanitizedFilename, 'bad_name_.xml');
  const longName = fromVm(gas.call('sanitizeDriveFileName_', fixture('very_long_filename').fileName, { maxLength: 60 }));
  assert.equal(longName.sanitizedFilename.length <= 60, true);
  assert.equal(longName.extension, 'xml');
  const ambiguous = fromVm(gas.call('sanitizeDriveFileName_', 'invoice.exe.pdf'));
  assert.equal(ambiguous.sanitizedFilename, 'invoice.pdf');
  assert.throws(() => gas.call('sanitizeDriveFileName_', '../invoice.xml'), /traversal rejected/);
});

test('D6D duplicate and reconciliation statuses cover exact, source identity, hash conflict, and missing source', () => {
  const candidate = fixture('duplicate_attachment_hash').attachment;
  const duplicate = fromVm(gas.call('detectDriveDuplicate_', candidate, fixture('duplicate_attachment_hash').existingDriveFiles));
  assert.equal(duplicate.status, 'existing_exact_match');
  assert.equal(duplicate.writeRequired, false);
  const sourceMatch = fromVm(gas.call('detectDriveDuplicate_', {
    gmailMessageId: 'msg-a',
    threadId: 'thread-a',
    attachmentId: 'att-a',
    expectedSha256: 'hash-new'
  }, [{ driveFileId: 'drive-a', gmailMessageId: 'msg-a', threadId: 'thread-a', attachmentId: 'att-a', sourceSha256: 'hash-old' }]));
  assert.equal(sourceMatch.status, 'conflicting_hash');
  assert.equal(fromVm(gas.call('reconcileDriveEvidence_', { duplicateStatus: 'conflicting_hash', attachmentId: 'att-a' })).state, 'conflicting_hash');
  assert.equal(fromVm(gas.call('reconcileDriveEvidence_', {})).state, 'missing_source_attachment');
});

test('D6D dry-run planner returns idempotent no-write plan for existing exact match', () => {
  const caseData = fixture('duplicate_attachment_hash');
  const plan = fromVm(gas.call('planDriveWriteDryRun_', caseData.attachment, caseData.existingDriveFiles));
  assert.equal(plan.action, 'DRY_RUN_NO_WRITE');
  assert.equal(plan.duplicate.status, 'existing_exact_match');
  assert.equal(plan.productionMutation, 'NONE');
  assert.equal(plan.metadata.gmailMessageIdHashPrefix.length, 12);
});

test('D6E component catalogue and schema registry include required ledger fields', () => {
  const components = fromVm(gas.exports.SGDS_D6C_D6E_LOCAL_COMPONENTS_);
  assert.ok(components.D6E.includes('SheetsLedgerAdapter'));
  assert.ok(components.D6E.includes('SheetUpsertPlanner'));
  assert.ok(components.D6E.includes('SheetColumnOwnershipPolicy'));
  const schema = fromVm(gas.call('getSheetSchemaRegistry_'));
  for (const field of [
    'recordId',
    'businessKey',
    'documentType',
    'documentNumber',
    'documentDate',
    'senderSupplier',
    'subject',
    'amount',
    'currency',
    'gmailMessageId',
    'gmailThreadId',
    'attachmentId',
    'driveFileId',
    'driveFileUrl',
    'sourceSha256',
    'processingStatus',
    'reviewStatus',
    'createdAt',
    'updatedAt',
    'schemaVersion'
  ]) {
    assert.ok(schema.fields.includes(field), `schema missing ${field}`);
  }
});

test('D6E normalization handles strings, emails, doc numbers, dates, decimals, currency, booleans, and URLs', () => {
  assert.equal(gas.call('normalizeD6String_', ' a   b '), 'a b');
  assert.equal(gas.call('normalizeD6Email_', 'USER@EXAMPLE.TEST'), 'user@example.test');
  assert.equal(gas.call('normalizeD6DocumentNumber_', ' inv 001 '), 'INV001');
  assert.equal(fromVm(gas.call('normalizeD6Date_', '2026-02-20')).isoDate, '2026-02-20');
  assert.equal(fromVm(gas.call('normalizeD6Date_', '02/03/2026')).ambiguous, true);
  assert.equal(fromVm(gas.call('normalizeD6Decimal_', '1,234.50')).value, 1234.5);
  assert.equal(gas.call('normalizeD6Currency_', 'usd'), 'USD');
  assert.equal(gas.call('normalizeD6Boolean_', 'yes'), true);
  assert.equal(gas.call('normalizeD6Url_', 'https://example.test/a'), 'https://example.test/a');
  assert.equal(gas.call('normalizeD6Url_', 'http://example.test/a'), '');
});

test('D6E business key is deterministic and never row-number based', () => {
  const keyA = fromVm(gas.call('buildSheetBusinessKey_', baseRecord({ rowNumber: 10 })));
  const keyB = fromVm(gas.call('buildSheetBusinessKey_', baseRecord({ rowNumber: 99 })));
  assert.equal(keyA.businessKey, keyB.businessKey);
  assert.equal(keyA.rowNumberUsed, false);
});

test('D6E upsert planner emits INSERT, UPDATE, NO_OP, HOLD_FOR_REVIEW, and REJECT_INVALID', () => {
  const record = fromVm(gas.call('normalizeSheetRecord_', baseRecord()));
  assert.equal(fromVm(gas.call('planSheetUpsert_', record, [])).action, 'INSERT');
  assert.equal(fromVm(gas.call('planSheetUpsert_', record, [record])).action, 'NO_OP');
  assert.equal(fromVm(gas.call('planSheetUpsert_', { ...record, driveFileId: 'drive-updated' }, [record])).action, 'UPDATE');
  assert.equal(fromVm(gas.call('planSheetUpsert_', { ...record, amount: 2000 }, [record])).action, 'HOLD_FOR_REVIEW');
  assert.equal(fromVm(gas.call('planSheetUpsert_', fixture('missing_required_business_field').businessRecord, [])).action, 'REJECT_INVALID');
  assert.equal(fromVm(gas.call('planSheetUpsert_', fixture('ambiguous_date').businessRecord, [])).action, 'HOLD_FOR_REVIEW');
  assert.equal(fromVm(gas.call('planSheetUpsert_', record, [record, { ...record, recordId: 'duplicate' }])).action, 'HOLD_FOR_REVIEW');
});

test('D6E reconciliation requires Gmail, Drive, Sheets, and source hash links', () => {
  const ok = fromVm(gas.call('reconcileSheetLinks_', baseRecord()));
  const missing = fromVm(gas.call('reconcileSheetLinks_', { ...baseRecord(), driveFileId: '' }));
  assert.equal(ok.status, 'LINKS_CONSISTENT');
  assert.equal(missing.status, 'REQUIRES_REVIEW_MISSING_LINKS');
  assert.deepEqual(missing.missingFields, ['driveFileId']);
});

test('combined dry-run planner is deterministic, idempotent, resumable, and production-safe', () => {
  const message = fixture('invoice_pdf_email').message;
  const input = {
    receivedAt: '2026-02-01',
    gmail: {
      filters: { from: 'supplier.one@example.test', hasAttachment: true, after: '2026-02-01' },
      messages: [message]
    },
    businessRecord: baseRecord({ documentNumber: 'INV-COMBINED', sourceSha256: 'sha256_fixture_invoice_001_xml' }),
    driveExistingFiles: [],
    sheetRows: []
  };
  const first = fromVm(gas.call('planD6CombinedDryRun_', input));
  const second = fromVm(gas.call('planD6CombinedDryRun_', input));
  assert.equal(first.deterministicPlanHash, second.deterministicPlanHash);
  assert.equal(first.productionGoogleApiCallCount, 0);
  assert.equal(first.productionMutation, 'NONE');
  assert.equal(first.candidates.length, 2);
  assert.equal(first.candidates[0].jobPlan.productionFirestoreAccess, 'NONE');
  assert.equal(first.candidates[0].drivePlan.productionMutation, 'NONE');
  assert.equal(first.candidates[0].sheetPlan.productionMutation, 'NONE');
});

test('D6 local planning source is free of live service calls and production deployment commands', () => {
  const source = fs.readFileSync('sgdsD6LocalAdapterPlanning.js', 'utf8');
  for (const forbidden of [
    'GmailApp.',
    'DriveApp.',
    'SpreadsheetApp.',
    'UrlFetchApp.',
    'FirebaseApp.',
    'clasp push',
    'firebase deploy',
    'gcloud services enable'
  ]) {
    assert.equal(source.includes(forbidden), false, `local planner must not include ${forbidden}`);
  }
});
