# D6K-A Source Module And Entrypoint Inventory

PROGRAM=D6K_SOURCE_ARCHITECTURE_CONSOLIDATION_OPERATOR_ENTRYPOINT_CLEANUP_AND_RUNTIME_SAFETY_CLOSEOUT
PHASE=D6K_A_SOURCE_MODULE_AND_ENTRYPOINT_INVENTORY

## Scope

This inventory is static and read-only. It inspected repository source text only and did not execute Apps Script production entrypoints, Gmail discovery, Drive writes, Sheet writes, Firestore reads/writes, triggers, or Script Properties changes.

The generated machine-readable inventory is:

```text
artifacts/d6k/source-entrypoint-inventory.json
```

## Static Inventory Summary

```text
PROJECT_IDENTITY=SyncGmailDriveSheet
REPOSITORY=hungdiepcompany-del/tonkho
SCANNED_FILE_COUNT=351
APPS_SCRIPT_RUNTIME_FILE_COUNT=63
HTML_FILE_COUNT=3
TOP_LEVEL_FUNCTION_COUNT=755
PUBLIC_OPERATOR_ENTRYPOINT_COUNT=7
PUBLIC_MUTATION_ENTRYPOINT_COUNT=1
HISTORICAL_PHASE_ENTRYPOINT_COUNT=6
GLOBAL_NAME_COLLISION_COUNT=0
UNKNOWN_REQUIRES_REVIEW_COUNT=0
DIRECT_IMPORT_OR_EXPORT_RUNTIME_FILE_COUNT=1
DETERMINISTIC_INVENTORY_OUTPUT=PASS
INVENTORY_SHA256=239fc6e75b9571bb596e60c8424f1fddccaa84da0c2d2938dacefc36f2f6e1cf
```

`d6jPilotReadiness.js` is the only root runtime file where the static scanner detected an import/export token. D6K-A records this as architecture evidence only; no runtime source was changed in this phase.

## Frozen D6J Entrypoints

The inventory marked the following functions as historical and closed:

```text
runD6jCOneRecordProductionMutation=FROZEN_DO_NOT_EXECUTE
runD6jDRepairSingleMalformedPilotRow=FROZEN_DO_NOT_EXECUTE
runD6jD4CFirestoreEvidenceDiagnosticsReadOnly=FROZEN_DO_NOT_EXECUTE
runD6jD4DReconciliationPreviewReadOnly=FROZEN_DO_NOT_EXECUTE
runD6jD4DRecordPostHocReconciliationEvidenceOnce=FROZEN_DO_NOT_EXECUTE
runD6jD4PostRepairVerificationReadOnly=FROZEN_DO_NOT_EXECUTE
```

Safe disposition is not finalized in D6K-A. Each frozen function currently requires D6K-D evidence before choosing between a blocked compatibility wrapper, private forensic retention, privatization, or removal after zero-reference proof.

## Collision Result

```text
DUPLICATE_TOP_LEVEL_FUNCTION_NAMES=0
DUPLICATE_GLOBAL_VARIABLE_NAMES=0
FUNCTION_VARIABLE_NAME_COLLISIONS=0
HANDLER_NAMES_DEFINED_IN_MULTIPLE_FILES=0
CASE_ONLY_GLOBAL_NAME_COLLISIONS=0
GLOBAL_NAME_COLLISION_COUNT=0
```

## D6K-A Gate

```text
D6K_A_STATUS=PASS
APPS_SCRIPT_RUNTIME_CHANGED=NO
CLASP_PUSH_REQUIRED=NO
UNKNOWN_REQUIRES_REVIEW_COUNT=0
PRODUCTION_ENTRYPOINT_EXECUTED=NO
PRODUCTION_MUTATION=NONE
```
