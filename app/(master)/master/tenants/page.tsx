'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { MasterHeader } from '@/components/layout/master-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api/client';
import { Search, ChevronLeft, ChevronRight, Users, Briefcase, FileText } from 'lucide-react';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDistanceToNow } from 'date-fns';

interface TenantStats {
  users: number;
  contacts: number;
  deals: number;
  invoices: number;
}

interface Tenant {
  id: string;
  name: string;
  createdAt: string;
  stats: TenantStats;
}

export default function TenantsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const debouncedSearch = useDebounce(search, 300);
  const pageSize = 20;

  useEffect(() => {
    const fetchTenants = async () => {
      setIsLoading(true);
      try {
        const params: Record<string, string | number> = {
          page,
          pageSize,
        };
        if (debouncedSearch) params.search = debouncedSearch;

        const response = await api.master.tenants.list(params);
        if (response.data) {
          setTenants(response.data as Tenant[]);
          setTotal(response.meta?.total || 0);
        }
      } catch (error) {
        console.error('Failed to fetch tenants:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTenants();
  }, [page, debouncedSearch]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <MasterHeader
        title="Tenants"
        description={`${total} organizations on the platform`}
      />

      <div className="p-6">
        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search tenants..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-center">Contacts</TableHead>
                <TableHead className="text-center">Deals</TableHead>
                <TableHead className="text-center">Invoices</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="flex justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : tenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    {search ? 'No tenants match your search' : 'No tenants registered yet'}
                  </TableCell>
                </TableRow>
              ) : (
                tenants.map((tenant) => (
                  <TableRow
                    key={tenant.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/master/tenants/${tenant.id}`)}
                  >
                    <TableCell className="font-medium">
                      {tenant.name}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {tenant.stats.users}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-gray-600">{tenant.stats.contacts.toLocaleString()}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1">
                        <Briefcase className="h-3 w-3" />
                        {tenant.stats.deals}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="gap-1">
                        <FileText className="h-3 w-3" />
                        {tenant.stats.invoices}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDistanceToNow(new Date(tenant.createdAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-600">
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
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
      </div>
    </>
  );
}
