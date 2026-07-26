import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const exists = file => fs.existsSync(file);

const runnerPath = 'd6jCOneRecordProductionMutation.js';
const adapterPath = 'sgdsSheetsLedgerAdapter.js';
const testPath = 'tests/unit/d6j-d-nhap-xuat-schema-repair.test.mjs';
const phaseDocPath = 'docs/phases/D6J_D_NHAP_XUAT_SCHEMA_MAPPING_FIX_AND_SINGLE_PILOT_ROW_REPAIR_CHANNEL.md';
const evidenceDocPath = 'docs/evidence/D6J_D_NHAP_XUAT_SCHEMA_MAPPING_FIX_AND_SINGLE_PILOT_ROW_REPAIR_CHANNEL_EVIDENCE.md';

for (const file of [runnerPath, adapterPath, testPath, phaseDocPath, evidenceDocPath]) {
  assert.equal(exists(file), true, `missing D6J-D file: ${file}`);
}

const runner = read(runnerPath);
const adapter = read(adapterPath);
const tests = read(testPath);
const docs = read(phaseDocPath) + '\n' + read(evidenceDocPath);
const packageJson = JSON.parse(read('package.json'));

for (const marker of [
  'runD6jDInspectMalformedPilotRowReadOnly',
  'runD6jDRepairSingleMalformedPilotRow',
  'D6J_D_REPAIR_APPROVAL_MARKER',
  'OWNER_APPROVED_D6J_D_SINGLE_PILOT_ROW_REPAIR',
  'buildD6jCNhapXuatRowAP_',
  'calculateD6jDInventoryForTarget_',
  'findD6jDMalformedPilotRows_',
  'BLOCKED_HD_COLUMN_RULE_UNRESOLVED',
  'BLOCKED_LATER_ITEM_TRANSACTIONS_REQUIRE_BOUNDED_REBUILD',
  'D6J_D_ORIGINAL_JOB_ID_',
  'readD6jDSheetSnapshotFromSheet_'
]) {
  assert.equal(runner.includes(marker), true, `runner missing D6J-D marker: ${marker}`);
}

for (const marker of [
  'canonicalD6jDHeader_',
  ".replace(/[Đđ]/g",
  'HEADER_MISMATCH_COLUMN=',
  'HEADER_ACTUAL_TEXT=',
  'HEADER_ACTUAL_CANONICAL=',
  'HEADER_EXPECTED_TEXT=',
  'HEADER_EXPECTED_CANONICAL='
]) {
  assert.equal(runner.includes(marker), true, `runner missing D6J-D1 header marker: ${marker}`);
}

for (const marker of [
  'tryNormalizeD6jCComparableDate_',
  'formatD6jCDateObject_',
  'evaluateD6jDMalformedPilotRows_',
  'buildD6jDMalformedRowNotFoundDiagnostics_',
  'DATE_MATCH_COUNT',
  'BUSINESS_IDENTITY_MATCH_COUNT',
  'MALFORMED_SHAPE_MATCH_COUNT',
  'LEGACY_SIGNATURE_MATCH_COUNT',
  'NEAR_CANDIDATES'
]) {
  assert.equal(runner.includes(marker), true, `runner missing D6J-D2 locator marker: ${marker}`);
}

for (const marker of [
  'D6J_D_REPAIR_ALLOWED_COLUMNS_',
  'buildD6jDRepairPlanPreview_',
  'assertD6jDRepairChangeAllowlist_',
  'BLOCKED_D6J_D_REPAIR_CHANGE_OUTSIDE_ALLOWLIST',
  'assertD6jDRepairPreservedCellsBeforeWrite_',
  'BLOCKED_SCRIPT_LOCK_NOT_ACQUIRED',
  'buildD6jDRepairBeforeHash_',
  'writeD6jDAllowedRepairGroup_',
  'assertD6jDExactRepairReadback_',
  'BLOCKED_D6J_D_REPAIR_K_READBACK_MISMATCH',
  'BLOCKED_D6J_D_REPAIR_P_FORMULA_CHANGED',
  'BLOCKED_D6J_D_REPAIR_B_DATE_TYPE_CHANGED'
]) {
  assert.equal(runner.includes(marker), true, `runner missing D6J-D3 repair hardening marker: ${marker}`);
}

for (const marker of [
  'legacyHashIndex',
  'hashIndex',
  'invoiceKeyV2',
  'row.legacyHashIndex === hash'
]) {
  assert.equal(adapter.includes(marker), true, `Sheets adapter missing D6J-D identity marker: ${marker}`);
}

for (const marker of [
  'read-only audit derives exact A:P mapping',
  'zero-row and multiple-row malformed matches block',
  'later same-item transactions block',
  'missing and wrong repair markers block before mutation',
  'successful repair updates exactly one row',
  'future D6J-C idempotent rerun recognizes corrected row',
  'malformed J:N layout can never pass D6J-C readback semantics',
  'Vietnamese header canonicalization handles D stroke',
  'header schema mismatch reports sanitized column diagnostics',
  'read-only audit accepts production headers without repair marker',
  'D6J-D2 date canonicalization supports Date objects',
  'D6J-D2 Date object in Sheet row matches XML ISO date',
  'D6J-D2 progressive locator disambiguates two business candidates',
  'D6J-D2 zero candidates returns sanitized not-found diagnostic counts',
  'D6J-D2 multiple unresolved business candidates block',
  'D6J-D2 canonical repaired A:P row is not classified as malformed',
  'D6J-D3 date object and ISO date string compare semantically',
  'D6J-D3 strict repair allowlist blocks',
  'D6J-D3 successful repair updates exactly one row and eight allowlisted cells',
  'D6J-D3 ScriptLock acquisition failure blocks before write',
  'D6J-D3 repair rereads the snapshot after ScriptLock acquisition before write',
  'D6J-D3 exact K:L:M readback verification blocks',
  'D6J-D3 P formula readback verification blocks',
  'D6J-D3 B date type and value readback verification blocks',
  'D6J_D_REPAIR_APPROVAL_MARKER'
]) {
  assert.equal(tests.includes(marker), true, `tests missing D6J-D marker: ${marker}`);
}

for (const docMarker of [
  'PHASE=D6J_D_NHAP_XUAT_SCHEMA_MAPPING_FIX_AND_SINGLE_PILOT_ROW_REPAIR_CHANNEL',
  'FUTURE_COLUMN_MAPPING_FIX=PASS',
  'READ_ONLY_AUDIT_ENTRYPOINT=PASS',
  'SINGLE_ROW_REPAIR_ENTRYPOINT=PASS',
  'VIETNAMESE_D_STROKE_NORMALIZATION=PASS',
  'EXACT_PRODUCTION_HEADER_TEST=PASS',
  'DATE_OBJECT_CANONICALIZATION=PASS',
  'TIMEZONE_SAFE_DATE_COMPARISON=PASS',
  'PROGRESSIVE_ROW_LOCATOR=PASS',
  'NOT_FOUND_DIAGNOSTICS=PASS',
  'DATE_CELL_PRESERVATION=PASS',
  'STRICT_REPAIR_ALLOWLIST=PASS',
  'READ_ONLY_REPAIR_PLAN_PREVIEW=PASS',
  'SCRIPT_LOCK_GUARD=PASS',
  'EXACT_POST_WRITE_VERIFICATION=PASS',
  'READ_ONLY_AUDIT_SAFETY=PASS',
  'REPAIR_APPROVAL_MARKER_CONFIGURED=NO',
  'READ_ONLY_AUDIT_EXECUTED=NO',
  'PILOT_ROW_REPAIR_EXECUTED=NO',
  'PRODUCTION_MUTATION=NONE',
  'NEXT_ACTION=OWNER_RERUN_READ_ONLY_REPAIR_PLAN_PREVIEW'
]) {
  assert.equal(docs.includes(docMarker), true, `docs missing D6J-D marker: ${docMarker}`);
}

for (const forbidden of [
  'runD6jCOneRecordProductionMutation();',
  'runD6jDRepairSingleMalformedPilotRow();',
  'D6J_D_REPAIR_APPROVAL_MARKER=OWNER_APPROVED_D6J_D_SINGLE_PILOT_ROW_REPAIR',
  'ScriptApp.newTrigger',
  'ScriptApp.deleteTrigger',
  '.deleteRow(',
  '.clear(',
  '.setTrashed(',
  'DriveApp.removeFile',
  'GmailApp.move',
  'GmailApp.mark',
  '--force'
]) {
  assert.equal(runner.includes(forbidden), false, `forbidden D6J-D runner token: ${forbidden}`);
  assert.equal(docs.includes(forbidden), false, `forbidden D6J-D docs token: ${forbidden}`);
}

assert.equal(
  packageJson.scripts['check:d6j-d-nhap-xuat-schema-mapping-repair-channel'],
  'node scripts/checkers/check-d6j-d-nhap-xuat-schema-mapping-repair-channel.mjs',
  'package command check:d6j-d-nhap-xuat-schema-mapping-repair-channel missing or changed'
);

console.log('D6J_D_NHAP_XUAT_SCHEMA_MAPPING_REPAIR_CHANNEL_CHECK=PASS');
