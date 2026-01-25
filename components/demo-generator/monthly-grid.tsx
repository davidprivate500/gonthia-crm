'use client';

import { useState, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

export interface MonthlyMetricTargets {
  leadsCreated: number;
  contactsCreated: number;
  companiesCreated: number;
  dealsCreated: number;
  closedWonCount: number;
  closedWonValue: number;
  pipelineAddedValue: number;
}

export interface MonthlyTarget {
  month: string;
  targets: MonthlyMetricTargets;
}

interface MonthlyGridProps {
  months: MonthlyTarget[];
  onChange: (months: MonthlyTarget[]) => void;
  errors?: Record<string, string>;
}

const METRIC_CONFIG = [
  { key: 'contactsCreated', label: 'Contacts', type: 'count' },
  { key: 'leadsCreated', label: 'Leads', type: 'count' },
  { key: 'companiesCreated', label: 'Companies', type: 'count' },
  { key: 'dealsCreated', label: 'Deals', type: 'count' },
  { key: 'closedWonCount', label: 'Won Deals', type: 'count' },
  { key: 'closedWonValue', label: 'Won Value', type: 'currency' },
  { key: 'pipelineAddedValue', label: 'Pipeline', type: 'currency' },
] as const;

export function MonthlyGrid({ months, onChange, errors = {} }: MonthlyGridProps) {
  const [visibleStartIdx, setVisibleStartIdx] = useState(0);
  const visibleCount = 6; // Show 6 months at a time

  const visibleMonths = useMemo(() => {
    return months.slice(visibleStartIdx, visibleStartIdx + visibleCount);
  }, [months, visibleStartIdx]);

  const canScrollLeft = visibleStartIdx > 0;
  const canScrollRight = visibleStartIdx + visibleCount < months.length;

  const handleValueChange = useCallback((monthIdx: number, metric: keyof MonthlyMetricTargets, value: string) => {
    const actualIdx = visibleStartIdx + monthIdx;
    const numValue = value === '' ? 0 : parseFloat(value);

    if (isNaN(numValue) || numValue < 0) return;

    const updated = [...months];
    updated[actualIdx] = {
      ...updated[actualIdx],
      targets: {
        ...updated[actualIdx].targets,
        [metric]: numValue,
      },
    };
    onChange(updated);
  }, [months, visibleStartIdx, onChange]);

  const formatMonthLabel = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const formatValue = (value: number, type: string) => {
    if (type === 'currency') {
      return value.toLocaleString('en-US');
    }
    return value.toString();
  };

  // Calculate totals
  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    for (const metric of METRIC_CONFIG) {
      result[metric.key] = months.reduce((sum, m) => sum + (m.targets[metric.key as keyof MonthlyMetricTargets] || 0), 0);
    }
    return result;
  }, [months]);

  return (
    <div className="space-y-3">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setVisibleStartIdx(Math.max(0, visibleStartIdx - 1))}
            disabled={!canScrollLeft}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-gray-500">
            Showing {visibleStartIdx + 1}-{Math.min(visibleStartIdx + visibleCount, months.length)} of {months.length} months
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setVisibleStartIdx(Math.min(months.length - visibleCount, visibleStartIdx + 1))}
            disabled={!canScrollRight}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Grid */}
      <div className="border rounded-md">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-3 py-2 text-left font-medium text-gray-600 border">
                Metric
              </th>
              {visibleMonths.map((month) => (
                <th key={month.month} className="px-3 py-2 text-center font-medium text-gray-600 border min-w-[100px]">
                  {formatMonthLabel(month.month)}
                </th>
              ))}
              <th className="px-3 py-2 text-center font-medium text-gray-900 border bg-gray-100 min-w-[90px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {METRIC_CONFIG.map((metric) => (
              <tr key={metric.key} className="hover:bg-gray-50">
                <td className="px-3 py-1.5 font-medium text-gray-700 border whitespace-nowrap">
                  {metric.label}
                  {metric.type === 'currency' && <span className="text-gray-400 ml-1">($)</span>}
                </td>
                {visibleMonths.map((month, idx) => {
                  const value = month.targets[metric.key as keyof MonthlyMetricTargets];
                  const errorKey = `months[${visibleStartIdx + idx}].targets.${metric.key}`;
                  const hasError = !!errors[errorKey];

                  return (
                    <td key={`${month.month}-${metric.key}`} className="p-1 border">
                      <Input
                        type="number"
                        min={0}
                        step={metric.type === 'currency' ? 100 : 1}
                        value={value || ''}
                        onChange={(e) => handleValueChange(idx, metric.key as keyof MonthlyMetricTargets, e.target.value)}
                        className={`text-right h-8 text-sm ${hasError ? 'border-red-500 bg-red-50' : ''}`}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-1.5 text-right font-semibold border bg-gray-50 whitespace-nowrap">
                  {metric.type === 'currency' ? '$' : ''}
                  {formatValue(totals[metric.key], metric.type)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Validation Errors */}
      {Object.keys(errors).length > 0 && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2 text-red-700 font-medium text-xs mb-1">
            <AlertCircle className="h-3 w-3" />
            Validation Errors
          </div>
          <ul className="text-xs text-red-600 list-disc list-inside space-y-0.5">
            {Object.entries(errors).slice(0, 3).map(([key, msg]) => (
              <li key={key}>{msg}</li>
            ))}
            {Object.keys(errors).length > 3 && (
              <li className="text-gray-500">...and {Object.keys(errors).length - 3} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 text-sm p-3 bg-gray-50 rounded-md border">
        <div>
          <div className="text-gray-500 text-xs">Total Contacts</div>
          <div className="font-semibold">{totals.contactsCreated.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Total Deals</div>
          <div className="font-semibold">{totals.dealsCreated.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Total Won Value</div>
          <div className="font-semibold">${totals.closedWonValue.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs">Avg Win Rate</div>
          <div className="font-semibold">
            {totals.dealsCreated > 0
              ? Math.round((totals.closedWonCount / totals.dealsCreated) * 100)
              : 0}%
          </div>
        </div>
      </div>
    </div>
  );
}
