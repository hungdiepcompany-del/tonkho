/* =================================================
 * 🏢 DETECT COMPANY NAME (SUBJECT → BODY)
 * =================================================
 *
 * RULES (THEO ĐÚNG YÊU CẦU):
 * 1️⃣ Chỉ lấy cụm VIẾT HOA TOÀN BỘ
 * 2️⃣ Phải bắt đầu bằng "CÔNG TY"
 * 3️⃣ Nếu trùng CONFIG.MY_COMPANY → loại
 * 4️⃣ SUBJECT FAIL → BODY
 */
function detectCompanyName_(subject, bodyText) {

  const myNorm = normalizeCompanyForCompare_(CONFIG.MY_COMPANY);

  function findInText_(text) {
    if (!text) return null;

    // chỉ match cụm ĐÃ VIẾT HOA SẴN
    const matches = text.match(
      /\bCÔNG TY(?:\s+[\p{Lu}0-9.,\-&()]+){2,}\b/gu
    );

    if (!matches) return null;

    for (const raw of matches) {

      const clean = raw
        .replace(/\s+/g, " ")
        .trim();

      const norm = normalizeCompanyForCompare_(clean);

      //loại công ty của mình
      if (isSameCompany_(norm, myNorm)) {
        continue;
      }

      // hợp lệ
      return clean;
    }

    return null;
  }

  /* 1️⃣ SUBJECT */
  const fromSubject = findInText_(subject || "");
  if (fromSubject) return fromSubject;

  /* 2️⃣ BODY */
  const fromBody = findInText_(bodyText || "");
  if (fromBody) return fromBody;

  return "UNKNOWN_COMPANY";
}

function isSameCompany_(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  return false;
}
/* =================================================
 * 🧾 INVOICE NUMBER DETECTOR
 * =================================================
 *
 * Rules:
 * - Ưu tiên SUBJECT → BODY
 * - Phải đi kèm keyword:
 *   "Hóa đơn số", "Số hóa đơn", "Hóa đơn điện tử số"
 * - CHỈ chấp nhận số (0–9)
 * - Có chữ → loại
 */

/*
 * Detect invoice number from subject / body
 *
 * @param {string} subject
 * @param {string} bodyText
 * @returns {string NULL}
 */
function detectInvoiceNo_(subject, bodyText) {

  // Keyword chung
  const REGEX = /(Hóa\s*đơn\s*(?:điện\s*tử\s*)?số|Số\s*hóa\s*đơn)\s*[:\-]?\s*([A-Za-z0-9\-]+)/i;

  /* 1️⃣ SUBJECT */
  if (subject) {
    const m = subject.match(REGEX);
    if (m) {
      const rawNo = m[2].trim();

      // có chữ → loại
      if (/^[0-9]+$/.test(rawNo)) {
        return normalizeInvoiceNo_(rawNo);
      }
    }
  }

  /* 2️⃣ BODY */
  if (bodyText) {
    const m = bodyText.match(REGEX);
    if (m) {
      const rawNo = m[2].trim();

      if (/^[0-9]+$/.test(rawNo)) {
        return normalizeInvoiceNo_(rawNo);
      }
    }
  }

  /* 3️⃣ FAIL */
  return null;
}

/*
 * 🔎 Detect MST (10 hoặc 13 số) từ SUBJECT / BODY
 *
 * Rules:
 * - Có tiền tố: Mã số thuế | MST | Mã số doanh nghiệp | MSDN
 * - MST chỉ chứa số
 * - 10 hoặc 13 số
 * - Ưu tiên SUBJECT → BODY
 * - Loại trừ MST của chính mình (CONFIG.MY_TAXCODE)
 *
 * @param {string} subject
 * @param {string} bodyText
 * @returns {string}
 */
function detectCompanyTaxCode_(subject, bodyText) {

  const myTaxCode = String(CONFIG.MY_TAXCODE || "").trim();

  /**
   * Scan text để tìm MST hợp lệ
   */
  const scan = (text) => {
    if (!text) return null;

    const regex =
      /(MÃ SỐ THUẾ|MST|MÃ SỐ DOANH NGHIỆP|MSDN)\s*[:\-]?\s*(\d{10}|\d{13})/gi;

    let match;
    while ((match = regex.exec(text)) !== null) {
      const mst = match[2];

      // loại MST của mình
      if (myTaxCode && mst === myTaxCode) {
        continue;
      }

      return mst;
    }

    return null;
  };

  /* 1️⃣ SUBJECT */
  let mst = scan(subject);
  if (mst) return mst;

  /* 2️⃣ BODY */
  mst = scan(bodyText);
  if (mst) return mst;

  /* 3️⃣ FALLBACK */
  return "UNKNOWN_MST";
}