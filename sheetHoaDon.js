function buildInvoiceKey_(issueDate, taxCode, invoiceNo) {
  const parsedDate = parseInvoiceDateValue_(issueDate);

  if (!parsedDate) {
    throw new Error("Ngay hoa don khong hop le: " + issueDate);
  }

  const date = Utilities.formatDate(
    parsedDate,
    Session.getScriptTimeZone(),
    "yyyyMMdd"
  );

  const mst = String(taxCode).replace(/\D/g, "");
  const inv = String(invoiceNo).trim();

  return `${date}_${mst}_${inv}`;
}

function upsertHoaDonFile_(invoiceKey, type, fileId) {
  removeEmptyInvoiceRows_();
  const sheet = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_FILES);

  const data = sheet.getDataRange().getValues();

  const header = data[0];

  const keyCol = header.indexOf("invoiceKey");
  const xmlIdCol = header.indexOf("XML_id");
  const xmlStatusCol = header.indexOf("XML_status");
  const pdfIdCol = header.indexOf("PDF_id");
  const pdfStatusCol = header.indexOf("PDF_status");

  let rowIndex = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][keyCol] === invoiceKey) {
      rowIndex = i + 1;
      break;
    }
  }

  if (rowIndex === -1) {

    const newRow = Array(header.length).fill("");

    newRow[keyCol] = invoiceKey;

    if (type === "XML") {
      newRow[xmlIdCol] = fileId;
      newRow[xmlStatusCol] = "✔";
    }

    if (type === "PDF") {
      newRow[pdfIdCol] = fileId;
      newRow[pdfStatusCol] = "✔";
    }

    sheet.appendRow(newRow);

  } else {

    if (type === "XML") {
      sheet.getRange(rowIndex, xmlIdCol + 1).setValue(fileId);
      sheet.getRange(rowIndex, xmlStatusCol + 1).setValue("✔");
    }

    if (type === "PDF") {
      sheet.getRange(rowIndex, pdfIdCol + 1).setValue(fileId);
      sheet.getRange(rowIndex, pdfStatusCol + 1).setValue("✔");
    }
  }
}

function removeEmptyInvoiceRows_() {

  const sheet = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_FILES);

  const lastRow = sheet.getLastRow();
  if (lastRow <= 2) return;

  const data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();

  let rowsToDelete = [];

  data.forEach((r, i) => {
    if (!r[0]) rowsToDelete.push(i + 2);
  });

  rowsToDelete.reverse().forEach(r => {
    if (sheet.getLastRow() > 2) sheet.deleteRow(r);
  });

}

function ensureViewFormula_(){

  const sheet = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_FILES);

  const f2 = sheet.getRange("F2");

  if (!f2.getFormula()) {

    f2.setFormula(
      '=ARRAYFORMULA(IF(D2:D="";"";HYPERLINK("https://drive.google.com/file/d/"&D2:D&"/view";"🔎 Xem")))'
    );

  }
}

// function buildHoaDonIndex_() {

//   const sheet = SpreadsheetApp
//     .getActive()
//     .getSheetByName(CONFIG.SHEET_FILES);

//   const data = sheet.getDataRange().getValues();

//   const header = data[0];
//   const keyCol = header.indexOf("invoiceKey");

//   const map = {};

//   for (let i = 1; i < data.length; i++) {
//     const key = data[i][keyCol];
//     if (key) map[key] = i + 1;
//   }

//   return { map, header };
// }
