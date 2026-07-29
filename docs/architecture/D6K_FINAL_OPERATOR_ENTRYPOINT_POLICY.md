# D6K Final Operator Entrypoint Policy

PROGRAM=D6K_SOURCE_ARCHITECTURE_CONSOLIDATION_OPERATOR_ENTRYPOINT_CLEANUP_AND_RUNTIME_SAFETY_CLOSEOUT
STATUS=PASS_OPERATOR_SURFACE_CURATED

D6K keeps externally visible handler names stable, but completed D6J pilot and repair functions are no longer operational entrypoints. Historical wrappers throw `HISTORICAL_PHASE_CLOSED_DO_NOT_EXECUTE` before any production-capable runner is created.

## Historical D6J Wrappers

| Entrypoint | Final action | Runtime status |
| --- | --- | --- |
| `runD6jCOneRecordProductionMutation` | `BLOCKED_COMPATIBILITY_WRAPPER` | `FROZEN_DO_NOT_EXECUTE` |
| `runD6jDRepairSingleMalformedPilotRow` | `BLOCKED_COMPATIBILITY_WRAPPER` | `FROZEN_DO_NOT_EXECUTE` |
| `runD6jD4CFirestoreEvidenceDiagnosticsReadOnly` | `BLOCKED_COMPATIBILITY_WRAPPER` | `FROZEN_DO_NOT_EXECUTE` |
| `runD6jD4DReconciliationPreviewReadOnly` | `BLOCKED_COMPATIBILITY_WRAPPER` | `FROZEN_DO_NOT_EXECUTE` |
| `runD6jD4DRecordPostHocReconciliationEvidenceOnce` | `BLOCKED_COMPATIBILITY_WRAPPER` | `FROZEN_DO_NOT_EXECUTE` |
| `runD6jD4PostRepairVerificationReadOnly` | `BLOCKED_COMPATIBILITY_WRAPPER` | `FROZEN_DO_NOT_EXECUTE` |

## Public Surface Metrics

```text
PUBLIC_OPERATOR_ENTRYPOINT_COUNT_BEFORE=7
PUBLIC_OPERATOR_ENTRYPOINT_COUNT_AFTER=7
PUBLIC_MUTATION_ENTRYPOINT_COUNT_BEFORE=1
PUBLIC_MUTATION_ENTRYPOINT_COUNT_AFTER=1_COMPATIBILITY_NAME_BLOCKED
HISTORICAL_PHASE_ENTRYPOINT_COUNT=6
HISTORICAL_WRAPPERS_BLOCKED=6
EXTERNAL_HANDLER_NAMES_PRESERVED=YES
FROZEN_D6J_MUTATION_REACHABILITY_COUNT=0
```

## Policy

Routine operator functions must retain explicit guard, idempotency, conflict handling, bounded mutation count, and sanitized logging contracts. Completed historical phase functions must remain blocked unless a future owner-approved phase explicitly reopens them with new evidence.
