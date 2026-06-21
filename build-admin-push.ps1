$log = "C:\Users\cabre\abilene-vibes\build-admin-push.log"
$repo = "C:\Users\cabre\abilene-vibes"

"=== Build Admin + Push started: $(Get-Date) ===" | Out-File $log -Encoding utf8

Set-Location $repo

# Build admin
"=== Running npm run build:admin... ===" | Add-Content $log -Encoding utf8
$b = & npm run build:admin 2>&1
"build output: $b" | Add-Content $log -Encoding utf8

# Check dist-admin was created
$bundleCheck = Get-ChildItem "$repo\dist-admin\assets\*.js" -ErrorAction SilentlyContinue | Select-Object -First 1
"bundle found: $($bundleCheck.Name)" | Add-Content $log -Encoding utf8

if (-not $bundleCheck) {
    "ERROR: dist-admin build failed - no JS bundle found" | Add-Content $log -Encoding utf8
    exit 1
}

# Kill stale git processes
Get-Process | Where-Object {$_.Name -like '*git*'} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Remove lock if present
Remove-Item "$repo\.git\index.lock" -Force -ErrorAction SilentlyContinue

# Stage dist-admin
$a = & git add dist-admin/ 2>&1
"git add dist-admin: $a" | Add-Content $log -Encoding utf8

# Check what's staged
$s = & git status --short 2>&1
"git status: $s" | Add-Content $log -Encoding utf8

# Commit
$c = & git commit -m "build: rebuild dist-admin with jobs edit fix" 2>&1
"git commit: $c" | Add-Content $log -Encoding utf8

# Push
$p = & git push origin main 2>&1
"git push: $p" | Add-Content $log -Encoding utf8

# Hash
$h = & git log --oneline -1 2>&1
"commit hash: $h" | Add-Content $log -Encoding utf8

"=== DONE: $(Get-Date) ===" | Add-Content $log -Encoding utf8
