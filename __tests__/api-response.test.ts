import { describe, it, expect } from 'vitest';
import { formatZodErrors } from '@/lib/api/response';

describe('API Response Helpers', () => {
  describe('formatZodErrors', () => {
    it('should format single error', () => {
      const error = {
        issues: [{ path: ['email'], message: 'Invalid email' }],
      };

      const result = formatZodErrors(error);
      expect(result).toEqual({ email: ['Invalid email'] });
    });

    it('should format nested path errors', () => {
      const error = {
        issues: [{ path: ['address', 'city'], message: 'City is required' }],
      };

      const result = formatZodErrors(error);
      expect(result).toEqual({ 'address.city': ['City is required'] });
    });

    it('should handle empty path', () => {
      const error = {
        issues: [{ path: [], message: 'Invalid input' }],
      };

      const result = formatZodErrors(error);
      expect(result).toEqual({ '_root': ['Invalid input'] });
    });

    it('should group multiple errors for same field', () => {
      const error = {
        issues: [
          { path: ['password'], message: 'Too short' },
          { path: ['password'], message: 'Needs uppercase' },
        ],
      };

      const result = formatZodErrors(error);
      expect(result).toEqual({ password: ['Too short', 'Needs uppercase'] });
    });

    it('should handle multiple fields', () => {
      const error = {
        issues: [
          { path: ['email'], message: 'Invalid email' },
          { path: ['password'], message: 'Too short' },
        ],
      };

      const result = formatZodErrors(error);
      expect(result).toEqual({
        email: ['Invalid email'],
        password: ['Too short'],
      });
    });
  });
});
