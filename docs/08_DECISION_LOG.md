# 08 Decision Log

## A00-DEC-001

DECISION=Initialize Git in the target project path because no repository existed.
REASON=Bundle A requires baseline lock and commit history.

## A00-DEC-002

DECISION=Treat Google resource IDs as identifiers, not secrets.
REASON=Bundle prompt explicitly says Drive/Script/Sheet IDs are not automatically secrets, but must be recorded as resource identifiers.

## A00-DEC-003

DECISION=Do not run any clasp, Firebase, GAS, Gmail, Drive, Sheets, or web app mutation command.
REASON=Bundle A is local read-only evidence and documentation only.

## A01-DEC-001

DECISION=Block A01 instead of proceeding to A02/A03 because the workbook snapshot is missing.
REASON=The requested gate requires workbook schema and data integrity evidence. Proceeding would skip a mandatory subphase.

## Architecture Decisions Recorded

- Gmail label is projection only, not source of truth.
- Firestore is not the main ledger in this phase.
- Firebase Storage is not used.
- Remote GAS is not run in Bundle A.


## BUNDLE-B-DEC-001

DECISION=Use Node built-in test runner and standard library only.
REASON=Bundle B can be completed without npm dependencies or network access.

## BUNDLE-B-DEC-002

DECISION=Load GAS source in Node VM rather than modifying runtime files.
REASON=Runtime source is immutable in Bundle B.

## BUNDLE-B-DEC-003

DECISION=Bug reproduction tests pass when they prove the current bug exists.
REASON=Bundle B is a baseline before Bundle C fixes.


## BUNDLE-B-DEC-001

DECISION=Use Node built-in test runner and standard library only.
REASON=Bundle B can be completed without npm dependencies or network access.

## BUNDLE-B-DEC-002

DECISION=Load GAS source in Node VM rather than modifying runtime files.
REASON=Runtime source is immutable in Bundle B.

## BUNDLE-B-DEC-003

DECISION=Bug reproduction tests pass when they prove the current bug exists.
REASON=Bundle B is a baseline before Bundle C fixes.


## BUNDLE-B-DEC-001

DECISION=Use Node built-in test runner and standard library only.
REASON=Bundle B can be completed without npm dependencies or network access.

## BUNDLE-B-DEC-002

DECISION=Load GAS source in Node VM rather than modifying runtime files.
REASON=Runtime source is immutable in Bundle B.

## BUNDLE-B-DEC-003

DECISION=Bug reproduction tests pass when they prove the current bug exists.
REASON=Bundle B is a baseline before Bundle C fixes.


## OWNER-APPROVAL-DEC-001

DECISION=Approve the recommended set of 20 business decisions with owner marker `APPROVE_RECOMMENDED_20`.
REASON=Owner supplied the approval marker and requested data contract/invariant status transition to owner-approved v1.

## OWNER-APPROVAL-DEC-002

DECISION=Use `invoiceKeyV2 = sellerTaxCode + "_" + invoiceSymbol + "_" + normalizedInvoiceNo + "_" + issueDate(yyyyMMdd)`.
REASON=Owner approved invoice symbol as required identity input and excluded buyer/counterparty/type from primary invoice identity.

## OWNER-APPROVAL-DEC-003

DECISION=Block over-sell and route to review; BQGQ ordering is `issueDate`, immutable `transactionSequence`, then `sourceLineNo`.
REASON=Owner approved the recommended inventory policy and removed the policy blocker for Bundle C local fixes.

## OWNER-APPROVAL-DEC-004

DECISION=Correct Bundle B coverage mapping by keeping `SGDS-HIGH-005` as item-code substring mapping and adding `SGDS-HIGH-011` for BQGQ row-order sensitivity.
REASON=The owner approval prompt explicitly identified the previous coverage row as a bad link.


## BUNDLE-C-DEC-001

DECISION=Keep Hash V1 and persisted invoiceKey format unchanged while adding shared local commit preparation.
REASON=Current production data already stores HashIndex and invoiceKey in the existing format; identity migration requires a separate reconciliation phase.

## BUNDLE-C-DEC-002

DECISION=Treat Gmail labels as projections after per-source commit results.
REASON=The owner-approved invariant says saved-sheet labels must only follow verified row commit or idempotent already-committed status.

## BUNDLE-C-DEC-003

DECISION=Remove Bundle B runtime-immutability checks from the aggregate local check and replace them with the Bundle C runtime-fix checker.
REASON=Bundle C explicitly permits local runtime edits while still requiring no production mutation, no workbook mutation, and compatibility with existing identity formats.

## Bundle C-S1 Single-Thread Smoke Executor Local Patch

OWNER_MARKER=OWNER_APPROVE_BUNDLE_C_SINGLE_THREAD_EXECUTOR_LOCAL_PATCH
PREVIOUS_BLOCKER=SCANNER_CANDIDATE_COUNT_NOT_SINGLE
PREVIOUS_GLOBAL_CANDIDATE_COUNT=10
SINGLE_THREAD_EXECUTOR_STATUS=PASS_SINGLE_THREAD_EXECUTOR_LOCAL
SINGLE_THREAD_EXECUTOR_GAS_PUSH_STATUS=BLOCKED_CLASP_REAUTH_REQUIRED
EXACT_THREAD_SCOPE=1
PRODUCTION_MUTATION=NONE
SCRIPT_PROPERTIES_MUTATION=NONE
GAS_PUSH=BLOCKED_BEFORE_UPLOAD
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ALLOWED_PHASE=RESUME_SINGLE_THREAD_EXECUTOR_GAS_PUSH_AFTER_CLASP_REAUTH

## BUNDLE-C-S4-DEC-001

DECISION=Remove the temporary single-thread smoke executor after the exact-thread production smoke passed.
REASON=The executor was approved only as a bounded one-thread smoke tool. Keeping it after PASS would preserve an unnecessary production execution surface.

## BUNDLE-C-S4-DEC-002

DECISION=Preserve Bundle C production smoke evidence while removing local executor code, executor-specific tests, executor-specific checker, and package command.
REASON=The evidence remains part of the production verification record, while the temporary tool itself is no longer required.

## BUNDLE-C-S4R-DEC-001

DECISION=Use owner-approved Apps Script editor exact-file deletion to remove the remote temporary executor after normal clasp push left it present.
REASON=The previous phase allowed exactly one normal clasp push attempt and forbade retry or force push. Owner approved manual exact-file deletion for `bundleCSingleThreadSmoke.gs` only.

## BUNDLE-C-S4R-DEC-002

DECISION=Clean only Bundle C smoke result Script Properties after remote executor removal was independently verified by a second read-only clone.
REASON=Result keys were safe cleanup residue from the completed one-thread smoke; input keys remained absent, and unrelated Script Properties were out of scope.

## SGDS-CRIT-003-DEC-001

DECISION=Use durable per-invoice job state and append-only audit as the workflow source of truth, while keeping Google Sheets as the current business ledger.
REASON=SGDS-CRIT-003 is caused by cross-service partial failure. Durable workflow state is needed to resume safely without replacing the Sheet ledger in this phase.

## SGDS-CRIT-003-DEC-002

DECISION=Make reconciliation report-only before any repair write is implemented.
REASON=The system must first prove divergence safely and sanitize evidence. Deleting, overwriting, or repairing production ledger data requires separate owner approval.

## SGDS-CRIT-003-DEC-003

DECISION=Keep legacy `HashIndex` and persisted `InvoiceKey` compatibility during the durable-state implementation slices.
REASON=Bundle C explicitly avoided identity migration. V2 identity can be stored in durable state, but Sheet dedup compatibility remains required until a separate migration plan is approved.

## SGDS-CRIT-003-D1-DEC-001

DECISION=Implement D1 as inert local GAS-compatible primitives plus VM-loaded unit tests before scanner integration.
REASON=The owner approved local implementation only. Keeping the primitives unwired avoids production behavior changes while proving the durable state machine and commit-plan contract locally.

## SGDS-CRIT-003-D1-DEC-002

DECISION=Reject changed commit plans once saved in the local durable store.
REASON=The design requires commit plans to be append-only after creation so retries cannot silently mutate the expected ledger write set.
