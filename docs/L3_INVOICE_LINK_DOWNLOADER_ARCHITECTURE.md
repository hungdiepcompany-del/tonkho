# L3 — Invoice Link Downloader Architecture

Status: ARCHITECTURE / BRANCH-ONLY / NOT DEPLOYED

Baseline: `gas-production@6b16ef51bfcb4455453b528879057a34f4db9eed`

## 1. Goal

Automatically obtain the **original invoice PDF** from supported invoice-email links without weakening the canonical `Hoa-Don` / `Nhap-Xuat!O:P` rules.

The downloader is a transport component only. It MUST NOT decide canonical invoice identity and MUST NOT mutate Gmail, Drive, Google Sheets, or the canonical registry.

## 2. Evidence from L2

- EasyInvoice exact `/Invoice/DownloadInvPdf?token=...`:
  - generic HTTP client returned HTML;
  - stock Chromium downloaded a real `%PDF-` file;
  - therefore the supported strategy is a bounded browser adapter.
- MISA public `meinvoice.vn/tra-cuu/?sc=...`:
  - generic HTTP returned Cloudflare 403;
  - stock Chromium on a cloud runner also returned Cloudflare 403;
  - no stealth, CAPTCHA solving, or anti-bot bypass is authorized.
- Current GAS `tryDownloadPdf_()` is still useful for true direct/static PDFs, but is not sufficient for the two provider cases above.

## 3. Architectural decision

Use a provider coordinator, not a generic anti-bot crawler.

```text
Gmail scanner (IN, LINK last-resort)
        |
        v
GAS LinkDownloadCoordinator
        |
        +-- DIRECT_HTTP -----------------> UrlFetchApp / current cheap path
        |
        +-- EASYINVOICE_BROWSER ---------> private Cloud Run service
        |                                  sgds-invoice-downloader
        |                                  stock Chromium / Playwright
        |                                  returns PDF bytes only
        |
        +-- MISA_PUBLIC_LOOKUP ----------> OFFICIAL_API_REQUIRED
        |                                  no cloud-browser bypass
        |
        +-- unsupported -----------------> MANUAL_REQUIRED

On SUCCESS_ORIGINAL_PDF:
Cloud Run/HTTP bytes -> GAS Blob -> existing PDF validation/parser
                    -> existing canonical metadata logic
                    -> existing Drive save + Hoa-Don registry + O/P flow
```

## 4. Service topology

Create a dedicated Cloud Run service `sgds-invoice-downloader` in the same repository/GCP conventions as `sgds-durable-orchestrator`.

Why separate service:

- `sgds-durable-orchestrator` has a deliberately narrow durable-shadow responsibility;
- browser runtime adds Playwright/Chromium dependencies and a larger image;
- downloader failures/restarts must not affect durable orchestration;
- the downloader can remain stateless and mutation-denied.

This is **not** a second governance stack. Reuse:

- same GCP project and region conventions;
- same Artifact Registry convention;
- same Google ID-token caller authentication pattern;
- same allowed caller email/audience policy;
- same no-key-file policy;
- same GitHub review and deployment gates.

## 5. Trust boundary

### GAS owns

- Gmail message/thread selection;
- link extraction and provider selection;
- canonical invoice validation;
- PDF text/OCR parsing;
- InvoiceKey construction;
- Drive save;
- `Hoa-Don` upsert;
- `Nhap-Xuat!O:P` behavior;
- Gmail labels.

### Downloader owns only

- validate authenticated request;
- validate URL against provider allowlist;
- launch bounded browser for supported provider;
- navigate exact provider flow;
- capture the exact invoice download event;
- validate binary begins `%PDF-` and size is within limits;
- compute SHA-256;
- return original PDF bytes and safe technical headers.

Downloader MUST NOT receive Google Drive/Sheets/Gmail credentials and MUST NOT call those APIs.

## 6. Provider routing

### DIRECT_HTTP

Eligibility:

- HTTPS only;
- no localhost/private-network target;
- static/direct PDF candidate.

Use the cheap GAS HTTP path first. Harden acceptance to validate PDF magic bytes, not only `Content-Type`.

### EASYINVOICE_BROWSER

Allowlisted hosts:

- `*.easyinvoice.vn`
- `*.easyinvoice.com.vn` for legacy-compatible links

Allowlisted email-token routes for v1:

- `/Invoice/DownloadInvPdf`
- `/Invoice/ViewFromEmail`

Selection priority:

1. `DownloadInvPdf` token URL
2. `ViewFromEmail` token URL

The worker must bind success to the exact download/navigation initiated from the supplied invoice-token route. It MUST NOT crawl arbitrary page PDFs. This prevents the L2 false-positive class such as public support/manual PDFs.

No CAPTCHA solving, stealth plugin, fingerprint spoofing, or generic Cloudflare bypass.

### MISA_PUBLIC_LOOKUP

Public `meinvoice.vn/tra-cuu/?sc=...` is not sent to cloud browser in v1.

Required strategy:

1. Prefer official MISA meInvoice Open API when proper MISA-issued ClientId/account authorization is available.
2. Credentials must be stored in an approved secret store, never Script Properties in plaintext logs and never repository files.
3. If official API credentials are unavailable, return `PROVIDER_AUTH_REQUIRED` / `MANUAL_REQUIRED`.
4. A future local-browser option may be evaluated separately, but it is outside L3 v1 and must not be presented as an anti-bot bypass.

## 7. Request contract

`POST /v1/invoice-pdf/download`

Authenticated with Google ID token using the same caller-identity pattern already used by the Cloud Run shadow service.

JSON request:

```json
{
  "schemaVersion": 1,
  "requestId": "invoice-link-<bounded-id>",
  "direction": "IN",
  "sourceUrl": "<private token URL>"
}
```

The raw `sourceUrl` is sensitive. It may exist in request memory but MUST NOT be logged or returned in error text.

Safe audit form contains only:

```json
{
  "host": "0200661889hd.easyinvoice.vn",
  "path": "/Invoice/DownloadInvPdf",
  "queryKeys": ["token"]
}
```

## 8. Response contract

### Success

HTTP 200 body = original PDF bytes.

Required headers:

```text
Content-Type: application/pdf
X-SGDS-Download-Result: SUCCESS_ORIGINAL_PDF
X-SGDS-Downloader-Provider: EASYINVOICE_BROWSER
X-SGDS-PDF-SHA256: <64 hex>
X-SGDS-Request-Id: <requestId>
```

The downloader does not supply InvoiceKey. GAS parses/validates the PDF after return.

### Failure JSON

Possible result states:

- `UNSUPPORTED_PROVIDER`
- `PROVIDER_AUTH_REQUIRED`
- `PROVIDER_BLOCKED`
- `MANUAL_REQUIRED`
- `INVALID_PDF`
- `TRANSIENT_ERROR`

Errors must not contain raw URLs, query values, cookies, authorization headers, or downloaded document content.

## 9. Security invariants

- HTTPS only.
- Provider host/path allowlist; no arbitrary browser navigation supplied by untrusted input.
- Reject localhost, RFC1918/private-network destinations, and local hostnames.
- OIDC-authenticated caller.
- No public unauthenticated downloader endpoint.
- No Google workspace mutation credentials in downloader container.
- Raw invoice token never logged.
- Cookies/session stay in process memory and are discarded after each request.
- Fresh browser context per request.
- Maximum one browser candidate per Gmail thread in v1.
- Bounded navigation/download timeout.
- Bounded PDF byte size.
- Validate `%PDF-` before success.
- Do not scan/capture unrelated PDFs from the page.
- No CAPTCHA solving or anti-bot bypass.

## 10. GAS integration

Do not replace scanner architecture.

Current integration point remains `scanInvoiceInEmails_()` -> LINK last-resort.

Introduce a coordinator conceptually equivalent to:

```text
tryDownloadInvoicePdf_(links)
    -> select best supported link
    -> DIRECT_HTTP: hardened UrlFetch
    -> EASYINVOICE_BROWSER: call private downloader once
    -> MISA: AUTH_REQUIRED/MANUAL_REQUIRED
    -> return {status, blob?, provider, safeSource}
```

Only `SUCCESS_ORIGINAL_PDF` may enter the existing:

```text
extractPdfText_
isVatInvoicePDF_
extractVatMetaFromPDFText_
buildVatPdfFileName_
saveInvoicePdfToDrive_
upsertHoaDonFile_
```

The existing Slides-generated "link archive PDF" is not an original invoice and MUST NOT be registered as if it were one. In the future it may be retained only as a separately typed diagnostic artifact (`LINK_ARCHIVE`), or disabled for canonical registry flows.

## 11. Retry semantics

- `TRANSIENT_ERROR`: keep thread pending; retry on later natural scanner run.
- `PROVIDER_BLOCKED`: keep pending but apply bounded retry/backoff; do not hammer provider.
- `PROVIDER_AUTH_REQUIRED`: do not repeatedly invoke browser; surface as operator/configuration action.
- `MANUAL_REQUIRED`: no automatic retry loop until state/source changes.
- `INVALID_PDF`: fail closed; never save/register blob as invoice.
- `SUCCESS_ORIGINAL_PDF`: continue existing canonical validation and only then mutate Drive/registry according to existing rules.

No new Gmail labels are required in L3A. Any label/state expansion is a later explicit design decision.

## 12. Rollout gates

### L3A — Architecture + contract (current)

- Model ceiling: GPT-5.6 Sol / Cao.
- Work: provider routing, request/result contract, security invariants, unit tests.
- Mutation: branch-only.
- Complete when contract tests and existing full suite pass.

### L3B — EasyInvoice worker implementation

- Recommended: GPT-5.6 Terra / Cao; raise to Sol/Cao only for security/runtime ambiguity.
- Build dedicated Playwright service and deterministic EasyInvoice adapter.
- Tests: mocked provider + encrypted real-link CI probe; no production deploy.
- Complete when exact-token PDF is retrieved and unrelated-page-PDF false positives are rejected.

### L3C — MISA official API feasibility

- Recommended: GPT-5.6 Sol / Cao because external credential/product contract is involved.
- Confirm whether the business can obtain/use MISA incoming-invoice Open API credentials.
- No credentials -> `MANUAL_REQUIRED`; do not substitute Cloudflare bypass.

### L3D — GAS shadow integration

- Recommended: GPT-5.6 Terra / Cao.
- Call downloader in shadow/read-only mode for one selected link; no Drive/Sheet/Gmail mutation from the new path.
- Complete when returned PDF passes existing GAS invoice parser and canonical identity validation.

### L3E — One-invoice production pilot

- Explicit Owner GO required.
- One bounded EasyInvoice candidate only.
- Verify exact PDF, InvoiceKey, Drive file, registry, O/P and labels.

### L3F — Production rollout

- Explicit Owner GO required.
- Merge/deploy only after CI + pilot PASS.

## 13. Non-goals

- generic web scraping;
- Cloudflare bypass;
- CAPTCHA solving;
- browser automation for arbitrary links;
- modifying `Nhap-Xuat!A:N`;
- changing canonical InvoiceKey rules;
- making Cloud Run write Gmail/Drive/Sheets;
- mass reconciliation during deploy.
