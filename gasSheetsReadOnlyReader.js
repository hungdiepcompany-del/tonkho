function createGasSheetsReadOnlyReader(options) {
  const spreadsheetId = options && options.spreadsheetId || '';

  function spreadsheet_() {
    return spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActive();
  }

  function readHoaDonRows(request) {
    const sheet = spreadsheet_().getSheetByName(CONFIG.SHEET_FILES);
    if (!sheet) return [];
    const maxRows = Number(request && request.maxRows || 20);
    const lastRow = Math.min(sheet.getLastRow(), maxRows + 1);
    if (lastRow < 2) return [];
    const values = sheet.getRange(1, 1, lastRow, Math.min(sheet.getLastColumn(), 6)).getValues();
    const header = values[0].map(String);
    const keyCol = header.indexOf('invoiceKey');
    const xmlCol = header.indexOf('XML_id');
    const xmlStatusCol = header.indexOf('XML_status');
    const pdfCol = header.indexOf('PDF_id');
    const pdfStatusCol = header.indexOf('PDF_status');
    const viewCol = header.indexOf('View');
    const legacyInvoiceKey = String(request && request.legacyInvoiceKey || '');
    const invoiceKeyV2 = String(request && request.invoiceKeyV2 || '');
    const xmlFileReference = String(request && request.xmlFileReference || '');
    const pdfFileReference = String(request && request.pdfFileReference || '');
    return values.slice(1).filter(row => {
      const key = keyCol >= 0 ? String(row[keyCol] || '') : '';
      const xml = xmlCol >= 0 ? String(row[xmlCol] || '') : '';
      const pdf = pdfCol >= 0 ? String(row[pdfCol] || '') : '';
      return Boolean(key && (key === legacyInvoiceKey || key === invoiceKeyV2)) ||
        Boolean(xmlFileReference && xml === xmlFileReference) ||
        Boolean(pdfFileReference && pdf === pdfFileReference);
    }).map(row => ({
      legacyInvoiceKey: keyCol >= 0 ? String(row[keyCol] || '') : legacyInvoiceKey,
      invoiceKeyV2,
      xmlFileId: xmlCol >= 0 ? String(row[xmlCol] || '') : '',
      pdfFileId: pdfCol >= 0 ? String(row[pdfCol] || '') : '',
      xmlStatus: xmlStatusCol >= 0 ? String(row[xmlStatusCol] || '') : '',
      pdfStatus: pdfStatusCol >= 0 ? String(row[pdfStatusCol] || '') : '',
      viewLinkPresent: viewCol >= 0 && Boolean(row[viewCol])
    }));
  }

  function readLedgerRows(request) {
    const sheet = spreadsheet_().getSheetByName(CONFIG.SHEET_INVOICE);
    if (!sheet) return [];
    const maxRows = Number(request && request.maxRows || 50);
    const lastRow = Math.min(sheet.getLastRow(), maxRows + 1);
    if (lastRow < 2) return [];
    const values = sheet.getRange(2, 1, lastRow - 1, Math.min(sheet.getLastColumn(), 16)).getValues();
    const legacyInvoiceKey = String(request && request.legacyInvoiceKey || '');
    const invoiceKeyV2 = String(request && request.invoiceKeyV2 || '');
    const lineHashes = {};
    (request && request.lineHashes || []).forEach(hash => {
      lineHashes[String(hash || '')] = true;
    });
    return values.filter(row => {
      const hash = String(row[CONFIG.NHAPXUAT_INDEX.hash] || '');
      const key = String(row[CONFIG.NHAPXUAT_INDEX.invoiceKey] || '');
      return key === legacyInvoiceKey || key === invoiceKeyV2 || Boolean(lineHashes[hash]);
    }).map(row => ({
      legacyInvoiceKey: String(row[CONFIG.NHAPXUAT_INDEX.invoiceKey] || ''),
      invoiceKeyV2,
      legacyHashIndex: String(row[CONFIG.NHAPXUAT_INDEX.hash] || ''),
      lineIdentityV2: String(row[CONFIG.NHAPXUAT_INDEX.hash] || '')
    }));
  }

  return Object.freeze({ readHoaDonRows, readLedgerRows });
}
