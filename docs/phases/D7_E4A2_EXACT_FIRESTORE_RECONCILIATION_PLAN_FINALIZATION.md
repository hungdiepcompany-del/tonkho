# D7-E4A2 Exact Firestore Reconciliation Plan Finalization

PHASE=D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_FINALIZATION
MODE=READ_ONLY_EXACT_RECONCILIATION_PLAN_FINALIZATION_NO_PRODUCTION_MUTATION
STARTING_HEAD=21a8cbf814d24a5ea24bd37fff340fe8cce8245f
OWNER_DISPOSITION=ADOPT_CURRENT_EXACT_SHEET_ROW_AS_UNKNOWN_EXTERNAL_STATE
SHEET_ROW_DISPOSITION=ADOPT_AS_UNKNOWN_EXTERNAL_STATE
SHEET_ROW_ATTRIBUTION=ATTRIBUTION_UNPROVEN
SHEET_ROW_CREATOR=UNKNOWN

## Scope And Evidence

The D7-E4A1C owner execution proved exactly one matching Firestore job and no duplicate matching job. This phase performed a separate, bounded Firestore GET/LIST snapshot against that one job only. It used six GET requests: the job document, lease document, two deterministic attachment-record documents, and the job's bounded event and reconciliation-report subcollections. The two child-collection responses had no continuation token.

FIRESTORE_SNAPSHOT_READ_ONLY=YES
FIRESTORE_SNAPSHOT_REQUEST_COUNT=6
FIRESTORE_SNAPSHOT_JOB_COUNT=1
EXACT_FIRESTORE_JOB_CARDINALITY_PROVEN=YES
DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN=YES
CURRENT_JOB_STATUS=VALIDATED
CURRENT_JOB_VERSION=4
CURRENT_JOB_COMMIT_PLAN_PRESENT=YES
CURRENT_JOB_COMMIT_PLAN_JOB_ID_MATCH=YES
CURRENT_JOB_RECONCILIATION_STATUS=RECONCILIATION_REQUIRED
CURRENT_LEASE_STATUS=RECONCILIATION_REQUIRED
CURRENT_AUDIT_EVENT_COUNT=2
CURRENT_AUDIT_EVENT_LIST_COMPLETE=YES
CURRENT_RECONCILIATION_REPORT_COUNT=1
CURRENT_RECONCILIATION_REPORT_LIST_COMPLETE=YES
CURRENT_LATEST_RECONCILIATION_REPORT_PRESENT=YES
CURRENT_ATTACHMENT_RECORD_COUNT=0
CURRENT_XML_ATTACHMENT_RECORD_PRESENT=NO
CURRENT_PDF_ATTACHMENT_RECORD_PRESENT=NO
CANONICAL_PROPERTY_COUNT=5
CANONICAL_PROPERTIES_PREVIOUSLY_VERIFIED=YES
D7_E4A1_OWNER_MARKER_PRESENT=NO

The snapshot is deliberately sanitized. It contains no canonical property values, document identifiers, full hashes, attachment contents, or access tokens.

## Reconciliation Decision

The owner has adopted the exact Sheet row only as unknown external state. That disposition does not establish its creator, does not establish Drive evidence ownership, and does not authorize a Sheet, Drive, Gmail, or attachment-registry repair. The durable job already carries a reconciliation-required report and lease state, while its workflow status remains `VALIDATED`.

The durable transition contract permits `VALIDATED -> FAILED_REVIEW_REQUIRED -> RECONCILIATION_REQUIRED`. It does not permit a direct `VALIDATED -> RECONCILIATION_REQUIRED` transition. D7-E4B must preserve this state-machine contract and must not represent adoption as `COMPLETED`.

TARGET_JOB_STATUS=RECONCILIATION_REQUIRED
TARGET_RECONCILIATION_STATUS=RECONCILIATION_REQUIRED
TARGET_LEASE_STATUS=RECONCILIATION_REQUIRED
TARGET_SHEET_ROW_DISPOSITION=ADOPT_AS_UNKNOWN_EXTERNAL_STATE
TARGET_ATTACHMENT_RECORD_COUNT=0
AUTOMATIC_REPAIR=DISABLED

## Exact D7-E4B Write Plan

The plan applies only when every precondition below is true. It is a new owner-approved reconciliation channel; D7-E4A2 does not add that runtime, push Apps Script source, or execute it.

| Order | Firestore target category | Exact operation | Write count |
| --- | --- | --- | ---: |
| 1 | Existing lease document | Reacquire the exact reconciliation-required lease with its deterministic fence. | 1 |
| 2 | One deterministic reconciliation-report document | Create the owner-adoption report exactly once. | 1 |
| 3 | Existing job document | Save the report linkage and reconciliation status in the same report transaction. | 1 |
| 4 | Existing job document | Transition `VALIDATED` to `FAILED_REVIEW_REQUIRED` with the expected version. | 1 |
| 5 | Existing job document | Transition `FAILED_REVIEW_REQUIRED` to `RECONCILIATION_REQUIRED` with the next expected version. | 1 |
| 6 | One deterministic audit-event document | Append the next sequence event recording the owner adoption disposition. | 1 |
| 7 | Existing lease document | Finalize the lease as `RECONCILIATION_REQUIRED`. | 1 |

FIRESTORE_JOB_CREATE_COUNT=0
FIRESTORE_ATTACHMENT_CREATE_COUNT=0
FIRESTORE_AUDIT_CREATE_COUNT=1
FIRESTORE_RECONCILIATION_REPORT_CREATE_COUNT=1
FIRESTORE_JOB_UPDATE_COUNT=3
FIRESTORE_LEASE_UPDATE_COUNT=2
FIRESTORE_TOTAL_WRITE_COUNT=7
FIRESTORE_WRITE_BUDGET_EXACT=YES
FIRESTORE_WRITE_TARGET_CARDINALITY=ONE_JOB_ONE_LEASE_ONE_REPORT_ONE_AUDIT
GMAIL_WRITE_COUNT=0
DRIVE_WRITE_COUNT=0
SHEETS_WRITE_COUNT=0
SCRIPT_PROPERTY_WRITE_COUNT=0
TRIGGER_WRITE_COUNT=0
DESTRUCTIVE_OPERATION_COUNT=0

The plan does not create either absent attachment record. That would assert artifact provenance that the owner disposition does not establish.

## Preconditions And Concurrency

D7-E4B must fail closed before its first write unless all of the following are true:

1. The five canonical Script Properties are present, format-valid, and align with the candidate and immutable commit plan; the D7-E4A1 temporary marker remains absent.
2. The exact-cardinality proof remains one job, with no non-exact candidate and no read outcome unknown.
3. The direct job read still has status `VALIDATED`, reconciliation status `RECONCILIATION_REQUIRED`, immutable commit plan present, and the exact current optimistic version `4`.
4. The exact lease still belongs to the job, has the expected deterministic fence, and has status `RECONCILIATION_REQUIRED`.
5. The event subcollection still has exactly two complete events and the report subcollection still has exactly one complete report; the current latest-report reference resolves within that single report.
6. The two deterministic attachment records remain absent. Their absence is an adoption boundary, not authorization to create them.

The write channel must use the job version as an optimistic-concurrency precondition at every job update. A version or state mismatch is `BLOCKED_D7_E4B_PRECONDITION_CHANGED` and produces zero reconciliation writes. Lease reacquisition and finalization must use the existing deterministic lease identity and fencing-token checks. The report and audit IDs must be deterministic from the job, owner disposition, and fixed event sequence so that a confirmed retry is idempotent.

IDEMPOTENCY_SCOPE=ONE_EXACT_JOB
REPLAY_POLICY=DETERMINISTIC_REPORT_AND_AUDIT_IDS_ONLY
CONCURRENT_CHANGE_POLICY=BLOCK_BEFORE_WRITE_OR_STOP_WITH_RECONCILIATION_REQUIRED
LEASE_DURATION_MS=600000

## Failure And Rollback Policy

There is no delete, Sheet rollback, Drive rollback, Gmail rollback, or attachment-registry compensation. Each Firestore operation is independently idempotent and the target is always a review-required durable state.

If a post-lease operation has a known failure, D7-E4B must finalize the lease as `RECONCILIATION_REQUIRED` once and return a sanitized error. If a Firestore write outcome is unknown, D7-E4B must stop, retain the unknown-outcome evidence, and require a new owner review; it must not retry by creating a second report or event. Post-write verification is read-only and must confirm: one job, target job and reconciliation statuses, one additional deterministic report, one additional deterministic audit event, zero attachment records, and final lease status `RECONCILIATION_REQUIRED`.

ROLLBACK_POLICY=NO_DELETE_NO_EXTERNAL_COMPENSATION
UNKNOWN_WRITE_OUTCOME_POLICY=STOP_AND_OWNER_REVIEW
POST_WRITE_READ_ONLY_VERIFICATION_REQUIRED=YES
RECONCILIATION_EXECUTED=NO
PRODUCTION_DATA_MUTATION=NONE

## Owner Approval Boundary

This document is a plan only. D7-E4B requires a fresh explicit marker that names this exact one-job, seven-write reconciliation plan. It must not authorize a pilot rerun, a new candidate search, Sheet repair, Drive repair, Gmail changes, attachment-record creation, trigger changes, Script Property changes, deployment, or any different job.

NEXT_PHASE=D7_E4B_OWNER_APPROVED_EXACT_FIRESTORE_RECONCILIATION
NEXT_PHASE_RECOMMENDED_MODEL=GPT-5.6_SOL
NEXT_PHASE_RECOMMENDED_REASONING=CHUYEN_SAU
SAFE_NEXT_ACTION=OBTAIN_A_FRESH_OWNER_MARKER_FOR_THIS_EXACT_SEVEN_WRITE_PLAN
FINAL_STATUS=PASS_D7_E4A2_EXACT_FIRESTORE_RECONCILIATION_PLAN_READY_FOR_OWNER_APPROVAL
