@echo off
title Build + Deploy Admin - Back Button Fix
echo === Building admin...
cd /d C:\Users\cabre\abilene-vibes
call npm run build:admin
if %ERRORLEVEL% neq 0 (
  echo BUILD FAILED
  pause
  exit /b 1
)
echo.
echo === Copying to abilene-vibes-admin...
xcopy /E /Y /I C:\Users\cabre\abilene-vibes\dist-admin\* C:\Users\cabre\abilene-vibes-admin\
echo.
echo === Committing and pushing...
cd /d C:\Users\cabre\abilene-vibes-admin
git add .
git commit -m "fix: admin back button trap - close modals on Android back press"
git push origin main --force
echo.
echo Exit code: %ERRORLEVEL%
echo Done: https://yanier88.github.io/abilene-vibes-admin/admin.html
pause
