'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MasterHeader } from '@/components/layout/master-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/client';
import {
  Plus, MoreHorizontal, Eye, Trash2, RefreshCw, LogIn,
  Loader2, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface DemoJob {
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
  tenantName: string | null;
  progress: number;
  currentStep: string | null;
  metrics: {
    contacts: number;
    deals: number;
    totalPipelineValue: number;
  } | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  running: { color: 'bg-blue-100 text-blue-800', icon: Loader2 },
  completed: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
  failed: { color: 'bg-red-100 text-red-800', icon: XCircle },
};

const industries = [
  { value: 'trading', label: 'Trading / Forex' },
  { value: 'igaming', label: 'iGaming / Casino' },
  { value: 'saas', label: 'SaaS / Software' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'realestate', label: 'Real Estate' },
  { value: 'finserv', label: 'Financial Services' },
];

const countries = [
  { value: 'US', label: 'United States', flag: '🇺🇸' },
  { value: 'GB', label: 'United Kingdom', flag: '🇬🇧' },
  { value: 'DE', label: 'Germany', flag: '🇩🇪' },
  { value: 'JP', label: 'Japan', flag: '🇯🇵' },
  { value: 'BR', label: 'Brazil', flag: '🇧🇷' },
  { value: 'AE', label: 'UAE', flag: '🇦🇪' },
];

export default function DemoGeneratorPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<DemoJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [impersonatingJobId, setImpersonatingJobId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    tenantName: '',
    country: 'US',
    industry: 'trading',
    startDate: '',
    teamSize: 8,
    leads: 2000,
    contacts: 500,
    companies: 200,
    pipelineValue: 500000,
    closedWonValue: 150000,
  });

  // Load jobs
  const loadJobs = async () => {
    try {
      const response = await api.master.demoGenerator.list();
      if (response.data) {
        setJobs(response.data as DemoJob[]);
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadJobs();

    // Poll for updates on running jobs
    const interval = setInterval(() => {
      if (jobs.some((j) => j.status === 'running' || j.status === 'pending')) {
        loadJobs();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [jobs.length]);

  // Set default start date
  useEffect(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    setFormData((prev) => ({
      ...prev,
      startDate: sixMonthsAgo.toISOString().split('T')[0],
    }));
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await api.master.demoGenerator.create({
        tenantName: formData.tenantName || undefined,
        country: formData.country,
        industry: formData.industry,
        startDate: formData.startDate,
        teamSize: formData.teamSize,
        targets: {
          leads: formData.leads,
          contacts: formData.contacts,
          companies: formData.companies,
          pipelineValue: formData.pipelineValue,
          closedWonValue: formData.closedWonValue,
          closedWonCount: Math.round(formData.closedWonValue / 5000),
        },
      });

      if (response.data) {
        setIsDialogOpen(false);
        loadJobs();
      }
    } catch (error) {
      console.error('Failed to start generation:', error);
      alert('Failed to start generation. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this demo tenant? All data will be permanently removed.')) {
      return;
    }

    try {
      await api.master.demoGenerator.delete(jobId);
      loadJobs();
    } catch (error) {
      console.error('Failed to delete:', error);
      alert('Failed to delete demo tenant.');
    }
  };

  const handleLoginAsTenant = async (job: DemoJob) => {
    if (!job.createdTenantId) return;

    setImpersonatingJobId(job.id);
    try {
      const response = await api.master.impersonate(job.createdTenantId);
      if (response.data?.success && response.data.redirectUrl) {
        window.open(response.data.redirectUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to login as tenant:', error);
      alert('Failed to login as tenant. Please try again.');
    } finally {
      setImpersonatingJobId(null);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <>
      <MasterHeader
        title="Demo Client Generator"
        description="Generate realistic demo tenants for presentations and testing"
        actions={
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Generate Demo Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Generate Demo Client</DialogTitle>
                <DialogDescription>
                  Create a new demo tenant with realistic CRM data.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                {/* Industry Selection */}
                <div className="grid grid-cols-3 gap-2">
                  {industries.slice(0, 3).map((ind) => (
                    <Button
                      key={ind.value}
                      variant={formData.industry === ind.value ? 'default' : 'outline'}
                      className="h-auto py-3"
                      onClick={() => setFormData((prev) => ({ ...prev, industry: ind.value }))}
                    >
                      {ind.label}
                    </Button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tenantName">Tenant Name (optional)</Label>
                    <Input
                      id="tenantName"
                      value={formData.tenantName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, tenantName: e.target.value }))}
                      placeholder="Auto-generated if empty"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={formData.country}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, country: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.flag} {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="startDate">Tenant Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="teamSize">Team Size</Label>
                    <Input
                      id="teamSize"
                      type="number"
                      min={2}
                      max={50}
                      value={formData.teamSize}
                      onChange={(e) => setFormData((prev) => ({ ...prev, teamSize: parseInt(e.target.value) || 8 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leads">Leads</Label>
                    <Input
                      id="leads"
                      type="number"
                      min={100}
                      max={50000}
                      value={formData.leads}
                      onChange={(e) => setFormData((prev) => ({ ...prev, leads: parseInt(e.target.value) || 2000 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contacts">Contacts</Label>
                    <Input
                      id="contacts"
                      type="number"
                      min={50}
                      max={20000}
                      value={formData.contacts}
                      onChange={(e) => setFormData((prev) => ({ ...prev, contacts: parseInt(e.target.value) || 500 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="companies">Companies</Label>
                    <Input
                      id="companies"
                      type="number"
                      min={20}
                      max={5000}
                      value={formData.companies}
                      onChange={(e) => setFormData((prev) => ({ ...prev, companies: parseInt(e.target.value) || 200 }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pipelineValue">Pipeline Value ($)</Label>
                    <Input
                      id="pipelineValue"
                      type="number"
                      min={10000}
                      max={100000000}
                      value={formData.pipelineValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, pipelineValue: parseInt(e.target.value) || 500000 }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="closedWonValue">Closed Won Value ($)</Label>
                    <Input
                      id="closedWonValue"
                      type="number"
                      min={5000}
                      max={50000000}
                      value={formData.closedWonValue}
                      onChange={(e) => setFormData((prev) => ({ ...prev, closedWonValue: parseInt(e.target.value) || 150000 }))}
                    />
                  </div>
                </div>

                {/* Preview Summary */}
                <Card className="bg-gray-50">
                  <CardContent className="pt-4">
                    <div className="text-sm text-gray-600">
                      <p>Estimated generation time: ~30 seconds</p>
                      <p>
                        Will create {formData.leads.toLocaleString()} leads,{' '}
                        {formData.contacts.toLocaleString()} contacts,{' '}
                        {formData.companies.toLocaleString()} companies
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleGenerate} disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate Demo Client'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Generated Demo Clients</CardTitle>
            <CardDescription>
              Demo tenants you&apos;ve generated for presentations and testing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
                  <Plus className="h-12 w-12" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No demo clients yet</h3>
                <p className="text-gray-500 mb-4">
                  Generate your first demo client to see a fully populated CRM.
                </p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Generate Demo Client
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant Name</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Deals</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => {
                    const StatusIcon = statusConfig[job.status].icon;
                    const country = countries.find((c) => c.value === job.config.country);

                    return (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          {job.tenantName || job.config.tenantName}
                        </TableCell>
                        <TableCell>
                          {country?.flag} {country?.value || job.config.country}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {industries.find((i) => i.value === job.config.industry)?.label || job.config.industry}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {job.metrics?.contacts?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell>
                          {job.metrics?.deals?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell>
                          {job.metrics?.totalPipelineValue
                            ? formatCurrency(job.metrics.totalPipelineValue)
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={statusConfig[job.status].color}>
                              <StatusIcon className={`h-3 w-3 mr-1 ${job.status === 'running' ? 'animate-spin' : ''}`} />
                              {job.status}
                            </Badge>
                            {job.status === 'running' && (
                              <span className="text-xs text-gray-500">
                                {job.progress}%
                              </span>
                            )}
                          </div>
                          {job.status === 'running' && (
                            <Progress value={job.progress} className="h-1 mt-1" />
                          )}
                        </TableCell>
                        <TableCell className="text-gray-500">
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/master/demo-generator/jobs/${job.id}`)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              {job.createdTenantId && (
                                <DropdownMenuItem
                                  onClick={() => handleLoginAsTenant(job)}
                                  disabled={impersonatingJobId === job.id}
                                >
                                  {impersonatingJobId === job.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <LogIn className="h-4 w-4 mr-2" />
                                  )}
                                  {impersonatingJobId === job.id ? 'Logging in...' : 'Login as Tenant'}
                                </DropdownMenuItem>
                              )}
                              {job.status === 'completed' && job.createdTenantId && (
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDelete(job.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Tenant
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
