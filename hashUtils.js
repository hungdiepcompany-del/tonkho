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
  const safeStats = ensureCommitStats_(stats);

  return items.map(item => {
    const { type, row } = item;
    const bucket = ensureCommitStatsBucket_(safeStats, type);

    if (!row) return { ...item, status: 'skip' };

    const hash = row[CONFIG.NHAPXUAT_INDEX.hash];

    if (!hash) return { ...item, status: 'skip' };

    if (existed.has(hash)) {
      safeStats.duplicateExisting++;
      bucket.duplicate++;
      return { ...item, status: 'duplicated' };
    }

    if (batchSet.has(hash)) {
      safeStats.duplicateBatch++;
      bucket.duplicate++;
      return { ...item, status: 'duplicated' };
    }

    batchSet.add(hash);
    safeStats.accepted++;
    bucket.accepted++;
    return { ...item, status: 'accepted' };
  });
}

function ensureCommitStats_(stats) {
  return stats || {
    scanned: 0,
    in: { scanned: 0, accepted: 0, duplicate: 0 },
    out: { scanned: 0, accepted: 0, duplicate: 0 },
    duplicateExisting: 0,
    duplicateBatch: 0,
    accepted: 0,
    emptyHash: 0,
    hashed: 0
  };
}

function ensureCommitStatsBucket_(stats, type) {
  const key = String(type || "").toLowerCase() === "out" ? "out" : "in";
  stats[key] = stats[key] || { scanned: 0, accepted: 0, duplicate: 0 };
  return stats[key];
}

function prepareInvoiceRowsForCommit_(items, stats, options = {}) {
  const safeStats = ensureCommitStats_(stats);
  const { dic, dicVietTat } = loadVietTatDictionary_();
  const debugPrefix = options.debugPrefix || "COMMIT";

  const rowsWithHash = (items || []).map((item, i) => {
    const r = item.row || [];
    const type = item.type || (String(r[5] || "").toUpperCase() === "XUAT" ? "OUT" : "IN");
    const bucket = ensureCommitStatsBucket_(safeStats, type);
    bucket.scanned++;

    const invoiceKey =
      r[CONFIG.NHAPXUAT_INDEX.invoiceKey] ||
      r[8] ||
      item.invoiceKey ||
      "";

    const customerName = normalizeCustomerName_(r[2], dic, dicVietTat);

    const values = {
      invoiceDate: r[0],
      invoiceNo: r[1],
      customerName,
      itemCode: r[3],
      itemName: r[4],
      invoiceType: r[5],
      qty: r[6]
    };

    const hash = buildInvoiceItemHash_(
      values,
      CONFIG.DEBUG_HASH ? `${debugPrefix} ${type} row ${i + 1}` : ""
    );

    if (!hash) safeStats.emptyHash++;
    else safeStats.hashed++;

    const rowOut = [];
    rowOut[CONFIG.NHAPXUAT_INDEX.invoiceDate] = r[0];
    rowOut[CONFIG.NHAPXUAT_INDEX.invoiceNo] = r[1];
    rowOut[CONFIG.NHAPXUAT_INDEX.customerName] = customerName;
    rowOut[CONFIG.NHAPXUAT_INDEX.itemCode] = r[3];
    rowOut[CONFIG.NHAPXUAT_INDEX.itemName] = r[4];
    rowOut[CONFIG.NHAPXUAT_INDEX.invoiceType] = r[5];
    rowOut[CONFIG.NHAPXUAT_INDEX.qty] = r[6];
    rowOut[CONFIG.NHAPXUAT_INDEX.price] = r[7];
    rowOut[CONFIG.NHAPXUAT_INDEX.hash] = hash;
    rowOut[CONFIG.NHAPXUAT_INDEX.invoiceKey] = invoiceKey;

    return {
      ...item,
      type,
      row: rowOut,
      invoiceKey,
      sourceKey: buildCommitSourceKey_(item, invoiceKey, i),
      writeStatus: "NOT_ATTEMPTED",
      errorCode: ""
    };
  });

  return filterRowsByHashIndex_(rowsWithHash, safeStats);
}

function buildCommitSourceKey_(item, invoiceKey, index) {
  if (item.sourceKey) return item.sourceKey;
  if (item.thread && typeof item.thread.getId === "function") {
    return "THREAD:" + item.thread.getId() + ":" + (invoiceKey || index);
  }
  return (invoiceKey ? "INVOICE:" + invoiceKey : "ROW:" + index);
}

function commitPreparedInvoiceRows_(processed) {
  const rowsToWrite = (processed || [])
    .filter(x => x.status === "accepted")
    .map(x => x.row);

  let writeError = null;

  if (rowsToWrite.length) {
    try {
      writeInvoicesToSheet_(rowsToWrite);
    } catch (err) {
      writeError = err;
      debugLog_("LOI GHI SHEET: " + (err.message || err));
    }
  }

  return (processed || []).map(item => {
    if (item.status === "duplicated") {
      return { ...item, writeStatus: "ALREADY_COMMITTED", errorCode: "" };
    }
    if (item.status === "accepted") {
      return writeError
        ? { ...item, writeStatus: "FAILED", errorCode: "WRITE_FAILED" }
        : { ...item, writeStatus: "COMMITTED", errorCode: "" };
    }
    return { ...item, writeStatus: "NOT_ATTEMPTED", errorCode: item.errorCode || "SKIPPED" };
  });
}

function projectCommitLabelsByThread_(commitResults) {
  const byThread = new Map();

  (commitResults || []).forEach(item => {
    if (!item.thread) return;
    const arr = byThread.get(item.thread) || [];
    arr.push(item);
    byThread.set(item.thread, arr);
  });

  byThread.forEach((items, thread) => {
    const eligible = items.filter(x =>
      x.writeStatus === "COMMITTED" ||
      x.writeStatus === "ALREADY_COMMITTED" ||
      x.writeStatus === "FAILED" ||
      x.writeStatus === "NOT_ATTEMPTED"
    );
    const allCommitted = eligible.length > 0 && eligible.every(x =>
      x.writeStatus === "COMMITTED" ||
      x.writeStatus === "ALREADY_COMMITTED"
    );
    setExclusiveLabel_(thread, allCommitted ? "SAVED_SHEET" : "PENDING");
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
