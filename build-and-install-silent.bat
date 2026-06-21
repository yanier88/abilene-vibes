@echo off
cd /d C:\Users\cabre\abilene-vibes
echo === Building web assets... > install-log.txt
call npm run build >> install-log.txt 2>&1
if %ERRORLEVEL% neq 0 (echo BUILD FAILED >> install-log.txt & exit /b 1)
echo === Syncing Capacitor... >> install-log.txt
call npx cap sync android >> install-log.txt 2>&1
if %ERRORLEVEL% neq 0 (echo CAP SYNC FAILED >> install-log.txt & exit /b 1)
echo === Building debug APK... >> install-log.txt
cd android
call gradlew assembleDebug >> ..\install-log.txt 2>&1
if %ERRORLEVEL% neq 0 (echo GRADLE FAILED >> ..\install-log.txt & exit /b 1)
cd ..
echo === Installing APK... >> install-log.txt
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r "C:\Users\cabre\abilene-vibes\android\app\build\outputs\apk\debug\app-debug.apk" >> install-log.txt 2>&1
echo exit code: %ERRORLEVEL% >> install-log.txt
echo === DONE === >> install-log.txt
