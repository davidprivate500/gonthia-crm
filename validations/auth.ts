import { z } from 'zod';

export const emailSchema = z.string().email('Invalid email address').max(255);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  organizationName: z.string().min(1, 'Organization name is required').max(255),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: passwordSchema,
});

export const inviteUserSchema = z.object({
  email: emailSchema,
  role: z.enum(['admin', 'member', 'readonly']),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member', 'readonly']),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(255),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
