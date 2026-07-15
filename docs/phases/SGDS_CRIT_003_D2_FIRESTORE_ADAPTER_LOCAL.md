# SGDS-CRIT-003 D2 Firestore Adapter Local

SGDS_CRIT_003_D2_STATUS=PASS_FIRESTORE_ADAPTER_LOCAL
OWNER_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D2_FIRESTORE_ADAPTER_LOCAL
DATE=2026-07-15
PROJECT=SyncGmailDriveSheet
SCOPE=LOCAL_ONLY
START_HEAD=47c139f9b1711861c339ab61cd8fb44eafe30422
D1_STATUS=PASS_LOCAL_PRIMITIVES_IMPLEMENTED
D3_STATUS=PASS_REPORT_ONLY_RECONCILIATION_LOCAL
RUNTIME_FILES_CHANGED=YES_LOCAL_ONLY
PRODUCTION_MUTATION=NONE
PRODUCTION_FIRESTORE_ACCESS=NONE
PRODUCTION_FIRESTORE_READ=NO
PRODUCTION_FIRESTORE_WRITE=NO
GAS_PUSH=NOT_RUN
GAS_FUNCTION_RUN=NO
FIREBASE_DEPLOY=NOT_RUN
FIRESTORE_RULES_DEPLOY=NOT_RUN
FIRESTORE_INDEX_DEPLOY=NOT_RUN
GIT_PUSH=NOT_RUN

## Scope Implemented

D2 implements a local-only Firestore durable job adapter over an injected transport and injected clock. It does not import a Firebase SDK, does not require credentials, and does not call any production network.

Implemented files:

```text
firestoreDurableJobStore.js
fixtures/sgds-crit-003-d2/firestore-adapter-fixtures.mjs
tests/unit/firestore-durable-job-store.test.mjs
scripts/checkers/check-sgds-crit-003-d2-firestore-adapter.mjs
```

## Collection Contract

```text
JOB_COLLECTION_CONTRACT=invoiceJobs/{jobId}
AUDIT_COLLECTION_CONTRACT=invoiceJobs/{jobId}/events/{eventId}
RECONCILIATION_COLLECTION_CONTRACT=invoiceJobs/{jobId}/reconciliationReports/{reportId}
```

Firestore is durable orchestration, audit, findings, and read-only projection state only. Sheets remains the canonical operational ledger; Drive remains the invoice evidence store; Gmail remains source and label projection.

## Adapter Interface

```text
ADAPTER_ENTRYPOINT=createDurableInvoiceJobStore
TRANSPORT_MODE=INJECTED_FAKE_OR_EMULATOR_COMPATIBLE
CLOCK_MODE=INJECTED
```

Implemented operations:

```text
createJobIfAbsent
getJob
saveCommitPlanIfAbsent
transitionJob
appendAuditEvent
saveReconciliationReport
getLatestReconciliationReport
markReconciliationRequired
resumeCompletedJob
```

## Concurrency And Idempotency

```text
OPTIMISTIC_CONCURRENCY=YES
EXPECTED_VERSION_REQUIRED=YES
LAST_WRITE_WINS=NO
COMMIT_PLAN_IMMUTABLE=YES
COMPLETED_RESUME_IDEMPOTENT=YES
AUDIT_APPEND_ONLY=YES
AUTOMATIC_REPAIR=DISABLED
```

Successful state mutations increment `version` by one. Stale expected versions return `DURABLE_JOB_VERSION_CONFLICT`. Lost-response write outcomes return `FIRESTORE_WRITE_UNCONFIRMED` rather than guessing success or failure.

## Error Codes

```text
ERROR_CODE_COUNT=12
DURABLE_JOB_NOT_FOUND
DURABLE_JOB_ALREADY_EXISTS
DURABLE_JOB_VERSION_CONFLICT
DURABLE_JOB_ILLEGAL_TRANSITION
DURABLE_JOB_TERMINAL_STATE
COMMIT_PLAN_MISSING
COMMIT_PLAN_HASH_MISMATCH
COMMIT_PLAN_IMMUTABILITY_VIOLATION
AUDIT_EVENT_SEQUENCE_CONFLICT
RECONCILIATION_REPORT_INVALID
FIRESTORE_TRANSPORT_ERROR
FIRESTORE_WRITE_UNCONFIRMED
```

## Fault Injection

```text
FAULT_INJECTION_CASE_COUNT=8
fail before job create
fail after create response lost
fail before transition commit
fail after transition commit response lost
fail while appending audit event
fail while saving reconciliation report
version conflict during resume
duplicate request with same idempotency key
```

## Explicit Non-Changes

```text
PRODUCTION_FIRESTORE_ACCESS=NONE
PRODUCTION_FIRESTORE_READ=NO
PRODUCTION_FIRESTORE_WRITE=NO
FIREBASE_SDK_NETWORK_CALL=NO
FIRESTORE_RULES_DEPLOY=NOT_RUN
FIRESTORE_INDEX_DEPLOY=NOT_RUN
SCANNER_WIRING=NOT_STARTED
MAIN_WIRING=NOT_STARTED
DRIVE_SCANNER_WIRING=NOT_STARTED
AUTOMATIC_REPAIR=DISABLED
OWNER_REPAIR_EXECUTION=NOT_RUN
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
D2_CHECK=PASS
GIT_DIFF_CHECK=PASS
```

## Status

```text
SGDS_CRIT_003_STATUS=NOT_FIXED
SGDS_CRIT_003_D2_STATUS=PASS_FIRESTORE_ADAPTER_LOCAL
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D4_DURABLE_SCANNER_INTEGRATION_DESIGN
NEXT_REQUIRED_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D4_DURABLE_SCANNER_INTEGRATION_DESIGN
```