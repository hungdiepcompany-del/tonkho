/* ⏱ Khi DEBUG_LOG = false:
 * Hàm return ngay
 * KHÔNG build chuỗi phức tạp
 * KHÔNG gọi Logger
 */
function debugLog_(...args) {
  if (!CONFIG.DEBUG_LOG) return;
  Logger.log(args.map(sanitizeLogValue_).join(' '));
}

function sanitizeLogValue_(value) {
  let text = String(value === undefined || value === null ? "" : value);
  text = text.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL]");
  text = text.replace(/\b\d{8,14}\b/g, "[NUMBER]");
  text = text.replace(/(https?:\/\/[^\s?]+)\?[^ \n\r\t]+/gi, "$1?[QUERY_REDACTED]");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length > 240) {
    return text.slice(0, 120) + "...[REDACTED_LONG_TEXT]";
  }
  return text;
}

function sanitizeUrlForLog_(url) {
  return sanitizeLogValue_(url);
}

/*⏱ DEBUG_LOG = false:
 * callback KHÔNG chạy
 * JSON.stringify KHÔNG chạy
 * tiết kiệm rất nhiều thời gian
 */
function debugLogLazy_(fn) {
  if (!CONFIG.DEBUG_LOG) return;
  Logger.log(sanitizeLogValue_(fn()));
}

// XÓA HẾT Script Properties
function clearAllScriptProperties_() {
  PropertiesService
    .getScriptProperties()
    .deleteAllProperties();
  debugLog_("ĐÃ XÓA HẾT PROPERTIES SCRIPT");
}
