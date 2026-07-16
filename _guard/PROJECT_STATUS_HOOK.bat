@echo off
setlocal EnableExtensions DisableDelayedExpansion

echo.
echo SyncGmailDriveSheet project-specific status hook:

where firebase.cmd >nul 2>&1
if errorlevel 1 (
  echo BLOCKED_FIREBASE_CLI_NOT_FOUND
  exit /b 1
)
where gcloud.cmd >nul 2>&1
if errorlevel 1 (
  echo BLOCKED_GCLOUD_CLI_NOT_FOUND
  exit /b 1
)

for /f "delims=" %%V in ('firebase.cmd --version 2^>nul') do if not defined FIREBASE_VERSION set "FIREBASE_VERSION=%%V"
if not defined FIREBASE_VERSION (
  echo BLOCKED_FIREBASE_VERSION_CHECK_FAILED
  exit /b 1
)
echo Firebase CLI confirmed: %FIREBASE_VERSION%

set "FB_LOGIN_FILE=%TEMP%\sync_guard_fb_login_%RANDOM%%RANDOM%.txt"
call firebase.cmd login:list > "%FB_LOGIN_FILE%" 2>&1
if errorlevel 1 (
  type "%FB_LOGIN_FILE%"
  del "%FB_LOGIN_FILE%" >nul 2>&1
  echo BLOCKED_FIREBASE_LOGIN_LIST_FAILED
  exit /b 1
)
findstr /I /C:"Logged in as %FIREBASE_ACCOUNT%" "%FB_LOGIN_FILE%" >nul
if errorlevel 1 (
  type "%FB_LOGIN_FILE%"
  del "%FB_LOGIN_FILE%" >nul 2>&1
  echo BLOCKED_FIREBASE_ACCOUNT_MISMATCH: expected=%FIREBASE_ACCOUNT%
  echo Suggested command: firebase.cmd login:use %FIREBASE_ACCOUNT%
  exit /b 1
)
del "%FB_LOGIN_FILE%" >nul 2>&1
echo Firebase active account confirmed: %FIREBASE_ACCOUNT%

set "FB_PROJECTS_FILE=%TEMP%\sync_guard_fb_projects_%RANDOM%%RANDOM%.json"
call firebase.cmd projects:list --json > "%FB_PROJECTS_FILE%" 2>&1
if errorlevel 1 (
  type "%FB_PROJECTS_FILE%"
  del "%FB_PROJECTS_FILE%" >nul 2>&1
  echo BLOCKED_FIREBASE_PROJECT_LIST_FAILED
  exit /b 1
)
set "HOOK_JSON=%FB_PROJECTS_FILE%"
set "HOOK_PROJECT_ID=%FIREBASE_PROJECT_ID%"
set "HOOK_PROJECT_NUMBER=%FIREBASE_PROJECT_NUMBER%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $raw=Get-Content -Raw -LiteralPath $env:HOOK_JSON; $start=$raw.IndexOf('{'); $end=$raw.LastIndexOf('}'); if ($start -lt 0 -or $end -lt $start) { exit 4 }; $j=$raw.Substring($start, $end - $start + 1) | ConvertFrom-Json; $m=@($j.result | Where-Object { [string]$_.projectId -ceq $env:HOOK_PROJECT_ID -and [string]$_.projectNumber -ceq $env:HOOK_PROJECT_NUMBER -and [string]$_.state -ceq 'ACTIVE' }); if ($m.Count -eq 1) { exit 0 } else { exit 2 } } catch { exit 3 }"
set "FB_PROJECT_VERIFY=%ERRORLEVEL%"
if not "%FB_PROJECT_VERIFY%"=="0" (
  type "%FB_PROJECTS_FILE%"
  del "%FB_PROJECTS_FILE%" >nul 2>&1
  echo BLOCKED_FIREBASE_PROJECT_CONTEXT_MISMATCH: project=%FIREBASE_PROJECT_ID% number=%FIREBASE_PROJECT_NUMBER%
  exit /b 1
)
del "%FB_PROJECTS_FILE%" >nul 2>&1
echo Firebase project confirmed: %FIREBASE_PROJECT_ID% ^(%FIREBASE_PROJECT_NUMBER%^)

set "GCLOUD_ACCOUNT="
for /f "delims=" %%A in ('gcloud.cmd config get-value account --configuration=%GCLOUD_CONFIGURATION% --quiet 2^>nul') do if not defined GCLOUD_ACCOUNT set "GCLOUD_ACCOUNT=%%A"
if /I not "%GCLOUD_ACCOUNT%"=="%FIREBASE_ACCOUNT%" (
  echo BLOCKED_GCLOUD_ACCOUNT_MISMATCH: current=%GCLOUD_ACCOUNT% expected=%FIREBASE_ACCOUNT%
  echo Suggested command: gcloud.cmd config set account %FIREBASE_ACCOUNT% --configuration=%GCLOUD_CONFIGURATION%
  exit /b 1
)
echo gcloud account confirmed: %GCLOUD_ACCOUNT%

set "GCLOUD_PROJECT="
for /f "delims=" %%P in ('gcloud.cmd config get-value project --configuration=%GCLOUD_CONFIGURATION% --quiet 2^>nul') do if not defined GCLOUD_PROJECT set "GCLOUD_PROJECT=%%P"
if /I not "%GCLOUD_PROJECT%"=="%FIREBASE_PROJECT_ID%" (
  echo BLOCKED_GCLOUD_PROJECT_MISMATCH: current=%GCLOUD_PROJECT% expected=%FIREBASE_PROJECT_ID%
  echo Suggested command: gcloud.cmd config set project %FIREBASE_PROJECT_ID% --configuration=%GCLOUD_CONFIGURATION%
  exit /b 1
)
echo gcloud project confirmed: %GCLOUD_PROJECT%

set "PROJECT_NUMBER_ACTUAL="
for /f "delims=" %%N in ('gcloud.cmd projects describe %FIREBASE_PROJECT_ID% --configuration=%GCLOUD_CONFIGURATION% --format="value(projectNumber)" 2^>nul') do if not defined PROJECT_NUMBER_ACTUAL set "PROJECT_NUMBER_ACTUAL=%%N"
if not "%PROJECT_NUMBER_ACTUAL%"=="%FIREBASE_PROJECT_NUMBER%" (
  echo BLOCKED_GCLOUD_PROJECT_NUMBER_MISMATCH: current=%PROJECT_NUMBER_ACTUAL% expected=%FIREBASE_PROJECT_NUMBER%
  exit /b 1
)
echo gcloud project number confirmed: %PROJECT_NUMBER_ACTUAL%

set "PROJECT_STATE="
for /f "delims=" %%S in ('gcloud.cmd projects describe %FIREBASE_PROJECT_ID% --configuration=%GCLOUD_CONFIGURATION% --format="value(lifecycleState)" 2^>nul') do if not defined PROJECT_STATE set "PROJECT_STATE=%%S"
if /I not "%PROJECT_STATE%"=="ACTIVE" (
  echo BLOCKED_GCLOUD_PROJECT_NOT_ACTIVE: current=%PROJECT_STATE%
  exit /b 1
)
echo gcloud project lifecycle confirmed: %PROJECT_STATE%

set "FIREBASERC=%PROJECT_ROOT%\.firebaserc"
if not exist "%FIREBASERC%" (
  echo BLOCKED_FIREBASERC_MISSING: %FIREBASERC%
  exit /b 1
)
set "HOOK_FIREBASERC=%FIREBASERC%"
set "HOOK_PROJECT_ID=%FIREBASE_PROJECT_ID%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $j=Get-Content -Raw -LiteralPath $env:HOOK_FIREBASERC | ConvertFrom-Json; if ([string]$j.projects.production -ceq $env:HOOK_PROJECT_ID) { exit 0 } else { exit 2 } } catch { exit 3 }"
if errorlevel 1 (
  echo BLOCKED_FIREBASE_ALIAS_MISMATCH: production expected=%FIREBASE_PROJECT_ID%
  exit /b 1
)
echo .firebaserc alias confirmed: production -^> %FIREBASE_PROJECT_ID%

set "HOSTING_FILE=%TEMP%\sync_guard_hosting_%RANDOM%%RANDOM%.txt"
call firebase.cmd hosting:sites:list --project=%FIREBASE_PROJECT_ID% > "%HOSTING_FILE%" 2>&1
if errorlevel 1 (
  type "%HOSTING_FILE%"
  del "%HOSTING_FILE%" >nul 2>&1
  echo BLOCKED_FIREBASE_HOSTING_SITE_LIST_FAILED
  exit /b 1
)
findstr /I /C:"%FIREBASE_HOSTING_SITE_ID%" "%HOSTING_FILE%" >nul
if errorlevel 1 (
  type "%HOSTING_FILE%"
  del "%HOSTING_FILE%" >nul 2>&1
  echo BLOCKED_FIREBASE_HOSTING_SITE_NOT_VISIBLE: %FIREBASE_HOSTING_SITE_ID%
  exit /b 1
)
del "%HOSTING_FILE%" >nul 2>&1
echo Firebase Hosting site confirmed: %FIREBASE_HOSTING_SITE_ID%

set "SERVICES_FILE=%TEMP%\sync_guard_services_%RANDOM%%RANDOM%.txt"
call gcloud.cmd services list --enabled --project=%FIREBASE_PROJECT_ID% --configuration=%GCLOUD_CONFIGURATION% --format="value(config.name)" > "%SERVICES_FILE%" 2>&1
if errorlevel 1 (
  type "%SERVICES_FILE%"
  del "%SERVICES_FILE%" >nul 2>&1
  echo BLOCKED_GCLOUD_SERVICES_LIST_FAILED
  exit /b 1
)
findstr /I /C:"firestore.googleapis.com" "%SERVICES_FILE%" >nul
if errorlevel 1 (
  type "%SERVICES_FILE%"
  del "%SERVICES_FILE%" >nul 2>&1
  echo BLOCKED_FIRESTORE_API_NOT_ENABLED
  exit /b 1
)
del "%SERVICES_FILE%" >nul 2>&1
echo Firestore API enabled confirmed

set "FIRESTORE_FILE=%TEMP%\sync_guard_firestore_%RANDOM%%RANDOM%.json"
call gcloud.cmd firestore databases list --project=%FIREBASE_PROJECT_ID% --configuration=%GCLOUD_CONFIGURATION% --format=json > "%FIRESTORE_FILE%" 2>&1
if errorlevel 1 (
  type "%FIRESTORE_FILE%"
  del "%FIRESTORE_FILE%" >nul 2>&1
  echo BLOCKED_FIRESTORE_DATABASE_LIST_FAILED
  exit /b 1
)
set "HOOK_FIRESTORE_JSON=%FIRESTORE_FILE%"
set "HOOK_PROJECT_ID=%FIREBASE_PROJECT_ID%"
set "HOOK_DATABASE_ID=%FIRESTORE_DATABASE_ID%"
set "HOOK_LOCATION=%FIRESTORE_LOCATION%"
set "HOOK_TYPE=%FIRESTORE_TYPE%"
set "HOOK_EDITION=%FIRESTORE_EDITION%"
set "HOOK_PROTECTION=%FIRESTORE_DELETE_PROTECTION%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $items=@(Get-Content -Raw -LiteralPath $env:HOOK_FIRESTORE_JSON | ConvertFrom-Json); $name='projects/' + $env:HOOK_PROJECT_ID + '/databases/' + $env:HOOK_DATABASE_ID; $m=@($items | Where-Object { [string]$_.name -ceq $name }); if ($m.Count -ne 1) { exit 2 }; $d=$m[0]; if ([string]$d.locationId -cne $env:HOOK_LOCATION) { exit 3 }; if ([string]$d.type -cne $env:HOOK_TYPE) { exit 4 }; if ([string]$d.databaseEdition -cne $env:HOOK_EDITION) { exit 5 }; if ([string]$d.deleteProtectionState -cne $env:HOOK_PROTECTION) { exit 6 }; exit 0 } catch { exit 7 }"
set "FIRESTORE_VERIFY=%ERRORLEVEL%"
if not "%FIRESTORE_VERIFY%"=="0" (
  type "%FIRESTORE_FILE%"
  del "%FIRESTORE_FILE%" >nul 2>&1
  echo BLOCKED_FIRESTORE_CONTEXT_MISMATCH: verification_exit=%FIRESTORE_VERIFY%
  exit /b 1
)
del "%FIRESTORE_FILE%" >nul 2>&1
echo Firestore database confirmed: %FIRESTORE_DATABASE_ID%
echo Firestore location confirmed: %FIRESTORE_LOCATION%
echo Firestore type confirmed: %FIRESTORE_TYPE%
echo Firestore edition confirmed: %FIRESTORE_EDITION%
echo Firestore delete protection confirmed: %FIRESTORE_DELETE_PROTECTION%
exit /b 0
