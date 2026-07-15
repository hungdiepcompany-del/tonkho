# SGDS-CRIT-003 D5C Production Read-Only Snapshot Adapters

SGDS_CRIT_003_D5C_STATUS=PASS_PRODUCTION_READ_ONLY_ADAPTERS_LOCAL
DATE=2026-07-15
PROJECT=SyncGmailDriveSheet
SCOPE=LOCAL_IMPLEMENTATION_ONLY
START_HEAD=87d5b0b287a9dcb05a199b5e17b387b29a3159fb
D5B_GITHUB_PUSH=PASS
D5B_LOCAL_AHEAD=0
D5B_REMOTE_AHEAD=0

## Boundary

```text
D5C_IMPLEMENTATION_STATUS=LOCAL_ONLY
PRODUCTION_COMPATIBLE_READERS=IMPLEMENTED_NOT_EXECUTED
PRODUCTION_READ=NONE
PRODUCTION_WRITE=NONE
PRODUCTION_FIRESTORE_ACCESS=NONE

PUBLIC_GAS_ENTRYPOINT=NONE
MENU_WIRING=NONE
TRIGGER_WIRING=NONE
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
GAS_PUSH=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
AUTOMATIC_REPAIR=DISABLED
```

D5C implements local source only. The production-compatible wrapper factories are present for future owner-approved read-only smoke work, but they are not invoked, wired, pushed to GAS, deployed, or connected to scanner runtime.

## Adapter Contract

```text
SNAPSHOT_ADAPTER_ENTRYPOINT=createProductionReadOnlySnapshotAdapters
RECONCILIATION_SNAPSHOT_ENTRYPOINT=buildDurableReconciliationSnapshot
GMAIL_READER_MODE=INJECTED
DRIVE_READER_MODE=INJECTED
SHEETS_READER_MODE=INJECTED
DEPENDENCY_INJECTION=YES
EXACT_REFERENCE_POLICY=YES
READ_LIMIT_POLICY=YES
SANITIZATION_POLICY=YES
RAW_IDENTIFIER_OUTPUT=NO
RAW_INVOICE_PII_OUTPUT=NO
```

The core adapter depends only on injected `gmailReader`, `driveReader`, `sheetsReader`, `identityHasher`, `clock`, and read limits. Unit tests use fake readers only. The core file does not reference `GmailApp`, `DriveApp`, `SpreadsheetApp`, production Firestore, Script Properties, or scanner entrypoints.

## Read Operations

```text
READ_OPERATIONS=readGmailLabelSnapshot;readDriveEvidenceSnapshot;readHoaDonSnapshot;readLedgerSnapshot;buildDurableReconciliationSnapshot
READ_STATUSES=READ_OK;NOT_FOUND;MULTIPLE_MATCHES;READ_LIMIT_EXCEEDED;READ_FAILED;REFERENCE_INVALID;CONTENT_HASH_MISMATCH
MAX_GMAIL_MESSAGES_PER_THREAD=SUPPORTED
MAX_HOA_DON_ROWS_SCANNED=SUPPORTED
MAX_LEDGER_ROWS_SCANNED=SUPPORTED
MAX_DRIVE_DUPLICATE_CANDIDATES=SUPPORTED
```

Snapshots use exact durable job or invoice references. Raw Gmail thread IDs and raw Drive file IDs are used only in injected reader memory and are reduced to hash prefixes before output. Snapshot output avoids raw invoice numbers, tax codes, XML/PDF payloads, email body text, tokens, credentials, and full sheet rows.

## Production-Compatible Wrappers

```text
GAS_GMAIL_READER=gasGmailReadOnlyReader.js
GAS_DRIVE_READER=gasDriveReadOnlyReader.js
GAS_SHEETS_READER=gasSheetsReadOnlyReader.js
PRODUCTION_COMPATIBLE_READERS=IMPLEMENTED_NOT_EXECUTED
```

The wrappers contain only read-shaped methods from the approved Apps Script surface. They are not public entrypoints and are not referenced by `main`, scanner files, menus, triggers, or the durable orchestrator.

## Mutation Guard

```text
GMAIL_MUTATION_METHODS=NONE
DRIVE_MUTATION_METHODS=NONE
SHEET_MUTATION_METHODS=NONE
MUTATION_METHOD_CALL_COUNT=0
EXTERNAL_NETWORK_CALL=NO
```

Fake services include mutation traps for sheet, Drive, and Gmail write-shaped methods. The D5C tests prove the snapshot adapter does not call those traps.

## Files

```text
CORE_FILE=productionReadOnlySnapshotAdapters.js
GMAIL_WRAPPER_FILE=gasGmailReadOnlyReader.js
DRIVE_WRAPPER_FILE=gasDriveReadOnlyReader.js
SHEETS_WRAPPER_FILE=gasSheetsReadOnlyReader.js
TEST_FILE=tests/unit/production-read-only-snapshot-adapters.test.mjs
FIXTURE_FILE=fixtures/production-read-only-snapshots/fake-production-read-only-snapshots.mjs
CHECKER_FILE=scripts/checkers/check-sgds-crit-003-d5c-read-only-snapshot-adapters.mjs
PACKAGE_COMMAND=check:sgds-crit-003-d5c
```

## Coverage

```text
TEST_SCENARIO_COUNT=33
READ_FAILURE_CASE_COUNT=9
```

Covered scenarios include exact Gmail thread found, Gmail thread not found, saved label present, pending label conflict, message limit exceeded, exact XML/PDF found, missing XML/PDF, Drive content hash mismatch, duplicate Drive candidates, invalid Drive references, one/missing/duplicate Hoa-Don rows, missing XML/PDF references, one-line and multi-line ledger invoices, missing and extra ledger lines, blank HashIndex, blank InvoiceKey, inconsistent InvoiceKey, duplicate line identity, complete and partial reconciliation snapshots, adapter read failure, deterministic ordering, input immutability, no raw identifiers, no invoice PII, zero mutation calls, zero production network calls, and deterministic repeat runs.

## Validation

```text
FIRST_TEST_RUN=PASS
SECOND_TEST_RUN=PASS
CHECK_RESULT=PASS
BUNDLE_C_CHECK=PASS
D2_CHECK=PASS
D3_CHECK=PASS
D4_CHECK=PASS
D5A_CHECK=PASS
D5B_CHECK=PASS
D5C_CHECK=PASS
GIT_DIFF_CHECK=PASS
```

## Status

```text
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5D_PRODUCTION_READ_ONLY_SHADOW_SMOKE
```
