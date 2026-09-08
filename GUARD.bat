@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul

set "GUARD_DIR=%~dp0_guard"
set "GUARD_ENGINE=%GUARD_DIR%\PROJECT_GUARD_ENGINE.bat"
set "CANONICAL_GUARD_CONFIG=%GUARD_DIR%\PROJECT_GUARD.config.bat"

if not exist "%GUARD_ENGINE%" (
  echo BLOCKED_LOCAL_GUARD_ENGINE_MISSING: %GUARD_ENGINE%
  exit /b 1
)

if not exist "%CANONICAL_GUARD_CONFIG%" (
  echo BLOCKED_LOCAL_GUARD_CONFIG_MISSING: %CANONICAL_GUARD_CONFIG%
  exit /b 1
)

call "%GUARD_ENGINE%" "%CANONICAL_GUARD_CONFIG%" %*
set "RC=%ERRORLEVEL%"
exit /b %RC%
