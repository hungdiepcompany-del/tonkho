# SGDS-CRIT-003 D3 Report-Only Reconciliation

SGDS_CRIT_003_D3_STATUS=PASS_REPORT_ONLY_RECONCILIATION_LOCAL
OWNER_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D3_REPORT_ONLY_RECONCILIATION
DATE=2026-07-15
PROJECT=SyncGmailDriveSheet
SCOPE=LOCAL_ONLY
START_HEAD=e9aa1267de44f6deeee275b5858b6095a0c69bad
D1_STATUS=PASS_LOCAL_PRIMITIVES_IMPLEMENTED
D1_RUNTIME_FILE=durableJobState.js
RUNTIME_FILES_CHANGED=YES_LOCAL_ONLY
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
GAS_FUNCTION_RUN=NO
FIREBASE_DEPLOY=NOT_RUN
GIT_PUSH=NOT_RUN

## Scope Implemented

D3 adds a local-only report reconciler that compares a durable job snapshot and immutable commit plan against synthetic observed snapshots for Drive evidence, `Hoa-Don`, `Nhap-Xuat` ledger rows, and Gmail labels.

Implemented files:

```text
durableReconciliation.js
fixtures/sgds-crit-003-d3/reconciliation-fixtures.mjs
tests/unit/durable-reconciliation.test.mjs
scripts/checkers/check-sgds-crit-003-d3-report-only-reconciliation.mjs
```

## Runtime Surface

Entrypoint:

```text
reconcileDurableInvoiceJobReportOnly(input)
```

The entrypoint is inert and report-only. It accepts local snapshot input and returns a sanitized report; no scanner, trigger, menu, or production entrypoint calls it in this phase.

## Report Contract

```text
D3_RECONCILIATION_MODE=REPORT_ONLY
REPORT_ONLY_ENTRYPOINT=reconcileDurableInvoiceJobReportOnly
FINDING_CODE_COUNT=22
FIXTURE_COUNT=17
AUTOMATIC_REPAIR=DISABLED
OWNER_GATED_REPAIR=NOT_IMPLEMENTED
FIRESTORE_ADAPTER=NOT_STARTED
SCANNER_WIRING=NOT_STARTED
DRIVE_SCANNER_WIRING=NOT_STARTED
PRODUCTION_MUTATION=NONE
```

Every finding has stable fields:

```text
code
severity
scope
expected
observed
repairPolicy
safeMessage
```

Report status is one of:

```text
CONSISTENT
INCOMPLETE
CONFLICTED
REVIEW_REQUIRED
```

## Finding Codes

```text
JOB_MISSING
COMMIT_PLAN_MISSING
COMMIT_PLAN_HASH_MISMATCH
COMMIT_PLAN_VERSION_MISMATCH
STATE_AHEAD_OF_EVIDENCE
STATE_BEHIND_EVIDENCE
TERMINAL_STATE_CONFLICT
DRIVE_XML_MISSING
DRIVE_PDF_MISSING
DRIVE_ARTIFACT_DUPLICATE
DRIVE_CONTENT_HASH_MISMATCH
HOA_DON_ROW_MISSING
HOA_DON_ROW_DUPLICATE
HOA_DON_FILE_REFERENCE_MISMATCH
LEDGER_ROWS_MISSING
LEDGER_ROWS_EXTRA
LEDGER_LINE_HASH_MISMATCH
LEDGER_INVOICE_KEY_MISMATCH
LEDGER_DUPLICATE_LINE_IDENTITY
GMAIL_FALSE_SAVED_LABEL
GMAIL_SAVED_LABEL_MISSING
GMAIL_PENDING_LABEL_CONFLICT
```

## Local Invariants Covered

- Commit plan comparison is deterministic and detects changed saved plans.
- Terminal job states remain report-only and never trigger state mutation.
- `COMPLETED` requires Drive, registry, ledger, and Gmail projection evidence to match the plan.
- `ROWS_COMMITTED` and later states require all planned ledger lines to be present.
- Saved Gmail labels are only valid when ledger commit evidence is verified.
- Drive filename is not identity; content hash and file references are compared.
- `Hoa-Don` registry rows are checked against expected file references.
- Multi-line invoices retain one invoice key and separate line identities.
- Finding order is deterministic.
- Re-running the same input returns an equivalent report.
- D1 regressions remain covered: illegal transitions blocked, completed resume idempotent, saved plan immutable.

## Explicit Non-Changes

```text
AUTOMATIC_REPAIR=DISABLED
OWNER_GATED_REPAIR=NOT_IMPLEMENTED
FIRESTORE_ADAPTER=NOT_STARTED
SCANNER_WIRING=NOT_STARTED
DRIVE_SCANNER_WIRING=NOT_STARTED
PRODUCTION_READ=NOT_RUN
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
GAS_DEPLOY=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
```

## Validation

```text
FIRST_TEST_RUN=PASS
SECOND_TEST_RUN=PASS
CHECK_RESULT=PASS
BUNDLE_C_CHECK=PASS
D3_CHECK=PASS
GIT_DIFF_CHECK=PASS
```

## Status

```text
SGDS_CRIT_003_STATUS=NOT_FIXED
SGDS_CRIT_003_D3_STATUS=PASS_REPORT_ONLY_RECONCILIATION_LOCAL
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D2_FIRESTORE_ADAPTER_LOCAL
NEXT_REQUIRED_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D2_FIRESTORE_ADAPTER_LOCAL
```