import { describe, it, expect } from 'vitest';
import {
  canCreate,
  canUpdate,
  canDelete,
  canManageUsers,
  canInviteRole,
  canManageOrganization,
  canViewAuditLog,
  canManageApiKeys,
  canExportData,
  type UserRole,
} from '@/lib/auth/session';

describe('Session Permission Helpers', () => {
  describe('canCreate', () => {
    it('should allow owner to create', () => {
      expect(canCreate('owner')).toBe(true);
    });

    it('should allow admin to create', () => {
      expect(canCreate('admin')).toBe(true);
    });

    it('should allow member to create', () => {
      expect(canCreate('member')).toBe(true);
    });

    it('should deny readonly user to create', () => {
      expect(canCreate('readonly')).toBe(false);
    });
  });

  describe('canUpdate', () => {
    it('should allow owner to update', () => {
      expect(canUpdate('owner')).toBe(true);
    });

    it('should allow admin to update', () => {
      expect(canUpdate('admin')).toBe(true);
    });

    it('should allow member to update', () => {
      expect(canUpdate('member')).toBe(true);
    });

    it('should deny readonly user to update', () => {
      expect(canUpdate('readonly')).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('should allow owner to delete', () => {
      expect(canDelete('owner')).toBe(true);
    });

    it('should allow admin to delete', () => {
      expect(canDelete('admin')).toBe(true);
    });

    it('should deny member to delete', () => {
      expect(canDelete('member')).toBe(false);
    });

    it('should deny readonly user to delete', () => {
      expect(canDelete('readonly')).toBe(false);
    });
  });

  describe('canManageUsers', () => {
    it('should allow owner to manage users', () => {
      expect(canManageUsers('owner')).toBe(true);
    });

    it('should allow admin to manage users', () => {
      expect(canManageUsers('admin')).toBe(true);
    });

    it('should deny member to manage users', () => {
      expect(canManageUsers('member')).toBe(false);
    });

    it('should deny readonly user to manage users', () => {
      expect(canManageUsers('readonly')).toBe(false);
    });
  });

  describe('canInviteRole', () => {
    it('should allow owner to invite any role', () => {
      const roles: UserRole[] = ['owner', 'admin', 'member', 'readonly'];
      for (const role of roles) {
        expect(canInviteRole('owner', role)).toBe(true);
      }
    });

    it('should allow admin to invite member and readonly', () => {
      expect(canInviteRole('admin', 'member')).toBe(true);
      expect(canInviteRole('admin', 'readonly')).toBe(true);
    });

    it('should deny admin to invite admin or owner', () => {
      expect(canInviteRole('admin', 'admin')).toBe(false);
      expect(canInviteRole('admin', 'owner')).toBe(false);
    });

    it('should deny member to invite anyone', () => {
      const roles: UserRole[] = ['owner', 'admin', 'member', 'readonly'];
      for (const role of roles) {
        expect(canInviteRole('member', role)).toBe(false);
      }
    });

    it('should deny readonly to invite anyone', () => {
      const roles: UserRole[] = ['owner', 'admin', 'member', 'readonly'];
      for (const role of roles) {
        expect(canInviteRole('readonly', role)).toBe(false);
      }
    });
  });

  describe('canManageOrganization', () => {
    it('should allow only owner to manage organization', () => {
      expect(canManageOrganization('owner')).toBe(true);
      expect(canManageOrganization('admin')).toBe(false);
      expect(canManageOrganization('member')).toBe(false);
      expect(canManageOrganization('readonly')).toBe(false);
    });
  });

  describe('canViewAuditLog', () => {
    it('should allow owner and admin to view audit log', () => {
      expect(canViewAuditLog('owner')).toBe(true);
      expect(canViewAuditLog('admin')).toBe(true);
    });

    it('should deny member and readonly to view audit log', () => {
      expect(canViewAuditLog('member')).toBe(false);
      expect(canViewAuditLog('readonly')).toBe(false);
    });
  });

  describe('canManageApiKeys', () => {
    it('should allow owner and admin to manage API keys', () => {
      expect(canManageApiKeys('owner')).toBe(true);
      expect(canManageApiKeys('admin')).toBe(true);
    });

    it('should deny member and readonly to manage API keys', () => {
      expect(canManageApiKeys('member')).toBe(false);
      expect(canManageApiKeys('readonly')).toBe(false);
    });
  });

  describe('canExportData', () => {
    it('should allow only owner to export data', () => {
      expect(canExportData('owner')).toBe(true);
      expect(canExportData('admin')).toBe(false);
      expect(canExportData('member')).toBe(false);
      expect(canExportData('readonly')).toBe(false);
    });
  });
});
