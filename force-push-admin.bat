@echo off
title Force Push Admin - Marketplace
cd /d C:\Users\cabre\abilene-vibes-admin
echo === Git log (last 3 commits) ===
git log --oneline -3
echo.
echo === Pushing to GitHub (force) ===
git push origin main --force
echo.
echo Exit code: %ERRORLEVEL%
echo Done: https://yanier88.github.io/abilene-vibes-admin/admin.html
pause
