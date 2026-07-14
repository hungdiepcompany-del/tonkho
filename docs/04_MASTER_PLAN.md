# 04 Master Plan

BUNDLE_A=PASS
BUNDLE_B=PASS
OWNER_REVIEW=PASS
OWNER_MARKER=APPROVE_RECOMMENDED_20
DATA_CONTRACT_STATUS=OWNER_APPROVED_V1
INVARIANTS_STATUS=OWNER_APPROVED_V1
OWNER_DECISIONS_PENDING_COUNT=0
NEXT_ALLOWED_BUNDLE=BUNDLE_C_CRITICAL_RUNTIME_FIXES_LOCAL_ONLY

## Roadmap

1. Bundle A - Foundation, read-only evidence, audit, and data contract preparation. Status: PASS.
2. Bundle B - Fixture and local test foundation. Status: PASS.
3. Owner review - Recommended 20 decisions approved. Status: PASS.
4. Bundle C - Critical runtime fixes, local-only, behind the Bundle B test foundation.
5. Separate prompt - GAS push.
6. Separate prompt - Production smoke.
7. Separate prompt - Reconciliation.
8. Firebase foundation after backend is stable.

## Phase Boundary

- Bundle C may begin local-only runtime fixes using the owner-approved data contract.
- Production mutation, GAS push, Firebase deploy, remote execution, and Git push remain separate approvals.
- Google Sheets remains canonical until parity report, rollback plan, and owner cutover marker exist.

## Current Next Step

Start `BUNDLE_C_CRITICAL_RUNTIME_FIXES_LOCAL_ONLY` from commit `5af0a6ba23c84d027e9a55a535cbc5fd1ca10f22` or its owner-approval docs successor.
