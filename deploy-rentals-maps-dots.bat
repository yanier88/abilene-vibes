@echo off
title Rentals - Maps + Dots Deploy
cd /d "C:\Users\cabre\abilene-vibes"
echo === Rentals Maps+Dots Deploy === > deploy-rentals-maps-dots.log
echo Started: %date% %time% >> deploy-rentals-maps-dots.log

:: ── 0. ADB check ────────────────────────────────────────────
echo. >> deploy-rentals-maps-dots.log
echo --- adb devices --- >> deploy-rentals-maps-dots.log
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices >> deploy-rentals-maps-dots.log 2>&1

:: ── 1. Clean dist and APK ───────────────────────────────────
echo. >> deploy-rentals-maps-dots.log
echo --- Cleaning --- >> deploy-rentals-maps-dots.log
if exist "dist" rmdir /s /q "dist" >> deploy-rentals-maps-dots.log 2>&1
if exist "android\app\build\outputs" rmdir /s /q "android\app\build\outputs" >> deploy-rentals-maps-dots.log 2>&1

:: ── 2. npm run build ────────────────────────────────────────
echo. >> deploy-rentals-maps-dots.log
echo --- npm run build --- >> deploy-rentals-maps-dots.log
call npm run build >> deploy-rentals-maps-dots.log 2>&1
if %ERRORLEVEL% neq 0 (echo BUILD FAILED >> deploy-rentals-maps-dots.log & type deploy-rentals-maps-dots.log & pause & exit /b 1)
echo Build OK. >> deploy-rentals-maps-dots.log

:: ── 3. Git commit + push (web) ──────────────────────────────
echo. >> deploy-rentals-maps-dots.log
echo --- git commit + push --- >> deploy-rentals-maps-dots.log
if exist ".git\index.lock" del /f /q ".git\index.lock"
git update-index --really-refresh >> deploy-rentals-maps-dots.log 2>&1
git add src/App.jsx src/App.css >> deploy-rentals-maps-dots.log 2>&1
git commit -m "fix: rental-detail clickable address + gallery dot indicators" >> deploy-rentals-maps-dots.log 2>&1
git push origin main >> deploy-rentals-maps-dots.log 2>&1
echo Git push OK. >> deploy-rentals-maps-dots.log

:: ── 4. cap sync android ─────────────────────────────────────
echo. >> deploy-rentals-maps-dots.log
echo --- cap sync android --- >> deploy-rentals-maps-dots.log
call npx cap sync android >> deploy-rentals-maps-dots.log 2>&1
if %ERRORLEVEL% neq 0 (echo CAP SYNC FAILED >> deploy-rentals-maps-dots.log & type deploy-rentals-maps-dots.log & pause & exit /b 1)
echo Cap sync OK. >> deploy-rentals-maps-dots.log

:: ── 5. Gradle assembleDebug ─────────────────────────────────
echo. >> deploy-rentals-maps-dots.log
echo --- gradlew assembleDebug --- >> deploy-rentals-maps-dots.log
cd android
call gradlew.bat assembleDebug >> ..\deploy-rentals-maps-dots.log 2>&1
set GRADLE_ERR=%ERRORLEVEL%
cd ..
if %GRADLE_ERR% neq 0 (echo GRADLE FAILED >> deploy-rentals-maps-dots.log & type deploy-rentals-maps-dots.log & pause & exit /b 1)
echo Gradle OK. >> deploy-rentals-maps-dots.log

:: ── 6. adb install ──────────────────────────────────────────
echo. >> deploy-rentals-maps-dots.log
echo --- adb install --- >> deploy-rentals-maps-dots.log
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r "android\app\build\outputs\apk\debug\app-debug.apk" >> deploy-rentals-maps-dots.log 2>&1
echo ADB exit: %ERRORLEVEL% >> deploy-rentals-maps-dots.log
if %ERRORLEVEL% neq 0 (echo ADB FAILED >> deploy-rentals-maps-dots.log & type deploy-rentals-maps-dots.log & pause & exit /b 1)

:: ── 7. Launch app ───────────────────────────────────────────
echo. >> deploy-rentals-maps-dots.log
echo --- Launching --- >> deploy-rentals-maps-dots.log
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" shell am start -n com.abilenevibes.app/.MainActivity >> deploy-rentals-maps-dots.log 2>&1

echo. >> deploy-rentals-maps-dots.log
echo Finished: %date% %time% >> deploy-rentals-maps-dots.log
echo === DONE === >> deploy-rentals-maps-dots.log

type deploy-rentals-maps-dots.log
echo.
echo ======================================================
echo  DONE - APK instalado, web desplegado
echo ======================================================
pause
