# D7-E4B1 Exact Reconciliation Runtime Implementation And Source Sync

PHASE=D7_E4B1_EXACT_RECONCILIATION_RUNTIME_IMPLEMENTATION_AND_SOURCE_SYNC
PARENT_PHASE=D7_E4B_OWNER_APPROVED_EXACT_FIRESTORE_RECONCILIATION
MODE=IMPLEMENT_VALIDATE_AND_SYNC_MUTATION_RUNTIME_NO_PRODUCTION_EXECUTION
SOURCE_PLAN=docs/phases/D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION.md

STARTING_HEAD=165d205c6bdc48691bb226a167c469e560fd8ade
STARTING_ORIGIN_MAIN=165d205c6bdc48691bb226a167c469e560fd8ade
STARTING_AHEAD_BEHIND=0/0
STARTING_STAGED_FILES=EMPTY
D7_E4A2_PLAN_VERIFIED=YES

## Execution Boundary

This phase implements and source-syncs a future owner-gated production mutation channel. It does not configure its owner marker and does not invoke the channel. All mutation-path validation uses local injected stores only.

OWNER_MARKER_CONFIGURED=NO
PRODUCTION_EXECUTION_COUNT=0
FIRESTORE_PRODUCTION_WRITE_COUNT=0
RECONCILIATION_EXECUTED=NO
PRODUCTION_DATA_MUTATION=NONE
GMAIL_WRITE_CAPABILITY_USED=NO
DRIVE_WRITE_CAPABILITY_USED=NO
SHEETS_WRITE_CAPABILITY_USED=NO
ATTACHMENT_WRITE_CAPABILITY_USED=NO

## Runtime Contract

RUNTIME_SOURCE=D7_E4B_ExactFirestoreReconciliationRuntime.js
RUNTIME_ENTRYPOINT_IMPLEMENTED=YES
RUNTIME_ENTRYPOINT_NAME=runD7E4BExactFirestoreReconciliation
RUNTIME_ENTRYPOINT_LOCATION=Operator_Entrypoints.js

OWNER_MARKER_CONTRACT_IMPLEMENTED=YES
OWNER_MARKER_PROPERTY_NAME=D7_E4B_OWNER_APPROVAL_MARKER
OWNER_MARKER_VALUE=OWNER_APPROVED_D7_E4B_ONE_EXACT_JOB_SEVEN_FIRESTORE_WRITES_NO_EXTERNAL_MUTATION_V1
OWNER_MARKER_CONFIGURED=NO

The dedicated marker is accepted only together with all five canonical identity properties, an absent D7-E4A1 temporary marker, exact one-job identity, initial job version 4, the fixed owner disposition, and the immutable seven-write budget. Leaving the marker in place after a confirmed success cannot create a second mutation: the final job/report/audit/lease state is classified as a read-only confirmed no-op.

## Exact Success Write Contract

| Order | Category | Operation | Count |
| ---: | --- | --- | ---: |
| 1 | Existing lease | Reacquire the reconciliation-required lease using exact job identity, fence, and generation. | 1 |
| 2 | Reconciliation report | Create one deterministic owner-adoption report. | 1 |
| 3 | Existing job | Link the report and preserve reconciliation-required status in the report transaction. | 1 |
| 4 | Existing job | Transition `VALIDATED` to `FAILED_REVIEW_REQUIRED` at expected version 5. | 1 |
| 5 | Existing job | Transition `FAILED_REVIEW_REQUIRED` to `RECONCILIATION_REQUIRED` at expected version 6. | 1 |
| 6 | Audit event | Append deterministic next sequence 3 with truthful owner-adoption semantics. | 1 |
| 7 | Existing lease | Finalize the proven active lease as `RECONCILIATION_REQUIRED`. | 1 |

FIRESTORE_JOB_UPDATE_MAX=3
FIRESTORE_LEASE_UPDATE_MAX=2
FIRESTORE_REPORT_CREATE_MAX=1
FIRESTORE_AUDIT_CREATE_MAX=1
FIRESTORE_ATTACHMENT_CREATE_MAX=0
EXACT_SUCCESS_WRITE_BUDGET=7

GMAIL_MAX_WRITES=0
DRIVE_MAX_WRITES=0
SHEETS_MAX_WRITES=0
SCRIPT_PROPERTY_MAX_WRITES=0
TRIGGER_MAX_WRITES=0
DESTRUCTIVE_MAX_OPERATIONS=0

INITIAL_EXPECTED_JOB_VERSION=4
REPORT_TRANSACTION_EXPECTED_VERSION=4
FIRST_TRANSITION_EXPECTED_VERSION=5
SECOND_TRANSITION_EXPECTED_VERSION=6
FINAL_EXPECTED_JOB_VERSION=7
STATE_TRANSITION_PATH=VALIDATED_TO_FAILED_REVIEW_REQUIRED_TO_RECONCILIATION_REQUIRED
DIRECT_VALIDATED_TO_RECONCILIATION_REQUIRED=PROHIBITED

## Fresh Preconditions

No write occurs until one fresh under-lock snapshot proves every row below.

| Gate | Required value | Failure behavior |
| --- | --- | --- |
| Canonical configuration | Five valid values; candidate and invoice identities aligned | `BLOCKED_D7_E4B_PRECONDITION_CHANGED`, zero writes |
| Prior temporary marker | D7-E4A1 marker absent | Same fail-closed result |
| Exact Firestore cardinality | One exact job; zero non-exact candidates; known complete outcome | Same fail-closed result |
| Job | `VALIDATED`, version 4, reconciliation-required, exact persisted identity | Same fail-closed result |
| Commit plan | Present; exact job and XML/PDF content identities; one line | Same fail-closed result |
| Lease | Reconciliation-required; exact job, fence, and positive generation | Same fail-closed result |
| Audit list | Exactly two events; list complete | Same fail-closed result |
| Report list | Exactly one valid report; list complete and latest link valid | Same fail-closed result |
| Attachment registry | Exact XML and PDF attachment records both absent | Same fail-closed result |
| Sheet | Exact committed row present and immutable commit-plan fields match | Same fail-closed result |
| Drive | Exactly one matching XML and one matching PDF content hash within the bounded complete scan | Same fail-closed result |

FRESH_PREFLIGHT_IMPLEMENTED=YES
CARDINALITY_RECHECK_IMPLEMENTED=YES
CANONICAL_CONFIG_GATE_IMPLEMENTED=YES
JOB_STATE_VERSION_GATE_IMPLEMENTED=YES
COMMIT_PLAN_GATE_IMPLEMENTED=YES
LEASE_FENCE_GATE_IMPLEMENTED=YES
AUDIT_CARDINALITY_GATE_IMPLEMENTED=YES
REPORT_CARDINALITY_GATE_IMPLEMENTED=YES
ATTACHMENT_ABSENCE_GATE_IMPLEMENTED=YES
SHEET_UNCHANGED_GATE_IMPLEMENTED=YES
DRIVE_UNCHANGED_GATE_IMPLEMENTED=YES

The Sheet check derives its exact identity and immutable business fields from the persisted commit plan. The Drive check reads the configured target folder only, is capped at 20 files, and fails closed if the complete folder cannot be proven within that bound. It does not rediscover a Gmail candidate and does not rebuild or replay the original import plan.

## Lease And Concurrency

Lease reacquisition is a dedicated narrow transaction. It requires the exact deterministic fence already stored on the lease and the exact generation observed by the fresh snapshot. It only accepts `RECONCILIATION_REQUIRED`, increments generation once, assigns the D7-E4B lease owner, and rejects an active or foreign lease. Finalization requires that exact new generation, fence, owner, and active status.

Every job update uses optimistic version control. The report transaction starts at version 4 and returns version 5. The two legal state transitions require versions 5 and 6 and produce final version 7. There is no blind job update.

## Failure-Path Bound

FAILURE_PATH_WRITE_BUDGET_BOUND_DEFINED=YES
FAILURE_PATH_MAX_FIRESTORE_WRITE_COUNT=7
FAILURE_PATH_LEASE_FINALIZATION_ATTEMPTS_MAX=1

A known failure after lease acquisition attempts exactly one fenced lease finalization only while the acquired lease identity and generation remain proven. Depending on the known failure point, the total confirmed write count is 2 through 7. The same immutable category maxima apply, so failure handling cannot exceed the success budget.

An unknown write outcome is different: no later write and no lease cleanup write is attempted because the remote state cannot safely be assumed. This prevents a speculative retry or an additional deterministic identity.

UNKNOWN_WRITE_POLICY_IMPLEMENTED=YES
UNKNOWN_WRITE_OUTCOME_STATUS=UNKNOWN_WRITE_OUTCOME_REQUIRES_OWNER_REVIEW
UNKNOWN_WRITE_AUTOMATIC_RETRY=NO
UNKNOWN_WRITE_AUTOMATIC_LEASE_FINALIZATION=NO

## Report, Audit, And Attribution

DETERMINISTIC_REPORT_ID_IMPLEMENTED=YES
DETERMINISTIC_AUDIT_ID_IMPLEMENTED=YES
IDEMPOTENT_REPLAY_IMPLEMENTED=YES

The deterministic report identity binds the exact job, owner disposition, initial version 4, and seven-write semantics. The event is fixed to the exact job-scoped next sequence identity `evt_000003`. A confirmed final snapshot with report count 2, audit count 3, and both deterministic identities returns a zero-write no-op.

The report and audit state only that the owner adopted the existing Sheet row as unknown external state. They retain `SHEET_ROW_CREATOR=UNKNOWN` and `SHEET_ROW_ATTRIBUTION=ATTRIBUTION_UNPROVEN`. They do not claim that D7-E created the row, that the original transaction completed, or that Drive/Sheet repair occurred. No attachment records are created.

## Post-Write Read-Only Verification

POST_WRITE_READBACK_IMPLEMENTED=YES

A future confirmed execution must freshly read back and prove:

- exactly one Firestore job;
- job status and reconciliation status both `RECONCILIATION_REQUIRED`;
- final job version 7;
- exactly two complete reconciliation reports with the deterministic report present;
- exactly three complete audit events with the deterministic event present;
- zero attachment records;
- reconciliation-required lease;
- unchanged exact Sheet and Drive evidence;
- all Gmail, Drive, Sheets, Script Property, trigger, and destructive counters remain zero.

Verification itself is read-only. A mismatch returns `BLOCKED_D7_E4B_POST_WRITE_VERIFICATION_MISMATCH`; it does not start compensation or external repair.

## Local Validation

FOCUSED_TEST_CASE_COUNT=45
REQUIRED_SCENARIO_COUNT=39
TEST_RESULT=PASS_45_OF_45
AFFECTED_D7_TEST_RESULT=PASS_96_OF_96
D7_E4B_CHECKER_RESULT=PASS
AGGREGATE_CHECK_RESULT=PASS_706_TOTAL_705_PASS_1_INTENTIONAL_SKIP_0_FAIL
SENSITIVE_DATA_SCAN_RESULT=PASS
GIT_DIFF_CHECK_RESULT=PASS

## Source Sync

APPS_SCRIPT_PROJECT=Ton kho - DATABASE
SOURCE_SYNC_REQUIRED=YES
CLASP_PUSH_RUN=YES_NORMAL_NON_FORCE
CLASP_PUSH_RESULT=PASS_PUSHED_79_FILES
REMOTE_SOURCE_HASH_MATCH=YES
REMOTE_ENTRYPOINT_HASH_MATCH=YES
REMOTE_RUNTIME_FACTORY_COUNT=1
REMOTE_PUBLIC_ENTRYPOINT_COUNT=1
REMOTE_D7_E4B_RUNTIME_FILE_COUNT=1
MANIFEST_SEMANTIC_HASH_MATCH=YES
SOURCE_SYNC_PROVEN=YES

The root runtime file and `Operator_Entrypoints.js` are intended Apps Script sources. Local `.mjs` tests/checkers and this Markdown evidence are not Apps Script source files. Only a normal non-force `clasp push` is permitted after all validation passes. No `clasp run` is permitted.

## Next Owner Action

The next phase may configure the exact D7-E4B marker and invoke the dedicated entrypoint once only after separately refreshing the production preconditions and approving the one-job seven-write contract.

NEXT_PHASE=D7_E4B2_OWNER_APPROVED_SINGLE_EXACT_RECONCILIATION_EXECUTION
NEXT_PHASE_RECOMMENDED_MODEL=GPT-5.6_SOL
NEXT_PHASE_RECOMMENDED_REASONING=CHUYEN_SAU
SAFE_NEXT_ACTION=AFTER_SOURCE_PARITY_PROOF_OWNER_MAY_CONFIGURE_THE_DEDICATED_MARKER_AND_AUTHORIZE_ONE_ENTRYPOINT_EXECUTION

RUNTIME_SOURCE_CHANGED=YES
DOCS_CHANGED=YES
CHECKER_CHANGED=YES
TESTS_CHANGED=YES
UNEXPECTED_FILES_CHANGED=NO_GUARD_ONLY_PATHS_PRESERVED

FINAL_STATUS=PASS_D7_E4B1_EXACT_RECONCILIATION_RUNTIME_READY_NOT_EXECUTED
