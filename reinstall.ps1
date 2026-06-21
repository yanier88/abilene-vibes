$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$apk = "C:\Users\cabre\abilene-vibes\android\app\build\outputs\apk\debug\app-debug.apk"
$pkg = "com.abilenevibes.app"
$log = "C:\Users\cabre\abilene-vibes\reinstall-log.txt"

"=== PowerShell reinstall started: $(Get-Date) ===" | Out-File $log
& $adb shell am force-stop $pkg | Out-File $log -Append
"=== Uninstalling..." | Out-File $log -Append
& $adb uninstall $pkg | Out-File $log -Append
"=== Installing fresh APK..." | Out-File $log -Append
& $adb install $apk | Out-File $log -Append
"=== DONE: $(Get-Date) ===" | Out-File $log -Append
