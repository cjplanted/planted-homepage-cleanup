@echo off
REM Smart Dish Finder - Run dish extraction
REM Extracts dish information from delivery platform pages

cd /d C:\Users\christoph\planted-website\planted-availability-db\packages\scrapers

set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\christoph\planted-website\planted-availability-db\service-account.json

REM Set ANTHROPIC_API_KEY if not already set
if not defined ANTHROPIC_API_KEY (
    echo WARNING: ANTHROPIC_API_KEY not set. Please set it before running.
    echo Example: set ANTHROPIC_API_KEY=sk-ant-...
)

echo ========================================
echo Smart Dish Finder - %date% %time%
echo ========================================

echo.
echo Running dish extraction...
echo.

call pnpm run dish-finder %*

echo.
echo ========================================
echo Dish extraction complete - %date% %time%
echo ========================================
