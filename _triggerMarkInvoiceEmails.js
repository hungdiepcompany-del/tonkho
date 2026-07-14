/* =================================================
 * QUÉT EMAIL HÓA ĐƠN IN + OUT (SMART TRIGGER)
 * Đã tối ưu tốc độ 2026-02-02
 * ================================================= */
function guardTrigger_() {
  assertTriggerSignature_();
  assertAntiReplayTrigger_();
  assertTriggerMinuteSignature_();
}

function triggerMarkAllInvoiceEmails(e) {
  guardTrigger_();

  // Gmail lọc thô (KHÔNG phân biệt inbox / sent) 
  // Bỏ qua các email đã gắn nhãn INVOICE_IN_LABEL, INVOICE_OUT_LABEL
  const query = `
  after:${CONFIG.INVOICE_FROMDATE}
  -from:@google.com
  -label:"${CONFIG.INVOICE_IN_LABEL}"
  -label:"${CONFIG.INVOICE_OUT_LABEL}"
  (${CONFIG.INVOICE_KEYWORDS.map(k => `"${k}"`).join(" OR ")})
`.trim();

  debugLog_(Logger.log(query));
  debugLog_("Preview threads: " + GmailApp.search(query, 0, 5).length);

  const inLabel = getOrCreateLabel_(CONFIG.INVOICE_IN_LABEL);
  const outLabel = getOrCreateLabel_(CONFIG.INVOICE_OUT_LABEL);

  let totalIn = 0;
  let totalOut = 0;
  const deadline = Date.now() + 4.5 * 60 * 1000;
  const maxThreads = Number(CONFIG.MAX_THREADS) || 30;
  const threads = GmailApp.search(query, 0, maxThreads);

    for (const thread of threads) {
      if (Date.now() > deadline) {
        debugLog_("Dung triggerMarkAllInvoiceEmails de tranh timeout");
        break;
      }

      try {
      const messages = thread.getMessages();

      let detectedType = null; // "IN" | "OUT"

      for (const msg of messages) {
        const from = msg.getFrom()?.toLowerCase() || "";

        // HÓA ĐƠN XUẤT
        if (from.includes(CONFIG.MY_EMAIL)) {
          if (isOutgoingInvoice_(msg)) {
            detectedType = "OUT";
            break;
          }
        }
      }

      // nếu chưa detect OUT mới quét IN
      // HÓA ĐƠN NHẬP
      if (!detectedType) {
        for (const msg of messages) {
          if (isIncomingInvoice_(msg)) {
            detectedType = "IN";
            break;
          }
        }
      }

      if (!detectedType) continue;

      // GẮN NHÃN THEO LOẠI
      if (detectedType === "OUT") {
        outLabel.addToThread(thread);
        totalOut++;
      } else {
        inLabel.addToThread(thread);
        totalIn++;
      }

      thread.markImportant();
      messages.forEach(m => m.star());
      } catch (err) {
        debugLog_("Loi gan nhan email: " + (err.stack || err));
      }
    }

  debugLog_(
    `Hoàn tất quét hóa đơn từ ${CONFIG.INVOICE_FROMDATE} | IN: ${totalIn} | OUT: ${totalOut}`
  );
}

function getNormalizedFromTrigger_() {
  return {
    INVOICE: CONFIG.INVOICE_KEYWORDS.map(normalizeTextForCompare_),
    EXCLUDED: (CONFIG.EXCLUDED_KEYWORDS || []).map(normalizeTextForCompare_)
  };
}

// HÀM NHẬN DIỆN HÓA ĐƠN XUẤT (OUT)
function isOutgoingInvoice_(msg) {
  const from = msg.getFrom()?.toLowerCase() || "";
  if (!from.includes(CONFIG.MY_EMAIL.toLowerCase())) return false;

  return isInvoiceContent_(
    msg.getSubject(),
    () => msg.getBody(),          // bodyGetter
    () => msg.getAttachments()    // attachmentsGetter
  );
}

// HÀM NHẬN DIỆN HÓA ĐƠN NHẬP (IN)
function isIncomingInvoice_(msg) {
  const from = msg.getFrom();
  if (isExcludedSender_(from)) {
    debugLog_("Loại bỏ email từ người gửi: " + from);
    return false;
  }

  return isInvoiceContent_(
    msg.getSubject(),
    () => msg.getBody(),          // bodyGetter
    () => msg.getAttachments()    // attachmentsGetter
  );
}

// // NHẬN DIỆN TIÊU ĐỀ & NỘI DUNG HÓA ĐƠN (DÙNG CHUNG)
// function isInvoiceContent_(subject, bodyGetter) {
//   const sub = normalizeTextForCompare_(subject || "");

//   const NORMALIZED = getNormalizedFromTrigger_();

//   // loại ngay
//   if (NORMALIZED.EXCLUDED.some(k => sub.includes(k))) return false;

//   // subject đủ
//   if (NORMALIZED.INVOICE.some(k => sub.includes(k))) return true;

//   // ⏱ fallback mới đọc body
//   const body = bodyGetter?.();
//   if (!body) return false;

//   const bodyNorm = normalizeTextForCompare_(body);

//   if (NORMALIZED.EXCLUDED.some(k => bodyNorm.includes(k))) return false;

//   return NORMALIZED.INVOICE.some(k => bodyNorm.includes(k));
// }

// NHẬN DIỆN MAIL HÓA ĐƠN VAT (DÙNG CHO TRIGGER GẮN NHÃN)
function isInvoiceContent_(subject, bodyGetter, attachmentsGetter) {
  const sub = normalizeTextForCompare_(subject || "");
  const NORMALIZED = getNormalizedFromTrigger_();

  // loại ngay nếu subject chứa từ loại trừ
  if (NORMALIZED.EXCLUDED.some(k => sub.includes(k))) {
    debugLog_("Đã loại trừ email: " + subject);
    return false;
  }

  // ==========================
  // SUBJECT (nhẹ nhất)
  // ==========================
  if (NORMALIZED.INVOICE.some(k => sub.includes(k))) {
    debugLog_("Nhận diện hóa đơn VAT từ tiêu đề email");
    debugLog_(subject);
    return true;
  }

  const atts = attachmentsGetter?.() || [];

  // ==========================
  // XML (ưu tiên cao vì chính xác)
  // ==========================
  for (const att of atts) {
    const name = String(att.getName() || "").toLowerCase();
    if (!name.endsWith(".xml")) continue;

    try {
      const doc = loadXmlDocument_(att);
      const meta = extractXmlMeta_(doc);

      if (isVatInvoiceXML_(meta)) {
        debugLog_("Nhận diện hóa đơn VAT từ XML: " + att.getName());
        return true;
      }
    } catch (err) {
      Logger.log("⚠ Lỗi đọc XML: " + err);
    }
  }

  // ==========================
  // BODY (nhẹ hơn PDF)
  // ==========================
  const body = bodyGetter?.();
  if (body) {
    const bodyNorm = normalizeTextForCompare_(body);

    if (!NORMALIZED.EXCLUDED.some(k => bodyNorm.includes(k)) &&
      NORMALIZED.INVOICE.some(k => bodyNorm.includes(k))) {
      debugLog_("Nhận diện hóa đơn VAT từ nội dung email");
      debugLog_(body);
      return true;
    }
  }

  // ==========================
  // PDF (nặng nhất → cuối)
  // ==========================
  for (const att of atts) {
    if (att.getContentType() !== "application/pdf") continue;

    try {
      // 📌 Đọc text PDF
      const text = extractPdfText_(att.copyBlob());

      if (isVatInvoicePDF_(text)) {
        debugLog_("Nhận diện hóa đơn VAT từ PDF: " + att.getName());
        return true;
      }
    } catch (err) {
      debugLog_("Lỗi đọc PDF: " + err);
    }
  }

  return false;
}

// KIỂM TRA NGƯỜI GỬI CÓ BỊ LOẠI TRỪ KHÔNG
function isExcludedSender_(from) {
  if (!from) return false;

  const fromLower = from.toLowerCase();

  // Hỗ trợ cả dạng nâng cao và array phẳng
  if (typeof CONFIG.EXCLUDED_SENDERS === "object") {
    const { EMAILS = [], DOMAINS = [] } = CONFIG.EXCLUDED_SENDERS;
    const senderDomain = extractSenderDomain_(fromLower);

    if (EMAILS.some(e => fromLower.includes(e.toLowerCase()))) {
      return true;
    }

    if (DOMAINS.some(d => {
      const domain = String(d || "").toLowerCase().trim();
      return senderDomain === domain || senderDomain.endsWith("." + domain);
    })) {
      return true;
    }

    return false;
  }

  if (Array.isArray(CONFIG.EXCLUDED_SENDERS)) {
    return CONFIG.EXCLUDED_SENDERS.some(e =>
      fromLower.includes(e.toLowerCase())
    );
  }

  return false;
}

function extractSenderDomain_(from) {
  const match = String(from || "").match(/@([^>\s]+)/);
  return match ? match[1].replace(/[>"')\]]+$/g, "").toLowerCase() : "";
}
