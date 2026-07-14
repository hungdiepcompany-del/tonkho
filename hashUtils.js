/* =========================================
 * LẤY TOÀN BỘ HASHINDEX TRONG SHEET (CỘT N)
 * ========================================*/
function getExistingHashIndex_() {
  const sheet = SpreadsheetApp
    .getActive()
    .getSheetByName(CONFIG.SHEET_INVOICE);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();

  const values = sheet
    .getRange(2, CONFIG.HASH_COLUME, lastRow - 1, 1)
    .getValues()
    .flat()
    .filter(Boolean);

  return new Set(values);
}

/* ========================
 * LỌC TRÙNG LẶP
 * ========================*/
function filterRowsByHashIndex_(items, stats) {
  const existed = getExistingHashIndex_();
  const batchSet = new Set();

  return items.map(item => {
    const { type, row } = item;

    if (!row) return { ...item, status: 'skip' };

    const hash = row[CONFIG.NHAPXUAT_INDEX.hash];
    const bucket = stats[type.toLowerCase()];

    if (!hash) return { ...item, status: 'skip' };

    if (existed.has(hash)) {
      stats.duplicateExisting++;
      bucket.duplicate++;
      return { ...item, status: 'duplicated' };
    }

    if (batchSet.has(hash)) {
      stats.duplicateBatch++;
      bucket.duplicate++;
      return { ...item, status: 'duplicated' };
    }

    batchSet.add(hash);
    stats.accepted++;
    bucket.accepted++;
    return { ...item, status: 'accepted' };
  });
}

/*
 * Core hash function – DÙNG CHUNG TOÀN HỆ THỐNG
 * @param {string} text
 * @returns {string|null}
 */
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

/*
 * TẠO HASH CHO CÁC DÒNG từ cột CONFIG.HASH_COLUME_BEGIN đến CONFIG.HASH_COLUME_END
 * Chỉ dùng hàm này chạy bằng tay khi có sẵn dữ liệu mà chưa có hash trong bảng
 */
function generateHashForExistingRows_() {
  const sh = SpreadsheetApp.getActive()
    .getSheetByName(CONFIG.SHEET_INVOICE);

  if (!sh) {
    debugLog_("Không tìm thấy sheet " + CONFIG.SHEET_INVOICE);
    return;
  }

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return;

  const numRows = lastRow - 1;

  const dataRange = sh.getRange(
    2,
    CONFIG.HASH_COLUME_BEGIN,
    numRows,
    CONFIG.HASH_COLUME_END
  );
  const dataValues = dataRange.getValues();

  const hashRange = sh.getRange(
    2,
    CONFIG.HASH_COLUME,
    numRows,
    1
  );
  const hashValues = hashRange.getValues();

  let updated = false;

  for (let i = 0; i < numRows; i++) {
    const row = dataValues[i];

    // ĐÚNG 7 FIELD HASH
    const values = {
      invoiceDate: row[0],    // Ngày lập HĐ
      invoiceNo: row[1],      // Số HĐ
      customerName: row[2],  // Tên khách hàng
      itemCode: row[3],      // Mã hàng
      itemName: row[4],      // Tên hàng
      invoiceType: row[5],   // XUAT / NHAP
      qty: row[6]             // Số lượng
    };

    // HASH DUY NHẤT
    const hash = buildInvoiceItemHash_(
      values,
      `SHEET | row ${i + 2}`
    );

    if (!hash) {
      if (hashValues[i][0]) {
        hashValues[i][0] = "";
        updated = true;
      }
      continue;
    }

    hashValues[i][0] = hash;
    updated = true;
  }

  if (updated) {
    hashRange.setValues(hashValues);
  }
}
