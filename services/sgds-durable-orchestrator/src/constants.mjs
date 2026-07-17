export const SGDS_ORCHESTRATOR_VERSION = 'SGDS_D5S_D5X_CLOUD_RUN_ORCHESTRATOR_V1';
export const SGDS_PROJECT_ID = 'tonkhohd';
export const SGDS_DATABASE_ID = '(default)';
export const SGDS_REGION = 'asia-southeast1';
export const SGDS_SERVICE_NAME = 'sgds-durable-orchestrator';
export const SGDS_RUNTIME_PRINCIPAL = 'sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com';
export const SGDS_RUNTIME_ENV = 'production-shadow';
export const SGDS_RUNTIME_MODE = 'cloud-run-attached-identity';
export const SGDS_MAX_CANDIDATES = 1;
export const SGDS_MAX_BODY_BYTES = 128 * 1024;
export const SGDS_MAX_EVENT_DOCUMENTS = 4;
export const SGDS_MAX_JOB_DOCUMENTS = 1;
export const SGDS_MAX_REPORT_DOCUMENTS = 1;
export const SGDS_MUTATION_FLAGS = Object.freeze({
  canonicalWriteAllowed: false,
  gmailMutationAllowed: false,
  driveMutationAllowed: false,
  sheetsMutationAllowed: false
});
export const SGDS_SHADOW_EVENT_TYPES = Object.freeze([
  'SHADOW_REQUEST_ACCEPTED',
  'SHADOW_JOB_PLANNED',
  'SHADOW_COMMIT_PLAN_RECORDED',
  'SHADOW_RECONCILIATION_RECORDED'
]);
