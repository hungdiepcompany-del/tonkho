# D7-D Bounded Production Pilot Execution Plan

PHASE=D7_D_BOUNDED_PRODUCTION_PILOT_EXECUTION_PLAN
PHASE_BUNDLE=D7_C_PLUS_D7_D

READ_ONLY_MODE=YES
PLAN_ONLY=YES
PRODUCTION_MUTATION=NONE

## Candidate Dependency

D7_C_STATUS=BLOCKED_CANDIDATE_NOT_ELIGIBLE
D7_C_BLOCKERS=BLOCKED_EVIDENCE_INCOMPLETE
D7_D_STATUS=PASS_BLOCKED_EXECUTION_READINESS_PLAN_RECORDED
D7_E_OPENED=false

D7-D records the future pilot contract but does not make the owner approval marker actionable while D7-C is blocked. The missing item is a sanitized D7-B runtime discovery result proving exactly one eligible candidate and all duplicate/idempotency gates.

## Mutation Budget

MAX_GMAIL_CANDIDATES=1
MAX_INVOICES=1
MAX_PDF_ATTACHMENTS=1
MAX_XML_ATTACHMENTS=1
MAX_DRIVE_FILES_CREATED=2
MAX_SHEET_ROWS_INSERTED=1
MAX_SHEET_ROWS_UPDATED=0
MAX_FIRESTORE_JOBS_CREATED=1
MAX_FIRESTORE_ATTACHMENT_RECORDS_CREATED=2
MAX_TRIGGER_CHANGES=0

The future D7-E pilot must use the strictest existing repository limits if any later evidence narrows these values.

## Preconditions

| Area | Required Precondition |
| --- | --- |
| Repository baseline | Branch `main`, HEAD equals `origin/main`, no unrelated dirty paths, guard dirt preserved outside staging. |
| Remote Apps Script source | D7-B/D7-E runtime source hash parity must be reverified from sanitized source evidence. |
| Script Properties | Required property names must already exist or be explicitly approved by a separate phase; D7-D does not set them. |
| Gmail candidate identity | D7-B must prove exactly one candidate, bounded message/thread cardinality, sender/date/subject constraints and expected attachment set. |
| Drive destination | Destination must be identified by sanitized evidence, duplicate checks must include filename and content identity, and planned create count must be bounded. |
| Sheets schema | Target spreadsheet and sheet contract must pass header/schema validation before any write plan is actionable. |
| Duplicate status | Gmail, Drive, Sheets and Firestore duplicate checks must be `NO_EXISTING_MATCH`, `EXACT_MATCH`, `LEGACY_MATCH` or `CANONICAL_MATCH` according to the existing contract; `CONFLICT` or `UNKNOWN` blocks. |
| Firestore state | Allowed collection boundary, job identity, attachment record identity and active lease state must be known. |
| Lock availability | Existing Apps Script lock and durable lease contracts must be available before mutation. |
| Kill switch | Any existing kill switch or disabled-processing flag must be checked and must allow the one-candidate pilot. |
| Retry policy | Retry must be idempotent and must not widen the candidate scope. |
| Mutation budget | The exact D7-D mutation budget must be enforceable before the first mutation. |
| Owner approval marker | `OWNER_APPROVE_D7E_ONE_CANDIDATE_PRODUCTION_PILOT` must be supplied in a later phase after D7-C passes. |

## Owner Approval Marker

OWNER_APPROVAL_MARKER=OWNER_APPROVE_D7E_ONE_CANDIDATE_PRODUCTION_PILOT
OWNER_MARKER_ACTIONABLE=NO_UNTIL_BLOCKERS_RESOLVED

The marker is a future gate only. It does not approve D7-E while D7-C remains blocked, and it does not approve broad scanning, trigger creation, deployment, source sync, repair or batch processing.

## Future Execution Sequence

1. Acquire the existing lock or durable lease for the single approved candidate.
2. Re-read and revalidate the bounded candidate with the D7-B read-only discovery contract.
3. Recheck idempotency across Gmail, attachment identity, Drive, Sheets and Firestore.
4. Establish or verify one bounded Firestore job state within the allowed collection contract.
5. Process the approved XML/PDF attachments only after identity still matches.
6. Create at most the bounded Drive files only when Drive duplicate checks remain safe.
7. Insert exactly one Sheets row only if the Sheet schema still matches and no duplicate/conflict appeared.
8. Update Firestore state and attachment metadata according to the existing durable job contract.
9. Project Gmail completion labels only after canonical completion if the current runtime contract requires it.
10. Record sanitized audit evidence.
11. Release the lock or durable lease.
12. Run read-only reconciliation and record mutation-budget proof.

## Commit Boundary

IRREVERSIBLE_COMPLETION_STATE_BEFORE_CANONICAL_COMMIT=FORBIDDEN
GMAIL_COMPLETED_LABEL_AS_SOLE_SOURCE_OF_TRUTH=FORBIDDEN

The future pilot must not make the candidate appear completed when Drive creation failed, Sheets insert failed, Firestore state failed, identity changed, a duplicate appeared, or lock ownership was lost. Canonical completion requires the Sheets ledger and durable state to agree with the attachment and Drive evidence.

## Idempotency Design

CANONICAL_INVOICE_IDENTITY=REQUIRED_FROM_XML_AND_BUSINESS_FIELDS
INVOICE_KEY=REQUIRED
ATTACHMENT_IDENTITY=REQUIRED_FOR_XML_AND_PDF
JOB_IDENTITY=REQUIRED_DETERMINISTIC
EXISTING_FILE_BEHAVIOR=REUSE_ONLY_IF_IDENTITY_MATCHES
EXISTING_ROW_BEHAVIOR=NO_INSERT_WHEN_CANONICAL_MATCH_EXISTS
PARTIAL_COMPLETION_BEHAVIOR=REQUIRES_RECONCILIATION
SAFE_RESUME_BEHAVIOR=RESUME_ONLY_WITH_SAME_IDENTITY_AND_OWNED_STATE
IDEMPOTENCY_PLAN_DEFINED=YES

Retries must not create a second Drive copy, second Sheets row or second Firestore job for the same canonical invoice identity.

## Failure Containment

| Condition | Required Behavior |
| --- | --- |
| Gmail ambiguity | Stop before mutation. |
| Attachment mismatch | Stop before mutation. |
| Drive conflict | Stop before Drive write or stop before further mutation if detected later. |
| Sheets conflict | Stop before Sheets write. |
| Firestore conflict | Stop before mutation or move to reconciliation if already partially committed. |
| Timeout | Stop, preserve audit, require reconciliation before retry. |
| Lock expiry | Stop and require owner review or reconciliation. |
| Transient service failure | Retry only inside the existing bounded retry policy; otherwise fail closed. |
| Duplicate discovered after initial review | Stop before next mutation. |
| Partial Drive success | Require reconciliation; do not insert Sheets row unless the Drive state is provably the intended artifact. |
| Partial Firestore success | Require reconciliation; do not project Gmail completion from Firestore alone. |
| Sheet insert failure | Require reconciliation; do not mark Gmail complete. |

FAILURE_CONTAINMENT_DEFINED=YES

## Reconciliation Plan

POST_EXECUTION_GMAIL_STATE_CHECK=REQUIRED_READ_ONLY
POST_EXECUTION_DRIVE_FILE_COUNT_AND_HASH_CHECK=REQUIRED_READ_ONLY
POST_EXECUTION_SHEETS_ROW_COUNT_AND_IDENTITY_CHECK=REQUIRED_READ_ONLY
POST_EXECUTION_FIRESTORE_JOB_STATE_CHECK=REQUIRED_READ_ONLY
POST_EXECUTION_ATTACHMENT_RECORD_CHECK=REQUIRED_READ_ONLY
POST_EXECUTION_AUDIT_EVENT_CHECK=REQUIRED_READ_ONLY
POST_EXECUTION_DUPLICATE_COUNT_CHECK=REQUIRED_READ_ONLY
POST_EXECUTION_IDEMPOTENCY_PROOF=REQUIRED_READ_ONLY
POST_EXECUTION_MUTATION_BUDGET_PROOF=REQUIRED_READ_ONLY
RECONCILIATION_PLAN_DEFINED=YES

## Rollback Versus Resume Matrix

| Partial Outcome | Classification |
| --- | --- |
| No mutation started | SAFE_TO_RESUME |
| Gmail read changed before mutation | REQUIRES_OWNER_REVIEW |
| Drive file created but Sheets row absent | REQUIRES_RECONCILIATION |
| Sheets row inserted but Firestore completion absent | REQUIRES_RECONCILIATION |
| Firestore job exists with matching identity and no Sheet row | REQUIRES_RECONCILIATION |
| Firestore job conflict | REQUIRES_OWNER_REVIEW |
| Duplicate discovered after Drive write | REQUIRES_OWNER_REVIEW |
| Wrong Drive file or wrong Sheet row | REQUIRES_COMPENSATING_ACTION |
| Lock ownership lost | REQUIRES_OWNER_REVIEW |

ROLLBACK_RESUME_MATRIX_DEFINED=YES

No destructive rollback is automatic unless a later phase proves an existing tested rollback path and the owner approves it.

## Stop Conditions

The future D7-E pilot must stop before mutation when any of these are true:

- Candidate identity differs from the approved D7-C result.
- Duplicate status changes.
- Sheet schema changes.
- Source hash changes.
- Approval marker is missing.
- Mutation budget cannot be enforced.
- Kill switch blocks processing.
- Lock cannot be acquired.
- Required read-only precheck fails.
- Any required result is `UNKNOWN`.

## D7-E Opening Decision

D7_E_OPENED=false
D7_E_EXECUTION_APPROVED=NO
OWNER_MARKER_ACTIONABLE=NO_UNTIL_BLOCKERS_RESOLVED
NEXT_SAFE_PHASE=D7_B_OWNER_RUN_BOUNDED_READ_ONLY_CANDIDATE_DISCOVERY_ONCE
NEXT_REQUIRED_OWNER_MARKER=NONE_UNTIL_BLOCKERS_RESOLVED

After D7-B runtime evidence is recorded and D7-C passes, a separate owner marker can open D7-E. Until then this plan is readiness documentation only.

## Safety Boundary

GMAIL_MUTATION=NONE
DRIVE_MUTATION=NONE
GOOGLE_SHEETS_MUTATION=NONE
FIRESTORE_MUTATION=NONE
TRIGGER_MUTATION=NONE
SCRIPT_PROPERTY_MUTATION=NONE
CLASP_PUSH_RUN=false
DEPLOY_RUN=false
PRODUCTION_COMMAND_CREATION=NO
PRODUCTION_JOB_CREATION=NO
PRODUCTION_PILOT_EXECUTION=NO
