@echo off
title Commit - Back Button Fix
cd /d C:\Users\cabre\abilene-vibes
git add src/App.jsx
git commit -m "fix: definitive Android back button refactor for Marketplace"
git push origin main
echo.
echo Done!
pause
