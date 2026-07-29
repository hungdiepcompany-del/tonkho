# D7-E Safe Execution Channel Contract

PHASE=D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT
STATUS=PASS_D7_E_LOCAL_CHANNEL_IMPLEMENTED_AWAITING_REMOTE_SYNC

LOCAL_SOURCE_IMPLEMENTATION=PASS
D7_E_ENTRYPOINT_EXECUTED=NO
PRODUCTION_MUTATION=NONE
CLASP_PUSH_RUN=false
REMOTE_SOURCE_SYNC=NOT_RUN
NEXT_REQUIRED_OWNER_MARKER=OWNER_APPROVE_D7E_SYNCED_CHANNEL_ONE_CANDIDATE_PRODUCTION_EXECUTION

## Reuse Matrix

| Contract area | D7-E decision |
| --- | --- |
| candidate rediscovery | REUSE_CURRENT_MODULE |
| candidate fingerprint | REUSE_CURRENT_MODULE |
| attachment identity | REUSE_CURRENT_MODULE |
| Drive duplicate check | REUSE_CURRENT_MODULE |
| Sheets schema check | REUSE_CURRENT_MODULE |
| Firestore duplicate check | REUSE_CURRENT_MODULE |
| Drive write | REUSE_AUDITED_PRIVATE_HELPER |
| Sheet append | REUSE_AUDITED_PRIVATE_HELPER |
| Firestore durable job store | REUSE_AUDITED_PRIVATE_HELPER |
| Firestore lease | REUSE_AUDITED_PRIVATE_HELPER |
| approval marker | IMPLEMENT_D7_E_SPECIFIC |
| mutation counting | IMPLEMENT_D7_E_SPECIFIC |
| idempotent rerun | IMPLEMENT_D7_E_SPECIFIC |
| reconciliation classification | IMPLEMENT_D7_E_SPECIFIC |

BLOCKED_CONTRACT_UNKNOWN=0

## Execution Safety

D7-E is a new operator entrypoint and does not call the frozen historical D6J-C public entrypoint. The old D6J-C approval marker is explicitly blocked and cannot satisfy the D7-E approval gate.

The runner must complete these checks before the first write:

- D7-E marker is present.
- Expected candidate fingerprint hash is present and valid.
- Expected invoice-key hash is present and valid.
- Expected attachment-set hash is present and valid.
- Fresh D7-B rediscovery returns exactly one approved candidate.
- Candidate fingerprint, invoice-key hash, and attachment-set hash match the expected values.
- Duplicate status is non-conflicting and safe.
- Sheet schema validation passes.
- Apps Script lock and durable lease are acquired.

## Failure Policy

Any unknown, conflicting, missing, over-budget, or stale state returns a blocked result. Partial writes are surfaced through sanitized counters and reconciliation status. Idempotent no-op is allowed only when an existing durable job is already completed for the same identity.

## Non-Execution Boundary

RUN_CLASP_PUSH=NO
SYNC_APPS_SCRIPT_REMOTE_SOURCE=NO
RUN_THE_D7_E_ENTRYPOINT=NO
CREATE_OR_CHANGE_SCRIPT_PROPERTIES=NO
CREATE_OR_CHANGE_TRIGGERS=NO
PERFORM_PRODUCTION_DATA_MUTATION=NO

NEXT_SAFE_PHASE=D7_E2_APPS_SCRIPT_SOURCE_SYNC_AND_REMOTE_HASH_VERIFICATION
BLOCKER=REMOTE_SOURCE_SYNC_AND_FRESH_OWNER_APPROVAL_REQUIRED
