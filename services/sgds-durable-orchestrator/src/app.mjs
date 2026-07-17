import { createAuthVerifier } from './auth.mjs';
import { loadRuntimeConfig } from './config.mjs';
import { SGDS_ORCHESTRATOR_VERSION } from './constants.mjs';
import { createDurableShadowService } from './durable-shadow.mjs';
import { publicError, sgdsError } from './errors.mjs';
import { createFirestoreRestClient, createMetadataAccessTokenProvider } from './firestore-client.mjs';
import { createMetadataPrincipalInspector } from './principal.mjs';
import { assertJsonContentType, parseJsonBodyText, validateShadowRequest } from './request-contract.mjs';
import { createWorkspaceDenyAdapters } from './workspace-deny-adapters.mjs';

export function createApp(options = {}) {
  const env = options.env || process.env;
  const config = options.config || loadRuntimeConfig(env);
  const principalInspector = options.principalInspector || createMetadataPrincipalInspector({ expectedPrincipal: config.expectedRuntimePrincipal });
  const authVerifier = options.authVerifier || createAuthVerifier({ config });
  const firestoreClient = options.firestoreClient || createFirestoreRestClient({
    projectId: config.projectId,
    databaseId: config.databaseId,
    tokenProvider: options.tokenProvider || createMetadataAccessTokenProvider(),
    fetchImpl: options.fetchImpl || globalThis.fetch
  });
  const shadow = options.shadowService || createDurableShadowService({ firestoreClient, clock: options.clock });
  const workspaceDenyAdapters = options.workspaceDenyAdapters || createWorkspaceDenyAdapters();

  async function handle(request) {
    try {
      const method = String(request.method || 'GET').toUpperCase();
      const pathname = request.pathname || new URL(request.url || '/', 'http://localhost').pathname;
      if (method === 'GET' && pathname === '/healthz') return json(200, health());
      if (method === 'GET' && pathname === '/readyz') return json(200, await ready());
      if (method === 'POST' && pathname === '/v1/shadow/plan') return json(200, await handleShadow(request, 'plan'));
      if (method === 'POST' && pathname === '/v1/shadow/submit') return json(200, await handleShadow(request, 'submit'));
      throw sgdsError('ROUTE_NOT_FOUND', 404);
    } catch (error) {
      return json(error.status || 500, publicError(error));
    }
  }

  function health() {
    return {
      ok: true,
      service: 'sgds-durable-orchestrator',
      version: SGDS_ORCHESTRATOR_VERSION,
      status: 'HEALTHY',
      firestoreOperation: 'NONE'
    };
  }

  async function ready() {
    const principal = await principalInspector(config);
    if (config.firestoreReadinessReadEnabled && typeof firestoreClient.getDatabaseMetadata === 'function') {
      await firestoreClient.getDatabaseMetadata();
    }
    return {
      ok: true,
      service: 'sgds-durable-orchestrator',
      version: SGDS_ORCHESTRATOR_VERSION,
      status: 'READY',
      runtimePrincipalAssertion: 'PASS',
      actualRuntimePrincipal: principal.actualRuntimePrincipal,
      canonicalWritesEnabled: false,
      workspaceApis: 'DENIED'
    };
  }

  async function handleShadow(request, operation) {
    assertJsonContentType(request.headers || {});
    const caller = await authVerifier(request.headers || {});
    const body = parseJsonBodyText(request.bodyText || '');
    const shadowRequest = validateShadowRequest(body);
    assertWorkspaceAdaptersDeny(workspaceDenyAdapters);
    await principalInspector(config);
    return operation === 'plan'
      ? shadow.plan(shadowRequest, caller)
      : shadow.submit(shadowRequest, caller);
  }

  return Object.freeze({ handle, health });
}

export function json(status, body) {
  return Object.freeze({
    status,
    headers: Object.freeze({ 'content-type': 'application/json; charset=utf-8' }),
    body
  });
}

function assertWorkspaceAdaptersDeny(adapters) {
  for (const group of Object.values(adapters || {})) {
    for (const value of Object.values(group || {})) {
      if (typeof value !== 'function') throw sgdsError('WORKSPACE_DENY_ADAPTER_INVALID', 500);
    }
  }
}
