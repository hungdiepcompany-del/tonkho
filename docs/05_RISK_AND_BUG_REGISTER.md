# 05 Risk And Bug Register

A02_STATUS=PASS_BUG_REGISTER_COMPLETE
RUNTIME_CODE_CHANGED=NO

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
PROPOSED_DIRECTION=Create job state and reconciliation before expanding automation.
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

## Bundle B Local Test Coverage

BUNDLE_B_COVERAGE_STATUS=PASS
TEST_COVERAGE=YES_FOR_MANDATED_B05_REPRODUCTION_GROUPS
RUNTIME_FIX_STATUS=NOT_STARTED

| Bug or policy area | Test path | Test result |
| --- | --- | --- |
| SGDS-CRIT-001 batch-level saved label state | `tests/bugs/batch-state.test.mjs` | BUG_REPRODUCED |
| SGDS-CRIT-002 implicit blank-hash row delete | `tests/bugs/implicit-row-delete.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-001 XML first-only incoming attachment processing | `tests/bugs/xml-first-only.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-002 Drive scanner dedup bypass | `tests/bugs/drive-dedup-bypass.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-003 hash identity omits economic fields | `tests/bugs/hash-identity.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-005 BQGQ row-order item matching | `tests/bugs/bqgq-ordering.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-006 over-sell BQGQ display policy gap | `tests/bugs/oversell-display.test.mjs` | BUG_REPRODUCED_POLICY_PENDING |
| SGDS-HIGH-007 TonKho over-sell reset policy gap | `tests/bugs/oversell-display.test.mjs` | BUG_REPRODUCED_POLICY_PENDING |
| SGDS-HIGH-008 and SGDS-LOW-001 FileLog competition and clear scope | `tests/bugs/filelog-competition.test.mjs` | BUG_REPRODUCED |
| SGDS-HIGH-009 running/progress cache and early exit state | `tests/bugs/progress-state.test.mjs` | BUG_REPRODUCED |
| SGDS-MEDIUM-001 PDF VAT first-50-character detection | `tests/unit/pdf-link.test.mjs` | CURRENT_BEHAVIOR_CAPTURED |
| SGDS-MEDIUM-002 XML namespace fragility | `tests/unit/xml-parser.test.mjs` | CURRENT_BEHAVIOR_CAPTURED |
| SGDS-MEDIUM-003 VHD undefined sheet config | `tests/bugs/vhd-config.test.mjs` | BUG_REPRODUCED |
| SGDS-MEDIUM-004 workbook named-range contract mismatch | `tests/schema/sheet-contract.test.mjs` | SCHEMA_CONTRACT_CAPTURED |
| SGDS-MEDIUM-007 early returns can leave progress incomplete | `tests/bugs/progress-state.test.mjs` | BUG_REPRODUCED |
| Customer abbreviation regex escape bug | `tests/bugs/regex-escape.test.mjs` | BUG_REPRODUCED |
| Dead code after writer return | `tests/bugs/dead-code.test.mjs` | BUG_REPRODUCED |
| Body duplicate branch skips attachment collection | `tests/bugs/body-dedup-attachment.test.mjs` | BUG_REPRODUCED |

CONFIRMED_BUGS_WITH_TESTS=13
CONFIRMED_BUGS_NOT_LOCALLY_TESTABLE=0_FOR_MANDATED_B05_GROUPS
POLICY_PENDING_TEST_COUNT=1
SKIPPED_TEST_COUNT=1_TARGET_INVARIANT_DRAFT
