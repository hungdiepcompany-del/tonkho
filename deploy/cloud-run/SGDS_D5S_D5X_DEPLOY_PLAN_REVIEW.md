# SGDS D5S-D5X Reviewed Cloud Run Deploy Plan

PLAN_MODE=REVIEW_ONLY
DEPLOY_EXECUTED=NO
PROJECT_ID=tonkhohd
REGION=asia-southeast1
SERVICE_NAME=sgds-durable-orchestrator
SERVICE_IDENTITY=sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com
ALLOW_UNAUTHENTICATED=NO
INGRESS=all
MIN_INSTANCES=0
MAX_INSTANCES=1
CONCURRENCY=1
CPU=1
MEMORY=512Mi
TIMEOUT=60s
PORT=8080

## Selected Strategy

SELECTED_BUILD_STRATEGY=EXPLICIT_CLOUD_BUILD_TO_ARTIFACT_REGISTRY_THEN_CLOUD_RUN_BY_DIGEST

Rationale:

- Source deploy is shorter but creates less transparent build context and image traceability.
- Local Docker push is Windows-sensitive and requires local Docker availability.
- Explicit Cloud Build plus Artifact Registry gives immutable image digest, reviewed context, and auditable deployment input.

## Commands For Future Approval Only

Do not run these commands until the owner provides:

OWNER_APPROVE_D5V_BUILD_AND_DEPLOY_PRIVATE_CLOUD_RUN_ORCHESTRATOR_PROJECT_tonkhohd_REGION_asia-southeast1

```powershell
gcloud.cmd artifacts repositories create sgds-runtime `
  --repository-format=docker `
  --location=asia-southeast1 `
  --project=tonkhohd `
  --configuration=sgds-hungdiep

gcloud.cmd builds submit . `
  --config=deploy/cloud-run/cloudbuild.yaml `
  --project=tonkhohd `
  --configuration=sgds-hungdiep

gcloud.cmd run deploy sgds-durable-orchestrator `
  --image=asia-southeast1-docker.pkg.dev/tonkhohd/sgds-runtime/sgds-durable-orchestrator@sha256:<IMAGE_DIGEST> `
  --region=asia-southeast1 `
  --project=tonkhohd `
  --service-account=sgds-firestore-runtime@tonkhohd.iam.gserviceaccount.com `
  --ingress=all `
  --no-allow-unauthenticated `
  --min-instances=0 `
  --max-instances=1 `
  --concurrency=1 `
  --cpu=1 `
  --memory=512Mi `
  --timeout=60s `
  --port=8080 `
  --env-vars-file=deploy/cloud-run/sgds-durable-orchestrator.env.yaml
```

## Resources That Would Change

ENABLED_APIS_REQUIRED=run.googleapis.com;artifactregistry.googleapis.com;cloudbuild.googleapis.com;iamcredentials.googleapis.com
ARTIFACT_REGISTRY_REPOSITORY=sgds-runtime
CLOUD_BUILD_EXECUTION=REQUIRED
CONTAINER_IMAGE=asia-southeast1-docker.pkg.dev/tonkhohd/sgds-runtime/sgds-durable-orchestrator
CLOUD_RUN_SERVICE=sgds-durable-orchestrator
CLOUD_RUN_REVISION=CREATED_BY_DEPLOY
SA_ACTAS_BINDING=ALREADY_ALLOWED_FOR_DEPLOYER_READ_ONLY_VERIFIED
RUN_INVOKER_BINDING=NOT_APPLIED_IN_THIS_PHASE
CUSTOM_AUDIENCE=NOT_CONFIGURED_IN_THIS_PHASE

## Rollback

ROLLBACK_PLAN=FIRST_DEPLOY_HAS_NO_PREVIOUS_REVISION
ROLLBACK_FIRST_DEPLOY=disable traffic or remove invoker binding; delete service only with separate owner approval
ROLLBACK_EXISTING_SERVICE=export service description, record previous revision, and move traffic back to previous revision
FIRESTORE_DATA_ROLLBACK=NO_DELETE_OR_CLEANUP_BY_DEPLOY_ROLLBACK
