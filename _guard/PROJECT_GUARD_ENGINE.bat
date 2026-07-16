@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

set "GUARD_CONFIG=%~1"
set "ACTION=%~2"
if "%GUARD_CONFIG%"=="" (
  echo BLOCKED_GUARD_CONFIG_ARGUMENT_MISSING
  exit /b 1
)
if not exist "%GUARD_CONFIG%" (
  echo BLOCKED_GUARD_CONFIG_MISSING: %GUARD_CONFIG%
  exit /b 1
)

call "%GUARD_CONFIG%"
if errorlevel 1 (
  echo BLOCKED_GUARD_CONFIG_LOAD_FAILED
  exit /b 1
)

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
  exit /b %ERRORLEVEL%
) else if /I "%ACTION%"=="status" (
  call :Status
  exit /b %ERRORLEVEL%
) else if /I "%ACTION%"=="pull" (
  call :Pull
  exit /b %ERRORLEVEL%
) else if /I "%ACTION%"=="push" (
  call :Push
  exit /b %ERRORLEVEL%
) else if /I "%ACTION%"=="deploy" (
  call :Deploy
  exit /b %ERRORLEVEL%
)

echo BLOCKED_UNKNOWN_ACTION: %ACTION%
call :Help
exit /b 1

:Help
echo Usage: GUARD.bat status^|doctor^|pull^|push^|deploy^|help
echo.
echo status  - read-only repository and project status
echo doctor  - read-only guard/config validation
echo pull    - guarded ff-only pull
echo push    - guarded push with confirmation
echo deploy  - guarded deploy according to local config
exit /b 0

:ValidateConfig
if not "%GUARD_CONFIG_VERSION%"=="2" (
  echo BLOCKED_GUARD_CONFIG_VERSION_INVALID: %GUARD_CONFIG_VERSION%
  exit /b 1
)
for %%V in (PROJECT_KEY PROJECT_NAME PROJECT_ROOT EXPECTED_BRANCH GITHUB_SSH_ALIAS GITHUB_ACCOUNT GITHUB_REPO GIT_USER_NAME GIT_USER_EMAIL DEPLOY_MODE PROJECT_STATUS_HOOK) do (
  if not defined %%V (
    echo BLOCKED_REQUIRED_CONFIG_VALUE_MISSING: %%V
    exit /b 1
  )
)
exit /b 0

:EnterRepo
if not exist "%PROJECT_ROOT%\" (
  echo BLOCKED_PROJECT_ROOT_MISSING: %PROJECT_ROOT%
  exit /b 1
)
pushd "%PROJECT_ROOT%" >nul || (
  echo BLOCKED_PROJECT_ROOT_CD_FAILED: %PROJECT_ROOT%
  exit /b 1
)
git rev-parse --is-inside-work-tree >nul 2>&1 || (
  echo BLOCKED_NOT_A_GIT_REPO: %PROJECT_ROOT%
  popd >nul
  exit /b 1
)
for /f "delims=" %%R in ('git rev-parse --show-toplevel') do set "ACTUAL_ROOT=%%R"
set "ACTUAL_ROOT_NORM=%ACTUAL_ROOT:/=\%"
set "PROJECT_ROOT_NORM=%PROJECT_ROOT:/=\%"
if /I not "%ACTUAL_ROOT_NORM%"=="%PROJECT_ROOT_NORM%" (
  echo BLOCKED_PROJECT_ROOT_MISMATCH: current=%ACTUAL_ROOT% expected=%PROJECT_ROOT%
  popd >nul
  exit /b 1
)
exit /b 0

:VerifyBranch
set "CURRENT_BRANCH="
for /f "delims=" %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if /I not "%CURRENT_BRANCH%"=="%EXPECTED_BRANCH%" (
  echo BLOCKED_WRONG_BRANCH: current=%CURRENT_BRANCH% expected=%EXPECTED_BRANCH%
  exit /b 1
)
echo Branch confirmed: %CURRENT_BRANCH%
exit /b 0

:VerifyRemote
set "EXPECTED_REMOTE=git@%GITHUB_SSH_ALIAS%:%GITHUB_REPO%.git"
set "CURRENT_REMOTE="
for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "CURRENT_REMOTE=%%R"
if "%CURRENT_REMOTE%"=="" (
  echo BLOCKED_REMOTE_ORIGIN_MISSING
  exit /b 1
)
if /I not "%CURRENT_REMOTE%"=="%EXPECTED_REMOTE%" (
  echo BLOCKED_REMOTE_ORIGIN_MISMATCH: current=%CURRENT_REMOTE% expected=%EXPECTED_REMOTE%
  exit /b 1
)
echo Remote confirmed: %CURRENT_REMOTE%
exit /b 0

:VerifyGitIdentity
set "CURRENT_GIT_NAME="
set "CURRENT_GIT_EMAIL="
for /f "delims=" %%N in ('git config user.name 2^>nul') do set "CURRENT_GIT_NAME=%%N"
for /f "delims=" %%E in ('git config user.email 2^>nul') do set "CURRENT_GIT_EMAIL=%%E"
if /I not "%CURRENT_GIT_NAME%"=="%GIT_USER_NAME%" (
  echo BLOCKED_GIT_USER_NAME_MISMATCH: current=%CURRENT_GIT_NAME% expected=%GIT_USER_NAME%
  exit /b 1
)
if /I not "%CURRENT_GIT_EMAIL%"=="%GIT_USER_EMAIL%" (
  echo BLOCKED_GIT_USER_EMAIL_MISMATCH: current=%CURRENT_GIT_EMAIL% expected=%GIT_USER_EMAIL%
  exit /b 1
)
echo Git identity confirmed: %CURRENT_GIT_NAME% ^<%CURRENT_GIT_EMAIL%^>
exit /b 0

:VerifySshAlias
set "SSH_G_FILE=%TEMP%\repo_guard_ssh_g_%RANDOM%%RANDOM%.txt"
ssh -G git@%GITHUB_SSH_ALIAS% > "%SSH_G_FILE%" 2>&1
if errorlevel 1 (
  type "%SSH_G_FILE%"
  del "%SSH_G_FILE%" >nul 2>&1
  echo BLOCKED_SSH_ALIAS_CONFIG_FAILED: %GITHUB_SSH_ALIAS%
  exit /b 1
)
findstr /I /C:"hostname github.com" "%SSH_G_FILE%" >nul
if errorlevel 1 (
  type "%SSH_G_FILE%"
  del "%SSH_G_FILE%" >nul 2>&1
  echo BLOCKED_SSH_ALIAS_NOT_GITHUB: %GITHUB_SSH_ALIAS%
  exit /b 1
)
del "%SSH_G_FILE%" >nul 2>&1
echo SSH alias confirmed: %GITHUB_SSH_ALIAS%

set "SSH_OUT_FILE=%TEMP%\repo_guard_ssh_t_%RANDOM%%RANDOM%.txt"
ssh -o BatchMode=yes -o ConnectTimeout=20 -T git@%GITHUB_SSH_ALIAS% > "%SSH_OUT_FILE%" 2>&1
type "%SSH_OUT_FILE%"
findstr /I /C:"%GITHUB_ACCOUNT%" "%SSH_OUT_FILE%" >nul
if errorlevel 1 (
  del "%SSH_OUT_FILE%" >nul 2>&1
  echo BLOCKED_GITHUB_ACCOUNT_NOT_CONFIRMED: expected=%GITHUB_ACCOUNT%
  exit /b 1
)
del "%SSH_OUT_FILE%" >nul 2>&1
echo GitHub account confirmed: %GITHUB_ACCOUNT%
exit /b 0

:FetchAndCount
set "LOCAL_AHEAD="
set "REMOTE_AHEAD="
git fetch origin --prune
if errorlevel 1 (
  echo BLOCKED_GIT_FETCH_FAILED
  exit /b 1
)
git show-ref --verify --quiet "refs/remotes/origin/%EXPECTED_BRANCH%"
if errorlevel 1 (
  echo BLOCKED_REMOTE_BRANCH_MISSING: origin/%EXPECTED_BRANCH%
  exit /b 1
)
for /f "tokens=1,2" %%A in ('git rev-list --left-right --count HEAD...origin/%EXPECTED_BRANCH%') do (
  set "LOCAL_AHEAD=%%A"
  set "REMOTE_AHEAD=%%B"
)
if "%LOCAL_AHEAD%"=="" set "LOCAL_AHEAD=0"
if "%REMOTE_AHEAD%"=="" set "REMOTE_AHEAD=0"
echo Local ahead: %LOCAL_AHEAD%
echo Remote ahead: %REMOTE_AHEAD%
exit /b 0

:RunHook
if exist "%PROJECT_STATUS_HOOK%" (
  call "%PROJECT_STATUS_HOOK%"
  if errorlevel 1 exit /b %ERRORLEVEL%
)
exit /b 0

:CommonReadOnlyChecks
call :EnterRepo
if errorlevel 1 exit /b 1
echo.
echo === PROJECT GUARD V2: %PROJECT_NAME% / %ACTION% ===
call :VerifyBranch
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifyRemote
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifyGitIdentity
if errorlevel 1 (popd >nul & exit /b 1)
call :VerifySshAlias
if errorlevel 1 (popd >nul & exit /b 1)
exit /b 0

:Doctor
set "ACTION=doctor"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
echo.
echo Config file: %GUARD_CONFIG%
echo Project root: %PROJECT_ROOT%
echo Deploy mode: %DEPLOY_MODE%
echo Status hook: %PROJECT_STATUS_HOOK%
call :FetchAndCount
if errorlevel 1 (popd >nul & exit /b 1)
call :RunHook
if errorlevel 1 (popd >nul & exit /b 1)
echo DOCTOR_PASS
popd >nul
exit /b 0

:Status
set "ACTION=status"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
echo.
echo Git status --short:
git status --short
echo.
echo Ahead/behind:
call :FetchAndCount
if errorlevel 1 (popd >nul & exit /b 1)
echo.
echo Recent commits:
git log --oneline -5
call :RunHook
if errorlevel 1 (popd >nul & exit /b 1)
echo STATUS_PASS
popd >nul
exit /b 0

:HasWorkingTreeChanges
for /f "delims=" %%S in ('git status --porcelain') do exit /b 0
exit /b 1

:HasStagedChanges
git diff --cached --quiet --exit-code
if errorlevel 1 exit /b 0
exit /b 1

:RequireConfirmation
choice /C YN /N /M "%~1 [Y/N]: "
if errorlevel 2 exit /b 1
exit /b 0

:Pull
set "ACTION=pull"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
call :FetchAndCount
if errorlevel 1 (popd >nul & exit /b 1)
call :HasWorkingTreeChanges
if not errorlevel 1 (
  echo BLOCKED_PULL_DIRTY_WORKING_TREE
  popd >nul
  exit /b 1
)
if not "%LOCAL_AHEAD%"=="0" if not "%REMOTE_AHEAD%"=="0" (
  echo BLOCKED_PULL_DIVERGED_MANUAL_REVIEW_REQUIRED
  popd >nul
  exit /b 1
)
git pull --ff-only origin "%EXPECTED_BRANCH%"
if errorlevel 1 (
  echo BLOCKED_PULL_FAST_FORWARD_FAILED
  popd >nul
  exit /b 1
)
popd >nul
exit /b 0

:Push
set "ACTION=push"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
call :FetchAndCount
if errorlevel 1 (popd >nul & exit /b 1)
call :HasStagedChanges
if not errorlevel 1 (
  echo BLOCKED_PUSH_STAGED_FILES_PRESENT
  popd >nul
  exit /b 1
)
if not "%REMOTE_AHEAD%"=="0" (
  echo BLOCKED_PUSH_REMOTE_AHEAD
  popd >nul
  exit /b 1
)
if "%LOCAL_AHEAD%"=="0" (
  echo PUSH_NOT_NEEDED_LOCAL_NOT_AHEAD
  popd >nul
  exit /b 0
)
echo.
echo Commits to push:
git log --oneline origin/%EXPECTED_BRANCH%..HEAD
call :HasWorkingTreeChanges
if not errorlevel 1 (
  echo WARNING_DIRTY_FILES_WILL_NOT_BE_PUSHED
  call :RequireConfirmation "Continue with push despite dirty unstaged/untracked files"
  if errorlevel 1 (
    echo BLOCKED_PUSH_DIRTY_WORKTREE_NOT_CONFIRMED
    popd >nul
    exit /b 1
  )
)
call :RequireConfirmation "Push to origin %EXPECTED_BRANCH%"
if errorlevel 1 (
  echo BLOCKED_PUSH_NOT_CONFIRMED
  popd >nul
  exit /b 1
)
git push origin "%EXPECTED_BRANCH%"
if errorlevel 1 (
  echo BLOCKED_GIT_PUSH_FAILED
  popd >nul
  exit /b 1
)
call :FetchAndCount
if not "%LOCAL_AHEAD%"=="0" (
  echo BLOCKED_PUSH_VERIFY_LOCAL_STILL_AHEAD
  popd >nul
  exit /b 1
)
echo PUSH_PASS_LOCAL_AHEAD_ZERO
popd >nul
exit /b 0

:Deploy
set "ACTION=deploy"
call :CommonReadOnlyChecks
if errorlevel 1 exit /b 1
if /I "%DEPLOY_MODE%"=="none" (
  echo BLOCKED_DEPLOY_NOT_CONFIGURED
  popd >nul
  exit /b 1
)
if /I "%DEPLOY_MODE%"=="cloudflare" (
  if "%DEPLOY_COMMAND%"=="" set "DEPLOY_COMMAND=npm.cmd run deploy"
  echo Deploy command: %DEPLOY_COMMAND%
  call :RequireConfirmation "Run deploy for %PROJECT_NAME%"
  if errorlevel 1 (
    echo BLOCKED_DEPLOY_NOT_CONFIRMED
    popd >nul
    exit /b 1
  )
  call %DEPLOY_COMMAND%
  exit /b %ERRORLEVEL%
)
if /I "%DEPLOY_MODE%"=="gas" (
  if "%CLASP_PROFILE%"=="" (
    echo BLOCKED_CLASP_PROFILE_MISSING
    popd >nul
    exit /b 1
  )
  if "%GAS_SCRIPT_ID%"=="" (
    echo BLOCKED_GAS_SCRIPT_ID_MISSING
    popd >nul
    exit /b 1
  )
  echo GAS deploy target: %GAS_SCRIPT_ID%
  echo clasp profile: %CLASP_PROFILE%
  call :RequireConfirmation "Run GAS push and deploy"
  if errorlevel 1 (
    echo BLOCKED_DEPLOY_NOT_CONFIRMED
    popd >nul
    exit /b 1
  )
  call clasp.cmd --user "%CLASP_PROFILE%" push --force
  if errorlevel 1 (
    echo BLOCKED_GAS_PUSH_FAILED
    popd >nul
    exit /b 1
  )
  call clasp.cmd --user "%CLASP_PROFILE%" deploy --description "Guard deploy"
  exit /b %ERRORLEVEL%
)
echo BLOCKED_UNKNOWN_DEPLOY_MODE: %DEPLOY_MODE%
popd >nul
exit /b 1
