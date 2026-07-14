function capNhatNhapXuatBQGQ() {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  if (isNXRunning_()) {
    setProgressNX_(100, "BLOCKED_ALREADY_RUNNING: Quy trinh dang chay");
    throw new Error("Quy trinh dang chay, vui long cho hoan tat.");
  }

  if (!lock.tryLock(1000)) {
    setProgressNX_(100, "BLOCKED_ALREADY_RUNNING: Khong lay duoc ScriptLock");
    throw new Error("He thong dang xu ly Nhap-Xuat, thu lai sau.");
  }

  lockAcquired = true;
  setNXRunning_(true);

  try {
    debugLog_("Cap nhat Nhap/Xuat BQGQ");

    resetProgressNX_();
    setProgressNX_(0, "Khoi tao...");

    SpreadsheetApp.getActive().toast("Dang chay...", "Cap nhat BQGQ", 3);
    const t0 = Date.now();

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(CONFIG.SHEET_INVOICE);
    const logSh = getOrCreateASheet_(CONFIG.SHEET_LOG);

    if (!sh) {
      setProgressNX_(100, "FAILED: Thieu sheet Nhap-Xuat");
      throw new Error("Thieu sheet Nhap-Xuat");
    }

    const lastRow = sh.getLastRow();
    if (lastRow < 2) {
      setProgressNX_(100, "COMPLETED: Khong co du lieu");
      return;
    }

    const lastCol = sh.getLastColumn() - 1;
    const dataRange = sh.getRange(2, 2, lastRow - 1, lastCol - 1);
    const data = dataRange.getValues();

    logSh.getRange(2, 1, logSh.getMaxRows(), 2).clearContent();
    logSh.getRange("A1:B1").setValues([["Dong", "Dien giai"]]);

    setProgressNX_(8, "Chuan bi du lieu...");
    setProgressNX_(12, "Dang nhom theo ma hang...");
    const groups = {};
    data.forEach((row, i) => {
      const ma = String(row[3] || "").trim();
      if (!ma) return;
      groups[ma] = groups[ma] || [];
      groups[ma].push(i);
    });

    setProgressNX_(25, "Dang tinh toan BQGQ...");

    const logs = [];
    const keys = Object.keys(groups);
    const TOTAL = keys.length;
    const BATCH = 20;
    const TOTAL_BATCH = Math.max(1, Math.ceil(TOTAL / BATCH));

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
              logs.push([rowIdx + 2, "Xuat vuot ton"]);
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
        `Dang tinh ${Math.min(i + slice.length, TOTAL)}/${TOTAL}`
      );
    }

    setProgressNX_(70, "Chuan bi ghi du lieu...");
    Utilities.sleep(50);
    setProgressNX_(95, "Dang ghi du lieu...");
    dataRange.setValues(data);

    if (logs.length) {
      logSh.getRange(2, 1, logs.length, 2).setValues(logs);
    }

    setProgressNX_(98, "Hoan tat buoc cuoi...");
    setProgressNX_(100, "COMPLETED: Hoan tat");
    PropertiesService.getScriptProperties().deleteProperty("NEED_RECALC_NX");
    SpreadsheetApp.getActive().toast(
      `Da xong (${((Date.now() - t0) / 1000).toFixed(2)}s)`,
      "Cap nhat Nhap/Xuat",
      3
    );
  } catch (err) {
    setProgressNX_(100, "FAILED: " + sanitizeLogValue_(err.message || err));
    throw err;
  } finally {
    setNXRunning_(false);
    if (lockAcquired) {
      lock.releaseLock();
    }
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
