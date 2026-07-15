# SGDS-CRIT-003 D1 Local Implementation

D1_STATUS=PASS_LOCAL_PRIMITIVES_IMPLEMENTED
OWNER_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D1_LOCAL_IMPLEMENTATION
DATE=2026-07-15
PROJECT=SyncGmailDriveSheet
SCOPE=LOCAL_ONLY
RUNTIME_FILES_CHANGED=YES_LOCAL_ONLY
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
GAS_FUNCTION_RUN=NO
FIREBASE_DEPLOY=NOT_RUN

## Scope Implemented

D1 implements the local building blocks approved by the durable commit design. It does not wire those primitives into production scanners and does not run reconciliation.

Implemented files:

```text
durableJobState.js
tests/unit/durable-job-state.test.mjs
```

## Runtime Surface

`durableJobState.js` is GAS-compatible source, but it is inert in this phase. No production entrypoint calls it yet.

Implemented primitives:

```text
DURABLE_JOB_STATES_
assertDurableJobTransition_
isDurableTerminalJobState_
createLocalDurableJobStore_
buildDurableCommitPlan_
resolveDurableCompletedResume_
```

## Local Invariants Covered

- Approved state transitions are accepted.
- Invalid direct state jumps are rejected.
- Terminal completed jobs are idempotent no-ops only when ledger, registry, and projection verification all pass.
- Completed jobs with missing verification route to reconciliation instead of mutation.
- Commit plans record expected line count, legacy hash indexes, line identity V2 values, registry target, Drive evidence target, and pre-commit probe summary.
- Saved commit plans are immutable in the local store.
- The local fake durable store records append-only events for creation, transitions, and commit-plan save.

## Explicit Non-Changes

```text
SCANNER_WIRING=NOT_STARTED
FIRESTORE_ADAPTER=NOT_STARTED
REPORT_ONLY_RECONCILIATION=NOT_STARTED
REPAIR_TOOLS=NOT_STARTED
PRODUCTION_CANARY=NOT_STARTED
GAS_PUSH=NOT_RUN
GAS_DEPLOY=NOT_RUN
```

## Validation

```text
FOCUSED_D1_TEST=PASS
TEST_RESULT=PASS
CHECK_RESULT=PASS
BUNDLE_C_CHECK=PASS
GIT_DIFF_CHECK=PASS
```

## Status

```text
SGDS_CRIT_003_STATUS=NOT_FIXED_D1_LOCAL_PRIMITIVES_READY
NEXT_ALLOWED_PHASE=OWNER_REVIEW_SGDS_CRIT_003_D1_LOCAL_IMPLEMENTATION
NEXT_REQUIRED_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D2_FIRESTORE_ADAPTER_OR_D3_REPORT_ONLY_RECONCILIATION
```
