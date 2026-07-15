@echo off
chcp 65001 >nul
call "%~dp0..\PROJECT_GUARD.bat" tonkho %*
exit /b %ERRORLEVEL%
