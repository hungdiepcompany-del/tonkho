function buildInvoiceKey_(issueDate, taxCode, invoiceNo) {
  const parsedDate = parseInvoiceDateValue_(issueDate);

  if (!parsedDate) {
    throw new Error("Ngay hoa don khong hop le: " + issueDate);
  }

  const mst = normalizeInvoiceTaxCode_(taxCode);
  if (!mst) {
    throw new Error("MST hoa don khong hop le: " + taxCode);
  }

  const normalizedInvoiceNo = normalizeInvoiceNo_(invoiceNo);
  const inv = String(
    normalizedInvoiceNo === null || normalizedInvoiceNo === undefined
      ? ""
      : normalizedInvoiceNo
  ).trim();

  if (!inv || /^UNKNOWN/i.test(inv)) {
    throw new Error("So hoa don khong hop le: " + invoiceNo);
  }

  const date = Utilities.formatDate(
    parsedDate,
    Session.getScriptTimeZone(),
    "yyyyMMdd"
  );

  return `${date}_${mst}_${inv}`;
}

function upsertHoaDonFile_(invoiceKey, type, fileId) {
  const key = String(invoiceKey || "").trim();
  if (!isCanonicalInvoiceKey_(key)) {
    throw new Error("InvoiceKey khong canonical: " + invoiceKey);
  }

  const normalizedType = String(type || "").trim().toUpperCase();
  if (normalizedType !== "XML" && normalizedType !== "PDF") {
    throw new Error("Loai file hoa don khong hop le: " + type);
  }

  const normalizedFileId = normalizeDriveFileId_(fileId);
  if (!normalizedFileId) {
    throw new Error("Drive file ID hoa don khong hop le");
  }

  const sheet = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_FILES);

  if (!sheet) {
    throw new Error("Khong tim thay sheet: " + CONFIG.SHEET_FILES);
  }

  const data = sheet.getDataRange().getValues();
  if (!data.length) {
    throw new Error("Sheet Hoa-Don khong co header");
  }

  const header = data[0];
  const keyCol = header.indexOf("invoiceKey");
  const xmlIdCol = header.indexOf("XML_id");
  const xmlStatusCol = header.indexOf("XML_status");
  const pdfIdCol = header.indexOf("PDF_id");
  const pdfStatusCol = header.indexOf("PDF_status");

  const requiredCols = [
    keyCol,
    xmlIdCol,
    xmlStatusCol,
    pdfIdCol,
    pdfStatusCol
  ];

  if (requiredCols.some(index => index < 0)) {
    throw new Error("Header Hoa-Don khong dung contract");
  }

  const matches = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyCol] || "").trim() === key) {
      matches.push(i + 1);
    }
  }

  if (matches.length > 1) {
    throw new Error("DUPLICATE_INVOICE_KEY: " + key);
  }

  const idCol = normalizedType === "XML" ? xmlIdCol : pdfIdCol;
  const statusCol = normalizedType === "XML" ? xmlStatusCol : pdfStatusCol;

  if (!matches.length) {
    const newRow = Array(header.length).fill("");
    newRow[keyCol] = key;
    newRow[idCol] = normalizedFileId;
    newRow[statusCol] = "✔";
    sheet.appendRow(newRow);
    return { action: "INSERTED", invoiceKey: key, fileId: normalizedFileId };
  }

  const rowIndex = matches[0];
  const existingId = String(data[rowIndex - 1][idCol] || "").trim();

  if (existingId && existingId !== normalizedFileId) {
    throw new Error(
      `INVOICE_FILE_ID_CONFLICT: ${key} ${normalizedType} existing=${existingId} incoming=${normalizedFileId}`
    );
  }

  if (!existingId) {
    sheet.getRange(rowIndex, idCol + 1).setValue(normalizedFileId);
  }

  const currentStatus = String(data[rowIndex - 1][statusCol] || "").trim();
  if (currentStatus !== "✔") {
    sheet.getRange(rowIndex, statusCol + 1).setValue("✔");
  }

  return {
    action: existingId ? "UNCHANGED" : "UPDATED",
    invoiceKey: key,
    fileId: normalizedFileId
  };
}

function removeEmptyInvoiceRows_() {
  const sheet = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_FILES);

  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const rowsToDelete = [];

  data.forEach((r, i) => {
    if (!r[0]) rowsToDelete.push(i + 2);
  });

  rowsToDelete.reverse().forEach(r => {
    if (sheet.getLastRow() > 2) sheet.deleteRow(r);
  });
}

function ensureViewFormula_() {
  const sheet = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_FILES);

  if (!sheet) {
    throw new Error("Khong tim thay sheet: " + CONFIG.SHEET_FILES);
  }

  const canonicalFormula =
    '=ARRAYFORMULA(IF(D2:D="";"";HYPERLINK("https://drive.google.com/file/d/"&D2:D&"/view";"🔎 Xem")))';

  const f2 = sheet.getRange("F2");
  const currentFormula = f2.getFormula();
  const currentDisplay = String(f2.getDisplayValue() || "").trim();
  const spillBlocked = /^#(?:REF|VALUE|N\/A|ERROR)/i.test(currentDisplay);

  if (currentFormula === canonicalFormula && !spillBlocked) {
    return { repaired: false };
  }

  // Remove the array formula first so its spill cells can safely be cleared.
  f2.clearContent();

  const lastRow = sheet.getLastRow();
  if (lastRow >= 3) {
    sheet.getRange(3, 6, lastRow - 2, 1).clearContent();
  }

  f2.setFormula(canonicalFormula);
  return { repaired: true };
}
