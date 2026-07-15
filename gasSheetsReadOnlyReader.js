function createGasSheetsReadOnlyReader(options) {
  const spreadsheetId = options && options.spreadsheetId || '';
  const defaultChunkRows = Number(options && options.chunkRows || 500);
  const defaultMaxUsedRows = Number(options && options.maxUsedRows || 20000);
  const defaultMaxChunks = Number(options && options.maxChunks || 60);

  function spreadsheet_() {
    return spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActive();
  }

  function readHoaDonRows(request) {
    const sheet = spreadsheet_().getSheetByName(CONFIG.SHEET_FILES);
    if (!sheet) return [];
    const maxRows = Number(request && request.maxRows || 20);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    if (lastRow - 1 > Number(request && request.maxUsedRows || defaultMaxUsedRows)) return limitExceededRowsD5D_(maxRows);
    const width = Math.min(sheet.getLastColumn(), 6);
    const header = sheet.getRange(1, 1, 1, width).getValues()[0].map(String);
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
    const matches = [];
    scanSheetRowsD5D_(sheet, 2, lastRow, width, request, row => {
      const key = keyCol >= 0 ? String(row[keyCol] || '') : '';
      const xml = xmlCol >= 0 ? String(row[xmlCol] || '') : '';
      const pdf = pdfCol >= 0 ? String(row[pdfCol] || '') : '';
      const matched = Boolean(key && (key === legacyInvoiceKey || key === invoiceKeyV2)) ||
        Boolean(xmlFileReference && xml === xmlFileReference) ||
        Boolean(pdfFileReference && pdf === pdfFileReference);
      if (!matched) return;
      matches.push({
        legacyInvoiceKey: keyCol >= 0 ? String(row[keyCol] || '') : legacyInvoiceKey,
        invoiceKeyV2,
        xmlFileId: xmlCol >= 0 ? String(row[xmlCol] || '') : '',
        pdfFileId: pdfCol >= 0 ? String(row[pdfCol] || '') : '',
        xmlStatus: xmlStatusCol >= 0 ? String(row[xmlStatusCol] || '') : '',
        pdfStatus: pdfStatusCol >= 0 ? String(row[pdfStatusCol] || '') : '',
        viewLinkPresent: viewCol >= 0 && Boolean(row[viewCol])
      });
    });
    return matches.slice(0, maxRows + 1);
  }

  function readLedgerRows(request) {
    const sheet = spreadsheet_().getSheetByName(CONFIG.SHEET_INVOICE);
    if (!sheet) return [];
    const maxRows = Number(request && request.maxRows || 50);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    if (lastRow - 1 > Number(request && request.maxUsedRows || defaultMaxUsedRows)) return limitExceededRowsD5D_(maxRows);
    const width = Math.min(sheet.getLastColumn(), 16);
    const legacyInvoiceKey = String(request && request.legacyInvoiceKey || '');
    const invoiceKeyV2 = String(request && request.invoiceKeyV2 || '');
    const lineHashes = {};
    (request && request.lineHashes || []).forEach(hash => {
      lineHashes[String(hash || '')] = true;
    });
    const matches = [];
    scanSheetRowsD5D_(sheet, 2, lastRow, width, request, row => {
      const hash = String(row[CONFIG.NHAPXUAT_INDEX.hash] || '');
      const key = String(row[CONFIG.NHAPXUAT_INDEX.invoiceKey] || '');
      if (!(key === legacyInvoiceKey || key === invoiceKeyV2 || Boolean(lineHashes[hash]))) return;
      matches.push({
        legacyInvoiceKey: String(row[CONFIG.NHAPXUAT_INDEX.invoiceKey] || ''),
        invoiceKeyV2,
        legacyHashIndex: String(row[CONFIG.NHAPXUAT_INDEX.hash] || ''),
        lineIdentityV2: String(row[CONFIG.NHAPXUAT_INDEX.hash] || '')
      });
    });
    return matches.slice(0, maxRows + 1);
  }

  function scanSheetRowsD5D_(sheet, startRow, lastRow, width, request, onRow) {
    const chunkRows = Number(request && request.chunkRows || defaultChunkRows);
    const maxChunks = Number(request && request.maxChunks || defaultMaxChunks);
    let row = startRow;
    let chunks = 0;
    while (row <= lastRow && chunks < maxChunks) {
      const count = Math.min(chunkRows, lastRow - row + 1);
      const values = sheet.getRange(row, 1, count, width).getValues();
      values.forEach(onRow);
      row += count;
      chunks += 1;
    }
  }

  function limitExceededRowsD5D_(maxRows) {
    return Array.from({ length: Number(maxRows || 0) + 1 }, () => ({ readLimitExceeded: true }));
  }

  return Object.freeze({ readHoaDonRows, readLedgerRows });
}
