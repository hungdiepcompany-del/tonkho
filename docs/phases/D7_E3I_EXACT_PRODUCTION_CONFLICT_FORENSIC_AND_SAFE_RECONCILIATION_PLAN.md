# D7-E3I Exact Production Conflict Forensic And Safe Reconciliation Plan

PHASE=D7_E3I_EXACT_PRODUCTION_CONFLICT_FORENSIC_AND_SAFE_RECONCILIATION_PLAN
MODE=LOCAL_IMPLEMENTATION_AND_TEST_ONLY
CORRECTIVE_MODE=LOCAL_CORRECTIVE_IMPLEMENTATION_AND_TEST_ONLY
PRODUCTION_EXECUTION=NOT_RUN
CLASP_PUSH=NOT_RUN
DEPLOY=NOT_RUN
RUNTIME_MUTATION=NONE
REPAIR_EXECUTION=NONE
RECONCILIATION_WRITE=NONE
COMMIT_CREATED=NO
D7_E3N_TO_Q_PERMISSION_DIAGNOSTIC_CORRECTIVE=IMPLEMENTED
SOURCE_DIAGNOSTIC_DEFECT_FOUND=YES
PRODUCTION_PERMISSION_PROBE=NOT_RUN
OWNER_ACTION_SCOPE=MINIMUM_REAUTH_OR_ACL_REVIEW_AFTER_FRESH_DIAGNOSTIC_ONLY

## Objective

D7-E3I introduces a fail-closed, read-only forensic runner for one exact D7-E candidate. The runner is designed to produce a deterministic evidence snapshot, ordered findings, one primary classification, and a review-only reconciliation plan across Gmail, Drive XML/PDF artifacts, the canonical Sheet row, and deterministic Firestore durable state.

This phase is local implementation and validation only. The production read-only entrypoint was not executed, source was not synced to Apps Script, and no deployment was performed.

## Read-Only Boundary

The runner returns explicit zero counters for Gmail, Drive, Sheets, Firestore, trigger, destructive, repair, reconciliation-write, and production mutation counts. It accepts only injected read-only adapters in tests and does not call D7-E, D6J, repair, mutation, trigger, deployment, or source-sync entrypoints.

The public entrypoint exists for a later owner-gated source-sync and production read-only execution review. The test suite verifies that the public production entrypoint is not invoked locally.

## Evidence Versus Inference

Evidence claims carry `status`, `confidence`, `evidenceSource`, and `reasonCode`.

Allowed confidence values are:

- `PROVEN`
- `SUPPORTED`
- `UNPROVEN`
- `UNAVAILABLE`

Inference is never labeled as `PROVEN`. Row existence, timestamp proximity, file existence, or resource presence alone cannot prove D7-E attribution or successful completion.

## Drive Zero-Byte Decision Table

| Condition | Classification | Plan Direction |
| --- | --- | --- |
| `candidateCount=1`, `metadataReadStatus=READ_OK`, `contentReadStatus=READ_OK`, `metadataSizeExplicitlyObserved=YES`, `contentBytesExplicitlyObserved=YES`, metadata size is zero, blob length is zero, `readerFallbackPossible=NO`, and no structured read error exists | `ACTUAL_ZERO_BYTE_FILE` | `BOUNDED_DRIVE_REPLACEMENT_REVIEW_REQUIRED` |
| Metadata size is zero and fallback empty bytes exist, but either metadata or content success is absent or unproven | `ZERO_BYTE_UNPROVEN` or `DRIVE_FORENSICS_INCOMPLETE` | `FRESH_READ_ONLY_RERUN_REQUIRED` |
| Metadata size is greater than zero and an explicit successful content read returns zero bytes | `READER_EMPTY_FALLBACK_SUSPECTED` | `READBACK_READER_FIX_REQUIRED` |
| Content read is denied, throws, or reports a transport failure | `CONTENT_READ_BLOCKED` | `FRESH_READ_ONLY_RERUN_REQUIRED` |
| Metadata read is denied, throws, or reports a transport failure | `METADATA_READ_BLOCKED` | `FRESH_READ_ONLY_RERUN_REQUIRED` |
| Blob length is zero but metadata size is unavailable or untrusted | `ZERO_BYTE_UNPROVEN` | `FRESH_READ_ONLY_RERUN_REQUIRED` |
| Successful non-empty content read hashes differently from the exact source hash | `CONTENT_HASH_MISMATCH` | `BOUNDED_DRIVE_REPLACEMENT_REVIEW_REQUIRED` |
| Successful metadata and content sizes differ | `METADATA_CONTENT_SIZE_MISMATCH` | `BOUNDED_DRIVE_REPLACEMENT_REVIEW_REQUIRED` |

The empty-content SHA-256 is not accepted as proof of actual empty content. Content hashing is performed only when `contentReadStatus=READ_OK` and `contentBytesExplicitlyObserved=YES`; failed reads and untrusted fallback empty bytes are not hashed as file content.

## Sheet Attribution Decision Table

| Condition | Attribution Status | Classification Effect |
| --- | --- | --- |
| Deterministic D7-E job identity is exact, immutable commit plan contains the expected Sheet transaction identity, the exact canonical row identity matches that plan, and an audit event or attachment/transaction record links the job to that exact row identity | `ATTRIBUTION_PROVEN_D7_E` | Can support completed-state classification when all systems are consistent |
| Durable evidence proves another actor or process created the exact row and links that source to the exact row identity | `ATTRIBUTION_PROVEN_EXTERNAL` | `EXTERNAL_USER_CREATED_STATE` |
| The row exists and matches, but durable attribution is absent | `ATTRIBUTION_UNPROVEN` | `PARTIAL_UNKNOWN_OUTCOME` |
| Caller supplies an attribution label without durable row-linkage evidence | `ATTRIBUTION_UNPROVEN` | Label-only attribution is prohibited |
| Timestamp proximity only | `ATTRIBUTION_UNPROVEN` | Not attribution proof |
| Matching business identity only | `ATTRIBUTION_UNPROVEN` | Not attribution proof |
| Matching InvoiceKey or HashIndex only | `ATTRIBUTION_UNPROVEN` | Not attribution proof |
| D7-E and external attribution evidence both link the exact row | `ATTRIBUTION_UNPROVEN` with conflict evidence | Fail closed as incomplete or conflict; do not choose one |

Sheet repair is recommended only for proven exact row identity or content conflict. Attribution unproven alone is insufficient for repair.

## Firestore Evidence Model

D7-E3I distinguishes the deterministic job, job state, version/update evidence, immutable identity, commit plan, expected Drive identities, expected Sheet transaction identity, attachment records, audit events, worker lease, reconciliation report, reconciliation-required state, idempotency evidence, and historical write-outcome evidence.

A completed Firestore job alone is not sufficient for `CONSISTENT_ALREADY_COMPLETED`. Consistent completion requires exact job identity, exact immutable commit plan, exact expected Drive identities, exact expected Sheet transaction identity, and durable evidence linking the deterministic job to the exact Sheet row.

Firestore state can be:

- `FIRESTORE_STATE_CONSISTENT`
- `FIRESTORE_JOB_ABSENT`
- `FIRESTORE_JOB_IDENTITY_CONFLICT`
- `FIRESTORE_JOB_STATE_CONFLICT`
- `FIRESTORE_COMMIT_PLAN_ABSENT`
- `FIRESTORE_COMMIT_PLAN_CONFLICT`
- `FIRESTORE_ATTACHMENT_EVIDENCE_ABSENT`
- `FIRESTORE_AUDIT_EVIDENCE_ABSENT`
- `FIRESTORE_LEASE_CONFLICT`
- `FIRESTORE_RECONCILIATION_CONFLICT`
- `FIRESTORE_READ_BLOCKED`
- `FIRESTORE_FORENSICS_INCOMPLETE`

No reconciliation event or durable state update is written in this phase.

## Permission Diagnostic Taxonomy

D7-E3N to Q hardened the D7-E3I diagnostic contract after a manual production run returned repeated generic read-permission blockers without enough channel-level attribution to distinguish OAuth, resource ACL, execution identity, Firestore IAM, transport, missing resource, or adapter-classification defects.

The corrective adds a read-only `PERMISSION_DIAGNOSTICS` result block with:

- `GMAIL_PERMISSION_STATUS`
- `DRIVE_XML_PERMISSION_STATUS`
- `DRIVE_PDF_PERMISSION_STATUS`
- `SHEETS_PERMISSION_STATUS`
- `FIRESTORE_PERMISSION_STATUS`

Each channel reports sanitized `status`, `reasonCode`, `safeErrorClass`, `authorizationType`, `resourceAccessStatus`, and `executionIdentityStatus`. Repeated finding codes are also emitted with channel attribution as `channelFindingCodes`.

Supported reason codes are:

- `OAUTH_SCOPE_MISSING`
- `OAUTH_REAUTHORIZATION_REQUIRED`
- `RESOURCE_ACCESS_DENIED`
- `EXECUTION_IDENTITY_MISMATCH`
- `FIRESTORE_AUTHORIZATION_FAILED`
- `FIRESTORE_PROJECT_OR_DATABASE_MISMATCH`
- `INVALID_EXACT_RESOURCE_REFERENCE`
- `TRANSPORT_FAILED`
- `RESOURCE_NOT_FOUND`
- `ADAPTER_PERMISSION_CLASSIFICATION_INCOMPLETE`
- `UNKNOWN_READ_BLOCKER`

The source corrective does not add OAuth scopes and does not execute a production permission probe. The minimum-scope matrix is documented in the runtime output; `BROAD_SCOPE_ADDITION_REQUIRED=NO`, `CLOUD_PLATFORM_SCOPE_REQUIRED=NO`, and `PRODUCTION_PERMISSION_PROBE_EXECUTED=NO`.

## D7-E3R Exact Bounded Adapters

D7-E3R adds real exact bounded production read-only adapters for the D7-E3I runner. When `D7_E3R_ExactBoundedProductionReadOnlyAdapters.js` is loaded, D7-E3I prefers those readers before the previous unavailable-reader fallback.

The D7-E3R adapter path keeps the same D7-E3I safety model:

- Gmail is bounded to the D7-B exact candidate contract.
- Drive XML/PDF reads are bounded to exact D7-E plan targets and content hashes.
- Sheets reads are bounded to one exact A:P production ledger row.
- Firestore reads are bounded to exact document GETs for the deterministic job, lease, attachment records, and one optional reconciliation report.
- No Script Properties, trigger, Gmail, Drive, Sheets, Firestore, deploy, repair, or D7-E mutation call is introduced.

When all five real readers run, D7-E3I reports `READER_DIAGNOSTICS.REAL_ADAPTER_INVOCATION_PROVEN=YES` and `PERMISSION_DIAGNOSTICS.PRODUCTION_PERMISSION_PROBE_EXECUTED=YES`. If the D7-E3R source is absent, D7-E3I still fails closed through the original placeholder diagnostics.

## Classification Precedence

The runner chooses exactly one primary classification using this order:

1. `FORENSICS_INCOMPLETE`
2. `MULTI_SYSTEM_CONFLICT`
3. `DRIVE_CONTENT_CONFLICT`
4. `SHEET_IDENTITY_CONFLICT`
5. `FIRESTORE_STATE_CONFLICT`
6. `EXTERNAL_USER_CREATED_STATE`
7. `PARTIAL_UNKNOWN_OUTCOME`
8. `PARTIAL_CONFIRMED_MUTATION`
9. `CONSISTENT_ALREADY_COMPLETED`

`CONSISTENT_ALREADY_COMPLETED` requires mutually consistent exact Gmail, Drive, Sheet, Firestore, commit-plan, and attribution-linkage evidence. It is not inferred from resource presence, row existence, label-only attribution, timestamp proximity, or completed job state alone.

## Reconciliation Plan Types

All plans are review-only and contain `automaticExecutionAllowed=NO`.

- `NO_ACTION_REQUIRED`
- `READBACK_READER_FIX_REQUIRED`
- `POST_HOC_RECONCILIATION_EVENT_REVIEW_REQUIRED`
- `FIRESTORE_STATE_RECONCILIATION_REVIEW_REQUIRED`
- `BOUNDED_DRIVE_REPLACEMENT_REVIEW_REQUIRED`
- `BOUNDED_SHEET_REPAIR_REVIEW_REQUIRED`
- `OWNER_MANUAL_REVIEW_REQUIRED`
- `FRESH_READ_ONLY_RERUN_REQUIRED`

No plan step performs repair, replacement, append, transition, retry, reconciliation write, or any other mutation.

## Zero-Mutation Guarantees

The implementation and tests enforce:

- `GMAIL_MUTATION_COUNT=0`
- `DRIVE_MUTATION_COUNT=0`
- `SHEETS_MUTATION_COUNT=0`
- `FIRESTORE_MUTATION_COUNT=0`
- `TRIGGER_MUTATION_COUNT=0`
- `DESTRUCTIVE_OPERATION_COUNT=0`
- `REPAIR_OPERATION_COUNT=0`
- `RECONCILIATION_WRITE_COUNT=0`
- `PRODUCTION_MUTATION_COUNT=0`

The runtime source contains no mutation adapters, deploy commands, source-sync commands, destructive commands, or production mutation entrypoint calls.

## Local Validation Scope

The local validation suite covers 83 synthetic cases, including exact consistency, absent or ambiguous Gmail candidates, source hash conflicts, explicit Drive zero-byte proof, missing Drive read statuses, reader fallback suspicion, fallback bytes after failed reads, read blockers, durable Sheet attribution derivation, label-only attribution rejection, timestamp-only rejection, InvoiceKey/HashIndex-only rejection, completed-job-without-row-linkage rejection, conflicting attribution evidence, Firestore durable state conflicts, unknown and confirmed D7-E outcomes, concurrency mismatch, bounded-query overflow, sanitization, zero mutation counters, deterministic output, source-shape safety, and channel-level permission diagnostics across OAuth, ACL, execution identity, Firestore IAM, transport, not-found, adapter-diagnostic, and unknown blocker cases.

## Next Owner-Gated Phase

NEXT_OWNER_GATED_PHASE=SOURCE_SYNC_AND_READ_ONLY_PRODUCTION_EXECUTION_REVIEW

Before any production read-only execution, the owner must separately approve source sync and the exact production read-only run. This phase does not authorize mutation, repair, reconciliation writes, Apps Script deployment, Firebase deployment, or Git publication.
