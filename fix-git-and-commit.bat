@echo off
title Fix Git Index + Commit
cd /d C:\Users\cabre\abilene-vibes
echo === Removing stale lock and corrupt index ===
del /f .git\index.lock 2>nul
del /f .git\index 2>nul
echo === Rebuilding index from HEAD ===
git reset HEAD
echo === Staging App.jsx ===
git add src/App.jsx
echo === Committing ===
git commit -m "fix: definitive Android back button refactor for Marketplace"
echo === Pushing ===
git push origin main
echo.
echo Done!
pause
