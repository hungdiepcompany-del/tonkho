function capNhatTonKho(ngayDen) {

  if (isTKRunning_()) {
    throw new Error("Đang cập nhật tồn kho, vui lòng chờ...");
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    throw new Error("Hệ thống đang xử lý tồn kho, thử lại sau.");
  }

  setTKRunning_(true);

  try {
    debugLog_("START capNhatTonKho");

    resetProgressTK_();
    setProgressTK_(0, "Khởi tạo tồn kho...");

    const t0 = Date.now();

    const ss = SpreadsheetApp.getActive();
    const shNX = ss.getSheetByName(CONFIG.SHEET_INVOICE);
    const shTK = ss.getSheetByName(CONFIG.SHEET_TONKHO);
    const shMH = ss.getSheetByName(CONFIG.SHEET_ITEMCODE);
    const logSh = getOrCreateASheet_(CONFIG.SHEET_LOG);

    if (!shNX || !shTK || !shMH) {
      throw new Error("Thiếu sheet bắt buộc");
    }

    /* ================= LOG ================= */
    logSh.getRange(2, 1, logSh.getMaxRows(), 4).clearContent();
    logSh.getRange("A1:D1")
      .setValues([["Dòng NX", "Ngày", "Mã hàng", "Diễn giải"]]);

    /* ================= READ DATA ================= */
    setProgressTK_(5, "Đọc dữ liệu...");

    const lastRowNX = shNX.getLastRow();
    if (lastRowNX < 2) return;

    const nxData = shNX
      .getRange(2, 1, lastRowNX - 1, 13)
      .getValues();

    const mhData = shMH.getDataRange().getValues();

    /* ================= MAP MÃ HÀNG ================= */
    setProgressTK_(10, "Ánh xạ mã hàng...");

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
    setProgressTK_(15, "Tính tồn kho...");

    SpreadsheetApp.getActive()
      .toast("Đang tính tồn kho theo BQGQ...", "Tồn kho", 3);

    const slTon = {};
    const gtTon = {};
    const dgBQ = {};

    let ngayMax = new Date(0);
    let logRow = 2;

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
            logSh.getRange(logRow++, 1, 1, 4)
              .setValues([[realIdx + 2, ngay, ma, "Xuất vượt tồn"]]);
            slTon[ma] = 0;
            gtTon[ma] = 0;
            dgBQ[ma] = 0;
          }
        }
      });

      // ✅ FIX PROGRESS – KHÔNG RESET, KHÔNG GIẬT
      const done = Math.min(i + slice.length, TOTAL);
      const percent = PROGRESS_START + Math.round(
        (done / TOTAL) * (PROGRESS_END - PROGRESS_START)
      );

      setProgressTK_(
        percent,
        `Đang tổng hợp tồn kho ${done}/${TOTAL}`
      );
    }

    /* ================= BUILD OUTPUT ================= */
    setProgressTK_(70, "Đã tính xong tồn kho");

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
    setProgressTK_(85, "Ghi dữ liệu tồn kho...");

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
    setProgressTK_(90, "Định dạng mã hàng...");

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

    setProgressTK_(100, "Hoàn tất 🎉");
    SpreadsheetApp.getActive().toast(
      `✅ Đã xong (${elapsed}s)`,
      "Cập nhật Tồn kho",
      5
    );

  } finally {
    // luôn luôn mở khóa bất kỳ hoàn cảnh nào
    setTKRunning_(false);
    lock.releaseLock();
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

function resetProgressTK_() {
  ProgressService.set("TK", 0, "Chuẩn bị...");
}

function setProgressTK_(percent, msg) {
  ProgressService.set("TK", percent, msg);
}

function getProgressTK() {
  return ProgressService.get("TK");
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

