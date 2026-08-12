@echo off
setlocal EnableExtensions

rem Deploy the current Sonatory working tree without staging, committing, or pushing.
rem Usage:
rem   scripts\deploy-working-tree.cmd
rem   scripts\deploy-working-tree.cmd --verify-only

pushd "%~dp0.." || (
  echo ERROR: Could not open the Sonatory repository.
  exit /b 1
)

echo.
echo === Sonatory working-tree deployment ===
for /f "delims=" %%H in ('git rev-parse --short HEAD 2^>nul') do set "SONATORY_HEAD=%%H"
if not defined SONATORY_HEAD (
  echo ERROR: This folder is not a Git repository.
  popd
  exit /b 1
)

echo Base commit: %SONATORY_HEAD%
echo.
git status --short
if errorlevel 1 goto :failed

echo.
echo [1/4] Running code and test checks...
call npm.cmd run check
if errorlevel 1 goto :failed

echo.
echo [2/4] Building the current working tree...
call npm.cmd run build
if errorlevel 1 goto :failed

echo.
echo [3/4] Verifying the deployment artifact...
call npm.cmd run verify:dist
if errorlevel 1 goto :failed

if /i "%~1"=="--verify-only" goto :verified
if not "%~1"=="" (
  echo ERROR: Unknown option "%~1".
  echo Usage: %~nx0 [--verify-only]
  goto :failed
)

echo.
echo [4/4] Checking Cloudflare authorization...
call npx.cmd wrangler whoami
if errorlevel 1 (
  echo.
  echo Cloudflare authorization is missing. Run:
  echo   npx.cmd wrangler login --device --use-keyring
  goto :failed
)

echo.
echo Deploying the verified working tree to Sonatory production...
call npx.cmd wrangler pages deploy dist --project-name sonatory --branch main
if errorlevel 1 goto :failed

echo.
echo SUCCESS: The working tree based on %SONATORY_HEAD% was deployed.
echo No files were staged, committed, or pushed.
popd
exit /b 0

:verified
echo.
echo SUCCESS: The working tree based on %SONATORY_HEAD% passed verification.
echo Deployment was skipped because --verify-only was supplied.
popd
exit /b 0

:failed
echo.
echo FAILED: Nothing was deployed after the failed step.
popd
exit /b 1
