/* D6K-B shared normalization helpers. Global names are preserved for Apps Script compatibility. */

const WORD_REGEX = /\S+/g;

function normalizeInvoiceNo_(val) {
  if (val === null || val === undefined) return val;

  if (typeof val === 'number') return val;

  const s = val.toString().trim();
  if (/^\d+$/.test(s)) {
    return Number(s); // 000123 → 123
  }

  return s;
}

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

function escapeRegExp_(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
