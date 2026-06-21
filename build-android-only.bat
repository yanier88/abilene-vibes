@echo off
title Android Build - Remove Admin Icon
cd /d C:\Users\cabre\abilene-vibes

echo.
echo ============================================
echo  STEP 1: cap sync android
echo ============================================
call npx cap sync android
if %ERRORLEVEL% neq 0 ( echo CAP SYNC FAILED & pause & exit /b 1 )

echo.
echo ============================================
echo  STEP 2: gradlew assembleDebug
echo ============================================
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% neq 0 ( echo GRADLE BUILD FAILED & pause & exit /b 1 )
cd ..

echo.
echo ============================================
echo  STEP 3: adb install APK
echo ============================================
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
if %ERRORLEVEL% neq 0 ( echo ADB INSTALL FAILED & pause & exit /b 1 )

echo.
echo ============================================
echo  DONE - APK instalado. Verifica que solo
echo  aparezca "Abilene Vibes" en el launcher.
echo ============================================
pause
