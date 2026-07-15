# 05 Risk And Bug Register

A02_STATUS=PASS_BUG_REGISTER_COMPLETE
RUNTIME_CODE_CHANGED=YES_LOCAL_ONLY

Severity counts:

- CRITICAL=3
- HIGH=10
- MEDIUM=10
- LOW=2

Workbook integrity evidence:

- WORKBOOK_READ=PASS
- WORKBOOK_SHA256=EF44EC11949969E81953C27848C3BDF1886BB647547DE4A70EF05D4BF8FDB267
- NHAP_XUAT_BLANK_HASH_COUNT=0
- NHAP_XUAT_DUPLICATE_HASH_COUNT=10
- NHAP_XUAT_DUPLICATE_INVOICEKEY_COUNT=2
- NHAP_XUAT_ROWS_MISSING_ANY_J_TO_M=23

## SGDS-CRIT-001

BUG_ID=SGDS-CRIT-001
TITLE=Batch-level writeOk can mark every thread as saved after partial/no accepted-row write
SEVERITY=CRITICAL
STATUS=CONFIRMED_FROM_SOURCE
FILES=main.js
FUNCTIONS=_mainInternal_,setExclusiveLabel_
EVIDENCE=main.js:95 and main.js:113 show one boolean drives labels for all threads.
REPRODUCTION_CONDITION=Mixed batch with accepted, duplicate, skipped, or failed invoice rows.
DATA_IMPACT=False saved state can hide invoices not committed to ledger.
RUNTIME_IMPACT=Future scans may skip work because Gmail label projection says saved.
PROPOSED_INVARIANT=Saved label only after per-invoice row commit is confirmed.
PROPOSED_DIRECTION=Introduce per-invoice job state and label projection after commit.
TEST_REQUIRED=Mixed accepted/duplicate/failure batch fixture.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/bugs/batch-state.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## SGDS-CRIT-002

BUG_ID=SGDS-CRIT-002
TITLE=Writer deletes existing ledger rows with blank hash before append
SEVERITY=CRITICAL
STATUS=CONFIRMED_FROM_SOURCE
FILES=sheetWriter.js
FUNCTIONS=writeInvoicesToSheet_,deleteEmptyRows_
EVIDENCE=sheetWriter.js:15 and sheetWriter.js:166 delete rows whose hash column is blank.
REPRODUCTION_CONDITION=Existing historical or manually repaired row has blank column N.
DATA_IMPACT=Ledger history can be removed as side effect of import.
RUNTIME_IMPACT=Normal invoice write can mutate unrelated historical data.
PROPOSED_INVARIANT=Never delete ledger rows solely because hash is blank.
PROPOSED_DIRECTION=Report/quarantine blank-hash rows; repair only in owner-approved flow.
TEST_REQUIRED=Blank-hash historical row fixture.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/bugs/implicit-row-delete.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## SGDS-CRIT-003

BUG_ID=SGDS-CRIT-003
TITLE=No durable transaction across Gmail, Drive, Hoa-Don, Nhap-Xuat, and labels
SEVERITY=CRITICAL
STATUS=DESIGN_RISK
FILES=gmailScanner.js,gmailProcessInvoiceXML.js,sheetWriter.js
FUNCTIONS=scanInvoiceInEmails_,scanInvoiceOutEmails_,upsertHoaDonFile_,writeInvoicesToSheet_
EVIDENCE=Source writes Drive, Hoa-Don, Sheet rows, and Gmail labels in separate steps without durable job state.
REPRODUCTION_CONDITION=Any failure between artifact save, row write, registry update, and label update.
DATA_IMPACT=Partial commits cannot be reliably reconciled from canonical job state.
RUNTIME_IMPACT=Retries can duplicate, miss, or falsely complete invoices.
PROPOSED_INVARIANT=Every invoice/job has durable state and idempotent commit core.
PROPOSED_DIRECTION=Create durable per-invoice job state, idempotent commit plan, report-only reconciliation, and owner-gated repair before expanding automation.
TEST_REQUIRED=Failure-injection fixtures across every boundary.
OWNER_DECISION_REQUIRED=NO

## SGDS-HIGH-001

BUG_ID=SGDS-HIGH-001
TITLE=Incoming scanner processes only first valid XML invoice attachment
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE
FILES=gmailScanner.js,gmailProcessInvoiceXML.js
FUNCTIONS=scanInvoiceInEmails_,processInvoiceAllXMLAttachments_
EVIDENCE=gmailScanner.js:330 passes breakOnFirst and gmailProcessInvoiceXML.js:51 breaks after first ok XML.
REPRODUCTION_CONDITION=Incoming Gmail thread/message includes multiple valid XML invoices.
DATA_IMPACT=Additional invoices can be skipped.
RUNTIME_IMPACT=Missing ledger rows and incomplete evidence registry.
PROPOSED_INVARIANT=One source may contain multiple invoices unless owner forbids it.
PROPOSED_DIRECTION=Represent invoice per attachment/job; do not stop at first XML without policy.
TEST_REQUIRED=Two-XML incoming-thread fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-002

BUG_ID=SGDS-HIGH-002
TITLE=Drive scanner bypasses Gmail job flow and shared commit state
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE
FILES=_triggerDriveScanner.js,sheetWriter.js
FUNCTIONS=triggerScanInvoiceDriveFolder,parseInvoiceXMLFile_,writeInvoicesToSheet_
EVIDENCE=_triggerDriveScanner.js:97 writes parsed Drive XML rows directly.
REPRODUCTION_CONDITION=Drive backfill sees files that overlap with Gmail-ingested invoices.
DATA_IMPACT=Duplicate or inconsistent ledger/registry state.
RUNTIME_IMPACT=Backfill has no durable tie to Gmail source state.
PROPOSED_INVARIANT=Gmail and Drive ingestion use one idempotent commit core.
PROPOSED_DIRECTION=Bundle C should refactor behind local tests.
TEST_REQUIRED=Drive/Gmail duplicate fixture.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/bugs/drive-dedup-bypass.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## SGDS-HIGH-003

BUG_ID=SGDS-HIGH-003
TITLE=Hash omits unit price and line identity
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE
FILES=hashUtils.js
FUNCTIONS=buildInvoiceItemHash_
EVIDENCE=hashUtils.js:89 hash fields end at quantity and omit price/line number.
REPRODUCTION_CONDITION=Two lines share date/no/customer/item/type/qty but differ in unit price.
DATA_IMPACT=Distinct economic lines collapse as duplicates.
RUNTIME_IMPACT=Inventory valuation can be undercounted or wrong.
PROPOSED_INVARIANT=lineIdentity includes economic distinguishing fields.
PROPOSED_DIRECTION=Owner-approved line identity and migration repair plan.
TEST_REQUIRED=Same qty different unit price fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-004

BUG_ID=SGDS-HIGH-004
TITLE=Multiple invoiceKey construction paths can diverge
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE
FILES=gmailProcessInvoiceXML.js,gmailScanner.js,sheetHoaDon.js,_triggerDriveScanner.js
FUNCTIONS=processInvoiceXMLAttachment_,buildInvoiceKey_,parseInvoiceFromFileName_
EVIDENCE=XML row builds `${yyyyMMdd}_${taxCode}_${invoiceNo}` inline while registry/Drive code calls buildInvoiceKey_ and Drive scanner parses filenames.
REPRODUCTION_CONDITION=Date or invoice number formatting differs by path.
DATA_IMPACT=Hoa-Don links and ledger invoiceKey can diverge.
RUNTIME_IMPACT=PDF/XML registry may not join to ledger rows.
PROPOSED_INVARIANT=One canonical invoiceKey builder used everywhere.
PROPOSED_DIRECTION=Centralize invoiceKey builder with tests and owner decision about symbol.
TEST_REQUIRED=Date-format and symbol fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-005

BUG_ID=SGDS-HIGH-005
TITLE=Item-code mapping depends on ordered substring includes
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE
FILES=xmlParser.js
FUNCTIONS=getItemCodeFromSheet_,buildItemCodeList_
EVIDENCE=xmlParser.js:215 returns first catalog name included in normalized XML name.
REPRODUCTION_CONDITION=Catalog has overlapping item names.
DATA_IMPACT=Invoice lines can map to wrong code.
RUNTIME_IMPACT=Inventory/BQGQ drift by item.
PROPOSED_INVARIANT=Mapping is deterministic, exact or owner-approved fuzzy with ambiguity audit.
PROPOSED_DIRECTION=Add ambiguity detection and review queue.
TEST_REQUIRED=Overlapping catalog names fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-011

BUG_ID=SGDS-HIGH-011
TITLE=BQGQ calculation depends on row order before approved ordering policy is implemented
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_TEST_BASELINE
FILES=sheetNhapXuat.js
FUNCTIONS=capNhatNhapXuatBQGQ
EVIDENCE=Bundle B test `tests/bugs/bqgq-ordering.test.mjs` captures current row-order sensitivity.
REPRODUCTION_CONDITION=Same transactions presented in different row order before immutable transaction ordering is enforced.
DATA_IMPACT=Average cost and stock calculations can vary with sheet/order state.
RUNTIME_IMPACT=Inventory projection can drift across rebuilds.
PROPOSED_INVARIANT=BQGQ sorts by `issueDate`, immutable `transactionSequence`, then `sourceLineNo`.
PROPOSED_DIRECTION=Bundle C should implement owner-approved ordering behind local tests.
TEST_REQUIRED=BQGQ ordering fixture.
OWNER_DECISION_REQUIRED=NO
OWNER_POLICY_DECISIONS=APPROVED_RECOMMENDED_20
RUNTIME_FIX_STATUS=NOT_STARTED

## SGDS-HIGH-006

BUG_ID=SGDS-HIGH-006
TITLE=BQGQ caps over-sell quantity without owner policy
SEVERITY=HIGH
STATUS=OWNER_POLICY_UNKNOWN
FILES=sheetNhapXuat.js
FUNCTIONS=capNhatNhapXuatBQGQ
EVIDENCE=sheetNhapXuat.js logs over-sell and caps quantity to stock.
REPRODUCTION_CONDITION=XUAT quantity exceeds accumulated item stock.
DATA_IMPACT=Displayed ledger quantity and calculated quantity can differ.
RUNTIME_IMPACT=Policy violation can be hidden by capped calculations.
PROPOSED_INVARIANT=Over-sell handling is explicit owner policy.
PROPOSED_DIRECTION=Block/allow-negative/cap policy must be chosen before fix.
TEST_REQUIRED=Over-sell BQGQ fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-007

BUG_ID=SGDS-HIGH-007
TITLE=TonKho resets over-sell state to zero
SEVERITY=HIGH
STATUS=OWNER_POLICY_UNKNOWN
FILES=sheetTonKho.js
FUNCTIONS=capNhatTonKho
EVIDENCE=sheetTonKho.js:101 resets quantity/value/average on over-sell.
REPRODUCTION_CONDITION=Inventory summary rebuild sees over-sell.
DATA_IMPACT=Negative inventory can be erased from projection.
RUNTIME_IMPACT=Operators may see zero instead of debt/negative/error state.
PROPOSED_INVARIANT=TonKho projection preserves policy state/audit.
PROPOSED_DIRECTION=Decide over-sell policy then implement projection behavior.
TEST_REQUIRED=Over-sell TonKho fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-008

BUG_ID=SGDS-HIGH-008
TITLE=Shared FileLog can erase another job's evidence
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE
FILES=sheetNhapXuat.js,sheetTonKho.js,sheetFileLog.js
FUNCTIONS=capNhatNhapXuatBQGQ,capNhatTonKho,clearLog
EVIDENCE=Both BQGQ and TonKho clear/write `FileLog`; sidebar exposes clearLog.
REPRODUCTION_CONDITION=Two jobs run close together or operator clears log.
DATA_IMPACT=Prior job evidence disappears.
RUNTIME_IMPACT=Debugging and reconciliation lose last failure details.
PROPOSED_INVARIANT=Each job has separated durable audit log.
PROPOSED_DIRECTION=Separate logs or append-only audit with jobId.
TEST_REQUIRED=Concurrent/sequence log fixture.
OWNER_DECISION_REQUIRED=NO

## SGDS-HIGH-009

BUG_ID=SGDS-HIGH-009
TITLE=Cache running flags expire after 300 seconds
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE
FILES=sheetNhapXuat.js,sheetTonKho.js
FUNCTIONS=setNXRunning_,setTKRunning_
EVIDENCE=Both running flags use CacheService TTL=300 seconds while jobs process batches and UI progress.
REPRODUCTION_CONDITION=Job exceeds five minutes or runtime stalls.
DATA_IMPACT=Second run can start after cache expiration.
RUNTIME_IMPACT=Concurrent writes or inconsistent projections.
PROPOSED_INVARIANT=Running state lasts at least as long as job or is lock-backed.
PROPOSED_DIRECTION=Use lock/job state, not only cache TTL.
TEST_REQUIRED=Long-run simulation fixture.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/bugs/progress-state.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## SGDS-HIGH-010

BUG_ID=SGDS-HIGH-010
TITLE=PDF OCR temp document cleanup is not protected by finally
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE
FILES=pdfParser.js
FUNCTIONS=extractPdfText_
EVIDENCE=pdfParser.js:15 creates temp doc and pdfParser.js:28 trashes only after read succeeds.
REPRODUCTION_CONDITION=DocumentApp open/read throws after temp doc creation.
DATA_IMPACT=Temporary Google Docs can remain in Drive.
RUNTIME_IMPACT=Drive clutter and possible sensitive invoice text exposure.
PROPOSED_INVARIANT=Temporary OCR artifacts cleaned in finally.
PROPOSED_DIRECTION=Wrap cleanup in finally with file id guard.
TEST_REQUIRED=Exception-in-OCR cleanup fixture.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/unit/pdf-link.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## SGDS-MEDIUM-001

BUG_ID=SGDS-MEDIUM-001
TITLE=PDF VAT detection checks only first 50 characters
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_SOURCE
FILES=pdfParser.js
FUNCTIONS=isVatInvoicePDF_
EVIDENCE=pdfParser.js:6 limits detection window.
REPRODUCTION_CONDITION=OCR text has banner/noise before VAT phrase.
DATA_IMPACT=Valid PDFs can be missed.
RUNTIME_IMPACT=Pending/incomplete Drive evidence.
PROPOSED_INVARIANT=PDF detection uses robust bounded markers.
PROPOSED_DIRECTION=Use wider normalized text and structured signals.
TEST_REQUIRED=Delayed-marker OCR text fixture.
OWNER_DECISION_REQUIRED=NO

## SGDS-MEDIUM-002

BUG_ID=SGDS-MEDIUM-002
TITLE=XML parser is namespace-fragile
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_SOURCE
FILES=xmlParser.js
FUNCTIONS=parseInvoiceMeta_,parseSeller_,parseBuyer_,parseInvoiceItems_
EVIDENCE=xmlParser.js:51 uses direct child names without namespace handling.
REPRODUCTION_CONDITION=Invoice XML includes namespaces or variant schema.
DATA_IMPACT=Valid XML may parse as missing metadata/items.
RUNTIME_IMPACT=Invoices can remain pending or be skipped.
PROPOSED_INVARIANT=Parser handles supported namespace/schema variants.
PROPOSED_DIRECTION=Add namespace-aware helpers and fixture set.
TEST_REQUIRED=Namespaced XML fixture.
OWNER_DECISION_REQUIRED=NO

## SGDS-MEDIUM-003

BUG_ID=SGDS-MEDIUM-003
TITLE=VietHoaDon initial data references undefined VHD.SHEET_NAME
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_SOURCE
FILES=VietHoaDon_GAS.js
FUNCTIONS=vhdGetInitialData
EVIDENCE=VietHoaDon_GAS.js:54 references a property not defined in VHD.
REPRODUCTION_CONDITION=Web UI calls initial-data endpoint.
DATA_IMPACT=Input cells may not load from intended sheet.
RUNTIME_IMPACT=UI may show defaults or fail unexpectedly.
PROPOSED_INVARIANT=Sheet constants are defined and tested.
PROPOSED_DIRECTION=Use `TONKHO_SHEET_NAME` or define `SHEET_NAME` after owner intent.
TEST_REQUIRED=VHD initial load fixture.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/bugs/vhd-config.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## SGDS-MEDIUM-004

BUG_ID=SGDS-MEDIUM-004
TITLE=Named ranges include workbook ranges not declared in source
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_WORKBOOK
FILES=ton kho - DATABASE.xlsx,VietHoaDon_GAS.js
FUNCTIONS=readVietHoaDonInput_
EVIDENCE=Workbook has VHD_DG2_TO, VHD_DG2_BE, VHD_SL2_TO, VHD_SL2_BE while source NAMED_RANGES only reads SL1/DG1 and target fields.
REPRODUCTION_CONDITION=Owner expects two-line UI inputs to persist/load.
DATA_IMPACT=Some workbook inputs may be ignored by backend.
RUNTIME_IMPACT=UI calculations may not reflect sheet state.
PROPOSED_INVARIANT=Named range contract matches workbook and UI.
PROPOSED_DIRECTION=Decide whether second line ranges are obsolete or required.
TEST_REQUIRED=Named range contract test.
OWNER_DECISION_REQUIRED=YES

## SGDS-MEDIUM-005

BUG_ID=SGDS-MEDIUM-005
TITLE=Drive scanner max file limit is undeclared in CONFIG
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_SOURCE
FILES=_triggerDriveScanner.js,config.js
FUNCTIONS=triggerScanInvoiceDriveFolder
EVIDENCE=_triggerDriveScanner.js:5 reads CONFIG.MAX_DRIVE_SCAN_FILES but config.js does not declare it.
REPRODUCTION_CONDITION=Large Drive tree or owner expects configured scan cap.
DATA_IMPACT=Scan cap silently defaults to 100.
RUNTIME_IMPACT=Backfill coverage may be incomplete without visible config.
PROPOSED_INVARIANT=Every used config key is declared with default and docs.
PROPOSED_DIRECTION=Add config only in runtime-fix phase.
TEST_REQUIRED=Config inventory checker.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/bugs/config-stats.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## SGDS-MEDIUM-006

BUG_ID=SGDS-MEDIUM-006
TITLE=main guard differs from trigger classification guard
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_SOURCE
FILES=main.js,_triggerMarkInvoiceEmails.js,sercurity.js
FUNCTIONS=main,guardTrigger_,assertTriggerSignature_
EVIDENCE=main calls owner/audit/anti-replay/minute guard but not assertTriggerSignature_; trigger classifier calls guardTrigger_.
REPRODUCTION_CONDITION=Different entrypoints are installed or manually run.
DATA_IMPACT=Security assumptions vary by path.
RUNTIME_IMPACT=Guard policy is inconsistent.
PROPOSED_INVARIANT=All production entrypoints share explicit guard policy.
PROPOSED_DIRECTION=Owner approve entrypoint policy and test.
TEST_REQUIRED=Static guard checker.
OWNER_DECISION_REQUIRED=YES

## SGDS-MEDIUM-007

BUG_ID=SGDS-MEDIUM-007
TITLE=Early returns can leave progress incomplete
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_SOURCE
FILES=sheetNhapXuat.js,sheetTonKho.js
FUNCTIONS=capNhatNhapXuatBQGQ,capNhatTonKho
EVIDENCE=Both jobs set running/progress then return early when no rows, without setting completed status.
REPRODUCTION_CONDITION=Sheet has no data rows or missing source rows.
DATA_IMPACT=UI may poll stale or nonterminal state.
RUNTIME_IMPACT=User sees incomplete progress.
PROPOSED_INVARIANT=Every job exits with completed/failed terminal state.
PROPOSED_DIRECTION=Set terminal progress in all early exits.
TEST_REQUIRED=No-row fixture.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/bugs/progress-state.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## SGDS-MEDIUM-008

BUG_ID=SGDS-MEDIUM-008
TITLE=onEdit can rewrite hash and formatting for user edits without full policy/audit
SEVERITY=MEDIUM
STATUS=DESIGN_RISK
FILES=triggers.js,sheetWriter.js
FUNCTIONS=onEdit,applyInvoiceFormatsForRows_
EVIDENCE=onEdit rewrites hash column/data hashes, applies formatting, and sets NEED_RECALC_NX.
REPRODUCTION_CONDITION=User edits historical ledger range.
DATA_IMPACT=History changes can alter dedup identity.
RUNTIME_IMPACT=Rebuild required but not durable/audited.
PROPOSED_INVARIANT=Historical edits are policy-governed and audited.
PROPOSED_DIRECTION=Owner decide edit policy and repair workflow.
TEST_REQUIRED=Manual edit fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-MEDIUM-009

BUG_ID=SGDS-MEDIUM-009
TITLE=Workbook has many Nhap-Xuat rows missing J:M
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_WORKBOOK
FILES=ton kho - DATABASE.xlsx
FUNCTIONS=Workbook snapshot
EVIDENCE=Read-only workbook stats count rows missing one or more J:M fields.
REPRODUCTION_CONDITION=Ledger rows are not fully calculated after import or historical edit.
DATA_IMPACT=BQGQ/TonKho may be stale or incomplete.
RUNTIME_IMPACT=Frontend/projection can show incomplete economics.
PROPOSED_INVARIANT=Ledger calculation columns have explicit freshness status.
PROPOSED_DIRECTION=Add report-only reconciliation in future phase.
TEST_REQUIRED=Workbook snapshot integrity check.
OWNER_DECISION_REQUIRED=NO

## SGDS-MEDIUM-010

BUG_ID=SGDS-MEDIUM-010
TITLE=Duplicate invoiceKey exists by design but lacks line-level identity policy
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_WORKBOOK
FILES=ton kho - DATABASE.xlsx
FUNCTIONS=Workbook snapshot
EVIDENCE=Read-only workbook stats count duplicate invoiceKey occurrences; multiple lines per invoice may be valid but line identity is not explicit.
REPRODUCTION_CONDITION=Multi-line invoice or duplicated ingestion.
DATA_IMPACT=Cannot distinguish valid multi-line invoice from duplicate invoice without line identity.
RUNTIME_IMPACT=Dedup and reconciliation ambiguity.
PROPOSED_INVARIANT=invoiceKey groups invoice; lineIdentity identifies line.
PROPOSED_DIRECTION=Data contract draft must define both.
TEST_REQUIRED=Multi-line invoice fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-LOW-001

BUG_ID=SGDS-LOW-001
TITLE=clearLog deletes FileLog contents without job scoping
SEVERITY=LOW
STATUS=CONFIRMED_FROM_SOURCE
FILES=sheetFileLog.js,sheetSidebar.html
FUNCTIONS=clearLog
EVIDENCE=sheetFileLog.js:3 clears the sheet contents.
REPRODUCTION_CONDITION=Operator clicks clear log while evidence is needed.
DATA_IMPACT=Local troubleshooting evidence is lost.
RUNTIME_IMPACT=UI status can hide prior errors.
PROPOSED_INVARIANT=Log clear requires scope/audit or append-only history.
PROPOSED_DIRECTION=Move to job-scoped logs.
TEST_REQUIRED=Sidebar log test.
OWNER_DECISION_REQUIRED=NO

## SGDS-LOW-002

BUG_ID=SGDS-LOW-002
TITLE=Debug logging can include email body/subject snippets
SEVERITY=LOW
STATUS=CONFIRMED_FROM_SOURCE
FILES=_triggerMarkInvoiceEmails.js,utils.js
FUNCTIONS=isInvoiceContent_,debugLog_
EVIDENCE=Trigger classifier logs subject and body-derived evidence during detection.
REPRODUCTION_CONDITION=DEBUG_LOG is enabled and Gmail content includes sensitive text.
DATA_IMPACT=PII/sensitive invoice body can enter Apps Script logs.
RUNTIME_IMPACT=Logs may expose invoice details.
PROPOSED_INVARIANT=Production logs avoid raw invoice/body content.
PROPOSED_DIRECTION=Sanitize debug logs in runtime-fix phase.
TEST_REQUIRED=Logging fixture.
OWNER_DECISION_REQUIRED=NO
ORIGINAL_STATUS=CONFIRMED_FROM_SOURCE
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
BUNDLE_C_TEST=tests/bugs/log-sanitization.test.mjs
BUNDLE_C_TEST_RESULT=REGRESSION_INVARIANT_PASS

## Bundle B Local Test Coverage

BUNDLE_B_COVERAGE_STATUS=PASS
TEST_COVERAGE=YES_FOR_MANDATED_B05_REPRODUCTION_GROUPS
OWNER_POLICY_DECISIONS=APPROVED_RECOMMENDED_20
RUNTIME_FIX_STATUS=NOT_STARTED

| Bug or policy area | Test path | Test result |
| --- | --- | --- |
| SGDS-CRIT-001 batch-level saved label state | `tests/bugs/batch-state.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| SGDS-CRIT-002 implicit blank-hash row delete | `tests/bugs/implicit-row-delete.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| SGDS-HIGH-001 XML first-only incoming attachment processing | `tests/bugs/xml-first-only.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-002 Drive scanner dedup bypass | `tests/bugs/drive-dedup-bypass.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| SGDS-HIGH-003 hash identity omits economic fields | `tests/bugs/hash-identity.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-005 item-code ordered substring matching | `tests/bugs/bqgq-ordering.test.mjs` | BUG_REPRODUCED_SOURCE_PATTERN |
| SGDS-HIGH-011 BQGQ row-order sensitivity | `tests/bugs/bqgq-ordering.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-006 over-sell BQGQ display policy gap | `tests/bugs/oversell-display.test.mjs` | BUG_REPRODUCED_POLICY_PENDING |
| SGDS-HIGH-007 TonKho over-sell reset policy gap | `tests/bugs/oversell-display.test.mjs` | BUG_REPRODUCED_POLICY_PENDING |
| SGDS-HIGH-008 and SGDS-LOW-001 FileLog competition and clear scope | `tests/bugs/filelog-competition.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-009 running/progress cache and early exit state | `tests/bugs/progress-state.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| SGDS-MEDIUM-001 PDF VAT first-50-character detection | `tests/unit/pdf-link.test.mjs` | CURRENT_BEHAVIOR_CAPTURED |
| SGDS-MEDIUM-002 XML namespace fragility | `tests/unit/xml-parser.test.mjs` | CURRENT_BEHAVIOR_CAPTURED |
| SGDS-MEDIUM-003 VHD undefined sheet config | `tests/bugs/vhd-config.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| SGDS-MEDIUM-004 workbook named-range contract mismatch | `tests/schema/sheet-contract.test.mjs` | SCHEMA_CONTRACT_CAPTURED |
| SGDS-MEDIUM-007 early returns can leave progress incomplete | `tests/bugs/progress-state.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| Customer abbreviation regex escape bug | `tests/bugs/regex-escape.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| Dead code after writer return | `tests/bugs/dead-code.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| Body duplicate branch skips attachment collection | `tests/bugs/body-dedup-attachment.test.mjs` | BUG_REPRODUCED |

CONFIRMED_BUGS_WITH_TESTS=13
CONFIRMED_BUGS_NOT_LOCALLY_TESTABLE=0_FOR_MANDATED_B05_GROUPS
POLICY_PENDING_TEST_COUNT=1
SKIPPED_TEST_COUNT=1_TARGET_INVARIANT_DRAFT


## Bundle C Local Fix Coverage

BUNDLE_C_STATUS=PASS_CRITICAL_RUNTIME_FIXES_LOCAL
LOCAL_FIX_STATUS=FIXED_LOCAL_NOT_DEPLOYED
PRODUCTION_FIX_STATUS=NOT_DEPLOYED
SGDS_CRIT_003_STATUS=NOT_FIXED_DESIGN_RISK_REMAINS

| Area | Test path | Result |
| --- | --- | --- |
| SGDS-HIGH-010 OCR temp cleanup | `tests/unit/pdf-link.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| SGDS-MEDIUM-005 Drive scan config | `tests/bugs/config-stats.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| SGDS-LOW-002 safe logging | `tests/bugs/log-sanitization.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |
| Stats initialization | `tests/bugs/config-stats.test.mjs` | BUG_BLOCKED_LOCAL_NOT_DEPLOYED |

Bundle C does not mark any fix as deployed or production-verified.


## Bundle C Single-Invoice Smoke Gate Risk

BUNDLE_C_SINGLE_INVOICE_SMOKE_STATUS=BLOCKED_LOCAL_PREFLIGHT
RISK_ID=SGDS-SMOKE-GATE-001
TITLE=One-invoice production smoke requires verified expected account before mutation
SEVERITY=HIGH
STATUS=BLOCKED_BEFORE_MUTATION
EVIDENCE=Local checks passed, script ID matched, but clasp did not expose authorized email and browser Gmail session was not verified as the expected account.
PRODUCTION_MUTATION=NONE
RUNTIME_FILES_CHANGED=NO
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ACTION=Resume only after the controllable browser or execution context is verified as the expected account and scanner candidate count is proven exactly 1.


## Bundle C Resumed Single-Invoice Smoke Scope Risk

BUNDLE_C_SINGLE_INVOICE_SMOKE_STATUS=BLOCKED_SCANNER_SCOPE_NOT_SINGLE
RISK_ID=SGDS-SMOKE-GATE-002
TITLE=Production main scanner queue is not limited to one approved invoice
SEVERITY=HIGH
STATUS=BLOCKED_BEFORE_MUTATION
EVIDENCE=Owner-confirmed Gmail account passed, but Gmail UI searches matching production scanner queries showed OUT=8 and IN=2 candidates. The production `main()` entrypoint scans both queues.
PRODUCTION_MUTATION=NONE
EXECUTION_ATTEMPT_COUNT=0
RUNTIME_FILES_CHANGED=NO
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ACTION=Do not run `main()` for one-invoice smoke until the production candidate queue is exactly one or a separately approved scoped production mechanism exists.

## Bundle C-S1 Single-Thread Smoke Executor Local Patch

OWNER_MARKER=OWNER_APPROVE_BUNDLE_C_SINGLE_THREAD_EXECUTOR_LOCAL_PATCH
PREVIOUS_BLOCKER=SCANNER_CANDIDATE_COUNT_NOT_SINGLE
PREVIOUS_GLOBAL_CANDIDATE_COUNT=10
SINGLE_THREAD_EXECUTOR_STATUS=PASS_SINGLE_THREAD_EXECUTOR_LOCAL
SINGLE_THREAD_EXECUTOR_GAS_PUSH_STATUS=BLOCKED_CLASP_REAUTH_REQUIRED
EXACT_THREAD_SCOPE=1
PRODUCTION_MUTATION=NONE
SCRIPT_PROPERTIES_MUTATION=NONE
GAS_PUSH=BLOCKED_BEFORE_UPLOAD
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ALLOWED_PHASE=RESUME_SINGLE_THREAD_EXECUTOR_GAS_PUSH_AFTER_CLASP_REAUTH

## SGDS C-S3 Execution Surface Blocker

STATUS=SUPERSEDED_BY_PRE_EXECUTION_EVIDENCE_BLOCKER
SEVERITY=HIGH
PHASE=BUNDLE_C_S3_EXACT_THREAD_ONE_INVOICE_SMOKE
EVIDENCE=The exact Gmail thread locator resolved and temporary smoke properties were set, but the single `clasp run runApprovedBundleCSingleThreadSmoke` invocation returned `Script function not found. Please make sure script is deployed as API executable.` The executor did not start.
IMPACT=The limited production smoke cannot prove ledger, Drive, and label behavior until the execution surface can invoke the pushed function exactly once.
PRODUCTION_MUTATION=NONE
SCRIPT_PROPERTIES_MUTATION=TEMP_KEYS_SET_AND_CLEANED_ONLY
NEXT_ACTION=Superseded after manual Apps Script editor visibility proved the function selector can select the pushed executor.

## SGDS C-S3 Pre-Execution Evidence Blocker

STATUS=SUPERSEDED_BY_OWNER_INTERNAL_PRECHECK_APPROVAL
SEVERITY=HIGH
PHASE=BUNDLE_C_S3_EXACT_THREAD_ONE_INVOICE_SMOKE
EVIDENCE=Manual Apps Script editor resume verified the expected Google account, script ID, exact Gmail sample, executor source file, and `runApprovedBundleCSingleThreadSmoke` function selector. The run was not started because independent parse-only XML evidence and pre-execution Sheet/Drive counts were not available from the approved browser surfaces without reading sensitive invoice payloads into evidence or relying on the executor itself as the first checker.
IMPACT=The one-invoice smoke remains unproven. No temporary Script Properties were set in this resume, and no production function execution occurred.
PRODUCTION_MUTATION=NONE
SCRIPT_PROPERTIES_MUTATION=NONE
MANUAL_FUNCTION_EXECUTION_ATTEMPT_COUNT=0
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ACTION=Superseded after owner marker `OWNER_APPROVE_C_S3_EXECUTOR_INTERNAL_PRECHECK_AND_RUN_ONCE` accepted executor internal prechecks for the one allowed run.

## SGDS C-S3 Post-Execution Verification Blocker

STATUS=RESOLVED_PASS_POSTCHECK
SEVERITY=HIGH
PHASE=BUNDLE_C_S3_EXACT_THREAD_ONE_INVOICE_SMOKE
EVIDENCE=The owner-approved Apps Script editor execution started once and safe result properties report `SUCCEEDED`, `COMMITTED`, expected line count `2`, and committed line count `2`. The resumed read-only postcheck verified exactly two `Nhap-Xuat` rows, present `HashIndex`, present shared `InvoiceKey`, exactly one `Hoa-Don` row, row-linked XML/PDF Drive artifacts, and the saved Gmail label.
IMPACT=The limited one-invoice happy path is production-verified for the approved exact thread, but this does not prove durable global rollback across Gmail, Drive, and Sheets if a mid-transaction boundary fails.
PRODUCTION_MUTATION=LIMITED_EXECUTOR_COMMITTED_ONE_THREAD_VERIFIED
SCRIPT_PROPERTIES_MUTATION=TEMP_INPUT_KEYS_SET_THEN_REMOVED_SAFE_RESULT_KEYS_RETAINED
MANUAL_FUNCTION_EXECUTION_ATTEMPT_COUNT=1
FUNCTION_EXECUTION_STARTED=YES
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ACTION=Proceed only to owner-approved single-thread executor source cleanup; do not rerun the executor.

## Bundle C Exact-Thread One-Invoice Production Smoke Result

BUNDLE_C_EXACT_THREAD_ONE_INVOICE_SMOKE=PASS_LIMITED_ONE_INVOICE
EXACT_GMAIL_THREAD_PROCESSED_ONCE=YES
EXECUTOR_RESULT=COMMITTED
EXPECTED_LINE_COUNT=2
COMMITTED_LINE_COUNT=2
TWO_NHAP_XUAT_ROWS_VERIFIED=YES
HASHINDEX_PRESENT=YES
INVOICEKEY_PRESENT=YES
ONE_HOA_DON_ROW_VERIFIED=YES
XML_AND_PDF_DRIVE_ARTIFACTS_VERIFIED=YES
SAVED_GMAIL_LABEL_VERIFIED=YES
EXECUTOR_RERUN=NO
BQGQ_RUN=NO
TONKHO_RUN=NO
SGDS_CRIT_003=OPEN_NOT_FIXED

## Bundle C-S4 Temporary Executor Cleanup

BUNDLE_C_SINGLE_THREAD_EXECUTOR_CLEANUP=PASS_REMOTE_EXECUTOR_REMOVED_AND_PROPERTIES_CLEANED
CLEANUP_REASON=TEMPORARY_SMOKE_TOOL_NO_LONGER_REQUIRED
TEMPORARY_EXECUTOR_SOURCE_STATUS=REMOVED_LOCAL_AND_REMOTE
PRODUCTION_SMOKE_EVIDENCE_STATUS=PRESERVED
EXECUTOR_RUN_COUNT=1
ADDITIONAL_INVOICE_EXECUTION=NO
PRODUCTION_DATA_MUTATION_DURING_CLEANUP=NONE
BATCH_PROCESSING_APPROVAL=NOT_GRANTED
DRIVE_BACKFILL_APPROVAL=NOT_GRANTED
SGDS_CRIT_003=OPEN_NOT_FIXED

The limited one-invoice production smoke remains valid evidence for the approved happy path. It does not close SGDS-CRIT-003 because it does not prove durable rollback or reconciliation behavior across Gmail, Drive, and Sheets for mid-transaction failures.

## Bundle C-S4R Remote Executor Removal And Property Cleanup

BUNDLE_C_S4R_STATUS=PASS_REMOTE_EXECUTOR_REMOVED_AND_PROPERTIES_CLEANED
RISK_ID=SGDS-SMOKE-GATE-003
TITLE=Temporary one-thread smoke executor removed from remote Apps Script after production smoke pass
SEVERITY=HIGH
STATUS=RESOLVED_TEMPORARY_EXECUTOR_REMOVED
EVIDENCE=Read-only remote clone before deletion found exactly one executor match; owner-approved Apps Script editor exact-file deletion removed the remote file; read-only clone after deletion found zero executor matches.
NORMAL_CLASP_PUSH_EXIT_CODE=0
NORMAL_CLASP_PUSH_REMOTE_EXECUTOR_PERSISTED=YES
REMOTE_DELETION_METHOD=APPS_SCRIPT_EDITOR_EXACT_FILE_DELETE
REMOTE_SOURCE_MUTATION=EXACT_TEMPORARY_EXECUTOR_FILE_DELETE_ONLY
SCRIPT_PROPERTY_MUTATION=SMOKE_RESULT_PROPERTY_CLEANUP_ONLY
PRODUCTION_DATA_MUTATION=NONE
ADDITIONAL_INVOICE_EXECUTION=NO
BUNDLE_C_PRODUCTION_VERIFICATION_STATUS=PASS_LIMITED_ONE_INVOICE
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ACTION=BUNDLE_C_CLOSEOUT_AND_NEXT_PRODUCTION_PRIORITY_REVIEW

## SGDS-CRIT-003 Durable Commit Design Evidence

OWNER_MARKER=OWNER_APPROVE_SGDS_CRIT_003_DURABLE_COMMIT_AND_RECONCILIATION_DESIGN
DESIGN_STATUS=READY_FOR_OWNER_REVIEW
DESIGN_DOC=docs/phases/SGDS_CRIT_003_DURABLE_COMMIT_AND_RECONCILIATION_DESIGN.md
RUNTIME_FILES_CHANGED=NO
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
FIREBASE_DEPLOY=NOT_RUN
SGDS_CRIT_003_STATUS=NOT_FIXED_DESIGN_READY
NEXT_ACTION=Owner review before `OWNER_APPROVE_SGDS_CRIT_003_D1_LOCAL_IMPLEMENTATION`.

## SGDS-CRIT-003 D1 Local Implementation Evidence

OWNER_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D1_LOCAL_IMPLEMENTATION
D1_STATUS=PASS_LOCAL_PRIMITIVES_IMPLEMENTED
IMPLEMENTED_RUNTIME_FILE=durableJobState.js
IMPLEMENTED_TEST=tests/unit/durable-job-state.test.mjs
RUNTIME_FILES_CHANGED=YES_LOCAL_ONLY
PRODUCTION_MUTATION=NONE
GAS_PUSH=NOT_RUN
REPORT_ONLY_RECONCILIATION_IMPLEMENTED=NO
FIRESTORE_ADAPTER_IMPLEMENTED=NO
REPAIR_TOOLS_IMPLEMENTED=NO
SGDS_CRIT_003_STATUS=NOT_FIXED_D1_LOCAL_PRIMITIVES_READY
NEXT_ACTION=Owner review before D2 Firestore adapter or D3 report-only reconciliation.

## SGDS-CRIT-003 D3 Report-Only Reconciliation

OWNER_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D3_REPORT_ONLY_RECONCILIATION
D3_RECONCILIATION_MODE=REPORT_ONLY
D3_STATUS=PASS_REPORT_ONLY_RECONCILIATION_LOCAL
REPORT_ONLY_ENTRYPOINT=reconcileDurableInvoiceJobReportOnly
FINDING_CODE_COUNT=22
FIXTURE_COUNT=17
AUTOMATIC_REPAIR=DISABLED
OWNER_GATED_REPAIR=NOT_IMPLEMENTED
FIRESTORE_ADAPTER=NOT_STARTED
SCANNER_WIRING=NOT_STARTED
PRODUCTION_MUTATION=NONE
BUNDLE_C_PRODUCTION_VERIFICATION_STATUS=PASS_LIMITED_ONE_INVOICE
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ACTION=Owner approval required for SGDS_CRIT_003_D2_FIRESTORE_ADAPTER_LOCAL or any production wiring/repair.

## SGDS-CRIT-003 D2 Firestore Adapter Local

OWNER_MARKER=OWNER_APPROVE_SGDS_CRIT_003_D2_FIRESTORE_ADAPTER_LOCAL
D2_FIRESTORE_ADAPTER_STATUS=LOCAL_ONLY
D2_STATUS=PASS_FIRESTORE_ADAPTER_LOCAL
ADAPTER_ENTRYPOINT=createDurableInvoiceJobStore
TRANSPORT_MODE=INJECTED_FAKE_OR_EMULATOR_COMPATIBLE
CLOCK_MODE=INJECTED
OPTIMISTIC_CONCURRENCY=YES
COMMIT_PLAN_IMMUTABLE=YES
AUDIT_APPEND_ONLY=YES
PRODUCTION_FIRESTORE_ACCESS=NONE
FIRESTORE_RULES_DEPLOY=NOT_RUN
FIRESTORE_INDEX_DEPLOY=NOT_RUN
SCANNER_WIRING=NOT_STARTED
AUTOMATIC_REPAIR=DISABLED
PRODUCTION_MUTATION=NONE
BUNDLE_C_PRODUCTION_VERIFICATION_STATUS=PASS_LIMITED_ONE_INVOICE
SGDS_CRIT_003_STATUS=NOT_FIXED
NEXT_ACTION=Owner approval required for SGDS_CRIT_003_D4_DURABLE_SCANNER_INTEGRATION_DESIGN before any scanner integration or production Firestore access.