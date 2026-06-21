@echo off
title Deploy Admin - Marketplace Section
cd /d C:\Users\cabre\abilene-vibes

del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\ORIG_HEAD.lock" 2>nul
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\refs\heads\main.lock" 2>nul
del /f /q ".git\objects\maintenance.lock" 2>nul

git reset HEAD
git add src/App.jsx
git add src/App.css

echo Files staged:
git diff --cached --name-only

git commit -m "add Marketplace admin section to admin URL panel"

echo.
echo Pushing to main (triggers GitHub Actions deploy)...
git push origin main

echo.
echo ============================================
echo  DONE - GitHub Actions building admin now.
echo  Check: https://github.com/yanier88/abilene-vibes/actions
echo  Admin URL live in ~2-3 min:
echo  https://yanier88.github.io/abilene-vibes-admin/admin.html
echo ============================================
echo.
git log --oneline -4
pause
