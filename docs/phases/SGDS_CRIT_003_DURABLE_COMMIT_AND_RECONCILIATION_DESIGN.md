# SGDS-CRIT-003 Durable Commit And Reconciliation Design

DESIGN_STATUS=READY_FOR_OWNER_REVIEW
OWNER_MARKER=OWNER_APPROVE_SGDS_CRIT_003_DURABLE_COMMIT_AND_RECONCILIATION_DESIGN
DATE=2026-07-15
PROJECT=SyncGmailDriveSheet
SCOPE=DESIGN_ONLY
RUNTIME_FILES_CHANGED=NO
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
GAS_FUNCTION_RUN=NO
FIREBASE_DEPLOY=NOT_RUN

## Problem Statement

SGDS-CRIT-003 remains open because the current worker mutates Drive, `Hoa-Don`, `Nhap-Xuat`, and Gmail labels in separate steps without a durable job state that can prove exactly where a source invoice is in the commit lifecycle. A retry after a partial failure can duplicate rows, miss rows, or project a saved Gmail label before the Sheet ledger is truly committed.

The Bundle C one-invoice smoke verified one happy path only. It does not prove rollback, recovery, or reconciliation when a failure happens between services.

## Non-Goals

- Do not replace Google Sheets as the current business ledger in this phase.
- Do not migrate existing `HashIndex` or persisted `InvoiceKey` formats in this design phase.
- Do not run batch scanners, Drive backfill, BQGQ, TonKho, or any production mutation.
- Do not automatically delete or rewrite historical ledger rows during reconciliation.
- Do not trust PDF/OCR data for automatic ledger writes when XML is unavailable.

## Design Principles

1. XML is the accounting source of truth for automatic Sheet writes.
2. Gmail labels are projections only and are written last.
3. Every source invoice has a durable job record before any ledger commit attempt.
4. Every write boundary is idempotent and independently verifiable.
5. A retry resumes from durable state; it does not infer success from Gmail labels or Drive filenames.
6. Any partial state that cannot be proven safe becomes `RECONCILIATION_REQUIRED`.
7. Reconciliation is report-only first; repair requires a separate owner marker.

## Durable Stores

| Store | Purpose | Source Of Truth Role |
| --- | --- | --- |
| Firestore `invoiceJobs/{jobId}` | Durable per-invoice job state, source locator hashes, parser status, commit plan summary, terminal state. | Canonical workflow state, not business ledger. |
| Firestore `invoiceJobs/{jobId}/events/{eventId}` | Append-only audit events for state transitions and write boundaries. | Canonical audit trail. |
| Firestore `reconciliationFindings/{findingId}` | Report-only findings from consistency checks. | Canonical reconciliation queue. |
| Google Drive | XML/PDF/link evidence artifacts plus content hashes. | Evidence store only. |
| Sheet `Hoa-Don` | Current artifact registry linking invoice key to Drive IDs/status. | Current registry, reconciled against Firestore/Drive. |
| Sheet `Nhap-Xuat` | Current business ledger rows. | Current business ledger. |
| Gmail labels | Operator projection of source state. | Projection only. |

## Job Identity

A job is one invoice, not one Gmail thread.

```text
sourceFingerprint = SHA256(channel + threadId/messageId/fileId + attachmentName + attachmentContentHash)
invoiceIdentity = invoiceKeyV2 when XML parse succeeds
jobId = SHA256(sourceFingerprint + invoiceIdentity)
```

For compatibility, runtime implementation must store both:

```text
legacyInvoiceKey=current persisted InvoiceKey format
invoiceKeyV2=owner-approved V2 identity
legacyHashIndex=current persisted HashIndex
lineIdentityV2=owner-approved V2 line identity
```

`legacyInvoiceKey` and `legacyHashIndex` remain the Sheet dedup keys until a separate migration phase is approved.

## State Machine

The owner-approved data contract states remain valid. Runtime implementation should enforce this narrower commit path:

```text
DETECTED
-> COLLECTED
-> PARSED
-> VALIDATED
-> FILES_SAVED
-> COMMITTING
-> ROWS_COMMITTED
-> PROJECTIONS_COMMITTED
-> COMPLETED
```

Failure states:

```text
FAILED_RETRYABLE
FAILED_REVIEW_REQUIRED
RECONCILIATION_REQUIRED
IGNORED_NOT_INVOICE
```

`PROJECTIONS_COMMITTED` means `Hoa-Don` registry and Gmail label projection are consistent with the verified ledger commit. It is separate from `ROWS_COMMITTED` so Gmail labels can never be used as proof of ledger success.

## Commit Boundary Protocol

### 1. Acquire Job Lock

Acquire a lock keyed by `jobId` and, when available, `invoiceKeyV2`. If the lock cannot be acquired, return `FAILED_RETRYABLE` without mutation.

### 2. Load Or Create Job

If the job exists, resume from its durable state. If terminal `COMPLETED`, verify ledger/registry/projection signatures and return idempotent success. If `RECONCILIATION_REQUIRED`, do not mutate without a repair marker.

### 3. Parse And Validate

XML must produce the canonical invoice model and expected line set. Link-only/PDF-only/adjustment/replacement/cancelled inputs follow the owner-approved review policies.

### 4. Save Evidence Idempotently

Drive writes are keyed by content hash and invoice identity. If a matching artifact already exists, link it instead of creating a duplicate. Record only file IDs and content hashes in durable job state.

### 5. Build Commit Plan

Before touching Sheets, create a durable commit plan containing:

```text
jobId
legacyInvoiceKey
invoiceKeyV2
expectedLineCount
legacyHashIndex list
lineIdentityV2 list
Hoa-Don registry target
Drive evidence targets
preCommitLedgerProbe summary
```

The plan is append-only and cannot be silently changed after `COMMITTING` begins. If parsed data changes, create a new job version or route to review.

### 6. Ledger Dedup Probe

Probe `Nhap-Xuat` by `legacyHashIndex` and `legacyInvoiceKey`.

| Probe Result | Action |
| --- | --- |
| No expected rows present | Append the planned row block. |
| All expected rows present and match plan | Treat as idempotent `ROWS_COMMITTED`. |
| Some expected rows present | Mark `RECONCILIATION_REQUIRED`; do not append missing rows automatically. |
| Extra matching invoice rows | Mark `RECONCILIATION_REQUIRED`; do not delete rows. |
| Existing rows mismatch planned fields | Mark `RECONCILIATION_REQUIRED`; do not overwrite rows. |

### 7. Append And Verify Rows

Append planned `Nhap-Xuat` rows as a contiguous block when possible. Immediately re-read the target rows and verify:

```text
expectedLineCount matches
all legacyHashIndex values present
all legacyInvoiceKey values present
no duplicate planned line in the committed block
immutable economic fields match XML-derived plan
```

Only then transition to `ROWS_COMMITTED`.

### 8. Registry And Projection

After `ROWS_COMMITTED`:

1. Upsert `Hoa-Don` registry idempotently.
2. Verify XML/PDF registry links point to the saved evidence.
3. Apply Gmail saved label and remove pending label.
4. Write `PROJECTIONS_COMMITTED` event.
5. Transition to `COMPLETED`.

If registry or label projection fails after rows are committed, keep ledger rows and mark `RECONCILIATION_REQUIRED` with a projection/registry finding. Do not roll back committed Sheet rows automatically.

## Reconciliation Finder

The first implementation should be report-only. It compares durable job state against Drive, `Hoa-Don`, `Nhap-Xuat`, and Gmail labels.

| Finding Code | Detection | Default Action |
| --- | --- | --- |
| `LEDGER_ROWS_MISSING` | Job says rows expected, but `Nhap-Xuat` rows absent. | Review; owner-approved repair may append from commit plan. |
| `LEDGER_ROWS_PARTIAL` | Only some expected rows exist. | Review; no automatic append. |
| `LEDGER_ROWS_DUPLICATE` | More matching rows than expected. | Review; no deletion. |
| `LEDGER_ROW_MISMATCH` | Row hash/key matches but economic fields differ. | Review; no overwrite. |
| `REGISTRY_MISSING` | `Hoa-Don` link missing after rows committed. | Safe repair candidate after owner marker. |
| `REGISTRY_MISMATCH` | Registry points to unexpected Drive evidence. | Review. |
| `DRIVE_EVIDENCE_MISSING` | Registry/job references missing Drive file. | Review. |
| `GMAIL_LABEL_MISSING` | Rows committed but saved label missing. | Safe projection repair candidate after owner marker. |
| `GMAIL_LABEL_FALSE_SAVED` | Saved label exists but rows not verified. | Review; projection repair only after owner marker. |
| `JOB_STATE_STALE` | Job stuck in nonterminal state beyond retry window. | Retry or review depending on last boundary. |

## Repair Policy

No repair writes run in the design phase. Future repair must require a marker that names the exact finding or bounded batch.

Allowed future safe repairs after explicit approval:

- Re-apply Gmail projection when rows and registry are verified.
- Upsert missing `Hoa-Don` registry link when Drive evidence and ledger rows are verified.
- Append missing ledger rows only when a durable pre-commit plan exists, no partial rows exist, and owner approves the exact job repair.

Forbidden automatic repairs:

- Delete ledger rows.
- Overwrite historical economic fields.
- Reconstruct ledger rows from PDF/OCR only.
- Mark saved in Gmail before ledger verification.
- Run Drive backfill as a side effect of Gmail reconciliation.

## Runtime Implementation Slices

### Slice D1 - Local Interfaces And Tests

- Add durable state interface with a local fake adapter for tests.
- Add commit plan builder without production mutation.
- Add state transition validator.
- Add unit tests for idempotent resume and invalid transition rejection.

### Slice D2 - GAS Firestore Adapter Behind Disabled Flag

- Add Firestore REST adapter or approved Apps Script service wrapper.
- Keep feature disabled by default.
- Add secret/property names only; do not store secret values in repo.
- Validate account and project configuration read-only.

### Slice D3 - Report-Only Reconciliation

- Implement reconciliation finder with no repair writes.
- Produce sanitized finding counts and codes.
- Do not expose invoice payloads or raw personal data in logs/docs.

### Slice D4 - One-Job Durable Commit Canary

- Owner selects one exact source locator.
- Enable durable commit only for that locator.
- Run exactly once through the durable path.
- Verify rows, registry, Drive evidence, labels, and job events.

### Slice D5 - Bounded Repair Tools

- Only after report-only findings and owner approval.
- Implement one finding-code repair at a time.
- Require before/after evidence and rollback/stop criteria.

## Test Requirements

Runtime implementation must add tests for:

- State transition legality.
- Existing completed job idempotent no-op.
- Drive evidence dedup by content hash.
- Ledger all-rows-present idempotent success.
- Ledger partial rows route to `RECONCILIATION_REQUIRED`.
- Registry failure after rows committed routes to reconciliation, not duplicate append.
- Gmail label failure after rows committed routes to reconciliation, not duplicate append.
- Gmail saved label is applied only after row verification.
- Drive scanner and Gmail scanner both use the same commit core.
- PDF-only and link-only inputs cannot automatically write ledger rows.
- Reconciliation finder emits sanitized finding codes without payload values.

## Release Gates

Before any runtime implementation is pushed to GAS:

```text
OWNER_APPROVE_SGDS_CRIT_003_D1_LOCAL_IMPLEMENTATION
```

Before any production canary:

```text
OWNER_APPROVE_SGDS_CRIT_003_ONE_JOB_DURABLE_COMMIT_CANARY
```

Before any repair write:

```text
OWNER_APPROVE_SGDS_CRIT_003_REPAIR_<FINDING_CODE>
```

## Acceptance Criteria For Closing SGDS-CRIT-003

SGDS-CRIT-003 can move from `NOT_FIXED` only after all are true:

```text
DURABLE_JOB_STATE_IMPLEMENTED=YES
REPORT_ONLY_RECONCILIATION_IMPLEMENTED=YES
DURABLE_COMMIT_CANARY_PASS=YES
PARTIAL_FAILURE_TESTS_PASS=YES
GMAIL_LABEL_PROJECTION_AFTER_LEDGER_VERIFY=YES
DRIVE_AND_GMAIL_USE_SHARED_COMMIT_CORE=YES
REPAIR_POLICY_OWNER_APPROVED=YES
PRODUCTION_ROLLBACK_OR_STOP_PLAN_APPROVED=YES
```

Until then:

```text
SGDS_CRIT_003_STATUS=NOT_FIXED_DESIGN_READY
```
