'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { MasterHeader } from '@/components/layout/master-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/client';
import {
  ArrowLeft, Users, Building2, Briefcase, Activity,
  Loader2, CheckCircle, XCircle, Clock, LogIn, Trash2, Copy,
  Calendar, DollarSign, TrendingUp,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface DemoJobDetail {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: {
    tenantName: string;
    country: string;
    industry: string;
    startDate: string;
    teamSize: number;
    targets: {
      leads: number;
      contacts: number;
      companies: number;
      pipelineValue: number;
      closedWonValue: number;
      closedWonCount: number;
    };
  };
  seed: string;
  createdTenantId: string | null;
  tenant: { id: string; name: string } | null;
  progress: number;
  currentStep: string | null;
  logs: Array<{ timestamp: string; message: string; level?: string }>;
  metrics: {
    tenantId?: string;
    users?: number;
    contacts?: number;
    companies?: number;
    deals?: number;
    activities?: number;
    pipelineStages?: number;
    totalPipelineValue?: number;
    totalClosedWonValue?: number;
    durationMs?: number;
  } | null;
  errorMessage: string | null;
  errorStack: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
  running: { color: 'bg-blue-100 text-blue-800', icon: Loader2, label: 'Running' },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Failed' },
};

const industries: Record<string, string> = {
  trading: 'Trading / Forex',
  igaming: 'iGaming / Casino',
  saas: 'SaaS / Software',
  ecommerce: 'E-commerce',
  realestate: 'Real Estate',
  finserv: 'Financial Services',
};

const countries: Record<string, { label: string; flag: string }> = {
  US: { label: 'United States', flag: '🇺🇸' },
  GB: { label: 'United Kingdom', flag: '🇬🇧' },
  DE: { label: 'Germany', flag: '🇩🇪' },
  JP: { label: 'Japan', flag: '🇯🇵' },
  BR: { label: 'Brazil', flag: '🇧🇷' },
  AE: { label: 'UAE', flag: '🇦🇪' },
};

export default function DemoJobDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.jobId as string;

  const [job, setJob] = useState<DemoJobDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadJob = async () => {
    try {
      const response = await api.master.demoGenerator.get(jobId);
      if (response.data) {
        setJob(response.data as DemoJobDetail);
      }
    } catch (error) {
      console.error('Failed to load job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJob();

    // Poll while running
    const interval = setInterval(() => {
      if (job?.status === 'running' || job?.status === 'pending') {
        loadJob();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobId, job?.status]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this demo tenant? All data will be permanently removed.')) {
      return;
    }

    setIsDeleting(true);
    try {
      await api.master.demoGenerator.delete(jobId);
      router.push('/master/demo-generator');
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete demo tenant.');
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Job not found</p>
      </div>
    );
  }

  const StatusIcon = statusConfig[job.status].icon;
  const country = countries[job.config.country];

  return (
    <>
      <MasterHeader
        title={job.tenant?.name || job.config.tenantName}
        description={`Demo generation job ${job.id.slice(0, 8)}...`}
        actions={
          <div className="flex gap-2">
            {job.createdTenantId && (
              <Button
                variant="outline"
                onClick={() => window.open(`/dashboard?tenant=${job.createdTenantId}`, '_blank')}
              >
                <LogIn className="h-4 w-4 mr-2" />
                Login as Tenant
              </Button>
            )}
            {job.status === 'completed' && job.createdTenantId && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Tenant
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href="/master/demo-generator">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Link>
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Status Banner */}
        {job.status === 'running' && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-900">Generation in progress</p>
                    <p className="text-sm text-blue-700">{job.currentStep}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-900">{job.progress}%</p>
                </div>
              </div>
              <Progress value={job.progress} className="mt-3 h-2" />
            </CardContent>
          </Card>
        )}

        {job.status === 'failed' && job.errorMessage && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-900">Generation failed</p>
                  <p className="text-sm text-red-700 mt-1">{job.errorMessage}</p>
                  {job.errorStack && (
                    <pre className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800 overflow-x-auto">
                      {job.errorStack}
                    </pre>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Overview Grid */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Status</CardDescription>
            </CardHeader>
            <CardContent>
              <Badge className={statusConfig[job.status].color}>
                <StatusIcon className={`h-3 w-3 mr-1 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                {statusConfig[job.status].label}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Industry</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{industries[job.config.industry] || job.config.industry}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Country</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">
                {country?.flag} {country?.label || job.config.country}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Team Size</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                <span className="text-lg font-semibold">{job.config.teamSize} users</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Metrics */}
        {job.metrics && (
          <Card>
            <CardHeader>
              <CardTitle>Generated Data</CardTitle>
              <CardDescription>
                Summary of data created for this demo tenant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-6">
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Users className="h-4 w-4" />
                    <span className="text-sm">Users</span>
                  </div>
                  <p className="text-2xl font-semibold">{job.metrics.users?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm">Contacts</span>
                  </div>
                  <p className="text-2xl font-semibold">{job.metrics.contacts?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Building2 className="h-4 w-4" />
                    <span className="text-sm">Companies</span>
                  </div>
                  <p className="text-2xl font-semibold">{job.metrics.companies?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Briefcase className="h-4 w-4" />
                    <span className="text-sm">Deals</span>
                  </div>
                  <p className="text-2xl font-semibold">{job.metrics.deals?.toLocaleString() || '-'}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Activity className="h-4 w-4" />
                    <span className="text-sm">Activities</span>
                  </div>
                  <p className="text-2xl font-semibold">{job.metrics.activities?.toLocaleString() || '-'}</p>
                </div>
              </div>

              {(job.metrics.totalPipelineValue || job.metrics.totalClosedWonValue) && (
                <div className="mt-6 pt-6 border-t grid grid-cols-3 gap-6">
                  <div>
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <TrendingUp className="h-4 w-4" />
                      <span className="text-sm">Total Pipeline Value</span>
                    </div>
                    <p className="text-2xl font-semibold text-green-600">
                      {job.metrics.totalPipelineValue ? formatCurrency(job.metrics.totalPipelineValue) : '-'}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="text-sm">Total Closed Won</span>
                    </div>
                    <p className="text-2xl font-semibold text-green-600">
                      {job.metrics.totalClosedWonValue ? formatCurrency(job.metrics.totalClosedWonValue) : '-'}
                    </p>
                  </div>
                  {job.metrics.durationMs && (
                    <div>
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">Generation Time</span>
                      </div>
                      <p className="text-2xl font-semibold">{formatDuration(job.metrics.durationMs)}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Configuration */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Parameters used for generation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Tenant Name:</span>{' '}
                  <span className="font-medium">{job.config.tenantName}</span>
                </div>
                <div>
                  <span className="text-gray-500">Start Date:</span>{' '}
                  <span className="font-medium">{format(new Date(job.config.startDate), 'MMM d, yyyy')}</span>
                </div>
              </div>

              <div className="pt-3 border-t">
                <p className="text-sm font-medium text-gray-700 mb-2">Target Volumes</p>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Leads:</span>{' '}
                    <span className="font-medium">{job.config.targets.leads.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Contacts:</span>{' '}
                    <span className="font-medium">{job.config.targets.contacts.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Companies:</span>{' '}
                    <span className="font-medium">{job.config.targets.companies.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Pipeline:</span>{' '}
                    <span className="font-medium">{formatCurrency(job.config.targets.pipelineValue)}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Closed Won:</span>{' '}
                    <span className="font-medium">{formatCurrency(job.config.targets.closedWonValue)}</span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500">Won Count:</span>{' '}
                    <span className="font-medium">{job.config.targets.closedWonCount}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
              <CardDescription>IDs and timestamps</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Job ID:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">{job.id}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(job.id)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-500">Seed:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-gray-100 px-2 py-1 rounded text-xs">{job.seed}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(job.seed)}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {job.createdTenantId && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Tenant ID:</span>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs">{job.createdTenantId}</code>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(job.createdTenantId!)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Created:</span>
                  <span>{format(new Date(job.createdAt), 'MMM d, yyyy HH:mm:ss')}</span>
                </div>
                {job.startedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Started:</span>
                    <span>{format(new Date(job.startedAt), 'MMM d, yyyy HH:mm:ss')}</span>
                  </div>
                )}
                {job.completedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Completed:</span>
                    <span>{format(new Date(job.completedAt), 'MMM d, yyyy HH:mm:ss')}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs */}
        {job.logs && job.logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Generation Logs</CardTitle>
              <CardDescription>Step-by-step progress log</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
                {job.logs.map((log, i) => (
                  <div key={i} className="flex gap-3 text-gray-300 py-1">
                    <span className="text-gray-500 flex-shrink-0">
                      {format(new Date(log.timestamp), 'HH:mm:ss')}
                    </span>
                    <span className={log.level === 'error' ? 'text-red-400' : log.level === 'success' ? 'text-green-400' : ''}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
