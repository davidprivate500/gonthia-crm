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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api/client';
import {
  type DateRange,
  type DatePresetKey,
  resolvePreset,
  dateRangeToParams,
  formatDateRange,
} from '@/lib/dates';
import {
  Users,
  Building2,
  Kanban,
  Activity,
  Download,
  BarChart3,
  PieChart,
  Building,
} from 'lucide-react';
import Link from 'next/link';

interface MasterMetricsData {
  dateRange: {
    from: string;
    to: string;
    preset?: DatePresetKey;
  };
  tenantId: string | null;
  platform: {
    totalTenants: number;
    activeTenantsInPeriod: number;
  };
  metrics: {
    contacts: number;
    companies: number;
    deals: number;
    activities: number;
    pipelineValue: number;
  };
  topTenants: {
    byContacts: Array<{ tenantId: string; tenantName: string; count: number }>;
    byDeals: Array<{ tenantId: string; tenantName: string; count: number; value: number }>;
  } | null;
}

interface MasterMonthlyData {
  dateRange: {
    from: string;
    to: string;
    preset?: DatePresetKey;
  };
  tenant: { id: string; name: string } | null;
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

interface TenantOption {
  id: string;
  name: string;
}

export default function MasterReportsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [metricsData, setMetricsData] = useState<MasterMetricsData | null>(null);
  const [monthlyData, setMonthlyData] = useState<MasterMonthlyData | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    searchParams.get('tenantId')
  );
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('platform');

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

  // Fetch tenants list
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        const response = await api.master.tenants.list({ pageSize: 1000 });
        if (response.data && Array.isArray(response.data)) {
          setTenants(response.data.map((t: { id: string; name: string }) => ({
            id: t.id,
            name: t.name,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
      }
    };
    fetchTenants();
  }, []);

  const fetchData = useCallback(async (range: DateRange, tenantId: string | null) => {
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
      if (tenantId) {
        params.tenantId = tenantId;
      }

      const [metricsResponse, monthlyResponse] = await Promise.all([
        api.master.reports.metrics(params),
        api.master.reports.monthly(params),
      ]);

      if (metricsResponse.data) {
        setMetricsData(metricsResponse.data as MasterMetricsData);
      }
      if (monthlyResponse.data) {
        setMonthlyData(monthlyResponse.data as MasterMonthlyData);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(dateRange, selectedTenantId);
  }, [dateRange, selectedTenantId, fetchData]);

  const handleDateRangeChange = (newRange: DateRange) => {
    setDateRange(newRange);
    updateUrl(newRange, selectedTenantId);
  };

  const handleTenantChange = (value: string) => {
    const tenantId = value === 'all' ? null : value;
    setSelectedTenantId(tenantId);
    updateUrl(dateRange, tenantId);
  };

  const updateUrl = (range: DateRange, tenantId: string | null) => {
    const params = dateRangeToParams(range);
    if (tenantId) {
      params.set('tenantId', tenantId);
    }
    router.replace(`/master/reports?${params.toString()}`, { scroll: false });
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
    link.href = URL.createObjectURL(blob);
    link.download = `platform-report-${formatDateRange(dateRange).replace(/\s/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <Header
        title="Platform Reports"
        description="Cross-tenant analytics and billing metrics"
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedTenantId || 'all'}
              onValueChange={handleTenantChange}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Tenants" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tenants</SelectItem>
                {tenants.map(tenant => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <DateRangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              defaultPreset="this_month"
              persistKey="master-reports"
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
              <TabsTrigger value="platform">
                <BarChart3 className="h-4 w-4 mr-2" />
                Platform Overview
              </TabsTrigger>
              <TabsTrigger value="monthly">
                <PieChart className="h-4 w-4 mr-2" />
                Monthly Billing
              </TabsTrigger>
            </TabsList>

            <TabsContent value="platform" className="space-y-6 mt-6">
              {/* Platform Stats */}
              {!selectedTenantId && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                          <p className="text-2xl font-bold mt-1">
                            {metricsData?.platform.totalTenants || 0}
                          </p>
                        </div>
                        <div className="p-3 rounded-full bg-indigo-100">
                          <Building className="h-6 w-6 text-indigo-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Active Tenants</p>
                          <p className="text-2xl font-bold mt-1">
                            {metricsData?.platform.activeTenantsInPeriod || 0}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">in selected period</p>
                        </div>
                        <div className="p-3 rounded-full bg-green-100">
                          <Activity className="h-6 w-6 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Contacts</p>
                        <p className="text-2xl font-bold mt-1">
                          {metricsData?.metrics.contacts || 0}
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
                        <p className="text-sm font-medium text-gray-600">Companies</p>
                        <p className="text-2xl font-bold mt-1">
                          {metricsData?.metrics.companies || 0}
                        </p>
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
                        <p className="text-sm font-medium text-gray-600">Deals</p>
                        <p className="text-2xl font-bold mt-1">
                          {metricsData?.metrics.deals || 0}
                        </p>
                      </div>
                      <div className="p-3 rounded-full bg-purple-100">
                        <Kanban className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Pipeline Value</p>
                        <p className="text-2xl font-bold mt-1">
                          ${(metricsData?.metrics.pipelineValue || 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="p-3 rounded-full bg-yellow-100">
                        <Kanban className="h-6 w-6 text-yellow-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Top Tenants */}
              {metricsData?.topTenants && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Tenants by Contacts</CardTitle>
                      <CardDescription>Most active tenants by contact creation</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {metricsData.topTenants.byContacts.map((tenant, idx) => (
                          <div key={tenant.tenantId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500 w-5">{idx + 1}.</span>
                              <Link
                                href={`/master/tenants/${tenant.tenantId}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {tenant.tenantName}
                              </Link>
                            </div>
                            <span className="font-medium">{tenant.count}</span>
                          </div>
                        ))}
                        {metricsData.topTenants.byContacts.length === 0 && (
                          <p className="text-sm text-gray-500">No data for this period</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top Tenants by Deal Value</CardTitle>
                      <CardDescription>Highest value pipelines</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {metricsData.topTenants.byDeals.map((tenant, idx) => (
                          <div key={tenant.tenantId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500 w-5">{idx + 1}.</span>
                              <Link
                                href={`/master/tenants/${tenant.tenantId}`}
                                className="text-sm font-medium hover:underline"
                              >
                                {tenant.tenantName}
                              </Link>
                            </div>
                            <div className="text-right">
                              <span className="font-medium">{tenant.count} deals</span>
                              <p className="text-xs text-gray-500">
                                ${tenant.value.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                        {metricsData.topTenants.byDeals.length === 0 && (
                          <p className="text-sm text-gray-500">No data for this period</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </TabsContent>

            <TabsContent value="monthly" className="space-y-6 mt-6">
              {monthlyData?.tenant && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    Showing data for tenant: <strong>{monthlyData.tenant.name}</strong>
                  </p>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Monthly Billing Summary</CardTitle>
                  <CardDescription>
                    Billable units by month - use for invoicing
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
