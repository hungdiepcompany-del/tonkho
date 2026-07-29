# D6K-A Operator Entrypoint Policy Draft

PHASE=D6K_A_SOURCE_MODULE_AND_ENTRYPOINT_INVENTORY
STATUS=DRAFT_FOR_D6K_D

## Policy

D6K will converge the Apps Script Run selector and operator surface toward explicit business entrypoints. D6K-A is an inventory phase only, so no entrypoint was renamed, hidden, executed, or removed.

## Allowed Public Surface Categories

```text
PUBLIC_OPERATOR_ENTRYPOINT=routine operator command or bounded administrative command
PUBLIC_READ_ONLY_ENTRYPOINT=read-only audit, dry-run, inspection or smoke function
PUBLIC_MUTATION_ENTRYPOINT=mutation function requiring explicit approval, idempotency and bounded counts
TRIGGER_HANDLER=installed or string-addressed trigger function
WEB_APP_HANDLER=doGet/doPost or web app callable handler
MENU_HANDLER=custom menu handler or menu-visible function
COMPATIBILITY_WRAPPER=public name retained only to preserve existing callers
```

## Historical Phase Rule

Completed D6J production functions are not routine operator functions. They must remain frozen until D6K-D decides, with evidence, whether each one is privatized, blocked as a compatibility wrapper, retained privately for forensic reproduction, or removed after zero-reference proof.

Any retained public historical wrapper must fail closed with a clear closed-phase status and must not call the original production mutation implementation.

## Runtime Safety Requirements

```text
PRODUCTION_ENTRYPOINT_EXECUTED=NO
PRODUCTION_MUTATION=NONE
APPROVAL_MARKERS_CHANGED=NO
SCRIPT_PROPERTIES_CHANGED=NO
TRIGGERS_CHANGED=NO
GMAIL_DRIVE_SHEETS_FIRESTORE_MUTATION=NONE
```

## D6K-D Completion Criteria

```text
PUBLIC_OPERATOR_ENTRYPOINT_COUNT_BEFORE=7
PUBLIC_MUTATION_ENTRYPOINT_COUNT_BEFORE=1
HISTORICAL_PHASE_ENTRYPOINT_COUNT=6
BROKEN_STRING_HANDLER_REFERENCE_COUNT=0_REQUIRED
FROZEN_D6J_MUTATION_REACHABILITY_COUNT=0_REQUIRED
```
