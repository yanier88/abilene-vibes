@echo off
title Git Commit - Admin Icon Fix
cd /d C:\Users\cabre\abilene-vibes

echo Removing stale git lock files...
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\ORIG_HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\refs\heads\main.lock" 2>nul
del /f /q ".git\objects\maintenance.lock" 2>nul
echo Done.

echo.
echo Resetting index to HEAD (unstage everything)...
git reset HEAD
echo.

echo Staging ONLY AndroidManifest.xml...
git add android/app/src/main/AndroidManifest.xml
echo.

echo Files staged:
git diff --cached --name-only
echo.

echo Committing...
git commit -m "fix jobs free plan and remove admin launcher icon"
echo.

echo Commit result:
git log --oneline -3
echo.

pause
