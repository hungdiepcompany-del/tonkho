# D6J-D4C Firestore Job Path Census And Repair Audit Reconciliation Diagnostics

```text
PHASE=D6J_D4C_FIRESTORE_JOB_PATH_CENSUS_AND_REPAIR_AUDIT_RECONCILIATION_DIAGNOSTICS
SOURCE_IMPLEMENTATION=PASS
EXACT_PATH_CENSUS=PASS
JOB_ID_RECOMPUTATION=PASS
JOBS_COLLECTION_CENSUS=PASS
LEASE_EVIDENCE_INSPECTION=PASS
REPAIR_AUDIT_PATH_INSPECTION=PASS
READ_ONLY_SAFETY=PASS
D6J_D4C_ENTRYPOINT_EXECUTED=NO
D6J_D4_ENTRYPOINT_EXECUTED=NO
REPAIR_FUNCTION_EXECUTED=NO
D6J_C_FUNCTION_EXECUTED=NO
PRODUCTION_MUTATION=NONE
NEXT_ACTION=OWNER_RUN_D6J_D4C_READ_ONLY_ONCE
```

## Scope

D6J-D4C adds a dedicated read-only Firestore evidence diagnostic entrypoint for the post-repair channel. It performs bounded GET/LIST census checks for the expected legacy path `jobs/<jobId>`, the durable store implementation path `invoiceJobs/<jobId>`, `worker_leases/<jobId>`, planned D6J Gmail and attachment records, and the actual repair audit event path `invoiceJobs/<jobId>/events`.

The phase documents the current implementation contract without silently substituting alternate job candidates. The D6J-D4 closeout path remains fail-closed: Sheet correctness alone is not enough to close the channel when required Firestore job or repair audit evidence is missing.

## Actual Path Contract

```text
JOB_DOCUMENT_PATH=invoiceJobs/<jobId>
LEGACY_EXPECTED_JOB_PATH=jobs/<jobId>
JOB_AUDIT_EVENTS_PATH=invoiceJobs/<jobId>/events
COMMIT_PLAN_LOCATION=invoiceJobs/<jobId>#commitPlan
RECONCILIATION_REPORT_PATH=invoiceJobs/<jobId>/reconciliationReports
WORKER_LEASE_PATH=worker_leases/<jobId>
GMAIL_RECORD_PATH=gmail_messages/<derived-gmail-id>
PDF_ATTACHMENT_RECORD_PATH=attachments/<derived-pdf-id>
XML_ATTACHMENT_RECORD_PATH=attachments/<derived-xml-id>
```

## Read-Only Boundary

No diagnostic entrypoint was executed during implementation. The implementation uses Firestore GET/LIST operations only and does not call Sheet, Drive, Gmail, trigger, Script Properties, repair, or D6J-C mutation functions.
