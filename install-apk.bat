@echo off
title Install APK on phone
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
if not exist "%ADB%" (
  echo adb not found at: %ADB%
  echo Looking for adb...
  where adb 2>nul
  pause
  exit /b 1
)
echo === Checking adb devices ===
"%ADB%" devices
echo.
echo === Installing APK ===
"%ADB%" install -r "C:\Users\cabre\abilene-vibes\android\app\build\outputs\apk\debug\app-debug.apk"
if %ERRORLEVEL% neq 0 (
  echo INSTALL FAILED - check phone is connected and USB debugging is on
  pause
  exit /b 1
)
echo.
echo === APK INSTALADA EN EL TELEFONO ===
pause
