@echo off
REM Venue Review - Reinforcement Learning Feedback Loop
REM Reviews discovered venues and provides feedback to improve search strategies

cd /d C:\Users\christoph\planted-website\planted-availability-db\packages\scrapers

set GOOGLE_APPLICATION_CREDENTIALS=C:\Users\christoph\planted-website\planted-availability-db\service-account.json

echo ========================================
echo Venue Review - Feedback Loop
echo ========================================
echo.

REM Default: review 10 random venues
call pnpm run review --batch 10 --random

echo.
echo ========================================
echo Review session complete
echo ========================================
