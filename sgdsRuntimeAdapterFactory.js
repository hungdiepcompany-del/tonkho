const SGDS_RUNTIME_ADAPTER_FACTORY_STATUS_ = 'LOCAL_FOUNDATION_ONLY';
const SGDS_DEFAULT_PRODUCTION_RUNTIME_ = 'apps_script';
const SGDS_CLOUD_RUN_FALLBACK_AUTOMATIC_ = false;

function createSgdsRuntimeAdapterFactory_(options) {
  const opts = options || {};
  const factories = {
    apps_script: opts.appsScriptFactory,
    fake: opts.fakeFactory,
    test: opts.testFactory,
    cloud_run_optional: opts.cloudRunOptionalFactory
  };

  function createAdapterSuite(request) {
    const mode = normalizeSgdsRuntimeMode_(request && request.mode || opts.defaultMode || SGDS_DEFAULT_PRODUCTION_RUNTIME_);
    if (mode === 'cloud_run_optional' && request && request.automaticFallback === true) {
      throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'automatic Cloud Run fallback is forbidden');
    }
    const factory = factories[mode];
    if (typeof factory !== 'function') throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'adapter factory missing: ' + mode);
    const suite = factory(cloneSgdsAdapterJson_(request || {}));
    return validateSgdsAdapterSuite_(suite, mode);
  }

  return Object.freeze({
    defaultProductionRuntime: SGDS_DEFAULT_PRODUCTION_RUNTIME_,
    cloudRunFallbackAutomatic: SGDS_CLOUD_RUN_FALLBACK_AUTOMATIC_,
    createAdapterSuite
  });
}

function createSgdsLocalFakeAdapterSuite_(options) {
  const opts = options || {};
  const gmail = createFakeSgdsGmailAdapter_(opts.gmail || {});
  const drive = createFakeSgdsDriveAdapter_(opts.drive || {});
  const sheets = createFakeSgdsSheetsLedgerAdapter_(opts.sheets || {});
  return validateSgdsAdapterSuite_({
    runtime: 'fake',
    gmail,
    drive,
    sheets
  }, 'fake');
}

function validateSgdsAdapterSuite_(suite, mode) {
  const source = suite || {};
  if (!source.gmail || !source.drive || !source.sheets) {
    throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'gmail drive sheets adapters required');
  }
  requireSgdsAdapterMethod_(source.gmail.read, 'gmail.read', SGDS_GMAIL_ADAPTER_CONTRACT_.readOperations);
  requireSgdsAdapterMethod_(source.gmail.mutate, 'gmail.mutate', SGDS_GMAIL_ADAPTER_CONTRACT_.mutationOperations);
  requireSgdsAdapterMethod_(source.drive.read, 'drive.read', SGDS_DRIVE_ADAPTER_CONTRACT_.readOperations);
  requireSgdsAdapterMethod_(source.drive.mutate, 'drive.mutate', SGDS_DRIVE_ADAPTER_CONTRACT_.mutationOperations);
  requireSgdsAdapterMethod_(source.sheets.read, 'sheets.read', SGDS_SHEETS_LEDGER_ADAPTER_CONTRACT_.readOperations);
  requireSgdsAdapterMethod_(source.sheets.mutate, 'sheets.mutate', SGDS_SHEETS_LEDGER_ADAPTER_CONTRACT_.mutationOperations);
  return Object.freeze({
    runtime: normalizeSgdsRuntimeMode_(source.runtime || mode),
    gmail: source.gmail,
    drive: source.drive,
    sheets: source.sheets
  });
}

function normalizeSgdsRuntimeMode_(mode) {
  const value = safeSgdsAdapterString_(mode || '').toLowerCase();
  if (value === 'production' || value === 'apps_script') return 'apps_script';
  if (value === 'fake' || value === 'local_fake') return 'fake';
  if (value === 'test') return 'test';
  if (value === 'cloud_run_optional') return 'cloud_run_optional';
  throw createSgdsAdapterError_(SGDS_ADAPTER_ERROR_CODES_.CONTRACT, 'runtime mode unsupported');
}
