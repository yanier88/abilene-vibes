@echo off
title Git Commit - Restore Stable
cd /d C:\Users\cabre\abilene-vibes

echo Removing stale git lock files...
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\ORIG_HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\refs\heads\main.lock" 2>nul
del /f /q ".git\objects\maintenance.lock" 2>nul

echo Resetting index...
git reset HEAD

echo Staging package.json...
git add package.json

echo Files staged:
git diff --cached --name-only

echo Committing...
git commit -m "restore stable jobs build after auto refresh rollback"

echo.
echo Commit result:
git log --oneline -3

pause
