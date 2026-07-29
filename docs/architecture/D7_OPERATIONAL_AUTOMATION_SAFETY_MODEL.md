# D7 Operational Automation Safety Model

PHASE=D7_A_OPERATIONAL_AUTOMATION_READINESS_READ_ONLY_AUDIT
STATUS=READ_ONLY_SAFETY_MODEL_DEFINED

D7 automation is fail-closed. A readiness audit may read configuration and metadata, but it must not process a candidate or perform a write probe. Automation remains disabled until a later owner-approved phase explicitly enables bounded execution.

## Kill Switch

```text
AUTOMATION_ENABLEMENT_PROPERTY=D7_AUTOMATION_ENABLED
AUTOMATION_KILL_SWITCH_PROPERTY=D7_AUTOMATION_KILL_SWITCH
AUTOMATION_DEFAULT_SAFE_DISABLED=YES
AUTOMATION_CURRENTLY_ENABLED_REQUIRED_FOR_SAFE_READINESS=NO
AUTOMATION_MUTATION_REACHABLE_WHEN_DISABLED_REQUIRED=NO
```

## Readiness Domains

| Domain | Required proof |
| --- | --- |
| Script Properties | Names-only metadata, presence, non-empty status and safe format. |
| Gmail | Metadata read access, deterministic bounded query policy, message ID identity and PDF/XML validation. |
| Drive | Root folder read access, deterministic artifact naming and duplicate protection. |
| Sheets | Spreadsheet and target sheet read access, A:P header schema, canonical duplicate protection and bounded write plan contract. |
| Firestore | `invoiceJobs`, `invoiceJobs/<jobId>/events`, `worker_leases`, idempotency collections, transactions, leases and retry contracts. |
| Locking | Apps Script lock is separate from Firestore lease; both have bounded timing. |
| Triggers | D7 expects no automation trigger until a later owner-approved phase. |
| Historical D6J | Completed D6J public wrappers remain frozen with `HISTORICAL_PHASE_CLOSED_DO_NOT_EXECUTE`. |

## Forbidden Audit Output

The audit must not log OAuth tokens, service-account credentials, full Script Property values, email bodies, XML, PDF bytes, Firestore documents, Drive sharing metadata, customer tax codes or private customer payloads.
