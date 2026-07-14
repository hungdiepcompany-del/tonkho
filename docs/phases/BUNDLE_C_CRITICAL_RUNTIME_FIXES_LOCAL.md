# Bundle C Critical Runtime Fixes Local

STATUS=PASS_CRITICAL_RUNTIME_FIXES_LOCAL
DATE=2026-07-14
START_COMMIT=22f952ca9cc115740437963357db2ca5c79f33a6
OWNER_MARKER=APPROVE_RECOMMENDED_20
DATA_CONTRACT_STATUS=OWNER_APPROVED_V1
INVARIANTS_STATUS=OWNER_APPROVED_V1
RUNTIME_FILES_CHANGED=YES_LOCAL_ONLY
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
GIT_PUSH=NOT_RUN

## Scope

Bundle C implemented local-only runtime safety fixes behind the Bundle B test foundation.

Targeted findings:

- SGDS-CRIT-001: per-source commit result and safe Gmail saved-sheet projection.
- SGDS-CRIT-002: blank-hash ledger rows are reported, not deleted.
- SGDS-HIGH-002: Drive ingestion uses the shared preparation/dedup/commit path.
- SGDS-HIGH-009: BQGQ and TonKho use ScriptLock-backed concurrency control.
- SGDS-HIGH-010: OCR temporary document cleanup runs in finally.
- SGDS-MEDIUM-003: VietHoaDon input sheet constant is defined and used.
- SGDS-MEDIUM-005: MAX_DRIVE_SCAN_FILES is declared.
- SGDS-MEDIUM-007: terminal progress states are recorded for early exits and failures.
- SGDS-LOW-002: debug logging is sanitized through the shared logger.

Supplemental local fixes:

- Customer abbreviation dictionary keys are escaped before RegExp construction.
- Writer dead code after the unconditional return was removed.
- Stats fields incremented by the commit path are initialized.

## Boundaries Preserved

- HASH_V1_CHANGED=NO
- INVOICE_KEY_PERSISTED_FORMAT_CHANGED=NO
- BQGQ_ORDERING_POLICY_IMPLEMENTED=NO
- OVERSELL_BEHAVIOR_CHANGED=NO
- MULTIPLE_XML_PER_THREAD_CHANGED=NO
- XML_NAMESPACE_PARSER_CHANGED=NO
- PDF_ONLY_AUTO_LEDGER_CHANGED=NO
- FIRESTORE_INTEGRATION=NOT_STARTED
- SGDS-CRIT-003_DURABLE_JOB_STATE=NOT_FIXED

## Validation

Required local gates are represented by:

- `npm.cmd test`
- `npm.cmd run check`
- `npm.cmd run check:bundle-c`
- `scripts/checkers/check-doc-foundation.ps1`
- `scripts/checkers/check-no-secret.ps1`
- `scripts/checkers/check-workbook-unchanged.ps1`
- `scripts/checkers/check-internal-doc-links.ps1`
- `git diff --check`

Bundle C adds `scripts/checkers/check-bundle-c-critical-runtime-fixes.mjs` and package script `check:bundle-c`.

## Handoff

NEXT_ALLOWED_PHASE=OWNER_REVIEW_BUNDLE_C_DIFF
NEXT_AI_FIRST_ACTION=Review the local Bundle C diff and validation evidence; do not run GAS push, deploy, Git push, or production data mutation without a separate prompt.
