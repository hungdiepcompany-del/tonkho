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
