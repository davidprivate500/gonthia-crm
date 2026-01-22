'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/client';
import { Users, Building2, Kanban, Activity, DollarSign } from 'lucide-react';

interface DashboardData {
  summary: {
    totalContacts: number;
    totalCompanies: number;
    totalDeals: number;
    activitiesThisMonth: number;
    totalPipelineValue: number;
  };
  recentContacts: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    status: string;
    createdAt: string;
  }>;
  pipeline: Array<{
    id: string;
    name: string;
    color: string | null;
    dealCount: number;
    totalValue: number;
  }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await api.dashboard();
        if (response.data) {
          setData(response.data as DashboardData);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  const stats = [
    {
      name: 'Total Contacts',
      value: data?.summary.totalContacts || 0,
      icon: Users,
      href: '/contacts',
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Companies',
      value: data?.summary.totalCompanies || 0,
      icon: Building2,
      href: '/companies',
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Active Deals',
      value: data?.summary.totalDeals || 0,
      icon: Kanban,
      href: '/pipeline',
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Pipeline Value',
      value: `$${(data?.summary.totalPipelineValue || 0).toLocaleString()}`,
      icon: DollarSign,
      href: '/pipeline',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
    },
  ];

  return (
    <>
      <Header
        title="Dashboard"
        description="Welcome back! Here's an overview of your CRM."
      />
      <div className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Link key={stat.name} href={stat.href}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-full ${stat.bgColor}`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pipeline Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Kanban className="h-5 w-5" />
                Pipeline Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.pipeline && data.pipeline.length > 0 ? (
                <div className="space-y-4">
                  {data.pipeline.map((stage) => (
                    <div key={stage.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: stage.color || '#6366f1' }}
                        />
                        <span className="text-sm font-medium">{stage.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{stage.dealCount} deals</p>
                        <p className="text-xs text-gray-500">
                          ${stage.totalValue.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No pipeline stages yet.</p>
                  <Link href="/pipeline" className="text-primary hover:underline text-sm">
                    Set up your pipeline
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recent Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentContacts && data.recentContacts.length > 0 ? (
                <div className="space-y-4">
                  {data.recentContacts.map((contact) => (
                    <Link
                      key={contact.id}
                      href={`/contacts/${contact.id}`}
                      className="flex items-center justify-between hover:bg-gray-50 -mx-2 px-2 py-2 rounded-md transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium">
                          {contact.firstName[0]}
                          {contact.lastName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {contact.firstName} {contact.lastName}
                          </p>
                          {contact.email && (
                            <p className="text-xs text-gray-500">{contact.email}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 capitalize">
                        {contact.status}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No contacts yet.</p>
                  <Link href="/contacts/new" className="text-primary hover:underline text-sm">
                    Add your first contact
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Activity Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gray-100 rounded-lg">
                <p className="text-3xl font-bold">{data?.summary.activitiesThisMonth || 0}</p>
                <p className="text-sm text-gray-600">Activities logged</p>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-600">
                  Track calls, emails, meetings, and tasks to stay on top of your
                  customer relationships.
                </p>
                <Link href="/activities" className="text-primary hover:underline text-sm">
                  View all activities
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
