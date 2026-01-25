import { describe, it, expect, vi } from 'vitest';
import {
  resolvePreset,
  parseDateRange,
  formatDate,
  formatDateRange,
  getPresetLabel,
  getPresetOptions,
  dateRangeToParams,
  dateRangeFromSearchParams,
  getMonthsInRange,
  formatMonthKey,
  parseMonthKey,
  serializeDateRange,
  deserializeDateRange,
  type DateRange,
} from '@/lib/dates';

describe('Date Utilities', () => {
  describe('resolvePreset', () => {
    it('should resolve "today" preset with correct structure', () => {
      const result = resolvePreset('today');
      expect(result.preset).toBe('today');
      expect(result.from).toBeInstanceOf(Date);
      expect(result.to).toBeInstanceOf(Date);
      // 'to' should be exactly one day after 'from' (exclusive end)
      const diffMs = result.to.getTime() - result.from.getTime();
      const oneDay = 24 * 60 * 60 * 1000;
      expect(diffMs).toBe(oneDay);
    });

    it('should resolve "yesterday" preset correctly', () => {
      const result = resolvePreset('yesterday');
      expect(result.preset).toBe('yesterday');
      // 'to' should be exactly one day after 'from'
      const diffMs = result.to.getTime() - result.from.getTime();
      const oneDay = 24 * 60 * 60 * 1000;
      expect(diffMs).toBe(oneDay);
      // 'from' should be before today's start
      expect(result.from < resolvePreset('today').from).toBe(true);
    });

    it('should resolve "this_week" with Monday as start', () => {
      const result = resolvePreset('this_week');
      expect(result.preset).toBe('this_week');
      // from should be a Monday (day 1)
      expect(result.from.getDay()).toBe(1);
    });

    it('should resolve "last_week" preset correctly', () => {
      const result = resolvePreset('last_week');
      expect(result.preset).toBe('last_week');
      // Range should be exactly 7 days
      const diffMs = result.to.getTime() - result.from.getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(diffMs).toBe(sevenDays);
      // from should be a Monday
      expect(result.from.getDay()).toBe(1);
    });

    it('should resolve "this_month" preset correctly', () => {
      const result = resolvePreset('this_month');
      expect(result.preset).toBe('this_month');
      // from should be first of month
      expect(result.from.getDate()).toBe(1);
    });

    it('should resolve "last_month" preset correctly', () => {
      const result = resolvePreset('last_month');
      expect(result.preset).toBe('last_month');
      // from should be first of previous month
      expect(result.from.getDate()).toBe(1);
      // to should be first of current month
      expect(result.to.getDate()).toBe(1);
    });

    it('should resolve "last_30_days" preset correctly', () => {
      const result = resolvePreset('last_30_days');
      expect(result.preset).toBe('last_30_days');
      // Range should be 30 days (29 + 1 for exclusive end)
      const diffDays = Math.round((result.to.getTime() - result.from.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(30);
    });

    it('should resolve "last_90_days" preset correctly', () => {
      const result = resolvePreset('last_90_days');
      expect(result.preset).toBe('last_90_days');
      // Range should be 90 days
      const diffDays = Math.round((result.to.getTime() - result.from.getTime()) / (24 * 60 * 60 * 1000));
      expect(diffDays).toBe(90);
    });
  });

  describe('parseDateRange', () => {
    it('should parse valid date range', () => {
      const result = parseDateRange({
        from: '2024-01-01',
        to: '2024-01-31',
      });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.from.getFullYear()).toBe(2024);
        expect(result.from.getMonth()).toBe(0); // January
        expect(result.from.getDate()).toBe(1);
        expect(result.preset).toBe('custom');
      }
    });

    it('should return error for invalid from date', () => {
      const result = parseDateRange({
        from: 'invalid',
        to: '2024-01-31',
      });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('Invalid');
      }
    });

    it('should return error for invalid to date', () => {
      const result = parseDateRange({
        from: '2024-01-01',
        to: 'invalid',
      });

      expect('error' in result).toBe(true);
    });

    it('should return error when from > to', () => {
      const result = parseDateRange({
        from: '2024-06-01',
        to: '2024-01-01',
      });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('cannot be after');
      }
    });

    it('should return error for range > 1 year', () => {
      const result = parseDateRange({
        from: '2023-01-01',
        to: '2024-06-01',
      });

      expect('error' in result).toBe(true);
      if ('error' in result) {
        expect(result.error).toContain('cannot exceed 1 year');
      }
    });

    it('should resolve preset if provided instead of custom', () => {
      const result = parseDateRange({
        from: '2024-01-01',
        to: '2024-01-31',
        preset: 'this_month',
      });

      expect('error' in result).toBe(false);
      if (!('error' in result)) {
        expect(result.preset).toBe('this_month');
        // Should use preset dates, not the custom from/to
        expect(result.from.getDate()).toBe(1);
      }
    });
  });

  describe('formatDate', () => {
    it('should format date with default format', () => {
      const date = new Date(2024, 5, 15); // June 15, 2024
      expect(formatDate(date)).toBe('Jun 15, 2024');
    });

    it('should format date with custom format', () => {
      const date = new Date(2024, 5, 15);
      expect(formatDate(date, 'yyyy-MM-dd')).toBe('2024-06-15');
    });
  });

  describe('formatDateRange', () => {
    it('should format range with same day', () => {
      const range: DateRange = {
        from: new Date(2024, 5, 15),
        to: new Date(2024, 5, 16), // Exclusive, so displays Jun 15
      };
      expect(formatDateRange(range)).toBe('Jun 15, 2024');
    });

    it('should format range with different days', () => {
      const range: DateRange = {
        from: new Date(2024, 5, 1),
        to: new Date(2024, 5, 16), // Exclusive, so displays Jun 15
      };
      expect(formatDateRange(range)).toBe('Jun 1, 2024 - Jun 15, 2024');
    });
  });

  describe('getPresetLabel', () => {
    it('should return correct labels', () => {
      expect(getPresetLabel('today')).toBe('Today');
      expect(getPresetLabel('yesterday')).toBe('Yesterday');
      expect(getPresetLabel('this_week')).toBe('This Week');
      expect(getPresetLabel('last_week')).toBe('Last Week');
      expect(getPresetLabel('this_month')).toBe('This Month');
      expect(getPresetLabel('last_month')).toBe('Last Month');
      expect(getPresetLabel('last_30_days')).toBe('Last 30 Days');
      expect(getPresetLabel('last_90_days')).toBe('Last 90 Days');
      expect(getPresetLabel('custom')).toBe('Custom Range');
    });
  });

  describe('getPresetOptions', () => {
    it('should return all preset options', () => {
      const options = getPresetOptions();
      expect(options).toHaveLength(8);
      expect(options[0].key).toBe('today');
      expect(options[options.length - 1].key).toBe('last_90_days');
    });
  });

  describe('dateRangeToParams', () => {
    it('should convert range to URL params', () => {
      const range: DateRange = {
        from: new Date(2024, 5, 1),
        to: new Date(2024, 5, 16),
        preset: 'custom',
      };

      const params = dateRangeToParams(range);
      expect(params.get('from')).toBe('2024-06-01');
      expect(params.get('to')).toBe('2024-06-15'); // Converted back to inclusive
      expect(params.has('preset')).toBe(false); // Custom preset not included
    });

    it('should include preset in params when not custom', () => {
      const range: DateRange = {
        from: new Date(2024, 5, 1),
        to: new Date(2024, 5, 16),
        preset: 'this_month',
      };

      const params = dateRangeToParams(range);
      expect(params.get('preset')).toBe('this_month');
    });
  });

  describe('dateRangeFromSearchParams', () => {
    it('should parse preset from params', () => {
      const params = new URLSearchParams('preset=this_month');
      const range = dateRangeFromSearchParams(params);
      expect(range.preset).toBe('this_month');
    });

    it('should parse custom date range from params', () => {
      const params = new URLSearchParams('from=2024-01-01&to=2024-01-31');
      const range = dateRangeFromSearchParams(params);
      expect(range.from.getFullYear()).toBe(2024);
      expect(range.from.getMonth()).toBe(0); // January
      expect(range.preset).toBe('custom');
    });

    it('should use default preset when params are empty', () => {
      const params = new URLSearchParams();
      const range = dateRangeFromSearchParams(params, 'last_month');
      expect(range.preset).toBe('last_month');
    });
  });

  describe('getMonthsInRange', () => {
    it('should return months in range', () => {
      const range: DateRange = {
        from: new Date(2024, 0, 1), // Jan 1
        to: new Date(2024, 3, 1), // Apr 1 (exclusive)
      };

      const months = getMonthsInRange(range);
      expect(months).toHaveLength(3);
      expect(months[0].key).toBe('2024-01');
      expect(months[0].label).toBe('Jan 2024');
      expect(months[1].key).toBe('2024-02');
      expect(months[2].key).toBe('2024-03');
    });

    it('should handle single month range', () => {
      const range: DateRange = {
        from: new Date(2024, 5, 1), // Jun 1
        to: new Date(2024, 5, 30), // Jun 30
      };

      const months = getMonthsInRange(range);
      expect(months).toHaveLength(1);
      expect(months[0].key).toBe('2024-06');
    });
  });

  describe('formatMonthKey and parseMonthKey', () => {
    it('should format date to month key', () => {
      const date = new Date(2024, 5, 15); // June 15
      expect(formatMonthKey(date)).toBe('2024-06');
    });

    it('should parse month key to date', () => {
      const date = parseMonthKey('2024-06');
      expect(date.getFullYear()).toBe(2024);
      expect(date.getMonth()).toBe(5); // June is 5 (0-indexed)
    });
  });

  describe('serializeDateRange and deserializeDateRange', () => {
    it('should serialize and deserialize range correctly', () => {
      const original: DateRange = {
        from: new Date(2024, 5, 1),
        to: new Date(2024, 5, 30),
        preset: 'this_month',
      };

      const serialized = serializeDateRange(original);
      const deserialized = deserializeDateRange(serialized);

      expect(deserialized).not.toBeNull();
      expect(deserialized?.from.getTime()).toBe(original.from.getTime());
      expect(deserialized?.to.getTime()).toBe(original.to.getTime());
      expect(deserialized?.preset).toBe(original.preset);
    });

    it('should return null for invalid JSON', () => {
      const result = deserializeDateRange('invalid json');
      expect(result).toBeNull();
    });
  });

  describe('Preset Consistency', () => {
    it('all presets should return valid date ranges', () => {
      const presets = ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'last_30_days', 'last_90_days'] as const;

      for (const preset of presets) {
        const result = resolvePreset(preset);
        expect(result.preset).toBe(preset);
        expect(result.from).toBeInstanceOf(Date);
        expect(result.to).toBeInstanceOf(Date);
        expect(result.from < result.to).toBe(true);
        expect(isNaN(result.from.getTime())).toBe(false);
        expect(isNaN(result.to.getTime())).toBe(false);
      }
    });

    it('preset date ranges should not overlap incorrectly', () => {
      const today = resolvePreset('today');
      const yesterday = resolvePreset('yesterday');
      const thisWeek = resolvePreset('this_week');
      const thisMonth = resolvePreset('this_month');

      // Yesterday's end should equal today's start
      expect(yesterday.to.getTime()).toBe(today.from.getTime());

      // This week should contain today
      expect(thisWeek.from <= today.from).toBe(true);
      expect(thisWeek.to >= today.to).toBe(true);

      // This month should contain today
      expect(thisMonth.from <= today.from).toBe(true);
      expect(thisMonth.to >= today.to).toBe(true);
    });
  });
});
