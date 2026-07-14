function writeInvoicesToSheet_(rows) {

  const { dic, dicVietTat } = loadVietTatDictionary_();

  if (!rows || rows.length === 0) {
    debugLog_("Không có dòng mới được thêm. Bỏ qua hàm writeInvoicesToSheet_()");
    return;
  }

  const sh = SpreadsheetApp.getActive()
    .getSheetByName(CONFIG.SHEET_INVOICE);
  if (!sh) throw new Error("Không tìm thấy sheet ghi dữ liệu: " + CONFIG.SHEET_INVOICE);

  // 🧹 XOÁ CÁC DÒNG CÓ CỘT N RỖNG TRƯỚC KHI GHI
  const deleted = deleteEmptyRows_(sh);
  if (deleted > 0) {
    debugLog_(`🧹 Đã xóa ${deleted} dòng có cột N rỗng`);
  }

  // 🧠 build map format (coi như danh sách mã hợp lệ)
  const typeFormatMap = buildInvoiceTypeFormatMap_();
  const itemCodeFormatMap = buildInvoiceItemCodeFormatMap_();

  // 🧹 CHUẨN HOÁ itemCode (cột E = r[3]) TRƯỚC KHI GHI
  const startRow = sh.getLastRow() + 1;

  rows.forEach((r, i) => {

    // 🔹 Chuẩn hoá tên khách hàng → viết tắt
    r[2] = normalizeCustomerName_(r[2], dic, dicVietTat);

    debugLog_(
      `PRE-WRITE | sheetRow=${startRow + i}` +
      ` | customer="${r[2]}"` +
      ` | E(itemCode)="${r[3]}"`
    );

    const itemCode = String(r[3] || "").trim();
    if (!itemCode || !itemCodeFormatMap[itemCode]) {
      r[3] = "Unknown_ID";
    } else {
      r[3] = itemCode; // chuẩn hoá luôn trước khi ghi
    }
  });

  // Thêm cột STT rỗng
  const sheetRows = rows.map(r => ["", ...r]);

  debugLog_(
    `Đang ghi ${sheetRows.length} dòng vào sheet từ hàng ${startRow}`
  );

  // ghi dữ liệu hàng loạt
  sh.getRange(
    startRow,
    1,
    sheetRows.length,
    sheetRows[0].length
  ).setValues(sheetRows);

  const typeFontColors = [];
  const typeFontFamilies = [];
  const typeFontSizes = [];
  const typeFontWeights = [];
  const itemFontColors = [];
  const itemFontFamilies = [];
  const itemFontSizes = [];
  const itemFontWeights = [];

  rows.forEach(r => {
    const typeFmt = typeFormatMap[r[5]] || {};
    typeFontColors.push([typeFmt.fontColor || "#000000"]);
    typeFontFamilies.push([typeFmt.fontFamily || "Arial"]);
    typeFontSizes.push([typeFmt.fontSize || 10]);
    typeFontWeights.push([typeFmt.fontWeight || "normal"]);

    const itemFmt = itemCodeFormatMap[r[3]] || {};
    itemFontColors.push([itemFmt.fontColor || "#000000"]);
    itemFontFamilies.push([itemFmt.fontFamily || "Arial"]);
    itemFontSizes.push([itemFmt.fontSize || 10]);
    itemFontWeights.push([itemFmt.fontWeight || "normal"]);
  });

  sh.getRange(startRow, 7, rows.length, 1)
    .setFontColors(typeFontColors)
    .setFontFamilies(typeFontFamilies)
    .setFontSizes(typeFontSizes)
    .setFontWeights(typeFontWeights);

  sh.getRange(startRow, 5, rows.length, 1)
    .setFontColors(itemFontColors)
    .setFontFamilies(itemFontFamilies)
    .setFontSizes(itemFontSizes)
    .setFontWeights(itemFontWeights);
  return;

  // 🎨 apply format (presentation layer)
  rows.forEach((r, i) => {

    // ---------- invoiceType → cột G ----------
    const invoiceType = r[5];
    if (invoiceType) {
      const fmt = typeFormatMap[invoiceType];
      if (fmt) {
        sh.getRange(startRow + i, 7) // G
          .setFontColor(fmt.fontColor)
          .setFontFamily(fmt.fontFamily)
          .setFontSize(fmt.fontSize)
          .setFontWeight(fmt.fontWeight);
      }
    }

    // ---------- itemCode → cột E ----------
    const itemCode = r[3]; // luôn hợp lệ sau bước chuẩn hoá
    const fmt = itemCodeFormatMap[itemCode];
    if (fmt) {
      sh.getRange(startRow + i, 5) // E
        .setFontColor(fmt.fontColor)
        .setFontFamily(fmt.fontFamily)
        .setFontSize(fmt.fontSize)
        .setFontWeight(fmt.fontWeight);
    }

  });
}

// function deleteEmptyRows_(sh) {
//   const lastRow = sh.getLastRow();
//   if (lastRow < 2) return 0; // có 1 dòng chứa tiêu đề

//   // Lấy dữ liệu cột A → N (giữ nguyên để không đổi cấu trúc)
//   const range = sh.getRange(2, 1, lastRow - 1, 14);
//   const values = range.getValues();

//   let deleted = 0;

//   // duyệt NGƯỢC để tránh lệch dòng
//   for (let i = values.length - 1; i >= 0; i--) {
//     const colN = values[i][13]; // cột N

//     // ✔ CHỈ kiểm tra cột N rỗng
//     if (colN === "" || colN === null) {
//       sh.deleteRow(i + 2); // +2 vì bắt đầu từ row 2
//       deleted++;
//     }
//   }

//   return deleted;
// }

function deleteEmptyRows_(sh) {

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return 0;

  const range = sh.getRange(2, 1, lastRow - 1, 14); // A → N
  const values = range.getValues();

  let deleted = 0;

  for (let i = values.length - 1; i >= 0; i--) {

    const hash = values[i][13]; // cột N

    if (!hash) {
      sh.deleteRow(i + 2);
      deleted++;
    }
  }

  return deleted;
}

function buildInvoiceTypeFormatMap_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_ITEMTYPE);
  if (!sh) throw new Error("Không tìm thấy sheet " + CONFIG.SHEET_ITEMTYPE);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return {};

  const range = sh.getRange(2, 1, lastRow - 1, 1);
  const values = range.getValues().flat();
  const richTexts = range.getRichTextValues();

  const map = {};

  values.forEach((v, i) => {
    if (!v) return;

    const key = String(v).trim();
    const rt = richTexts[i][0];
    if (!rt) return;

    const style = rt.getTextStyle();
    const colorObj = style.getForegroundColorObject();

    map[key] = {
      fontColor: colorObj?.asRgbColor()?.asHexString() || "#000000",
      fontFamily: style.getFontFamily(),
      fontSize: style.getFontSize(),
      fontWeight: style.isBold() ? "bold" : "normal"
    };
  });

  return map;
}

function buildInvoiceItemCodeFormatMap_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(CONFIG.SHEET_ITEMCODE);
  if (!sh) throw new Error("Không tìm thấy sheet " + CONFIG.SHEET_ITEMCODE);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return {};

  const range = sh.getRange(2, 1, lastRow - 1, 1);

  const values = range.getValues().map(r => r[0]);
  const richTexts = range.getRichTextValues().map(r => r[0]);

  const map = {};

  values.forEach((v, i) => {
    if (!v) return;

    const key = String(v).trim();
    const rt = richTexts[i];
    if (!rt) return;

    const style = rt.getTextStyle();
    const colorObj = style.getForegroundColorObject();

    map[key] = {
      fontColor: colorObj?.asRgbColor()?.asHexString() || "#000000",
      fontFamily: style.getFontFamily(),
      fontSize: style.getFontSize(),
      fontWeight: style.isBold() ? "bold" : "normal"
    };
  });

  return map;
}

// Sắp xếp thứ tự theo cột A STT tăng dần
function sortSheetBySTT_() {
  const sh = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_INVOICE);

  if (!sh) return;

  const lastRow = sh.getLastRow();
  if (lastRow <= 1) return; // chỉ header thì thôi

  // Sort từ hàng 2 để giữ header
  sh.getRange(2, 1, lastRow - 1, sh.getLastColumn())
    .sort({ column: 1, ascending: true });
}

/* Hàm này dùng khi nào?
 * ✔ Khi dữ liệu đã có sẵn từ trước
 * ✔ Khi bạn đổi màu / font trong PhanLoai hoặc MaHangHoa
 * ✔ Khi muốn reset format cho cả bảng
 */
function reapplyInvoiceFormats_() {
  const ss = SpreadsheetApp.getActive();

  const sh = ss.getSheetByName(CONFIG.SHEET_INVOICE);
  if (!sh) throw new Error("Không tìm thấy sheet: " + CONFIG.SHEET_INVOICE);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    debugLog_("ℹ️ Không có dữ liệu để reformat");
    return;
  }

  // ----- build format maps -----
  const typeMap = buildInvoiceTypeFormatMap_();
  const itemMap = buildInvoiceItemCodeFormatMap_();

  const numRows = lastRow - 1;

  // ----- đọc dữ liệu 2 cột -----
  const invoiceTypes = sh.getRange(2, 7, numRows, 1)
    .getValues().map(r => r[0]);

  const itemCodes = sh.getRange(2, 5, numRows, 1)
    .getValues().map(r => r[0]);

  // ----- prepare font arrays -----
  const typeFontColors = [];
  const typeFontFamilies = [];
  const typeFontSizes = [];
  const typeFontWeights = [];

  const itemFontColors = [];
  const itemFontFamilies = [];
  const itemFontSizes = [];
  const itemFontWeights = [];

  for (let i = 0; i < numRows; i++) {

    // ---- invoiceType (G) ----
    const t = String(invoiceTypes[i] || "").trim();
    const tf = typeMap[t];

    typeFontColors.push([tf?.fontColor || "#000000"]);
    typeFontFamilies.push([tf?.fontFamily || "Arial"]);
    typeFontSizes.push([tf?.fontSize || 10]);
    typeFontWeights.push([tf?.fontWeight || "normal"]);

    // ---- itemCode (E) ----
    const m = String(itemCodes[i] || "").trim();
    const mf = itemMap[m];

    itemFontColors.push([mf?.fontColor || "#000000"]);
    itemFontFamilies.push([mf?.fontFamily || "Arial"]);
    itemFontSizes.push([mf?.fontSize || 10]);
    itemFontWeights.push([mf?.fontWeight || "normal"]);
  }

  const typeRange = sh.getRange(2, 7, numRows, 1);
  typeRange
    .setFontColors(typeFontColors)
    .setFontFamilies(typeFontFamilies)
    .setFontSizes(typeFontSizes)
    .setFontWeights(typeFontWeights);

  const itemRange = sh.getRange(2, 5, numRows, 1);
  itemRange
    .setFontColors(itemFontColors)
    .setFontFamilies(itemFontFamilies)
    .setFontSizes(itemFontSizes)
    .setFontWeights(itemFontWeights);

  debugLog_("Đã re-apply format cho %s dòng invoice", numRows);
}

// Hàm format lại MỘT dải dòng (dùng cho onEdit)
function applyInvoiceFormatsForRows_(sh, startRow, numRows) {
  if (numRows <= 0) return;

  const typeMap = buildInvoiceTypeFormatMap_();
  const itemMap = buildInvoiceItemCodeFormatMap_();

  const invoiceTypes = sh.getRange(startRow, 7, numRows, 1) // G
    .getValues().map(r => r[0]);

  const itemCodes = sh.getRange(startRow, 5, numRows, 1) // E
    .getValues().map(r => r[0]);

  const typeFontColors = [];
  const typeFontFamilies = [];
  const typeFontSizes = [];
  const typeFontWeights = [];

  const itemFontColors = [];
  const itemFontFamilies = [];
  const itemFontSizes = [];
  const itemFontWeights = [];

  for (let i = 0; i < numRows; i++) {

    const typeKey = String(invoiceTypes[i] || "").trim();
    const tf = typeMap[typeKey];

    typeFontColors.push([tf?.fontColor || "#000000"]);
    typeFontFamilies.push([tf?.fontFamily || "Arial"]);
    typeFontSizes.push([tf?.fontSize || 10]);
    typeFontWeights.push([tf?.fontWeight || "normal"]);

    const itemKey = String(itemCodes[i] || "").trim();
    const mf = itemMap[itemKey];

    itemFontColors.push([mf?.fontColor || "#000000"]);
    itemFontFamilies.push([mf?.fontFamily || "Arial"]);
    itemFontSizes.push([mf?.fontSize || 10]);
    itemFontWeights.push([mf?.fontWeight || "normal"]);
  }

  const typeRange = sh.getRange(startRow, 7, numRows, 1);
  typeRange
    .setFontColors(typeFontColors)
    .setFontFamilies(typeFontFamilies)
    .setFontSizes(typeFontSizes)
    .setFontWeights(typeFontWeights);

  const itemRange = sh.getRange(startRow, 5, numRows, 1);
  itemRange
    .setFontColors(itemFontColors)
    .setFontFamilies(itemFontFamilies)
    .setFontSizes(itemFontSizes)
    .setFontWeights(itemFontWeights);
}
