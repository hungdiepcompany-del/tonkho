# D7-E3V To X Exact Post-Hoc Attribution And Firestore Reconciliation Decision

PHASE=D7_E3V_TO_X_EXACT_POST_HOC_ATTRIBUTION_AND_FIRESTORE_RECONCILIATION_DECISION
MODE=CONTINUOUS_FAIL_CLOSED_EXACT_READ_ONLY_ATTRIBUTION_AND_DECISION
IMPLEMENTATION_STATUS=SOURCE_VALIDATED_PENDING_REMOTE_SYNC
PRODUCTION_EXECUTION=NOT_RUN
PRODUCTION_DATA_MUTATION=NONE
D7_E_PILOT_RERUN=NO
RECONCILIATION_EXECUTED=NO
RECONCILIATION_PLAN_EXECUTED=NO

## Prior Production Finding

GMAIL_SOURCE_VERIFIED=YES
SHEET_CANONICAL_ROW_EXACT=YES
SHEET_ATTRIBUTION_PROVEN=NO
FIRESTORE_JOB_STATE=VALIDATED_NOT_COMPLETED
UNKNOWN_WRITE_OUTCOME_EVIDENCE_PRESENT=YES
ALL_PRODUCTION_READ_CHANNELS=READ_OK
ZERO_MUTATION_REPORTED_BY_READ_ONLY_FORENSIC=YES

The prior read-only forensic evidence shows a bounded candidate with matching Gmail, Drive, Sheet, and Firestore read channels. It does not prove that the observed Sheet row was created by the D7-E pilot, because durable write linkage is still missing.

## Purpose

D7-E3V adds a read-only attribution diagnostic that decides whether the observed external production state can be attributed to the D7-E pilot, an external or user-created write, a conflict, or an unproven state.

The phase only computes a decision and a next owner-gated plan. It does not create reconciliation records, update Firestore, repair Sheets, replace Drive files, mutate Gmail, modify triggers, or change Script Properties.

## Attribution Requirements

EXACT_DURABLE_LINK_REQUIRED=YES
CONTENT_SIMILARITY_ALONE_ATTRIBUTION_PROHIBITED=YES
GENERIC_UNKNOWN_WRITE_OUTCOME_ATTRIBUTION_PROHIBITED=YES
CALLER_ATTRIBUTION_LABEL_ATTRIBUTION_PROHIBITED=YES

`ATTRIBUTION_PROVEN_D7_E` requires all of:

- exact job identity;
- exact commit-plan identity;
- exact Gmail source identity;
- exact Drive XML identity and content hash;
- exact Drive PDF identity and content hash;
- exact Sheet row identity;
- exact Sheet transaction identity;
- exact Sheet content match;
- at least one exact durable link from write attempt, audit, or attachment record;
- no conflicting attribution evidence;
- no concurrent state change;
- complete read-only evidence.

Content matching alone is insufficient because it can show that production data resembles the expected invoice while still leaving the writer unknown. Generic unknown-write outcome evidence is also insufficient because it confirms ambiguity, not ownership.

## Decisions

Supported attribution decisions:

- `ATTRIBUTION_PROVEN_D7_E`
- `ATTRIBUTION_PROVEN_EXTERNAL_OR_USER_CREATED`
- `ATTRIBUTION_CONFLICT`
- `ATTRIBUTION_UNPROVEN`

Supported reconciliation plan types:

- `NO_ACTION_REQUIRED`
- `POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED`
- `FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED`
- `OWNER_MANUAL_REVIEW_REQUIRED`
- `FRESH_READ_ONLY_RERUN_REQUIRED`

RECONCILIATION_AUTOMATIC_EXECUTION_ALLOWED=NO
AUTOMATIC_RECONCILIATION=DISABLED

## Read-Only Guarantees

GMAIL_MUTATION_COUNT=0
DRIVE_MUTATION_COUNT=0
SHEETS_MUTATION_COUNT=0
FIRESTORE_MUTATION_COUNT=0
TRIGGER_MUTATION_COUNT=0
DESTRUCTIVE_OPERATION_COUNT=0
REPAIR_OPERATION_COUNT=0
RECONCILIATION_WRITE_COUNT=0
PRODUCTION_MUTATION_COUNT=0

D7_E_PILOT_RERUN_ALLOWED=NO
D6J_MUTATION_ENTRYPOINT_ALLOWED=NO
REPAIR_ENTRYPOINT_ALLOWED=NO
D7_E3Y_EXECUTION_ALLOWED=NO

## Validation

Required local validation:

- `node --test tests/unit/d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.test.mjs`
- `node scripts/checkers/check-d7-e3v-exact-post-hoc-attribution-read-only-diagnostic.mjs`
- `npm.cmd test`
- `npm.cmd run check`
- `git diff --check`

## Production Execution Gate

D7_E3V_PRODUCTION_ENTRYPOINT=runD7E3VExactPostHocAttributionReadOnly
PRODUCTION_ENTRYPOINT_EXECUTION=OWNER_MANUAL_GATE_ONLY
READ_ONLY_ATTRIBUTION_ENTRYPOINT_EXECUTION_COUNT=0
OTHER_PRODUCTION_ENTRYPOINT_EXECUTION_COUNT=0

Do not claim a production attribution result until the owner runs the exact D7-E3V read-only entrypoint once in the verified Apps Script project and returns the complete JSON-safe result.

SAFE_NEXT_ACTION=OWNER_RUN_EXACT_D7_E3V_ATTRIBUTION_READ_ONLY_ONCE_AND_RETURN_COMPLETE_RESULT
