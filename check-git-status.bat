@echo off
cd /d C:\Users\cabre\abilene-vibes

echo === git status ===
git status

echo.
echo === diff stat vs HEAD ===
git diff --stat HEAD

echo.
echo === last 3 commits ===
git log --oneline -3

pause
