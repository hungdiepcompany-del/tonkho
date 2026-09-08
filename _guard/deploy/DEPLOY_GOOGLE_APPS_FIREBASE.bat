@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

call :CaptureOverrideEnvironment
call :SanitizeFailureOutputDefaults
call :RejectOverrideEnvironment
if errorlevel 1 exit /b 1
set "ADAPTER_ACTION=%~1"
set "GUARD_CONFIG_ARGUMENT=%~2"
set "DEPLOY_TARGET=%~3"
call :BindCanonicalConfig "%GUARD_CONFIG_ARGUMENT%"
if errorlevel 1 exit /b 1
call "%GUARD_CONFIG%"
if errorlevel 1 (
  call :Fail BLOCKED_GUARD_CONFIG_LOAD_FAILED "Guard config did not load"
  exit /b 1
)
if not defined RELEVANT_LOG set "RELEVANT_LOG=D:\CODE\PROJECT_GUARD_LOGS\%PROJECT_KEY%\%ADAPTER_ACTION%_%DEPLOY_TARGET%.log"
call :ValidateConfigIdentity
if errorlevel 1 exit /b 1

if /I "%ADAPTER_ACTION%"=="doctor" (
  call :Doctor
  exit /b
) else if /I "%ADAPTER_ACTION%"=="status" (
  call :Status
  exit /b
) else if /I "%ADAPTER_ACTION%"=="build" (
  echo BUILD_NOT_CONFIGURED_FOR_SYNC=true
  exit /b 0
) else if /I "%ADAPTER_ACTION%"=="deploy" (
  call :Deploy
  exit /b
)

call :Fail BLOCKED_UNKNOWN_ADAPTER_ACTION "Unknown Google adapter action"
exit /b 1

:Doctor
call :GasPreflight
if errorlevel 1 exit /b 1
call :FirebasePreflight
if errorlevel 1 exit /b 1
echo GOOGLE_APPS_FIREBASE_DOCTOR_PASS
exit /b 0

:CaptureOverrideEnvironment
set "INHERITED_OVERRIDE_PRESENT=false"
for %%V in (GUARD_CONFIG GUARD_CONFIG_ARGUMENT CONFIG_SCHEMA_VERSION GUARD_CONFIG_VERSION PROJECT_ROOT EXPECTED_BRANCH EXPECTED_REMOTE DEPLOY_PROVIDER DEPLOY_ADAPTER ADAPTER_ACTION DEPLOY_TARGET PROJECT_KEY RELEVANT_LOG PUSH_RUN DEPLOY_RUN NEW_VERSION_CREATED GAS_PUSH_OUTCOME GAS_DEPLOY_OUTCOME FIREBASE_DEPLOY_OUTCOME HTTP_PROBE_RUN QUARANTINE_STATUS GAS_ACCOUNT GAS_SCRIPT_ID CLASP_PROFILE CLASP_ROOT_DIR FIREBASE_ACCOUNT FIREBASE_PROJECT_ID FIREBASE_PROJECT_NUMBER FIREBASE_HOSTING_SITE_ID GCLOUD_CONFIGURATION FIRESTORE_DATABASE_ID FIRESTORE_LOCATION FIRESTORE_TYPE FIRESTORE_EDITION FIRESTORE_DELETE_PROTECTION GIT_DIR GIT_WORK_TREE GIT_COMMON_DIR GIT_CONFIG GIT_CONFIG_COUNT GIT_CONFIG_GLOBAL GIT_CONFIG_SYSTEM GIT_CONFIG_PARAMETERS GIT_INDEX_FILE GIT_CEILING_DIRECTORIES GIT_DISCOVERY_ACROSS_FILESYSTEM GIT_SSH GIT_SSH_COMMAND GIT_ASKPASS SSH_ASKPASS FIREBASE_TOKEN GOOGLE_APPLICATION_CREDENTIALS GOOGLE_CLOUD_PROJECT GCLOUD_PROJECT CLOUDSDK_ACTIVE_CONFIG_NAME CLOUDSDK_CONFIG CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE CLOUDSDK_CORE_ACCOUNT CLOUDSDK_CORE_PROJECT CLASP_TOKEN CLASP_AUTH) do (
  if defined %%V set "INHERITED_OVERRIDE_PRESENT=true"
)
exit /b 0

:SanitizeFailureOutputDefaults
set "PROJECT_KEY=UNTRUSTED_STARTUP"
set "ADAPTER_ACTION=UNTRUSTED_STARTUP"
set "DEPLOY_TARGET=UNTRUSTED_STARTUP"
set "RELEVANT_LOG=UNTRUSTED_STARTUP_LOG"
set "PUSH_RUN=false"
set "DEPLOY_RUN=false"
set "NEW_VERSION_CREATED=false"
set "GAS_PUSH_OUTCOME=NOT_RUN"
set "GAS_DEPLOY_OUTCOME=NOT_RUN"
set "FIREBASE_DEPLOY_OUTCOME=NOT_RUN"
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
for %%I in ("%~dp0..\PROJECT_GUARD.config.bat") do set "CANONICAL_GUARD_CONFIG=%%~fI"
for %%I in ("%~1") do set "REQUESTED_GUARD_CONFIG=%%~fI"
if /I not "%REQUESTED_GUARD_CONFIG%"=="%CANONICAL_GUARD_CONFIG%" (
  call :Fail BLOCKED_GUARD_CONFIG_NONCANONICAL "Guard config must be the adapter-relative canonical config"
  exit /b 1
)
if not exist "%CANONICAL_GUARD_CONFIG%" (
  call :Fail BLOCKED_GUARD_CONFIG_MISSING "Canonical guard config file was not found"
  exit /b 1
)
set "GUARD_CONFIG=%CANONICAL_GUARD_CONFIG%"
exit /b 0

:ValidateConfigIdentity
if not "%CONFIG_SCHEMA_VERSION%"=="3" (
  call :Fail BLOCKED_GUARD_CONFIG_SCHEMA_INVALID "Expected config schema version 3"
  exit /b 1
)
if not "%GUARD_CONFIG_VERSION%"=="3" (
  call :Fail BLOCKED_GUARD_CONFIG_VERSION_INVALID "Expected guard config version 3"
  exit /b 1
)
if /I not "%DEPLOY_PROVIDER%"=="google_apps_firebase" (
  call :Fail BLOCKED_DEPLOY_PROVIDER_IDENTITY_MISMATCH "Configured deploy provider is not the canonical provider"
  exit /b 1
)
for %%I in ("%~f0") do set "CANONICAL_DEPLOY_ADAPTER=%%~fI"
for %%I in ("%DEPLOY_ADAPTER%") do set "CONFIGURED_DEPLOY_ADAPTER=%%~fI"
if /I not "%CONFIGURED_DEPLOY_ADAPTER%"=="%CANONICAL_DEPLOY_ADAPTER%" (
  call :Fail BLOCKED_DEPLOY_ADAPTER_IDENTITY_MISMATCH "Configured deploy adapter is not this canonical adapter"
  exit /b 1
)
exit /b 0

:Status
echo DEPLOY_PROVIDER=google_apps_firebase
echo GAS_SCRIPT_ID=%GAS_SCRIPT_ID%
echo FIREBASE_PROJECT_ID=%FIREBASE_PROJECT_ID%
call :GasPreflight
if errorlevel 1 exit /b 1
call :FirebasePreflight
if errorlevel 1 exit /b 1
echo GOOGLE_APPS_FIREBASE_STATUS_PASS
exit /b 0

:Deploy
if "%DEPLOY_TARGET%"=="" (
  echo ALLOWED_TARGETS=gas firebase all
  call :Fail BLOCKED_SYNC_DEPLOY_TARGET_REQUIRED "Deploy target must be gas, firebase, or all"
  exit /b 1
)
if /I "%DEPLOY_TARGET%"=="gas" (
  call :AdapterPrivilegedPreflight
  if errorlevel 1 exit /b 1
  call :GasPreflight
  if errorlevel 1 exit /b 1
  call :Confirm
  if errorlevel 2 exit /b 2
  if errorlevel 1 exit /b 1
  call :DeployGas
  exit /b
)
if /I "%DEPLOY_TARGET%"=="firebase" (
  call :AdapterPrivilegedPreflight
  if errorlevel 1 exit /b 1
  call :FirebasePreflight
  if errorlevel 1 exit /b 1
  call :Confirm
  if errorlevel 2 exit /b 2
  if errorlevel 1 exit /b 1
  call :DeployFirebase
  exit /b
)
if /I "%DEPLOY_TARGET%"=="all" (
  call :AdapterPrivilegedPreflight
  if errorlevel 1 exit /b 1
  call :GasPreflight
  if errorlevel 1 exit /b 1
  call :Confirm
  if errorlevel 2 exit /b 2
  if errorlevel 1 exit /b 1
  call :DeployGas
  if errorlevel 1 exit /b 1
  set "DEPLOY_RUN=PARTIAL_GAS_CONFIRMED_FIREBASE_NOT_CONFIRMED"
  set "FIREBASE_DEPLOY_OUTCOME=NOT_ATTEMPTED"
  call :DeployFirebase
  exit /b
)
echo ALLOWED_TARGETS=gas firebase all
call :Fail BLOCKED_SYNC_DEPLOY_TARGET_INVALID "Deploy target must be gas, firebase, or all"
exit /b 1

:AdapterPrivilegedPreflight
for %%V in (PROJECT_ROOT EXPECTED_BRANCH EXPECTED_REMOTE GIT_USER_NAME GIT_USER_EMAIL) do (
  if not defined %%V (
    call :Fail BLOCKED_DEPLOY_PREFLIGHT_CONFIG_VALUE_MISSING "Required deploy preflight config value is missing: %%V"
    exit /b 1
  )
)
if not exist "%PROJECT_ROOT%\" (
  call :Fail BLOCKED_DEPLOY_PROJECT_ROOT_MISSING "Configured project root was not found"
  exit /b 1
)
for %%I in ("%CD%") do set "ADAPTER_CWD_CANONICAL=%%~fI"
for %%I in ("%PROJECT_ROOT%") do set "ADAPTER_CONFIGURED_ROOT_CANONICAL=%%~fI"
if /I not "%ADAPTER_CWD_CANONICAL%"=="%ADAPTER_CONFIGURED_ROOT_CANONICAL%" (
  call :Fail BLOCKED_DEPLOY_CWD_PROJECT_ROOT_MISMATCH "Current directory does not match configured project root"
  exit /b 1
)
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  call :Fail BLOCKED_DEPLOY_NOT_A_GIT_REPO "Current directory is not a git repository"
  exit /b 1
)
set "ADAPTER_GIT_TOPLEVEL="
for /f "delims=" %%R in ('git rev-parse --show-toplevel 2^>nul') do set "ADAPTER_GIT_TOPLEVEL=%%R"
if not defined ADAPTER_GIT_TOPLEVEL (
  call :Fail BLOCKED_DEPLOY_GIT_TOPLEVEL_UNAVAILABLE "Git top level could not be resolved"
  exit /b 1
)
for %%I in ("%ADAPTER_GIT_TOPLEVEL%") do set "ADAPTER_GIT_TOPLEVEL_CANONICAL=%%~fI"
if /I not "%ADAPTER_CWD_CANONICAL%"=="%ADAPTER_GIT_TOPLEVEL_CANONICAL%" (
  call :Fail BLOCKED_DEPLOY_CWD_GIT_TOPLEVEL_MISMATCH "Current directory does not match git top level"
  exit /b 1
)
if /I not "%ADAPTER_CONFIGURED_ROOT_CANONICAL%"=="%ADAPTER_GIT_TOPLEVEL_CANONICAL%" (
  call :Fail BLOCKED_DEPLOY_PROJECT_ROOT_MISMATCH "Configured project root does not match git top level"
  exit /b 1
)
set "ADAPTER_CURRENT_BRANCH="
for /f "delims=" %%B in ('git branch --show-current 2^>nul') do set "ADAPTER_CURRENT_BRANCH=%%B"
if not "%ADAPTER_CURRENT_BRANCH%"=="%EXPECTED_BRANCH%" (
  call :Fail BLOCKED_DEPLOY_WRONG_BRANCH "Current branch does not match expected branch"
  exit /b 1
)
set "ADAPTER_CURRENT_REMOTE="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "ADAPTER_CURRENT_REMOTE=%%R"
if not "%ADAPTER_CURRENT_REMOTE%"=="%EXPECTED_REMOTE%" (
  call :Fail BLOCKED_DEPLOY_REMOTE_ORIGIN_MISMATCH "origin remote does not match configured remote"
  exit /b 1
)
set "ADAPTER_GIT_USER_NAME="
set "ADAPTER_GIT_USER_EMAIL="
for /f "delims=" %%N in ('git config user.name 2^>nul') do set "ADAPTER_GIT_USER_NAME=%%N"
for /f "delims=" %%E in ('git config user.email 2^>nul') do set "ADAPTER_GIT_USER_EMAIL=%%E"
if not "%ADAPTER_GIT_USER_NAME%"=="%GIT_USER_NAME%" (
  call :Fail BLOCKED_DEPLOY_GIT_USER_NAME_MISMATCH "Local git user.name does not match config"
  exit /b 1
)
if not "%ADAPTER_GIT_USER_EMAIL%"=="%GIT_USER_EMAIL%" (
  call :Fail BLOCKED_DEPLOY_GIT_USER_EMAIL_MISMATCH "Local git user.email does not match config"
  exit /b 1
)
git diff --quiet --exit-code
if errorlevel 1 (
  call :Fail BLOCKED_DEPLOY_TRACKED_WORKTREE_DIRTY "Tracked working tree has unstaged changes"
  exit /b 1
)
git diff --cached --quiet --exit-code
if errorlevel 1 (
  call :Fail BLOCKED_DEPLOY_STAGED_CHANGES_PRESENT "Staged changes are present"
  exit /b 1
)
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
git fetch origin --prune
if errorlevel 1 (
  call :Fail BLOCKED_DEPLOY_GIT_FETCH_FAILED "git fetch origin --prune failed"
  exit /b 1
)
git show-ref --verify --quiet "refs/remotes/origin/%EXPECTED_BRANCH%"
if errorlevel 1 (
  call :Fail BLOCKED_DEPLOY_REMOTE_BRANCH_MISSING "Configured origin branch is missing"
  exit /b 1
)
set "ADAPTER_LOCAL_AHEAD="
set "ADAPTER_REMOTE_AHEAD="
set "ADAPTER_AHEAD_BEHIND_EXTRA="
for /f "tokens=1,2,3" %%A in ('git rev-list --left-right --count HEAD...origin/%EXPECTED_BRANCH% 2^>nul') do (
  set "ADAPTER_LOCAL_AHEAD=%%A"
  set "ADAPTER_REMOTE_AHEAD=%%B"
  set "ADAPTER_AHEAD_BEHIND_EXTRA=%%C"
)
if not defined ADAPTER_LOCAL_AHEAD (
  call :Fail BLOCKED_DEPLOY_AHEAD_BEHIND_UNAVAILABLE "Ahead/behind could not be resolved"
  exit /b 1
)
if not defined ADAPTER_REMOTE_AHEAD (
  call :Fail BLOCKED_DEPLOY_AHEAD_BEHIND_UNAVAILABLE "Ahead/behind could not be resolved"
  exit /b 1
)
if defined ADAPTER_AHEAD_BEHIND_EXTRA (
  call :Fail BLOCKED_DEPLOY_AHEAD_BEHIND_INVALID "Ahead/behind output was invalid"
  exit /b 1
)
if not "%ADAPTER_LOCAL_AHEAD%"=="0" (
  call :Fail BLOCKED_DEPLOY_LOCAL_AHEAD_OF_ORIGIN "Local branch has commits not on origin"
  exit /b 1
)
if not "%ADAPTER_REMOTE_AHEAD%"=="0" (
  call :Fail BLOCKED_DEPLOY_REMOTE_AHEAD_OF_LOCAL "Origin branch has commits not in local HEAD"
  exit /b 1
)
echo ADAPTER_PRIVILEGED_PREFLIGHT_PASS
exit /b 0

:GasPreflight
if not exist ".clasp.json" (
  call :Fail BLOCKED_CLASP_CONFIG_MISSING ".clasp.json is missing"
  exit /b 1
)
set "CLASP_SCRIPT_ID=" & set "CLASP_ROOT_DIR_CURRENT="
for /f "tokens=1,2 delims=|" %%A in ('powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $clasp = Get-Content -LiteralPath '.clasp.json' -Raw ^| ConvertFrom-Json; if ($null -eq $clasp -or $clasp -isnot [pscustomobject]) { exit 1 }; $id=@($clasp.PSObject.Properties ^| Where-Object { $_.Name -ceq 'scriptId' }); $root=@($clasp.PSObject.Properties ^| Where-Object { $_.Name -ceq 'rootDir' }); if ($id.Count -ne 1 -or $root.Count -ne 1 -or $id[0].Value -isnot [string] -or $root[0].Value -isnot [string] -or [string]::IsNullOrWhiteSpace($id[0].Value) -or [string]::IsNullOrWhiteSpace($root[0].Value)) { exit 1 }; [Console]::Out.Write($id[0].Value + '|' + $root[0].Value)" 2^>nul') do (set "CLASP_SCRIPT_ID=%%A" & set "CLASP_ROOT_DIR_CURRENT=%%B")
if not defined CLASP_SCRIPT_ID (
  call :Fail BLOCKED_CLASP_CONFIG_SCHEMA_INVALID ".clasp.json must contain exact non-empty top-level scriptId and rootDir strings"
  exit /b 1
)
if not "%CLASP_SCRIPT_ID%"=="%GAS_SCRIPT_ID%" (
  call :Fail BLOCKED_GAS_SCRIPT_ID_MISMATCH ".clasp.json scriptId does not match config"
  exit /b 1
)
if not "%CLASP_ROOT_DIR_CURRENT%"=="%CLASP_ROOT_DIR%" (
  call :Fail BLOCKED_CLASP_ROOT_DIR_MISMATCH ".clasp.json rootDir does not match config"
  exit /b 1
)
call :RequireTool clasp.cmd
if errorlevel 1 exit /b 1
if not exist "appsscript.json" (
  call :Fail BLOCKED_APPS_SCRIPT_MANIFEST_MISSING "appsscript.json is missing"
  exit /b 1
)
set "CLASP_USER_FILE=%TEMP%\project_guard_clasp_user_%PROJECT_KEY%_%RANDOM%%RANDOM%.txt"
call clasp.cmd --user "%CLASP_PROFILE%" --json show-authorized-user > "%CLASP_USER_FILE%" 2>&1
if errorlevel 1 (
  type "%CLASP_USER_FILE%"
  del "%CLASP_USER_FILE%" >nul 2>&1
  call :Fail BLOCKED_CLASP_AUTH_STATUS_FAILED "clasp authorized user check failed"
  exit /b 1
)
set "CLASP_ACCOUNT_CURRENT="
for /f "usebackq delims=" %%A in (`powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $v=Get-Content -LiteralPath '%CLASP_USER_FILE%' -Raw ^| ConvertFrom-Json; $p=@($v.PSObject.Properties ^| Where-Object { $_.Name -ceq 'email' -or $_.Name -ceq 'user' }); if ($p.Count -ne 1 -or $p[0].Value -isnot [string] -or [string]::IsNullOrWhiteSpace($p[0].Value)) { exit 1 }; [Console]::Out.Write($p[0].Value)" 2^>nul`) do set "CLASP_ACCOUNT_CURRENT=%%A"
if not "%CLASP_ACCOUNT_CURRENT%"=="%GAS_ACCOUNT%" (
  type "%CLASP_USER_FILE%"
  del "%CLASP_USER_FILE%" >nul 2>&1
  call :Fail BLOCKED_CLASP_ACCOUNT_MISMATCH "clasp structured account does not match config"
  exit /b 1
)
del "%CLASP_USER_FILE%" >nul 2>&1
call :VerifyGasUploadInventory
if errorlevel 1 exit /b 1
call clasp.cmd --user "%CLASP_PROFILE%" status --json >nul
if errorlevel 1 (
  call :Fail BLOCKED_CLASP_STATUS_FAILED "clasp status failed"
  exit /b 1
)
echo GAS_PREFLIGHT_PASS
exit /b 0

:FirebasePreflight
call :RequireTool firebase.cmd
if errorlevel 1 exit /b 1
call :RequireTool gcloud.cmd
if errorlevel 1 exit /b 1
if not exist ".firebaserc" (
  call :Fail BLOCKED_FIREBASERC_MISSING ".firebaserc is missing"
  exit /b 1
)
set "FIREBASERC_PROJECT="
for /f "usebackq delims=" %%A in (`powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $v=Get-Content -LiteralPath '.firebaserc' -Raw ^| ConvertFrom-Json; $projects=@($v.PSObject.Properties ^| Where-Object { $_.Name -ceq 'projects' }); if ($projects.Count -ne 1 -or $projects[0].Value -isnot [pscustomobject]) { exit 1 }; $production=@($projects[0].Value.PSObject.Properties ^| Where-Object { $_.Name -ceq 'production' }); if ($production.Count -ne 1 -or $production[0].Value -isnot [string] -or [string]::IsNullOrWhiteSpace($production[0].Value)) { exit 1 }; [Console]::Out.Write($production[0].Value)" 2^>nul`) do set "FIREBASERC_PROJECT=%%A"
if not "%FIREBASERC_PROJECT%"=="%FIREBASE_PROJECT_ID%" (
  call :Fail BLOCKED_FIREBASE_PROJECT_ID_MISMATCH ".firebaserc structured production project does not match config"
  exit /b 1
)
set "FIREBASE_USER_FILE=%TEMP%\project_guard_firebase_user_%PROJECT_KEY%_%RANDOM%%RANDOM%.txt"
call firebase.cmd login:list > "%FIREBASE_USER_FILE%" 2>&1
if errorlevel 1 (
  type "%FIREBASE_USER_FILE%"
  del "%FIREBASE_USER_FILE%" >nul 2>&1
  call :Fail BLOCKED_FIREBASE_LOGIN_LIST_FAILED "firebase login:list failed"
  exit /b 1
)
set "FIREBASE_ACCOUNT_CURRENT="
for /f "usebackq delims=" %%A in (`powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $v=Get-Content -LiteralPath '%FIREBASE_USER_FILE%' -Raw ^| ConvertFrom-Json; $result=@($v.PSObject.Properties ^| Where-Object { $_.Name -ceq 'result' }); if ($result.Count -ne 1 -or $result[0].Value -isnot [array] -or $result[0].Value.Count -ne 1 -or $result[0].Value[0] -isnot [string]) { exit 1 }; [Console]::Out.Write($result[0].Value[0])" 2^>nul`) do set "FIREBASE_ACCOUNT_CURRENT=%%A"
if not "%FIREBASE_ACCOUNT_CURRENT%"=="%FIREBASE_ACCOUNT%" (
  type "%FIREBASE_USER_FILE%"
  del "%FIREBASE_USER_FILE%" >nul 2>&1
  call :Fail BLOCKED_FIREBASE_ACCOUNT_MISMATCH "Firebase structured account does not match config"
  exit /b 1
)
del "%FIREBASE_USER_FILE%" >nul 2>&1
set "FIREBASE_PROJECT_CURRENT="
for /f "usebackq delims=" %%A in (`firebase.cmd projects:list --json ^| powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $v=[Console]::In.ReadToEnd() ^| ConvertFrom-Json; $r=@($v.PSObject.Properties ^| Where-Object { $_.Name -ceq 'result' }); if($r.Count-ne 1 -or $r[0].Value -isnot [array]){exit 1}; $ids=@($r[0].Value ^| ForEach-Object { $p=@($_.PSObject.Properties ^| Where-Object { $_.Name -ceq 'projectId' }); if($p.Count-ne 1 -or $p[0].Value -isnot [string]){throw 'schema'}; $p[0].Value }); if(@($ids ^| Where-Object { $_ -ceq '%FIREBASE_PROJECT_ID%' }).Count-ne 1){exit 1}; [Console]::Out.Write('%FIREBASE_PROJECT_ID%')" 2^>nul`) do set "FIREBASE_PROJECT_CURRENT=%%A"
if not "%FIREBASE_PROJECT_CURRENT%"=="%FIREBASE_PROJECT_ID%" (
  call :Fail BLOCKED_FIREBASE_PROJECT_LIST_MISMATCH "Firebase structured project inventory does not contain exactly the configured project"
  exit /b 1
)
set "GCLOUD_ACCOUNT_CURRENT=" & set "GCLOUD_PROJECT_CURRENT="
for /f "tokens=1,2 delims=|" %%A in ('gcloud.cmd config list --configuration="%GCLOUD_CONFIGURATION%" --format=json ^| powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $v=[Console]::In.ReadToEnd() ^| ConvertFrom-Json; $core=@($v.PSObject.Properties ^| Where-Object { $_.Name -ceq 'core' }); if ($core.Count -ne 1 -or $core[0].Value -isnot [pscustomobject]) { exit 1 }; $a=@($core[0].Value.PSObject.Properties ^| Where-Object { $_.Name -ceq 'account' }); $p=@($core[0].Value.PSObject.Properties ^| Where-Object { $_.Name -ceq 'project' }); if ($a.Count -ne 1 -or $p.Count -ne 1 -or $a[0].Value -isnot [string] -or $p[0].Value -isnot [string]) { exit 1 }; [Console]::Out.Write($a[0].Value + '|' + $p[0].Value)"') do (set "GCLOUD_ACCOUNT_CURRENT=%%A" & set "GCLOUD_PROJECT_CURRENT=%%B")
if not "%GCLOUD_ACCOUNT_CURRENT%"=="%FIREBASE_ACCOUNT%" (
  call :Fail BLOCKED_GCLOUD_ACCOUNT_MISMATCH "gcloud account does not match config"
  exit /b 1
)
if not "%GCLOUD_PROJECT_CURRENT%"=="%FIREBASE_PROJECT_ID%" (
  call :Fail BLOCKED_GCLOUD_PROJECT_MISMATCH "gcloud project does not match config"
  exit /b 1
)
set "FIREBASE_SITE_CURRENT="
for /f "usebackq delims=" %%A in (`firebase.cmd hosting:sites:list --project "%FIREBASE_PROJECT_ID%" --json ^| powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $v=[Console]::In.ReadToEnd() ^| ConvertFrom-Json; $r=@($v.PSObject.Properties ^| Where-Object { $_.Name -ceq 'result' }); if ($r.Count -ne 1 -or $r[0].Value -isnot [array]) { exit 1 }; $ids=@($r[0].Value ^| ForEach-Object { $p=@($_.PSObject.Properties ^| Where-Object { $_.Name -ceq 'name' -or $_.Name -ceq 'site' }); if ($p.Count -ne 1 -or $p[0].Value -isnot [string]) { throw 'invalid' }; $p[0].Value }); if (@($ids ^| Where-Object { $_ -ceq '%FIREBASE_HOSTING_SITE_ID%' }).Count -ne 1) { exit 1 }; [Console]::Out.Write('%FIREBASE_HOSTING_SITE_ID%')" 2^>nul`) do set "FIREBASE_SITE_CURRENT=%%A"
if not "%FIREBASE_SITE_CURRENT%"=="%FIREBASE_HOSTING_SITE_ID%" (
  call :Fail BLOCKED_FIREBASE_HOSTING_SITE_MISSING "Configured Firebase Hosting site was not found"
  exit /b 1
)
call :VerifyFirestoreIdentity
if errorlevel 1 exit /b 1
echo FIREBASE_PREFLIGHT_PASS
exit /b 0

:VerifyGasUploadInventory
set "GAS_INVENTORY_FILE=%TEMP%\project_guard_clasp_inventory_%PROJECT_KEY%_%RANDOM%%RANDOM%.json"
call clasp.cmd --user "%CLASP_PROFILE%" status --json > "%GAS_INVENTORY_FILE%" 2>&1
if errorlevel 1 (del "%GAS_INVENTORY_FILE%" >nul 2>&1 & call :Fail BLOCKED_CLASP_INVENTORY_UNAVAILABLE "clasp upload inventory could not be derived" & exit /b 1)
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; function N($p){$v=[string]$p -replace '\\','/'; if([string]::IsNullOrWhiteSpace($v) -or $v.StartsWith('/') -or $v -match '(^|/)\.\.(/|$)'){throw 'path'}; $v.TrimStart('./')}; $s=Get-Content -LiteralPath '%GAS_INVENTORY_FILE%' -Raw ^| ConvertFrom-Json; $p=@($s.PSObject.Properties ^| Where-Object { $_.Name -ceq 'files' }); if($p.Count-ne 1 -or $p[0].Value -isnot [array]){throw 'schema'}; $actual=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal); foreach($x in $p[0].Value){if($x-isnot [string] -or -not $actual.Add((N $x))){throw 'inventory'}}; $expected=[Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal); foreach($x in Get-Content -LiteralPath 'deploy/gas-runtime-files.txt'){if($x.Trim() -and -not $expected.Add((N $x))){throw 'expected'}}; if(-not $actual.SetEquals($expected)){throw 'mismatch'}" >nul 2>&1
set "GAS_INVENTORY_RC=%ERRORLEVEL%"
del "%GAS_INVENTORY_FILE%" >nul 2>&1
if not "%GAS_INVENTORY_RC%"=="0" (
  call :Fail BLOCKED_CLASP_UPLOAD_INVENTORY_MISMATCH "clasp upload inventory does not exactly match deploy/gas-runtime-files.txt"
  exit /b 1
)
exit /b 0

:VerifyFirestoreIdentity
set "FIRESTORE_PROJECT_NUMBER_CURRENT=" & set "FIRESTORE_LOCATION_CURRENT=" & set "FIRESTORE_TYPE_CURRENT=" & set "FIRESTORE_EDITION_CURRENT=" & set "FIRESTORE_DELETE_PROTECTION_CURRENT="
for /f "tokens=1,2,3,4,5 delims=|" %%A in ('gcloud.cmd projects describe "%FIREBASE_PROJECT_ID%" --configuration="%GCLOUD_CONFIGURATION%" --format=json ^| powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $p=[Console]::In.ReadToEnd() ^| ConvertFrom-Json; if($p.projectId -cne '%FIREBASE_PROJECT_ID%' -or $p.projectNumber -isnot [string] -and $p.projectNumber -isnot [Int64]){exit 1}; $d=& gcloud.cmd firestore databases describe --database='%FIRESTORE_DATABASE_ID%' --project='%FIREBASE_PROJECT_ID%' --configuration='%GCLOUD_CONFIGURATION%' --format=json; if($LASTEXITCODE-ne 0){exit 1}; $v=$d ^| ConvertFrom-Json; foreach($n in 'locationId','type','edition','deleteProtectionState'){if($null-eq $v.$n -or $v.$n-isnot [string]){exit 1}}; [Console]::Out.Write([string]$p.projectNumber+'|'+$v.locationId+'|'+$v.type+'|'+$v.edition+'|'+$v.deleteProtectionState)" 2^>nul') do (set "FIRESTORE_PROJECT_NUMBER_CURRENT=%%A" & set "FIRESTORE_LOCATION_CURRENT=%%B" & set "FIRESTORE_TYPE_CURRENT=%%C" & set "FIRESTORE_EDITION_CURRENT=%%D" & set "FIRESTORE_DELETE_PROTECTION_CURRENT=%%E")
if not "%FIRESTORE_PROJECT_NUMBER_CURRENT%"=="%FIREBASE_PROJECT_NUMBER%" (call :Fail BLOCKED_FIRESTORE_PROJECT_NUMBER_MISMATCH "Firestore project number does not match config" & exit /b 1)
if not "%FIRESTORE_LOCATION_CURRENT%"=="%FIRESTORE_LOCATION%" (call :Fail BLOCKED_FIRESTORE_LOCATION_MISMATCH "Firestore location does not match config" & exit /b 1)
if not "%FIRESTORE_TYPE_CURRENT%"=="%FIRESTORE_TYPE%" (call :Fail BLOCKED_FIRESTORE_TYPE_MISMATCH "Firestore type does not match config" & exit /b 1)
if not "%FIRESTORE_EDITION_CURRENT%"=="%FIRESTORE_EDITION%" (call :Fail BLOCKED_FIRESTORE_EDITION_MISMATCH "Firestore edition does not match config" & exit /b 1)
if not "%FIRESTORE_DELETE_PROTECTION_CURRENT%"=="%FIRESTORE_DELETE_PROTECTION%" (call :Fail BLOCKED_FIRESTORE_DELETE_PROTECTION_MISMATCH "Firestore delete protection does not match config" & exit /b 1)
exit /b 0

:Confirm
set "SOURCE_SHA="
for /f "delims=" %%H in ('git rev-parse HEAD') do set "SOURCE_SHA=%%H"
echo CONFIRM_ACTION=SYNC_DEPLOY
echo PROJECT=%PROJECT_KEY%
echo DEPLOY_TARGET=%DEPLOY_TARGET%
echo SOURCE_SHA=%SOURCE_SHA%
echo GOOGLE_ACCOUNT=%GAS_ACCOUNT%
echo GAS_SCRIPT_ID=%GAS_SCRIPT_ID%
echo FIREBASE_PROJECT_ID=%FIREBASE_PROJECT_ID%
echo FIREBASE_SITE_ID=%FIREBASE_HOSTING_SITE_ID%
echo PREFLIGHT_STATUS=PASS
call :ConfirmY "Continue deploy?"
set "CONFIRM_RC=%ERRORLEVEL%"
if "%CONFIRM_RC%"=="2" (
  call :Cancel
  exit /b 2
)
if not "%CONFIRM_RC%"=="0" (
  call :Fail BLOCKED_CONFIRMATION_HANDLER_FAILED "Confirmation handling failed"
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

:DeployGas
call :AdapterPrivilegedPreflight
if errorlevel 1 exit /b 1
call :GasPreflight
if errorlevel 1 exit /b 1
set "GAS_PUSH_FILE=%TEMP%\project_guard_clasp_push_%PROJECT_KEY%_%RANDOM%%RANDOM%.txt"
set "GAS_PUSH_OUTCOME=ATTEMPTED"
echo GAS_PUSH_OUTCOME=%GAS_PUSH_OUTCOME%
call clasp.cmd --user "%CLASP_PROFILE%" push > "%GAS_PUSH_FILE%" 2>&1
if errorlevel 1 (
  set "GAS_PUSH_OUTCOME=PENDING_LATE_COMPLETION_QUARANTINE"
  set "DEPLOY_RUN=UNKNOWN"
  type "%GAS_PUSH_FILE%"
  del "%GAS_PUSH_FILE%" >nul 2>&1
  call :Fail PENDING_LATE_COMPLETION_QUARANTINE "clasp push returned an unproven outcome"
  exit /b 1
)
findstr /I /C:"Skipping push" "%GAS_PUSH_FILE%" >nul
if not errorlevel 1 (
  type "%GAS_PUSH_FILE%"
  del "%GAS_PUSH_FILE%" >nul 2>&1
  call :Fail BLOCKED_GAS_PUSH_SKIPPED "clasp reported Skipping push"
  exit /b 1
)
type "%GAS_PUSH_FILE%"
del "%GAS_PUSH_FILE%" >nul 2>&1
set "GAS_PUSH_OUTCOME=CONFIRMED_SUCCESS"
set "PUSH_RUN=true"
echo GAS_PUSH_OUTCOME=%GAS_PUSH_OUTCOME%
call :AdapterPrivilegedPreflight
if errorlevel 1 exit /b 1
call :GasPreflight
if errorlevel 1 exit /b 1
set "GAS_DEPLOY_OUTCOME=ATTEMPTED"
echo GAS_DEPLOY_OUTCOME=%GAS_DEPLOY_OUTCOME%
call clasp.cmd --user "%CLASP_PROFILE%" deploy --description "guard-v3-%DATE%-%TIME%"
if errorlevel 1 (
  set "GAS_DEPLOY_OUTCOME=PENDING_LATE_COMPLETION_QUARANTINE"
  set "DEPLOY_RUN=UNKNOWN"
  call :Fail PENDING_LATE_COMPLETION_QUARANTINE "clasp deploy returned an unproven outcome"
  exit /b 1
)
set "DEPLOY_RUN=true"
set "NEW_VERSION_CREATED=true"
set "GAS_DEPLOY_OUTCOME=CONFIRMED_SUCCESS"
echo GAS_DEPLOY_OUTCOME=%GAS_DEPLOY_OUTCOME%
echo GAS_DEPLOY_PASS
exit /b 0

:DeployFirebase
call :AdapterPrivilegedPreflight
if errorlevel 1 exit /b 1
call :FirebasePreflight
if errorlevel 1 exit /b 1
call :AdapterPrivilegedPreflight
if errorlevel 1 exit /b 1
set "FIREBASE_DEPLOY_OUTCOME=ATTEMPTED"
echo FIREBASE_DEPLOY_OUTCOME=%FIREBASE_DEPLOY_OUTCOME%
call firebase.cmd deploy --only hosting:%FIREBASE_HOSTING_SITE_ID% --project "%FIREBASE_PROJECT_ID%"
if errorlevel 1 (
  set "FIREBASE_DEPLOY_OUTCOME=PENDING_LATE_COMPLETION_QUARANTINE"
  if "%GAS_DEPLOY_OUTCOME%"=="CONFIRMED_SUCCESS" (
    set "DEPLOY_RUN=PARTIAL_GAS_CONFIRMED_FIREBASE_NOT_CONFIRMED"
  ) else (
    set "DEPLOY_RUN=UNKNOWN"
  )
  call :Fail PENDING_LATE_COMPLETION_QUARANTINE "Firebase deploy returned an unproven outcome"
  exit /b 1
)
set "DEPLOY_RUN=true"
set "FIREBASE_DEPLOY_OUTCOME=CONFIRMED_SUCCESS"
echo FIREBASE_DEPLOY_OUTCOME=%FIREBASE_DEPLOY_OUTCOME%
echo FIREBASE_DEPLOY_PASS
exit /b 0

:RequireTool
where %~1 >nul 2>&1
if errorlevel 1 (
  call :Fail BLOCKED_REQUIRED_TOOL_MISSING "Required tool missing: %~1"
  exit /b 1
)
exit /b 0

:Fail
echo PROJECT=%PROJECT_KEY%
echo ADAPTER=google_apps_firebase
echo ACTION=%ADAPTER_ACTION%
echo TARGET=%DEPLOY_TARGET%
echo STATUS=FAILED
echo FAILED_GATE=%~1
echo ERROR_MESSAGE=%~2
echo RELEVANT_LOG=%RELEVANT_LOG%
echo PUSH_RUN=%PUSH_RUN%
echo DEPLOY_RUN=%DEPLOY_RUN%
echo GAS_PUSH_OUTCOME=%GAS_PUSH_OUTCOME%
echo GAS_DEPLOY_OUTCOME=%GAS_DEPLOY_OUTCOME%
echo FIREBASE_DEPLOY_OUTCOME=%FIREBASE_DEPLOY_OUTCOME%
echo NEW_VERSION_CREATED=%NEW_VERSION_CREATED%
echo HTTP_PROBE_RUN=%HTTP_PROBE_RUN%
exit /b 1

:Cancel
echo PROJECT=%PROJECT_KEY%
echo ADAPTER=google_apps_firebase
echo ACTION=%ADAPTER_ACTION%
echo TARGET=%DEPLOY_TARGET%
echo ACTION_STATUS=CANCELLED
echo DEPLOY_STATUS=CANCELLED
echo EXIT_CODE=2
echo RELEVANT_LOG=%RELEVANT_LOG%
echo PUSH_RUN=%PUSH_RUN%
echo DEPLOY_RUN=%DEPLOY_RUN%
echo NEW_VERSION_CREATED=%NEW_VERSION_CREATED%
echo GAS_PUSH_OUTCOME=%GAS_PUSH_OUTCOME%
echo GAS_DEPLOY_OUTCOME=%GAS_DEPLOY_OUTCOME%
echo FIREBASE_DEPLOY_OUTCOME=%FIREBASE_DEPLOY_OUTCOME%
echo HTTP_PROBE_RUN=false
exit /b 2
