Roadmap V2 đề xuất

Chương trình A — Hiểu và khóa hệ thống hiện tại

A00 — Baseline repository

Khởi tạo Git.

Commit source GAS hiện tại.

Kiểm tra secret.

Tạo work log, decision log và handoff.

Không sửa runtime.

Không clasp push.

A01 — Runtime evidence read-only



Thu bằng chứng:



Trigger thực tế.

Script Properties.

Gmail label counts.

Cấu trúc Drive.

Schema và formula Google Sheets.

Duplicate hash/invoiceKey.

Các dòng chưa tính BQGQ.

A02 — Full bug audit



Xếp hạng:



CRITICAL.

HIGH.

MEDIUM.

LOW.

A03 — Data contract và invariant



Chốt:



Khi nào một hóa đơn hoàn tất.

Quy tắc XML/PDF/link.

Cách xử lý nhiều hóa đơn trong một thread.

Chống trùng.

Xuất vượt tồn.

Thứ tự BQGQ.

Vai trò chính thức của từng dịch vụ.

Chương trình B — Ổn định GAS và Google Sheets

B01 — Test harness



Tạo fixture cho:



XML.

PDF.

Chuẩn hóa.

Hash.

Invoice key.

BQGQ.

Tồn kho.

B02 — Critical safety fixes



Sửa trước:



Không gắn ĐÃ LƯU SHEET trước khi commit.

Không dùng một writeOk cho toàn batch.

Không tự xóa row có hash rỗng.

Drive scanner phải dùng chung dedup core.

Rerun không tạo duplicate.

Stats và trạng thái lỗi phải chính xác.

B03 — Canonical job state trong Google Sheets



Tạo sheet mới, ví dụ:



XuLyHoaDon



Nó lưu:



jobId

threadId

messageId

invoiceKey

invoiceType

parseStatus

xmlStatus

pdfStatus

sheetCommitStatus

inventoryStatus

retryCount

lastError

startedAt

updatedAt

completedAt



Đây là nguồn trạng thái chính trong giai đoạn GAS.



B04 — Reconciliation và recovery



Đối chiếu:



Gmail

↔ Drive

↔ Hoa-Don

↔ Nhap-Xuat

↔ XuLyHoaDon

↔ TonKho

Chương trình C — Ổn định nghiệp vụ

C01 — XML/PDF/link parser

XML namespace.

Hóa đơn điều chỉnh/thay thế.

Nhiều XML trong một thread.

PDF không phụ thuộc 50 ký tự đầu.

Dọn file OCR tạm trong finally.

Link-only có trạng thái rõ ràng.

C02 — BQGQ và Tồn kho



Tách engine tính toán khỏi Sheet API:



calculateInventoryLedger(transactions, policy)



Chốt chính sách:



Thứ tự giao dịch.

Xuất vượt tồn.

Làm tròn.

Rebuild tồn kho.

C03 — Giao diện GAS hiện tại

Sidebar báo trạng thái job thật.

Không báo hoàn tất giả.

Sửa VHD.SHEET\_NAME.

Sửa named range.

Sửa progress.

Chưa mở chức năng tạo hóa đơn chính thức.

Chương trình D — Firebase nền tảng miễn phí

D01 — Tạo Firebase project



Dùng:



hungdiepcompany@gmail.com



Bật:



Firebase Hosting.

Firebase Authentication.

Firestore.



Không bật:



Firebase Storage.

Cloud Functions.

Cloud Run.

App Hosting yêu cầu billing.

D02 — Firebase Authentication



Giai đoạn đầu:



Chỉ đăng nhập Google.

Chỉ cho phép hungdiepcompany@gmail.com.

User khác bị từ chối ngay trên frontend và backend.

D03 — Firestore data model



Firestore chỉ lưu:



users

invoiceJobs

invoiceMetadata

processingErrors

auditEvents

reconciliationFindings

systemStatus



Không lưu ngay:



toàn bộ Nhap-Xuat

toàn bộ TonKho

XML/PDF binary

D04 — Firestore Security Rules



Chỉ tài khoản được phép đọc/ghi.



Mặc định:



deny all



Sau đó mở đúng collection, đúng user và đúng hành động.



Chương trình E — GAS Web API

E01 — Tạo API boundary trong GAS



Các endpoint nghiệp vụ dự kiến:



GET system status

GET invoice jobs

GET invoice metadata

GET inventory summary

GET processing errors

POST retry job

POST approve mapping

POST run reconciliation



Không để frontend gọi trực tiếp các hàm nội bộ như:



scanInvoiceInEmails\_

writeInvoicesToSheet\_

capNhatTonKho

E02 — Authentication frontend → GAS



Cần thiết kế một trong hai phương án:



Phương án đơn giản ban đầu

GAS Web App chỉ cho chính tài khoản triển khai truy cập.

Người dùng phải đăng nhập cùng tài khoản Google.

Phù hợp khi chỉ có một người dùng.

Phương án mở rộng

Frontend gửi Firebase ID token.

GAS gọi endpoint xác minh token hoặc dùng một cơ chế session riêng.

Phức tạp hơn và cần đánh giá kỹ trước khi triển khai.



Với hiện trạng chỉ có một tài khoản, nên bắt đầu bằng phương án đơn giản.



E03 — API response contract



Mọi response thống nhất:



{

&#x20; ok: true,

&#x20; requestId: "...",

&#x20; data: {},

&#x20; error: null

}



Khi lỗi:



{

&#x20; ok: false,

&#x20; requestId: "...",

&#x20; data: null,

&#x20; error: {

&#x20;   code: "INVOICE\_NOT\_FOUND",

&#x20;   message: "..."

&#x20; }

}

Chương trình F — Firebase frontend

F01 — Read-only dashboard



Giao diện đầu tiên chỉ đọc:



Trạng thái hệ thống.

Danh sách job.

Hóa đơn pending.

Lỗi parser.

File XML/PDF.

Nhập-Xuất.

Tồn kho.

Reconciliation findings.

F02 — Limited actions



Chỉ mở các thao tác an toàn:



Retry job.

Duyệt mã hàng.

Đánh dấu lỗi đã xem.

Chạy reconciliation report-only.



Chưa mở:



Xóa hóa đơn.

Sửa ledger.

Ghi tồn kho.

Tạo hóa đơn thật.

Thay Gmail labels thủ công hàng loạt.

F03 — UI Viết hóa đơn



Chuyển giao diện VietHoaDon\_UI sang Firebase Hosting nhưng vẫn gọi calculation core hiện có hoặc GAS API.



Chương trình G — Đồng bộ Firestore



Firestore không được trở thành một bản sao không kiểm soát của Google Sheets.



Quy tắc:



Google Sheets = dữ liệu nghiệp vụ chính

Firestore = projection cho giao diện và audit



Luồng:



GAS commit Google Sheets

&#x20;   ↓

GAS cập nhật Firestore metadata/job state

&#x20;   ↓

Firebase frontend tự cập nhật realtime



Nếu cập nhật Firestore thất bại:



Không rollback giao dịch Sheet đã commit.

Job ghi FIRESTORE\_SYNC\_PENDING.

Có retry riêng.

Gmail label không phụ thuộc việc Firestore sync thành công.

Phân định trách nhiệm cuối cùng

Thành phần	Trách nhiệm

Gmail	Email gốc, thread/message, attachment và nguồn truy nguyên

Google Drive	XML/PDF gốc và artifact

Google Sheets	Ledger Nhập-Xuất, Tồn kho, danh mục nghiệp vụ

GAS	Scanner, parser, worker, business API và đồng bộ

Firestore	Job state, metadata, audit, lỗi, dữ liệu projection

Firebase Auth	Đăng nhập và kiểm soát tài khoản

Firebase Hosting	Giao diện web

Frontend	Hiển thị và gửi yêu cầu, không tự quyết định nghiệp vụ

