@echo off
setlocal
call "%~dp0apps\studio\launch-studio.cmd" %*
exit /b %errorlevel%