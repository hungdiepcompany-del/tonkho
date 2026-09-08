@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

call :CaptureOverrideEnvironment
call :SanitizeFailureOutputDefaults
call :RejectOverrideEnvironment
if errorlevel 1 exit /b 1
set "GUARD_CONFIG_ARGUMENT=%~1"
set "ACTION=%~2"
set "ACTION_ARG1=%~3"
call :BindCanonicalConfig "%GUARD_CONFIG_ARGUMENT%"
if errorlevel 1 exit /b 1
call "%GUARD_CONFIG%"
if errorlevel 1 (
  call :Fail BLOCKED_GUARD_CONFIG_LOAD_FAILED "Guard config did not load"
  exit /b 1
)
if not defined RELEVANT_LOG set "RELEVANT_LOG=D:\CODE\PROJECT_GUARD_LOGS\%PROJECT_KEY%\%ACTION%.log"

if "%ACTION%"=="" (
  call :Help
  exit /b 1
)

call :ValidateConfig
if errorlevel 1 exit /b 1

if /I "%ACTION%"=="help" (
  call :Help
  exit /b 0
) else if /I "%ACTION%"=="doctor" (
  call :Doctor
  exit /b
) else if /I "%ACTION%"=="status" (
  call :Status
  exit /b
) else if /I "%ACTION%"=="pull" (
  call :Pull
  exit /b
) else if /I "%ACTION%"=="push" (
  call :Push
  exit /b
) else if /I "%ACTION%"=="build" (
  call :Build
  exit /b
) else if /I "%ACTION%"=="deploy" (
  call :Deploy
  exit /b
) else if /I "%ACTION%"=="auth" (
  call :Auth
  exit /b
)

call :Fail BLOCKED_UNKNOWN_ACTION "Unknown guard action"
exit /b 1

:Help
echo Usage: GUARD.bat status^|doctor^|pull^|push^|build^|deploy^|auth [args]
echo.
echo status  - read-only repository, git, and provider status
echo doctor  - read-only guard/config/tool validation
echo pull    - guarded fetch plus ff-only pull
echo push    - guarded push with review summary plus Y confirmation
echo build   - guarded local build/check command for configured provider
echo deploy  - provider deploy adapter with review summary plus Y confirmation
echo auth    - Cloudflare profile status^|setup^|test^|remove
exit /b 0

:ValidateConfig
if not "%CONFIG_SCHEMA_VERSION%"=="3" (
  call :Fail BLOCKED_GUARD_CONFIG_SCHEMA_INVALID "Expected config schema version 3"
  exit /b 1
)
if not "%GUARD_CONFIG_VERSION%"=="3" (
  call :Fail BLOCKED_GUARD_CONFIG_VERSION_INVALID "Expected guard config version 3"
  exit /b 1
)
for %%V in (CONFIG_SCHEMA_VERSION PROJECT_KEY PROJECT_NAME PROJECT_ROOT EXPECTED_BRANCH EXPECTED_REMOTE GITHUB_USERNAME GITHUB_SSH_ALIAS SSH_ALIAS SSH_KEY_PATH GITHUB_ACCOUNT GITHUB_REPO GIT_USER_NAME GIT_USER_EMAIL DEPLOY_PROVIDER DEPLOY_ADAPTER) do (
  if not defined %%V (
    call :Fail BLOCKED_REQUIRED_CONFIG_VALUE_MISSING "Missing required config variable %%V"
    exit /b 1
  )
)
if /I not "%DEPLOY_PROVIDER%"=="google_apps_firebase" (
  call :Fail BLOCKED_DEPLOY_PROVIDER_IDENTITY_MISMATCH "Configured deploy provider is not the canonical provider"
  exit /b 1
)
for %%I in ("%~dp0deploy\DEPLOY_GOOGLE_APPS_FIREBASE.bat") do set "CANONICAL_DEPLOY_ADAPTER=%%~fI"
for %%I in ("%DEPLOY_ADAPTER%") do set "CONFIGURED_DEPLOY_ADAPTER=%%~fI"
if /I not "%CONFIGURED_DEPLOY_ADAPTER%"=="%CANONICAL_DEPLOY_ADAPTER%" (
  call :Fail BLOCKED_DEPLOY_ADAPTER_IDENTITY_MISMATCH "Configured deploy adapter is not the script-relative canonical adapter"
  exit /b 1
)
if not exist "%DEPLOY_ADAPTER%" (
  call :Fail BLOCKED_DEPLOY_ADAPTER_MISSING "Provider deploy adapter was not found"
  exit /b 1
)
if /I "%CLOUDFLARE_REQUIRED%"=="true" (
  for %%V in (CLOUDFLARE_AUTH_MODE CLOUDFLARE_PROFILE_ROOT CLOUDFLARE_PROFILE_PATH CLOUDFLARE_EXPECTED_ACCOUNT_ID CLOUDFLARE_EXPECTED_EMAIL CLOUDFLARE_EXPECTED_ACCOUNT_MATCH CLOUDFLARE_AUTH_SETUP CLOUDFLARE_AUTH_TEST CLOUDFLARE_AUTH_RUNNER) do (
    if not defined %%V (
      call :Fail BLOCKED_REQUIRED_CONFIG_VALUE_MISSING "Missing required Cloudflare config variable %%V"
      exit /b 1
    )
  )
)
exit /b 0

:EnterRepo
if not exist "%PROJECT_ROOT%\" (
  call :Fail BLOCKED_PROJECT_ROOT_MISSING "Project root was not found"
  exit /b 1
)
pushd "%PROJECT_ROOT%" >nul
if errorlevel 1 (
  call :Fail BLOCKED_PROJECT_ROOT_CD_FAILED "Could not enter project root"
  exit /b 1
)
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  popd >nul
  call :Fail BLOCKED_NOT_A_GIT_REPO "Project root is not a git repository"
  exit /b 1
)
set "ACTUAL_ROOT="
set "CONFIGURED_ROOT_CANONICAL="
set "ACTUAL_ROOT_CANONICAL="
for /f "delims=" %%R in ('git rev-parse --show-toplevel') do set "ACTUAL_ROOT=%%R"
if not defined ACTUAL_ROOT (
  popd >nul
  call :Fail BLOCKED_PROJECT_ROOT_MISMATCH "Git top level could not be resolved"
  exit /b 1
)
for %%I in ("%CD%") do set "CONFIGURED_ROOT_CANONICAL=%%~fI"
for %%I in ("%ACTUAL_ROOT%") do set "ACTUAL_ROOT_CANONICAL=%%~fI"
if /I not "%CONFIGURED_ROOT_CANONICAL%"=="%ACTUAL_ROOT_CANONICAL%" (
  popd >nul
  call :Fail BLOCKED_PROJECT_ROOT_MISMATCH "Configured project root does not match git top level"
  exit /b 1
)
exit /b 0

:CaptureOverrideEnvironment
set "INHERITED_OVERRIDE_PRESENT=false"
for %%V in (GUARD_CONFIG GUARD_CONFIG_ARGUMENT CONFIG_SCHEMA_VERSION GUARD_CONFIG_VERSION PROJECT_ROOT EXPECTED_BRANCH EXPECTED_REMOTE DEPLOY_PROVIDER DEPLOY_ADAPTER ACTION PROJECT_KEY RELEVANT_LOG PUSH_RUN PUSH_OUTCOME DEPLOY_RUN NEW_VERSION_CREATED HTTP_PROBE_RUN QUARANTINE_STATUS GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_CONFIG GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL GIT_CONFIG_SYSTEM GIT_CONFIG_PARAMETERS GIT_INDEX_FILE GIT_CEILING_DIRECTORIES GIT_DISCOVERY_ACROSS_FILESYSTEM GIT_SSH GIT_SSH_COMMAND GIT_ASKPASS SSH_ASKPASS FIREBASE_TOKEN GOOGLE_APPLICATION_CREDENTIALS GOOGLE_CLOUD_PROJECT GCLOUD_PROJECT CLOUDSDK_ACTIVE_CONFIG_NAME CLOUDSDK_CONFIG CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE CLOUDSDK_CORE_ACCOUNT CLOUDSDK_CORE_PROJECT CLASP_TOKEN CLASP_AUTH) do (
  if defined %%V set "INHERITED_OVERRIDE_PRESENT=true"
)
exit /b 0

:SanitizeFailureOutputDefaults
set "PROJECT_KEY=UNTRUSTED_STARTUP"
set "ACTION=UNTRUSTED_STARTUP"
set "RELEVANT_LOG=UNTRUSTED_STARTUP_LOG"
set "PUSH_RUN=false"
set "PUSH_OUTCOME=NOT_RUN"
set "DEPLOY_RUN=false"
set "NEW_VERSION_CREATED=false"
set "HTTP_PROBE_RUN=false"
set "QUARANTINE_STATUS=NOT_QUARANTINED"
exit /b 0

:RejectOverrideEnvironment
if /I "%INHERITED_OVERRIDE_PRESENT%"=="true" (
  call :Fail BLOCKED_OVERRIDE_ENVIRONMENT "Inherited override environment is not trusted"
  exit /b 1
)
exit /b 0

:BindCanonicalConfig
if "%~1"=="" (
  call :Fail BLOCKED_GUARD_CONFIG_ARGUMENT_MISSING "Missing guard config argument"
  exit /b 1
)
for %%I in ("%~dp0PROJECT_GUARD.config.bat") do set "CANONICAL_GUARD_CONFIG=%%~fI"
for %%I in ("%~1") do set "REQUESTED_GUARD_CONFIG=%%~fI"
if /I not "%REQUESTED_GUARD_CONFIG%"=="%CANONICAL_GUARD_CONFIG%" (
  call :Fail BLOCKED_GUARD_CONFIG_NONCANONICAL "Guard config must be the script-relative canonical config"
  exit /b 1
)
if not exist "%CANONICAL_GUARD_CONFIG%" (
  call :Fail BLOCKED_GUARD_CONFIG_MISSING "Canonical guard config file was not found"
  exit /b 1
)
set "GUARD_CONFIG=%CANONICAL_GUARD_CONFIG%"
exit /b 0

:VerifyBranch
set "CURRENT_BRANCH="
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="%EXPECTED_BRANCH%" (
  call :Fail BLOCKED_WRONG_BRANCH "Current branch does not match expected branch"
  exit /b 1
)
echo BRANCH=%CURRENT_BRANCH%
exit /b 0

:VerifyRemote
set "CURRENT_REMOTE="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "CURRENT_REMOTE=%%R"
if "%CURRENT_REMOTE%"=="" (
  call :Fail BLOCKED_REMOTE_ORIGIN_MISSING "origin remote is missing"
  exit /b 1
)
if /I not "%CURRENT_REMOTE%"=="%EXPECTED_REMOTE%" (
  echo CURRENT_REMOTE=%CURRENT_REMOTE%
  echo EXPECTED_REMOTE=%EXPECTED_REMOTE%
  call :Fail BLOCKED_REMOTE_ORIGIN_MISMATCH "origin remote is not the configured remote"
  exit /b 1
)
echo REMOTE_ORIGIN=%CURRENT_REMOTE%
exit /b 0

:VerifyGitIdentity
set "CURRENT_GIT_NAME="
set "CURRENT_GIT_EMAIL="
for /f "delims=" %%N in ('git config user.name 2^>nul') do set "CURRENT_GIT_NAME=%%N"
for /f "delims=" %%E in ('git config user.email 2^>nul') do set "CURRENT_GIT_EMAIL=%%E"
if /I not "%CURRENT_GIT_NAME%"=="%GIT_USER_NAME%" (
  call :Fail BLOCKED_GIT_USER_NAME_MISMATCH "Local git user.name does not match config"
  exit /b 1
)
if /I not "%CURRENT_GIT_EMAIL%"=="%GIT_USER_EMAIL%" (
  call :Fail BLOCKED_GIT_USER_EMAIL_MISMATCH "Local git user.email does not match config"
  exit /b 1
)
echo GIT_IDENTITY=%CURRENT_GIT_NAME% ^<%CURRENT_GIT_EMAIL%^>
exit /b 0

:VerifySshAlias
call :RequireTool ssh
if errorlevel 1 exit /b 1
set "SSH_G_FILE=%TEMP%\project_guard_ssh_g_%PROJECT_KEY%_%RANDOM%%RANDOM%.txt"
ssh -G git@%GITHUB_SSH_ALIAS% > "%SSH_G_FILE%" 2>&1
if errorlevel 1 (
  type "%SSH_G_FILE%"
  del "%SSH_G_FILE%" >nul 2>&1
  call :Fail BLOCKED_SSH_ALIAS_CONFIG_FAILED "ssh -G failed for configured alias"
  exit /b 1
)
findstr /I /C:"hostname github.com" "%SSH_G_FILE%" >nul
if errorlevel 1 (
  type "%SSH_G_FILE%"
  del "%SSH_G_FILE%" >nul 2>&1
  call :Fail BLOCKED_SSH_ALIAS_NOT_GITHUB "SSH alias does not resolve to github.com"
  exit /b 1
)
set "SSH_KEY_PATH_SLASH=%SSH_KEY_PATH:\=/%"
findstr /I /C:"identityfile %SSH_KEY_PATH_SLASH%" "%SSH_G_FILE%" >nul
if errorlevel 1 (
  type "%SSH_G_FILE%"
  del "%SSH_G_FILE%" >nul 2>&1
  call :Fail BLOCKED_SSH_KEY_PATH_MISMATCH "SSH alias identityfile does not match config"
  exit /b 1
)
del "%SSH_G_FILE%" >nul 2>&1
echo SSH_ALIAS=%GITHUB_SSH_ALIAS%
echo SSH_KEY_PATH_CONFIRMED=%SSH_KEY_PATH%

set "SSH_T_FILE=%TEMP%\project_guard_ssh_t_%PROJECT_KEY%_%RANDOM%%RANDOM%.txt"
ssh -o BatchMode=yes -o ConnectTimeout=20 -T git@%GITHUB_SSH_ALIAS% > "%SSH_T_FILE%" 2>&1
type "%SSH_T_FILE%"
findstr /I /C:"%GITHUB_ACCOUNT%" "%SSH_T_FILE%" >nul
if errorlevel 1 (
  del "%SSH_T_FILE%" >nul 2>&1
  call :Fail BLOCKED_GITHUB_ACCOUNT_NOT_CONFIRMED "GitHub SSH account did not match config"
  exit /b 1
)
del "%SSH_T_FILE%" >nul 2>&1
echo GITHUB_ACCOUNT_CONFIRMED=%GITHUB_ACCOUNT%
exit /b 0

:FetchAndCount
set "LOCAL_AHEAD="
set "REMOTE_AHEAD="
git fetch origin --prune
if errorlevel 1 (
  call :Fail BLOCKED_GIT_FETCH_FAILED "git fetch origin --prune failed"
  exit /b 1
)
git show-ref --verify --quiet "refs/remotes/origin/%EXPECTED_BRANCH%"
if errorlevel 1 (
  call :Fail BLOCKED_REMOTE_BRANCH_MISSING "Configured origin branch is missing"
  exit /b 1
)
for /f "tokens=1,2" %%A in ('git rev-list --left-right --count HEAD...origin/%EXPECTED_BRANCH%') do (
  set "LOCAL_AHEAD=%%A"
  set "REMOTE_AHEAD=%%B"
)
if "%LOCAL_AHEAD%"=="" set "LOCAL_AHEAD=0"
if "%REMOTE_AHEAD%"=="" set "REMOTE_AHEAD=0"
echo AHEAD_BEHIND=%LOCAL_AHEAD%/%REMOTE_AHEAD%
exit /b 0

:VerifyNoTrackedChanges
git diff --quiet --exit-code
if errorlevel 1 (
  call :Fail BLOCKED_TRACKED_WORKTREE_DIRTY "Tracked working tree has unstaged changes"
  exit /b 1
)
git diff --cached --quiet --exit-code
if errorlevel 1 (
  call :Fail BLOCKED_STAGED_CHANGES_PRESENT "Staged changes are present"
  exit /b 1
)
echo TRACKED_WORKTREE_CLEAN=true
exit /b 0

:VerifyNoDeployInputChanges
call :VerifyNoTrackedChanges
if errorlevel 1 exit /b 1
set "DEPLOY_STATUS_FILE=%TEMP%\project_guard_deploy_status_%PROJECT_KEY%_%RANDOM%%RANDOM%.bin"
git status --porcelain=v1 -z --untracked-files=all > "%DEPLOY_STATUS_FILE%"
if errorlevel 1 (
  del "%DEPLOY_STATUS_FILE%" >nul 2>&1
  call :Fail BLOCKED_DEPLOY_GIT_STATUS_FAILED "Repository status could not be resolved"
  exit /b 1
)
powershell.exe -NoProfile -NonInteractive -Command "$p=[Environment]::GetEnvironmentVariable('DEPLOY_STATUS_FILE'); $b=[IO.File]::ReadAllBytes($p); if($b.Length -eq 0){exit 0}; $records=[Text.Encoding]::UTF8.GetString($b).Split([char]0); foreach($record in $records){if($record.Length -eq 0){continue}; if($record.Length -lt 3 -or $record[2] -ne ' '){exit 1}; if($record[0] -eq '?' -and $record[1] -eq '?'){exit 2}}; exit 0" >nul 2>&1
set "DEPLOY_STATUS_RC=%ERRORLEVEL%"
del "%DEPLOY_STATUS_FILE%" >nul 2>&1
if "%DEPLOY_STATUS_RC%"=="2" (
  call :Fail BLOCKED_DEPLOY_UNTRACKED_FILES_PRESENT "Deploy requires no untracked input files"
  exit /b 1
)
if not "%DEPLOY_STATUS_RC%"=="0" (
  call :Fail BLOCKED_DEPLOY_STATUS_PORCELAIN_INVALID "Repository status porcelain was invalid"
  exit /b 1
)
echo DEPLOY_INPUTS_CLEAN=true
exit /b 0

:VerifyAheadBehindZero
if not "%LOCAL_AHEAD%"=="0" (
  call :Fail BLOCKED_LOCAL_AHEAD_OF_ORIGIN "Local branch has commits not on origin"
  exit /b 1
)
if not "%REMOTE_AHEAD%"=="0" (
  call :Fail BLOCKED_REMOTE_AHEAD_OF_LOCAL "Origin branch has commits not in local HEAD"
  exit /b 1
)
echo AHEAD_BEHIND_ZERO=true
exit /b 0

:CommonReadOnlyChecks
call :EnterRepo
if errorlevel 1 exit /b 1
echo PROJECT=%PROJECT_KEY%
echo PROJECT_NAME=%PROJECT_NAME%
echo ACTION=%ACTION%
echo GUARD_VERSION=3
call :VerifyBranch
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifyRemote
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifyGitIdentity
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifySshAlias
if errorlevel 1 (popd >nul & exit /b 1)
call :FetchAndCount
if errorlevel 1 (popd >nul & exit /b 1)
exit /b 0

:Doctor
set "ACTION=doctor"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
echo CONFIG=%GUARD_CONFIG%
echo DEPLOY_PROVIDER=%DEPLOY_PROVIDER%
echo DEPLOY_ADAPTER=%DEPLOY_ADAPTER%
call :RequireTool git
if errorlevel 1 (popd >nul & exit /b 1)
call :InvokeAdapter doctor
set "RC=%ERRORLEVEL%"
popd >nul
exit /b %RC%

:Status
set "ACTION=status"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
echo.
echo GIT_STATUS_SHORT_BEGIN
git status --short --untracked-files=all
echo GIT_STATUS_SHORT_END
git diff --quiet --exit-code
if errorlevel 1 (
  echo TRACKED_WORKTREE_CLEAN=false
) else (
  echo TRACKED_WORKTREE_CLEAN=true
)
git diff --cached --quiet --exit-code
if errorlevel 1 (
  echo STAGED_FILES_PRESENT=true
) else (
  echo STAGED_FILES_PRESENT=false
)
echo.
git log --oneline -5
call :InvokeAdapter status
set "RC=%ERRORLEVEL%"
popd >nul
if not "%RC%"=="0" exit /b %RC%
echo STATUS_PASS
exit /b 0

:Pull
set "ACTION=pull"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
git status --porcelain --untracked-files=all | findstr /R "." >nul
if not errorlevel 1 (
  popd >nul
  call :Fail BLOCKED_WORKTREE_NOT_CLEAN_FOR_PULL "Pull requires no tracked, staged, or untracked changes"
  exit /b 1
)
call :VerifyPullAheadBehind
if errorlevel 1 (popd >nul & exit /b 1)
git pull --ff-only origin "%EXPECTED_BRANCH%"
if errorlevel 1 (
  popd >nul
  call :Fail BLOCKED_GIT_PULL_FF_ONLY_FAILED "git pull --ff-only failed"
  exit /b 1
)
echo PULL_RUN=true
echo PULL_PASS
popd >nul
exit /b 0

:Push
set "ACTION=push"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
call :VerifyNoTrackedChanges
if errorlevel 1 (popd >nul & exit /b 1)
if not "%REMOTE_AHEAD%"=="0" (
  popd >nul
  call :Fail BLOCKED_REMOTE_AHEAD_OF_LOCAL "Push blocked because origin has new commits"
  exit /b 1
)
set "LOCAL_HEAD="
set "ORIGIN_HEAD="
for /f "delims=" %%H in ('git rev-parse HEAD') do set "LOCAL_HEAD=%%H"
for /f "delims=" %%H in ('git rev-parse "origin/%EXPECTED_BRANCH%"') do set "ORIGIN_HEAD=%%H"
echo CONFIRM_ACTION=GIT_PUSH
echo PROJECT=%PROJECT_KEY%
echo REPOSITORY_ROOT=%ACTUAL_ROOT%
echo REMOTE_ORIGIN=%CURRENT_REMOTE%
echo GITHUB_ACCOUNT=%GITHUB_ACCOUNT%
echo BRANCH=%CURRENT_BRANCH%
echo LOCAL_HEAD=%LOCAL_HEAD%
echo ORIGIN_HEAD=%ORIGIN_HEAD%
echo AHEAD_BEHIND=%LOCAL_AHEAD%/%REMOTE_AHEAD%
echo COMMITS_TO_PUSH_BEGIN
git log --oneline "origin/%EXPECTED_BRANCH%..HEAD"
echo COMMITS_TO_PUSH_END
echo TRACKED_WORKTREE_CLEAN=true
echo STAGED_FILES_PRESENT=false
call :ConfirmY "Continue push?"
set "CONFIRM_RC=%ERRORLEVEL%"
if "%CONFIRM_RC%"=="2" (
  popd >nul
  call :CancelPush
  exit /b 2
)
if not "%CONFIRM_RC%"=="0" (
  popd >nul
  call :Fail BLOCKED_CONFIRMATION_HANDLER_FAILED "Confirmation handling failed"
  exit /b 1
)
set "CONFIRMED_LOCAL_HEAD=%LOCAL_HEAD%"
set "CONFIRMED_ORIGIN_HEAD=%ORIGIN_HEAD%"
set "CONFIRMED_AHEAD_BEHIND=%LOCAL_AHEAD%/%REMOTE_AHEAD%"
call :RecheckPushBinding
if errorlevel 1 (popd >nul & exit /b 1)
set "PUSH_RUN=ATTEMPTED"
set "PUSH_OUTCOME=ATTEMPTED"
echo PUSH_OUTCOME=%PUSH_OUTCOME%
git push origin "%CONFIRMED_LOCAL_HEAD%:refs/heads/%EXPECTED_BRANCH%"
if errorlevel 1 (
  set "PUSH_RUN=UNKNOWN"
  set "PUSH_OUTCOME=PENDING_LATE_COMPLETION_QUARANTINE"
  popd >nul
  call :Fail PENDING_LATE_COMPLETION_QUARANTINE "git push returned an unproven outcome"
  exit /b 1
)
echo PUSH_RUN=true
set "PUSH_OUTCOME=CONFIRMED_SUCCESS"
echo PUSH_OUTCOME=%PUSH_OUTCOME%
echo PUSH_PASS
popd >nul
exit /b 0

:Build
set "ACTION=build"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
call :InvokeAdapter build
set "RC=%ERRORLEVEL%"
popd >nul
exit /b %RC%

:Deploy
set "ACTION=deploy"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
call :VerifyAheadBehindZero
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifyNoDeployInputChanges
if errorlevel 1 (popd >nul & exit /b 1)
call :InvokeAdapter deploy "%ACTION_ARG1%"
set "RC=%ERRORLEVEL%"
popd >nul
exit /b %RC%

:VerifyPullAheadBehind
if not "%LOCAL_AHEAD%"=="0" (
  call :Fail BLOCKED_LOCAL_AHEAD_OF_ORIGIN "Pull requires no local-only commits"
  exit /b 1
)
echo PULL_AHEAD_BEHIND_ALLOWED=%LOCAL_AHEAD%/%REMOTE_AHEAD%
exit /b 0

:InvokeAdapter
set "ADAPTER_CONFIG_PATH=%GUARD_CONFIG%"
set "ADAPTER_PATH=%DEPLOY_ADAPTER%"
for %%V in (GUARD_CONFIG GUARD_CONFIG_ARGUMENT CONFIG_SCHEMA_VERSION GUARD_CONFIG_VERSION PROJECT_ROOT EXPECTED_BRANCH EXPECTED_REMOTE DEPLOY_PROVIDER DEPLOY_ADAPTER GAS_ACCOUNT GAS_SCRIPT_ID CLASP_PROFILE CLASP_ROOT_DIR FIREBASE_ACCOUNT FIREBASE_PROJECT_ID FIREBASE_PROJECT_NUMBER FIREBASE_HOSTING_SITE_ID GCLOUD_CONFIGURATION FIRESTORE_DATABASE_ID FIRESTORE_LOCATION FIRESTORE_TYPE FIRESTORE_EDITION FIRESTORE_DELETE_PROTECTION) do set "%%V="
call "%ADAPTER_PATH%" %~1 "%ADAPTER_CONFIG_PATH%" "%~2"
exit /b %ERRORLEVEL%

:RecheckPushBinding
call :EnterRepo
if errorlevel 1 exit /b 1
call :VerifyBranch
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifyRemote
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifyGitIdentity
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifyNoTrackedChanges
if errorlevel 1 (popd >nul & exit /b 1)
call :FetchAndCount
if errorlevel 1 (popd >nul & exit /b 1)
set "RECHECK_LOCAL_HEAD="
set "RECHECK_ORIGIN_HEAD="
for /f "delims=" %%H in ('git rev-parse HEAD') do set "RECHECK_LOCAL_HEAD=%%H"
for /f "delims=" %%H in ('git rev-parse "origin/%EXPECTED_BRANCH%"') do set "RECHECK_ORIGIN_HEAD=%%H"
if not "%RECHECK_LOCAL_HEAD%"=="%CONFIRMED_LOCAL_HEAD%" (
  call :Fail BLOCKED_PUSH_LOCAL_SHA_DRIFT "Confirmed local SHA changed before push"
  popd >nul
  exit /b 1
)
if not "%RECHECK_ORIGIN_HEAD%"=="%CONFIRMED_ORIGIN_HEAD%" (
  call :Fail BLOCKED_PUSH_REMOTE_SHA_DRIFT "Confirmed remote SHA changed before push"
  popd >nul
  exit /b 1
)
if not "%LOCAL_AHEAD%/%REMOTE_AHEAD%"=="%CONFIRMED_AHEAD_BEHIND%" (
  call :Fail BLOCKED_PUSH_AHEAD_BEHIND_DRIFT "Ahead/behind changed before push"
  popd >nul
  exit /b 1
)
popd >nul
exit /b 0

:Auth
set "ACTION=auth"
set "AUTH_ACTION=%ACTION_ARG1%"
if "%AUTH_ACTION%"=="" set "AUTH_ACTION=status"
call :EnterRepo
if errorlevel 1 exit /b 1
echo PROJECT=%PROJECT_KEY%
echo ACTION=auth
echo AUTH_ACTION=%AUTH_ACTION%
if /I not "%CLOUDFLARE_REQUIRED%"=="true" (
  popd >nul
  echo PROJECT=%PROJECT_KEY%
  echo ACTION=auth
  echo STATUS=FAILED
  echo FAILED_GATE=BLOCKED_CLOUDFLARE_NOT_USED_BY_PROJECT
  echo ERROR_MESSAGE=Cloudflare auth profiles are not used by this project
  echo PUSH_RUN=false
  echo DEPLOY_RUN=false
  echo NEW_VERSION_CREATED=false
  echo HTTP_PROBE_RUN=false
  exit /b 1
)
if /I "%AUTH_ACTION%"=="status" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%CLOUDFLARE_AUTH_TEST%" -ProfilePath "%CLOUDFLARE_PROFILE_PATH%" -ProjectKey "%PROJECT_KEY%" -ExpectedAccountId "%CLOUDFLARE_EXPECTED_ACCOUNT_ID%" -ExpectedEmail "%CLOUDFLARE_EXPECTED_EMAIL%" -ExpectedAccountMatch "%CLOUDFLARE_EXPECTED_ACCOUNT_MATCH%" -RunnerPath "%CLOUDFLARE_AUTH_RUNNER%" -StatusOnly
  set "RC=%ERRORLEVEL%"
  popd >nul
  exit /b %RC%
)
if /I "%AUTH_ACTION%"=="test" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%CLOUDFLARE_AUTH_TEST%" -ProfilePath "%CLOUDFLARE_PROFILE_PATH%" -ProjectKey "%PROJECT_KEY%" -ExpectedAccountId "%CLOUDFLARE_EXPECTED_ACCOUNT_ID%" -ExpectedEmail "%CLOUDFLARE_EXPECTED_EMAIL%" -ExpectedAccountMatch "%CLOUDFLARE_EXPECTED_ACCOUNT_MATCH%" -RunnerPath "%CLOUDFLARE_AUTH_RUNNER%"
  set "RC=%ERRORLEVEL%"
  popd >nul
  exit /b %RC%
)
if /I "%AUTH_ACTION%"=="setup" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%CLOUDFLARE_AUTH_SETUP%" -ProfilePath "%CLOUDFLARE_PROFILE_PATH%" -ProjectKey "%PROJECT_KEY%" -ExpectedEmail "%CLOUDFLARE_EXPECTED_EMAIL%" -ExpectedAccountMatch "%CLOUDFLARE_EXPECTED_ACCOUNT_MATCH%" -WorkerName "%CLOUDFLARE_WORKER_NAME%" -EnvironmentName "%CLOUDFLARE_ENVIRONMENT%" -RunnerPath "%CLOUDFLARE_AUTH_RUNNER%"
  set "RC=%ERRORLEVEL%"
  popd >nul
  exit /b %RC%
)
if /I "%AUTH_ACTION%"=="remove" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%CLOUDFLARE_AUTH_SETUP%" -ProfilePath "%CLOUDFLARE_PROFILE_PATH%" -ProjectKey "%PROJECT_KEY%" -ExpectedEmail "%CLOUDFLARE_EXPECTED_EMAIL%" -ExpectedAccountMatch "%CLOUDFLARE_EXPECTED_ACCOUNT_MATCH%" -WorkerName "%CLOUDFLARE_WORKER_NAME%" -EnvironmentName "%CLOUDFLARE_ENVIRONMENT%" -RunnerPath "%CLOUDFLARE_AUTH_RUNNER%" -Remove
  set "RC=%ERRORLEVEL%"
  popd >nul
  exit /b %RC%
)
popd >nul
call :Fail BLOCKED_UNKNOWN_AUTH_ACTION "Unknown auth action"
exit /b 1
:RequireTool
where %~1 >nul 2>&1
if errorlevel 1 (
  call :Fail BLOCKED_REQUIRED_TOOL_MISSING "Required tool missing: %~1"
  exit /b 1
)
exit /b 0

:ConfirmY
set "CONFIRM_RESPONSE="
set /p "CONFIRM_RESPONSE=%~1 [Y/N]: "
if /I "%CONFIRM_RESPONSE%"=="Y" (
  exit /b 0
)
exit /b 2

:CancelPush
echo PROJECT=%PROJECT_KEY%
echo ACTION=push
echo ACTION_STATUS=CANCELLED
echo EXIT_CODE=2
echo RELEVANT_LOG=%RELEVANT_LOG%
echo PUSH_RUN=false
echo DEPLOY_RUN=false
echo NEW_VERSION_CREATED=false
echo HTTP_PROBE_RUN=false
exit /b 2

:Fail
echo PROJECT=%PROJECT_KEY%
echo ACTION=%ACTION%
echo STATUS=FAILED
echo FAILED_GATE=%~1
echo ERROR_MESSAGE=%~2
echo RELEVANT_LOG=%RELEVANT_LOG%
echo PUSH_RUN=%PUSH_RUN%
echo DEPLOY_RUN=%DEPLOY_RUN%
echo NEW_VERSION_CREATED=%NEW_VERSION_CREATED%
echo HTTP_PROBE_RUN=%HTTP_PROBE_RUN%
exit /b 1
