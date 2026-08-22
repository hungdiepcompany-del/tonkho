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

      // Parse exactly once. Canonical identity is validated before rows are emitted.
      const parsed = parseInvoiceXML_(att, { type });

      const ok = processInvoiceXMLAttachment_(
        parsed,
        type,
        results,
        thread
      );

      let meta = null;

      if (ok) {
        sheetWritten = true;
        hasAnyVatInvoice = true;

        const issueDate = parsed.meta?.invoiceDate;
        const invoiceNo = normalizeInvoiceNo_(parsed.meta?.invoiceNo);
        const taxCode = normalizeInvoiceTaxCode_(
          type === "XUAT"
            ? parsed.buyer?.taxCode
            : parsed.seller?.taxCode
        );
        const invoiceKey = buildInvoiceKey_(issueDate, taxCode, invoiceNo);

        meta = {
          issueDate,
          invoiceNo,
          taxCode,
          invoiceKey,
          companyName:
            type === "XUAT"
              ? parsed.buyer?.name
              : parsed.seller?.name
        };

        debugLog_(type + " - Da nap du lieu XML: " + att.getName());

        if (options.breakOnFirst) {
          invoices.push({ ...meta, blob: att, ok: true });
          break;
        }
      }

      invoices.push({
        ...(meta || {}),
        blob: att,
        ok: !!ok
      });

    } catch (err) {
      debugLog_("Loi xu ly XML (" + type + "): " + att.getName());
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
      "Email " + type + " co XML nhung khong phai XML hoa don:\n" +
      thread.getSubject()
    );
    return false;
  }

  const invoiceDate = parsed.meta?.invoiceDate || "";
  const rawTaxCode =
    type === "XUAT"
      ? parsed.buyer?.taxCode
      : parsed.seller?.taxCode;
  const taxCode = normalizeInvoiceTaxCode_(rawTaxCode);
  const invoiceNo = normalizeInvoiceNo_(parsed.meta?.invoiceNo);
  const invoiceKey = buildInvoiceKey_(invoiceDate, taxCode, invoiceNo);

  parsed.items.forEach((item, itemIndex) => {
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
        invoiceKey
      ],
      thread,
      invoiceKey,
      sourceLineNo: itemIndex + 1
    });
  });

  return true;
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
  const parsedDate = parseInvoiceDateValue_(issueDate);
  if (!parsedDate) {
    throw new Error("Ngay hoa don khong hop le khi luu XML: " + issueDate);
  }

  const canonicalTaxCode = normalizeInvoiceTaxCode_(taxCode);
  if (!canonicalTaxCode) {
    throw new Error("MST hoa don khong hop le khi luu XML: " + taxCode);
  }

  const safeInvoiceNo = normalizeInvoiceNo_(invoiceNo);
  // Reuse the same validator as the registry identity before creating a file.
  buildInvoiceKey_(parsedDate, canonicalTaxCode, safeInvoiceNo);

  const year = String(parsedDate.getFullYear());
  const yearFolder = getOrCreateYearFolder_(year, rootFolderId);

  const yyyyMMdd = Utilities.formatDate(
    parsedDate,
    Session.getScriptTimeZone(),
    "yyyyMMdd"
  );

  const safeCompanyName = String(companyName || "UNKNOWNCOMPANY")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()
    .substring(0, 80) || "UNKNOWNCOMPANY";

  const fileName =
    `${yyyyMMdd}_${canonicalTaxCode}_${safeCompanyName}_${safeInvoiceNo}.xml`;

  const files = yearFolder.getFilesByName(fileName);

  if (files.hasNext()) {
    const file = files.next();
    debugLog_(
      `XML ${logPrefix} da ton tai tren Drive: ${fileName}`
    );
    return file.getId();
  }

  const file = yearFolder.createFile(blob.setName(fileName));

  debugLog_(
    `XML ${logPrefix} da luu Drive: ${fileName}`
  );

  return file.getId();
}
