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
