@echo off
%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe install -r "C:\Users\cabre\abilene-vibes\android\app\build\outputs\apk\debug\app-debug.apk" > "C:\Users\cabre\abilene-vibes\install-log.txt" 2>&1
echo exit code: %ERRORLEVEL% >> "C:\Users\cabre\abilene-vibes\install-log.txt"
