@echo off
title Git Commit - Free Plan Fix
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

echo Staging ONLY src/App.jsx...
git add src/App.jsx
echo.

echo Files staged:
git diff --cached --name-only
echo.

echo Committing...
git commit -m "fix jobs free plan publishing flow"
echo.

echo Commit result:
git log --oneline -1
echo.

pause
