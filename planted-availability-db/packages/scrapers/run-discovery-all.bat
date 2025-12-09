@echo off
REM Smart Discovery Agent - Scheduled Run
REM Runs discovery for all DACH countries

cd /d C:\Users\christoph\planted-website\planted-availability-db\packages\scrapers

REM Load environment variables from root .env file
if exist "..\..\..\.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("..\..\..\.env") do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" set "%%a=%%b"
    )
)

REM Fallback: Load from local .env if root doesn't exist
if exist ".env" (
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" set "%%a=%%b"
    )
)

REM Check required variables
if "%GOOGLE_AI_API_KEY%"=="" (
    echo ERROR: GOOGLE_AI_API_KEY not set. Please create a .env file.
    echo See .env.example for required variables.
    exit /b 1
)

if "%GOOGLE_SEARCH_API_KEY%"=="" (
    echo ERROR: GOOGLE_SEARCH_API_KEY not set. Please create a .env file.
    exit /b 1
)

echo ========================================
echo Smart Discovery Agent - %date% %time%
echo ========================================

echo.
echo Running discovery for DACH region (Switzerland, Germany, Austria)...
echo This will search for Planted restaurants on delivery platforms
echo and extract country-specific pricing (CHF for CH, EUR for DE/AT)
echo.

call pnpm run discovery --mode explore --countries CH,DE,AT --max-queries 50 --verbose

echo.
echo ========================================
echo Discovery complete - %date% %time%
echo ========================================
