# Bundle C Owner Diff Review

OWNER_REVIEW_BUNDLE_C_STATUS=PASS_BUNDLE_C_DIFF_APPROVED_FOR_DEPLOY_READINESS
REVIEW_DATE=2026-07-14
PROJECT_PATH=D:\CODE\SyncGmailDriveSheet
REVIEW_START_COMMIT=22f952ca9cc115740437963357db2ca5c79f33a6
BUNDLE_C_COMMIT=37c351221b3b3ffc490fefcb74bde9bb7964dd9f
BRANCH=main

## Commit Range

Reviewed range:

```text
22f952ca9cc115740437963357db2ca5c79f33a6..37c351221b3b3ffc490fefcb74bde9bb7964dd9f
```

Diff inventory: 39 files changed, 796 insertions, 335 deletions.

Created files:

- `docs/phases/BUNDLE_C_CRITICAL_RUNTIME_FIXES_LOCAL.md`
- `scripts/checkers/check-bundle-c-critical-runtime-fixes.mjs`
- `tests/bugs/config-stats.test.mjs`
- `tests/bugs/log-sanitization.test.mjs`

Modified areas:

- Runtime allowlist files for commit projection, blank-hash protection, Drive commit path, locks, OCR cleanup, logging, deterministic config/stats/normalization cleanup.
- Tests, checker, test matrix, and Bundle C documentation.

## C01 Per-Source Commit Result

C01_DIFF_REVIEW=PASS
FALSE_SAVED_PATH_REMAINING=NO
BATCH_STATE_PATH_REMAINING=NO
MULTI_INVOICE_THREAD_AGGREGATION=PASS_ALL_COMMITTED_OR_ALREADY_COMMITTED_ONLY

Evidence:

- `main.js` calls `prepareInvoiceRowsForCommit_`, `commitPreparedInvoiceRows_`, and `projectCommitLabelsByThread_`.
- `hashUtils.js` defines `NOT_ATTEMPTED`, `COMMITTED`, `ALREADY_COMMITTED`, and `FAILED`.
- Duplicate-only rows become `ALREADY_COMMITTED`, not a new write.
- `gmailScanner.js` no longer calls `thread.addLabel(saveSheetLabel)`.
- `hashUtils.js` projects `SAVED_SHEET` only when every result for the thread is `COMMITTED` or `ALREADY_COMMITTED`; otherwise it projects `PENDING`.

Review note:

- The scanner still manages XML/PDF/pending labels for source evidence. The durable cross-service transaction gap remains `SGDS-CRIT-003`, explicitly deferred.

## C02 Blank-Hash Row Protection

C02_DIFF_REVIEW=PASS
IMPLICIT_LEDGER_DELETE_PATH_REMAINING=NO

Evidence:

- `writeInvoicesToSheet_()` now calls `reportBlankHashRows_(sh)`.
- `sheetWriter.js` no longer calls `deleteEmptyRows_(sh)`.
- No `deleteRow` or `deleteRows` path remains in the ledger writer.
- The remaining `deleteRow` static hit is pre-existing `sheetHoaDon.js` registry cleanup, not the `Nhap-Xuat` ledger import path.

## C03 Shared Drive/Gmail Preparation Path

C03_DIFF_REVIEW=PASS
SHARED_PREPARATION_PATH=YES
DRIVE_DEDUP_BYPASS_REMAINING=NO
HASH_V1_PARITY=PASS
INVOICE_KEY_PARITY=PASS

Evidence:

- `main.js` and `_triggerDriveScanner.js` both route rows through `prepareInvoiceRowsForCommit_`.
- `_triggerDriveScanner.js` commits via `commitPreparedInvoiceRows_`, not raw `writeInvoicesToSheet_(rows)`.
- `prepareInvoiceRowsForCommit_` normalizes customer names, creates current Hash V1, preserves current invoiceKey, and uses `filterRowsByHashIndex_`.
- Hash V1 fields remain `invoiceDate`, `invoiceNo`, `customerName`, `itemCode`, `itemName`, `invoiceType`, `qty`.
- Persisted invoiceKey helper remains `${date}_${mst}_${inv}`.

## C04 Locks And Progress

C04_DIFF_REVIEW=PASS
LOCK_RELEASE_COVERAGE=PASS_FINALLY_RELEASE_IF_ACQUIRED
TERMINAL_PROGRESS_COVERAGE=PASS
DEADLOCK_RISK=NO_NEW_DEADLOCK_RISK_FOUND

Evidence:

- `capNhatNhapXuatBQGQ()` and `capNhatTonKho()` call `LockService.getScriptLock()` and `tryLock(1000)` before mutation.
- Both jobs release locks in `finally` only when acquired.
- Both jobs clean running cache flags in `finally`.
- Lock failure, missing sheet, no data, success, and exceptions record terminal progress messages.
- BQGQ and TonKho acquire/release their own lock per job; no nested lock was added.

Deploy note:

- Cache running flags still exist as UI support. They are no longer the only concurrency control because ScriptLock is now present.

## C05 OCR And Logging

C05_DIFF_REVIEW=PASS
OCR_SOURCE_FILE_DELETE_RISK=NO
RAW_CONTENT_LOG_PATH_REMAINING=NO_FOR_SHARED_DEBUG_LOGGER

Evidence:

- `extractPdfText_()` stores `tempDocId`, trashes only that temporary document in `finally`, and does nothing before a temp id exists.
- Cleanup failure is logged through sanitized debug logging and does not replace the original parser exception.
- The source PDF blob/file is not trashed by the cleanup path.
- `debugLog_()` and `debugLogLazy_()` sanitize through `sanitizeLogValue_`.
- URL query strings, emails, long text, HTML/XML-like tags, and long content are redacted or normalized.
- Tests confirm sample raw body/email/tax-code/query content does not appear in test log output.

Review note:

- Legacy direct `Logger.log` calls remain outside the Bundle C modified surfaces. The reviewed hits do not log raw email body/XML/OCR content in the Bundle C diff path.

## C06 Low-Risk Cleanup

C06_DIFF_REVIEW=PASS
VHD_SHEET_CONSTANT=PASS
MAX_DRIVE_SCAN_FILES=PASS
REGEX_ESCAPE=PASS
STATS_INITIALIZATION=PASS
DEAD_CODE_REMOVAL=PASS

Evidence:

- `VHD.INPUT_SHEET_NAME` is `VietHoaDon`; named ranges were not changed.
- `CONFIG.MAX_DRIVE_SCAN_FILES` is declared as `100`, preserving previous fallback scope.
- Dictionary keys are escaped via `escapeRegExp_()` before RegExp construction.
- `emptyHash` and `hashed` stats are initialized to numeric zero.
- The unreachable presentation-formatting block after `writeInvoicesToSheet_()` return was removed; current batch formatting remains.

## Invariant Parity

HASH_V1_CHANGED=NO
INVOICE_KEY_FORMAT_CHANGED=NO
BQGQ_ORDERING_CHANGED=NO
OVERSELL_CHANGED=NO
MULTI_XML_CHANGED=NO
ITEM_MAPPING_CHANGED=NO
XML_NAMESPACE_CHANGED=NO
PDF_ONLY_LEDGER_POLICY_CHANGED=NO
ADJUSTMENT_REPLACEMENT_CANCELLATION_CHANGED=NO
FIREBASE_CODE_ADDED=NO
FIRESTORE_CODE_ADDED=NO
SHEET_SCHEMA_CHANGED=NO
CLASP_JSON_CHANGED=NO
APPSSCRIPT_JSON_CHANGED=NO
WORKBOOK_CHANGED=NO

## Test Evidence

FIRST_TEST_RUN=PASS_48_TESTS_47_PASS_1_SKIPPED
SECOND_TEST_RUN=PASS_48_TESTS_47_PASS_1_SKIPPED
CHECK_RESULT=PASS_BUNDLE_C_AGGREGATE_CHECK
BUNDLE_C_CHECK=PASS
DOC_CHECKS=PASS_DOC_FOUNDATION_SECRET_WORKBOOK_INTERNAL_LINKS
GIT_DIFF_CHECK=PASS

The fixed local bug tests were converted to `REGRESSION_INVARIANT` / `BUG_BLOCKED_LOCAL_NOT_DEPLOYED`. Deferred bugs remain as confirmed or policy-pending reproduction coverage.

## Deferred Risks

SGDS-CRIT-003=NOT_FIXED

Bundle C does not create a durable transaction across:

- Gmail
- Drive
- Hoa-Don
- Nhap-Xuat
- Gmail labels

Deploying Bundle C reduces existing local runtime safety risks, but it does not make the system fully transactional. Inter-service partial failure still requires a reconciliation phase.

Other deferred risk groups include multiple XML per incoming thread, Hash V2/line identity migration, BQGQ ordering policy activation, over-sell behavior change, item-code mapping, XML namespace support, PDF-only auto-ledger policy, and Firebase/Firestore projection.

DEFERRED_RISK_COUNT=18

## Deploy Risks

- Deploying via `clasp push` will update GAS runtime code, but no production smoke has been run in this review phase.
- The next phase must be an owner-approved GAS push gate.
- A separate production smoke/reconciliation phase remains required after push.
- `SGDS-CRIT-003` durable job state remains the main design risk.

## Rollback Candidate

ROLLBACK_CANDIDATE=22f952ca9cc115740437963357db2ca5c79f33a6

If deploy review later finds runtime issues, revert the Bundle C runtime commit or push the prior GAS source state corresponding to `22f952ca9cc115740437963357db2ca5c79f33a6`.

## Deploy Readiness Conclusion

DEPLOY_READINESS=APPROVED_FOR_OWNER_APPROVAL_GATE
OWNER_MARKERS_REQUIRED=OWNER_APPROVE_BUNDLE_C_GAS_PUSH
NEXT_ALLOWED_PHASE=BUNDLE_C_GAS_PUSH_OWNER_APPROVAL_GATE

No Bundle C diff defect, validation regression, scope violation, Hash V1 change, invoiceKey format change, workbook change, `.clasp.json` change, or `appsscript.json` change was found.
