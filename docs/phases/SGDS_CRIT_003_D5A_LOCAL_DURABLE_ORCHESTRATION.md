# SGDS-CRIT-003 D5A Local Durable Orchestration

SGDS_CRIT_003_D5A_STATUS=PASS_LOCAL_DURABLE_ORCHESTRATION
DATE=2026-07-15
PROJECT=SyncGmailDriveSheet
SCOPE=LOCAL_IMPLEMENTATION_WITH_FAKE_ADAPTERS_ONLY
START_HEAD=5e066432f93c53bd411d2adb41ae305726f72a74
D1_STATUS=PASS_LOCAL_PRIMITIVES_IMPLEMENTED
D2_STATUS=PASS_FIRESTORE_ADAPTER_LOCAL
D3_STATUS=PASS_REPORT_ONLY_RECONCILIATION_LOCAL
D4_STATUS=PASS_DURABLE_SCANNER_INTEGRATION_DESIGN
D4_GITHUB_PUSH=PASS
D4_LOCAL_AHEAD=0
D4_REMOTE_AHEAD=0

## Boundary

```text
D5A_LOCAL_ONLY=true
ADAPTER_MODE=INJECTED_FAKE
JOB_STORE_MODE=INJECTED_LOCAL
CLOCK_MODE=INJECTED
EXTERNAL_API_CALL=NO
PRODUCTION_FIRESTORE_ACCESS=NONE
FIREBASE_SDK_NETWORK_CALL=NO
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
AUTOMATIC_REPAIR=DISABLED
BATCH_SCANNER_ACTIVATION=NOT_APPROVED
HISTORICAL_BACKFILL=NOT_APPROVED
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
GAS_DEPLOY=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
GIT_PUSH_AFTER_D5A=NOT_RUN
```

D5A adds a local orchestration service only. It does not wire Gmail scanner, Drive scanner, `main`, `mainRun`, production Firestore, Apps Script services, Firebase deployment, or production reads/writes.

## Source APIs Used

```text
DURABLE_JOB_STATE_API=assertDurableJobTransition_;buildDurableCommitPlan_;resolveDurableCompletedResume_
DURABLE_STORE_API=createDurableInvoiceJobStore(createJobIfAbsent;getJob;saveCommitPlanIfAbsent;transitionJob;appendAuditEvent;saveReconciliationReport;resumeCompletedJob)
RECONCILIATION_API=reconcileDurableInvoiceJobReportOnly
CURRENT_PREPARE_COMMIT_CORE=prepareInvoiceRowsForCommit_
CURRENT_COMMIT_CORE=commitPreparedInvoiceRows_
CURRENT_PER_INVOICE_RESULT_MODEL=writeStatus COMMITTED|ALREADY_COMMITTED|FAILED|NOT_ATTEMPTED
```

The production commit core was reviewed but not changed in D5A.

## Orchestrator

```text
ORCHESTRATOR_ENTRYPOINT=createDurableInvoiceOrchestrator({jobStore,sourceAdapter,driveEvidenceAdapter,hoaDonAdapter,ledgerAdapter,gmailProjectionAdapter,reconciliationService,clock})
PRIMARY_OPERATION=executeDurableInvoiceJob(input)
RESUME_OPERATION=resumeDurableInvoiceJob(jobId)
EXPORT_SCANNER_BATCH_ENTRYPOINT=NO
EXPORT_PRODUCTION_GAS_FUNCTION=NO
```

All external systems are injected. The local fake environment records calls and deterministic external state, and can inject confirmed failures, response-lost unknown outcomes, conflicts, partial ledger state, and duplicate existing state.

## Execution Contract

```text
EXECUTION_ORDER=DRIVE_XML_DRIVE_PDF_HOA_DON_LEDGER_GMAIL
COMMIT_PLAN_BEFORE_MUTATION=YES
READ_BEFORE_WRITE=YES
SAVED_LABEL_LAST=YES
UNKNOWN_OUTCOME_POLICY=RECONCILIATION_REQUIRED
CONFLICT_POLICY=RECONCILIATION_REQUIRED
PARTIAL_LEDGER_POLICY=RECONCILIATION_REQUIRED_NO_AUTO_APPEND
```

Execution sequence:

1. Create or resume deterministic durable job.
2. Load, parse, and validate source through the injected source adapter.
3. Build and persist immutable commit plan before external mutation.
4. Guard against Gmail saved label before ledger verification.
5. Write or verify Drive XML.
6. Write or verify Drive PDF.
7. Write or verify Hoa-Don row.
8. Write or verify Nhap-Xuat ledger lines.
9. Apply or verify Gmail saved-label projection.
10. Run final report-only reconciliation.
11. Mark the job `COMPLETED` only after all evidence is consistent.

## Step Result Contract

```text
STEP_RESULT_STATUSES=NOT_ATTEMPTED;CONFIRMED_NOT_WRITTEN;CONFIRMED_WRITTEN;ALREADY_PRESENT;OUTCOME_UNKNOWN;CONFLICT;FAILED
BOOLEAN_EXTERNAL_MUTATION_RESULT=FORBIDDEN
```

Every external step records a structured status, safe evidence, and error code. Read-before-write returns `ALREADY_PRESENT` for matching existing state, `CONFIRMED_NOT_WRITTEN` for absence, and `CONFLICT` for mismatches. Unknown write outcomes stop execution and hand off to report-only reconciliation.

## Durable Store Behavior

```text
COMPLETED_RESUME_IDEMPOTENT=YES
RECONCILIATION_REQUIRED_AUTO_RESUME=BLOCKED
EXPECTED_VERSION_REQUIRED=YES
AUDIT_APPEND_ONLY=YES
```

All durable state changes use `expectedVersion`, `fromStatus`, `toStatus`, and an idempotency key. Completed jobs resume as no-op after verification. Reconciliation-required jobs do not auto-resume and require owner review.

Audit events are local, append-only, sanitized, and do not include raw invoice data, Gmail thread IDs, Drive file IDs, XML/PDF content, tokens, or credentials.

## Reconciliation Handoff

```text
RECONCILIATION_HANDOFF=IMPLEMENTED_LOCAL_REPORT_ONLY
AUTOMATIC_REPAIR=DISABLED
OWNER_GATED_REPAIR=NOT_IMPLEMENTED
```

The orchestrator calls `reconcileDurableInvoiceJobReportOnly` for conflict, unknown outcome, partial ledger commit, verification mismatch, and version conflict after external mutation. It saves the report through the local injected durable store. It does not repair, overwrite, append missing lines, rollback Drive/Sheet evidence, or continue execution after a blocker.

## Test And Fault Coverage

```text
TEST_SCENARIO_COUNT=26
FAULT_INJECTION_CASE_COUNT=10
```

Covered scenarios include one-line and multi-line success, completed resume no-op, same source replay, Gmail/Drive source convergence, matching duplicate state, existing conflicts, response-lost writes, confirmed write failures, partial ledger commit, ledger verification mismatch, false saved Gmail label, saved-label-last behavior, durable version conflicts before and after external mutation, blocked reconciliation-required resume, terminal backward transition rejection, concurrent attempts, deterministic reruns, no external API calls, no credentials, no scanner wiring, and input/commit-plan immutability.

## Files

```text
IMPLEMENTATION_FILE=durableInvoiceOrchestrator.js
TEST_FILE=tests/unit/durable-invoice-orchestrator.test.mjs
FIXTURE_FILE=fixtures/durable-orchestration/fake-durable-orchestration.mjs
CHECKER_FILE=scripts/checkers/check-sgds-crit-003-d5a-local-orchestration.mjs
PACKAGE_COMMAND=check:sgds-crit-003-d5a
```

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
GIT_DIFF_CHECK=PASS
```

## Status

```text
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5B_SHADOW_MODE_DESIGN_OR_LOCAL_ADAPTERS
```
