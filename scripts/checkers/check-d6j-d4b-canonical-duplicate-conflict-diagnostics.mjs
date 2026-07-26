import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const files = {
  d6jB: 'd6jBProductionDryRunReadOnly.js',
  d6jC: 'd6jCOneRecordProductionMutation.js',
  d6jD4: 'd6jD4PostRepairVerificationReadOnly.js',
  d6jBTests: 'tests/unit/d6j-b-production-dry-run-read-only.test.mjs',
  d6jD4Tests: 'tests/unit/d6j-d4-post-repair-verification-read-only.test.mjs',
  phaseDoc: 'docs/phases/D6J_D4B_CANONICAL_DUPLICATE_CONFLICT_DIAGNOSTICS_AND_INVOICE_NUMBER_NORMALIZATION.md',
  evidenceDoc: 'docs/evidence/D6J_D4B_CANONICAL_DUPLICATE_CONFLICT_DIAGNOSTICS_AND_INVOICE_NUMBER_NORMALIZATION_EVIDENCE.md'
};

Object.values(files).forEach(file => {
  assert.equal(exists(file), true, `missing D6J-D4B file: ${file}`);
});

const d6jB = read(files.d6jB);
const d6jC = read(files.d6jC);
const d6jD4 = read(files.d6jD4);
const d6jBTests = read(files.d6jBTests);
const d6jD4Tests = read(files.d6jD4Tests);
const docs = read(files.phaseDoc) + '\n' + read(files.evidenceDoc);
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'C_WIDTH: 8',
  'getDisplayValues',
  'detectD6jBCanonicalSheetDuplicate_',
  'normalizeD6jBInvoiceNumber_',
  'CANONICAL_INVOICE_KEY_MATCH_COUNT',
  'CANONICAL_INVOICE_KEY_MATCH_ROWS',
  'CANONICAL_HASH_INDEX_MATCH_COUNT',
  'CANONICAL_HASH_INDEX_MATCH_ROWS',
  'CANONICAL_KEYS_MATCH_SAME_ROW',
  'CANONICAL_BUSINESS_IDENTITY_MATCH',
  'CANONICAL_BUSINESS_IDENTITY_FIELD_MATCHES',
  'CANONICAL_DUPLICATE_CONFLICT_REASON',
  'RAW_AND_DISPLAY_INVOICE_NUMBER_SEMANTIC_MATCH',
  'MULTIPLE_INVOICE_KEY_ROWS',
  'MULTIPLE_HASH_INDEX_ROWS',
  'INVOICE_HASH_COUNTS_DIFFER',
  'INVOICE_HASH_ROWS_DIFFER',
  'BUSINESS_IDENTITY_MISMATCH',
  "sheets.SHEETS_DUPLICATE_STATUS !== 'DUPLICATE_CONFLICT_REVIEW_REQUIRED'",
  'BLOCKED_SHEET_DUPLICATE_CONFLICT_',
  'sanitizeD6jBPlanningCode_',
  'createD6jBEmptyDuplicateDiagnostics_'
]) {
  assert.equal(d6jB.includes(marker), true, `D6J-B source missing D4B marker: ${marker}`);
}

for (const marker of [
  'displayValues',
  'getDisplayValues',
  'readD6jDSheetSnapshotFromSheet_'
]) {
  assert.equal(d6jC.includes(marker), true, `D6J-C shared snapshot source missing D4B marker: ${marker}`);
}

for (const marker of [
  'BLOCKED_D6J_D4_PREFLIGHT_CLASSIFIER_DISAGREEMENT',
  'normalizeD6jD4InvoiceNumber_',
  'displayValues',
  "SHEET_VERIFICATION_STATUS = 'PASS'",
  "FIRESTORE_VERIFICATION_STATUS: 'NOT_EVALUATED'",
  'CANONICAL_DUPLICATE_CONFLICT_REASON',
  'RAW_AND_DISPLAY_INVOICE_NUMBER_SEMANTIC_MATCH',
  "r.SHEETS_DUPLICATE_STATUS === 'EXISTING_CANONICAL_MATCH' || r.SHEETS_DUPLICATE_STATUS === 'DUPLICATE_CONFLICT_REVIEW_REQUIRED'"
]) {
  assert.equal(d6jD4.includes(marker), true, `D6J-D4 source missing D4B marker: ${marker}`);
}

for (const marker of [
  'invoice number semantic normalization accepts raw numeric and compatible display value',
  'invoice number semantic normalization accepts raw string and raw numeric without display support',
  'invoice number semantic normalization rejects non-digit values',
  'BLOCKED_SHEET_DUPLICATE_CONFLICT_MULTIPLE_INVOICE_KEY_ROWS',
  'BLOCKED_SHEET_DUPLICATE_CONFLICT_MULTIPLE_HASH_INDEX_ROWS',
  'BLOCKED_SHEET_DUPLICATE_CONFLICT_INVOICE_HASH_ROWS_DIFFER',
  'BLOCKED_SHEET_DUPLICATE_CONFLICT_BUSINESS_IDENTITY_MISMATCH',
  'BLOCKED_SHEET_DUPLICATE_CONFLICT_INVOICE_HASH_COUNTS_DIFFER',
  'RAW_AND_DISPLAY_INVOICE_NUMBER_SEMANTIC_MATCH',
  'CANONICAL_BUSINESS_IDENTITY_FIELD_MATCHES'
]) {
  assert.equal(d6jBTests.includes(marker), true, `D6J-B tests missing D4B marker: ${marker}`);
}

for (const marker of [
  'D6J-D4 proceeds to Sheet diagnostics on zero-write preflight duplicate conflict',
  'D6J-D4 matches raw numeric invoice number when display value preserves leading zeroes',
  'BLOCKED_D6J_D4_PREFLIGHT_CLASSIFIER_DISAGREEMENT',
  "FIRESTORE_VERIFICATION_STATUS, 'NOT_EVALUATED'",
  "DRIVE_VERIFICATION_STATUS, 'NOT_EVALUATED'",
  "GMAIL_VERIFICATION_STATUS, 'NOT_EVALUATED'",
  "TRIGGER_VERIFICATION_STATUS, 'NOT_EVALUATED'"
]) {
  assert.equal(d6jD4Tests.includes(marker), true, `D6J-D4 tests missing D4B marker: ${marker}`);
}

for (const forbidden of [
  'clasp --force',
  'runD6jD4PostRepairVerificationReadOnly()',
  'runD6jDRepairSingleMalformedPilotRow()',
  'runD6jCOneRecordProductionMutation()',
  'PRODUCTION_MUTATION=YES'
]) {
  assert.equal(docs.includes(forbidden), false, `D6J-D4B docs contain forbidden marker: ${forbidden}`);
}

for (const marker of [
  'PHASE=D6J_D4B_CANONICAL_DUPLICATE_CONFLICT_DIAGNOSTICS_AND_INVOICE_NUMBER_NORMALIZATION',
  'DUPLICATE_CONFLICT_DIAGNOSTICS=PASS',
  'INVOICE_NUMBER_SEMANTIC_NORMALIZATION=PASS',
  'RAW_DISPLAY_VALUE_SUPPORT=PASS',
  'FIELD_LEVEL_IDENTITY_DIAGNOSTICS=PASS',
  'D6J_B_CANONICAL_DUPLICATE_CLASSIFICATION=PASS',
  'D6J_B_DUPLICATE_CONFLICT_PASS_GATE=BLOCKED',
  'D6J_D4_DIAGNOSTIC_FLOW=PASS',
  'READ_ONLY_SAFETY=PASS',
  'D6J_D4_ENTRYPOINT_EXECUTED=NO',
  'REPAIR_FUNCTION_EXECUTED=NO',
  'D6J_C_FUNCTION_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'NEXT_ACTION=OWNER_RUN_D6J_D4_READ_ONLY_ONCE'
]) {
  assert.equal(docs.includes(marker), true, `D6J-D4B docs missing marker: ${marker}`);
}

assert.equal(
  packageJson.scripts['check:d6j-d4b-canonical-duplicate-conflict-diagnostics'],
  'node scripts/checkers/check-d6j-d4b-canonical-duplicate-conflict-diagnostics.mjs',
  'package command check:d6j-d4b-canonical-duplicate-conflict-diagnostics missing or changed'
);

console.log('D6J_D4B_CANONICAL_DUPLICATE_CONFLICT_DIAGNOSTICS_CHECK=PASS');
