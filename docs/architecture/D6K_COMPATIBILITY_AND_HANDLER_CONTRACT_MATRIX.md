# D6K Compatibility And Handler Contract Matrix

PROGRAM=D6K_SOURCE_ARCHITECTURE_CONSOLIDATION_OPERATOR_ENTRYPOINT_CLEANUP_AND_RUNTIME_SAFETY_CLOSEOUT
STATUS=PASS_NO_PENDING_COMPATIBILITY_REVIEW

| Contract | D6K result |
| --- | --- |
| Gmail matching | `UNCHANGED` |
| Attachment validation | `UNCHANGED` |
| XML parsing | `UNCHANGED` |
| PDF metadata and link handling | `UNCHANGED` |
| Drive exact matching | `UNCHANGED` |
| Sheet header schema | `UNCHANGED` |
| Sheet row mapping | `UNCHANGED` |
| Canonical duplicate detection | `UNCHANGED` |
| Invoice leading-zero normalization | `UNCHANGED` |
| `HashIndex` behavior | `UNCHANGED` |
| `InvoiceKey` behavior | `UNCHANGED` |
| Firestore job path | `UNCHANGED` |
| Firestore lease path and lifecycle | `UNCHANGED` |
| Firestore event path | `UNCHANGED` |
| Deterministic event IDs | `UNCHANGED` |
| Approval markers | `UNCHANGED` |
| D6J reconciliation closure | `UNCHANGED` |
| Trigger handlers | `UNCHANGED` |
| Custom menu handlers | `UNCHANGED` |
| HTML `google.script.run` handlers | `UNCHANGED` |
| Historical D6J public functions | `INTENTIONALLY_WRAPPED` |

```text
BLOCKED_PENDING_REVIEW_COUNT=0
BROKEN_REFERENCE_COUNT=0
STRING_HANDLER_RENAME=NO
DOGET_DOPOST_CHANGED=NO
TRIGGER_MENU_HTML_COMPATIBILITY=PRESERVED
```
