'use client';

import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { format, subDays } from 'date-fns';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar, DateRange as CalendarDateRange } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  type DatePresetKey,
  type DateRange,
  getPresetOptions,
  getPresetLabel,
  resolvePreset,
  formatDateRange,
  dateRangeToParams,
  serializeDateRange,
  deserializeDateRange,
} from '@/lib/dates';

export interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  defaultPreset?: DatePresetKey;
  showPresets?: boolean;
  numberOfMonths?: number;
  className?: string;
  align?: 'start' | 'center' | 'end';
  persistKey?: string;
  syncToUrl?: boolean;
  disabled?: boolean;
}

const STORAGE_KEY_PREFIX = 'date-range-';

export function DateRangePicker({
  value,
  onChange,
  defaultPreset = 'this_month',
  showPresets = true,
  numberOfMonths = 2,
  className,
  align = 'end',
  persistKey,
  syncToUrl = false,
  disabled = false,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState<DateRange>(() => {
    // Try to restore from localStorage
    if (persistKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + persistKey);
      if (stored) {
        const restored = deserializeDateRange(stored);
        if (restored) return restored;
      }
    }

    // Try to restore from URL
    if (syncToUrl && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const preset = params.get('preset') as DatePresetKey | null;
      const from = params.get('from');
      const to = params.get('to');

      if (preset && preset !== 'custom') {
        return resolvePreset(preset);
      }

      if (from && to) {
        const fromDate = new Date(from);
        const toDate = new Date(to);
        if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
          return {
            from: fromDate,
            to: new Date(toDate.getTime() + 86400000), // Add 1 day for exclusive end
            preset: 'custom',
          };
        }
      }
    }

    return resolvePreset(defaultPreset);
  });

  // Temporary selection state while calendar is open
  const [tempSelection, setTempSelection] = React.useState<CalendarDateRange | undefined>();

  const currentValue = value ?? internalValue;

  const handlePresetSelect = (presetKey: DatePresetKey) => {
    const newRange = resolvePreset(presetKey);
    updateValue(newRange);
    setOpen(false);
  };

  const handleCalendarSelect = (range: CalendarDateRange | Date | undefined) => {
    if (!range || range instanceof Date) return;

    setTempSelection(range);

    // Auto-apply when both dates are selected
    if (range.from && range.to) {
      const newRange: DateRange = {
        from: range.from,
        to: new Date(range.to.getTime() + 86400000), // Add 1 day for exclusive end
        preset: 'custom',
      };
      updateValue(newRange);
      setTempSelection(undefined);
      setOpen(false);
    }
  };

  const updateValue = (newRange: DateRange) => {
    // Update internal state
    setInternalValue(newRange);

    // Persist to localStorage
    if (persistKey && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PREFIX + persistKey, serializeDateRange(newRange));
    }

    // Sync to URL
    if (syncToUrl && typeof window !== 'undefined') {
      const params = dateRangeToParams(newRange);
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState({}, '', url.toString());
    }

    // Call external onChange
    onChange?.(newRange);
  };

  const displayLabel = React.useMemo(() => {
    if (currentValue.preset && currentValue.preset !== 'custom') {
      return getPresetLabel(currentValue.preset);
    }
    return formatDateRange(currentValue);
  }, [currentValue]);

  // Convert current value to calendar format (inclusive end)
  const calendarValue: CalendarDateRange = React.useMemo(() => {
    if (tempSelection) return tempSelection;
    return {
      from: currentValue.from,
      to: subDays(currentValue.to, 1), // Convert exclusive end to inclusive for display
    };
  }, [currentValue, tempSelection]);

  const presetOptions = getPresetOptions();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal min-w-[200px]',
            !currentValue && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex">
          {showPresets && (
            <div className="border-r p-2 space-y-1 min-w-[140px]">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                Quick Select
              </p>
              {presetOptions.map(option => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handlePresetSelect(option.key)}
                  className={cn(
                    'w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    currentValue.preset === option.key && 'bg-accent text-accent-foreground font-medium'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
          <div>
            <Calendar
              mode="range"
              selected={calendarValue}
              onSelect={handleCalendarSelect}
              numberOfMonths={numberOfMonths}
              maxDate={new Date()}
            />
            {tempSelection?.from && !tempSelection.to && (
              <p className="text-xs text-muted-foreground text-center pb-3">
                Click another date to complete the range
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Hook for managing date range state with URL sync
export function useDateRange(
  defaultPreset: DatePresetKey = 'this_month',
  options?: { persistKey?: string; syncToUrl?: boolean }
): [DateRange, (range: DateRange) => void] {
  const [range, setRange] = React.useState<DateRange>(() => {
    // Try localStorage first
    if (options?.persistKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + options.persistKey);
      if (stored) {
        const restored = deserializeDateRange(stored);
        if (restored) return restored;
      }
    }

    // Try URL
    if (options?.syncToUrl && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const preset = params.get('preset') as DatePresetKey | null;
      if (preset && preset !== 'custom') {
        return resolvePreset(preset);
      }
    }

    return resolvePreset(defaultPreset);
  });

  const updateRange = React.useCallback((newRange: DateRange) => {
    setRange(newRange);

    if (options?.persistKey && typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PREFIX + options.persistKey, serializeDateRange(newRange));
    }

    if (options?.syncToUrl && typeof window !== 'undefined') {
      const params = dateRangeToParams(newRange);
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState({}, '', url.toString());
    }
  }, [options?.persistKey, options?.syncToUrl]);

  return [range, updateRange];
}
