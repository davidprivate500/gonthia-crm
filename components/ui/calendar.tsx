'use client';

import * as React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isWithinInterval,
  isBefore,
  isAfter,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export type CalendarMode = 'single' | 'range';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export interface CalendarProps {
  mode?: CalendarMode;
  selected?: Date | DateRange;
  onSelect?: (date: Date | DateRange | undefined) => void;
  disabled?: (date: Date) => boolean;
  minDate?: Date;
  maxDate?: Date;
  className?: string;
  numberOfMonths?: number;
}

const WEEK_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function Calendar({
  mode = 'single',
  selected,
  onSelect,
  disabled,
  minDate,
  maxDate,
  className,
  numberOfMonths = 1,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (mode === 'single' && selected instanceof Date) {
      return startOfMonth(selected);
    }
    if (mode === 'range' && selected && 'from' in selected && selected.from) {
      return startOfMonth(selected.from);
    }
    return startOfMonth(new Date());
  });

  const [hoverDate, setHoverDate] = React.useState<Date | null>(null);

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => subMonths(prev, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => addMonths(prev, 1));
  };

  const isDateDisabled = (date: Date): boolean => {
    if (disabled?.(date)) return true;
    if (minDate && isBefore(date, startOfMonth(minDate))) return true;
    if (maxDate && isAfter(date, endOfMonth(maxDate))) return true;
    return false;
  };

  const isDateSelected = (date: Date): boolean => {
    if (mode === 'single' && selected instanceof Date) {
      return isSameDay(date, selected);
    }
    if (mode === 'range' && selected && 'from' in selected) {
      const { from, to } = selected;
      if (from && to) {
        return isSameDay(date, from) || isSameDay(date, to);
      }
      if (from) {
        return isSameDay(date, from);
      }
    }
    return false;
  };

  const isDateInRange = (date: Date): boolean => {
    if (mode !== 'range' || !selected || !('from' in selected)) return false;
    const { from, to } = selected;

    if (from && to) {
      return isWithinInterval(date, { start: from, end: to });
    }

    // Show hover preview for range selection
    if (from && hoverDate) {
      const start = isBefore(hoverDate, from) ? hoverDate : from;
      const end = isBefore(hoverDate, from) ? from : hoverDate;
      return isWithinInterval(date, { start, end });
    }

    return false;
  };

  const isRangeStart = (date: Date): boolean => {
    if (mode !== 'range' || !selected || !('from' in selected)) return false;
    return selected.from ? isSameDay(date, selected.from) : false;
  };

  const isRangeEnd = (date: Date): boolean => {
    if (mode !== 'range' || !selected || !('from' in selected)) return false;
    return selected.to ? isSameDay(date, selected.to) : false;
  };

  const handleDateClick = (date: Date) => {
    if (isDateDisabled(date)) return;

    if (mode === 'single') {
      onSelect?.(date);
    } else if (mode === 'range') {
      const currentRange = selected as DateRange | undefined;

      if (!currentRange?.from || (currentRange.from && currentRange.to)) {
        // Start new range
        onSelect?.({ from: date, to: undefined });
      } else {
        // Complete the range
        const { from } = currentRange;
        if (isBefore(date, from)) {
          onSelect?.({ from: date, to: from });
        } else {
          onSelect?.({ from, to: date });
        }
      }
    }
  };

  const renderMonth = (monthOffset: number) => {
    const month = addMonths(currentMonth, monthOffset);
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const days: Date[] = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    const weeks: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    return (
      <div key={monthOffset} className="p-3">
        <div className="flex items-center justify-between mb-2">
          {monthOffset === 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          {monthOffset !== 0 && <div className="w-7" />}

          <span className="text-sm font-medium">
            {format(month, 'MMMM yyyy')}
          </span>

          {monthOffset === numberOfMonths - 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={goToNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {monthOffset !== numberOfMonths - 1 && <div className="w-7" />}
        </div>

        <div className="grid grid-cols-7 gap-0">
          {WEEK_DAYS.map(day => (
            <div
              key={day}
              className="h-8 flex items-center justify-center text-xs text-muted-foreground font-medium"
            >
              {day}
            </div>
          ))}

          {weeks.map((week, weekIndex) => (
            <React.Fragment key={weekIndex}>
              {week.map((date, dayIndex) => {
                const isCurrentMonth = isSameMonth(date, month);
                const isDisabled = isDateDisabled(date);
                const isSelected = isDateSelected(date);
                const inRange = isDateInRange(date);
                const rangeStart = isRangeStart(date);
                const rangeEnd = isRangeEnd(date);
                const isToday = isSameDay(date, new Date());

                return (
                  <div
                    key={dayIndex}
                    className={cn(
                      'relative h-8 flex items-center justify-center',
                      inRange && !rangeStart && !rangeEnd && 'bg-primary/10'
                    )}
                  >
                    <button
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleDateClick(date)}
                      onMouseEnter={() => setHoverDate(date)}
                      onMouseLeave={() => setHoverDate(null)}
                      className={cn(
                        'h-7 w-7 rounded-md text-sm font-normal transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                        !isCurrentMonth && 'text-muted-foreground/50',
                        isDisabled && 'opacity-50 cursor-not-allowed hover:bg-transparent',
                        isToday && !isSelected && 'border border-primary',
                        isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                        rangeStart && 'rounded-r-none',
                        rangeEnd && 'rounded-l-none'
                      )}
                    >
                      {format(date, 'd')}
                    </button>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={cn('inline-block', className)}>
      <div className={cn('flex', numberOfMonths > 1 && 'gap-4')}>
        {Array.from({ length: numberOfMonths }, (_, i) => renderMonth(i))}
      </div>
    </div>
  );
}
