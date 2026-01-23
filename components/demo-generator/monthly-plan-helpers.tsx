'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { MonthlyTarget, MonthlyMetricTargets } from './monthly-grid';
import { TrendingUp, Sparkles, Copy, Shuffle } from 'lucide-react';

interface HelperDialogProps {
  months: MonthlyTarget[];
  onApply: (months: MonthlyTarget[]) => void;
}

// Generate months array from start to end month
export function generateMonthsArray(startMonth: string, monthCount: number): MonthlyTarget[] {
  const [startYear, startM] = startMonth.split('-').map(Number);
  const months: MonthlyTarget[] = [];

  for (let i = 0; i < monthCount; i++) {
    const date = new Date(startYear, startM - 1 + i, 1);
    const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    months.push({
      month: monthStr,
      targets: {
        leadsCreated: 0,
        contactsCreated: 0,
        companiesCreated: 0,
        dealsCreated: 0,
        closedWonCount: 0,
        closedWonValue: 0,
        pipelineAddedValue: 0,
      },
    });
  }

  return months;
}

// Apply growth pattern to months
export function applyGrowthPattern(
  months: MonthlyTarget[],
  baseValues: MonthlyMetricTargets,
  growthRate: number // as percentage, e.g., 10 for 10%
): MonthlyTarget[] {
  return months.map((month, idx) => {
    const multiplier = Math.pow(1 + growthRate / 100, idx);

    return {
      ...month,
      targets: {
        leadsCreated: Math.round(baseValues.leadsCreated * multiplier),
        contactsCreated: Math.round(baseValues.contactsCreated * multiplier),
        companiesCreated: Math.round(baseValues.companiesCreated * multiplier),
        dealsCreated: Math.round(baseValues.dealsCreated * multiplier),
        closedWonCount: Math.round(baseValues.closedWonCount * multiplier),
        closedWonValue: Math.round(baseValues.closedWonValue * multiplier),
        pipelineAddedValue: Math.round(baseValues.pipelineAddedValue * multiplier),
      },
    };
  });
}

// Fill forward from first month
export function fillForward(months: MonthlyTarget[]): MonthlyTarget[] {
  if (months.length === 0) return months;

  const firstTargets = months[0].targets;
  return months.map((month) => ({
    ...month,
    targets: { ...firstTargets },
  }));
}

// Add random variance
export function addVariance(months: MonthlyTarget[], variancePercent: number): MonthlyTarget[] {
  return months.map((month) => {
    const variance = variancePercent / 100;

    return {
      ...month,
      targets: {
        leadsCreated: Math.round(month.targets.leadsCreated * (1 + (Math.random() - 0.5) * 2 * variance)),
        contactsCreated: Math.round(month.targets.contactsCreated * (1 + (Math.random() - 0.5) * 2 * variance)),
        companiesCreated: Math.round(month.targets.companiesCreated * (1 + (Math.random() - 0.5) * 2 * variance)),
        dealsCreated: Math.round(month.targets.dealsCreated * (1 + (Math.random() - 0.5) * 2 * variance)),
        closedWonCount: Math.round(month.targets.closedWonCount * (1 + (Math.random() - 0.5) * 2 * variance)),
        closedWonValue: Math.round(month.targets.closedWonValue * (1 + (Math.random() - 0.5) * 2 * variance)),
        pipelineAddedValue: Math.round(month.targets.pipelineAddedValue * (1 + (Math.random() - 0.5) * 2 * variance)),
      },
    };
  });
}

// Quick Start Dialog
export function QuickStartDialog({
  open,
  onOpenChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (months: MonthlyTarget[]) => void;
}) {
  const [monthCount, setMonthCount] = useState(6);
  const [baseContacts, setBaseContacts] = useState(100);
  const [baseDeals, setBaseDeals] = useState(15);
  const [baseWonValue, setBaseWonValue] = useState(50000);
  const [growthRate, setGrowthRate] = useState(10);

  // Calculate end month (going backwards from today)
  const getStartMonth = () => {
    const today = new Date();
    today.setMonth(today.getMonth() - monthCount + 1);
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  };

  const handleApply = () => {
    const startMonth = getStartMonth();
    const months = generateMonthsArray(startMonth, monthCount);

    const baseValues: MonthlyMetricTargets = {
      contactsCreated: baseContacts,
      leadsCreated: Math.round(baseContacts * 0.8),
      companiesCreated: Math.round(baseContacts * 0.2),
      dealsCreated: baseDeals,
      closedWonCount: Math.round(baseDeals * 0.33),
      closedWonValue: baseWonValue,
      pipelineAddedValue: Math.round(baseWonValue * 3),
    };

    const withGrowth = applyGrowthPattern(months, baseValues, growthRate);
    const withVariance = addVariance(withGrowth, 15); // 15% variance

    onApply(withVariance);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Quick Start Monthly Plan</DialogTitle>
          <DialogDescription>
            Generate a monthly plan with growth pattern and realistic variance.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Number of Months</Label>
              <Select value={String(monthCount)} onValueChange={(v) => setMonthCount(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 6, 9, 12, 18, 24].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} months</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monthly Growth Rate</Label>
              <Select value={String(growthRate)} onValueChange={(v) => setGrowthRate(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Flat (0%)</SelectItem>
                  <SelectItem value="5">Slow (5%)</SelectItem>
                  <SelectItem value="10">Moderate (10%)</SelectItem>
                  <SelectItem value="15">Fast (15%)</SelectItem>
                  <SelectItem value="20">Aggressive (20%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Base Contacts/Month</Label>
              <Input
                type="number"
                value={baseContacts}
                onChange={(e) => setBaseContacts(parseInt(e.target.value) || 100)}
              />
            </div>

            <div className="space-y-2">
              <Label>Base Deals/Month</Label>
              <Input
                type="number"
                value={baseDeals}
                onChange={(e) => setBaseDeals(parseInt(e.target.value) || 15)}
              />
            </div>

            <div className="space-y-2">
              <Label>Base Won Value/Month ($)</Label>
              <Input
                type="number"
                value={baseWonValue}
                onChange={(e) => setBaseWonValue(parseInt(e.target.value) || 50000)}
              />
            </div>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
            <p>This will generate {monthCount} months of data ending with the current month.</p>
            <p>Values will grow at {growthRate}% per month with ~15% random variance.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Pattern Helper Buttons
export function PatternHelpers({ months, onApply }: HelperDialogProps) {
  const [quickStartOpen, setQuickStartOpen] = useState(false);

  const handleFillForward = () => {
    if (months.length === 0) return;
    onApply(fillForward(months));
  };

  const handleApplyGrowth = () => {
    if (months.length === 0) return;
    const withGrowth = applyGrowthPattern(months, months[0].targets, 10);
    onApply(withGrowth);
  };

  const handleAddVariance = () => {
    onApply(addVariance(months, 15));
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setQuickStartOpen(true)}>
          <Sparkles className="h-4 w-4 mr-1" />
          Quick Start
        </Button>
        <Button variant="outline" size="sm" onClick={handleFillForward} disabled={months.length === 0}>
          <Copy className="h-4 w-4 mr-1" />
          Fill Forward
        </Button>
        <Button variant="outline" size="sm" onClick={handleApplyGrowth} disabled={months.length === 0}>
          <TrendingUp className="h-4 w-4 mr-1" />
          +10% Growth
        </Button>
        <Button variant="outline" size="sm" onClick={handleAddVariance} disabled={months.length === 0}>
          <Shuffle className="h-4 w-4 mr-1" />
          Add Variance
        </Button>
      </div>

      <QuickStartDialog
        open={quickStartOpen}
        onOpenChange={setQuickStartOpen}
        onApply={onApply}
      />
    </>
  );
}
