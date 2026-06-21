@echo off
cd /d C:\Users\cabre\abilene-vibes
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set APK=C:\Users\cabre\abilene-vibes\android\app\build\outputs\apk\debug\app-debug.apk
set PKG=com.abilenevibes.app
echo === Force stopping app... > reinstall-log.txt
%ADB% shell am force-stop %PKG% >> reinstall-log.txt 2>&1
echo === Clearing app cache (service worker)... >> reinstall-log.txt
%ADB% shell pm clear-cache %PKG% >> reinstall-log.txt 2>&1
echo === Uninstalling old APK... >> reinstall-log.txt
%ADB% uninstall %PKG% >> reinstall-log.txt 2>&1
echo === Installing fresh APK... >> reinstall-log.txt
%ADB% install "%APK%" >> reinstall-log.txt 2>&1
echo exit code: %ERRORLEVEL% >> reinstall-log.txt
echo === DONE === >> reinstall-log.txt
