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

## D6C-D6E Apps Script Adapter Boundary

PHASE=D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS
STATUS=PASS_LOCAL_APPS_SCRIPT_ADAPTERS_IMPLEMENTED
PRIMARY_RUNTIME=apps_script
RUNTIME_ADAPTER_FACTORY=sgdsRuntimeAdapterFactory.js
CLOUD_RUN_FALLBACK_AUTOMATIC=false

Gmail, Drive, and Sheets are accessed through local adapter contracts for new D6 code. Production Apps Script remains the default runtime. Cloud Run remains retained as optional future infrastructure only.
## D6C-D6E Apps Script Adapter Foundation

PHASE=D6C_D6D_D6E_GMAIL_DRIVE_SHEETS_ADAPTERS
STATUS=PASS_LOCAL_IMPLEMENTATION_VALIDATED
PRIMARY_RUNTIME=apps_script
GMAIL_DISCOVERY_ADAPTER=IMPLEMENTED_LOCAL_ONLY
DRIVE_EVIDENCE_STORE_ADAPTER=IMPLEMENTED_LOCAL_ONLY
SHEETS_LEDGER_ADAPTER=IMPLEMENTED_LOCAL_ONLY
COMBINED_DRY_RUN_PIPELINE=IMPLEMENTED_LOCAL_ONLY
LIVE_CONFIGURATION_STATUS=NOT_LIVE_VERIFIED_PLACEHOLDERS_ONLY
SCANNER_RUNTIME_WIRING=NOT_STARTED
PRODUCTION_GOOGLE_API_CALL_COUNT=0
PRODUCTION_FIRESTORE_MUTATION=NONE

## Exact17 Local Implementation V1

PHASE=SGDS_EXACT17_LOCAL_IMPLEMENTATION_V1
STATUS=LOCAL_CANDIDATE_FROZEN_ACCEPTANCE_PENDING
DEPLOYMENT_STATUS=NOT_SYNCED_NOT_DEPLOYED

The local candidate keeps Google Sheets as the canonical ledger and adds four
coherent runtime boundaries: immutable V2 invoice/line identity for new rows,
per-invoice Gmail retry and commit projection, durable inventory verification
before completion, and deterministic inventory rebuild with run-scoped progress
and append-only audit. Legacy persisted identities remain readable. Firestore
remains workflow state and projection, not the business ledger. No production
runtime, Google account, or remote Apps Script source was changed by this phase.

## Local Source Assembly Reconciliation V1

PHASE=SGDS_LOCAL_SOURCE_ASSEMBLY_RECONCILIATION_V1
STATUS=LOCAL_CANDIDATE_ACCEPTANCE_PENDING
DEPLOYMENT_STATUS=NOT_SYNCED_NOT_DEPLOYED

The local Apps Script source set now preserves the canonical invoice support
module and the SKU Engine module observed in the fresh remote snapshot. The
existing administration menu exposes only the four reviewed SKU setup, mapping,
validation, and dry-run entrypoints. `skuEngineProductionCommit` remains
disabled. This is local source assembly only and does not establish remote
parity or authorize production execution.

## D7-E4D Same-Job Recovery Boundary

The recovery architecture preserves the existing deterministic Firestore job
identity. It does not create a successor attempt merely to bypass historical
reconciliation evidence. A future recovery runtime must use the current V2
identity contract and complete Drive, Hoa-Don, immutable ledger, inventory, and
Gmail projection verification before `COMPLETED`.

The historical D7-E pilot is not an acceptable recovery runtime because it
blocks the existing job and omits current Hoa-Don, inventory, and Gmail
projection boundaries. D7-E4D currently provides only a pure eligibility
evaluator; no production entrypoint exists or is authorized.
