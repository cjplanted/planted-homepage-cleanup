import type { DayOfWeek, OpeningHours, TimeRange } from '../types/venue.js';

const DAYS_OF_WEEK: DayOfWeek[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
];

/**
 * Get the current day of week
 */
export function getCurrentDayOfWeek(timezone?: string): DayOfWeek {
  const date = timezone
    ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    : new Date();
  return DAYS_OF_WEEK[date.getDay()];
}

/**
 * Get current time in HH:MM format
 */
export function getCurrentTime(timezone?: string): string {
  const date = timezone
    ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    : new Date();
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if a time is within a time range
 */
export function isTimeInRange(time: string, range: TimeRange): boolean {
  const timeMinutes = parseTimeToMinutes(time);
  const openMinutes = parseTimeToMinutes(range.open);
  const closeMinutes = parseTimeToMinutes(range.close);

  // Handle overnight hours (e.g., open: 22:00, close: 02:00)
  if (closeMinutes < openMinutes) {
    return timeMinutes >= openMinutes || timeMinutes <= closeMinutes;
  }

  return timeMinutes >= openMinutes && timeMinutes <= closeMinutes;
}

/**
 * Check if a venue is currently open based on opening hours
 */
export function isVenueOpen(
  openingHours: OpeningHours,
  timezone?: string
): boolean {
  const now = timezone
    ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    : new Date();
  const today = now.toISOString().split('T')[0];
  const currentDay = getCurrentDayOfWeek(timezone);
  const currentTime = getCurrentTime(timezone);

  // Check for exceptions first (holidays, special dates)
  if (openingHours.exceptions) {
    const exception = openingHours.exceptions.find((e) => e.date === today);
    if (exception) {
      if (exception.hours === 'closed') return false;
      return exception.hours.some((range) => isTimeInRange(currentTime, range));
    }
  }

  // Check regular hours
  const todayHours = openingHours.regular[currentDay];
  if (!todayHours || todayHours.length === 0) return false;

  return todayHours.some((range) => isTimeInRange(currentTime, range));
}

/**
 * Get the next opening time for a venue
 */
export function getNextOpeningTime(
  openingHours: OpeningHours,
  timezone?: string
): Date | null {
  const now = timezone
    ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    : new Date();

  // Check up to 7 days ahead
  for (let daysAhead = 0; daysAhead < 7; daysAhead++) {
    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + daysAhead);

    const dayOfWeek = DAYS_OF_WEEK[checkDate.getDay()];
    const dateStr = checkDate.toISOString().split('T')[0];

    // Check exceptions
    if (openingHours.exceptions) {
      const exception = openingHours.exceptions.find((e) => e.date === dateStr);
      if (exception) {
        if (exception.hours === 'closed') continue;
        const firstOpen = exception.hours[0];
        if (firstOpen) {
          const [hours, minutes] = firstOpen.open.split(':').map(Number);
          checkDate.setHours(hours, minutes, 0, 0);
          if (checkDate > now) return checkDate;
        }
        continue;
      }
    }

    // Check regular hours
    const dayHours = openingHours.regular[dayOfWeek];
    if (dayHours && dayHours.length > 0) {
      for (const range of dayHours) {
        const [hours, minutes] = range.open.split(':').map(Number);
        checkDate.setHours(hours, minutes, 0, 0);
        if (checkDate > now) return checkDate;
      }
    }
  }

  return null;
}

/**
 * Get today's opening hours as a formatted string
 */
export function getTodayHoursString(
  openingHours: OpeningHours,
  timezone?: string
): string {
  const now = timezone
    ? new Date(new Date().toLocaleString('en-US', { timeZone: timezone }))
    : new Date();
  const today = now.toISOString().split('T')[0];
  const currentDay = getCurrentDayOfWeek(timezone);

  // Check exceptions
  if (openingHours.exceptions) {
    const exception = openingHours.exceptions.find((e) => e.date === today);
    if (exception) {
      if (exception.hours === 'closed') return 'Closed';
      return exception.hours.map((r) => `${r.open} - ${r.close}`).join(', ');
    }
  }

  // Regular hours
  const todayHours = openingHours.regular[currentDay];
  if (!todayHours || todayHours.length === 0) return 'Closed';

  return todayHours.map((r) => `${r.open} - ${r.close}`).join(', ');
}

/**
 * Calculate data freshness status based on last verification
 */
export function getFreshnessStatus(
  lastVerified: Date
): 'fresh' | 'stale' | 'very_stale' | 'archived' {
  const now = new Date();
  const diffMs = now.getTime() - lastVerified.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) return 'fresh';
  if (diffDays <= 7) return 'stale';
  if (diffDays <= 14) return 'very_stale';
  return 'archived';
}
