function capNhatNhapXuatBQGQ(requestedRunId) {
  const runId = ProgressService.begin("NX", requestedRunId);
  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  let auditLogs = [];

  if (isNXRunning_()) {
    setProgressNX_(runId, 100, "BLOCKED_ALREADY_RUNNING: Quy trinh dang chay", "BLOCKED");
    throw new Error("Quy trinh dang chay, vui long cho hoan tat.");
  }

  if (!lock.tryLock(1000)) {
    setProgressNX_(runId, 100, "BLOCKED_ALREADY_RUNNING: Khong lay duoc ScriptLock", "BLOCKED");
    throw new Error("He thong dang xu ly Nhap-Xuat, thu lai sau.");
  }

  lockAcquired = true;
  setNXRunning_(true);

  try {
    debugLog_("Cap nhat Nhap/Xuat BQGQ");

    setProgressNX_(runId, 0, "Khoi tao...");

    SpreadsheetApp.getActive().toast("Dang chay...", "Cap nhat BQGQ", 3);
    const t0 = Date.now();

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(CONFIG.SHEET_INVOICE);
    if (!sh) {
      setProgressNX_(runId, 100, "FAILED: Thieu sheet Nhap-Xuat", "FAILED");
      throw new Error("Thieu sheet Nhap-Xuat");
    }

    const lastRow = sh.getLastRow();
    if (lastRow < 2) {
      setProgressNX_(runId, 100, "COMPLETED: Khong co du lieu", "COMPLETED");
      return { runId, status: "COMPLETED" };
    }

    const lastCol = sh.getLastColumn() - 1;
    const dataRange = sh.getRange(2, 2, lastRow - 1, lastCol - 1);
    const data = dataRange.getValues();
    const transactionSequences = sh.getRange(2, 1, lastRow - 1, 1).getValues().flat();

    setProgressNX_(runId, 8, "Chuan bi du lieu...");
    setProgressNX_(runId, 12, "Dang nhom theo ma hang...");
    const groups = {};
    data.forEach((row, i) => {
      const ma = String(row[3] || "").trim();
      if (!ma) return;
      if (!parseInvoiceDateValue_(row[0])) {
        auditLogs.push([runId, "NX", i + 2, "INVALID_ISSUE_DATE"]);
        throw new Error("Ngay hoa don khong hop le tai dong " + (i + 2));
      }
      const sequence = Number(transactionSequences[i]);
      if (!Number.isInteger(sequence) || sequence < 1) {
        auditLogs.push([runId, "NX", i + 2, "INVALID_TRANSACTION_SEQUENCE"]);
        throw new Error("Transaction sequence khong hop le tai dong " + (i + 2));
      }
      groups[ma] = groups[ma] || [];
      groups[ma].push(i);
    });

    Object.keys(groups).forEach(ma => {
      groups[ma].sort((left, right) => {
        const dateDelta = parseInvoiceDateValue_(data[left][0]).getTime() - parseInvoiceDateValue_(data[right][0]).getTime();
        return dateDelta || Number(transactionSequences[left]) - Number(transactionSequences[right]) || left - right;
      });
    });

    setProgressNX_(runId, 25, "Dang tinh toan BQGQ...");

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
              auditLogs.push([runId, "NX", rowIdx + 2, "OVERSELL_BLOCKED"]);
              throw new Error("Xuat vuot ton tai dong " + (rowIdx + 2));
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

      setProgressNX_(runId,
        percent,
        `Dang tinh ${Math.min(i + slice.length, TOTAL)}/${TOTAL}`
      );
    }

    setProgressNX_(runId, 70, "Chuan bi ghi du lieu...");
    Utilities.sleep(50);
    setProgressNX_(runId, 95, "Dang ghi du lieu...");
    dataRange.setValues(data);

    setProgressNX_(runId, 98, "Hoan tat buoc cuoi...");
    setProgressNX_(runId, 100, "COMPLETED: Hoan tat", "COMPLETED");
    PropertiesService.getScriptProperties().deleteProperty("NEED_RECALC_NX");
    SpreadsheetApp.getActive().toast(
      `Da xong (${((Date.now() - t0) / 1000).toFixed(2)}s)`,
      "Cap nhat Nhap/Xuat",
      3
    );
    return { runId, status: "COMPLETED" };
  } catch (err) {
    appendFileLogEntries_(auditLogs);
    setProgressNX_(runId, 100, "FAILED: " + sanitizeLogValue_(err.message || err), "FAILED");
    throw err;
  } finally {
    setNXRunning_(false);
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function setProgressNX_(runId, percent, msg, status) {
  ProgressService.set("NX", runId, percent, msg, status || "RUNNING");
}

function getProgressNX(runId) {
  return ProgressService.get("NX", runId);
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
