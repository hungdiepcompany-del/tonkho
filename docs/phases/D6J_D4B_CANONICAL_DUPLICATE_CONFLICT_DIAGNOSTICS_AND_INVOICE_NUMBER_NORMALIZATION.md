# D6J-D4B Canonical Duplicate Conflict Diagnostics And Invoice Number Normalization

```text
PHASE=D6J_D4B_CANONICAL_DUPLICATE_CONFLICT_DIAGNOSTICS_AND_INVOICE_NUMBER_NORMALIZATION
SOURCE_IMPLEMENTATION=PASS
DUPLICATE_CONFLICT_DIAGNOSTICS=PASS
INVOICE_NUMBER_SEMANTIC_NORMALIZATION=PASS
RAW_DISPLAY_VALUE_SUPPORT=PASS
FIELD_LEVEL_IDENTITY_DIAGNOSTICS=PASS
D6J_B_CANONICAL_DUPLICATE_CLASSIFICATION=PASS
D6J_B_DUPLICATE_CONFLICT_PASS_GATE=BLOCKED
D6J_B_ZERO_INSERT_POST_REPAIR=PASS
D6J_D4_DIAGNOSTIC_FLOW=PASS
NOT_EVALUATED_STAGE_SEMANTICS=PASS
READ_ONLY_SAFETY=PASS
D6J_D4_ENTRYPOINT_EXECUTED=NO
REPAIR_FUNCTION_EXECUTED=NO
D6J_C_FUNCTION_EXECUTED=NO
PRODUCTION_MUTATION=NONE
NEXT_ACTION=OWNER_RUN_D6J_D4_READ_ONLY_ONCE
```

## Scope

D6J-D4B closes the canonical duplicate conflict gap found after the post-repair read-only audit. D6J-B now treats `DUPLICATE_CONFLICT_REVIEW_REQUIRED` as a blocked exact dry-run, preserves sanitized duplicate diagnostics, and requires the repaired pilot state to plan zero Sheet inserts, zero Sheet updates, and classify the Sheet row as `EXISTING_CANONICAL_MATCH` before reporting `PASS_EXACT_PRODUCTION_DRY_RUN_READ_ONLY`.

The phase also normalizes invoice numbers semantically so raw numeric Sheet values such as `248` can match displayed invoice numbers such as `00000248` without changing Sheet headers or Sheet data.

## Read-Only Boundary

Implementation did not execute the D6J-D4 read-only Apps Script entrypoint, the D6J-D repair entrypoint, or the D6J-C mutation entrypoint. No Gmail, Drive, Sheet, Firestore, trigger, Script Properties, deployment, or production data mutation is part of this phase.

## Diagnostics

The D6J-B duplicate classifier now reports bounded fields for canonical `InvoiceKey` and `HashIndex` match counts, matching row numbers, same-row status, B:I business identity matches, normalized invoice number status, and exact duplicate conflict reason.

D6J-D4 now allows a zero-write D6J-B duplicate conflict preflight to continue far enough to perform independent Sheet diagnostics. If the Sheet independently verifies the repaired canonical row but D6J-B still reports a duplicate conflict, D6J-D4 returns `BLOCKED_D6J_D4_PREFLIGHT_CLASSIFIER_DISAGREEMENT` while preserving downstream stages as `NOT_EVALUATED`.
