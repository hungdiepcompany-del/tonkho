// load sheet VietTat 1 lần để dùng chung
function loadVietTatDictionary_() {
  const shVT = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_ABBREVIATIONS);

  if (!shVT) {
    throw new Error("Thiếu sheet :" + CONFIG.SHEET_ABBREVIATIONS);
  }

  if (shVT.getLastRow() < 2) {
    return { dic: new Map(), dicVietTat: new Set() };
  }

  const values = shVT.getRange(
    2, 1,
    shVT.getLastRow() - 1,
    2
  ).getValues();

  const dic = new Map();
  const dicVietTat = new Set();

  values.forEach(([k, v]) => {
    if (!k || !v) return;
    const key = k.toString().trim();
    const val = v.toString().trim().toUpperCase();
    dic.set(key, val);
    dicVietTat.add(val);
  });

  return { dic, dicVietTat };
}

// Chuẩn hóa Số hóa đơn 0000123 -> 123
function normalizeInvoiceNo_(val) {
  if (val === null || val === undefined) return val;

  if (typeof val === 'number') return val;

  const s = val.toString().trim();
  if (/^\d+$/.test(s)) {
    return Number(s); // 000123 → 123
  }

  return s;
}

// Chuan hoa ngay hoa don ve Date object.
// Ho tro: Date, yyyy-MM-dd, yyyy/MM/dd, yyyyMMdd, dd/MM/yyyy, dd-MM-yyyy.
function parseInvoiceDateValue_(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const s = String(value).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) {
    return buildValidDate_(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    return buildValidDate_(Number(m[1]), Number(m[2]), Number(m[3]));
  }

  m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
  if (m) {
    return buildValidDate_(Number(m[3]), Number(m[2]), Number(m[1]));
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function buildValidDate_(year, month, day) {
  const d = new Date(year, month - 1, day);

  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }

  return d;
}

function getInvoiceYearFromDate_(value) {
  const d = parseInvoiceDateValue_(value);
  return d ? d.getFullYear() : null;
}

// Chuẩn hóa Tên khách hàng
const WORD_REGEX = /\S+/g;

function escapeRegExp_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeCustomerName_(txt, dic, dicVietTat) {
  if (typeof txt !== 'string' || !txt.trim()) return txt;

  let out = txt.trim();

  // B1: thay cụm từ
  for (const [k, v] of dic.entries()) {
    const re = new RegExp(escapeRegExp_(k), 'gi');
    out = out.replace(re, v);
  }

  // B2: chuẩn hoá từng từ
  const parts = out.match(WORD_REGEX);
  if (!parts) return out;

  return parts.map(word => {
    const upper = word.toUpperCase();

    if (dicVietTat.has(upper)) {
      return upper;
    }

    return upper.charAt(0) + word.slice(1).toLowerCase();
  }).join(' ');
}

/*
 * Chuẩn hóa nội dung email để phục vụ detect MST / invoice / company
 * - HTML → text
 * - decode entity
 * - bỏ script / style
 * - gộp whitespace
 *
 * @param {GmailMessage} message
 * @returns {string}
 */
function normalizedEmailText_(message) {

  if (!message) return "";

  let html = message.getBody() || "";

  // 1️⃣ Bỏ script + style
  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  // 2️⃣ <br>, <p>, <div> → newline để không dính chữ
  html = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n");

  // 3️⃣ Strip HTML tags
  let text = html.replace(/<[^>]+>/g, " ");

  // 4️⃣ Decode HTML entities (&nbsp; &amp; …)
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  // 5️⃣ Normalize whitespace
  text = text
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/[ \t]{2,}/g, " ");

  // 6️⃣ Trim
  return text.trim();
}

// 🔤 CHUẨN HÓA TEXT ĐỂ SO SÁNH KEYWORD
function normalizeTextForCompare_(text) {
  if (!text) return "";

  return text
    .toString()
    .normalize("NFD")                 // tách dấu Unicode
    .replace(/[\u0300-\u036f]/g, "")  // xoá dấu
    .replace(/đ/g, "d")               // 🔥 QUAN TRỌNG
    .replace(/Đ/g, "D")               // 🔥 QUAN TRỌNG
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")         // bỏ ký tự đặc biệt
    .replace(/\s+/g, " ")             // gộp khoảng trắng
    .trim();
}


// 🔤 CHUẨN HÓA TEXT 
function normalizeHashText_(arr) {
  const cleaned = [...arr];
  while (
    cleaned.length &&
    (cleaned[cleaned.length - 1] === '' ||
      cleaned[cleaned.length - 1] === null)
  ) {
    cleaned.pop();
  }

  return cleaned.map(v => {
    if (v === null || v === undefined || v === '') return '';

    // ✅ Date object → yyyy-MM-dd
    if (v instanceof Date) {
      return Utilities.formatDate(v, 'GMT+7', 'yyyy-MM-dd');
    }

    // ✅ ISO string có time → yyyy-MM-dd
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      return v.slice(0, 10);
    }

    // yyyy/MM/dd → yyyy-MM-dd
    if (typeof v === 'string' && /^\d{4}\/\d{2}\/\d{2}$/.test(v)) {
      return v.replace(/\//g, '-');
    }

    // number → string
    if (typeof v === 'number') {
      return String(v);
    }

    // "00000086" → "86"
    if (typeof v === 'string' && /^\d+$/.test(v)) {
      return String(parseInt(v, 10));
    }

    return String(v)
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }).join('|');
}

function normalizeCompanyForCompare_(s) {
  if (!s) return "";

  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D").replace(/đ/g, "d")
    .toUpperCase()
    .replace(/\b(CONG TY|TNHH|TRACH NHIEM HUU HAN|CO PHAN|CP|TM|SX|THUONG MAI|SAN XUAT|VA)\b/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * Chuẩn hóa số hóa đơn
 * - Pad trái nếu muốn
 * - Hiện tại pad 6 hoặc 8 tùy bạn
 *
 * @param {string} s
 * @returns {string}
 */
// function normalizeInvoiceNo2_(s) {
//   if (!s) return "UNKNOWN_INVOICE";

//   // chỉ chấp nhận chuỗi CHỈ TOÀN SỐ
//   if (!/^\d+$/.test(s)) return "UNKNOWN_INVOICE";

//   // ehoadon / easyinvoice thường 6–8 số
//   return s.padStart(0, "0");
// }
