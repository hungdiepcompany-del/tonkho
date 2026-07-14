/* ⏱ Khi DEBUG_LOG = false:
 * Hàm return ngay
 * KHÔNG build chuỗi phức tạp
 * KHÔNG gọi Logger
 */
function debugLog_(...args) {
  if (!CONFIG.DEBUG_LOG) return;
  Logger.log(args.join(' '));
}

/*⏱ DEBUG_LOG = false:
 * callback KHÔNG chạy
 * JSON.stringify KHÔNG chạy
 * tiết kiệm rất nhiều thời gian
 */
function debugLogLazy_(fn) {
  if (!CONFIG.DEBUG_LOG) return;
  Logger.log(fn());
}

// XÓA HẾT Script Properties
function clearAllScriptProperties_() {
  PropertiesService
    .getScriptProperties()
    .deleteAllProperties();
  debugLog_("ĐÃ XÓA HẾT PROPERTIES SCRIPT");
}
