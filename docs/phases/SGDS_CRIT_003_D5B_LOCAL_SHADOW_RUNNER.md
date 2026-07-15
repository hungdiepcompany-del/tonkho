# SGDS-CRIT-003 D5B Local Shadow Runner

SGDS_CRIT_003_D5B_STATUS=PASS_LOCAL_SHADOW_RUNNER
DATE=2026-07-15
PROJECT=SyncGmailDriveSheet
SCOPE=LOCAL_SHADOW_RUNNER_AND_FAKE_SCANNER_ADAPTERS_ONLY
START_HEAD=caa9e6a20d10dcf5ab525252642a0a8d39b80d99
D1_STATUS=PASS_LOCAL_PRIMITIVES_IMPLEMENTED
D2_STATUS=PASS_FIRESTORE_ADAPTER_LOCAL
D3_STATUS=PASS_REPORT_ONLY_RECONCILIATION_LOCAL
D4_STATUS=PASS_DURABLE_SCANNER_INTEGRATION_DESIGN
D5A_STATUS=PASS_LOCAL_DURABLE_ORCHESTRATION
D5A_GITHUB_PUSH=PASS
D5A_LOCAL_AHEAD=0
D5A_REMOTE_AHEAD=0

## Boundary

```text
D5B_MODE=LOCAL_SHADOW_ONLY
EXECUTION_MODE=SHADOW
PRODUCTION_MUTATION_ALLOWED=NO
PRODUCTION_READ=NONE
PRODUCTION_WRITE=NONE
PRODUCTION_FIRESTORE_ACCESS=NONE
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
MUTATION_ATTEMPT_COUNT=0
AUTOMATIC_REPAIR=DISABLED
BATCH_SCANNER_ACTIVATION=NOT_APPROVED
HISTORICAL_BACKFILL=NOT_APPROVED
GAS_PUSH=NOT_RUN
GAS_DEPLOY=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
```

D5B adds a local shadow runner and fake scanner candidate adapters. It does not read Gmail, Drive, Sheets, or production Firestore, does not wire `main`, `mainRun`, Gmail scanner, or Drive scanner, and does not call production mutation adapters.

## Shadow Runner Contract

```text
SHADOW_RUNNER_ENTRYPOINT=createDurableScannerShadowRunner
GMAIL_CANDIDATE_ADAPTER=INJECTED_FAKE
DRIVE_CANDIDATE_ADAPTER=INJECTED_FAKE
SOURCE_CONVERGENCE=YES
DETERMINISTIC_JOB_ID=YES
COMMIT_PLAN_PREVIEW=YES
RECONCILIATION_PREVIEW=REPORT_ONLY
BATCH_ISOLATION=YES
BATCH_LIMIT=YES
DETERMINISTIC_ORDERING=YES
```

The runner accepts injected Gmail and Drive candidate adapters, normalizes candidates into sanitized local source snapshots, computes deterministic durable job IDs from invoice identity, and stores preview commit plans in the injected local durable store.

Same-invoice Gmail and Drive candidates converge to one durable job. Duplicate source candidates are isolated from the batch. Existing completed or reconciliation-required jobs are reported without mutation or automatic resume.

## Preview And Review Policy

```text
COMMIT_PLAN_IMMUTABILITY=ENFORCED
COMMIT_PLAN_MISMATCH=SHADOW_REVIEW_REQUIRED
IDENTITY_CONFLICT=SHADOW_REVIEW_REQUIRED
UNKNOWN_WRITE_OUTCOME=SHADOW_FAILED_LOCAL_FAULT
RECONCILIATION_PREVIEW=REPORT_ONLY
AUTOMATIC_REPAIR=DISABLED
```

The shadow runner creates only preview artifacts. It records which steps would mutate in a future approved phase, but never calls Drive, Hoa-Don, ledger, Gmail label, or production Firestore mutation methods.

## Files

```text
IMPLEMENTATION_FILE=durableScannerShadowRunner.js
TEST_FILE=tests/unit/durable-scanner-shadow-runner.test.mjs
FIXTURE_FILE=fixtures/durable-shadow/fake-durable-shadow.mjs
CHECKER_FILE=scripts/checkers/check-sgds-crit-003-d5b-shadow-runner.mjs
PACKAGE_COMMAND=check:sgds-crit-003-d5b
```

## Test And Fault Coverage

```text
TEST_SCENARIO_COUNT=19
FAULT_INJECTION_CASE_COUNT=6
```

Covered scenarios include one Gmail candidate, one Drive candidate, Gmail/Drive source convergence, distinct invoices, duplicate discovery, deterministic ordering, parse failure isolation, batch limit, commit-plan preview, multi-line expected count, report-only reconciliation preview, idempotent rerun, completed-job skip, reconciliation-required-job skip, immutable commit-plan mismatch, identity conflict, zero mutation calls, zero external APIs, and deterministic repeat runs.

Fault injection covers Gmail/Drive discovery failure, source load failure, parse failure, identity build failure, durable store version conflict, response-lost store behavior, and reconciliation report failure handling through local fakes.

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
GIT_DIFF_CHECK=PASS
```

## Status

```text
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5C_PRODUCTION_READ_ONLY_SNAPSHOT_ADAPTERS
```
