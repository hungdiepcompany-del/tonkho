# D7-E Source Sync And Owner Execution Runbook

PHASE=D7_E_OWNER_APPROVED_ONE_CANDIDATE_PRODUCTION_PILOT
STATUS=PASS_D7_E_LOCAL_CHANNEL_IMPLEMENTED_AWAITING_REMOTE_SYNC

LOCAL_SOURCE_IMPLEMENTATION=PASS
D7_E_ENTRYPOINT_EXECUTED=NO
PRODUCTION_MUTATION=NONE
CLASP_PUSH_RUN=false
REMOTE_SOURCE_SYNC=NOT_RUN
NEXT_REQUIRED_OWNER_MARKER=OWNER_APPROVE_D7E_SYNCED_CHANNEL_ONE_CANDIDATE_PRODUCTION_EXECUTION

## Gate Order

GATE_1=LOCAL_IMPLEMENTATION_PASS
GATE_2=APPS_SCRIPT_REMOTE_SOURCE_SYNC_AND_HASH_VERIFICATION
GATE_3=FRESH_OWNER_EXECUTION_MARKER_AFTER_SYNC

The pre-implementation owner marker has this status:

D7_E_PRE_IMPLEMENTATION_MARKER_STATUS=ACCEPTED_FOR_IMPLEMENTATION_AND_CHANNEL_PREPARATION
D7_E_PRE_IMPLEMENTATION_MARKER_EXECUTION_VALIDITY=NOT_VALID_FOR_POST_IMPLEMENTATION_EXECUTION
D7_E_PRE_IMPLEMENTATION_MARKER_FINAL_STATUS=SUPERSEDED_FOR_EXECUTION_BY_FRESH_POST_SYNC_MARKER

## Source Sync Procedure

Future D7-E2 must verify repository cleanliness and commit parity before remote source sync. It may then sync Apps Script source with a normal push only, clone or pull the remote Apps Script source afterward, and compare normalized source hashes for:

- `D7_E_OwnerApprovedOneCandidateProductionPilot.js`
- `Operator_Entrypoints.js`

No execution is allowed during source sync.

## Owner Execution Procedure

After remote source sync and hash parity pass, the owner must provide:

OWNER_APPROVE_D7E_SYNCED_CHANNEL_ONE_CANDIDATE_PRODUCTION_EXECUTION

Only then may a later phase set the approved D7-E Script Properties, run `runD7EOwnerApprovedOneCandidateProductionPilot` exactly once, collect sanitized result evidence, and clean up temporary properties.

## Future Script Properties

D7_E_SCRIPT_PROPERTY_NAMES_ONLY=YES
D7_E_SCRIPT_PROPERTY_VALUES_RECORDED=NO

- `D7_E_OWNER_APPROVAL_MARKER`
- `D7_E_EXPECTED_CANDIDATE_FINGERPRINT`
- `D7_E_EXPECTED_INVOICE_KEY_HASH`
- `D7_E_EXPECTED_ATTACHMENT_SET_SHA256`

These properties must be set only in a future approved execution phase after remote Apps Script source hash verification. D7-E1 does not create, update, delete, or read production Script Properties.

## Forbidden In D7-E1

RUN_CLASP_PUSH=NO
SYNC_APPS_SCRIPT_REMOTE_SOURCE=NO
RUN_THE_D7_E_ENTRYPOINT=NO
CREATE_OR_CHANGE_SCRIPT_PROPERTIES=NO
CREATE_OR_CHANGE_TRIGGERS=NO
PERFORM_PRODUCTION_DATA_MUTATION=NO

NEXT_SAFE_PHASE=D7_E2_APPS_SCRIPT_SOURCE_SYNC_AND_REMOTE_HASH_VERIFICATION
BLOCKER=REMOTE_SOURCE_SYNC_AND_FRESH_OWNER_APPROVAL_REQUIRED
