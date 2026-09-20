function processInvoiceAllXMLAttachments_(
  attachments,
  type,
  results,
  thread,
  options = {}
) {
  let sheetWritten = false;
  let hasAnyVatInvoice = false;
  const invoices = [];

  for (const att of attachments) {
    if (!att.getName().toLowerCase().endsWith(".xml")) continue;

    try {
      if (EmailDedupService.isDuplicateAttachment(att, "XML")) continue;

      //PARSE DUY NHẤT 1 LẦN
      const parsed = parseInvoiceXML_(att, { type });

      const ok = processInvoiceXMLAttachment_(
        parsed,        // truyền parsed
        type,
        results,
        thread
      );

      let meta = null;

      if (ok) {
        sheetWritten = true;
        hasAnyVatInvoice = true;

        meta = {
          issueDate: parsed.meta?.invoiceDate,
          invoiceNo: normalizeInvoiceNo_(parsed.meta?.invoiceNo),
          invoiceSymbol: parsed.meta?.invoiceSymbol || "",
          sellerTaxCode: parsed.seller?.taxCode || "UNKNOWNTAXCODE",
          taxCode:
            (type === "XUAT"
              ? parsed.buyer?.taxCode
              : parsed.seller?.taxCode) || "UNKNOWNTAXCODE",
          companyName:
            type === "XUAT"
              ? parsed.buyer?.name
              : parsed.seller?.name, // NHAP
          invoiceKeyV2: buildInvoiceKeyV2_(
            parsed.meta?.invoiceDate,
            parsed.seller?.taxCode,
            parsed.meta?.invoiceSymbol,
            parsed.meta?.invoiceNo
          )
        };

        debugLog_(type + " - Đã nạp dữ liệu XML: " + att.getName());

      }

      invoices.push({
        ...(meta || {}),
        blob: att,
        ok: !!ok
      });

    } catch (err) {
      debugLog_("Lỗi xử lý XML (" + type + "): " + att.getName());
      debugLog_(err.stack || err);

      invoices.push({
        blob: att,
        ok: false,
        error: err.message
      });
    }
  }

  return {
    sheetWritten,
    hasAnyVatInvoice,
    invoices
  };
}

function processInvoiceXMLAttachment_(parsed, type, results, thread) {

  if (!isVatInvoiceXML_(parsed.meta)) {
    debugLog_(
      "Email " + type + " có XML nhưng không phải là XML hóa đơn:\n"
      + thread.getSubject()
    );
    return false;
  }

  const sellerTaxCode = parsed.seller?.taxCode || "UNKNOWNTAXCODE";
  const invoiceKeyV2 = buildInvoiceKeyV2_(
    parsed.meta?.invoiceDate,
    sellerTaxCode,
    parsed.meta?.invoiceSymbol,
    parsed.meta?.invoiceNo
  );

  parsed.items.forEach((item, index) => {

    const invoiceDate = parsed.meta?.invoiceDate || "";
    const yyyyMMdd = invoiceDate.replace(/-/g, "");

    const taxCode =
      (type === "XUAT"
        ? parsed.buyer?.taxCode
        : parsed.seller?.taxCode) || "UNKNOWNTAXCODE";

    const invoiceNo =
      normalizeInvoiceNo_(parsed.meta.invoiceNo);

    const invoiceKey = `${yyyyMMdd}_${taxCode}_${invoiceNo}`;
    const sourceLineNo = Number(item.sourceLineNo || index + 1);
    const lineIdentityV2 = buildLineIdentityV2_({
      invoiceKeyV2,
      sourceLineNo,
      rawItemName: item.rawItemName || item.name,
      unit: item.unit,
      quantity: item.quantity == null ? item.qty : item.quantity,
      unitPrice: item.unitPrice == null ? item.price : item.unitPrice,
      amount: item.amount
    });

    results.push({
      row: [
        invoiceDate,
        invoiceNo,
        type === "XUAT"
          ? parsed.buyer?.name
          : parsed.seller?.name,
        item.code,
        item.name,
        type,
        item.qty,
        item.price,
        invoiceKeyV2
      ],
      invoiceKey,
      invoiceKeyV2,
      invoiceSymbol: parsed.meta?.invoiceSymbol || "",
      sellerTaxCode,
      sourceLineNo,
      rawItemName: item.rawItemName || item.name || "",
      unit: item.unit || "",
      amount: item.amount,
      lineIdentityV2,
      artifactReady: false,
      thread
    });

  });
  return true; // có VAT invoice
}

function saveInvoiceXmlToDrive_(
  blob,
  issueDate,
  taxCode,
  companyName,
  invoiceNo,
  rootFolderId,
  logPrefix
) {
  const year = issueDate.slice(0, 4);
  const yearFolder = getOrCreateYearFolder_(year, rootFolderId);

  const yyyyMMdd = issueDate.replace(/-/g, "");
  const safeInvoiceNo = normalizeInvoiceNo_(invoiceNo);

  const fileName =
    `${yyyyMMdd}_${taxCode}_${companyName}_${safeInvoiceNo}.xml`;

  // 🔎 Kiểm tra file đã tồn tại
  const files = yearFolder.getFilesByName(fileName);

  if (files.hasNext()) {
    const file = files.next();

    debugLog_(
      `📄 XML ${logPrefix} đã tồn tại trên Drive: ${fileName}`
    );

    return file.getId();   // ✅ trả về id thật
  }

  // 📁 tạo file mới
  const file = yearFolder.createFile(blob.setName(fileName));

  debugLog_(
    `📄 XML ${logPrefix} đã lưu Drive: ${fileName}`
  );

  return file.getId();
}
