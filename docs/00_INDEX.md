# 00 Index

PROJECT_NAME=SyncGmailDriveSheet
GAS_SCRIPT_ID=19qIN0cXmBY9GY7ma8B2MJh25ioBsmrlrIwsr27ZB1oyFxH8VPMj0dmhM
EXPECTED_GOOGLE_ACCOUNT=hungdiepcompany@gmail.com
PROJECT_PATH=D:\CODE\SyncGmailDriveSheet
BASELINE_COMMIT=472982d

## Architecture Approved By Owner

- Firebase Hosting = future frontend.
- Firebase Authentication = future Google sign-in.
- Firestore = job state, metadata, audit, errors, reconciliation findings, frontend projection.
- Google Apps Script = current worker/backend.
- Gmail = invoice email source and trace source, not canonical transaction state.
- Google Drive = XML/PDF/evidence store, not business database.
- Google Sheets = current business ledger for `Nhap-Xuat`, `TonKho`, and business catalogs.

## Source Of Truth

- Runtime truth: local pulled GAS files in project root.
- Workbook truth: `ton kho - DATABASE.xlsx`, read-only SHA-256 `EF44EC11949969E81953C27848C3BDF1886BB647547DE4A70EF05D4BF8FDB267`.
- AS-IS source input: `docs/01_SYSTEM_AS_IS_SOURCE.md`, SHA-256 `3DCB1F28776AE496EFC3115D457441085B0CCEC352CD185E566CB98DFD407D14`.
- Normalized docs truth: `docs/01_SYSTEM_AS_IS.md`, `docs/03_DATA_CONTRACT.md`, `docs/05_RISK_AND_BUG_REGISTER.md`, `docs/99_NEXT_AI_HANDOFF.md`.

## Bundle Status

| Bundle/Subphase | Status |
| --- | --- |
| A00 Repository Baseline | PASS_BASELINE_LOCKED |
| A01 Read-Only Evidence | PASS_READ_ONLY_EVIDENCE_CAPTURED |
| A02 Full Bug/Data Audit | PASS_BUG_REGISTER_COMPLETE |
| A03-DRAFT Data Contract | PASS_DRAFT_READY_FOR_OWNER_REVIEW |

## Latest Commit

LAST_COMMIT=TO_BE_FILLED_AFTER_COMMIT

## Next Allowed Phase

NEXT_ALLOWED_BUNDLE=BUNDLE_B_LOCAL_TEST_FOUNDATION

## Owner Marker

OWNER_MARKER_REQUIRED=OWNER_REVIEW_DATA_CONTRACT_AND_PENDING_DECISIONS
