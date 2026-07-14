function extractAllLinksFromMessage_(msg) {
  const body = msg.getBody();
  if (!body) return [];

  // Bắt URL http/https trong HTML body
  const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
  const matches = body.match(urlRegex) || [];

  const uniqueUrls = [...new Set(matches)];

  return uniqueUrls.filter(isValidInvoiceLink_);
}

function isValidInvoiceLink_(url) {
  // chỉ nhận http / https
  if (!/^https?:\/\//i.test(url)) return false;

  // bỏ protocol + domain
  const path = url.replace(/^https?:\/\/[^\/]+/i, "");

  // "" hoặc "/" → trang chủ → loại
  if (path === "" || path === "/") return false;

  return true; // còn lại giữ hết
}

function tryDownloadPdf_(url, depth = 0) {
  if (!url || typeof url !== "string") return null;
  if (depth > 1) return null; // 🚫 chống loop

  try {
    const res = UrlFetchApp.fetch(url, {
      followRedirects: true,
      muteHttpExceptions: true,
      validateHttpsCertificates: true,
    });

    if (res.getResponseCode() !== 200) return null;

    const headers = res.getAllHeaders();
    const contentType = (headers["Content-Type"] || "").toString().toLowerCase();

    /* =================================================
     * 1️⃣ TRƯỜNG HỢP PDF THẬT
     * ================================================= */
    if (contentType.includes("application/pdf")) {
      const blob = res.getBlob();
      return blob.setName("invoice.pdf");
    }

    /* =================================================
     * 2️⃣ HTML → TÌM LINK PDF BÊN TRONG (CASE EASYINVOICE)
     * ================================================= */
    if (contentType.includes("text/html")) {
      const html = res.getContentText();
      const pdfLink = extractPdfLinkFromHtml_(html, url);

      if (pdfLink) {
        return tryDownloadPdf_(pdfLink, depth + 1); // 🔁 retry 1 level
      }
    }

    return null;

  } catch (err) {
    debugLog_("tryDownloadPdf_ không thành công:", url, err.message);
    return null;
  }
}

function extractPdfLinkFromHtml_(html, baseUrl) {
  try {
    if (!html || typeof html !== "string") return "";

    const candidates = [];
    const hrefRegex = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = hrefRegex.exec(html)) !== null) {
      candidates.push(match[1]);
    }

    const plainPdfRegex = /(https?:\/\/[^\s"'<>]+\.pdf(?:\?[^\s"'<>]*)?)/gi;
    while ((match = plainPdfRegex.exec(html)) !== null) {
      candidates.push(match[1]);
    }

    for (const raw of candidates) {
      const link = String(raw || "").replace(/&amp;/g, "&").trim();
      if (!/\.pdf(?:$|[?#])/i.test(link)) continue;
      return resolveHtmlUrl_(link, baseUrl);
    }

    return "";
  } catch (err) {
    debugLog_("extractPdfLinkFromHtml_ loi: " + (err.message || err));
    return "";
  }
}

function resolveHtmlUrl_(url, baseUrl) {
  try {
    if (!url) return "";
    if (/^https?:\/\//i.test(url)) return url;

    const base = String(baseUrl || "");
    const originMatch = base.match(/^(https?:\/\/[^\/]+)/i);
    if (!originMatch) return url;

    if (url.indexOf("//") === 0) {
      const protocol = originMatch[1].split(":")[0];
      return protocol + ":" + url;
    }

    if (url.charAt(0) === "/") {
      return originMatch[1] + url;
    }

    const baseDir = base.replace(/[?#].*$/, "").replace(/\/[^\/]*$/, "/");
    return baseDir + url;
  } catch (err) {
    debugLog_("resolveHtmlUrl_ loi: " + (err.message || err));
    return "";
  }
}

function saveInvoiceLinkPdf_(links, ctx) {
  const {
    companyName,
    taxCode,
    invoiceNo,
    receivedDate,
    yearFolder
  } = ctx;

  const yyyyMMdd = Utilities.formatDate(
    receivedDate,
    Session.getScriptTimeZone(),
    "yyyyMMdd"
  );

  const fileName =
    `${yyyyMMdd}_${taxCode || "UNKNOWN"}_${companyName}_${invoiceNo}.pdf`;

  // tránh trùng
  if (fileExistsInFolder_(yearFolder, fileName)) {
    debugLog_("LINK_ONLY – PDF đã tồn tại: " + fileName);
    return { existed: true };
  }

  // 1️⃣ Copy template tạo file tạm
  const slideFile = DriveApp
    .getFileById(CONFIG.SLIDE_TEMPLATE_ID)
    .makeCopy(`TMP_LINK_${yyyyMMdd}_${invoiceNo}`);

  const presentation = SlidesApp.openById(slideFile.getId());

  // 2️⃣ Replace placeholder text
  const replacements = {
    "{{COMPANY}}": companyName || "",
    "{{MST}}": taxCode || "",
    "{{INVOICE_NO}}": invoiceNo || "",
    "{{EMAIL_TIME}}": Utilities.formatDate(
      receivedDate,
      Session.getScriptTimeZone(),
      "dd/MM/yyyy HH:mm"
    )
  };

  Object.entries(replacements).forEach(([key, value]) => {
    presentation.replaceAllText(key, value);
  });

  // 3️⃣ Ghi link vào bảng
  writeLinksToTable_(presentation, links);

  presentation.saveAndClose();

  // 4️⃣ Xuất PDF
  const pdfBlob = slideFile.getBlob().getAs("application/pdf");

  pdfBlob.setName(fileName);

  const savedPdf = yearFolder.createFile(pdfBlob);

  // 5️⃣ Dọn file tạm
  slideFile.setTrashed(true);

  debugLog_("LINK->DRIVE: Đã tạo PDF từ Slide: " + fileName);
  return savedPdf;
}

function writeLinksToTable_(presentation, links) {
  const slides = presentation.getSlides();

  for (const slide of slides) {
    const tables = slide.getTables();
    if (!tables.length) continue;

    const table = tables[0];
    const startRow = 1; // bỏ header

    // 1️⃣ Ghi đè row có sẵn
    for (let i = 0; i < links.length; i++) {
      const rowIndex = startRow + i;

      if (rowIndex >= table.getNumRows()) {
        table.appendRow();
      }

      // STT
      table.getCell(rowIndex, 0)
        .getText()
        .setText(String(i + 1));

      // LINK (hyperlink)
      const linkCellText = table.getCell(rowIndex, 1).getText();
      linkCellText.setText(links[i]);
      linkCellText.getTextStyle()
        .setLinkUrl(links[i])
        .setForegroundColor("#1155CC")
        .setUnderline(true);
    }

    // 2️⃣ Clear dư row cũ (nếu template nhiều hơn)
    for (let r = startRow + links.length; r < table.getNumRows(); r++) {
      for (let c = 0; c < table.getNumColumns(); c++) {
        table.getCell(r, c).getText().setText("");
      }
    }

    break;
  }
}
