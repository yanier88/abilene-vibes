@echo off
echo === Jobs Fix Deploy: %DATE% %TIME% === > C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log 2>&1
cd /d C:\Users\cabre\abilene-vibes

echo --- Build admin --- >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log
call npm run build:admin >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log 2>&1
if %ERRORLEVEL% NEQ 0 (
  echo BUILD FAILED >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log
  pause
  exit /b 1
)

echo --- Git commit dist-admin --- >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log
git add dist-admin/ >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log 2>&1
git commit -m "build: jobs fixes - expired filter, compression, near me removed" >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log 2>&1
git push origin main >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log 2>&1

echo --- Push to abilene-vibes-admin repo --- >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log
powershell -ExecutionPolicy Bypass -File "C:\Users\cabre\abilene-vibes\push-to-admin-repo.ps1" >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log 2>&1

echo === DONE: %DATE% %TIME% === >> C:\Users\cabre\abilene-vibes\deploy-jobs-fix.log
echo Deploy complete! Check deploy-jobs-fix.log for details.
pause
