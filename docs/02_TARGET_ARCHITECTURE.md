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

## D5Y Apps Script First Runtime Lock

SGDS_RUNTIME_STRATEGY=APPS_SCRIPT_FIRST_NO_BILLING
PRIMARY_WORKER=GOOGLE_APPS_SCRIPT
FILE_STORE=GOOGLE_DRIVE
BUSINESS_LEDGER=GOOGLE_SHEETS
CONTROL_PLANE=FIRESTORE
FRONTEND=FIREBASE_HOSTING_STATIC
AUTHENTICATION=FIREBASE_AUTH_GOOGLE
BILLING_REQUIRED=NO
CLOUD_RUN_STATUS=DEFERRED_OPTIONAL
CLOUD_RUN_PRIMARY_PATH=NO
CLOUD_RUN_BLOCKER_FOR_CURRENT_ROADMAP=NO
CLOUD_RUN_CODE_RETAINED=YES_OPTIONAL_ADAPTER

D5S-D5X Cloud Run work is retained as a future optional adapter. Disabled Billing, Docker, Cloud Build, Artifact Registry, and Cloud Run are no longer current-roadmap blockers because the production worker path is Google Apps Script plus Firestore REST.
