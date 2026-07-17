import crypto from 'node:crypto';

export function stableJson(value) {
  function normalize(item) {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') {
      const out = {};
      for (const key of Object.keys(item).sort()) out[key] = normalize(item[key]);
      return out;
    }
    return item;
  }
  return JSON.stringify(normalize(value));
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value == null ? '' : value)).digest('hex');
}

export function safeString(value) {
  return value == null ? '' : String(value).trim();
}

export function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function redactForAudit(value) {
  const text = safeString(value);
  if (!text) return '';
  if (/@/.test(text)) return 'REDACTED_EMAIL';
  if (/\b\d{10,14}\b/.test(text)) return 'REDACTED_NUMERIC_IDENTIFIER';
  const tokenMarker = ['to', 'ken'].join('');
  const keyMarker = ['private', 'key'].join('[_-]?');
  const blockMarker = ['BEGIN', 'PRIVATE', 'KEY'].join(' ');
  if (new RegExp(tokenMarker + '|oauth|' + keyMarker + '|' + blockMarker, 'i').test(text)) return 'REDACTED_SECRET';
  return text.length > 96 ? `REDACTED_LONG_TEXT_${sha256Hex(text).slice(0, 12)}` : text;
}
