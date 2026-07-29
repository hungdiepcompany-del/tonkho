# D6K-A Proposed Business Module Map

PHASE=D6K_A_SOURCE_MODULE_AND_ENTRYPOINT_INVENTORY
SOURCE=artifacts/d6k/source-entrypoint-inventory.json

The map below is derived from static source names, function names, and detected responsibilities. It is a planning map for D6K-B through D6K-D, not a completed refactor.

| Proposed module | Candidate function count | Primary responsibility |
| --- | ---: | --- |
| Audit_InvoiceEvents.js | 9 | Audit and event evidence helpers |
| Firestore_InvoiceJobStore.js | 170 | Durable jobs, Firestore paths, job state, shadow state |
| Firestore_LeaseStore.js | 9 | Lease lifecycle and lease validation |
| Invoice_DriveStorage.js | 38 | Drive evidence lookup and storage support |
| Invoice_GmailReader.js | 50 | Gmail discovery, message and attachment read support |
| Invoice_SheetLedger.js | 80 | Nhap-Xuat, Hoa-Don, UI and ledger access support |
| Operator_Entrypoints.js | 36 | Public run functions and curated operator surface candidates |
| Shared_Hashing.js | 39 | HashIndex, SHA-256, deterministic identity helpers |
| Shared_Normalization.js | 68 | Canonicalization, date and text normalization |
| Shared_Validation.js | 230 | Guard predicates, schema checks, safe serialization and validators |
| Trigger_Handlers.js | 26 | Trigger and quota guard handling |

## Refactor Constraints For Later Phases

```text
GLOBAL_SCOPE_SEMANTICS=PRESERVE
FUNCTION_NAMES=PRESERVE_UNTIL_REFERENCE_PROOF
STRING_ADDRESSED_HANDLERS=DO_NOT_RENAME_IN_D6K_B_OR_D6K_C
IMPORT_EXPORT_RUNTIME_TOKENS=REVIEW_BEFORE_RUNTIME_SYNC
D6J_HISTORICAL_ENTRYPOINTS=FROZEN
```

D6K-B should start with pure shared helpers only. D6K-C may organize I/O and orchestration after D6K-B proves global names and behavior remain stable. D6K-D owns the final operator-entrypoint policy and any historical wrapper decisions.
