# D6K Final Apps Script Business Module Architecture

PROGRAM=D6K_SOURCE_ARCHITECTURE_CONSOLIDATION_OPERATOR_ENTRYPOINT_CLEANUP_AND_RUNTIME_SAFETY_CLOSEOUT
STATUS=PASS_ARCHITECTURE_CONSOLIDATED

D6K reorganized the Apps Script runtime by business responsibility while preserving Apps Script global-scope compatibility. No imports, exports, build step, trigger change, menu change, Script Property change, or production execution was introduced.

## Runtime Module Map

| Responsibility | Runtime files | D6K action |
| --- | --- | --- |
| Shared normalization | `Shared_Normalization.js`, `normalization.js` | Pure helpers moved to shared module; compatibility file retained. |
| Shared hashing | `Shared_Hashing.js`, `hashUtils.js` | Hash helpers moved to shared module; behavior and names preserved. |
| Attachment parsing | `Invoice_AttachmentParser.js`, `xmlParser.js`, `pdfParser.js` | XML/PDF parser declarations consolidated; compatibility stubs retained. |
| Operator policy | `Operator_Entrypoints.js` | Historical D6J public wrappers fail closed before runner creation. |
| Gmail discovery and labels | `gmailSearch.js`, `gmailScanner.js`, `gmailLabels.js`, `gmailCollection.js`, `gmailDetector.js`, `gmailValidate.js` | Preserved. |
| Drive evidence | `driveUtils.js`, `sgdsDriveAdapter.js`, `gasDriveReadOnlyReader.js` | Preserved. |
| Sheet ledger and UI | `sheetWriter.js`, `sheetNhapXuat.js`, `sheetTonKho.js`, `sheetHoaDon.js`, `sheetMenu.js`, `VietHoaDon_GAS.js` | Preserved. |
| Durable job state | `durableJobState.js`, `durableInvoiceOrchestrator.js`, `firestoreDurableJobStore.js`, `firestoreRestGateway.js` | Preserved. |
| Scanner shadow and checkpoint bridge | `durableScannerShadowBridge.js`, `durableScannerShadowRunner.js`, `sgdsCheckpointWorker.js`, `sgdsCommandQueue.js` | Preserved. |
| Triggers and web handlers | `triggers.js`, `_triggerDriveScanner.js`, `_triggerMarkInvoiceEmails.js`, `sheetSidebar.html`, `VietHoaDon_UI.html` | Handler names preserved. |

## Closeout Boundaries

```text
BUSINESS_MODULE_ARCHITECTURE=COMPLETE
IMPORTS_OR_EXPORTS_ADDED=NO
BUILD_STEP_REQUIRED_FOR_APPS_SCRIPT=NO
TRIGGER_OR_MENU_HANDLER_RENAMED=NO
FIREBASE_FRONTEND_BEHAVIOR_CHANGED=NO
BOM_OR_FOREIGN_PROJECT_RUNTIME_INTRODUCED=NO
PRODUCTION_ENTRYPOINT_EXECUTED=NO
PRODUCTION_MUTATION=NONE
```
