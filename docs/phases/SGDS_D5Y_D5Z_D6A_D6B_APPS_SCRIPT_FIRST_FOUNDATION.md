# SGDS D5Y-D5Z-D6A-D6B Apps Script First Foundation

PHASE=D5Y_D5Z_D6A_D6B_APPS_SCRIPT_FIRST_FOUNDATION
STATUS=PASS_LOCAL_IMPLEMENTATION_VALIDATED

## Architecture Lock

ARCHITECTURE_DECISION_LOCKED=YES
SGDS_RUNTIME_STRATEGY=APPS_SCRIPT_FIRST_NO_BILLING
PRIMARY_WORKER=GOOGLE_APPS_SCRIPT
FILE_STORE=GOOGLE_DRIVE
BUSINESS_LEDGER=GOOGLE_SHEETS
CONTROL_PLANE=FIRESTORE
FRONTEND=FIREBASE_HOSTING_STATIC
AUTHENTICATION=FIREBASE_AUTH_GOOGLE
BILLING_REQUIRED=NO
CLOUD_RUN_STATUS=DEFERRED_OPTIONAL
CLOUD_RUN_PRIMARY_PATH=NO
CLOUD_RUN_BLOCKER_FOR_CURRENT_ROADMAP=NO
CLOUD_RUN_CODE_RETAINED=YES_OPTIONAL_ADAPTER

D5S-D5X proved a local Cloud Run durable orchestrator design, container boundary, auth boundary, and feature-gated Apps Script caller. The deployment blockers found there, including disabled Billing, disabled Cloud Run build APIs, and missing Docker CLI, are no longer blockers for the active product roadmap because the primary worker remains Google Apps Script.

Cloud Run source stays in the repository as an optional future adapter. It must not be deleted merely because it is deferred. Any future proposal to make Cloud Run the primary runtime requires a separate owner-approved architecture decision.

## D5Z Read-Only Baseline

BASELINE_REPORT_STATUS=PASS_REPOSITORY_SAFE_BASELINE
LIVE_BASELINE_VERIFICATION=NOT_LIVE_VERIFIED
BASELINE_COMMAND=baseline:sgds-read-only
BASELINE_EVIDENCE=docs/evidence/SGDS_D5Z_READ_ONLY_BASELINE.md
PRODUCTION_WRITE_ATTEMPTED=NO

The baseline command reads repository files and local git metadata only by default. It does not authenticate interactively, read Script Property values, call production Gmail, mutate Drive, mutate Sheets, write Firestore, run scanners, deploy Firebase, or push Apps Script source.

## D6A Firestore Data Contract

DATA_CONTRACT_LOCKED=YES
JOB_STATE_MACHINE_LOCKED=YES
IDEMPOTENCY_CONTRACT_LOCKED=YES
LEASE_CONTRACT_LOCKED=YES
RETRY_CONTRACT_LOCKED=YES
RECONCILIATION_CONTRACT_LOCKED=YES

CONTRACT_SOURCE=firestoreDataContract.js
SCHEMA_VERSION=SGDS_FIRESTORE_APPS_SCRIPT_FIRST_V1
COLLECTIONS=jobs;gmail_messages;attachments;audit_events;worker_leases;commands;runtime_config;authorized_users
JOB_STATES=discovered;queued;processing;attachment_saved;data_extracted;sheet_written;completed;failed_retryable;failed_terminal;ignored

Firestore stores technical state, checkpoints, retry metadata, leases, audit events, commands, and sanitized reconciliation metadata. Google Drive stores original file bytes. Google Sheets remains the business ledger. Firestore must not silently replace Sheets as the business ledger, and file bytes must not be stored in Firestore.

Every mutable workflow record carries a schema version. Every externally visible write requires an idempotency key. Audit events are append-only in the intended runtime design. Frontend clients must not set jobs directly to `completed`.

## D6B Apps Script Firestore REST Gateway

FIRESTORE_REST_CLIENT=IMPLEMENTED_LOCAL_ONLY
FIRESTORE_VALUE_CODEC=IMPLEMENTED
PATH_VALIDATION=IMPLEMENTED
COLLECTION_ALLOWLIST=IMPLEMENTED
TOKEN_REDACTION=IMPLEMENTED
JOB_REPOSITORY=IMPLEMENTED
AUDIT_REPOSITORY=IMPLEMENTED
LEASE_REPOSITORY=IMPLEMENTED
COMMAND_REPOSITORY_FOUNDATION=IMPLEMENTED

GATEWAY_SOURCE=firestoreRestGateway.js
PRODUCTION_AUTH_DESIGN=APPS_SCRIPT_EXECUTION_OAUTH_TOKEN_AT_RUNTIME
TOKEN_PERSISTENCE=FORBIDDEN
TOKEN_LOGGING=FORBIDDEN
KEY_FILE_MODE=FORBIDDEN
IAM_CREDENTIALS_API_CALL=NOT_USED

The gateway is dependency-injected for tests and future Apps Script runtime integration. It validates document paths, collection allowlists, update masks, idempotency keys, typed values, retryable status codes, and sanitized error output. Production base URL construction is supported, but this phase makes no live production HTTP calls.

## Manifest Review

APPS_SCRIPT_EXTERNAL_REQUEST_SCOPE=PRESENT
APPS_SCRIPT_OPENID_SCOPE=PRESENT
MANIFEST_SCOPE_CHANGE=NO
MANIFEST_SCOPE_CHANGE_REASON=Existing `https://www.googleapis.com/auth/script.external_request` scope supports future Apps Script Firestore REST calls; existing `openid` supports identity token work. No broader scope is added in this phase.

## Validation

UNIT_TESTS=PASS
FIRESTORE_EMULATOR_TESTS=PASS
APPS_SCRIPT_CALLER_TESTS=PASS
LOCAL_SERVICE_TESTS=PASS
ARCHITECTURE_CHECK=PASS
D5Y_D5Z_D6A_D6B_CHECK=PASS
D5S_D5X_REGRESSION_CHECK=PASS
GIT_DIFF_CHECK=PASS

## Prohibited Production Actions

BILLING_CHANGED=NO
GOOGLE_CLOUD_API_CHANGED=NO
SA_KEY_CREATED=NO
CLOUD_RUN_DEPLOY=NOT_RUN
CLASP_PUSH=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
TRIGGER_MUTATION=NONE
GMAIL_MUTATION=NONE
DRIVE_MUTATION=NONE
GOOGLE_SHEETS_MUTATION=NONE
PRODUCTION_FIRESTORE_MUTATION=NONE
PRODUCTION_HTTP_CALL_COUNT=0

## Next

KNOWN_LIMITATIONS=Scanner adapters are not wired to the new Apps Script Firestore gateway in this bundle; production pilot is not started; frontend command queue remains contract-only.
NEXT_ALLOWED_PHASE=D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS
NEXT_ALLOWED_ACTION=Implement local Gmail, Drive, and Sheets adapters against the locked Apps Script-first gateway contract without production mutation.
