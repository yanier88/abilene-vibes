@echo off
title Deploy Git Only - Marketplace Admin
echo Copying new build to abilene-vibes-admin...
xcopy /E /Y /I C:\Users\cabre\abilene-vibes\dist-admin\* C:\Users\cabre\abilene-vibes-admin\

echo Committing and pushing to yanier88/abilene-vibes-admin...
cd /d C:\Users\cabre\abilene-vibes-admin
git add .
git commit -m "deploy: add Marketplace admin section"
git push origin main

if %ERRORLEVEL% neq 0 (
  echo PUSH FAILED
  pause
  exit /b 1
)

echo.
echo DONE - https://yanier88.github.io/abilene-vibes-admin/admin.html
echo Wait 1-2 min for GitHub Pages to refresh.
