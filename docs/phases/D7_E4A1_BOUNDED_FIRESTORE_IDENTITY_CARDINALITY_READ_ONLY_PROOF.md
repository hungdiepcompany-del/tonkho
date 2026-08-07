# D7-E4A1 Bounded Firestore Identity Cardinality Read-Only Proof

PHASE=D7_E4A1_BOUNDED_FIRESTORE_IDENTITY_CARDINALITY_READ_ONLY_PROOF
MODE=BOUNDED_PRODUCTION_READ_ONLY_CARDINALITY_PROOF_NO_MUTATION
OWNER_APPROVAL_MARKER=OWNER_APPROVED_D7_E4A1_BOUNDED_READ_ONLY_PROOF

## Purpose

The D7-E4A recovery record has one deterministic Firestore document observation but does not establish whether zero, one, or multiple exact durable jobs match the D7-E canonical business identity. D7-E4A1 adds a narrowly bounded Apps Script diagnostic to prove that cardinality before any reconciliation discussion.

## Exact Identity Definition

The exact persisted identity is the conjunction of:

- Deterministic `jobId`: `d7e_job_` plus the first 24 hexadecimal characters of the canonical candidate fingerprint.
- Persisted `invoiceIdentityHash`: the durable FNV-1a prefix of the canonical invoice identity hash.
- Persisted `sourceThreadHash`: read from the deterministic document only and required to be an eight-character hash prefix.
- `commitPlan.jobId` equal to the deterministic job ID.
- `commitPlan.driveEvidenceTargets.xmlContentHash` equal to the canonical XML SHA-256.
- `commitPlan.driveEvidenceTargets.pdfContentHash` equal to the canonical PDF SHA-256.
- `commitPlan.expectedLineCount=1` for the approved one-line D7-E candidate.

The canonical attachment-set property is validated as configuration. The persisted attachment-set identity is the exact XML/PDF SHA-256 pair because those complete hashes are stored in the commit plan.

| Dimension | Persisted field | Queryable | Index status | Exact comparison |
| --- | --- | --- | --- | --- |
| Deterministic job | `jobId` | Yes | Checked at execution | Yes |
| Candidate/invoice fingerprint | `invoiceIdentityHash` durable prefix | Yes | Checked at execution | Yes |
| Gmail source | `sourceThreadHash` durable prefix | Yes | Checked at execution | Yes |
| Commit plan | `commitPlan.jobId` | Yes | Checked at execution | Yes |
| XML attachment | `commitPlan.driveEvidenceTargets.xmlContentHash` | Yes | Checked at execution | Yes |
| PDF attachment | `commitPlan.driveEvidenceTargets.pdfContentHash` | Yes | Checked at execution | Yes |

## Read-Only Query Contract

SOURCE_SYNC_REQUIRED=YES
SOURCE_SYNC_PROVEN=NOT_YET
QUERY_BOUNDED=YES
QUERY_LIMIT_PER_QUERY=2
EXACT_MATCHING_JOB_COUNT=0|1|2_PLUS

1. Read exactly `invoiceJobs/<deterministic-job-id>` using Firestore REST `GET`.
2. Run a bounded equality query on `invoiceJobs.jobId`, limit 2.
3. Only when the direct document and first query agree on exactly one candidate, run a bounded composite equality query, limit 2, over all exact identity fields above.
4. A query result at its limit is a terminal `2_PLUS` category. The diagnostic never paginates, broad-lists, retries with a wider predicate, or chooses a different candidate.

QUERY_FIELDS=jobId;invoiceIdentityHash;sourceThreadHash;commitPlan.jobId;commitPlan.driveEvidenceTargets.xmlContentHash;commitPlan.driveEvidenceTargets.pdfContentHash
QUERY_COMPLETENESS_PROVEN=YES_BY_EXACT_FIELD_PREDICATE_AND_LIMIT_2_TERMINAL_CATEGORY

The only POST used by the adapter is the Firestore REST `documents:runQuery` read endpoint. It does not create, update, delete, transact, or deploy.

## Gates And Outcomes

The public entrypoint is `runD7E4A1BoundedFirestoreIdentityCardinalityReadOnlyProof`. It requires the exact Script Property name `D7_E4A1_OWNER_APPROVAL_MARKER` to equal the owner marker above. The diagnostic never sets or removes properties itself.

- `0`: cardinality and duplicate absence are proven for the deterministic identity; reconciliation remains prohibited and the next review is D7-E4A1 Terra zero-result analysis.
- `1`: cardinality and duplicate absence are proven; the next phase is `D7_E4A2_FINALIZATION_AFTER_EXACT_CARDINALITY_PROOF` and still requires a new reconciliation approval.
- `2_PLUS`: duplicate exact jobs are proven and the diagnostic stops with `BLOCKED_DUPLICATE_EXACT_FIRESTORE_JOBS`.
- Any index requirement, permission error, direct/query inconsistency, missing persisted source-thread hash, or missing commit plan is blocked with no cardinality conclusion.

No raw Script Property values, raw job IDs, attachment hashes, OAuth tokens, Authorization headers, document names, Gmail data, Drive data, or Sheets data are logged or committed.

## Safety Boundary

GMAIL_MUTATION_COUNT=0
DRIVE_MUTATION_COUNT=0
SHEETS_MUTATION_COUNT=0
FIRESTORE_MUTATION_COUNT=0
SCRIPT_PROPERTIES_MUTATION_COUNT=0
TRIGGER_MUTATION_COUNT=0
RECONCILIATION_WRITE_COUNT=0
DEPLOYMENT_COUNT=0
DESTRUCTIVE_OPERATION_COUNT=0
RAW_EMAIL_ADDRESS_LOG_COUNT=0
RAW_EMAIL_SUBJECT_LOG_COUNT=0
RAW_MESSAGE_ID_LOG_COUNT=0
RAW_FIRESTORE_DOCUMENT_ID_LOG_COUNT=0
CUSTOMER_CONTENT_LOG_COUNT=0
PRODUCTION_MUTATION=NONE
RECONCILIATION_EXECUTED=NO
D7_E_PILOT_RERUN=NO
D7_E3I_RERUN=NO
D7_E3V_RERUN=NO

## Source Sync And Execution Gate

The new source must be verified remotely by one normal non-force source push, a pull into a temporary directory, and normalized source hashes before any owner execution. A `clasp` no-op or skipped upload is not proof of remote source presence. The D7-E4A1 runtime must not be executed from this implementation checkpoint until remote source parity and the exact marker are independently available.

NEXT_PHASE=D7_E4A2_FINALIZATION_AFTER_EXACT_CARDINALITY_PROOF
NEXT_OWNER_MARKER=FRESH_RECONCILIATION_APPROVAL_REQUIRED_AFTER_D7_E4A1_RESULT

## Source Sync Evidence And Execution Stop

SOURCE_SYNC_PROVEN=YES
CLASP_PUSH_RUN=YES_NORMAL_NON_FORCE
CLASP_PUSH_RESULT=PASS_PUSHED_78_FILES
REMOTE_PULL_RUN=YES
REMOTE_RUNTIME_FILE_PRESENT=YES
REMOTE_PUBLIC_ENTRYPOINT_DECLARATION_COUNT=1
REMOTE_RUNNER_DECLARATION_COUNT=1
REMOTE_FORBIDDEN_MUTATION_ENTRYPOINT_CALL_COUNT=0
LOCAL_RUNTIME_SHA256_NORMALIZED=2172fb98726172b8669450b4f36f7030cd0d4d418c66031aa18678fa4976ed10
REMOTE_RUNTIME_SHA256_NORMALIZED=2172fb98726172b8669450b4f36f7030cd0d4d418c66031aa18678fa4976ed10
MANIFEST_SEMANTIC_HASH_MATCH=YES

OWNER_APPROVAL_MARKER_VALID=NOT_VERIFIED_IN_SCRIPT_PROPERTIES
QUERY_EXECUTED=NO
EXACT_MATCHING_JOB_COUNT=NOT_EVALUATED
EXACT_FIRESTORE_JOB_CARDINALITY_PROVEN=NO
DUPLICATE_MATCHING_JOB_ABSENCE_PROVEN=NO
RECONCILIATION_EXECUTED=NO
PRODUCTION_MUTATION=NONE
FINAL_STATUS=BLOCKED_D7_E4A1_CARDINALITY_PROOF_NOT_EXECUTABLE
BLOCKER_CODE=BLOCKED_D7_E4A1_OWNER_MARKER_RUNTIME_PRESENCE_NOT_VERIFIED
NEXT_PHASE=D7_E4A1_OWNER_CONFIGURE_MARKER_AND_RUN_READ_ONLY_PROOF_ONCE
