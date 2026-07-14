/**
 * VietHoaDon_GAS_TonKho_v18.gs
 * Backend Apps Script cho WebUI Viết hóa đơn.
 *
 * Sheet nguồn:
 * - TonKho: Mã hàng | Tên hàng | ĐVT | Số lượng | Giá trị | Đơn giá BQ
 *
 * File HTML trong Apps Script phải đặt tên: VietHoaDon_UI
 */

const VHD = {
  TONKHO_SHEET_NAME: 'TonKho',
  INPUT_SHEET_NAME: 'VietHoaDon',

  INPUT_CELLS: {
    sl1Be: 'B5',
    sl1To: 'C5',
    dg1Be: 'D5',
    dg1To: 'E5',
    giaTriMucTieu: 'B8',
    truocThue: 'B10',
    uuTienSL: 'B11',
    uuTienDG: 'B12'
  },

  NAMED_RANGES: {
    sl1Be: 'VHD_SL1_BE',
    sl1To: 'VHD_SL1_TO',
    dg1Be: 'VHD_DG1_BE',
    dg1To: 'VHD_DG1_TO',
    giaTriMucTieu: 'VHD_GIA_TRI_MUC_TIEU',
    truocThue: 'VHD_TRUOC_THUE',
    uuTienSL: 'VHD_UU_TIEN_SL',
    uuTienDG: 'VHD_UU_TIEN_DG'
  }
};

function doGet(e) {
  return HtmlService
    .createHtmlOutputFromFile('VietHoaDon_UI')
    .setTitle('Viết hóa đơn')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function showVietHoaDonSidebar() {
  const html = HtmlService
    .createHtmlOutputFromFile('VietHoaDon_UI')
    .setTitle('Viết hóa đơn')
    .setWidth(1200);
  SpreadsheetApp.getUi().showSidebar(html);
}

function vhdGetInitialData() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(VHD.INPUT_SHEET_NAME);
  const input = sh ? readVietHoaDonInput_(ss, sh) : {};

  return {
    input: Object.assign(getDefaultInput_(), input, {
      saiSoChoPhep: 50,
      soThapPhan: 2,
      buocSL: 0.01,
      buocDG: 0.01,
      maxRows: 100,
      batchSize: 30000,
      truocThue: false
    }),
    tonKho: getTonKhoItems_()
  };
}

function vhdGetTonKhoItems() {
  return getTonKhoItems_();
}

function getTonKhoItems_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(VHD.TONKHO_SHEET_NAME);
  if (!sh) {
    throw new Error('Không tìm thấy sheet "' + VHD.TONKHO_SHEET_NAME + '".');
  }

  const lastRow = sh.getLastRow();
  const lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 6) return [];

  const values = sh.getRange(1, 1, lastRow, Math.max(6, lastCol)).getValues();
  const headers = values[0].map(h => normalizeHeader_(h));

  const colMa = findHeaderCol_(headers, ['ma hang', 'ma_hang', 'mã hàng']);
  const colTen = findHeaderCol_(headers, ['ten hang', 'ten_hang', 'tên hàng']);
  const colDvt = findHeaderCol_(headers, ['dvt', 'đvt']);
  const colSl = findHeaderCol_(headers, ['so luong', 'so_luong', 'số lượng']);
  const colGiaTri = findHeaderCol_(headers, ['gia tri', 'gia_tri', 'giá trị']);
  const colDg = findHeaderCol_(headers, ['don gia bq', 'don_gia_bq', 'đơn giá bq']);

  const required = [colMa, colTen, colDvt, colSl, colGiaTri, colDg];
  if (required.some(c => c < 0)) {
    throw new Error('Sheet TonKho cần đủ cột: Mã hàng, Tên hàng, ĐVT, Số lượng, Giá trị, Đơn giá BQ.');
  }

  const items = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const ma = String(row[colMa] || '').trim();
    if (!ma || ma.toUpperCase() === 'TỔNG' || ma.toUpperCase() === 'TONG') continue;

    const soLuong = parseVnNumber_(row[colSl]);
    const donGiaBQ = parseVnNumber_(row[colDg]);
    const giaTri = parseVnNumber_(row[colGiaTri]);

    items.push({
      maHang: ma,
      tenHang: String(row[colTen] || '').trim(),
      dvt: String(row[colDvt] || '').trim(),
      soLuong: soLuong,
      giaTri: giaTri,
      donGiaBQ: donGiaBQ
    });
  }

  return items.filter(x => x.soLuong > 0 && x.donGiaBQ > 0);
}

function normalizeHeader_(v) {
  return String(v || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function findHeaderCol_(headers, names) {
  const normalized = names.map(normalizeHeader_);
  for (let i = 0; i < headers.length; i++) {
    if (normalized.indexOf(headers[i]) >= 0) return i;
  }
  return -1;
}

function parseVnNumber_(v) {
  if (typeof v === 'number') return v || 0;
  if (v === null || v === undefined || v === '') return 0;

  let s = String(v).trim().replace(/\s/g, '');
  if (!s) return 0;

  if (s.indexOf(',') >= 0) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const parts = s.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      s = s.replace(/\./g, '');
    }
  }

  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

function getDefaultInput_() {
  return {
    sl1Be: '', sl1To: '', dg1Be: '', dg1To: '',
    giaTriMucTieu: '',
    saiSoChoPhep: 50,
    soThapPhan: 2,
    buocSL: 0.01,
    buocDG: 0.01,
    maxRows: 100,
    batchSize: 30000,
    truocThue: false,
    uuTienSL: false,
    uuTienDG: false
  };
}

function readVietHoaDonInput_(ss, sh) {
  const out = {};
  Object.keys(VHD.NAMED_RANGES).forEach(k => {
    out[k] = readNamedOrCell_(ss, sh, VHD.NAMED_RANGES[k], VHD.INPUT_CELLS[k]);
  });

  return {
    sl1Be: toNumber_(out.sl1Be),
    sl1To: toNumber_(out.sl1To),
    dg1Be: toNumber_(out.dg1Be),
    dg1To: toNumber_(out.dg1To),
    giaTriMucTieu: Math.abs(toNumber_(out.giaTriMucTieu)),
    truocThue: false,
    uuTienSL: toBool_(out.uuTienSL),
    uuTienDG: toBool_(out.uuTienDG)
  };
}

function readNamedOrCell_(ss, sh, name, fallbackA1) {
  const nr = ss.getRangeByName(name);
  if (nr) return nr.getValue();
  return sh.getRange(fallbackA1).getValue();
}

function setNamedRange_(ss, range, name) {
  const existing = ss.getNamedRanges().filter(nr => nr.getName() === name);
  existing.forEach(nr => nr.remove());
  ss.setNamedRange(name, range);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function toNumber_(v) {
  return parseVnNumber_(v);
}

function toBool_(v) {
  if (v === true || v === false) return v;
  const s = String(v).trim().toLowerCase();
  return ['true', 'yes', 'y', '1', 'x', 'có', 'co', 'đúng', 'dung'].indexOf(s) >= 0;
}
