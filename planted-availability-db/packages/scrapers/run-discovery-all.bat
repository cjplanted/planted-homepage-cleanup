@echo off
REM Smart Discovery Agent - Scheduled Run
REM Runs discovery for all DACH countries

cd /d C:\Users\christoph\planted-website\planted-availability-db\packages\scrapers

set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\christoph\planted-website\planted-availability-db\service-account.json
set GOOGLE_SEARCH_API_KEY=AIzaSyD-k_V6FM1uy8kKYmFSchjiIu88Mnst8Uc
set GOOGLE_SEARCH_ENGINE_ID=23940e3d612724074
set GOOGLE_AI_API_KEY=AIzaSyBN6L9OzRVtruuL_NfvusvQz-YjNrmjTgM

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
