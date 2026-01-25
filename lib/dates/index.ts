/**
 * Date Range Utilities for Metrics & Reporting
 *
 * IMPORTANT: All date boundaries are computed in UTC for consistency.
 * The `to` date in queries is exclusive (to avoid off-by-one issues).
 *
 * Metric Definitions (timestamp field used):
 * - Deals count: deals.createdAt
 * - Closed won deals: deals.createdAt where stage.isWon = true
 * - Contacts count: contacts.createdAt
 * - Companies count: companies.createdAt
 * - Activities count: activities.createdAt
 * - Pipeline value: deals.createdAt (sum of deal values)
 */

import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  subWeeks,
  subMonths,
  addDays,
  addMonths,
  format,
  parse,
  isValid,
  isAfter,
  differenceInDays,
  eachMonthOfInterval,
} from 'date-fns';

// Preset keys for date range selection
export type DatePresetKey =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'last_30_days'
  | 'last_90_days'
  | 'custom';

export interface DateRange {
  from: Date;      // Inclusive start (UTC)
  to: Date;        // Exclusive end (UTC)
  preset?: DatePresetKey;
}

export interface DateRangeParams {
  from: string;    // ISO date string YYYY-MM-DD
  to: string;      // ISO date string YYYY-MM-DD
  preset?: DatePresetKey;
}

// Week starts on Monday (ISO 8601 standard)
const WEEK_START_DAY = 1 as const; // Monday

/**
 * Get UTC date for current moment
 */
function nowUTC(): Date {
  return new Date();
}

/**
 * Get start of day in UTC
 */
function utcStartOfDay(date: Date): Date {
  return startOfDay(date);
}

/**
 * Get start of next day (exclusive end)
 */
function utcNextDay(date: Date): Date {
  return addDays(startOfDay(date), 1);
}

/**
 * Get start of week (Monday) in UTC
 */
function utcStartOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: WEEK_START_DAY });
}

/**
 * Get start of month in UTC
 */
function utcStartOfMonth(date: Date): Date {
  return startOfMonth(date);
}

/**
 * Parse date range preset into actual date boundaries
 */
export function resolvePreset(preset: DatePresetKey): DateRange {
  const now = nowUTC();

  switch (preset) {
    case 'today':
      return {
        from: utcStartOfDay(now),
        to: utcNextDay(now),
        preset,
      };

    case 'yesterday': {
      const yesterday = subDays(now, 1);
      return {
        from: utcStartOfDay(yesterday),
        to: utcStartOfDay(now),
        preset,
      };
    }

    case 'this_week':
      return {
        from: utcStartOfWeek(now),
        to: utcNextDay(now),
        preset,
      };

    case 'last_week': {
      const thisWeekStart = utcStartOfWeek(now);
      const lastWeekStart = subWeeks(thisWeekStart, 1);
      return {
        from: lastWeekStart,
        to: thisWeekStart,
        preset,
      };
    }

    case 'this_month':
      return {
        from: utcStartOfMonth(now),
        to: utcNextDay(now),
        preset,
      };

    case 'last_month': {
      const thisMonthStart = utcStartOfMonth(now);
      const lastMonthStart = subMonths(thisMonthStart, 1);
      return {
        from: lastMonthStart,
        to: thisMonthStart,
        preset,
      };
    }

    case 'last_30_days':
      return {
        from: utcStartOfDay(subDays(now, 29)),
        to: utcNextDay(now),
        preset,
      };

    case 'last_90_days':
      return {
        from: utcStartOfDay(subDays(now, 89)),
        to: utcNextDay(now),
        preset,
      };

    default:
      // For custom, return this month as default
      return {
        from: utcStartOfMonth(now),
        to: utcNextDay(now),
        preset: 'this_month',
      };
  }
}

/**
 * Parse date range from string parameters
 */
export function parseDateRange(params: DateRangeParams): DateRange | { error: string } {
  // If preset is provided and not custom, resolve it
  if (params.preset && params.preset !== 'custom') {
    return resolvePreset(params.preset);
  }

  // Parse custom date range
  const fromDate = parse(params.from, 'yyyy-MM-dd', new Date());
  const toDate = parse(params.to, 'yyyy-MM-dd', new Date());

  if (!isValid(fromDate)) {
    return { error: `Invalid 'from' date: ${params.from}. Expected format: YYYY-MM-DD` };
  }

  if (!isValid(toDate)) {
    return { error: `Invalid 'to' date: ${params.to}. Expected format: YYYY-MM-DD` };
  }

  if (isAfter(fromDate, toDate)) {
    return { error: `'from' date (${params.from}) cannot be after 'to' date (${params.to})` };
  }

  // Limit range to 1 year
  if (differenceInDays(toDate, fromDate) > 366) {
    return { error: 'Date range cannot exceed 1 year' };
  }

  return {
    from: utcStartOfDay(fromDate),
    to: utcNextDay(toDate), // Exclusive end (start of next day)
    preset: 'custom',
  };
}

/**
 * Format date for display
 */
export function formatDate(date: Date, formatStr: string = 'MMM d, yyyy'): string {
  return format(date, formatStr);
}

/**
 * Format date range for display
 */
export function formatDateRange(range: DateRange): string {
  const fromStr = formatDate(range.from, 'MMM d, yyyy');
  // Subtract 1 day since 'to' is exclusive
  const toStr = formatDate(subDays(range.to, 1), 'MMM d, yyyy');

  if (fromStr === toStr) {
    return fromStr;
  }

  return `${fromStr} - ${toStr}`;
}

/**
 * Get preset label for display
 */
export function getPresetLabel(preset: DatePresetKey): string {
  const labels: Record<DatePresetKey, string> = {
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    last_week: 'Last Week',
    this_month: 'This Month',
    last_month: 'Last Month',
    last_30_days: 'Last 30 Days',
    last_90_days: 'Last 90 Days',
    custom: 'Custom Range',
  };

  return labels[preset] || preset;
}

/**
 * Get all preset options for UI
 */
export function getPresetOptions(): Array<{ key: DatePresetKey; label: string }> {
  return [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'last_week', label: 'Last Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'last_30_days', label: 'Last 30 Days' },
    { key: 'last_90_days', label: 'Last 90 Days' },
  ];
}

/**
 * Convert date range to URL query params
 */
export function dateRangeToParams(range: DateRange): URLSearchParams {
  const params = new URLSearchParams();
  params.set('from', format(range.from, 'yyyy-MM-dd'));
  // Convert exclusive end back to inclusive for URL
  params.set('to', format(subDays(range.to, 1), 'yyyy-MM-dd'));
  if (range.preset && range.preset !== 'custom') {
    params.set('preset', range.preset);
  }
  return params;
}

/**
 * Parse date range from URL search params
 */
export function dateRangeFromSearchParams(
  searchParams: URLSearchParams,
  defaultPreset: DatePresetKey = 'this_month'
): DateRange {
  const preset = searchParams.get('preset') as DatePresetKey | null;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (preset && preset !== 'custom') {
    return resolvePreset(preset);
  }

  if (from && to) {
    const result = parseDateRange({ from, to, preset: 'custom' });
    if ('error' in result) {
      console.warn('Invalid date range in URL:', result.error);
      return resolvePreset(defaultPreset);
    }
    return result;
  }

  return resolvePreset(defaultPreset);
}

/**
 * Get months in a date range for monthly grouping
 */
export function getMonthsInRange(range: DateRange): Array<{ start: Date; end: Date; label: string; key: string }> {
  // Use subDays(range.to, 1) since range.to is exclusive
  const months = eachMonthOfInterval({
    start: range.from,
    end: subDays(range.to, 1),
  });

  return months.map(monthStart => ({
    start: monthStart,
    end: addMonths(monthStart, 1),
    label: format(monthStart, 'MMM yyyy'),
    key: format(monthStart, 'yyyy-MM'),
  }));
}

/**
 * Format month key for grouping (YYYY-MM)
 */
export function formatMonthKey(date: Date): string {
  return format(date, 'yyyy-MM');
}

/**
 * Parse month key back to date
 */
export function parseMonthKey(key: string): Date {
  return parse(key, 'yyyy-MM', new Date());
}

/**
 * Get date range for a specific month
 */
export function getMonthRange(year: number, month: number): DateRange {
  const start = new Date(year, month - 1, 1);
  return {
    from: utcStartOfMonth(start),
    to: addMonths(utcStartOfMonth(start), 1),
    preset: 'custom',
  };
}

/**
 * Serialize date range for localStorage
 */
export function serializeDateRange(range: DateRange): string {
  return JSON.stringify({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    preset: range.preset,
  });
}

/**
 * Deserialize date range from localStorage
 */
export function deserializeDateRange(serialized: string): DateRange | null {
  try {
    const parsed = JSON.parse(serialized);
    return {
      from: new Date(parsed.from),
      to: new Date(parsed.to),
      preset: parsed.preset,
    };
  } catch {
    return null;
  }
}
