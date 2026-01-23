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
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api/client';
import {
  ArrowLeft, Plus, Calendar, TrendingUp, AlertTriangle, CheckCircle,
  Loader2, Clock, XCircle, Building2, ChevronLeft, ChevronRight,
  ArrowRight, RefreshCw, Eye,
} from 'lucide-react';
import { formatDistanceToNow, format, addMonths, subMonths, startOfMonth } from 'date-fns';

interface DemoTenant {
  id: string;
  tenantId: string;
  tenantName: string;
  industry: string;
  country: string;
  createdAt: string;
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
  mode: 'additive' | 'reconcile';
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
      current: MonthlyKpi;
      target: MonthlyKpi;
      deltas: Record<string, { delta: number; canApply: boolean }>;
    }>;
    totalRecordsToCreate: number;
    estimatedDurationSeconds: number;
    warnings: string[];
  } | null;
  currentKpis: MonthlyKpi[];
}

interface PatchMetrics {
  leadsCreated?: number;
  contactsCreated?: number;
  companiesCreated?: number;
  dealsCreated?: number;
  closedWonCount?: number;
  closedWonValue?: number;
  pipelineAddedValue?: number;
  activitiesCreated?: number;
}

interface PatchMonthInput {
  month: string;
  metrics: PatchMetrics;
}

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
  running: { color: 'bg-blue-100 text-blue-800', icon: Loader2, label: 'Running' },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
};

const METRIC_CONFIG: Array<{ key: string; label: string; isCurrency?: boolean }> = [
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
  const [currentKpis, setCurrentKpis] = useState<MonthlyKpi[]>([]);
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);
  const [monthRange, setMonthRange] = useState({ from: '', to: '' });
  const [patchInputs, setPatchInputs] = useState<PatchMonthInput[]>([]);

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
        // Filter to only completed jobs with tenant IDs
        const completed = (response.data as any[])
          .filter((j: any) => j.status === 'completed' && j.createdTenantId)
          .map((j: any) => ({
            id: j.id,
            tenantId: j.createdTenantId,
            tenantName: j.tenantName || j.config.tenantName,
            industry: j.config.industry,
            country: j.config.country,
            createdAt: j.createdAt,
          }));
        setDemoTenants(completed);
      }
    } catch (error) {
      console.error('Failed to load demo tenants:', error);
    }
  };

  // Load patch job history (would need to add this to the API client)
  const loadPatchJobs = async () => {
    // For now, we'll skip this as the endpoint is not exposed in the list API
    // In a full implementation, you'd add a /api/master/demo-generator/patch-jobs endpoint
    setPatchJobs([]);
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([loadDemoTenants(), loadPatchJobs()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Set default month range (last 3 months to current month)
  useEffect(() => {
    const now = new Date();
    const from = format(subMonths(startOfMonth(now), 2), 'yyyy-MM');
    const to = format(startOfMonth(now), 'yyyy-MM');
    setMonthRange({ from, to });
  }, []);

  // Load KPIs when tenant is selected
  const loadTenantKpis = useCallback(async () => {
    if (!selectedTenantId || !monthRange.from || !monthRange.to) {
      setCurrentKpis([]);
      return;
    }

    setIsLoadingKpis(true);
    setValidationResult(null);

    try {
      const response = await api.master.demoGenerator.getTenantKpis(selectedTenantId, {
        from: monthRange.from,
        to: monthRange.to,
      });

      if (response.data) {
        const kpis = (response.data as any).months || [];
        setCurrentKpis(kpis);

        // Initialize patch inputs for each month
        const inputs: PatchMonthInput[] = kpis.map((k: MonthlyKpi) => ({
          month: k.month,
          metrics: {},
        }));
        setPatchInputs(inputs);
      }
    } catch (error) {
      console.error('Failed to load KPIs:', error);
      setCurrentKpis([]);
    } finally {
      setIsLoadingKpis(false);
    }
  }, [selectedTenantId, monthRange.from, monthRange.to]);

  useEffect(() => {
    loadTenantKpis();
  }, [loadTenantKpis]);

  // Handle patch input change
  const handlePatchInputChange = (monthIdx: number, metric: string, value: string) => {
    const numValue = value === '' ? undefined : parseInt(value, 10);
    if (numValue !== undefined && (isNaN(numValue) || numValue < 0)) return;

    const updated = [...patchInputs];
    updated[monthIdx] = {
      ...updated[monthIdx],
      metrics: {
        ...updated[monthIdx].metrics,
        [metric]: numValue,
      },
    };
    setPatchInputs(updated);
    setValidationResult(null);
  };

  // Validate patch
  const handleValidate = async () => {
    if (!selectedTenantId || patchInputs.length === 0) return;

    // Filter to only months with actual deltas
    const monthsWithDeltas = patchInputs.filter(m =>
      Object.values(m.metrics).some(v => v !== undefined && v > 0)
    );

    if (monthsWithDeltas.length === 0) {
      alert('Please enter at least one metric delta to apply.');
      return;
    }

    setIsValidating(true);

    try {
      const response = await api.master.demoGenerator.validatePatch(selectedTenantId, {
        mode: 'additive',
        planType: 'deltas',
        months: monthsWithDeltas,
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

    const monthsWithDeltas = patchInputs.filter(m =>
      Object.values(m.metrics).some(v => v !== undefined && v > 0)
    );

    setIsApplying(true);

    try {
      const response = await api.master.demoGenerator.applyPatch(selectedTenantId, {
        mode: 'additive',
        planType: 'deltas',
        months: monthsWithDeltas,
      });

      if (response.data) {
        const jobId = (response.data as any).jobId;
        setRunningJobId(jobId);
        setActiveTab('history');
        // Poll for job completion
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
            loadTenantKpis(); // Refresh KPIs
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
        description="Add incremental data to existing demo tenants"
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
              <Plus className="h-4 w-4" />
              Create Update
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
                    Generate a demo client first to apply monthly updates.
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
                      Choose which demo tenant to apply monthly updates to
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
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
                      <div>
                        <Label>Month Range</Label>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="month"
                            value={monthRange.from}
                            onChange={(e) => setMonthRange(prev => ({ ...prev, from: e.target.value }))}
                            className="w-[140px]"
                          />
                          <span className="text-gray-400">to</span>
                          <Input
                            type="month"
                            value={monthRange.to}
                            onChange={(e) => setMonthRange(prev => ({ ...prev, to: e.target.value }))}
                            className="w-[140px]"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Current KPIs & Patch Inputs */}
                {selectedTenantId && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle>Monthly Metrics</CardTitle>
                        <CardDescription>
                          Current values shown in gray. Enter deltas (amounts to add) below.
                        </CardDescription>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadTenantKpis}
                        disabled={isLoadingKpis}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingKpis ? 'animate-spin' : ''}`} />
                        Refresh
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {isLoadingKpis ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                      ) : currentKpis.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">
                          No data found for the selected date range.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="p-2 text-left font-medium text-gray-600 border sticky left-0 bg-gray-50 z-10 min-w-[120px]">
                                  Metric
                                </th>
                                {currentKpis.map((kpi) => (
                                  <th key={kpi.month} className="p-2 text-center font-medium text-gray-600 border min-w-[120px]">
                                    {formatMonthLabel(kpi.month)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {METRIC_CONFIG.map((metric) => (
                                <tr key={metric.key} className="hover:bg-gray-50">
                                  <td className="p-2 font-medium text-gray-700 border sticky left-0 bg-white z-10">
                                    {metric.label}
                                    {metric.isCurrency && <span className="text-gray-400 ml-1">($)</span>}
                                  </td>
                                  {currentKpis.map((kpi, idx) => {
                                    const currentValue = (kpi as any)[metric.key] || 0;
                                    const deltaValue = patchInputs[idx]?.metrics[metric.key as keyof PatchMetrics];

                                    return (
                                      <td key={`${kpi.month}-${metric.key}`} className="p-1 border">
                                        <div className="space-y-1">
                                          <div className="text-xs text-gray-400 text-right px-2">
                                            Current: {metric.isCurrency ? '$' : ''}{currentValue.toLocaleString()}
                                          </div>
                                          <Input
                                            type="number"
                                            min={0}
                                            placeholder="+0"
                                            value={deltaValue ?? ''}
                                            onChange={(e) => handlePatchInputChange(idx, metric.key, e.target.value)}
                                            className="text-right h-8 text-green-600 font-medium"
                                          />
                                        </div>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* Validate Button */}
                      {currentKpis.length > 0 && (
                        <div className="mt-4 flex justify-end">
                          <Button onClick={handleValidate} disabled={isValidating}>
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
                            Patch Validated
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
                            Errors
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
                                  Apply Patch
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
                <CardTitle>Patch History</CardTitle>
                <CardDescription>
                  History of monthly updates applied to demo tenants
                </CardDescription>
              </CardHeader>
              <CardContent>
                {runningJobId ? (
                  <div className="py-8 text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
                    <p className="text-lg font-medium">Patch in progress...</p>
                    <p className="text-gray-500">This may take a few moments.</p>
                  </div>
                ) : patchJobs.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">
                    No patch history yet. Create your first monthly update above.
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
                              <Badge variant="outline">{job.mode}</Badge>
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
