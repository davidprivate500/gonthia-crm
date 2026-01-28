'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { MasterHeader } from '@/components/layout/master-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/client';
import {
  ArrowLeft, Plus, AlertTriangle, CheckCircle,
  Loader2, Clock, XCircle, Building2,
  ArrowRight, RefreshCw, Eye, Edit3, Zap,
} from 'lucide-react';
import { formatDistanceToNow, format, subMonths, startOfMonth } from 'date-fns';

interface DemoTenant {
  id: string;
  tenantId: string;
  tenantName: string;
  industry: string;
  country: string;
  createdAt: string;
  startDate?: string;
}

interface MonthlyKpi {
  month: string;
  leadsCreated: number;
  contactsCreated: number;
  companiesCreated: number;
  dealsCreated: number;
  closedWonCount: number;
  closedWonValue: number;
  closedLostCount: number;
  pipelineAddedValue: number;
  activitiesCreated: number;
}

interface PatchJob {
  id: string;
  tenantId: string;
  tenantName: string | null;
  mode: 'additive' | 'reconcile' | 'metrics-only';
  planType: 'targets' | 'deltas';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep: string | null;
  rangeStartMonth: string;
  rangeEndMonth: string;
  createdAt: string;
  completedAt: string | null;
}

interface PatchPreview {
  valid: boolean;
  errors: string[];
  warnings: string[];
  preview: {
    months: Array<{
      month: string;
      current: Record<string, number>;
      target: Record<string, number>;
      deltas: Record<string, { delta: number; canApply: boolean }>;
    }>;
    totalRecordsToCreate: number;
    estimatedDurationSeconds: number;
    warnings: string[];
  } | null;
  currentKpis: MonthlyKpi[];
}

interface TargetMetrics {
  contactsCreated: number;
  companiesCreated: number;
  dealsCreated: number;
  closedWonCount: number;
  closedWonValue: number;
  activitiesCreated: number;
}

interface MonthTargetInput {
  month: string;
  original: TargetMetrics;
  target: TargetMetrics;
}

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
  running: { color: 'bg-blue-100 text-blue-800', icon: Loader2, label: 'Running' },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
};

const METRIC_CONFIG: Array<{ key: keyof TargetMetrics; label: string; isCurrency?: boolean }> = [
  { key: 'contactsCreated', label: 'Contacts' },
  { key: 'companiesCreated', label: 'Companies' },
  { key: 'dealsCreated', label: 'Deals' },
  { key: 'closedWonCount', label: 'Won Deals' },
  { key: 'closedWonValue', label: 'Won Value', isCurrency: true },
  { key: 'activitiesCreated', label: 'Activities' },
];

export default function MonthlyUpdatesPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [demoTenants, setDemoTenants] = useState<DemoTenant[]>([]);
  const [patchJobs, setPatchJobs] = useState<PatchJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create patch state
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [patchMode, setPatchMode] = useState<'additive' | 'reconcile' | 'metrics-only'>('metrics-only');
  const [monthTargets, setMonthTargets] = useState<MonthTargetInput[]>([]);
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);

  // Validation/Preview state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<PatchPreview | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  // Load demo tenants
  const loadDemoTenants = async () => {
    try {
      const response = await api.master.demoGenerator.list();
      if (response.data) {
        const completed = (response.data as any[])
          .filter((j: any) => j.status === 'completed' && j.createdTenantId)
          .map((j: any) => ({
            id: j.id,
            tenantId: j.createdTenantId,
            tenantName: j.tenantName || j.config.tenantName,
            industry: j.config.industry,
            country: j.config.country,
            createdAt: j.createdAt,
            startDate: j.config.startDate,
          }));
        setDemoTenants(completed);
      }
    } catch (error) {
      console.error('Failed to load demo tenants:', error);
    }
  };

  // Load patch job history
  const loadPatchJobs = async () => {
    try {
      const response = await api.master.demoGenerator.listPatchJobs({ limit: 50 });
      if (response.data) {
        setPatchJobs((response.data as any).jobs || []);
      }
    } catch (error) {
      console.error('Failed to load patch jobs:', error);
      setPatchJobs([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadDemoTenants(), loadPatchJobs()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Load KPIs for entire tenant history when selected
  const loadTenantKpis = useCallback(async () => {
    if (!selectedTenantId) {
      setMonthTargets([]);
      return;
    }

    setIsLoadingKpis(true);
    setValidationResult(null);

    try {
      // Find tenant to get start date
      const tenant = demoTenants.find(t => t.tenantId === selectedTenantId);

      // Calculate full range - from tenant creation to current month
      const now = new Date();
      const currentMonth = format(startOfMonth(now), 'yyyy-MM');

      // Start from tenant creation or 12 months ago, whichever is earlier
      let fromMonth: string;
      if (tenant?.startDate) {
        fromMonth = tenant.startDate.substring(0, 7); // YYYY-MM from YYYY-MM-DD
      } else if (tenant?.createdAt) {
        fromMonth = format(new Date(tenant.createdAt), 'yyyy-MM');
      } else {
        fromMonth = format(subMonths(now, 11), 'yyyy-MM');
      }

      const response = await api.master.demoGenerator.getTenantKpis(selectedTenantId, {
        from: fromMonth,
        to: currentMonth,
      });

      if (response.data) {
        const kpis = (response.data as any).months || [];

        // Initialize targets with current values
        // Note: KPI response has metrics nested in a 'metrics' object
        const inputs: MonthTargetInput[] = kpis.map((k: any) => {
          const metrics = k.metrics || k; // Handle both nested and flat structure
          return {
            month: k.month,
            original: {
              contactsCreated: metrics.contactsCreated || 0,
              companiesCreated: metrics.companiesCreated || 0,
              dealsCreated: metrics.dealsCreated || 0,
              closedWonCount: metrics.closedWonCount || 0,
              closedWonValue: metrics.closedWonValue || 0,
              activitiesCreated: metrics.activitiesCreated || 0,
            },
            target: {
              contactsCreated: metrics.contactsCreated || 0,
              companiesCreated: metrics.companiesCreated || 0,
              dealsCreated: metrics.dealsCreated || 0,
              closedWonCount: metrics.closedWonCount || 0,
              closedWonValue: metrics.closedWonValue || 0,
              activitiesCreated: metrics.activitiesCreated || 0,
            },
          };
        });
        setMonthTargets(inputs);
      }
    } catch (error) {
      console.error('Failed to load KPIs:', error);
      setMonthTargets([]);
    } finally {
      setIsLoadingKpis(false);
    }
  }, [selectedTenantId, demoTenants]);

  useEffect(() => {
    loadTenantKpis();
  }, [loadTenantKpis]);

  // Handle target value change
  const handleTargetChange = (monthIdx: number, metric: keyof TargetMetrics, value: string) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numValue) || numValue < 0) return;

    const updated = [...monthTargets];
    updated[monthIdx] = {
      ...updated[monthIdx],
      target: {
        ...updated[monthIdx].target,
        [metric]: numValue,
      },
    };
    setMonthTargets(updated);
    setValidationResult(null);
  };

  // Reset validation when mode changes
  useEffect(() => {
    setValidationResult(null);
  }, [patchMode]);

  // Check if a value has changed from original
  const hasChanged = (monthIdx: number, metric: keyof TargetMetrics): boolean => {
    const month = monthTargets[monthIdx];
    if (!month) return false;
    return month.target[metric] !== month.original[metric];
  };

  // Get delta for display
  const getDelta = (monthIdx: number, metric: keyof TargetMetrics): number => {
    const month = monthTargets[monthIdx];
    if (!month) return 0;
    return month.target[metric] - month.original[metric];
  };

  // Check if any changes were made
  const hasAnyChanges = (): boolean => {
    return monthTargets.some(m =>
      METRIC_CONFIG.some(metric => m.target[metric.key] !== m.original[metric.key])
    );
  };

  // Get months with changes for API
  const getMonthsWithChanges = () => {
    return monthTargets
      .filter(m => METRIC_CONFIG.some(metric => m.target[metric.key] !== m.original[metric.key]))
      .map(m => ({
        month: m.month,
        metrics: m.target,
      }));
  };

  // Validate patch
  const handleValidate = async () => {
    if (!selectedTenantId || !hasAnyChanges()) return;

    const monthsWithChanges = getMonthsWithChanges();
    if (monthsWithChanges.length === 0) {
      alert('No changes to apply.');
      return;
    }

    setIsValidating(true);

    try {
      const response = await api.master.demoGenerator.validatePatch(selectedTenantId, {
        mode: patchMode,
        planType: 'targets',
        months: monthsWithChanges,
      });

      setValidationResult(response.data as PatchPreview);
    } catch (error: any) {
      console.error('Validation failed:', error);
      alert(`Validation failed: ${error.message || 'Unknown error'}`);
    } finally {
      setIsValidating(false);
    }
  };

  // Apply patch
  const handleApplyPatch = async () => {
    if (!selectedTenantId || !validationResult?.valid) return;

    const monthsWithChanges = getMonthsWithChanges();

    setIsApplying(true);

    try {
      const response = await api.master.demoGenerator.applyPatch(selectedTenantId, {
        mode: patchMode,
        planType: 'targets',
        months: monthsWithChanges,
      });

      if (response.data) {
        const jobId = (response.data as any).jobId;
        setRunningJobId(jobId);
        setActiveTab('history');
        pollJobStatus(jobId);
      }
    } catch (error: any) {
      console.error('Apply patch failed:', error);
      alert(`Failed to apply patch: ${error.message || 'Unknown error'}`);
    } finally {
      setIsApplying(false);
    }
  };

  // Poll job status
  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await api.master.demoGenerator.getPatchJob(jobId);
        if (response.data) {
          const job = (response.data as any).job;
          if (job.status === 'running' || job.status === 'pending') {
            setTimeout(poll, 2000);
          } else {
            setRunningJobId(null);
            loadTenantKpis();
            loadPatchJobs();
          }
        }
      } catch (error) {
        console.error('Failed to poll job status:', error);
        setRunningJobId(null);
      }
    };
    poll();
  };

  const formatMonthLabel = (month: string) => {
    const [year, m] = month.split('-');
    const date = new Date(parseInt(year), parseInt(m) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  };

  const selectedTenant = demoTenants.find(t => t.tenantId === selectedTenantId);

  return (
    <>
      <MasterHeader
        title="Monthly Updates"
        description="Edit metrics for existing demo tenants - change values directly"
        actions={
          <Button variant="outline" asChild>
            <Link href="/master/demo-generator">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Demo Generator
            </Link>
          </Button>
        }
      />

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'create' | 'history')}>
          <TabsList className="mb-6">
            <TabsTrigger value="create" className="flex items-center gap-2">
              <Edit3 className="h-4 w-4" />
              Edit Metrics
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : demoTenants.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <h3 className="text-lg font-medium mb-2">No Demo Tenants Available</h3>
                  <p className="text-gray-500 mb-4">
                    Generate a demo client first to edit metrics.
                  </p>
                  <Button asChild>
                    <Link href="/master/demo-generator">
                      Go to Demo Generator
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Tenant Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle>Select Demo Tenant</CardTitle>
                    <CardDescription>
                      Choose which demo tenant to edit. All months will be loaded automatically.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-4 items-end">
                      <div className="flex-1">
                        <Label>Demo Tenant</Label>
                        <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a demo tenant..." />
                          </SelectTrigger>
                          <SelectContent>
                            {demoTenants.map((tenant) => (
                              <SelectItem key={tenant.tenantId} value={tenant.tenantId}>
                                {tenant.tenantName} ({tenant.industry})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {selectedTenantId && (
                        <Button
                          variant="outline"
                          onClick={loadTenantKpis}
                          disabled={isLoadingKpis}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingKpis ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Mode Selection */}
                {selectedTenantId && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Update Mode</CardTitle>
                      <CardDescription>
                        Choose how changes are applied to the demo tenant.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4">
                        <button
                          onClick={() => setPatchMode('metrics-only')}
                          className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                            patchMode === 'metrics-only'
                              ? 'border-purple-500 bg-purple-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="h-5 w-5 text-purple-600" />
                            <span className="font-semibold">Metrics Only</span>
                            {patchMode === 'metrics-only' && (
                              <Badge className="bg-purple-100 text-purple-700">Recommended</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            Change Won Deals &amp; Won Value on reports without adding records.
                          </p>
                        </button>
                        <button
                          onClick={() => setPatchMode('additive')}
                          className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                            patchMode === 'additive'
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Plus className="h-5 w-5 text-green-600" />
                            <span className="font-semibold">Additive Mode</span>
                            {patchMode === 'additive' && (
                              <Badge className="bg-green-100 text-green-700">Selected</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            Only add new records. Values can only increase.
                          </p>
                        </button>
                        <button
                          onClick={() => setPatchMode('reconcile')}
                          className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                            patchMode === 'reconcile'
                              ? 'border-amber-500 bg-amber-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <RefreshCw className="h-5 w-5 text-amber-600" />
                            <span className="font-semibold">Reconcile Mode</span>
                            {patchMode === 'reconcile' && (
                              <Badge className="bg-amber-100 text-amber-700">Selected</Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            Add or remove records. Values can increase or decrease.
                          </p>
                        </button>
                      </div>
                      {patchMode === 'metrics-only' && (
                        <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center gap-2 text-purple-700 font-medium">
                            <Zap className="h-4 w-4" />
                            Metrics Only Mode
                          </div>
                          <p className="text-sm text-purple-600 mt-1">
                            Only <strong>Won Deals</strong> and <strong>Won Value</strong> can be modified.
                            Changes are applied as report adjustments without creating actual deal or contact records.
                          </p>
                        </div>
                      )}
                      {patchMode === 'reconcile' && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-center gap-2 text-amber-700 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            Reconcile Mode Warning
                          </div>
                          <p className="text-sm text-amber-600 mt-1">
                            This mode will <strong>delete demo-generated records</strong> to match lower target values.
                            Only demo data is affected - manually created records are preserved.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Metrics Grid */}
                {selectedTenantId && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Metrics</CardTitle>
                      <CardDescription>
                        {patchMode === 'metrics-only'
                          ? 'Only Won Deals and Won Value can be edited in Metrics Only mode.'
                          : `Edit values directly. Green = increase, ${patchMode === 'additive' ? 'yellow = cannot decrease in additive mode' : 'red = will delete records'}.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoadingKpis ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                      ) : monthTargets.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                          No data found for this tenant.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="p-2 text-left font-medium text-gray-600 border sticky left-0 bg-gray-50 z-10 min-w-[100px]">
                                  Metric
                                </th>
                                {monthTargets.map((m) => (
                                  <th key={m.month} className="p-2 text-center font-medium text-gray-600 border min-w-[100px]">
                                    {formatMonthLabel(m.month)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {METRIC_CONFIG.map((metric) => {
                                // In metrics-only mode, only allow editing closedWonCount and closedWonValue
                                const isMetricsOnlyAllowed = metric.key === 'closedWonCount' || metric.key === 'closedWonValue';
                                const isDisabled = patchMode === 'metrics-only' && !isMetricsOnlyAllowed;

                                return (
                                  <tr key={metric.key} className={`hover:bg-gray-50 ${isDisabled ? 'opacity-50' : ''}`}>
                                    <td className="p-2 font-medium text-gray-700 border sticky left-0 bg-white z-10">
                                      {metric.label}
                                      {metric.isCurrency && <span className="text-gray-400 ml-1">($)</span>}
                                      {isDisabled && <span className="text-gray-400 ml-1 text-xs">(disabled)</span>}
                                    </td>
                                    {monthTargets.map((m, idx) => {
                                      const delta = getDelta(idx, metric.key);
                                      const changed = hasChanged(idx, metric.key);
                                      const isDecrease = delta < 0;

                                      return (
                                        <td key={`${m.month}-${metric.key}`} className="p-1 border">
                                          <div className="relative">
                                            <Input
                                              type="number"
                                              min={0}
                                              value={m.target[metric.key]}
                                              onChange={(e) => handleTargetChange(idx, metric.key, e.target.value)}
                                              disabled={isDisabled}
                                              className={`text-right h-9 pr-2 ${
                                                isDisabled
                                                  ? 'bg-gray-100 cursor-not-allowed'
                                                  : changed
                                                    ? isDecrease
                                                      ? patchMode === 'reconcile'
                                                        ? 'border-red-400 bg-red-50'
                                                        : 'border-yellow-400 bg-yellow-50'
                                                      : 'border-green-400 bg-green-50'
                                                    : ''
                                              }`}
                                            />
                                            {changed && !isDisabled && (
                                              <span className={`absolute -top-2 -right-1 text-xs font-medium px-1 rounded ${
                                                isDecrease
                                                  ? patchMode === 'reconcile'
                                                    ? 'text-red-600'
                                                    : 'text-yellow-600'
                                                  : 'text-green-600'
                                              }`}>
                                                {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Validate Button */}
                      {monthTargets.length > 0 && (
                        <div className="mt-4 flex justify-between items-center">
                          <div className="text-sm text-gray-500">
                            {hasAnyChanges() ? (
                              <span className="text-blue-600 font-medium">
                                {getMonthsWithChanges().length} month(s) modified
                              </span>
                            ) : (
                              'Edit values above to make changes'
                            )}
                          </div>
                          <Button onClick={handleValidate} disabled={isValidating || !hasAnyChanges()}>
                            {isValidating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Validating...
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Preview Changes
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Validation Result / Preview */}
                {validationResult && (
                  <Card className={validationResult.valid ? 'border-green-200' : 'border-red-200'}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {validationResult.valid ? (
                          <>
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            Changes Validated
                          </>
                        ) : (
                          <>
                            <XCircle className="h-5 w-5 text-red-600" />
                            Validation Failed
                          </>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Errors */}
                      {validationResult.errors.length > 0 && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            Errors (Cannot decrease values in additive mode)
                          </div>
                          <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
                            {validationResult.errors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Warnings */}
                      {validationResult.warnings.length > 0 && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-700 font-medium mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            Warnings
                          </div>
                          <ul className="text-sm text-yellow-600 list-disc list-inside space-y-1">
                            {validationResult.warnings.map((warn, i) => (
                              <li key={i}>{warn}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Preview Summary */}
                      {validationResult.valid && validationResult.preview && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <Card className="bg-gray-50">
                              <CardContent className="pt-4">
                                <div className="text-sm text-gray-500">Records to Create</div>
                                <div className="text-2xl font-bold text-green-600">
                                  +{validationResult.preview.totalRecordsToCreate.toLocaleString()}
                                </div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gray-50">
                              <CardContent className="pt-4">
                                <div className="text-sm text-gray-500">Months Affected</div>
                                <div className="text-2xl font-bold">
                                  {validationResult.preview.months.length}
                                </div>
                              </CardContent>
                            </Card>
                            <Card className="bg-gray-50">
                              <CardContent className="pt-4">
                                <div className="text-sm text-gray-500">Est. Duration</div>
                                <div className="text-2xl font-bold">
                                  ~{validationResult.preview.estimatedDurationSeconds}s
                                </div>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setValidationResult(null)}>
                              Cancel
                            </Button>
                            <Button onClick={handleApplyPatch} disabled={isApplying}>
                              {isApplying ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Applying...
                                </>
                              ) : (
                                <>
                                  <ArrowRight className="h-4 w-4 mr-2" />
                                  Apply Changes
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Update History</CardTitle>
                <CardDescription>
                  History of metric updates applied to demo tenants
                </CardDescription>
              </CardHeader>
              <CardContent>
                {runningJobId ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-lg font-medium">Update in progress...</p>
                    <p className="text-gray-500">This may take a few moments.</p>
                  </div>
                ) : patchJobs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No update history yet. Edit some metrics above to get started.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Range</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patchJobs.map((job) => {
                        const StatusIcon = statusConfig[job.status].icon;
                        return (
                          <TableRow key={job.id}>
                            <TableCell className="font-medium">
                              {job.tenantName || job.tenantId.slice(0, 8)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  job.mode === 'reconcile'
                                    ? 'border-amber-500 text-amber-700'
                                    : job.mode === 'metrics-only'
                                      ? 'border-purple-500 text-purple-700'
                                      : ''
                                }
                              >
                                {job.mode === 'reconcile' ? 'reconcile' : job.mode === 'metrics-only' ? 'metrics-only' : 'additive'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {formatMonthLabel(job.rangeStartMonth)} - {formatMonthLabel(job.rangeEndMonth)}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusConfig[job.status].color}>
                                <StatusIcon className={`h-3 w-3 mr-1 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                                {statusConfig[job.status].label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-gray-500">
                              {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
