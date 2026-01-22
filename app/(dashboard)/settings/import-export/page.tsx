'use client';

import { useState, useRef } from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/client';
import { Upload, Download, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';

interface ImportJob {
  id: string;
  entityType: string;
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRows: number | null;
  processedRows: number;
  errorRows: number;
  errors: Array<{ row: number; message: string }>;
  createdAt: string;
  completedAt: string | null;
}

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4 text-yellow-500" />,
  processing: <Clock className="h-4 w-4 text-blue-500 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
};

export default function ImportExportPage() {
  const [importEntity, setImportEntity] = useState('contacts');
  const [exportEntity, setExportEntity] = useState('contacts');
  const [exportFormat, setExportFormat] = useState('csv');
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [exportError, setExportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');
  const [currentJob, setCurrentJob] = useState<ImportJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportError('');
    setImportSuccess('');
    setCurrentJob(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entityType', importEntity);

      const response = await fetch('/api/v1/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Import failed');
      }

      setCurrentJob(result.data.job);
      setImportSuccess(`Import started! Processing ${file.name}...`);

      // Poll for status updates
      pollJobStatus(result.data.job.id);
    } catch (err: unknown) {
      const error = err as Error;
      setImportError(error.message || 'Failed to import file');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const checkStatus = async () => {
      try {
        const response = await api.import.getJob(jobId);
        if (response.data) {
          const job = response.data as ImportJob;
          setCurrentJob(job);

          if (job.status === 'completed') {
            setImportSuccess(
              `Import completed! ${job.processedRows} records imported successfully.`
            );
            return;
          } else if (job.status === 'failed') {
            setImportError(
              `Import failed. ${job.errorRows} errors occurred.`
            );
            return;
          }

          // Continue polling
          setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error('Failed to check job status:', error);
      }
    };

    checkStatus();
  };

  const handleExport = async () => {
    setIsExporting(true);
    setExportError('');
    setExportSuccess('');

    try {
      const response = await fetch(
        `/api/v1/export?entityType=${exportEntity}&format=${exportFormat}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Export failed');
      }

      // Get filename from content-disposition header or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${exportEntity}-export.${exportFormat}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setExportSuccess(`Successfully exported ${exportEntity} data!`);
    } catch (err: unknown) {
      const error = err as Error;
      setExportError(error.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const downloadTemplate = (entityType: string) => {
    const templates: Record<string, string> = {
      contacts: 'firstName,lastName,email,phone,title,source\nJohn,Doe,john@example.com,555-0100,CEO,website\n',
      companies: 'name,industry,website,phone,address,city,state,country\nAcme Corp,Technology,https://acme.com,555-0200,123 Main St,San Francisco,CA,USA\n',
      deals: 'title,value,stage,expectedCloseDate,contactEmail,companyName\nEnterprise Deal,50000,qualified,2024-06-01,john@example.com,Acme Corp\n',
    };

    const content = templates[entityType] || '';
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}-template.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return (
    <>
      <Header
        title="Import & Export"
        description="Import data from CSV files or export your CRM data"
      />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Import Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
            <CardDescription>
              Upload a CSV file to import contacts, companies, or deals into your CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {importError && (
              <Alert variant="destructive">
                <AlertDescription>{importError}</AlertDescription>
              </Alert>
            )}
            {importSuccess && (
              <Alert>
                <AlertDescription>{importSuccess}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select value={importEntity} onValueChange={setImportEntity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacts">Contacts</SelectItem>
                    <SelectItem value="companies">Companies</SelectItem>
                    <SelectItem value="deals">Deals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>CSV Template</Label>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadTemplate(importEntity)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Download Template
                </Button>
              </div>
            </div>

            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImport}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center"
              >
                <Upload className="h-10 w-10 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">
                  {isImporting ? 'Uploading...' : 'Click to upload or drag and drop'}
                </span>
                <span className="text-xs text-gray-400 mt-1">CSV files only</span>
              </label>
            </div>

            {currentJob && (
              <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {statusIcons[currentJob.status]}
                    <span className="font-medium capitalize">{currentJob.status}</span>
                  </div>
                  <span className="text-sm text-gray-500">{currentJob.fileName}</span>
                </div>
                {currentJob.totalRows && (
                  <>
                    <Progress
                      value={(currentJob.processedRows / currentJob.totalRows) * 100}
                    />
                    <p className="text-sm text-gray-600">
                      {currentJob.processedRows} of {currentJob.totalRows} rows processed
                      {currentJob.errorRows > 0 && (
                        <span className="text-red-600">
                          {' '}({currentJob.errorRows} errors)
                        </span>
                      )}
                    </p>
                  </>
                )}
                {currentJob.errors && currentJob.errors.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 rounded text-sm">
                    <p className="font-medium text-red-800 mb-1">Errors:</p>
                    <ul className="text-red-600 space-y-1">
                      {currentJob.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>Row {err.row}: {err.message}</li>
                      ))}
                      {currentJob.errors.length > 5 && (
                        <li>...and {currentJob.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
            <CardDescription>
              Download your CRM data as CSV or JSON files.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {exportError && (
              <Alert variant="destructive">
                <AlertDescription>{exportError}</AlertDescription>
              </Alert>
            )}
            {exportSuccess && (
              <Alert>
                <AlertDescription>{exportSuccess}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Entity Type</Label>
                <Select value={exportEntity} onValueChange={setExportEntity}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacts">Contacts</SelectItem>
                    <SelectItem value="companies">Companies</SelectItem>
                    <SelectItem value="deals">Deals</SelectItem>
                    <SelectItem value="activities">Activities</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={exportFormat} onValueChange={setExportFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleExport} disabled={isExporting}>
              <Download className="h-4 w-4 mr-2" />
              {isExporting ? 'Exporting...' : 'Export Data'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
