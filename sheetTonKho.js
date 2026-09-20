function capNhatTonKho(ngayDen, requestedRunId) {
  const runId = ProgressService.begin("TK", requestedRunId);
  let auditLogs = [];

  if (isTKRunning_()) {
    setProgressTK_(runId, 100, "BLOCKED_ALREADY_RUNNING: Dang cap nhat ton kho", "BLOCKED");
    throw new Error("Dang cap nhat ton kho, vui long cho...");
  }

  const lock = LockService.getScriptLock();
  let lockAcquired = false;
  if (!lock.tryLock(1000)) {
    setProgressTK_(runId, 100, "BLOCKED_ALREADY_RUNNING: Khong lay duoc ScriptLock", "BLOCKED");
    throw new Error("He thong dang xu ly ton kho, thu lai sau.");
  }
  lockAcquired = true;

  setTKRunning_(true);

  try {
    debugLog_("START capNhatTonKho");

    setProgressTK_(runId, 0, "Khởi tạo tồn kho...");

    const t0 = Date.now();

    const ss = SpreadsheetApp.getActive();
    const shNX = ss.getSheetByName(CONFIG.SHEET_INVOICE);
    const shTK = ss.getSheetByName(CONFIG.SHEET_TONKHO);
    const shMH = ss.getSheetByName(CONFIG.SHEET_ITEMCODE);
    if (!shNX || !shTK || !shMH) {
      setProgressTK_(runId, 100, "FAILED: Thieu sheet bat buoc", "FAILED");
      throw new Error("Thieu sheet bat buoc");
    }

    /* ================= READ DATA ================= */
    setProgressTK_(runId, 5, "Đọc dữ liệu...");

    const lastRowNX = shNX.getLastRow();
    if (lastRowNX < 2) {
      setProgressTK_(runId, 100, "COMPLETED: Khong co du lieu", "COMPLETED");
      return { runId, status: "COMPLETED" };
    }

    const nxData = shNX
      .getRange(2, 1, lastRowNX - 1, 13)
      .getValues();

    nxData.forEach((row, index) => {
      if (!parseInvoiceDateValue_(row[1])) {
        auditLogs.push([runId, "TK", index + 2, "INVALID_ISSUE_DATE"]);
        throw new Error("Ngay hoa don khong hop le tai dong " + (index + 2));
      }
      const sequence = Number(row[0]);
      if (!Number.isInteger(sequence) || sequence < 1) {
        auditLogs.push([runId, "TK", index + 2, "INVALID_TRANSACTION_SEQUENCE"]);
        throw new Error("Transaction sequence khong hop le tai dong " + (index + 2));
      }
    });
    nxData.sort((left, right) => {
      const dateDelta = parseInvoiceDateValue_(left[1]).getTime() - parseInvoiceDateValue_(right[1]).getTime();
      return dateDelta || Number(left[0]) - Number(right[0]);
    });

    const mhData = shMH.getDataRange().getValues();

    /* ================= MAP MÃ HÀNG ================= */
    setProgressTK_(runId, 10, "Ánh xạ mã hàng...");

    const tenHang = {};
    const dvtHang = {};

    mhData.slice(1).forEach(r => {
      const ma = String(r[0] || "").trim();
      if (ma) {
        tenHang[ma] = r[1] || "";
        dvtHang[ma] = r[2] || "";
      }
    });

    /* ================= TÍNH TỒN ================= */
    setProgressTK_(runId, 15, "Tính tồn kho...");

    SpreadsheetApp.getActive()
      .toast("Đang tính tồn kho theo BQGQ...", "Tồn kho", 3);

    const slTon = {};
    const gtTon = {};
    const dgBQ = {};

    let ngayMax = new Date(0);
    const TOTAL = nxData.length;
    const BATCH = 50;

    const PROGRESS_START = 15;
    const PROGRESS_END = 70;

    for (let i = 0; i < TOTAL; i += BATCH) {
      const slice = nxData.slice(i, i + BATCH);

      slice.forEach((row, idx) => {
        const realIdx = i + idx;

        const ngay = row[1] instanceof Date ? row[1] : null;
        if (ngay && ngay > ngayMax) ngayMax = ngay;
        if (ngayDen && ngay && ngay > ngayDen) return;

        const ma = String(row[4] || "").trim();
        if (!ma) return;

        const loai = String(row[6] || "").toUpperCase();
        if (loai !== "NHAP" && loai !== "XUAT") return;

        const sl = Number(row[7]) || 0;

        if (!(ma in slTon)) {
          slTon[ma] = 0;
          gtTon[ma] = 0;
          dgBQ[ma] = 0;
        }

        if (loai === "NHAP") {
          const dg = Number(row[8]) || 0;
          const gt = sl * dg;
          slTon[ma] += sl;
          gtTon[ma] += gt;
          dgBQ[ma] = slTon[ma] ? gtTon[ma] / slTon[ma] : 0;
        } else {
          const gt = sl * dgBQ[ma];
          if (sl <= slTon[ma]) {
            slTon[ma] -= sl;
            gtTon[ma] -= gt;
          } else {
            auditLogs.push([runId, "TK", Number(row[0]), "OVERSELL_BLOCKED:" + ma]);
            throw new Error("Xuat vuot ton tai transaction sequence " + row[0]);
          }
        }
      });

      // ✅ FIX PROGRESS – KHÔNG RESET, KHÔNG GIẬT
      const done = Math.min(i + slice.length, TOTAL);
      const percent = PROGRESS_START + Math.round(
        (done / TOTAL) * (PROGRESS_END - PROGRESS_START)
      );

      setProgressTK_(runId,
        percent,
        `Đang tổng hợp tồn kho ${done}/${TOTAL}`
      );
    }

    /* ================= BUILD OUTPUT ================= */
    setProgressTK_(runId, 70, "Đã tính xong tồn kho");

    const keys = Object.keys(slTon).sort();
    const output = keys.map(ma => ([
      ma,
      tenHang[ma] || "#LOI",
      dvtHang[ma] || "#LOI",
      slTon[ma],
      gtTon[ma],
      slTon[ma] ? gtTon[ma] / slTon[ma] : 0
    ]));

    /* ================= WRITE DATA ================= */
    setProgressTK_(runId, 85, "Ghi dữ liệu tồn kho...");

    const START_ROW_OUTPUT = 2;
    const COL_COUNT = 6;

    const totalRow = findTotalRow_(shTK);
    const dataEndRow = totalRow ? totalRow - 1 : shTK.getLastRow();

    const oldRows = Math.max(0, dataEndRow - START_ROW_OUTPUT + 1);
    if (oldRows > 0) {
      shTK.getRange(START_ROW_OUTPUT, 1, oldRows, COL_COUNT).clearContent();
    }

    if (output.length) {
      shTK.getRange(START_ROW_OUTPUT, 1, output.length, COL_COUNT)
        .setValues(output);
    }

    /* ================= FORMAT CỘT A (MÃ HÀNG) ================= */
    setProgressTK_(runId, 90, "Định dạng mã hàng...");

    const itemFmtMap = buildTonKhoItemCodeFormatMap_(); // tu MaHangHoa

    const rowCount = output.length;
    if (rowCount > 0) {
      const maHangList = shTK
        .getRange(START_ROW_OUTPUT, 1, rowCount, 1)
        .getValues()
        .map(r => r[0]);

      const fontColors = [];
      const fontFamilies = [];
      const fontSizes = [];
      const fontWeights = [];

      for (let i = 0; i < rowCount; i++) {
        const key = String(maHangList[i] || "").trim();
        const fmt = itemFmtMap[key];

        fontColors.push([fmt?.fontColor || "#000000"]);
        fontFamilies.push([fmt?.fontFamily || "Arial"]);
        fontSizes.push([fmt?.fontSize || 10]);
        fontWeights.push([fmt?.fontWeight || "normal"]);
      }

      shTK.getRange(START_ROW_OUTPUT, 1, rowCount, 1)
        .setFontColors(fontColors)
        .setFontFamilies(fontFamilies)
        .setFontSizes(fontSizes)
        .setFontWeights(fontWeights);
    }

    const ngayCapNhat = (ngayDen instanceof Date) ? ngayDen : ngayMax;
    shTK.getRange("H6")
      .setValue(ngayCapNhat)
      .setNumberFormat("dd/MM/yyyy");

    const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

    setProgressTK_(runId, 100, "COMPLETED: Hoan tat", "COMPLETED");
    SpreadsheetApp.getActive().toast(
      `✅ Đã xong (${elapsed}s)`,
      "Cập nhật Tồn kho",
      5
    );

    return { runId, status: "COMPLETED" };
  } catch (err) {
    appendFileLogEntries_(auditLogs);
    setProgressTK_(runId, 100, "FAILED: " + sanitizeLogValue_(err.message || err), "FAILED");
    throw err;
  } finally {
    setTKRunning_(false);
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}

function findTotalRow_(sh) {
  const lastRow = sh.getLastRow();
  if (lastRow < 1) return null;

  const colA = sh.getRange(1, 1, lastRow, 1).getValues();

  for (let i = colA.length - 1; i >= 0; i--) {
    const v = String(colA[i][0] || "").toUpperCase();
    if (v.includes("TỔNG")) {
      return i + 1; // row index
    }
  }
  return null;
}

function setProgressTK_(runId, percent, msg, status) {
  ProgressService.set("TK", runId, percent, msg, status || "RUNNING");
}

function getProgressTK(runId) {
  return ProgressService.get("TK", runId);
}

function isTKRunning_() {
  return CacheService
    .getScriptCache()
    .get("TK_RUNNING") === "1";
}

function setTKRunning_(flag) {
  const cache = CacheService.getScriptCache();
  if (flag) {
    cache.put("TK_RUNNING", "1", 300); // tối đa 5 phút
  } else {
    cache.remove("TK_RUNNING");
  }
}

function buildTonKhoItemCodeFormatMap_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(CONFIG.SHEET_ITEMCODE);
  if (!sh) return {};

  const lastRow = sh.getLastRow();
  if (lastRow < 2) return {};

  const range = sh.getRange(2, 1, lastRow - 1, 1);

  const values = range.getValues();
  const fontColorObjs = range.getFontColorObjects();
  const fontFamilies = range.getFontFamilies();
  const fontSizes = range.getFontSizes();
  const fontWeights = range.getFontWeights();

  const map = {};

  values.forEach((r, i) => {
    const ma = String(r[0] || "").trim();
    if (!ma) return;

    const colorObj = fontColorObjs[i][0];

    map[ma] = {
      fontColor: colorObj?.asRgbColor()?.asHexString() || "#000000",
      fontFamily: fontFamilies[i][0],
      fontSize: fontSizes[i][0],
      fontWeight: fontWeights[i][0],
    };
  });

  return map;
}
