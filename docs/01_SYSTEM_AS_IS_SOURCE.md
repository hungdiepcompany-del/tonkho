Roadmap V2 Ä‘á» xuáº¥t

ChÆ°Æ¡ng trÃ¬nh A â€” Hiá»ƒu vÃ  khÃ³a há»‡ thá»‘ng hiá»‡n táº¡i

A00 â€” Baseline repository

Khá»Ÿi táº¡o Git.

Commit source GAS hiá»‡n táº¡i.

Kiá»ƒm tra secret.

Táº¡o work log, decision log vÃ  handoff.

KhÃ´ng sá»­a runtime.

KhÃ´ng clasp push.

A01 â€” Runtime evidence read-only



Thu báº±ng chá»©ng:



Trigger thá»±c táº¿.

Script Properties.

Gmail label counts.

Cáº¥u trÃºc Drive.

Schema vÃ  formula Google Sheets.

Duplicate hash/invoiceKey.

CÃ¡c dÃ²ng chÆ°a tÃ­nh BQGQ.

A02 â€” Full bug audit



Xáº¿p háº¡ng:



CRITICAL.

HIGH.

MEDIUM.

LOW.

A03 â€” Data contract vÃ  invariant



Chá»‘t:



Khi nÃ o má»™t hÃ³a Ä‘Æ¡n hoÃ n táº¥t.

Quy táº¯c XML/PDF/link.

CÃ¡ch xá»­ lÃ½ nhiá»u hÃ³a Ä‘Æ¡n trong má»™t thread.

Chá»‘ng trÃ¹ng.

Xuáº¥t vÆ°á»£t tá»“n.

Thá»© tá»± BQGQ.

Vai trÃ² chÃ­nh thá»©c cá»§a tá»«ng dá»‹ch vá»¥.

ChÆ°Æ¡ng trÃ¬nh B â€” á»”n Ä‘á»‹nh GAS vÃ  Google Sheets

B01 â€” Test harness



Táº¡o fixture cho:



XML.

PDF.

Chuáº©n hÃ³a.

Hash.

Invoice key.

BQGQ.

Tá»“n kho.

B02 â€” Critical safety fixes



Sá»­a trÆ°á»›c:



KhÃ´ng gáº¯n ÄÃƒ LÆ¯U SHEET trÆ°á»›c khi commit.

KhÃ´ng dÃ¹ng má»™t writeOk cho toÃ n batch.

KhÃ´ng tá»± xÃ³a row cÃ³ hash rá»—ng.

Drive scanner pháº£i dÃ¹ng chung dedup core.

Rerun khÃ´ng táº¡o duplicate.

Stats vÃ  tráº¡ng thÃ¡i lá»—i pháº£i chÃ­nh xÃ¡c.

B03 â€” Canonical job state trong Google Sheets



Táº¡o sheet má»›i, vÃ­ dá»¥:



XuLyHoaDon



NÃ³ lÆ°u:



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



ÄÃ¢y lÃ  nguá»“n tráº¡ng thÃ¡i chÃ­nh trong giai Ä‘oáº¡n GAS.



B04 â€” Reconciliation vÃ  recovery



Äá»‘i chiáº¿u:



Gmail

â†” Drive

â†” Hoa-Don

â†” Nhap-Xuat

â†” XuLyHoaDon

â†” TonKho

ChÆ°Æ¡ng trÃ¬nh C â€” á»”n Ä‘á»‹nh nghiá»‡p vá»¥

C01 â€” XML/PDF/link parser

XML namespace.

HÃ³a Ä‘Æ¡n Ä‘iá»u chá»‰nh/thay tháº¿.

Nhiá»u XML trong má»™t thread.

PDF khÃ´ng phá»¥ thuá»™c 50 kÃ½ tá»± Ä‘áº§u.

Dá»n file OCR táº¡m trong finally.

Link-only cÃ³ tráº¡ng thÃ¡i rÃµ rÃ ng.

C02 â€” BQGQ vÃ  Tá»“n kho



TÃ¡ch engine tÃ­nh toÃ¡n khá»i Sheet API:



calculateInventoryLedger(transactions, policy)



Chá»‘t chÃ­nh sÃ¡ch:



Thá»© tá»± giao dá»‹ch.

Xuáº¥t vÆ°á»£t tá»“n.

LÃ m trÃ²n.

Rebuild tá»“n kho.

C03 â€” Giao diá»‡n GAS hiá»‡n táº¡i

Sidebar bÃ¡o tráº¡ng thÃ¡i job tháº­t.

KhÃ´ng bÃ¡o hoÃ n táº¥t giáº£.

Sá»­a VHD.SHEET\_NAME.

Sá»­a named range.

Sá»­a progress.

ChÆ°a má»Ÿ chá»©c nÄƒng táº¡o hÃ³a Ä‘Æ¡n chÃ­nh thá»©c.

ChÆ°Æ¡ng trÃ¬nh D â€” Firebase ná»n táº£ng miá»…n phÃ­

D01 â€” Táº¡o Firebase project



DÃ¹ng:



hungdiepcompany@gmail.com



Báº­t:



Firebase Hosting.

Firebase Authentication.

Firestore.



KhÃ´ng báº­t:



Firebase Storage.

Cloud Functions.

Cloud Run.

App Hosting yÃªu cáº§u billing.

D02 â€” Firebase Authentication



Giai Ä‘oáº¡n Ä‘áº§u:



Chá»‰ Ä‘Äƒng nháº­p Google.

Chá»‰ cho phÃ©p hungdiepcompany@gmail.com.

User khÃ¡c bá»‹ tá»« chá»‘i ngay trÃªn frontend vÃ  backend.

D03 â€” Firestore data model



Firestore chá»‰ lÆ°u:



users

invoiceJobs

invoiceMetadata

processingErrors

auditEvents

reconciliationFindings

systemStatus



KhÃ´ng lÆ°u ngay:



toÃ n bá»™ Nhap-Xuat

toÃ n bá»™ TonKho

XML/PDF binary

D04 â€” Firestore Security Rules



Chá»‰ tÃ i khoáº£n Ä‘Æ°á»£c phÃ©p Ä‘á»c/ghi.



Máº·c Ä‘á»‹nh:



deny all



Sau Ä‘Ã³ má»Ÿ Ä‘Ãºng collection, Ä‘Ãºng user vÃ  Ä‘Ãºng hÃ nh Ä‘á»™ng.



ChÆ°Æ¡ng trÃ¬nh E â€” GAS Web API

E01 â€” Táº¡o API boundary trong GAS



CÃ¡c endpoint nghiá»‡p vá»¥ dá»± kiáº¿n:



GET system status

GET invoice jobs

GET invoice metadata

GET inventory summary

GET processing errors

POST retry job

POST approve mapping

POST run reconciliation



KhÃ´ng Ä‘á»ƒ frontend gá»i trá»±c tiáº¿p cÃ¡c hÃ m ná»™i bá»™ nhÆ°:



scanInvoiceInEmails\_

writeInvoicesToSheet\_

capNhatTonKho

E02 â€” Authentication frontend â†’ GAS



Cáº§n thiáº¿t káº¿ má»™t trong hai phÆ°Æ¡ng Ã¡n:



PhÆ°Æ¡ng Ã¡n Ä‘Æ¡n giáº£n ban Ä‘áº§u

GAS Web App chá»‰ cho chÃ­nh tÃ i khoáº£n triá»ƒn khai truy cáº­p.

NgÆ°á»i dÃ¹ng pháº£i Ä‘Äƒng nháº­p cÃ¹ng tÃ i khoáº£n Google.

PhÃ¹ há»£p khi chá»‰ cÃ³ má»™t ngÆ°á»i dÃ¹ng.

PhÆ°Æ¡ng Ã¡n má»Ÿ rá»™ng

Frontend gá»­i Firebase ID token.

GAS gá»i endpoint xÃ¡c minh token hoáº·c dÃ¹ng má»™t cÆ¡ cháº¿ session riÃªng.

Phá»©c táº¡p hÆ¡n vÃ  cáº§n Ä‘Ã¡nh giÃ¡ ká»¹ trÆ°á»›c khi triá»ƒn khai.



Vá»›i hiá»‡n tráº¡ng chá»‰ cÃ³ má»™t tÃ i khoáº£n, nÃªn báº¯t Ä‘áº§u báº±ng phÆ°Æ¡ng Ã¡n Ä‘Æ¡n giáº£n.



E03 â€” API response contract



Má»i response thá»‘ng nháº¥t:



{

&#x20; ok: true,

&#x20; requestId: "...",

&#x20; data: {},

&#x20; error: null

}



Khi lá»—i:



{

&#x20; ok: false,

&#x20; requestId: "...",

&#x20; data: null,

&#x20; error: {

&#x20;   code: "INVOICE\_NOT\_FOUND",

&#x20;   message: "..."

&#x20; }

}

ChÆ°Æ¡ng trÃ¬nh F â€” Firebase frontend

F01 â€” Read-only dashboard



Giao diá»‡n Ä‘áº§u tiÃªn chá»‰ Ä‘á»c:



Tráº¡ng thÃ¡i há»‡ thá»‘ng.

Danh sÃ¡ch job.

HÃ³a Ä‘Æ¡n pending.

Lá»—i parser.

File XML/PDF.

Nháº­p-Xuáº¥t.

Tá»“n kho.

Reconciliation findings.

F02 â€” Limited actions



Chá»‰ má»Ÿ cÃ¡c thao tÃ¡c an toÃ n:



Retry job.

Duyá»‡t mÃ£ hÃ ng.

ÄÃ¡nh dáº¥u lá»—i Ä‘Ã£ xem.

Cháº¡y reconciliation report-only.



ChÆ°a má»Ÿ:



XÃ³a hÃ³a Ä‘Æ¡n.

Sá»­a ledger.

Ghi tá»“n kho.

Táº¡o hÃ³a Ä‘Æ¡n tháº­t.

Thay Gmail labels thá»§ cÃ´ng hÃ ng loáº¡t.

F03 â€” UI Viáº¿t hÃ³a Ä‘Æ¡n



Chuyá»ƒn giao diá»‡n VietHoaDon\_UI sang Firebase Hosting nhÆ°ng váº«n gá»i calculation core hiá»‡n cÃ³ hoáº·c GAS API.



ChÆ°Æ¡ng trÃ¬nh G â€” Äá»“ng bá»™ Firestore



Firestore khÃ´ng Ä‘Æ°á»£c trá»Ÿ thÃ nh má»™t báº£n sao khÃ´ng kiá»ƒm soÃ¡t cá»§a Google Sheets.



Quy táº¯c:



Google Sheets = dá»¯ liá»‡u nghiá»‡p vá»¥ chÃ­nh

Firestore = projection cho giao diá»‡n vÃ  audit



Luá»“ng:



GAS commit Google Sheets

&#x20;   â†“

GAS cáº­p nháº­t Firestore metadata/job state

&#x20;   â†“

Firebase frontend tá»± cáº­p nháº­t realtime



Náº¿u cáº­p nháº­t Firestore tháº¥t báº¡i:



KhÃ´ng rollback giao dá»‹ch Sheet Ä‘Ã£ commit.

Job ghi FIRESTORE\_SYNC\_PENDING.

CÃ³ retry riÃªng.

Gmail label khÃ´ng phá»¥ thuá»™c viá»‡c Firestore sync thÃ nh cÃ´ng.

PhÃ¢n Ä‘á»‹nh trÃ¡ch nhiá»‡m cuá»‘i cÃ¹ng

ThÃ nh pháº§n	TrÃ¡ch nhiá»‡m

Gmail	Email gá»‘c, thread/message, attachment vÃ  nguá»“n truy nguyÃªn

Google Drive	XML/PDF gá»‘c vÃ  artifact

Google Sheets	Ledger Nháº­p-Xuáº¥t, Tá»“n kho, danh má»¥c nghiá»‡p vá»¥

GAS	Scanner, parser, worker, business API vÃ  Ä‘á»“ng bá»™

Firestore	Job state, metadata, audit, lá»—i, dá»¯ liá»‡u projection

Firebase Auth	ÄÄƒng nháº­p vÃ  kiá»ƒm soÃ¡t tÃ i khoáº£n

Firebase Hosting	Giao diá»‡n web

Frontend	Hiá»ƒn thá»‹ vÃ  gá»­i yÃªu cáº§u, khÃ´ng tá»± quyáº¿t Ä‘á»‹nh nghiá»‡p vá»¥
