# D6J-D4D Durable Job Path Fix And Post-Hoc Reconciliation Evidence

```text
PHASE=D6J_D4D_DURABLE_JOB_PATH_FIX_AND_POST_HOC_RECONCILIATION_EVIDENCE
SOURCE_IMPLEMENTATION=PASS
DURABLE_JOB_PATH_FIX=PASS
LEGACY_JOB_PATH_USED_FOR_CLOSURE=NO
ORIGINAL_AUDIT_TRUTH_PRESERVED=PASS
READ_ONLY_RECONCILIATION_PREVIEW=PASS
CONTROLLED_POST_HOC_EVENT_CHANNEL=PASS
DETERMINISTIC_EVENT_IDEMPOTENCY=PASS
D6J_D4_RECONCILED_CLOSURE_SEMANTICS=PASS
CURRENT_ENTRYPOINT_EXECUTION_SEMANTICS=PASS
READ_ONLY_SAFETY=PASS
D6J_D4D_PREVIEW_ENTRYPOINT_EXECUTED=NO
D6J_D4D_MUTATION_ENTRYPOINT_EXECUTED=NO
D6J_D4_ENTRYPOINT_EXECUTED=NO
D6J_D4C_ENTRYPOINT_EXECUTED_DURING_IMPLEMENTATION=NO
REPAIR_FUNCTION_EXECUTED=NO
D6J_C_FUNCTION_EXECUTED=NO
PRODUCTION_MUTATION=NONE
NEXT_ACTION=OWNER_RUN_D6J_D4D_RECONCILIATION_PREVIEW_READ_ONLY_ONCE
```

## Scope

This phase corrects D6J-D4 closure reads to the durable production collection `invoiceJobs/<jobId>` while preserving the historical truth that the original `D6J_D_SINGLE_ROW_REPAIR` audit event is absent. It adds a separate read-only preview entrypoint and a separately gated one-event mutation channel for post-hoc reconciliation evidence.

## Durable Path Contract

```text
DURABLE_JOB_COLLECTION=invoiceJobs
LEGACY_JOB_COLLECTION=jobs
JOB_DOCUMENT_PATH=invoiceJobs/<jobId>
JOB_EVENTS_PATH=invoiceJobs/<jobId>/events
WORKER_LEASE_PATH=worker_leases/<jobId>
LEGACY_JOB_PATH_USED_FOR_D6J_D4_CLOSURE=NO
```

## Truth-Preserving Closure

Mode 1 remains the original-audit closeout path when an authentic `D6J_D_SINGLE_ROW_REPAIR` event exists and validates.

Mode 2 is the new reconciled closeout path:

```text
FIRESTORE_EVIDENCE_MODE=POST_HOC_RECONCILIATION
POST_REPAIR_STATUS=PASS_RECONCILED
D6J_D_CHANNEL_STATUS=CLOSED_WITH_RECONCILIATION
ORIGINAL_REPAIR_AUDIT_STATUS=MISSING
```

The post-hoc event is reconciliation evidence only. It does not fabricate an original repair event, original hashes, or original repair timestamps.

## Read-Only Boundary

No production entrypoint was executed during implementation. The preview runner is read-only and bounded to GET/LIST checks across Sheet, Drive, Gmail, Firestore, and triggers. The mutation runner is not executed in this phase and is gated by the exact approval property `D6J_D4D_RECONCILIATION_APPROVAL_MARKER`.
