/* =================================================
 * ⚙️ CẤU HÌNH TẬP TRUNG (CONFIGURATION CENTER)
 * =================================================
 *
 * File này đóng vai trò là:
 * - NƠI DUY NHẤT chứa toàn bộ cấu hình nghiệp vụ
 * - Tránh hard-code rải rác trong logic xử lý
 *
 * Nguyên tắc:
 * - Logic KHÔNG được viết trực tiếp ở đây
 * - File này CHỈ chứa hằng số và các helper cấu hình
 *
 * Khi cần thay đổi hành vi hệ thống:
 * → Ưu tiên chỉnh tại đây trước khi đụng tới logic
 */

const CONFIG = {
  // chỉ bật khi test / debug
  RESET_PROPERTIES_ON_RUN: false,   // Xóa ScriptProperties
  DELETE_LABELS_ON_RUN: false,      // Xóa nhãn Gmail
  DEBUG_LOG: true,                  // bật khi debug LOG
  DEBUG_HASH: false,                // PROD / DEBUG

  /*
   * TÊN CÔNG TY CỦA BẠN
   */
  MY_COMPANY: "CÔNG TY TNHH THƯƠNG MẠI VÀ SẢN XUẤT HÙNG DIỆP",
  MY_TAXCODE: "1001035198",
  MY_EMAIL: "hungdiepcompany@gmail.com",
  // EMAIL
  INVOICE_FROMDATE: "2026/01/01",
  INVOICE_IN_LABEL: "📥 HÓA ĐƠN NHẬP",
  INVOICE_OUT_LABEL: "📤 HÓA ĐƠN XUẤT",
  SAVE_SHEET_LABEL: "✅ ĐÃ LƯU SHEET",
  PENDING_LABEL: "⏳ CHƯA XỬ LÝ",
  SAVE_PDF_LABEL: "📑 PDF->DRIVE",
  SAVE_XML_LABEL: "🧾 XML->DRIVE",
  SAVE_LINK_LABEL: "🔗 LINK->DRIVE",

  // GOOGLE SHEET
  SHEET_TONKHO: "TonKho", // sheet Tồn kho
  SHEET_INVOICE: "Nhap-Xuat", // sheet Nhập/Xuất
  SHEET_FILES: "Hoa-Don", // sheet Hóa đơn
  SHEET_ITEMCODE: "MaHangHoa", // sheet Mã hàng hóa
  SHEET_ITEMTYPE: "PhanLoai", // sheet Phân loại Nhập/Xuất
  SHEET_ABBREVIATIONS: "VietTat", // sheet Viết tắt
  SHEET_LOG: "FileLog", // sheet ghi log

  HASH_COLUME_BEGIN: 2, // Cột B
  HASH_COLUME_END: 8, // Cột H
  HASH_COLUME: 14,  // Cột N

  NHAPXUAT_INDEX: {
    stt: -1, // chỉ để mô tả
    invoiceDate: 0,
    invoiceNo: 1,
    customerName: 2,
    itemCode: 3,
    itemName: 4,
    invoiceType: 5,
    qty: 6,
    price: 7,
    hash: 12,
    invoiceKey: 13
  },

  // GOOGLE DRIVE
  PARENT_FOLDER_ID: "1Ek_IiMV3yNR4fHzjvWNq0W8Xm6ezbdoB",// FOLDER_NAME: "Hóa đơn VAT + Chứng từ sao kê"
  INVOICE_IN_FOLDER_ID: "1euiQsWuwUoG2B2Ck_QGvot8HX6pXr7Zs", //"📥 HÓA ĐƠN NHẬP",
  INVOICE_OUT_FOLDER_ID: "1URBnc3j1vGBciOWHBsk4B3nnXnLEHjAA", //"📤 HÓA ĐƠN XUẤT",
  SLIDE_TEMPLATE_ID: "1yKvw_uosBm-U2EyOaOdaEydg-uHuxO69qYCW7DweeWc", // FILE invoice slide template: INVOICE_SLIDE_TEMPLATE

  // SCRIPT LOCK
  LOCK_WAIT: 4 * 60 * 1000, //  phút
  // OCR giảm tốc tránh spam OCR
  OCR_SLEEP1: 1200,
  OCR_SLEEP2: 2500,

  // GIỚI HẠN THREAD MỖI LẦN CHẠY
  MAX_THREADS: 30,
  // GIỚI HẠN SỐ EMAIL MỖI LẦN QUÉT
  MAX_EMAIL_SCAN: 50,
  MAX_DRIVE_SCAN_FILES: 100,

  /*
   * TỪ KHÓA NHẬN DIỆN EMAIL HÓA ĐƠN
   */
  INVOICE_KEYWORDS: [
    "Hoa Don",
    "HDDT",
    "HĐĐT",
    "Hóa đơn điện tử",
    "HDGTGT",
    "HĐGTGT",
    "Hóa đơn giá trị gia tăng",
    "Invoice",
    "VAT Invoice",
    "Bill"
  ],

  /*
   * LOẠI TRỪ EMAIL CÓ TIÊU ĐỀ HOẶC NỘI DUNG
   *
   */

  EXCLUDED_KEYWORDS: [
    "Cảnh báo",
    "bảo mật"
  ],


  /*
   * LOẠI TRỪ NGƯỜI GỬI
   *
   */
  EXCLUDED_SENDERS: {
    EMAILS: [
      "spamxxx@gmail.com",
      "noreply@support.lazada.vn",
      "khuyến mại"
    ],
    DOMAINS: [
      "google.com", // sẽ loại @accounts.google.com, @alerts.google.com, ...
      "lazada.vn"
    ]
  },
};
