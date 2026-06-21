@echo off
cd /d "C:\Users\cabre\abilene-vibes"
echo === Rentals final deploy === > deploy-rentals-final.log

:: Remove stale git lock if exists
if exist ".git\index.lock" (
  del /f /q ".git\index.lock"
  echo Removed stale index.lock >> deploy-rentals-final.log
)

:: Force git to re-check file stats
git update-index --really-refresh >> deploy-rentals-final.log 2>&1

:: Show status
echo --- git status --- >> deploy-rentals-final.log
git status >> deploy-rentals-final.log 2>&1

:: Stage App.jsx
git add src/App.jsx >> deploy-rentals-final.log 2>&1

echo --- after add --- >> deploy-rentals-final.log
git diff --cached --stat >> deploy-rentals-final.log 2>&1
git status --short >> deploy-rentals-final.log 2>&1

:: Commit
git commit -m "fix: rentals validPages, admin Hide/Show, admin photo edit" >> deploy-rentals-final.log 2>&1

:: Push
git push origin main >> deploy-rentals-final.log 2>&1

echo === Done === >> deploy-rentals-final.log

:: Show log on screen
type deploy-rentals-final.log
pause
