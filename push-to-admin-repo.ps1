$log = "C:\Users\cabre\abilene-vibes\push-admin-repo.log"
$src = "C:\Users\cabre\abilene-vibes\dist-admin"
$tmp = "C:\Users\cabre\AppData\Local\Temp\abilene-vibes-admin-deploy"

"=== Direct push to abilene-vibes-admin: $(Get-Date) ===" | Out-File $log -Encoding utf8

# Clone the admin repo
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
$cl = & git clone "https://github.com/yanier88/abilene-vibes-admin.git" $tmp 2>&1
"git clone: $cl" | Add-Content $log -Encoding utf8

if (-not (Test-Path $tmp)) {
    "ERROR: clone failed" | Add-Content $log -Encoding utf8
    exit 1
}

Set-Location $tmp

# Clear all files (keep .git)
Get-ChildItem $tmp -Exclude ".git" | Remove-Item -Recurse -Force

# Copy dist-admin content into the repo
Copy-Item "$src\*" $tmp -Recurse -Force
"Copied dist-admin to repo" | Add-Content $log -Encoding utf8

# List what we copied
$files = Get-ChildItem $tmp -Exclude ".git" | Select-Object Name
"Files: $($files.Name -join ', ')" | Add-Content $log -Encoding utf8

# Check the bundle
$bundle = Get-ChildItem "$tmp\assets\*.js" | Select-Object -First 1
"Bundle: $($bundle.Name)" | Add-Content $log -Encoding utf8

# Stage all
$a = & git add -A 2>&1
"git add: $a" | Add-Content $log -Encoding utf8

# Commit
$c = & git commit -m "deploy: jobs edit fix - admin-rWeAzzBL.js" 2>&1
"git commit: $c" | Add-Content $log -Encoding utf8

# Push
$p = & git push origin main 2>&1
"git push: $p" | Add-Content $log -Encoding utf8

$h = & git log --oneline -1 2>&1
"commit: $h" | Add-Content $log -Encoding utf8

"=== DONE: $(Get-Date) ===" | Add-Content $log -Encoding utf8
