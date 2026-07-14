# 03 Data Contract

DATA_CONTRACT_STATUS=OWNER_APPROVED_V1
INVARIANTS_STATUS=OWNER_APPROVED_V1
STATUS=OWNER_APPROVED
OWNER_MARKER=APPROVE_RECOMMENDED_20

## Sheet Schemas

- TonKho: range=A1:H10; rows=10; cols=8; headers=["Ma hang", "Ten hang", "DVT", "So luong", "Gia tri", "Don gia BQ", "", ""]; formula_count=2
- Nhap-Xuat: range=A1:P1333; rows=1333; cols=16; headers=["STT", "Ngay", "Hoa don so", "Ten khach hang", "Ma hang", "Ten hang", "Phan loai", "So luong", "Don gia", "Thanh tien", "Don gia BQ", "So luong ton", "Gia tri ton", "HashIndex", "InvoiceKey", "HD"]; formula_count=0
- Hoa-Don: range=A1:F24; rows=24; cols=6; headers=["invoiceKey", "XML_id", "XML_status", "PDF_id", "PDF_status", "View"]; formula_count=0
- MaHangHoa: range=A1:C10; rows=10; cols=3; headers=["Ma hang", "Ten hang", "DVT"]; formula_count=0
- PhanLoai: range=A1:A3; rows=3; cols=1; headers=["P.loai"]; formula_count=0
- VietTat: range=A1:B28; rows=28; cols=2; headers=["Ten day du", "Ten viet tat"]; formula_count=0
- FileLog: range=A1:D5; rows=5; cols=4; headers=["Dong NX", "Ngay", "Ma hang", "Dien giai"]; formula_count=0
- VietHoaDon: range=A1:S9; rows=9; cols=19; headers=["Truong", "Gia tri / Tu", "Den", "Ghi chu", "", "", "", "", "", "", "", "", "", "", "SL1", "DG1", "SL2", "DG2", "Gia tri"]; formula_count=0

## Invoice Key V2

Canonical form:

```text
invoiceKeyV2 =
sellerTaxCode
+ "_"
+ invoiceSymbol
+ "_"
+ normalizedInvoiceNo
+ "_"
+ issueDate(yyyyMMdd)
```

If XML contains template code or form code, the field is supported as an extended field, but it does not change the canonical key without a separate migration plan.

Do not include `buyerTaxCode`, `counterpartyTaxCode`, or `NHAP/XUAT` in the primary identity.

## Line Identity V2

Canonical form:

```text
lineIdentityV2 = SHA256(
  invoiceKeyV2
  + sourceLineNo
  + normalizedRawItemName
  + normalizedUnit
  + quantity
  + unitPrice
  + amount
)
```

Mapped `itemCode` is not part of line identity. Two lines with the same item and quantity but different unit price are separate lines.

## Canonical Invoice Model

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
    invoiceKeyV2: "",
    type: "NHAP" | "XUAT",
    issueDate: "",
    normalizedInvoiceNo: "",
    invoiceSymbol: "",
    templateCode: "",
    invoiceNature: "ORIGINAL" | "ADJUSTMENT" | "REPLACEMENT" | "CANCELLED",
    sellerTaxCode: "",
    sellerName: "",
    buyerTaxCode: "",
    buyerName: ""
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

## Invoice Line Model

```javascript
{
  sourceLineNo: 1,
  rawItemName: "",
  normalizedRawItemName: "",
  itemCode: "",
  unit: "",
  quantity: 0,
  unitPrice: 0,
  amount: 0,
  lineIdentityV2: ""
}
```

## Job States

| State | Entry Condition | Exit Condition | Retry Policy | Gmail Label Projection |
| --- | --- | --- | --- | --- |
| DETECTED | Source candidate found. | Attachments/body collected. | Safe to retry. | IN/OUT candidate label. |
| COLLECTED | Files/links enumerated. | Parser starts. | Safe to retry. | Pending. |
| PARSED | XML/PDF/link parsed enough for model. | Validated or failed review. | Retry parser only. | Pending. |
| VALIDATED | Required fields and policy checks pass. | Evidence saved. | Retry validation after policy/catalog fix. | Pending. |
| FILES_SAVED | XML/PDF/link evidence saved or linked. | Commit starts. | Idempotent by content hash/file id. | XML/PDF/LINK projection. |
| COMMITTING | Ledger commit is in progress. | Rows committed and verified or reconciliation required. | Lock-backed retry only. | Pending. |
| ROWS_COMMITTED | Ledger rows written and verified. | Inventory pending or completed. | No duplicate write; reconcile only. | Saved-sheet projection. |
| INVENTORY_PENDING | Ledger committed but BQGQ/TonKho stale. | Inventory rebuilt. | Retry inventory job. | Saved-sheet plus pending inventory UI state. |
| COMPLETED | Ledger, files, projection, and audit complete. | Terminal. | No retry except reconciliation. | Saved labels only. |
| FAILED_RETRYABLE | Transient parser/API/quota failure. | Retry succeeds or review required. | Bounded retry with audit. | Pending. |
| FAILED_REVIEW_REQUIRED | Policy/catalog/data ambiguity. | Owner/operator decision. | No automatic retry. | Pending/review. |
| RECONCILIATION_REQUIRED | Gmail, Drive, registry, ledger, or projection states diverge. | Reconciliation resolves or owner review updates state. | Reconcile by canonical job/audit state. | Review/pending. |
| IGNORED_NOT_INVOICE | Candidate is not invoice. | Terminal. | None. | Remove pending/invoice projection only by approved flow. |

Main flow:

```text
VALIDATED
-> FILES_SAVED
-> COMMITTING
-> ROWS_COMMITTED
-> INVENTORY_PENDING
-> COMPLETED
```

Use `RECONCILIATION_REQUIRED` when Gmail, Drive, registry, ledger, or projection state is not synchronized.

## Approved Invariants

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
16. Original XML/PDF and recorded content hash must not be silently changed or replaced.
17. Direct historical ledger edits are not allowed; every correction requires actor, reason, timestamp, and audit record.
18. Firestore projection must be reproducible from canonical sources and must not create reverse mutations into the ledger.

## Approved Runtime Policies

- Link-only input is `REVIEW_REQUIRED`.
- PDF-only input may be parsed and routed to review, but cannot automatically write ledger rows.
- OCR PDF is not trusted for automatic ledger writes.
- Adjustment invoices are stored and linked to the original invoice, then routed to review.
- Replacement invoices are stored separately; originals are marked superseded, not deleted.
- Cancelled invoices keep audit and are marked cancelled; they are not deleted or automatically reversed.
- Over-sell is blocked and routed to review.
- BQGQ ordering is `issueDate`, immutable `transactionSequence`, then `sourceLineNo`.
- Google Sheets remains canonical until parity report, rollback plan, and owner cutover marker exist.
- Firestore projection is read-only and not source of truth.


## Bundle C Implementation Status

BUNDLE_C_LOCAL_RUNTIME_STATUS=PASS_CRITICAL_RUNTIME_FIXES_LOCAL
HASH_V1_CHANGED=NO
INVOICE_KEY_PERSISTED_FORMAT_CHANGED=NO
DURABLE_JOB_STATE_IMPLEMENTED=NO
PRODUCTION_FIX_STATUS=NOT_DEPLOYED

The owner-approved v1 contract remains unchanged. Bundle C only implements local safety behavior that is compatible with the current persisted HashIndex and invoiceKey format.

## Historical Draft Marker

LEGACY_BUNDLE_B_CHECKER_COMPATIBILITY=YES
HISTORICAL_STATUS_MARKER=DRAFT_NOT_OWNER_APPROVED
CURRENT_DATA_CONTRACT_STATUS=OWNER_APPROVED_V1
CURRENT_INVARIANTS_STATUS=OWNER_APPROVED_V1

The historical marker above is retained only so the Bundle B checker can prove the old policy-pending marker existed. It is not the current status.
