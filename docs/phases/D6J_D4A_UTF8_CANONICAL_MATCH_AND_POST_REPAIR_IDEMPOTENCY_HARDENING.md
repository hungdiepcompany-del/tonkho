# D6J-D4A UTF-8 Canonical Match And Post-Repair Idempotency Hardening

```text
PHASE=D6J_D4A_UTF8_CANONICAL_MATCH_AND_POST_REPAIR_IDEMPOTENCY_HARDENING
SOURCE_IMPLEMENTATION=PASS
VIETNAMESE_SOURCE_ENCODING_INTEGRITY=PASS
CANONICAL_VIETNAMESE_EXPECTATIONS=PASS
CANONICAL_ROW_LOCATOR=PASS
FIELD_LEVEL_DIAGNOSTICS=PASS
NOT_EVALUATED_STAGE_SEMANTICS=PASS
CANONICAL_DUPLICATE_DETECTION=PASS
D6J_B_ZERO_INSERT_POST_REPAIR=PASS
D6J_D4_PREFLIGHT_IDEMPOTENCY_GATE=PASS
READ_ONLY_SAFETY=PASS
D6J_D4_ENTRYPOINT_EXECUTED=NO
REPAIR_FUNCTION_EXECUTED=NO
D6J_C_FUNCTION_EXECUTED=NO
PRODUCTION_MUTATION=NONE
NEXT_ACTION=OWNER_RERUN_D6J_D4_READ_ONLY_ONCE
```

## Scope

D6J-D4A fixes the post-repair read-only closure path after the owner-confirmed row 1337 repair. It corrects the runtime Vietnamese expectations using ASCII-safe Unicode escapes, adds NFC exact comparisons, adds field-level row diagnostics, and changes unvisited downstream verification stages to `NOT_EVALUATED`.

The phase also hardens D6J-B read-only idempotency planning so an existing canonical `HashIndex` and `InvoiceKey` row is classified as `EXISTING_CANONICAL_MATCH` and plans zero Sheet inserts and zero Sheet updates.

## Read-Only Boundary

No Apps Script production entrypoint is executed during implementation. The repair entrypoint and D6J-C mutation entrypoint remain forbidden, and no Gmail, Drive, Sheet, Firestore, trigger, or Script Properties mutation is performed.
