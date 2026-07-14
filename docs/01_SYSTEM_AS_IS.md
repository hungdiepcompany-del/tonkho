# 01 System As-Is

STATUS=SOURCE_BACKED_PARTIAL

This document records the current local source state. The external AS-IS document at $AsIsPath was read as reference, but it was not present in the target repository. Source files remain the authority for code behavior.

## Current Runtime

- Apps Script runtime: V8.
- Timezone: Etc/GMT-7.
- Web app manifest: execute as USER_DEPLOYING, access MYSELF.
- Advanced services: Gmail v1, Drive v2, Slides v1, Sheets v4.
- OAuth scopes include full Gmail, Drive, Documents, Presentations, external request, script trigger management, Sheets, and userinfo.email.

## Gmail Pipeline

- 	riggerMarkAllInvoiceEmails(e) scans Gmail and applies invoice direction labels.
- main() calls scanInvoiceOutEmails_() and scanInvoiceInEmails_().
- Source code labels threads through both scanner-level label application and batch-level setExclusiveLabel_() after write handling.
- Gmail labels are operational projection only and are not a canonical transaction log.

## Drive Pipeline

- XML/PDF files are stored under configured IN/OUT Drive folders.
- Drive scanner 	riggerScanInvoiceDriveFolder() scans configured folders and year subfolders.
- Drive scanner writes Hoa-Don registry and calls writeInvoicesToSheet_() for parsed XML rows.

## XML/PDF/Link Pipeline

- XML parser uses XmlService and direct child names such as DLHDon, TTChung, NDHDon, and DSHHDVu.
- PDF OCR creates a temporary Google Doc through Drive API and trashes it after parsing when the happy path completes.
- Link-only flow downloads or records failed links but does not write ledger rows directly.

## Sheets

Configured sheets from source:

- TonKho
- Nhap-Xuat
- Hoa-Don
- MaHangHoa
- PhanLoai
- VietTat
- FileLog

The workbook snapshot required for current row counts, headers, formulas, and named ranges is missing locally.

## Sidebar

sheetSidebar.html calls Apps Script functions for capNhatNhapXuatBQGQ, capNhatTonKho, progress polling, and clearLog.

## Web App Viet Hoa Don

VietHoaDon_GAS.js serves VietHoaDon_UI and sets XFrameOptions to ALLOWALL. Manifest access is still MYSELF.

## Trigger, Properties, Cache, Lock

- Security guard uses Script Properties: SCRIPT_OWNER_EMAIL, TRIGGER_SECRET, AUTHORIZED_TRIGGER_AT, LAST_TRIGGER_RUN, LAST_TRIGGER_MINUTE.
- BQGQ and TonKho use CacheService keys NX_RUNNING and TK_RUNNING.
- main() uses security assertions; trigger classification uses guardTrigger_().
- Runtime trigger schedule/owner cannot be verified from local source.

## Runtime Unknowns

See docs/99_NEXT_AI_HANDOFF.md and rtifacts/audit/a01-runtime-unknowns.md.
