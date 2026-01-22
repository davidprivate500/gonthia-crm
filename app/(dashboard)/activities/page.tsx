'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/lib/api/client';
import { Plus, Phone, Mail, Calendar, FileText, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';

interface Activity {
  id: string;
  type: 'note' | 'call' | 'email' | 'meeting' | 'task';
  subject: string;
  description: string | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  company: { id: string; name: string } | null;
  deal: { id: string; title: string } | null;
  createdBy: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  note: FileText,
  call: Phone,
  email: Mail,
  meeting: Calendar,
  task: CheckSquare,
};

const activityColors: Record<string, string> = {
  note: 'bg-gray-100 text-gray-600',
  call: 'bg-green-100 text-green-600',
  email: 'bg-blue-100 text-blue-600',
  meeting: 'bg-purple-100 text-purple-600',
  task: 'bg-yellow-100 text-yellow-600',
};

export default function ActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');

  const pageSize = 20;

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (type && type !== 'all') params.type = type;

      const response = await api.activities.list(params);
      if (response.data) {
        setActivities(response.data as Activity[]);
        setTotal(response.meta?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, type]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const handleComplete = async (id: string, completed: boolean) => {
    try {
      if (completed) {
        await api.activities.complete(id);
      } else {
        await api.activities.uncomplete(id);
      }
      fetchActivities();
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <>
      <Header
        title="Activities"
        description={`${total} activities logged`}
        actions={
          <Button asChild>
            <Link href="/activities/new">
              <Plus className="h-4 w-4 mr-1" />
              Log Activity
            </Link>
          </Button>
        }
      />

      <div className="p-6">
        {/* Filters */}
        <div className="mb-6">
          <Select
            value={type}
            onValueChange={(value) => {
              setType(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="note">Notes</SelectItem>
              <SelectItem value="call">Calls</SelectItem>
              <SelectItem value="email">Emails</SelectItem>
              <SelectItem value="meeting">Meetings</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Activity List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          ) : activities.length === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-gray-500">
                {type !== 'all' ? 'No activities match your filter' : 'No activities yet. Log your first activity!'}
              </CardContent>
            </Card>
          ) : (
            activities.map((activity) => {
              const Icon = activityIcons[activity.type] || FileText;
              return (
                <Card key={activity.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {activity.type === 'task' && (
                        <Checkbox
                          checked={!!activity.completedAt}
                          onCheckedChange={(checked) =>
                            handleComplete(activity.id, checked as boolean)
                          }
                          className="mt-1"
                        />
                      )}
                      <div className={`p-2 rounded-lg ${activityColors[activity.type]}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className={`font-medium ${activity.completedAt ? 'line-through text-gray-400' : ''}`}>
                              {activity.subject}
                            </h3>
                            {activity.description && (
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {activity.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="capitalize shrink-0">
                            {activity.type}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-2 text-sm text-gray-500">
                          {activity.contact && (
                            <Link
                              href={`/contacts/${activity.contact.id}`}
                              className="hover:text-primary"
                            >
                              {activity.contact.firstName} {activity.contact.lastName}
                            </Link>
                          )}
                          {activity.company && (
                            <>
                              {activity.contact && <span>•</span>}
                              <Link
                                href={`/companies/${activity.company.id}`}
                                className="hover:text-primary"
                              >
                                {activity.company.name}
                              </Link>
                            </>
                          )}
                          {activity.deal && (
                            <>
                              {(activity.contact || activity.company) && <span>•</span>}
                              <Link
                                href={`/pipeline?deal=${activity.deal.id}`}
                                className="hover:text-primary"
                              >
                                {activity.deal.title}
                              </Link>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span>{new Date(activity.createdAt).toLocaleString()}</span>
                          {activity.createdBy && (
                            <span>
                              by {activity.createdBy.firstName || activity.createdBy.email}
                            </span>
                          )}
                          {activity.scheduledAt && (
                            <span className="text-blue-500">
                              Scheduled: {new Date(activity.scheduledAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
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
