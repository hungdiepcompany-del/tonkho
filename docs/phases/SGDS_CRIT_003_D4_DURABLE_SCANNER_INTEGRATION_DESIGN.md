# SGDS-CRIT-003 D4 Durable Scanner Integration Design

SGDS_CRIT_003_D4_STATUS=PASS_DURABLE_SCANNER_INTEGRATION_DESIGN
DATE=2026-07-15
PROJECT=SyncGmailDriveSheet
SCOPE=DESIGN_DOCS_CHECKER_ONLY
START_HEAD=ba963c8f81acdc10ea619efdf9aaaf4fe73a9d8c
D1_STATUS=PASS_LOCAL_PRIMITIVES_IMPLEMENTED
D2_STATUS=PASS_FIRESTORE_ADAPTER_LOCAL
D3_STATUS=PASS_REPORT_ONLY_RECONCILIATION_LOCAL
D2_GITHUB_PUSH=PASS
D2_LOCAL_AHEAD=0
D2_REMOTE_AHEAD=0
RUNTIME_FILES_CHANGED=NO
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
GAS_DEPLOY=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
GIT_PUSH_AFTER_D4=NOT_RUN

## Current Source Entry Points

The current runtime source was reviewed before this design. D4 does not rename or wire any of these functions.

```text
CURRENT_GMAIL_DISCOVERY_ENTRYPOINT=main -> _mainInternal_ -> scanInvoiceOutEmails_;scanInvoiceInEmails_
CURRENT_DRIVE_DISCOVERY_ENTRYPOINT=triggerScanInvoiceDriveFolder -> scanFilesInFolder_
CURRENT_SINGLE_INVOICE_PROCESSOR=processInvoiceXMLAttachment_;parseInvoiceXMLFile_
CURRENT_COMMIT_CORE=prepareInvoiceRowsForCommit_;commitPreparedInvoiceRows_
CURRENT_DRIVE_EVIDENCE_WRITER=saveInvoiceXmlToDrive_;saveInvoicePdfToDrive_
CURRENT_HOA_DON_WRITER=upsertHoaDonFile_
CURRENT_LEDGER_WRITER=writeInvoicesToSheet_
CURRENT_GMAIL_LABEL_PROJECTOR=projectCommitLabelsByThread_;setExclusiveLabel_
CURRENT_IDENTITY_HELPER=buildInvoiceKey_
CURRENT_LINE_HASH_HELPER=buildInvoiceItemHash_
CURRENT_REPORT_ONLY_RECONCILER=reconcileDurableInvoiceJobReportOnly
CURRENT_DURABLE_ADAPTER=createDurableInvoiceJobStore
```

## Target Scanner Model

The durable scanner target model is:

```text
discovery
-> deterministic identity
-> durable job create/resume
-> validation
-> immutable commit plan
-> stepwise idempotent commit
-> post-commit verification
-> Gmail label projection
-> terminal completion
-> report-only reconciliation
```

Batch scanners must only discover candidate references, create or resume durable jobs, dispatch one job at a time, and collect safe per-job results. Batch scanners must not directly hold invoice transaction state.

```text
SCANNER_RUNTIME_WIRING=NOT_STARTED
MAIN_RUNTIME_WIRING=NOT_STARTED
DRIVE_SCANNER_WIRING=NOT_STARTED
PRODUCTION_FIRESTORE_ACCESS=NONE
AUTOMATIC_REPAIR=DISABLED
BATCH_SCANNER_ACTIVATION=NOT_APPROVED
HISTORICAL_BACKFILL=NOT_APPROVED
```

## Gmail And Drive Source Convergence

```text
GMAIL_DRIVE_SOURCE_CONVERGENCE=DESIGNED
SAME_INVOICE_FROM_GMAIL_AND_DRIVE=SAME_DURABLE_JOB
```

The durable job identity must derive from the invoice contract:

```text
sellerTaxCode + symbol + invoiceNo + issueDate
```

Firestore stores only a safe derived identity hash or safe key. Source references are provenance metadata only and must be sanitized.

Forbidden identity sources:

```text
Gmail thread ID as invoice identity = FORBIDDEN
Drive filename as invoice identity = FORBIDDEN
Drive file ID as invoice identity = FORBIDDEN
mapped itemCode as line identity = FORBIDDEN
```

Gmail and Drive candidates that resolve to the same invoice identity collapse to one deterministic durable job. If two source candidates disagree on the canonical identity fields, the job moves to `RECONCILIATION_REQUIRED` with report-only findings rather than creating independent transactions.

## Durable State Mapping

```text
DURABLE_STATE_MAPPING=COMPLETE
```

| Pipeline step | Current durable state | Allowed next state | Required persisted evidence | Idempotency check | Uncertain-outcome handling | Reconciliation finding |
| --- | --- | --- | --- | --- | --- | --- |
| candidate discovered | DETECTED | COLLECTED | source reference hash, invoice identity hash candidate | deterministic job ID exists or createJobIfAbsent returns existing | retry discovery only if no external write started | JOB_MISSING or COMMIT_PLAN_MISSING |
| job created | DETECTED | COLLECTED | invoiceIdentityHash, sourceThreadHash/sourceFileHash, version=1 | same identity returns same job | unknown create result requires read by deterministic job ID | JOB_MISSING |
| source loaded | COLLECTED | PARSED | sanitized source metadata, attachment/evidence hash prefixes | source hash already loaded for job | failure before mutation may retry | STATE_BEHIND_EVIDENCE |
| XML parsed | PARSED | VALIDATED | parsed invoice metadata hash, expected line count | parse hash matches prior attempt | parse conflict requires review | COMMIT_PLAN_HASH_MISMATCH |
| invoice validated | VALIDATED | FILES_SAVED | validation result, identity hash, line identities | validation hash matches commit-plan input | validation conflict requires review | COMMIT_PLAN_VERSION_MISMATCH |
| commit plan persisted | VALIDATED | FILES_SAVED | immutable commitPlan, commitPlanHash, commitPlanVersion | saveCommitPlanIfAbsent returns IDEMPOTENT_PLAN_MATCH | changed plan is blocked | COMMIT_PLAN_IMMUTABILITY_VIOLATION |
| Drive evidence persisted | FILES_SAVED | COMMITTING | XML/PDF content hashes, safe file references | Drive read-before-write by content hash and expected target | unknown write outcome -> RECONCILIATION_REQUIRED | DRIVE_XML_MISSING;DRIVE_PDF_MISSING;DRIVE_CONTENT_HASH_MISMATCH |
| Hoa-Don row persisted | FILES_SAVED | COMMITTING | invoiceKey, XML/PDF safe refs, registry row version/check | row exists and refs match commit plan | unknown write outcome -> RECONCILIATION_REQUIRED | HOA_DON_ROW_MISSING;HOA_DON_FILE_REFERENCE_MISMATCH;HOA_DON_ROW_DUPLICATE |
| Nhap-Xuat rows persisted | COMMITTING | ROWS_COMMITTED | expectedLineCount, committedLineCount, lineIdentity list, lineHash list, invoiceKey, commitPlanHash | read back all planned rows by line identity/hash/invoiceKey | unknown or partial write -> RECONCILIATION_REQUIRED | LEDGER_ROWS_MISSING;LEDGER_LINE_HASH_MISMATCH;LEDGER_DUPLICATE_LINE_IDENTITY |
| Gmail label projected | ROWS_COMMITTED | PROJECTIONS_COMMITTED | saved-label projection evidence after verified ledger commit | thread has saved and not pending after verification | label uncertainty -> RECONCILIATION_REQUIRED | GMAIL_SAVED_LABEL_MISSING;GMAIL_FALSE_SAVED_LABEL;GMAIL_PENDING_LABEL_CONFLICT |
| post-commit verified | PROJECTIONS_COMMITTED | COMPLETED | Drive, Hoa-Don, ledger, Gmail snapshot all match plan | reconcileDurableInvoiceJobReportOnly returns CONSISTENT | conflicting report is saved only, no repair | TERMINAL_STATE_CONFLICT |
| completed | COMPLETED | none | completedAt, final reconciliation report id | resolveDurableCompletedResume_ returns idempotent no-op | terminal states do not mutate backwards | TERMINAL_STATE_CONFLICT |
| failed before mutation | FAILED_RETRYABLE | COLLECTED/PARSED/VALIDATED/FILES_SAVED/COMMITTING/RECONCILIATION_REQUIRED | sanitized error code/stage, no external effect marker | confirmed not written plus expectedVersion | safe retry only when read-before-write proves absent | STATE_BEHIND_EVIDENCE |
| outcome unknown after mutation | RECONCILIATION_REQUIRED | none | unknown outcome event, step name, idempotency key hash | no automatic retry | report-only reconciliation required | STATE_AHEAD_OF_EVIDENCE |
| reconciliation required | RECONCILIATION_REQUIRED | none | latestReconciliationReportId, blockerCount | owner-reviewed only | no automatic repair | finding code from report |

No new durable state name is introduced in D4. Existing D1 states remain authoritative.

## Mutation Ordering Analysis

### Option A: Drive -> Hoa-Don -> Nhap-Xuat -> Gmail Label

Pros:

- Evidence exists before ledger mutation.
- Hoa-Don can store file references before ledger writes.
- Current Gmail flow already tends to save XML/PDF evidence before Sheet commit.
- If ledger commit fails, Drive/Hoa-Don evidence can support report-only reconciliation.
- Gmail saved label remains last and therefore cannot falsely certify a ledger write.

Cons:

- A failure after Drive/Hoa-Don but before ledger leaves evidence ahead of ledger.
- Reconciliation must distinguish saved evidence from completed accounting rows.

### Option B: Nhap-Xuat -> Drive -> Hoa-Don -> Gmail Label

Pros:

- Ledger is written earlier.
- If evidence write fails after ledger write, business rows may already exist.

Cons:

- A ledger write without durable evidence is harder to audit.
- Existing production behavior and one-invoice smoke centered XML as source of truth and Drive evidence preservation.
- Unknown ledger write outcome before evidence creates higher reconciliation risk.
- False saved-label prevention still requires post-ledger verification, so this option does not simplify projection safety.

### Selected Ordering

```text
MUTATION_ORDER_SELECTED=Drive -> Hoa-Don -> Nhap-Xuat -> Gmail saved-label projection
```

Rationale: Option A best matches existing behavior, maximizes evidence availability before ledger mutation, supports deterministic idempotency checks, and leaves Gmail saved label as the final projection only after verified ledger commit. Firestore failure after Sheet commit must never rollback Sheet rows automatically.

## Commit-Step Contracts

```javascript
{
  stepName,
  precondition,
  idempotencyKey,
  readBeforeWriteCheck,
  mutation,
  writeConfirmation,
  persistedEvidence,
  retryPolicy,
  unknownOutcomePolicy,
  reconciliationCodes
}
```

### Drive XML Write

```text
stepName=DRIVE_XML_WRITE
precondition=state FILES_SAVED and commit plan persisted with expected XML hash
idempotencyKey=jobId:commitPlanHash:XML
readBeforeWriteCheck=find existing XML by expected content hash or safe deterministic target
mutation=saveInvoiceXmlToDrive_ only in future implementation slice
writeConfirmation=file id plus content/hash evidence recorded in durable job
persistedEvidence=xmlContentHash, xmlFileRefHash, source provenance hash
retryPolicy=safe automatic retry only if read-before-write proves XML absent and expectedVersion matches
unknownOutcomePolicy=RECONCILIATION_REQUIRED
reconciliationCodes=DRIVE_XML_MISSING;DRIVE_ARTIFACT_DUPLICATE;DRIVE_CONTENT_HASH_MISMATCH
```

### Drive PDF Write

```text
stepName=DRIVE_PDF_WRITE
precondition=state FILES_SAVED and commit plan persisted with expected PDF hash or PDF optional marker
idempotencyKey=jobId:commitPlanHash:PDF
readBeforeWriteCheck=find existing PDF by expected content hash or safe deterministic target
mutation=saveInvoicePdfToDrive_ only in future implementation slice
writeConfirmation=file id plus content/hash evidence recorded in durable job
persistedEvidence=pdfContentHash, pdfFileRefHash, source provenance hash
retryPolicy=safe automatic retry only if read-before-write proves PDF absent and expectedVersion matches
unknownOutcomePolicy=RECONCILIATION_REQUIRED
reconciliationCodes=DRIVE_PDF_MISSING;DRIVE_ARTIFACT_DUPLICATE;DRIVE_CONTENT_HASH_MISMATCH
```

### Hoa-Don Write

```text
stepName=HOA_DON_WRITE
precondition=Drive XML/PDF evidence verified or PDF explicitly absent
idempotencyKey=jobId:commitPlanHash:HOA_DON
readBeforeWriteCheck=read Hoa-Don by invoiceKey and compare XML/PDF refs
mutation=upsertHoaDonFile_ only in future implementation slice
writeConfirmation=read back one row with expected file refs
persistedEvidence=hoaDon row key hash, XML/PDF ref hashes
retryPolicy=idempotent resume if row exists and refs match; no blind overwrite on mismatch
unknownOutcomePolicy=RECONCILIATION_REQUIRED
reconciliationCodes=HOA_DON_ROW_MISSING;HOA_DON_ROW_DUPLICATE;HOA_DON_FILE_REFERENCE_MISMATCH
```

### Nhap-Xuat Multi-Line Write

```text
stepName=LEDGER_MULTI_LINE_WRITE
precondition=commit plan persisted, Drive evidence verified, Hoa-Don refs verified
idempotencyKey=jobId:commitPlanHash:LEDGER
readBeforeWriteCheck=read Nhap-Xuat by invoiceKey, lineIdentity list, and HashIndex list
mutation=commitPreparedInvoiceRows_ and writeInvoicesToSheet_ only in future implementation slice
writeConfirmation=read back exact expectedLineCount and every planned line identity/hash/invoiceKey
persistedEvidence=expectedLineCount, committedLineCount, lineIdentity list, lineHash list, invoiceKey, commitPlanHash
retryPolicy=idempotent resume if all planned rows already match; no blind append for missing subset
unknownOutcomePolicy=RECONCILIATION_REQUIRED
reconciliationCodes=LEDGER_ROWS_MISSING;LEDGER_ROWS_EXTRA;LEDGER_LINE_HASH_MISMATCH;LEDGER_INVOICE_KEY_MISMATCH;LEDGER_DUPLICATE_LINE_IDENTITY
```

### Gmail Saved-Label Projection

```text
stepName=GMAIL_SAVED_LABEL_PROJECTION
precondition=ledger commit verified and durable state ROWS_COMMITTED
idempotencyKey=jobId:commitPlanHash:GMAIL_LABEL
readBeforeWriteCheck=thread label snapshot has no conflict and ledger remains verified
mutation=projectCommitLabelsByThread_ or setExclusiveLabel_ only in future implementation slice
writeConfirmation=thread has saved label and not pending label
persistedEvidence=safe label projection status and snapshot hash
retryPolicy=idempotent resume if labels already match after ledger verification
unknownOutcomePolicy=RECONCILIATION_REQUIRED
reconciliationCodes=GMAIL_SAVED_LABEL_MISSING;GMAIL_FALSE_SAVED_LABEL;GMAIL_PENDING_LABEL_CONFLICT
```

## Retry Policy

```text
UNKNOWN_OUTCOME_POLICY=RECONCILIATION_REQUIRED
```

Safe automatic retry is allowed only when all conditions hold:

```text
confirmed not written
read-before-write proves absent
same idempotency key
non-terminal durable state
expected version matches
```

Idempotent resume is allowed only when previous step evidence confirms written, current external state matches the commit plan, and the job resumes from the persisted next state.

No automatic retry is allowed for:

```text
write outcome unknown
external state conflicts with commit plan
version conflict
partial multi-line ledger commit
Drive content hash mismatch
duplicate Hoa-Don row
false Gmail saved label
terminal-state conflict
```

These cases must move to `RECONCILIATION_REQUIRED` and save a report-only reconciliation report. No repair is performed without owner approval.

## Multi-Line Ledger Atomicity Design

```text
MULTI_LINE_ATOMICITY_DESIGN=COMPLETE
```

Required commit-plan fields before ledger mutation:

```text
expectedLineCount
lineIdentity list
lineHash list
invoiceKey
commitPlanHash
```

Before commit:

```text
all lines validated
all hashes calculated
commit plan persisted
Drive and Hoa-Don evidence verified
```

After commit:

```text
read back exact invoice rows
verify expected line count
verify every line identity
verify every HashIndex
verify shared InvoiceKey
persist committedLineCount and verification snapshot hash
```

If only part of the lines are written:

```text
JOB_STATUS=RECONCILIATION_REQUIRED
FINDING=LEDGER_ROWS_MISSING
AUTOMATIC_APPEND_OF_MISSING_LINES=FORBIDDEN
```

`LEDGER_PARTIAL_COMMIT` may be considered only as a future owner-approved finding extension; D4 remains compatible with the D3 stable finding code `LEDGER_ROWS_MISSING`.

## Concurrency Design

```text
OPTIMISTIC_CONCURRENCY_DESIGN=COMPLETE
```

Coordination layers:

```text
GAS ScriptLock prevents local concurrent scanner execution.
Firestore expectedVersion prevents distributed stale durable-job writes.
Deterministic job identity prevents duplicate durable jobs.
Idempotency keys bind retries to the same intended external mutation.
External read-before-write checks prevent duplicate Drive artifacts and Sheet rows.
```

ScriptLock is not a durable transaction. Firestore version is not a lock for Gmail, Drive, or Sheets. Every external mutation still requires its own idempotency check and post-write verification.

## Batch Scanner Behavior

Per-job result model:

```text
NOT_ATTEMPTED
COMMITTED
ALREADY_COMMITTED
FAILED
RECONCILIATION_REQUIRED
```

Batch scanner rules:

```text
candidate discovery limit configurable
one candidate failure does not mark others saved
one job result isolated from other jobs
terminal jobs skipped idempotently
reconciliation-required jobs not automatically resumed
duplicate candidates collapse to one job
scanner progress reflects terminal result
```

## Gmail Label Projection Rule

```text
GMAIL_LABEL_PROJECTION_RULE=saved label only after verified ledger commit
```

Rules:

```text
pending label may mark discovered/in-progress work
saved label only after verified ledger commit
saved label missing after commit -> report-only finding
saved label present before commit -> critical finding
label mutation failure does not rollback committed Sheet rows
label failure marks reconciliation required
Gmail label is never transaction authority
```

## Reconciliation Handoff

```text
RECONCILIATION_HANDOFF=DESIGNED
```

Every durable job must be able to build input for:

```text
reconcileDurableInvoiceJobReportOnly
```

Read-only snapshot adapter contracts, for future phases only:

```text
Drive evidence snapshot adapter
Hoa-Don row snapshot adapter
Nhap-Xuat row snapshot adapter
Gmail label snapshot adapter
durable job snapshot adapter
commit plan snapshot adapter
```

Reconciliation report persistence may update only durable metadata:

```text
reconciliationStatus
latestReconciliationReportId
updatedAt
```

It cannot mutate production, cannot auto-repair, and requires owner approval before repair.

## Failure Matrix

```text
FAILURE_MATRIX_CASE_COUNT=20
```

| Case | Durable state | Known external effects | Safe retry allowed | Resume behavior | Required reconciliation finding | Owner action required |
| --- | --- | --- | --- | --- | --- | --- |
| failure before job create | DETECTED | none | yes, createJobIfAbsent | create/read deterministic job | JOB_MISSING | no |
| failure after job create | DETECTED | job may exist | read by deterministic job ID only | if found, resume at DETECTED | JOB_MISSING if absent | no unless conflict |
| failure after parse | PARSED | source loaded, no mutation | yes if no external writes | resume validation | COMMIT_PLAN_MISSING | no |
| failure after plan persist | VALIDATED | immutable plan exists | idempotent plan match only | resume from plan | COMMIT_PLAN_HASH_MISMATCH | owner if mismatch |
| failure during XML Drive write | FILES_SAVED | confirmed not written if pre-write fail | yes if absent and version matches | retry XML write | DRIVE_XML_MISSING | no |
| failure after XML write response lost | FILES_SAVED | XML may exist | no automatic retry | read snapshot then reconcile | DRIVE_XML_MISSING or DRIVE_ARTIFACT_DUPLICATE | yes if mismatch |
| failure during PDF write | FILES_SAVED | confirmed not written if pre-write fail | yes if absent and version matches | retry PDF write | DRIVE_PDF_MISSING | no |
| failure during Hoa-Don write | FILES_SAVED | row may be absent/partial | no if outcome unknown | read Hoa-Don snapshot | HOA_DON_ROW_MISSING | yes if mismatch |
| failure after Hoa-Don response lost | FILES_SAVED | row may exist | no automatic retry | read and reconcile refs | HOA_DON_FILE_REFERENCE_MISMATCH | yes if mismatch |
| failure before ledger append | COMMITTING | no ledger rows written | yes if all rows absent | retry ledger step | LEDGER_ROWS_MISSING | no |
| partial ledger append | COMMITTING | some rows written | no | RECONCILIATION_REQUIRED | LEDGER_ROWS_MISSING | yes |
| ledger append succeeded response lost | COMMITTING | all or some rows may exist | no automatic retry | read back exact rows | LEDGER_ROWS_MISSING or LEDGER_LINE_HASH_MISMATCH | yes if mismatch |
| post-ledger verification mismatch | ROWS_COMMITTED | ledger rows exist but conflict | no | RECONCILIATION_REQUIRED | LEDGER_LINE_HASH_MISMATCH | yes |
| Gmail label write failed | ROWS_COMMITTED | ledger committed, label absent | no rollback | save report and mark reconciliation | GMAIL_SAVED_LABEL_MISSING | yes or owner-approved projection retry |
| Gmail label succeeded response lost | ROWS_COMMITTED | label may exist | no automatic retry | read labels and reconcile | GMAIL_PENDING_LABEL_CONFLICT | yes if conflict |
| audit-event append failed | any non-terminal | mutation may have happened without audit | no blind retry | reconcile state and event gap | STATE_AHEAD_OF_EVIDENCE | yes if gap matters |
| Firestore state transition failed | any non-terminal | external effect may be ahead | no if unknown | reconcile from snapshots | STATE_AHEAD_OF_EVIDENCE | yes |
| version conflict | any | another worker changed job | no | reload durable job | DURABLE_JOB_VERSION_CONFLICT in audit; report if conflict | yes if conflict persists |
| scanner timeout | any non-terminal | last step unknown | no automatic mutation | resume only from durable evidence | STATE_AHEAD_OF_EVIDENCE | yes if unknown |
| duplicate scanner execution | DETECTED through COMPLETED | duplicate candidate attempts | idempotent create/read only | collapse to same job | DRIVE_ARTIFACT_DUPLICATE or LEDGER_DUPLICATE_LINE_IDENTITY if external duplicate | yes if duplicate exists |

## Migration And Compatibility

```text
LEGACY_COMPATIBILITY=DESIGNED
```

Rollout must support:

```text
legacy invoice without durable job
new invoice with durable job
already committed invoice discovered after rollout
partial legacy state discovered after rollout
```

Rules:

```text
no automatic historical backfill
no automatic repair
no rewriting old HashIndex
no rewriting persisted InvoiceKey
no deleting historical blank-hash rows
```

Historical durable-job backfill is a separate owner-approved phase.

## Rollout Slices

```text
ROLLOUT_SLICE_COUNT=6
```

| Slice | Purpose | Production mutation |
| --- | --- | --- |
| D5A_LOCAL_DURABLE_ORCHESTRATION_IMPLEMENTATION | local orchestration service and fake integrations | NO |
| D5B_SCANNER_SHADOW_MODE_DURABLE_JOB_CREATION | shadow-mode durable job creation | NO ledger mutation; Firestore access only after approval |
| D5C_REPORT_ONLY_PRODUCTION_READERS | production read-only snapshot readers | NO mutation |
| D5D_ONE_INVOICE_DURABLE_COMMIT_SMOKE | one-invoice durable commit smoke | YES, only after owner approval |
| D5E_LIMITED_SCANNER_ROLLOUT | limited scanner rollout | YES, bounded after smoke PASS |
| D5F_BATCH_ROLLOUT_REVIEW | batch rollout review and closeout | TBD by owner |

## Release Gates

```text
RELEASE_GATE_COUNT=12
```

Before single-invoice durable commit:

```text
local fault-injection PASS
shadow-mode job creation PASS
production read-only reconciliation PASS
Firestore rules/indexes reviewed
account and project verified
rollback/reconciliation manifest ready
```

Before batch scanner:

```text
single-invoice durable smoke PASS
partial-state fault tests PASS
duplicate source convergence PASS
version conflict test PASS
Gmail false-saved-label test PASS
owner approval
```

`SGDS-CRIT-003` may be marked fixed only after durable production state is active, one-invoice durable smoke passes, failure recovery is verified, reconciliation is verified, limited scanner rollout passes, and no unresolved critical findings remain.

## D4 Explicit Non-Approval

```text
RUNTIME_SCANNER_WIRING=NOT_APPROVED
PRODUCTION_FIRESTORE_ACCESS=NONE
AUTOMATIC_REPAIR=DISABLED
BATCH_ACTIVATION=NOT_APPROVED
HISTORICAL_BACKFILL=NOT_APPROVED
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
GAS_DEPLOY=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
GIT_PUSH_AFTER_D4=NOT_RUN
```

## Validation

```text
FIRST_TEST_RUN=PASS
SECOND_TEST_RUN=PASS
CHECK_RESULT=PASS
BUNDLE_C_CHECK=PASS
D2_CHECK=PASS
D3_CHECK=PASS
D4_CHECK=PASS
GIT_DIFF_CHECK=PASS
```

## Status

```text
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ALLOWED_PHASE=SGDS_CRIT_003_D5A_LOCAL_DURABLE_ORCHESTRATION_IMPLEMENTATION
NEXT_REQUIRED_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D5A_LOCAL_DURABLE_ORCHESTRATION_IMPLEMENTATION
```