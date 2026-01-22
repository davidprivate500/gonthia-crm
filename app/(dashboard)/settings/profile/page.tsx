'use client';

import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';

const roleDescriptions: Record<string, string> = {
  owner: 'Full access to all features and settings',
  admin: 'Can manage team members and most settings',
  member: 'Can create and edit records',
  readonly: 'Can view all records but cannot make changes',
};

export default function ProfilePage() {
  const { user, organization } = useAuth();

  return (
    <>
      <Header title="Profile" description="Your account information" />

      <div className="p-6 max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-medium">
                {user?.firstName?.[0] || user?.email?.[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold">
                  {user?.firstName
                    ? `${user.firstName} ${user.lastName || ''}`
                    : user?.email}
                </h2>
                <p className="text-gray-600">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <p className="text-sm text-gray-500">Role</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className="capitalize">{user?.role}</Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {roleDescriptions[user?.role || 'member']}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Organization</p>
                <p className="font-medium mt-1">{organization?.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>
              Manage your password and security settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              To change your password, use the &quot;Forgot Password&quot; feature on the login page.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
