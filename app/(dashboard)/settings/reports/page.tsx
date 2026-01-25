'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api/client';
import {
  type DateRange,
  type DatePresetKey,
  resolvePreset,
  dateRangeToParams,
  getPresetLabel,
  formatDateRange,
} from '@/lib/dates';
import {
  Users,
  Building2,
  Kanban,
  Activity,
  TrendingUp,
  TrendingDown,
  Download,
  BarChart3,
  PieChart,
} from 'lucide-react';

interface MetricsData {
  dateRange: {
    from: string;
    to: string;
    preset?: DatePresetKey;
  };
  contacts: {
    new: number;
    newCustomers: number;
    byStatus: Record<string, number>;
  };
  companies: {
    new: number;
  };
  deals: {
    new: number;
    won: number;
    lost: number;
    pipelineValue: number;
    wonValue: number;
    winRate: number;
  };
  activities: {
    total: number;
    byType: Record<string, number>;
  };
}

interface MonthlyData {
  dateRange: {
    from: string;
    to: string;
    preset?: DatePresetKey;
  };
  months: Array<{
    month: string;
    monthLabel: string;
    contacts: number;
    companies: number;
    deals: number;
    activities: number;
    pipelineValue: number;
  }>;
  totals: {
    contacts: number;
    companies: number;
    deals: number;
    activities: number;
    pipelineValue: number;
  };
}

export default function ReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [metricsData, setMetricsData] = useState<MetricsData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('performance');

  // Initialize date range
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const preset = searchParams.get('preset') as DatePresetKey | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (preset && preset !== 'custom') {
      return resolvePreset(preset);
    }

    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
        return {
          from: fromDate,
          to: new Date(toDate.getTime() + 86400000),
          preset: 'custom',
        };
      }
    }

    return resolvePreset('this_month');
  });

  const fetchData = useCallback(async (range: DateRange) => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (range.preset && range.preset !== 'custom') {
        params.preset = range.preset;
      } else {
        params.from = range.from.toISOString().split('T')[0];
        const toDate = new Date(range.to.getTime() - 86400000);
        params.to = toDate.toISOString().split('T')[0];
      }

      const [metricsResponse, monthlyResponse] = await Promise.all([
        api.reports.metrics(params),
        api.reports.monthly(params),
      ]);

      if (metricsResponse.data) {
        setMetricsData(metricsResponse.data as MetricsData);
      }
      if (monthlyResponse.data) {
        setMonthlyData(monthlyResponse.data as MonthlyData);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange);
  }, [dateRange, fetchData]);

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange);
    const params = dateRangeToParams(newRange);
    router.replace(`/settings/reports?${params.toString()}`, { scroll: false });
  };

  const exportToCSV = () => {
    if (!monthlyData) return;

    const headers = ['Month', 'Contacts', 'Companies', 'Deals', 'Activities', 'Pipeline Value'];
    const rows = monthlyData.months.map(m => [
      m.monthLabel,
      m.contacts,
      m.companies,
      m.deals,
      m.activities,
      m.pipelineValue,
    ]);

    // Add totals row
    rows.push([
      'Total',
      monthlyData.totals.contacts,
      monthlyData.totals.companies,
      monthlyData.totals.deals,
      monthlyData.totals.activities,
      monthlyData.totals.pipelineValue,
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `performance-report-${formatDateRange(dateRange).replace(/\s/g, '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const periodLabel = dateRange.preset && dateRange.preset !== 'custom'
    ? getPresetLabel(dateRange.preset)
    : formatDateRange(dateRange);

  return (
    <>
      <Header
        title="Reports"
        description="Performance metrics and billing summaries"
        actions={
          <div className="flex items-center gap-2">
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              defaultPreset="this_month"
              persistKey="reports"
            />
            <Button variant="outline" size="sm" onClick={exportToCSV} disabled={!monthlyData}>
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="performance">
                <BarChart3 className="h-4 w-4 mr-2" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="monthly">
                <PieChart className="h-4 w-4 mr-2" />
                Monthly Summary
              </TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="space-y-6 mt-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">New Contacts</p>
                        <p className="text-2xl font-bold mt-1">{metricsData?.contacts.new || 0}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {metricsData?.contacts.newCustomers || 0} converted to customers
                        </p>
                      </div>
                      <div className="p-3 rounded-full bg-blue-100">
                        <Users className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">New Companies</p>
                        <p className="text-2xl font-bold mt-1">{metricsData?.companies.new || 0}</p>
                      </div>
                      <div className="p-3 rounded-full bg-green-100">
                        <Building2 className="h-6 w-6 text-green-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Win Rate</p>
                        <p className="text-2xl font-bold mt-1">{metricsData?.deals.winRate || 0}%</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {metricsData?.deals.won || 0} won / {metricsData?.deals.lost || 0} lost
                        </p>
                      </div>
                      <div className="p-3 rounded-full bg-purple-100">
                        {(metricsData?.deals.winRate || 0) >= 50 ? (
                          <TrendingUp className="h-6 w-6 text-purple-600" />
                        ) : (
                          <TrendingDown className="h-6 w-6 text-purple-600" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Won Value</p>
                        <p className="text-2xl font-bold mt-1">
                          ${(metricsData?.deals.wonValue || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          ${(metricsData?.deals.pipelineValue || 0).toLocaleString()} total pipeline
                        </p>
                      </div>
                      <div className="p-3 rounded-full bg-yellow-100">
                        <Kanban className="h-6 w-6 text-yellow-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Contacts by Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Contacts by Status
                    </CardTitle>
                    <CardDescription>Distribution of new contacts by status</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(metricsData?.contacts.byStatus || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{status}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                      {Object.keys(metricsData?.contacts.byStatus || {}).length === 0 && (
                        <p className="text-sm text-gray-500">No contacts in this period</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Activities by Type */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Activities by Type
                    </CardTitle>
                    <CardDescription>
                      {metricsData?.activities.total || 0} total activities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(metricsData?.activities.byType || {}).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between">
                          <span className="text-sm capitalize">{type}</span>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                      {Object.keys(metricsData?.activities.byType || {}).length === 0 && (
                        <p className="text-sm text-gray-500">No activities in this period</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Deals Breakdown */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Kanban className="h-5 w-5" />
                      Deals Summary
                    </CardTitle>
                    <CardDescription>Deal performance for {periodLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center p-4 bg-gray-50 rounded-lg">
                        <p className="text-2xl font-bold">{metricsData?.deals.new || 0}</p>
                        <p className="text-sm text-gray-600">New Deals</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{metricsData?.deals.won || 0}</p>
                        <p className="text-sm text-gray-600">Won</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{metricsData?.deals.lost || 0}</p>
                        <p className="text-sm text-gray-600">Lost</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-600">
                          ${(metricsData?.deals.pipelineValue || 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Pipeline Value</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-600">
                          ${(metricsData?.deals.wonValue || 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Won Value</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="monthly" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Monthly Breakdown</CardTitle>
                  <CardDescription>
                    Metrics grouped by month for billing and analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Contacts</TableHead>
                        <TableHead className="text-right">Companies</TableHead>
                        <TableHead className="text-right">Deals</TableHead>
                        <TableHead className="text-right">Activities</TableHead>
                        <TableHead className="text-right">Pipeline Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlyData?.months.map((month) => (
                        <TableRow key={month.month}>
                          <TableCell className="font-medium">{month.monthLabel}</TableCell>
                          <TableCell className="text-right">{month.contacts}</TableCell>
                          <TableCell className="text-right">{month.companies}</TableCell>
                          <TableCell className="text-right">{month.deals}</TableCell>
                          <TableCell className="text-right">{month.activities}</TableCell>
                          <TableCell className="text-right">
                            ${month.pipelineValue.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      {monthlyData && (
                        <TableRow className="font-bold bg-gray-50">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{monthlyData.totals.contacts}</TableCell>
                          <TableCell className="text-right">{monthlyData.totals.companies}</TableCell>
                          <TableCell className="text-right">{monthlyData.totals.deals}</TableCell>
                          <TableCell className="text-right">{monthlyData.totals.activities}</TableCell>
                          <TableCell className="text-right">
                            ${monthlyData.totals.pipelineValue.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {(!monthlyData?.months || monthlyData.months.length === 0) && (
                    <div className="text-center py-8 text-gray-500">
                      No data for the selected period
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
