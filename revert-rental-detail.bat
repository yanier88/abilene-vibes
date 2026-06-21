@echo off
title Rentals - Revert + Rebuild
cd /d "C:\Users\cabre\abilene-vibes"
echo === Rentals Revert + Rebuild === > revert-rental-detail.log
echo Started: %date% %time% >> revert-rental-detail.log

:: ── 0. ADB check ────────────────────────────────────────────
echo. >> revert-rental-detail.log
echo --- adb devices --- >> revert-rental-detail.log
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices >> revert-rental-detail.log 2>&1

:: ── 1. Clean ─────────────────────────────────────────────────
echo. >> revert-rental-detail.log
echo --- Cleaning --- >> revert-rental-detail.log
if exist "dist" rmdir /s /q "dist" >> revert-rental-detail.log 2>&1
if exist "android\app\build\outputs" rmdir /s /q "android\app\build\outputs" >> revert-rental-detail.log 2>&1

:: ── 2. npm run build ─────────────────────────────────────────
echo. >> revert-rental-detail.log
echo --- npm run build --- >> revert-rental-detail.log
call npm run build >> revert-rental-detail.log 2>&1
if %ERRORLEVEL% neq 0 (echo BUILD FAILED >> revert-rental-detail.log & type revert-rental-detail.log & pause & exit /b 1)
echo Build OK. >> revert-rental-detail.log

:: ── 3. Git commit + push ─────────────────────────────────────
echo. >> revert-rental-detail.log
echo --- git commit + push --- >> revert-rental-detail.log
if exist ".git\index.lock" del /f /q ".git\index.lock"
git update-index --really-refresh >> revert-rental-detail.log 2>&1
git add src/App.jsx src/App.css >> revert-rental-detail.log 2>&1
git commit -m "feat: premium housing neon background for rentals + rental-detail pages" >> revert-rental-detail.log 2>&1
git push origin main >> revert-rental-detail.log 2>&1
echo Git push OK. >> revert-rental-detail.log

:: ── 4. cap sync android ──────────────────────────────────────
echo. >> revert-rental-detail.log
echo --- cap sync android --- >> revert-rental-detail.log
call npx cap sync android >> revert-rental-detail.log 2>&1
if %ERRORLEVEL% neq 0 (echo CAP SYNC FAILED >> revert-rental-detail.log & type revert-rental-detail.log & pause & exit /b 1)
echo Cap sync OK. >> revert-rental-detail.log

:: ── 5. Gradle assembleDebug ──────────────────────────────────
echo. >> revert-rental-detail.log
echo --- gradlew assembleDebug --- >> revert-rental-detail.log
cd android
call gradlew.bat assembleDebug >> ..\revert-rental-detail.log 2>&1
set GRADLE_ERR=%ERRORLEVEL%
cd ..
if %GRADLE_ERR% neq 0 (echo GRADLE FAILED >> revert-rental-detail.log & type revert-rental-detail.log & pause & exit /b 1)
echo Gradle OK. >> revert-rental-detail.log

:: ── 6. adb install ───────────────────────────────────────────
echo. >> revert-rental-detail.log
echo --- adb install --- >> revert-rental-detail.log
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r "android\app\build\outputs\apk\debug\app-debug.apk" >> revert-rental-detail.log 2>&1
echo ADB exit: %ERRORLEVEL% >> revert-rental-detail.log
if %ERRORLEVEL% neq 0 (echo ADB FAILED >> revert-rental-detail.log & type revert-rental-detail.log & pause & exit /b 1)

:: ── 7. Launch app ────────────────────────────────────────────
echo. >> revert-rental-detail.log
echo --- Launching --- >> revert-rental-detail.log
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" shell am start -n com.abilenevibes.app/.MainActivity >> revert-rental-detail.log 2>&1

echo. >> revert-rental-detail.log
echo Finished: %date% %time% >> revert-rental-detail.log
echo === DONE === >> revert-rental-detail.log

type revert-rental-detail.log
echo.
echo ======================================================
echo  DONE - rental-detail restaurado, APK instalado
echo ======================================================
pause
