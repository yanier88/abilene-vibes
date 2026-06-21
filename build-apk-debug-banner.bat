@echo off
title Build APK - DEBUG BANNER VERSION
cd /d C:\Users\cabre\abilene-vibes
echo === Building web assets (debug banner)...
call npm run build
if %ERRORLEVEL% neq 0 (echo BUILD FAILED & pause & exit /b 1)
echo === Syncing Capacitor...
call npx cap sync android
if %ERRORLEVEL% neq 0 (echo CAP SYNC FAILED & pause & exit /b 1)
echo === Building debug APK...
cd android
call gradlew assembleDebug
if %ERRORLEVEL% neq 0 (echo GRADLE FAILED & pause & exit /b 1)
echo.
echo === APK ready (DEBUG BANNER) ===
echo C:\Users\cabre\abilene-vibes\android\app\build\outputs\apk\debug\app-debug.apk
pause
