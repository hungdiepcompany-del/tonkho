# 06 Owner Decisions

OWNER_REVIEW_STATUS=APPROVED_WITH_REVISIONS
OWNER_MARKER=APPROVE_RECOMMENDED_20
OWNER_DECISIONS_PENDING_COUNT=0

## Approved Architecture Decisions

- Google Sheets remains the main business ledger for `Nhap-Xuat` and `TonKho` in the current phase.
- Google Apps Script remains the current worker/backend.
- Firestore does not replace all Google Sheets data now.
- Firestore stores job state, invoice metadata, audit, errors, reconciliation findings, and frontend projection.
- Firebase Storage is not used.
- Cloud Functions and Cloud Run are not used yet.
- Gmail is source/trace, not canonical transaction database.
- Drive is evidence store, not business database.
- Gmail labels are projection, not canonical transaction state.
- Backend GAS and data integrity must be stable before Firebase frontend build-out.

## Approved Business Decisions

1. Incoming invoices require XML for automatic ledger write; PDF is not required for ledger write.
2. Outgoing invoices do not require PDF for ledger write when valid XML exists.
3. Link-only invoices are `REVIEW_REQUIRED`; they are not completed automatically.
4. One Gmail thread may contain multiple invoices; each invoice is a separate job.
5. Adjustment invoices are stored, linked to the original invoice, and routed to review; they do not automatically mutate ledger rows.
6. Replacement invoices are stored separately; the original invoice is marked superseded and is not deleted.
7. Cancelled invoices keep audit and are marked cancelled; they are not deleted or automatically reversed in the ledger.
8. Two lines with the same item and quantity but different unit price are separate lines.
9. `invoiceKey V2` must include invoice symbol.
10. `lineIdentity V2` uses original line economic data and does not depend on mapped item code.
11. Over-sell is blocked and routed to review; it is not silently capped and not reset to zero.
12. BQGQ orders by `issueDate`, immutable `transactionSequence`, then `sourceLineNo`.
13. Direct edits to historical `Nhap-Xuat` are not allowed.
14. When history changes, rebuild from the earliest affected transaction; full rebuild is allowed in the first phase.
15. Google Sheets remains the main ledger until a parity report, rollback plan, and owner cutover marker exist.
16. Firestore may hold a full read-only `Nhap-Xuat` projection, but it is not the source of truth.
17. Initial access is limited to `hungdiepcompany@gmail.com`.
18. A backup owner account is required before the system becomes production-critical.
19. PDF-only input may be parsed and routed to review; it does not automatically write ledger rows.
20. OCR PDF is not trusted enough to automatically write ledger rows.


## PENDING OWNER DECISIONS (Historical)

LEGACY_CHECKER_COMPATIBILITY=YES
CURRENT_OWNER_DECISIONS_PENDING_COUNT=0

This heading is retained only for the Bundle B policy marker checker. There are no current pending owner decisions after `APPROVE_RECOMMENDED_20`.
