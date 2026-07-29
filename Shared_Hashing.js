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
