/*========================================================
 * GMAIL SCANNER – INVOICE OUT (XUAT)
 *========================================================*/
function scanInvoiceOutEmails_() {
  const results = [];

  // 🔑 Validate label chính
  const invoiceLabel = validateGmailInvoiceLabel_(CONFIG.INVOICE_OUT_LABEL);

  // 🔑 Label trạng thái
  const {
    saveSheetLabel,
    savePdfLabel,
    saveXmlLabel,
    pendingLabel
  } = initInvoiceProcessLabels_({
    includePdf: true,
    includeXml: true
  }); // gmailLabel

  const query = buildInvoiceQuery_( // gmailSearch
    CONFIG.INVOICE_OUT_LABEL,
    CONFIG.SAVE_SHEET_LABEL,
    CONFIG.SAVE_XML_LABEL
  );

  const threads = searchInvoiceThreads_( // gmailSearch
    query,
    "Không có email XUẤT được xử lý"
  );
  if (!threads.length) return results;

  const deadline = Date.now() + 4.5 * 60 * 1000;
  const maxThreads = Number(CONFIG.MAX_EMAIL_SCAN) || threads.length;
  let processedThreads = 0;

  // Skip sớm nếu đã xử lý hoàn chỉnh

  for (const thread of threads) {
    if (processedThreads >= maxThreads || Date.now() > deadline) {
      debugLog_("Dung scan OUT de tranh timeout");
      break;
    }
    processedThreads++;

    try {
    if (threadHasAllLabel_(thread, [ // gmailLabel
      CONFIG.SAVE_SHEET_LABEL,
      CONFIG.SAVE_XML_LABEL
    ])) {
      // const msg = thread.getMessages()[0];
      // const subject = msg.getSubject();
      // const labels = thread.getLabels().map(l => l.getName()).join(", ");
      // debugLog_(`⏭ Bỏ qua OUT | ${subject} | labels=[${labels}]`);
      continue;
    }

    const { attachments } =
      collectThreadMessagesAndAttachments_(thread); //gmailCollection.gs

    if (!attachments.length) continue;

    // ======================================================
    // XỬ LÝ XML → NHẬN KẾT QUẢ CHI TIẾT
    const {
      sheetWritten,
      hasAnyVatInvoice,
      invoices
    } = processInvoiceAllXMLAttachments_(
      attachments,
      "XUAT",
      results,
      thread
    );

    // ======================================================
    // LƯU XML RA DRIVE (QUYẾT ĐỊNH Ở SCANNER)
    let anyXmlSaved = false;

    if (sheetWritten && invoices?.length) {
      invoices
        .filter(inv => inv.ok)
        .forEach(inv => {
          const fileId = saveInvoiceXmlToDrive_(
            inv.blob,
            inv.issueDate,
            inv.taxCode,
            inv.companyName,
            inv.invoiceNo,
            CONFIG.INVOICE_OUT_FOLDER_ID,
            "OUT"
          );

          if (fileId) {
            anyXmlSaved = true;

            const invoiceKey =
              buildInvoiceKey_(
                inv.issueDate,
                inv.taxCode,
                inv.invoiceNo
              );

            upsertHoaDonFile_(invoiceKey, "XML", fileId);
          }
        });
    }

    // ======================================================
    // 2️⃣ PDF
    let pdfSaved = false;
    let sourceUsed = null;

    for (const att of attachments) {
      if (Date.now() > deadline) {
        debugLog_("Dung xu ly PDF OUT de tranh timeout");
        break;
      }

      if (!att.getName().toLowerCase().endsWith(".pdf")) continue;

      const text = extractPdfText_(att.copyBlob());

      if (!isVatInvoicePDF_(text)) {
        debugLog_("⏭ Không phải HĐ GTGT (PDF): " + att.getName());
        continue;
      }

      debugLog_("PDF HĐ GTGT phát hiện: " + att.getName());

      let fileName;
      let meta;

      // ✅ XML đã xử lý → dùng meta XML
      if (sheetWritten && anyXmlSaved && invoices?.length) {

        const inv = invoices?.find(i => i.ok);

        if (!inv) {
          debugLog_("⚠ XML không tìm được invoice hợp lệ");
          continue;
        }

        meta = {
          invoiceDate: inv.issueDate,
          taxCode: inv.taxCode,
          companyName: inv.companyName,
          invoiceNo: inv.invoiceNo
        };

        fileName = buildVatPdfFileName_(meta);

      } else {

        // ⚠ fallback parse PDF
        meta = extractVatMetaFromPDFText_(text);
        fileName = buildVatPdfFileName_(meta);
      }

      const year = getInvoiceYearFromDate_(meta?.invoiceDate) || "UNKNOWN";

      const yearFolder = getOrCreateYearFolder_(
        year,
        CONFIG.INVOICE_OUT_FOLDER_ID
      );

      const existed = findFileInFolder_(yearFolder, fileName);

      if (existed) {

        const fileId = existed.getId();

        const invoiceKey =
          buildInvoiceKey_(
            meta.invoiceDate,
            meta.taxCode,
            meta.invoiceNo
          );

        upsertHoaDonFile_(invoiceKey, "PDF", fileId);

        debugLog_("⏭ PDF đã tồn tại – dùng lại: " + fileName);

        pdfSaved = true;
        sourceUsed = "PDF";

        break;
      }

      const fileId = saveInvoicePdfToDrive_(att.copyBlob(), fileName, yearFolder);

      const invoiceKey =
        buildInvoiceKey_(
          meta.invoiceDate,
          meta.taxCode,
          meta.invoiceNo
        );

      upsertHoaDonFile_(invoiceKey, "PDF", fileId);

      pdfSaved = true;

      debugLog_("📁 Đã lưu PDF: " + fileName);

      break;
    }
    // ======================================================
    // GẮN NHÃN TRẠNG THÁI THREAD (SHEET + XML)
    if (sheetWritten) {
      debugLog_("OUT XML rows prepared; saved-sheet label deferred until commit");
    }

    if (anyXmlSaved) {
      thread.addLabel(saveXmlLabel);
    }

    if (pdfSaved) {
      thread.addLabel(savePdfLabel);
    }

    if (!anyXmlSaved) {
      thread.addLabel(pendingLabel);
    } else {
      thread.removeLabel(pendingLabel);
    }

    debugLog_(
      `OUT | rowsPrepared=${sheetWritten} | xml=${anyXmlSaved} | pending=${(!anyXmlSaved)}`
    );
    } catch (err) {
      debugLog_("Loi xu ly thread OUT: " + (err.stack || err));
      try {
        thread.addLabel(pendingLabel);
      } catch (labelErr) {
        debugLog_("Khong gan duoc pending OUT: " + labelErr.message);
      }
    }
  }

  return results;
}

/*========================================================
 * 📥 GMAIL SCANNER – INVOICE IN (NHAP)
 *========================================================*/
function scanInvoiceInEmails_() {
  const results = [];

  // Validate label chính
  const invoiceLabel = validateGmailInvoiceLabel_(CONFIG.INVOICE_IN_LABEL); // gmailValidate

  // Label trạng thái
  const {
    saveSheetLabel,
    savePdfLabel,
    saveXmlLabel,
    saveLinkLabel,
    pendingLabel
  } = initInvoiceProcessLabels_({
    includePdf: true,
    includeXml: true,
    includeLink: true
  }); // gmailLabel

  const query = buildInvoiceQuery_( // gmailSearch
    CONFIG.INVOICE_IN_LABEL
    , CONFIG.SAVE_SHEET_LABEL
    , CONFIG.SAVE_PDF_LABEL
    //, CONFIG.SAVE_XML_LABEL // 🆕
  );

  const threads = searchInvoiceThreads_(  //gmailSearch
    query,
    "Không có email NHẬP được xử lý"
  );

  if (!threads.length) return results;

  const deadline = Date.now() + 4.5 * 60 * 1000;
  const maxThreads = Number(CONFIG.MAX_EMAIL_SCAN) || threads.length;
  let processedThreads = 0;


  // ======================================================
  for (const thread of threads) {
    if (processedThreads >= maxThreads || Date.now() > deadline) {
      debugLog_("Dung scan IN de tranh timeout");
      break;
    }
    processedThreads++;

    try {

    // let sheetWritten = false;   // 🔒 đã ghi sheet
    let pdfSaved = false;       // 📄 đã lưu PDF
    let linkSaved = false;      // 🔗 đã lưu LINK
    let sourceUsed = null;      // XML | PDF | BODY | LINK
    // GOM TOÀN BỘ LINK KHÔNG TẢI ĐƯỢC PDF
    const failedLinks = [];

    // Skip sớm nếu đã xử lý hoàn chỉnh
    if (threadHasAllLabel_(thread, [ // gmailLabel
      CONFIG.SAVE_SHEET_LABEL
      , CONFIG.SAVE_PDF_LABEL
      , CONFIG.SAVE_XML_LABEL
    ])
    ) {
      // const msg = thread.getMessages()[0];
      // const subject = msg.getSubject();
      // const labels = thread.getLabels().map(l => l.getName()).join(", ");
      // debugLog_(
      //   `⏭ Bỏ qua IN | ${subject} | labels=[${labels}]`
      // );
      continue;
    }

    const { attachments, bodies } =
      collectThreadMessagesAndAttachments_(thread, { includeBodies: true });  //gmailCollection.gs

    // ======================================================
    // 1️⃣ XML – ƯU TIÊN CAO NHẤT
    const {
      sheetWritten,
      invoices
    } = processInvoiceAllXMLAttachments_(
      attachments,
      "NHAP",
      results,
      thread,
      { breakOnFirst: true }
    );

    if (sheetWritten) sourceUsed = "XML";

    // ======================================================
    // 📁 LƯU XML_IN RA DRIVE
    let anyXmlSaved = false;

    if (sheetWritten && invoices?.length) {
      invoices
        .filter(inv => inv.ok)
        .forEach(inv => {
          const fileId = saveInvoiceXmlToDrive_(
            inv.blob,
            inv.issueDate,
            inv.taxCode,
            inv.companyName,
            inv.invoiceNo,
            CONFIG.INVOICE_IN_FOLDER_ID,
            "IN"
          );

          if (fileId) {
            anyXmlSaved = true;

            const invoiceKey =
              buildInvoiceKey_(
                inv.issueDate,
                inv.taxCode,
                inv.invoiceNo
              );

            upsertHoaDonFile_(invoiceKey, "XML", fileId);
          }
        });
    }

    // ======================================================
    // 2️⃣ PDF
    for (const att of attachments) {
      if (Date.now() > deadline) {
        debugLog_("Dung xu ly PDF IN de tranh timeout");
        break;
      }

      if (!att.getName().toLowerCase().endsWith(".pdf")) continue;

      const text = extractPdfText_(att.copyBlob());

      if (!isVatInvoicePDF_(text)) {
        debugLog_("⏭ Không phải HĐ GTGT (PDF): " + att.getName());
        continue;
      }

      debugLog_("PDF HĐ GTGT phát hiện: " + att.getName());

      let fileName;
      let meta;

      // ✅ XML đã xử lý → dùng meta XML
      if (sheetWritten && invoices?.length) {

        const inv = invoices?.find(i => i.ok);

        if (!inv) {
          debugLog_("⚠ XML không tìm được invoice hợp lệ");
          continue;
        }

        meta = {
          invoiceDate: inv.issueDate,
          taxCode: inv.taxCode,
          companyName: inv.companyName,
          invoiceNo: inv.invoiceNo
        };

        fileName = buildVatPdfFileName_(meta);

      } else {

        // ⚠ fallback parse PDF
        meta = extractVatMetaFromPDFText_(text);
        fileName = buildVatPdfFileName_(meta);
      }

      const year = getInvoiceYearFromDate_(meta?.invoiceDate) || "UNKNOWN";

      const yearFolder = getOrCreateYearFolder_(
        year,
        CONFIG.INVOICE_IN_FOLDER_ID
      );

      const existed = findFileInFolder_(yearFolder, fileName);

      if (existed) {

        const fileId = existed.getId();

        const invoiceKey =
          buildInvoiceKey_(
            meta.invoiceDate,
            meta.taxCode,
            meta.invoiceNo
          );

        upsertHoaDonFile_(invoiceKey, "PDF", fileId);

        debugLog_("⏭ PDF đã tồn tại – dùng lại: " + fileName);

        pdfSaved = true;
        sourceUsed = "PDF";

        break;
      }

      const fileId = saveInvoicePdfToDrive_(att.copyBlob(), fileName, yearFolder);

      const invoiceKey =
        buildInvoiceKey_(
          meta.invoiceDate,
          meta.taxCode,
          meta.invoiceNo
        );

      upsertHoaDonFile_(invoiceKey, "PDF", fileId);

      pdfSaved = true;

      debugLog_("📁 Đã lưu PDF: " + fileName);

      break;
    }

    // ======================================================
    // 3️⃣ LINK – LAST RESORT
    if (!sheetWritten && !pdfSaved) {
      for (const msg of bodies) {
        if (Date.now() > deadline) {
          debugLog_("Dung xu ly LINK IN de tranh timeout");
          break;
        }

        const links = extractAllLinksFromMessage_(msg);
        if (!links.length) continue;

        for (const link of links) {
          // 🔽 thử tải PDF
          const pdfBlob = tryDownloadPdf_(link); // hàm này bạn đã dự tính sẵn

          if (pdfBlob) {

            const text = extractPdfText_(pdfBlob);
            if (!isVatInvoicePDF_(text)) continue;

            debugLog_("PDF HĐ GTGT phát hiện trong link: " + sanitizeUrlForLog_(link));

            pdfSaved = true;

            const meta = extractVatMetaFromPDFText_(text);
            const fileName = buildVatPdfFileName_(meta);

            const year = getInvoiceYearFromDate_(meta?.invoiceDate) || "UNKNOWN";

            const yearFolder = getOrCreateYearFolder_(year, CONFIG.INVOICE_IN_FOLDER_ID);

            if (fileExistsInFolder_(yearFolder, fileName)) {
              debugLog_("⏭ PDF đã tồn tại – bỏ qua: " + fileName);
              pdfSaved = true; // vẫn coi là đã có PDF
              sourceUsed = "XML->PDF";
              continue;
            }

            const fileId = saveInvoicePdfToDrive_(pdfBlob, fileName, yearFolder);

            const invoiceKey =
              buildInvoiceKey_(
                meta.invoiceDate,
                meta.taxCode,
                meta.invoiceNo
              );

            upsertHoaDonFile_(invoiceKey, "PDF", fileId);

            pdfSaved = true;
            debugLog_("PDF tải từ LINK: " + fileName);

            // ⚠️ LINK chỉ dùng khi XML/PDF đính kèm không có
            // → không ghi sheet ở đây
            sourceUsed = "LINK";
            break;

          } else {
            failedLinks.push(link);
          }
        }

        if (pdfSaved) break;
      }
    }

    // ======================================================
    // 🔗 LƯU LINK KHI:
    // - không có PDF
    // - có link thu thập được

    if (failedLinks.length > 0) {
      const messages = thread.getMessages();
      const firstMsg = messages[0];

      const subject = firstMsg.getSubject();
      const body = firstMsg.getPlainBody();

      // 🔍 Detect thông tin từ email
      const companyName = detectCompanyName_(subject, body);
      const taxCode = detectCompanyTaxCode_(subject, body);
      const invoiceNo = detectInvoiceNo_(subject, body);

      const receivedDate = firstMsg.getDate();
      const yyyyMMdd = Utilities.formatDate(
        receivedDate,
        Session.getScriptTimeZone(),
        "yyyyMMdd"
      );

      const fileName =
        `${yyyyMMdd}_${taxCode}_${companyName}_${invoiceNo}.pdf`;

      const year = receivedDate.getFullYear();
      const yearFolder = getOrCreateYearFolder_(String(year), CONFIG.INVOICE_IN_FOLDER_ID);

      const savedResult = saveInvoiceLinkPdf_(failedLinks, {
        companyName,
        taxCode,
        invoiceNo,
        receivedDate,
        yearFolder
      });

      if (savedResult) {
        linkSaved = true;
        sourceUsed = "LINK_ONLY";
        debugLog_("LINK_ONLY: đã có hoặc đã tạo PDF");
      }
    }

    // ======================================================
    // 🏷 GẮN NHÃN THEO TRẠNG THÁI THỰC TẾ

    if (sheetWritten) {
      debugLog_("IN XML rows prepared; saved-sheet label deferred until commit");
    }

    if (anyXmlSaved) {
      thread.addLabel(saveXmlLabel);
    }

    if (pdfSaved) {
      thread.addLabel(savePdfLabel);
    }

    // ⏳ Pending nếu CHƯA ĐỦ sheet hoặc PDF hoặc XML
    if (!pdfSaved || !anyXmlSaved) {
      thread.addLabel(pendingLabel);
    } else {
      thread.removeLabel(pendingLabel);
    }

    if (linkSaved && !pdfSaved) {
      thread.addLabel(saveLinkLabel);
    }

    debugLog_(
      `IN | rowsPrepared=${sheetWritten} | xml=${anyXmlSaved} | pdf=${pdfSaved} | link=${linkSaved} | source=${sourceUsed || "N/A"}`
    );
    } catch (err) {
      debugLog_("Loi xu ly thread IN: " + (err.stack || err));
      try {
        thread.addLabel(pendingLabel);
      } catch (labelErr) {
        debugLog_("Khong gan duoc pending IN: " + labelErr.message);
      }
    }
  }

  return results;
}
