// D6K-C business module consolidation: XML and PDF attachment parsing.
// Function names are preserved for Apps Script global compatibility.

/**
 * Parse XML hoa don (dung chung cho NHAP / XUAT)
 * @param {Blob|string} xmlInput Blob XML hoac string XML
 * @param {Object} options { type: "NHAP" | "XUAT" }
 */
function parseInvoiceXML_(xmlInput, options = {}) {
  const xmlDoc = loadXmlDocument_(xmlInput);
  const type = options.type || null;

  const result = {
    meta: parseInvoiceMeta_(xmlDoc),
    items: parseInvoiceItems_(xmlDoc),
    rawXml: null,
    invoiceType: type
  };

  if (type === "NHAP") {
    result.seller = parseSeller_(xmlDoc);
  } else if (type === "XUAT") {
    result.buyer = parseBuyer_(xmlDoc);
  } else {
    throw new Error("parseInvoiceXML_: invoice type (NHAP/XUAT) is required");
  }

  return result;
}

function isVatInvoiceXML_(meta) {
  if (!meta?.invoiceName) return false;

  return normalizeTextForCompare_(meta.invoiceName)
    === normalizeTextForCompare_("Hóa đơn giá trị gia tăng");
}

function loadXmlDocument_(xmlInput) {
  let xmlString = xmlInput;

  if (typeof xmlInput !== "string") {
    xmlString = xmlInput.getDataAsString("UTF-8");
  }

  return XmlService.parse(xmlString);
}

function parseInvoiceMeta_(xmlDoc) {
  const root = xmlDoc.getRootElement();
  const dlhdon = root.getChild("DLHDon");
  const ttChung = dlhdon?.getChild("TTChung");

  if (!ttChung) return null;

  return {
    invoiceName: ttChung.getChildText("THDon") || null,
    invoiceDate: ttChung.getChildText("NLap") || null,
    invoiceNo: ttChung.getChildText("SHDon") || null,
    invoiceSymbol: ttChung.getChildText("KHHDon") || null
  };
}

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

function parseInvoiceItems_(xmlDoc) {
  const root = xmlDoc.getRootElement();

  const itemsNode = root
    .getChild("DLHDon")
    ?.getChild("NDHDon")
    ?.getChild("DSHHDVu");

  if (!itemsNode) return [];

  const itemNodes = itemsNode.getChildren("HHDVu");
  const items = [];
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

function buildItemCodeList_() {
  const sh = SpreadsheetApp.getActive()
    .getSheetByName(CONFIG.SHEET_ITEMCODE);

  if (!sh) throw new Error("Khong tim thay sheet " + CONFIG.SHEET_ITEMCODE);

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const values = sh.getRange(2, 1, lastRow - 1, 2).getValues();
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

function extractVatMetaFromPDFText_(text) {
  const source = String(text || "");

  const invoiceNoMatch = source.match(
    /SỐ\s*(H[ÓO]A?\s*ĐƠN)?\s*(\(NO\.\))?\s*[:\-]?\s*([0-9]+)/i
  );

  const rawInvoiceNo = invoiceNoMatch?.[3] || null;
  const invoiceNo = rawInvoiceNo !== null
    ? normalizeInvoiceNo_(rawInvoiceNo)
    : null;

  const myTaxCode =
    typeof CONFIG !== "undefined" && CONFIG.MY_TAXCODE
      ? normalizeInvoiceTaxCode_(CONFIG.MY_TAXCODE)
      : "";

  // Fail closed: PDF fallback may only pick a counterparty when our own MST
  // is present and the other business MST can be located relative to it.
  const counterpartyOccurrence = myTaxCode
    ? pickCounterpartyTaxCodeOccurrence_(source, myTaxCode)
    : null;

  const taxCode = counterpartyOccurrence?.code || null;
  const invoiceDate = extractInvoiceDateFromPDFText_(source);
  const companyName = counterpartyOccurrence
    ? extractCompanyNameNearTaxCode_(source, counterpartyOccurrence)
    : null;

  return {
    taxCode,
    invoiceNo,
    invoiceDate,
    companyName
  };
}

function extractInvoiceDateFromPDFText_(text) {
  const source = String(text || "");

  let match = source.match(
    /NGÀY(?:\s*\(DATE\))?(?:\s+LẬP)?[^0-9]{0,25}([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{4})/i
  );
  if (match) {
    const parsed = parseInvoiceDateValue_(match[1]);
    if (parsed) return Utilities.formatDate(parsed, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
  }

  match = source.match(
    /NGÀY(?:\s*\(DATE\))?\s*([0-9]{1,2})\s*THÁNG(?:\s*\(MONTH\))?\s*([0-9]{1,2})\s*NĂM(?:\s*\(YEAR\))?\s*([0-9]{4})/i
  );
  if (match) {
    const parsed = parseInvoiceDateValue_(`${match[1]}/${match[2]}/${match[3]}`);
    if (parsed) return Utilities.formatDate(parsed, "Asia/Ho_Chi_Minh", "yyyy-MM-dd");
  }

  return null;
}

function extractTaxCodeOccurrences_(text) {
  const source = String(text || "");
  const occurrences = [];
  const regex = /(MÃ\s*SỐ\s*THUẾ|MA\s*SO\s*THUE|MST|TAX\s*CODE)[^0-9]{0,60}([0-9][0-9 \t.\-]{6,28}[0-9])/gi;
  let match;

  while ((match = regex.exec(source)) !== null) {
    const code = normalizeInvoiceTaxCode_(match[2]);
    if (!code) continue;

    const lineStart = source.lastIndexOf("\n", match.index) + 1;
    const nextLineBreak = source.indexOf("\n", regex.lastIndex);
    const lineEnd = nextLineBreak >= 0 ? nextLineBreak : source.length;
    const context = source.slice(lineStart, lineEnd);

    occurrences.push({
      code,
      index: match.index,
      context,
      provider: isInvoiceProviderContext_(context)
    });
  }

  return occurrences;
}

function isInvoiceProviderContext_(context) {
  const normalized = normalizeTextForCompare_(context || "");
  return (
    normalized.includes("don vi cung cap") ||
    normalized.includes("phat hanh boi") ||
    normalized.includes("giai phap hoa don") ||
    normalized.includes("phan mem meinvoice") ||
    normalized.includes("softdreams") ||
    normalized.includes("bkav")
  );
}

function pickCounterpartyTaxCodeOccurrence_(text, myTaxCode) {
  const own = normalizeInvoiceTaxCode_(myTaxCode);
  if (!own) return null;

  const businessOccurrences = extractTaxCodeOccurrences_(text)
    .filter(x => !x.provider);

  const ownOccurrences = businessOccurrences.filter(x => x.code === own);
  if (!ownOccurrences.length) return null;

  const ownOccurrence = ownOccurrences[0];
  const before = businessOccurrences
    .filter(x => x.code !== own && x.index < ownOccurrence.index)
    .sort((a, b) => b.index - a.index);
  const after = businessOccurrences
    .filter(x => x.code !== own && x.index > ownOccurrence.index)
    .sort((a, b) => a.index - b.index);

  const roleWindow = normalizeTextForCompare_(
    String(text || "").slice(Math.max(0, ownOccurrence.index - 500), ownOccurrence.index + 80)
  );
  const lastBuyerMarker = Math.max(
    roleWindow.lastIndexOf("nguoi mua"),
    roleWindow.lastIndexOf("buyer"),
    roleWindow.lastIndexOf("customer")
  );
  const lastSellerMarker = Math.max(
    roleWindow.lastIndexOf("don vi ban"),
    roleWindow.lastIndexOf("nguoi ban"),
    roleWindow.lastIndexOf("seller")
  );

  // NHAP: our MST is in the buyer block -> seller MST should be immediately before it.
  if (lastBuyerMarker > lastSellerMarker && before.length) {
    return before[0];
  }

  // XUAT: our MST is in the seller block -> buyer MST should be immediately after it.
  if (lastSellerMarker > lastBuyerMarker && after.length) {
    return after[0];
  }

  // Deterministic fallback only when there is a single side to choose from.
  if (before.length && !after.length) return before[0];
  if (after.length && !before.length) return after[0];

  // Ambiguous PDF: do not guess.
  return null;
}

function extractAllTaxCodes_(text) {
  return extractTaxCodeOccurrences_(text).map(x => x.code);
}

function pickCounterpartyTaxCode_(text, myTaxCode) {
  return pickCounterpartyTaxCodeOccurrence_(text, myTaxCode)?.code || null;
}

function extractCompanyNameNearTaxCode_(text, occurrence) {
  if (!occurrence) return null;

  const source = String(text || "");
  const before = source.slice(Math.max(0, occurrence.index - 450), occurrence.index);
  const lines = before
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean)
    .reverse();

  for (const line of lines) {
    const normalized = normalizeTextForCompare_(line);
    if (!normalized.includes("cong ty")) continue;
    if (isInvoiceProviderContext_(line)) continue;
    return line.replace(
      /^(?:TÊN\s*ĐƠN\s*VỊ(?:\s*\(COMPANY(?:'S)?\s*NAME\))?|ĐƠN\s*VỊ\s*BÁN(?:\s*HÀNG)?|SELLER)\s*:?\s*/i,
      ""
    ).trim();
  }

  return null;
}

function buildVatPdfFileName_(meta) {
  const parsedDate = meta.invoiceDate
    ? parseInvoiceDateValue_(meta.invoiceDate)
    : null;

  if (!parsedDate) {
    throw new Error("PDF invoice date missing or invalid");
  }

  const canonicalTaxCode = normalizeInvoiceTaxCode_(meta.taxCode);
  if (!canonicalTaxCode) {
    throw new Error("PDF counterparty tax code missing or ambiguous");
  }

  const safeInvoiceNo = normalizeInvoiceNo_(meta.invoiceNo);
  buildInvoiceKey_(parsedDate, canonicalTaxCode, safeInvoiceNo);

  const date = Utilities.formatDate(parsedDate, "Asia/Ho_Chi_Minh", "yyyyMMdd");

  const safeCompany = (meta.companyName || meta.company || "UNKNOWNCOMPANY")
    .replace(/[\\/:*?"<>|]/g, "")
    .substring(0, 80);

  const invoiceNo = String(safeInvoiceNo).replace(/[^\w]/g, "");

  return [
    date,
    canonicalTaxCode,
    safeCompany,
    invoiceNo
  ].join("_") + ".pdf";
}

function parseVietnamDate_(dateStr) {
  return parseInvoiceDateValue_(dateStr);
}
