$log = "C:\Users\cabre\abilene-vibes\git-push.log"
$repo = "C:\Users\cabre\abilene-vibes"

"=== Git commit+push started: $(Get-Date) ===" | Out-File $log -Encoding utf8

# Kill stale git processes
Get-Process | Where-Object {$_.Name -like '*git*'} | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Remove lock and corrupted index
Remove-Item "$repo\.git\index.lock" -Force -ErrorAction SilentlyContinue
Remove-Item "$repo\.git\index" -Force -ErrorAction SilentlyContinue
"=== Removed lock/index ===" | Add-Content $log -Encoding utf8

Set-Location $repo

# Rebuild index from HEAD
$r = & git reset HEAD 2>&1
"git reset: $r" | Add-Content $log -Encoding utf8

# Check status
$s = & git status --short 2>&1
"git status: $s" | Add-Content $log -Encoding utf8

# Stage only App.jsx
$a = & git add src/App.jsx 2>&1
"git add: $a" | Add-Content $log -Encoding utf8

# Commit
$c = & git commit -m "fix: admin jobs edit - full-page screen, remove dark overlay modal" 2>&1
"git commit: $c" | Add-Content $log -Encoding utf8

# Push
$p = & git push origin main 2>&1
"git push: $p" | Add-Content $log -Encoding utf8

# Get commit hash
$h = & git log --oneline -1 2>&1
"commit hash: $h" | Add-Content $log -Encoding utf8

"=== DONE: $(Get-Date) ===" | Add-Content $log -Encoding utf8
