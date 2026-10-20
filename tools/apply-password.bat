@echo off
rem Terapkan patch kata sandi (hasil Setting > Account > Ubah Kata Sandi) ke Master_user.xlsx
rem Cara pakai: drag file password-patch.json ke file .bat ini,
rem atau:  tools\apply-password.bat -Email nama@qoala.id -Password "sandiBaru"
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-password.ps1" %*
echo.
pause
