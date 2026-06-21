@echo off
echo === Rentals Phase 2 Deploy: %DATE% %TIME% === > C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log 2>&1
cd /d C:\Users\cabre\abilene-vibes

echo --- Build admin --- >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log
call npm run build:admin >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo BUILD FAILED >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log
  pause
  exit /b 1
)

echo --- Git add and commit --- >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log
git add src/App.jsx dist-admin/ >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log 2>&1
git commit -m "feat: Rent & Housing Phase 2 - complete post-rental form, conditional fields, multi-photo, preview, publish" >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log 2>&1
git push origin main >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log 2>&1

echo --- Push to abilene-vibes-admin repo --- >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log
powershell -ExecutionPolicy Bypass -File "C:\Users\cabre\abilene-vibes\push-to-admin-repo.ps1" >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log 2>&1

echo === DONE: %DATE% %TIME% === >> C:\Users\cabre\abilene-vibes\deploy-rentals-phase2.log
echo Deploy complete! Check deploy-rentals-phase2.log
pause
