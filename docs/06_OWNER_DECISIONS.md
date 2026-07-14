# 06 Owner Decisions

## APPROVED DECISIONS

- Google Sheets remains the main business ledger for Nhap-Xuat and TonKho in the current phase.
- Google Apps Script remains the current worker/backend.
- Firestore does not replace all Google Sheets data now.
- Firestore stores job state, invoice metadata, audit, errors, reconciliation findings, and frontend projection.
- Firebase Storage is not used.
- Cloud Functions and Cloud Run are not used yet.
- Gmail is source/trace, not canonical transaction database.
- Drive is evidence store, not business database.
- Gmail labels are projection, not canonical transaction state.
- Backend GAS and data integrity must be stable before Firebase frontend build-out.

## PENDING OWNER DECISIONS

1. Are incoming invoices required to have both XML and PDF, or XML only?
2. Are outgoing invoices required to have PDF?
3. Is link-only complete or review-required?
4. Can one Gmail thread contain multiple independent invoices?
5. How are adjustment invoices handled?
6. How are replacement invoices handled?
7. How are cancelled invoices handled?
8. Are two lines with same item/qty but different unit price separate lines?
9. Should invoiceKey include invoice symbol?
10. Which fields must lineIdentity include?
11. How should over-sell be handled?
12. What ordering policy should BQGQ use?
13. May users edit historical Nhap-Xuat?
14. If history changes, must all inventory be rebuilt?
15. How long does Google Sheets remain the main business database?
16. May Firestore store a full Nhap-Xuat projection for frontend query?
17. Which accounts besides $expectedAccount will have future access?
18. Is a backup owner account required?
19. May PDF-only emails be processed automatically?
20. Is PDF OCR fallback trusted enough to write ledger?
