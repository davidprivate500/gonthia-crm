'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/api/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete';
  entityType: string;
  entityId: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  user: { firstName: string | null; lastName: string | null; email: string } | null;
  createdAt: string;
}

const actionColors: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState('all');
  const [action, setAction] = useState('all');

  const pageSize = 50;

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string | number> = { page, pageSize };
        if (entityType !== 'all') params.entityType = entityType;
        if (action !== 'all') params.action = action;

        const response = await api.auditLogs.list(params);
        if (response.data) {
          setLogs(response.data as AuditLog[]);
          setTotal(response.meta?.total || 0);
        }
      } catch (error) {
        console.error('Failed to fetch audit logs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [page, entityType, action]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <Header
        title="Audit Log"
        description="Track all changes made in your CRM"
      />

      <div className="p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Activity History</CardTitle>
                <CardDescription>
                  View a complete history of all create, update, and delete operations.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Select
                  value={entityType}
                  onValueChange={(value) => {
                    setEntityType(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Entity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entities</SelectItem>
                    <SelectItem value="contact">Contacts</SelectItem>
                    <SelectItem value="company">Companies</SelectItem>
                    <SelectItem value="deal">Deals</SelectItem>
                    <SelectItem value="activity">Activities</SelectItem>
                    <SelectItem value="user">Users</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={action}
                  onValueChange={(value) => {
                    setAction(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No audit logs found
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {log.user
                            ? log.user.firstName || log.user.email
                            : 'System'}
                        </TableCell>
                        <TableCell>
                          <Badge className={actionColors[log.action]}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">{log.entityType}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-gray-500">
                          {log.action === 'create' && log.newValues && (
                            <span>Created new record</span>
                          )}
                          {log.action === 'update' && log.newValues && (
                            <span>
                              Updated: {Object.keys(log.newValues).join(', ')}
                            </span>
                          )}
                          {log.action === 'delete' && (
                            <span>Deleted record</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-600">
                      Showing {(page - 1) * pageSize + 1} to{' '}
                      {Math.min(page * pageSize, total)} of {total}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
