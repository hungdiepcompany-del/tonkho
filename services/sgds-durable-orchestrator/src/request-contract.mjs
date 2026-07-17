import { SGDS_MAX_BODY_BYTES, SGDS_MUTATION_FLAGS } from './constants.mjs';
import { sgdsError } from './errors.mjs';
import { cloneJson, safeString } from './json.mjs';

const SHA256_RE = /^[a-f0-9]{64}$/i;
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor', 'firestorePath', 'jobId', 'delete', 'cleanup', 'stateOverride', 'completedState', 'retryOverride']);
const PRIVILEGED_FIELDS = new Set([
  'canonicalWriteAllowed',
  'gmailMutationAllowed',
  'driveMutationAllowed',
  'sheetsMutationAllowed'
]);

export function assertJsonContentType(headers = {}) {
  const value = safeString(headers['content-type'] || headers['Content-Type']);
  if (!/^application\/json\b/i.test(value)) throw sgdsError('UNSUPPORTED_CONTENT_TYPE', 415);
}

export function parseJsonBodyText(text) {
  const bodyText = String(text == null ? '' : text);
  if (Buffer.byteLength(bodyText, 'utf8') > SGDS_MAX_BODY_BYTES) throw sgdsError('REQUEST_BODY_TOO_LARGE', 413);
  let body;
  try {
    body = JSON.parse(bodyText || '{}');
  } catch (_error) {
    throw sgdsError('REQUEST_JSON_INVALID', 400);
  }
  rejectDangerousKeys(body);
  return body;
}

export function validateShadowRequest(body) {
  const source = cloneJson(body || {});
  if (source.schemaVersion !== 1) throw sgdsError('REQUEST_SCHEMA_VERSION_INVALID', 400);
  if (source.mode !== 'shadow') throw sgdsError('REQUEST_MODE_INVALID', 400);
  if (Array.isArray(source.candidates)) throw sgdsError('MULTIPLE_CANDIDATES_REJECTED', 400);
  if (!source.candidate || typeof source.candidate !== 'object' || Array.isArray(source.candidate)) throw sgdsError('CANDIDATE_REQUIRED', 400);
  for (const flag of Object.keys(SGDS_MUTATION_FLAGS)) {
    if (source[flag] !== undefined && source[flag] !== false) throw sgdsError('MUTATION_FLAG_REJECTED', 400);
  }
  for (const field of PRIVILEGED_FIELDS) {
    if (source.candidate[field] !== undefined) throw sgdsError('PRIVILEGED_FIELD_REJECTED', 400);
  }
  const candidate = sanitizeCandidate(source.candidate);
  return Object.freeze({
    schemaVersion: 1,
    requestId: safeBoundedString(source.requestId || deterministicRequestId(candidate), 80),
    mode: 'shadow',
    candidate
  });
}

export function sanitizeCandidate(candidate) {
  const sourceType = safeBoundedString(candidate.sourceType, 16).toLowerCase();
  if (!['gmail', 'drive'].includes(sourceType)) throw sgdsError('CANDIDATE_SOURCE_TYPE_INVALID', 400);
  const sourceIdentityHash = safeString(candidate.sourceIdentityHash).toLowerCase();
  const contentIdentityHash = safeString(candidate.contentIdentityHash).toLowerCase();
  if (!SHA256_RE.test(sourceIdentityHash)) throw sgdsError('SOURCE_IDENTITY_HASH_INVALID', 400);
  if (contentIdentityHash && !SHA256_RE.test(contentIdentityHash)) throw sgdsError('CONTENT_IDENTITY_HASH_INVALID', 400);
  return Object.freeze({
    sourceType,
    sourceIdentityHash,
    contentIdentityHash,
    scannerVersion: safeBoundedString(candidate.scannerVersion || 'unknown-scanner', 64),
    receivedAt: safeIsoString(candidate.receivedAt),
    safeMetadata: sanitizeSafeMetadata(candidate.safeMetadata || {})
  });
}

export function rejectDangerousKeys(value, depth = 0) {
  if (depth > 20) throw sgdsError('REQUEST_OBJECT_TOO_DEEP', 400);
  if (Array.isArray(value)) {
    if (value.length > 20) throw sgdsError('REQUEST_ARRAY_TOO_LARGE', 400);
    value.forEach(item => rejectDangerousKeys(item, depth + 1));
    return;
  }
  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      if (BLOCKED_KEYS.has(key)) throw sgdsError('REQUEST_FIELD_REJECTED', 400);
      rejectDangerousKeys(value[key], depth + 1);
    }
  }
}

function sanitizeSafeMetadata(value) {
  if (Array.isArray(value)) return value.slice(0, 8).map(sanitizeSafeMetadata);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort().slice(0, 16)) {
      out[safeBoundedString(key, 40)] = sanitizeSafeMetadata(value[key]);
    }
    return out;
  }
  return safeBoundedString(value, 80);
}

function safeBoundedString(value, max) {
  return safeString(value).replace(/[^\w.:-]/g, '_').slice(0, max);
}

function safeIsoString(value) {
  const text = safeString(value);
  if (!text) return new Date(0).toISOString();
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw sgdsError('RECEIVED_AT_INVALID', 400);
  return date.toISOString();
}

function deterministicRequestId(candidate) {
  return ['req', candidate.sourceType, candidate.sourceIdentityHash.slice(0, 16)].join('-');
}
