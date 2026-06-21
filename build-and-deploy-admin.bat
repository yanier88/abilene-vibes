@echo off
title Build + Deploy Admin - Marketplace
cd /d C:\Users\cabre\abilene-vibes

echo.
echo ============================================
echo  STEP 1: Build admin (npm run build:admin)
echo ============================================
call npm run build:admin
if %ERRORLEVEL% neq 0 ( echo BUILD FAILED & pause & exit /b 1 )

echo.
echo ============================================
echo  STEP 2: Verify remote in abilene-vibes-admin
echo ============================================
cd /d C:\Users\cabre\abilene-vibes-admin
git remote -v
echo.
echo Above remote MUST show: yanier88/abilene-vibes-admin
echo If correct, press any key to continue. If wrong, close this window.
pause

echo.
echo ============================================
echo  STEP 3: Copy new build into repo
echo ============================================
xcopy /E /Y /I C:\Users\cabre\abilene-vibes\dist-admin\* C:\Users\cabre\abilene-vibes-admin\

echo.
echo ============================================
echo  STEP 4: Commit + Push
echo  TARGET: yanier88/abilene-vibes-admin (main)
echo ============================================
cd /d C:\Users\cabre\abilene-vibes-admin
git add .
git commit -m "deploy: add Marketplace admin section"
git push origin main

if %ERRORLEVEL% neq 0 ( echo PUSH FAILED & pause & exit /b 1 )

echo.
echo ============================================
echo  DONE - Admin URL updated:
echo  https://yanier88.github.io/abilene-vibes-admin/admin.html
echo  Wait 1-2 min for GitHub Pages to refresh.
echo ============================================
pause
