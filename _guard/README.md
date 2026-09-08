# Repository-Local Project Guard V3

These guard files belong only to this repository. The central
`D:\CODE\PROJECT_GUARD.bat` router delegates into this local `GUARD.bat`; it
does not own repository-specific identity, remote, or deploy policy.

Layout:

```text
GUARD.bat
_guard\PROJECT_GUARD.config.bat
_guard\PROJECT_GUARD_ENGINE.bat
_guard\deploy\DEPLOY_GOOGLE_APPS_FIREBASE.bat
```

Commands:

```powershell
.\GUARD.bat status
.\GUARD.bat doctor
.\GUARD.bat pull
.\GUARD.bat push
.\GUARD.bat deploy gas
.\GUARD.bat deploy firebase
.\GUARD.bat deploy all
```

Deploy targets:

```text
Google Apps Script: deploy gas
Firebase: deploy firebase
Combined: deploy all
Routine confirmation: review the displayed target information, then enter Y to continue or N to cancel.
```

Routine guarded operations such as `push`, `deploy gas`, `deploy firebase`, and
`deploy all` use a single `Y` confirmation only after all automated safety gates
have passed. Empty input, `N`, legacy long phrases such as `DEPLOY sync gas`,
and any other text cancel with exit code 2 and leave `PUSH_RUN=false` or
`DEPLOY_RUN=false`.

The Google adapter requires an explicit deploy target. It fails closed when
GitHub, clasp, Firebase, gcloud, project, script, hosting, or Firestore identity
checks do not match the config. A `clasp push` result containing `Skipping push.`
is treated as blocked, not as upload success.

No guard file stores secrets or changes CLI authentication/configuration.

Cloudflare profile isolation:

```text
CLOUDFLARE_REQUIRED=false
```

SyncGmailDriveSheet uses Google Apps Script and Firebase providers. Cloudflare
auth commands fail closed with `BLOCKED_CLOUDFLARE_NOT_USED_BY_PROJECT`.
## V6 local guard boundary

`GUARD.bat`, the engine, and the deploy adapter bind only the script-relative
`_guard/PROJECT_GUARD.config.bat`. Caller-supplied config paths and recognized
repository, Git, and authentication override environment variables fail closed.
The local test suite inspects this behavior statically; it does not execute the
guard, adapter, provider CLIs, or a deployment.
