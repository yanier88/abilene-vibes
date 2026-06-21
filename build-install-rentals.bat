@echo off
title Abilene Vibes - Build & Install (Rentals)
cd /d "C:\Users\cabre\abilene-vibes"
echo === Abilene Vibes Build & Install === > build-install-rentals.log
echo Started: %date% %time% >> build-install-rentals.log

:: ── 0. Verify ADB device ───────────────────────────────────────────
echo. >> build-install-rentals.log
echo --- adb devices --- >> build-install-rentals.log
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices >> build-install-rentals.log 2>&1

:: ── 1. Clean old dist and APK outputs ────────────────────────────
echo. >> build-install-rentals.log
echo --- Cleaning old artifacts --- >> build-install-rentals.log
if exist "dist" rmdir /s /q "dist" >> build-install-rentals.log 2>&1
if exist "android\app\build\outputs" rmdir /s /q "android\app\build\outputs" >> build-install-rentals.log 2>&1
echo Cleaned. >> build-install-rentals.log

:: ── 2. npm run build ─────────────────────────────────────────────
echo. >> build-install-rentals.log
echo --- npm run build --- >> build-install-rentals.log
call npm run build >> build-install-rentals.log 2>&1
if %ERRORLEVEL% neq 0 (
  echo BUILD FAILED [exit %ERRORLEVEL%] >> build-install-rentals.log
  type build-install-rentals.log
  echo.
  echo *** BUILD FAILED - see build-install-rentals.log ***
  pause & exit /b 1
)
echo Build OK. >> build-install-rentals.log

:: ── 3. cap sync android ─────────────────────────────────────────
echo. >> build-install-rentals.log
echo --- npx cap sync android --- >> build-install-rentals.log
call npx cap sync android >> build-install-rentals.log 2>&1
if %ERRORLEVEL% neq 0 (
  echo CAP SYNC FAILED [exit %ERRORLEVEL%] >> build-install-rentals.log
  type build-install-rentals.log
  echo.
  echo *** CAP SYNC FAILED ***
  pause & exit /b 1
)
echo Cap sync OK. >> build-install-rentals.log

:: ── 4. Gradle assembleDebug ─────────────────────────────────────
echo. >> build-install-rentals.log
echo --- gradlew assembleDebug --- >> build-install-rentals.log
cd android
call gradlew.bat assembleDebug >> ..\build-install-rentals.log 2>&1
set GRADLE_ERR=%ERRORLEVEL%
cd ..
if %GRADLE_ERR% neq 0 (
  echo GRADLE FAILED [exit %GRADLE_ERR%] >> build-install-rentals.log
  type build-install-rentals.log
  echo.
  echo *** GRADLE FAILED ***
  pause & exit /b 1
)
echo Gradle OK. >> build-install-rentals.log

:: ── 5. adb install ──────────────────────────────────────────────
echo. >> build-install-rentals.log
echo --- adb install -r --- >> build-install-rentals.log
set APK=android\app\build\outputs\apk\debug\app-debug.apk
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r "%APK%" >> build-install-rentals.log 2>&1
set ADB_ERR=%ERRORLEVEL%
echo ADB exit code: %ADB_ERR% >> build-install-rentals.log
if %ADB_ERR% neq 0 (
  echo ADB INSTALL FAILED >> build-install-rentals.log
  type build-install-rentals.log
  echo.
  echo *** ADB INSTALL FAILED ***
  pause & exit /b 1
)
echo ADB install OK. >> build-install-rentals.log

:: ── 6. Launch the app ───────────────────────────────────────────
echo. >> build-install-rentals.log
echo --- Launching app --- >> build-install-rentals.log
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" shell am start -n com.abilenevibes.app/.MainActivity >> build-install-rentals.log 2>&1
echo Launch exit code: %ERRORLEVEL% >> build-install-rentals.log

echo. >> build-install-rentals.log
echo Finished: %date% %time% >> build-install-rentals.log
echo === DONE === >> build-install-rentals.log

:: ── Print log to screen ─────────────────────────────────────────
echo.
type build-install-rentals.log
echo.
echo =====================================================
echo  DONE - APK instalado y app lanzada
echo =====================================================
pause
