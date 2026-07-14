@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

set "SCRIPT_ID=19qIN0cXmBY9GY7ma8B2MJh25ioBsmrlrIwsr27ZB1oyFxH8VPMj0dmhM"
set "GOOGLE_ACCOUNT=hungdiepcompany@gmail.com"
set "CLASP_PROFILE=hungdiepcompany-gas"
set "TARGET_DIR=D:\CODE\SyncGmailDriveSheet"
set "LOG_FILE=%TARGET_DIR%\PULL_GAS_CODE.log"
set "BAT_FILE=%TARGET_DIR%\PULL_GAS_CODE.bat"
set "POWERSHELL_CMD=powershell.exe"
set "NODE_CMD=node.exe"
set "NPM_CMD=npm.cmd"
set "NPX_CMD=npx.cmd"
set "CLASP_CMD=clasp.cmd"
set "PUSHD_DONE=0"
set "AUTHORIZED_EMAIL="
set "BACKUP_STATUS=NOT_RUN"
set "PULL_EXIT=NOT_RUN"
set "POST_PULL_VALIDATION=NOT_RUN"

title Pull Google Apps Script Code

echo ============================================================
echo Pull Google Apps Script code ve may cuc bo
echo Target: %TARGET_DIR%
echo Script: %SCRIPT_ID%
echo Account bat buoc: %GOOGLE_ACCOUNT%
echo ============================================================
echo.

if not exist "%TARGET_DIR%\" (
  mkdir "%TARGET_DIR%"
  if errorlevel 1 (
    set "FAILED_STEP=Khoi tao thu muc dich"
    set "FAILED_CODE=MKDIR_TARGET_FAILED"
    goto FAIL_NO_POPD
  )
)

break > "%LOG_FILE%"
if errorlevel 1 (
  set "FAILED_STEP=Khoi tao log"
  set "FAILED_CODE=LOG_INIT_FAILED"
  goto FAIL_NO_POPD
)

call :Log "START_TIME=%DATE% %TIME%"
call :Log "BAT_FILE=%BAT_FILE%"
call :Log "TARGET_DIR=%TARGET_DIR%"
call :Log "SCRIPT_ID=%SCRIPT_ID%"
call :Log "EXPECTED_GOOGLE_ACCOUNT=%GOOGLE_ACCOUNT%"

echo [1/8] Kiem tra PowerShell va winget
call :Log "[1/8] Kiem tra PowerShell va winget"
where powershell.exe >nul 2>nul
if errorlevel 1 (
  set "FAILED_STEP=Kiem tra PowerShell"
  set "FAILED_CODE=POWERSHELL_NOT_FOUND"
  goto FAIL_NO_POPD
)
for /f "usebackq delims=" %%W in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { (Get-CimInstance Win32_OperatingSystem).Caption + ' ' + (Get-CimInstance Win32_OperatingSystem).Version } catch { 'UNKNOWN' }"`) do set "WINDOWS_VERSION=%%W"
call :Log "WINDOWS_VERSION=%WINDOWS_VERSION%"

where winget.exe >nul 2>nul
if errorlevel 1 (
  set "WINGET_STATUS=NOT_FOUND"
) else (
  set "WINGET_STATUS=FOUND"
)
call :Log "WINGET_STATUS=%WINGET_STATUS%"

echo [2/8] Kiem tra Node.js, npm va npx
call :Log "[2/8] Kiem tra Node.js, npm va npx"
call :EnsureNode
if errorlevel 1 (
  set "FAILED_STEP=Kiem tra hoac cai Node.js"
  set "FAILED_CODE=NODE_CHECK_FAILED"
  goto FAIL_NO_POPD
)

echo [3/8] Kiem tra hoac cai clasp
call :Log "[3/8] Kiem tra hoac cai clasp"
call :EnsureClasp
if errorlevel 1 (
  set "FAILED_STEP=Kiem tra hoac cai clasp"
  set "FAILED_CODE=CLASP_CHECK_FAILED"
  goto FAIL_NO_POPD
)

pushd "%TARGET_DIR%"
if errorlevel 1 (
  set "FAILED_STEP=pushd thu muc dich"
  set "FAILED_CODE=PUSHD_TARGET_FAILED"
  goto FAIL_NO_POPD
)
set "PUSHD_DONE=1"

echo [4/8] Kiem tra tai khoan Google
call :Log "[4/8] Kiem tra tai khoan Google"
call :EnsureAuthorizedAccount
if errorlevel 1 (
  set "FAILED_STEP=Kiem tra tai khoan Google"
  set "FAILED_CODE=GOOGLE_ACCOUNT_CHECK_FAILED"
  goto FAIL_POPD
)
call :Log "AUTHORIZED_EMAIL=%AUTHORIZED_EMAIL%"

echo [5/8] Kiem tra .clasp.json
call :Log "[5/8] Kiem tra .clasp.json"
call :EnsureClaspJson
if errorlevel 1 (
  set "FAILED_STEP=Kiem tra .clasp.json"
  set "FAILED_CODE=CLASP_JSON_FAILED"
  goto FAIL_POPD
)
call :Log "CLASP_JSON_STATUS=OK"

echo [6/8] Sao luu code cuc bo
call :Log "[6/8] Sao luu code cuc bo"
call :BackupLocalCode
if errorlevel 1 (
  set "FAILED_STEP=Sao luu code cuc bo"
  set "FAILED_CODE=BACKUP_FAILED"
  goto FAIL_POPD
)
call :Log "BACKUP_STATUS=%BACKUP_STATUS%"

echo [7/8] Pull code tu GAS
call :Log "[7/8] Pull code tu GAS"
call "%CLASP_CMD%" --user "%CLASP_PROFILE%" pull
set "PULL_EXIT=%ERRORLEVEL%"
call :Log "CLASP_PULL_EXIT=%PULL_EXIT%"
if not "%PULL_EXIT%"=="0" (
  set "FAILED_STEP=clasp pull"
  set "FAILED_CODE=CLASP_PULL_FAILED_%PULL_EXIT%"
  goto FAIL_POPD
)

echo [8/8] Xac minh ket qua
call :Log "[8/8] Xac minh ket qua"
call :PostPullValidation
if errorlevel 1 (
  set "FAILED_STEP=Xac minh ket qua sau pull"
  set "FAILED_CODE=POST_PULL_VALIDATION_FAILED"
  goto FAIL_POPD
)

set "POST_PULL_VALIDATION=PASS"
call :Log "POST_PULL_VALIDATION=PASS"
call :Log "FINAL_STATUS=PASS"
echo.
echo [PASS] DA PULL CODE GAS THANH CONG
popd
exit /b 0

:FAIL_POPD
if "%PUSHD_DONE%"=="1" popd
goto FAIL_COMMON

:FAIL_NO_POPD
goto FAIL_COMMON

:FAIL_COMMON
call :Log "FAILED_STEP=%FAILED_STEP%"
call :Log "FAILED_CODE=%FAILED_CODE%"
call :Log "FINAL_STATUS=FAILED"
echo.
echo [FAILED] KHONG PULL DUOC CODE GAS
echo Buoc loi: %FAILED_STEP%
echo Ma loi: %FAILED_CODE%
echo Log: %LOG_FILE%
exit /b 1

:Log
>> "%LOG_FILE%" echo [%DATE% %TIME%] %~1
exit /b 0

:RefreshPath
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
exit /b 0

:EnsureNode
call :RefreshPath
where node.exe >nul 2>nul
if errorlevel 1 goto INSTALL_NODE
where npm.cmd >nul 2>nul
if errorlevel 1 goto INSTALL_NODE
where npx.cmd >nul 2>nul
if errorlevel 1 goto INSTALL_NODE

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $v = (& node.exe --version).TrimStart('v'); $ver = [version]$v; if ($ver.Major -ge 22) { exit 0 } else { exit 1 } } catch { exit 2 }"
if errorlevel 1 goto INSTALL_NODE
goto VERIFY_NODE

:INSTALL_NODE
call :Log "NODE_STATUS=INSTALL_REQUIRED"
where winget.exe >nul 2>nul
if errorlevel 1 (
  call :Log "NODE_INSTALL=FAILED_WINGET_NOT_FOUND"
  exit /b 1
)
winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  call :Log "NODE_INSTALL=FAILED_WINGET_INSTALL"
  exit /b 1
)
call :RefreshPath

:VERIFY_NODE
where node.exe >nul 2>nul
if errorlevel 1 (
  call :Log "NODE_STATUS=FAILED_NODE_NOT_FOUND"
  exit /b 1
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  call :Log "NPM_STATUS=FAILED_NPM_NOT_FOUND"
  exit /b 1
)
where npx.cmd >nul 2>nul
if errorlevel 1 (
  call :Log "NPX_STATUS=FAILED_NPX_NOT_FOUND"
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $v = (& node.exe --version).TrimStart('v'); $ver = [version]$v; if ($ver.Major -ge 22) { exit 0 } else { exit 1 } } catch { exit 2 }"
if errorlevel 1 (
  call :Log "NODE_STATUS=FAILED_VERSION_LT_22"
  exit /b 1
)
for /f "usebackq delims=" %%V in (`node.exe --version`) do set "NODE_VERSION=%%V"
for /f "usebackq delims=" %%V in (`npm.cmd --version`) do set "NPM_VERSION=%%V"
for /f "usebackq delims=" %%V in (`npx.cmd --version`) do set "NPX_VERSION=%%V"
call :Log "NODE_STATUS=OK"
call :Log "NODE_VERSION=%NODE_VERSION%"
call :Log "NPM_STATUS=OK"
call :Log "NPM_VERSION=%NPM_VERSION%"
call :Log "NPX_STATUS=OK"
call :Log "NPX_VERSION=%NPX_VERSION%"
exit /b 0

:EnsureClasp
call :RefreshPath
where clasp.cmd >nul 2>nul
if errorlevel 1 goto INSTALL_CLASP
call clasp.cmd --version >nul 2>nul
if errorlevel 1 goto INSTALL_CLASP
goto VERIFY_CLASP

:INSTALL_CLASP
call :Log "CLASP_STATUS=INSTALL_REQUIRED"
call npm.cmd install -g @google/clasp@latest
if errorlevel 1 (
  call :Log "CLASP_INSTALL=FAILED_NPM_INSTALL"
  exit /b 1
)
call :RefreshPath

:VERIFY_CLASP
where clasp.cmd >nul 2>nul
if errorlevel 1 (
  call :Log "CLASP_STATUS=FAILED_NOT_FOUND"
  exit /b 1
)
for /f "usebackq delims=" %%V in (`clasp.cmd --version`) do set "CLASP_VERSION=%%V"
call clasp.cmd --user "%CLASP_PROFILE%" show-authorized-user --help >nul 2>nul
if errorlevel 1 (
  call :Log "CLASP_HELP_SHOW_AUTH=FAILED"
  exit /b 1
)
call clasp.cmd --user "%CLASP_PROFILE%" login --help >nul 2>nul
if errorlevel 1 (
  call :Log "CLASP_HELP_LOGIN=FAILED"
  exit /b 1
)
call clasp.cmd --user "%CLASP_PROFILE%" logout --help >nul 2>nul
if errorlevel 1 (
  call :Log "CLASP_HELP_LOGOUT=FAILED"
  exit /b 1
)
call clasp.cmd --user "%CLASP_PROFILE%" pull --help >nul 2>nul
if errorlevel 1 (
  call :Log "CLASP_HELP_PULL=FAILED"
  exit /b 1
)
call :Log "CLASP_STATUS=OK"
call :Log "CLASP_VERSION=%CLASP_VERSION%"
exit /b 0

:CheckAuthorizedEmail
set "AUTHORIZED_EMAIL="
set "AUTH_JSON=%TEMP%\clasp_auth_%RANDOM%_%RANDOM%.json"
set "AUTH_ERR=%TEMP%\clasp_auth_%RANDOM%_%RANDOM%.err"
call clasp.cmd --user "%CLASP_PROFILE%" --json show-authorized-user > "%AUTH_JSON%" 2> "%AUTH_ERR%"
set "SHOW_AUTH_EXIT=%ERRORLEVEL%"
if not "%SHOW_AUTH_EXIT%"=="0" (
  del "%AUTH_JSON%" >nul 2>nul
  del "%AUTH_ERR%" >nul 2>nul
  exit /b 1
)
set "AUTH_JSON_FILE=%AUTH_JSON%"
for /f "usebackq delims=" %%E in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $j = Get-Content -Raw -LiteralPath $env:AUTH_JSON_FILE | ConvertFrom-Json; if (($j.loggedIn -eq $true) -and $j.email) { [string]$j.email } } catch { '' }"`) do set "AUTHORIZED_EMAIL=%%E"
del "%AUTH_JSON%" >nul 2>nul
del "%AUTH_ERR%" >nul 2>nul
if "%AUTHORIZED_EMAIL%"=="" (
  call :CheckAuthorizedEmailViaUserInfo
  if errorlevel 1 exit /b 1
)
exit /b 0

:CheckAuthorizedEmailViaUserInfo
set "AUTHORIZED_EMAIL="
set "PROFILE_ENV=%CLASP_PROFILE%"
set "AUTH_EMAIL_FILE=%TEMP%\clasp_userinfo_%RANDOM%_%RANDOM%.txt"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $p = Join-Path $env:USERPROFILE '.clasprc.json'; $j = Get-Content -Raw -LiteralPath $p | ConvertFrom-Json; $profile = $env:PROFILE_ENV; $entry = $j.tokens.PSObject.Properties[$profile]; if (-not $entry) { exit 2 }; $token = [string]$entry.Value.access_token; if ([string]::IsNullOrWhiteSpace($token)) { exit 3 }; $u = Invoke-RestMethod -Method Get -Uri 'https://openidconnect.googleapis.com/v1/userinfo' -Headers @{ Authorization = ('Bearer ' + $token) } -TimeoutSec 20; if ($u.email) { [string]$u.email; exit 0 } else { exit 4 } } catch { exit 5 }" > "%AUTH_EMAIL_FILE%"
if errorlevel 1 (
  del "%AUTH_EMAIL_FILE%" >nul 2>nul
  exit /b 1
)
for /f "usebackq delims=" %%E in ("%AUTH_EMAIL_FILE%") do set "AUTHORIZED_EMAIL=%%E"
del "%AUTH_EMAIL_FILE%" >nul 2>nul
if "%AUTHORIZED_EMAIL%"=="" exit /b 1
call :Log "AUTHORIZED_EMAIL_SOURCE=GOOGLE_USERINFO"
exit /b 0

:LoginAndRecheck
echo Mo trinh duyet OAuth. Hay chon dung tai khoan: %GOOGLE_ACCOUNT%
call :Log "LOGIN_REQUIRED_FOR_PROFILE=%CLASP_PROFILE%"
call clasp.cmd --user "%CLASP_PROFILE%" login
if errorlevel 1 (
  call :Log "CLASP_LOGIN=FAILED"
  exit /b 1
)
call :CheckAuthorizedEmail
if errorlevel 1 (
  call :Log "CLASP_LOGIN_RECHECK=FAILED"
  exit /b 1
)
exit /b 0

:LogoutProfile
call :Log "LOGOUT_PROFILE=%CLASP_PROFILE%"
call clasp.cmd --user "%CLASP_PROFILE%" logout
if errorlevel 1 (
  call :Log "CLASP_LOGOUT=FAILED"
  exit /b 1
)
exit /b 0

:EnsureAuthorizedAccount
call :CheckAuthorizedEmail
if errorlevel 1 (
  call :LoginAndRecheck
  if errorlevel 1 exit /b 1
)
if /i "%AUTHORIZED_EMAIL%"=="%GOOGLE_ACCOUNT%" exit /b 0

echo Tai khoan hien tai: %AUTHORIZED_EMAIL%
echo Tai khoan bat buoc: %GOOGLE_ACCOUNT%
call :Log "AUTHORIZED_EMAIL_WRONG=%AUTHORIZED_EMAIL%"
call :LogoutProfile
if errorlevel 1 exit /b 1
call :LoginAndRecheck
if errorlevel 1 exit /b 1
if /i "%AUTHORIZED_EMAIL%"=="%GOOGLE_ACCOUNT%" exit /b 0
call :Log "AUTHORIZED_EMAIL_STILL_WRONG=%AUTHORIZED_EMAIL%"
exit /b 1

:WriteClaspJson
set "CLASP_JSON_PATH=%CD%\.clasp.json"
set "CLASP_JSON_PATH_ENV=%CLASP_JSON_PATH%"
set "SCRIPT_ID_ENV=%SCRIPT_ID%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$obj = [ordered]@{ scriptId = $env:SCRIPT_ID_ENV; rootDir = '.' }; $json = $obj | ConvertTo-Json; Set-Content -LiteralPath $env:CLASP_JSON_PATH_ENV -Value $json -Encoding UTF8"
if errorlevel 1 exit /b 1
exit /b 0

:ValidateClaspJson
set "CLASP_JSON_PATH=%CD%\.clasp.json"
set "CLASP_JSON_PATH_ENV=%CLASP_JSON_PATH%"
set "SCRIPT_ID_ENV=%SCRIPT_ID%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $j = Get-Content -Raw -LiteralPath $env:CLASP_JSON_PATH_ENV | ConvertFrom-Json; if ([string]$j.scriptId -ceq $env:SCRIPT_ID_ENV) { exit 0 } else { exit 2 } } catch { exit 3 }"
if errorlevel 1 exit /b 1
exit /b 0

:EnsureClaspJson
if not exist ".clasp.json" (
  call :WriteClaspJson
  if errorlevel 1 exit /b 1
  call :ValidateClaspJson
  if errorlevel 1 exit /b 1
  exit /b 0
)

call :ValidateClaspJson
if not errorlevel 1 exit /b 0

if not exist "_clasp_config_backup\" (
  mkdir "_clasp_config_backup"
  if errorlevel 1 exit /b 1
)
for /f "usebackq delims=" %%T in (`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyyMMdd_HHmmss"`) do set "TS=%%T"
copy /y ".clasp.json" "_clasp_config_backup\.clasp.json.%TS%.bak" >nul
if errorlevel 1 exit /b 1
call :Log "CLASP_JSON_BACKUP=_clasp_config_backup\.clasp.json.%TS%.bak"
call :WriteClaspJson
if errorlevel 1 exit /b 1
call :ValidateClaspJson
if errorlevel 1 exit /b 1
exit /b 0

:BackupLocalCode
set "BACKUP_RESULT=%TEMP%\clasp_backup_%RANDOM%_%RANDOM%.txt"
set "TARGET_DIR_ENV=%CD%"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root = (Resolve-Path -LiteralPath $env:TARGET_DIR_ENV).Path; $backupRoot = Join-Path $root '_backup_before_pull'; $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'; $destRoot = Join-Path $backupRoot $stamp; $files = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { ($_.Name -eq 'appsscript.json' -or $_.Extension -in '.gs','.js','.html') -and $_.FullName -notmatch '\\_(backup_before_pull|clasp_config_backup)\\' -and $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' }; if (-not $files) { 'NO_FILES_TO_BACKUP'; exit 0 }; New-Item -ItemType Directory -Path $destRoot -Force | Out-Null; foreach ($f in $files) { $rel = $f.FullName.Substring($root.Length).TrimStart('\'); $dst = Join-Path $destRoot $rel; New-Item -ItemType Directory -Path (Split-Path -Parent $dst) -Force | Out-Null; Copy-Item -LiteralPath $f.FullName -Destination $dst -Force }; 'BACKUP_CREATED=' + $destRoot" > "%BACKUP_RESULT%"
if errorlevel 1 (
  del "%BACKUP_RESULT%" >nul 2>nul
  exit /b 1
)
for /f "usebackq delims=" %%B in ("%BACKUP_RESULT%") do set "BACKUP_STATUS=%%B"
del "%BACKUP_RESULT%" >nul 2>nul
if "%BACKUP_STATUS%"=="" set "BACKUP_STATUS=UNKNOWN"
exit /b 0

:PostPullValidation
call :ValidateClaspJson
if errorlevel 1 (
  call :Log "POST_CHECK_CLASP_JSON=FAILED"
  exit /b 1
)
if not exist "appsscript.json" (
  call :Log "POST_CHECK_APPSSCRIPT_JSON=FAILED_NOT_FOUND"
  exit /b 1
)
for %%F in ("appsscript.json") do set "APPSSCRIPT_SIZE=%%~zF"
if "%APPSSCRIPT_SIZE%"=="0" (
  call :Log "POST_CHECK_APPSSCRIPT_JSON=FAILED_EMPTY"
  exit /b 1
)

set "CODE_COUNT_FILE=%TEMP%\clasp_code_count_%RANDOM%_%RANDOM%.txt"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root = (Resolve-Path -LiteralPath '.').Path; $files = Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.Extension -in '.gs','.js','.html' -and $_.FullName -notmatch '\\_(backup_before_pull|clasp_config_backup)\\' -and $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' }; $files.Count" > "%CODE_COUNT_FILE%"
if errorlevel 1 (
  del "%CODE_COUNT_FILE%" >nul 2>nul
  call :Log "POST_CHECK_CODE_FILES=FAILED_SCAN"
  exit /b 1
)
for /f "usebackq delims=" %%C in ("%CODE_COUNT_FILE%") do set "CODE_FILE_COUNT=%%C"
del "%CODE_COUNT_FILE%" >nul 2>nul
if "%CODE_FILE_COUNT%"=="" set "CODE_FILE_COUNT=0"
if "%CODE_FILE_COUNT%"=="0" (
  call :Log "POST_CHECK_CODE_FILES=FAILED_NONE"
  exit /b 1
)
call :Log "CODE_FILE_COUNT=%CODE_FILE_COUNT%"

set "FILE_LIST=%TEMP%\clasp_file_list_%RANDOM%_%RANDOM%.txt"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root = (Resolve-Path -LiteralPath '.').Path; Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { ($_.Name -eq 'appsscript.json' -or $_.Extension -in '.gs','.js','.html') -and $_.FullName -notmatch '\\_(backup_before_pull|clasp_config_backup)\\' -and $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' } | ForEach-Object { $_.FullName.Substring($root.Length).TrimStart('\') } | Sort-Object" > "%FILE_LIST%"
if errorlevel 1 (
  del "%FILE_LIST%" >nul 2>nul
  call :Log "POST_CHECK_FILE_LIST=FAILED"
  exit /b 1
)
call :Log "FILES_AFTER_PULL_BEGIN"
type "%FILE_LIST%" >> "%LOG_FILE%"
call :Log "FILES_AFTER_PULL_END"
del "%FILE_LIST%" >nul 2>nul

call :CheckAuthorizedEmail
if errorlevel 1 (
  call :Log "POST_CHECK_AUTHORIZED_EMAIL=FAILED"
  exit /b 1
)
if /i not "%AUTHORIZED_EMAIL%"=="%GOOGLE_ACCOUNT%" (
  call :Log "POST_CHECK_AUTHORIZED_EMAIL=FAILED_WRONG_%AUTHORIZED_EMAIL%"
  exit /b 1
)
call :Log "POST_CHECK_AUTHORIZED_EMAIL=OK_%AUTHORIZED_EMAIL%"
exit /b 0
