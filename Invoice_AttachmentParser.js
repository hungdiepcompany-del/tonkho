// D6K-C business module consolidation: XML and PDF attachment parsing.
// Function names are preserved for Apps Script global compatibility.

/**
 * Parse XML hóa đơn (dùng chung cho NHAP / XUAT)
 * @param {Blob|string} xmlInput Blob XML hoặc string XML
 * @param {Object} options { type: "NHAP" | "XUAT" }
 */
function parseInvoiceXML_(xmlInput, options = {}) {
  const xmlDoc = loadXmlDocument_(xmlInput);
  const type = options.type || null;

  const result = {
    meta: parseInvoiceMeta_(xmlDoc),      // 1️⃣ thông tin chung (luôn cần)
    items: parseInvoiceItems_(xmlDoc),    // 4️⃣ danh sách hàng hóa (luôn cần)
    rawXml: null,
    invoiceType: type                     // NHAP / XUAT
  };

  if (type === "NHAP") {
    result.seller = parseSeller_(xmlDoc); // 2️⃣ người bán
  } else if (type === "XUAT") {
    result.buyer = parseBuyer_(xmlDoc);   // 3️⃣ người mua
  } else {
    throw new Error("parseInvoiceXML_: invoice type (NHAP/XUAT) is required");
  }
  // result.rawXml = xmlDoc; // ← bật khi cần debug

  return result;
}

// KIỂM TRA CÓ ĐÚNG LÀ HÓA ĐƠN GTGT
function isVatInvoiceXML_(meta) {
  if (!meta?.invoiceName) return false;

  return normalizeTextForCompare_(meta.invoiceName)
    === normalizeTextForCompare_("Hóa đơn giá trị gia tăng");
}

// 🔹 Helper: load XML
function loadXmlDocument_(xmlInput) {
  let xmlString = xmlInput;

  if (typeof xmlInput !== "string") {
    xmlString = xmlInput.getDataAsString("UTF-8");
  }

  return XmlService.parse(xmlString);
}

// 1️⃣ THÔNG TIN CHUNG – Ngày lập, Số hóa đơn
function parseInvoiceMeta_(xmlDoc) {
  const root = xmlDoc.getRootElement();
  const dlhdon = root.getChild("DLHDon");
  const ttChung = dlhdon?.getChild("TTChung");

  if (!ttChung) return null;

  return {
    invoiceName: ttChung.getChildText("THDon") || null, //Hóa đơn giá trị gia tăng
    invoiceDate: ttChung.getChildText("NLap") || null,     // 2026-01-12
    invoiceNo: ttChung.getChildText("SHDon") || null,   // 00000086
    invoiceSymbol: ttChung.getChildText("KHHDon") || null // C26TKC
  };
}

// 2️⃣ NGƯỜI BÁN
function extractXmlMeta_(doc) {
  try {
    if (!doc) return {};
    const xmlDoc = doc.getRootElement ? doc : loadXmlDocument_(doc);
    return parseInvoiceMeta_(xmlDoc) || {};
  } catch (err) {
    debugLog_("extractXmlMeta_ loi: " + (err.message || err));
    return {};
  }
}

function parseSeller_(xmlDoc) {
  const root = xmlDoc.getRootElement();
  const nBan = root
    .getChild("DLHDon")
    ?.getChild("NDHDon")
    ?.getChild("NBan");

  if (!nBan) return null;

  return {
    name: nBan.getChildText("Ten") || null,
    taxCode: nBan.getChildText("MST") || null
  };
}

// 3️⃣ NGƯỜI MUA
function parseBuyer_(xmlDoc) {
  const root = xmlDoc.getRootElement();
  const nMua = root
    .getChild("DLHDon")
    ?.getChild("NDHDon")
    ?.getChild("NMua");

  if (!nMua) return null;

  return {
    name: nMua.getChildText("Ten") || null,
    taxCode: nMua.getChildText("MST") || null,
  };
}

// // 4️⃣ DANH SÁCH HÀNG HÓA
// function parseInvoiceItems_(xmlDoc) {
//   const root = xmlDoc.getRootElement();

//   const itemsNode = root
//     .getChild("DLHDon")
//     ?.getChild("NDHDon")
//     ?.getChild("DSHHDVu");

//   if (!itemsNode) return [];

//   const itemNodes = itemsNode.getChildren("HHDVu");
//   const items = [];

//   itemNodes.forEach(node => {
//     const name = node.getChildText("THHDVu");
//     items.push({
//       name: name || null,
//       code: generateProductCode_(name) || null,
//       qty: Number(node.getChildText("SLuong") || 0),
//       price: Number(node.getChildText("DGia") || 0)
//     });
//   });

//   return items;
// }

// // 5️⃣ HÀM SINH MÃ SẢN PHẨM THEO TÊN SẢN PHẨM (Thép tấm các loại -> THEPTAM)
// function generateProductCode_(text) {
//   if (!text) return '';

//   return text
//     .normalize('NFD')
//     .replace(/[\u0300-\u036f]/g, '')
//     .split(/\s+/)
//     .slice(0, 2)
//     .join('')
//     .toUpperCase();
// }

function parseInvoiceItems_(xmlDoc) {
  const root = xmlDoc.getRootElement();

  const itemsNode = root
    .getChild("DLHDon")
    ?.getChild("NDHDon")
    ?.getChild("DSHHDVu");

  if (!itemsNode) return [];

  const itemNodes = itemsNode.getChildren("HHDVu");
  const items = [];

  // Load 1 lần duy nhất
  const itemCodeList = buildItemCodeList_();

  itemNodes.forEach(node => {
    const name = node.getChildText("THHDVu");

    items.push({
      name: name || null,
      code: getItemCodeFromSheet_(name, itemCodeList),
      qty: Number(node.getChildText("SLuong") || 0),
      price: Number(node.getChildText("DGia") || 0)
    });
  });

  return items;
}

// BUILD LIST [{code, normalizedName}]
function buildItemCodeList_() {
  const sh = SpreadsheetApp.getActive()
    .getSheetByName(CONFIG.SHEET_ITEMCODE);

  if (!sh) throw new Error("Không tìm thấy sheet " + CONFIG.SHEET_ITEMCODE);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, 2).getValues(); // A:B

  const list = [];

  values.forEach(row => {
    const code = row[0];
    const name = row[1];

    if (!code || !name) return;

    list.push({
      code: code,
      normalizedName: normalizeTextForCompare_(name)
    });
  });

  return list;
}

function getItemCodeFromSheet_(itemName, itemCodeList) {
  if (!itemName) return null;

  const normalizedXmlName = normalizeTextForCompare_(itemName);

  // 🔹 Duyệt từng tên chuẩn trong sheet
  for (let i = 0; i < itemCodeList.length; i++) {
    const item = itemCodeList[i];

    if (normalizedXmlName.includes(item.normalizedName)) {
      return item.code;
    }
  }

  return null;
}

function isVatInvoicePDF_(text) {
  if (!text) return false;

  const head = text
    .trim()
    .substring(0, 50)
    .toUpperCase()
    .replace(/\s+/g, " ");

  return head.includes("HÓA ĐƠN GIÁ TRỊ GIA TĂNG");
}

// Trích xuất text từ file pdf
function extractPdfText_(pdfBlob) {
  let tempDocId = null;
  let parseError = null;

  try {
    const docFile = Drive.Files.insert(
      {
        title: "TMP_PDF_PARSE",
        mimeType: MimeType.GOOGLE_DOCS
      },
      pdfBlob,
      { convert: true }
    );

    tempDocId = docFile && docFile.id;
    const doc = DocumentApp.openById(tempDocId);
    return doc.getBody().getText() || "";
  } catch (err) {
    parseError = err;
    throw err;
  } finally {
    if (tempDocId) {
      try {
        DriveApp.getFileById(tempDocId).setTrashed(true);
      } catch (cleanupErr) {
        debugLog_(
          "OCR temp cleanup failed: " +
          sanitizeLogValue_(cleanupErr.message || cleanupErr)
        );
        if (!parseError) {
          // Cleanup failure must not hide a successful parse.
        }
      }
    }
  }
}

// Extract meta tối thiểu từ PDF text (để đặt tên file)
function extractVatMetaFromPDFText_(text) {

  // ---------- SỐ HÓA ĐƠN ----------
  const invoiceNoMatch = text.match(
    /SỐ\s*(H[ÓO]A?\s*ĐƠN)?\s*(\(NO\.\))?\s*[:\-]?\s*([0-9]+)/i
  );

  const rawInvoiceNo = invoiceNoMatch?.[3] || null;

  // bỏ các số 0 ở đầu
  const invoiceNo = rawInvoiceNo
    ? rawInvoiceNo.replace(/^0+/, "") || "0"
    : null;

  const counterpartyTaxCode =
    typeof CONFIG !== "undefined" && CONFIG.MY_TAXCODE
      ? pickCounterpartyTaxCode_(text, CONFIG.MY_TAXCODE)
      : null;

  const fallbackTaxCode = text.match(
    /(MÃ\s*SỐ\s*THUẾ|MST)\s*[:\-]?\s*([0-9]{8,14})/i
  )?.[2] || null;

  const taxCode = counterpartyTaxCode || fallbackTaxCode;

  return {
    taxCode,

    invoiceNo,

    invoiceDate: text.match(
      /NGÀY[^0-9]{0,10}([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i
    )?.[1] || null,

    companyName: text.match(
      /(CÔNG TY[^0-9\n\r]{5,100})/i
    )?.[1]?.trim() || null
  };
}

function extractAllTaxCodes_(text) {
  return [...text.matchAll(
    /(MÃ\s*SỐ\s*THUẾ|MA\s*SO\s*THUE|MST)[^0-9]{0,50}([0-9]{8,14})/gi
  )].map(m => m[2]);
}

function pickCounterpartyTaxCode_(text, myTaxCode) {
  const taxCodes = extractAllTaxCodes_(text);

  for (const taxCode of taxCodes) {
    if (taxCode === myTaxCode) continue;   // loại chính mình
    return taxCode;                        // lấy cái đầu tiên hợp lệ
  }

  return null;
}

// Build tên file chuẩn thuế
function buildVatPdfFileName_(meta) {

  const parsedDate = meta.invoiceDate
    ? parseInvoiceDateValue_(meta.invoiceDate)
    : null;

  const date = parsedDate
    ? Utilities.formatDate(parsedDate, "Asia/Ho_Chi_Minh", "yyyyMMdd")
    : "UNKNOWNDATE";

  const safeCompany = (meta.companyName || meta.company || "UNKNOWNCOMPANY")
    .replace(/[\\/:*?"<>|]/g, "")
    .substring(0, 80);

  const invoiceNo =
    String(meta.invoiceNo || "UNKNOWNINVOICE")
      .replace(/[^\w]/g, "");

  return [
    date,
    meta.taxCode || "UNKNOWNMST",
    safeCompany,
    invoiceNo || "UNKNOWNINVOICE"
  ].join("_") + ".pdf";
}

function parseVietnamDate_(dateStr) {
  return parseInvoiceDateValue_(dateStr);
}
