@echo off
title Refresh Data Dashboard Qoala
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0refresh.ps1" %*
echo.
pause
