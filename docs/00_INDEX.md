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
NEXT_ALLOWED_BUNDLE=OWNER_REVIEW_REMOTE_EXECUTOR_DELETION_METHOD

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
| Bundle C Critical Runtime Fixes Local | PASS_CRITICAL_RUNTIME_FIXES_LOCAL |
| Owner Review Bundle C Diff | PASS_BUNDLE_C_DIFF_APPROVED_FOR_DEPLOY_READINESS |
| Bundle C GAS Push | PASS_PUSHED_NOT_SMOKE_VERIFIED |
| Bundle C Read-Only UI Smoke | PASS_READ_ONLY_UI_SMOKE_OWNER_ATTESTED |
| Bundle C Single-Invoice Mutation Smoke | BLOCKED_SCANNER_SCOPE_NOT_SINGLE |
| Bundle C-S1 Single-Thread Smoke Executor Local | PASS_SINGLE_THREAD_EXECUTOR_LOCAL |
| Bundle C-S1 Single-Thread Executor GAS Push | PASS_SINGLE_THREAD_EXECUTOR_PUSHED |
| Bundle C-S3 Exact-Thread One-Invoice Smoke | PASS_EXACT_THREAD_POST_EXECUTION_VERIFIED |
| Bundle C-S4 Single-Thread Executor Cleanup | BLOCKED_REMOTE_EXECUTOR_STILL_PRESENT_AFTER_CLASP_PUSH |

## Latest Commit

LAST_RUNTIME_COMMIT=3fce0f0533fbdd64b73d3fca578e17892ac9e444
LAST_PUSH_EVIDENCE_COMMIT=6155106fc9b44e08e261204795d6e94fa8cdc3c7
LAST_SMOKE_EVIDENCE_COMMIT=c208a9e5572dbddf11e066ce30c6176118efef4e
TEMPORARY_EXECUTOR_SOURCE_STATUS=REMOVED_LOCAL_REMOTE_STILL_PRESENT
