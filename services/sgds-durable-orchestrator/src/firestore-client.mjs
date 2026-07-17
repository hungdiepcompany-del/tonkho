import { sgdsError } from './errors.mjs';

export function createMetadataAccessTokenProvider({ fetchImpl = globalThis.fetch } = {}) {
  return async function getAccessToken() {
    const response = await fetchImpl('http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token', {
      headers: { 'Metadata-Flavor': 'Google' }
    });
    if (!response.ok) throw sgdsError('FIRESTORE_ADC_TOKEN_UNAVAILABLE', 503);
    const body = await response.json();
    if (!body.access_token) throw sgdsError('FIRESTORE_ADC_TOKEN_UNAVAILABLE', 503);
    return body.access_token;
  };
}

export function createFirestoreRestClient({ projectId, databaseId, tokenProvider, fetchImpl = globalThis.fetch }) {
  if (typeof tokenProvider !== 'function') throw sgdsError('FIRESTORE_TOKEN_PROVIDER_REQUIRED', 500);
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}`;

  async function request(method, suffix, body) {
    const token = await tokenProvider();
    const response = await fetchImpl(`${base}${suffix}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-goog-user-project': projectId
      },
      body: body == null ? undefined : JSON.stringify(body)
    });
    if (response.status === 404) return null;
    const text = await response.text();
    const parsed = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const error = sgdsError(`FIRESTORE_${response.status}`, response.status);
      error.details = parsed && parsed.error && parsed.error.status;
      throw error;
    }
    return parsed;
  }

  return Object.freeze({
    async getDocument(relativePath) {
      return request('GET', `/documents/${relativePath}`, null);
    },
    async commitCreates(documents) {
      const writes = documents.map(doc => ({
        update: {
          name: `projects/${projectId}/databases/${databaseId}/documents/${doc.path}`,
          fields: toFirestoreFields(doc.body)
        },
        currentDocument: { exists: false }
      }));
      return request('POST', '/documents:commit', { writes });
    },
    async getDatabaseMetadata() {
      return request('GET', '', null);
    }
  });
}

export function toFirestoreFields(object) {
  const fields = {};
  for (const [key, value] of Object.entries(object || {})) fields[key] = toFirestoreValue(value);
  return fields;
}

export function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(toFirestoreValue) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreFields(value) } };
  return { stringValue: String(value) };
}

export function fromFirestoreDocument(document) {
  const fields = (document && document.fields) || {};
  const out = {};
  for (const [key, value] of Object.entries(fields)) out[key] = fromFirestoreValue(value);
  return out;
}

function fromFirestoreValue(value) {
  if (!value || Object.prototype.hasOwnProperty.call(value, 'nullValue')) return null;
  if (Object.prototype.hasOwnProperty.call(value, 'stringValue')) return value.stringValue;
  if (Object.prototype.hasOwnProperty.call(value, 'booleanValue')) return value.booleanValue;
  if (Object.prototype.hasOwnProperty.call(value, 'integerValue')) return Number(value.integerValue);
  if (Object.prototype.hasOwnProperty.call(value, 'doubleValue')) return Number(value.doubleValue);
  if (Object.prototype.hasOwnProperty.call(value, 'arrayValue')) return ((value.arrayValue && value.arrayValue.values) || []).map(fromFirestoreValue);
  if (Object.prototype.hasOwnProperty.call(value, 'mapValue')) return fromFirestoreDocument({ fields: (value.mapValue && value.mapValue.fields) || {} });
  return '';
}
