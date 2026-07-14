function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📦 QUẢN TRỊ")
    .addItem('🧾 Viết hóa đơn', 'showVietHoaDonSidebar')
    .addSeparator()
    .addItem("📊 Bảng điều khiển", "showSidebar")
    .addSeparator()
    .addItem("📦 Cập nhật Tồn kho", "capNhatTonKho")
    .addItem("🔁 Cập nhật Nhập/Xuất", "capNhatNhapXuatBQGQ")
    .addToUi();
}

function showSidebar() {
  const html = HtmlService.createHtmlOutputFromFile("sheetSidebar")
    .setTitle("MENU")
    .setWidth(500);

  SpreadsheetApp.getUi().showSidebar(html);
}

function menuCapNhatTonKho() {
  try {
    capNhatTonKho(); // không truyền ngày = tính đến ngày max
  } catch (err) {
    debugLog_("Lỗi menuCapNhatTonKho: " + err.message);
    SpreadsheetApp.getUi().alert(
      "Lỗi khi cập nhật Tồn kho:\n" + err.message
    );
  }
}
