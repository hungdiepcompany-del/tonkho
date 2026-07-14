# 03 Data Contract

DATA_CONTRACT_STATUS=DRAFT_NOT_OWNER_APPROVED
INVARIANTS_STATUS=DRAFT_NOT_OWNER_APPROVED
STATUS=DRAFT_READY_FOR_OWNER_REVIEW

## Sheet Schemas

- TonKho: range=A1:H10; rows=10; cols=8; headers=["Mã hàng", "Tên hàng", "ĐVT", "Số lượng", "Giá trị", "Đơn giá BQ", "", ""]; formula_count=2
- Nhap-Xuat: range=A1:P1333; rows=1333; cols=16; headers=["STT", "Ngày", "Hóa đơn số", "Tên khách hàng", "Mã hàng", "Tên hàng", "Phân loại", "Số lượng", "Đơn giá", "Thành tiền", "Đơn giá BQ", "Số lượng tồn", "Giá trị tồn", "HashIndex", "InvoiceKey", "HĐ"]; formula_count=0
- Hoa-Don: range=A1:F24; rows=24; cols=6; headers=["invoiceKey", "XML_id", "XML_status", "PDF_id", "PDF_status", "View"]; formula_count=0
- MaHangHoa: range=A1:C10; rows=10; cols=3; headers=["Mã hàng", "Tên hàng", "ĐVT"]; formula_count=0
- PhanLoai: range=A1:A3; rows=3; cols=1; headers=["P.loại"]; formula_count=0
- VietTat: range=A1:B28; rows=28; cols=2; headers=["Tên đầy đủ", "Tên viết tắt"]; formula_count=0
- FileLog: range=A1:D5; rows=5; cols=4; headers=["Dòng NX", "Ngày", "Mã hàng", "Diễn giải"]; formula_count=0
- VietHoaDon: range=A1:S9; rows=9; cols=19; headers=["Trường", "Giá trị / Từ", "Đến", "Ghi chú", "", "", "", "", "", "", "", "", "", "", "SL1", "ĐG1", "SL2", "ĐG2", "Giá trị"]; formula_count=0

## Current invoiceKey

Current source uses a key equivalent to:

```text
invoiceKey = yyyyMMdd + "_" + counterpartyTaxCode + "_" + normalizedInvoiceNo
```

Current risk: symbol is not included, and multiple construction paths exist.

Proposed draft:

```text
invoiceKey = issueDate(yyyyMMdd) + "_" + invoiceSymbol + "_" + invoiceNo + "_" + sellerTaxCode + "_" + buyerTaxCode + "_" + type
```

Owner must decide whether invoice symbol is mandatory.

## Canonical Invoice Model Draft

```javascript
{
  source: {
    channel: "GMAIL" | "DRIVE" | "MANUAL",
    threadId: "",
    messageId: "",
    sourceFileId: "",
    receivedAt: ""
  },
  invoice: {
    invoiceKey: "",
    type: "NHAP" | "XUAT",
    issueDate: "",
    invoiceNo: "",
    symbol: "",
    invoiceNature: "ORIGINAL" | "ADJUSTMENT" | "REPLACEMENT" | "CANCELLED",
    sellerTaxCode: "",
    sellerName: "",
    buyerTaxCode: "",
    buyerName: "",
    counterpartyTaxCode: "",
    counterpartyName: ""
  },
  files: {
    xmlFileId: "",
    xmlContentHash: "",
    pdfFileId: "",
    pdfContentHash: "",
    linkSummaryFileId: ""
  },
  lines: []
}
```

## Invoice Line Model Draft

```javascript
{
  sourceLineNo: 1,
  itemCode: "",
  itemName: "",
  unit: "",
  quantity: 0,
  unitPrice: 0,
  amount: 0,
  lineIdentity: ""
}
```

Proposed `lineIdentity` draft:

```text
invoiceKey + sourceLineNo + normalizedItemCode + normalizedItemName + unit + quantity + unitPrice + amount
```

Owner must decide whether same item/qty with different unit price is always a separate line.

## File Reference Model Draft

```javascript
{
  invoiceKey: "",
  fileType: "XML" | "PDF" | "LINK_SUMMARY",
  driveFileId: "",
  contentHash: "",
  sourceChannel: "GMAIL" | "DRIVE" | "MANUAL",
  createdAt: "",
  parseStatus: ""
}
```

## Job State Draft

| State | Entry Condition | Exit Condition | Retry Policy | Gmail Label Projection |
| --- | --- | --- | --- | --- |
| DETECTED | Source candidate found. | Attachments/body collected. | Safe to retry. | IN/OUT candidate label. |
| COLLECTED | Files/links enumerated. | Parser starts. | Safe to retry. | Pending. |
| PARSED | XML/PDF/link parsed enough for model. | Validated or failed review. | Retry parser only. | Pending. |
| VALIDATED | Required fields and policy checks pass. | Evidence saved. | Retry validation after policy/catalog fix. | Pending. |
| FILES_SAVED | XML/PDF/link evidence saved or linked. | Rows committed. | Idempotent by content hash/file id. | XML/PDF/LINK projection. |
| ROWS_COMMITTED | Ledger rows written and verified. | Inventory pending or completed. | No duplicate write; reconcile only. | Saved-sheet projection. |
| INVENTORY_PENDING | Ledger committed but BQGQ/TonKho stale. | Inventory rebuilt. | Retry inventory job. | Saved-sheet plus pending inventory UI state. |
| COMPLETED | Ledger, files, projection, and audit complete. | Terminal. | No retry except reconciliation. | Saved labels only. |
| FAILED_RETRYABLE | Transient parser/API/quota failure. | Retry succeeds or review required. | Bounded retry with audit. | Pending. |
| FAILED_REVIEW_REQUIRED | Policy/catalog/data ambiguity. | Owner/operator decision. | No automatic retry. | Pending/review. |
| IGNORED_NOT_INVOICE | Candidate is not invoice. | Terminal. | None. | Remove pending/invoice projection only by approved flow. |

## Invariant Draft

1. Do not apply saved-sheet label before row commit is verified.
2. State is per invoice/job, not per whole batch.
3. Rerun from same source does not create duplicate rows.
4. Gmail and Drive backfill use the same commit core.
5. Do not delete ledger rows solely because hash is blank.
6. One failed invoice must not make another invoice receive false status.
7. Gmail label is projection only.
8. Drive file name is not unique identity.
9. `TonKho` must rebuild from canonical ledger.
10. BQGQ must use owner-approved ordering policy.
11. Every data repair must have audit.
12. Firestore sync failure must not roll back committed Sheet ledger.
13. Firestore is not the primary ledger in this phase.
14. Firebase frontend must not call dangerous internal functions directly.
15. Mutation UI remains closed until auth and audit are approved.
