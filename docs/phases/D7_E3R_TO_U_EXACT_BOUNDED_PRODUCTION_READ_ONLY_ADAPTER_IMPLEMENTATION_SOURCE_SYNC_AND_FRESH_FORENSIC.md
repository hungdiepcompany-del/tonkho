# D7-E3R To U Exact Bounded Production Read-Only Adapter Implementation

PHASE=D7_E3R_TO_U_EXACT_BOUNDED_PRODUCTION_READ_ONLY_ADAPTER_IMPLEMENTATION_SOURCE_SYNC_AND_FRESH_FORENSIC
MODE=LOCAL_IMPLEMENTATION_SOURCE_SYNC_AND_OWNER_GATED_READ_ONLY_FORENSIC
START_HEAD=1ca7b6a013a2511814e7f87ab6630217391ff86f
RUNTIME_MUTATION=NONE
PRODUCTION_MUTATION=NONE
SCRIPT_PROPERTIES_MUTATION=NONE
TRIGGER_MUTATION=NONE
CLASP_DEPLOY=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
FIRESTORE_RULES_DEPLOY=NOT_RUN
APPSSCRIPT_SCOPE_CHANGE=NO

## Objective

D7-E3R replaces the previous placeholder read adapters reachable from `runD7E3IExactProductionConflictForensicReadOnly` with real, exact, bounded production read-only adapters.

The implementation keeps the D7-E3I forensic runner read-only. It does not rerun D7-E, does not repair the partial D7-E state, does not set Script Properties, and does not write Gmail, Drive, Sheets, or Firestore data.

## Adapter Boundary

GMAIL_ADAPTER=REAL_EXACT_BOUNDED_READ_ONLY
DRIVE_ADAPTER=REAL_EXACT_BOUNDED_READ_ONLY
SHEETS_ADAPTER=REAL_EXACT_BOUNDED_READ_ONLY
FIRESTORE_ADAPTER=REAL_EXACT_BOUNDED_READ_ONLY
PLACEHOLDER_PRODUCTION_PATH=DISABLED_WHEN_REAL_ADAPTERS_LOAD
PRODUCTION_PERMISSION_PROBE=REAL_READER_PATH_ONLY

The D7-E3I runner now prefers the D7-E3R adapter factory and falls back to the old unavailable-reader path only when the adapter source is absent.

## Exact Resource Policy

Gmail reads are bounded to the D7-B exact query contract and require one thread, one message, one XML attachment, and one PDF attachment. The adapter does not select a different thread when cardinality or identity checks fail.

Drive reads use the D7-E mutation plan's exact target file names inside the exact approved folder reference. The adapter checks name, MIME type, byte length, and content hash, and fails closed on duplicate or mismatch evidence.

Sheets reads use one exact configured row and the A:P production ledger width. The adapter does not scan the full sheet and does not infer attribution from row presence alone.

Firestore reads use exact REST document GETs only for the deterministic D7-E job, lease, attachment records, and one optional reconciliation report. The adapter does not query collections and does not write documents.

## Sanitization

The adapter may hold exact production identifiers in memory during an owner-gated production run, but committed evidence must use status fields, counts, and hash prefixes only.

RAW_GMAIL_ID_COMMITTED=NO
RAW_DRIVE_ID_COMMITTED=NO
RAW_FIRESTORE_DOCUMENT_ID_COMMITTED=NO
RAW_BUSINESS_PAYLOAD_COMMITTED=NO
RAW_OAUTH_TOKEN_LOGGED=NO

## Validation Scope

New local coverage includes 54 D7-E3R adapter scenarios and two D7-E3I runner scenarios proving:

- `REAL_BOUNDED_READ_ONLY` reader diagnostics are emitted when all five real adapters are available.
- Placeholder production readers remain fail-closed when the adapter source is unavailable.
- Firestore 200, 404, 403, 429, and 500 responses are classified without leaking tokens.
- Drive duplicate, missing, MIME mismatch, hash mismatch, and ACL failures are bounded.
- Sheets exact-row reads use one A:P row and preserve read-only diagnostics.
- Static source checks reject mutation primitives, broad scans, deploy commands, and Firestore write methods.

## Source Sync And Execution Gate

SOURCE_SYNC_REQUIRED=YES
REMOTE_HASH_VERIFICATION_REQUIRED=YES
GITHUB_SOURCE_COMMIT=60ac7279cb21a3385c4acbda7a294c3f91d839b7
GITHUB_PUSH=PASS
CLASP_PUSH_ATTEMPT_COUNT=1
CLASP_PUSH_RESULT=PASS
CLASP_PUSH_EXIT_CODE=0
REMOTE_PULL_RUN=YES
REMOTE_D7_E3R_FILE_FOUND=YES
REMOTE_D7_E3R_FACTORY_DECLARATION_COUNT=1
REMOTE_D7_E3I_PUBLIC_ENTRYPOINT_DECLARATION_COUNT=1
REMOTE_D7_E3R_HASH_MATCH=YES
REMOTE_D7_E3I_HASH_MATCH=YES
REMOTE_MANIFEST_SEMANTIC_HASH_MATCH=YES
REMOTE_SOURCE_HASH_MATCH=YES
FRESH_PRODUCTION_FORENSIC_EXECUTION=OWNER_GATED
CLASP_RUN_ALLOWED_BY_SOURCE_PHASE=NO
OWNER_MANUAL_RUN_ALLOWED_AFTER_REMOTE_PARITY=YES
NEXT_REQUIRED_OWNER_ACTION=RUN_FRESH_D7_E3I_READ_ONLY_EXACTLY_ONCE

After GitHub and Apps Script source parity are proven, the next safe action is an owner-run fresh D7-E3I read-only forensic execution exactly once from the Apps Script editor or another proven authenticated channel.

This phase does not authorize production mutation, repair, D7-E rerun, trigger changes, Script Property changes, Firebase deployment, Firestore rules deployment, or Apps Script deployment.
