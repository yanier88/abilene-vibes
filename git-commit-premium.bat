@echo off
title Git Commit - Premium Jobs
cd /d C:\Users\cabre\abilene-vibes

del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\ORIG_HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\refs\heads\main.lock" 2>nul
del /f /q ".git\objects\maintenance.lock" 2>nul

git reset HEAD
git add src/App.jsx
git add supabase-jobs-phase1.sql

echo Files staged:
git diff --cached --name-only

git commit -m "add premium jobs support and Supabase RLS policies"

echo.
git log --oneline -4
pause
