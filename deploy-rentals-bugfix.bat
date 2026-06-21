@echo off
echo === Rentals Bugfix Deploy: %DATE% %TIME% === > C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log 2>&1
cd /d C:\Users\cabre\abilene-vibes

echo --- Build admin --- >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log
call npm run build:admin >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo BUILD FAILED >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log
  pause
  exit /b 1
)

echo --- Git add and commit --- >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log
git add src/App.jsx src/App.css dist-admin/ >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log 2>&1
git commit -m "fix: post-rental CSS, chip active state, pets_allowed in detail, supabase null check" >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log 2>&1
git push origin main >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log 2>&1

echo --- Push to abilene-vibes-admin repo --- >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log
powershell -ExecutionPolicy Bypass -File "C:\Users\cabre\abilene-vibes\push-to-admin-repo.ps1" >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log 2>&1

echo === DONE: %DATE% %TIME% === >> C:\Users\cabre\abilene-vibes\deploy-rentals-bugfix.log
echo Deploy complete! Check deploy-rentals-bugfix.log
pause
