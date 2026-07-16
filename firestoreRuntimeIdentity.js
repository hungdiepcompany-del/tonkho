const SGDS_FIRESTORE_RUNTIME_MODES_ = Object.freeze([
  'emulator',
  'manual-owner-smoke',
  'service-account-impersonation',
  'attached-workload-identity',
  'dedicated-service-account'
]);

const SGDS_FIRESTORE_AUTOMATION_MODES_ = Object.freeze([
  'service-account-impersonation',
  'attached-workload-identity',
  'dedicated-service-account'
]);

const SGDS_FIRESTORE_REQUIRED_ENV_NAMES_ = Object.freeze([
  'SGDS_FIRESTORE_PROJECT_ID',
  'SGDS_FIRESTORE_DATABASE_ID',
  'SGDS_FIRESTORE_RUNTIME_MODE',
  'SGDS_FIRESTORE_EXPECTED_PRINCIPAL'
]);

function createFirestoreRuntimeCredentialProvider(options) {
  const opts = options || {};
  const env = opts.env || {};
  const config = validateFirestoreRuntimeIdentityConfig(env);
  const actualPrincipalResolver = requireD5MFunction_(opts.actualPrincipalResolver, 'actualPrincipalResolver');
  const tokenProvider = opts.tokenProvider || null;

  async function inspectPrincipal() {
    const actualPrincipal = safeD5MString_(await actualPrincipalResolver(config));
    assertFirestoreRuntimePrincipal(config, actualPrincipal);
    return {
      projectId: config.projectId,
      databaseId: config.databaseId,
      runtimeMode: config.runtimeMode,
      expectedPrincipal: config.expectedPrincipal,
      actualPrincipal,
      keyless: config.keyFileCredential === 'ABSENT',
      productionAutomation: config.productionAutomation,
      manualOwnerSmoke: config.manualOwnerSmoke
    };
  }

  async function getAccessToken() {
    const principal = await inspectPrincipal();
    if (typeof tokenProvider !== 'function') {
      return {
        ...principal,
        accessTokenAvailable: false,
        tokenMaterialReturned: false
      };
    }
    const token = await tokenProvider(config);
    if (!token) throw d5mError_('FIRESTORE_RUNTIME_TOKEN_UNAVAILABLE');
    return {
      ...principal,
      accessTokenAvailable: true,
      tokenMaterialReturned: false
    };
  }

  return Object.freeze({
    getConfig() {
      return cloneD5MJson_(config);
    },
    inspectPrincipal,
    getAccessToken
  });
}

function validateFirestoreRuntimeIdentityConfig(env) {
  const source = env || {};
  const missing = SGDS_FIRESTORE_REQUIRED_ENV_NAMES_.filter(name => !safeD5MString_(source[name]));
  if (missing.length) throw d5mError_('FIRESTORE_RUNTIME_ENV_REQUIRED:' + missing.join(','));
  const projectId = safeD5MString_(source.SGDS_FIRESTORE_PROJECT_ID);
  const databaseId = safeD5MString_(source.SGDS_FIRESTORE_DATABASE_ID);
  const runtimeMode = safeD5MString_(source.SGDS_FIRESTORE_RUNTIME_MODE);
  const expectedPrincipal = safeD5MString_(source.SGDS_FIRESTORE_EXPECTED_PRINCIPAL);
  const allowManualOwnerSmoke = source.SGDS_FIRESTORE_ALLOW_MANUAL_OWNER_SMOKE === true ||
    safeD5MString_(source.SGDS_FIRESTORE_ALLOW_MANUAL_OWNER_SMOKE).toLowerCase() === 'true';

  if (!SGDS_FIRESTORE_RUNTIME_MODES_.includes(runtimeMode)) throw d5mError_('FIRESTORE_RUNTIME_MODE_UNSUPPORTED');
  if (source.GOOGLE_APPLICATION_CREDENTIALS) throw d5mError_('FIRESTORE_RUNTIME_KEY_FILE_FORBIDDEN');
  if (/longthaisteel[.]com/i.test(expectedPrincipal)) throw d5mError_('FIRESTORE_RUNTIME_PRINCIPAL_FORBIDDEN');

  const productionAutomation = SGDS_FIRESTORE_AUTOMATION_MODES_.includes(runtimeMode);
  const manualOwnerSmoke = runtimeMode === 'manual-owner-smoke';
  if (manualOwnerSmoke && !allowManualOwnerSmoke) throw d5mError_('FIRESTORE_MANUAL_OWNER_SMOKE_FLAG_REQUIRED');
  if (manualOwnerSmoke && !/@gmail[.]com$/i.test(expectedPrincipal)) throw d5mError_('FIRESTORE_MANUAL_OWNER_PRINCIPAL_EXPECTED');
  if (productionAutomation && !/@[^@]+[.]iam[.]gserviceaccount[.]com$/i.test(expectedPrincipal)) {
    throw d5mError_('FIRESTORE_AUTOMATION_SA_REQUIRED');
  }
  if (runtimeMode === 'dedicated-service-account' && /@gmail[.]com$/i.test(expectedPrincipal)) {
    throw d5mError_('FIRESTORE_OWNER_PRINCIPAL_USED_FOR_AUTOMATION');
  }

  return Object.freeze({
    projectId,
    databaseId,
    runtimeMode,
    expectedPrincipal,
    productionAutomation,
    manualOwnerSmoke,
    keyFileCredential: 'ABSENT',
    serviceAccountKeyMode: 'FORBIDDEN'
  });
}

function assertFirestoreRuntimePrincipal(config, actualPrincipal) {
  const expected = safeD5MString_(config && config.expectedPrincipal);
  const actual = safeD5MString_(actualPrincipal);
  if (!actual) throw d5mError_('FIRESTORE_RUNTIME_PRINCIPAL_UNVERIFIABLE');
  if (actual !== expected) throw d5mError_('FIRESTORE_RUNTIME_PRINCIPAL_MISMATCH');
  if (config && config.productionAutomation && /@gmail[.]com$/i.test(actual)) {
    throw d5mError_('FIRESTORE_OWNER_PRINCIPAL_USED_FOR_AUTOMATION');
  }
  return true;
}

function requireD5MFunction_(value, name) {
  if (typeof value !== 'function') throw d5mError_('FIRESTORE_RUNTIME_DEPENDENCY_REQUIRED:' + name);
  return value;
}

function d5mError_(code) {
  const error = new Error(code);
  error.code = String(code).split(':')[0];
  return error;
}

function safeD5MString_(value) {
  return value == null ? '' : String(value).trim();
}

function cloneD5MJson_(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
