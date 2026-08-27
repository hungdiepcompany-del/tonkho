export const DOWNLOADER_SCHEMA_VERSION = 1;

export const DOWNLOAD_PROVIDER = Object.freeze({
  DIRECT_HTTP: 'DIRECT_HTTP',
  EASYINVOICE_BROWSER: 'EASYINVOICE_BROWSER',
  MISA_PUBLIC_LOOKUP: 'MISA_PUBLIC_LOOKUP',
  UNSUPPORTED: 'UNSUPPORTED'
});

export const DOWNLOAD_STRATEGY = Object.freeze({
  DIRECT_HTTP: 'DIRECT_HTTP',
  CLOUD_BROWSER: 'CLOUD_BROWSER',
  OFFICIAL_API_REQUIRED: 'OFFICIAL_API_REQUIRED',
  NONE: 'NONE'
});

export const DOWNLOAD_RESULT = Object.freeze({
  SUCCESS_ORIGINAL_PDF: 'SUCCESS_ORIGINAL_PDF',
  UNSUPPORTED_PROVIDER: 'UNSUPPORTED_PROVIDER',
  PROVIDER_AUTH_REQUIRED: 'PROVIDER_AUTH_REQUIRED',
  PROVIDER_BLOCKED: 'PROVIDER_BLOCKED',
  MANUAL_REQUIRED: 'MANUAL_REQUIRED',
  INVALID_PDF: 'INVALID_PDF',
  TRANSIENT_ERROR: 'TRANSIENT_ERROR'
});

const EASYINVOICE_HOST_RE = /(^|\.)(easyinvoice\.vn|easyinvoice\.com\.vn)$/i;
const MISA_HOST_RE = /(^|\.)meinvoice\.vn$/i;
const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function classifyInvoiceLink(rawUrl) {
  const url = parseHttpsUrl(rawUrl);
  const host = url.hostname.toLowerCase();
  const pathname = url.pathname || '/';

  if (EASYINVOICE_HOST_RE.test(host)) {
    const directDownload = /\/Invoice\/DownloadInvPdf\/?$/i.test(pathname);
    const viewFromEmail = /\/Invoice\/ViewFromEmail\/?$/i.test(pathname);
    return Object.freeze({
      provider: DOWNLOAD_PROVIDER.EASYINVOICE_BROWSER,
      strategy: DOWNLOAD_STRATEGY.CLOUD_BROWSER,
      supported: directDownload || viewFromEmail,
      score: directDownload ? 100 : viewFromEmail ? 80 : 20,
      reason: directDownload
        ? 'EASYINVOICE_DIRECT_DOWNLOAD_TOKEN'
        : viewFromEmail
          ? 'EASYINVOICE_VIEW_TOKEN'
          : 'EASYINVOICE_PATH_NOT_ALLOWLISTED',
      safeSource: sanitizeUrl(url)
    });
  }

  if (MISA_HOST_RE.test(host)) {
    const publicLookup = /^\/tra-cuu\/?$/i.test(pathname);
    return Object.freeze({
      provider: DOWNLOAD_PROVIDER.MISA_PUBLIC_LOOKUP,
      strategy: DOWNLOAD_STRATEGY.OFFICIAL_API_REQUIRED,
      supported: false,
      score: publicLookup ? 70 : 10,
      reason: publicLookup
        ? 'MISA_PUBLIC_LOOKUP_REQUIRES_OFFICIAL_API_OR_MANUAL'
        : 'MISA_PATH_NOT_ALLOWLISTED',
      safeSource: sanitizeUrl(url)
    });
  }

  if (/\.pdf$/i.test(pathname)) {
    return Object.freeze({
      provider: DOWNLOAD_PROVIDER.DIRECT_HTTP,
      strategy: DOWNLOAD_STRATEGY.DIRECT_HTTP,
      supported: true,
      score: 90,
      reason: 'DIRECT_HTTPS_PDF_PATH',
      safeSource: sanitizeUrl(url)
    });
  }

  return Object.freeze({
    provider: DOWNLOAD_PROVIDER.UNSUPPORTED,
    strategy: DOWNLOAD_STRATEGY.NONE,
    supported: false,
    score: 0,
    reason: 'UNSUPPORTED_PROVIDER',
    safeSource: sanitizeUrl(url)
  });
}

export function selectBestInvoiceLink(rawLinks = []) {
  const candidates = [];
  for (const raw of rawLinks || []) {
    try {
      const classification = classifyInvoiceLink(raw);
      candidates.push({ rawUrl: String(raw), ...classification });
    } catch (_error) {
      // Invalid/non-HTTPS URLs are fail-closed and never become worker candidates.
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0] || null;
}

export function validateDownloaderRequest(body = {}) {
  if (Number(body.schemaVersion) !== DOWNLOADER_SCHEMA_VERSION) throw new Error('DOWNLOADER_SCHEMA_VERSION_INVALID');
  const requestId = String(body.requestId || '');
  if (!REQUEST_ID_RE.test(requestId)) throw new Error('DOWNLOADER_REQUEST_ID_INVALID');
  if (String(body.direction || '').toUpperCase() !== 'IN') throw new Error('DOWNLOADER_DIRECTION_INVALID');

  const classification = classifyInvoiceLink(body.sourceUrl);
  if (!classification.supported) {
    if (classification.provider === DOWNLOAD_PROVIDER.MISA_PUBLIC_LOOKUP) {
      throw new Error('DOWNLOADER_MISA_OFFICIAL_API_REQUIRED');
    }
    throw new Error('DOWNLOADER_SOURCE_NOT_SUPPORTED');
  }

  return Object.freeze({
    schemaVersion: DOWNLOADER_SCHEMA_VERSION,
    requestId,
    direction: 'IN',
    provider: classification.provider,
    sourceUrl: String(body.sourceUrl),
    safeSource: classification.safeSource,
    canonicalWriteAllowed: false,
    gmailMutationAllowed: false,
    driveMutationAllowed: false,
    sheetsMutationAllowed: false
  });
}

export function sanitizeUrl(rawUrl) {
  const url = rawUrl instanceof URL ? rawUrl : parseHttpsUrl(rawUrl);
  return Object.freeze({
    host: url.hostname.toLowerCase(),
    path: url.pathname || '/',
    queryKeys: [...new Set([...url.searchParams.keys()])].sort()
  });
}

function parseHttpsUrl(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || ''));
  } catch (_error) {
    throw new Error('DOWNLOADER_URL_INVALID');
  }
  if (url.protocol !== 'https:') throw new Error('DOWNLOADER_HTTPS_REQUIRED');
  if (!url.hostname || isPrivateOrLocalHost(url.hostname)) throw new Error('DOWNLOADER_HOST_REJECTED');
  return url;
}

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return true;
  const m = host.match(/^172\.(\d{1,3})\./);
  if (m && Number(m[1]) >= 16 && Number(m[1]) <= 31) return true;
  if (host === '0.0.0.0' || host === '::1') return true;
  return false;
}
