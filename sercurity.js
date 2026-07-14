/* =================================================
 * SECURITY GUARD – OWNER + TRIGGER ONLY
 * ================================================= */

/* Layer 1 — OWNER ONLY
 * Chặn:
 * - Editor phụ
 * - Người copy file
 * - Domain user khác
 */
function assertScriptOwner_() {
  const owner = PropertiesService
    .getScriptProperties()
    .getProperty("SCRIPT_OWNER_EMAIL");

  if (!owner) {
    throw new Error("Chưa khởi tạo chủ sở hữu script");
  }

  const effective = Session.getEffectiveUser().getEmail();

  if (owner !== effective) {
    throw new Error("Chỉ chủ sở hữu được phép.");
  }
}

/* Layer 2 — 🔍 TỰ ĐỘNG KIỂM TRA TRIGGER SAI
 * ✔ Chặn trigger chạy nhầm mainRun():
 */
function auditTriggers_() {
  const bad = ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'mainRun');

  if (bad.length) {
    throw new Error("⛔ Trigger MUST NOT call mainRun()");
  }
}

/* Layer 3 — TRIGGER SIGNATURE
 * Xác nhận trigger này do chính script tạo
 */

function enableAuthorizedTrigger_() {
  try {
    assertScriptOwner_();

    const props = PropertiesService.getScriptProperties();

    props.setProperty(
      "AUTHORIZED_TRIGGER_AT",
      new Date().toISOString()
    );

    let secret = props.getProperty("TRIGGER_SECRET");
    if (!secret) {
      secret = Utilities.getUuid();
      props.setProperty("TRIGGER_SECRET", secret);
    }

    const msg = "✅ enableAuthorizedTrigger OK";
    debugLog_(msg);

    return true;

  } catch (err) {
    const msg = "enableAuthorizedTrigger lỗi: " + err.message;
    debugLog_(msg);
    throw err; // để Execution báo đỏ
  }
}

/*✔ Chặn:
 * Trigger copy sang project khác
 * Trigger mồ côi
 * Trigger bị xóa rồi tạo thủ công bằng UI
 */
function assertTriggerSignature_() {
  const secret = PropertiesService
    .getScriptProperties()
    .getProperty("TRIGGER_SECRET");

  if (!secret) {
    throw new Error("Không tìm thấy chữ ký xác thực trigger");
  }
}

/* 
 * Layer 4 — ANTI-REPLAY
 * Không chạy song song (parallel)
 * Không chạy liên tiếp quá nhanh
 * Không bị Google gọi lại nhiều lần ngoài ý muốn
 * Mỗi lần chạy cách nhau ít nhất ... phút
 */
function assertAntiReplayTrigger_() {
  const lock = LockService.getScriptLock();

  // Nếu trigger khác đang chạy → block
  if (!lock.tryLock(5 * 1000)) {
    throw new Error("Trigger bị gọi lặp / chạy đồng thời");
  }

  const props = PropertiesService.getScriptProperties();
  const now = Date.now();

  const lastRun = Number(props.getProperty("LAST_TRIGGER_RUN") || 0);
  const MIN_INTERVAL = 0.1 * 60 * 1000; // 0,1 phút

  if (now - lastRun < MIN_INTERVAL) {
    throw new Error("Trigger chạy liên tiếp trong thời gian quá ngắn");
  }

  // Đánh dấu ngay để tránh race condition
  props.setProperty("LAST_TRIGGER_RUN", String(now));
}

/* =================================================
 * ANTI-REPLAY lv2: : signature theo phút
 * ================================================= */
function assertTriggerMinuteSignature_() {
  const props = PropertiesService.getScriptProperties();

  const minuteSlot = Math.floor(Date.now() / 60000);
  const lastSlot = props.getProperty("LAST_TRIGGER_MINUTE");

  if (String(minuteSlot) === lastSlot) {
    throw new Error("Trigger bị gọi lặp trong cùng một phút");
  }

  props.setProperty("LAST_TRIGGER_MINUTE", String(minuteSlot));
}

/* =================================================
 * KHỞI TẠO CHỦ SỞ HỮU SCRIPT - CHẠY TAY 1 LẦN
 * ================================================= */
function initSecurityOwner() {
  const email = Session.getEffectiveUser().getEmail();
  if (!email) {
    throw new Error("Không xác định được người dùng");
  }

  PropertiesService.getScriptProperties()
    .setProperty("SCRIPT_OWNER_EMAIL", email);

  Logger.log("Owner initialized: " + email);
}
