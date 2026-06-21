@echo off
title Full Build - Jobs Auto-Refresh
cd /d C:\Users\cabre\abilene-vibes

set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe

echo.
echo ============================================
echo  STEP 1: npm run build
echo ============================================
call npm run build
if %ERRORLEVEL% neq 0 ( echo BUILD FAILED & pause & exit /b 1 )

echo.
echo ============================================
echo  STEP 2: cap sync android
echo ============================================
call npx cap sync android
if %ERRORLEVEL% neq 0 ( echo CAP SYNC FAILED & pause & exit /b 1 )

echo.
echo ============================================
echo  STEP 3: gradlew assembleDebug
echo ============================================
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 ( echo GRADLE BUILD FAILED & pause & exit /b 1 )
cd ..

echo.
echo ============================================
echo  STEP 4: adb install APK
echo ============================================
echo Using adb at: %ADB%
"%ADB%" install -r android\app\build\outputs\apk\debug\app-debug.apk
if %ERRORLEVEL% neq 0 ( echo ADB INSTALL FAILED & pause & exit /b 1 )

echo.
echo ============================================
echo  DONE - APK instalado. Prueba Jobs refresh.
echo ============================================
pause
