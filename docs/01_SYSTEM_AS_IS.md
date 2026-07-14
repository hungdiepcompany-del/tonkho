# 01 System As-Is

STATUS=A01_CONFIRMED_READ_ONLY

This normalized AS-IS document is based on local source, the owner-supplied `docs/01_SYSTEM_AS_IS_SOURCE.md`, and the read-only workbook snapshot `ton kho - DATABASE.xlsx`. Runtime `.js`, `.html`, `appsscript.json`, `.clasp.json`, BAT/log files, and the workbook were not modified.

## Evidence Labels

- CONFIRMED_FROM_SOURCE: verified from local pulled Apps Script source.
- CONFIRMED_FROM_WORKBOOK: verified from read-only workbook snapshot.
- INFERENCE: reasoned from source plus workbook, still needs runtime or owner confirmation before mutation.
- RUNTIME_UNKNOWN: cannot be verified safely from local files.
- OWNER_CONFIRM_REQUIRED: business policy must be decided by owner.

## Runtime And Manifest

- CONFIRMED_FROM_SOURCE: `appsscript.json` uses V8, timezone `Etc/GMT-7`, Stackdriver exception logging, and web app `executeAs=USER_DEPLOYING`, `access=MYSELF`.
- CONFIRMED_FROM_SOURCE: advanced services are Gmail v1, Drive v2, Slides v1, and Sheets v4.
- CONFIRMED_FROM_SOURCE: OAuth scopes include Gmail, Drive, Documents, Presentations, script UI/external request/scriptapp, Sheets, and userinfo.email.

## Gmail Pipeline

- CONFIRMED_FROM_SOURCE: `triggerMarkAllInvoiceEmails(e)` classifies invoice emails and applies IN/OUT labels.
- CONFIRMED_FROM_SOURCE: `main()` executes security guards, then runs OUT and IN scanners, normalizes rows, hashes rows, filters duplicates, writes accepted rows, and applies a batch-level saved/pending label.
- INFERENCE: Gmail labels are a projection of processing state, not a reliable canonical transaction ledger.
- RUNTIME_UNKNOWN: actual Gmail label counts and currently labeled thread state were not queried.

## Drive Pipeline

- CONFIRMED_FROM_SOURCE: XML/PDF artifacts are stored under configured IN/OUT Drive folder IDs and year subfolders.
- CONFIRMED_FROM_SOURCE: `triggerScanInvoiceDriveFolder()` scans configured Drive folders and writes both `Hoa-Don` references and `Nhap-Xuat` rows for parsed XML.
- RUNTIME_UNKNOWN: actual Drive tree contents and file counts were not queried.

## XML, PDF, And Link Pipeline

- CONFIRMED_FROM_SOURCE: XML parsing uses `XmlService` and direct child lookups for `DLHDon`, `TTChung`, `NDHDon`, `DSHHDVu`, `NBan`, and `NMua`.
- CONFIRMED_FROM_SOURCE: PDF parsing converts PDF blobs to temporary Google Docs using Drive advanced service, reads body text, then trashes the temporary doc on the happy path.
- CONFIRMED_FROM_SOURCE: PDF VAT detection checks only the first 50 characters of normalized OCR text.
- CONFIRMED_FROM_SOURCE: link-only IN handling saves/records link PDF evidence but does not write ledger rows from link-only data.

## Google Sheets Workbook

- CONFIRMED_FROM_WORKBOOK: workbook sheets are `TonKho, Nhap-Xuat, Hoa-Don, MaHangHoa, PhanLoai, VietTat, FileLog, VietHoaDon`.
- CONFIRMED_FROM_WORKBOOK: `Nhap-Xuat` used range is `A1:P1333`; data rows counted=1332; blank hash count=0; duplicate hash count=10; duplicate invoiceKey count=2; rows missing any J:M=23.
- CONFIRMED_FROM_WORKBOOK: named ranges include `VHD_TRUOC_THUE, VHD_UU_TIEN_DG, VHD_SL1_TO, VHD_DG1_BE, VHD_UU_TIEN_SL, VHD_DG1_TO, VHD_DG2_TO, VHD_SL1_BE, VHD_GIA_TRI_MUC_TIEU, VHD_DG2_BE, VHD_SL2_TO, VHD_SL2_BE`.
- CONFIRMED_FROM_WORKBOOK: no sheet-name mismatch between source-configured expected sheets and workbook sheet names.

## Sheet Roles

- CONFIRMED_FROM_SOURCE_AND_WORKBOOK: `Nhap-Xuat` is the current transaction ledger.
- CONFIRMED_FROM_SOURCE_AND_WORKBOOK: `Hoa-Don` stores `invoiceKey`, XML/PDF IDs, and link/file reference columns.
- CONFIRMED_FROM_SOURCE_AND_WORKBOOK: `TonKho` is inventory projection/rebuild output.
- CONFIRMED_FROM_SOURCE_AND_WORKBOOK: `MaHangHoa`, `PhanLoai`, and `VietTat` are catalogs/dictionaries.
- CONFIRMED_FROM_SOURCE_AND_WORKBOOK: `FileLog` is shared by BQGQ/TonKho/sidebar logging.
- CONFIRMED_FROM_SOURCE_AND_WORKBOOK: `VietHoaDon` holds input cells/named ranges for the invoice-writing UI.

## Security And Runtime State

- CONFIRMED_FROM_SOURCE: `assertScriptOwner_()` checks `SCRIPT_OWNER_EMAIL`; trigger guards use `TRIGGER_SECRET`, `LAST_TRIGGER_RUN`, and `LAST_TRIGGER_MINUTE`.
- CONFIRMED_FROM_SOURCE: `initSecurityOwner()` and `enableAuthorizedTrigger_()` mutate Script Properties and therefore were not run.
- RUNTIME_UNKNOWN: actual Script Properties values, trigger owner, trigger schedule, and recent executions remain unknown.

## Cache And Lock

- CONFIRMED_FROM_SOURCE: `NX_RUNNING` and `TK_RUNNING` use CacheService TTL of 300 seconds.
- CONFIRMED_FROM_SOURCE: main trigger anti-replay uses Script Lock; TonKho uses a short lock; BQGQ uses cache only.
- INFERENCE: cache TTL can expire before long jobs finish, allowing stale progress/race risk.

## Web App VietHoaDon

- CONFIRMED_FROM_SOURCE: `doGet()` returns `VietHoaDon_UI` with `XFrameOptionsMode.ALLOWALL`.
- CONFIRMED_FROM_SOURCE: manifest web app access remains `MYSELF`.
- OWNER_CONFIRM_REQUIRED: future Firebase/GAS auth boundary must be approved before frontend mutation APIs are exposed.
