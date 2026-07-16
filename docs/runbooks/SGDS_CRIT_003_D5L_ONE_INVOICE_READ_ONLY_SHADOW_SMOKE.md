# SGDS-CRIT-003 D5L One-Invoice Read-Only Shadow Smoke Runbook

## Scope

```text
D5L_ONE_INVOICE_RUNBOOK=READY
ONE_INVOICE_ONLY=YES
READ_ONLY_ONLY=YES
SOURCE_MUTATION=NONE
FIRESTORE_REPAIR=NONE
AUTOMATIC_REPAIR=DISABLED
```

## Future Procedure

1. Verify owner marker and exact invoice locator.
2. Snapshot Gmail labels, Drive metadata, Sheet row counts, and Firestore shadow job state.
3. Read only the exact approved Gmail thread, Drive XML/PDF metadata, Hoa-Don data, ledger rows, and Firestore shadow job.
4. Compare source convergence using sanitized hashes/counts only.
5. Snapshot after state and require no mutation.
6. Record findings without repair.

## Required Non-Mutation Proof

```text
GMAIL_LABEL_MUTATION=NO
DRIVE_FILE_MUTATION=NO
SHEET_CELL_EDIT=NO
SHEET_ROW_INSERT=NO
SHEET_ROW_DELETE=NO
FIRESTORE_WRITE=NONE
BEFORE_AFTER_SNAPSHOT_MATCH=YES_OR_REVIEW_REQUIRED
```

## Forbidden In This Runbook

```text
MAIN_SCANNER_RUN=NO
BATCH_PROCESSING=NO
DRIVE_BACKFILL=NO
BQGQ_RUN=NO
TONKHO_RUN=NO
REPAIR_RUN=NO
```
