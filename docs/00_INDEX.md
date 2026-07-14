# 00 Index

PROJECT_NAME=SyncGmailDriveSheet
GAS_SCRIPT_ID=19qIN0cXmBY9GY7ma8B2MJh25ioBsmrlrIwsr27ZB1oyFxH8VPMj0dmhM
EXPECTED_GOOGLE_ACCOUNT=hungdiepcompany@gmail.com
PROJECT_PATH=D:\CODE\SyncGmailDriveSheet
BASELINE_COMMIT=472982d
START_COMMIT=5af0a6ba23c84d027e9a55a535cbc5fd1ca10f22

BUNDLE_A=PASS
BUNDLE_B=PASS
OWNER_REVIEW=PASS
OWNER_MARKER=APPROVE_RECOMMENDED_20
DATA_CONTRACT_STATUS=OWNER_APPROVED_V1
INVARIANTS_STATUS=OWNER_APPROVED_V1
OWNER_DECISIONS_PENDING_COUNT=0
NEXT_ALLOWED_BUNDLE=BUNDLE_C_CRITICAL_RUNTIME_FIXES_LOCAL_ONLY

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
- Owner-approved data contract: `docs/03_DATA_CONTRACT.md`.
- Owner-approved decisions: `docs/06_OWNER_DECISIONS.md`.
- Current handoff: `docs/99_NEXT_AI_HANDOFF.md`.

## Bundle Status

| Bundle/Subphase | Status |
| --- | --- |
| A00 Repository Baseline | PASS_BASELINE_LOCKED |
| A01 Read-Only Evidence | PASS_READ_ONLY_EVIDENCE_CAPTURED |
| A02 Full Bug/Data Audit | PASS_BUG_REGISTER_COMPLETE |
| A03 Data Contract | OWNER_APPROVED_V1 |
| Bundle B Local Test Foundation | PASS_LOCAL_TEST_FOUNDATION |
| Owner Review | PASS_APPROVE_RECOMMENDED_20 |

## Latest Commit

LAST_COMMIT=TO_BE_FILLED_AFTER_COMMIT
