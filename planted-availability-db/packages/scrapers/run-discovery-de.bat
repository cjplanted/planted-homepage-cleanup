@echo off
REM Smart Discovery Agent - Germany Extended Run
REM Runs discovery for Germany including smaller cities

cd /d C:\Users\christoph\planted-website\planted-availability-db\packages\scrapers

set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\christoph\planted-website\planted-availability-db\service-account.json
set GOOGLE_SEARCH_API_KEY=AIzaSyD-k_V6FM1uy8kKYmFSchjiIu88Mnst8Uc
set GOOGLE_SEARCH_ENGINE_ID=23940e3d612724074
set GOOGLE_AI_API_KEY=AIzaSyBN6L9OzRVtruuL_NfvusvQz-YjNrmjTgM

echo ========================================
echo Smart Discovery Agent - Germany Extended - %date% %time%
echo ========================================

echo.
echo Running discovery for Germany (including 54 cities)...
echo This will search for Planted restaurants on delivery platforms
echo.

call pnpm run discovery --mode explore --countries DE --max-queries 100 --verbose

echo.
echo ========================================
echo Discovery complete - %date% %time%
echo ========================================
