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
