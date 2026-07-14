# 05 Risk And Bug Register

STATUS=PRELIMINARY_SOURCE_OBSERVATIONS_ONLY
A02_STATUS=NOT_STARTED_GATE_BLOCKED

A02 full bug register is not complete because A01 did not pass. The entries below are source-backed observations gathered while preparing A01; they must be expanded and counted in A02 after workbook evidence is available.

## SGDS-CRIT-PRELIM-001

BUG_ID=SGDS-CRIT-PRELIM-001
TITLE=Batch-level writeOk can mark all threads as saved after partial/no accepted-row write
SEVERITY=CRITICAL
STATUS=CONFIRMED_FROM_SOURCE_PRELIMINARY
FILES=main.js
FUNCTIONS=_mainInternal_, setExclusiveLabel_
EVIDENCE=main.js lines 95-113: writeOk is set true after the accepted-row block, then every thread in 	hreadSet receives target label from that one boolean.
REPRODUCTION_CONDITION=Batch contains multiple threads where some rows are duplicate/skipped or one invoice fails but acceptedRows write does not throw.
DATA_IMPACT=Gmail label projection may show saved state for invoices not committed as rows.
RUNTIME_IMPACT=False success state can suppress future scanning.
PROPOSED_INVARIANT=Saved label only after per-invoice row commit is confirmed.
PROPOSED_DIRECTION=Replace batch-level label state with per-job/per-invoice state.
TEST_REQUIRED=Fixture for mixed accepted/duplicate/failing invoice batch.
OWNER_DECISION_REQUIRED=NO

## SGDS-CRIT-PRELIM-002

BUG_ID=SGDS-CRIT-PRELIM-002
TITLE=Writer deletes existing rows with blank hash before appending new invoice rows
SEVERITY=CRITICAL
STATUS=CONFIRMED_FROM_SOURCE_PRELIMINARY
FILES=sheetWriter.js
FUNCTIONS=writeInvoicesToSheet_, deleteEmptyRows_
EVIDENCE=sheetWriter.js lines 15 and 151-166 call deleteEmptyRows_() and delete each row where column N/hash is blank.
REPRODUCTION_CONDITION=Any existing manually-entered, formula-drifted, or partially repaired row has blank hash.
DATA_IMPACT=Ledger rows can be removed as a side effect of invoice import.
RUNTIME_IMPACT=Historical Nhap-Xuat data may disappear during normal write path.
PROPOSED_INVARIANT=Never delete ledger rows solely because hash is blank.
PROPOSED_DIRECTION=Quarantine/report blank hash rows and require explicit repair flow.
TEST_REQUIRED=Fixture with blank-hash historical row before write.
OWNER_DECISION_REQUIRED=NO

## SGDS-HIGH-PRELIM-003

BUG_ID=SGDS-HIGH-PRELIM-003
TITLE=IN scanner processes only first valid XML invoice attachment
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE_PRELIMINARY
FILES=gmailScanner.js,gmailProcessInvoiceXML.js
FUNCTIONS=scanInvoiceInEmails_, processInvoiceAllXMLAttachments_
EVIDENCE=gmailScanner.js line 330 passes { breakOnFirst: true }; gmailProcessInvoiceXML.js line 49 breaks after first ok invoice.
REPRODUCTION_CONDITION=One incoming Gmail thread/message has multiple independent valid XML invoices.
DATA_IMPACT=Additional invoices can be skipped.
RUNTIME_IMPACT=Missing ledger rows and incomplete Drive/registry links.
PROPOSED_INVARIANT=One source message/thread may contain multiple invoices unless owner forbids it.
PROPOSED_DIRECTION=Model invoice as per-attachment/per-invoice job.
TEST_REQUIRED=Fixture with two valid XML attachments.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-PRELIM-004

BUG_ID=SGDS-HIGH-PRELIM-004
TITLE=Drive scanner writes directly through sheet writer without shared Gmail job state
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE_PRELIMINARY
FILES=_triggerDriveScanner.js,sheetWriter.js
FUNCTIONS=triggerScanInvoiceDriveFolder, parseInvoiceXMLFile_, writeInvoicesToSheet_
EVIDENCE=_triggerDriveScanner.js lines 66-78 upsert file registry then line 98 writes parsed XML rows; it bypasses Gmail scanner labels/job state.
REPRODUCTION_CONDITION=Backfill or manual Drive scan sees XML already represented or partially represented elsewhere.
DATA_IMPACT=Duplicate or mismatched ledger/registry state if hash/key behavior diverges.
RUNTIME_IMPACT=No durable reconciliation state ties Gmail, Drive, and Sheets.
PROPOSED_INVARIANT=Gmail and Drive backfill use one commit core and one job identity model.
PROPOSED_DIRECTION=Introduce local commit core in Bundle C after tests.
TEST_REQUIRED=Drive backfill fixture matching Gmail-ingested invoice.
OWNER_DECISION_REQUIRED=NO

## SGDS-HIGH-PRELIM-005

BUG_ID=SGDS-HIGH-PRELIM-005
TITLE=Hash omits unit price and canonical line identity
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE_PRELIMINARY
FILES=hashUtils.js,main.js,_triggerDriveScanner.js
FUNCTIONS=buildInvoiceItemHash_, _mainInternal_, buildInvoiceRowsFromParsed_
EVIDENCE=hashUtils.js lines 82-97 hash fields include invoiceDate, invoiceNo, customerName, itemCode, itemName, invoiceType, qty; price is not included.
REPRODUCTION_CONDITION=Two invoice lines share same date/no/customer/item/type/qty but different unit price.
DATA_IMPACT=Distinct economic lines can collapse as duplicates.
RUNTIME_IMPACT=Ledger under-count and wrong inventory valuation.
PROPOSED_INVARIANT=lineIdentity must include fields that distinguish economic line value.
PROPOSED_DIRECTION=Owner-approved lineIdentity contract before runtime fix.
TEST_REQUIRED=Two-line same qty different unit price fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-PRELIM-006

BUG_ID=SGDS-HIGH-PRELIM-006
TITLE=Item-code mapping depends on ordered substring includes
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE_PRELIMINARY
FILES=xmlParser.js
FUNCTIONS=getItemCodeFromSheet_, buildItemCodeList_
EVIDENCE=xmlParser.js lines 191-217 builds list in sheet order and returns first normalized-name substring match.`r`normalizedXmlName.includes(item.normalizedName).
REPRODUCTION_CONDITION=Catalog has overlapping normalized item names.
DATA_IMPACT=Invoice line can map to wrong item code.
RUNTIME_IMPACT=Inventory and BQGQ calculations drift.
PROPOSED_INVARIANT=Mapping must be deterministic and auditable, with ambiguity reporting.
PROPOSED_DIRECTION=Add local mapping tests and ambiguity policy.
TEST_REQUIRED=Overlapping item names fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-HIGH-PRELIM-007

BUG_ID=SGDS-HIGH-PRELIM-007
TITLE=BQGQ/TonKho over-sell logic caps or resets inventory without owner policy
SEVERITY=HIGH
STATUS=CONFIRMED_FROM_SOURCE_PRELIMINARY
FILES=sheetNhapXuat.js,sheetTonKho.js
FUNCTIONS=capNhatNhapXuatBQGQ, capNhatTonKho
EVIDENCE=sheetNhapXuat.js lines 69-72 caps outgoing quantity to stock; sheetTonKho.js lines 116-122 logs over-sell then resets stock/value/average to zero.
REPRODUCTION_CONDITION=XUAT row quantity exceeds accumulated stock for item.
DATA_IMPACT=Displayed quantity and calculated economic quantity can diverge.
RUNTIME_IMPACT=Inventory hides negative stock or policy violation.
PROPOSED_INVARIANT=Over-sell behavior must be owner-approved: block, allow negative, cap with error, or other.
PROPOSED_DIRECTION=Stop implicit policy and report violations until approved.
TEST_REQUIRED=Over-sell ledger fixture.
OWNER_DECISION_REQUIRED=YES

## SGDS-MEDIUM-PRELIM-008

BUG_ID=SGDS-MEDIUM-PRELIM-008
TITLE=PDF VAT detection checks only first 50 characters
SEVERITY=MEDIUM
STATUS=CONFIRMED_FROM_SOURCE_PRELIMINARY
FILES=pdfParser.js
FUNCTIONS=isVatInvoicePDF_
EVIDENCE=pdfParser.js lines 1-10 trims text then checks only substring(0, 50).
REPRODUCTION_CONDITION=OCR text has banner/header before VAT invoice phrase.
DATA_IMPACT=Valid PDF can be missed.
RUNTIME_IMPACT=Pending labels and incomplete Drive registry.
PROPOSED_INVARIANT=PDF detection must inspect normalized bounded text with robust markers.
PROPOSED_DIRECTION=Use wider normalized window and structured tax-code/date evidence.
TEST_REQUIRED=PDF OCR text fixture with delayed VAT marker.
OWNER_DECISION_REQUIRED=NO
