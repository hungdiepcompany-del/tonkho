# 02 Target Architecture

STATUS=OWNER_APPROVED_ARCHITECTURE_RECORDED

## Responsibilities

| Component | Does | Does Not Do |
| --- | --- | --- |
| Firebase Hosting | Host future web frontend. | Run backend business mutations. |
| Firebase Authentication | Google sign-in and account allowlist. | Authorize unsafe internal GAS functions directly. |
| Firestore | Job state, metadata, audit, errors, reconciliation findings, projection data. | Replace the Nhap-Xuat/TonKho ledger in this phase. |
| Google Apps Script | Current worker/backend for Gmail, Drive, Sheets, parser, business API boundary. | Be pushed/deployed in Bundle A. |
| Gmail | Original email source and traceability. | Canonical transaction state. |
| Drive | XML/PDF/evidence artifact store. | Business ledger/database. |
| Sheets | Current business ledger and catalogs. | Long-term event/audit store without reconciliation policy. |

## Explicit Current Decisions

- Google Sheets remains the canonical business ledger for now.
- Firestore is projection/state/audit, not the primary ledger.
- Firebase Storage is not used.
- Cloud Functions and Cloud Run are not used yet.
- Backend GAS and data integrity must be stabilized before Firebase frontend build-out.
