import crypto from 'node:crypto';
import { sgdsError } from './errors.mjs';
import { redactForAudit, safeString } from './json.mjs';

export function createAuthVerifier({ config, fetchImpl = globalThis.fetch, certsUrl = 'https://www.googleapis.com/oauth2/v1/certs' } = {}) {
  if (!config) throw sgdsError('AUTH_CONFIG_REQUIRED', 500);
  return async function verifyAuthorization(headers = {}) {
    const header = safeString(headers.authorization || headers.Authorization);
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    if (!token) throw sgdsError('AUTH_TOKEN_REQUIRED', 401);
    const claims = await verifyGoogleIdToken({ token, fetchImpl, certsUrl });
    validateClaims(claims, config);
    return auditClaims(claims);
  };
}

export function createStaticAuthVerifier(claims) {
  return async function verifyAuthorization(headers = {}) {
    const header = safeString(headers.authorization || headers.Authorization);
    if (!header.startsWith('Bearer ')) throw sgdsError('AUTH_TOKEN_REQUIRED', 401);
    return auditClaims(claims);
  };
}

export async function verifyGoogleIdToken({ token, fetchImpl = globalThis.fetch, certsUrl }) {
  const parts = safeString(token).split('.');
  if (parts.length !== 3) throw sgdsError('AUTH_TOKEN_MALFORMED', 401);
  const header = parseJwtPart(parts[0]);
  const payload = parseJwtPart(parts[1]);
  if (header.alg !== 'RS256') throw sgdsError('AUTH_TOKEN_ALGORITHM_REJECTED', 401);
  const certsResponse = await fetchImpl(certsUrl);
  if (!certsResponse.ok) throw sgdsError('AUTH_CERTS_UNAVAILABLE', 503);
  const certs = await certsResponse.json();
  const cert = certs && certs[header.kid];
  if (!cert) throw sgdsError('AUTH_CERT_NOT_FOUND', 401);
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(cert, parts[2], 'base64url')) throw sgdsError('AUTH_TOKEN_SIGNATURE_INVALID', 401);
  return payload;
}

export function validateClaims(claims, config) {
  const issuer = safeString(claims.iss);
  if (!['https://accounts.google.com', 'accounts.google.com'].includes(issuer)) throw sgdsError('AUTH_ISSUER_REJECTED', 401);
  const exp = Number(claims.exp || 0);
  if (!Number.isFinite(exp) || exp * 1000 <= Date.now()) throw sgdsError('AUTH_TOKEN_EXPIRED', 401);
  const aud = safeString(claims.aud);
  if (!config.allowedCallerAudiences.includes(aud)) throw sgdsError('AUTH_AUDIENCE_REJECTED', 403);
  const email = safeString(claims.email);
  if (!email) throw sgdsError('AUTH_EMAIL_REQUIRED', 403);
  if (config.allowedCallerEmails.length && !config.allowedCallerEmails.includes(email)) throw sgdsError('AUTH_EMAIL_REJECTED', 403);
}

export function auditClaims(claims = {}) {
  return Object.freeze({
    email: redactForAudit(claims.email),
    subject: safeString(claims.sub).slice(0, 64),
    audience: safeString(claims.aud).slice(0, 256),
    issuer: safeString(claims.iss).slice(0, 64),
    expiry: Number(claims.exp || 0)
  });
}

function parseJwtPart(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch (_error) {
    throw sgdsError('AUTH_TOKEN_MALFORMED', 401);
  }
}
