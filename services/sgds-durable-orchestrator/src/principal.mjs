import { SGDS_RUNTIME_PRINCIPAL } from './constants.mjs';
import { sgdsError } from './errors.mjs';
import { safeString } from './json.mjs';

const METADATA_BASE = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default';

export function createMetadataPrincipalInspector({ fetchImpl = globalThis.fetch, expectedPrincipal = SGDS_RUNTIME_PRINCIPAL } = {}) {
  return async function inspectRuntimePrincipal() {
    const response = await fetchImpl(`${METADATA_BASE}/email`, { headers: { 'Metadata-Flavor': 'Google' } });
    if (!response.ok) throw sgdsError('BLOCKED_RUNTIME_PRINCIPAL_UNVERIFIABLE', 503);
    const actual = safeString(await response.text());
    if (actual !== expectedPrincipal) throw sgdsError('BLOCKED_RUNTIME_PRINCIPAL_MISMATCH', 500);
    return Object.freeze({ actualRuntimePrincipal: actual, expectedRuntimePrincipal: expectedPrincipal, adcMode: 'ATTACHED_SERVICE_IDENTITY' });
  };
}

export function createStaticPrincipalInspector(actualPrincipal = SGDS_RUNTIME_PRINCIPAL) {
  return async function inspectRuntimePrincipal(config) {
    const expected = safeString(config && config.expectedRuntimePrincipal || SGDS_RUNTIME_PRINCIPAL);
    if (actualPrincipal !== expected) throw sgdsError('BLOCKED_RUNTIME_PRINCIPAL_MISMATCH', 500);
    return Object.freeze({ actualRuntimePrincipal: actualPrincipal, expectedRuntimePrincipal: expected, adcMode: 'ATTACHED_SERVICE_IDENTITY' });
  };
}
