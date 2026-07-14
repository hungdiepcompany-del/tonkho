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



