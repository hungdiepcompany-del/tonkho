function capNhatNhapXuatBQGQ() {

  if (isNXRunning_()) {
    throw new Error("Quy trình đang chạy, vui lòng chờ hoàn tất.");
  }

  setNXRunning_(true);

  try {
    debugLog_("Cập nhật Nhập/Xuất BGGQ");

    resetProgressNX_();
    setProgressNX_(0, "Khởi tạo...");

    SpreadsheetApp.getActive().toast("Đang chạy...", "Cập nhật BQGQ", 3);
    const t0 = Date.now();

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(CONFIG.SHEET_INVOICE);
    const logSh = getOrCreateASheet_(CONFIG.SHEET_LOG);

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return;

    const lastCol = sh.getLastColumn() - 1; // bỏ cột N
    const dataRange = sh.getRange(2, 2, lastRow - 1, lastCol - 1); // bỏ cột A
    const data = dataRange.getValues();

    // Clear log (giữ header)
    logSh.getRange(2, 1, logSh.getMaxRows(), 2).clearContent();
    logSh.getRange("A1:B1").setValues([["Dòng", "Diễn giải"]]);

    /* =============================
     * 1️⃣ GROUP THEO MÃ HÀNG (E)
     * ============================= */
    setProgressNX_(8, "Chuẩn bị dữ liệu...");

    setProgressNX_(12, "Đang nhóm theo mã hàng...");
    const groups = {};
    data.forEach((row, i) => {
      const ma = String(row[3] || "").trim(); // E
      if (!ma) return;
      groups[ma] = groups[ma] || [];
      groups[ma].push(i);
    });

    /* =============================
     * 2️⃣ XỬ LÝ BQGQ (CHUNK)
     * ============================= */
    setProgressNX_(25, "Đang tính toán BQGQ...");

    const logs = [];

    const keys = Object.keys(groups);
    const TOTAL = keys.length;
    const BATCH = 20;
    const TOTAL_BATCH = Math.ceil(TOTAL / BATCH);

    for (let i = 0; i < TOTAL; i += BATCH) {
      const slice = keys.slice(i, i + BATCH);

      slice.forEach(ma => {
        let slTon = 0;
        let gTon = 0;
        let dgbq = 0;

        groups[ma].forEach(rowIdx => {
          const row = data[rowIdx];
          const loai = String(row[5] || "").toUpperCase();
          let sl = Number(row[6]) || 0;
          const dgNhap = Number(row[7]) || 0;

          if (loai === "NHAP") {
            const gt = sl * dgNhap;
            slTon += sl;
            gTon += gt;
            dgbq = slTon ? gTon / slTon : 0;
            row[8] = gt;
          } else if (loai === "XUAT") {
            if (sl > slTon) {
              logs.push([rowIdx + 2, "Xuất vượt tồn"]);
              sl = slTon;
            }
            row[7] = dgbq;
            row[8] = sl * dgbq;
            slTon -= sl;
            gTon = slTon * dgbq;

            if (slTon <= 0) {
              slTon = 0;
              gTon = 0;
              dgbq = 0;
            }
          }

          row[9] = dgbq;
          row[10] = slTon;
          row[11] = gTon;
        });
      });

      const batchIndex = Math.floor(i / BATCH) + 1;
      const percent = 15 + Math.round((batchIndex / TOTAL_BATCH) * 75);

      setProgressNX_(
        percent,
        `Đang tính ${Math.min(i + slice.length, TOTAL)}/${TOTAL}`
      );

      // // ⭐ sleep THÔNG MINH: không làm chậm tổng thời gian
      // if (batchIndex % 2 === 0) {
      //   Utilities.sleep(100);
      // }
    }

    /* =============================
     * 3️⃣ GHI NGƯỢC & LOG
     * ============================= */
    setProgressNX_(70, "Chuẩn bị ghi dữ liệu...");
    Utilities.sleep(50);
    setProgressNX_(95, "Đang ghi dữ liệu...");
    dataRange.setValues(data);

    if (logs.length) {
      logSh.getRange(2, 1, logs.length, 2).setValues(logs);
    }

    setProgressNX_(98, "Hoàn tất bước cuối...");

    setProgressNX_(100, "Hoàn tất 🎉");
    PropertiesService.getScriptProperties().deleteProperty("NEED_RECALC_NX");
    SpreadsheetApp.getActive().toast(
      `✅ Đã xong (${((Date.now() - t0) / 1000).toFixed(2)}s)`,
      "Cập nhật Nhập/Xuất",
      3
    );
  } finally {
    // 🔐 đảm bảo mở khóa kể cả khi lỗi
    setNXRunning_(false);
  }
}

function resetProgressNX_() {
  ProgressService.reset("NX");
}

function setProgressNX_(percent, msg) {
  ProgressService.set("NX", percent, msg);
}

function getProgressNX() {
  return ProgressService.get("NX"); // null nếu chưa start
}

function isNXRunning_() {
  return CacheService
    .getScriptCache()
    .get("NX_RUNNING") === "1";
}

function setNXRunning_(flag) {
  const cache = CacheService.getScriptCache();
  if (flag) {
    cache.put("NX_RUNNING", "1", 300); // sống tối đa 5 phút
  } else {
    cache.remove("NX_RUNNING");
  }
}

