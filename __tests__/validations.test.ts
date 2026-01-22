import { describe, it, expect } from 'vitest';
import { registerSchema, loginSchema, forgotPasswordSchema } from '@/validations/auth';
import { createContactSchema, contactQuerySchema } from '@/validations/contact';

describe('Auth Validations', () => {
  describe('registerSchema', () => {
    it('should validate valid registration data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'Password123',
        organizationName: 'Acme Corp',
        firstName: 'John',
        lastName: 'Doe',
      };

      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const invalidData = {
        email: 'not-an-email',
        password: 'Password123',
        organizationName: 'Acme Corp',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject weak password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'weak',
        organizationName: 'Acme Corp',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require organization name', () => {
      const invalidData = {
        email: 'test@example.com',
        password: 'Password123',
      };

      const result = registerSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('loginSchema', () => {
    it('should validate valid login data', () => {
      const validData = {
        email: 'test@example.com',
        password: 'password',
      };

      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const invalidData = {
        email: 'test@example.com',
        password: '',
      };

      const result = loginSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('forgotPasswordSchema', () => {
    it('should validate valid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = forgotPasswordSchema.safeParse({ email: 'invalid' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Contact Validations', () => {
  describe('createContactSchema', () => {
    it('should validate valid contact data', () => {
      const validData = {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        phone: '+1234567890',
        status: 'lead',
      };

      const result = createContactSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should require first name', () => {
      const invalidData = {
        lastName: 'Doe',
      };

      const result = createContactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should require last name', () => {
      const invalidData = {
        firstName: 'Jane',
      };

      const result = createContactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should validate status enum', () => {
      const validStatuses = ['lead', 'prospect', 'customer', 'churned', 'other'];

      for (const status of validStatuses) {
        const result = createContactSchema.safeParse({
          firstName: 'Jane',
          lastName: 'Doe',
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    it('should reject invalid status', () => {
      const invalidData = {
        firstName: 'Jane',
        lastName: 'Doe',
        status: 'invalid-status',
      };

      const result = createContactSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('contactQuerySchema', () => {
    it('should use defaults for empty query', () => {
      const result = contactQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.pageSize).toBe(20);
        expect(result.data.sortBy).toBe('createdAt');
        expect(result.data.sortOrder).toBe('desc');
      }
    });

    it('should accept valid sort options', () => {
      const result = contactQuerySchema.safeParse({
        sortBy: 'firstName',
        sortOrder: 'asc',
      });
      expect(result.success).toBe(true);
    });
  });
});
