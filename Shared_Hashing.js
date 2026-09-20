/* D6K-B shared hashing helpers. Global names are preserved for Apps Script compatibility. */

function buildHashFromText_(text) {
  if (!text) return null;

  const normalized = String(text)
    .replace(/\s+/g, ' ') // gộp space
    .trim();

  if (!normalized) return null;

  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    normalized,
    Utilities.Charset.UTF_8
  );

  return bytes
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('');
}

function buildInvoiceItemHash_(values, debugTag = '') {
  const fields = [
    'invoiceDate',
    'invoiceNo',
    'customerName',
    'itemCode',
    'itemName',
    'invoiceType',
    'qty'
  ];

  const rawArr = fields.map(k => values[k]);
  const text = normalizeHashText_(rawArr);

  return buildHashFromText_(text);
}

function buildInvoiceKeyV2_(issueDate, sellerTaxCode, invoiceSymbol, invoiceNo) {
  const parsedDate = parseInvoiceDateValue_(issueDate);
  if (!parsedDate) throw new Error("Ngay hoa don khong hop le: " + issueDate);

  const date = Utilities.formatDate(parsedDate, Session.getScriptTimeZone(), "yyyyMMdd");
  const taxCode = String(sellerTaxCode || "").replace(/\D/g, "");
  const symbol = String(invoiceSymbol || "").trim().toUpperCase();
  const normalizedInvoiceNo = String(normalizeInvoiceNo_(invoiceNo)).trim();
  if (!taxCode || !symbol || !normalizedInvoiceNo) {
    throw new Error("InvoiceKeyV2 thieu sellerTaxCode, invoiceSymbol hoac invoiceNo");
  }
  return [taxCode, symbol, normalizedInvoiceNo, date].join("_");
}

function buildLineIdentityV2_(values) {
  const invoiceKeyV2 = String(values && values.invoiceKeyV2 || "").trim();
  const sourceLineNo = Number(values && values.sourceLineNo || 0);
  if (!invoiceKeyV2 || !Number.isInteger(sourceLineNo) || sourceLineNo < 1) {
    throw new Error("LineIdentityV2 thieu invoiceKeyV2 hoac sourceLineNo");
  }

  const canonical = [
    invoiceKeyV2,
    sourceLineNo,
    normalizeIdentityText_(values.rawItemName),
    normalizeIdentityText_(values.unit),
    normalizeIdentityNumber_(values.quantity),
    normalizeIdentityNumber_(values.unitPrice),
    normalizeIdentityNumber_(values.amount)
  ].join("|");
  return buildHashFromText_(canonical);
}
