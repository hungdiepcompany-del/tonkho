import fs from 'node:fs';
import {GoogleAuth} from 'google-auth-library';

const report = {
  mode: 'READ_ONLY_HTTP_PROBE',
  productionMutation: false,
  gmailMutation: false,
  driveMutation: false,
  sheetMutation: false,
  providers: []
};

function loadCredential() {
  const raw = JSON.parse(fs.readFileSync(process.env.HOME + '/.clasprc.json', 'utf8').replace(/^\uFEFF/, ''));
  if (raw?.tokens?.default) return raw.tokens.default;
  if (raw?.token) {
    return {
      type: 'authorized_user',
      ...raw.token,
      client_id: raw?.oauth2ClientSettings?.clientId,
      client_secret: raw?.oauth2ClientSettings?.clientSecret
    };
  }
  if (raw?.access_token || raw?.refresh_token) return {type: 'authorized_user', ...raw};
  throw new Error('NO_USABLE_CLASP_CREDENTIAL');
}

function b64urlDecode(s='') {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  return Buffer.from((s + pad).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function collectBodies(part, out=[]) {
  if (!part) return out;
  if ((part.mimeType === 'text/html' || part.mimeType === 'text/plain') && part?.body?.data) out.push(b64urlDecode(part.body.data));
  for (const p of part.parts || []) collectBodies(p, out);
  return out;
}

function decodeHtmlEntities(s) {
  return String(s || '').replace(/&amp;/gi, '&').replace(/&#38;/g, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'");
}

function extractUrls(text) {
  const matches = String(text || '').match(/https?:\/\/[^\s"'<>]+/gi) || [];
  return [...new Set(matches.map(decodeHtmlEntities))];
}

function sanitizeUrl(raw) {
  try {
    const u = new URL(raw);
    return {host: u.hostname, path: u.pathname, queryKeys: [...u.searchParams.keys()].sort()};
  } catch {
    return {host: 'INVALID', path: '', queryKeys: []};
  }
}

function firstBytesLabel(buf) {
  if (!buf?.length) return 'EMPTY';
  const head = buf.subarray(0, Math.min(8, buf.length)).toString('latin1');
  if (head.startsWith('%PDF-')) return '%PDF-';
  return head.replace(/[^\x20-\x7E]/g, '.');
}

async function tokenInfo(accessToken) {
  const res = await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + encodeURIComponent(accessToken));
  if (!res.ok) throw new Error('TOKENINFO_HTTP_' + res.status);
  return await res.json();
}

async function gmailMessage(accessToken, id) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, {headers: {Authorization: `Bearer ${accessToken}`}});
  if (!res.ok) throw new Error('GMAIL_HTTP_' + res.status);
  return await res.json();
}

async function probeUrl(provider, rawUrl) {
  const source = sanitizeUrl(rawUrl);
  const started = Date.now();
  const res = await fetch(rawUrl, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; L2InvoiceProbe/1.0)',
      'Accept': 'application/pdf,text/html,application/xhtml+xml,*/*;q=0.8'
    }
  });
  const buf = Buffer.from(await res.arrayBuffer());
  const final = sanitizeUrl(res.url);
  const ct = res.headers.get('content-type') || '';
  const cd = res.headers.get('content-disposition') || '';
  const isPdfMagic = buf.subarray(0, 5).toString('latin1') === '%PDF-';
  const item = {
    provider,
    source,
    httpStatus: res.status,
    contentType: ct,
    hasContentDisposition: Boolean(cd),
    contentDispositionMentionsPdf: /\.pdf/i.test(cd),
    bytes: buf.length,
    firstBytes: firstBytesLabel(buf),
    pdfMagic: isPdfMagic,
    final,
    elapsedMs: Date.now() - started
  };
  if (/text\/html/i.test(ct) || (!isPdfMagic && buf.length < 5_000_000)) {
    const html = buf.toString('utf8');
    const candidates = extractUrls(html).filter(u => /pdf|download|invoice|api/i.test(u)).slice(0, 20).map(sanitizeUrl);
    item.htmlCandidateCount = candidates.length;
    item.htmlCandidates = candidates;
    item.hasCaptchaText = /captcha|recaptcha|m[aã]\s*x[aá]c\s*th[uự]c/i.test(html);
  }
  return item;
}

try {
  const stored = loadCredential();
  const auth = new GoogleAuth().fromJSON(stored);
  auth.setCredentials(stored);
  const tokenResult = await auth.getAccessToken();
  const accessToken = typeof tokenResult === 'string' ? tokenResult : tokenResult?.token;
  if (!accessToken) throw new Error('NO_ACCESS_TOKEN');

  const info = await tokenInfo(accessToken);
  const scopes = String(info.scope || stored.scope || '').split(/\s+/).filter(Boolean);
  const hasGmailScope = scopes.some(s => s === 'https://mail.google.com/' || s.startsWith('https://www.googleapis.com/auth/gmail.'));
  report.claspCredentialHasGmailScope = hasGmailScope;
  console.log('CLASP_CREDENTIAL_GMAIL_SCOPE=' + (hasGmailScope ? 'PASS' : 'MISSING'));

  if (!hasGmailScope) {
    report.status = 'BLOCKED_NO_GMAIL_SCOPE';
    fs.writeFileSync('l2-probe-report.json', JSON.stringify(report, null, 2));
    process.exit(0);
  }

  const cases = [
    {provider: 'EASYINVOICE', messageId: '19fe0cbc6bf44ea4'},
    {provider: 'MISA', messageId: '19fa7ed741736eaa'}
  ];

  for (const c of cases) {
    const msg = await gmailMessage(accessToken, c.messageId);
    const urls = [...new Set(collectBodies(msg.payload, []).flatMap(extractUrls))];
    let selected = '';
    if (c.provider === 'EASYINVOICE') selected = urls.find(u => /easyinvoice\.vn\/Invoice\/DownloadInvPdf\?/i.test(u)) || '';
    else selected = urls.find(u => /meinvoice\.vn\/tra-cuu\/\?/i.test(u) && /[?&]sc=/i.test(u)) || '';

    if (!selected) {
      report.providers.push({provider: c.provider, status: 'SOURCE_URL_NOT_FOUND'});
      continue;
    }

    try {
      const result = await probeUrl(c.provider, selected);
      result.status = 'PROBED';
      report.providers.push(result);
      console.log(`${c.provider}_HTTP_STATUS=${result.httpStatus}`);
      console.log(`${c.provider}_CONTENT_TYPE=${result.contentType || 'NONE'}`);
      console.log(`${c.provider}_PDF_MAGIC=${result.pdfMagic ? 'PASS' : 'NO'}`);
      console.log(`${c.provider}_FINAL_HOST=${result.final.host}`);
      console.log(`${c.provider}_FINAL_PATH=${result.final.path}`);
      console.log(`${c.provider}_BYTES=${result.bytes}`);
    } catch (e) {
      report.providers.push({provider: c.provider, status: 'PROBE_ERROR', error: String(e?.message || e)});
      console.log(`${c.provider}_PROBE=ERROR`);
    }
  }
  report.status = 'COMPLETED';
} catch (e) {
  report.status = 'HARNESS_ERROR';
  report.error = String(e?.message || e);
  console.log('L2_HARNESS=ERROR');
}

fs.writeFileSync('l2-probe-report.json', JSON.stringify(report, null, 2));
